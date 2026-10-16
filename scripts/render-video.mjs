#!/usr/bin/env node
// Render a competition's winner video to an MP4 for Instagram: 1080 × 1920, H.264 and AAC, with
// the site's music. It opens /admin/video/render in headless Chrome (your installed Chrome), takes
// over the page's clock, and screenshots it one frame at a time, so every frame is exact however
// long it takes to draw. The music is rendered offline, effects and all, in time with the frames.
//
//   pnpm video                          → the active competition, from `pnpm dev` (keep it running)
//   pnpm video stockholm-2026-09        → that competition
//   --name 'September 2026'             → the name in the question (default: the competition's title)
//   --fps 60                            → frames per second (default 30)
//   --out path/to/video.mp4             → where to save it (default videos/<slug>.mp4)
//   --url https://postervote.com        → render from another copy of the site (default the dev server)

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    fps: { type: 'string', default: '30' },
    out: { type: 'string' },
    url: { type: 'string', default: 'http://localhost:5173' }
  }
});
const slug = positionals[0];
const fps = Number(opts.fps);
if (!(fps > 0 && fps <= 120)) {
  console.error('--fps must be a number from 1 to 120');
  process.exit(1);
}
const base = opts.url.replace(/\/$/, '');

try {
  await fetch(base);
} catch {
  console.error(`Can't reach ${base}. Start the site with \`pnpm dev\` first, or pass --url.`);
  process.exit(1);
}

// The video is 540 × 960 CSS pixels; at 2× that's 1080 × 1920.
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error(`Page error: ${e.message}`));

const query = new URLSearchParams();
if (slug) query.set('competition', slug);
if (opts.name) query.set('name', opts.name);
await page.goto(`${base}/admin/video/render?${query}`);
console.log('Loading the competition and its posters…');
const status = await page.waitForFunction(() => window.__video && { ready: window.__video.ready, error: window.__video.error }, null, {
  timeout: 120_000
});
const { ready, error } = await status.jsonValue();
if (!ready) {
  console.error(`Couldn't load it: ${error}`);
  await browser.close();
  process.exit(1);
}
const info = await page.evaluate(() => {
  const { seconds, competition, votes, top } = window.__video.api;
  return { seconds, competition, votes, top };
});
console.log(`${info.competition}: ${info.votes.toLocaleString('en-GB')} votes. Top three: ${info.top.join(' · ')}`);

const out = path.resolve(opts.out ?? path.join(root, 'videos', `${slug ?? 'active'}.mp4`));
await fs.mkdir(path.dirname(out), { recursive: true });
const music = path.join(os.tmpdir(), `postervote-music-${process.pid}.wav`);
console.log('Rendering the music…');
await fs.writeFile(music, Buffer.from(await page.evaluate(() => window.__video.api.music()), 'base64'));

// PNG frames in on stdin, the music from the file, an MP4 out.
const encoder = spawn(
  ffmpeg,
  [
    ['-y', '-loglevel', 'error'],
    ['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-'],
    ['-i', music],
    ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps)],
    ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]
  ].flat(),
  { stdio: ['pipe', 'inherit', 'inherit'] }
);
const encoded = new Promise((resolve, reject) => {
  encoder.on('error', reject);
  encoder.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
});

const cdp = await page.context().newCDPSession(page);
const frames = Math.round(info.seconds * fps);
const started = Date.now();
await page.evaluate(() => window.__video.api.start());
for (let i = 0, at = 0; i < frames; i++) {
  // Exactly i/fps seconds in, without rounding errors adding up.
  const next = (i * 1000) / fps;
  await page.evaluate((ms) => window.__video.api.advance(ms), next - at);
  at = next;
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    optimizeForSpeed: true,
    // In CSS pixels, with the scale making them device pixels.
    clip: { x: 0, y: 0, width: 540, height: 960, scale: 2 }
  });
  if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => encoder.stdin.once('drain', r));
  if (i % fps === 0 || i === frames - 1) {
    const done = (i + 1) / frames;
    const left = ((Date.now() - started) / done) * (1 - done);
    process.stdout.write(`\rFrame ${i + 1} of ${frames} (${Math.round(done * 100)}%), about ${Math.ceil(left / 1000)} s left   `);
  }
}
encoder.stdin.end();
await browser.close();
await encoded;
await fs.rm(music, { force: true });
console.log(`\nSaved ${path.relative(process.cwd(), out)} (${Math.round((Date.now() - started) / 1000)} s to render)`);

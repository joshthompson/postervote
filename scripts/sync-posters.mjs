#!/usr/bin/env node
// Optimise every image in ./posters into ./static/posters/<slug> (as JPEG) and register them in Convex
// as the posters of the collection in posters/collection.json ({ "slug": "…", "title": "…" }).
//
//   pnpm posters:sync        → dev deployment: updates the live collection's posters
//   pnpm posters:sync:prod   → production deployment (uses CONVEX_DEPLOY_KEY from .env.production)
//   --publish                → a new slug becomes the live collection, closing voting on the one
//                              before (its images stay in place). `pnpm collections publish` adds it.
//   --images-only            → just optimise images (run before every build)
//
// Titles come from posters/titles.json ({ "001.jpg": "My Title" }), falling back to the filename.
// HEIC and resizing use macOS `sips`; on other platforms JPEG/PNG/WebP are copied as-is.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'posters');
const collection = JSON.parse(await fs.readFile(path.join(SRC, 'collection.json'), 'utf8'));
if (!/^[a-z0-9-]+$/.test(collection.slug ?? '') || !collection.title) {
  console.error('posters/collection.json needs a "slug" (a-z, 0-9, -) and a "title"');
  process.exit(1);
}
const OUT = path.join(root, 'static', 'posters', collection.slug);
const MAX_SIZE = 1200;
const IMAGE = /\.(heic|heif|jpe?g|png|webp|avif)$/i;
const WEB_SAFE = /\.(jpe?g|png|webp|avif)$/i;
const prod = process.argv.includes('--prod');
const imagesOnly = process.argv.includes('--images-only');
const publish = process.argv.includes('--publish');
const hasSips = os.platform() === 'darwin';

async function readTitles() {
  try {
    return JSON.parse(await fs.readFile(path.join(SRC, 'titles.json'), 'utf8'));
  } catch {
    return {};
  }
}

function prettify(name) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[\s_-]*large$/i, '');
  const camera = stem.match(/^(?:IMG|DSC|PXL)[\s_-]*(\d+)/i);
  if (camera) return `No. ${camera[1]}`;
  if (/^\d+$/.test(stem)) return `No. ${Number(stem)}`;
  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function isFresh(src, out) {
  try {
    const [s, o] = await Promise.all([fs.stat(src), fs.stat(out)]);
    return o.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

async function convert(file) {
  const src = path.join(SRC, file);
  const base = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let outName;
  if (hasSips) {
    outName = `${base}.jpg`;
    const out = path.join(OUT, outName);
    if (!(await isFresh(src, out))) {
      // `sips -Z` also upscales, so only resize images larger than MAX_SIZE.
      const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src]);
      const longest = Math.max(...[...stdout.matchAll(/pixel\w+: (\d+)/g)].map((m) => Number(m[1])));
      const resize = longest > MAX_SIZE ? ['-Z', String(MAX_SIZE)] : [];
      await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', ...resize, src, '--out', out]);
    }
  } else if (WEB_SAFE.test(file)) {
    outName = `${base}${path.extname(file).toLowerCase()}`;
    await fs.copyFile(src, path.join(OUT, outName));
  } else {
    console.warn(`  ! skipping ${file}: HEIC conversion needs macOS (or convert it to JPEG first)`);
    return null;
  }
  return { file, outName };
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx]);
        if (process.stdout.isTTY) process.stdout.write(`\r  optimised ${results.filter(Boolean).length}/${items.length}`);
      }
    })
  );
  process.stdout.write('\n');
  return results;
}

// An archived collection's images are its archive's; a new collection needs a new slug.
const archived = await fs.stat(path.join(root, 'archives', collection.slug)).then(() => true, () => false);
if (archived && !imagesOnly) {
  console.error(`“${collection.slug}” has been archived (archives/${collection.slug}). Give posters/collection.json a new slug.`);
  process.exit(1);
}

const files = (await fs.readdir(SRC).catch(() => [])).filter((f) => IMAGE.test(f)).sort();
if (!files.length) {
  console.error('No images found in ./posters');
  process.exit(1);
}

await fs.mkdir(OUT, { recursive: true });
console.log(`Found ${files.length} posters`);
const converted = (await pool(files, Math.max(2, os.cpus().length), convert)).filter(Boolean);

// Remove optimised files whose source has gone.
const keep = new Set(converted.map((c) => c.outName));
for (const f of await fs.readdir(OUT)) {
  if (!keep.has(f)) await fs.rm(path.join(OUT, f));
}

if (imagesOnly) process.exit(0);

const titles = await readTitles();
const posters = converted.map(({ file, outName }) => ({
  key: file,
  title: titles[file] ?? prettify(file),
  image: `posters/${collection.slug}/${outName}`
}));

console.log(`${publish ? 'Publishing' : 'Syncing'} “${collection.title}” to Convex (${prod ? 'prod' : 'dev'})…`);
const args = [
  'convex',
  'run',
  'posters:sync',
  JSON.stringify({ collection: { slug: collection.slug, title: collection.title }, posters, publish })
];
if (prod) args.push('--prod');
let stdout;
try {
  ({ stdout } = await run('npx', args, { cwd: root, maxBuffer: 10 * 1024 * 1024 }));
} catch (e) {
  // Convex's own message (e.g. that publishing needs --publish) is the useful part.
  console.error((e.stderr || e.message).trim());
  process.exit(1);
}
console.log(stdout.trim());
if (prod) console.log('Note: rebuild & redeploy the site (pnpm deploy:web) so new images are published.');

#!/usr/bin/env node
// Draft, publish, archive and clear collections (see "Collections" in the README).
//
//   pnpm collections                      → list the collections in Convex and in archives/
//   pnpm collections draft                → posters/collection.json becomes a draft (or updates it),
//                                           seen only in the site's dev mode (posters:sync --draft)
//   pnpm collections publish [slug]       → the draft (by default the one in posters/collection.json)
//                                           becomes the live collection, and the one before closes
//                                           and is archived, as `archive` does
//   pnpm collections archive <slug>       → write a closed collection to archives/<slug>/ in the repo:
//                                           results.json and summary.json, which the site shows it
//                                           from, and votes.json.gz, every vote (voters numbered)
//   pnpm collections clear <slug>         → once that's deployed, delete it all from Convex
//   pnpm collections discard <slug>       → delete a draft
//   --dir <folder>                        → draft from another folder than posters/ (and publish its slug)
//   --prod                                → the production deployment (CONVEX_DEPLOY_KEY from .env.production)
//   --close                               → archive the live collection, ending voting with none live
//   --yes                                 → publish, clear or discard without asking
//   --force                               → archive over an archive from the other deployment, or publish
//                                           and clear without checking the live site

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs, promisify } from 'node:util';
import zlib from 'node:zlib';

const run = promisify(execFile);
const gzip = promisify(zlib.gzip);
const root = path.resolve(import.meta.dirname, '..');
const ARCHIVES = path.join(root, 'archives');

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: 'posters' },
    prod: { type: 'boolean', default: false },
    close: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false }
  }
});
const [command = 'list', slug] = positionals;
const deployment = opts.prod ? 'prod' : 'dev';

/** .env.production's variables, for --prod (as `dotenv -e .env.production` gives the other scripts). */
async function prodEnv() {
  const text = await fs.readFile(path.join(root, '.env.production'), 'utf8').catch(() => '');
  const env = Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')])
  );
  if (!env.CONVEX_DEPLOY_KEY) fail('--prod needs CONVEX_DEPLOY_KEY in .env.production');
  return env;
}
const env = opts.prod ? { ...process.env, ...(await prodEnv()) } : process.env;

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Run a Convex function on the deployment and return what it returns. */
async function convex(fn, args = {}) {
  const argv = ['convex', 'run', fn, JSON.stringify(args)];
  if (opts.prod) argv.push('--prod');
  try {
    const { stdout } = await run('npx', argv, { cwd: root, env, maxBuffer: 256 * 1024 * 1024 });
    // A function that returns nothing prints nothing.
    return stdout.trim() ? JSON.parse(stdout) : undefined;
  } catch (e) {
    const message = (e.stderr || e.message).trim();
    // Reading a collection out for its archive takes internal queries, which a restricted key can't run.
    const hint = /do not have permission/.test(message)
      ? '\nThe deploy key in .env.production needs permission to run internal functions (Convex dashboard → Settings → Deploy keys).'
      : '';
    fail(message + hint);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (file) => fs.stat(file).then(() => true, () => false);
const num = (n) => n.toLocaleString('en-GB');
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '…');

async function readSummary(s) {
  const file = path.join(ARCHIVES, s, 'summary.json');
  return (await exists(file)) ? JSON.parse(await fs.readFile(file, 'utf8')) : null;
}

/** The site's address, from the share links (SITE in src/lib/features/share/links.ts). */
async function site() {
  const source = await fs.readFile(path.join(root, 'src/lib/features/share/links.ts'), 'utf8');
  return source.match(/export const SITE = '([^']+)'/)?.[1];
}

async function list() {
  const live = await inConvex();
  const archived = (await fs.readdir(ARCHIVES).catch(() => [])).filter((s) => !s.startsWith('.'));
  console.log(`In Convex (${deployment}):`);
  if (!live.length) console.log('  none');
  for (const c of live) {
    const state = c.draft
      ? 'draft'
      : c.active
        ? 'live'
        : archived.includes(c.slug)
          ? 'archived, not cleared yet'
          : 'closed, not archived';
    const dates = c.draft ? '' : `  ${day(c.openedAt)} – ${c.active ? 'now' : day(c.closedAt)}`;
    console.log(`  ${c.slug}  “${c.title}”  ${num(c.votes)} votes${dates}  (${state})`);
  }
  console.log('In archives/:');
  if (!archived.length) console.log('  none');
  for (const s of archived) {
    const summary = await readSummary(s);
    console.log(`  ${s}  “${summary?.title}”  ${num(summary?.votes ?? 0)} votes  (from ${summary?.deployment})`);
  }
}

/** Ask before something that can't be undone: they type `answer` to go ahead (or pass --yes). */
async function confirm(question, answer) {
  if (opts.yes) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(`${question} Type ${answer} to confirm: `);
  rl.close();
  if (typed.trim() !== answer) fail('Nothing changed.');
}

/** Every collection in Convex, drafts too. A public query, so any deploy key can read it. */
const inConvex = () => convex('collections:list', { drafts: true });

function draft() {
  const argv = [path.join(root, 'scripts/sync-posters.mjs'), '--draft', '--dir', path.resolve(opts.dir)];
  if (opts.prod) argv.push('--prod');
  const child = spawn(process.execPath, argv, { cwd: root, env, stdio: 'inherit' });
  child.on('exit', async (code) => {
    if (code) process.exit(code);
    const { slug: s } = JSON.parse(await fs.readFile(path.resolve(opts.dir, 'collection.json'), 'utf8'));
    console.log(`Look it over at /collections/${s} with setDevMode(true) in the browser console.`);
    console.log(`Commit static/posters/${s} and deploy, so its images are on the site, then: pnpm collections publish ${s}${opts.prod ? ' --prod' : ''}`);
  });
}

async function publish() {
  const target = slug ?? JSON.parse(await fs.readFile(path.resolve(opts.dir, 'collection.json'), 'utf8')).slug;
  const collections = await inConvex();
  const next = collections.find((c) => c.slug === target);
  if (!next) fail(`No collection “${target}” in Convex (${deployment}). Draft it first: pnpm collections draft`);
  if (!next.draft) fail(`“${next.title}” isn't a draft${next.active ? ': it’s already live' : ''}.`);
  const live = collections.find((c) => c.active);

  if (live) {
    // Everything archiving needs, checked before anything changes.
    const previous = await readSummary(live.slug);
    if (previous && previous.deployment !== deployment && !opts.force) {
      fail(`archives/${live.slug} came from ${previous.deployment}, not ${deployment}. Pass --force to replace it.`);
    }
    await convex('archive:state', { slug: live.slug });
  }

  // Voters would see broken images if the draft's weren't deployed yet.
  if (opts.prod && !opts.force) {
    const base = await site();
    const { posters } = await convex('posters:list', { collection: target });
    const missing = [];
    for (const p of posters) {
      const res = await fetch(new URL(p.image, base + '/'), { method: 'HEAD' }).catch(() => null);
      if (res?.status !== 200) missing.push(p.image);
    }
    if (missing.length) {
      fail(`${num(missing.length)} of its images aren’t on ${base} yet (e.g. ${missing[0]}). Commit static/posters/${target} and deploy first.`);
    }
  }

  await confirm(
    live
      ? `Publish “${next.title}” and close voting on “${live.title}” (${deployment})? It’s then archived to archives/${live.slug}.`
      : `Publish “${next.title}” (${deployment})?`,
    target
  );
  const { published, closed } = await convex('collections:publish', { slug: target });
  console.log(`“${published}” is live.`);
  if (!closed) return;
  console.log(`Voting on “${closed.title}” is closed. Archiving it…`);
  await archiveCollection(closed.slug);
}

async function archive() {
  if (!slug) fail('Which collection? pnpm collections archive <slug>');
  const previous = await readSummary(slug);
  if (previous && previous.deployment !== deployment && !opts.force) {
    fail(`archives/${slug} came from ${previous.deployment}, not ${deployment}. Pass --force to replace it.`);
  }

  const state = await convex('archive:state', { slug });
  if (!state) fail(`No collection “${slug}” in Convex (${deployment}).`);
  if (state.draft) fail(`“${state.title}” is a draft. Publish it (pnpm collections publish ${slug}) or discard it.`);
  if (state.active && !opts.close) {
    fail(`“${state.title}” is live. Publish the next collection first (pnpm collections publish), or pass --close to end voting with none live.`);
  }
  await archiveCollection(slug);
}

/** Close a collection (if it's still live), wait for its last votes to be counted, and write its archive. */
async function archiveCollection(slug) {
  let state;
  const { wasActive } = await convex('archive:close', { slug });
  if (wasActive) console.log('Voting on it is closed.');
  process.stdout.write('Waiting for the tally to count the last votes…');
  for (let waited = 0; !(state = await convex('archive:state', { slug })).tallied; waited += 5) {
    if (waited >= 300) fail('\nThe tally hasn’t caught up in 5 minutes. Check it on /admin/stats, then run this again.');
    process.stdout.write('.');
    await wait(5000);
  }
  console.log(' done.');

  console.log('Reading the results…');
  const results = await convex('archive:results', { slug });

  console.log('Reading the votes…');
  let posters = null;
  const votes = [];
  for (let cursor = null, done = false; !done; ) {
    const page = await convex('archive:votes', { slug, cursor });
    posters ??= page.posters;
    votes.push(...page.votes);
    ({ cursor, done } = page);
    if (process.stdout.isTTY) process.stdout.write(`\r  ${num(votes.length)} votes`);
  }
  if (process.stdout.isTTY) process.stdout.write('\n');
  // Voter ids are numbered in order of their first vote, so the backup, which is public with the
  // repo, says how each voter voted without naming anyone's browser.
  const voters = new Map();
  const numbered = votes.map(({ voterId, ...vote }) => {
    if (!voters.has(voterId)) voters.set(voterId, voters.size + 1);
    return { ...vote, voter: voters.get(voterId) };
  });

  const scores = results.snapshots.all?.scores ?? [];
  const byId = new Map(results.posters.map((p) => [p._id, p]));
  const top = [...scores]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map((s) => byId.get(s.id))
    .filter(Boolean)
    .map(({ title, image }) => ({ title, image }));
  const summary = {
    slug,
    title: results.collection.title,
    openedAt: results.collection.openedAt,
    closedAt: results.collection.closedAt,
    votes: results.live.all,
    voters: results.snapshots.all?.voters ?? 0,
    posters: results.posters.length,
    top,
    archivedAt: Date.now(),
    deployment
  };

  const dir = path.join(ARCHIVES, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'results.json'), JSON.stringify(results));
  await fs.writeFile(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  await fs.writeFile(path.join(dir, 'votes.json.gz'), await gzip(JSON.stringify({ slug, posters, votes: numbered })));
  await convex('archive:markArchived', { slug });

  console.log(`Archived “${summary.title}” to archives/${slug}: ${num(numbered.length)} votes from ${num(voters.size)} voter${voters.size === 1 ? '' : 's'}.`);
  console.log('Next: commit archives/' + slug + ', deploy the site, then clear it from Convex:');
  console.log(`  pnpm collections clear ${slug}${opts.prod ? ' --prod' : ''}`);
}

async function discard() {
  if (!slug) fail('Which draft? pnpm collections discard <slug>');
  const d = (await inConvex()).find((c) => c.slug === slug);
  if (!d) return console.log(`“${slug}” isn’t in Convex (${deployment}); nothing to discard.`);
  if (!d.draft) fail(`“${d.title}” isn’t a draft.`);
  await confirm(`Delete the draft “${d.title}” and its posters from Convex (${deployment})?`, slug);
  await convex('archive:clear', { slug });
  while ((await inConvex()).some((c) => c.slug === slug)) await wait(1000);
  console.log(`Discarded “${d.title}”. Its images are still in static/posters/${slug}.`);
}

async function clear() {
  if (!slug) fail('Which collection? pnpm collections clear <slug>');
  const summary = await readSummary(slug);
  for (const file of ['summary.json', 'results.json', 'votes.json.gz']) {
    if (!(await exists(path.join(ARCHIVES, slug, file)))) fail(`archives/${slug}/${file} is missing. Run pnpm collections archive ${slug} first.`);
  }
  if (summary.deployment !== deployment) fail(`archives/${slug} came from ${summary.deployment}, not ${deployment}.`);

  const state = await convex('archive:state', { slug });
  if (!state) return console.log(`“${slug}” isn’t in Convex (${deployment}); nothing to clear.`);
  if (!state.archivedAt) fail(`“${state.title}” hasn’t been archived. Run pnpm collections archive ${slug} first.`);

  // The live site must show it from its archive before Convex forgets it. Pages for archives are
  // prerendered, so the page answers 200 once a build with the archive is deployed (until then it's
  // the 404 fallback).
  if (opts.prod && !opts.force) {
    const url = `${await site()}/collections/${slug}`;
    const res = await fetch(url, { redirect: 'manual' }).catch(() => null);
    if (res?.status !== 200) fail(`${url} isn’t live yet (${res?.status ?? 'unreachable'}). Commit archives/${slug} and deploy first.`);
  }

  await confirm(`Delete “${state.title}” from Convex (${deployment}): its ${num(summary.votes)} votes, posters and rankings?`, slug);

  await convex('archive:clear', { slug });
  process.stdout.write('Deleting…');
  while (await convex('archive:state', { slug })) {
    process.stdout.write('.');
    await wait(2000);
  }
  console.log(` done. “${state.title}” now shows from archives/${slug}.`);
}

const commands = { list, draft, publish, archive, clear, discard };
if (!commands[command]) fail(`Unknown command “${command}”. Try list, draft, publish, archive, clear or discard.`);
await commands[command]();

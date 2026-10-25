import { posterEntries } from '$lib/server/previews';
import type { EntryGenerator } from './$types';

// Every poster in Convex at build time gets a prerendered page, so link previews can show it (see
// previews.ts). Posters synced since then aren't prerendered: GitHub Pages serves them through
// the 404.html fallback, like /results/<slug>.
export const prerender = 'auto';
export const entries: EntryGenerator = posterEntries;

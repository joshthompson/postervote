import { summaries } from '$lib/features/collections/archives.svelte';
import type { EntryGenerator } from './$types';

// Every archived collection gets a prerendered page, so its link works without the 404.html
// fallback (which is how `pnpm collections clear` sees it's deployed). Collections still in
// Convex open through the fallback, like posters synced since the build.
export const prerender = 'auto';
export const entries: EntryGenerator = () => summaries.map((s) => ({ collection: s.slug }));

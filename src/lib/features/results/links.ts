import { resolve } from '$app/paths';
import type { PosterInfo } from '$lib/services/posters.svelte';

// Each poster has its own page at /poster/<collection slug>/<name>, where the name comes from its
// title, e.g. "Dungen – Vidrig Vår (Album)" → "dungen-vidrig-var-album". Renaming a poster
// changes its link.

/** A title as a link segment: lowercase letters and digits, joined by hyphens. */
export function slugify(title: string) {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

/** Each poster's name in its link. A name already taken by an earlier poster gets "-2", "-3"… */
export function posterNames(posters: PosterInfo[]) {
  const names = new Map<PosterInfo['_id'], string>();
  const taken = new Set<string>();
  for (const p of posters) {
    const base = slugify(p.title) || 'poster';
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    taken.add(name);
    names.set(p._id, name);
  }
  return names;
}

/** The URL of a poster's own page. */
export const posterHref = (collection: string, name: string) =>
  resolve('/poster/[collection]/[name]', { collection, name });

/** A click the page should handle itself; with a modifier key the browser opens the link its own way. */
export const plainClick = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

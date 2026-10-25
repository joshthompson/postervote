import { useLiveCounts, useSnapshot } from '$lib/features/collections/data.svelte';
import { rank } from '$lib/features/results/hydrate';
import { usePosters } from '$lib/services/posters.svelte';
import { posterSrc } from '$lib/utils/images';

// What the winner video shows: a collection (by slug, or the active one), its posters ranked
// by everyone's votes, and how many votes there were. Read from the tallies like the rankings,
// so up to 15 minutes behind for the active collection, or from an archived one's archive.

export function useVideoData(collection: () => string | undefined) {
  const posterList = usePosters(collection);
  const snap = useSnapshot(() => ({ segment: 'all' as const, collection: collection() }));
  const counts = useLiveCounts(() => ({ collection: collection() }));

  const ranked = $derived(
    posterList.data && snap.data ? rank(posterList.data, snap.data.snapshot?.scores ?? []) : undefined
  );

  return {
    /** Its slug, title and whether it's active; undefined while loading. */
    get collection() {
      return snap.data?.collection;
    },
    /** True when there's no such collection. */
    get missing() {
      return snap.data === null;
    },
    /** Every poster, best first; undefined while loading. */
    get ranked() {
      return ranked;
    },
    get votes() {
      return Math.max(snap.data?.snapshot?.votes ?? 0, counts.data?.all ?? 0);
    },
    get error() {
      return snap.error ?? posterList.error ?? counts.error;
    }
  };
}

/**
 * Loads and decodes every poster, so none pops in late. Keep the result: holding the images keeps
 * them decoded.
 */
export function preloadPosters(posters: { image: string }[], onEach?: () => void) {
  return Promise.all(
    posters.map(async (p) => {
      const img = new Image();
      img.src = posterSrc(p.image);
      await img.decode().catch(() => {});
      onEach?.();
      return img;
    })
  );
}

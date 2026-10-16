import { useQuery } from 'convex-svelte';
import { api } from '$convex/api';
import { rank } from '$lib/features/results/hydrate';
import { usePosters } from '$lib/services/posters.svelte';
import { posterSrc } from '$lib/utils/images';

// What the winner video shows: a competition (by slug, or the active one), its posters ranked
// by everyone's votes, and how many votes there were. Read from the tallies like the rankings,
// so up to 15 minutes behind for the active competition.

export function useVideoData(competition: () => string | undefined) {
  const posterList = usePosters(competition);
  const snap = useQuery(api.results.snapshot, () => ({ segment: 'all' as const, competition: competition() }));
  const counts = useQuery(api.results.live, () => ({ competition: competition() }));

  const ranked = $derived(
    posterList.data && snap.data ? rank(posterList.data, snap.data.snapshot?.scores ?? []) : undefined
  );

  return {
    /** Its slug, title and whether it's active; undefined while loading. */
    get competition() {
      return snap.data?.competition;
    },
    /** True when there's no such competition. */
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

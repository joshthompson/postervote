import { useQuery } from 'convex-svelte';
import { api } from '$convex/api';
import { useLiveCounts, useSnapshot } from '$lib/features/collections/data.svelte';
import { rank } from '$lib/features/results/hydrate';
import { usePosters, type PosterInfo } from '$lib/services/posters.svelte';
import { posterSrc } from '$lib/utils/images';
import { NEXT_POSTERS, shuffled } from './timeline';

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
 * The collection the video asks people to vote on next (by slug; none without one): its title and
 * posters. A draft or the live one, so it's read from Convex, never an archive.
 */
export function useNextCollection(collection: () => string | undefined) {
  const args = <A>(a: A) => (collection() ? { ...a, collection: collection() } : 'skip');
  const snap = useQuery(api.results.snapshot, () => args({ segment: 'all' as const }));
  const posters = useQuery(api.posters.list, () => args({}));
  return {
    /** Its title; undefined while loading or without a slug. */
    get title() {
      return collection() ? snap.data?.collection.title : undefined;
    },
    /** True when there's no such collection. */
    get missing() {
      return !!collection() && snap.data === null;
    },
    /** Its posters; undefined while loading or without a slug. */
    get posters() {
      return collection() ? (posters.data?.posters ?? undefined) : undefined;
    },
    get error() {
      return snap.error ?? posters.error;
    }
  };
}

/** A few of the next collection's posters, at random, for its fan. */
export const pickNext = (posters: PosterInfo[]) => shuffled(posters).slice(0, NEXT_POSTERS);

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

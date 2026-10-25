import { useQuery } from 'convex-svelte';
import type { FunctionReturnType } from 'convex/server';
import { api } from '$convex/api';
import type { Id } from '$convex/dataModel';
import type { Segment } from '$shared';
import { archiveOf, collectionOf, isArchived, posterDetail, summaries, type Archive } from './archives.svelte';

// What the rankings, poster pages and admin pages read about a collection, from wherever it is:
// Convex's live queries for a collection still in Convex, its archive for one archived to the
// repo. Each mirrors a `useQuery` of the Convex query it stands in for, with the same results.

type Options = { keepPreviousData?: boolean };
type Slugged = { collection?: string };

/** `args` for a Convex query: 'skip' for an archived collection, which its archive answers instead. */
const forConvex =
  <A extends Slugged>(args: () => A | 'skip') =>
  () => {
    const a = args();
    return a === 'skip' || isArchived(a.collection) ? 'skip' : a;
  };

/** A Convex query's result for a collection in Convex, or `fromArchive`'s for an archived one. */
function merged<A extends Slugged, R>(
  args: () => A | 'skip',
  convex: { data: R | undefined; error: Error | undefined; isStale: boolean },
  fromArchive: (archive: Archive, args: A) => R
) {
  const archived = $derived.by(() => {
    const a = args();
    return a !== 'skip' && isArchived(a.collection) ? { args: a, archive: archiveOf(a.collection) } : null;
  });
  return {
    get data(): R | undefined {
      if (!archived) return convex.data;
      const { archive, args } = archived;
      return archive && !(archive instanceof Error) ? fromArchive(archive, args) : undefined;
    },
    get error(): Error | undefined {
      if (!archived) return convex.error;
      return archived.archive instanceof Error ? archived.archive : undefined;
    },
    get isStale() {
      return archived ? false : convex.isStale;
    }
  };
}

/** A collection and its snapshot for a segment, as `results.snapshot`. */
export function useSnapshot(args: () => (Slugged & { segment: Segment }) | 'skip', options: Options = {}) {
  const convex = useQuery(api.results.snapshot, forConvex(args), options);
  return merged(args, convex, (archive, { segment }) => ({ collection: collectionOf(archive), snapshot: archive.snapshots[segment] }));
}

/** Votes cast per segment, as `results.live`. */
export function useLiveCounts(args: () => Slugged | 'skip', options: Options = {}) {
  const convex = useQuery(api.results.live, forConvex(args), options);
  return merged(args, convex, (archive) => archive.live);
}

/** The admin stats, as `stats.overview`; an archive has no tally to report on. */
export function useStats(args: () => Slugged | 'skip', options: Options = {}) {
  const convex = useQuery(api.stats.overview, forConvex(args), options);
  return merged(args, convex, (archive) => archive.stats && { ...archive.stats, collection: collectionOf(archive), tally: null });
}

/** One poster's detail, as `results.poster`. */
export function usePosterDetail(args: () => { id: Id<'posters'>; segment: Segment; collection?: string }) {
  const archived = $derived.by(() => {
    const a = args();
    return isArchived(a.collection) ? { args: a, archive: archiveOf(a.collection) } : null;
  });
  const convex = useQuery(api.results.poster, () => {
    const { id, segment, collection } = args();
    return isArchived(collection) ? 'skip' : { id, segment };
  });
  return {
    get data(): FunctionReturnType<typeof api.results.poster> | undefined {
      if (!archived) return convex.data;
      const { archive, args } = archived;
      return archive && !(archive instanceof Error) ? posterDetail(archive, args.id, args.segment) : undefined;
    }
  };
}

/** A collection on the collections page, from Convex or its archive. */
export type CollectionEntry = {
  slug: string;
  title: string;
  active: boolean;
  openedAt: number;
  closedAt: number | null;
  votes: number;
  posters: number;
  /** Its top three so far, best first. */
  top: { title: string; image: string }[];
};

/**
 * Every collection: the live one first, then the closed ones, most recently closed first. A
 * collection archived but not yet cleared from Convex is shown from its archive. While Convex
 * hasn't answered (or can't), `data` has the archived ones alone.
 */
export function useCollections() {
  const query = useQuery(api.collections.list, {});
  const data = $derived.by((): CollectionEntry[] => {
    const archived = new Set(summaries.map((s) => s.slug));
    const all: CollectionEntry[] = [...(query.data ?? []).filter((c) => !archived.has(c.slug)), ...summaries.map((s) => ({ ...s, active: false }))];
    const ended = (c: CollectionEntry) => c.closedAt ?? c.openedAt;
    return all.sort((a, b) => Number(b.active) - Number(a.active) || ended(b) - ended(a));
  });
  return {
    get data() {
      return data;
    },
    /** Whether Convex has answered, so the live and recently closed collections are in `data` too. */
    get complete() {
      return query.data !== undefined;
    },
    get error() {
      return query.error;
    }
  };
}

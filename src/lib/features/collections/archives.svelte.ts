import type { Id } from '$convex/dataModel';
import type { Archive, Segment } from '$shared';

// Collections archived to archives/<slug>/ in the repo by `pnpm collections archive`, bundled with
// the site: every summary.json up front, for the collections page, and a results.json only when
// its collection is opened. Once a collection is cleared from Convex, this is all there is of it.

export type { Archive };

/** What the collections page shows of an archived collection (written by scripts/collections.mjs). */
export type Summary = {
  slug: string;
  title: string;
  openedAt: number;
  closedAt: number | null;
  votes: number;
  voters: number;
  posters: number;
  /** The top three, best first. */
  top: { title: string; image: string }[];
  archivedAt: number;
  deployment: 'dev' | 'prod';
};

const summaryFiles = import.meta.glob<Summary>('/archives/*/summary.json', { eager: true, import: 'default' });
const resultFiles = import.meta.glob<Archive>('/archives/*/results.json', { import: 'default' });
const resultsPath = (slug: string) => `/archives/${slug}/results.json`;

/** Every archived collection, most recently closed first. */
export const summaries: Summary[] = Object.values(summaryFiles).sort(
  (a, b) => (b.closedAt ?? b.archivedAt) - (a.closedAt ?? a.archivedAt)
);

/** Whether `slug` is an archived collection, so the site reads it from its archive instead of Convex. */
export const isArchived = (slug: string | null | undefined): slug is string => !!slug && resultsPath(slug) in resultFiles;

// Archives loaded this visit, or why one couldn't be.
let loaded = $state.raw<Record<string, Archive | Error>>({});
const loading = new Set<string>();

/**
 * The archive of `slug`, an archived collection: undefined until it has loaded (asking for it
 * starts the load), or an Error if it couldn't.
 */
export function archiveOf(slug: string): Archive | Error | undefined {
  const archive = loaded[slug];
  if (!archive && !loading.has(slug)) {
    loading.add(slug);
    resultFiles[resultsPath(slug)]().then(
      (a) => (loaded = { ...loaded, [slug]: a }),
      (e) => {
        loading.delete(slug);
        loaded = { ...loaded, [slug]: e instanceof Error ? e : new Error(String(e)) };
      }
    );
  }
  return archive;
}

/** An archived collection's own details, as Convex's queries name a collection. */
export const collectionOf = (archive: Archive) => ({
  slug: archive.collection.slug,
  title: archive.collection.title,
  active: false,
  draft: false
});

/**
 * One poster's detail from an archive, as `results.poster` works it out from the tallies: its
 * record with designers and everyone else, where it wins most, and its record against each
 * poster it met, most-met first.
 */
export function posterDetail(archive: Archive, id: Id<'posters'>, segment: Segment) {
  const i = archive.posters.findIndex((p) => p._id === id);
  const record = (group: 'designers' | 'others') => {
    const s = archive.snapshots[group]?.scores.find((s) => s.id === id);
    return { wins: s?.wins ?? 0, losses: s?.losses ?? 0 };
  };
  const opponents = archive.matchups[segment]
    .flatMap(([a, b, aWins, bWins]) =>
      a === i
        ? [{ _id: archive.posters[b]._id, wins: aWins, losses: bWins }]
        : b === i
          ? [{ _id: archive.posters[a]._id, wins: bWins, losses: aWins }]
          : []
    )
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - b.losses - (a.wins - a.losses));
  return { designers: record('designers'), others: record('others'), fans: archive.fans[segment][i] ?? [], opponents };
}

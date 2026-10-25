import { internalAction, internalMutation, internalQuery, type QueryCtx } from './_generated/server';
import { api, internal } from './_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id, TableNames } from './_generated/dataModel';
import { find } from './collections';
import { segment } from './schema';
import { SEGMENTS, type Segment } from './shared';
import { settle } from './tally';

// Archiving a closed collection, run by `pnpm collections archive` and `pnpm collections clear`
// (scripts/collections.mjs):
//
// 1. `close` stops voting on it, if it's still live, and has the tally count its last votes.
// 2. Once `state` says the tally has caught up, `results` and `votes` read out everything it
//    holds, which the script writes to archives/<slug>/ in the repo, and `markArchived` notes it.
// 3. After that's deployed, `clear` deletes the collection and everything in it from here. The
//    site shows it from its archive from then on.

const FANS = 3;
const VOTES_PAGE = 4000;
// Documents deleted per run of `clear`: well inside a mutation's write limit.
const CLEAR_BATCH = 2000;

const slugArgs = { slug: v.string() };

/** A segment's snapshot as `results.snapshot` sends it. */
type Snapshot = Omit<Doc<'snapshots'>, '_id' | '_creationTime' | 'collectionId' | 'competitionId' | 'segment'>;
type Fan = { country: string; city: string; wins: number; losses: number };
/** A head-to-head: [a, b, a's wins, b's wins], where a and b are indexes in `posters`. */
type Matchup = [number, number, number, number];

/** What archives/<slug>/results.json holds (see `results`). */
export type Archive = {
  version: 1;
  collection: { slug: string; title: string; openedAt: number; closedAt: number | null };
  posters: { _id: Id<'posters'>; title: string; image: string }[];
  removed: Id<'posters'>[];
  live: Record<Segment, number>;
  snapshots: Record<Segment, Snapshot | null>;
  matchups: Record<Segment, Matchup[]>;
  /** Each poster's biggest fans, in the order of `posters`. */
  fans: Record<Segment, Fan[][]>;
  /** What the admin stats page shows, apart from the tally's state. */
  stats: Omit<NonNullable<FunctionReturnType<typeof api.stats.overview>>, 'collection' | 'tally'> | null;
};

async function mustFind(ctx: QueryCtx, slug: string) {
  const collection = await find(ctx, slug);
  if (!collection) throw new ConvexError(`No collection "${slug}"`);
  return collection;
}

/** Close voting on a collection (if it's live) and have the tally count its last votes. */
export const close = internalMutation({
  args: slugArgs,
  handler: async (ctx, { slug }) => {
    const collection = await mustFind(ctx, slug);
    if (collection.active) await ctx.db.patch(collection._id, { active: false, closedAt: Date.now() });
    await settle(ctx, collection._id);
    return { title: collection.title, wasActive: collection.active };
  }
});

/** Where a collection is in archiving: null once it's been cleared (or never existed). */
export const state = internalQuery({
  args: slugArgs,
  handler: async (ctx, { slug }) => {
    const collection = await find(ctx, slug);
    if (!collection) return null;
    const progress = await ctx.db
      .query('progress')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
      .unique();
    const untallied = progress
      ? (await ctx.db
          .query('votes')
          .withIndex('by_collection', (q) => q.eq('collectionId', collection._id).gt('_creationTime', progress.cursor))
          .first()) !== null
      : (await ctx.db
          .query('votes')
          .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
          .first()) !== null;
    return {
      title: collection.title,
      active: collection.active,
      archivedAt: collection.archivedAt ?? null,
      // Everything the archive is read from is up to date.
      tallied: !untallied && (!progress || (!progress.pending && !progress.clearing && !progress.stale))
    };
  }
});

/** Every head-to-head in a segment, removed posters' too. */
export const matchups = internalQuery({
  args: { slug: v.string(), segment },
  handler: async (ctx, { slug, segment }) => {
    const collection = await mustFind(ctx, slug);
    const rows = await ctx.db
      .query('matchups')
      .withIndex('by_close', (q) => q.eq('collectionId', collection._id).eq('segment', segment))
      .collect();
    return rows.map((m) => ({ aId: m.aId, bId: m.bId, aWins: m.aWins, bWins: m.bWins }));
  }
});

/** Where each poster wins most, best first (as `results.poster` works it out), by poster id. */
export const fans = internalQuery({
  args: { posterIds: v.array(v.id('posters')), segment },
  handler: async (ctx, { posterIds, segment }) => {
    const byPoster: Record<string, Fan[]> = {};
    for (const id of posterIds) {
      const records = await ctx.db
        .query('cityPosters')
        .withIndex('by_poster_wins', (q) => q.eq('posterId', id).eq('segment', segment).gt('wins', 0))
        .order('desc')
        .take(10);
      byPoster[id] = records
        .map((r) => ({ country: r.country, city: r.city, wins: r.wins, losses: r.matches - r.wins }))
        .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
        .slice(0, FANS);
    }
    return byPoster;
  }
});

/** The collection's own details, for the archive. */
export const meta = internalQuery({
  args: slugArgs,
  handler: async (ctx, { slug }) => {
    const c = await mustFind(ctx, slug);
    return { slug: c.slug, title: c.title, openedAt: c.openedAt, closedAt: c.closedAt ?? null };
  }
});

/**
 * Everything the site shows about a collection, as archives/<slug>/results.json keeps it (see
 * src/lib/features/collections/archives.ts): its posters, each segment's snapshot, head-to-heads
 * and fans, the final vote counts, and the admin stats. Head-to-heads refer to posters by their
 * index in `posters`, to keep the file small; everything else by id, as the snapshots do.
 */
export const results = internalAction({
  args: slugArgs,
  handler: async (ctx, { slug }): Promise<Archive> => {
    const collection = await ctx.runQuery(internal.archive.meta, { slug });
    const list = await ctx.runQuery(api.posters.list, { collection: slug });
    const posters = list.posters ?? [];
    const index = new Map<Id<'posters'>, number>(posters.map((p, i) => [p._id, i]));
    const live = await ctx.runQuery(api.results.live, { collection: slug });
    const stats = await ctx.runQuery(api.stats.overview, { collection: slug });

    const snapshots = {} as Archive['snapshots'];
    const matchups = {} as Archive['matchups'];
    const fans = {} as Archive['fans'];
    for (const segment of SEGMENTS) {
      snapshots[segment] = (await ctx.runQuery(api.results.snapshot, { segment, collection: slug }))?.snapshot ?? null;
      matchups[segment] = (await ctx.runQuery(internal.archive.matchups, { slug, segment })).flatMap((m) => {
        const a = index.get(m.aId);
        const b = index.get(m.bId);
        return a === undefined || b === undefined ? [] : [[a, b, m.aWins, m.bWins] as Matchup];
      });
      const byPoster = await ctx.runQuery(internal.archive.fans, { posterIds: posters.map((p) => p._id), segment });
      fans[segment] = posters.map((p) => byPoster[p._id] ?? []);
    }

    return {
      version: 1,
      collection,
      posters,
      removed: list.removed ?? [],
      live: live ?? { all: 0, designers: 0, others: 0 },
      snapshots,
      matchups,
      fans,
      stats: stats && { hours: stats.hours, counts: stats.counts, countries: stats.countries, depth: stats.depth, posters: stats.posters }
    };
  }
});

/**
 * A page of the collection's raw votes, oldest first, and every poster they can name (removed
 * ones too): for the backup in archives/<slug>/votes.json.gz. Pass the last page's `cursor`.
 */
export const votes = internalQuery({
  args: { slug: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { slug, cursor }) => {
    const collection = await mustFind(ctx, slug);
    const page = await ctx.db
      .query('votes')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
      .paginate({ cursor, numItems: VOTES_PAGE });
    const posters =
      cursor === null
        ? (
            await ctx.db
              .query('posters')
              .withIndex('by_collection_key', (q) => q.eq('collectionId', collection._id))
              .collect()
          ).map(({ _id, key, title, image, active }) => ({ _id, key, title, image, active }))
        : null;
    return {
      posters,
      votes: page.page.map((vote) => ({
        at: vote._creationTime,
        winnerId: vote.winnerId,
        loserId: vote.loserId,
        voterId: vote.voterId,
        designer: vote.designer,
        country: vote.country,
        city: vote.city
      })),
      cursor: page.continueCursor,
      done: page.isDone
    };
  }
});

/** Note that a closed collection's archive has been written, so `clear` may delete it. */
export const markArchived = internalMutation({
  args: slugArgs,
  handler: async (ctx, { slug }) => {
    const collection = await mustFind(ctx, slug);
    if (collection.active) throw new ConvexError(`"${slug}" is still live`);
    await ctx.db.patch(collection._id, { archivedAt: Date.now() });
  }
});

/**
 * Delete an archived collection and everything in it: its votes, posters and tallies, then the
 * collection itself. Runs itself a batch at a time until it's gone (`state` is then null). The
 * tally's own rows go first, so no tally run can rebuild anything behind it.
 */
export const clear = internalMutation({
  args: slugArgs,
  handler: async (ctx, { slug }) => {
    const collection = await mustFind(ctx, slug);
    if (collection.active || !collection.archivedAt) {
      throw new ConvexError(`"${slug}" hasn't been archived. Run pnpm collections archive ${slug} first.`);
    }
    const collectionId = collection._id;
    const { db } = ctx;
    let budget = CLEAR_BATCH;
    const tables: (() => Promise<{ _id: Id<TableNames> }[]>)[] = [
      () => db.query('progress').withIndex('by_collection', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('live').withIndex('by_collection', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('snapshots').withIndex('by_segment', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('standings').withIndex('by_collection', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('matchups').withIndex('by_close', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('voters').withIndex('by_collection_voter', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('countries').withIndex('by_code', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('cities').withIndex('by_city', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('cityPosters').withIndex('by_city_poster', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('hours').withIndex('by_hour', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('votes').withIndex('by_collection', (q) => q.eq('collectionId', collectionId)).take(budget),
      () => db.query('posters').withIndex('by_collection_key', (q) => q.eq('collectionId', collectionId)).take(budget)
    ];
    let deleted = 0;
    for (const next of tables) {
      const docs = await next();
      for (const doc of docs) await db.delete(doc._id);
      deleted += docs.length;
      budget -= docs.length;
      if (budget <= 0) {
        await ctx.scheduler.runAfter(0, internal.archive.clear, { slug });
        return { deleted, done: false };
      }
    }
    await db.delete(collectionId);
    return { deleted, done: true };
  }
});

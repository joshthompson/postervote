import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { requestRun, startRebuild } from './tally';

// One-off maintenance, run by hand: npx convex run migrations:<name> '<args>' (add --prod for production).

const BATCH = 1000;

/**
 * Tally every collection from scratch (the rankings keep showing the old snapshot until it's
 * done). `collection` limits it to one slug. Not needed after a normal deploy: the first vote
 * or the hourly check starts the tally of the active collection by itself.
 */
export const rebuild = internalMutation({
  args: { collection: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const collections = await ctx.db.query('collections').collect();
    const chosen = collections.filter((c) => !args.collection || c.slug === args.collection);
    if (!chosen.length) throw new Error(`No collection "${args.collection}"`);
    for (const c of chosen) await startRebuild(ctx, c._id);
    return chosen.map((c) => c.title);
  }
});

/**
 * Remove data from before the tally: scores stored on posters and the old `pairs` table.
 * Runs itself in batches until done. Afterwards those fields and the table can leave the schema.
 */
export const cleanupLegacy = internalMutation({
  args: {},
  handler: async (ctx) => {
    let cleared = 0;
    for (const p of await ctx.db.query('posters').collect()) {
      if (p.rating === undefined && p.wins === undefined && p.losses === undefined) continue;
      await ctx.db.patch(p._id, { rating: undefined, wins: undefined, losses: undefined });
      cleared++;
    }
    const pairs = await ctx.db.query('pairs').take(BATCH);
    for (const pair of pairs) await ctx.db.delete(pair._id);
    if (pairs.length === BATCH) await ctx.scheduler.runAfter(0, internal.migrations.cleanupLegacy, {});
    return { postersCleared: cleared, pairsDeleted: pairs.length, done: pairs.length < BATCH };
  }
});

/** Start the tally for every collection that doesn't have one yet (e.g. archived ones). */
export const tallyAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const started = [];
    for (const c of await ctx.db.query('collections').collect()) {
      const progress = await ctx.db
        .query('progress')
        .withIndex('by_collection', (q) => q.eq('collectionId', c._id))
        .unique();
      if (progress) continue;
      await requestRun(ctx, c._id, { progress, now: true });
      started.push(c.title);
    }
    return started;
  }
});

/**
 * Rebuild every tallied collection's snapshots from its tallies, without recounting: e.g. after
 * changing RATING_SYSTEM. The rankings switch over within a minute or so.
 */
export const refreshSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const refreshed = [];
    for (const c of await ctx.db.query('collections').collect()) {
      const progress = await ctx.db
        .query('progress')
        .withIndex('by_collection', (q) => q.eq('collectionId', c._id))
        .unique();
      if (!progress) continue;
      await requestRun(ctx, c._id, { progress, now: true, stale: true });
      refreshed.push(c.title);
    }
    return refreshed;
  }
});

const MOVE_BATCH = 500;
// The tallies that are counted again from the votes, so the move just deletes them.
const RECOUNTED = ['progress', 'live', 'standings', 'matchups', 'voters', 'countries', 'cities', 'cityPosters', 'hours'] as const;

/**
 * Rename competitions to collections: run once, after deploying the `collections` table. Each
 * step runs the next by itself:
 * - (no step): copy each competition into `collections`, keeping its id as `formerId` so
 *   browsers keep their place in its vote order (see progress.ts).
 * - 'posters', then 'votes': move every row's `competitionId` over to `collectionId`, a batch at
 *   a time. Posters from before competitions join the live collection (as the first sync made
 *   them), and votes from before competitions their winner's collection (as `votes.backfill` did).
 * - 'tallies': delete the tallies, which are counted again, and move the snapshots over, so the
 *   rankings keep showing until the recount is done.
 * - 'finish': delete the competitions and recount every collection from its votes.
 * Voting carries on throughout.
 */
export const collections = internalMutation({
  args: {
    step: v.optional(v.union(v.literal('posters'), v.literal('votes'), v.literal('tallies'), v.literal('finish'))),
    cursor: v.optional(v.union(v.string(), v.null()))
  },
  handler: async (ctx, { step, cursor = null }) => {
    const { db } = ctx;
    const next = (args: { step: 'posters' | 'votes' | 'tallies' | 'finish'; cursor?: string | null }) =>
      ctx.scheduler.runAfter(0, internal.migrations.collections, args);
    const byFormerId = async () =>
      new Map((await db.query('collections').collect()).flatMap((c) => (c.formerId ? [[c.formerId, c._id] as const] : [])));

    if (!step) {
      const copied = [];
      for (const c of await db.query('competitions').collect()) {
        const existing = await db
          .query('collections')
          .withIndex('by_slug', (q) => q.eq('slug', c.slug))
          .unique();
        if (existing) continue;
        const { _id, _creationTime, ...rest } = c;
        await db.insert('collections', { ...rest, openedAt: _creationTime, formerId: _id });
        copied.push(c.title);
      }
      await next({ step: 'posters' });
      return { step: 'collections', copied };
    }

    if (step === 'posters' || step === 'votes') {
      const moved = await byFormerId();
      const live = await db
        .query('collections')
        .withIndex('by_active', (q) => q.eq('active', true))
        .first();
      const page = await db.query(step).paginate({ cursor, numItems: MOVE_BATCH });
      let patched = 0;
      for (const doc of page.page) {
        if (doc.collectionId && !doc.competitionId) continue;
        let collectionId = doc.competitionId && moved.get(doc.competitionId);
        if (!collectionId && !doc.competitionId) {
          if (step === 'posters') collectionId = live?._id;
          else collectionId = (await db.get((doc as Doc<'votes'>).winnerId))?.collectionId;
        }
        if (!collectionId) continue;
        await db.patch(doc._id, { collectionId, competitionId: undefined });
        patched++;
      }
      if (!page.isDone) await next({ step, cursor: page.continueCursor });
      else await next({ step: step === 'posters' ? 'votes' : 'tallies' });
      return { step, patched, done: page.isDone };
    }

    if (step === 'tallies') {
      let budget = MOVE_BATCH;
      for (const table of RECOUNTED) {
        const docs = await db.query(table).take(budget);
        for (const doc of docs) await db.delete(doc._id);
        budget -= docs.length;
        if (budget <= 0) {
          await next({ step: 'tallies' });
          return { step, done: false };
        }
      }
      const moved = await byFormerId();
      for (const snap of await db.query('snapshots').collect()) {
        if (!snap.competitionId) continue;
        const collectionId = moved.get(snap.competitionId);
        const taken =
          collectionId &&
          (await db
            .query('snapshots')
            .withIndex('by_segment', (q) => q.eq('collectionId', collectionId).eq('segment', snap.segment))
            .first());
        // A tally run since the move started may already have built this one.
        if (!collectionId || taken) await db.delete(snap._id);
        else await db.patch(snap._id, { collectionId, competitionId: undefined });
      }
      await next({ step: 'finish' });
      return { step, done: true };
    }

    for (const c of await db.query('competitions').collect()) await db.delete(c._id);
    const recounting = [];
    for (const c of await db.query('collections').collect()) {
      await startRebuild(ctx, c._id);
      recounting.push(c.title);
    }
    return { step, recounting };
  }
});

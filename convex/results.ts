import { query } from './_generated/server';
import { v } from 'convex/values';
import { find } from './collections';
import { segment } from './schema';

// What the rankings page reads. None of these touch the votes themselves: they read the tallies
// and snapshots that tally.ts keeps, so their cost doesn't grow with the number of votes.
// Posters are referred to by id; the page joins titles and images from `posters.list`.

/**
 * A collection (by slug, or the active one) and its latest snapshot for `segment`: null if
 * there's no such collection; `snapshot` is null until its first votes have been tallied.
 * Changes only when a tally run rebuilds it, at most every 15 minutes.
 */
export const snapshot = query({
  args: { segment, collection: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const collection = await find(ctx, args.collection);
    if (!collection) return null;
    const snap = await ctx.db
      .query('snapshots')
      .withIndex('by_segment', (q) => q.eq('collectionId', collection._id).eq('segment', args.segment))
      .unique();
    const { slug, title, active } = collection;
    if (!snap) return { collection: { slug, title, active }, snapshot: null };
    const { _id, _creationTime, collectionId, competitionId, segment: _, ...rest } = snap;
    return { collection: { slug, title, active }, snapshot: rest };
  }
});

/** Votes cast in a collection so far, per segment. Tiny, so the page can tick it live. */
export const live = query({
  args: { collection: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const collection = await find(ctx, args.collection);
    if (!collection) return null;
    const live = await ctx.db
      .query('live')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
      .unique();
    return live ? { all: live.all, designers: live.designers, others: live.others } : { all: 0, designers: 0, others: 0 };
  }
});

/**
 * One poster's detail: its record with designers and with everyone else, where it wins most,
 * and its record against each poster it has met (in `segment`'s votes), most-met first.
 */
export const poster = query({
  args: { id: v.id('posters'), segment },
  handler: async (ctx, { id, segment }) => {
    const standing = await ctx.db
      .query('standings')
      .withIndex('by_poster', (q) => q.eq('posterId', id))
      .unique();
    const asA = await ctx.db
      .query('matchups')
      .withIndex('by_a', (q) => q.eq('segment', segment).eq('aId', id))
      .collect();
    const asB = await ctx.db
      .query('matchups')
      .withIndex('by_b', (q) => q.eq('segment', segment).eq('bId', id))
      .collect();
    const opponents = [
      ...asA.map((m) => ({ _id: m.bId, wins: m.aWins, losses: m.bWins })),
      ...asB.map((m) => ({ _id: m.aId, wins: m.bWins, losses: m.aWins }))
    ].sort((a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - b.losses - (a.wins - a.losses));

    // Where it wins most, best first; places it has only lost in don't count as fans.
    const records = await ctx.db
      .query('cityPosters')
      .withIndex('by_poster_wins', (q) => q.eq('posterId', id).eq('segment', segment).gt('wins', 0))
      .order('desc')
      .take(10);
    const fans = records
      .map((r) => ({ country: r.country, city: r.city, wins: r.wins, losses: r.matches - r.wins }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .slice(0, 3);

    const record = (group: 'designers' | 'others') =>
      standing ? { wins: standing[group].wins, losses: standing[group].losses } : { wins: 0, losses: 0 };
    return { designers: record('designers'), others: record('others'), fans, opponents };
  }
});

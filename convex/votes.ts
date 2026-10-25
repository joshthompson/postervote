import { mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { getActive } from './collections';
import { orderPair } from './shared';
import { getProgress, requestRun } from './tally';

/** How many votes this voter has cast. */
export const count = query({
  args: { voterId: v.string() },
  handler: async (ctx, { voterId }) => {
    const votes = await ctx.db
      .query('votes')
      .withIndex('by_voter', (q) => q.eq('voterId', voterId.slice(0, 64)))
      .collect();
    return votes.length;
  }
});

/**
 * Record a vote and return how everyone has voted on this pair. Scores and the rest of the
 * rankings are tallied from the votes in the background (see tally.ts), so this stays small.
 */
export const cast = mutation({
  args: {
    winnerId: v.id('posters'),
    loserId: v.id('posters'),
    voterId: v.string(),
    designer: v.optional(v.boolean()),
    country: v.optional(v.string()),
    city: v.optional(v.string())
  },
  handler: async (ctx, { winnerId, loserId, voterId, designer, country, city }) => {
    if (winnerId === loserId) throw new ConvexError('A poster cannot beat itself');
    const winner = await ctx.db.get(winnerId);
    const loser = await ctx.db.get(loserId);
    if (!winner || !loser) throw new ConvexError('Poster not found');
    const collection = await getActive(ctx);
    if (
      !collection ||
      winner.collectionId !== collection._id ||
      loser.collectionId !== collection._id ||
      !winner.active ||
      !loser.active
    ) {
      throw new ConvexError('Voting has closed on these posters');
    }

    // This pair's votes so far: what the tally has counted, plus the votes it hasn't reached yet.
    // While a rebuild is clearing the old tally, count them all from the votes instead.
    const progress = await getProgress(ctx, collection._id);
    const counted = progress && !progress.clearing;
    const cursor = counted ? progress.cursor : 0;
    const [aId, bId] = orderPair(winnerId, loserId);
    const tallied = counted
      ? await ctx.db
          .query('matchups')
          .withIndex('by_pair', (q) => q.eq('segment', 'all').eq('aId', aId).eq('bId', bId))
          .unique()
      : null;
    const untallied = (w: typeof winnerId, l: typeof loserId) =>
      ctx.db
        .query('votes')
        .withIndex('by_matchup', (q) => q.eq('winnerId', w).eq('loserId', l).gt('_creationTime', cursor))
        .collect();
    const winnerIsA = winnerId === aId;
    const winnerVotes =
      (tallied ? (winnerIsA ? tallied.aWins : tallied.bWins) : 0) + (await untallied(winnerId, loserId)).length + 1;
    const loserVotes = (tallied ? (winnerIsA ? tallied.bWins : tallied.aWins) : 0) + (await untallied(loserId, winnerId)).length;

    await ctx.db.insert('votes', {
      collectionId: collection._id,
      winnerId,
      loserId,
      voterId: voterId.slice(0, 64),
      designer,
      country: country?.slice(0, 2).toUpperCase() || undefined,
      city: city?.slice(0, 80) || undefined
    });

    // Tick the live counts the rankings page shows between tally runs.
    const live = await ctx.db
      .query('live')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
      .unique();
    const add = { all: 1, designers: designer === true ? 1 : 0, others: designer === false ? 1 : 0 };
    if (live) {
      await ctx.db.patch(live._id, {
        all: live.all + add.all,
        designers: live.designers + add.designers,
        others: live.others + add.others
      });
    } else {
      await ctx.db.insert('live', { collectionId: collection._id, ...add });
    }

    await requestRun(ctx, collection._id, { progress });
    return { winnerVotes, loserVotes };
  }
});

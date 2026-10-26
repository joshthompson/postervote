import { query } from './_generated/server';
import { v } from 'convex/values';
import { find } from './collections';

// What the hidden /admin/stats page reads. Like the rankings, it reads the tallies that tally.ts
// keeps rather than the votes, so it only changes when a tally run does (at most every 15 minutes).
// The biggest read is one row per voter, for how many votes each casts; past VOTER_CAP voters that
// part is left out rather than read.

const VOTER_CAP = 15_000;

/**
 * A collection (by slug, or the active one): its votes per hour and per country, the tally's
 * running counts and state, how many posters are in it, and how many voters cast each number of
 * votes. null if there's no such collection.
 */
export const overview = query({
  args: { collection: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const collection = await find(ctx, args.collection);
    if (!collection) return null;
    const collectionId = collection._id;

    const hours = await ctx.db
      .query('hours')
      .withIndex('by_hour', (q) => q.eq('collectionId', collectionId))
      .collect();
    const progress = await ctx.db
      .query('progress')
      .withIndex('by_collection', (q) => q.eq('collectionId', collectionId))
      .unique();
    const posters = await ctx.db
      .query('posters')
      .withIndex('by_collection_active', (q) => q.eq('collectionId', collectionId).eq('active', true))
      .collect();

    // Located votes per country, by segment: a few rows per country.
    const countryRows = await ctx.db
      .query('countries')
      .withIndex('by_code', (q) => q.eq('collectionId', collectionId))
      .collect();
    const byCode = new Map<string, { code: string; all: number; designers: number; others: number }>();
    for (const row of countryRows) {
      let c = byCode.get(row.code);
      if (!c) byCode.set(row.code, (c = { code: row.code, all: 0, designers: 0, others: 0 }));
      c[row.segment] = row.votes;
    }

    // Voters per number of votes cast, by the group they said they're in (designers if they ever
    // said so, then others, else 'unknown': they voted before we asked).
    const voters = await ctx.db
      .query('voters')
      .withIndex('by_collection_voter', (q) => q.eq('collectionId', collectionId))
      .take(VOTER_CAP + 1);
    let depth: { votes: number; designers: number; others: number; unknown: number }[] | null = null;
    if (voters.length <= VOTER_CAP) {
      const byVotes = new Map<number, { votes: number; designers: number; others: number; unknown: number }>();
      for (const voter of voters) {
        let row = byVotes.get(voter.votes);
        if (!row) byVotes.set(voter.votes, (row = { votes: voter.votes, designers: 0, others: 0, unknown: 0 }));
        row[voter.designers ? 'designers' : voter.others ? 'others' : 'unknown']++;
      }
      depth = [...byVotes.values()].sort((a, b) => a.votes - b.votes);
    }

    const { slug, title, active } = collection;
    return {
      collection: { slug, title, active, draft: !!collection.draft },
      hours: hours.map(({ hour, all, designers, others }) => ({ hour, all, designers, others })),
      counts: progress?.counts ?? null,
      tally: progress
        ? { lastRunAt: progress.lastRunAt, pending: progress.pending, scheduledFor: progress.scheduledFor, clearing: progress.clearing }
        : null,
      posters: posters.length,
      countries: [...byCode.values()].sort((a, b) => b.all - a.all),
      depth
    };
  }
});

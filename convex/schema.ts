import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Whose votes a tally counts: everyone, or only the voters who said they are (or aren't) designers.
export const segment = v.union(v.literal('all'), v.literal('designers'), v.literal('others'));

const score = v.object({ rating: v.number(), wins: v.number(), losses: v.number() });
// Running totals for one segment: votes, distinct voters, poster pairs met, votes with a location,
// and distinct cities.
const segmentCounts = v.object({
  votes: v.number(),
  voters: v.number(),
  pairs: v.number(),
  located: v.number(),
  cities: v.number()
});
// Which collection a row belongs to. Optional only until `migrations.collections` has run, which
// moves every row over from the legacy `competitionId`; make it required when that field goes.
const collectionId = v.optional(v.id('collections'));
const legacyCompetitionId = v.optional(v.id('competitions'));

const duel = v.union(
  v.null(),
  v.object({ aId: v.id('posters'), bId: v.id('posters'), aWins: v.number(), bWins: v.number() })
);

export default defineSchema({
  // One is live (being voted on). Drafts are being put together, seen only in the site's dev mode,
  // until `collections.publish` makes one live. The rest have closed: once a closed one is archived
  // to archives/<slug>/ in the repo, `archive.clear` deletes it and everything in it from here.
  collections: defineTable({
    // Stable key from posters/collection.json, also used in URLs.
    slug: v.string(),
    title: v.string(),
    active: v.boolean(),
    // Not published yet (see `collections.publish`). Missing once it has been.
    draft: v.optional(v.boolean()),
    // When it was published (when a draft was made, until it is; for a migrated competition, when that was made).
    openedAt: v.number(),
    // When its poster list last changed, so pages can keep their copy until it does (see posters.list).
    postersUpdatedAt: v.optional(v.number()),
    // Posters taken out of it. Their pairs keep their places in each visitor's order and are
    // skipped, so taking a poster out doesn't reshuffle anyone's order (see pairing.ts).
    removed: v.optional(v.array(v.id('posters'))),
    // When voting closed, set by publishing another collection or by `archive.close`.
    closedAt: v.optional(v.number()),
    // When its archive was written to the repo; only then can `archive.clear` delete it.
    archivedAt: v.optional(v.number()),
    // Legacy: the id it had as a competition, which browsers key their place in the vote order by
    // (see progress.ts). Set by `migrations.collections`; remove once those places are moved over.
    formerId: v.optional(v.string())
  })
    .index('by_slug', ['slug'])
    .index('by_active', ['active']),

  // Legacy: renamed to `collections` by `migrations.collections`, which empties it. Remove after,
  // with every `competitionId` below.
  competitions: defineTable({
    slug: v.string(),
    title: v.string(),
    active: v.boolean(),
    postersUpdatedAt: v.optional(v.number()),
    removed: v.optional(v.array(v.id('posters')))
  }),

  posters: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    // Stable key (the image filename) so re-syncing updates rather than duplicates.
    key: v.string(),
    title: v.string(),
    // Path relative to the site base (e.g. "posters/<slug>/foo.jpg") or an absolute URL.
    image: v.string(),
    // Whether it's still in the collection; removed posters keep their votes.
    active: v.boolean(),
    // Legacy: scores now live in `standings`. Cleared by `migrations.cleanupLegacy`; remove after.
    rating: v.optional(v.number()),
    wins: v.optional(v.number()),
    losses: v.optional(v.number())
  })
    .index('by_collection_key', ['collectionId', 'key'])
    .index('by_collection_active', ['collectionId', 'active']),

  // The raw record. Everything the results show is tallied from these by `tally.run`.
  votes: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    winnerId: v.id('posters'),
    loserId: v.id('posters'),
    voterId: v.string(),
    // Whether the voter said they're a designer. Missing on votes from before we asked.
    designer: v.optional(v.boolean()),
    // Roughly where the voter was, looked up from their IP in the browser (the IP isn't kept).
    // ISO 3166 two-letter code, e.g. "SE". Missing on older votes or when the lookup failed.
    country: v.optional(v.string()),
    city: v.optional(v.string())
  })
    .index('by_voter', ['voterId'])
    .index('by_collection', ['collectionId'])
    // A pair's votes that the tally hasn't reached yet, for the instant result after voting.
    .index('by_matchup', ['winnerId', 'loserId']),

  // Legacy per-pair tallies, replaced by `matchups`. Emptied by `migrations.cleanupLegacy`; remove after.
  pairs: defineTable({
    aId: v.id('posters'),
    bId: v.id('posters'),
    aWins: v.number(),
    bWins: v.number()
  }).index('by_pair', ['aId', 'bId']),

  // --- Tallies, written only by `tally.run` (except `live`, which `votes.cast` bumps). ---

  // Per collection: how far the tally has got, when it next runs, and its running counts.
  progress: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    // _creationTime of the last vote tallied; 0 before the first.
    cursor: v.number(),
    // A run is scheduled for `scheduledFor`, so casts needn't schedule another.
    pending: v.boolean(),
    scheduledFor: v.number(),
    lastRunAt: v.number(),
    // A rebuild is deleting the old tallies; `cursor` restarts from 0 once it's done.
    clearing: v.boolean(),
    // Rebuild every segment's snapshot on the next run (e.g. posters changed).
    stale: v.boolean(),
    counts: v.object({ all: segmentCounts, designers: segmentCounts, others: segmentCounts }),
    // Each segment's snapshot, so a run can replace it without reading it first.
    snapshots: v.optional(
      v.object({
        all: v.optional(v.id('snapshots')),
        designers: v.optional(v.id('snapshots')),
        others: v.optional(v.id('snapshots'))
      })
    )
  }).index('by_collection', ['collectionId']),

  // Per collection: votes cast, bumped by every cast and corrected by each tally run. Tiny, so
  // the rankings page can tick live without refetching the rankings.
  live: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    all: v.number(),
    designers: v.number(),
    others: v.number()
  }).index('by_collection', ['collectionId']),

  // Per poster: its Elo rating and record with each group of voters.
  standings: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    posterId: v.id('posters'),
    // Mirrors the poster's `active`, so the tally can skip removed posters without reading them.
    active: v.boolean(),
    all: score,
    designers: score,
    others: score
  })
    .index('by_poster', ['posterId'])
    .index('by_collection', ['collectionId']),

  // Per segment and unordered poster pair (aId < bId): how their head-to-heads went.
  // `closeKey` / `lopKey` order contested pairs (2+ votes) for the closest and most lopsided.
  matchups: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    segment,
    aId: v.id('posters'),
    bId: v.id('posters'),
    aWins: v.number(),
    bWins: v.number(),
    contested: v.boolean(),
    // Smallest split first, then most votes: split * 1e6 - total.
    closeKey: v.number(),
    // Largest split first, then most votes (read descending): split * 1e6 + total.
    lopKey: v.number()
  })
    .index('by_pair', ['segment', 'aId', 'bId'])
    .index('by_a', ['segment', 'aId'])
    .index('by_b', ['segment', 'bId'])
    .index('by_close', ['collectionId', 'segment', 'contested', 'closeKey'])
    .index('by_lopsided', ['collectionId', 'segment', 'contested', 'lopKey']),

  // Per collection and voter: how many votes, and whether any came as a designer / non-designer.
  voters: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    voterId: v.string(),
    votes: v.number(),
    designers: v.boolean(),
    others: v.boolean()
  }).index('by_collection_voter', ['collectionId', 'voterId']),

  // Votes per segment and country.
  countries: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    segment,
    code: v.string(),
    votes: v.number()
  }).index('by_code', ['collectionId', 'segment', 'code']),

  // Votes per segment and city, and the city's favourite poster (most wins there, then fewest
  // matches), kept up to date by the tally so snapshots needn't look it up. null: no wins yet;
  // missing: not known (made before favourites were kept), so the next snapshot works it out.
  cities: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    segment,
    country: v.string(),
    city: v.string(),
    votes: v.number(),
    best: v.optional(v.union(v.null(), v.object({ posterId: v.id('posters'), wins: v.number(), matches: v.number() })))
  })
    .index('by_city', ['collectionId', 'segment', 'country', 'city'])
    .index('by_votes', ['collectionId', 'segment', 'votes']),

  // Per segment, city and poster: its record there, for local favourites and biggest fans.
  cityPosters: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    segment,
    country: v.string(),
    city: v.string(),
    posterId: v.id('posters'),
    wins: v.number(),
    matches: v.number()
  })
    .index('by_city_poster', ['collectionId', 'segment', 'country', 'city', 'posterId'])
    .index('by_city_wins', ['collectionId', 'segment', 'country', 'city', 'wins'])
    .index('by_poster_wins', ['posterId', 'segment', 'wins']),

  // Votes per collection and hour (ms since epoch / HOUR_MS), for "votes today".
  hours: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    hour: v.number(),
    all: v.number(),
    designers: v.number(),
    others: v.number()
  }).index('by_hour', ['collectionId', 'hour']),

  // What the rankings page shows for a segment, rebuilt by each tally run that changed it.
  // Posters are referred to by id; the page joins titles and images from `results.posters`.
  snapshots: defineTable({
    collectionId,
    competitionId: legacyCompetitionId,
    segment,
    builtAt: v.number(),
    // Votes tallied into this snapshot.
    votes: v.number(),
    voters: v.number(),
    pairsSeen: v.number(),
    // Votes per hour (see `hours`) over the last 25 hours, so the page can count the votes since
    // midnight where the viewer is. Missing on snapshots built before it was kept.
    recent: v.optional(v.array(v.object({ hour: v.number(), votes: v.number() }))),
    // Legacy: votes in the 24 hours before `builtAt`, replaced by `recent`. Dropped as each
    // snapshot is rebuilt; remove once they all have been.
    lastDay: v.optional(v.number()),
    // Posters with at least one match. Rating rounded; posters missing here are unrated.
    scores: v.array(v.object({ id: v.id('posters'), rating: v.number(), wins: v.number(), losses: v.number() })),
    closest: duel,
    lopsided: duel,
    places: v.object({
      located: v.number(),
      cities: v.number(),
      countries: v.array(v.object({ code: v.string(), votes: v.number() })),
      localPicks: v.array(
        v.object({
          country: v.string(),
          city: v.string(),
          votes: v.number(),
          posterId: v.id('posters'),
          wins: v.number(),
          matches: v.number()
        })
      ),
      localMinVotes: v.number()
    })
  }).index('by_segment', ['collectionId', 'segment'])
});

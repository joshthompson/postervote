import { internalMutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Doc, Id, TableNames } from './_generated/dataModel';
import type { WithOptionalSystemFields, WithoutSystemFields } from 'convex/server';
import { bradleyTerry } from './bradleyTerry';
import { getActive } from './collections';
import {
  HOUR_MS,
  LOCAL_MIN_VOTES,
  RATING_SYSTEM,
  SEGMENTS,
  START_RATING,
  groupOf,
  kFactor,
  orderPair,
  type Segment
} from './shared';

// The tally: everything the rankings show, worked out from the votes in the background.
//
// Casting a vote only records it. A scheduled run of `run` then folds every vote since the last
// run into the tallies (standings, head-to-heads, voters, places, hourly counts) and rebuilds
// the snapshots the rankings page reads; `finish` then corrects the live counts and schedules the
// next run if votes are waiting. Runs happen at most every REFRESH_MS while votes keep coming, so
// the page's reads stay small and don't grow with the number of votes.
//
// Only votes older than SETTLE_MS are tallied: a mutation commits well within that, so no vote
// can still appear behind the cursor once it has moved past.

export const REFRESH_MS = 15 * 60_000;
// After a quiet spell, the first vote is tallied this soon (it must be longer than SETTLE_MS).
// A minute lets one visitor's run of votes be tallied together.
const FIRST_DELAY_MS = 60_000;
const SETTLE_MS = 10_000;
// A run this overdue must have failed; the next cast or the hourly check schedules another.
const STUCK_MS = 10 * 60_000;
// Votes per run; a longer backlog carries on in the next run straight away.
const BATCH = 400;
// Documents deleted per run while clearing for a rebuild.
const CLEAR_BATCH = 1000;
const LOCAL_PICKS = 12;

type Score = { rating: number; wins: number; losses: number };
type Counts = Doc<'progress'>['counts'];

const freshScore = (): Score => ({ rating: START_RATING, wins: 0, losses: 0 });
const emptyCounts = (): Counts => ({
  all: { votes: 0, voters: 0, pairs: 0, located: 0, cities: 0 },
  designers: { votes: 0, voters: 0, pairs: 0, located: 0, cities: 0 },
  others: { votes: 0, voters: 0, pairs: 0, located: 0, cities: 0 }
});
/** The segments a vote counts towards: always 'all', plus the voter's group if they said. */
const segmentsOf = (vote: Doc<'votes'>): Segment[] => {
  const group = groupOf(vote.designer);
  return group ? ['all', group] : ['all'];
};

export const getProgress = (ctx: MutationCtx, collectionId: Id<'collections'>) =>
  ctx.db
    .query('progress')
    .withIndex('by_collection', (q) => q.eq('collectionId', collectionId))
    .unique();

/**
 * Make sure a run is coming. Normally that's REFRESH_MS after the last one (or FIRST_DELAY_MS from
 * now, if later); `now` asks for one straight away and `stale` for every snapshot to be rebuilt.
 * Pass `progress` when it has already been read.
 */
export async function requestRun(
  ctx: MutationCtx,
  collectionId: Id<'collections'>,
  { progress, now: immediately = false, stale = false }: { progress?: Doc<'progress'> | null; now?: boolean; stale?: boolean } = {}
) {
  const now = Date.now();
  const p = progress === undefined ? await getProgress(ctx, collectionId) : progress;
  if (!p) {
    const at = now + (immediately ? 0 : FIRST_DELAY_MS);
    await ctx.db.insert('progress', {
      collectionId,
      cursor: 0,
      pending: true,
      scheduledFor: at,
      lastRunAt: 0,
      clearing: false,
      stale: true,
      counts: emptyCounts()
    });
    await ctx.scheduler.runAt(at, internal.tally.run, { collectionId });
    return;
  }
  if (stale && !p.stale) await ctx.db.patch(p._id, { stale: true });
  if (!immediately && p.pending && p.scheduledFor > now - STUCK_MS) return;
  const at = immediately ? now : Math.max(now + FIRST_DELAY_MS, p.lastRunAt + REFRESH_MS);
  await ctx.db.patch(p._id, { pending: true, scheduledFor: at });
  await ctx.scheduler.runAt(at, internal.tally.run, { collectionId });
}

/** Throw away a collection's tallies and count every vote again, e.g. after merging posters. */
export async function startRebuild(ctx: MutationCtx, collectionId: Id<'collections'>) {
  const p = await getProgress(ctx, collectionId);
  const reset = { cursor: 0, pending: true, scheduledFor: Date.now(), clearing: true, stale: true, counts: emptyCounts() };
  if (p) await ctx.db.patch(p._id, reset);
  else await ctx.db.insert('progress', { collectionId, lastRunAt: 0, ...reset });
  await ctx.scheduler.runAfter(0, internal.tally.run, { collectionId });
}

/**
 * Tally the last votes of a collection whose voting has just closed: one run, once they've
 * settled, reaches them all, as no more can be cast.
 */
export async function settle(ctx: MutationCtx, collectionId: Id<'collections'>) {
  const p = await getProgress(ctx, collectionId);
  if (!p || p.clearing) return;
  const at = Date.now() + SETTLE_MS + 1000;
  await ctx.db.patch(p._id, { pending: true, scheduledFor: at });
  await ctx.scheduler.runAt(at, internal.tally.run, { collectionId });
}

/**
 * Loads documents on first use, keeps changes in memory, and writes each changed one once at the
 * end, so a run touching the same document for many votes reads and writes it only once.
 */
class Rows<T extends TableNames> {
  private rows = new Map<string, { id: Id<T> | null; value: WithoutSystemFields<Doc<T>>; dirty: boolean }>();
  constructor(
    private ctx: MutationCtx,
    private table: T
  ) {}

  /** Seed with documents already read, keyed by `key`. */
  seed(docs: Doc<T>[], key: (doc: Doc<T>) => string) {
    for (const doc of docs) this.rows.set(key(doc), { id: doc._id, value: strip(doc), dirty: false });
  }

  /**
   * The document for `key` (found by `find`, or made by `create`), for changing in place.
   * `isNew` is true only on the call that made it.
   */
  async get(key: string, find: () => Promise<Doc<T> | null>, create: () => WithoutSystemFields<Doc<T>>) {
    let row = this.rows.get(key);
    let isNew = false;
    if (!row) {
      const doc = await find();
      isNew = !doc;
      row = doc ? { id: doc._id, value: strip(doc), dirty: false } : { id: null, value: create(), dirty: true };
      this.rows.set(key, row);
    }
    row.dirty = true;
    return { value: row.value, isNew };
  }

  /** A document already loaded, for changing in place. */
  edit(key: string) {
    const row = this.rows.get(key);
    if (row) row.dirty = true;
    return row?.value;
  }

  values() {
    return [...this.rows.values()].map((r) => r.value);
  }

  async save() {
    for (const row of this.rows.values()) {
      if (!row.dirty) continue;
      // The same type as `value`, which TypeScript can't see through for a generic table.
      if (row.id) await this.ctx.db.replace(row.id, row.value as WithOptionalSystemFields<Doc<T>>);
      else row.id = await this.ctx.db.insert(this.table, row.value);
      row.dirty = false;
    }
  }
}

function strip<T extends TableNames>(doc: Doc<T>): WithoutSystemFields<Doc<T>> {
  const { _id, _creationTime, ...rest } = doc;
  return rest as WithoutSystemFields<Doc<T>>;
}

type Favourite = NonNullable<Doc<'cities'>['best']>;

/**
 * A city's favourite poster from its records: most wins there, then fewest matches. Only posters
 * in `among`, if given. Looks at every poster tied on the most wins, then the next most, and so on.
 */
async function favourite(
  ctx: MutationCtx,
  place: { collectionId: Id<'collections'>; segment: Segment; country: string; city: string },
  among?: Set<Id<'posters'>>
): Promise<Favourite | null> {
  const { collectionId, segment, country, city } = place;
  let below: number | undefined;
  for (;;) {
    const top = await ctx.db
      .query('cityPosters')
      .withIndex('by_city_wins', (q) => {
        const withWins = q
          .eq('collectionId', collectionId)
          .eq('segment', segment)
          .eq('country', country)
          .eq('city', city)
          .gt('wins', 0);
        return below === undefined ? withWins : withWins.lt('wins', below);
      })
      .order('desc')
      .first();
    if (!top) return null;
    const tied = await ctx.db
      .query('cityPosters')
      .withIndex('by_city_wins', (q) =>
        q.eq('collectionId', collectionId).eq('segment', segment).eq('country', country).eq('city', city).eq('wins', top.wins)
      )
      .collect();
    const best = tied.filter((r) => !among || among.has(r.posterId)).sort((a, b) => a.matches - b.matches)[0];
    if (best) return { posterId: best.posterId, wins: best.wins, matches: best.matches };
    below = top.wins;
  }
}

/** The tallies one run works on, with `add` folding in one vote. */
class Tally {
  standings: Rows<'standings'>;
  matchups: Rows<'matchups'>;
  voters: Rows<'voters'>;
  countries: Rows<'countries'>;
  cities: Rows<'cities'>;
  cityPosters: Rows<'cityPosters'>;
  hours: Rows<'hours'>;
  /** Segments whose snapshot needs rebuilding. */
  changed = new Set<Segment>();
  /** Cities whose favourite must be worked out again from their records, once they're saved. */
  private recheck = new Set<string>();

  constructor(
    private ctx: MutationCtx,
    private collectionId: Id<'collections'>,
    public counts: Counts
  ) {
    this.standings = new Rows(ctx, 'standings');
    this.matchups = new Rows(ctx, 'matchups');
    this.voters = new Rows(ctx, 'voters');
    this.countries = new Rows(ctx, 'countries');
    this.cities = new Rows(ctx, 'cities');
    this.cityPosters = new Rows(ctx, 'cityPosters');
    this.hours = new Rows(ctx, 'hours');
  }

  /** Every standing is needed for the snapshots anyway, so read them all in one go. */
  async load() {
    const all = await this.ctx.db
      .query('standings')
      .withIndex('by_collection', (q) => q.eq('collectionId', this.collectionId))
      .collect();
    this.standings.seed(all, (s) => s.posterId);
  }

  private standing(posterId: Id<'posters'>) {
    const collectionId = this.collectionId;
    return this.standings.get(
      posterId,
      async () => null,
      () => ({ collectionId, posterId, active: true, all: freshScore(), designers: freshScore(), others: freshScore() })
    );
  }

  async add(vote: Doc<'votes'>) {
    const { db } = this.ctx;
    const collectionId = this.collectionId;
    const segments = segmentsOf(vote);
    const winner = (await this.standing(vote.winnerId)).value;
    const loser = (await this.standing(vote.loserId)).value;
    const [aId, bId] = orderPair(vote.winnerId, vote.loserId);

    for (const segment of segments) {
      this.changed.add(segment);
      const counts = this.counts[segment];
      counts.votes++;

      // Elo, the same update chess uses: beating a stronger poster moves more points, and votes
      // move a poster less once it has played many matches (see kFactor). Kept up to date whatever
      // RATING_SYSTEM says, so switching back to it needs no recount.
      const w = winner[segment];
      const l = loser[segment];
      const k = kFactor(w.wins + w.losses, l.wins + l.losses);
      const delta = k * (1 - 1 / (1 + 10 ** ((l.rating - w.rating) / 400)));
      w.rating += delta;
      w.wins++;
      l.rating -= delta;
      l.losses++;

      const m = await this.matchups.get(
        `${segment}|${aId}|${bId}`,
        () =>
          db
            .query('matchups')
            .withIndex('by_pair', (q) => q.eq('segment', segment).eq('aId', aId).eq('bId', bId))
            .unique(),
        () => ({ collectionId, segment, aId, bId, aWins: 0, bWins: 0, contested: false, closeKey: 0, lopKey: 0 })
      );
      if (m.isNew) counts.pairs++;
      if (vote.winnerId === aId) m.value.aWins++;
      else m.value.bWins++;
      const total = m.value.aWins + m.value.bWins;
      const split = Math.abs(m.value.aWins - m.value.bWins) / total;
      Object.assign(m.value, { contested: total >= 2, closeKey: split * 1e6 - total, lopKey: split * 1e6 + total });

      if (vote.country) await this.place(vote, segment);
    }

    const voter = await this.voters.get(
      vote.voterId,
      () =>
        db
          .query('voters')
          .withIndex('by_collection_voter', (q) => q.eq('collectionId', collectionId).eq('voterId', vote.voterId))
          .unique(),
      () => ({ collectionId, voterId: vote.voterId, votes: 0, designers: false, others: false })
    );
    if (voter.isNew) this.counts.all.voters++;
    voter.value.votes++;
    const group = groupOf(vote.designer);
    if (group && !voter.value[group]) {
      voter.value[group] = true;
      this.counts[group].voters++;
    }

    const hour = Math.floor(vote._creationTime / HOUR_MS);
    const h = await this.hours.get(
      String(hour),
      () =>
        db
          .query('hours')
          .withIndex('by_hour', (q) => q.eq('collectionId', collectionId).eq('hour', hour))
          .unique(),
      () => ({ collectionId, hour, all: 0, designers: 0, others: 0 })
    );
    for (const segment of segments) h.value[segment]++;
  }

  /** Count a located vote towards its country, its city, and both posters' records there. */
  private async place(vote: Doc<'votes'>, segment: Segment) {
    const { db } = this.ctx;
    const collectionId = this.collectionId;
    const code = vote.country!;
    const counts = this.counts[segment];
    counts.located++;

    const country = await this.countries.get(
      `${segment}|${code}`,
      () =>
        db
          .query('countries')
          .withIndex('by_code', (q) => q.eq('collectionId', collectionId).eq('segment', segment).eq('code', code))
          .unique(),
      () => ({ collectionId, segment, code, votes: 0 })
    );
    country.value.votes++;

    const city = vote.city;
    if (!city) return;
    const cityKey = `${segment}|${code}|${city}`;
    const c = await this.cities.get(
      cityKey,
      () =>
        db
          .query('cities')
          .withIndex('by_city', (q) =>
            q.eq('collectionId', collectionId).eq('segment', segment).eq('country', code).eq('city', city)
          )
          .unique(),
      () => ({ collectionId, segment, country: code, city, votes: 0, best: null })
    );
    if (c.isNew) counts.cities++;
    c.value.votes++;

    for (const [posterId, won] of [
      [vote.winnerId, true],
      [vote.loserId, false]
    ] as const) {
      const r = await this.cityPosters.get(
        `${segment}|${code}|${city}|${posterId}`,
        () =>
          db
            .query('cityPosters')
            .withIndex('by_city_poster', (q) =>
              q
                .eq('collectionId', collectionId)
                .eq('segment', segment)
                .eq('country', code)
                .eq('city', city)
                .eq('posterId', posterId)
            )
            .unique(),
        () => ({ collectionId, segment, country: code, city, posterId, wins: 0, matches: 0 })
      );
      r.value.matches++;
      if (won) r.value.wins++;
      this.consider(cityKey, c.value, posterId, r.value, won);
    }
  }

  /** Keep a city's favourite up to date after `posterId`'s record there changed. */
  private consider(
    key: string,
    city: WithoutSystemFields<Doc<'cities'>>,
    posterId: Id<'posters'>,
    record: { wins: number; matches: number },
    won: boolean
  ) {
    const best = city.best;
    if (best === undefined) {
      // Not known yet (a city from before favourites were kept).
      this.recheck.add(key);
    } else if (best?.posterId === posterId) {
      city.best = { posterId, wins: record.wins, matches: record.matches };
      // It lost here: a poster with as many wins and fewer matches may now lead.
      if (!won) this.recheck.add(key);
    } else if (won && (!best || record.wins > best.wins || (record.wins === best.wins && record.matches < best.matches))) {
      city.best = { posterId, wins: record.wins, matches: record.matches };
    }
  }

  /** Work out the favourites that incremental updates couldn't, from the saved records. */
  async recheckFavourites() {
    for (const key of this.recheck) {
      const city = this.cities.edit(key)!;
      city.best = await favourite(this.ctx, { ...city, collectionId: this.collectionId });
    }
    if (this.recheck.size) await this.cities.save();
  }

  /**
   * Votes per hour, per segment, from the hour 24 hours back to now: enough to cover the viewer's
   * midnight wherever they are, and for as long as the snapshot stays current.
   */
  async recent(now: number) {
    const nowHour = Math.floor(now / HOUR_MS);
    const hours = await this.ctx.db
      .query('hours')
      .withIndex('by_hour', (q) => q.eq('collectionId', this.collectionId).gte('hour', nowHour - 24))
      .collect();
    const recent: Record<Segment, { hour: number; votes: number }[]> = { all: [], designers: [], others: [] };
    for (const h of hours) {
      for (const segment of SEGMENTS) if (h[segment]) recent[segment].push({ hour: h.hour, votes: h[segment] });
    }
    return recent;
  }

  async save() {
    for (const rows of [this.standings, this.matchups, this.voters, this.countries, this.cities, this.cityPosters, this.hours]) {
      await rows.save();
    }
  }

  /**
   * Rebuild the snapshot the rankings page reads for `segment`, from the saved tallies; `id` is
   * the existing one, if known. Returns its id.
   */
  async snapshot(
    segment: Segment,
    now: number,
    recent: { hour: number; votes: number }[],
    id: Id<'snapshots'> | undefined
  ) {
    const { db } = this.ctx;
    const collectionId = this.collectionId;
    const standings = this.standings.values();
    const active = new Set(standings.filter((s) => s.active).map((s) => s.posterId));
    const counts = this.counts[segment];

    // Bradley-Terry is fitted afresh from every head-to-head, removed posters' included, as their
    // votes still say something about the posters they met.
    const fitted =
      RATING_SYSTEM === 'bradley_terry'
        ? bradleyTerry(
            await db
              .query('matchups')
              .withIndex('by_close', (q) => q.eq('collectionId', collectionId).eq('segment', segment))
              .collect()
          )
        : null;
    const scores = standings
      .filter((s) => s.active && s[segment].wins + s[segment].losses > 0)
      .map((s) => ({
        id: s.posterId,
        rating: Math.round(fitted ? (fitted.get(s.posterId) ?? START_RATING) : s[segment].rating),
        wins: s[segment].wins,
        losses: s[segment].losses
      }));

    // The first contested pair of current posters, from each end of the ordering. A few candidates
    // cover pairs with a poster since removed.
    const duel = async (index: 'by_close' | 'by_lopsided', order: 'asc' | 'desc') => {
      const candidates = await db
        .query('matchups')
        .withIndex(index, (q) => q.eq('collectionId', collectionId).eq('segment', segment).eq('contested', true))
        .order(order)
        .take(3);
      const m = candidates.find((c) => active.has(c.aId) && active.has(c.bId));
      return m ? { aId: m.aId, bId: m.bId, aWins: m.aWins, bWins: m.bWins } : null;
    };

    const countries = (
      await db
        .query('countries')
        .withIndex('by_code', (q) => q.eq('collectionId', collectionId).eq('segment', segment))
        .collect()
    )
      .map(({ code, votes }) => ({ code, votes }))
      .sort((a, b) => b.votes - a.votes);

    // Each busy city's favourite, as the tally keeps it. Worked out here only if it isn't known
    // yet, or has since been removed from the collection.
    const busiest = await db
      .query('cities')
      .withIndex('by_votes', (q) => q.eq('collectionId', collectionId).eq('segment', segment).gte('votes', LOCAL_MIN_VOTES))
      .order('desc')
      .take(LOCAL_PICKS);
    const localPicks = [];
    for (const c of busiest) {
      let best = c.best;
      const place = { ...c, collectionId };
      if (best === undefined) {
        best = await favourite(this.ctx, place);
        await db.patch(c._id, { best });
      }
      if (best && !active.has(best.posterId)) best = await favourite(this.ctx, place, active);
      if (best) {
        localPicks.push({
          country: c.country,
          city: c.city,
          votes: c.votes,
          posterId: best.posterId,
          wins: best.wins,
          matches: best.matches
        });
      }
    }

    const snapshot = {
      collectionId,
      segment,
      builtAt: now,
      votes: counts.votes,
      voters: counts.voters,
      pairsSeen: counts.pairs,
      recent,
      scores,
      closest: await duel('by_close', 'asc'),
      lopsided: await duel('by_lopsided', 'desc'),
      places: { located: counts.located, cities: counts.cities, countries, localPicks, localMinVotes: LOCAL_MIN_VOTES }
    };
    if (id) {
      await db.replace(id, snapshot);
      return id;
    }
    const existing = await db
      .query('snapshots')
      .withIndex('by_segment', (q) => q.eq('collectionId', collectionId).eq('segment', segment))
      .unique();
    if (!existing) return await db.insert('snapshots', snapshot);
    await db.replace(existing._id, snapshot);
    return existing._id;
  }
}

/** Delete up to CLEAR_BATCH of a collection's tallies; true once none are left. */
async function clearBatch(ctx: MutationCtx, collectionId: Id<'collections'>) {
  const { db } = ctx;
  let budget = CLEAR_BATCH;
  const batches = [
    () => db.query('matchups').withIndex('by_close', (q) => q.eq('collectionId', collectionId)).take(budget),
    () => db.query('voters').withIndex('by_collection_voter', (q) => q.eq('collectionId', collectionId)).take(budget),
    () => db.query('countries').withIndex('by_code', (q) => q.eq('collectionId', collectionId)).take(budget),
    () => db.query('cities').withIndex('by_city', (q) => q.eq('collectionId', collectionId)).take(budget),
    () => db.query('cityPosters').withIndex('by_city_poster', (q) => q.eq('collectionId', collectionId)).take(budget),
    () => db.query('hours').withIndex('by_hour', (q) => q.eq('collectionId', collectionId)).take(budget)
  ];
  for (const next of batches) {
    const docs = await next();
    for (const doc of docs) await db.delete(doc._id);
    budget -= docs.length;
    if (budget <= 0) return false;
  }
  // Standings are reset rather than deleted, so they keep whether their poster is active.
  for (const s of await db
    .query('standings')
    .withIndex('by_collection', (q) => q.eq('collectionId', collectionId))
    .collect()) {
    await db.patch(s._id, { all: freshScore(), designers: freshScore(), others: freshScore() });
  }
  return true;
}

/** Fold the votes since the last run into the tallies and rebuild the snapshots they changed. */
export const run = internalMutation({
  args: { collectionId: v.id('collections') },
  handler: async (ctx, { collectionId }) => {
    const progress = await getProgress(ctx, collectionId);
    if (!progress) return;
    const now = Date.now();

    if (progress.clearing) {
      const done = await clearBatch(ctx, collectionId);
      await ctx.db.patch(progress._id, { clearing: !done, pending: true, scheduledFor: now, lastRunAt: now });
      await ctx.scheduler.runAfter(0, internal.tally.run, { collectionId });
      return;
    }

    const bound = now - SETTLE_MS;
    const votes = await ctx.db
      .query('votes')
      .withIndex('by_collection', (q) =>
        q.eq('collectionId', collectionId).gt('_creationTime', progress.cursor).lt('_creationTime', bound)
      )
      .take(BATCH);

    const tally = new Tally(ctx, collectionId, progress.counts);
    await tally.load();
    for (const vote of votes) await tally.add(vote);
    await tally.save();
    await tally.recheckFavourites();

    const cursor = votes.length ? votes[votes.length - 1]._creationTime : progress.cursor;
    if (votes.length === BATCH) {
      // A backlog: carry on straight away. Snapshots wait until it's done, so the page never
      // shows a half-counted tally.
      await ctx.db.patch(progress._id, { cursor, counts: tally.counts, lastRunAt: now, scheduledFor: now, stale: true });
      await ctx.scheduler.runAfter(0, internal.tally.run, { collectionId });
      return;
    }

    const recent = await tally.recent(now);
    const snapshots = { ...progress.snapshots };
    for (const segment of SEGMENTS) {
      if (progress.stale || tally.changed.has(segment)) {
        snapshots[segment] = await tally.snapshot(segment, now, recent[segment], snapshots[segment]);
      }
    }
    await ctx.db.patch(progress._id, { cursor, counts: tally.counts, lastRunAt: now, stale: false, snapshots });
    // What comes next depends on votes cast during this run, which this run deliberately doesn't
    // read (they'd make it retry); a short follow-up does.
    await ctx.scheduler.runAfter(0, internal.tally.finish, { collectionId });
  }
});

/**
 * After a run: correct the live counts, and schedule the next run if votes are waiting (else
 * mark none pending, so the next cast schedules one).
 */
export const finish = internalMutation({
  args: { collectionId: v.id('collections') },
  handler: async (ctx, { collectionId }) => {
    const progress = await getProgress(ctx, collectionId);
    if (!progress || progress.clearing) return;
    const waiting = await ctx.db
      .query('votes')
      .withIndex('by_collection', (q) => q.eq('collectionId', collectionId).gt('_creationTime', progress.cursor))
      .collect();

    // The live counts are exactly the tally plus the votes it hasn't reached.
    const counts = progress.counts;
    const live = { all: counts.all.votes, designers: counts.designers.votes, others: counts.others.votes };
    for (const vote of waiting) for (const segment of segmentsOf(vote)) live[segment]++;
    const liveDoc = await ctx.db
      .query('live')
      .withIndex('by_collection', (q) => q.eq('collectionId', collectionId))
      .unique();
    if (!liveDoc) await ctx.db.insert('live', { collectionId, ...live });
    else if (liveDoc.all !== live.all || liveDoc.designers !== live.designers || liveDoc.others !== live.others) {
      await ctx.db.patch(liveDoc._id, live);
    }

    if (waiting.length) {
      const at = Math.max(Date.now() + FIRST_DELAY_MS, progress.lastRunAt + REFRESH_MS);
      await ctx.db.patch(progress._id, { pending: true, scheduledFor: at });
      await ctx.scheduler.runAt(at, internal.tally.run, { collectionId });
    } else {
      await ctx.db.patch(progress._id, { pending: false });
    }
  }
});

/**
 * Hourly safety net (see crons.ts): starts the tally for the active collection if it has none yet,
 * and schedules a run if votes are waiting with none coming (e.g. a run failed).
 */
export const ensure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const collection = await getActive(ctx);
    if (!collection) return;
    const progress = await getProgress(ctx, collection._id);
    if (!progress) return await requestRun(ctx, collection._id, { progress, now: true });
    const stuck = progress.pending && progress.scheduledFor < Date.now() - STUCK_MS;
    const waiting =
      !progress.pending &&
      (progress.stale ||
        (await ctx.db
          .query('votes')
          .withIndex('by_collection', (q) => q.eq('collectionId', collection._id).gt('_creationTime', progress.cursor))
          .first()) !== null);
    if (stuck || waiting) await requestRun(ctx, collection._id, { progress, now: true });
  }
});

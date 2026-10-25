// Plain constants and helpers used by both the Convex functions and the site (via `$shared`).
// Keep this file free of server-only imports so the browser bundle can include it.

import type { Id } from './_generated/dataModel';

/** Whose votes a tally counts. Votes from before we asked about designers only count towards 'all'. */
export type Segment = 'all' | 'designers' | 'others';
export const SEGMENTS: Segment[] = ['all', 'designers', 'others'];

/**
 * How the rankings rate posters. Change it, deploy, then run `migrations:refreshSnapshots` to
 * re-rate the current rankings (no recount needed: the tally keeps what both systems need).
 * - 'bradley_terry': fitted to every vote so far at once (see bradleyTerry.ts); vote order doesn't matter.
 * - 'elo': updated one vote at a time, as chess does (see kFactor).
 */
export type RatingSystem = 'bradley_terry' | 'elo';
export const RATING_SYSTEM: RatingSystem = 'bradley_terry';

/** Every poster starts here. */
export const START_RATING = 1000;

/**
 * The Elo K-factor: how far one vote moves a rating. It starts at K_MAX, so a new poster finds its
 * level quickly, and falls to K_MIN over its first K_SETTLE_MATCHES, so established ratings stop
 * bouncing on every vote (posters, unlike chess players, don't get better or worse).
 */
const K_MAX = 32;
const K_MIN = 8;
const K_SETTLE_MATCHES = 100;
const kFor = (matches: number) => Math.max(K_MIN, K_MAX - ((K_MAX - K_MIN) * matches) / K_SETTLE_MATCHES);

/**
 * The K-factor for a vote between posters with these many matches so far. Both share it (the mean
 * of their own), so the points the winner gains are the points the loser drops and the average
 * rating stays at START_RATING.
 */
export const kFactor = (winnerMatches: number, loserMatches: number) => (kFor(winnerMatches) + kFor(loserMatches)) / 2;

/** A city needs this many votes before it gets a local favourite. */
export const LOCAL_MIN_VOTES = 5;

/** Votes are counted per hour: ms since epoch / HOUR_MS. */
export const HOUR_MS = 3_600_000;

/** The two posters in id order, so a pair has one key whichever way round it was voted. */
export function orderPair(x: Id<'posters'>, y: Id<'posters'>) {
  return x < y ? ([x, y] as const) : ([y, x] as const);
}

/** The group a vote counts towards besides 'all', from what the voter said; null if they weren't asked. */
export function groupOf(designer: boolean | undefined): Exclude<Segment, 'all'> | null {
  return designer === true ? 'designers' : designer === false ? 'others' : null;
}

/** An archived collection, as archives/<slug>/results.json keeps it (see archive.ts). */
export type { Archive } from './archive';

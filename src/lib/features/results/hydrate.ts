import type { FunctionReturnType } from 'convex/server';
import type { api } from '$convex/api';
import { HOUR_MS, START_RATING } from '$shared';
import type { PosterInfo } from '$lib/services/posters.svelte';

export type { PosterInfo };

// The server sends compact snapshots that refer to posters by id; these join in each poster's
// title and image (from `posters.list`, fetched once) and work out ranks and rates, giving the
// components their data in one shape.

export type Snapshot = NonNullable<NonNullable<FunctionReturnType<typeof api.results.snapshot>>['snapshot']>;
type Scores = Snapshot['scores'];
type Detail = FunctionReturnType<typeof api.results.poster>;

/** Each poster needs this many designer and non-designer matches to be compared. */
export const MIN_MATCHES = 3;

/** Every current poster by rating, best first; posters without a match yet sit on the start rating. */
export function rank(posters: PosterInfo[], scores: Scores) {
  const byId = new Map(scores.map((s) => [s.id, s]));
  return posters
    .map((p) => {
      const s = byId.get(p._id) ?? { rating: START_RATING, wins: 0, losses: 0 };
      const matches = s.wins + s.losses;
      return {
        _id: p._id,
        title: p.title,
        image: p.image,
        rating: s.rating,
        wins: s.wins,
        losses: s.losses,
        matches,
        winRate: matches ? s.wins / matches : 0
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/** Everything a segment's rankings view shows. `live` ticks the vote counts between snapshots. */
export function overview(posters: PosterInfo[], snap: Snapshot | null, live: number | undefined) {
  const byId = new Map(posters.map((p) => [p._id, p]));
  const tallied = snap?.votes ?? 0;
  const votes = Math.max(tallied, live ?? 0);

  const duel = (d: Snapshot['closest']) => {
    const a = d && byId.get(d.aId);
    const b = d && byId.get(d.bId);
    if (!d || !a || !b) return null;
    const total = d.aWins + d.bWins;
    return {
      a: { ...a, votes: d.aWins },
      b: { ...b, votes: d.bWins },
      total,
      split: total ? Math.abs(d.aWins - d.bWins) / total : 0
    };
  };

  // Hours from the viewer's midnight on (with a half-hour time zone, the hour it falls in counts
  // too). Votes since the snapshot are all from today.
  const fromHour = Math.floor(new Date().setHours(0, 0, 0, 0) / HOUR_MS);
  const today = (snap?.recent ?? []).reduce((sum, h) => (h.hour >= fromHour ? sum + h.votes : sum), 0) + votes - tallied;

  const places = snap?.places;
  return {
    posters: rank(posters, snap?.scores ?? []),
    stats: {
      totalVotes: votes,
      voters: snap?.voters ?? 0,
      today,
      posterCount: posters.length,
      pairsSeen: snap?.pairsSeen ?? 0,
      possiblePairs: (posters.length * (posters.length - 1)) / 2
    },
    closest: duel(snap?.closest ?? null),
    lopsided: duel(snap?.lopsided ?? null),
    places: {
      located: places?.located ?? 0,
      cities: places?.cities ?? 0,
      countries: places?.countries ?? [],
      localMinVotes: places?.localMinVotes ?? 0,
      localPicks: (places?.localPicks ?? []).flatMap((pick) => {
        const poster = byId.get(pick.posterId);
        return poster ? [{ ...pick, poster }] : [];
      })
    }
  };
}

/** Posters designers and everyone else rate most differently, by the gap between their win rates. */
export function disagreements(posters: PosterInfo[], designers: Snapshot | null, others: Snapshot | null) {
  const d = new Map(rank(posters, designers?.scores ?? []).map((p) => [p._id, p]));
  const o = new Map(rank(posters, others?.scores ?? []).map((p) => [p._id, p]));
  const gaps = posters
    .map((p) => {
      const dp = d.get(p._id)!;
      const op = o.get(p._id)!;
      return {
        _id: p._id,
        title: p.title,
        image: p.image,
        designers: { rank: dp.rank, winRate: dp.winRate, matches: dp.matches, rating: dp.rating },
        others: { rank: op.rank, winRate: op.winRate, matches: op.matches, rating: op.rating },
        // Positive: designers like it more.
        gap: dp.winRate - op.winRate
      };
    })
    .filter((p) => p.designers.matches >= MIN_MATCHES && p.others.matches >= MIN_MATCHES)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  return {
    posters: gaps,
    designerVotes: designers?.votes ?? 0,
    otherVotes: others?.votes ?? 0,
    minMatches: MIN_MATCHES
  };
}

/** A poster's detail with its opponents' titles and images, dropping any no longer in the competition. */
export function detail(data: Detail, byId: Map<PosterInfo['_id'], PosterInfo>) {
  return {
    ...data,
    opponents: data.opponents.flatMap((o) => {
      const p = byId.get(o._id);
      return p ? [{ ...o, title: p.title, image: p.image }] : [];
    })
  };
}

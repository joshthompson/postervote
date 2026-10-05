import type { Id } from '$convex/dataModel';

export type Poster = { _id: Id<'posters'>; title: string; image: string };

/**
 * Where a round is up to: `enter` (flying in), `choose` (waiting for a vote), `reveal` (showing
 * the crowd's split), `exit` (flying out). `loading` comes before the first pair, `done` after the last,
 * and `seenAll` after the pair that showed them the last of the posters they hadn't seen.
 */
export type Phase = 'loading' | 'enter' | 'choose' | 'reveal' | 'exit' | 'seenAll' | 'done';

/**
 * The votes on this pair, by screen position: each side's share as shown (rounded to a whole
 * percent), each side's count, and the two added up.
 */
export type VoteResult = { pct: [number, number]; votes: [number, number]; total: number };

/** A vote cast this visit, as its reveal showed it, to look back on. */
export type PastVote = { pair: Poster[]; chosen: number; result: VoteResult; streak: number; round: number };

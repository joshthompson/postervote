import { posterSrc, preload } from '$lib/utils/images';
import { pairOrder } from './pairing';
import { createProgress } from './progress';
import type { PastVote, Phase, Poster, VoteResult } from './types';

// One visitor's run through the pairs: which pair is up, and the enter → choose → reveal → exit
// cycle around each vote. Knows nothing about Convex; the page passes in its data and a way to vote.

/**
 * How long a new pair takes before it can be voted on: until both cards have flown in to full
 * size (see PosterCard's fly-in), though they're still settling. Any longer and taps on posters
 * that look ready are lost.
 */
const ENTER_MS = 400;
/** How long the revealed votes stay on screen before the next pair, unless paused. */
export const REVEAL_MS = 3000;
const EXIT_MS = 700;
/**
 * How long a vote waits for Convex before it's shown as failed. Convex holds a mutation until its
 * WebSocket is connected, so without this a dropped connection (common in in-app browsers) leaves
 * the pick highlighted with no result, forever.
 */
const CAST_TIMEOUT_MS = 8000;

type Source = {
  /** The competition's posters (reactive). */
  posters: () => Poster[];
  /** Ids of posters taken out of it, whose pairs are skipped (reactive). */
  removed: () => string[];
  /** The collection (competition) they belong to (reactive): undefined until known, null if none. */
  collection: () => string | null | undefined;
  /** Record a vote; resolves to both posters' vote counts on this pair. */
  cast: (winner: Poster, loser: Poster) => Promise<{ winnerVotes: number; loserVotes: number }>;
};

/**
 * A pair to show, where it is in the visitor's order for its collection, how many posters they've
 * been shown before it, and how many of its two are new to them.
 */
type Next = { pair: Poster[]; collection: string; at: number; seen: number; fresh: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Timeout extends Error {}
const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Timeout()), ms));

export class VoteSession {
  pair = $state<Poster[] | null>(null);
  phase = $state<Phase>('loading');
  chosen = $state<number | null>(null);
  result = $state<VoteResult | null>(null);
  /** Why the last vote didn't go through: it errored, or Convex didn't answer in time. */
  error = $state<'failed' | 'timeout' | null>(null);
  /** Goes up with every new pair, so the page can replay its entrance animations. */
  round = $state(0);
  /** Votes in a row that went with the crowd. */
  streak = $state(0);
  /**
   * How many of the posters they've been shown (counting this pair once it's voted on or skipped),
   * out of how many there are. Null once they'd been shown them all before this pair.
   */
  progress = $state<{ seen: number; total: number } | null>(null);
  /**
   * Whether they've stopped the reveal moving on by itself, so it waits for them. Lasts the visit,
   * across pairs, until they resume.
   */
  paused = $state(false);
  /** The votes that went through this visit, oldest first. */
  history = $state.raw<PastVote[]>([]);
  /**
   * Which of `history` they're looking back at, or null while on the current pair. They can look
   * back from a reveal or while choosing. Old votes can't be changed, the current pair can't be
   * voted on until they're back, and a reveal doesn't move on by itself while they look.
   */
  viewing = $state<number | null>(null);

  #source: Source;
  #progress = createProgress();
  #shown: Next | null = null;
  #revealTimer: ReturnType<typeof setTimeout> | undefined;
  /** How much of REVEAL_MS the reveal has left, as of `#since`. It doesn't count down while paused. */
  #left = REVEAL_MS;
  #since = 0;
  #showing = false;

  constructor(source: Source) {
    this.#source = source;
  }

  get canVote() {
    return this.phase === 'choose' && !!this.pair && this.viewing === null;
  }

  /** Whether the reveal is on screen with something to show, so it can be dismissed. */
  get revealed() {
    return this.phase === 'reveal' && (!!this.result || this.error);
  }

  /** Whether there's a vote to look back at, from a reveal or while choosing. */
  get canLookBack() {
    return (this.revealed || this.phase === 'choose') && this.viewing === null && this.history.length > 0;
  }

  /** The vote they're looking back at, if they are. */
  get viewed() {
    return this.viewing === null ? null : this.history[this.viewing];
  }

  /** Look back at their votes, from the newest. Stops a reveal moving on. */
  lookBack() {
    if (!this.canLookBack) return;
    this.#stopTimer();
    this.viewing = this.history.length - 1;
  }

  /**
   * Stop looking back: from a reveal, on to the next new pair (that vote is done with), or while
   * choosing, back to the pair they were choosing between.
   */
  stopLookingBack() {
    if (this.viewing === null) return;
    if (this.phase === 'reveal') this.advance();
    else this.viewing = null;
  }

  /** Step through the votes they're looking back at: -1 for the one before, 1 for the one after. */
  step(by: -1 | 1) {
    if (this.viewing === null) return;
    const to = this.viewing + by;
    if (to >= 0 && to < this.history.length) this.viewing = to;
  }

  /** Every pair of the current posters, for the "you've been through them all" message. */
  get totalPairs() {
    const n = this.#source.posters().length;
    return (n * (n - 1)) / 2;
  }

  /** Show the first pair once there are posters; also picks up again from `done` when new ones arrive. */
  refresh() {
    if (this.pair || this.#showing || this.#source.posters().length < 2 || !this.#source.collection()) return;
    if (this.phase === 'loading') this.#show(this.#next());
    else if (this.phase === 'done') {
      const next = this.#next();
      if (next) this.#show(next);
    }
  }

  async vote(i: number) {
    if (!this.canVote) return;
    const pair = this.pair!;
    const [winner, loser] = [pair[i], pair[1 - i]];
    this.chosen = i;
    this.phase = 'reveal';
    this.#count();

    try {
      const r = await Promise.race([this.#source.cast(winner, loser), timeout(CAST_TIMEOUT_MS)]);
      const total = r.winnerVotes + r.loserVotes;
      const w = Math.round((r.winnerVotes / total) * 100);
      const bySide = (mine: number, other: number): [number, number] => (i === 0 ? [mine, other] : [other, mine]);
      this.result = { pct: bySide(w, 100 - w), votes: bySide(r.winnerVotes, r.loserVotes), total };
      // A tie keeps the streak going. Counted from the votes, as 49.6% would round up to 50.
      this.streak = r.winnerVotes >= r.loserVotes ? this.streak + 1 : 0;
      this.history = [...this.history, { pair, chosen: i, result: this.result, streak: this.streak, round: this.round }];
    } catch (e) {
      this.error = e instanceof Timeout ? 'timeout' : 'failed';
      console.error(e);
    }
    this.#left = REVEAL_MS;
    this.#autoAdvance();
  }

  /** Stop the reveal moving on by itself, for this pair and the ones after, until `resume`. */
  pause() {
    this.paused = true;
    if (this.#revealTimer === undefined) return;
    this.#stopTimer();
    this.#left -= performance.now() - this.#since;
  }

  /** Let the reveal move on by itself again, once it's had the time it had left. */
  resume() {
    this.paused = false;
    this.#autoAdvance();
  }

  /** Move on once the reveal has had its time on screen, if it's showing and not paused. */
  #autoAdvance() {
    this.#stopTimer();
    if (!this.revealed || this.paused || this.viewing !== null) return;
    this.#since = performance.now();
    this.#revealTimer = setTimeout(() => this.advance(), this.#left);
  }

  #stopTimer() {
    clearTimeout(this.#revealTimer);
    this.#revealTimer = undefined;
  }

  skip() {
    if (this.canVote) this.advance();
  }

  async advance() {
    this.#stopTimer();
    this.phase = 'exit';
    this.#count();
    // Voted or skipped, this pair is done with: carry on after it, this visit or the next.
    if (this.#shown) this.#progress.set(this.#shown.collection, this.#shown.at + 1);
    await wait(EXIT_MS);
    // This pair showed them the last of the posters: say so before the next one.
    if (this.progress && this.progress.seen >= this.progress.total) {
      this.pair = null;
      this.progress = null;
      this.viewing = null;
      this.phase = 'seenAll';
      return;
    }
    await this.#show(this.#next());
  }

  /** Move on from the "you've seen every poster" message to the next pair. */
  carryOn() {
    if (this.phase === 'seenAll') this.#show(this.#next());
  }

  /** Count this pair's posters as seen, now it's been voted on or skipped. */
  #count() {
    if (this.progress && this.#shown) this.progress.seen = this.#shown.seen + this.#shown.fresh;
  }

  /**
   * The first pair from `from` in this visitor's order (default: where they're up to), or null
   * once they've been through them all. Pairs with a poster since taken out are skipped. Adding
   * posters reshuffles the order, but they carry on from the same place in it.
   *
   * Until they've been shown every poster, pairs of posters they've already seen are skipped too.
   * The first round shows every poster once, but a poster taken out leaves its partner there
   * without a pair, and that partner's next pair could be dozens of pairs later.
   */
  #next(from?: number): Next | null {
    const collection = this.#source.collection();
    if (!collection) return null;
    const { seed, index } = this.#progress.get(collection);
    const posters = this.#source.posters();
    const order = pairOrder(posters, seed, this.#source.removed());
    const start = from ?? index;
    // The pairs skipped hold only posters already seen, so every pair before `start` counts,
    // shown or skipped, and what they've seen needn't be stored.
    const unseen = new Set(posters.map((p) => p._id));
    for (let at = 0; at < start; at++) order[at]?.forEach((p) => unseen.delete(p._id));
    for (let at = start; at < order.length; at++) {
      const pair = order[at];
      const fresh = pair?.filter((p) => unseen.has(p._id)).length ?? 0;
      if (pair && (fresh || !unseen.size)) return { pair, collection, at, seen: posters.length - unseen.size, fresh };
    }
    return null;
  }

  async #show(next: Next | null) {
    if (!next) {
      this.pair = null;
      this.viewing = null;
      this.phase = 'done';
      return;
    }
    this.#showing = true;
    await Promise.all(next.pair.map((p) => preload(posterSrc(p.image))));
    this.#showing = false;

    this.#shown = next;
    this.pair = next.pair;
    // Looking back ends with the old pair flying out, then straight on to this one.
    this.viewing = null;
    this.chosen = null;
    this.result = null;
    this.error = null;
    const total = this.#source.posters().length;
    this.progress = next.seen < total ? { seen: next.seen, total } : null;
    this.round++;
    this.phase = 'enter';

    // Preload the following pair while this one is on screen.
    this.#next(next.at + 1)?.pair.forEach((p) => preload(posterSrc(p.image)));

    await wait(ENTER_MS);
    if (this.phase === 'enter') this.phase = 'choose';
  }
}

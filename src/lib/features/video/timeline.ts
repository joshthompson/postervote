import { BPM } from '$lib/services/sound.svelte';
import type { PosterInfo } from '$lib/services/posters.svelte';

// The winner video's timing and the random choices behind one run of it. Everything happens on
// the beat of the site's music loop (see sound.svelte.ts), counted from the moment it restarts.

/** The video in CSS pixels; at a device pixel ratio of 2 that's 1080 × 1920. */
export const WIDTH = 540;
export const HEIGHT = 960;

export const BEAT_MS = 60_000 / BPM;

/** When each part starts, in beats from the start (four to a bar). */
export const AT = {
  /** The big logo drops in, a letter every 16th. */
  logo: 0,
  /** It flies off and the small one lands at the top. */
  logoSmall: 5,
  /** "What was the best poster of…", then the competition's name. */
  question: 6,
  name: 8,
  questionOut: 20,
  /** Posters one at a time, a beat each, and the vote count racing up until `counted`. */
  slideshow: 22,
  counted: 39,
  /** Two a beat, piling up all over. */
  pile: 30,
  /** Four a beat. */
  frenzy: 38,
  /** The pile shakes, then bursts. */
  shake: 44,
  burst: 46,
  /** "The votes are in!" and the count. */
  votesIn: 48,
  votesInOut: 57,
  third: 58,
  second: 66,
  /** "And the winner is…" */
  drumroll: 74,
  winner: 80,
  /** The last frame: the winner holds until here. */
  end: 96
} as const;

/** Beats from a place's label to its poster flying in, and to it moving down to the podium. */
export const POSTER_IN = 1;
export const PARK = 7;

/** Beats the zap and stab sound on: the competition's name, the votes being in, each reveal. */
export const CUES = [AT.name, AT.votesIn, AT.third + POSTER_IN, AT.second + POSTER_IN, AT.winner];

export type Spawn = {
  key: number;
  poster: PosterInfo;
  /** On screen from `start` until it starts leaving at `end`, in beats. */
  start: number;
  end: number;
  /** Centre and width, in stage pixels, and tilt in degrees. */
  x: number;
  y: number;
  w: number;
  rot: number;
  /** Where it flies in from, relative to where it lands. */
  fromX: number;
  fromY: number;
  kind: 'slide' | 'pile';
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Spots spread over the stage, in a random order: a jittered grid, so piles cover it evenly. */
function spots(cols: number, rows: number, top: number, bottom: number) {
  const cw = WIDTH / cols;
  const rh = (bottom - top) / rows;
  const cells = Array.from({ length: cols * rows }, (_, i) => ({
    x: (i % cols) * cw + cw / 2,
    y: top + Math.floor(i / cols) * rh + rh / 2
  }));
  return shuffled(cells).map((c) => ({ x: c.x + rand(-0.35, 0.35) * cw, y: c.y + rand(-0.35, 0.35) * rh }));
}

/** Somewhere off one edge of the stage, relative to a point on it. */
function offstage(x: number, y: number) {
  const angle = rand(0, Math.PI * 2);
  return { fromX: Math.cos(angle) * WIDTH * 1.2 - (x - WIDTH / 2), fromY: Math.sin(angle) * HEIGHT * 0.8 - (y - HEIGHT / 2) };
}

/**
 * The posters that fly through before the reveal, and when and where. `pool` is every poster
 * that may appear (the top three are left out, to keep them for the end); it's shuffled and
 * repeated if there aren't enough.
 */
export function plan(pool: PosterInfo[]): Spawn[] {
  if (!pool.length) return [];
  const order = shuffled(pool);
  let next = 0;
  const take = () => order[next++ % order.length];
  const spawns: Spawn[] = [];

  for (let i = 0; i < AT.pile - AT.slideshow; i++) {
    const x = WIDTH / 2 + rand(-30, 30);
    const y = HEIGHT / 2 + rand(-20, 50);
    spawns.push({
      key: spawns.length,
      poster: take(),
      start: AT.slideshow + i,
      end: AT.slideshow + i + 1,
      x,
      y,
      w: 330,
      rot: rand(-9, 9),
      ...offstage(x, y),
      kind: 'slide'
    });
  }

  const pile = (from: number, to: number, perBeat: number, minW: number, maxW: number) => {
    const count = (to - from) * perBeat;
    const where = spots(3, Math.ceil(count / 3), 170, 880);
    for (let i = 0; i < count; i++) {
      const { x, y } = where[i];
      spawns.push({
        key: spawns.length,
        poster: take(),
        start: from + i / perBeat,
        end: AT.burst,
        x,
        y,
        w: rand(minW, maxW),
        rot: rand(-24, 24),
        ...offstage(x, y),
        kind: 'pile'
      });
    }
  };
  pile(AT.pile, AT.frenzy, 2, 180, 230);
  pile(AT.frenzy, AT.shake, 4, 140, 190);
  return spawns;
}

/** The largest whole number of screen pixels per art pixel (up to `max`) that fits `room` wide. */
export function fitPx(widest: number, room: number, max: number) {
  return Math.max(1, Math.min(max, Math.floor(room / widest)));
}

// The order a visitor sees the pairs in. It's fixed by a seed, so only the seed and how far
// they've got need remembering (see progress.ts).
//
// It's a round-robin: the posters are shuffled, then split into rounds in which each poster
// appears once (the circle method), so every round shows every poster before any comes back.
// 80 posters make 79 rounds of 40 pairs, and between them every pair comes up exactly once.
// The rounds, and the pairs within each, are shuffled too. With an odd number, one poster sits
// out each round, and its pair comes first in the next so it isn't left waiting.
//
// Posters taken out of the collection still count towards the order, but their pairs are left
// as gaps, so taking one out doesn't reshuffle anyone's order. Adding a poster does.

type Item = { _id: string };

/** Random numbers from 0 to 1 (mulberry32): the same seed always gives the same ones. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Every pair of `from` once, in the order `seed` gives, each with its sides picked at random.
 * Pairs with a poster in `removed` (ids of posters taken out) are null, keeping their places.
 */
export function pairOrder<T extends Item>(from: T[], seed: number, removed: string[] = []): (T[] | null)[] {
  const random = seeded(seed);
  const present = new Set(from.map((p) => p._id));
  const gone = new Set(removed.filter((id) => !present.has(id)));
  // Sorted first so the order depends only on which posters there are, not the order they came in.
  const posters: (Item | null)[] = shuffle(
    [...from, ...[...gone].map((_id) => ({ _id }))].sort((a, b) => (a._id < b._id ? -1 : 1)),
    random
  );
  if (posters.length % 2) posters.push(null);
  const n = posters.length;
  if (n < 2) return [];

  // The last poster stays put while the others rotate a place each round, meeting a new one each time.
  const rounds = Array.from({ length: n - 1 }, (_, r) => {
    const pairs: Item[][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = i ? posters[(r + i) % (n - 1)] : posters[n - 1];
      const b = posters[(r - i + n - 1) % (n - 1)];
      if (a && b) pairs.push(random() < 0.5 ? [a, b] : [b, a]);
    }
    return { pairs: shuffle(pairs, random), out: posters[n - 1] ? null : posters[r] };
  });

  shuffle(rounds, random).forEach((round, k) => {
    const waiting = rounds[k - 1]?.out;
    if (!waiting) return;
    const at = round.pairs.findIndex((p) => p.includes(waiting));
    round.pairs.unshift(...round.pairs.splice(at, 1));
  });
  return rounds.flatMap((round) => round.pairs).map((pair) => (pair.some((p) => gone.has(p._id)) ? null : (pair as T[])));
}

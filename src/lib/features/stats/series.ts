import { HOUR_MS } from '$shared';

// Turns the stats query's hourly counts and voter depths into bars for StackedBars. Days and hours
// of the day are the viewer's own, so a day runs from their midnight.

/** Who cast a vote: designers, non-designers, or voters from before we asked. */
export type Group = 'designers' | 'others' | 'unknown';
/** Stacked bottom to top in this order. */
export const GROUPS: Group[] = ['designers', 'others', 'unknown'];
export const GROUP_LABEL: Record<Group, string> = { designers: 'Designers', others: 'Non-designers', unknown: 'Not asked' };
export const GROUP_COLOR: Record<Group, string> = { designers: 'var(--red)', others: 'var(--ink)', unknown: '#bdb6c0' };

export type Split = Record<Group, number>;
/** One bar: its axis label, the heading of its tooltip, and its count per group. `marked` is today. */
export type Bar = { key: string; label: string; title: string; values: Split; marked?: boolean };
export type Hour = { hour: number; all: number; designers: number; others: number };
export type Depth = { votes: number } & Split;

const empty = (): Split => ({ designers: 0, others: 0, unknown: 0 });
const add = (into: Split, from: Split) => GROUPS.forEach((g) => (into[g] += from[g]));
export const total = (s: Split) => s.designers + s.others + s.unknown;
export const splitOf = (h: Hour): Split => ({ designers: h.designers, others: h.others, unknown: h.all - h.designers - h.others });

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const midnight = (at: number) => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * Votes per day, from the first day with votes to the day of `until` (or the last day with votes,
 * if later), days without votes included so gaps show.
 */
export function byDay(hours: Hour[], until: number): Bar[] {
  if (!hours.length) return [];
  const days = new Map<string, Split>();
  for (const h of hours) {
    const key = dayKey(midnight(h.hour * HOUR_MS));
    const day = days.get(key) ?? empty();
    add(day, splitOf(h));
    days.set(key, day);
  }
  const today = dayKey(midnight(Date.now()));
  const last = Math.max(hours[hours.length - 1].hour * HOUR_MS, until);
  const bars: Bar[] = [];
  // Stepping by date rather than by 24 hours keeps to midnight across daylight saving changes.
  for (let d = midnight(hours[0].hour * HOUR_MS); d.getTime() <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = dayKey(d);
    const marked = key === today;
    bars.push({ key, label: marked ? 'Today' : shortDate.format(d), title: longDate.format(d), values: days.get(key) ?? empty(), marked });
  }
  return bars;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Every vote so far by the hour of the day it was cast. */
export function byHourOfDay(hours: Hour[]): Bar[] {
  const slots = Array.from({ length: 24 }, empty);
  for (const h of hours) add(slots[new Date(h.hour * HOUR_MS).getHours()], splitOf(h));
  return slots.map((values, i) => ({ key: String(i), label: pad(i), title: `${pad(i)}:00–${pad((i + 1) % 24)}:00`, values }));
}

/** The busiest single hour so far, or null before any votes. */
export function busiestHour(hours: Hour[]) {
  const top = hours.reduce<Hour | null>((best, h) => (!best || h.all > best.all ? h : best), null);
  if (!top) return null;
  const at = new Date(top.hour * HOUR_MS);
  return { label: `${longDate.format(at)}, ${pad(at.getHours())}:00`, votes: top.all };
}

// Each bucket starts at one of these vote counts and runs to just before the next.
const DEPTH_EDGES = [1, 2, 3, 5, 10, 20, 50, 100];

/** Voters by how many votes they've cast, in widening buckets. */
export function byDepth(depth: Depth[]): Bar[] {
  const buckets = DEPTH_EDGES.map(empty);
  for (const row of depth) {
    let i = DEPTH_EDGES.length - 1;
    while (DEPTH_EDGES[i] > row.votes) i--;
    if (i >= 0) add(buckets[i], row);
  }
  // Drop the empty buckets at the top end.
  let n = buckets.length;
  while (n > 1 && !total(buckets[n - 1])) n--;
  return buckets.slice(0, n).map((values, i) => {
    const lo = DEPTH_EDGES[i];
    const hi = DEPTH_EDGES[i + 1] - 1;
    const label = i === DEPTH_EDGES.length - 1 ? `${lo}+` : lo === hi ? String(lo) : `${lo}–${hi}`;
    return { key: label, label, title: `${label} ${lo === 1 && hi === 1 ? 'vote' : 'votes'}`, values };
  });
}

/** Middle and top of the voters' vote counts, and the share who stopped after one. */
export function depthSummary(depth: Depth[]) {
  const voters = depth.reduce((n, row) => n + total(row), 0);
  if (!voters) return null;
  let seen = 0;
  let median = 0;
  for (const row of depth) {
    seen += total(row);
    if (seen >= voters / 2) {
      median = row.votes;
      break;
    }
  }
  const once = depth.find((row) => row.votes === 1);
  return { voters, median, max: depth[depth.length - 1].votes, onceShare: once ? total(once) / voters : 0 };
}

/** Round gridlines from 0 to just above `max`: steps of 1, 2 or 5 times a power of ten, whole numbers only. */
export function ticks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

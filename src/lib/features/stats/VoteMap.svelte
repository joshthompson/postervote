<script lang="ts">
  import { untrack } from 'svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { countryName, flag } from '$lib/utils/places';
  import { tween } from '$lib/utils/tween';
  import { GROUP_COLOR, GROUP_LABEL, type Group } from './series';
  import world from './world.json';

  // Where the votes come from: each country shaded by its votes (on a log scale, so one busy
  // country doesn't leave the rest pale), with every country listed by votes beside it. The map
  // shows a close-up of where most votes come from, or the whole world. Hovering a country, or its row,
  // picks it out; on the map a tooltip gives its split by group. Countries too small to see are
  // drawn as dots. Shapes come from scripts/build-map.mjs.

  type Country = { code: string; all: number; designers: number; others: number };
  type Segment = 'all' | 'designers' | 'others';
  type Box = [number, number, number, number]; // x, y, width, height in map units

  let { countries }: { countries: Country[] } = $props();

  const SEGMENTS: { key: Segment; label: string }[] = [
    { key: 'all', label: 'All voters' },
    { key: 'designers', label: 'Designers' },
    { key: 'others', label: 'Non-designers' }
  ];
  // One hue, light to dark: the site's red.
  const RAMP = [
    'oklch(0.9 0.05 15)',
    'oklch(0.8 0.11 15)',
    'oklch(0.7 0.18 18)',
    'oklch(0.6 0.21 20)',
    'oklch(0.45 0.17 18)'
  ];
  // Where a shade may start; the top few that fit under the busiest country are used.
  const EDGES = [1, 3, 10, 30, 100, 300, 1000, 3000, 10_000, 30_000, 100_000];
  const W = world.width;
  const H = world.height;
  const WORLD: Box = [0, 0, W, H];
  // The close-up fits the busiest countries that between them hold this share of the votes, so
  // one vote from the other side of the world doesn't zoom it out.
  const CLOSE_UP_SHARE = 0.9;
  // The close-up is never narrower than this many map units (about the width of Europe)...
  const MIN_SPAN = 150;
  // ...and leaves this much room round the countries.
  const PAD = 1.3;
  const shapes = world.countries as Record<string, { d: string; box: number[] }>;
  const codes = Object.keys(shapes);
  // Countries whose outline is under this many map units across are also drawn as a dot.
  const TINY = 2.5;

  let segment = $state<Segment>('all');
  let zoom = $state<'fit' | 'world'>('fit');
  let hovered = $state<string | null>(null);
  // Where the pointer is over the map, for the tooltip; null when the row is hovered instead.
  let pointer = $state<{ x: number; y: number } | null>(null);
  let width = $state(0);

  const num = (n: number) => n.toLocaleString('en-GB');
  const name = (code: string) => countryName(code, 'en');

  const byCode = $derived(new Map(countries.map((c) => [c.code, c])));
  const votesOf = (code: string) => byCode.get(code)?.[segment] ?? 0;
  const shown = $derived(countries.filter((c) => c[segment] > 0).sort((a, b) => b[segment] - a[segment]));
  const located = $derived(shown.reduce((n, c) => n + c[segment], 0));
  const max = $derived(shown[0]?.[segment] ?? 0);

  // Each shade's lowest count, starting at 1, and the darkest shades for them.
  const lows = $derived([1, ...EDGES.filter((e) => e > 1 && e <= max).slice(-(RAMP.length - 1))]);
  const shades = $derived(RAMP.slice(RAMP.length - lows.length));
  const legend = $derived(
    lows.map((lo, i) => {
      const hi = lows[i + 1] - 1;
      return { shade: shades[i], label: i === lows.length - 1 ? `${num(lo)}+` : lo === hi ? num(lo) : `${num(lo)}–${num(hi)}` };
    })
  );
  function shade(votes: number) {
    let i = lows.length - 1;
    while (lows[i] > votes) i--;
    return shades[i];
  }

  /** The view round the busiest countries on the map (see CLOSE_UP_SHARE), at the map's shape. */
  function fitted(): Box {
    const mapped = shown.filter((c) => shapes[c.code]);
    const total = mapped.reduce((n, c) => n + c[segment], 0);
    const boxes: number[][] = [];
    let covered = 0;
    for (const c of mapped) {
      if (boxes.length && covered >= total * CLOSE_UP_SHARE) break;
      boxes.push(shapes[c.code].box);
      covered += c[segment];
    }
    if (!boxes.length) return WORLD;
    const x0 = Math.min(...boxes.map((b) => b[0]));
    const y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[2]));
    const y1 = Math.max(...boxes.map((b) => b[3]));
    let w = Math.max(x1 - x0, MIN_SPAN) * PAD;
    let h = Math.max(y1 - y0, MIN_SPAN * (H / W)) * PAD;
    if (w / h > W / H) h = (w * H) / W;
    else w = (h * W) / H;
    if (w >= W) return WORLD;
    // Kept on the map, except for a little room above the top, where Russia and Scandinavia reach.
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    return [clamp((x0 + x1) / 2 - w / 2, 0, W - w), clamp((y0 + y1) / 2 - h / 2, -h * 0.05, H - h), w, h];
  }

  // The view glides to its target: zooming in from the whole world on first showing.
  const target = $derived(zoom === 'world' ? WORLD : fitted());
  let view = $state<Box>(WORLD);
  $effect(() => {
    const to = target;
    const from = untrack(() => view);
    if (to.every((v, i) => Math.abs(v - from[i]) < 0.5)) return;
    return tween(0, 1, 900, (t) => (view = from.map((f, i) => f + (to[i] - f) * t) as Box));
  });
  // Map units per screen pixel, so dots and outlines stay the same size on screen at any zoom.
  const unit = $derived(width ? view[2] / width : 1);

  const dots = $derived(
    shown.flatMap((c) => {
      const box = shapes[c.code]?.box;
      if (!box || box[2] - box[0] > TINY || box[3] - box[1] > TINY) return [];
      return [{ code: c.code, x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 }];
    })
  );

  function move(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    hovered = (e.target as Element).closest('[data-code]')?.getAttribute('data-code') ?? null;
  }
  function leave() {
    hovered = null;
    pointer = null;
  }

  const tip = $derived.by(() => {
    if (!hovered || !pointer) return null;
    const c = byCode.get(hovered);
    const all = c?.all ?? 0;
    const groups: [Group, number][] = c
      ? [
          ['designers', c.designers],
          ['others', c.others],
          ['unknown', all - c.designers - c.others]
        ]
      : [];
    return { code: hovered, votes: votesOf(hovered), groups: groups.filter(([, n]) => n > 0), all };
  });
</script>

<div class="controls">
  <div class="pills" role="group" aria-label="Whose votes">
    {#each SEGMENTS as s (s.key)}
      <Pill variant={segment === s.key ? 'ink' : 'outline'} pressed={segment === s.key} onclick={() => (segment = s.key)}>{s.label}</Pill>
    {/each}
  </div>
  <div class="pills" role="group" aria-label="Zoom">
    <Pill variant={zoom === 'fit' ? 'ink' : 'outline'} pressed={zoom === 'fit'} onclick={() => (zoom = 'fit')}>Close-up</Pill>
    <Pill variant={zoom === 'world' ? 'ink' : 'outline'} pressed={zoom === 'world'} onclick={() => (zoom = 'world')}>World</Pill>
  </div>
</div>

<div class="layout">
  <div class="map" bind:clientWidth={width} onpointermove={move} onpointerleave={leave} role="presentation">
    <svg viewBox={view.join(' ')} style="aspect-ratio: {W} / {H}" role="img" aria-label="Map of votes by country; the numbers are in the list">
      {#each codes as code (code)}
        {@const votes = votesOf(code)}
        <path d={shapes[code].d} data-code={code} class:voted={votes > 0} style:fill={votes ? shade(votes) : undefined} />
      {/each}
      {#each dots as dot (dot.code)}
        <circle class="voted" cx={dot.x} cy={dot.y} r={4 * unit} data-code={dot.code} style:fill={shade(votesOf(dot.code))} />
      {/each}
      {#if hovered && shapes[hovered]}
        <path class="outline" d={shapes[hovered].d} />
        {#each dots.filter((d) => d.code === hovered) as dot (dot.code)}
          <circle class="outline" cx={dot.x} cy={dot.y} r={4 * unit} />
        {/each}
      {/if}
    </svg>

    {#if tip}
      <div class="tip" style="left: {Math.min(Math.max(pointer!.x, 100), width - 100)}px; top: {pointer!.y - 14}px">
        <strong><span aria-hidden="true">{flag(tip.code)}</span> {name(tip.code)}</strong>
        {#if tip.votes}
          <span>{num(tip.votes)} {tip.votes === 1 ? 'vote' : 'votes'} · {Math.round((tip.votes / located) * 100) || '<1'}% of {segment === 'all' ? 'located' : 'theirs'}</span>
          {#if segment === 'all' && tip.groups.length > 1}
            {#each tip.groups as [g, n] (g)}
              <span class="row"><i style="background: {GROUP_COLOR[g]}"></i>{GROUP_LABEL[g]}<b>{num(n)}</b></span>
            {/each}
          {/if}
        {:else}
          <span class="none">No votes{tip.all ? ' from this group' : ''}</span>
        {/if}
      </div>
    {/if}

    {#if legend.length && max}
      <div class="legend" aria-hidden="true">
        {#each legend as step (step.label)}
          <span><i style="background: {step.shade}"></i>{step.label}</span>
        {/each}
      </div>
    {/if}
  </div>

  <ol class="list">
    {#each shown as c, i (c.code)}
      <li class:on={hovered === c.code} onpointerenter={() => (hovered = c.code)} onpointerleave={() => (hovered = null)}>
        <span class="rank">{i + 1}</span>
        <span class="flag" aria-hidden="true">{flag(c.code)}</span>
        <span class="name">{name(c.code)}</span>
        <b>{num(c[segment])}</b>
        <span class="bar" style="--w: {(c[segment] / max) * 100}%; --c: {shade(c[segment])}"></span>
      </li>
    {:else}
      <li class="empty">No votes with a place yet.</li>
    {/each}
  </ol>
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 14px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .map {
    position: relative;
    touch-action: pan-y;
  }
  svg {
    display: block;
    width: 100%;
    border-radius: 14px;
    background: rgba(31, 26, 36, 0.025);
  }
  path,
  circle {
    stroke: white;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  path {
    fill: rgba(31, 26, 36, 0.09);
    transition: fill 0.4s;
  }
  .voted {
    cursor: crosshair;
  }
  path.outline,
  circle.outline {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    pointer-events: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 10px 4px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    pointer-events: none;
  }
  .legend span,
  .row {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  i {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    flex: none;
  }
  .tip {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, -100%);
    display: grid;
    gap: 3px;
    min-width: 170px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
    pointer-events: none;
    box-shadow: var(--shadow-lift);
  }
  .tip strong {
    margin-bottom: 2px;
  }
  .tip i {
    box-shadow: 0 0 0 1.5px var(--paper);
  }
  .row b {
    margin-left: auto;
  }
  .none {
    color: rgba(255, 247, 238, 0.7);
  }
  .list {
    display: grid;
    gap: 2px;
    max-height: 420px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    font-size: 14px;
  }
  @media (max-width: 760px) {
    .list {
      max-height: 300px;
    }
  }
  li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 9px;
    border-radius: 10px;
    transition: background 0.2s;
  }
  li.on {
    background: rgba(31, 26, 36, 0.06);
  }
  .rank {
    min-width: 2ch;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  li b {
    font-variant-numeric: tabular-nums;
  }
  .bar {
    position: absolute;
    left: calc(8px + 2ch + 8px);
    right: 8px;
    bottom: 3px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--c) var(--w), rgba(31, 26, 36, 0.06) var(--w));
  }
  .empty {
    color: var(--muted);
  }
</style>

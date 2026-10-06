<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import ChartCard from './ChartCard.svelte';
  import ChartPoster from './ChartPoster.svelte';
  import { pct } from './format';
  import type { LinkTo, SplitPoster } from './types';

  // Every poster on one line by how much more designers pick it than non-designers do: their
  // favourites to the right, everyone else's to the left. Up and down means nothing; posters
  // just stack out from the middle so none overlap (a beeswarm).

  let { posters, linkTo }: { posters: SplitPoster[]; linkTo: LinkTo } = $props();

  const t = $derived(i18n.t.results);
  let width = $state(0);

  const HEAD = 30; // the side labels above
  const FOOT = 30; // the axis below
  const r = $derived(width < 520 ? 13 : 17);
  const edge = $derived(r + 6);

  // Win-rate points either side of even, rounded up to the next 10.
  const max = $derived(Math.max(0.1, Math.ceil(Math.max(0, ...posters.map((p) => Math.abs(p.gap))) * 10) / 10));
  const xOf = (gap: number) => width / 2 + (gap / max) * (width / 2 - edge);
  // Out from even both ways, every 10 points, or 20 when that would crowd them.
  const step = $derived(max > 0.5 || (width < 520 && max > 0.2) ? 0.2 : 0.1);
  const ticks = $derived(
    Array.from({ length: Math.floor(max / step + 1e-9) + 1 }, (_, i) => i * step).flatMap((v) => (v ? [-v, v] : [0]))
  );

  // Places each poster at its x as close to the middle line as it fits, nearest gaps first.
  const placed = $derived.by(() => {
    if (!width) return [];
    const d = 2 * r + 4;
    const done: { p: SplitPoster; x: number; y: number }[] = [];
    for (const p of [...posters].sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))) {
      const x = xOf(p.gap);
      const blocked = done
        .filter((q) => Math.abs(q.x - x) < d)
        .map((q) => {
          const h = Math.sqrt(d * d - (q.x - x) ** 2);
          return [q.y - h, q.y + h];
        });
      const y = [0, ...blocked.flat()]
        .sort((a, b) => Math.abs(a) - Math.abs(b))
        .find((c) => blocked.every(([lo, hi]) => c <= lo + 0.01 || c >= hi - 0.01))!;
      done.push({ p, x, y });
    }
    return done;
  });
  const reach = $derived(Math.max(0, ...placed.map((n) => Math.abs(n.y))) + r + 8);
  const mid = $derived(HEAD + reach);
  const height = $derived(HEAD + 2 * reach + FOOT);

  const lines = (p: SplitPoster) => [
    `${t.designers}: ${pct(p.designers.winRate)} · #${p.designers.rank}`,
    `${t.others}: ${pct(p.others.winRate)} · #${p.others.rank}`
  ];
  const tickLabel = (v: number) => (Math.abs(v) < 1e-9 ? t.gapChart.even : i18n.num(Math.round(Math.abs(v) * 100)));
</script>

<ChartCard title={t.gapChart.title} note={t.gapChart.note}>
  <div class="plot" bind:clientWidth={width} style="height: {height}px">
    {#if width}
      <svg {width} {height} aria-hidden="true">
        <rect class="side others" x="0" y={HEAD} width={width / 2} height={2 * reach} />
        <rect class="side designers" x={width / 2} y={HEAD} width={width / 2} height={2 * reach} />
        <line class="even" x1={width / 2} x2={width / 2} y1={HEAD} y2={HEAD + 2 * reach} />
        <line class="axis" x1={edge} x2={width - edge} y1={mid} y2={mid} />
        {#each ticks as v}
          <line class="tick" x1={xOf(v)} x2={xOf(v)} y1={HEAD + 2 * reach} y2={HEAD + 2 * reach + 5} />
          <text x={xOf(v)} y={height - 8} text-anchor="middle">{tickLabel(v)}</text>
        {/each}
      </svg>
      <span class="label start"><i class="swatch others"></i>← {t.gapChart.othersPrefer}</span>
      <span class="label end">{t.gapChart.designersPrefer} →<i class="swatch designers"></i></span>
      {#each placed as { p, x, y }, i (p._id)}
        <ChartPoster
          title={p.title}
          image={p.image}
          {x}
          y={mid + y}
          {r}
          ring={p.gap > 0 ? 'var(--red)' : 'var(--ink)'}
          lines={lines(p)}
          align={x < 110 ? 'start' : x > width - 110 ? 'end' : 'center'}
          delay={Math.min(i, 30) * 25}
          link={linkTo(p, 'disagreements')}
        />
      {/each}
    {/if}
  </div>
</ChartCard>

<style>
  .plot {
    position: relative;
  }
  svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .side.others {
    fill: rgba(31, 26, 36, 0.04);
  }
  .side.designers {
    fill: rgba(255, 59, 92, 0.06);
  }
  .even {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .axis {
    stroke: rgba(31, 26, 36, 0.12);
  }
  .tick {
    stroke: rgba(31, 26, 36, 0.25);
  }
  text {
    fill: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .label {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
  }
  .label.start {
    left: 0;
  }
  .label.end {
    right: 0;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .swatch.others {
    background: var(--ink);
  }
  .swatch.designers {
    background: var(--red);
  }
</style>

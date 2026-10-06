<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import ChartCard from './ChartCard.svelte';
  import ChartPoster from './ChartPoster.svelte';
  import type { LinkTo, SplitPoster } from './types';

  // Every poster by its score with non-designers (across) and with designers (up), on the same
  // scale, so the diagonal is where the two groups agree. Above it designers rate it higher.
  // The note gives the correlation between the two scores.

  let { posters, linkTo }: { posters: SplitPoster[]; linkTo: LinkTo } = $props();

  const t = $derived(i18n.t.results);
  let width = $state(0);

  const LEFT = 52; // tick labels and the rotated axis title
  const BOTTOM = 44;
  const TOP = 14;
  const r = $derived(width < 520 ? 10 : 12);
  const size = $derived(Math.max(0, Math.min(width - LEFT - 16, 480)));
  const x0 = $derived(Math.max(LEFT, (width - size) / 2)); // the plot's left edge, centred when there's room

  // One scale for both axes, on round numbers, with room for the thumbnails at the ends.
  const scale = $derived.by(() => {
    const all = posters.flatMap((p) => [p.designers.rating, p.others.rating]);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const step = hi - lo > 400 ? 100 : 50;
    const min = Math.floor((lo - 10) / step) * step;
    const max = Math.max(min + step, Math.ceil((hi + 10) / step) * step);
    const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
    return { min, max, ticks };
  });
  const xOf = (v: number) => x0 + ((v - scale.min) / (scale.max - scale.min)) * size;
  const yOf = (v: number) => TOP + size - ((v - scale.min) / (scale.max - scale.min)) * size;

  // Pearson's r between the two groups' scores.
  const correlation = $derived.by(() => {
    const n = posters.length;
    if (n < 3) return null;
    const xs = posters.map((p) => p.others.rating);
    const ys = posters.map((p) => p.designers.rating);
    const mx = xs.reduce((a, b) => a + b) / n;
    const my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  });
  const shownR = $derived(
    correlation === null ? '–' : i18n.num(correlation, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );

  const lines = (p: SplitPoster) => [
    `${t.designers}: ${t.scoreChart.points(Math.round(p.designers.rating))} · #${p.designers.rank}`,
    `${t.others}: ${t.scoreChart.points(Math.round(p.others.rating))} · #${p.others.rank}`
  ];
</script>

<ChartCard title={t.scoreChart.title} note={t.scoreChart.note(shownR)}>
  <div class="plot" bind:clientWidth={width} style="height: {TOP + size + BOTTOM}px">
    {#if size}
      {@const left = x0}
      {@const right = x0 + size}
      {@const top = TOP}
      {@const bottom = TOP + size}
      <svg {width} height={TOP + size + BOTTOM} aria-hidden="true">
        <polygon class="designers" points="{left},{bottom} {left},{top} {right},{top}" />
        <polygon class="others" points="{left},{bottom} {right},{bottom} {right},{top}" />
        {#each scale.ticks as v, i}
          <line class="grid" x1={xOf(v)} x2={xOf(v)} y1={top} y2={bottom} />
          <line class="grid" x1={left} x2={right} y1={yOf(v)} y2={yOf(v)} />
          <!-- On a small plot, every other number, so they don't run together. -->
          {#if size / scale.ticks.length > 40 || i % 2 === 0}
            <text x={xOf(v)} y={bottom + 18} text-anchor="middle">{i18n.num(v)}</text>
            <text x={left - 8} y={yOf(v) + 4} text-anchor="end">{i18n.num(v)}</text>
          {/if}
        {/each}
        <line class="agree" x1={left} y1={bottom} x2={right} y2={top} />
        <text class="title" x={(left + right) / 2} y={bottom + 38} text-anchor="middle">{t.scoreChart.othersScore}</text>
        <text class="title" transform="translate({left - 42} {(top + bottom) / 2}) rotate(-90)" text-anchor="middle">
          {t.scoreChart.designersScore}
        </text>
        <text class="corner" x={left + 10} y={top + 18}>{t.scoreChart.designersHigher}</text>
        <text class="corner" x={right - 10} y={bottom - 10} text-anchor="end">{t.scoreChart.othersHigher}</text>
      </svg>
      {#each posters as p, i (p._id)}
        {@const x = xOf(p.others.rating)}
        <ChartPoster
          title={p.title}
          image={p.image}
          {x}
          y={yOf(p.designers.rating)}
          {r}
          ring={p.designers.rating > p.others.rating ? 'var(--red)' : 'var(--ink)'}
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
  .designers {
    fill: rgba(255, 59, 92, 0.06);
  }
  .others {
    fill: rgba(31, 26, 36, 0.04);
  }
  .grid {
    stroke: rgba(31, 26, 36, 0.08);
  }
  .agree {
    stroke: var(--muted);
    stroke-dasharray: 3 4;
  }
  text {
    fill: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .title {
    fill: var(--ink);
    font-size: 13px;
    font-weight: 700;
  }
  .corner {
    font-size: 12px;
    font-weight: 700;
  }
</style>

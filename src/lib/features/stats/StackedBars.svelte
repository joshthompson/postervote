<script lang="ts">
  import { GROUP_COLOR, GROUP_LABEL, ticks, total, type Bar, type Group } from './series';

  // Bars stacked by voter group, growing up from the baseline one after another. Hovering (or
  // tapping) a bar dims the rest and shows its breakdown; the tallest is labelled with its total.
  // The legend gives each group's total, and the same numbers are in a table under the chart.

  let {
    bars,
    groups,
    unit,
    height = 260,
    labelWidth = 44
  }: {
    bars: Bar[];
    /** The groups to stack, bottom to top. */
    groups: Group[];
    /** What's counted, for the tooltip and table, e.g. "votes". */
    unit: string;
    height?: number;
    /** Room each axis label needs; labels are thinned out to fit. */
    labelWidth?: number;
  } = $props();

  const LEFT = 40;
  const RIGHT = 6;
  const TOP = 24;
  const BOTTOM = 28;
  // Surface left between stacked segments, and the rounding of each bar's top.
  const GAP = 2;
  const RADIUS = 4;

  let width = $state(0);
  let active = $state<number | null>(null);

  const num = (n: number) => n.toLocaleString('en-GB');
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

  const totals = $derived(bars.map((b) => total(b.values)));
  const grid = $derived(ticks(Math.max(0, ...totals)));
  const top = $derived(grid[grid.length - 1]);
  const peak = $derived(totals.indexOf(Math.max(...totals)));
  const plotH = $derived(height - TOP - BOTTOM);
  const slot = $derived(Math.max(0, width - LEFT - RIGHT) / Math.max(1, bars.length));
  const barW = $derived(Math.max(1, Math.min(slot - (slot > 8 ? slot * 0.28 : 1), 48)));
  // Label every nth bar, counting back from the last, so the latest (today) always has one.
  const every = $derived(Math.max(1, Math.ceil(labelWidth / Math.max(1, slot))));
  const yOf = (v: number) => TOP + plotH - (v / top) * plotH;
  const xOf = (i: number) => LEFT + i * slot + (slot - barW) / 2;
  const groupTotals = $derived(
    Object.fromEntries(groups.map((g) => [g, bars.reduce((n, b) => n + b.values[g], 0)])) as Record<Group, number>
  );
  const grand = $derived(groups.reduce((n, g) => n + groupTotals[g], 0));

  /** A segment as a path; the top one of a bar gets rounded corners. */
  function segment(x: number, y: number, w: number, h: number, rounded: boolean) {
    const r = rounded ? Math.min(RADIUS, w / 2, h) : 0;
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /** A bar's segments, bottom up, with a gap above each one that has another on top of it. */
  function stack(bar: Bar, i: number) {
    const shown = groups.filter((g) => bar.values[g] > 0);
    let below = 0;
    return shown.map((g, j) => {
      const yTop = yOf(below + bar.values[g]);
      const yBottom = yOf(below);
      below += bar.values[g];
      const last = j === shown.length - 1;
      const h = Math.max(0, yBottom - yTop - (last ? 0 : GAP));
      return { g, d: segment(xOf(i), yTop + (last ? 0 : GAP), barW, h, last) };
    });
  }

  function leave(e: PointerEvent) {
    // A tap leaves as soon as the finger lifts; keep its tooltip until the next tap.
    if (e.pointerType === 'mouse') active = null;
  }
</script>

<div class="legend">
  {#each groups as g (g)}
    <span><i style="background: {GROUP_COLOR[g]}"></i>{GROUP_LABEL[g]} <b>{num(groupTotals[g])}</b> <em>{pct(groupTotals[g], grand)}</em></span>
  {/each}
</div>

<div class="plot" bind:clientWidth={width} style="height: {height}px">
  {#if width && bars.length}
    <svg {width} {height} class:hovering={active !== null} onpointerleave={leave} role="img" aria-label="Chart; the numbers are in the table below">
      {#each grid as v (v)}
        <line class="grid" x1={LEFT} x2={width - RIGHT} y1={yOf(v)} y2={yOf(v)} />
        <text class="tick" x={LEFT - 8} y={yOf(v) + 4} text-anchor="end">{num(v)}</text>
      {/each}
      {#each bars as bar, i (bar.key)}
        <g class="bar" class:on={active === i} style="animation-delay: {Math.min(i, 40) * 18}ms">
          {#each stack(bar, i) as s (s.g)}
            <path d={s.d} fill={GROUP_COLOR[s.g]} />
          {/each}
        </g>
        {#if (bars.length - 1 - i) % every === 0}
          <text class="label" class:marked={bar.marked} x={xOf(i) + barW / 2} y={height - 8} text-anchor="middle">{bar.label}</text>
        {/if}
      {/each}
      {#if totals[peak] > 0 && active === null}
        <text class="peak" x={xOf(peak) + barW / 2} y={yOf(totals[peak]) - 7} text-anchor="middle">{num(totals[peak])}</text>
      {/if}
      <line class="axis" x1={LEFT} x2={width - RIGHT} y1={yOf(0)} y2={yOf(0)} />
      <!-- Hit areas: the bar's whole column, so thin bars are easy to land on. -->
      {#each bars as bar, i (bar.key)}
        <rect
          class="hit"
          x={LEFT + i * slot}
          y={TOP}
          width={slot}
          height={plotH}
          role="presentation"
          onpointerenter={() => (active = i)}
          onpointerdown={() => (active = i)}
        />
      {/each}
    </svg>
    {#if active !== null}
      {@const bar = bars[active]}
      {@const sum = totals[active]}
      <div
        class="tip"
        style="left: {Math.min(Math.max(xOf(active) + barW / 2, 90), width - 90)}px; top: {Math.max(yOf(sum), TOP) - 10}px"
      >
        <strong>{bar.title}</strong>
        {#each [...groups].reverse() as g (g)}
          <span class="row"><i style="background: {GROUP_COLOR[g]}"></i>{GROUP_LABEL[g]}<b>{num(bar.values[g])}</b><em>{pct(bar.values[g], sum)}</em></span>
        {/each}
        <span class="row sum">Total<b>{num(sum)} {unit}</b></span>
      </div>
    {/if}
  {/if}
</div>

<details>
  <summary>Table</summary>
  <table>
    <thead>
      <tr><th></th>{#each groups as g (g)}<th>{GROUP_LABEL[g]}</th>{/each}<th>All</th></tr>
    </thead>
    <tbody>
      {#each bars as bar, i (bar.key)}
        <tr><th>{bar.title}</th>{#each groups as g (g)}<td>{num(bar.values[g])}</td>{/each}<td>{num(totals[i])}</td></tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 0 0 14px 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend b {
    color: var(--ink);
  }
  .legend em,
  .tip em {
    font-style: normal;
    font-weight: 600;
    color: var(--muted);
  }
  i {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    flex: none;
  }
  .plot {
    position: relative;
    touch-action: pan-y;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: rgba(31, 26, 36, 0.08);
  }
  .axis {
    stroke: rgba(31, 26, 36, 0.35);
    stroke-width: 1.5;
  }
  text {
    fill: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .label.marked {
    fill: var(--red);
    font-weight: 800;
  }
  .peak {
    fill: var(--ink);
    font-size: 13px;
    font-weight: 800;
    animation: fade 0.4s both 0.6s;
  }
  .bar {
    transform-box: fill-box;
    transform-origin: bottom;
    animation: grow 0.8s var(--spring) both;
    transition: opacity 0.2s;
  }
  .hovering .bar:not(.on) {
    opacity: 0.3;
  }
  .hit {
    fill: transparent;
    cursor: crosshair;
  }
  @keyframes grow {
    from {
      transform: scaleY(0);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes tip-in {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-100% + 8px)) scale(0.9);
    }
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
    animation: tip-in 0.25s var(--spring) both;
  }
  .tip strong {
    margin-bottom: 3px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .row b {
    margin-left: auto;
  }
  .row em {
    min-width: 3ch;
    text-align: right;
  }
  .tip i {
    box-shadow: 0 0 0 1.5px var(--paper);
  }
  .sum {
    margin-top: 3px;
    padding-top: 5px;
    border-top: 1px solid rgba(255, 247, 238, 0.2);
  }
  details {
    margin-top: 10px;
    font-size: 13px;
  }
  summary {
    cursor: pointer;
    color: var(--muted);
    font-weight: 700;
  }
  table {
    margin-top: 8px;
    border-collapse: collapse;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 4px 8px;
    text-align: right;
    border-bottom: 1px solid rgba(31, 26, 36, 0.08);
  }
  tbody th {
    text-align: left;
    font-weight: 600;
  }
</style>

<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Meter from '$lib/components/ui/Meter.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { pct } from './format';
  import Board from './Board.svelte';
  import GapSwarm from './GapSwarm.svelte';
  import RankRow from './RankRow.svelte';
  import ScoreScatter from './ScoreScatter.svelte';
  import type { LinkTo, SplitPoster } from './types';

  // Posters designers and everyone else rate most differently, biggest gap first,
  // with each group's win rate and rank side by side. Each links to its poster (see `linkTo`).

  let { posters, linkTo }: { posters: SplitPoster[]; linkTo: LinkTo } = $props();

  const t = $derived(i18n.t.results);
  const groups = $derived([
    { key: 'designers', label: t.designers, fill: 'var(--red)' },
    { key: 'others', label: t.others, fill: 'var(--ink)' }
  ] as const);
</script>

<GapSwarm {posters} {linkTo} />
<ScoreScatter {posters} {linkTo} />

<Board title={t.versusTitle} note={t.versusNote}>
  {#each posters as p, i (p._id)}
    <li in:fly={{ y: 24, duration: 500, delay: Math.min(i, 20) * 35, easing: backOut }}>
      <RankRow
        rank={i + 1}
        image={p.image}
        title={p.title}
        value={t.gap(Math.round(Math.abs(p.gap) * 100))}
        caption={p.gap > 0 ? t.designersLove : t.designersNotSold}
        top={i < 3}
        {...linkTo(p, 'disagreements')}
      >
        <div class="versus">
          {#each groups as g}
            <span class="who">{g.label}</span>
            <Meter value={Math.max(2, p[g.key].winRate * 100)} fill={g.fill} />
            <span class="val">{pct(p[g.key].winRate)} · #{p[g.key].rank}</span>
          {/each}
        </div>
      </RankRow>
    </li>
  {/each}
</Board>

<style>
  .versus {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 4px 10px;
    font-size: 13px;
  }
  .who {
    color: var(--muted);
    font-weight: 600;
  }
  .val {
    font-weight: 700;
    white-space: nowrap;
  }
</style>

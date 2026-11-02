<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { posterSrc } from '$lib/utils/images';
  import type { Duel } from './types';

  // Two posters side by side with a bar splitting their head-to-head wins.

  let { title, blurb, duel, index = 0 }: { title: string; blurb: string; duel: Duel; index?: number } = $props();
</script>

<article class="duel-card" style="--i:{index}">
  <header>
    <h3>{title}</h3>
    <span>{blurb}</span>
  </header>
  <div class="duel">
    <img src={posterSrc(duel.a.image)} alt={duel.a.title} />
    <span class="vs">{i18n.t.results.vs}</span>
    <img src={posterSrc(duel.b.image)} alt={duel.b.title} />
  </div>
  <div class="split">
    <i style="flex: {duel.a.votes || 0.0001}"></i>
    <i style="flex: {duel.b.votes || 0.0001}"></i>
  </div>
  <div class="split-labels">
    <span>{duel.a.title} · {duel.a.votes}</span>
    <span>{duel.b.votes} · {duel.b.title}</span>
  </div>
</article>

<style>
  .duel-card {
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    border-radius: 26px;
    padding: 22px;
    box-shadow: var(--shadow-card);
    animation: rise 0.8s var(--spring) both;
    animation-delay: calc(0.8s + var(--i) * 0.12s);
    transition:
      transform 0.35s var(--spring),
      box-shadow 0.35s;
  }
  /* Lift by whole pixels only: rotating or scaling text resamples it and it blurs. */
  .duel-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 24px 44px -20px color-mix(in srgb, var(--ink) 50%, transparent);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.02em;
  }
  header span {
    color: var(--muted);
    font-size: 13px;
  }
  .duel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 18px 0 16px;
  }
  img {
    width: 38%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: 5px solid white;
    border-radius: 4px;
    box-shadow: 0 10px 24px -12px color-mix(in srgb, var(--ink) 50%, transparent);
  }
  img:first-child {
    rotate: -4deg;
  }
  img:last-child {
    rotate: 4deg;
  }
  .vs {
    flex-shrink: 0;
    display: grid;
    place-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--accent-2);
    font-weight: 800;
    font-size: 14px;
  }
  .split {
    display: flex;
    height: 12px;
    border-radius: 99px;
    overflow: hidden;
    gap: 3px;
  }
  .split i {
    background: var(--accent);
    transition: flex 0.8s var(--smooth);
  }
  .split i:last-child {
    background: var(--ink);
  }
  .split-labels {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
  }
</style>

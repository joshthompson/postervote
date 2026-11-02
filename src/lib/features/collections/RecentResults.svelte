<script lang="ts">
  import { resolve } from '$app/paths';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track } from '$lib/services/analytics';
  import { posterSrc } from '$lib/utils/images';
  import type { Summary } from './archives.svelte';

  // A link to a just-archived collection's results (see `recentlyArchived`), for the voting
  // screen's intro. `delay` (seconds) lets it pop in after the button.

  let { recent, delay = 0 }: { recent: Summary; delay?: number } = $props();

  const t = $derived(i18n.t.vote);
  // Second, first, third from left to right, as on the podium; the first sits in front.
  const fan = $derived(
    [
      { poster: recent.top[1], place: 2 },
      { poster: recent.top[0], place: 1 },
      { poster: recent.top[2], place: 3 }
    ].filter((p) => p.poster)
  );
</script>

<a
  class="recent"
  style="animation-delay: {delay}s"
  href={resolve('/collections/[collection]', { collection: recent.slug })}
  onclick={() =>
    track('nav_link_clicked', { destination: 'collection', placement: 'vote_intro', collection: recent.slug })}
>
  {#if fan.length}
    <span class="preview" aria-hidden="true">
      {#each fan as { poster, place } (place)}
        <img class="poster place-{place}" src={posterSrc(poster.image)} alt="" />
      {/each}
    </span>
  {/if}
  <span class="info">
    <span class="label">{t.resultsIn}</span>
    <span class="title">{recent.title}</span>
    <span class="cta">{t.seeWinners}</span>
  </span>
</a>

<style>
  .recent {
    display: flex;
    align-items: center;
    gap: 18px;
    max-width: min(100%, 420px);
    padding: 14px 22px 14px 16px;
    border-radius: 22px;
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-card);
    color: inherit;
    text-align: left;
    text-decoration: none;
    animation: pop-in 0.6s var(--spring) both;
    transition:
      transform 0.4s var(--spring),
      box-shadow 0.3s;
  }
  .recent:hover,
  .recent:focus-visible {
    transform: translateY(-3px) rotate(-1deg);
    box-shadow: var(--shadow-lift);
  }
  .recent:focus-visible {
    outline: 3px solid var(--accent-2);
    outline-offset: 4px;
  }

  .preview {
    position: relative;
    flex: none;
    width: 96px;
    height: 64px;
  }
  .poster {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 38px;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: 2px solid white;
    border-radius: 3px;
    box-shadow: 0 8px 16px -8px color-mix(in srgb, var(--ink) 55%, transparent);
    transition: transform 0.5s var(--spring);
  }
  .place-1 {
    z-index: 1;
    width: 44px;
    transform: translateX(-50%);
  }
  .place-2 {
    transform: translateX(-100%) rotate(-9deg);
  }
  .place-3 {
    transform: translateX(0) rotate(9deg);
  }
  .recent:hover .place-1,
  .recent:focus-visible .place-1 {
    transform: translateX(-50%) translateY(-4px) scale(1.05);
  }
  .recent:hover .place-2,
  .recent:focus-visible .place-2 {
    transform: translateX(-108%) rotate(-13deg);
  }
  .recent:hover .place-3,
  .recent:focus-visible .place-3 {
    transform: translateX(8%) rotate(13deg);
  }

  .info {
    display: grid;
    justify-items: start;
    gap: 3px;
    min-width: 0;
  }
  .label {
    padding: 0.15em 0.6em;
    border-radius: 999px;
    background: var(--accent-2);
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .title {
    font-weight: 800;
    font-size: 17px;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .cta {
    color: var(--accent);
    font-weight: 700;
    font-size: 14px;
  }
</style>

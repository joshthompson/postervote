<script lang="ts">
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { posterSrc } from '$lib/utils/images';
  import { countryName, flag } from '$lib/utils/places';
  import type { LinkTo, Places } from './types';

  // Where the votes come from: a flag for each country with its vote count, then each busy
  // city's favourite poster in a sideways-scrolling carousel. Each favourite links to its poster
  // (see `linkTo`). Shows nothing until some votes have a location.

  let { places, linkTo }: { places: Places; linkTo: LinkTo } = $props();

  const t = $derived(i18n.t.results.places);
  // Pinned-up posters lean a little, each a different way.
  const TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5];

  let track = $state<HTMLElement>();
  let atStart = $state(true);
  let atEnd = $state(true);

  function edges() {
    if (!track) return;
    atStart = track.scrollLeft <= 1;
    atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  }

  /** Scroll by most of a view's worth of cards, snapping to the nearest one. */
  function page(dir: 1 | -1) {
    if (!track) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  }

  $effect(() => {
    void places.localPicks.length;
    edges();
  });
</script>

<svelte:window onresize={edges} />

{#if places.located}
  <section class="places">
    <h2><span class="legible">{t.title}</span></h2>
    <p class="note"><span class="legible">{t.note(places.located, places.countries.length)}</span></p>
    <ul class="countries">
      {#each places.countries as c (c.code)}
        <li>
          <span class="flag" aria-hidden="true">{flag(c.code)}</span>
          {countryName(c.code, i18n.lang)}
          <strong>{i18n.num(c.votes)}</strong>
        </li>
      {/each}
    </ul>

    {#if places.localPicks.length}
      <div class="local-head">
        <div>
          <h3><span class="legible">{t.localTitle}</span></h3>
          <p class="note"><span class="legible">{t.localNote(places.localMinVotes)}</span></p>
        </div>
        {#if !(atStart && atEnd)}
          <div class="arrows">
            <IconButton label={t.previous} muted={atStart} onclick={() => page(-1)}>
              <span class="arrow" aria-hidden="true">←</span>
            </IconButton>
            <IconButton label={t.next} muted={atEnd} onclick={() => page(1)}>
              <span class="arrow" aria-hidden="true">→</span>
            </IconButton>
          </div>
        {/if}
      </div>
      <ul class="picks" bind:this={track} onscroll={edges}>
        {#each places.localPicks as pick, i (`${pick.country}|${pick.city}`)}
          <li style="--i:{i}; --tilt:{TILTS[i % TILTS.length]}deg">
            <a class="pick" {...linkTo(pick.poster, 'local_picks')}>
              <span class="where">
                <span class="flag" aria-hidden="true">{flag(pick.country)}</span>
                <span class="city">{pick.city}</span>
              </span>
              <img src={posterSrc(pick.poster.image)} alt="" loading="lazy" />
              <span class="label">{t.localPick}</span>
              <strong class="title">{pick.poster.title}</strong>
              <span class="record">{t.wonThere(pick.wins, pick.matches)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .places {
    margin-bottom: 3rem;
  }
  h2 {
    font-size: clamp(30px, 4.4vw, 52px);
    letter-spacing: -0.04em;
    margin: 0 0 20px;
  }
  h3 {
    font-size: clamp(22px, 3vw, 30px);
    letter-spacing: -0.03em;
    margin: 36px 0 16px;
  }
  h2 .legible,
  h3 .legible {
    padding: 0.05em 0.4em 0.12em;
    border-radius: 0.3em;
  }
  .note {
    margin: -8px 0 20px;
    color: var(--muted);
    line-height: 2;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .countries {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .countries li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 8px 10px;
    border-radius: 99px;
    background: var(--glass);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 20px -16px color-mix(in srgb, var(--ink) 50%, transparent);
    font-size: 15px;
    animation: rise 0.6s var(--spring) both;
  }
  .countries strong {
    padding: 1px 8px;
    border-radius: 99px;
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
  }
  .flag {
    font-size: 22px;
    line-height: 1;
  }

  .local-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }
  .arrows {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  .arrow {
    font-size: 20px;
    line-height: 1;
  }
  .picks {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 190px;
    gap: 14px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    /* Room for the cards' shadows and hover lift, which the scroller would otherwise clip. */
    padding: 8px 16px 32px;
    margin: -8px -16px -32px;
    scroll-padding-inline: 16px;
  }
  .picks::-webkit-scrollbar {
    display: none;
  }
  .picks li {
    scroll-snap-align: start;
    animation: rise 0.7s var(--spring) both;
    animation-delay: calc(var(--i) * 0.08s);
  }
  .pick {
    display: grid;
    /* One column exactly as wide as the card, so long titles wrap instead of widening it. */
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    padding: 16px 14px 18px;
    border-radius: 22px;
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-card);
    color: inherit;
    text-decoration: none;
    text-align: center;
    transition:
      transform 0.35s var(--spring),
      box-shadow 0.35s;
  }
  /* Lift by whole pixels only: rotating or scaling text resamples it and it blurs. */
  .pick:hover {
    transform: translateY(-4px);
    box-shadow: 0 24px 44px -20px color-mix(in srgb, var(--ink) 50%, transparent);
  }
  .pick:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .where {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
  }
  .city {
    min-width: 0;
    font-weight: 800;
    font-size: 18px;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  img {
    width: 72%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: 4px solid white;
    border-radius: 6px;
    box-shadow: 0 14px 30px -14px color-mix(in srgb, var(--ink) 50%, transparent);
    margin: 4px 0;
    /* A pinned-up poster; only the image tilts, so no text is resampled. */
    rotate: var(--tilt);
  }
  .label {
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
  }
  @media (max-width: 560px) {
    .picks {
      grid-auto-columns: 160px;
    }
  }
  .title {
    max-width: 100%;
    font-size: 15px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .record {
    color: var(--muted);
    font-size: 13px;
  }
</style>

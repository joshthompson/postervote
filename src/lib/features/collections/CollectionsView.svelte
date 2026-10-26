<script lang="ts">
  import { resolve } from '$app/paths';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import Note from '$lib/features/results/Note.svelte';
  import ResultsHero from '$lib/features/results/ResultsHero.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track } from '$lib/services/analytics';
  import { posterSrc } from '$lib/utils/images';
  import { useCollections } from './data.svelte';

  // Every collection, the live one first and marked as live, then the closed ones, most recently
  // closed first (and in dev mode, drafts before them all). Each shows its top three fanned out as
  // a preview and links to its results.

  const collections = useCollections();
  const t = $derived(i18n.t.collections);
  const list = $derived(collections.data);
  const href = (slug: string) => resolve('/collections/[collection]', { collection: slug });
  // Second, first, third from left to right, as on the podium; the first sits in front.
  const fan = (top: { title: string; image: string }[]) =>
    [
      { poster: top[1], place: 2 },
      { poster: top[0], place: 1 },
      { poster: top[2], place: 3 }
    ].filter((p) => p.poster);
</script>

<svelte:head>
  <title>{t.title} · {i18n.t.brand}</title>
</svelte:head>

<ResultsHero heading={t.heading} sub={t.intro} />

{#if !list.length && collections.error}
  <Note>{t.loadError(collections.error.message)}</Note>
{:else if !list.length && !collections.complete}
  <div class="loading"><Loader /></div>
{:else if !list.length}
  <Note>{t.none}</Note>
{:else}
  <ul class="list">
    {#each list as c, i (c.slug)}
      <li class="entry" class:live={c.active} class:draft={c.draft} style="--i:{i}">
        {#if c.top.length}
          <div class="preview" aria-hidden="true">
            {#each fan(c.top) as { poster, place } (place)}
              <img class="poster place-{place}" src={posterSrc(poster.image)} alt="" loading="lazy" />
            {/each}
          </div>
        {/if}
        <div class="info">
          {#if c.draft}
            <p class="badge draft-badge">{t.draft} · {t.draftNote}</p>
          {:else if c.active}
            <p class="badge"><span class="dot" aria-hidden="true"></span>{t.live} · {t.votingNow}</p>
          {/if}
          <h2>
            <a
              href={href(c.slug)}
              onclick={() =>
                track('nav_link_clicked', { destination: 'collection', placement: 'collections_page', collection: c.slug })}
              >{c.title}</a
            >
          </h2>
          {#if !c.draft}
            <p class="period">{t.period(c.openedAt, c.active ? null : (c.closedAt ?? c.openedAt))}</p>
          {/if}
          <p class="numbers">{t.votes(c.votes)} · {t.posters(c.posters)}</p>
          {#if c.top[0] && !c.draft}
            <p class="winner"><span class="label">{c.active ? t.leading : t.winner}</span> {c.top[0].title}</p>
          {/if}
          {#if c.active}
            <div class="actions">
              <Pill
                variant="red"
                href={resolve('/')}
                onclick={() =>
                  track('nav_link_clicked', { destination: 'vote', placement: 'collections_page', collection: c.slug })}
                >{t.vote}</Pill
              >
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .loading {
    padding: 60px 0;
  }

  .list {
    display: grid;
    gap: clamp(20px, 3vw, 32px);
    max-width: 860px;
    margin: 0 auto;
    padding: 0;
    list-style: none;
  }

  /* The whole card is the link (its heading's link stretches over it); the vote pill sits above. */
  .entry {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    align-items: center;
    gap: clamp(16px, 4vw, 40px);
    padding: clamp(20px, 4vw, 36px);
    border: 3px solid transparent;
    border-radius: 26px;
    background: var(--card);
    box-shadow: var(--shadow-card);
    animation: rise 0.8s var(--spring) both;
    animation-delay: calc(0.2s + var(--i) * 0.1s);
    transition:
      transform 0.4s var(--spring),
      box-shadow 0.3s;
  }
  .entry:hover,
  .entry:focus-within {
    transform: translateY(-4px) rotate(-0.5deg);
    box-shadow: var(--shadow-lift);
  }
  .entry.live {
    border-color: var(--red);
  }
  .entry.draft {
    border: 3px dashed var(--muted);
  }
  /* Without a preview (no votes yet), the details take the whole card. */
  .entry:not(:has(.preview)) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 560px) {
    .entry {
      grid-template-columns: 1fr;
    }
  }

  .preview {
    position: relative;
    aspect-ratio: 4 / 3;
  }
  .poster {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 46%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: clamp(3px, 0.6vw, 6px) solid white;
    border-radius: 6px;
    box-shadow: 0 18px 36px -16px rgba(31, 26, 36, 0.55);
    transition: transform 0.5s var(--spring);
  }
  .place-1 {
    z-index: 1;
    width: 52%;
    transform: translateX(-50%);
  }
  .place-2 {
    transform: translateX(-100%) rotate(-9deg);
  }
  .place-3 {
    transform: translateX(0) rotate(9deg);
  }
  .entry:hover .place-1,
  .entry:focus-within .place-1 {
    transform: translateX(-50%) translateY(-6px) scale(1.04);
  }
  .entry:hover .place-2,
  .entry:focus-within .place-2 {
    transform: translateX(-108%) rotate(-13deg);
  }
  .entry:hover .place-3,
  .entry:focus-within .place-3 {
    transform: translateX(8%) rotate(13deg);
  }

  .info {
    display: grid;
    justify-items: start;
    gap: 6px;
  }
  .info p {
    margin: 0;
  }
  h2 {
    margin: 0 0 4px;
    font-size: clamp(22px, 3vw, 32px);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }
  h2 a {
    color: inherit;
    text-decoration: none;
  }
  h2 a::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 23px;
  }
  h2 a:focus-visible {
    outline: none;
  }
  h2 a:focus-visible::after {
    outline: 3px solid var(--yellow);
    outline-offset: 4px;
  }
  .period {
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .numbers {
    color: var(--muted);
  }
  .winner {
    margin-top: 6px !important;
    font-weight: 600;
  }
  .label {
    display: inline-block;
    margin-right: 4px;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    background: var(--yellow);
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .live .label {
    background: var(--ink);
    color: var(--paper);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.3em 0.9em;
    border-radius: 999px;
    background: var(--red);
    color: white;
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .draft-badge {
    background: var(--muted);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
      transform: scale(0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }

  .actions {
    position: relative;
    z-index: 1;
    margin-top: 10px;
  }
</style>

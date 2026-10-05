<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import type { Snippet } from 'svelte';
  import { api } from '$convex/api';
  import PixelText from '$lib/components/pixel/PixelText.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Meter from '$lib/components/ui/Meter.svelte';
  import ShareButton from '$lib/features/share/ShareButton.svelte';
  import type { ShareOutcome } from '$lib/features/share/share.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import type { Segment } from '$lib/i18n/locales/en';
  import { posterSrc } from '$lib/utils/images';
  import { countryName, flag } from '$lib/utils/places';
  import { pct } from './format';
  import { detail as hydrate, type PosterInfo } from './hydrate';
  import type { RankedPoster } from './types';

  // A ranked poster in full: the big image, its numbers, how it does with designers and everyone
  // else, and its record against each poster it has met. The rankings' modal passes `onclose` for
  // a close button and `shareHref` (the poster's page) for a share button in the corner, whose
  // shares `onshare` hears. The poster's own page has neither: its title is the page's heading,
  // with `links` under it.

  let {
    poster,
    segment,
    posterById,
    shareHref,
    onshare,
    onclose,
    links
  }: {
    poster: RankedPoster;
    segment: Segment;
    /** The competition's posters, to name the opponents. */
    posterById: Map<PosterInfo['_id'], PosterInfo>;
    shareHref?: string;
    onshare?: (outcome: ShareOutcome) => void;
    onclose?: () => void;
    /** Shown under the title. */
    links?: Snippet;
  } = $props();

  const SHOWN_OPPONENTS = 8;

  const t = $derived(i18n.t.results);
  const query = useQuery(api.results.poster, () => ({ id: poster._id, segment }));
  const detail = $derived({ data: query.data && hydrate(query.data, posterById) });

  const rate = (r: { wins: number; losses: number }) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : null);
  const groups = $derived(
    detail.data
      ? [
          { label: t.designers, rate: rate(detail.data.designers) },
          { label: t.others, rate: rate(detail.data.others) }
        ]
      : []
  );
</script>

<div class="panel">
  {#if shareHref || onclose}
    <div class="actions">
      {#if shareHref}<ShareButton href={shareHref} title={poster.title} {onshare} />{/if}
      {#if onclose}
        <IconButton label={t.detail.close} onclick={onclose}>
          <span class="x" aria-hidden="true"><PixelText text="×" px={1} color="currentColor" /></span>
        </IconButton>
      {/if}
    </div>
  {/if}

  <img class="poster" src={posterSrc(poster.image)} alt={poster.title} />

  <div class="info">
    <p class="rank">{t.detail.rank(poster.rank)}</p>
    <svelte:element
      this={onclose ? 'h2' : 'h1'}
      id="poster-detail-title"
      class="name"
      class:beside-one={!!shareHref !== !!onclose}
      class:beside-two={!!(shareHref && onclose)}
    >
      {poster.title}
    </svelte:element>
    {#if links}<div class="links">{@render links()}</div>{/if}

    <dl class="stats">
      <div>
        <dt>{t.detail.points}</dt>
        <dd>{poster.rating}</dd>
      </div>
      <div>
        <dt>{t.detail.record}</dt>
        <dd>{poster.wins}–{poster.losses}</dd>
      </div>
      <div>
        <dt>{t.detail.winRate}</dt>
        <dd>{poster.matches ? pct(poster.winRate) : '—'}</dd>
      </div>
    </dl>

    {#if !detail.data}
      <div class="loading"><Loader /></div>
    {:else}
      <section>
        <h3>{t.detail.byGroup}</h3>
        <ul class="groups">
          {#each groups as g (g.label)}
            <li>
              <span class="group">{g.label}</span>
              <Meter value={g.rate === null ? 0 : Math.max(2, g.rate * 100)} />
              <span class="figure" class:none={g.rate === null}>{g.rate === null ? t.detail.noVotes : pct(g.rate)}</span>
            </li>
          {/each}
        </ul>
      </section>

      {#if detail.data.fans.length}
        <section>
          <h3>{t.detail.fans}</h3>
          <ul class="fans">
            {#each detail.data.fans as f, i (`${f.country}|${f.city}`)}
              <li class:first={i === 0}>
                <span class="flag" aria-hidden="true">{flag(f.country)}</span>
                <span>{f.city ?? countryName(f.country, i18n.lang)}</span>
                <strong>{t.detail.fanWins(f.wins)}</strong>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section>
        <h3>{t.detail.headToHead}</h3>
        {#if !detail.data.opponents.length}
          <p class="empty">{t.detail.noMatches}</p>
        {:else}
          <ul class="opponents">
            {#each detail.data.opponents.slice(0, SHOWN_OPPONENTS) as o (o._id)}
              <li class:won={o.wins > o.losses} class:lost={o.wins < o.losses}>
                <img src={posterSrc(o.image)} alt="" loading="lazy" />
                <span class="title">{o.title}</span>
                <span class="score">{o.wins}–{o.losses}</span>
              </li>
            {/each}
          </ul>
          {#if detail.data.opponents.length > SHOWN_OPPONENTS}
            <p class="empty">{t.detail.more(detail.data.opponents.length - SHOWN_OPPONENTS)}</p>
          {/if}
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .panel {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: clamp(20px, 3vw, 32px);
    padding: clamp(20px, 3vw, 32px);
  }
  .actions {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    gap: 8px;
  }
  /* The drawn × sits 8 art px above the baseline, so its box has that much empty below it.
     Nudge it down by half (at 1 screen px per art px) to centre the cross in the button. */
  .x {
    display: flex;
    translate: 0 4px;
  }

  .poster {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 14px;
    box-shadow: var(--shadow-card);
  }

  .info {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 18px;
  }
  .rank {
    margin: 0;
    color: var(--red);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 13px;
  }
  .name {
    margin: -12px 0 0;
    font-size: clamp(24px, 3.4vw, 32px);
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* Clear of the buttons in the corner. */
  .beside-one {
    margin-right: 48px;
  }
  .beside-two {
    margin-right: 98px;
  }
  h3 {
    margin: 0 0 10px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 13px;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 0;
  }
  .stats div {
    padding: 12px;
    border-radius: 14px;
    background: rgba(31, 26, 36, 0.05);
  }
  dt {
    color: var(--muted);
    font-size: 12px;
  }
  dd {
    margin: 2px 0 0;
    font-weight: 800;
    font-size: 24px;
    letter-spacing: -0.03em;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .groups {
    display: grid;
    gap: 10px;
  }
  .groups li {
    display: grid;
    grid-template-columns: 7.5em 1fr 6em;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }
  .figure {
    text-align: right;
    font-weight: 700;
  }
  .figure.none {
    color: var(--muted);
    font-weight: 400;
    font-size: 12px;
  }

  .fans {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fans li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 8px;
    border-radius: 99px;
    background: rgba(31, 26, 36, 0.05);
    font-size: 14px;
  }
  .fans li.first {
    background: var(--yellow);
  }
  .fans strong {
    font-size: 12px;
  }
  .flag {
    font-size: 18px;
    line-height: 1;
  }

  .opponents {
    display: grid;
    gap: 6px;
  }
  .opponents li {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }
  .opponents img {
    width: 30px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }
  .title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .score {
    min-width: 3.2em;
    padding: 2px 8px;
    border-radius: 99px;
    background: rgba(31, 26, 36, 0.06);
    text-align: center;
    font-weight: 700;
  }
  .won .score {
    background: var(--red);
    color: #fff;
  }
  .lost .score {
    color: var(--muted);
  }

  .empty {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .loading {
    padding: 24px 0;
  }

  @media (max-width: 640px) {
    .panel {
      grid-template-columns: 1fr;
    }
    .poster {
      width: min(100%, 320px);
      margin: 0 auto;
    }
    .name {
      margin-top: 0;
    }
    .groups li {
      grid-template-columns: 6.5em 1fr 5.5em;
    }
  }
</style>

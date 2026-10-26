<script lang="ts">
  import { resolve } from '$app/paths';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { isArchived } from '$lib/features/collections/archives.svelte';
  import { useSnapshot } from '$lib/features/collections/data.svelte';
  import ShareButton from '$lib/features/share/ShareButton.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track } from '$lib/services/analytics';
  import { usePosters } from '$lib/services/posters.svelte';
  import { devMode } from '$lib/state/devMode.svelte';
  import { visibility } from '$lib/state/visibility.svelte';
  import Note from './Note.svelte';
  import PosterPanel from './PosterPanel.svelte';
  import { rank } from './hydrate';
  import { posterHref, posterNames } from './links';

  // A poster's own page, named by its collection's slug and its name (see links.ts): the same
  // detail as the rankings' modal, from everyone's votes, with a way back to the rankings and a
  // button to share it under its title.

  let { collection: slug, name }: { collection: string; name: string } = $props();

  const posterList = usePosters(() => slug);
  // Live queries pause while the tab has been in the background for a while (an archive never changes).
  const main = useSnapshot(
    () => (visibility.away && !isArchived(slug) ? 'skip' : { segment: 'all' as const, collection: slug }),
    { keepPreviousData: true }
  );

  const t = $derived(i18n.t.results);
  const posters = $derived(posterList.data ?? []);
  const posterById = $derived(new Map(posters.map((p) => [p._id, p])));
  const collection = $derived(main.data?.collection);
  // A draft's posters show only in dev mode (see devMode.svelte.ts).
  const hidden = $derived(!!collection?.draft && !devMode.on);
  const error = $derived(main.error ?? posterList.error);
  const id = $derived([...posterNames(posters)].find(([, n]) => n === name)?.[0]);
  // Undefined while loading; null if no poster in the collection has this name.
  const poster = $derived(
    main.data && posterList.data
      ? (rank(posters, main.data.snapshot?.scores ?? []).find((p) => p._id === id) ?? null)
      : undefined
  );
  const rankings = $derived(
    collection?.active === false ? resolve('/collections/[collection]', { collection: slug }) : resolve('/results')
  );
</script>

<svelte:head>
  <title>{poster ? `${poster.title} · ` : ''}{collection ? `${collection.title} · ` : ''}{i18n.t.brand}</title>
</svelte:head>

{#if error}
  <Note>{t.loadError(error.message)}</Note>
{:else if main.data === null || hidden}
  <Note>{t.noCollectionHere} <a href={resolve('/results')}>{t.seeCurrent}</a>.</Note>
{:else if poster === null}
  <Note>{t.detail.noPoster} <a href={rankings}>{t.detail.seeRankings}</a>.</Note>
{:else if poster && collection}
  <p class="collection">
    <span class="legible"
      >{collection.title}{collection.draft ? ` · ${t.draft}` : collection.active ? '' : ` · ${t.archived}`}</span
    >
  </p>
  <article class="card">
    <PosterPanel {poster} segment="all" collection={slug} {posterById}>
      {#snippet links()}
        <Pill variant="ink" href={rankings}>{t.detail.allRankings}</Pill>
        <ShareButton
          href={posterHref(slug, name)}
          title={poster.title}
          labelled
          onshare={(outcome) =>
            track('poster_shared', {
              collection: slug,
              poster_id: poster._id,
              poster_title: poster.title,
              placement: 'poster_page',
              outcome
            })}
        />
      {/snippet}
    </PosterPanel>
  </article>
{:else}
  <div class="loading"><Loader /></div>
{/if}

<style>
  .collection {
    max-width: 860px;
    margin: 0 auto 12px;
    animation: rise 0.8s var(--smooth) both;
    font-weight: 700;
    font-size: 13px;
    line-height: 2;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .card {
    max-width: 860px;
    margin: 0 auto;
    border-radius: 26px;
    background: var(--card);
    box-shadow: var(--shadow-lift);
    animation: rise 0.8s var(--spring) 0.1s both;
  }
  .loading {
    padding: 60px 0;
  }
</style>

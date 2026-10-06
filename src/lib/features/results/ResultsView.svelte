<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { untrack } from 'svelte';
  import { pushState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { api } from '$convex/api';
  import Loader from '$lib/components/ui/Loader.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track } from '$lib/services/analytics';
  import { usePosters } from '$lib/services/posters.svelte';
  import { visibility } from '$lib/state/visibility.svelte';
  import Disagreements from './Disagreements.svelte';
  import Highlights from './Highlights.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import Note from './Note.svelte';
  import Places from './Places.svelte';
  import Podium from './Podium.svelte';
  import PosterDetail from './PosterDetail.svelte';
  import ResultsHero from './ResultsHero.svelte';
  import StatTiles from './StatTiles.svelte';
  import ViewFilters from './ViewFilters.svelte';
  import { disagreements, overview } from './hydrate';
  import { plainClick, posterHref, posterNames } from './links';
  import type { ShareOutcome } from '$lib/features/share/share.svelte';
  import type { LinkTo, RankedPoster, View } from './types';

  // A competition's results: the active one, or the one named by `slug` (usually archived).
  // Each view reads its segment's snapshot (rebuilt at most every 15 minutes as votes come in), the
  // live vote counts, and the poster list the snapshots' ids are joined to. Disagreements
  // compares the designers' and non-designers' snapshots, with everyone's kept for the modal.

  let { slug }: { slug?: string } = $props();

  let view = $state<View>('all');
  // The voter group the rankings are showing (everyone's, behind the disagreements).
  const segment = $derived(view === 'disagree' ? 'all' : view);
  // Live queries pause while the tab has been in the background for a while.
  const live = <A,>(args: A) => (visibility.away ? ('skip' as const) : args);

  const posterList = usePosters(() => slug);
  const main = useQuery(api.results.snapshot, () => live({ segment, competition: slug }), { keepPreviousData: true });
  const counts = useQuery(api.results.live, () => live({ competition: slug }), { keepPreviousData: true });
  const designerSnap = useQuery(
    api.results.snapshot,
    () => (view === 'disagree' ? live({ segment: 'designers', competition: slug }) : 'skip'),
    { keepPreviousData: true }
  );
  const otherSnap = useQuery(
    api.results.snapshot,
    () => (view === 'disagree' ? live({ segment: 'others', competition: slug }) : 'skip'),
    { keepPreviousData: true }
  );

  const t = $derived(i18n.t.results);
  const posters = $derived(posterList.data ?? []);
  const posterById = $derived(new Map(posters.map((p) => [p._id, p])));
  const competition = $derived(main.data?.competition);
  const archived = $derived(competition?.active === false);
  const missing = $derived(main.data === null);
  const error = $derived(main.error ?? posterList.error ?? counts.error);
  // While a newly picked group loads, the last group's snapshot stays on screen (keepPreviousData),
  // and its live count has to stay with it: mixing them puts "today" off by the groups' difference.
  let shownSegment = $state(untrack(() => segment));
  $effect.pre(() => {
    if (main.data !== undefined && !main.isStale) shownSegment = segment;
  });
  const liveVotes = $derived(counts.data?.[shownSegment]);
  // Votes are in but the first tally hasn't finished yet.
  const tallying = $derived(!!main.data && !main.data.snapshot && (liveVotes ?? 0) > 0);
  const data = $derived(
    main.data && posterList.data && !tallying ? overview(posters, main.data.snapshot, liveVotes) : undefined
  );
  const split = $derived(
    view === 'disagree' &&
      competition &&
      posterList.data &&
      designerSnap.data !== undefined &&
      otherSnap.data !== undefined
      ? disagreements(posters, designerSnap.data?.snapshot ?? null, otherSnap.data?.snapshot ?? null)
      : undefined
  );
  const splitError = $derived(designerSnap.error ?? otherSnap.error);

  // Every poster links to its own page. A plain click opens it here in the modal instead, with
  // the page's URL in the address bar to share, and Back closes it (shallow routing). Only
  // shown once the competition has loaded, since the URL names it.
  const names = $derived(posterNames(posters));
  const hrefFor = (p: { _id: RankedPoster['_id'] }) => posterHref(competition!.slug, names.get(p._id)!);
  const linkTo: LinkTo = (p, placement) => {
    const href = hrefFor(p);
    return {
      href,
      onclick: (e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        pushState(href, { poster: p._id });
        track('poster_details_opened', {
          competition: competition!.slug,
          poster_id: p._id,
          poster_title: posterById.get(p._id)!.title,
          poster_rank: data?.posters.find((r) => r._id === p._id)?.rank,
          view,
          placement
        });
      }
    };
  };

  // The poster open in the modal, looked up in the live list so its numbers keep updating.
  const openPoster = $derived(data?.posters.find((p) => p._id === page.state.poster) ?? null);
  const openHref = $derived(openPoster && competition ? hrefFor(openPoster) : undefined);
  // Closing it goes back to the rankings' URL; after Back, it's already there.
  const onclose = () => page.state.poster && history.back();
  const onshare = (outcome: ShareOutcome) =>
    openPoster &&
    track('poster_shared', {
      competition: competition?.slug,
      poster_id: openPoster._id,
      poster_title: openPoster.title,
      placement: 'rankings_modal',
      outcome
    });

  const sub = $derived.by(() => {
    if (missing) return slug ? t.noCompetitionHere : t.noCompetition;
    if (view === 'disagree') return t.disagreeSub;
    if (!data) return t.tallying;
    return archived ? t.final(data.stats.totalVotes, segment) : t.live(data.stats.totalVotes, segment);
  });

  const stats = $derived.by(() => {
    if (!data) return [];
    const s = data.stats;
    const coverage = s.possiblePairs ? (s.pairsSeen / s.possiblePairs) * 100 : 0;
    return [
      { label: t.stats.votes, value: s.totalVotes },
      { label: t.stats.voters, value: s.voters },
      { label: t.stats.posters, value: s.posterCount },
      { label: t.stats.today, value: s.today },
      { label: t.stats.explored, value: coverage, decimals: coverage < 10 ? 1 : 0, suffix: '%' }
    ];
  });
</script>

<svelte:head>
  <title>{competition ? `${competition.title} · ` : ''}{t.title} · {i18n.t.brand}</title>
</svelte:head>

<ResultsHero
  heading={t.heading}
  competition={competition && `${competition.title}${archived ? ` · ${t.archived}` : ''}`}
  {sub}
/>

{#if missing}
  <Note><a href={resolve('/results')}>{t.seeCurrent}</a>.</Note>
{:else}
  <ViewFilters
    bind:value={view}
    onchange={(v, previous) =>
      track('rankings_view_changed', { competition: competition?.slug, view: v, previous_view: previous })}
  />

  {#if view === 'disagree'}
    {#if splitError}
      <Note>{t.loadError(splitError.message)}</Note>
    {:else if !split}
      <div class="loading"><Loader /></div>
    {:else if !split.posters.length}
      <Note>{t.notEnough(split.minMatches, split.designerVotes, split.otherVotes)}</Note>
    {:else}
      <Disagreements posters={split.posters} {linkTo} />
    {/if}
  {:else if error}
    <Note>{t.loadError(error.message)}</Note>
  {:else if data}
    <StatTiles {stats} />

    {#if data.stats.totalVotes === 0}
      <Note>
        {#if archived}
          {t.noVotesArchived(segment)}
        {:else if view === 'all'}
          {t.noVotesYet[0]}<a href={resolve('/')}>{t.noVotesYet[1]}</a>{t.noVotesYet[2]}
        {:else}
          {t.noVotesSegment(segment)}
        {/if}
      </Note>
    {:else}
      <Podium top={data.posters.slice(0, 3)} {linkTo} />
      <Highlights closest={data.closest} lopsided={data.lopsided} />
      <Places places={data.places} {linkTo} />
    {/if}

    <Leaderboard posters={data.posters} {linkTo} />
  {:else}
    <div class="loading"><Loader /></div>
  {/if}
{/if}

<PosterDetail poster={openPoster} {segment} {posterById} shareHref={openHref} {onshare} {onclose} />

<style>
  .loading {
    padding: 60px 0;
  }
</style>

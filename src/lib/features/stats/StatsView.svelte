<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { api } from '$convex/api';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import ChartCard from '$lib/features/results/ChartCard.svelte';
  import StatTiles from '$lib/features/results/StatTiles.svelte';
  import { visibility } from '$lib/state/visibility.svelte';
  import StackedBars from './StackedBars.svelte';
  import VoteMap from './VoteMap.svelte';
  import { busiestHour, byDay, byDepth, byHourOfDay, depthSummary, GROUPS, splitOf, total } from './series';

  // Our numbers for a competition (the active one by default): votes per day and by hour of the
  // day, where they come from, how many votes each voter casts, and the tally's state. Read from
  // the tallies, so the charts are up to 15 minutes behind; the vote count ticks live. English
  // only, as it's just for us.

  let slug = $state<string | undefined>(undefined);
  // Live queries pause while the tab has been in the background for a while.
  const live = <A,>(args: A) => (visibility.away ? ('skip' as const) : args);

  const stats = useQuery(api.stats.overview, () => live({ competition: slug }), { keepPreviousData: true });
  const counts = useQuery(api.results.live, () => live({ competition: slug }), { keepPreviousData: true });
  const archived = useQuery(api.competitions.archived, {});

  // Ticks the "minutes ago" along.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const data = $derived(stats.data);
  const hours = $derived(data?.hours ?? []);
  const active = $derived(data?.competition.active ?? false);
  const days = $derived(byDay(hours, active ? now : 0));
  const clock = $derived(byHourOfDay(hours));
  const depth = $derived(data?.depth ? byDepth(data.depth) : []);
  const depthStats = $derived(data?.depth ? depthSummary(data.depth) : null);
  // "Not asked" only has a place when some votes came before the designer question.
  const groups = $derived(GROUPS.filter((g) => g !== 'unknown' || hours.some((h) => splitOf(h).unknown > 0)));
  const depthGroups = $derived(GROUPS.filter((g) => g !== 'unknown' || data?.depth?.some((d) => d.unknown > 0)));

  const tallied = $derived(data?.counts?.all);
  const votes = $derived(counts.data?.all ?? tallied?.votes ?? 0);
  const waiting = $derived(Math.max(0, votes - (tallied?.votes ?? 0)));
  const possiblePairs = $derived(((data?.posters ?? 0) * ((data?.posters ?? 0) - 1)) / 2);
  const today = $derived(days.find((d) => d.marked));
  const best = $derived(days.reduce<(typeof days)[number] | null>((b, d) => (!b || total(d.values) > total(b.values) ? d : b), null));
  const peakSlot = $derived(clock.reduce((b, d) => (total(d.values) > total(b.values) ? d : b), clock[0]));
  const busiest = $derived(busiestHour(hours));
  const designerShare = $derived.by(() => {
    const c = data?.counts;
    const asked = c ? c.designers.votes + c.others.votes : 0;
    return asked ? (c!.designers.votes / asked) * 100 : 0;
  });

  const tiles = $derived([
    { label: 'Votes', value: votes },
    { label: 'Voters', value: tallied?.voters ?? 0 },
    { label: 'Votes per voter', value: tallied?.voters ? (tallied.votes / tallied.voters) : 0, decimals: 1 },
    ...(active ? [{ label: 'Votes today', value: today ? total(today.values) : 0 }] : []),
    { label: 'Pairs met', value: possiblePairs ? Math.min(100, ((tallied?.pairs ?? 0) / possiblePairs) * 100) : 0, suffix: '%' },
    { label: 'Cities', value: tallied?.cities ?? 0 }
  ]);

  const num = (n: number) => n.toLocaleString('en-GB');
  const pct = (n: number) => `${Math.round(n)}%`;
  function ago(at: number) {
    const min = Math.round((now - at) / 60_000);
    return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
  }
  function inFuture(at: number) {
    const min = Math.round((at - now) / 60_000);
    return min < 1 ? 'any moment' : `in ${min} min`;
  }
</script>

{#if archived.data?.length}
  <nav class="picker" aria-label="Competition">
    <Pill variant={slug ? 'outline' : 'ink'} pressed={!slug} onclick={() => (slug = undefined)}>Current</Pill>
    {#each archived.data as c (c.slug)}
      <Pill variant={slug === c.slug ? 'ink' : 'outline'} pressed={slug === c.slug} onclick={() => (slug = c.slug)}>{c.title}</Pill>
    {/each}
  </nav>
{/if}

{#if stats.error}
  <p class="message">Couldn't load the stats: {stats.error.message}</p>
{:else if data === undefined}
  <Loader />
{:else if data === null}
  <p class="message">No competition yet. Sync some posters first.</p>
{:else}
  <p class="heading">
    <strong>{data.competition.title}</strong>
    {#if data.tally}
      · {data.tally.clearing ? 'Recounting' : `Tallied ${ago(data.tally.lastRunAt)}`}
      {#if waiting}· {num(waiting)} {waiting === 1 ? 'vote' : 'votes'} waiting{/if}
      {#if data.tally.pending}· next run {inFuture(data.tally.scheduledFor)}{/if}
    {/if}
  </p>

  <StatTiles stats={tiles} />

  {#if !hours.length}
    <p class="message">No votes tallied yet.</p>
  {:else}
    <ChartCard
      title="Votes per day"
      note="Days from your midnight. The tally adds votes in batches, so today's bar is up to 15 minutes behind."
    >
      <StackedBars bars={days} {groups} unit="votes" labelWidth={60} />
    </ChartCard>

    <ChartCard title="When people vote" note="Every vote so far by the hour it was cast, your time. Busiest: {peakSlot.title}.">
      <StackedBars bars={clock} {groups} unit="votes" height={200} labelWidth={30} />
    </ChartCard>

    {#if data.countries.length}
      <ChartCard
        title="Where votes come from"
        note="Votes by the country they were cast from, looked up in the voter's browser. {num(data.countries.length)} {data.countries.length === 1 ? 'country' : 'countries'} so far."
      >
        <VoteMap countries={data.countries} />
      </ChartCard>
    {/if}

    {#if depth.length && depthStats}
      <ChartCard
        title="How far people get"
        note="Voters by how many votes they've cast. Half stop by {num(depthStats.median)}; {pct(depthStats.onceShare * 100)} stop after one; the keenest has cast {num(depthStats.max)}.{data.posters ? ` Seeing every poster takes about ${num(Math.ceil(data.posters / 2))}.` : ''}"
      >
        <StackedBars bars={depth} groups={depthGroups} unit="voters" height={220} labelWidth={46} />
      </ChartCard>
    {:else if !data.depth}
      <p class="message">Too many voters to count how far each one gets.</p>
    {/if}

    <ChartCard title="Odds and ends">
      <dl>
        {#if best}<dt>Best day</dt><dd>{best.title}: {num(total(best.values))} votes</dd>{/if}
        {#if busiest}<dt>Busiest hour</dt><dd>{busiest.label}: {num(busiest.votes)} votes</dd>{/if}
        {#if data.counts}
          <dt>Designers' share</dt><dd>{pct(designerShare)} of votes from people who answered</dd>
          <dt>Voters who answered</dt>
          <dd>{num(data.counts.designers.voters)} designers, {num(data.counts.others.voters)} non-designers</dd>
          <dt>Pairs met</dt><dd>{num(data.counts.all.pairs)} of {num(possiblePairs)} possible, among {num(data.posters)} posters</dd>
          <dt>With a place</dt>
          <dd>{pct(data.counts.all.votes ? (data.counts.all.located / data.counts.all.votes) * 100 : 0)} of votes, from {num(data.counts.all.cities)} cities</dd>
        {/if}
      </dl>
    </ChartCard>
  {/if}
{/if}

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .heading {
    margin: 0 0 24px;
    text-align: center;
    color: var(--muted);
    font-weight: 600;
  }
  .heading strong {
    color: var(--ink);
  }
  .message {
    text-align: center;
    color: var(--muted);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 10px 20px;
    margin: 4px;
  }
  dt {
    font-weight: 700;
  }
  dd {
    margin: 0;
    color: var(--muted);
  }
  @media (max-width: 560px) {
    dl {
      grid-template-columns: 1fr;
      gap: 2px;
    }
    dd {
      margin-bottom: 10px;
    }
  }
</style>

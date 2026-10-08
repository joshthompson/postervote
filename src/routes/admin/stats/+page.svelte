<script lang="ts">
  import Page from '$lib/components/layout/Page.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import StatsView from '$lib/features/stats/StatsView.svelte';

  // A hidden page of our own numbers. Like /admin/share, nothing links here, search engines are
  // asked to skip it, its visits aren't counted (see +layout.svelte), and there's no sign-in.
</script>

<svelte:head>
  <title>Stats · Poster Vote</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page width="wide">
  <PageTitle text="Stats" color="var(--red)" />
  <StatsView />
</Page>

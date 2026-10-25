<script lang="ts">
  import Page from '$lib/components/layout/Page.svelte';
  import ResultsView from '$lib/features/results/ResultsView.svelte';
  import type { PageProps } from './$types';

  let { params }: PageProps = $props();
</script>

<!-- /collections/<slug>: one collection's results, live from Convex or from its archive. -->
<Page width="wide">
  <ResultsView slug={params.collection} />
</Page>

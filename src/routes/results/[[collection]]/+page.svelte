<script lang="ts">
  import Page from '$lib/components/layout/Page.svelte';
  import ResultsView from '$lib/features/results/ResultsView.svelte';
</script>

<!-- The live collection's rankings. /results/<slug> redirects to /collections/<slug> (see +page.ts). -->
<Page width="wide">
  <ResultsView />
</Page>

<script lang="ts">
  import Page from '$lib/components/layout/Page.svelte';
  import PosterView from '$lib/features/results/PosterView.svelte';
  import type { PageProps } from './$types';

  let { params }: PageProps = $props();
</script>

<!-- /poster/<collection slug>/<poster name>: one poster's own page, to link to. -->
<Page width="wide">
  <PosterView collection={params.collection} name={params.name} />
</Page>

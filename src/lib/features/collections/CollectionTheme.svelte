<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api } from '$convex/api';
  import PolkaDots from '$lib/components/layout/PolkaDots.svelte';
  import { storage } from '$lib/services/storage';
  import { applyPalette, paletteFor } from './palettes';

  // The page's colours and polka dots, in the palette of the collection it's about: the one in its
  // address (a collection's rankings, a poster's page), or else the live one. The live one's slug is
  // remembered, so a return visit starts in its colours instead of changing once Convex answers.
  // Changing palette fades the colours, and each dot takes the new ones as it next comes back.

  const KEY = 'liveCollection';
  let remembered = storage.get(KEY);
  const live = useQuery(api.collections.live, {});
  $effect(() => {
    const slug = live.data;
    if (slug === undefined || slug === remembered) return;
    remembered = slug;
    if (slug) storage.set(KEY, slug);
    else storage.remove(KEY);
  });

  const palette = $derived(paletteFor(page.params.collection ?? (live.data === undefined ? remembered : live.data)));

  const root = document.documentElement;
  // Before the first paint, without fading.
  // svelte-ignore state_referenced_locally
  applyPalette(root, palette);
  $effect(() => {
    applyPalette(root, palette);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.paper);
  });
  onMount(() => {
    const frame = requestAnimationFrame(() => (root.dataset.themed = ''));
    return () => cancelAnimationFrame(frame);
  });
</script>

<PolkaDots colors={palette.dots} />

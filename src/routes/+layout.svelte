<script lang="ts">
  import { PUBLIC_CONVEX_URL } from '$env/static/public';
  import { setupConvex } from 'convex-svelte';
  import { afterNavigate } from '$app/navigation';
  import CoffeeButton from '$lib/components/layout/CoffeeButton.svelte';
  import PolkaDots from '$lib/components/layout/PolkaDots.svelte';
  import SetupNotice from '$lib/components/layout/SetupNotice.svelte';
  import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
  import SiteShareButton from '$lib/features/share/SiteShareButton.svelte';
  import { trackPageview } from '$lib/services/analytics';
  import { sound } from '$lib/services/sound.svelte';
  import { exposeDevMode } from '$lib/state/devMode.svelte';
  import '$lib/styles/index.css';

  let { children } = $props();

  exposeDevMode();

  const configured = Boolean(PUBLIC_CONVEX_URL);
  if (configured) setupConvex(PUBLIC_CONVEX_URL);

  // The first page and every navigation after it. Opening a poster from the rankings changes the
  // URL without navigating, so it isn't one (it's `poster_details_opened`). Our own pages under
  // /admin aren't counted: visitors never see them.
  afterNavigate(({ to }) => {
    if (to?.route.id?.startsWith('/admin')) return;
    trackPageview({ route: to?.route.id ?? undefined, collection: to?.params?.collection });
  });
</script>

<!-- Browsers only allow audio after a gesture, so the first click or key press starts it. -->
<svelte:window onpointerdown={() => sound.unlock()} onkeydown={() => sound.unlock()} />

<PolkaDots />
<SiteHeader withMenu={configured} />

<main>
  {#if configured}
    {@render children()}
  {:else}
    <SetupNotice />
  {/if}
</main>
<CoffeeButton />
<SiteShareButton />

<style>
  main {
    position: relative;
    z-index: 1;
  }
</style>

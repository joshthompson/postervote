<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Page from '$lib/components/layout/Page.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';

  // Hidden pages for handing the site out: links tagged with where they're handed out and QR codes
  // for them, and posters with a QR code to print and put up. Nothing links here, search engines are
  // asked to skip them, their visits aren't counted (see the root +layout.svelte), and there's no
  // sign-in. Each keeps what's filled in in its address, so a link to it opens it filled in. See
  // "Sources" in AGENTS.md for the values. English only, as they're just for us.

  let { children } = $props();

  const TABS = [
    { label: 'Links and QR codes', title: 'Share links', route: '/admin/share' },
    { label: 'Posters', title: 'Posters', route: '/admin/share/poster' }
  ] as const;
  const current = $derived(TABS.find((t) => t.route === page.route.id) ?? TABS[0]);
</script>

<svelte:head>
  <title>{current.title} · Poster Vote</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page width="wide">
  <PageTitle text={current.title} color="var(--accent)" />
  <nav class="tabs" aria-label="Make">
    {#each TABS as tab (tab.route)}
      <Pill href={resolve(tab.route)} variant={tab === current ? 'ink' : 'outline'}>{tab.label}</Pill>
    {/each}
  </nav>
  {@render children()}
</Page>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 0 0 24px;
  }
</style>

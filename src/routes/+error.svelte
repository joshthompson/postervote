<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import Page from '$lib/components/layout/Page.svelte';
  import ButtonRow from '$lib/components/ui/ButtonRow.svelte';
  import MessageCard from '$lib/components/ui/MessageCard.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track, type NavDestination } from '$lib/services/analytics';

  // A link that goes nowhere (the static host serves 404.html, and the router finds no page), or
  // a page that broke while loading. The status is the big pixel heading.

  const t = $derived(i18n.t.error);
  const notFound = $derived(page.status === 404);

  const go = (destination: NavDestination) => () => track('nav_link_clicked', { destination, placement: 'error_page' });
</script>

<svelte:head>
  <title>{notFound ? t.notFoundTitle : t.title} · {i18n.t.brand}</title>
</svelte:head>

<Page>
  <PageTitle text={String(page.status)} color="var(--accent)" />
  <div class="center">
    <MessageCard title={notFound ? t.notFoundTitle : t.title}>
      <p>{notFound ? t.notFoundBody : t.body}</p>
      <ButtonRow>
        <Pill variant="red" href={resolve('/')} onclick={go('vote')}>{t.vote}</Pill>
        <Pill href={resolve('/results')} onclick={go('rankings')}>{t.rankings}</Pill>
      </ButtonRow>
    </MessageCard>
  </div>
</Page>

<style>
  .center {
    display: flex;
    justify-content: center;
  }
  p {
    margin: 0 0 20px;
    line-height: 1.5;
  }
</style>

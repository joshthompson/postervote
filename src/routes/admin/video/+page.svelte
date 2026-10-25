<script lang="ts">
  import Page from '$lib/components/layout/Page.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import VideoStudio from '$lib/features/video/VideoStudio.svelte';

  // A hidden page that plays a collection's winner video, to screen-record for Instagram. Like
  // /admin/share, nothing links here, search engines are asked to skip it, its visits aren't
  // counted (see +layout.svelte), and there's no sign-in.
</script>

<svelte:head>
  <title>Video · Poster Vote</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page>
  <PageTitle text="Video" color="var(--red)" />
  <VideoStudio />
</Page>

<script lang="ts">
  import VideoRender from '$lib/features/video/VideoRender.svelte';

  // The winner video, for `pnpm video` to render frame by frame (see VideoRender). Hidden like
  // the other /admin pages; open /admin/video to preview it instead.
</script>

<svelte:head>
  <title>Video render · Poster Vote</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<VideoRender />

<script lang="ts">
  import type { ShareOutcome } from '$lib/features/share/share.svelte';
  import type { Segment } from '$lib/i18n/locales/en';
  import type { PosterInfo } from './hydrate';
  import PosterPanel from './PosterPanel.svelte';
  import type { RankedPoster } from './types';

  // A ranked poster opened in a modal (see PosterPanel). Closes on Escape, the close button, or
  // a click on the backdrop.

  let {
    poster,
    segment,
    collection,
    posterById,
    shareHref,
    onshare,
    onclose
  }: {
    poster: RankedPoster | null;
    segment: Segment;
    /** Its collection's slug; undefined for the active one. */
    collection?: string;
    /** The collection's posters, to name the opponents. */
    posterById: Map<PosterInfo['_id'], PosterInfo>;
    /** The open poster's page, to share. */
    shareHref?: string;
    /** How each share of it ended. */
    onshare?: (outcome: ShareOutcome) => void;
    onclose: () => void;
  } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (poster && !dialog.open) dialog.showModal();
    else if (!poster && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="poster-detail-title"
  onclose={onclose}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  {#if poster}
    <PosterPanel {poster} {segment} {collection} {posterById} {shareHref} {onshare} onclose={() => dialog.close()} />
  {/if}
</dialog>

<style>
  dialog {
    width: min(860px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    padding: 0;
    border: 0;
    border-radius: 26px;
    background: var(--card);
    color: var(--ink);
    box-shadow: var(--shadow-lift);
    overflow: auto;
  }
  dialog[open] {
    animation: pop 0.4s var(--spring);
  }
  dialog::backdrop {
    background: rgba(31, 26, 36, 0.55);
    backdrop-filter: blur(4px);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
</style>

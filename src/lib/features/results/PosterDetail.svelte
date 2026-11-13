<script lang="ts">
  import PixelText from '$lib/components/pixel/PixelText.svelte';
  import type { ShareOutcome } from '$lib/features/share/share.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import type { Segment } from '$lib/i18n/locales/en';
  import type { PosterInfo } from './hydrate';
  import PosterPanel from './PosterPanel.svelte';
  import type { RankedPoster } from './types';

  // A ranked poster opened in a modal (see PosterPanel). Closes on Escape, the close button, or
  // a click on the backdrop. The arrows beside it, or the ← and → keys, step to the poster before
  // or after it in the list it was opened from; `previous` / `next` are left out at either end.

  type Step = (method: 'click' | 'keyboard') => void;

  let {
    poster,
    segment,
    collection,
    posterById,
    shareHref,
    onshare,
    onclose,
    previous,
    next
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
    /** Opens the poster before this one. */
    previous?: Step;
    /** Opens the poster after this one. */
    next?: Step;
  } = $props();

  const t = $derived(i18n.t.results.detail);

  let dialog: HTMLDialogElement;
  let card = $state<HTMLElement>();

  $effect(() => {
    if (poster && !dialog.open) dialog.showModal();
    else if (!poster && dialog.open) dialog.close();
  });

  // Each poster starts at its top.
  $effect(() => {
    if (poster?._id) card?.scrollTo(0, 0);
  });

  // On the window, not the dialog, so the keys still work once a step button at the end of the
  // list is disabled and drops focus.
  const onkeydown = (e: KeyboardEvent) => {
    if (!dialog.open || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const step = e.key === 'ArrowLeft' ? previous : e.key === 'ArrowRight' ? next : undefined;
    if (!step) return;
    e.preventDefault();
    step('keyboard');
  };
</script>

<svelte:window {onkeydown} />

<dialog
  bind:this={dialog}
  aria-labelledby="poster-detail-title"
  onclose={onclose}
  onclick={(e) => !(e.target as Element).closest('.card, .step') && dialog.close()}
>
  {#if poster}
    <div class="frame">
      <button class="step previous" aria-label={t.previous} title={t.previous} disabled={!previous} onclick={() => previous?.('click')}>
        <PixelText text="←" px={1} color="currentColor" />
      </button>
      <div class="card" bind:this={card}>
        <PosterPanel {poster} {segment} {collection} {posterById} {shareHref} {onshare} onclose={() => dialog.close()} />
      </div>
      <button class="step next" aria-label={t.next} title={t.next} disabled={!next} onclick={() => next?.('click')}>
        <PixelText text="→" px={1} color="currentColor" />
      </button>
    </div>
  {/if}
</dialog>

<style>
  /* The dialog fills the screen, so the arrows can sit outside the card: beside it on a wide
     screen, under it on a narrow one. A click anywhere outside the card and arrows closes it. */
  dialog {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 16px;
    border: 0;
    background: none;
    color: var(--ink);
    overflow: hidden;
  }
  dialog::backdrop {
    background: color-mix(in srgb, var(--ink) 55%, transparent);
    backdrop-filter: blur(4px);
  }
  .frame {
    height: 100%;
    display: grid;
    grid-template: 'previous card next' auto / 1fr minmax(0, 860px) 1fr;
    align-content: center;
    align-items: center;
    gap: 16px;
    animation: pop 0.4s var(--spring);
  }
  .card {
    grid-area: card;
    max-height: calc(100dvh - 32px);
    border-radius: 26px;
    background: var(--card);
    box-shadow: var(--shadow-lift);
    overflow: auto;
  }

  .step {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--card);
    color: var(--ink);
    box-shadow: var(--shadow-lift);
    cursor: pointer;
    transition:
      transform 0.25s var(--spring),
      background 0.2s,
      color 0.2s,
      opacity 0.2s;
  }
  .step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .step:not(:disabled):hover {
    background: var(--accent);
    color: #fff;
  }
  .previous {
    grid-area: previous;
    justify-self: end;
  }
  .previous:not(:disabled):hover {
    transform: translateX(-3px) scale(1.08);
  }
  .next {
    grid-area: next;
    justify-self: start;
  }
  .next:not(:disabled):hover {
    transform: translateX(3px) scale(1.08);
  }

  @media (max-width: 900px) {
    .frame {
      grid-template:
        'card card' minmax(0, auto)
        'previous next' auto / 1fr 1fr;
      gap: 12px;
    }
    .card {
      max-height: calc(100dvh - 32px - 12px - 52px);
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
</style>

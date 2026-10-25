<script lang="ts">
  import type { Snippet } from 'svelte';
  import PolkaDots from '$lib/components/layout/PolkaDots.svelte';
  import { AT, BEAT_MS, HEIGHT, WIDTH } from './timeline';

  // The video's frame over a black screen that covers the whole page, header and all: the
  // polka dots, with the reel on top (`children`), as large as fits the window. In a window the
  // video's size, that's one CSS pixel per video pixel. `hint` sits in the black under it.
  // `startAt` is when the video starts (a performance.now() time), so the dots loop with it.

  let { startAt, children, hint }: { startAt?: number; children?: Snippet; hint?: Snippet } = $props();
  const loop = $derived(startAt === undefined ? undefined : { start: startAt, seconds: (AT.end * BEAT_MS) / 1000 });

  let innerWidth = $state(WIDTH);
  let innerHeight = $state(HEIGHT);
  const scale = $derived(Math.min(innerWidth / WIDTH, innerHeight / HEIGHT));

  /** Moves the screen to the end of the page, over the header and everything else. */
  const toBody = (node: HTMLElement) => {
    document.body.append(node);
    return () => node.remove();
  };
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="screen" {@attach toBody}>
  <div
    class="stage"
    style="width: {WIDTH}px; height: {HEIGHT}px; left: {Math.round((innerWidth - WIDTH) / 2)}px; top: {Math.round(
      (innerHeight - HEIGHT) / 2
    )}px; transform: scale({scale})"
  >
    <PolkaDots contained interactive={false} {loop} />
    {@render children?.()}
  </div>
  {#if hint}<p class="hint">{@render hint()}</p>{/if}
</div>

<style>
  /* Everything but the video is black, and the pointer is hidden over it. */
  .screen {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: black;
    cursor: none;
  }
  .stage {
    position: absolute;
    overflow: hidden;
    isolation: isolate;
    background: var(--paper);
  }
  .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 16px;
    margin: 0;
    color: #888;
    font-size: 14px;
    text-align: center;
  }
  .hint :global(kbd) {
    padding: 0.05em 0.4em;
    border: 1px solid currentColor;
    border-radius: 4px;
    font: inherit;
    font-size: 0.9em;
  }
</style>

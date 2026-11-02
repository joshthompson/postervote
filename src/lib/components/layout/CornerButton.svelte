<script lang="ts">
  import type { Snippet } from 'svelte';
  import Tooltip from '$lib/components/ui/Tooltip.svelte';

  // A small outlined square that sways in a bottom corner of the screen, holding an icon and
  // named by a tooltip towards the middle on hover. A link (opening in a new tab) when given
  // `href`, otherwise a button; either way `onclick` hears clicks on it. `background` fills the
  // square behind the icon.

  let {
    corner,
    label,
    href,
    onclick,
    background = 'var(--card)',
    children
  }: {
    corner: 'left' | 'right';
    label: string;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    background?: string;
    children: Snippet;
  } = $props();
</script>

{#snippet square()}
  <span class="square" style:background>{@render children()}</span>
{/snippet}

<div class="floating {corner}">
  <Tooltip text={label} side={corner === 'left' ? 'right' : 'left'}>
    {#if href}
      <a class="corner" {href} target="_blank" rel="noopener" aria-label={label} {onclick}>{@render square()}</a>
    {:else}
      <button class="corner" {onclick} aria-label={label}>{@render square()}</button>
    {/if}
  </Tooltip>
</div>

<style>
  .floating {
    position: fixed;
    bottom: max(clamp(16px, 2.5vw, 28px), env(safe-area-inset-bottom));
    z-index: 10;
  }
  .left {
    left: max(clamp(16px, 3vw, 36px), env(safe-area-inset-left));
  }
  .right {
    right: max(clamp(16px, 3vw, 36px), env(safe-area-inset-right));
  }

  .corner {
    display: block;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .corner:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
  }
  .square {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    animation: sway 3s ease-in-out infinite alternate;
    transition: scale 0.25s var(--spring);
  }
  /* The right one sways the other way, mirroring the left. */
  .right .square {
    animation-direction: alternate-reverse;
  }
  /* `scale` adds to the sway's `transform` rather than replacing it. */
  .corner:hover .square {
    scale: 1.1;
  }
  @keyframes sway {
    from {
      transform: rotate(-5deg);
    }
    to {
      transform: rotate(5deg);
    }
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // A small rounded text button, or a link when given `href` (with `download`, one that saves the
  // file under that name).
  // `ink` is solid dark, `red` is the call to action, `outline` is the quiet option.
  // `pressed` marks the selected option in a group of toggles.

  let {
    href,
    download,
    onclick,
    variant = 'outline',
    pressed,
    children
  }: {
    href?: string;
    download?: string;
    onclick?: (e: MouseEvent) => void;
    variant?: 'ink' | 'red' | 'outline';
    pressed?: boolean;
    children: Snippet;
  } = $props();
</script>

{#if href}
  <a class="pill {variant}" {href} {download} {onclick}>{@render children()}</a>
{:else}
  <button class="pill {variant}" {onclick} aria-pressed={pressed}>{@render children()}</button>
{/if}

<style>
  .pill {
    display: inline-block;
    padding: 0.55em 1.1em;
    border: 2px solid transparent;
    border-radius: 999px;
    font-weight: 700;
    font-size: 15px;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform 0.25s var(--spring),
      background 0.2s,
      border-color 0.2s,
      color 0.2s;
    -webkit-tap-highlight-color: transparent;
  }
  @media (max-width: 560px) {
    .pill {
      padding: 0.45em 0.85em;
      font-size: 13px;
    }
  }
  .pill:hover {
    transform: translateY(-2px) rotate(-2deg) scale(1.05);
  }
  .pill:focus-visible {
    outline: 3px solid var(--accent-2);
    outline-offset: 3px;
  }

  .ink {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .ink:hover {
    background: var(--accent);
    border-color: var(--accent);
  }
  .red {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .outline {
    background: color-mix(in srgb, var(--paper) 80%, transparent);
    backdrop-filter: blur(6px);
    border-color: var(--ink);
    color: var(--ink);
  }
  .outline:hover {
    background: white;
  }
</style>

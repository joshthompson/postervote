<script lang="ts">
  import type { Snippet } from 'svelte';

  // Round dark button holding an icon. `label` names it for screen readers and tooltips;
  // `muted` greys it out to show an "off" state.

  let {
    label,
    onclick,
    pressed,
    expanded,
    controls,
    muted = false,
    children
  }: {
    label: string;
    onclick?: (e: MouseEvent) => void;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    muted?: boolean;
    children: Snippet;
  } = $props();
</script>

<button
  class="icon-button"
  class:muted
  {onclick}
  aria-label={label}
  title={label}
  aria-pressed={pressed}
  aria-expanded={expanded}
  aria-controls={controls}
>
  {@render children()}
</button>

<style>
  .icon-button {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--ink);
    color: var(--paper);
    cursor: pointer;
    transition:
      transform 0.25s var(--spring),
      background 0.2s;
  }
  @media (max-width: 560px) {
    .icon-button {
      width: 36px;
      height: 36px;
    }
  }
  .icon-button:hover {
    transform: rotate(8deg) scale(1.08);
    background: var(--accent);
  }
  .icon-button.muted {
    background: var(--muted);
  }
</style>

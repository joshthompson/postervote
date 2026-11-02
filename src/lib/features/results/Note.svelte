<script lang="ts">
  import type { Snippet } from 'svelte';

  // A centred line of text in place of results: empty, missing, or failed to load.

  let { children }: { children: Snippet } = $props();
</script>

<p class="note"><span class="legible">{@render children()}</span></p>

<style>
  .note {
    line-height: 2;
    text-align: center;
    font-size: 20px;
    margin: 0 0 3rem;
  }
  .note :global(a) {
    color: var(--accent);
    font-weight: 700;
  }
</style>

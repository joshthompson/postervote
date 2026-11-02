<script lang="ts">
  import Tooltip from '$lib/components/ui/Tooltip.svelte';

  // How many of the posters a visitor has been shown: a chunky bar, outlined like the button
  // above it, that springs forward with each pair. `label` says it in words, on hover.

  let { seen, total, label }: { seen: number; total: number; label: string } = $props();
</script>

<Tooltip text={label}>
  <div
    class="bar"
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={seen}
  >
    <i style="width: {(seen / total) * 100}%"></i>
  </div>
</Tooltip>

<style>
  .bar {
    width: 150px;
    height: 16px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    overflow: hidden;
    animation: pop-in 0.5s var(--spring) both 0.3s;
    padding: 2px;
  }
  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
    transition: width 0.6s var(--spring);
  }
</style>

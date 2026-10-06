<script lang="ts">
  import type { Snippet } from 'svelte';

  // A titled chart on a glass card, headed like a Board.

  let { title, note, children }: { title: string; note?: string; children: Snippet } = $props();
</script>

<section class="chart">
  <h2><span class="legible">{title}</span></h2>
  {#if note}<p class="note"><span class="legible">{note}</span></p>{/if}
  <div class="card">{@render children()}</div>
</section>

<style>
  .chart {
    margin-bottom: 3rem;
  }
  h2 {
    font-size: clamp(30px, 4.4vw, 52px);
    letter-spacing: -0.04em;
    margin: 0 0 20px;
  }
  h2 .legible {
    padding: 0.05em 0.4em 0.12em;
    border-radius: 0.3em;
  }
  .note {
    margin: -8px 0 20px;
    color: var(--muted);
    line-height: 2;
  }
  .card {
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    border-radius: 22px;
    padding: 18px;
    box-shadow: var(--shadow-card);
  }
  @media (max-width: 560px) {
    .card {
      padding: 12px 8px;
    }
  }
</style>

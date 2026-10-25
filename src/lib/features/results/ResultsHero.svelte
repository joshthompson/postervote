<script lang="ts">
  import PixelText from '$lib/components/pixel/PixelText.svelte';

  // The big two-word heading with its squiggle, the collection's name, and a line about the data.

  let { heading, collection, sub }: { heading: string[]; collection?: string; sub: string } = $props();
</script>

<section class="hero">
  <h1>
    <span class="word" style="--i:0"><PixelText text={heading[0]} color="var(--ink)" /></span>
    <span class="word" style="--i:1"><PixelText text={heading[1]} color="var(--red)" /></span>
  </h1>
  <svg class="squiggle" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 12 Q 20 2, 40 12 T 80 12 T 120 12 T 160 12 T 200 12 T 240 12 T 280 12 T 298 10" />
  </svg>
  {#if collection}
    <p class="collection"><span class="legible">{collection}</span></p>
  {/if}
  <p class="sub"><span class="legible">{sub}</span></p>
</section>

<style>
  .hero {
    text-align: center;
    margin-bottom: 3rem;
  }
  h1 {
    /* Pixel letters: 4 screen px per art px, 2 on phones. */
    --text-px: 4;
    --text-px-sm: 2;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 0 32px;
  }
  @media (max-width: 560px) {
    h1 {
      gap: 0 16px;
    }
  }
  .word {
    display: inline-block;
    animation: rise 0.9s var(--spring) both;
    animation-delay: calc(var(--i) * 0.12s);
  }
  .squiggle {
    display: block;
    width: min(360px, 60%);
    height: 20px;
    margin: 8px auto 0;
  }
  .squiggle path {
    fill: none;
    stroke: var(--yellow);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    animation: draw 1.4s var(--smooth) 0.4s forwards;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  .collection {
    margin: 18px 0 0;
    line-height: 2;
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    animation: rise 0.8s var(--smooth) 0.25s both;
  }
  .sub {
    line-height: 2;
    color: var(--muted);
    font-size: clamp(15px, 1.6vw, 19px);
    animation: rise 0.8s var(--smooth) 0.3s both;
  }
</style>

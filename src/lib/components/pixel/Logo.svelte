<script lang="ts">
  import { onMount } from 'svelte';
  import { headroom } from './glyphs';

  // Text (default "POSTER VOTE!") spelled out in the hand-drawn pixel letters (see ./glyphs).
  // Each letter drifts gently on its own path. Positions are snapped to whole device pixels
  // every frame so the letters' edges stay on the pixel grid (no blur, no shimmer).
  // `px` fixes the screen pixels per art pixel; omit it to use the responsive default.

  let { text = 'POSTER VOTE!', px }: { text?: string; px?: number } = $props();

  // The text is fixed for the component's lifetime, so only its initial value is needed.
  // svelte-ignore state_referenced_locally
  const letters = text.split('');

  let logo: HTMLElement;
  const els: HTMLElement[] = [];

  onMount(() => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paths = letters.map(() => ({
      fx: 0.5 + Math.random() * 0.5,
      fy: 0.6 + Math.random() * 0.6,
      px: Math.random() * Math.PI * 2,
      py: Math.random() * Math.PI * 2
    }));
    let bases: { x: number; y: number }[] = [];
    let amplitude = 2;
    let frame = 0;

    function measure() {
      const artPx = parseFloat(getComputedStyle(logo).getPropertyValue('--px')) || 1;
      amplitude = artPx * 1.1;
      bases = els.map((el) => {
        if (!el) return { x: 0, y: 0 };
        el.style.translate = '0px 0px';
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top };
      });
    }

    function tick(time: number) {
      const t = time / 1000;
      const dpr = window.devicePixelRatio || 1;
      const snap = (n: number) => Math.round(n * dpr) / dpr;
      els.forEach((el, i) => {
        if (!el || !bases[i]) return;
        const p = paths[i];
        const b = bases[i];
        const drift = reduceMotion ? 0 : amplitude;
        const x = snap(b.x + Math.sin(t * p.fx + p.px) * drift) - b.x;
        const y = snap(b.y + Math.sin(t * p.fy + p.py) * drift) - b.y;
        el.style.translate = `${x}px ${y}px`;
      });
      if (!reduceMotion) frame = requestAnimationFrame(tick);
    }

    // Re-measure whenever layout could shift the letters (resize, the font loading).
    const observer = new ResizeObserver(() => {
      measure();
      if (reduceMotion) tick(0);
    });
    observer.observe(logo);
    window.addEventListener('resize', measure);
    measure();
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  });
</script>

<span
  class="logo"
  bind:this={logo}
  role="img"
  aria-label={text}
  style="--headroom: {headroom(text)}{px ? `; --px: ${px}` : ''}"
>
  {#each letters as char, i}
    {#if char === ' '}
      <span class="space"></span>
    {:else}
      <span class="letter" bind:this={els[i]} aria-hidden="true">{char}</span>
    {/if}
  {/each}
</span>

<style>
  .logo {
    /* Screen pixels per art pixel. Keep it a whole number so pixels stay square and sharp. */
    --px: 2;
    display: inline-flex;
    align-items: flex-end;
    /* One em is 32 art px; the box is trimmed to the tallest letter, as in PixelText. */
    font: 800 calc(var(--px) * 32px) / 1 var(--font-pixel);
    /* Always capitals, like PixelText. */
    text-transform: uppercase;
    margin-top: calc(var(--px) * var(--headroom) * -1px);
    color: black;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    user-select: none;
    /* Each letter's advance includes the art pixel after it; the last one's isn't needed. */
    margin-inline-end: calc(var(--px) * -1px);
  }
  @media (max-width: 560px) {
    .logo {
      --px: 1;
    }
  }

  /* With the art pixel after the letter before it, words are 10 art px apart. */
  .space {
    width: calc(var(--px) * 9px);
  }

  .letter {
    display: block;
  }
</style>

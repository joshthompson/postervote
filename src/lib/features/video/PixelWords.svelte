<script lang="ts">
  // Words in the pixel letters (Remi Pop) that slam in together, each at its own tilt, then
  // bounce on every beat. `delay` is the beats before they come in, counted from when this
  // appears. `px` is stage pixels per art pixel. Needs --beat from the reel.

  let {
    text,
    px,
    color = 'var(--ink)',
    delay = 0,
    tilt = 5
  }: { text: string; px: number; color?: string; delay?: number; tilt?: number } = $props();

  // Fixed for the component's lifetime, so each word keeps its tilt.
  // svelte-ignore state_referenced_locally
  const words = text.split(' ').map((word) => ({ word, rot: (Math.random() * 2 - 1) * tilt }));
</script>

<span class="words" style="--px: {px}; --color: {color}">
  {#each words as w}
    <span class="word" style="--d: {delay}; --rot: {w.rot}deg">{w.word}</span>
  {/each}
</span>

<style>
  .words {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: calc(var(--px) * 6px) calc(var(--px) * 10px);
    font: 800 calc(var(--px) * 32px) / 1 var(--font-pixel);
    text-transform: uppercase;
    color: var(--color);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .word {
    display: inline-block;
    transform: rotate(var(--rot));
    animation:
      slam calc(var(--beat) * 0.75) var(--spring) calc(var(--beat) * var(--d)) both,
      bounce var(--beat) ease-out calc(var(--beat) * (var(--d) + 1)) infinite;
  }
  @keyframes slam {
    from {
      opacity: 0;
      transform: scale(2.8) rotate(calc(var(--rot) * -4));
    }
  }
  @keyframes bounce {
    15% {
      translate: 0 calc(var(--px) * -2px);
    }
  }
</style>

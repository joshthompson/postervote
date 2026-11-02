<script lang="ts">
  import PixelText from '$lib/components/pixel/PixelText.svelte';

  // A chunky pill button labelled in pixel letters.
  // `pressed` marks the chosen option in a group: it turns red and stays red on hover.

  let {
    label,
    onclick,
    variant = 'red',
    px,
    pressed
  }: {
    label: string;
    onclick?: (e: MouseEvent) => void;
    variant?: 'red' | 'ink' | 'paper';
    px?: number;
    pressed?: boolean;
  } = $props();
</script>

<button class="btn {variant}" class:pressed {onclick} aria-pressed={pressed}>
  <PixelText text={label} {px} color={variant === 'paper' && !pressed ? 'var(--ink)' : 'white'} />
</button>

<style>
  .btn {
    display: inline-grid;
    place-items: center;
    padding: 0.8em 1.5em 0.9em;
    border: 3px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: var(--shadow-lift);
    transition:
      transform 0.25s var(--spring),
      background 0.2s,
      border-color 0.2s;
    -webkit-tap-highlight-color: transparent;
  }
  @media (max-width: 560px) {
    .btn {
      padding: 0.7em 1.1em 0.8em;
    }
  }
  .btn:hover {
    transform: scale(1.06) rotate(-2deg);
  }
  .btn:active {
    transform: scale(0.97);
  }
  .btn:focus-visible {
    outline: 4px solid var(--accent-2);
    outline-offset: 4px;
  }

  .red {
    background: var(--accent);
    box-shadow: 0 20px 50px -12px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .red:hover {
    background: var(--ink);
  }
  .ink {
    background: var(--ink);
  }
  .ink:hover {
    background: var(--accent);
  }
  .paper {
    background: var(--paper);
    border-color: var(--ink);
  }
  .paper:hover {
    background: white;
  }
  .btn.pressed,
  .btn.pressed:hover {
    background: var(--accent);
    border-color: var(--accent);
  }
</style>

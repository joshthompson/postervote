<script lang="ts">
  import Logo from '$lib/components/pixel/Logo.svelte';

  // The wobbling yellow "vs" between the two posters; spins away once a vote is in.

  let { hidden = false }: { hidden?: boolean } = $props();
</script>

<div class="vs" aria-hidden="true">
  <span class:hidden><Logo text="vs" px={1} /></span>
</div>

<style>
  .vs {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    z-index: 4;
    pointer-events: none;
  }
  span {
    display: grid;
    place-content: center;
    width: clamp(48px, 5vw, 68px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--accent-2);
    box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--accent-2) 70%, transparent);
    animation:
      vs-in 0.7s var(--spring) 0.55s both,
      wobble 3s ease-in-out 1.3s infinite;
  }
  .hidden {
    animation: vs-out 0.5s var(--smooth) forwards;
  }
  @keyframes vs-in {
    from {
      transform: scale(0) rotate(-180deg);
    }
  }
  @keyframes wobble {
    50% {
      transform: scale(1.12) rotate(10deg);
    }
  }
  @keyframes vs-out {
    to {
      transform: scale(0) rotate(180deg);
    }
  }
</style>

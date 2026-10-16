<script lang="ts">
  // Square confetti falling over the whole stage, without end. Needs --beat from the reel.

  const COLORS = ['#ff3b5c', '#ffb000', '#ff7a93', '#1f1a24', '#ff6a2b'];
  const COUNT = 70;

  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const pieces = Array.from({ length: COUNT }, (_, i) => ({
    x: rand(0, 100),
    size: Math.round(rand(6, 16)),
    color: COLORS[i % COLORS.length],
    // In beats: the first ones fall straight away, then they keep coming.
    fall: rand(4, 9),
    delay: rand(0, 4),
    spin: rand(-3, 3),
    sway: rand(20, 60)
  }));
</script>

<div class="confetti" aria-hidden="true">
  {#each pieces as p}
    <i
      style="left: {p.x}%; --s: {p.size}px; --c: {p.color}; --fall: {p.fall}; --delay: {p.delay}; --spin: {p.spin}turn; --sway: {p.sway}px"
    ></i>
  {/each}
</div>

<style>
  .confetti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  i {
    position: absolute;
    top: 0;
    width: var(--s);
    height: var(--s);
    background: var(--c);
    animation:
      fall calc(var(--beat) * var(--fall)) linear calc(var(--beat) * var(--delay)) infinite both,
      sway calc(var(--beat) * 2) ease-in-out calc(var(--beat) * var(--delay)) infinite alternate;
  }
  @keyframes fall {
    from {
      transform: translateY(-40px) rotate(0);
    }
    to {
      transform: translateY(1000px) rotate(var(--spin));
    }
  }
  @keyframes sway {
    from {
      translate: calc(var(--sway) * -0.5) 0;
    }
    to {
      translate: calc(var(--sway) * 0.5) 0;
    }
  }
</style>

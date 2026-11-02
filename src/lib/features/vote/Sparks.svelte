<script lang="ts">
  // A burst of confetti dots from the centre of the chosen poster. A fresh burst on every mount.

  const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--accent-soft)', 'var(--ink)'];
  const COUNT = 18;

  const sparks = Array.from({ length: COUNT }, (_, k) => ({
    angle: (k / COUNT) * 360 + Math.random() * 20,
    dist: 90 + Math.random() * 140,
    size: 8 + Math.random() * 22,
    color: COLORS[k % COLORS.length],
    delay: Math.random() * 80
  }));
</script>

<div class="sparks" aria-hidden="true">
  {#each sparks as s}
    <span style="--a:{s.angle}deg; --d:{s.dist}px; --s:{s.size}px; --c:{s.color}; --delay:{s.delay}ms"></span>
  {/each}
</div>

<style>
  .sparks {
    position: absolute;
    left: 50%;
    top: 50%;
    pointer-events: none;
    z-index: 3;
  }
  span {
    position: absolute;
    width: var(--s);
    height: var(--s);
    margin: calc(var(--s) / -2);
    border-radius: 50%;
    background: var(--c);
    animation: spark 0.9s var(--smooth) var(--delay) both;
  }
  @keyframes spark {
    0% {
      transform: rotate(var(--a)) translateX(0) scale(0.2);
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      /* --w is the poster width, set by the stage. */
      transform: rotate(var(--a)) translateX(calc(var(--w) * 0.35 + var(--d))) scale(0);
      opacity: 0;
    }
  }
</style>

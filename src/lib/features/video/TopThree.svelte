<script lang="ts">
  import Sparks from '$lib/features/vote/Sparks.svelte';
  import type { PosterInfo } from '$lib/services/posters.svelte';
  import { posterSrc } from '$lib/utils/images';
  import Confetti from './Confetti.svelte';
  import PixelWords from './PixelWords.svelte';
  import { AT, PARK, POSTER_IN } from './timeline';

  // The reveal: third, then second, each named and then moved down to the podium, a drumroll,
  // and the winner. `top` is the top three, best first; `now` is the reel's beat.

  type Finalist = Pick<PosterInfo, '_id' | 'title' | 'image'>;
  let { top, now }: { top: Finalist[]; now: number } = $props();

  const places = $derived(
    [
      { rank: 3, label: '3rd place', at: AT.third, poster: top[2] },
      { rank: 2, label: '2nd place', at: AT.second, poster: top[1] },
      { rank: 1, label: '', at: AT.winner - POSTER_IN, poster: top[0] }
    ].filter((p) => p.poster)
  );
  const drumroll = $derived(now >= AT.drumroll && now < AT.winner);
</script>

{#if now >= AT.winner}
  <div class="rays" aria-hidden="true"></div>
{/if}

{#if drumroll}
  <div class="drumroll" class:leaving={now >= AT.winner - 1}>
    <PixelWords text="And the winner is..." px={3} />
  </div>
{/if}

{#each places as p (p.rank)}
  {#if p.label && now >= p.at && now < p.at + PARK + 1}
    <div class="label" class:leaving={now >= p.at + PARK}>
      <PixelWords text={p.label} px={2} />
    </div>
  {/if}
  {#if now >= p.at + POSTER_IN}
    <div
      class="place place-{p.rank}"
      class:parked={p.rank > 1 && now >= p.at + PARK}
      class:shaking={p.rank > 1 && drumroll}
    >
      <div class="fly">
        <div class="bob">
          <img src={posterSrc(p.poster.image)} alt="" />
          {#if p.rank > 1}<span class="medal">{p.rank}</span>{/if}
        </div>
      </div>
      <div class="title"><PixelWords text={p.poster.title} px={1} delay={1} tilt={2} /></div>
      <Sparks />
    </div>
  {/if}
{/each}

{#if now >= AT.winner + 1}
  <div class="stamp"><PixelWords text="Winner!" px={3} color="white" tilt={0} /></div>
{/if}

{#if now >= AT.winner}
  <Confetti />
{/if}

<style>
  /* Featured posters sit in the middle; the podium is along the bottom. */
  .place {
    --w: 300px;
    position: absolute;
    left: 120px;
    top: 236px;
    width: var(--w);
    z-index: 2;
    transform-origin: 0 0;
    transition: transform calc(var(--beat) * 1.2) var(--spring);
  }
  /* Down to 120px wide at the bottom, third on the left and second on the right. */
  .place-3.parked {
    transform: translate(-80px, 536px) scale(0.4);
  }
  .place-2.parked {
    transform: translate(260px, 536px) scale(0.4);
  }
  .place-1 {
    --w: 340px;
    left: 100px;
    top: 216px;
    z-index: 3;
  }
  .shaking .bob {
    animation:
      bob calc(var(--beat) * 4) ease-in-out infinite,
      jitter calc(var(--beat) / 2) linear infinite;
  }
  @keyframes jitter {
    25% {
      rotate: -5deg;
    }
    75% {
      rotate: 5deg;
    }
  }

  .fly {
    animation: fly-in var(--beat) var(--spring) both;
  }
  @keyframes fly-in {
    from {
      opacity: 0;
      transform: translateY(700px) rotate(-30deg) scale(0.3);
    }
  }
  .place-1 .fly {
    animation: spin-in calc(var(--beat) * 1.5) var(--spring) both;
  }
  @keyframes spin-in {
    from {
      opacity: 0;
      transform: scale(0) rotate(-540deg);
    }
  }
  .bob {
    position: relative;
    animation: bob calc(var(--beat) * 4) ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(-8px) rotate(1deg);
    }
  }

  img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: 10px solid white;
    border-radius: 8px;
    background: #f3ebe2;
    box-shadow: 0 24px 50px -18px rgba(31, 26, 36, 0.55);
  }
  .place-1 img {
    animation: glow var(--beat) ease-out infinite;
  }
  @keyframes glow {
    from {
      box-shadow:
        0 0 0 10px var(--red),
        0 30px 80px -10px rgba(255, 59, 92, 0.7);
    }
    to {
      box-shadow:
        0 0 0 6px var(--red),
        0 24px 50px -18px rgba(31, 26, 36, 0.55);
    }
  }

  .medal {
    position: absolute;
    top: -22px;
    right: -22px;
    width: 76px;
    aspect-ratio: 1;
    display: grid;
    place-content: center;
    padding-bottom: 4px;
    border-radius: 50%;
    font: 800 64px / 1 var(--font-pixel);
    background: var(--ink);
    color: var(--paper);
    box-shadow: 0 10px 24px -8px rgba(31, 26, 36, 0.6);
    animation: medal calc(var(--beat) * 1.5) var(--spring) calc(var(--beat) * 0.5) both;
  }
  .place-2 .medal {
    background: var(--yellow);
    color: var(--ink);
  }
  @keyframes medal {
    from {
      transform: scale(0) rotate(-200deg);
    }
  }

  /* Under the poster, wider than it, and gone once it's on the podium. */
  .title {
    position: absolute;
    left: 50%;
    top: calc(100% + 22px);
    width: 470px;
    translate: -50% 0;
    transition: opacity calc(var(--beat) * 0.5);
  }
  .parked .title {
    opacity: 0;
  }

  .label,
  .drumroll {
    position: absolute;
    left: 24px;
    right: 24px;
    z-index: 4;
    display: flex;
    justify-content: center;
  }
  .label {
    top: 140px;
  }
  .drumroll {
    top: 340px;
  }
  .leaving {
    animation: away calc(var(--beat) * 0.6) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes away {
    to {
      opacity: 0;
      transform: scale(0.2) rotate(-20deg);
    }
  }

  .stamp {
    position: absolute;
    left: 50%;
    top: 112px;
    z-index: 4;
    padding: 14px 26px 18px;
    border-radius: 999px;
    background: var(--red);
    box-shadow: 0 16px 40px -10px rgba(255, 59, 92, 0.7);
    transform: translateX(-50%) rotate(-7deg);
    animation: stamp calc(var(--beat) * 0.75) var(--spring) both;
  }
  @keyframes stamp {
    from {
      opacity: 0;
      transform: translateX(-50%) scale(3) rotate(-30deg);
    }
  }

  /* A slowly turning sunburst behind the winner. */
  .rays {
    position: absolute;
    left: 50%;
    top: 442px;
    width: 1200px;
    aspect-ratio: 1;
    margin: -600px 0 0 -600px;
    z-index: 1;
    background: repeating-conic-gradient(rgba(255, 176, 0, 0.45) 0 9deg, transparent 9deg 18deg);
    mask: radial-gradient(closest-side, black 20%, transparent 100%);
    animation:
      rays-in calc(var(--beat) * 2) var(--smooth) both,
      turn calc(var(--beat) * 32) linear infinite;
  }
  @keyframes rays-in {
    from {
      opacity: 0;
      scale: 0;
    }
  }
  @keyframes turn {
    to {
      transform: rotate(1turn);
    }
  }
</style>

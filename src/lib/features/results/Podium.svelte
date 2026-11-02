<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';
  import { posterSrc } from '$lib/utils/images';
  import { pct } from './format';
  import type { LinkTo, RankedPoster } from './types';

  // The top three on plinths: second, first, third from left to right. Each links to its poster
  // (see `linkTo`).

  let { top, linkTo }: { top: RankedPoster[]; linkTo: LinkTo } = $props();

  const places = $derived([top[1], top[0], top[2]].filter(Boolean));
</script>

<section class="podium" aria-label={i18n.t.results.topThree}>
  {#each places as p (p._id)}
    <div class="place place-{p.rank}" style="--i:{p.rank}">
      <a class="pick" {...linkTo(p, 'podium')}>
        <div class="thumb">
          <img src={posterSrc(p.image)} alt="" />
          <span class="medal">{p.rank}</span>
        </div>
        <div class="label legible">
          <h3>{p.title}</h3>
          <p>{i18n.t.results.podium(p.rating, pct(p.winRate))}</p>
        </div>
      </a>
      <div class="plinth"></div>
    </div>
  {/each}
</section>

<style>
  .podium {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: end;
    gap: clamp(10px, 3vw, 32px);
    margin-bottom: 3rem;
    text-align: center;
  }
  .place {
    animation: rise 0.9s var(--spring) both;
    animation-delay: calc(0.5s + (3 - var(--i)) * 0.18s);
  }
  .pick {
    display: block;
    color: inherit;
    text-decoration: none;
  }
  .pick:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 6px;
    border-radius: 10px;
  }
  .thumb {
    position: relative;
    margin: 0 auto;
    width: 78%;
    transition: transform 0.4s var(--spring);
  }
  .pick:hover .thumb,
  .pick:focus-visible .thumb {
    transform: translateY(-8px) rotate(-2deg) scale(1.03);
  }
  .place-1 .thumb {
    width: 92%;
  }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: clamp(4px, 0.8vw, 10px) solid white;
    border-radius: 6px;
    box-shadow: 0 24px 50px -18px color-mix(in srgb, var(--ink) 50%, transparent);
  }
  .medal {
    position: absolute;
    top: -16px;
    right: -12px;
    width: clamp(40px, 5vw, 60px);
    aspect-ratio: 1;
    border-radius: 50%;
    display: grid;
    place-content: center;
    font-weight: 800;
    font-size: clamp(18px, 2.4vw, 28px);
    background: var(--ink);
    color: var(--paper);
    animation: spin-in 0.9s var(--spring) both;
    animation-delay: calc(1s + (3 - var(--i)) * 0.18s);
  }
  .place-1 .medal {
    background: var(--accent);
    width: clamp(52px, 6.5vw, 76px);
  }
  .place-2 .medal {
    background: var(--accent-2);
    color: var(--ink);
  }
  @keyframes spin-in {
    from {
      transform: scale(0) rotate(-200deg);
    }
  }
  .label {
    display: inline-block;
    margin: 16px 0 12px;
    padding: 0.4em 0.8em;
    border-radius: 14px;
  }
  h3 {
    margin: 0 0 2px;
    font-size: clamp(14px, 1.8vw, 22px);
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: clamp(12px, 1.3vw, 15px);
  }
  .plinth {
    height: 36px;
    background: var(--ink);
  }
  .place-1 .plinth {
    height: 76px;
    background: var(--accent);
  }
  .place-2 .plinth {
    height: 52px;
    background: var(--accent-2);
  }
</style>

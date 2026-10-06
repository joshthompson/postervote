<script lang="ts">
  import { posterSrc } from '$lib/utils/images';
  import type { PosterLink } from './types';

  // A poster as a round thumbnail centred on (x, y) px in a chart, ringed in `ring`. Hovering or
  // focusing it shows its title and `lines`; it links to the poster like the rows do. `align`
  // keeps the tooltip inside the chart near its edges.

  let {
    title,
    image,
    x,
    y,
    r,
    ring,
    lines,
    align = 'center',
    delay = 0,
    link
  }: {
    title: string;
    image: string;
    x: number;
    y: number;
    r: number;
    ring: string;
    lines: string[];
    align?: 'start' | 'center' | 'end';
    delay?: number;
    link: PosterLink;
  } = $props();
</script>

<a
  class="poster {align}"
  href={link.href}
  onclick={link.onclick}
  aria-label={[title, ...lines].join('. ')}
  style="left: {x}px; top: {y}px; --r: {r}px; --ring: {ring}; --delay: {delay}ms"
>
  <img src={posterSrc(image)} alt="" loading="lazy" />
  <span class="tip" aria-hidden="true">
    <strong>{title}</strong>
    {#each lines as line}<span>{line}</span>{/each}
  </span>
</a>

<style>
  .poster {
    position: absolute;
    width: calc(var(--r) * 2);
    height: calc(var(--r) * 2);
    margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1);
    border-radius: 50%;
    box-shadow:
      0 0 0 2px var(--ring),
      0 0 0 4px white;
    background: white;
    transition:
      left 0.6s var(--smooth),
      top 0.6s var(--smooth);
    animation: pop 0.5s var(--spring) both;
    animation-delay: var(--delay);
  }
  .poster:hover,
  .poster:focus-visible {
    z-index: 2;
    outline: none;
    box-shadow:
      0 0 0 3px var(--ring),
      0 0 0 5px white,
      0 10px 24px -8px rgba(31, 26, 36, 0.6);
  }
  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }
  .tip {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    display: none;
    min-width: 160px;
    max-width: 240px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
  }
  .start .tip {
    left: 0;
    transform: none;
  }
  .end .tip {
    left: auto;
    right: 0;
    transform: none;
  }
  .tip strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tip span {
    display: block;
    opacity: 0.85;
  }
  .poster:hover .tip,
  .poster:focus-visible .tip {
    display: block;
  }
  @keyframes pop {
    from {
      transform: scale(0);
    }
  }
</style>

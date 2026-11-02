<script lang="ts">
  import type { Snippet } from 'svelte';
  import { posterSrc } from '$lib/utils/images';

  // One row of a ranked list: rank, thumbnail, title with `children` under it, and a big number
  // with a caption on the right. `top` colours the rank for the leaders. With `href` the whole
  // row is a link, and `onclick` handles clicks on it.

  let {
    rank,
    image,
    title,
    value,
    caption,
    top = false,
    href,
    onclick,
    children
  }: {
    rank: number;
    image: string;
    title: string;
    value: string | number;
    caption: string;
    top?: boolean;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

{#snippet contents()}
  <span class="rank" class:top>{rank}</span>
  <img src={posterSrc(image)} alt="" loading="lazy" />
  <div class="info">
    <strong>{title}</strong>
    {@render children()}
  </div>
  <div class="nums">
    <span class="value">{value}</span>
    <span class="caption">{caption}</span>
  </div>
{/snippet}

{#if href}
  <a class="row clickable" {href} {onclick}>{@render contents()}</a>
{:else}
  <div class="row">{@render contents()}</div>
{/if}

<style>
  .row {
    display: grid;
    grid-template-columns: 44px 54px 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 10px 18px 10px 12px;
    background: var(--glass);
    backdrop-filter: blur(8px);
    border-radius: 18px;
    box-shadow: 0 8px 20px -16px color-mix(in srgb, var(--ink) 50%, transparent);
    transition:
      transform 0.3s var(--spring),
      box-shadow 0.3s;
  }
  .clickable {
    color: inherit;
    text-decoration: none;
  }
  .clickable:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  /* Lift by whole pixels only: rotating or scaling text resamples it and it blurs. */
  .row:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px -16px color-mix(in srgb, var(--accent) 50%, transparent);
  }
  .rank {
    font-weight: 800;
    font-size: 22px;
    text-align: center;
    color: var(--muted);
  }
  .rank.top {
    color: var(--accent);
  }
  img {
    width: 54px;
    height: 72px;
    object-fit: cover;
    border-radius: 6px;
  }
  .info {
    min-width: 0;
  }
  strong {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 8px;
  }
  .nums {
    text-align: right;
  }
  .value {
    display: block;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: -0.03em;
  }
  .caption {
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    .row {
      grid-template-columns: 30px 44px 1fr auto;
      gap: 10px;
      padding: 8px 12px 8px 8px;
    }
    img {
      width: 44px;
      height: 58px;
    }
    .rank,
    .value {
      font-size: 18px;
    }
  }
</style>

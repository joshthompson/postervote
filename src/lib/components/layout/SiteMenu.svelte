<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track, type NavDestination } from '$lib/services/analytics';

  // Burger button with a dropdown of every page.
  // Closes on navigation, Escape, or a click anywhere outside it.

  /** A menu link, and where it goes as the analytics events name it. */
  type Link = { href: string; label: string; destination: NavDestination };

  let open = $state(false);
  let root: HTMLElement;

  const links: Link[] = $derived([
    { href: resolve('/'), label: i18n.t.menu.vote, destination: 'vote' },
    { href: resolve('/results'), label: i18n.t.menu.rankings, destination: 'rankings' },
    { href: resolve('/collections'), label: i18n.t.menu.collections, destination: 'collections' },
    { href: resolve('/about'), label: i18n.t.menu.about, destination: 'about' },
    { href: resolve('/settings'), label: i18n.t.menu.settings, destination: 'settings' }
  ]);

  $effect(() => {
    void page.url.pathname;
    open = false;
  });

  function onWindowPointer(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointer} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

{#snippet item(l: Link)}
  <li>
    <a
      href={l.href}
      aria-current={page.url.pathname === l.href ? 'page' : undefined}
      onclick={() => track('nav_link_clicked', { destination: l.destination, placement: 'menu' })}>{l.label}</a
    >
  </li>
{/snippet}

<div class="menu" bind:this={root}>
  <IconButton label={i18n.t.menu.label} expanded={open} controls="site-menu" onclick={() => (open = !open)}>
    <span class="burger" class:open aria-hidden="true"><i></i><i></i><i></i></span>
  </IconButton>
  {#if open}
    <ul id="site-menu" class="panel">
      {#each links as l}{@render item(l)}{/each}
    </ul>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .burger {
    display: grid;
    gap: 4px;
  }
  .burger i {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
    transition:
      transform 0.25s var(--spring),
      opacity 0.2s;
  }
  /* Morphs into an X while open. */
  .open i:nth-child(1) {
    transform: translateY(6px) rotate(45deg);
  }
  .open i:nth-child(2) {
    opacity: 0;
  }
  .open i:nth-child(3) {
    transform: translateY(-6px) rotate(-45deg);
  }

  .panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    display: grid;
    gap: 4px;
    min-width: 160px;
    width: max-content;
    max-width: 260px;
    margin: 0;
    padding: 8px;
    list-style: none;
    background: var(--ink);
    border-radius: 20px;
    box-shadow: 0 20px 40px -16px rgba(31, 26, 36, 0.6);
    transform-origin: top right;
    animation: drop 0.35s var(--spring) both;
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(-6px);
    }
  }
  a {
    display: block;
    padding: 0.6em 1em;
    border-radius: 12px;
    color: var(--paper);
    font-weight: 600;
    font-size: 15px;
    text-decoration: none;
    transition: background 0.2s;
  }
  a:hover,
  a[aria-current='page'] {
    background: var(--red);
  }
</style>

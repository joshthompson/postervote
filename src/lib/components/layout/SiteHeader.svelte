<script lang="ts">
  import { resolve } from '$app/paths';
  import beta from '$lib/assets/beta.png';
  import Logo from '$lib/components/pixel/Logo.svelte';
  import { track } from '$lib/services/analytics';
  import MuteButton from './MuteButton.svelte';
  import NavPill from './NavPill.svelte';
  import SiteMenu from './SiteMenu.svelte';

  // Mute on the left, logo in the middle, shortcut and menu on the right.
  // On phones it stacks into one column with the two round buttons pinned to the corners.
  // `withMenu` is off until Convex is configured, since the pages it links to need it.

  let { withMenu = true }: { withMenu?: boolean } = $props();
</script>

<header>
  <div class="corner start"><MuteButton /></div>
  <a
    class="brand"
    href={resolve('/')}
    aria-label="Poster Vote! (beta)"
    onclick={() => track('nav_link_clicked', { destination: 'vote', placement: 'logo' })}
    ><Logo /><img class="beta" src={beta} alt="" aria-hidden="true" draggable="false" /></a
  >
  <nav>
    <NavPill />
    {#if withMenu}<div class="corner end"><SiteMenu /></div>{/if}
  </nav>
</header>

<style>
  header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: clamp(12px, 2.5vw, 28px) clamp(16px, 3vw, 36px);
    pointer-events: none;
  }
  header > * {
    pointer-events: auto;
  }
  .start {
    justify-self: start;
  }
  .brand {
    position: relative;
    display: inline-block;
    text-decoration: none;
  }
  /* Beta tag tucked under the logo's bottom-right corner, drawn at one screen pixel per art pixel. */
  .beta {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 44px;
    height: 16px;
    transform: translate(40%, 60%);
    image-rendering: crisp-edges;
    image-rendering: pixelated;
    user-select: none;
  }
  nav {
    justify-self: stretch;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  @media (max-width: 560px) {
    header {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: 8px;
    }
    nav {
      justify-self: center;
      max-width: 100%;
    }
    .corner {
      position: absolute;
      top: 12px;
    }
    .start {
      left: 12px;
    }
    .end {
      right: 12px;
    }
  }
</style>

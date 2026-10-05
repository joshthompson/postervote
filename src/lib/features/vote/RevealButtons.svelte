<script lang="ts">
  import pauseIcon from '$lib/assets/pause.png';
  import playIcon from '$lib/assets/play.png';
  import Tooltip from '$lib/components/ui/Tooltip.svelte';
  import { i18n } from '$lib/i18n/index.svelte';

  // The two buttons under the revealed votes. On the left, autoplay: ▶ while the pair moves on by
  // itself, with a border that fills up over `duration` ms until then, or ❚❚ once paused, its
  // border stopped. Clicking it pauses or resumes (`ontoggle`), carrying on from where it was.
  // With a mouse, hovering it shows what a click does. On the right, "Next →" moves on (`onnext`)
  // and leaves autoplay as it is. Before them, when there are earlier votes, "Past Votes" looks back at
  // them (`onhistory`).
  //
  // While looking back (`back`), they're ← and → through the old votes and "Continue voting" on to
  // the next new pair instead. All are --next-height tall.

  type Back = { canPrev: boolean; canNext: boolean; onprev: () => void; onnext: () => void; oncontinue: () => void };

  let {
    paused,
    duration,
    ontoggle,
    onnext,
    onhistory,
    back
  }: {
    paused: boolean;
    duration: number;
    ontoggle: () => void;
    onnext: () => void;
    onhistory?: () => void;
    back?: Back | null;
  } = $props();

  const t = $derived(i18n.t.vote);
  const label = $derived(paused ? t.resumeAutoplay : t.pauseAutoplay);

  // The border, along the button's edge from the top middle round clockwise.
  const STROKE = 4;
  let w = $state(0);
  let h = $state(0);
  const border = $derived.by(() => {
    const s = STROKE / 2;
    const r = h / 2 - s;
    return `M${w / 2} ${s}H${w - s - r}A${r} ${r} 0 0 1 ${w - s - r} ${h - s}H${s + r}A${r} ${r} 0 0 1 ${s + r} ${s}Z`;
  });
</script>

<div class="buttons">
  {#if back}
    <Tooltip text={t.previousVote}>
      <button class="paper arrow" disabled={!back.canPrev} onclick={back.onprev} aria-label={t.previousVote}>←</button>
    </Tooltip>
    <Tooltip text={t.nextVote}>
      <button class="paper arrow" disabled={!back.canNext} onclick={back.onnext} aria-label={t.nextVote}>→</button>
    </Tooltip>
    <button class="next" onclick={back.oncontinue}>{t.continueVoting}</button>
  {:else}
    {#if onhistory}
      <button class="paper history" onclick={onhistory}>{t.pastVotes}</button>
    {/if}
    <Tooltip text={label}>
      <button
        class="paper autoplay"
        class:paused
        onclick={ontoggle}
        aria-label={label}
        style="--duration: {duration}ms"
        bind:clientWidth={w}
        bind:clientHeight={h}
      >
        {#if w}
          <svg class="ring" viewBox="0 0 {w} {h}" aria-hidden="true">
            <path class="track" d={border} stroke-width={STROKE} />
            <path class="fill" d={border} stroke-width={STROKE} pathLength="100" />
          </svg>
        {/if}
        <img class="now" src={paused ? pauseIcon : playIcon} alt="" width="24" height="24" />
        <img class="then" src={paused ? playIcon : pauseIcon} alt="" width="24" height="24" />
      </button>
    </Tooltip>
    <button class="next" onclick={onnext}>{t.next}</button>
  {/if}
</div>

<style>
  .buttons {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  button {
    position: relative;
    display: inline-grid;
    place-items: center;
    height: var(--next-height, 52px);
    border: 0;
    border-radius: 999px;
    font-weight: 700;
    font-size: 18px;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 0.25s var(--spring);
    -webkit-tap-highlight-color: transparent;
  }
  @media (max-width: 560px) {
    button {
      font-size: 16px;
    }
  }
  @media (hover: hover) {
    button:not(:disabled):hover {
      transform: translateY(-2px) rotate(-2deg) scale(1.05);
    }
  }
  button:focus-visible {
    outline: 3px solid var(--yellow);
    outline-offset: 3px;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .paper {
    background: var(--card);
    color: var(--ink);
    box-shadow: 0 8px 24px -6px rgba(255, 59, 92, 0.5);
  }
  .autoplay,
  .arrow {
    padding: 0 1.1em;
  }
  .history {
    padding: 0 1.2em;
  }
  .next {
    padding: 0 1.6em;
    background: var(--red);
    color: white;
  }
  /* "Past Votes", autoplay and "Next →" side by side must fit a 375px phone. */
  @media (max-width: 560px) {
    .history,
    .next {
      padding: 0 1em;
    }
  }

  .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  path {
    fill: none;
  }
  .track {
    stroke: rgba(255, 59, 92, 0.18);
  }
  .fill {
    stroke: var(--red);
    stroke-dasharray: 100;
    animation: fill var(--duration) linear forwards;
  }
  .paused .fill {
    animation-play-state: paused;
  }
  /* It's the time left, not decoration, so it keeps its pace even with reduced motion (which
     base.css otherwise cuts every animation short for). */
  @media (prefers-reduced-motion: reduce) {
    .fill {
      animation-duration: var(--duration) !important;
    }
  }
  @keyframes fill {
    from {
      stroke-dashoffset: 100;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  /* Pixel icons, drawn in black: what it's doing now, or on hover what a click would change it to. */
  img {
    grid-area: 1 / 1;
    image-rendering: pixelated;
  }
  .then {
    display: none;
  }
  /* Only where there's a real hover: on touch screens, a tapped button stays "hovered". */
  @media (hover: hover) {
    .autoplay:hover .now {
      display: none;
    }
    .autoplay:hover .then {
      display: block;
    }
  }
  .autoplay:focus-visible .now {
    display: none;
  }
  .autoplay:focus-visible .then {
    display: block;
  }
</style>

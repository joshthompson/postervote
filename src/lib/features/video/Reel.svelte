<script lang="ts">
  import { onMount } from 'svelte';
  import Logo from '$lib/components/pixel/Logo.svelte';
  import { widestWord } from '$lib/components/pixel/glyphs';
  import { SITE } from '$lib/features/share/links';
  import type { PosterInfo } from '$lib/services/posters.svelte';
  import { sound } from '$lib/services/sound.svelte';
  import { posterSrc } from '$lib/utils/images';
  import PixelWords from './PixelWords.svelte';
  import TopThree from './TopThree.svelte';
  import { AT, BEAT_MS, CUES, fitPx, HEIGHT, WIDTH, type Spawn } from './timeline';

  // The winner video, drawn over the stage's polka dots: the logo, the question, posters flying
  // through, "the votes are in!", the top three, and the site's address. It keeps its own clock from
  // `startAt` (a performance.now() time, when the music restarts), so every part lands on the beat,
  // and goes round again after `AT.end`: the end clears to the bare stage it starts on.
  // `sfx` plays the vote effect on the cues; off when the effects are rendered into the music.

  type Finalist = Pick<PosterInfo, '_id' | 'title' | 'image'>;
  let {
    startAt,
    spawns,
    top,
    name,
    votes,
    sfx = true
  }: { startAt: number; spawns: Spawn[]; top: Finalist[]; name: string; votes: number; sfx?: boolean } = $props();

  let beat = $state(-1);
  // The beat to the nearest 16th below. What's on screen only changes this often, so the rest of
  // the markup doesn't re-run every frame.
  const now = $derived(Math.floor(beat * 4) / 4);

  onMount(() => {
    let frame = 0;
    // Cues skipped by a stalled tab stay silent. Each time round starts them over.
    let cue = 0;
    let lap = 0;
    const tick = () => {
      const elapsed = (performance.now() - startAt) / BEAT_MS;
      const thisLap = Math.max(0, Math.floor(elapsed / AT.end));
      if (thisLap !== lap) [lap, cue] = [thisLap, 0];
      beat = elapsed - lap * AT.end;
      for (; cue < CUES.length && beat >= CUES[cue]; cue++) if (sfx && beat < CUES[cue] + 0.5) sound.vote();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // The intro's two lines, each letter dropping in on its own 16th with its own spin.
  const intro = ['POSTER', 'VOTE!'].map((line, l) =>
    [...line].map((char, i) => ({ char, d: (l * 6 + i) / 4, rot: (Math.random() * 2 - 1) * 40 }))
  );

  // svelte-ignore state_referenced_locally
  const namePx = fitPx(widestWord(`${name}?`), WIDTH - 100, 3);

  /** A pile poster's way out when it bursts: away from the middle, whatever its distance. */
  function burst(s: Spawn) {
    const dx = s.x - WIDTH / 2;
    const dy = s.y - HEIGHT / 2;
    const len = Math.hypot(dx, dy) || 1;
    return `--ox: ${(dx / len) * 800}px; --oy: ${(dy / len) * 900}px`;
  }

  const site = new URL(SITE).host;
  const fmt = (n: number) => n.toLocaleString('en-GB');
  // The count races up while the posters fly, faster and faster. Every frame, so it runs smoothly.
  const counted = $derived.by(() => {
    const p = Math.min(1, Math.max(0, (beat - AT.slideshow) / (AT.counted - AT.slideshow)));
    return Math.round(votes * p * p);
  });
</script>

<div class="reel" style="--beat: {BEAT_MS}ms">
  {#if now >= AT.logo && now < AT.logoSmall + 2}
    <div class="intro" class:leaving={now >= AT.logoSmall}>
      {#each intro as line}
        <div class="line">
          {#each line as l}
            <span class="letter" style="--d: {l.d}; --rot: {l.rot}deg">{l.char}</span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if now >= AT.logoSmall + 0.5 && now < AT.outroOut + 1}
    <div class="brand" class:out={now >= AT.outroOut}><Logo px={2} /></div>
  {/if}

  {#if now >= AT.question && now < AT.questionOut + 1}
    <div class="question" class:leaving={now >= AT.questionOut}>
      <PixelWords text="What was the best poster of" px={3} />
      <div class="name" style="--in: {AT.name - AT.question}">
        <PixelWords text="{name}?" px={namePx} color="white" delay={AT.name - AT.question} tilt={3} />
      </div>
    </div>
  {/if}

  {#if now >= AT.slideshow && now < AT.burst + 1}
    <div class="shuffle" class:shaking={now >= AT.shake && now < AT.burst}>
      {#each spawns as s (s.key)}
        {#if now >= s.start && now < s.end + 1}
          <div
            class="spawn {s.kind}"
            class:out={now >= s.end}
            style="left: {s.x}px; top: {s.y}px; --w: {s.w}px; --rot: {s.rot}deg; --fx: {s.fromX}px; --fy: {s.fromY}px; {burst(s)}"
          >
            <img src={posterSrc(s.poster.image)} alt="" />
          </div>
        {/if}
      {/each}
    </div>
    <div class="counter" class:out={now >= AT.burst}>
      <PixelWords text="Counting votes" px={1} tilt={0} color="var(--paper)" />
      <span class="count">{fmt(counted)}</span>
    </div>
  {/if}

  {#if now >= AT.burst && now < AT.burst + 1}
    <div class="flash"></div>
  {/if}

  {#if now >= AT.votesIn && now < AT.votesInOut + 1}
    <div class="votes-in" class:leaving={now >= AT.votesInOut}>
      <PixelWords text="The votes are in!" px={4} />
      <div class="total"><PixelWords text="{fmt(votes)} votes" px={2} color="var(--paper)" delay={1} tilt={0} /></div>
    </div>
  {/if}

  {#if now >= AT.third && now < AT.outro + 1}
    <div class="finale" class:leaving={now >= AT.outro}><TopThree {top} {now} /></div>
  {/if}

  {#if now >= AT.winner && now < AT.winner + 1}
    <div class="flash"></div>
  {/if}

  {#if now >= AT.outro && now < AT.outroOut + 1}
    <div class="outro" class:out={now >= AT.outroOut}><span class="url">{site}</span></div>
  {/if}
</div>

<style>
  .reel {
    position: absolute;
    inset: 0;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Leaving: shrink and spin away. */
  .leaving {
    animation: away calc(var(--beat) * 0.6) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes away {
    to {
      opacity: 0;
      transform: scale(0.2) rotate(-20deg);
    }
  }

  .intro {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 24px;
    font: 800 128px / 1 var(--font-pixel);
  }
  .intro.leaving {
    animation: fly-up calc(var(--beat) * 0.75) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes fly-up {
    to {
      transform: translateY(-900px) scale(0.6);
    }
  }
  .line {
    display: flex;
  }
  .letter {
    display: block;
    animation:
      drop calc(var(--beat) * 1.2) var(--spring) calc(var(--beat) * var(--d)) both,
      bounce var(--beat) ease-out calc(var(--beat) * 3) infinite;
  }
  .line:first-child .letter {
    color: var(--red);
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-700px) rotate(var(--rot)) scale(1.4);
    }
  }
  @keyframes bounce {
    15% {
      translate: 0 -8px;
    }
  }

  .brand {
    position: absolute;
    top: 34px;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    animation: pop calc(var(--beat) * 1) var(--spring) both;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-120px) scale(0.4);
    }
  }

  .brand.out {
    animation: brand-out calc(var(--beat) * 0.75) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes brand-out {
    to {
      transform: translateY(-160px) scale(0.6);
    }
  }

  .finale {
    position: absolute;
    inset: 0;
  }

  /* The address slams in, bounces on the beat, then drops off the bottom just as the video ends. */
  .outro {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .outro.out {
    animation: drop-out calc(var(--beat) * 0.9) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes drop-out {
    to {
      transform: translateY(800px) rotate(25deg);
    }
  }
  .url {
    padding: 14px 30px 18px;
    border-radius: 999px;
    background: var(--red);
    box-shadow: 0 20px 50px -12px rgba(255, 59, 92, 0.6);
    color: white;
    font: 800 56px / 1 'Bricolage Grotesque', system-ui, sans-serif;
    letter-spacing: -0.02em;
    rotate: -4deg;
    animation:
      url-in calc(var(--beat) * 0.75) var(--spring) calc(var(--beat) * 0.5) both,
      url-bounce var(--beat) ease-out calc(var(--beat) * 1.5) infinite;
  }
  @keyframes url-in {
    from {
      opacity: 0;
      transform: scale(2.8) rotate(12deg);
    }
  }
  @keyframes url-bounce {
    15% {
      translate: 0 -6px;
    }
  }

  .question,
  .votes-in {
    position: absolute;
    inset: 120px 24px 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 40px;
  }
  .name,
  .total {
    padding: 16px 24px 20px;
    border-radius: 28px;
    rotate: -3deg;
  }
  .name {
    background: var(--red);
    box-shadow: 0 20px 50px -12px rgba(255, 59, 92, 0.6);
    animation: pop calc(var(--beat) * 0.75) var(--spring) calc(var(--beat) * var(--in)) both;
  }
  .total {
    background: var(--ink);
    rotate: 3deg;
    box-shadow: var(--shadow-lift);
    animation: pop calc(var(--beat) * 0.75) var(--spring) var(--beat) both;
  }

  .shuffle {
    position: absolute;
    inset: 0;
  }
  .shaking {
    animation: shake calc(var(--beat) / 4) linear infinite;
  }
  @keyframes shake {
    25% {
      translate: -7px 4px;
      rotate: -0.6deg;
    }
    75% {
      translate: 7px -4px;
      rotate: 0.6deg;
    }
  }
  .spawn {
    position: absolute;
    width: var(--w);
    translate: -50% -50%;
    transform: rotate(var(--rot));
    animation: spawn-in calc(var(--beat) * 0.6) var(--spring) both;
  }
  @keyframes spawn-in {
    from {
      transform: translate(var(--fx), var(--fy)) rotate(calc(var(--rot) * -6)) scale(0.6);
    }
  }
  .slide.out {
    animation: slide-out calc(var(--beat) * 0.5) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  @keyframes slide-out {
    to {
      transform: translate(calc(var(--fx) * -1), calc(var(--fy) * -1)) rotate(calc(var(--rot) * 6)) scale(0.6);
    }
  }
  .pile.out {
    animation: burst calc(var(--beat) * 0.9) cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }
  @keyframes burst {
    to {
      opacity: 0;
      transform: translate(var(--ox), var(--oy)) rotate(calc(var(--rot) * 10)) scale(1.4);
    }
  }
  .spawn img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border: calc(var(--w) * 0.03) solid white;
    border-radius: 6px;
    background: #f3ebe2;
    box-shadow: 0 18px 40px -14px rgba(31, 26, 36, 0.55);
  }

  .counter {
    position: absolute;
    left: 50%;
    bottom: 44px;
    z-index: 5;
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 14px 30px 16px;
    border-radius: 28px;
    background: var(--ink);
    box-shadow: var(--shadow-lift);
    translate: -50% 0;
    animation: pop calc(var(--beat) * 0.75) var(--spring) both;
  }
  .counter.out {
    animation: away calc(var(--beat) * 0.6) cubic-bezier(0.6, -0.3, 0.7, 0.4) forwards;
  }
  .count {
    min-width: 6ch;
    font: 800 64px / 1 var(--font-pixel);
    color: var(--yellow);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .flash {
    position: absolute;
    inset: 0;
    z-index: 20;
    background: white;
    pointer-events: none;
    animation: flash var(--beat) ease-out forwards;
  }
  @keyframes flash {
    to {
      opacity: 0;
    }
  }
</style>

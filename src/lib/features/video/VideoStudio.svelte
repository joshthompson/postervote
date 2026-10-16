<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { api } from '$convex/api';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { sound } from '$lib/services/sound.svelte';
  import { posterSrc } from '$lib/utils/images';
  import Reel from './Reel.svelte';
  import Stage from './Stage.svelte';
  import { preloadPosters, useVideoData } from './data.svelte';
  import { plan, type Spawn } from './timeline';

  // Picks a competition and previews its winner video, live with the music, as large as fits the
  // window. The video file itself is rendered frame by frame by `pnpm video` (scripts/render-video.mjs,
  // through the render page next door); this shows the command for the competition picked.
  // English only, as it's just for us.

  // Seconds between the music restarting and the first beat, so the loop starts cleanly.
  const LEAD = 0.15;

  let slug = $state<string | undefined>(undefined);
  const data = useVideoData(() => slug);
  const archived = useQuery(api.competitions.archived, {});

  const ranked = $derived(data.ranked);
  const top = $derived(ranked?.slice(0, 3) ?? []);

  // The name the question uses, the competition's title until it's changed here.
  const title = $derived(data.competition?.title ?? '');
  let name = $state('');
  $effect(() => {
    name = title;
  });

  /** Quoted for the shell. */
  const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;
  const command = $derived(
    data.competition ? `pnpm video ${data.competition.slug}${name && name !== title ? ` --name ${quote(name)}` : ''}` : ''
  );
  let copied = $state(false);
  async function copy() {
    await navigator.clipboard.writeText(command);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  let open = $state(false);
  let loaded = $state(0);
  let ready = $state(false);
  let run = $state<{ startAt: number; spawns: Spawn[] } | null>(null);
  // The decoded images, held so the browser keeps them ready.
  let images: HTMLImageElement[] = [];

  async function preview() {
    if (!ranked) return;
    open = true;
    ready = false;
    run = null;
    loaded = 0;
    images = await preloadPosters(ranked, () => loaded++);
    await document.fonts.load('64px "Remi Pop"');
    if (!open) return;
    ready = true;
    start();
  }

  function start() {
    if (!ranked || !ready) return;
    sound.restart(LEAD);
    run = { startAt: performance.now() + LEAD * 1000, spawns: plan(ranked.slice(3)) };
  }

  function close() {
    open = false;
    run = null;
    images = [];
  }

  function onkeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === ' ') {
      e.preventDefault();
      start();
    } else if (e.key === 'm') sound.toggle();
  }
</script>

<svelte:window {onkeydown} />

{#if archived.data?.length}
  <nav class="picker" aria-label="Competition">
    <Pill variant={slug ? 'outline' : 'ink'} pressed={!slug} onclick={() => (slug = undefined)}>Current</Pill>
    {#each archived.data as c (c.slug)}
      <Pill variant={slug === c.slug ? 'ink' : 'outline'} pressed={slug === c.slug} onclick={() => (slug = c.slug)}>{c.title}</Pill>
    {/each}
  </nav>
{/if}

{#if data.error}
  <p class="message">Couldn't load the competition: {data.error.message}</p>
{:else if data.missing}
  <p class="message">No competition yet. Sync some posters first.</p>
{:else if !ranked}
  <Loader />
{:else}
  <Card>
    <label class="field">
      <span>Name in the question</span>
      <input bind:value={name} />
    </label>
    <p class="note">
      {ranked.length} posters · {data.votes.toLocaleString('en-GB')} votes{data.competition?.active ? ' so far' : ''}.
      {#if data.competition?.active}The rankings are up to 15 minutes behind.{/if}
    </p>
    <ol class="top">
      {#each top as p (p._id)}
        <li><img src={posterSrc(p.image)} alt="" /><span>{p.rank}. {p.title}</span></li>
      {/each}
    </ol>
    <Button label="Preview" variant="ink" px={1} onclick={preview} />
    <p class="note">
      Music follows the sound button (top left) or <kbd>M</kbd>. <kbd>Space</kbd> replays, <kbd>Esc</kbd> closes.
    </p>
    <div class="render">
      <span>To make the video file (1080 × 1920, 30 fps, with the music), run this with <code>pnpm dev</code> running:</span>
      <code class="command">{command}</code>
      <Pill onclick={copy}>{copied ? 'Copied!' : 'Copy'}</Pill>
    </div>
  </Card>
{/if}

{#if open}
  <Stage>
    {#if run}
      {#key run}
        <Reel startAt={run.startAt} spawns={run.spawns} {top} {name} votes={data.votes} />
      {/key}
    {/if}
    {#snippet hint()}
      {#if !ready}Loading posters… {loaded} / {ranked?.length ?? 0}{/if}
    {/snippet}
  </Stage>
{/if}

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .message {
    text-align: center;
    color: var(--muted);
  }
  .field {
    display: grid;
    gap: 6px;
    width: 100%;
    font-weight: 700;
  }
  input {
    width: 100%;
    padding: 0.6em 0.9em;
    border: 2px solid var(--ink);
    border-radius: 12px;
    font: inherit;
    font-weight: 600;
    text-align: center;
    background: white;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .top {
    display: flex;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .top li {
    display: grid;
    gap: 4px;
    width: 120px;
    font-size: 13px;
    font-weight: 600;
  }
  .top img {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 4px;
  }
  kbd {
    padding: 0.05em 0.4em;
    border: 1px solid currentColor;
    border-radius: 4px;
    font: inherit;
    font-size: 0.9em;
  }
  .render {
    display: grid;
    justify-items: center;
    gap: 10px;
    width: 100%;
    padding-top: 14px;
    border-top: 1px solid rgba(31, 26, 36, 0.12);
    color: var(--muted);
    font-size: 14px;
  }
  .command {
    max-width: 100%;
    padding: 0.6em 0.9em;
    overflow-x: auto;
    white-space: nowrap;
    color: var(--ink);
  }
</style>

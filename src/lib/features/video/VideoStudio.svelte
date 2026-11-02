<script lang="ts">
  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Loader from '$lib/components/ui/Loader.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { useCollections } from '$lib/features/collections/data.svelte';
  import type { PosterInfo } from '$lib/services/posters.svelte';
  import { sound } from '$lib/services/sound.svelte';
  import { posterSrc } from '$lib/utils/images';
  import Reel from './Reel.svelte';
  import Stage from './Stage.svelte';
  import { pickNext, preloadPosters, useNextCollection, useVideoData } from './data.svelte';
  import { ending, plan, type Spawn } from './timeline';

  // Picks a collection and previews its winner video, live with the music, as large as fits the
  // window, ending (if one's picked) on the collection to vote on next: a draft or the live one.
  // The video file itself is rendered frame by frame by `pnpm video` (scripts/render-video.mjs,
  // through the render page next door); this shows the command for the collection picked, rendering
  // from this copy of the site (`--url`), so the file has the same data as the preview.
  // English only, as it's just for us.

  // Seconds between the music restarting and the first beat, so the loop starts cleanly.
  const LEAD = 0.15;

  let slug = $state<string | undefined>(undefined);
  const data = useVideoData(() => slug);
  const collections = useCollections({ drafts: true });
  const past = $derived(collections.data.filter((c) => !c.active && !c.draft));

  let nextSlug = $state<string | undefined>(undefined);
  const nextData = useNextCollection(() => nextSlug);
  const nextOptions = $derived(
    collections.data.filter((c) => (c.draft || c.active) && c.slug !== (slug ?? data.collection?.slug))
  );
  // The collection being made into a video can't come next as well.
  $effect(() => {
    if (nextSlug && !nextOptions.some((c) => c.slug === nextSlug)) nextSlug = undefined;
  });

  const ranked = $derived(data.ranked);
  const top = $derived(ranked?.slice(0, 3) ?? []);

  // The name the question uses, the collection's title until it's changed here.
  const title = $derived(data.collection?.title ?? '');
  let name = $state('');
  $effect(() => {
    name = title;
  });

  // The name it's called at the end, its title until it's changed here.
  const nextTitle = $derived(nextData.title ?? '');
  let nextName = $state('');
  $effect(() => {
    nextName = nextTitle;
  });

  /** Quoted for the shell. */
  const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;
  const command = $derived(
    data.collection
      ? [
          `pnpm video ${data.collection.slug}`,
          `--url ${page.url.origin}${base}`,
          name && name !== title && `--name ${quote(name)}`,
          nextSlug && `--next ${nextSlug}`,
          nextSlug && nextName && nextName !== nextTitle && `--next-name ${quote(nextName)}`
        ]
          .filter(Boolean)
          .join(' ')
      : ''
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
  type Next = { slug: string; name: string; posters: PosterInfo[] };
  let run = $state<{ startAt: number; spawns: Spawn[]; next: Next | null } | null>(null);
  // The next collection as the preview shows it, fixed when it opens.
  let next = $state<Next | null>(null);
  const nextReady = $derived(!nextSlug || !!nextData.posters);
  // The decoded images, held so the browser keeps them ready.
  let images: HTMLImageElement[] = [];

  async function preview() {
    if (!ranked || !nextReady) return;
    open = true;
    ready = false;
    run = null;
    loaded = 0;
    next = nextSlug && nextData.posters ? { slug: nextSlug, name: nextName, posters: pickNext(nextData.posters) } : null;
    images = await preloadPosters([...ranked, ...(next?.posters ?? [])], () => loaded++);
    await Promise.all([document.fonts.load('64px "Remi Pop"'), document.fonts.load('800 56px "Bricolage Grotesque"')]);
    if (!open) return;
    ready = true;
    start();
  }

  function start() {
    if (!ranked || !ready) return;
    sound.restart(LEAD);
    run = { startAt: performance.now() + LEAD * 1000, spawns: plan(ranked.slice(3)), next };
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

{#if past.length}
  <nav class="picker" aria-label="Collection">
    <Pill variant={slug ? 'outline' : 'ink'} pressed={!slug} onclick={() => (slug = undefined)}>Current</Pill>
    {#each past as c (c.slug)}
      <Pill variant={slug === c.slug ? 'ink' : 'outline'} pressed={slug === c.slug} onclick={() => (slug = c.slug)}>{c.title}</Pill>
    {/each}
  </nav>
{/if}

{#if data.error}
  <p class="message">Couldn't load the collection: {data.error.message}</p>
{:else if data.missing}
  <p class="message">No collection yet. Sync some posters first.</p>
{:else if !ranked}
  <Loader />
{:else}
  <Card>
    <label class="field">
      <span>Name in the question</span>
      <input bind:value={name} />
    </label>
    <div class="field">
      <span>Up next, to vote on</span>
      <nav class="picker" aria-label="Next collection">
        <Pill variant={nextSlug ? 'outline' : 'ink'} pressed={!nextSlug} onclick={() => (nextSlug = undefined)}>None</Pill>
        {#each nextOptions as c (c.slug)}
          <Pill variant={nextSlug === c.slug ? 'ink' : 'outline'} pressed={nextSlug === c.slug} onclick={() => (nextSlug = c.slug)}>
            {c.title}{c.draft ? ' (draft)' : c.active ? ' (live)' : ''}
          </Pill>
        {/each}
      </nav>
    </div>
    {#if nextSlug}
      <label class="field">
        <span>Its name at the end</span>
        <input bind:value={nextName} />
      </label>
      {#if nextData.missing}
        <p class="note">There's no collection "{nextSlug}" any more.</p>
      {:else if nextData.posters && !nextData.posters.length}
        <p class="note">It has no posters yet, so it'll show without any.</p>
      {/if}
    {/if}
    <p class="note">
      {ranked.length} posters · {data.votes.toLocaleString('en-GB')} votes{data.collection?.active ? ' so far' : ''}.
      {#if data.collection?.active}The rankings are up to 15 minutes behind.{/if}
    </p>
    <ol class="top">
      {#each top as p (p._id)}
        <li><img src={posterSrc(p.image)} alt="" /><span>{p.rank}. {p.title}</span></li>
      {/each}
    </ol>
    <Button label={nextReady ? 'Preview' : 'Loading…'} variant="ink" px={1} onclick={preview} />
    <p class="note">
      It plays on repeat, as Instagram does. Music follows the sound button (top left) or <kbd>M</kbd>.
      <kbd>Space</kbd> starts it over, <kbd>Esc</kbd> closes.
    </p>
    <div class="render">
      <span>
        To make the video file (1080 × 1920, 30 fps, with the music), run this.
        {#if dev}Keep <code>pnpm dev</code> running while it does.{/if}
      </span>
      <code class="command">{command}</code>
      <Pill onclick={copy}>{copied ? 'Copied!' : 'Copy'}</Pill>
    </div>
  </Card>
{/if}

{#if open}
  <Stage startAt={run?.startAt} beats={ending(!!next).end} collection={data.collection?.slug}>
    {#if run}
      {#key run}
        <Reel startAt={run.startAt} spawns={run.spawns} {top} {name} votes={data.votes} next={run.next} />
      {/key}
    {/if}
    {#snippet hint()}
      {#if !ready}Loading posters… {loaded} / {(ranked?.length ?? 0) + (next?.posters.length ?? 0)}{/if}
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
  .field .picker {
    margin-bottom: 0;
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
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
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

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Card from '$lib/components/ui/Card.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { useCollections } from '$lib/features/collections/data.svelte';
  import { paletteFor } from '$lib/features/collections/palettes';
  import { saveFile } from '$lib/utils/download';
  import { loadDots } from '$lib/utils/dots';
  import { syncSearchParams } from '$lib/utils/searchParams.svelte';
  import { SITE, cleanUtm, withUtm } from './links';
  import {
    PAPERS,
    canvasToPdf,
    defaultText,
    drawPoster,
    loadFonts,
    printWidth,
    type Paper,
    type PosterText,
    type Target
  } from './poster';

  // Makes a poster to print and put up, with a QR code tagged with where it's put up
  // (utm_medium=qr, utm_campaign the collection's slug), in a collection's colours and named after
  // it. The words start from the collection's title and can all be changed. Everything filled in is
  // kept in the address, the words only where they're changed, so a link to it opens this poster.
  // English only, as /admin is.

  const query = page.url.searchParams;
  const TEXT_KEYS = Object.keys(defaultText('', 'vote')) as (keyof PosterText)[];
  const isPaper = (value: string | null): value is Paper => !!value && value in PAPERS;

  const collections = useCollections({ drafts: true });
  let picked = $state(query.get('collection') ?? undefined);
  // The live collection until another's picked; drafts are listed first, so it's not simply the first.
  const collection = $derived(
    collections.data.find((c) => c.slug === picked) ?? collections.data.find((c) => c.active) ?? collections.data[0]
  );
  const slug = $derived(collection?.slug ?? '');
  const title = $derived(collection?.title ?? '');

  let target = $state<Target>(query.get('opens') === 'rankings' ? 'rankings' : 'vote');
  let source = $state(query.get('place') ?? '');
  let content = $state(query.get('spot') ?? '');
  const paperParam = query.get('paper');
  let paper = $state<Paper>(isPaper(paperParam) ? paperParam : 'A4');
  let seed = $state(Number(query.get('seed')) || 1);

  // The words are the collection's defaults with any changes on top. Picking another collection, or
  // where the code goes, starts them over.
  const defaults = $derived(defaultText(title, target));
  let edits = $state<Partial<PosterText>>(
    Object.fromEntries(TEXT_KEYS.flatMap((key) => (query.has(key) ? [[key, query.get(key)!]] : [])))
  );
  const text = $derived({ ...defaults, ...edits });
  function edit(key: keyof PosterText, value: string) {
    const { [key]: _, ...others } = edits;
    edits = value === defaults[key] ? others : { ...others, [key]: value };
  }
  const reset = () => (edits = {});

  syncSearchParams(() => ({
    collection: picked ?? slug,
    opens: target === 'vote' ? undefined : target,
    place: source || undefined,
    spot: content || undefined,
    paper: paper === 'A4' ? undefined : paper,
    seed: seed === 1 ? undefined : seed,
    // Words cleared to leave them off are kept, empty.
    ...edits
  }));

  let copied = $state(false);
  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  const utm = $derived({ source: cleanUtm(source), medium: 'qr', content: cleanUtm(content), campaign: slug });
  const path = $derived(target === 'vote' ? '/' : `/collections/${slug}`);
  // Until a place is filled in, the preview's code says "place", and there's nothing to download.
  const url = $derived(withUtm(SITE + path, { ...utm, source: utm.source || 'place' }));
  const ready = $derived(!!utm.source && !!slug);
  const fileName = $derived(['postervote', slug, utm.source, utm.content, paper.toLowerCase()].filter(Boolean).join('-'));

  let dots = $state.raw<HTMLImageElement[]>();
  onMount(() => {
    loadDots().then((images) => (dots = images));
  });

  const design = $derived(
    dots && { palette: paletteFor(slug), text, url, dots, seed }
  );

  let preview: HTMLCanvasElement;
  $effect(() => {
    const d = design;
    if (!d) return;
    let stale = false;
    loadFonts(d.text).then(() => {
      if (stale) return;
      drawPoster(preview, Math.min(1400, (preview.clientWidth || 480) * devicePixelRatio), d);
    });
    return () => (stale = true);
  });

  let busy = $state<'png' | 'pdf'>();
  async function download(kind: 'png' | 'pdf') {
    if (!design || busy) return;
    busy = kind;
    try {
      await loadFonts(design.text);
      const canvas = document.createElement('canvas');
      const qr = drawPoster(canvas, printWidth(paper), design);
      const blob =
        kind === 'pdf'
          ? await canvasToPdf(canvas, paper, url, qr)
          : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) saveFile(blob, `${fileName}.${kind}`);
    } finally {
      busy = undefined;
    }
  }
</script>

<div class="layout">
  <Card>
    <form onsubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>The code</legend>
        <label>
          <span class="name">Collection</span>
          <select bind:value={() => slug, (v) => ((picked = v), reset())}>
            {#each collections.data as c (c.slug)}
              <option value={c.slug}>{c.title}{c.draft ? ' (draft)' : c.active ? ' (live)' : ''}</option>
            {/each}
          </select>
          <span class="hint">Its colours and name, and <code>utm_campaign</code>.</span>
        </label>
        <label>
          <span class="name">Opens</span>
          <select bind:value={() => target, (v) => ((target = v), reset())}>
            <option value="vote">Vote</option>
            <option value="rankings">The collection's rankings</option>
          </select>
          <span class="hint">Vote is always the live collection.</span>
        </label>
        <label>
          <span class="name">Place <code>utm_source</code></span>
          <input bind:value={source} placeholder="e.g. school" required />
          <span class="hint">Where it's put up: the school, the café.</span>
        </label>
        <label>
          <span class="name">Spot <code>utm_content</code> <em>optional</em></span>
          <input bind:value={content} placeholder="e.g. entrance, stairs" />
          <span class="hint">Which one, when there are several there. <code>utm_medium</code> is <code>qr</code>.</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>The words <button type="button" class="reset" onclick={reset}>Reset</button></legend>
        <div class="pair">
          <label>
            <span class="name">Tag</span>
            <input bind:value={() => text.tag, (v) => edit('tag', v)} />
          </label>
          <label>
            <span class="name">Year</span>
            <input bind:value={() => text.year, (v) => edit('year', v)} />
          </label>
        </div>
        <label>
          <span class="name">Title</span>
          <textarea rows="2" bind:value={() => text.title, (v) => edit('title', v)}></textarea>
          <span class="hint">A line each. Words in <code>*stars*</code> are in the accent colour.</span>
        </label>
        <label>
          <span class="name">Subtitle</span>
          <textarea rows="2" bind:value={() => text.subtitle, (v) => edit('subtitle', v)}></textarea>
        </label>
        <div class="pair">
          <label>
            <span class="name">Left of the code</span>
            <input bind:value={() => text.left, (v) => edit('left', v)} />
          </label>
          <label>
            <span class="name">Right of the code</span>
            <input bind:value={() => text.right, (v) => edit('right', v)} />
          </label>
        </div>
        <div class="pair">
          <label>
            <span class="name">Corner</span>
            <textarea rows="4" bind:value={() => text.corner, (v) => edit('corner', v)}></textarea>
            <span class="hint">Stacked, a line each.</span>
          </label>
          <label>
            <span class="name">Footer</span>
            <input bind:value={() => text.footer, (v) => edit('footer', v)} />
          </label>
        </div>
        <p class="hint">Leave anything empty to leave it off.</p>
      </fieldset>
    </form>
  </Card>

  <Card delay={0.15}>
    <div class="result">
      <canvas class="preview" bind:this={preview} aria-label="Poster preview"></canvas>
      <code class="url">{url}</code>
      <div class="actions">
        <Pill variant="outline" onclick={() => (seed = Math.floor(Math.random() * 2 ** 31))}>Shuffle dots</Pill>
        <Pill variant="outline" onclick={copyLink}>{copied ? 'Copied!' : 'Copy link to this poster'}</Pill>
      </div>
      <div class="actions" role="group" aria-label="Paper size">
        <span class="hint">Paper</span>
        {#each Object.keys(PAPERS) as Paper[] as size (size)}
          <Pill variant={paper === size ? 'ink' : 'outline'} pressed={paper === size} onclick={() => (paper = size)}>
            {size}
          </Pill>
        {/each}
      </div>
      {#if ready}
        <div class="actions">
          <Pill variant="red" onclick={() => download('pdf')}>{busy === 'pdf' ? 'Making…' : 'Download PDF'}</Pill>
          <Pill variant="ink" onclick={() => download('png')}>{busy === 'png' ? 'Making…' : 'Download PNG'}</Pill>
        </div>
        <p class="hint">At 300 dpi. Keep a list of where each one goes up.</p>
      {:else}
        <p class="hint">Fill in the place to download it.</p>
      {/if}
    </div>
  </Card>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: 18px;
    align-items: start;
  }
  form {
    display: grid;
    gap: 28px;
    width: 100%;
    text-align: left;
  }
  fieldset {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 16px;
    padding: 0;
    font-weight: 800;
    font-size: 19px;
  }
  .reset {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    align-items: start;
  }
  label {
    display: grid;
    gap: 6px;
  }
  .name {
    font-weight: 700;
  }
  .name em {
    color: var(--muted);
    font-weight: 400;
  }
  input,
  select,
  textarea {
    min-width: 0;
    padding: 10px 14px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: white;
    font: inherit;
  }
  textarea {
    resize: vertical;
  }
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 3px solid var(--accent-2);
    outline-offset: 2px;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .result {
    display: grid;
    justify-items: center;
    gap: 16px;
    width: 100%;
  }
  .preview {
    display: block;
    width: min(100%, 480px);
    aspect-ratio: 1 / 1.4142;
    border-radius: 6px;
    box-shadow: var(--shadow-lift);
  }
  .url {
    max-width: 100%;
    overflow-wrap: anywhere;
    font-size: 13px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
  }
</style>

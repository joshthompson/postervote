<script lang="ts">
  import { encode } from 'uqr';
  import Page from '$lib/components/layout/Page.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import { SITE, withUtm } from '$lib/features/share/links';

  // A hidden page for making links to the site, tagged with where they're handed out, and QR codes
  // for them. Nothing links here, search engines are asked to skip it, and its visits aren't
  // counted (see +layout.svelte); there's no sign-in. See "Sources" in AGENTS.md for the values.
  // English only, as it's just for us.

  const PAGES = [
    { label: 'Vote', path: '/' },
    { label: 'Rankings', path: '/results' },
    { label: 'About', path: '/about' }
  ];
  const MEDIUMS = ['qr', 'community', 'social', 'email', 'print'];
  // Screen pixels per QR square in the PNG, big enough to print.
  const PNG_SCALE = 32;

  let path = $state('/');
  let source = $state('');
  let medium = $state('qr');
  let content = $state('');
  let campaign = $state('');
  let copied = $state(false);

  /** Lowercase, with runs of anything but letters, digits and hyphens as one underscore. */
  const clean = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const utm = $derived({ source: clean(source), medium: clean(medium), content: clean(content), campaign: clean(campaign) });
  const url = $derived(utm.source && utm.medium ? withUtm(SITE + path, utm) : '');
  // The squares, true for black, with the 4-square quiet zone round them that scanners need.
  const squares = $derived(url ? encode(url, { ecc: 'M', border: 4 }).data : []);
  const svg = $derived.by(() => {
    const n = squares.length;
    const d = squares.flatMap((row, y) => row.map((black, x) => (black ? `M${x} ${y}h1v1h-1z` : ''))).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  });
  const fileName = $derived(['postervote', utm.source, utm.content].filter(Boolean).join('-'));

  async function copy() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function save(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const saveSvg = () => save(new Blob([svg], { type: 'image/svg+xml' }), `${fileName}.svg`);

  function savePng() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = squares.length * PNG_SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    squares.forEach((row, y) =>
      row.forEach((black, x) => black && ctx.fillRect(x * PNG_SCALE, y * PNG_SCALE, PNG_SCALE, PNG_SCALE))
    );
    canvas.toBlob((blob) => blob && save(blob, `${fileName}.png`));
  }
</script>

<svelte:head>
  <title>Share links · Poster Vote</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page width="wide">
  <PageTitle text="Share links" color="var(--accent)" />
  <div class="layout">
    <Card>
      <form onsubmit={(e) => e.preventDefault()}>
        <label>
          <span class="name">Page</span>
          <select bind:value={path}>
            {#each PAGES as p (p.path)}<option value={p.path}>{p.label}</option>{/each}
          </select>
        </label>
        <label>
          <span class="name">Source <code>utm_source</code></span>
          <input bind:value={source} placeholder="e.g. design_school, telegram_designers" required />
          <span class="hint">Exactly where it's handed out: the school, the community.</span>
        </label>
        <label>
          <span class="name">Medium <code>utm_medium</code></span>
          <input bind:value={medium} list="mediums" required />
          <datalist id="mediums">
            {#each MEDIUMS as m (m)}<option value={m}></option>{/each}
          </datalist>
          <span class="hint">The kind of channel: <code>qr</code>, <code>community</code>, …</span>
        </label>
        <label>
          <span class="name">Content <code>utm_content</code> <em>optional</em></span>
          <input bind:value={content} placeholder="e.g. entrance, cafe" />
          <span class="hint">Which one, when there are several: each QR code's spot.</span>
        </label>
        <label>
          <span class="name">Campaign <code>utm_campaign</code> <em>optional</em></span>
          <input bind:value={campaign} placeholder="e.g. stockholm-2026-09" />
          <span class="hint">Which push, if you want to tell them apart.</span>
        </label>
        <p class="hint">
          Values are made lowercase, with underscores for spaces. Once a link is out, don't change its
          values, and keep a list of every link you hand out.
        </p>
      </form>
    </Card>
    <Card delay={0.15}>
      {#if url}
        <div class="result">
          <!-- Built from the QR's squares, not from anything typed in. -->
          <div class="qr">{@html svg}</div>
          <code class="url">{url}</code>
          <div class="actions">
            <Pill variant="red" onclick={copy}>{copied ? 'Copied!' : 'Copy link'}</Pill>
            <Pill variant="ink" onclick={savePng}>Download PNG</Pill>
            <Pill variant="ink" onclick={saveSvg}>Download SVG</Pill>
          </div>
        </div>
      {:else}
        <p class="empty">Fill in a source and a medium to make a link.</p>
      {/if}
    </Card>
  </div>
</Page>

<style>
  .layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: 18px;
    align-items: start;
  }
  form {
    display: grid;
    gap: 18px;
    text-align: left;
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
  select {
    padding: 10px 14px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: white;
    font: inherit;
  }
  input:focus-visible,
  select:focus-visible {
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
  }
  .qr {
    width: min(100%, 320px);
  }
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  .url {
    max-width: 100%;
    overflow-wrap: anywhere;
    font-size: 14px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>

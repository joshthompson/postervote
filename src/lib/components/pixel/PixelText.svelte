<script lang="ts">
  import { headroom, widestWord } from './glyphs';

  // Text set in the hand-drawn pixel letters (the Remi Pop font, see ./glyphs). Characters
  // without a letter (e.g. "&") fall back to the site font at the same size.
  // `px` is screen pixels per art pixel; keep it whole so the pixels stay sharp.
  // `color` colours the letters (any CSS colour, e.g. "white" or "var(--red)"); they're black
  // otherwise, like the drawings.
  // Lines wrap at spaces; use a non-breaking space (\u00a0) to keep words together.
  // A word too wide for the screen shrinks the whole text to the largest whole px that fits.
  // It's real text, so it can be selected and searched, and screen readers read it as words.

  let { text, px, color }: { text: string; px?: number; color?: string } = $props();

  const widest = $derived(widestWord(text));

  let el: HTMLElement;
  let room = $state(Infinity); // screen width left for the text
  let base = $state(0); // the --px the page asked for
  const measureRoom = () => {
    room = document.documentElement.clientWidth - 32;
    base = parseFloat(getComputedStyle(el).getPropertyValue('--px')) || 0;
  };
  $effect(measureRoom);

  const fit = $derived.by(() => {
    if (!widest || !base || widest * base <= room) return undefined;
    const f = room / widest;
    return f >= 1 ? Math.floor(f) : Math.max(0.25, Math.floor(f * 4) / 4);
  });

  const style = $derived(
    [`--headroom: ${headroom(text)}`, px && `--px: ${px}`, fit && `--px-fit: ${fit}`, color && `--color: ${color}`]
      .filter(Boolean)
      .join('; ')
  );
</script>

<svelte:window onresize={measureRoom} />

<span bind:this={el} class="pixel-text" {style}>{text}</span>

<style>
  .pixel-text {
    /* A parent can set --text-px / --text-px-sm to size all the pixel text inside it. */
    --px: var(--text-px, 2);
    --s: var(--px-fit, var(--px));
    display: inline-block;
    /* One line is one em, 32 art px; the letters stand on its bottom edge. The weight is for
       fallback characters: the pixel face covers every weight. */
    font: 800 calc(var(--s) * 32px) / 1 var(--font-pixel);
    /* Always capitals: the font has lowercase letters, but the site doesn't use them. */
    text-transform: uppercase;
    /* Trim the empty top of the first line down to the tallest letter, so the box hugs the
       letters and a label sits centred where it's placed. Most letters are 26–29 art px tall. */
    margin-top: calc(var(--s) * var(--headroom) * -1px);
    color: var(--color, black);
    text-align: center;
    vertical-align: bottom;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Centred text can land on half a pixel, where letter edges go soft. Chrome snaps a
       composited layer to whole device pixels, which keeps them sharp. */
    will-change: transform;
    /* Each letter's advance includes the art pixel after it; don't let the last one push the
       text off centre. */
    margin-inline-end: calc(var(--s) * -1px);
  }
  @media (max-width: 560px) {
    .pixel-text {
      --px: var(--text-px-sm, 1);
      --s: var(--px-fit, var(--px));
    }
  }
</style>

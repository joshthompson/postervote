<script lang="ts">
  import { widestDigit } from '$lib/components/pixel/glyphs';
  import PixelText from '$lib/components/pixel/PixelText.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { tween } from '$lib/utils/tween';

  // A number that counts up to `value`, formatted for the current language.
  // `pixel` draws the number in the pixel letters, coloured like the surrounding text. The pixel
  // digits differ in width, so its box is sized for the widest the number can be while counting,
  // and what's around it stays still.
  let { value, duration = 1200, decimals = 0, suffix = '', pixel = false }: {
    value: number;
    duration?: number;
    decimals?: number;
    suffix?: string;
    pixel?: boolean;
  } = $props();

  let shown = $state(0);

  $effect(() => {
    const target = value;
    return tween(shown, target, duration, (n) => (shown = n));
  });

  const format = (n: number) => i18n.num(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  const text = $derived(format(shown));
  // The larger end of the count, with every digit drawn as the widest one. Counting down, it
  // narrows a digit at a time.
  const widest = $derived(format(Math.max(shown, value)).replace(/\d/g, widestDigit));
</script>

{#if pixel}
  <span class="pixel">
    <span class="sizer" aria-hidden="true"><PixelText text={widest} color="currentColor" /></span>
    <span><PixelText {text} color="currentColor" /></span>
  </span>
{:else}{text}{/if}

<style>
  .pixel {
    display: inline-grid;
    align-items: end;
  }
  .pixel > span {
    grid-area: 1 / 1;
    display: flex;
    align-items: flex-end;
  }
  .sizer {
    visibility: hidden;
  }
</style>

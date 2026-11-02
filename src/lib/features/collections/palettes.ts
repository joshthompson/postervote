// Each collection's colours: the page's background and text, the accents on buttons, titles and
// highlights, and the polka dots. They're set as the CSS variables in tokens.css, on the whole page
// (see CollectionTheme.svelte) or on one part of it, such as the video's stage. A collection
// without a palette of its own here has the first one.

export type Palette = {
  /** The background, and the text and dark surfaces on it. */
  paper: string;
  ink: string;
  muted: string;
  /** Titles, buttons, the chosen poster's glow. */
  accent: string;
  /** A lighter accent, in sparks and confetti. */
  accentSoft: string;
  /** Highlights, often on ink: vote counts, the VS badge, second place. */
  accent2: string;
  /** The polka dots' colours. Repeat one to make it more common. */
  dots: string[];
};

/** The first collection's pinks and yellows. */
export const DEFAULT_PALETTE: Palette = {
  paper: '#fff7ee',
  ink: '#1f1a24',
  muted: '#6d6472',
  accent: '#ff3b5c',
  accentSoft: '#ff7a93',
  accent2: '#ffb000',
  dots: ['#ff2d55', '#ff2d55', '#ff2d55', '#ff5c85', '#ffb300', '#ff6a2b']
};

/** By collection slug. */
const PALETTES: Record<string, Palette> = {
  // Mostly blue, with a few green dots.
  'stockholm-2026-10': {
    paper: '#eef4ff',
    ink: '#131c33',
    muted: '#5a6782',
    accent: '#2f74ff',
    accentSoft: '#8ab0ff',
    accent2: '#4dcfff',
    dots: ['#3a7dff', '#3a7dff', '#3a7dff', '#6a9eff', '#2db5ff', '#9dc1ff', '#5cc93a', '#9edd5a']
  }
};

export const paletteFor = (slug: string | null | undefined): Palette => (slug && PALETTES[slug]) || DEFAULT_PALETTE;

const vars = (p: Palette) => ({
  '--paper': p.paper,
  '--ink': p.ink,
  '--muted': p.muted,
  '--accent': p.accent,
  '--accent-soft': p.accentSoft,
  '--accent-2': p.accent2
});

/** A palette as an inline style, for one part of the page. */
export const paletteStyle = (p: Palette) =>
  Object.entries(vars(p))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

/** Sets a palette on an element, e.g. the page's root. */
export function applyPalette(el: HTMLElement, p: Palette) {
  for (const [name, value] of Object.entries(vars(p))) el.style.setProperty(name, value);
}

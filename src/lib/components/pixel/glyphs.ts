// The hand-drawn pixel letters are the Remi Pop font (lib/assets/fonts, declared in
// lib/styles/fonts.css), which `pnpm font` builds from the drawings in lib/assets/chars.
// One em is 32 art px: a line of text, with every letter standing on its bottom edge.
// These are the letters' sizes, for layout that has to know them before the text is drawn.
// The site shows the letters in capitals only (text-transform in PixelText and Logo), so text is
// measured in capitals too.

import data from '$lib/assets/fonts/remi-pop.json';

type Metrics = { advance: number; height: number };
const metrics: Record<string, Metrics> = data;

const EM = 32;

// A guess for characters the font lacks, which show in the site font instead.
const FALLBACK: Metrics = { advance: 18, height: 28 };
const metricsOf = (char: string) => metrics[char] ?? FALLBACK;

// Ligatures are the entries of more than one character, such as "!=": the font draws them as one.
const ligatures = Object.keys(metrics).filter((key) => [...key].length > 1);

// The letters of a text in capitals, with each ligature as one letter.
function lettersOf(text: string): string[] {
  const upper = text.toUpperCase().normalize('NFC');
  const letters: string[] = [];
  for (let i = 0; i < upper.length; ) {
    const letter = ligatures.find((ligature) => upper.startsWith(ligature, i)) ?? String.fromCodePoint(upper.codePointAt(i)!);
    letters.push(letter);
    i += letter.length;
  }
  return letters;
}

// The digit with the widest drawing: a number written in it is as wide as that many digits get.
export const widestDigit = [...'0123456789'].reduce((widest, d) => (metricsOf(d).advance > metricsOf(widest).advance ? d : widest));

// Width of the widest word in art px. Each letter's advance includes the art pixel after it,
// which the last letter doesn't need.
export const widestWord = (text: string): number =>
  Math.max(...text.split(' ').map((word) => lettersOf(word).reduce((w, letter) => w + metricsOf(letter).advance, 0) - 1));

// Art px between the top of the line and the top of the text's tallest letter.
export const headroom = (text: string): number => EM - Math.max(0, ...lettersOf(text).map((letter) => metricsOf(letter).height));

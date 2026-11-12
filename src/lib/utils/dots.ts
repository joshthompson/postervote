// The hand-drawn pixel dots, as solid-colour sprites: for the polka dots behind the site
// (PolkaDots.svelte) and on the printed posters (features/share/poster.ts).

/** The dot images in lib/assets/dots. */
export const DOT_URLS = Object.values(
  import.meta.glob('../assets/dots/*.png', { eager: true, query: '?url', import: 'default' })
) as string[];

export type Sprite = { canvas: HTMLCanvasElement; aspect: number };

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Loads every dot image. */
export const loadDots = () => Promise.all(DOT_URLS.map(loadImage));

/**
 * Solid-colour copy of a dot image with hard 1-bit alpha, in one of four orientations (`flip`: 1
 * mirrors it, 2 turns it upside down, 3 does both).
 */
export function makeSprite(img: HTMLImageElement, color: string, flip: number): Sprite {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(flip & 1 ? c.width : 0, flip & 2 ? c.height : 0);
  ctx.scale(flip & 1 ? -1 : 1, flip & 2 ? -1 : 1);
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, c.width, c.height);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  for (let i = 0; i < data.data.length; i += 4) {
    const solid = data.data[i + 3] >= 128;
    data.data[i] = r;
    data.data[i + 1] = g;
    data.data[i + 2] = b;
    data.data[i + 3] = solid ? 255 : 0;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(data, 0, 0);
  return { canvas: c, aspect: c.height / c.width };
}

/** Every dot in every colour and orientation. */
export const makeSprites = (images: HTMLImageElement[], colors: string[]) =>
  images.flatMap((img) => colors.flatMap((color) => [0, 1, 2, 3].map((flip) => makeSprite(img, color, flip))));

import { encode } from 'uqr';
import type { Palette } from '$lib/features/collections/palettes';
import { makeSprites, type Sprite } from '$lib/utils/dots';

// A printable poster with a QR code, in a collection's colours: the polka dots, a highlighted tag
// and year, a title in the pixel letters, a subtitle, the QR code in a rounded frame with a word
// either side, a stacked call-out in the corner, and the site's address. After the ones Alisa drew
// for her school. Drawn on a canvas at any width, A-series shaped (1:√2), so the same poster prints
// at A5, A4 or A3. Used by /admin/share.

/** Everything written on a poster. Words in *stars* in the title are in the accent colour. */
export type PosterText = {
  tag: string;
  year: string;
  /** One line per line. */
  title: string;
  subtitle: string;
  left: string;
  right: string;
  /** One word or so per line, stacked. */
  corner: string;
  footer: string;
};

export type PosterDesign = {
  palette: Palette;
  text: PosterText;
  /** What the QR code opens. */
  url: string;
  /** The dot images (`loadDots`). */
  dots: HTMLImageElement[];
  /** Places the dots: the same seed, the same dots. */
  seed: number;
};

/** Height over width, as A-series paper. */
export const ASPECT = Math.SQRT2;
/** The poster is laid out in these units across, and ASPECT times as many down. */
const W = 1000;
const H = W * ASPECT;

export const PAPERS = {
  A5: { mm: [148, 210] },
  A4: { mm: [210, 297] },
  A3: { mm: [297, 420] }
} as const;
export type Paper = keyof typeof PAPERS;

/** Pixels across for printing `paper` at 300 dpi. */
export const printWidth = (paper: Paper) => Math.round((PAPERS[paper].mm[0] / 25.4) * 300);

const PIXEL = '"Remi Pop", "Bricolage Grotesque", system-ui, sans-serif';
const SANS = '"Bricolage Grotesque", system-ui, sans-serif';

/** Waits for the fonts the poster uses, for `text`, so the canvas doesn't draw in a fallback. */
export function loadFonts(text: PosterText) {
  const all = Object.values(text).join('');
  return Promise.all([
    document.fonts.load(`100px ${PIXEL}`, all),
    document.fonts.load(`600 50px ${SANS}`, all),
    document.fonts.load(`700 50px ${SANS}`, all)
  ]);
}

/** Seeded random numbers in [0, 1) (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const spriteCache = new Map<string, Sprite[]>();
function spritesFor(images: HTMLImageElement[], colors: string[]) {
  const key = colors.join();
  let sprites = spriteCache.get(key);
  if (!sprites) spriteCache.set(key, (sprites = makeSprites(images, colors)));
  return sprites;
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** The font size, at most `max`, that fits `text` in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, max: number, width: number) {
  ctx.font = font(max);
  const measured = ctx.measureText(text).width;
  return measured > width ? (max * width) / measured : max;
}

/** A highlighter stroke: a rounded bar centred on (x, y). */
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
}

/** Runs `draw` turned `degrees` about (x, y), with (x, y) as the origin. */
function turned(ctx: CanvasRenderingContext2D, x: number, y: number, degrees: number, draw: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((degrees * Math.PI) / 180);
  draw();
  ctx.restore();
}

/** The pixel dots, on a low-res canvas scaled up with smoothing off, as the site's background. */
function drawDots(ctx: CanvasRenderingContext2D, d: PosterDesign) {
  const sprites = spritesFor(d.dots, d.palette.dots);
  const rand = random(d.seed);
  const across = 200;
  const down = Math.ceil(across * ASPECT);
  const low = document.createElement('canvas');
  low.width = across;
  low.height = down;
  const lc = low.getContext('2d')!;
  lc.imageSmoothingEnabled = false;
  const spacing = 23;
  for (let row = -1, y = 0; y < down + spacing; row++, y = row * spacing * 0.866) {
    for (let x = row % 2 ? -spacing / 2 : 0; x < across + spacing; x += spacing) {
      const big = rand() < 0.07;
      const size = Math.round(spacing * (big ? 0.95 + rand() * 0.2 : 0.3 + rand() * 0.42));
      const sprite = sprites[Math.floor(rand() * sprites.length)];
      const height = Math.round(size * sprite.aspect);
      const jx = (rand() - 0.5) * 0.24 * spacing;
      const jy = (rand() - 0.5) * 0.24 * spacing;
      lc.globalAlpha = 0.16 + rand() * 0.24;
      lc.drawImage(sprite.canvas, Math.round(x + jx - size / 2), Math.round(y + jy - height / 2), size, height);
    }
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, W, (down * W) / across);
  ctx.restore();
}

/** A line of the title, centred on (0, 0) along its baseline, with *starred* words in the accent colour. */
function drawTitleLine(ctx: CanvasRenderingContext2D, line: string, size: number, p: Palette) {
  ctx.font = `${size}px ${PIXEL}`;
  const runs = line.split('*').map((text, i) => ({ text, color: i % 2 ? p.accent : p.ink }));
  const width = runs.reduce((sum, r) => sum + ctx.measureText(r.text).width, 0);
  let x = -width / 2;
  ctx.textAlign = 'left';
  for (const r of runs) {
    ctx.fillStyle = r.color;
    ctx.fillText(r.text, x, 0);
    x += ctx.measureText(r.text).width;
  }
}

/** A word in the pixel letters on a highlighter stroke, centred on (0, 0). */
function highlighted(ctx: CanvasRenderingContext2D, text: string, size: number, p: Palette) {
  ctx.font = `${size}px ${PIXEL}`;
  const m = ctx.measureText(text);
  const mid = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  bar(ctx, 0, size * 0.12, m.width + size * 0.7, size * 0.72, p.accent2);
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, mid);
}

/**
 * Draws the poster on `canvas`, `width` pixels across. Returns where the QR code is, as fractions
 * of the poster's width and height, for a link over it in the PDF.
 */
export function drawPoster(canvas: HTMLCanvasElement, width: number, d: PosterDesign) {
  const { palette: p, text } = d;
  canvas.width = Math.round(width);
  canvas.height = Math.round(width * ASPECT);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);
  drawDots(ctx, d);

  // The tag on a highlighter stroke, with the year scrawled over its end.
  if (text.tag.trim()) {
    ctx.font = `700 54px ${SANS}`;
    const m = ctx.measureText(text.tag.trim());
    const w = Math.min(m.width, 600);
    turned(ctx, 100 + (w + 80) / 2, 128, -3, () => {
      bar(ctx, 0, 4, w + 80, 82, p.accent2);
      ctx.fillStyle = p.ink;
      ctx.textAlign = 'center';
      ctx.fillText(text.tag.trim(), 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2, 600);
    });
    if (text.year.trim())
      turned(ctx, 100 + w + 90, 84, 14, () => {
        ctx.font = `56px ${PIXEL}`;
        ctx.fillStyle = p.accent;
        ctx.textAlign = 'center';
        ctx.fillText(text.year.trim(), 0, 0, 260);
      });
  } else if (text.year.trim()) {
    ctx.font = `64px ${PIXEL}`;
    ctx.fillStyle = p.accent;
    ctx.textAlign = 'center';
    ctx.fillText(text.year.trim(), W / 2, 150);
  }

  // The title, each line as big as fits, tilted a touch one way and the next.
  let y = 205;
  lines(text.title).forEach((line, i) => {
    const plain = line.replaceAll('*', '');
    const size = fit(ctx, plain, (s) => `${s}px ${PIXEL}`, 150, 860);
    ctx.font = `${size}px ${PIXEL}`;
    const m = ctx.measureText(plain);
    y += m.actualBoundingBoxAscent;
    turned(ctx, W / 2, y, i % 2 ? 1.2 : -1.5, () => drawTitleLine(ctx, line, size, p));
    y += m.actualBoundingBoxDescent + size * 0.16;
  });

  y += 34;
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  for (const line of lines(text.subtitle)) {
    const size = fit(ctx, line, (s) => `600 ${s}px ${SANS}`, 50, 820);
    y += size * 1.12;
    ctx.fillText(line, W / 2, y);
  }

  // The QR code, as big as the room left allows, in a rounded frame.
  const top = y + 56;
  const room = 1150 - top;
  const size = Math.max(340, Math.min(520, room));
  const qy = top + Math.max(0, room - size) / 2;
  const qx = (W - size) / 2;
  const stroke = 16;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.roundRect(qx, qy, size, size, 50);
  ctx.fill();
  ctx.stroke();

  const squares = encode(d.url, { ecc: 'Q', border: 0 }).data;
  const quiet = 4;
  const inner = size - stroke * 2;
  const m = inner / (squares.length + quiet * 2);
  const ox = qx + stroke + quiet * m;
  const oy = qy + stroke + quiet * m;
  // One path for every square, so neighbours join without hairline seams.
  const path = new Path2D();
  squares.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let end = c;
      while (row[end + 1]) end++;
      path.rect(ox + c * m, oy + r * m, (end - c + 1) * m, m);
      c = end;
    }
  });
  ctx.fillStyle = p.ink;
  ctx.fill(path);

  // A word either side of the frame.
  const side = qx - 24;
  if (text.left.trim()) {
    const s = fit(ctx, text.left.trim(), (s) => `${s}px ${PIXEL}`, 84, side - 40);
    turned(ctx, qx / 2 + 6, qy + size * 0.3, 18, () => highlighted(ctx, text.left.trim(), s, p));
  }
  if (text.right.trim()) {
    const s = fit(ctx, text.right.trim(), (s) => `${s}px ${PIXEL}`, 84, side - 40);
    turned(ctx, W - qx / 2 - 6, qy + size * 0.2, 22, () => highlighted(ctx, text.right.trim(), s, p));
  }

  // The call-out stacked in the bottom corner.
  const corner = lines(text.corner);
  if (corner.length) {
    const sizes = corner.map((l) => fit(ctx, l, (s) => `${s}px ${PIXEL}`, 62, 210));
    const step = (s: number) => s * 1.02;
    const height = sizes.reduce((sum, s) => sum + step(s), 0);
    turned(ctx, 845, H - 50 - height / 2, 9, () => {
      let ly = -height / 2;
      corner.forEach((line, i) => {
        ly += step(sizes[i]) / 2;
        ctx.save();
        ctx.translate(0, ly);
        highlighted(ctx, line, sizes[i], p);
        ctx.restore();
        ly += step(sizes[i]) / 2;
      });
    });
  }

  if (text.footer.trim()) {
    ctx.font = `700 34px ${SANS}`;
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'left';
    ctx.fillText(text.footer.trim(), 64, H - 54, corner.length ? 600 : W - 128);
  }

  return { x: qx / W, y: qy / H, width: size / W, height: size / H };
}

/** Where on the page the QR code is, as fractions of its width and height. */
export type Area = { x: number; y: number; width: number; height: number };

/**
 * A one-page PDF of `canvas`, `paper` sized, the picture stored losslessly (deflated), with `url`
 * opened from `link` (the QR code) when it's clicked on screen.
 */
export async function canvasToPdf(canvas: HTMLCanvasElement, paper: Paper, url: string, link: Area) {
  const { width, height } = canvas;
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  // zlib-wrapped deflate, which is what PDF's FlateDecode reads.
  const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'));
  const image = new Uint8Array(await new Response(stream).arrayBuffer());

  const [pw, ph] = PAPERS[paper].mm.map((mm) => +((mm / 25.4) * 72).toFixed(2));
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (part: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, dict: string, stream?: Uint8Array<ArrayBuffer>) => {
    offsets[n] = length;
    add(`${n} 0 obj\n${dict}\n`);
    if (stream) {
      add('stream\n');
      add(stream);
      add('\nendstream\n');
    }
    add('endobj\n');
  };

  // The header, then a comment of high bytes so it's taken as binary.
  add('%PDF-1.4\n');
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>`
  );
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>`,
    image
  );
  const content = encoder.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
  object(5, `<< /Length ${content.length} >>`, content);
  // PDF measures up from the bottom.
  const rect = [link.x * pw, (1 - link.y - link.height) * ph, (link.x + link.width) * pw, (1 - link.y) * ph]
    .map((n) => n.toFixed(2))
    .join(' ');
  const uri = url.replace(/[\\()]/g, '\\$&');
  object(6, `<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`);

  const xref = length;
  add(
    `xref\n0 7\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  );
  return new Blob(parts, { type: 'application/pdf' });
}

/** Where a poster's QR code goes. */
export type Target = 'vote' | 'rankings';

/**
 * A poster's words for a collection, from its title ("Stockholm - October 2026": the city, the
 * month and the year), for voting or for its rankings.
 */
export function defaultText(title: string, target: Target): PosterText {
  const parts = title.match(/^(.+?)\s*[-–—]\s*(\p{L}+)\s+(\d{4})$/u);
  const [city, month, year] = parts ? parts.slice(1) : [title, '', ''];
  const vote = target === 'vote';
  return {
    tag: (month || title).toLowerCase(),
    year,
    title: vote ? 'POSTER VOTE!\nPICK THE *BEST*' : 'POSTER VOTE!\nTHE *RANKINGS*',
    subtitle: parts ? `${city}\nthrough its posters` : 'through its posters',
    left: 'SCAN',
    right: vote ? 'VOTE' : 'LOOK',
    corner: vote ? 'TWO\nPOSTERS\nPICK\nONE' : 'SEE\nTHE\nRANK\nINGS',
    footer: 'postervote.com'
  };
}

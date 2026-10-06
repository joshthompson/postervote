#!/usr/bin/env node
// Build the Remi Pop web font from the hand-drawn letters in src/lib/assets/chars/<set>/*.png
// into src/lib/assets/fonts/. All three outputs are committed:
//
//   remi-pop.woff2  the site's font: every dark, opaque pixel of a drawing becomes a square of ink
//   remi-pop.ttf    the whole font with TrueType outlines, to install on a computer
//   remi-pop.json   each character and ligature of the site's font: its advance and ink height in
//                   art pixels, for layout code
//
// The site shows capitals only, so its font leaves out the lowercase drawings (lower_*.png) and
// draws both cases with the capitals. That also keeps descenders out of it: browsers place the
// baseline using the lowest point of any glyph, so a single descender would lift every line.
//
// remi-pop.version.json, beside them, holds the font's version and a fingerprint of what it draws.
// A build that draws anything differently bumps the version, so Font Book (or any font manager)
// sees the new font as newer and offers to replace the one installed. Commit it with the font.
//
//   pnpm font   → rebuild after adding or changing a drawing (`pnpm build` and the deploy run it too)
//
// Name a drawing after its character ("ж.png", "7.png"), or, for characters that filenames can't
// hold, after a name in NAMED ("question.png"). A letter's drawing covers both its cases. To draw
// them separately, name them "upper_<letter>.png" and "lower_<letter>.png" (macOS and Windows
// can't hold "a.png" and "A.png" side by side). A capital drawn alone covers the lowercase too.
// A ligature is a drawing of a character, with the characters it stands in for in LIGATURES:
// "not_equals.png" draws ≠, and typing "!=" shows it too.
// One em is 32 art pixels, which is one line of text. A drawing stands on its bottom edge, unless
// it has one red pixel: then the bottom of that pixel's row is the baseline, and the rows below it
// hang under the line (the descenders of g, j, p…). The red pixel itself isn't drawn.
// Letters are 1 art pixel apart and words 8, as they were when the letters were separate images.
// The same drawings always build the same bytes, so rebuilding never adds noise to the diff.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import opentype from 'opentype.js';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'src/lib/assets/chars');
const OUT = path.join(root, 'src/lib/assets/fonts');
const FAMILY = 'Remi Pop';
const UNIT = 32; // font units per art pixel
const EM = 32; // art pixels per em
const GAP = 1; // art pixels after each letter, part of its advance
const SPACE = 7; // advance of a space; with the gap before it, words are 8 art pixels apart
const CREATED = Date.UTC(2026, 8, 30) / 1000; // a fixed date keeps the output reproducible
const VERSION_FILE = path.join(OUT, 'remi-pop.version.json');

// Who made it and how it may be used, shown by Font Book and other font managers.
const DESIGNERS = 'Joshua Thompson';
const SITE = 'https://postervote.com';
const COPYRIGHT = `© 2026 ${DESIGNERS}`;
const LICENSE =
  'Free for non-commercial use under the Creative Commons Attribution-NonCommercial 4.0 International ' +
  `licence (CC BY-NC 4.0): credit "Remi Pop by ${DESIGNERS}". For commercial use, get in touch ` +
  `through ${SITE} for a commercial licence.`;
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc/4.0/';

// Characters that URLs, macOS or Windows won't take in a filename.
const NAMED = {
  percent: '%',
  question: '?',
  exclamation: '!',
  hash: '#',
  dot: '.',
  period: '.',
  comma: ',',
  slash: '/',
  backslash: '\\',
  colon: ':',
  asterisk: '*',
  quote: '"',
  quote_double: '"',
  quote_double_open: '“',
  quote_double_close: '”',
  apostrophe: "'",
  quote_single_open: '‘',
  quote_single_close: '’',
  lt: '<',
  gt: '>',
  pipe: '|',
  ampersand: '&',
  at: '@',
  semi_colon: ';',
  underscore: '_',
  slash_forward: '/',
  slash_backwards: '\\',
  paren_left: '(',
  paren_right: ')',
  bracket_left: '[',
  bracket_right: ']',
  brace_left: '{',
  brace_right: '}',
  dash_hyphen: '-',
  dash_en: '–',
  dash_em: '—',
  plus: '+',
  minus: '−',
  equals: '=',
  not_equals: '≠',
  less_than: '<',
  greater_than: '>',
  less_than_or_equal_to: '≤',
  greater_than_or_equal_to: '≥',
  arrow_left: '←',
  arrow_right: '→',
  cross: '×',
  backtick: '`',
  forwardtick: '´'
};

// Characters typed together that the font draws as one, with the character whose drawing it uses.
// They're standard ligatures (`liga`), which browsers, Figma and most apps apply by default.
const LIGATURES = {
  '!=': '≠'
};

const LOWER = 'lower_';
const UPPER = 'upper_';
const isCased = (name) => name.startsWith(LOWER) || name.startsWith(UPPER);

// The character a drawing's name stands for.
function charOf(name) {
  if (name.startsWith(LOWER)) return name.slice(LOWER.length).toLowerCase();
  if (name.startsWith(UPPER)) return name.slice(UPPER.length).toUpperCase();
  return NAMED[name] ?? name;
}

async function readDrawings() {
  const files = (await fs.readdir(SRC, { recursive: true })).filter((f) => f.endsWith('.png')).sort();
  // macOS can store filenames decomposed (й as и + combining breve), so compare in NFC.
  const names = new Map(files.map((f) => [f, path.basename(f, '.png').normalize('NFC')]));
  const chars = new Set([...names.values()].map(charOf));
  const cased = new Set([...names.values()].filter(isCased).map((n) => charOf(n).toLowerCase()));
  const drawings = new Map();
  for (const file of files) {
    const name = names.get(file);
    const char = charOf(name);
    if ([...char].length !== 1) throw new Error(`${file}: name it after a single character, or add its name to NAMED`);
    if (!isCased(name) && cased.has(char.toLowerCase())) {
      throw new Error(`${file}: "${char}" is drawn case by case, so name this upper_${char.toLowerCase()}.png or lower_${char.toLowerCase()}.png`);
    }
    // The site's font draws both cases with the capital, so a letter without one would be missing.
    if (name.startsWith(LOWER) && !chars.has(char.toUpperCase())) {
      throw new Error(`${file}: draw its capital too, as upper_${char}.png`);
    }
    if (drawings.has(char)) throw new Error(`${file}: "${char}" is already drawn by ${drawings.get(char).file}`);
    const png = PNG.sync.read(await fs.readFile(path.join(SRC, file)));
    drawings.set(char, { file, ...png, descent: descentOf(file, png), lowercase: name.startsWith(LOWER) });
  }
  return drawings;
}

// Dark, opaque pixels are ink, except the red baseline marker; anything else is background.
const isMarker = (data, i) => data[i + 3] >= 128 && data[i] >= 128 && data[i + 1] < 100 && data[i + 2] < 100;
const isInk = (data, i) => data[i + 3] >= 128 && data[i] + data[i + 1] + data[i + 2] < 384 && !isMarker(data, i);

// Art pixels of a drawing below its baseline: the rows under its red pixel, if it has one.
function descentOf(file, { width, height, data }) {
  const rows = [];
  for (let i = 0; i < data.length; i += 4) if (isMarker(data, i)) rows.push(Math.floor(i / 4 / width));
  if (rows.length > 1) throw new Error(`${file}: has ${rows.length} red pixels; mark the baseline with one`);
  return rows.length ? height - 1 - rows[0] : 0;
}

// How far a drawing's ink reaches up from its baseline, in art pixels.
function inkHeight({ width, height, data, descent }) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (isInk(data, (y * width + x) * 4)) return Math.max(0, height - descent - y);
  }
  return 0;
}

// The outline of a drawing's ink, as closed contours of corner points in art pixels (y up from the
// bottom edge). Every edge between ink and background runs with the ink on its left, so outer
// contours go anticlockwise and holes clockwise. Where two ink pixels touch only at a corner the
// contour turns left, which keeps them as separate shapes.
function trace({ width: w, height: h, data }) {
  const ink = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = ((h - 1 - y) * w + x) * 4;
    return isInk(data, i);
  };
  const edges = new Map(); // "x,y" → directions of the edges leaving that corner
  const add = (x, y, dx, dy) => {
    const key = `${x},${y}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([dx, dy]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink(x, y)) continue;
      if (!ink(x, y - 1)) add(x, y, 1, 0);
      if (!ink(x + 1, y)) add(x + 1, y, 0, 1);
      if (!ink(x, y + 1)) add(x + 1, y + 1, -1, 0);
      if (!ink(x - 1, y)) add(x, y + 1, 0, -1);
    }
  }

  const contours = [];
  for (const [start, leaving] of edges) {
    while (leaving.length) {
      const [x0, y0] = start.split(',').map(Number);
      const [dx0, dy0] = leaving.pop();
      let [x, y, dx, dy] = [x0 + dx0, y0 + dy0, dx0, dy0];
      const points = [];
      while (x !== x0 || y !== y0) {
        const options = edges.get(`${x},${y}`);
        const turn = [[-dy, dx], [dx, dy], [dy, -dx]] // left, straight on, right
          .map(([tx, ty]) => options.findIndex(([ex, ey]) => ex === tx && ey === ty))
          .find((i) => i >= 0);
        const [nx, ny] = options.splice(turn, 1)[0];
        if (nx !== dx || ny !== dy) points.push([x, y]);
        [dx, dy] = [nx, ny];
        [x, y] = [x + dx, y + dy];
      }
      if (dx !== dx0 || dy !== dy0) points.push([x0, y0]);
      contours.push(points);
    }
  }
  return contours;
}

function makeGlyph(char, codePoints, drawing) {
  const outline = new opentype.Path();
  const contours = trace(drawing);
  for (const points of contours) {
    // Up from the baseline, so descenders go below it.
    const at = ([x, y]) => [x * UNIT, (y - drawing.descent) * UNIT];
    points.forEach((point, i) => (i ? outline.lineTo(...at(point)) : outline.moveTo(...at(point))));
    outline.close();
  }
  return new opentype.Glyph({
    name: `uni${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
    unicode: codePoints[0],
    unicodes: codePoints,
    advanceWidth: (drawing.width + GAP) * UNIT,
    // Where the ink starts. opentype.js would write 0, which CFF ignores but TrueType places the
    // glyph by, so a drawing with empty columns on its left would shift left in the .ttf.
    leftSideBearing: contours.length ? Math.min(...contours.flat().map(([x]) => x)) * UNIT : 0,
    path: outline
  });
}

/**
 * opentype.js stamps `modified` with the current time and always writes revision 1.0. Copy the
 * fixed `created` time over `modified`, write `revision`, then redo the checksums that covers.
 */
function stampHead(otf, revision) {
  const sum = (from, to) => {
    let s = 0;
    for (let i = from; i < to; i += 4) s = (s + otf.readUInt32BE(i)) >>> 0;
    return s;
  };
  for (let record = 12; record < 12 + 16 * otf.readUInt16BE(4); record += 16) {
    if (otf.toString('latin1', record, record + 4) !== 'head') continue;
    const head = otf.readUInt32BE(record + 8);
    otf.copy(otf, head + 28, head + 20, head + 28);
    otf.writeInt32BE(Math.round(revision * 65536), head + 4); // fontRevision, 16.16 fixed point
    otf.writeUInt32BE(0, head + 8);
    otf.writeUInt32BE(sum(head, head + 56), record + 4); // the 54-byte table, zero-padded
    otf.writeUInt32BE((0xb1b0afba - sum(0, otf.length)) >>> 0, head + 8);
  }
}

/** The tables of an OpenType font, in the order of its table directory. */
function readTables(font) {
  return Array.from({ length: font.readUInt16BE(4) }, (_, i) => {
    const record = 12 + 16 * i;
    const offset = font.readUInt32BE(record + 8);
    return { tag: font.toString('latin1', record, record + 4), data: font.subarray(offset, offset + font.readUInt32BE(record + 12)) };
  });
}

const pad4 = (data) => Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);

/** The sum of a table's big-endian 32-bit words, zero-padded to a whole word, as checksums are. */
function checksum(data) {
  const padded = pad4(data);
  let s = 0;
  for (let i = 0; i < padded.length; i += 4) s = (s + padded.readUInt32BE(i)) >>> 0;
  return s;
}

// WOFF2 with no table transforms: the header, a table directory, then every table in one Brotli
// stream. Tags with an index here are written as that index; any other tag is spelled out.
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF '];

function toWoff2(otf) {
  const tables = readTables(otf);
  const base128 = (n) => {
    const bytes = [n & 0x7f];
    while ((n = Math.floor(n / 128))) bytes.unshift(0x80 | (n & 0x7f));
    return bytes;
  };
  const directory = Buffer.from(
    tables.flatMap(({ tag, data }) => {
      const known = KNOWN_TAGS.indexOf(tag);
      return [...(known >= 0 ? [known] : [63, ...Buffer.from(tag, 'latin1')]), ...base128(data.length)];
    })
  );
  const stream = Buffer.concat(tables.map((t) => t.data));
  const compressed = zlib.brotliCompressSync(stream, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: stream.length
    }
  });
  const length = Math.ceil((48 + directory.length + compressed.length) / 4) * 4;
  const header = Buffer.alloc(48);
  header.write('wOF2', 0, 'latin1');
  header.write('OTTO', 4, 'latin1'); // CFF outlines
  header.writeUInt32BE(length, 8);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(12 + 16 * tables.length + tables.reduce((n, t) => n + Math.ceil(t.data.length / 4) * 4, 0), 16);
  header.writeUInt32BE(compressed.length, 20);
  header.writeUInt16BE(1, 24); // font version 1.0
  return Buffer.concat([header, directory, compressed], length);
}

/**
 * A glyph's entry in the `glyf` table. TrueType draws outer contours clockwise, the other way round
 * from CFF, and as the drawings have only straight edges, every point is on the curve.
 */
function glyfEntry(glyph) {
  const contours = [];
  for (const c of glyph.path.commands) {
    if (c.type === 'M') contours.push([[c.x, c.y]]);
    else if (c.type === 'L') contours.at(-1).push([c.x, c.y]);
  }
  if (!contours.length) return Buffer.alloc(0);
  const points = contours.flatMap((c) => c.reverse());
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const header = Buffer.alloc(10 + 2 * contours.length + 2); // ends with no instructions
  header.writeInt16BE(contours.length, 0);
  [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((v, i) => header.writeInt16BE(v, 2 + 2 * i));
  let last = -1;
  contours.forEach((c, i) => header.writeUInt16BE((last += c.length), 10 + 2 * i));
  // Flags: on the curve, with each coordinate a 16-bit change from the point before.
  const flags = Buffer.alloc(points.length, 1);
  const coords = Buffer.alloc(4 * points.length); // every x, then every y
  points.forEach(([x, y], i) => {
    const [px, py] = i ? points[i - 1] : [0, 0];
    coords.writeInt16BE(x - px, 2 * i);
    coords.writeInt16BE(y - py, 2 * (points.length + i));
  });
  return pad4(Buffer.concat([header, flags, coords]));
}

/**
 * The font as a .ttf: opentype.js only writes CFF outlines, so swap its `CFF ` table for `glyf`
 * and `loca`, with the `maxp` and `head` that go with them. Every other table stays as it is.
 */
function toTtf(otf, glyphs) {
  const entries = glyphs.map(glyfEntry);
  const loca = Buffer.alloc(4 * (entries.length + 1)); // the long format: 32-bit offsets
  const end = entries.reduce((offset, entry, i) => (loca.writeUInt32BE(offset, 4 * i), offset + entry.length), 0);
  loca.writeUInt32BE(end, 4 * entries.length);

  const outlines = glyphs.map((g) => g.path.commands.filter((c) => c.type !== 'Z'));
  const maxp = Buffer.alloc(32); // version 1.0, which TrueType outlines need
  maxp.writeUInt32BE(0x00010000, 0);
  maxp.writeUInt16BE(glyphs.length, 4);
  maxp.writeUInt16BE(Math.max(...outlines.map((o) => o.length)), 6); // points
  maxp.writeUInt16BE(Math.max(...outlines.map((o) => o.filter((c) => c.type === 'M').length)), 8); // contours
  maxp.writeUInt16BE(2, 14); // zones, as the spec advises; there are no instructions to use them

  const tables = readTables(otf)
    .filter(({ tag }) => tag !== 'CFF ' && tag !== 'maxp')
    .map(({ tag, data }) => {
      if (tag !== 'head') return { tag, data };
      const head = Buffer.from(data);
      head.writeUInt32BE(0, 8); // checksumAdjustment, set once the whole file is known
      head.writeInt16BE(1, 50); // indexToLocFormat: long
      return { tag, data: head };
    })
    .concat([
      { tag: 'glyf', data: Buffer.concat(entries) },
      { tag: 'loca', data: loca },
      { tag: 'maxp', data: maxp }
    ])
    .sort((a, b) => (a.tag < b.tag ? -1 : 1));

  const directory = Buffer.alloc(12 + 16 * tables.length);
  const log2 = Math.floor(Math.log2(tables.length));
  directory.writeUInt32BE(0x00010000, 0); // TrueType outlines
  directory.writeUInt16BE(tables.length, 4);
  directory.writeUInt16BE(16 * 2 ** log2, 6);
  directory.writeUInt16BE(log2, 8);
  directory.writeUInt16BE(16 * (tables.length - 2 ** log2), 10);
  let offset = directory.length;
  tables.forEach(({ tag, data }, i) => {
    const record = 12 + 16 * i;
    directory.write(tag, record, 'latin1');
    directory.writeUInt32BE(checksum(data), record + 4);
    directory.writeUInt32BE(offset, record + 8);
    directory.writeUInt32BE(data.length, record + 12);
    offset += pad4(data).length;
  });
  const ttf = Buffer.concat([directory, ...tables.map(({ data }) => pad4(data))]);
  const head = ttf.readUInt32BE(12 + 16 * tables.findIndex(({ tag }) => tag === 'head') + 8);
  ttf.writeUInt32BE((0xb1b0afba - checksum(ttf)) >>> 0, head + 8);
  return ttf;
}

/** The glyphs for a set of drawings, with each character's metrics and the set's extremes. */
function glyphSet(drawings) {
  const space = { advance: SPACE, height: 0 };
  const metrics = { ' ': space, '\u00a0': space };
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', advanceWidth: SPACE * UNIT, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'space', unicode: 0x20, unicodes: [0x20, 0xa0], advanceWidth: SPACE * UNIT, path: new opentype.Path() })
  ];
  let tallest = 0;
  let deepest = 0;
  for (const [char, drawing] of [...drawings].sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0))) {
    // The character itself, then its other case unless that has a drawing of its own.
    const chars = [...new Set([char, char.toUpperCase(), char.toLowerCase()])].filter(
      (c) => [...c].length === 1 && (c === char || !drawings.has(c))
    );
    for (const c of chars) metrics[c] = { advance: drawing.width + GAP, height: inkHeight(drawing) };
    glyphs.push(makeGlyph(char, chars.map((c) => c.codePointAt(0)), drawing));
    tallest = Math.max(tallest, drawing.height - drawing.descent);
    deepest = Math.max(deepest, drawing.descent);
  }
  // A ligature swaps its characters' glyphs for the glyph of the character it draws.
  const glyphOf = (c) => {
    const index = glyphs.findIndex((g) => g.unicodes.includes(c.codePointAt(0)));
    if (index < 0) throw new Error(`LIGATURES: "${c}" has no drawing`);
    return index;
  };
  const ligatures = Object.entries(LIGATURES).map(([text, char]) => {
    metrics[text] = metrics[char];
    return { sub: [...text].map(glyphOf), by: glyphOf(char) };
  });
  // The Windows ascent and descent leave room for drawings taller than a line and for
  // descenders, so Windows doesn't clip them.
  const winMetrics = { usWinAscent: Math.max(EM, tallest) * UNIT, usWinDescent: deepest * UNIT };
  return { glyphs, ligatures, metrics, tallest, winMetrics };
}

const drawings = await readDrawings();
const full = glyphSet(drawings);
const site = glyphSet(new Map([...drawings].filter(([, d]) => !d.lowercase)));
const descending = [...drawings.values()].filter((d) => !d.lowercase && d.descent);
if (descending.length) {
  throw new Error(`${descending.map((d) => d.file).join(', ')}: only lowercase letters can go below the baseline (see above)`);
}

// Everything a font manager would see differently, so the version only moves when the font does.
const fingerprint = crypto
  .createHash('sha256')
  .update(
    JSON.stringify([full.glyphs.map((g) => [g.unicodes, g.advanceWidth, g.path.commands]), full.ligatures, full.winMetrics, COPYRIGHT, LICENSE])
  )
  .digest('hex')
  .slice(0, 16);
const previous = await fs
  .readFile(VERSION_FILE, 'utf8')
  .then(JSON.parse)
  .catch(() => ({ build: 0, fingerprint: null }));
const build = previous.fingerprint === fingerprint ? previous.build : previous.build + 1;
// 1.001, 1.002…: font managers compare versions as numbers, and three decimals is what they show.
const version = `1.${String(build).padStart(3, '0')}`;

/** A set of glyphs as an OpenType font with CFF outlines. */
function makeFont({ glyphs, ligatures, winMetrics }) {
  const font = new opentype.Font({
    familyName: FAMILY,
    styleName: 'Regular',
    version: `Version ${version}`,
    copyright: COPYRIGHT,
    designer: DESIGNERS,
    designerURL: SITE,
    manufacturer: DESIGNERS,
    manufacturerURL: SITE,
    description: `The hand-drawn lettering of Poster Vote! (${SITE}).`,
    license: LICENSE,
    licenseURL: LICENSE_URL,
    unitsPerEm: EM * UNIT,
    ascender: EM * UNIT,
    descender: 0,
    createdTimestamp: CREATED,
    fsSelection: 0x40 | 0x80, // regular; use the ascender and descender below on Windows too
    glyphs,
    // Version 4 defines that Windows flag. The descender stays 0, so the line is still one em with
    // the baseline at its bottom, and descenders hang below it.
    tables: { os2: { version: 4, ...winMetrics } }
  });
  for (const ligature of ligatures) font.substitution.addLigature('liga', ligature);
  // Unique per version, so the system doesn't mistake one version's cached copy for another's.
  for (const names of Object.values(font.names)) names.uniqueID = { en: `${FAMILY} Regular ${version}` };
  const otf = Buffer.from(font.toArrayBuffer());
  stampHead(otf, Number(version));
  return otf;
}

const woff2 = toWoff2(makeFont(site));
const ttf = toTtf(makeFont(full), full.glyphs);

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'remi-pop.woff2'), woff2);
await fs.writeFile(path.join(OUT, 'remi-pop.ttf'), ttf);
// One character per line, with the invisible non-breaking space spelled out.
const jsonKey = (c) => JSON.stringify(c).replace('\u00a0', '\\u00a0');
const entries = Object.entries(site.metrics).map(([c, m]) => `  ${jsonKey(c)}: ${JSON.stringify(m)}`);
await fs.writeFile(path.join(OUT, 'remi-pop.json'), `{\n${entries.join(',\n')}\n}\n`);
await fs.writeFile(VERSION_FILE, `${JSON.stringify({ build, fingerprint }, null, 2)}\n`);
console.log(
  `${FAMILY} ${version}${build === previous.build ? '' : ' (new)'}: ${drawings.size} drawings, ${entries.length} characters on the site, ` +
    `remi-pop.woff2 ${(woff2.length / 1024).toFixed(1)} KB, remi-pop.ttf ${(ttf.length / 1024).toFixed(1)} KB`
);
if (full.tallest > EM) console.warn(`  ! the tallest drawing is ${full.tallest} art px, taller than a line (${EM}); it will overlap the line above`);

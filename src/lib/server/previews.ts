import fs from 'node:fs/promises';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '$convex/api';
import type { Archive } from '$shared';
import { posterNames } from '$lib/features/results/links';

// Link previews for posters' own pages. Crawlers don't run the app, so the build prerenders a page
// for every poster, in Convex or in an archived collection (archives/<slug>/results.json), and
// `hooks.server.ts` puts the poster's title and image into the preview tags from app.html. Posters
// synced after the build still open (through the 404.html fallback) but share with the site's own
// preview until the next deploy.

type Preview = { collection: string; name: string; title: string; collectionTitle: string; image: string };

let previews: Promise<Map<string, Preview>> | undefined;

/** Every poster's preview, by "<collection slug>/<name>", fetched once per build. */
const load = () => (previews ??= fetchPreviews());

// Only the build reads these, so they stay out of the site's bundle.
const archives = Object.values(import.meta.glob<Archive>('/archives/*/results.json', { eager: true, import: 'default' }));

async function fetchPreviews() {
  const map = new Map<string, Preview>();
  const add = (c: { slug: string; title: string; posters: Archive['posters'] }) => {
    for (const [id, name] of posterNames(c.posters)) {
      const p = c.posters.find((p) => p._id === id)!;
      map.set(`${c.slug}/${name}`, { collection: c.slug, name, title: p.title, collectionTitle: c.title, image: p.image });
    }
  };
  for (const a of archives) add({ ...a.collection, posters: a.posters });
  if (!PUBLIC_CONVEX_URL) return map;
  const archived = new Set(archives.map((a) => a.collection.slug));
  try {
    for (const c of await new ConvexHttpClient(PUBLIC_CONVEX_URL).query(api.posters.all, {})) {
      if (!archived.has(c.slug)) add(c);
    }
  } catch (e) {
    console.warn(`Poster pages in Convex are built without their own link previews: ${e instanceof Error ? e.message : e}`);
  }
  return map;
}

/** The poster pages to prerender. */
export const posterEntries = async () =>
  [...(await load()).values()].map(({ collection, name }) => ({ collection, name }));

/** The preview for a poster's page, if the poster was in Convex when the build started. */
export const posterPreview = async (collection = '', name = '') => (await load()).get(`${collection}/${name}`);

/** A prerendered page with app.html's preview tags (whose og:url is the site's address) set for this poster. */
export async function withPreview(html: string, pathname: string, p: Preview) {
  const site = html.match(/<meta property="og:url" content="([^"]*)"/)?.[1];
  if (!site) return html;
  const image = new URL(p.image, site).href;
  const size = await jpegSize(p.image);
  html = html.replace(
    /<title>([^<]*)<\/title>/,
    (_, brand) => `<title>${escape(`${p.title} · ${p.collectionTitle} · `)}${brand}</title>`
  );
  return setMeta(html, {
    'og:title': p.title,
    'og:url': new URL(pathname, site).href,
    'og:image': image,
    'og:image:type': size ? 'image/jpeg' : null,
    'og:image:width': size ? String(size.width) : null,
    'og:image:height': size ? String(size.height) : null,
    'og:image:alt': `Poster: ${p.title}`,
    'twitter:title': p.title,
    'twitter:image': image
  });
}

/** Sets the content of app.html's <meta> tags by property or name; null removes the tag. */
function setMeta(html: string, tags: Record<string, string | null>) {
  for (const [key, value] of Object.entries(tags)) {
    html = html.replace(new RegExp(`<meta (?:property|name)="${key}" content="[^"]*" />\\s*`), (tag) =>
      value === null ? '' : tag.replace(/content="[^"]*"/, () => `content="${escape(value)}"`)
    );
  }
  return html;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A poster's width and height if it's a JPEG in static/, read from its frame header. */
async function jpegSize(image: string) {
  if (/^https?:\/\//.test(image) || !/\.jpe?g$/i.test(image)) return;
  const bytes = await fs.readFile(path.join('static', image)).catch(() => undefined);
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return;
  // Step through the segments to the first start-of-frame (C0–CF, apart from C4, C8 and CC).
  for (let i = 2; i + 9 < bytes.length && bytes[i] === 0xff; i += 2 + bytes.readUInt16BE(i + 2)) {
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
  }
}

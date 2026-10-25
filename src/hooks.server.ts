import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { posterPreview, withPreview } from '$lib/server/previews';

// Only runs while building (the site is static): gives each prerendered poster page a link
// preview with the poster's own title and image.
export const handle: Handle = async ({ event, resolve }) => {
  if (!building || event.route.id !== '/poster/[collection]/[name]') return resolve(event);
  const preview = await posterPreview(event.params.collection, event.params.name);
  if (!preview) return resolve(event);
  return resolve(event, { transformPageChunk: ({ html }) => withPreview(html, event.url.pathname, preview) });
};

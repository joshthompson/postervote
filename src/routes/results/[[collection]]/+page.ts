import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

// A collection's results used to be at /results/<slug>; they're at /collections/<slug> now.
export const load: PageLoad = ({ params }) => {
  if (params.collection) redirect(308, resolve('/collections/[collection]', { collection: params.collection }));
};

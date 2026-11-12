import { afterNavigate, replaceState } from '$app/navigation';
import { page } from '$app/state';

/**
 * Keeps the address's query in step with `params`, without navigating, so a page can be shared
 * or bookmarked as it is. Undefined values are left out; an empty one is kept (`?tag=`), as a field
 * deliberately left blank, so leave out a value that's empty by default. Call it while a component
 * starts; read the starting values from `page.url.searchParams`.
 */
export function syncSearchParams(params: () => Record<string, string | number | undefined>) {
  // SvelteKit refuses `replaceState` until its router has started.
  let started = $state(false);
  afterNavigate(() => (started = true));
  $effect(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params()))
      if (value !== undefined) search.set(key, String(value));
    if (!started) return;
    const query = search.size ? `?${search}` : '';
    if (query !== location.search) replaceState(location.pathname + query + location.hash, page.state);
  });
}

import { useQuery } from 'convex-svelte';
import type { FunctionReturnType } from 'convex/server';
import { api } from '$convex/api';
import { archiveOf, isArchived } from '$lib/features/collections/archives.svelte';
import { storage } from './storage';

// A collection's poster list, kept in localStorage with its version. The server is only asked
// whether that version is still current (a few bytes back); the list itself is sent on a first
// visit and after posters are synced. The query is live, so a sync reaches open pages too.
// An archived collection's list comes from its archive instead (see archives.svelte.ts).

export type PosterInfo = NonNullable<FunctionReturnType<typeof api.posters.list>['posters']>[number];
type PosterId = PosterInfo['_id'];
// `removed` is missing from lists stored before it was sent.
type Cached = { version: string; posters: PosterInfo[]; removed?: PosterId[] };

/** The posters of `collection` (a slug, or undefined for the active one), once the server has confirmed them. */
export function usePosters(collection: () => string | undefined) {
  const key = $derived(`posters:${collection() ?? 'active'}`);
  // Lists received this visit, by key; otherwise whatever was stored last time.
  const received = $state<Record<string, Cached>>({});
  const cached = $derived(received[key] ?? storage.getJSON<Cached | null>(key, null));
  const archive = $derived.by(() => {
    const slug = collection();
    return isArchived(slug) ? archiveOf(slug) : null;
  });

  // Keeping the previous result covers the moment `since` moves on to a list just received.
  const query = useQuery(
    api.posters.list,
    () => (archive === null ? { collection: collection(), since: cached?.version } : 'skip'),
    { keepPreviousData: true }
  );

  $effect(() => {
    const result = query.data;
    if (!result?.posters) return;
    const list = { version: result.version, posters: result.posters, removed: result.removed ?? [] };
    received[key] = list;
    storage.setJSON(key, list);
  });

  /** The archive, once it has loaded. */
  const loaded = () => (archive && !(archive instanceof Error) ? archive : undefined);

  return {
    /** Undefined until the server has said which version is current. */
    get data(): PosterInfo[] | undefined {
      if (archive !== null) return loaded()?.posters;
      const result = query.data;
      if (!result) return undefined;
      if (result.posters) return result.posters;
      return cached?.version === result.version ? cached.posters : undefined;
    },
    /** Ids of posters taken out of the collection, alongside `data`. */
    get removed(): PosterId[] {
      if (archive !== null) return loaded()?.removed ?? [];
      const result = query.data;
      if (result?.posters) return result.removed ?? [];
      return cached?.removed ?? [];
    },
    /** The collection's id, once the server has said; null if there isn't one (or it's archived). */
    get collectionId() {
      return archive !== null ? null : query.data?.collectionId;
    },
    /** The id it had as a competition, which visitors' places in its vote order may still be kept under. */
    get formerId() {
      return archive !== null ? null : query.data?.formerId;
    },
    /** The collection's slug, as in its links, once the server has said; null if there isn't one. */
    get slug() {
      return archive !== null ? collection() : query.data?.slug;
    },
    get error() {
      return archive instanceof Error ? archive : query.error;
    },
    get isLoading() {
      return this.data === undefined && !this.error;
    }
  };
}

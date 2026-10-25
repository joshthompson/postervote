import { query, type QueryCtx } from './_generated/server';

/** The collection being voted on, or null before the first sync. */
export const getActive = (ctx: QueryCtx) =>
  ctx.db
    .query('collections')
    .withIndex('by_active', (q) => q.eq('active', true))
    .first();

/** A collection by slug, or the active one when there's no slug. */
export const find = (ctx: QueryCtx, slug?: string) =>
  slug
    ? ctx.db
        .query('collections')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
    : getActive(ctx);

const PREVIEW = 3;

/**
 * Every collection still in Convex, the live one first, then the closed ones newest first, each
 * with its vote and poster counts and its top posters as a preview. Collections archived to the repo and
 * cleared from here are listed by the site from their archives instead (see archives.ts).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const collections = (await ctx.db.query('collections').order('desc').collect()).sort(
      (a, b) => Number(b.active) - Number(a.active)
    );
    return Promise.all(
      collections.map(async (c) => {
        const snapshot = await ctx.db
          .query('snapshots')
          .withIndex('by_segment', (q) => q.eq('collectionId', c._id).eq('segment', 'all'))
          .unique();
        const live = await ctx.db
          .query('live')
          .withIndex('by_collection', (q) => q.eq('collectionId', c._id))
          .unique();
        const posters = await ctx.db
          .query('posters')
          .withIndex('by_collection_active', (q) => q.eq('collectionId', c._id).eq('active', true))
          .collect();
        const top = [];
        for (const s of [...(snapshot?.scores ?? [])].sort((a, b) => b.rating - a.rating).slice(0, PREVIEW)) {
          const poster = await ctx.db.get(s.id);
          if (poster) top.push({ title: poster.title, image: poster.image });
        }
        return {
          slug: c.slug,
          title: c.title,
          active: c.active,
          openedAt: c.openedAt,
          closedAt: c.closedAt ?? null,
          votes: Math.max(snapshot?.votes ?? 0, live?.all ?? 0),
          posters: posters.length,
          top
        };
      })
    );
  }
});

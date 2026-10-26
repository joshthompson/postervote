import { internalMutation, query, type QueryCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { settle } from './tally';

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
 * with its vote and poster counts and its top posters as a preview. With `drafts` (the site's dev
 * mode), drafts come first. Collections archived to the repo and cleared from here are listed by
 * the site from their archives instead (see archives.svelte.ts).
 */
export const list = query({
  args: { drafts: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rank = (c: { active: boolean; draft?: boolean }) => (c.draft ? 2 : c.active ? 1 : 0);
    const collections = (await ctx.db.query('collections').order('desc').collect())
      .filter((c) => args.drafts || !c.draft)
      .sort((a, b) => rank(b) - rank(a));
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
        // A draft has no votes to rank by, so its first few posters stand in.
        if (c.draft) top.push(...posters.slice(0, PREVIEW).map(({ title, image }) => ({ title, image })));
        return {
          slug: c.slug,
          title: c.title,
          active: c.active,
          draft: !!c.draft,
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

/**
 * Make a draft the live collection, closing voting on the one before (if any) and having the
 * tally count its last votes, ready for `pnpm collections archive`. Called by
 * `pnpm collections publish`, which archives it straight after.
 */
export const publish = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const draft = await find(ctx, slug);
    if (!draft) throw new ConvexError(`No collection "${slug}". Draft it first: pnpm collections draft`);
    if (draft.active) throw new ConvexError(`"${slug}" is already live`);
    if (!draft.draft) throw new ConvexError(`"${slug}" has closed; only a draft can be published`);
    const posters = await ctx.db
      .query('posters')
      .withIndex('by_collection_active', (q) => q.eq('collectionId', draft._id).eq('active', true))
      .take(2);
    if (posters.length < 2) throw new ConvexError(`"${slug}" needs at least two posters to vote on`);

    const now = Date.now();
    const live = await getActive(ctx);
    if (live) {
      await ctx.db.patch(live._id, { active: false, closedAt: now });
      await settle(ctx, live._id);
    }
    await ctx.db.patch(draft._id, { active: true, draft: undefined, openedAt: now });
    return { published: draft.title, closed: live && { slug: live.slug, title: live.title } };
  }
});

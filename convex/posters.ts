import { internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { find, getActive } from './collections';
import { requestRun, startRebuild } from './tally';

/** Identifies a collection's poster list as it is now; it changes whenever the list does. */
export const posterVersion = (c: Doc<'collections'>) => `${c._id}:${c.postersUpdatedAt ?? 0}`;

/**
 * A collection's current posters (by slug, or the active one), with its id (and the one it had as
 * a competition, if it was one) and slug, the ids of posters taken out of it, and the `version`
 * of the list. Pages keep the list and pass its version
 * as `since`: if it's still current, `posters` is null and nothing else is read, so a returning
 * visitor is sent a few bytes instead of the list.
 */
export const list = query({
  args: { collection: v.optional(v.string()), since: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const collection = await find(ctx, args.collection);
    if (!collection) return { collectionId: null, formerId: null, slug: null, version: '', posters: [], removed: [] };
    const collectionId = collection._id;
    const formerId = collection.formerId ?? null;
    const slug = collection.slug;
    const version = posterVersion(collection);
    if (args.since === version) return { collectionId, formerId, slug, version, posters: null, removed: null };
    const posters = await ctx.db
      .query('posters')
      .withIndex('by_collection_active', (q) => q.eq('collectionId', collection._id).eq('active', true))
      .collect();
    return {
      collectionId,
      formerId,
      slug,
      version,
      posters: posters.map(({ _id, title, image }) => ({ _id, title, image })),
      removed: collection.removed ?? []
    };
  }
});

/**
 * Every published collection's current posters, in the same order as `list`. The site build reads
 * it to prerender each poster's page with its own link preview (see src/lib/server/previews.ts);
 * drafts' posters are left out, so nothing in the built site gives them away.
 */
export const all = query({
  args: {},
  handler: async (ctx) => {
    const collections = (await ctx.db.query('collections').collect()).filter((c) => !c.draft);
    return Promise.all(
      collections.map(async (c) => {
        const posters = await ctx.db
          .query('posters')
          .withIndex('by_collection_active', (q) => q.eq('collectionId', c._id).eq('active', true))
          .collect();
        return { slug: c.slug, title: c.title, posters: posters.map(({ _id, title, image }) => ({ _id, title, image })) };
      })
    );
  }
});

/**
 * Upsert a collection's posters by key, and deactivate any of its posters not in the list. Only
 * what differs is written, and the collection's poster version moves on only if the list changed,
 * so pages keep their copy. It updates the live collection or a draft; a new slug becomes a draft
 * with `draft` (publish it with `collections.publish`), or the live collection if none is.
 * Closed collections can't change. Called by `pnpm posters:sync` and `pnpm collections draft`.
 */
export const sync = internalMutation({
  args: {
    collection: v.object({ slug: v.string(), title: v.string() }),
    posters: v.array(v.object({ key: v.string(), title: v.string(), image: v.string() })),
    draft: v.optional(v.boolean())
  },
  handler: async (ctx, { collection, posters, draft = false }) => {
    const existingCollection = await find(ctx, collection.slug);
    if (existingCollection && !existingCollection.active && !existingCollection.draft) {
      throw new ConvexError(`"${collection.slug}" has closed. Give the next collection its own slug.`);
    }
    const active = await getActive(ctx);
    if (!existingCollection && active && !draft) {
      throw new ConvexError(
        `"${active.slug}" is live, not "${collection.slug}". To make "${collection.slug}" the next collection, draft it: pnpm collections draft.`
      );
    }

    const isDraft = existingCollection ? !!existingCollection.draft : !!active;
    const now = Date.now();
    const collectionId =
      existingCollection?._id ??
      (await ctx.db.insert('collections', {
        ...collection,
        active: !isDraft,
        draft: isDraft || undefined,
        openedAt: now,
        postersUpdatedAt: now
      }));
    if (existingCollection && existingCollection.title !== collection.title) {
      await ctx.db.patch(collectionId, { title: collection.title });
    }

    const keys = new Set(posters.map((p) => p.key));
    const removed = new Set(existingCollection?.removed ?? []);
    let added = 0;
    let updated = 0;
    let deactivated = 0;

    for (const p of posters) {
      const existing = await ctx.db
        .query('posters')
        .withIndex('by_collection_key', (q) => q.eq('collectionId', collectionId).eq('key', p.key))
        .unique();
      if (existing) {
        if (existing.title === p.title && existing.image === p.image && existing.active) continue;
        await ctx.db.patch(existing._id, { title: p.title, image: p.image, active: true });
        removed.delete(existing._id);
        updated++;
      } else {
        await ctx.db.insert('posters', { ...p, collectionId, active: true });
        added++;
      }
    }

    for (const p of await ctx.db
      .query('posters')
      .withIndex('by_collection_active', (q) => q.eq('collectionId', collectionId).eq('active', true))
      .collect()) {
      if (!keys.has(p.key)) {
        await ctx.db.patch(p._id, { active: false });
        removed.add(p._id);
        deactivated++;
      }
    }

    const changed = added + updated + deactivated > 0;
    if (!changed) return { collection: collection.title, draft: isDraft, added, updated, deactivated };
    if (existingCollection) {
      await ctx.db.patch(collectionId, { postersUpdatedAt: Date.now(), removed: [...removed] });
    }

    // Standings mirror whether their poster is active, and the snapshots need rebuilding to match.
    for (const p of await ctx.db
      .query('posters')
      .withIndex('by_collection_key', (q) => q.eq('collectionId', collectionId))
      .collect()) {
      const standing = await ctx.db
        .query('standings')
        .withIndex('by_poster', (q) => q.eq('posterId', p._id))
        .unique();
      if (standing && standing.active !== p.active) await ctx.db.patch(standing._id, { active: p.active });
    }
    await requestRun(ctx, collectionId, { now: true, stale: true });

    return { collection: collection.title, draft: isDraft, added, updated, deactivated };
  }
});

/**
 * Fold a duplicate poster into the one being kept: its votes move over (votes between the two are
 * dropped, since a poster can't beat itself), the duplicate is deleted, and the collection is
 * re-tallied from its votes. Run it once with `npx convex run`.
 */
export const merge = internalMutation({
  args: { collection: v.string(), keepKey: v.string(), dropKey: v.string() },
  handler: async (ctx, { collection: slug, keepKey, dropKey }) => {
    const collection = await ctx.db
      .query('collections')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (!collection) throw new Error(`No collection "${slug}"`);
    const byKey = (key: string) =>
      ctx.db
        .query('posters')
        .withIndex('by_collection_key', (q) => q.eq('collectionId', collection._id).eq('key', key))
        .unique();
    const keep = await byKey(keepKey);
    const drop = await byKey(dropKey);
    if (!keep || !drop) throw new Error(`Missing poster: ${!keep ? keepKey : dropKey}`);

    let moved = 0;
    let dropped = 0;
    for (const vote of await ctx.db
      .query('votes')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id))
      .collect()) {
      const winnerId = vote.winnerId === drop._id ? keep._id : vote.winnerId;
      const loserId = vote.loserId === drop._id ? keep._id : vote.loserId;
      if (winnerId === loserId) {
        await ctx.db.delete(vote._id);
        dropped++;
      } else if (winnerId !== vote.winnerId || loserId !== vote.loserId) {
        await ctx.db.patch(vote._id, { winnerId, loserId });
        moved++;
      }
    }

    const standing = await ctx.db
      .query('standings')
      .withIndex('by_poster', (q) => q.eq('posterId', drop._id))
      .unique();
    if (standing) await ctx.db.delete(standing._id);
    await ctx.db.delete(drop._id);
    await ctx.db.patch(collection._id, {
      postersUpdatedAt: Date.now(),
      removed: [...(collection.removed ?? []), drop._id]
    });
    await startRebuild(ctx, collection._id);

    return { kept: keep.title, removed: drop.title, votesMoved: moved, votesDropped: dropped };
  }
});

const REMOVE_BATCH = 2000;

/**
 * Take posters out of a collection and delete every vote they were in, then re-tally it from the
 * votes left. Their pairs are skipped rather than reshuffling anyone's order. Also delete their
 * files from posters/, or the next sync puts them back (with no votes). Run it once with
 * `npx convex run`; it carries on through the votes a batch at a time until `done`.
 */
export const remove = internalMutation({
  args: { collection: v.string(), keys: v.array(v.string()), after: v.optional(v.number()) },
  handler: async (ctx, { collection: slug, keys, after }) => {
    const collection = await ctx.db
      .query('collections')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (!collection) throw new Error(`No collection "${slug}"`);
    const posters = [];
    for (const key of keys) {
      const poster = await ctx.db
        .query('posters')
        .withIndex('by_collection_key', (q) => q.eq('collectionId', collection._id).eq('key', key))
        .unique();
      if (!poster) throw new Error(`Missing poster: ${key}`);
      posters.push(poster);
    }
    const ids = new Set(posters.map((p) => p._id));

    // The first batch takes the posters out; later ones only carry on through the votes.
    if (after === undefined) {
      for (const p of posters) {
        if (p.active) await ctx.db.patch(p._id, { active: false });
        const standing = await ctx.db
          .query('standings')
          .withIndex('by_poster', (q) => q.eq('posterId', p._id))
          .unique();
        if (standing) await ctx.db.delete(standing._id);
      }
      await ctx.db.patch(collection._id, {
        postersUpdatedAt: Date.now(),
        removed: [...new Set([...(collection.removed ?? []), ...ids])]
      });
    }

    const votes = await ctx.db
      .query('votes')
      .withIndex('by_collection', (q) => q.eq('collectionId', collection._id).gt('_creationTime', after ?? 0))
      .take(REMOVE_BATCH);
    let deleted = 0;
    for (const vote of votes) {
      if (!ids.has(vote.winnerId) && !ids.has(vote.loserId)) continue;
      await ctx.db.delete(vote._id);
      deleted++;
    }

    const done = votes.length < REMOVE_BATCH;
    if (done) await startRebuild(ctx, collection._id);
    else {
      const next = votes[votes.length - 1]._creationTime;
      await ctx.scheduler.runAfter(0, internal.posters.remove, { collection: slug, keys, after: next });
    }
    return { removed: posters.map((p) => p.title), votesDeleted: deleted, done };
  }
});

import type { OverridedMixpanel } from 'mixpanel-browser';
// The core SDK: no session recording, which isn't used here, at a third of the size.
import core from 'mixpanel-browser/src/loaders/loader-module-core';
import { dev } from '$app/environment';
import type { View } from '$lib/features/results/types';
import type { ShareOutcome } from '$lib/features/share/share.svelte';
import { i18n, type Lang } from '$lib/i18n/index.svelte';
import { designer } from '$lib/state/designer.svelte';
import { sound } from './sound.svelte';

// Product analytics, sent to Mixpanel. Nothing is stored on the device (no cookie, no
// localStorage, not the voter id), so there's no consent to ask for: every page load is a new
// anonymous visitor, and no Mixpanel profiles are made. Only the live site sends anything; in
// development and `pnpm preview`, events are logged to the console instead.
//
// Every event and its properties are in `Events`, so names and payloads can't drift. See
// AGENTS.md for the tracking plan and the conventions they follow.

// A project token is public: it's in every page that sends events.
const TOKEN = 'dee90a554373b90652f9bfd2c1f51290';
// Its types re-export the full SDK's but leave out the default export, which it does have.
const mixpanel = core as unknown as OverridedMixpanel;

type Method = 'click' | 'keyboard';
/** The poster an event is about, and its competition's slug. */
type AboutPoster = { competition?: string; poster_id: string; poster_title: string };
/** A vote on a pair: `poster_*` is the pick. */
type AboutVote = AboutPoster & {
  opponent_poster_id: string;
  opponent_poster_title: string;
  chosen_side: 'left' | 'right';
  method: Method;
};
export type NavDestination = 'vote' | 'rankings' | 'about' | 'settings' | 'past_results';

export type Events = {
  voting_started: { trigger: 'start_button' | 'designer_answer' };
  /** The answer itself is `is_designer`, sent with every event. */
  designer_question_answered: { placement: 'vote_intro' | 'settings' };
  poster_voted: AboutVote & {
    /** Share of the votes on this pair that agree with this one, 0–100. */
    crowd_share: number;
    pair_votes: number;
    crowd_streak: number;
    votes_this_visit: number;
    /** Only until they've been shown every poster. */
    posters_seen?: number;
    posters_total?: number;
  };
  poster_vote_failed: AboutVote & {
    /** `timeout`: Convex didn't answer in time; `failed`: the mutation threw. */
    failure: 'failed' | 'timeout';
    /** Whether Convex's WebSocket was connected when it failed. */
    is_connected: boolean;
  };
  pair_skipped: { competition?: string; poster_ids: string[]; poster_titles: string[]; votes_this_visit: number };
  reveal_dismissed: { method: Method; is_autoplay_paused: boolean };
  past_votes_opened: { placement: 'vote_reveal' | 'vote_pair'; votes_this_visit: number };
  /** `votes_viewed`: how many of the old votes they looked at. */
  past_votes_closed: { method: Method; votes_viewed: number };
  all_posters_seen: { competition?: string; posters_total: number; votes_this_visit: number };
  poster_shared: AboutPoster & { placement: 'vote_reveal' | 'past_votes' | 'rankings_modal' | 'poster_page'; outcome: ShareOutcome };
  site_shared: { outcome: ShareOutcome };
  coffee_link_clicked: { placement: 'corner_button' | 'about_page' };
  /** The download button in the About page's section on the font. */
  font_downloaded: Record<string, never>;
  social_link_clicked: {
    person: 'alisa' | 'josh';
    network: 'instagram' | 'substack' | 'telegram' | 'youtube' | 'website';
    url: string;
  };
  /** The new language is `language`, sent with every event. */
  language_changed: { previous_language: Lang };
  /** The new setting is `is_sound_muted`, sent with every event. */
  sound_toggled: Record<string, never>;
  /** The new setting: whether the revealed votes wait for them. It lasts the visit. */
  autoplay_toggled: { is_autoplay_paused: boolean };
  vote_history_cleared: { vote_count?: number };
  rankings_view_changed: { competition?: string; view: View; previous_view: View };
  poster_details_opened: AboutPoster & {
    poster_rank?: number;
    view: View;
    placement: 'podium' | 'leaderboard' | 'local_picks' | 'disagreements';
  };
  nav_link_clicked: {
    destination: NavDestination;
    placement: 'logo' | 'header_pill' | 'menu' | 'vote_message' | 'error_page';
    /** For a past competition's results. */
    competition?: string;
  };
};

// Not in dev or `pnpm preview`, which serves a production build locally.
const live = !dev && typeof location !== 'undefined' && !['localhost', '127.0.0.1'].includes(location.hostname);
let started = false;

function client() {
  if (!started) {
    mixpanel.init(TOKEN, {
      // The project has EU data residency; the SDK sends to the US servers by default.
      api_host: 'https://api-eu.mixpanel.com',
      // Store nothing on the device. Persistence keeps the visitor's id in a cookie, and batching
      // keeps a queue of unsent events in localStorage even with persistence off.
      disable_persistence: true,
      batch_requests: false,
      // Sent from the layout instead (see trackPageview), so they carry the common properties.
      track_pageview: false
    });
    started = true;
  }
  return mixpanel;
}

/** Sent with every event: the visitor's settings, as they are after the action. */
function common() {
  return { language: i18n.lang, is_designer: designer.value, is_sound_muted: sound.muted };
}

/** Mixpanel should see a property left out, never null or undefined. */
function defined(props: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== null));
}

/**
 * Record `event`. With `beacon`, it's sent in a way that survives the page unloading straight
 * after, e.g. before a reload.
 */
export function track<E extends keyof Events>(event: E, props: Events[E], { beacon = false } = {}) {
  const all = defined({ ...common(), ...props });
  if (!live) return console.info('[analytics]', event, all);
  client().track(event, all, beacon ? { transport: 'sendBeacon' } : undefined);
}

/** Record a page view: `route` is its SvelteKit route id, e.g. "/poster/[competition]/[name]". */
export function trackPageview(props: { route?: string; competition?: string }) {
  const all = defined({ ...common(), ...props });
  if (!live) return console.info('[analytics]', '$mp_web_page_view', all);
  client().track_pageview(all);
}

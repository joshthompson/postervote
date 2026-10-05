<script lang="ts">
  import { useConvexClient } from 'convex-svelte';
  import { untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import { api } from '$convex/api';
  import Button from '$lib/components/ui/Button.svelte';
  import ButtonRow from '$lib/components/ui/ButtonRow.svelte';
  import Loader from '$lib/components/ui/Loader.svelte';
  import MessageCard from '$lib/components/ui/MessageCard.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import PixelText from '$lib/components/pixel/PixelText.svelte';
  import DesignerChoice from '$lib/features/designer/DesignerChoice.svelte';
  import { posterHref, posterNames } from '$lib/features/results/links';
  import { designer } from '$lib/state/designer.svelte';
  import { track } from '$lib/services/analytics';
  import { sound } from '$lib/services/sound.svelte';
  import { location } from '$lib/services/location';
  import { usePosters } from '$lib/services/posters.svelte';
  import { voterId } from '$lib/services/voter';
  import { i18n } from '$lib/i18n/index.svelte';
  import PosterCard from './PosterCard.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import RevealButtons from './RevealButtons.svelte';
  import VerdictBubble from './VerdictBubble.svelte';
  import VsBadge from './VsBadge.svelte';
  import { REVEAL_MS, VoteSession } from './session.svelte';
  import { verdictFor } from './verdict';
  import type { Poster } from './types';

  // The voting screen: asks the designer question on a first visit, waits for a click to start
  // (which also starts the music), then shows pair after pair.

  const me = voterId();
  location(); // start the lookup now so it's ready by the first vote
  const client = useConvexClient();
  const posters = usePosters(() => undefined);
  const list = $derived((posters.data ?? []) as Poster[]);
  // Each poster's page, to share after voting on it.
  const names = $derived(posterNames(list));
  const shareHref = (p: Poster) => (posters.slug ? posterHref(posters.slug, names.get(p._id)!) : undefined);
  // The competition and a poster, as the analytics events name them.
  const competition = $derived(posters.slug ?? undefined);
  const about = (p: Poster) => ({ competition, poster_id: p._id, poster_title: p.title });

  const session = new VoteSession({
    posters: () => list,
    removed: () => posters.removed,
    collection: () => posters.competitionId,
    cast: async (winner, loser) =>
      client.mutation(api.votes.cast, {
        winnerId: winner._id,
        loserId: loser._id,
        voterId: me,
        designer: designer.value ?? undefined,
        ...(await location())
      })
  });

  // Skip the start button if the music is already going, e.g. arriving via "Keep voting".
  let started = $state(sound.unlocked);
  // Votes cast this visit, for the analytics events.
  let votes = 0;

  $effect(() => {
    if (started) session.refresh();
  });

  // This pair showed them the last of the posters they hadn't seen.
  $effect(() => {
    if (session.phase === 'seenAll') {
      untrack(() => track('all_posters_seen', { competition, posters_total: list.length, votes_this_visit: votes }));
    }
  });

  function start(trigger: 'start_button' | 'designer_answer') {
    sound.unlock();
    started = true;
    track('voting_started', { trigger });
  }

  function answer() {
    track('designer_question_answered', { placement: 'vote_intro' });
    start('designer_answer');
  }

  async function vote(i: number, method: 'click' | 'keyboard') {
    if (!session.canVote) return;
    sound.vote();
    const [pick, other] = [session.pair![i], session.pair![1 - i]];
    await session.vote(i);

    const props = {
      ...about(pick),
      opponent_poster_id: other._id,
      opponent_poster_title: other.title,
      chosen_side: i === 0 ? 'left' : 'right',
      method
    } as const;
    if (!session.result) {
      return track('poster_vote_failed', {
        ...props,
        failure: session.error ?? 'failed',
        is_connected: client.connectionState().isWebSocketConnected
      });
    }
    track('poster_voted', {
      ...props,
      crowd_share: session.result.pct[i],
      pair_votes: session.result.total,
      crowd_streak: session.streak,
      votes_this_visit: ++votes,
      posters_seen: session.progress?.seen,
      posters_total: session.progress?.total
    });
  }

  function skip() {
    if (!session.canVote) return;
    const pair = session.pair!;
    track('pair_skipped', {
      competition,
      poster_ids: pair.map((p) => p._id),
      poster_titles: pair.map((p) => p.title),
      votes_this_visit: votes
    });
    session.skip();
  }

  /** Move on from the revealed votes before it does so by itself. */
  function next(method: 'click' | 'keyboard') {
    track('reveal_dismissed', { method, is_autoplay_paused: session.paused });
    session.advance();
  }

  function toggleAutoplay() {
    if (session.paused) session.resume();
    else session.pause();
    track('autoplay_toggled', { is_autoplay_paused: session.paused });
  }

  // Votes looked back at since opening past votes, for the analytics events.
  const viewed = new Set<number>();

  function openPastVotes() {
    const placement = session.phase === 'reveal' ? 'vote_reveal' : 'vote_pair';
    session.lookBack();
    viewed.clear();
    viewed.add(session.viewing!);
    track('past_votes_opened', { placement, votes_this_visit: votes });
  }

  function step(by: -1 | 1) {
    session.step(by);
    viewed.add(session.viewing!);
  }

  /** Back from past votes to voting. */
  function continueVoting(method: 'click' | 'keyboard') {
    track('past_votes_closed', { method, votes_viewed: viewed.size });
    session.stopLookingBack();
  }

  const toRankings = () => track('nav_link_clicked', { destination: 'rankings', placement: 'vote_message' });

  function onKey(e: KeyboardEvent) {
    if (session.viewing !== null) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target instanceof HTMLButtonElement && !e.target.disabled) return;
        e.preventDefault();
        continueVoting('keyboard');
      }
    } else if (session.canVote) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') vote(0, 'keyboard');
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') vote(1, 'keyboard');
    } else if (session.revealed && session.result && (e.key === 'Enter' || e.key === ' ')) {
      // A focused button, such as share, handles those keys itself.
      if (e.target instanceof HTMLButtonElement && !e.target.disabled) return;
      e.preventDefault();
      next('keyboard');
    }
  }

  const t = $derived(i18n.t.vote);
  const leaving = $derived(session.phase === 'exit');
  const showingResult = $derived(session.phase === 'reveal' || leaving);
  // What's on screen: the current pair, or the old vote they're looking back at.
  const shown = $derived(
    session.viewed ?? {
      pair: session.pair,
      chosen: session.chosen,
      result: session.result,
      streak: session.streak,
      round: session.round
    }
  );
  const lookingBack = $derived(session.viewing !== null);
  // Replays the cards' entrance for each new pair, and each old vote stepped to.
  const showKey = $derived(lookingBack ? `past-${session.viewing}` : session.round);
  // Each pair moves on to the next wording of the verdict, from a random start for each visit.
  const firstVariant = Math.floor(Math.random() * 100);
  const verdict = $derived(
    showingResult || lookingBack
      ? verdictFor(t, {
          error: !lookingBack && !!session.error,
          result: shown.result,
          chosen: shown.chosen,
          streak: shown.streak,
          variant: firstVariant + shown.round
        })
      : ''
  );
</script>

<svelte:window onkeydown={onKey} />

<section class="stage">
  {#if posters.error}
    <MessageCard title={t.vaultError}><p>{posters.error.message}</p></MessageCard>
  {:else if !posters.isLoading && list.length < 2}
    <MessageCard title={t.noPosters}>
      <p>{t.noPostersBody[0]}<code>posters/</code>{t.noPostersBody[1]}<code>pnpm posters:sync</code>{t.noPostersBody[2]}</p>
    </MessageCard>
  {:else if designer.value === null}
    <div class="intro">
      <h2 class="question"><PixelText text={i18n.t.designerQuestion} /></h2>
      <DesignerChoice staggered onchoose={answer} />
    </div>
  {:else if !started}
    <div class="intro">
      <span class="wobbly"><Button label={t.start} onclick={() => start('start_button')} /></span>
    </div>
  {:else if session.phase === 'done'}
    <MessageCard title={t.doneTitle}>
      <p>{t.doneBody(session.totalPairs)}</p>
      <Pill variant="red" href={resolve('/results')} onclick={toRankings}>{t.seeRankings}</Pill>
    </MessageCard>
  {:else if session.phase === 'seenAll'}
    <MessageCard title={t.seenAllTitle}>
      <p>{t.seenAllBody}</p>
      <ButtonRow>
        <Pill variant="red" onclick={() => session.carryOn()}>{t.continueVoting}</Pill>
        <Pill href={resolve('/results')} onclick={toRankings}>{t.seeRankings}</Pill>
      </ButtonRow>
    </MessageCard>
  {:else if !shown.pair}
    <Loader />
  {:else}
    {@const { pair, chosen, result } = shown}
    {#key showKey}
      <div class="pair">
        {#each pair as poster, i (poster._id)}
          <PosterCard
            {poster}
            side={i === 0 ? 0 : 1}
            chosen={chosen === i}
            rejected={chosen !== null && chosen !== i}
            {leaving}
            disabled={session.phase !== 'choose' || lookingBack}
            pct={result?.pct[i]}
            winner={result ? result.pct[i] >= result.pct[1 - i] : false}
            shareHref={shareHref(poster)}
            onshare={(outcome) =>
              track('poster_shared', {
                ...about(poster),
                placement: lookingBack ? 'past_votes' : 'vote_reveal',
                outcome
              })}
            onclick={() => vote(i, 'click')}
          />
          {#if i === 0}<VsBadge hidden={showingResult || lookingBack} />{/if}
        {/each}
      </div>
    {/key}

    <div class="footer">
      <div class="action">
        {#if lookingBack}
          <RevealButtons
            paused={session.paused}
            duration={REVEAL_MS}
            ontoggle={toggleAutoplay}
            onnext={() => next('click')}
            back={{
              canPrev: session.viewing! > 0,
              canNext: session.viewing! < session.history.length - 1,
              onprev: () => step(-1),
              onnext: () => step(1),
              oncontinue: () => continueVoting('click')
            }}
          />
        {:else if session.phase === 'choose'}
          <span class="appear choosing">
            {#if session.canLookBack}<Pill onclick={openPastVotes}>{t.pastVotes}</Pill>{/if}
            <Pill onclick={skip}>{t.skip}</Pill>
          </span>
        {:else if session.revealed}
          <span class="appear">
            <RevealButtons
              paused={session.paused}
              duration={REVEAL_MS}
              ontoggle={toggleAutoplay}
              onnext={() => next('click')}
              onhistory={session.canLookBack ? openPastVotes : undefined}
            />
          </span>
        {/if}
      </div>
      {#if session.progress}
        {@const { seen, total } = session.progress}
        <ProgressBar {seen} {total} label={t.progress(seen, total)} />
      {/if}
    </div>

    {#key showKey}
      {#if verdict}
        <VerdictBubble
          text={verdict}
          detail={shown.result ? t.votesOnPair(shown.result.total) : undefined}
          {leaving}
        />
      {/if}
    {/key}
  {/if}
</section>

<style>
  .stage {
    --gap: clamp(20px, 5vw, 90px);
    /* Room a card needs beyond its 3:4 frame: caption, bob and tilt. */
    --extra: 80px;
    /* Poster width, sized from the pair row's height (cqh, see .pair) so the footer always fits. */
    --w: min(34vw, calc((100cqh - var(--extra)) * 0.75), 440px);
    position: relative;
    height: 100dvh;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    justify-items: center;
    align-items: center;
    padding: clamp(76px, 12dvh, 112px) 16px 24px;
    overflow: hidden;
  }

  .pair {
    /* Fills the first row; its height drives --w via cqh. */
    container-type: size;
    align-self: stretch;
    justify-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--gap);
    position: relative;
  }

  .footer {
    /* The height of the buttons under the revealed votes, which the row they're in keeps as the
       buttons come and go, so the bar below stays put. */
    --next-height: 52px;
    align-self: start;
    min-height: 48px;
    padding-top: clamp(12px, 2.5dvh, 32px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  @media (max-width: 560px) {
    .footer {
      --next-height: 44px;
    }
  }
  .action {
    display: grid;
    place-items: center;
    min-height: var(--next-height);
  }
  .appear {
    display: inline-block;
    animation: pop-in 0.5s var(--spring) both 0.3s;
  }
  .choosing {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .intro {
    display: grid;
    justify-items: center;
    gap: clamp(24px, 4dvh, 40px);
    text-align: center;
  }
  .question {
    margin: 0;
    animation: pop-in 0.6s var(--spring) both;
  }
  .wobbly {
    display: inline-block;
    animation:
      pop-in 0.6s var(--spring) both,
      nudge 3s ease-in-out 0.8s infinite;
  }
  /* A gentler wobble than the "vs" badge's; a wide button tilting 10° looks off. */
  @keyframes nudge {
    50% {
      transform: scale(1.04) rotate(-2deg);
    }
  }

  /* Tall, narrow screens: stack the posters. */
  @media (max-aspect-ratio: 4 / 5) {
    .stage {
      --gap: clamp(28px, 5dvh, 56px);
      /* Two stacked cards, no captions: split the row height between them. */
      --extra: 40px;
      --w: min(64vw, calc(((100cqh - var(--gap)) / 2 - var(--extra)) * 0.75), 420px);
      padding-top: 96px;
    }
    .pair {
      flex-direction: column;
    }
  }
</style>

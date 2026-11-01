<script lang="ts">
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import type { PosterInfo } from '$lib/services/posters.svelte';
  import { renderMusic } from '$lib/services/sound.svelte';
  import Reel from './Reel.svelte';
  import Stage from './Stage.svelte';
  import { takeOverClock } from './clock';
  import { pickNext, preloadPosters, useNextCollection, useVideoData } from './data.svelte';
  import { BEAT_MS, ending, plan, type Spawn } from './timeline';

  // The winner video for `pnpm video` (scripts/render-video.mjs) to render, one frame at a time.
  // It loads the collection in the URL (`?collection=<slug>&name=<name in the question>`, and
  // `&next=<slug>&nextName=<its name>` to end on the collection to vote on next), preloads its posters, takes over the page's clock, and then waits on `window.__video`: the
  // script starts it, moves it on a frame at a time and screenshots each one, and asks for the
  // music separately. Open it in a window the video's size (540 × 960 at 2×) for a 1080 × 1920 frame.

  type VideoApi = {
    /** Seconds of video. */
    seconds: number;
    collection: string;
    votes: number;
    top: string[];
    /** The name of the collection it ends on, to vote on next, if any. */
    next: string | null;
    /** Starts the video at its first frame. */
    start: () => Promise<void>;
    /** Moves the video on by `ms` and settles. */
    advance: (ms: number) => Promise<void>;
    /** The soundtrack, effects and all, as a base64 16-bit WAV. */
    music: () => Promise<string>;
  };
  type Status = { ready: true; api: VideoApi } | { ready: false; error: string };
  const expose = (status: Status) => ((window as unknown as { __video: Status }).__video = status);

  const params = page.url.searchParams;
  const slug = params.get('collection') ?? undefined;
  const data = useVideoData(() => slug);
  const name = $derived(params.get('name') || data.collection?.title || '');
  const nextSlug = params.get('next') ?? undefined;
  const nextData = useNextCollection(() => nextSlug);

  type Ranked = NonNullable<typeof data.ranked>;
  type Next = { name: string; posters: PosterInfo[] };
  // Fixed when the video starts, so votes coming in while it renders don't change it.
  let run = $state<{ startAt: number; spawns: Spawn[]; top: Ranked; votes: number; next: Next | null } | null>(null);
  let images: HTMLImageElement[] = [];
  let prepared = false;

  $effect(() => {
    const error = data.error ?? nextData.error;
    if (error) expose({ ready: false, error: error.message });
    else if (data.missing) expose({ ready: false, error: `No collection "${slug ?? 'active'}"` });
    else if (nextData.missing) expose({ ready: false, error: `No collection "${nextSlug}"` });
    else if (data.ranked && data.collection && (!nextSlug || (nextData.posters && nextData.title)) && !prepared) {
      prepared = true;
      const next = nextSlug
        ? { name: params.get('nextName') || nextData.title || '', posters: pickNext(nextData.posters ?? []) }
        : null;
      prepare(data.ranked, data.collection.title, data.votes, next);
    }
  });

  async function prepare(ranked: Ranked, title: string, votes: number, next: Next | null) {
    images = await preloadPosters([...ranked, ...(next?.posters ?? [])]);
    await Promise.all([document.fonts.load('64px "Remi Pop"'), document.fonts.load('800 56px "Bricolage Grotesque"')]);
    // A moment for the polka dots to load their drawings and start.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const clock = takeOverClock();
    const end = ending(!!next);
    const seconds = (end.end * BEAT_MS) / 1000;
    expose({
      ready: true,
      api: {
        seconds,
        collection: title,
        votes,
        top: ranked.slice(0, 3).map((p) => p.title),
        next: next?.name ?? null,
        async start() {
          run = { startAt: clock.now(), spawns: plan(ranked.slice(3)), top: ranked.slice(0, 3), votes, next };
          await tick();
        },
        advance: clock.advance,
        async music() {
          const sec = (beats: number) => (beats * BEAT_MS) / 1000;
          const effects = end.cues.map((c) =>
            'note' in c ? { at: sec(c.beat), note: c.note } : { at: sec(c.beat), countUp: sec(c.countUp) }
          );
          const buffer = await renderMusic(seconds, effects);
          return wav(buffer);
        }
      }
    });
  }

  /** An audio buffer as a 16-bit PCM WAV file, in base64. */
  function wav(buffer: AudioBuffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const bytes = new DataView(new ArrayBuffer(44 + frames * channels * 2));
    const text = (at: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    bytes.setUint32(4, 36 + frames * channels * 2, true);
    text(8, 'WAVEfmt ');
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true);
    bytes.setUint16(22, channels, true);
    bytes.setUint32(24, buffer.sampleRate, true);
    bytes.setUint32(28, buffer.sampleRate * channels * 2, true);
    bytes.setUint16(32, channels * 2, true);
    bytes.setUint16(34, 16, true);
    text(36, 'data');
    bytes.setUint32(40, frames * channels * 2, true);
    const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
    for (let i = 0, at = 44; i < frames; i++) {
      for (const channel of data) {
        bytes.setInt16(at, Math.max(-1, Math.min(1, channel[i])) * 0x7fff, true);
        at += 2;
      }
    }
    const raw = new Uint8Array(bytes.buffer);
    let binary = '';
    for (let i = 0; i < raw.length; i += 0x8000) binary += String.fromCharCode(...raw.subarray(i, i + 0x8000));
    return btoa(binary);
  }
</script>

<Stage startAt={run?.startAt} beats={ending(!!nextSlug).end}>
  {#if run}
    <Reel startAt={run.startAt} spawns={run.spawns} top={run.top} {name} votes={run.votes} next={run.next} sfx={false} />
  {/if}
</Stage>

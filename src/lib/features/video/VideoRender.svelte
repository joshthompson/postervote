<script lang="ts">
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { renderMusic } from '$lib/services/sound.svelte';
  import Reel from './Reel.svelte';
  import Stage from './Stage.svelte';
  import { takeOverClock } from './clock';
  import { preloadPosters, useVideoData } from './data.svelte';
  import { AT, BEAT_MS, CUES, plan, type Spawn } from './timeline';

  // The winner video for `pnpm video` (scripts/render-video.mjs) to render, one frame at a time.
  // It loads the competition in the URL (`?competition=<slug>&name=<name in the question>`),
  // preloads its posters, takes over the page's clock, and then waits on `window.__video`: the
  // script starts it, moves it on a frame at a time and screenshots each one, and asks for the
  // music separately. Open it in a window the video's size (540 × 960 at 2×) for a 1080 × 1920 frame.

  type VideoApi = {
    /** Seconds of video. */
    seconds: number;
    competition: string;
    votes: number;
    top: string[];
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
  const slug = params.get('competition') ?? undefined;
  const data = useVideoData(() => slug);
  const name = $derived(params.get('name') || data.competition?.title || '');

  type Ranked = NonNullable<typeof data.ranked>;
  // Fixed when the video starts, so votes coming in while it renders don't change it.
  let run = $state<{ startAt: number; spawns: Spawn[]; top: Ranked; votes: number } | null>(null);
  let images: HTMLImageElement[] = [];
  let prepared = false;

  $effect(() => {
    if (data.error) expose({ ready: false, error: data.error.message });
    else if (data.missing) expose({ ready: false, error: `No competition "${slug ?? 'active'}"` });
    else if (data.ranked && data.competition && !prepared) {
      prepared = true;
      prepare(data.ranked, data.competition.title, data.votes);
    }
  });

  async function prepare(ranked: Ranked, title: string, votes: number) {
    images = await preloadPosters(ranked);
    await document.fonts.load('64px "Remi Pop"');
    // A moment for the polka dots to load their drawings and start.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const clock = takeOverClock();
    const seconds = (AT.end * BEAT_MS) / 1000;
    expose({
      ready: true,
      api: {
        seconds,
        competition: title,
        votes,
        top: ranked.slice(0, 3).map((p) => p.title),
        async start() {
          run = { startAt: clock.now(), spawns: plan(ranked.slice(3)), top: ranked.slice(0, 3), votes };
          await tick();
        },
        advance: clock.advance,
        async music() {
          const buffer = await renderMusic(seconds, CUES.map((beat) => (beat * BEAT_MS) / 1000));
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

<Stage>
  {#if run}
    <Reel startAt={run.startAt} spawns={run.spawns} top={run.top} {name} votes={run.votes} sfx={false} />
  {/if}
</Stage>

import { tick } from 'svelte';

// Takes over the page's clock, so the video can be rendered one exact frame at a time however
// long each frame takes to draw. From then on `performance.now()` and `requestAnimationFrame`
// only move when `advance` is called, and every CSS animation and transition is paused and
// stepped along with them. For the render page only: the page never gets its clock back.

type Frame = { id: number; callback: FrameRequestCallback };

/** Moves time on by `ms`, runs the frame callbacks, and lets the page catch up. */
export type Advance = (ms: number) => Promise<void>;

export function takeOverClock(): { now: () => number; advance: Advance } {
  let now = performance.now();
  let frames: Frame[] = [];
  let nextId = 1;
  performance.now = () => now;
  window.requestAnimationFrame = (callback) => {
    frames.push({ id: nextId, callback });
    return nextId++;
  };
  window.cancelAnimationFrame = (id) => {
    frames = frames.filter((f) => f.id !== id);
  };

  // Animations already running are paused where they are; new ones are paused at their start.
  const held = new WeakSet<Animation>();
  const hold = (from?: number) => {
    for (const a of document.getAnimations()) {
      if (held.has(a)) continue;
      held.add(a);
      a.pause();
      if (from !== undefined) a.currentTime = from;
    }
  };
  hold();

  return {
    now: () => now,
    async advance(ms) {
      now += ms;
      for (const a of document.getAnimations()) {
        if (held.has(a) && a.currentTime !== null) a.currentTime = Number(a.currentTime) + ms;
      }
      const due = frames;
      frames = [];
      for (const f of due) f.callback(now);
      // Svelte applies state changes in a microtask; whatever that mounts starts animating now.
      await tick();
      hold(0);
    }
  };
}

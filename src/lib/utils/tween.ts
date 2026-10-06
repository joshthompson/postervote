/** Tween a number towards a target with an ease-out curve; returns a stop function. */
export function tween(from: number, to: number, ms: number, onUpdate: (n: number) => void) {
  // Timed from the first frame: a frame's timestamp is when it began, which can be before this
  // call, and a negative time would ease out past `from`.
  let start: number | undefined;
  let frame = 0;
  const step = (now: number) => {
    start ??= now;
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    onUpdate(from + (to - from) * eased);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

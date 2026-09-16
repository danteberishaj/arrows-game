/**
 * Shapes shared by the Skia (native) and SVG (web) feedback layers, so both
 * renderers draw the same bump, flash and press preview. Pure functions of a
 * 0..1 progress; usable from Reanimated worklets.
 */

/** Blocked bump: the arrow lunges into its lane and springs back. */
export const BLOCKED_BUMP_MS = 300;
/** The blocking arrow's flash: hold, then fade back to plain ink. */
export const BLOCKER_FLASH_MS = 650;
/** Press preview stroke, relative to the resting stroke. Bold enough to read
 * at 9 pt cells; it draws over the static arrow, so it must fully cover it. */
export const PRESSED_STROKE_SWELL = 1.6;
/** Peak bump travel is ~0.22 cell (0.5 x sin x exp at k~0.28). */
const BLOCKED_BUMP_AMPLITUDE_CELLS = 0.5;

/** Bump displacement along the exit direction, in cells, at progress k. */
export function blockedBumpAt(k: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, k));
  return BLOCKED_BUMP_AMPLITUDE_CELLS * Math.sin(Math.PI * t) * Math.exp(-2 * t);
}

/** Blocker flash opacity: solid for the first 40%, smoothstep to clear. */
export function blockerOpacityAt(k: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, k));
  if (t < 0.4) return 1;
  const f = (t - 0.4) / 0.6;
  return 1 - f * f * (3 - 2 * f);
}

/** Blocker stroke swell (x resting stroke): starts bold, relaxes to 1. */
export function blockerStrokeSwellAt(k: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, k));
  return 1 + 0.6 * (1 - t);
}

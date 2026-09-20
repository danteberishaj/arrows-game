/**
 * Shapes shared by the Skia (native) and SVG (web) feedback layers, so both
 * renderers draw the same bump, flash and press preview. Pure functions of a
 * 0..1 progress; usable from Reanimated worklets.
 */

/** Blocked bump: the arrow lunges into its lane and springs back. */
export const BLOCKED_BUMP_MS = 300;
/** The blocking arrow's flash: hold, then fade back to plain ink. */
export const BLOCKER_FLASH_MS = 650;
/** Keep feedback mounted just past its driver so the final frame can render. */
export const FEEDBACK_CLEANUP_MARGIN_MS = 40; // OWNER-PICKED STARTING VALUE
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

/**
 * Every curve below takes `reducedMotion` (Reanimated's `useReducedMotion()`).
 * Under OS reduce motion Reanimated assigns a `withTiming` target at once, so
 * progress would read k = 1 on the first frame: the blocker would be invisible
 * and the blocked arrow already back to ink. Instead each curve returns a
 * static, information-carrying value, and the renderers skip the driver.
 */

/** Blocker flash opacity: solid for the first 40%, smoothstep to clear.
 * Reduced motion: solid for the whole flash lifetime. */
export function blockerOpacityAt(k: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return 1;
  const t = Math.min(1, Math.max(0, k));
  if (t < 0.4) return 1;
  const f = (t - 0.4) / 0.6;
  return 1 - f * f * (3 - 2 * f);
}

/** Blocker stroke swell (x resting stroke): starts bold, relaxes to 1.
 * Reduced motion: holds the flash-onset swell (1.6). */
export function blockerStrokeSwellAt(k: number, reducedMotion: boolean): number {
  'worklet';
  const t = reducedMotion ? 0 : Math.min(1, Math.max(0, k));
  return 1 + 0.6 * (1 - t);
}

/** Blocked arrow colour mix: 0 = heart, 1 = ink. easeOutQuad, so it flashes
 * the fail colour and settles to ink. Reduced motion: stays heart. */
export function blockedFlashMixAt(k: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return 0;
  const t = Math.min(1, Math.max(0, k));
  return 1 - (1 - t) * (1 - t);
}

/** Hint pulse amplitude over the resting stroke. */
const HINT_PULSE_AMPLITUDE = 0.45;
/** Peak of the hint pulse (x resting stroke). Under reduced motion the hint
 * holds this constant stroke (controller ruling W0-4: reuse the shipped peak). */
export const HINT_STROKE_PEAK_SWELL = 1 + HINT_PULSE_AMPLITUDE;

/** Hint stroke swell (x resting stroke): four decaying pulses over the
 * driver's progress. Reduced motion: constant peak swell. */
export function hintStrokeSwellAt(k: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return HINT_STROKE_PEAK_SWELL;
  const pulse = Math.abs(Math.sin(k * Math.PI * 4)) * (1 - k * 0.6);
  return 1 + HINT_PULSE_AMPLITUDE * pulse;
}

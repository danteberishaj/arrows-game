/**
 * Shapes shared by the Skia (native) and SVG (web) feedback layers, so both
 * renderers draw the same bump, flash and press preview. Pure functions of a
 * 0..1 progress; usable from Reanimated worklets.
 */

import { META_BLOCKED_ANTICIPATION, META_BLOCKED_INK_HOLD } from '../featureFlags';

/** W2-09 flag as a plain module constant, so worklets capture a boolean. */
const BLOCKED_INK_HOLD = META_BLOCKED_INK_HOLD;
/** W2-11 flag (the 4 pt minimum lunge) as a plain module constant, for the same reason. */
const BLOCKED_MIN_LUNGE = META_BLOCKED_ANTICIPATION;

/** Blocked bump: the arrow lunges into its lane and springs back. */
export const BLOCKED_BUMP_MS = 300;
/** The blocking arrow's flash: hold, then fade back to plain ink. */
export const BLOCKER_FLASH_MS = 650;
/** Keep feedback mounted just past its driver so the final frame can render. */
export const FEEDBACK_CLEANUP_MARGIN_MS = 40; // OWNER-PICKED STARTING VALUE
/** Press preview stroke, relative to the resting stroke. Bold enough to read
 * at 9 pt cells; it draws over the static arrow, so it must fully cover it. */
export const PRESSED_STROKE_SWELL = 1.6;
/** Peak bump travel is ~0.22 cell (0.5 x sin x exp at BLOCKED_BUMP_PEAK_K). */
const BLOCKED_BUMP_AMPLITUDE_CELLS = 0.5;

/**
 * Progress at which the bump's displacement peaks: d/dk [sin(πk)·e^(−2k)] = 0
 * where tan(πk) = π/2, so k ≈ 0.3195 (≈ 0.2226 cell). Derived, not picked.
 */
export const BLOCKED_BUMP_PEAK_K = Math.atan(Math.PI / 2) / Math.PI;

/** Bump displacement along the exit direction, in cells, at progress k. */
export function blockedBumpAt(k: number): number {
  'worklet';
  const t = Math.min(1, Math.max(0, k));
  return BLOCKED_BUMP_AMPLITUDE_CELLS * Math.sin(Math.PI * t) * Math.exp(-2 * t);
}

/** The shipped curve's peak travel in cells, blockedBumpAt(BLOCKED_BUMP_PEAK_K) ≈ 0.2226 (derived, not picked). */
export const BLOCKED_BUMP_PEAK_CELLS =
  BLOCKED_BUMP_AMPLITUDE_CELLS * Math.sin(Math.PI * BLOCKED_BUMP_PEAK_K) * Math.exp(-2 * BLOCKED_BUMP_PEAK_K);

/**
 * W2-11 (owner 2026-10-06, docs/owner-rulings-2026-10-06.md Q1 B): the blocked lunge's minimum on-screen peak, in
 * points. An absolute distance, converted with the live cell size; never a multiplier on the amplitude.
 */
export const BLOCKED_BUMP_MIN_PEAK_PT = 4;

/**
 * Bump displacement in cells at progress k, with an on-screen peak of at least `minPeakPt` when a cell is `cellPt`
 * points on screen: the shipped curve scaled by max(1, (minPeakPt / cellPt) / BLOCKED_BUMP_PEAK_CELLS). Same shape:
 * rest at both ends, never behind rest (no pull-back), the peak at BLOCKED_BUMP_PEAK_K. A view whose shipped peak
 * already reaches `minPeakPt` (cellPt >= minPeakPt / 0.2226, 17.97 pt for 4 pt) gets the shipped value exactly. A
 * cell size that is not a positive finite number (no camera yet) also gets the shipped curve.
 */
export function blockedBumpFlooredAt(k: number, cellPt: number, minPeakPt: number): number {
  'worklet';
  const d = blockedBumpAt(k);
  if (!(cellPt > 0) || !Number.isFinite(cellPt) || !(minPeakPt > 0)) return d;
  const gain = minPeakPt / cellPt / BLOCKED_BUMP_PEAK_CELLS;
  return gain > 1 ? d * gain : d;
}

/**
 * The blocked bump both renderers draw, in cells. META_BLOCKED_ANTICIPATION (W2-11): the 4 pt minimum peak at the
 * live cell size `cellPt` (board units per cell x camera scale). OFF: the shipped curve, value for value.
 */
export function blockedBumpDisplacementAt(k: number, cellPt: number): number {
  'worklet';
  return BLOCKED_MIN_LUNGE ? blockedBumpFlooredAt(k, cellPt, BLOCKED_BUMP_MIN_PEAK_PT) : blockedBumpAt(k);
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

/** Blocked arrow colour mix: 0 = heart, 1 = ink (or the missed mark).
 * easeOutQuad, so it flashes the fail colour and settles to ink. Reduced
 * motion: stays heart.
 * META_BLOCKED_INK_HOLD (W2-09): pure heart until the bump's displacement
 * peaks (BLOCKED_BUMP_PEAK_K, derived), then a smoothstep release to 1 by
 * k = 1, so the magenta outlasts the lunge instead of finishing before it. */
export function blockedFlashMixAt(k: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return 0;
  const t = Math.min(1, Math.max(0, k));
  if (BLOCKED_INK_HOLD) {
    if (t <= BLOCKED_BUMP_PEAK_K) return 0;
    const f = (t - BLOCKED_BUMP_PEAK_K) / (1 - BLOCKED_BUMP_PEAK_K);
    // smoothstep release shape: OWNER-PICKED STARTING VALUE (the hold point is derived)
    return f * f * (3 - 2 * f);
  }
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

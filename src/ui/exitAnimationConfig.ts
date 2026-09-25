import { PERF_MODE } from '../perfMode';

const configuredDuration = PERF_MODE
  ? Number(process.env.EXPO_PUBLIC_PERF_EXIT_DURATION_MS)
  : Number.NaN;
const MIN_EXIT_TRAIL_DURATION_MS = 160;
const MAX_EXIT_TRAIL_DURATION_MS = 1000;

/** Short enough to cap overlap during rapid play while remaining directional. */
export const EXIT_TRAIL_DURATION_MS =
  Number.isFinite(configuredDuration) &&
  configuredDuration >= MIN_EXIT_TRAIL_DURATION_MS &&
  configuredDuration <= MAX_EXIT_TRAIL_DURATION_MS
    ? configuredDuration
    : 180;

/** Small timer margin lets the final native frame render before unmount. */
export const EXIT_TRAIL_CLEANUP_MARGIN_MS = 40;
export const EXIT_TRAIL_CLEANUP_MS = EXIT_TRAIL_DURATION_MS + EXIT_TRAIL_CLEANUP_MARGIN_MS;

/** Longest slither: a far arrow on a zoomed-in board still reads as a flick, not a drift. */
export const EXIT_TRAIL_MAX_DURATION_MS = 320;
const EXIT_TRAIL_BASE_MS = 120;
const EXIT_TRAIL_MS_PER_SCREEN_POINT = 0.35;
const EXIT_TRAIL_DURATION_PINNED =
  PERF_MODE && Number.isFinite(configuredDuration);
/** Benchmarks pin every exit's duration (EXPO_PUBLIC_PERF_EXIT_DURATION_MS); planners must not reshape it. */
export const EXIT_TRAIL_DURATION_IS_PINNED = EXIT_TRAIL_DURATION_PINNED;

/**
 * Duration for one slither, from the distance the dash travels ON SCREEN
 * (board length x current zoom). A fixed duration made a 39-cell board's
 * exit cross the screen in two frames while a 6-cell board's crawled; scaling
 * with screen distance keeps the perceived speed identical at every level
 * and zoom. Benchmarks pin the duration explicitly so runs stay deterministic.
 */
export function exitTrailDurationMs(screenDistance: number): number {
  if (EXIT_TRAIL_DURATION_PINNED) return EXIT_TRAIL_DURATION_MS;
  const distance = Number.isFinite(screenDistance) ? Math.max(0, screenDistance) : 0;
  const scaled = Math.round(EXIT_TRAIL_BASE_MS + distance * EXIT_TRAIL_MS_PER_SCREEN_POINT);
  return Math.min(EXIT_TRAIL_MAX_DURATION_MS, Math.max(EXIT_TRAIL_DURATION_MS, scaled));
}

/**
 * POLISH-T10 (META_EXIT_TO_SCREEN_EDGE only): with the launch curve the exit's whole clock is longer than what the
 * eye sees (the slow-down happens off screen), so the timing is set by the VISIBLE run: the time from the launch to
 * the last pixel leaving the screen grows with that run's screen distance, inside a band that keeps a short run
 * readable and a long one quick. Values picked with artifacts/POLISH-T10/scripts/sim2.py against the level-1 exits
 * and checked on the emulator (docs/next-level/reports/POLISH-T10.md).
 */
const EXIT_ONSCREEN_BASE_MS = 55; // OWNER-PICKED STARTING VALUE
const EXIT_ONSCREEN_MS_PER_SCREEN_POINT = 0.3; // OWNER-PICKED STARTING VALUE
const EXIT_ONSCREEN_MIN_MS = 88; // OWNER-PICKED STARTING VALUE
const EXIT_ONSCREEN_MAX_MS = 185; // OWNER-PICKED STARTING VALUE
/** The native parsers' upper bound (ArrowsBoardView.kt / .swift MAX_EXIT_DURATION_MS). */
const EXIT_LAUNCH_MAX_DURATION_MS = 1000;

/** Milliseconds of exit clock from the launch until the last pixel leaves the screen. */
export function exitOnScreenMs(screenDistance: number): number {
  const distance = Number.isFinite(screenDistance) ? Math.max(0, screenDistance) : 0;
  return Math.min(
    EXIT_ONSCREEN_MAX_MS,
    Math.max(EXIT_ONSCREEN_MIN_MS, EXIT_ONSCREEN_BASE_MS + distance * EXIT_ONSCREEN_MS_PER_SCREEN_POINT),
  );
}

/**
 * Whole-exit duration when the visible run takes `onScreenMs` and ends at clock `onScreenClock` (0..1] of the
 * curve. Benchmarks keep their pinned duration, like exitTrailDurationMs.
 */
export function exitLaunchDurationMs(onScreenMs: number, onScreenClock: number): number {
  if (EXIT_TRAIL_DURATION_PINNED) return EXIT_TRAIL_DURATION_MS;
  const clock = Number.isFinite(onScreenClock) && onScreenClock > 0 ? Math.min(1, onScreenClock) : 1;
  const scaled = Math.round(onScreenMs / clock);
  return Math.min(EXIT_LAUNCH_MAX_DURATION_MS, Math.max(EXIT_TRAIL_DURATION_MS, scaled));
}

/** Human taps normally keep one active; two preserves overlap without runaway nodes. */
export const MAX_CONCURRENT_EXIT_TRAILS = 2;

/** The slither bead tube's diameter as a fraction of one cell (SlitherExit.cs). */
export const EXIT_TRAIL_STROKE_CELLS = 0.26;

export type ExitAnimationKind = 'none' | 'native-slither' | 'slither';

/**
 * A successful move always plays the same slither exit at every board
 * density. Native platforms draw it inside the retained board view; web draws
 * it on the SVG feedback layer. Only performance diagnostics may disable it.
 */
export function exitAnimationKind(
  exitTrailsDisabled: boolean,
  nativePlatform: boolean,
): ExitAnimationKind {
  if (exitTrailsDisabled) return 'none';
  return nativePlatform ? 'native-slither' : 'slither';
}

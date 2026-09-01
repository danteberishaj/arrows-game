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

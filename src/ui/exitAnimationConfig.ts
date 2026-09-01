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
export const EXIT_TRAIL_CLEANUP_MS = EXIT_TRAIL_DURATION_MS + 40;

/** Human taps normally keep one active; two preserves overlap without runaway nodes. */
export const MAX_CONCURRENT_EXIT_TRAILS = 2;

/** Above this density, native platforms use a cheaper transform-only launch. */
export const DENSE_BOARD_EXIT_THRESHOLD = 64;

export type ExitAnimationKind = 'none' | 'native-launch' | 'slither';

/**
 * A successful move always needs directional feedback. Performance diagnostics
 * may disable it explicitly, but board density must never silently remove it.
 */
export function exitAnimationKind(
  exitTrailsDisabled: boolean,
  remainingArrowCount: number,
  nativePlatform: boolean,
): ExitAnimationKind {
  if (exitTrailsDisabled) return 'none';
  if (nativePlatform && remainingArrowCount > DENSE_BOARD_EXIT_THRESHOLD) {
    return 'native-launch';
  }
  return 'slither';
}

const rawPerfLevel = process.env.EXPO_PUBLIC_PERF_LEVEL;
const parsedPerfLevel = rawPerfLevel === undefined ? Number.NaN : Number(rawPerfLevel);

/**
 * Build-time-only benchmark switch. Expo inlines EXPO_PUBLIC_* variables, so
 * normal release builds see `null` and keep the regular startup path.
 */
export const PERF_LEVEL_INDEX =
  Number.isSafeInteger(parsedPerfLevel) && parsedPerfLevel >= 0
    ? parsedPerfLevel
    : null;

export const PERF_MODE = PERF_LEVEL_INDEX !== null;

/**
 * Runs the real sound and haptic calls inside the otherwise isolated release
 * workload. Ads, persistence, and network work remain disabled by PERF_MODE.
 */
export const PERF_FEEDBACK =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_FEEDBACK === '1';

export type PerfScreen = 'splash' | 'menu' | 'game';

/**
 * EXPO_PUBLIC_PERF_SCREEN picks the screen a PERF build boots into (P-02
 * Stage A). Unset means `game`, the only screen PERF builds showed before.
 * An unknown value throws: a capture of the wrong screen is worse than none.
 */
export function parsePerfScreen(raw: string | undefined): PerfScreen {
  if (raw === undefined) return 'game';
  if (raw === 'splash' || raw === 'menu' || raw === 'game') return raw;
  throw new Error(`EXPO_PUBLIC_PERF_SCREEN must be splash, menu or game (got ${JSON.stringify(raw)})`);
}

/** Initial screen of a PERF build. Non-PERF builds never read the variable. */
export const PERF_SCREEN: PerfScreen = PERF_MODE
  ? parsePerfScreen(process.env.EXPO_PUBLIC_PERF_SCREEN)
  : 'game';

/**
 * Build-time capture diagnostic (ruling F01). EXPO_PUBLIC_CAPTURE_DIAG=1 exposes
 * the app's own reduced-motion value in a non-PERF build; PERF builds always do.
 * Unset in store builds, where Metro inlines `false`.
 */
export const CAPTURE_DIAG = process.env.EXPO_PUBLIC_CAPTURE_DIAG === '1';
export const CAPTURE_DIAG_ENABLED = PERF_MODE || CAPTURE_DIAG;

/**
 * Accessibility label the capture harness reads with `uiautomator dump`
 * (scripts/perf/android/device.mjs). `undefined` adds nothing to the tree.
 */
export function reducedMotionDiagLabel(enabled: boolean, reducedMotion: boolean): string | undefined {
  if (!enabled) return undefined;
  return `perf-reduced-motion-${reducedMotion ? 1 : 0}`;
}

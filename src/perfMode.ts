import type { GenVersion } from './core/generatorVersion';

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

/**
 * POLISH-T8 A/B switch: EXPO_PUBLIC_PERF_GRID_POINTS=1 makes a PERF build draw
 * the META_BOARD_GRID grid with the POLISH-T4 drawPoints path instead of the
 * repeating tile. Never set in a shipped build (PERF_MODE is false there).
 */
export const PERF_GRID_POINTS =
  PERF_MODE && process.env.EXPO_PUBLIC_PERF_GRID_POINTS === '1';

/**
 * W3-05: EXPO_PUBLIC_PERF_GEN_VERSION=2 makes a PERF build deal generator v2;
 * anything else (unset included) is v1. PERF builds never hydrate a save, so
 * they have no switch level: this is the only way a capture selects v2, and an
 * unset variable keeps benchmark.mjs measuring the v1 39x39 board at 3827.
 */
export function parsePerfGenVersion(raw: string | undefined): GenVersion {
  return Number(raw) === 2 ? 2 : 1;
}

/** Generator version of a PERF build; 1 outside PERF_MODE (never read there). */
export const PERF_GEN_VERSION: GenVersion = PERF_MODE
  ? parsePerfGenVersion(process.env.EXPO_PUBLIC_PERF_GEN_VERSION)
  : 1;

const rawDevLevel = process.env.EXPO_PUBLIC_DEV_LEVEL;
const parsedDevLevel = rawDevLevel === undefined ? Number.NaN : Number(rawDevLevel);

/**
 * W3-06: EXPO_PUBLIC_DEV_LEVEL opens a specific campaign index on the first
 * Play, with persistence and ads left running normally (unlike PERF_MODE,
 * which boots straight into the game with both disabled). Read only at
 * module load, exactly like PERF_LEVEL_INDEX, and never gated on `__DEV__`
 * (ruling F10): this module is imported by node-jest tests (the 'core'
 * project), which do not define that global. Unset (every player build)
 * keeps the normal current-level boot.
 */
export const DEV_LEVEL_INDEX =
  Number.isSafeInteger(parsedDevLevel) && parsedDevLevel >= 0
    ? parsedDevLevel
    : null;

const rawDevGenVersion = process.env.EXPO_PUBLIC_DEV_GEN_VERSION;

/**
 * W3-06: EXPO_PUBLIC_DEV_GEN_VERSION forces `levelGenVersion`
 * (gameSessionLifecycle.ts) to this version for every campaign index,
 * independent of the stamped switch level, of PERF_GEN_VERSION, and of
 * EXPO_PUBLIC_DEV_LEVEL (each is "read only when set", W3-06 brief). `null`
 * (unset, or any value other than '1'/'2') changes nothing.
 */
export const DEV_GEN_VERSION: GenVersion | null =
  rawDevGenVersion === '1' ? 1 : rawDevGenVersion === '2' ? 2 : null;

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

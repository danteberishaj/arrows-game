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

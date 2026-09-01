const NANOS_PER_MILLISECOND = 1_000_000;
const PENDING_FENCE = '9223372036854775807';

/**
 * Parses `dumpsys SurfaceFlinger --latency <layer>`.
 *
 * The three columns are desired-present, actual-present, and frame-ready
 * timestamps. They share Android's monotonic clock. Keep timestamps as
 * BigInt while filtering and sorting: converting a long-running device's
 * nanosecond clock to Number before subtraction loses precision.
 */
export function parseSurfaceFlingerLatency(text, window = null) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const refreshPeriodNs = parsePositiveBigInt(lines[0]);
  if (refreshPeriodNs === null) {
    throw new Error('SurfaceFlinger latency contained no refresh period');
  }

  const startNs = window?.startNs === undefined ? null : BigInt(window.startNs);
  const endNs = window?.endNs === undefined ? null : BigInt(window.endNs);

  const unique = new Map();
  let rawFrameCount = 0;
  for (const line of lines.slice(1)) {
    const fields = line.split(/\s+/);
    if (fields.length !== 3 || fields.includes(PENDING_FENCE)) continue;

    const desiredPresentNs = parsePositiveBigInt(fields[0]);
    const actualPresentNs = parsePositiveBigInt(fields[1]);
    const frameReadyNs = parsePositiveBigInt(fields[2]);
    if (desiredPresentNs === null || actualPresentNs === null || frameReadyNs === null) continue;
    rawFrameCount++;
    if (startNs !== null && actualPresentNs < startNs) continue;
    if (endNs !== null && actualPresentNs > endNs) continue;

    unique.set(actualPresentNs.toString(), {
      desiredPresentNs,
      actualPresentNs,
      frameReadyNs,
    });
  }

  const ordered = [...unique.values()].sort((a, b) => compareBigInt(a.actualPresentNs, b.actualPresentNs));
  const refreshPeriodMs = milliseconds(refreshPeriodNs);
  const frames = ordered.map((frame, index) => {
    const previous = ordered[index - 1];
    return {
      desiredToPresentMs: milliseconds(frame.actualPresentNs - frame.desiredPresentNs),
      desiredToReadyMs: milliseconds(frame.frameReadyNs - frame.desiredPresentNs),
      readyToPresentMs: milliseconds(frame.actualPresentNs - frame.frameReadyNs),
      presentedAtNs: frame.actualPresentNs.toString(),
      presentIntervalMs: previous
        ? milliseconds(frame.actualPresentNs - previous.actualPresentNs)
        : null,
    };
  });

  return {
    refreshPeriodNs: refreshPeriodNs.toString(),
    refreshPeriodMs,
    rawFrameCount,
    frames,
  };
}

/** Summarizes cadence without treating desired-to-present lateness as render time. */
export function summarizeSurfaceFrames(frames, refreshPeriodMs = 1000 / 60) {
  if (frames.length === 0) return emptySummary();

  const desiredToPresent = sortedFinite(frames.map((frame) => frame.desiredToPresentMs));
  const desiredToReady = sortedFinite(frames.map((frame) => frame.desiredToReadyMs));
  const readyToPresent = sortedFinite(frames.map((frame) => frame.readyToPresentMs));
  const intervals = sortedFinite(frames.map((frame) => frame.presentIntervalMs).filter((value) => value > 0));
  const totalIntervalMs = intervals.reduce((sum, interval) => sum + interval, 0);

  let missedVsyncCount = 0;
  let twoPlusRefreshHitchCount = 0;
  let fourPlusRefreshHitchCount = 0;
  for (const interval of intervals) {
    // Rounding gives half a refresh of tolerance for timestamp jitter.
    const refreshSlots = Math.max(1, Math.round(interval / refreshPeriodMs));
    missedVsyncCount += refreshSlots - 1;
    if (refreshSlots >= 2) twoPlusRefreshHitchCount++;
    if (refreshSlots >= 4) fourPlusRefreshHitchCount++;
  }
  const observedRefreshSlots = intervals.length + missedVsyncCount;

  return {
    surfaceFrameCount: frames.length,
    surfacePresentedFps:
      intervals.length > 0 && totalIntervalMs > 0
        ? intervals.length * 1000 / totalIntervalMs
        : null,
    surfacePresentIntervalP50Ms: percentileOrNull(intervals, 0.5),
    surfacePresentIntervalP95Ms: percentileOrNull(intervals, 0.95),
    surfacePresentIntervalP99Ms: percentileOrNull(intervals, 0.99),
    surfacePresentIntervalMaxMs: intervals.at(-1) ?? null,
    surfaceMissedVsyncCount: missedVsyncCount,
    surfaceMissedVsyncPercent:
      observedRefreshSlots > 0 ? missedVsyncCount / observedRefreshSlots * 100 : null,
    surfaceTwoPlusRefreshHitchCount: twoPlusRefreshHitchCount,
    surfaceFourPlusRefreshHitchCount: fourPlusRefreshHitchCount,
    surfaceDesiredToPresentP50Ms: percentileOrNull(desiredToPresent, 0.5),
    surfaceDesiredToPresentP95Ms: percentileOrNull(desiredToPresent, 0.95),
    surfaceDesiredToReadyP95Ms: percentileOrNull(desiredToReady, 0.95),
    surfaceReadyToPresentP95Ms: percentileOrNull(readyToPresent, 0.95),
  };
}

function emptySummary() {
  return {
    surfaceFrameCount: 0,
    surfacePresentedFps: null,
    surfacePresentIntervalP50Ms: null,
    surfacePresentIntervalP95Ms: null,
    surfacePresentIntervalP99Ms: null,
    surfacePresentIntervalMaxMs: null,
    surfaceMissedVsyncCount: 0,
    surfaceMissedVsyncPercent: null,
    surfaceTwoPlusRefreshHitchCount: 0,
    surfaceFourPlusRefreshHitchCount: 0,
    surfaceDesiredToPresentP50Ms: null,
    surfaceDesiredToPresentP95Ms: null,
    surfaceDesiredToReadyP95Ms: null,
    surfaceReadyToPresentP95Ms: null,
  };
}

function parsePositiveBigInt(value) {
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function milliseconds(nanoseconds) {
  return Number(nanoseconds) / NANOS_PER_MILLISECOND;
}

function compareBigInt(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedFinite(values) {
  return values.filter(Number.isFinite).sort((a, b) => a - b);
}

function percentileOrNull(sorted, fraction) {
  return sorted.length > 0 ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}

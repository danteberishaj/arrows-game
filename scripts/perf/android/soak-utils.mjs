const DEFAULT_MAX_CHUNK_SIZE = 8;
const DEFAULT_RESERVED_FINAL_TAPS = 3;

/**
 * Uses full batches while keeping at most three taps for the measured clear
 * transition. Every input point appears exactly once and in its original order.
 */
export function chunkTapPoints(
  points,
  maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
  reservedFinalTaps = DEFAULT_RESERVED_FINAL_TAPS,
) {
  if (!Number.isInteger(maxChunkSize) || maxChunkSize < 1) {
    throw new Error('maxChunkSize must be a positive integer');
  }
  if (
    !Number.isInteger(reservedFinalTaps) ||
    reservedFinalTaps < 1 ||
    reservedFinalTaps > maxChunkSize
  ) {
    throw new Error('reservedFinalTaps must be between one and maxChunkSize');
  }
  if (points.length === 0) return [];

  const chunks = [];
  let offset = 0;
  while (points.length - offset > maxChunkSize + reservedFinalTaps) {
    chunks.push(points.slice(offset, offset + maxChunkSize));
    offset += maxChunkSize;
  }
  if (points.length - offset > reservedFinalTaps) {
    const prefixSize = points.length - offset - reservedFinalTaps;
    chunks.push(points.slice(offset, offset + prefixSize));
    offset += prefixSize;
  }
  chunks.push(points.slice(offset));
  return chunks;
}

export function evaluatePerformanceGate(tapActive, levelTapSummaries, budgets) {
  const worstLevelUiFrameP95Ms = levelTapSummaries.length === 0
    ? null
    : Math.max(...levelTapSummaries.map((summary) => summary.uiFrameP95Ms));
  const actual = {
    uiFrameP95Ms: tapActive.uiFrameP95Ms,
    uiFrameP99Ms: tapActive.uiFrameP99Ms,
    jankyFramePercent: tapActive.jankyFramePercent,
    worstLevelUiFrameP95Ms,
  };
  const checks = Object.fromEntries(
    Object.keys(budgets).map((key) => [
      key,
      Number.isFinite(actual[key]) && actual[key] <= budgets[key],
    ]),
  );
  return {
    budgets,
    actual,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

/** Mirrors BoardView's rectangular fit transform with CELL algebraically cancelled. */
export function cellCenterForBoard(bounds, row, col, rows, cols, fitMargin) {
  if (
    !Number.isInteger(rows) || rows < 1 ||
    !Number.isInteger(cols) || cols < 1 ||
    !Number.isInteger(row) || row < 0 || row >= rows ||
    !Number.isInteger(col) || col < 0 || col >= cols
  ) {
    throw new Error(`Invalid ${rows}x${cols} board cell ${row},${col}`);
  }
  const viewportWidth = bounds.right - bounds.left;
  const viewportHeight = bounds.bottom - bounds.top;
  if (!(viewportWidth > 0) || !(viewportHeight > 0) || !(fitMargin > 0 && fitMargin <= 1)) {
    throw new Error('Invalid board viewport bounds or fit margin');
  }

  const fittedCellSize = Math.min(viewportWidth / cols, viewportHeight / rows) * fitMargin;
  const boardWidth = cols * fittedCellSize;
  const boardHeight = rows * fittedCellSize;
  const left = bounds.left + (viewportWidth - boardWidth) / 2;
  const top = bounds.top + (viewportHeight - boardHeight) / 2;
  return {
    x: Math.round(left + (col + 0.5) * fittedCellSize),
    y: Math.round(top + (row + 0.5) * fittedCellSize),
  };
}

export function summarizePssTrend(samples, metricKeys = ['totalPssKb']) {
  if (!Array.isArray(metricKeys) || metricKeys.length === 0) {
    throw new Error('metricKeys must contain at least one PSS category');
  }
  const values = samples.map((sample) => {
    let value = 0;
    for (const key of metricKeys) {
      if (!Number.isFinite(sample[key])) {
        throw new Error(`Missing numeric PSS category: ${key}`);
      }
      value += sample[key];
    }
    return value;
  });
  if (samples.length === 0) {
    return {
      metricKeys,
      sampleCount: 0,
      firstPssKb: null,
      lastPssKb: null,
      growthKb: null,
      windowSize: 0,
      firstWindowMedianPssKb: null,
      lastWindowMedianPssKb: null,
      medianGrowthKb: null,
      theilSenSlopeKbPerLevel: null,
      spearmanCorrelation: null,
      increasingStepCount: 0,
      monotonicGrowthDetected: false,
    };
  }
  const first = values[0];
  const last = values.at(-1);
  const windowSize = Math.min(5, values.length);
  const firstWindowMedianPssKb = median(values.slice(0, windowSize));
  const lastWindowMedianPssKb = median(values.slice(-windowSize));
  const medianGrowthKb = lastWindowMedianPssKb - firstWindowMedianPssKb;
  const theilSenSlopeKbPerLevel = theilSenSlope(values);
  const spearmanCorrelation = spearmanWithIndex(values);
  let increasingStepCount = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) increasingStepCount++;
  }
  const growthKb = last - first;
  return {
    metricKeys,
    sampleCount: values.length,
    firstPssKb: first,
    lastPssKb: last,
    growthKb,
    windowSize,
    firstWindowMedianPssKb,
    lastWindowMedianPssKb,
    medianGrowthKb,
    theilSenSlopeKbPerLevel,
    spearmanCorrelation,
    increasingStepCount,
    monotonicGrowthDetected:
      values.length >= 10 &&
      Math.max(growthKb, medianGrowthKb) > 10 * 1024 &&
      theilSenSlopeKbPerLevel > 0 &&
      spearmanCorrelation >= 0.5,
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function theilSenSlope(values) {
  if (values.length < 2) return 0;
  const slopes = [];
  for (let left = 0; left < values.length - 1; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      slopes.push((values[right] - values[left]) / (right - left));
    }
  }
  return median(slopes);
}

function spearmanWithIndex(values) {
  if (values.length < 2) return 0;
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = new Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const averageRank = (start + end - 1) / 2;
    for (let cursor = start; cursor < end; cursor += 1) {
      ranks[sorted[cursor].index] = averageRank;
    }
    start = end;
  }

  const meanIndex = (values.length - 1) / 2;
  const meanRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  let covariance = 0;
  let indexVariance = 0;
  let rankVariance = 0;
  for (let index = 0; index < values.length; index += 1) {
    const indexDelta = index - meanIndex;
    const rankDelta = ranks[index] - meanRank;
    covariance += indexDelta * rankDelta;
    indexVariance += indexDelta ** 2;
    rankVariance += rankDelta ** 2;
  }
  const denominator = Math.sqrt(indexVariance * rankVariance);
  return denominator === 0 ? 0 : covariance / denominator;
}

/** Stable exit signatures intentionally exclude Android's rotating #N ordinal. */
export function parseExitInfoSignatures(text) {
  return new Set(
    text
      .split(/(?=ApplicationExitInfo #\d+:)/)
      .filter((block) => block.startsWith('ApplicationExitInfo #'))
      .map((block) => [
        block.match(/\btimestamp=(.+)/)?.[1]?.trim(),
        block.match(/\bpid=(\d+)/)?.[1],
        block.match(/\breason=(.+)/)?.[1]?.trim(),
        block.match(/\bsubreason=(.+)/)?.[1]?.trim(),
        block.match(/\bstatus=(.+)/)?.[1]?.trim(),
      ].join('|')),
  );
}

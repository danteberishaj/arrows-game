import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cellCenterForBoard,
  chunkTapPoints,
  evaluatePerformanceGate,
  parseExitInfoSignatures,
  summarizePssTrend,
} from './soak-utils.mjs';

test('tap batches preserve order, stay bounded, and reserve at most three final taps', () => {
  for (let count = 1; count <= 500; count += 1) {
    const points = Array.from({ length: count }, (_, index) => ({ index }));
    const chunks = chunkTapPoints(points);
    assert.deepEqual(chunks.flat(), points);
    assert.ok(chunks.every((chunk) => chunk.length >= 1 && chunk.length <= 8));
    assert.ok(chunks.at(-1).length <= 3);
  }
});

test('performance gate checks aggregate tails and the worst measured level', () => {
  const budgets = {
    uiFrameP95Ms: 20,
    uiFrameP99Ms: 34,
    jankyFramePercent: 8,
    worstLevelUiFrameP95Ms: 34,
  };
  const passing = evaluatePerformanceGate(
    { uiFrameP95Ms: 16.5, uiFrameP99Ms: 21, jankyFramePercent: 5 },
    [{ uiFrameP95Ms: 18 }, { uiFrameP95Ms: 23 }],
    budgets,
  );
  assert.equal(passing.passed, true);
  assert.equal(passing.actual.worstLevelUiFrameP95Ms, 23);

  const failing = evaluatePerformanceGate(
    { uiFrameP95Ms: 21, uiFrameP99Ms: 35, jankyFramePercent: 9 },
    [{ uiFrameP95Ms: 18 }, { uiFrameP95Ms: 40 }],
    budgets,
  );
  assert.equal(failing.passed, false);
  assert.deepEqual(failing.checks, {
    uiFrameP95Ms: false,
    uiFrameP99Ms: false,
    jankyFramePercent: false,
    worstLevelUiFrameP95Ms: false,
  });
});

test('cell coordinates mirror BoardView fit for square, wide, and tall boards', () => {
  const bounds = { left: 0, top: 100, right: 1000, bottom: 1900 };
  assert.deepEqual(cellCenterForBoard(bounds, 19, 19, 39, 39, 0.94), { x: 500, y: 1000 });

  const wideFirst = cellCenterForBoard(bounds, 0, 0, 20, 40, 0.94);
  const wideLast = cellCenterForBoard(bounds, 19, 39, 20, 40, 0.94);
  assert.equal(wideFirst.x, 42);
  assert.equal(wideLast.x, 958);
  assert.ok(wideFirst.y > bounds.top && wideLast.y < bounds.bottom);

  const tallFirst = cellCenterForBoard(bounds, 0, 0, 40, 20, 0.94);
  const tallLast = cellCenterForBoard(bounds, 39, 19, 40, 20, 0.94);
  assert.ok(tallFirst.x > bounds.left && tallLast.x < bounds.right);
  assert.equal(tallFirst.y, 175);
  assert.equal(tallLast.y, 1825);
});

test('PSS trend reports robust window, slope, and rank statistics', () => {
  assert.deepEqual(summarizePssTrend([]), {
    metricKeys: ['totalPssKb'],
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
  });
  const trend = summarizePssTrend([
    { totalPssKb: 100 },
    { totalPssKb: 110 },
    { totalPssKb: 120 },
  ]);
  assert.equal(trend.sampleCount, 3);
  assert.equal(trend.growthKb, 20);
  assert.equal(trend.medianGrowthKb, 0);
  assert.equal(trend.theilSenSlopeKbPerLevel, 10);
  assert.equal(trend.spearmanCorrelation, 1);
  assert.equal(trend.monotonicGrowthDetected, false);
});

test('PSS trend can gate combined leak-sensitive categories', () => {
  const samples = Array.from({ length: 20 }, (_, index) => ({
    totalPssKb: 300_000 - index * 1_000,
    nativeHeapPssKb: 180_000 + index * 500,
    privateOtherPssKb: 20_000 + index * 300,
  }));
  const trend = summarizePssTrend(samples, ['nativeHeapPssKb', 'privateOtherPssKb']);
  assert.deepEqual(trend.metricKeys, ['nativeHeapPssKb', 'privateOtherPssKb']);
  assert.equal(trend.monotonicGrowthDetected, true);
});

test('flags only sustained monotonic growth above the ten MiB soak gate', () => {
  const leaking = Array.from({ length: 20 }, (_, index) => ({ totalPssKb: 100_000 + index * 700 }));
  assert.equal(summarizePssTrend(leaking).monotonicGrowthDetected, true);

  const noisy = Array.from({ length: 20 }, (_, index) => ({
    totalPssKb: 105_000 + (index % 4) * 1_000 - (index % 3) * 800,
  }));
  assert.equal(summarizePssTrend(noisy).monotonicGrowthDetected, false);

  const risingWithLateCollection = Array.from({ length: 20 }, (_, index) => ({
    totalPssKb: 100_000 + index * 700 - (index >= 15 ? 2_500 : 0),
  }));
  const lateCollectionTrend = summarizePssTrend(risingWithLateCollection);
  assert.ok(lateCollectionTrend.growthKb > 10 * 1024);
  assert.ok(lateCollectionTrend.medianGrowthKb < 10 * 1024);
  assert.equal(lateCollectionTrend.monotonicGrowthDetected, true);
});

test('exit-info signatures ignore rotating ordinals but retain failure identity', () => {
  const entry = (ordinal, pid, reason) => [
    `        ApplicationExitInfo #${ordinal}:`,
    '          timestamp=2026-09-01 12:34:56.789',
    `          pid=${pid}`,
    `          reason=${reason}`,
    '          subreason=0 (UNKNOWN)',
    '          status=0',
  ].join('\n');
  assert.deepEqual(
    parseExitInfoSignatures(`${entry(0, 123, '4 (CRASH)')}\n${entry(1, 99, '10 (USER REQUESTED)')}`),
    new Set([
      '2026-09-01 12:34:56.789|123|4 (CRASH)|0 (UNKNOWN)|0',
      '2026-09-01 12:34:56.789|99|10 (USER REQUESTED)|0 (UNKNOWN)|0',
    ]),
  );
  assert.deepEqual(
    parseExitInfoSignatures(entry(7, 123, '4 (CRASH)')),
    new Set(['2026-09-01 12:34:56.789|123|4 (CRASH)|0 (UNKNOWN)|0']),
  );
});

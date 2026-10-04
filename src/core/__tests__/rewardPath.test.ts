// src/core/__tests__/rewardPath.test.ts
import { levelsToNext, pathIndexReached, pathTotals, pointsForClear, progressToNext } from '../rewardPath';

const COSTS = [3, 5, 6];

test('earning table: campaign 1, daily 2, perfect adds 1', () => {
  expect(pointsForClear('campaign', false)).toBe(1);
  expect(pointsForClear('campaign', true)).toBe(2);
  expect(pointsForClear('daily', false)).toBe(2);
  expect(pointsForClear('daily', true)).toBe(3);
});

test('totals are cumulative', () => {
  expect(pathTotals(COSTS)).toEqual([3, 8, 14]);
});

test('index reached counts totals at or below points, exact boundary included', () => {
  const t = pathTotals(COSTS);
  expect(pathIndexReached(0, t)).toBe(0);
  expect(pathIndexReached(2, t)).toBe(0);
  expect(pathIndexReached(3, t)).toBe(1);
  expect(pathIndexReached(7, t)).toBe(1);
  expect(pathIndexReached(8, t)).toBe(2);
  expect(pathIndexReached(999, t)).toBe(3);
});

test('levels to next assume +1 per level and are null when complete', () => {
  const t = pathTotals(COSTS);
  expect(levelsToNext(0, t)).toBe(3);
  expect(levelsToNext(3, t)).toBe(5);
  expect(levelsToNext(13, t)).toBe(1);
  expect(levelsToNext(14, t)).toBeNull();
});

test('progress to next is the share of the current step, 1 when complete', () => {
  const t = pathTotals(COSTS);
  expect(progressToNext(0, t)).toBe(0);
  expect(progressToNext(5, t)).toBeCloseTo(2 / 5);
  expect(progressToNext(14, t)).toBe(1);
});

test('corrupt points (negative, NaN) read as 0', () => {
  const t = pathTotals(COSTS);
  expect(pathIndexReached(-5, t)).toBe(0);
  expect(levelsToNext(Number.NaN, t)).toBe(3);
});

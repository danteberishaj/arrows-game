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

import { etaForRank, grantNext, unownedPath } from '../rewardPath';

const IDS = [6, 1, 5, 12];

test('grantNext gives the first unowned path id and skips owned ones', () => {
  const none = { lo: 0, hi: 0 };
  const a = grantNext(none, IDS);
  expect(a.granted).toBe(6);
  const bought = { lo: (1 << 6) | (1 << 1), hi: 0 }; // Critter granted, Cinnamon bought
  expect(grantNext(bought, IDS).granted).toBe(5);
  const all = IDS.reduce((m, id) => ({ lo: m.lo | (1 << id), hi: 0 }), none);
  expect(grantNext(all, IDS)).toEqual({ owned: all, granted: null });
});

test('unownedPath keeps path order', () => {
  expect(unownedPath({ lo: 1 << 1, hi: 0 }, IDS)).toEqual([6, 5, 12]);
});

test('etaForRank uses the step after the grants already made', () => {
  const totals = [3, 8, 14, 22];
  expect(etaForRank(4, totals, 1, 0)).toBe(4);   // next step total 8
  expect(etaForRank(4, totals, 1, 1)).toBe(10);  // step after: 14
  expect(etaForRank(4, totals, 1, 3)).toBeNull(); // beyond the last step: "Not on the path"
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleLevelPlan, createSoakPlan } from './soak-plan';

test('creates one prior warmup and an exact contiguous measured range', () => {
  const plan = createSoakPlan(3827, 20);

  assert.equal(plan.warmup.levelIndex, 3826);
  assert.deepEqual(
    plan.measured.map((level) => level.levelIndex),
    Array.from({ length: 20 }, (_, index) => 3827 + index),
  );
  assert.deepEqual(
    plan.measured[0],
    {
      ...plan.measured[0],
      rows: 39,
      cols: 39,
      arrowCount: 250,
      shapeName: 'Flower',
      boardChecksum: 'b1f50ecb',
    },
  );
});

test('every planned level has one in-bounds, validated head per arrow', () => {
  const plan = createSoakPlan(3827, 20);
  for (const level of [plan.warmup, ...plan.measured]) {
    assert.equal(level.taps.length, level.arrowCount);
    assert.match(level.boardChecksum, /^[0-9a-f]{8}$/);
    assert.match(level.solveChecksum, /^[0-9a-f]{8}$/);
    for (const tap of level.taps) {
      assert.ok(tap.row >= 0 && tap.row < level.rows);
      assert.ok(tap.col >= 0 && tap.col < level.cols);
    }
  }
});

test('rejects soak ranges that cannot provide the required warmup or sample count', () => {
  assert.throws(() => createSoakPlan(0, 20), /greater than zero/);
  assert.throws(() => createSoakPlan(3827, 19), /20 through 50/);
  assert.throws(() => createSoakPlan(3827, 51), /20 through 50/);
});

// W3-15: the single-level workload reads its grid from the generated level.
// Index 5363 is a 34x37 board (EXECUTED 2026-09-16), so a plan that kept the
// 39x39 harness grid would tap empty space.
test('the single-level plan for index 5363 reports rows 34 and cols 37, not 39', () => {
  const level = createSingleLevelPlan(5363, 1);
  assert.equal(level.levelIndex, 5363);
  assert.equal(level.displayedLevel, 5364);
  assert.equal(level.rows, 34);
  assert.equal(level.cols, 37);
  assert.equal(level.taps.length, level.arrowCount);
});

test('the single-level plan keeps 3827/v1 and its historical blocked cells', () => {
  const level = createSingleLevelPlan(3827, 1);
  assert.equal(level.rows, 39);
  assert.equal(level.cols, 39);
  assert.equal(level.arrowCount, 250);
  assert.equal(level.boardChecksum, 'b1f50ecb');
  assert.deepEqual(level.blockedTaps, [
    { row: 35, col: 19 },
    { row: 31, col: 14 },
    { row: 30, col: 21 },
  ]);
});

test('a v2 single-level plan deals v2 and names three distinct blocked arrows in its grid', () => {
  const v1 = createSingleLevelPlan(2705, 1);
  const v2 = createSingleLevelPlan(2705, 2);
  assert.equal(v2.genVersion, 2);
  assert.notEqual(v2.boardChecksum, v1.boardChecksum);
  assert.equal(v2.blockedTaps.length, 3);
  assert.equal(new Set(v2.blockedTaps.map(({ row, col }) => `${row},${col}`)).size, 3);
  for (const tap of v2.blockedTaps) {
    assert.ok(tap.row >= 0 && tap.row < v2.rows);
    assert.ok(tap.col >= 0 && tap.col < v2.cols);
  }
});

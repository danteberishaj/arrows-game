import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoakPlan } from './soak-plan';

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

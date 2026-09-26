/**
 * W2-07: which pop a heart pip plays. A refill pop needs BOTH a new refill token
 * (bumped only by an earned rewarded continue) and the pip turning filled, so a
 * Retry after a loss or a Next after a lossy win (hearts reset by loadSession,
 * pips keyed by index and never remounted) plays nothing.
 */
import {
  HEART_PIP_LOSS_START_SCALE,
  HEART_PIP_REFILL_START_SCALE,
  pipPopKind,
} from '../heartPip';

describe('pipPopKind', () => {
  test('loss edge (filled -> spent) is a loss pop', () => {
    expect(pipPopKind(true, false, 0, 0)).toBe('loss');
  });

  test('a loss edge stays a loss pop even if a token change arrives with it', () => {
    expect(pipPopKind(true, false, 0, 1)).toBe('loss');
  });

  test('token change plus filled edge (spent -> filled) is a refill pop', () => {
    expect(pipPopKind(false, true, 0, 1)).toBe('refill');
    expect(pipPopKind(false, true, 4, 5)).toBe('refill');
  });

  test('filled edge without a token change (Retry after a loss, Next after a lossy win) is nothing', () => {
    expect(pipPopKind(false, true, 0, 0)).toBe('none');
    expect(pipPopKind(false, true, 3, 3)).toBe('none');
  });

  test('a token change on a pip that was already filled, or stays spent, is nothing', () => {
    expect(pipPopKind(true, true, 0, 1)).toBe('none');
    expect(pipPopKind(false, false, 0, 1)).toBe('none');
  });

  test('initial mount (no previous state: prev = current, same token) is nothing', () => {
    expect(pipPopKind(true, true, 0, 0)).toBe('none');
    expect(pipPopKind(false, false, 0, 0)).toBe('none');
  });
});

describe('start scales', () => {
  test('the loss pop keeps the shipped 1.35 overshoot', () => {
    expect(HEART_PIP_LOSS_START_SCALE).toBe(1.35);
  });

  test('the refill starts below rest, the mirror of the loss overshoot (1 / 1.35)', () => {
    expect(HEART_PIP_REFILL_START_SCALE).toBeCloseTo(1 / 1.35, 12);
    expect(HEART_PIP_REFILL_START_SCALE).toBeLessThan(1);
  });
});

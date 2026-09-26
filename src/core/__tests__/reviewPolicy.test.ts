/**
 * W4-11: the decision that spends a finite quota. Apple shows the system
 * prompt at most 3 times per 365 days; Play applies an undisclosed time-bound
 * quota and silently shows nothing beyond it. Every "yes" here may burn one of
 * the player's three lifetime asks, so each gate is pinned on its own and at
 * its boundary.
 */
import {
  REVIEW_LIFETIME_MAX,
  REVIEW_MIN_GAP_DAYS,
  REVIEW_MIN_SOLVES,
  reviewDeclineReason,
  shouldRequestReview,
  type ReviewPolicyInput,
} from '../reviewPolicy';

const TODAY = 2460;

/** A perfect clear that meets every gate, including the first ask ever. */
const eligible: ReviewPolicyInput = Object.freeze({
  perfect: true,
  assisted: false,
  totalSolved: 30,
  today: TODAY,
  count: 0,
  lastDay: 0,
  askedThisSession: false,
});

const ask = (patch: Partial<ReviewPolicyInput>) => shouldRequestReview({ ...eligible, ...patch });

test('the owner-picked starting values are the ruling W4-9 numbers', () => {
  expect(REVIEW_MIN_SOLVES).toBe(25);
  expect(REVIEW_LIFETIME_MAX).toBe(3);
  expect(REVIEW_MIN_GAP_DAYS).toBe(90);
});

describe('yes', () => {
  test('a perfect clear meeting every gate, the first ask (count 0, lastDay 0)', () => {
    expect(shouldRequestReview(eligible)).toBe(true);
    expect(reviewDeclineReason(eligible)).toBeNull();
  });

  test('exactly the solve minimum', () => {
    expect(ask({ totalSolved: REVIEW_MIN_SOLVES })).toBe(true);
  });

  test('a later ask exactly 90 days after the last one, with asks left', () => {
    expect(ask({ count: 1, lastDay: TODAY - 90 })).toBe(true);
    expect(ask({ count: 2, lastDay: TODAY - 400 })).toBe(true);
  });
});

describe('no (one gate at a time)', () => {
  test('non-perfect (a heart was lost, or a continue left 1 heart)', () => {
    expect(ask({ perfect: false })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, perfect: false })).toBe('not_perfect');
  });

  test('assisted: ftueStage was 2 at clear time (W1-06 made blocked taps free)', () => {
    expect(ask({ assisted: true })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, assisted: true })).toBe('assisted');
  });

  test('already asked this session', () => {
    expect(ask({ askedThisSession: true })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, askedThisSession: true })).toBe('asked_this_session');
  });

  test('below the solve minimum (24)', () => {
    expect(ask({ totalSolved: REVIEW_MIN_SOLVES - 1 })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, totalSolved: 24 })).toBe('too_few_solves');
  });

  test('lifetime count 3 (and above)', () => {
    expect(ask({ count: 3, lastDay: TODAY - 400 })).toBe(false);
    expect(ask({ count: 4, lastDay: TODAY - 400 })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, count: 3, lastDay: TODAY - 400 })).toBe('lifetime_cap');
  });

  test('89 days since the last ask', () => {
    expect(ask({ count: 1, lastDay: TODAY - 89 })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, count: 1, lastDay: TODAY - 89 })).toBe('too_soon');
  });

  test('the same day as the last ask', () => {
    expect(ask({ count: 1, lastDay: TODAY })).toBe(false);
  });

  test('clock moved back: the last ask is after today', () => {
    expect(ask({ count: 1, lastDay: TODAY + 1 })).toBe(false);
    expect(reviewDeclineReason({ ...eligible, count: 1, lastDay: TODAY + 1 })).toBe('clock_moved_back');
    // A restore from a device whose clock ran far ahead: still not eligible.
    expect(ask({ count: 1, lastDay: TODAY + 400 })).toBe(false);
  });
});

describe('corrupt stored values fail closed (a finite quota is never guessed over)', () => {
  test.each([
    ['negative count', { count: -1 }],
    ['fractional count', { count: 0.5 }],
    ['NaN count', { count: Number.NaN }],
    ['negative lastDay', { lastDay: -5 }],
    ['fractional lastDay', { lastDay: 10.5 }],
    ['NaN lastDay', { lastDay: Number.NaN }],
    ['NaN today', { today: Number.NaN }],
  ])('%s', (_name, patch) => {
    expect(ask(patch as Partial<ReviewPolicyInput>)).toBe(false);
    expect(reviewDeclineReason({ ...eligible, ...(patch as Partial<ReviewPolicyInput>) })).toBe('corrupt');
  });
});

test('pure: the same input always gives the same answer and the input is not mutated', () => {
  const input = { ...eligible };
  const first = shouldRequestReview(input);
  expect(shouldRequestReview(input)).toBe(first);
  expect(input).toEqual(eligible);
});

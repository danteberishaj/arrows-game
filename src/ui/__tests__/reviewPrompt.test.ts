/**
 * W4-11 timing contract of the store-review ask, relative to the win panel
 * (src/ui/overlayPresence.ts, GameScreen's Stars), and the bounded wait that
 * Next / Done use for an in-flight flow. Pure node: no React, no native module.
 */
import {
  FIRST_STAR_DELAY_MS,
  PANEL_BACKSTOP_MARGIN_MS,
  PANEL_WIN_ENTER_MS,
  STAR_STAGGER_MS,
} from '../overlayPresence';
import {
  REVIEW_DWELL_MS,
  REVIEW_FLOW_WAIT_MAX_MS,
  reviewDiag,
  reviewSession,
  settleWithin,
} from '../reviewPrompt';

const HEARTS = 3; // every campaign and daily board (src/core/difficulty.ts)

describe('the ask lands after the win panel has come to rest', () => {
  test('owner-picked starting values', () => {
    expect(REVIEW_DWELL_MS).toBe(2000);
    expect(REVIEW_FLOW_WAIT_MAX_MS).toBe(3000);
  });

  test('never during the entrance: later than the 180 ms entrance and its 250 ms backstop settle', () => {
    expect(PANEL_WIN_ENTER_MS).toBe(180);
    expect(REVIEW_DWELL_MS).toBeGreaterThan(PANEL_WIN_ENTER_MS + PANEL_BACKSTOP_MARGIN_MS);
  });

  test('never before every star has started its entrance (last star at 250 + 2 x 170 = 590 ms)', () => {
    const lastStarStart = FIRST_STAR_DELAY_MS + (HEARTS - 1) * STAR_STAGGER_MS;
    expect(lastStarStart).toBe(590);
    expect(REVIEW_DWELL_MS).toBeGreaterThan(lastStarStart);
  });
});

describe('settleWithin', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('resolves when the flow settles, and leaves no timer behind', async () => {
    let settle!: () => void;
    const flow = new Promise<void>((resolve) => { settle = resolve; });
    let done = false;
    void settleWithin(flow, 3000).then(() => { done = true; });
    settle();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('resolves after the bound when the flow never settles', async () => {
    let done = false;
    void settleWithin(new Promise<void>(() => undefined), 3000).then(() => { done = true; });
    jest.advanceTimersByTime(2999);
    await Promise.resolve();
    expect(done).toBe(false);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  test('a rejected flow still resolves (never throws into Next / Done)', async () => {
    await expect(settleWithin(Promise.reject(new Error('x')), 3000)).resolves.toBeUndefined();
  });
});

test('the session starts un-asked', () => {
  expect(reviewSession.asked).toBe(false);
});

test('diagnostics are silent outside a capture or development build', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  reviewDiag('ask available=true');
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});

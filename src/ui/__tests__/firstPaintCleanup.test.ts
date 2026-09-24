import {
  FirstPaintCleanupTimer,
  type FirstPaintCleanupClock,
} from '../firstPaintCleanup';

class FakeCleanupClock implements FirstPaintCleanupClock {
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delayMs);
  }

  clearTimer(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
  }
}

describe('FirstPaintCleanupTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts the lifetime only after the flash has committed for its first paint', () => {
    const clock = new FakeCleanupClock();
    const cleanup = jest.fn();
    const timer = new FirstPaintCleanupTimer(clock);

    timer.stage({ id: 1, durationMs: 340, onElapsed: cleanup });
    expect(jest.getTimerCount()).toBe(0);

    timer.committed(1);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(339);
    expect(cleanup).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('lets a newer blocked tap supersede the older cleanup', () => {
    const clock = new FakeCleanupClock();
    const firstCleanup = jest.fn();
    const secondCleanup = jest.fn();
    const timer = new FirstPaintCleanupTimer(clock);

    timer.stage({ id: 1, durationMs: 340, onElapsed: firstCleanup });
    timer.committed(1);
    expect(jest.getTimerCount()).toBe(1);

    timer.stage({ id: 2, durationMs: 340, onElapsed: secondCleanup });
    expect(jest.getTimerCount()).toBe(0);
    timer.committed(1);
    expect(jest.getTimerCount()).toBe(0);
    timer.committed(2);
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(340);
    expect(firstCleanup).not.toHaveBeenCalled();
    expect(secondCleanup).toHaveBeenCalledTimes(1);
  });

  it('cancels cleanup when the current flash is removed', () => {
    const clock = new FakeCleanupClock();
    const cleanup = jest.fn();
    const timer = new FirstPaintCleanupTimer(clock);

    timer.stage({ id: 1, durationMs: 340, onElapsed: cleanup });
    timer.committed(1);
    timer.clear(1);

    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(340);
    expect(cleanup).not.toHaveBeenCalled();
  });

  // POLISH-T6: the static layer takes the arrow's final look back while the
  // overlay still covers it, so the hand-back runs from the same first-paint
  // clock, before the cleanup, and dies with its stage.
  it('runs the hand-back at its offset from the first paint, before the cleanup', () => {
    const clock = new FakeCleanupClock();
    const order: string[] = [];
    const timer = new FirstPaintCleanupTimer(clock);

    timer.stage({
      id: 1,
      durationMs: 340,
      onElapsed: () => order.push('cleanup'),
      handBack: { atMs: 170, run: () => order.push('hand-back') },
    });
    expect(jest.getTimerCount()).toBe(0);
    timer.committed(1);
    jest.advanceTimersByTime(169);
    expect(order).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(order).toEqual(['hand-back']);
    jest.advanceTimersByTime(170);
    expect(order).toEqual(['hand-back', 'cleanup']);
  });

  it('cancels a pending hand-back when a newer flash supersedes or the flash is cleared', () => {
    const clock = new FakeCleanupClock();
    const handBack = jest.fn();
    const timer = new FirstPaintCleanupTimer(clock);

    timer.stage({ id: 1, durationMs: 340, onElapsed: jest.fn(), handBack: { atMs: 170, run: handBack } });
    timer.committed(1);
    timer.stage({ id: 2, durationMs: 340, onElapsed: jest.fn() });
    timer.committed(2);
    jest.advanceTimersByTime(1000);
    expect(handBack).not.toHaveBeenCalled();

    timer.stage({ id: 3, durationMs: 340, onElapsed: jest.fn(), handBack: { atMs: 170, run: handBack } });
    timer.committed(3);
    timer.clear();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(handBack).not.toHaveBeenCalled();
  });
});

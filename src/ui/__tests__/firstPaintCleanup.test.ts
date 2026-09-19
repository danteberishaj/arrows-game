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
});

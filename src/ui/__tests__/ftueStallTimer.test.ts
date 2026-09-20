import { FtueStallTimer } from '../ftueStallTimer';

const TEST_DELAY_MS = 1_000;

class FakeClock {
  now = 0;

  advance(ms: number): void {
    this.now += ms;
  }
}

describe('FtueStallTimer', () => {
  it('becomes due at the delay, but not before it', () => {
    const clock = new FakeClock();
    const timer = new FtueStallTimer(TEST_DELAY_MS);

    timer.arm(clock.now);
    clock.advance(TEST_DELAY_MS - 1);
    expect(timer.due(clock.now)).toBe(false);

    clock.advance(1);
    expect(timer.due(clock.now)).toBe(true);
  });

  it('pushes the due time out by a full delay after a removal', () => {
    const clock = new FakeClock();
    const timer = new FtueStallTimer(TEST_DELAY_MS);

    timer.arm(clock.now);
    clock.advance(TEST_DELAY_MS - 1);
    timer.onRemoval(clock.now);
    clock.advance(TEST_DELAY_MS - 1);
    expect(timer.due(clock.now)).toBe(false);

    clock.advance(1);
    expect(timer.due(clock.now)).toBe(true);
  });

  it('is never due after cancellation', () => {
    const clock = new FakeClock();
    const timer = new FtueStallTimer(TEST_DELAY_MS);

    timer.arm(clock.now);
    timer.cancel();
    clock.advance(TEST_DELAY_MS * 2);

    expect(timer.due(clock.now)).toBe(false);
  });

  it('fires once per deal until armed again', () => {
    const clock = new FakeClock();
    const timer = new FtueStallTimer(TEST_DELAY_MS);

    timer.arm(clock.now);
    clock.advance(TEST_DELAY_MS);
    expect(timer.due(clock.now)).toBe(true);
    expect(timer.due(clock.now)).toBe(false);

    timer.onRemoval(clock.now);
    clock.advance(TEST_DELAY_MS);
    expect(timer.due(clock.now)).toBe(false);

    timer.arm(clock.now);
    clock.advance(TEST_DELAY_MS);
    expect(timer.due(clock.now)).toBe(true);
  });

  it('is never due when the delay is null', () => {
    const clock = new FakeClock();
    const timer = new FtueStallTimer(null);

    timer.arm(clock.now);
    timer.onRemoval(clock.now);
    clock.advance(TEST_DELAY_MS * 2);

    expect(timer.due(clock.now)).toBe(false);
  });
});

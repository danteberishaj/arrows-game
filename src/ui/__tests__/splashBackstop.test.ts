import { createSplashBackstop } from '../splashBackstop';

/** A manual clock and timer queue: nothing happens unless the test says so. */
function harness(maxMs = 4000) {
  let clock = 1000;
  let next = 1;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  const cleared: number[] = [];
  let doneCalls = 0;
  const backstop = createSplashBackstop({
    maxMs,
    now: () => clock,
    setTimer: (fn: () => void, ms: number) => {
      const id = next++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id: number) => {
      cleared.push(id);
      pending.delete(id);
    },
    onDone: () => {
      doneCalls += 1;
    },
  });
  return {
    backstop,
    advance: (ms: number) => {
      clock += ms;
    },
    pendingDelays: () => [...pending.values()].map((t) => t.ms),
    /** Fires every pending timer, as the JS runtime would once its delay passed. */
    fireTimers: () => {
      const due = [...pending.entries()];
      for (const [id] of due) pending.delete(id);
      for (const [, t] of due) t.fn();
    },
    cleared,
    doneCalls: () => doneCalls,
  };
}

describe('createSplashBackstop', () => {
  it('finish() from a skip plus the scripted completion in the same tick calls onDone once', () => {
    const h = harness();
    // Both Reanimated completion callbacks land on the JS thread back to back.
    h.backstop.finish();
    h.backstop.finish();
    expect(h.doneCalls()).toBe(1);
  });

  it('starts a maxMs timer on construction and does not call onDone before it fires', () => {
    const h = harness(4000);
    expect(h.pendingDelays()).toEqual([4000]);
    expect(h.doneCalls()).toBe(0);
  });

  it('the timer fires onDone once, and a late animation completion adds nothing', () => {
    const h = harness();
    h.advance(4000);
    h.fireTimers();
    expect(h.doneCalls()).toBe(1);
    h.backstop.finish();
    h.fireTimers();
    expect(h.doneCalls()).toBe(1);
  });

  it("'active' after maxMs finishes (a JS timer does not fire while Android has the app paused)", () => {
    const h = harness(4000);
    h.advance(4000);
    h.backstop.onAppStateChange('active');
    expect(h.doneCalls()).toBe(1);
  });

  it("'active' before maxMs does not finish", () => {
    const h = harness(4000);
    h.advance(3999);
    h.backstop.onAppStateChange('active');
    expect(h.doneCalls()).toBe(0);
    expect(h.pendingDelays()).toEqual([4000]);
  });

  it("states other than 'active' never finish, even after maxMs", () => {
    const h = harness(4000);
    h.advance(10_000);
    h.backstop.onAppStateChange('background');
    h.backstop.onAppStateChange('inactive');
    expect(h.doneCalls()).toBe(0);
  });

  it("the timer and a later 'active' together call onDone once", () => {
    const h = harness(4000);
    h.advance(5000);
    h.backstop.onAppStateChange('active');
    h.fireTimers();
    h.backstop.onAppStateChange('active');
    expect(h.doneCalls()).toBe(1);
  });

  it('finish() clears the pending timer', () => {
    const h = harness();
    h.backstop.finish();
    expect(h.pendingDelays()).toEqual([]);
    expect(h.cleared).toHaveLength(1);
  });

  it('dispose() clears the timer, and nothing fires after dispose', () => {
    const h = harness(4000);
    h.backstop.dispose();
    expect(h.cleared).toEqual([1]);
    expect(h.pendingDelays()).toEqual([]);
    h.advance(10_000);
    h.fireTimers();
    h.backstop.onAppStateChange('active');
    h.backstop.finish();
    expect(h.doneCalls()).toBe(0);
  });

  it('a timer callback that was already queued when dispose() ran does not call onDone', () => {
    // clearTimer cannot recall a callback the runtime already dequeued.
    let queued: (() => void) | null = null;
    let doneCalls = 0;
    const backstop = createSplashBackstop({
      maxMs: 4000,
      now: () => 0,
      setTimer: (fn: () => void) => {
        queued = fn;
        return 1;
      },
      clearTimer: () => {},
      onDone: () => {
        doneCalls += 1;
      },
    });
    backstop.dispose();
    queued!();
    expect(doneCalls).toBe(0);
  });
});

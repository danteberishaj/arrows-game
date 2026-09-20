import { createAdInitController } from '../adInit';

/** A manual clock: timers fire only when the test says so. */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  return {
    setTimer: (fn: () => void, ms: number) => {
      const id = next++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id: unknown) => {
      pending.delete(id as number);
    },
    pendingDelays: () => [...pending.values()].map((t) => t.ms),
    /** Fire every pending timer once (they may schedule new ones). */
    fireAll: () => {
      const due = [...pending.entries()];
      for (const [id] of due) pending.delete(id);
      for (const [, t] of due) t.fn();
    },
  };
}

/** An attempt whose outcome each test settles by hand. */
function manualAttempts() {
  const calls: { resolve: (outcome?: 'declined') => void; reject: (e: unknown) => void }[] = [];
  const attempt = () =>
    new Promise<void | 'declined'>((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  return { attempt, calls };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('createAdInitController', () => {
  it('start() twice while running performs one attempt', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10, 20], ...t });
    expect(c.state).toBe('idle');
    c.start();
    c.start();
    expect(a.calls).toHaveLength(1);
    expect(c.state).toBe('running');
  });

  it('failed then onAppActive starts an attempt', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10], ...t });
    c.start();
    a.calls[0].reject(new Error('offline'));
    await flush();
    expect(c.state).toBe('failed');
    c.onAppActive();
    expect(a.calls).toHaveLength(2);
    expect(c.state).toBe('running');
  });

  it('onAppActive() in running or ready does nothing', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10], ...t });
    c.start();
    c.onAppActive();
    expect(a.calls).toHaveLength(1);
    a.calls[0].resolve();
    await flush();
    expect(c.state).toBe('ready');
    c.onAppActive();
    expect(a.calls).toHaveLength(1);
  });

  it('onAppActive() before start() does nothing', () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10], ...t });
    c.onAppActive();
    expect(a.calls).toHaveLength(0);
    expect(c.state).toBe('idle');
  });

  it('after a failure schedules exactly delaysMs.length timed attempts, in order, then none', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const delays = [5000, 15000, 45000];
    const c = createAdInitController({ attempt: a.attempt, delaysMs: delays, ...t });
    c.start();
    const scheduled: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      a.calls[a.calls.length - 1].reject(new Error('offline'));
      await flush();
      expect(c.state).toBe('failed');
      scheduled.push(...t.pendingDelays());
      if (t.pendingDelays().length === 0) break;
      expect(t.pendingDelays()).toHaveLength(1); // never two timers at once
      t.fireAll();
      expect(c.state).toBe('running');
    }
    expect(scheduled).toEqual(delays);
    expect(a.calls).toHaveLength(1 + delays.length);
  });

  it('an empty delay list disables timed retries but not onAppActive', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [], ...t });
    c.start();
    a.calls[0].reject(new Error('offline'));
    await flush();
    expect(t.pendingDelays()).toEqual([]);
    c.onAppActive();
    expect(a.calls).toHaveLength(2);
  });

  it('onAppActive after the timed list is exhausted still starts an attempt', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [1], ...t });
    c.start();
    a.calls[0].reject(new Error('offline'));
    await flush();
    t.fireAll();
    a.calls[1].reject(new Error('offline'));
    await flush();
    expect(t.pendingDelays()).toEqual([]);
    c.onAppActive();
    expect(a.calls).toHaveLength(3);
  });

  it('an app-active attempt cancels the pending timer, so one failure never yields two attempts', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [100, 200], ...t });
    c.start();
    a.calls[0].reject(new Error('offline'));
    await flush();
    expect(t.pendingDelays()).toEqual([100]);
    c.onAppActive();
    expect(t.pendingDelays()).toEqual([]);
    expect(a.calls).toHaveLength(2);
    a.calls[1].reject(new Error('offline'));
    await flush();
    // The cancelled timer never fired, so the first delay is still owed.
    expect(t.pendingDelays()).toEqual([100]);
  });

  it('after ready, no further attempt ever starts', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10, 20], ...t });
    c.start();
    a.calls[0].reject(new Error('offline'));
    await flush();
    t.fireAll();
    a.calls[1].resolve();
    await flush();
    expect(c.state).toBe('ready');
    expect(t.pendingDelays()).toEqual([]);
    c.start();
    c.onAppActive();
    t.fireAll();
    expect(a.calls).toHaveLength(2);
    expect(c.state).toBe('ready');
  });

  it('an attempt that throws synchronously counts as a failure', async () => {
    const t = fakeTimers();
    let n = 0;
    const c = createAdInitController({
      attempt: () => {
        n += 1;
        throw new Error('sync');
      },
      delaysMs: [10],
      ...t,
    });
    await c.start();
    expect(n).toBe(1);
    expect(c.state).toBe('failed');
    expect(t.pendingDelays()).toEqual([10]);
  });

  it('start() resolves when the attempt settles and never rejects', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [], ...t });
    const p = c.start();
    a.calls[0].reject(new Error('offline'));
    await expect(p).resolves.toBeUndefined();
  });

  it('a declined outcome is terminal until consentChanged starts exactly one attempt', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [10, 20], ...t });

    c.start();
    a.calls[0].resolve('declined');
    await flush();

    expect(c.state).toBe('declined');
    expect(t.pendingDelays()).toEqual([]);
    t.fireAll();
    c.onAppActive();
    c.start();
    expect(a.calls).toHaveLength(1);

    c.consentChanged();
    c.consentChanged();
    expect(c.state).toBe('running');
    expect(a.calls).toHaveLength(2);
  });

  it('a throwing attempt ends failed, never ready', async () => {
    const t = fakeTimers();
    const source = {
      gather: async () => {
        throw new Error('CMP unreachable');
      },
    };
    const c = createAdInitController({
      attempt: async () => {
        await source.gather();
      },
      delaysMs: [],
      ...t,
    });

    await c.start();

    expect(c.state).toBe('failed');
    expect(c.state).not.toBe('ready');
  });

  it('consentChanged after ready starts exactly one attempt', async () => {
    const t = fakeTimers();
    const a = manualAttempts();
    const c = createAdInitController({ attempt: a.attempt, delaysMs: [], ...t });

    c.start();
    a.calls[0].resolve();
    await flush();
    expect(c.state).toBe('ready');

    c.consentChanged();
    c.consentChanged();

    expect(c.state).toBe('running');
    expect(a.calls).toHaveLength(2);
  });
});

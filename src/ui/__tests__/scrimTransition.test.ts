/**
 * W2-04 level -> level scrim sequencer (idle -> covering -> covered -> uncovering -> idle).
 * Pure logic with an injected clock, timers, frame source, app-state source and
 * opacity driver. Jest fake timers stand in for the JS timers; the clock is
 * separate so a test can move time on WITHOUT firing timers, which is what
 * Android does to a paused (backgrounded) app: JS timers do not fire.
 */
import { awaitAdThenPanelBeat, ScrimTransition, type ScrimDriver } from '../scrimTransition';

const COVER_MS = 180;
const UNCOVER_MS = 180;
const BLOCK_MS = 300;
const FRAME_MS = 16;

class FakeClock {
  t = 0;
  now = () => this.t;
}

class FakeAppState {
  listeners = new Set<(state: string) => void>();
  subscribe = (listener: (state: string) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  emit(state: string): void {
    for (const listener of [...this.listeners]) listener(state);
  }
}

class FakeDriver implements ScrimDriver {
  calls: string[] = [];
  coverDone: (() => void) | null = null;
  uncoverDone: (() => void) | null = null;
  cover(durationMs: number, onDone: () => void): void {
    this.calls.push(`cover ${durationMs}`);
    this.coverDone = onDone;
  }
  uncover(durationMs: number, onDone: () => void): void {
    this.calls.push(`uncover ${durationMs}`);
    this.uncoverDone = onDone;
  }
  snap(opacity: 0 | 1): void {
    this.calls.push(`snap ${opacity}`);
  }
}

function setup() {
  const clock = new FakeClock();
  const appState = new FakeAppState();
  const driver = new FakeDriver();
  const scrim = new ScrimTransition({
    coverMs: COVER_MS,
    uncoverMs: UNCOVER_MS,
    backstopMarginMs: BLOCK_MS,
    now: clock.now,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    requestFrame: (fn) => setTimeout(fn, FRAME_MS),
    cancelFrame: (handle) => clearTimeout(handle),
    subscribeAppState: appState.subscribe,
    driver,
  });
  const onCovered = jest.fn();
  return { clock, appState, driver, scrim, onCovered };
}

/** Advance the JS timers and the clock together (a foreground app). */
function advance(clock: FakeClock, ms: number): void {
  clock.t += ms;
  jest.advanceTimersByTime(ms);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('onCovered runs exactly once', () => {
  test('(a) the cover animation callback arrives', () => {
    const { clock, appState, driver, scrim, onCovered } = setup();
    expect(scrim.start(onCovered)).toBe(true);
    expect(scrim.state).toBe('covering');
    expect(driver.calls).toEqual([`cover ${COVER_MS}`]);

    advance(clock, COVER_MS);
    expect(onCovered).not.toHaveBeenCalled(); // the callback, not the clock, ends the leg
    driver.coverDone!();
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(scrim.state).toBe('covered');

    // Every other source arriving later changes nothing.
    driver.coverDone!();
    advance(clock, 10_000);
    appState.emit('active');
    expect(onCovered).toHaveBeenCalledTimes(1);
  });

  test('(b) the callback never arrives: the backstop at cover + margin fires once, fully opaque', () => {
    const { clock, driver, scrim, onCovered } = setup();
    scrim.start(onCovered);

    advance(clock, COVER_MS + BLOCK_MS - 1);
    expect(onCovered).not.toHaveBeenCalled();
    advance(clock, 1);
    expect(onCovered).toHaveBeenCalledTimes(1);
    // The swap never happens behind a partly transparent scrim.
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, 'snap 1']);

    advance(clock, 10_000);
    driver.coverDone!(); // a very late callback
    expect(onCovered).toHaveBeenCalledTimes(1);
  });

  test('(c) backgrounded mid-cover, then active: once, and only after the cover time', () => {
    const { clock, appState, driver, scrim, onCovered } = setup();
    scrim.start(onCovered);
    advance(clock, 60);

    // Background: the clock moves 5 s but no JS timer fires.
    appState.emit('background');
    clock.t += 5_000;
    expect(onCovered).not.toHaveBeenCalled();

    appState.emit('active');
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(driver.calls).toContain('snap 1');

    driver.coverDone!(); // Reanimated finishes the frozen animation on resume
    advance(clock, 10_000); // the stale backstop
    appState.emit('active');
    expect(onCovered).toHaveBeenCalledTimes(1);
  });

  test('an active event before the cover time has elapsed does not end the cover early', () => {
    const { clock, appState, scrim, onCovered } = setup();
    scrim.start(onCovered);
    advance(clock, COVER_MS - 1);
    appState.emit('active');
    expect(onCovered).not.toHaveBeenCalled();
    expect(scrim.state).toBe('covering');
  });
});

describe('start', () => {
  test('a second start while running returns false and does not replace onCovered', () => {
    const { clock, driver, scrim, onCovered } = setup();
    const second = jest.fn();
    expect(scrim.start(onCovered)).toBe(true);
    expect(scrim.start(second)).toBe(false); // covering

    driver.coverDone!();
    expect(scrim.start(second)).toBe(false); // covered, waiting for the commit

    scrim.contentCommitted();
    expect(scrim.start(second)).toBe(false); // covered, waiting for the frame
    advance(clock, FRAME_MS);
    expect(scrim.state).toBe('uncovering');
    expect(scrim.start(second)).toBe(false); // uncovering

    driver.uncoverDone!();
    expect(scrim.state).toBe('idle');
    expect(second).not.toHaveBeenCalled();
    expect(onCovered).toHaveBeenCalledTimes(1);

    expect(scrim.start(second)).toBe(true); // idle again: a new transition may start
  });

  test('busy is true from start until the uncover completes', () => {
    const { clock, driver, scrim, onCovered } = setup();
    expect(scrim.busy).toBe(false);
    scrim.start(onCovered);
    expect(scrim.busy).toBe(true);
    driver.coverDone!();
    scrim.contentCommitted();
    advance(clock, FRAME_MS);
    expect(scrim.busy).toBe(true);
    driver.uncoverDone!();
    expect(scrim.busy).toBe(false);
  });
});

describe('uncover waits for the committed new content', () => {
  test('uncover never begins before contentCommitted(), however long the wait', () => {
    const { clock, appState, driver, scrim, onCovered } = setup();
    scrim.start(onCovered);
    driver.coverDone!();

    advance(clock, 60_000);
    appState.emit('background');
    clock.t += 5_000;
    appState.emit('active');
    expect(driver.calls.some((call) => call.startsWith('uncover'))).toBe(false);
    expect(driver.calls).not.toContain('snap 0');
    expect(scrim.state).toBe('covered');
  });

  test('then it waits one frame after the commit', () => {
    const { clock, driver, scrim, onCovered } = setup();
    scrim.start(onCovered);
    driver.coverDone!();
    scrim.contentCommitted();
    expect(driver.calls.some((call) => call.startsWith('uncover'))).toBe(false);

    advance(clock, FRAME_MS - 1);
    expect(driver.calls.some((call) => call.startsWith('uncover'))).toBe(false);
    advance(clock, 1);
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, `uncover ${UNCOVER_MS}`]);
  });

  test('a commit that lands while covering (not the swap it waits for) is ignored', () => {
    const { clock, driver, scrim, onCovered } = setup();
    scrim.start(onCovered);
    scrim.contentCommitted(); // e.g. an unrelated re-render keyed on the old revision
    driver.coverDone!();
    advance(clock, 1_000);
    expect(scrim.state).toBe('covered');
    expect(driver.calls.some((call) => call.startsWith('uncover'))).toBe(false);
  });

  test('a commit while idle is ignored (the initial mount)', () => {
    const { clock, driver, scrim } = setup();
    scrim.contentCommitted();
    advance(clock, 1_000);
    expect(driver.calls).toEqual([]);
    expect(scrim.state).toBe('idle');
  });

  test('a commit made synchronously inside onCovered still counts', () => {
    const { clock, driver, scrim } = setup();
    scrim.start(() => scrim.contentCommitted());
    driver.coverDone!();
    advance(clock, FRAME_MS);
    expect(scrim.state).toBe('uncovering');
  });

  test('if onCovered throws, the scrim still uncovers instead of staying opaque', () => {
    const { clock, driver, scrim } = setup();
    scrim.start(() => {
      throw new Error('generation failed');
    });
    expect(() => driver.coverDone!()).toThrow('generation failed');
    advance(clock, FRAME_MS);
    expect(scrim.state).toBe('uncovering');
  });
});

describe('the uncover leg cannot leave the screen opaque', () => {
  function toUncovering() {
    const ctx = setup();
    ctx.scrim.start(ctx.onCovered);
    ctx.driver.coverDone!();
    ctx.scrim.contentCommitted();
    advance(ctx.clock, FRAME_MS);
    expect(ctx.scrim.state).toBe('uncovering');
    return ctx;
  }

  test('the uncover callback ends the transition', () => {
    const { driver, scrim } = toUncovering();
    driver.uncoverDone!();
    expect(scrim.state).toBe('idle');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('backstop: no uncover callback -> forced to opacity 0 at uncover + margin', () => {
    const { clock, driver, scrim } = toUncovering();
    advance(clock, UNCOVER_MS + BLOCK_MS - 1);
    expect(scrim.state).toBe('uncovering');
    advance(clock, 1);
    expect(driver.calls.at(-1)).toBe('snap 0');
    expect(scrim.state).toBe('idle');
    driver.uncoverDone!(); // late: harmless
    expect(scrim.state).toBe('idle');
  });

  test('AppState active during the uncover forces opacity 0 at once', () => {
    const { appState, driver, scrim } = toUncovering();
    appState.emit('background');
    appState.emit('active');
    expect(driver.calls.at(-1)).toBe('snap 0');
    expect(scrim.state).toBe('idle');
  });

  test('the app-state listener is removed once idle', () => {
    const { appState, driver } = toUncovering();
    expect(appState.listeners.size).toBe(1);
    driver.uncoverDone!();
    expect(appState.listeners.size).toBe(0);
  });
});

describe('dispose', () => {
  test.each([
    ['covering', (ctx: ReturnType<typeof setup>) => {
      ctx.scrim.start(ctx.onCovered);
    }],
    ['covered, waiting for the commit', (ctx: ReturnType<typeof setup>) => {
      ctx.scrim.start(ctx.onCovered);
      ctx.driver.coverDone!();
    }],
    ['covered, waiting for the frame', (ctx: ReturnType<typeof setup>) => {
      ctx.scrim.start(ctx.onCovered);
      ctx.driver.coverDone!();
      ctx.scrim.contentCommitted();
    }],
    ['uncovering', (ctx: ReturnType<typeof setup>) => {
      ctx.scrim.start(ctx.onCovered);
      ctx.driver.coverDone!();
      ctx.scrim.contentCommitted();
      advance(ctx.clock, FRAME_MS);
    }],
  ])('while %s leaves no pending timer, frame or listener, and nothing runs after it', (_label, reach) => {
    const ctx = setup();
    reach(ctx);
    expect(ctx.appState.listeners.size).toBe(1);

    ctx.scrim.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(ctx.appState.listeners.size).toBe(0);

    const callsAtDispose = ctx.driver.calls.length;
    const coveredAtDispose = ctx.onCovered.mock.calls.length;
    ctx.driver.coverDone?.();
    ctx.driver.uncoverDone?.();
    ctx.scrim.contentCommitted();
    ctx.appState.emit('active');
    advance(ctx.clock, 60_000);
    expect(ctx.driver.calls.length).toBe(callsAtDispose);
    expect(ctx.onCovered.mock.calls.length).toBe(coveredAtDispose);
    expect(ctx.scrim.start(ctx.onCovered)).toBe(false);
  });

  test('while idle is a no-op with no timers', () => {
    const { scrim } = setup();
    scrim.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('awaitAdThenPanelBeat: the panel is seen again before the cover starts', () => {
  const BEAT_MS = 450;
  const SHOWN_MIN_MS = 250;

  function deps() {
    const clock = new FakeClock();
    const appState = new FakeAppState();
    let current = 'active';
    appState.subscribe((s) => { current = s; });
    let resolveShow: () => void = () => {};
    const show = jest.fn(() => new Promise<void>((r) => { resolveShow = r; }));
    const run = () => awaitAdThenPanelBeat({
      show,
      beatMs: BEAT_MS,
      shownMinMs: SHOWN_MIN_MS,
      now: clock.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      currentAppState: () => current,
      subscribeAppState: appState.subscribe,
    });
    return { clock, appState, show, run, resolve: () => resolveShow() };
  }

  async function flush(): Promise<void> {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  }

  test('no ad (not due): resolves at once, no beat, no timer left', async () => {
    const d = deps();
    const done = jest.fn();
    d.run().then(done);
    d.resolve();
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(d.appState.listeners.size).toBe(1); // only the test's own state tracker
  });

  test('real ad (the activity left the foreground): waits for active, then the beat', async () => {
    const d = deps();
    const done = jest.fn();
    d.run().then(done);
    d.appState.emit('background');
    d.clock.t += 20_000;
    d.resolve(); // the SDK's closed event can land before our activity is resumed
    await flush();
    advance(d.clock, 5_000);
    await flush();
    expect(done).not.toHaveBeenCalled();

    d.appState.emit('active');
    await flush();
    advance(d.clock, BEAT_MS - 1);
    await flush();
    expect(done).not.toHaveBeenCalled();
    advance(d.clock, 1);
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
    expect(d.appState.listeners.size).toBe(1);
  });

  test('real ad, already active when the show resolves: the beat alone', async () => {
    const d = deps();
    const done = jest.fn();
    d.run().then(done);
    d.appState.emit('background');
    d.appState.emit('active');
    d.resolve();
    await flush();
    expect(done).not.toHaveBeenCalled();
    advance(d.clock, BEAT_MS);
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
  });

  test('in-app simulated ad (no app-state change) that stayed up: the beat', async () => {
    const d = deps();
    const done = jest.fn();
    d.run().then(done);
    d.clock.t += SHOWN_MIN_MS;
    d.resolve();
    await flush();
    expect(done).not.toHaveBeenCalled();
    advance(d.clock, BEAT_MS);
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
  });

  test('a failed show propagates and leaves no listener', async () => {
    const d = deps();
    d.show.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(d.run()).rejects.toThrow('boom');
    expect(d.appState.listeners.size).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

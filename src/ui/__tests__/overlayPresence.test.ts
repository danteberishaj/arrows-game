/**
 * W2-05 (META_PANEL_MOTION) win/lose panel presence latch:
 * hidden -> entering -> shown -> exiting -> hidden.
 * Pure logic; Jest fake timers stand in for the JS timers. A backgrounded
 * Android app does not fire JS timers or animation frames, so "backgrounded"
 * here means: emit a non-active AppState and do NOT advance the timers.
 */
import {
  FIRST_STAR_DELAY_MS,
  OverlayPresence,
  PANEL_BACKSTOP_MARGIN_MS,
  PANEL_ENTER_SCALE,
  PANEL_EXIT_MS,
  PANEL_LOSS_ENTER_CANDIDATES_MS,
  PANEL_LOSS_ENTER_MS,
  PANEL_WIN_ENTER_MS,
  type PresenceDriver,
  type PresenceState,
} from '../overlayPresence';

const ENTER_MS = 180;
const EXIT_MS = 180;
const MARGIN_MS = 70;

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

class FakeDriver implements PresenceDriver {
  calls: string[] = [];
  done: (() => void) | null = null;
  animateTo(target: 0 | 1, durationMs: number, onDone: () => void): void {
    this.calls.push(`animate ${target} ${durationMs}`);
    this.done = onDone;
  }
  snap(value: 0 | 1): void {
    this.calls.push(`snap ${value}`);
  }
}

function setup() {
  const appState = new FakeAppState();
  const driver = new FakeDriver();
  const presence = new OverlayPresence({
    backstopMarginMs: MARGIN_MS,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    subscribeAppState: appState.subscribe,
    driver,
  });
  // Every state the latch publishes, in order (what React would render).
  const published: PresenceState[] = [];
  presence.subscribe(() => published.push(presence.getSnapshot()));
  return { appState, driver, presence, published };
}

/** How many times the overlay would mount: hidden -> any visible state. */
function mountCount(published: PresenceState[]): number {
  let previous: PresenceState = 'hidden';
  let mounts = 0;
  for (const state of published) {
    if (previous === 'hidden' && state !== 'hidden') mounts += 1;
    previous = state;
  }
  return mounts;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('entrance', () => {
  test('show starts from 0 and settles to shown on the animation callback', () => {
    const { driver, presence } = setup();
    presence.show(ENTER_MS);
    expect(presence.state).toBe('entering');
    expect(driver.calls).toEqual(['snap 0', `animate 1 ${ENTER_MS}`]);
    driver.done!();
    expect(presence.state).toBe('shown');
    // The settle puts the value at rest itself; it does not trust the animation.
    expect(driver.calls.at(-1)).toBe('snap 1');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an entrance reaches shown from the backstop if the callback never fires', () => {
    const { driver, presence } = setup();
    presence.show(ENTER_MS);
    jest.advanceTimersByTime(ENTER_MS + MARGIN_MS - 1);
    expect(presence.state).toBe('entering');
    jest.advanceTimersByTime(1);
    expect(presence.state).toBe('shown');
    expect(driver.calls.at(-1)).toBe('snap 1');
  });

  test('backgrounding during an entrance and then active settles to shown (no timer fired)', () => {
    const { appState, driver, presence } = setup();
    presence.show(ENTER_MS);
    appState.emit('background');
    expect(presence.state).toBe('entering');
    appState.emit('active');
    expect(presence.state).toBe('shown');
    expect(driver.calls.at(-1)).toBe('snap 1');
    expect(jest.getTimerCount()).toBe(0);
    expect(appState.listeners.size).toBe(0);
  });

  test('an active event with no background during the leg does not cut it short', () => {
    const { appState, presence } = setup();
    presence.show(ENTER_MS);
    appState.emit('active');
    expect(presence.state).toBe('entering');
  });

  test('a late callback from the entrance is ignored after the backstop settled it', () => {
    const { driver, presence, published } = setup();
    presence.show(ENTER_MS);
    const late = driver.done!;
    jest.advanceTimersByTime(ENTER_MS + MARGIN_MS);
    presence.hide(EXIT_MS);
    late();
    expect(presence.state).toBe('exiting');
    expect(published).toEqual(['entering', 'shown', 'exiting']);
  });

  test('duration 0 (reduce motion) is at rest at once: shown, value 1, no timer, no animation', () => {
    const { driver, presence, published } = setup();
    presence.show(0);
    expect(presence.state).toBe('shown');
    expect(published).toEqual(['shown']);
    expect(driver.calls).toEqual(['snap 1']);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('show while entering or shown does nothing', () => {
    const { driver, presence } = setup();
    presence.show(ENTER_MS);
    presence.show(ENTER_MS);
    expect(driver.calls).toEqual(['snap 0', `animate 1 ${ENTER_MS}`]);
    driver.done!();
    presence.show(ENTER_MS);
    expect(presence.state).toBe('shown');
    expect(driver.calls).toHaveLength(3);
  });
});

describe('exit (continue-with-ad only)', () => {
  function shown() {
    const env = setup();
    env.presence.show(ENTER_MS);
    env.driver.done!();
    env.driver.calls = [];
    return env;
  }

  test('hide animates to 0 and settles to hidden on the callback', () => {
    const { driver, presence } = shown();
    presence.hide(EXIT_MS);
    expect(presence.state).toBe('exiting');
    expect(driver.calls).toEqual([`animate 0 ${EXIT_MS}`]);
    driver.done!();
    expect(presence.state).toBe('hidden');
    expect(driver.calls.at(-1)).toBe('snap 0');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an exit reaches hidden even if the callback never fires', () => {
    const { driver, presence } = shown();
    presence.hide(EXIT_MS);
    jest.advanceTimersByTime(EXIT_MS + MARGIN_MS - 1);
    expect(presence.state).toBe('exiting');
    jest.advanceTimersByTime(1);
    expect(presence.state).toBe('hidden');
    expect(driver.calls.at(-1)).toBe('snap 0');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('backgrounding during an exit and then active settles to hidden', () => {
    const { appState, presence } = shown();
    presence.hide(EXIT_MS);
    appState.emit('background');
    appState.emit('active');
    expect(presence.state).toBe('hidden');
  });

  test('the ad-close active event arriving after the exit began does not skip the fade', () => {
    // The rewarded ad's close resolves the show; AppState 'active' can land
    // just after the exit starts. Only a background seen DURING the leg counts.
    const { appState, presence } = shown();
    presence.hide(EXIT_MS);
    appState.emit('active');
    expect(presence.state).toBe('exiting');
  });

  test('pointerEvents is none for the whole exiting state and auto otherwise', () => {
    const { driver, presence } = setup();
    expect(presence.pointerEvents).toBe('auto');
    presence.show(ENTER_MS);
    expect(presence.pointerEvents).toBe('auto'); // buttons respond during the entrance
    driver.done!();
    expect(presence.pointerEvents).toBe('auto');
    presence.hide(EXIT_MS);
    const seen: string[] = [];
    for (let t = 0; t < EXIT_MS + MARGIN_MS; t += 10) {
      expect(presence.state).toBe('exiting');
      seen.push(presence.pointerEvents);
      jest.advanceTimersByTime(10);
    }
    expect(new Set(seen)).toEqual(new Set(['none']));
    expect(presence.state).toBe('hidden');
  });

  test('hide while hidden or already exiting does nothing', () => {
    const { driver, presence } = setup();
    presence.hide(EXIT_MS);
    expect(presence.state).toBe('hidden');
    expect(driver.calls).toEqual([]);
    presence.show(ENTER_MS);
    driver.done!();
    presence.hide(EXIT_MS);
    const calls = driver.calls.length;
    presence.hide(EXIT_MS);
    expect(driver.calls).toHaveLength(calls);
  });

  test('lose -> continue -> immediate lose (re-enter while exiting) ends shown with exactly one mount', () => {
    const { driver, presence, published } = setup();
    presence.show(ENTER_MS); // lose
    driver.done!();
    presence.hide(EXIT_MS); // continue
    const exitDone = driver.done!;
    jest.advanceTimersByTime(EXIT_MS / 2);
    presence.show(ENTER_MS); // lose again, mid-exit
    expect(presence.state).toBe('entering');
    // Re-entry animates from the current value: no snap to 0 (no blink).
    expect(driver.calls.slice(-1)).toEqual([`animate 1 ${ENTER_MS}`]);
    exitDone(); // the superseded exit's callback is ignored
    expect(presence.state).toBe('entering');
    jest.advanceTimersByTime(ENTER_MS + MARGIN_MS); // neither old timer hides it
    expect(presence.state).toBe('shown');
    expect(published).toEqual(['entering', 'shown', 'exiting', 'entering', 'shown']);
    expect(published).not.toContain('hidden');
    expect(mountCount(published)).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('hideNow (Next / Retry) and dispose', () => {
  test('hideNow from any state is hidden at once with the value at 0 and nothing pending', () => {
    for (const settle of [false, true]) {
      const { appState, driver, presence } = setup();
      presence.show(ENTER_MS);
      if (settle) driver.done!();
      const late = driver.done!;
      presence.hideNow();
      expect(presence.state).toBe('hidden');
      expect(driver.calls.at(-1)).toBe('snap 0');
      expect(jest.getTimerCount()).toBe(0);
      expect(appState.listeners.size).toBe(0);
      late();
      expect(presence.state).toBe('hidden');
    }
  });

  test('dispose clears every timer and listener and ignores later calls', () => {
    const { appState, driver, presence } = setup();
    presence.show(ENTER_MS);
    const late = driver.done!;
    presence.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(appState.listeners.size).toBe(0);
    late();
    presence.show(ENTER_MS);
    presence.hide(EXIT_MS);
    expect(presence.state).toBe('disposed');
  });

  test('unsubscribe stops notifications', () => {
    const { presence } = setup();
    const seen: string[] = [];
    const off = presence.subscribe(() => seen.push(presence.getSnapshot()));
    presence.show(0);
    off();
    presence.hideNow();
    expect(seen).toEqual(['shown']);
  });
});

describe('timing constants (W2-05 constraints)', () => {
  test('the win entrance settles, even on its backstop, no later than the first star starts', () => {
    expect(PANEL_WIN_ENTER_MS).toBe(180);
    expect(FIRST_STAR_DELAY_MS).toBe(250);
    expect(PANEL_WIN_ENTER_MS + PANEL_BACKSTOP_MARGIN_MS).toBeLessThanOrEqual(FIRST_STAR_DELAY_MS);
  });

  test('loss candidates are 180 / 260 / 340, the provisional loss value is 260, and loss >= win', () => {
    expect(PANEL_LOSS_ENTER_CANDIDATES_MS).toEqual([180, 260, 340]);
    expect(PANEL_LOSS_ENTER_MS).toBe(260);
    for (const ms of PANEL_LOSS_ENTER_CANDIDATES_MS) expect(ms).toBeGreaterThanOrEqual(PANEL_WIN_ENTER_MS);
  });

  test('the exit uses the win-entrance duration and the entrance scale is 0.94', () => {
    expect(PANEL_EXIT_MS).toBe(PANEL_WIN_ENTER_MS);
    expect(PANEL_ENTER_SCALE).toBe(0.94);
  });
});

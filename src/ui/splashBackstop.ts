/**
 * Boot backstop for the splash. Pure TS (no react-native import): the clock and
 * the timer functions are injected, so the policy is unit-testable in node.
 *
 * The splash hands over to the menu from Reanimated completion callbacks. If
 * those never arrive, the player would stay on the splash forever. This object
 * guarantees the hand-over:
 *
 * - `finish()` calls `onDone` at most once for the lifetime of the object, so a
 *   skip tap and the scripted fade-out finishing together hand over once.
 * - Construction starts a `maxMs` timer that calls `finish()`.
 * - `onAppStateChange('active')` calls `finish()` once `maxMs` has passed since
 *   construction. A JS timer does not fire while Android has the app paused,
 *   so the timer alone is not a backstop.
 * - `dispose()` (unmount) clears the timer; nothing calls `onDone` after it.
 */

export interface SplashBackstop {
  /** Hands over to the next screen. Only the first call (before dispose) has an effect. */
  finish(): void;
  /** Feed every `AppState` change here. */
  onAppStateChange(state: string): void;
  /** Clears the timer. After this, no call reaches `onDone`. */
  dispose(): void;
}

export function createSplashBackstop<TimerHandle>({
  maxMs,
  now,
  setTimer,
  clearTimer,
  onDone,
}: {
  maxMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  onDone: () => void;
}): SplashBackstop {
  const mountedAt = now();
  let closed = false;
  let timer: { handle: TimerHandle } | null = null;

  const cancelTimer = () => {
    if (timer) clearTimer(timer.handle);
    timer = null;
  };

  const finish = () => {
    if (closed) return;
    closed = true;
    cancelTimer();
    onDone();
  };

  timer = {
    handle: setTimer(() => {
      timer = null;
      finish();
    }, maxMs),
  };

  return {
    finish,
    onAppStateChange(state) {
      if (state === 'active' && now() - mountedAt >= maxMs) finish();
    },
    dispose() {
      closed = true;
      cancelTimer();
    },
  };
}

/**
 * W2-05 (META_PANEL_MOTION) presence latch for the win / lose panel:
 * hidden -> entering -> shown -> exiting -> hidden.
 * Pure TS (no react-native import): timers, the AppState source and the value
 * driver are injected, so the policy is unit-tested in node
 * (src/ui/__tests__/overlayPresence.test.ts). Patterned on W2-04's
 * scrimTransition.ts.
 *
 * - `show(ms)` from hidden starts the entrance from 0; from exiting it turns
 *   the exit around from the current value (one overlay, never remounted).
 * - `hide(ms)` (continue-with-ad only) keeps the overlay mounted while it
 *   fades; `pointerEvents` is 'none' for the whole exiting state and GameScreen
 *   keeps the board locked until hidden.
 * - `hideNow()` (Next / Retry, a new session) is hidden at once.
 * - Each leg settles exactly once, from whichever comes first: the animation's
 *   completion callback, a JS backstop timer at `ms + backstopMarginMs`, or an
 *   AppState 'active' after the app was backgrounded during the leg (JS timers
 *   and animation frames do not run while Android has the app paused). Every
 *   settle snaps the value to its rest (1 shown, 0 hidden) and publishes the
 *   new state, so GameScreen re-renders the overlay with a static rest style:
 *   visibility never depends on an animation finishing.
 * - `ms <= 0` (reduce motion) is at rest at once: no animation, no timer.
 */

/**
 * Win entrance, derived constraint: it must settle before the first star's
 * spring starts (FIRST_STAR_DELAY_MS). Owner accepts from artifacts/W2-05/owner/.
 */
export const PANEL_WIN_ENTER_MS = 180; // OWNER-PICKED STARTING VALUE
/** The three loss-entrance candidates shown to the owner in one capture (loss >= win). */
export const PANEL_LOSS_ENTER_CANDIDATES_MS = [180, 260, 340] as const; // OWNER-PICKED STARTING VALUE candidates
// OWNER PICK 2026-09-25 ("keep 260"), chosen from
// artifacts/W2-05/owner/loss-entrance-candidates-180-260-340.mp4
export const PANEL_LOSS_ENTER_MS = 260;
/** The continue-with-ad dismissal fades over the win-entrance duration (brief). */
export const PANEL_EXIT_MS = PANEL_WIN_ENTER_MS;
/** The panel grows from this scale to 1 as it enters (the button press-scale literal). */
export const PANEL_ENTER_SCALE = 0.94; // OWNER-PICKED STARTING VALUE
/** The first win-panel star starts its spring this long after the panel mounts (Stars, unchanged). */
export const FIRST_STAR_DELAY_MS = 250;
/**
 * Backstop margin, derived: the win entrance settles no later than the first
 * star starts even when its completion callback is lost (180 + 70 = 250).
 */
export const PANEL_BACKSTOP_MARGIN_MS = FIRST_STAR_DELAY_MS - PANEL_WIN_ENTER_MS;

export type PresenceState = 'hidden' | 'entering' | 'shown' | 'exiting' | 'disposed';

/** Drives the overlay's single presence value 0..1 (Reanimated in the app). */
export interface PresenceDriver {
  /** Animate the value to `target`; call `onDone` when it has arrived. */
  animateTo(target: 0 | 1, durationMs: number, onDone: () => void): void;
  /** Cancel any animation and set the value at once. */
  snap(value: 0 | 1): void;
}

export interface OverlayPresenceOptions<TimerHandle> {
  /** Added to each leg's duration for its JS backstop timer. */
  backstopMarginMs: number;
  setTimer: (fn: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  /** Subscribes to AppState changes; returns the unsubscribe function. */
  subscribeAppState: (listener: (state: string) => void) => () => void;
  driver: PresenceDriver;
}

export class OverlayPresence<TimerHandle = unknown> {
  private current: PresenceState = 'hidden';
  private timer: { handle: TimerHandle } | null = null;
  private unsubscribeAppState: (() => void) | null = null;
  /** The app left the foreground during the running leg. */
  private backgroundedInLeg = false;
  /** Bumped per leg so a late callback from an earlier leg is ignored. */
  private leg = 0;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly options: OverlayPresenceOptions<TimerHandle>) {}

  get state(): PresenceState {
    return this.current;
  }

  /** For useSyncExternalStore. */
  readonly getSnapshot = (): PresenceState => this.current;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** An exiting overlay never takes a touch. */
  get pointerEvents(): 'auto' | 'none' {
    return this.current === 'exiting' ? 'none' : 'auto';
  }

  show(durationMs: number): void {
    if (this.current === 'hidden') {
      if (durationMs > 0) this.options.driver.snap(0); // start from nothing
    } else if (this.current !== 'exiting') {
      return; // entering, shown, disposed
    }
    this.beginLeg('entering', 1, durationMs);
  }

  hide(durationMs: number): void {
    if (this.current !== 'entering' && this.current !== 'shown') return;
    this.beginLeg('exiting', 0, durationMs);
  }

  hideNow(): void {
    if (this.current === 'disposed') return;
    this.endLeg();
    this.options.driver.snap(0);
    this.publish('hidden');
  }

  dispose(): void {
    this.endLeg();
    this.current = 'disposed';
    this.listeners.clear();
  }

  private beginLeg(state: 'entering' | 'exiting', target: 0 | 1, durationMs: number): void {
    this.endLeg();
    if (durationMs <= 0) {
      this.options.driver.snap(target);
      this.publish(target === 1 ? 'shown' : 'hidden');
      return;
    }
    const leg = this.leg;
    this.backgroundedInLeg = false;
    this.unsubscribeAppState = this.options.subscribeAppState((appState) => {
      if (appState !== 'active') {
        this.backgroundedInLeg = true;
      } else if (this.backgroundedInLeg) {
        this.settle(leg);
      }
    });
    this.timer = {
      handle: this.options.setTimer(() => {
        this.timer = null;
        this.settle(leg);
      }, durationMs + this.options.backstopMarginMs),
    };
    this.publish(state);
    this.options.driver.animateTo(target, durationMs, () => this.settle(leg));
  }

  private settle(leg: number): void {
    if (leg !== this.leg) return;
    const target = this.current === 'entering' ? 1 : this.current === 'exiting' ? 0 : null;
    if (target === null) return;
    this.endLeg();
    this.options.driver.snap(target);
    this.publish(target === 1 ? 'shown' : 'hidden');
  }

  /** Invalidate the running leg: timer, AppState listener and late callbacks. */
  private endLeg(): void {
    this.leg += 1;
    if (this.timer) this.options.clearTimer(this.timer.handle);
    this.timer = null;
    this.unsubscribeAppState?.();
    this.unsubscribeAppState = null;
  }

  private publish(state: PresenceState): void {
    if (this.current === state) return;
    this.current = state;
    for (const listener of [...this.listeners]) listener();
  }
}

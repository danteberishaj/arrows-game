/**
 * W2-04 (META_LEVEL_TRANSITION) level -> level cover: a flat background-coloured
 * scrim fades in, the level is swapped under full cover, the scrim fades out.
 * Pure TS (no react-native import): clock, timers, frame source, app-state
 * source and the opacity driver are injected, so the policy is unit-tested in
 * node (src/ui/__tests__/scrimTransition.test.ts).
 *
 * idle -> covering -> covered -> uncovering -> idle
 *
 * - `start(onCovered)` returns false unless idle.
 * - `onCovered` (the swap) runs exactly once, from whichever comes first: the
 *   cover animation's completion callback, a JS backstop timer at
 *   `coverMs + backstopMarginMs`, or an AppState 'active' event once `coverMs`
 *   has passed since start (a JS timer does not fire while Android has the app
 *   paused, so the timer alone is not a backstop). A backstop or AppState end
 *   snaps the scrim to opacity 1 first: the swap never shows through.
 * - The uncover starts only after `contentCommitted()` (GameScreen calls it
 *   from an effect keyed on the session revision) plus one frame, so the old
 *   board cannot show through the fading scrim.
 * - The uncover leg has its own backstop timer and an AppState force, both of
 *   which snap the scrim to opacity 0: the failure this guards is a permanently
 *   opaque screen.
 * - `dispose()` (unmount) clears every timer, frame and listener; nothing runs
 *   after it.
 */

export type ScrimState = 'idle' | 'covering' | 'covered' | 'uncovering' | 'disposed';

/** Drives the scrim's single opacity value (Reanimated in the app). */
export interface ScrimDriver {
  /** Animate opacity to 1; call `onDone` when it has arrived. */
  cover(durationMs: number, onDone: () => void): void;
  /** Animate opacity to 0; call `onDone` when it has arrived. */
  uncover(durationMs: number, onDone: () => void): void;
  /** Cancel any animation and set the opacity at once. */
  snap(opacity: 0 | 1): void;
}

export interface ScrimTransitionOptions<TimerHandle, FrameHandle> {
  coverMs: number;
  uncoverMs: number;
  /** Added to each leg's duration for its JS backstop timer. */
  backstopMarginMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  requestFrame: (fn: () => void) => FrameHandle;
  cancelFrame: (handle: FrameHandle) => void;
  /** Subscribes to AppState changes; returns the unsubscribe function. */
  subscribeAppState: (listener: (state: string) => void) => () => void;
  driver: ScrimDriver;
}

export class ScrimTransition<TimerHandle = unknown, FrameHandle = unknown> {
  private current: ScrimState = 'idle';
  private startedAt = 0;
  private onCovered: (() => void) | null = null;
  /** Set once the swap has run; a commit only counts after it. */
  private swapped = false;
  private timer: { handle: TimerHandle } | null = null;
  private frame: { handle: FrameHandle } | null = null;
  private unsubscribeAppState: (() => void) | null = null;
  /** Bumped per leg so a late animation callback from an earlier leg is ignored. */
  private leg = 0;

  constructor(private readonly options: ScrimTransitionOptions<TimerHandle, FrameHandle>) {}

  get state(): ScrimState {
    return this.current;
  }

  /** A transition is running (the scrim is not at rest at opacity 0). */
  get busy(): boolean {
    return this.current !== 'idle' && this.current !== 'disposed';
  }

  start(onCovered: () => void): boolean {
    if (this.current !== 'idle') return false;
    const { coverMs, backstopMarginMs, now, setTimer, subscribeAppState, driver } = this.options;
    this.current = 'covering';
    this.startedAt = now();
    this.onCovered = onCovered;
    this.swapped = false;
    this.unsubscribeAppState = subscribeAppState((state) => this.onAppStateChange(state));
    const leg = ++this.leg;
    this.timer = {
      handle: setTimer(() => {
        this.timer = null;
        this.endCover(true);
      }, coverMs + backstopMarginMs),
    };
    driver.cover(coverMs, () => {
      if (leg === this.leg) this.endCover(false);
    });
    return true;
  }

  /** The new content is committed to React; the uncover may start one frame later. */
  contentCommitted(): void {
    if (this.current !== 'covered' || !this.swapped || this.frame !== null) return;
    this.frame = {
      handle: this.options.requestFrame(() => {
        this.frame = null;
        this.beginUncover();
      }),
    };
  }

  dispose(): void {
    this.cancelTimer();
    this.cancelFrame();
    this.unsubscribe();
    this.onCovered = null;
    this.leg += 1;
    this.current = 'disposed';
  }

  private onAppStateChange(state: string): void {
    if (state !== 'active') return;
    if (this.current === 'covering') {
      if (this.options.now() - this.startedAt >= this.options.coverMs) this.endCover(true);
    } else if (this.current === 'uncovering') {
      this.finish(true);
    }
  }

  private endCover(forced: boolean): void {
    if (this.current !== 'covering') return;
    this.cancelTimer();
    this.current = 'covered';
    this.leg += 1;
    if (forced) this.options.driver.snap(1);
    const onCovered = this.onCovered;
    this.onCovered = null;
    this.swapped = true;
    try {
      onCovered?.();
    } catch (error) {
      // A failed swap must not leave the screen opaque: uncover over whatever
      // is committed now.
      this.contentCommitted();
      throw error;
    }
  }

  private beginUncover(): void {
    if (this.current !== 'covered') return;
    const { uncoverMs, backstopMarginMs, setTimer, driver } = this.options;
    this.current = 'uncovering';
    const leg = ++this.leg;
    this.timer = {
      handle: setTimer(() => {
        this.timer = null;
        this.finish(true);
      }, uncoverMs + backstopMarginMs),
    };
    driver.uncover(uncoverMs, () => {
      if (leg === this.leg) this.finish(false);
    });
  }

  private finish(forced: boolean): void {
    if (this.current !== 'uncovering') return;
    this.cancelTimer();
    this.unsubscribe();
    this.leg += 1;
    this.current = 'idle';
    if (forced) this.options.driver.snap(0);
  }

  private cancelTimer(): void {
    if (this.timer) this.options.clearTimer(this.timer.handle);
    this.timer = null;
  }

  private cancelFrame(): void {
    if (this.frame) this.options.cancelFrame(this.frame.handle);
    this.frame = null;
  }

  private unsubscribe(): void {
    this.unsubscribeAppState?.();
    this.unsubscribeAppState = null;
  }
}

/**
 * W2-04 AC10: awaits the paced interstitial, and when an ad was actually shown,
 * holds so the player sees the win panel again before the cover starts.
 *
 * Found on emulator-5556 (artifacts/W2-04/real/nextad): without this, the cover
 * started the moment the SDK's closed event resolved the show, while Android's
 * ad-activity exit transition was still revealing the game (~185 ms at scale 1),
 * so the panel was never fully visible before the scrim rose.
 *
 * "An ad was shown" = the app left the foreground during the show (a real
 * full-screen ad activity), or the show lasted at least `shownMinMs` (the
 * in-app simulated ad of a `__DEV__` build, which cannot close before its
 * countdown). Then: wait for AppState 'active', then `beatMs`. No ad: resolves
 * at once. A rejected show propagates, as the await it replaces did.
 */
export async function awaitAdThenPanelBeat<TimerHandle>({
  show,
  beatMs,
  shownMinMs,
  now,
  setTimer,
  currentAppState,
  subscribeAppState,
}: {
  show: () => Promise<unknown>;
  beatMs: number;
  shownMinMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => TimerHandle;
  currentAppState: () => string;
  subscribeAppState: (listener: (state: string) => void) => () => void;
}): Promise<void> {
  const startedAt = now();
  let leftForeground = false;
  const unsubscribe = subscribeAppState((state) => {
    if (state !== 'active') leftForeground = true;
  });
  try {
    await show();
  } finally {
    unsubscribe();
  }
  if (!leftForeground && now() - startedAt < shownMinMs) return;
  if (currentAppState() !== 'active') {
    await new Promise<void>((resolve) => {
      const off = subscribeAppState((state) => {
        if (state !== 'active') return;
        off();
        resolve();
      });
    });
  }
  await new Promise<void>((resolve) => {
    setTimer(resolve, beatMs);
  });
}

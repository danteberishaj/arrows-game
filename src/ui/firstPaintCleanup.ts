export interface FirstPaintCleanupClock {
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
}

interface StagedCleanup {
  id: number;
  durationMs: number;
  onElapsed: () => void;
  /**
   * POLISH-T6: an earlier step on the same first-paint clock, for handing a
   * feedback arrow's final look back to the static layer while the overlay
   * still covers it. Superseded or cleared with its stage, like the cleanup.
   */
  handBack?: { atMs: number; run: () => void };
}

const defaultClock: FirstPaintCleanupClock = {
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
};

/**
 * Keeps a flash alive for its full designed lifetime after React commits it.
 * The caller reports that commit from a layout effect, immediately before the
 * flash's first paint. Staging supersedes older work without arming a timeout.
 */
export class FirstPaintCleanupTimer {
  private staged: StagedCleanup | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handBackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly clock: FirstPaintCleanupClock = defaultClock) {}

  stage(cleanup: StagedCleanup): void {
    this.cancelScheduledWork();
    this.staged = cleanup;
  }

  committed(id: number): void {
    const cleanup = this.staged;
    if (!cleanup || cleanup.id !== id || this.timer !== null) return;

    const timer = this.clock.setTimer(() => {
      if (this.timer === timer) this.timer = null;
      const current = this.staged;
      if (!current || current.id !== id) return;
      this.staged = null;
      current.onElapsed();
    }, cleanup.durationMs);
    this.timer = timer;

    const handBack = cleanup.handBack;
    if (handBack) {
      const handBackTimer = this.clock.setTimer(() => {
        if (this.handBackTimer === handBackTimer) this.handBackTimer = null;
        if (this.staged?.id !== id) return;
        handBack.run();
      }, handBack.atMs);
      this.handBackTimer = handBackTimer;
    }
  }

  clear(id?: number): void {
    if (id !== undefined && this.staged?.id !== id) return;
    this.cancelScheduledWork();
    this.staged = null;
  }

  private cancelScheduledWork(): void {
    if (this.timer !== null) {
      this.clock.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.handBackTimer !== null) {
      this.clock.clearTimer(this.handBackTimer);
      this.handBackTimer = null;
    }
  }
}

/**
 * Retryable ad-SDK init. Pure TS (no react-native import): the attempt and the
 * timer functions are injected, so the policy is unit-testable in node.
 *
 * - `start()` is idempotent: a no-op while an attempt is running, after one
 *   succeeded, or while consent remains declined.
 * - After a failure the next timed attempt is scheduled from `delaysMs`; once
 *   every delay has fired, timed retries stop.
 * - `onAppActive()` (the app came to the foreground) starts an attempt whenever
 *   the last one failed, whether or not timed attempts remain.
 * - `declined` is terminal until `consentChanged()` starts one new attempt.
 * - After `ready`, only `consentChanged()` can start another attempt.
 */

/**
 * Timed init retries after a failure. OWNER-PICKED STARTING VALUE: nothing was
 * measured behind these numbers. `[]` disables timed retries (app-active
 * retries still run).
 */
export const AD_INIT_RETRY_DELAYS_MS: readonly number[] = [5000, 15000, 45000]; // OWNER-PICKED STARTING VALUE

export type AdInitState = 'idle' | 'running' | 'ready' | 'failed' | 'declined';

export interface AdInitController {
  readonly state: AdInitState;
  /** Starts unless running, ready, or declined. Never rejects. */
  start(): Promise<void>;
  /** Call when the app becomes active: retries only after a failure. */
  onAppActive(): void;
  /** Re-evaluates consent after a decline or after the SDK became ready. */
  consentChanged(): void;
}

export function createAdInitController<TimerHandle>({
  attempt,
  delaysMs,
  setTimer,
  clearTimer,
}: {
  attempt: () => Promise<void | 'declined'>;
  delaysMs: readonly number[];
  setTimer: (fn: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
}): AdInitController {
  let state: AdInitState = 'idle';
  let inFlight: Promise<void> = Promise.resolve();
  let timer: { handle: TimerHandle } | null = null;
  /** Timed attempts that actually fired (a cancelled timer is not counted). */
  let timedFired = 0;

  const cancelTimer = () => {
    if (timer) clearTimer(timer.handle);
    timer = null;
  };

  const run = (): Promise<void> => {
    if (state === 'running' || state === 'ready' || state === 'declined') return inFlight;
    cancelTimer();
    state = 'running';
    let pending: Promise<void | 'declined'>;
    try {
      pending = Promise.resolve(attempt());
    } catch (e) {
      pending = Promise.reject(e);
    }
    inFlight = pending.then(
      (outcome) => {
        state = outcome === 'declined' ? 'declined' : 'ready';
        cancelTimer();
      },
      () => {
        state = 'failed';
        if (timedFired < delaysMs.length && timer === null) {
          const handle = setTimer(() => {
            timer = null;
            timedFired += 1;
            void run();
          }, delaysMs[timedFired]);
          timer = { handle };
        }
      },
    );
    return inFlight;
  };

  return {
    get state() {
      return state;
    },
    start: run,
    onAppActive() {
      if (state === 'failed') void run();
    },
    consentChanged() {
      if (state !== 'declined' && state !== 'ready') return;
      state = 'idle';
      void run();
    },
  };
}

import { SaveSystem } from '../core/saveSystem';
import { COLLECTION_SYNC_ENABLED } from '../featureFlags';

/**
 * W4-07: the menu-mount collection fold, kept off the menu's first frames.
 *
 * `SaveSystem.syncCollection` folds the campaign levels a player cleared
 * before recording existed (or while it was behind). For a deep player that is
 * thousands of shape lookups, which is far more than one frame of JS on
 * Hermes (artifacts/W4-07/). So the menu never folds during its mount or its
 * opening seconds: the fold starts COLLECTION_SYNC_START_DELAY_MS after the
 * mount, then runs one time-bounded slice per frame, inside that frame's
 * requestAnimationFrame callback, so each slice ends well before the next
 * vsync and no JS frame is stretched. Each slice persists its progress, so a
 * kill mid-fold keeps what was folded, and the pointer makes the next mount
 * resume there. Leaving the menu first (Play) cancels it; the campaign clear
 * then defers too, and a later menu visit catches up. Bits are delayed, never
 * dropped.
 */

/**
 * The menu's opening seconds share the CPU with app start-up work (ad SDK
 * initialisation and preloads, first renders). On the API 31 emulator a fold
 * started right after the first menu frame overlapped that burst and stretched
 * the worst JS frame of the menu's first 2 s from 31-43 ms (fold off) to
 * 55-405 ms (4 of 4 runs), while flag-off runs showed long JS frames up to
 * ~1.6 s after the mount (artifacts/W4-07/measure*). Starting after this delay
 * keeps the fold out of that burst. OWNER-PICKED STARTING VALUE.
 */
export const COLLECTION_SYNC_START_DELAY_MS = 2000; // OWNER-PICKED STARTING VALUE

/**
 * At most this many campaign levels are folded per menu mount (the brief's
 * "maxSteps = 5000 per call"): a very deep player catches up over a few menu
 * opens. A cap delays bits and never drops them.
 */
export const COLLECTION_SYNC_BUDGET_STEPS = 5000; // OWNER-PICKED STARTING VALUE

/**
 * JS work per frame. A slice stops at the first level boundary after this many
 * milliseconds (one level is ~26 us on the API 31 emulator, so the overshoot
 * is tiny), which adapts the slice to the device: a phone 3x slower than the
 * emulator folds a third of the levels per frame in the same time.
 * OWNER-PICKED STARTING VALUE (fix round 1: 200-level chunks of ~5 ms raised
 * the fold window's JS frame-interval p95 by ~3 ms; docs/next-level/reports/W4-07.md).
 */
export const COLLECTION_SYNC_SLICE_MS = 3; // OWNER-PICKED STARTING VALUE

/**
 * Safety cap on levels per slice, so a clock that does not advance can never
 * run a whole budget in one frame. Measured: 5000 levels cost 128.4 and
 * 129.9 ms unchunked (artifacts/W4-07/measure/oneshot-*), ~26 us a level, so
 * 200 levels is ~5 ms; on the emulator the time budget ends a slice first
 * (~115 levels). The phone cost is UNVERIFIED-DEVICE.
 */
export const COLLECTION_SYNC_CHUNK_STEPS = 200;

/**
 * Contention backoff. A slice can only overrun its budget when the JS thread
 * was descheduled mid-slice (another thread of the app, e.g. an ad video
 * decoder being created, or the host): on the API 31 emulator a 3 ms slice
 * once took 17.7 ms for a single level. And a frame that arrives late means
 * the JS or UI pipeline is already busy. Either way the fold steps aside for
 * this many frames (~0.5 s) instead of adding work to a busy system.
 * OWNER-PICKED STARTING VALUES.
 */
export const COLLECTION_SYNC_BACKOFF_FRAMES = 30; // OWNER-PICKED STARTING VALUE
/** A gap this long between two frame callbacks counts as a late frame. */
export const COLLECTION_SYNC_LATE_FRAME_MS = 25; // OWNER-PICKED STARTING VALUE (1.5 frames)
/** A slice longer than this multiple of its budget counts as preempted. */
const OVERRUN_FACTOR = 2; // OWNER-PICKED STARTING VALUE

/** Frames and a monotonic clock; injected so the policy is testable in node. */
export interface FrameScheduler<H> {
  afterNextFrame(fn: () => void): H;
  cancel(handle: H): void;
  now(): number;
}

/** One slice of the fold: levels folded by this call and levels still pending. */
export interface SyncSlice {
  folded: number;
  pending: number;
}

/**
 * Folds in slices, one per `afterNextFrame`, until `sync` reports nothing
 * pending or `budgetSteps` levels have been folded. Each slice may fold at
 * most `chunkSteps` levels and stops once `sliceMs` have passed on
 * `scheduler.now()` (after at least one level). After a late frame or an
 * overrun slice it waits COLLECTION_SYNC_BACKOFF_FRAMES frames. `sync` wraps
 * `SaveSystem.syncCollection(maxSteps, shouldStop)`. Returns a stop function
 * (idempotent) that cancels the pending slice.
 */
export function startCollectionSync<H>({
  sync,
  scheduler,
  budgetSteps,
  chunkSteps,
  sliceMs,
}: {
  sync: (maxSteps: number, shouldStop: () => boolean) => SyncSlice;
  scheduler: FrameScheduler<H>;
  budgetSteps: number;
  chunkSteps: number;
  sliceMs: number;
}): () => void {
  let spent = 0;
  let stopped = false;
  let handle: { current: H } | null = null;
  let lastFrameAt: number | null = null;
  let waitFrames = 0;

  const next = () => {
    handle = { current: scheduler.afterNextFrame(runSlice) };
  };

  const runSlice = () => {
    handle = null;
    if (stopped) return;
    const start = scheduler.now();
    const late = lastFrameAt !== null && start - lastFrameAt > COLLECTION_SYNC_LATE_FRAME_MS;
    lastFrameAt = start;
    if (waitFrames > 0) {
      waitFrames -= 1;
      next();
      return;
    }
    if (late) {
      waitFrames = COLLECTION_SYNC_BACKOFF_FRAMES;
      next();
      return;
    }
    const deadline = start + sliceMs;
    const steps = Math.min(chunkSteps, budgetSteps - spent);
    const { folded, pending } = sync(steps, () => scheduler.now() >= deadline);
    spent += folded;
    if (scheduler.now() - start > sliceMs * OVERRUN_FACTOR) waitFrames = COLLECTION_SYNC_BACKOFF_FRAMES;
    if (pending > 0 && folded > 0 && spent < budgetSteps) next();
  };

  handle = { current: scheduler.afterNextFrame(runSlice) };
  return () => {
    if (stopped) return;
    stopped = true;
    if (handle !== null) scheduler.cancel(handle.current);
    handle = null;
  };
}

/**
 * The slice runs inside the frame's requestAnimationFrame callback: it starts
 * at the frame boundary and, bounded by COLLECTION_SYNC_SLICE_MS, ends long
 * before the next one, so every frame's JS work still fits its frame.
 */
const frameScheduler: FrameScheduler<number> = {
  afterNextFrame: (fn) => requestAnimationFrame(() => fn()),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

/** The fold over the real SaveSystem; `onSlice` (optional) runs after every slice. */
function saveSystemSync(onSlice?: () => void) {
  return (maxSteps: number, shouldStop: () => boolean): SyncSlice => {
    const before = SaveSystem.shapesThroughLevel;
    const pending = SaveSystem.syncCollection(maxSteps, shouldStop);
    onSlice?.();
    return { folded: Math.max(0, SaveSystem.shapesThroughLevel - before), pending };
  };
}

function startSlicedFold(onSlice?: () => void): () => void {
  return startCollectionSync({
    sync: saveSystemSync(onSlice),
    scheduler: frameScheduler,
    budgetSteps: COLLECTION_SYNC_BUDGET_STEPS,
    chunkSteps: COLLECTION_SYNC_CHUNK_STEPS,
    sliceMs: COLLECTION_SYNC_SLICE_MS,
  });
}

/**
 * HomeScreen's mount effect: starts the sliced fold COLLECTION_SYNC_START_DELAY_MS
 * after the mount and returns a stop function for the unmount (it cancels the
 * delay or the pending slice). A no-op with the kill constant off.
 */
export function startMenuCollectionSync(): () => void {
  if (!COLLECTION_SYNC_ENABLED) return () => undefined;
  let stopFold: (() => void) | null = null;
  let stopped = false;
  const delay = setTimeout(() => {
    if (stopped) return;
    stopFold = startSlicedFold();
  }, COLLECTION_SYNC_START_DELAY_MS);
  return () => {
    stopped = true;
    clearTimeout(delay);
    stopFold?.();
    stopFold = null;
  };
}

/**
 * W4-09: GalleryScreen's mount effect. The same sliced fold (slice budget,
 * chunk cap, backoff, per-mount budget), but from the first frame after the
 * mount: the menu's fold only starts 2 s after the menu mounts, so a player
 * who opens the gallery quickly would otherwise see an incomplete wall.
 * `onSlice` runs after every slice (inside that frame's callback) so the wall
 * can show the bits as they arrive. Returns the stop function for the unmount.
 * A no-op with the kill constant off.
 */
export function startGalleryCollectionSync(onSlice: () => void): () => void {
  if (!COLLECTION_SYNC_ENABLED) return () => undefined;
  return startSlicedFold(onSlice);
}

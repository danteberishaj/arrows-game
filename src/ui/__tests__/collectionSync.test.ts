import {
  COLLECTION_SYNC_BACKOFF_FRAMES,
  COLLECTION_SYNC_BUDGET_STEPS,
  COLLECTION_SYNC_CHUNK_STEPS,
  COLLECTION_SYNC_LATE_FRAME_MS,
  COLLECTION_SYNC_SLICE_MS,
  startCollectionSync,
  type FrameScheduler,
  type SyncSlice,
} from '../collectionSync';

/**
 * W4-07: the menu fold runs in time-bounded slices, one per frame, and stops
 * on unmount. A manual scheduler with a fake clock stands in for
 * requestAnimationFrame + performance.now, so each frame and each millisecond
 * is explicit.
 */
class ManualFrames implements FrameScheduler<number> {
  private next = 1;
  readonly queue = new Map<number, () => void>();
  cancelled: number[] = [];
  clock = 0;

  afterNextFrame(fn: () => void): number {
    const handle = this.next;
    this.next += 1;
    this.queue.set(handle, fn);
    return handle;
  }

  cancel(handle: number): void {
    this.cancelled.push(handle);
    this.queue.delete(handle);
  }

  now(): number {
    return this.clock;
  }

  /** Runs every callback queued before this frame (new ones wait for the next). */
  frame(intervalMs = 17): number {
    this.clock += intervalMs; // integer ms keep the budget arithmetic exact
    const due = [...this.queue];
    this.queue.clear();
    for (const [, fn] of due) fn();
    return due.length;
  }
}

/**
 * A fake SaveSystem.syncCollection over `pending` levels: each level costs
 * `msPerLevel` on the fake clock, the first level of a slice is unconditional,
 * and `shouldStop` is checked before every later level (collection.ts semantics).
 */
function fakeSync(frames: ManualFrames, pending: number, msPerLevel: number) {
  const slices: Array<{ maxSteps: number; folded: number; ms: number; at: number }> = [];
  let left = pending;
  /** Extra ms the next level costs (a preemption landing inside a slice). */
  let stall = 0;
  const sync = (maxSteps: number, shouldStop: () => boolean): SyncSlice => {
    const start = frames.clock;
    let folded = 0;
    while (folded < maxSteps && left > 0) {
      if (folded > 0 && shouldStop()) break;
      frames.clock += msPerLevel + stall;
      stall = 0;
      left -= 1;
      folded += 1;
    }
    slices.push({ maxSteps, folded, ms: frames.clock - start, at: start });
    return { folded, pending: left };
  };
  return { slices, sync, left: () => left, stallNextLevel: (ms: number) => { stall = ms; } };
}

const run = (frames: ManualFrames) => {
  let count = 0;
  while (frames.frame() > 0) count += 1;
  return count;
};

test('constants: 5000 levels per menu mount, a per-slice level cap, a ~3 ms slice budget, a backoff', () => {
  expect(COLLECTION_SYNC_BUDGET_STEPS).toBe(5000);
  expect(COLLECTION_SYNC_BACKOFF_FRAMES).toBeGreaterThan(0);
  expect(COLLECTION_SYNC_LATE_FRAME_MS).toBeGreaterThan(16.7);
  expect(COLLECTION_SYNC_CHUNK_STEPS).toBeGreaterThan(0);
  expect(COLLECTION_SYNC_CHUNK_STEPS).toBeLessThanOrEqual(COLLECTION_SYNC_BUDGET_STEPS);
  expect(COLLECTION_SYNC_SLICE_MS).toBe(3);
});

test('nothing runs during the mount itself: the first slice waits for the next frame', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 1000, 0.026);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });

  expect(fake.slices).toEqual([]);
  expect(frames.queue.size).toBe(1);
});

test('each slice stops once the time budget is used (1 ms per level, 3 ms budget: 3 levels a frame)', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 30, 1);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  const count = run(frames);

  expect(fake.slices.map((s) => s.folded)).toEqual(Array(10).fill(3));
  expect(Math.max(...fake.slices.map((s) => s.ms))).toBe(3);
  expect(count).toBe(10);
  expect(fake.left()).toBe(0);
});

test('a slow device still makes progress: one level per slice when a level costs more than the budget', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 4, 5);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  run(frames);

  // Each 5 ms slice is not a contention signal (below 2x the budget): one level every frame.
  expect(fake.slices.map((s) => s.folded)).toEqual([1, 1, 1, 1]);
  expect(fake.slices.map((s) => s.at)).toEqual([17, 39, 61, 83]);
});

test('a slice stretched by a stall (> 2x its budget) backs off before the next slice', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 30, 1);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  frames.frame();
  fake.stallNextLevel(10); // the next slice's first level is preempted for 10 ms
  frames.frame();
  const stalled = fake.slices[1];
  expect(stalled.folded).toBe(1);
  expect(stalled.ms).toBe(11);

  let framesUntilNextSlice = 0;
  while (fake.slices.length === 2) {
    frames.frame();
    framesUntilNextSlice += 1;
  }
  expect(framesUntilNextSlice).toBe(COLLECTION_SYNC_BACKOFF_FRAMES + 1);
  run(frames);
  expect(fake.left()).toBe(0);
});

test('a late frame (the JS or UI pipeline is busy) skips the slice and backs off', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 30, 1);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  frames.frame();
  frames.frame();
  expect(fake.slices).toHaveLength(2);
  frames.frame(COLLECTION_SYNC_LATE_FRAME_MS + 17); // a long frame gap: someone else is busy
  expect(fake.slices).toHaveLength(2); // no slice on the late frame

  let framesUntilNextSlice = 0;
  while (fake.slices.length === 2) {
    frames.frame();
    framesUntilNextSlice += 1;
  }
  expect(framesUntilNextSlice).toBe(COLLECTION_SYNC_BACKOFF_FRAMES + 1);
  run(frames);
  expect(fake.left()).toBe(0);
});

test('a clock that does not move still ends each slice at the level cap', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 500, 0);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  run(frames);

  expect(fake.slices.map((s) => s.maxSteps)).toEqual([200, 200, 200]);
  expect(fake.slices.map((s) => s.folded)).toEqual([200, 200, 100]);
});

test('caught up already (the common menu mount): one O(1) call, no further frames', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 0, 1);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  frames.frame();

  expect(fake.slices.map(({ maxSteps, folded, ms }) => ({ maxSteps, folded, ms }))).toEqual([
    { maxSteps: 200, folded: 0, ms: 0 },
  ]);
  expect(frames.queue.size).toBe(0);
});

test('the per-mount budget counts levels actually folded; the rest waits for the next mount', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 12000, 0.026);

  startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  run(frames);

  expect(fake.slices.reduce((a, s) => a + s.folded, 0)).toBe(5000);
  expect(fake.left()).toBe(7000);
  // 0.026 ms a level: the time budget, not the cap, ends every full slice.
  expect(Math.max(...fake.slices.map((s) => s.folded))).toBeLessThan(200);
  expect(Math.max(...fake.slices.map((s) => s.ms))).toBeLessThanOrEqual(3 + 0.026 + 1e-9);
});

test('stop (unmount) cancels the pending frame and no slice runs afterwards', () => {
  const frames = new ManualFrames();
  const fake = fakeSync(frames, 5000, 0.026);

  const stop = startCollectionSync({ sync: fake.sync, scheduler: frames, budgetSteps: 5000, chunkSteps: 200, sliceMs: 3 });
  frames.frame();
  frames.frame();
  stop();
  const afterStop = fake.slices.length;
  run(frames);

  expect(afterStop).toBe(2);
  expect(fake.slices).toHaveLength(2);
  expect(frames.cancelled).toHaveLength(1);
  stop(); // idempotent
  expect(frames.cancelled).toHaveLength(1);
});

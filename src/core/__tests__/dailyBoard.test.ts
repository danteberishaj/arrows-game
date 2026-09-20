import { BoardLogic } from '../boardLogic';
import { DAILY_POOL_V1, DAILY_VERSIONS, dailySeed, generateDaily } from '../dailyBoard';
import { Difficulty } from '../difficulty';
import { GeneratedLevel, seed } from '../levelGenerator';
import { SaveSystem, IntStore } from '../saveSystem';

// The daily board is a second, namespaced draw from the same generator. These
// tests exist to keep it (a) off every campaign seed, (b) byte-stable per day
// forever, and (c) unable to touch a player's campaign progress.

function checksumLines(lines: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Everything a player can see about a daily board, as text. */
function serialize(level: GeneratedLevel): string[] {
  const lines = [
    level.shapeName,
    String(level.board.rows),
    String(level.board.cols),
    String(level.arrowCount),
    String(level.hearts),
    String(level.difficulty),
  ];
  for (const arrow of level.board.arrows()) lines.push(arrow.toLine());
  return lines;
}

test('the daily pool is the catalogue minus the two no-picture fills', () => {
  expect(DAILY_POOL_V1).not.toContain('Square');
  expect(DAILY_POOL_V1).not.toContain('Rectangle');
  expect(DAILY_POOL_V1.length).toBe(24);
  expect(Object.isFrozen(DAILY_POOL_V1)).toBe(true);
  expect(Object.isFrozen(DAILY_VERSIONS)).toBe(true);
  expect(DAILY_VERSIONS.length).toBe(1);
  expect(DAILY_VERSIONS[0].fromDay).toBe(0);
  expect(DAILY_VERSIONS[0].pool).toBe(DAILY_POOL_V1);
});

test('namespace: no daily seed collides with any campaign level seed', () => {
  // A naive daily seeded with the day number hands the player a board they
  // already own in the campaign: seed(2450) IS the seed level 2451 uses.
  const campaign = new Set<number>();
  for (let i = 0; i < 200000; i++) campaign.add(seed(i));
  const collisions: number[] = [];
  for (let d = 0; d < 20000; d++) {
    if (campaign.has(dailySeed(d))) collisions.push(d);
  }
  expect(collisions).toEqual([]);
});

test('daily seeds are distinct per day', () => {
  const seen = new Set<number>();
  for (let d = 0; d < 20000; d++) seen.add(dailySeed(d));
  expect(seen.size).toBe(20000);
});

test.each([0, 2450, 9999])('generateDaily(%i) is byte-identical when called twice', (day) => {
  const a = serialize(generateDaily(day));
  const b = serialize(generateDaily(day));
  expect(b).toEqual(a);
});

// Pinned EXECUTED on commit d4949e0 from the implementation in this change,
// via the same serialization the test above compares. A player who opens day
// 2450 next year must get this exact board: never re-pin these to make a
// change pass — a break means the daily pipeline drifted.
test.each([
  [0, 'Circle', '4e61968e'],
  [2450, 'Plus', '63f8d4a5'],
  [9999, 'Diamond', 'd313105a'],
] as const)('daily %i keeps its golden board (%s)', (day, shapeName, expected) => {
  const level = generateDaily(day);
  expect(level.shapeName).toBe(shapeName);
  expect(checksumLines(serialize(level))).toBe(expected);
});

test('daily boards draw Normal config from the daily pool', () => {
  for (const day of [0, 1, 2450, 9999]) {
    const level = generateDaily(day);
    expect(level.difficulty).toBe(Difficulty.Normal);
    expect(DAILY_POOL_V1).toContain(level.shapeName);
  }
});

test('365 consecutive dailies fill their mask exactly and solve in arrowCount taps', () => {
  // The same findHint loop scripts/perf/android/soak-plan.ts:58-68 runs.
  for (let day = 0; day < 365; day++) {
    const level = generateDaily(day);
    const board: BoardLogic = level.board;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (!board.isEmpty(r, c) !== level.mask[r][c]) {
          throw new Error(`day ${day} (${level.shapeName}): fill != mask at ${r},${c}`);
        }
      }
    }

    let removals = 0;
    while (!board.isCleared()) {
      const arrow = board.findHint();
      if (arrow === null) {
        throw new Error(`day ${day} (${level.shapeName}): no valid move with ${board.count()} left`);
      }
      const owner = board.ownerAt(arrow.head.r, arrow.head.c);
      if (owner !== arrow || !board.tryRemove(arrow)) {
        throw new Error(`day ${day}: invalid solve head at ${arrow.head.r},${arrow.head.c}`);
      }
      removals++;
    }
    if (removals !== level.arrowCount) {
      throw new Error(`day ${day}: solved in ${removals} removals, expected ${level.arrowCount}`);
    }
  }
});

test('generating a daily writes nothing and leaves campaign progress untouched', () => {
  const writes: string[] = [];
  const map = new Map<string, number>();
  const recorder: IntStore = {
    getInt: (key, defaultValue) => map.get(key) ?? defaultValue,
    setInt: (key, value) => {
      writes.push(`set ${key}`);
      map.set(key, value);
    },
    deleteKey: (key) => {
      writes.push(`delete ${key}`);
      map.delete(key);
    },
  };
  const previous = SaveSystem.useStore(recorder);
  try {
    SaveSystem.setCurrentLevel(7);
    SaveSystem.registerSolve(true);
    SaveSystem.registerSolve(true);
    writes.length = 0;

    generateDaily(2450);
    generateDaily(2451);

    expect(writes).toEqual([]);
    expect(SaveSystem.currentLevel).toBe(7);
    expect(SaveSystem.totalSolved).toBe(2);
  } finally {
    SaveSystem.useStore(previous);
  }
});

// ---- Distribution ---------------------------------------------------------
//
// Every bound below was MEASURED first by `npx tsx scripts/analysis/daily-band.ts`
// over days 0..3649 (3650 boards, one per day — the sample reconciles against
// the window exactly), recorded in
// docs/next-level/measurements/daily-band-2026-09.md against commit d4949e0,
// and only then written here. The measured values are median 82, p90 99,
// 6 consecutive-day shape repeats, every pool shape appearing 148-158 times.
// The +/- headroom on each is an OWNER-PICKED STARTING VALUE: it is drift
// tolerance, not a measurement. Re-run the script before widening any of them.
const DAILY_BAND_DAYS = 3650;
const MEASURED_MEDIAN_ARROWS = 82;
const MEASURED_P90_ARROWS = 99;
const MEASURED_CONSECUTIVE_REPEATS = 6;
const MEDIAN_HEADROOM = 6; // OWNER-PICKED STARTING VALUE
const P90_HEADROOM = 8; // OWNER-PICKED STARTING VALUE
const REPEAT_HEADROOM = 4; // OWNER-PICKED STARTING VALUE

/** Nearest-rank percentile (p in 0..100) of an ascending array. */
function nearestRank(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

test(
  'the daily band over 10 years sits in its measured distribution',
  () => {
    const arrows: number[] = [];
    const counts = new Map<string, number>(DAILY_POOL_V1.map((id) => [id, 0]));
    let repeats = 0;
    let previousShape = '';

    for (let day = 0; day < DAILY_BAND_DAYS; day++) {
      const level = generateDaily(day);
      arrows.push(level.arrowCount);
      counts.set(level.shapeName, (counts.get(level.shapeName) ?? 0) + 1);
      if (level.shapeName === previousShape) repeats++;
      previousShape = level.shapeName;
    }
    // Reconcile the sample against the window before quoting a percentile.
    expect(arrows.length).toBe(DAILY_BAND_DAYS);
    arrows.sort((a, b) => a - b);

    const unseen = [...counts].filter(([, n]) => n === 0).map(([id]) => id);
    expect(unseen).toEqual([]);

    const median = nearestRank(arrows, 50);
    expect(median).toBeGreaterThanOrEqual(MEASURED_MEDIAN_ARROWS - MEDIAN_HEADROOM);
    expect(median).toBeLessThanOrEqual(MEASURED_MEDIAN_ARROWS + MEDIAN_HEADROOM);

    const p90 = nearestRank(arrows, 90);
    expect(p90).toBeGreaterThanOrEqual(MEASURED_P90_ARROWS - P90_HEADROOM);
    expect(p90).toBeLessThanOrEqual(MEASURED_P90_ARROWS + P90_HEADROOM);

    expect(repeats).toBeLessThanOrEqual(MEASURED_CONSECUTIVE_REPEATS + REPEAT_HEADROOM);
  },
  120000,
);

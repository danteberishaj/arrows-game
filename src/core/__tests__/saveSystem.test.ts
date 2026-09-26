import { EMPTY_SHAPE_MASKS, countSeen, hasSeen, markSeen, type ShapeMasks } from '../collection';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { SaveSystem, type IntStore } from '../saveSystem';
import { catalogueIndexOf } from '../shapeCatalogue';

/**
 * Pure-core tests for SaveSystem over an in-memory IntStore (no AsyncStorage).
 * The AsyncStorage boundary (hydrate, write-through, cold start) is covered in
 * src/ui/__tests__/storage.test.ts.
 */

/** Map-backed IntStore that also records every deleteKey call. */
class RecordingStore implements IntStore {
  readonly map = new Map<string, number>();
  readonly deleted: string[] = [];
  getInt(key: string, defaultValue: number): number {
    const v = this.map.get(key);
    return v === undefined ? defaultValue : v;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.deleted.push(key);
    this.map.delete(key);
  }
}

// Mirrors saveSystem.ts dayNumber(): local calendar days since 2020-01-01.
function dayNumberOf(t: Date): number {
  return Math.floor(
    (Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(2020, 0, 1)) / 86400000,
  );
}

const LEGACY_PROGRESS_KEYS = [
  'arrows_current_level',
  'arrows_total_solved',
  'arrows_perfect_streak',
  'arrows_best_perfect_streak',
  'arrows_day_streak',
  'arrows_last_play_day',
];

let store: RecordingStore;

beforeEach(() => {
  store = new RecordingStore();
  SaveSystem.useStore(store);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('characterisation of the shipped behaviour', () => {
  test('a fresh store reads every default', () => {
    expect(SaveSystem.currentLevel).toBe(0);
    expect(SaveSystem.totalSolved).toBe(0);
    expect(SaveSystem.perfectStreak).toBe(0);
    expect(SaveSystem.bestPerfectStreak).toBe(0);
    expect(SaveSystem.dayStreak).toBe(0);
    expect(SaveSystem.soundOn).toBe(true);
    expect(SaveSystem.darkMode).toBe(false);
  });

  test('setCurrentLevel clamps negatives to 0', () => {
    SaveSystem.setCurrentLevel(-4);
    expect(SaveSystem.currentLevel).toBe(0);
    SaveSystem.setCurrentLevel(12);
    expect(SaveSystem.currentLevel).toBe(12);
  });

  test('registerSolve counts solves and tracks the perfect streak and its best', () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 16, 12, 0, 0) });
    SaveSystem.registerSolve(true);
    SaveSystem.registerSolve(true);
    SaveSystem.registerSolve(true);
    expect(SaveSystem.totalSolved).toBe(3);
    expect(SaveSystem.perfectStreak).toBe(3);
    expect(SaveSystem.bestPerfectStreak).toBe(3);

    SaveSystem.registerSolve(false);
    expect(SaveSystem.totalSolved).toBe(4);
    expect(SaveSystem.perfectStreak).toBe(0);
    expect(SaveSystem.bestPerfectStreak).toBe(3);

    SaveSystem.registerSolve(true);
    expect(SaveSystem.perfectStreak).toBe(1);
    expect(SaveSystem.bestPerfectStreak).toBe(3);
  });

  test('registerSolve keeps the day chain on the same day, extends it on the next, restarts after a gap', () => {
    const day1 = new Date(2026, 8, 16, 23, 59, 0);
    jest.useFakeTimers({ now: day1 });
    SaveSystem.registerSolve(true);
    SaveSystem.registerSolve(false);
    expect(SaveSystem.dayStreak).toBe(1);
    expect(store.getInt('arrows_last_play_day', 0)).toBe(dayNumberOf(day1));

    jest.setSystemTime(new Date(2026, 8, 17, 0, 1, 0));
    expect(SaveSystem.dayStreak).toBe(1); // yesterday still counts
    SaveSystem.registerSolve(true);
    expect(SaveSystem.dayStreak).toBe(2);

    jest.setSystemTime(new Date(2026, 8, 19, 9, 0, 0));
    expect(SaveSystem.dayStreak).toBe(0); // chain broken reads 0
    SaveSystem.registerSolve(true);
    expect(SaveSystem.dayStreak).toBe(1);
  });

  test('resetProgress deletes exactly the six progress keys and keeps preferences', () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 16, 12, 0, 0) });
    SaveSystem.setCurrentLevel(5);
    SaveSystem.registerSolve(true);
    SaveSystem.soundOn = false;
    SaveSystem.darkMode = true;

    SaveSystem.resetProgress();

    expect([...store.deleted].sort()).toEqual([...LEGACY_PROGRESS_KEYS].sort());
    expect(store.deleted).toHaveLength(6);
    expect(SaveSystem.currentLevel).toBe(0);
    expect(SaveSystem.totalSolved).toBe(0);
    expect(SaveSystem.dayStreak).toBe(0);
    expect(SaveSystem.soundOn).toBe(false);
    expect(SaveSystem.darkMode).toBe(true);
  });
});

describe('P-01 key registry', () => {
  test('no orphans: every Keys value is registered, every registered key is in Keys, no duplicates', () => {
    const recordValues = Object.values(SaveSystem.registeredKeys);
    const registered = SaveSystem.persistenceKeys;

    expect(Object.isFrozen(SaveSystem.registeredKeys)).toBe(true);
    for (const key of recordValues) expect(registered).toContain(key);
    for (const key of registered) expect(recordValues).toContain(key);
    expect(new Set(recordValues).size).toBe(recordValues.length);
    expect(new Set(registered).size).toBe(registered.length);
    expect(registered).toHaveLength(recordValues.length);
    for (const key of registered) expect(key).toMatch(/^arrows_[a-z0-9_]+$/);
  });
});

describe('P-01 schema version and migrate()', () => {
  function spyWrites(): { set: jest.SpyInstance; del: jest.SpyInstance } {
    return { set: jest.spyOn(store, 'setInt'), del: jest.spyOn(store, 'deleteKey') };
  }

  test('SCHEMA_VERSION is 1', () => {
    expect(SaveSystem.SCHEMA_VERSION).toBe(1);
  });

  test('an unversioned save (version absent = 0) is stamped with version 1 and nothing else', () => {
    store.setInt('arrows_current_level', 37);
    const { set, del } = spyWrites();

    SaveSystem.migrate();

    expect(set.mock.calls).toEqual([['arrows_schema_version', 1]]);
    expect(del).not.toHaveBeenCalled();
    expect(SaveSystem.schemaVersion).toBe(1);
    expect(SaveSystem.currentLevel).toBe(37);
  });

  test('a save already at SCHEMA_VERSION is not written', () => {
    store.setInt('arrows_schema_version', 1);
    const { set, del } = spyWrites();

    SaveSystem.migrate();
    SaveSystem.migrate();

    expect(set).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  test('a save from a newer build (version > SCHEMA_VERSION) is inert: no write, no delete', () => {
    store.setInt('arrows_schema_version', 99);
    store.setInt('arrows_current_level', 37);
    const { set, del } = spyWrites();

    SaveSystem.migrate();

    expect(set).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(SaveSystem.schemaVersion).toBe(99);
    expect(SaveSystem.currentLevel).toBe(37);
  });

  test('a corrupt negative version is left untouched rather than rewritten', () => {
    store.setInt('arrows_schema_version', -3);
    const { set, del } = spyWrites();

    SaveSystem.migrate();

    expect(set).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  test('persistenceHealthy is false before initSaveSystem has run', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../saveSystem') as typeof import('../saveSystem');
      expect(fresh.SaveSystem.persistenceHealthy).toBe(false);
    });
  });
});

describe('P-01 reset lock', () => {
  test('resetProgress removes exactly the six legacy progress keys and none of rows 9-29', () => {
    const newKeys = SaveSystem.persistenceKeys.slice(8);
    expect(newKeys).toHaveLength(21);
    SaveSystem.persistenceKeys.forEach((key, i) => store.setInt(key, 100 + i));

    SaveSystem.resetProgress();

    expect([...store.deleted].sort()).toEqual([...LEGACY_PROGRESS_KEYS].sort());
    SaveSystem.persistenceKeys.forEach((key, i) => {
      if (LEGACY_PROGRESS_KEYS.includes(key)) expect(store.map.has(key)).toBe(false);
      else expect(store.getInt(key, -999)).toBe(100 + i);
    });
  });
});

describe('W1-03 FTUE stage', () => {
  test('ftueStage defaults to 0 on an empty store', () => {
    expect(SaveSystem.ftueStage).toBe(0);
  });

  test('setFtueStage(2) round-trips through an in-memory store', () => {
    SaveSystem.setFtueStage(2);

    expect(store.map.get('arrows_ftue_stage')).toBe(2);
    expect(SaveSystem.ftueStage).toBe(2);
  });
});

describe('W0-05 interstitial pacing counter', () => {
  /** An IntStore over a map it does not own, so a second instance sees the same "disk". */
  class SharedMapStore implements IntStore {
    constructor(private readonly disk: Map<string, number>) {}
    getInt(key: string, defaultValue: number): number {
      const v = this.disk.get(key);
      return v === undefined ? defaultValue : v;
    }
    setInt(key: string, value: number): void {
      this.disk.set(key, value);
    }
    deleteKey(key: string): void {
      this.disk.delete(key);
    }
  }

  test('an absent counter reads 0', () => {
    expect(SaveSystem.finishedGames).toBe(0);
  });

  test('setFinishedGames writes arrows_finished_games and the getter reads it back', () => {
    SaveSystem.setFinishedGames(1);
    expect(store.map.get('arrows_finished_games')).toBe(1);
    expect(SaveSystem.finishedGames).toBe(1);
    SaveSystem.setFinishedGames(0);
    expect(SaveSystem.finishedGames).toBe(0);
  });

  test('a counter written through one store is read back by a fresh store instance over the same backing map (process death)', () => {
    const disk = new Map<string, number>();
    SaveSystem.useStore(new SharedMapStore(disk));
    SaveSystem.setFinishedGames(SaveSystem.finishedGames + 1);

    SaveSystem.useStore(new SharedMapStore(disk)); // new process, same disk
    expect(SaveSystem.finishedGames).toBe(1);

    SaveSystem.setFinishedGames(SaveSystem.finishedGames + 1);
    SaveSystem.useStore(new SharedMapStore(disk));
    expect(SaveSystem.finishedGames).toBe(2);
  });

  test('a corrupt stored counter reads as a non-negative integer', () => {
    store.setInt('arrows_finished_games', -4);
    expect(SaveSystem.finishedGames).toBe(0);
    store.setInt('arrows_finished_games', 2.5);
    expect(SaveSystem.finishedGames).toBe(2);
    store.setInt('arrows_finished_games', NaN);
    expect(SaveSystem.finishedGames).toBe(0);
  });

  test('setFinishedGames never stores a negative or non-integer value', () => {
    SaveSystem.setFinishedGames(-1);
    expect(store.map.get('arrows_finished_games')).toBe(0);
    SaveSystem.setFinishedGames(3.7);
    expect(store.map.get('arrows_finished_games')).toBe(3);
  });

  test('resetProgress does not touch the counter (a progress reset must not skip ads)', () => {
    SaveSystem.setFinishedGames(1);
    SaveSystem.resetProgress();
    expect(SaveSystem.finishedGames).toBe(1);
    expect(store.deleted).not.toContain('arrows_finished_games');
  });
});

describe('W7-01 consent bits', () => {
  test('resetProgress leaves consentBits unchanged', () => {
    SaveSystem.setConsentBits(15);

    SaveSystem.resetProgress();

    expect(SaveSystem.consentBits).toBe(15);
    expect(store.getInt('arrows_consent', 0)).toBe(15);
    expect(store.deleted).not.toContain('arrows_consent');
  });
});

describe('W4-02 SaveSystem day-chain wiring', () => {
  const rows = [
    { name: 'gap 0', gap: 0, freezes: 1, expectedStreak: 14, expectedFreezes: 1, saved: false },
    { name: 'gap 1', gap: 1, freezes: 1, expectedStreak: 15, expectedFreezes: 1, saved: false },
    { name: 'gap 2 covered', gap: 2, freezes: 1, expectedStreak: 15, expectedFreezes: 0, saved: true },
    { name: 'gap 2 uncovered', gap: 2, freezes: 0, expectedStreak: 1, expectedFreezes: 0, saved: false },
    { name: 'gap 3 covered', gap: 3, freezes: 2, expectedStreak: 15, expectedFreezes: 0, saved: true },
    { name: 'gap 3 uncovered', gap: 3, freezes: 1, expectedStreak: 1, expectedFreezes: 1, saved: false },
    { name: 'negative gap', gap: -1, freezes: 1, expectedStreak: 14, expectedFreezes: 1, saved: false },
  ] as const;

  test.each(rows)('$name stores the pure-rule result with an injected clock', (row) => {
    const previousFlag = process.env.EXPO_PUBLIC_META_STREAK_FREEZE;
    process.env.EXPO_PUBLIC_META_STREAK_FREEZE = '1';
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { SaveSystem: FlaggedSaveSystem } = require('../saveSystem') as typeof import('../saveSystem');
        const flaggedStore = new RecordingStore();
        FlaggedSaveSystem.useStore(flaggedStore);
        FlaggedSaveSystem.useClock(() => new Date(2026, 8, 20, 12, 0, 0));
        const today = FlaggedSaveSystem.today();
        flaggedStore.setInt('arrows_day_streak', 14);
        flaggedStore.setInt('arrows_last_play_day', today - row.gap);
        flaggedStore.setInt('arrows_streak_freezes', row.freezes);

        const canReadBefore = row.gap <= 1 || row.freezes >= row.gap - 1;
        expect(FlaggedSaveSystem.dayStreak).toBe(canReadBefore ? 14 : 0);

        FlaggedSaveSystem.registerSolve(true);

        expect(flaggedStore.getInt('arrows_day_streak', -1)).toBe(row.expectedStreak);
        expect(flaggedStore.getInt('arrows_last_play_day', -1)).toBe(today);
        expect(flaggedStore.getInt('arrows_streak_freezes', -1)).toBe(row.expectedFreezes);
        expect(flaggedStore.getInt('arrows_streak_saved_day', 0)).toBe(row.saved ? today : 0);
      });
    } finally {
      if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_META_STREAK_FREEZE;
      else process.env.EXPO_PUBLIC_META_STREAK_FREEZE = previousFlag;
    }
  });
});

describe('W4-06 daily clear', () => {
  // Injected clock: 2026-09-25 12:00 local, the day this task was written.
  const NOON = new Date(2026, 8, 25, 12, 0, 0);
  let previousClock: () => Date;

  beforeEach(() => {
    previousClock = SaveSystem.useClock(() => NOON);
  });

  afterEach(() => {
    SaveSystem.useClock(previousClock);
  });

  test('dailyLastDay reads 0 when absent, the stored day after a clear, and 0 when corrupt', () => {
    expect(SaveSystem.dailyLastDay).toBe(0);
    SaveSystem.registerDailyClear(SaveSystem.today(), 'Plus');
    expect(SaveSystem.dailyLastDay).toBe(dayNumberOf(NOON));
    for (const corrupt of [-3, Number.NaN]) {
      store.setInt('arrows_daily_last_day', corrupt);
      expect(SaveSystem.dailyLastDay).toBe(0);
    }
  });

  test('registerDailyClear(day, shape) writes only arrows_daily_last_day and (W4-07) the shape\'s collection bit, and never reads the clock', () => {
    const previousHealthy = SaveSystem.persistenceHealthy;
    SaveSystem.setPersistenceHealthy(true);
    const previousClock = SaveSystem.useClock(() => {
      throw new Error('registerDailyClear read the clock');
    });
    try {
      const set = jest.spyOn(store, 'setInt');
      const del = jest.spyOn(store, 'deleteKey');
      const today = dayNumberOf(NOON);

      // The board's own day: entered just before midnight, cleared after it.
      SaveSystem.registerDailyClear(today - 1, 'Plus');

      // 'Plus' is catalogue index 5 (the W4-01 order lock): bit 5 of the low mask.
      expect(set.mock.calls).toEqual([
        ['arrows_daily_last_day', today - 1],
        ['arrows_shapes_seen_lo', 1 << 5],
      ]);
      expect(del).not.toHaveBeenCalled();
      expect([...store.map.keys()]).toEqual(['arrows_daily_last_day', 'arrows_shapes_seen_lo']);
    } finally {
      SaveSystem.useClock(previousClock);
      SaveSystem.setPersistenceHealthy(previousHealthy);
    }
  });

  test('a daily clear leaves currentLevel unchanged, adds one solve and advances the day streak as a campaign solve does', () => {
    const today = SaveSystem.today();
    const seedStore = (s: RecordingStore) => {
      s.setInt('arrows_current_level', 7);
      s.setInt('arrows_total_solved', 20);
      s.setInt('arrows_perfect_streak', 2);
      s.setInt('arrows_best_perfect_streak', 5);
      s.setInt('arrows_day_streak', 4);
      s.setInt('arrows_last_play_day', today - 1);
    };

    // Campaign solve (GameScreen's campaign branch, minus the ad counter).
    const campaign = new RecordingStore();
    seedStore(campaign);
    SaveSystem.useStore(campaign);
    SaveSystem.registerSolve(true);
    SaveSystem.setCurrentLevel(SaveSystem.currentLevel + 1);

    // Daily clear (GameScreen's daily branch).
    const daily = new RecordingStore();
    seedStore(daily);
    SaveSystem.useStore(daily);
    SaveSystem.registerSolve(true);
    SaveSystem.registerDailyClear(today, 'Plus');

    expect(daily.getInt('arrows_current_level', -1)).toBe(7);
    expect(campaign.getInt('arrows_current_level', -1)).toBe(8);
    expect(daily.getInt('arrows_total_solved', -1)).toBe(21);
    expect(daily.getInt('arrows_day_streak', -1)).toBe(5);
    expect(daily.getInt('arrows_last_play_day', -1)).toBe(today);
    expect(daily.getInt('arrows_daily_last_day', -1)).toBe(today);

    // Every key other than the campaign pointer and the daily key is identical.
    const others = (s: RecordingStore) =>
      [...s.map.entries()]
        .filter(([key]) => key !== 'arrows_current_level' && key !== 'arrows_daily_last_day')
        .sort(([a], [b]) => a.localeCompare(b));
    expect(others(daily)).toEqual(others(campaign));
    expect(campaign.map.has('arrows_daily_last_day')).toBe(false);
  });

  test('resetProgress leaves the daily key (the entry is hidden again by totalSolved = 0)', () => {
    SaveSystem.registerSolve(true);
    SaveSystem.registerDailyClear(SaveSystem.today(), 'Plus');

    SaveSystem.resetProgress();

    expect(store.deleted).not.toContain('arrows_daily_last_day');
    expect(SaveSystem.dailyLastDay).toBe(SaveSystem.today());
    expect(SaveSystem.totalSolved).toBe(0);
  });
});

describe('W4-07 shape collection', () => {
  const COLLECTION_KEYS = [
    'arrows_shapes_seen_lo',
    'arrows_shapes_seen_hi',
    'arrows_shapes_through_level',
  ];
  let previousHealthy: boolean;

  beforeEach(() => {
    previousHealthy = SaveSystem.persistenceHealthy;
    SaveSystem.setPersistenceHealthy(true); // initSaveSystem() read the save
  });

  afterEach(() => {
    SaveSystem.setPersistenceHealthy(previousHealthy);
  });

  /** Ground truth from the FULL generator: the masks levels [from, to) must produce. */
  function truthMasks(from: number, to: number, start: ShapeMasks = EMPTY_SHAPE_MASKS): ShapeMasks {
    let masks = start;
    for (let i = from; i < to; i += 1) {
      masks = markSeen(masks, catalogueIndexOf(LevelGenerator.generate(i).shapeName));
    }
    return masks;
  }

  function storedMasks(): ShapeMasks {
    return {
      lo: store.getInt('arrows_shapes_seen_lo', 0),
      hi: store.getInt('arrows_shapes_seen_hi', 0),
    };
  }

  test('a save at level 37 with no collection keys folds exactly the shapes of levels 0..36, writing only the three collection keys', () => {
    store.setInt('arrows_current_level', 37);
    const set = jest.spyOn(store, 'setInt');
    const del = jest.spyOn(store, 'deleteKey');

    expect(SaveSystem.syncCollection(5000)).toBe(0);

    expect(storedMasks()).toEqual(truthMasks(0, 37));
    expect(store.getInt('arrows_shapes_through_level', -1)).toBe(37);
    expect(SaveSystem.shapesSeen).toEqual(truthMasks(0, 37));
    expect(SaveSystem.shapesThroughLevel).toBe(37);
    for (const [key] of set.mock.calls) expect(COLLECTION_KEYS).toContain(key);
    expect(del).not.toHaveBeenCalled();
    expect(SaveSystem.currentLevel).toBe(37);
  });

  test('caps each call and resumes: 12000 levels behind at 5000 per call is three calls, then no work and no write', () => {
    store.setInt('arrows_current_level', 12000);

    expect(SaveSystem.syncCollection(5000)).toBe(7000);
    expect(SaveSystem.shapesThroughLevel).toBe(5000);
    expect(SaveSystem.syncCollection(5000)).toBe(2000);
    expect(SaveSystem.shapesThroughLevel).toBe(10000);
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    expect(SaveSystem.shapesThroughLevel).toBe(12000);

    const set = jest.spyOn(store, 'setInt');
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    expect(set).not.toHaveBeenCalled();

    // Same bits as one uncapped pass over the cheap lookup (the full-generator
    // equivalence for 0..299 is collection.test.ts; 0..599 is shapeCatalogue.test.ts).
    let oneShot = EMPTY_SHAPE_MASKS;
    for (let i = 0; i < 12000; i += 1) oneShot = markSeen(oneShot, catalogueIndexOf(shapeNameForLevel(i)));
    expect(SaveSystem.shapesSeen).toEqual(oneShot);
  });

  test('syncCollection(maxSteps, shouldStop): any slicing of 0..299 ends at exactly the full-generator masks and through = 300', () => {
    const truth = truthMasks(0, 300);
    const stops: Array<[string, () => () => boolean]> = [
      ['no predicate', () => () => false],
      ['stop at every check', () => () => true],
      ['stop at every 4th check', () => { let n = 0; return () => (n += 1) % 4 === 0; }],
    ];
    for (const cap of [1, 13, 200]) {
      for (const [name, makeStop] of stops) {
        store = new RecordingStore();
        SaveSystem.useStore(store);
        store.setInt('arrows_current_level', 300);
        const stop = makeStop();
        let pending = 300;
        let calls = 0;
        while (pending > 0) {
          const before = SaveSystem.shapesThroughLevel;
          pending = SaveSystem.syncCollection(cap, stop);
          const folded = SaveSystem.shapesThroughLevel - before;
          expect(folded).toBeGreaterThanOrEqual(1);
          expect(folded).toBeLessThanOrEqual(cap);
          expect(pending).toBe(300 - SaveSystem.shapesThroughLevel);
          calls += 1;
        }
        expect([cap, name, SaveSystem.shapesSeen, SaveSystem.shapesThroughLevel]).toEqual([cap, name, truth, 300]);
        expect(calls).toBeLessThanOrEqual(300);
      }
    }
  });

  test('a campaign clear on the fast path (through === levelIndex) records that level and says whether it was new', () => {
    // Find the first campaign level whose shape an earlier level already dealt.
    const names = Array.from({ length: 40 }, (_, i) => LevelGenerator.generate(i).shapeName);
    const repeat = names.findIndex((name, i) => names.indexOf(name) < i);
    expect(repeat).toBeGreaterThan(0);

    for (let level = 0; level <= repeat; level += 1) {
      SaveSystem.setCurrentLevel(level + 1);
      const set = jest.spyOn(store, 'setInt');
      const result = SaveSystem.recordCampaignClear(level);
      const firstTime = names.indexOf(names[level]) === level;

      expect([level, result.newlyDiscovered]).toEqual([level, firstTime]);
      expect(SaveSystem.shapesThroughLevel).toBe(level + 1);
      for (const [key] of set.mock.calls) expect(COLLECTION_KEYS).toContain(key);
      // A repeat shape writes the pointer only; the masks are unchanged.
      if (!firstTime) expect(set.mock.calls.map(([key]) => key)).toEqual(['arrows_shapes_through_level']);
      set.mockRestore();
    }
    expect(SaveSystem.shapesSeen).toEqual(truthMasks(0, repeat + 1));
  });

  test('a campaign clear with the fold behind writes nothing and is not "new"; the next menu sync records it', () => {
    store.setInt('arrows_current_level', 9);
    store.setInt('arrows_shapes_through_level', 4); // e.g. Play pressed before the menu fold finished
    SaveSystem.setCurrentLevel(10);
    const set = jest.spyOn(store, 'setInt');

    expect(SaveSystem.recordCampaignClear(9)).toEqual({ newlyDiscovered: false });
    expect(set).not.toHaveBeenCalled();

    expect(SaveSystem.syncCollection(5000)).toBe(0);
    expect(SaveSystem.shapesThroughLevel).toBe(10);
    expect(SaveSystem.shapesSeen).toEqual(truthMasks(4, 10));
  });

  test('a replayed or reset-behind clear (through > levelIndex) writes nothing', () => {
    store.setInt('arrows_shapes_through_level', 50);
    store.setInt('arrows_shapes_seen_lo', 7);
    SaveSystem.resetProgress();
    SaveSystem.setCurrentLevel(1);
    const set = jest.spyOn(store, 'setInt');

    expect(SaveSystem.recordCampaignClear(0)).toEqual({ newlyDiscovered: false });
    expect(SaveSystem.syncCollection(5000)).toBe(0);
    expect(set).not.toHaveBeenCalled();
    expect(SaveSystem.shapesThroughLevel).toBe(50);
    expect(SaveSystem.shapesSeen).toEqual({ lo: 7, hi: 0 });
  });

  test('a daily clear marks the daily shape once; an unknown name sets nothing', () => {
    const day = SaveSystem.today();
    expect(SaveSystem.registerDailyClear(day, 'Butterfly')).toEqual({ newlyDiscovered: true });
    expect(hasSeen(SaveSystem.shapesSeen, catalogueIndexOf('Butterfly'))).toBe(true);
    expect(SaveSystem.registerDailyClear(day + 1, 'Butterfly')).toEqual({ newlyDiscovered: false });
    expect(SaveSystem.registerDailyClear(day + 2, 'NotAShape')).toEqual({ newlyDiscovered: false });
    expect(countSeen(SaveSystem.shapesSeen)).toBe(1);
    // A daily never moves the campaign fold.
    expect(store.map.has('arrows_shapes_through_level')).toBe(false);
    expect(SaveSystem.dailyLastDay).toBe(day + 2);
  });

  test('corrupt stored values: a negative through refolds from 0; corrupt masks read as 0 and are rewritten only when a bit is added', () => {
    store.setInt('arrows_current_level', 3);
    store.setInt('arrows_shapes_through_level', -8);
    store.setInt('arrows_shapes_seen_lo', -5);
    store.setInt('arrows_shapes_seen_hi', 2 ** 30 + (1 << 25)); // a stray bit 30 plus a valid bit 25

    expect(SaveSystem.shapesThroughLevel).toBe(0);
    expect(SaveSystem.shapesSeen).toEqual({ lo: 0, hi: 1 << 25 });

    SaveSystem.syncCollection(5000);

    const expected = truthMasks(0, 3, { lo: 0, hi: 1 << 25 });
    expect(SaveSystem.shapesSeen).toEqual(expected);
    expect(storedMasks().lo).toBe(expected.lo);
    // Levels 0..2 are low-mask shapes, so the hi key keeps its raw value: no bit was added there.
    expect(store.getInt('arrows_shapes_seen_hi', 0)).toBe(2 ** 30 + (1 << 25));
    expect(SaveSystem.shapesThroughLevel).toBe(3);
  });

  test('persistence not healthy: sync, the campaign clear and the daily clear write no collection key', () => {
    // A failed hydrate reads defaults; ORing into those and writing through
    // would overwrite a real collection on disk (P-01's derived-value rule).
    SaveSystem.setPersistenceHealthy(false);
    store.setInt('arrows_current_level', 37);
    const set = jest.spyOn(store, 'setInt');

    expect(SaveSystem.syncCollection(5000)).toBe(0);
    SaveSystem.setCurrentLevel(1);
    store.setInt('arrows_shapes_through_level', 0);
    set.mockClear();
    expect(SaveSystem.recordCampaignClear(0)).toEqual({ newlyDiscovered: false });
    expect(SaveSystem.registerDailyClear(SaveSystem.today(), 'Heart')).toEqual({ newlyDiscovered: false });

    expect(set.mock.calls.map(([key]) => key)).toEqual(['arrows_daily_last_day']);
    expect(store.map.has('arrows_shapes_seen_lo')).toBe(false);
    expect(store.map.has('arrows_shapes_seen_hi')).toBe(false);
  });

  test('kill switch COLLECTION_SYNC_ENABLED = false: no collection write anywhere, the stored ints sit inert', () => {
    jest.isolateModules(() => {
      jest.doMock('../../featureFlags', () => ({
        ...jest.requireActual('../../featureFlags'),
        COLLECTION_SYNC_ENABLED: false,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SaveSystem: Killed } = require('../saveSystem') as typeof import('../saveSystem');
      const killedStore = new RecordingStore();
      Killed.useStore(killedStore);
      Killed.setPersistenceHealthy(true);
      killedStore.setInt('arrows_current_level', 37);
      killedStore.setInt('arrows_shapes_seen_lo', 5);
      const set = jest.spyOn(killedStore, 'setInt');

      expect(Killed.syncCollection(5000)).toBe(0);
      Killed.setCurrentLevel(38);
      expect(Killed.recordCampaignClear(37)).toEqual({ newlyDiscovered: false });
      expect(Killed.registerDailyClear(Killed.today(), 'Heart')).toEqual({ newlyDiscovered: false });

      expect(set.mock.calls.map(([key]) => key)).toEqual([
        'arrows_current_level',
        'arrows_daily_last_day',
      ]);
      expect(killedStore.getInt('arrows_shapes_seen_lo', -1)).toBe(5);
      expect(killedStore.map.has('arrows_shapes_through_level')).toBe(false);
    });
    jest.dontMock('../../featureFlags');
  });

  test('resetProgress is unchanged by W4-07: it keeps the three collection keys', () => {
    store.setInt('arrows_current_level', 12);
    SaveSystem.syncCollection(5000);
    const before = COLLECTION_KEYS.map((key) => store.getInt(key, -1));

    SaveSystem.resetProgress();

    for (const key of COLLECTION_KEYS) expect(store.deleted).not.toContain(key);
    expect(COLLECTION_KEYS.map((key) => store.getInt(key, -1))).toEqual(before);
  });
});

describe('W4-11 store-review bookkeeping', () => {
  const REVIEW_KEYS = ['arrows_review_count', 'arrows_review_last_day'];
  let previousHealthy: boolean;

  beforeEach(() => {
    previousHealthy = SaveSystem.persistenceHealthy;
    SaveSystem.setPersistenceHealthy(true); // initSaveSystem() read the save
  });

  afterEach(() => {
    SaveSystem.setPersistenceHealthy(previousHealthy);
  });

  test('both keys read 0 on a fresh store (never asked)', () => {
    expect(SaveSystem.reviewCount).toBe(0);
    expect(SaveSystem.reviewLastDay).toBe(0);
  });

  test('recordReviewRequest(day) writes lastDay = day and count + 1, and touches no other key', () => {
    store.setInt('arrows_total_solved', 30);
    expect(SaveSystem.recordReviewRequest(2460)).toBe(true);
    expect(SaveSystem.reviewCount).toBe(1);
    expect(SaveSystem.reviewLastDay).toBe(2460);

    expect(SaveSystem.recordReviewRequest(2551)).toBe(true);
    expect(SaveSystem.reviewCount).toBe(2);
    expect(SaveSystem.reviewLastDay).toBe(2551);
    expect([...store.map.keys()].sort()).toEqual(['arrows_total_solved', ...REVIEW_KEYS].sort());
  });

  test('corrupt values are returned raw, so the policy can fail closed on them', () => {
    store.setInt('arrows_review_count', -2);
    store.setInt('arrows_review_last_day', Number.NaN);
    expect(SaveSystem.reviewCount).toBe(-2);
    expect(SaveSystem.reviewLastDay).toBeNaN();
  });

  test('persistence not healthy: nothing is recorded (a count derived from defaults would overwrite the real one)', () => {
    store.setInt('arrows_review_count', 2);
    SaveSystem.setPersistenceHealthy(false);
    expect(SaveSystem.recordReviewRequest(2460)).toBe(false);
    expect(store.getInt('arrows_review_count', -1)).toBe(2);
    expect(store.getInt('arrows_review_last_day', -1)).toBe(-1);
  });

  test('resetProgress keeps both keys (a progress reset must not re-open the three lifetime asks)', () => {
    SaveSystem.recordReviewRequest(2460);
    SaveSystem.resetProgress();
    for (const key of REVIEW_KEYS) expect(store.deleted).not.toContain(key);
    expect(SaveSystem.reviewCount).toBe(1);
    expect(SaveSystem.reviewLastDay).toBe(2460);
  });

  test('the keys are the P-01 registry rows 18-19 (no key added or renamed)', () => {
    for (const key of REVIEW_KEYS) expect(SaveSystem.persistenceKeys).toContain(key);
    expect(SaveSystem.registeredKeys.reviewCount).toBe('arrows_review_count');
    expect(SaveSystem.registeredKeys.reviewLastDay).toBe('arrows_review_last_day');
  });
});

describe('W3-05 generator switch level', () => {
  const KEY = 'arrows_gen_switch_level';
  let previousHealthy: boolean;

  beforeEach(() => {
    previousHealthy = SaveSystem.persistenceHealthy;
    SaveSystem.setPersistenceHealthy(true); // initSaveSystem() read the save
  });

  afterEach(() => {
    SaveSystem.setPersistenceHealthy(previousHealthy);
  });

  test('absent reads null and is not stamped', () => {
    expect(SaveSystem.genSwitchLevel).toBeNull();
    expect(SaveSystem.genSwitchLevelStamped).toBe(false);
  });

  test('a stored 0 is a real value (fresh-install switch), and 41 reads back as 41', () => {
    store.setInt(KEY, 0);
    expect(SaveSystem.genSwitchLevel).toBe(0);
    expect(SaveSystem.genSwitchLevelStamped).toBe(true);
    store.setInt(KEY, 41);
    expect(SaveSystem.genSwitchLevel).toBe(41);
  });

  test('a stored negative value is invalid: it reads null, yet counts as stamped so nothing rewrites it', () => {
    store.setInt(KEY, -5);
    expect(SaveSystem.genSwitchLevel).toBeNull();
    expect(SaveSystem.genSwitchLevelStamped).toBe(true);
    store.setInt(KEY, 2.5);
    expect(SaveSystem.genSwitchLevel).toBeNull();
    expect(SaveSystem.genSwitchLevelStamped).toBe(true);
  });

  test('a stored -1 is P-01 row 20\'s "not stamped" sentinel (getInt(key, -1))', () => {
    store.setInt(KEY, -1);
    expect(SaveSystem.genSwitchLevel).toBeNull();
    expect(SaveSystem.genSwitchLevelStamped).toBe(false);
  });

  test('setGenSwitchLevel writes exactly arrows_gen_switch_level while healthy', () => {
    expect(SaveSystem.setGenSwitchLevel(41)).toBe(true);
    expect([...store.map]).toEqual([[KEY, 41]]);
    expect(SaveSystem.genSwitchLevel).toBe(41);
  });

  test('setGenSwitchLevel refuses a negative or non-integer level (the store never holds an invalid stamp)', () => {
    expect(SaveSystem.setGenSwitchLevel(-3)).toBe(false);
    expect(SaveSystem.setGenSwitchLevel(1.5)).toBe(false);
    expect(SaveSystem.setGenSwitchLevel(Number.NaN)).toBe(false);
    expect(store.map.has(KEY)).toBe(false);
  });

  test('persistence not healthy: setGenSwitchLevel writes nothing (a stamp derived from defaults would be wrong)', () => {
    SaveSystem.setPersistenceHealthy(false);
    expect(SaveSystem.setGenSwitchLevel(0)).toBe(false);
    expect(store.map.has(KEY)).toBe(false);
  });

  test('resetProgress is unchanged by W3-05: it keeps the switch level', () => {
    SaveSystem.setGenSwitchLevel(41);
    SaveSystem.resetProgress();
    expect(store.deleted).not.toContain(KEY);
    expect(SaveSystem.genSwitchLevel).toBe(41);
  });

  test('the key is P-01 registry row 20 (no key added or renamed)', () => {
    expect(SaveSystem.persistenceKeys).toContain(KEY);
    expect(SaveSystem.registeredKeys.genSwitchLevel).toBe(KEY);
  });
});

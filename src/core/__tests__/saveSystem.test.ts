import { SaveSystem, type IntStore } from '../saveSystem';

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

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

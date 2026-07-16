/**
 * Progress persistence: the resume pointer, lightweight lifetime stats (total
 * solves, perfect-clear streaks, daily play streak) and the sound/theme
 * preferences.
 *
 * Ported from Assets/_Game/Scripts/Core/SaveSystem.cs. Unity's PlayerPrefs is
 * replaced by a pluggable synchronous int store; the app wires in
 * react-native-mmkv (native, synchronous like PlayerPrefs) or localStorage on
 * web. Defaults to an in-memory store so core code and tests never touch the
 * platform.
 */
export interface IntStore {
  getInt(key: string, defaultValue: number): number;
  setInt(key: string, value: number): void;
  deleteKey(key: string): void;
}

class MemoryStore implements IntStore {
  private readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    const v = this.map.get(key);
    return v === undefined ? defaultValue : v;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

const CurrentKey = 'arrows_current_level';
const SolvedKey = 'arrows_total_solved';
const PerfectStreakKey = 'arrows_perfect_streak';
const BestPerfectStreakKey = 'arrows_best_perfect_streak';
const DayStreakKey = 'arrows_day_streak';
const LastPlayDayKey = 'arrows_last_play_day';
const SoundKey = 'arrows_sound_on';
const DarkKey = 'arrows_dark_mode';

let store: IntStore = new MemoryStore();

// Days since an arbitrary epoch, in LOCAL time, so "yesterday" matches the
// clock on the wall (a solve at 23:59 then 00:01 counts as two days).
function dayNumber(t: Date): number {
  const local = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const epoch = Date.UTC(2020, 0, 1);
  return Math.floor((local - epoch) / 86400000);
}

export const SaveSystem = {
  /** Swap in the platform store (MMKV / localStorage adapter) at app startup. */
  useStore(s: IntStore): void {
    store = s;
  },

  /** Level index to resume from (0-based). */
  get currentLevel(): number {
    return Math.max(0, store.getInt(CurrentKey, 0));
  },

  setCurrentLevel(index: number): void {
    store.setInt(CurrentKey, Math.max(0, index));
  },

  // ---- Lifetime stats --------------------------------------------------

  /** Total levels ever solved. */
  get totalSolved(): number {
    return store.getInt(SolvedKey, 0);
  },

  /** Consecutive levels solved without losing a heart (current run). */
  get perfectStreak(): number {
    return store.getInt(PerfectStreakKey, 0);
  },

  /** Longest-ever run of perfect (no-heart-lost) clears. */
  get bestPerfectStreak(): number {
    return store.getInt(BestPerfectStreakKey, 0);
  },

  /**
   * Consecutive calendar days with at least one solve. Reads as 0 if the
   * chain is already broken (last solve was before yesterday), so the menu
   * never shows a stale streak.
   */
  get dayStreak(): number {
    const last = store.getInt(LastPlayDayKey, 0);
    if (last === 0) return 0;
    const today = dayNumber(new Date());
    return today - last <= 1 ? store.getInt(DayStreakKey, 0) : 0;
  },

  /** Records one solved level and updates every derived stat. */
  registerSolve(perfect: boolean): void {
    store.setInt(SolvedKey, this.totalSolved + 1);

    const streak = perfect ? store.getInt(PerfectStreakKey, 0) + 1 : 0;
    store.setInt(PerfectStreakKey, streak);
    if (streak > this.bestPerfectStreak) store.setInt(BestPerfectStreakKey, streak);

    // Daily chain: same day = keep, yesterday = extend, otherwise restart at 1.
    const today = dayNumber(new Date());
    const last = store.getInt(LastPlayDayKey, 0);
    if (last !== today) {
      const days = last !== 0 && today - last === 1 ? store.getInt(DayStreakKey, 0) + 1 : 1;
      store.setInt(DayStreakKey, days);
      store.setInt(LastPlayDayKey, today);
    }
  },

  // ---- Preferences -----------------------------------------------------

  get soundOn(): boolean {
    return store.getInt(SoundKey, 1) !== 0;
  },
  set soundOn(value: boolean) {
    store.setInt(SoundKey, value ? 1 : 0);
  },

  /** Theme variant: false = Daylight (default), true = Ink Night. */
  get darkMode(): boolean {
    return store.getInt(DarkKey, 0) !== 0;
  },
  set darkMode(value: boolean) {
    store.setInt(DarkKey, value ? 1 : 0);
  },

  resetProgress(): void {
    store.deleteKey(CurrentKey);
    store.deleteKey(SolvedKey);
    store.deleteKey(PerfectStreakKey);
    store.deleteKey(BestPerfectStreakKey);
    store.deleteKey(DayStreakKey);
    store.deleteKey(LastPlayDayKey);
  },
};

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

/**
 * THE KEY REGISTRY. Every persisted key lives here and nowhere else.
 *
 * Why one record: `src/ui/storage.ts` hydrates exactly `PersistenceKeys` in one
 * AsyncStorage.multiGet at boot. A key that code writes but that is missing
 * here still reaches disk, then silently reads its default after the next cold
 * start. Deriving `PersistenceKeys` from this record makes that impossible for
 * any key that goes through `Keys.*`.
 *
 * Rules:
 * - Code outside this file never passes a raw key string. A consumer task adds
 *   named getters/setters in this file that use `Keys.*`.
 * - AMENDMENT RULE: any later key is added by a commit titled
 *   `P-01 amendment: <key>`. That commit edits the P-01 key table in
 *   docs/next-level/tasks/P.md, this record and the exact array in
 *   src/ui/__tests__/storage.test.ts together. Consumer tasks never edit them.
 * - Append only. The first eight entries are the legacy keys in their shipped
 *   order; new keys are appended. Never rename or reorder an existing value.
 * - All values are ints (the store is int-only). They round-trip as
 *   String(v) / parseInt(v, 10), so any int up to 2^53 survives, but JS bitwise
 *   operators are 32-bit signed: a bitmask key uses bits 0-29 only.
 * - Adding a key never bumps SCHEMA_VERSION (see migrate()).
 * - Android Auto Backup is on: every key can be restored onto another device
 *   whose clock or build differs. Each consumer implements the restore /
 *   clock-skew rule recorded for its key in the P-01 table.
 */
const Keys = Object.freeze({
  // ---- Legacy keys (shipped before P-01; order is load-bearing) ----------
  currentLevel: 'arrows_current_level',
  totalSolved: 'arrows_total_solved',
  perfectStreak: 'arrows_perfect_streak',
  bestPerfectStreak: 'arrows_best_perfect_streak',
  dayStreak: 'arrows_day_streak',
  lastPlayDay: 'arrows_last_play_day',
  soundOn: 'arrows_sound_on',
  darkMode: 'arrows_dark_mode',

  // ---- P-01 rows 9-29 (table order) -------------------------------------
  /** Row 9. Save schema version; absent = 0 (pre-versioning save). Owner: P-01. */
  schemaVersion: 'arrows_schema_version',
  /** Row 10. Finished games since the last displayed interstitial, >= 0. Owner: W0-05. */
  finishedGames: 'arrows_finished_games',
  /** Row 11. 0 not started, 1 T1 cleared, 2 T2 cleared, 3 done. Owner: W1-03..W1-06. */
  ftueStage: 'arrows_ftue_stage',
  /** Row 12. Banked free streak freezes, 0..cap. Owner: W4-02. */
  streakFreezes: 'arrows_streak_freezes',
  /** Row 13. Local day a freeze was spent and not yet shown; 0 = nothing. Owner: W4-02. */
  streakSavedDay: 'arrows_streak_saved_day',
  /** Row 14. Local day number of the last daily clear; 0 = never. Owner: W4-06. */
  dailyLastDay: 'arrows_daily_last_day',
  // Shape collection bitmasks (rows 15-16), owner W4-07:
  // - bit i <-> shape catalogue index i (lo: indices 0-29, hi: indices 30-59);
  // - the shape catalogue is append-only (its order-lock test is W4-01's);
  // - past 60 shapes, a P-01 amendment adds `arrows_shapes_seen_x2`. Existing
  //   bits are never reinterpreted.
  /** Row 15. Collection bits 0-29 = catalogue indices 0-29. */
  shapesSeenLo: 'arrows_shapes_seen_lo',
  /** Row 16. Collection bits 0-29 = catalogue indices 30-59. */
  shapesSeenHi: 'arrows_shapes_seen_hi',
  /** Row 17. Campaign levels 0..N-1 already folded into the collection. Owner: W4-07. */
  shapesThroughLevel: 'arrows_shapes_through_level',
  /** Row 18. Lifetime store-review requests made. Owner: W4-11. */
  reviewCount: 'arrows_review_count',
  /** Row 19. Local day of the last review request; 0 = never. Owner: W4-11. */
  reviewLastDay: 'arrows_review_last_day',
  /**
   * Row 20. First level index dealt by the level-indexed curve. Owner: W3-05.
   * Absent reads -1 via getInt(key, -1) ("not stamped"; 0 is a real value).
   * Stamp only while SaveSystem.persistenceHealthy is true.
   */
  genSwitchLevel: 'arrows_gen_switch_level',
  /**
   * Row 21. Packed consent bits: 1 resolved, 2 gdprApplies, 4 personalisedAds,
   * 8 ccpaOptOut; 0 = never resolved. A preference: a progress reset never
   * deletes it. Owner: W7-01, W7-03, W7-04.
   */
  consent: 'arrows_consent',
  /** Row 22. Last accepted remote kill bits. Owner: W6-02. */
  rcKillBits: 'arrows_rc_kill_bits',
  /** Row 23. configVersion of the last accepted remote config; 0 = never. Owner: W6-02. */
  rcVersion: 'arrows_rc_version',
  /** Row 24. High 31 bits of the app-generated install id; 0 = not generated. Owner: W6-05. */
  telInstallHi: 'arrows_tel_install_hi',
  /** Row 25. Low 31 bits of the install id. Owner: W6-05. */
  telInstallLo: 'arrows_tel_install_lo',
  /** Row 26. Cold starts since install. Owner: W6-05. */
  telSessionCount: 'arrows_tel_session_count',
  /** Row 27. JS fatals recorded and not yet emitted. Owner: W6-07. */
  telFatalPending: 'arrows_tel_fatal_pending',
  /** Row 28. 32-bit unsigned FNV-1a of the last fatal's name:message. Owner: W6-07. */
  telFatalHash: 'arrows_tel_fatal_hash',
  /** Row 29. Screen at the last fatal (1 splash, 2 menu, 3 game). Owner: W6-07. */
  telFatalScreen: 'arrows_tel_fatal_screen',
});

type KeyRecord = typeof Keys;

/** Exactly the keys hydrated at boot: every value of `Keys`, in record order. */
const PersistenceKeys: readonly string[] = Object.freeze(Object.values(Keys));

/**
 * Save schema version this build writes. Adding keys never bumps it. A bump is
 * reserved for changing the meaning of an existing key, and needs its own
 * migration step and its own P-01 amendment.
 */
const SCHEMA_VERSION = 1;

let persistenceHealthy = false;

let store: IntStore = new MemoryStore();

// Days since an arbitrary epoch, in LOCAL time, so "yesterday" matches the
// clock on the wall (a solve at 23:59 then 00:01 counts as two days).
function dayNumber(t: Date): number {
  const local = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const epoch = Date.UTC(2020, 0, 1);
  return Math.floor((local - epoch) / 86400000);
}

/**
 * A stored count as a non-negative integer (not finite = 0). Core stays free of
 * UI imports, so this mirrors src/ui/adPacing.ts sanitizeCounter for numbers.
 */
function nonNegativeInt(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

export const SaveSystem = {
  /** Complete, immutable list of persistence keys owned by the save system. */
  get persistenceKeys(): readonly string[] {
    return PersistenceKeys;
  },

  /**
   * The frozen key record. Exported for the registry's no-orphans test only;
   * consumers use named accessors in this file and never pass raw keys.
   */
  get registeredKeys(): KeyRecord {
    return Keys;
  },

  /** Swap in the platform store (MMKV / localStorage adapter) at app startup. */
  useStore(s: IntStore): void {
    store = s;
  },

  // ---- Schema version and health ----------------------------------------

  /** The save schema version this build understands and writes. */
  get SCHEMA_VERSION(): number {
    return SCHEMA_VERSION;
  },

  /** Stored save schema version; 0 = a save written before versioning. */
  get schemaVersion(): number {
    return store.getInt(Keys.schemaVersion, 0);
  },

  /**
   * True only after initSaveSystem() read the saved keys successfully. False
   * before init and after a failed hydrate (the game then runs on in-memory
   * defaults). A consumer that stamps a DERIVED value (for example W3's
   * generator switch level) must skip that write while this is false, or an
   * unread save gets a value derived from defaults.
   */
  get persistenceHealthy(): boolean {
    return persistenceHealthy;
  },

  /** Set by initSaveSystem() only. */
  setPersistenceHealthy(healthy: boolean): void {
    persistenceHealthy = healthy;
  },

  /**
   * Additive migration. Call only when persistenceHealthy is true.
   * - stored 0 (absent): write arrows_schema_version = SCHEMA_VERSION, nothing else;
   * - stored == SCHEMA_VERSION: no write;
   * - stored > SCHEMA_VERSION (restore from a newer build): inert, no write;
   * - stored < 0 (corrupt): inert, no write (never guess over unknown data).
   * It never deletes, resets or enumerates keys, and never touches a legacy key.
   */
  migrate(): void {
    const stored = store.getInt(Keys.schemaVersion, 0);
    if (stored === 0) store.setInt(Keys.schemaVersion, SCHEMA_VERSION);
  },

  /** Level index to resume from (0-based). */
  get currentLevel(): number {
    return Math.max(0, store.getInt(Keys.currentLevel, 0));
  },

  setCurrentLevel(index: number): void {
    store.setInt(Keys.currentLevel, Math.max(0, index));
  },

  // ---- Interstitial pacing (W0-05) --------------------------------------

  /**
   * Finished games since the last displayed interstitial, read as a
   * non-negative integer (absent or corrupt = 0). Not part of resetProgress():
   * a progress reset must not become a way to skip ads.
   */
  get finishedGames(): number {
    return nonNegativeInt(store.getInt(Keys.finishedGames, 0));
  },

  setFinishedGames(n: number): void {
    store.setInt(Keys.finishedGames, nonNegativeInt(n));
  },

  // ---- Remote kill switch (W6-02) ----------------------------------------

  /**
   * Last accepted remote kill bits (bit 0 all ads, 1 interstitials, 2 rewarded,
   * 3 telemetry transport), read as a non-negative integer. Interpreted only by
   * src/config/remoteConfig.ts. Not part of resetProgress().
   */
  get rcKillBits(): number {
    return nonNegativeInt(store.getInt(Keys.rcKillBits, 0));
  },

  setRcKillBits(bits: number): void {
    store.setInt(Keys.rcKillBits, nonNegativeInt(bits));
  },

  /** configVersion of the last accepted remote config; 0 = never fetched. */
  get rcVersion(): number {
    return nonNegativeInt(store.getInt(Keys.rcVersion, 0));
  },

  setRcVersion(version: number): void {
    store.setInt(Keys.rcVersion, nonNegativeInt(version));
  },

  // ---- Telemetry identity (W6-05) ---------------------------------------
  // See src/telemetry/identity.ts (ensureIdentity, nextSessionIndex) and
  // docs/telemetry-identity.md for what these three keys hold and why.

  /** High 31 bits of the app-generated install id; 0 = not generated yet. */
  get telInstallHi(): number {
    return nonNegativeInt(store.getInt(Keys.telInstallHi, 0));
  },

  setTelInstallHi(value: number): void {
    store.setInt(Keys.telInstallHi, nonNegativeInt(value));
  },

  /** Low 31 bits of the app-generated install id; 0 = not generated yet. */
  get telInstallLo(): number {
    return nonNegativeInt(store.getInt(Keys.telInstallLo, 0));
  },

  setTelInstallLo(value: number): void {
    store.setInt(Keys.telInstallLo, nonNegativeInt(value));
  },

  /** Cold starts since install, incremented once per launch. */
  get telSessionCount(): number {
    return nonNegativeInt(store.getInt(Keys.telSessionCount, 0));
  },

  setTelSessionCount(value: number): void {
    store.setInt(Keys.telSessionCount, nonNegativeInt(value));
  },

  // ---- Pending JavaScript fatals (W6-07) -------------------------------

  /** JS fatals recorded but not yet emitted on a later cold start. */
  get telFatalPending(): number {
    return nonNegativeInt(store.getInt(Keys.telFatalPending, 0));
  },

  setTelFatalPending(value: number): void {
    store.setInt(Keys.telFatalPending, nonNegativeInt(value));
  },

  /** Unsigned FNV-1a hash of the last fatal's name and message. */
  get telFatalHash(): number {
    return store.getInt(Keys.telFatalHash, 0);
  },

  setTelFatalHash(value: number): void {
    store.setInt(Keys.telFatalHash, value);
  },

  /** Last fatal's screen: 1 splash, 2 menu, 3 game; corrupt values read 0. */
  get telFatalScreen(): number {
    const value = store.getInt(Keys.telFatalScreen, 0);
    return Number.isInteger(value) && value >= 1 && value <= 3 ? value : 0;
  },

  setTelFatalScreen(value: number): void {
    const valid = Number.isInteger(value) && value >= 1 && value <= 3;
    store.setInt(Keys.telFatalScreen, valid ? value : 0);
  },

  // ---- Lifetime stats --------------------------------------------------

  /** Total levels ever solved. */
  get totalSolved(): number {
    return store.getInt(Keys.totalSolved, 0);
  },

  /** Consecutive levels solved without losing a heart (current run). */
  get perfectStreak(): number {
    return store.getInt(Keys.perfectStreak, 0);
  },

  /** Longest-ever run of perfect (no-heart-lost) clears. */
  get bestPerfectStreak(): number {
    return store.getInt(Keys.bestPerfectStreak, 0);
  },

  /**
   * Consecutive calendar days with at least one solve. Reads as 0 if the
   * chain is already broken (last solve was before yesterday), so the menu
   * never shows a stale streak.
   */
  get dayStreak(): number {
    const last = store.getInt(Keys.lastPlayDay, 0);
    if (last === 0) return 0;
    const today = dayNumber(new Date());
    return today - last <= 1 ? store.getInt(Keys.dayStreak, 0) : 0;
  },

  /** Records one solved level and updates every derived stat. */
  registerSolve(perfect: boolean): void {
    store.setInt(Keys.totalSolved, this.totalSolved + 1);

    const streak = perfect ? store.getInt(Keys.perfectStreak, 0) + 1 : 0;
    store.setInt(Keys.perfectStreak, streak);
    if (streak > this.bestPerfectStreak) store.setInt(Keys.bestPerfectStreak, streak);

    // Daily chain: same day = keep, yesterday = extend, otherwise restart at 1.
    const today = dayNumber(new Date());
    const last = store.getInt(Keys.lastPlayDay, 0);
    if (last !== today) {
      const days = last !== 0 && today - last === 1 ? store.getInt(Keys.dayStreak, 0) + 1 : 1;
      store.setInt(Keys.dayStreak, days);
      store.setInt(Keys.lastPlayDay, today);
    }
  },

  // ---- Preferences -----------------------------------------------------

  get soundOn(): boolean {
    return store.getInt(Keys.soundOn, 1) !== 0;
  },
  set soundOn(value: boolean) {
    store.setInt(Keys.soundOn, value ? 1 : 0);
  },

  /** Theme variant: false = Daylight (default), true = Ink Night. */
  get darkMode(): boolean {
    return store.getInt(Keys.darkMode, 0) !== 0;
  },
  set darkMode(value: boolean) {
    store.setInt(Keys.darkMode, value ? 1 : 0);
  },

  resetProgress(): void {
    store.deleteKey(Keys.currentLevel);
    store.deleteKey(Keys.totalSolved);
    store.deleteKey(Keys.perfectStreak);
    store.deleteKey(Keys.bestPerfectStreak);
    store.deleteKey(Keys.dayStreak);
    store.deleteKey(Keys.lastPlayDay);
  },
};

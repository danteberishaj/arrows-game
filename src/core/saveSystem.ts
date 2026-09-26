import { COLLECTION_SYNC_ENABLED, META_STREAK_FREEZE } from '../featureFlags';
import {
  foldLevels,
  hasSeen,
  markSeen,
  sanitizeMask,
  type ShapeMasks,
} from './collection';
import { shapeNameForLevel } from './levelGenerator';
import { catalogueIndexOf } from './shapeCatalogue';
import {
  advanceStreak,
  readStreak,
  STREAK_FREEZE_CAP,
  STREAK_FREEZE_EARN_EVERY_DAYS,
} from './streak';

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
const FTUE_NOT_STARTED_STAGE = 0; // OWNER-PICKED STARTING VALUE
const CONSENT_BITS_MASK = 0b1111;

let persistenceHealthy = false;

let store: IntStore = new MemoryStore();
let clock: () => Date = () => new Date();

const STREAK_OPTIONS = {
  freezesEnabled: META_STREAK_FREEZE,
  earnEveryDays: STREAK_FREEZE_EARN_EVERY_DAYS,
  cap: STREAK_FREEZE_CAP,
};

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

/**
 * W4-07: the shape campaign level `levelIndex` dealt, for the collection fold.
 * v1 for every index until W3's generator-version seam exists; then W3-05
 * routes it through core `resolveGenVersion(index, genSwitchLevel)` with no
 * PERF/DEV override (ruling F11). Must equal LevelGenerator.generate(i)
 * .shapeName (collection.test.ts, shapeCatalogue.test.ts).
 */
function campaignShapeName(levelIndex: number): string {
  return shapeNameForLevel(levelIndex);
}

const NOT_NEW: { readonly newlyDiscovered: boolean } = Object.freeze({ newlyDiscovered: false });

/**
 * Collection writes are skipped while persistence is unhealthy: a failed
 * hydrate reads every key as its default, and ORing into those defaults then
 * writing through would overwrite the real collection on disk (P-01's rule for
 * derived values). The kill constant stops every collection write.
 */
function collectionWritable(): boolean {
  return COLLECTION_SYNC_ENABLED && persistenceHealthy;
}

function readShapeMasks(): ShapeMasks {
  return {
    lo: sanitizeMask(store.getInt(Keys.shapesSeenLo, 0)),
    hi: sanitizeMask(store.getInt(Keys.shapesSeenHi, 0)),
  };
}

/** Writes only a mask that gained a bit (the masks only ever grow). */
function writeShapeMasks(before: ShapeMasks, after: ShapeMasks): void {
  if (after.lo !== before.lo) store.setInt(Keys.shapesSeenLo, after.lo);
  if (after.hi !== before.hi) store.setInt(Keys.shapesSeenHi, after.hi);
}

/** Only the four defined consent bits are valid; corrupt values fail closed. */
function validConsentBits(v: number): number {
  if (!Number.isSafeInteger(v) || v < 0 || v > CONSENT_BITS_MASK) return 0;
  return v & CONSENT_BITS_MASK;
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

  /** Swap stores and return the previous one so scoped callers can restore it. */
  useStore(s: IntStore): IntStore {
    const previous = store;
    store = s;
    return previous;
  },

  /** Swap clocks and return the previous one so scoped callers can restore it. */
  useClock(fn: () => Date): () => Date {
    const previous = clock;
    clock = fn;
    return previous;
  },

  /** Current local calendar day, using the injected clock. */
  today(): number {
    return dayNumber(clock());
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

  // ---- First-time user experience (W1-03) ------------------------------

  /** Raw FTUE stage: 0 not started, 1 T1 cleared, 2 assist, 3 done. */
  get ftueStage(): number {
    return store.getInt(Keys.ftueStage, FTUE_NOT_STARTED_STAGE);
  },

  setFtueStage(stage: number): void {
    store.setInt(Keys.ftueStage, stage);
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

  // ---- Ad consent (W7-01) -----------------------------------------------

  /** Packed consent state; absent or corrupt reads 0 (unresolved). */
  get consentBits(): number {
    return validConsentBits(store.getInt(Keys.consent, 0));
  },

  setConsentBits(n: number): void {
    store.setInt(Keys.consent, validConsentBits(n));
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

  /** Banked automatic streak freezes, bounded to the feature's cap. */
  get streakFreezes(): number {
    return Math.min(STREAK_FREEZE_CAP, nonNegativeInt(store.getInt(Keys.streakFreezes, 0)));
  },

  /** Local day of an unshown freeze rescue; 0 means no pending message. */
  get streakSavedDay(): number {
    return nonNegativeInt(store.getInt(Keys.streakSavedDay, 0));
  },

  /** Marks the pending one-mount rescue message as shown. */
  clearStreakSavedDay(): void {
    store.setInt(Keys.streakSavedDay, 0);
  },

  /**
   * Consecutive calendar days with at least one solve. Reads the stored chain
   * while the next solve can still rescue it, otherwise 0.
   */
  get dayStreak(): number {
    return readStreak(
      {
        today: this.today(),
        lastPlayDay: store.getInt(Keys.lastPlayDay, 0),
        streak: store.getInt(Keys.dayStreak, 0),
        freezes: store.getInt(Keys.streakFreezes, 0),
      },
      STREAK_OPTIONS,
    );
  },

  /** Records one solved level and updates every derived stat. */
  registerSolve(perfect: boolean): void {
    store.setInt(Keys.totalSolved, this.totalSolved + 1);

    const streak = perfect ? store.getInt(Keys.perfectStreak, 0) + 1 : 0;
    store.setInt(Keys.perfectStreak, streak);
    if (streak > this.bestPerfectStreak) store.setInt(Keys.bestPerfectStreak, streak);

    const previousDayStreak = store.getInt(Keys.dayStreak, 0);
    const previousLastPlayDay = store.getInt(Keys.lastPlayDay, 0);
    const previousFreezes = store.getInt(Keys.streakFreezes, 0);
    const next = advanceStreak(
      {
        today: this.today(),
        lastPlayDay: previousLastPlayDay,
        streak: previousDayStreak,
        freezes: previousFreezes,
      },
      STREAK_OPTIONS,
    );

    if (next.streak !== previousDayStreak) store.setInt(Keys.dayStreak, next.streak);
    if (next.lastPlayDay !== previousLastPlayDay) {
      store.setInt(Keys.lastPlayDay, next.lastPlayDay);
    }
    if (next.freezes !== previousFreezes) store.setInt(Keys.streakFreezes, next.freezes);
    if (next.savedToday) store.setInt(Keys.streakSavedDay, next.lastPlayDay);
  },

  // ---- Daily board (W4-06) ---------------------------------------------

  /**
   * Local day number of the last daily clear; 0 = never (absent or corrupt).
   * May be AFTER today (Auto Backup from a device whose clock ran ahead, or the
   * clock moved back); src/ui/dailyEntryState.ts reads that as "available".
   */
  get dailyLastDay(): number {
    return nonNegativeInt(store.getInt(Keys.dailyLastDay, 0));
  },

  /**
   * Records a cleared daily board. Writes `arrows_daily_last_day` and (W4-07)
   * the collection bit of `shapeName`, the cleared board's shape, and never
   * reads the clock: `day` is the board's own day, fixed when the daily screen
   * was entered, so a clear after midnight still records it. The caller also
   * calls registerSolve (streak and totals) and never setCurrentLevel: a daily
   * is not a campaign level. `newlyDiscovered` is true when the bit was 0.
   */
  registerDailyClear(day: number, shapeName: string): { newlyDiscovered: boolean } {
    store.setInt(Keys.dailyLastDay, nonNegativeInt(day));
    // W4-07: the daily's shape joins the collection. The campaign fold pointer
    // is untouched (a daily is not a campaign level).
    if (!collectionWritable()) return NOT_NEW;
    const index = catalogueIndexOf(shapeName);
    const before = readShapeMasks();
    if (index < 0 || hasSeen(before, index)) return NOT_NEW;
    writeShapeMasks(before, markSeen(before, index));
    return { newlyDiscovered: true };
  },

  // ---- Store-review bookkeeping (W4-11) ---------------------------------
  // The decision is src/core/reviewPolicy.ts (pure); GameScreen reads these
  // two keys for it and records an ask before the OS call. Neither key is part
  // of resetProgress(): a progress reset must not re-open the lifetime asks.

  /**
   * Store-review requests made over the install's lifetime (0 = never). Raw:
   * a corrupt value reaches the policy unchanged, and the policy fails closed.
   */
  get reviewCount(): number {
    return store.getInt(Keys.reviewCount, 0);
  },

  /**
   * Local day (today()'s unit) of the last store-review request; 0 = never.
   * Raw, like reviewCount. A day after today suppresses the ask (P-01 row 19).
   */
  get reviewLastDay(): number {
    return store.getInt(Keys.reviewLastDay, 0);
  },

  /**
   * Records one store-review request on `day`: `arrows_review_last_day = day`
   * and `arrows_review_count + 1`. Called BEFORE the OS call, whatever the OS
   * then shows (Play and Apple may show nothing and do not say). Skipped, and
   * false returned, while persistence is unhealthy: a count derived from
   * in-memory defaults would overwrite the real one on disk (P-01's rule for
   * derived values). The caller must not ask the OS when this returns false.
   */
  recordReviewRequest(day: number): boolean {
    if (!persistenceHealthy) return false;
    store.setInt(Keys.reviewLastDay, day);
    store.setInt(Keys.reviewCount, nonNegativeInt(store.getInt(Keys.reviewCount, 0)) + 1);
    return true;
  },

  // ---- Shape collection (W4-07) ----------------------------------------
  // Pure bit logic: src/core/collection.ts. The only reader is the flagged
  // gallery (W4-09); recording is invisible and ships ON behind the literal
  // kill constant COLLECTION_SYNC_ENABLED (src/featureFlags.ts).

  /** The collection masks, sanitized (corrupt values read as 0; see sanitizeMask). */
  get shapesSeen(): ShapeMasks {
    return readShapeMasks();
  },

  /** Campaign levels 0..N-1 already folded into the collection; corrupt or absent = 0. */
  get shapesThroughLevel(): number {
    return nonNegativeInt(store.getInt(Keys.shapesThroughLevel, 0));
  },

  /**
   * Folds campaign levels [shapesThroughLevel, currentLevel), at most
   * `maxSteps` of them, into the collection and writes the masks (only one that
   * gained a bit) and the new pointer. Every level below currentLevel was
   * solved (setCurrentLevel(i + 1) runs only on a clear), so the bits are
   * reconstructed, not guessed. A cap delays bits and never drops them: the
   * next call resumes at the pointer. Nothing to fold (pointer at or past the
   * level, e.g. after a progress reset) reads two keys and writes nothing.
   * `shouldStop` (optional, e.g. a time budget) ends the call early after at
   * least one level; see foldLevels. Returns the levels still unfolded after
   * this call (0 = caught up).
   */
  syncCollection(maxSteps: number, shouldStop?: () => boolean): number {
    if (!collectionWritable()) return 0;
    const target = this.currentLevel;
    const through = this.shapesThroughLevel;
    if (through >= target) return 0;
    const before = readShapeMasks();
    const folded = foldLevels(before, through, target, campaignShapeName, maxSteps, shouldStop);
    if (folded.through === through) return target - through;
    writeShapeMasks(before, folded);
    store.setInt(Keys.shapesThroughLevel, folded.through);
    return target - folded.through;
  },

  /**
   * A campaign clear of `levelIndex`, called after setCurrentLevel(levelIndex
   * + 1). The O(1) fast path: only when the fold pointer is exactly this level
   * does it record the level's shape and move the pointer on. Otherwise (the
   * menu fold is still behind, or the pointer leads after a reset) it writes
   * nothing and the next menu mount's syncCollection catches up.
   *
   * `newlyDiscovered` is true only when this clear set a bit that was 0. It is
   * false when deferred, because a bit the pending fold may set cannot be
   * called new. Data only: W5 decides whether anything shows it.
   */
  recordCampaignClear(levelIndex: number): { newlyDiscovered: boolean } {
    if (!collectionWritable()) return NOT_NEW;
    if (this.shapesThroughLevel !== levelIndex) return NOT_NEW;
    const before = readShapeMasks();
    const folded = foldLevels(before, levelIndex, levelIndex + 1, campaignShapeName, 1);
    writeShapeMasks(before, folded);
    store.setInt(Keys.shapesThroughLevel, folded.through);
    return { newlyDiscovered: folded.lo !== before.lo || folded.hi !== before.hi };
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

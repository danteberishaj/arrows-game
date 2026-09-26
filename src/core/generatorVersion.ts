/**
 * W3-05: the generator version seam.
 *
 * A campaign board is a pure function of (level index, generator version).
 * Each install has ONE switch level (`arrows_gen_switch_level`, P-01 row 20):
 * indices below it are dealt by v1, indices at or above it by v2. A shipped
 * version is frozen by golden fingerprints and never edited
 * (`__tests__/levelGenerator.test.ts`); new content is a new version.
 *
 * Why a switch level and not a global flip: the game saves no board state
 * mid-level, so "resume" means "re-deal index N". A player's current board
 * and every past board (the W4 shape collection folds them) must stay the v1
 * boards they were dealt. An existing player therefore switches at
 * `currentLevel + 1`; a fresh install switches at 0.
 *
 * This module is pure core: it imports nothing from SaveSystem (which imports
 * it), and the boot stamp takes the save as a parameter.
 */

export type GenVersion = 1 | 2;

/**
 * V2-FINISH (the owner's W3-16 ruling): whether this install's v2 boards carry
 * the v1 floor. An install stamped above 0 played v1 before v2 turned on
 * (`classifySwitchLevel`: currentLevel + 1), so its v2 boards are never
 * smaller or easier than v1's for their tier. A fresh install (0) rides the
 * curve from level 1. Unstamped or corrupt (null) never reaches v2 through
 * `resolveGenVersion`; the DEV/PERF forced-v2 paths pass nothing and deal
 * like a fresh install.
 */
export function hasV1Floor(switchLevel: number | null | undefined): boolean {
  return switchLevel !== null && switchLevel !== undefined && switchLevel > 0;
}

/**
 * Build-time switch for the v2 generator. OFF: every install is dealt v1 at
 * every index and nothing is stamped. Rollback after a flip is setting this
 * back to false in a new build; the cost is that a player standing on a v2
 * board is re-dealt it as v1 once (W3-05 brief, "Risk and rollback").
 */
export const GEN_V2_ENABLED = false;

/**
 * The generator version that deals campaign level `levelIndex` on this
 * install. `switchLevel` is `SaveSystem.genSwitchLevel` (null = never stamped,
 * or a corrupt stored value). Returns 1 when v2 is disabled, when there is no
 * valid switch level, or below the switch level; otherwise 2.
 */
export function resolveGenVersion(
  levelIndex: number,
  switchLevel: number | null,
  enabled: boolean = GEN_V2_ENABLED,
): GenVersion {
  if (!enabled) return 1;
  if (switchLevel === null) return 1;
  if (levelIndex < switchLevel) return 1;
  return 2;
}

/**
 * The switch level to stamp once, at the first boot that has v2 enabled.
 * A fresh install gets 0 (every board v2). An existing player gets
 * `currentLevel + 1`: the board they stand on and every board behind them
 * stays v1. "Fresh" is `currentLevel === 0 && totalSolved === 0` (ruling I-3):
 * a daily-only player (level 0, solves > 0) gets 1, so board 0 stays v1.
 */
export function classifySwitchLevel({
  fresh,
  currentLevel,
}: {
  fresh: boolean;
  currentLevel: number;
}): number {
  return fresh ? 0 : currentLevel + 1;
}

/** The slice of SaveSystem the boot stamp reads and writes. */
export interface GenSwitchSave {
  readonly persistenceHealthy: boolean;
  /** True when the key holds any value other than P-01's "not stamped" sentinel (valid or corrupt). */
  readonly genSwitchLevelStamped: boolean;
  readonly currentLevel: number;
  readonly totalSolved: number;
  /** Writes the key; false (no write) while persistence is unhealthy or for an invalid level. */
  setGenSwitchLevel(level: number): boolean;
}

/**
 * The boot classification (App.tsx, inside the initSaveSystem().then callback,
 * before the first screen can deal a board). Writes the switch level once and
 * returns it, or returns null and writes nothing when:
 * - v2 is disabled (the shipped state);
 * - persistence is not healthy: before or during hydration the save reads its
 *   defaults (level 0), and after a failed hydrate the real save was never
 *   read, so a stamp would be derived from defaults (P-01's derived-value rule);
 * - the key already holds a value. A valid stamp is permanent; a corrupt one
 *   (for example -5) reads as null, so the resolver yields v1, and it is left
 *   exactly as stored.
 */
export function stampGenSwitchLevel(
  save: GenSwitchSave,
  enabled: boolean = GEN_V2_ENABLED,
): number | null {
  if (!enabled) return null;
  if (!save.persistenceHealthy) return null;
  if (save.genSwitchLevelStamped) return null;
  const currentLevel = save.currentLevel;
  const level = classifySwitchLevel({
    fresh: currentLevel === 0 && save.totalSolved === 0,
    currentLevel,
  });
  return save.setGenSwitchLevel(level) ? level : null;
}

/**
 * W3-20 option (a) (owner ruling 2026-10-06): the tier WORD the player sees is derived from the board
 * that was dealt, not from the six-level cycle. The cycle (`Difficulties.forLevel`) still drives
 * generation targets, hearts, the shape pools and everything else; only the label reads this module,
 * and only behind `TIER_LABEL_V2_ENABLED` (src/featureFlags.ts).
 *
 * A board is Normal below `hard` arrows, Hard from `hard` to `superHard - 1`, Super Hard from
 * `superHard`. One cut per edge on one number, so two displayed tiers can never share an arrow count.
 */
import { Difficulty } from './difficulty';
import type { GeneratedLevel } from './levelGenerator';

/** Inclusive lower arrow-count bounds of the Hard and Super Hard displayed tiers (`superHard > hard`). */
export interface DisplayTierThresholds {
  readonly hard: number;
  readonly superHard: number;
}

/**
 * OWNER-PICKED (W3-20, owner ruling 2026-10-06: 95 / 133). Measured, not typed:
 * `npx tsx scripts/analysis/display-tier-report.ts` prints the cuts that give the v2 fresh-install corpus
 * (displayed levels 1-1000) the six-level cycle's own share, Normal 4/6, Hard 1/6, Super Hard 1/6 (measured
 * 67.4% / 15.7% / 16.9%), and the share v1 (55.0 / 25.5 / 19.5) and an existing v2 player at switch level 1
 * (53.0 / 21.8 / 25.2) get. Re-run it after any curve or generator change.
 */
export const DISPLAY_TIER_THRESHOLDS: DisplayTierThresholds = { hard: 95, superHard: 133 };

/** The displayed tier of a board with `arrowCount` arrows. */
export function displayTierForArrowCount(
  arrowCount: number,
  thresholds: DisplayTierThresholds = DISPLAY_TIER_THRESHOLDS,
): Difficulty {
  if (arrowCount >= thresholds.superHard) return Difficulty.SuperHard;
  if (arrowCount >= thresholds.hard) return Difficulty.Hard;
  return Difficulty.Normal;
}

/** The displayed tier of a dealt board: its arrow count and nothing else. */
export function displayTier(level: Pick<GeneratedLevel, 'arrowCount'>): Difficulty {
  return displayTierForArrowCount(level.arrowCount);
}

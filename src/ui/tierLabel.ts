/**
 * W3-20 option (a) (TIER_LABEL_V2_ENABLED): which tier WORD the game header and the menu show. ON: the dealt
 * board's arrow count (core `displayTier`); OFF: the six-level cycle, exactly as before. Only the word and its
 * colour read this; generation, hearts, ads and everything else keep reading `Difficulties.forLevel`.
 */
import { Difficulties, displayTier, displayTierForArrowCount, SaveSystem, type Difficulty, type GeneratedLevel } from '../core';
import { TIER_LABEL_V2_ENABLED } from '../featureFlags';
import { generateCampaignLevel, levelGenVersion } from './gameSessionLifecycle';

/** The game header's tier for the board on screen (campaign or daily; the tutorial header shows no tier). */
export function headerTier(level: GeneratedLevel, enabled: boolean = TIER_LABEL_V2_ENABLED): Difficulty {
  return enabled ? displayTier(level) : level.difficulty;
}

/**
 * The arrow counts of boards the menu has already dealt, keyed by everything that selects the board:
 * level index, generator version and the install's switch level. Bounded, so a long session cannot grow it.
 */
const resumeArrows = new Map<string, number>();
const RESUME_CACHE_LIMIT = 8;

/** Test seam: the number of `generateCampaignLevel` calls the menu path has made. */
export const menuTierStats = { generations: 0 };

/** Test seam: forget every cached count (each test starts cold). */
export function clearMenuTierCache(): void {
  resumeArrows.clear();
  menuTierStats.generations = 0;
}

/**
 * The menu's tier for the level Play will resume. ON: the displayed tier of the exact board Play deals
 * (`levelGenVersion` and `generateCampaignLevel`, the same calls GameScreen makes), so the menu and the header
 * agree at every generator version and switch level. There is no cheaper source of a board's arrow count, so
 * the board is generated once per (index, version, switch level) and only its count is kept; the board itself
 * is dropped (GameScreen deals its own, mutable copy). OFF: the cycle, and nothing is generated.
 */
export function menuTier(resumeIndex: number, enabled: boolean = TIER_LABEL_V2_ENABLED): Difficulty {
  if (!enabled) return Difficulties.forLevel(resumeIndex);
  const version = levelGenVersion(resumeIndex);
  const key = `${resumeIndex}:${version}:${version === 2 ? SaveSystem.genSwitchLevel : '-'}`;
  let arrows = resumeArrows.get(key);
  if (arrows === undefined) {
    arrows = generateCampaignLevel(resumeIndex, version).arrowCount;
    menuTierStats.generations += 1;
    if (resumeArrows.size >= RESUME_CACHE_LIMIT) resumeArrows.clear();
    resumeArrows.set(key, arrows);
  }
  return displayTierForArrowCount(arrows);
}

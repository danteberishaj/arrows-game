/**
 * TF-01 A (META_THEME_SYSTEM): "Follow phone". Pure (no react-native import), so the rules are unit-tested in node
 * (src/ui/__tests__/themeFollow.test.ts) and through the real hydrate path (themeFollow.storage.test.ts). App.tsx
 * wires them: `bootTheme` once hydration settles, the Appearance listener while following, and the two writes (the
 * menu toggle, the Settings switch).
 *
 * The key, `arrows_theme_follows_system` (P-01 row 30): 1 = the theme is the phone's, 0 = the theme is
 * `arrows_dark_mode`. It is stamped ONCE, at the first healthy boot with the flag on (stampThemeFollowsSystem):
 * 1 only for a brand-new player (isBrandNewPlayer), else 0, so an existing player keeps exactly the theme they had.
 * With the flag OFF nothing here runs, and the key is never written.
 */

/** The part of SaveSystem the theme rules read and write. */
export interface ThemeSave {
  readonly persistenceHealthy: boolean;
  readonly currentLevel: number;
  readonly totalSolved: number;
  readonly ftueStage: number;
  /** Whether `arrows_dark_mode` was ever written (present, whatever its value). */
  readonly darkModeStored: boolean;
  readonly darkMode: boolean;
  /** Whether `arrows_theme_follows_system` holds any value. */
  readonly themeFollowsSystemStamped: boolean;
  readonly themeFollowsSystem: boolean;
  setThemeFollowsSystem(on: boolean): boolean;
}

export interface BrandNewInput {
  currentLevel: number;
  totalSolved: number;
  ftueStage: number;
  darkModeWritten: boolean;
}

/**
 * THE "brand-new player" rule: no campaign level reached (currentLevel 0), no board ever solved (totalSolved 0, which
 * also counts daily clears), no tutorial board cleared (ftueStage 0) and no theme ever chosen (`arrows_dark_mode`
 * absent; the menu toggle is its only writer). Every value must be exactly 0: a negative, fractional or non-finite
 * value is an unknown save, and an unknown save keeps its stored theme.
 */
export function isBrandNewPlayer({ currentLevel, totalSolved, ftueStage, darkModeWritten }: BrandNewInput): boolean {
  return currentLevel === 0 && totalSolved === 0 && ftueStage === 0 && !darkModeWritten;
}

/** The phone's scheme as React Native reports it: only 'dark' is dark; null, undefined or anything else is light. */
export function systemSchemeIsDark(scheme: string | null | undefined): boolean {
  return scheme === 'dark';
}

/**
 * Stamps `arrows_theme_follows_system` once, from the HYDRATED save. No-op (false) with the flag off, while
 * persistence is unhealthy (a stamp derived from in-memory defaults would mark an unread veteran save as brand new,
 * the same rule as stampGenSwitchLevel), or when the key already holds any value (a stamp is permanent; a later
 * choice is the player's, through the toggle or the Settings switch).
 */
export function stampThemeFollowsSystem(save: ThemeSave, enabled: boolean): boolean {
  if (!enabled || !save.persistenceHealthy || save.themeFollowsSystemStamped) return false;
  return save.setThemeFollowsSystem(
    isBrandNewPlayer({
      currentLevel: save.currentLevel,
      totalSolved: save.totalSolved,
      ftueStage: save.ftueStage,
      darkModeWritten: save.darkModeStored,
    }),
  );
}

/**
 * The theme App shows once hydration settles. Flag OFF: `arrows_dark_mode`, exactly as before (one read, no write,
 * the follow key never touched). Flag ON: stamp if needed, then the phone's scheme while following, else the stored
 * theme.
 */
export function bootTheme(
  save: ThemeSave,
  enabled: boolean,
  systemScheme: string | null | undefined,
): { dark: boolean; followsSystem: boolean } {
  if (!enabled) return { dark: save.darkMode, followsSystem: false };
  stampThemeFollowsSystem(save, enabled);
  const followsSystem = save.themeFollowsSystem;
  return { dark: followsSystem ? systemSchemeIsDark(systemScheme) : save.darkMode, followsSystem };
}

/** The two player writes (the menu toggle, the Settings switch). SaveSystem satisfies it. */
export interface ThemeChoiceSave {
  darkMode: boolean;
  setThemeFollowsSystem(on: boolean): boolean;
}

/**
 * The menu's sun/moon toggle was tapped: a manual choice always wins, so following stops (the key is written 0 only
 * when it was following). The toggle itself still flips the theme and writes arrows_dark_mode (useThemeToggle).
 * Returns the new follow state: false.
 */
export function stopFollowingForManualToggle(save: ThemeChoiceSave, following: boolean): false {
  if (following) save.setThemeFollowsSystem(false);
  return false;
}

/**
 * The Settings "Match phone theme" switch. ON: write 1; the theme follows the phone at once. OFF: store the theme now
 * on screen in arrows_dark_mode, then write 0, so the theme does not flip under the player's finger.
 */
export function applyFollowSwitch(save: ThemeChoiceSave, on: boolean, shownDark: boolean): boolean {
  if (!on) save.darkMode = shownDark;
  save.setThemeFollowsSystem(on);
  return on;
}

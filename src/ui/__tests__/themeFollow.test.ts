/**
 * TF-01 A (META_THEME_SYSTEM): the pure rules behind "Follow phone". The real hydrate path (AsyncStorage boundary)
 * is themeFollow.storage.test.ts's; the live swap on the phone's change closes only on the emulator captures in
 * artifacts/TF-01/.
 */
import {
  bootTheme,
  isBrandNewPlayer,
  stampThemeFollowsSystem,
  systemSchemeIsDark,
  type ThemeSave,
} from '../themeFollow';

const BRAND_NEW = { currentLevel: 0, totalSolved: 0, ftueStage: 0, darkModeWritten: false } as const;

describe('isBrandNewPlayer', () => {
  it('is true only with no progress, no tutorial stage and no theme choice', () => {
    expect(isBrandNewPlayer(BRAND_NEW)).toBe(true);
  });

  it.each([
    ['a campaign level', { currentLevel: 1 }],
    ['a solve', { totalSolved: 1 }],
    ['a tutorial stage', { ftueStage: 1 }],
    ['the done stage', { ftueStage: 3 }],
    ['a written theme (even light)', { darkModeWritten: true }],
  ])('is false after %s', (_name, change) => {
    expect(isBrandNewPlayer({ ...BRAND_NEW, ...change })).toBe(false);
  });

  it('is false for any corrupt (non-zero, negative or non-integer) value: an unknown save is treated as existing', () => {
    for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isBrandNewPlayer({ ...BRAND_NEW, currentLevel: bad })).toBe(false);
      expect(isBrandNewPlayer({ ...BRAND_NEW, totalSolved: bad })).toBe(false);
      expect(isBrandNewPlayer({ ...BRAND_NEW, ftueStage: bad })).toBe(false);
    }
  });
});

describe('systemSchemeIsDark', () => {
  it('only "dark" is dark; null, undefined and unknown values are light', () => {
    expect(systemSchemeIsDark('dark')).toBe(true);
    expect(systemSchemeIsDark('light')).toBe(false);
    expect(systemSchemeIsDark(null)).toBe(false);
    expect(systemSchemeIsDark(undefined)).toBe(false);
    expect(systemSchemeIsDark('unspecified')).toBe(false);
  });
});

/** A ThemeSave over a map that records every write. */
function fakeSave(init: Partial<Record<string, number>> = {}, healthy = true) {
  const map = new Map<string, number>(Object.entries(init) as [string, number][]);
  const writes: [string, number][] = [];
  const save: ThemeSave = {
    get persistenceHealthy() { return healthy; },
    get currentLevel() { return map.get('level') ?? 0; },
    get totalSolved() { return map.get('solved') ?? 0; },
    get ftueStage() { return map.get('stage') ?? 0; },
    get darkModeStored() { return map.has('dark'); },
    get darkMode() { return (map.get('dark') ?? 0) !== 0; },
    get themeFollowsSystemStamped() { return map.has('follow'); },
    get themeFollowsSystem() { return map.get('follow') === 1; },
    setThemeFollowsSystem(on: boolean) {
      writes.push(['follow', on ? 1 : 0]);
      map.set('follow', on ? 1 : 0);
      return true;
    },
  };
  return { save, map, writes };
}

describe('stampThemeFollowsSystem', () => {
  it('flag OFF: writes nothing, whatever the save', () => {
    const { save, writes } = fakeSave();
    expect(stampThemeFollowsSystem(save, false)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('unhealthy persistence: writes nothing (a value derived from defaults would be wrong)', () => {
    const { save, writes } = fakeSave({}, false);
    expect(stampThemeFollowsSystem(save, true)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('a brand-new player is stamped 1 (follow the phone), once', () => {
    const { save, writes } = fakeSave();
    expect(stampThemeFollowsSystem(save, true)).toBe(true);
    expect(stampThemeFollowsSystem(save, true)).toBe(false);
    expect(writes).toEqual([['follow', 1]]);
  });

  it('an existing player is stamped 0 (keep arrows_dark_mode)', () => {
    const { save, writes } = fakeSave({ level: 12, solved: 30, stage: 3, dark: 1 });
    expect(stampThemeFollowsSystem(save, true)).toBe(true);
    expect(writes).toEqual([['follow', 0]]);
  });

  it('a player who only chose a theme is stamped 0', () => {
    const { save, writes } = fakeSave({ dark: 0 });
    stampThemeFollowsSystem(save, true);
    expect(writes).toEqual([['follow', 0]]);
  });

  it('an already stamped key (any value) is never rewritten', () => {
    const { save, writes } = fakeSave({ follow: 7 });
    expect(stampThemeFollowsSystem(save, true)).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe('bootTheme', () => {
  it('flag OFF: today exactly (dark = arrows_dark_mode), no write, not following', () => {
    const { save, writes } = fakeSave({ dark: 1 });
    expect(bootTheme(save, false, 'light')).toEqual({ dark: true, followsSystem: false });
    expect(bootTheme(fakeSave().save, false, 'dark')).toEqual({ dark: false, followsSystem: false });
    expect(writes).toEqual([]);
  });

  it('flag ON, existing dark player on a light phone: stays dark, stamped 0', () => {
    const { save, writes } = fakeSave({ level: 5, solved: 9, stage: 3, dark: 1 });
    expect(bootTheme(save, true, 'light')).toEqual({ dark: true, followsSystem: false });
    expect(writes).toEqual([['follow', 0]]);
  });

  it('flag ON, brand-new player: follows the phone (dark phone -> dark, null -> light)', () => {
    expect(bootTheme(fakeSave().save, true, 'dark')).toEqual({ dark: true, followsSystem: true });
    expect(bootTheme(fakeSave().save, true, null)).toEqual({ dark: false, followsSystem: true });
  });

  it('flag ON, unhealthy persistence on a fresh store: no stamp, the stored theme (light), not following', () => {
    const { save, writes } = fakeSave({}, false);
    expect(bootTheme(save, true, 'dark')).toEqual({ dark: false, followsSystem: false });
    expect(writes).toEqual([]);
  });

  it('flag ON, a stamped 1 follows; a stamped 0 uses arrows_dark_mode', () => {
    expect(bootTheme(fakeSave({ follow: 1, dark: 1 }).save, true, 'light')).toEqual({ dark: false, followsSystem: true });
    expect(bootTheme(fakeSave({ follow: 0, dark: 1 }).save, true, 'light')).toEqual({ dark: true, followsSystem: false });
  });
});

describe('player choices', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { applyFollowSwitch, stopFollowingForManualToggle } = require('../themeFollow') as typeof import('../themeFollow');

  function choiceSave(dark: boolean) {
    const writes: [string, number][] = [];
    let stored = dark;
    const save = {
      get darkMode() { return stored; },
      set darkMode(v: boolean) { stored = v; writes.push(['dark', v ? 1 : 0]); },
      setThemeFollowsSystem(on: boolean) { writes.push(['follow', on ? 1 : 0]); return true; },
    };
    return { save, writes };
  }

  it('a manual toggle while following writes follow = 0 (a tap always wins)', () => {
    const { save, writes } = choiceSave(false);
    expect(stopFollowingForManualToggle(save, true)).toBe(false);
    expect(writes).toEqual([['follow', 0]]);
  });

  it('a manual toggle while not following writes nothing extra', () => {
    const { save, writes } = choiceSave(false);
    expect(stopFollowingForManualToggle(save, false)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('switch OFF keeps the shown theme: arrows_dark_mode = shown, then follow = 0', () => {
    const { save, writes } = choiceSave(false);
    expect(applyFollowSwitch(save, false, true)).toBe(false);
    expect(writes).toEqual([['dark', 1], ['follow', 0]]);
  });

  it('switch ON writes follow = 1 only (arrows_dark_mode untouched)', () => {
    const { save, writes } = choiceSave(true);
    expect(applyFollowSwitch(save, true, false)).toBe(true);
    expect(writes).toEqual([['follow', 1]]);
  });
});

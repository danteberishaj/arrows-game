/**
 * The defaults-OFF rule for player-visible flags (GLOBAL.md): every
 * `META_X = process.env.EXPO_PUBLIC_META_X === '1'` is false in a build that
 * does not set its variable, and setting one variable enables only that flag.
 * The rule is checked over every META_* export, so flags added later are
 * covered without editing this file; the named ones pin today's list.
 */

type Flags = Record<string, unknown>;

const NAMED_META_FLAGS = [
  'META_SKIN_PICKER',
  'META_REWARD_PATH',
  'META_REWARD_BOOK',
  'META_SEASONS', // HALLOWEEN-01
  'META_STREAK_FREEZE',
  'META_EXIT_TO_SCREEN_EDGE',
  'META_BOARD_GRID',
  'META_ZOOMED_CAMERA',
  'META_BANNER',
  'META_MISSED_MARK',
  'META_PRESS_SPRING',
  'META_LEVEL_TRANSITION', // W2-04
  'META_PANEL_MOTION', // W2-05
  'META_DAILY', // W4-06
  'META_GALLERY', // W4-09
  'META_REVIEW_PROMPT', // W4-11
  'META_BLOCKED_INK_HOLD', // W2-09
  'META_HEART_REFILL_POP', // W2-07
  'META_THEME_TRANSITION', // W2-08
  'META_POST_CLEAR_TIMELINE', // W2-06
];

const savedEnv = { ...process.env };

function clearMetaEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_META_')) delete process.env[key];
  }
}

function loadFlags(): Flags {
  let flags: Flags = {};
  jest.isolateModules(() => {
    flags = require('../featureFlags') as Flags;
  });
  return flags;
}

function metaFlagNames(flags: Flags): string[] {
  return Object.keys(flags).filter((name) => name.startsWith('META_')).sort();
}

afterEach(() => {
  process.env = { ...savedEnv };
});

test('every named player-visible flag exists and is a META_* export', () => {
  clearMetaEnv();
  const names = metaFlagNames(loadFlags());
  for (const name of NAMED_META_FLAGS) expect(names).toContain(name);
});

test('an unset variable gives every META_* flag false', () => {
  clearMetaEnv();
  const flags = loadFlags();
  for (const name of metaFlagNames(flags)) {
    expect([name, flags[name]]).toEqual([name, false]);
  }
});

test('EXPO_PUBLIC_META_LEVEL_TRANSITION=1 enables META_LEVEL_TRANSITION and nothing else', () => {
  clearMetaEnv();
  process.env.EXPO_PUBLIC_META_LEVEL_TRANSITION = '1';
  const flags = loadFlags();
  expect(flags.META_LEVEL_TRANSITION).toBe(true);
  for (const name of metaFlagNames(flags)) {
    if (name !== 'META_LEVEL_TRANSITION') expect([name, flags[name]]).toEqual([name, false]);
  }
});

test('only the exact value 1 enables it', () => {
  for (const value of ['0', 'true', 'yes', ' 1', '']) {
    clearMetaEnv();
    process.env.EXPO_PUBLIC_META_LEVEL_TRANSITION = value;
    expect([value, loadFlags().META_LEVEL_TRANSITION]).toEqual([value, false]);
  }
});

test.each(NAMED_META_FLAGS)('%s is enabled by its own variable alone', (name) => {
  clearMetaEnv();
  process.env[`EXPO_PUBLIC_${name}`] = '1';
  const flags = loadFlags();
  expect(flags[name]).toBe(true);
  for (const other of metaFlagNames(flags)) {
    expect([other, flags[other]]).toEqual([other, other === name]);
  }
});

test('ART_SKIN is absent unless explicitly selected', () => {
  delete process.env.EXPO_PUBLIC_ART_SKIN;
  expect(loadFlags().ART_SKIN).toBe(null);
});

test('ART_SKIN accepts only exact registered spec ids', () => {
  for (const value of ['0', 'true', '1', ' Cinnamon', 'cinnamon ', '', 'cinnamon', 'sherbet', 'Sherbet', 'unknown']) {
    process.env.EXPO_PUBLIC_ART_SKIN = value;
    expect([value, loadFlags().ART_SKIN]).toEqual([value, ['cinnamon', 'sherbet'].includes(value) ? value : null]);
  }
});

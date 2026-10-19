/**
 * NAV-BAR: plugins/withNavBarTheme.js is read at PREBUILD time. Unset flag (every normal build): the app config is
 * returned untouched, so the default build's navigation-bar contrast scrim is unchanged. Flag set: expo-navigation-bar's
 * plugin is applied with enforceContrast false (it records its props on `extra`, and its styles mod writes
 * android:enforceNavigationBarContrast=false; that output was checked with `npx expo config --type introspect`).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const withNavBarTheme = require('../../plugins/withNavBarTheme') as (config: Record<string, unknown>) => Record<string, unknown>;

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function baseConfig(): Record<string, unknown> {
  return { name: 'Arrows', slug: 'arrows' };
}

test('flag unset: the config comes back untouched (same object, no extra, no mods)', () => {
  delete process.env.EXPO_PUBLIC_META_NAV_BAR_THEME;
  const config = baseConfig();
  const out = withNavBarTheme(config);
  expect(out).toBe(config);
  expect(out).toEqual({ name: 'Arrows', slug: 'arrows' });
});

test('flag set to anything but "1": untouched', () => {
  process.env.EXPO_PUBLIC_META_NAV_BAR_THEME = 'true';
  const config = baseConfig();
  expect(withNavBarTheme(config)).toEqual({ name: 'Arrows', slug: 'arrows' });
});

test('flag "1": expo-navigation-bar applied with enforceContrast false and a styles mod registered', () => {
  process.env.EXPO_PUBLIC_META_NAV_BAR_THEME = '1';
  const out = withNavBarTheme(baseConfig()) as { extra?: Record<string, unknown>; mods?: { android?: Record<string, unknown> } };
  expect(out.extra?.['expo-navigation-bar']).toEqual({ enforceContrast: false });
  expect(typeof out.mods?.android?.styles).toBe('function');
});

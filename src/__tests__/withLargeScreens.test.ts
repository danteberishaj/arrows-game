/**
 * TF-03: plugins/withLargeScreens.js is read at PREBUILD time. Unset flag (every normal build): the app config comes
 * back untouched, so the default build keeps MainActivity's android:screenOrientation="portrait" from app.json. Flag
 * "1": the manifest attribute is removed and MainActivity.onCreate locks PHONES (smallest width < 600 dp) to portrait
 * at runtime, before super.onCreate. The fixtures are the real files `expo prebuild` generated for this app
 * (android/app/src/main/..., copied 2026-10-13).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as path from 'path';

type Config = Record<string, unknown> & { mods?: { android?: Record<string, ModFn> } };
type ModFn = (config: Record<string, unknown>) => Promise<Record<string, unknown> & { modResults: unknown }>;

const plugin = require('../../plugins/withLargeScreens') as ((config: Config) => Config) & {
  addPhonePortraitLock: (contents: string) => string;
  removeScreenOrientation: <T>(manifest: T) => T;
  PHONE_LOCK_TAG: string;
  RELOCK_TAG: string;
};
const { AndroidConfig } = require('expo/config-plugins') as typeof import('expo/config-plugins');

const FIXTURES = path.join(__dirname, 'fixtures');
const mainActivityFixture = fs.readFileSync(path.join(FIXTURES, 'MainActivity.generated.kt'), 'utf8');
const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function baseConfig(): Config {
  return { name: 'Arrows', slug: 'arrows', orientation: 'portrait' };
}

async function readManifestFixture() {
  return AndroidConfig.Manifest.readAndroidManifestAsync(path.join(FIXTURES, 'AndroidManifest.generated.xml'));
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Runs a registered mod the way `expo prebuild` does, with an identity nextMod. */
async function runMod(config: Config, name: string, modResults: unknown) {
  const mod = config.mods?.android?.[name];
  if (!mod) throw new Error(`no android.${name} mod registered`);
  const out = await mod({
    ...config,
    modResults,
    modRequest: { platform: 'android', modName: name, projectRoot: '/tmp/x', platformProjectRoot: '/tmp/x/android', introspect: false },
  });
  return out.modResults;
}

test('the fixtures are what the default build ships: portrait in the manifest, no orientation code', async () => {
  const manifest = await readManifestFixture();
  expect(AndroidConfig.Manifest.getMainActivityOrThrow(manifest).$['android:screenOrientation']).toBe('portrait');
  expect(mainActivityFixture).not.toMatch(/requestedOrientation|ActivityInfo/);
  expect(count(mainActivityFixture, 'super.onCreate(')).toBe(1);
});

test('flag unset: the config comes back untouched (same object, no mods)', () => {
  delete process.env.EXPO_PUBLIC_META_LARGE_SCREENS;
  const config = baseConfig();
  const out = plugin(config);
  expect(out).toBe(config);
  expect(out).toEqual({ name: 'Arrows', slug: 'arrows', orientation: 'portrait' });
});

test('flag set to anything but "1": untouched', () => {
  process.env.EXPO_PUBLIC_META_LARGE_SCREENS = 'true';
  const config = baseConfig();
  expect(plugin(config)).toBe(config);
  expect(config.mods).toBeUndefined();
});

test('flag "1": the manifest mod removes screenOrientation from MainActivity only', async () => {
  process.env.EXPO_PUBLIC_META_LARGE_SCREENS = '1';
  const out = plugin(baseConfig());
  expect(out.orientation).toBe('portrait'); // app.json keeps portrait; only the native manifest changes
  const manifest = await readManifestFixture();
  const before = JSON.parse(JSON.stringify(manifest));
  const result = (await runMod(out, 'manifest', manifest)) as typeof manifest;
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(result);
  expect(activity.$['android:screenOrientation']).toBeUndefined();
  // Everything else on the activity is unchanged (configChanges keep orientation|screenSize: no recreation on rotate).
  const { 'android:screenOrientation': removed, ...restBefore } = AndroidConfig.Manifest.getMainActivityOrThrow(before).$;
  expect(removed).toBe('portrait');
  expect(activity.$).toEqual(restBefore);
  expect(activity.$['android:configChanges']).toContain('smallestScreenSize');
});

test('flag "1": the MainActivity mod inserts the phone lock exactly once, before super.onCreate', async () => {
  process.env.EXPO_PUBLIC_META_LARGE_SCREENS = '1';
  const out = plugin(baseConfig());
  const result = (await runMod(out, 'mainActivity', { contents: mainActivityFixture, language: 'kt', path: 'MainActivity.kt' })) as {
    contents: string;
  };
  const src = result.contents;
  expect(count(src, plugin.PHONE_LOCK_TAG)).toBe(2); // begin + end markers
  expect(count(src, 'requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT')).toBe(1);
  expect(count(src, 'if (resources.configuration.smallestScreenWidthDp < 600) {')).toBe(1);
  expect(count(src, 'import android.content.pm.ActivityInfo')).toBe(1);
  const lock = src.indexOf('requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT');
  const onCreate = src.indexOf('override fun onCreate(');
  const superCall = src.indexOf('super.onCreate(');
  expect(onCreate).toBeGreaterThan(-1);
  expect(lock).toBeGreaterThan(onCreate);
  expect(lock).toBeLessThan(superCall);
  // Nothing else changed: dropping the tagged blocks and the imports gives back the fixture byte for byte.
  const stripped = src
    .replace(/^[ \t]*\/\/ @generated begin arrows-large-screens[\s\S]*?\/\/ @generated end arrows-large-screens\n/m, '')
    .replace(/\n[ \t]*\/\/ @generated begin arrows-fold-relock[\s\S]*?\/\/ @generated end arrows-fold-relock\n/, '')
    .replace('import android.content.pm.ActivityInfo\n', '')
    .replace('import android.content.res.Configuration\n', '');
  expect(stripped).toBe(mainActivityFixture);
  // No API deprecated in Android 15 (status/nav bar colour setters).
  expect(src).not.toMatch(/setStatusBarColor|setNavigationBarColor|setNavigationBarDividerColor/);
});

test('flag "1": a fold that changes size without recreating the activity re-checks the phone lock', async () => {
  // R11-9 (2026-10-29, Pixel 8 Pro AVD, API 36): `wm size` sw600 -> sw448 at unchanged density kept the same
  // ActivityRecord (configChanges lists screenSize|smallestScreenSize), requestedOrientation stayed UNSPECIFIED and a
  // landscape request rotated the display on a phone-size screen. onCreate alone never sees that change.
  process.env.EXPO_PUBLIC_META_LARGE_SCREENS = '1';
  const out = plugin(baseConfig());
  const result = (await runMod(out, 'mainActivity', { contents: mainActivityFixture, language: 'kt', path: 'MainActivity.kt' })) as {
    contents: string;
  };
  const src = result.contents;
  expect(count(src, plugin.RELOCK_TAG)).toBe(2);
  expect(count(src, 'override fun onConfigurationChanged(newConfig: Configuration) {')).toBe(1);
  expect(count(src, 'import android.content.res.Configuration')).toBe(1);
  const handler = src.slice(src.indexOf('override fun onConfigurationChanged('), src.indexOf(`// @generated end ${plugin.RELOCK_TAG}`));
  // super first (ReactActivity forwards the change to React Native), then the same < 600 dp line as onCreate, both ways:
  // folding to a phone screen locks portrait, unfolding to a large screen releases it.
  expect(handler.indexOf('super.onConfigurationChanged(newConfig)')).toBeGreaterThan(-1);
  expect(handler.indexOf('super.onConfigurationChanged(newConfig)')).toBeLessThan(handler.indexOf('requestedOrientation'));
  expect(handler).toMatch(/if \(newConfig\.smallestScreenWidthDp < 600\) ActivityInfo\.SCREEN_ORIENTATION_PORTRAIT/);
  expect(handler).toMatch(/else ActivityInfo\.SCREEN_ORIENTATION_UNSPECIFIED/);
  expect(handler).toMatch(/if \(requestedOrientation != want\) requestedOrientation = want/);
  // The override is a member of MainActivity: it sits after onCreate, and the class's closing brace still ends the file.
  expect(src.indexOf('override fun onConfigurationChanged(')).toBeGreaterThan(src.indexOf('override fun invokeDefaultOnBackPressed('));
  expect(src.trimEnd().endsWith('\n}')).toBe(true);
});

test('the insertion is idempotent: applying it to its own output changes nothing', () => {
  const once = plugin.addPhonePortraitLock(mainActivityFixture);
  expect(plugin.addPhonePortraitLock(once)).toBe(once);
});

test('a missing anchor throws a clear error instead of shipping an unlocked phone build', () => {
  const noSuper = mainActivityFixture.replace('super.onCreate(null)', 'super.onCreateSomethingElse()');
  expect(() => plugin.addPhonePortraitLock(noSuper)).toThrow(/withLargeScreens: .*super\.onCreate/);
  const noOnCreate = mainActivityFixture.replace('override fun onCreate(', 'override fun onStart(');
  expect(() => plugin.addPhonePortraitLock(noOnCreate)).toThrow(/withLargeScreens: .*onCreate/);
  const noPackage = mainActivityFixture.replace(/^package .*$/m, '');
  expect(() => plugin.addPhonePortraitLock(noPackage)).toThrow(/withLargeScreens: .*package/);
  const noClassEnd = mainActivityFixture.trimEnd().replace(/\n\}$/, '\n  }');
  expect(() => plugin.addPhonePortraitLock(noClassEnd)).toThrow(/withLargeScreens: .*closing brace/);
  const ownHandler = mainActivityFixture.replace('  override fun getMainComponentName', '  override fun onConfigurationChanged(c: Configuration) {}\n  override fun getMainComponentName');
  expect(() => plugin.addPhonePortraitLock(ownHandler)).toThrow(/withLargeScreens: .*onConfigurationChanged/);
});

test('a Java MainActivity throws (the snippet is Kotlin)', async () => {
  process.env.EXPO_PUBLIC_META_LARGE_SCREENS = '1';
  const out = plugin(baseConfig());
  await expect(runMod(out, 'mainActivity', { contents: mainActivityFixture, language: 'java', path: 'MainActivity.java' })).rejects.toThrow(
    /withLargeScreens: .*Kotlin/,
  );
});

test('a manifest without a main activity throws', () => {
  expect(() => plugin.removeScreenOrientation({ manifest: { $: {}, application: [{ $: {}, activity: [] }] } })).toThrow();
});

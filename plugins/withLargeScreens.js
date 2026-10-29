const { AndroidConfig, withAndroidManifest, withMainActivity } = require('expo/config-plugins');

/**
 * TF-03 (META_LARGE_SCREENS): Play Console flagged 1.0.0 (18) for "resizability and orientation restrictions" that
 * hurt large screens. app.json's `"orientation": "portrait"` becomes `android:screenOrientation="portrait"` on
 * MainActivity, which locks tablets, foldables and Chromebooks too. Google's recommended pattern is to restrict only
 * small screens, at runtime. With the flag on this plugin:
 *   1. removes `android:screenOrientation` from MainActivity in the AndroidManifest (app.json keeps "portrait", so the
 *      default build is unchanged and iOS is untouched);
 *   2. inserts, in `MainActivity.onCreate` BEFORE `super.onCreate`, a request for portrait when the smallest width is
 *      under 600 dp (Android's own phone / tablet line, the `sw600dp` resource qualifier), so phones stay portrait;
 *   3. adds `MainActivity.onConfigurationChanged`, which re-checks that line. MainActivity's configChanges list
 *      screenSize|smallestScreenSize, so a fold or resize that keeps density reaches it without recreating the
 *      activity and onCreate never re-runs (R11-9, 2026-10-29: a size-only fold left a phone-size screen rotatable).
 * No Android 15-deprecated API (status / navigation bar colour setters) is used.
 *
 * Read at PREBUILD time. Unset (every normal build): the config comes back untouched. scripts/build/native-fingerprint.sh
 * hashes EXPO_PUBLIC_META_LARGE_SCREENS because this file names it, so a flip forces a clean prebuild.
 */
const PHONE_LOCK_TAG = 'arrows-large-screens';
const RELOCK_TAG = 'arrows-fold-relock';
const ACTIVITY_INFO_IMPORT = 'import android.content.pm.ActivityInfo';
const CONFIGURATION_IMPORT = 'import android.content.res.Configuration';

function removeScreenOrientation(androidManifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  if (activity.$) delete activity.$['android:screenOrientation'];
  return androidManifest;
}

function fail(message) {
  throw new Error(`withLargeScreens: ${message}. MainActivity.kt changed shape; update plugins/withLargeScreens.js.`);
}

function addImport(contents, line) {
  if (new RegExp(`^${line.replace(/\./g, '\\.')}$`, 'm').test(contents)) return contents;
  const pkg = /^package [^\n]*\n/m.exec(contents);
  if (!pkg) fail('no `package` line found in MainActivity');
  const at = pkg.index + pkg[0].length;
  return contents.slice(0, at) + line + '\n' + contents.slice(at);
}

/** Idempotent: a file that already carries both tagged blocks comes back unchanged. */
function addPhonePortraitLock(contents) {
  return addFoldRelock(addOnCreateLock(contents));
}

function addOnCreateLock(contents) {
  if (contents.includes(`@generated begin ${PHONE_LOCK_TAG}`)) return contents;
  const onCreate = contents.indexOf('override fun onCreate(');
  if (onCreate < 0) fail('no `override fun onCreate(` found in MainActivity');
  const superCall = contents.indexOf('super.onCreate(', onCreate);
  if (superCall < 0) fail('no `super.onCreate(` call found after onCreate in MainActivity');
  const lineStart = contents.lastIndexOf('\n', superCall) + 1;
  const indent = contents.slice(lineStart, superCall);
  if (!/^[ \t]*$/.test(indent)) fail('`super.onCreate(` does not start its own line in MainActivity');
  const block = [
    `// @generated begin ${PHONE_LOCK_TAG} - plugins/withLargeScreens.js (META_LARGE_SCREENS)`,
    '// Phones (smallest width < 600 dp) stay portrait; tablets, foldables and Chromebooks may rotate and resize.',
    'if (resources.configuration.smallestScreenWidthDp < 600) {',
    '  requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT',
    '}',
    `// @generated end ${PHONE_LOCK_TAG}`,
  ]
    .map((line) => indent + line + '\n')
    .join('');
  return addImport(contents.slice(0, lineStart) + block + contents.slice(lineStart), ACTIVITY_INFO_IMPORT);
}

/** Appends the onConfigurationChanged override as the last member of MainActivity (before the file's closing brace). */
function addFoldRelock(contents) {
  if (contents.includes(`@generated begin ${RELOCK_TAG}`)) return contents;
  if (contents.includes('fun onConfigurationChanged(')) fail('MainActivity already overrides onConfigurationChanged');
  const classEnd = /\n\}\s*$/.exec(contents);
  if (!classEnd) fail('no closing brace of MainActivity at column 0 at the end of the file');
  const block = [
    '',
    `// @generated begin ${RELOCK_TAG} - plugins/withLargeScreens.js (META_LARGE_SCREENS)`,
    '// A fold or resize that keeps density does not recreate this activity, so onCreate never re-runs: re-check the',
    '// phone line here. Folding to a phone screen locks portrait; unfolding to a large screen releases the lock.',
    'override fun onConfigurationChanged(newConfig: Configuration) {',
    '  super.onConfigurationChanged(newConfig)',
    '  val want = if (newConfig.smallestScreenWidthDp < 600) ActivityInfo.SCREEN_ORIENTATION_PORTRAIT',
    '    else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED',
    '  if (requestedOrientation != want) requestedOrientation = want',
    '}',
    `// @generated end ${RELOCK_TAG}`,
  ]
    .map((line) => (line ? '  ' + line : '') + '\n')
    .join('');
  const out = contents.slice(0, classEnd.index + 1) + block + contents.slice(classEnd.index + 1);
  return addImport(addImport(out, ACTIVITY_INFO_IMPORT), CONFIGURATION_IMPORT);
}

module.exports = function withLargeScreens(config) {
  if (process.env.EXPO_PUBLIC_META_LARGE_SCREENS !== '1') return config;
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = removeScreenOrientation(cfg.modResults);
    return cfg;
  });
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') fail(`MainActivity is ${cfg.modResults.language}, the snippet is Kotlin`);
    cfg.modResults.contents = addPhonePortraitLock(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.addPhonePortraitLock = addPhonePortraitLock;
module.exports.removeScreenOrientation = removeScreenOrientation;
module.exports.PHONE_LOCK_TAG = PHONE_LOCK_TAG;
module.exports.RELOCK_TAG = RELOCK_TAG;

const { AndroidConfig, withAndroidManifest, withMainActivity } = require('expo/config-plugins');

/**
 * TF-03 (META_LARGE_SCREENS): Play Console flagged 1.0.0 (18) for "resizability and orientation restrictions" that
 * hurt large screens. app.json's `"orientation": "portrait"` becomes `android:screenOrientation="portrait"` on
 * MainActivity, which locks tablets, foldables and Chromebooks too. Google's recommended pattern is to restrict only
 * small screens, at runtime. With the flag on this plugin:
 *   1. removes `android:screenOrientation` from MainActivity in the AndroidManifest (app.json keeps "portrait", so the
 *      default build is unchanged and iOS is untouched);
 *   2. inserts, in `MainActivity.onCreate` BEFORE `super.onCreate`, a request for portrait when the smallest width is
 *      under 600 dp (Android's own phone / tablet line, the `sw600dp` resource qualifier), so phones stay portrait.
 * No Android 15-deprecated API (status / navigation bar colour setters) is used.
 *
 * Read at PREBUILD time. Unset (every normal build): the config comes back untouched. scripts/build/native-fingerprint.sh
 * hashes EXPO_PUBLIC_META_LARGE_SCREENS because this file names it, so a flip forces a clean prebuild.
 */
const PHONE_LOCK_TAG = 'arrows-large-screens';
const ACTIVITY_INFO_IMPORT = 'import android.content.pm.ActivityInfo';

function removeScreenOrientation(androidManifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  if (activity.$) delete activity.$['android:screenOrientation'];
  return androidManifest;
}

function fail(message) {
  throw new Error(`withLargeScreens: ${message}. MainActivity.kt changed shape; update plugins/withLargeScreens.js.`);
}

/** Idempotent: a file that already carries the tagged block comes back unchanged. */
function addPhonePortraitLock(contents) {
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
  let out = contents.slice(0, lineStart) + block + contents.slice(lineStart);
  if (!new RegExp(`^${ACTIVITY_INFO_IMPORT.replace(/\./g, '\\.')}$`, 'm').test(out)) {
    const pkg = /^package [^\n]*\n/m.exec(out);
    if (!pkg) fail('no `package` line found in MainActivity');
    const at = pkg.index + pkg[0].length;
    out = out.slice(0, at) + ACTIVITY_INFO_IMPORT + '\n' + out.slice(at);
  }
  return out;
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

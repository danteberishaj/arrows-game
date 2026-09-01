const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Wires the Play upload keystore into the release build. The keystore and its
 * passwords live in PROJECT_ROOT/credentials/ (gitignored) — outside android/,
 * which `expo prebuild` regenerates and would wipe. This plugin re-applies the
 * release signing config on every prebuild, so no manual gradle editing is
 * ever needed. When credentials/ is absent (CI, fresh clone) release builds
 * fall back to the debug keystore, matching Expo's default template.
 *
 * Idempotent: guarded by a marker so re-running prebuild doesn't duplicate.
 */

const MARKER = '// arrows upload keystore (withUploadKeystore)';

const SIGNING_CONFIG = `
        ${MARKER}
        def keystorePropsFile = rootProject.file('../credentials/keystore.properties')
        if (keystorePropsFile.exists()) {
            def keystoreProps = new Properties()
            keystorePropsFile.withInputStream { keystoreProps.load(it) }
            release {
                storeFile rootProject.file("../credentials/\${keystoreProps['ARROWS_UPLOAD_STORE_FILE']}")
                storePassword keystoreProps['ARROWS_UPLOAD_STORE_PASSWORD']
                keyAlias keystoreProps['ARROWS_UPLOAD_KEY_ALIAS']
                keyPassword keystoreProps['ARROWS_UPLOAD_KEY_PASSWORD']
            }
        }`;

function applySigning(buildGradle) {
  if (buildGradle.includes(MARKER)) return buildGradle;

  const debugConfig = /signingConfigs\s*\{\s*\n\s*debug\s*\{[^}]*\}/;
  if (!debugConfig.test(buildGradle)) {
    throw new Error('withUploadKeystore: could not find signingConfigs.debug block');
  }
  let out = buildGradle.replace(debugConfig, (match) => `${match}${SIGNING_CONFIG}`);

  const releaseAssignment = /(release\s*\{[^{]*?)signingConfig signingConfigs\.debug/;
  if (!releaseAssignment.test(out)) {
    throw new Error('withUploadKeystore: could not find buildTypes.release signingConfig assignment');
  }
  out = out.replace(
    releaseAssignment,
    `$1signingConfig rootProject.file('../credentials/keystore.properties').exists() ? signingConfigs.release : signingConfigs.debug`
  );
  return out;
}

module.exports = function withUploadKeystore(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(`withUploadKeystore: expected groovy build.gradle, got ${cfg.modResults.language}`);
    }
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};

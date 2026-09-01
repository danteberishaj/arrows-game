const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * unity-levelplay-mediation (9.x) requires these Google Play Services
 * dependencies in the app module's build.gradle — the mediation SDK relies on
 * them for the advertising / app-set identifiers but does not bundle them
 * itself. In a managed Expo workflow android/ is generated on every prebuild,
 * so we inject the deps through this config plugin instead of editing the file
 * by hand.
 *
 * Idempotent: guarded by a marker comment so a second prebuild (or a re-run
 * over an already-patched file) doesn't duplicate the block.
 */

const MARKER = '// unity-levelplay-mediation play-services deps';

const DEPS = [
  "com.google.android.gms:play-services-appset:16.0.2",
  "com.google.android.gms:play-services-ads-identifier:18.0.1",
  "com.google.android.gms:play-services-basement:18.3.0",
];

function addDependencies(buildGradle) {
  if (buildGradle.includes(MARKER)) {
    return buildGradle; // already patched — don't duplicate
  }

  const block = [
    MARKER,
    ...DEPS.map((coord) => `    implementation "${coord}"`),
  ].join('\n');

  // Insert just inside the top-level `dependencies {` block.
  const anchor = /dependencies\s*\{/;
  if (!anchor.test(buildGradle)) {
    throw new Error(
      "withLevelPlay: could not find a `dependencies {` block in app/build.gradle"
    );
  }

  return buildGradle.replace(anchor, (match) => `${match}\n${block}`);
}

module.exports = function withLevelPlay(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withLevelPlay: expected a groovy build.gradle, got ${cfg.modResults.language}`
      );
    }
    cfg.modResults.contents = addDependencies(cfg.modResults.contents);
    return cfg;
  });
};

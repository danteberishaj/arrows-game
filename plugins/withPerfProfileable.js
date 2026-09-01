const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Allows `dumpsys gfxinfo` and shell profilers to inspect the non-debuggable
 * release benchmark. Normal app builds are unchanged.
 */
function addProfileable(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) {
    throw new Error('withPerfProfileable: AndroidManifest has no <application> element');
  }
  application.profileable = [{ $: { 'android:shell': 'true' } }];
  return androidManifest;
}

module.exports = function withPerfProfileable(config) {
  if (process.env.ARROWS_PERF_BUILD !== '1') return config;
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = addProfileable(cfg.modResults);
    return cfg;
  });
};

module.exports.addProfileable = addProfileable;

// app.plugin.js re-exports the compiled ES module, whose plugin is its `default` export.
const navigationBarPlugin = require('expo-navigation-bar/app.plugin.js');
const withNavigationBar = navigationBarPlugin.default ?? navigationBarPlugin;

/**
 * NAV-BAR (META_NAV_BAR_THEME): turn off Android's navigation-bar contrast scrim, so the transparent edge-to-edge bar
 * shows the game's own background and expo-navigation-bar's `setStyle` (App.tsx `<NavigationBar>`) colours the
 * buttons for the game's theme. Measured on emulator-5556 (API 31, 3-button): with the scrim on, `setStyle` changes
 * the legacy flag but the window's appearance stops following it after launch, so a theme toggle left a light bar
 * under Ink Night (bar vs content 15.25:1; docs/next-level/reports/NAV-BAR.md).
 *
 * Read at PREBUILD time, gated on the same env flag as the JS side. Unset (every normal build): nothing changes, and
 * the scrim keeps the default build's buttons readable. scripts/build/native-fingerprint.sh hashes this flag because
 * this file names it, so a flip forces a clean prebuild.
 */
module.exports = function withNavBarTheme(config) {
  if (process.env.EXPO_PUBLIC_META_NAV_BAR_THEME !== '1') return config;
  return withNavigationBar(config, { enforceContrast: false });
};

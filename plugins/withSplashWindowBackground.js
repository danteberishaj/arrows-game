const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

/**
 * ICON-01: the window behind React Native is the splash violet, not AppTheme's default white. Between the native
 * splash (expo-splash-screen, violet) and React's first frame (the violet "Stage" intro, SplashScreen.tsx) Android
 * shows the window background; it was white, a flash measured on emulator-5556 (artifacts/ICON-01/splash/run2).
 * Every screen draws its own background over it.
 */
module.exports = function withSplashWindowBackground(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:windowBackground',
      value: '@color/splashscreen_background',
    });
    return cfg;
  });
};

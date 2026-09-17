import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { initRemoteConfig } from './src/config/remoteConfig';
import { SaveSystem } from './src/core/saveSystem';
import {
  CAPTURE_DIAG_ENABLED,
  PERF_FEEDBACK,
  PERF_LEVEL_INDEX,
  PERF_MODE,
  PERF_SCREEN,
  reducedMotionDiagLabel,
} from './src/perfMode';
import { AdHost, adInitController, initAds } from './src/ui/ads';
import { GameScreen } from './src/ui/GameScreen';
import { HomeScreen } from './src/ui/HomeScreen';
import { SplashScreen } from './src/ui/SplashScreen';
import { ensureIdentity, nextSessionIndex } from './src/telemetry/identity';
import { initSaveSystem } from './src/ui/storage';
import { paletteFor } from './src/ui/theme';

type Screen = 'splash' | 'menu' | 'game';

export default function App() {
  const [ready, setReady] = useState(PERF_MODE);
  const [fontsLoaded, fontError] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold });
  // A font-load error must not leave a blank screen: fall back to the platform font.
  const fontsReady = fontsLoaded || fontError != null;
  // A PERF build opens on EXPO_PUBLIC_PERF_SCREEN (default game, P-02 Stage A).
  const [screen, setScreen] = useState<Screen>(PERF_MODE ? PERF_SCREEN : 'splash');
  const [dark, setDark] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  // Capture diagnostic (P-02 Stage B, ruling F01): Reanimated's own value,
  // read once at app start, exposed only in PERF or EXPO_PUBLIC_CAPTURE_DIAG builds.
  const diagLabel = reducedMotionDiagLabel(CAPTURE_DIAG_ENABLED, useReducedMotion());

  useEffect(() => {
    // uiautomator cannot dump a screen that animates forever (the menu's Play
    // pill at scale 1), so the harness can also read this line from logcat.
    if (diagLabel) console.log(`[capture-diag] ${diagLabel} screen=${screen}`);
  }, [diagLabel, screen]);

  useEffect(() => {
    if (PERF_MODE) return;
    // Ads start only after hydration settles, so a remote kill persisted by an
    // earlier session is already seeded when initAds() decides whether to call
    // LevelPlay.init (W6-02). Before hydration SaveSystem reads its in-memory
    // store, where every kill bit is 0. The remote config fetch never blocks it.
    const startAfterHydration = () => {
      initRemoteConfig().catch(() => {}); // seeds the kill bits synchronously, then fetches
      initAds().catch(() => {}); // no-op in Expo Go / web (simulated ads take over)
    };
    // No timeout here: `ready` must never come before hydration settles, or a later
    // SaveSystem.useStore swap could write an in-memory level-1 session over real
    // progress. On a rejection SaveSystem keeps its in-memory store, which never
    // writes to AsyncStorage, so saved progress cannot be overwritten.
    initSaveSystem()
      .then(() => {
        setDark(SaveSystem.darkMode);
        setSoundOn(SaveSystem.soundOn);
        // Install id + session count (W6-05): nothing sends these anywhere
        // yet (W6-14 is the first reader), and this whole effect already
        // returns above under PERF_MODE, so a benchmark run never writes them.
        ensureIdentity(SaveSystem);
        nextSessionIndex(SaveSystem);
        setReady(true);
        startAfterHydration();
      })
      .catch(() => {
        setReady(true);
        startAfterHydration();
      });
    // A device that launched offline recovers ads when the player comes back.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') adInitController.onAppActive();
    });
    return () => sub.remove();
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      SaveSystem.soundOn = !on;
      return !on;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setDark((d) => {
      SaveSystem.darkMode = !d;
      return !d;
    });
  }, []);

  const p = paletteFor(dark);

  if (!ready || !fontsReady) {
    return <View accessibilityLabel={diagLabel} style={{ flex: 1, backgroundColor: p.bg }} />;
  }

  // Screens cross-fade (~180 ms) instead of hard-cutting (DESIGN.md "Motion").
  return (
    <SafeAreaProvider>
    <GestureHandlerRootView accessibilityLabel={diagLabel} style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {screen === 'splash' && <SplashScreen palette={p} onDone={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(180)}>
          <HomeScreen
            palette={p}
            dark={dark}
            soundOn={soundOn}
            onPlay={() => setScreen('game')}
            onToggleSound={toggleSound}
            onToggleTheme={toggleTheme}
          />
        </Animated.View>
      )}
      {screen === 'game' && (
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(180)}>
          <GameScreen
            palette={p}
            initialLevelIndex={PERF_LEVEL_INDEX ?? undefined}
            benchmarkMode={PERF_MODE}
            feedbackEnabled={!PERF_MODE || PERF_FEEDBACK}
            onHome={() => setScreen('menu')}
          />
        </Animated.View>
      )}
      {!PERF_MODE && __DEV__ && <AdHost palette={p} />}
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

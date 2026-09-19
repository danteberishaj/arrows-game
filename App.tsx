import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { initRemoteConfig, RemoteConfig } from './src/config/remoteConfig';
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
import { appLevelAggregator } from './src/telemetry/levelAggregator';
import { bucketOf, ensureIdentity, nextSessionIndex } from './src/telemetry/identity';
import { createMemorySink, Telemetry } from './src/telemetry/telemetry';
import { initSaveSystem } from './src/ui/storage';
import { paletteFor } from './src/ui/theme';

type Screen = 'splash' | 'menu' | 'game';

Telemetry.configure({ disabled: PERF_MODE });

const PERF_TELEMETRY_TIMING =
  process.env.EXPO_PUBLIC_PERF_TELEMETRY_TIMING === '1';
const perfTelemetrySink = PERF_TELEMETRY_TIMING
  ? createMemorySink(1) // OWNER-PICKED STARTING VALUE: only the disabled-count check reads it.
  : null;
if (perfTelemetrySink) {
  Telemetry.useSink(perfTelemetrySink);
} else if (__DEV__) {
  Telemetry.useSink((event) => {
    console.log(`[telemetry] ${JSON.stringify(event)}`);
  });
}

function telemetryScreen(screen: Screen | 'daily' | 'gallery'): 'splash' | 'menu' | 'game' {
  if (screen === 'daily') return 'game';
  if (screen === 'gallery') return 'menu';
  return screen;
}

function syncTelemetryDisabled(): void {
  Telemetry.configure({ disabled: PERF_MODE || RemoteConfig.telemetryKilled() });
}

const perfTelemetryUnmountProbe = perfTelemetrySink
  ? () => console.log(`[telemetry-perf] sinkCount=${perfTelemetrySink.events.length}`)
  : undefined;

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
      syncTelemetryDisabled();
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
        // Install id + session count (W6-05). This whole effect returns above
        // under PERF_MODE, so a benchmark run never writes them.
        const identity = ensureIdentity(SaveSystem);
        const sessionIndex = nextSessionIndex(SaveSystem);
        const bucket = bucketOf(identity.hi, identity.lo);
        Telemetry.configure({ sessionIndex, bucket });
        startAfterHydration();
        Telemetry.emit('app_open', {
          cold: true,
          sessionIndex,
          appVersion: Constants.expoConfig?.version ?? 'unknown',
          bucket,
        });
        Telemetry.emit('screen_view', { screen: telemetryScreen(screen) });
        setReady(true);
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

  useEffect(() => RemoteConfig.subscribe(syncTelemetryDisabled), []);

  // Deliberately separate from W0-02's ad-retry AppState listener above.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') appLevelAggregator.sessionEnd(Date.now());
    });
    return () => sub.remove();
  }, []);

  const showScreen = useCallback((next: Screen) => {
    Telemetry.emit('screen_view', { screen: telemetryScreen(next) });
    setScreen(next);
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
      {screen === 'splash' && <SplashScreen palette={p} onDone={() => showScreen('menu')} />}
      {screen === 'menu' && (
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(180)}>
          <HomeScreen
            palette={p}
            dark={dark}
            soundOn={soundOn}
            onPlay={() => showScreen('game')}
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
            onTelemetryProbeUnmount={perfTelemetryUnmountProbe}
            onHome={() => showScreen('menu')}
          />
        </Animated.View>
      )}
      {!PERF_MODE && __DEV__ && <AdHost palette={p} />}
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

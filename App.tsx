import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { initRemoteConfig, RemoteConfig } from './src/config/remoteConfig';
import type { TutorialId } from './src/core';
import { stampGenSwitchLevel } from './src/core/generatorVersion';
import { SaveSystem } from './src/core/saveSystem';
import { CONSENT_GATE, META_GALLERY, TELEMETRY_TRANSPORT } from './src/featureFlags';
import {
  CAPTURE_DIAG_ENABLED,
  PERF_FEEDBACK,
  PERF_LEVEL_INDEX,
  PERF_MODE,
  PERF_SCREEN,
  reducedMotionDiagLabel,
} from './src/perfMode';
import { AdHost, adInitController, initAds, playerConsentSource } from './src/ui/ads';
import { GalleryScreen } from './src/ui/GalleryScreen';
import { GameScreen } from './src/ui/GameScreen';
import { HomeScreen } from './src/ui/HomeScreen';
import { ScreenSlot, useLeavingScreen } from './src/ui/screenHandoff';
import { SplashScreen } from './src/ui/SplashScreen';
import { appLevelAggregator } from './src/telemetry/levelAggregator';
import { drainFatals, installFatalHandler, type FatalScreen } from './src/telemetry/crash';
import { bucketOf, ensureIdentity, nextSessionIndex } from './src/telemetry/identity';
import { withMeasureClearLog } from './src/telemetry/measureClearSink';
import {
  createHttpSink,
  HTTP_SINK_CAP,
  TELEMETRY_ENDPOINT_URL,
  type HttpSink,
} from './src/telemetry/sink.http';
import { createMemorySink, Telemetry } from './src/telemetry/telemetry';
import { initSaveSystem } from './src/ui/storage';
import { paletteFor } from './src/ui/theme';
import { FTUE_ENABLED } from './src/ui/ftueConfig';
import { ftueRoute } from './src/ui/ftueRoute';

// W4-09: 'gallery' is reachable only through HomeScreen's META_GALLERY control.
type Screen = 'splash' | 'menu' | 'game' | 'daily' | 'gallery';

let currentTelemetryScreen: FatalScreen = 'splash';
let fatalHandlerInstalled = false;

Telemetry.configure({ disabled: PERF_MODE });

const PERF_TELEMETRY_TIMING =
  process.env.EXPO_PUBLIC_PERF_TELEMETRY_TIMING === '1';
const perfTelemetrySink = PERF_TELEMETRY_TIMING
  ? createMemorySink(1) // OWNER-PICKED STARTING VALUE: only the disabled-count check reads it.
  : null;
if (perfTelemetrySink) {
  Telemetry.useSink(perfTelemetrySink);
} else if (__DEV__) {
  // W4-04: withMeasureClearLog is a no-op passthrough unless
  // EXPO_PUBLIC_MEASURE_CLEAR=1 (see src/telemetry/measureClearSink.ts).
  Telemetry.useSink(withMeasureClearLog((event) => {
    console.log(`[telemetry] ${JSON.stringify(event)}`);
  }));
}

function telemetryScreen(screen: Screen): 'splash' | 'menu' | 'game' {
  if (screen === 'daily') return 'game';
  if (screen === 'gallery') return 'menu';
  return screen;
}

function emitScreenView(screen: Screen): void {
  currentTelemetryScreen = telemetryScreen(screen);
  Telemetry.emit('screen_view', { screen: currentTelemetryScreen });
}

function installFatalHandlerOnce(): void {
  if (fatalHandlerInstalled) return;
  installFatalHandler({
    errorUtils: ErrorUtils,
    save: SaveSystem,
    currentScreen: () => currentTelemetryScreen,
  });
  fatalHandlerInstalled = true;
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
  const [tutorialId, setTutorialId] = useState<TutorialId | undefined>();
  // W4-06: the daily board's day, fixed when the player enters it.
  const [dailyDay, setDailyDay] = useState<number | null>(null);
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
    let httpSink: HttpSink | null = null;
    // Ads start only after hydration settles, so a remote kill persisted by an
    // earlier session is already seeded when initAds() decides whether to start
    // AdMob (W6-02). Before hydration SaveSystem reads its in-memory
    // store, where every kill bit is 0. The remote config fetch never blocks it.
    const startAfterHydration = () => {
      initRemoteConfig().catch(() => {}); // seeds the kill bits synchronously, then fetches
      syncTelemetryDisabled();
      // CONSENT_GATE on: Google UMP (or a W7-01 verification fixture), ADMOB-C.
      initAds(CONSENT_GATE ? playerConsentSource() : undefined).catch(() => {}); // no-op in Expo Go / web
    };
    // No timeout here: `ready` must never come before hydration settles, or a later
    // SaveSystem.useStore swap could write an in-memory level-1 session over real
    // progress. On a rejection SaveSystem keeps its in-memory store, which never
    // writes to AsyncStorage, so saved progress cannot be overwritten.
    initSaveSystem()
      .then(() => {
        // W3-05: stamp the generator switch level once, from the HYDRATED save
        // and before any screen can deal or fold a campaign board. A no-op
        // while GEN_V2_ENABLED is false, after a failed hydrate
        // (persistenceHealthy false) and when the key is already present.
        stampGenSwitchLevel(SaveSystem);
        setDark(SaveSystem.darkMode);
        setSoundOn(SaveSystem.soundOn);
        // Install id + session count (W6-05). This whole effect returns above
        // under PERF_MODE, so a benchmark run never writes them.
        const identity = ensureIdentity(SaveSystem);
        const sessionIndex = nextSessionIndex(SaveSystem);
        const bucket = bucketOf(identity.hi, identity.lo);
        Telemetry.configure({ sessionIndex, bucket });
        if (TELEMETRY_TRANSPORT) {
          httpSink = createHttpSink({
            url: TELEMETRY_ENDPOINT_URL,
            fetchImpl: fetch,
            appState: AppState,
            consentGranted: () => false,
            killed: () => RemoteConfig.telemetryKilled(),
            installId: identity,
            cap: HTTP_SINK_CAP,
          });
          Telemetry.useSink(httpSink.send);
        }
        startAfterHydration();
        installFatalHandlerOnce();
        drainFatals();
        Telemetry.emit('app_open', {
          cold: true,
          sessionIndex,
          appVersion: Constants.expoConfig?.version ?? 'unknown',
          bucket,
        });
        emitScreenView(screen);
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
    return () => {
      sub.remove();
      httpSink?.dispose();
    };
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
    emitScreenView(next);
    setScreen(next);
  }, []);

  const onPlay = useCallback(() => {
    const route = ftueRoute({
      enabled: FTUE_ENABLED,
      perfMode: PERF_MODE,
      stage: SaveSystem.ftueStage,
      currentLevel: SaveSystem.currentLevel,
      totalSolved: SaveSystem.totalSolved,
    });
    setTutorialId(route === 'real' ? undefined : route);
    showScreen('game');
  }, [showScreen]);

  // W4-06 (META_DAILY): HomeScreen offers this only while the entry is 'available'.
  const onDaily = useCallback(() => {
    setDailyDay(SaveSystem.today());
    showScreen('daily');
  }, [showScreen]);

  // W4-09 (META_GALLERY): the shape gallery; ‹ and Android back return to the menu.
  const onGallery = useCallback(() => showScreen('gallery'), [showScreen]);
  const onGalleryBack = useCallback(() => showScreen('menu'), [showScreen]);

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

  // PERF-DEADTAG: the screen being left stays mounted, invisible and untouchable,
  // until the UI thread has drawn its successor's first frame (screenHandoff.tsx).
  const { leaving, slotKey } = useLeavingScreen(screen);
  const onSplashDone = useCallback(() => showScreen('menu'), [showScreen]);
  const onGameHome = useCallback(() => showScreen('menu'), [showScreen]);
  // Each screen's element is memoised, so the commits that keep the leaving screen
  // and then drop it re-render neither screen.
  const splashScreen = useMemo(
    () => <SplashScreen palette={p} onDone={onSplashDone} />,
    [p, onSplashDone],
  );
  const menuScreen = useMemo(
    () => (
      <HomeScreen
        palette={p}
        dark={dark}
        soundOn={soundOn}
        onPlay={onPlay}
        onDaily={onDaily}
        onGallery={onGallery}
        onToggleSound={toggleSound}
        onToggleTheme={toggleTheme}
      />
    ),
    [p, dark, soundOn, onPlay, onDaily, onGallery, toggleSound, toggleTheme],
  );
  const gameScreen = useMemo(
    () => (
      <GameScreen
        palette={p}
        tutorialId={tutorialId}
        initialLevelIndex={PERF_LEVEL_INDEX ?? undefined}
        benchmarkMode={PERF_MODE}
        feedbackEnabled={!PERF_MODE || PERF_FEEDBACK}
        onTelemetryProbeUnmount={perfTelemetryUnmountProbe}
        onHome={onGameHome}
      />
    ),
    [p, tutorialId, onGameHome],
  );
  const dailyScreen = useMemo(
    () =>
      dailyDay === null ? null : (
        <GameScreen
          palette={p}
          daily={{ day: dailyDay }}
          benchmarkMode={PERF_MODE}
          feedbackEnabled={!PERF_MODE || PERF_FEEDBACK}
          onHome={onGameHome}
        />
      ),
    [p, dailyDay, onGameHome],
  );
  const galleryScreen = useMemo(
    () => <GalleryScreen palette={p} onBack={onGalleryBack} />,
    [p, onGalleryBack],
  );
  const inSlot = (s: Screen) => screen === s || leaving === s;

  if (!ready || !fontsReady) {
    return <View accessibilityLabel={diagLabel} style={{ flex: 1, backgroundColor: p.bg }} />;
  }

  // Screens cross-fade in (~180 ms) instead of hard-cutting (DESIGN.md "Motion").
  return (
    <SafeAreaProvider>
    <GestureHandlerRootView accessibilityLabel={diagLabel} style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {inSlot('splash') && (
        <ScreenSlot key={slotKey('splash')} leaving={leaving === 'splash'} fadeIn={false}>
          {splashScreen}
        </ScreenSlot>
      )}
      {/* Screens cross-fade in (~180 ms, ScreenSlot); the left one is removed a frame later. */}
      {inSlot('menu') && (
        <ScreenSlot key={slotKey('menu')} leaving={leaving === 'menu'}>{menuScreen}</ScreenSlot>
      )}
      {inSlot('game') && (
        <ScreenSlot key={slotKey('game')} leaving={leaving === 'game'}>{gameScreen}</ScreenSlot>
      )}
      {inSlot('daily') && dailyScreen !== null && (
        // W4-06: the same GameScreen on today's shared board; Done / ‹ return to the menu.
        <ScreenSlot key={slotKey('daily')} leaving={leaving === 'daily'}>{dailyScreen}</ScreenSlot>
      )}
      {META_GALLERY && inSlot('gallery') && (
        // W4-09: the board is unmounted here (one screen at a time; a left screen
        // only lingers, invisible, until the next UI frame).
        <ScreenSlot key={slotKey('gallery')} leaving={leaving === 'gallery'}>{galleryScreen}</ScreenSlot>
      )}
      {!PERF_MODE && __DEV__ && <AdHost palette={p} />}
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

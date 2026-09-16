import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SaveSystem } from './src/core/saveSystem';
import { PERF_FEEDBACK, PERF_LEVEL_INDEX, PERF_MODE } from './src/perfMode';
import { AdHost, adInitController, initAds } from './src/ui/ads';
import { GameScreen } from './src/ui/GameScreen';
import { HomeScreen } from './src/ui/HomeScreen';
import { SplashScreen } from './src/ui/SplashScreen';
import { initSaveSystem } from './src/ui/storage';
import { paletteFor } from './src/ui/theme';

type Screen = 'splash' | 'menu' | 'game';

export default function App() {
  const [ready, setReady] = useState(PERF_MODE);
  const [fontsLoaded, fontError] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold });
  // A font-load error must not leave a blank screen: fall back to the platform font.
  const fontsReady = fontsLoaded || fontError != null;
  const [screen, setScreen] = useState<Screen>(PERF_MODE ? 'game' : 'splash');
  const [dark, setDark] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    if (PERF_MODE) return;
    // No timeout here: `ready` must never come before hydration settles, or a later
    // SaveSystem.useStore swap could write an in-memory level-1 session over real
    // progress. On a rejection SaveSystem keeps its in-memory store, which never
    // writes to AsyncStorage, so saved progress cannot be overwritten.
    initSaveSystem()
      .then(() => {
        setDark(SaveSystem.darkMode);
        setSoundOn(SaveSystem.soundOn);
        setReady(true);
      })
      .catch(() => setReady(true));
    initAds().catch(() => {}); // no-op in Expo Go / web (simulated ads take over)
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

  if (!ready || !fontsReady) return <View style={{ flex: 1, backgroundColor: p.bg }} />;

  // Screens cross-fade (~180 ms) instead of hard-cutting (DESIGN.md "Motion").
  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
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

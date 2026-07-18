import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SaveSystem } from './src/core';
import { AdHost, initAds } from './src/ui/ads';
import { GameScreen } from './src/ui/GameScreen';
import { HomeScreen } from './src/ui/HomeScreen';
import { SplashScreen } from './src/ui/SplashScreen';
import { initSaveSystem } from './src/ui/storage';
import { paletteFor } from './src/ui/theme';

type Screen = 'splash' | 'menu' | 'game';

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsReady] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold });
  const [screen, setScreen] = useState<Screen>('splash');
  const [dark, setDark] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    initSaveSystem().then(() => {
      setDark(SaveSystem.darkMode);
      setSoundOn(SaveSystem.soundOn);
      setReady(true);
    });
    initAds(); // no-op in Expo Go / web (simulated ads take over)
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
          <GameScreen palette={p} onHome={() => setScreen('menu')} />
        </Animated.View>
      )}
      <AdHost palette={p} />
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

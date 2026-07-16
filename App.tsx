import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

  if (!ready) return <View style={{ flex: 1, backgroundColor: p.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {screen === 'splash' && <SplashScreen palette={p} onDone={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <HomeScreen
          palette={p}
          dark={dark}
          soundOn={soundOn}
          onPlay={() => setScreen('game')}
          onToggleSound={toggleSound}
          onToggleTheme={toggleTheme}
        />
      )}
      {screen === 'game' && <GameScreen palette={p} onHome={() => setScreen('menu')} />}
      <AdHost palette={p} />
    </GestureHandlerRootView>
  );
}

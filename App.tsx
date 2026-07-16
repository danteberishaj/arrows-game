import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Difficulties,
  Difficulty,
  GeneratedLevel,
  LevelGenerator,
  SaveSystem,
} from './src/core';
import { Sfx } from './src/ui/audio';
import { BoardView } from './src/ui/BoardView';
import { initSaveSystem } from './src/ui/storage';
import { Palette, paletteFor } from './src/ui/theme';

type Phase = 'playing' | 'won' | 'lost';

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initSaveSystem().then(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1 }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Game />
    </GestureHandlerRootView>
  );
}

function Game() {
  const [dark, setDark] = useState(() => SaveSystem.darkMode);
  const [soundOn, setSoundOn] = useState(() => SaveSystem.soundOn);
  const p = paletteFor(dark);

  const [levelIndex, setLevelIndex] = useState(() => SaveSystem.currentLevel);
  const [attempt, setAttempt] = useState(0); // bump to regenerate the same index (Retry)
  const level: GeneratedLevel = useMemo(
    () => LevelGenerator.generate(levelIndex),
    [levelIndex, attempt],
  );
  const [hearts, setHearts] = useState(() => level.hearts);
  const [phase, setPhase] = useState<Phase>('playing');

  const loadLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setAttempt((a) => a + 1);
    const next = LevelGenerator.generate(index);
    setHearts(next.hearts);
    setPhase('playing');
  }, []);

  const onRemoved = useCallback(
    (cleared: boolean) => {
      Sfx.playSuccess();
      if (!cleared) return;
      SaveSystem.registerSolve(hearts === level.hearts); // perfect = no heart lost
      SaveSystem.setCurrentLevel(levelIndex + 1);
      Sfx.playWin();
      setTimeout(() => setPhase('won'), 450); // let the last slither finish
    },
    [hearts, level, levelIndex],
  );

  const onBlocked = useCallback(() => {
    Sfx.playFail();
    setHearts((h) => {
      const left = h - 1;
      if (left <= 0) setTimeout(() => setPhase('lost'), 350); // let the shake finish
      return left;
    });
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

  const diffColor =
    level.difficulty === Difficulty.SuperHard ? p.heart
    : level.difficulty === Difficulty.Hard ? p.accent
    : p.inkDim;

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.levelLabel, { color: p.accentLight }]}>LEVEL {levelIndex + 1}</Text>
          <Text style={[styles.diffLabel, { color: diffColor }]}>
            {Difficulties.displayName(level.difficulty)} · {level.shapeName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.hearts, { color: p.heart }]}>
            {'♥'.repeat(Math.max(0, hearts))}
            <Text style={{ color: p.heartLost }}>
              {'♥'.repeat(Math.max(0, level.hearts - hearts))}
            </Text>
          </Text>
          <HeaderButton label="♪" active={soundOn} palette={p} onPress={toggleSound} />
          <HeaderButton label={dark ? '☀' : '☾'} active palette={p} onPress={toggleTheme} />
        </View>
      </View>

      {/* Board (remounts per level/attempt so pan/zoom refits) */}
      <BoardView
        key={`${levelIndex}:${attempt}`}
        board={level.board}
        palette={p}
        onRemoved={onRemoved}
        onBlocked={onBlocked}
        locked={phase !== 'playing'}
      />

      {/* Win / lose overlays */}
      {phase !== 'playing' && (
        <View
          style={[
            styles.overlay,
            { backgroundColor: phase === 'lost' ? hexA(p.bg, 0.86) : 'rgba(0,0,0,0.45)' },
          ]}
        >
          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={[styles.panelTitle, { color: phase === 'won' ? p.accent : p.heart }]}>
              {phase === 'won' ? 'Cleared!' : 'Out of hearts'}
            </Text>
            <Text style={[styles.panelSub, { color: p.inkDim }]}>
              {phase === 'won'
                ? `Level ${levelIndex + 1} · ${level.shapeName} · ${level.arrowCount} arrows`
                : 'The shape got the better of you.'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: pressed ? p.accentDeep : p.accent },
              ]}
              onPress={() => loadLevel(phase === 'won' ? levelIndex + 1 : levelIndex)}
            >
              <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>
                {phase === 'won' ? 'Next level' : 'Retry'}
              </Text>
            </Pressable>
            {phase === 'won' && SaveSystem.perfectStreak > 1 && (
              <Text style={[styles.streak, { color: p.accentLight }]}>
                ✦ {SaveSystem.perfectStreak} perfect in a row
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function HeaderButton({
  label,
  active,
  palette,
  onPress,
}: {
  label: string;
  active: boolean;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed ? palette.border : palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={{ color: active ? palette.accentCore : palette.heartLost, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** #RRGGBB + alpha -> rgba() string (the lose overlay's bg-tinted night scrim). */
function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  hearts: {
    fontSize: 20,
    letterSpacing: 2,
    marginRight: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    minWidth: 280,
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  panelSub: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  streak: {
    fontSize: 13,
    marginTop: 14,
    fontWeight: '600',
  },
});

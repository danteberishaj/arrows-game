import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Difficulties,
  Difficulty,
  GeneratedLevel,
  LevelGenerator,
  SaveSystem,
} from '../core';
import { Sfx } from './audio';
import { BoardView } from './BoardView';
import { HeaderButton } from './HeaderButton';
import { Palette } from './theme';

type Phase = 'playing' | 'won' | 'lost';

/**
 * One play session: header (home, level, difficulty, hearts), the pan/zoom
 * board, and the win / lose overlays. Progress lives in SaveSystem; the level
 * is regenerated from its index, so leaving to the menu loses no state.
 */
export function GameScreen({ palette, onHome }: { palette: Palette; onHome: () => void }) {
  const p = palette;

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

  const diffColor =
    level.difficulty === Difficulty.SuperHard ? p.heart
    : level.difficulty === Difficulty.Hard ? p.accent
    : p.inkDim;

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HeaderButton label="‹" palette={p} onPress={onHome} />
          <View>
            <Text style={[styles.levelLabel, { color: p.accentLight }]}>
              LEVEL {levelIndex + 1}
            </Text>
            <Text style={[styles.diffLabel, { color: diffColor }]}>
              {Difficulties.displayName(level.difficulty)} · {level.shapeName}
            </Text>
          </View>
        </View>
        <Text style={[styles.hearts, { color: p.heart }]}>
          {'♥'.repeat(Math.max(0, hearts))}
          <Text style={{ color: p.heartLost }}>
            {'♥'.repeat(Math.max(0, level.hearts - hearts))}
          </Text>
        </Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

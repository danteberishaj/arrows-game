import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Difficulties, Difficulty, SaveSystem } from '../core';
import { HeaderButton } from './HeaderButton';
import { Palette } from './theme';
import { Wordmark } from './Wordmark';

/**
 * The main menu, ported from Bootstrap.BuildMainMenu: wordmark, the level
 * Play will resume (with its difficulty tier), a big breathing Play pill,
 * the lifetime stats line, and the sound / theme toggles.
 */
export function HomeScreen({
  palette,
  dark,
  soundOn,
  onPlay,
  onToggleSound,
  onToggleTheme,
}: {
  palette: Palette;
  dark: boolean;
  soundOn: boolean;
  onPlay: () => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
}) {
  const p = palette;
  const resumeIndex = SaveSystem.currentLevel;
  const difficulty = Difficulties.forLevel(resumeIndex);

  const diffColor =
    difficulty === Difficulty.SuperHard ? p.heart
    : difficulty === Difficulty.Hard ? p.accent
    : p.inkDim;

  // Gentle "tap me" breathing on the Play pill (IdlePulse).
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * pulse.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      {/* Top-right: theme toggle (shows the mode you'd switch TO) + sound. */}
      <View style={styles.topRight}>
        <HeaderButton label={dark ? '☀' : '☾'} palette={p} onPress={onToggleTheme} size={44} />
        <HeaderButton label="♪" active={soundOn} palette={p} onPress={onToggleSound} size={44} />
      </View>

      <View style={styles.upper}>
        <Wordmark size={56} palette={p} />

        <Text style={[styles.levelLabel, { color: p.accentLight }]}>
          Level {resumeIndex + 1}
        </Text>
        <Text style={[styles.diffLabel, { color: diffColor }]}>
          {Difficulties.displayName(difficulty)}
        </Text>
      </View>

      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: pressed ? p.accentDeep : p.accent },
          ]}
        >
          <Text style={[styles.playText, { color: p.inkOnAccent }]}>Play</Text>
        </Pressable>
      </Animated.View>

      <Text style={[styles.stats, { color: p.inkDim }]}>{buildStatsLine()}</Text>
    </View>
  );
}

/** Lifetime stats line (GameManager.BuildStatsLine): empty until the first solve. */
function buildStatsLine(): string {
  const solved = SaveSystem.totalSolved;
  if (solved <= 0) return '';

  let line = solved === 1 ? '1 puzzle solved' : `${solved.toLocaleString()} puzzles solved`;
  const days = SaveSystem.dayStreak;
  if (days >= 2) line += `   ·   ${days}-day streak`;
  const best = SaveSystem.bestPerfectStreak;
  if (best >= 2) line += `   ·   best perfect run ${best}`;
  return line;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row-reverse',
    gap: 12,
  },
  upper: {
    alignItems: 'center',
    marginBottom: 56,
  },
  levelLabel: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 30,
    letterSpacing: 0.5,
  },
  diffLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  play: {
    width: 250,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stats: {
    position: 'absolute',
    bottom: 40,
    fontSize: 13,
    fontWeight: '600',
  },
});

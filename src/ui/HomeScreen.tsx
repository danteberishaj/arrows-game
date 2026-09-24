import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Difficulties, Difficulty } from '../core/difficulty';
import { SaveSystem } from '../core/saveSystem';
import { META_BANNER, META_STREAK_FREEZE } from '../featureFlags';
import { PERF_MODE } from '../perfMode';
import { FTUE_ENABLED } from './ftueConfig';
import { ftueRoute } from './ftueRoute';
import { HeaderButton } from './HeaderButton';
import { MenuBanner } from './MenuBanner';
import { PressScale, pressSnapTransform } from './PressScale';
import { Fonts, Palette } from './theme';
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
  const insets = useSafeAreaInsets(); // keep the corners clear of notches (SafeArea.cs)
  const resumeIndex = SaveSystem.currentLevel;
  const difficulty = Difficulties.forLevel(resumeIndex);
  const [statsLine] = useState(() =>
    buildStatsLine(META_STREAK_FREEZE && SaveSystem.streakSavedDay !== 0),
  );

  // ADMOB-C (M4): the banner lives on the menu only, and not while the player
  // is still inside the tutorial (Play would start T1/T2, the same routing as
  // App.tsx's onPlay). It takes no space until an ad has loaded.
  const [showBanner] = useState(
    () =>
      META_BANNER &&
      ftueRoute({
        enabled: FTUE_ENABLED,
        perfMode: PERF_MODE,
        stage: SaveSystem.ftueStage,
        currentLevel: SaveSystem.currentLevel,
        totalSolved: SaveSystem.totalSolved,
      }) === 'real',
  );
  const [bannerHeight, setBannerHeight] = useState(0);
  // POLISH-T9 (audit #10): when the loaded banner's height arrives or leaves, the
  // stats line glides by transform instead of teleporting (its `bottom` stays put,
  // so there is no re-layout and no space reserved before a load). Reduce motion:
  // instant.
  const statsLiftStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: withTiming(bannerHeight > 0 ? -bannerHeight : 0, {
        duration: BANNER_GLIDE_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    }],
  }), [bannerHeight]);

  useEffect(() => {
    if (META_STREAK_FREEZE && SaveSystem.streakSavedDay !== 0) {
      SaveSystem.clearStreakSavedDay();
    }
  }, []);

  const diffColor =
    difficulty === Difficulty.SuperHard ? p.heartText
    : difficulty === Difficulty.Hard ? p.accentText
    : p.inkDim;

  // Gentle "tap me" breathing on the Play pill (IdlePulse).
  const pulse = useSharedValue(0);
  useEffect(() => {
    // Decorative breathing follows the player's system reduced-motion setting.
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1100,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * pulse.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      {/* Top-right: theme toggle (shows the mode you'd switch TO) + sound. */}
      <View style={[styles.topRight, { top: insets.top + 14 }]}>
        <HeaderButton label={dark ? '☀' : '☾'} palette={p} onPress={onToggleTheme} size={44} />
        <HeaderButton label="♪" off={!soundOn} palette={p} onPress={onToggleSound} size={44} />
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

      {/* The breathing scale (this view) and PressScale's press scale (its own
          nested view when META_PRESS_SPRING is on) multiply. */}
      <Animated.View style={pulseStyle}>
        <PressScale
          onPress={onPlay}
          style={({ pressed }) => [
            styles.play,
            {
              backgroundColor: pressed ? p.accentDeep : p.accent,
              transform: pressSnapTransform(pressed),
            },
          ]}
        >
          <Text style={[styles.playText, { color: p.inkOnAccent }]}>Play</Text>
        </PressScale>
      </Animated.View>

      {showBanner ? (
        <Animated.Text style={[styles.stats, { color: p.inkDim, bottom: insets.bottom + 32 }, statsLiftStyle]}>
          {statsLine}
        </Animated.Text>
      ) : (
        <Text
          style={[styles.stats, { color: p.inkDim, bottom: insets.bottom + bannerHeight + 32 }]}
        >
          {statsLine}
        </Text>
      )}

      {showBanner && <MenuBanner bottom={insets.bottom} onHeight={setBannerHeight} />}
    </View>
  );
}

/** POLISH-T9: the stats line's glide when the banner's height arrives or leaves. */
const BANNER_GLIDE_MS = 220; // OWNER-PICKED STARTING VALUE

/** Lifetime stats line (GameManager.BuildStatsLine): empty until the first solve. */
function buildStatsLine(streakSaved: boolean): string {
  const solved = SaveSystem.totalSolved;
  if (solved <= 0) return '';

  let line = solved === 1 ? '1 puzzle solved' : `${solved.toLocaleString()} puzzles solved`;
  const days = SaveSystem.dayStreak;
  if (days >= 2) line += `   ·   ${days}-day streak`;
  const best = SaveSystem.bestPerfectStreak;
  if (best >= 2) line += `   ·   best perfect run ${best}`;
  if (streakSaved) line += '   ·   streak saved'; // OWNER-PICKED STARTING VALUE
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
    fontFamily: Fonts.bold,
    marginTop: 30,
    letterSpacing: 0.5,
  },
  diffLabel: {
    fontSize: 15,
    fontFamily: Fonts.semi,
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
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  stats: {
    position: 'absolute',
    fontSize: 13,
    fontFamily: Fonts.semi,
  },
});

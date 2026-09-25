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
import { META_BANNER, META_DAILY, META_STREAK_FREEZE } from '../featureFlags';
import { PERF_MODE } from '../perfMode';
import { startMenuCollectionSync } from './collectionSync';
import {
  DAILY_ENTRY_DONE_LABEL,
  DAILY_ENTRY_LABEL,
  dailyEntryState,
  type DailyEntryState,
} from './dailyEntryState';
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
  onDaily,
  onToggleSound,
  onToggleTheme,
}: {
  palette: Palette;
  dark: boolean;
  soundOn: boolean;
  onPlay: () => void;
  /** W4-06 (META_DAILY): "Today's board" was pressed. */
  onDaily?: () => void;
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
  // W4-06: read once per mount, like the stats line (a menu left open past
  // midnight keeps its label to the next mount; no timer text of any kind).
  const [dailyState] = useState<DailyEntryState>(() =>
    META_DAILY
      ? dailyEntryState({
        today: SaveSystem.today(),
        dailyLastDay: SaveSystem.dailyLastDay,
        totalSolved: SaveSystem.totalSolved,
      })
      : 'hidden',
  );
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

  // W4-07: the collection catches up here (no board, no gameplay frame budget),
  // in time-bounded slices from 2 s after the mount (collectionSync.ts); unmount stops it.
  useEffect(() => startMenuCollectionSync(), []);

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

      {/* W4-06: with the daily entry shown the upper block sits 20 dp closer to the
          pill, so the pill + entry fit above the stats line and the banner at
          360x640 dp (flag OFF / hidden: the exact BASE style object). */}
      <View style={dailyState === 'hidden' ? styles.upper : [styles.upper, styles.upperWithDaily]}>
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

      {dailyState !== 'hidden' && (
        <DailyEntry
          state={dailyState}
          palette={p}
          onOpen={dailyState === 'available' ? onDaily : undefined}
        />
      )}

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

/**
 * W4-06 (META_DAILY): one quiet text control under the Play pill: inkDim, the
 * brand font, no pill, no violet. `available` opens today's board; `done` is
 * plain text in the same box (no replay). W4-10 owns its final placement.
 */
function DailyEntry({
  state,
  palette,
  onOpen,
}: {
  state: Exclude<DailyEntryState, 'hidden'>;
  palette: Palette;
  onOpen?: () => void;
}) {
  const label = (
    <Text style={[styles.dailyText, { color: palette.inkDim }]}>
      {state === 'done' ? DAILY_ENTRY_DONE_LABEL : DAILY_ENTRY_LABEL}
    </Text>
  );
  if (state === 'done') return <View style={styles.daily}>{label}</View>;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={DAILY_ENTRY_LABEL}
      onPress={onOpen}
      style={({ pressed }) => [styles.daily, { transform: pressSnapTransform(pressed) }]}
    >
      {label}
    </PressScale>
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
  upperWithDaily: {
    marginBottom: 36, // OWNER-PICKED STARTING VALUE (W4-06; W4-10 owns the final menu layout)
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
  // W4-06: the >= 44 x 44 dp hit box doubles as the gap under the pill.
  daily: {
    minHeight: 44, // OWNER-PICKED STARTING VALUE (tap-target floor)
    minWidth: 44, // OWNER-PICKED STARTING VALUE (tap-target floor)
    marginTop: 4, // OWNER-PICKED STARTING VALUE
    paddingHorizontal: 16, // OWNER-PICKED STARTING VALUE
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyText: {
    fontSize: 15, // OWNER-PICKED STARTING VALUE (the tier label's size)
    fontFamily: Fonts.semi,
    letterSpacing: 0.5,
  },
});

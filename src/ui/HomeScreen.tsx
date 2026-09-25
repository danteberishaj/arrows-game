import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { META_BANNER, META_DAILY, META_GALLERY, META_STREAK_FREEZE } from '../featureFlags';
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
import { useStopWhenScreenLeaves } from './screenHandoff';
import { Fonts, Palette } from './theme';
import { Wordmark } from './Wordmark';

/**
 * The main menu, ported from Bootstrap.BuildMainMenu: wordmark, the level
 * Play will resume (with its difficulty tier), a big breathing Play pill,
 * the lifetime stats line, and the sound / theme toggles.
 *
 * W4-10 (the composed menu): once the player has solved a board and any W4
 * menu flag is on, the daily entry and the gallery entry share one quiet row
 * under the pill, split by the stats line's own separator, and the column is
 * centred in the room between the header buttons and the stats band (two
 * stats lines + the banner's reserve), so nothing moves when an ad arrives.
 * Flags OFF, or before the first solve: the BASE menu, tree for tree.
 */
export function HomeScreen({
  palette,
  dark,
  soundOn,
  onPlay,
  onDaily,
  onGallery,
  onToggleSound,
  onToggleTheme,
}: {
  palette: Palette;
  dark: boolean;
  soundOn: boolean;
  onPlay: () => void;
  /** W4-06 (META_DAILY): "Today's board" was pressed. */
  onDaily?: () => void;
  /** W4-09 (META_GALLERY): "Gallery" was pressed. */
  onGallery?: () => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
}) {
  const p = palette;
  const insets = useSafeAreaInsets(); // keep the corners clear of notches (SafeArea.cs)
  const { fontScale } = useWindowDimensions();
  const resumeIndex = SaveSystem.currentLevel;
  const difficulty = Difficulties.forLevel(resumeIndex);
  // W4-10: the composed menu, read once per mount like the entries. From the first
  // solve (before it the row and the stats line are both empty, so the menu stays
  // BASE's), whenever a W4 menu entry can show: the daily entry, the gallery entry,
  // or the streak-saved words that make the stats line wrap.
  const [composed] = useState(
    () => SaveSystem.totalSolved >= 1 && (META_DAILY || META_GALLERY || META_STREAK_FREEZE),
  );
  const [statsLine] = useState(() =>
    buildStatsLine(META_STREAK_FREEZE && SaveSystem.streakSavedDay !== 0, composed),
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
  // W4-09: the gallery control, from the first solve (ruling W4-7), read once
  // per mount like the daily entry. The menu does no other gallery work.
  const [showGallery] = useState(() => META_GALLERY && SaveSystem.totalSolved >= 1);
  const showDaily = dailyState !== 'hidden';
  const bothEntries = showDaily && showGallery;
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
  // PERF-DEADTAG: the breathing never ends on its own; it stops when the menu
  // starts leaving, before its views are removed (screenHandoff.tsx).
  useStopWhenScreenLeaves(pulse);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * pulse.value }],
  }));

  // W4-10: on the composed menu a stats line too long for one line wraps centred inside
  // side margins (BASE: the style array is BASE's, element for element).
  const statsStyle = composed ? [styles.stats, styles.statsComposed] : [styles.stats];

  // The centred column: wordmark, level and tier, the Play pill and (W4-06/W4-09/W4-10)
  // the entry row.
  const column = (
    <>
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

      {(showDaily || showGallery) && (
        // W4-10: one secondary row under the pill, two inkDim text controls split by
        // the stats line's separator (the separator is the whole space between the
        // two words; each control keeps its >= 44 x 44 dp box on its outer side).
        <View testID="menu-entry-row" style={styles.entryRow}>
          {dailyState !== 'hidden' && (
            <DailyEntry
              state={dailyState}
              palette={p}
              onOpen={dailyState === 'available' ? onDaily : undefined}
              edge={bothEntries ? 'start' : undefined}
            />
          )}
          {bothEntries && (
            <Text
              testID="menu-entry-sep"
              accessible={false}
              importantForAccessibility="no"
              style={[styles.dailyText, styles.entrySep, { color: p.inkDim }]}
            >
              {STATS_SEPARATOR}
            </Text>
          )}
          {showGallery && (
            <GalleryEntry palette={p} onOpen={onGallery} edge={bothEntries ? 'end' : undefined} />
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      {/* Top-right: theme toggle (shows the mode you'd switch TO) + sound. */}
      <View style={[styles.topRight, { top: insets.top + HEADER_TOP }]}>
        <HeaderButton label={dark ? '☀' : '☾'} palette={p} onPress={onToggleTheme} size={HEADER_BUTTON} />
        <HeaderButton label="♪" off={!soundOn} palette={p} onPress={onToggleSound} size={HEADER_BUTTON} />
      </View>

      {composed ? (
        // W4-10: centred between the header buttons and the stats band (two stats lines
        // at the system font scale, plus the banner's reserve), fixed for the mount.
        // Its padded box reaches over the header buttons (drawn before it): box-none
        // lets a touch there fall through to them; only its children take touches.
        <View
          testID="menu-column"
          pointerEvents="box-none"
          style={[
            styles.column,
            composedColumnPadding({
              insetTop: insets.top,
              insetBottom: insets.bottom,
              fontScale,
              banner: showBanner,
            }),
          ]}
        >
          {column}
        </View>
      ) : column}

      {showBanner ? (
        <Animated.Text
          style={[...statsStyle, { color: p.inkDim, bottom: insets.bottom + STATS_BOTTOM }, statsLiftStyle]}
        >
          {statsLine}
        </Animated.Text>
      ) : (
        <Text
          style={[...statsStyle, { color: p.inkDim, bottom: insets.bottom + bannerHeight + STATS_BOTTOM }]}
        >
          {statsLine}
        </Text>
      )}

      {showBanner && <MenuBanner bottom={insets.bottom} onHeight={setBannerHeight} />}
    </View>
  );
}

/**
 * W4-10: which side of the row an entry sits on when both entries show. The
 * separator between them is the whole gap, so the facing side has no padding;
 * the outer side keeps the 16 dp that widens the hit box.
 */
type EntryEdge = 'start' | 'end';
const entryBox = (edge?: EntryEdge) =>
  edge === 'start' ? [styles.daily, styles.entryStart]
  : edge === 'end' ? [styles.daily, styles.entryEnd]
  : [styles.daily];

/**
 * W4-06 (META_DAILY): one quiet text control under the Play pill: inkDim, the
 * brand font, no pill, no violet. `available` opens today's board; `done` is
 * plain text in the same box (no replay). W4-10 places it in the entry row.
 */
function DailyEntry({
  state,
  palette,
  onOpen,
  edge,
}: {
  state: Exclude<DailyEntryState, 'hidden'>;
  palette: Palette;
  onOpen?: () => void;
  edge?: EntryEdge;
}) {
  const label = (
    <Text style={[styles.dailyText, { color: palette.inkDim }]}>
      {state === 'done' ? DAILY_ENTRY_DONE_LABEL : DAILY_ENTRY_LABEL}
    </Text>
  );
  if (state === 'done') return <View style={entryBox(edge)}>{label}</View>;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={DAILY_ENTRY_LABEL}
      onPress={onOpen}
      style={({ pressed }) => [...entryBox(edge), { transform: pressSnapTransform(pressed) }]}
    >
      {label}
    </PressScale>
  );
}

/** W4-09: the menu control's copy. OWNER-PICKED STARTING VALUE (copy). */
const GALLERY_ENTRY_LABEL = 'Gallery'; // OWNER-PICKED STARTING VALUE

/**
 * W4-09 (META_GALLERY): the daily entry's quiet style (inkDim, the brand font,
 * no pill) in the same >= 44 x 44 dp box. Opens the shape gallery.
 */
function GalleryEntry({
  palette,
  onOpen,
  edge,
}: {
  palette: Palette;
  onOpen?: () => void;
  edge?: EntryEdge;
}) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={GALLERY_ENTRY_LABEL}
      onPress={onOpen}
      style={({ pressed }) => [...entryBox(edge), { transform: pressSnapTransform(pressed) }]}
    >
      <Text style={[styles.dailyText, { color: palette.inkDim }]}>{GALLERY_ENTRY_LABEL}</Text>
    </PressScale>
  );
}

/** POLISH-T9: the stats line's glide when the banner's height arrives or leaves. */
const BANNER_GLIDE_MS = 220; // OWNER-PICKED STARTING VALUE

/** The header buttons' offset below the top inset, and their size (BASE values). */
const HEADER_TOP = 14;
const HEADER_BUTTON = 44;
/** The stats line: its distance above the bottom inset and its size (BASE values). */
const STATS_BOTTOM = 32;
const STATS_FONT_SIZE = 13; // = styles.stats.fontSize (kept literal there: contrastAudit.ts reads that line)
/** The stats line's separator (GameManager.BuildStatsLine); W4-10's entry row uses it too. */
const STATS_SEPARATOR = '   ·   ';

/**
 * W4-10: the stats band holds two stats lines. One line of the stats text is 1.23-1.24
 * times its scaled font size on emulator-5556 (Fredoka SemiBold 13 sp; two lines measured
 * 32.0 dp at font scale 1.0 and 42.0 dp at 1.3: artifacts/W4-10/captures/base-on-*,
 * artifacts/W4-10/scripts/layout.py); 1.25 rounds up.
 */
const STATS_BAND_LINES = 2; // OWNER-PICKED STARTING VALUE (the composite's longest line wraps once)
const STATS_LINE_PER_SP = 1.25;
/**
 * W4-10: the room kept for the menu banner (only where the menu may show one), so
 * the column is placed once and an ad that arrives, or fails, never moves it.
 * Measured: AdMob's anchored adaptive banner is 56 dp tall at 360 dp wide and 64 dp
 * at 411 dp (artifacts/W4-10/captures base-on-*: layout.json); 56 fits the smallest
 * target, and a taller banner only eats into the gap under the entry row.
 */
const BANNER_RESERVE = 56; // OWNER-PICKED STARTING VALUE
/** W4-10: the stats line's side margins when it wraps (the header buttons' right inset). */
const STATS_SIDE_MARGIN = 18; // OWNER-PICKED STARTING VALUE

/**
 * W4-10: the composed column's padding. The root centres the column, so the padding
 * centres it in the room between the header buttons (top inset + 14 dp + a 44 dp
 * button) and the stats band (bottom inset + 32 dp + two stats lines at the system
 * font scale + the banner's reserve).
 */
function composedColumnPadding({
  insetTop,
  insetBottom,
  fontScale,
  banner,
}: {
  insetTop: number;
  insetBottom: number;
  fontScale: number;
  banner: boolean;
}): { paddingTop: number; paddingBottom: number } {
  const statsBand = Math.ceil(STATS_BAND_LINES * STATS_FONT_SIZE * fontScale * STATS_LINE_PER_SP);
  return {
    paddingTop: insetTop + HEADER_TOP + HEADER_BUTTON,
    paddingBottom: insetBottom + STATS_BOTTOM + statsBand + (banner ? BANNER_RESERVE : 0),
  };
}

/**
 * W4-10: on the composed menu the stats line can wrap (360 dp, or a large font), so
 * it may break only after a separator: each part's own spaces are no-break spaces
 * and the separator's leading spaces too, so a part is never split ("best perfect
 * run / 4") and the dot ends the line it follows. Drawn the same as spaces.
 */
const NBSP = '\u00A0';
const STATS_SEPARATOR_WRAPPING = `${NBSP}${NBSP}${NBSP}·   `;

/** Lifetime stats line (GameManager.BuildStatsLine): empty until the first solve. */
function buildStatsLine(streakSaved: boolean, wrapAtSeparators = false): string {
  const solved = SaveSystem.totalSolved;
  if (solved <= 0) return '';

  const parts = [solved === 1 ? '1 puzzle solved' : `${solved.toLocaleString()} puzzles solved`];
  const days = SaveSystem.dayStreak;
  if (days >= 2) parts.push(`${days}-day streak`);
  const best = SaveSystem.bestPerfectStreak;
  if (best >= 2) parts.push(`best perfect run ${best}`);
  if (streakSaved) parts.push('streak saved'); // OWNER-PICKED STARTING VALUE
  return wrapAtSeparators
    ? parts.map((part) => part.replace(/ /g, NBSP)).join(STATS_SEPARATOR_WRAPPING)
    : parts.join(STATS_SEPARATOR);
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
  // W4-10: the composed column (padding from composedColumnPadding).
  column: {
    alignItems: 'center',
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
  // W4-10: same anchor; a line too long for the width wraps centred, inside margins.
  statsComposed: {
    left: STATS_SIDE_MARGIN,
    right: STATS_SIDE_MARGIN,
    textAlign: 'center',
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
  // W4-09/W4-10: the entry row (daily, separator, gallery).
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryStart: {
    paddingRight: 0,
  },
  entryEnd: {
    paddingLeft: 0,
  },
  // The separator sits on the entries' 4 dp top margin, so its dot centres on their labels.
  entrySep: {
    marginTop: 4,
  },
});

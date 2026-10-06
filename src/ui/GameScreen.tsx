import { useArrowStyle } from './useArrowStyle';
import { skinBoardPalette } from './skinBoardPalette';
import { chooseArrowStyle } from './arrowStyleSelection';
import { recordRewardClear, markRevealSeen, type ClearReward } from './rewardLedger';
import { rewardPathEnabled } from './rewardGate';
import { useRewards } from './useRewards';
import { RewardProgressPill } from './RewardProgressPill';
import { RewardRevealCard } from './RewardRevealCard';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AppState,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  PixelRatio,
  Share,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import {
  ArrowPath,
  Difficulties,
  Difficulty,
  SaveSystem,
  type TutorialId,
} from '../core';
import {
  appLevelAggregator,
  type TapOutcome,
} from '../telemetry/levelAggregator';
import { reviewDeclineReason } from '../core/reviewPolicy';
import { CAPTURE_DIAG } from '../perfMode';
import {
  META_HEART_REFILL_POP,
  META_LEVEL_TRANSITION,
  META_PANEL_MOTION,
  META_POST_CLEAR_TIMELINE,
  META_REVIEW_PROMPT,
  META_SHARE_CARD,
} from '../featureFlags';
import { Ads } from './ads';
import {
  ART_HEADER_SILHOUETTE_ENABLED,
  ART_ICONS_ENABLED,
  ART_PANEL_DEPTH_ENABLED,
  ART_CLEAR_REVEAL_ENABLED,
  ART_WIN_SILHOUETTE_DP,
  ART_WIN_SILHOUETTE_ENABLED,
} from './artConfig';
import { BoardView } from './BoardView';
import {
  feedback,
  prepareFeedback,
  releaseFeedback,
} from './feedback';
import { nextExitCombo, type ExitCombo } from './exitCombo';
import {
  formatFtueSessionLog,
  type FtueSessionLogEvent,
} from './ftueSessionLog';
import { HeaderButton } from './HeaderButton';
import { HEART_PATH, Icon } from './icons';
import {
  HEART_PIP_LOSS_START_SCALE,
  HEART_PIP_REFILL_START_SCALE,
  pipPopKind,
} from './heartPip';
import { PressScale, pressSnapTransform } from './PressScale';
import {
  clearRevealSlotMs, createDailySession, createLevelSession, createTutorialSession, EMPTY_BOARD_HOLD_MS,
  levelGenVersion, LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS, wonPanelDelayMs,
  TerminalTransitionGuard,
  type GamePhase,
  type LevelSession,
  type TerminalPhase,
} from './gameSessionLifecycle';
import { T1_LINE, T2_BLOCKED_LINE, T2_LINE } from './ftueCopy';
import {
  FTUE_ASSIST_ENABLED,
  FTUE_ENABLED,
  FTUE_STALL_HINT_ENABLED,
  FTUE_STALL_HINT_MS,
} from './ftueConfig';
import {
  assistActive,
  ASSIST_STAGE,
  DONE_STAGE,
  T1_CLEARED_STAGE,
} from './ftueRoute';
import { FtueStallTimer } from './ftueStallTimer';
import {
  createLevelScrimTransition,
  ScreenScrim,
  showAdThenPanelBeat,
  type LevelScrimTransition,
} from './ScreenScrim';
import {
  FIRST_STAR_DELAY_MS,
  PANEL_EXIT_MS,
  PANEL_LOSS_ENTER_MS,
  PANEL_WIN_ENTER_MS,
  STAR_STAGGER_MS,
  type PresenceState,
} from './overlayPresence';
import { createPanelPresence, PanelOverlayFrame, type PanelPresence } from './PanelPresence';
import {
  loadStoreReview,
  REVIEW_DWELL_MS,
  REVIEW_FLOW_WAIT_MAX_MS,
  reviewDiag,
  reviewSession,
  settleWithin,
} from './reviewPrompt';
import { buildDailyShareText } from './shareCard';
import { silhouettePath } from './silhouette';
import { blockedTapCost } from './tapRules';
import { Palette, Type } from './theme';
import { headerTier } from './tierLabel';

/**
 * POLISH-T9 (smoothness audit #4): the tutorial header line is a constant
 * two-line box, so T1, T2, the blocked line and the emptied line all give the
 * same header height and BoardView's onLayout never re-fits (jumps) the board.
 * Fredoka Bold 18's natural line measured 22.14 dp (411 dp) and 22.33 dp
 * (360 dp) from the [board-viewport] deltas (W1-05, POLISH-T9 part 1); 23 dp
 * keeps every glyph inside its line.
 */
export const TUTORIAL_LINE_HEIGHT = 23; // OWNER-PICKED STARTING VALUE

/** W5-02 (ART_ICONS_ENABLED): the Continue label's heart and the perfect-streak sparkle, in dp. */
const CONTINUE_HEART_DP = 16; // OWNER-PICKED STARTING VALUE (the label's font size)
const STREAK_SPARKLE_DP = 13; // OWNER-PICKED STARTING VALUE (the streak line's font size)
/** W5-02: the Continue button's screen-reader label once its heart is an icon (the text it read before). */
// A11Y-LABELS: screen-reader names in words (the glyphs were read out as "black heart suit", "electric light bulb").
const CONTINUE_A11Y_LABEL = 'Continue with one more heart (ad)'; // OWNER-PICKED STARTING VALUE
const BACK_A11Y_LABEL = 'Back'; // OWNER-PICKED STARTING VALUE (the gallery's back button's name)
const HINT_A11Y_LABEL = 'Hint'; // OWNER-PICKED STARTING VALUE

/** W4-06 daily-mode copy: header, win subline prefix, the win panel's button. */
const DAILY_HEADER_LABEL = 'TODAY'; // OWNER-PICKED STARTING VALUE
const DAILY_WIN_PREFIX = 'Today'; // OWNER-PICKED STARTING VALUE
const DAILY_DONE_LABEL = 'Done'; // OWNER-PICKED STARTING VALUE
/** W4-13 (META_SHARE_CARD): the daily win panel's share control. */
const DAILY_SHARE_LABEL = 'Share'; // OWNER-PICKED STARTING VALUE

/**
 * HEADER-FIT: "LEVEL N" / "TODAY" stays one line and shrinks its font only when it is wider than its column. The
 * widest title, "LEVEL 2222" (143.7 dp at font scale 1, HarfBuzz on Fredoka Bold), needs 0.856 at font scale 1.3 on
 * a 360 dp screen (column 160 dp) and 0.557 at font scale 2.0 (artifacts/HEADER-FIT/analysis/header-strings.ts).
 * The floor 0.5 keeps the title at 12 sp or more (the brief's minimum is 11 sp).
 * The shrink props are set only on a title that laid out on more than one line: on Android, `adjustsFontSizeToFit`
 * also shrinks a title that fits when its pixel-snapped view height is a fraction under the text layout's height
 * (ReactTextView.onDraw's exceedsHeight check), which made every 360 dp title about 8 % smaller (HEADER-FIT captures).
 */
export const HEADER_TITLE_MIN_FONT_SCALE = 0.5;

/**
 * W5-03: the `{remaining} left` counter's digits sit in a slot as wide as this
 * digit repeated once per digit of the board's arrow count, so " left" never
 * moves on a tap. `node scripts/analysis/font-digits.mjs`: Fredoka's digits are
 * proportional (SemiBold 1 = 383 … 2 = 577 units), `2` is the widest in both
 * weights, no digit pair is kerned, and there is no `tnum` feature to switch on.
 */
const WIDEST_DIGIT = '2';

/**
 * Height of two tutorial lines as the text will lay out: lineHeight scales with
 * the font scale, and Android rounds each line UP to whole pixels
 * (CustomLineHeightSpan: ceil), e.g. 23 dp at 3.5x = 80.5 px -> 81 px. A
 * minHeight of plain 2 x 23 = 46 dp let a two-line label measure 46.29 dp and
 * still move the board by one pixel (POLISH-T9 part 1, first post-fix run).
 */
export function tutorialLineBoxHeight(fontScale: number, pixelRatio: number): number {
  return (2 * Math.ceil(TUTORIAL_LINE_HEIGHT * fontScale * pixelRatio)) / pixelRatio;
}

// Keep the playtest logger callable in release builds, where direct console.log
// calls in application code are removed by the production transform.
const writeFtueSessionLog = console.log.bind(console);

/**
 * One play session: header (home, level, difficulty, hearts), the pan/zoom
 * board, and the win / lose overlays. Progress lives in SaveSystem; the level
 * is regenerated from its index, so leaving to the menu loses no state.
 */
export function GameScreen({
  palette,
  darkMode = false,
  onHome,
  tutorialId,
  initialLevelIndex,
  daily,
  benchmarkMode = false,
  feedbackEnabled = true,
  onTelemetryProbeUnmount,
}: {
  palette: Palette;
  darkMode?: boolean;
  onHome: () => void;
  tutorialId?: TutorialId;
  initialLevelIndex?: number;
  /**
   * W4-06: play the shared board of `day` (fixed by the caller when the screen
   * is entered). A clear records the solve and the day, never the campaign
   * pointer or the interstitial counter; the win panel's button is "Done".
   */
  daily?: { day: number };
  benchmarkMode?: boolean;
  feedbackEnabled?: boolean;
  onTelemetryProbeUnmount?: () => void;
}) {
  const style = useArrowStyle();
  const p = palette;
  const boardPalette = useMemo(() => skinBoardPalette(palette, style.spec, darkMode), [palette, style.spec, darkMode]);
  const insets = useSafeAreaInsets(); // keep content clear of notches (SafeArea.cs)
  const { fontScale } = useWindowDimensions(); // POLISH-T9: tutorial line box height

  const revisionRef = useRef(0);
  const levelAggregatorRef = useRef(appLevelAggregator);
  const [session, setSession] = useState(() => {
    const index = initialLevelIndex ?? SaveSystem.currentLevel;
    const initial = daily
      ? createDailySession(daily.day, revisionRef.current)
      : tutorialId
        ? createTutorialSession(tutorialId, revisionRef.current)
        : createLevelSession(index, revisionRef.current, levelGenVersion(index));
    levelAggregatorRef.current.start(
      initial.index,
      initial.level.arrowCount,
      initial.level.shapeName,
      initial.level.hearts,
      initial.mode,
      Date.now(),
    );
    return initial;
  });
  const ftueBoardMountedAtRef = useRef(Date.now());
  const ftueMountedSessionRef = useRef<LevelSession | null>(null);
  const { index: levelIndex, level, tutorialId: activeTutorialId } = session;
  // W4-06: the daily board's own day; null on campaign and tutorial boards.
  const dailyDay = session.day;
  const tutorialGraceAvailableRef = useRef(activeTutorialId === 'T2');
  const removalsThisBoardRef = useRef(0);
  // W4-11 reads this at the delayed won-phase commit. Keep the stage-2
  // snapshot even when this clear immediately advances persisted stage to 3.
  const assistedAtClearRef = useRef(false);
  // W4-11: whether the last clear lost no heart, kept for the delayed ask.
  const perfectAtClearRef = useRef(false);
  // W4-11: the pending ask (REVIEW_DWELL_MS after the won commit) and the
  // in-flight OS review flow that Next / Done wait for.
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewFlowRef = useRef<Promise<void> | null>(null);
  const reviewWaitRef = useRef(false);
  // W4-07: whether the last clear added a shape to the collection (its bit was
  // 0). Data only, set on the clear path before the won panel; W5's silhouette
  // celebration decides whether and how to show it.
  const newlyDiscoveredRef = useRef(false);
  const [clearReward, setClearReward] = useState<ClearReward | null>(null);
  const rewards = useRewards();
  const [hearts, setHearts] = useState(() => level.hearts);
  const [remaining, setRemaining] = useState(() => level.arrowCount);
  // W2-07 (META_HEART_REFILL_POP): bumped only by an earned rewarded continue,
  // so the refilled pip pops and Retry / Next (which also refill pips) do not.
  // With W2-05's panel motion the bump waits for the lose panel's exit to
  // settle, and the refilled pip stays spent until then. OFF: never changes.
  const [refillToken, setRefillToken] = useState(0);
  const [refillPending, setRefillPending] = useState(false);
  const [tutorialLine, setTutorialLine] = useState(() => initialTutorialLine(activeTutorialId));
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [terminalPending, setTerminalPending] = useState(false);
  const [hint, setHint] = useState<{ arrow: ArrowPath; id: number } | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const adBusyRef = useRef(adBusy);
  adBusyRef.current = adBusy;
  // Continue (lose panel) and hint each have their own rewarded unit (M3).
  const rewardedReady = useSyncExternalStore(Ads.subscribeRewardedReady, readRewardedReady);
  const hintReady = useSyncExternalStore(subscribeHintReady, readHintReady);
  // A rewarded show was attempted and resolved false. Cleared by the next
  // readiness change or board tap (no timer).
  const [adShowFailed, setAdShowFailed] = useState(false);
  const hintId = useRef(1);
  const stallHintTimer = useRef(new FtueStallTimer(FTUE_STALL_HINT_MS)).current;
  const stallHintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartsRef = useRef(hearts);
  const exitCombo = useRef<ExitCombo | null>(null);
  const terminalTransitionRef = useRef<TerminalTransitionGuard | null>(null);
  if (terminalTransitionRef.current === null) {
    terminalTransitionRef.current = new TerminalTransitionGuard();
  }
  const terminalTransition = terminalTransitionRef.current;
  // Reanimated reads the system reduce-motion setting once at app start, so
  // this is constant for the screen's life.
  const reducedMotion = useReducedMotion();
  // W2-04 (META_LEVEL_TRANSITION): Next and Retry swap the level under a flat
  // bg scrim. OFF: no scrim, no sequencer; both presses swap in one frame.
  // Reduced motion skips the scrim too (owner 2026-09-25): an instant fade
  // would only flash two flat frames, so the swap stays a plain cut.
  const scrimOpacity = useSharedValue(0);
  const levelScrimRef = useRef<LevelScrimTransition | null>(null);
  if (META_LEVEL_TRANSITION && !reducedMotion && levelScrimRef.current === null) {
    levelScrimRef.current = createLevelScrimTransition(scrimOpacity);
  }
  const levelScrim = levelScrimRef.current;
  const nextPendingRef = useRef(false);
  // W2-05 (META_PANEL_MOTION): the win / lose panel enters, and the
  // continue-with-ad dismissal fades out. OFF: no latch; the panel appears and
  // disappears in one frame, as before.
  const panelPresenceValue = useSharedValue(0);
  const panelPresenceRef = useRef<PanelPresence | null>(null);
  if (META_PANEL_MOTION && panelPresenceRef.current === null) {
    panelPresenceRef.current = createPanelPresence(panelPresenceValue);
  }
  const panelPresence = panelPresenceRef.current;
  const panelState = useSyncExternalStore(
    panelPresence?.subscribe ?? subscribeNoPresence,
    panelPresence?.getSnapshot ?? readNoPresence,
  );
  const panelExiting = panelState === 'exiting';
  useEffect(() => {
    if (!refillPending || panelState !== 'hidden') return;
    setRefillPending(false);
    setRefillToken((token) => token + 1);
  }, [panelState, refillPending]);
  heartsRef.current = hearts;
  const clearHint = useCallback(() => setHint(null), []);

  const logFtueEvent = useCallback((event: FtueSessionLogEvent) => {
    if (process.env.EXPO_PUBLIC_FTUE_LOG !== '1') return;
    writeFtueSessionLog(formatFtueSessionLog(
      event,
      Date.now() - ftueBoardMountedAtRef.current,
    ));
  }, []);

  const clearStallHintTimeout = useCallback(() => {
    if (stallHintTimeout.current === null) return;
    clearTimeout(stallHintTimeout.current);
    stallHintTimeout.current = null;
  }, []);

  const cancelStallHint = useCallback(() => {
    clearStallHintTimeout();
    stallHintTimer.cancel();
  }, [clearStallHintTimeout, stallHintTimer]);

  const scheduleStallHint = useCallback(() => {
    clearStallHintTimeout();
    if (
      !activeTutorialId ||
      !FTUE_STALL_HINT_ENABLED ||
      FTUE_STALL_HINT_MS === null
    ) return;

    stallHintTimeout.current = setTimeout(() => {
      stallHintTimeout.current = null;
      if (!stallHintTimer.due(Date.now())) return;
      const arrow = level.board.findHint();
      if (arrow) {
        logFtueEvent({ type: 'stall_hint' });
        setHint({ arrow, id: hintId.current++ });
      }
    }, FTUE_STALL_HINT_MS);
  }, [activeTutorialId, clearStallHintTimeout, level, logFtueEvent, stallHintTimer]);

  useEffect(() => {
    if (ftueMountedSessionRef.current === session) return;
    ftueMountedSessionRef.current = session;
    ftueBoardMountedAtRef.current = Date.now();
    if (process.env.EXPO_PUBLIC_FTUE_LOG !== '1') return;
    writeFtueSessionLog(formatFtueSessionLog(
      { type: 'board_mount', board: session.tutorialId ?? session.index, gen: session.genVersion, arrows: session.level.arrowCount, shape: session.level.shapeName },
      0,
    ));
  }, [session]);
  useEffect(() => () => terminalTransition.dispose(), [terminalTransition]);
  // Capture builds only (EXPO_PUBLIC_CAPTURE_DIAG): the terminal phase's commit, for last tap -> panel timing (W5-17).
  useEffect(() => {
    if (CAPTURE_DIAG && phase !== 'playing') console.log(`[capture-diag] phase=${phase}`);
  }, [phase]);
  useEffect(() => () => levelScrim?.dispose(), [levelScrim]);
  useEffect(() => () => panelPresence?.dispose(), [panelPresence]);
  // The new session is committed: the scrim may uncover one frame later.
  useEffect(() => {
    levelScrim?.contentCommitted();
  }, [levelScrim, session.revision]);
  useEffect(() => () => {
    levelAggregatorRef.current.end('abandoned', heartsRef.current, Date.now());
    onTelemetryProbeUnmount?.();
  }, []);
  // Subscribed directly (not via an effect on `rewardedReady`) so the clear
  // runs synchronously at the SDK callback, before a failed show's
  // `setAdShowFailed(true)` that follows it.
  useEffect(() => {
    const clear = () => setAdShowFailed(false);
    const offContinue = Ads.subscribeRewardedReady(clear);
    const offHint = Ads.subscribeRewardedReady(clear, 'hint');
    return () => {
      offContinue();
      offHint();
    };
  }, []);
  useEffect(() => {
    if (!feedbackEnabled) return undefined;
    prepareFeedback(SaveSystem.soundOn);
    return releaseFeedback;
  }, [feedbackEnabled]);
  useEffect(() => {
    cancelStallHint();
    if (
      !activeTutorialId ||
      !FTUE_STALL_HINT_ENABLED ||
      FTUE_STALL_HINT_MS === null
    ) return undefined;

    stallHintTimer.arm(Date.now());
    scheduleStallHint();
    return cancelStallHint;
  }, [
    activeTutorialId,
    cancelStallHint,
    level,
    scheduleStallHint,
    stallHintTimer,
  ]);

  /** The win / lose panel's commit; with W2-05 on, its entrance starts in the same render. */
  const commitTerminalPhase = useCallback((next: TerminalPhase) => {
    panelPresence?.show(
      reducedMotion ? 0 : next === 'won' ? PANEL_WIN_ENTER_MS : PANEL_LOSS_ENTER_MS,
    );
    setPhase(next);
  }, [panelPresence, reducedMotion]);

  const beginTerminalTransition = useCallback(
    (
      nextPhase: TerminalPhase,
      delayMs: number,
      commit?: (phase: TerminalPhase) => void,
    ) => {
      const accepted = terminalTransition.begin(
        nextPhase,
        delayMs,
        commit ?? (panelPresence ? commitTerminalPhase : setPhase),
      );
      if (!accepted) return false;
      cancelStallHint();
      setTerminalPending(true);
      return true;
    },
    [cancelStallHint, commitTerminalPhase, panelPresence, terminalTransition],
  );

  const loadSession = useCallback((next: LevelSession) => {
    cancelStallHint();
    levelAggregatorRef.current.start(
      next.index,
      next.level.arrowCount,
      next.level.shapeName,
      next.level.hearts,
      next.mode,
      Date.now(),
    );
    terminalTransition.reset();
    // W2-05: Next / Retry unmount the panel at once (under W2-04's scrim when on).
    panelPresence?.hideNow();
    setTerminalPending(false);
    setSession(next);
    heartsRef.current = next.level.hearts;
    setHearts(next.level.hearts);
    setRemaining(next.level.arrowCount);
    tutorialGraceAvailableRef.current = next.tutorialId === 'T2';
    removalsThisBoardRef.current = 0;
    assistedAtClearRef.current = false;
    perfectAtClearRef.current = false;
    setClearReward(null);
    setTutorialLine(initialTutorialLine(next.tutorialId));
    exitCombo.current = null;
    setPhase('playing');
    setHint(null);
    setAdShowFailed(false);
    setRefillPending(false);
  }, [cancelStallHint, panelPresence, terminalTransition]);

  const loadLevel = useCallback((index: number) => {
    revisionRef.current += 1;
    loadSession(createLevelSession(index, revisionRef.current, levelGenVersion(index)));
  }, [loadSession]);

  const loadTutorial = useCallback((id: TutorialId) => {
    revisionRef.current += 1;
    loadSession(createTutorialSession(id, revisionRef.current));
  }, [loadSession]);

  const restartLevel = useCallback((index: number) => {
    logFtueEvent({ type: 'restart' });
    loadLevel(index);
  }, [loadLevel, logFtueEvent]);

  const restartTutorial = useCallback((id: TutorialId) => {
    logFtueEvent({ type: 'restart' });
    loadTutorial(id);
  }, [loadTutorial, logFtueEvent]);

  /** W4-06 daily Retry: the same day's board, rebuilt from generateDaily(day). */
  const restartDaily = useCallback((day: number) => {
    logFtueEvent({ type: 'restart' });
    revisionRef.current += 1;
    loadSession(createDailySession(day, revisionRef.current));
  }, [loadSession, logFtueEvent]);

  const onTapOutcome = useCallback((outcome: TapOutcome) => {
    levelAggregatorRef.current.tap(outcome);
  }, []);

  const onHomePress = useCallback(() => {
    levelAggregatorRef.current.end('abandoned', heartsRef.current, Date.now());
    onHome();
  }, [onHome]);

  const onRemoved = useCallback(
    (cleared: boolean, exitVisibleMs: number) => {
      setAdShowFailed(false);
      if (terminalTransition.isPending) return;
      logFtueEvent({ type: 'removal' });
      if (stallHintTimer.onRemoval(Date.now())) scheduleStallHint();
      if (activeTutorialId === 'T2') {
        setTutorialLine((current) => current === T2_BLOCKED_LINE ? '' : current);
      }
      if (feedbackEnabled) {
        const combo = nextExitCombo(exitCombo.current, Date.now());
        exitCombo.current = combo;
        feedback('exit', SaveSystem.soundOn, combo.step);
      }
      removalsThisBoardRef.current += 1;
      setRemaining(level.board.count());
      if (!cleared) return;
      const ftueStageAtClear = SaveSystem.ftueStage;
      assistedAtClearRef.current = ftueStageAtClear === ASSIST_STAGE;
      const perfect = heartsRef.current === level.hearts;
      perfectAtClearRef.current = perfect;
      // W2-06 (META_POST_CLEAR_TIMELINE): the final exit's last pixel, then the same empty-board hold (and W5-17's
      // reveal slot, only when the outline is drawn) whatever that exit did. OFF: the flat 450 ms from the tap.
      const revealMs = clearRevealSlotMs({
        enabled: ART_CLEAR_REVEAL_ENABLED, reducedMotion, mask: level.mask,
      });
      const wonDelayMs = META_POST_CLEAR_TIMELINE || ART_CLEAR_REVEAL_ENABLED
        ? wonPanelDelayMs(exitVisibleMs, EMPTY_BOARD_HOLD_MS, revealMs)
        : WON_PANEL_DELAY_MS;
      if (CAPTURE_DIAG) {
        console.log(`[capture-diag] clear wonDelayMs=${Math.round(wonDelayMs)} exitVisibleMs=${Math.round(exitVisibleMs)}`
          + ` holdMs=${EMPTY_BOARD_HOLD_MS} revealMs=${revealMs}`);
      }
      if (activeTutorialId) {
        const nextTutorialId = activeTutorialId === 'T1' ? 'T2' : undefined;
        if (!beginTerminalTransition('won', wonDelayMs, () => {
          if (nextTutorialId) {
            loadTutorial(nextTutorialId);
          } else {
            loadLevel(SaveSystem.currentLevel);
          }
        })) return;
        levelAggregatorRef.current.end('cleared', heartsRef.current, Date.now());
        SaveSystem.setFtueStage(
          activeTutorialId === 'T1' ? T1_CLEARED_STAGE : ASSIST_STAGE,
        );
      } else {
        if (!beginTerminalTransition('won', wonDelayMs)) return;
        levelAggregatorRef.current.end('cleared', heartsRef.current, Date.now());
        if (!benchmarkMode) {
          if (ftueStageAtClear === ASSIST_STAGE && perfect) {
            SaveSystem.setFtueStage(DONE_STAGE);
          }
          SaveSystem.registerSolve(perfect); // perfect = no heart lost
          setClearReward(rewardPathEnabled() ? recordRewardClear(dailyDay !== null ? 'daily' : 'campaign', perfect) : null);
          if (dailyDay !== null) {
            // W4-06: a daily is not a campaign level and adds no ad exposure.
            // W4-07: it records the cleared board's shape in the collection.
            newlyDiscoveredRef.current =
              SaveSystem.registerDailyClear(dailyDay, level.shapeName).newlyDiscovered;
          } else {
            SaveSystem.setCurrentLevel(levelIndex + 1);
            // W4-07: O(1) when the collection fold is caught up; else the menu folds it.
            newlyDiscoveredRef.current = SaveSystem.recordCampaignClear(levelIndex).newlyDiscovered;
            Ads.registerGameFinished(); // counts toward the every-2-games interstitial
          }
        }
      }
      logFtueEvent({ type: 'clear', heartsLeft: heartsRef.current });
      if (feedbackEnabled) {
        feedback('cleared', SaveSystem.soundOn);
      }
    },
    [
      activeTutorialId,
      benchmarkMode,
      beginTerminalTransition,
      dailyDay,
      feedbackEnabled,
      level,
      levelIndex,
      loadLevel,
      loadTutorial,
      logFtueEvent,
      reducedMotion,
      scheduleStallHint,
      stallHintTimer,
      terminalTransition,
    ],
  );

  // Returns whether this blocked tap charged a heart; BoardView marks only those
  // arrows (POLISH-T5, META_MISSED_MARK). Grace and assist taps cost nothing.
  const onBlocked = useCallback((ledgerCharge: boolean): boolean => {
    setAdShowFailed(false);
    if (terminalTransition.isPending) return false;
    exitCombo.current = null;

    const mode = activeTutorialId === 'T2'
      ? 'tutorialGrace'
      : assistActive({
        enabled: FTUE_ENABLED,
        assistEnabled: FTUE_ASSIST_ENABLED,
        stage: SaveSystem.ftueStage,
      })
        ? 'assist'
        : 'normal';
    const cost = blockedTapCost({
      ledgerCharge,
      mode,
      graceAvailable: tutorialGraceAvailableRef.current,
      removalsThisBoard: removalsThisBoardRef.current,
    });
    logFtueEvent({
      type: 'blocked',
      charged: cost.chargeHeart,
      graceOrAssist: cost.consumeGrace
        ? 'grace'
        : mode === 'assist' && ledgerCharge && removalsThisBoardRef.current === 0
          ? 'assist'
          : 'none',
    });
    if (cost.consumeGrace) {
      tutorialGraceAvailableRef.current = false;
      setTutorialLine(T2_BLOCKED_LINE);
    }
    if (!cost.chargeHeart) {
      // Both free cases still bump the arrow and flash its blocker. Tutorial
      // grace keeps the teaching thud; a ledger-refunded repeat gets a nudge.
      if (feedbackEnabled) {
        feedback(cost.consumeGrace ? 'blocked' : 'nudge', SaveSystem.soundOn);
      }
      return false;
    }
    if (feedbackEnabled) {
      feedback('blocked', SaveSystem.soundOn);
    }
    const left = heartsRef.current - 1;
    heartsRef.current = left;
    setHearts(left);
    levelAggregatorRef.current.heartLost();
    const reloadTutorial = activeTutorialId
      ? () => restartTutorial(activeTutorialId)
      : undefined;
    if (left <= 0 && beginTerminalTransition('lost', LOSE_PANEL_DELAY_MS, reloadTutorial)) {
      levelAggregatorRef.current.end('out_of_hearts', 0, Date.now());
      if (!benchmarkMode && !activeTutorialId && dailyDay === null) {
        Ads.registerGameFinished(); // a loss counts toward the pacing too (never a daily, W4-06)
      }
    }
    return true;
  }, [
    activeTutorialId,
    benchmarkMode,
    beginTerminalTransition,
    dailyDay,
    feedbackEnabled,
    logFtueEvent,
    restartTutorial,
    terminalTransition,
  ]);

  /** W4-11: drop a pending (not yet fired) store-review ask. */
  const cancelReviewAsk = useCallback(() => {
    if (reviewTimerRef.current === null) return;
    clearTimeout(reviewTimerRef.current);
    reviewTimerRef.current = null;
  }, []);

  /**
   * W4-11: the dwell on the win panel is over and the player is still on it.
   * Ask only if the policy allows it, never while an ad is up and never when
   * this panel's Next would show an interstitial (a daily never does).
   */
  const askForReview = useCallback(() => {
    if (adBusyRef.current) return;
    const input = {
      perfect: perfectAtClearRef.current,
      assisted: assistedAtClearRef.current,
      totalSolved: SaveSystem.totalSolved,
      today: SaveSystem.today(),
      count: SaveSystem.reviewCount,
      lastDay: SaveSystem.reviewLastDay,
      askedThisSession: reviewSession.asked,
    };
    const decline = reviewDeclineReason(input)
      ?? (!SaveSystem.persistenceHealthy ? 'persistence_unhealthy'
        : dailyDay === null && Ads.interstitialDue ? 'interstitial_due'
          : null);
    reviewDiag(`check decline=${decline ?? 'none'} ${JSON.stringify(input)}`);
    if (decline !== null) return;
    reviewSession.asked = true;
    reviewFlowRef.current = requestStoreReview(input.today).finally(() => {
      reviewFlowRef.current = null;
    });
  }, [dailyDay]);

  // W4-11 (META_REVIEW_PROMPT): arm the ask when the won panel commits, in
  // campaign and daily mode. Leaving the panel (the phase changes), unmounting
  // or the app leaving the foreground cancels it: JS timers do not run while
  // Android has the app paused, so a kept timer would ask right at resume.
  // OFF: no timer and no listener; expo-store-review is never loaded.
  useEffect(() => {
    if (!META_REVIEW_PROMPT || phase !== 'won' || benchmarkMode || activeTutorialId || clearReward?.unlock) {
      return undefined;
    }
    reviewTimerRef.current = setTimeout(() => {
      reviewTimerRef.current = null;
      askForReview();
    }, REVIEW_DWELL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') cancelReviewAsk();
    });
    return () => {
      cancelReviewAsk();
      appState.remove();
    };
  }, [activeTutorialId, askForReview, benchmarkMode, cancelReviewAsk, phase, clearReward]);

  /**
   * W4-11: Next / Done wait (at most REVIEW_FLOW_WAIT_MAX_MS) for an in-flight
   * review flow, so its card never lands over an interstitial or the next
   * board. Resolves false for a second press made while already waiting.
   */
  const waitForReviewFlow = useCallback(async (flow: Promise<void>): Promise<boolean> => {
    if (reviewWaitRef.current) return false;
    reviewWaitRef.current = true;
    try {
      await settleWithin(flow, REVIEW_FLOW_WAIT_MAX_MS);
    } finally {
      reviewWaitRef.current = false;
    }
    return true;
  }, []);

  /** "Next level" after a clear: the paced interstitial slots in between. */
  const onNextLevel = useCallback(async () => {
    // W4-11: leaving the panel drops a pending ask. Nothing is awaited unless
    // a review flow is in flight (never with the flag OFF).
    cancelReviewAsk();
    const reviewFlow = reviewFlowRef.current;
    if (reviewFlow && !(await waitForReviewFlow(reviewFlow))) return;
    if (levelScrim) {
      // A press while a transition (or its ad) runs is ignored, before any ad
      // is asked for.
      if (levelScrim.busy || nextPendingRef.current) return;
      nextPendingRef.current = true;
      try {
        if (!benchmarkMode) {
          setAdBusy(true);
          try {
            // After a shown ad the panel is seen again (the button stays
            // disabled) before the cover starts.
            await showAdThenPanelBeat(() => Ads.showInterstitialIfDue());
          } finally {
            setAdBusy(false);
          }
        }
        // The ad (if any) has closed and the panel is back: cover, swap, uncover.
        levelScrim.start(() => loadLevel(levelIndex + 1));
      } finally {
        nextPendingRef.current = false;
      }
      return;
    }
    if (benchmarkMode) {
      loadLevel(levelIndex + 1);
      return;
    }
    setAdBusy(true);
    try {
      await Ads.showInterstitialIfDue();
    } finally {
      setAdBusy(false);
    }
    loadLevel(levelIndex + 1);
  }, [benchmarkMode, cancelReviewAsk, levelIndex, levelScrim, loadLevel, waitForReviewFlow]);

  /**
   * W4-13 (META_SHARE_CARD): the day's card as plain text through Android's share sheet. The app sends nothing: the
   * player picks the chat (or cancels) and can edit the text. The result is ignored; a failure changes nothing.
   */
  const onShareDaily = useCallback(() => {
    if (dailyDay === null) return;
    const message = buildDailyShareText({
      day: dailyDay,
      mask: level.mask,
      shapeName: level.shapeName,
      heartsLeft: heartsRef.current,
      maxHearts: level.hearts,
      streak: SaveSystem.dayStreak,
    });
    Share.share({ message }).catch(() => undefined);
  }, [dailyDay, level]);

  /** "Done" after a daily clear (W4-06): back to the menu; no ad, no next board, no scrim. */
  const dailyDonePressedRef = useRef(false);
  const onDailyDone = useCallback(async () => {
    if (dailyDonePressedRef.current) return;
    dailyDonePressedRef.current = true;
    // W4-11: as Next (no await unless a review flow is in flight).
    cancelReviewAsk();
    const reviewFlow = reviewFlowRef.current;
    if (reviewFlow) await waitForReviewFlow(reviewFlow);
    onHome();
  }, [cancelReviewAsk, onHome, waitForReviewFlow]);

  /** "Retry" on the lose panel (a daily rebuilds the same day's board). */
  const onRetry = useCallback(() => {
    const restart = dailyDay !== null
      ? () => restartDaily(dailyDay)
      : () => restartLevel(levelIndex);
    if (levelScrim) {
      levelScrim.start(restart);
      return;
    }
    restart();
  }, [dailyDay, levelIndex, levelScrim, restartDaily, restartLevel]);

  /** Rewarded "+1 heart continue" from the lose panel. */
  const onContinueWithAd = useCallback(async () => {
    // W2-04: a Retry is already swapping the level under the scrim.
    if (levelScrim?.busy) return;
    // W2-05: the panel is already fading out after an earned continue.
    if (panelPresence?.state === 'exiting') return;
    setAdShowFailed(false); // the label describes the latest attempt only
    setAdBusy(true);
    const earned = await Ads.showRewarded('continue');
    setAdBusy(false);
    if (!earned) {
      setAdShowFailed(true); // stay on the lose panel and say so; nothing granted
      return;
    }
    levelAggregatorRef.current.resume();
    terminalTransition.reset();
    // W2-05: the panel stays mounted (touch-transparent, board locked) while
    // it fades out over the board it returns to.
    panelPresence?.hide(reducedMotion ? 0 : PANEL_EXIT_MS);
    setTerminalPending(false);
    heartsRef.current = 1;
    setHearts(1);
    setPhase('playing');
    if (META_HEART_REFILL_POP) {
      // W2-07: the refilled pip pops once the panel is gone (at once without W2-05).
      if (panelPresence) setRefillPending(true);
      else setRefillToken((token) => token + 1);
    }
  }, [levelScrim, panelPresence, reducedMotion, terminalTransition]);

  /** Rewarded hint: pulse an arrow that can slither out right now. */
  const onHint = useCallback(async () => {
    if (phase !== 'playing' || terminalPending || adBusy) return;
    const arrow = level.board.findHint();
    if (!arrow) return;
    setAdShowFailed(false); // the label describes the latest attempt only
    setAdBusy(true);
    const earned = await Ads.showRewarded('hint');
    setAdBusy(false);
    if (!earned) {
      setAdShowFailed(true); // "Hint unavailable"; no hint without a reward
      return;
    }
    levelAggregatorRef.current.hintUsed();
    // Re-find: the board may have changed while the ad played.
    const fresh = level.board.findHint();
    if (fresh) setHint({ arrow: fresh, id: hintId.current++ });
  }, [phase, terminalPending, adBusy, level]);

  // W2-05: while the panel fades out (phase is already 'playing') it keeps
  // showing the lose panel. It also keeps the ad state the player pressed
  // Continue on: the shown rewarded ad is consumed (not ready) before the
  // reward resolves, which would otherwise flip the fading panel to "No ad
  // available". OFF (no latch): these equal phase / rewardedReady / adShowFailed.
  const lastPanelPhaseRef = useRef<TerminalPhase>('lost');
  if (phase !== 'playing') lastPanelPhaseRef.current = phase;
  const panelPhase: TerminalPhase = phase !== 'playing' ? phase : lastPanelPhaseRef.current;
  const holdPressedAdState = panelPresence !== null && (adBusy || panelExiting);
  const panelRewardedReady = holdPressedAdState || rewardedReady;
  const panelAdShowFailed = !holdPressedAdState && adShowFailed;
  const overlayMounted = !activeTutorialId && (phase !== 'playing' || panelExiting);
  // W5-05 (ART_PANEL_DEPTH_ENABLED): the panel's depth comes from value alone (no shadow, gradient or
  // glow): its fill and both scrims are palette tokens whose composited edge is gated (contrastAudit.ts
  // `panel-edge-*`). OFF: today's scrims and `surface`, unchanged.
  const overlayScrimColor = ART_PANEL_DEPTH_ENABLED
    ? panelPhase === 'lost' ? p.scrimLost : p.scrimWon
    : panelPhase === 'lost' ? hexA(p.bg, 0.86) : 'rgba(0,0,0,0.45)';
  const panelFill = ART_PANEL_DEPTH_ENABLED ? p.surfaceRaised : p.surface;
  // W5-05: spacing hierarchy only (outcome, then evidence, then action). `null` spreads to nothing, so the
  // flag-OFF style objects are exactly today's.
  const depthTitleSpacing = ART_PANEL_DEPTH_ENABLED ? styles.panelTitleDepth : null;
  const depthSubSpacing = ART_PANEL_DEPTH_ENABLED ? styles.panelSubDepth : null;

  // W3-20 (TIER_LABEL_V2_ENABLED): the header's tier word and colour come from the board's arrow count;
  // OFF, from the cycle (level.difficulty), as before (tierLabel.ts).
  const labelTier = headerTier(level);
  const diffColor =
    labelTier === Difficulty.SuperHard ? p.heartText
    : labelTier === Difficulty.Hard ? p.accentText
    : p.inkDim;

  // HEADER-FIT: "Hint unavailable ·" stands in for the mission words, which can take one line more once the subline
  // wraps. While it shows, the row keeps the height it had with the mission words, so a failed hint (cleared again
  // by the next board tap) never resizes the board under the player and re-fits its camera.
  const showHintFailed = adShowFailed && phase === 'playing';
  const hintFailedShownRef = useRef(showHintFailed);
  hintFailedShownRef.current = showHintFailed;
  const missionRowHeight = useRef(0);
  // HEADER-FIT: the title that wrapped (onTextLayout saw two lines) switches to one shrinking line; any other title
  // keeps the plain Text it always had.
  const titleKey = dailyDay !== null ? DAILY_HEADER_LABEL : `LEVEL ${levelIndex + 1}`;
  const [wrappedTitle, setWrappedTitle] = useState<string | null>(null);
  const fitTitle = wrappedTitle === titleKey;
  const onTitleTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (e.nativeEvent.lines.length > 1) setWrappedTitle(titleKey);
  }, [titleKey]);
  const onMissionRowLayout = useCallback((e: LayoutChangeEvent) => {
    if (!hintFailedShownRef.current) missionRowHeight.current = e.nativeEvent.layout.height;
  }, []);

  // W5-04 (ART_WIN_SILHOUETTE_ENABLED): the cleared board's outline for the win
  // panel. `level` is replaced on every loadSession (the board reference inside
  // it is not), so the memo follows the level. '' for an empty mask (W1's
  // tutorial boards) and whenever the flag is OFF, where it is never computed.
  const winSilhouette = useMemo(
    () => (ART_WIN_SILHOUETTE_ENABLED ? silhouettePath(level.mask, ART_WIN_SILHOUETTE_DP) : ''),
    [level],
  );

  const panelContent = overlayMounted ? (
    panelPhase === 'won' && clearReward?.unlock ? (
      <RewardRevealCard unlock={clearReward.unlock} mode={dailyDay !== null ? 'daily' : 'campaign'}
        levelNumber={levelIndex + 1} points={rewards?.points ?? 0} palette={p} dark={darkMode}
        reducedMotion={reducedMotion} disabled={adBusy}
        onShown={() => markRevealSeen(clearReward.unlock!.pathIndex)}
        onUse={() => { chooseArrowStyle(clearReward.unlock!.entry.refId); dailyDay !== null ? onDailyDone() : onNextLevel(); }}
        onKeep={() => (dailyDay !== null ? onDailyDone() : onNextLevel())} />
    ) : (
    <>
      <Text style={[styles.panelTitle, { color: panelPhase === 'won' ? p.accent : p.heart, ...depthTitleSpacing }]}>
        {panelPhase === 'won' ? 'Cleared!' : 'Out of hearts'}
      </Text>
      {panelPhase === 'won' && winSilhouette !== '' && (
        // W5-04: no animation of its own; it enters with the panel (W2-05).
        // The subline still names the shape, so the badge adds no text.
        <Svg
          testID="win-silhouette"
          width={ART_WIN_SILHOUETTE_DP}
          height={ART_WIN_SILHOUETTE_DP}
          style={styles.winSilhouette}
        >
          <SvgPath d={winSilhouette} fill={p.accent} fillRule="evenodd" />
        </Svg>
      )}
      {panelPhase === 'won' && (
        <Stars
          earned={Math.max(1, hearts)}
          total={level.hearts}
          palette={p}
          feedbackEnabled={feedbackEnabled}
        />
      )}
      {panelPhase === 'won' && rewards && clearReward && !clearReward.unlock && (
        <RewardProgressPill state={rewards} earned={clearReward.earned} palette={p} />
      )}
      <Text style={[styles.panelSub, { color: p.inkDim, ...depthSubSpacing }]}>
        {panelPhase === 'won'
          ? dailyDay !== null
            ? `${DAILY_WIN_PREFIX} · ${level.shapeName} · ${level.arrowCount} arrows`
            : `Level ${levelIndex + 1} · ${level.shapeName} · ${level.arrowCount} arrows`
          : !panelRewardedReady || panelAdShowFailed
            ? 'No ad available right now — Retry is free'
            : 'The shape got the better of you.'}
      </Text>
      {panelPhase === 'lost' && (
        <PressScale
          disabled={!panelRewardedReady || adBusy}
          accessibilityState={{ disabled: !panelRewardedReady || adBusy }}
          accessibilityRole="button"
          accessibilityLabel={CONTINUE_A11Y_LABEL}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: !panelRewardedReady
                ? p.bg // inactive well; keeps the inkDim label ≥4.5:1 (W0-06)
                : pressed ? p.accentDeep : p.accent,
              marginBottom: 12,
              transform: pressSnapTransform(pressed),
            },
          ]}
          onPress={onContinueWithAd}
        >
          {ART_ICONS_ENABLED ? (
            // W5-02: the heart is an icon in the label's colour (the ♥ glyph is a red emoji on Android).
            <View style={styles.labelRow}>
              <Text style={[styles.buttonText, { color: panelRewardedReady ? p.inkOnAccent : p.inkDim }]}>
                Continue +
              </Text>
              <Icon name="heart" size={CONTINUE_HEART_DP} color={panelRewardedReady ? p.inkOnAccent : p.inkDim} />
              <Text style={[styles.buttonText, { color: panelRewardedReady ? p.inkOnAccent : p.inkDim }]}>
                {' (ad)'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.buttonText, { color: panelRewardedReady ? p.inkOnAccent : p.inkDim }]}>
              Continue +♥ (ad)
            </Text>
          )}
        </PressScale>
      )}
      <PressScale
        testID={benchmarkMode && panelPhase === 'won' ? 'perf-next-level' : undefined}
        accessibilityLabel={benchmarkMode && panelPhase === 'won' ? 'perf-next-level' : undefined}
        disabled={adBusy}
        style={({ pressed }) => [
          styles.button,
          { transform: pressSnapTransform(pressed) },
          panelPhase === 'lost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border },
          panelPhase === 'won' && { backgroundColor: pressed ? p.accentDeep : p.accent },
        ]}
        onPress={() => (
          panelPhase === 'won' ? (dailyDay !== null ? onDailyDone() : onNextLevel()) : onRetry()
        )}
      >
        <Text style={[styles.buttonText, { color: panelPhase === 'won' ? p.inkOnAccent : p.inkDim }]}>
          {panelPhase === 'won' ? (dailyDay !== null ? DAILY_DONE_LABEL : 'Next level') : 'Retry'}
        </Text>
      </PressScale>
      {/* W4-13 (META_SHARE_CARD): the daily win panel only. A plain secondary control (Retry's outline style). */}
      {panelPhase === 'won' && dailyDay !== null && META_SHARE_CARD && (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={DAILY_SHARE_LABEL}
          disabled={adBusy}
          style={({ pressed }) => [
            styles.button,
            styles.shareButton,
            { borderColor: p.border, transform: pressSnapTransform(pressed) },
          ]}
          onPress={onShareDaily}
        >
          <Text style={[styles.buttonText, { color: p.inkDim }]}>{DAILY_SHARE_LABEL}</Text>
        </PressScale>
      )}
      {panelPhase === 'won' && SaveSystem.perfectStreak > 1 && (ART_ICONS_ENABLED ? (
        // W5-02: sparkle icon, then the text (the ✦ glyph came from whatever font the OS picked).
        <View style={[styles.labelRow, styles.streakRow]}>
          <View style={styles.streakSparkle}>
            <Icon name="sparkle" size={STREAK_SPARKLE_DP} color={p.accentText} />
          </View>
          <Text style={[styles.streak, styles.streakText, { color: p.accentText }]}>
            {SaveSystem.perfectStreak} perfect in a row
          </Text>
        </View>
      ) : (
        <Text style={[styles.streak, { color: p.accentText }]}>
          ✦ {SaveSystem.perfectStreak} perfect in a row
        </Text>
      ))}
    </>)
  ) : null;

  return (
    <View
      testID={benchmarkMode ? 'perf-game-screen' : undefined}
      style={[styles.root, { backgroundColor: p.bg }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={[styles.headerLeft, activeTutorialId && styles.tutorialHeaderLeft]}>
          <HeaderButton label="‹" icon="back" accessibilityLabel={BACK_A11Y_LABEL} palette={p} onPress={onHomePress} />
          {activeTutorialId ? (
            // A box two lines tall at the player's font scale (lineHeight scales
            // with it); one line sits centred in it, level with the buttons.
            <View
              testID="tutorial-line-box"
              style={[
                styles.tutorialLabelBox,
                { minHeight: tutorialLineBoxHeight(fontScale, PixelRatio.get()) },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[styles.levelLabel, styles.tutorialLabel, { color: p.accentText }]}
              >
                {tutorialLine}
              </Text>
            </View>
          ) : (
            // HEADER-FIT: this column gives way when the header is too narrow (the hearts and hint keep theirs):
            // the title shrinks to fit, the subline wraps (see missionLabelRow).
            <View style={styles.headerTitleColumn}>
              <Text
                numberOfLines={fitTitle ? 1 : undefined}
                adjustsFontSizeToFit={fitTitle || undefined}
                minimumFontScale={fitTitle ? HEADER_TITLE_MIN_FONT_SCALE : undefined}
                onTextLayout={fitTitle ? undefined : onTitleTextLayout}
                style={[styles.levelLabel, { color: p.accentLight }]}
              >
                {dailyDay !== null ? DAILY_HEADER_LABEL : <>LEVEL {levelIndex + 1}</>}
              </Text>
              <View
                onLayout={onMissionRowLayout}
                style={[styles.missionLabelRow, showHintFailed && { minHeight: missionRowHeight.current }]}
              >
                {showHintFailed ? (
                  // Takes the mission label's place while shown: appended after
                  // "N left" it pushed the hint button off a 411 dp-wide screen.
                  <Text style={[styles.diffLabel, styles.missionText, { color: diffColor }]}>
                    Hint unavailable ·{' '}
                  </Text>
                ) : (
                  <MissionLabel
                    difficulty={labelTier}
                    shapeName={level.shapeName}
                    color={diffColor}
                    mask={level.mask}
                  />
                )}
                {/* W5-03: one element for screen readers, as the single Text was. */}
                <View
                  accessible
                  accessibilityLabel={`${remaining} left`}
                  style={styles.counterRow}
                >
                  <View>
                    <Text
                      style={[styles.diffLabel, styles.counterGhost]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      {WIDEST_DIGIT.repeat(String(level.arrowCount).length)}
                    </Text>
                    <Text style={[styles.diffLabel, styles.counterDigits, { color: diffColor }]}>
                      {remaining}
                    </Text>
                  </View>
                  <Text style={[styles.diffLabel, { color: diffColor }]}>{' left'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
        <View style={[styles.headerRight, activeTutorialId && styles.tutorialHeaderRight]}>
          <HeartPips
            // W2-07: a continue refills from 0; the pip shows it with its pop.
            left={refillPending ? 0 : hearts}
            max={level.hearts}
            palette={p}
            refillToken={refillToken}
          />
          {!activeTutorialId && (
            <HeaderButton
              label="💡"
              icon="hint"
              accessibilityLabel={HINT_A11Y_LABEL}
              palette={p}
              onPress={onHint}
              active={!terminalPending && !adBusy && !panelExiting}
              disabled={!hintReady || terminalPending || adBusy || panelExiting}
            />
          )}
        </View>
      </View>

      {/* Board persists across missions; BoardView resets its mission state. */}
      <BoardView
        board={level.board}
        palette={boardPalette}
        onRemoved={onRemoved}
        onBlocked={onBlocked}
        clearRevealMask={ART_CLEAR_REVEAL_ENABLED ? level.mask : undefined}
        onTapOutcome={onTapOutcome}
        locked={phase !== 'playing' || terminalPending || adBusy || panelExiting}
        hint={hint}
        clearHint={clearHint}
        testID={benchmarkMode ? 'perf-board' : undefined}
      />

      {/* OWNER 2026-09-30: the board shows dots only; the POLISH-T4 "#" grid-lines toggle is removed. */}

      {/* Win / lose overlays */}
      {overlayMounted && (panelPresence ? (
        <PanelOverlayFrame
          testID={benchmarkMode ? 'perf-terminal-overlay' : undefined}
          presence={panelPresenceValue}
          state={panelState}
          scrimColor={overlayScrimColor}
          overlayStyle={styles.overlay}
          panelStyle={[styles.panel, { backgroundColor: panelFill, borderColor: p.border }]}
        >
          {panelContent}
        </PanelOverlayFrame>
      ) : (
        <View
          testID={benchmarkMode ? 'perf-terminal-overlay' : undefined}
          style={[styles.overlay, { backgroundColor: overlayScrimColor }]}
        >
          <View style={[styles.panel, { backgroundColor: panelFill, borderColor: p.border }]}>
            {panelContent}
          </View>
        </View>
      ))}

      {/* W2-04: last child, so it covers the header, board and panel. */}
      {levelScrim && <ScreenScrim color={p.bg} opacity={scrimOpacity} />}
    </View>
  );
}

function initialTutorialLine(tutorialId: TutorialId | undefined): string {
  if (tutorialId === 'T1') return T1_LINE;
  if (tutorialId === 'T2') return T2_LINE;
  return '';
}

/**
 * W4-11: the only store-review call site (storePolicyGuard.test.ts). Fire and
 * forget: the panel never awaits it (Next / Done may, bounded). The bookkeeping
 * is written after isAvailableAsync says yes and BEFORE the OS call, whatever
 * the OS then shows: Play and Apple may show nothing and never say which.
 * Never throws: a missing native module or a failed request is only logged.
 */
async function requestStoreReview(today: number): Promise<void> {
  const startedAt = Date.now();
  try {
    const StoreReview = loadStoreReview();
    const available = await StoreReview.isAvailableAsync();
    reviewDiag(`isAvailableAsync=${available} after ${Date.now() - startedAt} ms`);
    if (!available) return;
    if (!SaveSystem.recordReviewRequest(today)) return;
    reviewDiag(`request count=${SaveSystem.reviewCount} lastDay=${SaveSystem.reviewLastDay}`);
    await StoreReview.requestReview();
    reviewDiag(`request resolved after ${Date.now() - startedAt} ms`);
  } catch (error) {
    reviewDiag(`request failed after ${Date.now() - startedAt} ms: ${String(error)}`);
  }
}

const readRewardedReady = () => Ads.rewardedReady;
const subscribeNoPresence = () => () => undefined;
const readNoPresence = (): PresenceState => 'hidden';
const subscribeHintReady = (cb: (ready: boolean) => void) => Ads.subscribeRewardedReady(cb, 'hint');
const readHintReady = () => Ads.isRewardedReady('hint');

/**
 * Keep the per-level words out of the per-tap counter paragraph. React
 * Native caches measured paragraphs by their full attributed string; this
 * bounds gameplay to the small set of numeric counter labels instead of one
 * unique long paragraph for every removal across every mission.
 */
const MissionLabel = React.memo(function MissionLabel({
  difficulty,
  shapeName,
  color,
  mask,
}: {
  difficulty: Difficulty;
  shapeName: string;
  color: string;
  /** W5-06: the level's silhouette mask (empty on W1's tutorial boards). */
  mask: readonly (readonly boolean[])[];
}) {
  // W5-06: the badge takes the word's place; an empty mask keeps the word.
  if (ART_HEADER_SILHOUETTE_ENABLED && mask.length > 0) {
    return <MissionBadgeRow difficulty={difficulty} shapeName={shapeName} color={color} mask={mask} />;
  }
  return (
    <Text style={[styles.diffLabel, styles.missionText, { color }]}>
      {Difficulties.displayName(difficulty)} · {shapeName} ·{' '}
    </Text>
  );
});

/**
 * W5-06: the header badge's edge per font scale: the tier Text's line height,
 * read from its first layout and kept for later game screens, so only the
 * first header at a font scale draws a frame without the badge. Exported for
 * the tests, which start each case unmeasured.
 */
export const HEADER_BADGE_LINE_BY_FONT_SCALE = new Map<number, number>();

/**
 * W5-06 (ART_HEADER_SILHOUETTE_ENABLED): `Super Hard · [badge] · `. The badge
 * replaces the shape-name word (the element count is unchanged), is drawn in
 * the word's colour with the even-odd rule, carries the shape name for screen
 * readers, and is exactly one line tall, so the row and the header keep their
 * height.
 */
function MissionBadgeRow({
  difficulty,
  shapeName,
  color,
  mask,
}: {
  difficulty: Difficulty;
  shapeName: string;
  color: string;
  mask: readonly (readonly boolean[])[];
}) {
  const { fontScale } = useWindowDimensions();
  const [line, setLine] = useState<number | null>(
    () => HEADER_BADGE_LINE_BY_FONT_SCALE.get(fontScale) ?? null,
  );
  const onTierLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (line !== null || !(height > 0)) return; // read once
    HEADER_BADGE_LINE_BY_FONT_SCALE.set(fontScale, height);
    setLine(height);
  }, [fontScale, line]);
  const path = useMemo(() => (line === null ? '' : silhouettePath(mask, line)), [line, mask]);
  return (
    <View style={styles.missionBadgeRow}>
      <Text onLayout={onTierLayout} style={[styles.diffLabel, { color }]}>
        {Difficulties.displayName(difficulty)} ·{' '}
      </Text>
      {line !== null && (
        <Svg
          testID="header-silhouette"
          accessible
          accessibilityLabel={shapeName}
          width={line}
          height={line}
        >
          <SvgPath d={path} fill={color} fillRule="evenodd" />
        </Svg>
      )}
      <Text style={[styles.diffLabel, { color }]}>
        {' '}·{' '}
      </Text>
    </View>
  );
}

/**
 * The heart row, one pip per heart. A pip that just went out pops (scale
 * ~1.35 springing back) as it dims — losing a life is unmistakable
 * (GameManager.SpendHeart). W2-07: a pip an earned continue refilled springs
 * up from below rest (heartPip.ts decides which pop plays).
 */
const HeartPips = React.memo(function HeartPips({
  left,
  max,
  palette,
  refillToken,
}: {
  left: number;
  max: number;
  palette: Palette;
  refillToken: number;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: max }, (_, i) => (
        <HeartPip key={i} filled={i < left} palette={palette} refillToken={refillToken} />
      ))}
    </View>
  );
});

/** The heart pip draws HEART_PATH (icons.tsx, W5-02 moved it there) filled, or
 * as an OUTLINE (stroke, no fill) once spent, so hearts left read by shape, not
 * by colour alone (W0-06). */
const HEART_SIZE = 22;
/** Spent-pip outline width in viewBox units (≈1.8 dp at HEART_SIZE 22). */
const SPENT_PIP_STROKE = 2; // OWNER-PICKED STARTING VALUE
/** The pip's spring back to rest, for the loss pop and (W2-07) the refill pop. */
const HEART_PIP_SPRING = { damping: 9, stiffness: 240 } as const;
/**
 * W2-07: with the flag ON the pop's start scale is written in a layout effect,
 * so it reaches the UI thread with the commit that changes the pip. The refill
 * commit comes from a passive effect (the panel's exit settling), whose own
 * passive effects React flushes after paint: with useEffect the filled pip
 * showed one frame at rest before shrinking (emulator capture,
 * artifacts/W2-07). A tap's commit (the loss pop) already flushes them before
 * paint. OFF: useEffect, exactly as before. The flag is a build-time constant,
 * so the hook order never changes.
 */
const usePipPopEffect = META_HEART_REFILL_POP ? useLayoutEffect : useEffect;

const HeartPip = React.memo(function HeartPip({
  filled,
  palette,
  refillToken,
}: {
  filled: boolean;
  palette: Palette;
  refillToken: number;
}) {
  const k = useSharedValue(1);
  const prev = useRef(filled);
  const prevToken = useRef(refillToken);
  usePipPopEffect(() => {
    const kind = pipPopKind(prev.current, filled, prevToken.current, refillToken);
    prev.current = filled;
    prevToken.current = refillToken;
    if (kind === 'none') return;
    k.value = kind === 'loss' ? HEART_PIP_LOSS_START_SCALE : HEART_PIP_REFILL_START_SCALE;
    // Decorative heart-pip scale follows the player's system setting.
    k.value = withSpring(1, { ...HEART_PIP_SPRING, reduceMotion: ReduceMotion.System });
  }, [filled, refillToken]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <Animated.View style={[style, { marginHorizontal: 1 }]}>
      <Svg width={HEART_SIZE} height={HEART_SIZE} viewBox="0 0 24 24">
        {filled ? (
          <SvgPath d={HEART_PATH} fill={palette.heart} />
        ) : (
          <SvgPath
            d={HEART_PATH}
            fill="none"
            stroke={palette.pipSpent}
            strokeWidth={SPENT_PIP_STROKE}
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
});

/**
 * Star rating on the win panel: one star per heart still beating. Stars pop
 * in left to right with a springy stagger; unearned slots settle in dim so
 * the player sees exactly what a cleaner run would have paid.
 */
function Stars({
  earned,
  total,
  palette,
  feedbackEnabled,
}: {
  earned: number;
  total: number;
  palette: Palette;
  feedbackEnabled: boolean;
}) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: total }, (_, i) => (
        <Star
          key={i}
          filled={i < earned}
          big={i === Math.floor(total / 2)}
          delay={FIRST_STAR_DELAY_MS + i * STAR_STAGGER_MS}
          palette={palette}
          feedbackEnabled={feedbackEnabled}
        />
      ))}
    </View>
  );
}

function Star({
  filled,
  big,
  delay,
  palette,
  feedbackEnabled,
}: {
  filled: boolean;
  big: boolean;
  delay: number;
  palette: Palette;
  feedbackEnabled: boolean;
}) {
  const k = useSharedValue(0);
  useEffect(() => {
    // Decorative star motion and its stagger follow the player's system setting.
    k.value = withDelay(
      delay,
      withSpring(1, {
        damping: 11,
        stiffness: 260,
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
    // Each earned star pops with a tiny rising chirp, timed to its entrance.
    if (filled && feedbackEnabled) {
      const t = setTimeout(() => feedback('star', SaveSystem.soundOn), delay);
      return () => clearTimeout(t);
    }
  }, [delay, feedbackEnabled, filled]);
  const style = useAnimatedStyle(() => ({
    opacity: k.value,
    transform: [{ scale: k.value }, { rotate: `${(1 - k.value) * -24}deg` }],
  }));
  const starColor = filled ? palette.accent : palette.starUnearned;
  const starType = big ? Type.starBig : Type.star;
  return (
    <Animated.View style={style}>
      {ART_ICONS_ENABLED ? (
        // W5-02: only the leaf changes; the box keeps the glyph's line height so the panel keeps its height.
        <View style={{ height: big ? 50 : 40, justifyContent: 'center', marginHorizontal: 6 }}>
          <Icon name="star" size={starType.fontSize} color={starColor} />
        </View>
      ) : (
        <Text
          style={{
            fontSize: starType.fontSize,
            lineHeight: big ? 50 : 40,
            color: starColor,
            marginHorizontal: 6,
          }}
        >
          ★
        </Text>
      )}
    </Animated.View>
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
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // HEADER-FIT: a long tier line shrinks this block, not the screen's right edge (it pushed the hint off 360 dp).
    flexShrink: 1,
  },
  tutorialHeaderLeft: { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0, // HEADER-FIT: the hearts and the hint keep their size and their right edge
  },
  headerTitleColumn: { flexShrink: 1 },
  tutorialHeaderRight: { flexShrink: 0 },
  levelLabel: {
    ...Type.gameLevel, // 24 (was 18: 18 bold is body text and accentLight fails 4.5:1, W0-06); matches Home
  },
  tutorialLabelBox: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  tutorialLabel: {
    flexShrink: 1,
    ...Type.gameTutorial,
    lineHeight: TUTORIAL_LINE_HEIGHT,
  },
  diffLabel: {
    ...Type.gameTier,
  },
  // HEADER-FIT: when "tier · shape · N left" is wider than the column, the counter moves to a second line whole (and
  // at large font scales the words wrap inside missionText). Never an ellipsis: the shape and the count stay readable.
  // A line that fits lays out exactly as before, so one-line levels keep their header height and board.
  missionLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: 2,
  },
  missionText: { flexShrink: 1 },
  // W5-06: the badge row; `center` keeps the one-line-tall badge inside the
  // texts' line box. Its baseline (for missionLabelRow) is the tier Text's.
  missionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // W5-03: the counter slot. The invisible ghost sets its width by normal text
  // layout (font scale and the web engine included); the digits are anchored
  // to its right edge and keep their own measured width, so a sub-pixel
  // rounding of the slot can never wrap them.
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  counterGhost: { opacity: 0 },
  counterDigits: {
    position: 'absolute',
    top: 0,
    right: 0,
    textAlign: 'right',
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
    ...Type.panelTitle,
  },
  // W5-05 (flag only): the outcome stands apart from its evidence (title -> badge / stars / subline 4 dp more)...
  panelTitleDepth: {
    marginBottom: 4, // OWNER-PICKED STARTING VALUE
  },
  // W5-04: the stars row's own 10 dp top margin, so title, badge and stars
  // are evenly spaced.
  winSilhouette: {
    marginTop: 10, // OWNER-PICKED STARTING VALUE
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 2,
    minHeight: 52,
  },
  panelSub: {
    ...Type.panelSub,
    marginTop: 6,
    marginBottom: 20,
  },
  // ...and the evidence from the action (subline -> first button 28 dp instead of 20).
  panelSubDepth: {
    marginBottom: 28, // OWNER-PICKED STARTING VALUE
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    ...Type.panelButton,
  },
  // W4-13: the daily Share control under Done (Retry's outline look).
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 12,
  },
  streak: {
    ...Type.panelStreak,
    marginTop: 14,
  },
  // W5-02 (ART_ICONS_ENABLED): a label with an icon inside it (Continue's heart, the streak's sparkle).
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The row takes the streak line's top margin; its text keeps the rest of the line's style.
  streakRow: {
    marginTop: 14,
  },
  streakText: {
    marginTop: 0,
  },
  streakSparkle: {
    marginRight: 4, // OWNER-PICKED STARTING VALUE (about one space of Fredoka 13)
  },
});

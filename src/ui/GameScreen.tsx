import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
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
import { Ads } from './ads';
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
import {
  createLevelSession,
  createTutorialSession,
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
import { blockedTapCost } from './tapRules';
import { Fonts, Palette } from './theme';

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
  onHome,
  tutorialId,
  initialLevelIndex,
  benchmarkMode = false,
  feedbackEnabled = true,
  onTelemetryProbeUnmount,
}: {
  palette: Palette;
  onHome: () => void;
  tutorialId?: TutorialId;
  initialLevelIndex?: number;
  benchmarkMode?: boolean;
  feedbackEnabled?: boolean;
  onTelemetryProbeUnmount?: () => void;
}) {
  const p = palette;
  const insets = useSafeAreaInsets(); // keep content clear of notches (SafeArea.cs)

  const revisionRef = useRef(0);
  const levelAggregatorRef = useRef(appLevelAggregator);
  const [session, setSession] = useState(() => {
    const index = initialLevelIndex ?? SaveSystem.currentLevel;
    const initial = tutorialId
      ? createTutorialSession(tutorialId, revisionRef.current)
      : createLevelSession(index, revisionRef.current);
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
  const tutorialGraceAvailableRef = useRef(activeTutorialId === 'T2');
  const removalsThisBoardRef = useRef(0);
  // W4-11 reads this at the delayed won-phase commit. Keep the stage-2
  // snapshot even when this clear immediately advances persisted stage to 3.
  const assistedAtClearRef = useRef(false);
  const [hearts, setHearts] = useState(() => level.hearts);
  const [remaining, setRemaining] = useState(() => level.arrowCount);
  const [tutorialLine, setTutorialLine] = useState(() => initialTutorialLine(activeTutorialId));
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [terminalPending, setTerminalPending] = useState(false);
  const [hint, setHint] = useState<{ arrow: ArrowPath; id: number } | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const rewardedReady = useSyncExternalStore(Ads.subscribeRewardedReady, readRewardedReady);
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
    writeFtueSessionLog(formatFtueSessionLog({
      type: 'board_mount',
      board: session.tutorialId ?? session.index,
    }, 0));
  }, [session]);
  useEffect(() => () => terminalTransition.dispose(), [terminalTransition]);
  useEffect(() => () => {
    levelAggregatorRef.current.end('abandoned', heartsRef.current, Date.now());
    onTelemetryProbeUnmount?.();
  }, []);
  // Subscribed directly (not via an effect on `rewardedReady`) so the clear
  // runs synchronously at the SDK callback, before a failed show's
  // `setAdShowFailed(true)` that follows it.
  useEffect(() => Ads.subscribeRewardedReady(() => setAdShowFailed(false)), []);
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

  const beginTerminalTransition = useCallback(
    (
      nextPhase: TerminalPhase,
      delayMs: number,
      commit?: (phase: TerminalPhase) => void,
    ) => {
      const accepted = terminalTransition.begin(nextPhase, delayMs, commit ?? setPhase);
      if (!accepted) return false;
      cancelStallHint();
      setTerminalPending(true);
      return true;
    },
    [cancelStallHint, terminalTransition],
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
    setTerminalPending(false);
    setSession(next);
    heartsRef.current = next.level.hearts;
    setHearts(next.level.hearts);
    setRemaining(next.level.arrowCount);
    tutorialGraceAvailableRef.current = next.tutorialId === 'T2';
    removalsThisBoardRef.current = 0;
    assistedAtClearRef.current = false;
    setTutorialLine(initialTutorialLine(next.tutorialId));
    exitCombo.current = null;
    setPhase('playing');
    setHint(null);
    setAdShowFailed(false);
  }, [cancelStallHint, terminalTransition]);

  const loadLevel = useCallback((index: number) => {
    revisionRef.current += 1;
    loadSession(createLevelSession(index, revisionRef.current));
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

  const onTapOutcome = useCallback((outcome: TapOutcome) => {
    levelAggregatorRef.current.tap(outcome);
  }, []);

  const onHomePress = useCallback(() => {
    levelAggregatorRef.current.end('abandoned', heartsRef.current, Date.now());
    onHome();
  }, [onHome]);

  const onRemoved = useCallback(
    (cleared: boolean) => {
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
      if (activeTutorialId) {
        const nextTutorialId = activeTutorialId === 'T1' ? 'T2' : undefined;
        if (!beginTerminalTransition('won', 450, () => {
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
        if (!beginTerminalTransition('won', 450)) return;
        levelAggregatorRef.current.end('cleared', heartsRef.current, Date.now());
        if (!benchmarkMode) {
          if (ftueStageAtClear === ASSIST_STAGE && perfect) {
            SaveSystem.setFtueStage(DONE_STAGE);
          }
          SaveSystem.registerSolve(perfect); // perfect = no heart lost
          SaveSystem.setCurrentLevel(levelIndex + 1);
          Ads.registerGameFinished(); // counts toward the every-2-games interstitial
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
      feedbackEnabled,
      level,
      levelIndex,
      loadLevel,
      loadTutorial,
      logFtueEvent,
      scheduleStallHint,
      stallHintTimer,
      terminalTransition,
    ],
  );

  const onBlocked = useCallback((ledgerCharge: boolean) => {
    setAdShowFailed(false);
    if (terminalTransition.isPending) return;
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
      return;
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
    if (left <= 0 && beginTerminalTransition('lost', 350, reloadTutorial)) {
      levelAggregatorRef.current.end('out_of_hearts', 0, Date.now());
      if (!benchmarkMode && !activeTutorialId) {
        Ads.registerGameFinished(); // a loss counts toward the pacing too
      }
    }
  }, [
    activeTutorialId,
    benchmarkMode,
    beginTerminalTransition,
    feedbackEnabled,
    logFtueEvent,
    restartTutorial,
    terminalTransition,
  ]);

  /** "Next level" after a clear: the paced interstitial slots in between. */
  const onNextLevel = useCallback(async () => {
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
  }, [benchmarkMode, levelIndex, loadLevel]);

  /** Rewarded "+1 heart continue" from the lose panel. */
  const onContinueWithAd = useCallback(async () => {
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
    setTerminalPending(false);
    heartsRef.current = 1;
    setHearts(1);
    setPhase('playing');
  }, [terminalTransition]);

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

  const diffColor =
    level.difficulty === Difficulty.SuperHard ? p.heartText
    : level.difficulty === Difficulty.Hard ? p.accentText
    : p.inkDim;

  return (
    <View
      testID={benchmarkMode ? 'perf-game-screen' : undefined}
      style={[styles.root, { backgroundColor: p.bg }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={[styles.headerLeft, activeTutorialId && styles.tutorialHeaderLeft]}>
          <HeaderButton label="‹" palette={p} onPress={onHomePress} />
          {activeTutorialId ? (
            <Text
              numberOfLines={2}
              style={[styles.levelLabel, styles.tutorialLabel, { color: p.accentText }]}
            >
              {tutorialLine}
            </Text>
          ) : (
            <View>
              <Text style={[styles.levelLabel, { color: p.accentLight }]}>
                LEVEL {levelIndex + 1}
              </Text>
              <View style={styles.missionLabelRow}>
                {adShowFailed && phase === 'playing' ? (
                  // Takes the mission label's place while shown: appended after
                  // "N left" it pushed the hint button off a 411 dp-wide screen.
                  <Text style={[styles.diffLabel, { color: diffColor }]}>
                    Hint unavailable ·{' '}
                  </Text>
                ) : (
                  <MissionLabel
                    difficulty={level.difficulty}
                    shapeName={level.shapeName}
                    color={diffColor}
                  />
                )}
                <Text style={[styles.diffLabel, { color: diffColor }]}>
                  {remaining} left
                </Text>
              </View>
            </View>
          )}
        </View>
        <View style={[styles.headerRight, activeTutorialId && styles.tutorialHeaderRight]}>
          <HeartPips left={hearts} max={level.hearts} palette={p} />
          {!activeTutorialId && (
            <HeaderButton
              label="💡"
              palette={p}
              onPress={onHint}
              active={!terminalPending && !adBusy}
              disabled={!rewardedReady || terminalPending || adBusy}
            />
          )}
        </View>
      </View>

      {/* Board persists across missions; BoardView resets its mission state. */}
      <BoardView
        board={level.board}
        palette={p}
        onRemoved={onRemoved}
        onBlocked={onBlocked}
        onTapOutcome={onTapOutcome}
        locked={phase !== 'playing' || terminalPending || adBusy}
        hint={hint}
        clearHint={clearHint}
        testID={benchmarkMode ? 'perf-board' : undefined}
      />

      {/* Win / lose overlays */}
      {!activeTutorialId && phase !== 'playing' && (
        <View
          testID={benchmarkMode ? 'perf-terminal-overlay' : undefined}
          style={[
            styles.overlay,
            { backgroundColor: phase === 'lost' ? hexA(p.bg, 0.86) : 'rgba(0,0,0,0.45)' },
          ]}
        >
          <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={[styles.panelTitle, { color: phase === 'won' ? p.accent : p.heart }]}>
              {phase === 'won' ? 'Cleared!' : 'Out of hearts'}
            </Text>
            {phase === 'won' && (
              <Stars
                earned={Math.max(1, hearts)}
                total={level.hearts}
                palette={p}
                feedbackEnabled={feedbackEnabled}
              />
            )}
            <Text style={[styles.panelSub, { color: p.inkDim }]}>
              {phase === 'won'
                ? `Level ${levelIndex + 1} · ${level.shapeName} · ${level.arrowCount} arrows`
                : !rewardedReady || adShowFailed
                  ? 'No ad available right now — Retry is free'
                  : 'The shape got the better of you.'}
            </Text>
            {phase === 'lost' && (
              <Pressable
                disabled={!rewardedReady || adBusy}
                accessibilityState={{ disabled: !rewardedReady || adBusy }}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: !rewardedReady
                      ? p.bg // inactive well; keeps the inkDim label ≥4.5:1 (W0-06)
                      : pressed ? p.accentDeep : p.accent,
                    marginBottom: 12,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
                onPress={onContinueWithAd}
              >
                <Text style={[styles.buttonText, { color: rewardedReady ? p.inkOnAccent : p.inkDim }]}>
                  Continue +♥ (ad)
                </Text>
              </Pressable>
            )}
            <Pressable
              testID={benchmarkMode && phase === 'won' ? 'perf-next-level' : undefined}
              accessibilityLabel={benchmarkMode && phase === 'won' ? 'perf-next-level' : undefined}
              disabled={adBusy}
              style={({ pressed }) => [
                styles.button,
                { transform: [{ scale: pressed ? 0.94 : 1 }] },
                phase === 'lost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border },
                phase === 'won' && { backgroundColor: pressed ? p.accentDeep : p.accent },
              ]}
              onPress={() => (phase === 'won' ? onNextLevel() : restartLevel(levelIndex))}
            >
              <Text style={[styles.buttonText, { color: phase === 'won' ? p.inkOnAccent : p.inkDim }]}>
                {phase === 'won' ? 'Next level' : 'Retry'}
              </Text>
            </Pressable>
            {phase === 'won' && SaveSystem.perfectStreak > 1 && (
              <Text style={[styles.streak, { color: p.accentText }]}>
                ✦ {SaveSystem.perfectStreak} perfect in a row
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function initialTutorialLine(tutorialId: TutorialId | undefined): string {
  if (tutorialId === 'T1') return T1_LINE;
  if (tutorialId === 'T2') return T2_LINE;
  return '';
}

const readRewardedReady = () => Ads.rewardedReady;

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
}: {
  difficulty: Difficulty;
  shapeName: string;
  color: string;
}) {
  return (
    <Text style={[styles.diffLabel, { color }]}>
      {Difficulties.displayName(difficulty)} · {shapeName} ·{' '}
    </Text>
  );
});

/**
 * The heart row, one pip per heart. A pip that just went out pops (scale
 * ~1.35 springing back) as it dims — losing a life is unmistakable
 * (GameManager.SpendHeart).
 */
const HeartPips = React.memo(function HeartPips({
  left,
  max,
  palette,
}: {
  left: number;
  max: number;
  palette: Palette;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: max }, (_, i) => (
        <HeartPip key={i} filled={i < left} palette={palette} />
      ))}
    </View>
  );
});

/** Filled-heart silhouette (24×24 viewBox). SVG fill honours our colour —
 * unlike the bare ♥ glyph, which Android paints as a red emoji regardless of
 * the text `color`, so a spent pip never dimmed (it stayed full red).
 * A spent pip is the same path as an OUTLINE (stroke, no fill), so hearts left
 * read by shape, not by colour alone (W0-06). */
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 ' +
  '4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 ' +
  '11.54L12 21.35z';
const HEART_SIZE = 22;
/** Spent-pip outline width in viewBox units (≈1.8 dp at HEART_SIZE 22). */
const SPENT_PIP_STROKE = 2; // OWNER-PICKED STARTING VALUE

const HeartPip = React.memo(function HeartPip({
  filled,
  palette,
}: {
  filled: boolean;
  palette: Palette;
}) {
  const k = useSharedValue(1);
  const prev = useRef(filled);
  useEffect(() => {
    if (prev.current && !filled) {
      k.value = 1.35;
      k.value = withSpring(1, { damping: 9, stiffness: 240 });
    }
    prev.current = filled;
  }, [filled]);
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
          delay={250 + i * 170}
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
    k.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 260 }));
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
  return (
    <Animated.View style={style}>
      <Text
        style={{
          fontSize: big ? 44 : 34,
          lineHeight: big ? 50 : 40,
          color: filled ? palette.accent : palette.starUnearned,
          marginHorizontal: 6,
        }}
      >
        ★
      </Text>
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
  },
  tutorialHeaderLeft: { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tutorialHeaderRight: { flexShrink: 0 },
  levelLabel: {
    fontSize: 24, // was 18: 18 bold is body text and accentLight fails 4.5:1 (W0-06); matches Home
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  tutorialLabel: {
    flexShrink: 1,
    fontSize: 18,
  },
  diffLabel: {
    fontSize: 12,
    fontFamily: Fonts.semi,
    letterSpacing: 0.5,
  },
  missionLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
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
    fontFamily: Fonts.bold,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 2,
    minHeight: 52,
  },
  panelSub: {
    fontSize: 14,
    fontFamily: Fonts.semi,
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
    fontFamily: Fonts.bold,
  },
  streak: {
    fontSize: 13,
    marginTop: 14,
    fontFamily: Fonts.semi,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import {
  ArrowPath,
  Difficulties,
  Difficulty,
  GeneratedLevel,
  LevelGenerator,
  SaveSystem,
} from '../core';
import { Ads } from './ads';
import { Sfx } from './audio';
import { BoardView } from './BoardView';
import { Haptic } from './haptics';
import { HeaderButton } from './HeaderButton';
import { Fonts, Palette } from './theme';

type Phase = 'playing' | 'won' | 'lost';

/**
 * One play session: header (home, level, difficulty, hearts), the pan/zoom
 * board, and the win / lose overlays. Progress lives in SaveSystem; the level
 * is regenerated from its index, so leaving to the menu loses no state.
 */
export function GameScreen({ palette, onHome }: { palette: Palette; onHome: () => void }) {
  const p = palette;
  const insets = useSafeAreaInsets(); // keep content clear of notches (SafeArea.cs)

  const [levelIndex, setLevelIndex] = useState(() => SaveSystem.currentLevel);
  const [attempt, setAttempt] = useState(0); // bump to regenerate the same index (Retry)
  const level: GeneratedLevel = useMemo(
    () => LevelGenerator.generate(levelIndex),
    [levelIndex, attempt],
  );
  const [hearts, setHearts] = useState(() => level.hearts);
  const [remaining, setRemaining] = useState(() => level.arrowCount);
  const [phase, setPhase] = useState<Phase>('playing');
  const [hint, setHint] = useState<{ arrow: ArrowPath; id: number } | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const hintId = useRef(1);

  const loadLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setAttempt((a) => a + 1);
    const next = LevelGenerator.generate(index);
    setHearts(next.hearts);
    setRemaining(next.arrowCount);
    setPhase('playing');
    setHint(null);
  }, []);

  const onRemoved = useCallback(
    (cleared: boolean) => {
      Sfx.playSuccess();
      Haptic.exit();
      setRemaining(level.board.count());
      if (!cleared) return;
      SaveSystem.registerSolve(hearts === level.hearts); // perfect = no heart lost
      SaveSystem.setCurrentLevel(levelIndex + 1);
      Ads.registerGameFinished(); // counts toward the every-2-games interstitial
      Sfx.playWin();
      Haptic.cleared();
      setTimeout(() => setPhase('won'), 450); // let the last slither finish
    },
    [hearts, level, levelIndex],
  );

  const onBlocked = useCallback(() => {
    Sfx.playFail();
    Haptic.blocked();
    setHearts((h) => {
      const left = h - 1;
      if (left <= 0) {
        Ads.registerGameFinished(); // a loss counts toward the pacing too
        setTimeout(() => setPhase('lost'), 350); // let the shake finish
      }
      return left;
    });
  }, []);

  /** "Next level" after a clear: the paced interstitial slots in between. */
  const onNextLevel = useCallback(async () => {
    setAdBusy(true);
    try {
      await Ads.showInterstitialIfDue();
    } finally {
      setAdBusy(false);
    }
    loadLevel(levelIndex + 1);
  }, [levelIndex, loadLevel]);

  /** Rewarded "+1 heart continue" from the lose panel. */
  const onContinueWithAd = useCallback(async () => {
    setAdBusy(true);
    const earned = await Ads.showRewarded();
    setAdBusy(false);
    if (!earned) return; // stay on the lose panel; Retry still works
    setHearts(1);
    setPhase('playing');
  }, []);

  /** Rewarded hint: pulse an arrow that can slither out right now. */
  const onHint = useCallback(async () => {
    if (phase !== 'playing' || adBusy) return;
    const arrow = level.board.findHint();
    if (!arrow) return;
    setAdBusy(true);
    const earned = await Ads.showRewarded();
    setAdBusy(false);
    if (!earned) return;
    // Re-find: the board may have changed while the ad played.
    const fresh = level.board.findHint();
    if (fresh) setHint({ arrow: fresh, id: hintId.current++ });
  }, [phase, adBusy, level]);

  const diffColor =
    level.difficulty === Difficulty.SuperHard ? p.heart
    : level.difficulty === Difficulty.Hard ? p.accent
    : p.inkDim;

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <HeaderButton label="‹" palette={p} onPress={onHome} />
          <View>
            <Text style={[styles.levelLabel, { color: p.accentLight }]}>
              LEVEL {levelIndex + 1}
            </Text>
            <Text style={[styles.diffLabel, { color: diffColor }]}>
              {Difficulties.displayName(level.difficulty)} · {level.shapeName} · {remaining} left
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <HeartPips left={hearts} max={level.hearts} palette={p} />
          <HeaderButton label="💡" palette={p} onPress={onHint} active={!adBusy} />
        </View>
      </View>

      {/* Board (remounts per level/attempt so pan/zoom refits) */}
      <BoardView
        key={`${levelIndex}:${attempt}`}
        board={level.board}
        palette={p}
        onRemoved={onRemoved}
        onBlocked={onBlocked}
        locked={phase !== 'playing' || adBusy}
        hint={hint}
        clearHint={() => setHint(null)}
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
            {phase === 'won' && (
              <Stars earned={Math.max(1, hearts)} total={level.hearts} palette={p} />
            )}
            <Text style={[styles.panelSub, { color: p.inkDim }]}>
              {phase === 'won'
                ? `Level ${levelIndex + 1} · ${level.shapeName} · ${level.arrowCount} arrows`
                : 'The shape got the better of you.'}
            </Text>
            {phase === 'lost' && (
              <Pressable
                disabled={adBusy}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: pressed ? p.accentDeep : p.accent,
                    marginBottom: 12,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
                onPress={onContinueWithAd}
              >
                <Text style={[styles.buttonText, { color: p.inkOnAccent }]}>
                  Continue +♥ (ad)
                </Text>
              </Pressable>
            )}
            <Pressable
              disabled={adBusy}
              style={({ pressed }) => [
                styles.button,
                { transform: [{ scale: pressed ? 0.94 : 1 }] },
                phase === 'lost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.border },
                phase === 'won' && { backgroundColor: pressed ? p.accentDeep : p.accent },
              ]}
              onPress={() => (phase === 'won' ? onNextLevel() : loadLevel(levelIndex))}
            >
              <Text style={[styles.buttonText, { color: phase === 'won' ? p.inkOnAccent : p.inkDim }]}>
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

/**
 * The heart row, one pip per heart. A pip that just went out pops (scale
 * ~1.35 springing back) as it dims — losing a life is unmistakable
 * (GameManager.SpendHeart).
 */
function HeartPips({ left, max, palette }: { left: number; max: number; palette: Palette }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: max }, (_, i) => (
        <HeartPip key={i} filled={i < left} palette={palette} />
      ))}
    </View>
  );
}

function HeartPip({ filled, palette }: { filled: boolean; palette: Palette }) {
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
    <Animated.View style={style}>
      <Text style={{ fontSize: 20, letterSpacing: 2, color: filled ? palette.heart : palette.heartLost }}>
        ♥
      </Text>
    </Animated.View>
  );
}

/**
 * Star rating on the win panel: one star per heart still beating. Stars pop
 * in left to right with a springy stagger; unearned slots settle in dim so
 * the player sees exactly what a cleaner run would have paid.
 */
function Stars({ earned, total, palette }: { earned: number; total: number; palette: Palette }) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: total }, (_, i) => (
        <Star
          key={i}
          filled={i < earned}
          big={i === Math.floor(total / 2)}
          delay={250 + i * 170}
          palette={palette}
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
}: {
  filled: boolean;
  big: boolean;
  delay: number;
  palette: Palette;
}) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 260 }));
    // Each earned star pops with a tiny rising chirp, timed to its entrance.
    if (filled) {
      const t = setTimeout(() => Sfx.playStar(), delay);
      return () => clearTimeout(t);
    }
  }, []);
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
          color: filled ? palette.accent : palette.heartLost,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelLabel: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  diffLabel: {
    fontSize: 12,
    fontFamily: Fonts.semi,
    letterSpacing: 0.5,
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

import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { EXIT_EDGE_LAUNCH, exitTravelFraction } from './exitToScreenEdge';
import { EASE_OUT } from './motionTokens';
import { useStopWhenScreenLeaves } from './screenHandoff';
import { createSplashBackstop, type SplashBackstop } from './splashBackstop';
import { getSplashSlowmo, getSplashVariant, type SplashVariant } from './splashVariant';
import { Fonts } from './theme';
import { FALL, FallLayer } from './winter/WinterBoardDecor';
import { winterDecorOn } from './winter/winterLook';

/** TF-02 C: the splash's tap-to-skip surface, spoken. */
const SKIP_A11Y_LABEL = 'Skip intro'; // OWNER-PICKED STARTING VALUE

/**
 * Longest the splash may stay up before the backstop hands over to the menu, whether or not the animation's
 * completion callback arrived. The scripted fade-out ends at 2490 ms (withDelay 2250 + withTiming 240 below); the
 * headroom is OWNER-PICKED STARTING VALUE. Firing early only cuts the splash tail.
 */
export const SPLASH_MAX_MS = 4000; // OWNER-PICKED STARTING VALUE

/** ICON-01 "Stage" (owner pick 2026-11-20): the app icon's violet, full bleed, in both themes. */
export const STAGE_BG = '#6D4AEF';
const MOONLIT = '#EFEDF9';
/**
 * The native splash (app.json expo-splash-screen) draws assets/android-icon-foreground.png in a 288 dp box centred on
 * the window. The intro starts from exactly that frame, so the hand-over from the native splash shows no jump.
 */
const NATIVE_BOX = 288;
const FOREGROUND = require('../../assets/android-icon-foreground.png');
/** Buddy's art spans about the middle 156 dp of the box (crop log of scripts/art/render-buddy-icon.mjs). */
const ART_HALF = 78;
/** Buddy's feet (the art's lowest pixel) sit this far below the box centre: the hop squashes from there. */
const FEET_DP = 64.7;
const LIFT = 44; // the Buddy + wordmark lockup rises this far so the pair sits centred
const WORD_SIZE = 56;

const RM = ReduceMotion.System;
/**
 * QA capture only: every delay, duration and spring runs this many times slower (1 in store builds). Read once when
 * a splash mounts. ponytail: module state, fine while one splash plays at a time.
 */
let S = 1;
const T = (ms: number) => ms * S;
const tm = (to: number, ms: number, easing: typeof EASE_OUT | ((t: number) => number) = EASE_OUT) =>
  withTiming(to, { duration: T(ms), easing, reduceMotion: RM });
/** Stays at `value` for `ms` (the value is already there), so a sequence can wait without a nested delay. */
const hold = (value: number, ms: number) => withTiming(value, { duration: T(ms), reduceMotion: RM });
/** A spring slowed by S keeps its damping ratio: stiffness / S², damping / S. */
const sp = (to: number, damping: number, stiffness: number) =>
  withSpring(to, { mass: 1, damping: damping / S, stiffness: stiffness / (S * S), reduceMotion: RM });
const linear = (ms: number) => withTiming(1, { duration: T(ms), easing: Easing.linear, reduceMotion: RM });
/** The game's arrow exit: leaves at launch speed and keeps accelerating (exitToScreenEdge.ts). */
const EXIT = (k: number) => {
  'worklet';
  return exitTravelFraction(k, EXIT_EDGE_LAUNCH);
};
const OUT_AT = 2250;
const LETTERS_MS = 720;
const BOARD_MS = 1200;
const INK = '#191724'; // Buddy's outline, sampled from assets/android-icon-foreground.png

type Dir = 'up' | 'down' | 'left' | 'right';
/** Variant C: the arrows around Buddy, in the order they leave; x, y are offsets of the arrow's centre from Buddy's. */
const BOARD: readonly { x: number; y: number; dir: Dir }[] = [
  { x: -118, y: -128, dir: 'up' },
  { x: 122, y: -96, dir: 'right' },
  { x: 118, y: 96, dir: 'down' },
  { x: -128, y: 74, dir: 'left' },
  { x: -24, y: 160, dir: 'down' },
  { x: 28, y: -168, dir: 'up' },
];
const ARROW_W = 72;
const ARROW_H = 40;
const ROTATE: Record<Dir, string> = { right: '0deg', down: '90deg', left: '180deg', up: '-90deg' };

/**
 * Animated intro. Every variant starts from the native splash's frame (Buddy alone on violet) and ends on the same
 * lockup (Buddy lifted, "Arrows" under him), then fades to the menu. Tap anywhere to skip. In the winter window snow
 * falls and a snowy hill rises along the bottom.
 * - stage (shipped, owner pick 2026-11-20): the lockup rises, the wordmark springs in, Buddy nudges right once.
 * - hop: Buddy crouches, hops up into the lockup and lands with a squash; the letters pop in one by one.
 * - escape: Buddy pulls back, leaves to the right on the game's own exit curve, comes back in from the left and
 *   settles; then the lockup forms. The game's one action, done by the mascot.
 * - board: a ring of arrows appears around Buddy and they leave one by one like a board being cleared; then the
 *   lockup forms.
 *
 * Every hand-over goes through one backstop (see splashBackstop.ts), so `onDone` runs exactly once even if the
 * animation callbacks never arrive, a skip and the scripted fade-out both complete, or the app was backgrounded.
 */
export function SplashScreen({ onDone, variant = getSplashVariant() }: { onDone: () => void; variant?: SplashVariant }) {
  const { width, height } = useWindowDimensions();
  const winter = winterDecorOn();
  const reduced = useReducedMotion(); // still flakes read as dust: no snowfall under reduced motion

  const lift = useSharedValue(0); // lockup rise 0..1
  const word = useSharedValue(0); // wordmark spring-in 0..1
  const out = useSharedValue(0); // whole-screen fade-out
  const bx = useSharedValue(0); // Buddy's x offset, dp
  const by = useSharedValue(0); // Buddy's extra y offset (hop), dp
  const sq = useSharedValue(0); // squash (+) / stretch (-), -1..1
  const clock = useSharedValue(0); // hop letters / board arrows, linear 0..1
  // PERF-DEADTAG: the springs may still be settling when the splash hands over; every value stops when it starts
  // leaving (screenHandoff.tsx).
  useStopWhenScreenLeaves(lift, word, out, bx, by, sq, clock);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const backstopRef = useRef<SplashBackstop | null>(null);
  const finish = useCallback(() => backstopRef.current?.finish(), []);
  const escapeX = width / 2 + ART_HALF + 24; // Buddy fully past the screen edge

  useEffect(() => {
    S = getSplashSlowmo();
    const backstop = createSplashBackstop({
      maxMs: T(SPLASH_MAX_MS),
      now: Date.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle),
      onDone: () => onDoneRef.current(),
    });
    backstopRef.current = backstop;
    // A JS timer does not fire while Android has the app paused.
    const sub = AppState.addEventListener('change', (state) => backstop.onAppStateChange(state));

    // Decorative motion follows the player's system setting: reduced, every value lands on its end frame at once.
    const at = (ms: number, anim: number) => withDelay(T(ms), anim, ReduceMotion.System);
    if (variant === 'hop') {
      sq.value = at(120, withSequence(tm(1, 110), tm(-0.8, 140), tm(0, 180), hold(0, 150), tm(0.6, 90), sp(0, 9, 260)));
      by.value = at(230, withSequence(tm(-40, 260), sp(0, 14, 170)));
      lift.value = at(230, tm(1, 520));
      clock.value = at(650, linear(LETTERS_MS));
    } else if (variant === 'escape') {
      sq.value = at(200, withSequence(tm(1, 160), hold(1, 60), tm(-1, 120), hold(-1, 180), sp(0, 10, 200)));
      bx.value = at(
        200,
        withSequence(
          tm(-14, 160),
          hold(-14, 60),
          withTiming(escapeX, { duration: T(300), easing: EXIT, reduceMotion: RM }),
          withTiming(-escapeX, { duration: 0, reduceMotion: RM }),
          sp(0, 34, 420), // stiff enough to be centred before the lift (Codex review 2026-11-20)
        ),
      );
      lift.value = at(1000, tm(1, 480));
      word.value = at(1070, sp(1, 14, 160));
    } else if (variant === 'board') {
      clock.value = at(60, linear(BOARD_MS));
      lift.value = at(1240, tm(1, 420)); // after the last arrow is gone (~1,200 ms)
      word.value = at(1320, sp(1, 14, 160));
    } else {
      lift.value = at(150, tm(1, 520));
      word.value = at(300, sp(1, 14, 160));
      bx.value = at(1000, withSequence(tm(10, 140), sp(0, 9, 220)));
    }
    out.value = withDelay(
      T(OUT_AT),
      withTiming(1, { duration: T(240), easing: EASE_OUT, reduceMotion: RM }, (f) => {
        if (f) scheduleOnRN(finish);
      }),
      ReduceMotion.System,
    );

    return () => {
      sub.remove();
      backstop.dispose();
      backstopRef.current = null;
    };
  }, []);

  const skip = () => {
    // A requested skip follows the system setting and therefore remains instant when reduced.
    out.value = withTiming(1, { duration: 180, easing: EASE_OUT, reduceMotion: RM }, (f) => {
      if (f) scheduleOnRN(finish);
    });
  };

  const hillH = Math.round(height * 0.18);
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const lockupStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * lift.value }] }));
  const buddyStyle = useAnimatedStyle(() => {
    const k = sq.value;
    // hop squashes vertically from his feet; escape squashes along his flight (x).
    const sx = variant === 'escape' ? 1 - (k > 0 ? 0.1 : 0.2) * k : 1 + 0.08 * k;
    const sy = variant === 'escape' ? 1 + (k > 0 ? 0.05 : 0.08) * k : 1 - 0.12 * k;
    const feet = variant === 'hop' ? (1 - sy) * FEET_DP : 0;
    return { transform: [{ translateX: bx.value }, { translateY: by.value + feet }, { scaleX: sx }, { scaleY: sy }] };
  });
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: 16 * (1 - word.value) }, { scale: 0.9 + 0.1 * word.value }],
  }));
  const hillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hillH * (1 - lift.value) }] }));

  return (
    // TF-02 C: the whole splash is a tap-to-skip button; Buddy and the winter scene are decoration.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SKIP_A11Y_LABEL}
      style={[styles.root, { backgroundColor: STAGE_BG }]}
      onPress={skip}
    >
      <Animated.View style={[StyleSheet.absoluteFill, rootStyle]}>
        {winter && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {/* ponytail: the board's snowfall tiles, run fast enough to read as falling within a 2.5 s intro. */}
            {!reduced && <FallLayer source={FALL.far.night} h={width / (720 / 1600)} ms={9000} />}
            {!reduced && <FallLayer source={FALL.near.night} h={width / (720 / 1600)} ms={6000} />}
            <Animated.View style={[styles.hill, { height: hillH }, hillStyle]}>
              <Svg width={width} height={hillH} viewBox={`0 0 ${width} ${hillH}`}>
                <Path
                  d={`M0 ${hillH * 0.42} C${width * 0.3} ${hillH * 0.02} ${width * 0.62} ${hillH * 0.12} ${width} ${hillH * 0.34} L${width} ${hillH} L0 ${hillH} Z`}
                  fill={MOONLIT}
                />
              </Svg>
            </Animated.View>
          </View>
        )}
        {variant === 'board' && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.anchor}>
              {BOARD.map((a, i) => (
                <BoardArrow key={i} index={i} spec={a} clock={clock} width={width} height={height} />
              ))}
            </View>
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Animated.View style={[styles.lockup, lockupStyle]}>
            <Animated.View
              style={[{ width: NATIVE_BOX, height: NATIVE_BOX }, buddyStyle]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Image source={FOREGROUND} style={{ width: NATIVE_BOX, height: NATIVE_BOX }} />
            </Animated.View>
            {variant === 'hop' ? (
              <View
                style={[styles.word, styles.letters, { top: NATIVE_BOX / 2 + ART_HALF + 14 }]}
                accessible
                accessibilityRole="header"
                accessibilityLabel="Arrows"
              >
                {'Arrows'.split('').map((ch, i) => (
                  <Letter key={i} ch={ch} index={i} clock={clock} />
                ))}
              </View>
            ) : (
              <Animated.View style={[styles.word, { top: NATIVE_BOX / 2 + ART_HALF + 14 }, wordStyle]}>
                <Text accessibilityRole="header" style={styles.wordText}>
                  Arrows
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** Variant A: one letter of the wordmark, popping up 60 ms after the one before it (ease-out-back, never from 0). */
function Letter({ ch, index, clock }: { ch: string; index: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = clamp01((clock.value * LETTERS_MS - index * 60) / 360);
    const c1 = 1.70158;
    const q = 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
    return { opacity: Math.min(1, p * 2.5), transform: [{ translateY: 18 * (1 - q) }, { scale: 0.85 + 0.15 * q }] };
  });
  return (
    <Animated.Text style={[styles.wordText, style]} importantForAccessibility="no" accessibilityElementsHidden>
      {ch}
    </Animated.Text>
  );
}

/** Variant C: one arrow of the ring. It eases in with the others, then leaves on the game's exit curve in its turn. */
function BoardArrow({
  index,
  spec,
  clock,
  width,
  height,
}: {
  index: number;
  spec: { x: number; y: number; dir: Dir };
  clock: SharedValue<number>;
  width: number;
  height: number;
}) {
  const { x, y, dir } = spec;
  const dist = { up: y + height / 2, down: height / 2 - y, left: width / 2 + x, right: width / 2 - x }[dir] + ARROW_W;
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const style = useAnimatedStyle(() => {
    const ms = clock.value * BOARD_MS;
    const pin = clamp01((ms - index * 45) / 200);
    const ein = 1 - (1 - pin) ** 3;
    const travel = EXIT(clamp01((ms - (420 + index * 95)) / 280)) * dist;
    return {
      opacity: ein,
      transform: [
        { translateX: dx * travel },
        { translateY: dy * travel },
        { rotate: ROTATE[dir] },
        { scale: 0.9 + 0.1 * ein },
      ],
    };
  });
  return (
    <Animated.View style={[styles.arrow, { left: x - ARROW_W / 2, top: y - ARROW_H / 2 }, style]}>
      <Svg width={ARROW_W} height={ARROW_H} viewBox={`0 0 ${ARROW_W} ${ARROW_H}`}>
        <Path d="M5 12 H42 V4 L67 20 L42 36 V28 H5 Z" fill={MOONLIT} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockup: { width: NATIVE_BOX, height: NATIVE_BOX, alignItems: 'center' },
  word: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  wordText: {
    fontSize: WORD_SIZE,
    fontFamily: Fonts.bold,
    color: MOONLIT,
    letterSpacing: WORD_SIZE * 0.01,
    includeFontPadding: false,
  },
  hill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  letters: { flexDirection: 'row', justifyContent: 'center' },
  anchor: { width: 0, height: 0 },
  arrow: { position: 'absolute', width: ARROW_W, height: ARROW_H },
});

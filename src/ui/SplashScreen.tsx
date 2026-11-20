import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { EASE_OUT } from './motionTokens';
import { useStopWhenScreenLeaves } from './screenHandoff';
import { createSplashBackstop, type SplashBackstop } from './splashBackstop';
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
const LIFT = 44; // the Buddy + wordmark lockup rises this far so the pair sits centred
const WORD_SIZE = 56;

/**
 * Animated intro: Buddy waits where the native splash left him, the lockup rises while the wordmark springs in under
 * him, and he nudges right once (an arrow that wants to go). In the winter window snow falls and a snowy hill rises
 * along the bottom. Fades out and hands over to the menu. Tap anywhere to skip.
 *
 * Every hand-over goes through one backstop (see splashBackstop.ts), so `onDone` runs exactly once even if the
 * animation callbacks never arrive, a skip and the scripted fade-out both complete, or the app was backgrounded.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const winter = winterDecorOn();
  const reduced = useReducedMotion(); // still flakes read as dust: no snowfall under reduced motion

  const lift = useSharedValue(0); // lockup rise 0..1
  const word = useSharedValue(0); // wordmark spring-in 0..1
  const nudge = useSharedValue(0); // Buddy's x nudge, dp
  const out = useSharedValue(0); // whole-screen fade-out
  // PERF-DEADTAG: the springs may still be settling when the splash hands over; every value stops when it starts
  // leaving (screenHandoff.tsx).
  useStopWhenScreenLeaves(lift, word, nudge, out);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const backstopRef = useRef<SplashBackstop | null>(null);
  const finish = useCallback(() => backstopRef.current?.finish(), []);

  useEffect(() => {
    const backstop = createSplashBackstop({
      maxMs: SPLASH_MAX_MS,
      now: Date.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle),
      onDone: () => onDoneRef.current(),
    });
    backstopRef.current = backstop;
    // A JS timer does not fire while Android has the app paused.
    const sub = AppState.addEventListener('change', (state) => backstop.onAppStateChange(state));

    // Decorative motion follows the player's system setting: reduced, every value lands on its end frame at once.
    lift.value = withDelay(
      150,
      withTiming(1, { duration: 520, easing: EASE_OUT, reduceMotion: ReduceMotion.System }),
      ReduceMotion.System,
    );
    word.value = withDelay(
      300,
      withSpring(1, { mass: 1, damping: 14, stiffness: 160, reduceMotion: ReduceMotion.System }),
      ReduceMotion.System,
    );
    nudge.value = withDelay(
      1000,
      withSequence(
        withTiming(10, { duration: 140, easing: EASE_OUT, reduceMotion: ReduceMotion.System }),
        withSpring(0, { mass: 1, damping: 9, stiffness: 220, reduceMotion: ReduceMotion.System }),
      ),
      ReduceMotion.System,
    );
    out.value = withDelay(
      2250,
      withTiming(1, { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.System }, (f) => {
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
    out.value = withTiming(1, { duration: 180, reduceMotion: ReduceMotion.System }, (f) => {
      if (f) scheduleOnRN(finish);
    });
  };

  const hillH = Math.round(height * 0.18);
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const lockupStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * lift.value }] }));
  const buddyStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value }] }));
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
        <View style={styles.center}>
          <Animated.View style={[styles.lockup, lockupStyle]}>
            <Animated.View
              style={[{ width: NATIVE_BOX, height: NATIVE_BOX }, buddyStyle]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Image source={FOREGROUND} style={{ width: NATIVE_BOX, height: NATIVE_BOX }} />
            </Animated.View>
            <Animated.View style={[styles.word, { top: NATIVE_BOX / 2 + ART_HALF + 14 }, wordStyle]}>
              <Text accessibilityRole="header" style={styles.wordText}>
                Arrows
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
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
});

import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { META_MOTION_POLISH } from '../featureFlags';
import { EASE_OUT } from './motionTokens';
import { useStopWhenScreenLeaves } from './screenHandoff';
import { createSplashBackstop, type SplashBackstop } from './splashBackstop';
import { Palette } from './theme';
import { Wordmark } from './Wordmark';

const AnimatedPath = Animated.createAnimatedComponent(Path);
/**
 * MOTION-AUDIT (META_MOTION_POLISH): the springs get mass 1 (Reanimated 4 defaults to 4, which doubled their wobble),
 * and the fade-out is a 240 ms ease-out instead of a 380 ms ease-in. OFF: as before.
 */
const POLISH_SPRING_MASS = META_MOTION_POLISH ? { mass: 1 } : {};
const OUT_MS = META_MOTION_POLISH ? 240 : 380;
const OUT_EASING = META_MOTION_POLISH ? EASE_OUT : Easing.in(Easing.quad);
/** TF-02 C: the splash's tap-to-skip surface, spoken. */
const SKIP_A11Y_LABEL = 'Skip intro'; // OWNER-PICKED STARTING VALUE

/**
 * Longest the splash may stay up before the backstop hands over to the menu,
 * whether or not the animation's completion callback arrived. The scripted
 * fade-out ends at 2630 ms (withDelay 2250 + withTiming 380 below); the 1370 ms
 * of headroom is OWNER-PICKED STARTING VALUE. Firing early only cuts the
 * splash tail.
 */
export const SPLASH_MAX_MS = 4000; // OWNER-PICKED STARTING VALUE

/**
 * Animated intro: the wordmark springs in, then a line-art arrow — the same
 * stroke the game is made of — draws itself underneath, bends once (of
 * course it bends), and lands its arrowhead. Fades out and hands over to the
 * menu. Tap anywhere to skip.
 *
 * Every hand-over goes through one backstop (see splashBackstop.ts), so
 * `onDone` runs exactly once even if the animation callbacks never arrive, a
 * skip and the scripted fade-out both complete, or the app was backgrounded.
 */
export function SplashScreen({ palette, onDone }: { palette: Palette; onDone: () => void }) {
  const { width } = useWindowDimensions();

  const mark = useSharedValue(0); // wordmark spring-in
  const draw = useSharedValue(0); // arrow self-draw 0..1
  const head = useSharedValue(0); // arrowhead pop
  const out = useSharedValue(0); // whole-screen fade-out
  // PERF-DEADTAG: the wordmark and arrowhead springs are still settling when the
  // splash hands over; every value stops when it starts leaving (screenHandoff.tsx).
  useStopWhenScreenLeaves(mark, draw, head, out);

  // Underline arrow geometry: run under the wordmark, one playful Z-bend.
  const w = Math.min(width * 0.62, 340);
  const H = 56; // svg height
  const stroke = 7;
  // left -> dip down -> back up -> continue right (a small Z in the middle)
  const d = `M${8} ${18} L${w * 0.42} ${18} L${w * 0.42} ${38} L${w * 0.58} ${38} L${w * 0.58} ${18} L${w - 26} ${18}`;
  const pathLen = (w * 0.42 - 8) + 20 + (w * 0.16) + 20 + (w - 26 - w * 0.58) + 8;
  const tipX = w - 24;
  const headD = `M${tipX + 17} ${18} L${tipX} ${8.5} L${tipX} ${27.5} Z`;

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

    // Decorative wordmark motion follows the player's system setting.
    mark.value = withDelay(
      150,
      withSpring(1, {
        ...POLISH_SPRING_MASS,
        damping: 14,
        stiffness: 120,
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
    // Decorative line drawing follows the player's system setting.
    draw.value = withDelay(
      650,
      withTiming(1, {
        duration: 850,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
    // Decorative arrowhead motion follows the player's system setting.
    head.value = withDelay(
      1450,
      withSpring(1, {
        ...POLISH_SPRING_MASS,
        damping: 12,
        stiffness: 260,
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
    // Decorative splash fade follows the player's system setting.
    out.value = withDelay(
      2250,
      withTiming(1, {
        duration: OUT_MS,
        easing: OUT_EASING,
        reduceMotion: ReduceMotion.System,
      }, (f) => {
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

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.72 + 0.28 * mark.value }, { translateY: 10 * (1 - mark.value) }],
  }));
  const shaftProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLen * (1 - draw.value),
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: head.value,
    transform: [{ scale: 0.4 + 0.6 * head.value }],
  }));

  return (
    // TF-02 C: the whole splash is a tap-to-skip button; the drawn arrow is decoration (hidden from screen readers).
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SKIP_A11Y_LABEL}
      style={[styles.root, { backgroundColor: palette.bg }]}
      onPress={skip}
    >
      <Animated.View style={[styles.center, rootStyle]}>
        <Animated.View style={markStyle}>
          <Wordmark size={56} palette={palette} />
        </Animated.View>

        <Animated.View
          style={{ marginTop: 26 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
            <AnimatedPath
              d={d}
              animatedProps={shaftProps}
              stroke={palette.ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${pathLen} ${pathLen}`}
            />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
            <Svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
              <Path d={headD} fill={palette.accent} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
});

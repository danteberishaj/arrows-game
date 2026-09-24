import React from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { META_PRESS_SPRING } from '../featureFlags';

/** Held scale of a pressed button (ButtonPress.cs press-feel, DESIGN.md). */
export const PRESS_SCALE = 0.94; // OWNER-PICKED STARTING VALUE
/** POLISH-T9 press-in: ease to PRESS_SCALE. */
const PRESS_IN_MS = 90; // OWNER-PICKED STARTING VALUE
/** POLISH-T9 release: spring back to 1. */
const RELEASE_DAMPING = 15; // OWNER-PICKED STARTING VALUE
const RELEASE_STIFFNESS = 400; // OWNER-PICKED STARTING VALUE
/**
 * Explicit: Reanimated 4's default spring mass is 4 (GentleSpringConfig), not 1.
 * With mass 4 this spring is twice as bouncy (damping ratio 0.19 instead of 0.375)
 * and keeps the UI thread drawing for ~5 s after every release before its energy
 * threshold ends it (POLISH-T9, measured with dumpsys gfxinfo on emulator-5556).
 */
const RELEASE_MASS = 1;

/**
 * The snap-scale transform a button's pressed-style function carries while
 * META_PRESS_SPRING is off (today's `scale: pressed ? 0.94 : 1`, byte for byte).
 * With the flag on it is `undefined`: PressScale drives the scale instead, and
 * the style function keeps only the colour change.
 */
export function pressSnapTransform(pressed: boolean): ViewStyle['transform'] {
  return META_PRESS_SPRING ? undefined : [{ scale: pressed ? PRESS_SCALE : 1 }];
}

type PressScaleProps = Omit<PressableProps, 'style'> & {
  style: (state: PressableStateCallbackType) => StyleProp<ViewStyle>;
};

/**
 * POLISH-T9 (META_PRESS_SPRING): the one press wrapper shared by HeaderButton,
 * the Home Play pill and the panel buttons.
 * - Flag OFF: exactly the plain Pressable it replaces (no wrapper view, no
 *   shared value); the caller's style function snaps the scale as today.
 * - Flag ON: an Animated.View around the Pressable scales it: press-in eases to
 *   0.94, release springs back to 1; both follow the system reduce-motion
 *   setting (instant when it is on). The tap still fires on release (Pressable's
 *   own onPress); hitSlop and the accessibility props stay on the Pressable.
 *   Nested inside another scaled view (the Play pill's breathing), the two
 *   scales multiply.
 */
export function PressScale(props: PressScaleProps) {
  return META_PRESS_SPRING ? <SpringPress {...props} /> : <Pressable {...props} />;
}

function SpringPress({ onPressIn, onPressOut, ...rest }: PressScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressIn = (e: GestureResponderEvent) => {
    scale.value = withTiming(PRESS_SCALE, {
      duration: PRESS_IN_MS,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
    onPressIn?.(e);
  };
  const pressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, {
      damping: RELEASE_DAMPING,
      stiffness: RELEASE_STIFFNESS,
      mass: RELEASE_MASS,
      reduceMotion: ReduceMotion.System,
    });
    onPressOut?.(e);
  };
  return (
    <Animated.View style={animatedStyle}>
      <Pressable {...rest} onPressIn={pressIn} onPressOut={pressOut} />
    </Animated.View>
  );
}

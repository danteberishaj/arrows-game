import React from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  OverlayPresence,
  PANEL_BACKSTOP_MARGIN_MS,
  PANEL_ENTER_SCALE,
  type PresenceDriver,
  type PresenceState,
} from './overlayPresence';

/** Entrance decelerates into rest; the exit accelerates away. */
const ENTER_EASING = Easing.out(Easing.cubic); // OWNER-PICKED STARTING VALUE
const EXIT_EASING = Easing.in(Easing.quad); // OWNER-PICKED STARTING VALUE

/** The presence value (0..1), driven by withTiming; completion reaches JS via scheduleOnRN. */
export function createPresenceDriver(presence: SharedValue<number>): PresenceDriver {
  return {
    animateTo: (target, durationMs, onDone) => {
      // Decorative fade/scale: the system reduce-motion setting makes it instant.
      // (GameScreen also passes 0 ms under reduce motion, so the panel is at
      // rest on its first frame without waiting for this callback.)
      presence.value = withTiming(
        target,
        {
          duration: durationMs,
          easing: target === 1 ? ENTER_EASING : EXIT_EASING,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(onDone);
        },
      );
    },
    snap: (value) => {
      cancelAnimation(presence);
      presence.value = value;
    },
  };
}

export type PanelPresence = OverlayPresence<ReturnType<typeof setTimeout>>;

/** One latch per GameScreen, wired to the real timers and AppState. */
export function createPanelPresence(presence: SharedValue<number>): PanelPresence {
  return new OverlayPresence({
    backstopMarginMs: PANEL_BACKSTOP_MARGIN_MS,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    subscribeAppState: (listener) => {
      const subscription = AppState.addEventListener('change', listener);
      return () => subscription.remove();
    },
    driver: createPresenceDriver(presence),
  });
}

const SCRIM_REST = { opacity: 1 } as const;
const PANEL_REST = { opacity: 1, transform: [{ scale: 1 }] } as const;

/**
 * The win / lose overlay with presence motion. The scrim is its own layer, so
 * scrim and panel each follow `presence` directly (nesting would square the
 * panel's opacity). While entering / exiting both take the animated styles;
 * once the latch settles (shown) they take static rest styles, and the latch
 * has already snapped the value to 1, so a panel at rest never depends on an
 * animation completing. The elements are the same in every state, so the panel
 * subtree (stars, buttons) never remounts.
 */
export function PanelOverlayFrame({
  presence,
  state,
  scrimColor,
  overlayStyle,
  panelStyle,
  testID,
  children,
}: {
  presence: SharedValue<number>;
  state: PresenceState;
  scrimColor: string;
  overlayStyle: StyleProp<ViewStyle>;
  panelStyle: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}) {
  const animating = state === 'entering' || state === 'exiting';
  const scrimAnimated = useAnimatedStyle(() => ({ opacity: presence.value }));
  const panelAnimated = useAnimatedStyle(() => ({
    opacity: presence.value,
    transform: [{ scale: PANEL_ENTER_SCALE + (1 - PANEL_ENTER_SCALE) * presence.value }],
  }));
  return (
    <View
      testID={testID}
      style={[overlayStyle, { pointerEvents: state === 'exiting' ? 'none' : 'auto' }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, animating ? scrimAnimated : SCRIM_REST]}
      />
      <Animated.View style={[panelStyle, animating ? panelAnimated : PANEL_REST]}>{children}</Animated.View>
    </View>
  );
}

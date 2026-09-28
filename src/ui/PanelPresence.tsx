import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
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
 * panel's opacity). The elements are the same in every state, so the panel
 * subtree (stars, buttons) never remounts.
 *
 * PANEL-STUCK: Reanimated 4.5.1 runs with FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS.
 * Its PropsRegistryGarbageCollector copies the last props the UI thread wrote
 * for a view into that AnimatedComponent's React state (`settledProps`), and
 * AnimatedComponent.render() puts `settledProps` AFTER our styles; entries it
 * misses for 2 s (the app in the background) are dropped unsynced. So, at rest,
 * BOTH the React props and the last UI write must be the rest values:
 * - while a leg runs, and after it settles until the UI thread has drawn two
 *   frames past the settle (the latch's snap has then been written to the
 *   views), the animated styles stay attached: the last write, and so any
 *   `settledProps`, is the rest value even when the backstop timer or AppState
 *   settled the leg mid-way (W5-19: a detach before the snap's write left the
 *   mid-leg frame in `settledProps`, which beat the static style);
 * - then the static rest styles replace them, so the React props are the rest
 *   values too (kept attached, the React props stay the animated style's
 *   first-render values, opacity 0: a panel settled just before the app went
 *   to the background came back invisible when the collector had not run).
 * The confirmation is a UI-thread callback, not a timer, so it cannot overtake
 * the snap; in the background it simply arrives on return.
 * A frame that has never animated (reduce motion: 0 ms, or a leg that settled
 * before the overlay mounted) has the static rest styles from its first frame.
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
  // Legs this mount has animated (a new leg starts on each non-animating -> animating render).
  const leg = useRef(0);
  const wasAnimating = useRef(false);
  if (animating && !wasAnimating.current) leg.current += 1;
  wasAnimating.current = animating;
  // The leg whose settle the UI thread has confirmed (see above); -1 = none yet.
  const [restLeg, setRestLeg] = useState(-1);
  const currentLeg = leg.current;
  const animated = animating || (currentLeg > 0 && restLeg !== currentLeg);
  useEffect(() => {
    if (animating || currentLeg === 0 || restLeg === currentLeg) return undefined;
    let live = true;
    const confirm = () => {
      if (live) setRestLeg(currentLeg);
    };
    scheduleOnUI(() => {
      'worklet';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleOnRN(confirm);
        });
      });
    });
    return () => {
      live = false;
    };
  }, [animating, currentLeg, restLeg]);
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
        style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, animated ? scrimAnimated : SCRIM_REST]}
      />
      <Animated.View style={[panelStyle, animated ? panelAnimated : PANEL_REST]}>{children}</Animated.View>
    </View>
  );
}

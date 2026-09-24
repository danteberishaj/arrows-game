import React from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { awaitAdThenPanelBeat, ScrimTransition, type ScrimDriver } from './scrimTransition';

/**
 * W2-04 (META_LEVEL_TRANSITION) leg durations. DESIGN.md puts state/screen
 * transitions at 160-220 ms and the shipped screen FadeIn is 180 ms; not a
 * measurement. The owner accepts the timing from the recording before the flag
 * flips.
 */
export const SCRIM_COVER_MS = 180; // OWNER-PICKED STARTING VALUE
export const SCRIM_UNCOVER_MS = 180; // OWNER-PICKED STARTING VALUE
/** Symmetric ease for both legs (a flat fade, no motion). */
const SCRIM_EASING = Easing.inOut(Easing.quad); // OWNER-PICKED STARTING VALUE

/**
 * Backstop margin added to each leg: the largest JS block measured across a
 * level swap, rounded up. W2-04 step 1 on emulator-5556 (release PERF build,
 * n = 12 per level, artifacts/W2-04/step1/, scripts/step1-table.py): loadLevel
 * start -> the session-revision effect took max 84.73 ms (Next on index 3826,
 * generating the 250-arrow harness board; createLevelSession alone max
 * 79.20 ms). Emulator number, UNVERIFIED-DEVICE.
 */
export const SCRIM_BACKSTOP_MARGIN_MS = 85;

/**
 * After a shown interstitial: how long the win panel stays fully visible (once
 * the app is active again) before the cover starts. It must outlast Android's
 * ad-activity exit transition, measured at ~185 ms at animation scale 1 on
 * emulator-5556 (artifacts/W2-04/real/nextad, frames 151-163), and leave a
 * visible beat after it.
 */
export const PANEL_BEAT_AFTER_AD_MS = 450; // OWNER-PICKED STARTING VALUE
/**
 * A show that lasted this long displayed an ad: the not-due / killed / not-ready
 * paths resolve within a microtask, and the `__DEV__` simulated ad cannot close
 * before its 2 s countdown.
 */
const AD_SHOWN_MIN_MS = 250; // OWNER-PICKED STARTING VALUE

/** `show()` (the paced interstitial), then, if an ad was shown, the panel beat. */
export function showAdThenPanelBeat(show: () => Promise<unknown>): Promise<void> {
  return awaitAdThenPanelBeat({
    show,
    beatMs: PANEL_BEAT_AFTER_AD_MS,
    shownMinMs: AD_SHOWN_MIN_MS,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    currentAppState: () => AppState.currentState,
    subscribeAppState: (listener) => {
      const subscription = AppState.addEventListener('change', listener);
      return () => subscription.remove();
    },
  });
}

/** The scrim's opacity, driven by withTiming; completion reaches JS via scheduleOnRN. */
export function createScrimDriver(opacity: SharedValue<number>): ScrimDriver {
  const animateTo = (target: 0 | 1, durationMs: number, onDone: () => void) => {
    // Decorative fade: the system reduce-motion setting makes it instant, and the
    // completion callback then fires on the first frame.
    opacity.value = withTiming(
      target,
      { duration: durationMs, easing: SCRIM_EASING, reduceMotion: ReduceMotion.System },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onDone);
      },
    );
  };
  return {
    cover: (durationMs, onDone) => animateTo(1, durationMs, onDone),
    uncover: (durationMs, onDone) => animateTo(0, durationMs, onDone),
    snap: (value) => {
      cancelAnimation(opacity);
      opacity.value = value;
    },
  };
}

export type LevelScrimTransition = ScrimTransition<ReturnType<typeof setTimeout>, number>;

/** One sequencer per GameScreen, wired to the real clock, timers, frames and AppState. */
export function createLevelScrimTransition(opacity: SharedValue<number>): LevelScrimTransition {
  return new ScrimTransition({
    coverMs: SCRIM_COVER_MS,
    uncoverMs: SCRIM_UNCOVER_MS,
    backstopMarginMs: SCRIM_BACKSTOP_MARGIN_MS,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    requestFrame: (fn) => requestAnimationFrame(() => fn()),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    subscribeAppState: (listener) => {
      const subscription = AppState.addEventListener('change', listener);
      return () => subscription.remove();
    },
    driver: createScrimDriver(opacity),
  });
}

/**
 * A flat `palette.bg` layer over the whole screen (header, board, panel). It
 * never takes a touch, and at rest its opacity is 0. Mount it as the LAST child
 * of the screen root so it draws above everything else.
 */
export function ScreenScrim({ color, opacity }: { color: string; opacity: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]}
    />
  );
}

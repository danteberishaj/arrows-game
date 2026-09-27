import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { ScrimTransition, type ScrimDriver } from './scrimTransition';
import {
  createScrimDriver,
  SCRIM_BACKSTOP_MARGIN_MS,
  SCRIM_COVER_MS,
  SCRIM_UNCOVER_MS,
} from './ScreenScrim';

/**
 * W2-08 (META_THEME_TRANSITION): the menu's theme toggle passes through a flat
 * scrim in the DESTINATION palette's `bg` instead of re-colouring every view in
 * one frame (a full-screen jump between #FFFFFF and #13111C).
 *
 * Honestly named: this is a LUMINANCE DIP THROUGH A FLAT COLOUR, not a content
 * cross-fade. The old menu fades under a flat layer of the new background, the
 * theme is swapped while that layer is fully opaque, and the flat layer fades
 * off the new menu. The two themes' screens are never blended with each other
 * (a true two-tree cross-fade was a non-goal: W2-08 brief, "Mechanism chosen").
 *
 * It reuses W2-04's sequencer and scrim unchanged (src/ui/scrimTransition.ts,
 * src/ui/ScreenScrim.tsx) with the same leg durations and backstop margin.
 * - The swap (`setDark`, the one `SaveSystem.darkMode` write, and therefore the
 *   StatusBar style App derives from `dark`) runs only in `onCovered`, exactly
 *   once per accepted toggle.
 * - A toggle pressed while a transition runs is ignored.
 * - Reduced motion: App passes no scrim (owner ruling 2026-09-25 for W2-04: a
 *   decorative scrim is skipped, the swap stays a plain cut).
 */

/** The part of W2-04's `ScrimTransition` the toggle uses. */
export interface ThemeScrim {
  readonly busy: boolean;
  start(onCovered: () => void): boolean;
  contentCommitted(): void;
  dispose(): void;
}

/**
 * `driver`, plus `onRest` whenever it brings the scrim to rest at opacity 0: the
 * uncover arrived, or a forced snap to 0 (the sequencer's backstop / AppState
 * end). The scrim's colour may only change back at rest, where it is invisible.
 */
export function withRestSignal(driver: ScrimDriver, onRest: () => void): ScrimDriver {
  return {
    cover: (durationMs, onDone) => driver.cover(durationMs, onDone),
    uncover: (durationMs, onDone) =>
      driver.uncover(durationMs, () => {
        onDone();
        onRest();
      }),
    snap: (opacity) => {
      driver.snap(opacity);
      if (opacity === 0) onRest();
    },
  };
}

/** The theme scrim's sequencer, wired like W2-04's level scrim (real clock, timers, frames, AppState). */
export function createThemeScrimTransition(
  opacity: SharedValue<number>,
  onRest: () => void,
): ScrimTransition<ReturnType<typeof setTimeout>, number> {
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
    driver: withRestSignal(createScrimDriver(opacity), onRest),
  });
}

/**
 * The toggle App hands to HomeScreen, plus what App needs to draw the scrim.
 * - `createScrim` null (flag OFF, or reduced motion): today's toggle exactly
 *   (the write inside the updater, one commit), and `scrim` is null.
 * - Otherwise one sequencer for App's life. `scrimDark` is the palette the scrim
 *   is coloured with: at rest the next toggle's destination (`!dark`), and from
 *   the swap to the end of the uncover the theme just swapped to, so the flat
 *   layer never changes colour while it is visible.
 * - `themeChanging()` is true from an accepted press to the end of the uncover.
 */
export function useThemeToggle({
  dark,
  setDark,
  persistDark,
  createScrim,
}: {
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
  persistDark: (dark: boolean) => void;
  createScrim: ((onRest: () => void) => ThemeScrim) | null;
}): {
  toggleTheme: () => void;
  scrim: ThemeScrim | null;
  scrimDark: boolean;
  themeChanging: () => boolean;
} {
  // The swapped-to theme while the scrim is up after a swap; null at rest.
  const [swappedTo, setSwappedTo] = useState<boolean | null>(null);
  const scrimRef = useRef<ThemeScrim | null>(null);
  if (createScrim && scrimRef.current === null) {
    scrimRef.current = createScrim(() => {
      // A late signal from an earlier leg must not recolour a running transition.
      if (!scrimRef.current?.busy) setSwappedTo(null);
    });
  }
  const scrim = scrimRef.current;

  useEffect(() => () => scrim?.dispose(), [scrim]);
  // The swapped theme is committed: the scrim may uncover one frame later
  // (a no-op at rest, e.g. the hydration's setDark).
  useEffect(() => {
    scrim?.contentCommitted();
  }, [dark, scrim]);

  const flip = useCallback(() => {
    setDark((d) => {
      persistDark(!d);
      return !d;
    });
  }, [persistDark, setDark]);

  const dipThroughScrim = useCallback(() => {
    if (!scrim || scrim.busy) return;
    const to = !dark;
    scrim.start(() => {
      setSwappedTo(to);
      setDark(to);
      persistDark(to);
    });
  }, [dark, persistDark, scrim, setDark]);

  // FINAL-FIX (FINAL-REVIEW finding 12): the menu asks this before opening its
  // Settings Modal, which would draw above the scrim and be re-coloured by the
  // swap in one visible frame. No scrim (flag OFF, reduced motion): never.
  const themeChanging = useCallback(() => scrim?.busy ?? false, [scrim]);

  return {
    toggleTheme: scrim ? dipThroughScrim : flip,
    scrim,
    scrimDark: swappedTo ?? !dark,
    themeChanging,
  };
}

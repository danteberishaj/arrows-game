import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, ReduceMotion, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

/**
 * PERF-DEADTAG: the screen hand-off. A screen that is left stays mounted,
 * invisible and untouchable, until the UI thread has run LEAVE_FRAMES frames after
 * the commit that mounted its successor; the next commit then removes it. When it
 * starts leaving, its registered animations are stopped on the UI thread (one
 * batched job, asynchronous: the JS thread never waits).
 *
 * Why: Reanimated 4.5.1 keeps the last animated props of every view it animated
 * in the previous ~2 s (the pulsing Play pill always), and drops a removed view's
 * entry only after Fabric reports the mount, which Fabric posts after the frame.
 * Every event dispatched during that frame's draw pass (react-native-svg dispatches
 * one per shape in its first draw: the gallery wall, the heart pips, the menu's ♪
 * strike) makes Reanimated re-apply all those entries through
 * `synchronouslyUpdateUIProps`, which throws, and logs a ~90-line stack trace, for
 * each view that is already gone. Removing the old screen after the new one has
 * drawn means its views still exist while the new screen draws for the first time.
 * And a Reanimated frame that still animates a removed view logs the same warning
 * (ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS); stopping the leaving screen's animations
 * a frame or more before its removal leaves nothing to write.
 *
 * Nothing changes on screen: the old screen turns invisible in the same commit
 * that mounts the new one (before, it was removed in that commit), and the new
 * screen mounts exactly when it did before.
 */

/**
 * UI frames between the commit that mounts the next screen and the commit that
 * removes the left one. One frame mounts and draws the successor; the second
 * covers a first svg draw that lands a frame later (fix round 1: 1 of 5 `#`-then-
 * leave runs drew the menu's ♪ strike in the frame after the mount).
 */
export const LEAVE_FRAMES = 2; // OWNER-PICKED STARTING VALUE (invisible; margin, not a timing)

/**
 * Calls `done` on the JS thread once the UI thread has run `frames` animation
 * frames. Worklets' requestAnimationFrame runs in ReactChoreographer's
 * NATIVE_ANIMATED_MODULE phase, after DISPATCH_UI (Fabric's mount) of the same
 * frame, and this is scheduled after the caller's commit, so that commit is
 * mounted by the first of them. Returns a canceller.
 */
export function afterUiFrames(frames: number, done: () => void): () => void {
  let live = true;
  const fire = () => {
    if (live) done();
  };
  scheduleOnUI(() => {
    'worklet';
    let left = frames;
    const tick = () => {
      left -= 1;
      if (left > 0) requestAnimationFrame(tick);
      else scheduleOnRN(fire);
    };
    requestAnimationFrame(tick);
  });
  return () => {
    live = false;
  };
}

const afterLeaveFrames = (done: () => void) => afterUiFrames(LEAVE_FRAMES, done);

/**
 * The screen being left (or null) and each screen's slot key. When `screen` changes,
 * the previous screen is returned as `leaving` in the same render, so the commit
 * that mounts the new screen still holds the old one, until `waitFrames` reports
 * that the UI thread has run its frames after that commit.
 *
 * `slotKey(s)` keeps a leaving screen's key and gives every newly shown screen a
 * fresh one, so a screen that is left and then shown again before the frame
 * remounts, as it did before the hand-off, instead of reviving its leaving instance.
 */
export function useLeavingScreen<S extends string>(
  screen: S,
  waitFrames: (done: () => void) => () => void = afterLeaveFrames,
): { leaving: S | null; slotKey: (s: S) => string } {
  const [state, setState] = useState({ shown: screen, visit: 0, leaving: null as S | null, leavingVisit: 0 });
  if (state.shown !== screen) {
    // React's "adjust state while rendering": re-renders before committing.
    setState({ shown: screen, visit: state.visit + 1, leaving: state.shown, leavingVisit: state.visit });
  }
  const { leaving, visit, leavingVisit } = state;
  useLayoutEffect(() => {
    if (leaving === null) return undefined;
    return waitFrames(() => setState((s) => ({ ...s, leaving: null })));
  }, [leaving, leavingVisit, waitFrames]);
  const slotKey = (s: S) => `${s}:${s === leaving ? leavingVisit : visit}`;
  return { leaving, slotKey };
}

/**
 * One slot's registry: the shared values its screen animates, the JS work to stop
 * when it starts leaving, and whether it is leaving.
 */
type LeaveRegistry = { leaving: boolean; values: Set<SharedValue<number>>; stops: Set<() => void> };
const LeaveContext = createContext<LeaveRegistry | null>(null);

/**
 * Registers these shared values with the enclosing ScreenSlot: when the screen
 * starts leaving, the slot stops them on the UI thread. Returns `isLeaving()`, so a
 * component can skip starting a new animation once its screen is leaving (a press
 * whose release is delayed past the switch). Outside a ScreenSlot it does nothing.
 * The values are captured on mount; `useSharedValue` keeps them stable.
 */
export function useStopWhenScreenLeaves(...values: SharedValue<number>[]): () => boolean {
  const registry = useContext(LeaveContext);
  useEffect(() => {
    if (!registry) return undefined;
    for (const value of values) registry.values.add(value);
    return () => {
      for (const value of values) registry.values.delete(value);
    };
    // Captured once: the shared values never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry]);
  return useCallback(() => registry?.leaving ?? false, [registry]);
}

/**
 * FINAL-FIX (FINAL-REVIEW finding 14): a mount effect whose work ends when the
 * screen starts leaving, not two UI frames later when the hand-off removes it.
 * `start` runs once after mount and returns its stop. The stop runs once: in the
 * layout effect of the commit where the enclosing ScreenSlot turns `leaving` (the
 * successor's mount commit), or on unmount if that never happened. For JS work
 * that must not land in the successor's first frames (the menu's sliced
 * collection fold). Outside a ScreenSlot it is a plain mount effect.
 */
export function useEffectUntilScreenLeaves(start: () => () => void): void {
  const registry = useContext(LeaveContext);
  useEffect(() => {
    if (registry?.leaving) return undefined;
    let stop: (() => void) | null = start();
    const end = () => {
      const s = stop;
      stop = null;
      s?.();
    };
    registry?.stops.add(end);
    return () => {
      registry?.stops.delete(end);
      end();
    };
    // Started once per mount, like the effects it replaces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry]);
}

/**
 * One screen's slot. Shown: `flex: 1`, and (with `fadeIn`) the ~180 ms cross-fade
 * in that App.tsx always used (DESIGN.md "Motion"; system reduce-motion: instant).
 * Leaving: laid over the new screen at opacity 0, untouchable and hidden from
 * accessibility, and its registered animations are stopped (one `scheduleOnUI`
 * for all of them, from the switch commit's layout effect, which runs before the
 * hand-off schedules its frame wait), until the hand-off removes it. Its
 * `useEffectUntilScreenLeaves` work stops in that same layout effect.
 *
 * FINAL-FIX (FINAL-REVIEW finding 8): the fade-in is an `entering` layout
 * animation, which keeps writing opacity on the UI thread until it ends, over any
 * style. So the leaving style (opacity 0) sits on a plain View AROUND the animated
 * one: a parent's opacity multiplies its children's, and a screen left within its
 * 180 ms fade-in stays invisible over its successor. The outer View is
 * `collapsable={false}` in both states, so the switch only changes its props and
 * never re-parents the screen's native views.
 */
export function ScreenSlot({
  leaving,
  fadeIn = true,
  children,
}: {
  leaving: boolean;
  fadeIn?: boolean;
  children: React.ReactNode;
}) {
  const [registry] = useState<LeaveRegistry>(() => ({ leaving: false, values: new Set(), stops: new Set() }));
  useLayoutEffect(() => {
    registry.leaving = leaving;
    if (!leaving) return;
    for (const stop of [...registry.stops]) stop();
    if (registry.values.size === 0) return;
    const values = [...registry.values];
    scheduleOnUI(() => {
      'worklet';
      for (const value of values) cancelAnimation(value);
    });
  }, [leaving, registry]);
  const props = {
    style: leaving ? styles.leaving : styles.shown,
    pointerEvents: leaving ? ('none' as const) : ('auto' as const),
    importantForAccessibility: leaving ? ('no-hide-descendants' as const) : ('auto' as const),
    accessibilityElementsHidden: leaving,
  };
  const content = <LeaveContext.Provider value={registry}>{children}</LeaveContext.Provider>;
  if (!fadeIn) return <View {...props}>{content}</View>;
  return (
    <View {...props} collapsable={false}>
      <Animated.View
        style={styles.shown}
        // Decorative screen fades follow the player's system reduced-motion setting.
        entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      >
        {content}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shown: { flex: 1 },
  leaving: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});

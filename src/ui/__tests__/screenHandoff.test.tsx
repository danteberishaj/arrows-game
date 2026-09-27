/**
 * PERF-DEADTAG: the screen hand-off (src/ui/screenHandoff.tsx) that App.tsx uses.
 * - The screen being left is still mounted in the commit that mounts its successor
 *   (never a committed state with the new screen and without the old one before
 *   the UI frame has run), and is released only when the UI-frame wait reports.
 * - A second switch before that frame cancels the first wait; unmounting cancels too.
 * - Slots keyed with `slotKey`: the leaving screen keeps its instance until the frame
 *   (no remount, no early unmount); a screen shown again before the frame remounts
 *   fresh, as it did before the hand-off.
 * - A leaving slot is invisible (opacity 0), laid over the new screen (absolute
 *   fill), untouchable and hidden from accessibility; a shown slot is today's
 *   `flex: 1` wrapper.
 * What jest cannot show: that Fabric mounts the removal in a LATER frame than the
 * new screen's first draw, and that no `synchronouslyUpdateUIProps failed` warning
 * is logged. Those close only on the emulator-5556 logcat counts in
 * artifacts/PERF-DEADTAG/.
 */
import { act, render } from '@testing-library/react-native';
import React, { useLayoutEffect } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { afterUiFrames, LEAVE_FRAMES, ScreenSlot, useEffectUntilScreenLeaves, useLeavingScreen } from '../screenHandoff';

type Wait = { done: () => void; cancelled: boolean };

/** The host view of the slot around `node`: the nearest ancestor that sets pointerEvents. */
function slotOf(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node;
  while (current && current.props.pointerEvents === undefined) current = current.parent;
  if (!current) throw new Error('no slot ancestor');
  return current;
}

function setup() {
  const waits: Wait[] = [];
  const waitFrame = (done: () => void) => {
    const w: Wait = { done, cancelled: false };
    waits.push(w);
    return () => {
      w.cancelled = true;
    };
  };
  const committed: string[] = [];
  function Harness({ screen }: { screen: string }) {
    const { leaving, slotKey } = useLeavingScreen(screen, waitFrame);
    const state = `${screen}|${leaving ?? '-'}|${slotKey(screen)}|${leaving === null ? '-' : slotKey(leaving)}`;
    useLayoutEffect(() => {
      committed.push(state);
    });
    return <Text>{state}</Text>;
  }
  return { waits, committed, Harness };
}

test('the left screen stays mounted in the commit that mounts the next one, until the UI frame has run', () => {
  const { waits, committed, Harness } = setup();
  const view = render(<Harness screen="menu" />);
  expect(committed).toEqual(['menu|-|menu:0|-']);
  expect(waits).toHaveLength(0);

  view.rerender(<Harness screen="game" />);
  // Never "game|-" before the frame: the switch commit already holds the menu, under
  // the key it had while shown (menu:0), so its instance is kept.
  expect(committed).toEqual(['menu|-|menu:0|-', 'game|menu|game:1|menu:0']);
  expect(waits).toHaveLength(1);

  view.rerender(<Harness screen="game" />); // an unrelated re-render keeps it
  expect(committed.at(-1)).toBe('game|menu|game:1|menu:0');
  expect(waits).toHaveLength(1);

  act(() => waits[0].done());
  expect(committed.at(-1)).toBe('game|-|game:1|-');
  expect(view.getByText('game|-|game:1|-')).toBeTruthy();
});

test('a second switch before the frame cancels the first wait; unmounting cancels the pending one', () => {
  const { waits, committed, Harness } = setup();
  const view = render(<Harness screen="menu" />);
  view.rerender(<Harness screen="gallery" />);
  view.rerender(<Harness screen="menu" />);
  // The menu is shown again before the frame: a new key (menu:2, not its leaving menu:0).
  expect(committed).toEqual(['menu|-|menu:0|-', 'gallery|menu|gallery:1|menu:0', 'menu|gallery|menu:2|gallery:1']);
  expect(waits).toHaveLength(2);
  expect(waits[0].cancelled).toBe(true);
  expect(waits[1].cancelled).toBe(false);

  view.unmount();
  expect(waits[1].cancelled).toBe(true);
});

test('keyed slots: the leaving screen keeps its instance until the frame; a screen shown again remounts', () => {
  const { waits } = setup();
  const log: string[] = [];
  function Probe({ name }: { name: string }) {
    React.useEffect(() => {
      log.push(`mount ${name}`);
      return () => {
        log.push(`unmount ${name}`);
      };
    }, [name]);
    return <Text>{name}</Text>;
  }
  const waitFrame = (done: () => void) => {
    const w: Wait = { done, cancelled: false };
    waits.push(w);
    return () => {
      w.cancelled = true;
    };
  };
  function MiniApp({ screen }: { screen: 'menu' | 'game' }) {
    const { leaving, slotKey } = useLeavingScreen(screen, waitFrame);
    return (
      <>
        {(['menu', 'game'] as const)
          .filter((s) => s === screen || s === leaving)
          .map((s) => (
            <ScreenSlot key={slotKey(s)} leaving={s === leaving}>
              <Probe name={s} />
            </ScreenSlot>
          ))}
      </>
    );
  }
  const view = render(<MiniApp screen="menu" />);
  view.rerender(<MiniApp screen="game" />);
  expect(log).toEqual(['mount menu', 'mount game']); // the menu is not unmounted with the switch
  act(() => waits[0].done());
  expect(log).toEqual(['mount menu', 'mount game', 'unmount menu']); // only after the UI frame

  log.length = 0;
  view.rerender(<MiniApp screen="menu" />); // game leaving
  view.rerender(<MiniApp screen="game" />); // shown again before the frame
  expect(log).toEqual(['mount menu', 'unmount game', 'mount game']); // a fresh game, not the leaving one
  view.unmount();
});

test('a leaving slot is invisible, laid over the new screen, untouchable and hidden from accessibility', () => {
  const shown = render(
    <ScreenSlot leaving={false}>
      <Text>screen</Text>
    </ScreenSlot>,
  );
  const shownSlot = slotOf(shown.getByText('screen'));
  expect(StyleSheet.flatten(shownSlot.props.style)).toEqual({ flex: 1 });
  expect(shownSlot.props.pointerEvents).toBe('auto');

  const leaving = render(
    <ScreenSlot leaving>
      <Text>screen</Text>
    </ScreenSlot>,
  );
  const leavingSlot = slotOf(leaving.getByText('screen', { includeHiddenElements: true }));
  expect(StyleSheet.flatten(leavingSlot.props.style)).toEqual({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  });
  expect(leavingSlot.props.pointerEvents).toBe('none');
  expect(leavingSlot.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(leavingSlot.props.accessibilityElementsHidden).toBe(true);
});

test('afterUiFrames reports after the given number of UI frames, and not at all once cancelled', () => {
  jest.useFakeTimers();
  try {
    expect(LEAVE_FRAMES).toBe(2);
    const done = jest.fn();
    afterUiFrames(2, done);
    expect(done).not.toHaveBeenCalled(); // asynchronous: a UI job, then UI frames
    act(() => jest.advanceTimersToNextTimer()); // the UI job
    act(() => jest.advanceTimersToNextTimer()); // frame 1
    expect(done).not.toHaveBeenCalled();
    act(() => jest.runAllTimers()); // frame 2, then the JS callback
    expect(done).toHaveBeenCalledTimes(1);

    const late = jest.fn();
    const cancel = afterUiFrames(2, late);
    cancel();
    act(() => jest.runAllTimers());
    expect(late).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

// ---- FINAL-FIX (FINAL-REVIEW findings 8 and 14) ------------------------------

test('finding 8: a leaving slot is hidden by a NON-animated host above its fade-in, so a FadeIn still running cannot show it', () => {
  const view = render(
    <ScreenSlot leaving={false}>
      <Text>screen</Text>
    </ScreenSlot>,
  );
  const textBefore = view.getByText('screen');
  view.rerender(
    <ScreenSlot leaving>
      <Text>screen</Text>
    </ScreenSlot>,
  );
  const text = view.getByText('screen', { includeHiddenElements: true });
  expect(text).toBe(textBefore); // the same instance: the switch does not remount the screen

  // The node the FadeIn layout animation drives (it writes opacity on the UI thread until it ends).
  const fading = view.UNSAFE_root.findAll((node) => node.props.entering !== undefined)[0];
  expect(fading).toBeDefined();
  expect(StyleSheet.flatten(fading.props.style)?.opacity).toBeUndefined();
  // Opacity 0 sits on an ancestor the layout animation never writes: a parent's 0 multiplies any child opacity.
  const hiders: ReactTestInstance[] = [];
  for (let node = fading.parent; node; node = node.parent) {
    if (StyleSheet.flatten(node.props.style)?.opacity === 0) hiders.push(node);
  }
  expect(hiders.length).toBeGreaterThan(0);
  expect(hiders.every((node) => node.props.entering === undefined)).toBe(true);
  // A shown slot keeps today's layout: both wrappers fill the screen.
  view.rerender(
    <ScreenSlot leaving={false}>
      <Text>screen</Text>
    </ScreenSlot>,
  );
  expect(StyleSheet.flatten(slotOf(view.getByText('screen')).props.style)).toEqual({ flex: 1 });
});

test('finding 14: useEffectUntilScreenLeaves stops the work in the commit where its slot starts leaving, once, and on unmount otherwise', () => {
  const log: string[] = [];
  function Worker({ name }: { name: string }) {
    useEffectUntilScreenLeaves(() => {
      log.push(`start ${name}`);
      return () => log.push(`stop ${name}`);
    });
    return <Text>{name}</Text>;
  }
  const view = render(
    <ScreenSlot leaving={false}>
      <Worker name="menu" />
    </ScreenSlot>,
  );
  expect(log).toEqual(['start menu']);

  view.rerender(
    <ScreenSlot leaving>
      <Worker name="menu" />
    </ScreenSlot>,
  );
  expect(log).toEqual(['start menu', 'stop menu']); // at the leave, while the slot is still mounted
  view.rerender(
    <ScreenSlot leaving>
      <Worker name="menu" />
    </ScreenSlot>,
  );
  view.unmount(); // the hand-off removes the slot: no second stop
  expect(log).toEqual(['start menu', 'stop menu']);

  // Outside a ScreenSlot (or never left): unmount stops it.
  log.length = 0;
  const bare = render(<Worker name="bare" />);
  bare.unmount();
  expect(log).toEqual(['start bare', 'stop bare']);
});

/**
 * W2-08 (META_THEME_TRANSITION): the menu's theme toggle through a flat scrim in
 * the DESTINATION palette's bg (src/ui/themeTransition.ts), driven by W2-04's
 * sequencer (src/ui/scrimTransition.ts, whose own suite already pins "a second
 * start while running returns false").
 * - null scrim (flag OFF, or reduced motion): today's toggle, value for value:
 *   one commit flips the theme and writes darkMode once.
 * - ON: nothing flips until the cover has arrived; then the theme (and with it the
 *   StatusBar style, which App derives from `dark`) and the darkMode write happen
 *   exactly once, in the swap; the scrim keeps the destination colour through the
 *   uncover; a toggle pressed while a transition runs is ignored.
 * What jest cannot show: the frames on screen and the status-bar icon change.
 * Those close only on the emulator-5556 captures in artifacts/W2-08/.
 */
import { act, render } from '@testing-library/react-native';
import React, { useState } from 'react';
import { ScrimTransition, type ScrimDriver } from '../scrimTransition';
import { useThemeToggle, withRestSignal, type ThemeScrim } from '../themeTransition';

const COVER_MS = 180;
const UNCOVER_MS = 180;
const MARGIN_MS = 85;
const FRAME_MS = 16;

class FakeDriver implements ScrimDriver {
  calls: string[] = [];
  coverDone: (() => void) | null = null;
  uncoverDone: (() => void) | null = null;
  cover(durationMs: number, onDone: () => void): void {
    this.calls.push(`cover ${durationMs}`);
    this.coverDone = onDone;
  }
  uncover(durationMs: number, onDone: () => void): void {
    this.calls.push(`uncover ${durationMs}`);
    this.uncoverDone = onDone;
  }
  snap(opacity: 0 | 1): void {
    this.calls.push(`snap ${opacity}`);
  }
}

type Seen = {
  dark: boolean;
  scrimDark: boolean;
  toggle: () => void;
  scrim: ThemeScrim | null;
  themeChanging: () => boolean;
};

function setup(withScrim: boolean) {
  const driver = new FakeDriver();
  const persisted: boolean[] = [];
  const persistDark = (value: boolean) => {
    persisted.push(value);
  };
  const created: Array<ThemeScrim & { readonly state: string }> = [];
  const createScrim = withScrim
    ? (onRest: () => void) => {
      const scrim = new ScrimTransition({
        coverMs: COVER_MS,
        uncoverMs: UNCOVER_MS,
        backstopMarginMs: MARGIN_MS,
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (handle) => clearTimeout(handle),
        requestFrame: (fn) => setTimeout(fn, FRAME_MS),
        cancelFrame: (handle) => clearTimeout(handle),
        subscribeAppState: () => () => {},
        driver: withRestSignal(driver, onRest),
      });
      created.push(scrim);
      return scrim;
    }
    : null;
  /** Every committed render's (dark, scrimDark), in order. */
  const commits: string[] = [];
  let seen: Seen | null = null;
  function Harness() {
    const [dark, setDark] = useState(false);
    const { toggleTheme, scrim, scrimDark, themeChanging } = useThemeToggle({ dark, setDark, persistDark, createScrim });
    seen = { dark, scrimDark, toggle: toggleTheme, scrim, themeChanging };
    React.useLayoutEffect(() => {
      commits.push(`dark=${dark} scrim=${scrimDark}`);
    });
    return null;
  }
  const view = render(<Harness />);
  const current = (): Seen => {
    if (!seen) throw new Error('not rendered');
    return seen;
  };
  return { driver, persisted, created, commits, view, current };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('no scrim (flag OFF, or reduced motion): today\'s one-commit toggle', () => {
  test('one press flips the theme in one commit and writes darkMode once', () => {
    const { persisted, current, created } = setup(false);
    expect(current().scrim).toBeNull();
    expect(created).toHaveLength(0);
    act(() => current().toggle());
    expect(current().dark).toBe(true);
    expect(persisted).toEqual([true]);
    act(() => current().toggle());
    expect(current().dark).toBe(false);
    expect(persisted).toEqual([true, false]);
  });
});

describe('ON: the swap happens under full cover', () => {
  test('nothing flips and nothing is written until the cover has arrived', () => {
    const { driver, persisted, current } = setup(true);
    act(() => current().toggle());
    expect(driver.calls).toEqual([`cover ${COVER_MS}`]);
    act(() => jest.advanceTimersByTime(COVER_MS - 1));
    expect(current().dark).toBe(false);
    expect(persisted).toEqual([]);
  });

  test('the cover arriving flips the theme and writes darkMode exactly once, in one commit', () => {
    const { driver, persisted, current, commits } = setup(true);
    act(() => current().toggle());
    const before = commits.length;
    act(() => driver.coverDone!());
    expect(current().dark).toBe(true);
    expect(persisted).toEqual([true]);
    // One commit carries the new theme and keeps the scrim in the destination colour.
    expect(commits.slice(before)).toEqual(['dark=true scrim=true']);
  });

  test('the scrim is coloured with the destination palette from rest, through the swap, to the end of the uncover', () => {
    const { driver, current } = setup(true);
    // At rest: the destination of the next toggle (Daylight now -> Ink Night).
    expect(current().scrimDark).toBe(true);
    act(() => current().toggle());
    expect(current().scrimDark).toBe(true);
    act(() => driver.coverDone!());
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, `uncover ${UNCOVER_MS}`]);
    expect(current().scrimDark).toBe(true);
    act(() => driver.uncoverDone!());
    // Back at rest: the next destination (Ink Night now -> Daylight).
    expect(current().scrim!.busy).toBe(false);
    expect(current().dark).toBe(true);
    expect(current().scrimDark).toBe(false);
  });

  test('the uncover waits for the committed new theme plus one frame', () => {
    const { driver, current } = setup(true);
    act(() => current().toggle());
    act(() => driver.coverDone!());
    expect(driver.calls).toEqual([`cover ${COVER_MS}`]);
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, `uncover ${UNCOVER_MS}`]);
  });

  test('a toggle pressed while the transition runs is ignored, in every leg', () => {
    const { driver, persisted, current } = setup(true);
    act(() => current().toggle());
    act(() => current().toggle()); // covering
    act(() => driver.coverDone!());
    act(() => current().toggle()); // covered, waiting for the frame
    act(() => jest.advanceTimersByTime(FRAME_MS));
    act(() => current().toggle()); // uncovering
    act(() => driver.uncoverDone!());
    expect(driver.calls.filter((c) => c.startsWith('cover'))).toHaveLength(1);
    expect(persisted).toEqual([true]);
    expect(current().dark).toBe(true);
    // A press once idle again is accepted.
    act(() => current().toggle());
    expect(driver.calls.filter((c) => c.startsWith('cover'))).toHaveLength(2);
  });

  test('a lost cover callback: the backstop swaps once under a snapped-opaque scrim; a lost uncover callback snaps to 0', () => {
    const { driver, persisted, current } = setup(true);
    act(() => current().toggle());
    act(() => jest.advanceTimersByTime(COVER_MS + MARGIN_MS));
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, 'snap 1']);
    expect(current().dark).toBe(true);
    expect(persisted).toEqual([true]);
    act(() => jest.advanceTimersByTime(FRAME_MS));
    act(() => jest.advanceTimersByTime(UNCOVER_MS + MARGIN_MS));
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, 'snap 1', `uncover ${UNCOVER_MS}`, 'snap 0']);
    expect(current().scrim!.busy).toBe(false);
    expect(current().scrimDark).toBe(false);
  });

  test('two full round trips write darkMode once each and end on the start theme', () => {
    const { driver, persisted, current } = setup(true);
    for (let i = 0; i < 2; i += 1) {
      act(() => current().toggle());
      act(() => driver.coverDone!());
      act(() => jest.advanceTimersByTime(FRAME_MS));
      act(() => driver.uncoverDone!());
    }
    expect(persisted).toEqual([true, false]);
    expect(current().dark).toBe(false);
    expect(current().scrimDark).toBe(true);
  });

  test('unmount disposes the sequencer: no timer is left', () => {
    const { view, current, created } = setup(true);
    act(() => current().toggle());
    view.unmount();
    expect(created[0].state).toBe('disposed');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('FINAL-FIX (finding 12): themeChanging() says when the menu must not open a Modal over the dip', () => {
  test('true from the press through the cover, the swap and the uncover; false at rest', () => {
    const { driver, current } = setup(true);
    expect(current().themeChanging()).toBe(false);
    act(() => current().toggle());
    expect(current().themeChanging()).toBe(true); // covering
    act(() => driver.coverDone!());
    expect(current().themeChanging()).toBe(true); // covered, the swap committing
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(current().themeChanging()).toBe(true); // uncovering
    act(() => driver.uncoverDone!());
    expect(current().themeChanging()).toBe(false);
  });

  test('no scrim (flag OFF, or reduced motion): never changing, the flip is one commit', () => {
    const { current } = setup(false);
    act(() => current().toggle());
    expect(current().themeChanging()).toBe(false);
  });
});

describe('withRestSignal', () => {
  test('signals rest when the uncover arrives and on a snap to 0, never on the cover or a snap to 1', () => {
    const driver = new FakeDriver();
    const onRest = jest.fn();
    const wrapped = withRestSignal(driver, onRest);
    const coverDone = jest.fn();
    const uncoverDone = jest.fn();
    wrapped.cover(COVER_MS, coverDone);
    driver.coverDone!();
    wrapped.snap(1);
    expect(onRest).not.toHaveBeenCalled();
    expect(coverDone).toHaveBeenCalledTimes(1);
    wrapped.uncover(UNCOVER_MS, uncoverDone);
    driver.uncoverDone!();
    expect(uncoverDone).toHaveBeenCalledTimes(1);
    expect(onRest).toHaveBeenCalledTimes(1);
    wrapped.snap(0);
    expect(onRest).toHaveBeenCalledTimes(2);
    expect(driver.calls).toEqual([`cover ${COVER_MS}`, 'snap 1', `uncover ${UNCOVER_MS}`, 'snap 0']);
  });
});

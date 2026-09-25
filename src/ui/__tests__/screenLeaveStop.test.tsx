/**
 * PERF-DEADTAG fix round 1: when a screen starts leaving (the ScreenSlot's `leaving`
 * turns true, one commit and >= 2 UI frames before its removal), the animations its
 * components registered stop on the UI thread: ONE asynchronous `scheduleOnUI` job for
 * the whole slot, never `runOnUISync` (the JS thread never waits for the UI thread).
 * - HomeScreen: the endless Play-pill breathing (`withRepeat`).
 * - PressScale (META_PRESS_SPRING): the press scale; and once its screen is leaving, a
 *   late press-in or release (Pressability delays onPressOut) starts no animation.
 * - SplashScreen: the wordmark, line, arrowhead and fade values.
 * Nothing is cancelled while the screen is shown. The mocks identify each value by the
 * animation assigned to it (a sentinel); scheduleOnUI jobs are queued and run by hand.
 * What jest cannot show: the UI-thread ordering and the absence of
 * `synchronouslyUpdateUIProps failed` warnings; those close only on the emulator-5556
 * logcat counts in artifacts/PERF-DEADTAG/.
 */
import { act, fireEvent, render, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import * as Worklets from 'react-native-worklets';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { PressScale } from '../PressScale';
import { ScreenSlot } from '../screenHandoff';
import { SplashScreen } from '../SplashScreen';
import { Daylight } from '../theme';

const mockFlags = { META_PRESS_SPRING: true };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_PRESS_SPRING: { get: () => mockFlags.META_PRESS_SPRING, enumerable: true } },
  ),
);

class MapStore implements IntStore {
  readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    return this.map.get(key) ?? defaultValue;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

/** One cancelAnimation call: the value the shared value held, and the UI job it ran in (-1: none). */
type Cancel = { held: unknown; job: number };
let cancels: Cancel[];
let uiJobs: (() => void)[];
let runningJob: number;
let previousStore: IntStore;

beforeEach(() => {
  jest.useFakeTimers(); // the menu's collection fold and the splash backstop wait; nothing here advances them
  mockFlags.META_PRESS_SPRING = true;
  cancels = [];
  uiJobs = [];
  runningJob = -1;
  jest.spyOn(Worklets, 'scheduleOnUI').mockImplementation(((fn: (...a: unknown[]) => unknown, ...args: unknown[]) => {
    uiJobs.push(() => {
      fn(...args);
    });
  }) as typeof Worklets.scheduleOnUI);
  jest.spyOn(Worklets, 'runOnUISync');
  jest.spyOn(Reanimated, 'cancelAnimation').mockImplementation((sv) => {
    cancels.push({ held: (sv as { value: unknown }).value, job: runningJob });
  });
  previousStore = SaveSystem.useStore(new MapStore());
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Runs the queued UI jobs, recording which job each cancel ran in. */
function runUiJobs() {
  const jobs = uiJobs.splice(0);
  jobs.forEach((job, i) => {
    runningJob = i;
    job();
    runningJob = -1;
  });
  return jobs.length;
}

const cancelledInUiJob = (sentinel: unknown) => cancels.some((c) => c.held === sentinel && c.job >= 0);

function Menu() {
  return (
    <HomeScreen
      palette={Daylight}
      dark={false}
      soundOn
      onPlay={jest.fn()}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />
  );
}

test('HomeScreen: its breathing stops when the menu starts leaving: one async UI job for the whole slot, no runOnUISync', () => {
  const BREATHING = { animation: 'pulse withRepeat' };
  jest.spyOn(Reanimated, 'withRepeat').mockImplementation((() => BREATHING) as never);
  const menu = <Menu />;
  const view = render(<ScreenSlot leaving={false}>{menu}</ScreenSlot>);
  expect(Reanimated.withRepeat).toHaveBeenCalledTimes(1);
  expect(runUiJobs()).toBe(0);
  view.rerender(<ScreenSlot leaving={false}>{menu}</ScreenSlot>);
  expect(runUiJobs()).toBe(0); // while the menu is shown nothing stops the breathing
  expect(cancels).toEqual([]);

  view.rerender(<ScreenSlot leaving>{menu}</ScreenSlot>);
  expect(cancels).toEqual([]); // asynchronous: nothing ran on the JS thread
  expect(runUiJobs()).toBe(1); // one batched job
  expect(cancelledInUiJob(BREATHING)).toBe(true);
  // The pulse plus the menu's SpringPress buttons (☾, ♪, Play), all in that one job.
  expect(cancels.length).toBeGreaterThanOrEqual(4);
  expect(cancels.every((c) => c.job === 0)).toBe(true);
  expect(Worklets.runOnUISync).not.toHaveBeenCalled();

  act(() => view.unmount());
  expect(runUiJobs()).toBe(0); // the unmount itself schedules nothing more
  expect(Worklets.runOnUISync).not.toHaveBeenCalled();
});

test('PressScale: a press whose screen then leaves has its animation stopped; a late release starts no spring', async () => {
  const PRESS_IN = { animation: 'press-in withTiming' };
  const RELEASE = { animation: 'release withSpring' };
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((() => PRESS_IN) as never);
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((() => RELEASE) as never);
  const onPress = jest.fn();
  const button = (
    <PressScale onPress={onPress} style={() => ({ width: 44, height: 44 })}>
      <Text>Play</Text>
    </PressScale>
  );
  const view = render(<ScreenSlot leaving={false}>{button}</ScreenSlot>);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.press(view.getByText('Play'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Reanimated.withSpring).toHaveBeenCalledTimes(1); // the release spring runs

  view.rerender(<ScreenSlot leaving>{button}</ScreenSlot>);
  expect(runUiJobs()).toBe(1);
  expect(cancelledInUiJob(RELEASE)).toBe(true);

  // A press-in and a release that reach the leaving (invisible) button start nothing.
  const pressable = view.getByText('Play', { includeHiddenElements: true });
  fireEvent(pressable, 'pressIn');
  fireEvent(pressable, 'pressOut');
  expect(Reanimated.withTiming).toHaveBeenCalledTimes(1);
  expect(Reanimated.withSpring).toHaveBeenCalledTimes(1);
  expect(Worklets.runOnUISync).not.toHaveBeenCalled();
});

test('SplashScreen: the wordmark, line, arrowhead and fade values stop when the splash starts leaving', () => {
  const delayed: object[] = [];
  jest.spyOn(Reanimated, 'withDelay').mockImplementation((() => {
    const sentinel = { animation: `splash withDelay #${delayed.length}` };
    delayed.push(sentinel);
    return sentinel;
  }) as never);
  const splash = <SplashScreen palette={Daylight} onDone={jest.fn()} />;
  const view = render(<ScreenSlot leaving={false} fadeIn={false}>{splash}</ScreenSlot>);
  expect(delayed).toHaveLength(4); // mark, draw, head, out
  expect(runUiJobs()).toBe(0);

  view.rerender(<ScreenSlot leaving fadeIn={false}>{splash}</ScreenSlot>);
  expect(runUiJobs()).toBe(1);
  for (const sentinel of delayed) expect(cancelledInUiJob(sentinel)).toBe(true);
  expect(Worklets.runOnUISync).not.toHaveBeenCalled();
});

test('an in-screen unmount (the win / lose panel buttons on Next / Retry) schedules nothing and never waits on the UI thread', () => {
  const panel = (shown: boolean) => (
    <ScreenSlot leaving={false}>
      {shown && (
        <>
          <PressScale onPress={jest.fn()} style={() => ({ width: 44, height: 44 })}>
            <Text>Next level</Text>
          </PressScale>
          <PressScale onPress={jest.fn()} style={() => ({ width: 44, height: 44 })}>
            <Text>Retry</Text>
          </PressScale>
        </>
      )}
    </ScreenSlot>
  );
  const view = render(panel(true));
  view.rerender(panel(false));
  expect(runUiJobs()).toBe(0);
  expect(cancels).toEqual([]);
  expect(Worklets.runOnUISync).not.toHaveBeenCalled();

  // Outside any ScreenSlot the hook is inert too.
  const bare = render(
    <PressScale onPress={jest.fn()} style={() => ({ width: 44, height: 44 })}>
      <Text>Next level</Text>
    </PressScale>,
  );
  act(() => bare.unmount());
  expect(runUiJobs()).toBe(0);
  expect(cancels).toEqual([]);
});

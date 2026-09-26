/**
 * W4-06: GameScreen in daily mode (`daily={{ day }}`), against the real
 * SaveSystem over an in-memory store. The hazard is the clear path: the
 * campaign branch always advances `currentLevel` and counts a finished game
 * toward the interstitial, and a daily routed through it would skip a campaign
 * level and add ad exposure. Pixels, layout and motion close only on the
 * emulator captures in artifacts/W4-06/.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { generateDaily } from '../../core';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { createMemorySink, noopSink, Telemetry } from '../../telemetry/telemetry';
import type { BoardViewProps } from '../BoardView';
import type { ScrimDriver } from '../scrimTransition';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = { META_LEVEL_TRANSITION: false };
const mockDriver: ScrimDriver & { calls: string[]; coverDone: (() => void) | null } = {
  calls: [],
  coverDone: null,
  cover(ms, done) {
    this.calls.push(`cover ${ms}`);
    this.coverDone = done;
  },
  uncover(ms) {
    this.calls.push(`uncover ${ms}`);
  },
  snap(v) {
    this.calls.push(`snap ${v}`);
  },
};
const mockAds = {
  registerGameFinished: jest.fn(),
  showInterstitialIfDue: jest.fn(async () => undefined),
  showRewarded: jest.fn(async (_placement: string) => false),
};

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_LEVEL_TRANSITION: { get: () => mockFlags.META_LEVEL_TRANSITION, enumerable: true } },
  ));

jest.mock('../ScreenScrim', () => {
  const { View: MockView } = jest.requireActual('react-native');
  const { ScrimTransition } = jest.requireActual('../scrimTransition');
  return {
    ScreenScrim: () => <MockView testID="level-scrim" />,
    createLevelScrimTransition: () => new ScrimTransition({
      coverMs: 180,
      uncoverMs: 180,
      backstopMarginMs: 85,
      now: () => Date.now(),
      setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimer: (h: ReturnType<typeof setTimeout>) => clearTimeout(h),
      requestFrame: (fn: () => void) => setTimeout(fn, 16),
      cancelFrame: (h: ReturnType<typeof setTimeout>) => clearTimeout(h),
      subscribeAppState: () => () => undefined,
      driver: mockDriver,
    }),
    showAdThenPanelBeat: (show: () => Promise<unknown>) => show().then(() => undefined),
  };
});

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return false;
    },
    isRewardedReady: () => false,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => mockAds.registerGameFinished(),
    showInterstitialIfDue: () => mockAds.showInterstitialIfDue(),
    showRewarded: (placement: string) => mockAds.showRewarded(placement),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');

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

const DAY = 2450; // golden daily: Plus (src/core/__tests__/dailyBoard.test.ts)
const dayDate = (day: number, hours = 12) => new Date(2020, 0, 1 + day, hours, 0, 0);

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let clockNow: Date;
let sink: ReturnType<typeof createMemorySink>;

const renderGame = (props: { daily?: { day: number }; onHome?: () => void } = {}) =>
  render(
    <GameScreen
      palette={Daylight}
      onHome={props.onHome ?? jest.fn()}
      daily={props.daily}
      feedbackEnabled={false}
    />,
  );

function winBoard(screen: ReturnType<typeof renderGame>, primaryLabel: string) {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
  return screen.getByText(primaryLabel);
}

function loseBoard(screen: ReturnType<typeof renderGame>) {
  for (let i = 0; i < 3; i += 1) {
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
  }
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });
  return screen.getByText('Retry');
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockFlags.META_LEVEL_TRANSITION = false;
  mockDriver.calls = [];
  mockDriver.coverDone = null;
  mockAds.registerGameFinished.mockClear();
  mockAds.showInterstitialIfDue.mockClear();
  mockAds.showRewarded.mockClear();

  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  clockNow = dayDate(DAY);
  previousClock = SaveSystem.useClock(() => clockNow);
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  store.setInt('arrows_day_streak', 4);
  store.setInt('arrows_last_play_day', DAY - 1);

  sink = createMemorySink(Number.MAX_SAFE_INTEGER);
  Telemetry.configure({ validate: true, disabled: false });
  Telemetry.useSink(sink);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  Telemetry.useSink(noopSink);
  jest.useRealTimers();
});

describe('positive control: the same harness catches the campaign clear path', () => {
  test('a campaign clear advances currentLevel and counts a finished game', () => {
    const screen = renderGame();
    expect(screen.getByText('LEVEL 8')).toBeTruthy();
    winBoard(screen, 'Next level');
    expect(SaveSystem.currentLevel).toBe(8);
    expect(mockAds.registerGameFinished).toHaveBeenCalledTimes(1);
    expect(SaveSystem.dailyLastDay).toBe(0);
  });
});

describe('daily mode', () => {
  test('the board is generateDaily(day) and the header reads TODAY', () => {
    const screen = renderGame({ daily: { day: DAY } });
    const expected = generateDaily(DAY);
    expect(mockBoardViewProps!.board.count()).toBe(expected.arrowCount);
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.queryByText(/LEVEL/)).toBeNull();
    // W5-03: the counter is a digits slot plus ' left', read as one element.
    expect(screen.getByLabelText(`${expected.arrowCount} left`)).toBeTruthy();
  });

  test('a clear records the solve and the day, never the campaign pointer or the ad counter', () => {
    const expected = generateDaily(DAY);
    const screen = renderGame({ daily: { day: DAY } });

    winBoard(screen, 'Done');

    expect(SaveSystem.currentLevel).toBe(7);
    expect(SaveSystem.totalSolved).toBe(21);
    expect(SaveSystem.dayStreak).toBe(5);
    expect(SaveSystem.dailyLastDay).toBe(DAY);
    expect(mockAds.registerGameFinished).not.toHaveBeenCalled();
    expect(
      screen.getByText(`Today · ${expected.shapeName} · ${expected.arrowCount} arrows`),
    ).toBeTruthy();
    expect(screen.queryByText('Next level')).toBeNull();
  });

  test('Done returns to the menu: no interstitial, no next board, no scrim (flag ON)', async () => {
    mockFlags.META_LEVEL_TRANSITION = true;
    const onHome = jest.fn();
    const screen = renderGame({ daily: { day: DAY }, onHome });
    const done = winBoard(screen, 'Done');
    const board = mockBoardViewProps!.board;

    await act(async () => {
      fireEvent.press(done);
    });

    expect(onHome).toHaveBeenCalledTimes(1);
    expect(mockAds.showInterstitialIfDue).not.toHaveBeenCalled();
    expect(mockDriver.calls).toEqual([]);
    expect(mockBoardViewProps!.board).toBe(board);
    expect(SaveSystem.currentLevel).toBe(7);
  });

  test('a clear after midnight still records the board’s own day', () => {
    const screen = renderGame({ daily: { day: DAY } });
    clockNow = dayDate(DAY + 1, 0);

    winBoard(screen, 'Done');

    expect(SaveSystem.dailyLastDay).toBe(DAY);
    expect(SaveSystem.currentLevel).toBe(7);
  });

  test('a loss counts no finished game; Retry rebuilds the same day’s board', () => {
    const expected = generateDaily(DAY);
    const screen = renderGame({ daily: { day: DAY } });
    const before = mockBoardViewProps!.board;

    fireEvent.press(loseBoard(screen));

    expect(mockAds.registerGameFinished).not.toHaveBeenCalled();
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(mockBoardViewProps!.board.count()).toBe(expected.arrowCount);
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(SaveSystem.currentLevel).toBe(7);
    expect(SaveSystem.dailyLastDay).toBe(0);
  });

  test('Retry uses the campaign routing: the swap waits for the scrim cover (flag ON)', () => {
    mockFlags.META_LEVEL_TRANSITION = true;
    const screen = renderGame({ daily: { day: DAY } });
    const before = mockBoardViewProps!.board;

    fireEvent.press(loseBoard(screen));
    expect(mockDriver.calls).toEqual(['cover 180']);
    expect(mockBoardViewProps!.board).toBe(before);

    act(() => {
      mockDriver.coverDone!();
    });
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(mockBoardViewProps!.board.count()).toBe(generateDaily(DAY).arrowCount);
    expect(screen.getByText('TODAY')).toBeTruthy();
  });

  test('telemetry: mode daily with the day as levelIndex, on the first board and after Retry', () => {
    const screen = renderGame({ daily: { day: DAY } });
    fireEvent.press(loseBoard(screen));
    winBoard(screen, 'Done');

    type LevelEvent = { name: string; mode: string; levelIndex: number; outcome?: string };
    const events = sink.events as unknown as LevelEvent[];
    const starts = events.filter((e) => e.name === 'level_start');
    const ends = events.filter((e) => e.name === 'level_end');
    expect(starts.map((e) => [e.mode, e.levelIndex])).toEqual([
      ['daily', DAY],
      ['daily', DAY],
    ]);
    expect(ends.map((e) => [e.mode, e.levelIndex, e.outcome])).toEqual([
      ['daily', DAY, 'out_of_hearts'],
      ['daily', DAY, 'cleared'],
    ]);
  });
});

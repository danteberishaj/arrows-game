/**
 * W4-13 (META_SHARE_CARD, owner 2026-10-06 Q4): the Share control exists only on the DAILY win panel and hands
 * buildDailyShareText's card to React Native's Share API with the day, the shape, the hearts left and the day streak
 * after the clear. Setup copied from GameScreen.daily.test.tsx (real SaveSystem over an in-memory store). The share
 * sheet itself closes only on the emulator capture (artifacts/W4-13/).
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
const mockFlags = { META_LEVEL_TRANSITION: false, META_SHARE_CARD: false };
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
    {
      META_LEVEL_TRANSITION: { get: () => mockFlags.META_LEVEL_TRANSITION, enumerable: true },
      META_SHARE_CARD: { get: () => mockFlags.META_SHARE_CARD, enumerable: true },
    },
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
    mockBoardViewProps!.onRemoved(true, 0);
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
  mockFlags.META_SHARE_CARD = false;
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
  Telemetry.useSink(sink);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  Telemetry.useSink(noopSink);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Share } = require('react-native') as typeof import('react-native');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildDailyShareText } = require('../shareCard') as typeof import('../shareCard');

test('flag OFF: the daily win panel has no Share control', () => {
  const screen = renderGame({ daily: { day: DAY } });
  winBoard(screen, 'Done');
  expect(screen.queryByText('Share')).toBeNull();
});

test('flag ON: the daily win panel shares the day\'s card through the Share API', () => {
  mockFlags.META_SHARE_CARD = true;
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
  const screen = renderGame({ daily: { day: DAY } });
  winBoard(screen, 'Done');
  expect(SaveSystem.dayStreak).toBe(5); // the clear extended yesterday's 4-day streak
  fireEvent.press(screen.getByText('Share'));
  const level = generateDaily(DAY);
  expect(share).toHaveBeenCalledTimes(1);
  expect(share.mock.calls[0][0]).toEqual({
    message: buildDailyShareText({ day: DAY, mask: level.mask, shapeName: level.shapeName, heartsLeft: level.hearts, maxHearts: level.hearts, streak: 5 }),
  });
  expect(share.mock.calls[0][0]).not.toHaveProperty('url');
  expect((share.mock.calls[0][0] as { message: string }).message.split('\n').slice(0, 4))
    .toEqual([expect.stringMatching(/^Arrows · \d{4}-\d{2}-\d{2}$/), level.shapeName, `Hearts left: ${level.hearts}/${level.hearts}`, 'Day streak: 5']);
});

test('flag ON: a rejected share changes nothing (no throw, the panel stays)', async () => {
  mockFlags.META_SHARE_CARD = true;
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('no activity'));
  const screen = renderGame({ daily: { day: DAY } });
  winBoard(screen, 'Done');
  fireEvent.press(screen.getByText('Share'));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('Done')).toBeTruthy();
});

test('flag ON: the campaign win panel and the daily lose panel have no Share control', () => {
  mockFlags.META_SHARE_CARD = true;
  const campaign = renderGame();
  winBoard(campaign, 'Next level');
  expect(campaign.queryByText('Share')).toBeNull();
  campaign.unmount();
  const daily = renderGame({ daily: { day: DAY } });
  loseBoard(daily);
  expect(daily.queryByText('Share')).toBeNull();
});

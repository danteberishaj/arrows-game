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
const mockFlags = { META_LEVEL_TRANSITION: false, META_SHARE_CARD: false, META_SHARE_CARD_LEVEL: false };
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
      META_SHARE_CARD_LEVEL: { get: () => mockFlags.META_SHARE_CARD_LEVEL, enumerable: true },
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

const renderGame = (props: { daily?: { day: number }; onHome?: () => void; tutorialId?: 'T1' | 'T2'; tutorialReplay?: boolean } = {}) =>
  render(
    <GameScreen
      palette={Daylight}
      onHome={props.onHome ?? jest.fn()}
      daily={props.daily}
      tutorialId={props.tutorialId}
      tutorialReplay={props.tutorialReplay}
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
  mockFlags.META_SHARE_CARD_LEVEL = false;
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
const { buildDailyShareText, buildLevelShareText } = require('../shareCard') as typeof import('../shareCard');

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

/**
 * TF-02 B (META_SHARE_CARD_LEVEL): the CAMPAIGN win panel's Share. Only a campaign clear with the flag on shows it;
 * tutorial boards (and "How to play" replays, which are tutorial boards) have no panel at all.
 */
describe('TF-02 B: the campaign win panel Share (META_SHARE_CARD_LEVEL)', () => {
  test('flag OFF (default): the campaign win panel has no Share control', () => {
    const screen = renderGame();
    winBoard(screen, 'Next level');
    expect(screen.queryByText('Share')).toBeNull();
  });

  test('flag ON: the campaign win panel shares "Arrows · Level N" with N as the header shows it', () => {
    mockFlags.META_SHARE_CARD_LEVEL = true;
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
    const screen = renderGame();
    expect(screen.getByText('LEVEL 8')).toBeTruthy(); // arrows_current_level 7 = the header's "LEVEL 8"
    const level = mockBoardViewProps!.board;
    expect(level).toBeTruthy();
    winBoard(screen, 'Next level');
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button).toBeTruthy();
    fireEvent.press(screen.getByText('Share'));
    expect(share).toHaveBeenCalledTimes(1);
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(share.mock.calls[0][0]).not.toHaveProperty('url');
    const [title, shapeName, hearts, blank] = message.split('\n');
    expect(title).toBe('Arrows · Level 8');
    expect(screen.getByText(new RegExp(`^Level 8 · ${shapeName} · `))).toBeTruthy(); // the panel's own subline
    expect(hearts).toBe('Hearts left: 3/3');
    expect(blank).toBe('');
  });

  test('flag ON: the card is buildLevelShareText of the cleared level (mask, shape, hearts left after a miss)', () => {
    mockFlags.META_SHARE_CARD_LEVEL = true;
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
    const screen = renderGame();
    act(() => { mockBoardViewProps!.onBlocked(true); }); // one heart lost
    winBoard(screen, 'Next level');
    fireEvent.press(screen.getByText('Share'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lifecycle = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
    const level = lifecycle.generateCampaignLevel(7, lifecycle.levelGenVersion(7));
    expect((share.mock.calls[0][0] as { message: string }).message).toBe(
      buildLevelShareText({ levelNumber: 8, mask: level.mask, shapeName: level.shapeName, heartsLeft: level.hearts - 1, maxHearts: level.hearts }),
    );
  });

  test('flag ON: the campaign lose panel, the daily win panel (META_SHARE_CARD off) and tutorial boards have none', () => {
    mockFlags.META_SHARE_CARD_LEVEL = true;
    const lost = renderGame();
    loseBoard(lost);
    expect(lost.queryByText('Share')).toBeNull();
    lost.unmount();
    const daily = renderGame({ daily: { day: DAY } });
    winBoard(daily, 'Done');
    expect(daily.queryByText('Share')).toBeNull();
    daily.unmount();
    for (const props of [{ tutorialId: 'T1' as const }, { tutorialId: 'T1' as const, tutorialReplay: true }]) {
      const tutorial = renderGame(props);
      const board = mockBoardViewProps!.board;
      act(() => {
        for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
        mockBoardViewProps!.onRemoved(true, 0);
      });
      act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS * 4); });
      expect(tutorial.queryByText('Share')).toBeNull();
      expect(tutorial.queryByText('Next level')).toBeNull();
      tutorial.unmount();
    }
  });

  test('both flags ON: the daily panel keeps its own daily card (one Share), the campaign panel gets the level card', () => {
    mockFlags.META_SHARE_CARD = true;
    mockFlags.META_SHARE_CARD_LEVEL = true;
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' } as never);
    const daily = renderGame({ daily: { day: DAY } });
    winBoard(daily, 'Done');
    expect(daily.getAllByText('Share')).toHaveLength(1);
    fireEvent.press(daily.getByText('Share'));
    expect((share.mock.calls[0][0] as { message: string }).message).toMatch(/^Arrows · \d{4}-\d{2}-\d{2}\n/);
  });
});

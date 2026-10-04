/** REWARD-01: real reward ledger and arrow selection across campaign, daily and guarded clears. */
import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { reviewDeclineReason } from '../../core/reviewPolicy';
import type { BoardViewProps } from '../BoardView';
import type { ScrimDriver } from '../scrimTransition';
import { getArrowStyle, initializeArrowStyle } from '../arrowStyleSelection';
import * as rewardLedger from '../rewardLedger';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = {
  META_LEVEL_TRANSITION: false,
  META_REWARD_PATH: true,
  META_SKIN_PICKER: true,
  META_REVIEW_PROMPT: false,
};
const mockDriver: ScrimDriver & { calls: string[]; coverDone: (() => void) | null } = {
  calls: [],
  coverDone: null,
  cover(ms, done) { this.calls.push(`cover ${ms}`); this.coverDone = done; },
  uncover(ms) { this.calls.push(`uncover ${ms}`); },
  snap(v) { this.calls.push(`snap ${v}`); },
};
const mockAds = {
  interstitialDue: false,
  registerGameFinished: jest.fn(),
  showInterstitialIfDue: jest.fn(async () => undefined),
  showRewarded: jest.fn(async (_placement: string) => false),
};
const mockReviewAvailable = jest.fn(async () => true);
const mockReviewRequest = jest.fn(async () => undefined);
const mockLoadStoreReview = jest.fn(() => ({
  isAvailableAsync: mockReviewAvailable,
  requestReview: mockReviewRequest,
}));

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => { mockBoardViewProps = props; return null; },
}));
jest.mock('../../featureFlags', () => Object.defineProperties(
  { ...jest.requireActual('../../featureFlags') },
  {
    META_LEVEL_TRANSITION: { get: () => mockFlags.META_LEVEL_TRANSITION, enumerable: true },
    META_REWARD_PATH: { get: () => mockFlags.META_REWARD_PATH, enumerable: true },
    META_SKIN_PICKER: { get: () => mockFlags.META_SKIN_PICKER, enumerable: true },
    META_REVIEW_PROMPT: { get: () => mockFlags.META_REVIEW_PROMPT, enumerable: true },
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
    get rewardedReady() { return false; },
    get interstitialDue() { return mockAds.interstitialDue; },
    isRewardedReady: () => false,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => mockAds.registerGameFinished(),
    showInterstitialIfDue: () => mockAds.showInterstitialIfDue(),
    showRewarded: (placement: string) => mockAds.showRewarded(placement),
  },
}));
jest.mock('../reviewPrompt', () => ({
  ...jest.requireActual('../reviewPrompt'),
  loadStoreReview: () => mockLoadStoreReview(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { REVIEW_DWELL_MS, reviewSession } = require('../reviewPrompt') as typeof import('../reviewPrompt');

class MapStore implements IntStore {
  readonly map = new Map<string, number>();
  readonly reads: string[] = [];
  readonly writes: { key: string; value: number }[] = [];
  getInt(key: string, defaultValue: number): number {
    this.reads.push(key);
    return this.map.get(key) ?? defaultValue;
  }
  setInt(key: string, value: number): void {
    this.writes.push({ key, value });
    this.map.set(key, value);
  }
  deleteKey(key: string): void { this.map.delete(key); }
  clearAccesses(): void { this.reads.length = 0; this.writes.length = 0; }
}

const DAY = 2450;
const LEVEL = 7;
let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let previousHealthy: boolean;
let platformDescriptor: PropertyDescriptor | undefined;
let recordClearSpy: jest.SpyInstance;

type GameProps = Partial<React.ComponentProps<typeof GameScreen>>;
const renderGame = (props: GameProps = {}) =>
  render(<GameScreen palette={Daylight} onHome={jest.fn()} feedbackEnabled={false} {...props} />);

/** Remove the real board's legal arrows, then drive the same clear callback and delay as the daily harness. */
function clearBoard() {
  const board = mockBoardViewProps!.board;
  act(() => {
    while (board.count() > 0) {
      const arrow = board.findHint();
      if (!arrow || !board.tryRemove(arrow)) throw new Error('Reward test board has no legal removal');
    }
    mockBoardViewProps!.onRemoved(true, 0);
  });
  act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS); });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

function seedPoints(points: number) {
  store.setInt('arrows_reward_points', points);
  rewardLedger.initializeRewardLedger(store, true, {
    writable: true, totalSolved: 0, selectedNumericId: 0, book: false,
  });
  store.clearAccesses();
}

const rewardAccesses = () => ({
  reads: store.reads.filter(key => rewardLedger.REWARD_KEYS.includes(key)),
  writes: store.writes.filter(({ key }) => rewardLedger.REWARD_KEYS.includes(key)),
});

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  Object.assign(mockFlags, {
    META_LEVEL_TRANSITION: false, META_REWARD_PATH: true, META_SKIN_PICKER: true, META_REVIEW_PROMPT: false,
  });
  platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockDriver.calls = [];
  mockDriver.coverDone = null;
  mockAds.interstitialDue = false;
  mockAds.registerGameFinished.mockClear();
  mockAds.showInterstitialIfDue.mockReset().mockImplementation(async () => undefined);
  mockAds.showRewarded.mockClear();
  mockReviewAvailable.mockClear();
  mockReviewRequest.mockClear();
  mockLoadStoreReview.mockClear();
  reviewSession.asked = false;

  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2020, 0, 1 + DAY, 12, 0, 0));
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
  store.setInt('arrows_current_level', LEVEL);
  store.setInt('arrows_total_solved', 0);
  store.setInt('arrows_ftue_stage', 3);
  rewardLedger.initializeRewardLedger(store, true, {
    writable: true, totalSolved: 0, selectedNumericId: 0, book: false,
  });
  initializeArrowStyle(store, true);
  store.clearAccesses();
  recordClearSpy = jest.spyOn(rewardLedger, 'recordRewardClear');
});

afterEach(() => {
  rewardLedger.initializeRewardLedger(null, false, {
    writable: false, totalSolved: 0, selectedNumericId: 0, book: false,
  });
  initializeArrowStyle(null, false);
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('a clear that does not cross a threshold shows the pill, not the card', () => {
  const screen = renderGame();
  act(() => { mockBoardViewProps!.onBlocked(true); });
  clearBoard();
  expect(screen.getByTestId('reward-pill')).toBeTruthy();
  expect(screen.queryByTestId('reward-reveal')).toBeNull();
  expect(rewardLedger.getRewardState()!.points).toBe(1);
  expect(recordClearSpy).toHaveBeenCalledWith('campaign', false);
});

test('crossing the threshold shows the card over the panel; Play with Critter selects it, then runs Next', async () => {
  seedPoints(2);
  mockAds.interstitialDue = true;
  let closeAd!: () => void;
  mockAds.showInterstitialIfDue.mockImplementationOnce(() => new Promise<undefined>(resolve => {
    closeAd = () => resolve(undefined);
  }));
  const screen = renderGame();
  const before = mockBoardViewProps!.board;
  clearBoard();
  expect(screen.getByTestId('reward-reveal')).toBeTruthy();
  expect(rewardLedger.getRewardState()!.points).toBe(4);
  expect(mockAds.showInterstitialIfDue).not.toHaveBeenCalled();
  expect(store.map.get('arrows_reward_seen')).toBe(1);
  await act(async () => { fireEvent.press(screen.getByTestId('reward-use')); });
  expect(getArrowStyle().id).toBe('critter');
  expect(mockAds.showInterstitialIfDue).toHaveBeenCalledTimes(1);
  expect(mockBoardViewProps!.board).toBe(before);
  await act(async () => { closeAd(); });
  expect(mockBoardViewProps!.board).not.toBe(before);
  expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
  expect(screen.queryByTestId('reward-reveal')).toBeNull();
});

test('Keep current style leaves the selection and runs Next', async () => {
  seedPoints(2);
  const screen = renderGame();
  const before = mockBoardViewProps!.board;
  clearBoard();
  await act(async () => { fireEvent.press(screen.getByTestId('reward-keep')); });
  expect(getArrowStyle().id).toBe('classic');
  expect(mockAds.showInterstitialIfDue).toHaveBeenCalledTimes(1);
  expect(mockBoardViewProps!.board).not.toBe(before);
  expect(screen.getByText(`LEVEL ${LEVEL + 2}`)).toBeTruthy();
});

test('daily unlock: Use Critter selects and returns home (Done)', async () => {
  seedPoints(2);
  const onHome = jest.fn();
  const screen = renderGame({ daily: { day: DAY }, onHome });
  const before = mockBoardViewProps!.board;
  clearBoard();
  expect(screen.getByText('Use Critter')).toBeTruthy();
  expect(recordClearSpy).toHaveBeenCalledWith('daily', true);
  expect(rewardLedger.getRewardState()!.points).toBe(5);
  await act(async () => { fireEvent.press(screen.getByTestId('reward-use')); });
  expect(getArrowStyle().id).toBe('critter');
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(mockAds.showInterstitialIfDue).not.toHaveBeenCalled();
  expect(mockAds.registerGameFinished).not.toHaveBeenCalled();
  expect(mockBoardViewProps!.board).toBe(before);
  expect(SaveSystem.currentLevel).toBe(LEVEL);
});

test('no store-review ask on a reveal clear', async () => {
  seedPoints(2);
  store.setInt('arrows_total_solved', 30);
  mockFlags.META_REVIEW_PROMPT = true;
  const screen = renderGame();
  clearBoard();
  expect(reviewDeclineReason({
    perfect: true, assisted: false, totalSolved: SaveSystem.totalSolved,
    today: SaveSystem.today(), count: SaveSystem.reviewCount, lastDay: SaveSystem.reviewLastDay,
    askedThisSession: reviewSession.asked,
  })).toBeNull();
  await advance(REVIEW_DWELL_MS * 3);
  expect(mockLoadStoreReview).not.toHaveBeenCalled();
  expect(mockReviewRequest).not.toHaveBeenCalled();
  expect(reviewSession.asked).toBe(false);
  expect(screen.getByTestId('reward-reveal')).toBeTruthy();
});

test('flag off: no pill, no card, no reward keys read or written', () => {
  mockFlags.META_REWARD_PATH = false;
  // Keep the active ledger from beforeEach: an omitted GameScreen gate would now write through it.
  const screen = renderGame();
  clearBoard();
  expect(screen.queryByTestId('reward-pill')).toBeNull();
  expect(screen.queryByTestId('reward-reveal')).toBeNull();
  expect(rewardAccesses()).toEqual({ reads: [], writes: [] });
  expect(recordClearSpy).not.toHaveBeenCalled();
});

test('benchmark clears earn nothing', () => {
  const screen = renderGame({ benchmarkMode: true });
  clearBoard();
  expect(recordClearSpy).not.toHaveBeenCalled();
  expect(rewardLedger.getRewardState()!.points).toBe(0);
  expect(rewardAccesses()).toEqual({ reads: [], writes: [] });
  expect(screen.queryByTestId('reward-pill')).toBeNull();
  expect(screen.queryByTestId('reward-reveal')).toBeNull();
});

test('tutorial clears earn nothing', () => {
  store.setInt('arrows_ftue_stage', 1);
  const screen = renderGame({ tutorialId: 'T2' });
  clearBoard();
  expect(recordClearSpy).not.toHaveBeenCalled();
  expect(rewardLedger.getRewardState()!.points).toBe(0);
  expect(rewardAccesses()).toEqual({ reads: [], writes: [] });
  expect(screen.queryByTestId('reward-pill')).toBeNull();
  expect(screen.queryByTestId('reward-reveal')).toBeNull();
});

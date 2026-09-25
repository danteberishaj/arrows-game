/**
 * W4-07: which GameScreen clear paths record a shape in the collection,
 * against the real SaveSystem over an in-memory store with persistence healthy
 * (as after a successful initSaveSystem). The hazards: a tutorial, a benchmark
 * run or a loss setting a bit the player never earned, and a campaign clear
 * writing a bit while the menu fold is still behind. The bits themselves are
 * checked against the full generator in src/core/__tests__/collection.test.ts.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { catalogueIndexOf, generateDaily, LevelGenerator } from '../../core';
import { countSeen, hasSeen } from '../../core/collection';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockAds = {
  registerGameFinished: jest.fn(),
  showInterstitialIfDue: jest.fn(async () => undefined),
  showRewarded: jest.fn(async (_placement: string) => false),
};

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

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

const LEVEL = 7;
const DAY = 2450; // golden daily: Plus (src/core/__tests__/dailyBoard.test.ts)

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let previousHealthy: boolean;

type GameProps = Partial<React.ComponentProps<typeof GameScreen>>;
const renderGame = (props: GameProps = {}) =>
  render(<GameScreen palette={Daylight} onHome={jest.fn()} feedbackEnabled={false} {...props} />);

function clearBoard() {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
}

function collectionKeys(): string[] {
  return [...store.map.keys()].filter((key) => key.startsWith('arrows_shapes_')).sort();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockAds.registerGameFinished.mockClear();
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2020, 0, 1 + DAY, 12, 0, 0));
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
  store.setInt('arrows_current_level', LEVEL);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  jest.useRealTimers();
});

test('a campaign clear with the fold caught up records exactly that level\'s shape and moves through to the new level', () => {
  store.setInt('arrows_shapes_through_level', LEVEL);
  renderGame();

  clearBoard();

  const shape = catalogueIndexOf(LevelGenerator.generate(LEVEL).shapeName);
  expect(SaveSystem.currentLevel).toBe(LEVEL + 1);
  expect(SaveSystem.shapesThroughLevel).toBe(LEVEL + 1);
  expect(hasSeen(SaveSystem.shapesSeen, shape)).toBe(true);
  expect(countSeen(SaveSystem.shapesSeen)).toBe(1);
});

test('a campaign clear with the fold behind writes no collection key (the next menu mount folds it)', () => {
  store.setInt('arrows_shapes_through_level', 3);
  renderGame();

  clearBoard();

  expect(SaveSystem.currentLevel).toBe(LEVEL + 1);
  expect(SaveSystem.shapesThroughLevel).toBe(3);
  expect(collectionKeys()).toEqual(['arrows_shapes_through_level']);
  expect(SaveSystem.shapesSeen).toEqual({ lo: 0, hi: 0 });
});

test('a daily clear records the daily board\'s shape and never touches the campaign fold', () => {
  store.setInt('arrows_shapes_through_level', LEVEL);
  renderGame({ daily: { day: DAY } });

  clearBoard();

  const shape = catalogueIndexOf(generateDaily(DAY).shapeName);
  expect(shape).toBeGreaterThanOrEqual(0);
  expect(hasSeen(SaveSystem.shapesSeen, shape)).toBe(true);
  expect(countSeen(SaveSystem.shapesSeen)).toBe(1);
  expect(SaveSystem.shapesThroughLevel).toBe(LEVEL);
  expect(SaveSystem.currentLevel).toBe(LEVEL);
});

test('a loss records nothing', () => {
  store.setInt('arrows_shapes_through_level', LEVEL);
  const screen = renderGame();
  for (let i = 0; i < 3; i += 1) {
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
  }
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });

  expect(screen.getByText('Retry')).toBeTruthy();
  expect(collectionKeys()).toEqual(['arrows_shapes_through_level']);
  expect(SaveSystem.shapesThroughLevel).toBe(LEVEL);
});

test.each(['T1', 'T2'] as const)('a %s tutorial clear records nothing', (tutorialId) => {
  store.setInt('arrows_ftue_stage', tutorialId === 'T1' ? 0 : 1);
  store.setInt('arrows_shapes_through_level', LEVEL);
  renderGame({ tutorialId });

  clearBoard();

  expect(collectionKeys()).toEqual(['arrows_shapes_through_level']);
  expect(SaveSystem.shapesThroughLevel).toBe(LEVEL);
});

test('a benchmark (PERF) clear records nothing', () => {
  store.setInt('arrows_shapes_through_level', LEVEL);
  renderGame({ benchmarkMode: true });

  clearBoard();

  expect(collectionKeys()).toEqual(['arrows_shapes_through_level']);
  expect(SaveSystem.currentLevel).toBe(LEVEL);
});

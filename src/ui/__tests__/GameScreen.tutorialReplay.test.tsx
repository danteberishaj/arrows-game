/**
 * TF-01 C (META_SETTINGS_HOW_TO_PLAY): "How to play" replays T1 then T2 with `tutorialReplay`. The hard requirement:
 * a replay never writes arrows_ftue_stage, campaign progress, streaks, totals, the collection, rewards, ad counters
 * or review keys, and after the replayed T2 it returns to the MENU (onHome), never to a campaign level. The first-run
 * tutorial (no `tutorialReplay`) keeps today's writes and hand-off, as the control.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { WON_PANEL_DELAY_MS } from '../gameSessionLifecycle';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockRegisterGameFinished = jest.fn();
const mockFtue = { assist: false };

// EXPO_PUBLIC_FTUE_ASSIST (default OFF), switchable per test: read by GameScreen's blocked-tap path.
jest.mock('../ftueConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../ftueConfig') },
    { FTUE_ASSIST_ENABLED: { get: () => mockFtue.assist, enumerable: true } },
  ));

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../ads', () => ({
  Ads: {
    rewardedReady: false,
    isRewardedReady: () => false,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: (...args: unknown[]) => mockRegisterGameFinished(...args),
    showInterstitialIfDue: async () => undefined,
    showRewarded: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');

/** Records every write that reaches the store. */
class RecordingStore implements IntStore {
  readonly map = new Map<string, number>();
  readonly writes: [string, number | null][] = [];
  getInt(key: string, defaultValue: number): number {
    return this.map.get(key) ?? defaultValue;
  }
  setInt(key: string, value: number): void {
    this.writes.push([key, value]);
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.writes.push([key, null]);
    this.map.delete(key);
  }
}

const LEVEL = 23;
let store: RecordingStore;
let previousStore: IntStore;
let previousHealthy: boolean;

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockRegisterGameFinished.mockReset();
  mockFtue.assist = false;
  store = new RecordingStore();
  previousStore = SaveSystem.useStore(store);
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  jest.useRealTimers();
});

/** Removes the board's legal arrows in order, reports the clear, then waits out the flat won delay. */
function clearBoard() {
  const board = mockBoardViewProps!.board;
  act(() => {
    while (board.count() > 0) {
      const arrow = board.findHint();
      if (!arrow || !board.tryRemove(arrow)) throw new Error('tutorial board has no legal removal');
      mockBoardViewProps!.onRemoved(board.count() === 0, 0);
    }
  });
  act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS); });
}

/** A player who finished the tutorial long ago: stage 3 (done), on campaign level 23, with totals and a streak. */
function seedFinishedPlayer() {
  store.map.set('arrows_ftue_stage', 3);
  store.map.set('arrows_current_level', LEVEL);
  store.map.set('arrows_total_solved', 40);
  store.map.set('arrows_perfect_streak', 4);
  store.map.set('arrows_day_streak', 6);
  store.map.set('arrows_finished_games', 1);
  store.map.set('arrows_shapes_through_level', LEVEL);
}

test('replayed T2 clear with ftueStage = 3: stage stays 3, level unchanged, next screen is the menu', () => {
  seedFinishedPlayer();
  const onHome = jest.fn();
  render(<GameScreen palette={Daylight} onHome={onHome} tutorialId="T2" tutorialReplay feedbackEnabled={false} />);
  clearBoard();
  expect(SaveSystem.ftueStage).toBe(3);
  expect(SaveSystem.currentLevel).toBe(LEVEL);
  expect(onHome).toHaveBeenCalledTimes(1);
  // No campaign board was dealt in its place (a T2 hand-off would load level 23 here).
  expect(mockBoardViewProps!.board.count()).toBe(0);
  expect(store.writes).toEqual([]);
  expect(mockRegisterGameFinished).not.toHaveBeenCalled();
});

test('the full replay, T1 then T2, writes no key at all and ends on the menu', () => {
  seedFinishedPlayer();
  const onHome = jest.fn();
  render(<GameScreen palette={Daylight} onHome={onHome} tutorialId="T1" tutorialReplay feedbackEnabled={false} />);
  const t1Arrows = mockBoardViewProps!.board.count();
  clearBoard();
  // T1's clear hands off to T2 (a different authored board), not to the menu.
  expect(onHome).not.toHaveBeenCalled();
  expect(mockBoardViewProps!.board.count()).toBeGreaterThan(0);
  expect(mockBoardViewProps!.board.count()).not.toBe(t1Arrows);
  clearBoard();
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(store.writes).toEqual([]);
  expect(SaveSystem.ftueStage).toBe(3);
  expect(SaveSystem.currentLevel).toBe(LEVEL);
});

test('a replay mid-assist (stage 2, assist ON): T1 hearts behave as a first run (no assist refund); stage stays 2', () => {
  mockFtue.assist = true;
  store.map.set('arrows_ftue_stage', 2);
  const onHome = jest.fn();
  render(<GameScreen palette={Daylight} onHome={onHome} tutorialId="T1" tutorialReplay feedbackEnabled={false} />);
  // A first-run T1 is played at stage 0, where assist never applies: the first charged blocked tap costs a heart.
  let charged = false;
  act(() => { charged = mockBoardViewProps!.onBlocked(true); });
  expect(charged).toBe(true);
  clearBoard();
  clearBoard();
  expect(SaveSystem.ftueStage).toBe(2);
  expect(store.writes).toEqual([]);
  expect(onHome).toHaveBeenCalledTimes(1);
});

test('CONTROL, first-run tutorial (no replay): T2 clear still writes ASSIST_STAGE and deals the campaign level', () => {
  store.map.set('arrows_ftue_stage', 1);
  const onHome = jest.fn();
  render(<GameScreen palette={Daylight} onHome={onHome} tutorialId="T2" feedbackEnabled={false} />);
  clearBoard();
  expect(store.writes).toEqual([['arrows_ftue_stage', 2]]);
  expect(onHome).not.toHaveBeenCalled();
  expect(mockBoardViewProps!.board.count()).toBeGreaterThan(0);
});

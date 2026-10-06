/**
 * W2-06 (META_POST_CLEAR_TIMELINE) wiring in GameScreen: BoardView reports each removal as
 * `onRemoved(cleared, exitVisibleMs)`, where exitVisibleMs is when that exit's last pixel is gone
 * (exitToScreenEdge.ts `visibleMs`; 0 for the diagnostic 'none' kind).
 * - flag OFF: the won panel (and a cleared tutorial's hand-off) waits the flat WON_PANEL_DELAY_MS (450 ms)
 *   whatever the final exit did, exactly as before;
 * - flag ON: it waits exitVisibleMs + EMPTY_BOARD_HOLD_MS (250 ms), so the empty board is held for the same time
 *   after a short and after a long final exit; with W5-17's outline drawn, exitVisibleMs + CLEAR_REVEAL_HOLD_MS
 *   (150 ms, owner ruling 2026-10-06) + CLEAR_REVEAL_MS (400 ms).
 * The frames (the hold measured from the last trail pixel to the first overlay pixel) close only on the emulator
 * captures in artifacts/W2-06/.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = { META_POST_CLEAR_TIMELINE: false, ART_CLEAR_REVEAL_ENABLED: false };

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_POST_CLEAR_TIMELINE: { get: () => mockFlags.META_POST_CLEAR_TIMELINE, enumerable: true } },
  ));

// W5-17: the clear reveal's flag, switchable per test (read at render and in the clear handler).
jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    { ART_CLEAR_REVEAL_ENABLED: { get: () => mockFlags.ART_CLEAR_REVEAL_ENABLED, enumerable: true } },
  ));

jest.mock('../ads', () => ({
  Ads: {
    rewardedReady: false,
    isRewardedReady: () => false,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: async () => undefined,
    showRewarded: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lifecycle = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');

function renderGame(tutorialId?: 'T1') {
  return render(
    <GameScreen
      palette={Daylight}
      onHome={jest.fn()}
      initialLevelIndex={0}
      tutorialId={tutorialId}
      feedbackEnabled={false}
      benchmarkMode
    />,
  );
}

/** Removes every arrow; every exit is visible for 150 ms and the last one clears. */
function clearBoard() {
  const board = mockBoardViewProps!.board;
  act(() => {
    const arrows = [...board.arrows()];
    arrows.forEach((arrow, i) => {
      board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(i === arrows.length - 1, 150);
    });
  });
}

function clearWithFinalExit(exitVisibleMs: number) {
  const board = mockBoardViewProps!.board;
  act(() => {
    const arrows = [...board.arrows()];
    for (const arrow of arrows.slice(0, -1)) {
      board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(false, 150);
    }
    board.tryRemove(arrows[arrows.length - 1]);
    mockBoardViewProps!.onRemoved(true, exitVisibleMs);
  });
}

function panelAppearsAt(screen: ReturnType<typeof renderGame>, ms: number) {
  act(() => jest.advanceTimersByTime(ms - 1));
  expect(screen.queryByText('Next level')).toBeNull();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByText('Next level')).toBeTruthy();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockFlags.META_POST_CLEAR_TIMELINE = false;
  mockFlags.ART_CLEAR_REVEAL_ENABLED = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('flag OFF: the flat 450 ms, whatever the final exit did', () => {
  test.each([0, 88, 185, 320])('final exit visible for %i ms -> the panel at 450 ms', (exitMs) => {
    const screen = renderGame();
    clearWithFinalExit(exitMs);
    panelAppearsAt(screen, lifecycle.WON_PANEL_DELAY_MS);
    expect(lifecycle.WON_PANEL_DELAY_MS).toBe(450);
  });
});

describe('flag ON: the final exit, then the same empty-board hold', () => {
  beforeEach(() => {
    mockFlags.META_POST_CLEAR_TIMELINE = true;
  });

  test.each([0, 88, 185, 278])('final exit visible for %i ms -> the panel at exit + hold (no outline drawn: no slot)', (exitMs) => {
    const screen = renderGame();
    clearWithFinalExit(exitMs);
    panelAppearsAt(screen, exitMs + lifecycle.EMPTY_BOARD_HOLD_MS);
    expect(mockBoardViewProps!.clearRevealMask).toBeUndefined();
  });

  test('removals that do not clear schedule nothing', () => {
    const screen = renderGame();
    const board = mockBoardViewProps!.board;
    act(() => {
      board.tryRemove(board.arrows()[0]);
      mockBoardViewProps!.onRemoved(false, 185);
    });
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByText('Next level')).toBeNull();
  });

  test('a cleared tutorial board hands off after the same exit + hold (no panel)', () => {
    renderGame('T1');
    const t1 = mockBoardViewProps!.board;
    clearWithFinalExit(120);
    act(() => jest.advanceTimersByTime(120 + lifecycle.EMPTY_BOARD_HOLD_MS - 1));
    expect(mockBoardViewProps!.board).toBe(t1);
    act(() => jest.advanceTimersByTime(1));
    expect(mockBoardViewProps!.board).not.toBe(t1);
  });

  test('a second clearing callback in the same frame is ignored (one won transition)', () => {
    const screen = renderGame();
    clearBoard();
    act(() => mockBoardViewProps!.onRemoved(true, 900));
    panelAppearsAt(screen, 150 + lifecycle.EMPTY_BOARD_HOLD_MS);
  });
});

describe('W5-17 ART_CLEAR_REVEAL_ENABLED (owner set B, pause 150 ms by the 2026-10-06 ruling): exit + 150 ms hold + 400 ms outline slot', () => {
  beforeEach(() => {
    mockFlags.ART_CLEAR_REVEAL_ENABLED = true;
  });

  test.each([false, true])('META_POST_CLEAR_TIMELINE %p: the panel at exit + 150 + 400', (timeline) => {
    mockFlags.META_POST_CLEAR_TIMELINE = timeline;
    const screen = renderGame();
    expect(mockBoardViewProps!.clearRevealMask!.some((row) => row.some(Boolean))).toBe(true);
    clearWithFinalExit(90);
    panelAppearsAt(screen, 90 + 150 + 400);
  });

  test('the panel lands 794 ms after the last tap for the default board-edge exit (244 ms), 640..737 ms for 90..187 ms', () => {
    for (const exitMs of [244, 90, 187]) {
      const screen = renderGame();
      clearWithFinalExit(exitMs);
      panelAppearsAt(screen, exitMs + lifecycle.CLEAR_REVEAL_HOLD_MS + lifecycle.CLEAR_REVEAL_MS);
      screen.unmount();
    }
    expect(244 + lifecycle.CLEAR_REVEAL_HOLD_MS + lifecycle.CLEAR_REVEAL_MS).toBe(794);
    expect(90 + lifecycle.CLEAR_REVEAL_HOLD_MS + lifecycle.CLEAR_REVEAL_MS).toBe(640);
    expect(187 + lifecycle.CLEAR_REVEAL_HOLD_MS + lifecycle.CLEAR_REVEAL_MS).toBe(737);
  });

  test("BoardView gets the level's real mask (it traces the outline from it)", () => {
    renderGame();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LevelGenerator } = require('../../core') as typeof import('../../core');
    expect(mockBoardViewProps!.clearRevealMask).toEqual(LevelGenerator.generate(0, 1).mask);
  });

  test('a tutorial board (empty mask) draws no outline: its hand-off waits W2-06\'s 250 ms hold, not 150 + 400', () => {
    renderGame('T1');
    const t1 = mockBoardViewProps!.board;
    expect(mockBoardViewProps!.clearRevealMask).toEqual([]);
    clearWithFinalExit(120);
    act(() => jest.advanceTimersByTime(120 + lifecycle.EMPTY_BOARD_HOLD_MS - 1));
    expect(mockBoardViewProps!.board).toBe(t1);
    act(() => jest.advanceTimersByTime(1));
    expect(mockBoardViewProps!.board).not.toBe(t1);
  });
});

/**
 * W2-04 (META_LEVEL_TRANSITION) wiring in GameScreen. The sequencer itself is
 * covered by scrimTransition.test.ts; the Reanimated driver and the visuals
 * close only on P-02 captures (artifacts/W2-04/). Here:
 * - flag OFF: no scrim is mounted and Retry / Next swap the board at once;
 * - flag ON: the scrim is the root's last child, the swap waits for the cover
 *   callback, and a second press while the transition runs does nothing.
 * - flag ON + reduced motion (owner 2026-09-25: "skip the fade on reduced
 *   motion"): no scrim, Retry / Next swap at once as with the flag OFF.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';
import type { ScrimDriver } from '../scrimTransition';

let mockBoardViewProps: BoardViewProps | null = null;
let mockReducedMotion = false;
const mockFlags = { META_LEVEL_TRANSITION: false };
const mockDriver: ScrimDriver & { calls: string[]; coverDone: (() => void) | null; uncoverDone: (() => void) | null } = {
  calls: [],
  coverDone: null,
  uncoverDone: null,
  cover(ms, done) {
    this.calls.push(`cover ${ms}`);
    this.coverDone = done;
  },
  uncover(ms, done) {
    this.calls.push(`uncover ${ms}`);
    this.uncoverDone = done;
  },
  snap(v) {
    this.calls.push(`snap ${v}`);
  },
};
const mockShowInterstitial = jest.fn(async () => undefined);

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion,
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
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: () => mockShowInterstitial(),
    showRewarded: jest.fn(async () => false),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');

const renderGame = () =>
  render(
    <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} benchmarkMode />,
  );

function loseLevel(screen: ReturnType<typeof renderGame>) {
  const hearts = 3;
  for (let i = 0; i < hearts; i += 1) {
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
  }
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });
  return screen.getByText('Retry');
}

function winLevel(screen: ReturnType<typeof renderGame>) {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
  return screen.getByText('Next level');
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockDriver.calls = [];
  mockDriver.coverDone = null;
  mockDriver.uncoverDone = null;
  mockShowInterstitial.mockClear();
  mockReducedMotion = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('flag OFF (default)', () => {
  beforeEach(() => {
    mockFlags.META_LEVEL_TRANSITION = false;
  });

  test('no scrim is mounted', () => {
    const screen = renderGame();
    expect(screen.queryByTestId('level-scrim')).toBeNull();
  });

  test('Retry swaps the board in the same press, with no driver call', () => {
    const screen = renderGame();
    const before = mockBoardViewProps!.board;
    fireEvent.press(loseLevel(screen));
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(mockDriver.calls).toEqual([]);
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockFlags.META_LEVEL_TRANSITION = true;
  });

  test('the scrim is the last child of the screen root (it draws over header, board, panel)', () => {
    const screen = renderGame();
    loseLevel(screen); // the lose panel is mounted too
    const tree = screen.toJSON() as { children: { props: { testID?: string } }[] };
    expect(tree.children.at(-1)!.props.testID).toBe('level-scrim');
  });

  test('Retry: the board changes only when the cover completes, then the uncover follows the commit', () => {
    const screen = renderGame();
    const before = mockBoardViewProps!.board;
    const retry = loseLevel(screen);
    fireEvent.press(retry);
    expect(mockDriver.calls).toEqual(['cover 180']);
    expect(mockBoardViewProps!.board).toBe(before); // still the old level under the rising scrim

    fireEvent.press(retry); // a second press while covering is ignored
    expect(mockDriver.calls).toEqual(['cover 180']);

    act(() => {
      mockDriver.coverDone!();
    });
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(screen.queryByText('Retry')).toBeNull();
    expect(mockDriver.calls).toEqual(['cover 180']); // not before the frame after the commit
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(mockDriver.calls).toEqual(['cover 180', 'uncover 180']);
    act(() => {
      mockDriver.uncoverDone!();
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('Next: the swap waits for the cover; a second press does not start another', async () => {
    const screen = renderGame();
    const next = winLevel(screen);
    const before = mockBoardViewProps!.board;
    await act(async () => {
      fireEvent.press(next);
    });
    await act(async () => {
      fireEvent.press(next);
    });
    expect(mockDriver.calls).toEqual(['cover 180']);
    expect(mockBoardViewProps!.board).toBe(before);
    act(() => {
      mockDriver.coverDone!();
    });
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(screen.getByText('LEVEL 2')).toBeTruthy();
  });

  test('Next (not benchmark): the interstitial await completes before the cover starts', async () => {
    let closeAd: () => void = () => undefined;
    mockShowInterstitial.mockImplementationOnce(() => new Promise<undefined>((r) => {
      closeAd = () => r(undefined);
    }));
    const screen = render(
      <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} />,
    );
    const next = winLevel(screen as ReturnType<typeof renderGame>);
    await act(async () => {
      fireEvent.press(next);
    });
    expect(mockShowInterstitial).toHaveBeenCalledTimes(1);
    expect(mockDriver.calls).toEqual([]); // the ad is still up: no cover yet
    await act(async () => {
      fireEvent.press(next); // pressed again while the ad runs: ignored, no second ad request
    });
    expect(mockShowInterstitial).toHaveBeenCalledTimes(1);
    await act(async () => {
      closeAd();
    });
    expect(mockDriver.calls).toEqual(['cover 180']);
  });
});

describe('flag ON, reduced motion: the fade is skipped (owner 2026-09-25)', () => {
  beforeEach(() => {
    mockFlags.META_LEVEL_TRANSITION = true;
    mockReducedMotion = true;
  });

  test('no scrim is mounted', () => {
    const screen = renderGame();
    expect(screen.queryByTestId('level-scrim')).toBeNull();
  });

  test('Retry swaps the board in the same press, with no driver call', () => {
    const screen = renderGame();
    const before = mockBoardViewProps!.board;
    fireEvent.press(loseLevel(screen));
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(mockDriver.calls).toEqual([]);
  });

  test('Next swaps the board once the interstitial check resolves, with no driver call', async () => {
    const screen = renderGame();
    const next = winLevel(screen);
    const before = mockBoardViewProps!.board;
    await act(async () => {
      fireEvent.press(next);
    });
    expect(mockBoardViewProps!.board).not.toBe(before);
    expect(mockDriver.calls).toEqual([]);
  });
});

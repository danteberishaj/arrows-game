/**
 * W2-05 (META_PANEL_MOTION) wiring in GameScreen. The latch itself is covered
 * by overlayPresence.test.ts; the Reanimated driver and the visuals close only
 * on emulator captures (artifacts/W2-05/). Here:
 * - flag OFF: no presence frame; the panel mounts and unmounts in one render;
 * - flag ON: win / lose entrances ask for 180 / 260 ms (0 under reduce motion);
 *   an earned continue keeps the panel mounted, touch-transparent and the board
 *   locked until the exit settles; Retry unmounts it at once.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';
import type { PresenceDriver, PresenceState } from '../overlayPresence';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = { META_PANEL_MOTION: false };
let mockReducedMotion = false;
const mockDriver: PresenceDriver & { calls: string[]; done: (() => void) | null } = {
  calls: [],
  done: null,
  animateTo(target, ms, done) {
    this.calls.push(`animate ${target} ${ms}`);
    this.done = done;
  },
  snap(v) {
    this.calls.push(`snap ${v}`);
  },
};
const mockShowRewarded = jest.fn(async () => true);

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
    { META_PANEL_MOTION: { get: () => mockFlags.META_PANEL_MOTION, enumerable: true } },
  ));

jest.mock('../PanelPresence', () => {
  const { View: MockView } = jest.requireActual('react-native');
  const { OverlayPresence } = jest.requireActual('../overlayPresence');
  return {
    createPanelPresence: () => new OverlayPresence({
      backstopMarginMs: 70,
      setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimer: (h: ReturnType<typeof setTimeout>) => clearTimeout(h),
      subscribeAppState: () => () => undefined,
      driver: mockDriver,
    }),
    PanelOverlayFrame: ({ state, children }: { state: PresenceState; children: React.ReactNode }) => (
      <MockView
        testID="panel-frame"
        accessibilityHint={state}
        style={{ pointerEvents: state === 'exiting' ? 'none' : 'auto' }}
      >
        {children}
      </MockView>
    ),
  };
});

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return true;
    },
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: async () => undefined,
    showRewarded: () => mockShowRewarded(),
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

async function pressContinue(screen: ReturnType<typeof renderGame>) {
  await act(async () => {
    fireEvent.press(screen.getByText('Continue +♥ (ad)'));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockDriver.calls = [];
  mockDriver.done = null;
  mockReducedMotion = false;
  mockShowRewarded.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('flag OFF (default)', () => {
  beforeEach(() => {
    mockFlags.META_PANEL_MOTION = false;
  });

  test('the panel is the plain overlay and an earned continue removes it in the same press', async () => {
    const screen = renderGame();
    loseLevel(screen);
    expect(screen.queryByTestId('panel-frame')).toBeNull();
    await pressContinue(screen);
    expect(screen.queryByText('Out of hearts')).toBeNull();
    expect(mockBoardViewProps!.locked).toBe(false);
    expect(mockDriver.calls).toEqual([]);
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockFlags.META_PANEL_MOTION = true;
  });

  test('the win panel enters over 180 ms inside the presence frame', () => {
    const screen = renderGame();
    winLevel(screen);
    expect(screen.getByTestId('panel-frame').props.accessibilityHint).toBe('entering');
    expect(mockDriver.calls).toEqual(['snap 0', 'animate 1 180']);
    act(() => mockDriver.done!());
    expect(screen.getByTestId('panel-frame').props.accessibilityHint).toBe('shown');
  });

  test('the lose panel enters over the provisional 260 ms', () => {
    const screen = renderGame();
    loseLevel(screen);
    expect(mockDriver.calls).toEqual(['snap 0', 'animate 1 260']);
  });

  test('reduce motion: the panel is at rest on its first render (no animation)', () => {
    mockReducedMotion = true;
    const screen = renderGame();
    winLevel(screen);
    expect(screen.getByTestId('panel-frame').props.accessibilityHint).toBe('shown');
    expect(mockDriver.calls).toEqual(['snap 1']);
  });

  test('an earned continue fades the panel out: touch-transparent, board locked, until hidden', async () => {
    const screen = renderGame();
    loseLevel(screen);
    act(() => mockDriver.done!());
    await pressContinue(screen);
    const frame = screen.getByTestId('panel-frame');
    expect(frame.props.accessibilityHint).toBe('exiting');
    expect(frame.props.style.pointerEvents).toBe('none');
    // Still the lose panel, with the ad state the player pressed on.
    expect(screen.getByText('Out of hearts')).toBeTruthy();
    expect(screen.getByText('The shape got the better of you.')).toBeTruthy();
    expect(mockBoardViewProps!.locked).toBe(true);
    expect(mockDriver.calls.at(-1)).toBe('animate 0 180');
    act(() => mockDriver.done!());
    expect(screen.queryByTestId('panel-frame')).toBeNull();
    expect(mockBoardViewProps!.locked).toBe(false);
  });

  test('the exit settles from the backstop when the callback is lost', async () => {
    const screen = renderGame();
    loseLevel(screen);
    act(() => mockDriver.done!());
    await pressContinue(screen);
    act(() => {
      jest.advanceTimersByTime(180 + 70);
    });
    expect(screen.queryByTestId('panel-frame')).toBeNull();
    expect(mockBoardViewProps!.locked).toBe(false);
  });

  test('Retry unmounts the panel at once (no exit animation)', () => {
    const screen = renderGame();
    const retry = loseLevel(screen);
    act(() => mockDriver.done!());
    fireEvent.press(retry);
    expect(screen.queryByTestId('panel-frame')).toBeNull();
    expect(mockDriver.calls.at(-1)).toBe('snap 0');
    expect(mockBoardViewProps!.locked).toBe(false);
  });

  test('lose -> continue -> lose again mid-exit: one panel, entering again', async () => {
    const screen = renderGame();
    loseLevel(screen);
    act(() => mockDriver.done!());
    await pressContinue(screen);
    // Heart back to 1; the board is locked during the exit, so a blocked tap
    // here can only come through BoardView's own path: drive it directly.
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
    act(() => {
      jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
    });
    expect(screen.getAllByTestId('panel-frame')).toHaveLength(1);
    expect(screen.getAllByText('Out of hearts')).toHaveLength(1);
  });
});

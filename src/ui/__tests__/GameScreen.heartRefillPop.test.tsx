/**
 * W2-07 (META_HEART_REFILL_POP) wiring in GameScreen. The rule itself is
 * covered by heartPip.test.ts; the spring, its frames and reduce motion close
 * only on emulator captures (artifacts/W2-07/). Here, by recording every
 * pipPopKind decision the header pips make:
 * - flag ON: an earned continue refills one pip with a 'refill' pop, and with
 *   META_PANEL_MOTION only after the lose panel's exit has settled (the pip
 *   stays spent while the panel fades);
 * - Retry after a loss, Next after a lossy win and an unearned continue never
 *   pop a refill; the loss pop is unchanged;
 * - flag OFF: no 'refill' decision ever, and the pip fills at the continue as before.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import type { PipPopKind } from '../heartPip';
import { Daylight } from '../theme';
import type { PresenceDriver, PresenceState } from '../overlayPresence';

let mockBoardViewProps: BoardViewProps | null = null;
const mockFlags = { META_PANEL_MOTION: false, META_HEART_REFILL_POP: false };
const mockDriver: PresenceDriver & { done: (() => void) | null } = {
  done: null,
  animateTo(_target, _ms, done) {
    this.done = done;
  },
  snap() {},
};
const mockShowRewarded = jest.fn(async () => true);
const mockPops: Array<{ args: [boolean, boolean, number, number]; kind: PipPopKind }> = [];

jest.mock('../heartPip', () => {
  const actual = jest.requireActual('../heartPip');
  return {
    ...actual,
    pipPopKind: (...args: [boolean, boolean, number, number]) => {
      const kind = actual.pipPopKind(...args);
      mockPops.push({ args, kind });
      return kind;
    },
  };
});

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
      META_PANEL_MOTION: { get: () => mockFlags.META_PANEL_MOTION, enumerable: true },
      META_HEART_REFILL_POP: { get: () => mockFlags.META_HEART_REFILL_POP, enumerable: true },
    },
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
      <MockView testID="panel-frame" accessibilityHint={state}>
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PANEL_EXIT_MS } = require('../overlayPresence') as typeof import('../overlayPresence');

const renderGame = () =>
  render(
    <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} benchmarkMode />,
  );

const kinds = () => mockPops.map((p) => p.kind);
const count = (kind: PipPopKind) => kinds().filter((k) => k === kind).length;

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

async function pressContinue(screen: ReturnType<typeof renderGame>) {
  await act(async () => {
    fireEvent.press(screen.getByText('Continue +♥ (ad)'));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockDriver.done = null;
  mockPops.length = 0;
  mockShowRewarded.mockClear();
  mockShowRewarded.mockImplementation(async () => true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe.each([false, true])('META_PANEL_MOTION %s', (panelMotion) => {
  beforeEach(() => {
    mockFlags.META_PANEL_MOTION = panelMotion;
  });

  test('flag ON: an earned continue pops exactly one refill; the three losses still pop as losses', async () => {
    mockFlags.META_HEART_REFILL_POP = true;
    const screen = renderGame();
    loseLevel(screen);
    expect(count('loss')).toBe(3);
    await pressContinue(screen);
    if (panelMotion) {
      // The panel is fading: the refilled pip is still spent and nothing has popped.
      expect(screen.getByTestId('panel-frame').props.accessibilityHint).toBe('exiting');
      expect(count('refill')).toBe(0);
      act(() => {
        jest.advanceTimersByTime(PANEL_EXIT_MS + 70); // the exit's backstop settle
      });
      expect(screen.queryByTestId('panel-frame')).toBeNull();
    }
    expect(count('refill')).toBe(1);
    const refill = mockPops.find((p) => p.kind === 'refill')!;
    expect(refill.args).toEqual([false, true, 0, 1]);
    expect(count('loss')).toBe(3);
  });

  test('flag ON: Retry after a loss and Next after a lossy win never pop a refill', async () => {
    mockFlags.META_HEART_REFILL_POP = true;
    const screen = renderGame();
    const retry = loseLevel(screen);
    act(() => {
      fireEvent.press(retry);
    });
    // Retry refilled all three pips (three filled edges) without a token change.
    expect(mockPops.filter((p) => !p.args[0] && p.args[1]).length).toBe(3);
    expect(count('refill')).toBe(0);

    act(() => {
      mockBoardViewProps!.onBlocked(true); // one heart lost, then a clear
    });
    const board = mockBoardViewProps!.board;
    act(() => {
      for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(true, 0);
    });
    act(() => {
      jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Next level'));
    });
    expect(count('refill')).toBe(0);
    expect(count('loss')).toBe(4);
  });

  test('flag ON: an unearned continue pops nothing', async () => {
    mockFlags.META_HEART_REFILL_POP = true;
    mockShowRewarded.mockImplementation(async () => false);
    const screen = renderGame();
    loseLevel(screen);
    await pressContinue(screen);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(count('refill')).toBe(0);
  });

  test('flag OFF: the continue fills the pip at once and never decides a refill pop', async () => {
    mockFlags.META_HEART_REFILL_POP = false;
    const screen = renderGame();
    loseLevel(screen);
    await pressContinue(screen);
    // The filled edge reached the pip in the continue's own render (before any exit settle).
    expect(mockPops.some((p) => !p.args[0] && p.args[1])).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(count('refill')).toBe(0);
    expect(mockPops.every((p) => p.args[2] === 0 && p.args[3] === 0)).toBe(true);
  });
});

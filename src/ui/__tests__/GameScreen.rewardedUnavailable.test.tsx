import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Path as SvgPath } from 'react-native-svg';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
import { Daylight } from '../theme';

type RewardedSubscriber = (ready: boolean) => void;
type Placement = 'continue' | 'hint';

let mockBoardViewProps: BoardViewProps;
// ADMOB-B (M3): readiness is per placement. Without a placement,
// mockSetRewardedReady sets both, which is the old single readiness.
const mockReady: Record<Placement, boolean> = { continue: true, hint: true };
const mockRewardedSubscribers: Record<Placement, Set<RewardedSubscriber>> = {
  continue: new Set(),
  hint: new Set(),
};
const mockShowRewarded = jest.fn<Promise<boolean>, [Placement]>();

function mockSetRewardedReady(ready: boolean, only?: Placement): void {
  for (const placement of only ? [only] : (['continue', 'hint'] as const)) {
    if (mockReady[placement] === ready) continue;
    mockReady[placement] = ready;
    for (const subscriber of [...mockRewardedSubscribers[placement]]) subscriber(ready);
  }
}

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return mockReady.continue;
    },
    isRewardedReady(placement: Placement) {
      return mockReady[placement];
    },
    subscribeRewardedReady(subscriber: RewardedSubscriber, placement: Placement = 'continue') {
      mockRewardedSubscribers[placement].add(subscriber);
      return () => mockRewardedSubscribers[placement].delete(subscriber);
    },
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(),
    showRewarded: (placement: 'continue' | 'hint') => mockShowRewarded(placement),
  },
}));

describe('GameScreen unavailable rewarded ads', () => {
  afterEach(() => jest.useRealTimers());

  beforeEach(() => {
    mockReady.continue = true;
    mockReady.hint = true;
    mockRewardedSubscribers.continue.clear();
    mockRewardedSubscribers.hint.clear();
    mockShowRewarded.mockReset();
    mockShowRewarded.mockImplementation(async () => {
      mockSetRewardedReady(false);
      return false;
    });
  });

  test('grants neither a continue heart nor a hint when no reward is earned', async () => {
    jest.useFakeTimers();
    const screen = render(
      <GameScreen
        palette={Daylight}
        onHome={jest.fn()}
        initialLevelIndex={0}
        benchmarkMode
        feedbackEnabled={false}
      />,
    );
    const filledHeartCount = () => screen
      .UNSAFE_getAllByType(SvgPath)
      .filter((path) => path.props.fill !== 'none')
      .length;
    const startingHearts = filledHeartCount();
    expect(startingHearts).toBeGreaterThan(0);

    act(() => {
      for (let index = 0; index < startingHearts; index += 1) {
        mockBoardViewProps.onBlocked(true);
      }
      jest.runOnlyPendingTimers();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Continue +♥ (ad)'));
      await Promise.resolve();
    });

    expect(mockShowRewarded).toHaveBeenNthCalledWith(1, 'continue');
    expect(filledHeartCount()).toBe(0);
    expect(screen.getByText('Out of hearts')).toBeTruthy();
    expect(screen.getByText('No ad available right now — Retry is free')).toBeTruthy();

    fireEvent.press(screen.getByText('Retry'));
    act(() => mockSetRewardedReady(true));
    expect(mockBoardViewProps.hint).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('💡'));
      await Promise.resolve();
    });

    expect(mockShowRewarded).toHaveBeenNthCalledWith(2, 'hint');
    expect(mockShowRewarded).toHaveBeenCalledTimes(2);
    expect(mockBoardViewProps.hint).toBeNull();
  });

  function renderGame() {
    return render(
      <GameScreen
        palette={Daylight}
        onHome={jest.fn()}
        initialLevelIndex={0}
        benchmarkMode
        feedbackEnabled={false}
      />,
    );
  }

  test('M3: the hint button follows the hint placement, not the continue one', async () => {
    mockSetRewardedReady(false, 'continue');
    const screen = renderGame();

    await act(async () => {
      fireEvent.press(screen.getByText('💡'));
      await Promise.resolve();
    });
    expect(mockShowRewarded).toHaveBeenCalledTimes(1);
    expect(mockShowRewarded).toHaveBeenLastCalledWith('hint');
  });

  test('M3: an unready hint placement disables the hint even when continue is ready', async () => {
    mockSetRewardedReady(false, 'hint');
    const screen = renderGame();

    await act(async () => {
      fireEvent.press(screen.getByText('💡'));
      await Promise.resolve();
    });
    expect(mockShowRewarded).not.toHaveBeenCalled();

    act(() => mockSetRewardedReady(true, 'hint')); // the hint unit loads later
    await act(async () => {
      fireEvent.press(screen.getByText('💡'));
      await Promise.resolve();
    });
    expect(mockShowRewarded).toHaveBeenCalledWith('hint');
  });

  test('M3: an unready hint does not change the lose panel while continue is ready', () => {
    jest.useFakeTimers();
    mockSetRewardedReady(false, 'hint');
    const screen = renderGame();
    const hearts = screen.UNSAFE_getAllByType(SvgPath).filter((p) => p.props.fill !== 'none').length;
    act(() => {
      for (let index = 0; index < hearts; index += 1) mockBoardViewProps.onBlocked(true);
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByText('The shape got the better of you.')).toBeTruthy();
    expect(screen.queryByText('No ad available right now — Retry is free')).toBeNull();
  });
});

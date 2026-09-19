import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Path as SvgPath } from 'react-native-svg';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
import { Daylight } from '../theme';

type RewardedSubscriber = (ready: boolean) => void;

let mockBoardViewProps: BoardViewProps;
let mockRewardedReady = true;
const mockRewardedSubscribers = new Set<RewardedSubscriber>();
const mockShowRewarded = jest.fn<Promise<boolean>, ['continue' | 'hint']>();

function mockSetRewardedReady(ready: boolean): void {
  if (mockRewardedReady === ready) return;
  mockRewardedReady = ready;
  for (const subscriber of [...mockRewardedSubscribers]) subscriber(ready);
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
      return mockRewardedReady;
    },
    subscribeRewardedReady(subscriber: RewardedSubscriber) {
      mockRewardedSubscribers.add(subscriber);
      return () => mockRewardedSubscribers.delete(subscriber);
    },
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(),
    showRewarded: (placement: 'continue' | 'hint') => mockShowRewarded(placement),
  },
}));

describe('GameScreen unavailable rewarded ads', () => {
  afterEach(() => jest.useRealTimers());

  beforeEach(() => {
    mockRewardedReady = true;
    mockRewardedSubscribers.clear();
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
});

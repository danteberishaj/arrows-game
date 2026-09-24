import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
import { Daylight } from '../theme';

// POLISH-T5 (R6): BoardView marks an arrow only when GameScreen reports that
// the blocked tap actually charged a heart (blockedTapCost's final answer, not
// the raw ledger charge). This pins that report.
let mockBoardViewProps: BoardViewProps;

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
    registerGameFinished: jest.fn(),
    showInterstitialIfDue: jest.fn(),
    showRewarded: jest.fn(async () => false),
  },
}));

const blocked = (ledgerCharge: boolean): unknown => {
  let charged: unknown;
  act(() => {
    charged = mockBoardViewProps.onBlocked(ledgerCharge);
  });
  return charged;
};

describe('GameScreen reports whether a blocked tap charged a heart (POLISH-T5)', () => {
  test('normal level: a fresh blocked tap charges, a ledger-refunded repeat does not', () => {
    render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} />);
    expect(blocked(true)).toBe(true);
    expect(blocked(false)).toBe(false);
  });

  test('tutorial T2: the graced first blocked tap does not charge; the next fresh one does', () => {
    render(<GameScreen palette={Daylight} onHome={jest.fn()} tutorialId="T2" feedbackEnabled={false} />);
    expect(blocked(true)).toBe(false);
    expect(blocked(false)).toBe(false);
    expect(blocked(true)).toBe(true);
  });

  test('no charge is reported once the lose transition is pending', () => {
    jest.useFakeTimers();
    try {
      render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} />);
      let charges = 0;
      for (let i = 0; i < 10; i += 1) if (blocked(true) === true) charges += 1;
      // Only the hearts the level has are charged; taps after the last one are not.
      expect(charges).toBeGreaterThan(0);
      expect(charges).toBeLessThan(10);
      expect(blocked(true)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

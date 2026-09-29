import React from 'react';
import { render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { Daylight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
let mockGridEnabled = false;

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../boardGridFlag', () => ({
  get BOARD_GRID_ENABLED() {
    return mockGridEnabled;
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');

const renderGame = () =>
  render(
    <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} />,
  );

// OWNER 2026-09-30: the full row/column lines are gone; the board keeps only its
// dots (they show where paths can run). The "#" toggle that turned lines on is removed.
describe('GameScreen board grid: dots only, no lines toggle', () => {
  beforeEach(() => {
    mockBoardViewProps = null;
  });

  test.each([[false], [true]])('grid flag %s: no "Grid lines" control, and BoardView never gets lines', (enabled) => {
    mockGridEnabled = enabled;
    const screen = renderGame();
    expect(screen.queryByLabelText('Grid lines')).toBeNull();
    expect(screen.queryByText('#')).toBeNull();
    expect(mockBoardViewProps).not.toBeNull();
    expect(mockBoardViewProps?.gridLines ?? false).toBe(false);
  });
});

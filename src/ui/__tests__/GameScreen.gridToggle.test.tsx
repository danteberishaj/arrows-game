import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('../gridLinesSession') as typeof import('../gridLinesSession');

const renderGame = () =>
  render(
    <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={0} feedbackEnabled={false} />,
  );

describe('GameScreen "#" grid-lines toggle (POLISH-T4)', () => {
  beforeEach(() => {
    mockBoardViewProps = null;
    session.setGridLines(false);
  });

  test('flag OFF: no button, and BoardView gets lines off', () => {
    mockGridEnabled = false;
    const screen = renderGame();
    expect(screen.queryByLabelText('Grid lines')).toBeNull();
    expect(mockBoardViewProps?.gridLines).toBe(false);
  });

  test('flag ON: a switch labelled "Grid lines" toggles BoardView lines and survives a remount', () => {
    mockGridEnabled = true;
    const screen = renderGame();
    const button = screen.getByLabelText('Grid lines');
    expect(button.props.accessibilityRole).toBe('switch');
    expect(button.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(mockBoardViewProps?.gridLines).toBe(false);

    fireEvent.press(button);
    expect(screen.getByLabelText('Grid lines').props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });
    expect(mockBoardViewProps?.gridLines).toBe(true);

    // Menu -> game within the same process: the session state is kept.
    screen.unmount();
    const again = renderGame();
    expect(again.getByLabelText('Grid lines').props.accessibilityState.checked).toBe(true);
    expect(mockBoardViewProps?.gridLines).toBe(true);
  });
});

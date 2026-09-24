/**
 * POLISH-T9 #1 (smoothness audit #4): while a tutorial route is active the header line
 * is a constant two-line box, so T1, T2, the blocked line and the emptied line all give
 * the same header height and BoardView's onLayout never re-fits the board.
 * Jest cannot lay out text: the box is checked as style (explicit lineHeight, minHeight
 * = 2 lines at the current font scale, at most 2 lines). The board-viewport log counts
 * and pixel measures in artifacts/POLISH-T9/part1 close the layout claim.
 */
import React from 'react';
import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import type { BoardViewProps } from '../BoardView';
import { GameScreen, TUTORIAL_LINE_HEIGHT, tutorialLineBoxHeight } from '../GameScreen';
import { T1_LINE, T2_BLOCKED_LINE, T2_LINE } from '../ftueCopy';
import { Daylight } from '../theme';

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

const flat = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style) as { lineHeight?: number; minHeight?: number; fontSize?: number };

/** `node` is the line's Text; the nearest ancestor with testID tutorial-line-box is the
 * constant box. Returns both styles. */
function expectTwoLineBox(node: ReactTestInstance) {
  let box: ReactTestInstance | null = node.parent;
  while (box && box.props.testID !== 'tutorial-line-box') box = box.parent;
  expect(box).not.toBeNull();
  const text = flat(node);
  const boxStyle = flat(box!);
  const fontScale = Dimensions.get('window').fontScale;
  expect(text.lineHeight).toBe(TUTORIAL_LINE_HEIGHT);
  expect(boxStyle.minHeight).toBe(tutorialLineBoxHeight(fontScale, PixelRatio.get()));
  expect(node.props.numberOfLines).toBe(2);
  return { text, box: boxStyle };
}

test('the line height sits at or above Fredoka Bold 18 natural line (about 22.1-22.3 dp measured)', () => {
  expect(TUTORIAL_LINE_HEIGHT).toBeGreaterThanOrEqual(22.4);
  expect(TUTORIAL_LINE_HEIGHT).toBeLessThanOrEqual(24);
});

test('the box is two lines rounded up to whole pixels, as Android lays each line out', () => {
  // 411 dp emulator (3.5x): 23 dp = 80.5 px -> 81 px per line -> 162 px = 46.2857 dp.
  expect(tutorialLineBoxHeight(1, 3.5)).toBeCloseTo(162 / 3.5, 10);
  // 360 dp capture (3x): 69 px per line, exact.
  expect(tutorialLineBoxHeight(1, 3)).toBe(46);
  // Font scale 1.3 at 2.625x: 23 * 1.3 * 2.625 = 78.49 -> 79 px per line.
  expect(tutorialLineBoxHeight(1.3, 2.625)).toBeCloseTo(158 / 2.625, 10);
  // Never shorter than two unrounded lines.
  for (const [s, r] of [[1, 1], [1, 2], [1.15, 2.75], [2, 3.5]]) {
    expect(tutorialLineBoxHeight(s, r)).toBeGreaterThanOrEqual(2 * TUTORIAL_LINE_HEIGHT * s);
  }
});

test('T1: the header line is a two-line box', () => {
  const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} tutorialId="T1" feedbackEnabled={false} />);
  expectTwoLineBox(screen.getByText(T1_LINE));
});

test('T2: opening line, blocked line and emptied line keep the identical box', () => {
  const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} tutorialId="T2" feedbackEnabled={false} />);
  const opening = expectTwoLineBox(screen.getByText(T2_LINE));

  act(() => {
    mockBoardViewProps.onBlocked(true); // the first fresh blocked tap: grace, blocked line
  });
  const blocked = expectTwoLineBox(screen.getByText(T2_BLOCKED_LINE));
  expect(blocked).toEqual(opening);

  act(() => {
    mockBoardViewProps.onRemoved(false); // the next successful removal empties the line
  });
  expect(screen.queryByText(T2_BLOCKED_LINE)).toBeNull();
  const empty = screen.getByText('', { exact: true });
  expect(expectTwoLineBox(empty)).toEqual(opening);
});

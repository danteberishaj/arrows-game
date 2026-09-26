/**
 * W5-03: the `{remaining} left` counter stops reflowing on every tap. Fredoka's
 * digits are proportional and the font has no `tnum`
 * (scripts/analysis/font-digits.mjs), so the digits sit right-anchored in a slot
 * whose width comes from an invisible ghost of the widest digit, repeated once
 * per digit of the board's arrow count, followed by a constant " left".
 * Jest cannot lay out text: this pins the structure only. The per-frame "left"
 * column in artifacts/W5-03 closes the layout claim.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { LevelGenerator } from '../../core';
import type { BoardViewProps } from '../BoardView';
import { GameScreen } from '../GameScreen';
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
  StyleSheet.flatten(node.props.style) as Record<string, unknown>;

/** The Text host nodes under the counter's accessible wrapper, in render order. */
function counterTexts(wrapper: ReactTestInstance): ReactTestInstance[] {
  return wrapper.findAll((n) => n.type === Text);
}

function renderLevel(index: number) {
  return render(
    <GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={index} feedbackEnabled={false} />,
  );
}

test.each([
  [0, '22'], // 60 arrows
  [106, '222'], // 100 arrows: the 100 -> 99 boundary keeps the 3-digit slot
  [137, '222'], // 209 arrows, the densest board in 0..199
])('level index %i: the ghost is the widest digit once per digit of the arrow count (%s)', (index, ghost) => {
  const count = LevelGenerator.generate(index).arrowCount;
  const screen = renderLevel(index);
  const wrapper = screen.getByLabelText(`${count} left`);
  const [ghostText, digits, left] = counterTexts(wrapper);
  expect(ghostText.props.children).toBe(ghost);
  expect(digits.props.children).toBe(count);
  expect(left.props.children).toBe(' left');
});

test('the ghost is invisible and hidden from screen readers; the wrapper is one accessible element', () => {
  const screen = renderLevel(137);
  const wrapper = screen.getByLabelText('209 left');
  expect(wrapper.props.accessible).toBe(true);
  const [ghostText, digits] = counterTexts(wrapper);
  expect(flat(ghostText).opacity).toBe(0);
  expect(ghostText.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(ghostText.props.accessibilityElementsHidden).toBe(true);
  // The digits are anchored to the slot's right edge and keep their own width.
  expect(flat(digits)).toMatchObject({ position: 'absolute', right: 0, top: 0, textAlign: 'right' });
  expect(flat(digits).left).toBeUndefined();
  expect(flat(digits).width).toBeUndefined();
  // Same text style as the ghost (same font, size and letter spacing), so the
  // digits share its line box.
  const { opacity: _o, ...ghostStyle } = flat(ghostText);
  const { position: _p, top: _t, right: _r, textAlign: _a, color: _c, ...digitStyle } = flat(digits);
  expect(digitStyle).toEqual(ghostStyle);
});

test('a removal changes only the digits: the ghost and " left" stay as they were', () => {
  const screen = renderLevel(106);
  const board = mockBoardViewProps.board;
  const before = counterTexts(screen.getByLabelText('100 left'));
  act(() => {
    const arrow = board.findHint();
    expect(arrow).not.toBeNull();
    board.tryRemove(arrow!);
    mockBoardViewProps.onRemoved(false);
  });
  const after = counterTexts(screen.getByLabelText('99 left'));
  expect(after[0].props.children).toBe('222');
  expect(after[1].props.children).toBe(99);
  expect(after[2].props.children).toBe(' left');
  expect(after[0].props.children).toBe(before[0].props.children);
  expect(after[2].props.children).toBe(before[2].props.children);
});

test('the counter stays a separate Text from the per-level words (MissionLabel paragraph cache)', () => {
  const screen = renderLevel(137);
  const words = screen.getByText(/· Star ·/);
  expect(String(words.props.children)).not.toMatch(/\d/);
  const wrapper = screen.getByLabelText('209 left');
  expect(wrapper.findAll((n) => n === words)).toHaveLength(0);
});

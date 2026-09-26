/**
 * W5-06 (ART_HEADER_SILHOUETTE_ENABLED): the header's shape-name word becomes
 * the level's silhouette badge, drawn in the tier colour, as tall as the row's
 * line (read once from the tier Text's onLayout, and kept per font scale for
 * later game screens), with the shape name as its accessibility label. Jest
 * cannot lay out text: this pins the structure. The [board-viewport] logs and
 * captures in artifacts/W5-06 close the layout claims (no height change, no wrap).
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { BoardViewProps } from '../BoardView';
import { LevelGenerator } from '../../core';
import { silhouettePath } from '../silhouette';
import { Daylight } from '../theme';

const mockArt = { ART_HEADER_SILHOUETTE_ENABLED: false };
let mockBoardViewProps: BoardViewProps | null = null;

jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    { ART_HEADER_SILHOUETTE_ENABLED: { get: () => mockArt.ART_HEADER_SILHOUETTE_ENABLED, enumerable: true } },
  ));

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
    showInterstitialIfDue: jest.fn(async () => undefined),
    showRewarded: jest.fn(async () => false),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen, HEADER_BADGE_LINE_BY_FONT_SCALE } = require('../GameScreen') as typeof import('../GameScreen');

function layoutTier(screen: ReturnType<typeof render>, tier: RegExp, height: number) {
  act(() => {
    fireEvent(screen.getByText(tier), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 80, height } } });
  });
}

beforeEach(() => {
  mockBoardViewProps = null;
  HEADER_BADGE_LINE_BY_FONT_SCALE.clear(); // each test starts unmeasured
});

describe('flag OFF (default)', () => {
  beforeEach(() => {
    mockArt.ART_HEADER_SILHOUETTE_ENABLED = false;
  });

  test('the mission label is the single word Text it was, with no layout handler and no badge', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={137} feedbackEnabled={false} />);
    const words = screen.getByText('Super Hard · Star · ');
    expect(words.props.onLayout).toBeUndefined();
    expect(screen.queryByTestId('header-silhouette')).toBeNull();
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockArt.ART_HEADER_SILHOUETTE_ENABLED = true;
  });

  test('the shape word is replaced by a badge in the tier colour, sized to the measured line', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={167} feedbackEnabled={false} />);
    expect(screen.queryByText(/Cat/)).toBeNull();
    expect(screen.queryByTestId('header-silhouette')).toBeNull(); // not measured yet
    layoutTier(screen, /^Super Hard ·$/, 17.43);
    const badge = screen.getByTestId('header-silhouette');
    expect(badge.props.accessibilityLabel).toBe('Cat');
    expect(badge.props.width).toBe(17.43);
    expect(badge.props.height).toBe(17.43);
    const path = badge.findAll((n) => typeof n.props.d === 'string')[0];
    expect(path.props.d).toBe(silhouettePath(LevelGenerator.generate(167).mask, 17.43));
    expect(path.props.fill).toBe(Daylight.heartText); // Super Hard's diffColor
    expect(path.props.fillRule).toBe('evenodd');
    // The closing separator is the word path's (testing-library trims the ' · ' it matches);
    // the W5-03 counter stays a separate element.
    expect(screen.getByText(/^·$/)).toBeTruthy();
    expect(screen.getByLabelText('202 left').findAll((n) => n === badge)).toHaveLength(0);
  });

  test('the line height is read once: a later layout does not resize the badge', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={38} feedbackEnabled={false} />);
    layoutTier(screen, /^Hard ·$/, 16);
    layoutTier(screen, /^Hard ·$/, 30);
    expect(screen.getByTestId('header-silhouette').props.height).toBe(16);
  });

  test('a later game screen at the same font scale draws the badge in its first render', () => {
    const first = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={38} feedbackEnabled={false} />);
    layoutTier(first, /^Hard ·$/, 16);
    first.unmount();
    const second = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={167} feedbackEnabled={false} />);
    const badge = second.getByTestId('header-silhouette');
    expect(badge.props.height).toBe(16);
    expect(badge.props.accessibilityLabel).toBe('Cat');
  });

  test('Retry keeps the badge (same level, same line)', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} initialLevelIndex={38} feedbackEnabled={false} />);
    layoutTier(screen, /^Hard ·$/, 16);
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) act(() => { mockBoardViewProps!.onBlocked(true); });
      act(() => { jest.advanceTimersByTime(2000); });
      act(() => { fireEvent.press(screen.getByText('Retry')); });
    } finally {
      jest.useRealTimers();
    }
    expect(screen.getByTestId('header-silhouette').props.accessibilityLabel).toBe('Ring');
  });

  test('the tutorial header (an empty-mask board) shows the tutorial line and no badge', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} tutorialId="T1" feedbackEnabled={false} />);
    expect(screen.queryByTestId('header-silhouette')).toBeNull();
    expect(screen.getByTestId('tutorial-line-box')).toBeTruthy();
  });

  test('daily mode: TODAY over the badge row', () => {
    const screen = render(<GameScreen palette={Daylight} onHome={jest.fn()} daily={{ day: 20000 }} feedbackEnabled={false} />);
    expect(screen.getByText('TODAY')).toBeTruthy();
    layoutTier(screen, /^(Normal|Hard|Super Hard) ·$/, 15);
    expect(screen.getByTestId('header-silhouette').props.height).toBe(15);
  });
});

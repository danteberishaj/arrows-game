/**
 * W3-20 option (a) (TIER_LABEL_V2_ENABLED): the game header's tier word and its colour come from the dealt
 * board's arrow count; OFF they are the cycle's. Only the label moves: the board, its hearts and its arrow
 * count are the cycle-generated ones either way. Level 12 (index 11) is the reproduction: v1 Bolt, 54 arrows.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BoardViewProps } from '../BoardView';
import { LevelGenerator, SaveSystem, type IntStore } from '../../core';
import { InkNight, Daylight, type Palette } from '../theme';

const mockFlags = { TIER_LABEL_V2_ENABLED: false };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { TIER_LABEL_V2_ENABLED: { get: () => mockFlags.TIER_LABEL_V2_ENABLED, enumerable: true } },
  ));

const mockPerf = { DEV_GEN_VERSION: null as 1 | 2 | null };
jest.mock('../../perfMode', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../perfMode') },
    { DEV_GEN_VERSION: { get: () => mockPerf.DEV_GEN_VERSION, enumerable: true } },
  ));

let mockBoardViewProps: BoardViewProps | null = null;
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
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HomeScreen } = require('../HomeScreen') as typeof import('../HomeScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearMenuTierCache } = require('../tierLabel') as typeof import('../tierLabel');

const renderGame = (index: number, palette: Palette = Daylight) =>
  render(<GameScreen palette={palette} onHome={jest.fn()} initialLevelIndex={index} feedbackEnabled={false} />);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const colorOf = (node: { props: { [key: string]: any } }) => StyleSheet.flatten(node.props.style)?.color;

beforeEach(() => {
  mockFlags.TIER_LABEL_V2_ENABLED = false;
  mockPerf.DEV_GEN_VERSION = null;
  mockBoardViewProps = null;
  clearMenuTierCache();
});

describe('flag OFF (default)', () => {
  test('level 12 reproduces the lie: "Super Hard · Bolt" on a 54-arrow board, in heartText', () => {
    const screen = renderGame(11);
    const words = screen.getByText('Super Hard · Bolt · ');
    expect(colorOf(words)).toBe(Daylight.heartText);
    expect(screen.getByLabelText('54 left')).toBeTruthy();
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockFlags.TIER_LABEL_V2_ENABLED = true;
  });

  test('level 12 reads "Normal · Bolt" in inkDim (counter too), in both themes, and never "Super Hard"', () => {
    for (const palette of [Daylight, InkNight]) {
      const screen = renderGame(11, palette);
      expect(screen.queryByText(/Super Hard/)).toBeNull();
      const words = screen.getByText('Normal · Bolt · ');
      expect(colorOf(words)).toBe(palette.inkDim);
      expect(colorOf(screen.getByText(' left'))).toBe(palette.inkDim);
      screen.unmount();
    }
  });

  test('only the label moves: the board on screen is the cycle-generated level 12, arrow for arrow', () => {
    const screen = renderGame(11);
    const dealt = LevelGenerator.generate(11, 1);
    const cells = (arrows: readonly { cells: readonly unknown[] }[]) => JSON.stringify(arrows.map((a) => a.cells));
    expect(cells(mockBoardViewProps!.board.arrows())).toBe(cells(dealt.board.arrows()));
    expect(screen.getByLabelText('54 left')).toBeTruthy();
  });

  test('level 3 (139 arrows, cycle Hard) reads Super Hard in heartText', () => {
    const screen = renderGame(2);
    const dealt = LevelGenerator.generate(2, 1);
    expect(dealt.arrowCount).toBe(139);
    expect(colorOf(screen.getByText(`Super Hard · ${dealt.shapeName} · `))).toBe(Daylight.heartText);
  });

  test('the menu and the header name the same tier for the board Play deals (v1, and v2 at switch 0 and 1)', () => {
    const store = new Map<string, number>([['arrows_current_level', 11], ['arrows_total_solved', 11]]);
    const intStore: IntStore = {
      getInt: (k, d) => store.get(k) ?? d,
      setInt: (k, v) => void store.set(k, v),
      deleteKey: (k) => void store.delete(k),
    };
    const previous = SaveSystem.useStore(intStore);
    jest.useFakeTimers(); // the menu's collection fold waits 2 s
    try {
      const cases: [1 | 2 | null, number | null][] = [[null, null], [2, 0], [2, 1]];
      const words: string[] = [];
      for (const [dev, switchLevel] of cases) {
        mockPerf.DEV_GEN_VERSION = dev;
        if (switchLevel === null) store.delete('arrows_gen_switch_level');
        else store.set('arrows_gen_switch_level', switchLevel);
        const menu = render(<HomeScreen palette={Daylight} dark={false} soundOn onPlay={jest.fn()}
          onToggleSound={jest.fn()} onToggleTheme={jest.fn()} />);
        const menuWord = menu.getByText(/^(Normal|Hard|Super Hard)$/).props.children as string;
        menu.unmount();
        const game = render(<GameScreen palette={Daylight} onHome={jest.fn()} feedbackEnabled={false} />);
        const header = game.getByText(/^(Normal|Hard|Super Hard) · /).props.children as unknown[];
        game.unmount();
        expect(header[0]).toBe(menuWord);
        words.push(menuWord);
      }
      // v1 54 arrows, v2 fresh 36, v2 existing 156: the comparison above covers distinct readings.
      expect(words).toEqual(['Normal', 'Normal', 'Super Hard']);
    } finally {
      jest.useRealTimers();
      SaveSystem.useStore(previous);
    }
  });
});

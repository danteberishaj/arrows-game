/**
 * W5-04 (ART_WIN_SILHOUETTE_ENABLED) wiring in GameScreen, against the real
 * SaveSystem over an in-memory store. The outline itself is W5-01's
 * (silhouette.test.ts). What a component test cannot see — the badge on the
 * real renderer, the Ring's hole under the even-odd rule, the fit on a
 * 360×640 dp screen — closes only on the emulator captures in artifacts/W5-04/.
 * Here:
 * - flag OFF: the won panel (campaign and daily) is the tree that BASE
 *   f8125de's GameScreen.tsx rendered (the snapshot was written before
 *   GameScreen.tsx was edited), and no silhouette path is ever computed;
 * - flag ON: exactly one badge, a direct child of the panel between the title
 *   and the stars (no wrapper of its own), is the level's own silhouette at
 *   ART_WIN_SILHOUETTE_DP, filled in the palette's accent with the even-odd
 *   rule; taking it out gives back the flag-OFF tree;
 * - no badge on the lose panel, none (not even an empty Svg) for a board whose
 *   mask is empty or for a W1 tutorial board, and the path follows the level
 *   across Next level.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance, ReactTestRendererJSON } from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';
import { generateDaily, LevelGenerator } from '../../core';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import type { BoardViewProps } from '../BoardView';
import { Daylight, InkNight, type Palette } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockArt = { ART_WIN_SILHOUETTE_ENABLED: false };
let mockEmptyMask = false;

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));

jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    {
      ART_WIN_SILHOUETTE_ENABLED: {
        get: () => mockArt.ART_WIN_SILHOUETTE_ENABLED,
        enumerable: true,
      },
    },
  ));

jest.mock('../silhouette', () => {
  const actual = jest.requireActual('../silhouette');
  return { silhouettePath: jest.fn(actual.silhouettePath) };
});

// A W1 tutorial board has `mask: []`; the empty-mask case is driven through a
// campaign session so that the won panel (which tutorials never show) mounts.
jest.mock('../gameSessionLifecycle', () => {
  const actual = jest.requireActual('../gameSessionLifecycle');
  return {
    ...actual,
    createLevelSession: (index: number, revision: number) => {
      const session = actual.createLevelSession(index, revision);
      return mockEmptyMask ? { ...session, level: { ...session.level, mask: [] } } : session;
    },
  };
});

jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return true;
    },
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => undefined,
    showInterstitialIfDue: async () => undefined,
    showRewarded: async () => false,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ART_WIN_SILHOUETTE_DP } = require('../artConfig') as typeof import('../artConfig');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const silhouetteModule = require('../silhouette') as { silhouettePath: jest.Mock };
const realSilhouettePath = jest.requireActual('../silhouette').silhouettePath as (
  mask: readonly (readonly boolean[])[],
  size: number,
) => string;

class MapStore implements IntStore {
  readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    return this.map.get(key) ?? defaultValue;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

const LEVEL_INDEX = 7; // campaign pointer the store is seeded with (renders "LEVEL 8")
const DAY = 2450; // golden daily: Plus (src/core/__tests__/dailyBoard.test.ts)
const dayDate = (day: number) => new Date(2020, 0, 1 + day, 12, 0, 0);

let previousStore: IntStore;
let previousClock: () => Date;

/** A fresh store per render, so two renders in one test see the same progress. */
function seedStore() {
  const store = new MapStore();
  SaveSystem.useStore(store);
  store.setInt('arrows_current_level', LEVEL_INDEX);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  store.setInt('arrows_perfect_streak', 3); // a perfect clear shows "✦ 4 perfect in a row"
  store.setInt('arrows_day_streak', 4);
  store.setInt('arrows_last_play_day', DAY - 1);
}

const renderGame = (props: { palette?: Palette; daily?: { day: number } } = {}) => {
  seedStore();
  return render(
    <GameScreen
      palette={props.palette ?? Daylight}
      onHome={jest.fn()}
      daily={props.daily}
      feedbackEnabled={false}
    />,
  );
};

type Screen = ReturnType<typeof renderGame>;

function winBoard(screen: Screen) {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
  });
  expect(screen.getByText('Cleared!')).toBeTruthy();
}

function loseBoard(screen: Screen) {
  for (let i = 0; i < 3; i += 1) {
    act(() => {
      mockBoardViewProps!.onBlocked(true);
    });
  }
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });
  expect(screen.getByText('Out of hearts')).toBeTruthy();
}

const badges = (screen: Screen): ReactTestInstance[] =>
  screen.UNSAFE_queryAllByType(Svg).filter((svg) => svg.props.testID === 'win-silhouette');

/** The host node whose children hold the panel title (the panel's content box). */
function panelNode(tree: ReactTestRendererJSON): ReactTestRendererJSON {
  const isTitle = (node: ReactTestRendererJSON | string) =>
    typeof node !== 'string' && node.type === 'Text' && node.children?.includes('Cleared!');
  const visit = (node: ReactTestRendererJSON): ReactTestRendererJSON | null => {
    if (node.children?.some(isTitle)) return node;
    for (const child of node.children ?? []) {
      if (typeof child === 'string') continue;
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  const panel = visit(tree);
  if (!panel) throw new Error('no panel in the rendered tree');
  return panel;
}

const json = (screen: Screen) => screen.toJSON() as ReactTestRendererJSON;

beforeEach(() => {
  jest.useFakeTimers();
  mockBoardViewProps = null;
  mockArt.ART_WIN_SILHOUETTE_ENABLED = false;
  mockEmptyMask = false;
  silhouetteModule.silhouettePath.mockClear();
  previousStore = SaveSystem.useStore(new MapStore());
  previousClock = SaveSystem.useClock(() => dayDate(DAY));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  jest.useRealTimers();
});

describe('flag OFF (default): the won panel is BASE f8125de', () => {
  test('campaign win', () => {
    const screen = renderGame();
    winBoard(screen);
    expect(screen.getByText('✦ 4 perfect in a row')).toBeTruthy();
    expect(badges(screen)).toHaveLength(0);
    expect(panelNode(json(screen))).toMatchSnapshot();
    expect(silhouetteModule.silhouettePath).not.toHaveBeenCalled();
  });

  test('daily win', () => {
    const screen = renderGame({ daily: { day: DAY } });
    winBoard(screen);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(badges(screen)).toHaveLength(0);
    expect(panelNode(json(screen))).toMatchSnapshot();
    expect(silhouetteModule.silhouettePath).not.toHaveBeenCalled();
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockArt.ART_WIN_SILHOUETTE_ENABLED = true;
  });

  test('the campaign win panel shows the level silhouette under the title, above the stars', () => {
    const screen = renderGame();
    winBoard(screen);
    const [badge] = badges(screen);
    expect(badges(screen)).toHaveLength(1);
    expect(badge.props.width).toBe(ART_WIN_SILHOUETTE_DP);
    expect(badge.props.height).toBe(ART_WIN_SILHOUETTE_DP);
    const path = badge.findByType(Path);
    const mask = LevelGenerator.generate(LEVEL_INDEX).mask;
    expect(path.props.d).toBe(realSilhouettePath(mask, ART_WIN_SILHOUETTE_DP));
    expect(path.props.d).not.toBe('');
    expect(path.props.fill).toBe(Daylight.accent);
    expect(path.props.fillRule).toBe('evenodd');

    // Order inside the panel: title, badge, stars row, subline. The badge is a
    // direct child of the panel: no wrapper (animated or not) of its own.
    const panel = panelNode(json(screen));
    const kids = (panel.children ?? []) as ReactTestRendererJSON[];
    const titleAt = kids.findIndex((kid) => kid.type === 'Text' && kid.children?.includes('Cleared!'));
    expect(kids[titleAt + 1].props.testID).toBe('win-silhouette');
    expect(JSON.stringify(kids[titleAt + 2])).toContain('★');
    expect(JSON.stringify(kids[titleAt + 3])).toContain(`Level ${LEVEL_INDEX + 1} · `);
  });

  test('taking the badge out gives back the flag-OFF tree exactly', () => {
    mockArt.ART_WIN_SILHOUETTE_ENABLED = false;
    const off = renderGame();
    winBoard(off);
    const offTree = JSON.stringify(json(off));
    off.unmount();

    mockArt.ART_WIN_SILHOUETTE_ENABLED = true;
    const on = renderGame();
    winBoard(on);
    const onTree = json(on);
    const panel = panelNode(onTree);
    const before = panel.children!.length;
    panel.children = panel.children!.filter(
      (kid) => typeof kid === 'string' || kid.props.testID !== 'win-silhouette',
    );
    expect(panel.children.length).toBe(before - 1);
    expect(JSON.stringify(onTree)).toBe(offTree);
  });

  test('Ink Night fills the badge with its own accent', () => {
    const screen = renderGame({ palette: InkNight });
    winBoard(screen);
    expect(badges(screen)[0].findByType(Path).props.fill).toBe(InkNight.accent);
  });

  test('the daily win panel shows the daily board silhouette', () => {
    const screen = renderGame({ daily: { day: DAY } });
    winBoard(screen);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(badges(screen)[0].findByType(Path).props.d).toBe(
      realSilhouettePath(generateDaily(DAY).mask, ART_WIN_SILHOUETTE_DP),
    );
  });

  test('the lose panel has no badge', () => {
    const screen = renderGame();
    loseBoard(screen);
    expect(badges(screen)).toHaveLength(0);
  });

  test('a board with an empty mask renders no badge and no empty Svg', () => {
    mockArt.ART_WIN_SILHOUETTE_ENABLED = false;
    const off = renderGame();
    winBoard(off);
    const svgsOff = off.UNSAFE_queryAllByType(Svg).length;
    off.unmount();

    mockArt.ART_WIN_SILHOUETTE_ENABLED = true;
    mockEmptyMask = true;
    const screen = renderGame();
    winBoard(screen);
    expect(badges(screen)).toHaveLength(0);
    expect(screen.UNSAFE_queryAllByType(Svg)).toHaveLength(svgsOff); // only the header hearts
  });

  test('a W1 tutorial board (mask []) renders no badge through its clear', () => {
    seedStore();
    const screen = render(
      <GameScreen palette={Daylight} onHome={jest.fn()} tutorialId="T1" feedbackEnabled={false} />,
    );
    const board = mockBoardViewProps!.board;
    act(() => {
      for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(true);
    });
    expect(badges(screen)).toHaveLength(0);
    act(() => {
      jest.advanceTimersByTime(WON_PANEL_DELAY_MS);
    });
    expect(badges(screen)).toHaveLength(0);
    expect(silhouetteModule.silhouettePath).toHaveBeenCalled();
    expect(silhouetteModule.silhouettePath.mock.results.every((r) => r.value === '')).toBe(true);
  });

  test('the badge follows the level across Next level', async () => {
    const screen = renderGame();
    winBoard(screen);
    await act(async () => {
      fireEvent.press(screen.getByText('Next level'));
    });
    expect(screen.queryByText('Cleared!')).toBeNull();
    expect(badges(screen)).toHaveLength(0);
    winBoard(screen);
    expect(badges(screen)[0].findByType(Path).props.d).toBe(
      realSilhouettePath(LevelGenerator.generate(LEVEL_INDEX + 1).mask, ART_WIN_SILHOUETTE_DP),
    );
  });
});

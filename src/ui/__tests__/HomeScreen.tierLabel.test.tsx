/**
 * W3-20 option (a) (TIER_LABEL_V2_ENABLED): the menu's tier word names the board Play will deal, at this
 * install's generator version and switch level; OFF it is the cycle's word, with nothing generated.
 * Level 12 (index 11) is the reproduction: v1 Bolt, 54 arrows, cycle "Super Hard".
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { LevelGenerator, displayTier, Difficulties } from '../../core';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { InkNight, Daylight, type Palette } from '../theme';
import { clearMenuTierCache, menuTierStats } from '../tierLabel';

const mockFlags = { TIER_LABEL_V2_ENABLED: false };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { TIER_LABEL_V2_ENABLED: { get: () => mockFlags.TIER_LABEL_V2_ENABLED, enumerable: true } },
  ));

// W3-06's dev jump is the only way to make levelGenVersion return 2 while GEN_V2_ENABLED ships false.
const mockPerf = { DEV_GEN_VERSION: null as 1 | 2 | null };
jest.mock('../../perfMode', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../perfMode') },
    { DEV_GEN_VERSION: { get: () => mockPerf.DEV_GEN_VERSION, enumerable: true } },
  ));

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

let store: MapStore;
let previousStore: IntStore;

const renderMenu = (palette: Palette = Daylight) =>
  render(
    <HomeScreen
      palette={palette}
      dark={palette === InkNight}
      soundOn
      onPlay={jest.fn()}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />,
  );

const tierText = (menu: ReturnType<typeof renderMenu>) =>
  menu.getByText(/^(Normal|Hard|Super Hard)$/);

beforeEach(() => {
  jest.useFakeTimers(); // the menu's collection fold waits 2 s; nothing here advances it
  mockFlags.TIER_LABEL_V2_ENABLED = false;
  mockPerf.DEV_GEN_VERSION = null;
  clearMenuTierCache();
  store = new MapStore();
  store.setInt('arrows_current_level', 11);
  store.setInt('arrows_total_solved', 11);
  previousStore = SaveSystem.useStore(store);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  jest.useRealTimers();
});

describe('flag OFF (default)', () => {
  test('level 12 reads the cycle word "Super Hard" in heartText, and no board is generated', () => {
    const generate = jest.spyOn(LevelGenerator, 'generate');
    try {
      const menu = renderMenu();
      expect(menu.getByText('Level 12')).toBeTruthy();
      const tier = tierText(menu);
      expect(tier.props.children).toBe('Super Hard');
      expect(StyleSheet.flatten(tier.props.style).color).toBe(Daylight.heartText);
      expect(generate).not.toHaveBeenCalled();
      expect(menuTierStats.generations).toBe(0);
    } finally {
      generate.mockRestore();
    }
  });

  test.each([0, 1, 2, 5, 11, 137, 3827])('index %i reads Difficulties.forLevel, as before', (index) => {
    store.setInt('arrows_current_level', index);
    const menu = renderMenu();
    expect(tierText(menu).props.children).toBe(Difficulties.displayName(Difficulties.forLevel(index)));
  });
});

describe('flag ON', () => {
  beforeEach(() => {
    mockFlags.TIER_LABEL_V2_ENABLED = true;
  });

  test('level 12 (v1 Bolt, 54 arrows) no longer reads "Super Hard": Normal, in inkDim, both themes', () => {
    for (const palette of [Daylight, InkNight]) {
      const menu = renderMenu(palette);
      expect(menu.queryByText('Super Hard')).toBeNull();
      const tier = tierText(menu);
      expect(tier.props.children).toBe('Normal');
      expect(StyleSheet.flatten(tier.props.style).color).toBe(palette.inkDim);
      menu.unmount();
    }
  });

  test('a heavy v1 board reads its own tier: level 3 (139 arrows, cycle Hard) reads Super Hard in heartText', () => {
    store.setInt('arrows_current_level', 2);
    expect(LevelGenerator.generate(2, 1).arrowCount).toBe(139);
    const tier = tierText(renderMenu());
    expect(tier.props.children).toBe('Super Hard');
    expect(StyleSheet.flatten(tier.props.style).color).toBe(Daylight.heartText);
  });

  test('the board is generated once per index: re-renders and re-mounts reuse the count', () => {
    const menu = renderMenu();
    menu.rerender(
      <HomeScreen palette={Daylight} dark={false} soundOn={false} onPlay={jest.fn()} onToggleSound={jest.fn()}
        onToggleTheme={jest.fn()} />,
    );
    menu.unmount();
    renderMenu().unmount();
    expect(menuTierStats.generations).toBe(1);
    store.setInt('arrows_current_level', 12); // a new resume level is a new board
    renderMenu();
    expect(menuTierStats.generations).toBe(2);
  });

  test('v2: the menu follows the install\'s switch level (fresh 0 and existing 1 deal different boards at level 12)', () => {
    mockPerf.DEV_GEN_VERSION = 2;
    const fresh = LevelGenerator.generate(11, 2, { switchLevel: 0 });
    const existing = LevelGenerator.generate(11, 2, { switchLevel: 1 });
    // The test only has teeth if the two boards read differently.
    expect(Difficulties.displayName(displayTier(fresh))).toBe('Normal');
    expect(Difficulties.displayName(displayTier(existing))).toBe('Super Hard');

    store.setInt('arrows_gen_switch_level', 0);
    const freshMenu = renderMenu();
    expect(tierText(freshMenu).props.children).toBe('Normal');
    freshMenu.unmount();

    store.setInt('arrows_gen_switch_level', 1);
    expect(tierText(renderMenu()).props.children).toBe('Super Hard');
  });
});

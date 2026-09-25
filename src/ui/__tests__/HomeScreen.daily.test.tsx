/**
 * W4-06: the menu's "Today's board" entry (META_DAILY). The state rule itself
 * is dailyEntryState.test.ts; here, what the menu renders for each state with
 * the flag ON, and that the flag OFF renders no entry at all. Placement,
 * overlap with the stats line / banner and pixels close only on the emulator
 * captures in artifacts/W4-06/.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight, Fonts } from '../theme';

const mockFlags = { META_DAILY: true };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_DAILY: { get: () => mockFlags.META_DAILY, enumerable: true } },
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

const TODAY_LABEL = "Today's board";
const DONE_LABEL = "Today's board \u00b7 done";

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let onDaily: jest.Mock;

const renderMenu = () =>
  render(
    <HomeScreen
      palette={Daylight}
      dark={false}
      soundOn
      onPlay={jest.fn()}
      onDaily={onDaily}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />,
  );

beforeEach(() => {
  mockFlags.META_DAILY = true;
  onDaily = jest.fn();
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2026, 8, 25, 12, 0, 0));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
});

describe('flag ON', () => {
  test('hidden before the first solve', () => {
    const menu = renderMenu();
    expect(menu.queryByText(/Today/)).toBeNull();
  });

  test('available: a quiet inkDim brand-font text button that opens the daily', () => {
    store.setInt('arrows_total_solved', 3);
    const menu = renderMenu();

    const entry = menu.getByRole('button', { name: TODAY_LABEL });
    const text = menu.getByText(TODAY_LABEL);
    const textStyle = StyleSheet.flatten(text.props.style);
    expect(textStyle.color).toBe(Daylight.inkDim);
    expect(Object.values(Fonts)).toContain(textStyle.fontFamily);

    // No pill: no fill, no border. Hit area >= 44 x 44 dp.
    const boxStyle = StyleSheet.flatten(entry.props.style);
    expect(boxStyle.backgroundColor).toBeUndefined();
    expect(boxStyle.borderWidth).toBeUndefined();
    expect(boxStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(boxStyle.minWidth).toBeGreaterThanOrEqual(44);

    fireEvent.press(entry);
    expect(onDaily).toHaveBeenCalledTimes(1);
  });

  test('done today: the label says so and is not pressable', () => {
    store.setInt('arrows_total_solved', 3);
    store.setInt('arrows_daily_last_day', SaveSystem.today());
    const menu = renderMenu();

    expect(menu.getByText(DONE_LABEL)).toBeTruthy();
    expect(menu.queryByRole('button', { name: /Today/ })).toBeNull();
    fireEvent.press(menu.getByText(DONE_LABEL));
    expect(onDaily).not.toHaveBeenCalled();
    expect(menu.queryByText(TODAY_LABEL)).toBeNull();
  });

  test('yesterday’s clear or a future day (restored backup) reads available', () => {
    store.setInt('arrows_total_solved', 3);
    for (const stored of [SaveSystem.today() - 1, SaveSystem.today() + 3]) {
      store.setInt('arrows_daily_last_day', stored);
      const menu = renderMenu();
      expect(menu.getByRole('button', { name: TODAY_LABEL })).toBeTruthy();
      menu.unmount();
    }
  });
});

describe('flag OFF', () => {
  beforeEach(() => {
    mockFlags.META_DAILY = false;
  });

  test('no entry in any state, and the same tree as with the entry hidden', () => {
    const hiddenOn = (() => {
      mockFlags.META_DAILY = true;
      const menu = renderMenu(); // totalSolved 0: hidden
      const json = JSON.stringify(menu.toJSON());
      menu.unmount();
      mockFlags.META_DAILY = false;
      return json;
    })();
    expect(JSON.stringify(renderMenu().toJSON())).toBe(hiddenOn);

    for (const lastDay of [0, SaveSystem.today()]) {
      store.setInt('arrows_total_solved', 3);
      store.setInt('arrows_daily_last_day', lastDay);
      const menu = renderMenu();
      expect(menu.queryByText(/Today/)).toBeNull();
      menu.unmount();
    }
  });
});

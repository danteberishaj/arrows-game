/**
 * W4-09: the menu's quiet `Gallery` control (META_GALLERY). With the flag ON
 * and at least one solve it is an inkDim brand-font text button with a
 * >= 44 x 44 dp box, beside W4-06's daily line (same row, so the column's
 * height does not grow). With the flag OFF the menu is exactly BASE: the
 * `flag OFF` snapshots in __snapshots__/HomeScreen.gallery.test.tsx.snap were
 * written by BASE 4840d25's HomeScreen.tsx, before HomeScreen.tsx was edited.
 * W4-10 rewrote the two whose META_DAILY is on (`solved, daily available` and
 * `solved, daily done`): they hold the composed menu's daily-only layout, which
 * W4-10 owns; the two with every menu flag off are still BASE's.
 * Placement against the stats line and the banner closes only on the
 * uiautomator dump in artifacts/W4-09/layout/.
 */
import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight, Fonts } from '../theme';

const mockFlags = { META_GALLERY: true, META_DAILY: false };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_GALLERY: { get: () => mockFlags.META_GALLERY, enumerable: true },
      META_DAILY: { get: () => mockFlags.META_DAILY, enumerable: true },
    },
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

const GALLERY = 'Gallery';
const TODAY_LABEL = "Today's board";

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;
let onGallery: jest.Mock;
let onDaily: jest.Mock;

const renderMenu = () =>
  render(
    <HomeScreen
      palette={Daylight}
      dark={false}
      soundOn
      onPlay={jest.fn()}
      onDaily={onDaily}
      onGallery={onGallery}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />,
  );

beforeEach(() => {
  jest.useFakeTimers(); // the menu's collection fold waits 2 s; nothing here advances it
  mockFlags.META_GALLERY = true;
  mockFlags.META_DAILY = false;
  onGallery = jest.fn();
  onDaily = jest.fn();
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2026, 8, 25, 12, 0, 0));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  jest.useRealTimers();
});

describe('flag ON', () => {
  test('hidden before the first solve', () => {
    const menu = renderMenu();
    expect(menu.queryByText(GALLERY)).toBeNull();
    expect(menu.queryByRole('button', { name: GALLERY })).toBeNull();
  });

  test('after a solve: a quiet inkDim brand-font text button with a >= 44 x 44 dp box that opens the gallery', () => {
    store.setInt('arrows_total_solved', 1);
    const menu = renderMenu();

    const entry = menu.getByRole('button', { name: GALLERY });
    const textStyle = StyleSheet.flatten(menu.getByText(GALLERY).props.style);
    expect(textStyle.color).toBe(Daylight.inkDim);
    expect(Object.values(Fonts)).toContain(textStyle.fontFamily);
    expect(textStyle.fontWeight).toBeUndefined(); // ruling F19: theme families, never fontWeight

    const boxStyle = StyleSheet.flatten(entry.props.style);
    expect(boxStyle.backgroundColor).toBeUndefined(); // no pill
    expect(boxStyle.borderWidth).toBeUndefined();
    expect(boxStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(boxStyle.minWidth).toBeGreaterThanOrEqual(44);

    fireEvent.press(entry);
    expect(onGallery).toHaveBeenCalledTimes(1);
    expect(onDaily).not.toHaveBeenCalled();
  });

  test('with the daily line shown, both controls share one row (the column does not grow)', () => {
    mockFlags.META_DAILY = true;
    store.setInt('arrows_total_solved', 3);
    const menu = renderMenu();

    const row = menu.getByTestId('menu-entry-row');
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    const gallery = within(row).getByRole('button', { name: GALLERY });
    const daily = within(row).getByRole('button', { name: TODAY_LABEL });
    expect(gallery).toBeTruthy();

    fireEvent.press(daily);
    expect(onDaily).toHaveBeenCalledTimes(1);
    expect(onGallery).not.toHaveBeenCalled();
  });

  test('without the daily line, the gallery control takes its place (same upper-block spacing)', () => {
    store.setInt('arrows_total_solved', 3);
    const withGallery = renderMenu();
    expect(withGallery.getByRole('button', { name: GALLERY })).toBeTruthy();
    const upperOn = StyleSheet.flatten(withGallery.getByText('Level 1').parent?.props.style);
    withGallery.unmount();

    mockFlags.META_GALLERY = false;
    mockFlags.META_DAILY = true;
    const withDaily = renderMenu();
    const upperDaily = StyleSheet.flatten(withDaily.getByText('Level 1').parent?.props.style);
    expect(upperOn).toEqual(upperDaily);
  });

  test('the menu reads no collection data for the control (no gallery work while closed)', () => {
    store.setInt('arrows_total_solved', 3);
    const seen = jest.spyOn(SaveSystem, 'shapesSeen', 'get');
    const sync = jest.spyOn(SaveSystem, 'syncCollection');
    renderMenu();
    expect(seen).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    seen.mockRestore();
    sync.mockRestore();
  });
});

describe('flag OFF: the BASE menu', () => {
  beforeEach(() => {
    mockFlags.META_GALLERY = false;
  });

  const states: Array<[string, boolean, number, boolean]> = [
    // [name, META_DAILY, totalSolved, daily done today]
    ['fresh, daily off', false, 0, false],
    ['solved, daily off', false, 3, false],
    ['solved, daily available', true, 3, false],
    ['solved, daily done', true, 3, true],
  ];

  test.each(states)('%s: no gallery control, tree identical to BASE', (_name, daily, solved, done) => {
    mockFlags.META_DAILY = daily;
    store.setInt('arrows_total_solved', solved);
    if (done) store.setInt('arrows_daily_last_day', SaveSystem.today());
    const menu = renderMenu();
    expect(menu.queryByText(GALLERY)).toBeNull();
    expect(menu.toJSON()).toMatchSnapshot();
  });
});

/**
 * W7-04 (META_SETTINGS_SHEET): the menu's Settings button. Flag ON: one 44 dp HeaderButton, accessible as
 * "Settings", joins the top-right cluster on its far (left) side, so the theme and sound buttons keep their places;
 * pressing it opens the sheet, and the sheet's close removes it. Flag OFF: no button and no sheet (the menu's
 * flag-OFF trees are also pinned, byte for byte, by the BASE snapshots of HomeScreen.gallery / compose tests).
 * Placement, overlap and the insets close only on the uiautomator bounds in artifacts/W7-04/layout/.
 */
import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight } from '../theme';

const mockFlags = { META_SETTINGS_SHEET: true };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { META_SETTINGS_SHEET: { get: () => mockFlags.META_SETTINGS_SHEET, enumerable: true } },
  ));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HomeScreen } = require('../HomeScreen') as typeof import('../HomeScreen');

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

let previousStore: IntStore;
let previousClock: () => Date;

const renderMenu = () =>
  render(
    <HomeScreen
      palette={Daylight}
      dark={false}
      soundOn
      onPlay={jest.fn()}
      onToggleSound={jest.fn()}
      onToggleTheme={jest.fn()}
    />,
  );

beforeEach(() => {
  jest.useFakeTimers();
  mockFlags.META_SETTINGS_SHEET = true;
  const store = new MapStore();
  store.setInt('arrows_total_solved', 3);
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2026, 8, 27, 12, 0, 0));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  jest.useRealTimers();
});

describe('flag OFF', () => {
  it('no Settings button and no sheet', () => {
    mockFlags.META_SETTINGS_SHEET = false;
    const menu = renderMenu();
    expect(menu.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(menu.queryByText('Settings')).toBeNull();
  });
});

describe('flag ON', () => {
  it('a 44 dp HeaderButton named "Settings" joins the top-right cluster as its last (leftmost) child', () => {
    const menu = renderMenu();
    const button = menu.getByRole('button', { name: 'Settings' });
    const s = StyleSheet.flatten(button.props.style);
    expect(s.width).toBe(44);
    expect(s.height).toBe(44);
    // The cluster lays out row-reverse from the right edge: theme (first), sound, then Settings (last = leftmost).
    let cluster = button.parent;
    while (cluster && StyleSheet.flatten(cluster.props.style)?.flexDirection !== 'row-reverse') cluster = cluster.parent;
    expect(cluster).not.toBeNull();
    expect(StyleSheet.flatten(cluster!.props.style).position).toBe('absolute');
    const kids = cluster!.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    expect(kids).toHaveLength(3);
    expect(kids.map((k) => k.props.label)).toEqual(['☾', '♪', '\u2699\uFE0E']);
    expect(within(kids[2]).getByRole('button', { name: 'Settings' })).toBe(button);
  });

  it('the text glyph is the gear in its TEXT presentation (U+2699 U+FE0E), so Android draws no colour emoji', () => {
    const menu = renderMenu();
    const button = menu.getByRole('button', { name: 'Settings' });
    const glyph = button.findByType(Text);
    expect(glyph.props.children).toBe('⚙︎');
    expect(StyleSheet.flatten(glyph.props.style).color).toBe(Daylight.accentCore);
  });

  it('the sheet is not mounted until the button is pressed; it opens, and its close removes it', () => {
    const menu = renderMenu();
    expect(menu.queryByTestId('settings-panel')).toBeNull();
    fireEvent.press(menu.getByRole('button', { name: 'Settings' }));
    expect(menu.getByTestId('settings-panel')).toBeTruthy();
    expect(menu.getByText('Settings')).toBeTruthy();
    fireEvent.press(menu.getByRole('button', { name: 'Close settings' }));
    expect(menu.queryByTestId('settings-panel')).toBeNull();
  });
});

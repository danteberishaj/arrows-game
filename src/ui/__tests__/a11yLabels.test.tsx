/**
 * A11Y-LABELS: every icon control has a plain-English screen-reader name, and its state, in BOTH ART_ICONS arms.
 * Before: the names were the raw glyphs (‹ 💡 ♪ ☾ ☀, "Continue +♥ (ad)"); TalkBack read "single left-pointing angle
 * quotation mark", "electric light bulb", "eighth note", ... (emulator evidence: artifacts/A11Y-LABELS/).
 * - menu: theme = switch "Dark mode" (checked = Ink Night), sound = switch "Sound" (checked = on), Settings = button;
 * - game: back = button "Back", hint = button "Hint" (disabled while no hint ad is ready), "#" = switch "Grid lines";
 * - lose panel: Continue = button "Continue with one more heart (ad)" (disabled while no rewarded ad is ready);
 * - gallery: back = button "Back";
 * - and no accessible element on those screens is named by a glyph.
 * Visual output is unchanged (labels / roles / states only); that closes on the masked emulator diff.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight, InkNight } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockArt = { ART_ICONS_ENABLED: false };
const mockReady = { rewarded: true, hint: true };

jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));
jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    { ART_ICONS_ENABLED: { get: () => mockArt.ART_ICONS_ENABLED, enumerable: true } },
  ));
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_PANEL_MOTION: { get: () => false, enumerable: true },
      META_BANNER: { get: () => false, enumerable: true },
      META_SETTINGS_SHEET: { get: () => true, enumerable: true },
    },
  ));
jest.mock('../boardGridFlag', () => ({ BOARD_GRID_ENABLED: true }));
jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));
jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return mockReady.rewarded;
    },
    isRewardedReady: (placement?: string) => (placement === 'hint' ? mockReady.hint : mockReady.rewarded),
    subscribeRewardedReady: () => () => undefined,
    registerGameFinished: () => undefined,
    showInterstitialIfDue: async () => undefined,
    showRewarded: async () => false,
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
const { HomeScreen } = require('../HomeScreen') as typeof import('../HomeScreen');
const { GalleryScreen } = require('../GalleryScreen') as typeof import('../GalleryScreen');
const { LOSE_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
const session = require('../gridLinesSession') as typeof import('../gridLinesSession');
/* eslint-enable @typescript-eslint/no-require-imports */

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

let previous: IntStore;
beforeEach(() => {
  mockReady.rewarded = true;
  mockReady.hint = true;
  session.setGridLines(false);
  const store = new MapStore();
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  previous = SaveSystem.useStore(store);
});
afterEach(() => {
  SaveSystem.useStore(previous);
  jest.useRealTimers();
});

/** Glyphs that must never be a screen-reader name (or part of one). */
const GLYPHS = /[‹›💡♪☾☀⚙♥✦★#]/u;

/** Every host element a screen reader stops on: its name is the label, else its text content. */
function accessibleNames(root: ReactTestInstance): { name: string; node: ReactTestInstance }[] {
  const out: { name: string; node: ReactTestInstance }[] = [];
  const text = (n: ReactTestInstance): string =>
    n.children.map((c) => (typeof c === 'string' ? c : text(c))).join('');
  const visit = (n: ReactTestInstance) => {
    if (typeof n.type === 'string' && (n.props.accessible === true || n.props.accessibilityLabel !== undefined)) {
      out.push({ name: n.props.accessibilityLabel ?? text(n), node: n });
    }
    for (const c of n.children) if (typeof c !== 'string') visit(c);
  };
  visit(root);
  return out;
}
const expectNoGlyphNames = (root: ReactTestInstance) => {
  const bad = accessibleNames(root).filter(({ name }) => GLYPHS.test(name) || !/[A-Za-z0-9]/.test(name));
  expect(bad.map((b) => b.name)).toEqual([]);
};

const renderMenu = (dark: boolean, soundOn: boolean) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <HomeScreen
        palette={dark ? InkNight : Daylight}
        dark={dark}
        soundOn={soundOn}
        onPlay={jest.fn()}
        onToggleSound={jest.fn()}
        onToggleTheme={jest.fn()}
      />
    </SafeAreaProvider>,
  );
const renderGame = () => render(<GameScreen palette={Daylight} onHome={jest.fn()} feedbackEnabled={false} />);

describe.each([['ART_ICONS off', false], ['ART_ICONS on', true]] as const)('%s', (_arm, icons) => {
  beforeEach(() => {
    mockArt.ART_ICONS_ENABLED = icons;
  });

  it.each([
    [false, true],
    [false, false],
    [true, true],
    [true, false],
  ])('menu (dark %s, sound %s): theme and sound are named switches with their state; Settings is a button', (dark, soundOn) => {
    jest.useFakeTimers();
    const menu = renderMenu(dark, soundOn);
    const theme = menu.getByRole('switch', { name: 'Dark mode' });
    expect(theme.props.accessibilityState).toEqual({ checked: dark, disabled: false });
    const sound = menu.getByRole('switch', { name: 'Sound' });
    expect(sound.props.accessibilityState).toEqual({ checked: soundOn, disabled: false });
    expect(menu.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expectNoGlyphNames(menu.root);
  });

  it.each([[true], [false]])('game header (hint ad ready %s): Back, Hint (disabled when not ready), Grid lines', (ready) => {
    jest.useFakeTimers();
    mockReady.hint = ready;
    const game = renderGame();
    expect(game.getByRole('button', { name: 'Back' })).toBeTruthy();
    const hint = game.getByRole('button', { name: 'Hint' });
    expect(hint.props.accessibilityState).toEqual({ disabled: !ready });
    const grid = game.getByRole('switch', { name: 'Grid lines' });
    expect(grid.props.accessibilityState).toEqual({ checked: false, disabled: false });
    fireEvent.press(grid);
    expect(game.getByRole('switch', { name: 'Grid lines' }).props.accessibilityState).toEqual({ checked: true, disabled: false });
    expectNoGlyphNames(game.root);
  });

  it.each([[true], [false]])('lose panel (rewarded ready %s): Continue is named in words', (ready) => {
    jest.useFakeTimers();
    mockReady.rewarded = ready;
    const game = renderGame();
    for (let i = 0; i < 3; i += 1) act(() => { mockBoardViewProps!.onBlocked(true); });
    act(() => { jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS); });
    expect(game.getByText('Out of hearts')).toBeTruthy();
    const cont = game.getByRole('button', { name: 'Continue with one more heart (ad)' });
    expect(cont.props.accessibilityState).toEqual({ disabled: !ready });
    expectNoGlyphNames(game.root);
  });

  it('gallery: Back', () => {
    const gallery = render(<GalleryScreen palette={Daylight} onBack={jest.fn()} />);
    expect(gallery.getByRole('button', { name: 'Back' })).toBeTruthy();
    expectNoGlyphNames(gallery.root);
  });
});

/**
 * TF-02 C (owner 2026-10-13): every pressable control on the shipped screens has a role and a spoken label (a toggle
 * also its state), with every player-visible flag of those screens ON so the flagged controls are swept too:
 * splash, menu (+ daily / gallery entries), the Settings sheet (+ TF-01 rows), the game header, the campaign and daily
 * won panels (+ both Share controls), the lost panel, and the gallery. Decorative graphics are hidden. The instrument
 * is `a11yGaps` (a11yAudit.ts); the device check is the uiautomator dump (artifacts/TF-02/a11y-*.xml).
 * `src/ui/ads.tsx` (AdHost) renders only under __DEV__ and is not swept.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight, InkNight } from '../theme';
import { a11yGaps, pressableCount } from './a11yAudit';

let mockBoardViewProps: BoardViewProps | null = null;
jest.mock('../BoardView', () => ({
  BoardView: (props: BoardViewProps) => {
    mockBoardViewProps = props;
    return null;
  },
}));
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    Object.fromEntries(
      ['META_SETTINGS_SHEET', 'META_DAILY', 'META_GALLERY', 'META_SHARE_CARD', 'META_SHARE_CARD_LEVEL', 'META_THEME_SYSTEM',
        'META_SETTINGS_RATE', 'META_SETTINGS_HOW_TO_PLAY'].map((k) => [k, { get: () => true, enumerable: true }]),
    ),
  ));
jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));
jest.mock('../ads', () => ({
  adPrivacyOptionsRequired: () => true,
  openAdPrivacyOptions: async () => undefined,
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

/* eslint-disable @typescript-eslint/no-require-imports */
const { GameScreen } = require('../GameScreen') as typeof import('../GameScreen');
const { HomeScreen } = require('../HomeScreen') as typeof import('../HomeScreen');
const { GalleryScreen } = require('../GalleryScreen') as typeof import('../GalleryScreen');
const { SplashScreen } = require('../SplashScreen') as typeof import('../SplashScreen');
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
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

const DAY = 2450;
let previousStore: IntStore;
let previousClock: () => Date;
beforeEach(() => {
  jest.useFakeTimers();
  const store = new MapStore();
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  store.setInt('arrows_perfect_streak', 3);
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2020, 0, 1 + DAY, 12, 0, 0));
});
afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  jest.useRealTimers();
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const expectSwept = (root: ReactTestInstance, atLeast: number) => {
  expect(a11yGaps(root)).toEqual([]);
  expect(pressableCount(root)).toBeGreaterThanOrEqual(atLeast);
};

describe.each([['Daylight', Daylight, false], ['Ink Night', InkNight, true]] as const)('%s', (_name, palette, dark) => {
  it('splash: the tap-to-skip surface is a named button; the wordmark is one "Arrows" heading', () => {
    const splash = render(<SafeAreaProvider initialMetrics={METRICS}><SplashScreen palette={palette} onDone={jest.fn()} /></SafeAreaProvider>);
    expectSwept(splash.root, 1);
    expect(splash.getByRole('button', { name: 'Skip intro' })).toBeTruthy();
    expect(splash.getByRole('header', { name: 'Arrows' })).toBeTruthy();
  });

  it('menu and the Settings sheet', () => {
    const menu = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HomeScreen palette={palette} dark={dark} soundOn onPlay={jest.fn()} onDaily={jest.fn()} onGallery={jest.fn()}
          onToggleSound={jest.fn()} onToggleTheme={jest.fn()} onHowToPlay={jest.fn()} themeFollowsSystem
          onThemeFollowsSystemChange={jest.fn()} />
      </SafeAreaProvider>,
    );
    expectSwept(menu.root, 6); // theme, sound, Settings, Play, daily, gallery
    expect(menu.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(menu.getByRole('header', { name: 'Arrows' })).toBeTruthy();
    fireEvent.press(menu.getByRole('button', { name: 'Settings' }));
    expectSwept(menu.root, 10);
    expect(menu.getByRole('switch', { name: 'Match phone theme' })).toBeTruthy();
  });

  it('game: header, campaign won panel (Next level + Share), lost panel', () => {
    const game = render(<GameScreen palette={palette} darkMode={dark} onHome={jest.fn()} feedbackEnabled={false} />);
    expectSwept(game.root, 2); // Back, Hint
    const board = mockBoardViewProps!.board;
    act(() => {
      for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(true, 0);
    });
    act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS); });
    expect(game.getByRole('button', { name: 'Next level' })).toBeTruthy();
    expect(game.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(game.getByRole('header', { name: 'Cleared!' })).toBeTruthy();
    expectSwept(game.root, 4);
    game.unmount();

    const lost = render(<GameScreen palette={palette} darkMode={dark} onHome={jest.fn()} feedbackEnabled={false} />);
    for (let i = 0; i < 3; i += 1) act(() => { mockBoardViewProps!.onBlocked(true); });
    act(() => { jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS); });
    expect(lost.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(lost.getByRole('header', { name: 'Out of hearts' })).toBeTruthy();
    expectSwept(lost.root, 4); // Back, Hint, Continue, Retry
  });

  it('game: the daily won panel (Done + Share)', () => {
    const daily = render(<GameScreen palette={palette} darkMode={dark} daily={{ day: DAY }} onHome={jest.fn()} feedbackEnabled={false} />);
    const board = mockBoardViewProps!.board;
    act(() => {
      for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(true, 0);
    });
    act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS); });
    expect(daily.getByRole('button', { name: 'Done' })).toBeTruthy();
    expectSwept(daily.root, 4);
  });

  it('game: the hearts and stars read as words, not as unlabelled shapes', () => {
    const game = render(<GameScreen palette={palette} darkMode={dark} onHome={jest.fn()} feedbackEnabled={false} />);
    expect(game.getByLabelText('3 of 3 hearts left')).toBeTruthy();
    act(() => { mockBoardViewProps!.onBlocked(true); });
    expect(game.getByLabelText('2 of 3 hearts left')).toBeTruthy();
    const board = mockBoardViewProps!.board;
    act(() => {
      for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
      mockBoardViewProps!.onRemoved(true, 0);
    });
    act(() => { jest.advanceTimersByTime(WON_PANEL_DELAY_MS); });
    expect(game.getByLabelText('2 of 3 stars')).toBeTruthy();
  });

  it('gallery', () => {
    const gallery = render(<SafeAreaProvider initialMetrics={METRICS}><GalleryScreen palette={palette} onBack={jest.fn()} /></SafeAreaProvider>);
    expectSwept(gallery.root, 1);
  });
});

describe('the instrument can fail (a positive control)', () => {
  it('flags a bare Pressable with text but no role or label, and a switch without its state', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text, View } = require('react-native') as typeof import('react-native');
    const r = render(<View>
      <Pressable onPress={jest.fn()}><Text>Bare</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Toggle" onPress={jest.fn()} />
      <Pressable accessible={false} onPress={jest.fn()} />
      <View importantForAccessibility="no-hide-descendants"><Pressable onPress={jest.fn()} /></View>
    </View>);
    expect(a11yGaps(r.root)).toEqual([
      { what: 'Bare', missing: ['role', 'label'] },
      { what: '<View>', missing: ['state'] },
    ]);
  });
});

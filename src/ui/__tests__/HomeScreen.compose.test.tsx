/**
 * W4-10: the composed menu, every W4 menu entry at once (META_DAILY, META_GALLERY,
 * META_STREAK_FREEZE, with META_BANNER and META_PRESS_SPRING around them).
 *
 * - All menu flags OFF: the host tree is BASE's. The `all menu flags OFF` snapshots in
 *   __snapshots__/HomeScreen.compose.test.tsx.snap were written by BASE b6bdadc's
 *   HomeScreen.tsx before HomeScreen.tsx was edited (artifacts/W4-10/tdd/).
 * - Flags ON: the daily entry and the gallery entry share ONE row under the Play pill,
 *   separated by the stats line's own `   ·   ` separator; the row is hidden until the
 *   first solve (a fresh menu is BASE's tree).
 * - Each flag OFF (the others ON) gives today's menu for its own element.
 * - The copy register: at most 6 new words on the menu (OWNER-PICKED STARTING VALUE).
 * Layout, overlap and hit areas close only on the emulator dumps in artifacts/W4-10/
 * (jest has no layout engine).
 */
import { act, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { format, plugins } from 'pretty-format';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight, Fonts, InkNight } from '../theme';

type MenuFlag = 'META_DAILY' | 'META_GALLERY' | 'META_STREAK_FREEZE' | 'META_BANNER' | 'META_PRESS_SPRING';
const MENU_FLAGS: MenuFlag[] = ['META_DAILY', 'META_GALLERY', 'META_STREAK_FREEZE', 'META_BANNER', 'META_PRESS_SPRING'];
const mockFlags: Record<MenuFlag, boolean> = {
  META_DAILY: false,
  META_GALLERY: false,
  META_STREAK_FREEZE: false,
  META_BANNER: false,
  META_PRESS_SPRING: false,
};
// Getters, so each test sets the flags it needs (jest.mock is hoisted above mockFlags;
// the value is read only while a test runs). Every other flag keeps its compiled value.
// saveSystem.ts reads META_STREAK_FREEZE once at load (its freeze options), before
// mockFlags exists: that read gets false, as in a flag-OFF build.
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    Object.fromEntries(
      ['META_DAILY', 'META_GALLERY', 'META_STREAK_FREEZE', 'META_BANNER', 'META_PRESS_SPRING'].map((k) => [
        k,
        { get: () => (typeof mockFlags === 'undefined' ? false : mockFlags[k as MenuFlag]), enumerable: true },
      ]),
    ),
  ));

jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));

type BannerProps = { onAdLoaded: (d: { width: number; height: number }) => void };
const mockBanner: { allowed: boolean; requests: number; lastProps: BannerProps | null } = {
  allowed: false,
  requests: 0,
  lastProps: null,
};
jest.mock('../ads', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  function FakeBannerAd(props: BannerProps) {
    mockBanner.lastProps = props;
    return R.createElement(View, { testID: 'banner-ad' });
  }
  return {
    Ads: {
      get bannerAllowed() {
        return mockBanner.allowed;
      },
      subscribeBanner: () => () => undefined,
      bannerRequest() {
        mockBanner.requests += 1;
        if (!mockBanner.allowed) return null;
        return { BannerAd: FakeBannerAd, size: 'ANCHORED_ADAPTIVE_BANNER', unitId: 'test', requestOptions: {}, key: 'k' };
      },
    },
  };
});

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

const SEP = '   ·   ';
const TODAY_LABEL = "Today's board";
const TODAY_DONE = "Today's board · done";
const GALLERY = 'Gallery';

let store: MapStore;
let previousStore: IntStore;
let previousClock: () => Date;

beforeEach(() => {
  jest.useFakeTimers(); // the menu's collection fold waits 2 s; nothing here advances it
  for (const k of MENU_FLAGS) mockFlags[k] = false;
  mockBanner.allowed = false;
  mockBanner.requests = 0;
  mockBanner.lastProps = null;
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousClock = SaveSystem.useClock(() => new Date(2026, 8, 25, 12, 0, 0));
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.useClock(previousClock);
  jest.useRealTimers();
});

type Save = 'fresh' | 'oneSolve' | 'composite' | 'compositeDone';
/** The device captures' seeds (artifacts/W4-10/scripts/menushot.sh). */
function seed(save: Save): void {
  if (save === 'fresh') return;
  const today = SaveSystem.today();
  if (save === 'oneSolve') {
    store.setInt('arrows_current_level', 1);
    store.setInt('arrows_total_solved', 1);
    store.setInt('arrows_day_streak', 1);
    store.setInt('arrows_last_play_day', today);
    store.setInt('arrows_perfect_streak', 1);
    store.setInt('arrows_best_perfect_streak', 1);
    return;
  }
  store.setInt('arrows_current_level', 24);
  store.setInt('arrows_total_solved', 24);
  store.setInt('arrows_day_streak', 6);
  store.setInt('arrows_last_play_day', today);
  store.setInt('arrows_streak_saved_day', today);
  store.setInt('arrows_perfect_streak', 2);
  store.setInt('arrows_best_perfect_streak', 4);
  if (save === 'compositeDone') store.setInt('arrows_daily_last_day', today);
}

function setFlags(on: boolean, except: MenuFlag[] = []): void {
  for (const k of MENU_FLAGS) mockFlags[k] = except.includes(k) ? !on : on;
}

const INSETS = { top: 28, bottom: 56, left: 0, right: 0 }; // emulator-5556 at 360x640 dp (menu.xml dumps)
function renderMenu(dark = false, insets = INSETS) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets }}>
      <HomeScreen
        palette={dark ? InkNight : Daylight}
        dark={dark}
        soundOn
        onPlay={jest.fn()}
        onDaily={jest.fn()}
        onGallery={jest.fn()}
        onToggleSound={jest.fn()}
        onToggleTheme={jest.fn()}
      />
    </SafeAreaProvider>,
  );
}

/** Every string drawn by a Text on the menu, in tree order. */
function menuTexts(menu: ReturnType<typeof render>): string[] {
  return menu.UNSAFE_getAllByType(Text).flatMap((t) => {
    const own = ([] as unknown[]).concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number');
    return own.length ? [own.join('')] : [];
  });
}

/** A word is a whitespace-separated token holding a letter or a digit (· and glyphs are not words). */
function menuWords(menu: ReturnType<typeof render>): string[] {
  return menuTexts(menu).join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function multisetMinus(a: string[], b: string[]): string[] {
  const left = [...b];
  return a.filter((w) => {
    const i = left.indexOf(w);
    if (i >= 0) {
      left.splice(i, 1);
      return false;
    }
    return true;
  });
}

/** The snapshot serialisation (function props print by name, so two renders compare equal). */
const tree = (menu: ReturnType<typeof render>) => format(menu.toJSON(), { plugins: [plugins.ReactTestComponent] });

const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) as Record<string, unknown>;

/** The nearest host ancestor (or self) whose flattened style defines `key`. */
function withStyle(node: ReactTestInstance, key: string): ReactTestInstance {
  for (let n: ReactTestInstance | null = node; n; n = n.parent) {
    if (typeof n.type === 'string' && n.props.style && key in flat(n)) return n;
  }
  throw new Error(`no ancestor with style.${key}`);
}

describe('all menu flags OFF: the BASE menu', () => {
  const states: Array<[Save, boolean]> = [
    ['fresh', false],
    ['oneSolve', false],
    ['composite', false],
    ['compositeDone', false],
    ['fresh', true],
    ['composite', true],
  ];
  test.each(states)('%s (dark %s): tree identical to BASE', (save, dark) => {
    seed(save);
    const menu = renderMenu(dark);
    expect(menu.queryByTestId('menu-entry-row')).toBeNull();
    expect(menu.toJSON()).toMatchSnapshot();
  });

  test('streak saved is neither shown nor consumed with the flag OFF', () => {
    seed('composite');
    const menu = renderMenu();
    expect(menu.queryByText(/streak saved/)).toBeNull();
    expect(SaveSystem.streakSavedDay).toBe(SaveSystem.today());
  });
});

describe('every menu flag ON', () => {
  beforeEach(() => setFlags(true));

  test('the whole row is hidden until the first solve: a fresh menu is the BASE tree', () => {
    mockFlags.META_BANNER = false; // the banner's own branch changes the stats Text even when empty
    mockFlags.META_PRESS_SPRING = false;
    const on = tree(renderMenu());
    setFlags(false);
    const off = tree(renderMenu());
    expect(on).toEqual(off);
  });

  test('after a solve: daily and gallery share one row, separated by the stats line separator', () => {
    seed('oneSolve');
    const menu = renderMenu();
    const row = menu.getByTestId('menu-entry-row');
    expect(flat(row).flexDirection).toBe('row');

    const daily = within(row).getByRole('button', { name: TODAY_LABEL });
    const gallery = within(row).getByRole('button', { name: GALLERY });
    const sep = within(row).getByTestId('menu-entry-sep');
    expect(sep.props.children).toBe(SEP);
    // order: daily, separator, gallery (and nothing else in the row)
    const rowTexts = row.findAllByType(Text).map((t) => ([] as unknown[]).concat(t.props.children).join(''));
    expect(rowTexts).toEqual([TODAY_LABEL, SEP, GALLERY]);
    expect(daily).toBeTruthy();
    expect(gallery).toBeTruthy();

    // the separator reads as the entries' own text (inkDim, same font and size), is not a control
    // and is not read out
    const sepStyle = flat(sep);
    const labelStyle = flat(within(row).getByText(GALLERY));
    expect(sepStyle.color).toBe(Daylight.inkDim);
    expect(sepStyle.fontFamily).toBe(labelStyle.fontFamily);
    expect(sepStyle.fontSize).toBe(labelStyle.fontSize);
    expect(Object.values(Fonts)).toContain(sepStyle.fontFamily);
    expect(sep.props.accessible).toBe(false);
    expect(sep.props.importantForAccessibility).toBe('no');
    expect(sep.props.onPress).toBeUndefined();

    // the separator IS the space between the two words: no padding on the facing sides
    expect(flat(daily).paddingRight).toBe(0);
    expect(flat(gallery).paddingLeft).toBe(0);
    for (const c of [daily, gallery]) {
      expect(flat(c).minHeight).toBeGreaterThanOrEqual(44);
      expect(flat(c).minWidth).toBeGreaterThanOrEqual(44);
      expect(flat(c).backgroundColor).toBeUndefined(); // no pill
    }
  });

  test("today's board done: the done label, the separator, then Gallery", () => {
    seed('compositeDone');
    const menu = renderMenu();
    const row = menu.getByTestId('menu-entry-row');
    expect(within(row).queryByRole('button', { name: TODAY_LABEL })).toBeNull();
    expect(within(row).getByText(TODAY_DONE)).toBeTruthy();
    expect(within(row).getByTestId('menu-entry-sep')).toBeTruthy();
    expect(within(row).getByRole('button', { name: GALLERY })).toBeTruthy();
  });

  test('the Normal -> Play gap is the BASE 56 dp again (the W4-06 36 dp stopgap is gone)', () => {
    seed('composite');
    const menu = renderMenu();
    expect(flat(withStyle(menu.getByText('Level 25'), 'marginBottom')).marginBottom).toBe(56);
  });

  test('the column is centred between the header buttons and the stats band (banner reserve included)', () => {
    mockBanner.allowed = true;
    seed('composite');
    const menu = renderMenu();
    act(() => mockBanner.lastProps!.onAdLoaded({ width: 360, height: 56 }));
    const column = flat(menu.getByTestId('menu-column'));
    // header: insets.top + 14 + a 44 dp button; stats band: insets.bottom + 32 + two 13 sp lines at the
    // system font scale (jest's fontScale is 2) + the banner reserve
    expect(column.paddingTop).toBe(28 + 14 + 44);
    expect(column.paddingBottom).toBe(56 + 32 + Math.ceil(2 * 13 * 2 * 1.25) + 56);
    // a banner of another height never moves the column (the reserve is fixed for the mount)
    act(() => mockBanner.lastProps!.onAdLoaded({ width: 360, height: 64 }));
    expect(flat(menu.getByTestId('menu-column'))).toEqual(column);
  });

  test('the column box never takes a touch meant for the header buttons it reaches over', () => {
    // emulator-5556, first W4-10 build: without box-none a tap on ♪ inside the column's padded box
    // did nothing (artifacts/W4-10/layout/header-tap-bug/)
    seed('composite');
    const menu = renderMenu();
    expect(menu.getByTestId('menu-column').props.pointerEvents).toBe('box-none');
  });

  test('the stats line keeps its place and wraps centred inside the side margins', () => {
    seed('composite');
    const menu = renderMenu();
    const stats = menu.getByText(/puzzles solved/);
    const style = flat(stats);
    expect(style.bottom).toBe(56 + 32); // unchanged anchor (banner branch: lifted by transform only)
    expect(style.position).toBe('absolute');
    expect(style.textAlign).toBe('center');
    expect(style.left).toBe(18);
    expect(style.right).toBe(18);
  });
  test('the composed stats line may break only after a separator: a part is never split', () => {
    seed('composite');
    const menu = renderMenu();
    // raw children: RNTL's text matchers fold U+00A0 into a space, so read the string itself
    const raw = ([] as unknown[]).concat(menu.getByText(/puzzles solved/).props.children).join('');
    const NB = '\u00A0';
    const parts = ['24 puzzles solved', '6-day streak', 'best perfect run 4', 'streak saved'];
    expect(raw).toBe(parts.map((part) => part.replace(/ /g, NB)).join(`${NB}${NB}${NB}·   `));
  });
});

describe('each flag OFF (the others ON) gives today\'s menu for its element', () => {
  test('META_DAILY off: no daily entry and no separator; Gallery alone', () => {
    setFlags(true, ['META_DAILY']);
    seed('composite');
    const menu = renderMenu();
    expect(menu.queryByText(/Today's board/)).toBeNull();
    expect(menu.queryByTestId('menu-entry-sep')).toBeNull();
    expect(menu.getByRole('button', { name: GALLERY })).toBeTruthy();
  });

  test('META_GALLERY off: no gallery entry and no separator; the daily entry alone', () => {
    setFlags(true, ['META_GALLERY']);
    seed('composite');
    const menu = renderMenu();
    expect(menu.queryByText(GALLERY)).toBeNull();
    expect(menu.queryByTestId('menu-entry-sep')).toBeNull();
    expect(menu.getByRole('button', { name: TODAY_LABEL })).toBeTruthy();
  });

  test('META_STREAK_FREEZE off: no "streak saved" and the pending rescue is not consumed', () => {
    setFlags(true, ['META_STREAK_FREEZE']);
    seed('composite');
    const menu = renderMenu();
    expect(menu.getByText('24 puzzles solved   ·   6-day streak   ·   best perfect run 4')).toBeTruthy();
    expect(SaveSystem.streakSavedDay).toBe(SaveSystem.today());
  });

  test('META_BANNER off: no banner, the ad module is never asked, the stats line sits 32 dp above the inset', () => {
    setFlags(true, ['META_BANNER']);
    mockBanner.allowed = true;
    seed('composite');
    const menu = renderMenu();
    expect(menu.queryByTestId('menu-banner')).toBeNull();
    expect(mockBanner.requests).toBe(0);
    expect(flat(menu.getByText(/puzzles solved/)).bottom).toBe(56 + 32);
  });

  test('META_PRESS_SPRING off: the Play pill snaps its scale as today', () => {
    setFlags(true, ['META_PRESS_SPRING']);
    seed('composite');
    const menu = renderMenu();
    const pill = withStyle(menu.getByText('Play'), 'borderRadius');
    expect(flat(pill).width).toBe(250);
    expect(flat(pill).transform).toEqual([{ scale: 1 }]);
  });
});

describe('copy register (words the W4 entries add to the menu)', () => {
  const words = (on: boolean, save: Save): string[] => {
    setFlags(on);
    store = new MapStore();
    SaveSystem.useStore(store);
    seed(save);
    const menu = renderMenu();
    const w = menuWords(menu);
    menu.unmount();
    return w;
  };

  test('at most 6 new words (OWNER-PICKED STARTING VALUE), even in the widest state', () => {
    const added = multisetMinus(words(true, 'compositeDone'), words(false, 'compositeDone'));
    expect(added.sort()).toEqual(["Gallery", "Today's", 'board', 'done', 'saved', 'streak'].sort());
    expect(added.length).toBeLessThanOrEqual(6); // OWNER-PICKED STARTING VALUE
    expect(multisetMinus(words(false, 'compositeDone'), words(true, 'compositeDone'))).toEqual([]);
  });

  test.each<[string, Save, boolean, MenuFlag[], number]>([
    // [state, save, flags on, flags forced to the other value, visible words]
    ['all OFF, fresh', 'fresh', false, [], 5],
    ['all OFF, composite save', 'composite', false, [], 14],
    ['all ON, fresh', 'fresh', true, [], 5],
    ['all ON, one solve', 'oneSolve', true, [], 11],
    ['all ON, composite (daily available)', 'composite', true, [], 19],
    ['all ON, composite (daily done)', 'compositeDone', true, [], 20],
    ['only META_DAILY', 'composite', false, ['META_DAILY'], 16],
    ['only META_GALLERY', 'composite', false, ['META_GALLERY'], 15],
    ['only META_STREAK_FREEZE', 'composite', false, ['META_STREAK_FREEZE'], 16],
  ])('%s: %#', (_name, save, on, except, count) => {
    setFlags(on, except);
    seed(save);
    const menu = renderMenu();
    expect(menuWords(menu)).toHaveLength(count);
  });
});

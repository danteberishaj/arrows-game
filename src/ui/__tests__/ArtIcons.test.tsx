/**
 * W5-02 (ART_ICONS_ENABLED) wiring: HeaderButton, the menu's theme and sound toggles, the game header's back and hint
 * buttons, the gallery's back button, the win stars, the perfect-streak line and the Continue label. The icons' path
 * data is icons.test.ts's; whether they replace the OS emoji on a device, sit centred, and make the buttons circles
 * closes only on the emulator captures in artifacts/W5-02/. Here:
 * - flag OFF: every site renders its text glyph exactly as before (no Svg icon, `size / 3` corners, the W0-06 strike);
 * - flag ON: the named icon in the glyph's colour, `size / 2` corners on every HeaderButton, no strike over an icon
 *   (sound off is its own icon), the strike kept on the text-only "#".
 * - A11Y-LABELS: in both arms every button is named in words (a11yLabels.test.tsx), never by its glyph.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BoardViewProps } from '../BoardView';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { Daylight, InkNight, type Palette } from '../theme';

let mockBoardViewProps: BoardViewProps | null = null;
const mockArt = { ART_ICONS_ENABLED: false };
const mockReady = { rewarded: true };

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
    },
  ));
jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));
jest.mock('../ads', () => ({
  Ads: {
    get rewardedReady() {
      return mockReady.rewarded;
    },
    isRewardedReady: () => mockReady.rewarded,
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
const { HeaderButton } = require('../HeaderButton') as typeof import('../HeaderButton');
const { ICONS, ICON_STROKE } = require('../icons') as typeof import('../icons');
const { LOSE_PANEL_DELAY_MS, WON_PANEL_DELAY_MS } = require('../gameSessionLifecycle') as typeof import('../gameSessionLifecycle');
/* eslint-enable @typescript-eslint/no-require-imports */

type IconName = keyof typeof ICONS;

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
  mockArt.ART_ICONS_ENABLED = false;
  mockReady.rewarded = true;
  const store = new MapStore();
  store.setInt('arrows_current_level', 7);
  store.setInt('arrows_total_solved', 20);
  store.setInt('arrows_ftue_stage', 3);
  store.setInt('arrows_perfect_streak', 3);
  previous = SaveSystem.useStore(store);
});
afterEach(() => {
  SaveSystem.useStore(previous);
});

type Json = ReactTestRendererJSON;
function walk(node: Json | string | null, visit: (n: Json) => void) {
  if (node === null || typeof node === 'string') return;
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}
function find(tree: Json | Json[] | null, pred: (n: Json) => boolean): Json[] {
  const out: Json[] = [];
  for (const t of Array.isArray(tree) ? tree : [tree]) walk(t, (n) => { if (pred(n)) out.push(n); });
  return out;
}
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const strings = (n: Json): string[] => {
  const out: string[] = [];
  walk(n, (x) => { for (const c of x.children ?? []) if (typeof c === 'string') out.push(c); });
  return out;
};
/** The `d` of every Path under `n`, in order. */
const pathDs = (n: Json) => find(n, (x) => x.type === 'RNSVGPath').map((x) => x.props.d as string);
const iconDs = (name: IconName) => ICONS[name].map((p) => p.d);
/** Every host node that is a HeaderButton's pressable (a square with a 1 dp border). */
const buttons = (tree: Json | Json[] | null) =>
  find(tree, (n) => n.props.accessible !== undefined && flat(n.props.style).borderWidth === 1 && flat(n.props.style).width === flat(n.props.style).height);
/** The Svg host nodes that draw exactly the named icon. */
const iconsNamed = (tree: Json | Json[] | null, name: IconName) =>
  find(tree, (n) => n.type === 'RNSVGSvgView' && JSON.stringify(pathDs(n)) === JSON.stringify(iconDs(name)));
/** The colour a Path is painted with (react-native-svg hands the native view a processed colour). */
const paint = (n: Json) => {
  const path = find(n, (x) => x.type === 'RNSVGPath')[0];
  return path.props.stroke ?? path.props.fill;
};
const processed = (hex: string) => ({ payload: Number.parseInt(`ff${hex.slice(1)}`, 16) >>> 0, type: 0 });

describe('HeaderButton', () => {
  const noop = () => undefined;

  it('flag OFF: the icon prop changes nothing (text glyph, size / 3 corners, the strike when off)', () => {
    for (const off of [false, true]) {
      const plain = render(<HeaderButton label="♪" accessibilityLabel="Sound" off={off} palette={Daylight} onPress={noop} size={44} />).toJSON();
      const withIcon = render(<HeaderButton label="♪" accessibilityLabel="Sound" icon={off ? 'soundOff' : 'soundOn'} off={off} palette={Daylight} onPress={noop} size={44} />).toJSON();
      expect(JSON.stringify(withIcon)).toBe(JSON.stringify(plain));
      const [b] = buttons(withIcon as Json);
      expect(flat(b.props.style).borderRadius).toBe(44 / 3);
      expect(strings(b)).toEqual(['♪']);
      expect(find(b, (n) => n.type === 'RNSVGLine')).toHaveLength(off ? 1 : 0);
      expect(b.props.accessibilityLabel).toBe('Sound'); // A11Y-LABELS: the words, never the glyph
    }
  });

  it('flag ON: the icon in the glyph colour replaces the text, the button is a circle, named in words', () => {
    mockArt.ART_ICONS_ENABLED = true;
    const tree = render(<HeaderButton label="‹" icon="back" accessibilityLabel="Back" palette={Daylight} onPress={noop} />).toJSON() as Json;
    const [b] = buttons(tree);
    expect(flat(b.props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });
    expect(strings(b)).toEqual([]);
    expect(b.props.accessibilityLabel).toBe('Back'); // A11Y-LABELS (was the glyph '‹')
    const [svg] = iconsNamed(b, 'back');
    expect(svg.props).toMatchObject({ bbWidth: 18, bbHeight: 18 });
    expect(paint(svg)).toEqual(processed(Daylight.accentCore));
    expect(find(b, (n) => n.type === 'RNSVGPath')[0].props.strokeWidth).toBe(ICON_STROKE);
  });

  it('flag ON: an explicit accessibility label wins over the glyph', () => {
    mockArt.ART_ICONS_ENABLED = true;
    const tree = render(<HeaderButton label="‹" icon="back" accessibilityLabel="Back" palette={Daylight} onPress={noop} />).toJSON() as Json;
    expect(buttons(tree)[0].props.accessibilityLabel).toBe('Back');
  });

  it('flag ON: sound off is the slashed icon in glyphOff with NO strike over it; the text-only "#" keeps its strike', () => {
    mockArt.ART_ICONS_ENABLED = true;
    const sound = render(<HeaderButton label="♪" accessibilityLabel="Sound" icon="soundOff" off palette={InkNight} onPress={noop} size={44} />).toJSON() as Json;
    expect(iconsNamed(sound, 'soundOff')).toHaveLength(1);
    expect(paint(iconsNamed(sound, 'soundOff')[0])).toEqual(processed(InkNight.glyphOff));
    expect(find(sound, (n) => n.type === 'RNSVGLine')).toHaveLength(0);
    const grid = render(<HeaderButton label="#" accessibilityLabel="Grid lines" off palette={InkNight} onPress={noop} size={44} />).toJSON() as Json;
    const [g] = buttons(grid);
    expect(flat(g.props.style).borderRadius).toBe(22);
    expect(strings(g)).toEqual(['#']);
    expect(find(g, (n) => n.type === 'RNSVGLine')).toHaveLength(1);
  });

  it('flag ON: a disabled icon is glyphOff at full opacity (the icon takes the token; the emoji needed dimming)', () => {
    mockArt.ART_ICONS_ENABLED = true;
    const tree = render(<HeaderButton label="💡" icon="hint" accessibilityLabel="Hint" disabled palette={Daylight} onPress={noop} />).toJSON() as Json;
    const [svg] = iconsNamed(tree, 'hint');
    expect(paint(svg)).toEqual(processed(Daylight.glyphOff));
    expect(find(tree, (n) => flat(n.props.style).opacity !== undefined && flat(n.props.style).opacity !== 1)).toHaveLength(0);
  });
});

function renderMenu(dark: boolean, soundOn: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 28, bottom: 56, left: 0, right: 0 } }}>
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
}

describe('menu toggles', () => {
  it.each([
    ['Daylight, sound on', false, true, '☾', 'moon', 'soundOn'],
    ['Daylight, sound off', false, false, '☾', 'moon', 'soundOff'],
    ['Ink Night, sound on', true, true, '☀', 'sun', 'soundOn'],
    ['Ink Night, sound off', true, false, '☀', 'sun', 'soundOff'],
  ] as const)('%s', (_n, dark, soundOn, themeGlyph, themeIcon, soundIcon) => {
    const off = renderMenu(dark, soundOn).toJSON() as Json;
    const [t0, s0] = buttons(off);
    expect([strings(t0), strings(s0)]).toEqual([[themeGlyph], ['♪']]);
    expect(find(s0, (n) => n.type === 'RNSVGLine')).toHaveLength(soundOn ? 0 : 1); // W0-06's strike
    expect([t0, s0].map((b) => flat(b.props.style).borderRadius)).toEqual([44 / 3, 44 / 3]);

    mockArt.ART_ICONS_ENABLED = true;
    const on = renderMenu(dark, soundOn).toJSON() as Json;
    const [t1, s1] = buttons(on);
    expect([t1, s1].map((b) => flat(b.props.style).borderRadius)).toEqual([22, 22]);
    expect([strings(t1), strings(s1)]).toEqual([[], []]);
    expect(iconsNamed(t1, themeIcon)).toHaveLength(1);
    expect(iconsNamed(s1, soundIcon)).toHaveLength(1);
    expect(find(s1, (n) => n.type === 'RNSVGLine')).toHaveLength(0);
    // A11Y-LABELS: named in words in both arms (the glyph was the name ON, the text child OFF).
    expect([t0.props.accessibilityLabel, s0.props.accessibilityLabel]).toEqual(['Dark mode', 'Sound']);
    expect([t1.props.accessibilityLabel, s1.props.accessibilityLabel]).toEqual(['Dark mode', 'Sound']);
  });
});

function renderGame(palette: Palette) {
  return render(<GameScreen palette={palette} onHome={jest.fn()} feedbackEnabled={false} />);
}
type Screen = ReturnType<typeof renderGame>;
function win(screen: Screen) {
  const board = mockBoardViewProps!.board;
  act(() => {
    for (const arrow of [...board.arrows()]) board.tryRemove(arrow);
    mockBoardViewProps!.onRemoved(true, 0);
  });
  act(() => {
    jest.advanceTimersByTime(WON_PANEL_DELAY_MS + 3000);
  });
  expect(screen.getByText('Cleared!')).toBeTruthy();
}
function lose(screen: Screen) {
  for (let i = 0; i < 3; i += 1) act(() => { mockBoardViewProps!.onBlocked(true); });
  act(() => {
    jest.advanceTimersByTime(LOSE_PANEL_DELAY_MS);
  });
  expect(screen.getByText('Out of hearts')).toBeTruthy();
}

/** The Continue label's heart icon (16 dp); the header's heart pips draw the same path at 22 dp. */
const continueHearts = (tree: Json) => iconsNamed(tree, 'heart').filter((n) => n.props.bbWidth === 16);

describe('game screen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([['Daylight', Daylight], ['Ink Night', InkNight]] as const)('%s header: back and hint', (_n, palette) => {
    const off = renderGame(palette).toJSON() as Json;
    const offButtons = buttons(off).filter((b) => flat(b.props.style).width === 36);
    expect(offButtons.map(strings)).toEqual([['‹'], ['💡']]);
    expect(iconsNamed(off, 'back').length + iconsNamed(off, 'hint').length).toBe(0);

    mockArt.ART_ICONS_ENABLED = true;
    const on = renderGame(palette).toJSON() as Json;
    const onButtons = buttons(on).filter((b) => flat(b.props.style).width === 36);
    expect(onButtons.map(strings)).toEqual([[], []]);
    expect(onButtons.map((b) => flat(b.props.style).borderRadius)).toEqual([18, 18]);
    expect(iconsNamed(onButtons[0], 'back')).toHaveLength(1);
    expect(iconsNamed(onButtons[1], 'hint')).toHaveLength(1);
    expect(onButtons.map((b) => b.props.accessibilityLabel)).toEqual(['Back', 'Hint']); // A11Y-LABELS (were the glyphs)
  });

  it.each([['Daylight', Daylight], ['Ink Night', InkNight]] as const)('%s win panel: stars and the streak line', (_n, palette) => {
    const offScreen = renderGame(palette);
    win(offScreen);
    const off = offScreen.toJSON() as Json;
    const offStars = find(off, (n) => n.type === 'Text' && strings(n).join('') === '★');
    expect(offStars).toHaveLength(3);
    // The seeded streak of 3 becomes 4 with this perfect clear.
    expect(offScreen.getByText('✦ 4 perfect in a row')).toBeTruthy();
    expect(iconsNamed(off, 'star')).toHaveLength(0);
    offScreen.unmount();

    mockArt.ART_ICONS_ENABLED = true;
    const onScreen = renderGame(palette);
    win(onScreen);
    const on = onScreen.toJSON() as Json;
    expect(find(on, (n) => n.type === 'Text' && strings(n).join('') === '★')).toHaveLength(0);
    const stars = iconsNamed(on, 'star');
    expect(stars.map((s) => s.props.bbWidth)).toEqual([34, 44, 34]);
    // Same earned / unearned colours as the glyphs, and each icon sits in a box of the glyph's line height.
    expect(stars.map(paint)).toEqual(offStars.map((t) => processed(flat(t.props.style).color as string)));
    expect(offStars.map((t) => flat(t.props.style).lineHeight)).toEqual([40, 50, 40]);
    const sparkle = iconsNamed(on, 'sparkle');
    expect(sparkle).toHaveLength(1);
    expect(paint(sparkle[0])).toEqual(processed(palette.accentText));
    // (The OFF clear above made the streak 4; this clear makes it 5.)
    expect(onScreen.getByText('5 perfect in a row')).toBeTruthy();
    expect(onScreen.queryByText(/✦/)).toBeNull();
  });

  it.each([
    ['Daylight, ad ready', Daylight, true],
    ['Daylight, no ad', Daylight, false],
    ['Ink Night, ad ready', InkNight, true],
  ] as const)('%s lose panel: the Continue label', (_n, palette, ready) => {
    mockReady.rewarded = ready;
    const offScreen = renderGame(palette);
    lose(offScreen);
    expect(offScreen.getByText('Continue +♥ (ad)')).toBeTruthy();
    expect(continueHearts(offScreen.toJSON() as Json)).toHaveLength(0);
    offScreen.unmount();

    mockArt.ART_ICONS_ENABLED = true;
    const onScreen = renderGame(palette);
    lose(onScreen);
    expect(onScreen.queryByText(/♥/)).toBeNull();
    const label = onScreen.getByText('Continue +');
    expect(onScreen.getByText(' (ad)')).toBeTruthy();
    const ink = ready ? palette.inkOnAccent : palette.inkDim;
    expect(flat(label.props.style).color).toBe(ink);
    const hearts = continueHearts(onScreen.toJSON() as Json);
    expect(hearts).toHaveLength(1);
    expect(paint(hearts[0])).toEqual(processed(ink));
    expect(onScreen.getByLabelText('Continue with one more heart (ad)')).toBeTruthy(); // A11Y-LABELS (was 'Continue +♥ (ad)')
  });
});

describe('gallery', () => {
  it('back: text ‹ OFF, the back icon ON, labelled "Back" either way', () => {
    const tree = () => render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 28, bottom: 56, left: 0, right: 0 } }}>
        <GalleryScreen palette={Daylight} onBack={jest.fn()} />
      </SafeAreaProvider>,
    ).toJSON() as Json;
    const [b0] = buttons(tree());
    expect(strings(b0)).toEqual(['‹']);
    expect(flat(b0.props.style).borderRadius).toBe(12);
    mockArt.ART_ICONS_ENABLED = true;
    const [b1] = buttons(tree());
    expect(strings(b1)).toEqual([]);
    expect(iconsNamed(b1, 'back')).toHaveLength(1);
    expect(flat(b1.props.style).borderRadius).toBe(18);
    expect(b1.props.accessibilityLabel).toBe('Back');
  });
});

it('Text is still imported by the screens under test (sanity for the host-node queries)', () => {
  expect(Text).toBeDefined();
});

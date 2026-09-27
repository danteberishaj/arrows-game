/**
 * W5-14 (ART_PAPER_TEXTURE_ENABLED, menu only) wiring in HomeScreen. What the texture looks like (tint, opacity,
 * tiling, seams) and what it costs per frame close only on the emulator captures and the A/B/A in artifacts/W5-14/.
 * Here, for both themes, with the W4 menu flags off (the BASE menu) and on (the composed menu):
 * - flag OFF: no texture layer, and the tree is the same as with the layer taken out of the flag-ON tree;
 * - flag ON: exactly one Image, the FIRST child of the menu root, absolute fill AND width/height 100% (the emulator
 *   showed that an Image keeps its source's size otherwise), resizeMode "repeat", tinted with the palette's `ink`, at
 *   ART_PAPER_TEXTURE_OPACITY.
 * (No word of the asset's name appears in this file: W5-14's grep gate keeps it to HomeScreen.tsx and artConfig.ts.)
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { HomeScreen } from '../HomeScreen';
import { Daylight, InkNight } from '../theme';

const mockArt = { ART_PAPER_TEXTURE_ENABLED: false };
const mockFlags = { META_DAILY: false, META_GALLERY: false };
jest.mock('../artConfig', () =>
  Object.defineProperties(
    { ...jest.requireActual('../artConfig') },
    { ART_PAPER_TEXTURE_ENABLED: { get: () => mockArt.ART_PAPER_TEXTURE_ENABLED, enumerable: true } },
  ));
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_DAILY: { get: () => (typeof mockFlags === 'undefined' ? false : mockFlags.META_DAILY), enumerable: true },
      META_GALLERY: { get: () => (typeof mockFlags === 'undefined' ? false : mockFlags.META_GALLERY), enumerable: true },
      META_BANNER: { get: () => false, enumerable: true },
    },
  ));
jest.mock('../ftueConfig', () => ({ ...jest.requireActual('../ftueConfig'), FTUE_ENABLED: false }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ART_PAPER_TEXTURE_OPACITY } = require('../artConfig') as typeof import('../artConfig');

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
  mockArt.ART_PAPER_TEXTURE_ENABLED = false;
  const store = new MapStore();
  store.setInt('arrows_current_level', 5);
  store.setInt('arrows_total_solved', 5);
  previous = SaveSystem.useStore(store);
});
afterEach(() => {
  SaveSystem.useStore(previous);
});

function renderMenu(dark: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 28, bottom: 56, left: 0, right: 0 } }}>
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

/** The menu root: the first host View that paints the palette's `bg`. */
function menuRoot(tree: ReactTestRendererJSON, bg: string): ReactTestRendererJSON {
  const visit = (n: ReactTestRendererJSON): ReactTestRendererJSON | null => {
    if (n.type === 'View' && (StyleSheet.flatten(n.props.style) as { backgroundColor?: string } | undefined)?.backgroundColor === bg) return n;
    for (const c of n.children ?? []) if (typeof c !== 'string') { const f = visit(c); if (f) return f; }
    return null;
  };
  const root = visit(tree);
  if (!root) throw new Error('no menu root');
  return root;
}

describe.each([false, true])('W4 menu flags %s', (menuFlags) => {
  beforeEach(() => {
    mockFlags.META_DAILY = menuFlags;
    mockFlags.META_GALLERY = menuFlags;
  });

  it.each([['Daylight', false], ['Ink Night', true]] as const)('%s: flag OFF has no texture layer', (_n, dark) => {
    const menu = renderMenu(dark);
    expect(menu.queryByTestId('paper-texture')).toBeNull();
    expect(menu.UNSAFE_queryAllByType(Image).every((img) => img.props.testID !== 'paper-texture')).toBe(true);
  });

  it.each([['Daylight', false], ['Ink Night', true]] as const)('%s: flag ON adds one tinted, repeating, full-bleed first child', (_n, dark) => {
    const palette = dark ? InkNight : Daylight;
    mockArt.ART_PAPER_TEXTURE_ENABLED = true;
    const menu = renderMenu(dark);
    const layers = menu.UNSAFE_queryAllByType(Image).filter((img) => img.props.testID === 'paper-texture');
    expect(layers).toHaveLength(1);
    const layer = layers[0];
    expect(layer.props.resizeMode).toBe('repeat');
    const style = StyleSheet.flatten(layer.props.style) as Record<string, unknown>;
    // width/height 100% as well: RN gives an Image its static source's size as a default width/height, which beats
    // left/right/top/bottom (on the emulator a layer without them drew one tile in the corner).
    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', tintColor: palette.ink, opacity: ART_PAPER_TEXTURE_OPACITY });
    const root = menuRoot(menu.toJSON() as ReactTestRendererJSON, palette.bg);
    const first = root.children![0] as ReactTestRendererJSON;
    expect(first.props.testID).toBe('paper-texture');
  });

  it.each([['Daylight', false], ['Ink Night', true]] as const)('%s: taking the layer out of the ON tree gives the OFF tree', (_n, dark) => {
    const palette = dark ? InkNight : Daylight;
    const off = JSON.stringify(renderMenu(dark).toJSON());
    mockArt.ART_PAPER_TEXTURE_ENABLED = true;
    const onTree = renderMenu(dark).toJSON() as ReactTestRendererJSON;
    const root = menuRoot(onTree, palette.bg);
    const before = root.children!.length;
    root.children = root.children!.filter((c) => typeof c === 'string' || c.props.testID !== 'paper-texture');
    expect(root.children.length).toBe(before - 1);
    expect(JSON.stringify(onTree)).toBe(off);
  });
});

it('the opacity is a candidate of the owner grid (0.02 / 0.04 / 0.06 / 0.08)', () => {
  expect([0.02, 0.04, 0.06, 0.08]).toContain(ART_PAPER_TEXTURE_OPACITY);
});

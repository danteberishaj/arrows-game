/**
 * W4-09 (META_GALLERY): the shape gallery, against the real SaveSystem over an
 * in-memory store. What this file cannot see — legibility at a real density,
 * filled versus outlined in greyscale, the scroll, a tile tap on the real
 * renderer doing nothing, Android back — closes on the emulator captures in
 * artifacts/W4-09/. Here:
 * - one tile per non-retired catalogue shape a player can be dealt (W3-18: a
 *   catalogue id awaiting the owner's recognition test has none), in catalogue order: collected =
 *   the tile path filled in `ink` (even-odd) with the display name in `inkDim`
 *   below; not collected = the same path outlined in `pipSpent`, no fill, no
 *   name; retired and not collected = no tile;
 * - one count line `N of M` (M = non-retired catalogue length), the only
 *   digits on the screen: no level numbers, stars or scores;
 * - nothing on the wall is pressable: the back control is the only button;
 * - the ‹ button and Android's hardware back return to the menu;
 * - opening the gallery runs the collection fold from the first frame (no
 *   2 s menu delay), and the wall shows the bits as they arrive.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { BackHandler, StyleSheet, Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';
import { SHAPE_CATALOGUE } from '../../core/shapeCatalogue';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { GALLERY_TILE_DP, galleryTilePath } from '../galleryLayout';
import { GalleryScreen, GALLERY_OUTLINE_DP } from '../GalleryScreen';
import { Daylight, Fonts, InkNight, type Palette } from '../theme';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 640, scale: 3, fontScale: 1 }),
}));

const mockCatalogue = { retired: new Set<string>(), extra: [] as string[] };
jest.mock('../../core/shapeCatalogue', () => {
  const actual = jest.requireActual('../../core/shapeCatalogue');
  return Object.defineProperties(
    { ...actual },
    {
      RETIRED_SHAPE_IDS: { get: () => mockCatalogue.retired, enumerable: true },
      // W3-18: ids appended to the catalogue that no pool deals yet.
      SHAPE_CATALOGUE: {
        get: () => (mockCatalogue.extra.length === 0
          ? actual.SHAPE_CATALOGUE
          : [...actual.SHAPE_CATALOGUE, ...mockCatalogue.extra]),
        enumerable: true,
      },
    },
  );
});

const mockFlags = { COLLECTION_SYNC_ENABLED: true };
jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      COLLECTION_SYNC_ENABLED: { get: () => mockFlags.COLLECTION_SYNC_ENABLED, enumerable: true },
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

let store: MapStore;
let previousStore: IntStore;
let previousHealthy: boolean;
let onBack: jest.Mock;
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackListener[];
let backRemoved: number;

function seen(...ids: string[]): void {
  let lo = 0;
  let hi = 0;
  for (const id of ids) {
    const i = SHAPE_CATALOGUE.indexOf(id);
    if (i < 30) lo |= 1 << i;
    else hi |= 1 << (i - 30);
  }
  store.setInt('arrows_shapes_seen_lo', lo >>> 0);
  store.setInt('arrows_shapes_seen_hi', hi >>> 0);
}

const renderGallery = (palette: Palette = Daylight) =>
  render(<GalleryScreen palette={palette} onBack={onBack} />);

/**
 * Every tile in render order: its id (from its grid cell's testID), the cell,
 * and its Path's props. Fix round 1: all silhouettes are Paths of ONE Svg (the
 * wall), in the same order as the cells, one Path per cell.
 */
function tiles(screen: ReturnType<typeof renderGallery>) {
  const cells = screen.getAllByTestId(/^gallery-tile-/);
  const svgs = screen.UNSAFE_getAllByType(Svg);
  expect(svgs).toHaveLength(1);
  const paths = svgs[0].findAllByType(Path);
  expect(paths).toHaveLength(cells.length);
  return cells.map((node, i) => ({
    id: String(node.props.testID).replace('gallery-tile-', ''),
    node,
    path: paths[i].props as Record<string, unknown>,
  }));
}

function textsUnder(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
}

function frame() {
  act(() => {
    jest.advanceTimersByTime(16);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // One 16 ms frame per requestAnimationFrame (HomeScreen.collection.test.tsx).
  jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  jest
    .spyOn(global, 'cancelAnimationFrame')
    .mockImplementation((id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
  jest.spyOn(performance, 'now').mockReturnValue(0); // each slice ends at the level cap
  backHandlers = [];
  backRemoved = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return {
      remove: () => {
        backRemoved += 1;
        backHandlers = backHandlers.filter((h) => h !== handler);
      },
    };
  });
  mockCatalogue.retired = new Set();
  mockCatalogue.extra = [];
  mockFlags.COLLECTION_SYNC_ENABLED = true;
  onBack = jest.fn();
  store = new MapStore();
  previousStore = SaveSystem.useStore(store);
  previousHealthy = SaveSystem.persistenceHealthy;
  SaveSystem.setPersistenceHealthy(true);
});

afterEach(() => {
  SaveSystem.useStore(previousStore);
  SaveSystem.setPersistenceHealthy(previousHealthy);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('the wall', () => {
  test('fresh collection: every catalogue shape outlined in pipSpent, no fill, no name; count 0 of 26', () => {
    const screen = renderGallery();
    const all = tiles(screen);
    // W3-18: the 26 shapes a player can be dealt; catalogue ids awaiting W3-19 have no tile.
    expect(all.map((t) => t.id)).toEqual(SHAPE_CATALOGUE.slice(0, 26));
    const inner = GALLERY_TILE_DP - GALLERY_OUTLINE_DP;
    for (const t of all) {
      expect(t.path.d).toBe(galleryTilePath(t.id, inner));
      expect(t.path.fill).toBe('none');
      expect(t.path.stroke).toBe(Daylight.pipSpent);
      expect(t.path.strokeWidth).toBe(GALLERY_OUTLINE_DP);
      expect(textsUnder(t.node)).toEqual([]);
    }
    expect(screen.getByText('0 of 26')).toBeTruthy();
  });

  test('collected shapes are filled in ink (even-odd) and named in inkDim; the rest stay outlined', () => {
    seen('Circle', 'Ring', 'Cat');
    const screen = renderGallery();
    for (const t of tiles(screen)) {
      const collected = ['Circle', 'Ring', 'Cat'].includes(t.id);
      if (collected) {
        expect([t.id, t.path.fill, t.path.fillRule, t.path.stroke]).toEqual([t.id, Daylight.ink, 'evenodd', undefined]);
        expect(textsUnder(t.node)).toEqual([t.id]);
        const nameStyle = StyleSheet.flatten(t.node.findByType(Text).props.style);
        expect(nameStyle.color).toBe(Daylight.inkDim);
        expect(Object.values(Fonts)).toContain(nameStyle.fontFamily);
        expect(nameStyle.fontWeight).toBeUndefined();
      } else {
        expect([t.id, t.path.fill, t.path.stroke]).toEqual([t.id, 'none', Daylight.pipSpent]);
        expect(textsUnder(t.node)).toEqual([]);
      }
    }
    expect(screen.getByText('3 of 26')).toBeTruthy();
  });

  test('Ink Night uses the same roles from its own palette', () => {
    seen('Heart');
    const screen = renderGallery(InkNight);
    const byId = new Map(tiles(screen).map((t) => [t.id, t]));
    expect(byId.get('Heart')!.path.fill).toBe(InkNight.ink);
    expect(byId.get('Star')!.path.stroke).toBe(InkNight.pipSpent);
    expect(StyleSheet.flatten(screen.getByText('1 of 26').props.style).color).toBe(InkNight.inkDim);
  });

  test('a retired shape shows only when collected; M counts the non-retired catalogue', () => {
    mockCatalogue.retired = new Set(['Bolt', 'Fish']);
    seen('Fish', 'Cat');
    const screen = renderGallery();
    const ids = tiles(screen).map((t) => t.id);
    expect(ids).not.toContain('Bolt'); // retired, not collected: omitted
    expect(ids).toContain('Fish'); // retired, collected: shown filled
    expect(ids).toHaveLength(25);
    expect(screen.getByText('1 of 24')).toBeTruthy(); // Cat; M = 26 - 2 retired
  });

  test('W3-18: a catalogue id no generator or daily deals yet (awaiting W3-19) gets no tile; M counts only dealable ids', () => {
    mockCatalogue.extra = ['AuthoredNotDealt'];
    const screen = renderGallery();
    const ids = tiles(screen).map((t) => t.id);
    expect(ids).not.toContain('AuthoredNotDealt');
    expect(ids).toHaveLength(26);
    expect(screen.getByText('0 of 26')).toBeTruthy();
  });

  test('no level numbers, stars or scores: the count line is the only text with a digit', () => {
    seen(...SHAPE_CATALOGUE);
    const screen = renderGallery();
    const withDigits = screen.UNSAFE_getAllByType(Text)
      .map((t) => [t.props.children].flat().join(''))
      .filter((s) => /\d/.test(s));
    expect(withDigits).toEqual(['26 of 26']);
    expect(screen.queryByText(/[★✦☆]/)).toBeNull();
  });

  test('nothing on the wall is pressable: the back control is the only button', () => {
    seen('Circle', 'Cat');
    const screen = renderGallery();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const svg = screen.UNSAFE_getByType(Svg);
    expect(svg.props.pointerEvents).toBe('none');
    const svgHandlers = [svg, ...svg.findAll(() => true)].filter(
      (n) => typeof n.props.onPress === 'function' || typeof n.props.onPressIn === 'function'
        || typeof n.props.onResponderRelease === 'function',
    );
    expect(svgHandlers).toHaveLength(0);
    for (const t of tiles(screen)) {
      const pressable = [t.node, ...t.node.findAll(() => true)].filter(
        (n) => typeof n.props.onPress === 'function' || typeof n.props.onPressIn === 'function'
          || typeof n.props.onResponderRelease === 'function',
      );
      expect([t.id, pressable.length]).toEqual([t.id, 0]);
    }
    // A press on a tile reaches no handler.
    fireEvent.press(tiles(screen)[0].node);
    expect(onBack).not.toHaveBeenCalled();
  });

  test('a 360 dp window lays the tiles out 4 to a row inside 16 dp gutters', () => {
    const screen = renderGallery();
    const rows = screen.getAllByTestId('gallery-row');
    expect(rows.map((r) => r.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('gallery-tile-') && typeof n.type === 'string').length))
      .toEqual([4, 4, 4, 4, 4, 4, 2]);
    const cell = StyleSheet.flatten(tiles(screen)[0].node.props.style);
    expect(cell.width).toBe(76);
    expect(cell.height).toBe(62); // 40 dp tile + 6 dp gap + 16 dp name line
    expect(cell.paddingTop).toBe(GALLERY_TILE_DP); // the name sits under the tile's box
  });

  test('one Svg draws every silhouette, each centred in its own grid cell (360 dp: 76 dp cells, 8 dp gaps, 78 dp rows)', () => {
    seen('Circle', 'Cat');
    const screen = renderGallery();
    const svg = screen.UNSAFE_getByType(Svg);
    expect([svg.props.width, svg.props.height]).toEqual([4 * 76 + 3 * 8, 7 * 78]);
    expect(StyleSheet.flatten(svg.props.style)).toMatchObject({ position: 'absolute', left: 0, top: 0 });
    const inset = GALLERY_OUTLINE_DP / 2;
    tiles(screen).forEach((t, i) => {
      const x = (i % 4) * 84 + (76 - GALLERY_TILE_DP) / 2 + inset;
      const y = Math.floor(i / 4) * 78 + inset;
      expect([t.id, t.path.transform]).toEqual([t.id, `translate(${x} ${y})`]);
    });
  });
});

describe('back', () => {
  test('the ‹ button returns to the menu', () => {
    const screen = renderGallery();
    fireEvent.press(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('Android hardware back returns to the menu and is consumed (the app does not exit)', () => {
    const screen = renderGallery();
    expect(backHandlers).toHaveLength(1);
    let consumed: boolean | null | undefined;
    act(() => {
      consumed = backHandlers[0]({} as Parameters<BackListener>[0]);
    });
    expect(consumed).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    screen.unmount();
    expect(backRemoved).toBe(1);
    expect(backHandlers).toHaveLength(0);
  });
});

describe('collection sync on open (W4-07 backfill)', () => {
  test('the fold starts on the first frame after opening (no menu delay) and the wall fills as bits arrive', () => {
    // Every performance.now() read advances 1 ms, so each 3 ms slice folds
    // ~3 levels: 60 levels behind, an empty collection, 20 shapes to find.
    let t = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      t += 1;
      return t;
    });
    store.setInt('arrows_current_level', 60);
    store.setInt('arrows_total_solved', 60);
    const sync = jest.spyOn(SaveSystem, 'syncCollection');
    const screen = renderGallery();
    expect(sync).not.toHaveBeenCalled(); // nothing during the mount itself
    expect(screen.getByText('0 of 26')).toBeTruthy();

    frame();
    expect(sync).toHaveBeenCalledTimes(1); // the first frame after opening, not 2 s later

    const count = () => Number(String([screen.getByText(/ of 26$/).props.children].flat().join('')).split(' ')[0]);
    const counts = [count()];
    for (let i = 0; i < 100 && SaveSystem.shapesThroughLevel < 60; i += 1) {
      frame();
      counts.push(count());
    }

    expect(SaveSystem.shapesThroughLevel).toBe(60);
    // The first frame already shows a bit; later frames add more (monotonic,
    // several steps, not one jump at the end); it ends at the 20 shapes of
    // levels 1-60.
    expect(counts[0]).toBeGreaterThan(0);
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(new Set(counts).size).toBeGreaterThan(5);
    expect(counts[counts.length - 1]).toBe(20);
    const filled = tiles(screen).filter((x) => x.path.fill === Daylight.ink).length;
    expect(filled).toBe(20);
  });

  test('leaving the gallery stops the fold', () => {
    store.setInt('arrows_current_level', 5000);
    const screen = renderGallery();
    frame();
    frame();
    const atUnmount = SaveSystem.shapesThroughLevel;
    screen.unmount();
    for (let i = 0; i < 50; i += 1) frame();
    expect(atUnmount).toBeGreaterThan(0);
    expect(SaveSystem.shapesThroughLevel).toBe(atUnmount);
  });

  test('kill constant off: the gallery shows the stored bits and never folds', () => {
    mockFlags.COLLECTION_SYNC_ENABLED = false;
    store.setInt('arrows_current_level', 50);
    seen('Circle');
    const screen = renderGallery();
    for (let i = 0; i < 10; i += 1) frame();
    expect(screen.getByText('1 of 26')).toBeTruthy();
    expect(store.map.has('arrows_shapes_through_level')).toBe(false);
  });

  test('caught up already: one O(1) call, and the stored bits show', () => {
    seen('Circle');
    store.setInt('arrows_current_level', 3);
    store.setInt('arrows_shapes_through_level', 3);
    const sync = jest.spyOn(SaveSystem, 'syncCollection');
    const screen = renderGallery();
    for (let i = 0; i < 5; i += 1) frame();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 of 26')).toBeTruthy();
  });
});

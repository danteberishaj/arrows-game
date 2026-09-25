/**
 * W4-09: the shape gallery's grid. Pure layout only: what a component test or
 * this file cannot see (legibility at a real density, the no-colour
 * distinction, the scroll) closes on the emulator captures in artifacts/W4-09/.
 *
 * The owner picked the tile (40 dp) and the raster rows (14) from W4-08's
 * contact sheet on 2026-09-25. The grid must keep a >= 16 dp side gutter and
 * never overflow horizontally; the tile never shrinks below the pick, so the
 * column count is what adapts to the window width.
 */
import { SHAPE_CATALOGUE, shapeDefFor } from '../../core/shapeCatalogue';
import {
  GALLERY_GUTTER_DP,
  GALLERY_RASTER_ROWS,
  GALLERY_TILE_DP,
  galleryLayout,
  galleryRasterSize,
  galleryTileOrigin,
  galleryTilePath,
  roundToPixelGrid,
  type GalleryLayout,
} from '../galleryLayout';

function rowWidth(layout: GalleryLayout): number {
  return layout.columns * layout.cellWidth + (layout.columns - 1) * layout.columnGap;
}

function expectFits(width: number, layout: GalleryLayout): void {
  const label = `width ${width}: ${JSON.stringify(layout)}`;
  expect([label, Number.isInteger(layout.columns) && layout.columns >= 1]).toEqual([label, true]);
  // No horizontal overflow: both gutters plus a full row fit the window.
  expect([label, rowWidth(layout) + 2 * layout.gutter <= width + 1e-9]).toEqual([label, true]);
  expect([label, layout.gutter >= GALLERY_GUTTER_DP]).toEqual([label, true]);
  // The tile never shrinks below the owner's pick, and it fits inside its cell.
  expect([label, layout.tileSize >= GALLERY_TILE_DP]).toEqual([label, true]);
  expect([label, layout.cellWidth >= layout.tileSize]).toEqual([label, true]);
}

test('owner picks (2026-09-25, W4-08 sheet): 14 raster rows, 40 dp tiles, 16 dp gutters', () => {
  expect(GALLERY_RASTER_ROWS).toBe(14);
  expect(GALLERY_TILE_DP).toBe(40);
  expect(GALLERY_GUTTER_DP).toBe(16);
});

test.each([320, 360, 412])('at %i dp every tile fits with no horizontal overflow', (width) => {
  const layout = galleryLayout(width);
  expectFits(width, layout);
  expect(layout.tileSize).toBe(GALLERY_TILE_DP);
  // The whole catalogue is laid out in whole rows of `columns` cells.
  const rows = Math.ceil(SHAPE_CATALOGUE.length / layout.columns);
  expect(rows * layout.columns).toBeGreaterThanOrEqual(SHAPE_CATALOGUE.length);
});

test('columns adapt to the width (320 / 360 / 412 dp -> 3 / 4 / 5)', () => {
  expect([320, 360, 412].map((w) => galleryLayout(w).columns)).toEqual([3, 4, 5]);
});

test('every width from 280 to 1400 dp fits, and a wider window never has fewer columns', () => {
  let previous = 0;
  for (let width = 280; width <= 1400; width += 1) {
    const layout = galleryLayout(width);
    expectFits(width, layout);
    expect(layout.columns).toBeGreaterThanOrEqual(previous);
    previous = layout.columns;
  }
});

test('fractional window widths (Android dp) fit too', () => {
  for (const width of [320.4, 360.9, 392.7, 411.4, 411.9]) expectFits(width, galleryLayout(width));
});

test('raster size: 14 rows and round(14 x aspect) columns for every catalogue shape', () => {
  for (const id of SHAPE_CATALOGUE) {
    const def = shapeDefFor(id)!;
    expect([id, galleryRasterSize(def.aspect)]).toEqual([
      id,
      { rows: 14, cols: Math.round(14 * def.aspect) },
    ]);
  }
});

test('the tile path is cached per shape id and size', () => {
  const a = galleryTilePath('Cat', 38);
  expect(a.length).toBeGreaterThan(0);
  expect(galleryTilePath('Cat', 38)).toBe(a);
  expect(galleryTilePath('Cat', 50)).not.toBe(a);
  expect(galleryTilePath('Ring', 38)).not.toBe(a);
  expect(galleryTilePath('not-a-shape', 38)).toBe('');
});

test('pixel-grid rounding follows Yoga: half up, whole pixels kept, result in dp', () => {
  expect(roundToPixelGrid(14.5, 3.5)).toBeCloseTo(51 / 3.5, 9); // 50.75 px -> 51
  expect(roundToPixelGrid(77, 3.5)).toBeCloseTo(270 / 3.5, 9); // 269.5 px -> 270 (half up)
  expect(roundToPixelGrid(18, 3)).toBe(18); // 54 px, already whole
  expect(roundToPixelGrid(0.1, 2.75)).toBe(0); // 0.275 px -> 0
});

test('fix round 1: each tile lands on the device pixels its own view used to (row, cell, centring rounded separately)', () => {
  const rowPitch = 78; // GalleryScreen: 40 dp tile + 6 + 16 name line + 16 row gap
  for (const width of [320, 360, 392.7, 411.43, 412]) {
    const layout = galleryLayout(width);
    for (const ratio of [1.5, 2, 2.625, 2.75, 3, 3.5, 4]) {
      for (let i = 0; i < SHAPE_CATALOGUE.length; i += 1) {
        const { x, y } = galleryTileOrigin(i, layout, rowPitch, ratio);
        const col = i % layout.columns;
        const row = Math.floor(i / layout.columns);
        // Whole device pixels.
        expect(Math.abs(x * ratio - Math.round(x * ratio))).toBeLessThan(1e-6);
        expect(Math.abs(y * ratio - Math.round(y * ratio))).toBeLessThan(1e-6);
        // Within a pixel of the unrounded flex position.
        const flexX = col * (layout.cellWidth + layout.columnGap) + (layout.cellWidth - layout.tileSize) / 2;
        expect(Math.abs(x - flexX) * ratio).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.abs(y - row * rowPitch) * ratio).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  }
  // The native emulator case the unrounded version got wrong (411.43 dp @ 3.5): column 1.
  const native = galleryLayout(411.43);
  expect(native.columns).toBe(5);
  expect(galleryTileOrigin(1, native, rowPitch, 3.5).x * 3.5).toBeCloseTo(270 + 51, 6); // not 320.25
});

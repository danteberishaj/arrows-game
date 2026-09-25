import { hasSeen, type ShapeMasks } from '../core/collection';
import { RETIRED_SHAPE_IDS, SHAPE_CATALOGUE, shapeDefFor } from '../core/shapeCatalogue';
import { silhouettePath } from './silhouette';

/**
 * W4-09 (META_GALLERY): the shape gallery's grid and tile drawing, as pure
 * functions (GalleryScreen.tsx renders them; galleryLayout.test.ts and
 * silhouette.test.ts assert them).
 *
 * The owner picked the raster rows and the tile size from W4-08's contact
 * sheet (artifacts/W4-08/owner-legibility.png, all 26 shapes side by side at
 * 8/10/12/14/20 rows on one 40 px tile): at 14 rows every shape reads as
 * itself, including Bolt, Trophy, Rocket and Pine, which blur at 8-12 rows.
 */

/** Raster rows per gallery tile; cols = round(rows x the shape's aspect). */
export const GALLERY_RASTER_ROWS = 14; // OWNER PICK 2026-09-25 (W4-08 sheet)

/** The silhouette box, dp. A floor: the layout never shrinks a tile below it. */
export const GALLERY_TILE_DP = 40; // OWNER PICK 2026-09-25 (W4-08 sheet)

/** Minimum side gutter, dp (brief W4-09). */
export const GALLERY_GUTTER_DP = 16;

/**
 * Minimum width of one column, dp: the tile plus room for a display name
 * under it ("Butterfly", the widest name, is ~58 dp in Fredoka SemiBold 12 at
 * font scale 1; artifacts/W4-09/layout). OWNER-PICKED STARTING VALUE.
 */
export const GALLERY_CELL_MIN_DP = 68; // OWNER-PICKED STARTING VALUE

/** Gap between two columns, dp. OWNER-PICKED STARTING VALUE. */
export const GALLERY_COLUMN_GAP_DP = 8; // OWNER-PICKED STARTING VALUE

export interface GalleryLayout {
  /** Cells per row (>= 1). */
  readonly columns: number;
  /** Width of every cell, whole dp; the tile is centred in it. */
  readonly cellWidth: number;
  /** The silhouette box, dp (always GALLERY_TILE_DP). */
  readonly tileSize: number;
  /** Left and right padding, dp: >= GALLERY_GUTTER_DP; the row is centred. */
  readonly gutter: number;
  /** Gap between two columns, dp. */
  readonly columnGap: number;
}

/**
 * The grid for a window `windowWidth` dp wide: as many columns of at least
 * GALLERY_CELL_MIN_DP as fit between two 16 dp gutters; cell widths are whole
 * dp (so pixel rounding can never push the last column over the edge) and the
 * leftover goes to the gutters. The tile stays GALLERY_TILE_DP: the columns
 * adapt, the tile does not shrink. Below 72 dp (tile + two gutters) a single
 * column cannot fit either; no real window is that narrow.
 */
export function galleryLayout(windowWidth: number): GalleryLayout {
  const width = Number.isFinite(windowWidth) ? Math.max(0, windowWidth) : 0;
  const gap = GALLERY_COLUMN_GAP_DP;
  const inner = width - 2 * GALLERY_GUTTER_DP;
  const columns = Math.max(1, Math.floor((inner + gap) / (GALLERY_CELL_MIN_DP + gap)));
  const cellWidth = Math.max(
    GALLERY_TILE_DP,
    Math.floor((inner - (columns - 1) * gap) / columns),
  );
  const row = columns * cellWidth + (columns - 1) * gap;
  return {
    columns,
    cellWidth,
    tileSize: GALLERY_TILE_DP,
    gutter: Math.max(GALLERY_GUTTER_DP, (width - row) / 2),
    columnGap: gap,
  };
}

/** The gallery raster for a shape of this aspect (cols/rows). */
export function galleryRasterSize(aspect: number): { rows: number; cols: number } {
  return {
    rows: GALLERY_RASTER_ROWS,
    cols: Math.max(1, Math.round(GALLERY_RASTER_ROWS * aspect)),
  };
}

/** Module-level cache: one path string per shape id and size. */
const tilePaths = new Map<string, string>();

/**
 * The tile's even-odd silhouette (W5-01's `silhouettePath` over
 * `shapeDefFor(id).rasterize(rows, cols)` at the gallery raster), `size` dp
 * square, drawn with `fillRule="evenodd"` so holes stay open. Cached per id and
 * size; the gallery draws the newest definition (shapeCatalogue.ts rules).
 * '' for an id this build does not know.
 */
export function galleryTilePath(id: string, size: number): string {
  const key = `${id}@${size}`;
  const cached = tilePaths.get(key);
  if (cached !== undefined) return cached;
  const def = shapeDefFor(id);
  let path = '';
  if (def !== null) {
    const { rows, cols } = galleryRasterSize(def.aspect);
    path = silhouettePath(def.rasterize(rows, cols), size);
  }
  tilePaths.set(key, path);
  return path;
}

/** One tile on the wall. */
export interface GalleryTile {
  readonly id: string;
  /** The display name (the ShapeDef's name, as the win panel's subline shows it). */
  readonly name: string;
  readonly collected: boolean;
}

/** The wall and its count line: `collected` of `total`. */
export interface GalleryWall {
  readonly tiles: readonly GalleryTile[];
  readonly collected: number;
  readonly total: number;
}

/**
 * The wall for these collection masks, in catalogue (bit) order. A retired
 * shape is shown only if it was collected; `total` is the non-retired
 * catalogue length and `collected` counts collected non-retired shapes, so the
 * count line never reads more than `total` of `total`. Bits this build's
 * catalogue does not know (written by a newer build) are ignored.
 */
export function galleryWall(
  masks: ShapeMasks,
  catalogue: readonly string[] = SHAPE_CATALOGUE,
  retired: ReadonlySet<string> = RETIRED_SHAPE_IDS,
): GalleryWall {
  const tiles: GalleryTile[] = [];
  let collected = 0;
  let total = 0;
  catalogue.forEach((id, index) => {
    const have = hasSeen(masks, index);
    const isRetired = retired.has(id);
    if (!isRetired) total += 1;
    if (have && !isRetired) collected += 1;
    if (isRetired && !have) return;
    tiles.push({ id, name: shapeDefFor(id)?.name ?? id, collected: have });
  });
  return { tiles, collected, total };
}

/**
 * `dp` rounded to the device pixel grid the way Yoga rounds a view's position
 * relative to its parent (yoga/algorithm/PixelGrid.cpp roundValueToPixelGrid:
 * half up, with its 1e-4 tolerance). Result in dp.
 */
export function roundToPixelGrid(dp: number, pixelRatio: number): number {
  const scaled = dp * pixelRatio;
  const floor = Math.floor(scaled);
  const fraction = scaled - floor;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  let px = floor;
  if (near(fraction, 1)) px = floor + 1;
  else if (!near(fraction, 0) && (fraction > 0.5 || near(fraction, 0.5))) px = floor + 1;
  return px / pixelRatio;
}

/**
 * Fix round 1: where tile `index`'s `tileSize` box sits inside the grid (the
 * one Svg that draws every silhouette), in dp. It is exactly where the
 * per-tile Svg view used to land: the row's top, the cell's left and the
 * box's centring offset are each rounded to the device pixel grid, as Yoga
 * rounds each view relative to its parent. So every silhouette keeps the same
 * device pixels at any density, not only where the grid happens to fall on
 * whole pixels (360x640 dp @ 3.0).
 */
export function galleryTileOrigin(
  index: number,
  layout: GalleryLayout,
  rowPitch: number,
  pixelRatio: number,
): { x: number; y: number } {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: roundToPixelGrid(col * (layout.cellWidth + layout.columnGap), pixelRatio)
      + roundToPixelGrid((layout.cellWidth - layout.tileSize) / 2, pixelRatio),
    y: roundToPixelGrid(row * rowPitch, pixelRatio),
  };
}

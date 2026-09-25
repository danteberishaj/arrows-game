/**
 * W4-08 — measures silhouette legibility at candidate shape-gallery raster
 * sizes, before W4-09 picks the raster row count and minimum tile size the
 * gallery ships with. This script does not pick either value; it produces
 * the evidence the owner picks them from.
 *
 * For every id in `SHAPE_CATALOGUE` (26 shapes: 2 grid-filling — Square,
 * Rectangle — and 24 silhouettes), rasterizes at rows in {8, 10, 12, 14, 20}
 * (cols = round(rows * shape.aspect)) and draws the mask through
 * `silhouettePath` with the even-odd fill rule — the exact function and fill
 * rule W4-09's gallery tiles will use — at 2, 3 and 4 px per raster cell
 * (brackets ~16-80 px/dp tiles, spanning the brief's 20-60 dp band).
 *
 * Writes, to the given output directory:
 *   - one contact-sheet PNG per row count (all 26 shapes x the 3 px/cell
 *     variants), so a raster that goes empty or blob-like is visible;
 *   - `filled-cell-table.txt`, filled/total cell counts per shape and row
 *     count (catches an empty raster numerically, not just by eye);
 *   - `owner-legibility.png`, the 5 row counts side by side at a single
 *     fixed ~40 dp tile (the size named in the W4-08 dispatch), for a direct
 *     at-a-glance comparison.
 *
 * Run: npx tsx scripts/analysis/gallery-contact-sheet.ts <output-dir>
 *      npx tsx scripts/analysis/gallery-contact-sheet.ts artifacts/W4-08
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { SHAPE_CATALOGUE, shapeDefFor } from '../../src/core/shapeCatalogue';
import { ShapeDef } from '../../src/core/shapeLibrary';
import { silhouettePath } from '../../src/ui/silhouette';
import { Daylight } from '../../src/ui/theme';

const ROW_COUNTS: readonly number[] = [8, 10, 12, 14, 20]; // brief W4-08
const PIXELS_PER_CELL: readonly number[] = [2, 3, 4]; // brief W4-08: brackets 20-60dp tiles
const OWNER_SHEET_TILE_PX = 40; // dispatch instruction: "tile size closest to ~40 dp"

const FONT_FAMILY = 'sans-serif';
const TITLE_FONT_PX = 20; // OWNER-PICKED STARTING VALUE (diagnostic layout, not shipped UI)
const LEGEND_FONT_PX = 12; // OWNER-PICKED STARTING VALUE
const LABEL_FONT_PX = 13; // OWNER-PICKED STARTING VALUE
const CAPTION_FONT_PX = 10; // OWNER-PICKED STARTING VALUE
const LABEL_COLUMN_PX = 150; // OWNER-PICKED STARTING VALUE
const OWNER_SHEET_COLUMN_PX = 104; // OWNER-PICKED STARTING VALUE (fits a 10 px caption)
const COLUMN_GAP_PX = 12; // OWNER-PICKED STARTING VALUE
const ROW_GAP_PX = 6; // OWNER-PICKED STARTING VALUE
const HEADER_HEIGHT_PX = 56; // OWNER-PICKED STARTING VALUE
const TEXT_LEFT_PX = 10; // OWNER-PICKED STARTING VALUE
const CAPTION_NUDGE_PX = 15; // OWNER-PICKED STARTING VALUE
const BOLD_FONT_WEIGHT = 700;

interface ShapeRaster {
  readonly shape: ShapeDef;
  readonly rows: number;
  readonly cols: number;
  readonly mask: boolean[][];
  readonly filled: number;
  readonly total: number;
}

function shapeCatalogue(): readonly ShapeDef[] {
  // W4-01's append-only SHAPE_CATALOGUE is the gallery's id list (the order its
  // bits use); shapeDefFor maps each id to the ShapeDef the gallery draws.
  return SHAPE_CATALOGUE.map((id) => {
    const def = shapeDefFor(id);
    if (def === null) throw new Error(`SHAPE_CATALOGUE id with no ShapeDef: ${id}`);
    return def;
  });
}

function colsFor(rows: number, aspect: number): number {
  return Math.max(1, Math.round(rows * aspect));
}

function filledCount(mask: readonly (readonly boolean[])[]): number {
  let count = 0;
  for (const row of mask) for (const cell of row) if (cell) count++;
  return count;
}

function rasterize(shapes: readonly ShapeDef[], rows: number): ShapeRaster[] {
  return shapes.map((shape) => {
    const cols = colsFor(rows, shape.aspect);
    const mask = shape.rasterize(rows, cols);
    const filled = filledCount(mask);
    return { shape, rows, cols, mask, filled, total: rows * cols };
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function tileSvg(mask: readonly (readonly boolean[])[], sizePx: number, x: number, y: number): string {
  const rect = `<rect x="${x}" y="${y}" width="${sizePx}" height="${sizePx}" fill="${Daylight.surface}"/>`;
  const d = silhouettePath(mask, sizePx);
  if (d === '') {
    return `${rect}<text x="${x + sizePx / 2}" y="${y + sizePx / 2}" fill="#D1264C" `
      + `font-family="${FONT_FAMILY}" font-size="${Math.min(CAPTION_FONT_PX, sizePx / 2)}" `
      + `font-weight="${BOLD_FONT_WEIGHT}" text-anchor="middle" dominant-baseline="middle">EMPTY</text>`;
  }
  return `${rect}<path d="${d}" fill="${Daylight.ink}" fill-rule="evenodd" transform="translate(${x} ${y})"/>`;
}

/** One contact sheet for a single row count: all shapes x all px/cell variants. */
function rowCountSheetSvg(rasters: readonly ShapeRaster[], rows: number): string {
  const colWidths = PIXELS_PER_CELL.map((pxPerCell) => (
    Math.max(...rasters.map((r) => pxPerCell * Math.max(r.rows, r.cols)))
  ));
  const rowHeights = rasters.map((r) => (
    Math.max(...PIXELS_PER_CELL.map((pxPerCell) => pxPerCell * Math.max(r.rows, r.cols)))
  ));

  const colX: number[] = [];
  {
    let x = LABEL_COLUMN_PX;
    for (const w of colWidths) { colX.push(x); x += w + COLUMN_GAP_PX; }
  }
  const width = colX[colX.length - 1] + colWidths[colWidths.length - 1] + TEXT_LEFT_PX;

  const rowY: number[] = [];
  {
    let y = HEADER_HEIGHT_PX;
    for (const h of rowHeights) { rowY.push(y); y += h + ROW_GAP_PX; }
  }
  const height = rowY[rowY.length - 1] + rowHeights[rowHeights.length - 1] + TEXT_LEFT_PX;

  const header: string[] = [
    `<text x="${TEXT_LEFT_PX}" y="24" fill="${Daylight.ink}" font-family="${FONT_FAMILY}" `
    + `font-size="${TITLE_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">`
    + `Gallery legibility — rows=${rows} (cols = round(rows × aspect))</text>`,
    `<text x="${TEXT_LEFT_PX}" y="42" fill="${Daylight.inkDim}" font-family="${FONT_FAMILY}" `
    + `font-size="${LEGEND_FONT_PX}">rasterize() → silhouettePath(), even-odd fill — the exact `
    + `gallery-tile path</text>`,
  ];
  PIXELS_PER_CELL.forEach((pxPerCell, index) => {
    header.push(
      `<text x="${colX[index]}" y="${HEADER_HEIGHT_PX - 8}" fill="${Daylight.inkDim}" `
      + `font-family="${FONT_FAMILY}" font-size="${LEGEND_FONT_PX}">${pxPerCell} px/cell</text>`,
    );
  });

  const tiles: string[] = [];
  const labels: string[] = [];
  rasters.forEach((raster, rowIndex) => {
    const rowCenter = rowY[rowIndex] + rowHeights[rowIndex] / 2;
    const flag = raster.filled === 0 ? ' — EMPTY' : '';
    labels.push(
      `<text x="${TEXT_LEFT_PX}" y="${rowCenter - 2}" fill="${Daylight.ink}" font-family="${FONT_FAMILY}" `
      + `font-size="${LABEL_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">${escapeXml(raster.shape.name)}</text>`,
      `<text x="${TEXT_LEFT_PX}" y="${rowCenter - 2 + CAPTION_NUDGE_PX}" fill="${raster.filled === 0 ? '#D1264C' : Daylight.inkDim}" `
      + `font-family="${FONT_FAMILY}" font-size="${CAPTION_FONT_PX}">`
      + `${raster.rows}×${raster.cols} · ${raster.filled}/${raster.total} filled${flag}</text>`,
    );
    PIXELS_PER_CELL.forEach((pxPerCell, colIndex) => {
      const size = pxPerCell * Math.max(raster.rows, raster.cols);
      const x = colX[colIndex] + (colWidths[colIndex] - size) / 2;
      const y = rowY[rowIndex] + (rowHeights[rowIndex] - size) / 2;
      tiles.push(tileSvg(raster.mask, size, x, y));
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${Daylight.bg}"/>
    ${header.join('\n')}
    ${tiles.join('\n')}
    ${labels.join('\n')}
  </svg>`;
}

/** The combined owner sheet: candidate row counts side by side at one fixed ~40dp tile. */
function ownerSheetSvg(shapes: readonly ShapeDef[]): string {
  const tileSize = OWNER_SHEET_TILE_PX;
  // Room for the subtitle above the column headings.
  const OWNER_HEADER_PX = HEADER_HEIGHT_PX + 16;
  const rowHeight = tileSize + CAPTION_NUDGE_PX + 6;
  // Wide enough for the "rows×cols · n filled" caption, so captions never overlap.
  const colWidth = Math.max(tileSize + COLUMN_GAP_PX, OWNER_SHEET_COLUMN_PX);

  const colX = ROW_COUNTS.map((_, index) => LABEL_COLUMN_PX + index * colWidth);
  const width = LABEL_COLUMN_PX + ROW_COUNTS.length * colWidth;
  const rowY = shapes.map((_, index) => OWNER_HEADER_PX + index * (rowHeight + ROW_GAP_PX));
  const height = OWNER_HEADER_PX + shapes.length * (rowHeight + ROW_GAP_PX) + TEXT_LEFT_PX;

  const header: string[] = [
    `<text x="${TEXT_LEFT_PX}" y="24" fill="${Daylight.ink}" font-family="${FONT_FAMILY}" `
    + `font-size="${TITLE_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">`
    + `Candidate raster rows at a fixed ${tileSize} px tile</text>`,
    `<text x="${TEXT_LEFT_PX}" y="42" fill="${Daylight.inkDim}" font-family="${FONT_FAMILY}" `
    + `font-size="${LEGEND_FONT_PX}">Same on-screen tile size in every column; only the raster `
    + `resolution (rows) changes.</text>`,
  ];
  ROW_COUNTS.forEach((rows, index) => {
    header.push(
      `<text x="${colX[index]}" y="${OWNER_HEADER_PX - 8}" fill="${Daylight.ink}" `
      + `font-family="${FONT_FAMILY}" font-size="${LABEL_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">`
      + `rows=${rows}</text>`,
    );
  });

  const tiles: string[] = [];
  const labels: string[] = [];
  shapes.forEach((shape, rowIndex) => {
    const y = rowY[rowIndex];
    labels.push(
      `<text x="${TEXT_LEFT_PX}" y="${y + tileSize / 2}" fill="${Daylight.ink}" font-family="${FONT_FAMILY}" `
      + `font-size="${LABEL_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">${escapeXml(shape.name)}</text>`,
    );
    ROW_COUNTS.forEach((rows, colIndex) => {
      const cols = colsFor(rows, shape.aspect);
      const mask = shape.rasterize(rows, cols);
      const filled = filledCount(mask);
      const x = colX[colIndex];
      tiles.push(tileSvg(mask, tileSize, x, y));
      tiles.push(
        `<text x="${x}" y="${y + tileSize + CAPTION_NUDGE_PX}" `
        + `fill="${filled === 0 ? '#D1264C' : Daylight.inkDim}" font-family="${FONT_FAMILY}" `
        + `font-size="${CAPTION_FONT_PX}">${rows}×${cols} · ${filled} filled</text>`,
      );
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${Daylight.bg}"/>
    ${header.join('\n')}
    ${tiles.join('\n')}
    ${labels.join('\n')}
  </svg>`;
}

function writeFilledCellTable(
  outputDirectory: string,
  shapes: readonly ShapeDef[],
  rastersByRowCount: ReadonlyMap<number, readonly ShapeRaster[]>,
): { readonly text: string; readonly emptyEntries: readonly string[] } {
  const emptyEntries: string[] = [];
  const lines: string[] = [];
  lines.push('Filled-cell count per shape and row count (rasterize(), >= 5/9 sub-sample rule)');
  lines.push(['shape', 'fillsGrid', ...ROW_COUNTS.map((r) => `rows=${r}`)].join('\t'));

  for (const shape of shapes) {
    const cells = ROW_COUNTS.map((rows) => {
      const raster = rastersByRowCount.get(rows)!.find((r) => r.shape === shape)!;
      if (raster.filled === 0) emptyEntries.push(`${shape.name}@rows=${rows}`);
      return `${raster.filled}/${raster.total} (${raster.rows}×${raster.cols})`;
    });
    lines.push([shape.name, String(shape.fillsGrid), ...cells].join('\t'));
  }

  lines.push('');
  lines.push(emptyEntries.length === 0
    ? 'Empty rasters: none'
    : `Empty rasters (${emptyEntries.length}): ${emptyEntries.join(', ')}`);

  const text = `${lines.join('\n')}\n`;
  fs.writeFileSync(path.join(outputDirectory, 'filled-cell-table.txt'), text, 'utf8');
  return { text, emptyEntries };
}

async function main(): Promise<void> {
  const outputDirectory = process.argv[2];
  if (outputDirectory === undefined || outputDirectory.length === 0) {
    throw new Error('Usage: npx tsx scripts/analysis/gallery-contact-sheet.ts <output-dir>');
  }
  fs.mkdirSync(outputDirectory, { recursive: true });

  const shapes = shapeCatalogue();
  console.log(`Shape catalogue: ${shapes.length} shapes `
    + `(${shapes.filter((s) => s.fillsGrid).length} grid-filling, `
    + `${shapes.filter((s) => !s.fillsGrid).length} non-fill silhouettes)`);

  const rastersByRowCount = new Map<number, readonly ShapeRaster[]>(
    ROW_COUNTS.map((rows) => [rows, rasterize(shapes, rows)]),
  );

  for (const rows of ROW_COUNTS) {
    const rasters = rastersByRowCount.get(rows)!;
    const outputPath = path.join(outputDirectory, `gallery-rows${rows}.png`);
    await sharp(Buffer.from(rowCountSheetSvg(rasters, rows))).png().toFile(outputPath);
    const empty = rasters.filter((r) => r.filled === 0).map((r) => r.shape.name);
    console.log(`Wrote ${outputPath}${empty.length > 0 ? ` — EMPTY: ${empty.join(', ')}` : ''}`);
  }

  const { text, emptyEntries } = writeFilledCellTable(outputDirectory, shapes, rastersByRowCount);
  console.log('');
  console.log(text);

  const ownerSheetPath = path.join(outputDirectory, 'owner-legibility.png');
  await sharp(Buffer.from(ownerSheetSvg(shapes))).png().toFile(ownerSheetPath);
  console.log(`Wrote ${ownerSheetPath}`);

  console.log('');
  console.log(emptyEntries.length === 0
    ? 'RESULT: zero empty rasters across all shapes and row counts.'
    : `RESULT: ${emptyEntries.length} empty raster(s): ${emptyEntries.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

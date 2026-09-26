/**
 * W3-04 — shape preview / contact-sheet tool.
 *
 * No silhouette can be seen today without generating a level and running the
 * app: `ShapeDef.rasterize` is called only by the generator
 * (`levelGenerator.ts`) and one test. That is how Bolt shipped at 202 cells
 * at the clamp (11.9% fill) without anyone noticing (see W3-01/W3-02). This
 * tool renders the shipping shapes as the ARROW-FILLED boards a player
 * actually sees — `LevelGenerator.fillMask` output drawn with the same
 * `arrowArt`/`STROKE` SVG geometry `scripts/generate-promo-art.ts` uses for
 * store screenshots — so a human can look at a shape without playing to it.
 * It never reimplements rasterization or packing: both come straight from
 * `src/core`.
 *
 * Usage:
 *   npx tsx scripts/analysis/shape-preview.ts --name <Shape> --rows <N> [--out <dir>]
 *   npx tsx scripts/analysis/shape-preview.ts --all [--out <dir>]
 *   npm run analysis:shape -- --name Bolt --rows 46
 *
 * `--name/--rows` prints the ASCII mask, cell count, fill fraction and the
 * shape's capacity at the grid clamp (rows=46), then writes one PNG of the
 * arrow-filled board (`DotNetRandom(1234)`, Normal config — matches W3-01's
 * `--capacity`, which also rasterizes at the clamp under Normal). `--all`
 * writes one contact-sheet PNG: every catalogue shape at rows 12, 24 and 46,
 * labelled with name, cell count and fill %.
 *
 * Output defaults to the OS temp dir; images are not committed. Pass
 * `--out artifacts/<TASK-ID>` to keep a copy under the repo's gitignored
 * `artifacts/` for an owner-review artifact.
 *
 * W3-10: both modes also print each shape's generator-v2 admission — whether
 * the v2 shape bag deals it under the placeholder curve (its capacity at
 * `V2_MAX_GRID_DIM`, from `shapeCapacity`, against the window max target).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import {
  BoardLogic,
  Difficulties,
  Difficulty,
  DifficultyConfig,
  DotNetRandom,
  LevelGenerator,
  ShapeDef,
  ShapeLibrary,
  V2_MAX_GRID_DIM,
  placeholderWindowMaxTarget,
  shapeCapacity,
  windowSetAt,
} from '../../src/core';
import { arrowArt, STROKE } from '../../src/ui/arrowGeometry';
import { Daylight } from '../../src/ui/theme';

const PREVIEW_SEED = 1234; // brief: "DotNetRandom(1234)"
const CONTACT_SHEET_ROWS: readonly number[] = [12, 24, 46]; // brief: "rows 12, 24 and 46"
const GRID_CLAMP_ROWS = 46; // W3-01's "capacity at the grid clamp"

// ---- Ported generator internals (not exported — see levelGenerator.ts:428,434
// and difficulty-probe.ts's identical port). This is sizing arithmetic, not
// rasterization: `ShapeDef.rasterize` and `LevelGenerator.fillMask` below are
// always the real, imported functions, never reimplemented. -----------------
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}
function clampCols(rows: number, aspect: number): number {
  return clamp(roundHalfToEven(rows * aspect), 4, 46);
}
function countTrue(mask: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of mask) for (const cell of row) if (cell) n++;
  return n;
}

function allShapes(): readonly ShapeDef[] {
  return [...new Set([...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool])];
}

function shapeByName(name: string): ShapeDef {
  const shape = allShapes().find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (shape === undefined) {
    const names = allShapes().map((s) => s.name).join(', ');
    throw new Error(`Unknown shape "${name}". Known shapes: ${names}`);
  }
  return shape;
}

interface Raster {
  readonly rows: number;
  readonly cols: number;
  readonly mask: boolean[][];
  readonly cells: number;
  readonly fillFraction: number;
}

function rasterAt(shape: ShapeDef, rows: number): Raster {
  const cols = clampCols(rows, shape.aspect);
  const mask = shape.rasterize(rows, cols);
  const cells = countTrue(mask);
  return { rows, cols, mask, cells, fillFraction: cells / (rows * cols) };
}

/** Generator v2's admission of `shape` under the placeholder curve (W3-10). */
interface V2Admission {
  readonly admitted: boolean;
  readonly capacity: number;
  readonly windowMax: number;
}

function v2Admission(shape: ShapeDef): V2Admission {
  const windowMax = placeholderWindowMaxTarget(0, Difficulties.cycleLength);
  const admitted = windowSetAt(0).some((s) => s.name === shape.name);
  return { admitted, capacity: shapeCapacity(shape, V2_MAX_GRID_DIM), windowMax };
}

function v2AdmissionLabel(a: V2Admission): string {
  return a.admitted
    ? `v2: admitted (cap ${a.capacity} >= ${a.windowMax})`
    : `v2: excluded (cap ${a.capacity} < ${a.windowMax})`;
}

function asciiMask(mask: readonly (readonly boolean[])[]): string {
  return mask.map((row) => row.map((cell) => (cell ? '#' : '.')).join('')).join('\n');
}

const PREVIEW_CFG: DifficultyConfig = Difficulties.config(Difficulty.Normal); // arbitrary but
// fixed choice: matches W3-01's --capacity, which also rasterizes/packs at
// Normal. Difficulty only changes arrow length/bend odds, never cell count.

/** Packs `mask` into arrows the same way `LevelGenerator.generate` does, for
 * one fixed preview seed, and hands back the resulting board. Empty masks
 * (should not occur per W3-01's "Empty rasters: none" sweep, but a future
 * shape edit could produce one) pack to an empty, still-valid board. */
function packBoard(raster: Raster, seed: number): BoardLogic {
  const rng = new DotNetRandom(seed);
  const arrows = LevelGenerator.fillMask(raster.mask, raster.rows, raster.cols, PREVIEW_CFG, rng);
  const board = new BoardLogic(raster.rows, raster.cols);
  for (const arrow of arrows) board.add(arrow);
  return board;
}

/** The board as pure SVG paths — identical geometry to BoardView's render and
 * to `scripts/generate-promo-art.ts`'s `boardSvg` (read as reference, not
 * imported: that file has no exported members, only a `main()`). */
function boardPathsSvg(board: BoardLogic, cell: number, ink: string): string {
  let paths = '';
  for (const arrow of board.arrows()) {
    const art = arrowArt(arrow, cell);
    paths +=
      `<path d="${art.shaftD}" stroke="${ink}" stroke-width="${STROKE * cell}" ` +
      `stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
      `<path d="${art.headD}" fill="${ink}"/>`;
  }
  return paths;
}

// ---- Single-shape mode ------------------------------------------------------

async function runSingle(name: string, rows: number, outDir: string): Promise<void> {
  const shape = shapeByName(name);
  const raster = rasterAt(shape, rows);
  const clampRaster = rasterAt(shape, GRID_CLAMP_ROWS);

  console.log(`Shape: ${shape.name} (aspect ${shape.aspect})`);
  console.log(`Rows: ${raster.rows}, Cols: ${raster.cols} `
    + `(clamp(roundHalfToEven(${raster.rows}*${shape.aspect}), 4, 46))`);
  console.log(`Mask: ${raster.rows}x${raster.cols}, cells filled: ${raster.cells}/${raster.rows * raster.cols} `
    + `(${(raster.fillFraction * 100).toFixed(1)}%)`);
  console.log(`Capacity at the grid clamp (rows=${GRID_CLAMP_ROWS}): `
    + `cols=${clampRaster.cols}, cells=${clampRaster.cells} `
    + `(${(clampRaster.fillFraction * 100).toFixed(1)}%)`
    + (rows === GRID_CLAMP_ROWS ? ' — same run as above, since rows=46 IS the clamp' : ''));
  console.log(`Generator ${v2AdmissionLabel(v2Admission(shape))} at V2_MAX_GRID_DIM=${V2_MAX_GRID_DIM}`);
  console.log('');
  console.log('ASCII mask:');
  console.log(asciiMask(raster.mask));
  console.log('');

  const board = packBoard(raster, PREVIEW_SEED);
  console.log(`Packed ${board.arrows().length} arrows (DotNetRandom(${PREVIEW_SEED}), Normal config).`);

  const CELL = 24; // OWNER-PICKED STARTING VALUE (diagnostic preview, not shipped UI)
  const w = raster.cols * CELL;
  const h = raster.rows * CELL;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${Daylight.bg}"/>
    ${boardPathsSvg(board, CELL, Daylight.ink)}
  </svg>`;

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${shape.name}-rows${rows}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

// ---- Contact-sheet mode ------------------------------------------------------

const TILE_CELL_PX = 4; // OWNER-PICKED STARTING VALUE (diagnostic layout only)
const LABEL_COLUMN_PX = 130; // OWNER-PICKED STARTING VALUE
const TILE_COLUMN_PX = 220; // OWNER-PICKED STARTING VALUE (fits a 46-cell tile at TILE_CELL_PX + caption)
const CAPTION_PX = 15; // OWNER-PICKED STARTING VALUE
const ROW_LABEL_FONT_PX = 14; // OWNER-PICKED STARTING VALUE
const CAPTION_FONT_PX = 11; // OWNER-PICKED STARTING VALUE
const HEADER_FONT_PX = 20; // OWNER-PICKED STARTING VALUE
const HEADER_HEIGHT_PX = 66; // OWNER-PICKED STARTING VALUE
const ROW_GAP_PX = 8; // OWNER-PICKED STARTING VALUE
const TEXT_LEFT_PX = 10; // OWNER-PICKED STARTING VALUE
const BOLD_WEIGHT = 700;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

interface ShapeCells {
  readonly shape: ShapeDef;
  readonly rasters: readonly Raster[]; // one per CONTACT_SHEET_ROWS entry, same order
  readonly v2: V2Admission;
}

function contactSheetSvg(entries: readonly ShapeCells[]): string {
  const rowHeight = Math.max(TILE_CELL_PX * GRID_CLAMP_ROWS, 40) + CAPTION_PX + 6;
  const width = LABEL_COLUMN_PX + CONTACT_SHEET_ROWS.length * TILE_COLUMN_PX;
  const rowY = entries.map((_, index) => HEADER_HEIGHT_PX + index * (rowHeight + ROW_GAP_PX));
  const height = HEADER_HEIGHT_PX + entries.length * (rowHeight + ROW_GAP_PX) + TEXT_LEFT_PX;

  const header: string[] = [
    `<text x="${TEXT_LEFT_PX}" y="24" fill="${Daylight.ink}" font-family="sans-serif" `
    + `font-size="${HEADER_FONT_PX}" font-weight="${BOLD_WEIGHT}">`
    + `Shape preview — W3-04 (${entries.length} shapes x ${CONTACT_SHEET_ROWS.length} row counts `
    + `= ${entries.length * CONTACT_SHEET_ROWS.length} tiles)</text>`,
    `<text x="${TEXT_LEFT_PX}" y="42" fill="${Daylight.inkDim}" font-family="sans-serif" `
    + `font-size="${CAPTION_FONT_PX + 1}">rasterize() -> LevelGenerator.fillMask(DotNetRandom(${PREVIEW_SEED}), `
    + `Normal) -> arrowArt(), the exact shipping pipeline.</text>`,
  ];
  CONTACT_SHEET_ROWS.forEach((rows, index) => {
    header.push(
      `<text x="${LABEL_COLUMN_PX + index * TILE_COLUMN_PX}" y="${HEADER_HEIGHT_PX - 8}" `
      + `fill="${Daylight.inkDim}" font-family="sans-serif" font-size="${CAPTION_FONT_PX + 1}">`
      + `rows=${rows}</text>`,
    );
  });

  const tiles: string[] = [];
  const labels: string[] = [];
  entries.forEach((entry, rowIndex) => {
    const rowCenter = rowY[rowIndex] + rowHeight / 2;
    labels.push(
      `<text x="${TEXT_LEFT_PX}" y="${rowCenter}" fill="${Daylight.ink}" font-family="sans-serif" `
      + `font-size="${ROW_LABEL_FONT_PX}" font-weight="${BOLD_WEIGHT}">${escapeXml(entry.shape.name)}</text>`,
      `<text x="${TEXT_LEFT_PX}" y="${rowCenter + ROW_LABEL_FONT_PX + 2}" `
      + `fill="${entry.v2.admitted ? Daylight.inkDim : '#D1264C'}" font-family="sans-serif" `
      + `font-size="${CAPTION_FONT_PX - 1}">${entry.v2.admitted ? 'v2: admitted' : 'v2: excluded'}</text>`,
      `<text x="${TEXT_LEFT_PX}" y="${rowCenter + ROW_LABEL_FONT_PX + 2 + CAPTION_FONT_PX}" `
      + `fill="${Daylight.inkDim}" font-family="sans-serif" font-size="${CAPTION_FONT_PX - 1}">`
      + `${escapeXml(`cap ${entry.v2.capacity} ${entry.v2.admitted ? '>=' : '<'} ${entry.v2.windowMax}`)}</text>`,
    );

    entry.rasters.forEach((raster, colIndex) => {
      const x = LABEL_COLUMN_PX + colIndex * TILE_COLUMN_PX;
      const y = rowY[rowIndex];
      const w = raster.cols * TILE_CELL_PX;
      const h = raster.rows * TILE_CELL_PX;
      const bg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${Daylight.surface}"/>`;

      let body: string;
      if (raster.cells === 0) {
        body = `<text x="${x + w / 2}" y="${y + h / 2}" fill="#D1264C" font-family="sans-serif" `
          + `font-size="${CAPTION_FONT_PX}" font-weight="${BOLD_WEIGHT}" text-anchor="middle" `
          + `dominant-baseline="middle">EMPTY</text>`;
      } else {
        const board = packBoard(raster, PREVIEW_SEED);
        body = `<g transform="translate(${x} ${y})">${boardPathsSvg(board, TILE_CELL_PX, Daylight.ink)}</g>`;
      }

      const flag = raster.cells === 0 ? ' — EMPTY' : '';
      const caption = `${raster.rows}x${raster.cols} . ${raster.cells} cells `
        + `(${(raster.fillFraction * 100).toFixed(1)}%)${flag}`;
      tiles.push(bg, body);
      labels.push(
        `<text x="${x}" y="${y + h + CAPTION_PX}" `
        + `fill="${raster.cells === 0 ? '#D1264C' : Daylight.inkDim}" font-family="sans-serif" `
        + `font-size="${CAPTION_FONT_PX}">${escapeXml(caption)}</text>`,
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

async function runAll(outDir: string): Promise<void> {
  const shapes = allShapes();
  const entries: ShapeCells[] = shapes.map((shape) => ({
    shape,
    rasters: CONTACT_SHEET_ROWS.map((rows) => rasterAt(shape, rows)),
    v2: v2Admission(shape),
  }));

  console.log(`Shape catalogue: ${shapes.length} shapes x ${CONTACT_SHEET_ROWS.length} row counts `
    + `= ${shapes.length * CONTACT_SHEET_ROWS.length} tiles.`);
  console.log('');
  console.log(['shape', ...CONTACT_SHEET_ROWS.map((r) => `rows=${r}`), `v2 (V2_MAX_GRID_DIM=${V2_MAX_GRID_DIM})`].join('\t'));
  for (const entry of entries) {
    const cells = entry.rasters.map((r) => `${r.cells}/${r.rows * r.cols} (${r.rows}x${r.cols})`);
    console.log([entry.shape.name, ...cells, v2AdmissionLabel(entry.v2)].join('\t'));
  }
  const excluded = entries.filter((e) => !e.v2.admitted).map((e) => e.shape.name);
  console.log('');
  console.log(`v2 admits ${entries.length - excluded.length} of ${entries.length}; excluded (${excluded.length}): ${excluded.join(', ')}`);
  const empties = entries.flatMap((e) => e.rasters
    .filter((r) => r.cells === 0)
    .map((r) => `${e.shape.name}@rows=${r.rows}`));
  console.log('');
  console.log(empties.length === 0 ? 'Empty rasters: none' : `Empty rasters (${empties.length}): ${empties.join(', ')}`);

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'contact-sheet.png');
  await sharp(Buffer.from(contactSheetSvg(entries))).png().toFile(outPath);
  console.log('');
  console.log(`Wrote ${outPath} (${entries.length * CONTACT_SHEET_ROWS.length} labelled tiles)`);
}

// ---- CLI --------------------------------------------------------------------

function usage(): never {
  console.error(
    'Usage:\n'
    + '  shape-preview --name <Shape> --rows <N> [--out <dir>]\n'
    + '  shape-preview --all [--out <dir>]',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let name: string | null = null;
  let rows: number | null = null;
  let all = false;
  let outDir = os.tmpdir();

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--name': name = argv[++i]; break;
      case '--rows': rows = Number(argv[++i]); break;
      case '--all': all = true; break;
      case '--out': outDir = argv[++i]; break;
      default: throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }

  if (all) {
    if (name !== null || rows !== null) usage();
    await runAll(outDir);
    return;
  }

  if (name === null || rows === null || !Number.isFinite(rows) || rows <= 0) usage();
  await runSingle(name!, rows!, outDir);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

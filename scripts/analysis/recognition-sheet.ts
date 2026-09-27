/**
 * W3-18 — the owner's recognition sheet for a batch of newly authored shapes (W3-19's input).
 *
 * The owner shows the sheet to someone who has not seen the shape list and asks "what object is
 * this?" for each number. The sheet therefore carries NO shape names (and its file name none);
 * the answer key is a separate text file.
 *
 * Each numbered panel shows the shape two ways, both through the shipping code:
 * - the gallery tile a player sees once collected: `galleryTilePath(id, 40)` (W4-08/W4-09's owner
 *   picks, 14 raster rows on a 40 dp tile), filled in Daylight ink with the even-odd rule;
 * - a mid-game board: the shape at the size generator v2 would deal it at displayed level
 *   MID_GAME_LEVEL (`v2GridFor(shape, Normal target of configV2(Normal, index))`), packed into
 *   arrows with `LevelGenerator.fillMask` (W3-04's preview seed and config) and drawn with
 *   `arrowArt`/`STROKE`, fit to the 360 x 689 dp board viewport W3-08 logged (FIT_MARGIN 0.94).
 *
 * Scale: the sheet is 360 dp wide at 2 px per dp (720 px), so opened full-width on a 2x-density
 * phone every tile and board is the size a player sees; on any other screen their relative size
 * is still exact.
 *
 * Per id it also writes `<out>/<id>/gallery-14r-40dp.png` (40 px, 1 px per dp, as W4-08's
 * owner-legibility sheet) and `gallery-14r-40dp@3x.png` (120 px, a 3x phone).
 *
 * Run: npx tsx scripts/analysis/recognition-sheet.ts --ids House,Teacup,Bell,Umbrella --out artifacts/W3-18
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import {
  BoardLogic,
  Difficulties,
  Difficulty,
  DotNetRandom,
  LevelGenerator,
  SHAPE_CATALOGUE,
  ShapeDef,
  catalogueIndexOf,
  shapeCapacity,
  shapeDefFor,
  v2GridFor,
} from '../../src/core';
import { arrowArt, STROKE } from '../../src/ui/arrowGeometry';
import { FIT_MARGIN } from '../../src/ui/boardCamera';
import { GALLERY_TILE_DP, galleryRasterSize, galleryTilePath } from '../../src/ui/galleryLayout';
import { Daylight } from '../../src/ui/theme';

/** Displayed level whose Normal target sizes the "mid-game" board: half way to the curve's saturation at 400. */
const MID_GAME_LEVEL = 200; // OWNER-PICKED STARTING VALUE (W3-14's curve saturates at displayed level 400)
const PREVIEW_SEED = 1234; // W3-04's preview seed
const PX_PER_DP = 2; // the sheet is 360 dp wide at 2x
const PHONE_WIDTH_DP = 360; // W3-08's logged phone
const BOARD_VIEWPORT_DP = { width: 360, height: 689 }; // W3-08's logged board viewport
const PANEL_HEADER_DP = 64; // OWNER-PICKED STARTING VALUE (layout only)
const PANEL_GAP_DP = 28; // OWNER-PICKED STARTING VALUE (layout only)
const TITLE_DP = 66; // OWNER-PICKED STARTING VALUE (layout only)

interface Panel {
  readonly number: number;
  readonly id: string;
  readonly shape: ShapeDef;
  readonly rows: number;
  readonly cols: number;
  readonly target: number;
  readonly cells: number;
  readonly cellDp: number;
  readonly board: BoardLogic;
}

function countTrue(mask: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of mask) for (const cell of row) if (cell) n++;
  return n;
}

function panelFor(id: string, number: number): Panel {
  const shape = shapeDefFor(id);
  if (shape === null) throw new Error(`Unknown catalogue id '${id}'. Catalogue: ${SHAPE_CATALOGUE.join(', ')}`);
  const index = MID_GAME_LEVEL - 1;
  const target = Difficulties.configV2(Difficulty.Normal, index).maxCells;
  const { rows, cols } = v2GridFor(shape, target);
  const mask = shape.rasterize(rows, cols);
  const arrows = LevelGenerator.fillMask(mask, rows, cols, Difficulties.config(Difficulty.Normal), new DotNetRandom(PREVIEW_SEED));
  const board = new BoardLogic(rows, cols);
  for (const a of arrows) board.add(a);
  const cellDp = Math.min(
    (FIT_MARGIN * BOARD_VIEWPORT_DP.width) / cols,
    (FIT_MARGIN * BOARD_VIEWPORT_DP.height) / rows,
  );
  return { number, id, shape, rows, cols, target, cells: countTrue(mask), cellDp, board };
}

function boardSvg(board: BoardLogic, cellPx: number): string {
  let paths = '';
  for (const arrow of board.arrows()) {
    const art = arrowArt(arrow, cellPx);
    paths +=
      `<path d="${art.shaftD}" stroke="${Daylight.ink}" stroke-width="${STROKE * cellPx}" `
      + 'stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      + `<path d="${art.headD}" fill="${Daylight.ink}"/>`;
  }
  return paths;
}

function text(x: number, y: number, size: number, fill: string, body: string, extra = ''): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="sans-serif" font-size="${size}" ${extra}>${body}</text>`;
}

function sheetSvg(panels: readonly Panel[]): { svg: string; width: number; height: number } {
  const s = PX_PER_DP;
  const width = PHONE_WIDTH_DP * s;
  const parts: string[] = [];
  parts.push(text(16 * s, 30 * s, 20 * s, Daylight.ink, 'What object is this?', 'font-weight="700"'));
  parts.push(text(16 * s, 48 * s, 11 * s, Daylight.inkDim,
    `Numbered 1-${panels.length}: a gallery tile, then a mid-game board.`));
  let y = TITLE_DP;
  for (const p of panels) {
    const boardW = p.cols * p.cellDp;
    const boardH = p.rows * p.cellDp;
    // Header: the number, then the gallery tile as a collected shape looks.
    parts.push(`<rect x="0" y="${y * s}" width="${width}" height="${(PANEL_HEADER_DP + boardH + 12) * s}" fill="${Daylight.bg}"/>`);
    if (p.number > 1) {
      parts.push(`<line x1="${16 * s}" y1="${(y - PANEL_GAP_DP / 2) * s}" x2="${width - 16 * s}" y2="${(y - PANEL_GAP_DP / 2) * s}" stroke="${Daylight.surface}" stroke-width="${2 * s}"/>`);
    }
    parts.push(text(16 * s, (y + 38) * s, 36 * s, Daylight.ink, String(p.number), 'font-weight="700"'));
    const tileX = 64;
    const tileY = y + 8;
    parts.push(`<rect x="${tileX * s}" y="${tileY * s}" width="${GALLERY_TILE_DP * s}" height="${GALLERY_TILE_DP * s}" fill="${Daylight.surface}"/>`);
    parts.push(`<g transform="translate(${tileX * s} ${tileY * s}) scale(${s})"><path d="${galleryTilePath(p.id, GALLERY_TILE_DP)}" fill="${Daylight.ink}" fill-rule="evenodd"/></g>`);
    parts.push(text((tileX + GALLERY_TILE_DP + 10) * s, (tileY + 24) * s, 10 * s, Daylight.inkDim, 'gallery tile, 40 dp'));
    // Board, centred in the phone width.
    const boardX = (PHONE_WIDTH_DP - boardW) / 2;
    const boardY = y + PANEL_HEADER_DP;
    parts.push(`<g transform="translate(${boardX * s} ${boardY * s})">${boardSvg(p.board, p.cellDp * s)}</g>`);
    y = boardY + boardH + PANEL_GAP_DP;
  }
  const height = y * s;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<rect width="${width}" height="${height}" fill="${Daylight.bg}"/>${parts.join('\n')}</svg>`;
  return { svg, width, height };
}

async function writeGalleryTiles(outDir: string, id: string): Promise<string[]> {
  const dir = path.join(outDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [scale, suffix] of [[1, ''], [3, '@3x']] as const) {
    const size = GALLERY_TILE_DP * scale;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
      + `<rect width="${size}" height="${size}" fill="${Daylight.bg}"/>`
      + `<g transform="scale(${scale})"><path d="${galleryTilePath(id, GALLERY_TILE_DP)}" fill="${Daylight.ink}" fill-rule="evenodd"/></g></svg>`;
    const file = path.join(dir, `gallery-14r-40dp${suffix}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    written.push(file);
  }
  return written;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let ids: string[] = [];
  let outDir = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ids') ids = argv[++i].split(',').map((x) => x.trim()).filter((x) => x.length > 0);
    else if (argv[i] === '--out') outDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (ids.length === 0 || outDir === '') {
    throw new Error('Usage: npx tsx scripts/analysis/recognition-sheet.ts --ids <A,B,...> --out <dir>');
  }
  fs.mkdirSync(outDir, { recursive: true });

  const panels = ids.map((id, k) => panelFor(id, k + 1));
  const { svg, width, height } = sheetSvg(panels);
  const sheetPath = path.join(outDir, 'owner-recognition-sheet.png');
  await sharp(Buffer.from(svg)).png().toFile(sheetPath);
  console.log(`Wrote ${sheetPath} (${width}x${height} px, ${PX_PER_DP} px per dp, no names)`);

  const key: string[] = [
    'W3-18 owner recognition sheet: ANSWER KEY. Keep it away from the person looking at the sheet.',
    `Sheet: ${sheetPath}`,
    '',
  ];
  for (const p of panels) {
    const tile = galleryRasterSize(p.shape.aspect);
    key.push(`${p.number} = ${p.id} (catalogue index ${catalogueIndexOf(p.id)})`);
    key.push(`    gallery tile: ${tile.rows}x${tile.cols} raster on a ${GALLERY_TILE_DP} dp tile`);
    key.push(`    board: ${p.rows}x${p.cols}, ${p.cells} cells, ${p.board.arrows().length} arrows; Normal target ${p.target} at displayed level ${MID_GAME_LEVEL} (v2GridFor); fit cell ${p.cellDp.toFixed(2)} dp`);
    key.push(`    capacity at the v2 clamp: ${shapeCapacity(p.shape)} cells`);
    for (const f of await writeGalleryTiles(outDir, p.id)) console.log(`Wrote ${f}`);
  }
  key.push('');
  key.push('Protocol (W3-19, docs/next-level/tasks/W3.md): BEFORE showing the sheet, write down the pass rule');
  key.push('(the owner\'s pick; draft 1 used "4 of 5 correct"; the number of testers is the owner\'s call). Then show');
  key.push('the sheet to at least one person who has not seen the shape list; for each number ask "what object is');
  key.push('this?" with no options, and write the answer down verbatim. A failing shape is reworked once, then cut.');
  key.push('');
  const keyPath = path.join(outDir, 'answer-key.txt');
  fs.writeFileSync(keyPath, key.join('\n'), 'utf8');
  console.log(`Wrote ${keyPath}`);
  console.log(key.join('\n'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

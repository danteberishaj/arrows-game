/**
 * Renders every generated silhouette at candidate UI sizes.
 *
 * Run: npx tsx scripts/art/silhouette-sheet.ts --sizes 16,24,48,64,96
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { LevelGenerator } from '../../src/core/levelGenerator';
import { ShapeDef, ShapeLibrary } from '../../src/core/shapeLibrary';
import { silhouettePath } from '../../src/ui/silhouette';
import { Daylight, InkNight } from '../../src/ui/theme';

const PIXELS_PER_DP = 3.5;
const PANEL_COLUMNS = 2; // OWNER-PICKED STARTING VALUE
const LABEL_WIDTH_PX = 196; // OWNER-PICKED STARTING VALUE
const PANEL_GAP_PX = 28; // OWNER-PICKED STARTING VALUE
const HEADER_HEIGHT_PX = 76; // OWNER-PICKED STARTING VALUE
const TEXT_LEFT_PX = 12; // OWNER-PICKED STARTING VALUE
const TITLE_FONT_PX = 24; // OWNER-PICKED STARTING VALUE
const LEGEND_FONT_PX = 13; // OWNER-PICKED STARTING VALUE
const SHAPE_FONT_PX = 13; // OWNER-PICKED STARTING VALUE
const DETAIL_FONT_PX = 10; // OWNER-PICKED STARTING VALUE
const TITLE_BASELINE_PX = 30; // OWNER-PICKED STARTING VALUE
const LEGEND_BASELINE_PX = 55; // OWNER-PICKED STARTING VALUE
const SHAPE_BASELINE_NUDGE_PX = -2; // OWNER-PICKED STARTING VALUE
const DETAIL_BASELINE_NUDGE_PX = 12; // OWNER-PICKED STARTING VALUE
const BOLD_FONT_WEIGHT = 700; // OWNER-PICKED STARTING VALUE
const OUTPUT_DIRECTORY = path.join(__dirname, '..', '..', 'out', 'art');

interface Appearance {
  readonly shape: ShapeDef;
  readonly levelIndex: number;
  readonly rows: number;
  readonly cols: number;
}

interface TileVariant {
  readonly fill: string;
  readonly background: string;
}

const TILE_VARIANTS: readonly TileVariant[] = [
  { fill: Daylight.accent, background: Daylight.surface },
  { fill: Daylight.inkDim, background: Daylight.bg },
  { fill: InkNight.accent, background: InkNight.surface },
  { fill: InkNight.inkDim, background: InkNight.bg },
];

function allShapes(): readonly ShapeDef[] {
  const byName = new Map<string, ShapeDef>();
  for (const pool of [
    ShapeLibrary.SimplePool,
    ShapeLibrary.MediumPool,
    ShapeLibrary.ComplexPool,
  ]) {
    for (const shape of pool) byName.set(shape.name, shape);
  }
  return [...byName.values()];
}

function firstAppearances(shapes: readonly ShapeDef[]): readonly Appearance[] {
  const shapesByName = new Map(shapes.map((shape) => [shape.name, shape]));
  const found = new Map<string, Appearance>();

  for (let levelIndex = 0; found.size < shapesByName.size; levelIndex++) {
    const level = LevelGenerator.generate(levelIndex);
    const shape = shapesByName.get(level.shapeName);
    if (shape === undefined || found.has(shape.name)) continue;

    found.set(shape.name, {
      shape,
      levelIndex,
      rows: level.board.rows,
      cols: level.board.cols,
    });
  }

  return shapes.map((shape) => {
    const appearance = found.get(shape.name);
    if (appearance === undefined) throw new Error(`No generated level found for ${shape.name}`);
    return appearance;
  });
}

function parseSizes(args: readonly string[]): readonly number[] {
  const equalsArgument = args.find((argument) => argument.startsWith('--sizes='));
  const flagIndex = args.indexOf('--sizes');
  const value = equalsArgument?.slice('--sizes='.length)
    ?? (flagIndex >= 0 ? args[flagIndex + 1] : undefined);
  if (value === undefined || value.length === 0) {
    throw new Error('Usage: npx tsx scripts/art/silhouette-sheet.ts --sizes <dp,dp,...>');
  }

  const sizes = value.split(',').map((part) => Number(part));
  if (sizes.some((size) => !Number.isInteger(size) || size <= 0)) {
    throw new Error('--sizes must be a comma-separated list of positive integer dp values');
  }
  return [...new Set(sizes)];
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function contactSheetSvg(appearances: readonly Appearance[], sizeDp: number): string {
  const tilePixels = sizeDp * PIXELS_PER_DP;
  const rowsPerPanel = Math.ceil(appearances.length / PANEL_COLUMNS);
  const panelWidth = LABEL_WIDTH_PX + TILE_VARIANTS.length * tilePixels;
  const width = PANEL_COLUMNS * panelWidth + (PANEL_COLUMNS - 1) * PANEL_GAP_PX;
  const height = HEADER_HEIGHT_PX + rowsPerPanel * tilePixels;
  const tiles: string[] = [];
  const labels: string[] = [];

  for (let index = 0; index < appearances.length; index++) {
    const appearance = appearances[index];
    const panel = Math.floor(index / rowsPerPanel);
    const row = index % rowsPerPanel;
    const panelX = panel * (panelWidth + PANEL_GAP_PX);
    const y = HEADER_HEIGHT_PX + row * tilePixels;
    const mask = appearance.shape.rasterize(appearance.rows, appearance.cols);
    const silhouette = silhouettePath(mask, sizeDp);

    labels.push(
      `<text x="${panelX + TEXT_LEFT_PX}" y="${y + tilePixels / 2 + SHAPE_BASELINE_NUDGE_PX}" `
      + `fill="${Daylight.ink}" font-family="sans-serif" font-size="${SHAPE_FONT_PX}" `
      + `font-weight="${BOLD_FONT_WEIGHT}">${escapeXml(appearance.shape.name)}</text>`,
      `<text x="${panelX + TEXT_LEFT_PX}" y="${y + tilePixels / 2 + DETAIL_BASELINE_NUDGE_PX}" `
      + `fill="${Daylight.inkDim}" font-family="sans-serif" font-size="${DETAIL_FONT_PX}">`
      + `level ${appearance.levelIndex} · ${appearance.rows}×${appearance.cols}</text>`,
    );

    for (let variantIndex = 0; variantIndex < TILE_VARIANTS.length; variantIndex++) {
      const variant = TILE_VARIANTS[variantIndex];
      const x = panelX + LABEL_WIDTH_PX + variantIndex * tilePixels;
      tiles.push(
        `<rect x="${x}" y="${y}" width="${tilePixels}" height="${tilePixels}" `
        + `fill="${variant.background}"/>`,
        `<path d="${silhouette}" fill="${variant.fill}" fill-rule="evenodd" `
        + `transform="translate(${x} ${y}) scale(${PIXELS_PER_DP})"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${Daylight.bg}"/>
    <text x="${TEXT_LEFT_PX}" y="${TITLE_BASELINE_PX}" fill="${Daylight.ink}" font-family="sans-serif"
      font-size="${TITLE_FONT_PX}" font-weight="${BOLD_FONT_WEIGHT}">Silhouettes at ${sizeDp}dp (${tilePixels}px tiles)</text>
    <text x="${TEXT_LEFT_PX}" y="${LEGEND_BASELINE_PX}" fill="${Daylight.inkDim}" font-family="sans-serif"
      font-size="${LEGEND_FONT_PX}">Tile order: Day accent/surface · Day inkDim/bg · Night accent/surface · Night inkDim/bg</text>
    ${tiles.join('\n')}
    ${labels.join('\n')}
  </svg>`;
}

function printAppearanceTable(appearances: readonly Appearance[]): void {
  console.log('Shape-to-first-level table');
  console.log('Shape\tLevel index\tGrid');
  for (const appearance of appearances) {
    console.log(`${appearance.shape.name}\t${appearance.levelIndex}\t${appearance.rows}x${appearance.cols}`);
  }
}

async function main(): Promise<void> {
  const sizes = parseSizes(process.argv.slice(2));
  const appearances = firstAppearances(allShapes());
  printAppearanceTable(appearances);
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  for (const size of sizes) {
    const outputPath = path.join(OUTPUT_DIRECTORY, `silhouette-sheet-${size}dp.png`);
    await sharp(Buffer.from(contactSheetSvg(appearances, size))).png().toFile(outputPath);
    console.log(`Wrote ${outputPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * W5-15: dead-band decision aid.
 *
 * Reads the three geometries W1-01 measured and logged on `emulator-5556`
 * (docs/board-viewport-measured.md) and, for generated levels `--from..--to`
 * (inclusive), computes the board height BoardView draws when fully zoomed
 * out and the empty vertical slack left above and below it.
 *
 * Formula (BoardView's own fully-zoomed-out fit, `src/ui/boardCamera.ts`
 * `initialCamera`'s `!zoomed` branch, `fit = min(vw/boardW, vh/boardH) *
 * FIT_MARGIN` with `boardW = cols*CELL`, `boardH = rows*CELL` — `CELL`
 * cancels out of the ratio):
 *
 *   cellPt        = FIT_MARGIN * min(vw / cols, vh / rows)
 *   boardHeightPt = cellPt * rows
 *   slackPerSide  = (vh - boardHeightPt) / 2   -- initialCamera centres the
 *                                                 board: ty = (vh - boardH*fit)/2
 *
 * `FIT_MARGIN` is imported from `src/ui/boardCamera.ts` (already exported)
 * rather than re-declared, per the brief's controller amendment F30 ("Level
 * metrics and cellPt are implemented three times ... prefer importing one
 * pure function"). This file is unavoidably a fourth *file* that computes
 * cellPt — the brief's Files list names exactly `scripts/analysis/dead-band.ts`
 * — but it shares the one constant that matters (`FIT_MARGIN`) instead of
 * re-guessing it. `CELL` (also exported, `src/ui/BoardView.tsx`) is not
 * needed: it cancels out of the fit ratio algebraically, the same
 * simplification `scripts/analysis/ftue-board-metrics.ts` already uses.
 *
 * Neither `src/ui/boardCamera.ts` nor `src/ui/BoardView.tsx` is edited by
 * this task; only their already-exported constants are imported.
 *
 * IMPORTANT (found while capturing the real device evidence for this task,
 * see docs/dead-band-decision.md "Which camera the numbers model"): this
 * formula is the `!zoomed` branch of `initialCamera` -- the board's SHIPPED
 * DEFAULT, since `META_ZOOMED_CAMERA` (`src/featureFlags.ts`) defaults OFF.
 * Every test APK available to this task (`EXPO_PUBLIC_META_ZOOMED_CAMERA=1`,
 * a "controller extras" build flag) instead opens with the OTHER branch,
 * which shows fewer, larger cells and therefore a SMALLER dead-band than
 * this script computes. This script deliberately models the flag-OFF
 * default that ships to players, not the flag-ON test build a real capture
 * had to use; the doc reconciles both numbers against the same real capture.
 *
 * Run: npx tsx scripts/analysis/dead-band.ts --from 0 --to 300
 * Run (mocks): npx tsx scripts/analysis/dead-band.ts --mocks
 *   --daylight <real-capture.png> --ink-night <real-capture.png> --out-dir <dir>
 *
 * Determinism: `Core.LevelGenerator.generate(levelIndex)` is a pure function
 * of the level index (default `version` 1), so this script's output is a
 * pure function of `--from/--to` and is identical across runs (the
 * acceptance criterion).
 */
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import * as Core from '../../src/core';
import { FIT_MARGIN } from '../../src/ui/boardCamera';

interface Geometry {
  readonly label: string;
  readonly source: string;
  readonly vw: number;
  readonly vh: number;
}

interface GeometryPair {
  readonly name: string;
  /** W1-01's "Logged viewport (dp)" column: the raw, un-adjusted BoardView.onLayout report. */
  readonly logged: Geometry;
  /**
   * W1-01's UIAutomator-cross-checked visible board height, with the
   * device-reported system-bar inset subtracted (agreement <= 1dp, PASS at
   * all three rows of the doc's measurement table). This is the actual
   * on-screen viewport BoardView draws into.
   */
  readonly adjusted: Geometry;
}

// Sourced verbatim from docs/board-viewport-measured.md (fix-round-1,
// EXECUTED on emulator-5556, API 31, base commit d8960aa0c4f14aea7de4642b8ddaa0179e6797a4).
const GEOMETRIES: readonly GeometryPair[] = [
  {
    name: 'native 1440x3120@560 (nominal 411x891dp)',
    logged: { label: 'logged', source: 'W1-01 "Logged viewport (dp)"', vw: 411.428558, vh: 804.285706 },
    adjusted: { label: 'adjusted', source: 'W1-01 "Raw UI board" / UIAutomator, PASS', vw: 411.428571, vh: 756.285714 },
  },
  {
    name: '1080x2340@480 (nominal 360x780dp)',
    logged: { label: 'logged', source: 'W1-01 "Logged viewport (dp)"', vw: 360, vh: 689 },
    adjusted: { label: 'adjusted', source: 'W1-01 "Raw UI board" / UIAutomator, PASS', vw: 360, vh: 633 },
  },
  {
    name: '1080x1920@480 (nominal 360x640dp)',
    logged: { label: 'logged', source: 'W1-01 "Logged viewport (dp)"', vw: 360, vh: 549 },
    adjusted: { label: 'adjusted', source: 'W1-01 "Raw UI board" / UIAutomator, PASS', vw: 360, vh: 493 },
  },
];

/** The geometry P-02 captures the worst-slack level at (the brief's "360x780 dp"). */
const CAPTURE_GEOMETRY_NAME = '1080x2340@480 (nominal 360x780dp)';

interface AnalyseOptions {
  readonly mode: 'analyse';
  readonly from: number;
  readonly to: number;
}

interface MocksOptions {
  readonly mode: 'mocks';
  readonly daylight: string;
  readonly inkNight: string;
  readonly outDir: string;
}

type Options = AnalyseOptions | MocksOptions;

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(
    'Usage: npx tsx scripts/analysis/dead-band.ts --from N --to M\n'
      + '   or: npx tsx scripts/analysis/dead-band.ts --mocks --daylight <png> --ink-night <png> --out-dir <dir>',
  );
  process.exit(1);
}

function parseArgs(argv: readonly string[]): Options {
  if (argv.includes('--mocks')) {
    let daylight: string | null = null;
    let inkNight: string | null = null;
    let outDir: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
      const flag = argv[i];
      if (flag === '--mocks') continue;
      else if (flag === '--daylight') daylight = argv[++i] ?? usage('--daylight requires a path');
      else if (flag === '--ink-night') inkNight = argv[++i] ?? usage('--ink-night requires a path');
      else if (flag === '--out-dir') outDir = argv[++i] ?? usage('--out-dir requires a path');
      else usage(`Unknown argument: ${flag}`);
    }
    if (daylight === null || inkNight === null || outDir === null) {
      usage('--mocks requires --daylight, --ink-night and --out-dir');
    }
    return { mode: 'mocks', daylight, inkNight, outDir };
  }

  let from: number | null = null;
  let to: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--from') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) usage('--from requires a non-negative integer');
      from = value;
    } else if (flag === '--to') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) usage('--to requires a non-negative integer');
      to = value;
    } else {
      usage(`Unknown argument: ${flag}`);
    }
  }
  if (from === null || to === null) usage('--from and --to are both required');
  if (to < from) usage('--to must be >= --from');
  return { mode: 'analyse', from, to };
}

interface LevelSlack {
  readonly levelIndex: number;
  readonly rows: number;
  readonly cols: number;
  readonly shapeName: string;
  readonly cellPt: number;
  readonly boardHeightPt: number;
  readonly slackPerSidePt: number;
}

function slackFor(geometry: Geometry, rows: number, cols: number): { cellPt: number; boardHeightPt: number; slackPerSidePt: number } {
  const cellPt = FIT_MARGIN * Math.min(geometry.vw / cols, geometry.vh / rows);
  const boardHeightPt = cellPt * rows;
  const slackPerSidePt = (geometry.vh - boardHeightPt) / 2;
  return { cellPt, boardHeightPt, slackPerSidePt };
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function fmt(n: number): string {
  return n.toFixed(3);
}

function analyseGeometry(geometry: Geometry, from: number, to: number): readonly LevelSlack[] {
  const results: LevelSlack[] = [];
  for (let levelIndex = from; levelIndex <= to; levelIndex += 1) {
    const level = Core.LevelGenerator.generate(levelIndex);
    const { rows, cols } = level.board;
    const { cellPt, boardHeightPt, slackPerSidePt } = slackFor(geometry, rows, cols);
    results.push({
      levelIndex,
      rows,
      cols,
      shapeName: level.shapeName,
      cellPt,
      boardHeightPt,
      slackPerSidePt,
    });
  }
  return results;
}

function printGeometryBlock(pairName: string, variant: Geometry, results: readonly LevelSlack[]): LevelSlack {
  const slacks = results.map((r) => r.slackPerSidePt).slice().sort((a, b) => a - b);
  const worst = results.reduce((a, b) => (b.slackPerSidePt > a.slackPerSidePt ? b : a));
  console.log(`\n-- ${pairName} [${variant.label}: ${variant.source}] --`);
  console.log(`  input viewport: vw=${fmt(variant.vw)}dp vh=${fmt(variant.vh)}dp (FIT_MARGIN=${FIT_MARGIN})`);
  console.log(`  levels: ${results.length} (index ${results[0].levelIndex}..${results[results.length - 1].levelIndex})`);
  console.log(
    `  per-side vertical slack (dp): min=${fmt(slacks[0])} median=${fmt(median(slacks))} max=${fmt(slacks[slacks.length - 1])}`,
  );
  console.log(
    `  worst level: index ${worst.levelIndex} (${worst.shapeName}, ${worst.rows}x${worst.cols}) `
      + `drawnBoardHeight=${fmt(worst.boardHeightPt)}dp cellPt=${fmt(worst.cellPt)}dp slackPerSide=${fmt(worst.slackPerSidePt)}dp`,
  );
  return worst;
}

// ---------------------------------------------------------------- mock composition
//
// P-02-style: composite 4 header/dead-band treatment options over the two
// REAL device captures (Daylight / Ink Night, level 109 "Rectangle" 13x20,
// 360x780dp -- the worst level in 0..500 at the capture geometry, above),
// each stamped "MOCK -- not rendered by the app" per the brief's acceptance
// criteria. Pixel boxes below were measured directly from the real capture
// (a per-row colour-distance-from-background scan; see
// docs/dead-band-decision.md "How the overlay boxes were measured") -- they
// are not guesses.

interface Palette2 {
  readonly bg: string;
  readonly surface: string;
  readonly accent: string;
  readonly border: string;
  readonly ink: string;
  readonly heart: string;
}

const MOCK_PALETTES: Record<'Daylight' | 'InkNight', Palette2> = {
  Daylight: { bg: '#FFFFFF', surface: '#EFEDF8', accent: '#6D4AEF', border: '#8E80C5', ink: '#191724', heart: '#E4327D' },
  InkNight: { bg: '#13111C', surface: '#201D30', accent: '#7B5BF5', border: '#69629E', ink: '#EFEDF9', heart: '#F0468C' },
};

// Measured from artifacts/W5-15/board-109-daylight-360x780.png (1080x2340px,
// wm 1080x2340@480): header bottom ~253px, first arrow-ink row 722px, last
// arrow-ink row 1722px, app content bottom (before the 3-button nav bar)
// 2172px (matches W1-01's own UIAutomator bounds for this exact override).
const HEADER_HEARTS_BOX = { x: 665, y: 148, w: 240, h: 75 };
const HEADER_HINT_BOX = { x: 895, y: 108, w: 150, h: 140 };
const TOP_DEAD_ZONE = { top: 273, bottom: 722 };
const BOTTOM_DEAD_ZONE = { top: 1722, bottom: 2172 };
const GRID_TOGGLE_BOX = { x: 900, y: 2000, w: 160, h: 150 }; // existing dev-only "#" control; left alone in every option

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function stampSvg(width: number, optionLabel: string): string {
  return `
    <rect x="0" y="0" width="${width}" height="92" fill="#B33A00" fill-opacity="0.92"/>
    <text x="24" y="36" font-family="sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">MOCK -- not rendered by the app</text>
    <text x="24" y="70" font-family="sans-serif" font-size="24" fill="#FFEFE6">${escapeXml(optionLabel)}</text>
  `;
}

function eraseBoxSvg(box: { x: number; y: number; w: number; h: number }, fill: string): string {
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${fill}"/>`;
}

function heartsSvg(cx: number, cy: number, color: string): string {
  // Simplified heart glyphs (not the app's actual SVG asset) spaced like the header's 3 hearts.
  const heart = (x: number) => `<path d="M ${x} ${cy + 14} C ${x - 26} ${cy - 12}, ${x - 8} ${cy - 32}, ${x} ${cy - 14} `
    + `C ${x + 8} ${cy - 32}, ${x + 26} ${cy - 12}, ${x} ${cy + 14} Z" fill="${color}"/>`;
  return [heart(cx - 62), heart(cx), heart(cx + 62)].join('\n');
}

function hintGlyphSvg(cx: number, cy: number, color: string): string {
  // A simplified bulb: circle + base rect, standing in for the app's 💡 icon.
  return `<circle cx="${cx}" cy="${cy - 8}" r="26" fill="none" stroke="${color}" stroke-width="6"/>`
    + `<rect x="${cx - 10}" y="${cy + 14}" width="20" height="14" rx="3" fill="${color}"/>`;
}

async function buildOptionA(baseBuffer: Buffer, width: number, height: number, palette: Palette2): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${stampSvg(width, '(A) Today -- unchanged. Shown for comparison; not itself a mock.')}</svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
}

async function buildOptionB(baseBuffer: Buffer, width: number, height: number, palette: Palette2): Promise<Buffer> {
  const railY = BOTTOM_DEAD_ZONE.bottom - 20; // clears the "#" toggle above it and the nav bar below
  const railX0 = 60;
  const railX1 = width - 60;
  const railTrackH = 6; // drawn 6px for legibility; the spec value is 2px (disclosed in the doc and the label)
  const fillFrac = 0.42; // illustrative only -- no real "progress" metric is wired up
  const railFillX1 = railX0 + (railX1 - railX0) * fillFrac;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${stampSvg(width, '(B) 2px-high progress rail in the bottom band (drawn at 6px here for legibility)')}
    <rect x="${railX0}" y="${railY}" width="${railX1 - railX0}" height="${railTrackH}" rx="3" fill="${palette.border}"/>
    <rect x="${railX0}" y="${railY}" width="${railFillX1 - railX0}" height="${railTrackH}" rx="3" fill="${palette.accent}"/>
  </svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
}

async function buildOptionC(baseBuffer: Buffer, width: number, height: number, palette: Palette2): Promise<Buffer> {
  // The bottom dead zone (below the last arrow row, above the "#" toggle), not the top one:
  // "a bottom band" -- placing it right after the top dead zone would overlap the board's own
  // first row of tall arrow glyphs (found while reviewing the first render; fixed here).
  const bandTop = BOTTOM_DEAD_ZONE.top + 18;
  const bandHeight = 160;
  const bandBottom = bandTop + bandHeight;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${stampSvg(width, '(C) header elements split into a top and a bottom band (4 elements total, unchanged)')}
    ${eraseBoxSvg(HEADER_HEARTS_BOX, palette.bg)}
    ${eraseBoxSvg(HEADER_HINT_BOX, palette.bg)}
    <rect x="20" y="${bandTop}" width="${width - 40}" height="${bandHeight}" rx="20" fill="${palette.surface}" stroke="${palette.border}" stroke-width="2"/>
    ${heartsSvg(width * 0.34, bandTop + bandHeight / 2, palette.heart)}
    <rect x="${width - 220}" y="${bandTop + bandHeight / 2 - 55}" width="110" height="110" rx="24" fill="${palette.bg}" stroke="${palette.accent}" stroke-width="3"/>
    ${hintGlyphSvg(width - 165, bandTop + bandHeight / 2, palette.accent)}
    <text x="40" y="${bandBottom + 34}" font-family="sans-serif" font-size="22" fill="${palette.ink}">bottom band: hearts + hint (relocated); back + Level/difficulty stay in the top header</text>
  </svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
}

async function buildOptionD(baseBuffer: Buffer, width: number, height: number, palette: Palette2): Promise<Buffer> {
  const cx = 160;
  const cy = BOTTOM_DEAD_ZONE.top + (BOTTOM_DEAD_ZONE.bottom - BOTTOM_DEAD_ZONE.top) / 2;
  const r = 78;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${stampSvg(width, '(D) hint button relocated bottom-left as a single floating circle (bottom-right is the existing "#" grid toggle)')}
    ${eraseBoxSvg(HEADER_HINT_BOX, palette.bg)}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${palette.surface}" stroke="${palette.accent}" stroke-width="4"/>
    ${hintGlyphSvg(cx, cy, palette.accent)}
  </svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
}

async function writeMocks(options: MocksOptions): Promise<void> {
  mkdirSync(options.outDir, { recursive: true });
  const sources: [string, string, Palette2][] = [
    [options.daylight, 'Daylight', MOCK_PALETTES.Daylight],
    [options.inkNight, 'InkNight', MOCK_PALETTES.InkNight],
  ];
  const builders: [string, (b: Buffer, w: number, h: number, p: Palette2) => Promise<Buffer>][] = [
    ['A-today', buildOptionA],
    ['B-progress-rail', buildOptionB],
    ['C-top-and-bottom-bands', buildOptionC],
    ['D-floating-hint-bottom-left', buildOptionD],
  ];
  for (const [sourcePath, themeName, palette] of sources) {
    const metadata = await sharp(sourcePath).metadata();
    const width = metadata.width ?? 1080;
    const height = metadata.height ?? 2340;
    const baseBuffer = await sharp(sourcePath).png().toBuffer();
    for (const [optionKey, builder] of builders) {
      // eslint-disable-next-line no-await-in-loop
      const out = await builder(baseBuffer, width, height, palette);
      const outPath = path.join(options.outDir, `${optionKey}-${themeName}.png`);
      // eslint-disable-next-line no-await-in-loop
      await sharp(out).toFile(outPath);
      console.log(`Wrote ${outPath}`);
    }
  }
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'mocks') {
    await writeMocks(options);
    return;
  }
  const { from, to } = options;
  console.log(`dead-band.ts: levels ${from}..${to} (${to - from + 1} levels), source docs/board-viewport-measured.md`);

  let captureWorst: LevelSlack | null = null;
  for (const pair of GEOMETRIES) {
    const loggedResults = analyseGeometry(pair.logged, from, to);
    printGeometryBlock(pair.name, pair.logged, loggedResults);
    const adjustedResults = analyseGeometry(pair.adjusted, from, to);
    const worst = printGeometryBlock(pair.name, pair.adjusted, adjustedResults);
    if (pair.name === CAPTURE_GEOMETRY_NAME) captureWorst = worst;
  }

  if (captureWorst === null) throw new Error('capture geometry not found in GEOMETRIES');
  console.log(
    `\n== Capture target: ${CAPTURE_GEOMETRY_NAME}, adjusted (on-screen) numbers ==\n`
      + `  worst level in range: index ${captureWorst.levelIndex} (${captureWorst.shapeName}, `
      + `${captureWorst.rows}x${captureWorst.cols}), slackPerSide=${fmt(captureWorst.slackPerSidePt)}dp, `
      + `drawnBoardHeight=${fmt(captureWorst.boardHeightPt)}dp`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

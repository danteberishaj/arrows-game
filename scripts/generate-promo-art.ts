/**
 * Renders REAL generated levels as Play Store promo art — the exact boards
 * the game deals, drawn with the exact line-art geometry BoardView uses
 * (same stroke fractions, same arrowhead). Nothing staged, nothing fake:
 * what the store shows is what the player gets.
 *
 * Run: npx tsx scripts/generate-promo-art.ts [--gen-version 1|2] [--out <dir>]
 *
 * --gen-version (W3-21): the generator whose boards are drawn. Default 1, the
 * generator shipped players are dealt today (the output is unchanged). 2 draws
 * generator v2 as a fresh install deals it (switch level 0: the players the
 * store page is for once v2 is on). A shape v2 never deals as Super Hard
 * (Crescent: its capacity, 450 cells, is under every v2 Super Hard target it
 * meets in the search window) is drawn from its first v2 board at any tier,
 * and the console line says so. --out (W3-21): the output directory, default
 * store/marketing/. Store-facing PNGs change only with the owner's approval.
 *
 * Outputs (store/marketing/ by default):
 *   board-heart.png     1080x1920  a real SuperHard Heart level, Ink Night
 *   board-cat.png       1080x1920  a real SuperHard Cat level, Ink Night
 *   board-pine.png      1080x1920  a real SuperHard Pine level, Daylight
 *
 * Owner ruling 2026-10-06: keep Heart; Cat and Pine replace Crescent and Flower
 * (Crescent had no v2 Super Hard board; Flower read as a blob). Both are dealt
 * by v1 and v2, so the art stays true whichever generator a player is on.
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { Difficulties, Difficulty, LevelGenerator } from '../src/core';
import type { GeneratedLevel, GenVersion } from '../src/core';
import { arrowArt, STROKE } from '../src/ui/arrowGeometry';
import { Daylight, InkNight, Palette } from '../src/ui/theme';

const CELL = 40;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`${flag} needs a value`);
  return v;
}

const GEN_VERSION_ARG = argValue('--gen-version') ?? '1';
if (GEN_VERSION_ARG !== '1' && GEN_VERSION_ARG !== '2') throw new Error(`--gen-version must be 1 or 2; got ${GEN_VERSION_ARG}`);
const GEN_VERSION: GenVersion = GEN_VERSION_ARG === '2' ? 2 : 1;
const OUT = path.resolve(argValue('--out') ?? path.join(__dirname, '..', 'store', 'marketing'));

/**
 * First SuperHard level whose silhouette is the named shape, at generator
 * `version` (W3-05; default v1, the boards shipped players are dealt).
 */
function findLevel(shapeName: string, version: GenVersion = 1): GeneratedLevel {
  for (let i = 5; i < 6 * 400; i += 6) {
    if (Difficulties.forLevel(i) !== Difficulty.SuperHard) continue;
    const lvl = LevelGenerator.generate(i, version);
    if (lvl.shapeName === shapeName) {
      levelIndexOf.set(lvl, i);
      return lvl;
    }
  }
  if (version === 2) {
    // W3-21: v2 may never deal this shape as Super Hard; draw its first v2 board at any tier.
    for (let i = 0; i < 6 * 400; i++) {
      const lvl = LevelGenerator.generate(i, version);
      if (lvl.shapeName === shapeName) {
        levelIndexOf.set(lvl, i);
        return lvl;
      }
    }
  }
  throw new Error(`no ${shapeName} level found`);
}

/** The level index each drawn board came from (for the console line). */
const levelIndexOf = new Map<GeneratedLevel, number>();

/** The board as pure SVG — identical geometry to BoardView's render. */
function boardSvg(lvl: GeneratedLevel, p: Palette): { svg: string; w: number; h: number } {
  const w = lvl.board.cols * CELL;
  const h = lvl.board.rows * CELL;
  let paths = '';
  for (const arrow of lvl.board.arrows()) {
    const art = arrowArt(arrow, CELL);
    paths +=
      `<path d="${art.shaftD}" stroke="${p.ink}" stroke-width="${STROKE * CELL}" ` +
      `stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
      `<path d="${art.headD}" fill="${p.ink}"/>`;
  }
  return { svg: paths, w, h };
}

async function renderPromo(
  file: string,
  lvl: GeneratedLevel,
  p: Palette,
  showHearts: boolean,
): Promise<void> {
  const W = 1080, H = 1920;
  const { svg, w, h } = boardSvg(lvl, p);
  // Fit the board into ~88% width / ~74% height, centered slightly low.
  const scale = Math.min((W * 0.88) / w, (H * 0.74) / h);
  const bw = w * scale, bh = h * scale;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2 + H * 0.02;

  const hearts = showHearts
    ? `<g fill="${p.heart}" transform="translate(${W / 2}, ${H * 0.085})">
         ${[-1, 0, 1].map((k) => `
           <path transform="translate(${k * 110}, 0) scale(4.2)"
             d="M0 6 C -7 -1 -12 -4 -12 -9 a 6.5 6.5 0 0 1 12 -3 a 6.5 6.5 0 0 1 12 3 c 0 5 -5 8 -12 15 z"/>`).join('')}
       </g>`
    : '';

  const doc = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${p.bg}"/>
    ${hearts}
    <g transform="translate(${bx}, ${by}) scale(${scale})">${svg}</g>
  </svg>`;

  await sharp(Buffer.from(doc)).png().toFile(path.join(OUT, file));
  console.log(`${file}  (${lvl.shapeName}, ${lvl.arrowCount} arrows, ${lvl.board.rows}x${lvl.board.cols})`
    + (GEN_VERSION === 2 ? `  v2 level ${(levelIndexOf.get(lvl) ?? -1) + 1}, ${Difficulty[lvl.difficulty]}` : ''));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await renderPromo('board-heart.png', findLevel('Heart', GEN_VERSION), InkNight, true);
  await renderPromo('board-cat.png', findLevel('Cat', GEN_VERSION), InkNight, true);
  await renderPromo('board-pine.png', findLevel('Pine', GEN_VERSION), Daylight, true);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

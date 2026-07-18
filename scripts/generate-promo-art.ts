/**
 * Renders REAL generated levels as Play Store promo art — the exact boards
 * the game deals, drawn with the exact line-art geometry BoardView uses
 * (same stroke fractions, same arrowhead). Nothing staged, nothing fake:
 * what the store shows is what the player gets.
 *
 * Run: npx tsx scripts/generate-promo-art.ts
 *
 * Outputs (store/marketing/):
 *   board-heart.png     1080x1920  a real SuperHard Heart level, Ink Night
 *   board-crescent.png  1080x1920  a real SuperHard Crescent level, Ink Night
 *   board-flower.png    1080x1920  a real SuperHard Flower level, Daylight
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { Difficulties, Difficulty, LevelGenerator } from '../src/core';
import type { GeneratedLevel } from '../src/core';
import { arrowArt, STROKE } from '../src/ui/arrowGeometry';
import { Daylight, InkNight, Palette } from '../src/ui/theme';

const CELL = 40;
const OUT = path.join(__dirname, '..', 'store', 'marketing');

/** First SuperHard level whose silhouette is the named shape. */
function findLevel(shapeName: string): GeneratedLevel {
  for (let i = 5; i < 6 * 400; i += 6) {
    if (Difficulties.forLevel(i) !== Difficulty.SuperHard) continue;
    const lvl = LevelGenerator.generate(i);
    if (lvl.shapeName === shapeName) return lvl;
  }
  throw new Error(`no ${shapeName} level found`);
}

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
  console.log(`${file}  (${lvl.shapeName}, ${lvl.arrowCount} arrows, ${lvl.board.rows}x${lvl.board.cols})`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await renderPromo('board-heart.png', findLevel('Heart'), InkNight, true);
  await renderPromo('board-crescent.png', findLevel('Crescent'), InkNight, true);
  await renderPromo('board-flower.png', findLevel('Flower'), Daylight, true);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

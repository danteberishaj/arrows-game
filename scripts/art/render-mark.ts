/**
 * W5-13: renders every raster of the brand emblem from the vector source
 * `assets/images/mark.svg`, at each file's own pixel size, instead of resizing
 * a 512 px PNG (the old `generate-store-assets.js` upscaled it 1.72x / 1.84x).
 *
 * Run: npx tsx scripts/art/render-mark.ts [--out <dir>] [--proposals <dir>]
 *
 * Outputs (relative to the repo root, or to --out when given). Sizes, channel
 * counts and compositions are the ones shipped before W5-13:
 *   assets/images/mark.png              512  RGBA  the splash image (app.json)
 *   assets/icon.png                    1024  RGBA  opaque: Ink Night + mark at 940
 *   assets/android-icon-foreground.png 1024  RGBA  transparent, mark at 880
 *   assets/android-icon-monochrome.png 1024  RGBA  white silhouette at 880
 *   assets/favicon.png                   64  RGBA  the icon composition at 64
 *   src/ui/brandMark.ts                       the faces as react-native-svg data
 *
 * Each raster is one SVG document rendered once at its final size (the mark
 * nested at its box), so nothing is resampled. --proposals <dir> also writes
 * playstore-icon-512.png (RGB, no alpha, like the curated one). The curated
 * `store/` art is never written: it is the owner's call (see the W5-13 report).
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';

export const ROOT = path.join(__dirname, '..', '..');
export const MARK_SVG = path.join(ROOT, 'assets', 'images', 'mark.svg');
export const INK_NIGHT_BG = '#13111C';
/** The mark's own coordinate frame (the old 512 px raster's pixel grid). */
export const MARK_FRAME = 512;

export interface Face {
  id: string;
  fill: string;
  d: string;
}

/** The faces of mark.svg, in paint order (back to front). */
export function readFaces(svg = fs.readFileSync(MARK_SVG, 'utf8')): Face[] {
  const faces: Face[] = [];
  const re = /<path\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(m![1])?.[1];
    const id = attr('id');
    const fill = attr('fill');
    const d = attr('d');
    if (!id || !fill || !d) throw new Error(`mark.svg: a <path> lacks id/fill/d: ${m[0]}`);
    faces.push({ id, fill, d });
  }
  if (faces.length === 0) throw new Error('mark.svg: no <path> faces found');
  return faces;
}

const fmt = (n: number) => String(Math.round(n * 10000) / 10000);

/**
 * One SVG document of `canvas` px: an optional solid background, and the mark
 * nested in a `box` px square centred on the canvas. `fill` overrides every
 * face colour (the monochrome silhouette).
 */
export function composeSvg(
  canvas: number,
  box: number,
  opts: { bg?: string; fill?: string; faces?: Face[] } = {},
): string {
  const faces = opts.faces ?? readFaces();
  const off = (canvas - box) / 2;
  const bg = opts.bg ? `<rect width="${canvas}" height="${canvas}" fill="${opts.bg}"/>` : '';
  const paths = faces.map((f) => `<path fill="${opts.fill ?? f.fill}" d="${f.d}"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">` +
    bg +
    `<svg x="${fmt(off)}" y="${fmt(off)}" width="${fmt(box)}" height="${fmt(box)}" viewBox="0 0 ${MARK_FRAME} ${MARK_FRAME}">` +
    paths +
    `</svg></svg>`
  );
}

export function rasterize(svg: string): Sharp {
  // density 72 = one SVG user unit per output pixel (the root width/height).
  return sharp(Buffer.from(svg), { density: 72 }).ensureAlpha();
}

export interface Target {
  file: string;
  canvas: number;
  box: number;
  bg?: string;
  fill?: string;
  /** Drop alpha (RGB PNG). Only the Play-icon proposal. */
  flatten?: boolean;
}

/** The shipped rasters. canvas/box are today's compositions (generate-store-assets.js). */
export const TARGETS: Target[] = [
  { file: 'assets/images/mark.png', canvas: 512, box: 512 },
  { file: 'assets/icon.png', canvas: 1024, box: 940, bg: INK_NIGHT_BG },
  { file: 'assets/android-icon-foreground.png', canvas: 1024, box: 880 },
  { file: 'assets/android-icon-monochrome.png', canvas: 1024, box: 880, fill: '#FFFFFF' },
  // The old favicon was the 1024 icon resized to 64: the same composition at 1/16.
  { file: 'assets/favicon.png', canvas: 64, box: 940 / 16, bg: INK_NIGHT_BG },
];

export const PROPOSALS: Target[] = [
  { file: 'playstore-icon-512.png', canvas: 512, box: 470, bg: INK_NIGHT_BG, flatten: true },
];

export async function renderTarget(t: Target, faces?: Face[]): Promise<Buffer> {
  const svg = composeSvg(t.canvas, t.box, { bg: t.bg, fill: t.fill, faces });
  if (!t.flatten) return rasterize(svg).png().toBuffer();
  // sharp orders pipeline steps itself (ensureAlpha would run after removeAlpha),
  // so the RGB variant is a separate pipeline with no ensureAlpha.
  return sharp(Buffer.from(svg), { density: 72 })
    .flatten({ background: t.bg ?? '#000000' })
    .removeAlpha()
    .png()
    .toBuffer();
}

/** src/ui/brandMark.ts: the same faces for react-native-svg (no SVG transformer in Metro). */
export function brandMarkModule(faces: Face[]): string {
  const rows = faces.map((f) => `  { id: '${f.id}', fill: '${f.fill}', d: '${f.d}' },`).join('\n');
  return `// GENERATED by scripts/art/render-mark.ts from assets/images/mark.svg. Do not edit:
// change mark.svg and re-run \`npx tsx scripts/art/render-mark.ts\`.
// brandMark.test.ts fails if this file and mark.svg disagree.

/** The emblem's coordinate frame: a ${MARK_FRAME} x ${MARK_FRAME} viewBox (the old mark.png's pixel grid). */
export const MARK_VIEWBOX = '0 0 ${MARK_FRAME} ${MARK_FRAME}';

/** Faces in paint order, back to front. Colours are baked in (both themes). */
export const MARK_FACES: ReadonlyArray<{ id: string; fill: string; d: string }> = [
${rows}
];
`;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
}

async function main() {
  const outRoot = argValue('--out') ? path.resolve(argValue('--out')!) : ROOT;
  const faces = readFaces();
  for (const t of TARGETS) {
    const dest = path.join(outRoot, t.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const buf = await renderTarget(t, faces);
    fs.writeFileSync(dest, buf);
    const meta = await sharp(buf).metadata();
    console.log(`${t.file}  ${meta.width}x${meta.height} ch=${meta.channels}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
  const mod = path.join(outRoot, 'src', 'ui', 'brandMark.ts');
  fs.mkdirSync(path.dirname(mod), { recursive: true });
  fs.writeFileSync(mod, brandMarkModule(faces));
  console.log('src/ui/brandMark.ts');
  const prop = argValue('--proposals');
  if (prop) {
    for (const t of PROPOSALS) {
      const dest = path.join(path.resolve(prop), t.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, await renderTarget(t, faces));
      console.log(`proposal ${dest}`);
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

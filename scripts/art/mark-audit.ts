/**
 * W5-13: measures the vector emblem against the raster it replaces, and the
 * regenerated rasters against the files they replace.
 *
 * Run: npx tsx scripts/art/mark-audit.ts [--ref <commit>] [--sheets <dir>]
 *
 * --ref   the commit whose files are "before" (default 26096d3: the last commit
 *         with the generated mark.png and the upscaled launcher set).
 * --sheets  also writes size side-by-sides and difference images there.
 *
 * 1. Fidelity. mark.svg rendered at 512 vs the ref mark.png, as premultiplied
 *    RGBA (straight colour x alpha, plus alpha), 0-255:
 *    - mean and max absolute per-channel difference;
 *    - after a 3x3 box blur (a 1 px blur) of both, the share of pixels whose
 *      largest channel difference exceeds 24, inside and outside the 1 px edge
 *      band. The band is every pixel within 1 px (8-neighbourhood) of a place
 *      where the ref's label changes (transparent / one of the four face
 *      colours). Shares are given of the emblem's pixels (alpha > 0 in either
 *      image) and of the whole frame.
 * 2. Rasters, ref vs working tree: size, channels, alpha range, the furthest
 *    drawn pixel (alpha > 0) as a fraction of the half-frame, the drawn
 *    bounding box as a fraction of the frame, and the edge transition width:
 *    the 10-90 % rise across the emblem's long outer edges, sampled on
 *    perpendicular profiles (bilinear, 0.05 px steps), median and p90, in px.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { OverlayOptions, Sharp } from 'sharp';
import { composeSvg, INK_NIGHT_BG, MARK_FRAME, rasterize, ROOT, TARGETS } from './render-mark';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
}
const REF = argValue('--ref') ?? '26096d3';
const SHEETS = argValue('--sheets');

interface Raw {
  w: number;
  h: number;
  ch: number;
  data: Buffer;
}
async function raw(input: Buffer | Sharp): Promise<Raw> {
  const s = Buffer.isBuffer(input) ? sharp(input) : input;
  const { data, info } = await s.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, ch: info.channels, data };
}
const gitFile = (file: string) =>
  execFileSync('git', ['show', `${REF}:${file}`], { cwd: ROOT, maxBuffer: 64 << 20 });

/** Premultiplied RGBA planes as float arrays. */
function premul(r: Raw): Float64Array[] {
  const n = r.w * r.h;
  const out = [0, 1, 2, 3].map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    const a = r.data[i * 4 + 3];
    for (let c = 0; c < 3; c++) out[c][i] = (r.data[i * 4 + c] * a) / 255;
    out[3][i] = a;
  }
  return out;
}
function blur3(p: Float64Array, w: number, h: number): Float64Array {
  const o = new Float64Array(p.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          s += p[yy * w + xx];
          k++;
        }
      o[y * w + x] = s / k;
    }
  return o;
}

// The four face colours sampled from the ref mark.png (eroded-mask medians).
const FACE_RGB = [
  [108, 73, 229],
  [81, 48, 194],
  [230, 60, 127],
  [186, 36, 105],
];
function labels(r: Raw): Int8Array {
  const n = r.w * r.h;
  const l = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    if (r.data[i * 4 + 3] < 128) {
      l[i] = -1;
      continue;
    }
    let best = 0;
    let bd = Infinity;
    FACE_RGB.forEach((c, k) => {
      const d = (r.data[i * 4] - c[0]) ** 2 + (r.data[i * 4 + 1] - c[1]) ** 2 + (r.data[i * 4 + 2] - c[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    l[i] = best;
  }
  return l;
}
function edgeBand(l: Int8Array, w: number, h: number): Uint8Array {
  const edge = new Uint8Array(l.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x + 1 < w && l[i + 1] !== l[i]) || (y + 1 < h && l[i + w] !== l[i])) {
        edge[i] = 1;
        if (x + 1 < w) edge[i + 1] = 1;
        if (y + 1 < h) edge[i + w] = 1;
      }
    }
  const band = new Uint8Array(l.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!edge[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) band[yy * w + xx] = 1;
        }
    }
  return band;
}

export async function fidelity() {
  const ref = await raw(gitFile('assets/images/mark.png'));
  const vec = await raw(rasterize(composeSvg(MARK_FRAME, MARK_FRAME)));
  const { w, h } = ref;
  const A = premul(ref);
  const B = premul(vec);
  let sum = 0;
  let max = 0;
  const perCh = [0, 0, 0, 0];
  const maxCh = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++)
    for (let i = 0; i < w * h; i++) {
      const d = Math.abs(A[c][i] - B[c][i]);
      sum += d;
      perCh[c] += d;
      if (d > max) max = d;
      if (d > maxCh[c]) maxCh[c] = d;
    }
  const Ab = A.map((p) => blur3(p, w, h));
  const Bb = B.map((p) => blur3(p, w, h));
  const band = edgeBand(labels(ref), w, h);
  let emblem = 0;
  let emblemOut = 0;
  let badOut = 0;
  let badIn = 0;
  let inBand = 0;
  const badMap = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const drawn = ref.data[i * 4 + 3] > 0 || vec.data[i * 4 + 3] > 0;
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(Ab[c][i] - Bb[c][i]));
    const bad = d > 24;
    if (drawn) emblem++;
    if (band[i]) {
      inBand++;
      if (bad) badIn++;
    } else {
      if (drawn) emblemOut++;
      if (bad) {
        badOut++;
        badMap[i] = 1;
      }
    }
  }
  const n = w * h;
  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(3)} %`;
  console.log(`== Fidelity: mark.svg @512 vs ${REF}:assets/images/mark.png (premultiplied RGBA, 0-255)`);
  console.log(`mean |diff| per channel: ${(sum / (4 * n)).toFixed(3)} (R ${(perCh[0] / n).toFixed(3)}, G ${(perCh[1] / n).toFixed(3)}, B ${(perCh[2] / n).toFixed(3)}, A ${(perCh[3] / n).toFixed(3)})`);
  console.log(`mean |diff| per channel over emblem px only: ${(sum / (4 * emblem)).toFixed(3)}`);
  console.log(`max |diff| per channel: ${max.toFixed(1)} (R ${maxCh[0].toFixed(1)}, G ${maxCh[1].toFixed(1)}, B ${maxCh[2].toFixed(1)}, A ${maxCh[3].toFixed(1)})`);
  console.log(`emblem px (alpha>0 in either): ${emblem}; 1 px edge band: ${inBand} px; emblem px outside band: ${emblemOut}`);
  console.log(`after 1 px blur, |diff|>24 OUTSIDE band: ${badOut} px = ${pct(badOut, emblemOut)} of emblem px outside band, ${pct(badOut, n)} of frame`);
  console.log(`after 1 px blur, |diff|>24 INSIDE band: ${badIn} px = ${pct(badIn, inBand)} of band px`);
  return { ref, vec, badMap };
}

// ---- Edge transition width ------------------------------------------------
// Long outer edges of the emblem in mark.svg coordinates (inside on the left
// of a->b is not assumed: the normal is oriented away from the centroid).
const OUTER_EDGES: Array<[number, number, number, number]> = [
  [256.05, 117.05, 120.33, 344.18], // left bar, outer side
  [120.22, 349.48, 147.3, 395.98], // left bar, bottom
  [256.05, 117.05, 320.8, 225.22], // pink bar, outer side
  [320.8, 225.22, 390.6, 342], // right bar, outer side
  [393.32, 346.6, 364.95, 395.23], // right bar, bottom
  [364.95, 395.23, 255.75, 332], // dark band, bottom
  [255.75, 332, 148.44, 394.01], // pink lower bar, bottom
];
const CENTROID = [256, 290];

function sampler(r: Raw, bg: number[] | null) {
  // coverage in [0,1]: alpha, or for opaque images the projection of the
  // colour onto (face - bg). `face` is chosen per profile.
  const at = (x: number, y: number, face: number[] | null): number => {
    const fx = x - 0.5;
    const fy = y - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    let v = 0;
    for (const [dx, dy, wt] of [
      [0, 0, (1 - tx) * (1 - ty)],
      [1, 0, tx * (1 - ty)],
      [0, 1, (1 - tx) * ty],
      [1, 1, tx * ty],
    ]) {
      const xx = Math.min(r.w - 1, Math.max(0, x0 + dx));
      const yy = Math.min(r.h - 1, Math.max(0, y0 + dy));
      const i = (yy * r.w + xx) * 4;
      let c: number;
      if (!bg || !face) c = r.data[i + 3] / 255;
      else {
        const fb = [face[0] - bg[0], face[1] - bg[1], face[2] - bg[2]];
        const len2 = fb[0] ** 2 + fb[1] ** 2 + fb[2] ** 2;
        c = ((r.data[i] - bg[0]) * fb[0] + (r.data[i + 1] - bg[1]) * fb[1] + (r.data[i + 2] - bg[2]) * fb[2]) / len2;
      }
      v += wt * c;
    }
    return v;
  };
  const px = (x: number, y: number) => {
    const i = (Math.round(y - 0.5) * r.w + Math.round(x - 0.5)) * 4;
    return [r.data[i], r.data[i + 1], r.data[i + 2]];
  };
  return { at, px };
}

function crossing(prof: number[], level: number, step: number): number | null {
  for (let i = 1; i < prof.length; i++)
    if (prof[i - 1] < level && prof[i] >= level) {
      const t = (level - prof[i - 1]) / (prof[i] - prof[i - 1]);
      return (i - 1 + t) * step;
    }
  return null;
}

export function edgeWidths(r: Raw, canvas: number, box: number, bg: number[] | null): number[] {
  const s = box / MARK_FRAME;
  const off = (canvas - box) / 2;
  const toPx = (x: number, y: number) => [off + x * s, off + y * s];
  const { at, px } = sampler(r, bg);
  const widths: number[] = [];
  const STEP = 0.05;
  const SPAN = Math.max(3, 2.5 * Math.max(1, s)); // px each side of the edge
  for (const [ax, ay, bx, by] of OUTER_EDGES) {
    const [x0, y0] = toPx(ax, ay);
    const [x1, y1] = toPx(bx, by);
    const len = Math.hypot(x1 - x0, y1 - y0);
    let nx = -(y1 - y0) / len;
    let ny = (x1 - x0) / len;
    const [cx, cy] = toPx(CENTROID[0], CENTROID[1]);
    if ((cx - x0) * nx + (cy - y0) * ny > 0) {
      nx = -nx;
      ny = -ny;
    } // n points outward
    for (let k = 1; k <= 15; k++) {
      const t = 0.2 + (0.6 * k) / 16;
      const px0 = x0 + t * (x1 - x0);
      const py0 = y0 + t * (y1 - y0);
      // walk from inside (-SPAN) to outside (+SPAN); profile rises outside->inside, so reverse
      const face = bg ? px(px0 - nx * (SPAN + 1), py0 - ny * (SPAN + 1)) : null;
      const prof: number[] = [];
      for (let d = SPAN; d >= -SPAN; d -= STEP) prof.push(at(px0 + nx * d, py0 + ny * d, face));
      const lo = crossing(prof, 0.1, STEP);
      const hi = crossing(prof, 0.9, STEP);
      if (lo !== null && hi !== null && hi >= lo) widths.push(hi - lo);
    }
  }
  return widths.sort((a, b) => a - b);
}
const q = (v: number[], p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

async function rasterRow(file: string, buf: Buffer, canvas: number, box: number, bg?: string) {
  const meta = await sharp(buf).metadata();
  const r = await raw(buf);
  let amin = 255;
  let amax = 0;
  let far = 0;
  let bx0 = r.w;
  let by0 = r.h;
  let bx1 = -1;
  let by1 = -1;
  const hw = r.w / 2;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const a = r.data[(y * r.w + x) * 4 + 3];
      amin = Math.min(amin, a);
      amax = Math.max(amax, a);
      if (a > 0) {
        // furthest drawn pixel centre from the frame centre, as icon-audit.mjs measures it
        far = Math.max(far, Math.hypot(x - (r.w - 1) / 2, y - (r.h - 1) / 2));
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x);
        by1 = Math.max(by1, y);
      }
    }
  const ew = edgeWidths(r, canvas, box, bg ? hex(bg) : null);
  const opaque = amin === 255;
  return {
    file,
    size: `${meta.width}x${meta.height}`,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    alpha: `${amin}..${amax}`,
    farthest: opaque ? 'n/a (opaque)' : (far / hw).toFixed(4),
    bbox: opaque ? 'n/a (opaque)' : `${(bx0 / r.w).toFixed(3)}-${((bx1 + 1) / r.w).toFixed(3)} x ${(by0 / r.h).toFixed(3)}-${((by1 + 1) / r.h).toFixed(3)}`,
    edgeMedian: q(ew, 0.5)?.toFixed(2),
    edgeP90: q(ew, 0.9)?.toFixed(2),
    profiles: ew.length,
  };
}

async function rasters() {
  console.log(`\n== Rasters: ${REF} (before) vs working tree (after)`);
  const rows = [];
  for (const t of TARGETS) {
    const before = gitFile(t.file);
    const after = fs.readFileSync(path.join(ROOT, t.file));
    for (const [when, buf] of [
      ['before', before],
      ['after', after],
    ] as const) {
      const row = await rasterRow(t.file, buf, t.canvas, t.box, t.bg);
      rows.push({ when, ...row });
      console.log(
        `${t.file.padEnd(36)} ${when.padEnd(6)} ${row.size} ch=${row.channels} hasAlpha=${row.hasAlpha} alpha=${row.alpha} ` +
          `farthest=${row.farthest} bbox=${row.bbox} edge10-90 median=${row.edgeMedian}px p90=${row.edgeP90}px (n=${row.profiles})`,
      );
    }
  }
  return rows;
}

// ---- Sheets ---------------------------------------------------------------
const label = (text: string, w: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect width="${w}" height="22" fill="#ffffff"/>` +
      `<text x="4" y="16" font-family="sans-serif" font-size="13" fill="#222">${text}</text></svg>`,
  );

async function sizeSheets(dir: string, refPng: Buffer, badMap: Uint8Array) {
  fs.mkdirSync(dir, { recursive: true });
  for (const N of [24, 56, 108, 192, 512]) {
    const zoom = N <= 108 ? Math.ceil(216 / N) : 1;
    const D = N * zoom;
    const oldN = await sharp(refPng).resize(N, N, { kernel: 'lanczos3' }).png().toBuffer();
    const newN = await rasterize(composeSvg(N, N)).png().toBuffer();
    const on = async (img: Buffer, bg: string) =>
      sharp({ create: { width: N, height: N, channels: 4, background: bg } })
        .composite([{ input: img }])
        .png()
        .toBuffer()
        .then((b) => sharp(b).resize(D, D, { kernel: 'nearest' }).png().toBuffer());
    const a = await raw(oldN);
    const b = await raw(newN);
    const diff = Buffer.alloc(N * N * 3);
    for (let i = 0; i < N * N; i++) {
      let d = 0;
      for (let c = 0; c < 4; c++) {
        const pa = c < 3 ? (a.data[i * 4 + c] * a.data[i * 4 + 3]) / 255 : a.data[i * 4 + 3];
        const pb = c < 3 ? (b.data[i * 4 + c] * b.data[i * 4 + 3]) / 255 : b.data[i * 4 + 3];
        d = Math.max(d, Math.abs(pa - pb));
      }
      const v = Math.min(255, d * 4);
      diff[i * 3] = v;
      diff[i * 3 + 1] = v;
      diff[i * 3 + 2] = v;
    }
    const diffImg = await sharp(diff, { raw: { width: N, height: N, channels: 3 } })
      .resize(D, D, { kernel: 'nearest' })
      .png()
      .toBuffer();
    const tiles: Array<[string, Buffer]> = [
      ['old, white', await on(oldN, '#FFFFFF')],
      ['new, white', await on(newN, '#FFFFFF')],
      ['old, Ink Night', await on(oldN, INK_NIGHT_BG)],
      ['new, Ink Night', await on(newN, INK_NIGHT_BG)],
      ['|diff| x4', diffImg],
    ];
    const gap = 8;
    const W = tiles.length * (D + gap) + gap;
    const H = D + 22 + gap * 2 + 22;
    const comps: OverlayOptions[] = [{ input: label(`${N} px${zoom > 1 ? ` (shown ${zoom}x, nearest)` : ''}: old mark.png resized (lanczos3) vs mark.svg rendered at ${N}`, W), left: 0, top: 0 }];
    tiles.forEach(([t, img], k) => {
      comps.push({ input: label(t, D), left: gap + k * (D + gap), top: 22 });
      comps.push({ input: img, left: gap + k * (D + gap), top: 44 });
    });
    await sharp({ create: { width: W, height: H, channels: 3, background: '#FFFFFF' } })
      .composite(comps)
      .png()
      .toFile(path.join(dir, `size-${N}.png`));
  }
  // where the >24 (after blur) pixels outside the edge band are, at 512
  const ref = await raw(refPng);
  const out = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    const a = ref.data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(255 - (255 - ref.data[i * 4 + c]) * a * 0.35);
    if (badMap[i]) {
      out[i * 3] = 255;
      out[i * 3 + 1] = 140;
      out[i * 3 + 2] = 0;
    }
  }
  await sharp(out, { raw: { width: 512, height: 512, channels: 3 } }).resize(1024, 1024, { kernel: 'nearest' }).png().toFile(path.join(dir, 'fidelity-outside-band.png'));
  console.log(`\nsheets -> ${dir}`);
}

async function main() {
  const { badMap } = await fidelity();
  const rows = await rasters();
  if (SHEETS) {
    await sizeSheets(path.resolve(SHEETS), gitFile('assets/images/mark.png'), badMap);
    fs.writeFileSync(path.join(path.resolve(SHEETS), 'rasters.json'), JSON.stringify(rows, null, 1));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

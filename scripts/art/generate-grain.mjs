#!/usr/bin/env node
// W5-14 paper grain tile (ART_PAPER_TEXTURE_ENABLED spike, menu only).
//
//   node scripts/art/generate-grain.mjs [--seed 5140] [--size 256] [--out assets/images/grain.png]
//
// Seeded single-channel noise: uniform white noise from a mulberry32 PRNG, then a 3x3 box blur whose taps WRAP
// around the tile edges (toroidal), so the tile is seamless by construction; then stretched to 0..255. The noise is
// written to the ALPHA channel of a grey+alpha PNG (colour type 4, grey = 255): the menu draws the tile with
// `tintColor = ink`, which keeps only the alpha, and `opacity = ART_PAPER_TEXTURE_OPACITY` on top.
// No dependency: the PNG is encoded with node:zlib and a CRC-32 table.
//
// After writing, the script decodes its own file and prints the seam check (W5-14 acceptance): on a 2x2 tiling, the
// mean absolute alpha difference ACROSS the tile boundary (last column -> first column, last row -> first row) against
// the range of the same statistic between every pair of adjacent interior columns (rows). Exit 1 if a seam falls
// outside that range.
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const SEED = Number(opt('--seed', '5140')); // any fixed seed; 5140 = W5-14
const SIZE = Number(opt('--size', '256'));
const OUT = resolve(opt('--out', 'assets/images/grain.png'));
if (!Number.isInteger(SIZE) || SIZE < 8 || SIZE > 256) throw new Error('--size must be an integer in 8..256');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const white = new Float64Array(SIZE * SIZE).map(() => rand());
const at = (x, y) => white[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
const blurred = new Float64Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) sum += at(x + dx, y + dy);
    blurred[y * SIZE + x] = sum / 9;
  }
}
let lo = Infinity;
let hi = -Infinity;
for (const v of blurred) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
const alpha = Uint8Array.from(blurred, (v) => Math.round(((v - lo) / (hi - lo)) * 255));

// ---------------------------------------------------------------- PNG (colour type 4: grey + alpha, 8 bit)
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc(SIZE * (1 + SIZE * 2));
for (let y = 0; y < SIZE; y += 1) {
  const row = y * (1 + SIZE * 2);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x += 1) {
    raw[row + 1 + x * 2] = 255;
    raw[row + 2 + x * 2] = alpha[y * SIZE + x];
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(OUT, png);

// ---------------------------------------------------------------- seam check on the written file
function decodeAlpha(file) {
  const buf = readFileSync(file);
  let pos = 8; let width = 0; let height = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 4) throw new Error('expected 8-bit grey+alpha');
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const inflated = inflateSync(Buffer.concat(idat));
  const a = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 2);
    if (inflated[row] !== 0) throw new Error('unexpected PNG filter');
    for (let x = 0; x < width; x += 1) a[y * width + x] = inflated[row + 2 + x * 2];
  }
  return { width, height, a };
}
const { width, height, a } = decodeAlpha(OUT);
const colMad = (c1, c2) => { let s = 0; for (let y = 0; y < height; y += 1) s += Math.abs(a[y * width + c1] - a[y * width + c2]); return s / height; };
const rowMad = (r1, r2) => { let s = 0; for (let x = 0; x < width; x += 1) s += Math.abs(a[r1 * width + x] - a[r2 * width + x]); return s / width; };
const interiorCols = Array.from({ length: width - 1 }, (_, c) => colMad(c, c + 1));
const interiorRows = Array.from({ length: height - 1 }, (_, r) => rowMad(r, r + 1));
const seamCol = colMad(width - 1, 0); // on a 2x2 tiling, column width-1 of one tile meets column 0 of the next
const seamRow = rowMad(height - 1, 0);
const range = (v) => [Math.min(...v), Math.max(...v)];
const [cLo, cHi] = range(interiorCols);
const [rLo, rHi] = range(interiorRows);
const mean = a.reduce((s, v) => s + v, 0) / a.length;
console.log(`wrote ${OUT}: ${width}x${height} grey+alpha, seed ${SEED}, ${png.length} bytes, alpha mean ${mean.toFixed(1)} (0..255)`);
console.log(`seam columns (last -> first): MAD ${seamCol.toFixed(3)}; interior adjacent columns: ${cLo.toFixed(3)}..${cHi.toFixed(3)} (n=${interiorCols.length})`);
console.log(`seam rows    (last -> first): MAD ${seamRow.toFixed(3)}; interior adjacent rows:    ${rLo.toFixed(3)}..${rHi.toFixed(3)} (n=${interiorRows.length})`);
const ok = seamCol >= cLo && seamCol <= cHi && seamRow >= rLo && seamRow <= rHi;
console.log(`seam check: ${ok ? 'PASS' : 'FAIL'} (each seam statistic inside the interior range)`);
if (!ok) process.exit(1);

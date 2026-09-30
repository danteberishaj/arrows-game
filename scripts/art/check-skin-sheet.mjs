#!/usr/bin/env node
// Normalize the requested sheet size, slice without retouching, and measure A1–A3.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/art/check-skin-sheet.mjs sheet.png output-directory');
await mkdir(output, { recursive: true });
const source = await sharp(input).metadata();
const atlas = await sharp(input).resize(1024, 1024).ensureAlpha().png().toBuffer();
await writeFile(join(output, 'atlas.png'), atlas);
const cells = [];
const connections = { '0-0': ['left', 'right'], '0-1': ['left', 'right'], '0-2': ['left', 'bottom'], '0-3': ['left'], '1-0': ['right'] };
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++) {
    const key = `${row}-${col}`;
    const tile = sharp(atlas).extract({ left: col * 256, top: row * 256, width: 256, height: 256 });
    await tile.clone().png().toFile(join(output, `${key}.png`));
    const data = await tile.ensureAlpha().raw().toBuffer();
    const edges = connections[key] ?? [];
    let outerAlpha = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      if (!(x < 8 || x >= 248 || y < 8 || y >= 248)) continue;
      // Only the 87±3 px connector corridor is exempt, not the whole connecting edge.
      const connector = (x < 8 && edges.includes('left') || x >= 248 && edges.includes('right')) && y >= 83 && y <= 173
        || (y >= 248 && edges.includes('bottom')) && x >= 83 && x <= 173;
      if (!connector) outerAlpha = Math.max(outerAlpha, data[(y * 256 + x) * 4 + 3]);
    }
    const widths = {};
    for (const edge of edges) {
      let first = -1, last = -1;
      for (let p = 0; p < 256; p++) {
        const x = edge === 'left' ? 0 : edge === 'right' ? 255 : p;
        const y = edge === 'bottom' ? 255 : p;
        if (data[(y * 256 + x) * 4 + 3] >= 128) { if (first < 0) first = p; last = p; }
      }
      widths[edge] = first < 0 ? 0 : last - first + 1;
    }
    let seam = null;
    if (row === 0 && col < 2) {
      let diff = 0;
      for (let y = 0; y < 256; y++) for (let x = 0; x < 2; x++) for (let c = 0; c < 4; c++) {
        diff += Math.abs(data[(y * 256 + 254 + x) * 4 + c] - data[(y * 256 + x) * 4 + c]);
      }
      seam = diff / (256 * 2 * 4);
      const png = await tile.clone().png().toBuffer();
      await sharp({ create: { width: 1024, height: 256, channels: 4, background: '#00000000' } })
        .composite(Array.from({ length: 4 }, (_, i) => ({ input: png, left: i * 256, top: 0 })))
        .png().toFile(join(output, `${key}-tiled.png`));
    }
    cells.push({ cell: key, seamMeanRGBA: seam, seamPass: seam === null || seam < 6,
      outerRingMaxAlpha: outerAlpha, alphaPass: outerAlpha <= 10, connectorWidths: widths,
      fitPass: Object.values(widths).every((width) => Math.abs(width - 87) <= 3) });
  }
}
const report = { input: resolve(input), sourceSize: [source.width, source.height], normalizedSize: [1024, 1024],
  decodedAtlasBytes: 1024 * 1024 * 4, alphaThresholdForFit: 128, cells,
  pass: cells.every((cell) => cell.seamPass && cell.alphaPass && cell.fitPass) };
await writeFile(join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

#!/usr/bin/env node
// ICON-01: the launcher icon is "Buddy" (owner pick 2026-11-20). Renders every icon raster from one 1024 px source
// on a flat background (assets/images/buddy/buddy-base-1024.png, drawn with Codex image generation, artifacts/ICON-01):
//   assets/icon.png                     1024  full square icon (iOS, legacy Android), cropped in
//   assets/android-icon-background.png  1024  adaptive background: the source's flat colour
//   assets/android-icon-foreground.png  1024  adaptive foreground: Buddy with the background keyed out
//   assets/android-icon-monochrome.png  1024  themed icon: Buddy's light body in white, outline and face cut out
//   store/playstore-icon-512.png        512   Play listing icon (no alpha)
// The source already keeps Buddy inside the 66 dp safe circle (check: node artifacts/ICON-01/check-pack.mjs).
// Run: node scripts/art/render-buddy-icon.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The icon a release ships with: 'base' (everyday) or a season costume (owner 2026-11-20: Santa Buddy for the winter
// release; switch back to 'base' in a January update). Each is assets/images/buddy/buddy-<name>-1024.png.
const ACTIVE = 'xmas';
const SRC = path.join(ROOT, `assets/images/buddy/buddy-${ACTIVE}-1024.png`);
const out = (...p) => path.join(ROOT, ...p);
const KEY_LO = 14, KEY_HI = 70; // colour distance from the background: below LO is background, above HI is art
const DARK_LUMA = 0.35;           // monochrome: darker pixels (outline, eyes, smile) are cut out
// Square icons (iOS, Play) are shown whole, not circle-cropped: crop the padded centre so Buddy fills ~70%.
const SQUARE = { left: 152, top: 152, width: 720, height: 720 };

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1024 || info.height !== 1024) throw new Error(`source must be 1024x1024, got ${info.width}x${info.height}`);
const bg = [data[0], data[1], data[2]];
const hex = '#' + bg.map(v => v.toString(16).padStart(2, '0')).join('');

const fg = Buffer.alloc(1024 * 1024 * 4), mono = Buffer.alloc(1024 * 1024 * 4);
for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
  const c = [data[i], data[i + 1], data[i + 2]];
  const d = Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]);
  const a = Math.max(0, Math.min(1, (d - KEY_LO) / (KEY_HI - KEY_LO)));
  fg[j] = c[0]; fg[j + 1] = c[1]; fg[j + 2] = c[2]; fg[j + 3] = Math.round(a * 255);
  const luma = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  mono[j] = mono[j + 1] = mono[j + 2] = 255;
  mono[j + 3] = luma > DARK_LUMA ? Math.round(a * 255) : 0;
}
const raw = { raw: { width: 1024, height: 1024, channels: 4 } };

await sharp(SRC).removeAlpha().extract(SQUARE).resize(1024, 1024, { kernel: 'lanczos3' }).png().toFile(out('assets/icon.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: hex } }).png().toFile(out('assets/android-icon-background.png'));
await sharp(fg, raw).png().toFile(out('assets/android-icon-foreground.png'));
await sharp(mono, raw).png().toFile(out('assets/android-icon-monochrome.png'));
await sharp(SRC).removeAlpha().extract(SQUARE).resize(512, 512, { kernel: 'lanczos3' }).png().toFile(out('store/playstore-icon-512.png'));
console.log(`${ACTIVE}: background ${hex}; wrote icon, adaptive background/foreground/monochrome, Play 512`);

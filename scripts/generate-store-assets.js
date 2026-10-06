#!/usr/bin/env node
/**
 * Generates the non-emblem launcher layer and the fallback store images from
 * the brand emblem's vector source (assets/images/mark.svg, a 512-unit frame,
 * visible mark ≈ 54% of the frame). Ink Night (#13111C) is the icon background
 * — the brand's home surface. Run: node scripts/generate-store-assets.js
 *
 * W5-13: every emblem raster in assets/ (mark.png, icon.png, the adaptive
 * foreground and monochrome layers, favicon.png) is rendered from mark.svg at
 * its own size by `npx tsx scripts/art/render-mark.ts`. This script no longer
 * writes them: it used to upscale the 512 px mark.png (1.72x / 1.84x), and a
 * re-run would have put the soft rasters back.
 *
 * Outputs
 *   assets/android-icon-background.png 1024  adaptive background (solid ink)
 *   store/fallback/playstore-icon-512.png   512  Play listing icon (fallback)
 *   store/fallback/feature-graphic.png 1024x500  Play feature graphic (fallback)
 *
 * The CANONICAL Play listing icon + feature graphic live directly in store/
 * (Higgsfield-generated brand art, curated by hand — see store/marketing/).
 * This script deliberately writes its simpler composed versions to
 * store/fallback/ so a re-run never clobbers the curated art.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const MARK_SVG = path.join(ROOT, 'assets', 'images', 'mark.svg');
const MARK_FRAME = 512; // mark.svg's viewBox
const INK_NIGHT_BG = '#13111C';

const out = (...p) => path.join(ROOT, ...p);

/** The emblem rendered from the vector at `size` px (density 72 = 1 unit per px at 512). */
async function markResized(size) {
  return sharp(MARK_SVG, { density: (72 * size) / MARK_FRAME })
    .resize(size, size) // no-op unless librsvg rounds the size
    .png()
    .toBuffer();
}

/** Solid bg square with the mark centered at `markSize`. */
async function iconOn(bg, canvas, markSize) {
  const m = await markResized(markSize);
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: bg },
  })
    .composite([{ input: m, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(out('store', 'fallback'), { recursive: true });

  // Adaptive background: solid Ink Night.
  fs.writeFileSync(
    out('assets', 'android-icon-background.png'),
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: INK_NIGHT_BG } })
      .png()
      .toBuffer(),
  );

  // Play listing icon (512, no alpha allowed).
  fs.writeFileSync(
    out('store', 'fallback', 'playstore-icon-512.png'),
    await sharp(await iconOn(INK_NIGHT_BG, 512, 470)).flatten({ background: INK_NIGHT_BG }).png().toBuffer(),
  );

  // Feature graphic 1024x500: emblem + wordmark on Ink Night.
  const femblem = await markResized(430);
  const text = Buffer.from(`
    <svg width="1024" height="500">
      <text x="400" y="285" font-family="Verdana, DejaVu Sans, sans-serif"
            font-size="150" font-weight="bold" fill="#EFEDF9">rrows</text>
    </svg>`);
  fs.writeFileSync(
    out('store', 'fallback', 'feature-graphic.png'),
    await sharp({ create: { width: 1024, height: 500, channels: 3, background: INK_NIGHT_BG } })
      .composite([
        { input: femblem, left: 120, top: 35 },
        { input: text, left: 0, top: 0 },
      ])
      .png()
      .toBuffer(),
  );

  for (const f of [
    'assets/android-icon-background.png',
    'store/fallback/playstore-icon-512.png', 'store/fallback/feature-graphic.png',
  ]) {
    console.log(`${f}  ${(fs.statSync(out(...f.split('/'))).size / 1024).toFixed(0)} KB`);
  }
  console.log('Emblem rasters in assets/: npx tsx scripts/art/render-mark.ts');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

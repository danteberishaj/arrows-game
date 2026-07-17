#!/usr/bin/env node
/**
 * Generates every launcher / store image from the brand emblem
 * (assets/images/mark.png, 512px, transparent, visible mark ≈ 64% of the
 * frame). Ink Night (#13111C) is the icon background — the brand's home
 * surface. Run after changing the emblem: node scripts/generate-store-assets.js
 *
 * Outputs
 *   assets/icon.png                    1024  app icon (bg + mark)
 *   assets/android-icon-foreground.png 1024  adaptive foreground (transparent)
 *   assets/android-icon-background.png 1024  adaptive background (solid ink)
 *   assets/android-icon-monochrome.png 1024  Android 13 themed icon (white mark)
 *   assets/favicon.png                   64  web favicon
 *   store/playstore-icon-512.png        512  Play listing icon
 *   store/feature-graphic.png      1024x500  Play listing feature graphic
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const MARK = path.join(ROOT, 'assets', 'images', 'mark.png');
const INK_NIGHT_BG = '#13111C';

const out = (...p) => path.join(ROOT, ...p);

async function markResized(size) {
  return sharp(MARK).resize(size, size).png().toBuffer();
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
  fs.mkdirSync(out('store'), { recursive: true });

  // App icon: visible mark ≈ 60% of the tile (mark art is ~64% of its frame).
  fs.writeFileSync(out('assets', 'icon.png'), await iconOn(INK_NIGHT_BG, 1024, 940));

  // Adaptive foreground: keep the visible mark inside the inner-2/3 safe zone.
  const fg = await markResized(880);
  fs.writeFileSync(
    out('assets', 'android-icon-foreground.png'),
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: 'rgba(0,0,0,0)' } })
      .composite([{ input: fg, gravity: 'center' }])
      .png()
      .toBuffer(),
  );

  // Adaptive background: solid Ink Night.
  fs.writeFileSync(
    out('assets', 'android-icon-background.png'),
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: INK_NIGHT_BG } })
      .png()
      .toBuffer(),
  );

  // Monochrome (Android 13 themed icons): the mark's silhouette in white.
  const alpha = await sharp(MARK).resize(880, 880).ensureAlpha().extractChannel(3).png().toBuffer();
  const whiteMark = await sharp({
    create: { width: 880, height: 880, channels: 3, background: '#FFFFFF' },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  fs.writeFileSync(
    out('assets', 'android-icon-monochrome.png'),
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: 'rgba(0,0,0,0)' } })
      .composite([{ input: whiteMark, gravity: 'center' }])
      .png()
      .toBuffer(),
  );

  // Favicon.
  fs.writeFileSync(
    out('assets', 'favicon.png'),
    await sharp(await iconOn(INK_NIGHT_BG, 1024, 940)).resize(64, 64).png().toBuffer(),
  );

  // Play listing icon (512, no alpha allowed).
  fs.writeFileSync(
    out('store', 'playstore-icon-512.png'),
    await sharp(await iconOn(INK_NIGHT_BG, 1024, 940)).resize(512, 512).flatten({ background: INK_NIGHT_BG }).png().toBuffer(),
  );

  // Feature graphic 1024x500: emblem + wordmark on Ink Night.
  const femblem = await markResized(430);
  const text = Buffer.from(`
    <svg width="1024" height="500">
      <text x="400" y="285" font-family="Verdana, DejaVu Sans, sans-serif"
            font-size="150" font-weight="bold" fill="#EFEDF9">rrows</text>
    </svg>`);
  fs.writeFileSync(
    out('store', 'feature-graphic.png'),
    await sharp({ create: { width: 1024, height: 500, channels: 3, background: INK_NIGHT_BG } })
      .composite([
        { input: femblem, left: 120, top: 35 },
        { input: text, left: 0, top: 0 },
      ])
      .png()
      .toBuffer(),
  );

  for (const f of [
    'assets/icon.png', 'assets/android-icon-foreground.png', 'assets/android-icon-background.png',
    'assets/android-icon-monochrome.png', 'assets/favicon.png',
    'store/playstore-icon-512.png', 'store/feature-graphic.png',
  ]) {
    console.log(`${f}  ${(fs.statSync(out(...f.split('/'))).size / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

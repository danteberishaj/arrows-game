#!/usr/bin/env node
/**
 * W5-11: audits the icon / launcher / splash rasters and writes the wordmark
 * options comparison sheet for the owner.
 *
 * Prints, for `mark.png`, both adaptive icon layers, `icon.png` and the Play
 * listing icon:
 *   - dimensions and channels (sharp metadata);
 *   - the opaque-pixel count and the furthest opaque radius as a fraction of
 *     the half-frame (files with no alpha channel are skipped: every pixel is
 *     opaque, the metric is not meaningful);
 *   - `mark.png`'s two dominant fully-opaque hues, as an RGB-histogram peak;
 *   - the width of the edge-transition band on `icon.png`, in px, along 8
 *     radial scanlines from its centre (the upscale-softness baseline for
 *     W5-13, since `icon.png`'s mark is a ~1.84x raster upscale of the 512px
 *     source — see generate-store-assets.js `iconOn(INK_NIGHT_BG, 1024, 940)`,
 *     940/512 = 1.836).
 *
 * Also writes artifacts/W5-11/wordmark-options.png (brief: `out/art/`; moved
 * under the task's own gitignored artifacts root per the W5-11/W5-15
 * controller dispatch, so every output this task produces is in one place —
 * see docs/art-icon-audit.md "Deviations"): the current raster emblem next to
 * a vector accent triangle, each set as the Wordmark at the menu's size 56,
 * in both palettes, at 3.5 px/dp (matches scripts/art/silhouette-sheet.ts's
 * convention).
 *
 * Run: node scripts/art/icon-audit.mjs
 *
 * Read-only tooling: this script never writes to assets/, store/ or app.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'artifacts', 'W5-11', 'wordmark-options.png');

// ---------------------------------------------------------------- inputs

const FILES = [
  { key: 'mark', label: 'assets/images/mark.png (Wordmark A, splash image)', path: path.join(ROOT, 'assets/images/mark.png') },
  { key: 'foreground', label: 'assets/android-icon-foreground.png (adaptive foreground layer)', path: path.join(ROOT, 'assets/android-icon-foreground.png') },
  { key: 'background', label: 'assets/android-icon-background.png (adaptive background layer)', path: path.join(ROOT, 'assets/android-icon-background.png') },
  { key: 'icon', label: 'assets/icon.png (app icon, mark composited on Ink Night)', path: path.join(ROOT, 'assets/icon.png') },
  { key: 'playstore', label: 'store/playstore-icon-512.png (Play listing icon)', path: path.join(ROOT, 'store/playstore-icon-512.png') },
];

// Android's adaptive-icon safe zone: the visible content should stay inside
// the inner 66/72 = 0.9166... of the full foreground layer per Android's
// spec, but this repo's own DESIGN.md / prior audit cites 0.611 as "the safe
// zone" fraction of the HALF-frame (i.e. of the 512px radius from centre for
// a 1024px layer) — see docs/art-icon-audit.md for the reproduced 0.596 vs
// 0.611 comparison. Not re-derived here; this script only measures.

// Two palettes' colours, copied verbatim from src/ui/theme.ts (this is a
// plain-Node .mjs tool, so it does not import the TS theme module; if
// theme.ts's Daylight/InkNight literals change, re-copy them here).
const PALETTES = {
  Daylight: { bg: '#FFFFFF', accent: '#6D4AEF', ink: '#191724' },
  InkNight: { bg: '#13111C', accent: '#7B5BF5', ink: '#EFEDF9' },
};

// ---------------------------------------------------------------- pixel helpers

async function loadRaw(filePath) {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, info, metadata };
}

function distance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Opaque-pixel count and furthest-opaque-radius fraction of the half-frame.
 * "Opaque" here means alpha > 0 (any visible content, including a partially-
 * transparent antialiased edge pixel) — this is the definition that
 * reproduces the adaptive foreground's previously-measured 0.596 to
 * +/-0.005 (checked against the acceptance criterion below).
 */
function opaqueExtent(data, info) {
  const { width, height, channels } = info;
  if (channels < 4) return null; // no alpha channel: every pixel is opaque, not a meaningful metric
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const halfFrame = Math.min(width, height) / 2;
  let opaqueCount = 0;
  let maxRadius = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3];
      if (alpha > 0) {
        opaqueCount += 1;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > maxRadius) maxRadius = r;
      }
    }
  }
  return { opaqueCount, halfFrame, radiusFraction: maxRadius / halfFrame };
}

/**
 * The two dominant hues among FULLY opaque pixels (alpha === 255, or every
 * pixel if there is no alpha channel), as a peak of an RGB histogram
 * quantized to BUCKET-wide bins (OWNER-PICKED STARTING VALUE: 32, chosen
 * because it is the coarsest bucket that still separates mark.png's violet
 * and magenta into two bins rather than merging them or fragmenting each
 * into several shading variants — checked at 16/24/32 while writing this
 * script).
 */
function dominantHues(data, info, bucket = 32) {
  const { width, height, channels } = info;
  const hist = new Map();
  let total = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const alpha = channels < 4 ? 255 : data[idx + 3];
      if (alpha !== 255) continue;
      total += 1;
      const r = Math.round(data[idx] / bucket) * bucket;
      const g = Math.round(data[idx + 1] / bucket) * bucket;
      const b = Math.round(data[idx + 2] / bucket) * bucket;
      const key = `${r},${g},${b}`;
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
  }
  const sorted = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  const toEntry = ([key, count]) => {
    const [r, g, b] = key.split(',').map(Number);
    const hex = `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
    return { rgb: [r, g, b], hex, count, fraction: count / total };
  };
  return { totalFullyOpaque: total, bucket, peaks: sorted.slice(0, 2).map(toEntry) };
}

/**
 * Edge-transition-band width on `icon.png`, along 8 radial scanlines from
 * the image centre (0deg = +x axis, stepping by 45deg). For each ray:
 *   - `bg` is sampled at RMAX (well outside the mark, into the solid fill);
 *   - walking inward from RMAX, `rBoundary` is the first radius where the
 *     colour distance from `bg` exceeds T_HI (OWNER-PICKED STARTING VALUE:
 *     40 of a max ~441 Euclidean RGB distance) -- the outer onset of the
 *     transition;
 *   - within a further WINDOW px inward (OWNER-PICKED STARTING VALUE: 8,
 *     checked stable against 6/10/12 while writing this script -- the result
 *     does not change, so the transition itself is well inside this window
 *     and not an artifact of the window size), `dMaxWindow` is the largest
 *     colour distance found;
 *   - `rInner` is the first radius (from `rBoundary` inward) reaching
 *     FRAC * dMaxWindow (OWNER-PICKED STARTING VALUE: 0.9);
 *   - edge width = rBoundary - rInner, in px.
 * A larger, unbounded search window was tried first and rejected: it walks
 * past the antialiased edge into the mark's own internal shading gradient
 * and reports that gradient's width instead of the upscale edge's.
 */
function edgeTransitionBand(data, info) {
  const { width, height, channels } = info;
  const T_HI = 40;
  const WINDOW = 8;
  const FRAC = 0.9;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rMax = Math.min(width, height) / 2 - 4;
  const sample = (x, y) => {
    const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
    const idx = (yi * width + xi) * channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };
  const rays = [];
  for (let k = 0; k < 8; k += 1) {
    const angleDeg = k * 45;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);
    const bg = sample(cx + dx * rMax, cy + dy * rMax);
    let rBoundary = null;
    for (let r = Math.floor(rMax); r >= 0; r -= 1) {
      if (distance(sample(cx + dx * r, cy + dy * r), bg) > T_HI) {
        rBoundary = r;
        break;
      }
    }
    if (rBoundary === null) {
      rays.push({ angleDeg, edgeWidthPx: null, note: 'no crossing found (ray stayed within T_HI of background)' });
      continue;
    }
    let dMaxWindow = 0;
    for (let r = rBoundary; r >= Math.max(0, rBoundary - WINDOW); r -= 1) {
      const d = distance(sample(cx + dx * r, cy + dy * r), bg);
      if (d > dMaxWindow) dMaxWindow = d;
    }
    let rInner = Math.max(0, rBoundary - WINDOW);
    let saturated = true;
    for (let r = rBoundary; r >= Math.max(0, rBoundary - WINDOW); r -= 1) {
      const d = distance(sample(cx + dx * r, cy + dy * r), bg);
      if (d >= FRAC * dMaxWindow) {
        rInner = r;
        saturated = false;
        break;
      }
    }
    rays.push({
      angleDeg,
      rBoundary,
      edgeWidthPx: rBoundary - rInner,
      note: saturated ? `>= window (${WINDOW}px): transition did not saturate locally` : undefined,
    });
  }
  return { thresholds: { T_HI, WINDOW, FRAC }, rays };
}

// ---------------------------------------------------------------- report

async function auditFile(entry) {
  const { data, info, metadata } = await loadRaw(entry.path);
  console.log(`\n== ${entry.label} ==`);
  console.log(`  path: ${path.relative(ROOT, entry.path)}`);
  console.log(`  dimensions: ${metadata.width}x${metadata.height}`);
  console.log(`  channels: ${metadata.channels} (hasAlpha: ${metadata.hasAlpha})`);

  const extent = opaqueExtent(data, info);
  if (extent) {
    console.log(
      `  opaque pixels (alpha>0): ${extent.opaqueCount} / ${info.width * info.height} `
        + `(${((extent.opaqueCount / (info.width * info.height)) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  furthest opaque radius: ${extent.radiusFraction.toFixed(4)} of the half-frame `
        + `(halfFrame=${extent.halfFrame}px)`,
    );
  } else {
    console.log('  opaque extent: not applicable (no alpha channel; every pixel is opaque)');
  }

  if (entry.key === 'mark') {
    const hues = dominantHues(data, info);
    console.log(`  dominant-hue histogram: ${hues.totalFullyOpaque} fully-opaque px, bucket=${hues.bucket}`);
    hues.peaks.forEach((peak, index) => {
      console.log(
        `    peak ${index + 1}: ${peak.hex} (rgb ${peak.rgb.join(',')}), `
          + `${peak.count} px (${(peak.fraction * 100).toFixed(1)}% of fully-opaque px)`,
      );
    });
  }

  if (entry.key === 'icon') {
    const band = edgeTransitionBand(data, info);
    console.log(
      `  edge-transition band (8 radial scanlines from centre; T_HI=${band.thresholds.T_HI}, `
        + `WINDOW=${band.thresholds.WINDOW}px, FRAC=${band.thresholds.FRAC}):`,
    );
    for (const ray of band.rays) {
      const noteSuffix = ray.note ? ` -- ${ray.note}` : '';
      console.log(`    ${ray.angleDeg}deg: ${ray.edgeWidthPx === null ? 'N/A' : `${ray.edgeWidthPx}px`}${noteSuffix}`);
    }
  }

  return { entry, metadata, extent };
}

// ---------------------------------------------------------------- wordmark-options sheet

const DP_SCALE = 3.5; // matches scripts/art/silhouette-sheet.ts's PIXELS_PER_DP
const WORDMARK_SIZE_DP = 56; // src/ui/HomeScreen.tsx:173, src/ui/SplashScreen.tsx:153
const TRI_W_DP = WORDMARK_SIZE_DP * 0.92; // src/ui/Wordmark.tsx:11
const RECT_W_DP = TRI_W_DP / 0.64; // src/ui/Wordmark.tsx:14 (raster's transparent margin)
const CELL_W_PX = 780; // wide enough that "rrows" at 56dp*3.5px/dp clears the cell edge
const CELL_H_PX = 260;
const LABEL_H_PX = 44;
const COLUMN_TITLE_PX = 22;

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** One cell's background + label + "rrows" text (+ vector triangle, for the accent option). SVG only; the raster mark is composited afterwards. */
function cellSvg(x, y, palette, paletteName, variant) {
  const triWPx = TRI_W_DP * DP_SCALE;
  const sizePx = WORDMARK_SIZE_DP * DP_SCALE;
  const marginLeftPx = WORDMARK_SIZE_DP * 0.04 * DP_SCALE;
  const glyphBoxX = x + 24;
  const glyphBoxY = y + LABEL_H_PX + (CELL_H_PX - LABEL_H_PX - triWPx) / 2;
  const textX = glyphBoxX + triWPx + marginLeftPx;
  const textBaselineY = glyphBoxY + triWPx / 2 + sizePx * 0.34; // visually centred baseline for this font size
  const label = variant === 'raster' ? `${paletteName} -- current (mark.png raster)` : `${paletteName} -- vector accent triangle`;

  const parts = [
    `<rect x="${x}" y="${y}" width="${CELL_W_PX}" height="${CELL_H_PX}" fill="${palette.bg}" stroke="#8888" stroke-width="1"/>`,
    `<text x="${x + 24}" y="${y + 28}" font-family="sans-serif" font-size="${COLUMN_TITLE_PX}" fill="${palette.ink}">${escapeXml(label)}</text>`,
    `<text x="${textX}" y="${textBaselineY}" font-family="sans-serif" font-weight="700" font-size="${sizePx}" fill="${palette.ink}" letter-spacing="${WORDMARK_SIZE_DP * 0.01 * DP_SCALE}">rrows</text>`,
  ];
  if (variant === 'vector') {
    // "a filled accent violet triangle (▲rrows)" -- DESIGN.md:51-52. Apex top-centre, base at the
    // glyph box's bottom, matching the raster cell's triW x triW footprint so sizes compare directly.
    const apex = `${glyphBoxX + triWPx / 2},${glyphBoxY}`;
    const baseLeft = `${glyphBoxX},${glyphBoxY + triWPx}`;
    const baseRight = `${glyphBoxX + triWPx},${glyphBoxY + triWPx}`;
    parts.push(`<polygon points="${apex} ${baseLeft} ${baseRight}" fill="${palette.accent}"/>`);
  }
  return { svg: parts.join('\n'), glyphBoxX, glyphBoxY, triWPx };
}

async function writeWordmarkOptionsSheet() {
  const markPath = path.join(ROOT, 'assets/images/mark.png');
  const rectWPx = Math.round(RECT_W_DP * DP_SCALE);
  const markResized = await sharp(markPath).resize(rectWPx, rectWPx).png().toBuffer();
  const markMarginTopPx = -WORDMARK_SIZE_DP * 0.04 * DP_SCALE; // Wordmark.tsx:27's marginTop nudge

  const columns = ['raster', 'vector'];
  const rows = [
    ['Daylight', PALETTES.Daylight],
    ['InkNight', PALETTES.InkNight],
  ];
  const width = CELL_W_PX * columns.length;
  const height = CELL_H_PX * rows.length + 40;

  const svgParts = [
    `<text x="20" y="26" font-family="sans-serif" font-size="20" font-weight="700" fill="#191724">`
      + `W5-11 wordmark options -- current emblem vs vector accent triangle, size ${WORDMARK_SIZE_DP}dp, ${DP_SCALE}px/dp</text>`,
  ];
  const composites = [];
  rows.forEach(([paletteName, palette], rowIndex) => {
    columns.forEach((variant, colIndex) => {
      const x = colIndex * CELL_W_PX;
      const y = 40 + rowIndex * CELL_H_PX;
      const cell = cellSvg(x, y, palette, paletteName, variant);
      svgParts.push(cell.svg);
      if (variant === 'raster') {
        composites.push({
          input: markResized,
          left: Math.round(cell.glyphBoxX + (cell.triWPx - rectWPx) / 2),
          top: Math.round(cell.glyphBoxY + (cell.triWPx - rectWPx) / 2 + markMarginTopPx),
        });
      }
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#DDDDDD"/>
    ${svgParts.join('\n')}
  </svg>`;

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  await sharp(Buffer.from(svg)).composite(composites).png().toFile(OUTPUT_PATH);
  console.log(`\nWrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log('W5-11 icon audit -- scripts/art/icon-audit.mjs');
  for (const entry of FILES) {
    // eslint-disable-next-line no-await-in-loop
    await auditFile(entry);
  }
  await writeWordmarkOptionsSheet();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

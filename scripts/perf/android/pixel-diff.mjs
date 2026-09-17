#!/usr/bin/env node
// Changed-pixel fraction between two PNGs (P-02 Stage D).
//
//   node scripts/perf/android/pixel-diff.mjs a.png b.png --region board \
//     --board left,top,right,bottom --header-bottom y [--scale 0.5] \
//     [--mask x,y,w,h ...] [--tolerance 24]
//
// A pixel is "changed" when its max RGB channel delta is GREATER than the
// tolerance. Masked pixels leave both the numerator and the denominator.
// Coordinates for --board / --header-bottom are device pixels; --scale maps them
// onto a frame of another size (a 720x1560 recording of a 1440x3120 display is 0.5).
// Masks are given in the IMAGE's own pixels.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const DEFAULT_TOLERANCE = 24; // OWNER-PICKED STARTING VALUE (max channel delta, 0..255)

export async function decodePng(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`expected 3 channels, got ${info.channels}`);
  return { width: info.width, height: info.height, data };
}

function clip(value, max) {
  return Math.max(0, Math.min(max, value));
}

/**
 * `screen`: the full frame. `board`: the board bounds (findBoardBounds) with
 * everything above `headerBottom` removed, so the `{remaining} left` counter
 * and the heart pips, which change on every removal, fall outside it.
 */
export function resolveRegion(name, image, { board, headerBottom, scale = 1 } = {}) {
  if (name === 'screen') return { left: 0, top: 0, right: image.width, bottom: image.height };
  if (name !== 'board') throw new Error(`unknown region ${JSON.stringify(name)} (board or screen)`);
  if (!board) throw new Error('the board region needs board bounds');
  const top = Math.max(board.top, headerBottom ?? board.top);
  return {
    left: clip(Math.round(board.left * scale), image.width),
    top: clip(Math.round(top * scale), image.height),
    right: clip(Math.round(board.right * scale), image.width),
    bottom: clip(Math.round(board.bottom * scale), image.height),
  };
}

export function parseMask(text) {
  const parts = String(text).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] < 0 || parts[3] < 0) {
    throw new Error(`--mask must be x,y,w,h (got ${JSON.stringify(text)})`);
  }
  const [x, y, w, h] = parts;
  return { x, y, w, h };
}

export function parseBounds(text) {
  const parts = String(text).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--board must be left,top,right,bottom (got ${JSON.stringify(text)})`);
  }
  const [left, top, right, bottom] = parts;
  return { left, top, right, bottom };
}

function masked(masks, x, y) {
  for (const m of masks) {
    if (x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h) return true;
  }
  return false;
}

export function diffImages(a, b, { rect, masks = [], tolerance = DEFAULT_TOLERANCE }) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let total = 0;
  let changed = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = rect.top; y < rect.bottom; y += 1) {
    for (let x = rect.left; x < rect.right; x += 1) {
      if (masks.length > 0 && masked(masks, x, y)) continue;
      total += 1;
      const i = (y * a.width + x) * 3;
      const delta = Math.max(
        Math.abs(a.data[i] - b.data[i]),
        Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]),
      );
      if (delta > tolerance) {
        changed += 1;
        sumX += x + 0.5;
        sumY += y + 0.5;
      }
    }
  }
  return {
    total,
    changed,
    fraction: total === 0 ? 0 : changed / total,
    centroid: changed === 0 ? null : { x: sumX / changed, y: sumY / changed },
    tolerance,
    rect,
    masks,
  };
}

export function directionVector(direction) {
  const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const vector = vectors[String(direction).toLowerCase()];
  if (!vector) throw new Error(`unknown direction ${JSON.stringify(direction)}`);
  return vector;
}

/** Signed centroid travel from c1 to c2 along a unit direction; 0 when either is missing. */
export function displacementAlong(c1, c2, vector) {
  if (!c1 || !c2) return 0;
  return (c2.x - c1.x) * vector.x + (c2.y - c1.y) * vector.y;
}

/**
 * Exit motion (P-02 Stage E). frames[0] is the pre-phase frame, frames.at(-1) the settled frame after
 * the exit. The FOOTPRINT is every pixel that differs between those two (the removed arrow), dilated
 * by `dilatePx`. TRAIL pixels of a frame differ from the pre frame and lie outside the footprint,
 * i.e. ink drawn where no arrow was. A stationary fade stays inside the footprint and has none.
 *
 * first  = first frame with more than `trailCountFloor` trail pixels;
 * second = first later frame at least `secondFrameOffsetMs` after `first` that also has trail pixels;
 * displacementPx = travel of the trail centroid from first to second along `direction` (0 if either
 * is missing). maxChangedFraction is the plain changed-pixel fraction vs pre, printed so the
 * alpha-fade trap (pixels change, nothing moves) is visible.
 */
export function exitMotion(frames, times, {
  rect,
  direction,
  dilatePx = 2,
  secondFrameOffsetMs = 60,
  trailCountFloor = 0,
  tolerance = DEFAULT_TOLERANCE,
}) {
  if (frames.length !== times.length) throw new Error(`frames ${frames.length} != times ${times.length}`);
  const pre = frames[0];
  const settled = frames.at(-1);
  const { width, height } = pre;
  const differs = (a, b, i) =>
    Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    ) > tolerance;
  const footprint = new Uint8Array(width * height);
  let footprintCount = 0;
  for (let y = rect.top; y < rect.bottom; y += 1) {
    for (let x = rect.left; x < rect.right; x += 1) {
      if (!differs(pre, settled, (y * width + x) * 3)) continue;
      footprintCount += 1;
      for (let dy = -dilatePx; dy <= dilatePx; dy += 1) {
        for (let dx = -dilatePx; dx <= dilatePx; dx += 1) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < height && xx >= 0 && xx < width) footprint[yy * width + xx] = 1;
        }
      }
    }
  }
  const total = (rect.right - rect.left) * (rect.bottom - rect.top);
  const perFrame = [];
  let maxChangedFraction = 0;
  for (let index = 1; index < frames.length - 1; index += 1) {
    const image = frames[index];
    let changed = 0;
    let trail = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = rect.top; y < rect.bottom; y += 1) {
      for (let x = rect.left; x < rect.right; x += 1) {
        const p = y * width + x;
        if (!differs(pre, image, p * 3)) continue;
        changed += 1;
        if (footprint[p]) continue;
        trail += 1;
        sumX += x + 0.5;
        sumY += y + 0.5;
      }
    }
    const fraction = total === 0 ? 0 : changed / total;
    maxChangedFraction = Math.max(maxChangedFraction, fraction);
    perFrame.push({
      index,
      t: times[index],
      changedFraction: fraction,
      trailPixels: trail,
      trailCentroid: trail === 0 ? null : { x: sumX / trail, y: sumY / trail },
    });
  }
  const first = perFrame.find((f) => f.trailPixels > trailCountFloor) ?? null;
  const second = first === null
    ? null
    : perFrame.find((f) =>
      f.index > first.index &&
      f.trailPixels > trailCountFloor &&
      (f.t - first.t) * 1000 >= secondFrameOffsetMs - 1e-6) ?? null;
  return {
    footprintPixels: footprintCount,
    first,
    second,
    displacementPx: first && second
      ? displacementAlong(first.trailCentroid, second.trailCentroid, directionVector(direction))
      : 0,
    maxChangedFraction,
    perFrame,
  };
}

function parseCli(argv) {
  const options = { files: [], region: 'screen', masks: [], tolerance: DEFAULT_TOLERANCE, scale: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === '--region') options.region = value();
    else if (arg === '--board') options.board = parseBounds(value());
    else if (arg === '--header-bottom') options.headerBottom = Number(value());
    else if (arg === '--scale') options.scale = Number(value());
    else if (arg === '--mask') options.masks.push(parseMask(value()));
    else if (arg === '--tolerance') options.tolerance = Number(value());
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else options.files.push(resolve(arg));
  }
  if (options.files.length !== 2) throw new Error('usage: pixel-diff.mjs a.png b.png [options]');
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const [a, b] = await Promise.all(options.files.map((file) => decodePng(file)));
  const rect = resolveRegion(options.region, a, options);
  const result = diffImages(a, b, { rect, masks: options.masks, tolerance: options.tolerance });
  process.stdout.write(`${JSON.stringify({ files: options.files, region: options.region, ...result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}

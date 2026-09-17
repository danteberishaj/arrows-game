import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  decodePng,
  diffImages,
  directionVector,
  displacementAlong,
  parseMask,
  resolveRegion,
} from './pixel-diff.mjs';

const W = 40;
const H = 30;

/** Synthetic RGB PNG: white, with `paint(x, y)` returning [r,g,b] or null to keep white. */
async function png(paint = () => null) {
  const raw = Buffer.alloc(W * H * 3, 255);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const rgb = paint(x, y);
      if (rgb) raw.set(rgb, (y * W + x) * 3);
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

test('decodePng returns RGB without alpha', async () => {
  const withAlpha = await sharp(Buffer.alloc(4 * 4 * 4, 128), { raw: { width: 4, height: 4, channels: 4 } })
    .png()
    .toBuffer();
  const image = await decodePng(withAlpha);
  assert.equal(image.width, 4);
  assert.equal(image.height, 4);
  assert.equal(image.data.length, 4 * 4 * 3);
});

test('a known count of differing pixels gives the exact fraction', async () => {
  const a = await decodePng(await png());
  // 7 pixels changed by 200 on one channel, 5 changed by exactly the tolerance (not counted).
  const changed = new Set(['1,1', '2,1', '3,1', '10,20', '11,20', '39,29', '0,0']);
  const atTolerance = new Set(['5,5', '6,5', '7,5', '8,5', '9,5']);
  const b = await decodePng(await png((x, y) => {
    if (changed.has(`${x},${y}`)) return [255, 55, 255];
    if (atTolerance.has(`${x},${y}`)) return [255 - 24, 255, 255];
    return null;
  }));
  const result = diffImages(a, b, { rect: resolveRegion('screen', a), tolerance: 24 });
  assert.equal(result.total, W * H);
  assert.equal(result.changed, 7);
  assert.equal(result.fraction, 7 / (W * H));
});

test('a mask removes exactly the masked pixels from numerator and denominator', async () => {
  const a = await decodePng(await png());
  // 10x10 block of changes at (0,0); mask covers its left 4 columns (40 px) plus 30 unchanged px.
  const b = await decodePng(await png((x, y) => (x < 10 && y < 10 ? [0, 0, 0] : null)));
  const rect = resolveRegion('screen', a);
  const unmasked = diffImages(a, b, { rect, tolerance: 24 });
  assert.equal(unmasked.changed, 100);
  const mask = parseMask('0,0,4,17'); // 4 wide x 17 tall = 68 px: 40 changed + 28 unchanged
  assert.deepEqual(mask, { x: 0, y: 0, w: 4, h: 17 });
  const masked = diffImages(a, b, { rect, masks: [mask], tolerance: 24 });
  assert.equal(masked.changed, 60);
  assert.equal(masked.total, W * H - 68);
  assert.equal(masked.fraction, 60 / (W * H - 68));
  assert.throws(() => parseMask('1,2,3'), /x,y,w,h/);
});

test('the board region excludes a synthetic header strip', async () => {
  const a = await decodePng(await png());
  // The header (rows 0..7) changes; the board below it does not.
  const b = await decodePng(await png((x, y) => (y < 8 ? [228, 50, 125] : null)));
  const board = { left: 0, top: 4, right: W, bottom: H }; // accessibility bounds overlap the header
  const rect = resolveRegion('board', a, { board, headerBottom: 8 });
  assert.deepEqual(rect, { left: 0, top: 8, right: W, bottom: H });
  const inBoard = diffImages(a, b, { rect, tolerance: 24 });
  assert.equal(inBoard.changed, 0);
  assert.equal(inBoard.total, W * (H - 8));
  assert.equal(diffImages(a, b, { rect: resolveRegion('screen', a), tolerance: 24 }).changed, W * 8);
  assert.throws(() => resolveRegion('board', a, {}), /board bounds/);
  assert.throws(() => resolveRegion('hud', a, {}), /region/);
});

test('board bounds in device pixels scale to a half-size recording frame', async () => {
  const a = await decodePng(await png());
  const rect = resolveRegion('board', a, {
    board: { left: 0, top: 20, right: 80, bottom: 60 },
    headerBottom: 30,
    scale: 0.5,
  });
  assert.deepEqual(rect, { left: 0, top: 15, right: 40, bottom: 30 });
});

test('the centroid of changed pixels and its displacement along an exit direction', async () => {
  const a = await decodePng(await png());
  const early = await decodePng(await png((x, y) => (x >= 10 && x < 14 && y >= 10 && y < 12 ? [0, 0, 0] : null)));
  const late = await decodePng(await png((x, y) => (x >= 20 && x < 24 && y >= 10 && y < 12 ? [0, 0, 0] : null)));
  const rect = resolveRegion('screen', a);
  const c1 = diffImages(a, early, { rect, tolerance: 24 }).centroid;
  const c2 = diffImages(a, late, { rect, tolerance: 24 }).centroid;
  assert.deepEqual(c1, { x: 12, y: 11 });
  assert.deepEqual(c2, { x: 22, y: 11 });
  assert.equal(displacementAlong(c1, c2, directionVector('right')), 10);
  assert.equal(displacementAlong(c1, c2, directionVector('left')), -10);
  assert.equal(displacementAlong(c1, c2, directionVector('down')), 0);
  // No changed pixels: no centroid, and no displacement can be claimed.
  assert.equal(diffImages(a, a, { rect, tolerance: 24 }).centroid, null);
  assert.equal(displacementAlong(null, c2, directionVector('up')), 0);
});

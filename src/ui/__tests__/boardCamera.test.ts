import {
  cameraViewport,
  centreOn,
  initialCamera,
  panRange,
  TARGET_CELLS_ACROSS,
  ZOOM_SKIP_FIT_CELL_PT,
} from '../boardCamera';

const CELL = 40;

/**
 * Visible board viewports measured on the API 31 emulator
 * (docs/board-viewport-measured.md, "Adjusted comparison" column).
 */
const VIEWPORTS = [
  { name: '411x756 (1440x3120@560)', w: 411.428571, h: 756.285714 },
  { name: '360x633 (1080x2340@480)', w: 360, h: 633 },
  { name: '360x493 (1080x1920@480)', w: 360, h: 493 },
] as const;

const BOARDS = [
  { name: '5x5 tutorial', rows: 5, cols: 5 },
  { name: '8x8', rows: 8, cols: 8 },
  { name: '20x20 (level 1)', rows: 20, cols: 20 },
  { name: '39x39 (level 3827)', rows: 39, cols: 39 },
  { name: '46x46', rows: 46, cols: 46 },
] as const;

/** Today's fit, restated independently of the module under test. */
const fitOf = (vw: number, vh: number, rows: number, cols: number) =>
  Math.min(vw / (cols * CELL), vh / (rows * CELL)) * 0.94;

const expectInsidePanRange = (t: number, size: number, viewport: number) => {
  const [lo, hi] = panRange(size, viewport);
  expect(t).toBeGreaterThanOrEqual(lo - 1e-9);
  expect(t).toBeLessThanOrEqual(hi + 1e-9);
};

describe('initialCamera, META_ZOOMED_CAMERA off (today)', () => {
  it.each(VIEWPORTS.flatMap((v) => BOARDS.map((b) => [v.name, b.name, v, b] as const)))(
    '%s, %s: fit, centred, same arithmetic as the pre-flag fitToViewport',
    (_vn, _bn, v, b) => {
      const boardW = b.cols * CELL;
      const boardH = b.rows * CELL;
      const cam = initialCamera(v.w, v.h, boardW, boardH, CELL, false)!;
      const fit = Math.min(v.w / boardW, v.h / boardH) * 0.94;
      expect(cam.scale).toBe(fit);
      expect(cam.minScale).toBe(fit);
      expect(cam.maxScale).toBe(Math.max(fit * 3.5, 64 / 40));
      expect(cam.tx).toBe((v.w - boardW * fit) / 2);
      expect(cam.ty).toBe((v.h - boardH * fit) / 2);
    },
  );
});

describe('initialCamera, META_ZOOMED_CAMERA on (R1 + R1a)', () => {
  it('uses the ruled constants', () => {
    expect(TARGET_CELLS_ACROSS).toBe(14);
    expect(ZOOM_SKIP_FIT_CELL_PT).toBe(23.5);
  });

  // Expected on-screen cell (dp): fit cell when it is already >= 23.5 dp (R1a),
  // otherwise viewport width / 14 (R1). Values computed by hand from the table
  // in docs/board-viewport-measured.md.
  const EXPECTED_CELL_DP: Record<string, Record<string, number>> = {
    '411x756 (1440x3120@560)': {
      '5x5 tutorial': 0.94 * 411.428571 / 5, // 77.35, fit
      '8x8': 0.94 * 411.428571 / 8, // 48.34, fit
      '20x20 (level 1)': 411.428571 / 14, // 29.39 (fit 19.34)
      '39x39 (level 3827)': 411.428571 / 14, // 29.39 (fit 9.92)
      '46x46': 411.428571 / 14, // 29.39 (fit 8.41)
    },
    '360x633 (1080x2340@480)': {
      '5x5 tutorial': 0.94 * 360 / 5, // 67.68, fit
      '8x8': 0.94 * 360 / 8, // 42.30, fit
      '20x20 (level 1)': 360 / 14, // 25.71 (fit 16.92)
      '39x39 (level 3827)': 360 / 14,
      '46x46': 360 / 14,
    },
    '360x493 (1080x1920@480)': {
      '5x5 tutorial': 0.94 * 360 / 5, // 67.68, fit (width-bound: 360/5 < 493/5)
      '8x8': 0.94 * 360 / 8, // 42.30, fit
      '20x20 (level 1)': 360 / 14, // 25.71 (fit 16.92)
      '39x39 (level 3827)': 360 / 14,
      '46x46': 360 / 14,
    },
  };

  it.each(VIEWPORTS.flatMap((v) => BOARDS.map((b) => [v.name, b.name, v, b] as const)))(
    '%s, %s: cell size, pan range, unchanged min/max',
    (vn, bn, v, b) => {
      const boardW = b.cols * CELL;
      const boardH = b.rows * CELL;
      const cam = initialCamera(v.w, v.h, boardW, boardH, CELL, true)!;
      const fit = fitOf(v.w, v.h, b.rows, b.cols);

      expect(cam.scale * CELL).toBeCloseTo(EXPECTED_CELL_DP[vn][bn], 6);
      // minScale / maxScale unchanged: a full pinch-out still reaches fit.
      expect(cam.minScale).toBeCloseTo(fit, 12);
      expect(cam.maxScale).toBeCloseTo(Math.max(fit * 3.5, 64 / 40), 12);
      expect(cam.scale).toBeGreaterThanOrEqual(cam.minScale);
      expect(cam.scale).toBeLessThanOrEqual(cam.maxScale);
      // The translation is one the gestures could also reach.
      expectInsidePanRange(cam.tx, boardW * cam.scale, v.w);
      expectInsidePanRange(cam.ty, boardH * cam.scale, v.h);
      // Centred on the board centre (the clamp never moves a centred board).
      expect(cam.tx + (boardW / 2) * cam.scale).toBeCloseTo(v.w / 2, 6);
      expect(cam.ty + (boardH / 2) * cam.scale).toBeCloseTo(v.h / 2, 6);
    },
  );

  it('opens level 1 on the 411 dp phone at about 14 cells across', () => {
    const v = VIEWPORTS[0];
    const cam = initialCamera(v.w, v.h, 20 * CELL, 20 * CELL, CELL, true)!;
    expect(v.w / (cam.scale * CELL)).toBeCloseTo(14, 9);
    // The board (20 columns) now runs past both side edges.
    expect(cam.tx).toBeLessThan(0);
    expect(cam.tx + 20 * CELL * cam.scale).toBeGreaterThan(v.w);
  });

  it('R1a: a board whose fit cell is just over 23.5 dp opens at fit; just under zooms', () => {
    const vw = 402;
    const vh = 2000;
    // 16 columns: fit cell 0.94 * 402 / 16 = 23.62 dp >= 23.5, so fit.
    const at = initialCamera(vw, vh, 16 * CELL, 16 * CELL, CELL, true)!;
    expect(at.scale).toBe(at.minScale);
    expect(at.scale * CELL).toBeCloseTo(0.94 * 402 / 16, 9);
    // 17 columns: fit cell 22.23 dp < 23.5, so 14 across (28.71 dp).
    const under = initialCamera(vw, vh, 17 * CELL, 17 * CELL, CELL, true)!;
    expect(under.scale * CELL).toBeCloseTo(vw / 14, 9);
  });

  it('a tall narrow board (4 cols x 46 rows) zooms to 14 across and stays centred on its narrow axis', () => {
    // Height-bound fit: 0.94 * 756.29 / 46 = 15.45 dp < 23.5, so it zooms to 29.39 dp.
    const v = VIEWPORTS[0];
    const cam = initialCamera(v.w, v.h, 4 * CELL, 46 * CELL, CELL, true)!;
    expect(cam.scale * CELL).toBeCloseTo(v.w / 14, 9);
    // 4 columns at 29.39 dp = 117.6 dp: narrower than the viewport, so centred and locked on x.
    const [xlo, xhi] = panRange(4 * CELL * cam.scale, v.w);
    expect(xlo).toBe(xhi);
    expect(cam.tx).toBeCloseTo(xlo, 9);
    expectInsidePanRange(cam.ty, 46 * CELL * cam.scale, v.h);
  });

  it('never exceeds maxScale (tiny viewport where the target would pass it)', () => {
    // vw / 14 / CELL > max(fit*3.5, 1.6) needs a huge width relative to the board height.
    const cam = initialCamera(3000, 100, 40 * CELL, 40 * CELL, CELL, true)!;
    const fit = Math.min(3000 / 1600, 100 / 1600) * 0.94;
    expect(cam.scale).toBe(Math.max(fit * 3.5, 64 / 40));
  });

  it('ignores a zero-size layout', () => {
    expect(initialCamera(0, 500, 800, 800, CELL, true)).toBeNull();
    expect(initialCamera(400, 0.5, 800, 800, CELL, false)).toBeNull();
  });
});

describe('centreOn (hint recentre) under the zoomed camera', () => {
  const v = VIEWPORTS[0];
  const boardW = 39 * CELL;
  const boardH = 39 * CELL;
  const cam = initialCamera(v.w, v.h, boardW, boardH, CELL, true)!;

  it('brings an off-screen arrow on a 39x39 board to the viewport centre', () => {
    // Arrow around cell (row 20, col 8): left of the screen at the zoomed start
    // (visible columns are about 12.5-26.5), and centrable without a clamp.
    const cx = 8.5 * CELL;
    const cy = 20.5 * CELL;
    const before = { x: cam.tx + cx * cam.scale, y: cam.ty + cy * cam.scale };
    expect(before.x < 0 || before.x > v.w || before.y < 0 || before.y > v.h).toBe(true);

    const { tx, ty } = centreOn(cx, cy, cam.scale, v.w, v.h, boardW, boardH);
    expect(tx + cx * cam.scale).toBeCloseTo(v.w / 2, 9);
    expect(ty + cy * cam.scale).toBeCloseTo(v.h / 2, 9);
    expectInsidePanRange(tx, boardW * cam.scale, v.w);
    expectInsidePanRange(ty, boardH * cam.scale, v.h);
  });

  it('a corner arrow is clamped by panRange but still lands inside the viewport', () => {
    const cx = 0.5 * CELL;
    const cy = 38.5 * CELL;
    const { tx, ty } = centreOn(cx, cy, cam.scale, v.w, v.h, boardW, boardH);
    expectInsidePanRange(tx, boardW * cam.scale, v.w);
    expectInsidePanRange(ty, boardH * cam.scale, v.h);
    const x = tx + cx * cam.scale;
    const y = ty + cy * cam.scale;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(v.w);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(v.h);
  });

  it('at fit (flag off) it keeps today\'s locked, centred camera', () => {
    const fitCam = initialCamera(v.w, v.h, boardW, boardH, CELL, false)!;
    const { tx, ty } = centreOn(0.5 * CELL, 0.5 * CELL, fitCam.scale, v.w, v.h, boardW, boardH);
    expect(tx).toBe(fitCam.tx);
    expect(ty).toBe(fitCam.ty);
  });
});

/**
 * Fix round 1: with META_ZOOMED_CAMERA the camera treats the VISIBLE area as its viewport. The
 * board view's raw layout runs under the 3-button navigation bar (Android edge-to-edge), so the
 * bottom safe-area inset is taken off the camera viewport, while the board keeps drawing to the
 * raw bottom edge. Raw layouts and insets are the measured ones in
 * docs/board-viewport-measured.md (raw log height, `cur - app` inset).
 */
describe('cameraViewport (bottom safe-area inset)', () => {
  const RAW = [
    { name: '1440x3120@560', w: 411.428558, h: 804.285706, inset: 48, visibleH: 756.285706 },
    { name: '1080x2340@480', w: 360, h: 689, inset: 56, visibleH: 633 },
    { name: '1080x1920@480', w: 360, h: 549, inset: 56, visibleH: 493 },
  ] as const;

  it.each(RAW.map((r) => [r.name, r] as const))('%s: the camera viewport is the area above the inset', (_n, r) => {
    expect(cameraViewport(r.w, r.h, r.inset)).toEqual({ w: r.w, h: r.visibleH });
  });

  it('no inset (flag OFF passes 0) keeps the raw layout', () => {
    expect(cameraViewport(411.428558, 804.285706, 0)).toEqual({ w: 411.428558, h: 804.285706 });
  });

  it('an inset that would leave no room is ignored rather than producing a <1 dp viewport', () => {
    expect(cameraViewport(360, 40, 56)).toEqual({ w: 360, h: 40 });
  });

  it.each(RAW.flatMap((r) => BOARDS.map((b) => [r.name, b.name, r, b] as const)))(
    '%s, %s: zoomed board centres on the visible area and its last row can rise above the inset',
    (_rn, _bn, r, b) => {
      const boardW = b.cols * CELL;
      const boardH = b.rows * CELL;
      const v = cameraViewport(r.w, r.h, r.inset);
      const cam = initialCamera(v.w, v.h, boardW, boardH, CELL, true)!;
      // Centre of the board lands on the centre of the visible area, not of the raw layout.
      expect(cam.ty + (boardH / 2) * cam.scale).toBeCloseTo(r.visibleH / 2, 6);
      // Fully zoomed out, the whole board fits the visible area.
      expect(boardH * cam.minScale).toBeLessThanOrEqual(r.visibleH);
      // Panned all the way up, the board's bottom edge sits at or above the inset.
      const [ylo] = panRange(boardH * cam.scale, v.h);
      expect(ylo + boardH * cam.scale).toBeLessThanOrEqual(r.visibleH + 1e-9);
    },
  );
});

import { ArrowPath, Direction } from '../../core';
import { slitherPath } from '../arrowGeometry';
import { exitTrailDurationMs } from '../exitAnimationConfig';
import {
  EXIT_EDGE_FADE_START,
  EXIT_EDGE_LAUNCH,
  EXIT_EDGE_MARGIN_FRACTION,
  EXIT_FADE_START_DEFAULT,
  exitExtent,
  exitFadeAt,
  exitTravelFraction,
  planExit,
  visibleBoardRect,
} from '../exitToScreenEdge';
import { serializeNativeExitAnimation } from '../nativeExitAnimation';

const CELL = 40;
// Right-pointing bent arrow, head (3,3): head centre (140,140), body 136.8.
const right = new ArrowPath(
  [{ r: 2, c: 1 }, { r: 2, c: 2 }, { r: 3, c: 2 }, { r: 3, c: 3 }],
  Direction.Right,
);
// Up-pointing straight arrow, head (3,4): head centre (180,140), body 96.8.
const up = new ArrowPath([{ r: 5, c: 4 }, { r: 4, c: 4 }, { r: 3, c: 4 }], Direction.Up);
const left = new ArrowPath([{ r: 10, c: 12 }, { r: 10, c: 11 }], Direction.Left);
const down = new ArrowPath([{ r: 12, c: 15 }, { r: 13, c: 15 }, { r: 14, c: 15 }], Direction.Down);

// A 20x20 board (800x800 board points) seen at half scale, slightly panned.
const camera = { tx: 10, ty: 20, scale: 0.5, viewportW: 400, viewportH: 800 };
const expectedDuration = (onScreen: number, s: number) =>
  Math.min(320, Math.max(180, Math.round(120 + 0.35 * onScreen * s)));

describe('owner-picked constants (R3, R3a, design spec B)', () => {
  it('uses the ruled fade start, launch and margin', () => {
    expect(EXIT_EDGE_FADE_START).toBe(0.85);
    expect(EXIT_EDGE_LAUNCH).toBe(0.35);
    expect(EXIT_EDGE_MARGIN_FRACTION).toBe(0.25);
    expect(EXIT_FADE_START_DEFAULT).toBe(0.55);
  });
});

describe('visibleBoardRect / exitExtent', () => {
  it('maps the viewport into board space', () => {
    expect(visibleBoardRect(camera)).toEqual({ minX: -20, minY: -40, maxX: 780, maxY: 1560 });
  });

  it('adds 0.25 x the viewport on each axis (in board units) as the pan margin', () => {
    // Mx = 0.25*400/0.5 = 200, My = 0.25*800/0.5 = 400.
    expect(exitExtent(camera)).toEqual({ minX: -220, minY: -440, maxX: 980, maxY: 1960 });
  });
});

describe('exitTravelFraction (R3a)', () => {
  it('launch 0 is exactly today\'s k^2 (flag OFF curve)', () => {
    for (let i = 0; i <= 100; i += 1) {
      const k = i / 100;
      expect(exitTravelFraction(k, 0)).toBe(k * k);
    }
  });

  it('launch 0.35 is 0.35k + 0.65k^2: moving on the tap frame, reaching 1 at k = 1', () => {
    expect(exitTravelFraction(0, 0.35)).toBe(0);
    expect(exitTravelFraction(1, 0.35)).toBeCloseTo(1, 12);
    expect(exitTravelFraction(0.5, 0.35)).toBeCloseTo(0.35 * 0.5 + 0.65 * 0.25, 12);
    // Initial speed 0.35x average, final speed 1.65x average.
    const h = 1e-6;
    expect(exitTravelFraction(h, 0.35) / h).toBeCloseTo(0.35, 4);
    expect((1 - exitTravelFraction(1 - h, 0.35)) / h).toBeCloseTo(1.65, 4);
  });
});

describe('exitFadeAt', () => {
  it('holds full opacity until the fade start, then smoothsteps to 0', () => {
    expect(exitFadeAt(0, 0.85)).toBe(1);
    expect(exitFadeAt(0.849, 0.85)).toBe(1);
    expect(exitFadeAt(0.925, 0.85)).toBeCloseTo(0.5, 10);
    expect(exitFadeAt(1, 0.85)).toBeCloseTo(0, 10);
    expect(exitFadeAt(0.54, 0.55)).toBe(1);
    expect(exitFadeAt(1, 0.55)).toBeCloseTo(0, 10);
  });
});

describe('planExit', () => {
  it('flag OFF: today\'s board-edge path and duration, no motion tokens', () => {
    const plan = planExit(right, CELL, 20, 20, camera, { toScreenEdge: false, reducedMotion: false });
    const today = slitherPath(right, CELL, 20, 20);
    expect(plan.path).toEqual(today);
    expect(plan.durationMs).toBe(exitTrailDurationMs(today.totalLen * camera.scale));
    expect(plan.motion).toBeNull();
  });

  it('flag ON + reduced motion: identical to flag OFF (stationary fade, board-edge path)', () => {
    const off = planExit(up, CELL, 20, 20, camera, { toScreenEdge: false, reducedMotion: true });
    const rm = planExit(up, CELL, 20, 20, camera, { toScreenEdge: true, reducedMotion: true });
    expect(rm).toEqual(off);
    const event = (p: typeof rm) => serializeNativeExitAnimation({
      id: 3, arrowIndex: 1, durationMs: p.durationMs, reducedMotion: true,
      path: p.path, trailStrokeWidth: 10.4, motion: p.motion,
    });
    expect(event(rm)).toBe(event(off));
  });

  it('flag ON: the ray ends body + one cell past the extended extent, with the ruled motion', () => {
    const plan = planExit(right, CELL, 20, 20, camera, { toScreenEdge: true, reducedMotion: false });
    const last = plan.path.points[plan.path.points.length - 1];
    expect(last.x).toBeCloseTo(980 + 136.8 + 40, 6);
    expect(last.y).toBe(140);
    expect(plan.motion).toEqual({ fadeStart: 0.85, launch: 0.35 });
  });

  it('flag ON: duration comes from the ON-SCREEN run (E + B) x scale, five fixed cases', () => {
    const tall = { tx: 10, ty: -100, scale: 0.8, viewportW: 400, viewportH: 900 };
    const cases: [ArrowPath, number, number, typeof camera][] = [
      // arrow, E = head centre -> VISIBLE edge (board units, no margin), B = body, camera
      [right, 780 - 140, 136.8, camera], // head (3,3) centre x 140; visible maxX 780
      [up, 140 - -40, 96.8, camera], // head (3,4) centre y 140; visible minY -40 -> clamps to 180
      [left, 460 - -20, 56.8, camera], // head (10,11) centre x 460; visible minX -20
      [down, 1250 - 580, 96.8, tall], // head (14,15) centre y 580; visible maxY 1250 -> clamps to 320
      [right, 1300 - 140, 136.8, { ...camera, scale: 0.3 }], // visible maxX (400-10)/0.3 = 1300
    ];
    const seen: number[] = [];
    for (const [arrow, e, b, cam] of cases) {
      const plan = planExit(arrow, CELL, 20, 20, cam, { toScreenEdge: true, reducedMotion: false });
      expect(plan.path.bodyLen).toBeCloseTo(b, 6);
      expect(plan.durationMs).toBe(expectedDuration(e + b, cam.scale));
      seen.push(plan.durationMs);
    }
    expect(seen).toEqual([256, 180, 214, 320, 256]);
  });

  it('flag ON: a head already past the visible edge gets E = 0 and still clears the extent', () => {
    // Visible x range is 500..900 at scale 1; the left-pointing head centre (x 460) is off-screen.
    const cam = { tx: -500, ty: 20, scale: 1, viewportW: 400, viewportH: 800 };
    const plan = planExit(left, CELL, 20, 20, cam, { toScreenEdge: true, reducedMotion: false });
    expect(plan.durationMs).toBe(expectedDuration(0 + 56.8, 1));
    const last = plan.path.points[plan.path.points.length - 1];
    // Extent minX = 500 - 0.25*400 = 400: toEdge = 60, ray = 60 + body 56.8 + one cell.
    expect(last.x).toBeCloseTo(460 - (60 + 56.8 + 40), 6);
  });

  it('falls back to today before the first layout (scale 0 or empty viewport)', () => {
    for (const cam of [
      { ...camera, scale: 0 },
      { ...camera, viewportW: 0 },
      { ...camera, viewportH: 0 },
    ]) {
      const plan = planExit(right, CELL, 20, 20, cam, { toScreenEdge: true, reducedMotion: false });
      expect(plan.path).toEqual(slitherPath(right, CELL, 20, 20));
      expect(plan.motion).toBeNull();
    }
  });
});

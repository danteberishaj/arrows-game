import { createHash } from 'node:crypto';
import { LevelGenerator } from '../../core';
import { headDistanceToRectEdge, slitherPath } from '../arrowGeometry';
import { cameraViewport, initialCamera } from '../boardCamera';
import { EXIT_TRAIL_STROKE_CELLS } from '../exitAnimationConfig';
import {
  EXIT_EDGE_FADE_START,
  exitExtent,
  exitTravelFraction,
  planExit,
  visibleBoardRect,
} from '../exitToScreenEdge';
import { serializeNativeExitAnimation } from '../nativeExitAnimation';

/**
 * POLISH-T10: with META_EXIT_TO_SCREEN_EDGE the exit launches (ease-out) instead of accelerating (ease-in), keeps
 * its speed while any of it is on screen, and leaves by motion. Checked on every arrow of level 1 at the zoomed
 * opening camera (the Android emulator's layout: 411.43 x 804.29 pt, 48 pt bottom inset), the board the owner
 * judges on. Emulator measurements of the same exits: docs/next-level/reports/POLISH-T10.md.
 */
const CELL = 40;
const FRAME_MS = 1000 / 60;
const W = 411.4285583496094;
const H = 804.2857055664062;
const board = LevelGenerator.generate(0).board;
const opening = initialCamera(
  cameraViewport(W, H, 48).w, cameraViewport(W, H, 48).h, board.cols * CELL, board.rows * CELL, CELL, true,
)!;
const camera = { tx: opening.tx, ty: opening.ty, scale: opening.scale, viewportW: W, viewportH: H };
const arrows = board.arrows();
const ON = { toScreenEdge: true, reducedMotion: false };
// Fix round 1: the whole ray (production truncates at the extent; see exitTruncation.test.ts).
const FULL = { toScreenEdge: true, reducedMotion: false, truncate: false };

/** Clock k at which the travel fraction reaches `fraction` (the curve is increasing on [0, 1]). */
function clockAt(fraction: number, launch: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (exitTravelFraction(mid, launch) < fraction) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const speedAt = (k: number, launch: number) => {
  const h = 1e-6;
  return (exitTravelFraction(Math.min(1, k + h), launch) - exitTravelFraction(Math.max(0, k - h), launch))
    / (Math.min(1, k + h) - Math.max(0, k - h));
};
/** Travel (board points) at which the trail's round tail cap has left the visible viewport. */
const onScreenRun = (index: number) =>
  Math.max(0, headDistanceToRectEdge(arrows[index], CELL, visibleBoardRect(camera)))
  + slitherPath(arrows[index], CELL, board.rows, board.cols).bodyLen
  + (EXIT_TRAIL_STROKE_CELLS * CELL) / 2;

describe('POLISH-T10 launch curve (flag ON), every level-1 exit at the opening camera', () => {
  const plans = arrows.map((arrow) => planExit(arrow, CELL, board.rows, board.cols, camera, ON));

  it('is an ease-out: launch in (1, 2], so the first speed is above average and the speed never rises', () => {
    for (const plan of plans) {
      const launch = plan.motion!.launch;
      expect(launch).toBeGreaterThan(1);
      expect(launch).toBeLessThanOrEqual(2);
      expect(exitTravelFraction(0, launch)).toBe(0);
      expect(exitTravelFraction(1, launch)).toBeCloseTo(1, 12);
      for (let i = 1; i <= 100; i += 1) {
        expect(speedAt(i / 100, launch)).toBeLessThanOrEqual(speedAt((i - 1) / 100, launch) + 1e-9);
      }
    }
  });

  it('is fastest at launch and keeps >= 85% of that speed until the last pixel has left the screen', () => {
    plans.forEach((plan, i) => {
      const launch = plan.motion!.launch;
      const kOn = clockAt(onScreenRun(i) / plan.path.totalLen, launch);
      const speeds = Array.from({ length: 51 }, (_, j) => speedAt((kOn * j) / 50, launch));
      const peak = Math.max(...speeds);
      // The fastest on-screen speed is the launch itself; the slow-down happens off screen.
      expect(speeds[0]).toBe(peak);
      expect(Math.min(...speeds) / peak).toBeGreaterThanOrEqual(0.85);
    });
  });

  it('spends 88-185 ms of clock on the visible run, whatever the distance (none rockets, none crawls)', () => {
    plans.forEach((plan, i) => {
      const kOn = clockAt(onScreenRun(i) / plan.path.totalLen, plan.motion!.launch);
      const visibleMs = kOn * plan.durationMs;
      expect(visibleMs).toBeGreaterThanOrEqual(88 - 1);
      expect(visibleMs).toBeLessThanOrEqual(185 + 1);
    });
  });

  it('moves the head >= 0.4 cell on the first drawn frame (one 60 Hz frame of clock)', () => {
    for (const plan of plans) {
      const travelled = exitTravelFraction(FRAME_MS / plan.durationMs, plan.motion!.launch) * plan.path.totalLen;
      expect(travelled / CELL).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('stays fully opaque while any of it is on screen (fade starts after the last pixel left)', () => {
    plans.forEach((plan, i) => {
      const kOn = clockAt(onScreenRun(i) / plan.path.totalLen, plan.motion!.launch);
      expect(plan.motion!.fadeStart).toBeGreaterThan(kOn);
    });
    // The whole-ray plan keeps R3's 0.85, also after the last pixel left.
    arrows.forEach((arrow, i) => {
      const full = planExit(arrow, CELL, board.rows, board.cols, camera, FULL);
      expect(full.motion!.fadeStart).toBe(EXIT_EDGE_FADE_START);
      expect(EXIT_EDGE_FADE_START).toBeGreaterThan(clockAt(onScreenRun(i) / full.path.totalLen, full.motion!.launch));
    });
  });

  it('the whole-ray plan still ends at least body + one cell past the pan-margin extent, inside the native bounds', () => {
    arrows.map((arrow) => planExit(arrow, CELL, board.rows, board.cols, camera, FULL)).forEach((plan, i) => {
      const minimum = slitherPath(arrows[i], CELL, board.rows, board.cols, exitExtent(camera));
      expect(plan.path.totalLen).toBeGreaterThanOrEqual(minimum.totalLen - 1e-9);
      expect(plan.path.points.slice(0, -1)).toEqual(minimum.points.slice(0, -1));
      expect(plan.durationMs).toBeGreaterThanOrEqual(180);
      expect(plan.durationMs).toBeLessThanOrEqual(1000);
    });
  });

  it('Kotlin draws the same curve: its Float arithmetic matches the TS expression to 1e-6', () => {
    // ArrowsBoardView.kt: (launch * progress + (1f - launch) * progress * progress) * totalLength, all Float.
    const f = Math.fround;
    for (const plan of plans.slice(0, 5)) {
      // The launch the native view parses is the payload token (2 decimals) after the n points' 10 + 2n tokens.
      const tokens = serializeNativeExitAnimation({
        id: 1, arrowIndex: 0, durationMs: plan.durationMs, reducedMotion: false, path: plan.path,
        trailStrokeWidth: 10.4, motion: plan.motion,
      }).split(',');
      const token = Number(tokens[11 + 2 * Number(tokens[9])]);
      expect(token).toBe(plan.motion!.launch);
      const launch = f(token);
      for (let i = 0; i <= 1000; i += 1) {
        const p = f(i / 1000);
        const kotlin = f(f(f(launch * p) + f(f(f(f(1) - launch) * p) * p)));
        expect(Math.abs(kotlin - exitTravelFraction(i / 1000, token))).toBeLessThan(1e-6);
      }
    }
  });
});

describe('POLISH-T10: flag OFF and reduced motion stay byte-identical to BASE d47abf3', () => {
  // sha256 of the 60 level-1 payloads joined by '\n' (ids 1..60), computed from the d47abf3 sources
  // (artifacts/POLISH-T10/scripts/golden-src.ts run in a `git archive d47abf3` copy).
  const BASE = {
    off: '39e04649701985a09749c4ba982eff844357600fb8dfd134cae7f257ee0bca56',
    rm: '45019113a93c1072a8e6911696cef5ea978c682a29ecd89147540392d9729ddd',
  };
  const payloads = (options: { toScreenEdge: boolean; reducedMotion: boolean }) => arrows.map((arrow, i) => {
    const plan = planExit(arrow, CELL, board.rows, board.cols, camera, options);
    return serializeNativeExitAnimation({
      id: i + 1, arrowIndex: i, durationMs: plan.durationMs, reducedMotion: options.reducedMotion,
      path: plan.path, trailStrokeWidth: 0.26 * CELL, motion: plan.motion,
    });
  });
  const sha = (lines: string[]) => createHash('sha256').update(lines.join('\n')).digest('hex');

  it('flag OFF', () => {
    const off = payloads({ toScreenEdge: false, reducedMotion: false });
    expect(off[24]).toBe('25,24,216,0,10.4,136.8,373.6,0,-1,7,556.8,140,540,140,500,140,500,100,500,60,500,60,500,-176.8');
    expect(sha(off)).toBe(BASE.off);
  });

  it('reduced motion, flag OFF and flag ON', () => {
    const on = payloads({ toScreenEdge: true, reducedMotion: true });
    expect(on[24]).toBe('25,24,216,1,10.4,136.8,373.6,0,-1,7,556.8,140,540,140,500,140,500,100,500,60,500,60,500,-176.8');
    expect(sha(on)).toBe(BASE.rm);
    expect(sha(payloads({ toScreenEdge: false, reducedMotion: true }))).toBe(BASE.rm);
  });
});

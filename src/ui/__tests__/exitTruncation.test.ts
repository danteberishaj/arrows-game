import { LevelGenerator } from '../../core';
import { headDistanceToRectEdge, slitherPath } from '../arrowGeometry';
import { cameraViewport, initialCamera } from '../boardCamera';
import { EXIT_TRAIL_STROKE_CELLS } from '../exitAnimationConfig';
import { exitExtent, exitTravelFraction, planExit, visibleBoardRect } from '../exitToScreenEdge';
import { serializeNativeExitAnimation } from '../nativeExitAnimation';

/**
 * POLISH-T10 fix round 1: a flag-ON exit ends when the whole arrow is past the extent (visible screen + pan margin)
 * instead of running the slowing tail to the end of its lengthened ray; on screen it draws the same travel at the
 * same time. Every level-1 arrow at the zoomed opening camera (the emulator's 411.43 x 804.29 pt layout).
 */
const CELL = 40;
const W = 411.4285583496094;
const H = 804.2857055664062;
const board = LevelGenerator.generate(0).board;
const v = cameraViewport(W, H, 48);
const opening = initialCamera(v.w, v.h, board.cols * CELL, board.rows * CELL, CELL, true)!;
const camera = { tx: opening.tx, ty: opening.ty, scale: opening.scale, viewportW: W, viewportH: H };
const arrows = board.arrows();
const ON = { toScreenEdge: true, reducedMotion: false };
const FULL = { toScreenEdge: true, reducedMotion: false, truncate: false };
const cap = (EXIT_TRAIL_STROKE_CELLS * CELL) / 2;
const aa = 2 / camera.scale;
const bodyLen = (i: number) => slitherPath(arrows[i], CELL, board.rows, board.cols).bodyLen;
const pastExtent = (i: number) =>
  Math.max(0, headDistanceToRectEdge(arrows[i], CELL, exitExtent(camera))) + bodyLen(i) + cap + aa;
const offScreen = (i: number) =>
  Math.max(0, headDistanceToRectEdge(arrows[i], CELL, visibleBoardRect(camera))) + bodyLen(i) + cap + aa;

const payload = (plan: ReturnType<typeof planExit>, i: number) => serializeNativeExitAnimation({
  id: i + 1, arrowIndex: i, durationMs: plan.durationMs, reducedMotion: false, path: plan.path,
  trailStrokeWidth: EXIT_TRAIL_STROKE_CELLS * CELL, motion: plan.motion,
});

describe('POLISH-T10 fix round 1: the exit ends once the whole arrow is past the extent', () => {
  const full = arrows.map((arrow) => planExit(arrow, CELL, board.rows, board.cols, camera, FULL));
  const cut = arrows.map((arrow) => planExit(arrow, CELL, board.rows, board.cols, camera, ON));
  const travelAt = (plan: ReturnType<typeof planExit>, ms: number) =>
    exitTravelFraction(ms / plan.durationMs, plan.motion!.launch) * plan.path.totalLen;

  it('stops at the first ms at which the tail cap and its edge are past the extent, and never before', () => {
    cut.forEach((plan, i) => {
      const endMs = plan.motion!.endMs!;
      expect(Number.isInteger(endMs)).toBe(true);
      expect(endMs).toBeLessThan(plan.durationMs);
      expect(travelAt(plan, endMs)).toBeGreaterThanOrEqual(pastExtent(i) - 1e-9);
      expect(travelAt(plan, endMs - 1)).toBeLessThan(pastExtent(i));
    });
  });

  it('is the whole-ray exit plus an end: same path, duration, curve and fade, so every frame before it is the same', () => {
    cut.forEach((plan, i) => {
      expect(plan.path).toEqual(full[i].path);
      expect(plan.durationMs).toBe(full[i].durationMs);
      expect(plan.motion).toEqual({ ...full[i].motion, endMs: plan.motion!.endMs });
      expect(payload(plan, i)).toBe(`${payload(full[i], i)},${plan.motion!.endMs}`);
    });
  });

  it('stops only after the last pixel left the screen (the stop itself is never on screen)', () => {
    cut.forEach((plan, i) => {
      expect(travelAt(plan, plan.motion!.endMs!)).toBeGreaterThan(offScreen(i));
    });
  });

  it('flag OFF and reduced motion never carry the end token', () => {
    for (const options of [{ toScreenEdge: false, reducedMotion: false }, { toScreenEdge: true, reducedMotion: true }]) {
      arrows.forEach((arrow) => expect(planExit(arrow, CELL, board.rows, board.cols, camera, options).motion).toBeNull());
    }
  });
});

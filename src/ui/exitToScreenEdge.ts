import type { ArrowPath } from '../core';
import {
  headDistanceToRectEdge,
  slitherPath,
  type BoardRect,
  type SlitherPath,
} from './arrowGeometry';
import { exitTrailDurationMs } from './exitAnimationConfig';
import type { ExitMotion } from './nativeExitAnimation';

/**
 * POLISH-T3 (rulings R3 + R3a, design spec B): with META_EXIT_TO_SCREEN_EDGE
 * on, a removed arrow's slither runs past the board edge until it is beyond
 * the visible screen edge, stays solid until k = 0.85 and launches with speed.
 * Flag OFF, and reduced motion in either state, keep today's exit exactly.
 */

/** Today's fade start (every renderer's default). */
export const EXIT_FADE_START_DEFAULT = 0.55;
/** R3: the dash stays fully visible until 85% of the extended run. */
export const EXIT_EDGE_FADE_START = 0.85; // OWNER-PICKED STARTING VALUE
/** R3a: travel = 0.35k + 0.65k^2, so the dash is moving on the tap frame. */
export const EXIT_EDGE_LAUNCH = 0.35; // OWNER-PICKED STARTING VALUE
/** Design spec B: the extent reaches this fraction of the viewport past each
 * visible edge, so a pan that starts during the <= 320 ms exit cannot cut it. */
export const EXIT_EDGE_MARGIN_FRACTION = 0.25; // OWNER-PICKED STARTING VALUE

/** The board camera at the moment of the tap (screen = board * scale + t). */
export interface ExitCamera {
  tx: number;
  ty: number;
  scale: number;
  /** The area the board view draws into, in screen points. */
  viewportW: number;
  viewportH: number;
}

/** The viewport rectangle in board points. */
export function visibleBoardRect(camera: ExitCamera): BoardRect {
  const { tx, ty, scale, viewportW, viewportH } = camera;
  return {
    minX: -tx / scale,
    minY: -ty / scale,
    maxX: (viewportW - tx) / scale,
    maxY: (viewportH - ty) / scale,
  };
}

/** The visible rectangle grown by the pan margin on each axis (board points). */
export function exitExtent(camera: ExitCamera): BoardRect {
  const visible = visibleBoardRect(camera);
  const mx = (EXIT_EDGE_MARGIN_FRACTION * camera.viewportW) / camera.scale;
  const my = (EXIT_EDGE_MARGIN_FRACTION * camera.viewportH) / camera.scale;
  return {
    minX: visible.minX - mx,
    minY: visible.minY - my,
    maxX: visible.maxX + mx,
    maxY: visible.maxY + my,
  };
}

/** Fraction of the path travelled at clock k: launch*k + (1-launch)*k^2
 * (launch 0 = today's k^2 exactly). Same expression in ArrowsBoardView.kt. */
export function exitTravelFraction(k: number, launch: number): number {
  'worklet';
  return launch * k + (1 - launch) * k * k;
}

/** Opacity at clock k: 1 until fadeStart, then a smoothstep to 0. */
export function exitFadeAt(k: number, fadeStart: number): number {
  'worklet';
  if (k < fadeStart) return 1;
  const f = (k - fadeStart) / (1 - fadeStart);
  return 1 - f * f * (3 - 2 * f);
}

export interface PlannedExit {
  path: SlitherPath;
  durationMs: number;
  /** null = today's fade/curve and the pre-T3 native payload. */
  motion: ExitMotion | null;
}

/**
 * Path, duration and motion for one slither exit.
 * - Flag OFF, reduced motion, or no layout yet: today's board-edge path and
 *   `exitTrailDurationMs(totalLen * scale)`, no motion tokens.
 * - Flag ON: the ray ends body + one cell past the extent (visible screen +
 *   margin); the duration comes from the ON-SCREEN run only, head -> visible
 *   edge (E) plus the body (B), times scale, inside the same 180-320 ms band
 *   (pinned in PERF builds by exitTrailDurationMs).
 */
export function planExit(
  arrow: ArrowPath,
  cell: number,
  rows: number,
  cols: number,
  camera: ExitCamera,
  options: { toScreenEdge: boolean; reducedMotion: boolean },
): PlannedExit {
  const hasLayout = camera.scale > 0 && camera.viewportW >= 1 && camera.viewportH >= 1;
  if (!options.toScreenEdge || options.reducedMotion || !hasLayout) {
    const path = slitherPath(arrow, cell, rows, cols);
    return { path, durationMs: exitTrailDurationMs(path.totalLen * camera.scale), motion: null };
  }
  const path = slitherPath(arrow, cell, rows, cols, exitExtent(camera));
  const onScreen = Math.max(0, headDistanceToRectEdge(arrow, cell, visibleBoardRect(camera)));
  return {
    path,
    durationMs: exitTrailDurationMs((onScreen + path.bodyLen) * camera.scale),
    motion: { fadeStart: EXIT_EDGE_FADE_START, launch: EXIT_EDGE_LAUNCH },
  };
}

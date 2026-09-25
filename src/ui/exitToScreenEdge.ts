import type { ArrowPath } from '../core';
import {
  headDistanceToRectEdge,
  slitherPath,
  type BoardRect,
  type SlitherPath,
} from './arrowGeometry';
import {
  EXIT_TRAIL_DURATION_IS_PINNED,
  EXIT_TRAIL_STROKE_CELLS,
  exitLaunchDurationMs,
  exitOnScreenMs,
  exitTrailDurationMs,
} from './exitAnimationConfig';
import type { ExitMotion } from './nativeExitAnimation';

/**
 * POLISH-T3 (rulings R3 + R3a, design spec B): with META_EXIT_TO_SCREEN_EDGE
 * on, a removed arrow's slither runs past the board edge until it is beyond
 * the visible screen edge and stays solid until k = 0.85.
 * POLISH-T10 (owner request 2026-09-24): it LAUNCHES. The travel curve is an
 * ease-out (fastest on the first frame), and the ray is long enough that its
 * slow-down happens off screen: while any pixel is visible the arrow keeps
 * >= 85% of its launch speed, then it leaves by motion, never by dissolving.
 * Flag OFF, and reduced motion in either state, keep today's exit exactly.
 */

/** Today's fade start (every renderer's default). */
export const EXIT_FADE_START_DEFAULT = 0.55;
/** R3: the dash stays fully visible until 85% of the extended run. */
export const EXIT_EDGE_FADE_START = 0.85; // OWNER-PICKED STARTING VALUE
/**
 * POLISH-T10: travel = launch*k + (1-launch)*k^2 with launch 1.15: it starts at
 * 1.15x its average speed and eases to 0.85x at the far end (the R3a ease-in
 * was launch 0.35: 0.35x at the tap, 1.65x at the end). The same one expression in ArrowsBoardView.kt, the web
 * ExitTrail and, as the Bezier (1/3, L/3, 2/3, (1+L)/3), ArrowsBoardView.swift.
 * Picked with artifacts/POLISH-T10/scripts/sim2.py.
 */
export const EXIT_EDGE_LAUNCH = 1.15; // OWNER-PICKED STARTING VALUE
/**
 * POLISH-T10: the visible run (head -> screen edge, plus the body, plus the
 * tail cap) is at most this share of the travel; a longer run gets a longer
 * ray, so the speed when the last pixel leaves is still >= 85% of the launch
 * speed (1 - 2 x 0.15 x k / 1.15 = 0.853 at k = 0.563, the clock of a 60% share).
 */
export const EXIT_EDGE_ONSCREEN_MAX = 0.6; // OWNER-PICKED STARTING VALUE
/** Design spec B: the extent reaches this fraction of the viewport past each
 * visible edge, so a pan that starts during the exit cannot cut it. */
export const EXIT_EDGE_MARGIN_FRACTION = 0.25; // OWNER-PICKED STARTING VALUE
/**
 * POLISH-T10 fix round 1: the anti-aliased edge the trail keeps past its round
 * cap, in screen points, when deciding that the whole arrow is past an edge.
 */
export const EXIT_EDGE_AA_PT = 2; // OWNER-PICKED STARTING VALUE

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
 * (launch 0 = today's k^2 exactly; launch in (1, 2] = an ease-out whose speed
 * falls from launch to 2 - launch times the average). Same expression in
 * ArrowsBoardView.kt. */
export function exitTravelFraction(k: number, launch: number): number {
  'worklet';
  return launch * k + (1 - launch) * k * k;
}

/** The clock k in [0, 1] at which exitTravelFraction reaches `fraction` (the
 * inverse on the increasing branch; launch in [0, 2]). */
export function exitClockAt(fraction: number, launch: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  const a = 1 - launch;
  if (Math.abs(a) < 1e-12) return f;
  // a k^2 + launch k - f = 0; the root in [0, 1] (the discriminant is >= 0 for launch <= 2).
  const k = (-launch + Math.sqrt(Math.max(0, launch * launch + 4 * a * f))) / (2 * a);
  return Math.min(1, Math.max(0, k));
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
 * - Flag ON (POLISH-T10): the ray ends body + one cell past the extent
 *   (visible screen + pan margin), lengthened if needed so the visible run R
 *   (head -> visible edge, + body, + the tail's round cap) is at most
 *   EXIT_EDGE_ONSCREEN_MAX of the travel. The duration puts the moment the
 *   last pixel leaves at `exitOnScreenMs(R x scale)` on the launch curve.
 * - Fix round 1: the exit then ENDS when the whole arrow (tail cap + its
 *   anti-aliased edge) is past the extent, not at the end of that ray; see
 *   endAtExtent. Every frame before that is the whole-ray exit's frame.
 */
export function planExit(
  arrow: ArrowPath,
  cell: number,
  rows: number,
  cols: number,
  camera: ExitCamera,
  options: {
    toScreenEdge: boolean;
    reducedMotion: boolean;
    /** Fix round 1: false keeps the whole ray (tests compare the two; production never passes it). */
    truncate?: boolean;
  },
): PlannedExit {
  const hasLayout = camera.scale > 0 && camera.viewportW >= 1 && camera.viewportH >= 1;
  if (!options.toScreenEdge || options.reducedMotion || !hasLayout) {
    const path = slitherPath(arrow, cell, rows, cols);
    return { path, durationMs: exitTrailDurationMs(path.totalLen * camera.scale), motion: null };
  }
  const extent = exitExtent(camera);
  let path = slitherPath(arrow, cell, rows, cols, extent);
  const cap = (EXIT_TRAIL_STROKE_CELLS * cell) / 2;
  const onScreen = Math.max(0, headDistanceToRectEdge(arrow, cell, visibleBoardRect(camera)));
  const run = onScreen + path.bodyLen + cap;
  const minTravel = run / EXIT_EDGE_ONSCREEN_MAX;
  if (path.totalLen < minTravel) {
    path = slitherPath(arrow, cell, rows, cols, extent, minTravel - path.totalLen);
  }
  const onScreenClock = exitClockAt(run / path.totalLen, EXIT_EDGE_LAUNCH);
  const durationMs = exitLaunchDurationMs(exitOnScreenMs(run * camera.scale), onScreenClock);
  const full: PlannedExit = {
    path,
    durationMs,
    motion: { fadeStart: EXIT_EDGE_FADE_START, launch: EXIT_EDGE_LAUNCH },
  };
  if (EXIT_TRAIL_DURATION_IS_PINNED || options.truncate === false) return full;
  const aa = EXIT_EDGE_AA_PT / camera.scale;
  const pastExtent = Math.max(0, headDistanceToRectEdge(arrow, cell, extent)) + path.bodyLen + cap + aa;
  const motion = endAtExtent(full, pastExtent);
  return motion === null ? full : { ...full, motion };
}

/**
 * POLISH-T10 fix round 1: once the whole arrow (tail cap + its anti-aliased
 * edge) is past the extent (screen + pan margin), the rest of the eased-out
 * ray is invisible work, so the exit stops there. Path, duration, curve and
 * fade stay exactly the whole-ray exit's, so every frame up to the stop is the
 * same frame; only `endMs` (the clock at which the renderer stops) is added.
 * The Android view stops there only if the camera has not moved since the
 * exit started (ArrowsBoardView.kt): a pan or zoom during the exit can bring
 * the margin on screen, and then the exit runs its whole ray, as before.
 * Returns null when there is nothing to cut.
 */
export function endAtExtent(full: PlannedExit, pastExtentTravel: number): ExitMotion | null {
  const motion = full.motion;
  if (motion === null) return null;
  const endMs = Math.ceil(exitClockAt(pastExtentTravel / full.path.totalLen, motion.launch) * full.durationMs);
  if (endMs >= full.durationMs) return null;
  return { ...motion, endMs };
}

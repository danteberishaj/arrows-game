/**
 * Pure camera maths for BoardView's pan/zoom viewport: the fit, the default
 * (opening) camera and the pan bounds. Kept free of React / Reanimated state so
 * it can be unit-tested (src/ui/__tests__/boardCamera.test.ts). `panRange` is a
 * worklet because the gesture callbacks call it on the UI thread.
 */

// Pan/zoom feel, ported from BoardPanZoom.cs and then tuned for thumbs.
export const MAX_ZOOM_FACTOR = 3.5; // max zoom in, relative to fit-to-view ...
/** ... but never less than this many screen points per cell: a 46-cell board
 * at 3.5x fit was still only 29 pt per cell, under every touch-target guide. */
export const MAX_ZOOM_CELL_PT = 64;
export const FIT_MARGIN = 0.94; // small border when fully zoomed out
/**
 * Once zoomed past the viewport the board can be pulled this far inward, so
 * an arrow on the board's edge can sit under the thumb instead of against
 * the bezel. Fully zoomed out the board stays centred.
 */
export const EDGE_PAD_PT = 72;

/**
 * META_ZOOMED_CAMERA (board polish R1): a level opens zoomed so about this many
 * cells span the viewport width.
 */
// OWNER-PICKED STARTING VALUE: measured from the competitor reference screenshot
// (65 px dot pitch / 923 px width = 14.2 cells across), ruling R1 in
// .superpowers/sdd/TASKS/grid-camera-exit-rulings.md.
export const TARGET_CELLS_ACROSS = 14;
/**
 * R1a: a board whose fit cell is already at least this many screen points opens
 * at fit, so a near-fit board is not zoomed by < 1.25x just to hide 1-2 edge
 * columns.
 */
// OWNER-PICKED STARTING VALUE: 0.8 x the 29.4 dp R1 target on a 411 dp phone
// (design-spec-grid-exit-mark.md section D, refinement 1; accepted as R1a).
export const ZOOM_SKIP_FIT_CELL_PT = 23.5;

export interface BoardCamera {
  /** Opening zoom (screen points per board unit). */
  scale: number;
  /** Full pinch-out: the whole board fits. */
  minScale: number;
  maxScale: number;
  /** Opening translation of the board's top-left corner, in screen points. */
  tx: number;
  ty: number;
}

/** Pan range along one axis for content of `size` in a `viewport`. */
export function panRange(size: number, viewport: number): [number, number] {
  'worklet';
  if (size <= viewport) {
    const centred = (viewport - size) / 2;
    return [centred, centred];
  }
  const pad = Math.min(EDGE_PAD_PT, viewport * 0.25);
  return [viewport - size - pad, pad];
}

/**
 * The camera a level opens with in a `vw` x `vh` viewport, for a board of
 * `boardW` x `boardH` board units with `cell` units per grid cell. Null until
 * the viewport has a size.
 *
 * - `zoomed` false: fit the whole board, centred (the pre-flag behaviour,
 *   same arithmetic).
 * - `zoomed` true (META_ZOOMED_CAMERA): about TARGET_CELLS_ACROSS cells across
 *   the viewport width, never below fit or above maxScale, centred on the board
 *   centre and clamped with `panRange`. Boards whose fit cell is already at
 *   least ZOOM_SKIP_FIT_CELL_PT open at fit. minScale / maxScale are the same
 *   either way, so a pinch-out still shows the whole board.
 */
export function initialCamera(
  vw: number,
  vh: number,
  boardW: number,
  boardH: number,
  cell: number,
  zoomed: boolean,
): BoardCamera | null {
  if (vw < 1 || vh < 1) return null;
  // Fully zoomed out shows the whole board / shape; the player pinches in.
  const fit = Math.min(vw / boardW, vh / boardH) * FIT_MARGIN;
  const maxScale = Math.max(fit * MAX_ZOOM_FACTOR, MAX_ZOOM_CELL_PT / cell);
  if (!zoomed || fit * cell >= ZOOM_SKIP_FIT_CELL_PT) {
    return {
      scale: fit,
      minScale: fit,
      maxScale,
      tx: (vw - boardW * fit) / 2,
      ty: (vh - boardH * fit) / 2,
    };
  }
  const target = vw / TARGET_CELLS_ACROSS / cell;
  const scale = Math.min(maxScale, Math.max(fit, target));
  const [xlo, xhi] = panRange(boardW * scale, vw);
  const [ylo, yhi] = panRange(boardH * scale, vh);
  return {
    scale,
    minScale: fit,
    maxScale,
    tx: Math.min(xhi, Math.max(xlo, (vw - boardW * scale) / 2)),
    ty: Math.min(yhi, Math.max(ylo, (vh - boardH * scale) / 2)),
  };
}

/**
 * The translation that puts board point (cx, cy) at the viewport centre at
 * zoom `s`, clamped with `panRange` (the hint recentre, BoardPanZoom.FocusOn).
 */
export function centreOn(
  cx: number,
  cy: number,
  s: number,
  vw: number,
  vh: number,
  boardW: number,
  boardH: number,
): { tx: number; ty: number } {
  const [xlo, xhi] = panRange(boardW * s, vw);
  const [ylo, yhi] = panRange(boardH * s, vh);
  return {
    tx: Math.min(xhi, Math.max(xlo, vw / 2 - cx * s)),
    ty: Math.min(yhi, Math.max(ylo, vh / 2 - cy * s)),
  };
}

/**
 * The area the camera fits, centres and clamps against, from the board view's
 * raw layout. Android draws edge to edge, so the raw layout runs under the
 * system navigation bar; `bottomInset` (the bottom safe-area inset) takes that
 * strip off, and the board keeps drawing under it. BoardView passes 0 while
 * META_ZOOMED_CAMERA is off, which keeps today's raw-layout camera. An inset
 * that would leave less than 1 pt is ignored.
 */
export function cameraViewport(
  layoutW: number,
  layoutH: number,
  bottomInset: number,
): { w: number; h: number } {
  const visibleH = layoutH - Math.max(0, bottomInset);
  return { w: layoutW, h: visibleH >= 1 ? visibleH : layoutH };
}

/** CAMERA-REFIT-AFTER-AD: the camera's pose: its zoom and the board's top-left translation (screen points). */
export interface CameraPose {
  scale: number;
  tx: number;
  ty: number;
}

/** A camera viewport's size (dp). */
export interface ViewportSize {
  w: number;
  h: number;
}

/**
 * The camera the player had at a viewport the layout moved away from, kept until the viewport comes back to that
 * size. `hintId` is the hint on screen when it was held.
 */
export interface HeldCamera {
  viewport: ViewportSize;
  pose: CameraPose;
  hintId: number | null;
}

/**
 * Two viewport sizes closer than this (dp, per axis) are the same viewport. The ad's round trip measured the exact
 * same floats before and after (411.4285583496094 x 804.2857055664062, artifacts/W2-07/perf/invalid/A2-logcat.txt)
 * and the smallest real change it produced was 24 dp, so any value between 0 and 24 separates them.
 */
export const SAME_VIEWPORT_DP = 0.5; // OWNER-PICKED STARTING VALUE

export type ViewportCameraStep =
  | { action: 'keep'; held: HeldCamera | null; recentreHint: false }
  | { action: 'refit'; held: HeldCamera | null; recentreHint: false }
  | { action: 'restore'; held: null; pose: CameraPose; recentreHint: boolean };

const sameViewport = (a: ViewportSize, b: ViewportSize): boolean =>
  Math.abs(a.w - b.w) < SAME_VIEWPORT_DP && Math.abs(a.h - b.h) < SAME_VIEWPORT_DP;
const hasSize = (v: ViewportSize): boolean => v.w >= 1 && v.h >= 1;

/**
 * CAMERA-REFIT-AFTER-AD: what a change of the camera viewport does to the camera, on the SAME board (a new board
 * always re-fits; BoardView does that without asking). A rewarded ad re-lays out the game screen (the viewport grows
 * while the ad is up and comes back when it closes), and a re-fit on every layout threw away the player's pan / zoom.
 * - The same size as the camera's viewport: `keep` (a layout event that changed nothing).
 * - The size of the held camera's viewport: `restore` the camera the player had there (the round trip is over). If a
 *   hint arrived while it was held (the hint ad's reward), `recentreHint` asks for the hint to be centred again at the
 *   restored zoom, since the hint centred itself on the interim viewport.
 * - Any other size: a real change, `refit` to the opening camera, and hold the camera being left (unless one is already
 *   held: the camera of the viewport the player last had is the one to come back to). Nothing is held before the
 *   first fit.
 */
export function cameraOnViewportChange(input: {
  /** The viewport the current pose belongs to ({0, 0} before the first fit). */
  from: ViewportSize;
  to: ViewportSize;
  pose: CameraPose;
  held: HeldCamera | null;
  /** The hint on screen now, if any. */
  hintId: number | null;
}): ViewportCameraStep {
  const { from, to, pose, held, hintId } = input;
  if (hasSize(from) && sameViewport(from, to)) return { action: 'keep', held, recentreHint: false };
  if (held !== null && sameViewport(held.viewport, to)) {
    return { action: 'restore', held: null, pose: held.pose, recentreHint: hintId !== null && hintId !== held.hintId };
  }
  return {
    action: 'refit',
    held: held ?? (hasSize(from) ? { viewport: from, pose, hintId } : null),
    recentreHint: false,
  };
}

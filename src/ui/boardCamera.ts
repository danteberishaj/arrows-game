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

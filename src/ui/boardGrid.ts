import { cameraViewport, EDGE_PAD_PT, initialCamera, panRange } from './boardCamera';
import { composite } from './contrastAudit';
import type { Palette } from './theme';

/**
 * POLISH-T4 (rulings R2, R4/R4a, R5, R7; design-spec-grid-exit-mark.md section A):
 * META_BOARD_GRID draws faint dots at every cell centre, and optional row/column
 * lines through the cell centres (the "#" toggle), under the arrows, across
 * everything the camera can show. Pure maths and payloads only, so the core
 * (node) jest project tests it: src/ui/__tests__/boardGrid.test.ts.
 *
 * Android records the grid once into the retained native board view's display
 * list (ArrowsBoardView.kt), which pan and zoom only replay, so the grid must
 * cover a board-space EXTENT that bounds every camera position in advance
 * (research-grid-camera-exit.md section 3). Only the stroke sizes follow the
 * zoom, and only in 2^(1/4) steps.
 */

/** Dots: `border` at 40% over `bg` (ruling R4a). */
export const GRID_DOT_ALPHA = 0.4; // OWNER-PICKED STARTING VALUE (design spec A)
/** Lines: `border` at 25% over `bg`, so dots read slightly stronger (R4). */
export const GRID_LINE_ALPHA = 0.25; // OWNER-PICKED STARTING VALUE (design spec A)
/** On-screen dot radius = clamp(slope x on-screen cell, min, max), in dp. */
export const GRID_DOT_RADIUS_CELLS = 0.07; // OWNER-PICKED STARTING VALUE (design spec A)
export const GRID_DOT_RADIUS_MIN_PT = 0.9; // OWNER-PICKED STARTING VALUE (design spec A)
export const GRID_DOT_RADIUS_MAX_PT = 1.75; // OWNER-PICKED STARTING VALUE (design spec A)
/** Line width on screen at every zoom, in dp. */
export const GRID_LINE_WIDTH_PT = 1; // OWNER-PICKED STARTING VALUE (design spec A)
/** Stroke sizes are re-sent to native only when the zoom moves this factor
 * from the last sent zoom (on-screen drift between steps is at most ~9%). */
export const GRID_STROKE_STEP = Math.pow(2, 0.25);
/**
 * Rubber-band overscroll the extent allows past the pan range, as a fraction
 * of the camera viewport on that axis. A finger drag across the whole screen
 * reaches 0.355 of it (BoardView rubberBand, c = 0.55); the rest is headroom
 * for withDecay's rubber band, whose overshoot depends on fling velocity.
 */
// OWNER-PICKED STARTING VALUE: research-grid-camera-exit.md section 3 margin
// (0.5 x viewport / minScale), not measured; a harder fling can briefly show
// bare background past the extent.
export const GRID_OVERSCROLL_FRACTION = 0.5;

export interface GridExtentInput {
  /** Board size in board units. */
  boardW: number;
  boardH: number;
  /** Board units per cell. */
  cell: number;
  /** The raw layout the board view draws into (runs under the nav bar). */
  layoutW: number;
  layoutH: number;
  /** The camera viewport the pan range clamps against (layout minus inset). */
  cameraW: number;
  cameraH: number;
  minScale: number;
  maxScale: number;
}

/** Inclusive cell range; dot (c, r) sits at ((c + 0.5) * cell, (r + 0.5) * cell). */
export interface GridExtent {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
}

/**
 * Board-space interval [lo, hi] that one axis can ever show: over every scale
 * in [sMin, sMax] and every translation in panRange widened by `over` screen
 * points (the rubber band). The visible interval at (s, t) is
 * [-t/s, (layout - t)/s]. Inside each panRange regime both ends move inward
 * as s grows, so the extremes sit at the smallest scale of each regime: sMin,
 * and just above the scale where the content first overflows the viewport.
 */
function axisReach(
  size: number,
  layout: number,
  viewport: number,
  sMin: number,
  sMax: number,
  over: number,
): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const consider = (s: number, tLo: number, tHi: number) => {
    lo = Math.min(lo, -(tHi + over) / s);
    hi = Math.max(hi, (layout - (tLo - over)) / s);
  };
  const [aLo, aHi] = panRange(size * sMin, viewport);
  consider(sMin, aLo, aHi);
  const sOverflow = viewport / size;
  if (sOverflow >= sMin && sOverflow <= sMax) {
    // The limit from above: padded range at the crossover scale.
    const pad = Math.min(EDGE_PAD_PT, viewport * 0.25); // panRange's pad
    consider(sOverflow, viewport - size * sOverflow - pad, pad);
  }
  return [lo, hi];
}

/** Every cell the camera can show, plus one cell of margin; null before layout. */
export function gridExtent(input: GridExtentInput): GridExtent | null {
  const { boardW, boardH, cell, layoutW, layoutH, cameraW, cameraH, minScale, maxScale } = input;
  if (
    !(layoutW >= 1 && layoutH >= 1 && cameraW >= 1 && cameraH >= 1) ||
    !(minScale > 0 && maxScale >= minScale) ||
    !(boardW > 0 && boardH > 0 && cell > 0)
  ) {
    return null;
  }
  const [x0, x1] = axisReach(
    boardW, layoutW, cameraW, minScale, maxScale, GRID_OVERSCROLL_FRACTION * cameraW,
  );
  const [y0, y1] = axisReach(
    boardH, layoutH, cameraH, minScale, maxScale, GRID_OVERSCROLL_FRACTION * cameraH,
  );
  return {
    minCol: Math.floor(x0 / cell) - 1,
    minRow: Math.floor(y0 / cell) - 1,
    maxCol: Math.ceil(x1 / cell),
    maxRow: Math.ceil(y1 / cell),
  };
}

/** Dot radius and line width in BOARD units for zoom `scale` (dp per board unit). */
export function gridStroke(scale: number, cell: number): { dotRadius: number; lineWidth: number } {
  'worklet';
  const cellPt = cell * scale;
  const radiusPt = Math.min(
    GRID_DOT_RADIUS_MAX_PT,
    Math.max(GRID_DOT_RADIUS_MIN_PT, GRID_DOT_RADIUS_CELLS * cellPt),
  );
  return { dotRadius: radiusPt / scale, lineWidth: GRID_LINE_WIDTH_PT / scale };
}

/** True when zoom `scale` is a full step away from the last sent zoom. */
export function gridRestrokeNeeded(sentScale: number, scale: number): boolean {
  'worklet';
  if (!(scale > 0)) return false;
  if (!(sentScale > 0)) return true;
  const ratio = scale / sentScale;
  return ratio >= GRID_STROKE_STEP - 1e-9 || ratio <= 1 / GRID_STROKE_STEP + 1e-9;
}

/** Opaque colours (never alpha: a dot over a line would darken each crossing). */
export function gridColors(p: Palette): { dot: string; line: string } {
  return {
    dot: composite(p.border, GRID_DOT_ALPHA, p.bg),
    line: composite(p.border, GRID_LINE_ALPHA, p.bg),
  };
}

export interface BoardGrid {
  cell: number;
  extent: GridExtent;
  dotColor: string;
  lineColor: string;
  linesOn: boolean;
  /** Board units for the last zoom step; 0 until a zoom has been sent. */
  dotRadius: number;
  lineWidth: number;
}

/**
 * Everything the board surfaces need for the grid, or null when the flag is
 * off (no grid, no native prop) or before layout.
 */
export function boardGridFor(input: {
  enabled: boolean;
  boardW: number;
  boardH: number;
  cell: number;
  layoutW: number;
  layoutH: number;
  /** The camera's bottom inset (BoardView passes 0 while META_ZOOMED_CAMERA is off). */
  bottomInset: number;
  zoomedCamera: boolean;
  palette: Palette;
  linesOn: boolean;
  /** The zoom the stroke sizes are for (the last step sent); 0 = none yet. */
  strokeScale: number;
}): BoardGrid | null {
  if (!input.enabled) return null;
  const visible = cameraViewport(input.layoutW, input.layoutH, input.bottomInset);
  const camera = initialCamera(
    visible.w, visible.h, input.boardW, input.boardH, input.cell, input.zoomedCamera,
  );
  if (camera === null) return null;
  const extent = gridExtent({
    boardW: input.boardW,
    boardH: input.boardH,
    cell: input.cell,
    layoutW: input.layoutW,
    layoutH: input.layoutH,
    cameraW: visible.w,
    cameraH: visible.h,
    minScale: camera.minScale,
    maxScale: camera.maxScale,
  });
  if (extent === null) return null;
  const colors = gridColors(input.palette);
  const stroke = input.strokeScale > 0
    ? gridStroke(input.strokeScale, input.cell)
    : { dotRadius: 0, lineWidth: 0 };
  return {
    cell: input.cell,
    extent,
    dotColor: colors.dot,
    lineColor: colors.line,
    linesOn: input.linesOn,
    dotRadius: stroke.dotRadius,
    lineWidth: stroke.lineWidth,
  };
}

const num = (value: number) => String(Number(value.toFixed(4)));

/** Native `grid` prop: `cell,minCol,minRow,maxCol,maxRow,#dot,#line`. */
export function serializeGridExtent(grid: BoardGrid): string {
  const { minCol, minRow, maxCol, maxRow } = grid.extent;
  return `${num(grid.cell)},${minCol},${minRow},${maxCol},${maxRow},${grid.dotColor},${grid.lineColor}`;
}

/** Native `gridStyle` prop: `dotRadius,lineWidth,lines(0|1)` in board units;
 * empty until a zoom has been sent. */
export function serializeGridStyle(grid: BoardGrid): string {
  if (!(grid.dotRadius > 0 && grid.lineWidth > 0)) return '';
  return `${num(grid.dotRadius)},${num(grid.lineWidth)},${grid.linesOn ? 1 : 0}`;
}

/**
 * The grid props spread onto the native board view. Flag OFF returns an empty
 * object, so the native payload is exactly today's (no key, no setter call).
 */
export function nativeGridProps(
  grid: BoardGrid | null,
  enabled: boolean,
): Record<string, never> | { grid: string; gridStyle: string } {
  if (!enabled) return {};
  if (grid === null) return { grid: '', gridStyle: '' };
  return { grid: serializeGridExtent(grid), gridStyle: serializeGridStyle(grid) };
}

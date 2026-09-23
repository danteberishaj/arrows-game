import { ArrowPath } from '../core';
import { Direction } from '../core';

/**
 * Line-art geometry for a multi-cell bent arrow, ported from
 * UIFactory.GenerateArrowPathSprite: a rounded-cap polyline through the cell
 * centers ending in a solid filled triangular arrowhead. Here it becomes SVG
 * path data instead of a baked sprite. Bends are rounded only by the round
 * line join: outer radius STROKE/2 = 0.072 cell, inner edge not filleted.
 *
 * Board pixel space: x right, y DOWN (SVG), cell (r,c) center at
 * ((c+0.5)*cell, (r+0.5)*cell).
 */

/** Head + stroke geometry as fractions of a cell (UIFactory constants). */
export const TIP_EXT = 0.5; // head cell center -> arrowhead tip
export const HEAD_LEN = 0.42; // arrowhead length (tip -> base)
export const HEAD_HALF = 0.27; // arrowhead half-width at its base
export const TAIL_EXT = 0.42; // rounded tail reaching past the first cell
export const STROKE = 0.144; // stroke width (2 * halfStroke)

export interface Pt {
  x: number;
  y: number;
}

/** Unit vector of a direction in SVG space (y down, so Up is -y). */
export function dirVec(d: Direction): Pt {
  switch (d) {
    case Direction.Up: return { x: 0, y: -1 };
    case Direction.Down: return { x: 0, y: 1 };
    case Direction.Left: return { x: -1, y: 0 };
    case Direction.Right: return { x: 1, y: 0 };
    default: return { x: 0, y: -1 };
  }
}

const center = (r: number, c: number, cell: number): Pt => ({
  x: (c + 0.5) * cell,
  y: (r + 0.5) * cell,
});

export interface ArrowArt {
  /** SVG path data for the shaft polyline (tail end -> head base). */
  readonly shaftD: string;
  /** SVG path data for the solid triangular arrowhead. */
  readonly headD: string;
}

interface ArrowShape {
  readonly shaft: readonly Pt[];
  readonly tip: Pt;
  readonly baseL: Pt;
  readonly baseR: Pt;
}

/** Builds the shaft + arrowhead SVG paths for one arrow. */
export function arrowArt(arrow: ArrowPath, cell: number): ArrowArt {
  const shape = arrowShape(arrow, cell);
  const shaftD = shape.shaft
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`,
    )
    .join(' ');
  const headD =
    `M${round(shape.tip.x)} ${round(shape.tip.y)} ` +
    `L${round(shape.baseL.x)} ${round(shape.baseL.y)} ` +
    `L${round(shape.baseR.x)} ${round(shape.baseR.y)} Z`;

  return { shaftD, headD };
}

function arrowShape(arrow: ArrowPath, cell: number): ArrowShape {
  const d = dirVec(arrow.headDir);
  const perp = { x: -d.y, y: d.x };

  const headCenter = center(arrow.head.r, arrow.head.c, cell);
  const tip = { x: headCenter.x + d.x * TIP_EXT * cell, y: headCenter.y + d.y * TIP_EXT * cell };
  const baseBack = { x: tip.x - d.x * HEAD_LEN * cell, y: tip.y - d.y * HEAD_LEN * cell };
  const baseL = { x: baseBack.x + perp.x * HEAD_HALF * cell, y: baseBack.y + perp.y * HEAD_HALF * cell };
  const baseR = { x: baseBack.x - perp.x * HEAD_HALF * cell, y: baseBack.y - perp.y * HEAD_HALF * cell };
  return { shaft: shaftPoints(arrow, cell, baseBack), tip, baseL, baseR };
}

/**
 * The arrow's ink as one polyline: rounded tail extension -> every cell
 * center -> arrowhead tip. Hit-testing measures the finger's distance to
 * this, so a tap lands on the stroke the player sees rather than on a grid
 * cell they cannot.
 */
export function arrowCenterline(arrow: ArrowPath, cell: number): Pt[] {
  const d = dirVec(arrow.headDir);
  const headCenter = center(arrow.head.r, arrow.head.c, cell);
  const tip = { x: headCenter.x + d.x * TIP_EXT * cell, y: headCenter.y + d.y * TIP_EXT * cell };
  return shaftPoints(arrow, cell, tip);
}

/**
 * Compact, immutable per-board geometry consumed by the native board view.
 * Each semicolon-delimited arrow starts with its shaft point count, followed
 * by shaft x/y pairs and the three arrowhead x/y pairs.
 */
export function serializeNativeBoardGeometry(
  arrows: readonly ArrowPath[],
  cell: number,
): string {
  return arrows.map((arrow) => {
    const shape = arrowShape(arrow, cell);
    const values: number[] = [shape.shaft.length];
    for (const point of shape.shaft) values.push(round(point.x), round(point.y));
    values.push(
      round(shape.tip.x),
      round(shape.tip.y),
      round(shape.baseL.x),
      round(shape.baseL.y),
      round(shape.baseR.x),
      round(shape.baseR.y),
    );
    return values.join(',');
  }).join(';');
}

/**
 * Combines idle arrows into two compound paths. Every shaft starts with `M`
 * and every head is closed with `Z`, so joining preserves independent stroke
 * caps and filled triangles while reducing hundreds of native SVG nodes to 2.
 */
export function batchedArrowArt(
  arrows: readonly ArrowPath[],
  cell: number,
  excluded?: ReadonlySet<ArrowPath>,
): ArrowArt {
  return combineArrowArt(arrows, excluded, (arrow) => arrowArt(arrow, cell));
}

/**
 * Geometry retained for exactly one board. BoardView owns one instance per
 * BoardLogic reference, so cached arrow path strings are released with that
 * board instead of accumulating in a process-wide cache.
 */
export class BoardArrowArtCache {
  private readonly cell: number;
  private readonly orderedArrows: readonly ArrowPath[];
  private readonly artByArrow: ReadonlyMap<ArrowPath, ArrowArt>;
  private readonly indexByArrow: ReadonlyMap<ArrowPath, number>;
  private readonly nativeGeometry: string;

  constructor(arrows: readonly ArrowPath[], cell: number) {
    this.cell = cell;
    this.orderedArrows = [...arrows];
    const artByArrow = new Map<ArrowPath, ArrowArt>();
    const indexByArrow = new Map<ArrowPath, number>();
    for (const [index, arrow] of this.orderedArrows.entries()) {
      artByArrow.set(arrow, arrowArt(arrow, cell));
      indexByArrow.set(arrow, index);
    }
    this.artByArrow = artByArrow;
    this.indexByArrow = indexByArrow;
    this.nativeGeometry = serializeNativeBoardGeometry(this.orderedArrows, cell);
  }

  artFor(arrow: ArrowPath): ArrowArt {
    // A stale hint from another board must still render safely, but is not
    // retained: the cache remains bounded by its board's initial arrow set.
    return this.artByArrow.get(arrow) ?? arrowArt(arrow, this.cell);
  }

  indexFor(arrow: ArrowPath): number | null {
    return this.indexByArrow.get(arrow) ?? null;
  }

  batch(
    arrows: readonly ArrowPath[],
    excluded?: ReadonlySet<ArrowPath>,
  ): ArrowArt {
    return combineArrowArt(arrows, excluded, (arrow) => this.artFor(arrow));
  }

  geometryForNativeView(): string {
    return this.nativeGeometry;
  }

  visibilityMask(
    visibleArrows: readonly ArrowPath[],
    excluded?: ReadonlySet<ArrowPath>,
  ): string {
    const visible = new Set(visibleArrows);
    return this.orderedArrows
      .map((arrow) => visible.has(arrow) && !excluded?.has(arrow) ? '1' : '0')
      .join('');
  }

}

function combineArrowArt(
  arrows: readonly ArrowPath[],
  excluded: ReadonlySet<ArrowPath> | undefined,
  artFor: (arrow: ArrowPath) => ArrowArt,
): ArrowArt {
  const shafts: string[] = [];
  const heads: string[] = [];
  for (const arrow of arrows) {
    if (excluded?.has(arrow)) continue;
    const art = artFor(arrow);
    shafts.push(art.shaftD);
    heads.push(art.headD);
  }
  return { shaftD: shafts.join(' '), headD: heads.join(' ') };
}

/** Centerline points, tail end (with the rounded tail extension) -> head base. */
function shaftPoints(arrow: ArrowPath, cell: number, endPoint: Pt): Pt[] {
  const d = dirVec(arrow.headDir);
  const n = arrow.cells.length;
  const headCenter = center(arrow.head.r, arrow.head.c, cell);

  const pts: Pt[] = [];
  if (n === 1) {
    pts.push({ x: headCenter.x - d.x * TAIL_EXT * cell, y: headCenter.y - d.y * TAIL_EXT * cell });
  } else {
    const p0 = center(arrow.cells[0].r, arrow.cells[0].c, cell);
    const p1 = center(arrow.cells[1].r, arrow.cells[1].c, cell);
    const len = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
    const ux = (p0.x - p1.x) / len, uy = (p0.y - p1.y) / len;
    pts.push({ x: p0.x + ux * TAIL_EXT * cell, y: p0.y + uy * TAIL_EXT * cell });
    for (const c2 of arrow.cells) pts.push(center(c2.r, c2.c, cell));
  }
  pts.push(endPoint);
  return pts;
}

export interface SlitherPath {
  /** SVG path data: tail end -> head -> straight off the board. */
  d: string;
  /** The same polyline as `d`, for renderers that build their own path. */
  points: readonly Pt[];
  /** Arc length of the arrow body (the visible dash). */
  bodyLen: number;
  /** Total arc length including the off-board exit ray. */
  totalLen: number;
  /**
   * The arrowhead triangle's corners at the start (it leads the trail out;
   * the renderer rebuilds the path per frame from these plus the travel
   * offset, because `x`/`y` transform props don't exist on web SVG paths).
   */
  headTip: Pt;
  headBaseL: Pt;
  headBaseR: Pt;
  /** Unit exit direction — the head translates along this. */
  dir: Pt;
}

/**
 * The slither-exit path (SlitherExit.cs): the arrow's own centerline
 * continued straight past the head to beyond the board edge (or, given an
 * `extent`, beyond that rectangle's edge), so the dash segment retraces every
 * bend as it flows out. The ray overshoots the edge by the body length + one
 * cell so the trail fully leaves before the dash ends.
 */
/** An axis-aligned rectangle in board points. */
export interface BoardRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Distance from `p` to the edge of `rect` along the unit axis direction `d`. */
function distanceToRectEdge(p: Pt, d: Pt, rect: BoardRect): number {
  if (d.x > 0) return rect.maxX - p.x;
  if (d.x < 0) return p.x - rect.minX;
  if (d.y > 0) return rect.maxY - p.y;
  return p.y - rect.minY;
}

/**
 * Head-centre distance to `rect`'s edge along the arrow's exit direction
 * (negative when the head is already past that edge). POLISH-T3 uses it for
 * the on-screen part of the run, which sets the exit duration.
 */
export function headDistanceToRectEdge(arrow: ArrowPath, cell: number, rect: BoardRect): number {
  return distanceToRectEdge(center(arrow.head.r, arrow.head.c, cell), dirVec(arrow.headDir), rect);
}

export function slitherPath(
  arrow: ArrowPath,
  cell: number,
  rows: number,
  cols: number,
  extent?: BoardRect,
): SlitherPath {
  const d = dirVec(arrow.headDir);
  const headCenter = center(arrow.head.r, arrow.head.c, cell);

  const pts = shaftPoints(arrow, cell, headCenter);
  let bodyLen = 0;
  for (let i = 1; i < pts.length; i++) {
    bodyLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  bodyLen = Math.max(bodyLen, 0.45 * cell); // single-cell arrows still get a short trail

  // Distance from the head center to the board edge along the exit direction.
  // POLISH-T3 (META_EXIT_TO_SCREEN_EDGE): with an `extent` (the visible
  // screen in board space plus a pan margin) the ray runs to that edge
  // instead; a head already past it still travels body + one cell.
  const boardW = cols * cell, boardH = rows * cell;
  let toEdge: number;
  if (extent) toEdge = Math.max(0, distanceToRectEdge(headCenter, d, extent));
  else if (d.x > 0) toEdge = boardW - headCenter.x;
  else if (d.x < 0) toEdge = headCenter.x;
  else if (d.y > 0) toEdge = boardH - headCenter.y;
  else toEdge = headCenter.y;

  const rayLen = toEdge + bodyLen + cell;
  const end = { x: headCenter.x + d.x * rayLen, y: headCenter.y + d.y * rayLen };
  pts.push(end);

  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }

  // The arrowhead rides the leading end of the trail: everything past the head
  // is a straight ray, so the head's motion is a pure translation along dir.
  const perp = { x: -d.y, y: d.x };
  const tip = { x: headCenter.x + d.x * TIP_EXT * cell, y: headCenter.y + d.y * TIP_EXT * cell };
  const baseBack = { x: tip.x - d.x * HEAD_LEN * cell, y: tip.y - d.y * HEAD_LEN * cell };

  const dStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
  return {
    d: dStr,
    points: pts,
    bodyLen,
    totalLen,
    headTip: tip,
    headBaseL: { x: baseBack.x + perp.x * HEAD_HALF * cell, y: baseBack.y + perp.y * HEAD_HALF * cell },
    headBaseR: { x: baseBack.x - perp.x * HEAD_HALF * cell, y: baseBack.y - perp.y * HEAD_HALF * cell },
    dir: d,
  };
}

const round = (v: number) => Math.round(v * 100) / 100;

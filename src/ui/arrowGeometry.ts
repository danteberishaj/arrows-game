import { ArrowPath } from '../core';
import { Direction } from '../core';

/**
 * Line-art geometry for a multi-cell bent arrow, ported from
 * UIFactory.GenerateArrowPathSprite: a rounded-cap polyline through the cell
 * centers ending in a solid filled triangular arrowhead. Here it becomes SVG
 * path data instead of a baked sprite; strokeLinejoin="round" stands in for
 * the small corner fillet (BendRadiusCells = 0.12).
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
  shaftD: string;
  /** SVG path data for the solid triangular arrowhead. */
  headD: string;
}

/** Builds the shaft + arrowhead SVG paths for one arrow. */
export function arrowArt(arrow: ArrowPath, cell: number): ArrowArt {
  const d = dirVec(arrow.headDir);
  const perp = { x: -d.y, y: d.x };

  const n = arrow.cells.length;
  const headCenter = center(arrow.head.r, arrow.head.c, cell);
  const tip = { x: headCenter.x + d.x * TIP_EXT * cell, y: headCenter.y + d.y * TIP_EXT * cell };
  const baseBack = { x: tip.x - d.x * HEAD_LEN * cell, y: tip.y - d.y * HEAD_LEN * cell };
  const baseL = { x: baseBack.x + perp.x * HEAD_HALF * cell, y: baseBack.y + perp.y * HEAD_HALF * cell };
  const baseR = { x: baseBack.x - perp.x * HEAD_HALF * cell, y: baseBack.y - perp.y * HEAD_HALF * cell };

  const pts = shaftPoints(arrow, cell, baseBack);
  const shaftD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
  const headD = `M${round(tip.x)} ${round(tip.y)} L${round(baseL.x)} ${round(baseL.y)} L${round(baseR.x)} ${round(baseR.y)} Z`;

  return { shaftD, headD };
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
  /** Arc length of the arrow body (the visible dash). */
  bodyLen: number;
  /** Total arc length including the off-board exit ray. */
  totalLen: number;
}

/**
 * The slither-exit path (SlitherExit.cs): the arrow's own centerline
 * continued straight past the head to beyond the board edge, so the dash
 * segment retraces every bend as it flows out. The ray overshoots the edge by
 * the body length + one cell so the trail fully leaves before the dash ends.
 */
export function slitherPath(arrow: ArrowPath, cell: number, rows: number, cols: number): SlitherPath {
  const d = dirVec(arrow.headDir);
  const headCenter = center(arrow.head.r, arrow.head.c, cell);

  const pts = shaftPoints(arrow, cell, headCenter);
  let bodyLen = 0;
  for (let i = 1; i < pts.length; i++) {
    bodyLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  bodyLen = Math.max(bodyLen, 0.45 * cell); // single-cell arrows still get a short trail

  // Distance from the head center to the board edge along the exit direction.
  const boardW = cols * cell, boardH = rows * cell;
  let toEdge: number;
  if (d.x > 0) toEdge = boardW - headCenter.x;
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

  const dStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
  return { d: dStr, bodyLen, totalLen };
}

const round = (v: number) => Math.round(v * 100) / 100;

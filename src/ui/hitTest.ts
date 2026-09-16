import { ArrowPath, BoardLogic } from '../core';
import { arrowCenterline, type Pt } from './arrowGeometry';

/**
 * Tap forgiveness radius in SCREEN points: half of the 44 pt minimum target
 * (Apple HIG; Material asks for 48 dp). A dense board's cells are 8-22 pt at
 * fit-to-view, so the finger's contact patch always covers several arrows;
 * hit-testing by distance to the ink picks the one the player is looking at
 * instead of whichever cell the touch centroid happened to land in.
 */
export const TAP_RADIUS_PT = 22;

export interface ArrowHit {
  arrow: ArrowPath;
  /** Distance from the touch point to the arrow's centerline, board units. */
  distance: number;
}

/**
 * Two arrows closer than this (in cells) to a touch are "the same distance":
 * a fifth of a cell is 2-4 screen points at fit zoom, well inside finger
 * jitter, and only ever spans the seam between two strokes.
 */
export const AMBIGUITY_CELLS = 0.2;

/** How far past its cells an arrow's ink reaches (tip / rounded tail). */
const INK_OVERHANG_CELLS = 0.5;

/**
 * Nearest-ink hit-testing for one board. Candidate arrows come from the
 * owner grid around the touch (O(radius^2) cells, not O(arrows)); the exact
 * distance to each candidate's centerline decides. Centerlines are cached
 * per arrow for the life of the board.
 */
export class ArrowHitTester {
  private readonly centerlines = new Map<ArrowPath, readonly Pt[]>();

  constructor(
    private readonly board: BoardLogic,
    private readonly cell: number,
  ) {}

  /**
   * The arrow whose ink is closest to (x, y) in board units, if it lies
   * within `radius` (board units). Empty cells, cleared holes and the padding
   * outside the board all snap to the nearest arrow in range.
   *
   * When two arrows are practically the same distance away (a touch on the
   * seam between them, within {@link AMBIGUITY_CELLS}), the tap gets the
   * benefit of the doubt: if `prefer` accepts exactly one of them (the caller
   * passes "can this arrow exit?"), that one wins. A seam tap was never a
   * decision to fire the blocked neighbour, so it should not cost a heart.
   */
  nearest(
    x: number,
    y: number,
    radius: number,
    prefer?: (arrow: ArrowPath) => boolean,
  ): ArrowHit | null {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(radius >= 0)) return null;
    const { board, cell } = this;
    const reach = radius + INK_OVERHANG_CELLS * cell;
    const c0 = Math.max(0, Math.floor((x - reach) / cell));
    const c1 = Math.min(board.cols - 1, Math.floor((x + reach) / cell));
    const r0 = Math.max(0, Math.floor((y - reach) / cell));
    const r1 = Math.min(board.rows - 1, Math.floor((y + reach) / cell));

    let best: ArrowHit | null = null;
    let runnerUp: ArrowHit | null = null;
    const seen = new Set<ArrowPath>();
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const owner = board.ownerAt(r, c);
        if (owner === null || seen.has(owner)) continue;
        seen.add(owner);
        const distance = distanceToPolyline(x, y, this.centerlineFor(owner));
        if (distance > radius) continue;
        const hit = { arrow: owner, distance };
        if (best === null || distance < best.distance) {
          runnerUp = best;
          best = hit;
        } else if (runnerUp === null || distance < runnerUp.distance) {
          runnerUp = hit;
        }
      }
    }
    if (
      prefer !== undefined &&
      best !== null &&
      runnerUp !== null &&
      runnerUp.distance - best.distance <= AMBIGUITY_CELLS * cell &&
      !prefer(best.arrow) &&
      prefer(runnerUp.arrow)
    ) {
      return runnerUp;
    }
    return best;
  }

  private centerlineFor(arrow: ArrowPath): readonly Pt[] {
    let line = this.centerlines.get(arrow);
    if (line === undefined) {
      line = arrowCenterline(arrow, this.cell);
      this.centerlines.set(arrow, line);
    }
    return line;
  }
}

/** Shortest distance from (x, y) to a polyline (or its single point). */
export function distanceToPolyline(x: number, y: number, points: readonly Pt[]): number {
  if (points.length === 0) return Infinity;
  let best = Math.hypot(x - points[0].x, y - points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const d = distanceToSegment(x, y, points[i - 1], points[i]);
    if (d < best) best = d;
  }
  return best;
}

function distanceToSegment(x: number, y: number, a: Pt, b: Pt): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((x - a.x) * abx + (y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t));
}

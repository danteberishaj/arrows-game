/**
 * W5-17 (owner answer 2026-10-06, docs/owner-rulings-2026-10-06.md Q3: set B): the cleared board's silhouette outline,
 * drawn in board space under the arrows' camera transform, and the post-clear timeline it takes its slot from.
 */
import { generateDaily, LevelGenerator } from '../../core';
import { CLEAR_REVEAL_CORNER_RADIUS_CELLS, CLEAR_REVEAL_OUTLINE_SMOOTHING } from '../artConfig';
import {
  CLEAR_REVEAL_HOLD_MS,
  CLEAR_REVEAL_MS,
  clearRevealSlotMs,
  clearRevealStartMs,
  EMPTY_BOARD_HOLD_MS,
  emptyBoardHoldMs,
  wonPanelDelayMs,
} from '../gameSessionLifecycle';
import { maskOutlinePath, silhouettePath } from '../silhouette';

/** = BoardView.tsx `CELL` (board units per cell); not imported, to keep this a pure-module test. */
const CELL = 40;

type Point = readonly [number, number];

function parseLoops(path: string): Point[][] {
  const tokens = path.match(/[MLZ]|-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const loops: Point[][] = [];
  let current: Point[] | null = null;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++].toUpperCase();
    if (command === 'Z') { loops.push(current!); current = null; continue; }
    const p: Point = [Number(tokens[i++]), Number(tokens[i++])];
    if (command === 'M') current = [p]; else current!.push(p);
  }
  return loops;
}

/** Every subpath of an M/L/Q/C/Z path as a polyline; each quadratic or cubic is sampled at `steps` points (end included). */
function flatten(path: string, steps = 16): Point[][] {
  const tokens = path.match(/[MLQCZ]|-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const loops: Point[][] = [];
  let current: Point[] | null = null;
  const num = (i: number) => Number(tokens[i]);
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++].toUpperCase();
    if (command === 'Z') {
      const [first, last] = [current![0], current![current!.length - 1]];
      if (first[0] !== last[0] || first[1] !== last[1]) current!.push(first); // Z draws the closing run
      loops.push(current!); current = null; continue;
    }
    if (command === 'Q') {
      const p0 = current![current!.length - 1];
      const [x1, y1, x2, y2] = [num(i), num(i + 1), num(i + 2), num(i + 3)];
      i += 4;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps; const u = 1 - t;
        current!.push([u * u * p0[0] + 2 * u * t * x1 + t * t * x2, u * u * p0[1] + 2 * u * t * y1 + t * t * y2]);
      }
      continue;
    }
    if (command === 'C') {
      const p0 = current![current!.length - 1];
      const [x1, y1, x2, y2, x3, y3] = [num(i), num(i + 1), num(i + 2), num(i + 3), num(i + 4), num(i + 5)];
      i += 6;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps; const u = 1 - t;
        current!.push([
          u * u * u * p0[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * p0[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      continue;
    }
    const p: Point = [num(i), num(i + 1)];
    i += 2;
    if (command === 'M') current = [p]; else current!.push(p);
  }
  return loops;
}

/** Per subpath, as written (no implied Z run): the M point and the last explicit point before Z. */
function explicitEnds(path: string): [Point, Point][] {
  return path.split(/(?=M)/).filter((sub) => sub.trim() !== '').map((sub) => {
    expect(sub.trim().endsWith('Z')).toBe(true);
    const numbers = (sub.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []).map(Number);
    return [[numbers[0], numbers[1]], [numbers[numbers.length - 2], numbers[numbers.length - 1]]];
  });
}

/** The subpaths' command letters, e.g. ['MLCLC...Z']. */
function commands(path: string): string[] {
  return path.split(/(?=M)/).map((sub) => sub.replace(/[^MLQCZ]/g, '')).filter((sub) => sub !== '');
}

type Segment = readonly [Point, Point];

function segmentsOf(loop: readonly Point[]): Segment[] {
  const points = loop.filter((p, i) => i === 0 || p[0] !== loop[i - 1][0] || p[1] !== loop[i - 1][1]);
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) segments.push([points[i], points[i + 1]]);
  return segments;
}

function pointSegmentDistance([px, py]: Point, [[ax, ay], [bx, by]]: Segment): number {
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentDistance(a: Segment, b: Segment): number {
  const cross = (o: Point, p: Point, q: Point) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a[0], a[1], b[0]); const d2 = cross(a[0], a[1], b[1]);
  const d3 = cross(b[0], b[1], a[0]); const d4 = cross(b[0], b[1], a[1]);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(
    pointSegmentDistance(a[0], b), pointSegmentDistance(a[1], b),
    pointSegmentDistance(b[0], a), pointSegmentDistance(b[1], a),
  );
}

/**
 * The smallest gap between any two non-adjacent pieces of the flattened outline (across all its loops). 0 = the path
 * crosses or touches itself. Adjacent pieces of one loop (incl. last/first) share an endpoint and are skipped.
 */
function minSelfGap(path: string, steps = 16): number {
  const all = flatten(path, steps).map(segmentsOf);
  let gap = Infinity;
  all.forEach((segments, la) => {
    all.forEach((others, lb) => {
      if (lb < la) return;
      segments.forEach((a, i) => {
        others.forEach((b, j) => {
          if (la === lb && (j <= i + 1 || (i === 0 && j === segments.length - 1))) return;
          gap = Math.min(gap, segmentDistance(a, b));
        });
      });
    });
  });
  return gap;
}

/** The largest distance from any sampled point of `path` to the nearest piece of `reference` (one-sided Hausdorff). */
function maxDeviation(path: string, reference: string): number {
  const refSegments = flatten(reference).flatMap(segmentsOf);
  let worst = 0;
  for (const [a, b] of flatten(path).flatMap(segmentsOf)) {
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      worst = Math.max(worst, Math.min(...refSegments.map((s) => pointSegmentDistance(p, s))));
    }
  }
  return worst;
}

function inside([x, y]: Point, loops: readonly Point[][]): boolean {
  let hit = false;
  for (const polygon of loops) {
    for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
      const [ax, ay] = polygon[a];
      const [bx, by] = polygon[b];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit;
    }
  }
  return hit;
}

describe('maskOutlinePath: the mask in board space (cell (r, c) spans c..c+1 x r..r+1 cells)', () => {
  it('corner cell (0,0) maps to (0,0)-(CELL,CELL) ("none" = the W5-17 staircase)', () => {
    expect(maskOutlinePath([[true]], CELL, 'none')).toBe(`M 0 0 L ${CELL} 0 L ${CELL} ${CELL} L 0 ${CELL} Z`);
    const loops = parseLoops(maskOutlinePath([[true, false], [false, false]], CELL, 'none'));
    expect(loops).toHaveLength(1);
    expect([...loops[0]].sort()).toEqual([[0, 0], [0, CELL], [CELL, 0], [CELL, CELL]].sort());
  });

  it('is not centred: a 2-row x 5-col mask keeps its origin at (0,0) (silhouettePath centres it)', () => {
    const mask = [[true, true, true, true, true], [true, true, true, true, true]];
    const loops = flatten(maskOutlinePath(mask, CELL));
    const ys = loops.flat().map(([, y]) => y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(2 * CELL);
    expect(Math.min(...parseLoops(silhouettePath(mask, 5 * CELL)).flat().map(([, y]) => y))).toBeGreaterThan(0);
  });

  it.each([['the staircase', 'none'], ['rounded corners', 'corners'], ['the smoothed contour', 'contour']] as const)(
    'round-trips real level masks cell by cell (even-odd) at board scale, square and non-square: %s', (_, smoothing) => {
    const levels = [LevelGenerator.generate(0, 1), LevelGenerator.generate(167, 1), LevelGenerator.generate(38, 1)];
    for (let day = 0; day < 400 && !levels.some((l) => l.board.rows !== l.board.cols); day++) {
      const daily = generateDaily(day);
      if (daily.board.rows !== daily.board.cols) levels.push(daily);
    }
    expect(levels.some((l) => l.board.rows !== l.board.cols)).toBe(true);
    for (const level of levels) {
      expect([level.mask.length, level.mask[0].length]).toEqual([level.board.rows, level.board.cols]);
      const loops = flatten(maskOutlinePath(level.mask, CELL, smoothing));
      for (let r = 0; r < level.board.rows; r++) {
        for (let c = 0; c < level.board.cols; c++) {
          expect([level.shapeName, r, c, inside([(c + 0.5) * CELL, (r + 0.5) * CELL], loops)])
            .toEqual([level.shapeName, r, c, level.mask[r][c]]);
        }
      }
      for (const [x, y] of loops.flat()) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(level.board.cols * CELL);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(level.board.rows * CELL);
      }
      if (smoothing !== 'none') continue;
      for (const [x, y] of loops.flat()) {
        expect(x % CELL).toBe(0); expect(y % CELL).toBe(0);
      }
    }
  });

  it('a tutorial board (empty mask) and an all-false mask draw nothing', () => {
    expect(maskOutlinePath([], CELL)).toBe('');
    expect(maskOutlinePath([[false, false]], CELL)).toBe('');
    expect(maskOutlinePath([], CELL, 'none')).toBe('');
    expect(maskOutlinePath([], CELL, 'corners')).toBe('');
  });

  it('silhouettePath is unchanged by the shared tracer', () => {
    expect(silhouettePath([[true]], 10)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    expect(silhouettePath([[true, true]], 10)).toBe('M 0 2.5 L 10 2.5 L 10 7.5 L 0 7.5 Z');
  });
});

/** Synthetic masks: the cases a fillet can get wrong. */
const NOTCH_1 = [[true, false, true], [true, true, true], [true, true, true]]; // a 1-cell notch in the top edge
const STEP_1 = [[true, false], [true, true]]; // one 1-cell step (an L)
const STAIR_1 = [[true, false, false, false], [true, true, false, false], [true, true, true, false], [true, true, true, true]];
const PINCH = [[true, false], [false, true]]; // two cells touching at one grid point (two loops through one vertex)
const HOLE_1 = [[true, true, true], [true, false, true], [true, true, true]]; // a 1-cell hole (an inner contour)
const PENINSULA_1 = [[true, true, true], [false, true, false]]; // a 1-cell-wide tab: two convex corners on a 1-cell run
const SYNTHETIC = { NOTCH_1, STEP_1, STAIR_1, PINCH, HOLE_1, PENINSULA_1 } as const;
/** v1 Circle (level 1), Star, Bolt, Ring (a 172-cell hole), Butterfly (14 hole cells), Heart, Cat. */
const REAL = [0, 5, 11, 38, 119, 161, 167].map((index) => LevelGenerator.generate(index, 1));

describe("maskOutlinePath 'corners': circular fillets at every staircase corner (the fallback method)", () => {
  it('positive controls: the detectors below see a crossing, a touch and a far-off curve', () => {
    expect(minSelfGap(`M 0 0 L ${CELL} ${CELL} L ${CELL} 0 L 0 ${CELL} Z`)).toBe(0); // bow-tie
    expect(minSelfGap(`M 0 0 L ${2 * CELL} 0 L ${CELL} 0 L ${CELL} ${CELL} Z`)).toBe(0); // folds back onto itself
    expect(minSelfGap(`M 0 0 L ${CELL} 0 L ${CELL} ${CELL} Z M ${CELL} ${CELL} L ${2 * CELL} ${CELL} L ${2 * CELL} ${2 * CELL} Z`)).toBe(0);
    expect(minSelfGap(`M 0 0 L ${CELL} 0 L ${CELL} ${CELL} L 0 ${CELL} Z`)).toBeGreaterThan(0);
    const square = maskOutlinePath([[true]], CELL, 'none');
    expect(maxDeviation(`M 0 0 C ${3 * CELL} 0 ${3 * CELL} ${CELL} 0 ${CELL} Z`, square)).toBeGreaterThan(0.5 * CELL);
    expect(maxDeviation(square, `M 0 0 L ${CELL} 0 Z`)).toBe(CELL); // the far side of a square from its top edge
  });

  it('the radius is the owner\'s 0.35..0.5 cell range', () => {
    expect(CLEAR_REVEAL_CORNER_RADIUS_CELLS).toBeGreaterThanOrEqual(0.35);
    expect(CLEAR_REVEAL_CORNER_RADIUS_CELLS).toBeLessThanOrEqual(0.5);
  });

  it.each(Object.entries(SYNTHETIC))('%s: every loop is closed (it ends where it starts, then Z)', (_, mask) => {
    const path = maskOutlinePath(mask, CELL, 'corners');
    expect(path).not.toBe('');
    for (const sub of commands(path)) expect(sub).toMatch(/^M[LC]+Z$/);
    for (const [first, last] of explicitEnds(path)) expect(last).toEqual(first);
  });

  it('real masks: every loop is closed', () => {
    for (const level of REAL) {
      for (const [first, last] of explicitEnds(maskOutlinePath(level.mask, CELL, 'corners'))) {
        expect([level.shapeName, last]).toEqual([level.shapeName, first]);
      }
    }
  });

  it.each(Object.entries(SYNTHETIC))('%s: no self-intersection (no two non-adjacent pieces cross or touch)', (_, mask) => {
    expect(minSelfGap(maskOutlinePath(mask, CELL, 'corners'))).toBeGreaterThan(1e-6 * CELL);
    // a radius past half a 1-cell run is clamped, so the fillets still never overlap
    expect(minSelfGap(maskOutlinePath(mask, CELL, 'corners', 0.9))).toBeGreaterThan(1e-6 * CELL);
  });

  it('real masks (incl. Ring and Butterfly holes): no self-intersection', () => {
    for (const level of REAL) {
      expect([level.shapeName, minSelfGap(maskOutlinePath(level.mask, CELL, 'corners'), 6) > 1e-6 * CELL]).toEqual([level.shapeName, true]);
    }
  });

  it('a radius past half the shortest adjacent run is clamped to it (0.9 cell on 1-cell runs = 0.5 cell)', () => {
    expect(maskOutlinePath([[true]], CELL, 'corners', 0.9)).toBe(maskOutlinePath([[true]], CELL, 'corners', 0.5));
    expect(maskOutlinePath([[true], [true], [true]], CELL, 'corners', 2)).toBe(maskOutlinePath([[true], [true], [true]], CELL, 'corners', 0.5));
    expect(maskOutlinePath([[true, true, true]], CELL, 'corners', 2)).toBe(maskOutlinePath([[true, true, true]], CELL, 'corners', 0.5));
  });

  it('one cell becomes a circle of the fillet radius around the cell centre (4 corners, no straight run left)', () => {
    const path = maskOutlinePath([[true]], CELL, 'corners', 0.5);
    expect(commands(path)).toEqual(['MCCCCZ']);
    for (const [x, y] of flatten(path)[0]) {
      expect(Math.abs(Math.hypot(x - CELL / 2, y - CELL / 2) - CELL / 2)).toBeLessThan(0.001 * CELL);
    }
  });

  it.each([...Object.entries(SYNTHETIC), ...REAL.map((l) => [l.shapeName, l.mask] as const)])(
    '%s: stays within 0.5 cell of the staircase both ways (sampled)', (_, mask) => {
      const staircase = maskOutlinePath(mask, CELL, 'none');
      const rounded = maskOutlinePath(mask, CELL, 'corners');
      expect(maxDeviation(rounded, staircase)).toBeLessThanOrEqual(0.5 * CELL);
      expect(maxDeviation(staircase, rounded)).toBeLessThanOrEqual(0.5 * CELL);
    });

  it('one fillet per staircase corner: the C count of each loop = that staircase loop\'s vertex count', () => {
    for (const mask of [...Object.values(SYNTHETIC), ...REAL.map((l) => l.mask)]) {
      const corners = parseLoops(maskOutlinePath(mask, CELL, 'none')).map((loop) => loop.length);
      const rounded = commands(maskOutlinePath(mask, CELL, 'corners'));
      expect(rounded.map((sub) => (sub.match(/C/g) ?? []).length)).toEqual(corners);
    }
    expect(commands(maskOutlinePath(HOLE_1, CELL, 'corners'))).toHaveLength(2); // the outer contour and the hole
  });

  it('is deterministic and prints at most 3 decimals', () => {
    for (const level of REAL) {
      const path = maskOutlinePath(level.mask, CELL, 'corners');
      expect(maskOutlinePath(level.mask.map((row) => [...row]), CELL, 'corners')).toBe(path);
      expect(path).not.toMatch(/\d\.\d{4,}/);
    }
  });
});

/** The longest straight (L) piece of a path whose direction is (dx, dy) up to sign, in board units. */
function longestStraight(path: string, dx: number, dy: number): number {
  let best = 0;
  for (const sub of path.split(/(?=M)/).filter((x) => x.trim() !== '')) {
    const tokens = sub.match(/[MLQCZ]|-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? [];
    let at: Point = [0, 0];
    for (let i = 0; i < tokens.length;) {
      const command = tokens[i++];
      if (command === 'Z') continue;
      const count = command === 'Q' ? 4 : command === 'C' ? 6 : 2;
      const values = tokens.slice(i, i + count).map(Number);
      i += count;
      const end: Point = [values[count - 2], values[count - 1]];
      if (command === 'L') {
        const [ex, ey] = [end[0] - at[0], end[1] - at[1]];
        const length = Math.hypot(ex, ey);
        if (Math.abs(Math.abs(ex * dx + ey * dy) / Math.hypot(dx, dy) - length) < 1e-6 * CELL) best = Math.max(best, length);
      }
      at = end;
    }
  }
  return best;
}

/** The largest turn, in degrees, between consecutive pieces of the flattened outline (a kink shows as a big turn). */
function maxTurnDegrees(path: string): number {
  let worst = 0;
  for (const loop of flatten(path, 16)) {
    const segments = segmentsOf(loop);
    for (let i = 0; i < segments.length; i++) {
      const [a0, a1] = segments[i];
      const [b0, b1] = segments[(i + 1) % segments.length];
      const angle = Math.abs(Math.atan2(
        (a1[0] - a0[0]) * (b1[1] - b0[1]) - (a1[1] - a0[1]) * (b1[0] - b0[0]),
        (a1[0] - a0[0]) * (b1[0] - b0[0]) + (a1[1] - a0[1]) * (b1[1] - b0[1]),
      ));
      worst = Math.max(worst, (angle * 180) / Math.PI);
    }
  }
  return worst;
}

/** The smallest distance between two different loops of a path. */
function loopGap(path: string): number {
  const [a, b] = flatten(path).map(segmentsOf);
  let gap = Infinity;
  for (const p of a) for (const q of b) gap = Math.min(gap, segmentDistance(p, q));
  return gap;
}

/** A 6-step 45-degree staircase (the lower-left triangle of a 6x6 mask). */
const STAIR_6 = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (__, c) => c <= r));
/** Every distinct v1 shape (first appearance in levels 0..199) and the first non-square daily. */
const ALL_SHAPES = (() => {
  const byName = new Map<string, readonly (readonly boolean[])[]>();
  for (let index = 0; index < 200; index++) {
    const level = LevelGenerator.generate(index, 1);
    if (!byName.has(level.shapeName)) byName.set(level.shapeName, level.mask);
  }
  for (let day = 0; day < 400; day++) {
    const daily = generateDaily(day);
    if (daily.board.rows !== daily.board.cols) { byName.set(`daily ${day}`, daily.mask); break; }
  }
  return [...byName.entries()];
})();

describe("maskOutlinePath 'contour' (default, coordinator follow-up 2026-10-06): corners cut to edge midpoints, then rounded", () => {
  it("is the default smoothing, and 'corners' stays available", () => {
    expect(CLEAR_REVEAL_OUTLINE_SMOOTHING).toBe('contour');
    expect(maskOutlinePath(STEP_1, CELL)).toBe(maskOutlinePath(STEP_1, CELL, 'contour'));
    expect(maskOutlinePath(STEP_1, CELL, 'corners')).not.toBe(maskOutlinePath(STEP_1, CELL, 'contour'));
  });

  it('positive control: the kink detector sees the staircase (90 degrees) and a cut-only corner (45 degrees)', () => {
    expect(maxTurnDegrees(maskOutlinePath(STAIR_6, CELL, 'none'))).toBeGreaterThan(89);
    expect(maxTurnDegrees(`M 20 0 L 40 20 L 20 40 L 0 20 Z`)).toBeGreaterThan(89);
    expect(maxTurnDegrees(`M 0 0 L 40 0 L 80 40 L 0 40 Z`)).toBeGreaterThan(44);
  });

  it('1-cell diagonal steps become one straight 45-degree line', () => {
    const path = maskOutlinePath(STAIR_6, CELL);
    // the staircase hypotenuse has 11 corners; cut to midpoints they line up: >= 4 cells of straight 45-degree line
    expect(longestStraight(path, 1, 1)).toBeGreaterThanOrEqual(4 * Math.SQRT2 * CELL - 1e-6);
    expect(longestStraight(maskOutlinePath(STAIR_6, CELL, 'corners'), 1, 1)).toBe(0);
  });

  it('long straight runs stay straight (only 0.5 cell is cut at each end, plus the rounding)', () => {
    const bar = [Array.from({ length: 10 }, () => true)];
    expect(longestStraight(maskOutlinePath(bar, CELL), 1, 0)).toBeGreaterThanOrEqual(8 * CELL - 1e-6);
    const circle = REAL[0];
    const staircaseTop = longestStraight(maskOutlinePath(circle.mask, CELL, 'none'), 1, 0);
    expect(longestStraight(maskOutlinePath(circle.mask, CELL), 1, 0)).toBeGreaterThanOrEqual(staircaseTop - 2 * CELL);
  });

  it.each(Object.entries(SYNTHETIC))('%s: closed, no kink, no self-intersection', (_, mask) => {
    const path = maskOutlinePath(mask, CELL);
    for (const sub of commands(path)) expect(sub).toMatch(/^M[LQ]+Z$/);
    for (const [first, last] of explicitEnds(path)) expect(last).toEqual(first);
    expect(maxTurnDegrees(path)).toBeLessThan(20);
    expect(minSelfGap(path)).toBeGreaterThan(1e-6 * CELL);
  });

  it('the diagonal pinch separates into two loops with a clear gap', () => {
    const path = maskOutlinePath(PINCH, CELL);
    expect(commands(path)).toHaveLength(2);
    expect(loopGap(path)).toBeGreaterThan(0.25 * CELL);
  });

  it('holes are contoured too (outer + inner loops)', () => {
    expect(commands(maskOutlinePath(HOLE_1, CELL))).toHaveLength(2);
    expect(commands(maskOutlinePath(REAL[3].mask, CELL))).toHaveLength(2); // Ring
    expect(commands(maskOutlinePath(REAL[4].mask, CELL))).toHaveLength(commands(maskOutlinePath(REAL[4].mask, CELL, 'none')).length); // Butterfly
  });

  it('every distinct v1 shape (and a non-square daily): closed, no kink, no self-intersection', () => {
    expect(ALL_SHAPES.length).toBeGreaterThanOrEqual(20);
    for (const [name, mask] of ALL_SHAPES) {
      const path = maskOutlinePath(mask, CELL);
      for (const [first, last] of explicitEnds(path)) expect([name, last]).toEqual([name, first]);
      expect([name, maxTurnDegrees(path) < 20]).toEqual([name, true]);
      expect([name, minSelfGap(path, 4) > 1e-6 * CELL]).toEqual([name, true]);
    }
  });

  it.each([...Object.entries(SYNTHETIC), ['STAIR_6', STAIR_6] as const, ...REAL.map((l) => [l.shapeName, l.mask] as const)])(
    '%s: stays within 0.5 cell of the staircase both ways (sampled)', (_, mask) => {
      const staircase = maskOutlinePath(mask, CELL, 'none');
      const contour = maskOutlinePath(mask, CELL);
      expect(maxDeviation(contour, staircase)).toBeLessThanOrEqual(0.5 * CELL);
      expect(maxDeviation(staircase, contour)).toBeLessThanOrEqual(0.5 * CELL);
    });

  it('is deterministic and prints at most 3 decimals', () => {
    for (const level of REAL) {
      const path = maskOutlinePath(level.mask, CELL);
      expect(maskOutlinePath(level.mask.map((row) => [...row]), CELL)).toBe(path);
      expect(path).not.toMatch(/\d\.\d{4,}/);
    }
  });
});

describe('W5-17 + W2-06 timeline, owner set B, pause 150 ms with the outline (owner ruling 2026-10-06 (a))', () => {
  it('pause 150 ms before a drawn outline, outline slot 400 ms; W2-06 alone keeps its 250 ms hold', () => {
    expect(CLEAR_REVEAL_HOLD_MS).toBe(150);
    expect(CLEAR_REVEAL_MS).toBe(400);
    expect(EMPTY_BOARD_HOLD_MS).toBe(250);
    expect(emptyBoardHoldMs(CLEAR_REVEAL_MS)).toBe(150);
    expect(emptyBoardHoldMs(0)).toBe(250);
  });

  it('the panel: exit + 150 + 400 (default board-edge exit 244 ms -> 794 ms; screen-edge 90..187 ms -> 640..737 ms)', () => {
    const slot = clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[true]] });
    expect(wonPanelDelayMs(244, emptyBoardHoldMs(slot), slot)).toBe(794);
    expect(wonPanelDelayMs(90, emptyBoardHoldMs(slot), slot)).toBe(640);
    expect(wonPanelDelayMs(187, emptyBoardHoldMs(slot), slot)).toBe(737);
  });

  it('the outline starts at exit + 150, exactly CLEAR_REVEAL_MS before the panel (BoardView and GameScreen agree)', () => {
    const slot = clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[true]] });
    for (const exit of [0, 90, 187, 244, 320]) {
      expect(clearRevealStartMs(exit)).toBe(exit + 150);
      expect(wonPanelDelayMs(exit, emptyBoardHoldMs(slot), slot) - clearRevealStartMs(exit)).toBe(CLEAR_REVEAL_MS);
    }
    expect(clearRevealStartMs(Number.NaN)).toBe(150);
    expect(clearRevealStartMs(-5)).toBe(150);
  });

  it('no outline, no slot: flag OFF, reduced motion (nothing is mounted), or an empty outline (tutorial boards)', () => {
    expect(clearRevealSlotMs({ enabled: false, reducedMotion: false, mask: [[true]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: true, mask: [[true]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[false, false]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[false, true]] })).toBe(CLEAR_REVEAL_MS);
    // the slot is spent exactly when maskOutlinePath draws something
    for (const mask of [[], [[false]], [[true]], [[false, true], [false, false]]]) {
      expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask }) > 0).toBe(maskOutlinePath(mask, CELL) !== '');
    }
  });
});

describe('clearRevealRemainingMs: the outline keeps the tap clock', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clearRevealRemainingMs } = require('../clearRevealTiming') as typeof import('../clearRevealTiming');
  it('a node that mounts late only waits what is left of the delay, never less than 0', () => {
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 1000)).toBe(494);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 1150)).toBe(344);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 2000)).toBe(0);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 900)).toBe(494); // clock went back: full delay
  });
});

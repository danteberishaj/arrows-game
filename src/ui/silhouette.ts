import { CLEAR_REVEAL_CORNER_RADIUS_CELLS } from './artConfig';

type GridPoint = readonly [x: number, y: number];

interface BoundaryEdge {
  readonly start: GridPoint;
  readonly end: GridPoint;
}

const RIGHT_TURN_PRIORITY = [1, 0, 3, 2] as const;

function pointKey([x, y]: GridPoint): string {
  return `${x},${y}`;
}

function edgeDirection(edge: BoundaryEdge): number {
  const dx = edge.end[0] - edge.start[0];
  const dy = edge.end[1] - edge.start[1];
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

function nextEdge(
  current: BoundaryEdge,
  candidates: readonly BoundaryEdge[],
): BoundaryEdge {
  if (candidates.length === 1) return candidates[0];

  const currentDirection = edgeDirection(current);
  for (const turn of RIGHT_TURN_PRIORITY) {
    const direction = (currentDirection + turn) % 4;
    const match = candidates.find((candidate) => edgeDirection(candidate) === direction);
    if (match !== undefined) return match;
  }

  throw new Error('Silhouette boundary has no continuation');
}

function mergeCollinear(points: readonly GridPoint[]): GridPoint[] {
  if (points.length <= 3) return [...points];

  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const incomingX = point[0] - previous[0];
    const incomingY = point[1] - previous[1];
    const outgoingX = next[0] - point[0];
    const outgoingY = next[1] - point[1];
    return incomingX * outgoingY !== incomingY * outgoingX;
  });
}

function traceLoops(edges: readonly BoundaryEdge[]): GridPoint[][] {
  const outgoing = new Map<string, BoundaryEdge[]>();
  for (const edge of edges) {
    const key = pointKey(edge.start);
    const atPoint = outgoing.get(key);
    if (atPoint === undefined) outgoing.set(key, [edge]);
    else atPoint.push(edge);
  }

  const unused = new Set(edges);
  const loops: GridPoint[][] = [];
  for (const first of edges) {
    if (!unused.has(first)) continue;

    const points: GridPoint[] = [first.start];
    let current = first;
    while (true) {
      unused.delete(current);
      if (pointKey(current.end) === pointKey(first.start)) break;

      points.push(current.end);
      const candidates = (outgoing.get(pointKey(current.end)) ?? [])
        .filter((candidate) => unused.has(candidate));
      if (candidates.length === 0) throw new Error('Silhouette boundary is not closed');
      current = nextEdge(current, candidates);
    }

    loops.push(mergeCollinear(points));
  }

  return loops;
}

/** The cell-boundary edges of a mask's filled cells, in cell units, and the mask's size. */
function maskEdges(mask: readonly (readonly boolean[])[]): { edges: BoundaryEdge[]; rows: number; cols: number } {
  const rows = mask.length;
  const cols = mask.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const edges: BoundaryEdge[] = [];
  if (rows === 0 || cols === 0) return { edges, rows, cols };

  const filled = (row: number, col: number): boolean => (
    row >= 0
    && row < rows
    && col >= 0
    && col < cols
    && (mask[row]?.[col] ?? false)
  );

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filled(row, col)) continue;
      if (!filled(row - 1, col)) edges.push({ start: [col, row], end: [col + 1, row] });
      if (!filled(row, col + 1)) edges.push({ start: [col + 1, row], end: [col + 1, row + 1] });
      if (!filled(row + 1, col)) edges.push({ start: [col + 1, row + 1], end: [col, row + 1] });
      if (!filled(row, col - 1)) edges.push({ start: [col, row + 1], end: [col, row] });
    }
  }
  return { edges, rows, cols };
}

function loopsPath(edges: readonly BoundaryEdge[], coordinate: (point: GridPoint) => string): string {
  return traceLoops(edges)
    .map((loop) => `M ${coordinate(loop[0])} ${loop.slice(1).map((point) => `L ${coordinate(point)}`).join(' ')} Z`)
    .join(' ');
}

/**
 * Converts filled mask cells into centred SVG boundary loops. Consumers must
 * render the returned path with the even-odd fill rule so holes stay open.
 */
export function silhouettePath(
  mask: readonly (readonly boolean[])[],
  size: number,
): string {
  const { edges, rows, cols } = maskEdges(mask);
  if (edges.length === 0) return '';

  const cell = size / Math.max(rows, cols);
  const offsetX = (size - cols * cell) / 2;
  const offsetY = (size - rows * cell) / 2;
  const insideBox = (value: number): number => Math.min(size, Math.max(0, value));
  return loopsPath(edges, ([x, y]) => `${insideBox(offsetX + x * cell)} ${insideBox(offsetY + y * cell)}`);
}

/** 4/3 (sqrt 2 - 1): a cubic's control-arm length for a quarter circle of radius 1 (radial error at most 0.027 %). */
const QUARTER_CIRCLE_KAPPA = (4 / 3) * (Math.SQRT2 - 1);

/** Board-space coordinates printed to 3 decimals: short, and the same string for the same mask on every platform. */
function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

/**
 * One staircase loop with every corner replaced by a circular fillet (a cubic quarter circle) of radius
 * min(radiusCells, half of each adjacent run). A run is shared by its two end corners and each takes at most half of
 * it, so neighbouring fillets can meet but never overlap. Each fillet stays inside the r x r square at its corner on
 * the turning side, i.e. inside a filled cell (convex) or an empty cell (concave), so fillets of different corners,
 * loops or holes never meet either (two loops through one grid point both turn right there, see nextEdge: both
 * corners are convex and pull apart).
 */
function roundedLoopPath(loop: readonly GridPoint[], cell: number, radiusCells: number): string {
  const n = loop.length;
  const at = (i: number): GridPoint => loop[((i % n) + n) % n];
  const runLength = (i: number): number => Math.abs(at(i + 1)[0] - at(i)[0]) + Math.abs(at(i + 1)[1] - at(i)[1]);
  const unit = (from: GridPoint, to: GridPoint): GridPoint => {
    const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  };
  const point = (x: number, y: number): string => `${formatCoordinate(x * cell)} ${formatCoordinate(y * cell)}`;

  const corners = loop.map((corner, i) => {
    const radius = Math.min(radiusCells, runLength(i - 1) / 2, runLength(i) / 2);
    const [inX, inY] = unit(at(i - 1), corner);
    const [outX, outY] = unit(corner, at(i + 1));
    const arm = radius * QUARTER_CIRCLE_KAPPA;
    const startX = corner[0] - radius * inX;
    const startY = corner[1] - radius * inY;
    const endX = corner[0] + radius * outX;
    const endY = corner[1] + radius * outY;
    return {
      start: point(startX, startY),
      curve: `C ${point(startX + arm * inX, startY + arm * inY)} ${point(endX - arm * outX, endY - arm * outY)} `
        + point(endX, endY),
      end: point(endX, endY),
    };
  });

  const parts = [`M ${corners[0].end}`];
  for (let k = 1; k <= n; k++) {
    const corner = corners[k % n];
    if (corner.start !== corners[k - 1].end) parts.push(`L ${corner.start}`);
    parts.push(corner.curve);
  }
  return `${parts.join(' ')} Z`;
}

/**
 * W5-17: the same boundary loops in BOARD space, not centred: grid point (x, y) maps to (x * cell, y * cell), so cell
 * (r, c) spans c..c+1 by r..r+1 cells, exactly where the board draws that cell's arrow (arrowGeometry.ts centres a cell
 * at (c + 0.5, r + 0.5) cells). A mask with no filled cell (tutorial boards) returns ''.
 * Owner ruling 2026-10-06 (b): every corner, convex or concave, on the outer contours and on holes, is a circular
 * fillet of `radiusCells` (clamped to half of each adjacent run; see roundedLoopPath), drawn as M / L / C / Z. Each
 * loop ends exactly at its start point. `radiusCells` <= 0 returns the W5-17 staircase (M / L / Z on the grid).
 */
export function maskOutlinePath(
  mask: readonly (readonly boolean[])[],
  cell: number,
  radiusCells: number = CLEAR_REVEAL_CORNER_RADIUS_CELLS,
): string {
  const { edges } = maskEdges(mask);
  if (edges.length === 0) return '';
  if (!(radiusCells > 0)) return loopsPath(edges, ([x, y]) => `${x * cell} ${y * cell}`);
  return traceLoops(edges).map((loop) => roundedLoopPath(loop, cell, radiusCells)).join(' ');
}

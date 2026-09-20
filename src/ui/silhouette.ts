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

/**
 * Converts filled mask cells into centred SVG boundary loops. Consumers must
 * render the returned path with the even-odd fill rule so holes stay open.
 */
export function silhouettePath(
  mask: readonly (readonly boolean[])[],
  size: number,
): string {
  const rows = mask.length;
  const cols = mask.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (rows === 0 || cols === 0) return '';

  const filled = (row: number, col: number): boolean => (
    row >= 0
    && row < rows
    && col >= 0
    && col < cols
    && (mask[row]?.[col] ?? false)
  );

  const edges: BoundaryEdge[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filled(row, col)) continue;
      if (!filled(row - 1, col)) edges.push({ start: [col, row], end: [col + 1, row] });
      if (!filled(row, col + 1)) edges.push({ start: [col + 1, row], end: [col + 1, row + 1] });
      if (!filled(row + 1, col)) edges.push({ start: [col + 1, row + 1], end: [col, row + 1] });
      if (!filled(row, col - 1)) edges.push({ start: [col, row + 1], end: [col, row] });
    }
  }
  if (edges.length === 0) return '';

  const cell = size / Math.max(rows, cols);
  const offsetX = (size - cols * cell) / 2;
  const offsetY = (size - rows * cell) / 2;
  const insideBox = (value: number): number => Math.min(size, Math.max(0, value));
  const coordinate = ([x, y]: GridPoint): string => (
    `${insideBox(offsetX + x * cell)} ${insideBox(offsetY + y * cell)}`
  );

  return traceLoops(edges)
    .map((loop) => `M ${coordinate(loop[0])} ${loop.slice(1).map((point) => `L ${coordinate(point)}`).join(' ')} Z`)
    .join(' ');
}

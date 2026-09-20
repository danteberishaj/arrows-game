import { ShapeDef, ShapeLibrary } from '../../core/shapeLibrary';
import { silhouettePath } from '../silhouette';

type Point = readonly [number, number];

function allShapes(): readonly ShapeDef[] {
  const byName = new Map<string, ShapeDef>();
  const pools = [
    ShapeLibrary.SimplePool,
    ShapeLibrary.MediumPool,
    ShapeLibrary.ComplexPool,
  ];

  for (const pool of pools) {
    for (const shape of pool) byName.set(shape.name, shape);
  }

  return [...byName.values()];
}

function parseLoops(path: string): Point[][] {
  const tokens = path.match(/[MLZ]|-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const loops: Point[][] = [];
  let current: Point[] | null = null;

  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++].toUpperCase();
    if (command === 'Z') {
      if (current === null) throw new Error('Z without an open loop');
      loops.push(current);
      current = null;
      continue;
    }
    if (command !== 'M' && command !== 'L') throw new Error(`Unexpected token: ${command}`);

    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid path coordinate');
    if (command === 'M') {
      if (current !== null) throw new Error('M before closing the previous loop');
      current = [[x, y]];
    } else {
      if (current === null) throw new Error('L without an open loop');
      current.push([x, y]);
    }
  }

  if (current !== null) throw new Error('Unclosed loop');
  return loops;
}

function pointInPolygon([x, y]: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [currentX, currentY] = polygon[current];
    const [previousX, previousY] = polygon[previous];
    if (
      (currentY > y) !== (previousY > y)
      && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInEvenOddPath(point: Point, loops: readonly (readonly Point[])[]): boolean {
  let inside = false;
  for (const loop of loops) {
    if (pointInPolygon(point, loop)) inside = !inside;
  }
  return inside;
}

function expectPathToReproduceMask(mask: readonly (readonly boolean[])[]): void {
  const rows = mask.length;
  const cols = Math.max(...mask.map((row) => row.length));
  const size = Math.max(rows, cols);
  const cell = size / Math.max(rows, cols);
  const offsetX = (size - cols * cell) / 2;
  const offsetY = (size - rows * cell) / 2;
  const loops = parseLoops(silhouettePath(mask, size));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const centre: Point = [
        offsetX + (col + 0.5) * cell,
        offsetY + (row + 0.5) * cell,
      ];
      expect(pointInEvenOddPath(centre, loops)).toBe(mask[row]?.[col] ?? false);
    }
  }
}

test('all generator shapes round-trip through an even-odd silhouette path', () => {
  const shapes = allShapes();
  expect(new Set(shapes.map((shape) => shape.name)).size).toBe(26);

  for (const shape of shapes) {
    for (const [rows, cols] of [[20, 20], [37, 37], [46, 31]] as const) {
      expectPathToReproduceMask(shape.rasterize(rows, cols));
    }
  }
});

test('a ring emits an outer loop and a hole', () => {
  const ring = [
    [true, true, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, true],
  ];
  const path = silhouettePath(ring, ring.length);
  const loops = parseLoops(path);

  expect((path.match(/M/g) ?? []).length).toBe(2);
  expect(pointInEvenOddPath([ring.length / 2, ring.length / 2], loops)).toBe(false);
  expectPathToReproduceMask(ring);
});

test('a full rectangular mask merges each side into one edge', () => {
  const mask = [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ];
  const path = silhouettePath(mask, mask.length);
  const loops = parseLoops(path);

  expect(loops).toHaveLength(1);
  expect(loops[0]).toHaveLength(4);
});

test('cells touching only at a corner remain separate closed loops', () => {
  const mask = [
    [true, false],
    [false, true],
  ];
  const loops = parseLoops(silhouettePath(mask, mask.length));

  expect(loops).toHaveLength(2);
  expect(loops.every((loop) => loop.length === 4)).toBe(true);
  expectPathToReproduceMask(mask);
});

test('empty and all-false masks have no path', () => {
  expect(silhouettePath([], 24)).toBe('');
  expect(silhouettePath([[false, false], [false]], 24)).toBe('');
});

test('all generated coordinates are finite and stay inside the requested box', () => {
  const size = Math.SQRT2;

  for (const shape of allShapes()) {
    for (const [rows, cols] of [[20, 20], [37, 37], [46, 31]] as const) {
      const path = silhouettePath(shape.rasterize(rows, cols), size);
      expect(path).not.toContain('NaN');
      for (const loop of parseLoops(path)) {
        for (const coordinate of loop.flat()) {
          expect(Number.isFinite(coordinate)).toBe(true);
          expect(coordinate).toBeGreaterThanOrEqual(0);
          expect(coordinate).toBeLessThanOrEqual(size);
        }
      }
    }
  }
});

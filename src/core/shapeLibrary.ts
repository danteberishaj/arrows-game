import { Difficulty } from './difficulty';
import { DotNetRandom } from './dotnetRandom';

type InsideFn = (nx: number, ny: number) => boolean;
type Pt = readonly [number, number];

/**
 * A scalable shape silhouette. {@link ShapeDef.inside} answers "is this
 * normalized point part of the shape?" in a coordinate space where x and y
 * run -1..+1 (x right, y UP), so the same definition rasterizes cleanly to
 * any board size. {@link ShapeDef.rasterize} samples it into a rows x cols
 * boolean mask (true = a cell that should be filled with arrows).
 *
 * Ported from Assets/_Game/Scripts/Core/ShapeLibrary.cs.
 */
export class ShapeDef {
  readonly name: string;
  /** Simple shapes (square/rect/circle) feed Normal+Hard; complex ones feed SuperHard. */
  readonly simple: boolean;
  /** Preferred cols/rows. 1 = square, >1 = wide, <1 = tall. */
  readonly aspect: number;
  /** When true the shape is the whole rectangle (no margin) — square/rectangle. */
  readonly fillsGrid: boolean;

  private readonly _inside: InsideFn;

  constructor(name: string, simple: boolean, aspect: number, fillsGrid: boolean, inside: InsideFn) {
    this.name = name;
    this.simple = simple;
    this.aspect = aspect;
    this.fillsGrid = fillsGrid;
    this._inside = inside;
  }

  inside(nx: number, ny: number): boolean {
    return this._inside(nx, ny);
  }

  /**
   * Samples the shape into a rows x cols mask. Each cell is tested at a 2x2
   * set of sub-points and kept if at least half are inside, which smooths the
   * silhouette edge so small boards still read as the intended shape.
   */
  rasterize(rows: number, cols: number): boolean[][] {
    const mask: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let hit = 0;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const fx = (c + (sx + 0.5) / 2) / cols; // 0..1 across
            const fy = (r + (sy + 0.5) / 2) / rows; // 0..1 down
            const nx = fx * 2 - 1;
            const ny = 1 - fy * 2; // +y points up
            if (this._inside(nx, ny)) hit++;
          }
        }
        mask[r][c] = hit >= 2;
      }
    }
    return mask;
  }
}

// ---- Geometry helpers -------------------------------------------------------

// Even-odd ray-cast point-in-polygon test.
function pointInPolygon(x: number, y: number, v: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    if ((v[i][1] > y) !== (v[j][1] > y) &&
        x < ((v[j][0] - v[i][0]) * (y - v[i][1])) / (v[j][1] - v[i][1]) + v[i][0]) {
      inside = !inside;
    }
  }
  return inside;
}

function polygon(...verts: Pt[]): InsideFn {
  return (x, y) => pointInPolygon(x, y, verts);
}

function regularPolygon(sides: number, radius: number, startDeg: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((startDeg + (i * 360) / sides) * Math.PI) / 180;
    pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return pts;
}

function starPolygon(points: number, outer: number, inner: number, startDeg: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const a = ((startDeg + (i * 180) / points) * Math.PI) / 180;
    pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return pts;
}

/**
 * The catalogue of shapes the generator draws with, plus helpers to pick one
 * for a difficulty tier. Shapes are defined as point-in-polygon tests or
 * implicit inequalities in normalized space, so they scale to any board
 * without bitmaps.
 */
export const ShapeLibrary = (() => {
  // ---- Simple pool (Normal + Hard): square, rectangle, circle -----------------

  const Square = new ShapeDef('Square', true, 1, true, () => true);
  const Rectangle = new ShapeDef('Rectangle', true, 1.5, true, () => true);
  const Circle = new ShapeDef('Circle', true, 1, false, (x, y) => x * x + y * y <= 0.92 * 0.92);

  // ---- Complex pool (SuperHard): heart, star, diamond, triangle, plus, hex, trophy ---

  const Diamond = new ShapeDef('Diamond', false, 1, false,
    (x, y) => Math.abs(x) + Math.abs(y) <= 0.94);

  const Triangle = new ShapeDef('Triangle', false, 1, false,
    polygon([0, 0.9], [0.86, -0.82], [-0.86, -0.82]));

  const Plus = new ShapeDef('Plus', false, 1, false,
    (x, y) => (Math.abs(x) <= 0.34 && Math.abs(y) <= 0.92)
           || (Math.abs(y) <= 0.34 && Math.abs(x) <= 0.92));

  const Hexagon = new ShapeDef('Hexagon', false, 1, false,
    polygon(...regularPolygon(6, 0.95, 90)));

  const Star = new ShapeDef('Star', false, 1, false,
    polygon(...starPolygon(5, 0.98, 0.42, 90)));

  // Classic implicit heart (x^2+y^2-1)^3 - x^2 y^3 <= 0, rescaled/shifted to
  // fit -1..1 with the cusp at the top and the point at the bottom.
  const Heart = new ShapeDef('Heart', false, 1, false, (x, y) => {
    const X = x / 0.92;
    const Y = (y + 0.28) / 0.92;
    const a = X * X + Y * Y - 1;
    return a * a * a - X * X * Y * Y * Y <= 0;
  });

  // Trophy silhouette: a bowl on a stem on a base (handles implied, not cut
  // out), drawn as one outline. Slightly taller than wide.
  const Trophy = new ShapeDef('Trophy', false, 0.85, false,
    polygon(
      [-0.52, 0.86], [0.52, 0.86],    // cup rim
      [0.50, 0.50], [0.34, 0.16],     // bowl curves in
      [0.16, 0.04], [0.16, -0.34],    // down the stem
      [0.44, -0.46], [0.44, -0.72],   // right side of the base
      [-0.44, -0.72], [-0.44, -0.46], // left side of the base
      [-0.16, -0.34], [-0.16, 0.04],  // up the stem
      [-0.34, 0.16], [-0.50, 0.50])); // bowl back to the rim

  const SimplePool: readonly ShapeDef[] = [Square, Rectangle, Circle];
  const ComplexPool: readonly ShapeDef[] = [Heart, Star, Diamond, Triangle, Plus, Hexagon, Trophy];

  return {
    Square, Rectangle, Circle,
    Diamond, Triangle, Plus, Hexagon, Star, Heart, Trophy,
    SimplePool, ComplexPool,

    /** Picks a shape for the tier: SuperHard draws a complex silhouette, the rest a simple one. */
    pick(difficulty: Difficulty, rng: DotNetRandom): ShapeDef {
      const pool = difficulty === Difficulty.SuperHard ? ComplexPool : SimplePool;
      return pool[rng.next(pool.length)];
    },
  };
})();

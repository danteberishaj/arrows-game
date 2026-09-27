import { Difficulty } from './difficulty';
import { DotNetRandom } from './dotnetRandom';

type InsideFn = (nx: number, ny: number) => boolean;
type Pt = readonly [number, number];

const PINE_TOP: readonly Pt[] = [[0, 0.95], [0.55, 0.25], [-0.55, 0.25]];
const PINE_LOWER: readonly Pt[] = [[0, 0.5], [0.8, -0.45], [-0.8, -0.45]];
const HOUSE_ROOF: readonly Pt[] = [[-0.96, 0.1], [0, 0.95], [0.96, 0.1]];

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
  /** Preferred cols/rows. 1 = square, >1 = wide, <1 = tall. */
  readonly aspect: number;

  private readonly _inside: InsideFn;

  constructor(name: string, aspect: number, inside: InsideFn) {
    this.name = name;
    this.aspect = aspect;
    this._inside = inside;
  }

  inside(nx: number, ny: number): boolean {
    return this._inside(nx, ny);
  }

  /**
   * Samples the shape into a rows x cols mask. Each cell is tested at a 3x3
   * set of sub-points and kept if at least half are inside, which smooths the
   * silhouette edge so boards read as the intended shape (finer than the
   * original 2x2 — thin features like a crescent's horns stay clean).
   */
  rasterize(rows: number, cols: number): boolean[][] {
    const mask: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let hit = 0;
        for (let sy = 0; sy < 3; sy++) {
          for (let sx = 0; sx < 3; sx++) {
            const fx = (c + (sx + 0.5) / 3) / cols; // 0..1 across
            const fy = (r + (sy + 0.5) / 3) / rows; // 0..1 down
            const nx = fx * 2 - 1;
            const ny = 1 - fy * 2; // +y points up
            if (this._inside(nx, ny)) hit++;
          }
        }
        mask[r][c] = hit >= 5;
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

  const Square = new ShapeDef('Square', 1, () => true);
  const Rectangle = new ShapeDef('Rectangle', 1.5, () => true);
  const Circle = new ShapeDef('Circle', 1, (x, y) => x * x + y * y <= 0.92 * 0.92);

  // ---- Complex pool (SuperHard): heart, star, diamond, triangle, plus, hex, trophy ---

  const Diamond = new ShapeDef('Diamond', 1, (x, y) => Math.abs(x) + Math.abs(y) <= 0.94);

  const Triangle = new ShapeDef('Triangle', 1, polygon([0, 0.9], [0.86, -0.82], [-0.86, -0.82]));

  const Plus = new ShapeDef('Plus', 1, (x, y) => (Math.abs(x) <= 0.34 && Math.abs(y) <= 0.92)
           || (Math.abs(y) <= 0.34 && Math.abs(x) <= 0.92));

  const Hexagon = new ShapeDef('Hexagon', 1, polygon(...regularPolygon(6, 0.95, 90)));

  const Star = new ShapeDef('Star', 1, polygon(...starPolygon(5, 0.98, 0.42, 90)));

  // Classic implicit heart (x^2+y^2-1)^3 - x^2 y^3 <= 0, rescaled/shifted to
  // fit -1..1 with the cusp at the top and the point at the bottom.
  const Heart = new ShapeDef('Heart', 1, (x, y) => {
    const X = x / 0.92;
    const Y = (y + 0.28) / 0.92;
    const a = X * X + Y * Y - 1;
    return a * a * a - X * X * Y * Y * Y <= 0;
  });

  // Trophy silhouette: a bowl on a stem on a base (handles implied, not cut
  // out), drawn as one outline. Slightly taller than wide.
  const Trophy = new ShapeDef('Trophy', 0.85, polygon(
    [-0.52, 0.86], [0.52, 0.86],    // cup rim
    [0.50, 0.50], [0.34, 0.16],     // bowl curves in
    [0.16, 0.04], [0.16, -0.34],    // down the stem
    [0.44, -0.46], [0.44, -0.72],   // right side of the base
    [-0.44, -0.72], [-0.44, -0.46], // left side of the base
    [-0.16, -0.34], [-0.16, 0.04],  // up the stem
    [-0.34, 0.16], [-0.50, 0.50])); // bowl back to the rim

  // Crescent moon (very Ink Night): a full disc with a second disc bitten out
  // of its upper right. The bite is kept shallow so the horns stay thick
  // enough to pack cleanly with arrows.
  const Crescent = new ShapeDef('Crescent', 1, (x, y) => {
    const inDisc = x * x + y * y <= 0.92 * 0.92;
    const bx = x - 0.42, by = y - 0.2;
    const inBite = bx * bx + by * by <= 0.72 * 0.72;
    return inDisc && !inBite;
  });

  // Four-petal flower: the union of four petal discs and a core disc.
  const Flower = new ShapeDef('Flower', 1, (x, y) => {
    const rightX = x - 0.47;
    const leftX = x + 0.47;
    const topY = y - 0.47;
    const bottomY = y + 0.47;
    return (
      x * x + y * y <= 0.34 * 0.34 ||
      rightX * rightX + y * y <= 0.4 * 0.4 ||
      leftX * leftX + y * y <= 0.4 * 0.4 ||
      x * x + topY * topY <= 0.4 * 0.4 ||
      x * x + bottomY * bottomY <= 0.4 * 0.4
    );
  });

  // Lightning bolt, the classic zig-zag hexagon. Taller than wide.
  const Bolt = new ShapeDef('Bolt', 0.8, polygon(
    [0.3, 0.95], [-0.42, 0.05], [-0.06, 0.05],
    [-0.3, -0.95], [0.42, -0.02], [0.06, -0.02]));

  // An upward arrow drawn out of arrows. Of course.
  const ArrowMark = new ShapeDef('Arrow', 0.9, polygon(
    [0, 0.95], [0.66, 0.24], [0.26, 0.24],
    [0.26, -0.9], [-0.26, -0.9], [-0.26, 0.24], [-0.66, 0.24]));

  // Three-peak crown over a band.
  const Crown = new ShapeDef('Crown', 1.15, polygon(
    [-0.78, -0.8], [0.78, -0.8], [0.78, 0.58],
    [0.39, -0.05], [0, 0.72], [-0.39, -0.05], [-0.78, 0.58]));

  // Hourglass: two triangles meeting at a narrow waist.
  const Hourglass = new ShapeDef('Hourglass', 0.8, (x, y) => {
    const ay = Math.abs(y);
    if (ay > 0.88) return false;
    return Math.abs(x) <= 0.14 + (0.66 * ay) / 0.88;
  });

  const Pentagon = new ShapeDef('Pentagon', 1, polygon(...regularPolygon(5, 0.95, 90)));

  const Octagon = new ShapeDef('Octagon', 1, polygon(...regularPolygon(8, 0.95, 22.5)));

  // Ring: a thick annulus — the hole is fine, the peel rule fills any mask.
  const Ring = new ShapeDef('Ring', 1, (x, y) => {
    const r2 = x * x + y * y;
    return r2 <= 0.95 * 0.95 && r2 >= 0.5 * 0.5;
  });

  // X: two diagonal bars.
  const XMark = new ShapeDef('X', 1, (x, y) => {
    if (Math.abs(x) > 0.92 || Math.abs(y) > 0.92) return false;
    return Math.abs(x - y) <= 0.3 || Math.abs(x + y) <= 0.3;
  });

  // Butterfly: two wing discs per side + a body bar.
  const Butterfly = new ShapeDef('Butterfly', 1.1, (x, y) => {
    const upperY = y - 0.34;
    const lowerY = y + 0.4;
    const rightUpperX = x - 0.5;
    const leftUpperX = x + 0.5;
    const rightLowerX = x - 0.42;
    const leftLowerX = x + 0.42;
    return (
      (Math.abs(x) <= 0.12 && Math.abs(y) <= 0.7) ||
      rightUpperX * rightUpperX + upperY * upperY <= 0.42 * 0.42 ||
      leftUpperX * leftUpperX + upperY * upperY <= 0.42 * 0.42 ||
      rightLowerX * rightLowerX + lowerY * lowerY <= 0.34 * 0.34 ||
      leftLowerX * leftLowerX + lowerY * lowerY <= 0.34 * 0.34
    );
  });

  // Rocket with side fins. Tall.
  const Rocket = new ShapeDef('Rocket', 0.75, polygon(
    [0, 0.95], [0.42, 0.3], [0.42, -0.5], [0.8, -0.82], [0.8, -0.95],
    [0.3, -0.82], [-0.3, -0.82], [-0.8, -0.95], [-0.8, -0.82],
    [-0.42, -0.5], [-0.42, 0.3]));

  // Pine tree: two stacked canopy triangles over a trunk.
  const Pine = new ShapeDef('Pine', 0.9, (x, y) => {
    return (
      pointInPolygon(x, y, PINE_TOP) ||
      pointInPolygon(x, y, PINE_LOWER) ||
      (Math.abs(x) <= 0.14 && y >= -0.95 && y <= -0.45)
    );
  });

  // Cat head: a round face with two triangular ears (and a dip between them).
  const Cat = new ShapeDef('Cat', 1, (x, y) => {
    if (x * x + (y + 0.18) * (y + 0.18) <= 0.66 * 0.66) return true;
    const ax = Math.abs(x);
    return pointInPolygon(ax, y, [[0.66, 0.1], [0.5, 0.95], [0.16, 0.42]]);
  });

  // Mushroom: a dome cap over a stout stem.
  const Mushroom = new ShapeDef('Mushroom', 0.95, (x, y) => {
    const inCap = x * x + (y - 0.02) * (y - 0.02) <= 0.9 * 0.9 && y >= 0.08;
    const inStem = Math.abs(x) <= 0.3 && y >= -0.82 && y <= 0.16;
    return inCap || inStem;
  });

  // Fish: an ellipse body with a triangular tail. Wide.
  const Fish = new ShapeDef('Fish', 1.2, (x, y) => {
    const bx = (x + 0.24) / 0.7, by = y / 0.62;
    if (bx * bx + by * by <= 1) return true;
    return pointInPolygon(x, y, [[0.3, 0], [0.94, 0.66], [0.94, -0.66]]);
  });

  // ---- W3-18: shapes authored after v1 ------------------------------------
  // In no tier pool: v1 never deals them. Generator v2 deals one only once the
  // owner's recognition test (W3-19) passes and its id joins
  // V2_ADMITTED_SHAPE_IDS (shapeCatalogue.ts). High fill first, so each stays
  // admissible at the curve's saturated end (capacity >= 635 cells at the v2
  // clamp, `npm run analysis:shape -- --all`).

  // House: a gabled roof whose eaves overhang the walls, a chimney on the
  // right slope, and a door cut into the base.
  const House = new ShapeDef('House', 1, (x, y) => {
    if (pointInPolygon(x, y, HOUSE_ROOF)) return true;
    if (x >= 0.36 && x <= 0.66 && y >= 0.2 && y <= 0.76) return true; // chimney
    if (Math.abs(x) > 0.72 || y < -0.93 || y > 0.12) return false; // walls
    return !(Math.abs(x) <= 0.18 && y <= -0.36); // door
  });

  // Teacup: a bowl that narrows to its foot, a ring handle on the right, and a
  // flat saucer underneath. Slightly wide.
  const Teacup = new ShapeDef('Teacup', 1.1, (x, y) => {
    if (y <= 0.78 && y >= -0.5) {
      // Bowl: half-width 0.68 at the rim easing in to 0.42 at the foot.
      const t = (0.78 - y) / 1.28;
      if (Math.abs(x + 0.14) <= 0.68 - 0.26 * t * t) return true;
    }
    const hx = x - 0.5, hy = y - 0.22;
    const r2 = hx * hx + hy * hy;
    if (x > -0.14 && r2 <= 0.4 * 0.4 && r2 >= 0.19 * 0.19) return true; // handle
    const sx = x / 0.96, sy = (y + 0.72) / 0.2;
    return sx * sx + sy * sy <= 1; // saucer
  });

  // Tier pools: Normal learns on plain fills, Hard adds geometric figures,
  // SuperHard draws the picture-book silhouettes.
  const SimplePool: readonly ShapeDef[] = [Square, Rectangle, Circle, Diamond];
  const MediumPool: readonly ShapeDef[] = [
    Circle, Diamond, Triangle, Plus, Hexagon, Hourglass,
    Pentagon, Octagon, Ring, XMark,
  ];
  const ComplexPool: readonly ShapeDef[] = [
    Heart, Star, Trophy, Crescent, Flower, Bolt, ArrowMark, Crown,
    Butterfly, Rocket, Pine, Cat, Mushroom, Fish,
  ];

  return {
    Square, Rectangle, Circle,
    Diamond, Triangle, Plus, Hexagon, Star, Heart, Trophy,
    Crescent, Flower, Bolt, ArrowMark, Crown, Hourglass,
    Pentagon, Octagon, Ring, XMark,
    Butterfly, Rocket, Pine, Cat, Mushroom, Fish,
    House, Teacup,
    SimplePool, MediumPool, ComplexPool,

    /** Picks a shape for the tier: each difficulty draws from its own pool. */
    pick(difficulty: Difficulty, rng: DotNetRandom): ShapeDef {
      const pool =
        difficulty === Difficulty.SuperHard ? ComplexPool
        : difficulty === Difficulty.Hard ? MediumPool
        : SimplePool;
      return pool[rng.next(pool.length)];
    },
  };
})();

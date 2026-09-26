import { FIT_MARGIN } from '../../ui/boardCamera';
import { EMPTY_SHAPE_MASKS, foldLevels } from '../collection';
import { V1_TIER_TEXTURE, V2_CURVE, type CurveTable } from '../curve';
import { dailySeed } from '../dailyBoard';
import { Difficulties } from '../difficulty';
import { DotNetRandom, ExactDotNetRandom } from '../dotnetRandom';
import { LevelGenerator, seed, shapeNameForLevel, type GeneratedLevel } from '../levelGenerator';
import {
  MIN_LEGIBLE_CELL_PT,
  V2_MAX_GRID_COLS,
  V2_MAX_GRID_ROWS,
  bagCandidates,
  bagSeed,
  bagWindowFor,
  curveWindowMaxTarget,
  isClampShortfall,
  pickForLevelV2,
  placeholderWindowMaxTarget,
  shapeCapacity,
  v2GridFor,
  v2MaxRows,
  windowSetAt,
  type WindowMaxTarget,
} from '../shapeBag';
import { RETIRED_SHAPE_IDS, SHAPE_CATALOGUE, catalogueIndexOf, shapeDefFor } from '../shapeCatalogue';
import { ShapeDef } from '../shapeLibrary';

// W3-10: generator v2's capacity-aware shuffled shape bag. W3-14: its windows
// follow the difficulty curve (curve.ts), and the clamp is the owner's W3-09
// pick (at most 37 columns, rows up to 46, aspect kept).
//
// Every expectation here is computed independently of shapeBag.ts where it
// can be: capacity by rasterizing at the clamp, a window's admissible set from
// Difficulties.configV2 over every level of the window, the clamp from each
// board's own rows/cols. The bag's own helpers are only compared against
// those, never used as the oracle.

const V2_LEVELS = 2000; // brief: v2 levels 0-1999
const V1_EQUIVALENCE_LEVELS = 1000; // brief (e): 0-999

/** The owner's W3-09 caps, restated (docs/board-legibility-2026-09-26.md). */
const COLS_CAP = 37;
const ROWS_CAP = 46;

/**
 * The shapes whose capacity at the W3-09 clamp is at least 720 cells (the
 * placeholder bands' max), measured by `difficulty-probe.ts --version 2
 * --capacity` (2026-09-26, W3-14): Square 1369, Heart 1033, Circle 901,
 * Octagon 869, Rectangle 864, Hexagon 809, Pentagon 740, Plus 733; the next,
 * Ring, holds 696. (At W3-10's 46x46 clamp this set was 18 shapes.)
 */
const AT_LEAST_720 = ['Square', 'Rectangle', 'Circle', 'Plus', 'Hexagon', 'Heart', 'Pentagon', 'Octagon'];

function countTrue(mask: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of mask) for (const cell of row) if (cell) n++;
  return n;
}

function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

const independentCapacityCache = new Map<string, number>();

/** The most rows (<= maxRows, >= 8) whose unclamped cols fit maxCols, recomputed here. */
function independentMaxRows(shape: ShapeDef, maxRows = ROWS_CAP, maxCols = COLS_CAP): number {
  let rows = maxRows;
  while (rows > 8 && roundHalfToEven(rows * shape.aspect) > maxCols) rows--;
  return rows;
}

/** Capacity recomputed here: the shape's largest undistorted board under the caps. */
function independentCapacity(shape: ShapeDef, maxRows = ROWS_CAP, maxCols = COLS_CAP): number {
  const key = `${shape.name}@${maxRows}x${maxCols}`;
  let cells = independentCapacityCache.get(key);
  if (cells === undefined) {
    const rows = independentMaxRows(shape, maxRows, maxCols);
    const cols = Math.min(maxCols, Math.max(4, roundHalfToEven(rows * shape.aspect)));
    cells = countTrue(shape.rasterize(rows, cols));
    independentCapacityCache.set(key, cells);
  }
  return cells;
}

function def(id: string): ShapeDef {
  const shape = shapeDefFor(id);
  if (shape === null) throw new Error(`no ShapeDef for ${id}`);
  return shape;
}

/** Largest cell target any level in [start, end) can draw under v1's tier bands. */
function bandMax(start: number, end: number): number {
  let max = 0;
  for (let i = start; i < end; i++) max = Math.max(max, Difficulties.config(Difficulties.forLevel(i)).maxCells);
  return max;
}

/** Largest cell target any level in [start, end) draws on `curve`: every level read (no last-cycle shortcut). */
function curveMax(start: number, end: number, curve: CurveTable = V2_CURVE): number {
  let max = 0;
  for (let i = start; i < end; i++) max = Math.max(max, Difficulties.configV2(Difficulties.forLevel(i), i, curve).maxCells);
  return max;
}

/** Everything a player can see about a board, plus its mask and target, as text. */
function serialize(level: GeneratedLevel): string {
  const lines = [
    level.shapeName,
    String(level.board.rows),
    String(level.board.cols),
    String(level.arrowCount),
    String(level.hearts),
    String(level.difficulty),
    String(level.targetCells),
    ...level.mask.map((row) => row.map((cell) => (cell ? '#' : '.')).join('')),
  ];
  for (const arrow of level.board.arrows()) lines.push(arrow.toLine());
  return lines.join('\n');
}

interface V2Row {
  readonly index: number;
  readonly shapeName: string;
  readonly rows: number;
  readonly cols: number;
  readonly maskCells: number;
  readonly targetCells: number;
  readonly minCells: number;
  readonly maxCells: number;
}

let v2RowsCache: readonly V2Row[] | null = null;

/** generate(i, 2) for 0-1999, once per file (it is the expensive part). */
function v2Rows(): readonly V2Row[] {
  if (v2RowsCache === null) {
    const rows: V2Row[] = [];
    for (let i = 0; i < V2_LEVELS; i++) {
      const lvl = LevelGenerator.generate(i, 2);
      const cfg = Difficulties.configV2(lvl.difficulty, i);
      rows.push({
        index: i,
        shapeName: lvl.shapeName,
        rows: lvl.board.rows,
        cols: lvl.board.cols,
        maskCells: countTrue(lvl.mask),
        targetCells: lvl.targetCells,
        minCells: cfg.minCells,
        maxCells: cfg.maxCells,
      });
    }
    v2RowsCache = rows;
  }
  return v2RowsCache;
}

describe('W3-14 the clamp (owner pick W3-09) and capacity', () => {
  test('37 columns is the most whose fit cell on the logged 360 dp phone stays >= 9.1 pt; rows stay at 46', () => {
    expect(MIN_LEGIBLE_CELL_PT).toBe(9.1);
    expect([V2_MAX_GRID_COLS, V2_MAX_GRID_ROWS]).toEqual([COLS_CAP, ROWS_CAP]);
    // Width-bound fit: cellPt = FIT_MARGIN x 360 / cols (docs/board-legibility-2026-09-26.md).
    expect(FIT_MARGIN * 360 / V2_MAX_GRID_COLS).toBeGreaterThanOrEqual(MIN_LEGIBLE_CELL_PT);
    expect(FIT_MARGIN * 360 / (V2_MAX_GRID_COLS + 1)).toBeLessThan(MIN_LEGIBLE_CELL_PT);
    // 46 rows at 37 columns on the 360x689 board viewport: rows never bind below the floor.
    expect(FIT_MARGIN * 689 / V2_MAX_GRID_ROWS).toBeGreaterThanOrEqual(MIN_LEGIBLE_CELL_PT);
  });

  test('v2MaxRows keeps each shape\'s aspect: the most rows whose unclamped cols fit 37', () => {
    for (const id of SHAPE_CATALOGUE) {
      const shape = def(id);
      expect([id, v2MaxRows(shape.aspect)]).toEqual([id, independentMaxRows(shape)]);
      expect([id, roundHalfToEven(v2MaxRows(shape.aspect) * shape.aspect) <= COLS_CAP]).toEqual([id, true]);
    }
    expect(v2MaxRows(1.5)).toBe(24); // Rectangle: 24 x 36 (25 rows would need 38 columns)
    expect(v2MaxRows(0.8)).toBe(46); // Bolt, Hourglass: 46 x 37
  });

  test('v2GridFor never squeezes a silhouette: at any target, cols are the shape\'s own aspect of its rows, and rows stop at v2MaxRows', () => {
    // Includes targets past every capacity, where the clamp binds (W3-14 mutation M14 survived without this).
    const bad: string[] = [];
    for (const id of SHAPE_CATALOGUE) {
      const shape = def(id);
      for (let target = 20; target <= 3000; target += 20) {
        const { rows, cols } = v2GridFor(shape, target);
        if (rows > independentMaxRows(shape) || cols !== Math.max(4, roundHalfToEven(rows * shape.aspect)) || cols > COLS_CAP) {
          bad.push(`${id}@${target}:${rows}x${cols}`);
        }
      }
      // Past its capacity the board IS the capacity board.
      const big = v2GridFor(shape, 5000);
      expect([id, big.rows]).toEqual([id, independentMaxRows(shape)]);
    }
    expect(bad).toEqual([]);
  });

  test('shapeCapacity equals an independent count for every catalogue shape; at v1\'s 46x46 clamp it is W3-01\'s measured table', () => {
    for (const id of SHAPE_CATALOGUE) {
      expect([id, shapeCapacity(def(id))]).toEqual([id, independentCapacity(def(id))]);
    }
    // Measured by `difficulty-probe.ts --version 1 --capacity` (W3-01 baseline table, v1's 46 clamp).
    const measured: Record<string, number> = {
      Square: 2116, Heart: 1606, Triangle: 800, Crescent: 700, Hourglass: 688,
      Star: 640, Pine: 566, Rocket: 544, Trophy: 523, Arrow: 503, Bolt: 202,
    };
    for (const [id, cells] of Object.entries(measured)) expect([id, shapeCapacity(def(id), 46, 46)]).toEqual([id, cells]);
  });

  test('placeholder bands at the W3-09 clamp: the admissible set is exactly the eight shapes holding 720 cells', () => {
    const expected = SHAPE_CATALOGUE.filter((id) => AT_LEAST_720.includes(id));
    expect(windowSetAt(0, placeholderWindowMaxTarget).map((s) => s.name)).toEqual(expected);
    expect(expected).toHaveLength(8);
    for (const id of SHAPE_CATALOGUE) {
      expect([id, independentCapacity(def(id)) >= 720]).toEqual([id, AT_LEAST_720.includes(id)]);
    }
  });
});

describe('W3-10 bag invariants over v2 levels 0-1999', () => {
  test('(a) zero back-to-back repeats, including across window boundaries', () => {
    const repeats: number[] = [];
    let prev: string | null = null;
    for (let i = 0; i < V2_LEVELS; i++) {
      const name = shapeNameForLevel(i, 2);
      if (name === prev) repeats.push(i);
      prev = name;
    }
    expect(repeats).toEqual([]);
  });

  test('(b) windows tile the levels; each deals the top-k shapes by capacity exactly once, all holding its targets, and is as long as it can be', () => {
    // Under a rising curve a window's set is the top-k candidates by capacity
    // for the largest k whose k levels all fit the k-th capacity (W3-10's
    // window model, confirmed by W3-14). A (k+1)-th shape may still hold this
    // window's targets; it sits the window out because a (k+1)-level window
    // would reach a target it cannot hold. That is counted, not hidden.
    const ranked = [...SHAPE_CATALOGUE]
      .map((id, catalogueIndex) => ({ id, catalogueIndex, cap: independentCapacity(def(id)) }))
      .sort((a, b) => b.cap - a.cap || a.catalogueIndex - b.catalogueIndex);
    let expectedStart = 0;
    let windows = 0;
    let satOut = 0;
    const sizes = new Set<number>();
    while (expectedStart < V2_LEVELS) {
      const window = bagWindowFor(expectedStart);
      expect(window.start).toBe(expectedStart);
      expect(window.ordinal).toBe(windows);
      const size = window.order.length;
      sizes.add(size);
      const dealt: string[] = [];
      for (let i = window.start; i < window.start + size; i++) dealt.push(shapeNameForLevel(i, 2));
      // Exactly once each, and exactly the top-k by (independently rasterized) capacity.
      expect([...dealt].sort()).toEqual(ranked.slice(0, size).map((r) => r.id).sort());
      // Every dealt shape holds the largest target any level of the window draws.
      const max = curveMax(window.start, window.start + size);
      for (const id of dealt) expect([window.start, id, independentCapacity(def(id)) >= max]).toEqual([window.start, id, true]);
      // Maximal: every longer window (that does not split a capacity tie) reaches a target its k-th shape cannot hold.
      for (let k = size + 1; k <= ranked.length; k++) {
        if (k < ranked.length && ranked[k].cap === ranked[k - 1].cap) continue;
        expect([window.start, k, ranked[k - 1].cap < curveMax(window.start, window.start + k)]).toEqual([window.start, k, true]);
      }
      satOut += SHAPE_CATALOGUE.filter((id) => !dealt.includes(id) && independentCapacity(def(id)) >= max).length;
      expectedStart += size;
      windows += 1;
    }
    // The curve rises, so the set shrinks: more than one window size occurs.
    expect(sizes.size).toBeGreaterThan(1);
    // The model's cost is bounded: never more than one shape per window sits out while it could hold the targets.
    expect(satOut).toBeLessThanOrEqual(windows);
  });

  test('(c) 1000 extra pickForLevelV2 calls before generate(i, 2) change nothing (no RNG consumption)', () => {
    for (const i of [0, 1, 11, 17, 18, 239, 1999]) {
      const before = serialize(LevelGenerator.generate(i, 2));
      for (let k = 0; k < 1000; k++) pickForLevelV2((i * 7 + k * 13) % 5000);
      expect(serialize(LevelGenerator.generate(i, 2))).toBe(before);
    }
  });

  test('(c) cold start: a fresh module that picks 1000 times first deals the same boards as one that does not', () => {
    const indices = [0, 11, 239, 1999];
    let warmed: string[] = [];
    let cold: string[] = [];
    jest.isolateModules(() => {
      const bag = require('../shapeBag') as typeof import('../shapeBag');
      const gen = require('../levelGenerator') as typeof import('../levelGenerator');
      for (let k = 0; k < 1000; k++) bag.pickForLevelV2((k * 37) % 3000);
      warmed = indices.map((i) => serialize(gen.LevelGenerator.generate(i, 2)));
    });
    jest.isolateModules(() => {
      const gen = require('../levelGenerator') as typeof import('../levelGenerator');
      cold = [...indices].reverse().map((i) => serialize(gen.LevelGenerator.generate(i, 2))).reverse();
    });
    expect(warmed).toEqual(cold);
  });

  test('the pick is pure: a fresh module asked for level 1999 first deals the same sequence', () => {
    const main = Array.from({ length: V2_LEVELS }, (_, i) => shapeNameForLevel(i, 2));
    let fresh: string[] = [];
    jest.isolateModules(() => {
      const gen = require('../levelGenerator') as typeof import('../levelGenerator');
      gen.shapeNameForLevel(1999, 2);
      gen.shapeNameForLevel(1000, 2);
      fresh = Array.from({ length: V2_LEVELS }, (_, i) => gen.shapeNameForLevel(i, 2));
    });
    expect(fresh).toEqual(main);
  });

  test('(d) shapeNameForLevel(i, 2) === generate(i, 2).shapeName for 0-1999', () => {
    const mismatches = v2Rows().filter((row) => shapeNameForLevel(row.index, 2) !== row.shapeName).map((r) => r.index);
    expect(mismatches).toEqual([]);
  });

  test('(e) shapeNameForLevel(i, 1) === generate(i, 1).shapeName for 0-999', () => {
    const mismatches: number[] = [];
    for (let i = 0; i < V1_EQUIVALENCE_LEVELS; i++) {
      if (shapeNameForLevel(i, 1) !== LevelGenerator.generate(i, 1).shapeName) mismatches.push(i);
    }
    expect(mismatches).toEqual([]);
  });

  test('no v2 level falls short of its cell target because rows or cols hit the clamp', () => {
    const atClamp = (r: V2Row) => r.rows === independentMaxRows(def(r.shapeName)) || r.cols === COLS_CAP;
    const shortfalls = v2Rows()
      .filter((r) => atClamp(r) && r.maskCells < r.targetCells)
      .map((r) => `${r.index}:${r.shapeName}:${r.maskCells}<${r.targetCells}`);
    expect(shortfalls).toEqual([]);
    // The bag guarantees the rows-clamp case by construction (the mask is then
    // the capacity mask). With the aspect kept, cols reach 37 only at the
    // shape's row cap, so a cols-only clamp cannot happen; it is counted.
    const colsOnly = v2Rows()
      .filter((r) => r.cols === COLS_CAP && r.rows !== independentMaxRows(def(r.shapeName)))
      .map((r) => `${r.index}:${r.shapeName}`);
    expect(colsOnly).toEqual([]);
    expect(v2Rows().filter((r) => r.cols > COLS_CAP || r.rows > ROWS_CAP)).toEqual([]);
  });

  test('v2\'s target is the first draw of the level\'s ExactDotNetRandom(seed(i)) (the bag draws nothing from it)', () => {
    // V2-FINISH: v2's level stream is the exact .NET stream (dotnetRandom.test.ts
    // proves the whole board is a rebuild from it).
    const bad = v2Rows()
      .filter((r) => r.targetCells !== new ExactDotNetRandom(seed(r.index)).next(r.minCells, r.maxCells + 1))
      .map((r) => r.index);
    expect(bad).toEqual([]);
  });

  test('every v2 target is its curve point and fits its shape\'s capacity', () => {
    const bad = v2Rows()
      .filter((r) => r.minCells !== r.maxCells || r.targetCells !== r.maxCells
        || r.targetCells > independentCapacity(def(r.shapeName)))
      .map((r) => `${r.index}:${r.shapeName}:${r.targetCells}`);
    expect(bad).toEqual([]);
  });

  test('every v2 shape is a live catalogue id, so the collection fold stays valid', () => {
    const names = Array.from({ length: V2_LEVELS }, (_, i) => shapeNameForLevel(i, 2));
    expect(names.filter((n) => catalogueIndexOf(n) < 0 || RETIRED_SHAPE_IDS.has(n))).toEqual([]);

    // The real fold (collection.ts), fed v2 names, sets exactly the dealt shapes' bits.
    const folded = foldLevels(EMPTY_SHAPE_MASKS, 0, V2_LEVELS, (i) => shapeNameForLevel(i, 2), V2_LEVELS);
    expect(folded.through).toBe(V2_LEVELS);
    let lo = 0;
    for (const id of new Set(names)) lo |= 1 << catalogueIndexOf(id);
    expect(folded).toEqual({ lo: lo >>> 0, hi: 0, through: V2_LEVELS });
  });

  test('placeholder bands, levels 1-200: each admitted shape within +-1 of 200 / 8, every first appearance by level 8', () => {
    const counts = new Map<string, number>();
    const first = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const name = pickForLevelV2(i, placeholderWindowMaxTarget).name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      if (!first.has(name)) first.set(name, i + 1);
    }
    expect(counts.size).toBe(8);
    for (const [name, count] of counts) expect([name, Math.abs(count - 200 / 8) <= 1]).toEqual([name, true]);
    expect(Math.max(...first.values())).toBeLessThanOrEqual(8);
  });
});

describe('W3-10 bag construction (the brief\'s algorithm, reimplemented here)', () => {
  test('each window is a Fisher-Yates shuffle seeded by bagSeed(ordinal), with one 0/1 swap on a repeat', () => {
    let prev: string | null = null;
    let swaps = 0;
    for (let ordinal = 0; ordinal < 2000; ordinal++) {
      const window = bagWindowFor(ordinal * 8, placeholderWindowMaxTarget);
      const order = SHAPE_CATALOGUE.filter((id) => AT_LEAST_720.includes(id));
      const rng = new ExactDotNetRandom(bagSeed(ordinal)); // V2-FINISH: v2's exact stream
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.next(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order[0] === prev) {
        [order[0], order[1]] = [order[1], order[0]];
        swaps += 1;
      }
      expect([ordinal, window.order.map((s) => s.name)]).toEqual([ordinal, order]);
      prev = order[order.length - 1];
    }
    expect(swaps).toBeGreaterThan(0); // the swap path is exercised, not just present
  });

  test('bag seeds stay in DotNetRandom\'s exact range and off the campaign and daily seeds', () => {
    const campaign = new Set<number>();
    for (let i = 0; i < 200000; i++) campaign.add(Math.abs(seed(i)));
    const daily = new Set<number>();
    for (let d = 0; d < 20000; d++) daily.add(Math.abs(dailySeed(d)));
    const seen = new Set<number>();
    const problems: string[] = [];
    for (let w = 0; w < 20000; w++) {
      const s = bagSeed(w);
      if (s < 0 || s > 161803398) problems.push(`${w}: ${s} out of range`);
      if (campaign.has(s)) problems.push(`${w}: equals a campaign seed`);
      if (daily.has(s)) problems.push(`${w}: equals a daily seed`);
      seen.add(s);
    }
    expect(problems).toEqual([]);
    expect(seen.size).toBe(20000);
  });

  test('a full-range seed can draw outside [0, 1) in the frozen port (why W3-10 kept bag seeds small); the exact stream v2 uses cannot', () => {
    // Positive control for the range rule above: campaign seed(58) is a
    // full-range seed whose legacy stream leaves [0, 1) within 50 draws (W3-10
    // scan). V2-FINISH: ExactDotNetRandom, which v2 now draws from, stays in range.
    const r = new DotNetRandom(seed(58));
    const draws = Array.from({ length: 50 }, () => r.nextDouble());
    expect(draws.some((d) => d < 0 || d >= 1)).toBe(true);
    const e = new ExactDotNetRandom(seed(58));
    expect(Array.from({ length: 50 }, () => e.nextDouble()).every((d) => d >= 0 && d < 1)).toBe(true);
  });
});

describe('W3-10 where the admissible set changes (the W3-14 seam)', () => {
  /** A curve from a per-level maximum target. */
  function curve(maxAt: (i: number) => number): WindowMaxTarget {
    return (start, end) => {
      let max = 0;
      for (let i = start; i < end; i++) max = Math.max(max, maxAt(i));
      return max;
    };
  }

  function checkCurve(maxAt: (i: number) => number, levels: number): number[] {
    const wmt = curve(maxAt);
    const starts: number[] = [];
    let prev: string | null = null;
    let start = 0;
    while (start < levels) {
      const window = bagWindowFor(start, wmt);
      expect(window.start).toBe(start);
      starts.push(start);
      const names = window.order.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length); // each member once
      for (let k = 0; k < window.order.length; k++) {
        const i = start + k;
        const shape = pickForLevelV2(i, wmt);
        expect(shape).toBe(window.order[k]);
        // The safety property: the shape can hold the largest target its level can draw.
        expect([i, shape.name, independentCapacity(shape) >= maxAt(i)]).toEqual([i, shape.name, true]);
        expect([i, shape.name === prev]).toEqual([i, false]);
        prev = shape.name;
      }
      start += window.order.length;
    }
    return starts;
  }

  test('a rise: the window before it ends at the rise, then windows shrink to the shapes that fit', () => {
    // 720 admits 8 shapes (windows of 8 from 0); the rise at 44 cuts the window at 40 to 4 levels.
    const starts = checkCurve((i) => (i < 44 ? 720 : 1000), 200);
    expect(starts).toContain(40);
    expect(starts).toContain(44);
    expect(bagWindowFor(40, curve((i) => (i < 44 ? 720 : 1000))).order).toHaveLength(4);
    expect(bagWindowFor(44, curve((i) => (i < 44 ? 720 : 1000))).order.map((s) => s.name).sort())
      .toEqual(['Heart', 'Square']);
  });

  test('a fall: windows after it admit every shape that fits the lower target', () => {
    const maxAt = (i: number) => (i < 40 ? 720 : 400);
    checkCurve(maxAt, 200);
    const late = bagWindowFor(150, curve(maxAt));
    // Below 400 cells at the W3-09 clamp: Bolt (202) and Arrow (394).
    expect(late.order.map((s) => s.name).sort()).toEqual(SHAPE_CATALOGUE.filter((id) => id !== 'Bolt' && id !== 'Arrow').sort());
  });

  test('two admissible shapes alternate with no repeat (every window of size 2 exercises the swap rule)', () => {
    checkCurve(() => 1033, 200); // Heart 1033 and Square 1369 only
  });

  test('a target no two shapes can hold throws instead of dealing a shortfall', () => {
    expect(() => pickForLevelV2(0, () => 1034)).toThrow(/fewer than two shapes/);
  });

  test('W3-14 curveWindowMaxTarget reads only the last cycle, yet equals the max over every level of the range', () => {
    const synthetic: CurveTable = [
      { levelIndex: 0, baseCells: 88, tierTexture: V1_TIER_TEXTURE, clearableBias: 3 },
      { levelIndex: 50, baseCells: 300, tierTexture: V1_TIER_TEXTURE },
      { levelIndex: 51, baseCells: 300, tierTexture: { Normal: 83, Hard: 160, SuperHard: 200 } },
      { levelIndex: 120, baseCells: 360, tierTexture: { Normal: 83, Hard: 160, SuperHard: 200 } },
    ];
    for (const table of [V2_CURVE, synthetic]) {
      const wmt = curveWindowMaxTarget(table);
      expect(curveWindowMaxTarget(table)).toBe(wmt); // one function per table (the window cache key)
      for (let start = 0; start < 700; start += 7) {
        for (const len of [1, 2, 3, 5, 6, 7, 13, 26]) {
          expect([start, len, wmt(start, start + len)]).toEqual([start, len, curveMax(start, start + len, table)]);
        }
      }
    }
  });

  test('a negative or fractional level index is rejected', () => {
    expect(() => pickForLevelV2(-1)).toThrow(RangeError);
    expect(() => pickForLevelV2(1.5)).toThrow(RangeError);
  });

  test('placeholderWindowMaxTarget reads the tier bands (400 / 580 / 720)', () => {
    expect(placeholderWindowMaxTarget(0, 1)).toBe(400);
    expect(placeholderWindowMaxTarget(0, 3)).toBe(580);
    expect(placeholderWindowMaxTarget(0, 6)).toBe(720);
    expect(placeholderWindowMaxTarget(6, 8)).toBe(400);
    for (let s = 0; s < 30; s++) expect(placeholderWindowMaxTarget(s, s + 18)).toBe(bandMax(s, s + 18));
  });
});

describe('W3-10 catalogue contract (W4-01)', () => {
  test('bag membership is SHAPE_CATALOGUE minus RETIRED_SHAPE_IDS, in catalogue order', () => {
    expect(bagCandidates().map((s) => s.name)).toEqual(SHAPE_CATALOGUE.filter((id) => !RETIRED_SHAPE_IDS.has(id)));
  });

  test('retiring a shape drops it from the bag without touching any catalogue index', () => {
    const indexBefore = SHAPE_CATALOGUE.map((id) => catalogueIndexOf(id));
    const retired = new Set(['Circle']);
    const names = bagCandidates(SHAPE_CATALOGUE, retired).map((s) => s.name);
    expect(names).not.toContain('Circle');
    expect(names).toEqual(SHAPE_CATALOGUE.filter((id) => id !== 'Circle'));
    expect(SHAPE_CATALOGUE.map((id) => catalogueIndexOf(id))).toEqual(indexBefore);
  });
});

describe('W3-10 the __DEV__ no-shortfall assertion', () => {
  test('isClampShortfall flags only a board at the clamp that holds fewer cells than its target', () => {
    expect(isClampShortfall(46, 37, 202, 560)).toBe(true);
    expect(isClampShortfall(30, 37, 500, 560)).toBe(true); // at the column cap
    expect(isClampShortfall(24, 36, 800, 864, 24)).toBe(true); // at a shape's own row cap (Rectangle)
    expect(isClampShortfall(37, 37, 720, 720)).toBe(false);
    expect(isClampShortfall(36, 36, 500, 560)).toBe(false); // short, but not because of the clamp
  });

  test('positive control: in __DEV__, generateV2 throws when handed a shape that cannot hold its target', () => {
    const g = globalThis as { __DEV__?: boolean };
    const saved = g.__DEV__;
    g.__DEV__ = true;
    try {
      jest.isolateModules(() => {
        jest.doMock('../shapeBag', () => {
          const actual = jest.requireActual('../shapeBag') as typeof import('../shapeBag');
          const lib = jest.requireActual('../shapeLibrary') as typeof import('../shapeLibrary');
          return { ...actual, pickForLevelV2: () => lib.ShapeLibrary.Bolt };
        });
        const gen = require('../levelGenerator') as typeof import('../levelGenerator');
        // Index 5999 is Super Hard on the saturated curve: a target far above Bolt's 202.
        expect(() => gen.LevelGenerator.generate(5999, 2)).toThrow(/Bolt 46x37 holds 202 cells at the clamp/);
      });
      jest.dontMock('../shapeBag');
      jest.isolateModules(() => {
        const gen = require('../levelGenerator') as typeof import('../levelGenerator');
        for (const i of [5, 11, 17, 239, 5999]) expect(() => gen.LevelGenerator.generate(i, 2)).not.toThrow();
      });
    } finally {
      jest.dontMock('../shapeBag');
      if (saved === undefined) delete g.__DEV__;
      else g.__DEV__ = saved;
    }
  });
});

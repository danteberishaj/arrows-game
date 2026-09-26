import { EMPTY_SHAPE_MASKS, foldLevels } from '../collection';
import { dailySeed } from '../dailyBoard';
import { Difficulties } from '../difficulty';
import { DotNetRandom } from '../dotnetRandom';
import { LevelGenerator, seed, shapeNameForLevel, type GeneratedLevel } from '../levelGenerator';
import {
  V2_MAX_GRID_DIM,
  bagCandidates,
  bagSeed,
  bagWindowFor,
  isClampShortfall,
  pickForLevelV2,
  placeholderWindowMaxTarget,
  shapeCapacity,
  windowSetAt,
  type WindowMaxTarget,
} from '../shapeBag';
import { RETIRED_SHAPE_IDS, SHAPE_CATALOGUE, catalogueIndexOf, shapeDefFor } from '../shapeCatalogue';
import { ShapeDef } from '../shapeLibrary';

// W3-10: generator v2's capacity-aware shuffled shape bag.
//
// Every expectation here is computed independently of shapeBag.ts where it
// can be: capacity by rasterizing at the clamp, a window's admissible set from
// Difficulties.config, the clamp from each board's own rows/cols. The bag's
// own helpers are only compared against those, never used as the oracle.

const V2_LEVELS = 2000; // brief: v2 levels 0-1999
const V1_EQUIVALENCE_LEVELS = 1000; // brief (e): 0-999

/** The eight shapes W3-01 measured below 720 cells at the 46 clamp (docs/level-curve-baseline-2026-09-17.md). */
const BELOW_720_AT_46 = ['Bolt', 'Arrow', 'Trophy', 'Rocket', 'Pine', 'Star', 'Hourglass', 'Crescent'];

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

/** Capacity recomputed here: rows = maxDim, cols as the generator sizes them. */
function independentCapacity(shape: ShapeDef, maxDim: number): number {
  const key = `${shape.name}@${maxDim}`;
  let cells = independentCapacityCache.get(key);
  if (cells === undefined) {
    const cols = Math.min(maxDim, Math.max(4, roundHalfToEven(maxDim * shape.aspect)));
    cells = countTrue(shape.rasterize(maxDim, cols));
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
      const cfg = Difficulties.config(lvl.difficulty);
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

describe('W3-10 capacity at V2_MAX_GRID_DIM', () => {
  test('V2_MAX_GRID_DIM is still the provisional 46 (W3-09 has not landed)', () => {
    // When W3-09 lands this changes on purpose; BELOW_720_AT_46 must then be
    // re-derived from `difficulty-probe.ts --version 2 --capacity`.
    expect(V2_MAX_GRID_DIM).toBe(46);
  });

  test('shapeCapacity equals an independent count for every catalogue shape, and W3-01\'s measured cells', () => {
    for (const id of SHAPE_CATALOGUE) {
      expect([id, shapeCapacity(def(id))]).toEqual([id, independentCapacity(def(id), V2_MAX_GRID_DIM)]);
    }
    // Measured by `difficulty-probe.ts --version 1 --capacity` (W3-01 baseline table).
    const measured: Record<string, number> = {
      Square: 2116, Heart: 1606, Triangle: 800, Crescent: 700, Hourglass: 688,
      Star: 640, Pine: 566, Rocket: 544, Trophy: 523, Arrow: 503, Bolt: 202,
    };
    for (const [id, cells] of Object.entries(measured)) expect([id, shapeCapacity(def(id))]).toEqual([id, cells]);
  });

  test('placeholder bands: the admissible set is the catalogue minus exactly the eight shapes below 720 cells', () => {
    const expected = SHAPE_CATALOGUE.filter((id) => !BELOW_720_AT_46.includes(id));
    expect(windowSetAt(0).map((s) => s.name)).toEqual(expected);
    expect(expected).toHaveLength(18);
    for (const id of BELOW_720_AT_46) expect(independentCapacity(def(id), 46)).toBeLessThan(720);
    for (const id of expected) expect(independentCapacity(def(id), 46)).toBeGreaterThanOrEqual(720);
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

  test('(b) windows tile the levels, none is truncated, and each deals its admissible set exactly once', () => {
    let expectedStart = 0;
    let windows = 0;
    while (expectedStart < V2_LEVELS) {
      const window = bagWindowFor(expectedStart);
      expect(window.start).toBe(expectedStart);
      expect(window.ordinal).toBe(windows);
      const size = window.order.length;
      // The admissible set, recomputed: every catalogue shape whose capacity
      // covers the largest target any level of this window can draw.
      const max = bandMax(window.start, window.start + size);
      const admissible = SHAPE_CATALOGUE.filter((id) => independentCapacity(def(id), 46) >= max);
      expect(admissible).toHaveLength(size); // not truncated: length = set size
      const dealt: string[] = [];
      for (let i = window.start; i < window.start + size; i++) dealt.push(shapeNameForLevel(i, 2));
      expect([...dealt].sort()).toEqual([...admissible].sort());
      expectedStart += size;
      windows += 1;
    }
    expect(windows).toBe(Math.ceil(V2_LEVELS / 18));
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
    const shortfalls = v2Rows()
      .filter((r) => (r.rows === 46 || r.cols === 46) && r.maskCells < r.targetCells)
      .map((r) => `${r.index}:${r.shapeName}:${r.maskCells}<${r.targetCells}`);
    expect(shortfalls).toEqual([]);
    // The bag guarantees the rows-clamp case by construction (the mask is then
    // the capacity mask). A cols-only clamp is not covered by that argument, so
    // it is counted: none occurs under the placeholder bands.
    const colsOnly = v2Rows().filter((r) => r.cols === 46 && r.rows !== 46).map((r) => `${r.index}:${r.shapeName}`);
    expect(colsOnly).toEqual([]);
  });

  test('v2\'s target is the first draw of the level\'s DotNetRandom(seed(i)) (the bag draws nothing from it)', () => {
    const bad = v2Rows()
      .filter((r) => r.targetCells !== new DotNetRandom(seed(r.index)).next(r.minCells, r.maxCells + 1))
      .map((r) => r.index);
    expect(bad).toEqual([]);
  });

  test('every v2 target lies in its tier band and fits its shape\'s capacity', () => {
    const bad = v2Rows()
      .filter((r) => r.targetCells < r.minCells || r.targetCells > r.maxCells
        || r.targetCells > independentCapacity(def(r.shapeName), 46))
      .map((r) => `${r.index}:${r.shapeName}:${r.targetCells}`);
    expect(bad).toEqual([]);
  });

  test('every v2 shape is a live catalogue id, so the collection fold stays valid', () => {
    const names = Array.from({ length: V2_LEVELS }, (_, i) => shapeNameForLevel(i, 2));
    expect(names.filter((n) => catalogueIndexOf(n) < 0 || RETIRED_SHAPE_IDS.has(n))).toEqual([]);

    // The real fold (collection.ts), fed v2 names, sets exactly the admitted shapes' bits.
    const folded = foldLevels(EMPTY_SHAPE_MASKS, 0, V2_LEVELS, (i) => shapeNameForLevel(i, 2), V2_LEVELS);
    expect(folded.through).toBe(V2_LEVELS);
    let lo = 0;
    for (const id of SHAPE_CATALOGUE.filter((s) => !BELOW_720_AT_46.includes(s))) lo |= 1 << catalogueIndexOf(id);
    expect(folded).toEqual({ lo: lo >>> 0, hi: 0, through: V2_LEVELS });
  });

  test('levels 1-200: each admitted shape within +-1 of 200 / 18, every first appearance by level 18', () => {
    const counts = new Map<string, number>();
    const first = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const name = shapeNameForLevel(i, 2);
      counts.set(name, (counts.get(name) ?? 0) + 1);
      if (!first.has(name)) first.set(name, i + 1);
    }
    expect(counts.size).toBe(18);
    for (const [name, count] of counts) expect([name, Math.abs(count - 200 / 18) <= 1]).toEqual([name, true]);
    expect(Math.max(...first.values())).toBeLessThanOrEqual(18);
  });
});

describe('W3-10 bag construction (the brief\'s algorithm, reimplemented here)', () => {
  test('each window is a Fisher-Yates shuffle seeded by bagSeed(ordinal), with one 0/1 swap on a repeat', () => {
    let prev: string | null = null;
    let swaps = 0;
    for (let ordinal = 0; ordinal < 2000; ordinal++) {
      const window = bagWindowFor(ordinal * 18);
      const order = SHAPE_CATALOGUE.filter((id) => !BELOW_720_AT_46.includes(id));
      const rng = new DotNetRandom(bagSeed(ordinal));
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

  test('a full-range seed can draw outside [0, 1) in this port, which is why bag seeds are kept small', () => {
    // Positive control for the range rule above: campaign seed(58) is a
    // full-range seed whose stream leaves [0, 1) within 50 draws (W3-10 scan).
    const r = new DotNetRandom(seed(58));
    const draws = Array.from({ length: 50 }, () => r.nextDouble());
    expect(draws.some((d) => d < 0 || d >= 1)).toBe(true);
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
        expect([i, shape.name, independentCapacity(shape, 46) >= maxAt(i)]).toEqual([i, shape.name, true]);
        expect([i, shape.name === prev]).toEqual([i, false]);
        prev = shape.name;
      }
      start += window.order.length;
    }
    return starts;
  }

  test('a rise: the window before it ends at the rise, then windows shrink to the shapes that fit', () => {
    const starts = checkCurve((i) => (i < 40 ? 720 : 1500), 200);
    expect(starts).toContain(40);
    expect(bagWindowFor(40, curve((i) => (i < 40 ? 720 : 1500))).order.map((s) => s.name).sort())
      .toEqual(['Heart', 'Rectangle', 'Square']);
  });

  test('a fall: windows after it admit every shape that fits the lower target', () => {
    const maxAt = (i: number) => (i < 40 ? 720 : 400);
    checkCurve(maxAt, 200);
    const late = bagWindowFor(150, curve(maxAt));
    expect(late.order.map((s) => s.name).sort()).toEqual(SHAPE_CATALOGUE.filter((id) => id !== 'Bolt').sort());
  });

  test('two admissible shapes alternate with no repeat (every window of size 2 exercises the swap rule)', () => {
    checkCurve(() => 2116, 200);
  });

  test('a target no two shapes can hold throws instead of dealing a shortfall', () => {
    expect(() => pickForLevelV2(0, () => 2117)).toThrow(/fewer than two shapes/);
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
    expect(isClampShortfall(30, 46, 500, 560)).toBe(true);
    expect(isClampShortfall(46, 46, 720, 720)).toBe(false);
    expect(isClampShortfall(45, 45, 500, 560)).toBe(false); // short, but not because of the clamp
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
        expect(() => gen.LevelGenerator.generate(11, 2)).toThrow(/Bolt 46x37 holds 202 cells at the clamp/);
      });
      jest.dontMock('../shapeBag');
      jest.isolateModules(() => {
        const gen = require('../levelGenerator') as typeof import('../levelGenerator');
        for (const i of [5, 11, 17, 239]) expect(() => gen.LevelGenerator.generate(i, 2)).not.toThrow();
      });
    } finally {
      jest.dontMock('../shapeBag');
      if (saved === undefined) delete g.__DEV__;
      else g.__DEV__ = saved;
    }
  });
});

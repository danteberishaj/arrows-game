import { BoardLogic } from '../boardLogic';
import {
  LEVEL1_CLEARABLE_BIAS,
  LEVEL1_TARGET_CELLS,
  V1_TIER_TEXTURE,
  V2_CURVE,
  curvePointAt,
  validateCurve,
  type CurveTable,
} from '../curve';
import { Difficulties, Difficulty } from '../difficulty';
import { Direction, toDelta } from '../direction';
import { DotNetRandom } from '../dotnetRandom';
import type { GenVersion } from '../generatorVersion';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { curveWindowMaxTarget, pickForLevelV2, v2Cols, v2MaxRows } from '../shapeBag';
import { SHAPE_CATALOGUE, shapeDefFor } from '../shapeCatalogue';
import { ShapeLibrary, type ShapeDef } from '../shapeLibrary';

// Ported from Assets/_Game/Scripts/Tests/LevelGeneratorTests.cs.

function solveGreedy(board: BoardLogic): boolean {
  let progress = true;
  while (progress && !board.isCleared()) {
    progress = false;
    for (const a of [...board.arrows()]) {
      if (board.tryRemove(a)) {
        progress = true;
        break;
      }
    }
  }
  return board.isCleared();
}

function checksumLines(lines: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

test('difficulty cycle follows pattern', () => {
  // Normal, Normal, Hard, Normal, Normal, SuperHard, then repeat.
  expect(Difficulties.forLevel(0)).toBe(Difficulty.Normal);
  expect(Difficulties.forLevel(1)).toBe(Difficulty.Normal);
  expect(Difficulties.forLevel(2)).toBe(Difficulty.Hard);
  expect(Difficulties.forLevel(3)).toBe(Difficulty.Normal);
  expect(Difficulties.forLevel(4)).toBe(Difficulty.Normal);
  expect(Difficulties.forLevel(5)).toBe(Difficulty.SuperHard);
  expect(Difficulties.forLevel(6)).toBe(Difficulty.Normal); // cycle repeats
  expect(Difficulties.forLevel(11)).toBe(Difficulty.SuperHard);
});

test('generate fills the shape completely and stays solvable', () => {
  // 18 levels = three full difficulty cycles (every tier, several shapes).
  for (let i = 0; i < 18; i++) {
    const lvl = LevelGenerator.generate(i);
    const board = lvl.board;

    expect(board.count()).toBe(lvl.arrowCount); // level i: arrow count

    // Every shape cell holds an arrow and nothing spills outside the shape:
    // the silhouette is 100% filled (no holes, no overflow).
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (!board.isEmpty(r, c) !== lvl.mask[r][c]) {
          throw new Error(`level ${i} (${lvl.shapeName}) cell ${r},${c}: fill != mask`);
        }
      }
    }

    // Arrows are in bounds and never overlap.
    const seen = new Set<string>();
    for (const a of board.arrows()) {
      for (const cell of a.cells) {
        expect(board.inBounds(cell.r, cell.c)).toBe(true); // level i: cell in bounds
        const key = `${cell.r},${cell.c}`;
        if (seen.has(key)) throw new Error(`level ${i}: arrows overlap at ${key}`);
        seen.add(key);
      }
    }

    // Solvable by construction: regenerate (deterministic) so greedy can mutate a copy.
    if (!solveGreedy(LevelGenerator.generate(i).board)) {
      throw new Error(`level ${i} (${lvl.difficulty}/${lvl.shapeName}) not solvable`);
    }
  }
});

test('generate picks the right shape family per tier', () => {
  const simple = new Set(ShapeLibrary.SimplePool.map((s) => s.name));
  const medium = new Set(ShapeLibrary.MediumPool.map((s) => s.name));
  const complex = new Set(ShapeLibrary.ComplexPool.map((s) => s.name));

  // Cover several cycles so every tier draws a few different shapes.
  for (let i = 0; i < 30; i++) {
    const lvl = LevelGenerator.generate(i);
    const pool =
      lvl.difficulty === Difficulty.SuperHard ? complex
      : lvl.difficulty === Difficulty.Hard ? medium
      : simple;
    if (!pool.has(lvl.shapeName)) {
      throw new Error(`level ${i}: ${lvl.difficulty} drew out-of-pool shape '${lvl.shapeName}'`);
    }
  }
});

test('every shape in every pool generates a fillable, solvable board', () => {
  // Rasterize each shape at a mid-size board and pack it via the peel rule:
  // the fill must cover the mask exactly and solve greedily. This exercises
  // thin features (crescent horns, bolt tips, crown valleys) directly.
  const all = [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool];
  const { DotNetRandom } = require('../dotnetRandom');
  const { LevelGenerator: LG } = require('../levelGenerator');
  const { Difficulties: D, Difficulty: Df } = require('../difficulty');
  const { BoardLogic: BL } = require('../boardLogic');

  for (const shape of all) {
    const rows = 24;
    const cols = Math.max(4, Math.min(46, Math.round(rows * shape.aspect)));
    const mask = shape.rasterize(rows, cols);
    const cfg = D.config(Df.Normal);
    const arrows = LG.fillMask(mask, rows, cols, cfg, new DotNetRandom(1234));

    const board = new BL(rows, cols);
    for (const a of arrows) board.add(a);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board.isEmpty(r, c) !== mask[r][c]) {
          throw new Error(`${shape.name}: fill != mask at ${r},${c}`);
        }
      }
    }
    if (!solveGreedy(board)) throw new Error(`${shape.name}: not solvable`);
  }
});

test('generate is deterministic by index', () => {
  const a = LevelGenerator.generate(5); // SuperHard — a complex shape
  const b = LevelGenerator.generate(5);

  expect(b.shapeName).toBe(a.shapeName);
  expect(b.arrowCount).toBe(a.arrowCount);
  expect(b.board.rows).toBe(a.board.rows);
  expect(b.board.cols).toBe(a.board.cols);

  const ar = a.board.arrows();
  const br = b.board.arrows();
  expect(br.length).toBe(ar.length);
  for (let i = 0; i < ar.length; i++) {
    expect(br[i].head).toEqual(ar[i].head); // arrow i head
    expect(br[i].headDir).toBe(ar[i].headDir); // arrow i dir
    expect(br[i].length).toBe(ar[i].length); // arrow i length
  }
});

test.each([
  [239, 'a05a623c'],
  [917, 'eb373575'],
  [935, '546a69c0'],
  [3827, 'b1f50ecb'],
  [5363, '63599476'],
] as const)('level %i preserves its full serialized board checksum', (index, expected) => {
  const level = LevelGenerator.generate(index);
  const lines = level.board.arrows().map((arrow) => arrow.toLine());
  expect(checksumLines(lines)).toBe(expected);
});

// ---- W3-02: wide fill/solve net + whole-corpus fingerprint ----------------
//
// The five golden checksums above only cover Crown, Heart, Crescent, Flower
// and Butterfly boards. An edit to any other shape (Bolt, Square, any
// Normal-pool shape, ...) would change a real player's board at that level
// and still pass every test above it. The tests below widen the net to the
// whole early corpus and every shape at every clamp-relevant size, so ANY v1
// output drift fails loudly.

const V1_CORPUS_SIZE = 300;

test('v1 corpus fingerprint: levels 0-299 serialize identically forever', () => {
  // One checksum over shapeName, rows, cols and every arrow's serialized line,
  // for every level a player at 1..300 can be dealt. Reuses checksumLines
  // (defined above) so it hashes exactly like the golden per-level checksums.
  const lines: string[] = [];
  for (let i = 0; i < V1_CORPUS_SIZE; i++) {
    const lvl = LevelGenerator.generate(i);
    lines.push(lvl.shapeName, String(lvl.board.rows), String(lvl.board.cols));
    for (const arrow of lvl.board.arrows()) lines.push(arrow.toLine());
  }
  // Computed EXECUTED on commit da93dcd (pre-W3, before any W3 code change),
  // directly against that commit's source in an isolated worktree, and cross-
  // checked identical on the current HEAD (the only diff between da93dcd and
  // HEAD in the core module is the additive, output-inert `targetCells` field
  // — see W3-02.md). v1 is frozen; never re-pin this value.
  expect(checksumLines(lines)).toBe('d01abbd8');
});

/**
 * Fills, bounds/overlap-checks and greedily solves `count` consecutive level
 * indices for the given generator version, in ONE pass per level: the same
 * greedy loop that clears the board also counts the removals, so there is no
 * second O(n^2) scan just to get a count.
 */
function sweep(version: GenVersion, count: number, knobs?: W311Knobs): void {
  for (let i = 0; i < count; i++) {
    const lvl = LevelGenerator.generate(i, version, knobs);
    const board = lvl.board;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (!board.isEmpty(r, c) !== lvl.mask[r][c]) {
          throw new Error(`v${version} level ${i} (${lvl.shapeName}): fill != mask at ${r},${c}`);
        }
      }
    }

    const seen = new Set<string>();
    for (const a of board.arrows()) {
      for (const cell of a.cells) {
        if (!board.inBounds(cell.r, cell.c)) {
          throw new Error(`v${version} level ${i} (${lvl.shapeName}): cell out of bounds at ${cell.r},${cell.c}`);
        }
        const key = `${cell.r},${cell.c}`;
        if (seen.has(key)) throw new Error(`v${version} level ${i} (${lvl.shapeName}): arrows overlap at ${key}`);
        seen.add(key);
      }
    }

    let removals = 0;
    let progress = true;
    while (progress && !board.isCleared()) {
      progress = false;
      for (const a of [...board.arrows()]) {
        if (board.tryRemove(a)) {
          removals++;
          progress = true;
          break;
        }
      }
    }
    if (!board.isCleared()) {
      throw new Error(`v${version} level ${i} (${lvl.shapeName}): dead end, ${removals}/${lvl.arrowCount} removed`);
    }
    if (removals !== lvl.arrowCount) {
      throw new Error(
        `v${version} level ${i} (${lvl.shapeName}): solved in ${removals} removals, expected ${lvl.arrowCount}`,
      );
    }
  }
}

test('sweep: 300 consecutive v1 levels fill exactly, never overlap and greedy-solve to empty', () => {
  sweep(1, V1_CORPUS_SIZE);
});

// W3-10: v2 deals its own boards (the capacity-aware shape bag), so the same
// net runs over them. Replaces W3-05's "v2 delegates to v1 until W3-10".
test('sweep: 300 consecutive v2 levels fill exactly, never overlap and greedy-solve to empty', () => {
  sweep(2, 300);
});

// Mirrors levelGenerator.ts's own board-sizing math (roundHalfToEven + the
// 4..46 clamp) rather than the coarser Math.round approximation the existing
// "every shape in every pool" test above uses, so `cols` here is exactly what
// a real generated board would use at that `rows`.
function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

test('every shape fills and solves at rows 12, 24 and 46 (the size clamp)', () => {
  // 46 is the upper rows clamp at levelGenerator.ts:73 (as of this commit;
  // W3-01 added a doc comment above it, shifting it from :65). 12 and 24 sample a
  // small and mid-size board so thin features (crescent horns, bolt tips,
  // crown valleys) are exercised well below and at the existing 24-row test.
  // W3-18: every catalogue shape too, so a shape authored outside the v1 pools (awaiting W3-19)
  // is filled and solved at the same three sizes before it can enter v2's bag.
  const all = [...new Set<ShapeDef>([
    ...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool,
    ...SHAPE_CATALOGUE.map((id) => shapeDefFor(id)!),
  ])];
  expect(all.length).toBe(SHAPE_CATALOGUE.length);
  const cfg = Difficulties.config(Difficulty.Normal);

  for (const rows of [12, 24, 46]) {
    for (const shape of all) {
      const cols = clamp(roundHalfToEven(rows * shape.aspect), 4, 46);
      const mask = shape.rasterize(rows, cols);
      const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(1234));

      const board = new BoardLogic(rows, cols);
      for (const a of arrows) board.add(a);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!board.isEmpty(r, c) !== mask[r][c]) {
            throw new Error(`${shape.name} rows=${rows}: fill != mask at ${r},${c}`);
          }
        }
      }
      if (!solveGreedy(board)) throw new Error(`${shape.name} rows=${rows}: not solvable`);
    }
  }
});

test('W3-18: every catalogue shape fills and solves on its v2 capacity board (rows = v2MaxRows(aspect), at most 37 cols)', () => {
  // The largest board generator v2 can deal a shape (shapeBag.ts rasterizedCapacity): where a
  // shape's thin features are finest relative to its arrows, at every tier's arrow lengths.
  for (const id of SHAPE_CATALOGUE) {
    const shape = shapeDefFor(id)!;
    const rows = v2MaxRows(shape.aspect);
    const cols = v2Cols(rows, shape.aspect);
    const mask = shape.rasterize(rows, cols);
    for (const d of [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard]) {
      const arrows = LevelGenerator.fillMask(mask, rows, cols, Difficulties.config(d), new DotNetRandom(1234));
      const board = new BoardLogic(rows, cols);
      for (const a of arrows) board.add(a);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!board.isEmpty(r, c) !== mask[r][c]) throw new Error(`${id} ${rows}x${cols} d=${d}: fill != mask at ${r},${c}`);
        }
      }
      if (!solveGreedy(board)) throw new Error(`${id} ${rows}x${cols} d=${d}: not solvable`);
    }
  }
});


// ---- W3-11: the clearable-fraction knob (v2 only, dark at neutral) ---------
//
// `clearableBias` scales the fill's candidate weight of every head whose exit
// lane holds no mask cell at all. It changes weights only, never the
// candidate set, so the peel proof above (fill completeness + solvability)
// holds at any bias > 0. Unset, the path is skipped: v2 is W3-10's output.

interface W311Knobs {
  clearableBias?: number;
  curve?: CurveTable;
}

/** The v2 corpus 0..299, serialized exactly like the v1 fingerprint above. */
function v2CorpusFingerprint(knobs?: W311Knobs): string {
  const lines: string[] = [];
  for (let i = 0; i < V1_CORPUS_SIZE; i++) {
    const lvl = LevelGenerator.generate(i, 2, knobs);
    lines.push(lvl.shapeName, String(lvl.board.rows), String(lvl.board.cols));
    for (const arrow of lvl.board.arrows()) lines.push(arrow.toLine());
  }
  return checksumLines(lines);
}

function serializeLevel(lvl: { shapeName: string; board: BoardLogic }): string {
  return [lvl.shapeName, lvl.board.rows, lvl.board.cols, ...lvl.board.arrows().map((a) => a.toLine())].join('\n');
}

test('v2 corpus pin: generate(i, 2) for 0-299 (re-pinned by RE-CEILING: the owner-picked 354 ceiling; then by W3-19\'s admission)', () => {
  // W3-10/W3-11 pinned 04d0ec7e (v1 tier bands, 46x46 clamp). W3-14 changed
  // v2 content on purpose (targets and bias from V2_CURVE, at most 37
  // columns): ec15f0f7. V2-FINISH part 1 (S400 as the owner's pick, the v1
  // floor for existing players) left it unchanged; part 2 moved v2 to
  // ExactDotNetRandom, which re-deals the boards whose legacy stream was not
  // .NET's: e802f80a (678 of levels 0-2999 re-dealt; the shape sequence is
  // unchanged). EXECUTED twice, by this test and by V2-FINISH's scratch
  // fp.ts (docs/next-level/reports/V2-FINISH.md, "Fingerprints"). RE-CEILING
  // moved S400's ceiling, which re-targets every level from index 1 and
  // re-deals the bag's windows: 339 -> 450 (the arrow cap; a54d5f48, never
  // committed), then the owner's option B, 354: 71dc3369 (EXECUTED twice:
  // this test and RE-CEILING's scratch fp.ts; docs/next-level/reports/
  // RE-CEILING.md, "Fix round 1"). Unlike v1's
  // d01abbd8 this was not frozen: W3-19's admission of W3-18's House, Teacup,
  // Bell and Umbrella (owner ruling 2026-10-06) re-dealt the bag's windows:
  // 1c4cd1f4 (EXECUTED twice: this test and W3-21's artifacts/W3-21/step1/
  // fp.ts; docs/next-level/reports/W3-21.md). W3-21 then froze v2 with its
  // own tests below ("v2 frozen at ..."); this pin must agree with them.
  expect(v2CorpusFingerprint()).toBe('1c4cd1f4');
});

/** V2_CURVE with every bias removed: the same targets and windows, the neutral fill. */
const V2_CURVE_NO_BIAS: CurveTable = V2_CURVE.map(({ levelIndex, baseCells, tierTexture }) => ({ levelIndex, baseCells, tierTexture }));

test('W3-11 neutral: an empty knobs object and an explicit undefined bias are the same boards', () => {
  for (let i = 0; i < 60; i++) {
    const plain = serializeLevel(LevelGenerator.generate(i, 2));
    expect(serializeLevel(LevelGenerator.generate(i, 2, {}))).toBe(plain);
    expect(serializeLevel(LevelGenerator.generate(i, 2, { clearableBias: undefined }))).toBe(plain);
  }
});

test('W3-11: clearableBias 1 is the identity (same weights, same draws, same boards as unset)', () => {
  // The biased path picks with an untruncated u * total; for integer weights
  // that selects exactly what the truncated neutral pick selects, and the
  // path adds no RNG draw. So b=1 on every level must reproduce the corpus of
  // the same curve with no bias anywhere (W3-14: the shipped curve sets a bias
  // at early levels, so "unset" is now that bias-free curve).
  const neutral = v2CorpusFingerprint({ curve: V2_CURVE_NO_BIAS });
  expect(v2CorpusFingerprint({ clearableBias: 1 })).toBe(neutral);
  expect(neutral).not.toBe(v2CorpusFingerprint()); // the curve's own bias does change boards
});

test('W3-11: clearableBias 0 throws (so do negative, NaN and infinite values)', () => {
  const cfg0 = { ...Difficulties.config(Difficulty.Normal), clearableBias: 0 };
  expect(() => LevelGenerator.fillMask([[true, true], [true, true]], 2, 2, cfg0, new DotNetRandom(1))).toThrow(/clearableBias/);
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => LevelGenerator.generate(0, 2, { clearableBias: bad })).toThrow(/clearableBias/);
  }
});

test('W3-11: v1 takes no knobs (v1 is frozen; a bias there would be silently ignored otherwise)', () => {
  expect(() => LevelGenerator.generate(0, 1, { clearableBias: 2 })).toThrow(/v2/);
  expect(() => LevelGenerator.generate(0, undefined, { clearableBias: 2 })).toThrow(/v2/);
  // No knobs, or an unset bias, is still plain v1.
  expect(serializeLevel(LevelGenerator.generate(3, 1, {}))).toBe(serializeLevel(LevelGenerator.generate(3)));
});

const SET_II_SHAPES = ['Circle', 'Square', 'Heart'] as const;

function shapeByName(name: string) {
  const all = [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool];
  const shape = all.find((s) => s.name === name);
  if (shape === undefined) throw new Error(`no shape ${name}`);
  return shape;
}

/** A level-1-sized board (W3-11 set (ii)): Normal config, square shapes so cols = rows. */
function fillSmall(name: string, rows: number, seedValue: number, clearableBias?: number) {
  const shape = shapeByName(name);
  const cols = clamp(roundHalfToEven(rows * shape.aspect), 4, 46);
  const mask = shape.rasterize(rows, cols);
  const cfg = { ...Difficulties.config(Difficulty.Normal), clearableBias };
  const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(seedValue));
  const board = new BoardLogic(rows, cols);
  for (const a of arrows) board.add(a);
  return { mask, rows, cols, board, arrows };
}

test('W3-11: the bias moves clearable-at-deal in both directions (Circle/Square/Heart, rows 12 and 16, seeds 1-5)', () => {
  const fraction = (clearableBias?: number): number => {
    let clearable = 0;
    let total = 0;
    for (const name of SET_II_SHAPES) {
      for (const rows of [12, 16]) {
        for (let s = 1; s <= 5; s++) {
          const { board, arrows } = fillSmall(name, rows, s, clearableBias);
          for (const a of arrows) if (board.canExit(a)) clearable++;
          total += arrows.length;
        }
      }
    }
    return clearable / total;
  };
  const neutral = fraction(undefined);
  expect(fraction(0.1)).toBeLessThan(neutral);
  expect(fraction(10)).toBeGreaterThan(neutral);
});

test('W3-11 mechanism: at deal, an arrow is clearable exactly when its head lane holds no mask cell', () => {
  // The brief's INFERENCE, checked: the knob targets exactly the arrows the
  // probe counts as clearable at t=0.
  for (const clearableBias of [undefined, 0.1, 10]) {
    for (const name of SET_II_SHAPES) {
      for (const rows of [8, 12, 16]) {
        for (let s = 1; s <= 3; s++) {
          const { mask, board, arrows } = fillSmall(name, rows, s, clearableBias);
          for (const a of arrows) {
            const [dr, dc] = toDelta(a.headDir);
            let r = a.head.r + dr;
            let c = a.head.c + dc;
            let laneHasMask = false;
            while (r >= 0 && r < board.rows && c >= 0 && c < board.cols) {
              if (mask[r][c]) laneHasMask = true;
              r += dr;
              c += dc;
            }
            if (board.canExit(a) === laneHasMask) {
              throw new Error(`${name} rows=${rows} seed=${s} bias=${clearableBias}: canExit disagrees with the mask lane at ${a.toLine()}`);
            }
          }
        }
      }
    }
  }
});

test('W3-11 targeting: an overwhelming bias carves a lane-empty head whenever one is legal (a vanishing one never does)', () => {
  // Replays each fill in carve order (fillMask returns arrows in the order it
  // carved them). At every step it recomputes the legal candidates on the
  // still-unfilled cells, independently of fillMask, and splits them by
  // "no mask cell in the lane". At 1e9 the pick must be lane-empty whenever
  // any lane-empty candidate is legal; at 1e-9 it must be lane-blocked
  // whenever any lane-blocked candidate is legal.
  const laneHits = (grid: readonly (readonly boolean[])[], r: number, c: number, d: Direction): boolean => {
    const [dr, dc] = toDelta(d);
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < grid.length && cc >= 0 && cc < grid[0].length; rr += dr, cc += dc) {
      if (grid[rr][cc]) return true;
    }
    return false;
  };
  const dirs = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
  for (const [clearableBias, wantEmpty] of [[1e9, true], [1e-9, false]] as const) {
    let decisive = 0;
    for (const name of SET_II_SHAPES) {
      for (const rows of [10, 14]) {
        for (let s = 1; s <= 3; s++) {
          const { mask, arrows } = fillSmall(name, rows, s, clearableBias);
          const need = mask.map((row) => [...row]);
          arrows.forEach((a, step) => {
            let wantedIsLegal = false;
            for (let r = 0; r < need.length && !wantedIsLegal; r++) {
              for (let c = 0; c < need[0].length && !wantedIsLegal; c++) {
                if (!need[r][c]) continue;
                for (const d of dirs) {
                  if (laneHits(need, r, c, d)) continue; // not a legal head now
                  if (!laneHits(mask, r, c, d) === wantEmpty) { wantedIsLegal = true; break; }
                }
              }
            }
            const headEmpty = !laneHits(mask, a.head.r, a.head.c, a.headDir);
            if (wantedIsLegal) {
              decisive++;
              if (headEmpty !== wantEmpty) {
                throw new Error(`${name} rows=${rows} seed=${s} bias=${clearableBias} step ${step}: carved ${a.toLine()} although a ${wantEmpty ? 'lane-empty' : 'lane-blocked'} head was legal`);
              }
            }
            for (const cell of a.cells) need[cell.r][cell.c] = false;
          });
        }
      }
    }
    expect(decisive).toBeGreaterThan(100); // the check actually constrained many carves
  }
});

test('W3-11: sweep(2) passes at clearableBias 0.1 and at 10', () => {
  sweep(2, 300, { clearableBias: 0.1 });
  sweep(2, 300, { clearableBias: 10 });
});

test('W3-11: every shape fills and solves at extreme biases (peel proof holds for any bias > 0)', () => {
  const all = [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool];
  const plan: [number, number][] = [
    [0.1, 12], [0.1, 24], [0.1, 46], [10, 12], [10, 24], [10, 46], [1e-6, 24], [1e6, 24],
  ];
  for (const [clearableBias, rows] of plan) {
    const cfg = { ...Difficulties.config(Difficulty.Normal), clearableBias };
    for (const shape of all) {
      const cols = clamp(roundHalfToEven(rows * shape.aspect), 4, 46);
      const mask = shape.rasterize(rows, cols);
      const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(1234));
      const board = new BoardLogic(rows, cols);
      for (const a of arrows) board.add(a);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!board.isEmpty(r, c) !== mask[r][c]) {
            throw new Error(`${shape.name} rows=${rows} bias=${clearableBias}: fill != mask at ${r},${c}`);
          }
        }
      }
      if (!solveGreedy(board)) throw new Error(`${shape.name} rows=${rows} bias=${clearableBias}: not solvable`);
    }
  }
});

// ---- W3-14: v2 difficulty is a function of the level index -----------------
//
// `curve.ts` holds a breakpoint table (data, linearly interpolated). v2's
// config reads its cell target and clearable bias from it; v1's arrow rules
// and hearts are unchanged. v1 and the daily never read the curve.

/** A synthetic table: three rows, one of them with the bias unset (neutral = 1). */
const W314_TABLE: CurveTable = [
  { levelIndex: 0, baseCells: 100, tierTexture: V1_TIER_TEXTURE, clearableBias: 3 },
  { levelIndex: 10, baseCells: 200, tierTexture: V1_TIER_TEXTURE },
  { levelIndex: 30, baseCells: 300, tierTexture: V1_TIER_TEXTURE, clearableBias: 0.5 },
];

const TIERS = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard] as const;

test('W3-14 curve: a breakpoint returns its row, and a midpoint the linear interpolation', () => {
  // Breakpoints.
  expect(curvePointAt(W314_TABLE, 0)).toEqual({ baseCells: 100, tierTexture: V1_TIER_TEXTURE, clearableBias: 3 });
  expect(curvePointAt(W314_TABLE, 10)).toEqual({ baseCells: 200, tierTexture: V1_TIER_TEXTURE, clearableBias: 1 });
  expect(curvePointAt(W314_TABLE, 30)).toEqual({ baseCells: 300, tierTexture: V1_TIER_TEXTURE, clearableBias: 0.5 });
  // Midpoints: halfway in cells and in bias (an unset bias interpolates as 1).
  expect(curvePointAt(W314_TABLE, 5)).toEqual({ baseCells: 150, tierTexture: V1_TIER_TEXTURE, clearableBias: 2 });
  expect(curvePointAt(W314_TABLE, 20)).toEqual({ baseCells: 250, tierTexture: V1_TIER_TEXTURE, clearableBias: 0.75 });
  // A quarter of the way: linear, not a step.
  expect(curvePointAt(W314_TABLE, 15).baseCells).toBeCloseTo(225, 10);
});

test('W3-14 configV2 beyond the last row returns the last row (synthetic table and the shipped curve)', () => {
  for (const d of TIERS) {
    const last = Difficulties.configV2(d, 30, W314_TABLE);
    for (const i of [31, 32, 1000, 99999]) expect([d, i, Difficulties.configV2(d, i, W314_TABLE)]).toEqual([d, i, last]);
    const shippedLast = V2_CURVE[V2_CURVE.length - 1].levelIndex;
    const shipped = Difficulties.configV2(d, shippedLast);
    for (const i of [shippedLast + 1, shippedLast * 3 + 7, 1_000_000]) {
      expect([d, i, Difficulties.configV2(d, i)]).toEqual([d, i, shipped]);
    }
  }
});

test('W3-14 configV2: a point cell target from the table and the tier texture; v1 arrow rules and hearts', () => {
  // Midpoint 5: base 150. Hard = 150 x 126/83 = 227.7 -> 228; Super Hard = 150 x 149/83 = 269.3 -> 269.
  const want: Record<number, number> = { [Difficulty.Normal]: 150, [Difficulty.Hard]: 228, [Difficulty.SuperHard]: 269 };
  for (const d of TIERS) {
    const v1 = Difficulties.config(d);
    const v2 = Difficulties.configV2(d, 5, W314_TABLE);
    expect([d, v2.minCells, v2.maxCells]).toEqual([d, want[d], want[d]]);
    expect([d, v2.minLen, v2.maxLen, v2.bendArrowChance, v2.bendChance, v2.hearts])
      .toEqual([d, v1.minLen, v1.maxLen, v1.bendArrowChance, v1.bendChance, v1.hearts]);
    expect([d, v2.clearableBias]).toEqual([d, 2]);
  }
  // A bias that interpolates to exactly 1 is the neutral path (undefined), not
  // the biased path at 1 (identical boards, but W3-11 measured it ~1.5% slower).
  for (const d of TIERS) expect([d, Difficulties.configV2(d, 10, W314_TABLE).clearableBias]).toEqual([d, undefined]);
});

test('W3-14 the shipped curve starts at the owner pick: level 1 (index 0, Normal) targets 88 cells at clearableBias 3', () => {
  expect(LEVEL1_TARGET_CELLS).toBe(88);
  expect(LEVEL1_CLEARABLE_BIAS).toBe(3);
  expect(V2_CURVE[0]).toEqual({ levelIndex: 0, baseCells: 88, tierTexture: V1_TIER_TEXTURE, clearableBias: 3 });
  const cfg = Difficulties.configV2(Difficulty.Normal, 0);
  expect([cfg.minCells, cfg.maxCells, cfg.clearableBias]).toEqual([88, 88, 3]);
  const lvl = LevelGenerator.generate(0, 2);
  expect([lvl.difficulty, lvl.targetCells]).toEqual([Difficulty.Normal, 88]);
  // v1's measured tier arrow medians over levels 1-1000 (W3-01), carried over.
  expect(V1_TIER_TEXTURE).toEqual({ Normal: 83, Hard: 126, SuperHard: 149 });
  expect(() => validateCurve(V2_CURVE)).not.toThrow();
});

test('W3-14 Difficulties.config (v1 and the daily) is untouched', () => {
  expect(Difficulties.config(Difficulty.Normal)).toEqual({ minCells: 260, maxCells: 400, minLen: 4, maxLen: 6, bendArrowChance: 0.93, bendChance: 0.95, hearts: 3 });
  expect(Difficulties.config(Difficulty.Hard)).toEqual({ minCells: 420, maxCells: 580, minLen: 4, maxLen: 6, bendArrowChance: 0.95, bendChance: 0.96, hearts: 3 });
  expect(Difficulties.config(Difficulty.SuperHard)).toEqual({ minCells: 560, maxCells: 720, minLen: 4, maxLen: 6, bendArrowChance: 0.97, bendChance: 0.97, hearts: 3 });
});

test('W3-14 validateCurve refuses a table the interpolation or the bag cannot trust', () => {
  const row = (levelIndex: number, baseCells: number, clearableBias?: number) =>
    ({ levelIndex, baseCells, tierTexture: V1_TIER_TEXTURE, clearableBias });
  expect(() => validateCurve([])).toThrow(/empty/);
  expect(() => validateCurve([row(1, 100)])).toThrow(/index 0/);
  expect(() => validateCurve([row(0, 100), row(0, 120)])).toThrow(/increasing/);
  expect(() => validateCurve([row(0, 100), row(10, 90)])).toThrow(/cells/); // difficulty would fall
  expect(() => validateCurve([row(0, 100, 1), row(10, 120, 2)])).toThrow(/bias/); // easier later
  expect(() => validateCurve([row(0, 100, 0)])).toThrow(/bias/);
  expect(() => validateCurve([{ levelIndex: 0, baseCells: 100, tierTexture: { Normal: 83, Hard: 126, SuperHard: 0 } }])).toThrow(/texture/);
  expect(() => validateCurve([
    { levelIndex: 0, baseCells: 100, tierTexture: V1_TIER_TEXTURE },
    { levelIndex: 10, baseCells: 100, tierTexture: { Normal: 83, Hard: 100, SuperHard: 149 } },
  ])).toThrow(/texture/); // Hard would get smaller
  expect(() => validateCurve(W314_TABLE)).not.toThrow();
  expect(() => Difficulties.configV2(Difficulty.Normal, -1)).toThrow(RangeError);
  expect(() => Difficulties.configV2(Difficulty.Normal, 2.5)).toThrow(RangeError);
});

test('W3-14 generate(i, 2) deals the curve: its target is configV2(forLevel(i), i).maxCells for 0-599', () => {
  const bad: string[] = [];
  for (let i = 0; i < 600; i++) {
    const lvl = LevelGenerator.generate(i, 2);
    const cfg = Difficulties.configV2(Difficulties.forLevel(i), i);
    if (lvl.targetCells !== cfg.maxCells || lvl.difficulty !== Difficulties.forLevel(i)) bad.push(`${i}:${lvl.targetCells}!=${cfg.maxCells}`);
  }
  expect(bad).toEqual([]);
});

test('W3-14 generate(i, 2) fills at the curve bias: the same board as passing that bias as a knob', () => {
  // Index 0 is biased (3); a knob of the same value must deal the same board,
  // and the neutral knob (1, the identity) a different one.
  for (const i of [0, 1, 2, 5, 7]) {
    const cfg = Difficulties.configV2(Difficulties.forLevel(i), i);
    expect(cfg.clearableBias).toBeDefined();
    const viaCurve = serializeLevel(LevelGenerator.generate(i, 2));
    expect(serializeLevel(LevelGenerator.generate(i, 2, { clearableBias: cfg.clearableBias }))).toBe(viaCurve);
  }
  const neutral = serializeLevel(LevelGenerator.generate(0, 2, { clearableBias: 1 }));
  expect(neutral).not.toBe(serializeLevel(LevelGenerator.generate(0, 2)));
});

test('W3-14 a curve knob replaces the shipped curve (the probe\'s --curve)', () => {
  for (let i = 0; i < 60; i++) {
    const lvl = LevelGenerator.generate(i, 2, { curve: W314_TABLE });
    expect([i, lvl.targetCells]).toEqual([i, Difficulties.configV2(Difficulties.forLevel(i), i, W314_TABLE).maxCells]);
    expect(serializeLevel(LevelGenerator.generate(i, 2, { curve: V2_CURVE }))).toBe(serializeLevel(LevelGenerator.generate(i, 2)));
  }
  expect(() => LevelGenerator.generate(0, 1, { curve: W314_TABLE })).toThrow(/v2/);
  expect(() => LevelGenerator.generate(0, 2, { curve: [] })).toThrow(/empty/);
});

test('W3-14 a curve knob also sets the bag\'s windows: the shape is the pick over that curve\'s window max targets', () => {
  // A steep synthetic curve (Super Hard 1009 cells from level 31: only Heart,
  // 1033, and Square, 1369, hold it) deals windows unlike the shipped curve's.
  const steep: CurveTable = [
    { levelIndex: 0, baseCells: 88, tierTexture: V1_TIER_TEXTURE },
    { levelIndex: 30, baseCells: 562, tierTexture: V1_TIER_TEXTURE },
  ];
  const wmt = curveWindowMaxTarget(steep);
  let differs = 0;
  for (let i = 0; i < 200; i++) {
    const lvl = LevelGenerator.generate(i, 2, { curve: steep });
    expect([i, lvl.shapeName]).toEqual([i, pickForLevelV2(i, wmt).name]);
    if (lvl.shapeName !== shapeNameForLevel(i, 2)) differs++;
  }
  expect(differs).toBeGreaterThan(50);
});

test('W3-14 v2 boards stay inside the owner\'s W3-09 clamp: at most 37 columns and 46 rows (0-1999)', () => {
  const bad: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const { board } = LevelGenerator.generate(i, 2);
    if (board.cols > 37 || board.rows > 46) bad.push(`${i}:${board.rows}x${board.cols}`);
  }
  expect(bad).toEqual([]);
});

// ---- W3-21: generator v2 is frozen ------------------------------------------
//
// Once a v2 build ships, v2 is a contract like v1: any change to its output
// re-deals boards under v2 players. These pins are NEW tests, separate from the
// re-pinnable v2 pins above (which must keep agreeing with them). New content
// is a new generator version (generatorVersion.ts), never an edit here.
// Values computed EXECUTED twice: by these tests and independently by
// artifacts/W3-21/step1/fp.ts and goldens.ts (docs/next-level/reports/W3-21.md).

test('W3-21 v2 frozen corpus fingerprint: generate(i, 2) for 0-299 (a fresh install)', () => {
  // v2 frozen at 71592e3 + W3-21 (the commit that adds this test, after W3-19's admission); never re-pin.
  expect(v2CorpusFingerprint()).toBe('1c4cd1f4');
});

test('W3-21 v2 frozen corpus fingerprint: generate(i, 2, { switchLevel: 1 }) for 0-299 (an existing player, v1 floor)', () => {
  // v2 frozen at 71592e3 + W3-21 (the commit that adds this test, after W3-19's admission); never re-pin.
  const lines: string[] = [];
  for (let i = 0; i < V1_CORPUS_SIZE; i++) {
    const lvl = LevelGenerator.generate(i, 2, { switchLevel: 1 });
    lines.push(lvl.shapeName, String(lvl.board.rows), String(lvl.board.cols));
    for (const arrow of lvl.board.arrows()) lines.push(arrow.toLine());
  }
  expect(checksumLines(lines)).toBe('849961f1');
});

// v2 frozen at 71592e3 + W3-21 (the commit that adds this test, after W3-19's admission); never re-pin.
// Rows: level 1 of a fresh install (W3-13's row), Teacup's first fresh board (a W3-19 shape at 12
// rows), level 13 of the W3-21 over-install (switch level 12), a saturated fresh board, and a deep
// existing-player board. Each hashes shapeName, rows, cols and every arrow line.
test.each([
  [0, 0, 'Diamond', 24, 'b58b2291'],
  [1, 0, 'Teacup', 23, 'c833d047'],
  [12, 12, 'Heart', 96, '307ef328'],
  [917, 0, 'Circle', 156, '7eb15e87'],
  [3827, 1, 'X', 157, '6d68fef5'],
] as const)('W3-21 v2 frozen golden: index %i at switch level %i is %s, %i arrows, checksum %s', (index, switchLevel, shapeName, arrows, expected) => {
  const level = LevelGenerator.generate(index, 2, { switchLevel });
  const lines = [level.shapeName, String(level.board.rows), String(level.board.cols), ...level.board.arrows().map((a) => a.toLine())];
  expect([level.shapeName, level.arrowCount, checksumLines(lines)]).toEqual([shapeName, arrows, expected]);
});

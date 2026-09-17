import { BoardLogic } from '../boardLogic';
import { Difficulties, Difficulty } from '../difficulty';
import { DotNetRandom } from '../dotnetRandom';
import { LevelGenerator } from '../levelGenerator';
import { ShapeLibrary } from '../shapeLibrary';

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
function sweep(version: number, count: number): void {
  if (version !== 1) throw new Error(`sweep: generator version ${version} is not wired up yet`);

  for (let i = 0; i < count; i++) {
    const lvl = LevelGenerator.generate(i);
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
  // 46 is the upper rows clamp at levelGenerator.ts:65. 12 and 24 sample a
  // small and mid-size board so thin features (crescent horns, bolt tips,
  // crown valleys) are exercised well below and at the existing 24-row test.
  const all = [...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool];
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

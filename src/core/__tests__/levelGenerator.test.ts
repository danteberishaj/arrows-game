import { BoardLogic } from '../boardLogic';
import { Difficulties, Difficulty } from '../difficulty';
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

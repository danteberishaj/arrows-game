import { ArrowPath, Cell } from '../arrowPath';
import { BoardLogic } from '../boardLogic';
import { Direction } from '../direction';

// Ported from Assets/_Game/Scripts/Tests/BoardLogicTests.cs.

// ---- helpers -------------------------------------------------------

function findHead(board: BoardLogic, head: Cell): ArrowPath {
  for (const a of board.arrows()) {
    if (a.head.r === head.r && a.head.c === head.c) return a;
  }
  throw new Error(`no arrow with head ${head.r},${head.c}`);
}

/**
 * Repeatedly removes any currently-exitable arrow until none remain or the
 * board is stuck. Mirrors the validator used at level-build time.
 */
function solveGreedy(board: BoardLogic): boolean {
  let progress = true;
  while (progress && !board.isCleared()) {
    progress = false;
    for (const arrow of [...board.arrows()]) {
      if (board.tryRemove(arrow)) {
        progress = true;
        break;
      }
    }
  }
  return board.isCleared();
}

// ---- ArrowPath parsing ---------------------------------------------

test('ArrowPath parses head and bent body', () => {
  const a = ArrowPath.tryParse('2,5,U:DDR');
  expect(a).not.toBeNull();
  expect(a!.headDir).toBe(Direction.Up);
  expect(a!.head).toEqual({ r: 2, c: 5 });
  expect(a!.length).toBe(4); // head + 3 body cells
  expect(a!.contains({ r: 3, c: 5 })).toBe(true); // body: Down
  expect(a!.contains({ r: 4, c: 5 })).toBe(true); // body: Down
  expect(a!.contains({ r: 4, c: 6 })).toBe(true); // body: Right (tail)
  expect(a!.tail).toEqual({ r: 4, c: 6 });
  expect(a!.minRow).toBe(2);
  expect(a!.maxRow).toBe(4);
  expect(a!.minCol).toBe(5);
  expect(a!.maxCol).toBe(6);
  expect(a!.rowSpan).toBe(3);
  expect(a!.colSpan).toBe(2);
});

test('ArrowPath round-trips through line form', () => {
  const bent = ArrowPath.tryParse('2,5,U:DDR');
  expect(bent).not.toBeNull();
  expect(bent!.toLine()).toBe('2,5,U:DDR');

  const single = ArrowPath.tryParse('0,0,R'); // no body
  expect(single).not.toBeNull();
  expect(single!.length).toBe(1);
  expect(single!.toLine()).toBe('0,0,R:');
});

test('ArrowPath rejects malformed lines', () => {
  expect(ArrowPath.tryParse('')).toBeNull();
  expect(ArrowPath.tryParse('   ')).toBeNull();
  expect(ArrowPath.tryParse('1,2')).toBeNull(); // missing direction
  expect(ArrowPath.tryParse('1,2,X')).toBeNull(); // bad direction
  expect(ArrowPath.tryParse('1,2,U:Q')).toBeNull(); // bad step
});

// ---- BoardLogic ----------------------------------------------------

test('parse places arrows and marks cells', () => {
  const board = BoardLogic.parse(3, 3, ['0,0,R', '2,2,U:L']);

  expect(board.rows).toBe(3);
  expect(board.cols).toBe(3);
  expect(board.count()).toBe(2);
  expect(board.isEmpty(0, 0)).toBe(false);
  expect(board.isEmpty(2, 2)).toBe(false);
  expect(board.isEmpty(2, 1)).toBe(false); // body of the second arrow
  expect(board.isEmpty(1, 1)).toBe(true);
});

test('canExit true when runway clear', () => {
  const right = BoardLogic.parse(1, 3, ['0,2,R']); // already at the right edge
  expect(right.canExit(right.arrows()[0])).toBe(true);

  const up = BoardLogic.parse(3, 1, ['0,0,U']); // already at the top edge
  expect(up.canExit(up.arrows()[0])).toBe(true);
});

test('canExit false when blocked by another arrow', () => {
  // Two arrows in a lane both pointing right: the left one is blocked by the right.
  const board = BoardLogic.parse(1, 3, ['0,1,R', '0,2,R']);
  expect(board.canExit(findHead(board, { r: 0, c: 1 }))).toBe(false); // left arrow blocked
  expect(board.canExit(findHead(board, { r: 0, c: 2 }))).toBe(true); // right arrow clear
});

test('canExit ignores own body', () => {
  // Head faces Up with its own body directly above it: an arrow never blocks itself.
  const board = BoardLogic.parse(2, 1, ['1,0,U:U']);
  expect(board.canExit(board.arrows()[0])).toBe(true);
});

test('tryRemove frees path for blocked arrow', () => {
  const board = BoardLogic.parse(1, 3, ['0,1,R', '0,2,R']);
  const left = findHead(board, { r: 0, c: 1 });
  const right = findHead(board, { r: 0, c: 2 });

  expect(board.tryRemove(left)).toBe(false); // blocked, cannot remove yet
  expect(board.tryRemove(right)).toBe(true); // rightmost removable
  expect(board.canExit(left)).toBe(true); // path now clear
  expect(board.tryRemove(left)).toBe(true);
  expect(board.isCleared()).toBe(true);
});

test('greedy removal solves solvable board', () => {
  // A bent arrow blocked by a single-cell arrow that can only leave first.
  const board = BoardLogic.parse(3, 3, [
    '0,0,R:DD', // head (0,0) faces Right; body runs down column 0
    '0,2,U', // single cell at (0,2), already at the top edge
  ]);

  expect(solveGreedy(board)).toBe(true);
  expect(board.isCleared()).toBe(true);
});

test('greedy removal detects deadlock', () => {
  // Two arrows pointing into each other along a row: neither can exit.
  const board = BoardLogic.parse(1, 2, ['0,0,R', '0,1,L']);
  expect(solveGreedy(board)).toBe(false);
  expect(board.count()).toBe(2);
});

test('blockerOf names the first arrow in the lane and null when clear', () => {
  // Three arrows in row 0 all pointing right; the leftmost sees the middle one first.
  const board = BoardLogic.parse(1, 6, ['0,0,R', '0,2,R', '0,4,R']);
  const left = board.ownerAt(0, 0)!;
  const middle = board.ownerAt(0, 2)!;
  const right = board.ownerAt(0, 4)!;
  expect(board.blockerOf(left)).toBe(middle);
  expect(board.blockerOf(middle)).toBe(right);
  expect(board.blockerOf(right)).toBeNull();
  expect(board.blockerOf(null)).toBeNull();
  expect(board.tryRemove(right)).toBe(true);
  expect(board.blockerOf(middle)).toBeNull();
  expect(board.blockerOf(left)).toBe(middle);
});

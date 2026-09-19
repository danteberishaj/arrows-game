import { LevelGenerator } from '../levelGenerator';
import { ArrowPath } from '../arrowPath';
import {
  buildTutorialLevel,
  TUTORIAL_BOARDS,
  type TutorialId,
} from '../tutorialLevels';

const TUTORIAL_IDS: readonly TutorialId[] = ['T1', 'T2'];

function parsedArrows(id: TutorialId): ArrowPath[] {
  return TUTORIAL_BOARDS[id].lines
    .map((line) => ArrowPath.tryParse(line))
    .filter((arrow): arrow is ArrowPath => arrow !== null);
}

test.each(TUTORIAL_IDS)('%s: every line parses and parsed count equals line count', (id) => {
  const parsed = TUTORIAL_BOARDS[id].lines.map((line) => ArrowPath.tryParse(line));

  expect(parsed.every((arrow) => arrow !== null)).toBe(true);
  expect(parsed.filter((arrow) => arrow !== null)).toHaveLength(
    TUTORIAL_BOARDS[id].lines.length,
  );
});

test.each(TUTORIAL_IDS)('%s: no two arrows share a cell', (id) => {
  const occupiedCells = parsedArrows(id).flatMap((arrow) =>
    arrow.cells.map(({ r, c }) => `${r},${c}`),
  );

  expect(new Set(occupiedCells).size).toBe(occupiedCells.length);
});

test.each(TUTORIAL_IDS)('%s: every cell is in bounds', (id) => {
  const { rows, cols } = TUTORIAL_BOARDS[id];
  const everyCellIsInBounds = parsedArrows(id).every((arrow) =>
    arrow.cells.every(({ r, c }) => r >= 0 && r < rows && c >= 0 && c < cols),
  );

  expect(everyCellIsInBounds).toBe(true);
});

test('T1 has every arrow clearable at deal', () => {
  const level = buildTutorialLevel('T1');
  const clearableAtDeal = level.board.arrows().filter((arrow) =>
    level.board.canExit(arrow),
  );

  expect(clearableAtDeal).toHaveLength(level.arrowCount);
});

test('T2 has exactly one exit at deal', () => {
  const level = buildTutorialLevel('T2');
  const clearableAtDeal = level.board.arrows().filter((arrow) =>
    level.board.canExit(arrow),
  );

  expect(clearableAtDeal).toHaveLength(1);
});

test('T2 has at least one arrow visibly blocked by another arrow', () => {
  const { board } = buildTutorialLevel('T2');

  expect(board.arrows().some((arrow) => board.blockerOf(arrow) !== null)).toBe(true);
});

test.each(TUTORIAL_IDS)('%s: greedy solve clears in exactly arrowCount removals', (id) => {
  const level = buildTutorialLevel(id);
  let removals = 0;

  while (!level.board.isCleared()) {
    const arrow = level.board.findHint();
    expect(arrow).not.toBeNull();
    if (arrow === null) break;

    expect(level.board.tryRemove(arrow)).toBe(true);
    removals += 1;
  }

  expect(removals).toBe(level.arrowCount);
});

test('building tutorial boards never calls LevelGenerator.generate', () => {
  const generateSpy = jest.spyOn(LevelGenerator, 'generate');

  expect(() => {
    buildTutorialLevel('T1');
    buildTutorialLevel('T2');
  }).not.toThrow();
  expect(generateSpy).not.toHaveBeenCalled();
  expect(Object.keys(TUTORIAL_BOARDS)).toEqual(['T1', 'T2']);

  generateSpy.mockRestore();
});

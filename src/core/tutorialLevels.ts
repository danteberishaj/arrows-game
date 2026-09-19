import { BoardLogic } from './boardLogic';
import { Difficulty } from './difficulty';
import type { GeneratedLevel } from './levelGenerator';

export type TutorialId = 'T1' | 'T2';

export const TUTORIAL_BOARDS: Readonly<
  Record<TutorialId, {
    rows: number;
    cols: number;
    lines: readonly string[];
  }>
> = {
  T1: {
    // OWNER-PICKED STARTING VALUE: 5x5, six arrows, and these authored coordinates.
    rows: 5,
    cols: 5,
    lines: [
      '0,1,U:D',
      '0,3,U:D',
      '2,0,L:R',
      '2,4,R:L',
      '4,1,D:U',
      '4,3,D:U',
    ],
  },
  T2: {
    // OWNER-PICKED STARTING VALUE: 5x5, five arrows, and these authored coordinates.
    rows: 5,
    cols: 5,
    lines: [
      '2,2,R:L',
      '2,0,R:',
      '1,3,D:U',
      '3,1,U:D',
      '2,4,R:L',
    ],
  },
};

export function buildTutorialLevel(id: TutorialId): GeneratedLevel {
  const { rows, cols, lines } = TUTORIAL_BOARDS[id];
  const board = BoardLogic.parse(rows, cols, lines);
  const authoredCellCount = board.arrows().reduce(
    (cellCount, arrow) => cellCount + arrow.cells.length,
    0,
  );

  const level: GeneratedLevel = {
    board,
    hearts: 3,
    difficulty: Difficulty.Normal,
    arrowCount: board.count(),
    shapeName: '',
    mask: [],
    // Compatibility metadata: every occupied authored cell is an intentional target cell.
    targetCells: authoredCellCount,
  };

  return level;
}

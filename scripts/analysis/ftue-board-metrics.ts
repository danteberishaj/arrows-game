/**
 * Reports board dimensions and legal-move counts for generated levels and,
 * once W1-02 lands, the authored tutorial boards.
 *
 * Run: npx tsx scripts/analysis/ftue-board-metrics.ts --level 0
 *      npx tsx scripts/analysis/ftue-board-metrics.ts --tutorial T1 --viewport 360x549
 *
 * This diagnostic imports only the pure game core. It does not depend on
 * React Native layout code or duplicate a generated board definition.
 */
import * as Core from '../../src/core';
import type { BoardLogic, GeneratedLevel } from '../../src/core';

type TutorialId = 'T1' | 'T2';

interface Viewport {
  w: number;
  h: number;
}

type Selection =
  | { kind: 'level'; levelIndex: number }
  | { kind: 'tutorial'; tutorialId: TutorialId };

interface Options {
  selections: Selection[];
  viewport: Viewport | null;
}

interface BoardMetrics {
  rows: number;
  cols: number;
  arrowCount: number;
  clearableAtDeal: number;
  legalMovesByState: { remaining: number; legal: number }[];
}

type CoreWithTutorials = typeof Core & {
  buildTutorialLevel?: (tutorialId: TutorialId) => GeneratedLevel;
};

const FIT_MARGIN = 0.94; // Matches BoardView's existing fit-to-view formula.

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(
    'Usage: npx tsx scripts/analysis/ftue-board-metrics.ts ' +
      '(--level N | --tutorial T1|T2) [more selections] [--viewport WxH]',
  );
  process.exit(1);
}

function parseNonNegativeInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (value === undefined || !/^\d+$/.test(value) || !Number.isSafeInteger(parsed)) {
    usage(`${flag} requires a non-negative integer`);
  }
  return parsed;
}

function parseTutorialId(value: string | undefined): TutorialId {
  if (value !== 'T1' && value !== 'T2') {
    usage('--tutorial requires T1 or T2');
  }
  return value;
}

function parseViewport(value: string | undefined): Viewport {
  const match = value?.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
  if (!match) usage('--viewport requires positive WxH dimensions, for example 360x549');
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (w <= 0 || h <= 0) usage('--viewport dimensions must be greater than zero');
  return { w, h };
}

function parseArgs(argv: readonly string[]): Options {
  const selections: Selection[] = [];
  let viewport: Viewport | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--level') {
      selections.push({
        kind: 'level',
        levelIndex: parseNonNegativeInteger(argv[++i], '--level'),
      });
    } else if (flag === '--tutorial') {
      selections.push({ kind: 'tutorial', tutorialId: parseTutorialId(argv[++i]) });
    } else if (flag === '--viewport') {
      if (viewport !== null) usage('--viewport may be provided only once');
      viewport = parseViewport(argv[++i]);
    } else {
      usage(`Unknown argument: ${flag}`);
    }
  }

  if (selections.length === 0) usage('Provide at least one --level or --tutorial selection');
  return { selections, viewport };
}

function levelFor(selection: Selection): GeneratedLevel {
  if (selection.kind === 'level') {
    return Core.LevelGenerator.generate(selection.levelIndex);
  }

  const buildTutorialLevel = (Core as CoreWithTutorials).buildTutorialLevel;
  if (!buildTutorialLevel) {
    throw new Error(
      `Tutorial ${selection.tutorialId} is unavailable until W1-02 exports buildTutorialLevel`,
    );
  }
  return buildTutorialLevel(selection.tutorialId);
}

function measureBoard(board: BoardLogic, expectedArrowCount: number): BoardMetrics {
  const arrowCount = board.count();
  if (arrowCount !== expectedArrowCount) {
    throw new Error(
      `board contains ${arrowCount} arrows but level metadata reports ${expectedArrowCount}`,
    );
  }

  const legalMovesByState: { remaining: number; legal: number }[] = [];
  while (!board.isCleared()) {
    const remainingArrows = board.arrows();
    const firstLegal = remainingArrows.find((arrow) => board.canExit(arrow));
    const legal = remainingArrows.reduce(
      (count, arrow) => count + (board.canExit(arrow) ? 1 : 0),
      0,
    );
    legalMovesByState.push({ remaining: remainingArrows.length, legal });

    if (!firstLegal) {
      throw new Error(`greedy solve found no legal move with ${remainingArrows.length} arrows left`);
    }
    if (!board.tryRemove(firstLegal)) {
      throw new Error('greedy solve could not remove the first reported-legal arrow');
    }
  }

  if (legalMovesByState.length !== arrowCount) {
    throw new Error(
      `greedy solve visited ${legalMovesByState.length} states for ${arrowCount} arrows`,
    );
  }

  return {
    rows: board.rows,
    cols: board.cols,
    arrowCount,
    clearableAtDeal: legalMovesByState[0]?.legal ?? 0,
    legalMovesByState,
  };
}

function labelFor(selection: Selection): string {
  return selection.kind === 'level'
    ? `level ${selection.levelIndex}`
    : `tutorial ${selection.tutorialId}`;
}

function printMetrics(selection: Selection, viewport: Viewport | null): void {
  const level = levelFor(selection);
  const metrics = measureBoard(level.board, level.arrowCount);
  const clearablePct = metrics.arrowCount === 0
    ? 0
    : (metrics.clearableAtDeal / metrics.arrowCount) * 100;

  console.log(
    `${labelFor(selection)} rows ${metrics.rows} cols ${metrics.cols} ` +
      `arrows ${metrics.arrowCount} clearable ${metrics.clearableAtDeal} ` +
      `(${clearablePct.toFixed(1)}%)`,
  );
  console.log(
    'legalMovesByState ' +
      metrics.legalMovesByState
        .map(({ remaining, legal }) => `${remaining}:${legal}`)
        .join(','),
  );
  if (viewport) {
    const cellPt = FIT_MARGIN * Math.min(
      viewport.w / metrics.cols,
      viewport.h / metrics.rows,
    );
    console.log(
      `viewport ${viewport.w}x${viewport.h} cellPt ${cellPt.toFixed(2)} ` +
        `(0.94 * min(${viewport.w}/${metrics.cols}, ${viewport.h}/${metrics.rows}))`,
    );
  }
}

const options = parseArgs(process.argv.slice(2));
for (const selection of options.selections) {
  printMetrics(selection, options.viewport);
}

import { pathToFileURL } from 'node:url';
import { LevelGenerator } from '../../../src/core/levelGenerator';

export interface SoakTap {
  row: number;
  col: number;
  /** Exit direction of the tapped arrow's head (src/core/direction.ts: 0 up, 1 down, 2 left, 3 right). */
  dir: number;
}

export interface SoakLevelPlan {
  levelIndex: number;
  displayedLevel: number;
  rows: number;
  cols: number;
  arrowCount: number;
  shapeName: string;
  boardChecksum: string;
  solveChecksum: string;
  taps: SoakTap[];
}

export interface SoakPlan {
  schemaVersion: 1;
  startLevelIndex: number;
  measuredLevelCount: number;
  warmup: SoakLevelPlan;
  measured: SoakLevelPlan[];
}

/**
 * Builds one warmup immediately before the requested measured range. The app
 * can then advance through every level without restarting its Android process.
 */
export function createSoakPlan(startLevelIndex: number, measuredLevelCount: number): SoakPlan {
  if (!Number.isSafeInteger(startLevelIndex) || startLevelIndex < 1) {
    throw new Error('The soak start level must be a safe integer greater than zero');
  }
  if (!Number.isInteger(measuredLevelCount) || measuredLevelCount < 20 || measuredLevelCount > 50) {
    throw new Error('The soak level count must be an integer from 20 through 50');
  }

  return {
    schemaVersion: 1,
    startLevelIndex,
    measuredLevelCount,
    warmup: createLevelPlan(startLevelIndex - 1),
    measured: Array.from(
      { length: measuredLevelCount },
      (_, offset) => createLevelPlan(startLevelIndex + offset),
    ),
  };
}

function createLevelPlan(levelIndex: number): SoakLevelPlan {
  const generated = LevelGenerator.generate(levelIndex);
  const initialLines = generated.board.arrows().map((arrow) => arrow.toLine());
  const taps: SoakTap[] = [];

  while (!generated.board.isCleared()) {
    const arrow = generated.board.findHint();
    if (arrow === null) {
      throw new Error(`Level ${levelIndex} has no valid move with ${generated.board.count()} arrows left`);
    }
    const owner = generated.board.ownerAt(arrow.head.r, arrow.head.c);
    if (owner !== arrow || !generated.board.tryRemove(arrow)) {
      throw new Error(`Level ${levelIndex} produced an invalid solve head at ${arrow.head.r},${arrow.head.c}`);
    }
    taps.push({ row: arrow.head.r, col: arrow.head.c, dir: arrow.headDir });
  }

  if (taps.length !== generated.arrowCount) {
    throw new Error(
      `Level ${levelIndex} solved ${taps.length}/${generated.arrowCount} generated arrows`,
    );
  }

  return {
    levelIndex,
    displayedLevel: levelIndex + 1,
    rows: generated.board.rows,
    cols: generated.board.cols,
    arrowCount: generated.arrowCount,
    shapeName: generated.shapeName,
    boardChecksum: checksum(initialLines),
    solveChecksum: checksum(taps.map(({ row, col }) => `${row},${col}`)),
    taps,
  };
}

function checksum(lines: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let index = 0; index < line.length; index += 1) {
      hash ^= line.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseCli(argv: string[]): { startLevelIndex: number; measuredLevelCount: number } {
  let startLevelIndex: number | null = null;
  let measuredLevelCount: number | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const rawValue = argv[++index];
    if (rawValue === undefined) throw new Error(`${option} requires a value`);
    if (option === '--start-level') startLevelIndex = Number(rawValue);
    else if (option === '--measured-levels') measuredLevelCount = Number(rawValue);
    else throw new Error(`Unknown option: ${option}`);
  }
  if (startLevelIndex === null) throw new Error('--start-level is required');
  if (measuredLevelCount === null) throw new Error('--measured-levels is required');
  return { startLevelIndex, measuredLevelCount };
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(createSoakPlan(
    options.startLevelIndex,
    options.measuredLevelCount,
  ))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

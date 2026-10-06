import { pathToFileURL } from 'node:url';
import type { GenVersion } from '../../../src/core/generatorVersion';
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

export interface BlockedTap {
  row: number;
  col: number;
}

/** W3-15: one level for the single-level workload, with its generator version and blocked cells. */
export interface SingleLevelPlan extends SoakLevelPlan {
  genVersion: GenVersion;
  /**
   * Three cells owned by three different arrows that are all blocked on the
   * fresh board. The `blocked` phase taps the first; validation taps all three
   * (a blocked arrow costs one heart the first time only, src/ui/tapRules.ts).
   */
  blockedTaps: BlockedTap[];
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
export function createSoakPlan(
  startLevelIndex: number,
  measuredLevelCount: number,
  version: GenVersion = 1,
): SoakPlan {
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
    warmup: createLevelPlan(startLevelIndex - 1, version),
    measured: Array.from(
      { length: measuredLevelCount },
      (_, offset) => createLevelPlan(startLevelIndex + offset, version),
    ),
  };
}

/**
 * W3-15: level 3827 on v1 keeps the cells every earlier run tapped. (35,19)
 * owns "35,19,R:LLU", (31,14) owns "31,17,R:LLLLL", (30,21) owns
 * "31,22,D:UULDD"; all blocked at the start of the mission (benchmark.mjs
 * comment before W3-15). Checked against the board, not trusted.
 */
const HISTORICAL_3827_BLOCKED_TAPS: readonly BlockedTap[] = [
  { row: 35, col: 19 },
  { row: 31, col: 14 },
  { row: 30, col: 21 },
];
// Any other level: blocked heads nearest the spot (35,19) occupies on the 39x39
// harness board, scaled to this grid, so the tap lands in the same region.
const BLOCKED_ANCHOR = { row: 35 / 39, col: 19 / 39 };

/**
 * W3-15: the single-level workload's plan. `version` must match the PERF
 * build's EXPO_PUBLIC_PERF_GEN_VERSION, or every tap misses the board.
 */
export function createSingleLevelPlan(levelIndex: number, version: GenVersion = 1): SingleLevelPlan {
  if (!Number.isSafeInteger(levelIndex) || levelIndex < 0) {
    throw new Error('The single-level index must be a safe integer of at least zero');
  }
  const plan = createLevelPlan(levelIndex, version);
  const fresh = LevelGenerator.generate(levelIndex, version).board;
  const blockedOwner = (tap: BlockedTap) => {
    const owner = fresh.ownerAt(tap.row, tap.col);
    return owner !== null && !fresh.canExit(owner) ? owner : null;
  };
  let blockedTaps: BlockedTap[];
  if (levelIndex === 3827 && version === 1) {
    blockedTaps = HISTORICAL_3827_BLOCKED_TAPS.map((tap) => ({ ...tap }));
  } else {
    const anchorRow = BLOCKED_ANCHOR.row * (fresh.rows - 1);
    const anchorCol = BLOCKED_ANCHOR.col * (fresh.cols - 1);
    blockedTaps = fresh.arrows()
      .filter((arrow) => !fresh.canExit(arrow))
      .map((arrow) => ({ row: arrow.head.r, col: arrow.head.c }))
      .sort((a, b) =>
        Math.hypot(a.row - anchorRow, a.col - anchorCol) - Math.hypot(b.row - anchorRow, b.col - anchorCol) ||
        a.row - b.row || a.col - b.col)
      .slice(0, 3);
  }
  const owners = blockedTaps.map(blockedOwner);
  if (owners.length !== 3 || owners.some((owner) => owner === null) || new Set(owners).size !== 3) {
    throw new Error(`Level ${levelIndex} (v${version}) has no three distinct blocked arrows to tap`);
  }
  return { ...plan, genVersion: version, blockedTaps };
}

/**
 * `version` (W3-05, default 1) must match the generator version the PERF build
 * deals (EXPO_PUBLIC_PERF_GEN_VERSION, unset = 1), or the taps miss the board.
 */
function createLevelPlan(levelIndex: number, version: GenVersion = 1): SoakLevelPlan {
  const generated = LevelGenerator.generate(levelIndex, version);
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

interface CliOptions {
  startLevelIndex: number | null;
  measuredLevelCount: number | null;
  singleLevelIndex: number | null;
  version: GenVersion;
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    startLevelIndex: null,
    measuredLevelCount: null,
    singleLevelIndex: null,
    version: 1,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const rawValue = argv[++index];
    if (rawValue === undefined) throw new Error(`${option} requires a value`);
    if (option === '--start-level') options.startLevelIndex = Number(rawValue);
    else if (option === '--measured-levels') options.measuredLevelCount = Number(rawValue);
    else if (option === '--single-level') options.singleLevelIndex = Number(rawValue);
    else if (option === '--gen-version') {
      if (rawValue !== '1' && rawValue !== '2') throw new Error('--gen-version must be 1 or 2');
      options.version = rawValue === '2' ? 2 : 1;
    } else throw new Error(`Unknown option: ${option}`);
  }
  if (options.singleLevelIndex !== null) return options;
  if (options.startLevelIndex === null) throw new Error('--start-level is required');
  if (options.measuredLevelCount === null) throw new Error('--measured-levels is required');
  return options;
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  const plan = options.singleLevelIndex !== null
    ? createSingleLevelPlan(options.singleLevelIndex, options.version)
    : createSoakPlan(options.startLevelIndex!, options.measuredLevelCount!, options.version);
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

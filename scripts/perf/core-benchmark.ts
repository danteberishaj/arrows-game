import { performance } from 'node:perf_hooks';
import { BoardLogic, LevelGenerator } from '../../src/core';
import { arrowArt } from '../../src/ui/arrowGeometry';

const DEFAULT_LEVELS = [239, 917, 935, 3827, 5363];
const CELL = 40;

interface Options {
  levels: number[];
  warmup: number;
  runs: number;
  batch: number;
  pretty: boolean;
  metadataOnly: boolean;
}

interface Stats {
  count: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

interface Fixture {
  level: number;
  rows: number;
  cols: number;
  arrowCount: number;
  shapeName: string;
  lines: string[];
  checksum: string;
  blocked: { r: number; c: number } | null;
  free: { r: number; c: number } | null;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    levels: [],
    warmup: 5,
    runs: 30,
    batch: 20,
    pretty: false,
    metadataOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--metadata') options.metadataOnly = true;
    else if (arg === '--level') options.levels.push(...parseLevels(argv[++i], '--level'));
    else if (arg === '--warmup') options.warmup = parseNonNegativeInt(argv[++i], '--warmup');
    else if (arg === '--runs') options.runs = parsePositiveInt(argv[++i], '--runs');
    else if (arg === '--batch') options.batch = parsePositiveInt(argv[++i], '--batch');
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.levels.length === 0) options.levels = [...DEFAULT_LEVELS];
  options.levels = [...new Set(options.levels)];
  return options;
}

function parseLevels(raw: string | undefined, flag: string): number[] {
  if (raw === undefined) throw new Error(`${flag} requires a value`);
  return raw.split(',').map((part) => parseNonNegativeInt(part.trim(), flag));
}

function parsePositiveInt(raw: string | undefined, flag: string): number {
  const value = parseNonNegativeInt(raw, flag);
  if (value === 0) throw new Error(`${flag} must be greater than zero`);
  return value;
}

function parseNonNegativeInt(raw: string | undefined, flag: string): number {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(`${flag} requires a non-negative integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${flag} is outside the safe integer range`);
  return value;
}

function buildFixture(level: number): Fixture {
  const generated = LevelGenerator.generate(level);
  const arrows = [...generated.board.arrows()];
  const lines = arrows.map((arrow) => arrow.toLine());
  const blockedArrow = arrows.find((arrow) => !generated.board.canExit(arrow)) ?? null;
  const freeArrow = generated.board.findHint();

  return {
    level,
    rows: generated.board.rows,
    cols: generated.board.cols,
    arrowCount: generated.arrowCount,
    shapeName: generated.shapeName,
    lines,
    checksum: checksum(lines),
    blocked: blockedArrow ? { ...blockedArrow.head } : null,
    free: freeArrow ? { ...freeArrow.head } : null,
  };
}

function checksum(lines: readonly string[]): string {
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

function stats(values: readonly number[]): Stats {
  if (values.length === 0) throw new Error('Cannot summarize an empty sample set');
  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: sorted[0],
    mean: total / values.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

function solve(board: BoardLogic): number {
  let removed = 0;
  while (!board.isCleared()) {
    const hint = board.findHint();
    if (!hint || !board.tryRemove(hint)) throw new Error('Generated board could not be solved through hints');
    removed++;
  }
  return removed;
}

function runTimed(options: Options, fixtures: readonly Fixture[]) {
  const generationMs: number[] = [];
  const geometryMs: number[] = [];
  const keysMs: number[] = [];
  const solveHintMs: number[] = [];
  let sink = 0;

  const runRound = (record: boolean) => {
    for (const fixture of fixtures) {
      for (let batch = 0; batch < options.batch; batch++) {
        let started = performance.now();
        const generated = LevelGenerator.generate(fixture.level);
        let elapsed = performance.now() - started;
        if (record) generationMs.push(elapsed);
        sink += generated.arrowCount;

        const arrows = generated.board.arrows();
        started = performance.now();
        for (const arrow of arrows) {
          const art = arrowArt(arrow, CELL);
          sink += art.shaftD.length + art.headD.length;
        }
        elapsed = performance.now() - started;
        if (record) geometryMs.push(elapsed);

        started = performance.now();
        for (const arrow of arrows) sink += arrow.toLine().length;
        elapsed = performance.now() - started;
        if (record) keysMs.push(elapsed);

        const board = BoardLogic.parse(fixture.rows, fixture.cols, fixture.lines);
        started = performance.now();
        sink += solve(board);
        elapsed = performance.now() - started;
        if (record) solveHintMs.push(elapsed);
      }
    }
  };

  for (let round = 0; round < options.warmup; round++) runRound(false);
  for (let round = 0; round < options.runs; round++) runRound(true);

  return {
    generationMs: stats(generationMs),
    geometryMs: stats(geometryMs),
    keysMs: stats(keysMs),
    solveHintMs: stats(solveHintMs),
    sink,
  };
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const fixtures = options.levels.map(buildFixture);

  if (options.metadataOnly) {
    const metadata = fixtures.map(({ lines: _lines, ...fixture }) => fixture);
    const output = metadata.length === 1 ? metadata[0] : metadata;
    process.stdout.write(`${JSON.stringify(output, null, options.pretty ? 2 : undefined)}\n`);
    return;
  }

  const metrics = runTimed(options, fixtures);
  const output = {
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    config: {
      levels: options.levels,
      warmup: options.warmup,
      runs: options.runs,
      batch: options.batch,
    },
    fixtures: fixtures.map(({ lines: _lines, ...fixture }) => fixture),
    metrics,
  };
  process.stdout.write(`${JSON.stringify(output, null, options.pretty ? 2 : undefined)}\n`);
}

main();

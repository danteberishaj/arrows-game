/**
 * W6-01: pure-JS cost of the visibility-mask rebuild on the blocked-tap path.
 *
 * A blocked tap sets `shaking` and clears it BLOCKED_BUMP_MS + 40 ms later.
 * Each change makes BoardView build a new `excludedArrows` set, which
 * invalidates the `nativeVisibilityMask` memo (src/ui/BoardView.tsx), which
 * calls BoardArrowArtCache.visibilityMask over every arrow. One cycle here is
 * exactly that: excluded set with the arrow, mask, excluded set without it,
 * mask. The memo body the on-device timer wraps is the visibilityMask call
 * alone, so mask builds are also reported one by one.
 *
 * Usage: npx tsx scripts/perf/mask-rebuild-benchmark.ts [--level 0,168,3827]
 *        [--warmup 200] [--cycles 2000] [--json]
 */
import { execFileSync } from 'node:child_process';
import { loadavg } from 'node:os';
import { performance } from 'node:perf_hooks';
import { LevelGenerator, type ArrowPath } from '../../src/core';
import { BoardArrowArtCache } from '../../src/ui/arrowGeometry';

const DEFAULT_LEVELS = [0, 168, 3827];
// BoardView builds its cache with `new BoardArrowArtCache(board.arrows(), CELL)`
// and CELL = 40 (src/ui/BoardView.tsx). Importing BoardView would pull React
// Native into node, so the value is repeated here.
const CELL = 40;
const MIN_CYCLES = 1000;

interface Options {
  levels: number[];
  warmup: number;
  cycles: number;
  json: boolean;
}

interface Stats {
  n: number;
  min: number;
  minNonZero: number | null;
  median: number;
  p95: number;
  max: number;
}

function parseOptions(argv: string[]): Options {
  const options: Options = { levels: [], warmup: 200, cycles: 2000, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--level') options.levels.push(...parseIntList(argv[++i], '--level'));
    else if (arg === '--warmup') options.warmup = parseIntList(argv[++i], '--warmup')[0];
    else if (arg === '--cycles') options.cycles = parseIntList(argv[++i], '--cycles')[0];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.levels.length === 0) options.levels = [...DEFAULT_LEVELS];
  if (options.cycles < MIN_CYCLES) {
    throw new Error(`--cycles must be at least ${MIN_CYCLES} (brief W6-01)`);
  }
  return options;
}

function parseIntList(raw: string | undefined, flag: string): number[] {
  if (raw === undefined) throw new Error(`${flag} requires a value`);
  return raw.split(',').map((part) => {
    if (!/^\d+$/.test(part.trim())) throw new Error(`${flag} requires non-negative integers`);
    return Number(part.trim());
  });
}

function stats(values: readonly number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return {
    n: sorted.length,
    min: sorted[0],
    minNonZero: sorted.find((value) => value > 0) ?? null,
    median: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
  };
}

function uptimeLoad(): string {
  try {
    return execFileSync('uptime', { encoding: 'utf8' }).trim();
  } catch {
    return `loadavg ${loadavg().map((value) => value.toFixed(2)).join(' ')}`;
  }
}

/** Same construction as BoardView's `excludedArrows` memo. */
function excludedFor(shaking: ArrowPath | null): Set<ArrowPath> {
  const excluded = new Set<ArrowPath>();
  if (shaking) excluded.add(shaking);
  return excluded;
}

function measureLevel(level: number, options: Options) {
  const generated = LevelGenerator.generate(level);
  const board = generated.board;
  const arrows = board.arrows();
  const cache = new BoardArrowArtCache(arrows, CELL);
  const blocked = arrows.find((arrow) => !board.canExit(arrow)) ?? null;
  // The mask cost does not depend on whether the arrow is blocked; a board
  // with no blocked arrow still gets timed, on its first arrow, and says so.
  const tapped = blocked ?? arrows[0];

  const withArrow = cache.visibilityMask(arrows, excludedFor(tapped));
  const without = cache.visibilityMask(arrows, excludedFor(null));
  const zerosWith = withArrow.split('').filter((ch) => ch === '0').length;
  const zerosWithout = without.split('').filter((ch) => ch === '0').length;
  if (withArrow.length !== arrows.length || zerosWith !== zerosWithout + 1) {
    throw new Error(`level ${level}: mask does not reflect the tapped arrow`);
  }

  const cycleMs: number[] = [];
  const maskBuildMs: number[] = [];
  let sink = 0;
  const total = options.warmup + options.cycles;
  for (let cycle = 0; cycle < total; cycle++) {
    const record = cycle >= options.warmup;
    const cycleStart = performance.now();

    const excludedOn = excludedFor(tapped);
    let start = performance.now();
    const maskOn = cache.visibilityMask(arrows, excludedOn);
    const firstBuild = performance.now() - start;

    const excludedOff = excludedFor(null);
    start = performance.now();
    const maskOff = cache.visibilityMask(arrows, excludedOff);
    const secondBuild = performance.now() - start;

    const cycleElapsed = performance.now() - cycleStart;
    sink += maskOn.length + maskOff.length;
    if (record) {
      cycleMs.push(cycleElapsed);
      maskBuildMs.push(firstBuild, secondBuild);
    }
  }
  if (sink !== total * 2 * arrows.length) throw new Error(`level ${level}: sink mismatch`);

  return {
    level,
    arrowCount: arrows.length,
    rows: board.rows,
    cols: board.cols,
    tappedArrow: tapped.toLine(),
    tappedArrowBlocked: blocked !== null,
    warmupCycles: options.warmup,
    measuredCycles: options.cycles,
    expectedMaskBuilds: options.cycles * 2,
    cycleMs: stats(cycleMs),
    maskBuildMs: stats(maskBuildMs),
  };
}

function fmt(value: number | null): string {
  return value === null ? 'none' : value.toFixed(4);
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const loadBefore = uptimeLoad();
  const results = options.levels.map((level) => measureLevel(level, options));
  const loadAfter = uptimeLoad();
  const output = {
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    hostLoadBefore: loadBefore,
    hostLoadAfter: loadAfter,
    config: { levels: options.levels, warmup: options.warmup, cycles: options.cycles, cell: CELL },
    results,
  };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }
  const lines = [
    `node ${process.version} ${process.platform}/${process.arch}`,
    `uptime before: ${loadBefore}`,
    `uptime after:  ${loadAfter}`,
    `warmup ${options.warmup} cycles, measured ${options.cycles} cycles per level (ms)`,
  ];
  for (const result of results) {
    lines.push(
      `level ${result.level}: ${result.arrowCount} arrows (${result.rows}x${result.cols}), ` +
      `tapped ${result.tappedArrow} blocked=${result.tappedArrowBlocked}`,
    );
    for (const [name, s, expected] of [
      ['  cycle     ', result.cycleMs, result.measuredCycles],
      ['  maskBuild ', result.maskBuildMs, result.expectedMaskBuilds],
    ] as const) {
      lines.push(
        `${name} n=${s.n} (expected ${expected}) min=${fmt(s.min)} ` +
        `minNonZero=${fmt(s.minNonZero)} median=${fmt(s.median)} p95=${fmt(s.p95)} max=${fmt(s.max)}`,
      );
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();

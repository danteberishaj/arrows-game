/**
 * Difficulty probe (generator v1, and v2 since W3-10): a uniform-sampling
 * search-cost proxy over the shipping generator, so every later W3 task pins a
 * number that this script actually measured instead of an invented threshold.
 * `--version 2` drives `LevelGenerator.generate(i, 2)` (dark behind
 * GEN_V2_ENABLED) and measures its clamp at `V2_MAX_GRID_DIM`.
 *
 * Run: npx tsx scripts/analysis/difficulty-probe.ts -- <flags>
 * (or `npm run analysis:probe -- <flags>`)
 *
 * Imports only `src/core` — no React, no `src/ui`. It drives the shipping
 * `LevelGenerator.generate`, `BoardLogic.canExit` and `tryRemove` to an empty
 * board; it never reads `DifficultyConfig` back as an outcome.
 *
 * Because `BoardLogic.tryRemove` only empties cells, `canExit` is monotone
 * and no tap order can brick a board (see `boardLogic.ts`): the only cost a
 * player pays is *search*. If a player samples uniformly without
 * replacement, the expected number of arrows examined before finding a
 * clearable one is `(n+1)/(k+1)`, where n is arrows left and k is arrows
 * clearable right now; the expected number of WRONG looks is `(n-k)/(k+1)`.
 * The walk below removes the first clearable arrow in `board.arrows()` order
 * at each step and sums both quantities over every state, so a level's
 * printed `scanTaps`/`blockedTaps` always differ by exactly its `arrowCount`
 * (each removal is one look that succeeds).
 *
 * This is a PROXY, not a measurement of human difficulty — see the printed
 * HONESTY_BOUND below and W3-23, which is the task that will (or will not)
 * correlate it with real play.
 */
import {
  ArrowPath,
  Difficulties,
  Difficulty,
  DotNetRandom,
  LevelGenerator,
  SHAPE_CATALOGUE,
  ShapeDef,
  ShapeLibrary,
  V2_MAX_GRID_DIM,
  bagCandidates,
  bagWindowFor,
  placeholderWindowMaxTarget,
  shapeCapacity,
  v2Cols,
  windowSetAt,
} from '../../src/core';

const HONESTY_BOUND =
  'Search-cost proxy for a uniform-sampling player. Not a measurement of ' +
  'human difficulty; never correlated with real mistakes (see W3-23).';

// Fixed cumulative fractions of a level range used by --bands, chosen so a
// 1..240 range reproduces the bands 1-30/31-60/61-120/121-180/181-240 named
// in the W3-01 brief (30,30,60,60,60 are 1/8,1/8,1/4,1/4,1/4 of 240). Any
// other --levels range is split proportionally by the same fractions.
const BAND_FRACTIONS = [1 / 8, 1 / 4, 1 / 2, 3 / 4, 1] as const;

type Mode = 'rows' | 'per-tier' | 'bands' | 'shape-report' | 'tier-report' | 'capacity' | 'clamp-shortfall';

interface Viewport {
  w: number;
  h: number;
}

interface Options {
  levels: readonly [number, number] | null; // displayed (1-based), inclusive
  version: 1 | 2;
  viewport: Viewport | null;
  json: boolean;
  /** Aggregate modes run in the order given (W3-10: `--shape-report --clamp-shortfall`). */
  modes: readonly Mode[];
}

interface LevelRow {
  level: number; // displayed, 1-based
  index: number; // 0-based, matches LevelGenerator.generate's argument
  tier: Difficulty;
  shapeName: string;
  rows: number;
  cols: number;
  maskCells: number;
  arrowCount: number;
  targetCells: number;
  clearableAtDeal: number;
  clearablePct: number;
  scanTaps: number;
  blockedTaps: number;
  minClearable: number; // min k over states with n > 1; see buildRow's comment
  worstN: number;
  worstK: number;
  bendRate: number; // 0..1, share of arrows with >= 1 direction change
  meanLen: number;
  cellPt: number | null;
}

// ---- CLI parsing -----------------------------------------------------------

function parseArgs(argv: readonly string[]): Options {
  let levels: [number, number] | null = null;
  let version: 1 | 2 = 1;
  let viewport: Viewport | null = null;
  let json = false;
  const modeFlags: Mode[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--levels':
        levels = parseLevelsRange(argv[++i]);
        break;
      case '--version': {
        const raw = argv[++i];
        if (raw !== '1' && raw !== '2') throw new Error('--version must be 1 or 2');
        version = Number(raw) as 1 | 2;
        break;
      }
      case '--viewport':
        viewport = parseViewport(argv[++i]);
        break;
      case '--json':
        json = true;
        break;
      case '--per-tier':
      case '--bands':
      case '--shape-report':
      case '--tier-report':
      case '--capacity':
      case '--clamp-shortfall':
        modeFlags.push(arg.slice(2) as Mode);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (modeFlags.length > 1 && json) {
    throw new Error(`--json takes one aggregate mode at a time; got ${modeFlags.join(', ')}`);
  }
  const modes: Mode[] = modeFlags.length === 0 ? ['rows'] : [...new Set(modeFlags)];
  for (const mode of modes) {
    if (mode !== 'capacity' && levels === null) {
      const flagName = mode === 'rows' ? '(the default row mode)' : `--${mode}`;
      throw new Error(`--levels a-b is required for ${flagName}`);
    }
  }
  return { levels, version, viewport, json, modes };
}

/** The grid clamp a generator version sizes against (v1's literal 46; v2's V2_MAX_GRID_DIM). */
function maxDimFor(version: 1 | 2): number {
  return version === 2 ? V2_MAX_GRID_DIM : 46;
}

function parseLevelsRange(raw: string | undefined): [number, number] {
  if (raw === undefined) throw new Error('--levels requires a value, e.g. --levels 1-1000');
  const m = /^(\d+)-(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`--levels must look like "a-b" (displayed level numbers); got "${raw}"`);
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (lo < 1 || hi < lo) throw new Error(`--levels range must satisfy 1 <= a <= b; got "${raw}"`);
  return [lo, hi];
}

function parseViewport(raw: string | undefined): Viewport {
  if (raw === undefined) throw new Error('--viewport requires a value, e.g. --viewport 360x640');
  const m = /^(\d+)x(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`--viewport must look like "WxH"; got "${raw}"`);
  return { w: Number(m[1]), h: Number(m[2]) };
}

function indicesInRange(levels: readonly [number, number]): number[] {
  const [lo, hi] = levels;
  const out: number[] = [];
  for (let displayed = lo; displayed <= hi; displayed++) out.push(displayed - 1);
  return out;
}

// ---- Shared measurement ------------------------------------------------

function countTrue(mask: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of mask) for (const cell of row) if (cell) n++;
  return n;
}

/** True if the arrow's path turns 90 degrees anywhere along its body. */
function hasBend(arrow: ArrowPath): boolean {
  const cells = arrow.cells;
  if (cells.length < 3) return false; // needs 2 segments to have a turn between them
  let dr0 = 0, dc0 = 0;
  for (let i = 1; i < cells.length; i++) {
    const dr = cells[i].r - cells[i - 1].r;
    const dc = cells[i].c - cells[i - 1].c;
    if (i === 1) { dr0 = dr; dc0 = dc; }
    else if (dr !== dr0 || dc !== dc0) return true;
  }
  return false;
}

/**
 * The "higher median" (sorted[floor(n/2)], 0-based): for odd n this is the
 * exact middle value; for even n it is the upper of the two middle values.
 * Calibrated against the W3-01 brief's Context numbers, which this specific
 * convention reproduces exactly (verified for tier and band scan/blocked
 * medians and for arrow-count p50s at both odd and even sample sizes).
 */
function median(sortedAscending: readonly number[]): number {
  if (sortedAscending.length === 0) throw new Error('median of an empty sample');
  return sortedAscending[Math.floor(sortedAscending.length / 2)];
}

function ascending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Generates level `index`, then walks it to empty removing the first
 * clearable arrow in `board.arrows()` order at each step, accumulating the
 * uniform-sampling scan/blocked proxy. Asserts the board clears in exactly
 * `arrowCount` removals (the in-probe reconciliation that proves every board
 * was fully walked) and exits non-zero otherwise.
 */
function buildRow(index: number, version: 1 | 2, viewport: Viewport | null): LevelRow {
  const level = LevelGenerator.generate(index, version);
  const board = level.board;
  const maskCells = countTrue(level.mask);
  const arrowCount = level.arrowCount;

  const startingArrows = [...board.arrows()];
  let bentCount = 0;
  let totalLen = 0;
  for (const arrow of startingArrows) {
    totalLen += arrow.length;
    if (hasBend(arrow)) bentCount++;
  }

  let scanTaps = 0;
  let blockedTaps = 0;
  let minClearable = Infinity;
  let worstRatio = -Infinity;
  let worstN = 0;
  let worstK = 0;
  let clearableAtDeal = 0;
  let removals = 0;

  while (!board.isCleared()) {
    const remaining = board.arrows();
    const n = remaining.length;
    let k = 0;
    let firstClearable: ArrowPath | null = null;
    for (const arrow of remaining) {
      if (board.canExit(arrow)) {
        k++;
        if (firstClearable === null) firstClearable = arrow;
      }
    }
    if (removals === 0) clearableAtDeal = k;
    // Every walk's LAST state has exactly n=1, k=1 by construction (the
    // final arrow must be clearable or the walk would have thrown above),
    // so a min-over-all-states definition is 1 for every level — not a
    // measurement (fix round 1, task-review finding on scripts/analysis/
    // difficulty-probe.ts:240: EXECUTED --levels 1-1000 --json gave the
    // histogram {1: 1000}). Excluding that degenerate n=1 state lets the
    // column vary: it is the fewest simultaneously-clearable arrows seen at
    // any state that still has more than one arrow left, i.e. the tightest
    // real bottleneck a uniform-sampling player would have faced before the
    // forced last pick.
    if (n > 1 && k < minClearable) minClearable = k;
    const ratio = k > 0 ? n / k : Infinity;
    if (ratio > worstRatio) { worstRatio = ratio; worstN = n; worstK = k; }

    scanTaps += (n + 1) / (k + 1);
    blockedTaps += (n - k) / (k + 1);

    if (firstClearable === null) {
      throw new Error(`level index ${index}: no clearable arrow with ${n} remaining (unsolvable state)`);
    }
    if (!board.tryRemove(firstClearable)) {
      throw new Error(`level index ${index}: tryRemove failed on a reported-clearable arrow`);
    }
    removals++;
  }

  if (removals !== arrowCount) {
    throw new Error(
      `level index ${index}: walk removed ${removals} arrows but arrowCount is ${arrowCount} — ` +
        'the board was not fully reconciled',
    );
  }

  return {
    level: index + 1,
    index,
    tier: level.difficulty,
    shapeName: level.shapeName,
    rows: level.board.rows,
    cols: level.board.cols,
    maskCells,
    arrowCount,
    targetCells: level.targetCells,
    clearableAtDeal,
    clearablePct: (clearableAtDeal / arrowCount) * 100,
    scanTaps,
    blockedTaps,
    // Infinity only if arrowCount <= 1 (no state ever had n > 1); not hit by
    // any level in the committed baseline ranges (min arrowCount is 47).
    minClearable: minClearable === Infinity ? 0 : minClearable,
    worstN,
    worstK,
    bendRate: bentCount / arrowCount,
    meanLen: totalLen / arrowCount,
    cellPt: viewport ? 0.94 * Math.min(viewport.w / level.board.cols, viewport.h / level.board.rows) : null,
  };
}

// ---- Table rendering --------------------------------------------------

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function printHonestyBound(): void {
  console.log(HONESTY_BOUND);
  console.log('');
}

// ---- Modes --------------------------------------------------------------

function runRows(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, opts.viewport));

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'rows', version: opts.version, levels: opts.levels, rows }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Level rows for displayed levels ${opts.levels![0]}-${opts.levels![1]} (index ${indices[0]}-${indices[indices.length - 1]})`);
  console.log('');
  const headers = [
    'level', 'index', 'tier', 'shape', 'rows×cols', 'mask cells', 'arrows', 'targetCells',
    'clearable@0', 'clearable%', 'scanTaps', 'blockedTaps', 'minClearable', 'worst n/k', 'bend%', 'meanLen',
  ];
  if (opts.viewport) headers.push('cellPt');
  const body = rows.map((r) => {
    const cols: (string | number)[] = [
      r.level, r.index, Difficulties.displayName(r.tier), r.shapeName, `${r.rows}×${r.cols}`,
      r.maskCells, r.arrowCount, r.targetCells, r.clearableAtDeal, fmtPct(r.clearablePct),
      Math.round(r.scanTaps), Math.round(r.blockedTaps), r.minClearable, `${r.worstN}/${r.worstK}`,
      fmtPct(r.bendRate * 100), r.meanLen.toFixed(2),
    ];
    if (opts.viewport) cols.push(r.cellPt!.toFixed(1));
    return cols;
  });
  console.log(table(headers, body));
}

function runPerTier(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, null));
  const tiers = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard];
  const byTier = new Map<Difficulty, LevelRow[]>(tiers.map((t) => [t, []]));
  for (const r of rows) byTier.get(r.tier)!.push(r);

  const data = tiers.map((tier) => {
    const s = byTier.get(tier)!;
    const arrows = ascending(s.map((r) => r.arrowCount));
    const scan = ascending(s.map((r) => r.scanTaps));
    const blocked = ascending(s.map((r) => r.blockedTaps));
    return {
      tier: Difficulties.displayName(tier),
      n: s.length,
      arrowsMin: arrows[0],
      arrowsP50: median(arrows),
      arrowsMax: arrows[arrows.length - 1],
      medianScan: Math.round(median(scan)),
      medianBlocked: Math.round(median(blocked)),
    };
  });

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'per-tier', levels: opts.levels, tiers: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Per-tier stats over displayed levels ${opts.levels![0]}-${opts.levels![1]}`);
  console.log('');
  console.log(table(
    ['Tier', 'n', 'arrows min', 'p50', 'max', 'median scan', 'median blocked'],
    data.map((d) => [d.tier, d.n, d.arrowsMin, d.arrowsP50, d.arrowsMax, d.medianScan, d.medianBlocked]),
  ));
}

function runBands(opts: Options): void {
  const [lo, hi] = opts.levels!;
  const length = hi - lo + 1;
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, null));

  const bands: { lo: number; hi: number; rows: LevelRow[] }[] = [];
  let prevBoundary = 0;
  for (const frac of BAND_FRACTIONS) {
    const upTo = Math.round(length * frac);
    const bandLo = lo + prevBoundary;
    const bandHi = lo + upTo - 1;
    if (bandHi >= bandLo) bands.push({ lo: bandLo, hi: bandHi, rows: rows.slice(prevBoundary, upTo) });
    prevBoundary = upTo;
  }

  const data = bands.map((b) => {
    const scan = ascending(b.rows.map((r) => r.scanTaps));
    const blocked = ascending(b.rows.map((r) => r.blockedTaps));
    const arrows = ascending(b.rows.map((r) => r.arrowCount));
    return {
      range: `${b.lo}-${b.hi}`,
      n: b.rows.length,
      medianScan: Math.round(median(scan)),
      medianBlocked: Math.round(median(blocked)),
      arrowsP50: median(arrows),
    };
  });

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'bands', levels: opts.levels, bands: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Bands over displayed levels ${lo}-${hi} (fixed cumulative fractions ${BAND_FRACTIONS.map((f) => f.toFixed(3)).join(', ')})`);
  console.log('');
  console.log(table(
    ['band', 'n', 'median scan', 'median blocked', 'arrows p50'],
    data.map((d) => [d.range, d.n, d.medianScan, d.medianBlocked, d.arrowsP50]),
  ));
}

/**
 * The longest run of levels with no first appearance, measured from the
 * range's first level to each first appearance in turn (W3-01's "novelty
 * drought": v1 levels 1-200 go from Crown@60 to Hexagon@117, 57 levels).
 */
function longestFirstAppearanceGap(
  firstLevel: number,
  firstAppearance: ReadonlyMap<string, number>,
): { gap: number; from: number; to: number } {
  const firsts = [...new Set(firstAppearance.values())].sort((a, b) => a - b);
  let best = { gap: 0, from: firstLevel, to: firstLevel };
  let prev = firstLevel;
  for (const level of firsts) {
    if (level - prev > best.gap) best = { gap: level - prev, from: prev, to: level };
    prev = level;
  }
  return best;
}

/** v2 only: the bag windows that deal a level range, and the shapes they admit. */
interface V2Admission {
  windows: number;
  firstOrdinal: number;
  lastOrdinal: number;
  setSizes: number[];
  truncated: number; // windows whose length differs from their admissible set size (always 0)
  admittedEverywhere: string[];
  excludedEverywhere: string[];
}

function v2Admission(indices: readonly number[]): V2Admission {
  const windows = new Map<number, ReturnType<typeof bagWindowFor>>();
  for (const index of indices) {
    const w = bagWindowFor(index);
    windows.set(w.ordinal, w);
  }
  const list = [...windows.values()].sort((a, b) => a.ordinal - b.ordinal);
  const inAll = new Set(SHAPE_CATALOGUE);
  const inAny = new Set<string>();
  let truncated = 0;
  for (const w of list) {
    const names = new Set(w.order.map((s) => s.name));
    for (const id of [...inAll]) if (!names.has(id)) inAll.delete(id);
    for (const id of names) inAny.add(id);
    if (windowSetAt(w.start).length !== w.order.length) truncated++;
  }
  return {
    windows: list.length,
    firstOrdinal: list[0].ordinal,
    lastOrdinal: list[list.length - 1].ordinal,
    setSizes: [...new Set(list.map((w) => w.order.length))].sort((a, b) => a - b),
    truncated,
    admittedEverywhere: SHAPE_CATALOGUE.filter((id) => inAll.has(id)),
    excludedEverywhere: SHAPE_CATALOGUE.filter((id) => !inAny.has(id)),
  };
}

function runShapeReport(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const maxDim = maxDimFor(opts.version);
  const counts = new Map<string, number>();
  const firstAppearance = new Map<string, number>();
  const clampHits = new Map<string, number>();
  let backToBack = 0;
  let totalClampLevels = 0;
  let prevShape: string | null = null;

  for (const index of indices) {
    const level = LevelGenerator.generate(index, opts.version);
    const name = level.shapeName;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!firstAppearance.has(name)) firstAppearance.set(name, index + 1);
    if (prevShape !== null && prevShape === name) backToBack++;
    prevShape = name;
    if (level.board.rows === maxDim || level.board.cols === maxDim) {
      clampHits.set(name, (clampHits.get(name) ?? 0) + 1);
      totalClampLevels++;
    }
  }
  const drought = longestFirstAppearanceGap(opts.levels![0], firstAppearance);
  const admission = opts.version === 2 ? v2Admission(indices) : null;

  const total = indices.length;
  const shapes = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({
    name,
    count,
    sharePct: (count / total) * 100,
    firstAppearance: firstAppearance.get(name)!,
    clampHits: clampHits.get(name) ?? 0,
  }));

  if (opts.json) {
    console.log(JSON.stringify(
      {
        note: HONESTY_BOUND, mode: 'shape-report', version: opts.version, levels: opts.levels, shapes,
        backToBackRepeats: backToBack, totalClampLevels, longestFirstAppearanceGap: drought, v2Admission: admission,
      },
      null, 2,
    ));
    return;
  }

  printHonestyBound();
  console.log(`Shape census over displayed levels ${opts.levels![0]}-${opts.levels![1]} (generator v${opts.version})`);
  console.log('');
  console.log(table(
    ['shape', 'count', 'share', 'first appearance', `clamp hits (rows or cols = ${maxDim})`],
    shapes.map((s) => [s.name, s.count, fmtPct(s.sharePct), s.firstAppearance, `${s.clampHits}/${s.count}`]),
  ));
  console.log('');
  console.log(`Back-to-back repeats: ${backToBack}`);
  console.log(`Rows or cols hit ${maxDim} on ${totalClampLevels} levels`);
  console.log(`Longest first-appearance gap: ${drought.gap} levels (level ${drought.from} to level ${drought.to})`);
  if (admission !== null) {
    const size = admission.setSizes.length === 1 ? admission.setSizes[0] : null;
    const total = indices.length;
    console.log('');
    console.log(`v2 bag: ${admission.windows} windows (ordinals ${admission.firstOrdinal}-${admission.lastOrdinal}), `
      + `admissible set size(s) ${admission.setSizes.join(', ')}, truncated windows ${admission.truncated}`);
    console.log(`Admitted in every window (${admission.admittedEverywhere.length}): ${admission.admittedEverywhere.join(', ')}`);
    console.log(`Excluded from every window (${admission.excludedEverywhere.length}): ${admission.excludedEverywhere.join(', ') || 'none'}`);
    if (size !== null) {
      const expected = total / size;
      const worst = Math.max(...admission.admittedEverywhere.map((id) => Math.abs((counts.get(id) ?? 0) - expected)));
      const latest = Math.max(...firstAppearance.values()) - opts.levels![0] + 1;
      console.log(`Expected count per admitted shape: ${total} / ${size} = ${expected.toFixed(2)}; `
        + `largest deviation ${worst.toFixed(2)} (${worst <= 1 ? 'within' : 'OUTSIDE'} +-1)`);
      console.log(`Latest first appearance: ${latest} levels into the range (set size ${size}: `
        + `${latest <= size ? 'no later than the set size' : 'LATER than the set size'})`);
    }
  }
}

function runTierReport(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, null));
  const tiers = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard];
  const ranges = new Map<Difficulty, { min: number; max: number }>();
  for (const tier of tiers) {
    const arrows = rows.filter((r) => r.tier === tier).map((r) => r.arrowCount);
    ranges.set(tier, { min: Math.min(...arrows), max: Math.max(...arrows) });
  }

  const overlaps: { a: string; b: string; overlap: string }[] = [];
  for (let i = 0; i < tiers.length; i++) {
    for (let j = i + 1; j < tiers.length; j++) {
      const a = ranges.get(tiers[i])!;
      const b = ranges.get(tiers[j])!;
      const lo = Math.max(a.min, b.min);
      const hi = Math.min(a.max, b.max);
      overlaps.push({
        a: Difficulties.displayName(tiers[i]),
        b: Difficulties.displayName(tiers[j]),
        overlap: lo <= hi ? `${lo}-${hi} (${hi - lo + 1} arrow counts)` : 'none',
      });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND,
      mode: 'tier-report',
      levels: opts.levels,
      ranges: tiers.map((t) => ({ tier: Difficulties.displayName(t), ...ranges.get(t)! })),
      overlaps,
    }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Tier arrow-count ranges over displayed levels ${opts.levels![0]}-${opts.levels![1]}`);
  console.log('');
  console.log(table(['tier', 'min', 'max'], tiers.map((t) => [Difficulties.displayName(t), ranges.get(t)!.min, ranges.get(t)!.max])));
  console.log('');
  console.log('Pairwise overlap:');
  for (const o of overlaps) console.log(`  ${o.a} ∩ ${o.b}: ${o.overlap}`);
}

function clampCols(rows: number, aspect: number): number {
  return clamp(roundHalfToEven(rows * aspect), 4, 46);
}

// Ported from levelGenerator.ts's own clamp/roundHalfToEven (not exported —
// these are pure formatting helpers, not part of the v1 generator seam).
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function allShapes(): readonly ShapeDef[] {
  return [...new Set([...ShapeLibrary.SimplePool, ...ShapeLibrary.MediumPool, ...ShapeLibrary.ComplexPool])];
}

function runCapacity(opts: Options): void {
  if (opts.version === 2) return runCapacityV2(opts);
  const cfg = Difficulties.config(Difficulty.Normal);
  const data = allShapes().map((shape) => {
    const cols = clampCols(46, shape.aspect);
    const mask = shape.rasterize(46, cols);
    const cells = countTrue(mask);
    const arrowCounts = [1, 2, 3, 4, 5].map((seed) => {
      const rng = new DotNetRandom(seed);
      return LevelGenerator.fillMask(mask, 46, cols, cfg, rng).length;
    });
    return { name: shape.name, cols, cells, medianArrows: median(ascending(arrowCounts)) };
  }).sort((a, b) => b.cells - a.cells);

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'capacity', shapes: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log('Per-shape capacity at the grid clamp (rows=46, cols=clamp(roundHalfToEven(46·aspect),4,46))');
  console.log('Arrows use the Normal config, median over DotNetRandom(1..5).');
  console.log('');
  console.log(table(
    ['shape', 'cols', 'cells', 'median arrows (Normal, seeds 1-5)'],
    data.map((d) => [d.name, d.cols, d.cells, d.medianArrows]),
  ));
}

/**
 * v2 capacity: every bag candidate (SHAPE_CATALOGUE minus RETIRED_SHAPE_IDS)
 * at rows = V2_MAX_GRID_DIM, via the bag's own `shapeCapacity`, with whether
 * the placeholder curve's window admits it. Under the placeholder every window
 * holds a Super Hard level, so every window has the same set.
 */
function runCapacityV2(opts: Options): void {
  const cfg = Difficulties.config(Difficulty.Normal);
  const maxDim = V2_MAX_GRID_DIM;
  const windowMax = placeholderWindowMaxTarget(0, Difficulties.cycleLength);
  const admitted = new Set(windowSetAt(0).map((s) => s.name));
  const data = bagCandidates().map((shape) => {
    const cols = v2Cols(maxDim, shape.aspect, maxDim);
    const cells = shapeCapacity(shape, maxDim);
    const mask = shape.rasterize(maxDim, cols);
    const arrowCounts = [1, 2, 3, 4, 5].map((s) => LevelGenerator.fillMask(mask, maxDim, cols, cfg, new DotNetRandom(s)).length);
    return { name: shape.name, cols, cells, medianArrows: median(ascending(arrowCounts)), admitted: admitted.has(shape.name) };
  }).sort((a, b) => b.cells - a.cells);

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'capacity', version: 2, maxDim, windowMaxTarget: windowMax, shapes: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`v2 per-shape capacity at the grid clamp (rows=V2_MAX_GRID_DIM=${maxDim}, cols=v2Cols(${maxDim}, aspect))`);
  console.log(`Admission: capacity >= the placeholder window max target ${windowMax} (v1 tier bands).`);
  console.log('Arrows use the Normal config, median over DotNetRandom(1..5).');
  console.log('');
  console.log(table(
    ['shape', 'cols', 'cells', 'median arrows (Normal, seeds 1-5)', `v2 admitted (>= ${windowMax})`],
    data.map((d) => [d.name, d.cols, d.cells, d.medianArrows, d.admitted ? 'yes' : 'no']),
  ));
  const excluded = data.filter((d) => !d.admitted).map((d) => d.name);
  console.log('');
  console.log(`Admitted ${data.length - excluded.length} of ${data.length}; excluded (${excluded.length}): ${excluded.join(', ')}`);
}

function runClampShortfall(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const maxDim = maxDimFor(opts.version);
  const findings = indices
    .map((index) => {
      const level = LevelGenerator.generate(index, opts.version);
      if (level.board.rows !== maxDim && level.board.cols !== maxDim) return null;
      const maskCells = countTrue(level.mask);
      if (maskCells >= level.targetCells) return null;
      const cfg = Difficulties.config(level.difficulty);
      return {
        level: index + 1,
        index,
        shapeName: level.shapeName,
        tier: Difficulties.displayName(level.difficulty),
        rows: level.board.rows,
        cols: level.board.cols,
        maskCells,
        targetCells: level.targetCells,
        tierRange: `${cfg.minCells}-${cfg.maxCells}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'clamp-shortfall', version: opts.version, levels: opts.levels, findings }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Clamp shortfalls over displayed levels ${opts.levels![0]}-${opts.levels![1]} (generator v${opts.version})`);
  console.log(`(rows or cols hit the ${maxDim} clamp AND the mask fell short of the drawn cell target)`);
  console.log('');
  console.log(table(
    ['level', 'shape', 'tier', 'rows×cols', 'mask cells', 'drawn target', 'tier range'],
    findings.map((f) => [f.level, f.shapeName, f.tier, `${f.rows}×${f.cols}`, f.maskCells, f.targetCells, f.tierRange]),
  ));
  console.log('');
  console.log(`Clamp shortfalls: ${findings.length}`);
}

// ---- Entry point --------------------------------------------------------

function runMode(mode: Mode, opts: Options): void {
  switch (mode) {
    case 'rows': return runRows(opts);
    case 'per-tier': return runPerTier(opts);
    case 'bands': return runBands(opts);
    case 'shape-report': return runShapeReport(opts);
    case 'tier-report': return runTierReport(opts);
    case 'capacity': return runCapacity(opts);
    case 'clamp-shortfall': return runClampShortfall(opts);
  }
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  opts.modes.forEach((mode, k) => {
    if (k > 0) console.log('');
    runMode(mode, opts);
  });
}

main();

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
 *
 * W3-11 adds the clearable-fraction knob:
 * - `--bias <b>` generates v2 with `clearableBias` b on every tier (level
 *   modes need `--version 2`; v1 takes no knobs).
 * - `--size-sweep` walks level-1-sized boards: `--shapes` (default
 *   Circle,Square,Heart) x `--rows a-b` (default 8-16, cols = v2Cols) x
 *   `--seeds a-b` (default 1-5, `DotNetRandom(s)`), Normal config, `--bias`.
 * - `--transfer` runs the exploration grid `--biases` (default
 *   0.1,0.3,1,3,10) plus "unset" on set (i), v2 `--levels`, and set (ii), the
 *   size-sweep boards, and prints each b beside the neutral seed band with the
 *   premise check and the brand gate (W3-11 brief).
 */
import {
  ArrowPath,
  BoardLogic,
  Difficulties,
  Difficulty,
  DifficultyConfig,
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

type Mode =
  | 'rows' | 'per-tier' | 'bands' | 'shape-report' | 'tier-report' | 'capacity' | 'clamp-shortfall'
  | 'size-sweep' | 'transfer';

/** W3-11 set (ii) defaults: level-1-sized boards (brief step 4). */
const SIZE_SWEEP_DEFAULT_SHAPES = ['Circle', 'Square', 'Heart'] as const;
const SIZE_SWEEP_DEFAULT_ROWS: readonly [number, number] = [8, 16];
const SIZE_SWEEP_DEFAULT_SEEDS: readonly [number, number] = [1, 5];
/** W3-11 exploration grid (brief step 4): sweep points, not shipped values. */
const TRANSFER_DEFAULT_BIASES = [0.1, 0.3, 1, 3, 10] as const;

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
  /** W3-11: v2 `clearableBias` for every tier; null = unset (neutral). */
  bias: number | null;
  /** W3-11 size-sweep / transfer set (ii) options. */
  sweepShapes: readonly string[];
  sweepRows: readonly [number, number];
  sweepSeeds: readonly [number, number];
  /** W3-11 transfer grid. */
  biases: readonly number[];
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
  let bias: number | null = null;
  let sweepShapes: readonly string[] = SIZE_SWEEP_DEFAULT_SHAPES;
  let sweepRows: readonly [number, number] = SIZE_SWEEP_DEFAULT_ROWS;
  let sweepSeeds: readonly [number, number] = SIZE_SWEEP_DEFAULT_SEEDS;
  let biases: readonly number[] = TRANSFER_DEFAULT_BIASES;
  let biasesGiven = false;

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
      case '--bias':
        bias = parseBias(argv[++i], '--bias');
        break;
      case '--biases': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--biases requires a value, e.g. --biases 0.1,0.3,1,3,10');
        biases = raw.split(',').map((b) => parseBias(b, '--biases'));
        biasesGiven = true;
        break;
      }
      case '--shapes': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--shapes requires a value, e.g. --shapes Circle,Square,Heart');
        sweepShapes = raw.split(',').map((n) => n.trim());
        for (const name of sweepShapes) shapeByName(name); // validate early
        break;
      }
      case '--rows':
        sweepRows = parseIntRange(argv[++i], '--rows', 1);
        break;
      case '--seeds':
        sweepSeeds = parseIntRange(argv[++i], '--seeds', 0);
        break;
      case '--size-sweep':
      case '--transfer':
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
    if (mode !== 'capacity' && mode !== 'size-sweep' && levels === null) {
      const flagName = mode === 'rows' ? '(the default row mode)' : `--${mode}`;
      throw new Error(`--levels a-b is required for ${flagName}`);
    }
  }
  // W3-11: the knob is v2-only (LevelGenerator.generate throws on a v1 knob);
  // say so up front. --size-sweep fills boards directly and takes --bias at
  // any version; --transfer runs its own grid and takes --biases instead.
  if (bias !== null && modes.includes('transfer')) {
    throw new Error('--transfer runs its own grid; use --biases, not --bias');
  }
  if (bias !== null && version !== 2 && modes.some((m) => m !== 'size-sweep')) {
    throw new Error('--bias is a generator v2 knob; add --version 2');
  }
  if (modes.includes('transfer') && version !== 2) {
    throw new Error('--transfer measures generator v2; add --version 2');
  }
  if (biasesGiven && !modes.includes('transfer')) {
    throw new Error('--biases is only used by --transfer');
  }
  return { levels, version, viewport, json, modes, bias, sweepShapes, sweepRows, sweepSeeds, biases };
}

function parseBias(raw: string | undefined, flag: string): number {
  if (raw === undefined) throw new Error(`${flag} requires a value, e.g. ${flag} 3`);
  const b = Number(raw.trim());
  if (raw.trim() === '' || !Number.isFinite(b) || !(b > 0)) {
    throw new Error(`${flag} values must be finite numbers > 0; got "${raw}"`);
  }
  return b;
}

function parseIntRange(raw: string | undefined, flag: string, min: number): [number, number] {
  if (raw === undefined) throw new Error(`${flag} requires a value, e.g. ${flag} 8-16`);
  const m = /^(\d+)-(\d+)$/.exec(raw.trim());
  if (!m) throw new Error(`${flag} must look like "a-b"; got "${raw}"`);
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (lo < min || hi < lo) throw new Error(`${flag} range must satisfy ${min} <= a <= b; got "${raw}"`);
  return [lo, hi];
}

/** The knobs object `--bias` passes to `LevelGenerator.generate` (undefined = neutral). */
function knobsFor(bias: number | null): { clearableBias: number } | undefined {
  return bias === null ? undefined : { clearableBias: bias };
}

function shapeByName(name: string): ShapeDef {
  const shape = [...allShapes(), ...bagCandidates()].find((s) => s.name === name);
  if (shape === undefined) throw new Error(`Unknown shape "${name}"`);
  return shape;
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

/** What one walk of a board measures (see `walkBoard`). */
interface WalkMetrics {
  arrowCount: number;
  clearableAtDeal: number;
  scanTaps: number;
  blockedTaps: number;
  minClearable: number;
  worstN: number;
  worstK: number;
  bentCount: number;
  totalLen: number;
}

/**
 * Generates level `index`, then walks it to empty removing the first
 * clearable arrow in `board.arrows()` order at each step, accumulating the
 * uniform-sampling scan/blocked proxy. Asserts the board clears in exactly
 * `arrowCount` removals (the in-probe reconciliation that proves every board
 * was fully walked) and exits non-zero otherwise.
 */
function buildRow(index: number, version: 1 | 2, viewport: Viewport | null, bias: number | null = null): LevelRow {
  const level = LevelGenerator.generate(index, version, knobsFor(bias));
  const maskCells = countTrue(level.mask);
  const arrowCount = level.arrowCount;
  const m = walkBoard(level.board, arrowCount, `level index ${index}`);

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
    clearableAtDeal: m.clearableAtDeal,
    clearablePct: (m.clearableAtDeal / arrowCount) * 100,
    scanTaps: m.scanTaps,
    blockedTaps: m.blockedTaps,
    // Infinity only if arrowCount <= 1 (no state ever had n > 1); not hit by
    // any level in the committed baseline ranges (min arrowCount is 47).
    minClearable: m.minClearable === Infinity ? 0 : m.minClearable,
    worstN: m.worstN,
    worstK: m.worstK,
    bendRate: m.bentCount / arrowCount,
    meanLen: m.totalLen / arrowCount,
    cellPt: viewport ? 0.94 * Math.min(viewport.w / level.board.cols, viewport.h / level.board.rows) : null,
  };
}

/**
 * The walk itself (shared by `buildRow`, `--size-sweep` and `--transfer`):
 * remove the first clearable arrow in `board.arrows()` order until empty,
 * summing the scan/blocked proxy over every state. Mutates `board`.
 */
function walkBoard(board: BoardLogic, arrowCount: number, label: string): WalkMetrics {
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
      throw new Error(`${label}: no clearable arrow with ${n} remaining (unsolvable state)`);
    }
    if (!board.tryRemove(firstClearable)) {
      throw new Error(`${label}: tryRemove failed on a reported-clearable arrow`);
    }
    removals++;
  }

  if (removals !== arrowCount) {
    throw new Error(
      `${label}: walk removed ${removals} arrows but arrowCount is ${arrowCount} — ` +
        'the board was not fully reconciled',
    );
  }

  return { arrowCount, clearableAtDeal, scanTaps, blockedTaps, minClearable, worstN, worstK, bentCount, totalLen };
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

/** W3-11: " (clearableBias b)" in a mode's header line when --bias is set; empty when neutral. */
function biasTag(opts: Options): string {
  return opts.bias === null ? '' : ` (v2 clearableBias ${opts.bias} on every tier)`;
}

/** W3-11: `{ clearableBias }` in a mode's JSON when --bias is set; nothing when neutral (JSON unchanged). */
function biasField(opts: Options): { clearableBias?: number } {
  return opts.bias === null ? {} : { clearableBias: opts.bias };
}

// ---- Modes --------------------------------------------------------------

function runRows(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, opts.viewport, opts.bias));

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'rows', version: opts.version, levels: opts.levels, ...biasField(opts), rows }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Level rows for displayed levels ${opts.levels![0]}-${opts.levels![1]} (index ${indices[0]}-${indices[indices.length - 1]})${biasTag(opts)}`);
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
  const rows = indices.map((i) => buildRow(i, opts.version, null, opts.bias));
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
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'per-tier', levels: opts.levels, ...biasField(opts), tiers: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Per-tier stats over displayed levels ${opts.levels![0]}-${opts.levels![1]}${biasTag(opts)}`);
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
  const rows = indices.map((i) => buildRow(i, opts.version, null, opts.bias));

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
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'bands', levels: opts.levels, ...biasField(opts), bands: data }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`Bands over displayed levels ${lo}-${hi} (fixed cumulative fractions ${BAND_FRACTIONS.map((f) => f.toFixed(3)).join(', ')})${biasTag(opts)}`);
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
    const level = LevelGenerator.generate(index, opts.version, knobsFor(opts.bias));
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
  const rows = indices.map((i) => buildRow(i, opts.version, null, opts.bias));
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
      const level = LevelGenerator.generate(index, opts.version, knobsFor(opts.bias));
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

// ---- W3-11: size sweep and the clearable-bias transfer grid -------------

/** One walked board (one fill seed) of a sweep. */
interface SweepSample {
  arrows: number;
  clearable: number; // arrows clearable at deal
  clearablePct: number;
  scan: number;
  blocked: number;
  bent: number;
  totalLen: number;
}

/** A level-1-sized board of `--size-sweep` / `--transfer` set (ii). */
interface SizeBoard {
  shape: ShapeDef;
  rows: number;
  cols: number;
  mask: boolean[][];
  maskCells: number;
}

/** The config a sweep fills with: `cfg` itself when neutral, else `cfg` plus the bias. */
function withBias(cfg: DifficultyConfig, bias: number | null): DifficultyConfig {
  return bias === null ? cfg : { ...cfg, clearableBias: bias };
}

function toSample(m: WalkMetrics): SweepSample {
  return {
    arrows: m.arrowCount,
    clearable: m.clearableAtDeal,
    clearablePct: (m.clearableAtDeal / m.arrowCount) * 100,
    scan: m.scanTaps,
    blocked: m.blockedTaps,
    bent: m.bentCount,
    totalLen: m.totalLen,
  };
}

/** Fill `mask` with `DotNetRandom(seedValue)` through the shipping `fillMask`, then walk it. */
function fillAndWalk(
  mask: readonly (readonly boolean[])[],
  rows: number,
  cols: number,
  cfg: DifficultyConfig,
  seedValue: number,
  label: string,
): SweepSample {
  const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(seedValue));
  const board = new BoardLogic(rows, cols);
  for (const a of arrows) board.add(a);
  return toSample(walkBoard(board, arrows.length, label));
}

function sizeSweepBoards(opts: Options): SizeBoard[] {
  const boards: SizeBoard[] = [];
  for (const name of opts.sweepShapes) {
    const shape = shapeByName(name);
    for (let rows = opts.sweepRows[0]; rows <= opts.sweepRows[1]; rows++) {
      const cols = v2Cols(rows, shape.aspect);
      const mask = shape.rasterize(rows, cols);
      const maskCells = countTrue(mask);
      if (maskCells === 0) throw new Error(`${name} at ${rows} rows rasterizes to no cells`);
      boards.push({ shape, rows, cols, mask, maskCells });
    }
  }
  return boards;
}

function seedList(opts: Options): number[] {
  const out: number[] = [];
  for (let s = opts.sweepSeeds[0]; s <= opts.sweepSeeds[1]; s++) out.push(s);
  return out;
}

const NORMAL_CFG = (): DifficultyConfig => Difficulties.config(Difficulty.Normal);

function med(values: readonly number[]): number {
  return median(ascending(values));
}

function minMax(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function fmtRange(r: { min: number; max: number }, digits: number): string {
  return `${r.min.toFixed(digits)}–${r.max.toFixed(digits)}`;
}

function sizeSweepHeader(opts: Options, seeds: readonly number[], biasText: string): string {
  const lowRows = opts.sweepRows[0] < V2_MIN_ROWS_FOR_NOTE
    ? ` (rows below ${V2_MIN_ROWS_FOR_NOTE} are below v2's row floor; v2 never deals them)`
    : '';
  return `Level-1-sized boards: ${opts.sweepShapes.join('/')} x rows ${opts.sweepRows[0]}-${opts.sweepRows[1]}${lowRows}, `
    + `cols = v2Cols(rows, aspect), Normal config, fillMask with DotNetRandom(s) for s = ${seeds[0]}..${seeds[seeds.length - 1]}; `
    + biasText;
}

/** v2's row floor (`V2_MIN_GRID_ROWS`), restated for the size-sweep note only. */
const V2_MIN_ROWS_FOR_NOTE = 8;

function runSizeSweep(opts: Options): void {
  const boards = sizeSweepBoards(opts);
  const seeds = seedList(opts);
  const cfg = withBias(NORMAL_CFG(), opts.bias);
  const data = boards.map((b) => {
    const samples = seeds.map((s) => fillAndWalk(b.mask, b.rows, b.cols, cfg, s, `${b.shape.name} ${b.rows}x${b.cols} seed ${s}`));
    const pick = (f: (x: SweepSample) => number) => samples.map(f);
    return {
      shape: b.shape.name,
      rows: b.rows,
      cols: b.cols,
      maskCells: b.maskCells,
      n: samples.length,
      arrowsMean: pick((x) => x.arrows).reduce((t, v) => t + v, 0) / samples.length,
      arrows: { median: med(pick((x) => x.arrows)), ...minMax(pick((x) => x.arrows)) },
      clearablePct: { median: med(pick((x) => x.clearablePct)), ...minMax(pick((x) => x.clearablePct)) },
      scan: { median: med(pick((x) => x.scan)), ...minMax(pick((x) => x.scan)) },
      blockedMean: pick((x) => x.blocked).reduce((t, v) => t + v, 0) / samples.length,
      blocked: { median: med(pick((x) => x.blocked)), ...minMax(pick((x) => x.blocked)) },
      bendPct: med(pick((x) => (100 * x.bent) / x.arrows)),
      meanLen: med(pick((x) => x.totalLen / x.arrows)),
      samples,
    };
  });

  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'size-sweep', shapes: opts.sweepShapes, rows: opts.sweepRows, seeds: opts.sweepSeeds,
      clearableBias: opts.bias, boards: data,
    }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(sizeSweepHeader(opts, seeds, opts.bias === null ? 'clearableBias unset (neutral).' : `clearableBias ${opts.bias}.`));
  console.log('Each cell is the median over seeds with the seed min–max; "mean" columns are plain means over seeds.');
  console.log('');
  console.log(table(
    ['shape', 'rows×cols', 'mask cells', 'n', 'arrows mean', 'arrows [min–max]', 'clearable@0% median [min–max]',
      'scan median [min–max]', 'blocked mean', 'blocked median [min–max]', 'bend% median', 'meanLen median'],
    data.map((d) => [
      d.shape, `${d.rows}×${d.cols}`, d.maskCells, d.n, d.arrowsMean.toFixed(1), `${d.arrows.min}–${d.arrows.max}`,
      `${d.clearablePct.median.toFixed(1)}% [${fmtRange(d.clearablePct, 1)}]`,
      `${d.scan.median.toFixed(1)} [${fmtRange(d.scan, 1)}]`,
      d.blockedMean.toFixed(1),
      `${d.blocked.median.toFixed(1)} [${fmtRange(d.blocked, 1)}]`,
      fmtPct(d.bendPct), d.meanLen.toFixed(2),
    ]),
  ));
}

/** A stream's summary over a set of boards: medians per board, and pooled look metrics. */
interface StreamAggregate {
  n: number;
  arrows: number; // median arrows per board
  clearablePct: number; // median clearable-at-deal % per board
  scan: number; // median
  blocked: number; // median
  bendPct: number; // pooled: bent arrows / all arrows
  meanLen: number; // pooled: cells / arrows
}

function aggregateStream(samples: readonly SweepSample[]): StreamAggregate {
  const arrowsTotal = samples.reduce((t, x) => t + x.arrows, 0);
  return {
    n: samples.length,
    arrows: med(samples.map((x) => x.arrows)),
    clearablePct: med(samples.map((x) => x.clearablePct)),
    scan: med(samples.map((x) => x.scan)),
    blocked: med(samples.map((x) => x.blocked)),
    bendPct: (100 * samples.reduce((t, x) => t + x.bent, 0)) / arrowsTotal,
    meanLen: samples.reduce((t, x) => t + x.totalLen, 0) / arrowsTotal,
  };
}

type AggKey = 'clearablePct' | 'scan' | 'blocked' | 'bendPct' | 'meanLen' | 'arrows';
const AGG_KEYS: readonly AggKey[] = ['clearablePct', 'scan', 'blocked', 'bendPct', 'meanLen', 'arrows'];

/** One bias setting on one set: its seed-replica aggregates (and set (i)'s real v2 stream). */
interface SettingResult {
  bias: number | null;
  replicas: StreamAggregate[]; // one per seed
  real: StreamAggregate | null; // set (i) only: generate(i, 2, { clearableBias })
}

type Position = 'inside' | 'above' | 'below';

interface Verdict {
  key: AggKey;
  median: number; // median over seed replicas
  range: { min: number; max: number }; // over seed replicas
  band: { min: number; max: number }; // the neutral (unset) replicas' range
  position: Position; // of `median` against `band`
  disjoint: boolean; // this setting's replica range does not overlap the band at all
}

function verdictFor(key: AggKey, setting: SettingResult, neutral: SettingResult): Verdict {
  const values = setting.replicas.map((a) => a[key]);
  const bandValues = neutral.replicas.map((a) => a[key]);
  const m = med(values);
  const range = minMax(values);
  const band = minMax(bandValues);
  const position: Position = m > band.max ? 'above' : m < band.min ? 'below' : 'inside';
  return { key, median: m, range, band, position, disjoint: range.min > band.max || range.max < band.min };
}

function biasLabel(bias: number | null): string {
  return bias === null ? 'unset' : String(bias);
}

function fmtKey(key: AggKey, v: number): string {
  if (key === 'clearablePct' || key === 'bendPct') return `${v.toFixed(1)}%`;
  if (key === 'meanLen') return v.toFixed(2);
  return v.toFixed(1);
}

function arrowMark(v: Verdict): string {
  if (v.position === 'inside') return '';
  return `${v.position === 'above' ? ' ↑' : ' ↓'}${v.disjoint ? '' : ' (ranges overlap)'}`;
}

function runTransfer(opts: Options): void {
  const settings: (number | null)[] = [null, ...opts.biases];
  const seeds = seedList(opts);
  const indices = indicesInRange(opts.levels!);

  // Set (i): v2 levels. The mask, size and tier do not depend on the bias
  // (it only reweights fillMask), so each level's neutral board supplies the
  // mask the seed replicas refill; the "real" stream is generate(i, 2, knobs).
  const neutralLevels = indices.map((i) => LevelGenerator.generate(i, 2));
  const setI: SettingResult[] = settings.map((bias) => {
    const real = aggregateStream(indices.map((i, k) => {
      const lvl = LevelGenerator.generate(i, 2, knobsFor(bias));
      const base = neutralLevels[k];
      if (lvl.shapeName !== base.shapeName || lvl.board.rows !== base.board.rows || lvl.board.cols !== base.board.cols) {
        throw new Error(`level index ${i}: the bias changed the shape or size, which it must never do`);
      }
      return toSample(walkBoard(lvl.board, lvl.arrowCount, `level index ${i} bias ${biasLabel(bias)}`));
    }));
    const replicas = seeds.map((s) => aggregateStream(neutralLevels.map((base, k) => fillAndWalk(
      base.mask, base.board.rows, base.board.cols, withBias(Difficulties.config(base.difficulty), bias), s,
      `level index ${indices[k]} bias ${biasLabel(bias)} seed ${s}`,
    ))));
    return { bias, replicas, real };
  });

  // Set (ii): level-1-sized boards, Normal config.
  const boards = sizeSweepBoards(opts);
  const perBoard = new Map<number | null, SweepSample[][]>(); // bias -> board -> seed samples
  const setII: SettingResult[] = settings.map((bias) => {
    const cfg = withBias(NORMAL_CFG(), bias);
    const grid = boards.map((b) => seeds.map((s) => fillAndWalk(
      b.mask, b.rows, b.cols, cfg, s, `${b.shape.name} ${b.rows}x${b.cols} bias ${biasLabel(bias)} seed ${s}`,
    )));
    perBoard.set(bias, grid);
    const replicas = seeds.map((_, si) => aggregateStream(grid.map((bySeed) => bySeed[si])));
    return { bias, replicas, real: null };
  });

  const verdicts = (set: SettingResult[]) => set.map((st) => ({
    bias: st.bias,
    byKey: Object.fromEntries(AGG_KEYS.map((k) => [k, verdictFor(k, st, set[0])])) as Record<AggKey, Verdict>,
  }));
  const vI = verdicts(setI);
  const vII = verdicts(setII);

  const moved = vII.filter((v) => v.bias !== null && v.byKey.clearablePct.position !== 'inside');
  const up = moved.filter((v) => v.byKey.clearablePct.position === 'above').map((v) => v.bias);
  const down = moved.filter((v) => v.byKey.clearablePct.position === 'below').map((v) => v.bias);
  const premiseHolds = moved.length > 0;
  const lookChanged = (bias: number | null): string[] => {
    const out: string[] = [];
    for (const [setName, vs] of [['set (i)', vI], ['set (ii)', vII]] as const) {
      const v = vs.find((x) => x.bias === bias)!;
      for (const key of ['bendPct', 'meanLen'] as const) {
        if (v.byKey[key].position !== 'inside') out.push(`${setName} ${key === 'bendPct' ? 'bend%' : 'meanLen'} ${v.byKey[key].position}`);
      }
    }
    return out;
  };

  // Set (ii) per board: medians over seeds against that board's neutral seed band.
  const boardRows = boards.map((b, bi) => {
    const cell = (bias: number | null, f: (x: SweepSample) => number) => perBoard.get(bias)![bi].map(f);
    return {
      board: `${b.shape.name} ${b.rows}×${b.cols}`,
      byBias: settings.map((bias) => ({
        bias,
        arrows: med(cell(bias, (x) => x.arrows)),
        clearablePct: med(cell(bias, (x) => x.clearablePct)),
        clearableRange: minMax(cell(bias, (x) => x.clearablePct)),
        blocked: med(cell(bias, (x) => x.blocked)),
        blockedRange: minMax(cell(bias, (x) => x.blocked)),
        scan: med(cell(bias, (x) => x.scan)),
      })),
    };
  });
  const blockedFive = settings.map((bias) => {
    const si = settings.indexOf(bias);
    const ok = boardRows.filter((r) => r.byBias[si].blocked <= 5);
    ok.sort((a, b) => b.byBias[si].arrows - a.byBias[si].arrows);
    return { bias, largest: ok[0] ?? null, count: ok.length, si };
  });

  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'transfer', levels: opts.levels, biases: opts.biases, seeds: opts.sweepSeeds,
      shapes: opts.sweepShapes, rows: opts.sweepRows,
      setI: setI.map((st, k) => ({ bias: st.bias, real: st.real, replicas: st.replicas, verdicts: vI[k].byKey })),
      setII: setII.map((st, k) => ({ bias: st.bias, replicas: st.replicas, verdicts: vII[k].byKey })),
      perBoard: boardRows,
      premise: { holds: premiseHolds, raises: up, lowers: down },
      brandGate: settings.map((bias) => ({ bias, changes: lookChanged(bias) })),
    }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`clearableBias transfer grid: b in {unset, ${opts.biases.join(', ')}} (sweep points, not shipped values).`);
  console.log(`Set (i): generator v2, displayed levels ${opts.levels![0]}-${opts.levels![1]} (n=${indices.length} levels). `
    + `Each seed replica refills every level's own v2 mask with its tier config + b and DotNetRandom(s), s = ${seeds.join(', ')}; `
    + '"real v2" is generate(i, 2, { clearableBias: b }) on the level\'s own stream.');
  console.log(`Set (ii): ${sizeSweepHeader(opts, seeds, `n=${boards.length} boards per seed.`)}`);
  console.log('Per stream: clearable@0 / scan / blocked / arrows are medians over the boards; bend% and meanLen are pooled over all arrows.');
  console.log('Band = the min–max of the 5 unset seed replicas. ↑/↓ = the median over seed replicas lies above/below the band; '
    + '"(ranges overlap)" = some replica still falls inside it.');

  const setTable = (title: string, set: SettingResult[], vs: typeof vI) => {
    console.log('');
    console.log(title);
    console.log('');
    const headers = ['b', 'clearable@0 median [replica min–max]', 'scan', 'blocked', 'bend% (pooled)', 'meanLen (pooled)', 'arrows'];
    if (set[0].real !== null) headers.push('real v2: clearable@0 / scan / blocked / bend% / meanLen');
    console.log(table(headers, set.map((st, k) => {
      const v = vs[k].byKey;
      const cellFor = (key: AggKey) => `${fmtKey(key, v[key].median)} [${fmtKey(key, v[key].range.min)}–${fmtKey(key, v[key].range.max)}]${st.bias === null ? ' (band)' : arrowMark(v[key])}`;
      const row: (string | number)[] = [biasLabel(st.bias), cellFor('clearablePct'), cellFor('scan'), cellFor('blocked'), cellFor('bendPct'), cellFor('meanLen'), cellFor('arrows')];
      if (st.real !== null) {
        const r = st.real;
        row.push(`${fmtKey('clearablePct', r.clearablePct)} / ${r.scan.toFixed(1)} / ${r.blocked.toFixed(1)} / ${fmtKey('bendPct', r.bendPct)} / ${r.meanLen.toFixed(2)}`);
      }
      return row;
    })));
  };
  setTable(`Set (i): v2 levels ${opts.levels![0]}-${opts.levels![1]}`, setI, vI);
  setTable(`Set (ii): level-1-sized boards (${boards.length} boards x ${seeds.length} seeds)`, setII, vII);

  console.log('');
  console.log('Set (ii) per board: median over seeds; the unset column shows the seed min–max band; ↑/↓ = outside that board\'s band.');
  for (const [title, key, rangeKey, digits] of [
    ['clearable@0 %', 'clearablePct', 'clearableRange', 1],
    ['blocked taps', 'blocked', 'blockedRange', 1],
  ] as const) {
    console.log('');
    console.log(`Per board, ${title}:`);
    console.log('');
    console.log(table(['board', ...settings.map(biasLabel)], boardRows.map((r) => {
      const neutral = r.byBias[0];
      const band = neutral[rangeKey];
      return [r.board, ...r.byBias.map((x, si) => {
        const v = x[key];
        if (si === 0) return `${v.toFixed(digits)} [${fmtRange(band, digits)}]`;
        const mark = v > band.max ? ' ↑' : v < band.min ? ' ↓' : '';
        return `${v.toFixed(digits)}${mark}`;
      })];
    })));
  }
  console.log('');
  console.log('Per board, median arrows:');
  console.log('');
  console.log(table(['board', ...settings.map(biasLabel)], boardRows.map((r) => [r.board, ...r.byBias.map((x) => x.arrows)])));

  console.log('');
  console.log('Largest set (ii) board whose median blocked taps <= 5, per b (a pointer for W3-12, not a gate):');
  console.log('');
  console.log(table(['b', 'boards with median blocked <= 5', 'largest (by median arrows)', 'arrows', 'clearable@0', 'blocked'],
    blockedFive.map((x) => {
      if (x.largest === null) return [biasLabel(x.bias), 0, 'none', '-', '-', '-'];
      const c = x.largest.byBias[x.si];
      return [biasLabel(x.bias), `${x.count}/${boards.length}`, x.largest.board, c.arrows, fmtPct(c.clearablePct), c.blocked.toFixed(1)];
    })));

  console.log('');
  console.log(`Premise check (set (ii), median clearable@0 over seed replicas vs the unset band): `
    + (premiseHolds
      ? `HOLDS. Raised above the band by b = ${up.join(', ') || 'none'}; lowered below it by b = ${down.join(', ') || 'none'}.`
      : 'premise does not hold: no b moves median clearable-at-t=0 outside the neutral band.'));
  console.log('Brand gate (bend% or meanLen median outside its unset band on either set = "changes arrow look"):');
  for (const bias of opts.biases) {
    const changes = lookChanged(bias);
    console.log(`  b=${bias}: ${changes.length === 0 ? 'inside both bands' : `changes arrow look (${changes.join('; ')})`}`);
  }
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
    case 'size-sweep': return runSizeSweep(opts);
    case 'transfer': return runTransfer(opts);
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

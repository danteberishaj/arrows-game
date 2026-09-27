/**
 * Difficulty probe (generator v1, and v2 since W3-10): a uniform-sampling
 * search-cost proxy over the shipping generator, so every later W3 task pins a
 * number that this script actually measured instead of an invented threshold.
 * `--version 2` drives `LevelGenerator.generate(i, 2)` (dark behind
 * GEN_V2_ENABLED) and measures its clamp (W3-09: at most `V2_MAX_GRID_COLS`
 * columns, rows up to `v2MaxRows(aspect)`).
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
 *
 * W3-12 puts the whole first session on one table:
 * - `--tutorial T1|T2` walks W1-02's authored `BoardLogic` board with the same
 *   walk and prints the same columns (repeatable: `--tutorial T1 --tutorial T2`).
 * - `--start-sweep` prints, in play order, T1, T2, v1 levels 1-5 (v1 level 1 is
 *   the baseline row), then the level-1 candidates: every bag candidate shape
 *   (`--shapes` to narrow) x `--rows a-b` (default 6-16, cols = v2Cols) x bias
 *   in {unset, `--biases`} (default: only the value that passed W3-11's brand
 *   gate) x `--seeds` (default 1-5, `DotNetRandom(s)`), Normal config. Each row
 *   carries n, cellPt at fit on the two board viewports W3-08 logged (360 and
 *   411 dp wide), and flags for W3-09's legibility floor, v2's row floor and a
 *   bias outside W3-11's brand gate.
 * - `--start-sweep --targets a,b` adds every shape sized to each cell target by
 *   a replica of `buildV2`'s fit (checked against `generate(i, 2)` first): level
 *   1 at that target whatever shape the bag deals.
 * cellPt comes from the shipping camera (`src/ui/boardCamera.ts`
 * `initialCamera`, a pure module with no imports; preflight F30: one camera
 * function, not another copy). That is this script's only non-`src/core` import.
 *
 * W3-14 makes v2 difficulty a function of the level index (`src/core/curve.ts`):
 * - `--curve <file>` deals v2 from a curve table (JSON: an array of rows, or
 *   `{ id, rows }`) instead of the shipped `V2_CURVE`, in every v2 level mode.
 * - `--candidates` writes W3-14's exploration candidates (ruling W3-7: base
 *   cells reach the ceiling at displayed level 100, 400 or 1000; plus a
 *   variant of each that keeps lowering the bias after saturation) as JSON
 *   tables to `--out <dir>` (default artifacts/W3-14/curves) and prints them.
 * - `--curve-report` prints the brief's (a)-(g) for `--curve` (or the shipped
 *   curve): cycle medians over `--levels` (default 1-3000), the saturation
 *   level, admissible shapes per bag window, clamp shortfalls, the heaviest
 *   board over indices 0-99,999 sampled every 7, the smallest fit cell, the
 *   v1 -> v2 discontinuity at switch levels, and the heaviest board over
 *   0-9999 with its node generation time beside v1's worst (7157).
 * - `--ceiling` measures the largest `CEILING_BASE_CELLS` allowed: the
 *   largest saturated base cells whose neutral boards stay at or under
 *   `ARROW_CEILING` arrows over the Hard and Super Hard indices of that
 *   sample AND every index 0-9999, and whose saturated bag window still
 *   holds a full tier cycle (RE-CEILING; W3-14 also required the bias-tail
 *   floor 0.3, which is now printed as information only: the tail
 *   candidates were not picked). Since RE-CEILING's owner pick (option B,
 *   354) the shipped value is below that maximum; the probe checks it is.
 * Every one of them reads arrow counts and search cost from boards the
 * shipping `generate(i, 2, { curve })` produced, never the table back.
 *
 * V2-FINISH (the owner's W3-16 picks: S400 ships; existing players get a v1
 * floor):
 * - `--v1-floor` measures `V1_FLOOR_BASE_CELLS`: v1's per-tier median arrows
 *   and its scan proxy (the median of its 6-level cycle-median scans) over
 *   displayed levels 1-3000 (with 300-level bands, since v1's config never
 *   reads the level), then the smallest base cells on `V1_TIER_TEXTURE` whose
 *   own v2 boards (a flat curve, neutral, v2's bag and sizing, the same
 *   levels) reach it, with every larger scanned base up to
 *   `CEILING_BASE_CELLS` reaching it too, in both units: every tier's arrow
 *   median (V2-FINISH) and the scan proxy (RE-CEILING option B, the shipped
 *   unit). Ten bases above the ceiling are printed for context.
 * - `--switch-report` is W3-14's (g) again with the floor: for a player who
 *   meets v2 at displayed level L, v1 against a fresh install's v2 and an
 *   existing player's floored v2 (`generate(i, 2, { switchLevel })`), over
 *   the next 60 and 300 levels; plus the floored boards' per-tier arrows
 *   below the ceiling and their heaviest board over the (e) sample and
 *   (RE-CEILING) over every index 0-9999.
 */
import {
  ArrowPath,
  BoardLogic,
  Difficulties,
  Difficulty,
  DifficultyConfig,
  DotNetRandom,
  GeneratedLevel,
  LevelGenerator,
  SHAPE_CATALOGUE,
  ShapeDef,
  ShapeLibrary,
  TutorialId,
  ARROW_CEILING,
  CEILING_BASE_CELLS,
  CurveTable,
  LEVEL1_CLEARABLE_BIAS,
  LEVEL1_TARGET_CELLS,
  MIN_LEGIBLE_CELL_PT,
  V1_FLOOR_BASE_CELLS,
  V1_TIER_TEXTURE,
  V2Knobs,
  V2_CURVE,
  V2_MAX_GRID_COLS,
  V2_MAX_GRID_ROWS,
  V2_MIN_GRID_ROWS,
  bagCandidates,
  bagWindowFor,
  buildTutorialLevel,
  curvePointAt,
  curveWindowMaxTarget,
  placeholderWindowMaxTarget,
  shapeCapacity,
  v2Cols,
  v2GridFor,
  v2MaxRows,
  validateCurve,
  windowSetAt,
} from '../../src/core';
import { initialCamera } from '../../src/ui/boardCamera';
import * as fs from 'fs';
import * as path from 'path';

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
  | 'size-sweep' | 'transfer' | 'start-sweep' | 'tutorial'
  | 'candidates' | 'curve-report' | 'ceiling' | 'flat-reference'
  | 'v1-floor' | 'switch-report';

/** W3-11 set (ii) defaults: level-1-sized boards (brief step 4). */
const SIZE_SWEEP_DEFAULT_SHAPES = ['Circle', 'Square', 'Heart'] as const;
const SIZE_SWEEP_DEFAULT_ROWS: readonly [number, number] = [8, 16];
const SIZE_SWEEP_DEFAULT_SEEDS: readonly [number, number] = [1, 5];
/** W3-11 exploration grid (brief step 4): sweep points, not shipped values. */
const TRANSFER_DEFAULT_BIASES = [0.1, 0.3, 1, 3, 10] as const;

/**
 * W3-12: the clearableBias values that passed W3-11's brand gate ("inside both
 * bands"): only b = 3. MEASURED by `--version 2 --levels 1-100 --transfer`
 * (docs/clearable-bias-transfer-2026-09-26.md, "Brand gate"); b = 1 also sits
 * inside but is the identity (byte-identical to unset), so it adds no row. The
 * owner's screenshot yes/no on b = 3 (W3-11 owner question 1c) is still open.
 */
const BRAND_GATE_PASSED_BIASES: readonly number[] = [3];
/** `--start-sweep`'s bias rows besides unset, unless `--biases` is given. */
const START_SWEEP_DEFAULT_BIASES: readonly number[] = BRAND_GATE_PASSED_BIASES;
/** The W3-12 brief's sampling grid (rows 6-16, as the red team's sweep); method, not a gate. */
const START_SWEEP_DEFAULT_ROWS: readonly [number, number] = [6, 16];
/** The W3-12 brief's first-session context: v1 displayed levels 1-5 (level 1 = the baseline row). */
const START_SWEEP_V1_LEVELS: readonly [number, number] = [1, 5];

/**
 * W3-12: the board viewports (dp) W3-08 logged at runtime on emulator-5556
 * (`[board-viewport]`, docs/board-legibility-2026-09-26.md): 360x689 is the
 * board area of a 360x780 dp phone (W1-01's geometry), 411.43x804.29 the
 * native 1440x3120 @560 screen's. MEASURED, not picked.
 */
const START_VIEWPORTS: readonly { label: string; w: number; h: number }[] = [
  { label: '360', w: 360, h: 689 },
  { label: '411', w: 411.4285583496094, h: 804.2857055664062 },
];
// W3-09's floor, MIN_LEGIBLE_CELL_PT (9.1 pt, OWNER PICK 2026-09-26), now lives in src/core/shapeBag.ts (W3-14).
/** BoardView's `CELL` (board units per grid cell). It cancels out of cellPt; any positive value gives the same pt. */
const BOARD_CELL_UNITS = 40;

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
  /** W3-11 transfer grid; W3-12 `--start-sweep` bias rows besides unset. */
  biases: readonly number[];
  biasesGiven: boolean;
  rowsGiven: boolean;
  shapesGiven: boolean;
  /** W3-12 `--tutorial` boards, in the order given. */
  tutorials: readonly TutorialId[];
  /** W3-12 `--start-sweep --targets`: cell targets to size every shape at with v2's own sizing. */
  targets: readonly number[];
  /** W3-14 `--curve <file>`: the v2 curve to deal from; null = the shipped V2_CURVE. */
  curve: CurveTable | null;
  /** The curve's label: its file's `id`, or the file name; 'V2_CURVE' when shipped. */
  curveId: string;
  /** W3-14 `--candidates --out <dir>`. */
  out: string;
  /** W3-14 `--only S400,...`: limit `--candidates --curve-report` to these ids. */
  only: readonly string[] | null;
  /** W3-14 `--json-out <file>`: `--curve-report` / `--flat-reference` also write their JSON there (text still printed). */
  jsonOut: string | null;
  /** W3-14 `--reference <file>`: a `--flat-reference --json-out` file for `--curve-report` (else it is computed, slowly). */
  referenceFile: string | null;
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
  let rowsGiven = false;
  let shapesGiven = false;
  const tutorials: TutorialId[] = [];
  let targets: readonly number[] = [];
  let curve: CurveTable | null = null;
  let curveId = 'V2_CURVE';
  let out = CANDIDATES_DEFAULT_OUT;
  let only: readonly string[] | null = null;
  let jsonOut: string | null = null;
  let referenceFile: string | null = null;

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
        shapesGiven = true;
        break;
      }
      case '--rows':
        sweepRows = parseIntRange(argv[++i], '--rows', 1);
        rowsGiven = true;
        break;
      case '--tutorial': {
        const raw = argv[++i];
        if (raw !== 'T1' && raw !== 'T2') throw new Error(`--tutorial must be T1 or T2; got "${raw ?? ''}"`);
        if (!tutorials.includes(raw)) tutorials.push(raw);
        modeFlags.push('tutorial');
        break;
      }
      case '--start-sweep':
        modeFlags.push('start-sweep');
        break;
      case '--targets': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--targets requires a value, e.g. --targets 68,88,145');
        targets = raw.split(',').map((t) => {
          const v = Number(t.trim());
          if (t.trim() === '' || !Number.isSafeInteger(v) || v < 1) throw new Error(`--targets values must be integers >= 1; got "${t}"`);
          return v;
        });
        break;
      }
      case '--seeds':
        sweepSeeds = parseIntRange(argv[++i], '--seeds', 0);
        break;
      case '--curve': {
        const loaded = loadCurve(argv[++i]);
        curve = loaded.table;
        curveId = loaded.id;
        break;
      }
      case '--out': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--out requires a directory');
        out = raw;
        break;
      }
      case '--only': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--only requires candidate ids, e.g. --only S100,S400');
        only = raw.split(',').map((x) => x.trim());
        break;
      }
      case '--reference': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--reference requires a --flat-reference JSON file');
        referenceFile = raw;
        break;
      }
      case '--flat-reference':
        modeFlags.push('flat-reference');
        break;
      case '--json-out': {
        const raw = argv[++i];
        if (raw === undefined) throw new Error('--json-out requires a file');
        jsonOut = raw;
        break;
      }
      case '--candidates':
      case '--curve-report':
      case '--ceiling':
      case '--v1-floor':
      case '--switch-report':
        modeFlags.push(arg.slice(2) as Mode);
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
    const needsLevels = mode !== 'capacity' && mode !== 'size-sweep' && mode !== 'start-sweep' && mode !== 'tutorial'
      && mode !== 'candidates' && mode !== 'curve-report' && mode !== 'ceiling' && mode !== 'flat-reference'
      && mode !== 'v1-floor' && mode !== 'switch-report';
    if (needsLevels && levels === null) {
      const flagName = mode === 'rows' ? '(the default row mode)' : `--${mode}`;
      throw new Error(`--levels a-b is required for ${flagName}`);
    }
  }
  // W3-11: the knob is v2-only (LevelGenerator.generate throws on a v1 knob);
  // say so up front. --size-sweep fills boards directly and takes --bias at
  // any version; --transfer runs its own grid and takes --biases instead; so
  // does W3-12's --start-sweep, which always prints the unset rows too.
  if (modes.includes('start-sweep') && bias !== null) {
    throw new Error('--start-sweep always prints unset rows; list extra biases with --biases, not --bias');
  }
  if (bias !== null && modes.includes('transfer')) {
    throw new Error('--transfer runs its own grid; use --biases, not --bias');
  }
  if (bias !== null && version !== 2 && modes.some((m) => m !== 'size-sweep')) {
    throw new Error('--bias is a generator v2 knob; add --version 2');
  }
  if (modes.includes('transfer') && version !== 2) {
    throw new Error('--transfer measures generator v2; add --version 2');
  }
  if (biasesGiven && !modes.includes('transfer') && !modes.includes('start-sweep')) {
    throw new Error('--biases is only used by --transfer and --start-sweep');
  }
  // W3-12: the start sweep has its own --rows/--biases defaults and fixes its
  // own first-session rows, so a level range would be ignored.
  if (modes.includes('start-sweep') && (modes.includes('transfer') || modes.includes('size-sweep'))) {
    throw new Error('--start-sweep sets its own --rows/--biases defaults; run it apart from --transfer and --size-sweep');
  }
  if (modes.includes('start-sweep') && levels !== null && modes.every((m) => m === 'start-sweep' || m === 'tutorial')) {
    throw new Error('--start-sweep prints T1, T2 and v1 levels 1-5 itself; --levels is not used');
  }
  if (targets.length > 0 && !modes.includes('start-sweep')) {
    throw new Error('--targets is only used by --start-sweep');
  }
  // W3-14: the curve deals v2 only; the curve modes measure v2.
  if (curve !== null && version !== 2) throw new Error('--curve is a generator v2 table; add --version 2');
  const curveModes: Mode[] = ['candidates', 'curve-report', 'ceiling', 'flat-reference', 'v1-floor', 'switch-report'];
  if (modes.some((m) => curveModes.includes(m)) && version !== 2) {
    throw new Error('--candidates, --curve-report, --ceiling, --v1-floor and --switch-report measure generator v2; add --version 2');
  }
  if ((modes.includes('v1-floor') || modes.includes('switch-report')) && (curve !== null || bias !== null || levels !== null)) {
    throw new Error('--v1-floor and --switch-report measure the shipped curve over their own ranges; drop --curve/--bias/--levels');
  }
  if (modes.includes('candidates') && curve !== null) throw new Error('--candidates builds its own curves; drop --curve');
  if (modes.includes('ceiling') && (curve !== null || bias !== null)) throw new Error('--ceiling builds its own saturated curves; drop --curve/--bias');
  if (only !== null && !modes.includes('candidates')) throw new Error('--only is only used by --candidates');
  if (modes.includes('curve-report') && bias !== null) throw new Error('--curve-report reads the bias from the curve; drop --bias');
  if (jsonOut !== null && !modes.includes('flat-reference') && (!modes.includes('curve-report') || modes.includes('candidates'))) {
    throw new Error('--json-out is only used by --flat-reference or a single --curve-report (without --candidates)');
  }
  if (referenceFile !== null && !modes.includes('curve-report')) throw new Error('--reference is only used by --curve-report');
  if (modes.includes('start-sweep') && !biasesGiven) biases = START_SWEEP_DEFAULT_BIASES;
  if (modes.includes('start-sweep') && !rowsGiven) sweepRows = START_SWEEP_DEFAULT_ROWS;
  return {
    levels, version, viewport, json, modes, bias, sweepShapes, sweepRows, sweepSeeds, biases,
    biasesGiven, rowsGiven, shapesGiven, tutorials, targets, curve, curveId, out, only, jsonOut, referenceFile,
  };
}

/** W3-14: a curve file is a JSON array of `CurveRow`s, or `{ id, rows }`. Validated before use. */
function loadCurve(file: string | undefined): { id: string; table: CurveTable } {
  if (file === undefined) throw new Error('--curve requires a JSON file');
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(raw) ? raw : (raw as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) throw new Error(`--curve ${file}: expected an array of rows or { id, rows }`);
  const table = rows as CurveTable;
  validateCurve(table);
  const id = !Array.isArray(raw) && typeof (raw as { id?: unknown }).id === 'string'
    ? (raw as { id: string }).id
    : path.basename(file, '.json');
  return { id, table };
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

/**
 * The knobs `--bias` and `--curve` pass to `LevelGenerator.generate`
 * (undefined = the shipped v2: V2_CURVE with its own bias).
 */
function knobsFor(opts: { bias: number | null; curve: CurveTable | null }): V2Knobs | undefined {
  if (opts.bias === null && opts.curve === null) return undefined;
  return {
    ...(opts.bias === null ? {} : { clearableBias: opts.bias }),
    ...(opts.curve === null ? {} : { curve: opts.curve }),
  };
}

function shapeByName(name: string): ShapeDef {
  const shape = [...allShapes(), ...bagCandidates()].find((s) => s.name === name);
  if (shape === undefined) throw new Error(`Unknown shape "${name}"`);
  return shape;
}

/** The column clamp a generator version sizes against (v1's literal 46; v2's W3-09 cap, 37). */
function maxDimFor(version: 1 | 2): number {
  return version === 2 ? V2_MAX_GRID_COLS : 46;
}

/**
 * Whether a board sits at its generator's clamp: v1, rows or cols = 46; v2
 * (W3-09/W3-14), rows = the shape's own row cap `v2MaxRows(aspect)` or cols =
 * `V2_MAX_GRID_COLS`.
 */
function atClamp(version: 1 | 2, shapeName: string, rows: number, cols: number): boolean {
  if (version === 1) return rows === 46 || cols === 46;
  return rows === v2MaxRows(shapeByName(shapeName).aspect) || cols === V2_MAX_GRID_COLS;
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
  /**
   * W3-12: the deal state's share of `blockedTaps`, `(n-k)/(k+1)` before the
   * first removal: the wrong looks W1-06's assist forgives (no heart for a
   * blocked tap while `removalsThisBoard === 0`). Existing modes never print it.
   */
  blockedAtDeal: number;
}

/**
 * Generates level `index`, then walks it to empty removing the first
 * clearable arrow in `board.arrows()` order at each step, accumulating the
 * uniform-sampling scan/blocked proxy. Asserts the board clears in exactly
 * `arrowCount` removals (the in-probe reconciliation that proves every board
 * was fully walked) and exits non-zero otherwise.
 */
function buildRow(index: number, version: 1 | 2, viewport: Viewport | null, knobs?: V2Knobs): LevelRow {
  const level = LevelGenerator.generate(index, version, knobs);
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
  let blockedAtDeal = 0;
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
    if (removals === 0) {
      clearableAtDeal = k;
      blockedAtDeal = (n - k) / (k + 1);
    }
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

  return {
    arrowCount, clearableAtDeal, scanTaps, blockedTaps, minClearable, worstN, worstK, bentCount, totalLen, blockedAtDeal,
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

/**
 * W3-11: " (clearableBias b)" in a mode's header line when --bias is set;
 * W3-14: " (curve <id>)" when --curve is set; empty when neither is.
 */
function biasTag(opts: Options): string {
  return (opts.bias === null ? '' : ` (v2 clearableBias ${opts.bias} on every tier)`)
    + (opts.curve === null ? '' : ` (v2 curve ${opts.curveId})`);
}

/** W3-11: `{ clearableBias }` in a mode's JSON when --bias is set; W3-14: `{ curve }` when --curve is; nothing otherwise (JSON unchanged). */
function biasField(opts: Options): { clearableBias?: number; curve?: string } {
  return {
    ...(opts.bias === null ? {} : { clearableBias: opts.bias }),
    ...(opts.curve === null ? {} : { curve: opts.curveId }),
  };
}

// ---- Modes --------------------------------------------------------------

function runRows(opts: Options): void {
  const indices = indicesInRange(opts.levels!);
  const rows = indices.map((i) => buildRow(i, opts.version, opts.viewport, knobsFor(opts)));

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
  const rows = indices.map((i) => buildRow(i, opts.version, null, knobsFor(opts)));
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
  const rows = indices.map((i) => buildRow(i, opts.version, null, knobsFor(opts)));

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
  notCandidates: string[];
}

function v2Admission(indices: readonly number[], curve: CurveTable): V2Admission {
  const wmt = curveWindowMaxTarget(curve);
  const windows = new Map<number, ReturnType<typeof bagWindowFor>>();
  for (const index of indices) {
    const w = bagWindowFor(index, wmt);
    windows.set(w.ordinal, w);
  }
  const list = [...windows.values()].sort((a, b) => a.ordinal - b.ordinal);
  // W3-18: only bag candidates can be admitted or excluded by capacity; a catalogue id awaiting
  // W3-19 (or retired) is not a candidate and is reported separately.
  const candidates = bagCandidates().map((s) => s.name);
  const inAll = new Set(candidates);
  const inAny = new Set<string>();
  let truncated = 0;
  for (const w of list) {
    const names = new Set(w.order.map((s) => s.name));
    for (const id of [...inAll]) if (!names.has(id)) inAll.delete(id);
    for (const id of names) inAny.add(id);
    if (windowSetAt(w.start, wmt).length !== w.order.length) truncated++;
  }
  return {
    windows: list.length,
    firstOrdinal: list[0].ordinal,
    lastOrdinal: list[list.length - 1].ordinal,
    setSizes: [...new Set(list.map((w) => w.order.length))].sort((a, b) => a - b),
    truncated,
    admittedEverywhere: candidates.filter((id) => inAll.has(id)),
    excludedEverywhere: candidates.filter((id) => !inAny.has(id)),
    notCandidates: SHAPE_CATALOGUE.filter((id) => !candidates.includes(id)),
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
    const level = LevelGenerator.generate(index, opts.version, knobsFor(opts));
    const name = level.shapeName;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!firstAppearance.has(name)) firstAppearance.set(name, index + 1);
    if (prevShape !== null && prevShape === name) backToBack++;
    prevShape = name;
    if (atClamp(opts.version, name, level.board.rows, level.board.cols)) {
      clampHits.set(name, (clampHits.get(name) ?? 0) + 1);
      totalClampLevels++;
    }
  }
  const drought = longestFirstAppearanceGap(opts.levels![0], firstAppearance);
  const admission = opts.version === 2 ? v2Admission(indices, opts.curve ?? V2_CURVE) : null;

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
  console.log(`Shape census over displayed levels ${opts.levels![0]}-${opts.levels![1]} (generator v${opts.version})${biasTag(opts)}`);
  console.log('');
  console.log(table(
    ['shape', 'count', 'share', 'first appearance', opts.version === 2
      ? `clamp hits (rows = v2MaxRows(aspect) or cols = ${maxDim})`
      : `clamp hits (rows or cols = ${maxDim})`],
    shapes.map((s) => [s.name, s.count, fmtPct(s.sharePct), s.firstAppearance, `${s.clampHits}/${s.count}`]),
  ));
  console.log('');
  console.log(`Back-to-back repeats: ${backToBack}`);
  console.log(opts.version === 2
    ? `Rows hit the shape's row cap or cols hit ${maxDim} on ${totalClampLevels} levels`
    : `Rows or cols hit ${maxDim} on ${totalClampLevels} levels`);
  console.log(`Longest first-appearance gap: ${drought.gap} levels (level ${drought.from} to level ${drought.to})`);
  if (admission !== null) {
    const size = admission.setSizes.length === 1 ? admission.setSizes[0] : null;
    const total = indices.length;
    console.log('');
    console.log(`v2 bag: ${admission.windows} windows (ordinals ${admission.firstOrdinal}-${admission.lastOrdinal}), `
      + `admissible set size(s) ${admission.setSizes.join(', ')}, truncated windows ${admission.truncated}`);
    console.log(`Admitted in every window (${admission.admittedEverywhere.length}): ${admission.admittedEverywhere.join(', ')}`);
    console.log(`Excluded from every window (${admission.excludedEverywhere.length}): ${admission.excludedEverywhere.join(', ') || 'none'}`);
    console.log(`Not bag candidates (awaiting W3-19 or retired) (${admission.notCandidates.length}): ${admission.notCandidates.join(', ') || 'none'}`);
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
  const rows = indices.map((i) => buildRow(i, opts.version, null, knobsFor(opts)));
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
 * at its largest v2 board (W3-09/W3-14: rows = `v2MaxRows(aspect)`, the most
 * rows whose cols fit `V2_MAX_GRID_COLS`), via the bag's own `shapeCapacity`,
 * with whether the curve's saturated window admits it (every window from the
 * curve's last row on has the same set), and, for reference, the W3-10
 * placeholder's (v1 tier bands, 720).
 */
function runCapacityV2(opts: Options): void {
  const cfg = Difficulties.config(Difficulty.Normal);
  const curve = opts.curve ?? V2_CURVE;
  const last = curve[curve.length - 1].levelIndex;
  const windowMax = curveWindowMaxTarget(curve)(last, last + Difficulties.cycleLength);
  const placeholderMax = placeholderWindowMaxTarget(0, Difficulties.cycleLength);
  const data = bagCandidates().map((shape) => {
    const rows = v2MaxRows(shape.aspect);
    const cols = v2Cols(rows, shape.aspect);
    const cells = shapeCapacity(shape);
    const mask = shape.rasterize(rows, cols);
    const arrowCounts = [1, 2, 3, 4, 5].map((s) => LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(s)).length);
    return {
      name: shape.name, rows, cols, cells, medianArrows: median(ascending(arrowCounts)),
      admitted: cells >= windowMax, admittedPlaceholder: cells >= placeholderMax,
    };
  }).sort((a, b) => b.cells - a.cells);

  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'capacity', version: 2, maxRows: V2_MAX_GRID_ROWS, maxCols: V2_MAX_GRID_COLS,
      curve: opts.curveId, windowMaxTarget: windowMax, placeholderWindowMaxTarget: placeholderMax, shapes: data,
    }, null, 2));
    return;
  }

  printHonestyBound();
  console.log(`v2 per-shape capacity at the W3-09 clamp (cols <= V2_MAX_GRID_COLS = ${V2_MAX_GRID_COLS}, `
    + `rows = v2MaxRows(aspect) <= V2_MAX_GRID_ROWS = ${V2_MAX_GRID_ROWS}, aspect kept)`);
  console.log(`Admission: capacity >= the ${opts.curveId} curve's saturated window max target ${windowMax} `
    + `(from level index ${last} on); placeholder column: >= ${placeholderMax} (v1 tier bands, W3-10).`);
  console.log('Arrows use the Normal config, median over DotNetRandom(1..5).');
  console.log('');
  console.log(table(
    ['shape', 'rows×cols', 'cells', 'median arrows (Normal, seeds 1-5)', `admitted at saturation (>= ${windowMax})`, `placeholder (>= ${placeholderMax})`],
    data.map((d) => [d.name, `${d.rows}×${d.cols}`, d.cells, d.medianArrows, d.admitted ? 'yes' : 'no', d.admittedPlaceholder ? 'yes' : 'no']),
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
      const level = LevelGenerator.generate(index, opts.version, knobsFor(opts));
      if (!atClamp(opts.version, level.shapeName, level.board.rows, level.board.cols)) return null;
      const maskCells = countTrue(level.mask);
      if (maskCells >= level.targetCells) return null;
      const cfg = opts.version === 2
        ? Difficulties.configV2(level.difficulty, index, opts.curve ?? V2_CURVE)
        : Difficulties.config(level.difficulty);
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
  console.log(`Clamp shortfalls over displayed levels ${opts.levels![0]}-${opts.levels![1]} (generator v${opts.version})${biasTag(opts)}`);
  console.log(opts.version === 2
    ? `(rows hit the shape's row cap v2MaxRows(aspect) or cols hit ${maxDim} AND the mask fell short of the drawn cell target)`
    : `(rows or cols hit the ${maxDim} clamp AND the mask fell short of the drawn cell target)`);
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
  // W3-14: "unset" is the curve's own bias at each level (the shipped curve,
  // or --curve); a b overrides it on every level.
  const curve = opts.curve ?? V2_CURVE;
  const neutralLevels = indices.map((i) => LevelGenerator.generate(i, 2, { curve }));
  const setI: SettingResult[] = settings.map((bias) => {
    const real = aggregateStream(indices.map((i, k) => {
      const lvl = LevelGenerator.generate(i, 2, knobsFor({ bias, curve }));
      const base = neutralLevels[k];
      if (lvl.shapeName !== base.shapeName || lvl.board.rows !== base.board.rows || lvl.board.cols !== base.board.cols) {
        throw new Error(`level index ${i}: the bias changed the shape or size, which it must never do`);
      }
      return toSample(walkBoard(lvl.board, lvl.arrowCount, `level index ${i} bias ${biasLabel(bias)}`));
    }));
    const replicas = seeds.map((s) => aggregateStream(neutralLevels.map((base, k) => fillAndWalk(
      base.mask, base.board.rows, base.board.cols, withBias(Difficulties.configV2(base.difficulty, indices[k], curve), bias), s,
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

// ---- W3-12: the first session and the level-1 candidates on one table ---

/** Median (the probe's convention), min–max and mean over one row's samples. */
interface RowStat {
  median: number;
  min: number;
  max: number;
  mean: number;
}

function rowStat(values: readonly number[]): RowStat {
  return {
    median: med(values),
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((t, v) => t + v, 0) / values.length,
  };
}

/** One walked board of a start-sweep row. */
interface StartSample {
  /** `DotNetRandom(seed)` for a candidate fill; null for a fixed board (tutorial, v1/v2 level). */
  seed: number | null;
  arrows: number;
  clearable: number;
  clearablePct: number;
  scan: number;
  blocked: number;
  blockedAtDeal: number;
  blockedAfterFirstRemoval: number;
}

type StartSection = 'tutorial' | 'v1' | 'v2-placeholder' | 'candidate';

interface StartRow {
  section: StartSection;
  /** The row's name in the doc: `T1`, `v1 L1`, or `<bias>/<rows>/<shape>` for a candidate, e.g. `b3/12/Circle`. */
  id: string;
  shape: string;
  rows: number;
  cols: number;
  maskCells: number | null;
  bias: number | null;
  n: number;
  arrows: RowStat;
  clearable: RowStat;
  clearablePct: RowStat;
  scan: RowStat;
  blocked: RowStat;
  blockedAtDeal: RowStat;
  blockedAfterFirstRemoval: RowStat;
  /** Fit-to-view pt per cell, keyed by `START_VIEWPORTS` label. */
  cellPt: Record<string, number>;
  flags: string[];
  /** The lowest seed whose blocked taps equal the row's median: the board a screenshot shows. */
  medianSeed: number | null;
  samples: StartSample[];
}

function startSample(m: WalkMetrics, seedValue: number | null): StartSample {
  return {
    seed: seedValue,
    arrows: m.arrowCount,
    clearable: m.clearableAtDeal,
    clearablePct: (m.clearableAtDeal / m.arrowCount) * 100,
    scan: m.scanTaps,
    blocked: m.blockedTaps,
    blockedAtDeal: m.blockedAtDeal,
    blockedAfterFirstRemoval: m.blockedTaps - m.blockedAtDeal,
  };
}

/** Fit-to-view pt per cell from the shipping camera (`initialCamera(..., zoomed=false)`, as BoardView's fit). */
function cellPtAtFit(vp: { w: number; h: number }, rows: number, cols: number): number {
  const camera = initialCamera(vp.w, vp.h, cols * BOARD_CELL_UNITS, rows * BOARD_CELL_UNITS, BOARD_CELL_UNITS, false);
  if (camera === null || camera.scale !== camera.minScale) throw new Error(`no fit camera for ${vp.w}x${vp.h}`);
  return camera.scale * BOARD_CELL_UNITS;
}

/** The most columns W3-09's floor admits on the 360 dp viewport (a width-bound board); derived from the camera. */
function maxLegibleCols(): number {
  const vp = START_VIEWPORTS[0];
  let cols = 1;
  while (cellPtAtFit(vp, 1, cols + 1) >= MIN_LEGIBLE_CELL_PT) cols++;
  return cols;
}

function biasId(bias: number | null): string {
  return bias === null ? 'unset' : `b${bias}`;
}

function startRow(
  section: StartSection,
  id: string,
  shape: string,
  rows: number,
  cols: number,
  maskCells: number | null,
  bias: number | null,
  samples: readonly StartSample[],
  flags: readonly string[],
): StartRow {
  const pick = (f: (x: StartSample) => number) => samples.map(f);
  const blocked = rowStat(pick((x) => x.blocked));
  const cellPt = Object.fromEntries(START_VIEWPORTS.map((v) => [v.label, cellPtAtFit(v, rows, cols)]));
  const allFlags = [...flags];
  if (cellPt[START_VIEWPORTS[0].label] < MIN_LEGIBLE_CELL_PT) {
    allFlags.push(`cellPt < ${MIN_LEGIBLE_CELL_PT} at ${START_VIEWPORTS[0].label} dp (W3-09 floor)`);
  }
  if (bias !== null && !BRAND_GATE_PASSED_BIASES.includes(bias)) {
    allFlags.push(`b=${bias} did not pass W3-11's brand gate`);
  }
  const medianSample = samples.find((x) => x.blocked === blocked.median) ?? null;
  return {
    section, id, shape, rows, cols, maskCells, bias,
    n: samples.length,
    arrows: rowStat(pick((x) => x.arrows)),
    clearable: rowStat(pick((x) => x.clearable)),
    clearablePct: rowStat(pick((x) => x.clearablePct)),
    scan: rowStat(pick((x) => x.scan)),
    blocked,
    blockedAtDeal: rowStat(pick((x) => x.blockedAtDeal)),
    blockedAfterFirstRemoval: rowStat(pick((x) => x.blockedAfterFirstRemoval)),
    cellPt,
    flags: allFlags,
    medianSeed: medianSample === null ? null : medianSample.seed,
    samples: [...samples],
  };
}

/** W1-02's authored board, walked with the same walk (no generator call). */
function tutorialStartRow(id: TutorialId): StartRow {
  const level = buildTutorialLevel(id);
  const { rows, cols } = level.board;
  const m = walkBoard(level.board, level.arrowCount, `tutorial ${id}`);
  return startRow('tutorial', id, '(authored)', rows, cols, null, null, [startSample(m, null)], []);
}

/** A shipped (v1) or placeholder (v2, dark) campaign level, as `buildRow` generates it. */
function levelStartRow(index: number, version: 1 | 2): StartRow {
  const level = LevelGenerator.generate(index, version);
  const { rows, cols } = level.board;
  const maskCells = countTrue(level.mask);
  const m = walkBoard(level.board, level.arrowCount, `v${version} level index ${index}`);
  const section: StartSection = version === 1 ? 'v1' : 'v2-placeholder';
  return startRow(section, `v${version} L${index + 1}`, level.shapeName, rows, cols, maskCells, null, [startSample(m, null)], []);
}

/**
 * One candidate: `shape` at `rows` rows, cols = `v2Cols` (v2's sizing formula),
 * Normal config plus the bias, filled by the shipping `fillMask` with
 * `DotNetRandom(s)` per seed and walked. An empty raster falls back to the
 * full grid, as `buildV2` does, and is flagged.
 */
function candidateStartRow(
  shape: ShapeDef,
  rows: number,
  bias: number | null,
  seeds: readonly number[],
  id: string = `${biasId(bias)}/${rows}/${shape.name}`,
): StartRow {
  const cols = v2Cols(rows, shape.aspect);
  const mask = shape.rasterize(rows, cols);
  let maskCells = countTrue(mask);
  const flags: string[] = [];
  if (maskCells === 0) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mask[r][c] = true;
    maskCells = rows * cols;
    flags.push('empty raster: full-grid fallback (as buildV2)');
  }
  if (rows < V2_MIN_GRID_ROWS) flags.push(`rows < ${V2_MIN_GRID_ROWS}: below v2's row floor (V2_MIN_GRID_ROWS)`);
  const cfg = withBias(NORMAL_CFG(), bias);
  const samples = seeds.map((s) => {
    const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, new DotNetRandom(s));
    const board = new BoardLogic(rows, cols);
    for (const a of arrows) board.add(a);
    return startSample(walkBoard(board, arrows.length, `${id} seed ${s}`), s);
  });
  return startRow('candidate', id, shape.name, rows, cols, maskCells, bias, samples, flags);
}

/**
 * v2's board size for a cell target. W3-12 kept a replica of `buildV2`'s fit
 * here (its concern 6); W3-14 exports the shipping sizing (`v2GridFor`,
 * shapeBag.ts) and uses it. `checkV2SizingReplica` still compares it with
 * `generate(i, 2)` before any `--targets` row uses it.
 */
function v2SizeForTarget(shape: ShapeDef, targetCells: number): { rows: number; cols: number } {
  return v2GridFor(shape, targetCells);
}

/** v2 levels checked against the replica: the corpus W3-10/W3-11 pinned (0-299, `04d0ec7e`). */
const V2_SIZING_CHECK_LEVELS = 300;

/** Throws unless the replica reproduces `generate(i, 2)`'s rows x cols for every checked level; returns the count. */
function checkV2SizingReplica(): number {
  const byName = new Map(bagCandidates().map((s) => [s.name, s] as const));
  for (let i = 0; i < V2_SIZING_CHECK_LEVELS; i++) {
    const level = LevelGenerator.generate(i, 2);
    const shape = byName.get(level.shapeName);
    if (shape === undefined) throw new Error(`v2 level index ${i}: shape ${level.shapeName} is not a bag candidate`);
    const { rows, cols } = v2SizeForTarget(shape, level.targetCells);
    if (rows !== level.board.rows || cols !== level.board.cols) {
      throw new Error(`v2 sizing replica: level index ${i} ${shape.name} target ${level.targetCells} gives ${rows}x${cols}, `
        + `generate(i, 2) dealt ${level.board.rows}x${level.board.cols}`);
    }
  }
  return V2_SIZING_CHECK_LEVELS;
}

/** A (rows, bias) group of candidates across the shape set: pooled over every shape and seed. */
interface StartSummary {
  rows: number;
  rowsRange: { min: number; max: number };
  bias: number | null;
  shapes: number;
  boards: number;
  maskCells: RowStat; // over shapes
  cols: { min: number; max: number };
  arrows: { pooled: number; shapeMin: number; shapeMax: number };
  clearablePct: { pooled: number; shapeMin: number; shapeMax: number };
  blocked: { pooled: number; shapeMin: number; shapeMax: number };
  blockedAtDeal: { pooled: number; shapeMin: number; shapeMax: number };
  blockedAfterFirstRemoval: { pooled: number; shapeMin: number; shapeMax: number };
  cellPt360: { min: number; max: number };
  flaggedShapes: number;
}

function summarise(group: readonly StartRow[]): StartSummary {
  const samples = group.flatMap((r) => r.samples);
  const spread = (rowKey: 'arrows' | 'clearablePct' | 'blocked' | 'blockedAtDeal' | 'blockedAfterFirstRemoval') => {
    const perShape = group.map((r) => r[rowKey].median);
    return { pooled: med(samples.map((x) => x[rowKey])), shapeMin: Math.min(...perShape), shapeMax: Math.max(...perShape) };
  };
  const vp360 = START_VIEWPORTS[0].label;
  return {
    rows: group[0].rows,
    rowsRange: minMax(group.map((r) => r.rows)),
    bias: group[0].bias,
    shapes: group.length,
    boards: samples.length,
    maskCells: rowStat(group.map((r) => r.maskCells ?? 0)),
    cols: minMax(group.map((r) => r.cols)),
    arrows: spread('arrows'),
    clearablePct: spread('clearablePct'),
    blocked: spread('blocked'),
    blockedAtDeal: spread('blockedAtDeal'),
    blockedAfterFirstRemoval: spread('blockedAfterFirstRemoval'),
    cellPt360: minMax(group.map((r) => r.cellPt[vp360])),
    flaggedShapes: group.filter((r) => r.flags.length > 0).length,
  };
}

function startTableHeaders(): string[] {
  return [
    'row', 'rows×cols', 'mask cells', 'n', 'arrows median [min–max]', 'arrows mean', 'clearable@0 median (%)',
    'scan median', 'blocked median [min–max]', 'blocked mean', 'blocked@deal median', 'blocked after 1st removal median',
    `cellPt ${START_VIEWPORTS.map((v) => v.label).join(' / ')}`, 'median seed', 'blocked < v1 L1', 'flags',
  ];
}

function startTableRow(r: StartRow, baselineBlocked: number | null): (string | number)[] {
  const range = (s: RowStat, digits: number) => (r.n === 1 ? s.median.toFixed(digits) : `${s.median.toFixed(digits)} [${fmtRange(s, digits)}]`);
  return [
    r.id,
    `${r.rows}×${r.cols}`,
    r.maskCells ?? '-',
    r.n,
    range(r.arrows, 0),
    r.arrows.mean.toFixed(1),
    `${r.clearable.median} (${r.clearablePct.median.toFixed(1)}%)`,
    r.scan.median.toFixed(1),
    range(r.blocked, 1),
    r.blocked.mean.toFixed(1),
    r.blockedAtDeal.median.toFixed(1),
    r.blockedAfterFirstRemoval.median.toFixed(1),
    START_VIEWPORTS.map((v) => r.cellPt[v.label].toFixed(1)).join(' / '),
    r.medianSeed ?? '-',
    baselineBlocked === null ? '-' : r.blocked.median < baselineBlocked ? 'yes' : 'NO',
    r.flags.join('; ') || '-',
  ];
}

function tutorialInvariant(id: TutorialId, r: StartRow): string {
  const k = r.clearable.median;
  const n = r.arrows.median;
  if (id === 'T1') return `W1-02 invariant T1 (every arrow clearable at deal): ${k}/${n} clearable, ${k === n ? 'holds' : 'BROKEN'}`;
  return `W1-02 invariant T2 (exactly 1 clearable at deal): ${k}/${n} clearable, ${k === 1 ? 'holds' : 'BROKEN'}`;
}

function runTutorial(opts: Options): void {
  const rows = opts.tutorials.map((id) => ({ id, row: tutorialStartRow(id) }));
  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'tutorial', viewports: START_VIEWPORTS,
      boards: rows.map(({ id, row }) => ({ ...row, invariant: tutorialInvariant(id, row) })),
    }, null, 2));
    return;
  }
  printHonestyBound();
  console.log(`W1-02 tutorial boards (src/core/tutorialLevels.ts, BoardLogic.parse; no generator call), same walk as every probe row.`);
  console.log('');
  console.log(table(startTableHeaders(), rows.map(({ row }) => startTableRow(row, null))));
  console.log('');
  for (const { id, row } of rows) console.log(tutorialInvariant(id, row));
}

function runStartSweep(opts: Options): void {
  const seeds = seedList(opts);
  const shapes: readonly ShapeDef[] = opts.shapesGiven ? opts.sweepShapes.map(shapeByName) : bagCandidates();
  const settings: (number | null)[] = [null, ...opts.biases];
  const [v1Lo, v1Hi] = START_SWEEP_V1_LEVELS;

  const tutorials = (['T1', 'T2'] as const).map((id) => tutorialStartRow(id));
  const v1Rows: StartRow[] = [];
  const v2Rows: StartRow[] = [];
  for (let displayed = v1Lo; displayed <= v1Hi; displayed++) {
    v1Rows.push(levelStartRow(displayed - 1, 1));
    v2Rows.push(levelStartRow(displayed - 1, 2));
  }
  const baseline = v1Rows[0];
  const baselineBlocked = baseline.blocked.median;

  const candidates: StartRow[] = [];
  for (const bias of settings) {
    for (let rows = opts.sweepRows[0]; rows <= opts.sweepRows[1]; rows++) {
      for (const shape of shapes) candidates.push(candidateStartRow(shape, rows, bias, seeds));
    }
  }
  const summaries: StartSummary[] = [];
  for (const bias of settings) {
    for (let rows = opts.sweepRows[0]; rows <= opts.sweepRows[1]; rows++) {
      summaries.push(summarise(candidates.filter((r) => r.bias === bias && r.rows === rows)));
    }
  }

  // --targets: every shape sized to each cell target by v2's own fit, i.e. level 1 whatever shape the bag deals.
  const sizingChecked = opts.targets.length > 0 ? checkV2SizingReplica() : 0;
  const targetRows: StartRow[] = [];
  const targetSummaries: { target: number; summary: StartSummary }[] = [];
  for (const bias of settings) {
    for (const target of opts.targets) {
      const group = shapes.map((shape) =>
        candidateStartRow(shape, v2SizeForTarget(shape, target).rows, bias, seeds, `${biasId(bias)}/T${target}/${shape.name}`));
      targetRows.push(...group);
      targetSummaries.push({ target, summary: summarise(group) });
    }
  }

  const below = candidates.filter((r) => r.blocked.median < baselineBlocked);
  const notBelow = candidates.filter((r) => !(r.blocked.median < baselineBlocked));

  // Admissibility for a level-1 window: capacity at the clamp against each candidate's own cell count.
  const capacities = bagCandidates().map((s) => ({ name: s.name, capacity: shapeCapacity(s) }));
  const minCap = capacities.reduce((a, b) => (b.capacity < a.capacity ? b : a));
  const maxCandidateCells = Math.max(...candidates.map((r) => r.maskCells ?? 0));
  const inadmissible = candidates.filter((r) => (r.maskCells ?? 0) > (capacities.find((c) => c.name === r.shape)?.capacity ?? 0));
  // Illustration only: which shapes window 0 would deal if a curve admitted every candidate there.
  const allAdmitted: typeof placeholderWindowMaxTarget = () => 0;
  const window0 = bagWindowFor(0, allAdmitted);
  const legibleCols = maxLegibleCols();

  if (opts.json) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'start-sweep', viewports: START_VIEWPORTS, minLegibleCellPt: MIN_LEGIBLE_CELL_PT,
      maxLegibleCols360: legibleCols, brandGatePassedBiases: BRAND_GATE_PASSED_BIASES, biases: settings,
      rows: opts.sweepRows, seeds: opts.sweepSeeds, shapes: shapes.map((s) => s.name),
      firstSession: [...tutorials, ...v1Rows], v2Placeholder: v2Rows, candidates, summaries,
      baseline: { id: baseline.id, blocked: baselineBlocked },
      belowBaseline: { count: below.length, of: candidates.length, ids: below.map((r) => r.id) },
      notBelowBaseline: notBelow.map((r) => r.id),
      admissibility: { minCapacity: minCap, maxCandidateCells, inadmissible: inadmissible.map((r) => r.id) },
      window0IfAllAdmitted: window0.order.map((s) => s.name),
      targets: opts.targets, v2SizingReplicaCheckedLevels: sizingChecked, targetSummaries, targetRows,
    }, null, 2));
    return;
  }

  printHonestyBound();
  console.log('W3-12 start sweep: the first session and the level-1 candidates on one table, in play order.');
  console.log(`Candidates: ${shapes.length} shapes x rows ${opts.sweepRows[0]}-${opts.sweepRows[1]} (cols = v2Cols(rows, aspect)) `
    + `x b in {${settings.map(biasLabel).join(', ')}} x DotNetRandom(s), s = ${seeds[0]}..${seeds[seeds.length - 1]}; `
    + `Normal config (level 1 is Normal); ${candidates.length} rows, n = ${seeds.length} boards each.`);
  console.log('Each candidate cell is the median over its seeds (the probe\'s median), with [min–max]; "blocked mean" is the plain mean '
    + '(the red team quoted means). T/v1 rows are fixed boards (n = 1).');
  console.log('blocked@deal = (n-k)/(k+1) in the deal state: the wrong looks W1-06\'s assist forgives (no heart before a board\'s first '
    + 'removal). blocked after 1st removal = blocked - blocked@deal: what hearts pay for with the assist ON.');
  console.log(`cellPt = fit-to-view pt per cell from the shipping initialCamera on the board viewports W3-08 logged: `
    + `${START_VIEWPORTS.map((v) => `${v.label} = ${v.w.toFixed(2)}x${v.h.toFixed(2)} dp`).join(', ')}. `
    + `W3-09 floor: ${MIN_LEGIBLE_CELL_PT} pt, i.e. at most ${legibleCols} columns at ${START_VIEWPORTS[0].label} dp.`);
  console.log(`Bias: W3-11's brand gate passed only b = ${BRAND_GATE_PASSED_BIASES.join(', ')}; any other b is flagged.`);
  console.log(`"median seed" = the lowest seed whose blocked equals the row median (the board to screenshot). `
    + `"blocked < v1 L1" compares the median with v1 level 1's measured ${baselineBlocked.toFixed(1)}.`);

  console.log('');
  console.log('First session (fixed boards, play order): W1-02 tutorials, then v1 levels 1-5 (v1 L1 = the baseline row).');
  console.log('');
  console.log(table(startTableHeaders(), [...tutorials, ...v1Rows].map((r) => startTableRow(r, r === baseline ? null : baselineBlocked))));
  console.log('');
  console.log(tutorialInvariant('T1', tutorials[0]));
  console.log(tutorialInvariant('T2', tutorials[1]));

  console.log('');
  console.log('For reference: generator v2 levels 1-5 as dealt today (the shipped V2_CURVE, dark behind GEN_V2_ENABLED).');
  console.log('');
  console.log(table(startTableHeaders(), v2Rows.map((r) => startTableRow(r, baselineBlocked))));

  console.log('');
  console.log('Candidates by (rows, b) across the shape set: pooled median over every shape x seed board, '
    + 'with the per-shape medians\' min–max in brackets.');
  console.log('');
  const pooled = (x: { pooled: number; shapeMin: number; shapeMax: number }, digits: number) =>
    `${x.pooled.toFixed(digits)} [${x.shapeMin.toFixed(digits)}–${x.shapeMax.toFixed(digits)}]`;
  console.log(table(
    ['rows', 'b', 'shapes x seeds', 'mask cells median [min–max]', 'cols', 'arrows', 'clearable@0 %', 'blocked',
      'blocked@deal', 'blocked after 1st removal', `cellPt ${START_VIEWPORTS[0].label} [min–max]`, 'flagged shapes'],
    summaries.map((s) => [
      s.rows, biasLabel(s.bias), `${s.shapes} x ${seeds.length} = ${s.boards}`,
      `${s.maskCells.median} [${s.maskCells.min}–${s.maskCells.max}]`, `${s.cols.min}–${s.cols.max}`,
      pooled(s.arrows, 0), pooled(s.clearablePct, 1), pooled(s.blocked, 1), pooled(s.blockedAtDeal, 1),
      pooled(s.blockedAfterFirstRemoval, 1), `${s.cellPt360.min.toFixed(1)}–${s.cellPt360.max.toFixed(1)}`,
      s.flaggedShapes,
    ]),
  ));

  for (const bias of settings) {
    console.log('');
    console.log(`Candidate rows, b = ${biasLabel(bias)}${bias !== null && !BRAND_GATE_PASSED_BIASES.includes(bias) ? ' (FLAGGED: not a brand-gate pass)' : ''}:`);
    console.log('');
    console.log(table(startTableHeaders(), candidates.filter((r) => r.bias === bias).map((r) => startTableRow(r, baselineBlocked))));
  }

  if (opts.targets.length > 0) {
    console.log('');
    console.log(`Level 1 at a cell target, whatever shape the bag deals: every shape sized to the target by v2's own fit `
      + `(a replica of buildV2's sizing, checked against generate(i, 2) rows x cols on v2 levels 0-${sizingChecked - 1}: all match), `
      + 'then filled and walked like the rows above. Pooled median over every shape x seed, per-shape medians\' min–max in brackets.');
    console.log('');
    console.log(table(
      ['target cells', 'b', 'shapes x seeds', 'rows', 'cols', 'mask cells median [min–max]', 'arrows', 'clearable@0 %', 'blocked',
        'blocked@deal', 'blocked after 1st removal', `cellPt ${START_VIEWPORTS[0].label} [min–max]`, 'flagged shapes'],
      targetSummaries.map(({ target, summary: s }) => [
        target, biasLabel(s.bias), `${s.shapes} x ${seeds.length} = ${s.boards}`, `${s.rowsRange.min}–${s.rowsRange.max}`,
        `${s.cols.min}–${s.cols.max}`, `${s.maskCells.median} [${s.maskCells.min}–${s.maskCells.max}]`,
        pooled(s.arrows, 0), pooled(s.clearablePct, 1), pooled(s.blocked, 1), pooled(s.blockedAtDeal, 1),
        pooled(s.blockedAfterFirstRemoval, 1), `${s.cellPt360.min.toFixed(1)}–${s.cellPt360.max.toFixed(1)}`, s.flaggedShapes,
      ]),
    ));
    console.log('');
    console.log('Per shape at each target (row = <b>/T<target>/<shape>):');
    console.log('');
    console.log(table(startTableHeaders(), targetRows.map((r) => startTableRow(r, baselineBlocked))));
  }

  console.log('');
  console.log(`Rows whose median blocked is below v1 level 1's measured ${baselineBlocked.toFixed(1)}: `
    + `${below.length} of ${candidates.length} candidate rows (the "yes" rows above)`
    + (notBelow.length === 0 ? '; none is at or above it.' : `; at or above it: ${notBelow.map((r) => r.id).join(', ')}.`));
  console.log(`Admissible shapes: the ${capacities.length} bag candidates' smallest capacity at the clamp (W3-09: cols <= ${V2_MAX_GRID_COLS}, rows <= v2MaxRows(aspect)) `
    + `is ${minCap.capacity} (${minCap.name}); the largest candidate board here holds ${maxCandidateCells} cells; `
    + `candidate rows above their own shape's capacity: ${inadmissible.length === 0 ? 'none' : inadmissible.map((r) => r.id).join(', ')}.`);
  console.log(`Which shape level 1 gets is the bag's pick, not a row's: if a curve admitted every candidate to window 0, `
    + `the bag would deal ${window0.order.slice(0, 5).map((s) => s.name).join(', ')} at levels 1-5 `
    + `(bagWindowFor(0) with a window max target of 0; W3-14's curve sets the real window).`);
}

// ---- W3-14: curve candidates, the curve report (a)-(g), and the ceiling ----

/** `--candidates` writes its tables here unless `--out` says otherwise (artifacts/ is gitignored). */
const CANDIDATES_DEFAULT_OUT = 'artifacts/W3-14/curves';
/**
 * Ruling W3-7's exploration grid (docs/next-level/progress.md): the displayed
 * level at which base cells reach the ceiling. Sampling points, not shipped
 * values; the owner picks in W3-16.
 */
const CANDIDATE_SATURATION_LEVELS = [100, 400, 1000] as const;
/**
 * The bias-tail variants (brief step 3): after saturation the bias keeps
 * falling, linearly from 1 (neutral) at the saturation level to this floor at
 * displayed level `BIAS_TAIL_END_LEVEL`, then holds. 0.3 is the mildest value
 * below 1 that W3-11 measured; its brand gate flags it ("changes arrow look"),
 * so every tail is flagged "look not accepted".
 */
const BIAS_TAIL_FLOOR = 0.3; // OWNER-PICKED STARTING VALUE (exploration grid; W3-11 owner-question-1 recommendation, hard side)
const BIAS_TAIL_END_LEVEL = 3000; // OWNER-PICKED STARTING VALUE (exploration grid: the end of report (a)'s range)
/** The brief's report ranges: (a) over levels 1-3000; (e) indices 0-99,999 every 7th; the controller's heaviest over 0-9999. */
const CURVE_REPORT_LEVELS: readonly [number, number] = [1, 3000];
const HEAVY_SAMPLE_END = 100000;
const HEAVY_SAMPLE_STEP = 7;
const HEAVIEST_FULL_END = 10000;
/** Brief (g): the switch levels (displayed) at which a v1 player meets v2. */
const SWITCH_LEVELS = [2, 12, 40, 100, 400, 1000] as const;
/** The controller's key levels (displayed) for the level -> (cells, bias) table. */
const KEY_LEVELS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000] as const;
/** v1's heaviest board over indices 0-9999: index 7157, Butterfly, 262 arrows (W3-10 heavy.ts; re-measured by --curve-report). */
const V1_HEAVIEST_INDEX = 7157;
const V1_HEAVIEST_ARROWS = 262;
/** W3-10 heavy.ts's rep count for timing one board. */
const TIMING_REPS = 15;
/**
 * (a)'s block sizes: 50 cycles = 300 levels (1-3000 is 10 blocks; the
 * verdict), and 10 cycles = 60 levels (50 blocks; shown, too noisy to judge:
 * a flat curve moves up to about 30% between them). Method, not a gate.
 */
const MONOTONE_BLOCK_CYCLES = 50;
const FINE_BLOCK_CYCLES = 10;
/** (b)'s smoothing: a running median over this many cycles (60 levels); single cycles cross the plateau by noise. Method. */
const SATURATION_RUN_CYCLES = 10;
/** (g)'s window: the cycles a switching player meets next (10 cycles = 60 levels), beside the brief's single cycle. Method. */
const SWITCH_WINDOW_CYCLES = 10;
/**
 * (a)'s noise reference: v2 dealt from a flat curve (the ceiling from level 1)
 * over this range, 40 blocks of 300 levels (39 block-to-block changes). W3-14's
 * first run used 1-3000 only (9 changes) and under-estimated the noise: a
 * candidate's own input-flat plateau moved more than that. Method, not a gate.
 */
const FLAT_REFERENCE_LEVELS: readonly [number, number] = [1, 12000];
/**
 * `--ceiling`'s scan (base cells); the refinement steps by 1 between the last pass and the first failure. Method.
 * W3-14 scanned 330-370 by 5 on the legacy stream (it bracketed at 339/340). RE-CEILING (2026-09-26) re-scans on
 * `ExactDotNetRandom`, where every value up to 370 passes (V2-FINISH Concern 2), so the scan runs to 480 by 10: a
 * scratch exploration found 450 passing and 460, 480 and 500 failing.
 */
const CEILING_SCAN: readonly number[] = [330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480];

interface Candidate {
  id: string;
  saturationLevel: number;
  biasTail: boolean;
  description: string;
  table: CurveTable;
}

/** Row 0 (W3-13's owner pick) every candidate shares. */
function candidateRow0(): CurveTable[number] {
  return { levelIndex: 0, baseCells: LEVEL1_TARGET_CELLS, tierTexture: V1_TIER_TEXTURE, clearableBias: LEVEL1_CLEARABLE_BIAS };
}

function buildCandidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const tail of [false, true]) {
    for (const s of CANDIDATE_SATURATION_LEVELS) {
      const rows: CurveTable[number][] = [
        candidateRow0(),
        { levelIndex: s - 1, baseCells: CEILING_BASE_CELLS, tierTexture: V1_TIER_TEXTURE },
      ];
      if (tail) {
        rows.push({ levelIndex: BIAS_TAIL_END_LEVEL - 1, baseCells: CEILING_BASE_CELLS, tierTexture: V1_TIER_TEXTURE, clearableBias: BIAS_TAIL_FLOOR });
      }
      validateCurve(rows);
      out.push({
        id: `S${s}${tail ? 'b' : ''}`,
        saturationLevel: s,
        biasTail: tail,
        description: `base cells ${LEVEL1_TARGET_CELLS} -> ${CEILING_BASE_CELLS} by level ${s} with bias ${LEVEL1_CLEARABLE_BIAS} -> 1 (neutral)`
          + (tail ? `; then bias 1 -> ${BIAS_TAIL_FLOOR} by level ${BIAS_TAIL_END_LEVEL} (look NOT accepted)` : '; flat after'),
        table: rows,
      });
    }
  }
  return out;
}

/** The look status of a bias value at a displayed level (controller: only b = 3 at level 1 is accepted). */
function lookFlag(bias: number | undefined, level: number): string {
  if (bias === undefined || bias === 1) return 'neutral';
  if (bias === LEVEL1_CLEARABLE_BIAS && level === 1) return 'accepted (W3-13, level 1)';
  if (bias === LEVEL1_CLEARABLE_BIAS) return 'b = 3: accepted for level 1 only';
  return 'look not accepted';
}

function tierCells(curve: CurveTable, index: number): { normal: number; hard: number; superHard: number; bias: number | undefined } {
  const n = Difficulties.configV2(Difficulty.Normal, index, curve);
  return {
    normal: n.maxCells,
    hard: Difficulties.configV2(Difficulty.Hard, index, curve).maxCells,
    superHard: Difficulties.configV2(Difficulty.SuperHard, index, curve).maxCells,
    bias: n.clearableBias,
  };
}

function sameTable(a: CurveTable, b: CurveTable): boolean {
  return JSON.stringify(a.map((r) => ({ ...r, clearableBias: r.clearableBias ?? null })))
    === JSON.stringify(b.map((r) => ({ ...r, clearableBias: r.clearableBias ?? null })));
}

function runCandidates(opts: Options): void {
  let candidates = buildCandidates();
  if (opts.only !== null) {
    const unknown = opts.only.filter((id) => !candidates.some((c) => c.id === id));
    if (unknown.length > 0) throw new Error(`--only: unknown candidate id(s) ${unknown.join(', ')}`);
    candidates = candidates.filter((c) => opts.only!.includes(c.id));
  }
  fs.mkdirSync(opts.out, { recursive: true });
  const files = candidates.map((c) => {
    const file = path.join(opts.out, `${c.id}.json`);
    fs.writeFileSync(file, JSON.stringify({ id: c.id, description: c.description, rows: c.table }, null, 2) + '\n');
    return file;
  });
  const shipped = buildCandidates().find((c) => sameTable(c.table, V2_CURVE));
  const keyTables = candidates.map((c) => ({
    id: c.id,
    rows: KEY_LEVELS.map((level) => {
      const t = tierCells(c.table, level - 1);
      return { level, tier: Difficulties.displayName(Difficulties.forLevel(level - 1)), ...t, look: lookFlag(t.bias, level) };
    }),
  }));

  if (opts.json && !opts.modes.includes('curve-report')) {
    console.log(JSON.stringify({
      note: HONESTY_BOUND, mode: 'candidates', files, shippedEquals: shipped?.id ?? null,
      ceilingBaseCells: CEILING_BASE_CELLS, arrowCeiling: ARROW_CEILING,
      candidates: candidates.map((c) => ({ id: c.id, description: c.description, rows: c.table })), keyTables,
    }, null, 2));
    return;
  }
  if (!opts.json) {
    printHonestyBound();
    console.log(`W3-14 curve candidates (exploration grid, ruling W3-7; not shipped values). Shared: row 0 = W3-13's owner pick `
      + `(target ${LEVEL1_TARGET_CELLS} cells, clearableBias ${LEVEL1_CLEARABLE_BIAS}), the ceiling base cells ${CEILING_BASE_CELLS} `
      + `(the shipped CEILING_BASE_CELLS: W3-14 measured 339 by --ceiling against ARROW_CEILING = ${ARROW_CEILING} arrows on the legacy stream; `
      + `the owner's RE-CEILING pick since, below --ceiling's maximum), v1's tier texture `
      + `${V1_TIER_TEXTURE.Normal} : ${V1_TIER_TEXTURE.Hard} : ${V1_TIER_TEXTURE.SuperHard}.`);
    console.log(`The shipped V2_CURVE (src/core/curve.ts) equals candidate: ${shipped?.id ?? 'NONE'}.`);
    console.log(`Written: ${files.join(', ')}`);
    for (const c of candidates) {
      console.log('');
      console.log(`### ${c.id}: ${c.description}`);
      console.log('');
      console.log(table(['row', 'level index', 'displayed level', 'base cells', 'clearableBias'],
        c.table.map((r, k) => [k, r.levelIndex, r.levelIndex + 1, r.baseCells, r.clearableBias ?? 'unset (1)'])));
      console.log('');
      console.log(table(['level', 'tier dealt', 'Normal cells', 'Hard cells', 'Super Hard cells', 'bias', 'look'],
        keyTables.find((k) => k.id === c.id)!.rows.map((r) => [r.level, r.tier, r.normal, r.hard, r.superHard, r.bias ?? 'unset (1)', r.look])));
    }
  }
  if (opts.modes.includes('curve-report')) {
    const reference = loadOrComputeReference(null);
    for (const c of candidates) {
      if (!opts.json) console.log('');
      printCurveReport(curveReport(c.id, c.table, opts.levels ?? CURVE_REPORT_LEVELS, reference), opts.json);
    }
  }
}

// -- The report ---------------------------------------------------------------

interface CurveBoard {
  index: number;
  tier: Difficulty;
  shape: string;
  rows: number;
  cols: number;
  maskCells: number;
  target: number;
  arrows: number;
  scan: number;
  blocked: number;
  bias: number | null;
  cellPt360: number;
  cellPt411: number;
  clampShortfall: boolean;
}

interface CycleStat {
  cycle: number;
  firstLevel: number;
  lastLevel: number;
  scan: number;
  blocked: number;
  arrows: number;
}

interface FlatReference {
  id: string;
  blocks: number;
  /** Largest relative block-to-block change of block-median scan / blocked on a flat curve (300-level blocks). */
  maxRelDeltaScan: number;
  maxRelDeltaBlocked: number;
  fineBlocks: number;
  /** The same for 60-level blocks. */
  fineMaxRelDeltaScan: number;
  fineMaxRelDeltaBlocked: number;
  cycles: CycleStat[];
}

interface CurveReport {
  id: string;
  table: CurveTable;
  levels: readonly [number, number];
  keyLevels: { level: number; tier: string; normal: number; hard: number; superHard: number; bias: number | null; look: string;
    dealt: { shape: string; rows: number; cols: number; arrows: number } }[];
  cycles: CycleStat[];
  monotone: {
    cycleDropsScan: number; cycleDropsBlocked: number; cycles: number;
    blocks: { firstLevel: number; lastLevel: number; scan: number; blocked: number }[];
    blockDropsScan: { at: number; rel: number }[]; blockDropsBlocked: { at: number; rel: number }[];
    fineBlocks: { firstLevel: number; lastLevel: number; scan: number; blocked: number }[];
    fineBlockDropsScan: { at: number; rel: number }[]; fineBlockDropsBlocked: { at: number; rel: number }[];
    reference: Omit<FlatReference, 'cycles'> | null; passScan: boolean | null; passBlocked: boolean | null;
    finePassScan: boolean | null; finePassBlocked: boolean | null;
  };
  saturation: {
    rowIndex: number; plateauCycles: number; plateauP25Arrows: number; plateauMedianArrows: number;
    level: number | null; blockedAfter: { early: number; late: number; ratio: number } | null; verdict: string;
  };
  windows: { firstLevel: number; lastLevel: number; size: number; satOut: number }[];
  windowSteps: { fromLevel: number; size: number }[];
  /** Window slots where a shape could hold every target of the window yet was not dealt (W3-10's top-k window model). */
  satOutSlots: number;
  saturatedExcluded: string[];
  clampShortfalls: { range: number; sample: number };
  heavySample: { boards: number; max: number; at: number; shape: string; rowsCols: string; target: number; tier: string;
    overCeiling: number; overV1Worst: number };
  cellPt: { min360: number; min411: number; maxCols: number; maxRows: number; floor: number; pass: boolean };
  switches: { level: number; cycle: number; v1Scan: number; v2Scan: number; ratio: number; v1Arrows: number; v2Arrows: number;
    windowV1Scan: number; windowV2Scan: number; windowRatio: number }[];
  heaviest: { index: number; arrows: number; shape: string; rowsCols: string; tier: string; over250: number; overV1Worst: number;
    v1Index: number; v1Arrows: number; msMedian: number; msMin: number; v1MsMedian: number; v1MsMin: number; ratio: number; reps: number };
}

function cellPtAt(label: '360' | '411', rows: number, cols: number): number {
  return cellPtAtFit(START_VIEWPORTS.find((v) => v.label === label)!, rows, cols);
}

function walkCurveBoard(index: number, curve: CurveTable): CurveBoard {
  const level = LevelGenerator.generate(index, 2, { curve });
  const { rows, cols } = level.board;
  const maskCells = countTrue(level.mask);
  const bias = Difficulties.configV2(level.difficulty, index, curve).clearableBias ?? null;
  const shortfall = atClamp(2, level.shapeName, rows, cols) && maskCells < level.targetCells;
  const m = walkBoard(level.board, level.arrowCount, `v2 level index ${index}`);
  return {
    index, tier: level.difficulty, shape: level.shapeName, rows, cols, maskCells, target: level.targetCells,
    arrows: m.arrowCount, scan: m.scanTaps, blocked: m.blockedTaps, bias,
    cellPt360: cellPtAt('360', rows, cols), cellPt411: cellPtAt('411', rows, cols), clampShortfall: shortfall,
  };
}

/** Full 6-level cycles inside the range (the brief's "per 6-level cycle"), with the probe's median. */
function cycleStats(boards: readonly CurveBoard[]): CycleStat[] {
  const byCycle = new Map<number, CurveBoard[]>();
  for (const b of boards) {
    const c = Math.floor(b.index / Difficulties.cycleLength);
    if (!byCycle.has(c)) byCycle.set(c, []);
    byCycle.get(c)!.push(b);
  }
  return [...byCycle.entries()]
    .filter(([, bs]) => bs.length === Difficulties.cycleLength)
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, bs]) => ({
      cycle,
      firstLevel: cycle * Difficulties.cycleLength + 1,
      lastLevel: (cycle + 1) * Difficulties.cycleLength,
      scan: med(bs.map((b) => b.scan)),
      blocked: med(bs.map((b) => b.blocked)),
      arrows: med(bs.map((b) => b.arrows)),
    }));
}

function blockStats(cycles: readonly CycleStat[], size: number = MONOTONE_BLOCK_CYCLES): { firstLevel: number; lastLevel: number; scan: number; blocked: number }[] {
  const out = [];
  for (let k = 0; k + size <= cycles.length; k += size) {
    const cs = cycles.slice(k, k + size);
    out.push({ firstLevel: cs[0].firstLevel, lastLevel: cs[cs.length - 1].lastLevel, scan: med(cs.map((c) => c.scan)), blocked: med(cs.map((c) => c.blocked)) });
  }
  return out;
}

function relDrops(values: readonly number[], firstLevels: readonly number[]): { at: number; rel: number }[] {
  const out: { at: number; rel: number }[] = [];
  for (let k = 1; k < values.length; k++) {
    if (values[k] < values[k - 1]) out.push({ at: firstLevels[k], rel: (values[k - 1] - values[k]) / values[k - 1] });
  }
  return out;
}

/**
 * (a)'s instrument resolution: v2 dealt from a FLAT curve (base cells at the
 * ceiling from level 1, neutral), walked over the same range. Its block
 * medians can only move by noise (shape, fill), so their largest relative
 * block-to-block change is the smallest real drop this report can resolve.
 */
function flatReference(): FlatReference {
  const flat: CurveTable = [{ levelIndex: 0, baseCells: CEILING_BASE_CELLS, tierTexture: V1_TIER_TEXTURE }];
  const [lo, hi] = FLAT_REFERENCE_LEVELS;
  const boards: CurveBoard[] = [];
  for (let i = lo - 1; i <= hi - 1; i++) boards.push(walkCurveBoard(i, flat));
  const cycles = cycleStats(boards);
  const blocks = blockStats(cycles);
  const fine = blockStats(cycles, FINE_BLOCK_CYCLES);
  const rel = (bs: typeof blocks, f: (b: typeof blocks[number]) => number) => {
    let max = 0;
    for (let k = 1; k < bs.length; k++) max = Math.max(max, Math.abs(f(bs[k]) - f(bs[k - 1])) / f(bs[k - 1]));
    return max;
  };
  return { id: `FLAT (base ${CEILING_BASE_CELLS} from level ${lo}, neutral, levels ${lo}-${hi})`, blocks: blocks.length,
    maxRelDeltaScan: rel(blocks, (b) => b.scan), maxRelDeltaBlocked: rel(blocks, (b) => b.blocked),
    fineBlocks: fine.length, fineMaxRelDeltaScan: rel(fine, (b) => b.scan), fineMaxRelDeltaBlocked: rel(fine, (b) => b.blocked), cycles };
}

function percentile(values: readonly number[], p: number): number {
  const s = ascending(values);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function curveReport(id: string, curve: CurveTable, levels: readonly [number, number], reference: FlatReference | null): CurveReport {
  const [lo, hi] = levels;
  const boards: CurveBoard[] = [];
  for (let i = lo - 1; i <= hi - 1; i++) boards.push(walkCurveBoard(i, curve));
  const cycles = cycleStats(boards);

  // (a) monotone: raw cycle drops, and block medians against the flat reference's resolution.
  const drops = (f: (c: CycleStat) => number) => cycles.slice(1).filter((c, k) => f(c) < f(cycles[k])).length;
  const blocks = blockStats(cycles);
  const blockDropsScan = relDrops(blocks.map((b) => b.scan), blocks.map((b) => b.firstLevel));
  const blockDropsBlocked = relDrops(blocks.map((b) => b.blocked), blocks.map((b) => b.firstLevel));
  const passScan = reference === null ? null : blockDropsScan.every((d) => d.rel <= reference.maxRelDeltaScan);
  const passBlocked = reference === null ? null : blockDropsBlocked.every((d) => d.rel <= reference.maxRelDeltaBlocked);
  const fineBlocks = blockStats(cycles, FINE_BLOCK_CYCLES);
  const fineBlockDropsScan = relDrops(fineBlocks.map((b) => b.scan), fineBlocks.map((b) => b.firstLevel));
  const fineBlockDropsBlocked = relDrops(fineBlocks.map((b) => b.blocked), fineBlocks.map((b) => b.firstLevel));
  const finePassScan = reference === null ? null : fineBlockDropsScan.every((d) => d.rel <= reference.fineMaxRelDeltaScan);
  const finePassBlocked = reference === null ? null : fineBlockDropsBlocked.every((d) => d.rel <= reference.fineMaxRelDeltaBlocked);

  // (b) saturation: the first 10-cycle running median of cycle-median arrows that reaches the plateau's lower quartile.
  const maxBase = Math.max(...curve.map((r) => r.baseCells));
  const satRow = curve.find((r) => r.baseCells === maxBase)!;
  const lastRow = curve[curve.length - 1];
  const plateau = cycles.filter((c) => c.firstLevel - 1 >= satRow.levelIndex);
  let saturation: CurveReport['saturation'];
  if (plateau.length === 0) {
    saturation = { rowIndex: satRow.levelIndex, plateauCycles: 0, plateauP25Arrows: NaN, plateauMedianArrows: NaN, level: null,
      blockedAfter: null, verdict: 'the curve does not saturate inside the range' };
  } else {
    const p25 = percentile(plateau.map((c) => c.arrows), 0.25);
    let first: CycleStat | null = null;
    for (let k = 0; k + SATURATION_RUN_CYCLES <= cycles.length && first === null; k++) {
      if (med(cycles.slice(k, k + SATURATION_RUN_CYCLES).map((c) => c.arrows)) >= p25) first = cycles[k];
    }
    const after = cycles.filter((c) => first !== null && c.cycle >= first.cycle);
    const window = Math.min(50, Math.floor(after.length / 2));
    const early = window > 0 ? med(after.slice(0, window).map((c) => c.blocked)) : NaN;
    const late = window > 0 ? med(after.slice(after.length - window).map((c) => c.blocked)) : NaN;
    const ratio = late / early;
    const biasAfter = lastRow.levelIndex > satRow.levelIndex && (lastRow.clearableBias ?? 1) < (satRow.clearableBias ?? 1);
    const verdict = biasAfter
      ? `after it, difficulty is carried by the bias (${satRow.clearableBias ?? 1} -> ${lastRow.clearableBias ?? 1} by level ${lastRow.levelIndex + 1}), `
        + `then flat; median blocked of the first vs last ${window} cycles after saturation: ${early.toFixed(1)} -> ${late.toFixed(1)} (x${ratio.toFixed(2)})`
      : `after it, difficulty is flat by construction (no curve input changes); median blocked of the first vs last ${window} cycles `
        + `after saturation: ${early.toFixed(1)} -> ${late.toFixed(1)} (x${ratio.toFixed(2)})`;
    saturation = {
      rowIndex: satRow.levelIndex, plateauCycles: plateau.length, plateauP25Arrows: p25,
      plateauMedianArrows: med(plateau.map((c) => c.arrows)), level: first === null ? null : first.firstLevel,
      blockedAfter: window > 0 ? { early, late, ratio } : null, verdict,
    };
  }

  // (c) admissible shapes per bag window over the range.
  const wmt = curveWindowMaxTarget(curve);
  const windows: CurveReport['windows'] = [];
  const capacityOf = new Map(bagCandidates().map((sh) => [sh.name, shapeCapacity(sh)] as const));
  for (let start = lo - 1; start <= hi - 1;) {
    const w = bagWindowFor(start, wmt);
    const max = wmt(w.start, w.start + w.order.length);
    const dealt = new Set(w.order.map((sh) => sh.name));
    const satOut = [...capacityOf.entries()].filter(([n, cap]) => !dealt.has(n) && cap >= max).length;
    windows.push({ firstLevel: w.start + 1, lastLevel: w.start + w.order.length, size: w.order.length, satOut });
    start = w.start + w.order.length;
  }
  const satOutSlots = windows.reduce((t, w) => t + w.satOut, 0);
  const windowSteps: CurveReport['windowSteps'] = [];
  for (const w of windows) if (windowSteps.length === 0 || windowSteps[windowSteps.length - 1].size !== w.size) windowSteps.push({ fromLevel: w.firstLevel, size: w.size });
  const lastWindow = bagWindowFor(Math.max(lastRow.levelIndex, hi - 1), wmt);
  const lastNames = new Set(lastWindow.order.map((s) => s.name));
  const saturatedExcluded = bagCandidates().map((s) => s.name).filter((n) => !lastNames.has(n));

  // (e) + (d) + (f) over the sample.
  let heavy = { max: -1, at: -1, shape: '', rowsCols: '', target: 0, tier: '' };
  let overCeiling = 0;
  let overV1 = 0;
  let sampleShort = 0;
  let sampleBoards = 0;
  let min360 = Math.min(...boards.map((b) => b.cellPt360));
  let min411 = Math.min(...boards.map((b) => b.cellPt411));
  let maxCols = Math.max(...boards.map((b) => b.cols));
  let maxRows = Math.max(...boards.map((b) => b.rows));
  for (let i = 0; i < HEAVY_SAMPLE_END; i += HEAVY_SAMPLE_STEP) {
    const level = LevelGenerator.generate(i, 2, { curve });
    sampleBoards++;
    const { rows, cols } = level.board;
    if (level.arrowCount > heavy.max) {
      heavy = { max: level.arrowCount, at: i, shape: level.shapeName, rowsCols: `${rows}×${cols}`, target: level.targetCells,
        tier: Difficulties.displayName(level.difficulty) };
    }
    if (level.arrowCount > ARROW_CEILING) overCeiling++;
    if (level.arrowCount > V1_HEAVIEST_ARROWS) overV1++;
    if (atClamp(2, level.shapeName, rows, cols) && countTrue(level.mask) < level.targetCells) sampleShort++;
    min360 = Math.min(min360, cellPtAt('360', rows, cols));
    min411 = Math.min(min411, cellPtAt('411', rows, cols));
    maxCols = Math.max(maxCols, cols);
    maxRows = Math.max(maxRows, rows);
  }

  // (g) the discontinuity at switch levels: v1's cycle median scan beside v2's, same cycle.
  const switches = SWITCH_LEVELS.filter((l) => l >= lo && l <= hi).map((level) => {
    const c = Math.floor((level - 1) / Difficulties.cycleLength);
    const v2c = cycles.find((x) => x.cycle === c);
    if (v2c === undefined) throw new Error(`(g): cycle ${c} is not a full cycle of the range`);
    const v1Boards = [];
    for (let k = 0; k < Difficulties.cycleLength; k++) {
      const i = c * Difficulties.cycleLength + k;
      const l1 = LevelGenerator.generate(i, 1);
      v1Boards.push(walkBoard(l1.board, l1.arrowCount, `v1 level index ${i}`));
    }
    const v1Scan = med(v1Boards.map((m) => m.scanTaps));
    // The next 60 levels: median of the cycle medians over cycles c .. c+9, both generators.
    const v1Window: number[] = [v1Scan];
    for (let cc = c + 1; cc < c + SWITCH_WINDOW_CYCLES; cc++) {
      const ms = [];
      for (let k = 0; k < Difficulties.cycleLength; k++) {
        const l1 = LevelGenerator.generate(cc * Difficulties.cycleLength + k, 1);
        ms.push(walkBoard(l1.board, l1.arrowCount, `v1 level index ${cc * Difficulties.cycleLength + k}`).scanTaps);
      }
      v1Window.push(med(ms));
    }
    const v2Window = cycles.filter((x) => x.cycle >= c && x.cycle < c + SWITCH_WINDOW_CYCLES).map((x) => x.scan);
    if (v2Window.length !== SWITCH_WINDOW_CYCLES) throw new Error(`(g): the ${SWITCH_WINDOW_CYCLES} cycles after level ${level} are not all in the range`);
    const windowV1Scan = med(v1Window);
    const windowV2Scan = med(v2Window);
    return { level, cycle: c, v1Scan, v2Scan: v2c.scan, ratio: v2c.scan / v1Scan, v1Arrows: med(v1Boards.map((m) => m.arrowCount)), v2Arrows: v2c.arrows,
      windowV1Scan, windowV2Scan, windowRatio: windowV2Scan / windowV1Scan };
  });

  // Heaviest board over 0-9999, and its node generation time beside v1's worst (same process, alternated).
  let hv = { index: -1, arrows: -1, shape: '', rowsCols: '', tier: '' };
  let over250 = 0;
  let overV1Worst = 0;
  for (let i = 0; i < HEAVIEST_FULL_END; i++) {
    const level = LevelGenerator.generate(i, 2, { curve });
    if (level.arrowCount > hv.arrows) hv = { index: i, arrows: level.arrowCount, shape: level.shapeName, rowsCols: `${level.board.rows}×${level.board.cols}`, tier: Difficulties.displayName(level.difficulty) };
    if (level.arrowCount > ARROW_CEILING) over250++;
    if (level.arrowCount > V1_HEAVIEST_ARROWS) overV1Worst++;
  }
  const v1Worst = LevelGenerator.generate(V1_HEAVIEST_INDEX, 1);
  const tV2: number[] = [];
  const tV1: number[] = [];
  for (let w = 0; w < 3; w++) { LevelGenerator.generate(hv.index, 2, { curve }); LevelGenerator.generate(V1_HEAVIEST_INDEX, 1); }
  for (let r = 0; r < TIMING_REPS; r++) {
    const order = r % 2 === 0 ? ['v2', 'v1'] : ['v1', 'v2'];
    for (const which of order) {
      const t0 = process.hrtime.bigint();
      if (which === 'v2') LevelGenerator.generate(hv.index, 2, { curve });
      else LevelGenerator.generate(V1_HEAVIEST_INDEX, 1);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      (which === 'v2' ? tV2 : tV1).push(ms);
    }
  }
  if (tV2.length !== TIMING_REPS || tV1.length !== TIMING_REPS) throw new Error('timing: rep count mismatch');

  const keyLevels = KEY_LEVELS.map((level) => {
    const t = tierCells(curve, level - 1);
    const d = LevelGenerator.generate(level - 1, 2, { curve });
    return { level, tier: Difficulties.displayName(Difficulties.forLevel(level - 1)), normal: t.normal, hard: t.hard, superHard: t.superHard,
      bias: t.bias ?? null, look: lookFlag(t.bias, level),
      dealt: { shape: d.shapeName, rows: d.board.rows, cols: d.board.cols, arrows: d.arrowCount } };
  });

  return {
    id, table: curve, levels, keyLevels, cycles,
    monotone: {
      cycleDropsScan: drops((c) => c.scan), cycleDropsBlocked: drops((c) => c.blocked), cycles: cycles.length,
      blocks, blockDropsScan, blockDropsBlocked, fineBlocks, fineBlockDropsScan, fineBlockDropsBlocked,
      reference: reference === null ? null : (({ cycles: _c, ...rest }) => rest)(reference),
      passScan, passBlocked, finePassScan, finePassBlocked,
    },
    saturation, windows, windowSteps, satOutSlots, saturatedExcluded,
    clampShortfalls: { range: boards.filter((b) => b.clampShortfall).length, sample: sampleShort },
    heavySample: { boards: sampleBoards, max: heavy.max, at: heavy.at, shape: heavy.shape, rowsCols: heavy.rowsCols, target: heavy.target,
      tier: heavy.tier, overCeiling, overV1Worst: overV1 },
    cellPt: { min360, min411, maxCols, maxRows, floor: MIN_LEGIBLE_CELL_PT, pass: min360 >= MIN_LEGIBLE_CELL_PT },
    switches,
    heaviest: { ...hv, over250, overV1Worst, v1Index: V1_HEAVIEST_INDEX, v1Arrows: v1Worst.arrowCount,
      msMedian: med(tV2), msMin: Math.min(...tV2), v1MsMedian: med(tV1), v1MsMin: Math.min(...tV1), ratio: med(tV2) / med(tV1), reps: TIMING_REPS },
  };
}

function fmtRel(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function printCurveReport(r: CurveReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'curve-report', ...r }));
    return;
  }
  const [lo, hi] = r.levels;
  const sat = r.saturation;
  console.log(`## Curve ${r.id}`);
  console.log('');
  console.log(`Saturation (b): ${sat.level === null ? 'not reached in the range' : `level ${sat.level}`} — ${sat.verdict}.`);
  console.log('');
  console.log(table(['row', 'level index', 'displayed level', 'base cells', 'clearableBias'],
    r.table.map((row, k) => [k, row.levelIndex, row.levelIndex + 1, row.baseCells, row.clearableBias ?? 'unset (1)'])));
  console.log('');
  console.log('Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):');
  console.log('');
  console.log(table(['level', 'tier', 'Normal', 'Hard', 'Super Hard', 'bias', 'look', 'dealt shape', 'rows×cols', 'arrows'],
    r.keyLevels.map((k) => [k.level, k.tier, k.normal, k.hard, k.superHard, k.bias ?? 'unset (1)', k.look, k.dealt.shape, `${k.dealt.rows}×${k.dealt.cols}`, k.dealt.arrows])));
  const m = r.monotone;
  console.log('');
  console.log(`(a) Cycle medians over levels ${lo}-${hi} (${m.cycles} full 6-level cycles; the probe's median of 6 boards).`);
  console.log(`    Raw cycle-to-cycle drops: scan ${m.cycleDropsScan}, blocked ${m.cycleDropsBlocked} of ${m.cycles - 1} steps.`);
  if (m.reference !== null) {
    const worst = (ds: { at: number; rel: number }[]) => (ds.length === 0 ? 'none' : `${ds.length}, largest ${fmtRel(Math.max(...ds.map((d) => d.rel)))} at level ${ds.reduce((a, b) => (b.rel > a.rel ? b : a)).at}`);
    console.log(`    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).`);
    console.log(`    Block medians (${MONOTONE_BLOCK_CYCLES} cycles = ${MONOTONE_BLOCK_CYCLES * Difficulties.cycleLength} levels, ${m.blocks.length} blocks): drops scan ${worst(m.blockDropsScan)}; blocked ${worst(m.blockDropsBlocked)}.`);
    console.log(`    Resolution (${m.reference.id}, ${m.reference.blocks} blocks): the largest ${MONOTONE_BLOCK_CYCLES * Difficulties.cycleLength}-level block-to-block change on a flat curve is `
      + `${fmtRel(m.reference.maxRelDeltaScan)} (scan), ${fmtRel(m.reference.maxRelDeltaBlocked)} (blocked).`);
    console.log(`    Non-decreasing within resolution (${MONOTONE_BLOCK_CYCLES * Difficulties.cycleLength}-level blocks): scan ${m.passScan ? 'PASS' : 'FAIL'}, blocked ${m.passBlocked ? 'PASS' : 'FAIL'}.`);
    console.log(`    Finer, ${FINE_BLOCK_CYCLES * Difficulties.cycleLength}-level blocks (${m.fineBlocks.length}): drops scan ${worst(m.fineBlockDropsScan)}; blocked ${worst(m.fineBlockDropsBlocked)}; `
      + `flat-curve resolution ${fmtRel(m.reference.fineMaxRelDeltaScan)} / ${fmtRel(m.reference.fineMaxRelDeltaBlocked)}: scan ${m.finePassScan ? 'PASS' : 'FAIL'}, blocked ${m.finePassBlocked ? 'PASS' : 'FAIL'} (coarse: shown, not the verdict).`);
  }
  console.log('');
  console.log(table(['block', 'levels', 'median scan', 'median blocked'], m.blocks.map((b, k) => [k, `${b.firstLevel}-${b.lastLevel}`, b.scan.toFixed(1), b.blocked.toFixed(1)])));
  console.log('');
  console.log(table(['60-level block', 'levels', 'median scan', 'median blocked'], m.fineBlocks.map((b, k) => [k, `${b.firstLevel}-${b.lastLevel}`, b.scan.toFixed(1), b.blocked.toFixed(1)])));
  console.log('');
  console.log(`(b) Saturation: base cells reach ${Math.max(...r.table.map((x) => x.baseCells))} at level ${sat.rowIndex + 1}; `
    + (sat.plateauCycles === 0 ? 'no plateau cycles in range.'
      : `plateau = the ${sat.plateauCycles} cycles from there on, cycle-median arrows median ${sat.plateauMedianArrows}, lower quartile ${sat.plateauP25Arrows}; `
        + `the first ${SATURATION_RUN_CYCLES}-cycle running median of cycle-median arrows to reach the lower quartile starts at level ${sat.level}.`));
  console.log('');
  console.log(`(c) Admissible shapes per bag window (${r.windows.length} windows over levels ${lo}-${hi}): `
    + r.windowSteps.map((s) => `${s.size} from level ${s.fromLevel}`).join('; ') + '.');
  console.log(`    Excluded once saturated: ${r.saturatedExcluded.length === 0 ? 'none' : `${r.saturatedExcluded.length} (${r.saturatedExcluded.join(', ')})`}.`);
  console.log(`    Window model cost (W3-10's top-k windows): ${r.satOutSlots} window slots where a shape could hold every target `
    + `of the window but sat it out (${r.windows.filter((w) => w.satOut > 0).length} of ${r.windows.length} windows).`);
  console.log('');
  console.log(`(d) Clamp shortfalls: ${r.clampShortfalls.range} over levels ${lo}-${hi}; ${r.clampShortfalls.sample} over the (e) sample.`);
  const h = r.heavySample;
  console.log(`(e) Heaviest board over indices 0-${HEAVY_SAMPLE_END - 1} every ${HEAVY_SAMPLE_STEP} (${h.boards} boards): ${h.max} arrows at index ${h.at} `
    + `(${h.tier} ${h.shape} ${h.rowsCols}, target ${h.target}); ceiling ${ARROW_CEILING}: ${h.max <= ARROW_CEILING ? 'PASS' : 'FAIL'}; `
    + `boards over ${ARROW_CEILING}: ${h.overCeiling}; over v1's worst (${V1_HEAVIEST_ARROWS}): ${h.overV1Worst}.`);
  const c = r.cellPt;
  console.log(`(f) Smallest fit cell over the (a) boards and the (e) sample: ${c.min360.toFixed(2)} pt at 360 dp, ${c.min411.toFixed(2)} pt at 411 dp `
    + `(largest board ${c.maxRows} rows, ${c.maxCols} cols); floor ${c.floor} pt: ${c.pass ? 'PASS' : 'FAIL'}.`);
  console.log('');
  console.log('(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, '
    + `and the median over the ${SWITCH_WINDOW_CYCLES} cycles (${SWITCH_WINDOW_CYCLES * 6} levels) from there (single cycles are noisy).`);
  console.log('');
  console.log(table(['switch level', 'cycle levels', 'v1 scan', 'v2 scan', 'v2 / v1', 'v1 arrows', 'v2 arrows', `next ${SWITCH_WINDOW_CYCLES * 6} levels: v1 scan`, 'v2 scan', 'v2 / v1'],
    r.switches.map((s) => [s.level, `${s.cycle * 6 + 1}-${s.cycle * 6 + 6}`, s.v1Scan.toFixed(0), s.v2Scan.toFixed(0), s.ratio.toFixed(2), s.v1Arrows, s.v2Arrows,
      s.windowV1Scan.toFixed(0), s.windowV2Scan.toFixed(0), s.windowRatio.toFixed(2)])));
  const hv = r.heaviest;
  console.log('');
  console.log(`Heaviest board over indices 0-${HEAVIEST_FULL_END - 1}: ${hv.arrows} arrows at index ${hv.index} (${hv.tier} ${hv.shape} ${hv.rowsCols}); `
    + `boards over ${ARROW_CEILING}: ${hv.over250}; over v1's worst ${V1_HEAVIEST_ARROWS}: ${hv.overV1Worst}. `
    + `Node generation (same process, alternated, ${hv.reps} reps each): median ${hv.msMedian.toFixed(2)} ms (min ${hv.msMin.toFixed(2)}) `
    + `against v1 index ${hv.v1Index} (${hv.v1Arrows} arrows) ${hv.v1MsMedian.toFixed(2)} ms (min ${hv.v1MsMin.toFixed(2)}): ratio ${hv.ratio.toFixed(3)}.`);
  console.log('');
  console.log('Per-cycle medians (a), every cycle:');
  console.log('');
  console.log(table(['cycle', 'levels', 'median scan', 'median blocked', 'median arrows'],
    r.cycles.map((x) => [x.cycle, `${x.firstLevel}-${x.lastLevel}`, x.scan.toFixed(1), x.blocked.toFixed(1), x.arrows])));
}

function runCurveReport(opts: Options): void {
  if (opts.modes.includes('candidates')) return; // --candidates runs the report for each candidate itself
  const reference = loadOrComputeReference(opts.referenceFile);
  const report = curveReport(opts.curveId, opts.curve ?? V2_CURVE, opts.levels ?? CURVE_REPORT_LEVELS, reference);
  if (opts.jsonOut !== null) {
    fs.writeFileSync(opts.jsonOut, JSON.stringify({ note: HONESTY_BOUND, mode: 'curve-report', ...report,
      flatReferenceCycles: reference.cycles }) + '\n');
  }
  printCurveReport(report, opts.json);
}

function loadOrComputeReference(file: string | null): FlatReference {
  if (file === null) return flatReference();
  const r = JSON.parse(fs.readFileSync(file, 'utf8')) as FlatReference & { mode?: string; ceilingBaseCells?: number };
  if (r.mode !== 'flat-reference' || r.ceilingBaseCells !== CEILING_BASE_CELLS) {
    throw new Error(`--reference ${file}: not a --flat-reference file for CEILING_BASE_CELLS ${CEILING_BASE_CELLS}`);
  }
  return r;
}

function runFlatReference(opts: Options): void {
  const r = flatReference();
  const payload = { note: HONESTY_BOUND, mode: 'flat-reference', ceilingBaseCells: CEILING_BASE_CELLS, levels: FLAT_REFERENCE_LEVELS, ...r };
  if (opts.jsonOut !== null) fs.writeFileSync(opts.jsonOut, JSON.stringify(payload) + '\n');
  if (opts.json) { console.log(JSON.stringify(payload)); return; }
  printHonestyBound();
  console.log(`(a)'s noise reference: ${r.id}: ${r.cycles.length} cycles. Largest block-to-block change of block-median scan / blocked: `
    + `${MONOTONE_BLOCK_CYCLES * Difficulties.cycleLength}-level blocks (${r.blocks}): ${fmtRel(r.maxRelDeltaScan)} / ${fmtRel(r.maxRelDeltaBlocked)}; `
    + `${FINE_BLOCK_CYCLES * Difficulties.cycleLength}-level blocks (${r.fineBlocks}): ${fmtRel(r.fineMaxRelDeltaScan)} / ${fmtRel(r.fineMaxRelDeltaBlocked)}.`);
  console.log('');
  console.log(table(['block', 'levels', 'median scan', 'median blocked'], blockStats(r.cycles).map((b, k) => [k, `${b.firstLevel}-${b.lastLevel}`, b.scan.toFixed(1), b.blocked.toFixed(1)])));
}

// -- The ceiling --------------------------------------------------------------

interface CeilingMax {
  max: number;
  at: number;
  shape: string;
  boards: number;
}

interface CeilingRow {
  baseCells: number;
  hardTarget: number;
  superHardTarget: number;
  admitted: number;
  /** Neutral bias, Hard and Super Hard indices of the (e) sample (0-99,999 every 7). */
  neutral: CeilingMax;
  /** RE-CEILING: neutral bias, EVERY index 0-9999 (all tiers): the owner's "nothing gets slower" range. */
  full: CeilingMax;
  /** The bias-tail floor 0.3 on the (e) sample: information only (the tail candidates were not picked; S400 never deals b < 1). */
  tail: CeilingMax;
  /** The arrow rule: neutral sample and full range both at or under ARROW_CEILING (so also under v1's worst). */
  passArrows: boolean;
  /** The full range at or under v1's heaviest board over 0-9999 (262 arrows): implied by `passArrows`, printed as its own clause. */
  passV1Worst: boolean;
  /**
   * RE-CEILING: the saturated bag window holds at least one full tier cycle (6 shapes admitted), so the bag's O(1)
   * steady state (`shapeBag.ts`, V2-FINISH part 3) can engage. Below that, a deep cold pick builds every window again.
   */
  passWindow: boolean;
  /** The shipped rule: `passArrows` and `passWindow`. */
  pass: boolean;
  /** W3-14's old rule (neutral sample and the 0.3 tail at or under ARROW_CEILING), for continuity only. */
  passOldRule: boolean;
}

function ceilingRow(baseCells: number): CeilingRow {
  const measure = (bias: number | undefined, end: number, step: number, skipNormal: boolean): CeilingMax => {
    const curve: CurveTable = [{ levelIndex: 0, baseCells, tierTexture: V1_TIER_TEXTURE, clearableBias: bias }];
    let best: CeilingMax = { max: -1, at: -1, shape: '', boards: 0 };
    let boards = 0;
    for (let i = 0; i < end; i += step) {
      if (skipNormal && Difficulties.forLevel(i) === Difficulty.Normal) continue; // Normal targets are the smallest: never the heaviest
      const level = LevelGenerator.generate(i, 2, { curve });
      boards++;
      if (level.arrowCount > best.max) best = { max: level.arrowCount, at: i, shape: `${level.shapeName} ${level.board.rows}×${level.board.cols}`, boards: 0 };
    }
    return { ...best, boards };
  };
  const one: CurveTable = [{ levelIndex: 0, baseCells, tierTexture: V1_TIER_TEXTURE }];
  const sh = Difficulties.configV2(Difficulty.SuperHard, 0, one).maxCells;
  const neutral = measure(undefined, HEAVY_SAMPLE_END, HEAVY_SAMPLE_STEP, true);
  const full = measure(undefined, HEAVIEST_FULL_END, 1, false);
  const tail = measure(BIAS_TAIL_FLOOR, HEAVY_SAMPLE_END, HEAVY_SAMPLE_STEP, true);
  const admitted = bagCandidates().filter((s) => shapeCapacity(s) >= sh).length;
  const passArrows = neutral.max <= ARROW_CEILING && full.max <= ARROW_CEILING;
  const passWindow = admitted >= Difficulties.cycleLength;
  return {
    baseCells, hardTarget: Difficulties.configV2(Difficulty.Hard, 0, one).maxCells, superHardTarget: sh, admitted,
    neutral, full, tail,
    passArrows, passV1Worst: full.max <= V1_HEAVIEST_ARROWS, passWindow, pass: passArrows && passWindow,
    passOldRule: neutral.max <= ARROW_CEILING && tail.max <= ARROW_CEILING,
  };
}

/** The largest scanned base with every smaller scanned base passing `ok` (rows sorted by base). */
function largestPrefixPass(rows: readonly CeilingRow[], ok: (r: CeilingRow) => boolean): number | null {
  let best: number | null = null;
  for (const r of rows) { if (!ok(r)) break; best = r.baseCells; }
  return best;
}

function runCeiling(opts: Options): void {
  // RE-CEILING fix round 1: the shipped value is an owner pick (option B), so its own row is always measured too.
  const rows = [...new Set([...CEILING_SCAN, CEILING_BASE_CELLS])].sort((a, b) => a - b).map(ceilingRow);
  // Refine by 1 between the last value whose scan prefix all passed and the next value: for the shipped rule and for
  // the arrow rule alone (printed beside it), so both answers are exact to one cell.
  const refine = new Set<number>();
  for (const ok of [(r: CeilingRow) => r.pass, (r: CeilingRow) => r.passArrows]) {
    let lastPass = -1;
    for (let k = 0; k < rows.length && ok(rows[k]); k++) lastPass = k;
    if (lastPass >= 0 && lastPass < rows.length - 1) {
      for (let b = rows[lastPass].baseCells + 1; b < rows[lastPass + 1].baseCells; b++) refine.add(b);
    }
  }
  for (const b of [...refine].sort((x, y) => x - y)) if (!rows.some((r) => r.baseCells === b)) rows.push(ceilingRow(b));
  rows.sort((a, b) => a.baseCells - b.baseCells);
  const ceiling = largestPrefixPass(rows, (r) => r.pass);
  const arrowRuleCeiling = largestPrefixPass(rows, (r) => r.passArrows);
  const oldRuleCeiling = largestPrefixPass(rows, (r) => r.passOldRule);
  const boards = rows.reduce((t, r) => t + r.neutral.boards + r.full.boards + r.tail.boards, 0);

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'ceiling', arrowCeiling: ARROW_CEILING, v1Worst: V1_HEAVIEST_ARROWS, tailFloor: BIAS_TAIL_FLOOR,
      rows, ceiling, arrowRuleCeiling, oldRuleCeiling, boards, shipped: CEILING_BASE_CELLS,
      shippedWithinRule: ceiling !== null && CEILING_BASE_CELLS <= ceiling,
      sample: { end: HEAVY_SAMPLE_END, step: HEAVY_SAMPLE_STEP, tiers: 'Hard and Super Hard' }, full: { end: HEAVIEST_FULL_END, tiers: 'all' } }, null, 2));
    return;
  }
  printHonestyBound();
  console.log(`Ceiling (W3-14; rule re-stated by RE-CEILING, 2026-09-26): the largest saturated base cells (Normal target; Hard and Super Hard by `
    + `v1's texture ${V1_TIER_TEXTURE.Normal} : ${V1_TIER_TEXTURE.Hard} : ${V1_TIER_TEXTURE.SuperHard}) whose neutral boards stay at or under `
    + `ARROW_CEILING = ${ARROW_CEILING} arrows over (1) the Hard and Super Hard indices of 0-${HEAVY_SAMPLE_END - 1} every ${HEAVY_SAMPLE_STEP} and `
    + `(2) every index 0-${HEAVIEST_FULL_END - 1}, so no board there exceeds v1's heaviest (${V1_HEAVIEST_ARROWS}, index ${V1_HEAVIEST_INDEX}) either; `
    + `and whose Super Hard target still admits a full tier cycle of shapes (>= ${Difficulties.cycleLength}), or the bag's O(1) steady state cannot engage. `
    + `Neutral is the only bias the shipped S400 deals at or after its ceiling (existing players are clamped to at most 1); the b = ${BIAS_TAIL_FLOOR} `
    + `column is W3-14's unpicked bias-tail candidates, information only. Each row deals a flat curve (that base cells from level 1) through `
    + `generate(i, 2, { curve }), so from ExactDotNetRandom since V2-FINISH part 2.`);
  console.log('');
  console.log(table(['base cells', 'Hard target', 'Super Hard target', 'shapes admitted', 'max arrows, neutral, (e) sample (index, shape)',
    `max arrows, neutral, every index 0-${HEAVIEST_FULL_END - 1} (index, shape)`, `<= ${V1_HEAVIEST_ARROWS}`, `arrows <= ${ARROW_CEILING}`,
    `window >= ${Difficulties.cycleLength} shapes`, 'pass', `info: max arrows, b = ${BIAS_TAIL_FLOOR}, (e) sample (index, shape)`],
    rows.map((r) => [r.baseCells, r.hardTarget, r.superHardTarget, r.admitted, `${r.neutral.max} (${r.neutral.at}, ${r.neutral.shape})`,
      `${r.full.max} (${r.full.at}, ${r.full.shape})`, r.passV1Worst ? 'yes' : 'no', r.passArrows ? 'yes' : 'no', r.passWindow ? 'yes' : 'no',
      r.pass ? 'yes' : 'no', `${r.tail.max} (${r.tail.at}, ${r.tail.shape})${r.tail.max <= ARROW_CEILING ? '' : ' over'}`])));
  console.log('');
  console.log(`Boards generated: ${boards} (${rows.length} rows x (${rows[0].neutral.boards} sampled neutral + ${rows[0].full.boards} full-range neutral + `
    + `${rows[0].tail.boards} sampled at b = ${BIAS_TAIL_FLOOR})).`);
  console.log(`The arrow rule alone gives ${arrowRuleCeiling ?? 'none'}; W3-14's old rule (the (e) sample, neutral and b = ${BIAS_TAIL_FLOOR}, at or under `
    + `${ARROW_CEILING}; no full range) gives ${oldRuleCeiling ?? 'none'} at this scan's resolution.`);
  console.log(`The rule's largest base: ${ceiling ?? 'none (the smallest scanned value fails)'} (the largest scanned value with every smaller scanned value `
    + `passing too). src/core/curve.ts holds CEILING_BASE_CELLS = ${CEILING_BASE_CELLS}, the owner's pick (RE-CEILING option B, the scan-matched base; `
    + `see --v1-floor): ${ceiling !== null && CEILING_BASE_CELLS <= ceiling ? 'within the rule (PASS)' : 'ABOVE the rule (FAIL: the arrow cap or the window rule breaks)'}.`);
}

// ---- V2-FINISH: the v1 floor and the switch report ---------------------------

/** v1's per-tier size is measured over these displayed levels (v1 is flat, so any long range will do). Method. */
const V1_FLOOR_LEVELS: readonly [number, number] = [1, 3000];
/** The band width that shows v1's per-tier medians do not move with the level. Method. */
const V1_FLOOR_BAND = 300;
/** The scan runs from here up to CEILING_BASE_CELLS by 1; the first value must fail, or the scan does not bracket the floor. Method. */
const V1_FLOOR_SCAN_START = 320;
/** The switch report's levels (displayed): W3-14's (g) set. */
const SWITCH_REPORT_LEVELS = SWITCH_LEVELS;
/** The report's windows, in 6-level cycles: (g)'s 10 (60 levels) and 50 (300 levels, the flat reference's resolved block). Method. */
const SWITCH_REPORT_WINDOWS = [SWITCH_WINDOW_CYCLES, MONOTONE_BLOCK_CYCLES] as const;
/**
 * The flat reference's measured block-to-block noise (docs/curve-candidates-2026-09-26.md, "The flat reference (a)":
 * base 339, legacy stream). RE-CEILING re-ran `--flat-reference` on the exact stream at the ceilings it tried (see
 * docs/next-level/reports/RE-CEILING.md): each measured less. These W3-14 figures are kept as the printed resolution
 * because they are the larger (conservative) ones.
 */
const FLAT_NOISE_60 = 0.343;
const FLAT_NOISE_300 = 0.063;
/** S400's ceiling (displayed level 400): the last row of V2_CURVE. */
const SHIPPED_CEILING_INDEX = V2_CURVE[V2_CURVE.length - 1].levelIndex;

type TierTriple = [number, number, number];

function tierIndex(d: Difficulty): 0 | 1 | 2 {
  return d === Difficulty.Normal ? 0 : d === Difficulty.Hard ? 1 : 2;
}

/** Per-tier arrow counts of `deal(i)` for displayed levels lo..hi (no walk: arrows only). */
function tierArrows(deal: (i: number) => GeneratedLevel, lo: number, hi: number): number[][] {
  const out: number[][] = [[], [], []];
  for (let i = lo - 1; i <= hi - 1; i++) {
    const level = deal(i);
    out[tierIndex(level.difficulty)].push(level.arrowCount);
  }
  return out;
}

function tierMedians(arrows: readonly number[][]): TierTriple {
  return [med(arrows[0]), med(arrows[1]), med(arrows[2])];
}

function fmtTriple(t: readonly number[]): string {
  return t.join(' / ');
}

interface FloorScanRow {
  baseCells: number;
  targets: TierTriple;
  medians: TierTriple;
  n: TierTriple;
  /** V2-FINISH's unit: every tier's median arrows at or above v1's. */
  pass: boolean;
  /** RE-CEILING: the median of the 6-level cycle-median scan proxy, and its ratio to v1's over the same levels. */
  scan: number;
  scanRatio: number;
  /** The same ratio per 300-level block (50 cycles against v1's same block): its spread is the instrument's noise. */
  blockRatioMin: number;
  blockRatioMax: number;
  /** RE-CEILING's unit (the owner's option B): the scan ratio at or above 1. */
  passScan: boolean;
  /** A row above CEILING_BASE_CELLS: printed for context only; the floor can never exceed the ceiling. */
  aboveCeiling: boolean;
}

/** RE-CEILING: rows scanned past the ceiling, for context only (is the scan-proxy match a knife edge?). Method. */
const V1_FLOOR_INFO_ABOVE = 10;
/** The scan ratio's block size: 50 cycles = 300 levels (the flat reference's resolved block). Method. */
const V1_FLOOR_SCAN_BLOCK_CYCLES = MONOTONE_BLOCK_CYCLES;

interface FloorDeal {
  arrows: number[][];
  /** Cycle-median scan per full 6-level cycle, in order. */
  cycles: number[];
}

/** Arrows per tier and the walked scan proxy per cycle of `deal(i)` for displayed levels lo..hi (lo starts a cycle). */
function floorDeal(deal: (i: number) => GeneratedLevel, lo: number, hi: number, label: string): FloorDeal {
  if ((lo - 1) % Difficulties.cycleLength !== 0) throw new Error(`--v1-floor: level ${lo} does not start a tier cycle`);
  const arrows: number[][] = [[], [], []];
  const cycles: number[] = [];
  let cur: number[] = [];
  for (let i = lo - 1; i <= hi - 1; i++) {
    const level = deal(i);
    arrows[tierIndex(level.difficulty)].push(level.arrowCount);
    cur.push(walkBoard(level.board, level.arrowCount, `${label} level index ${i}`).scanTaps);
    if (cur.length === Difficulties.cycleLength) { cycles.push(med(cur)); cur = []; }
  }
  return { arrows, cycles };
}

function blockMedians(cycles: readonly number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k + V1_FLOOR_SCAN_BLOCK_CYCLES <= cycles.length; k += V1_FLOOR_SCAN_BLOCK_CYCLES) {
    out.push(med(cycles.slice(k, k + V1_FLOOR_SCAN_BLOCK_CYCLES)));
  }
  return out;
}

/** The smallest base with every larger base (up to the last row given) passing `ok`; rows ascending. */
function smallestSuffixPass(rows: readonly FloorScanRow[], ok: (r: FloorScanRow) => boolean): number | null {
  let floor: number | null = null;
  for (let k = rows.length - 1; k >= 0 && ok(rows[k]); k--) floor = rows[k].baseCells;
  return floor;
}

function runV1Floor(opts: Options): void {
  const [lo, hi] = V1_FLOOR_LEVELS;
  const v1Deal = floorDeal((i) => LevelGenerator.generate(i, 1), lo, hi, 'v1');
  const v1 = v1Deal.arrows;
  const v1Med = tierMedians(v1);
  const v1Scan = med(v1Deal.cycles);
  const v1Blocks = blockMedians(v1Deal.cycles);
  const bands: { levels: string; medians: TierTriple }[] = [];
  for (let b = lo; b <= hi; b += V1_FLOOR_BAND) {
    const e = Math.min(hi, b + V1_FLOOR_BAND - 1);
    bands.push({ levels: `${b}-${e}`, medians: tierMedians(tierArrows((i) => LevelGenerator.generate(i, 1), b, e)) });
  }

  const rows: FloorScanRow[] = [];
  for (let base = V1_FLOOR_SCAN_START; base <= CEILING_BASE_CELLS + V1_FLOOR_INFO_ABOVE; base++) {
    const curve: CurveTable = [{ levelIndex: 0, baseCells: base, tierTexture: V1_TIER_TEXTURE }];
    const d = floorDeal((i) => LevelGenerator.generate(i, 2, { curve }), lo, hi, `v2 flat ${base}`);
    const medians = tierMedians(d.arrows);
    const targets: TierTriple = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard]
      .map((t) => Difficulties.configV2(t, 0, curve).maxCells) as TierTriple;
    const scan = med(d.cycles);
    const ratios = blockMedians(d.cycles).map((x, k) => x / v1Blocks[k]);
    rows.push({ baseCells: base, targets, medians, n: [d.arrows[0].length, d.arrows[1].length, d.arrows[2].length],
      pass: medians.every((m, t) => m >= v1Med[t]), scan, scanRatio: scan / v1Scan,
      blockRatioMin: Math.min(...ratios), blockRatioMax: Math.max(...ratios), passScan: scan >= v1Scan,
      aboveCeiling: base > CEILING_BASE_CELLS });
  }
  const eligible = rows.filter((r) => !r.aboveCeiling);
  const floor = smallestSuffixPass(eligible, (r) => r.pass);
  const scanFloor = smallestSuffixPass(eligible, (r) => r.passScan);
  const bracketed = !eligible[0].pass && !eligible[0].passScan;
  const crossingOf = (base: number | null) => {
    for (let i = 0; i <= SHIPPED_CEILING_INDEX; i++) if (curvePointAt(V2_CURVE, i).baseCells >= (base ?? Infinity)) return i + 1;
    return null;
  };

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'v1-floor', levels: V1_FLOOR_LEVELS, v1: { medians: v1Med,
      n: [v1[0].length, v1[1].length, v1[2].length], bands, scan: v1Scan, cycles: v1Deal.cycles.length, blocks: v1Blocks },
      rows, arrowMedianFloor: floor, scanProxyFloor: scanFloor, bracketed, ceiling: CEILING_BASE_CELLS, shipped: V1_FLOOR_BASE_CELLS }, null, 2));
    return;
  }
  printHonestyBound();
  console.log(`v1 floor (V2-FINISH; scan-proxy unit added by RE-CEILING). v1 over displayed levels ${lo}-${hi} `
    + `(n = ${v1[0].length} / ${v1[1].length} / ${v1[2].length}; the probe's p50): median arrows Normal / Hard / Super Hard = ${fmtTriple(v1Med)}; `
    + `median of the ${v1Deal.cycles.length} cycle-median scans = ${v1Scan.toFixed(1)}.`);
  console.log('');
  console.log(`v1 per ${V1_FLOOR_BAND}-level band (Difficulties.config never reads the level, so these move only by noise):`);
  console.log(table(['levels', 'median arrows N / H / SH', 'median cycle scan'],
    bands.map((b, k) => [b.levels, fmtTriple(b.medians), v1Blocks[k] === undefined ? '' : v1Blocks[k].toFixed(1)])));
  console.log('');
  console.log(`v2 dealt from a flat curve at each base (targets base x ${V1_TIER_TEXTURE.Normal} : ${V1_TIER_TEXTURE.Hard} : `
    + `${V1_TIER_TEXTURE.SuperHard}, neutral bias, v2's own bag and sizing, generate(i, 2, { curve })), same levels, every board walked. `
    + 'Arrow unit (V2-FINISH): every tier\'s median arrows at or above v1\'s. Scan unit (RE-CEILING option B): the median cycle scan '
    + `at or above v1's. Rows above CEILING_BASE_CELLS = ${CEILING_BASE_CELLS} are context only.`);
  console.log(table(['base cells', 'targets N / H / SH', 'median arrows N / H / SH', 'n', 'arrows pass', 'median cycle scan',
    'v2 / v1 scan', '300-level blocks min-max', 'scan pass'],
    rows.map((r) => [`${r.baseCells}${r.aboveCeiling ? ' (above the ceiling)' : ''}`, fmtTriple(r.targets), fmtTriple(r.medians), fmtTriple(r.n),
      r.pass ? 'yes' : 'no', r.scan.toFixed(1), r.scanRatio.toFixed(3), `${r.blockRatioMin.toFixed(2)}-${r.blockRatioMax.toFixed(2)}`,
      r.passScan ? 'yes' : 'no'])));
  console.log('');
  if (!bracketed) console.log(`WARNING: the first scanned base (${V1_FLOOR_SCAN_START}) already passes a unit; the scan does not bracket that floor.`);
  const walked = (1 + rows.length) * (hi - lo + 1);
  console.log(`Boards dealt and walked: ${walked} (v1 plus ${rows.length} bases x ${hi - lo + 1} levels).`);
  console.log(`Arrow-median base (V2-FINISH's unit): ${floor ?? 'none'}; scan-proxy base (RE-CEILING option B's unit): ${scanFloor ?? 'none'}. `
    + `Each is the smallest scanned base with every larger scanned base up to CEILING_BASE_CELLS = ${CEILING_BASE_CELLS} passing too. `
    + `S400 reaches them at displayed levels ${crossingOf(floor) ?? 'never'} and ${crossingOf(scanFloor) ?? 'never'}.`);
  console.log(`V1_FLOOR_BASE_CELLS: src/core/curve.ts holds ${V1_FLOOR_BASE_CELLS}${scanFloor === V1_FLOOR_BASE_CELLS
    ? ' (matches the scan-proxy base)' : ' (DIFFERS from the scan-proxy base: update it)'}.`);
}

interface SwitchWindow {
  cycles: number;
  levels: string;
  v1: number;
  fresh: number;
  existing: number;
  freshRatio: number;
  existingRatio: number;
}

function runSwitchReport(opts: Options): void {
  const walked = new Map<string, WalkMetrics>();
  const scanOf = (kind: 'v1' | 'fresh' | 'existing', i: number, switchLevel: number): number => {
    const key = `${kind}:${i}`; // an existing player's boards do not depend on which switch level > 0 (tested)
    let m = walked.get(key);
    if (m === undefined) {
      const level = kind === 'v1' ? LevelGenerator.generate(i, 1)
        : LevelGenerator.generate(i, 2, { switchLevel: kind === 'existing' ? switchLevel : 0 });
      m = walkBoard(level.board, level.arrowCount, `${kind} level index ${i}`);
      walked.set(key, m);
    }
    return m.scanTaps;
  };
  const cycleMedian = (kind: 'v1' | 'fresh' | 'existing', cycle: number, switchLevel: number): number => {
    const scans = [];
    for (let k = 0; k < Difficulties.cycleLength; k++) scans.push(scanOf(kind, cycle * Difficulties.cycleLength + k, switchLevel));
    return med(scans);
  };

  const report = SWITCH_REPORT_LEVELS.map((level) => {
    const switchLevel = Math.max(1, level - 1); // the index they meet v2 at; any value > 0 deals the same boards
    const c = Math.floor((level - 1) / Difficulties.cycleLength);
    const windows: SwitchWindow[] = SWITCH_REPORT_WINDOWS.map((cycles) => {
      const per = (kind: 'v1' | 'fresh' | 'existing') => {
        const ms = [];
        for (let cc = c; cc < c + cycles; cc++) ms.push(cycleMedian(kind, cc, switchLevel));
        return med(ms);
      };
      const v1 = per('v1');
      const fresh = per('fresh');
      const existing = per('existing');
      return { cycles, levels: `${c * 6 + 1}-${(c + cycles) * 6}`, v1, fresh, existing, freshRatio: fresh / v1, existingRatio: existing / v1 };
    });
    return { level, switchLevel, windows };
  });

  // The floored boards below the ceiling, per tier, against v1's per-tier medians over the floor's own range.
  const [flo, fhi] = V1_FLOOR_LEVELS;
  const v1Arrows = tierArrows((i) => LevelGenerator.generate(i, 1), flo, fhi);
  const v1Med = tierMedians(v1Arrows);
  const below = tierArrows((i) => LevelGenerator.generate(i, 2, { switchLevel: 1 }), 2, SHIPPED_CEILING_INDEX);
  const belowMed = tierMedians(below);
  const share = (xs: readonly number[], m: number) => xs.filter((x) => x < m).length / xs.length;

  // The heaviest floored board over the (e) sample, against ARROW_CEILING.
  let heavy = { max: -1, at: -1, shape: '' };
  let overCeiling = 0;
  let sampled = 0;
  for (let i = 0; i < HEAVY_SAMPLE_END; i += HEAVY_SAMPLE_STEP) {
    const level = LevelGenerator.generate(i, 2, { switchLevel: 1 });
    sampled++;
    if (level.arrowCount > heavy.max) heavy = { max: level.arrowCount, at: i, shape: `${level.shapeName} ${level.board.rows}×${level.board.cols}` };
    if (level.arrowCount > ARROW_CEILING) overCeiling++;
  }
  // RE-CEILING: the heaviest floored board over EVERY index 0-9999 (the owner's "nothing gets slower" range), against v1's worst.
  let full = { max: -1, at: -1, shape: '' };
  let fullOverCeiling = 0;
  let fullOverV1 = 0;
  for (let i = 0; i < HEAVIEST_FULL_END; i++) {
    const level = LevelGenerator.generate(i, 2, { switchLevel: 1 });
    if (level.arrowCount > full.max) full = { max: level.arrowCount, at: i, shape: `${level.shapeName} ${level.board.rows}×${level.board.cols}` };
    if (level.arrowCount > ARROW_CEILING) fullOverCeiling++;
    if (level.arrowCount > V1_HEAVIEST_ARROWS) fullOverV1++;
  }

  if (opts.json) {
    console.log(JSON.stringify({ note: HONESTY_BOUND, mode: 'switch-report', floorBaseCells: V1_FLOOR_BASE_CELLS, report,
      belowCeiling: { levels: [2, SHIPPED_CEILING_INDEX], medians: belowMed, n: below.map((b) => b.length), v1Medians: v1Med,
        shareBelowV1Median: below.map((b, t) => share(b, v1Med[t])), v1ShareBelowOwnMedian: v1Arrows.map((a, t) => share(a, v1Med[t])) },
      heavy: { ...heavy, overCeiling, sampled },
      heavyFull: { ...full, levels: [1, HEAVIEST_FULL_END], overCeiling: fullOverCeiling, overV1Worst: fullOverV1, v1Worst: V1_HEAVIEST_ARROWS } }, null, 2));
    return;
  }
  printHonestyBound();
  console.log(`V2-FINISH switch report (W3-14's (g) with the v1 floor, V1_FLOOR_BASE_CELLS = ${V1_FLOOR_BASE_CELLS}). A player who meets v2 at `
    + 'displayed level L: the median of the cycle-median scan over the cycles from the one holding L, for v1, a fresh install\'s v2 '
    + '(generate(i, 2)) and an existing player\'s floored v2 (generate(i, 2, { switchLevel })). Resolution: the flat curve\'s own '
    + `block-to-block noise is ${fmtRel(FLAT_NOISE_60)} over 60 levels and ${fmtRel(FLAT_NOISE_300)} over 300 (W3-14).`);
  console.log('');
  const headers = ['switch at L', 'window', 'v1 scan', 'fresh v2 scan', 'fresh / v1', 'existing v2 scan', 'existing / v1'];
  const rows: (string | number)[][] = [];
  for (const r of report) {
    for (const w of r.windows) {
      rows.push([r.level, `${w.cycles * 6} levels (${w.levels})`, w.v1.toFixed(0), w.fresh.toFixed(0), w.freshRatio.toFixed(2),
        w.existing.toFixed(0), w.existingRatio.toFixed(2)]);
    }
  }
  console.log(table(headers, rows));
  console.log('');
  console.log(`Existing player's v2 boards at displayed levels 2-${SHIPPED_CEILING_INDEX} (below the ceiling; n = ${fmtTriple(below.map((b) => b.length))}): `
    + `median arrows N / H / SH ${fmtTriple(belowMed)} against v1's ${fmtTriple(v1Med)} (levels ${flo}-${fhi}). `
    + `Share of boards below v1's median: ${below.map((b, t) => fmtRel(share(b, v1Med[t]))).join(' / ')} `
    + `(v1's own boards: ${v1Arrows.map((a, t) => fmtRel(share(a, v1Med[t]))).join(' / ')}).`);
  console.log(`Heaviest existing-player board over indices 0-${HEAVY_SAMPLE_END - 1} every ${HEAVY_SAMPLE_STEP} (${sampled} boards): `
    + `${heavy.max} arrows (index ${heavy.at}, ${heavy.shape}); over ARROW_CEILING = ${ARROW_CEILING}: ${overCeiling}.`);
  console.log(`Heaviest existing-player board over every index 0-${HEAVIEST_FULL_END - 1} (${HEAVIEST_FULL_END} boards): ${full.max} arrows `
    + `(index ${full.at}, ${full.shape}); over ARROW_CEILING = ${ARROW_CEILING}: ${fullOverCeiling}; over v1's worst (${V1_HEAVIEST_ARROWS}): ${fullOverV1}.`);
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
    case 'start-sweep': return runStartSweep(opts);
    case 'tutorial': return runTutorial(opts);
    case 'candidates': return runCandidates(opts);
    case 'curve-report': return runCurveReport(opts);
    case 'ceiling': return runCeiling(opts);
    case 'flat-reference': return runFlatReference(opts);
    case 'v1-floor': return runV1Floor(opts);
    case 'switch-report': return runSwitchReport(opts);
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

/**
 * W3-10: generator v2's shape selection, a capacity-aware shuffled bag.
 *
 * Why v1's tier pools cannot be fixed by editing them:
 * - Normal draws from four shapes (two of them the same silhouette), so most
 *   levels are one of four shapes, with back-to-back repeats.
 * - The grid clamp silently caps a thin shape below its cell target (v1 level
 *   12 is a Super Hard Bolt holding 202 cells against a 560-720 target). The
 *   clamp, not the shape, sets that ceiling, so selection has to know the
 *   target a level can draw.
 *
 * How v2 picks (every function here is pure; the caches below only memoize):
 * - **Capacity.** `shapeCapacity(shape)` is the shape's cell count at its
 *   largest v2 board: rows = `v2MaxRows(aspect)`, the most rows (up to
 *   `V2_MAX_GRID_ROWS`) whose cols stay within `V2_MAX_GRID_COLS`, and cols as
 *   v2 sizes them (`v2Cols`). It is the most cells v2 sizing can ever give that
 *   shape without distorting it.
 * - **Windows.** Levels are dealt in consecutive windows. A window's
 *   admissible set is every bag candidate whose capacity covers the largest
 *   cell target any level in the window can draw (`windowMaxTarget`), and the
 *   window is exactly as long as that set, so each member appears exactly
 *   once. Membership is a capacity threshold, so the set is always the top-k
 *   candidates by capacity; the window is the largest such k whose k levels
 *   all fit (`windowSetAt`). Because a window's length is chosen together with
 *   its set, no window is ever cut short.
 * - **Where the set changes.** v2 deals from W3-14's curve (`curve.ts`): the
 *   default window max target is `curveWindowMaxTarget(V2_CURVE)`. While the
 *   curve rises, later windows admit fewer shapes; the window just before a
 *   rise ends at the rise and holds the top-k shapes by capacity, k = the
 *   levels left before it; each still appears exactly once. Once the curve
 *   saturates every window has the same set. W3-14's probe reports the
 *   admissible count per window (`--candidates`). The W3-10 placeholder (v1's
 *   tier bands, max 720) is kept for tests and the contact sheet.
 * - **Order.** Each window is a Fisher-Yates shuffle of its set (in catalogue
 *   order before the shuffle), seeded with `new DotNetRandom(bagSeed(ordinal))`.
 *   If the first shape equals the previous level's shape, positions 0 and 1
 *   swap, once (no retry loop), so no shape is dealt twice in a row.
 * - **No RNG from the level.** The bag never touches the level's
 *   `DotNetRandom(seed(i))` stream: calling `pickForLevelV2` any number of
 *   times changes no board.
 *
 * Catalogue contract (W4-01): bag membership is derived from
 * `SHAPE_CATALOGUE`, which is append-only. Retiring a shape from v2 windows
 * means adding it to `RETIRED_SHAPE_IDS`, never removing it from
 * `SHAPE_CATALOGUE` or changing its index, so W4-07's collection bits stay
 * stable. A shape the bag deals is therefore always a catalogue id.
 */
import { V2_CURVE, type CurveTable } from './curve';
import { Difficulties } from './difficulty';
import { DotNetRandom } from './dotnetRandom';
import { RETIRED_SHAPE_IDS, SHAPE_CATALOGUE, shapeDefFor } from './shapeCatalogue';
import type { ShapeDef } from './shapeLibrary';

/**
 * The smallest fit-to-view cell a v2 board may show, in points on the 360 dp
 * phone W3-08 logged (board viewport 360x689 dp): W3-08's row 3, Bolt 46x37,
 * whose cell is 0.94 x 360 / 37 = 9.15 pt (FIT_MARGIN 0.94, `boardCamera.ts`).
 */
// OWNER PICK 2026-09-26 (W3-09, docs/board-legibility-2026-09-26.md): "row 3 or larger".
export const MIN_LEGIBLE_CELL_PT = 9.1;

/**
 * v2's column cap: the most columns whose fit cell on that phone stays at or
 * above `MIN_LEGIBLE_CELL_PT` (0.94 x 360 / 37 = 9.15 >= 9.1; / 38 = 8.91).
 * Every campaign board is width-bound there, so columns alone set the cell.
 */
// OWNER PICK 2026-09-26 (W3-09, docs/board-legibility-2026-09-26.md): at most 37 columns.
export const V2_MAX_GRID_COLS = 37;

/**
 * v2's row cap: v1's shipped clamp, unchanged. Rows do not bind the cell on
 * the logged phones (a 46-row board at <= 37 columns is still width-bound or
 * above the floor: 0.94 x 689 / 46 = 14.1 pt).
 */
// OWNER PICK 2026-09-26 (W3-09, docs/board-legibility-2026-09-26.md): rows may stay up to 46.
export const V2_MAX_GRID_ROWS = 46;

/** v1's grid floors, unchanged in v2 (levelGenerator.ts `buildFromShape`'s literals 8 and 4). */
export const V2_MIN_GRID_ROWS = 8;
export const V2_MIN_GRID_COLS = 4;

/**
 * The largest cell target any level in `[start, end)` can draw. The bag's
 * only view of the difficulty curve (W3-14 replaces the placeholder).
 */
export type WindowMaxTarget = (start: number, end: number) => number;

/**
 * Placeholder curve (W3-10 step 2): a v2 level draws its target from v1's tier
 * band (`Difficulties.config(forLevel(i))`, min..max inclusive), so the most a
 * window can draw is the largest `maxCells` of any tier in it. The tier cycle
 * repeats every `cycleLength` levels, so at most that many levels are read.
 */
export const placeholderWindowMaxTarget: WindowMaxTarget = (start, end) => {
  const span = Math.min(end - start, Difficulties.cycleLength);
  let max = 0;
  for (let k = 0; k < span; k++) {
    const { maxCells } = Difficulties.config(Difficulties.forLevel(start + k));
    if (maxCells > max) max = maxCells;
  }
  return max;
};

const curveWmtCache = new WeakMap<CurveTable, WindowMaxTarget>();

/**
 * W3-14: the bag's view of a difficulty curve, the largest cell target any
 * level in `[start, end)` draws (`Difficulties.configV2`, a point target per
 * level). `validateCurve` guarantees every tier's target never falls, so each
 * tier's largest target in the range is at its last occurrence, and every
 * tier present occurs in the range's last `cycleLength` levels: at most six
 * levels are read. Each level's target is computed once per table and kept
 * (a memo only: a deep player's first v2 pick builds every window from level
 * 0, and re-deriving targets per window measured slower than W3-10 at level
 * 20,000). One function per table (the bag's window cache is keyed by it).
 */
export function curveWindowMaxTarget(curve: CurveTable): WindowMaxTarget {
  let wmt = curveWmtCache.get(curve);
  if (wmt === undefined) {
    const targets: number[] = [];
    const targetAt = (i: number): number => {
      let t = targets[i];
      if (t === undefined) {
        t = Difficulties.configV2(Difficulties.forLevel(i), i, curve).maxCells;
        targets[i] = t;
      }
      return t;
    };
    wmt = (start, end) => {
      let max = 0;
      for (let i = Math.max(start, end - Difficulties.cycleLength); i < end; i++) {
        const t = targetAt(i);
        if (t > max) max = t;
      }
      return max;
    };
    curveWmtCache.set(curve, wmt);
  }
  return wmt;
}

/** The shipped curve's window max target: the bag's default. */
export const v2WindowMaxTarget: WindowMaxTarget = curveWindowMaxTarget(V2_CURVE);

/** cols for a v2 board of `rows` rows: the single formula v2 sizing and capacity share. */
export function v2Cols(rows: number, aspect: number, maxCols: number = V2_MAX_GRID_COLS): number {
  return clamp(roundHalfToEven(rows * aspect), V2_MIN_GRID_COLS, maxCols);
}

/**
 * The most rows a v2 board of this aspect may have: `maxRows`, lowered until
 * its unclamped cols fit `maxCols`, so the column cap never squeezes a
 * silhouette (W3-14; W3-10's cols-only clamp distorted wide shapes instead).
 * Never below `V2_MIN_GRID_ROWS`.
 */
export function v2MaxRows(
  aspect: number,
  maxRows: number = V2_MAX_GRID_ROWS,
  maxCols: number = V2_MAX_GRID_COLS,
): number {
  let rows = maxRows;
  while (rows > V2_MIN_GRID_ROWS && roundHalfToEven(rows * aspect) > maxCols) rows--;
  return rows;
}

/**
 * v2's board size for a cell target (generator v2's `buildV2`, exported so
 * the probe measures the shipping sizing instead of a replica): v1's
 * density-probe fit (probe the silhouette's fill at 24 rows, floor 0.05, solve
 * rows for the target), with rows clamped to [V2_MIN_GRID_ROWS,
 * v2MaxRows(aspect)] and cols = v2Cols(rows, aspect).
 */
export function v2GridFor(shape: ShapeDef, targetCells: number): { rows: number; cols: number } {
  const probeRows = 24; // v1's density-probe size (levelGenerator.ts buildFromShape)
  const probeCols = v2Cols(probeRows, shape.aspect);
  const probeFill = Math.max(
    0.05, // v1's fill floor (buildFromShape)
    countTrue(shape.rasterize(probeRows, probeCols)) / (probeRows * probeCols),
  );
  const rows = clamp(
    Math.round(Math.sqrt(targetCells / (probeFill * shape.aspect))),
    V2_MIN_GRID_ROWS,
    v2MaxRows(shape.aspect),
  );
  return { rows, cols: v2Cols(rows, shape.aspect) };
}

const capacityCache = new Map<ShapeDef, Map<string, number>>();

/**
 * Mask cells of `shape` at its largest board under the given caps (rows =
 * `v2MaxRows(aspect, maxRows, maxCols)`, cols = `v2Cols(rows, aspect, maxCols)`),
 * memoized per shape and caps. The first call rasterizes each shape once.
 * `shapeCapacity(s, 46, 46)` is v1's clamp (W3-01's measured table).
 */
export function shapeCapacity(
  shape: ShapeDef,
  maxRows: number = V2_MAX_GRID_ROWS,
  maxCols: number = V2_MAX_GRID_COLS,
): number {
  let byCaps = capacityCache.get(shape);
  if (byCaps === undefined) {
    byCaps = new Map();
    capacityCache.set(shape, byCaps);
  }
  const key = `${maxRows}x${maxCols}`;
  let cells = byCaps.get(key);
  if (cells === undefined) {
    const rows = v2MaxRows(shape.aspect, maxRows, maxCols);
    cells = countTrue(shape.rasterize(rows, v2Cols(rows, shape.aspect, maxCols)));
    byCaps.set(key, cells);
  }
  return cells;
}

/**
 * Every shape the bag may deal: `SHAPE_CATALOGUE` in catalogue order, minus
 * `RETIRED_SHAPE_IDS`, each resolved with `shapeDefFor`. The parameters exist
 * so tests can exercise retirement; the game always uses the defaults.
 */
export function bagCandidates(
  catalogue: readonly string[] = SHAPE_CATALOGUE,
  retired: ReadonlySet<string> = RETIRED_SHAPE_IDS,
): readonly ShapeDef[] {
  const out: ShapeDef[] = [];
  for (const id of catalogue) {
    if (retired.has(id)) continue;
    const def = shapeDefFor(id);
    if (def === null) throw new Error(`shapeBag: catalogue id '${id}' has no ShapeDef`);
    out.push(def);
  }
  return out;
}

interface Ranked {
  readonly shape: ShapeDef;
  /** Position in `bagCandidates()`, which keeps catalogue order. */
  readonly candidateIndex: number;
  readonly capacity: number;
}

let rankedCache: readonly Ranked[] | null = null;

/** Bag candidates by capacity, highest first; ties in catalogue order. */
function rankedCandidates(): readonly Ranked[] {
  if (rankedCache === null) {
    rankedCache = bagCandidates()
      .map((shape, candidateIndex) => ({ shape, candidateIndex, capacity: shapeCapacity(shape) }))
      .sort((a, b) => b.capacity - a.capacity || a.candidateIndex - b.candidateIndex);
  }
  return rankedCache;
}

/**
 * The admissible set of the window starting at `start`, in catalogue order.
 * It is the top-k candidates by capacity for the largest k whose k levels
 * `[start, start + k)` can draw no target above the k-th capacity. A k that
 * would split a capacity tie is skipped (membership is a threshold). At least
 * two shapes are required, or a repeat would be unavoidable; a curve that
 * leaves fewer throws instead of silently dealing a shape that cannot hold its
 * target.
 */
export function windowSetAt(
  start: number,
  windowMaxTarget: WindowMaxTarget = v2WindowMaxTarget,
): readonly ShapeDef[] {
  const ranked = rankedCandidates();
  for (let k = ranked.length; k >= 2; k--) {
    if (k < ranked.length && ranked[k].capacity === ranked[k - 1].capacity) continue;
    if (ranked[k - 1].capacity >= windowMaxTarget(start, start + k)) {
      return ranked
        .slice(0, k)
        .sort((a, b) => a.candidateIndex - b.candidateIndex)
        .map((r) => r.shape);
    }
  }
  throw new Error(
    `shapeBag: fewer than two shapes can hold the cell target of the window at level index ${start}`,
  );
}

/**
 * .NET's `MSEED`. `DotNetRandom` is exact only for |seed| <= this: a larger
 * seed overflows int32 inside .NET's seeding, which the JS port does not wrap,
 * and its stream can then draw outside [0, 1) from the third draw on (W3-10
 * measured about 23% of full-range seeds doing so within 50 draws, and 0 of
 * 200,000 seeds in range over 1000 draws). A shuffle index outside the array
 * would corrupt a window, so bag seeds stay in range.
 */
const DOTNET_EXACT_SEED_MAX = 161803398;

/**
 * The bag shuffle's seed namespace: a two-round FNV-1a like `dailySeed`, with
 * namespace byte 0x62 ("b"), reduced into 0..DOTNET_EXACT_SEED_MAX. Window
 * seeds are distinct from each other and from every campaign `seed(i)` and
 * `dailySeed(day)` over the ranges `__tests__/shapeBag.test.ts` checks.
 */
export function bagSeed(windowOrdinal: number): number {
  let h = 2166136261;
  h = Math.imul(h ^ 0x62, 16777619);
  h = Math.imul(h ^ windowOrdinal, 16777619);
  return (h >>> 0) % (DOTNET_EXACT_SEED_MAX + 1);
}

/** One dealt window: `order[k]` is the shape of level `start + k`. */
export interface BagWindow {
  readonly ordinal: number;
  readonly start: number;
  readonly order: readonly ShapeDef[];
}

const windowCache = new WeakMap<WindowMaxTarget, BagWindow[]>();

function buildWindow(ordinal: number, start: number, prev: ShapeDef | null, wmt: WindowMaxTarget): BagWindow {
  const order = [...windowSetAt(start, wmt)];
  const rng = new DotNetRandom(bagSeed(ordinal));
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.next(i + 1);
    if (!(j >= 0 && j <= i)) throw new Error(`shapeBag: window ${ordinal} drew index ${j} outside 0..${i}`);
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  if (prev !== null && order[0] === prev) {
    const t = order[0];
    order[0] = order[1];
    order[1] = t;
  }
  return Object.freeze({ ordinal, start, order: Object.freeze(order) });
}

/**
 * The window that deals `levelIndex`. Windows are built in order from level 0
 * (a window's start and first-shape swap depend on the one before it) and
 * memoized per curve, so a later call is a binary search. The cache never
 * changes a result: any call order returns the same windows.
 */
export function bagWindowFor(
  levelIndex: number,
  windowMaxTarget: WindowMaxTarget = v2WindowMaxTarget,
): BagWindow {
  if (!Number.isSafeInteger(levelIndex) || levelIndex < 0) {
    throw new RangeError(`shapeBag: level index must be a non-negative integer, got ${levelIndex}`);
  }
  let windows = windowCache.get(windowMaxTarget);
  if (windows === undefined) {
    windows = [];
    windowCache.set(windowMaxTarget, windows);
  }
  for (;;) {
    const last = windows.length === 0 ? null : windows[windows.length - 1];
    const end = last === null ? 0 : last.start + last.order.length;
    if (levelIndex < end) break;
    const prev = last === null ? null : last.order[last.order.length - 1];
    windows.push(buildWindow(windows.length, end, prev, windowMaxTarget));
  }
  let lo = 0;
  let hi = windows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (windows[mid].start <= levelIndex) lo = mid;
    else hi = mid - 1;
  }
  return windows[lo];
}

/**
 * The shape generator v2 deals at `levelIndex`. Pure: the same index always
 * gives the same shape, and it draws nothing from the level's RNG.
 */
export function pickForLevelV2(
  levelIndex: number,
  windowMaxTarget: WindowMaxTarget = v2WindowMaxTarget,
): ShapeDef {
  const window = bagWindowFor(levelIndex, windowMaxTarget);
  return window.order[levelIndex - window.start];
}

/**
 * The no-silent-shortfall check (W3-10 step 4): a board whose rows or cols
 * sit at (or beyond) a clamp must hold at least its drawn cell target. v2's
 * bag makes this hold by construction when rows hit the shape's row cap (the
 * mask is then the capacity mask); `generateV2` asserts it in `__DEV__` with
 * `maxRows = v2MaxRows(aspect)`.
 */
export function isClampShortfall(
  rows: number,
  cols: number,
  maskCells: number,
  targetCells: number,
  maxRows: number = V2_MAX_GRID_ROWS,
  maxCols: number = V2_MAX_GRID_COLS,
): boolean {
  return (rows >= maxRows || cols >= maxCols) && maskCells < targetCells;
}

function countTrue(m: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of m) for (const b of row) if (b) n++;
  return n;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// C# System.Math.Round (banker's rounding), as in levelGenerator.ts's v1 copy.
function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

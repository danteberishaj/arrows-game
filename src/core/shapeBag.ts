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
 * - **Capacity.** `shapeCapacity(shape)` is the shape's cell count at rows =
 *   `V2_MAX_GRID_DIM` with cols as v2 sizes them (`v2Cols`), the most cells v2
 *   sizing can ever give that shape.
 * - **Windows.** Levels are dealt in consecutive windows. A window's
 *   admissible set is every bag candidate whose capacity covers the largest
 *   cell target any level in the window can draw (`windowMaxTarget`), and the
 *   window is exactly as long as that set, so each member appears exactly
 *   once. Membership is a capacity threshold, so the set is always the top-k
 *   candidates by capacity; the window is the largest such k whose k levels
 *   all fit (`windowSetAt`). Because a window's length is chosen together with
 *   its set, no window is ever cut short.
 * - **Where the set changes.** Under the placeholder target (v1's tier bands,
 *   max 720) every window of 6+ levels holds a Super Hard level, so every
 *   window has the same 18 shapes and is 18 levels long. Under a rising curve
 *   (W3-14), the window just before the rise ends at the rise and holds the
 *   top-k shapes by capacity, k = the levels left before it; each still
 *   appears exactly once. W3-14 owns reporting the admissible count per window.
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
import { Difficulties } from './difficulty';
import { DotNetRandom } from './dotnetRandom';
import { RETIRED_SHAPE_IDS, SHAPE_CATALOGUE, shapeDefFor } from './shapeCatalogue';
import type { ShapeDef } from './shapeLibrary';

/**
 * v2's grid clamp (rows and cols). PROVISIONAL: this is v1's shipped clamp,
 * carried over unchanged until the owner's W3-09 pick (from W3-08's
 * legibility set) lands. A lower value shrinks every capacity and so changes
 * the admissible set; re-derive it with `difficulty-probe.ts --version 2
 * --capacity`.
 */
export const V2_MAX_GRID_DIM = 46; // OWNER-PICKED STARTING VALUE (provisional until W3-09)

/** v1's grid floors, unchanged in v2. */
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

/** cols for a v2 board of `rows` rows: the single formula v2 sizing and capacity share. */
export function v2Cols(rows: number, aspect: number, maxDim: number = V2_MAX_GRID_DIM): number {
  return clamp(roundHalfToEven(rows * aspect), V2_MIN_GRID_COLS, maxDim);
}

const capacityCache = new Map<ShapeDef, Map<number, number>>();

/**
 * Mask cells of `shape` at rows = `maxDim` and cols = `v2Cols(maxDim, aspect)`,
 * memoized per shape and clamp. The first call rasterizes each shape once.
 */
export function shapeCapacity(shape: ShapeDef, maxDim: number = V2_MAX_GRID_DIM): number {
  let byDim = capacityCache.get(shape);
  if (byDim === undefined) {
    byDim = new Map();
    capacityCache.set(shape, byDim);
  }
  let cells = byDim.get(maxDim);
  if (cells === undefined) {
    cells = countTrue(shape.rasterize(maxDim, v2Cols(maxDim, shape.aspect, maxDim)));
    byDim.set(maxDim, cells);
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
  windowMaxTarget: WindowMaxTarget = placeholderWindowMaxTarget,
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
  windowMaxTarget: WindowMaxTarget = placeholderWindowMaxTarget,
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
  windowMaxTarget: WindowMaxTarget = placeholderWindowMaxTarget,
): ShapeDef {
  const window = bagWindowFor(levelIndex, windowMaxTarget);
  return window.order[levelIndex - window.start];
}

/**
 * The no-silent-shortfall check (W3-10 step 4): a board whose rows or cols
 * sit at the clamp must hold at least its drawn cell target. v2's bag makes
 * this hold by construction when rows hit the clamp (the mask is then the
 * capacity mask); `generateV2` asserts it in `__DEV__`.
 */
export function isClampShortfall(
  rows: number,
  cols: number,
  maskCells: number,
  targetCells: number,
  maxDim: number = V2_MAX_GRID_DIM,
): boolean {
  return (rows === maxDim || cols === maxDim) && maskCells < targetCells;
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

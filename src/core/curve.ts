/**
 * W3-14: generator v2's difficulty as a function of the level index.
 *
 * v1's difficulty is flat: `Difficulties.config(d)` never reads the index, and
 * the median scan by band runs 162 / 182 / 176 / 184 / 184 across levels
 * 1-240 (W3-01). v2 reads its cell target, and its clearable bias (W3-11),
 * from the breakpoint table below instead.
 *
 * The table is DATA, not a formula: rows sorted by `levelIndex`, the first at
 * index 0, linearly interpolated between rows, and the last row held forever
 * after. `Difficulties.configV2(d, i)` turns a point into a config:
 * - the cell target of tier d is `baseCells x tierTexture[d] / tierTexture.Normal`,
 *   rounded; min and max are that one value (a point, so level 1 is exactly
 *   the owner's pick; v1's random band is not carried over);
 * - `clearableBias` is the interpolated bias; exactly 1 (the identity, W3-11)
 *   is returned as unset, the neutral path;
 * - arrow length, bends and hearts are v1's per tier, unchanged.
 *
 * `validateCurve` enforces what the rest of v2 relies on: every tier's target
 * never falls and the bias never rises (difficulty never steps down), so the
 * bag can read a window's largest target from its last cycle
 * (`shapeBag.ts` `curveWindowMaxTarget`).
 *
 * Which table ships is the owner's W3-16 pick. Until then `V2_CURVE` is one of
 * W3-14's exploration candidates (ruling W3-7: ceiling at displayed level 100,
 * 400 or 1000), chosen as a placeholder, not a recommendation. The candidates
 * and their measured reports: `docs/curve-candidates-2026-09-26.md`, produced by
 * `npm run analysis:probe -- --candidates`.
 *
 * Pure core: no imports.
 */

/**
 * Relative weights of the three tiers' cell targets. Only the ratios matter:
 * a tier's target is `baseCells x weight / Normal`.
 */
export interface TierTexture {
  readonly Normal: number;
  readonly Hard: number;
  readonly SuperHard: number;
}

/** One breakpoint of the curve. */
export interface CurveRow {
  /** 0-based level index (displayed level - 1) at which the row holds exactly. */
  readonly levelIndex: number;
  /** The Normal tier's cell target at this index. */
  readonly baseCells: number;
  readonly tierTexture: TierTexture;
  /** W3-11's knob for every tier; unset is neutral (interpolates as 1). */
  readonly clearableBias?: number;
}

export type CurveTable = readonly CurveRow[];

/** The curve at one level index. `clearableBias` 1 means neutral. */
export interface CurvePoint {
  readonly baseCells: number;
  readonly tierTexture: TierTexture;
  readonly clearableBias: number;
}

/**
 * v1's measured per-tier arrow medians over displayed levels 1-1000 (Normal
 * p50 83, Hard 126, Super Hard 149; n = 667 / 167 / 166). Carried over from
 * v1 measurement: `npx tsx scripts/analysis/difficulty-probe.ts --version 1
 * --levels 1-1000 --per-tier` (W3-01, 2026-09-17,
 * docs/level-curve-baseline-2026-09-17.md, "Per-tier stats over displayed
 * levels 1-1000"). Used as cell ratios: arrows are close to proportional to
 * cells.
 */
export const V1_TIER_TEXTURE: TierTexture = { Normal: 83, Hard: 126, SuperHard: 149 };

/**
 * v2 level 1's cell TARGET (not its mask cells: an 88-cell target deals Circle
 * at 11x11, W3-12 concern 3).
 */
// OWNER PICK 2026-09-26 (W3-13, docs/level1-sweep-2026-09-26.md): row B `b3/12/Circle`.
export const LEVEL1_TARGET_CELLS = 88;

/** v2 level 1's clearable bias; b = 3's look is accepted for level 1 only. */
// OWNER PICK 2026-09-26 (W3-13, docs/level1-sweep-2026-09-26.md): row B `b3/12/Circle`.
export const LEVEL1_CLEARABLE_BIAS = 3;

/**
 * The heaviest board any curve may deal, in arrows: ruling W3-4
 * (docs/next-level/progress.md) - device perf evidence stops at 250 arrows
 * (level 3827). W3-15 may replace it with a measured value.
 */
export const ARROW_CEILING = 250;

/**
 * The saturated Normal-tier cell target every W3-14 candidate climbs to: the
 * largest base cells whose Hard and Super Hard boards (targets 515 and 609)
 * over indices 0-99,999 sampled every 7 stay at or under `ARROW_CEILING`
 * arrows, neutral (max 238) and at the bias-tail floor 0.3 (max 248); 340
 * already deals 253 at 0.3. MEASURED 2026-09-26: `npm run analysis:probe --
 * --version 2 --ceiling` (docs/curve-candidates-2026-09-26.md, "Ceiling").
 */
export const CEILING_BASE_CELLS = 339;

/**
 * The shipped v2 curve, dark behind GEN_V2_ENABLED. PLACEHOLDER until the
 * owner's W3-16 pick: W3-14 candidate `S400` (the middle of ruling W3-7's
 * grid), not a recommendation.
 */
export const V2_CURVE: CurveTable = [
  // Level 1. `npm run analysis:probe -- --start-sweep --targets 88,145`, 2026-09-26,
  // docs/level1-sweep-2026-09-26.md row B `b3/12/Circle` (owner pick W3-13).
  { levelIndex: 0, baseCells: LEVEL1_TARGET_CELLS, tierTexture: V1_TIER_TEXTURE, clearableBias: LEVEL1_CLEARABLE_BIAS },
  // Saturation at displayed level 400 (candidate S400; ruling W3-7's grid point). Bias back to neutral.
  // `npm run analysis:probe -- --version 2 --candidates`, 2026-09-26,
  // docs/curve-candidates-2026-09-26.md row "S400".
  { levelIndex: 400 - 1, baseCells: CEILING_BASE_CELLS, tierTexture: V1_TIER_TEXTURE },
];

/** Throws unless `table` is a curve v2 can deal from (see the header). */
export function validateCurve(table: CurveTable): void {
  if (table.length === 0) throw new Error('curve: the table is empty');
  if (table[0].levelIndex !== 0) throw new Error(`curve: the first row must be at level index 0, got ${table[0].levelIndex}`);
  for (let k = 0; k < table.length; k++) {
    const row = table[k];
    if (!Number.isSafeInteger(row.levelIndex) || row.levelIndex < 0) {
      throw new Error(`curve: row ${k} level index must be a non-negative integer, got ${row.levelIndex}`);
    }
    if (!(Number.isFinite(row.baseCells) && row.baseCells > 0)) {
      throw new Error(`curve: row ${k} base cells must be finite and > 0, got ${row.baseCells}`);
    }
    const t = row.tierTexture;
    for (const w of [t.Normal, t.Hard, t.SuperHard]) {
      if (!(Number.isFinite(w) && w > 0)) throw new Error(`curve: row ${k} tier texture weights must be finite and > 0`);
    }
    const b = row.clearableBias;
    if (b !== undefined && !(Number.isFinite(b) && b > 0)) {
      throw new Error(`curve: row ${k} clearable bias must be finite and > 0, got ${b}`);
    }
    if (k === 0) continue;
    const prev = table[k - 1];
    if (row.levelIndex <= prev.levelIndex) {
      throw new Error(`curve: level indices must be strictly increasing (row ${k}: ${row.levelIndex} after ${prev.levelIndex})`);
    }
    if (row.baseCells < prev.baseCells) {
      throw new Error(`curve: base cells must not fall (row ${k}: ${row.baseCells} after ${prev.baseCells})`);
    }
    // Each tier's ratio to Normal must not fall either. Between two rows the
    // interpolated ratio (linear over linear) is monotone, so it then never
    // falls, and every tier's target (base cells times that ratio, both
    // positive and non-decreasing) never falls between or across rows.
    const p = prev.tierTexture;
    if (t.Hard / t.Normal < p.Hard / p.Normal || t.SuperHard / t.Normal < p.SuperHard / p.Normal) {
      throw new Error(`curve: row ${k} tier texture makes a tier's cells fall`);
    }
    if ((row.clearableBias ?? 1) > (prev.clearableBias ?? 1)) {
      throw new Error(`curve: clearable bias must not rise (row ${k}: easier than row ${k - 1})`);
    }
  }
}

const validated = new WeakSet<CurveTable>();

/**
 * The curve at `levelIndex`: linear between the two rows around it, the last
 * row beyond the end. An unset bias interpolates as 1 (neutral).
 */
export function curvePointAt(table: CurveTable, levelIndex: number): CurvePoint {
  if (!Number.isSafeInteger(levelIndex) || levelIndex < 0) {
    throw new RangeError(`curve: level index must be a non-negative integer, got ${levelIndex}`);
  }
  if (!validated.has(table)) {
    validateCurve(table);
    validated.add(table);
  }
  let hi = 0;
  while (hi < table.length && table[hi].levelIndex < levelIndex) hi++;
  if (hi === table.length) return pointOf(table[table.length - 1]);
  const b = table[hi];
  if (b.levelIndex === levelIndex || hi === 0) return pointOf(b);
  const a = table[hi - 1];
  const f = (levelIndex - a.levelIndex) / (b.levelIndex - a.levelIndex);
  const lerp = (x: number, y: number) => x + (y - x) * f;
  return {
    baseCells: lerp(a.baseCells, b.baseCells),
    tierTexture: a.tierTexture === b.tierTexture
      ? a.tierTexture
      : {
        Normal: lerp(a.tierTexture.Normal, b.tierTexture.Normal),
        Hard: lerp(a.tierTexture.Hard, b.tierTexture.Hard),
        SuperHard: lerp(a.tierTexture.SuperHard, b.tierTexture.SuperHard),
      },
    clearableBias: lerp(a.clearableBias ?? 1, b.clearableBias ?? 1),
  };
}

function pointOf(row: CurveRow): CurvePoint {
  return { baseCells: row.baseCells, tierTexture: row.tierTexture, clearableBias: row.clearableBias ?? 1 };
}

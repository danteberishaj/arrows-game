import { catalogueIndexOf } from './shapeCatalogue';

/**
 * W4-07: the player's shape collection, as pure functions over two ints.
 *
 * Bit i of `lo` is catalogue index i (0-29) and bit i of `hi` is catalogue
 * index 30 + i (30-59), in `SHAPE_CATALOGUE`'s append-only order
 * (shapeCatalogue.ts). Each int is persisted as its own key
 * (`arrows_shapes_seen_lo` / `_hi`, P-01 rows 15-16) through the int-only
 * store, which serializes with String(v) / parseInt(v, 10); JS bitwise
 * operators are 32-bit signed, so each mask uses bits 0-29 only and every
 * result is taken back to an unsigned value with `>>> 0`.
 *
 * Collection bits are only ever ORed in. Nothing here clears a bit, and a bit
 * this build's catalogue does not know (written by a newer build) survives
 * every operation.
 */

export interface ShapeMasks {
  readonly lo: number;
  readonly hi: number;
}

/** `foldLevels`' result: the new masks and the first campaign level not yet folded. */
export interface FoldResult extends ShapeMasks {
  readonly through: number;
}

/** Bits used per persisted int (bits 30 and 31 are never set). */
export const MASK_BITS = 30;

const MASK_MAX = 2 ** MASK_BITS - 1;
const CAPACITY = 2 * MASK_BITS;

export const EMPTY_SHAPE_MASKS: ShapeMasks = Object.freeze({ lo: 0, hi: 0 });

function validIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CAPACITY;
}

/**
 * A stored mask as a valid 30-bit value. A non-negative safe integer keeps its
 * low 30 bits (a stray bit 30+ is dropped, never shifted into another index);
 * anything else (negative, fractional, NaN, beyond 2^53) reads as 0.
 */
export function sanitizeMask(v: number): number {
  if (!Number.isSafeInteger(v) || v < 0) return 0;
  return v % (MASK_MAX + 1);
}

/** Sets catalogue index `index`'s bit. An index outside 0-59 returns the masks unchanged. */
export function markSeen(masks: ShapeMasks, index: number): ShapeMasks {
  if (!validIndex(index)) return masks;
  if (index < MASK_BITS) {
    const lo = (masks.lo | (1 << index)) >>> 0;
    return lo === masks.lo ? masks : { lo, hi: masks.hi };
  }
  const hi = (masks.hi | (1 << (index - MASK_BITS))) >>> 0;
  return hi === masks.hi ? masks : { lo: masks.lo, hi };
}

/** Whether catalogue index `index`'s bit is set. False for an index outside 0-59. */
export function hasSeen(masks: ShapeMasks, index: number): boolean {
  if (!validIndex(index)) return false;
  return index < MASK_BITS
    ? (masks.lo & (1 << index)) !== 0
    : (masks.hi & (1 << (index - MASK_BITS))) !== 0;
}

function bitCount(v: number): number {
  let n = 0;
  let x = v & MASK_MAX;
  while (x !== 0) {
    x &= x - 1;
    n += 1;
  }
  return n;
}

/** Number of set bits across both masks (bits 0-29 of each). */
export function countSeen(masks: ShapeMasks): number {
  return bitCount(masks.lo) + bitCount(masks.hi);
}

/**
 * Folds campaign levels [fromLevel, toLevel) into the masks, at most `maxSteps`
 * of them, and returns the new masks with `through` = the first level not
 * folded. Incremental by construction: calling it again from `through` gives
 * exactly the result of one uncapped call.
 *
 * - `fromLevel` below 0 (a corrupt stored pointer) starts at 0: refolding only
 *   re-ORs bits that are already set.
 * - `fromLevel >= toLevel` folds nothing and returns `through = fromLevel`
 *   (never lowered: after a progress reset the pointer can lead the level).
 * - `shapeNameForLevel(i)` must return the shape level i actually dealt. A
 *   name that is not in the catalogue sets no bit; collection.test.ts fails the
 *   build if any generated name is unmapped.
 * - `shouldStop` (optional) ends the call early: it is checked before every
 *   level after the first, so a call that has anything to fold always folds at
 *   least one level (progress even when one level costs more than the caller's
 *   time budget). Stopping early is just a smaller call: the result is still
 *   exactly the one-shot fold of [fromLevel, through).
 */
export function foldLevels(
  masks: ShapeMasks,
  fromLevel: number,
  toLevel: number,
  shapeNameForLevel: (levelIndex: number) => string,
  maxSteps: number,
  shouldStop?: () => boolean,
): FoldResult {
  const from = Number.isFinite(fromLevel) ? Math.max(0, Math.trunc(fromLevel)) : 0;
  const cap = Number.isNaN(maxSteps) ? 0 : Math.max(0, Math.floor(maxSteps));
  const end = from + Math.max(0, Math.min(toLevel - from, cap));
  let lo = masks.lo;
  let hi = masks.hi;
  let level = from;
  for (; level < end; level += 1) {
    if (level > from && shouldStop?.()) break;
    const index = catalogueIndexOf(shapeNameForLevel(level));
    if (!validIndex(index)) continue;
    if (index < MASK_BITS) lo = (lo | (1 << index)) >>> 0;
    else hi = (hi | (1 << (index - MASK_BITS))) >>> 0;
  }
  return { lo, hi, through: level };
}

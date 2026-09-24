import type { ArrowPath } from '../core';
import type { BoardArrowArtCache } from './arrowGeometry';
import { composite, darkerOfInkBg } from './contrastAudit';
import type { Palette } from './theme';

/**
 * POLISH-T5 (META_MISSED_MARK, rulings R6/R6a, design spec C): an arrow whose
 * blocked tap actually cost a heart stays drawn in a steady "missed" mark for
 * the rest of the level, so the player sees which arrows they already tried
 * (re-tapping one is free: the per-arrow ledger charges it once per level).
 *
 * The marked set is immutable: every helper returns the SAME reference when
 * nothing changed, so the native mark mask (an O(n) string) is rebuilt only
 * when the set really changes.
 */

/** OWNER-PICKED STARTING VALUE (design spec C): `heart` pulled 25% toward near-black. */
export const MISSED_MARK_ALPHA = 0.75;

/** Deep rose: Daylight #B12B67 (6.16:1 on bg), Ink Night #B93970 (3.45:1). Opaque on purpose. */
export function missedMarkColor(p: Palette): string {
  return composite(p.heart, MISSED_MARK_ALPHA, darkerOfInkBg(p));
}

export const NO_MARKS: ReadonlySet<ArrowPath> = new Set<ArrowPath>();

/**
 * A blocked tap resolved. `chargedHeart` must be the FINAL cost
 * (`blockedTapCost(...).chargeHeart`), not the raw ledger charge: a tap the
 * tutorial grace or the assist rule forgives cost nothing and is not marked
 * (and, the ledger having recorded it, can never mark later either).
 */
export function marksAfterBlockedTap(
  marks: ReadonlySet<ArrowPath>,
  arrow: ArrowPath,
  chargedHeart: boolean,
): ReadonlySet<ArrowPath> {
  if (!chargedHeart || marks.has(arrow)) return marks;
  const next = new Set(marks);
  next.add(arrow);
  return next;
}

/** A removed (once unblocked) arrow takes its mark with it. */
export function marksAfterRemoval(
  marks: ReadonlySet<ArrowPath>,
  arrow: ArrowPath,
): ReadonlySet<ArrowPath> {
  if (!marks.has(arrow)) return marks;
  const next = new Set(marks);
  next.delete(arrow);
  return next;
}

/** The colour the blocked bump's heart mix ends at (R6a): the mark, or ink as today. */
export function settleColor(
  p: Palette,
  marks: ReadonlySet<ArrowPath>,
  arrow: ArrowPath,
): string {
  return marks.has(arrow) ? missedMarkColor(p) : p.ink;
}

/**
 * Native mark mask: one character per initial arrow (the geometry order),
 * `1` where marked. The native view ANDs it with `visibleMask`. No marks is
 * the empty string, so an unmarked level never touches the native paths.
 */
export function missedMarkMask(
  cache: BoardArrowArtCache,
  marks: ReadonlySet<ArrowPath>,
): string {
  if (marks.size === 0) return '';
  return cache.visibilityMask([...marks]);
}

/** Flag off spreads `{}`, so the native props are exactly today's. */
export function nativeMissedMarkProps(
  markMask: string,
  markColor: string,
  enabled: boolean,
): Record<string, never> | { markMask: string; markColor: string } {
  if (!enabled) return {};
  return { markMask, markColor };
}

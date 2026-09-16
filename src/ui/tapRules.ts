import type { ArrowPath, BoardLogic, Cell } from '../core';

/**
 * A blocked arrow costs one heart the first time it is tapped and nothing
 * on any later tap while the level lasts. Re-tapping is how players probe
 * ("is it free yet?") and how double-registered touches arrive; neither is a
 * new mistake. The set is per level: a Retry rebuilds the board and gets a
 * fresh ledger, a rewarded continue keeps it.
 */
export class BlockedTapLedger {
  private readonly charged = new Set<ArrowPath>();

  /** True when this blocked tap should cost a heart (first time for `arrow`). */
  charge(arrow: ArrowPath): boolean {
    if (this.charged.has(arrow)) return false;
    this.charged.add(arrow);
    return true;
  }

  isCharged(arrow: ArrowPath): boolean {
    return this.charged.has(arrow);
  }

  reset(): void {
    this.charged.clear();
  }
}

export interface RecentRemoval {
  arrow: ArrowPath;
  /** Timestamp (ms) of the removal. */
  at: number;
}

/** A second touch on the spot an arrow just left is an echo, not a move. */
export const GHOST_TAP_WINDOW_MS = 350;

/**
 * True when a tap on `cell` should be dropped because the arrow that owned
 * that (now empty) cell left the board moments ago. Without this, a
 * double-registered tap or an eager second tap would snap to whichever
 * neighbour is nearest, which may be blocked and cost a heart.
 */
export function isGhostTap(
  board: BoardLogic,
  recent: RecentRemoval | null,
  cell: Cell,
  now: number,
): boolean {
  if (recent === null) return false;
  if (now < recent.at || now - recent.at > GHOST_TAP_WINDOW_MS) return false;
  if (board.ownerAt(cell.r, cell.c) !== null) return false;
  return recent.arrow.contains(cell);
}

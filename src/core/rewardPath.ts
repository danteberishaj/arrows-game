// src/core/rewardPath.ts
/**
 * Reward path math (spec docs/superpowers/specs/2026-10-04-reward-path-design.md §1–2).
 * Pure: no storage, no UI. Owned rewards reuse the collection's 60-bit lo/hi masks.
 */
export type { ShapeMasks as OwnedMasks } from './collection';
import { hasSeen, markSeen } from './collection';
import type { ShapeMasks as OwnedMasks2 } from './collection';

export type ClearKind = 'campaign' | 'daily';

/** Points one clear earns: campaign 1, daily 2, +1 when no heart was lost. */
export function pointsForClear(kind: ClearKind, perfect: boolean): number {
  return (kind === 'daily' ? 2 : 1) + (perfect ? 1 : 0);
}

/** Cumulative totals: costs [3, 5] become [3, 8]. */
export function pathTotals(costs: readonly number[]): number[] {
  let sum = 0;
  return costs.map(cost => (sum += cost));
}

function safePoints(points: number): number {
  return Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0;
}

/** How many path rewards `points` has reached (0 = none). */
export function pathIndexReached(points: number, totals: readonly number[]): number {
  const p = safePoints(points);
  let reached = 0;
  while (reached < totals.length && totals[reached] <= p) reached++;
  return reached;
}

/** Points still needed for the next reward, read as levels at +1 each; null when the path is complete. */
export function levelsToNext(points: number, totals: readonly number[]): number | null {
  const index = pathIndexReached(points, totals);
  return index >= totals.length ? null : totals[index] - safePoints(points);
}

/** Share of the current step already earned, 0–1; 1 when the path is complete. */
export function progressToNext(points: number, totals: readonly number[]): number {
  const index = pathIndexReached(points, totals);
  if (index >= totals.length) return 1;
  const start = index === 0 ? 0 : totals[index - 1];
  return (safePoints(points) - start) / (totals[index] - start);
}

/** Book spec §3: a path step grants the first path id not owned yet; null when every path id is owned. */
export function grantNext(owned: OwnedMasks2, pathIds: readonly number[]): { owned: OwnedMasks2; granted: number | null } {
  const id = pathIds.find(candidate => !hasSeen(owned, candidate));
  return id === undefined ? { owned, granted: null } : { owned: markSeen(owned, id), granted: id };
}

export function unownedPath(owned: OwnedMasks2, pathIds: readonly number[]): number[] {
  return pathIds.filter(id => !hasSeen(owned, id));
}

/** Levels (at +1 each) until the step that would grant the `rank`-th unowned path style; null when past the last step. */
export function etaForRank(points: number, totals: readonly number[], grants: number, rank: number): number | null {
  const step = grants + rank;
  return step >= totals.length ? null : Math.max(0, totals[step] - safePoints(points));
}

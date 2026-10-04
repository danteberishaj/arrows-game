import type { IntStore } from '../core/saveSystem';
import { hasSeen, markSeen, sanitizeMask } from '../core/collection';
import { levelsToNext, pathIndexReached, pointsForClear, progressToNext, type ClearKind, type OwnedMasks } from '../core/rewardPath';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_PATH, type RewardEntry } from './rewardCatalogue';
import { ARROW_STYLES } from './skinSpecs';

const POINTS = 'arrows_reward_points';
const OWNED_LO = 'arrows_rewards_owned_lo';
const OWNED_HI = 'arrows_rewards_owned_hi';
const SEEN = 'arrows_reward_seen';
const PICKER_SEEN = 'arrows_reward_picker_seen';
/** Additive keys hydrated only when the path is on (spec §3; PICKER_SEEN is the plan's fifth key). */
export const REWARD_KEYS: readonly string[] = [POINTS, OWNED_LO, OWNED_HI, SEEN, PICKER_SEEN];

// No react-native import here: .test.ts files run in the Node ts-jest project (jest.config.js "core").
// The platform/flag gate lives in src/ui/rewardGate.ts.

export interface RewardState {
  points: number; owned: OwnedMasks; reachedIndex: number; next: RewardEntry | null;
  levelsToNext: number | null; progress: number; pickerSeenIndex: number;
}
export interface ClearReward {
  earned: number;
  unlock: { entry: RewardEntry; pathIndex: number; ownedSkins: number } | null;
}

let store: IntStore | null = null;
let writable = false;
let state: RewardState | null = null;
const listeners = new Set<() => void>();

function count(v: number): number { return Number.isSafeInteger(v) && v > 0 ? v : 0; }
function snapshot(points: number, owned: OwnedMasks, pickerSeenIndex: number): RewardState {
  const reachedIndex = pathIndexReached(points, PATH_TOTALS);
  return { points, owned, reachedIndex, next: REWARD_PATH[reachedIndex] ?? null,
    levelsToNext: levelsToNext(points, PATH_TOTALS), progress: progressToNext(points, PATH_TOTALS), pickerSeenIndex };
}
function publish(next: RewardState | null): void { state = next; listeners.forEach(l => l()); }
function withPath(owned: OwnedMasks, reached: number): OwnedMasks {
  let out = owned;
  for (let i = 0; i < reached; i++) out = markSeen(out, REWARD_PATH[i].rewardId);
  return out;
}
function persist(owned: OwnedMasks): void {
  store!.setInt(OWNED_LO, owned.lo);
  store!.setInt(OWNED_HI, owned.hi);
}

export function initializeRewardLedger(next: IntStore | null, enabled: boolean,
  opts: { writable: boolean; totalSolved: number; selectedNumericId: number }): void {
  store = enabled ? next : null;
  writable = enabled && opts.writable && next !== null;
  if (!store) { publish(null); return; }
  let owned: OwnedMasks = { lo: sanitizeMask(store.getInt(OWNED_LO, 0)), hi: sanitizeMask(store.getInt(OWNED_HI, 0)) };
  for (const id of FREE_REWARD_IDS) owned = markSeen(owned, id);
  const stored = store.getInt(POINTS, -1);
  const firstLaunch = !(Number.isSafeInteger(stored) && stored >= 0);
  const points = firstLaunch ? count(opts.totalSolved) : stored;
  if (firstLaunch) owned = markSeen(owned, opts.selectedNumericId); // never lock a style chosen before the path
  const reached = pathIndexReached(points, PATH_TOTALS);
  owned = withPath(owned, reached);
  let pickerSeen = count(store.getInt(PICKER_SEEN, 0));
  if (writable) {
    if (firstLaunch) store.setInt(POINTS, points);
    persist(owned);
    // Credited or reconciled unlocks are silent: no reveal flood, no "new" dots.
    if (count(store.getInt(SEEN, 0)) < reached) store.setInt(SEEN, reached);
    if (firstLaunch || pickerSeen > reached) { pickerSeen = reached; store.setInt(PICKER_SEEN, reached); }
  }
  publish(snapshot(points, owned, firstLaunch ? reached : pickerSeen));
}

export function getRewardState(): RewardState | null { return state; }
export function subscribeRewards(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function isRewardOwned(rewardId: number): boolean { return state ? hasSeen(state.owned, rewardId) : true; }

export function recordRewardClear(kind: ClearKind, perfect: boolean): ClearReward | null {
  if (!state || !store || !writable) return null;
  const earned = pointsForClear(kind, perfect);
  const before = state.reachedIndex;
  const points = state.points + earned;
  const after = pathIndexReached(points, PATH_TOTALS);
  const previousOwned = state.owned;
  const owned = withPath(state.owned, after);
  store.setInt(POINTS, points);
  if (owned !== state.owned) persist(owned);
  publish(snapshot(points, owned, state.pickerSeenIndex));
  const seen = count(store.getInt(SEEN, 0));
  const pathIndex = after - 1;
  // Never reveal a reward that was already owned before this clear (spec §5b amendment).
  const wasOwned = pathIndex >= 0 && hasSeen(previousOwned, REWARD_PATH[pathIndex].rewardId);
  const unlock = after > before && pathIndex >= seen && !wasOwned
    ? { entry: REWARD_PATH[pathIndex], pathIndex,
        ownedSkins: ARROW_STYLES.filter(s => hasSeen(owned, s.numericId)).length }
    : null;
  return { earned, unlock };
}

/** Written when the card is shown, so a kill mid-card never repeats it (spec §5b). */
export function markRevealSeen(pathIndex: number): void {
  if (!store || !writable) return;
  if (count(store.getInt(SEEN, 0)) < pathIndex + 1) store.setInt(SEEN, pathIndex + 1);
}
/** Clears the picker's "new" dots: called when Settings → Arrow style opens. */
export function markPickerSeen(): void {
  if (!state || !store || !writable || state.pickerSeenIndex >= state.reachedIndex) return;
  store.setInt(PICKER_SEEN, state.reachedIndex);
  publish({ ...state, pickerSeenIndex: state.reachedIndex });
}

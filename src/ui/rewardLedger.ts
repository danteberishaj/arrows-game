import type { IntStore } from '../core/saveSystem';
import { hasSeen, markSeen, sanitizeMask } from '../core/collection';
import { etaForRank, grantNext, levelsToNext, pathIndexReached, pointsForClear, progressToNext, unownedPath,
  type ClearKind, type OwnedMasks } from '../core/rewardPath';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_CATALOGUE, REWARD_PATH, REWARD_PATH_IDS, seasonFor, visibleStyleCounts,
  type RewardEntry } from './rewardCatalogue';
import { inSeason } from './seasons';

const POINTS = 'arrows_reward_points';
const OWNED_LO = 'arrows_rewards_owned_lo';
const OWNED_HI = 'arrows_rewards_owned_hi';
const SEEN = 'arrows_reward_seen';
const PICKER_SEEN = 'arrows_reward_picker_seen'; // legacy: read once for migration
const GRANTS = 'arrows_path_grants';
const NEW_LO = 'arrows_rewards_new_lo';
const NEW_HI = 'arrows_rewards_new_hi';
const PETALS = 'arrows_petals';
const WELCOME_PETALS = 10; // OWNER-APPROVED STARTING VALUE (book spec §1)

export const REWARD_KEYS: readonly string[] = [POINTS, OWNED_LO, OWNED_HI, SEEN, PICKER_SEEN, GRANTS, NEW_LO, NEW_HI];
export const BOOK_KEYS: readonly string[] = [PETALS];

export interface RewardState {
  points: number; owned: OwnedMasks; reachedIndex: number; next: RewardEntry | null;
  levelsToNext: number | null; progress: number; newMask: OwnedMasks; petals: number | null;
  /** Book on AND the save is writable (SAVE-GUARD). The Buy button is disabled when false. */
  canBuy: boolean;
  /** HALLOWEEN-01: seasonal styles are on (book on AND META_SEASONS). Absent/false hides every seasonal style. */
  seasons?: boolean;
}
export interface ClearReward {
  earned: number;
  /** ownedSkins / totalSkins count only the styles the player can see (seasonal rule, HALLOWEEN-01). */
  unlock: { entry: RewardEntry; pathIndex: number; ownedSkins: number; totalSkins: number;
    upNext: { entry: RewardEntry; levels: number } | null } | null;
}
export type BuyResult = 'bought' | 'owned' | 'insufficient' | 'unavailable';

let store: IntStore | null = null;
let writable = false;
let seasons = false;
let grants = 0;
let state: RewardState | null = null;
const listeners = new Set<() => void>();

const count = (v: number) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
const masks = (lo: string, hi: string): OwnedMasks =>
  ({ lo: sanitizeMask(store!.getInt(lo, 0)), hi: sanitizeMask(store!.getInt(hi, 0)) });
const entryById = (id: number) => REWARD_CATALOGUE.find(e => e.rewardId === id)!;
const styleCounts = (owned: OwnedMasks, now: Date) => visibleStyleCounts(id => hasSeen(owned, id), seasons, now);
const collected = ({ owned, total }: { owned: number; total: number }) => ({ ownedSkins: owned, totalSkins: total });

function snapshot(points: number, owned: OwnedMasks, newMask: OwnedMasks, petals: number | null): RewardState {
  const nextId = unownedPath(owned, REWARD_PATH_IDS)[0];
  const stepsLeft = grants < PATH_TOTALS.length;
  return { points, owned, reachedIndex: grants, newMask, petals, canBuy: writable && petals !== null, seasons,
    next: nextId === undefined || !stepsLeft ? null : entryById(nextId),
    levelsToNext: nextId === undefined ? null : levelsToNext(points, PATH_TOTALS),
    progress: progressToNext(points, PATH_TOTALS) };
}
function publish(next: RewardState | null): void { state = next; listeners.forEach(l => l()); }
function write(owned: OwnedMasks, newMask: OwnedMasks): void {
  store!.setInt(OWNED_LO, owned.lo); store!.setInt(OWNED_HI, owned.hi);
  store!.setInt(NEW_LO, newMask.lo); store!.setInt(NEW_HI, newMask.hi);
  store!.setInt(GRANTS, grants);
}
/** Grant every step `points` has reached; returns the granted ids in order. */
function grantSteps(points: number, owned: OwnedMasks, newMask: OwnedMasks) {
  const granted: { id: number; step: number }[] = [];
  const reached = pathIndexReached(points, PATH_TOTALS);
  while (grants < reached) {
    const g = grantNext(owned, REWARD_PATH_IDS);
    if (g.granted !== null) { owned = g.owned; newMask = markSeen(newMask, g.granted); granted.push({ id: g.granted, step: grants }); }
    grants++;
  }
  return { owned, newMask, granted };
}

export function initializeRewardLedger(next: IntStore | null, enabled: boolean,
  opts: { writable: boolean; totalSolved: number; selectedNumericId: number; book: boolean; seasons?: boolean }): void {
  store = enabled ? next : null;
  writable = enabled && opts.writable && next !== null;
  // Seasonal styles are book-only (HALLOWEEN-01): no book, no seasons.
  seasons = enabled && opts.book && opts.seasons === true;
  grants = 0;
  if (!store) { publish(null); return; }
  let owned = masks(OWNED_LO, OWNED_HI);
  for (const id of FREE_REWARD_IDS) owned = markSeen(owned, id);
  const storedPoints = store.getInt(POINTS, -1);
  const firstLaunch = !(Number.isSafeInteger(storedPoints) && storedPoints >= 0);
  const points = firstLaunch ? count(opts.totalSolved) : storedPoints;
  if (firstLaunch) owned = markSeen(owned, opts.selectedNumericId);
  const storedGrants = store.getInt(GRANTS, -1);
  let newMask = masks(NEW_LO, NEW_HI);
  if (firstLaunch) {
    grants = 0;
  } else if (Number.isSafeInteger(storedGrants) && storedGrants >= 0) {
    grants = storedGrants;
  } else {
    // A-era save: A granted path entries [0, reached) by index; picker-seen marked [0, pickerSeen) as seen.
    grants = pathIndexReached(points, PATH_TOTALS);
    // Keep A's guarantee for restored/partial saves: path entries [0, reached) are owned (never removed).
    for (let i = 0; i < grants; i++) owned = markSeen(owned, REWARD_PATH_IDS[i]);
    const pickerSeen = count(store.getInt(PICKER_SEEN, 0));
    for (let i = pickerSeen; i < grants; i++) newMask = markSeen(newMask, REWARD_PATH_IDS[i]);
  }
  const g = grantSteps(points, owned, newMask);
  owned = g.owned;
  // Credited or reconciled grants are silent: no reveal flood and no "new" dots on first launch.
  newMask = firstLaunch ? { lo: 0, hi: 0 } : g.newMask;
  let petals: number | null = null;
  if (opts.book) {
    const storedPetals = store.getInt(PETALS, -1);
    petals = Number.isSafeInteger(storedPetals) && storedPetals >= 0 ? storedPetals : WELCOME_PETALS;
    if (writable && storedPetals !== petals) store.setInt(PETALS, petals);
  }
  if (writable) {
    if (firstLaunch) store.setInt(POINTS, points);
    write(owned, newMask);
    if (count(store.getInt(SEEN, 0)) < grants) store.setInt(SEEN, grants);
  }
  publish(snapshot(points, owned, newMask, petals));
}

export function getRewardState(): RewardState | null { return state; }
export function subscribeRewards(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function isRewardOwned(rewardId: number): boolean { return state ? hasSeen(state.owned, rewardId) : true; }
export function isRewardNew(rewardId: number): boolean { return !!state && hasSeen(state.newMask, rewardId); }
export function etaFor(rewardId: number): number | null {
  if (!state) return null;
  const rank = unownedPath(state.owned, REWARD_PATH_IDS).indexOf(rewardId);
  return rank < 0 ? null : etaForRank(state.points, PATH_TOTALS, grants, rank);
}

export function recordRewardClear(kind: ClearKind, perfect: boolean, now: Date = new Date()): ClearReward | null {
  if (!state || !store || !writable) return null;
  const earned = pointsForClear(kind, perfect);
  const points = state.points + earned;
  const petals = state.petals === null ? null : state.petals + earned;
  const grantsBefore = grants;
  const g = grantSteps(points, state.owned, state.newMask);
  store.setInt(POINTS, points);
  if (petals !== null) store.setInt(PETALS, petals);
  // Persist whenever a step was used, even one that granted nothing (all path styles owned): spec §4 amendment.
  if (grants !== grantsBefore) write(g.owned, g.newMask);
  publish(snapshot(points, g.owned, g.newMask, petals));
  const last = g.granted[g.granted.length - 1];
  const seen = count(store.getInt(SEEN, 0));
  const upNextEntry = state.next;
  const unlock = last && last.step >= seen
    ? { entry: entryById(last.id), pathIndex: last.step, ...collected(styleCounts(g.owned, now)),
        upNext: upNextEntry && state.levelsToNext !== null ? { entry: upNextEntry, levels: state.levelsToNext } : null }
    : null;
  return { earned, unlock };
}

/** `now` is the caller's local date (the UI passes it); seasonal styles sell only inside their window. */
export function buyReward(rewardId: number, now: Date = new Date()): BuyResult {
  if (!state || !store || !writable || state.petals === null) return 'unavailable';
  if (hasSeen(state.owned, rewardId)) return 'owned';
  const price = REWARD_CATALOGUE.find(e => e.rewardId === rewardId)?.price;
  if (price == null) return 'unavailable';
  const season = seasonFor(rewardId);
  if (season && (!seasons || !inSeason(season, now))) return 'unavailable';
  if (state.petals < price) return 'insufficient';
  const owned = markSeen(state.owned, rewardId);
  const petals = state.petals - price;
  // Same tick: HydratedIntStore coalesces both into one native write batch (book spec §4).
  store.setInt(OWNED_LO, owned.lo); store.setInt(OWNED_HI, owned.hi);
  store.setInt(PETALS, petals);
  publish(snapshot(state.points, owned, state.newMask, petals));
  return 'bought';
}

export function markRevealSeen(stepIndex: number): void {
  if (!store || !writable) return;
  if (count(store.getInt(SEEN, 0)) < stepIndex + 1) store.setInt(SEEN, stepIndex + 1);
}
/** Clears the picker's "new" dots: called when Settings → Arrow style opens. */
export function markPickerSeen(): void {
  if (!state || !store || !writable || (state.newMask.lo === 0 && state.newMask.hi === 0)) return;
  store.setInt(NEW_LO, 0); store.setInt(NEW_HI, 0);
  publish({ ...state, newMask: { lo: 0, hi: 0 } });
}

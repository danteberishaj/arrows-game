// src/ui/__tests__/rewardLedger.test.ts
import type { IntStore } from '../../core/saveSystem';

class Mem implements IntStore {
  m = new Map<string, number>(); reads: string[] = []; writes: string[] = [];
  getInt(k: string, d: number) { this.reads.push(k); return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}
function load() {
  jest.resetModules();
  return require('../rewardLedger') as typeof import('../rewardLedger');
}
const SKIN = { critter: 6, cinnamon: 1, jelly: 5, sherbet: 2, rainbow: 12 };

test('disabled: zero reward-key reads or writes, everything reads as owned', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, false, { writable: true, totalSolved: 50, selectedNumericId: 1, book: false });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(L.getRewardState()).toBeNull();
  expect(L.isRewardOwned(SKIN.critter)).toBe(true);
  expect(s.reads.filter(k => k.startsWith('arrows_reward'))).toEqual([]);
  expect(s.writes).toEqual([]);
});

test('first launch, 0 solved: only the free styles are owned, nothing seen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: false });
  const st = L.getRewardState()!;
  expect(st.points).toBe(0);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
  expect(st.next?.refId).toBe('critter');
  expect(st.levelsToNext).toBe(3);
});

test('first launch credit, 9 solved: Critter and Cinnamon owned silently (seen = reached)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 9, selectedNumericId: 0, book: false });
  expect(L.isRewardOwned(SKIN.critter) && L.isRewardOwned(SKIN.cinnamon)).toBe(true);
  expect(L.isRewardOwned(SKIN.jelly)).toBe(false);
  expect(s.m.get('arrows_reward_seen')).toBe(2);
  expect(L.getRewardState()!.newMask).toEqual({ lo: 0, hi: 0 });
});

test('first launch credit, 300 solved: everything owned, no next', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 300, selectedNumericId: 0, book: false });
  expect(L.getRewardState()!.next).toBeNull();
  expect(L.isRewardOwned(16)).toBe(true);
});

test('a selected style beyond the credited point is owned and never locked', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow, book: false });
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
});

test('crossing a threshold returns the unlock once; the reveal is not repeated after markRevealSeen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: false });
  expect(L.recordRewardClear('campaign', false)).toEqual({ earned: 1, unlock: null });
  const r = L.recordRewardClear('campaign', true)!; // 1 + 2 = 3 = Critter
  expect(r.earned).toBe(2);
  expect(r.unlock?.entry.refId).toBe('critter');
  expect(r.unlock?.pathIndex).toBe(0);
  expect(r.unlock?.ownedSkins).toBe(4);
  L.markRevealSeen(0);
  expect(s.m.get('arrows_reward_seen')).toBe(1);
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull();
});


test('daily earns 2 (+1 perfect)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: false });
  expect(L.recordRewardClear('daily', true)!.earned).toBe(3);
  expect(L.getRewardState()!.points).toBe(3);
});

test('read-only session (failed hydrate): no writes, no unlocks', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 40, selectedNumericId: 0, book: false });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(s.writes).toEqual([]);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
});

test('restore/cost change: bits behind points are reconciled up silently, never removed', () => {
  const L = load(); const s = new Mem();
  s.m.set('arrows_reward_points', 22); // reaches Rainbow (index 3)
  s.m.set('arrows_rewards_owned_lo', (1 << 0) | (1 << 2) | (1 << 4) | (1 << 16)); // starters + Lava Rock (bought earlier)
  s.m.set('arrows_reward_seen', 1);
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 999, selectedNumericId: 0, book: false });
  expect([6, 1, 5, 12, 16].every(L.isRewardOwned)).toBe(true);
  expect(s.m.get('arrows_reward_seen')).toBe(4); // silent
  expect(L.getRewardState()!.points).toBe(22); // never re-credited from totalSolved
});

const PET = 'arrows_petals';
import { REWARD_PATH_IDS } from '../rewardCatalogue';

test('skip rule: a style owned before the path is skipped, every step grants something new', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow, book: false });
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('critter'); // step 0 at 3
  L.markRevealSeen(0);
  for (let i = 0; i < 18; i++) L.recordRewardClear('campaign', false); // 21: steps 1,2 -> cinnamon, jelly
  const r = L.recordRewardClear('campaign', false)!; // 22: step 3 -> NOT rainbow (owned) -> strawberry
  expect(r.unlock?.entry.refId).toBe('strawberry-glazed');
});

test('book off: no petal key is read or written', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: false });
  L.recordRewardClear('campaign', true);
  expect([...s.reads, ...s.writes].filter(k => k === PET)).toEqual([]);
  expect(L.getRewardState()!.petals).toBeNull();
});

test('welcome gift: 10 petals once; clears add petals equal to points', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(s.m.get(PET)).toBe(10);
  L.recordRewardClear('daily', true); // +3
  expect(L.getRewardState()!.petals).toBe(13);
  const L2 = load(); // relaunch over the same store: no second gift
  L2.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L2.getRewardState()!.petals).toBe(13);
});

test('buying deducts, grants and cannot overdraw or double-buy', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.rainbow)).toBe('bought'); // 10 -> 0
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
  expect(L.getRewardState()!.petals).toBe(0);
  expect(L.buyReward(SKIN.rainbow)).toBe('owned');
  expect(L.buyReward(SKIN.jelly)).toBe('insufficient');
  expect(L.isRewardOwned(SKIN.jelly)).toBe(false);
  expect(L.buyReward(0)).toBe('owned'); // Classic is free/owned
});

test('buying the very next style: the next step grants the one after it', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.critter)).toBe('bought');
  expect(L.getRewardState()!.next?.refId).toBe('cinnamon');
  L.recordRewardClear('campaign', true); // 2
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('cinnamon'); // step 0 at 3
});

test('read-only session: buying is unavailable and writes nothing', () => {
  const L = load(); const s = new Mem();
  s.m.set(PET, 50);
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.jelly)).toBe('unavailable');
  expect(s.writes).toEqual([]);
});

test('A-era save migrates: grants = steps reached, new-mask from picker-seen, 10 petals, no reveal flood', () => {
  const L = load(); const s = new Mem();
  s.m.set('arrows_reward_points', 14);               // steps 0..2 reached (3, 8, 14)
  s.m.set('arrows_rewards_owned_lo', (1 << 0) | (1 << 2) | (1 << 4) | (1 << 6) | (1 << 1) | (1 << 5));
  s.m.set('arrows_reward_seen', 3);
  s.m.set('arrows_reward_picker_seen', 2);           // Jelly (step 2) not yet seen in the picker
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 99, selectedNumericId: 0, book: true });
  expect(s.m.get('arrows_path_grants')).toBe(3);
  expect(L.isRewardNew(SKIN.jelly)).toBe(true);
  expect(L.isRewardNew(SKIN.cinnamon)).toBe(false);
  expect(L.getRewardState()!.petals).toBe(10);
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull(); // 15 points: no step
});

test('etaFor ranks unowned path styles after the grants already made', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 4, selectedNumericId: 0, book: true }); // step 0 granted (critter)
  expect(L.etaFor(SKIN.cinnamon)).toBe(4);  // 8 - 4
  expect(L.etaFor(SKIN.jelly)).toBe(10);    // 14 - 4
  L.buyReward(SKIN.cinnamon);
  expect(L.etaFor(SKIN.jelly)).toBe(4);     // jelly is now rank 0
  expect(L.etaFor(0)).toBeNull();           // Classic: not on the path
});

test('a step crossed with every path style owned is still persisted (grants never lag behind)', () => {
  const L = load(); const s = new Mem();
  s.m.set(PET, 999);
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  for (const id of REWARD_PATH_IDS) L.buyReward(id);
  L.recordRewardClear('campaign', true); // 2
  L.recordRewardClear('campaign', false); // 3: step 0 crossed, nothing left to grant
  expect(s.m.get('arrows_path_grants')).toBe(1);
});

test('canBuy is false in a read-only session and true when writable with the book on', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.getRewardState()!.canBuy).toBe(false);
  const L2 = load();
  L2.initializeRewardLedger(new Mem(), true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L2.getRewardState()!.canBuy).toBe(true);
});

test('complete path with the book on: next is null, petals keep accruing', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 300, selectedNumericId: 0, book: true });
  expect(L.getRewardState()!.next).toBeNull();
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull();
  expect(L.getRewardState()!.petals).toBe(11);
});

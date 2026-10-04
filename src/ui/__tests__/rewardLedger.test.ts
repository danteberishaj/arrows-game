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
  L.initializeRewardLedger(s, false, { writable: true, totalSolved: 50, selectedNumericId: 1 });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(L.getRewardState()).toBeNull();
  expect(L.isRewardOwned(SKIN.critter)).toBe(true);
  expect(s.reads.filter(k => k.startsWith('arrows_reward'))).toEqual([]);
  expect(s.writes).toEqual([]);
});

test('first launch, 0 solved: only the free styles are owned, nothing seen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
  const st = L.getRewardState()!;
  expect(st.points).toBe(0);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
  expect(st.next?.refId).toBe('critter');
  expect(st.levelsToNext).toBe(3);
});

test('first launch credit, 9 solved: Critter and Cinnamon owned silently (seen = reached)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 9, selectedNumericId: 0 });
  expect(L.isRewardOwned(SKIN.critter) && L.isRewardOwned(SKIN.cinnamon)).toBe(true);
  expect(L.isRewardOwned(SKIN.jelly)).toBe(false);
  expect(s.m.get('arrows_reward_seen')).toBe(2);
  expect(s.m.get('arrows_reward_picker_seen')).toBe(2);
});

test('first launch credit, 300 solved: everything owned, no next', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 300, selectedNumericId: 0 });
  expect(L.getRewardState()!.next).toBeNull();
  expect(L.isRewardOwned(16)).toBe(true);
});

test('a selected style beyond the credited point is owned and never locked', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow });
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
});

test('crossing a threshold returns the unlock once; the reveal is not repeated after markRevealSeen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
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

test('a style selected before the path: earlier reveals still show, its own reach is silent', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow });
  expect(s.m.get('arrows_reward_seen') ?? 0).toBe(0);
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('critter'); // 3 points
  L.markRevealSeen(0);
  for (let i = 0; i < 18; i++) L.recordRewardClear('campaign', false); // 21 points: Cinnamon, Jelly reached
  const r = L.recordRewardClear('campaign', false)!; // 22 points: Rainbow reached, already owned
  expect(r.unlock).toBeNull();
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
});

test('daily earns 2 (+1 perfect)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
  expect(L.recordRewardClear('daily', true)!.earned).toBe(3);
  expect(L.getRewardState()!.points).toBe(3);
});

test('read-only session (failed hydrate): no writes, no unlocks', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 40, selectedNumericId: 0 });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(s.writes).toEqual([]);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
});

test('restore/cost change: bits behind points are reconciled up silently, never removed', () => {
  const L = load(); const s = new Mem();
  s.m.set('arrows_reward_points', 22); // reaches Rainbow (index 3)
  s.m.set('arrows_rewards_owned_lo', (1 << 0) | (1 << 2) | (1 << 4) | (1 << 16)); // starters + Lava Rock (bought earlier)
  s.m.set('arrows_reward_seen', 1);
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 999, selectedNumericId: 0 });
  expect([6, 1, 5, 12, 16].every(L.isRewardOwned)).toBe(true);
  expect(s.m.get('arrows_reward_seen')).toBe(4); // silent
  expect(L.getRewardState()!.points).toBe(22); // never re-credited from totalSolved
});

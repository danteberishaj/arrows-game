// PETAL-ADS-01: rewarded ads for petals, ledger side (RN-free, injected date).
import type { IntStore } from '../../core/saveSystem';

class Mem implements IntStore {
  m = new Map<string, number>(); reads: string[] = []; writes: string[] = [];
  getInt(k: string, d: number) { this.reads.push(k); return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}
type Ledger = typeof import('../rewardLedger');
function load(): Ledger {
  jest.resetModules();
  return require('../rewardLedger') as Ledger;
}
const DAY = 'arrows_petal_ads_day';
const COUNT = 'arrows_petal_ads_count';
const MON = new Date(2026, 9, 5, 12, 0, 0); // local noon
const TUE = new Date(2026, 9, 6, 0, 0, 1);  // just after local midnight
const opts = { writable: true, totalSolved: 0, selectedNumericId: 0, book: true, petalAds: true };

function boot(store: Mem, o: Partial<typeof opts> = {}): Ledger {
  const L = load();
  L.initializeRewardLedger(store, true, { ...opts, ...o });
  return L;
}

test('petal ads off: no petal-ad key is read or written, grant is unavailable, nothing left', () => {
  const s = new Mem();
  const L = boot(s, { petalAds: false });
  expect(L.petalAdState(MON)).toEqual({ left: 0 });
  expect(L.grantPetalAd(MON)).toBe('unavailable');
  expect(L.getRewardState()!.petals).toBe(10);
  expect(L.getRewardState()!.petalAds).toBe(false);
  expect([...s.reads, ...s.writes].filter(k => k.startsWith('arrows_petal_ads'))).toEqual([]);
});

test('book off: petal ads stay off even when asked for, and touch no key', () => {
  const s = new Mem();
  const L = boot(s, { book: false });
  expect(L.grantPetalAd(MON)).toBe('unavailable');
  expect(L.getRewardState()!.petalAds).toBe(false);
  expect([...s.reads, ...s.writes].filter(k => k.startsWith('arrows_petal'))).toEqual([]);
});

test('initialising with petal ads on reads no petal-ad key until asked (lazy)', () => {
  const s = new Mem();
  const L = boot(s);
  expect(L.getRewardState()!.petalAds).toBe(true);
  expect([...s.reads, ...s.writes].filter(k => k.startsWith('arrows_petal_ads'))).toEqual([]);
});

test('a fresh save has 5 left; a grant adds exactly 3 petals and records day + count', () => {
  const s = new Mem();
  const L = boot(s);
  expect(L.petalAdState(MON)).toEqual({ left: 5 });
  expect(L.grantPetalAd(MON)).toBe('granted');
  expect(L.getRewardState()!.petals).toBe(13);
  expect(s.m.get('arrows_petals')).toBe(13);
  expect(s.m.get(COUNT)).toBe(1);
  expect(s.m.get(DAY)).toBe(L.localDayNumber(MON));
  expect(L.petalAdState(MON)).toEqual({ left: 4 });
});

test('cap: 5 grants per local day, the 6th is capped and writes nothing', () => {
  const s = new Mem();
  const L = boot(s);
  for (let i = 0; i < 5; i++) expect(L.grantPetalAd(MON)).toBe('granted');
  expect(L.getRewardState()!.petals).toBe(25);
  expect(L.petalAdState(MON)).toEqual({ left: 0 });
  s.writes = [];
  expect(L.grantPetalAd(MON)).toBe('capped');
  expect(s.writes).toEqual([]);
  expect(L.getRewardState()!.petals).toBe(25);
});

test('the count resets when the local day changes', () => {
  const s = new Mem();
  const L = boot(s);
  for (let i = 0; i < 5; i++) L.grantPetalAd(MON);
  expect(L.petalAdState(TUE)).toEqual({ left: 5 });
  expect(L.grantPetalAd(TUE)).toBe('granted');
  expect(s.m.get(COUNT)).toBe(1);
  expect(s.m.get(DAY)).toBe(L.localDayNumber(TUE));
  expect(L.localDayNumber(TUE) - L.localDayNumber(MON)).toBe(1);
});

test('a saved day AFTER today (clock moved back / restore) counts as today: no extra grants', () => {
  const s = new Mem();
  const L0 = load();
  const today = L0.localDayNumber(MON);
  s.m.set(DAY, today + 3); s.m.set(COUNT, 5);
  const L = boot(s);
  expect(L.petalAdState(MON)).toEqual({ left: 0 });
  expect(L.grantPetalAd(MON)).toBe('capped');
  s.m.set(COUNT, 3);
  expect(L.petalAdState(MON)).toEqual({ left: 2 });
  expect(L.grantPetalAd(MON)).toBe('granted');
  expect(s.m.get(DAY)).toBe(today); // repaired to today
  expect(s.m.get(COUNT)).toBe(4);
});

test.each([
  ['NaN count', 'today', Number.NaN, 0],
  ['Infinity count', 'today', Number.POSITIVE_INFINITY, 0],
  ['count above the cap', 'today', 99, 0],
  ['negative count clamps to 0', 'today', -4, 5],
  ['fractional count truncates', 'today', 2.7, 3],
  ['corrupt (negative) day keeps the count as today', -7, 4, 1],
  ['corrupt (fractional) day keeps the count as today', 12.5, 5, 0],
  ['corrupt (NaN) day keeps the count as today', Number.NaN, 5, 0],
  ['absent day with a stored count counts as today', 'absent', 5, 0],
  ['yesterday resets', 'yesterday', 5, 5],
] as const)('restored/corrupt values never grant extra: %s', (_name, day, count, left) => {
  const s = new Mem();
  const today = load().localDayNumber(MON);
  if (day === 'today') s.m.set(DAY, today);
  else if (day === 'yesterday') s.m.set(DAY, today - 1);
  else if (day !== 'absent') s.m.set(DAY, day);
  s.m.set(COUNT, count);
  const L = boot(s);
  expect(L.petalAdState(MON)).toEqual({ left });
  let granted = 0;
  for (let i = 0; i < 10; i++) if (L.grantPetalAd(MON) === 'granted') granted++;
  expect(granted).toBe(left);
});

test('read-only session (failed hydrate): grant is unavailable and nothing is written', () => {
  const s = new Mem();
  const L = boot(s, { writable: false });
  expect(L.getRewardState()!.canBuy).toBe(false);
  expect(L.grantPetalAd(MON)).toBe('unavailable');
  expect(s.writes).toEqual([]);
  expect(L.getRewardState()!.petals).toBe(10);
});

test('a grant publishes the new purse to subscribers', () => {
  const s = new Mem();
  const L = boot(s);
  const seen: (number | null)[] = [];
  L.subscribeRewards(() => seen.push(L.getRewardState()!.petals));
  L.grantPetalAd(MON);
  expect(seen).toEqual([13]);
});

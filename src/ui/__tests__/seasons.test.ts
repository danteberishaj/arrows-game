// src/ui/__tests__/seasons.test.ts — HALLOWEEN-01 Part A: seasonal styles in the collection book.
import type { IntStore } from '../../core/saveSystem';
import { inSeason, seasonTitle, type Season } from '../seasons';
import {
  FREE_REWARD_IDS, HALLOWEEN, REWARD_CATALOGUE, REWARD_PATH_IDS, SEASONAL_REWARD_IDS, isStyleVisible, seasonFor,
  visibleStyleCounts,
} from '../rewardCatalogue';
import { ARROW_STYLES } from '../skinSpecs';

class Mem implements IntStore {
  m = new Map<string, number>(); reads: string[] = []; writes: string[] = [];
  getInt(k: string, d: number) { this.reads.push(k); return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const PUMPKIN = 18, GHOST = 19, CANDY = 20;
const OCT = day(2026, 10, 15), DEC = day(2026, 12, 10);

describe('season window (local time, inclusive, may wrap the year)', () => {
  const halloween: Season = { id: 'h', name: 'Halloween', start: '10-01', end: '11-07' };
  test('inclusive start and end days, including their first and last minute', () => {
    expect(inSeason(halloween, day(2026, 9, 30, 23))).toBe(false);
    expect(inSeason(halloween, new Date(2026, 9, 1, 0, 0, 0))).toBe(true);
    expect(inSeason(halloween, day(2026, 10, 31))).toBe(true);
    expect(inSeason(halloween, new Date(2026, 10, 7, 23, 59, 59))).toBe(true);
    expect(inSeason(halloween, new Date(2026, 10, 8, 0, 0, 0))).toBe(false);
    expect(inSeason(halloween, day(2026, 12, 25))).toBe(false);
  });
  test('a window that wraps the year (12-01..01-15)', () => {
    const winter: Season = { id: 'w', name: 'Winter', start: '12-01', end: '01-15' };
    expect(inSeason(winter, day(2026, 11, 30))).toBe(false);
    expect(inSeason(winter, day(2026, 12, 1))).toBe(true);
    expect(inSeason(winter, day(2026, 12, 31))).toBe(true);
    expect(inSeason(winter, day(2027, 1, 1))).toBe(true);
    expect(inSeason(winter, day(2027, 1, 15))).toBe(true);
    expect(inSeason(winter, day(2027, 1, 16))).toBe(false);
    expect(inSeason(winter, day(2026, 6, 1))).toBe(false);
  });
  test('the book title names the season and its last day', () => {
    expect(seasonTitle(HALLOWEEN)).toBe('Halloween · until 7 Nov');
  });
});

describe('catalogue: seasonal styles are book-only', () => {
  test('Halloween is 10-01..11-07 and covers Pumpkin, Ghost and Candy Corn at 20 petals', () => {
    expect(HALLOWEEN).toEqual({ id: 'halloween', name: 'Halloween', start: '10-01', end: '11-07' });
    expect([...SEASONAL_REWARD_IDS]).toEqual([PUMPKIN, GHOST, CANDY]);
    for (const id of SEASONAL_REWARD_IDS) {
      const entry = REWARD_CATALOGUE.find(e => e.rewardId === id)!;
      expect(entry.season).toBe(HALLOWEEN);
      expect(seasonFor(id)).toBe(HALLOWEEN);
      expect(entry.pathCost).toBeNull();
      expect(entry.price).toBe(20);
      expect(REWARD_PATH_IDS).not.toContain(id);
      expect(FREE_REWARD_IDS).not.toContain(id);
    }
    expect(REWARD_CATALOGUE.filter(e => e.season).map(e => e.refId)).toEqual(['pumpkin', 'ghost', 'candy-corn']);
  });
  test('visibility: off hides every seasonal style; on shows owned all year, unowned only in season', () => {
    const none = () => false;
    const ownsPumpkin = (id: number) => id === PUMPKIN;
    for (const id of SEASONAL_REWARD_IDS) {
      expect(isStyleVisible(id, () => true, false, OCT)).toBe(false);
      expect(isStyleVisible(id, none, true, OCT)).toBe(true);
      expect(isStyleVisible(id, none, true, DEC)).toBe(false);
    }
    expect(isStyleVisible(PUMPKIN, ownsPumpkin, true, DEC)).toBe(true);
    expect(isStyleVisible(6, none, false, DEC)).toBe(true); // ordinary styles never depend on the date
  });
  test('"N of total" counts only visible styles (never a hard-coded 18 or 21)', () => {
    const ordinary = ARROW_STYLES.filter(s => !SEASONAL_REWARD_IDS.includes(s.numericId)).length;
    const owned = (id: number) => [0, 2, 4, PUMPKIN].includes(id);
    expect(visibleStyleCounts(owned, false, OCT)).toEqual({ owned: 3, total: ordinary });
    expect(visibleStyleCounts(owned, true, OCT)).toEqual({ owned: 4, total: ordinary + 3 });
    expect(visibleStyleCounts(owned, true, DEC)).toEqual({ owned: 4, total: ordinary + 1 });
  });
});

describe('ledger: seasonal purchases and the path', () => {
  function load() {
    jest.resetModules();
    return require('../rewardLedger') as typeof import('../rewardLedger');
  }
  const opts = { writable: true, totalSolved: 0, selectedNumericId: 0, book: true, seasons: true };
  test('in season: buying Pumpkin costs 20 petals and writes only the existing owned/petal keys', () => {
    const L = load(); const s = new Mem(); s.m.set('arrows_petals', 25);
    L.initializeRewardLedger(s, true, opts);
    s.writes.length = 0;
    expect(L.buyReward(PUMPKIN, OCT)).toBe('bought');
    expect(L.isRewardOwned(PUMPKIN)).toBe(true);
    expect(L.getRewardState()!.petals).toBe(5);
    expect([...new Set(s.writes)].sort()).toEqual(['arrows_petals', 'arrows_rewards_owned_hi', 'arrows_rewards_owned_lo']);
  });
  test('out of season: buying a seasonal style is unavailable and writes nothing', () => {
    const L = load(); const s = new Mem(); s.m.set('arrows_petals', 99);
    L.initializeRewardLedger(s, true, opts);
    s.writes.length = 0;
    expect(L.buyReward(GHOST, DEC)).toBe('unavailable');
    expect(L.buyReward(CANDY, day(2026, 11, 8, 0))).toBe('unavailable');
    expect(L.isRewardOwned(GHOST)).toBe(false);
    expect(L.getRewardState()!.petals).toBe(99);
    expect(s.writes).toEqual([]);
  });
  test('seasons off: a seasonal style cannot be bought even in its window', () => {
    const L = load(); const s = new Mem(); s.m.set('arrows_petals', 99);
    L.initializeRewardLedger(s, true, { ...opts, seasons: false });
    expect(L.buyReward(PUMPKIN, OCT)).toBe('unavailable');
    expect(L.isRewardOwned(PUMPKIN)).toBe(false);
  });
  test('the path never grants a seasonal style, even after every step', () => {
    const L = load(); const s = new Mem();
    L.initializeRewardLedger(s, true, opts);
    for (let i = 0; i < 200; i++) L.recordRewardClear('campaign', false, OCT);
    expect(L.getRewardState()!.next).toBeNull();
    for (const id of SEASONAL_REWARD_IDS) expect(L.isRewardOwned(id)).toBe(false);
    const L2 = load(); // first-launch credit with a huge total
    L2.initializeRewardLedger(new Mem(), true, { ...opts, totalSolved: 999 });
    for (const id of SEASONAL_REWARD_IDS) expect(L2.isRewardOwned(id)).toBe(false);
  });
  test('an unlock reports owned/total over visible styles only', () => {
    const L = load(); const s = new Mem();
    s.m.set('arrows_rewards_owned_lo', 1 << PUMPKIN);
    L.initializeRewardLedger(s, true, { ...opts, seasons: false });
    L.recordRewardClear('campaign', true, OCT);
    const off = L.recordRewardClear('campaign', false, OCT)!.unlock!; // 3 points: Critter
    const ordinary = ARROW_STYLES.length - SEASONAL_REWARD_IDS.length;
    expect([off.ownedSkins, off.totalSkins]).toEqual([4, ordinary]);
    const L2 = load(); const s2 = new Mem();
    s2.m.set('arrows_rewards_owned_lo', 1 << PUMPKIN);
    L2.initializeRewardLedger(s2, true, opts);
    L2.recordRewardClear('campaign', true, DEC);
    const on = L2.recordRewardClear('campaign', false, DEC)!.unlock!;
    expect([on.ownedSkins, on.totalSkins]).toEqual([5, ordinary + 1]);
    expect(L2.getRewardState()!.seasons).toBe(true);
  });
  test('seasons need the book: the state reports seasons only with book and seasons on', () => {
    const L = load();
    L.initializeRewardLedger(new Mem(), true, { ...opts, book: false });
    expect(L.getRewardState()!.seasons).toBe(false);
  });
});

describe('selection: a saved seasonal id renders as Classic unless seasons are on', () => {
  function load() {
    jest.resetModules();
    return require('../arrowStyleSelection') as typeof import('../arrowStyleSelection');
  }
  test.each([[PUMPKIN, 'pumpkin'], [GHOST, 'ghost'], [CANDY, 'candy-corn']])('saved %i', (id, name) => {
    const s = new Mem(); s.m.set('arrows_skin', id);
    const off = load(); off.initializeArrowStyle(s, true);
    expect(off.getArrowStyle().id).toBe('classic');
    off.chooseArrowStyle(name);
    expect(off.getArrowStyle().id).toBe('classic');
    expect(s.writes).toEqual([]); // no repair write: the saved id is kept for an enabled build
    const on = load(); on.initializeArrowStyle(s, true, true);
    expect(on.getArrowStyle().id).toBe(name);
  });
});

describe('HALLOWEEN-01 conflict evidence: the brief dark tint', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { skinContrastRows } = require('../contrastAudit') as typeof import('../contrastAudit');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SKIN_SPECS, HALLOWEEN_BRIEF_DARK_TINT } = require('../skinSpecs') as typeof import('../skinSpecs');
  test('#2A2140 fails only the required missed-mark row; the registered dark board passes every required row', () => {
    const pumpkin = SKIN_SPECS.pumpkin;
    const brief = { ...pumpkin, board: { ...pumpkin.board!, dark: HALLOWEEN_BRIEF_DARK_TINT } };
    const failing = skinContrastRows([brief]).filter(r => r.required && !r.pass);
    expect(failing.map(r => [r.usage.id, r.palette, Number(r.ratio.toFixed(3))])).toEqual([['skin-pumpkin-tint-arrow-missed-mark', 'Ink Night', 2.992]]);
    expect(skinContrastRows([pumpkin]).filter(r => r.required && !r.pass)).toEqual([]);
  });
});

describe('HALLOWEEN-01b: the owner-chosen dark tint', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { skinContrastRows } = require('../contrastAudit') as typeof import('../contrastAudit');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SKIN_SPECS } = require('../skinSpecs') as typeof import('../skinSpecs');
  test.each(['pumpkin', 'ghost', 'candy-corn'])('#221A36 passes every required row for %s', id => {
    const spec = { ...SKIN_SPECS[id], board: { light: '#F3EEFA', dark: '#221A36' } };
    const rows = skinContrastRows([spec]);
    expect(rows.filter(r => r.required && !r.pass)).toEqual([]);
    expect(rows.filter(r => r.palette === 'Ink Night' && r.required).every(r => r.bg === '#221A36' || r.usage.kind === 'text')).toBe(true);
  });
});

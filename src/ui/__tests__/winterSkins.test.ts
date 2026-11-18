// NEW-YEAR-01 / WINTER-01 (owner 2026-11-18): Frosted Glass 24, Golden Ribbon 25, Confetti 26 (New Year) and
// Snowman 27, Snowfall 28 (Winter); book-only seasonal styles at 20 petals. 23 stays reserved for Little Bat.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { IntStore } from '../../core/saveSystem';
import { ARROW_STYLES, SKIN_SPECS, SKIN_SPEC_JSON, skinSpecJson, type SkinSpec } from '../skinSpecs';
import {
  FREE_REWARD_IDS, HALLOWEEN, NEW_YEAR, REWARD_CATALOGUE, REWARD_PATH_IDS, SEASONAL_REWARD_IDS, WINTER, isStyleVisible,
  seasonFor, visibleStyleCounts,
} from '../rewardCatalogue';
import { inSeason, seasonTitle } from '../seasons';
import { skinContrastRows, skinPickerContrastRows } from '../contrastAudit';

const FROZEN = JSON.parse(readFileSync(join(__dirname, 'winterSkins.frozen.json'), 'utf8')) as { specJson: Record<string, string> };
const NEW = [[24, 'frosted-glass', 'Frosted Glass'], [25, 'golden-ribbon', 'Golden Ribbon'], [26, 'confetti', 'Confetti'],
  [27, 'snowman', 'Snowman'], [28, 'snowfall', 'Snowfall']] as const;
const NY_IDS = [24, 25, 26], WINTER_IDS = [27, 28];
const spec = (id: string) => SKIN_SPECS[id] as SkinSpec;
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const slots = (s: SkinSpec) => s.layers.reduce((n, l) => n + (l.kind === 'bands' || l.kind === 'lengthBands' ? l.bands!.length : 1), 0)
  + Number(s.face.eyes) + Number(s.face.blush);

class Mem implements IntStore {
  m = new Map<string, number>(); writes: string[] = [];
  getInt(k: string, d: number) { return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}

describe('registry: append-only identities', () => {
  test('five new specs follow Potion Slime 22 in order, skipping the reserved 23', () => {
    expect(ARROW_STYLES.slice(-8, -3).map(s => [s.numericId, s.id, s.name])).toEqual(NEW.map(n => [...n]));
    const ids = ARROW_STYLES.map(s => s.numericId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(23);
    expect(ids).toEqual([...ids].sort((a, b) => a - b)); // monotonic registry order
  });
  test('every pre-existing native payload is byte-identical to before this change', () => {
    expect(Object.keys(FROZEN.specJson)).toHaveLength(22);
    for (const [id, hash] of Object.entries(FROZEN.specJson))
      expect([id, createHash('sha256').update(SKIN_SPEC_JSON[id]).digest('hex')]).toEqual([id, hash]);
  });
  test('board.decor is JS-only: kept on the spec, absent from the native payload; decor-free specs serialise unchanged', () => {
    for (const id of ['snowman', 'snowfall']) {
      expect(spec(id).board).toEqual({ light: '#EEF4FB', dark: '#121A2B', decor: 'snow' });
      expect(SKIN_SPEC_JSON[id]).not.toContain('decor');
      expect(JSON.parse(SKIN_SPEC_JSON[id]).board).toEqual({ light: '#EEF4FB', dark: '#121A2B' });
    }
    for (const s of Object.values(SKIN_SPECS)) if (!s.board?.decor) expect(skinSpecJson(s)).toBe(JSON.stringify(s));
    for (const id of ['frosted-glass', 'golden-ribbon', 'confetti']) expect(spec(id).board).toEqual({ light: '#F3F6FF', dark: '#13111C' });
  });
});

describe('recipes: launch proportions and the README rules', () => {
  test.each(NEW.map(n => n[1]))('%s', id => {
    const s = spec(id);
    const bodyHalf = s.layers.find(l => l.kind === 'body')!.width / 2;
    expect(s.layers.find(l => l.kind === 'rim')!.width).toBe(.48);
    expect(bodyHalf * 2).toBe(.425);
    expect(s.head).toEqual(expect.objectContaining({ shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10 }));
    expect(s.tail.oneCell).toBe('none');
    expect(s.tail.kind).toBe('none');
    expect(slots(s)).toBeLessThanOrEqual(7);
    for (const l of s.layers) if (l.kind === 'shine' || l.kind === 'ribbon') {
      expect(l.offset ?? [0, 0]).toEqual([0, 0]);
      expect(l.amplitude ?? 0).toBe(0);
      expect(l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    }
    for (const l of s.layers) if (l.kind === 'spots') expect(Math.abs(l.sideOffset ?? 0) + l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    for (const l of s.layers) if (l.kind === 'bands') {
      expect(l.bandWidths).toHaveLength(l.bands!.length);
      expect(l.bandWidths!.every((w, i, a) => w < l.width && (i === 0 || w < a[i - 1]))).toBe(true);
    }
    expect(s.motion.particles.colours.length).toBeGreaterThanOrEqual(3);
  });
  test('defining features', () => {
    expect(spec('frosted-glass').head.shine).toBe(true); // contained head oval
    expect(spec('frosted-glass').layers.filter(l => l.kind === 'shine').map(l => l.colour)).toEqual(['#F7F4FF']);
    const gold = spec('golden-ribbon').layers;
    expect(gold.map(l => l.kind)).toEqual(['rim', 'body', 'bands', 'shine']); // inner gold band under the cream line
    expect(gold[2].bands).toEqual(['#FFDF8A']);
    expect(spec('golden-ribbon').head.shine).toBe(true);
    const confetti = spec('confetti').layers.filter(l => l.kind === 'spots');
    expect(confetti.map(l => l.colour)).toEqual(['#FFD24A', '#80C8BC']);
    expect(Math.sign(confetti[0].sideOffset!)).toBe(-Math.sign(confetti[1].sideOffset!));
    expect(spec('confetti').motion.particles.colours).toEqual(['#B8A4EB', '#FFD24A', '#80C8BC']);
    expect(spec('snowman')).toEqual(expect.objectContaining({ bodyPattern: 'beads', beads: { diameter: .48, pitch: .30, tubeWidth: .32 } }));
    expect(spec('snowman').face).toEqual(expect.objectContaining({ eyes: true, blush: true, anchor: 'head', ink: '#2B2B33', blushColour: '#F2A7B8' }));
    const flakes = spec('snowfall').layers.filter(l => l.kind === 'spots');
    expect(flakes.map(l => l.colour)).toEqual(['#FFFFFF', '#DCEBFF']);
    expect(flakes[0].width).toBeGreaterThan(flakes[1].width);
    expect(Math.sign(flakes[0].sideOffset!)).toBe(-Math.sign(flakes[1].sideOffset!));
    for (const id of ['snowman', 'snowfall']) expect(spec(id).motion.particles.colours).toEqual(['#FFFFFF', '#BFE3FF', '#DCEFFF']);
  });
});

describe('seasons', () => {
  test('New Year 12-01..01-15 and Winter 12-01..02-29, inclusive, wrapping the year', () => {
    expect(NEW_YEAR).toEqual({ id: 'new-year', name: 'New Year', start: '12-01', end: '01-15' });
    expect(WINTER).toEqual({ id: 'winter', name: 'Winter', start: '12-01', end: '02-29' });
    const cases: [Date, boolean, boolean][] = [
      [new Date(2026, 10, 30, 23, 59), false, false], [new Date(2026, 11, 1, 0, 0), true, true],
      [new Date(2026, 11, 31, 23, 59), true, true], [new Date(2027, 0, 1, 0, 0), true, true],
      [new Date(2027, 0, 15, 23, 59), true, true], [new Date(2027, 0, 16, 0, 0), false, true],
      [day(2027, 2, 28), false, true], [day(2028, 2, 29), false, true], [new Date(2028, 2, 1, 0, 0), false, false],
      [day(2027, 3, 1), false, false], [day(2027, 7, 1), false, false],
    ];
    for (const [date, ny, winter] of cases) expect([date.toDateString(), inSeason(NEW_YEAR, date), inSeason(WINTER, date)])
      .toEqual([date.toDateString(), ny, winter]);
    expect(seasonTitle(NEW_YEAR)).toBe('New Year · until 15 Jan');
    expect(seasonTitle(WINTER)).toBe('Winter · until 29 Feb');
  });
  test('catalogue: book-only, 20 petals, never free or on the path, 2–3 chips, in order after Halloween', () => {
    expect([...SEASONAL_REWARD_IDS].slice(5, 10)).toEqual([...NY_IDS, ...WINTER_IDS]);
    for (const [id, refId, name] of NEW) {
      const entry = REWARD_CATALOGUE.find(e => e.rewardId === id)!;
      expect(entry).toEqual(expect.objectContaining({ kind: 'skin', refId, name, pathCost: null, price: 20,
        season: NY_IDS.includes(id) ? NEW_YEAR : WINTER }));
      expect(entry.chips.length).toBeGreaterThanOrEqual(2);
      expect(entry.chips.length).toBeLessThanOrEqual(3);
      expect(seasonFor(id)).toBe(entry.season);
      expect(REWARD_PATH_IDS).not.toContain(id);
      expect(FREE_REWARD_IDS).not.toContain(id);
    }
  });
  test('visibility and visible counts; seasons off hides every seasonal style', () => {
    const ordinary = ARROW_STYLES.filter(s => !SEASONAL_REWARD_IDS.includes(s.numericId)).length;
    const none = () => false;
    const DEC = day(2026, 12, 10), LATE_JAN = day(2027, 1, 20), MAR = day(2027, 3, 1), OCT = day(2026, 10, 15);
    expect(visibleStyleCounts(none, true, DEC).total).toBe(ordinary + 8); // + CHRISTMAS-01's three
    expect(visibleStyleCounts(none, true, LATE_JAN).total).toBe(ordinary + 2);
    expect(visibleStyleCounts(none, true, MAR).total).toBe(ordinary);
    expect(visibleStyleCounts(none, true, OCT).total).toBe(ordinary + 5); // Halloween only
    for (const date of [DEC, LATE_JAN, OCT]) expect(visibleStyleCounts(() => true, false, date).total).toBe(ordinary);
    for (const id of [...NY_IDS, ...WINTER_IDS]) {
      expect(isStyleVisible(id, () => true, false, DEC)).toBe(false);
      expect(isStyleVisible(id, (n: number) => n === id, true, day(2027, 7, 1))).toBe(true); // owned forever
    }
    // owned out of season stays counted
    expect(visibleStyleCounts(n => n === 26, true, MAR)).toEqual({ owned: 1, total: ordinary + 1 });
    expect(HALLOWEEN.id).toBe('halloween');
  });
});

describe('ledger: purchase only in season, ownership kept', () => {
  function load() {
    jest.resetModules();
    return require('../rewardLedger') as typeof import('../rewardLedger');
  }
  const opts = { writable: true, totalSolved: 0, selectedNumericId: 0, book: true, seasons: true };
  test('in season: buys at 20 petals; insufficient petals is refused; out of season unavailable; owned stays', () => {
    const L = load(); const s = new Mem(); s.m.set('arrows_petals', 45);
    L.initializeRewardLedger(s, true, opts);
    expect(L.buyReward(24, day(2026, 12, 1))).toBe('bought');
    expect(L.buyReward(27, day(2027, 2, 28))).toBe('bought');
    expect(L.getRewardState()!.petals).toBe(5);
    expect(L.buyReward(25, day(2026, 12, 20))).toBe('insufficient'); // 5 < 20 petals
    expect(L.isRewardOwned(25)).toBe(false);
    s.m.set('arrows_petals', 99);
    const L2 = load(); L2.initializeRewardLedger(s, true, opts);
    expect(L2.buyReward(26, day(2027, 1, 16))).toBe('unavailable');
    expect(L2.buyReward(28, day(2027, 3, 1))).toBe('unavailable');
    expect(L2.isRewardOwned(24)).toBe(true);
    expect(L2.isRewardOwned(27)).toBe(true);
    expect(isStyleVisible(24, L2.isRewardOwned, true, day(2027, 6, 1))).toBe(true);
  });
  test('seasons off: unavailable even inside the window', () => {
    const L = load(); const s = new Mem(); s.m.set('arrows_petals', 99);
    L.initializeRewardLedger(s, true, { ...opts, seasons: false });
    for (const id of [...NY_IDS, ...WINTER_IDS]) expect(L.buyReward(id, day(2026, 12, 10))).toBe('unavailable');
  });
  test('buyReward and recordRewardClear default to seasonNow() (EXPO_PUBLIC_QA_DATE), not new Date()', () => {
    jest.resetModules();
    const seasonNow = jest.fn(() => day(2026, 12, 10));
    jest.doMock('../seasonClock', () => ({ seasonNow }));
    const L = require('../rewardLedger') as typeof import('../rewardLedger');
    const s = new Mem(); s.m.set('arrows_petals', 30);
    L.initializeRewardLedger(s, true, opts);
    expect(L.buyReward(26)).toBe('bought'); // the real clock (November in this suite's era) would be 'unavailable'
    expect(seasonNow).toHaveBeenCalled();
    seasonNow.mockClear();
    L.recordRewardClear('campaign', false);
    expect(seasonNow).toHaveBeenCalled();
    jest.dontMock('../seasonClock');
  });
});

describe('contrast: K4 outline, blocked, missed mark, overlay and picker rows', () => {
  const ids = NEW.map(n => n[1]);
  test('every required row passes on both actual boards (starting colours unchanged)', () => {
    const rows = skinContrastRows(ids.map(spec));
    expect(rows.filter(r => r.required && !r.pass).map(r => r.usage.id)).toEqual([]);
    for (const id of ids) for (const palette of ['Daylight', 'Ink Night'])
      for (const usage of ['outline-0', 'blocked', 'tint-arrow-missed-mark', 'tint-overlay-ink', 'tint-overlay-inkDim'])
        expect(rows.some(r => r.usage.id === `skin-${id}-${usage}` && r.palette === palette && r.required && r.pass)).toBe(true);
    const picker = skinPickerContrastRows().filter(r => ids.some(id => r.usage.id === `skin-picker-${id}-outline-0`));
    expect(picker).toHaveLength(10);
    expect(picker.every(r => r.pass)).toBe(true);
  });
});

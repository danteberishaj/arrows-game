// HALLOWEEN-PLUS shipped (owner pick 2026-10-06): concept Mummy A and Potion Slime B registered as Mummy 21 and
// Potion Slime 22, Halloween seasonal styles in the collection book at 20 petals.
import type { IntStore } from '../../core/saveSystem';
import { MASK_BITS } from '../../core/collection';
import { ARROW_STYLES, HALLOWEEN_BOARD, MUMMY, POTION_SLIME, SKIN_SPECS, SKIN_SPEC_JSON, type SkinLayer, type SkinSpec } from '../skinSpecs';
import { FREE_REWARD_IDS, HALLOWEEN, REWARD_CATALOGUE, REWARD_PATH_IDS, SEASONAL_REWARD_IDS, seasonFor } from '../rewardCatalogue';
import { skinContrastRows, skinPickerContrastRows } from '../contrastAudit';

const MUMMY_ID = 21, SLIME_ID = 22;
const spec = (id: string) => SKIN_SPECS[id] as SkinSpec;
const layers = (id: string, kind: SkinLayer['kind']) => spec(id).layers.filter(l => l.kind === kind);
const slots = (s: SkinSpec) => s.layers.reduce((n, l) => n + (l.kind === 'bands' || l.kind === 'lengthBands' ? l.bands!.length : 1), 0)
  + Number(s.face.eyes) + Number(s.face.blush);
const r3 = (n: number) => Number(n.toFixed(3));
const OCT = new Date(2026, 9, 7, 12), DEC = new Date(2026, 11, 10, 12);

class Mem implements IntStore {
  m = new Map<string, number>(); writes: string[] = [];
  getInt(k: string, d: number) { return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}

describe('registry: append-only ids after Candy Corn', () => {
  test('Mummy 21 and Potion Slime 22 with stable string ids; every earlier identity is unchanged', () => {
    expect([spec('mummy').numericId, spec('mummy').name, spec('potion-slime').numericId, spec('potion-slime').name])
      .toEqual([MUMMY_ID, 'Mummy', SLIME_ID, 'Potion Slime']);
    expect(ARROW_STYLES.map(s => s.numericId)).toEqual([...Array(23).keys()]);
    expect(ARROW_STYLES.slice(-3).map(s => s.id)).toEqual(['candy-corn', 'mummy', 'potion-slime']);
  });
  test('the save bits fit the existing owned masks: ids 21 and 22 are bits of arrows_rewards_owned_lo (0-29)', () => {
    for (const id of [MUMMY_ID, SLIME_ID]) expect(id).toBeLessThan(MASK_BITS);
  });
});

describe('the data is the contract-tested concept recipe (only id, numericId and name were chosen)', () => {
  test('Mummy (concept Mummy A): bandage tube, butt-capped wrap bar every .20 cell, dot eyes + peach blush', () => {
    const s = spec('mummy');
    expect(s.palette).toEqual({ rule: 'one', colours: [MUMMY.body] });
    expect(s.layers).toEqual([
      { kind: 'rim', colour: '#857563', width: .48 }, { kind: 'body', colour: 'palette', width: .425 },
      { kind: 'seam', colour: '#D5C7AE', width: .36, dash: [.03, .17], offset: [0, 0], cap: 'butt' },
    ]);
    expect(s.face).toEqual({ eyes: true, blush: true, closedOnBlocked: true, ink: '#3B2F33', blushColour: '#EDBDAE', anchor: 'head',
      eyeRadius: .042, eyeHalfGap: .13, mouthWidth: .07, blushSize: [.11, .06], blushOffset: [.12, .05], headOffset: -.12 });
    expect(s.face.eyeShape).toBeUndefined(); // dot eyes = the native default
    expect(s.motion.particles.colours).toEqual(['#F2EBDC', '#D5C7AE', '#857563']);
  });
  test('Potion Slime (concept Potion Slime B): lime body, glowing inner core (no halo), two bubble spot rows, no face', () => {
    const s = spec('potion-slime');
    expect(s.palette).toEqual({ rule: 'one', colours: [POTION_SLIME.lime] });
    expect(s.layers).toEqual([
      { kind: 'rim', colour: '#3F8A4A', width: .48 }, { kind: 'body', colour: 'palette', width: .425 },
      { kind: 'shine', colour: '#F1FFD9', width: .20, offset: [0, 0], opacity: .55, fadeCells: .7 },
      { kind: 'spots', colour: '#EFFFE0', width: .10, period: .62, sideOffset: .06, opacity: .9 },
      { kind: 'spots', colour: '#FFFFFF', width: .05, period: .41, sideOffset: -.09, opacity: .85 },
    ]);
    expect(layers('potion-slime', 'glow')).toEqual([]); // the halo variant (A) was not picked
    expect(s.face.eyes).toBe(false);
    expect(s.motion.particles.colours).toEqual(['#8EDB6A', '#B6F28F', '#FFFFFF']);
  });
  test.each(['mummy', 'potion-slime'])('%s: pack proportions, Halloween tints, no tail, safe bounds, ≤7 slots', id => {
    const s = spec(id);
    expect(s.board).toEqual(HALLOWEEN_BOARD);
    expect(HALLOWEEN_BOARD).toEqual({ light: '#F3EEFA', dark: '#221A36' });
    expect(s.head).toEqual(expect.objectContaining({ shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10 }));
    expect([s.tail.kind, s.tail.oneCell]).toEqual(['none', 'none']);
    expect(slots(s)).toBeLessThanOrEqual(7);
    const bodyHalf = layers(id, 'body')[0].width / 2;
    for (const l of s.layers.filter(l => ['shine', 'ribbon', 'seam'].includes(l.kind))) {
      expect(l.offset ?? [0, 0]).toEqual([0, 0]);
      expect(l.amplitude ?? 0).toBe(0);
    }
    for (const l of layers(id, 'seam')) { expect(l.width).toBeLessThanOrEqual(2 * bodyHalf - .06 + 1e-9); expect(l.dash).toHaveLength(2); }
    for (const l of layers(id, 'shine')) expect(l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    for (const l of layers(id, 'spots')) expect(Math.abs(l.sideOffset ?? 0) + l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    expect(JSON.parse(SKIN_SPEC_JSON[id])).toEqual(s);
  });
});

describe('catalogue: Halloween seasonal, book-only, 20 petals (as Pumpkin, Ghost and Candy Corn)', () => {
  test('two more Halloween entries in catalogue order', () => {
    expect([...SEASONAL_REWARD_IDS]).toEqual([18, 19, 20, MUMMY_ID, SLIME_ID]);
    for (const [id, refId, name] of [[MUMMY_ID, 'mummy', 'Mummy'], [SLIME_ID, 'potion-slime', 'Potion Slime']] as const) {
      const entry = REWARD_CATALOGUE.find(e => e.rewardId === id)!;
      expect(entry).toEqual(expect.objectContaining({ kind: 'skin', refId, name, pathCost: null, price: 20, season: HALLOWEEN }));
      expect(entry.chips).toHaveLength(3);
      expect(seasonFor(id)).toBe(HALLOWEEN);
      expect(REWARD_PATH_IDS).not.toContain(id);
      expect(FREE_REWARD_IDS).not.toContain(id);
    }
  });
  test('ledger: buying Mummy in season costs 20 petals and sets bit 21 in the existing owned_lo key only', () => {
    jest.resetModules();
    const L = require('../rewardLedger') as typeof import('../rewardLedger');
    const s = new Mem(); s.m.set('arrows_petals', 30);
    L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true, seasons: true });
    s.writes.length = 0;
    expect(L.buyReward(SLIME_ID, DEC)).toBe('unavailable');
    expect(s.writes).toEqual([]);
    expect(L.buyReward(MUMMY_ID, OCT)).toBe('bought');
    expect(L.getRewardState()!.petals).toBe(10);
    expect(s.m.get('arrows_rewards_owned_lo')! & (1 << MUMMY_ID)).toBe(1 << MUMMY_ID);
    expect(s.m.get('arrows_rewards_owned_hi')).toBe(0);
    expect([...new Set(s.writes)].sort()).toEqual(['arrows_petals', 'arrows_rewards_owned_hi', 'arrows_rewards_owned_lo']);
  });
});

describe('K4 contrast (real audit) on both Halloween tints', () => {
  const rows = skinContrastRows([spec('mummy'), spec('potion-slime')]);
  const ratio = (id: string, usage: string, theme: 'Daylight' | 'Ink Night') =>
    r3(rows.find(r => r.palette === theme && r.usage.id === `skin-${id}-${usage}`)!.ratio);
  test('every required row passes; the outline rows are required and ≥3:1 on both themes', () => {
    expect(rows.filter(r => r.required && !r.pass)).toEqual([]);
    const outline = rows.filter(r => r.usage.id.includes('-outline-'));
    expect(outline).toHaveLength(4);
    expect(outline.every(r => r.required && r.ratio >= 3)).toBe(true);
    expect(rows.filter(r => r.palette === 'Ink Night' && r.usage.kind !== 'text').every(r => r.bg === '#221A36')).toBe(true);
  });
  test('pinned ratios (quoted in docs/next-level/reports/HALLOWEEN-PLUS-concepts.md, "Shipped 2026-10-07")', () => {
    expect([ratio('mummy', 'outline-0', 'Daylight'), ratio('mummy', 'outline-0', 'Ink Night')]).toEqual([3.901, 3.721]);
    expect([ratio('potion-slime', 'outline-0', 'Daylight'), ratio('potion-slime', 'outline-0', 'Ink Night')]).toEqual([3.725, 3.897]);
    for (const id of ['mummy', 'potion-slime']) {
      expect([ratio(id, 'tint-arrow-missed-mark', 'Daylight'), ratio(id, 'tint-arrow-missed-mark', 'Ink Night')]).toEqual([5.401, 3.196]);
      expect([ratio(id, 'blocked', 'Daylight'), ratio(id, 'blocked', 'Ink Night')]).toEqual([3.647, 4.696]);
    }
  });
  test('picker thumbnails: the rim clears the panel surface on both themes', () => {
    const picker = skinPickerContrastRows().filter(r => /skin-picker-(mummy|potion-slime)-/.test(r.usage.id));
    expect(picker).toHaveLength(4);
    expect(picker.every(r => r.pass)).toBe(true);
  });
});

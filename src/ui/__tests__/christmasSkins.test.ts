// CHRISTMAS-01 (owner 2026-11-18): Candy Cane 29, Gingerbread 30, Fairy Lights 31; book-only, 20 petals, 1 Dec – 7 Jan.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ARROW_STYLES, SKIN_SPECS, SKIN_SPEC_JSON, type SkinSpec } from '../skinSpecs';
import { CHRISTMAS, REWARD_CATALOGUE, REWARD_PATH_IDS, FREE_REWARD_IDS, isStyleVisible } from '../rewardCatalogue';
import { inSeason } from '../seasons';
import { skinContrastRows, skinPickerContrastRows } from '../contrastAudit';

const FROZEN = JSON.parse(readFileSync(join(__dirname, 'winterSkins.frozen.json'), 'utf8')) as { specJson: Record<string, string> };
const NEW = [[29, 'candy-cane', 'Candy Cane'], [30, 'gingerbread', 'Gingerbread'], [31, 'fairy-lights', 'Fairy Lights']] as const;
const spec = (id: string) => SKIN_SPECS[id] as SkinSpec;

test('appended after Snowfall 28; earlier native payloads byte-identical', () => {
  expect(ARROW_STYLES.slice(-3).map(s => [s.numericId, s.id, s.name])).toEqual(NEW.map(n => [...n]));
  for (const [id, hash] of Object.entries(FROZEN.specJson))
    expect([id, createHash('sha256').update(SKIN_SPEC_JSON[id]).digest('hex')]).toEqual([id, hash]);
});

test('launch proportions, Winter board (in-game snowfall), accents inside the body', () => {
  for (const [, id] of NEW) {
    const s = spec(id), bodyHalf = .425 / 2;
    expect(s.layers.slice(0, 2).map(l => [l.kind, l.width])).toEqual([['rim', .48], ['body', .425]]);
    expect(s.board).toEqual({ light: '#EEF4FB', dark: '#121A2B', decor: 'snow' });
    expect(SKIN_SPEC_JSON[id]).not.toContain('decor');
    for (const l of s.layers) if (l.kind === 'spots') expect(Math.abs(l.sideOffset ?? 0) + l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    expect(s.motion.particles.colours.length).toBeGreaterThanOrEqual(3);
  }
  expect(spec('candy-cane').layers[2]).toEqual(expect.objectContaining({ kind: 'seam', cap: 'butt', colour: '#E0384A' }));
  expect(spec('gingerbread').face).toEqual(expect.objectContaining({ eyes: true, anchor: 'head' }));
  expect(spec('fairy-lights').layers.filter(l => l.kind === 'spots')).toHaveLength(3);
});

test('season 1 Dec – 7 Jan inclusive; book-only at 20 petals; owned forever', () => {
  const cases: [Date, boolean][] = [[new Date(2026, 10, 30, 23, 59), false], [new Date(2026, 11, 1), true],
    [new Date(2026, 11, 25, 12), true], [new Date(2027, 0, 7, 23, 59), true], [new Date(2027, 0, 8), false]];
  for (const [d, want] of cases) expect([d.toDateString(), inSeason(CHRISTMAS, d)]).toEqual([d.toDateString(), want]);
  for (const [id, refId, name] of NEW) {
    expect(REWARD_CATALOGUE.find(e => e.rewardId === id)).toEqual(expect.objectContaining({ refId, name, price: 20, pathCost: null, season: CHRISTMAS }));
    expect(REWARD_PATH_IDS).not.toContain(id); expect(FREE_REWARD_IDS).not.toContain(id);
    expect(isStyleVisible(id, () => false, true, new Date(2027, 1, 1))).toBe(false);
    expect(isStyleVisible(id, n => n === id, true, new Date(2027, 6, 1))).toBe(true);
  }
});

test('K4 outline and picker rows pass on both boards', () => {
  const ids = NEW.map(n => n[1]);
  expect(skinContrastRows(ids.map(spec)).filter(r => r.required && !r.pass).map(r => r.usage.id)).toEqual([]);
  const picker = skinPickerContrastRows().filter(r => ids.some(id => r.usage.id === `skin-picker-${id}-outline-0`));
  expect(picker).toHaveLength(6);
  expect(picker.every(r => r.pass)).toBe(true);
});

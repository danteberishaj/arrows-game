// src/ui/__tests__/halloweenSkins.test.ts — HALLOWEEN-01 Part B: the pack's registry data and new general fields.
import { ARROW_STYLES, HALLOWEEN_BRIEF_DARK_TINT, SKIN_SPECS, SKIN_SPEC_JSON, type SkinSpec } from '../skinSpecs';
import { contrastRatio, skinContrastRows } from '../contrastAudit';

const pack = ['pumpkin', 'ghost', 'candy-corn'];
const spec = (id: string) => SKIN_SPECS[id] as SkinSpec;
const layer = (id: string, kind: string) => spec(id).layers.find(l => l.kind === kind)!;
const slots = (s: SkinSpec) => s.layers.reduce((n, l) => n + (l.kind === 'bands' || l.kind === 'lengthBands' ? l.bands!.length : 1), 0)
  + Number(s.face.eyes) + Number(s.face.blush);

test('append-only ids 18/19/20 after Strawberry Glazed; the 18 existing identities are untouched', () => {
  expect(pack.map(id => [spec(id).numericId, spec(id).name])).toEqual([[18, 'Pumpkin'], [19, 'Ghost'], [20, 'Candy Corn']]);
  // HALLOWEEN-PLUS appended Mummy 21 and Potion Slime 22 after the pack (halloweenPlusShipped.test.ts).
  expect(ARROW_STYLES.slice(-5, -2).map(s => s.id)).toEqual(pack);
  expect(new Set(ARROW_STYLES.map(s => s.numericId)).size).toBe(ARROW_STYLES.length);
});

test('concept colours, launch proportions, light board tint and no one-cell tail', () => {
  expect([layer('pumpkin', 'rim').colour, layer('ghost', 'rim').colour, layer('candy-corn', 'rim').colour]).toEqual(['#9A633F', '#8C7BB5', '#8C7BB5']);
  expect(spec('pumpkin').palette.colours).toEqual(['#FF8A2A']); // HALLOWEEN-01b: orange tube, deep-orange ribs
  expect(layer('pumpkin', 'tailFill').colour).toBe('#6BAA4F');
  expect(spec('ghost').palette.colours).toEqual(['#E9E2F5']);
  expect(layer('ghost', 'shine').colour).toBe('#F7F4FF');
  expect(spec('ghost').face.blushColour).toBe('#D9CFEA');
  for (const id of pack) {
    expect(spec(id).board!.light).toBe('#F3EEFA');
    expect([layer(id, 'rim').width, layer(id, 'body').width]).toEqual([.48, .425]);
    expect(spec(id).head).toEqual(expect.objectContaining({ shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10 }));
    expect(spec(id).tail.oneCell).toBe('none');
    expect(slots(spec(id))).toBeLessThanOrEqual(7);
    expect(JSON.parse(SKIN_SPEC_JSON[id])).toEqual(spec(id));
  }
  expect(spec('pumpkin').tail).toEqual(expect.objectContaining({ kind: 'dot' }));
  expect(spec('ghost').tail.kind).toBe('none');
  expect(spec('candy-corn').tail.kind).toBe('none');
});

test('beads make the ghost waves (no new bead-shape field); Pumpkin is a smooth tube (HALLOWEEN-01b)', () => {
  expect(spec('pumpkin').bodyPattern ?? 'tube').toBe('tube');
  expect(spec('pumpkin').beads).toBeUndefined();
  expect(spec('ghost').bodyPattern).toBe('beads');
  expect(spec('critter').bodyPattern).toBe('beads');
  // Ghost: a small bead/tube difference (soft waves).
  const g = spec('ghost').beads!;
  expect(g.diameter - (g.tubeWidth + .055)).toBeGreaterThan(0);
  expect(g.diameter - (g.tubeWidth + .055)).toBeLessThanOrEqual(.12);
});

test('face eye shapes: Pumpkin triangles, Ghost arcs; every other spec keeps the default dots', () => {
  expect(spec('pumpkin').face.eyeShape).toBe('triangle');
  expect(spec('ghost').face.eyeShape).toBe('arc');
  expect(spec('pumpkin').face.anchor).toBe('head');
  expect(spec('ghost').face.anchor).toBe('head');
  expect(spec('candy-corn').face.eyes).toBe(false);
  for (const s of Object.values(SKIN_SPECS).filter(s => !pack.includes(s.id))) expect(s.face.eyeShape).toBeUndefined();
});

test('Candy Corn: length bands yellow → orange → white (tail → head), nested heads strictly shrinking', () => {
  const bands = layer('candy-corn', 'lengthBands');
  expect(bands.bands).toEqual(['#FFD24A', '#FF8A2A', '#FFF8E8']);
  expect(bands.width).toBe(.425);
  const widths = bands.bandWidths!;
  expect(widths).toHaveLength(3);
  expect(widths[0]).toBeLessThanOrEqual(bands.width);
  for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
  expect(spec('candy-corn').palette.colours).toEqual(['#FFD24A']); // the body under the tail cap matches the first band
  for (const s of Object.values(SKIN_SPECS).filter(s => s.id !== 'candy-corn')) expect(s.layers.some(l => l.kind === 'lengthBands')).toBe(false);
});

test('K4 outline: the brief ratios on the light tint and on its dark tint; registered dark board passes too', () => {
  const r = (fg: string, bg: string) => Number(contrastRatio(fg, bg).toFixed(2));
  expect([r('#9A633F', '#F3EEFA'), r('#9A633F', HALLOWEEN_BRIEF_DARK_TINT)]).toEqual([4.35, 3.04]);
  expect([r('#8C7BB5', '#F3EEFA'), r('#8C7BB5', HALLOWEEN_BRIEF_DARK_TINT)]).toEqual([3.28, 4.04]);
  const rows = skinContrastRows(pack.map(spec));
  expect(rows.filter(row => row.required && !row.pass)).toEqual([]);
  expect(rows.filter(row => row.usage.id.includes('-outline-')).every(row => row.required && row.ratio >= 3)).toBe(true);
});

describe('HALLOWEEN-01b owner rulings', () => {
  test('dark tint #221A36 for all three, and it passes every required K4/tint row', () => {
    for (const id of pack) expect(spec(id).board).toEqual({ light: '#F3EEFA', dark: '#221A36' });
    const rows = skinContrastRows(pack.map(spec));
    expect(rows.filter(r => r.required && !r.pass)).toEqual([]);
    const night = (id: string, usage: string) => rows.find(r => r.palette === 'Ink Night' && r.usage.id === `skin-${id}-${usage}`)!;
    expect(night('pumpkin', 'tint-arrow-missed-mark').bg).toBe('#221A36');
    expect(night('pumpkin', 'tint-arrow-missed-mark').ratio).toBeGreaterThanOrEqual(3);
    expect(night('pumpkin', 'outline-0').ratio).toBeGreaterThanOrEqual(3);
    expect(night('ghost', 'outline-0').ratio).toBeGreaterThanOrEqual(3);
    expect(night('candy-corn', 'outline-0').ratio).toBeGreaterThanOrEqual(3);
  });
  test('Pumpkin ribs: a butt-capped dashed deep-orange seam across the tube (one general field: layer.cap)', () => {
    const ribs = layer('pumpkin', 'seam');
    expect(ribs.colour).toBe('#E0661B');
    expect(ribs.cap).toBe('butt');
    expect(ribs.dash).toHaveLength(2);
    expect(ribs.dash![0]).toBeLessThan(ribs.dash![1]); // thin ribs, wide segments
    expect(ribs.width).toBeLessThanOrEqual(layer('pumpkin', 'body').width - .06); // within the accent inset
    expect(ribs.offset ?? [0, 0]).toEqual([0, 0]);
    expect(spec('pumpkin').layers.some(l => l.kind === 'spots' || l.kind === 'headFill')).toBe(false);
    // HALLOWEEN-PLUS: Mummy's wraps reuse the same general field (owner pick 2026-10-06); every other spec keeps round caps.
    for (const s of Object.values(SKIN_SPECS).filter(s => s.id !== 'pumpkin' && s.id !== 'mummy')) expect(s.layers.some(l => l.cap !== undefined)).toBe(false);
  });
  test('Pumpkin stem only on arrows of 4+ cells (one general field: tail.minCells); others keep the default', () => {
    expect(spec('pumpkin').tail).toEqual(expect.objectContaining({ kind: 'dot', minCells: 4, oneCell: 'none' }));
    expect(layer('pumpkin', 'tailFill').colour).toBe('#6BAA4F');
    for (const s of Object.values(SKIN_SPECS).filter(s => s.id !== 'pumpkin')) expect(s.tail.minCells).toBeUndefined();
  });
  test('Pumpkin face: bigger triangle eyes (.045 -> .065 radius, .13 -> .14 half-gap)', () => {
    expect(spec('pumpkin').face).toEqual(expect.objectContaining({ eyeShape: 'triangle', eyeRadius: .065, eyeHalfGap: .14, anchor: 'head' }));
    expect(spec('ghost').face).toEqual(expect.objectContaining({ eyeRadius: .045, eyeHalfGap: .13 }));
  });
});

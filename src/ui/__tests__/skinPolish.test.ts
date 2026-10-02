import { SKIN_SPECS } from '../skinSpecs';
import { skinContrastRows } from '../contrastAudit';
import { skinBoardPalette } from '../skinBoardPalette';
import { Daylight, InkNight } from '../theme';

const ids = ['cinnamon', 'sherbet', 'candy-gloss', 'jelly', 'critter', 'rainbow-ribbon', 'campfire', 'strawberry-glazed'];
describe('ART08 launch polish', () => {
  it.each(ids)('%s has a chunky shaft and a rounded directional head', id => {
    const spec = SKIN_SPECS[id] as any;
    const rim = spec.layers.find((l: any) => l.kind === 'rim').width;
    const body = spec.layers.find((l: any) => l.kind === 'body').width;
    expect(rim).toBeGreaterThanOrEqual(.46); expect(rim).toBeLessThanOrEqual(.50);
    expect(rim - body).toBeGreaterThanOrEqual(.049999); expect(rim - body).toBeLessThanOrEqual(.060001);
    expect(spec.head.halfWidth).toBe(.44); expect(spec.head.cornerRadius).toBeGreaterThanOrEqual(.10);
    expect(2 * Math.atan(spec.head.halfWidth / (spec.head.tipPastCentre + spec.head.back)) * 180 / Math.PI).toBeLessThanOrEqual(80);
  });
  it.each(['cinnamon','critter','campfire','strawberry-glazed'])('%s declares legible face sizes', id => {
    const face = SKIN_SPECS[id].face as any;
    expect(face.eyeRadius).toBe(.045); expect(face.eyeHalfGap).toBe(.13);
    expect(face.mouthWidth).toBe(.12); expect(face.blushSize).toEqual([.11,.06]);
  });
  it('Critter declares connected half-cell beads and a substantial spine', () => {
    expect((SKIN_SPECS.critter as any).beads).toEqual({diameter:.52, pitch:.5, tubeWidth:.30});
  });
  it.each(ids)('%s audits its board tint and existing feedback/HUD roles', id => {
    expect((SKIN_SPECS[id] as any).board).toBeDefined();
    const rows=skinContrastRows([SKIN_SPECS[id]]);
    expect(rows.filter(r=>r.usage.id.includes('-tint-')).length).toBeGreaterThan(0);
    expect(rows.filter(r=>r.required).every(r=>r.pass)).toBe(true);
  });
  it('rejects a tint matching the outline rather than lowering K4', () => {
    const spec = SKIN_SPECS.cinnamon;
    const rim = spec.layers.find(layer => layer.kind === 'rim')!;
    const broken = { ...spec, board: { light: rim.colour, dark: rim.colour } };
    const rows = skinContrastRows([broken]);
    expect(rows.some(row => row.required && !row.pass && row.usage.id.includes('outline'))).toBe(true);
  });
  it('uses the resolved selection and theme immediately, preserving every other palette role', () => {
    for (const [palette, dark] of [[Daylight, false], [InkNight, true]] as const) {
      expect(skinBoardPalette(palette, null, dark)).toBe(palette);
      expect(skinBoardPalette(palette, SKIN_SPECS['ink-pro'], dark)).toBe(palette);
      for (const id of ids) {
        const spec = SKIN_SPECS[id];
        const selected = skinBoardPalette(palette, spec, dark);
        expect(selected.bg).toBe(spec.board![dark ? 'dark' : 'light']);
        expect({ ...selected, bg: palette.bg }).toEqual(palette);
      }
    }
  });
});

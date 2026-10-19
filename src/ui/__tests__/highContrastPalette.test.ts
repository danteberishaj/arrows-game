/**
 * TF-02 A (META_HIGH_CONTRAST, owner 2026-10-13): when the phone's own high-contrast setting is on, the app draws
 * high-contrast variants of BOTH palettes. `paletteFor` is the one pure function that decides the palette; the
 * targets are measured over the contrast audit's own rows (`scripts/contrast-audit-hc.ts` prints the table):
 *   - every `text` row >= 7:1 (WCAG AAA), or >= 4.5:1 for large text (>= 24 px, or >= 18.66 px bold);
 *   - every `graphic` / `boundary` row >= 4.5:1 (a W5-05 panel edge passes when one of its alternatives does);
 *   - and the existing audit (its AA gates and panel edges) still passes.
 */
import {
  HIGH_CONTRAST_PALETTES,
  PALETTES,
  USAGES,
  audit,
  highContrastRows,
  highContrastTarget,
  panelEdges,
} from '../contrastAudit';
import {
  Daylight,
  DaylightHighContrast,
  InkNight,
  InkNightHighContrast,
  paletteFor,
  type Palette,
} from '../theme';

describe('paletteFor: the one function that picks the palette', () => {
  it('keeps the one-argument form every existing caller uses (the same objects as before)', () => {
    expect(paletteFor(false)).toBe(Daylight);
    expect(paletteFor(true)).toBe(InkNight);
  });

  it('high contrast off gives the normal palettes', () => {
    expect(paletteFor(false, false)).toBe(Daylight);
    expect(paletteFor(true, false)).toBe(InkNight);
  });

  it('high contrast on gives the high-contrast variant of the chosen theme', () => {
    expect(paletteFor(false, true)).toBe(DaylightHighContrast);
    expect(paletteFor(true, true)).toBe(InkNightHighContrast);
  });

  it('the high-contrast palettes have every token and keep the backgrounds and ink (colour tokens only)', () => {
    const keys = (p: Palette) => Object.keys(p).sort();
    expect(keys(DaylightHighContrast)).toEqual(keys(Daylight));
    expect(keys(InkNightHighContrast)).toEqual(keys(InkNight));
    for (const [hc, base] of [[DaylightHighContrast, Daylight], [InkNightHighContrast, InkNight]] as const) {
      expect([hc.bg, hc.surface, hc.ink]).toEqual([base.bg, base.surface, base.ink]);
    }
  });
});

describe('the measured target', () => {
  it('targets: text 7 (large 4.5), graphic and boundary 4.5', () => {
    expect(highContrastTarget({ kind: 'text', sizePx: 16, weight: 'bold' })).toBe(7);
    expect(highContrastTarget({ kind: 'text', sizePx: 18, weight: 'bold' })).toBe(7);
    expect(highContrastTarget({ kind: 'text', sizePx: 19, weight: 'bold' })).toBe(4.5);
    expect(highContrastTarget({ kind: 'text', sizePx: 22, weight: 'semibold' })).toBe(7);
    expect(highContrastTarget({ kind: 'text', sizePx: 24, weight: 'semibold' })).toBe(4.5);
    expect(highContrastTarget({ kind: 'graphic' })).toBe(4.5);
    expect(highContrastTarget({ kind: 'boundary' })).toBe(4.5);
  });

  it('the HC palettes are the audit\'s high-contrast set, one per theme', () => {
    expect(HIGH_CONTRAST_PALETTES.map((x) => x.palette)).toEqual([DaylightHighContrast, InkNightHighContrast]);
  });

  it('covers every audit row for both HC palettes', () => {
    expect(highContrastRows()).toHaveLength(USAGES.length * 2);
  });

  for (const row of highContrastRows()) {
    it(`${row.palette} / ${row.usage.id}: ${row.fg} on ${row.bg} = ${row.ratio.toFixed(2)} >= ${row.target}`, () => {
      expect(row.meets).toBe(true);
    });
  }

  it('the normal palettes do NOT meet it (the instrument can fail: a positive control)', () => {
    expect(highContrastRows(PALETTES).filter((r) => !r.meets).length).toBeGreaterThan(0);
  });
});

describe('the existing audit still passes with the high-contrast palettes', () => {
  it('every AA gate', () => {
    const failed = audit(HIGH_CONTRAST_PALETTES).filter((r) => !r.pass);
    expect(failed.map((r) => `${r.palette}/${r.usage.id} ${r.ratio.toFixed(2)} < ${r.gate}`)).toEqual([]);
  });

  it('every W5-05 panel edge', () => {
    expect(panelEdges(HIGH_CONTRAST_PALETTES).filter((e) => !e.pass)).toEqual([]);
  });

  it('the default audit is still the two normal palettes', () => {
    expect(new Set(audit().map((r) => r.palette))).toEqual(new Set(['Daylight', 'Ink Night']));
  });
});

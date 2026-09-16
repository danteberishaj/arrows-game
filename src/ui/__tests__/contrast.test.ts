import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PALETTES,
  USAGES,
  type Role,
  audit,
  composite,
  contrastRatio,
  gateFor,
  hexToHsl,
  hslToHex,
  relativeLuminance,
  solveLightness,
} from '../contrastAudit';

const ROOT = join(__dirname, '..', '..', '..');

describe('contrast maths (WCAG 2.x reference values)', () => {
  it('white and black luminance', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
  });

  it('black on white is 21:1 and the ratio is symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 6);
  });

  it('#767676 on white is the classic 4.54:1 AA pass', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('composite blends per 8-bit channel', () => {
    expect(composite('#000000', 0.45, '#FFFFFF')).toBe('#8C8C8C');
    expect(composite('#FF0000', 1, '#00FF00')).toBe('#FF0000');
    expect(composite('#FF0000', 0, '#00FF00')).toBe('#00FF00');
  });

  it('HSL round-trips a palette colour', () => {
    expect(hslToHex(hexToHsl('#6D4AEF'))).toBe('#6D4AEF');
  });

  it('gate: text large at 24 regular or 18.66 bold; SemiBold is not bold; graphics 3:1', () => {
    expect(gateFor({ kind: 'text', sizePx: 18, weight: 'bold' })).toBe(4.5);
    expect(gateFor({ kind: 'text', sizePx: 19, weight: 'bold' })).toBe(3);
    expect(gateFor({ kind: 'text', sizePx: 22, weight: 'semibold' })).toBe(4.5);
    expect(gateFor({ kind: 'text', sizePx: 24, weight: 'semibold' })).toBe(3);
    expect(gateFor({ kind: 'graphic' })).toBe(3);
    expect(gateFor({ kind: 'boundary' })).toBe(3);
  });

  it('solver keeps hue and saturation and reaches the gate', () => {
    const sol = solveLightness('#8F76F0', ['#FFFFFF'], 4.5)!;
    expect(sol.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(sol.to, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(sol.toHsl.h - sol.fromHsl.h)).toBeLessThan(1);
    expect(Math.abs(sol.toHsl.s - sol.fromHsl.s)).toBeLessThan(1);
    expect(sol.deltaL).toBeLessThan(0);
  });
});

describe('every usage row names a real site', () => {
  const lineAt = (site: string) => {
    const [file, line] = site.split(':');
    return readFileSync(join(ROOT, file), 'utf8').split('\n')[Number(line) - 1] ?? '';
  };

  it.each(USAGES.map((u) => [u.id, u] as const))('%s', (_id, u) => {
    expect(lineAt(u.site)).toMatch(new RegExp(`\\.${u.fgRole}\\b`));
    if (u.kind === 'text' && u.sizeSite) {
      expect(lineAt(u.sizeSite)).toMatch(new RegExp(`fontSize: ${u.sizePx}\\b`));
    }
  });
});

/**
 * No new hue (W0-06 acceptance 6): every token W0-06 changed or split keeps the HSL hue and
 * saturation of the token it came from; only lightness moved. Tolerances cover 8-bit rounding
 * (the solver prints the exact values).
 */
const PRE_W006 = {
  Daylight: { border: '#E0DCEF', accent: '#6D4AEF', heart: '#E4327D', heartLost: '#DBD7ED', inkDim: '#6E6A8A' },
  'Ink Night': { border: '#2B2841', accent: '#7C5CF5', heart: '#F0468C', heartLost: '#3B3653', inkDim: '#A29DC1' },
} as const;
const DERIVED_FROM: Array<[Role, keyof (typeof PRE_W006)['Daylight']]> = [
  ['border', 'border'],
  ['accent', 'accent'],
  ['inkDim', 'inkDim'],
  ['heartLost', 'heartLost'],
  ['glyphOff', 'heartLost'],
  ['pipSpent', 'heartLost'],
  ['starUnearned', 'heartLost'],
  ['accentText', 'accent'],
  ['heartText', 'heart'],
];

describe('changed tokens keep hue and saturation', () => {
  for (const { name, palette } of PALETTES) {
    const before = PRE_W006[name as keyof typeof PRE_W006];
    it.each(DERIVED_FROM)(`${name} / %s (from %s)`, (role, source) => {
      const now = hexToHsl(palette[role]);
      const was = hexToHsl(before[source]);
      const dh = Math.abs(((now.h - was.h + 540) % 360) - 180);
      expect(dh).toBeLessThanOrEqual(1);
      expect(Math.abs(now.s - was.s)).toBeLessThanOrEqual(1);
    });
  }
});

describe('every text and state colour meets its gate', () => {
  for (const row of audit()) {
    const name = `${row.palette} / ${row.usage.id}`;
    it(`${name}: ${row.usage.fgRole} ${row.fg} on ${row.usage.bgRole} ${row.bg} >= ${row.gate}`, () => {
      expect(row.ratio).toBeGreaterThanOrEqual(row.gate);
    });
  }
});

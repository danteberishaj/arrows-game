import { readFileSync } from 'fs';
import { join } from 'path';
import {
  USAGES,
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
 * Pre-fix failure record (instrument commit). These rows fail on the unfixed tokens; they are
 * marked `it.failing` so the suite stays green and the failure stays visible. The fix commit
 * deletes this set, so every row must then pass.
 */
const PRE_FIX_FAILING = new Set([
  'Daylight / header-glyph-off',
  'Daylight / header-button-hairline',
  'Daylight / header-button-hairline-on-bg',
  'Daylight / home-tier-super-hard',
  'Daylight / game-level',
  'Daylight / game-tier-super-hard',
  'Daylight / heart-pip-spent',
  'Daylight / star-unearned',
  'Daylight / panel-subline',
  'Daylight / continue-label-disabled',
  'Daylight / retry-label',
  'Daylight / retry-outline',
  'Daylight / panel-hairline',
  'Daylight / streak-line',
  'Ink Night / header-glyph-off',
  'Ink Night / header-button-hairline',
  'Ink Night / header-button-hairline-on-bg',
  'Ink Night / home-tier-hard',
  'Ink Night / game-tier-hard',
  'Ink Night / heart-pip-spent',
  'Ink Night / star-unearned',
  'Ink Night / continue-label',
  'Ink Night / continue-label-disabled',
  'Ink Night / next-level-label',
  'Ink Night / retry-outline',
  'Ink Night / panel-hairline',
]);

describe('every text and state colour meets its gate', () => {
  for (const row of audit()) {
    const name = `${row.palette} / ${row.usage.id}`;
    const test = PRE_FIX_FAILING.has(name) ? it.failing : it;
    test(`${name}: ${row.usage.fgRole} ${row.fg} on ${row.usage.bgRole} ${row.bg} >= ${row.gate}`, () => {
      expect(row.ratio).toBeGreaterThanOrEqual(row.gate);
    });
  }
});

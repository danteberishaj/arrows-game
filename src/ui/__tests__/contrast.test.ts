import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PALETTES,
  USAGES,
  type Role,
  audit,
  auditUsage,
  composite,
  compositeScrim,
  contrastRatio,
  gateFor,
  hexToHsl,
  hslToHex,
  panelEdges,
  parseScrim,
  relativeLuminance,
  scrimInfo,
  solveLightness,
} from '../contrastAudit';
import { Type, type TypeRole } from '../theme';

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
      // A literal `fontSize: N`, or (W5-08) a `Type.<role>` token of that size.
      const line = lineAt(u.sizeSite);
      const token = /\bType\.(\w+)/.exec(line);
      if (token) {
        expect(Object.keys(Type)).toContain(token[1]);
        expect(Type[token[1] as TypeRole].fontSize).toBe(u.sizePx);
      } else {
        expect(line).toMatch(new RegExp(`fontSize: ${u.sizePx}\\b`));
      }
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
  // W5-05's panel-edge rows are alternatives (fill OR hairline): gated per edge below.
  for (const row of audit().filter((r) => !r.usage.edge)) {
    const name = `${row.palette} / ${row.usage.id}`;
    it(`${name}: ${row.usage.fgRole} ${row.fg} on ${row.usage.bgRole} ${row.bg} >= ${row.gate}`, () => {
      expect(row.ratio).toBeGreaterThanOrEqual(row.gate);
    });
  }
});

/**
 * W5-05 (ART_PANEL_DEPTH_ENABLED): the win / lose panel's EDGE against its scrim composited over `bg` exactly as
 * rendered (8-bit alpha, per channel). The gate is 3:1: WCAG 2.1 SC 1.4.11's non-text threshold, applied BY ANALOGY
 * to a panel edge. The edge passes when the fill (`surfaceRaised`) meets it against the composited scrim, OR the
 * `border` hairline meets it against both the composited scrim and the fill.
 */
describe('W5-05 panel edge against the composited scrim (flag-ON tokens)', () => {
  const EDGES = ['panel-edge-won', 'panel-edge-lost'];

  it('the rows exist for both outcomes and both alternatives', () => {
    for (const edge of EDGES) {
      const rows = USAGES.filter((u) => u.edge?.id === edge);
      expect(rows.map((u) => u.edge!.via).sort()).toEqual(['fill', 'hairline', 'hairline']);
      expect(rows.every((u) => u.kind === 'boundary' && gateFor(u) === 3)).toBe(true);
    }
  });

  for (const { name, palette } of PALETTES) {
    it.each(EDGES)(`${name} / %s reaches 3:1 by the fill or by the hairline`, (edge) => {
      const e = panelEdges().find((x) => x.palette === name && x.edge === edge)!;
      const detail = e.rows.map((r) => `${r.usage.id} ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}`).join('; ');
      if (!e.pass) throw new Error(`${name} ${edge}: no alternative reaches 3:1 (${detail})`);
      expect(['fill', 'hairline']).toContain(e.via);
    });
  }

  it('the scrim is composited over bg per 8-bit channel, as RN draws #RRGGBBAA', () => {
    expect(parseScrim('#00000073')).toEqual({ colour: '#000000', alpha: 115 / 255 });
    expect(compositeScrim('#00000073', '#FFFFFF')).toBe('#8C8C8C'); // today's rgba(0,0,0,0.45) over Daylight bg
    expect(compositeScrim('#FFFFFFDB', '#FFFFFF')).toBe('#FFFFFF'); // bg at 0.86 over bg is bg
    expect(() => parseScrim('#000000')).toThrow();
  });

  it('the panel content rows gated on `surface` also pass on `surfaceRaised` (the flag-ON panel fill)', () => {
    const PANEL_ROWS = ['panel-title-won', 'panel-title-lost', 'star-earned', 'star-unearned', 'win-silhouette',
      'panel-subline', 'retry-label', 'retry-outline', 'panel-hairline', 'streak-line'];
    for (const { name, palette } of PALETTES) {
      for (const id of PANEL_ROWS) {
        const u = USAGES.find((x) => x.id === id)!;
        expect(u.bgRole).toBe('surface');
        const row = auditUsage(name, palette, { ...u, bgRole: 'surfaceRaised' });
        if (row.ratio < row.gate) {
          throw new Error(`${name} / ${id}: ${row.fg} on surfaceRaised ${row.bg} = ${row.ratio.toFixed(2)} < ${row.gate}`);
        }
      }
    }
  });

  it('surfaceRaised is a lightness step at the hue and saturation of surface; the scrims keep their colour', () => {
    for (const { palette } of PALETTES) {
      const hsl = hexToHsl(palette.surface);
      const l = hexToHsl(palette.surfaceRaised).l;
      // Re-generate at surface's hue/sat and the raised lightness: 8-bit rounding may move it by one step.
      const regen = [l - 0.2, l - 0.1, l, l + 0.1, l + 0.2].map((x) => hslToHex({ ...hsl, l: Math.min(100, Math.max(0, x)) }));
      expect(regen).toContain(palette.surfaceRaised);
      expect(parseScrim(palette.scrimWon).colour).toBe('#000000'); // today's won scrim colour
      expect([palette.bg, '#000000']).toContain(parseScrim(palette.scrimLost).colour); // today's (bg) or the won black
    }
  });

  it('pins the starting set (B); the W5-20 pick commit replaces these six values with the owner\'s set', () => {
    const tokens = (p: (typeof PALETTES)[number]['palette']) => [p.surfaceRaised, p.scrimWon, p.scrimLost];
    expect(tokens(PALETTES[0].palette)).toEqual(['#FAF9FD', '#00000073', '#FFFFFFDB']);
    expect(tokens(PALETTES[1].palette)).toEqual(['#201D30', '#00000073', '#13111CDB']);
  });

  it('the flag-OFF panel is untouched: today\'s scrims still measure 2.90 / 1.21 / 1.16 / 1.14 (information only)', () => {
    expect(scrimInfo().map((r) => r.ratio.toFixed(2))).toEqual(['2.90', '1.16', '1.21', '1.14']);
  });
});

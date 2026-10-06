import { ARROW_STYLES, SKIN_SPECS, arrowStyleForNumber } from '../skinSpecs';
const names = ['Classic', 'Cinnamon Roll', 'Sherbet', 'Ink Pro', 'Candy Gloss', 'Jelly', 'Critter', 'Yarn', 'Paper Craft', 'Archery', 'Pixel', 'Neon Glass', 'Rainbow Ribbon', 'Clear Glass', 'Stained Glass', 'Campfire', 'Lava Rock', 'Strawberry Glazed', 'Pumpkin', 'Ghost', 'Candy Corn', 'Mummy', 'Potion Slime'];
it('all styles (18 + the HALLOWEEN-01 pack + HALLOWEEN-PLUS Mummy/Potion Slime) have append-only numeric identities in registry order', () => {
  expect(ARROW_STYLES.map(style => style.name)).toEqual(names);
  expect(ARROW_STYLES.map(style => style.numericId)).toEqual(names.map((_,i) => i));
  for(let id=0;id<names.length;id++) expect(arrowStyleForNumber(id).name).toBe(names[id]);
  expect(arrowStyleForNumber(999).id).toBe('classic');
});
it('existing saved choices retain Classic 0, Cinnamon 1 and Sherbet 2', () => {
  expect([0,1,2].map(id => arrowStyleForNumber(id).id)).toEqual(['classic','cinnamon','sherbet']);
});
it('the new canvas details are declarative data, including honest dark-theme preferences', () => {
  const specs = SKIN_SPECS as Record<string, any>;
  expect(specs.critter?.bodyPattern).toBe('beads');
  expect(specs.critter?.face.anchor).toBe('head');
  expect(specs.pixel?.head.shape).toBe('step');
  expect(specs.yarn?.layers.some((l: any) => l.kind === 'seam' && l.dash?.length === 2)).toBe(true);
  expect(specs['stained-glass'].layers.find((l: any) => l.kind === 'fold').fillHalf).toBe(false);
  expect(specs['paper-craft']?.layers.some((l: any) => l.kind === 'fold')).toBe(true);
  expect(specs['rainbow-ribbon']?.palette.colours).toEqual(['#FF5E6C']);
  expect(specs['rainbow-ribbon']?.layers.find((l: any) => l.kind === 'bands').bands).toEqual(['#FF9F43', '#FFD93D', '#4CD4A0', '#4DA3FF', '#9B6BFF']);
  expect(specs.archery?.tail.kind).toBe('fletch');
  expect(specs['clear-glass']?.tail.kind).toBe('marble');
  expect(specs['neon-glass']?.preferredTheme).toBe('dark');
  expect(specs['lava-rock']?.preferredTheme).toBe('dark');
});
it('every style uses head-only single-cell art, fixed centred accents and existing bounded motion', () => {
  for(const spec of Object.values(SKIN_SPECS)) {
    expect(spec.tail.oneCell).toBe('none');
    for(const layer of spec.layers.filter(l => ['shine','ribbon','seam'].includes(l.kind))) {
      expect(layer.offset ?? [0,0]).toEqual([0,0]); expect(layer.amplitude ?? 0).toBe(0);
    }
    expect(spec.motion.particles.count).toBeLessThanOrEqual(6);
  }
});

describe('ART-SKINS-07b look fixes (data only)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { contrastRatio, hexToHsl, skinContrastRows } = require('../contrastAudit') as typeof import('../contrastAudit');
  const layer = (id: string, kind: string) => SKIN_SPECS[id].layers.find(l => l.kind === kind)!;
  it('Archery: the head carries the saturated warm colour, the fletching is pale and quiet', () => {
    expect(layer('archery', 'headFill').colour).toBe('#E4572E');
    expect(layer('archery', 'fold').colour).toBe('#F28C64');
    expect(layer('archery', 'tailFill').colour).toBe('#E6E1D8');
    const head = hexToHsl(layer('archery', 'headFill').colour), facet = hexToHsl(layer('archery', 'fold').colour);
    const fletch = hexToHsl(layer('archery', 'tailFill').colour);
    expect(fletch.s).toBeLessThanOrEqual(30); // HSL saturation, 0..100
    expect(head.s).toBeGreaterThanOrEqual(60);
    expect(facet.s).toBeGreaterThanOrEqual(60);
    // Warm hue for both head tones; the fletch is far less saturated than either.
    for (const h of [head.h, facet.h]) expect(h < 45 || h > 345).toBe(true);
    expect(head.s - fletch.s).toBeGreaterThanOrEqual(40);
    // Outline (K4) is untouched.
    expect(layer('archery', 'rim').colour).toBe('#967350');
  });
  it('Ink Pro declares a light preference; its dark outline still genuinely passes K4', () => {
    expect(SKIN_SPECS['ink-pro'].preferredTheme).toBe('light');
    const rows = skinContrastRows([SKIN_SPECS['ink-pro']]).filter(r => r.usage.id.includes('-outline-'));
    expect(rows.find(r => r.palette === 'Daylight')!.required).toBe(true);
    const night = rows.find(r => r.palette === 'Ink Night')!;
    expect(night.required).toBe(false);
    // The exemption is not relied upon: the real ratio is reported and passes.
    expect(night.pass).toBe(true);
    expect(night.ratio).toBeGreaterThanOrEqual(3);
  });
  it('a light preference keeps raw failing dark rows as failures (no faked pass)', () => {
    const spec = { ...SKIN_SPECS['ink-pro'], layers: SKIN_SPECS['ink-pro'].layers.map(l => l.kind === 'rim' ? { ...l, colour: '#1D1B26' } : l) };
    const rows = skinContrastRows([spec]).filter(r => r.usage.id.includes('-outline-'));
    const night = rows.find(r => r.palette === 'Ink Night')!;
    expect(night.pass).toBe(false);
    expect(night.required).toBe(false);
    expect(rows.find(r => r.palette === 'Daylight')!.required).toBe(true);
    // Blocked red still gates both themes.
    expect(skinContrastRows([spec]).filter(r => r.usage.id.endsWith('-blocked')).every(r => r.required)).toBe(true);
  });
  it('Clear Glass body is a pale icy blue, visibly distinct from the white board', () => {
    const fill = SKIN_SPECS['clear-glass'].palette.colours[0];
    expect(fill).toBe('#CFE6F7');
    const ratio = contrastRatio(fill, '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(1.2);
    expect(ratio).toBeLessThanOrEqual(1.5);
    const hsl = hexToHsl(fill);
    expect(hsl.h).toBeGreaterThan(190); expect(hsl.h).toBeLessThan(220);
    expect(hsl.l).toBeGreaterThanOrEqual(85);
    expect(layer('clear-glass', 'rim').colour).toBe('#6F7F95');
  });
  it('Paper Craft bend crease is a hairline; the half-head fold keeps its colour and opacity', () => {
    const fold = layer('paper-craft', 'fold');
    expect(fold.width).toBe(.012);
    expect(fold.colour).toBe('#B9A987');
    expect(fold.opacity).toBe(.8);
    expect(fold.fillHalf).toBeUndefined();
  });
});

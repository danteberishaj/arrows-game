// HALLOWEEN-PLUS concept candidates: unregistered data, existing fields only, the TS side of the skin contract.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARROW_STYLES, HALLOWEEN_BOARD, SKIN_SPECS, type SkinLayer, type SkinSpec } from '../skinSpecs';
import { REWARD_CATALOGUE } from '../rewardCatalogue';
import { composite, contrastRatio, skinContrastRows } from '../contrastAudit';
import { BAT, CANDIDATE_SPEC_JSON, HALLOWEEN_PLUS_CANDIDATES, MUMMY, SLIME } from '../skinCandidates';

const specs = HALLOWEEN_PLUS_CANDIDATES.map(c => c.spec);
const layer = (s: SkinSpec, kind: SkinLayer['kind']) => s.layers.filter(l => l.kind === kind);
const slots = (s: SkinSpec) => s.layers.reduce((n, l) => n + (l.kind === 'bands' || l.kind === 'lengthBands' ? l.bands!.length : 1), 0)
  + Number(s.face.eyes) + Number(s.face.blush);
const r2 = (n: number) => Number(n.toFixed(2));
// Field vocabulary as of HALLOWEEN-01b (src/ui/skinSpecs.ts / SkinSpec.kt). A candidate must not need a new one.
const LAYER_FIELDS = new Set(['kind', 'colour', 'width', 'opacity', 'fillHalf', 'dash', 'bandWidths', 'offset', 'amplitude', 'period',
  'fadeCells', 'fadeFraction', 'sideOffset', 'bands', 'cap']);
const FACE_FIELDS = new Set(['eyes', 'blush', 'closedOnBlocked', 'ink', 'blushColour', 'anchor', 'eyeRadius', 'eyeHalfGap', 'mouthWidth',
  'blushSize', 'blushOffset', 'headOffset', 'eyeShape']);
const SPEC_FIELDS = new Set(['id', 'numericId', 'name', 'preferredTheme', 'bodyPattern', 'beads', 'board', 'palette', 'layers', 'head',
  'tail', 'bends', 'face', 'lod', 'motion']);

describe('not wired: candidates never reach players', () => {
  test('no candidate id, name or proposed number is in the registry, picker styles or reward catalogue', () => {
    for (const s of specs) {
      expect(SKIN_SPECS[s.id]).toBeUndefined();
      expect(ARROW_STYLES.some(style => style.id === s.id || style.name === s.name || style.numericId === s.numericId)).toBe(false);
      expect(REWARD_CATALOGUE.some(e => e.refId === s.id || e.name === s.name)).toBe(false);
    }
    expect(Math.max(...ARROW_STYLES.map(s => s.numericId))).toBe(20);
  });
  test('no app source imports the candidates module (Metro never bundles it)', () => {
    const root = path.resolve(__dirname, '../../..');
    const files: string[] = [path.join(root, 'App.tsx'), path.join(root, 'index.ts')];
    const walk = (dir: string) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); }
      else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith('skinCandidates.ts')) files.push(full);
    } };
    walk(path.join(root, 'src'));
    expect(files.length).toBeGreaterThan(50);
    const imports = /(from\s*|require\(|import\()\s*['"][^'"]*skinCandidates['"]/;
    expect(imports.test(fs.readFileSync(__filename, 'utf8'))).toBe(true); // positive control: this test imports it
    expect(files.filter(file => imports.test(fs.readFileSync(file, 'utf8')))).toEqual([]);
  });
});

describe('existing fields only', () => {
  test.each(HALLOWEEN_PLUS_CANDIDATES.map(c => [c.key, c.spec] as const))('%s uses only HALLOWEEN-01b-era fields', (_key, s) => {
    for (const key of Object.keys(s)) expect(SPEC_FIELDS.has(key)).toBe(true);
    for (const l of s.layers) for (const key of Object.keys(l)) expect(LAYER_FIELDS.has(key)).toBe(true);
    for (const key of Object.keys(s.face)) expect(FACE_FIELDS.has(key)).toBe(true);
    expect(JSON.parse(CANDIDATE_SPEC_JSON[s.id])).toEqual(s);
  });
});

describe.each(HALLOWEEN_PLUS_CANDIDATES.map(c => [c.key, c.spec] as const))('%s contract (TS side)', (_key, s) => {
  test('pack proportions, Halloween tints, safe bounds and the 7-layer limit', () => {
    expect(s.board).toEqual(HALLOWEEN_BOARD);
    expect(HALLOWEEN_BOARD).toEqual({ light: '#F3EEFA', dark: '#221A36' });
    expect([layer(s, 'rim')[0].width, layer(s, 'body')[0].width]).toEqual([.48, .425]);
    expect(s.head).toEqual(expect.objectContaining({ shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10 }));
    expect(s.tail.radius + s.tail.rim).toBeLessThanOrEqual(.44);
    expect(slots(s)).toBeLessThanOrEqual(7);
    expect(s.lod.flatMinDp).toBeLessThanOrEqual(s.lod.detailMinDp);
    expect(s.lod.detailMinDp).toBeLessThanOrEqual(s.lod.faceMinDp);
  });
  test('K3/K8 data: no tail at all (the head always dominates), one-cell arrows draw no tail', () => {
    expect(s.tail.kind).toBe('none');
    expect(s.tail.oneCell).toBe('none');
  });
  test('centreline defaults: shine/seam on the shaft axis, seam/spots inside the accent inset', () => {
    const bodyHalf = layer(s, 'body')[0].width / 2;
    for (const l of s.layers.filter(l => ['shine', 'ribbon', 'seam'].includes(l.kind))) {
      expect(l.offset ?? [0, 0]).toEqual([0, 0]);
      expect(l.amplitude ?? 0).toBe(0);
    }
    for (const l of layer(s, 'seam')) {
      expect(l.width).toBeLessThanOrEqual(2 * bodyHalf - .06 + 1e-9); // README: within body − .06
      expect(l.dash).toHaveLength(2); // a stitch is always dashed (native stitch check)
    }
    for (const l of layer(s, 'shine')) expect(l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    for (const l of layer(s, 'spots')) expect(Math.abs(l.sideOffset ?? 0) + l.width / 2).toBeLessThanOrEqual(bodyHalf - .03);
    for (const l of layer(s, 'glow')) expect(l.width).toBeLessThanOrEqual(.9);
  });
  test('K4: the rim passes ≥3:1 on both tinted boards; every required tint row passes', () => {
    const rows = skinContrastRows([s]);
    expect(rows.filter(row => row.required && !row.pass)).toEqual([]);
    const outline = rows.filter(row => row.usage.id.includes('-outline-'));
    expect(outline).toHaveLength(2);
    expect(outline.every(row => row.required && row.ratio >= 3)).toBe(true);
  });
});

test('K4 numbers quoted in the HALLOWEEN-PLUS report', () => {
  const pair = (rim: string) => [r2(contrastRatio(rim, '#F3EEFA')), r2(contrastRatio(rim, '#221A36'))];
  expect(pair(MUMMY.rim)).toEqual([3.9, 3.72]);
  expect(pair(SLIME.limeRim)).toEqual([3.72, 3.9]);
  expect(pair(SLIME.mintRim)).toEqual([3.5, 4.14]);
  expect(pair(BAT.rim)).toEqual([4.01, 3.62]);
});

test('honest halo note: the rim against its own translucent halo (not the audited board) on each theme', () => {
  const halo = (rim: string, glow: string) => ['#F3EEFA', '#221A36'].map(bg => r2(contrastRatio(rim, composite(glow, .30, bg))));
  // Light board: the halo is lighter than the rim, so the outline still clears 3:1.
  // Dark board: a lit halo next to the rim lowers the local ratio below 3:1 (the K4 audit itself checks rim vs board).
  expect(halo(SLIME.limeRim, SLIME.limeGlow)).toEqual([3.55, 1.68]);
  expect(halo(SLIME.mintRim, SLIME.mintGlow)).toEqual([3.38, 1.74]);
});

test('Little Bat A fangs are the existing blush field: two small ovals hanging from the smile, inside the face', () => {
  const a = specs.find(s => s.id === 'little-bat-a')!; const b = specs.find(s => s.id === 'little-bat-b')!;
  expect(a.face).toEqual(expect.objectContaining({ eyeShape: 'arc', blush: true, blushColour: '#FFFFFF', blushSize: [.032, .06], blushOffset: [.03, .115] }));
  // The mouth arc bottom is at y + .095 (SkinPaths.face); each fang's top sits at or above it so the smile overlaps it.
  expect(a.face.blushOffset![1] - a.face.blushSize![1] / 2).toBeLessThanOrEqual(.095);
  expect(b.face).toEqual(expect.objectContaining({ eyeShape: 'arc', blush: true, blushColour: BAT.cheek }));
});

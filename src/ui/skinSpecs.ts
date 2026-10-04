/** All geometry widths are fractions of a cell. Native code has no skin-id branches. */
export interface SkinLayer {
  /** `lengthBands` (HALLOWEEN-01): `bands` colour equal fractions of the visible shaft, tail → head, each with a
   *  nested head cap sized by `bandWidths` (the existing matching nested heads). One paint per band. */
  kind: 'shadow' | 'rim' | 'body' | 'stripe' | 'ribbon' | 'bands' | 'seam' | 'shine' | 'glow' | 'spots' | 'fold' | 'headFill' | 'tailFill' | 'lengthBands';
  colour: string | 'palette';
  width: number;
  opacity?: number;
  fillHalf?: boolean;
  dash?: readonly [number, number];
  bandWidths?: readonly number[];
  offset?: readonly [number, number];
  amplitude?: number;
  period?: number;
  fadeCells?: number;
  fadeFraction?: number;
  sideOffset?: number;
  bands?: readonly string[];
}
export interface SkinSpec {
  id: string;
  /** Persisted identity: never change or reuse a retired number. */
  numericId: number;
  name: string;
  /** Honest look note: the other theme may retain real non-gating K4 outline failures (see contrastAudit). */
  preferredTheme?: 'dark' | 'light';
  bodyPattern?: 'tube' | 'beads' | 'square';
  beads?: { diameter: number; pitch: number; tubeWidth: number };
  board?: { light: string; dark: string };
  palette: { rule: 'one' | 'length' | 'direction' | 'cycle'; colours: readonly string[]; lengthStops?: readonly number[] };
  layers: readonly SkinLayer[];
  head: { shape: 'tri' | 'rounded' | 'swept' | 'step'; halfWidth: number; tipPastCentre: number; back: number; shine: boolean; cornerRadius?: number };
  tail: { kind: 'none' | 'dot' | 'roll+face' | 'fletch' | 'marble'; radius: number; rim: number; oneCell: 'dot' | 'none'; colours?: readonly string[] };
  bends: 'rounded' | 'crease';
  face: { eyes: boolean; blush: boolean; closedOnBlocked: boolean; ink: string; blushColour: string; anchor?: 'tail' | 'head'; eyeRadius?: number; eyeHalfGap?: number; mouthWidth?: number; blushSize?: readonly [number, number]; blushOffset?: readonly [number, number]; headOffset?: number;
    /** HALLOWEEN-01: open-eye shape. Omitted = 'dot' (today's circles, byte-identical). 'arc' draws the closed-eye arc
     *  as the open eye (sleepy); 'triangle' an upright triangle inside the eye radius. Blocked eyes keep the arc. */
    eyeShape?: 'dot' | 'arc' | 'triangle' };
  lod: { faceMinDp: number; detailMinDp: number; flatMinDp: number };
  motion: { pressScale: number; anticipationMs: number; particles: { count: number; size: number; colours: readonly string[]; lifeMs: number } };
}
const cinnamon: SkinSpec = {
  id: 'cinnamon', numericId: 1, name: 'Cinnamon Roll', palette: { rule: 'one', colours: ['#E6AE71'] },
  layers: [
    { kind: 'shadow', colour: '#5D3521', width: .38, offset: [.035, .035] },
    { kind: 'rim', colour: '#96603A', width: .38 },
    { kind: 'body', colour: 'palette', width: .33 },
    { kind: 'stripe', colour: '#704127', width: .055, period: .48, sideOffset: .09 },
    { kind: 'ribbon', colour: '#FFF3DC', width: .075, amplitude: 0, period: .91, fadeCells: 1, fadeFraction: .35 },
  ],
  head: { shape: 'tri', halfWidth: .36, tipPastCentre: .43, back: .42, shine: true },
  tail: { kind: 'roll+face', radius: .265, rim: .025, oneCell: 'none' }, bends: 'rounded',
  face: { eyes: true, blush: true, closedOnBlocked: true, ink: '#4D2C22', blushColour: '#EE9C99' },
  lod: { flatMinDp: 14, detailMinDp: 24, faceMinDp: 28 },
  motion: { pressScale: .94, anticipationMs: 60, particles: { count: 6, size: .04, colours: ['#96603A', '#E6AE71'], lifeMs: 350 } },
};
const sherbet: SkinSpec = {
  id: 'sherbet', numericId: 2, name: 'Sherbet', palette: { rule: 'cycle', colours: ['#EEB0CB', '#ADDAD2', '#CBB8E8', '#F3D39F'] },
  layers: [
    { kind: 'shadow', colour: '#332B40', width: .40, offset: [.025, .035] },
    { kind: 'rim', colour: '#82638D', width: .40 },
    { kind: 'body', colour: 'palette', width: .34 },
    { kind: 'shine', colour: '#FFEDEB', width: .065, offset: [0, 0] },
  ],
  head: { shape: 'rounded', halfWidth: .36, tipPastCentre: .43, back: .42, shine: true },
  tail: { kind: 'dot', radius: .13, rim: .025, oneCell: 'none' }, bends: 'rounded',
  face: { eyes: false, blush: false, closedOnBlocked: false, ink: '#82638D', blushColour: '#EE9C99' },
  lod: { flatMinDp: 14, detailMinDp: 24, faceMinDp: 28 },
  motion: { pressScale: .96, anticipationMs: 45, particles: { count: 6, size: .035, colours: ['#EEB0CB', '#ADDAD2', '#CBB8E8', '#F3D39F'], lifeMs: 320 } },
};
/** New styles share the established motion/LOD and safe caps. Appearance is declared here. */
function canvasSpec(id: string, numericId: number, name: string, palette: SkinSpec['palette'],
  layers: readonly SkinLayer[], extra: Partial<SkinSpec> = {}): SkinSpec {
  return { id, numericId, name, palette, layers, head: { ...sherbet.head },
    tail: { kind: 'none', radius: 0, rim: .02, oneCell: 'none' }, bends: 'rounded',
    face: { ...sherbet.face }, lod: { ...sherbet.lod }, motion: sherbet.motion, ...extra };
}
const one = (colour: string): SkinSpec['palette'] => ({ rule: 'one', colours: [colour] });
const lengths = (colours: readonly string[]): SkinSpec['palette'] => ({ rule: 'length', colours, lengthStops: [2, 4, 5] });
// Core direction order is Up, Down, Left, Right; the canvas table uses Up, Right, Down, Left.
const directions = (up: string, right: string, down: string, left: string): SkinSpec['palette'] => ({ rule: 'direction', colours: [up, down, left, right] });
const rim = (colour: string, width: number): SkinLayer => ({ kind: 'rim', colour, width });
const body = (width: number): SkinLayer => ({ kind: 'body', colour: 'palette', width });
const shine = (width: number, colour = '#FFF4EB'): SkinLayer => ({ kind: 'shine', colour, width, offset: [0, 0] });
const inkPro = canvasSpec('ink-pro', 3, 'Ink Pro', one('#1D1B26'), [
  rim('#777080', .22), body(.17), { kind: 'tailFill', colour: '#6D4AEF', width: .17 },
], { preferredTheme: 'light', head: { ...sherbet.head, shape: 'swept', shine: false }, tail: { kind: 'dot', radius: .09, rim: .015, oneCell: 'none' } });
const candyGloss = canvasSpec('candy-gloss', 4, 'Candy Gloss', lengths(['#FF6B6B', '#22C3A6', '#FFB21E', '#7B61FF']), [
  { kind: 'shadow', colour: '#4D394D', width: .37, offset: [.02, .035], opacity: .22 }, rim('#866474', .37), body(.315), shine(.075),
]);
const jelly = canvasSpec('jelly', 5, 'Jelly', directions('#8EA8FF', '#FF8FB1', '#F9B94B', '#57C9BA'), [
  rim('#776A91', .38), { ...body(.315), opacity: .82 }, { kind: 'spots', colour: '#FFF8F2', width: .075, period: .65, sideOffset: -.07, opacity: .6 }, shine(.065),
]);
const critter = canvasSpec('critter', 6, 'Critter', lengths(['#7ED39B', '#FFB26B', '#F58FB2', '#8DB5FF']), [
  rim('#6E7A55', .40), body(.35), shine(.055),
], { bodyPattern: 'beads', head: { ...sherbet.head, shine: false },
  face: { ...cinnamon.face, anchor: 'head' } });
const yarn = canvasSpec('yarn', 7, 'Yarn', lengths(['#E48FA2', '#86B596', '#E6B84A', '#7E9DCB']), [
  rim('#896E75', .34), body(.29), { kind: 'seam', colour: '#624B60', width: .042, dash: [.084, .084], offset: [0, 0] },
], { head: { ...sherbet.head, shine: false } });
const paperCraft = canvasSpec('paper-craft', 8, 'Paper Craft', directions('#FFFFFF', '#FFEFC7', '#DCEBFF', '#FFDCDC'), [
  { kind: 'shadow', colour: '#3B2A14', width: .36, offset: [.03, .05], opacity: .22 }, rim('#8B7560', .36), body(.315),
  { kind: 'fold', colour: '#B9A987', width: .012, opacity: .8 }, shine(.035),
], { bends: 'crease', bodyPattern: 'square' });
const archery = canvasSpec('archery', 9, 'Archery', one('#C08D5B'), [
  rim('#967350', .18), body(.12), { kind: 'tailFill', colour: '#E6E1D8', width: .12 },
  { kind: 'headFill', colour: '#E4572E', width: .12 }, { kind: 'fold', colour: '#F28C64', width: .02 }, shine(.025),
], { bends: 'crease', tail: { kind: 'fletch', radius: .21, rim: .02, oneCell: 'none' } });
const pixel = canvasSpec('pixel', 10, 'Pixel', directions('#3A86FF', '#FF006E', '#FB8500', '#2A9D8F'), [
  { kind: 'shadow', colour: '#1B1B2F', width: .28, offset: [.055, .055], opacity: .3 }, rim('#787087', .28), body(.22), shine(.04),
], { bodyPattern: 'square', bends: 'crease', head: { ...sherbet.head, shape: 'step' } });
const neonGlass = canvasSpec('neon-glass', 11, 'Neon Glass', directions('#39F3FF', '#FF4FD8', '#FFB23D', '#A6FF4D'), [
  { kind: 'glow', colour: 'palette', width: .29, opacity: .28 }, rim('palette', .18), body(.13), shine(.03, '#FFFFFF'),
], { preferredTheme: 'dark' });
const rainbowRibbon = canvasSpec('rainbow-ribbon', 12, 'Rainbow Ribbon', one('#FF5E6C'), [
  rim('#866077', .44), body(.395), { kind: 'bands', colour: 'palette', width: .395,
    bands: ['#FF9F43', '#FFD93D', '#4CD4A0', '#4DA3FF', '#9B6BFF'], bandWidths: [.33, .268, .205, .142, .08] },
], { head: { ...sherbet.head, shine: false } });
const clearGlass = canvasSpec('clear-glass', 13, 'Clear Glass', one('#CFE6F7'), [
  { kind: 'shadow', colour: '#23364A', width: .34, offset: [.015, .035], opacity: .1 }, rim('#6F7F95', .34), body(.265),
  { kind: 'tailFill', colour: 'tailPalette', width: .265 }, shine(.055, '#FFFFFF'),
], { tail: { kind: 'marble', radius: .16, rim: .025, oneCell: 'none', colours: ['#FF6B8B', '#4DA3FF', '#FFC23D', '#3FC9A0'] } });
const stainedGlass = canvasSpec('stained-glass', 14, 'Stained Glass', directions('#5B8DEF', '#E8566C', '#F2B33D', '#3FB98A'), [
  rim('#796C87', .38), { ...body(.28), opacity: .92 }, { kind: 'fold', colour: '#796C87', width: .045, fillHalf: false }, shine(.04),
], { bends: 'crease' });
const campfire = canvasSpec('campfire', 15, 'Campfire', one('#FFF4D0'), [
  rim('#A86739', .43), body(.38), { kind: 'bands', colour: 'palette', width: .38,
    bands: ['#FF5A36', '#FF8A2A', '#FFC23D', '#FFF4D0'], bandWidths: [.38, .29, .195, .09] },
], { face: { ...cinnamon.face, blush: false, anchor: 'head' }, head: { ...sherbet.head, shine: false } });
const lavaRock = canvasSpec('lava-rock', 16, 'Lava Rock', one('#3E2A26'), [
  { kind: 'glow', colour: '#FF5A1F', width: .40, opacity: .22 }, rim('#FF7A2F', .36), body(.315),
  { kind: 'seam', colour: '#FF8A3D', width: .058, dash: [.21, .08], offset: [0, 0] },
  { kind: 'seam', colour: '#FFD27A', width: .024, dash: [.21, .08], offset: [0, 0] },
], { preferredTheme: 'dark', head: { ...sherbet.head, shine: false } });
const strawberryGlazed = canvasSpec('strawberry-glazed', 17, 'Strawberry Glazed', one('#E6AE71'), [
  rim('#96603A', .38), body(.33), { kind: 'stripe', colour: '#704127', width: .055, period: .48, sideOffset: .09 },
  { kind: 'spots', colour: '#6CC8F2', width: .045, period: .3, sideOffset: -.085 },
  { kind: 'ribbon', colour: '#FF9EBB', width: .075, offset: [0, 0], fadeCells: 1, fadeFraction: .35 },
], { head: { ...cinnamon.head }, tail: { ...cinnamon.tail }, face: { ...cinnamon.face } });
/** HALLOWEEN-01 pack (book-only seasonal styles, src/ui/rewardCatalogue.ts). Launch-polish proportions, one board tint. */
// CONFLICT (HALLOWEEN-01 report): the brief's dark tint #2A2140 fails the REQUIRED missed-mark tint row (heart at .75 over
// the board, 2.992:1 < 3:1, src/ui/__tests__/seasons.test.ts pins it). Dark keeps the stock Ink Night board until the owner
// rules; the light tint is the brief's.
export const HALLOWEEN_BRIEF_DARK_TINT = '#2A2140';
const HALLOWEEN_BOARD = { light: '#F3EEFA', dark: '#13111C' };
const polishedHead: SkinSpec['head'] = { ...sherbet.head, shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10, shine: false };
const headFace = (ink: string, eyeShape: 'arc' | 'triangle', blushColour?: string): SkinSpec['face'] => ({ eyes: true, blush: blushColour !== undefined, eyeShape,
  closedOnBlocked: true, ink, blushColour: blushColour ?? '#EE9C99', anchor: 'head', eyeRadius: .045, eyeHalfGap: .13,
  mouthWidth: .12, blushSize: [.11, .06], blushOffset: [.12, .05], headOffset: -.12 });
const particles = (colours: readonly string[]): SkinSpec['motion'] => ({ ...sherbet.motion, particles: { ...sherbet.motion.particles, colours } });
const pumpkin = canvasSpec('pumpkin', 18, 'Pumpkin', one('#E0661B'), [
  rim('#9A633F', .48), body(.425),
  // Rib lobes: orange circles centred on each bead, almost touching, so the deep-orange body reads as thin rib
  // creases (iteration 2; iteration 1's .30 lobes read as separate balls) plus a narrow edge inside the outline.
  { kind: 'spots', colour: '#FF8A2A', width: .34, period: .35, sideOffset: 0 },
  { kind: 'tailFill', colour: '#6BAA4F', width: .425 }, { kind: 'headFill', colour: '#FF8A2A', width: .425 },
], { board: HALLOWEEN_BOARD, bodyPattern: 'beads', beads: { diameter: .48, pitch: .35, tubeWidth: .34 }, head: polishedHead,
  tail: { kind: 'dot', radius: .12, rim: .025, oneCell: 'none' }, face: headFace('#9A633F', 'triangle'),
  motion: particles(['#FF8A2A', '#E0661B', '#6BAA4F']) });
const ghost = canvasSpec('ghost', 19, 'Ghost', one('#E9E2F5'), [
  rim('#8C7BB5', .48), body(.425), shine(.22, '#F7F4FF'), { kind: 'headFill', colour: '#F7F4FF', width: .425 },
], { board: HALLOWEEN_BOARD, bodyPattern: 'beads', beads: { diameter: .48, pitch: .30, tubeWidth: .32 }, head: polishedHead,
  face: headFace('#8C7BB5', 'arc', '#D9CFEA'), motion: particles(['#F7F4FF', '#E9E2F5', '#D9CFEA']) });
const candyCorn = canvasSpec('candy-corn', 20, 'Candy Corn', one('#FFD24A'), [
  rim('#8C7BB5', .48), body(.425),
  // Thirds of the visible shaft, tail → head; the head repeats them as nested caps with the white innermost.
  { kind: 'lengthBands', colour: 'palette', width: .425, bands: ['#FFD24A', '#FF8A2A', '#FFF8E8'], bandWidths: [.425, .29, .155] },
], { board: HALLOWEEN_BOARD, head: polishedHead, motion: particles(['#FFD24A', '#FF8A2A', '#FFF8E8']) });
/** One shared data recipe; untouched specs keep their original JSON and native defaults. */
function launchPolish(spec: SkinSpec, light: string, dark: string): SkinSpec {
  const oldBody = spec.layers.find(layer => layer.kind === 'body')!.width;
  const factor = .425 / oldBody;
  return { ...spec, board: { light, dark },
    layers: spec.layers.map(layer => ({ ...layer,
      width: ['rim','shadow'].includes(layer.kind) ? .48 : layer.kind === 'body' ? .425 : layer.width * factor,
      ...(layer.bandWidths ? { bandWidths: layer.bandWidths.map(width => width * factor) } : {}),
      ...(layer.sideOffset !== undefined ? { sideOffset: layer.sideOffset * factor } : {}),
    })),
    head: { ...spec.head, shape: 'rounded', halfWidth: .44, tipPastCentre: .46, cornerRadius: .10 },
    face: spec.face.eyes ? { ...spec.face, eyeRadius: .045, eyeHalfGap: .13, mouthWidth: .12,
      blushSize: [.11,.06], blushOffset: [.12,.05], ...(spec.face.anchor === 'head' ? { headOffset: -.12 } : {}) } : spec.face,
  };
}
export const SKIN_SPECS: Readonly<Record<string, SkinSpec>> = {
  cinnamon: launchPolish(cinnamon,'#FFF7EA','#1A1410'),
  sherbet: launchPolish(sherbet,'#FFF5F8','#17121C'), 'ink-pro': inkPro,
  'candy-gloss': launchPolish(candyGloss,'#FFF6F4','#181118'),
  jelly: launchPolish(jelly,'#F3F6FF','#10121E'),
  critter: { ...launchPolish(critter,'#F1FAF3','#0F1713'), beads: { diameter:.52, pitch:.5, tubeWidth:.30 } },
  yarn, 'paper-craft': paperCraft,
  archery, pixel, 'neon-glass': neonGlass, 'rainbow-ribbon': launchPolish(rainbowRibbon,'#F7F5FF','#13111C'), 'clear-glass': clearGlass,
  'stained-glass': stainedGlass, campfire: launchPolish(campfire,'#FFF6EC','#17110D'), 'lava-rock': lavaRock,
  'strawberry-glazed': launchPolish(strawberryGlazed,'#FFF7EA','#1A1410'),
  pumpkin, ghost, 'candy-corn': candyCorn,
};
export function skinSpecFor(id: string | undefined): SkinSpec | null { return id ? SKIN_SPECS[id] ?? null : null; }
/** Stable selection payload; size/motion are separate props and never cause JSON re-parsing. */
export const SKIN_SPEC_JSON = Object.fromEntries(Object.entries(SKIN_SPECS).map(([id, spec]) => [id, JSON.stringify(spec)]));


export interface ArrowStyle {
  id: string;
  numericId: number;
  name: string;
  /** Classic uses the existing flat renderer, never a procedural approximation. */
  spec: SkinSpec | null;
}
export const CLASSIC_STYLE: ArrowStyle = { id: 'classic', numericId: 0, name: 'Classic', spec: null };
/** Picker order is registry order. Retired numeric IDs must never be reused. */
export const ARROW_STYLES: readonly ArrowStyle[] = [
  CLASSIC_STYLE,
  ...Object.values(SKIN_SPECS).map(spec => ({ id: spec.id, numericId: spec.numericId, name: spec.name, spec })),
];
export function arrowStyleForNumber(value: number): ArrowStyle {
  return ARROW_STYLES.find(style => style.numericId === value) ?? CLASSIC_STYLE;
}

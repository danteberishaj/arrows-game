/**
 * HALLOWEEN-PLUS concept candidates (2026-10-06): Mummy, Potion Slime and Little Bat, with A/B(/C) alternates.
 *
 * CONCEPT ONLY. Nothing here is registered: these specs are not in SKIN_SPECS, ARROW_STYLES, the reward catalogue,
 * the collection book or any price, and no app module imports this file, so Metro never bundles it. Capture tooling
 * reaches the native renderer through the contract fixture data and the existing `artSkinSpec` diagnostic intent
 * override (scripts/art/halloween-plus/). The numeric ids 21-23 are PROPOSED only; they are claimed when the owner
 * picks a variant and a later task registers it append-only.
 *
 * Every candidate uses existing SkinSpec fields only (no native change). Launch proportions (.48 rim / .425 body,
 * the pack's rounded .44 head with .10 fillets), `tail.oneCell: 'none'`, and the Halloween board tints
 * (#F3EEFA light, #221A36 dark; owner ruling HALLOWEEN-01b).
 */
import { canvasSpec, HALLOWEEN_BOARD, particles, polishedHead, type SkinLayer, type SkinSpec } from './skinSpecs';

const one = (colour: string): SkinSpec['palette'] => ({ rule: 'one', colours: [colour] });
const rim = (colour: string): SkinLayer => ({ kind: 'rim', colour, width: .48 });
const body: SkinLayer = { kind: 'body', colour: 'palette', width: .425 };
/** The pack's sized head face (Pumpkin/Ghost geometry). Dot eyes omit `eyeShape` (native default). */
function headFace(ink: string, extra: Partial<SkinSpec['face']> = {}): SkinSpec['face'] {
  return { eyes: true, blush: false, closedOnBlocked: true, ink, blushColour: '#EE9C99', anchor: 'head', eyeRadius: .045,
    eyeHalfGap: .13, mouthWidth: .12, blushSize: [.11, .06], blushOffset: [.12, .05], headOffset: -.12, ...extra };
}

// ---- Mummy: off-white bandage, thin wrap lines across the body (butt-capped dashed seam, the Pumpkin rib field),
// two little dark eyes peeking out of the head.
export const MUMMY = { body: '#F2EBDC', rim: '#857563', wrap: '#D5C7AE', wrapLight: '#E2D7C3', ink: '#3B2F33', blush: '#EDBDAE' };
function mummy(variant: string, wraps: readonly SkinLayer[]): SkinSpec {
  return canvasSpec(`mummy-${variant.toLowerCase()}`, 21, `Mummy ${variant}`, one(MUMMY.body), [rim(MUMMY.rim), body, ...wraps], {
    board: HALLOWEEN_BOARD, head: polishedHead,
    face: headFace(MUMMY.ink, { blush: true, blushColour: MUMMY.blush, eyeRadius: .042, mouthWidth: .07 }),
    motion: particles([MUMMY.body, MUMMY.wrap, MUMMY.rim]),
  });
}
/** A: tight, even wraps — a line every .20 cell. */
const mummyA = mummy('A', [{ kind: 'seam', colour: MUMMY.wrap, width: .36, dash: [.03, .17], offset: [0, 0], cap: 'butt' }]);
/** B: looser, layered wraps — full-width lines every .35 plus narrower overlap lines every .23 (an uneven rhythm). */
const mummyB = mummy('B', [
  { kind: 'seam', colour: MUMMY.wrap, width: .36, dash: [.035, .315], offset: [0, 0], cap: 'butt' },
  { kind: 'seam', colour: MUMMY.wrap, width: .26, dash: [.025, .205], offset: [0, 0], cap: 'butt' },
]);

// ---- Potion Slime: bubbly green body with bubble spots and a soft glow. No face (not in the brief).
export const SLIME = { lime: '#8EDB6A', limeGlow: '#B6F28F', limeRim: '#3F8A4A', mint: '#78DDB0', mintGlow: '#A9F5D3',
  mintRim: '#2F8F6A', core: '#F1FFD9', bubble: '#EFFFE0', fizz: '#FFFFFF' };
const bubbles: readonly SkinLayer[] = [
  { kind: 'spots', colour: SLIME.bubble, width: .10, period: .62, sideOffset: .06, opacity: .9 },
  { kind: 'spots', colour: SLIME.fizz, width: .05, period: .41, sideOffset: -.09, opacity: .85 },
];
function slime(variant: string, green: string, rimColour: string, glow: 'halo' | 'core', glowColour: string): SkinSpec {
  const halo: SkinLayer[] = glow === 'halo' ? [{ kind: 'glow', colour: glowColour, width: .62, opacity: .30 }] : [];
  const core: SkinLayer[] = glow === 'core' ? [{ kind: 'shine', colour: SLIME.core, width: .20, offset: [0, 0], opacity: .55, fadeCells: .7 }] : [];
  return canvasSpec(`potion-slime-${variant.toLowerCase()}`, 22, `Potion Slime ${variant}`, one(green), [...halo, rim(rimColour), body, ...core, ...bubbles], {
    board: HALLOWEEN_BOARD, head: polishedHead, motion: particles([green, glowColour, SLIME.fizz]),
  });
}
/** A: lime with an outer soft halo (translucent `glow` under-stroke, as Neon Glass). */
const slimeA = slime('A', SLIME.lime, SLIME.limeRim, 'halo', SLIME.limeGlow);
/** B: lime with an inner glowing core instead of a halo (keeps the rim directly on the board). */
const slimeB = slime('B', SLIME.lime, SLIME.limeRim, 'core', SLIME.limeGlow);
/** C: mint green with the outer halo. */
const slimeC = slime('C', SLIME.mint, SLIME.mintRim, 'halo', SLIME.mintGlow);

// ---- Little Bat: dusk-purple body, sleepy arc eyes (Ghost's eyeShape) in cream ink.
export const BAT = { body: '#5E4A96', rim: '#8068B8', ink: '#FFF1DC', fang: '#FFFFFF', cheek: '#E39BC4' };
function bat(variant: string, face: Partial<SkinSpec['face']>): SkinSpec {
  return canvasSpec(`little-bat-${variant.toLowerCase()}`, 23, `Little Bat ${variant}`, one(BAT.body), [rim(BAT.rim), body], {
    board: HALLOWEEN_BOARD, head: polishedHead,
    face: headFace(BAT.ink, { eyeShape: 'arc', mouthWidth: .10, ...face }),
    motion: particles([BAT.body, BAT.rim, BAT.ink]),
  });
}
/** A: "fangs" approximated with the existing blush field — two small white ovals hanging from the smile. A real
 *  fang shape needs a new general face field (RULING in docs/next-level/reports/HALLOWEEN-PLUS-concepts.md). */
const batA = bat('A', { blush: true, blushColour: BAT.fang, blushSize: [.032, .06], blushOffset: [.03, .115] });
/** B: no fangs; pink cheeks (the ordinary blush) for a cosier bat. */
const batB = bat('B', { blush: true, blushColour: BAT.cheek });

export interface SkinCandidate { key: string; candidate: 'mummy' | 'potion-slime' | 'little-bat'; variant: string; note: string; spec: SkinSpec }
/** Ordered for the owner sheet. `key` === `spec.id` (unique per variant); the registered id is chosen when the owner picks. */
export const HALLOWEEN_PLUS_CANDIDATES: readonly SkinCandidate[] = [
  { key: 'mummy-a', candidate: 'mummy', variant: 'A', note: 'tight even wraps (every .20 cell)', spec: mummyA },
  { key: 'mummy-b', candidate: 'mummy', variant: 'B', note: 'looser layered wraps (.35 + .23 rhythm)', spec: mummyB },
  { key: 'potion-slime-a', candidate: 'potion-slime', variant: 'A', note: 'lime, outer soft halo', spec: slimeA },
  { key: 'potion-slime-b', candidate: 'potion-slime', variant: 'B', note: 'lime, inner glow core (no halo)', spec: slimeB },
  { key: 'potion-slime-c', candidate: 'potion-slime', variant: 'C', note: 'mint, outer soft halo', spec: slimeC },
  { key: 'little-bat-a', candidate: 'little-bat', variant: 'A', note: 'sleepy eyes + white fangs (blush field)', spec: batA },
  { key: 'little-bat-b', candidate: 'little-bat', variant: 'B', note: 'sleepy eyes + pink cheeks, no fangs', spec: batB },
];
/** Stable JSON per variant, exactly what the native renderer parses (same shape as SKIN_SPEC_JSON). */
export const CANDIDATE_SPEC_JSON: Readonly<Record<string, string>> =
  Object.fromEntries(HALLOWEEN_PLUS_CANDIDATES.map(c => [c.key, JSON.stringify(c.spec)]));

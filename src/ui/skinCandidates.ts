/**
 * HALLOWEEN-PLUS concept candidates that are NOT registered.
 *
 * OWNER PICK 2026-10-06: concept "Mummy A" and "Potion Slime B" shipped as the registered Mummy (21) and Potion Slime (22)
 * in src/ui/skinSpecs.ts; the unpicked Mummy B and Potion Slime A/C were removed (their recipes are in git history,
 * commit "feat(HALLOWEEN-PLUS): three unregistered Halloween concept skins", and in
 * docs/next-level/reports/HALLOWEEN-PLUS-concepts.md).
 *
 * Little Bat: deferred: needs a general head-ears field (owner 2026-10-06). Its two variants stay here as unregistered
 * concepts: not in SKIN_SPECS, ARROW_STYLES, the reward catalogue, the collection book or any price, and no app module
 * imports this file, so Metro never bundles it. Capture tooling reaches the native renderer through the contract fixture
 * data and the existing `artSkinSpec` diagnostic intent override (scripts/art/halloween-plus/). The numeric id 23 is
 * PROPOSED only (the next free id after Potion Slime 22); it is claimed when a later task registers the bat append-only.
 *
 * Every candidate uses existing SkinSpec fields only (no native change). Launch proportions (.48 rim / .425 body,
 * the pack's rounded .44 head with .10 fillets), `tail.oneCell: 'none'`, and the Halloween board tints
 * (#F3EEFA light, #221A36 dark; owner ruling HALLOWEEN-01b).
 */
import { canvasSpec, HALLOWEEN_BOARD, particles, polishedHead, type SkinLayer, type SkinSpec } from './skinSpecs';

const one = (colour: string): SkinSpec['palette'] => ({ rule: 'one', colours: [colour] });
const rim = (colour: string): SkinLayer => ({ kind: 'rim', colour, width: .48 });
const body: SkinLayer = { kind: 'body', colour: 'palette', width: .425 };
/** The pack's sized head face (Pumpkin/Ghost geometry). */
function headFace(ink: string, extra: Partial<SkinSpec['face']> = {}): SkinSpec['face'] {
  return { eyes: true, blush: false, closedOnBlocked: true, ink, blushColour: '#EE9C99', anchor: 'head', eyeRadius: .045,
    eyeHalfGap: .13, mouthWidth: .12, blushSize: [.11, .06], blushOffset: [.12, .05], headOffset: -.12, ...extra };
}

// ---- Little Bat (deferred: needs a general head-ears field (owner 2026-10-06)): dusk-purple body, sleepy arc eyes
// (Ghost's eyeShape) in cream ink.
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

export interface SkinCandidate { key: string; candidate: 'little-bat'; variant: string; note: string; spec: SkinSpec }
/** Ordered for the owner sheet. `key` === `spec.id` (unique per variant); the registered id is chosen when the bat ships. */
export const HALLOWEEN_PLUS_CANDIDATES: readonly SkinCandidate[] = [
  { key: 'little-bat-a', candidate: 'little-bat', variant: 'A', note: 'sleepy eyes + white fangs (blush field)', spec: batA },
  { key: 'little-bat-b', candidate: 'little-bat', variant: 'B', note: 'sleepy eyes + pink cheeks, no fangs', spec: batB },
];
/** Stable JSON per variant, exactly what the native renderer parses (same shape as SKIN_SPEC_JSON). */
export const CANDIDATE_SPEC_JSON: Readonly<Record<string, string>> =
  Object.fromEntries(HALLOWEEN_PLUS_CANDIDATES.map(c => [c.key, JSON.stringify(c.spec)]));

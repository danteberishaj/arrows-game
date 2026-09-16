/**
 * The two theme palettes, ported from GameManager.Palette in the Unity build
 * and adjusted for contrast in W0-06 (every text and state colour is gated by
 * `src/ui/contrastAudit.ts`; run `npx tsx scripts/contrast-audit.ts`):
 *   • "Daylight"  — white paper, black-ink arrows (the default).
 *   • "Ink Night" — deep ink-violet night, moonlit near-white arrows.
 */
export interface Palette {
  bg: string;
  surface: string;
  border: string;
  accent: string;
  accentCore: string;
  accentLight: string;
  accentDeep: string;
  heart: string;
  heartLost: string;
  /** Off or disabled glyph on `surface` (sound off; also struck through). ≥3:1 on `surface`. */
  glyphOff: string;
  /** Spent heart pip OUTLINE on `bg`. ≥3:1 on `bg`. */
  pipSpent: string;
  /** Unearned star on the win panel (`surface`). ≥3:1 on `surface`. */
  starUnearned: string;
  /** Accent-hued body text on `bg` or `surface` (Hard tier, perfect-run line). ≥4.5:1 on both. */
  accentText: string;
  /** Heart-hued body text on `bg` (Super Hard tier). ≥4.5:1 on `bg`. */
  heartText: string;
  ink: string;
  inkDim: string;
  inkOnAccent: string;
}

export const Daylight: Palette = {
  bg: '#FFFFFF', // paper
  surface: '#EFEDF8', // panels/buttons
  border: '#8E80C5', // hairline, ≥3:1 on surface (W0-06 solver: #E0DCEF at L 90.0 -> L 63.7)
  accent: '#6D4AEF', // royal violet (primary)
  accentCore: '#4A3E8C', // deep-violet glyphs on surface
  accentLight: '#8F76F0', // level label
  accentDeep: '#5636D6', // pressed accent
  heart: '#E4327D', // magenta-rose
  heartLost: '#DBD7ED', // inactive fill: pressed header button
  glyphOff: '#8D80C6', // W0-06 solver: heartLost hue/sat, L 88.6 -> 63.9
  pipSpent: '#988CCB', // W0-06 solver: heartLost hue/sat, L 88.6 -> 67.3
  starUnearned: '#8D80C6', // W0-06 solver: heartLost hue/sat, L 88.6 -> 63.9
  accentText: '#6D4AEF', // = accent; already ≥4.5:1 on bg and surface
  heartText: '#E11F71', // W0-06 solver: heart hue/sat, L 54.5 -> 50.2
  ink: '#191724', // ink arrows/text
  inkDim: '#6D6988', // muted secondary text (W0-06 solver: L 47.8 -> 47.3)
  inkOnAccent: '#FFFFFF',
};

export const InkNight: Palette = {
  bg: '#13111C', // ink-violet night
  surface: '#201D30',
  border: '#69629E', // W0-06 solver: L 20.6 -> 50.2
  accent: '#7B5BF5', // W0-06 solver: L 66.1 -> 65.9, white 16 bold labels ≥4.5:1
  accentCore: '#CBC4F0', // lavender glyphs on surface
  accentLight: '#A98FF8',
  accentDeep: '#6247D6',
  heart: '#F0468C',
  heartLost: '#3B3653', // inactive fill: pressed header button
  glyphOff: '#6C6398', // W0-06 solver: heartLost hue/sat, L 26.9 -> 49.2
  pipSpent: '#635B8B', // W0-06 solver: heartLost hue/sat, L 26.9 -> 45.1
  starUnearned: '#6C6398', // W0-06 solver: heartLost hue/sat, L 26.9 -> 49.2
  accentText: '#8C70F6', // W0-06 solver: accent hue/sat, L 66.1 -> 70.2 (≥4.5:1 on bg and surface)
  heartText: '#F0468C', // = heart; already ≥4.5:1 on bg
  ink: '#EFEDF9', // moonlit arrows/text
  inkDim: '#A29DC1',
  inkOnAccent: '#FFFFFF',
};

export const paletteFor = (dark: boolean): Palette => (dark ? InkNight : Daylight);

/**
 * The brand type: Fredoka, the rounded bold geometric sans the Unity build
 * bundles (DESIGN.md "Typography"). Custom fonts on native ignore fontWeight,
 * so weights are separate families.
 */
export const Fonts = {
  semi: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const;

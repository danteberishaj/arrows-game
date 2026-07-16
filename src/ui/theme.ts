/**
 * The two theme palettes, ported verbatim from GameManager.Palette in the
 * Unity build:
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
  ink: string;
  inkDim: string;
  inkOnAccent: string;
}

export const Daylight: Palette = {
  bg: '#FFFFFF', // paper
  surface: '#EFEDF8', // panels/buttons
  border: '#E0DCEF', // faint hairline
  accent: '#6D4AEF', // royal violet (primary)
  accentCore: '#4A3E8C', // deep-violet glyphs on surface
  accentLight: '#8F76F0', // level label
  accentDeep: '#5636D6', // pressed accent
  heart: '#E4327D', // magenta-rose
  heartLost: '#DBD7ED', // spent pip
  ink: '#191724', // ink arrows/text
  inkDim: '#6E6A8A', // muted secondary text
  inkOnAccent: '#FFFFFF',
};

export const InkNight: Palette = {
  bg: '#13111C', // ink-violet night
  surface: '#201D30',
  border: '#2B2841',
  accent: '#7C5CF5',
  accentCore: '#CBC4F0', // lavender glyphs on surface
  accentLight: '#A98FF8',
  accentDeep: '#6247D6',
  heart: '#F0468C',
  heartLost: '#3B3653',
  ink: '#EFEDF9', // moonlit arrows/text
  inkDim: '#A29DC1',
  inkOnAccent: '#FFFFFF',
};

export const paletteFor = (dark: boolean): Palette => (dark ? InkNight : Daylight);

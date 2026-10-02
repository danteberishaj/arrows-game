import type { Palette } from './theme';
import type { SkinSpec } from './skinSpecs';

/** Called with the gate-resolved selection; Classic/OFF retain the original palette object. */
export function skinBoardPalette(palette: Palette, spec: SkinSpec | null, dark: boolean): Palette {
  return spec?.board ? { ...palette, bg: dark ? spec.board.dark : spec.board.light } : palette;
}

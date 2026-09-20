/**
 * Contrast audit (W0-06): the committed instrument behind PRODUCT.md's bar
 * "≥4.5:1 (body) / ≥3:1 (large) against their surface", plus WCAG 2.x SC 1.4.11's
 * 3:1 for meaningful non-text graphics and boundaries.
 *
 * Pure: imports only the palettes. `scripts/contrast-audit.ts` prints it and
 * `src/ui/__tests__/contrast.test.ts` asserts it.
 *
 * Size class is a JUDGEMENT this table records as input, not a measurement:
 *   - WCAG "large" text is ≥ 24 px regular or ≥ 18.66 px bold.
 *   - React Native font sizes are read as CSS px.
 *   - Fredoka 600 SemiBold counts as NOT bold (ruling W0-9).
 * OS font scaling above 1.0 is not modelled.
 *
 * Deliberately not rows here:
 *   - `AdHost` (src/ui/ads.tsx): renders only under `__DEV__` after W0-01, never in a release.
 *   - The 💡 hint glyph: Android and web paint emoji in their own colours, so no palette
 *     token reaches it; its disabled state is carried by opacity (W0-02).
 *   - The disabled Continue button's fill edge: WCAG 1.4.11 exempts inactive components.
 *     Its LABEL is still a gated text row (PRODUCT.md states no exemption for text).
 *   - The win/lose panel fill against its composited scrim: W5-05 owns those rows and the
 *     scrim tokens (ruling W5-1). `scrimInfo()` computes them for the script to print as
 *     information only; they are not gated here.
 */
import { Daylight, InkNight, Palette } from './theme';

export type Role = keyof Palette;
export type Kind = 'text' | 'graphic' | 'boundary';
export type Weight = 'regular' | 'semibold' | 'bold';

export interface Usage {
  id: string;
  fgRole: Role;
  /** Foreground opacity, composited over the background before measuring. Default 1. */
  fgAlpha?: number;
  bgRole: Role;
  /** Text rows only. RN font size, read as CSS px. */
  sizePx?: number;
  weight?: Weight;
  kind: Kind;
  /** `file:line` whose source line names `fgRole` (checked by contrast.test.ts). */
  site: string;
  /** Text rows: `file:line` whose source line is `fontSize: <sizePx>` (checked by the test). */
  sizeSite?: string;
  note?: string;
}

export const PALETTES: ReadonlyArray<{ name: string; palette: Palette }> = [
  { name: 'Daylight', palette: Daylight },
  { name: 'Ink Night', palette: InkNight },
];

// ---------------------------------------------------------------- colour maths

export interface Rgb { r: number; g: number; b: number } // 0..255

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** WCAG 2.x relative luminance of an sRGB colour. */
export function relativeLuminance(colour: string | Rgb): number {
  const { r, g, b } = typeof colour === 'string' ? parseHex(colour) : colour;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, (L1 + 0.05) / (L2 + 0.05) with L1 the lighter. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` at `alpha` over opaque `bg`, blended per 8-bit sRGB channel (how RN and the web draw it). */
export function composite(fg: string, alpha: number, bg: string): string {
  const f = parseHex(fg);
  const k = parseHex(bg);
  const mix = (x: number, y: number) => x * alpha + y * (1 - alpha);
  return toHex({ r: mix(f.r, k.r), g: mix(f.g, k.g), b: mix(f.b, k.b) });
}

// ---------------------------------------------------------------- HSL + solver

export interface Hsl { h: number; s: number; l: number } // h 0..360, s/l 0..100

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = parseHex(hex);
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

export interface Solution {
  from: string;
  fromHsl: Hsl;
  to: string;
  toHsl: Hsl;
  /** Lightness change in HSL percentage points (negative = darker). */
  deltaL: number;
  ratio: number;
}

/**
 * Walk HSL lightness from `hex` at its own hue and saturation, in steps of 0.1 points, in
 * both directions, and return the nearest 8-bit colour whose ratio against every
 * background in `bgs` meets `gate`. Returns the colour unchanged if it already passes;
 * null if neither direction can pass.
 */
export function solveLightness(hex: string, bgs: string[], gate: number): Solution | null {
  const fromHsl = hexToHsl(hex);
  const worst = (c: string) => Math.min(...bgs.map((b) => contrastRatio(c, b)));
  if (worst(hex) >= gate) {
    return { from: hex, fromHsl, to: hex, toHsl: fromHsl, deltaL: 0, ratio: worst(hex) };
  }
  for (let step = 1; step <= 1000; step++) {
    for (const dir of [-1, 1]) {
      const l = fromHsl.l + dir * step * 0.1;
      if (l < 0 || l > 100) continue;
      const to = hslToHex({ h: fromHsl.h, s: fromHsl.s, l });
      if (worst(to) >= gate) {
        return { from: hex, fromHsl, to, toHsl: hexToHsl(to), deltaL: l - fromHsl.l, ratio: worst(to) };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- gate

/** WCAG large text: ≥ 24 px, or ≥ 18.66 px bold (SemiBold is not bold). */
export function isLargeText(sizePx: number, weight: Weight): boolean {
  return sizePx >= 24 || (weight === 'bold' && sizePx >= 18.66);
}

export function gateFor(u: Pick<Usage, 'kind' | 'sizePx' | 'weight'>): number {
  if (u.kind !== 'text') return 3;
  if (u.sizePx === undefined || u.weight === undefined) {
    throw new Error('a text row needs sizePx and weight');
  }
  return isLargeText(u.sizePx, u.weight) ? 3 : 4.5;
}

// ---------------------------------------------------------------- usages

const HB = 'src/ui/HeaderButton.tsx';
const HS = 'src/ui/HomeScreen.tsx';
const GS = 'src/ui/GameScreen.tsx';

export const USAGES: ReadonlyArray<Usage> = [
  // Header buttons (menu theme + sound toggles HomeScreen.tsx:72-73, game back GameScreen.tsx:488).
  // The Ink Night theme toggle ☀ and the 💡 hint are emoji: no token reaches them.
  { id: 'header-glyph', fgRole: 'accentCore', bgRole: 'surface', kind: 'graphic', site: `${HB}:38` },
  { id: 'header-glyph-pressed', fgRole: 'accentCore', bgRole: 'heartLost', kind: 'graphic', site: `${HB}:38`, note: 'pressed fill is `heartLost` (HeaderButton.tsx:53)' },
  { id: 'header-glyph-off', fgRole: 'glyphOff', bgRole: 'surface', kind: 'graphic', site: `${HB}:38`, note: 'sound off glyph and its strike (HeaderButton.tsx:80)' },
  { id: 'header-button-hairline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${HB}:54` },
  { id: 'header-button-hairline-on-bg', fgRole: 'border', bgRole: 'bg', kind: 'boundary', site: `${HB}:54` },

  // Menu
  { id: 'home-level', fgRole: 'accentLight', bgRole: 'bg', sizePx: 24, weight: 'bold', kind: 'text', site: `${HS}:79`, sizeSite: `${HS}:139` },
  { id: 'home-tier-normal', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:46`, sizeSite: `${HS}:145` },
  { id: 'home-tier-hard', fgRole: 'accentText', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:45`, sizeSite: `${HS}:145` },
  { id: 'home-tier-super-hard', fgRole: 'heartText', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:44`, sizeSite: `${HS}:145` },
  { id: 'play-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 22, weight: 'bold', kind: 'text', site: `${HS}:98`, sizeSite: `${HS}:158` },
  { id: 'play-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 22, weight: 'bold', kind: 'text', site: `${HS}:98`, sizeSite: `${HS}:158` },
  { id: 'home-stats', fgRole: 'inkDim', bgRole: 'bg', sizePx: 13, weight: 'semibold', kind: 'text', site: `${HS}:102`, sizeSite: `${HS}:164` },
  { id: 'wordmark', fgRole: 'ink', bgRole: 'bg', sizePx: 56, weight: 'bold', kind: 'text', site: 'src/ui/Wordmark.tsx:35' },

  // Game header ("Hint unavailable ·" and "N left" use the same tier colour and size)
  { id: 'game-level', fgRole: 'accentLight', bgRole: 'bg', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:498`, sizeSite: `${GS}:846` },
  { id: 'game-tutorial-line', fgRole: 'accentText', bgRole: 'bg', sizePx: 18, weight: 'bold', kind: 'text', site: `${GS}:492`, sizeSite: `${GS}:852` },
  { id: 'game-tier-normal', fgRole: 'inkDim', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:478`, sizeSite: `${GS}:855` },
  { id: 'game-tier-hard', fgRole: 'accentText', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:477`, sizeSite: `${GS}:855` },
  { id: 'game-tier-super-hard', fgRole: 'heartText', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:476`, sizeSite: `${GS}:855` },
  { id: 'heart-pip', fgRole: 'heart', bgRole: 'bg', kind: 'graphic', site: `${GS}:718` },
  { id: 'heart-pip-spent', fgRole: 'pipSpent', bgRole: 'bg', kind: 'graphic', site: `${GS}:723`, note: 'outline stroke, no fill' },

  // Win / lose panel (on `surface`)
  { id: 'panel-title-won', fgRole: 'accent', bgRole: 'surface', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:559`, sizeSite: `${GS}:882` },
  { id: 'panel-title-lost', fgRole: 'heart', bgRole: 'surface', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:559`, sizeSite: `${GS}:882` },
  { id: 'star-earned', fgRole: 'accent', bgRole: 'surface', kind: 'graphic', site: `${GS}:806` },
  { id: 'star-unearned', fgRole: 'starUnearned', bgRole: 'surface', kind: 'graphic', site: `${GS}:806` },
  { id: 'panel-subline', fgRole: 'inkDim', bgRole: 'surface', sizePx: 14, weight: 'semibold', kind: 'text', site: `${GS}:570`, sizeSite: `${GS}:893` },
  { id: 'continue-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:593`, sizeSite: `${GS}:904` },
  { id: 'continue-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:593`, sizeSite: `${GS}:904` },
  { id: 'continue-label-disabled', fgRole: 'inkDim', bgRole: 'bg', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:593`, sizeSite: `${GS}:904`, note: 'no rewarded ad ready; fill is `bg` (GameScreen.tsx:585)' },
  { id: 'next-level-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:610`, sizeSite: `${GS}:904` },
  { id: 'next-level-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:610`, sizeSite: `${GS}:904` },
  { id: 'retry-label', fgRole: 'inkDim', bgRole: 'surface', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:610`, sizeSite: `${GS}:904` },
  { id: 'retry-outline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${GS}:605` },
  { id: 'panel-hairline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${GS}:558` },
  { id: 'streak-line', fgRole: 'accentText', bgRole: 'surface', sizePx: 13, weight: 'semibold', kind: 'text', site: `${GS}:615`, sizeSite: `${GS}:908` },

  // Board and splash (on `bg`); the board is not touched by W0-06, these rows only watch it
  { id: 'arrow-ink', fgRole: 'ink', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:854' },
  { id: 'arrow-press-preview-and-hint', fgRole: 'accent', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:855' },
  { id: 'arrow-blocked-flash', fgRole: 'heart', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:856' },
  { id: 'splash-arrow', fgRole: 'ink', bgRole: 'bg', kind: 'graphic', site: 'src/ui/SplashScreen.tsx:157' },
  { id: 'splash-arrowhead', fgRole: 'accent', bgRole: 'bg', kind: 'graphic', site: 'src/ui/SplashScreen.tsx:167' },
];

export interface AuditRow {
  palette: string;
  usage: Usage;
  fg: string;
  bg: string;
  ratio: number;
  gate: number;
  pass: boolean;
}

export function auditUsage(paletteName: string, p: Palette, u: Usage): AuditRow {
  const bg = p[u.bgRole];
  const fg = u.fgAlpha === undefined ? p[u.fgRole] : composite(p[u.fgRole], u.fgAlpha, bg);
  const ratio = contrastRatio(fg, bg);
  const gate = gateFor(u);
  return { palette: paletteName, usage: u, fg, bg, ratio, gate, pass: ratio >= gate };
}

export function audit(): AuditRow[] {
  return PALETTES.flatMap(({ name, palette }) => USAGES.map((u) => auditUsage(name, palette, u)));
}

/**
 * Information only (W5-05 owns and gates these): the panel fill against its composited scrim.
 * Won: black at 0.45 over `bg` (GameScreen.tsx:555). Lost: `bg` at 0.86 over `bg` (= `bg`).
 */
export function scrimInfo(): Array<{ palette: string; state: string; scrim: string; ratio: number }> {
  return PALETTES.flatMap(({ name, palette: p }) => [
    { palette: name, state: 'won', scrim: composite('#000000', 0.45, p.bg) },
    { palette: name, state: 'lost', scrim: composite(p.bg, 0.86, p.bg) },
  ].map((r) => ({ ...r, ratio: contrastRatio(p.surface, r.scrim) })));
}

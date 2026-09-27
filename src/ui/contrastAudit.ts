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
 *   - The flag-OFF win/lose panel (`surface` under 'rgba(0,0,0,0.45)' / `bg` at 0.86): `scrimInfo()`
 *     prints it as information only. The flag-ON panel (W5-05, ART_PANEL_DEPTH_ENABLED:
 *     `surfaceRaised` under `scrimWon` / `scrimLost`) IS gated: the `panel-edge-*` rows below.
 *   - Board grid dots and lines (META_BOARD_GRID, POLISH-T4, ruling R4): decorative texture
 *     under the arrows. Direction is carried by the arrowhead and a lane by the arrows
 *     themselves, so it is not a meaningful graphic (WCAG 1.4.11). Dots `border`@0.40, lines
 *     `border`@0.25, both composited over `bg` (boardGrid.ts `gridColors`): Daylight 1.55 /
 *     1.31, Ink Night 1.52 / 1.27. Its "#" toggle is a HeaderButton, already covered by the
 *     `header-glyph*` and `header-button-hairline*` rows.
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
  /** The colour `fgAlpha` composites over, when it is not the background (default `bgRole`). */
  fgOver?: (p: Palette) => string;
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
  /**
   * W5-05: the background as RENDERED when it is not the opaque `bgRole` token, e.g. a `#RRGGBBAA` scrim token
   * composited over `bg` (`compositeScrim`). Default `p[bgRole]`.
   */
  bgComposite?: (p: Palette) => string;
  /**
   * W5-05: a boundary with alternatives (the brief's panel edge: the fill against the composited scrim, OR the
   * hairline against both the scrim and the fill). The rows sharing `id` form one edge; it passes when every row
   * of at least one `via` passes, and each of its rows reports that verdict as `pass` (`ratio` stays its own).
   */
  edge?: { id: string; via: 'fill' | 'hairline' };
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

/** A `#RRGGBBAA` scrim token as its colour and 8-bit alpha (RN draws `#RRGGBBAA` with alpha AA / 255). */
export function parseScrim(scrim: string): { colour: string; alpha: number } {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(scrim);
  if (!m) throw new Error(`not a #RRGGBBAA scrim: ${scrim}`);
  return { colour: `#${m[1].toUpperCase()}`, alpha: parseInt(m[2], 16) / 255 };
}

/** A `#RRGGBBAA` scrim composited over the opaque colour under it, per 8-bit channel. */
export function compositeScrim(scrim: string, under: string): string {
  const { colour, alpha } = parseScrim(scrim);
  return composite(colour, alpha, under);
}

/**
 * The darker of the palette's `ink` and `bg` (`ink` in Daylight, `bg` in Ink Night): what the
 * missed mark (POLISH-T5, design spec C) pulls `heart` toward in both themes.
 */
export function darkerOfInkBg(p: Palette): string {
  return relativeLuminance(p.ink) <= relativeLuminance(p.bg) ? p.ink : p.bg;
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
const GAL = 'src/ui/GalleryScreen.tsx';

export const USAGES: ReadonlyArray<Usage> = [
  // Header buttons (menu theme + sound toggles HomeScreen.tsx:235-236, game back GameScreen.tsx:536).
  // The Ink Night theme toggle ☀ and the 💡 hint are emoji: no token reaches them.
  { id: 'header-glyph', fgRole: 'accentCore', bgRole: 'surface', kind: 'graphic', site: `${HB}:49` },
  { id: 'header-glyph-pressed', fgRole: 'accentCore', bgRole: 'heartLost', kind: 'graphic', site: `${HB}:49`, note: 'pressed fill is `heartLost` (HeaderButton.tsx:67)' },
  { id: 'header-glyph-off', fgRole: 'glyphOff', bgRole: 'surface', kind: 'graphic', site: `${HB}:49`, note: 'sound off glyph and its strike (HeaderButton.tsx:94)' },
  { id: 'header-button-hairline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${HB}:69` },
  { id: 'header-button-hairline-on-bg', fgRole: 'border', bgRole: 'bg', kind: 'boundary', site: `${HB}:69` },

  // Menu
  { id: 'home-level', fgRole: 'accentLight', bgRole: 'bg', sizePx: 24, weight: 'bold', kind: 'text', site: `${HS}:176`, sizeSite: `${HS}:471` },
  { id: 'home-tier-normal', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:140`, sizeSite: `${HS}:477` },
  { id: 'home-tier-hard', fgRole: 'accentText', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:139`, sizeSite: `${HS}:477` },
  { id: 'home-tier-super-hard', fgRole: 'heartText', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:138`, sizeSite: `${HS}:477` },
  { id: 'play-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 22, weight: 'bold', kind: 'text', site: `${HS}:197`, sizeSite: `${HS}:490` },
  { id: 'play-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 22, weight: 'bold', kind: 'text', site: `${HS}:197`, sizeSite: `${HS}:490` },
  { id: 'home-stats', fgRole: 'inkDim', bgRole: 'bg', sizePx: 13, weight: 'semibold', kind: 'text', site: `${HS}:282`, sizeSite: `${HS}:496`, note: "same colour on the META_BANNER path's Animated.Text (HomeScreen.tsx:263)" },
  { id: 'home-daily-entry', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:321`, sizeSite: `${HS}:515`, note: "W4-06 (META_DAILY) \"Today's board\" and its done label" },
  { id: 'home-gallery-entry', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:361`, sizeSite: `${HS}:515`, note: 'W4-09 (META_GALLERY) "Gallery" control beside the daily line' },
  { id: 'home-entry-sep', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${HS}:219`, sizeSite: `${HS}:515`, note: 'W4-10: the entry row\'s `   ·   ` separator between the daily and gallery entries' },
  { id: 'wordmark', fgRole: 'ink', bgRole: 'bg', sizePx: 56, weight: 'bold', kind: 'text', site: 'src/ui/Wordmark.tsx:35' },

  // Game header ("Hint unavailable ·" and "N left" use the same tier colour and size)
  { id: 'game-level', fgRole: 'accentLight', bgRole: 'bg', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:987`, sizeSite: `${GS}:1445` },
  { id: 'game-tutorial-line', fgRole: 'accentText', bgRole: 'bg', sizePx: 18, weight: 'bold', kind: 'text', site: `${GS}:980`, sizeSite: `${GS}:1455` },
  { id: 'game-tier-normal', fgRole: 'inkDim', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:867`, sizeSite: `${GS}:1459` },
  { id: 'game-tier-hard', fgRole: 'accentText', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:866`, sizeSite: `${GS}:1459` },
  { id: 'game-tier-super-hard', fgRole: 'heartText', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GS}:865`, sizeSite: `${GS}:1459` },
  { id: 'heart-pip', fgRole: 'heart', bgRole: 'bg', kind: 'graphic', site: `${GS}:1316` },
  { id: 'heart-pip-spent', fgRole: 'pipSpent', bgRole: 'bg', kind: 'graphic', site: `${GS}:1321`, note: 'outline stroke, no fill' },

  // Win / lose panel (on `surface`)
  { id: 'panel-title-won', fgRole: 'accent', bgRole: 'surface', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:880`, sizeSite: `${GS}:1507` },
  { id: 'panel-title-lost', fgRole: 'heart', bgRole: 'surface', sizePx: 24, weight: 'bold', kind: 'text', site: `${GS}:880`, sizeSite: `${GS}:1507` },
  { id: 'star-earned', fgRole: 'accent', bgRole: 'surface', kind: 'graphic', site: `${GS}:1404` },
  { id: 'star-unearned', fgRole: 'starUnearned', bgRole: 'surface', kind: 'graphic', site: `${GS}:1404` },
  { id: 'win-silhouette', fgRole: 'accent', bgRole: 'surface', kind: 'graphic', site: `${GS}:892`, note: 'W5-04 (ART_WIN_SILHOUETTE_ENABLED) cleared-shape badge' },
  { id: 'panel-subline', fgRole: 'inkDim', bgRole: 'surface', sizePx: 14, weight: 'semibold', kind: 'text', site: `${GS}:903`, sizeSite: `${GS}:1527` },
  { id: 'continue-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:928`, sizeSite: `${GS}:1542` },
  { id: 'continue-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:928`, sizeSite: `${GS}:1542` },
  { id: 'continue-label-disabled', fgRole: 'inkDim', bgRole: 'bg', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:928`, sizeSite: `${GS}:1542`, note: 'no rewarded ad ready; fill is `bg` (GameScreen.tsx:668)' },
  { id: 'next-level-label', fgRole: 'inkOnAccent', bgRole: 'accent', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:947`, sizeSite: `${GS}:1542`, note: 'also the daily "Done" label (W4-06)' },
  { id: 'next-level-label-pressed', fgRole: 'inkOnAccent', bgRole: 'accentDeep', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:947`, sizeSite: `${GS}:1542` },
  { id: 'retry-label', fgRole: 'inkDim', bgRole: 'surface', sizePx: 16, weight: 'bold', kind: 'text', site: `${GS}:947`, sizeSite: `${GS}:1542` },
  { id: 'retry-outline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${GS}:940` },
  { id: 'panel-hairline', fgRole: 'border', bgRole: 'surface', kind: 'boundary', site: `${GS}:1102` },
  { id: 'streak-line', fgRole: 'accentText', bgRole: 'surface', sizePx: 13, weight: 'semibold', kind: 'text', site: `${GS}:952`, sizeSite: `${GS}:1546` },

  // W5-05 (ART_PANEL_DEPTH_ENABLED): the panel's EDGE against its composited scrim, gated at 3:1 (WCAG 2.1
  // SC 1.4.11's non-text threshold, applied by analogy to a panel edge). Fill = `surfaceRaised`, scrim =
  // `scrimWon` / `scrimLost` composited over `bg` exactly as rendered (the board under the scrim is not modelled).
  // Per edge: via 'fill' (the fill against the scrim) OR via 'hairline' (`border` against the scrim AND the fill).
  { id: 'panel-edge-won-fill', fgRole: 'surfaceRaised', bgRole: 'bg', bgComposite: (p) => compositeScrim(p.scrimWon, p.bg), kind: 'boundary', site: `${GS}:858`, edge: { id: 'panel-edge-won', via: 'fill' } },
  { id: 'panel-edge-won-hairline-scrim', fgRole: 'border', bgRole: 'bg', bgComposite: (p) => compositeScrim(p.scrimWon, p.bg), kind: 'boundary', site: `${GS}:1102`, edge: { id: 'panel-edge-won', via: 'hairline' } },
  { id: 'panel-edge-won-hairline-fill', fgRole: 'border', bgRole: 'surfaceRaised', kind: 'boundary', site: `${GS}:1102`, edge: { id: 'panel-edge-won', via: 'hairline' } },
  { id: 'panel-edge-lost-fill', fgRole: 'surfaceRaised', bgRole: 'bg', bgComposite: (p) => compositeScrim(p.scrimLost, p.bg), kind: 'boundary', site: `${GS}:858`, edge: { id: 'panel-edge-lost', via: 'fill' } },
  { id: 'panel-edge-lost-hairline-scrim', fgRole: 'border', bgRole: 'bg', bgComposite: (p) => compositeScrim(p.scrimLost, p.bg), kind: 'boundary', site: `${GS}:1102`, edge: { id: 'panel-edge-lost', via: 'hairline' } },
  { id: 'panel-edge-lost-hairline-fill', fgRole: 'border', bgRole: 'surfaceRaised', kind: 'boundary', site: `${GS}:1102`, edge: { id: 'panel-edge-lost', via: 'hairline' } },

  // Shape gallery (W4-09, META_GALLERY), on `bg`. Filled versus outlined carries
  // collected versus not, so the colours only have to be legible (PRODUCT.md:63).
  { id: 'gallery-count', fgRole: 'inkDim', bgRole: 'bg', sizePx: 15, weight: 'semibold', kind: 'text', site: `${GAL}:105`, sizeSite: `${GAL}:259`, note: 'the "N of M" count line' },
  { id: 'gallery-name', fgRole: 'inkDim', bgRole: 'bg', sizePx: 12, weight: 'semibold', kind: 'text', site: `${GAL}:238`, sizeSite: `${GAL}:277`, note: "a collected shape's display name" },
  { id: 'gallery-tile-collected', fgRole: 'ink', bgRole: 'bg', kind: 'graphic', site: `${GAL}:192`, note: 'collected silhouette, filled (even-odd)' },
  { id: 'gallery-tile-outline', fgRole: 'pipSpent', bgRole: 'bg', kind: 'graphic', site: `${GAL}:201`, note: 'not-collected silhouette, outline only (no fill)' },

  // Board and splash (on `bg`); the board is not touched by W0-06, these rows only watch it
  { id: 'arrow-ink', fgRole: 'ink', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:1052' },
  { id: 'arrow-press-preview-and-hint', fgRole: 'accent', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:1053' },
  { id: 'arrow-blocked-flash', fgRole: 'heart', bgRole: 'bg', kind: 'graphic', site: 'src/ui/BoardView.tsx:1054' },
  { id: 'arrow-missed-mark', fgRole: 'heart', fgAlpha: 0.75, fgOver: darkerOfInkBg, bgRole: 'bg', kind: 'graphic', site: 'src/ui/missedMarks.ts:22', note: 'META_MISSED_MARK (R6): an arrow whose blocked tap cost a heart, for the rest of the level' },
  { id: 'splash-arrow', fgRole: 'ink', bgRole: 'bg', kind: 'graphic', site: 'src/ui/SplashScreen.tsx:161' },
  { id: 'splash-arrowhead', fgRole: 'accent', bgRole: 'bg', kind: 'graphic', site: 'src/ui/SplashScreen.tsx:171' },
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
  const bg = u.bgComposite ? u.bgComposite(p) : p[u.bgRole];
  const over = u.fgOver ? u.fgOver(p) : bg;
  const fg = u.fgAlpha === undefined ? p[u.fgRole] : composite(p[u.fgRole], u.fgAlpha, over);
  const ratio = contrastRatio(fg, bg);
  const gate = gateFor(u);
  return { palette: paletteName, usage: u, fg, bg, ratio, gate, pass: ratio >= gate };
}

export function audit(): AuditRow[] {
  const rows = PALETTES.flatMap(({ name, palette }) => USAGES.map((u) => auditUsage(name, palette, u)));
  // W5-05 edges: a row of an edge reports the EDGE's verdict (some `via` whose rows all meet the gate).
  const verdict = new Map<string, boolean>();
  for (const r of rows) {
    if (!r.usage.edge) continue;
    const key = `${r.palette}/${r.usage.edge.id}`;
    const vias = rows.filter((x) => x.palette === r.palette && x.usage.edge?.id === r.usage.edge!.id);
    const ok = (['fill', 'hairline'] as const).some((via) => {
      const own = vias.filter((x) => x.usage.edge!.via === via);
      return own.length > 0 && own.every((x) => x.ratio >= x.gate);
    });
    verdict.set(key, ok);
  }
  return rows.map((r) => (r.usage.edge ? { ...r, pass: verdict.get(`${r.palette}/${r.usage.edge.id}`)! } : r));
}

/** W5-05: each palette's panel edges, with the ratios of every alternative (for the report and the script). */
export function panelEdges(): Array<{ palette: string; edge: string; pass: boolean; via: string; rows: AuditRow[] }> {
  const rows = audit().filter((r) => r.usage.edge);
  const keys = [...new Set(rows.map((r) => `${r.palette}|${r.usage.edge!.id}`))];
  return keys.map((k) => {
    const [palette, edge] = k.split('|');
    const own = rows.filter((r) => r.palette === palette && r.usage.edge!.id === edge);
    const via = (['fill', 'hairline'] as const).find((v) => {
      const x = own.filter((r) => r.usage.edge!.via === v);
      return x.length > 0 && x.every((r) => r.ratio >= r.gate);
    });
    return { palette, edge, pass: via !== undefined, via: via ?? 'none', rows: own };
  });
}

/**
 * Information only (W5-05 owns and gates these): the panel fill against its composited scrim.
 * Won: black at 0.45 over `bg` (GameScreen.tsx:638). Lost: `bg` at 0.86 over `bg` (= `bg`).
 */
export function scrimInfo(): Array<{ palette: string; state: string; scrim: string; ratio: number }> {
  return PALETTES.flatMap(({ name, palette: p }) => [
    { palette: name, state: 'won', scrim: composite('#000000', 0.45, p.bg) },
    { palette: name, state: 'lost', scrim: composite(p.bg, 0.86, p.bg) },
  ].map((r) => ({ ...r, ratio: contrastRatio(p.surface, r.scrim) })));
}

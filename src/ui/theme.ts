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
  /**
   * W5-05 (ART_PANEL_DEPTH_ENABLED only): the win / lose panel's fill. Depth by value, never a shadow: a lightness
   * step at the hue and saturation of `surface`. The panel edge must reach 3:1 against the composited scrim, by the
   * fill itself or by the `border` hairline against both (contrastAudit.ts `panel-edge-*`).
   */
  surfaceRaised: string;
  /** W5-05 (flag only): the win overlay's scrim, `#RRGGBBAA` (today's colour, black, with its alpha stepped). */
  scrimWon: string;
  /** W5-05 (flag only): the lose overlay's scrim, `#RRGGBBAA` (today: `bg` at 0.86). */
  scrimLost: string;
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
  // W5-05 candidate set B (artifacts/W5-05/owner-panel-depth.png; the owner picks A, B, C or none in W5-20):
  surfaceRaised: '#FAF9FD', // OWNER-PICKED STARTING VALUE: surface's hue/sat at L 98.5; 3.21:1 on the won scrim
  scrimWon: '#00000073', // OWNER-PICKED STARTING VALUE: today's black at 0.45 (115/255)
  scrimLost: '#FFFFFFDB', // OWNER-PICKED STARTING VALUE: today's bg at 0.86 (219/255); the hairline carries the edge
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
  // W5-05: a lighter Night fill loses the hairline edge until it reaches 3:1 on its own (L >= 45, where panel text
  // fails), so every candidate set keeps Ink Night's panel at today's value and its hairline carries the edge.
  surfaceRaised: '#201D30', // OWNER-PICKED STARTING VALUE: = surface
  scrimWon: '#00000073', // OWNER-PICKED STARTING VALUE: today's black at 0.45
  scrimLost: '#13111CDB', // OWNER-PICKED STARTING VALUE: today's bg at 0.86
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

/** One text role's type: exactly the keys its style had before W5-08 (a role without a family keeps none). */
export interface TypeStyle {
  readonly fontSize: number;
  readonly fontFamily?: string;
  readonly letterSpacing?: number;
}

const type = (t: TypeStyle): TypeStyle => Object.freeze(t);

/**
 * W5-08: every text size the app draws, one named entry per role, holding exactly the fontSize, fontFamily and
 * letterSpacing its style had before (no value changed). DESIGN.md's type scale is in Unity 1080x1920 units and was
 * never translated into dp; changing any value here, or merging roles into a scale, is a W5-20 owner question. A
 * style spreads its entry and keeps its other keys (margins, lineHeight, position). Computed sizes stay computed:
 * HeaderButton's glyph (size x 0.44) and the Wordmark's letters (its `size`, which the menu passes from `wordmark`).
 */
export const Type = Object.freeze({
  // Menu (HomeScreen)
  wordmark: type({ fontSize: 56 }),
  menuLevel: type({ fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 0.5 }),
  menuTier: type({ fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 }),
  menuPlay: type({ fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 1 }),
  menuStats: type({ fontSize: 13, fontFamily: Fonts.semi }),
  /** W4-06 / W4-09 entry row. OWNER-PICKED STARTING VALUE (W4-06: the tier label's size). */
  menuEntry: type({ fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 }),
  // Game header (GameScreen)
  gameLevel: type({ fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 1 }),
  /** The tutorial line (it also carries gameLevel's family and spacing, so the drawn text is unchanged). */
  gameTutorial: type({ fontSize: 18, fontFamily: Fonts.bold, letterSpacing: 1 }),
  /** Tier, shape name, "N left", "Hint unavailable ·". */
  gameTier: type({ fontSize: 12, fontFamily: Fonts.semi, letterSpacing: 0.5 }),
  // Win / lose panel (GameScreen)
  panelTitle: type({ fontSize: 24, fontFamily: Fonts.bold }),
  /** The win stars (the ★ glyph in the OS font: no family; with W5-02's ART_ICONS_ENABLED, the star icon's edge). */
  star: type({ fontSize: 34 }),
  starBig: type({ fontSize: 44 }),
  panelSub: type({ fontSize: 14, fontFamily: Fonts.semi }),
  panelButton: type({ fontSize: 16, fontFamily: Fonts.bold }),
  panelStreak: type({ fontSize: 13, fontFamily: Fonts.semi }),
  // Shape gallery (GalleryScreen, W4-09)
  /** OWNER-PICKED STARTING VALUE (W4-09: the menu tier label's size). */
  galleryCount: type({ fontSize: 15, fontFamily: Fonts.semi, letterSpacing: 0.5 }),
  /** OWNER-PICKED STARTING VALUE (W4-09). */
  galleryName: type({ fontSize: 12, fontFamily: Fonts.semi }),
  // The dev-only simulated ad (ads.tsx AdHost, __DEV__ only)
  adTag: type({ fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 2 }),
  adTitle: type({ fontSize: 18, fontFamily: Fonts.bold }),
  adCount: type({ fontSize: 44, fontFamily: Fonts.bold }),
  adSub: type({ fontSize: 12, fontFamily: Fonts.semi }),
});

export type TypeRole = keyof typeof Type;

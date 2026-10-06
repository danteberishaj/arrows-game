/**
 * W5 art-direction flags (docs/next-level/tasks/W5.md, "Conventions"). Each
 * flagged W5 task adds only its own constant, in the form
 * `export const ART_X_ENABLED = process.env.EXPO_PUBLIC_ART_X === '1'`. A
 * player build sets none of them; the owner's flip in W5-20 replaces an
 * expression with `true` in a reviewed commit.
 */

/**
 * W5-04: the win panel shows the cleared board's silhouette
 * (src/ui/silhouette.ts), filled in `accent` with the even-odd rule, directly
 * under "Cleared!" and above the stars. It has no animation of its own: it
 * enters with the panel. OFF: the panel renders exactly as before.
 */
export const ART_WIN_SILHOUETTE_ENABLED = process.env.EXPO_PUBLIC_ART_WIN_SILHOUETTE === '1';

/**
 * Badge edge in dp. The owner picks 48, 64 or 96 from the W5-01 contact sheets
 * (artifacts/W5-01/silhouette-sheet-{48,64,96}dp.png) in W5-20.
 */
export const ART_WIN_SILHOUETTE_DP = 64; // OWNER-PICKED STARTING VALUE

/**
 * W5-06: the game header's mission row shows the level's silhouette
 * (src/ui/silhouette.ts) in place of the shape-name word: `Super Hard · [badge]
 * · 202 left`. The badge is drawn in the word's tier colour with the even-odd
 * rule, is exactly one text line tall (measured from the row, never a
 * constant), and carries the shape name for screen readers. Tutorial boards
 * (empty mask) keep the word. OFF: the row renders exactly as before.
 */
export const ART_HEADER_SILHOUETTE_ENABLED = process.env.EXPO_PUBLIC_ART_HEADER_SILHOUETTE === '1';

/**
 * W5-05: the win and lose panels get depth by value alone (no shadow, gradient or glow): the panel fill
 * is `surfaceRaised` and the scrims are the palette's `scrimWon` / `scrimLost` (theme.ts), whose composited panel
 * edge is gated at 3:1 (contrastAudit.ts `panel-edge-*`), plus a spacing hierarchy (outcome, evidence, action).
 * OFF: the panels render exactly as before.
 */
export const ART_PANEL_DEPTH_ENABLED = process.env.EXPO_PUBLIC_ART_PANEL_DEPTH === '1';

/**
 * W5-14 spike (menu only): a seamless paper grain tile (assets/images/grain.png, scripts/art/generate-grain.mjs)
 * repeated over the HomeScreen background, tinted `ink` and drawn at ART_PAPER_TEXTURE_OPACITY. Never on the game
 * screen: the native board view is transparent, so a texture there would sit behind the arrows. OFF: the menu renders
 * exactly as before.
 */
export const ART_PAPER_TEXTURE_ENABLED = process.env.EXPO_PUBLIC_ART_PAPER_TEXTURE === '1';

/** The grain layer's opacity. The owner picks from the 0.02 / 0.04 / 0.06 / 0.08 captures (a sampling grid) in W5-20. */
export const ART_PAPER_TEXTURE_OPACITY = 0.04; // OWNER-PICKED STARTING VALUE

/**
 * W5-02: the control marks (back, hint, theme, sound, the win stars, the perfect-streak sparkle, the Continue heart)
 * are SVG icons from src/ui/icons.tsx instead of OS font glyphs and colour emoji, and every HeaderButton is a circle
 * (radius size / 2) instead of a rounded square. The sound-off state is its own icon (speaker + slash), so the
 * button's W0-06 strike is not drawn over it. OFF: every one of these renders exactly as before.
 */
export const ART_ICONS_ENABLED = process.env.EXPO_PUBLIC_ART_ICONS === '1';

/**
 * W5-16 (dead-band option D, owner pick 2026-10-06): the game screen's hint button leaves the header's right end and
 * floats at the bottom left, the mirror twin of the removed POLISH-T4 "#" grid toggle (a 44 dp HeaderButton, 16 dp
 * plus the safe-area insets from its corner). Relocation only: the same handler, ready/disabled state, a11y name,
 * role and hit slop; hidden on tutorial boards as before; it stays on top of the board when the player zooms in,
 * as the "#" toggle did. The hearts then end the header row. OFF: the game screen renders exactly as before.
 */
export const ART_DEAD_BAND_ENABLED = process.env.EXPO_PUBLIC_ART_DEAD_BAND === '1';

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

# Product

## Register

product

## Users

Casual mobile players (Android/iOS, plus a web build for testing), playing in short
relaxed sessions (commute, couch, before bed). They want a calm but satisfying brain
teaser — no timers, no pressure. They open the app, tap Play, and expect to resume
exactly where they left off.

## Product Purpose

"Arrows" is a minimalist logic puzzle: a grid of directional arrows; tap one to fire
it off the board in its direction. If the straight path to the edge is blocked by
another arrow, it's a collision (costs a heart). Clear the board to advance. The
puzzle is finding the order. Success = the player keeps flowing from one level to the
next without friction, and the game looks clean and premium — its own brand ("Ink
Night"), mechanically inspired by the genre but visually unmistakable from it.

This repo is the React Native (Expo) port of the Unity original; the engine-free core
(BoardLogic / LevelGenerator / ShapeLibrary) is a 1:1 translation and both share the
brand.

## Brand Personality

Clean, calm, confident. Three words: **night, minimal, focused.** Gameplay should feel
effortless — the UI disappears into the puzzle: moonlit near-white arrows on ink-dark
paper (or black ink on white paper in Daylight). Identity is carried by one
royal-violet primary, magenta-rose hearts and rounded type — never by glow or noise.
Built for where the game is actually played: couch or bed, lights low, a five-minute
puzzle before sleep.

## Anti-references

- Generic template look: chunky shapes on flat gray, default fonts, no craft.
- Busy hyper-casual ad-game UI: confetti spam, mismatched bright colors, fake buttons.
- Cluttered level-select grids and menus the player navigates every session.
- Neon "glow" treatments — dark here means calm ink, not cyberpunk. No bloom, no
  gradients, no glow pulses.
- The reference game's look (bright white paper + periwinkle blue) — we deliberately
  moved away from it; do not drift back toward it.

## Design Principles

1. **The board is sacred.** Gameplay reads instantly — arrows are clear, evenly spaced,
   uniform in weight, never a chunky or inconsistent mess even on dense boards. No
   frame, no grid lines, no tile backgrounds.
2. **One violet accent.** Royal violet carries identity (Play, level label, logo ▲,
   stars); magenta-rose is reserved for hearts and the blocked-arrow flash. Arrows are
   plain ink on the surface. No decorative color soup.
3. **Flow over menus.** Open → Play → resume → next level. No level-select detour;
   progress is always saved.
4. **Motion conveys state.** In-game motion = feedback (exit slither, collision flash
   + shake, star pops on clear). The menu is calm — the Play pill's gentle breathing is
   the one deliberate ambient motion.

## Accessibility & Inclusion

- Text and arrows meet ≥4.5:1 (body) / ≥3:1 (large) against their surface.
- Direction is conveyed by arrow *shape*, never color alone (colorblind-safe).
- Generous tap targets (full grid cell), portrait-first, large readable rounded type.
- In-game motion is brief feedback only; no gameplay action depends on animation.

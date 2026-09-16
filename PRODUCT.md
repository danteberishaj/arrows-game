# Product

## Register

product

## Users

Casual mobile players (Android/iOS, plus a web build for testing), playing in short
relaxed sessions (commute, couch, before bed). They want something calm to look at and
satisfying to clear: no timers, no pressure, nothing to plan ahead. They open the app, tap
Play, and expect to resume exactly where they left off.

## Product Purpose

"Arrows" is a calm attention game, a visual search: a picture drawn entirely out of
directional arrows. Tap an arrow to fire it off the board in its direction. The player's
job is to find the arrows whose straight lane to the edge is clear. Tapping one whose
lane is blocked by another arrow costs a heart. Clear the picture to advance.

- **No tap order can make a board unsolvable.** Removing an arrow only empties cells, so
  a lane that is clear stays clear, and every dealt board is solvable by construction. So
  any sequence of clear-lane taps empties the board in exactly one tap per arrow
  (`src/core/__tests__/noDeadEnd.test.ts` checks this on 50 random tap orders across 10
  levels). The only failure is a misread, and hearts forgive misreads.
- **Difficulty is legibility, not tap order.** A board gets harder through how easily its
  arrows read, how dense it is, how few of its arrows are clearable when it is dealt, and
  how unfamiliar its silhouette is. The game adds no ordering mechanic, and difficulty never
  comes from the order of taps.
- **Success** is unbroken flow from one level to the next, and a game that looks clean and
  premium: its own brand ("Ink Night"), inspired by the arrow-puzzle genre but visually
  unmistakable from it. The pictures made of arrows are the content.

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
4. **Motion conveys state.** In-game motion = feedback (exit slither, blocked-arrow bump,
   blocker flash, star pops on clear). The menu is calm — the Play pill's gentle breathing is
   the one deliberate ambient motion. Under the OS reduce-motion setting, feedback that
   carries information (blocker flash, blocked arrow, hint) renders a **static equivalent**,
   honouring the setting; decorative motion (heart pop, star pops, Play breathing, splash)
   may simply be skipped.

## Accessibility & Inclusion

- Text and arrows meet ≥4.5:1 (body) / ≥3:1 (large) against their surface.
- Direction is conveyed by arrow *shape*, never color alone (colorblind-safe).
- Generous tap targets (full grid cell), portrait-first, large readable rounded type.
- Reduce motion is honoured, never overridden. Information-carrying feedback (blocker
  flash, blocked arrow, hint) renders a static equivalent under the OS setting, so the
  explanation of a failed tap survives; decorative motion (heart pop, star pops, Play
  breathing, splash) may simply be skipped.

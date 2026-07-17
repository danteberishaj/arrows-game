# Design

Visual system for "Arrows" (Unity 6, procedural UGUI built in code). One brand, **two
theme variants** sharing the royal-violet primary and magenta-rose hearts:

- **Daylight** (default) — white paper, near-black ink arrows.
- **Ink Night** — deep ink-violet night, moonlit near-white arrows. Built for the couch /
  in-bed session with the lights low.

A circular **moon/sun toggle on the menu** (next to the sound toggle) flips the variant;
the choice persists (`SaveSystem.DarkMode`) and the procedural UI rebuilds on toggle.
The brand deliberately diverges from the reference game (Arrows – Puzzle Escape): their
identity is periwinkle *blue* on white; ours is royal *purple* + magenta, day or night.

## Theme

No board frame, no grid lines, no tile backgrounds, no header divider — the game screen
is nothing but the arrows, the hearts and three floating circular buttons. Arrows are
plain ink "pipes" (near-black on Daylight, moonlit near-white on Ink Night) that tangle
into a maze. Color is used sparingly: one **royal-violet** primary for branding and
actions, and **magenta-rose** for hearts and the "blocked" flash. Calm and airy, not
neon: no glow, no gradients, flat inks only.

## Color

All colors route through `GameManager.Palette`, which switches between the two sets
(`Palette.SetDark`) before the UI is (re)built.

| Role | Daylight (default) | Ink Night | Notes |
|---|---|---|---|
| bg | `#FFFFFF` | `#13111C` | dominant surface |
| surface | `#EFEDF8` | `#201D30` | circular buttons, panels |
| border | `#E0DCEF` | `#2B2841` | reserved hairline (currently unused) |
| muted / spent | `#DBD7ED` | `#3B3653` | spent heart pip, disabled |
| ink | `#191724` | `#EFEDF9` | arrows + body text |
| ink-dim | `#6E6A8A` | `#A29DC1` | secondary text (stats line, Normal tier) |
| accent | `#6D4AEF` | `#7C5CF5` | Play button, logo ▲, Hard tier, hint pulse |
| accent-light | `#8F76F0` | `#A98FF8` | "Level N" label (decorative, large only) |
| accent-core | `#4A3E8C` | `#CBC4F0` | icon glyphs on `surface` circles |
| accent-deep | `#5636D6` | `#6247D6` | pressed accent |
| heart / danger | `#E4327D` | `#F0468C` | hearts, blocked flash, Super Hard tier |
| on-accent | `#FFFFFF` | `#FFFFFF` | Play label |

Contrast (vs its own bg): ink ≈ 16:1 / 15:1; ink-dim ≈ 4.8:1 / 6.5:1; accent-light
(large decorative only) ≈ 3.2:1 / 5:1; white on accent ≈ 5:1 / 4.8:1 (large bold).

## Typography

One family: a **rounded bold geometric sans** (Fredoka, SIL OFL, bundled as the runtime
font); SemiBold–Bold.
- Logo "Arrows": ~150, bold. The capital **A is a filled `accent` violet triangle** (▲rrows)
  against the moonlit `ink` wordmark — the one place brand color and ink meet at full size.
- "Level N": ~48, `accent-light`.
- Play label: ~46, bold, white on accent.
- Body/toast: ~36, ink.

## Components

- **Arrow**: moonlit near-white, rounded-cap line-art (stroke ≈ **0.14 × cell**), a multi-cell path
  whose 90° bends are **rounded with a small fixed-radius corner fillet** (~0.12 cell — tight,
  crisp turns, not wide sweeps; the legs stay straight up to the corner), ending
  in a **solid filled triangular** arrowhead. Baked as white coverage and **mipmapped /
  trilinear** so strokes stay even and consistent when the board is scaled to fit (no
  minification aliasing). No glow, no tile, no per-arrow color. Selected/blocked → recolor
  the whole arrow `heart` magenta `#F0468C`. Sized so neighbors nearly connect into a maze.
  **Generated shapes are short and bendy but kept clean**: a straight "neck" runs directly
  behind the head (the arrowhead never sits on a corner), and arrows are length-capped, so even
  a multi-bend piece is just a small L / Z / S tetromino — most arrows bend, but none squiggle
  into long staircases. See "Levels (procedural shapes)" below.
- **Board**: **no frame, no grid, no tile backgrounds.** Arrows float on the night ink, centered
  and scaled to fit. A level **opens fully zoomed out** so the whole shape reads at a glance;
  pinch-zoom + drag to inspect and tap on big boards.
- **Header (gameplay)**: centered "Level N" (`accent-light`) with the **difficulty tier just
  below it** (colour-coded: `ink-dim` Normal, `accent` Hard, `heart` Super Hard) and the
  heart row beneath that; no divider — the header floats on the ink. **Top-left: one circular
  `surface` back button** (◀, `accent-core` glyph); retrying lives on the out-of-hearts panel,
  not the header. **Top-right: a circular `surface` Hint button** (lightbulb glyph, `accent`
  violet) that highlights a safe next move. (No bottom button bar.)
- **Hint**: tapping it finds an arrow that can currently exit (always a safe move — removing
  an arrow only frees cells, never blocks others), centres the board on it, and pulses it in
  `accent`. The arrow stays tappable; the player still makes the move. Unlimited for now (no
  coin/ad gating yet).
- **Hearts**: 3 classic heart shapes (same count at every difficulty); full = magenta `#F0468C`,
  spent = `muted #3B3653`.
- **Button (primary)**: `accent` rounded pill, white bold label, **no glow**; pressed →
  slightly darker accent.
- **Menu**: night ink; logo in the upper-middle, "Level N" beneath it (`accent-light`) with the
  resume level's **difficulty** under that (same colour-coding as the header), big violet
  Play pill in the lower third. Generous whitespace. **Top-right: a circular `surface` sound
  toggle** (speaker glyph — `accent-core` when on, `muted` when off; persisted). Near the
  bottom, one quiet `ink-dim` **lifetime-stats line** ("N puzzles solved · D-day streak ·
  best perfect run K") — hidden until the first solve, streak/run parts shown only from 2 up.
- **Stats & streaks** (`SaveSystem`): lifetime **solved count**, a **perfect streak**
  (consecutive clears with no heart lost; current + best), and a **daily play streak**
  (consecutive calendar days with ≥1 solve; reads 0 once broken). All PlayerPrefs-backed,
  updated on every solve.

## Levels (procedural shapes)

Every level is a recognizable **picture made of arrows**: the arrows completely fill the
silhouette of a shape, so the board reads as a square, a circle, a heart, a star, a trophy…
Empty dark surrounds the shape (for square/rectangle the shape *is* the whole grid).

- **Shape by tier** (): each tier has its own pool. **Normal** draws plain
  fills — square, rectangle, circle, diamond. **Hard** draws geometric figures — circle,
  diamond, triangle, plus, hexagon, hourglass. **Super Hard** draws picture-book
  silhouettes — heart, star, trophy, crescent moon, flower, lightning bolt, arrow, crown.
  Shapes are defined as point-in-polygon / implicit-inequality tests in a normalized −1..1
  space, so they rasterize cleanly to *any* board size (no bitmaps; sampled 3×3 per cell so
  thin features like the crescent's horns stay clean).
- **Full fill, guaranteed solvable** (`LevelGenerator`): the silhouette is packed so **every
  shape cell holds an arrow**, and the board is solvable *by construction*. Both come from one
  "peel" rule — only ever carve an arrow whose head has a **clear straight lane to the board
  edge through the cells that are still unfilled**. The top-most unfilled row can always point
  up with nothing unfilled above it, so a valid arrow exists until the shape is full (⇒ 100%
  fill); and carving in that order is itself a valid solution (when an arrow leaves, everything
  carved after it is still on the board, and its lane was chosen clear of exactly those cells).
- **Short, bendy arrows (no long stripes)**: arrows are deliberately **short** (length ~4–6,
  hard-capped) and **most of them bend** — the shape is a dense tangle of little L/Z/U pieces, not
  a venetian-blind of long straight strokes. Three rules keep the bends clean and plentiful:
  (a) a **2-cell straight neck** behind every head before the first turn, so a bend is **never
  right at the arrowhead** (a 1-cell neck reads as a goofy corner-head); (b) head selection is
  **biased toward spots where a clean L fits** (2 straight cells + a free perpendicular) and the
  body grows into the *most-constrained* neighbour so the fill doesn't strand cells; (c) a final
  **tail mop-up** absorbs dead-end cells into the arrow (far from the head) as extra bends.
  Net result: **most arrows bend (~60–70%, the majority on every board), zero corner-heads, zero
  long straight stripes**, every shape cell filled.
- **Difficulty** (`Difficulty.cs`): big boards + lots of pieces at every tier, so even Normal is
  meaty and Super Hard is brutal. Normal ~19–23 cells across, Hard ~25–29, Super Hard ~32–38
  (≈70–200 arrows/level on Normal, up to ~260 on the big Hard rectangles, ~130–300 on the huge
  Super Hard silhouettes). The board fits-to-view and the player pinch-zooms, so grids are free
  to be large. **Always 3 lives**, regardless of tier. Raise difficulty with **board size /
  shape complexity / piece count**, never with bendier-or-longer arrows.
- **Determinism**: difficulty, the chosen shape, the board size and the layout are all pure
  functions of the level index, so resume / retry reproduce the same picture.

(The engine-free core — `ShapeLibrary`, `LevelGenerator`, `BoardLogic`, `ArrowPath`,
`Difficulty`, `Direction` — uses only `System.*`, so it can be compiled and validated headlessly
outside Unity. An editor-only duplicate generator lives in `ArrowsSetup.GenerateArrows` for the
legacy `LevelData` assets; the runtime no longer uses those.)

## Motion

Calm canvas, quick juice. **No ambient glow, no drifting arrows, no pulse loops** — the board
itself stays still and serene. Motion is reserved for *feedback and flow*: every effect is
short (≈60–280 ms) and eases out, so taps feel satisfying without breaking the minimalist
mood. All tweens are coroutine-based in `UITween.cs` (easings + `Fade`/`Scale`/`Pop`); no
external tween library.

- **Screen transitions** (`GameManager` + per-screen `CanvasGroup`): menu ↔ game and
  level → level **cross-fade** (~160–220 ms) instead of hard cuts. The board is laid out and
  fit-to-view while still at alpha 0, then faded in, so there's no layout pop.
- **Menu entrance**: the menu fades in and the Play pill springs from 0.9 → 1 (`EaseOutBack`),
  then settles into a gentle **idle "breathing" pulse** (`IdlePulse`, ±3% over ~1.8 s) as a
  soft "tap me" affordance — the one deliberate bit of ambient motion, on the Play button only.
- **Hint**: the suggested arrow pulses `accent` with a small decaying swell (~1.1 s) after the
  board recentres on it.
- **Button press-feel** (`ButtonPress`, on every button): scale to 0.94 on press, spring back
  on release, on top of the existing colour tint — a small tactile "click."
- **Heart loss**: the spent pip **pops** (scale ~1.35) and fades magenta `#F0468C` → muted
  `#3B3653`, so losing a life is unmistakable.
- **Arrow exit** (`SlitherExit`): the arrow flows head-first off the board along its own
  (bent) path as a solid moonlit tube, accelerating out + fading at the end; plays a soft
  recorded whoosh (`Resources/Audio/whoosh.mp3`, synth fallback in `AudioManager`).
- **Blocked** (`ArrowTile.PlayShake`): short horizontal shake + brief scale swell + flash the
  arrow magenta `#F0468C`, settling back to moonlit ink.
- **Solved**: "Solved!" toast **pops in** (accent), holds briefly, fades out, then the next
  level fades in. A clear with **no hearts lost** upgrades the toast to **"Perfect!"** with a
  subline ("No hearts lost — N in a row!" once a perfect streak builds). **Out of hearts**:
  a dark night scrim fades in and the title pops.

## Layout

Portrait 1080×1920, CanvasScaler match 0.5. Themed canvas. Header band at top (centered
level label + heart row, one circular back button top-left, hint top-right). Board
centered, fit-to-view. No bottom bar.

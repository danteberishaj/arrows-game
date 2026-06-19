# Design

Visual system for "Arrows" (Unity 6, procedural UGUI built in code), **matched to the
reference game we are cloning — Arrows – Puzzle Escape (`com.ecffri.arrows`, Lessmore).**
Palette + layout below were sampled directly from that game's official store screenshots.
Theme: **Bright Minimal** — pure white paper, black line-art arrows, one friendly
periwinkle accent. (This replaces the earlier dark "Neon Flow" emerald concept, which did
not match the real game.)

## Theme

A clean **white** background. No dark mode, no glow, no board frame, no grid lines, no tile
backgrounds. Arrows are plain **black** rounded "pipes" that float on the white and tangle
into a maze. Color is used sparingly: a single **periwinkle-indigo** accent for branding
and primary actions, and **coral-red** for the heart counter and the "blocked" arrow
highlight. Calm, airy, lots of whitespace — friendly casual-puzzle, not neon.

## Color (sampled from the reference screenshots)

| Role | Hex | Unity RGB 0–1 | Notes |
|---|---|---|---|
| bg | `#FFFFFF` | 1, 1, 1 | pure white, dominant surface (~85–93% of every screen) |
| surface | `#EBEDF6` | 0.922, 0.929, 0.965 | header/footer band, circular buttons, dividers |
| muted | `#CED4F7` | 0.808, 0.831, 0.969 | spent heart pip, disabled |
| ink | `#111111` | 0.067, 0.067, 0.067 | black arrows + body text (sampled core `#010101`) |
| accent | `#5A71FE` | 0.353, 0.443, 0.996 | Play button, primary action, selection |
| accent-light | `#8E9CEF` | 0.557, 0.612, 0.937 | "Level N" label (decorative, large only) |
| accent-deep | `#303A74` | 0.188, 0.227, 0.455 | logo, headings, icon glyphs |
| heart / red-state | `#FC4A5C` | 0.988, 0.290, 0.361 | hearts (×5) and blocked-arrow highlight |
| on-accent | `#FFFFFF` | 1, 1, 1 | Play label |

Contrast: ink on white ≈ 17:1; accent-deep on white ≈ 9:1; accent on white ≈ 4.6:1 (large
text / buttons only). accent-light is low-contrast and used for the large decorative level
label only, never body text.

## Typography

One family: a **rounded bold geometric sans** (the reference uses a Fredoka/Baloo-style
face). Plan: bundle **Fredoka** (SIL OFL, free to ship) as a TMP/font asset; SemiBold–Bold.
- Logo "Arrows": ~150, bold. The capital **A is a filled `accent-deep` triangle** (▲rrows).
- "Level N": ~48, `accent-light`.
- Play label: ~46, bold, white on accent.
- Body/toast: ~36, ink.

## Components

- **Arrow**: black, rounded-cap line-art (stroke ≈ **0.14 × cell**), a multi-cell path
  whose 90° bends are **smoothly rounded** (Chaikin corner-cutting on the centerline), ending
  in a **solid filled triangular** arrowhead. Baked as white coverage and **mipmapped /
  trilinear** so strokes stay even and consistent when the board is scaled to fit (no
  minification aliasing). No glow, no tile, no per-arrow color. Selected/blocked → recolor
  the whole arrow `heart`/red `#FC4A5C`. Sized so neighbors nearly connect into a maze.
- **Board**: **no frame, no grid, no tile backgrounds.** Arrows float on white, centered
  and scaled to fit (fit-to-view default; pinch-zoom + drag still available on big boards).
- **Header (gameplay)**: centered "Level N" (`accent-light`) with the heart row beneath it;
  a thin `surface` divider under the header. **Top-left: two circular `surface` buttons**
  — back (◀) and restart (↻) — with `accent-deep` glyphs. (No bottom button bar.)
- **Hearts**: 5 classic heart shapes; full = `#FC4A5C`, spent = `muted #CED4F7`.
- **Button (primary)**: `accent` rounded pill, white bold label, **no glow**; pressed →
  slightly darker accent.
- **Menu**: white; logo in the upper-middle, "Level N" beneath it (`accent-light`), big
  periwinkle Play pill in the lower third. Generous whitespace.

## Motion

Minimal and functional — **no ambient neon, no drifting arrows, no glow pulse.** 150–250 ms,
ease-out.
- Arrow exit: slide/rotate the arrow off the board along its own path + fade (the
  reference's "smooth rotations").
- Blocked: short shake + flash the arrow red `#FC4A5C`.
- Solved: gentle fade to the next level (brief "Solved!" toast).

## Layout

Portrait 1080×1920, CanvasScaler match 0.5. White canvas. Header band at top (centered
level label + heart row, two circular back/restart buttons top-left). Board centered,
fit-to-view. No bottom bar — back/restart live as the top-left circles, matching the
reference.

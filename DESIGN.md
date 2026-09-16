# Design

Visual system for "Arrows" (React Native / Expo SDK 57; screens in `src/ui`, engine-free game
core in `src/core`). One brand, **two theme variants** sharing the royal-violet primary and
magenta-rose hearts:

- **Daylight** (default) — white paper, near-black ink arrows.
- **Ink Night** — deep ink-violet night, moonlit near-white arrows. Built for the couch /
  in-bed session with the lights low.

A **moon/sun toggle on the menu** (next to the sound toggle, `src/ui/HomeScreen.tsx:64-65`)
flips the variant; the choice persists (`SaveSystem.darkMode`, `src/core/saveSystem.ts:139-144`)
and the screens re-render with the other palette (`App.tsx:45-52`).
The brand deliberately diverges from the reference game (Arrows – Puzzle Escape): their
identity is periwinkle *blue* on white; ours is royal *purple* + magenta, day or night.

## Theme

No board frame, no grid lines, no tile backgrounds, no header divider — the game screen
is nothing but the arrows, the header (level, hearts) and two floating round-cornered buttons.
Arrows are plain ink "pipes" (near-black on Daylight, moonlit near-white on Ink Night) that tangle
into a maze. Color is used sparingly: one **royal-violet** primary for branding and
actions, and **magenta-rose** for hearts and the "blocked" flash. Calm and airy, not
neon: no glow, no gradients, flat inks only.

## Color

All colors come from one `Palette` in `src/ui/theme.ts`: `Daylight` (`theme.ts:22-35`) or
`InkNight` (`theme.ts:37-50`), chosen by `paletteFor(dark)` (`theme.ts:52`) and passed down from
`App.tsx:52`. The hex
values below equal `theme.ts` at the commit that last edited this table.

| Role | Token | Daylight (default) | Ink Night | Used for |
|---|---|---|---|---|
| bg | `bg` | `#FFFFFF` | `#13111C` | screen background (`GameScreen.tsx:202`, `HomeScreen.tsx:61`, `SplashScreen.tsx:72`); lose scrim at 86% (`GameScreen.tsx:253`) |
| surface | `surface` | `#EFEDF8` | `#201D30` | header/menu buttons (`HeaderButton.tsx:30`), win/lose panel (`GameScreen.tsx:256`) |
| border | `border` | `#E0DCEF` | `#2B2841` | button edge and pressed fill (`HeaderButton.tsx:30-31`), panel edge (`GameScreen.tsx:256`), Retry outline (`GameScreen.tsx:298`) |
| muted / spent | `heartLost` | `#DBD7ED` | `#3B3653` | spent heart (`GameScreen.tsx:395`), unearned star (`GameScreen.tsx:467`), sound-off glyph (`HeaderButton.tsx:35`) |
| ink | `ink` | `#191724` | `#EFEDF9` | arrows (`BoardView.tsx:695`), wordmark text (`Wordmark.tsx:35`), splash arrow (`SplashScreen.tsx:83`) |
| ink-dim | `inkDim` | `#6E6A8A` | `#A29DC1` | Normal tier label (`GameScreen.tsx:197`, `HomeScreen.tsx:45`), panel subline (`GameScreen.tsx:268`), Retry label (`GameScreen.tsx:303`), stats line (`HomeScreen.tsx:94`) |
| accent | `accent` | `#6D4AEF` | `#7C5CF5` | Play pill (`HomeScreen.tsx:85`), Hard tier (`GameScreen.tsx:196`), hint and press preview (`StaticBoardSurface.native.tsx:239,360`), "Cleared!" title (`GameScreen.tsx:257`), panel buttons (`GameScreen.tsx:279,299`), earned stars (`GameScreen.tsx:467`), splash arrowhead (`SplashScreen.tsx:93`) |
| accent-light | `accentLight` | `#8F76F0` | `#A98FF8` | "Level N" labels (`GameScreen.tsx:209`, `HomeScreen.tsx:71`), perfect-run line (`GameScreen.tsx:308`) |
| accent-core | `accentCore` | `#4A3E8C` | `#CBC4F0` | glyphs on `surface` buttons (`HeaderButton.tsx:35`) |
| accent-deep | `accentDeep` | `#5636D6` | `#6247D6` | pressed accent buttons (`HomeScreen.tsx:85`, `GameScreen.tsx:279,299`) |
| heart / danger | `heart` | `#E4327D` | `#F0468C` | hearts (`GameScreen.tsx:395`), blocked arrow and blocker flash (`StaticBoardSurface.native.tsx:276,317`), Super Hard tier (`GameScreen.tsx:195`), "Out of hearts" title (`GameScreen.tsx:257`) |
| on-accent | `inkOnAccent` | `#FFFFFF` | `#FFFFFF` | labels on accent buttons (`HomeScreen.tsx:90`, `GameScreen.tsx:286,303`) |

Contrast (vs its own bg): ink ≈ 16:1 / 15:1; ink-dim ≈ 4.8:1 / 6.5:1; accent-light
(large decorative only) ≈ 3.2:1 / 5:1; white on accent ≈ 5:1 / 4.8:1 (large bold).

## Typography

One family: **Fredoka**, a rounded bold geometric sans (SIL OFL), bundled through
`@expo-google-fonts/fredoka` (`App.tsx:1-2,23`) as two families, SemiBold and Bold
(`src/ui/theme.ts:59-62`).
- Wordmark "▲rrows": size 56 on the menu and splash (`HomeScreen.tsx:69`, `SplashScreen.tsx:75`),
  Bold, `ink` (`Wordmark.tsx:31-40`). The capital A is the brand-mark image `assets/images/mark.png`
  with its violet and magenta baked in (`Wordmark.tsx:25-29`), so it reads on both themes.
- Menu: "Level N" 24 Bold (`HomeScreen.tsx:130-135`); tier 15 SemiBold (`HomeScreen.tsx:136-141`);
  Play label 22 Bold (`HomeScreen.tsx:149-153`); stats line 13 SemiBold (`HomeScreen.tsx:154-158`).
- Game header: "LEVEL N" 18 Bold (`GameScreen.tsx:504-508`); tier · shape · count line 12 SemiBold
  (`GameScreen.tsx:509-513`).
- Win/lose panel: title 24 Bold (`GameScreen.tsx:536-539`); subline 14 SemiBold
  (`GameScreen.tsx:547-552`); button labels 16 Bold (`GameScreen.tsx:558-561`); perfect-run line
  13 SemiBold (`GameScreen.tsx:562-566`).

## Components

- **Arrow**: ink line-art (stroke **0.144 × cell**, `src/ui/arrowGeometry.ts:20`) with round caps,
  a multi-cell path ending in a **solid filled triangular** arrowhead: tip 0.5 cell past the head
  cell's centre, 0.42 cell long, 0.27 cell half-width, and a tail reaching 0.42 cell past the first
  cell (`arrowGeometry.ts:16-19`). Bends are rounded by the stroke's own round join
  (`strokeLinejoin="round"`, `StaticBoardSurface.tsx:49`, `BoardView.tsx:826,857`;
  `Paint.Join.ROUND`, `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/ArrowsBoardView.kt:64-65`), so a bend's outer radius is half the stroke,
  0.072 cell, and its inner edge is not filleted; the ~0.12-cell fillet was never implemented.
  Arrows are drawn as vector paths: on native by a retained native view
  (`ArrowsBoardView.kt:237-240` on Android,
  `modules/arrows-board/ios/ArrowsBoardView.swift:223-231` on iOS), on web as SVG
  (`StaticBoardSurface.tsx:43-53`). No glow, no tile, no per-arrow color. Sized so neighbors
  nearly connect into a maze.
  - **Press preview**: a finger held on an arrow for 64 ms (`BoardView.tsx:81,337-342`) draws that
    arrow in `accent` at 1.6× the stroke (`feedbackCurves.ts:13`, `StaticBoardSurface.native.tsx:237-245`),
    static, until release fires it.
  - **Blocked**: the tapped arrow bumps along its own axis and fades from `heart` back to `ink`,
    and the first arrow in its lane (`BoardLogic.blockerOf`, `src/core/boardLogic.ts:80-92`)
    flashes `heart` (`BoardView.tsx:443-458`); see Motion.
- **Board**: **no frame, no grid, no tile backgrounds.** Arrows float on `bg`, centered and
  scaled to fit with a 0.94 margin (`BoardView.tsx:59,241`). A level **opens fully zoomed out** so
  the whole shape reads at a glance (`BoardView.tsx:240-248`); pinch-zoom up to the larger of 3.5×
  fit or 64 pt per cell (`BoardView.tsx:55,58,243`), drag with momentum (`BoardView.tsx:489-497`),
  and mouse-wheel zoom on web (`BoardView.tsx:555-564`).
- **Header (gameplay)**: one row (`GameScreen.tsx:205`). **Left:** a `surface` back button (‹) and,
  beside it, "LEVEL N" in `accent-light` over one line "Tier · Shape · N left" in the tier colour
  (`ink-dim` Normal, `accent` Hard, `heart` Super Hard) (`GameScreen.tsx:206-222,194-197`).
  **Right:** the heart row, then a `surface` Hint button with a 💡 glyph (`GameScreen.tsx:224-231`).
  Header buttons are 36 pt squares with corner radius one third of their size, a 1 pt `border`
  edge and an `accent-core` glyph (`HeaderButton.tsx:11,24-35`). Retrying lives on the
  out-of-hearts panel, not the header. No divider, no bottom button bar.
- **Hint**: a rewarded ad. Tapping the button plays a rewarded ad and, only if the reward is
  earned, picks the first arrow that can currently exit (`GameScreen.tsx:180-191`,
  `BoardLogic.findHint`, `boardLogic.ts:101-106`) — always a safe move, since removing an arrow
  only frees cells. The board recentres on it and it turns `accent` with a stroke pulse (Motion).
  The tint stays until that arrow is fired (`BoardView.tsx:369`). The arrow stays tappable; the
  player still makes the move.
- **Hearts**: 3 hearts at every tier (`src/core/difficulty.ts:60,62,65`), each a 22 pt heart
  shape (`GameScreen.tsx:367-371`); full = `heart`, spent = `heartLost` at 0.85 opacity
  (`GameScreen.tsx:393-397`).
- **Button (primary)**: `accent` fill, `inkOnAccent` bold label, **no glow**. The menu Play pill is
  250 × 68 pt with radius 34 (`HomeScreen.tsx:142-148`); panel buttons have radius 14
  (`GameScreen.tsx:553-557`). Pressed → `accentDeep` and scale 0.94 (`HomeScreen.tsx:85-86`,
  `GameScreen.tsx:279-281,297-299`). The lose panel's Retry is transparent with a 1 pt `border`
  outline (`GameScreen.tsx:298`).
- **Win / lose panels**: a clear or a loss raises a `surface` panel over a scrim
  (`GameScreen.tsx:247-315`): "Cleared!" in `accent` with one star per remaining heart, the
  level · shape · arrow-count line and Next level, or "Out of hearts" in `heart` with
  "Continue +♥ (ad)" and Retry.
- **Menu**: `bg`; wordmark (size 56) in the upper-middle, "Level N" beneath it (`accent-light`) with
  the resume level's **difficulty** under that (same colour-coding as the header), big violet
  Play pill below (`HomeScreen.tsx:68-92`). Generous whitespace. **Top-right: two 44 pt `surface`
  buttons**, the theme toggle (☀/☾) and the sound toggle (♪ glyph — `accent-core` when on,
  `heartLost` when off; persisted) (`HomeScreen.tsx:63-66`, `HeaderButton.tsx:35`). Near the
  bottom, one quiet `ink-dim` **lifetime-stats line** ("N puzzles solved · D-day streak ·
  best perfect run K") — hidden until the first solve, streak/run parts shown only from 2 up
  (`HomeScreen.tsx:94-96,102-112`).
- **Stats & streaks** (`SaveSystem`, `src/core/saveSystem.ts:85-127`): lifetime **solved count**, a
  **perfect streak** (consecutive clears with no heart lost; current + best), and a **daily play
  streak** (consecutive calendar days with ≥1 solve; reads 0 once broken, `saveSystem.ts:99-109`).
  Stored as integers in AsyncStorage through a hydrated cache (`src/ui/storage.ts:4-11`), updated
  on every solve (`GameScreen.tsx:121`).

## Levels (procedural shapes)

Every level is a recognizable **picture made of arrows**: the arrows completely fill the
silhouette of a shape, so the board reads as a square, a circle, a heart, a star, a trophy…
Empty `bg` surrounds the shape (for square/rectangle the shape *is* the whole grid).

- **Shape by tier** (`src/core/shapeLibrary.ts:280-306`): each tier has its own pool. **Normal**
  draws plain fills — square, rectangle, circle, diamond. **Hard** draws geometric figures —
  circle, diamond, triangle, plus, hexagon, hourglass, pentagon, octagon, ring, X. **Super Hard**
  draws picture-book silhouettes — heart, star, trophy, crescent moon, flower, lightning
  bolt, arrow, crown, butterfly, rocket, pine tree, cat, mushroom, fish.
  Shapes are defined as point-in-polygon / implicit-inequality tests in a normalized −1..1
  space (`shapeLibrary.ts:10-15`), so they rasterize cleanly to *any* board size (no bitmaps; sampled 3×3 per cell so
  thin features like the crescent's horns stay clean, `shapeLibrary.ts:43,53-56`).
- **Tier schedule** (`src/core/difficulty.ts:34-49`): a repeating 6-level cycle Normal, Normal,
  Hard, Normal, Normal, Super Hard. The tier configs do not depend on the level index
  (`difficulty.ts:51-67`).
- **Full fill, guaranteed solvable** (`LevelGenerator`, `src/core/levelGenerator.ts:22-41`): the
  silhouette is packed so **every shape cell holds an arrow**, and the board is solvable *by
  construction*. Both come from one "peel" rule — only ever carve an arrow whose head has a
  **clear straight lane to the board edge through the cells that are still unfilled**
  (`levelGenerator.ts:214-228`). The top-most unfilled row can always point up with nothing
  unfilled above it, so a valid arrow exists until the shape is full; and carving in that order is
  itself a valid solution. Because removing an arrow only empties cells, no tap order can then make
  the board unsolvable (`src/core/__tests__/noDeadEnd.test.ts`).
- **Arrow-shape rules** (generation rules, not measured outcomes): a target length drawn between
  the tier's `minLen` 4 and `maxLen` 6 (`difficulty.ts:60,62,65`; `levelGenerator.ts:139,272`); a
  **2-cell straight neck** behind the head before the first bend, so a bend is never right at the
  arrowhead (`levelGenerator.ts:287-292`); up to 2 bends when the per-arrow roll passes, otherwise up to 1
  (`bendArrowChance` 0.93 / 0.95 / 0.97 for Normal / Hard / Super Hard, `difficulty.ts:60,62,65`;
  `levelGenerator.ts:270`); head choice weighted ×10 where a clean L fits
  (`levelGenerator.ts:232-243`); bends into the most-constrained neighbour
  (`levelGenerator.ts:304-311`); and a tail mop-up that absorbs dead-end cells
  (`levelGenerator.ts:328-370`). The resulting share of bent arrows and the length distribution are
  not measured by a committed script, so this document states no figure for them; the Unity-era
  figures were dropped (see `docs/next-level/reports/P-03.md`, Concerns).
- **Difficulty** (`src/core/difficulty.ts:51-67`): each tier sizes its board so the shape holds a
  target cell count — Normal 260–400, Hard 420–580, Super Hard 560–720 cells
  (`difficulty.ts:60,62,65`) — with rows clamped to 8–46 and columns to 4–46
  (`levelGenerator.ts:65-66`). **Always 3 lives**, regardless of tier. Measured output of
  `npx tsx scripts/analysis/tier-bands.ts` over level indices 0..599 (levels 1..600; arrow counts
  by nearest-rank percentile):

  | Tier | n | arrows min | p10 | median | p90 | max | rows | cols |
  |---|---|---|---|---|---|---|---|---|
  | Normal | 400 | 57 | 66 | 83 | 99 | 132 | 13–30 | 16–30 |
  | Hard | 100 | 99 | 104 | 123 | 151 | 197 | 26–39 | 26–38 |
  | Super Hard | 100 | 47 | 118 | 148 | 177 | 224 | 28–46 | 28–46 |

  The tier bands overlap. What difficulty should mean is set in `PRODUCT.md` (legibility,
  density, clearable fraction at deal, silhouette novelty), never tap order.
- **Determinism**: difficulty, the chosen shape, the board size and the layout are all pure
  functions of the level index, so resume / retry reproduce the same picture.

(The engine-free core — `ShapeLibrary`, `LevelGenerator`, `BoardLogic`, `ArrowPath`,
`Difficulty`, `Direction`, `DotNetRandom`, `SaveSystem` in `src/core` — imports no React Native,
so its jest suite runs in plain node (`jest.config.js:3-7`). Port history: it is a translation of
the Unity original's C# core, and level generation keeps .NET's seeded random
(`src/core/dotnetRandom.ts:1-10`).)

## Motion

Calm canvas, quick juice. **No ambient glow, no drifting arrows** — the board itself stays still
and serene. Motion is reserved for *feedback and flow*. All in-app animation runs on Reanimated
(`withTiming`, `withSpring`, `withRepeat`, `withDelay`, `withDecay`, `FadeIn`), except the
native slither exit, which the retained board view draws from its own frame clock
(`ArrowsBoardView.kt:257-292`). There is no single shared duration budget; each effect belongs to
one band below. A band's bounds are the min and max duration of the shipped timed effects in it. Springs and the
velocity-driven pan decay have no fixed duration and do not set bounds.

### Tap-local feedback — 180–320 ms

- **Arrow exit (slither)**: a dash the length of the arrow body flows head-first along the arrow's
  own path and straight off the board, **accelerating outward** (distance travelled = k² of the
  total, `BoardView.tsx:992,1000`, `ArrowsBoardView.kt:269`; iOS uses an ease-in quadratic timing
  curve, `ArrowsBoardView.swift:162-170`), fading out after 55% of its run
  (`BoardView.tsx:983-988`, `ArrowsBoardView.kt:270-277,395`). Duration is 120 ms + 0.35 ms per
  screen point travelled, clamped to 180–320 ms (`exitAnimationConfig.ts:15,22-24,35-40`); web
  drives it with `withTiming` (`BoardView.tsx:980`). The trail is 0.26 cell wide
  (`exitAnimationConfig.ts:46`). Each exit plays a pop from a pentatonic ladder `pop0…pop7.wav`
  that climbs one step per exit within 1200 ms (`src/ui/exitCombo.ts:8-9,20-30`; clips in
  `src/ui/audio.ts:13-20`, played by the native `ArrowsFeedback` module in installed builds,
  `audio.ts:5-11`).
- **Blocked bump**: the tapped arrow lunges along its own exit axis (peak about 0.22 cell) and
  springs back while its colour eases from `heart` to `ink`, over 300 ms
  (`feedbackCurves.ts:8,14-22`; `BoardView.tsx:887`, `StaticBoardSurface.native.tsx:308`).
- **Heart pop**: the spent pip jumps to scale 1.35 and springs back (damping 9, stiffness 240)
  as it dims to `heartLost` (`GameScreen.tsx:382-386`).
- **Pan momentum**: a released drag carries on and settles with rubber-band edges
  (`withDecay`, `BoardView.tsx:495-496`).

### Explanatory feedback — 280–1600 ms

- **Blocker flash**: the arrow in the way holds `heart` for the first 40% and fades out, its stroke
  relaxing from 1.6× to 1×, over 650 ms (`feedbackCurves.ts:10,24-38`; `BoardView.tsx:842`,
  `StaticBoardSurface.native.tsx:264`).
- **Hint recentre**: the viewport eases (cubic out) to centre the hinted arrow in 280 ms
  (`BoardView.tsx:310-311`).
- **Hint pulse**: the hinted arrow's stroke width is multiplied by 1 + 0.45 · |sin 4πk| · (1 − 0.6k)
  as k runs 0 → 1 over 1600 ms, a decaying pulse; the arrow then stays `accent`
  (`BoardView.tsx:934,937-940`, `StaticBoardSurface.native.tsx:348-354`).

### State / screen transitions — 180–380 ms

- **Menu ↔ game**: each screen fades in over 180 ms as it mounts (`FadeIn.duration(180)`,
  `App.tsx:63,75`). It is entering-only: the old screen is removed at once, not cross-faded.
- **Splash → menu**: the splash fades out over 380 ms, starting 2250 ms after mount
  (`SplashScreen.tsx:47`), or over 180 ms when tapped to skip (`SplashScreen.tsx:53`).

Not animated today (listed so nobody assumes otherwise):
**level → level** is a hard cut today; a transition is specified by the W2 level-transition task,
flag OFF until accepted. The **win / lose panel** appears without animation, 450 ms after the last
arrow leaves or 350 ms after the last heart is lost (`GameScreen.tsx:119,147`). A **button press**
is a pressed style, scale 0.94 while held, with no tween either way (`HeaderButton.tsx:32`,
`HomeScreen.tsx:86`, `GameScreen.tsx:281,297`).

### Ceremony — 850 ms

- **Splash intro**: the wordmark springs in from scale 0.72 at 150 ms (damping 14, stiffness 120),
  the line-art arrow draws itself over 850 ms from 650 ms, and the arrowhead springs in at 1450 ms
  (damping 12, stiffness 260) (`SplashScreen.tsx:44-46,59-69`).
- **Star pops**: each star on the win panel springs in (damping 11, stiffness 260), scaling up from
  0 and turning from −24°, staggered 250 ms + 170 ms per star (`GameScreen.tsx:426,450,457-460`).

### Ambient (menu only, exactly one) — 1100 ms

- **Play breathing**: the Play pill scales 1.00 → 1.03 and back forever, 1100 ms each way with a
  sine in-out curve, a 2.2 s cycle (`HomeScreen.tsx:48-58`). It has no entrance spring.

### Reduce motion

**Required** (`PRODUCT.md`, Principle 4 and Accessibility): under the OS reduce-motion setting,
feedback that carries information (blocker flash, blocked arrow, hint) renders a **static
equivalent** and honours the setting; it is never forced on with `ReduceMotion.Never`. Decorative
motion (heart pop, star pops, Play breathing, splash) may simply be skipped.

**What ships today** (read from code; runtime captures belong to the tasks named here):
- **Feedback blackout (defect, owned by W0-04).** The feedback `withTiming` calls use Reanimated's
  default, so under reduce motion their progress lands on its end value at once. At the end value
  the blocker flash is fully transparent (`feedbackCurves.ts:25-31`) and the blocked arrow's colour
  is plain `ink` (`StaticBoardSurface.native.tsx:315-318`, `BoardView.tsx:896-900`); the bump is
  already zeroed (`StaticBoardSurface.native.tsx:312`, `BoardView.tsx:891`). A blocked tap costs a
  heart and shows nothing that lasts (the mount frame may still show one or two magenta frames). The hint keeps its static `accent` tint
  (`StaticBoardSurface.native.tsx:360,366`) but loses its pulse.
- **Native exit: a stationary dash fading in place** (`nativeExitAnimation.ts:30`,
  `ArrowsBoardView.kt:269-271`). Shipped and **not yet signed off**; the W2 reduced-motion task
  owns that sign-off. On web the exit trail's own `withTiming` also lands at its end value, where
  its opacity `1 − k` is 0, so the web exit vanishes at once (`BoardView.tsx:980,992-995`).

## Layout

Portrait only (`app.json:6`). Content stays inside the safe-area insets
(`GameScreen.tsx:53,205`, `HomeScreen.tsx:38,63,94`). Game screen: the header row at the top
(back button and level label left, hearts and hint right, 16 pt side padding,
`GameScreen.tsx:487-503`), then the board filling the rest of the screen, fit-to-view
(`BoardView.tsx:1030-1033`). No bottom bar.

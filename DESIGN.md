# Design

Visual system for "Arrows" (React Native / Expo SDK 57; screens in `src/ui`, engine-free game
core in `src/core`). One brand, **two theme variants** sharing the royal-violet primary and
magenta-rose hearts:

- **Daylight** (default) — white paper, near-black ink arrows.
- **Ink Night** — deep ink-violet night, moonlit near-white arrows. Built for the couch /
  in-bed session with the lights low.

A **moon/sun toggle on the menu** (next to the sound toggle, `src/ui/HomeScreen.tsx:267-287`)
flips the variant; the choice persists (`SaveSystem.darkMode`, `src/core/saveSystem.ts:783-788`)
and the screens re-render with the other palette (`App.tsx:262-269`).
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

All colors come from one `Palette` in `src/ui/theme.ts`: `Daylight` (`theme.ts:43-65`) or
`InkNight` (`theme.ts:67-90`), chosen by `paletteFor(dark)` (`theme.ts:92`) and passed down from
`App.tsx:269`. The hex
values below equal `theme.ts` at the commit that last edited this table.

| Role | Token | Daylight (default) | Ink Night | Used for |
|---|---|---|---|---|
| bg | `bg` | `#FFFFFF` | `#13111C` | screen background (`GameScreen.tsx:998`, `HomeScreen.tsx:251`, `SplashScreen.tsx:150`); lose scrim at 86% (`GameScreen.tsx:868`) |
| surface | `surface` | `#EFEDF8` | `#201D30` | header/menu buttons (`HeaderButton.tsx:87`), win/lose panel (`GameScreen.tsx:1140`) |
| border | `border` | `#8E80C5` | `#69629E` | button hairline (`HeaderButton.tsx:88`), panel edge (`GameScreen.tsx:1140`), Retry outline (`GameScreen.tsx:966`); ≥3:1 on `surface` |
| inactive fill | `heartLost` | `#DBD7ED` | `#3B3653` | pressed header button fill (`HeaderButton.tsx:87`) |
| glyph off | `glyphOff` | `#8D80C6` | `#6C6398` | off or disabled header glyph and the sound-off strike (`HeaderButton.tsx:66,115`, `HomeScreen.tsx:283`) |
| spent pip | `pipSpent` | `#988CCB` | `#635B8B` | spent heart, drawn as an outline (`GameScreen.tsx:1353`) |
| unearned star | `starUnearned` | `#8D80C6` | `#6C6398` | unearned star on the win panel (`GameScreen.tsx:1430`) |
| ink | `ink` | `#191724` | `#EFEDF9` | arrows (`BoardView.tsx:1095`), wordmark text (`Wordmark.tsx:35`), splash arrow (`SplashScreen.tsx:161`) |
| ink-dim | `inkDim` | `#6D6988` | `#A29DC1` | Normal tier label (`GameScreen.tsx:878`, `HomeScreen.tsx:158`), panel subline (`GameScreen.tsx:914`), Retry and disabled Continue labels (`GameScreen.tsx:944,969`; the disabled Continue fill is `bg`, `GameScreen.tsx:933`), stats line (`HomeScreen.tsx:332`) |
| accent | `accent` | `#6D4AEF` | `#7B5BF5` | Play pill (`HomeScreen.tsx:210`), hint and press preview (`StaticBoardSurface.native.tsx:330,494`), "Cleared!" title (`GameScreen.tsx:891`), panel buttons (`GameScreen.tsx:934,963`), earned stars (`GameScreen.tsx:1430`), splash arrowhead (`SplashScreen.tsx:171`) |
| accent-light | `accentLight` | `#8F76F0` | `#A98FF8` | "Level N" labels, both 24 Bold (`GameScreen.tsx:1023`, `HomeScreen.tsx:194`) |
| accent text | `accentText` | `#6D4AEF` | `#8C70F6` | Hard tier (`GameScreen.tsx:877`, `HomeScreen.tsx:157`), perfect-run line (`GameScreen.tsx:988`); ≥4.5:1 on `bg` and `surface` |
| accent-core | `accentCore` | `#4A3E8C` | `#CBC4F0` | glyphs on `surface` buttons (`HeaderButton.tsx:66`) |
| accent-deep | `accentDeep` | `#5636D6` | `#6247D6` | pressed accent buttons (`HomeScreen.tsx:210`, `GameScreen.tsx:934,963`) |
| heart / danger | `heart` | `#E4327D` | `#F0468C` | hearts (`GameScreen.tsx:1348`), blocked arrow and blocker flash (`StaticBoardSurface.native.tsx:372,418`), "Out of hearts" title (`GameScreen.tsx:891`) |
| heart text | `heartText` | `#E11F71` | `#F0468C` | Super Hard tier (`GameScreen.tsx:876`, `HomeScreen.tsx:156`); ≥4.5:1 on `bg` |
| on-accent | `inkOnAccent` | `#FFFFFF` | `#FFFFFF` | labels on accent buttons (`HomeScreen.tsx:215`, `GameScreen.tsx:944,969`) |

Contrast is gated by `src/ui/contrastAudit.ts` and printed by `npx tsx scripts/contrast-audit.ts`
(Daylight / Ink Night; body text ≥4.5:1, large text and graphics ≥3:1; SemiBold counts as not bold):
ink on `bg` 17.66 / 16.14; ink-dim 5.22 / 7.23 on `bg` and 4.51 / 6.35 on `surface`; accent-light
(large only, 24 Bold) 3.49 / 7.09 on `bg`; accent text 5.42 / 5.12 on `bg` and 4.68 / 4.50 on
`surface`; heart text 4.53 / 5.30 on `bg`; white on accent 5.42 / 4.51; border on `surface`
3.00 / 3.00; glyph off and unearned star on `surface` 3.01 / 3.03; spent pip on `bg` 3.02 / 3.02.

## Typography

One family: **Fredoka**, a rounded bold geometric sans (SIL OFL), bundled through
`@expo-google-fonts/fredoka` (`App.tsx:1-2,108`) as two families, SemiBold and Bold
(`src/ui/theme.ts:99-102`).
- Wordmark "▲rrows": size 56 on the menu and splash (`HomeScreen.tsx:192`, `SplashScreen.tsx:153`),
  Bold, `ink` (`Wordmark.tsx:31-40`). The capital A is the brand-mark image `assets/images/mark.png`
  with its violet and magenta baked in (`Wordmark.tsx:25-29`), so it reads on both themes.
- Menu: "Level N" 24 Bold (`HomeScreen.tsx:533-536`); tier 15 SemiBold (`HomeScreen.tsx:537-540`);
  Play label 22 Bold (`HomeScreen.tsx:548-550`); stats line 13 SemiBold (`HomeScreen.tsx:551-554`).
- Game header: "LEVEL N" 24 Bold (`GameScreen.tsx:1485-1487`); tier · shape · count line 12 SemiBold
  (`GameScreen.tsx:1497-1499`).
- Win/lose panel: title 24 Bold (`GameScreen.tsx:1543-1545`); subline 14 SemiBold
  (`GameScreen.tsx:1562-1566`); button labels 16 Bold (`GameScreen.tsx:1576-1578`); perfect-run line
  13 SemiBold (`GameScreen.tsx:1579-1582`).

## Components

- **Arrow**: ink line-art (stroke **0.144 × cell**, `src/ui/arrowGeometry.ts:20`) with round caps,
  a multi-cell path ending in a **solid filled triangular** arrowhead: tip 0.5 cell past the head
  cell's centre, 0.42 cell long, 0.27 cell half-width, and a tail reaching 0.42 cell past the first
  cell (`arrowGeometry.ts:16-19`). Bends are rounded by the stroke's own round join
  (`strokeLinejoin="round"`, `StaticBoardSurface.tsx:58`, `BoardView.tsx:1274,1318`;
  `Paint.Join.ROUND`, `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/ArrowsBoardView.kt:130-131`), so a bend's outer radius is half the stroke,
  0.072 cell, and its inner edge is not filleted; the ~0.12-cell fillet was never implemented.
  Arrows are drawn as vector paths: on native by a retained native view
  (`ArrowsBoardView.kt:600-610` on Android,
  `modules/arrows-board/ios/ArrowsBoardView.swift:249-257` on iOS), on web as SVG
  (`StaticBoardSurface.tsx:52-62`). No glow, no tile, no per-arrow color. Sized so neighbors
  nearly connect into a maze.
  - **Press preview**: a finger held on an arrow for 64 ms (`BoardView.tsx:105,583-588`) draws that
    arrow in `accent` at 1.6× the stroke (`feedbackCurves.ts:20`, `StaticBoardSurface.native.tsx:328-336`),
    static, until release fires it.
  - **Blocked**: the tapped arrow bumps along its own axis and fades from `heart` back to `ink`,
    and the first arrow in its lane (`BoardLogic.blockerOf`, `src/core/boardLogic.ts:80-92`)
    flashes `heart` (`BoardView.tsx:706-718`); see Motion.
- **Board**: **no frame, no grid, no tile backgrounds.** Arrows float on `bg`, centered and
  scaled to fit with a 0.94 margin (`boardCamera.ts:13,83`). A level **opens fully zoomed out** so
  the whole shape reads at a glance (`boardCamera.ts:82-92`); pinch-zoom up to the larger of 3.5×
  fit or 64 pt per cell (`boardCamera.ts:9,12,84`), drag with momentum (`BoardView.tsx:790-810`),
  and mouse-wheel zoom on web (`BoardView.tsx:878-887`).
- **Header (gameplay)**: one row (`GameScreen.tsx:1001`). **Left:** a `surface` back button (‹) and,
  beside it, "LEVEL N" in `accent-light` over one line "Tier · Shape · N left" in the tier colour
  (`ink-dim` Normal, `accent` Hard, `heart` Super Hard) (`GameScreen.tsx:1002-1064,872-875`).
  **Right:** the heart row, then a `surface` Hint button with a 💡 glyph (`GameScreen.tsx:1065-1084`).
  Header buttons are 36 pt squares with corner radius one third of their size, a 1 pt `border`
  edge and an `accent-core` glyph (`HeaderButton.tsx:30,62,77-84`). Retrying lives on the
  out-of-hearts panel, not the header. No divider, no bottom button bar.
- **Hint**: a rewarded ad. Tapping the button plays a rewarded ad and, only if the reward is
  earned, picks the first arrow that can currently exit (`GameScreen.tsx:832-848`,
  `BoardLogic.findHint`, `boardLogic.ts:101-106`) — always a safe move, since removing an arrow
  only frees cells. The board recentres on it and it turns `accent` with a stroke pulse (Motion).
  The tint stays until that arrow is fired (`BoardView.tsx:630`). The arrow stays tappable; the
  player still makes the move.
- **Hearts**: 3 hearts at every tier (`src/core/difficulty.ts:73,75,78`), each a 22 pt heart
  shape (`GameScreen.tsx:1302-1305`); full = `heart`, spent = a `pipSpent` outline, so the hearts
  left read by shape as well as colour (`GameScreen.tsx:1347-1355`; W0-06).
- **Button (primary)**: `accent` fill, `inkOnAccent` bold label, **no glow**. The menu Play pill is
  250 × 68 pt with radius 34 (`HomeScreen.tsx:541-547`); panel buttons have radius 14
  (`GameScreen.tsx:1571-1575`). Pressed → `accentDeep` and scale 0.94 (`HomeScreen.tsx:210-211`,
  `GameScreen.tsx:934-936,961-963`). The lose panel's Retry is transparent with a 1 pt `border`
  outline (`GameScreen.tsx:966`).
- **Win / lose panels**: a clear or a loss raises a `surface` panel over a scrim
  (`GameScreen.tsx:1123-1144`): "Cleared!" in `accent` with one star per remaining heart, the
  level · shape · arrow-count line and Next level, or "Out of hearts" in `heart` with
  "Continue +♥ (ad)" and Retry.
- **Menu**: `bg`; wordmark (size 56) in the upper-middle, "Level N" beneath it (`accent-light`) with
  the resume level's **difficulty** under that (same colour-coding as the header), big violet
  Play pill 56 pt below the tier (`HomeScreen.tsx:189-217`). Generous whitespace. **Top-right: two
  44 pt `surface` buttons**, the theme toggle (☀/☾) and the sound toggle (♪ glyph — `accent-core`
  when on, `glyphOff` with a diagonal strike when off; persisted) (`HomeScreen.tsx:264-300`, `HeaderButton.tsx:66,104-121`).
  Near the bottom, one quiet `ink-dim` **lifetime-stats line** ("N puzzles solved · D-day streak ·
  best perfect run K") — hidden until the first solve, streak/run parts shown only from 2 up
  (`HomeScreen.tsx:324-336,478-491`).
  - **Entry row** (`META_DAILY`, `META_GALLERY`): one secondary row 4 pt under the Play pill, two
    quiet `ink-dim` text controls in the tier label's type (SemiBold 15, no pill, no icon) —
    "Today's board" (after today's clear, "Today's board · done", not pressable) and "Gallery" —
    split by the stats line's own `   ·   ` separator, which is the whole gap between the two words.
    Each control's hit box is ≥ 44 × 44 pt, widened 16 pt on its outer side. Hidden until the first
    solve, like the stats line (`HomeScreen.tsx:219-245`).
  - **Composition** (from the first solve, whenever `META_DAILY`, `META_GALLERY` or
    `META_STREAK_FREEZE` is on): the column (wordmark → entry row) is centred in the room between the
    header buttons and the stats band — two stats lines at the system font scale plus a fixed 56 pt
    banner reserve — so it is placed once and never moves when the ad loads or fails
    (`HomeScreen.tsx:302-322,444-466`). The stats line keeps its anchor; when it is too long for one
    line (360 pt, or "· streak saved" from `META_STREAK_FREEZE`) it wraps centred inside 18 pt side
    margins and only after a separator (`HomeScreen.tsx:484-507`). Flags OFF, or before the first
    solve: the menu above, unchanged.
- **Stats & streaks** (`SaveSystem`, `src/core/saveSystem.ts:556-628`): lifetime **solved count**, a
  **perfect streak** (consecutive clears with no heart lost; current + best), and a **daily play
  streak** (consecutive calendar days with ≥1 solve; reads 0 once broken, `saveSystem.ts:585-599`).
  Stored as integers in AsyncStorage through a hydrated cache (`src/ui/storage.ts:4-11`), updated
  on every solve (`GameScreen.tsx:555`).

## Levels (procedural shapes)

Every level is a recognizable **picture made of arrows**: the arrows completely fill the
silhouette of a shape, so the board reads as a square, a circle, a heart, a star, a trophy…
Empty `bg` surrounds the shape (for square/rectangle the shape *is* the whole grid).

- **Shape by tier (generator v1, the shipped generator)** (`src/core/shapeLibrary.ts:336-364`):
  each tier has its own pool. **Normal**
  draws plain fills — square, rectangle, circle, diamond. **Hard** draws geometric figures —
  circle, diamond, triangle, plus, hexagon, hourglass, pentagon, octagon, ring, X. **Super Hard**
  draws picture-book silhouettes — heart, star, trophy, crescent moon, flower, lightning
  bolt, arrow, crown, butterfly, rocket, pine tree, cat, mushroom, fish.
  Shapes are defined as point-in-polygon / implicit-inequality tests in a normalized −1..1
  space (`shapeLibrary.ts:13-18`), so they rasterize cleanly to *any* board size (no bitmaps; sampled 3×3 per cell so
  thin features like the crescent's horns stay clean, `shapeLibrary.ts:40,50-53`).
- **Shape selection (generator v2)** (`src/core/shapeBag.ts`; W3-10, dark behind `GEN_V2_ENABLED`):
  v2 drops the tier pools for a **capacity-aware shuffled bag** over the whole `SHAPE_CATALOGUE`
  (minus `RETIRED_SHAPE_IDS`). A shape's capacity is its cell count on its largest v2 board: at
  most 37 columns (`V2_MAX_GRID_COLS`, the owner's W3-09 legibility floor, 9.1 pt per cell on a
  360 dp phone), rows up to 46, aspect kept (`v2MaxRows`). Levels are dealt in windows: a window
  is the top-k shapes by capacity for the largest k whose k levels all fit the k-th capacity, dealt
  as a seeded Fisher–Yates shuffle, swapping its first two shapes once if the first would repeat
  the previous level. So no shape repeats back to back, each dealt shape appears once per window,
  and no board is capped below its target by the clamp. Since W3-14 the targets come from the
  difficulty curve (below), so windows shrink while it rises. Under the shipped curve (S400,
  ceiling 354 since RE-CEILING) every bag candidate is dealt at first, and from level 384 on 13 of
  26: Diamond, Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Mushroom
  and Fish cannot hold the saturated Super Hard target of 635 cells. Measured by `npm run
  analysis:probe -- --version 2 --curve-report` (`docs/next-level/reports/RE-CEILING.md`).
- **Tier schedule** (`src/core/difficulty.ts:47-62`): a repeating 6-level cycle Normal, Normal,
  Hard, Normal, Normal, Super Hard. The tier configs do not depend on the level index
  (`difficulty.ts:64-80`).
  **Generator v2** (W3-14, dark) keeps the cycle but reads each tier's cell target, and its
  clearable bias, from a breakpoint table indexed by level (`src/core/curve.ts`,
  `Difficulties.configV2`): level 1 is the owner's pick (88 cells, bias 3), and the targets climb
  linearly to a ceiling (base 354 cells: Normal 354, Hard 537, Super Hard 635), after which
  difficulty is flat. `V2_CURVE` is the owner's W3-16 pick among
  `docs/curve-candidates-2026-09-26.md`'s candidates: S400, the ceiling at level 400 (the bias
  falls 3 → 1 over the same ramp). The ceiling's value is the owner's RE-CEILING pick (option B):
  the base whose v2 boards match v1 on the search-cost proxy over levels 1–3000 (`npm run
  analysis:probe -- --version 2 --v1-floor`). The arrow cap (no board over 250 arrows, none
  heavier than v1's worst, 262, and a saturated bag window of at least six shapes) would allow up
  to 450 (`--ceiling`); at 354 the heaviest board over levels 1–10,000 is 190 arrows (195 for an
  existing player; `docs/next-level/reports/RE-CEILING.md`).
  **Existing players** (V2-FINISH): an install whose switch level is above 0 played v1 first, so its
  v2 boards carry a **v1 floor**: base cells at least 354 (Normal 354, Hard 537, Super Hard 635)
  and no bias above neutral. 354 is the smallest base whose own v2 boards reach v1's search-cost
  proxy over levels 1–3000 (`npm run analysis:probe -- --version 2 --v1-floor`, which also prints
  335, the base that only matches v1's arrow medians 83 / 125 / 150 but scans 0.91 of v1). It
  equals the ceiling, so an existing player's boards are the ceiling's from their first v2 level;
  their bag is built from the floored targets, so their board is a pure function of (level index,
  switch level).
- **Full fill, guaranteed solvable** (`LevelGenerator`, `src/core/levelGenerator.ts:216-238`): the
  silhouette is packed so **every shape cell holds an arrow**, and the board is solvable *by
  construction*. Both come from one "peel" rule — only ever carve an arrow whose head has a
  **clear straight lane to the board edge through the cells that are still unfilled**
  (`levelGenerator.ts:468-482`). The top-most unfilled row can always point up with nothing
  unfilled above it, so a valid arrow exists until the shape is full; and carving in that order is
  itself a valid solution. Because removing an arrow only empties cells, no tap order can then make
  the board unsolvable (`src/core/__tests__/noDeadEnd.test.ts`).
- **Arrow-shape rules** (generation rules, not measured outcomes): a target length drawn between
  the tier's `minLen` 4 and `maxLen` 6 (`difficulty.ts:73,75,78`; `levelGenerator.ts:363,534`); a
  **2-cell straight neck** behind the head before the first bend, so a bend is never right at the
  arrowhead (`levelGenerator.ts:549-554`); up to 2 bends when the per-arrow roll passes, otherwise up to 1
  (`bendArrowChance` 0.93 / 0.95 / 0.97 for Normal / Hard / Super Hard, `difficulty.ts:73,75,78`;
  `levelGenerator.ts:532`); head choice weighted ×10 where a clean L fits
  (`levelGenerator.ts:486-497`); bends into the most-constrained neighbour
  (`levelGenerator.ts:566-573`); and a tail mop-up that absorbs dead-end cells
  (`levelGenerator.ts:590-632`). The resulting share of bent arrows and the length distribution are
  not measured by a committed script, so this document states no figure for them; the Unity-era
  figures were dropped (see `docs/next-level/reports/P-03.md`, Concerns).
- **Difficulty** (`src/core/difficulty.ts:64-80`): each tier sizes its board so the shape holds a
  target cell count — Normal 260–400, Hard 420–580, Super Hard 560–720 cells
  (`difficulty.ts:73,75,78`) — with rows clamped to 8–46 and columns to 4–46
  (`levelGenerator.ts:287-288`). **Always 3 lives**, regardless of tier. Measured output of
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
  functions of (level index, generator version); each install has a switch level below which v1
  is used; a shipped generator version is frozen by golden fingerprints and never edited. So
  resume / retry reproduce the same picture. (W3-05: `src/core/generatorVersion.ts`,
  `GEN_V2_ENABLED` off. Since W3-10, v2 deals its own boards; see "Shape selection
  (generator v2)".)

(The engine-free core — `ShapeLibrary`, `LevelGenerator`, `BoardLogic`, `ArrowPath`,
`Difficulty`, `Direction`, `DotNetRandom`, `SaveSystem` in `src/core` — imports no React Native,
so its jest suite runs in plain node (`jest.config.js:5-13`). Port history: it is a translation of
the Unity original's C# core, and level generation keeps .NET's seeded random
(`src/core/dotnetRandom.ts:1-16`).)

## Motion

Calm canvas, quick juice. **No ambient glow, no drifting arrows** — the board itself stays still
and serene. Motion is reserved for *feedback and flow*. All in-app animation runs on Reanimated
(`withTiming`, `withSpring`, `withRepeat`, `withDelay`, `withDecay`, `FadeIn`), except the
native slither exit, which the retained board view draws from its own frame clock
(`ArrowsBoardView.kt:627-722`). There is no single shared duration budget; each effect belongs to
one band below. A band's bounds are the min and max duration of the shipped timed effects in it. Springs and the
velocity-driven pan decay have no fixed duration and do not set bounds.

### Tap-local feedback — 180–320 ms

- **Arrow exit (slither)**: a dash the length of the arrow body flows head-first along the arrow's
  own path and straight off the board, **accelerating outward** (distance travelled = k² of the
  total, `BoardView.tsx:1488,1496`, `ArrowsBoardView.kt:654-658`; iOS uses an ease-in quadratic timing
  curve, `ArrowsBoardView.swift:181-195`), fading out after 55% of its run
  (`BoardView.tsx:1476-1484`, `ArrowsBoardView.kt:660-667,990`). Duration is 120 ms + 0.35 ms per
  screen point travelled, clamped to 180–320 ms (`exitAnimationConfig.ts:19,26-28,41-46`); web
  drives it with `withTiming` (`BoardView.tsx:1467`). The trail is 0.26 cell wide
  (`exitAnimationConfig.ts:109`). Each exit plays a pop from a pentatonic ladder `pop0…pop7.wav`
  that climbs one step per exit within 1200 ms (`src/ui/exitCombo.ts:8-9,20-30`; clips in
  `src/ui/audio.ts:13-20`, played by the native `ArrowsFeedback` module in installed builds,
  `audio.ts:5-11`).
- **Arrow exit, launch curve** (`META_EXIT_TO_SCREEN_EDGE`, default OFF — owner acceptance
  pending): behind the flag the same expression is re-parametrised as an ease-out instead of the
  shipped ease-in — `launch·k + (1−launch)·k²` with `launch = 1.15` (`EXIT_EDGE_LAUNCH`,
  `exitToScreenEdge.ts:40`), fastest on its first frame and keeping at least 85% of that speed
  until the whole arrow is off screen. The ray is lengthened so the slow tail runs past the
  visible extent (`EXIT_EDGE_ONSCREEN_MAX = 0.6`, `exitToScreenEdge.ts:47`); the visible run
  itself is 88–185 ms depending on distance (`exitOnScreenMs`, `exitAnimationConfig.ts:82`). A
  later fix stops the native draw once the arrow has passed the extent, unless the camera panned
  during the exit (`endAtExtent`, `exitToScreenEdge.ts:201-206`).
- **Blocked bump**: the tapped arrow lunges along its own exit axis (peak about 0.22 cell) and
  springs back while its colour eases from `heart` to `ink`, over 300 ms
  (`feedbackCurves.ts:13,21-35`; `BoardView.tsx:1354`, `StaticBoardSurface.native.tsx:410`).
  - **Magenta hold** (`META_BLOCKED_INK_HOLD`, default OFF — owner acceptance pending): behind
    the flag the colour stays pure `heart` through the lunge's peak (k ≈ 0.32,
    `BLOCKED_BUMP_PEAK_K`, `feedbackCurves.ts:28`) instead of easing from the first frame, then
    releases to `ink` (or the missed mark) with a smoothstep over the rest of the same 300 ms
    driver (`feedbackCurves.ts:70-81`); the lunge's own timing, amplitude and spring-back are
    unchanged.
- **Heart pop**: the spent pip jumps to scale 1.35 and springs back (damping 9, stiffness 240)
  as it turns into its `pipSpent` outline (`GameScreen.tsx:1309,1329-1336`).
  - **Refill pop** (`META_HEART_REFILL_POP`, default OFF — owner acceptance pending): behind the
    flag, once an earned rewarded-ad continue's lose panel is gone (at once without
    `META_PANEL_MOTION`), the refilled pip starts at scale 1/1.35 ≈ 0.74
    (`HEART_PIP_REFILL_START_SCALE`, `heartPip.ts:23`) and springs to 1 with the loss pop's own
    spring (damping 9, stiffness 240, `HEART_PIP_SPRING`, `GameScreen.tsx:1309,1336`).
- **Pan momentum**: a released drag carries on and settles with rubber-band edges
  (`withDecay`, `BoardView.tsx:797,804`).
- **Button press spring** (`META_PRESS_SPRING`, default OFF — owner acceptance pending): behind
  the flag a button eases in to scale 0.94 over 90 ms (ease-out quad, `PRESS_IN_MS`,
  `PressScale.tsx:24,84-88`) instead of snapping, and springs back on release (damping 15,
  stiffness 400, mass 1, `PressScale.tsx:26-27,34,94-99`), settling at relative energy 1e-4 in
  about 0.61 s instead of Reanimated's default ~1.26 s (`RELEASE_ENERGY_THRESHOLD`,
  `PressScale.tsx:36-43`).

### Explanatory feedback — 280–1600 ms

- **Blocker flash**: the arrow in the way holds `heart` for the first 40% and fades out, its stroke
  relaxing from 1.6× to 1×, over 650 ms (`feedbackCurves.ts:15,45-62`; `BoardView.tsx:1301`,
  `StaticBoardSurface.native.tsx:360`).
- **Hint recentre**: the viewport eases (cubic out) to centre the hinted arrow in 280 ms
  (`BoardView.tsx:434,440`).
- **Hint pulse**: the hinted arrow's stroke width is multiplied by 1 + 0.45 · |sin 4πk| · (1 − 0.6k)
  as k runs 0 → 1 over 1600 ms, a decaying pulse; the arrow then stays `accent`
  (`BoardView.tsx:1417,1420-1422`, `StaticBoardSurface.native.tsx:483-487`).

### State / screen transitions — 180–380 ms

- **Menu ↔ game**: each screen fades in over 180 ms as it mounts (`FadeIn.duration(180)`,
  `screenHandoff.tsx:204`, wired for every screen slot at `App.tsx:347,350,354,359`). It is
  entering-only: the leaving screen is held invisible for a couple of frames (PERF-DEADTAG,
  `screenHandoff.tsx:170-210`) and then removed, not cross-faded. The invisibility sits on a plain
  view around the fading one, so a screen left during its own fade-in stays hidden (FINAL-FIX).
- **Splash → menu**: the splash fades out over 380 ms, starting 2250 ms after mount
  (`SplashScreen.tsx:110-113`), or over 180 ms when tapped to skip (`SplashScreen.tsx:131`).
- **Level → level** (`META_LEVEL_TRANSITION`, default OFF — owner acceptance pending): Next and
  Retry currently swap the board in a hard cut; behind the flag they instead swap under a flat,
  opaque scrim in the current background colour — 180 ms cover, the next level loads while fully
  covered, 180 ms uncover (`SCRIM_COVER_MS` / `SCRIM_UNCOVER_MS`, `ScreenScrim.tsx:20-21`; wired
  at `GameScreen.tsx:294`). Reduced motion skips the scrim (owner ruling 2026-09-25) — see Reduce
  motion below.
- **Theme toggle** (`META_THEME_TRANSITION`, default OFF — owner acceptance pending): Daylight ↔
  Ink Night is currently a one-frame flip; behind the flag it dips through the same kind of flat
  scrim instead, in the destination background colour — 180 ms cover / 180 ms uncover, reusing
  W2-04's scrim primitives (`themeTransition.ts`; wired at `App.tsx:256-261`), with the theme
  swapped and persisted under full cover. Reduced motion skips the scrim the same way (owner
  ruling 2026-09-25) — see Reduce motion below.

Not animated today (listed so nobody assumes otherwise):
The **win / lose panel** appears without animation, 450 ms after the clearing tap
(`WON_PANEL_DELAY_MS`, `gameSessionLifecycle.ts:19`) or 690 ms after the last heart is lost
(`LOSE_PANEL_DELAY_MS` = `BLOCKER_FLASH_MS` 650 + `FEEDBACK_CLEANUP_MARGIN_MS` 40,
`gameSessionLifecycle.ts:18`, `feedbackCurves.ts:15,17`; both wired at `GameScreen.tsx:534,641`).
Behind `META_POST_CLEAR_TIMELINE` (default OFF — the owner has not yet picked from the candidate
table) the win delay instead follows the last exit's own visible time plus a fixed 350 ms
empty-board hold (`EMPTY_BOARD_HOLD_MS`, provisional, `gameSessionLifecycle.ts:27`) plus 0 ms
reveal, so the empty board reads the same length regardless of which arrow exits last (today's
flat delay leaves 130–270 ms of empty board with the shipped board-edge exits, depending on that,
and about 265–362 ms with `META_EXIT_TO_SCREEN_EDGE` on; `gameSessionLifecycle.ts:22-24`, W2-06). Behind `META_PANEL_MOTION`
(default OFF — owner acceptance pending, except the loss duration below) the panel itself also
animates: the win panel scales from 0.94 and fades in over 180 ms (ease-out cubic,
`PANEL_WIN_ENTER_MS`, `overlayPresence.ts:31`, `PanelPresence.tsx:21`), the loss panel over
260 ms (`PANEL_LOSS_ENTER_MS`, **owner pick 2026-09-25**, `overlayPresence.ts:36`), and an earned
continue's dismissal fades the panel out over the same 180 ms (ease-in quad, `PANEL_EXIT_MS`,
`overlayPresence.ts:38`, `PanelPresence.tsx:22`). A **button press** is a pressed style, scale
0.94 while held, with no tween either way (`HeaderButton.tsx:89`, `HomeScreen.tsx:211`,
`GameScreen.tsx:936,961`) — behind `META_PRESS_SPRING` it eases and springs instead; see
Tap-local feedback.

### Ceremony — 850 ms

- **Splash intro**: the wordmark springs in from scale 0.72 at 150 ms (damping 14, stiffness 120),
  the line-art arrow draws itself over 850 ms from 650 ms, and the arrowhead springs in at 1450 ms
  (damping 12, stiffness 260) (`SplashScreen.tsx:80-107,137-147`).
- **Star pops**: each star on the win panel springs in (damping 11, stiffness 260), scaling up from
  0 and turning from −24°, staggered 250 ms + 170 ms per star (`GameScreen.tsx:1386,1405-1413,1421-1424`).

### Ambient (menu only, exactly one) — 1100 ms

- **Play breathing**: the Play pill scales 1.00 → 1.03 and back forever, 1100 ms each way with a
  sine in-out curve, a 2.2 s cycle (`HomeScreen.tsx:161-181`). It has no entrance spring.

### Reduce motion

**Required** (`PRODUCT.md`, Principle 4 and Accessibility): under the OS reduce-motion setting,
feedback that carries information (blocker flash, blocked arrow, hint) renders a **static
equivalent** and honours the setting; it is never forced on with `ReduceMotion.Never`. Decorative
motion (heart pop, star pops, Play breathing, splash) may simply be skipped. **Vestibular motion**
(hint recentre, pan/fling momentum) **is suppressed**: each states `ReduceMotion.System`, the same
wording as the comments at each call site ("Vestibular … follows the player's system setting",
`BoardView.tsx:433,439,796,803`), so under reduced motion it lands on its end value at once — no
recentre, no fling. No glow, bloom, gradient, confetti or particles appear in any motion state, and
nothing below adds ambient board motion.

**What ships today** (each line cites the report that verified it on device, or says it did not):
- **Blocker flash and blocked arrow hold; they do not black out.** Under reduced motion the blocker
  stays solid at its 1.6× onset swell for the whole flash lifetime instead of fading
  (`feedbackCurves.ts:47-53,58-61`), the tapped arrow's colour mix stays `heart` instead of easing
  toward ink (`feedbackCurves.ts:70-72`), and its bump displacement is held at zero
  (`BoardView.tsx:1358`, `StaticBoardSurface.native.tsx:414`; W2-09 acceptance 5 measured max
  |displacement| 0.22 px, below the 1 px recording-pixel floor). The heart holds until the overlay
  unmounts, then the tapped arrow cuts straight to `ink` — or, with `META_MISSED_MARK` (behind the
  flag, default OFF, not yet accepted), to the missed mark (R6a) — with no tween frame in between:
  heart through +317.6 ms, the mark from +334.3 ms, "no tween frame and no motion"
  (`docs/next-level/reports/POLISH-T5.md` evidence 5). This replaced an earlier defect where the
  same `withTiming` calls used Reanimated's default and jumped to their end value at once — the
  blocker already transparent, the arrow already `ink` — fixed by W0-04, with its mount-to-paint
  lifetime fixed by W0-04b.
- **Hint** keeps a static `accent` tint at a constant 1.45× stroke swell instead of pulsing
  (`feedbackCurves.ts:87,91-93`; W0-04).
- **Native exit: a stationary dash and arrowhead that fade linearly in place, with no translation.**
  The owner accepted this look 2026-09-27 from the two scale-0 recordings
  (`docs/next-level/reports/W2-01.md`, "Owner acceptance required";
  `artifacts/W2-01/android/W2-01-level0-exit-scale0/`,
  `artifacts/W2-01/android/W2-01-harness-exit-scale0/`). Android holds travelled distance at zero
  and fades opacity linearly (`ArrowsBoardView.kt:654-667`); the Swift mirror does the same
  (`ArrowsBoardView.swift:193,202-221`) but was read, not run — **UNVERIFIED-DEVICE**.
- **Web exit matches the native look.** `ExitTrail` states `ReduceMotion.Never` so its opacity
  clock keeps running under reduced motion while its own reduced-motion branch holds travel at zero
  and fades linearly (`BoardView.tsx:1464-1471,1486-1500`; W2-01). This is **INFERRED from code**:
  Chrome could not be driven in the W2-01 sandbox, so the web look is **UNVERIFIED-WEB**.
- **Decorative motion is skipped**, each stating `ReduceMotion.System`: heart-pip pop
  (`GameScreen.tsx:1340`), star pops (`GameScreen.tsx:1410`), Play breathing (`HomeScreen.tsx:163`),
  splash (`SplashScreen.tsx:79,89,99,109`), and the menu/game screen fade
  (`screenHandoff.tsx:203-204`). The heart-loss case was verified on device — spent outline visible,
  no pop (`artifacts/W2-01/android/W2-01-fix-blocked-scale0/frames/00006.png`) — and so was the
  heart-refill pop, behind `META_HEART_REFILL_POP` (default OFF, not yet accepted): the pip is
  filled at rest in every frame, none off rest (`docs/next-level/reports/W2-07.md` acceptance 7).
- **Level→level and theme-toggle scrims are a straight cut, not a zero-duration fade** — both
  behind their flags, default OFF, not yet accepted (`META_LEVEL_TRANSITION`,
  `META_THEME_TRANSITION`). Owner ruling 2026-09-25, "skip the fade on reduced motion" (commit
  `7786143`), applied the same way to the theme scrim in W2-08 (commit `7d81d4b`, "owner ruling for
  scrims"): the scrim is never created under reduced motion, so Next/Retry and the theme toggle
  swap in one frame (`GameScreen.tsx:294`, `App.tsx:257`).
- **Panels**, behind `META_PANEL_MOTION` (default OFF, not yet accepted), are at rest on their
  first frame, not mid-tween (`docs/next-level/reports/W2-05.md` acceptance 7, `cap/on-win-reduced`).
- **Press spring**, behind `META_PRESS_SPRING` (default OFF, not yet accepted), states
  `ReduceMotion.System` (`PressScale.tsx:87,99`); `docs/next-level/reports/POLISH-T9.md` pins this
  only with a jest config assertion and says it "was not captured" on device —
  **UNVERIFIED-DEVICE**.

## Layout

Portrait only (`app.json:6`). Content stays inside the safe-area insets
(`GameScreen.tsx:209,997`, `HomeScreen.tsx:76,265,319`). Game screen: the header row at the top
(back button and level label left, hearts and hint right, 16 pt side padding,
`GameScreen.tsx:1466-1483`), then the board filling the rest of the screen, fit-to-view
(`BoardView.tsx:1526-1529`). No bottom bar.

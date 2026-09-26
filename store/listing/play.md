# Google Play listing copy — DRAFT for the owner (W7-10)

Status: draft. Nothing here has been uploaded. The owner picks one title candidate and accepts or
edits the copy in W7-10; the app's `name` in app.json is not changed here.

Format: one `field: value` per field (`|` starts an indented block). Check with
`node scripts/check-listing.js store/listing/play.md store/listing/apple.md` (limits: title 30,
short description 80, full description 4000; banned phrases per ruling W7-9).

Every claim describes the **flags-default build** (all `EXPO_PUBLIC_*` flags unset). A line about
the daily board, the gallery, the menu banner or the review prompt is added only in the release
that turns its flag on. Audience register: general / adult (target audience 13+, see
docs/data-safety.md section 6); no child-directed wording.

## Title candidates (pick one)

title_1: Arrows: Ink Night
title_2: Arrows – Calm Arrow Puzzle
title_3: Arrows: Clear the Picture

Notes for the owner: 1 is the brand (RELEASE.md's earlier fallback name) and is distinct from
other "Arrows" apps; 2 carries the genre search words "arrow puzzle"; 3 says what you do. The bare
word "Arrows" competes with every arrow app.

## Short description

short_description: Tap the arrows with a clear way out and clear the picture. No timers, no rush.

## Full description

full_description: |
  Arrows is a calm game about looking closely.

  Every level is a picture made entirely of arrows: a heart, a crescent moon, a flower, a rocket. Tap an arrow and it slides off the board in the direction it points, as long as nothing stands in its lane to the edge. Tap an arrow that is blocked and it costs a heart.

  Read the board, spot the arrows that are free to leave, and clear the picture.

  • No timers. Take as long as you like.
  • Every level opens with the whole picture on screen. Pinch to look closer; pinch out and the whole picture is back.
  • A new board every level, drawn as one of 26 shapes.
  • Three hearts per level for the lanes you misread.
  • Two looks: Daylight, black ink on white paper, and Ink Night, moonlit arrows on deep ink.

  Arrows is free and shows ads between some levels. Rewarded ads are always your choice: watch one for a hint, or to continue a level after your hearts run out.

## Claims → evidence

Each claim above, with where it is true in the flags-default build (file:line at `b082532`, or the
command that measured it).

- C1 "a calm game", "No timers. Take as long as you like", "no rush": the game has no clock or
  time limit. `grep -rn -i -E "time ?limit|countdown|secondsLeft|timeLeft" src/core src/ui` on the
  `b082532` extract (EXECUTED 2026-09-26) prints 3 lines, none a gameplay clock: all three are
  comments about the `__DEV__`-only simulated ad's countdown (`src/ui/ScreenScrim.tsx:46`,
  `src/ui/ads.tsx:49`, `src/ui/scrimTransition.ts:199`). PRODUCT.md "Users" ("no timers, no
  pressure") and "Product Purpose".
- C2 "a picture made entirely of arrows": `src/core/levelGenerator.ts:39-40` (each level packs
  every cell of the shape's silhouette with arrows) and `:51` ("100% filled").
- C3 "slides off the board in the direction it points, as long as nothing stands in its lane to
  the edge": `src/core/boardLogic.ts:64-72` (`canExit`: the straight ray from the head to the edge
  holds no other arrow's cell).
- C4 "Tap an arrow that is blocked and it costs a heart" / "Three hearts per level":
  `src/ui/GameScreen.tsx:538-571` (`blockedTapCost`, then `hearts - 1`); `hearts: 3` for every tier
  in `src/core/difficulty.ts:60,62,65`. A repeat tap on the same blocked arrow can be refunded by
  the tap ledger (`GameScreen.tsx:557-563`), so the copy says "costs a heart", never "every tap".
- C5 "Read the board, spot the arrows that are free to leave, and clear the picture": PRODUCT.md
  "Product Purpose" (a visual search; no tap order can make a board unsolvable,
  `src/core/__tests__/noDeadEnd.test.ts`).
- C6 "Every level opens with the whole picture on screen … pinch out and the whole picture is
  back": `src/ui/boardCamera.ts:80-92` (`zoomed` false → the camera opens at `fit`, and
  `minScale` is `fit` either way); `src/ui/BoardView.tsx:408-410` passes `META_ZOOMED_CAMERA`,
  which is off by default (`src/featureFlags.ts`); the pinch gesture is `BoardView.tsx:750`.
- C7 "A new board every level, drawn as one of 26 shapes": the level is a pure function of its
  index (`src/core/levelGenerator.ts:35-37`). **26** measured at `b082532` (EXECUTED 2026-09-26,
  from the root of a `git archive b082532 src` extract with the repo's node_modules, so no
  uncommitted change is counted):
  `npx tsx -e "import {LevelGenerator} from './src/core/levelGenerator'; const s=new Set<string>(); for (let i=0;i<300;i++) s.add(LevelGenerator.generate(i).shapeName); console.log(s.size)"`
  → `26` (and `shapeNameForLevel` over levels 0..19999 also gives 26). The same one-liner on a
  `1c80098` extract (after W3-03 / W3-04) also prints `26`. W4 measured 26 at `da93dcd`. **Re-run at the release commit**: W3 may change the catalogue.
- C8 "a heart, a crescent moon, a flower, a rocket": `Heart`, `Crescent`, `Flower`, `Rocket` are
  among the 26 names (EXECUTED on the same extract: a scratch script printing the sorted set of
  `shapeNameForLevel(i)` for i in 0..19999: Arrow, Bolt, Butterfly, Cat, Circle, Crescent, Crown,
  Diamond, Fish, Flower, Heart, Hexagon, Hourglass, Mushroom, Octagon, Pentagon, Pine, Plus,
  Rectangle, Ring, Rocket, Square, Star, Triangle, Trophy, X).
- C9 "Two looks: Daylight … and Ink Night …": `src/ui/theme.ts:5-6` (palette descriptions),
  `:73` (`paletteFor`); the menu toggle is `src/ui/HomeScreen.tsx:235`, not behind a flag.
- C10 "shows ads between some levels"; "Rewarded ads … for a hint, or to continue a level after
  your hearts run out": interstitial pacing `src/ui/adPacing.ts` (W0-05); rewarded hint and
  continue units `src/ui/adUnits.ts`, per-placement readiness in `src/ui/ads.tsx` (ADMOB-B, M3);
  Play's "Contains ads" label comes from the ads declaration (docs/data-safety.md section 7).
- Not claimed on purpose: an ordering or planning mechanic (ruling W7-9, Track A); difficulty that
  rises (flat curve until W3 ships a measured one); an unlimited catalogue; the daily board,
  gallery, streak freezes, banner and review prompt (flags off).

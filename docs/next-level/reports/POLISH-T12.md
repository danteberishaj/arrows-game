# POLISH-T12: an exit re-rasterises one strip of the board, not the whole board, and starts in the tap's commit frame

Status: **DONE_WITH_CONCERNS**. Everything is in the working tree, uncommitted (`ArrowsBoardView.kt` only). No git
state was changed.

- **Part A ships.** The static arrow art is split into horizontal strips as wide as the board (267 board points = 3
  strips on level 1). A `visibleMask` / `markMask` change rebuilds only the strips whose arrows changed.
  - Perfetto, 27 exits: BASE uploads two whole-board masks per exit (`1850x1851`-class, median 6.74 Mpx); the
    shipped build uploads one strip's pair (median 2.41 Mpx, e.g. `1850x890`, `1499x676`, `1044x633`) and runs
    exactly one `ArrowsBoard.rebuildStrip` per commit (27/27).
  - The first exit frame's RenderThread median goes from 10.5-11.2 ms to 6.4-6.6 ms per run (Part A alone).
- **Part B ships** (POLISH-T10's same-frame start, re-applied by hand on Part A). The exit's first frame is now the
  commit frame itself: in the recordings the first motion appears in the same displayed frame as the "N left"
  counter, 162/162 exits (BASE: one refresh later, and two in 4/81).
  - Tap -> first motion: median **55.5 ms (BASE) -> 53.0 (A) -> 36.2 ms (A+B)**, n = 81 each.
  - The merged first frame costs 8.1-8.6 ms RenderThread (BASE's first exit frame: 10.5-11.9) and missed its
    vsync in **0 of 216** exits (BASE 7 of 216; the same-APK null 1 of 216).
- **Performance gate: PASS on every scenario** (the table below). Two honest caveats, both inside the same-APK null
  spread: pinch frames (every one re-rasterises) run about +0.35 ms RenderThread median in both grid states, and
  exit frames about +0.07 ms. Details and why in "Gate results".
- **Look: the brief's "0 px vs BASE at rest" is not attainable with tiled art, and is not met.** Arrow edges differ
  by at most one quarter-pixel anti-aliasing step (max delta 60 of 255; 30,596 px at the opening camera, 12,502 at
  fit; 0 px outside the arrows' edges; 0 full-pixel flips). Evidence that any partition does this, and that BASE
  re-quantises its own unchanged arrows on some exits, is below. Owner eyeball needed.
- Every device number: **emulator-5556** (AVD `fleet_floor_api31`, API 31, 1440x3120 @560, 60 Hz), Daylight unless
  said, scales 1/1/1, level 1. iOS and web were not run (not touched).

## Summary table
BASE = `artifacts/POLISH-T10/arrows-testads-T10-fix1.apk` (a8a3a90). A = Part A. A+B = shipped. Null = the A+B APK
run again, interleaved. Values are min-max over runs unless said. EXECUTED throughout.

| scenario | metric | BASE | A | A+B (shipped) | null (A+B again) | frames: recorded / expected @60 Hz |
|---|---|---|---|---|---|---|
| exit burst, gfxinfo (5 runs x 27 exits per arm) | first exit frame RT median per run, ms | 10.54-11.22 | 6.40-6.64 | 8.10-8.62 | 8.25-8.59 | 2060/2060, 2060/2060, 1925/1925, null 1925/1925 |
| | first exit frame missed vsync | 1/135 | 0/135 | 0/135 | 1/135 | |
| | frames per exit | 15.26 | 15.26 | **14.26** | 14.26 | |
| | frames > 16.7 ms per exit (per run) / > 33.3 ms | 0-0.41 / 0 | 0 / 0 | 0 / 0 | 0-0.56 / 0 | |
| | all frames: RT median / total median per run, ms | 3.66-3.74 / 5.44-5.58 | 3.77-3.85 / 5.58-5.79 | 3.74-3.80 / 5.50-5.67 | 3.75-3.87 / 5.53-5.78 | |
| exit burst under screenrecord (3 runs x 27 per arm) | first exit frame RT median per run, ms | 11.52-11.94 | 7.85-7.98 | 8.44-8.57 | 8.22-8.66 | 1232/1236 (A1: a 101 ms host stall), 1236/1236, 1155/1155, 1155/1155 |
| | first exit frame missed vsync (per run) | **6/81** (4-15%) | 1/81 (0-4%) | **0/81** | 0/81 | |
| | recording: first motion held 2+ refreshes after the counter changed | 4/81 | 1/81 | 0/81 (0 refreshes: 81/81) | 0/81 (0: 81/81) | |
| | buffer-stuffed exits / > 16.7 ms per exit | 5/81 / 0.41-1.70 | 1/81 / 0-0.56 | 0 / 0 | 0 / 0 | |
| tap -> first motion (POLISH-T10 method, the recordings above) | median (p90), n | 55.5 ms = 3.33 frames (61.5), 81 | 53.0 (60.1), 81 | **36.2 = 2.17 frames** (43.1), 81 | 38.8 (44.1), 81 | |
| | exits with first motion <= 2 frames | 0/81 | 0/81 | 23/81 | 27/81 | |
| static-art upload per exit (Perfetto, 27 exits) | median / max Mpx; frame | 6.74 / 6.86; next frame 26/27 | 2.41 / 3.17; next frame | 2.41 / 3.17; **commit frame** | - | |
| pans at the opening camera, grid ON (6 x 700 px + flings, 5 runs) | RT median / total median per run, ms | 3.54-3.66 / 5.58-5.79 | not run (INFERRED: the same `onDraw` as A+B) | 3.63-3.74 / 5.64-5.94 | 3.59-3.67 / 5.57-5.69 | 3455/3472, 3385/3402, 3379/3396 |
| | RT p95 / runs with a stuffed-mode episode | 4.65-16.83 / 1 of 5 | | 4.86-17.00 / 1 of 5 | 4.80-5.01 / 0 of 5 | |
| pinch-to-fit, grid ON (3 cycles per run) | RT median / total median per run, ms | 7.42-8.56 / 9.67-11.48 | | 8.03-8.95 / 10.85-11.76 | 8.33-8.64 / 10.60-11.04 | 499/530, 477/500, 494/515 |
| | RT p95 per run | 12.82-17.59 | | 11.43-17.36 | 11.75-16.75 | |
| pans at fit, grid ON | RT median / total median per run, ms | 3.40-3.48 / 5.49-5.82 | | 3.45-3.54 / 5.38-5.75 | 3.44-3.51 / 5.46-5.72 | 4055/4056, 4039/4075, 4076/4076 |
| | RT p95 per run | 4.29-15.88 | | 4.33-4.60 | 4.33-4.45 | |
| pans at the opening camera, grid OFF | RT median / total median per run, ms | 3.40-3.70 / 5.42-6.05 | | 3.44-3.54 / 5.43-5.73 | 3.49-3.62 / 5.50-5.80 | 3299/3322, 3420/3427, 3264/3273 |
| pinch-to-fit, grid OFF | RT median / total median per run, ms | 7.87-9.03 / 10.37-11.66 | | 8.25-8.86 / 10.91-11.46 | 8.27-8.65 / 10.63-11.29 | 417/440, 425/451, 426/449 |
| pans at fit, grid OFF | RT median / total median per run, ms | 3.28-3.36 / 5.36-5.78 | | 3.34-3.39 / 5.47-5.61 | 3.29-3.37 / 5.32-5.67 | 4003/4057, 4053/4053, 4031/4048 |
| level load, fresh board (Home -> Play, new geometry), n = 10 per arm | press -> end of the new board's first frame: median (range) | 138.8 ms (118.6-268.1) | 132.8 (96.1-164.3) | 135.9 (114.9-214.7) | 141.1 (115.3-258.2) | (Perfetto) |
| | that frame's RT median (max); static-art masks | 28.0 ms (44.0); 2 masks, 6.86 Mpx | 21.0 (46.5); 6, 7.79 Mpx | 23.5 (52.7); 6, 7.79 Mpx | 24.0 (90.5) | |
| level load, Retry (same W2-04 swap as Next), n = 8 | median (range) | 246.9 ms (232.5-263.2) | not run | 245.2 (231.1-259.5) | not run | |

Reconciliation notes:
- Exit-burst runs match their expected frame counts exactly, except BASE A1 under screenrecord (408/412, one 101 ms
  host stall in exit 14).
- The pan/pinch shortfalls are the instrument, not dropped frames. A run that misses frames misses 17-18 of them
  in one block: HWUI keeps 120 frames, so the ~300 ms between the post-gesture dump and the settle dump is lost
  when the settle is still animating. That happened in 10 of 45 runs, in every arm (A1, F1, F2, F3, N4, C1, C2, C4,
  C5, H3). Pinch phases lose 2-10 frames per run between their per-gesture dumps, in every arm.

## What changed
| File | Change |
|---|---|
| `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/ArrowsBoardView.kt` | **Part A:** `Strip` (per-strip shaft / head / mark-shaft / mark-head paths); `ArrowPaths.centreY`; `partitionStripsLocked()` on every geometry; `rebuildCompoundPathsTraced()` now diffs each arrow's layer (hidden / ink / mark) and rebuilds only dirty strips (`rebuildStripLocked`, trace section `ArrowsBoard.rebuildStrip`); `onDraw` draws each layer strip by strip in BASE's layer order; `STRIP_HEIGHT_PT = 267f` with its measurement. **Part B:** `hasMotion` payloads start their clock one refresh early (`frameIntervalMs()`) and `invalidate()` on the main thread; 10 + 2n payloads keep `postInvalidateOnAnimation()`. |

Not changed: the grid tile (POLISH-T8), `commitProps()`, exit drawing (`drawExitSlot`, `dashSpan`, POLISH-T10
`endMs` and camera check), paints, mark colours, JS, iOS, web, flags, save data (no migration, no wipe risk). The
JS bundle of every grid-ON arm is byte-identical to BASE's (`083c4213...bbb0`).

## Part A: per-strip static art

### The defect, confirmed on BASE (EXECUTED; `trace/BASE-tr1*`, `scripts/trace12.py`)
- Perfetto (POLISH-T10's config), BASE, the 27 solve-order exits: every exit uploads two board-sized masks
  (`1850x1851`, `1852x1853`, shrinking as edge arrows leave), median **6.74 Mpx**, on the RenderThread frame after
  the mount (26/27; exit 22 also uploads a trail mask later). `ArrowsBoard.rebuildCompoundPaths` once per commit.
- Mechanism. EXECUTED (behaviour, harness and app traces): a path that is rebuilt is rasterised and uploaded again
  on its next draw, and a path left untouched is not. INFERRED (Skia internals, not read in source here): HWUI's Skia
  draws these anti-aliased paths through its software path renderer and caches each mask by the Path's generation
  id, which a rebuild changes. BASE rebuilds its one compound path on every exit, so the whole board goes again.

### On-device render harness (EXECUTED; `scripts/TileHarness.java`, `scripts/geo12.ts`, `harness/`)
- `app_process` on emulator-5556, the device's own HWUI + Skia GPU pipeline (`HardwareRenderer` -> `ImageReader`).
  It uses the app's RenderNode chain (header offset, camera translation/scale about (0, 0), `canvas.scale(3.5)`),
  the app's paints, and level 1's exact `geometry` prop.
- It reproduces BASE: the same two `1850x1851`/`1852x1853` uploads per removal. An exit frame costs 8.7-8.9 ms
  there, against 2.2 ms for a frame that changes nothing.
- It was used to choose the partition (below) and to prove the look finding (Look section).

### Design
- **Strips.** An arrow belongs to the strip holding the centre of its points' bounding box
  (`floor(centreY / 267)` in board points). A strip is as wide as the board. Empty strips are not created.
- **Only changed strips rebuild.** The rebuild still happens once per props commit (`commitProps()`), or in `onDraw`
  if a draw comes first. It compares each arrow's layer with the one last recorded and rebuilds only strips whose
  members changed. Untouched strips keep their Path objects, so Skia's masks survive.
- **No seams by construction.** Arrows are drawn whole inside their strip's paths, and nothing is clipped at strip
  edges.
- **Order kept.** The layers are BASE's, in BASE's order: every ink shaft, every ink head, every marked shaft,
  every marked head. Each layer is now one `drawPath` per non-empty strip, top to bottom. Within a strip, arrows are
  added in board order. The grid tile is still drawn first and the exit slots last.

### Strip height: why full-width strips, and why 267 pt (measured)
- **Square tiles were measured first and rejected** (harness, `harness/cost-sweep1.txt`, `cost-sweep2.txt`, and a
  Perfetto trace of the harness):
  - 6-cell squares (240 pt, 10 tiles) cut the exit frame from 8.8 to 3.0 ms.
  - But they made the 700 px pans at the opening camera worse: median +0.13 ms, p95 +0.37 ms.
  - The trace showed why: tiles at the screen's left/right edges re-uploaded in 150 of 360 pan frames (and one edge
    tile in 101 of 381 exit frames); the board mask did in 1 of 360.
  - Level 1 at the opening camera only overflows sideways, so a strip as wide as the board behaves like BASE's mask
    along x. Strips kept pans at BASE's cost (pans 2.09-2.17 ms against 2.13-2.14; `cost-sweep3-strips.txt`).
- **Strip height: first round 160 pt (5 strips), superseded** (`superseded-5strips/`):
  - It passed the exit gate: first exit frame RT 5.7-6.2 ms.
  - But pans at fit ran +0.08 ms RenderThread median over BASE (A 3.37-3.43 ms per run; F 3.47-3.52; its null
    3.43-3.51): the ranges touched.
  - Perfetto of those pans (`pantrace/`): almost no uploads in either build (1 and 4 frames of 731 and 722), and
    +0.04 ms on the frames without uploads. That is the cost of 8 extra draw calls on the emulator's RenderThread.
- **Shipped: 267 pt (3 strips, 4 extra draws).**
  - Harness: exit frame 4.46-4.50 ms (160 pt: 4.02-4.14; 400 pt: 5.66; BASE: 8.66-8.71); fit pans at BASE's cost;
    zoomed-in exits (scale 1.31) 6.8 ms against BASE's 15.2 (`cost-sweep4-zoomed.txt`).
  - Level 1's three strips are 277, 363 and 266 pt tall (arrows reach past their strip): 1.22x the board's area in
    total.
  - The in-app gate below is for 267 pt.

## Part B: the exit starts in the commit frame
- **The patch.** POLISH-T10's `latency-fix/same-frame-exit-start.patch` predates `endMs` and does not apply to BASE.
  It was re-applied by hand: `artifacts/POLISH-T12/partB-same-frame-exit-start.patch` (a diff against Part A;
  applied in the tree).
- **Behaviour** is the POLISH-T10 patch's:
  - A payload with motion tokens (12 + 2n or 13 + 2n; META_EXIT_TO_SCREEN_EDGE on, not reduced motion) starts its
    clock one display refresh early (16 ms at 60 Hz) and calls `invalidate()` on the main thread, which joins the
    frame that mounts the commit.
  - A 10 + 2n payload (flag OFF, reduced motion) keeps BASE's timing and `postInvalidateOnAnimation()`.
  - `endMs` counts from the earlier start, so the exit stops at the same exit clock, one refresh earlier.
- **Traced** (EXECUTED; `trace/AB-tr1*`): the strip upload moves into the mount's own RenderThread frame (`@RT0`),
  where Part A has it one frame later (`@RT1`).
- **Recorded:** the first motion is on screen in the same frame as the counter change in 162/162 exits
  (`pacerec/*-hold.json`).
- **Gate:** passed (below), so it ships. On BASE it failed (POLISH-T10: the merged frame exceeded 16.7 ms in 46% of
  exits). Here the merged frame's RenderThread is 8.1-8.6 ms per run, and it missed its vsync in 0 of 216 exits.

## Gate results (EXECUTED; `pace/paceab12.md`, `pacerec/paceab12.md`, `pan-gridon/panab.md`, `pan-gridoff/panab.md`, `load/*-load.json`, `pacerec/summary/summary.md`)

### Method
- **Arms and flags.** Arms are installed with `install -r` (the upload-key signer and versionCode 6 of BASE, app data
  kept) and interleaved. Each run logs the installed sha256. Every arm has the same flag set (POLISH-T10 `build.sh`,
  copied).
- **Bundles.** The grid-ON arms share the JS bundle `083c4213...bbb0`; the grid-OFF arms (`META_BOARD_GRID` unset)
  share `88d3acc9...9135`. So the arms differ only by `ArrowsBoardView.kt`.
- **"Beyond the null spread"** = the arm's per-run range does not overlap BASE's, **and** the difference of
  medians exceeds the same-APK per-run spread.
- **RenderThread mode.** Every run of every block was in the emulator's fast mode (per-run RT median < 8 ms). Pinch
  phases are the exception: every pinch frame re-rasterises, so their median is 8-10 ms by nature.
- **1. Exit burst.** POLISH-T10 `pace.mjs`, unchanged: 27 exits; `gfxinfo reset`, tap, 1100 ms, framestats. The
  analysis is `paceab12.py`.
  - Frame #0 of an exit is the mount frame: the traces show no RenderThread frame between UP and the mount (81/81
    taps).
  - The **first exit frame** is #1 for BASE and A, and #0 for A+B (upload `@RT1` vs `@RT0`).
  - Missed vsync = FrameCompleted > FrameDeadline (IntendedVsync + 16.67 ms on this emulator).
  - **Under screenrecord** (`pacerec.mjs`): the same loop while screenrecord runs at POLISH-T10's capture size. In
    that load BASE held its first exit frame in 9-20 of 27 exits in POLISH-T10. Without it, BASE almost never
    misses (1/135 here).
- **2. Pan / fling / pinch** (`panlevel.mjs`: the POLISH-T4/T8 driver and gestures on level 1):
  - 6 alternating 700 px / 1000 ms pans at the opening camera, released moving, so they end in flings and rubber
    band;
  - pinch: the opening -> fit pinch-out, plus 2 cycles of pinch-in / pinch-out;
  - 6 pans at fit.
  - gfxinfo is dumped per gesture and after a 2 s settle, one row per IntendedVsync (`panab.py`).
- **3. Level load** (`loadtrace.mjs` + `loadtrace.py`, Perfetto): press (injected UP) -> end of the RenderThread
  frame that uploads the new board's static-art masks.
  - **Next was not used.** It first asks for a paced interstitial, which would stop the harness and must never be
    tapped; every game also advances the persisted counter.
  - **Fresh board (primary):** header back -> Home -> Play. This creates a new native view and a new geometry, so
    every mask rasterises, as for a new level.
  - **Retry (secondary):** 3 blocked taps, then Retry. This runs Next's W2-04 swap (`levelScrim.start ->
    loadLevel`) with no ad call. The trace shows the geometry re-sent and every strip rebuilt (6 mask uploads), as
    on Next. The Continue (ad) button is never touched: the script taps only after it confirms the Retry node's
    bounds.
- **4. Latency.** POLISH-T10 `profile.py` on the screenrecord runs: the first frame whose head travel is > 0.12 cell,
  against the injected UP time. `holdcount.py` counts the refreshes from the frame where "N left" changes to the
  first moving frame.
  - Absolute values are lower than POLISH-T10's 72 ms: the pace loop's `dumpsys` before each tap changes the tap's
    vsync phase. The arms share it.

### Verdicts
1. **Exit burst: PASS** (A and A+B).
   - First exit frame RT (median of the per-run medians) drops by 4.2 ms (A; 3.7 under screenrecord) and 2.3 ms
     (A+B; 3.2 under screenrecord). The per-run ranges do not overlap BASE's in either block. The same-APK spread is
     0.3-0.4 ms.
   - Missed vsync on the first exit frame, pooled over both blocks:
     - BASE 7/216;
     - A 1/216;
     - A+B 0/216, its null 1/216.
     - Under screenrecord the per-run ranges separate: BASE 4-15%, A+B 0% in 6 of 6 runs.
   - Frames per exit are unchanged (A) or one fewer (A+B: the merged first frame).
   - Frames > 16.7 ms per exit: A+B 0 in both blocks. A 0 in the gfxinfo block and 0-0.56 under screenrecord (one
     stuffed exit). BASE 0-0.41 and 0.41-1.70. Frames > 33.3 ms: none in A or A+B.
   - Caveat: all frames in the exit window read about **+0.07 ms RenderThread median** in A+B (3.74-3.80 against
     3.66-3.74 per run). That is inside the same-APK spread (null 3.75-3.87), and the total frame median overlaps
     BASE (5.50-5.67 against 5.44-5.58).
     - INFERRED: the 4 extra `drawPath` calls per re-recorded exit frame.
     - Under screenrecord the medians are equal (A+B 5.28-5.36, BASE 5.29-5.56).
2. **Pans and pinch, grid ON and OFF: PASS** (every median and p95 range overlaps BASE's; every difference is
   within the same-APK spread).
   - Pinch-frame RenderThread median (median of the per-run medians) is **+0.34 ms (grid ON) / +0.38 ms (OFF)**
     over BASE; the same APK's null reads +0.12 / +0.36. Per-run ranges overlap BASE's (BASE's own runs span 1.1
     ms), and p95 is not worse.
     - INFERRED: every pinch frame re-rasterises all 3 strips (6 masks, 1.22x the area) instead of 2 board masks.
   - Pans at fit: A+B 3.45-3.54 ms against BASE 3.40-3.48 (grid ON); 3.34-3.39 against 3.28-3.36 (OFF). The ranges
     overlap, and the difference of medians (+0.04 / +0.03) is below the same APK's per-run spread (0.10 in both).
   - Stuffed-mode episodes (one pan with ~90 frames > 16.7 ms) occur in BASE and in the shipped build in both grid
     states, and in the grid-OFF null (up to 91). They are the emulator's, not attributable to either build.
3. **Level load: PASS.**
   - Fresh board: medians 138.8 (BASE) / 132.8 (A) / 135.9 (A+B) / 141.1 ms (null). The new board's first frame is
     not heavier: RenderThread median 21.0 (A) / 23.5 (A+B) / 24.0 (null) against 28.0 ms (BASE; its two traces read
     35.7 and 26.6, so this is noisy), although strips upload 6 masks (7.79 Mpx) against 2 (6.86 Mpx).
   - Retry: 246.9 (BASE) vs 245.2 ms (A+B).
4. **Latency:** BASE 55.5 ms -> A 53.0 -> A+B **36.2** (null 38.8). A+B reaches <= 2 frames in 23/81 exits (BASE
   0/81).

### Texture-upload evidence (EXECUTED; `trace/*-trace12.txt`, per tap)
| build | sections per commit | static-art uploads per exit | where |
|---|---|---|---|
| BASE | `rebuildCompoundPaths` x1 | 2 board masks, `1850x1851` + `1852x1853` (shrinking to `1850x1645`/`1852x1527` as edge arrows leave); median 6.74 Mpx, max 6.86 | next frame after the mount (26/27) |
| A | `rebuildStrip` x1 (27/27) | 1 strip pair, e.g. `1850x890`, `1815x676`, `1499x676`, `1044x633`; median 2.41 Mpx, max 3.17 | next frame (25/27) |
| A+B | `rebuildStrip` x1 (27/27) | the same sizes | **the mount frame** (25/27) |
- The 2 remaining taps are classification edges: a late-emptied strip whose mask is narrower than the 600 px
  threshold (367x470), and one horizontal exit trail above it. Neither is a board mask.
- The exiting arrow's own trail masks (e.g. `131x480`, drawn uncached every exit frame) are identical in all three
  builds.

## Look

### "0 px vs BASE at rest" is not attainable with tiled art (evidence; EXECUTED, harness)
- **One bucket reproduces BASE exactly.** Drawing all arrows as one strip matches BASE's compound path with **0 px**
  difference, 61 states x 4 cameras (`harness/exact-onebucket-and-267.txt`). The harness adds no difference.
- **Moving a mask's corner re-quantises its edges.** Draw the 4 leftmost arrows as a separate path, so the other
  arrows' mask starts about 24 px further right: **1,164 px** of the *other* arrows change at the opening camera.
  With the 6 topmost: 4,823 px. At a camera where every coordinate is exact in float (2 px per board point,
  integer x translation), moving the left edge changes **0 px** (`harness/origin-experiment.txt`).
  - INFERRED mechanism: Skia rasterises a mask relative to its own corner (`x*scale + (tx - maskLeft)` in float) and
    quantises coverage to 1/4 pixel. A different corner rounds some edges across a step.
  - Any partition gives each part its own corner, so every tiled design differs from BASE this way. The harness
    predicted the in-app difference exactly: 30,596 px at the opening camera, for 267 pt strips and for the app.
- **BASE does the same to itself.** In BASE's own compound path, removing arrow 16 changes **17,938 px** of the
  *other* arrows at the opening camera, max delta 56 (one quarter-pixel step)
  (`harness/exact-strips-squares-detail.txt`, "BASE self" lines; the cause of that particular re-quantisation was
  not isolated).

### In-app (EXECUTED; `look/`, `scripts/lookshots.mjs` + `scripts/lookdiff.py`; status-bar rows 0-99 excluded)
Level 1 at 60 left, grid ON. F = the shipped build.
| state | same build twice | BASE vs F, Daylight | BASE vs F, Ink Night |
|---|---|---|---|
| zoomed opening | 0 px (BASE), 0 px (F) | 30,596 px, max delta 60; all within 2 px of arrow ink; 0 px elsewhere; 0 full flips | 30,592 px, max 57; 0 elsewhere; 0 flips |
| fit (pinch-out to the clamp) | 0 px, 0 px | 12,502 px, max 49; 0 elsewhere; 0 flips | 12,502 px, max 47; 0 elsewhere; 0 flips |
| mid-zoom (one released pinch-in) | 202,667 / 232,212 px: the landing zoom differs every run, so this state is not comparable | not comparable | 25,146 px, max 51; 162 px outside the ink; 0 flips (this pair landed alike) |
- A "full flip" is a pixel within 40 levels of the ink in one shot and more than 160 levels from it in the other.
  There are none: no edge moved by a whole pixel, and no shape was added or lost.
- The deltas stop at one coverage step (230 ink levels / 4 = 57.5).
- The 4x crops (`look/crop-*.png`: BASE | F | diff x4) show one-pixel lines along vertical stroke edges. BASE and F
  look alike at 4x.

### Exits, marks, hint, bump (EXECUTED)
- **Exit motion is unchanged** (`pacerec/framediff-6-exits.txt`, POLISH-T10 `framediff.py`: exits 34, 44, 17, 12,
  47, 0, frames paired from the first moved frame, 9 capture pairs per build pair):
  - BASE vs A: |travel difference| median 0.003, p95 0.099, max 0.113 cell.
  - BASE vs A+B: median 0.000, p95 0.101, max 0.113.
  - Same-build controls: p95 0.077-0.103, max 0.107-0.113.
  - On-screen frame counts are equal in 54/54 exit pairs.
  - **Part B moves the whole sequence one vsync earlier** (latency above); the frames themselves are the same.
- **POLISH-T6 blink re-check** (`blink/table.md`; T6 `capture.mjs` + `aggregate.py`, unchanged; the shipped build,
  3 sessions at scales 1/1/1 and 3 at 0/0/0, read back after relaunch): **0 ABSENT at mount, 0 at unmount, 0 ghost
  frames over 36 taps**. Every session went 60 -> 59 left. Arrow 14 ends `mark` and 38 ends `ink`, as in T6-T10.
- **Screenshots** (`shots/sheet-exit-bump-mark-hint.png`): an exit in flight, the blocked bump and flash, the missed
  mark, and the hint pulse all render.
  - The hint required Google's test rewarded ad. It ran, was closed with KEYCODE_BACK, and was never tapped
    (`shots/t12-log.txt`).

## TDD and gates (EXECUTED; `gates/`)
- **No new TS logic, no unit test.** The change is Kotlin in an Expo module with no JVM test harness. The checks
  that exercise the failing path are on-device:
  - **RED on BASE:** Perfetto shows two whole-board uploads per exit (27/27) and `rebuildCompoundPaths` rebuilding
    everything. The harness reproduces the 8.8 ms exit frame.
  - **GREEN on the fix:** one `rebuildStrip` and one strip's uploads per exit (27/27), and the first-exit-frame gate
    above.
- `npx tsc --noEmit`: exit 0. `npx jest`: **71 suites, 1098 tests passed** (unchanged from POLISH-T10 fix 1).
  `git diff --check`: clean.
- Kotlin compiled (`:arrows-board:compileReleaseKotlin`) in all 7 release builds. The dex of every T12 build
  contains `ArrowsBoard.rebuildStrip`, and the BASE-gridoff dex does not.

## Builds (`builds/`, `scripts/build.sh` = POLISH-T10's with output paths and a `gridoff` variant)
- **Recipe:** incremental gradle arm64 release, test ads, Metro cache cleared (0 dirs left),
  `:app:createBundleReleaseJsAndAssets --rerun`. `df -h /` right before each: 8.8, 8.5, 8.0, 8.0, 8.0, 8.0, 6.9 GiB.
- **Builds:**
  - `t12-A`, `t12-AB`: 160 pt, superseded, deleted.
  - `t12-A3`: Part A, 267 pt, `4e69d663...`.
  - **`t12-AB3`, shipped:** `artifacts/POLISH-T12/arrows-testads-T12.apk`, sha256 `c21e73b8...ea8a`.
  - `t12-BASE-gridoff`: HEAD's `ArrowsBoardView.kt` swapped into the tree, then restored. `git diff HEAD | shasum`
    was identical before and after: `82fcfa0d...`, `builds/build-gridoff-stdout-tree-checks.txt`.
  - `t12-AB3-gridoff`. Both grid-off builds were deleted after the gate.
  - `t12-AB3-final`: rebuilt after the last edit, which only corrected a KDoc sentence (it had stated a Skia
    caching rule that the harness later contradicted; it now states only what was measured). The APK is
    **byte-identical** to the shipped one (sha256 `c21e73b8...`), so the tree (`git diff HEAD | shasum` =
    `80e610f1...`) is exactly what was measured. Deleted as a duplicate.
- **Bundle proof before every install:** Google TestIds present and **0** owner units (`ca-app-pub-9813131856455133`,
  6706292920, 7549521178, 3505414519, 5508761320), in ASCII and UTF-16LE (`builds/bundle-proof-*.txt`).
  - Every T12 APK has the signer of BASE (`24f7fa0b...50f8`), versionCode 6.
- No gradle process had to be stopped. The only JVM left running was a Kotlin compile daemon (idle auto-shutdown),
  which holds no gradle locks.

## Decisions
1. **Full-width strips instead of square tiles.** Square tiles at the screen's edges re-rasterised during pans
   (measured). Strips match BASE's behaviour along the axis that overflows at the opening camera.
2. **267 pt (3 strips on level 1)**, measured against 160 pt: 160 pt passed the exits but put fit pans at the edge of
   the null. The code comment carries the numbers.
3. **Part B ships.** It passed the same gate; the merged frame costs 8.1-8.6 ms.
4. **Level load was measured on Home -> Play (fresh board) and Retry, not Next.** Next asks for an interstitial first
   (see Method).
5. **"Missed vsync" was also measured under screenrecord.** In the plain gfxinfo gate BASE misses in fewer than 1% of
   exits, so a drop could not show there; the POLISH-T10 defect was characterised under capture load.
6. **The 5-strip round is kept, not deleted** (`superseded-5strips/`): its fit-pan result drove decision 2.

## Concerns
1. **The look criterion is not met as written** (0 px at rest). Arrow edges move by at most one quarter-pixel
   coverage step, and only on edges. Evidence says this is inherent to any tiling, and BASE itself re-quantises
   unchanged arrows on some exits. Owner decision below.
2. **Pinch frames cost about +0.35 ms RenderThread median (4%)**, in both grid states. This is within the null spread
   and p95 is not worse, but the direction is consistent: every zoom-changing frame re-rasterises 6 strip masks
   instead of 2 board masks.
3. **Exit frames read about +0.07 ms RenderThread median** (within the null; total frame median unchanged).
4. **Big boards were not gated.** The gate covers level 1 (20 x 20).
   - INFERRED from the design and the harness (not measured in-app): the per-frame cost grows with the number of
     visible strips (2 draws each). Boards up to 46 rows make 7 strips (14 draws), and on the emulator a draw costs
     about 5 us.
   - Exits should save more when the board is large on screen: level 1 zoomed to 1.31x in the harness dropped its
     exit frame from 15.2 to 6.8 ms. Big boards at the opening camera are in that situation (INFERRED).
   - A PERF-level A/B (e.g. level index 2, 37 x 37) would close this.
5. **Part B shortens the visible exit time by one frame.** POLISH-T10's motion criterion "visible 120-280 ms" now
   fails in 3/81 A+B exits (min 114.5 ms; BASE 0/81). The on-screen motion is identical; the whole exit is one
   frame earlier after the tap.
6. **UNVERIFIED:** physical devices (per-draw costs and Skia's behaviour on a real GPU were not measured), iOS and web
   (untouched), and pacing in Ink Night.
7. **Device state:** the persisted finished-games counter advanced by 19 losses (the Retry traces and probes). The
   next Next press on this install will be offered a test interstitial.

## Owner acceptances
- `artifacts/POLISH-T12/owner-exit-start-before-after-x4.mp4`: BASE on the left, shipped on the right, the same 12
  taps aligned on the UP event, 4x slow. Does the arrow now leave in the same beat as the counter, with no resting
  hold? **yes/no**
- `artifacts/POLISH-T12/look/crop-daylight-1-open.png` (and `-inknight-`, `-2-fit`): the arrow edges differ from
  BASE by at most a quarter-pixel anti-aliasing step (BASE itself does this to unchanged arrows on some exits). Accept this as
  "unchanged"? **yes/no** (Recommendation: yes. The alternative is no tiling, which keeps the 7 ms whole-board
  re-raster on every exit.)
- Accept the pinch-frame +0.35 ms RenderThread median (within the null spread, p95 not worse) for the exit gain?
  **yes/no**

## Device state left (EXECUTED; `device-restore.txt`)
- emulator-5556 is running, scales 1/1/1 (read back), Daylight.
- Installed: `artifacts/POLISH-T12/arrows-testads-T12.apk`, sha256 `c21e73b8361aa282b77b288a6e87cb82dd21114dd1da40d4c998ab522578ea8a`
  (read back from the device). The app is stopped at Home.
- Removed: `/data/local/tmp/t12-*`, `/data/local/tmp/t10-input.jar`, `t10-ui.xml`, and the `t12` Perfetto traces.

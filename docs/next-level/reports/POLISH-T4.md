# POLISH-T4: dot grid and the "#" grid-lines toggle (META_BOARD_GRID; rulings R2, R4/R4a, R5, R7)

Status: **DONE_WITH_CONCERNS**.

With `META_BOARD_GRID` on (Android and web):
- Faint dots sit at every cell centre across the whole visible screen, including the empty space beyond the board. They are drawn under the arrows and stay aligned under pan and zoom.
- A 44 dp "#" switch at the bottom right toggles row and column lines through the cell centres. Its state lasts for the session only.

With the flag off:
- No grid prop reaches the native view (payload test).
- The rendered game screen is pixel-identical to HEAD in both themes (0 px).

**Main concern:** the grid costs frame time while panning, measured on the emulator. With the dots drawn as 8×8-cell blocks, the median pan frame is about 2.3 ms slower. That cost is all RenderThread draw. More pans also fall into the emulator's slow mode. See "Frame cost" below.

Environment:
- Branch `next-level` at `15b452a`, with uncommitted working-tree changes.
- emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120 @560, density 3.5). Scales were 1/1/1, read back.
- Everything below is **emulator only** unless it is labelled web.
- Builds: 5 gradle release builds (arm64), plus one JS repack used only for the HEAD baseline.

## What changed

| File | Change |
|---|---|
| `src/ui/boardGrid.ts` (new) | The pure grid module. Contents are listed below the table. |
| `src/ui/boardGridFlag.ts` (new) | `BOARD_GRID_ENABLED = META_BOARD_GRID && Platform.OS !== 'ios'` (R7). iOS gets neither the props nor the button. |
| `src/ui/gridLinesSession.ts` (new) | Session-only "#" state (R5): a module variable with subscribe/read/set. It imports nothing and has no save key. |
| `modules/arrows-board/android/.../ArrowsBoardView.kt` | New `setGrid` / `setGridStyle`. Details are listed below the table. |
| `modules/arrows-board/android/.../ArrowsBoardModule.kt` | Registers the `grid` and `gridStyle` props. |
| `modules/arrows-board/src/ArrowsBoard.types.ts` | Adds the optional `grid?` and `gridStyle?` props. |
| `src/ui/StaticBoardSurface.native.tsx` | Spreads `nativeGridProps(grid, BOARD_GRID_ENABLED)` onto `ArrowsBoardView`. With the flag off it spreads `{}`. |
| `src/ui/StaticBoardSurface.tsx` (web) | `WebBoardGrid`: an SVG `<Pattern>` tile (lines, then the dot) over the extent, inside the camera `AnimatedG` and before the clipped arrows. The dot `r` and line `strokeWidth` follow the zoom every frame through `useAnimatedProps`. |
| `src/ui/StaticBoardSurface.types.ts` | Adds `grid: BoardGrid \| null`. |
| `src/ui/BoardView.tsx` | Details are listed below the table. No other gesture change. |
| `src/ui/GameScreen.tsx` | The "#" `HeaderButton` (44 dp) at `insets.right + 16`, `insets.bottom + 16`. It shows only when `BOARD_GRID_ENABLED`, and not on tutorial boards. It is a `switch` labelled "Grid lines", with a hint, and toggles instantly. It passes `gridLines` to BoardView. |
| `src/ui/HeaderButton.tsx` | Optional pass-through props: `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` and `checked`. `checked` sets `accessibilityState.checked` and `aria-checked`, because react-native-web reads only the ARIA prop. With them omitted, the output is unchanged. |
| `src/ui/contrastAudit.ts` | Adds the "Deliberately not rows here" bullet for the decorative grid (R4), with the 1.55/1.31 and 1.52/1.27 ratios and the note that "#" is covered by the existing HeaderButton rows. Updates the shifted `site`/`sizeSite` lines, remapped with a difflib script against HEAD and asserting each old and new line is identical: HeaderButton 38→48 and 54→68, GameScreen +9…+33, BoardView 862-864→917-919. |
| tests | `boardGrid.test.ts` (new, 52), `gridLinesSession.test.ts` (new, 2), `GameScreen.gridToggle.test.tsx` (new, 2, ui project) |

What `boardGrid.ts` contains:
- The constants, each marked `// OWNER-PICKED STARTING VALUE` with the design spec A as source:
  - dots at `border` 0.40 and lines at `border` 0.25 (R4a);
  - dot radius `clamp(0.07·cellDp, 0.9, 1.75)` dp;
  - lines 1 dp;
  - restroke step 2^¼;
  - overscroll 0.5·viewport.
- `gridExtent()`: the board-space cell range any camera can show. It covers scale ∈ [minScale, maxScale], translation in `panRange` ± rubber-band overscroll, and the raw layout, which includes the strip under the nav bar. It is analytic: both ends are monotone in scale within each `panRange` regime.
- `gridStroke()` (a worklet), `gridRestrokeNeeded()` (a worklet), `gridColors()` (`composite(border, α, bg)`), `boardGridFor()`.
- The serializers `grid = cell,minCol,minRow,maxCol,maxRow,#dot,#line` and `gridStyle = dotRadius,lineWidth,lines`.
- `nativeGridProps()`, which returns `{}` when the flag is off.

`ArrowsBoardView.kt` changes:
- `setGrid` and `setGridStyle` parse their prop and fail closed on malformed input. The limits are 1024 cells per axis and 100k points. Each setter returns early when the value is unchanged.
- Dots are stored as blocks of 8×8 cells, one `drawPoints` per block with a ROUND cap. Lanes use one `drawLines`.
- The draw order is lines, then dots, then the existing arrows and exits.
- `onDraw` no longer returns early on a cleared board while a grid is set. Without grid props, the early-return condition and the draw calls are unchanged.
- `clearPaths` resets the grid.

`BoardView.tsx` changes:
- New `gridLines` prop.
- A `useMemo` builds `boardGridFor(...)` from the raw layout, the camera inset and the palette.
- The zoom the strokes were last sent for is `gridScale` state. It is updated:
  - by a `useAnimatedReaction` on `scale`, only when `gridRestrokeNeeded` is true (the 2^¼ step, about 1.19×);
  - at pinch end, as an exact value;
  - in `fitToViewport`, on level load.

  The reaction and the pinch `onEnd` are registered only when `BOARD_GRID_ENABLED` is true (a build-time constant).

Not changed:
- PRODUCT.md and DESIGN.md still say "no grid lines". Per the ruling amendment they are amended when the flag defaults ON, not now.
- The Swift view, `scripts/`, `featureFlags.ts` (the flag already existed) and `boardOverflow.ts`. The wrapper overflow is already `'visible'` with this flag, from T1.
- No save keys, and no new `withTiming`/`withSpring`.

## TDD
- **RED 1 (EXECUTED, `artifacts/POLISH-T4/tdd-red1-compile.txt`):** `TS2307: Cannot find module '../boardGrid'`.
- **RED 2 (EXECUTED, `tdd-red2-stub.txt`).** Against a naive stub with an extent equal to the board, zoom-proportional dots, one restroke only, and `heartLost` colours: **50 failed and 2 passed**. The failures were for the right reasons. For example, the brute-force coverage failed with `Expected: >= 7, Received: 4`, the extent missing cells the camera can show. The two tests that passed are the bound check and the shaft-half-width guard, which a naive stub also satisfies.
- **GREEN (EXECUTED, `tdd-green.txt`):** 52/52. Coverage:
  - Extent against a brute-force sweep of 404 random plus boundary scales × the four pan extremes ± overscroll. The sweep covers 3 measured layouts (with and without the zoomed camera and inset) × 6 boards: 5×5, 8×8, 20×20, 39×39, 46×46 and 4×46.
  - Bounds: 46×46 comes to 112×194 cells = 21.7k dots (`extent-sizes.txt`; the research estimated 113×192).
  - On-screen dot radius and line width at 8.4, 9.9, 12.9, 19.3, 29.4 and 64 dp.
  - The dot never exceeds the shaft half-width past its floor.
  - The restroke step, and about 12 sends for a fit→max pinch on 46×46.
  - The colours match the design spec hexes exactly.
  - **Flag-OFF payload:** `boardGridFor` returns null, `nativeGridProps` returns `{}`, and spreading it leaves today's prop object's JSON byte-identical.
  - Flag-ON strings, and the state before layout.
- **Session store and toggle.** `gridLinesSession.test.ts` and `GameScreen.gridToggle.test.tsx` were written together with the code, not RED-first. To check that the toggle test can fail, I ran a mutant (EXECUTED, `tdd-red-toggle-mutant.txt`): with `gridLines={false}` and no `checked` prop, 1 of the 2 tests failed. After restoring the code, both passed.

## Evidence (all under `artifacts/POLISH-T4/`; summary image `00-summary.png`)

Builds (EXECUTED):
- Every build used `EXPO_PUBLIC_ADMOB_TEST_ADS=1` and `EXPO_PUBLIC_PERF_LEVEL=3827`, which boots into level 3828 (39×39), with `:app:createBundleReleaseJsAndAssets --rerun`, `./gradlew --stop` and the Metro cache cleared between builds.
- `df` showed 6.3–6.5 GiB free before each build (`df-before-build-*.txt`).

| # | Flags | Bundle sha256 (prefix) | Proof |
|---|---|---|---|
| 1 | GRID (v1 single `drawPoints`) | `2465e6ea` | `bundle-proof-1-G.txt` |
| 2 | none | `f53bb507` | `bundle-proof-2-O.txt` |
| 3 | GRID (v2 8×8 blocks, final native) | `2465e6ea` (same JS as 1; the APK differs) | `bundle-proof-3-G2.txt` |
| 4 | none (final native) | `f53bb507` | `bundle-proof-4-O2.txt` |
| 5 | GRID + ZOOMED_CAMERA + EXIT_TO_SCREEN_EDGE | `9c4259b2` | `bundle-proof-5-C.txt` |

- Every bundle has 0 owner ad-unit IDs, in both ASCII and UTF-16, and contains Google's TestIds.
- The JS hashes are reproducible per flag set, and they differ whenever the flags differ. That shows the flag flips reached the bundle.

1. **EXECUTED: dots cover the whole screen at fit on a dense level, in both themes**
   (`shots/G-grid/{daylight,inknight}-1-fit-lines-off.png`, `measure-grid.txt`, `scripts/measure.py`).
   - Dots were detected above, below and to the left of the board: 779 above, 306 below and 115 left of it.
   - Every dot's centre pixel is exactly `#D2CCE8` (Daylight) or `#353150` (Ink Night), a maximum deviation of 0 per channel.
   - Pitch is 35 px, which is 10.0 dp. The expected fit cell is 9.92 dp = 34.7 px, within 1 px.
   - Diameter is 7 px, which is 2.0 dp. The expected radius is 0.9 dp (1.8 dp diameter). The difference is ≤ 1 px of anti-aliasing.
2. **EXECUTED: sizes at zoom.**
   - Zoomed to a 22.4 dp cell: the dot diameter is 11 px (3.14 dp). The formula gives 2 × 0.07 × 22.4 = 3.14 dp.
   - Max zoom (64.0 dp pitch measured, `inknight-8-…`): the diameter is 11 px (3.14 dp), against 3.5 dp = 12.25 px expected. That is within about 1 px, and it does not grow with zoom (the design spec's "not 13+ px").
   - The lines are 2–3 px of full line colour (1 dp = 3.5 px), in every capture.
3. **EXECUTED: lines go through the dot centres and reach the edges.**
   - At fit with lines on: 41 vertical and 19 horizontal lines in the band above the board. Every dot centre is ≤ 0.5 px from a line on both axes. At max zoom it is 0.0 px.
   - The lines run to the screen edges (`*-2-fit-lines-on.png`).
   - The line colour is `#E3DFF1` or `#29253D`, ±4.
4. **EXECUTED: the grid is under the arrows** (`under-arrows-check.txt`, `scripts/under.py`, and the 4× crops `shots/crop4x-{daylight,inknight}-{zoomed,fit}-lines-on.png`).
   - At zoomed and at fit, in both themes, 229 and 279 shaft runs lie along lanes. Across them, 28.9k and 14.1k mid-shaft pixels were checked: **0 are outside ink ±4**.
   - **Positive control** (`positive-control-under.txt`): the same detector on a frame with the lane lines painted *over* everything flags 12,426 pixels. So the check can fail. The first version of the detector could not fail, and I replaced it.
5. **EXECUTED: the toggle is instant** (`shots/G-grid/toggle-lines-on-off.mp4`, `toggle-frames.txt`).
   - Screenrecord frames of the background band go off → on → off. In non-background pixels that is 22.6k → 99.6k → 24.5k, with no intermediate frame.
   - UIAutomator reports `android.widget.Switch checkable=true checked=false/true` after each tap (`*-capture-log.txt`). That is what TalkBack reads, INFERRED from the a11y node. I did not run TalkBack itself.
6. **EXECUTED: "#" placement.** The bounds are `[1230,2742][1384,2896]`: 154 px = 44 dp square.
   - The right gap is 56 px = 16 dp.
   - The bottom edge at 2896 is 56 px = 16 dp above the 3-button nav bar, which starts at 2952 = 3120 − 48 dp inset.
   - UNVERIFIED on gesture navigation and 360 dp devices.
7. **EXECUTED: session-only state.** Lines ON, then ‹ to the menu, the moon button, and Play: the new game screen still reports `checked="true"`. Every fresh launch reported `checked=false`.
   - The process-kill reset is INFERRED: the state is a JS module variable, unit-tested.
   - I did not run a strict "ON, then force-stop, then OFF" sequence on a single build.
8. **EXECUTED: taps still map** (`tap-check.txt`, `shots/G-grid/tap-before/after.png`). I tapped a free left-pointing edge arrow at fit with the grid on: `250 left` became `249 left`, and a grid dot now shows where it was.
   - Combined build: `250 left` became `249 left` too, with the exit trail running over the grid lines to the screen edge (`shots/C-combined/daylight-4-exit-over-grid*.{mp4,png}`).
9. **EXECUTED: combined look** (`shots/C-combined/`, both themes). With ZOOMED_CAMERA, the level opens zoomed with the grid behind it; the dense centre covers almost every cell. At fit the grid fills the screen, and lines on and off both work.
10. **EXECUTED: flag OFF is identical to HEAD, 0 px** (`flag-off-vs-head-pixel-diff.txt`, `shots/flag-off-vs-head/`).
    - Compared: build 4 (this tree, flag off) against a baseline made of HEAD `15b452a` JS (`git archive`) repacked over the HEAD ADMOB-C native APK. That APK was built at 00:56 before the 01:00 commit, and its dex has no `setGrid` (checked with `strings`). The baseline was debug-signed.
    - Result: **0 differing pixels** in rows 120–2951, in Daylight and in Ink Night, at fit on level 3828. The status bar differs by 496 px (the clock).
    - The first baseline attempt was wrong twice, and both were caught: the bundle had no `META-INF/services`, which crashed it, and then the fonts were missing because the symlinked `node_modules` changed the asset names. The final baseline has only the font `httpServerLocation` string rewritten to the repo form.
    - The block-chunked native (build 3) renders the fit frame 0 px different from the v1 native (build 1) (`v1-vs-blocks-render-diff.txt`). Zoomed frames differ between any two runs of the same build, because the pinch is not deterministic (control rows in the same file).
11. **EXECUTED, web** (`npx expo start --web --port 8097`, flag on, in the Browser pane). Level 1 shows dots across the whole viewport and outside the board.
    - With "#", lines appear under the arrows.
    - Wheel zoom keeps a 1 dp line: the pattern `line` stroke is 0.885 board units at scale 1.13, and the `circle` r is 1.549 (1.75 dp).
    - The DOM switch has `role="switch"` and `aria-checked="true"`.
    - Console: only the pre-existing passive-wheel `preventDefault` error.
    - No PNG was saved for web: the pane's screenshots are not written to disk. The server was stopped.
12. **EXECUTED: gates** (`gate-tsc.txt`, `gate-jest.txt`, `gate-jest-ui.txt`).
    - `npx tsc --noEmit` exited 0.
    - `npx jest`: **57 suites and 951 tests passed**.
    - `npx jest --selectProjects ui`: 5 suites and 14 tests passed.
    - `contrast.test.ts` (142) and `reduceMotionPolicy.test.ts` pass.

## Frame cost of a pan, grid ON against OFF (EXECUTED, emulator only, gfxinfo framestats)

Method (`scripts/panmeasure.mjs`, the same as T1/T3):
- Cold start of the PERF build (level 3828, 39×39, fit), then a pinch to about 1.4×.
- Then 6 alternating 700 px horizontal pans over 1000 ms, 60 moves each (60/60 accepted every time).
- A `gfxinfo reset` before each pan, a 2 s settle, and a framestats dump after it. Frames are Flags=0 and de-duplicated; duration is FrameCompleted − IntendedVsync.
- The same session, alternating installs with `install -r`. Lines were off in every run.

**Final native (8×8 blocks), A/B/A/B/A/B** (`pan/`, `pan-abab-summary.txt`):

| Run | Grid | Frames / expected | p50 | p95 | p99 | >16.67 ms | slow pans (p95 > 16.67) | per-pan p50 range |
|---|---|---:|---:|---:|---:|---:|---:|---|
| A1 | ON | 540 / 540 | 9.70 | 12.76 | 13.87 | 0 | 0/6 | 9.37–10.27 |
| B1 | OFF | 539 / 539 | 7.19 | 10.13 | 12.40 | 0 | 0/6 | 6.77–8.21 |
| A2 | ON | 545 / 545 | 10.24 | 22.33 | 24.19 | 162 | 3/6 | 8.96–21.74 |
| B2 | OFF | 536 / 537 | 7.96 | 21.66 | 23.90 | 31 | 1/6 | 7.18–10.06 |
| A3 | ON | 538 / 544 | 9.77 | 21.41 | 23.39 | 118 | 2/6 | 9.28–20.64 |
| B3 | OFF | 539 / 539 | 7.50 | 10.89 | 13.17 | 0 | 0/6 | 6.71–8.39 |
| **Pooled ON** | | 1623 | **9.86** | 21.74 | 23.40 | 280 | **5/18** | |
| **Pooled OFF** | | 1614 | **7.54** | 11.50 | 22.43 | 31 | **1/18** | |

**Reconciliation.** Each pan is about 92 contiguous frames at 16.7 ms vsync spacing, 60 Hz × span, with no gaps.
- The grid-ON runs A2 and A3 also hold one isolated frame 1.0–1.5 s after each pan. It is counted in "expected" as +1 per pan, and its cause is not identified.
- A3 lost 6 frames against expected (538 / 544). No other run lost more than 1.

**Attribution** (`pan-phases.txt`). The median UI-thread time (vsync → sync) is 4.64 ms ON against 4.78 ms OFF, so it did not change. The median RenderThread time (sync → completed) is **4.91 ms ON against 2.59 ms OFF**. The whole difference is draw+swap, the GPU drawing of the dots.

**First native (a single `drawPoints` of all 15.7k dots), A/B/A/B/A/B/A/B** (`pan-v1-single-drawPoints/`, `pan-v1-abab-summary.txt`, `pan-v1-phases.txt`):
- Pooled p50 was 11.46 ON against 8.04 ms OFF, and slow pans were 12/24 against 2/24.
- RenderThread was 5.97 ms against 2.62 ms.
- Per-run p50 ranges do not overlap: ON 10.56–12.78, OFF 7.17–8.54.

Because this replicated, I split the dots into 8×8-cell blocks, so the replayed display list can skip off-screen blocks by their bounds. That cut about 1 ms of the cost: the RenderThread delta went from +3.35 to +2.32 ms.

**Reading.**
- The cost is real on this emulator and it replicates: p50 +2.3 ms, and the per-run p50 ranges do not overlap (ON 9.70–10.24 ms against OFF 7.19–7.96 ms).
- It sits inside the frame budget when a pan is in the fast mode.
- The emulator's bimodal "slow pan" mode (T1/T3) shows up more often with the grid: 5/18 against 1/18.
- On the absolute soak gate of p95 ≤ 20 ms, the grid-ON pooled p95 is 21.74 ms. The grid-OFF runs B2 (21.66) also fail it when a slow pan lands, so the gate cannot be decided from this host.
- **Pinch frames were not reconcilable.** 15–18 frames were recorded for a 600 ms pinch, against about 25–36 expected. So I quote no number for the cost of each restroke step: it is UNVERIFIED, and so is the design spec's pinch-sweep soak.
- The 20-level `perf:android` soak was not run.

## Decisions
- **Extent.** It uses the raw layout (the board draws under the nav bar) for the visible rectangle and the camera viewport for `panRange`, plus an overscroll of 0.5·viewport (OWNER-PICKED, from research §3). A fling harder than that can briefly show bare background.
- **Two props.** `grid` carries the extent and colours and is rebuilt per level, theme and layout. `gridStyle` carries the stroke sizes and the lines on/off. So a zoom step or a "#" tap re-records the view without rebuilding the point arrays. Kotlin ignores an unchanged value.
- **Lines use a 1 dp stroke, not a `strokeWidth 0` hairline.** The design spec says 1.0 dp; a hairline would be 0.29 dp on this panel.
- **Web follows the formula every frame.** It uses `useAnimatedProps` on the pattern's circle and lines, as the design spec says, and draws no native props.
- **The "#" button is hidden on tutorial boards.** The dots still draw there. I judged that a new control during the scripted T1/T2 FTUE is a distraction. It is still shown in benchmark (PERF) builds, but the flag is off in the harness's builds.
- **iOS** gets neither the props nor the button (`BOARD_GRID_ENABLED`). This follows the design spec's rule that a switch that does nothing is worse than no switch.
- **8×8 dot blocks** (`GRID_BLOCK_CELLS`, OWNER-PICKED). Measured better than a single op (see above). Smaller blocks were not tried.
- **The HEAD baseline for the 0 px proof is a JS repack,** because a gradle build of a `git archive` tree would need its own `node_modules` (disk). Its one string edit (the font asset path) is disclosed in item 10.

## Concerns
1. **Pan frame cost with the grid on** (emulator, above): +2.3 ms of RenderThread per frame, and more slow pans. Real-device cost is UNVERIFIED-DEVICE. Options if it matters on hardware:
   - smaller blocks, or trimming the overscroll;
   - a bitmap-tile shader, which is research option D.

   A 20-level soak should run on hardware before the flag goes on by default.
2. **The per-step restroke cost during a pinch is unmeasured**, because the frame counts did not reconcile. The isolated late frame after each pan in grid-ON runs A2/A3 is unexplained. It was absent in A1.
3. **The HEAD baseline repack was debug-signed,** which needed an `uninstall`. The test APK's app data on emulator-5556 was lost. The APK itself was reinstalled; see Housekeeping.
4. **Web PNGs were not saved** (item 11). TalkBack speech was inferred from the accessibility node, not heard. 360 dp devices and gesture navigation are UNVERIFIED.
5. PRODUCT.md and DESIGN.md still say "no grid lines". Amend them in the commit that turns `META_BOARD_GRID` on by default.

## Owner acceptances needed
- `artifacts/POLISH-T4/00-summary.png`: are the dot and line strengths right (`border` @0.40 and @0.25), in both themes? yes/no
- `shots/G-grid/*-1-fit-lines-off.png`: are the fit-zoom dots (2 dp) visible but calm enough? yes/no
- `shots/C-combined/daylight-4-exit-over-grid.mp4` and `inknight-1-open-zoomed-lines-on.png`: does the combined look (zoomed camera + exit to the edge + grid) read right? yes/no
- The frame cost: accept +2.3 ms on the emulator pending a device soak, or ask for the tile-shader fallback? accept/fallback

## Housekeeping (EXECUTED)
- The pre-task APK is reinstalled. `base.apk` sha256 is `3b0598d8…d939` (`device-restore.txt`). Scales are 1/1/1, as found. `/data/local/tmp/t4-ui.xml` was removed; the harness jar was left in place.
- No `.env` exists. The flags were passed inline.
- `android/app/build` was kept, since 6.5 GiB is free, above the 6 GB line. Its last output is build 5 (combined flags); the next builder must use `--rerun` as usual.
- The scratch APKs and the HEAD tree were deleted.
- No git state was changed.
- The scripts are in `artifacts/POLISH-T4/scripts/`: `panmeasure.mjs`, `abab.mjs`, `phases.mjs`, `capture.mjs`, `measure.py`, `under.py`, `prove-bundle.sh` and `drive.mjs`.

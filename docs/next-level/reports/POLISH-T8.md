# POLISH-T8: Reanimated synchronous UI props (Part A) and a tiled board grid (Part B)

Status: **DONE_WITH_CONCERNS**. Both parts are in the working tree, uncommitted. No git state was changed.

- **Part A:** `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` is on. The flag is proven in the compiled `libreanimated.so`.
  - The pan UI-thread and RenderThread effects are **UNEVALUABLE**: both are smaller than the same-APK null spread.
  - Behaviour is unchanged in every check: no snap-back, 0 pan-offset frames before and after, the hint stays on its arrow, the static frames differ by 0 px, and the pill and heart animate.
- **Part B:** the grid is one `drawRect` filled by a repeating one-cell `BitmapShader` tile. The points path is reachable only in PERF builds (`EXPO_PUBLIC_PERF_GRID_POINTS=1`).
  - **At full fit** (the worst case): RenderThread median is 3.41 ms with the tile, 5.25 ms with points and 3.31 ms with grid OFF. The tile costs +0.10 ms over OFF and saves 1.84 ms against points.
  - **At about 1.4x:** RT total is buffer-wait bound (**UNEVALUABLE**). RT draw-issue time is tile 3.98, OFF 4.01 and points 4.17 ms.
  - **Look:** 0 seams, and max channel delta ≤ 18/255 against points in every same-zoom state.
- **#8:** exits are pixel-identical, 0 of 1,842 frames differing on the device's Skia. The per-frame `DashPathEffect` allocation is gone. With the tile, re-recording an exit frame costs 0.059 ms median, so no child overlay was needed.
- **#9:** there is one compound-path rebuild per commit. It is traced on the commit where a marked arrow exits (before: 2 rebuilds).
- **Blink re-check:** 0 ABSENT over 36 taps.
- Every device number is from **emulator-5556 only** (AVD `fleet_floor_api31`, API 31, 1440x3120, density 3.5). The host was shared.

## What changed

| File | Change |
|---|---|
| `package.json` | Adds `"reanimated": { "staticFeatureFlags": { "ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS": true } }`. The iOS twin stays off. |
| `modules/arrows-board/android/.../ArrowsBoardView.kt` | Tile grid (#3), exit body cut with `PathMeasure` plus Skia's dash arithmetic (#8), and dirty-flag compound-path rebuild (#9). Details below. |
| `modules/arrows-board/android/.../ArrowsBoardModule.kt` | `OnViewDidUpdateProps { view.commitProps() }`. |
| `src/ui/boardGrid.ts` | `BoardGrid.strokeScale`. `serializeGridStyle(grid, renderer)`: `tile` (the default) sends 4 tokens `r,w,lines,strokeScale`, and `points` sends the POLISH-T4 3-token form. `nativeGridProps(grid, enabled, renderer)`. |
| `src/perfMode.ts` | `PERF_GRID_POINTS = PERF_MODE && EXPO_PUBLIC_PERF_GRID_POINTS === '1'`. |
| `src/ui/StaticBoardSurface.native.tsx` | Passes `PERF_GRID_POINTS ? 'points' : 'tile'`. |
| `src/ui/__tests__/boardGrid.test.ts` | The "flag ON" test now expects the 4th token. Its old `endsWith(',1')` became `split(',')[2] === '1'`, which is the same check under the new format. There are 2 new tests. |

**Kotlin details:**
- **#3:**
  - `setGrid` now stores only the extent and colours.
  - `setGridStyle` accepts 3 tokens (points path) or 4 tokens (tile path).
  - `rebuildGridLocked()`, traced as `ArrowsBoard.rebuildGridTile`, runs only from those two setters.
    - It rasterises a `round(cell × strokeScale × density)` px tile using today's opaque colours: the lane lines when `#` is on, then the dot.
    - It builds `BitmapShader(REPEAT, REPEAT)` with local matrix `scale(cell/tilePx)` translated by `(minCol·cell, minRow·cell)`, drawn with `FILTER_BITMAP_FLAG`.
  - `onDraw` draws one rect over the extent. The point arrays are built lazily, and only on the points path.
- **#8:**
  - Each exit slot keeps a `PathMeasure` (built once in `setExitAnimation`) and a reused `Path`.
  - `dashSpan()` reproduces `SkDashPath::CalcDashParameters` + `InternalFilter` float for float, so the segment is bit-identical to the old `DashPathEffect([body, total + body], -travelled)`. Cutting at plain `travelled` was not: see TDD.
- **#9:**
  - `setGeometry`, `setVisibleMask` and `setMarkMask` set `pathsDirty`.
  - `commitProps()` rebuilds once per commit, traced as `ArrowsBoard.rebuildCompoundPaths`.
  - `onDraw` also rebuilds if it is still dirty (fallback).

**Not changed:** colours, sizes, flags, camera, exit timing, web, iOS and save data. There is no migration or wipe risk. Swift is untouched: `gridStyle` is a string prop and iOS never receives it (R7).

## TDD

**JS (EXECUTED; `artifacts/POLISH-T8/tdd/`):**
- **RED** (`red-boardGrid.txt`): new tests, run against signatures that were stubbed but not implemented. 3 failed (`Expected "0.48", Received undefined`; `Expected true`), 51 passed.
- **GREEN** (`green-boardGrid.txt`): 54/54.

**#8 exit exactness (EXECUTED on emulator-5556 via `app_process`; `scripts/ExitDashCheck.java`):**
- **Method:**
  - 4 realistic trails (straight, L, U, zig-zag), 3 zooms (0.2477, 0.7347, 1.6) × density 3.5, alpha 255 and 131.
  - Travelled follows the k² curve at 61 steps plus every corner distance ±0.01.
  - Each frame is drawn the old way and the new way on the device's Skia, and the pixels are compared.
- **RED:** the first draft cut at plain `travelled` (`partB/exit-dash-check-naive.txt`). 10 of 1,842 frames differ, by up to 9 px (max channel delta 29).
- **GREEN:** the shipped `dashSpan` (`partB/exit-dash-check.txt`): **0 of 1,842 frames differ.**

**#9 (EXECUTED, Perfetto with app sections; `partB/trace/*-marked-summary.txt`):**
- The script replays the level-1 `marked-exit-plan.json` twice: 21 free, 14 blocked (charged, so marked), 4 free, then 14 exits while marked.
- **HEAD rebuild count:**
  - HEAD (`A-on-testads`) has no separate rebuild section. Each setter rebuilt inside its own `ArrowsBoard.setVisibleMask` / `setMarkMask` section.
  - So `setVisibleMask > setMarkMask` in one commit means 2 rebuilds. This happened 2 of 2 times.
- **After** (`B-testads`): `setVisibleMask > setMarkMask > rebuildCompoundPaths` in 2 of 2 marked exits. All 10 commits have exactly one rebuild.
- **Finding:** since POLISH-T6 a blocked tap no longer changes `visibleMask` (trace `*-level1-summary.txt`). The double rebuild therefore only happened on a marked arrow's exit, not on the charging tap the audit cited.

## Part A: `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`

### Flag proof (EXECUTED; `partA/flag-proof.txt`)
- Gradle re-ran `:react-native-reanimated:configureCMakeRelWithDebInfo[arm64-v8a]` / `buildCMake…`.
- `strings libreanimated.so` gives:
  - `[ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS:true]` in every T8 APK;
  - `:false` in the T7 APKs;
  - `IOS_…:false` everywhere.
- `npm ci --dry-run` exits 0 (`partA/npm-ci-dry-run.txt`). `package-lock.json` is unchanged in `git diff`.
  - Note: npm 11's dry run still ran the `postinstall` (`patch-package`, "skia ✔"). It rewrote `node_modules/.package-lock.json`. That file is untracked.

### Pan A/B/A (EXECUTED; `partA/pan/`, `partA/null/`)
- **Method:** `artifacts/POLISH-T4/scripts/panmeasure.mjs`, unchanged. The PERF level is 3828 and the grid is **OFF**. The same pinch then 6 pans per run, scales 1/1/1.
- **Arms:**
  - A (flag off) is `t7/B-t7-perf-gridoff.apk`, T7's build of the same sources.
  - B (flag on) is `A-on-perf-gridoff.apk`.
  - Their JS bundles are byte-identical (`6e75d9c4…`). Only `libreanimated.so` differs (see Decisions).
- **Schedule:** A1 B1 … A5 B5, with `install -r` between runs.
- **Analysis:** `scripts/phases-ab.mjs`, which is POLISH-T7's script plus the RT issue and swap sub-phases.

| arm | frames (runs: frames / expected @60 Hz, isolated) | UI median (per-run) | RT median (per-run) | RT issue median (per-run) |
|---|---|---|---|---|
| A off | 3316 (666/666, 649/666, 667/667 ×3; 0 isolated) | 3.18 (2.99–3.23) | 16.44 (16.18–16.50) | 3.90 (3.83–3.96) |
| B on | 3361 (671–673 = expected; 6 isolated per run) | 2.89 (2.63–3.09) | 15.31 (11.68–16.48) | 4.00 (3.86–4.12) |
| null, same B APK ×6 (M/N) | 2001 / 2000 | 3.12 (2.91–3.42) vs 2.97 (2.55–3.20) | 16.44 vs 16.09 (N1 11.59) | 3.89 vs 3.95 |

**Sample reconciliation:**
- Frames = expected (span/16.67 + 1 per pan, summed) in every run, except A2 (−17), M2 (−18) and N2 (−19). No isolated frames were dropped.
- Every flag-on run has exactly **1 isolated frame per pan**, about 1.4 s after motion ends. Its RenderThread time is about 29 ms (for example `B2 pan1` at +3200 ms).
  - INFERRED mechanism: Reanimated's settle commit (`FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS`).
  - The flag-off runs have none.

**Reading:**
- **UI thread:** −0.29 ms pooled. The per-run ranges overlap. The same-APK null spans 0.87 ms per run (2.55–3.42), so the minimum detectable effect is about 0.9 ms. **UNEVALUABLE.**
- **RenderThread:** **UNEVALUABLE.**
  - The emulator is bimodal: "slow" runs sit at about 16.4 ms (swap-bound) and "fast" runs at about 11.6 ms.
  - Fast runs occurred in B2, B3 and N1: 3 of 11 flag-on runs against 0 of 5 flag-off here (and 0 of 6 in T7). That is not significant (Fisher p ≈ 0.5), but it is noted.
- **Static frame, flag off vs on:** the fit frames A_n against B_n differ by **0 px** (n = 1..3; rows 120–2950; `partA/static-pixel-diff.txt`).
  - The post-pinch frames differ even A vs A (112k px), because the pinch landing is not deterministic. They are not used.

### Behaviour recordings (EXECUTED; flag ON = `A-on-testads.apk`, grid ON; before = the installed T7 APK)

**Pan-offset (the POLISH-T6 parked finding).** `scripts/behave.mjs blockpan` + `scripts/offset.py`.
- **Scenario:** level 1, tap arrow 14 (blocked), then a 320 ms pan starting 60–300 ms after the tap.
- **Detector:** tracks the native board shift (dark-pixel mask, frame to frame) and the Skia blocker flash shift (pink mask, row 17). An **OFFSET** frame has |skia − native| ≥ 2 half-res px.
- **Positive control:** the detector reads the controller's POLISH-T6 frame 85 (`t6rev/f`) as a +3 px offset. It shows the native layer holding while the Skia layer moves.

| build | captures | moving frames with the flash visible | OFFSET frames | max \|offset\| |
|---|---|---|---|---|
| before (T7, flag off) | 6 (+1 no-pan control: 0) | 72 | **0** | 1 px |
| after (flag on) | 6 (+1 no-pan control: 0) | 71 | **0** | 1 px |

- The 179efd0-era single frame did not reproduce at 1df2fc8 in 6 tries. After the change it is also 0.
- Sheets: `partA/{pre,on}/*-offset-sheet.png`.

**Fling, then a tap mid-fling (`partA/on/on-flingtap*`):**
- The tap landed 63 ms after the pan and removed an arrow (60 → 59 left).
- The board stops at dx −175 and stays there: 0 steps after the stop, and no snap-back (`on-flingtap-track.txt`).

**Hint then pan (`partA/{pre,on}/hint/`, `scripts/hintpan.mjs` + `hintdrift.py`):**
- The script tracks the absolute native shift and the hint's mask shift.
- **Result:** the hint lags the board by **one frame at the start of every pan**, 16 half-res px (about 9 dp). Otherwise |drift| ≤ 2 in every frame.
  - Flag on: 5 of 5 pan starts.
  - Flag off (T7): 3 of 3 pan starts.
- **The flag did not introduce this** (see Concerns). The hint stays on its arrow for the rest of each pan.

**Pinch in/out** (`on-pinch.mp4`, `on-pinch-frames.png`): zooms in and out cleanly.

**Home and heart:**
- The Home Play pill breathes: the pill region swings 0 → about 2,000 px from frame 0 and back, periodically (`on-home-pill.txt`).
- The heart pop plays: 52 changing frames in the hearts region (`on-heart-hearts.txt`).

## Part B: the tile grid

### Pan, three arms (EXECUTED; `partB/pan-fit14/`, `partB/pan-fullfit/`, `partB/null-fullfit/`)
- **Arms:**
  - T = `B-tile-perf-grid` (v1; exits are not exercised by pans, see Decisions);
  - P = `B-points-perf-grid`;
  - O = `B-off-perf-gridoff`.
- All three: flag on, PERF level 3828, T P O × 5 interleaved per zoom.
- **Zooms:**
  - "1.4x" is T4's `panmeasure.mjs` pinch;
  - "full fit" is `scripts/panmeasure-fullfit.mjs`: the same pans after 4 pinch-outs to the minScale clamp (at fit these are rubber-band pans).
- **Null run:** the same tile APK ×6 at full fit.

| zoom | arm | frames (vs expected) | UI median (range) | RT median (range) | RT issue median (range) |
|---|---|---|---|---|---|
| 1.4x | O off | 3324 (O1 −18, O2 −18) | 2.89 (2.79–3.07) | 15.31 (11.65–16.15) | 4.01 (3.93–4.08) |
| 1.4x | P points | 3358 (= expected) | 2.94 (2.24–3.13) | 16.06 (11.55–16.46) | 4.17 (4.05–4.26) |
| 1.4x | T tile | 3359 (= expected) | 3.01 (2.86–3.19) | 16.33 (16.06–16.50) | 3.98 (3.89–4.10) |
| full fit | O off | 3584 (O1 −18, O4 −36) | 2.08 (1.95–2.35) | **3.31 (3.27–3.34)** | 1.11 (1.09–1.15) |
| full fit | P points | 3595 (P4 −18) | 1.94 (1.68–2.08) | **5.25 (5.19–5.31)** | 3.00 (2.98–3.06) |
| full fit | T tile | 3600 (T1 −1) | 2.38 (2.24–2.51) | **3.41 (3.37–3.46)** | 1.12 (1.06–1.14) |
| full fit | null T ×6 (M/N) | 2154 / 2155 | 2.13 vs 2.00 (1.91–2.18) | 3.42 vs 3.41 (3.38–3.42) | 1.12 vs 1.11 |

**Full fit** (the emulator stayed in fast mode for all 21 runs):
- **Tile against OFF:** +0.10 ms RT median. That is above the null (0.04 ms per-run span) and well **within the 0.5 ms gate**.
- **Points against OFF:** +1.94 ms. The issue sub-phase is 1.12 against 3.00 ms, so the saving is in the RT draw-command issue.
- **UI thread:**
  - T is 0.30 over O, but the same tile APK in the null run measured 2.00–2.13.
  - So the session-to-session UI drift (about 0.3 ms) is as large as the difference. It is not attributed to the tile.

**At 1.4x:**
- **RT total is UNEVALUABLE.** O had 2 fast-mode runs, P had 1 and T had none, and slow-mode runs are swap-bound at about 16.4 ms.
- **RT issue:** T −0.03 and P +0.16 ms against O. Both are within the Part A null issue spread (3.81–4.10, 0.29 ms).
- T4's +2.3 ms at this zoom did not reproduce on today's emulator state.

### Looks (EXECUTED; `artifacts/POLISH-T8/grid-compare.png`, numbers in `partB/grid-compare.txt`)
- **Shots:** `scripts/gridshots.mjs`, identical gestures on the points and tile PERF builds, Daylight and Ink Night, dots and `#`.
- **States:** zoomed opening, z14 (the 1.4x pinch), full fit, and two mid-step zooms.
- **Mid-step zooms:** taken during a slow pinch-in from fit. The dot pitch measures **1.102x** and **1.176x** of fit in every shot. The restroke is at 1.189, so the tile is being resampled.
- **Compare:** `scripts/gridcompare.py`.

| state (both themes) | pitch points / tile | diff px (> 24 / max delta) | seams | dot peak / half-contrast area, points vs tile |
|---|---|---|---|---|
| open, dots and # | identical | 0 / max 1 (dots), 0 / max 6 (#) | 0 (dots) / 3 px (#), where the lattice fit is unreliable: almost no free cells are visible, and the max delta is 6 | no free cells visible |
| fit, dots and # | 34.70 / 34.70 | 0 / max 17 | **0** | 51/51 (N 52/52), 31/32 px |
| mid 1.102x, dots and # | 38.26 / 38.26 | 0 / max 18 | **0** | 51/51, 38/39 px |
| mid 1.176x, dots and # | 40.80 / 40.80 | 0 / max 18 | **0** | 51/51, 43/43–44 px |
| z14 | 118.50 / 118.22 (D), 117.72 / 118.50 (N) | not comparable | not comparable | the pinch landed at a different zoom per build |

- **Seams:** 0 at every fit and mid-step state, both themes. A seam here is a non-background tile pixel that is background in the points shot and more than r + 3 px from every lattice dot (and from every lane line with `#`).
- **Softness at mid-step:** the tile's dots keep the points' peak contrast. The half-contrast area is at most +1 px.
- **UNVERIFIED-OWNER:** the owner judges softness from the sheet. Each sheet row shows points | tile | |diff| ×4 at 2×.

### #8 decision and trace (EXECUTED; `partB/trace/{points,tile}-exits-summary.txt`)
- **Setup:** PERF level 3828 at fit, 8 exits (250 → 242 left), atrace `view` plus app sections.
- **Exit windows:** from each exit's `setVisibleMask` to +400 ms, giving 118 frames per build. That is 14.75 per exit, which matches 180–320 ms exits at 60 Hz.
- **Main-thread `Record View#draw()`:** points 0.143 ms median (p95 0.217) against tile **0.059 ms** (p95 0.124).
- **RenderThread `DrawFrames`:** 5.42 against 3.47 ms median.
- **Decision:** with the tile, re-recording the parent is about 60 µs per exit frame, so there is **no child overlay view** (no z-order or invalidation risk).
- **Trace gotcha:** atrace `gfx` had to be dropped. On this emulator the GL encoder floods it.

### Blink re-check (EXECUTED; `artifacts/POLISH-T8/blink/table.md`)
- **Harness:** POLISH-T6 `capture.mjs` + `analyze.py`/`aggregate.py`, 38/14 plan, unchanged. The final `arrows-testads-T8.apk` ran 3 sessions at scales 1/1/1 and 3 at 0/0/0 (read back after relaunch).
- **ABSENT at mount:** 0 frames / 0 taps. **ABSENT at unmount:** 0 / 0. **Ghost frames:** 0. That covers 36 taps (18 per motion setting).
- **Each session:** starts at 60 left and ends at 59. Arrow 14 ends `mark` and arrow 38 ends `ink` in every session (R6a unchanged).
- **Indicative exit video compare:** T7 against T8, arrow 21's exit (`partB/exit-video-compare.txt`). 13 of 16 time-paired frames show 0 px > 40.
  - The other 3 (62–127 px) are pairs 1.6–2.9 ms apart on H.264 frames while the trail moves about 20 px per frame.
  - The exactness evidence is the `ExitDashCheck` result above, not this video.

## Gates (EXECUTED; `artifacts/POLISH-T8/gates/`)
- `npx jest`: **62 suites, 997 tests passed.** That is POLISH-T7's 995 plus 2 new.
- `npx jest --selectProjects ui`: 8 suites, 32 tests passed.
- `npx tsc --noEmit`: exit 0.
- Kotlin compiles in the release builds: 8 gradle `assembleRelease` builds succeeded (`builds/`).

## Builds (EXECUTED; `artifacts/POLISH-T8/builds/`, `scripts/build.sh`)
- **Build method:**
  - Incremental gradle arm64 release, one at a time.
  - `df -h /` gave 5.9 → 5.3 GiB free across the builds, all above the 5 GB gate. Nothing was deleted.
  - Each build cleared the Metro cache and ran `createBundleReleaseJsAndAssets --rerun`, with versionCode pinned to 6 and restored to 8.
- **Ad-unit proof:** every bundle holds the TestIds and 0 owner units, ASCII and UTF-16LE, checked before install (`bundle-proof-*.txt`).
- **Bundle hashes** (JS bundle SHA-256 prefix):

| APK | bundle SHA-256 prefix |
|---|---|
| `A-on-perf-gridoff` | 6e75d9c4 |
| `A-on-testads` | bd22588e (= T7 test-ads) |
| `B-tile-perf-grid` v1 / v2 | d8043736 |
| `B-points-perf-grid` | 918fe9f2 |
| `B-off-perf-gridoff` | d9aecc99 |
| `B-testads` | 4f50d1cd |

- `B-testads` is `artifacts/POLISH-T8/arrows-testads-T8.apk`, SHA-256 `241193c4…68ee`.

## Decisions
1. **The flag-off pan arm reused T7's `B-t7-perf-gridoff.apk`.** It was built from the 1df2fc8 sources, and its JS bundle is byte-identical to my flag-on build. This saved a second Reanimated native rebuild on a tight disk.
2. **`strokeScale` travels as a 4th `gridStyle` token, not as a new prop.** No module API change. The 3-token form *is* the points path, so the PERF A/B arm is exactly POLISH-T4's payload.
3. **#8 option (b), "prove negligible", instead of a child overlay.**
4. **`dashSpan()` goes beyond the brief's "`getSegment(travelled, …)`",** because only Skia's own arithmetic gives pixel-identical frames.
5. **Part B pans used tile v1** (the naive exit cut). Pans draw no exits, and v2 changed only `drawExitSlot`. The traces and the final APK use v2.
6. **#9 rebuild point:** `OnViewDidUpdateProps` plus an `onDraw` fallback, which is safe if the hook ever does not fire.
7. **`MAX_GRID_TILE_PX = 1024`** is an `OWNER-PICKED STARTING VALUE` guard against a malformed scale. The real maximum is about 240 px.

## Concerns
1. **Hint lag, pre-existing and unchanged:**
   - At the start of every pan the Skia hint trails the native board by one frame, about 9 dp. This is 3/3 flag off and 5/5 flag on.
   - The blocker flash and bump do *not* lag (0 frames), probably because their mapper is already animating every frame.
   - This is a first-frame-of-motion issue for an idle Skia overlay. POLISH-T7 unmounted the idle transform group, so the first camera frame may mount before it presents: INFERRED, not traced. It is not fixed here (out of scope). Worth its own task.
2. **Flag on adds one settle frame per gesture,** about 1.4 s after the camera stops (RT about 29 ms). Static pixels are unchanged (0 px), so it is not visible. It is a small, periodic RT cost.
3. **Pan savings are unmeasurable on this emulator.** The Part A UI and RT effects are UNEVALUABLE, and so is Part B's RT at 1.4x (bimodal slow/fast emulator modes). Full fit is the clean measurement. Device numbers are UNVERIFIED-DEVICE.
4. **Mid-step softness is the owner's call** (`grid-compare.png`, mid rows). Numerically the tile dot is +0–1 px wider at half contrast, with the same peak.
5. **Test ads consumed:** three Google test rewarded ads were watched for the hint captures and closed with BACK.
   - In one of them, my harness's three pans were injected onto the test ad's end card: its "Ad 2 of 2" never left, and the loop had no guard.
   - No click-through happened: `AdActivity` stayed resumed, and BACK returned to the level.
   - `hintpan.mjs` now refuses to pan unless the level is in front. **No ad was tapped.**
6. The z14 look states are not pixel-comparable, because pinch landing differs per build. Open and fit are exact-sent zooms, and the mid states are resampled; all are compared.
7. **Swift was not compiled here** (no Swift change). iOS is UNVERIFIED.

## Owner acceptances
- `artifacts/POLISH-T8/grid-compare.png`: at the mid-step rows (1.102x, 1.176x), in both themes, do the tile dots look as crisp as the points? yes/no
- `artifacts/POLISH-T8/partA/on/hint/on-hint-panstart-frames.png`: the one-frame hint lag at pan start, which exists before and after this task. Open a separate task? yes/no

## Device state left
- emulator-5556 is running with scales 1/1/1 (`device-restore.txt`).
- Installed: `artifacts/POLISH-T8/arrows-testads-T8.apk` (on-device SHA-256 `241193c4…68ee`, versionCode 6, test ads).
- Level 1 is fresh at 60 left, and the app has been sent to Home.

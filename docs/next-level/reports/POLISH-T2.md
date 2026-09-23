# POLISH-T2: zoomed default camera (META_ZOOMED_CAMERA, rulings R1 + R1a)

Status: **DONE_WITH_CONCERNS**. With the flag ON, a level opens at about 14 cells across the
viewport width. It is centred and clamped by the existing `panRange`. Boards whose fit cell is
already at least 23.5 dp open at fit. `minScale` (fit) and `maxScale` are unchanged, and there is
no intro animation. With the flag OFF, level 1 is pixel-identical to today's host APK in the app
area. The concerns are the hint recentre, which I could not exercise on the emulator, and the perf
harness, which is valid only with the flag OFF.

Environment:
- Branch `next-level` at `4fd86f8`, with uncommitted working-tree changes.
- Device: emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120 @560). Window, transition and
  animator scales were 1 (read back, EXECUTED).
- All device evidence is **emulator only**.
- Build method: the **JS repack recipe**, not gradle (details below).

## What changed

| File | Change |
|---|---|
| `src/featureFlags.ts` | Adds `META_ZOOMED_CAMERA = process.env.EXPO_PUBLIC_META_ZOOMED_CAMERA === '1'`, OFF by default |
| `src/ui/boardCamera.ts` (new) | Pure camera maths, described below |
| `src/ui/BoardView.tsx` | Imports the constants and `panRange` from `boardCamera.ts` (their definitions are removed here). `fitToViewport` applies `initialCamera(vw, vh, boardW, boardH, CELL, META_ZOOMED_CAMERA)`. The hint recentre calls `centreOn(...)`, which is the same arithmetic moved out of the file. No gesture code changed. |
| `src/ui/contrastAudit.ts` | The BoardView `site` lines 854/855/856 become 832/833/834 (BoardView lost 22 lines above them) |
| `src/ui/__tests__/boardCamera.test.ts` (new) | 39 tests |

What `boardCamera.ts` contains:
- The constants `FIT_MARGIN`, `MAX_ZOOM_FACTOR`, `MAX_ZOOM_CELL_PT` and `EDGE_PAD_PT`, moved verbatim with their comments.
- `panRange`, moved verbatim, still a worklet.
- `TARGET_CELLS_ACROSS = 14` and `ZOOM_SKIP_FIT_CELL_PT = 23.5`, both marked `// OWNER-PICKED STARTING VALUE` with their provenance (R1's competitor measurement, and design spec D refinement 1 / R1a).
- `initialCamera()` and `centreOn()`.

Formula when the flag is ON: `fit = min(vw/boardW, vh/boardH)·0.94`. If `fit·CELL ≥ 23.5`, the camera opens at fit. Otherwise
`scale = min(maxScale, max(fit, vw/14/CELL))`, centred on the board centre and clamped by `panRange`.
When the flag is OFF, `initialCamera` runs today's exact expressions (the tests check this with `toBe`, not closeTo).

Not changed:
- `scripts/`, `modules/` and `GameScreen.tsx` (`git diff --stat -- scripts modules` is empty, EXECUTED).
- No `withTiming`/`withSpring` was added, so the reduced-motion policy is not affected.

## TDD

- **RED 1 (EXECUTED).** `npx jest src/ui/__tests__/boardCamera.test.ts` failed with
  `TS2307: Cannot find module '../boardCamera'`.
- **RED 2 (EXECUTED; `artifacts/POLISH-T2/tdd-red-stub.txt`).** Against a stub that kept today's fit
  camera and ignored the flag: 14 failed and 25 passed.
  - The failures were for the right reason. For example, level 1 at 411 dp showed `Expected: 29.387… Received: 19.337…` for cell dp, and `Expected 14 / Received 21.28` for cells across.
  - All 15 flag-OFF rows passed against the stub, as expected.
- **GREEN (EXECUTED; `tdd-green.txt`).** 39/39 passed.
  - The first GREEN run failed 2 tests, and both failures were errors in the test cases, not in the code.
  - (a) The R1a boundary case used a fit cell of exactly 23.5, which floating point computes as 23.4999…. I moved the case to 23.62 dp (fit) against 22.23 dp (zoomed).
  - (b) The hint case chose row 30 of 39, which `panRange` legitimately clamps. I moved it to row 20, col 8, which is off-screen to the left at the zoomed start.
- **Coverage.** Boards 5×5, 8×8, 20×20, 39×39 and 46×46 at the visible viewports 411.43×756.29, 360×633
  and 360×493 (docs/board-viewport-measured.md). Each case asserts:
  - the cell size;
  - `tx` and `ty` inside `panRange`;
  - centring;
  - that min and max are unchanged.

  Further cases:
  - R1a boundary;
  - a narrow tall 4×46 board, which is locked on x;
  - the `maxScale` clamp;
  - a zero-size layout;
  - `centreOn`: an off-screen arrow on 39×39 is centred, and a corner arrow is clamped but still inside the viewport.

## Build (JS repack, EXECUTED)

Recipe steps (from the memory note and `artifacts/W0-02/fix3/build-bundle.sh`):
1. `expo export:embed --platform android --dev false --reset-cache --minify false`
2. `hermesc -O`
3. Swap `assets/index.android.bundle` (Stored) into a copy of
   `artifacts/test-build-2026-09-21/arrows-test-f58692c.apk`.
4. `zipalign -p 4`, then `apksigner` with `~/.android/debug.keystore`.

The host APK's native code matches HEAD, because `git diff --stat f58692c HEAD` touches only JS and docs.
`--reset-cache` makes each env flip re-transform.

Variants, each confirmed by grepping the unminified bundle:
- **ON** (`META_ZOOMED_CAMERA = true`);
- **OFF** (`= false`);
- **ON + `EXPO_PUBLIC_FTUE=1`**;
- **ON + `EXPO_PUBLIC_PERF_LEVEL=3827`** (`rawPerfLevel = "3827"`).

Each install was preceded by `adb -s emulator-5556 uninstall com.danteb.arrows`. The scratch
directory (257 MB) was deleted afterwards, and free disk is back to 4.1 GiB. Gradle was not run.

## Evidence (all under `artifacts/POLISH-T2/`, summary image `00-summary.png`)

1. **EXECUTED: flag ON, level 1 opens at 14 cells across** (`01-on-level1-open.png`). The board runs
   past both side edges. The measured pitch is 103 px = 29.43 dp, or 13.98 cells across 1440 px (`cell-pitch-measured.txt`).
   - Method: autocorrelation of dark-pixel column sums. Its resolution is 1 px = 0.29 dp.
   - Expected 29.39 dp. The difference is within that resolution.
2. **EXECUTED: no intro animation** (`06-on-level1-open.mp4`, `06-open-recording-frame-analysis.txt`,
   `06-…first-board-frame-vs-settled.png`).
   - In a screenrecord of the Play tap, the first frame that shows the board already has the settled
     bbox (x 0–719, y 394–1317 at 720 px) and pitch (51 px at half resolution).
   - Against the settled frame, no pixel differs by more than 40 grey levels (mean 3.9, which is the screen fade), so the scale did not change.
   - Screenrecord emits frames only on change, so this proves there was no geometry change between the first
     board frame and the settled one. It is not a vsync-by-vsync trace.
3. **EXECUTED: a tap while zoomed maps correctly** (`02-on-level1-after-tap.png`). I tapped (565,874) on a
   free U-shaped arrow in the top row. The UIAutomator text went from `60 left` to `59 left`, hearts stayed at 3, and that arrow is gone.
4. **EXECUTED: pinch-out reaches fit** (`03-…pinched-out-to-fit.png`).
   - I used the perf-harness gesture driver jar (`ArrowsWorkload pinch`, 30/30 moves accepted).
   - The whole circle is visible at 68 px = 19.43 dp pitch, which equals today's fit (19.34 dp expected, within 1 px).
5. **EXECUTED: the board stays reachable at the edges.**
   - `04-…default-zoom-panned-to-right-edge.png`: I relaunched the level (it re-opens zoomed) and made two 1200 px left pans. The board's right edge stops about 72 dp inside the screen (the `panRange` pad).
   - `05-…maxzoom-panned-to-top-left-edge.png`: after a pinch to max zoom and pans toward the top-left, the board holds at the pad and does not leave the screen.
6. **EXECUTED: the 5×5 tutorial opens at fit** (`07-on-ftue-tutorial-5x5-open.png`, FTUE build). Arrows
   are 541 px apart, which is 2 cells, so the cell is 270.5 px = 77.3 dp. Fit is 77.35 dp.
7. **EXECUTED: dense level** (`08-on-perf-level3828-39x39-open.png`, `09-…pinched-out-to-fit.png`).
   - `EXPO_PUBLIC_PERF_LEVEL` does apply: it boots straight into level index 3827 ("LEVEL 3828", 39×39, 250 left).
   - It opens at 103 px = 29.43 dp (13.98 across).
   - A pinch-out shows the whole flower silhouette.
8. **EXECUTED: with the flag OFF, the result is identical to today** (`10-off-level1-open.png` against
   `11-baseline-hostapk-f58692c-level1-open.png`, `10-11-off-vs-baseline-pixel-diff.txt`).
   - Rows 120–2951 (the app area): **0 differing pixels** out of 1440×2832.
   - Status bar rows 0–119: 1009 differing pixels (the clock).
   - The host test APK was built with FTUE on, so I cleared its two tutorials before level 1 appeared.
9. **INFERRED (read) plus unit test: the hint recentre works under the zoomed camera.**
   - The recentre effect reads the live `scale.value` and clamps with `panRange` through `centreOn`. That is the same arithmetic as before, now tested.
   - The 39×39 test shows an off-screen arrow being centred exactly, and a corner arrow landing inside the viewport.
   - **UNVERIFIED-DEVICE:** I tapped the hint button on zoomed level 1. No rewarded ad filled, so no hint was shown (the host build's LevelPlay key does not fill on the emulator; memory note). PERF builds disable ads, and the FTUE stall hint fires only on tutorial boards, which open at fit.
   - The owner-facing check is design spec D acceptance 4 (hint on level 3827). It needs a build with the sample LevelPlay key.
10. **EXECUTED: the perf harness is untouched and still valid with the flag OFF.**
    - `git diff --stat -- scripts` is empty.
    - `node --test scripts/perf/android/soak-utils.test.mjs`: 7/7 pass (`harness-soak-utils-test.txt`).
    - Item 8 shows the default (OFF) camera renders pixel-identical to today, so `cellCenterForBoard`'s fit mapping still holds.
    - **Benchmarks must run with `META_ZOOMED_CAMERA` OFF.** With it ON, `cellCenter` and `gestureGeometry` (which assumes 3.5× zoom-in headroom) are wrong (research risk 2).
11. **Gates (EXECUTED).**
    - `npx tsc --noEmit` exited 0 (`gate-tsc.txt`).
    - `npx jest`: 48 suites and 763 tests passed (`gate-jest.txt`; 724 before, plus 39). The run covers both the core and ui projects.
    - `contrast.test.ts` passes with the new site lines.
    - GameScreen.tsx was not edited.

## Decisions
- The camera maths is in a new `boardCamera.ts`, not exported from `BoardView.tsx`, so the core (ts-jest,
  node) project can test it without React Native.
  - `panRange` and the four pan/zoom constants moved with it, so the fit, the gestures and the tests share one definition.
  - `panRange` stays a `'worklet'`. The pan, pinch and edge-pad clamping on the device (items 4 and 5) exercise it from the UI thread after the move.
- `CELL` is passed in as a parameter, which avoids a circular import with BoardView.
- The flag-OFF path does not run the (no-op) `panRange` clamp, so it is literally today's expressions.
- The hint's clamp arithmetic moved into `centreOn` unchanged, to make the off-screen hint case unit-testable.
- The R1 target uses the viewport width only, as the ruling says. The 23.5 dp R1a threshold is absolute dp, not relative to the target.
- Cold relaunch and every new level re-open zoomed and centred. `fitToViewport` already reset the camera on every board change and every `onLayout`, and that behaviour is unchanged.

## Concerns
1. The hint recentre on a zoomed board has not been seen on a device (item 9).
2. Only the flag OFF can be benchmarked. There is no frame measurement for the zoomed camera. By inference it
   adds no draw work: the content is the same and fewer arrows are on screen. It has not been measured.
3. The viewport height `onLayout` reports includes the nav-bar strip (804 vs 756 dp visible), so the zoomed board centres
   about 24 dp below the visible centre, and board content draws under the 3-button nav bar (visible in `05`).
   Both are pre-existing viewport facts, not new, but a zoomed board makes them more visible.
4. The layout was not checked at 360 dp `wm` overrides on the emulator. Those viewports are covered by unit tests only.
5. Physical devices and iOS: UNVERIFIED-DEVICE.

## Owner acceptances needed
- `artifacts/POLISH-T2/00-summary.png` (and `01`, `08`): is 14 cells across the right opening density? yes/no
- `03`/`09`: does a pinch-out to the whole board feel reachable enough? yes/no
- The hint on level 3827 with the flag ON (design spec D acceptance 4): needs a sample-key build; not yet shown.

## Fix round 1: the camera uses the visible area above the navigation bar (controller ruling)

Status: **DONE**. This round addresses round-0 concern 3.

With `META_ZOOMED_CAMERA` on, the camera now fits, centres and clamps against the board view's raw
layout minus the bottom safe-area inset. The board still draws edge to edge, under the nav bar. With the flag off,
the inset is a constant 0, so the camera is today's.

### Changes
- `src/ui/boardCamera.ts` gains `cameraViewport(layoutW, layoutH, bottomInset)`. It returns
  `{w, h: layoutH - inset}`, keeps the raw height if the result would be under 1 pt, and treats a negative inset as 0.
- `src/ui/BoardView.tsx` reads the inset through `useSafeAreaInsets().bottom`, the same hook GameScreen and HomeScreen use.
  - `cameraBottomInset = META_ZOOMED_CAMERA ? bottom : 0`.
  - `viewport` (the shared value used by `clampPos`, the pan and decay clamps, the pinch focal clamp,
    the hint `centreOn` and the web wheel focus) now holds the camera viewport.
  - A new `measuredLayout` ref keeps the raw layout for the board-change refit.
  - The `viewportSize` state passed to the surface stays raw, so drawing still covers the whole view.
  - The inset reaches `fitToViewport` through a ref, so the function's identity, and with it the level-reset
    layout effect, does not depend on the inset.
  - A separate effect, active only when the flag is ON, re-fits the camera when the inset changes after layout.
  - The existing `EXPO_PUBLIC_LOG_BOARD_VIEWPORT` diagnostic line now also prints `cameraBottomInset=`.
- `src/ui/contrastAudit.ts`: the BoardView sites move from 832/833/834 to 852/853/854.
- A consequence of the ruling:
  - With the flag ON, `minScale` (fit) is computed on the visible area, so a full pinch-out fits the board above the nav bar.
  - It is unchanged for width-bound boards, which covers every square board on these phones.
  - `maxScale` follows from that fit, as before.

### TDD
- **RED 1 (EXECUTED).** `TS2305: Module '"../boardCamera"' has no exported member 'cameraViewport'`.
- **RED 2 (EXECUTED; `fix1/tdd-red-stub.txt`).** Against a stub that ignored the inset, 18 failed and 41 passed.
  - For example, it expected `h: 756.285706` but received the raw 804.29.
  - The 15 board × layout rows failed because the centre was 24–28 dp low.
- **GREEN (EXECUTED; `fix1/tdd-green.txt`).** 59/59.
- The new cases use the measured raw layouts and insets from docs/board-viewport-measured.md:
  - 411.43×804.29 with a 48 dp inset;
  - 360×689 and 360×549 with a 56 dp inset.

  Each case asserts the visible viewport, board-centre-to-visible-centre for all five boards, the pinch-out fit
  inside the visible area, and that the bottom edge at the upper pan limit is at or above the inset. Two more cases
  cover no inset and a degenerate inset.

### Evidence (emulator-5556, JS repack as in round 0, `artifacts/POLISH-T2/fix1/`, summary `00-summary-fix1.png`)
1. **EXECUTED: runtime inset.** The flag-ON build with `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1` logged
   `[board-viewport] w=411.4285583496094 h=804.2857055664062 cameraBottomInset=48` on level 1 and on level 3828
   (`board-viewport-logcat-*.txt`). This is the live inset value, not the config value, and it matches the measured 48 dp.
2. **EXECUTED: level 1 at open** (`01-on-level1-open.png`, `01-shift-vs-round0.txt`).
   - The board sits exactly 84 px (24.0 dp) higher than the round-0 capture, with 0 mismatched pixels at that offset.
   - The ink bbox midpoint is at 1627.5 px, against the visible-area midpoint (305–2952 px) of 1628.5 px.
   - Level 1 at 29.4 dp is 588 dp tall, shorter than the 756 dp visible area, so it is centred and locked vertically. An upward pan (`02-…`) does not move it.
   - Its last row is at y ≤ 2552 px, which is 400 px above the nav bar.
3. **EXECUTED: level 3828 (39×39) at open** (`03-on-level3828-open.png`, `03-shift-vs-round0.txt`). Also 84 px higher, with 0 mismatched pixels. It still draws under the nav bar, as the ruling allows.
4. **EXECUTED: level 3828 panned to the bottom edge** (`04-on-level3828-panned-to-bottom-edge.png`,
   `04-bottom-edge-measure.txt`).
   - Three 1800 px upward pans. A fourth pan changed 0 pixels, so the view is at the clamp.
   - The lowest ink is at y = 2366 px, and the nav bar starts at 2952 px.
   - Model: the arrows occupy rows 3..35 of 39 (`LevelGenerator.generate(3827)`, run with tsx). At the clamp the board bottom is at 2952 − 72 dp·3.5 = 2700 px, so row 35 ends at 2391 px. The measured 2366 fits inside that row, allowing for the end-of-stroke inset.
   - The last row is fully visible, about 167 dp above the nav bar.
5. **EXECUTED: a tap while zoomed** (`06-on-level1-after-tap.png`, `06-tap-count.txt`). I tapped (565,790), the same free U arrow as round 0, now 84 px higher. `60 left` became `59 left`, 3 hearts remained, and the arrow is gone.
6. **EXECUTED: flag OFF** (`05-off-level1-open.png`, `05-off-vs-baseline-pixel-diff.txt`). Against the round-0 host-APK
   (f58692c) level-1 capture on the same emulator geometry: **0 differing pixels** in rows 120–2951. The status bar differs by 2214 pixels (the clock).
7. **Gates (EXECUTED).** `npx tsc --noEmit` exited 0 (`fix1/gate-tsc.txt`). `npx jest`: 48 suites and 783 tests passed
   (`fix1/gate-jest.txt`; 763 + 20).
8. **Environment.** Emulator scales were read back as 1/1/1. The host APK was reinstalled at the end. The scratch directory was deleted, and free disk is 11 GiB. No gradle build was run and no git state was changed.

### Decisions and remaining risks
- The inset's re-fit effect also fires when a board change creates a new `fitToViewport` (flag ON only). That is a second fit to the same values in the same commit, so it is idempotent.
- BoardView now subscribes to the safe-area context even with the flag OFF. The hook call cannot be made conditional.
  - An inset change would re-render BoardView without changing any camera value or native prop.
  - Item 6 shows the OFF frame is pixel-identical.
  - There is no perf measurement of that subscription. INFERRED to be negligible, because insets do not change during play.
- 360 dp devices (56 dp inset) are covered by unit tests only, not by screenshots. Gesture-navigation devices (small
  inset) and iOS home-indicator insets are UNVERIFIED-DEVICE. The hint recentre on a zoomed board remains
  UNVERIFIED-DEVICE (round-0 concern 1). It now centres on the visible area, because `centreOn` reads the same `viewport`.

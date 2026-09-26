# Board legibility at fit-to-view (W3-08)

**Status:** evidence for W3-09. This doc does not pick a floor or change the clamp.

The owner sheet is `artifacts/W3-08/owner-legibility-boards.png` (gitignored). It asks the W3-09 question:

> **What is the smallest board you would accept a player seeing?**

It shows the seven boards below in order of on-screen cell size, largest first. Each board appears in both themes at
both phone geometries, followed by two 1:1 device-pixel crops of the 360×780 dp phone.

## Summary

- **cellPt at fit is set by the column count on every phone logged here.** Across campaign levels 1–10000, v1 and v2, no
  board is taller than 1.353 × its width (v1 level 18, Rocket 46×34). The board viewport is 1.525 to 1.955 times taller
  than it is wide. So every campaign board is width-bound, and `cellPt = 0.94 × viewport width / cols`.
  (EXECUTED: `artifacts/W3-08/table/level-distribution.txt`.)
- **The range for 20×20 to 46×46 boards is 7.36 to 19.34 pt** across the three logged viewports:

  | Viewport | 20×20 | 46×46 |
  |---|---:|---:|
  | 360-dp-wide phones | 16.92 pt | 7.36 pt |
  | 411-dp-wide native geometry | 19.34 pt | 8.41 pt |

  The `hitTest.ts` comment said "8-22 pt". It now carries these measured numbers.
- **The smallest captured cell is 7.36 pt**, which is 22 device px on the 360×780 dp phone. That is level 390 (index 389),
  Crescent 46×46 with 176 arrows: the first v1 46×46 board and the smallest cell in v1 levels 1–1000 (and 1–10000).
  Generator v2 bottoms out at 7.69 pt (level 1788, Fish 37×44). No v2 board reaches 46 in 1–10000; the largest is 43×44.
- **The brief's premise about Bolt is wrong.** Index 11, Bolt 46×37, is the tallest board, not the one with the
  smallest cells. Its 37 columns give 9.15 pt at 360 dp. By v1 level 6 (Star 44×44) cells are already 7.69 pt at 360 dp.
  107 of v1 levels 1–1000 are below 9 pt on a 360-dp-wide phone (table below).
- **The viewports logged at 6b8bf20 equal W1-01's logs at d8960aa to the last digit:** 411.4285583496094×804.2857055664062,
  360×689 and 360×549 dp. The game header has not changed, so ruling F31's re-measure trigger did not fire.

## Method

### Build

- **The tree.** A JS repack of `git archive 6b8bf20`, isolated from the working tree, because W3-11 is editing
  `src/core` in parallel.
- **The capture-only diagnostic.** The tree has one extra line: a `[board-camera]` log in
  `BoardView.fitToViewport`, gated on the existing `EXPO_PUBLIC_LOG_BOARD_VIEWPORT`
  (`artifacts/W3-08/scripts/board-camera-diag.patch`). It prints the camera that `initialCamera` returned at mount:
  `scale`, `minScale`, `cellPt = scale × CELL`, `tx`, `ty` and `zoomed`. This line is not in any tracked file.
- **The repack.** The recipe is `artifacts/W3-08/scripts/repack.sh`. The host is the installed debug-signed
  `artifacts/W2-09/apk/w209-on.apk`. The repack runs `export:embed` with `--reset-cache`, clears the Metro cache with
  `find`, runs `hermesc -O`, then zipaligns and debug-signs. No gradle.
- **The flag set is the same for every capture.** It is recorded in each `manifest.json` `buildEnv`:
  - `EXPO_PUBLIC_ADMOB_TEST_ADS=1`
  - `EXPO_PUBLIC_DEV_GEN_VERSION=1|2`
  - `EXPO_PUBLIC_FTUE_LOG=1`
  - `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1`
  - `EXPO_PUBLIC_CAPTURE_DIAG=1`

  Every other `EXPO_PUBLIC_*` is unset. The pre-Hermes bundle shows `META_ZOOMED_CAMERA = false` and
  `META_BOARD_GRID = false`. The camera therefore opens at fit, as the shipping build does, with no grid dots.
  (EXECUTED: `artifacts/W3-08/apk/w308-v{1,2}.apk.env.txt`.)
- **The ad-unit proof ran before install** (UTF-16 aware, `artifacts/W3-08/apk/*.proof.txt`). In both bundles:
  - `ca-app-pub-9813131856455133` and the owner's four unit suffixes: 0 ASCII, 0 UTF-16LE.
  - Google's `ca-app-pub-3940256099942544`: 1 ASCII.

| APK | sha256 | bundle sha256 | generator |
|---|---|---|---|
| `artifacts/W3-08/apk/w308-v1.apk` | `d55e4a86…7052` | `eb32662e…c727` | v1 |
| `artifacts/W3-08/apk/w308-v2.apk` | `06e8667d…5347` | `15e20089…4008` | v2 |

### Capture

- **Device.** `emulator-5556`, AVD `fleet_floor_api31`, API 31. Each capture ran P-02's `capture.mjs --shot`, with
  `--wm-size 1080x2340 --wm-density 480` for the 360×780 dp geometry (ruling F29). The tool itself is unchanged.
  - **Per capture it:** applied `wm` and read it back; set the three motion scales to 1, force-stopped, relaunched and
    read them back; read the app's reduced-motion label from logcat (`false`, source `logcat`); settled for 16 s;
    screencapped; reset `wm`.
  - **Across all 29 manifests (EXECUTED):**
    - status `ok`;
    - scales `1/1/1`;
    - `relaunchedAfterScaleChange: true`;
    - wm read-back equal to the request;
    - `wmAfterReset` equal to `Physical size: 1440x3120`.

    `artifacts/W3-08/gates/manifest-summary.txt` has the tally.
- **The board index came from the campaign pointer, not `EXPO_PUBLIC_DEV_LEVEL`.** `artifacts/W3-08/scripts/seed.sh`
  writes `arrows_current_level` and `arrows_dark_mode` into the test app's AsyncStorage while it is force-stopped. The
  pointer is the same state a player reaches.
  - **Why not `DEV_LEVEL`:** it is inlined at build time, so seven boards would need seven APKs, against the three-APK
    cap and ~4 GB of free disk. The generator switch is W3-06's `EXPO_PUBLIC_DEV_GEN_VERSION`, one APK per version.
  - **Proof that the seeded board is the one shown (EXECUTED):** every capture's `[ftue] board_mount` line names the
    index, `gen=`, `arrows=` and `shape=` listed below.
- **Opening the level.** `capture.mjs` has no "tap Play" step. A companion, `artifacts/W3-08/scripts/cap308.mjs`, waits
  for the new process's `[capture-diag] … screen=menu` line and taps Play once. The coordinates come from the
  uiautomator menu dumps in `artifacts/W3-08/calib/`. The companion then waits for `board_mount` and `[board-camera]`.
  Nothing else is ever tapped.
  - **Timing (EXECUTED, every `timing.json`):** the board mounted 5.4–6.8 s after start, and the PNG was written
    17.4–18.6 s after start. That leaves ≥ 10.6 s of settle on a static board.
- **Which camera line belongs to the screenshot.** The companion snapshots logcat 15.5 s after start, before the
  screencap. The camera it records is the last `[board-camera]` line in that snapshot; there was exactly one in every
  capture.
  - **Why:** `capture.mjs` resets `wm` after the screenshot. The reset makes the app re-lay itself out once more, and the
    log then shows a second, post-shot line such as `layout=480x949`.
  - **How the first run misled me:** it read that post-reset line as the capture's camera. A pixel comparison showed that
    the PNG was identical to a manual 360×689 capture and to W1-01's PNG: same heart and board-ink pixel bounds. The
    parser was then fixed; no capture had to be discarded for this.
- **Geometries.**
  - **Native:** `1440x3120 @560`, a 411.43×891.43 dp screen. The brief's "514×1114 dp" is the wrong-density figure that
    `docs/board-viewport-measured.md` already corrected.
  - **360×780 dp:** `1080x2340 @480`.
  - **360×640 dp, one extra capture:** `1080x1920 @480`. Its only purpose is to log the third viewport at HEAD for the
    table.

### Where cellPt comes from

- **The runtime value.** It is the `[board-camera]` line logged before the screenshot: `cellPt = camera.scale × 40`. In
  every capture `scale === minScale` (the full pinch-out, i.e. fit) and `zoomed=false`.
- **The same camera recomputed.** `0.94 × min(vw/cols, vh/rows)` with the logged `[board-viewport]` layout matches the
  logged cellPt to within 1e-6 in all 29 captures. (EXECUTED: `analyze308.py`.)
- **Pixel reconciliation: a cell measured on the screenshot.** The script is `artifacts/W3-08/scripts/analyze308.py`.
  - **How it measures.** On every second scanline through the board, runs of ink no wider than two stroke widths are
    straight strokes. The distances between their centres are whole multiples of the cell pitch. The pitch is the peak of
    `Σ cos(2π·d/p)`, searched from 0.6× to 1.6× the logged value. Scanlines give the x pitch; columns give the y pitch.
  - **One row, `v1-i0-360x780-day` (Circle 20×20):**
    - logged cellPt 16.920 pt × 3 px/dp = 50.76 px per cell;
    - measured stroke pitch 50.85 px in x (+0.17%) and 50.79 px in y (+0.05%).
  - **All 29 captures, 58 axis measurements:** |error| is at most 0.46% (0.17 px on a 36.6 px cell, below one pixel)
    with a median of 0.09%. (EXECUTED: `artifacts/W3-08/analysis-table.md`.)
  - **Control: the search window does not decide the answer.** On the same screenshot, windows seeded at 0.7×, 0.8×,
    1.25× and 1.5× the true value still peak at 50.85–50.88 px. (EXECUTED.)
  - **Second check: ink bounding box.** Every capture's ink box lies inside the logged board rectangle
    (`tx`, `ty`, `cellPt`).
    - **The insets are fixed fractions of a cell.** Each edge's inset is a whole number of cells plus about 0.00 or
      about 0.27 (for example, the Circle's four sides are 1.00–1.03 cells; the Diamond's right side is 1.26–1.27).
    - **They agree between the two geometries** to within 0.034 cells on every side of every board.
    - **Why that matters:** a wrong logged scale or offset would make the insets differ between the two densities.
- **Theme check.** The background pixel is exactly `#FFFFFF` (Daylight) or `#13111C` (Ink Night) in every capture.
- **Cross-checks against the table.** The table below reproduces all 29 logged cellPt values to 4.7e-5 pt, the
  4-decimal rounding of the CSV (`artifacts/W3-08/table/crosscheck-runtime.txt`). The difficulty probe
  (`--viewport 360x689`, same tree) prints the same values to one decimal for all seven captured levels
  (`artifacts/W3-08/table/probe-crosscheck.txt`).

## The screenshot set

Seven boards are shown, in order of cellPt, largest first. Paths are relative to this doc.

The images live under the gitignored `artifacts/W3-08/captures/<label>/`. Each capture directory has four files:

- the PNG;
- `manifest.json` from `capture.mjs`;
- `timing.json`, with the `board_mount`, `[board-viewport]` and `[board-camera]` lines;
- `logcat-ReactNativeJS.txt`.

Selection:

- **Required by the brief:** index 11, index 935, index 0, and the first 46×46 board. That board is index 389: probe rows
  mode over v1 levels 1–10000; `--shape-report` has no per-level size column, and its clamp column agrees.
- **Generator v2's extremes over levels 1–10000:** the largest board, index 245 (Triangle 43×43), and the smallest cell,
  index 1787 (Fish 37×44).
- **One mid-size board, index 4 (Diamond 29×29).** Without it the sheet would jump from 19 pt straight to 10 pt, leaving
  nothing between the extremes to choose from.

### 1. Index 0 (level 1): Circle 20×20, 60 arrows, generator v1

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i0-360x780-day/v1-i0-360x780-day.png" width="150" alt="v1-i0-360x780-day"><br>`v1-i0-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.423000 | **16.92 pt** | 50.76 | 50.85 / 50.79 |
| <img src="../artifacts/W3-08/captures/v1-i0-360x780-night/v1-i0-360x780-night.png" width="150" alt="v1-i0-360x780-night"><br>`v1-i0-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.423000 | **16.92 pt** | 50.76 | 50.85 / 50.79 |
| <img src="../artifacts/W3-08/captures/v1-i0-native-day/v1-i0-native-day.png" width="150" alt="v1-i0-native-day"><br>`v1-i0-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.483429 | **19.34 pt** | 67.68 | 67.80 / 67.73 |
| <img src="../artifacts/W3-08/captures/v1-i0-native-night/v1-i0-native-night.png" width="150" alt="v1-i0-native-night"><br>`v1-i0-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.483429 | **19.34 pt** | 67.68 | 67.80 / 67.73 |

### 2. Index 4 (level 5): Diamond 29×29, 106 arrows, generator v1

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i4-360x780-day/v1-i4-360x780-day.png" width="150" alt="v1-i4-360x780-day"><br>`v1-i4-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.291724 | **11.67 pt** | 35.01 | 35.04 / 35.04 |
| <img src="../artifacts/W3-08/captures/v1-i4-360x780-night/v1-i4-360x780-night.png" width="150" alt="v1-i4-360x780-night"><br>`v1-i4-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.291724 | **11.67 pt** | 35.01 | 35.04 / 35.04 |
| <img src="../artifacts/W3-08/captures/v1-i4-native-day/v1-i4-native-day.png" width="150" alt="v1-i4-native-day"><br>`v1-i4-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.333399 | **13.34 pt** | 46.68 | 46.72 / 46.73 |
| <img src="../artifacts/W3-08/captures/v1-i4-native-night/v1-i4-native-night.png" width="150" alt="v1-i4-native-night"><br>`v1-i4-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.333399 | **13.34 pt** | 46.68 | 46.72 / 46.73 |

### 3. Index 11 (level 12): Bolt 46×37, 54 arrows, generator v1

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i11-360x780-day/v1-i11-360x780-day.png" width="150" alt="v1-i11-360x780-day"><br>`v1-i11-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.228649 | **9.15 pt** | 27.44 | 27.55 / 27.44 |
| <img src="../artifacts/W3-08/captures/v1-i11-360x780-night/v1-i11-360x780-night.png" width="150" alt="v1-i11-360x780-night"><br>`v1-i11-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.228649 | **9.15 pt** | 27.44 | 27.56 / 27.44 |
| <img src="../artifacts/W3-08/captures/v1-i11-native-day/v1-i11-native-day.png" width="150" alt="v1-i11-native-day"><br>`v1-i11-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.261313 | **10.45 pt** | 36.58 | 36.75 / 36.58 |
| <img src="../artifacts/W3-08/captures/v1-i11-native-night/v1-i11-native-night.png" width="150" alt="v1-i11-native-night"><br>`v1-i11-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.261313 | **10.45 pt** | 36.58 | 36.75 / 36.58 |

### 4. Index 245 (level 246): Triangle 43×43, 172 arrows, generator v2

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v2-i245-360x780-day/v2-i245-360x780-day.png" width="150" alt="v2-i245-360x780-day"><br>`v2-i245-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.196744 | **7.87 pt** | 23.61 | 23.62 / 23.63 |
| <img src="../artifacts/W3-08/captures/v2-i245-360x780-night/v2-i245-360x780-night.png" width="150" alt="v2-i245-360x780-night"><br>`v2-i245-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.196744 | **7.87 pt** | 23.61 | 23.62 / 23.63 |
| <img src="../artifacts/W3-08/captures/v2-i245-native-day/v2-i245-native-day.png" width="150" alt="v2-i245-native-day"><br>`v2-i245-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.224850 | **8.99 pt** | 31.48 | 31.49 / 31.52 |
| <img src="../artifacts/W3-08/captures/v2-i245-native-night/v2-i245-native-night.png" width="150" alt="v2-i245-native-night"><br>`v2-i245-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.224850 | **8.99 pt** | 31.48 | 31.49 / 31.52 |

### 5. Index 1787 (level 1788): Fish 37×44, 241 arrows, generator v2

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v2-i1787-360x780-day/v2-i1787-360x780-day.png" width="150" alt="v2-i1787-360x780-day"><br>`v2-i1787-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.192273 | **7.69 pt** | 23.07 | 23.07 / 23.12 |
| <img src="../artifacts/W3-08/captures/v2-i1787-360x780-night/v2-i1787-360x780-night.png" width="150" alt="v2-i1787-360x780-night"><br>`v2-i1787-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.192273 | **7.69 pt** | 23.07 | 23.07 / 23.12 |
| <img src="../artifacts/W3-08/captures/v2-i1787-native-day/v2-i1787-native-day.png" width="150" alt="v2-i1787-native-day"><br>`v2-i1787-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.219740 | **8.79 pt** | 30.76 | 30.76 / 30.82 |
| <img src="../artifacts/W3-08/captures/v2-i1787-native-night/v2-i1787-native-night.png" width="150" alt="v2-i1787-native-night"><br>`v2-i1787-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.219740 | **8.79 pt** | 30.76 | 30.76 / 30.82 |

### 6. Index 935 (level 936): Crescent 45×45, 249 arrows, generator v1

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i935-360x780-day/v1-i935-360x780-day.png" width="150" alt="v1-i935-360x780-day"><br>`v1-i935-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.188000 | **7.52 pt** | 22.56 | 22.58 / 22.59 |
| <img src="../artifacts/W3-08/captures/v1-i935-360x780-night/v1-i935-360x780-night.png" width="150" alt="v1-i935-360x780-night"><br>`v1-i935-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.188000 | **7.52 pt** | 22.56 | 22.58 / 22.59 |
| <img src="../artifacts/W3-08/captures/v1-i935-native-day/v1-i935-native-day.png" width="150" alt="v1-i935-native-day"><br>`v1-i935-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.214857 | **8.59 pt** | 30.08 | 30.11 / 30.10 |
| <img src="../artifacts/W3-08/captures/v1-i935-native-night/v1-i935-native-night.png" width="150" alt="v1-i935-native-night"><br>`v1-i935-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.214857 | **8.59 pt** | 30.08 | 30.11 / 30.10 |

### 7. Index 389 (level 390): Crescent 46×46, 176 arrows, generator v1

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i389-360x780-day/v1-i389-360x780-day.png" width="150" alt="v1-i389-360x780-day"><br>`v1-i389-360x780-day.png` | Daylight | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.183913 | **7.36 pt** | 22.07 | 22.08 / 22.09 |
| <img src="../artifacts/W3-08/captures/v1-i389-360x780-night/v1-i389-360x780-night.png" width="150" alt="v1-i389-360x780-night"><br>`v1-i389-360x780-night.png` | Ink Night | 1080x2340 @480 (360x780 dp screen) | 360.00×689.00 | 0.183913 | **7.36 pt** | 22.07 | 22.08 / 22.09 |
| <img src="../artifacts/W3-08/captures/v1-i389-native-day/v1-i389-native-day.png" width="150" alt="v1-i389-native-day"><br>`v1-i389-native-day.png` | Daylight | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.210186 | **8.41 pt** | 29.43 | 29.46 / 29.45 |
| <img src="../artifacts/W3-08/captures/v1-i389-native-night/v1-i389-native-night.png" width="150" alt="v1-i389-native-night"><br>`v1-i389-native-night.png` | Ink Night | 1440x3120 @560 (411.43x891.43 dp screen) | 411.43×804.29 | 0.210186 | **8.41 pt** | 29.43 | 29.46 / 29.45 |

### Extra: the 360×640 dp geometry (viewport log for the cellPt table)

| screenshot | theme | geometry | logged board viewport (dp) | camera scale (= minScale, fit) | **cellPt** | cell px | measured stroke pitch x / y (px) |
|---|---|---|---|---|---|---|---|
| <img src="../artifacts/W3-08/captures/v1-i11-360x640-day/v1-i11-360x640-day.png" width="150" alt="v1-i11-360x640-day"><br>`v1-i11-360x640-day.png` | Daylight | 1080x1920 @480 (360x640 dp screen) | 360.00×549.00 | 0.228649 | **9.15 pt** | 27.44 | 27.55 / 27.44 |

Index 11 (level 12): Bolt 46×37, 54 arrows, generator v1. Same cellPt as at 360×780: the board is width-bound on both.

## cellPt table: every rows×cols from 8 to 46 at each logged viewport

- **Script:** `artifacts/W3-08/scripts/cellpt-table.ts`. It was run with tsx inside the `git archive 6b8bf20` tree. It
  calls `initialCamera(vw, vh, cols·40, rows·40, 40, zoomed=false)` from `src/ui/boardCamera.ts`, the same function
  `BoardView.fitToViewport` calls, and reads `cellPt = scale × 40`. The script asserts that `scale === minScale`.
- **Viewports:** the three logged at 6b8bf20, as floats (`timing.json` of `v1-i0-native-day`, `v1-i0-360x780-day` and
  `v1-i11-360x640-day`). The probe's `--viewport` accepts only integers, which is why the script is separate. The probe
  still agrees to one decimal (`artifacts/W3-08/table/probe-crosscheck.txt`).
- **Raw matrices:** `artifacts/W3-08/table/cellpt-{411x804,360x689,360x549}.csv`, 39×39 each, 4 decimals.

The fit is `min(width-bound, height-bound)`. So every rows×cols cell equals
`min(cols=N bound at cols, rows=N bound at rows)`. The script checks that identity on all 3 × 1521 cells.

The compact table gives every combination:

- Look up the board's **cols** in a "cols=N" column and its **rows** in the matching "rows=N" column.
- Take the smaller of the two.

Every campaign board (1–10000, v1 and v2) is width-bound here, so its cellPt is simply the "cols=N" value.

FIT_MARGIN (from boardCamera.ts) = 0.94; CELL = 40.

| N | cols=N bound @411x804 | cols=N bound @360x689 | cols=N bound @360x549 | rows=N bound @411x804 | rows=N bound @360x689 | rows=N bound @360x549 | N×N @411x804 | N×N @360x689 | N×N @360x549 |
|---|---|---|---|---|---|---|---|---|---|
| 8 | 48.34 | 42.30 | 42.30 | 94.50 | 80.96 | 64.51 | 48.34 | 42.30 | 42.30 |
| 9 | 42.97 | 37.60 | 37.60 | 84.00 | 71.96 | 57.34 | 42.97 | 37.60 | 37.60 |
| 10 | 38.67 | 33.84 | 33.84 | 75.60 | 64.77 | 51.61 | 38.67 | 33.84 | 33.84 |
| 11 | 35.16 | 30.76 | 30.76 | 68.73 | 58.88 | 46.91 | 35.16 | 30.76 | 30.76 |
| 12 | 32.23 | 28.20 | 28.20 | 63.00 | 53.97 | 43.00 | 32.23 | 28.20 | 28.20 |
| 13 | 29.75 | 26.03 | 26.03 | 58.16 | 49.82 | 39.70 | 29.75 | 26.03 | 26.03 |
| 14 | 27.62 | 24.17 | 24.17 | 54.00 | 46.26 | 36.86 | 27.62 | 24.17 | 24.17 |
| 15 | 25.78 | 22.56 | 22.56 | 50.40 | 43.18 | 34.40 | 25.78 | 22.56 | 22.56 |
| 16 | 24.17 | 21.15 | 21.15 | 47.25 | 40.48 | 32.25 | 24.17 | 21.15 | 21.15 |
| 17 | 22.75 | 19.91 | 19.91 | 44.47 | 38.10 | 30.36 | 22.75 | 19.91 | 19.91 |
| 18 | 21.49 | 18.80 | 18.80 | 42.00 | 35.98 | 28.67 | 21.49 | 18.80 | 18.80 |
| 19 | 20.35 | 17.81 | 17.81 | 39.79 | 34.09 | 27.16 | 20.35 | 17.81 | 17.81 |
| 20 | 19.34 | 16.92 | 16.92 | 37.80 | 32.38 | 25.80 | 19.34 | 16.92 | 16.92 |
| 21 | 18.42 | 16.11 | 16.11 | 36.00 | 30.84 | 24.57 | 18.42 | 16.11 | 16.11 |
| 22 | 17.58 | 15.38 | 15.38 | 34.36 | 29.44 | 23.46 | 17.58 | 15.38 | 15.38 |
| 23 | 16.81 | 14.71 | 14.71 | 32.87 | 28.16 | 22.44 | 16.81 | 14.71 | 14.71 |
| 24 | 16.11 | 14.10 | 14.10 | 31.50 | 26.99 | 21.50 | 16.11 | 14.10 | 14.10 |
| 25 | 15.47 | 13.54 | 13.54 | 30.24 | 25.91 | 20.64 | 15.47 | 13.54 | 13.54 |
| 26 | 14.87 | 13.02 | 13.02 | 29.08 | 24.91 | 19.85 | 14.87 | 13.02 | 13.02 |
| 27 | 14.32 | 12.53 | 12.53 | 28.00 | 23.99 | 19.11 | 14.32 | 12.53 | 12.53 |
| 28 | 13.81 | 12.09 | 12.09 | 27.00 | 23.13 | 18.43 | 13.81 | 12.09 | 12.09 |
| 29 | 13.34 | 11.67 | 11.67 | 26.07 | 22.33 | 17.80 | 13.34 | 11.67 | 11.67 |
| 30 | 12.89 | 11.28 | 11.28 | 25.20 | 21.59 | 17.20 | 12.89 | 11.28 | 11.28 |
| 31 | 12.48 | 10.92 | 10.92 | 24.39 | 20.89 | 16.65 | 12.48 | 10.92 | 10.92 |
| 32 | 12.09 | 10.57 | 10.57 | 23.63 | 20.24 | 16.13 | 12.09 | 10.57 | 10.57 |
| 33 | 11.72 | 10.25 | 10.25 | 22.91 | 19.63 | 15.64 | 11.72 | 10.25 | 10.25 |
| 34 | 11.37 | 9.95 | 9.95 | 22.24 | 19.05 | 15.18 | 11.37 | 9.95 | 9.95 |
| 35 | 11.05 | 9.67 | 9.67 | 21.60 | 18.50 | 14.74 | 11.05 | 9.67 | 9.67 |
| 36 | 10.74 | 9.40 | 9.40 | 21.00 | 17.99 | 14.33 | 10.74 | 9.40 | 9.40 |
| 37 | 10.45 | 9.15 | 9.15 | 20.43 | 17.50 | 13.95 | 10.45 | 9.15 | 9.15 |
| 38 | 10.18 | 8.91 | 8.91 | 19.90 | 17.04 | 13.58 | 10.18 | 8.91 | 8.91 |
| 39 | 9.92 | 8.68 | 8.68 | 19.39 | 16.61 | 13.23 | 9.92 | 8.68 | 8.68 |
| 40 | 9.67 | 8.46 | 8.46 | 18.90 | 16.19 | 12.90 | 9.67 | 8.46 | 8.46 |
| 41 | 9.43 | 8.25 | 8.25 | 18.44 | 15.80 | 12.59 | 9.43 | 8.25 | 8.25 |
| 42 | 9.21 | 8.06 | 8.06 | 18.00 | 15.42 | 12.29 | 9.21 | 8.06 | 8.06 |
| 43 | 8.99 | 7.87 | 7.87 | 17.58 | 15.06 | 12.00 | 8.99 | 7.87 | 7.87 |
| 44 | 8.79 | 7.69 | 7.69 | 17.18 | 14.72 | 11.73 | 8.79 | 7.69 | 7.69 |
| 45 | 8.59 | 7.52 | 7.52 | 16.80 | 14.39 | 11.47 | 8.59 | 7.52 | 7.52 |
| 46 | 8.41 | 7.36 | 7.36 | 16.44 | 14.08 | 11.22 | 8.41 | 7.36 | 7.36 |

<details><summary>Full 39×39 matrix at 411.43x804.29 dp (native 1440x3120 @560, 411.43x891.43 dp screen) (logged by v1-i0-native-day)</summary>

| rows\cols | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **8** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **9** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **10** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **11** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **12** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **13** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **14** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **15** | 48.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **16** | 47.3 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **17** | 44.5 | 43.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **18** | 42.0 | 42.0 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **19** | 39.8 | 39.8 | 38.7 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **20** | 37.8 | 37.8 | 37.8 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **21** | 36.0 | 36.0 | 36.0 | 35.2 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **22** | 34.4 | 34.4 | 34.4 | 34.4 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **23** | 32.9 | 32.9 | 32.9 | 32.9 | 32.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **24** | 31.5 | 31.5 | 31.5 | 31.5 | 31.5 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **25** | 30.2 | 30.2 | 30.2 | 30.2 | 30.2 | 29.7 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **26** | 29.1 | 29.1 | 29.1 | 29.1 | 29.1 | 29.1 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **27** | 28.0 | 28.0 | 28.0 | 28.0 | 28.0 | 28.0 | 27.6 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **28** | 27.0 | 27.0 | 27.0 | 27.0 | 27.0 | 27.0 | 27.0 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **29** | 26.1 | 26.1 | 26.1 | 26.1 | 26.1 | 26.1 | 26.1 | 25.8 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **30** | 25.2 | 25.2 | 25.2 | 25.2 | 25.2 | 25.2 | 25.2 | 25.2 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **31** | 24.4 | 24.4 | 24.4 | 24.4 | 24.4 | 24.4 | 24.4 | 24.4 | 24.2 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **32** | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 | 23.6 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **33** | 22.9 | 22.9 | 22.9 | 22.9 | 22.9 | 22.9 | 22.9 | 22.9 | 22.9 | 22.7 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **34** | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 22.2 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **35** | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.5 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **36** | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 21.0 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **37** | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 20.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **38** | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.9 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **39** | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.4 | 19.3 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **40** | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.9 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **41** | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **42** | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **43** | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 17.6 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **44** | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **45** | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.8 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |
| **46** | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.4 | 16.1 | 15.5 | 14.9 | 14.3 | 13.8 | 13.3 | 12.9 | 12.5 | 12.1 | 11.7 | 11.4 | 11.0 | 10.7 | 10.5 | 10.2 | 9.9 | 9.7 | 9.4 | 9.2 | 9.0 | 8.8 | 8.6 | 8.4 |

</details>

<details><summary>Full 39×39 matrix at 360x689 dp (1080x2340 @480 override, 360x780 dp screen) (logged by v1-i0-360x780-day)</summary>

| rows\cols | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **8** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **9** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **10** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **11** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **12** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **13** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **14** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **15** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **16** | 40.5 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **17** | 38.1 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **18** | 36.0 | 36.0 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **19** | 34.1 | 34.1 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **20** | 32.4 | 32.4 | 32.4 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **21** | 30.8 | 30.8 | 30.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **22** | 29.4 | 29.4 | 29.4 | 29.4 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **23** | 28.2 | 28.2 | 28.2 | 28.2 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **24** | 27.0 | 27.0 | 27.0 | 27.0 | 27.0 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **25** | 25.9 | 25.9 | 25.9 | 25.9 | 25.9 | 25.9 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **26** | 24.9 | 24.9 | 24.9 | 24.9 | 24.9 | 24.9 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **27** | 24.0 | 24.0 | 24.0 | 24.0 | 24.0 | 24.0 | 24.0 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **28** | 23.1 | 23.1 | 23.1 | 23.1 | 23.1 | 23.1 | 23.1 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **29** | 22.3 | 22.3 | 22.3 | 22.3 | 22.3 | 22.3 | 22.3 | 22.3 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **30** | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **31** | 20.9 | 20.9 | 20.9 | 20.9 | 20.9 | 20.9 | 20.9 | 20.9 | 20.9 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **32** | 20.2 | 20.2 | 20.2 | 20.2 | 20.2 | 20.2 | 20.2 | 20.2 | 20.2 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **33** | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 19.6 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **34** | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 19.0 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **35** | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 18.5 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **36** | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 18.0 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **37** | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 17.5 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **38** | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 17.0 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **39** | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **40** | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.2 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **41** | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.8 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **42** | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **43** | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 15.1 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **44** | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **45** | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.4 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **46** | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |

</details>

<details><summary>Full 39×39 matrix at 360x549 dp (1080x1920 @480 override, 360x640 dp screen) (logged by v1-i11-360x640-day)</summary>

| rows\cols | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **8** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **9** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **10** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **11** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **12** | 42.3 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **13** | 39.7 | 37.6 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **14** | 36.9 | 36.9 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **15** | 34.4 | 34.4 | 33.8 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **16** | 32.3 | 32.3 | 32.3 | 30.8 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **17** | 30.4 | 30.4 | 30.4 | 30.4 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **18** | 28.7 | 28.7 | 28.7 | 28.7 | 28.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **19** | 27.2 | 27.2 | 27.2 | 27.2 | 27.2 | 26.0 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **20** | 25.8 | 25.8 | 25.8 | 25.8 | 25.8 | 25.8 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **21** | 24.6 | 24.6 | 24.6 | 24.6 | 24.6 | 24.6 | 24.2 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **22** | 23.5 | 23.5 | 23.5 | 23.5 | 23.5 | 23.5 | 23.5 | 22.6 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **23** | 22.4 | 22.4 | 22.4 | 22.4 | 22.4 | 22.4 | 22.4 | 22.4 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **24** | 21.5 | 21.5 | 21.5 | 21.5 | 21.5 | 21.5 | 21.5 | 21.5 | 21.1 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **25** | 20.6 | 20.6 | 20.6 | 20.6 | 20.6 | 20.6 | 20.6 | 20.6 | 20.6 | 19.9 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **26** | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 19.8 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **27** | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 19.1 | 18.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **28** | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 18.4 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **29** | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 17.8 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **30** | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 17.2 | 16.9 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **31** | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.6 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **32** | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 16.1 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **33** | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.6 | 15.4 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **34** | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 15.2 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **35** | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.7 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **36** | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.3 | 14.1 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **37** | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.9 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **38** | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.6 | 13.5 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **39** | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.2 | 13.0 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **40** | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.9 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **41** | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.6 | 12.5 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **42** | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.3 | 12.1 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **43** | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 12.0 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **44** | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.7 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **45** | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.5 | 11.3 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |
| **46** | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 11.2 | 10.9 | 10.6 | 10.3 | 10.0 | 9.7 | 9.4 | 9.1 | 8.9 | 8.7 | 8.5 | 8.3 | 8.1 | 7.9 | 7.7 | 7.5 | 7.4 |

</details>


## How many levels sit below a given cell size

- **Source:** `artifacts/W3-08/scripts/level-dist.py`. Its input is the probe's rows mode over levels 1–10000 at 6b8bf20
  (`artifacts/W3-08/probe/v{1,2}-1-10000.json`). It keeps only rows and cols, then recomputes cellPt with the logged
  float viewports.
- **The 360×549 rows equal the 360×689 rows**, because every board is width-bound.
- **These are counts, not a recommendation.**

| generator, levels | viewport | smallest cell (level) | median | < 8 pt | < 9 pt | < 10 pt | < 12 pt | < 14 pt | < 16 pt | < 20 pt |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| v1, 1–1000 | 360 dp wide | 7.36 (390, Crescent 46×46) | 14.10 | 25 | 107 | 188 | 332 | 486 | 708 | 984 |
| v1, 1–1000 | 411.43 dp wide | 8.41 (390) | 16.11 | 0 | 25 | 94 | 201 | 377 | 486 | 857 |
| v2, 1–1000 | 360 dp wide | 7.87 (48, Crown 37×43) | 12.53 | 8 | 68 | 154 | 407 | 715 | 900 | 999 |
| v2, 1–1000 | 411.43 dp wide | 8.99 (48) | 14.32 | 0 | 8 | 44 | 184 | 492 | 715 | 967 |
| v1, 1–10000 | 360 dp wide | 7.36 (390) | 14.10 | 282 | 1069 | 1887 | 3301 | 4829 | 7088 | 9838 |
| v2, 1–10000 | 360 dp wide | 7.69 (1788, Fish 37×44) | 12.53 | 76 | 635 | 1608 | 3974 | 7151 | 8960 | 9969 |

**Observed, not interpreted.** v2's median cell is smaller than v1's: 12.53 pt against 14.10 pt at 360 dp. v2 deals
fewer tiny-cell boards (8 against 25 below 8 pt in 1–1000) but more mid-size ones.

## Corrections to the brief and the drafts

| Claim | Where | Measured | Evidence |
|---|---|---|---|
| "the W1-01 geometries 514×1114 dp" | brief, `W3.md:383` | The native geometry is 411.43×891.43 dp (`1440x3120 @560`). W1-01 already corrected this. | `docs/board-viewport-measured.md`; wm read-back in every native `manifest.json` |
| "index 11: Bolt 46×37, the smallest cells in levels 1–1000" | brief | Bolt is the **tallest** v1 board (46 rows). Its cells are 9.15 pt / 10.45 pt, set by its 37 columns. The smallest cells in 1–1000 are at level 390 (Crescent 46×46): 7.36 / 8.41 pt. 107 v1 levels in 1–1000 are below Bolt's 9.15 pt on a 360 dp phone. | captures `v1-i11-*`, `v1-i389-*`; `level-distribution.txt` |
| "A dense board's cells are 8-22 pt at fit-to-view" | `src/ui/hitTest.ts:6` at 6b8bf20 | 20×20 to 46×46 boards: 7.36–19.34 pt. The comment is corrected (below). | table above; 29 runtime logs |
| "a 46-cell board at 3.5x fit was still only 29 pt per cell" | `src/ui/boardCamera.ts:10-11` | **Confirmed** for the native viewport: 8.41 × 3.5 = 29.4 pt. On a 360 dp phone it is 7.36 × 3.5 = 25.7 pt. Unchanged; outside this task's files. | table above |
| every cellPt in both drafts assumed a viewport (390×520) | brief, pre-fix | Every number here is a logged runtime value or is computed from one. | this doc |
| "Bolt at 80 rows computes to about 4–5 pt/cell" | draft 2 | **Not captured**, and a clamp above 46 is a non-goal. Rows do not bind at these viewports; columns do. At Bolt's 46:37 aspect, 80 rows would be about 64 columns: 0.94 × 360 / 64 ≈ 5.3 pt (6.0 pt at 411 dp). This is COMPUTED, not observed. | arithmetic only |

## Change to `src/ui/hitTest.ts` (comment only)

`TAP_RADIUS_PT`'s doc comment now reads "20x20-46x46 boards are 7.4-19.3 pt per cell at fit-to-view on the logged
360-411 dp wide viewports (docs/board-legibility-2026-09-26.md)". It keeps the same line count, so
`TAP_RADIUS_PT` stays on line 11, which `docs/next-level/tasks/W1.md` and `reports/P-03.md` cite. No code changed.

## Evidence labels and limits

- **EXECUTED:**
  - 29 emulator captures of the real renderer;
  - runtime `[board-viewport]` and `[board-camera]` logs;
  - the pixel pitch, bounding-box and background checks;
  - the table script and the probe cross-checks;
  - the bundle proofs.
- **INFERRED:** the tree carries one extra `console.log`, and that log changes no layout or camera value. It only
  formats values that `fitToViewport` already computed, but no capture was taken without it. The PNG comparison against
  W1-01's own 360×780 capture (identical board-ink and heart pixel bounds) is the closest control.
- **UNVERIFIED-DEVICE (W3-22):**
  - physical-phone density, insets and viewing distance;
  - gesture-navigation phones, where the bottom inset differs;
  - iOS, which was not built.

  All captures come from one software-GPU emulator. The pt figures hold for any phone with these logged viewports.
  How legible a 7.4 pt cell looks on a real 6-inch screen at arm's length is the owner's call, made on a picture.
- **Not measured:**
  - whether players can read or tap these cells: no user data, and the drafts' numbers were never player data either;
  - a 16×16 board, the smallest in the campaign (21.15 pt at 360 dp). It was not captured.

## Owner question (for W3-09)

**What is the smallest board you would accept a player seeing?**

Answer on `artifacts/W3-08/owner-legibility-boards.png` with a row number (1–7) or "none of these". The rows run from
1: 20×20 at 16.9 pt down to 7: 46×46 at 7.4 pt, all on the 360×780 dp phone. W3-09 then turns that answer into a clamp.

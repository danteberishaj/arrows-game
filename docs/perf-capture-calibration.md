# Capture instrument calibration (emulator-5556)

P-02, 2026-09-17. Device: `emulator-5556`, AVD `fleet_floor_api31`, API 31, software GPU on this
Mac, physical display 1440x3120 @560. **Every number on this page belongs to this emulator on this
host.** None of them transfers to a phone (UNVERIFIED-DEVICE). Raw JSON and recordings are in
`artifacts/P-02/` (gitignored). Each number names the command that produced it.

## Geometry per dp size (ruling F03 b)

| dp size | `capture.mjs` flags | used by |
|---|---|---|
| 360×640 dp | `--wm-size 1080x1920 --wm-density 480` | W4-02, W1-01, every 360×640 capture |
| native (514×1114 dp) | none (1440x3120 @560) | every calibration row below |

`capture.mjs` reads both values back, stores them in `manifest.json`, and runs `wm size reset` and
`wm density reset` on exit, including after an error.

## Tap hold (Stage C)

Scripted taps must hold for less than `PRESS_PREVIEW_DELAY_MS = 64` (`BoardView.tsx:81`). A longer
hold draws the static press preview, even at scale 0.

- `adb shell getevent -lt` during `adb shell input tap` recorded **no events**, only the device list
  (`artifacts/P-02/stageC/taphold/getevent-during-input-tap.txt`). Injected events never pass
  through `/dev/input`, so getevent cannot measure them.
- The measurement instead reads the DOWN and UP `eventTime` of the last two injected MotionEvents
  from `adb shell dumpsys input` (RecentQueue), once after each tap (`artifacts/P-02/stageC/taphold/holds.txt`):

| injector | n | DOWN→UP eventTime (ms) | < 64 ms |
|---|---|---|---|
| `adb shell input tap`: single scripted taps in `capture.mjs --step blocked/exit/lost`, `calibrate.mjs` and `benchmark.mjs --assert-rendered` | 5 | 0.0, 0.0, 0.0, 0.0, 0.0 | yes |
| `ArrowsWorkload tap` / `tap-sequence`: `benchmark.mjs` measured phases, `capture.mjs --step won` | 5 | 40, 36, 36, 38, 35 (median 36) | yes |

No shorter injection is needed.

Both injectors are under 64 ms. Single scripted taps still use `input tap`, because the command
returns in 14–25 ms (on-device `date` stamps). ArrowsWorkload's `app_process` JVM takes 944–974 ms
end to end and exits ~0.9 s after its UP. Anything timed from its return, like a mid-phase
screencap, would land a second late (Stage D, superseded attempt).

## Recorder frame period (Stage C)

Command: `node scripts/perf/android/calibrate.mjs recorder --apk artifacts/P-02/apk/stageB-game-perf.apk --n 5 --out artifacts/P-02/stageC/calibration`.
The APK is a HEAD PERF build (JS repack, sha256 `3f3afaa8…`). Each run sets all three scales to 1,
force-stops and relaunches. Read-back was `1 1 1` and `appReducedMotion: false` (logcat) for all 5.
Each recording is `screenrecord --size 720x1560 --bit-rate 20000000`, 3 s, with one scripted
blocked tap on cell (35,19) 800 ms in.

- **Flash window:** from the first frame with ≥ 40 flash-magenta pixels in the board region
  (onset) to onset + 650 ms (`BLOCKER_FLASH_MS`, `src/ui/feedbackCurves.ts:10`).
- **Periods:** between consecutive frames inside that window, from `ffprobe` `pts_time`.

| recording | frames in recording | frames inside flash window | min period (ms) | median period (ms) | max period (ms) | 650 ÷ median |
|---|---|---|---|---|---|---|
| 1 | 102 | 40 | 14.989 | 16.589 | 19.377 | 39.2 |
| 2 | 104 | 40 | 13.833 | 16.589 | 19.089 | 39.2 |
| 3 | 103 | 39 | 12.678 | 16.906 | 20.633 | 38.4 |
| 4 | 104 | 40 | 13.956 | 16.500 | 19.633 | 39.4 |
| 5 | 95 | 40 | 11.334 | 16.733 | 19.244 | 38.8 |

**Reconciliation:** frames observed 39–40 vs 650 ms ÷ median period = 38.4–39.4. Every recording is
within one frame of the expected count, so while the screen changes every vsync the recorder keeps
the 60 Hz display rate. Median of the five medians: **16.589 ms**. Range over all in-window periods:
11.334–20.633 ms.

**Idle board.** Command: `calibrate.mjs idle` (scale 1, relaunched, read back `1 1 1`), 2 s of the
idle level-3827 board. Result: **1 frame** (`pts 0`). That confirms the INFERRED behaviour:
`screenrecord` emits a frame only when the screen changes. **A frame count over a static period
means nothing,** and a frame-count threshold may only be applied inside a window where the screen
is known to change.

Consumers may say "visible in N consecutive recorded frames" only inside such a window, using
this table's ~16.6 ms period. Otherwise the criterion is "visible in the recording" plus owner
eyeball.

## Pixel-difference floor (Stage D)

**Instrument.** `scripts/perf/android/pixel-diff.mjs`: a pixel is changed when its max RGB channel
delta is **> 24** (`DEFAULT_TOLERANCE`, OWNER-PICKED STARTING VALUE). Regions:

- `board`: the `perf-board` accessibility bounds from `findBoardBounds` (`[0,279][1440,3120]`, bottom
  extended to the display), minus everything above the header strip. The header strip is the lowest
  `LEVEL n` / `n left` text node, bottom 258, which is above the board top. The heart pips and the
  counter lie outside the region: set B below loses a heart on every sample and still reads 0.
- `screen`: the full frame.

**APKs** (JS repacks over the gradle-built PERF host `artifacts/W0-04/perf/apk/fix-gradle-perf.apk`,
native code == da93dcd; recipe `artifacts/P-02/scripts/repack.sh`):

- base PERF `fea8a939…` (the 17 files that differ were checked out at `da93dcd` for the bundle,
  harness env `EXPO_PUBLIC_PERF_LEVEL=3827`, `FEEDBACK=1`, `EXIT_DURATION_MS=180`);
- base PERF empty board `46c57ef7…` (same, `EXPO_PUBLIC_PERF_EMPTY_BOARD=1`, the
  `--diagnostic-empty-board` build value);
- HEAD PERF menu `d226b4e3…` (`EXPO_PUBLIC_PERF_SCREEN=menu`).

The base APK predates the P-02 label, so its `appReducedMotion` reads
`"unavailable: PERF build without the P-02 reduced-motion label"`. For every sample below the
read-back scales were `1 1 1` (or `0 0 0` for the scale-0 menu row), each after a force-stop and
relaunch. Raw JSON: `artifacts/P-02/stageD/*.json`, summary `artifacts/P-02/stageD/summary.txt`.

### Sets A, B, B0, C: blocked-tap screencap pairs, `board` region, n = 10 each

Procedure (`calibrate.mjs blocked-pairs`): launch, wait 2.5 s, then run in one `adb shell`:
`screencap -p pre; input tap <cell 35,19>; sleep 0.15; screencap -p mid`. `input tap` returns in
17–22 ms, and the measured gap from input end to the mid screencap is 158–188 ms. The pair is
pre vs mid.

| set | APK | scale | input | board changed px (of 4 091 040), raw | min / median / max |
|---|---|---|---|---|---|
| A idle | base | 1 | none | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 0 / 0 / 0 |
| B no-draw control | base empty board | 1 | same tap | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 0 / 0 / 0 |
| B0 non-rendering control | base | **0** | same tap | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 6 / 6 / 6 |
| C known visible | base | 1 | same tap | 2942, 2939, 3007, 3007, 3007, 2933, 2941, 3009, 2936, 3007 | 2933 / 2974.5 / 3009 |

The same pairs on the `screen` region: A all 0; B 3122–3758 (the lost heart pip); B0 2636 ×10; C 6370–7259.

**Why B0 exists.** The first Stage E validation used the A ∪ B floor of 0 px
(`artifacts/P-02/stageE/attempt1-floor0/`). On the base APK at scale 0 it reported **PASS with
6 px**, so it missed the reduce-motion blackout. The 6 px sit on the tapped arrow (720,2255) and
the blocker: antialiasing differences of up to 72 per channel from the feedback layer redrawing
arrows that do not visibly change. Neither A (no input) nor B (nothing drawn) exercises such a
redraw. The brief names the base APK at scale 0 as a valid non-rendering control ("the
non-rendering control must be the base APK or set B"). B0 is that control, measured as its own
n = 10 set. The Stage E runs below are fresh samples, not these ten.

**Superseded floor (fix round 1).** The first floor was fitted on cell (35,19) only:
max(A ∪ B ∪ B0) = 6 px + spread 6 px = 12 px. A held-out check on another cell disproved it (next
subsection): the base APK at scale 0 changes **14 px** on cell (31,14), so a 12 px floor passes the
reduce-motion blackout there.

### Held-out cells (fix round 1)

Command: `node scripts/perf/android/calibrate.mjs blocked-pairs --apk artifacts/P-02/apk/base-da93dcd-perf.apk --set <B0|C> --motion-scale <0|1> --n <10|3> --cell <row,col> --out artifacts/P-02/fix1/heldout`.
Same base APK `fea8a939…`, same procedure as above, a force-stop and relaunch before each sample.
The read-back scales were `0 0 0` for every B0 sample and `1 1 1` for every C sample. The gap from
input end to the mid screencap was 158–191 ms. Cells (31,14) and (30,21) are the other two blocked
arrows in `validateWorkload` (`benchmark.mjs`). Raw JSON is `artifacts/P-02/fix1/heldout/*.json`, and
the summary is `artifacts/P-02/fix1/heldout-summary.txt`.

The protocol was written down in `artifacts/P-02/fix1/PREREGISTRATION.txt` after the (31,14) B0
samples and **before any (30,21) sample was taken**: refit on (35,19) and (31,14), then test on
(30,21), with no second refit.

| cell | role | set | scale | board changed px, raw | min / median / max |
|---|---|---|---|---|---|
| (35,19) | fitted (Stage D above) | B0 | 0 | 6 ×10 | 6 / 6 / 6 |
| (31,14) | fitted (fix round 1) | B0 | 0 | 14, 14, 14, 14, 14, 14, 14, 14, 14, 14 | 14 / 14 / 14 |
| (31,14) | positive control | C | 1 | 3075, 3077, 3171 | 3075 / 3077 / 3171 |
| (30,21) | **held out** | B0 | 0 | 9, 9, 9, 9, 9, 9, 9, 9, 9, 9 | 9 / 9 / 9 |
| (30,21) | **held out** positive control | C | 1 | 5163, 5144, 5167 | 5144 / 5163 / 5167 |

Where the scale-0 pixels are (EXECUTED pixel listing, cause INFERRED):
- (31,14): one column, x = 653, y 2106–2125, deltas 27–46. That is the edge of the tapped arrow's
  head.
- (30,21): 9 px at the corners of the tapped arrow, deltas 29–88.

Both fit the antialiasing redraw already seen on (35,19). The count depends on the arrow's
geometry, so it differs per cell but is identical within a cell across 10 fresh launches.

**`board` floor, arithmetic:** max(A ∪ B ∪ B0(35,19) ∪ B0(31,14)) = 14 px, spread of that union =
14 − 0 = 14 px, so floor = 14 + 14 = **28 px (fraction 6.84e-6)**. The gate passes only when
**changed px > 28**.

- Set B's maximum is 0, which is not > 28, so **set B does not pass**.
- The fitted B0 maxima are 6 and 14, not > 28, so **B0 does not pass on either fitted cell**.
- **Held out:** B0 on (30,21) is 9 px, not > 28, so the gate **FAILS the blackout on a cell it was
  not fitted to**. C on (30,21) is ≥ 5144 px > 28, so it **PASSES** there.
- Set C's minimum on any cell is 2933 px > 28.

**A/B/B0 and C separate by a factor of about 105** (2933 ÷ 28).

**Limits of the held-out claim:**
- The held-out evidence is **one cell** of one level (3827) on this emulator. Each cell's count is
  deterministic, so the 10 samples are one value, measured 10 times.
- The held-out margin is 9 px against a 28 px floor.
- A level, arrow shape or redraw path that repaints more than 28 px of antialiasing without drawing
  the effect would still pass. The gate itself always taps (35,19) on level 3827.

**`screen` region: does not separate for a blocked tap.** Floor = max(A ∪ B ∪ B0) + spread =
3758 + (3758 − 0) = 7516 px, and C's maximum is 7259 px. The lost heart pip is as large as the
flash, so the blocked gate uses `board` only.

The first attempt used ArrowsWorkload for the tap. Its JVM needs ~0.9 s to exit after the UP, so the
"mid" frame landed after the 650 ms flash and C read 0 px. That attempt is superseded and kept in
`artifacts/P-02/stageD/superseded-driver-tap/`.

### Menu idle rows, `screen` region, n = 10 each

Procedure (`calibrate.mjs menu-pairs`): launch the menu build, wait 2.5 s, then
`screencap -p pre; sleep 0.5; screencap -p post`. The Play-pill mask is the clickable `Play`
Pressable from a scale-0 dump, `[283,1806][1158,2044]`, grown by 3% of each side plus 8 px (breath
scale 1.03, `HomeScreen.tsx:50-57`): `248,1790,945,270`, 255 150 px. The first attempt used the
inner Text node and left 9 122–9 466 px unmasked; it is in `superseded-text-node-mask/`.

| row | scale | unmasked changed px (of 4 492 800), raw | min / median / max | pill masked, raw | min / median / max |
|---|---|---|---|---|---|
| menu idle | 0 | 0 ×10 | 0 / 0 / 0 | 0 ×10 | 0 / 0 / 0 |
| menu idle | 1 | 10213, 10544, 10394, 10544, 10160, 10160, 10394, 10544, 10213, 10544 | 10160 / 10394 / 10544 | 0 ×10 | 0 / 0 / 0 |

Menu floors for diff consumers (W4), per row: scale 0 unmasked 0 + 0 = **0 px**; scale 1 unmasked
10544 + (10544 − 10160) = **10928 px (fraction 2.432e-3)**; masked at either scale 0 + 0 = **0 px**.
At scale 1, diff menus with the pill masked. An unmasked 0.5 s pair changes ~10 k px from the
breath alone.

### Exit recordings: sets A, B, B0, C, `board` region, n = 10 each

Screencaps are too slow for a 180 ms exit (a raw `screencap` takes 95–119 ms, `-p` 198–227 ms).
Exit therefore uses 2 s 720x1560 recordings, with the tap (`input tap` on the exit-phase arrow, head
(3,16), exit direction **up**) 800 ms in (`calibrate.mjs exit-recordings`).

The motion measure is `pixel-diff.mjs exitMotion`:

- the **footprint** is every pixel that differs between the pre frame (frame 0) and the settled last
  frame (the removed arrow), dilated by 2 recording px (OWNER-PICKED STARTING VALUE);
- **trail pixels** differ from pre and lie outside the footprint: ink where no arrow was;
- **displacement** is the trail centroid's travel along the exit direction, from the first frame with
  more trail pixels than the trail floor to the first such frame at least 60 ms later (OWNER-PICKED
  STARTING VALUE).

The first measure tried was the brief's literal one, the centroid of all changed pixels vs pre. It
does **not** separate: onset → +60 ms moved 141 px at scale 1 and 126 px at scale 0, because the
removal itself paints progressively. It is in `superseded-centroid-vs-pre/`.

The raw runs were scored with trail floor 0. The last column re-scores the stored per-frame data
with the final trail floor of 36 px (`pixel-diff.mjs trailMotion`, same frames).

| set | APK | scale | frames per recording | max changed fraction | max trail px in any frame | displacement px @ trail floor 0, raw | displacement px @ trail floor 36, raw |
|---|---|---|---|---|---|---|---|
| A idle | base | 1 | 1,1,1,1,1,2,1,1,1,1 | 0 ×10 | 0 ×10 | 0 ×10 | 0 ×10 |
| B no-draw control | base empty board | 1 | 2 ×10 (header heart only) | 0 ×10 | 0 ×10 | 0 ×10 | 0 ×10 |
| B0 non-moving control | base | **0** | 13 ×10 | 9.879e-4 ×8, 1.0084e-3 ×2 | 18 ×10 | 0 ×10 | 0 ×10 |
| C known visible | base | 1 | 13,13,13,13,13,12,13,13,13,13 | 1.148e-3 – 1.158e-3 | 306–311 | 518.4, 517.8, 518.4, 517.8, 518.4, 527.1, 517.8, 518.4, 518.4, 518.4 | 180.3, 177.4, 164.5, 177.4, 180.3, 180.3, 177.4, 164.5, 180.3, 180.3 (min 164.5 / median 178.85 / max 180.3) |

Per-frame trail of C sample 1 (index, pts s, trail px, trail centroid y):
(1, 1.152, 18, 1063) (2, 1.169, 16, 1091) (3, 1.187, 54, 716) (4, 1.204, 126, 621)
(5, 1.221, 205, 544) (6, 1.236, 309, 535) (7, 1.252, 300, 536) (8, 1.269, 266, 533)
(9, 1.286, 67, 517) (10, 1.303, 0, –).

The 18/16 px in frames 1–2 sit near the arrow's tail and appear at scale 0 too (B0). With trail
floor 0 most of the 518 px came from them. The trail floor of 36 excludes them, and the measured
travel is then the dash's own: frames 3→6, 716 → 535, 181 px up.

**Exit floors, arithmetic.** Each floor comes from the controls that are negative for its property:

- trail-pixel floor (nothing drawn outside the arrow): max over any frame of A ∪ B ∪ B0 = 18 px,
  spread 18 − 0 = 18, so **36 px**;
- displacement floor (nothing moves): at trail floor 36, max(A ∪ B ∪ B0) = 0 px, spread 0, so 0 px.
  It is raised to the instrument resolution of **1 recording px** (2 device px), because a centroid
  shift below one pixel cannot be told from codec noise. The gate passes only when
  **displacement > 1 px**.
- changed-fraction floor (nothing drawn at all): max(A ∪ B) = 0, spread 0, so **0**. B0 is excluded
  here on purpose, because B0 does draw: the arrow is removed and a dash fades. This fraction is
  reported next to the moved check to show the alpha-fade trap. At scale 0, pixels change and
  nothing moves.

Set B's displacement maximum is 0, which is not > 1, so **set B does not pass**. B0's maximum is 0,
so **B0 does not pass**. C's minimum is 164.5 px. **A/B/B0 and C separate.**

### Kill condition

A/B/B0 and C do **not** overlap for `board`/blocked or for exit motion. Stage E is built. The instrument
**cannot** separate a blocked flash on the `screen` region (see above). No `screen`-region floor is
quoted for effect-rendered checks (ruling F03 c).

## Effect-rendered gate validation (Stage E)

`benchmark.mjs --assert-rendered blocked,exit` runs one blocked probe and one exit probe, the same
procedures as `calibrate.mjs` (`probeBlockedPair`, `probeExitRecording`). It records under
`assertRendered` in the result JSON whether each check ran and passed, the measured values and the
floors (read from `renderedFloors` below). The process exits with code 3 when a check fails.

Command:
`npm run perf:android -- --feedback --skip-build --apk <apk> --runs 1 --warmups 0 --phases blocked --motion-scale <s> --assert-rendered blocked,exit`.
Scales were read back after a force-stop and relaunch. JSON is in `artifacts/P-02/stageE/E1-*.json`
and evidence (pre/mid PNGs, exit mp4) in `artifacts/captures/P-02-E1-*/`. These are fresh runs, not
the calibration samples.

| # | APK | read-back scales | phase | measured | floor | expected | outcome |
|---|---|---|---|---|---|---|---|
| 1 | base `fea8a939` | 1 1 1 | blocked | 2944 board px (fix round 1 re-run: 3008) | > 28 px | PASS | **PASS** |
| 2 | base `fea8a939` | 0 0 0 | blocked | 6 board px (fix round 1 re-run: 6) | > 28 px | FAIL (reduce-motion blackout) | **FAIL**, calibration-fitted (see below) |
| 3 | base empty board `46c57ef7` (B control) | 1 1 1 | blocked | 0 board px | > 28 px | FAIL | **FAIL** |
| 2h | base `fea8a939` | 0 0 0 | blocked, **held-out cell (30,21)** | 9 board px ×10 | > 28 px | FAIL (reduce-motion blackout) | **FAIL** (held out) |
| 1h | base `fea8a939` | 1 1 1 | blocked, **held-out cell (30,21)** | 5144–5167 board px ×3 | > 28 px | PASS | **PASS** (held out) |
| 4 | base `fea8a939` | 1 1 1 | exit | displacement 180.3 px up; changed fraction 1.156e-3 | > 1 px; > 0 | PASS | **PASS** |
| 5 | base `fea8a939` | 0 0 0 | exit | displacement **0 px** (moved check FAIL); changed fraction **9.879e-4 > 0** | > 1 px; > 0 | FAIL on the moved check while pixels change | **FAIL (moved), changed fraction above floor** |
| 6 | base empty board `46c57ef7` (B control) | 1 1 1 | exit | displacement 0 px; changed fraction 0 | > 1 px; > 0 | FAIL | **FAIL** |

Row 5 is the alpha-fade trap. A changed-pixel gate would pass it (9.879e-4 > 0), and the moved check
catches it.

**Fix round 1: what each blocked row proves.**
- **Row 2 is calibration-fitted, not held out.** Its condition (base APK, scale 0, cell (35,19)) is
  exactly set B0 on the fitted cell, and the count is deterministic (6 px in all 10 B0 samples and in
  both gate runs). It fails by construction.
- **Rows 2h and 1h are the held-out evidence**, on a cell that was not used to fit the floor. They
  come from `calibrate.mjs blocked-pairs --cell 30,21` (the same `probeBlockedPair` the gate runs),
  with the same limits as in "Held-out cells" above.
- **Floor raised from 12 to 28 px.** Rows 1 and 2 were re-run end to end through the gate with the
  new floor: `npm run perf:android -- --feedback --skip-build --apk artifacts/P-02/apk/base-da93dcd-perf.apk --runs 1 --warmups 0 --phases blocked --motion-scale <0|1> --assert-rendered blocked --label P-02-fix1-E1-base-scale<s>`.
  - scale 0: `FAIL (changed 6 px vs floor 28)`, exit code 3;
  - scale 1: `PASS (changed 3008 px vs floor 28)`, exit code 0;
  - `artifacts/P-02/fix1/E1-fix1-*.json|log`.
- **Row 3 is re-scored, not re-run.** Its 0 px measurement is unchanged by the floor, because the
  blocked probe never reads the floor.
- **The exit rows do not rest on B0.** The saved row-5 `exit.mp4` was re-scored at trail floor 0 and
  gives displacement **0 px**, the same as at the 36 px floor. Row 4's recording gives 518.4 px at
  trail floor 0 and 180.3 px at 36 (`artifacts/P-02/fix1/exit-rescore-trail-floor.txt`). B0 only
  removes the tail artefact from the scale-1 displacement. The scale-0 moved FAIL holds without it.

**Flip check (W0-04 evidence shape, not a P-02 criterion).** The HEAD PERF APK `3f3afaa8` (with the
W0-04 reduce-motion fix) at read-back `0 0 0`, blocked: **PASS, 2735 board px > 28** (re-scored from the 12 px run)
(`artifacts/P-02/stageE/E-head-scale0-flip-check.json`). The static equivalent is drawn, so the gate
flips as the brief predicts. This is why the non-rendering control is the base APK (B0) and never
scale 0 on a current build.

**First validation attempt (superseded, kept for honesty).** It used the A ∪ B floors (blocked 0 px,
exit trail 0 px) in `artifacts/P-02/stageE/attempt1-floor0/`. Rows 1, 4 and 5 came out as above, but
**row 2 came out PASS with 6 px**, and row 4's displacement was 518.4 px, most of it from the tail
artefact. That result led to B0 (Stage D above).

<!-- capture-calibration:begin -->
```json
{
  "source": "docs/perf-capture-calibration.md (P-02, 2026-09-17, emulator-5556 fleet_floor_api31 API 31)",
  "tapHold": {
    "method": "dumpsys input RecentQueue DOWN->UP eventTime",
    "inputTapMs": [0, 0, 0, 0, 0],
    "arrowsWorkloadTapMs": [40, 36, 36, 38, 35],
    "arrowsWorkloadTapMedianMs": 36,
    "pressPreviewDelayMs": 64
  },
  "recorderFramePeriod": {
    "method": "calibrate.mjs recorder: 5 x 650 ms blocker flash at scale 1, screenrecord 720x1560",
    "medianOfMediansMs": 16.589,
    "perRecordingMedianMs": [16.589, 16.589, 16.906, 16.5, 16.733],
    "minMs": 11.334,
    "maxMs": 20.633,
    "idleBoardFramesIn2s": 1,
    "emitsFramesOnlyOnChange": true
  },
  "renderedFloors": {
    "method": "calibrate.mjs blocked-pairs / exit-recordings, sets A B B0 C n=10, base da93dcd PERF APK (A, C, B0) and its empty-board build (B); blocked B0 also on cell (31,14) and held out on (30,21) (fix round 1)",
    "tolerance": 24,
    "blocked": {
      "region": "board",
      "procedure": "screencap -p pre; input tap (35,19); sleep 0.15; screencap -p mid",
      "midPhaseDelayS": 0.15,
      "changedPixelsFloor": 28,
      "arithmetic": "max(A u B u B0(35,19) u B0(31,14))=14 + spread=14-0 -> 28; pass when changed px > 28; held out: B0(30,21)=9 fails, C(30,21)>=5144 passes"
    },
    "exit": {
      "region": "board",
      "procedure": "2 s screenrecord 720x1560, input tap on the exit-phase arrow 800 ms in, pixel-diff exitMotion",
      "recordingSize": "720x1560",
      "footprintDilatePx": 2,
      "secondFrameOffsetMs": 60,
      "trailPixelsFloor": 36,
      "changedFractionFloor": 0,
      "displacementFloorPx": 1,
      "arithmetic": "trail px: max over any frame of A u B u B0 = 18 + spread 18 -> 36; displacement (at trail floor 36): max(A u B u B0)=0 + spread 0 -> 0, raised to 1 recording px resolution; changed fraction (no-draw controls A u B only): 0 + 0 -> 0; pass when displacement > 1 and changed fraction > 0"
    },
    "menuIdle": {
      "region": "screen",
      "pillMask": "248,1790,945,270",
      "scale0UnmaskedPx": 0,
      "scale1UnmaskedPx": 10928,
      "maskedPx": 0
    }
  }
}
```
<!-- capture-calibration:end -->

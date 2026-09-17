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

### Sets A, B, C: blocked-tap screencap pairs, `board` region, n = 10 each

Procedure (`calibrate.mjs blocked-pairs`): launch, wait 2.5 s, then run in one `adb shell`:
`screencap -p pre; input tap <cell 35,19>; sleep 0.15; screencap -p mid`. `input tap` returns in
17–22 ms, and the measured gap from input end to the mid screencap is 158–188 ms. The pair is
pre vs mid.

| set | APK | scale | input | board changed px (of 4 091 040), raw | min / median / max |
|---|---|---|---|---|---|
| A idle | base | 1 | none | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 0 / 0 / 0 |
| B no-draw control | base empty board | 1 | same tap | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 0 / 0 / 0 |
| C known visible | base | 1 | same tap | 2942, 2939, 3007, 3007, 3007, 2933, 2941, 3009, 2936, 3007 | 2933 / 2974.5 / 3009 |

The same pairs on the `screen` region: A all 0; B 3122–3758 (the lost heart pip); C 6370–7259.

**`board` floor, arithmetic:** max(A ∪ B) = 0 px, spread of A ∪ B = 0 − 0 = 0 px, so
floor = 0 + 0 = **0 px (fraction 0)**. The gate passes only when **changed px > 0**. Set B's
maximum is 0, which is not > 0, so **set B does not pass**. Set C's minimum is 2933 px > 0.
**A/B and C separate.**

**`screen` region: does not separate for a blocked tap.** Floor = max(A ∪ B) + spread =
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

### Exit recordings: sets A, B, C, `board` region, n = 10 each

Screencaps are too slow for a 180 ms exit (a raw `screencap` takes 95–119 ms, `-p` 198–227 ms).
Exit therefore uses 2 s 720x1560 recordings, with the tap (`input tap` on the exit-phase arrow, head
(3,16), exit direction **up**) 800 ms in (`calibrate.mjs exit-recordings`).

The motion measure is `pixel-diff.mjs exitMotion`:

- the **footprint** is every pixel that differs between the pre frame (frame 0) and the settled last
  frame (the removed arrow), dilated by 2 recording px (OWNER-PICKED STARTING VALUE);
- **trail pixels** differ from pre and lie outside the footprint: ink where no arrow was;
- **displacement** is the trail centroid's travel along the exit direction, from the first frame with
  trail pixels to the first trail frame at least 60 ms later (OWNER-PICKED STARTING VALUE).

The first measure tried was the brief's literal one, the centroid of all changed pixels vs pre. It
does **not** separate: onset → +60 ms moved 141 px at scale 1 and 126 px at scale 0, because the
removal itself paints progressively. It is in `superseded-centroid-vs-pre/`.

| set | APK | scale | frames per recording | max changed fraction | trail px (first trail frame) | displacement px, raw | min / median / max |
|---|---|---|---|---|---|---|---|
| A idle | base | 1 | 1,1,1,1,1,2,1,1,1,1 | 0 ×10 | 0 ×10 | 0 ×10 | 0 / 0 / 0 |
| B no-draw control | base empty board | 1 | 2 ×10 (header heart only) | 0 ×10 | 0 ×10 | 0 ×10 | 0 / 0 / 0 |
| C known visible | base | 1 | 13,13,13,13,13,12,13,13,13,13 | 1.148e-3 – 1.158e-3 | 18 ×10 | 518.4, 517.8, 518.4, 517.8, 518.4, 527.1, 517.8, 518.4, 518.4, 518.4 | 517.8 / 518.4 / 527.1 |

Per-frame trail of C sample 1 (index, pts s, trail px, trail centroid y):
(1, 1.152, 18, 1063) (2, 1.169, 16, 1091) (3, 1.187, 54, 716) (4, 1.204, 126, 621)
(5, 1.221, 205, 544) (6, 1.236, 309, 535) (7, 1.252, 300, 536) (8, 1.269, 266, 533)
(9, 1.286, 67, 517) (10, 1.303, 0, –).

The 18/16 px in frames 1–2 sit near the arrow's tail, and most of the 518 px comes from them. The
dash itself (frames 3→6) travels 716 → 535, 181 px up.

**Exit floors, arithmetic:**

- trail-pixel floor: max(A ∪ B) + spread = 0 + 0 = **0 px**;
- changed-fraction floor: 0 + 0 = **0**;
- displacement floor: max(A ∪ B) + spread = 0 + 0 = 0 px, raised to the instrument resolution of
  **1 recording px** (2 device px), because a centroid shift below one pixel cannot be told from
  codec noise. The gate passes only when **displacement > 1 px**.

Set B's displacement maximum is 0, which is not > 1, so **set B does not pass**. C's minimum is
517.8 px. **A/B and C separate.**

### Kill condition

A/B and C do **not** overlap for `board`/blocked or for exit motion. Stage E is built. The instrument
**cannot** separate a blocked flash on the `screen` region (see above). No `screen`-region floor is
quoted for effect-rendered checks (ruling F03 c).

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
    "method": "calibrate.mjs blocked-pairs / exit-recordings, sets A B C n=10, base da93dcd PERF APK, scale 1",
    "tolerance": 24,
    "blocked": {
      "region": "board",
      "procedure": "screencap -p pre; input tap (35,19); sleep 0.15; screencap -p mid",
      "midPhaseDelayS": 0.15,
      "changedPixelsFloor": 0,
      "arithmetic": "max(A u B)=0 + spread(A u B)=0 -> 0; pass when changed px > 0"
    },
    "exit": {
      "region": "board",
      "procedure": "2 s screenrecord 720x1560, input tap on the exit-phase arrow 800 ms in, pixel-diff exitMotion",
      "recordingSize": "720x1560",
      "footprintDilatePx": 2,
      "secondFrameOffsetMs": 60,
      "trailPixelsFloor": 0,
      "changedFractionFloor": 0,
      "displacementFloorPx": 1,
      "arithmetic": "max(A u B)=0 + spread=0 -> 0, raised to 1 recording px resolution; pass when displacement > 1"
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

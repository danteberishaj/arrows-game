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
| `adb shell input tap` | 5 | 0.0, 0.0, 0.0, 0.0, 0.0 | yes |
| `ArrowsWorkload tap` (every scripted step in `capture.mjs`, `calibrate.mjs` and `benchmark.mjs`) | 5 | 40, 36, 36, 38, 35 (median 36) | yes |

No shorter injection is needed.

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
  }
}
```
<!-- capture-calibration:end -->

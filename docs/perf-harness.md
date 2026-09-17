# Android perf and capture harness: rules

`scripts/perf/android/benchmark.mjs` (numbers) and `scripts/perf/android/capture.mjs`
(screenshots and recordings) share one device layer, `scripts/perf/android/device.mjs`.
This page is the contract for reading anything they produce. P-02 wrote it on 2026-09-17.

## Motion settings: which variant did a run measure?

- **`transition_animation_scale` is the setting Reanimated reads.** Reanimated 4.5.1 treats
  `Settings.Global.TRANSITION_ANIMATION_SCALE == 0` as reduced motion
  (`NativeProxy.kt:324-333`). The JS side reads it **once, at module init**
  (`ReducedMotion.ts:16`), so a running process never sees a change.
- Every run therefore sets `window_animation_scale`, `transition_animation_scale` and
  `animator_duration_scale` to `--motion-scale` (0 or 1), force-stops the app, launches it, and
  records the **read-back** values, never the request. Fields in the result `environment` block
  (and in every capture `manifest.json`):
  - `windowAnimationScale`, `transitionAnimationScale`, `animatorDurationScale`: `settings get global` after the put;
  - `relaunchedAfterScaleChange: true`;
  - `appReducedMotion`: the running app's own `useReducedMotion()`;
  - `reducedMotionVariantMeasured: true` when the app reports reduced motion. If the app value is
    unavailable, the field is set when the read-back `transitionAnimationScale` is 0.
- `benchmark.mjs --motion-scale` defaults to **0**. Every number recorded before P-02 ran at 0,
  so the default path stays comparable with them. `capture.mjs --motion-scale` has **no default**.
- **The app-reported value.** PERF builds, and any build made with `EXPO_PUBLIC_CAPTURE_DIAG=1`
  (ruling F01), put the accessibility label `perf-reduced-motion-0|1` on the `App.tsx` root. They
  also log `[capture-diag] perf-reduced-motion-0|1 screen=<screen>` once per screen. The harness
  reads the logcat line of the current process first, then the label from `uiautomator dump`.
  `uiautomator dump` cannot dump a screen that animates without end ("could not get idle state"),
  for example the menu's breathing Play pill at scale 1. The logcat line exists for that case.
  - A build without either reports `"unavailable: non-PERF build"`. A PERF build made before P-02
    reports `"unavailable: PERF build without the P-02 reduced-motion label (built before P-02)"`.
  - **The harness aborts** when a boolean `appReducedMotion` disagrees with
    `transitionAnimationScale == 0`. That happens when the app process started before the scale
    change (the relaunch trap).

### Rule 1: a reduced-motion number describes the reduced-motion variant

A number measured with `appReducedMotion: true` (or `reducedMotionVariantMeasured: true`)
describes the **reduced-motion variant** of the app. That includes the **`exit` phase**, which is
then a stationary dash that only fades (`ArrowsBoardView.kt:269-271`), not the moving slither. It
may not be quoted as the shipped experience. The harness prints a warning on such runs.

### Rule 2: historical `exit` (and `blocked`) numbers are not scale-1 baselines

Every run before P-02 set all three scales to 0 and recorded none of them:

- `docs/perf-tap-forgiveness-ab-2026-09-08.md` (erratum header added);
- `docs/perf-exit-native-slither-2026-09-01.log`: its `exit` column measured the non-moving
  variant, too.

Neither is a baseline for any `--motion-scale 1` run. Re-baselining belongs to W2, W3 and W5.

## Screens

`EXPO_PUBLIC_PERF_SCREEN` = `splash | menu | game` (default `game`) picks the screen a PERF build
opens on. The benchmark records it as `benchmark.perfScreen`. The `splash` and `menu` phases are
opt-in (`--phases splash` / `--phases menu`) and need a build with the matching screen. The board
phases need `game`.

## Diagnostics that exist only to prove the instrument

- `--diagnostic-bogus-scale-keys`: `settings put` writes `<key>_p02_bogus`, so the recorded values
  show the device's real scales, not the request.
- `--diagnostic-skip-relaunch`: the app is launched at the opposite scale and not restarted after
  the change. The run must abort on the `appReducedMotion` mismatch.

Both stamp `environment.motionDiagnostic`. Never quote a number from such a run.

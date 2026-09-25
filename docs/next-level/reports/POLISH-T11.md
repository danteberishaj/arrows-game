# POLISH-T11: whole-round performance regression gate

Status: **DONE_WITH_CONCERNS**. No source file changed (measurement only); nothing is left for the controller to commit
except this report. No git state was changed.

- **No scenario REGRESSES under the brief's rule** (NEW-ALL's per-run range entirely worse than PRE's and beyond the
  null spread, on total-frame p95 or on frames > 33.3 ms per second). 19 scenario windows from 8 series; 5 runs per group, 160 counted runs.
- **The round's engine work is faster than PRE where it was aimed.** NEW-OLDFLAGS matches NEW-ALL in every one of these
  (the three new flags cost nothing there).
  - Exits: p95 13.1 -> 10.2 ms and first exit frame RenderThread 10.8 -> 8.2 ms, both beyond the null.
  - Pans at fit (`#` off): > 33.3 ms 3.6/s -> 0.08/s, beyond the null.
  - Big-board pinch, by median: > 33.3 ms 10.3/s -> 0, p95 38.0 -> 24.5 ms. The per-run ranges overlap (one or two NEW
    runs per group still reached 9-10/s). RenderThread median and frames > 16.7 ms improve beyond the null.
- **The three new animations add frames; they lose none at 60 Hz, with one exposure caveat.**
  - Retry: 24 frames per transition instead of 2. None slower than 16.7 ms, none skipped.
  - Next (PERF): 27 instead of 2. Per run, no regression.
    - Pooled, 6 of 30 NEW-ALL transitions (the 15 of NEW-ALL plus the 15 of its null) hold a frame > 33.3 ms. PRE and
      NEW-OLDFLAGS: 0 of 30 (Fisher one-sided p = 0.012).
    - Counting only frames that were on screen (not under the flat cover): 4 of 30 (p = 0.056).
    - Every one of them is an emulator compositor/GPU stall inside the 450 ms animation: dequeueBuffer 27-61 ms, GL
      issue 50 ms, RenderThread busy 42 ms, or one run stuck at 45 ms frames. The app's own UI-thread work was 14 ms at
      most.
    - PRE's Next is 2 frames long, so the same stalls rarely land in it.
  - Win entrance (PERF): 11 frames instead of 1. 3 of 167 expected frames skipped, in 1 of 30 entrances.
  - `#` press spring: 77-80 frames in the 1.3 s after the last release, where PRE draws 2-3. On this emulator most of
    them read > 16.7 ms (buffer-stuffed); 0-1 skipped.
- **The heaviest frame of a level change now usually falls under the cover.** In 17 of 30 NEW-ALL/null Next
  transitions the heaviest GL-issue frame (5.8-22.4 ms) lands at +245..+304 ms, inside the flat interval measured on 4
  recordings (about +170..+336 ms). In PRE and NEW-OLDFLAGS it is the visible swap frame (4.5-20.8 ms at +28..+135 ms).
- **Instrument caveats.**
  - From 09:43 the host load rose from ~2 to 4-7. After that, most runs of every arm sat in the emulator's swap-bound
    "slow" RenderThread mode (continuous animation reads RT ~ 16 ms, total ~ 20-30 ms, with every refresh still
    presented). Absolute numbers are therefore not comparable with POLISH-T12's fast-mode runs; the arms stayed
    interleaved.
  - Android 12's libhwui aborted the app 3 times, in two arms (PRE twice, NEW-ALL once). The affected runs were
    discarded and re-run.

## Summary table

Medians over runs (per-run min-max in brackets); P = PRE, O = NEW-OLDFLAGS, A = NEW-ALL, N = NEW-ALL again (null).
Frames are drawn / expected at 60 Hz, pooled over 5 runs. The full table below adds UI and RenderThread medians and
p95, frames > 16.7 ms per s, skipped refreshes and late episodes.

| scenario / window | frames drawn / expected (P, O, A, N) | total p95 ms: PRE / OLD / ALL / null | null spread | > 33.3 ms per s: PRE / OLD / ALL / null | null spread | verdict |
|---|---|---|---|---|---|---|
| 1 pans, # off / fit | 3886/3909, 3915/3974, 3945/3954, 4015/4034 | 36.50 (29.58-45.61) / 29.89 (29.10-30.50) / 29.56 (29.20-30.38) / 29.60 (29.18-30.42) | 1.23 | 3.61 (0.30-5.71) / 0.08 (0.00-0.08) / 0.08 (0.00-0.08) / 0.00 (0.00-2.20) | 2.20 | IMPROVES (p95: overlap; > 33: IMPROVES) |
| 1 pans, # off / open | 3436/3461, 3323/3338, 3350/3362, 3370/3420 | 30.93 (30.14-46.54) / 30.08 (23.90-30.78) / 29.87 (29.19-31.94) / 30.13 (29.47-30.57) | 1.10 | 1.12 (0.37-8.26) / 0.00 (0.00-0.61) / 0.16 (0.00-2.76) / 0.09 (0.00-1.50) | 1.50 | no regression (p95: overlap; > 33: overlap) |
| 1 pans, # off / pinch | 669/699, 438/466, 437/458, 450/479 | 31.91 (30.55-45.56) / 30.88 (21.42-31.68) / 30.22 (21.66-45.52) / 29.32 (21.55-30.99) | 9.44 | 1.30 (0.00-13.48) / 0.00 (0.00-2.00) / 0.00 (0.00-4.42) / 0.00 (0.00-0.00) | 0.00 | no regression (p95: overlap; > 33: overlap) |
| 1 pans, # on / fit | 3902/3943, 3993/3998, 3977/4002, 3981/3990 | 38.75 (23.78-47.36) / 10.74 (9.06-30.92) / 30.82 (9.03-31.53) / 30.97 (9.21-31.21) | 22.00 | 9.98 (0.00-18.35) / 0.00 (0.00-0.16) / 0.15 (0.00-0.70) / 0.00 (0.00-0.23) | 0.23 | no regression (p95: overlap; > 33: overlap) |
| 1 pans, # on / open | 3437/3474, 3287/3333, 3301/3335, 3376/3422 | 31.65 (23.94-37.43) / 31.00 (10.80-32.27) / 31.05 (10.18-33.28) / 31.34 (9.11-36.53) | 27.42 | 1.08 (0.00-6.23) / 0.38 (0.00-2.64) / 0.17 (0.00-2.94) / 0.09 (0.00-3.61) | 3.61 | no regression (p95: overlap; > 33: overlap) |
| 1 pans, # on / pinch | 668/697, 451/477, 462/483, 453/481 | 23.94 (22.99-32.81) / 23.53 (16.64-31.83) / 21.82 (21.09-21.89) / 22.22 (21.52-32.75) | 11.23 | 0.42 (0.00-0.86) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.61) | 0.61 | no regression (p95: better, inside null; > 33: overlap) |
| 2 exit burst / exit | 2095/2095, 1925/1925, 1925/1925, 1925/1925 | 13.14 (11.90-19.50) / 10.08 (9.51-12.02) / 10.19 (9.93-11.40) / 10.22 (10.00-12.00) | 2.00 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) | 0.00 | IMPROVES (p95: IMPROVES; > 33: overlap) |
| 3 blocked burst / blocked | 2565/2595, 2551/2580, 2550/2579, 2550/2580 | 21.92 (11.50-22.15) / 9.80 (9.22-22.75) / 21.93 (9.64-22.48) / 22.27 (9.28-22.75) | 13.47 | 0.10 (0.00-0.20) / 0.10 (0.00-0.10) / 0.10 (0.10-0.10) / 0.10 (0.10-0.10) | 0.00 | no regression (p95: overlap; > 33: overlap) |
| 4 Retry / 5 loss / lose | 415/415, 414/414, 414/414, 416/416 | 22.19 (22.04-22.49) / 21.53 (20.62-22.53) / 21.60 (14.94-22.72) / 21.29 (13.95-21.71) | 7.76 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) | 0.00 | no regression (p95: overlap; > 33: overlap) |
| 4 Retry / 5 loss / retry | 30/30, 30/30, 366/366, 365/365 | 14.11 (13.02-15.10) / 12.57 (11.45-13.70) / 10.27 (9.94-11.36) / 11.03 (9.85-11.49) | 1.64 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.00) | 0.00 | IMPROVES (p95: IMPROVES; > 33: overlap) |
| 4 Next / 5 win (PERF) / next | 31/31, 33/33, 398/403, 407/409 | 27.25 (25.48-32.68) / 25.58 (24.82-30.44) / 24.54 (21.10-28.84) / 25.14 (21.21-45.98) | 24.77 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-0.56) / 0.00 (0.00-4.72) | 4.72 | no regression (p95: overlap; > 33: overlap) |
| 4 Next / 5 win (PERF) / win | 15/15, 15/15, 164/167, 165/165 | 18.21 (16.43-23.18) / 17.27 (13.05-18.62) / 23.60 (13.83-30.27) / 23.88 (12.62-29.87) | 17.25 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-2.38) / 0.00 (0.00-0.00) | 0.00 | no regression (p95: overlap; > 33: overlap) |
| 6 idle after presses / hashidle | 11/11, 11/11, 396/397, 390/392 | 12.32 (9.28-16.08) / 11.63 (8.45-12.60) / 29.31 (8.96-46.29) / 28.84 (8.38-29.16) | 20.79 | 0.00 (0.00-0.00) / 0.00 (0.00-0.00) / 0.00 (0.00-26.67) / 0.00 (0.00-0.33) | 0.33 | no regression (p95: overlap; > 33: overlap) |
| 6 idle after presses / menuidle | 876/893, 862/900, 891/900, 890/898 | 28.95 (12.02-31.94) / 30.69 (15.48-71.30) / 30.02 (28.40-34.02) / 29.24 (22.12-45.11) | 22.99 | 0.00 (0.00-2.33) / 0.00 (0.00-32.00) / 0.00 (0.00-9.33) / 0.33 (0.00-7.33) | 7.33 | no regression (p95: overlap; > 33: overlap) |
| 7 big board (PERF) / fit | 3978/3988, 4054/4058, 4025/4066, 4002/4026 | 24.35 (22.42-39.96) / 20.43 (8.65-36.95) / 10.89 (9.19-28.05) / 21.56 (20.81-37.11) | 16.29 | 0.00 (0.00-17.64) / 0.00 (0.00-7.58) / 0.00 (0.00-2.96) / 0.00 (0.00-5.11) | 5.11 | no regression (p95: overlap; > 33: overlap) |
| 7 big board (PERF) / open | 3530/3536, 3485/3531, 3429/3453, 3461/3477 | 25.12 (22.97-25.54) / 22.61 (20.99-24.61) / 22.75 (13.80-24.33) / 23.57 (20.31-36.91) | 16.59 | 0.17 (0.08-0.88) / 0.17 (0.08-0.36) / 0.08 (0.00-0.09) / 0.09 (0.00-5.36) | 5.36 | no regression (p95: overlap; > 33: overlap) |
| 7 big board (PERF) / pinch | 689/721, 533/579, 536/577, 524/570 | 37.98 (37.55-42.07) / 25.26 (23.54-37.72) / 24.50 (21.65-36.95) / 24.94 (23.44-37.45) | 14.01 | 10.29 (5.11-13.51) / 0.00 (0.00-8.87) / 0.00 (0.00-9.56) / 0.00 (0.00-9.27) | 9.27 | no regression (p95: better, inside null; > 33: overlap) |
| 7 big board (PERF) / zoomin | 242/278, 256/278, 257/279, 257/278 | 47.97 (29.33-60.02) / 36.69 (27.32-55.28) / 31.49 (26.94-55.78) / 35.74 (25.60-53.29) | 27.69 | 15.00 (0.00-15.27) / 4.36 (0.00-11.79) / 2.18 (2.11-6.43) / 3.27 (0.00-22.91) | 22.91 | no regression (p95: overlap; > 33: overlap) |
| 7 big board (PERF) / exit | 1946/1951, 1945/1950, 1946/1950, 1943/1950 | 14.77 (12.28-21.97) / 19.39 (12.41-20.42) / 13.66 (9.60-20.98) / 13.34 (9.87-20.48) | 10.61 | 0.00 (0.00-0.52) / 0.00 (0.00-0.11) / 0.00 (0.00-0.44) / 0.00 (0.00-0.59) | 0.59 | no regression (p95: overlap; > 33: overlap) |

## Verdict per scenario

| # | scenario | verdict | one-line reason (details below) |
|---|---|---|---|
| 1 | pans / fling / pinch, `#` off and on | **PASS (no regression; better on several metrics)** | Every window overlaps or IMPROVES; at fit (`#` off) frames > 33.3 ms 3.61/s -> 0.08/s. O = A everywhere. |
| 2 | exit burst | **PASS (IMPROVES)** | p95 13.14 -> 10.19 ms (null 2.00), RT p95 11.05 -> 7.90; 0 frames > 33.3 ms in every arm; counts exact. |
| 3 | blocked-tap burst | **PASS on > 33.3 ms and skipped refreshes; p95 UNEVALUABLE** | 1 frame > 33.3 ms per run in every arm (the first charged tap). 0.6 skipped refreshes/s in every arm. p95 is set by the run's pipeline state: null spread 13.5 ms. |
| 4a | Retry (level 1) | **PASS** | 24 frames vs 2; none > 16.7 ms, none skipped. The p95 "IMPROVES" only reflects more cheap frames in the sample. |
| 4b | Next (PERF 3827->3830) | **PASS by the rule; exposure concern** | Per-run ranges overlap (> 33.3 ms: A 0-0.56/s vs P 0/s). Pooled 6/30 vs 0/30 transitions with a frame > 33.3 ms (4/30 on screen): emulator stalls inside the new animation. |
| 5a | win-panel entrance (PERF) | **PASS** | 11 frames vs 1; 1/30 entrances had a GPU-completion stall (68 + 70 ms). p95 23.6 vs 18.2 ms, overlapping (null spread 17.3). |
| 5b | loss-panel entrance | **PASS** | All arms draw every refresh through the window anyway (28 frames): 0 frames > 33.3 ms, 0 skipped. |
| 6 | idle after 10 presses | **PASS by the rule; energy cost** | `#`: 79 idle frames vs 2 (the spring tail, 1.3 s), most buffer-stuffed; ranges overlap. Menu: every arm draws ~178/180 (breathing pill + banner). |
| 7 | big board 3827 (PERF) | **PASS (better by median)** | Pinch > 33.3 ms 10.3/s -> 0 and p95 38.0 -> 24.5 (ranges overlap); zoom-in p95 48.0 -> 31.5; RT median improves beyond the null at zoom and at fit; exits equal (1946/1951 frames). No 7-strip regression. |

## Flag recommendation

- **No flag needs to stay OFF on this evidence.** Nothing regresses under the brief's rule, and NEW-OLDFLAGS equals
  NEW-ALL wherever the three flags are not on screen.
- Two costs are real and belong to specific flags. They are the owner's call, and the phone is the decisive check
  (UNVERIFIED-DEVICE):
  1. **`META_LEVEL_TRANSITION`** puts ~450 ms of animation into every Next and Retry. On this loaded emulator, 4 of 30
     PERF Next transitions showed a visible stall frame, against 0 of 30 without the flag. The stalls are host-side
     (compositor/GPU), not app work, and a phone may never show them. My recommendation: keep it ON. Re-check the
     rate on a physical Android phone before release. If a phone shows the same rate, the flag is the one to turn OFF.
  2. **`META_PRESS_SPRING`**: each burst of presses leaves 77-80 frames of spring tail. T9 reports the last ~1 s of it
     as sub-pixel. No fps is lost (0-1 skipped refresh per burst), so it does not qualify as a regression. Trimming the
     invisible tail (Reanimated `energyThreshold`) is the ruling T9 left open. I did not change it: it is a picked
     number, and nothing here qualifies it as a "fix for a measured regression".

## Arms and builds (EXECUTED; `artifacts/POLISH-T11/builds/`, `scripts/build.sh`, `scripts/build-pre-scratch.sh`)

| arm | APK | sha256 | how |
|---|---|---|---|
| PRE (test ads) | `artifacts/test-build-2026-09-24/arrows-testads-179efd0.apk` | `e9bb8fc0…` | given |
| NEW-OLDFLAGS (test ads) | `artifacts/POLISH-T11/apk/t11-oldflags.apk` | `f47e0b60…` | gradle, NEW-ALL's recipe minus the 3 flags |
| NEW-ALL (test ads) | `artifacts/POLISH-T12/arrows-testads-T12.apk` | `c21e73b8…` | given; installed now |
| PRE-PERF | `artifacts/POLISH-T11/apk/t11-perf-pre.apk` | `06b782cb…` | gradle in a scratch copy of 179efd0 |
| NEW-OLDFLAGS-PERF | `artifacts/POLISH-T11/apk/t11-perf-old.apk` | `02d70edb…` | gradle, repo |
| NEW-ALL-PERF | `artifacts/POLISH-T11/apk/t11-perf-all.apk` | `53240f59…` | gradle, repo |

- **The recipe reproduces NEW-ALL byte for byte.** `build.sh all` (the POLISH-T12 recipe: incremental arm64
  `assembleRelease` in the repo's `android/`, Metro cache cleared with 0 dirs left, `:app:createBundleReleaseJsAndAssets
  --rerun`) produced sha256 `c21e73b8…ea8a`, identical to `arrows-testads-T12.apk`. That copy was deleted as a duplicate.
- **NEW-OLDFLAGS** is the same recipe with `EXPO_PUBLIC_META_PRESS_SPRING`, `META_LEVEL_TRANSITION` and
  `META_PANEL_MOTION` unset. Compared with NEW-ALL, only `assets/index.android.bundle` differs (zip CRC of every entry).
  Its flags are proven OFF by behaviour: after `#` presses it draws 2 idle frames (NEW-ALL 79), and its Retry and Next
  draw 2 frames (NEW-ALL 24-27).
- **PERF builds** are the arm's flag set **minus `META_ZOOMED_CAMERA`**, plus `EXPO_PUBLIC_PERF_LEVEL=3827` and
  `PERF_FEEDBACK=1`. The harness assumes the fit camera (`src/featureFlags.ts`, `soak-utils cellCenterForBoard`), and the
  solve taps need it. `PERF_EXIT_DURATION_MS` is left unset, so exits run their real (unpinned) durations.
- **PRE-PERF was built in a scratch copy, never a checkout.** Steps:
  - `git archive 179efd0 | tar -x` into `scratchpad/t11/pre179`;
  - `node_modules` cloned from the repo with `cp -cR` (APFS clone), with every `node_modules/*/android/{build,.cxx}`
    removed from the clone (CMake caches hold absolute paths);
  - `credentials` is a **symlink** to the repo's directory (nothing copied), so gradle signs with the same upload key;
  - `npx expo prebuild --platform android --clean --no-install` produced an `android/` identical to the repo's
    (`diff -rq`, build dirs excluded: no difference);
  - full gradle build, 3 m 15 s.
  - Its native code equals PRE's: `.text`/`.rodata` are byte-identical for libappmodules, libexpo-modules-core,
    libgesturehandler, libreanimated, libworklets and the codegen libs. `librnskia` differs only by the `__FILE__` build
    path baked into three log strings (`builds/pre-perf-native-equivalence.txt`). INFERRED: no runtime effect.
  - The scratch `android/app/build` was deleted afterwards (my own files, to get back above 5 GB).
- **Every APK:** versionCode 6, signer SHA-256 `24f7fa0b…` (so `adb install -r` keeps app data between arms; no
  uninstall happened). Bundle proof before every install (`builds/bundle-proof-*.txt`): Google TestIds present, 0 owner
  units (`ca-app-pub-9813131856455133`, 6706292920, 7549521178, 3505414519, 5508761320) in ASCII and UTF-16LE.
- `df -h /` right before each build: 6.6, 6.4, 6.4, 6.3, 6.6 GiB. One build ran at a time.
- 4 APKs of my own are kept (`artifacts/POLISH-T11/apk/`).

## Method

### Device, schedule, null
- Every number: **emulator-5556** (AVD `fleet_floor_api31`, API 31 userdebug, 1440x3120, 60 Hz). Scales 1/1/1 (read
  back in every run log), Daylight, level 1 at the zoomed opening camera unless stated. iOS, web and phones: not run.
- **Arms per scenario:** PRE (P), NEW-OLDFLAGS (O), NEW-ALL (A), and NEW-ALL again as the same-APK null (N).
  5 rounds, rotating order (`series.sh`: P O A N | O A N P | A N P O | N P O A | N A O P), so 5 runs per group and 20 per
  scenario. Every run is `adb install -r` + a cold relaunch; the run log records file and installed sha256 and host and
  device load.
- **Verdict rule (the brief's):** REGRESSES when NEW-ALL's per-run range is entirely worse than PRE's **and** the
  difference of medians exceeds the null spread, on total-frame p95 or on frames > 33.3 ms per second. The null spread
  is max(range of the N runs, |median A - median N|) (POLISH-T12's "same-APK per-run spread"). The same test between A
  and O attributes a difference to the three flags or to the round's engine work. `t11an.py` computes it; `summary.py`
  prints it.

### Frames (`scripts/t11an.py`)
- HWUI `dumpsys gfxinfo framestats`, one row per IntendedVsync, Flags = 0 (as POLISH-T10/T12).
  - UI = SyncStart - IntendedVsync; RT = FrameCompleted - SyncStart; total = FrameCompleted - IntendedVsync.
  - Flagged rows are counted and excluded. In Retry/Next they are one `SkippedFrame` (flag 8) at the very end of the
    uncover (+405-480 ms), where nothing changed.
- **Event windows:** gfxinfo reset 150 ms before the event, framestats read at a fixed time after the injected UP, on
  the device clock (`t11lib waitUntil`). The tool's app_process exits ~0.85 s after its UP; a host-side sleep would have
  dumped late and let HWUI's 120-row history drop a window's first frames. No window was truncated (`trunc` 0
  everywhere).
- **Reconciliation:** expected frames at 60 Hz = contiguous runs (vsync gaps < 100 ms): span / 16.67 + 1, + 1 per
  isolated frame (POLISH-T12). "dropped" = expected - drawn inside contiguous drawing, i.e. the fps loss itself.
- **Rates** are per second of window (windows x window length; for gestures, the drawn span).
- **Late episodes:** frames > 16.7 ms whose predecessor was on time, i.e. where a buffer-stuffed run starts (next
  section).
- **Slow-frame attribution** (`scripts/slowframes.py`): every frame > 33.3 ms is split into HWUI's own phases
  (late start, UI thread, RenderThread sync wait, GL issue, dequeueBuffer, swap-to-completion) and labelled by its
  largest part.

### Drivers (`artifacts/POLISH-T11/scripts/`; every adb call pinned to emulator-5556)
| scenario | driver | windows |
|---|---|---|
| 1 pans / fling / pinch, `#` off and on | `panlevel11.mjs` = POLISH-T12 `panlevel.mjs`, plus an optional `#` press after "60 left" | 6 pans at the opening camera, pinch to fit + 2 pinch cycles, 6 pans at fit; one gfxinfo file per gesture |
| 2 exit burst | POLISH-T10 `pace.mjs`, unchanged | 27 solve-order exits, [UP, UP + 1000 ms] |
| 3 blocked burst | `s3blocked.mjs` | remove free arrow 24, then 10 blocked taps alternating (874,2091)/(360,2091): 2 charged (heart, flash, bump, missed mark), 8 ledger repeats; [UP, UP + 1000] |
| 4 Retry + 5 loss entrance | `s4retry.mjs` | 3 cycles: arrow 24, 3 blocked taps (lose panel), Retry. Loss entrance [UP + 640, UP + 1100] of the lethal tap (the panel mounts at +690); Retry [UP, UP + 1200]. Retry is found by its node; "Continue" is never tapped. |
| 4 Next + 5 win entrance | `s4next.mjs` (PERF) | levels 3827 -> 3828 -> 3829 -> 3830 solved with the soak plan (`plan-perf.ts`, `Board.findHint` order) at fit. Win entrance [UP + 440, UP + 720] of the clearing tap (mount ~+485, 180 ms entrance, first star at mount + 250); Next [UP, UP + 1200]. |
| 6 idle after presses | `s6idle.mjs` | game: 10 `#` presses (DOWN, 120 ms, UP, 480 ms), then [last UP, + 3000]. Menu: 10 Play presses that slide off (no navigation), then [last UP, + 3000]. |
| 7 big board | `s7big.mjs` (PERF) | level 3827: harness zoomIn pinch (to 3.5x fit), 6 pans, pinch to fit + 2 cycles, 6 pans at fit, 27 solve-order exits at fit |

Why Next, the win panel and scenario 7 use PERF builds:
- A win in a test-ads build persists `currentLevel + 1`. The arms share app data (`install -r`), so every win would move
  the next arm to a different level.
- PERF builds persist nothing and never ask for an ad. Next still runs through the W2-04 scrim when
  `META_LEVEL_TRANSITION` is on (`GameScreen.onNextLevel`).
- Retry and the loss panel stay on the test-ads builds (a loss changes no level).

## Scenario details (EXECUTED unless marked; tables: `artifacts/POLISH-T11/<scenario>/t11an*.md`, per mode: `permode.md`)

### 1. Pans / fling / pinch, `#` off and on (`s1-pan-off/`, `s1-pan-on/`)
- **`#` state.** `#` toggles the session-only grid lines (`src/ui/gridLinesSession.ts`), which are OFF after every cold
  start. The ON runs press it once after "60 left": `# pressed at 1307,2819` in 20/20 logs. Lines are visible in the
  screenshots: `s1-pan-on/grid-state-check.png` shows OFF | PRE ON | NEW-ALL ON.
- **No window regresses**, and NEW is better than PRE on most metrics. At fit with `#` off, frames > 33.3 ms go from
  3.61/s (PRE) to 0.08/s (NEW-ALL), beyond the null.
- **Mode:** every `#`-off run was swap-bound ("slow"). The `#`-on runs mixed both modes, so their p95 null spreads are
  11-27 ms.
- **The pinch phase draws fewer frames in NEW:** 437-462 against 668-669 over the same gestures. INFERRED: POLISH-T7
  stopped the idle feedback canvas from redrawing on camera frames, so NEW stops drawing sooner after each pinch.
  Skipped refreshes inside drawing are the same (PRE 2.55/s, NEW-ALL 2.61/s; `#` on: 1.75 against 1.98).

### 2. Exit burst (`s2-exit/`; `paceab11.py` = POLISH-T12 `paceab12.py` with this task's arm letters)
- **Counts reconcile exactly:** PRE 2095/2095 (15.52 frames per exit); NEW 1925/1925 (14.26 per exit: POLISH-T12's
  merged first frame).
- **p95 IMPROVES:** 13.14 -> 10.19 ms (null spread 2.00). RenderThread p95 11.05 -> 7.90.
- **0 frames > 33.3 ms** in any arm.
- **First exit frame:** RenderThread median 10.76 ms (PRE) -> 8.24 (NEW-ALL) and 8.35 (NEW-OLDFLAGS). It missed its
  vsync in 5/135 (PRE) against 1/135.
  - Cross-check with POLISH-T12: its BASE read 10.54-11.22 and its shipped build 8.10-8.62. PRE here reads 10.38-11.12
    and NEW 8.00-8.68.
- Every run was in fast mode (the host load was still 1.3-3.3).

### 3. Blocked-tap burst (`s3-blocked/`)
- **Frames and gaps:** 2550-2565 drawn of 2579-2595 expected in every arm, i.e. 0.6 skipped refreshes per second in
  every arm. For ~5 s after a charged blocked tap, every arm draws on every refresh.
- **Frames > 33.3 ms:** one per run in every arm (0.10/s): the first charged tap's frame (PRE 32.9-45.5 ms, NEW 34-43).
  Attribution (`slowframes.md`): late start or UI thread, in every arm alike.
- **p95 is UNEVALUABLE.** It is set by whether the run's pipeline stayed buffer-stuffed after that frame:
  - frames > 16.7 ms per run: PRE 1, 178, 200, 137, 159; NEW-OLDFLAGS 1, 340, 1, 1, 339; NEW-ALL 340, 298, 1, 1, 298;
    null 298, 1, 339, 298, 1;
  - so the null spread is 13.5 ms.
  - Fast-mode runs only (`permode.md`): NEW-ALL 9.64-9.70 ms, NEW-OLDFLAGS 9.22-9.80, null 9.28-9.92. PRE's only fully
    fast run read 11.50 ms.
- **The first block was discarded** (`s3-blocked-sfcrash/`). It captured SurfaceFlinger present times too, and libhwui
  aborted the app in 2 of its 6 runs (PRE P1, NEW-ALL A2; see Instrument). The counted block (20 runs) ran without that
  capture and had no abort.

### 4a. Retry (`s4-retry/`, level 1, test ads)
| arm | frames per Retry (median) | longest frame per Retry: median (max) | frames > 16.7 ms | skipped refreshes |
|---|---|---|---|---|
| PRE | 2 | 13.2 (15.1) ms | 0 | 0 |
| NEW-OLDFLAGS | 2 | 11.5 (13.7) | 0 | 0 |
| NEW-ALL | 24 | 12.5 (16.1) | 0 | 0 |
| null | 24 | 12.8 (13.8) | 0 | 0 |
- p95 reads "IMPROVES" (14.11 -> 10.27 ms), but that is a composition effect: 22 cheap scrim frames join a sample of
  2 swap frames. It is not claimed as an improvement.
- One flag-8 (`SkippedFrame`) row per Retry closes the uncover (+405-425 ms). HWUI skipped a frame with nothing to
  draw; it is not a hitch.

### 4b. Next (`s4-next/`, PERF: 3827 -> 3828 -> 3829 -> 3830, 3 per run, 15 per group)
| arm | frames per Next | longest frame: median (max) | transitions with a frame > 33.3 ms | ... on screen (not flat) | skipped refreshes |
|---|---|---|---|---|---|
| PRE | 2 | 26.2 (32.7) ms | 0/15 | 0/15 | 0 |
| NEW-OLDFLAGS | 2 | 24.7 (30.4) | 0/15 | 0/15 | 0 |
| NEW-ALL | 27 | 25.2 (73.7) | 2/15 | 2/15 | 5 |
| null | 27 | 22.3 (57.2) | 4/15 | 2/15 | 2 |
- **By the rule: no regression.** p95 24.54 (21.10-28.84) against 27.25 (25.48-32.68); > 33.3 ms per s 0 (0-0.56)
  against 0 (0-0).
- **Pooled: 6/30 against 0/30** transitions with a frame > 33.3 ms (Fisher one-sided p = 0.012); **4/30 on screen**
  (p = 0.056).
- **Attribution of every frame > 33.3 ms** (`s4-next/slowframes.md`, HWUI framestats phases):
  - A2 next2 +311 ms: dequeueBuffer 60.8 ms, a compositor stall. Flat screen.
  - A2 next2 +327 ms: knock-on (the frame started 50 ms late). On screen: the first uncover frame.
  - A3 next3 +28 ms: GL issue 49.8 ms. On screen: the cover had just started. +45 ms: knock-on.
  - N1 next1 +262..+445 ms: a run whose pipeline sat at ~45 ms per frame (RenderThread sync wait ~16 ms every frame).
    4 of its frames were flat, 8 on screen.
  - N1 next2 +242 ms: 33.4 ms, mostly dequeue (18.9 ms). Flat.
  - N1 next3 +382..+448 ms: RenderThread busy 42 ms, then knock-on. On screen.
  - N3 next2 +203 ms: dequeueBuffer 26.6 ms. Flat.
  - The UI-thread part never exceeded 14 ms.
- **The new board's raster moves under the cover** (largest GL-issue frame per transition):
  - NEW-ALL/null: in 17 of 30 transitions it is 5.8-22.4 ms at +245..+304 ms, inside the flat interval. In the other
    13 it is a cover frame (+1..+157 ms, 6.5-15.9 ms), plus the one 49.8 ms stall.
  - PRE/NEW-OLDFLAGS: 4.5-20.8 ms at +28..+135 ms, the visible swap.
- **W2-04's "+1 surface interval while covered" was not reproduced here.** The HWUI frames are contiguous through the
  covered hold (398/403 and 407/409; the missing ones are the stalls above). That measurement was SurfaceFlinger-based
  on a PERF soak; this one is HWUI-based.

### 5a. Win-panel entrance (`s4-next/`, window [UP + 440, UP + 720] of the clearing tap)
- **Frames per entrance:** PRE and NEW-OLDFLAGS draw 1 (the panel pops in). NEW-ALL and the null draw 11 (the 180 ms
  entrance).
- **Drawn / expected:** 164/167 (NEW-ALL) and 165/165 (null). The 3 missing frames are one event, A1 win1 +525 ms: a
  68 ms frame whose GPU completion took 53 ms, then a 70 ms knock-on frame.
- **By the rule: no regression.** p95 23.60 (13.83-30.27) against 18.21 (16.43-23.18), null spread 17.25; > 33.3 ms
  0 (0-2.38) against 0.
- **Window correction (disclosed).** The first analysis used [400, 780]. That window also held the ~100 ms idle gap
  between the end of the entrance (~+650) and the first star (mount + 250 ms, ~+750). The "< 100 ms gap = dropped"
  reconciliation counted that gap as 13 dropped frames per second in every NEW-ALL run.
  - The gap analysis shows the entrance itself complete in 28/30 entrances (11/11 or 12/12 frames).
  - [440, 720] holds only mount + entrance. `skipped refreshes (1-2 gaps)` is reported next to `dropped` in every
    table for the same reason.

### 5b. Loss-panel entrance (`s4-retry/`, window [UP + 640, UP + 1100] of the lethal tap)
- Every arm draws on every refresh through the window: 28 frames, 414-416 of 414-416 expected. The blocked flash and
  heart feedback of the lethal tap are still running when the panel mounts at +690.
- 0 frames > 33.3 ms and 0 skipped in every arm. p95 22.19 (PRE, 5/5 runs stuffed) against 21.60 (NEW-ALL). So the
  260 ms entrance adds work to frames that were drawn anyway.

### 6. Idle after presses (`s6-idle/`)
- **Game, 10 `#` presses, then 3 s:**
  - Frames drawn: PRE 2-3 and NEW-OLDFLAGS 2-3, all within 55 ms of the last release. NEW-ALL 79, 80, 79, 79, 79; null
    79, 77, 78, 79, 77. They end 1.30-1.33 s after the release: META_PRESS_SPRING's settle tail, as T9 measured
    (75 frames).
  - Those tail frames exceeded 16.7 ms in 4/5 NEW-ALL runs (50-80 of them) and 4/5 null runs: the pipeline was
    buffer-stuffed. At most 1 refresh was skipped per run.
  - In A2 they read 45-64 ms. The host load was 7.0 then; the session's peak, 11.7, came two runs earlier.
- **Menu, 10 Play presses that slide off, then 3 s:** every arm draws ~178/180 frames (the breathing pill plus the
  banner ad view). No difference: skipped 1.00 (PRE) against 0.67/s.
  - Every end screenshot shows the Play pill (`#6D4AEF` at 330,1925): 20/20 runs stayed on the menu.
  - uiautomator cannot dump the animating menu (P-02). Play is the fixed POLISH-T10/T12 point.
- **P5 was re-run** because its first menu part hit the libhwui abort (`s6-idle/aborted-P5/`).

### 7. Big board, level 3827 (`s7-big/`, PERF, harness zoomIn gesture from fit; screenshots `perf-shots-sheet.png`: zoomed, fit, win panel NEW-ALL, win panel PRE, all Daylight)
- **Pinch** (every frame re-rasterises; 7 strips in NEW), medians: frames > 33.3 ms 10.29/s (PRE) -> 0 (NEW-ALL,
  NEW-OLDFLAGS and the null alike). The per-run ranges overlap: 5.11-13.51 against 0-9.56. p95 37.98 -> 24.50. UI p95
  21.3 -> 8.8. frames > 16.7 ms per s: 45.0 -> 18.6, beyond the null. Skipped refreshes: PRE 1.99, NEW-ALL 2.65,
  NEW-OLDFLAGS 2.11, null 2.11 (overlap).
  - With the looser "< 100 ms gap" count, NEW-OLDFLAGS and the null read 4.7/s against PRE 2.6/s, with non-overlapping
    ranges. The extra gaps are 5-refresh (~100 ms) pauses at gesture ends: the frames on either side are fast, and the
    next frame starts on time. PRE fills those pauses with extra frames. This is not jank.
- **Zoom-in:** p95 47.97 -> 31.49; drawn/expected 242/278 -> 257/279.
- **Pans at zoom:** RenderThread median 15.94 -> 8.48. **Pans at fit:** p95 24.35 -> 10.89 (ranges overlap).
- **Exits (27 at fit):** 1946/1951 against 1946/1950; p95 14.77 against 13.66; RenderThread median 6.75 -> 4.30.
- POLISH-T12's concern (7 strips, 14 draws on big boards) is not seen as a regression in any metric.

## Flat-screen frames (the W2-04 cover) (EXECUTED; `fcap/`, `scripts/fcap.mjs`, `scripts/flatcap.py`)
- **Captures:** 2 NEW-ALL-PERF Next (3827 -> 3828) and 2 NEW-ALL test-ads Retry. Each is `screenrecord --bugreport` at
  720x1560, with the same gfxinfo window plus SurfaceFlinger present times.
- **Clock alignment:** each recording's pts -> wall-clock offset was read from the overlay clock on 3 frames per
  recording; the three readings agree within 0.4-1.0 ms (`fcap/overlay-offsets.txt`). T10Input's (upMs, upWallMs) pair
  maps uptime onto the same wall clock.
- **Flat frame** = W2-04's AC4 definition: every app-window pixel within 24 of `#FFFFFF`, at most 28 deviating pixels.
- **Which HWUI frames were flat:** each HWUI frame was matched to its SurfaceFlinger present (n-th to n-th; the counts
  match) and to the recording frame on screen then.

| capture | recorded flat interval (after UP) | HWUI frames drawn while flat (IntendedVsync) | frames in the transition |
|---|---|---|---|
| Next 1 | +206 .. +337 ms | 9 (+183 .. +317) | 28 |
| Next 2 | +190 .. +374 ms | 11 (+169 .. +336) | 30 |
| Retry 1 | +210 .. +349 ms | 9 (+164 .. +297) | 28 |
| Retry 2 | +214 .. +317 ms | 7 (+177 .. +277) | 28 |

- About a third of NEW-ALL's transition frames are drawn under a fully flat screen. The rest are the visible cover and
  uncover.
- **The Next slow frames were classified with the Next interval [+183, +317]:** 7 of the 22 frames > 33.3 ms were
  "invisible (flat screen)" (A2 +311, N1 +262..+312, N1 +242, N3 +203); 15 were on screen.
- Under screenrecord the emulator stuffs deeper (capture load: 34-43 ms frames in 2 of the 4 captures). The captures
  classify frames; they are not used for frame metrics.

## Instrument notes
- **The emulator's pipeline modes.**
  - When the app animates continuously and one frame misses its deadline, this API 31 emulator often stays
    buffer-stuffed. Every later frame reads RT ~15-16 ms and total ~20-30 ms, while SurfaceFlinger still presents one
    buffer per refresh with +1 refresh of latency.
  - The smoke captures (taken before SF capture was turned off) show it directly. A NEW-ALL lose window: 100 present
    intervals of 12-20 ms and one of 33.2 ms where the stuffing began. A NEW-ALL-PERF Next: 25 intervals of 14-18 ms
    and one of 31.6 ms. The desired-to-present latency in both was ~29 ms against ~13 ms unstuffed.
  - So "frames > 16.7 ms" mostly counts stuffed frames, not dropped ones. `late episodes` (where stuffing starts),
    `skipped refreshes` and `frames > 33.3 ms` are the jank measures; all are in the full table.
  - From ~09:43 the host load was 4-7 (was 1-3). Most later runs of every arm were in this mode. S1's RenderThread
    medians are 3-4x POLISH-T12's (fast mode); comparisons stay within interleaved series.
- **libhwui aborts** (`crash-buffer.txt`), all Android 12 JankTracker assertions in `com.danteb.arrows`:
  - 08:58:31 PRE and 09:01:47 NEW-ALL, both `Impossible totalDuration 0 ... gpuComplete=-1`. Both were in the first
    S3 block, which also cleared and read SurfaceFlinger latency around every window (2 of 6 runs).
  - 09:58:06 PRE, `Impossible dequeue duration ... total duration 0`. S6 menu, at a gfxinfo reset during continuous
    drawing, without SF capture.
  - INFERRED: the platform's JankTracker races with the harness's resets/clears on this emulator. Two of the three
    were PRE, so it is not a NEW-ALL defect. The 20-run S2 (idle between windows) had none.
  - After them, SF capture was made opt-in (captures only), and every scripted input first checks that the app holds
    window focus (`t11lib guard()`).
- **Stray input (disclosed).**
  - After the 08:58 and 09:01 aborts, the remaining taps of those two runs landed on the launcher and opened Google
    Photos, which showed an "Update Google Photos app" dialog. Nothing in it was tapped by intent. It was
    force-stopped at the end.
  - The focus guard later refused input once (S6 P5, 09:58), as designed.
- **Two post-pan chains ran at once for ~15 s at 10:59.** A detached waiter I believed dead was alive. Both were
  killed. The affected S6 P5 attempts and one PERF run were moved to `aborted/` and `s6-idle/aborted-P5/`, and every
  counted run was re-run cleanly. No counted file contains data from the overlap.
- **Retry "Continue" was never tapped.** The script checks Retry's node and aborts if its centre lies in Continue's
  bounds; it never aborted. No interstitial or rewarded ad was shown: test-ads Next was never pressed, and PERF builds
  never ask. The menu's test banner was on screen during scenario 6 and was never touched; the slide-off presses end
  725 px above it.

## Full table (every metric; `artifacts/POLISH-T11/summary-all.md`, generated by `scripts/summary.py`)
Per arm: median over runs (per-run min-max). "null spread" = max(range of the null runs, |median A - median N|).
Verdict = the brief's rule; "A vs O" = the same rule between NEW-ALL and NEW-OLDFLAGS.

| scenario / window | metric | PRE | NEW-OLDFLAGS | NEW-ALL | null (NEW-ALL again) | null spread | A - P | verdict (A vs P) | A vs O |
|---|---|---|---|---|---|---|---|---|---|
| **s1-pan-off / fit** | frames / expected (pooled) | P 3886/3909 / O 3915/3974 / A 3945/3954 / N 4015/4034 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 36.50 (29.58-45.61) | 29.89 (29.10-30.50) | 29.56 (29.20-30.38) | 29.60 (29.18-30.42) | 1.23 | -6.93 | overlap | O~A |
| | > 33.3 ms per s | 3.61 (0.30-5.71) | 0.08 (0.00-0.08) | 0.08 (0.00-0.08) | 0.00 (0.00-2.20) | 2.20 | -3.53 | IMPROVES | O~A |
| | > 16.7 ms per s | 52.01 (43.84-56.36) | 21.74 (16.62-23.95) | 18.54 (10.60-21.71) | 23.05 (13.97-34.26) | 20.29 | -33.47 | IMPROVES | O~A |
| | dropped frames per s | 0.46 (0.08-0.54) | 0.08 (0.00-4.06) | 0.15 (0.00-0.31) | 0.07 (0.00-0.66) | 0.66 | -0.31 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.46 (0.08-0.54) | 0.08 (0.00-4.06) | 0.15 (0.00-0.31) | 0.07 (0.00-0.37) | 0.37 | -0.31 | overlap | O~A |
| | late episodes per s | 0.99 (0.53-1.01) | 0.83 (0.30-1.06) | 0.38 (0.30-1.15) | 0.52 (0.30-1.05) | 0.75 | -0.61 | overlap | O~A |
| | UI med | 13.09 (12.17-13.72) | 4.55 (2.73-6.10) | 4.96 (2.83-5.37) | 5.56 (2.63-10.04) | 7.41 | -8.13 | IMPROVES | O~A |
| | UI p95 | 20.31 (13.55-27.65) | 13.27 (12.45-13.86) | 12.91 (12.56-13.74) | 12.97 (12.56-13.81) | 1.25 | -7.40 | overlap | O~A |
| | RT med | 16.35 (16.27-16.39) | 11.73 (10.51-13.56) | 11.02 (10.31-13.62) | 11.88 (10.45-16.23) | 5.78 | -5.33 | better, inside null | O~A |
| | RT p95 | 19.57 (18.04-21.50) | 17.12 (16.98-17.42) | 17.05 (16.82-17.29) | 17.16 (16.90-17.27) | 0.36 | -2.52 | IMPROVES | O~A |
| **s1-pan-off / open** | frames / expected (pooled) | P 3436/3461 / O 3323/3338 / A 3350/3362 / N 3370/3420 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 30.93 (30.14-46.54) | 30.08 (23.90-30.78) | 29.87 (29.19-31.94) | 30.13 (29.47-30.57) | 1.10 | -1.06 | overlap | O~A |
| | > 33.3 ms per s | 1.12 (0.37-8.26) | 0.00 (0.00-0.61) | 0.16 (0.00-2.76) | 0.09 (0.00-1.50) | 1.50 | -0.95 | overlap | O~A |
| | > 16.7 ms per s | 53.10 (39.01-55.51) | 15.86 (3.43-31.40) | 19.20 (9.31-27.00) | 24.35 (12.40-30.21) | 17.81 | -33.90 | IMPROVES | O~A |
| | dropped frames per s | 0.34 (0.25-0.91) | 0.17 (0.00-0.79) | 0.09 (0.00-0.46) | 0.56 (0.09-1.83) | 1.74 | -0.25 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.34 (0.08-0.91) | 0.17 (0.00-0.44) | 0.09 (0.00-0.46) | 0.56 (0.09-1.83) | 1.74 | -0.25 | overlap | O~A |
| | late episodes per s | 0.76 (0.65-1.18) | 0.46 (0.28-1.40) | 0.58 (0.18-1.11) | 0.88 (0.35-1.58) | 1.23 | -0.19 | overlap | O~A |
| | UI med | 12.91 (6.36-13.44) | 4.47 (2.40-5.77) | 4.61 (2.52-6.80) | 5.28 (4.19-5.41) | 1.22 | -8.30 | overlap | O~A |
| | UI p95 | 15.70 (14.24-30.12) | 13.43 (10.78-14.12) | 13.25 (12.53-16.29) | 13.52 (12.84-13.90) | 1.07 | -2.45 | overlap | O~A |
| | RT med | 16.27 (15.81-16.35) | 12.35 (9.70-13.55) | 11.96 (10.34-12.93) | 11.64 (10.25-14.25) | 4.01 | -4.31 | IMPROVES | O~A |
| | RT p95 | 19.87 (18.15-21.56) | 17.17 (14.50-17.55) | 17.32 (16.98-17.46) | 17.26 (17.18-18.26) | 1.08 | -2.55 | IMPROVES | O~A |
| **s1-pan-off / pinch** | frames / expected (pooled) | P 669/699 / O 438/466 / A 437/458 / N 450/479 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 31.91 (30.55-45.56) | 30.88 (21.42-31.68) | 30.22 (21.66-45.52) | 29.32 (21.55-30.99) | 9.44 | -1.69 | overlap | O~A |
| | > 33.3 ms per s | 1.30 (0.00-13.48) | 0.00 (0.00-2.00) | 0.00 (0.00-4.42) | 0.00 (0.00-0.00) | 0.00 | -1.30 | overlap | O~A |
| | > 16.7 ms per s | 47.66 (34.23-51.30) | 32.84 (19.35-48.00) | 31.65 (12.39-45.47) | 27.16 (16.15-48.75) | 32.60 | -16.01 | overlap | O~A |
| | dropped frames per s | 2.55 (2.17-3.04) | 3.13 (2.53-5.87) | 2.61 (2.05-3.30) | 3.16 (2.50-5.19) | 2.69 | +0.06 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 2.55 (2.17-3.04) | 3.13 (2.53-5.87) | 2.61 (2.05-3.30) | 3.16 (2.50-5.19) | 2.69 | +0.06 | overlap | O~A |
| | late episodes per s | 2.55 (2.14-2.61) | 3.16 (2.50-4.00) | 3.79 (2.64-4.09) | 3.30 (1.73-4.38) | 2.64 | +1.24 | worse, inside null | O~A |
| | UI med | 12.37 (5.15-13.15) | 4.05 (3.24-7.77) | 4.16 (4.00-10.21) | 4.20 (3.17-11.79) | 8.62 | -8.21 | overlap | O~A |
| | UI p95 | 15.37 (14.52-29.04) | 14.17 (5.23-15.03) | 13.03 (6.06-28.87) | 12.49 (5.74-14.34) | 8.60 | -2.34 | overlap | O~A |
| | RT med | 15.93 (15.28-16.44) | 14.89 (10.40-16.47) | 14.40 (10.09-16.21) | 11.55 (10.45-16.48) | 6.03 | -1.53 | overlap | O~A |
| | RT p95 | 20.53 (18.61-21.64) | 20.72 (17.15-21.83) | 21.49 (17.39-21.90) | 18.37 (17.86-21.57) | 3.70 | +0.96 | overlap | O~A |
| **s1-pan-on / fit** | frames / expected (pooled) | P 3902/3943 / O 3993/3998 / A 3977/4002 / N 3981/3990 | modes P:fast,slow O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 38.75 (23.78-47.36) | 10.74 (9.06-30.92) | 30.82 (9.03-31.53) | 30.97 (9.21-31.21) | 22.00 | -7.94 | overlap | O~A |
| | > 33.3 ms per s | 9.98 (0.00-18.35) | 0.00 (0.00-0.16) | 0.15 (0.00-0.70) | 0.00 (0.00-0.23) | 0.23 | -9.82 | overlap | O~A |
| | > 16.7 ms per s | 42.60 (25.63-53.68) | 0.00 (0.00-30.34) | 25.45 (0.00-36.38) | 16.78 (0.00-40.71) | 40.71 | -17.15 | overlap | O~A |
| | dropped frames per s | 0.83 (0.00-1.33) | 0.00 (0.00-0.31) | 0.23 (0.00-0.86) | 0.07 (0.00-0.38) | 0.38 | -0.60 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.83 (0.00-1.10) | 0.00 (0.00-0.31) | 0.23 (0.00-0.63) | 0.07 (0.00-0.38) | 0.38 | -0.60 | overlap | O~A |
| | late episodes per s | 1.50 (0.30-1.65) | 0.00 (0.00-1.34) | 0.76 (0.00-1.88) | 0.52 (0.00-1.38) | 1.38 | -0.74 | overlap | O~A |
| | UI med | 6.04 (5.69-14.00) | 4.20 (2.40-4.53) | 4.11 (2.46-5.08) | 4.20 (2.47-5.89) | 3.42 | -1.93 | better, inside null | O~A |
| | UI p95 | 22.01 (8.84-30.87) | 7.10 (5.18-14.27) | 14.19 (4.94-14.87) | 14.34 (5.15-14.55) | 9.40 | -7.82 | overlap | O~A |
| | RT med | 16.06 (4.95-16.34) | 3.93 (3.45-13.24) | 11.62 (3.45-16.04) | 3.92 (3.48-16.34) | 12.86 | -4.44 | overlap | O~A |
| | RT p95 | 18.99 (17.95-19.47) | 5.03 (4.39-18.19) | 17.40 (4.35-18.63) | 17.31 (4.32-18.22) | 13.90 | -1.59 | overlap | O~A |
| **s1-pan-on / open** | frames / expected (pooled) | P 3437/3474 / O 3287/3333 / A 3301/3335 / N 3376/3422 | modes P:fast,slow O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 31.65 (23.94-37.43) | 31.00 (10.80-32.27) | 31.05 (10.18-33.28) | 31.34 (9.11-36.53) | 27.42 | -0.61 | overlap | O~A |
| | > 33.3 ms per s | 1.08 (0.00-6.23) | 0.38 (0.00-2.64) | 0.17 (0.00-2.94) | 0.09 (0.00-3.61) | 3.61 | -0.91 | overlap | O~A |
| | > 16.7 ms per s | 29.44 (17.42-46.50) | 24.66 (0.00-33.48) | 17.49 (0.74-44.01) | 23.28 (0.19-38.08) | 37.90 | -11.94 | overlap | O~A |
| | dropped frames per s | 0.58 (0.00-1.71) | 0.62 (0.00-1.78) | 0.44 (0.00-1.91) | 0.33 (0.00-3.25) | 3.25 | -0.15 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.58 (0.00-0.90) | 0.62 (0.00-1.78) | 0.44 (0.00-1.91) | 0.33 (0.00-3.25) | 3.25 | -0.15 | overlap | O~A |
| | late episodes per s | 0.83 (0.43-1.62) | 0.44 (0.00-1.32) | 1.31 (0.09-1.65) | 0.78 (0.08-1.33) | 1.25 | +0.48 | overlap | O~A |
| | UI med | 6.10 (4.73-13.90) | 4.39 (2.72-4.60) | 4.23 (2.41-5.48) | 4.39 (2.30-14.26) | 11.96 | -1.87 | overlap | O~A |
| | UI p95 | 15.30 (8.89-20.82) | 14.35 (5.82-15.49) | 14.39 (4.70-17.18) | 14.70 (4.50-20.18) | 15.68 | -0.90 | overlap | O~A |
| | RT med | 5.81 (4.44-16.03) | 8.32 (3.83-14.65) | 4.85 (3.94-16.31) | 8.70 (4.01-16.09) | 12.08 | -0.95 | overlap | O~A |
| | RT p95 | 17.70 (17.26-19.46) | 17.60 (5.08-18.59) | 17.46 (6.09-18.63) | 17.80 (5.70-18.21) | 12.52 | -0.24 | overlap | O~A |
| **s1-pan-on / pinch** | frames / expected (pooled) | P 668/697 / O 451/477 / A 462/483 / N 453/481 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 23.94 (22.99-32.81) | 23.53 (16.64-31.83) | 21.82 (21.09-21.89) | 22.22 (21.52-32.75) | 11.23 | -2.12 | better, inside null | O~A |
| | > 33.3 ms per s | 0.42 (0.00-0.86) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.61) | 0.61 | -0.42 | overlap | O~A |
| | > 16.7 ms per s | 40.29 (33.38-49.49) | 24.26 (3.00-34.47) | 16.30 (10.55-30.00) | 21.88 (10.69-27.10) | 16.40 | -23.98 | IMPROVES | O~A |
| | dropped frames per s | 1.75 (1.73-5.07) | 3.19 (1.91-5.57) | 1.98 (1.30-4.16) | 2.58 (2.50-5.35) | 2.85 | +0.23 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 1.75 (1.73-5.07) | 3.19 (1.91-5.57) | 1.98 (1.30-4.16) | 2.58 (2.50-5.35) | 2.85 | +0.23 | overlap | O~A |
| | late episodes per s | 2.57 (2.19-3.02) | 3.09 (1.80-3.91) | 2.40 (1.98-3.03) | 2.50 (1.94-4.29) | 2.35 | -0.17 | overlap | O~A |
| | UI med | 5.72 (4.72-6.38) | 4.64 (2.97-4.87) | 3.49 (3.20-4.41) | 4.31 (2.80-4.51) | 1.71 | -2.23 | IMPROVES | O~A |
| | UI p95 | 8.14 (7.59-16.48) | 7.04 (5.18-15.18) | 5.69 (4.84-6.35) | 6.20 (5.49-16.01) | 10.52 | -2.45 | better, inside null | O~A |
| | RT med | 15.33 (14.40-15.66) | 11.07 (10.14-15.38) | 11.11 (9.48-12.74) | 10.74 (10.15-11.28) | 1.13 | -4.22 | IMPROVES | O~A |
| | RT p95 | 18.00 (17.59-19.31) | 18.11 (13.19-21.27) | 17.56 (16.67-18.49) | 17.70 (17.61-18.36) | 0.76 | -0.44 | overlap | O~A |
| **s2-exit / exit** | frames / expected (pooled) | P 2095/2095 / O 1925/1925 / A 1925/1925 / N 1925/1925 | modes P:fast O:fast A:fast N:fast | | | | | | |
| | total p95 ms | 13.14 (11.90-19.50) | 10.08 (9.51-12.02) | 10.19 (9.93-11.40) | 10.22 (10.00-12.00) | 2.00 | -2.95 | IMPROVES | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 0.44 (0.00-0.96) | 0.00 (0.00-0.56) | 0.00 (0.00-0.56) | 0.00 (0.00-0.59) | 0.59 | -0.44 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | late episodes per s | 0.04 (0.00-0.07) | 0.00 (0.00-0.04) | 0.00 (0.00-0.04) | 0.00 (0.00-0.04) | 0.04 | -0.04 | overlap | O~A |
| | UI med | 1.72 (1.65-1.87) | 1.67 (1.60-1.72) | 1.63 (1.46-1.77) | 1.60 (1.59-1.76) | 0.18 | -0.09 | overlap | O~A |
| | UI p95 | 3.74 (3.46-4.53) | 3.89 (3.80-4.10) | 3.79 (3.48-4.15) | 3.90 (3.63-3.97) | 0.34 | +0.05 | overlap | O~A |
| | RT med | 4.44 (4.40-4.45) | 3.81 (3.76-3.85) | 3.84 (3.80-3.90) | 3.87 (3.77-3.91) | 0.14 | -0.60 | IMPROVES | O~A |
| | RT p95 | 11.05 (10.08-14.62) | 7.91 (7.69-9.12) | 7.90 (7.69-9.05) | 7.89 (7.77-9.46) | 1.68 | -3.15 | IMPROVES | O~A |
| **s3-blocked / blocked** | frames / expected (pooled) | P 2565/2595 / O 2551/2580 / A 2550/2579 / N 2550/2580 | modes P:fast O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 21.92 (11.50-22.15) | 9.80 (9.22-22.75) | 21.93 (9.64-22.48) | 22.27 (9.28-22.75) | 13.47 | +0.01 | overlap | O~A |
| | > 33.3 ms per s | 0.10 (0.00-0.20) | 0.10 (0.00-0.10) | 0.10 (0.10-0.10) | 0.10 (0.10-0.10) | 0.00 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 15.90 (0.10-20.00) | 0.10 (0.10-34.00) | 29.80 (0.10-34.00) | 29.80 (0.10-33.90) | 33.80 | +13.90 | overlap | O~A |
| | dropped frames per s | 0.60 (0.40-0.80) | 0.60 (0.40-0.70) | 0.60 (0.40-0.70) | 0.60 (0.50-0.70) | 0.20 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.60 (0.40-0.80) | 0.60 (0.40-0.70) | 0.60 (0.40-0.70) | 0.60 (0.50-0.70) | 0.20 | +0.00 | overlap | O~A |
| | late episodes per s | 0.40 (0.10-0.60) | 0.10 (0.10-0.70) | 0.60 (0.10-0.70) | 0.60 (0.10-0.70) | 0.60 | +0.20 | overlap | O~A |
| | UI med | 4.41 (4.32-4.56) | 4.36 (4.22-4.38) | 4.32 (4.26-4.34) | 4.37 (4.23-4.62) | 0.39 | -0.09 | overlap | O~A |
| | UI p95 | 6.64 (6.46-7.13) | 6.50 (6.08-7.05) | 6.56 (6.28-6.68) | 6.68 (6.21-6.98) | 0.77 | -0.09 | overlap | O~A |
| | RT med | 3.94 (3.58-4.16) | 3.13 (3.08-15.24) | 14.80 (3.11-15.29) | 14.35 (3.11-15.37) | 12.26 | +10.87 | overlap | O~A |
| | RT p95 | 17.41 (5.58-17.70) | 4.43 (4.23-18.18) | 17.76 (4.26-18.27) | 18.06 (4.10-18.39) | 14.28 | +0.35 | overlap | O~A |
| **s4-retry / lose** | frames / expected (pooled) | P 415/415 / O 414/414 / A 414/414 / N 416/416 | modes P:slow O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 22.19 (22.04-22.49) | 21.53 (20.62-22.53) | 21.60 (14.94-22.72) | 21.29 (13.95-21.71) | 7.76 | -0.59 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 60.14 (39.86-60.87) | 34.06 (19.57-40.58) | 20.29 (0.00-39.86) | 20.29 (0.00-40.58) | 40.58 | -39.86 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | late episodes per s | 2.17 (1.45-2.17) | 1.45 (0.72-1.45) | 1.45 (0.00-1.45) | 0.72 (0.00-1.45) | 1.45 | -0.72 | overlap | O~A |
| | UI med | 3.81 (3.38-3.87) | 3.15 (2.37-3.33) | 2.99 (1.86-3.44) | 3.28 (2.01-3.70) | 1.69 | -0.82 | overlap | O~A |
| | UI p95 | 6.27 (6.20-6.66) | 5.64 (4.81-6.41) | 6.16 (4.52-7.22) | 5.56 (4.94-5.76) | 0.82 | -0.12 | overlap | O~A |
| | RT med | 16.45 (15.96-16.47) | 14.68 (4.13-16.00) | 7.85 (6.19-15.82) | 8.54 (6.01-16.01) | 10.00 | -8.60 | better, inside null | O~A |
| | RT p95 | 18.62 (18.24-19.14) | 18.11 (17.47-18.84) | 18.16 (11.59-19.46) | 17.86 (12.27-18.17) | 5.90 | -0.46 | overlap | O~A |
| **s4-retry / retry** | frames / expected (pooled) | P 30/30 / O 30/30 / A 366/366 / N 365/365 | modes P:fast O:fast A:fast N:fast | | | | | | |
| | total p95 ms | 14.11 (13.02-15.10) | 12.57 (11.45-13.70) | 10.27 (9.94-11.36) | 11.03 (9.85-11.49) | 1.64 | -3.84 | IMPROVES | A better than O beyond null |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | late episodes per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | UI med | 3.03 (1.97-3.53) | 2.36 (2.06-3.23) | 1.80 (1.41-3.13) | 1.61 (1.45-3.30) | 1.85 | -1.23 | overlap | O~A |
| | UI p95 | 3.93 (2.71-4.55) | 4.16 (2.78-6.06) | 4.15 (3.65-5.39) | 3.67 (3.17-4.98) | 1.81 | +0.22 | overlap | O~A |
| | RT med | 7.44 (7.12-7.59) | 6.73 (6.52-7.20) | 4.25 (3.85-4.37) | 4.33 (3.80-4.35) | 0.54 | -3.19 | IMPROVES | A better than O beyond null |
| | RT p95 | 11.16 (10.53-12.11) | 10.01 (9.45-10.78) | 8.02 (7.43-8.19) | 7.97 (7.66-8.75) | 1.09 | -3.14 | IMPROVES | A better than O beyond null |
| **s4-next / next** | frames / expected (pooled) | P 31/31 / O 33/33 / A 398/403 / N 407/409 | modes P:slow O:slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 27.25 (25.48-32.68) | 25.58 (24.82-30.44) | 24.54 (21.10-28.84) | 25.14 (21.21-45.98) | 24.77 | -2.70 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.56) | 0.00 (0.00-4.72) | 4.72 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 1.39 (1.11-1.67) | 1.11 (0.56-1.67) | 7.22 (3.06-20.28) | 8.06 (3.06-13.33) | 10.28 | +5.83 | worse, inside null | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.83) | 0.00 (0.00-0.56) | 0.56 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.56) | 0.00 (0.00-0.56) | 0.56 | +0.00 | overlap | O~A |
| | late episodes per s | 0.56 (0.56-0.83) | 0.56 (0.28-0.83) | 0.83 (0.28-1.39) | 0.56 (0.28-1.11) | 0.83 | +0.28 | overlap | O~A |
| | UI med | 8.31 (6.80-9.79) | 4.71 (1.79-5.21) | 2.22 (1.86-5.26) | 2.60 (1.86-8.29) | 6.43 | -6.09 | better, inside null | O~A |
| | UI p95 | 10.60 (9.15-22.45) | 9.18 (5.89-15.61) | 7.87 (4.64-9.28) | 8.49 (5.49-29.16) | 23.67 | -2.73 | overlap | O~A |
| | RT med | 14.89 (9.67-16.78) | 13.22 (9.52-14.77) | 12.33 (4.98-16.23) | 8.29 (4.67-13.91) | 9.24 | -2.55 | overlap | O~A |
| | RT p95 | 20.60 (19.94-24.28) | 24.12 (18.68-24.47) | 20.69 (16.68-20.89) | 19.74 (16.23-21.35) | 5.12 | +0.09 | overlap | O~A |
| **s4-next / win** | frames / expected (pooled) | P 15/15 / O 15/15 / A 164/167 / N 165/165 | modes P:fast,slow O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 18.21 (16.43-23.18) | 17.27 (13.05-18.62) | 23.60 (13.83-30.27) | 23.88 (12.62-29.87) | 17.25 | +5.39 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-2.38) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 2.38 (0.00-2.38) | 1.19 (0.00-2.38) | 8.33 (0.00-25.00) | 13.10 (0.00-25.00) | 25.00 | +5.95 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-3.57) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 | +0.00 | overlap | O~A |
| | late episodes per s | 2.38 (0.00-2.38) | 1.19 (0.00-2.38) | 2.38 (0.00-4.76) | 2.38 (0.00-2.38) | 2.38 | +0.00 | overlap | O~A |
| | UI med | 6.99 (5.94-8.10) | 7.03 (6.14-8.52) | 2.55 (2.30-4.70) | 2.99 (2.25-5.27) | 3.02 | -4.43 | IMPROVES | A better than O beyond null |
| | UI p95 | 8.77 (7.29-10.42) | 8.02 (6.45-8.73) | 7.48 (5.51-13.00) | 8.52 (5.61-13.14) | 7.52 | -1.29 | overlap | O~A |
| | RT med | 8.82 (6.84-11.65) | 6.16 (4.76-10.87) | 7.86 (5.71-16.66) | 11.29 (5.33-14.03) | 8.70 | -0.96 | overlap | O~A |
| | RT p95 | 10.76 (9.44-15.09) | 9.92 (4.82-12.69) | 19.78 (10.08-21.67) | 20.45 (10.72-20.82) | 10.10 | +9.02 | overlap | O~A |
| **s6-idle / hashidle** | frames / expected (pooled) | P 11/11 / O 11/11 / A 396/397 / N 390/392 | modes P:fast,slow O:fast,slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 12.32 (9.28-16.08) | 11.63 (8.45-12.60) | 29.31 (8.96-46.29) | 28.84 (8.38-29.16) | 20.79 | +16.98 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-26.67) | 0.00 (0.00-0.33) | 0.33 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 16.67 (0.00-26.67) | 11.00 (0.00-17.67) | 17.67 | +16.67 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.33) | 0.00 (0.00-0.33) | 0.33 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.00 (0.00-0.33) | 0.00 (0.00-0.33) | 0.33 | +0.00 | overlap | O~A |
| | late episodes per s | 0.00 (0.00-0.00) | 0.00 (0.00-0.00) | 0.33 (0.00-0.67) | 0.33 (0.00-0.33) | 0.33 | +0.33 | overlap | O~A |
| | UI med | 3.29 (1.64-5.78) | 3.11 (3.00-3.77) | 7.47 (1.96-28.01) | 3.10 (1.89-11.34) | 9.45 | +4.18 | overlap | O~A |
| | UI p95 | 3.93 (2.49-8.36) | 4.37 (3.17-5.66) | 12.66 (3.36-29.64) | 12.20 (3.70-12.52) | 8.82 | +8.73 | overlap | O~A |
| | RT med | 8.30 (5.14-10.17) | 8.13 (4.54-8.46) | 16.09 (4.46-16.79) | 12.23 (4.19-16.06) | 11.87 | +7.79 | overlap | O~A |
| | RT p95 | 9.04 (5.64-11.08) | 8.80 (4.81-9.82) | 20.97 (7.16-21.10) | 21.24 (5.77-21.45) | 15.68 | +11.92 | overlap | O~A |
| **s6-idle / menuidle** | frames / expected (pooled) | P 876/893 / O 862/900 / A 891/900 / N 890/898 | modes P:fast,slow O:fast,slow A:slow N:slow | | | | | | |
| | total p95 ms | 28.95 (12.02-31.94) | 30.69 (15.48-71.30) | 30.02 (28.40-34.02) | 29.24 (22.12-45.11) | 22.99 | +1.07 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-2.33) | 0.00 (0.00-32.00) | 0.00 (0.00-9.33) | 0.33 (0.00-7.33) | 7.33 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 33.33 (0.00-47.00) | 44.00 (0.33-51.33) | 48.67 (39.67-53.67) | 48.67 (38.00-53.00) | 15.00 | +15.33 | overlap | O~A |
| | dropped frames per s | 1.00 (0.67-1.67) | 0.67 (0.67-9.33) | 0.67 (0.33-1.00) | 0.33 (0.33-1.00) | 0.67 | -0.33 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 1.00 (0.67-1.67) | 0.67 (0.67-6.00) | 0.67 (0.33-1.00) | 0.33 (0.33-1.00) | 0.67 | -0.33 | overlap | O~A |
| | late episodes per s | 1.00 (0.00-2.00) | 1.00 (0.33-5.67) | 0.67 (0.33-1.00) | 0.67 (0.33-1.67) | 1.33 | -0.33 | overlap | O~A |
| | UI med | 6.79 (3.12-11.60) | 11.71 (2.64-20.73) | 10.77 (4.37-12.00) | 11.33 (4.07-11.88) | 7.82 | +3.98 | overlap | O~A |
| | UI p95 | 12.34 (4.77-14.80) | 14.04 (4.28-42.24) | 13.42 (11.75-17.38) | 12.70 (5.48-28.46) | 22.98 | +1.08 | overlap | O~A |
| | RT med | 13.15 (5.12-16.47) | 16.19 (5.80-17.14) | 16.16 (14.62-16.38) | 16.34 (15.65-16.50) | 0.85 | +3.01 | overlap | O~A |
| | RT p95 | 21.27 (8.38-21.77) | 21.28 (13.22-32.03) | 21.35 (18.36-21.74) | 21.61 (18.08-21.72) | 3.64 | +0.08 | overlap | O~A |
| **s7-big / fit** | frames / expected (pooled) | P 3978/3988 / O 4054/4058 / A 4025/4066 / N 4002/4026 | modes P:fast,slow O:fast A:fast N:fast | | | | | | |
| | total p95 ms | 24.35 (22.42-39.96) | 20.43 (8.65-36.95) | 10.89 (9.19-28.05) | 21.56 (20.81-37.11) | 16.29 | -13.46 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-17.64) | 0.00 (0.00-7.58) | 0.00 (0.00-2.96) | 0.00 (0.00-5.11) | 5.11 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 25.54 (11.39-50.45) | 6.54 (0.00-16.49) | 0.00 (0.00-14.21) | 9.59 (7.36-17.73) | 10.37 | -25.54 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.77) | 0.00 (0.00-0.29) | 0.36 (0.00-1.35) | 0.08 (0.00-1.32) | 1.32 | +0.36 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.77) | 0.00 (0.00-0.29) | 0.14 (0.00-1.35) | 0.08 (0.00-1.32) | 1.32 | +0.14 | overlap | O~A |
| | late episodes per s | 0.22 (0.22-1.23) | 0.07 (0.00-0.37) | 0.00 (0.00-0.36) | 0.22 (0.15-0.45) | 0.30 | -0.22 | overlap | O~A |
| | UI med | 5.37 (4.67-5.59) | 2.53 (2.12-3.05) | 2.29 (1.96-2.66) | 2.75 (2.63-3.24) | 0.61 | -3.08 | IMPROVES | O~A |
| | UI p95 | 8.38 (7.33-23.48) | 5.12 (4.19-20.45) | 5.75 (3.59-11.21) | 5.95 (5.07-20.47) | 15.40 | -2.62 | overlap | O~A |
| | RT med | 6.91 (5.64-16.07) | 3.94 (3.76-4.29) | 3.86 (3.59-4.01) | 4.09 (3.79-4.25) | 0.46 | -3.04 | IMPROVES | O~A |
| | RT p95 | 18.27 (17.23-20.45) | 16.69 (5.63-18.25) | 6.41 (5.32-17.32) | 17.31 (16.90-18.71) | 10.90 | -11.86 | overlap | O~A |
| **s7-big / open** | frames / expected (pooled) | P 3530/3536 / O 3485/3531 / A 3429/3453 / N 3461/3477 | modes P:slow O:slow A:fast,slow N:fast,slow | | | | | | |
| | total p95 ms | 25.12 (22.97-25.54) | 22.61 (20.99-24.61) | 22.75 (13.80-24.33) | 23.57 (20.31-36.91) | 16.59 | -2.37 | overlap | O~A |
| | > 33.3 ms per s | 0.17 (0.08-0.88) | 0.17 (0.08-0.36) | 0.08 (0.00-0.09) | 0.09 (0.00-5.36) | 5.36 | -0.09 | overlap | O~A |
| | > 16.7 ms per s | 55.15 (52.72-56.48) | 28.32 (9.16-31.25) | 20.03 (0.09-25.36) | 18.38 (9.51-23.48) | 13.97 | -35.12 | IMPROVES | O~A |
| | dropped frames per s | 0.17 (0.00-0.18) | 0.18 (0.16-1.97) | 0.17 (0.00-1.61) | 0.24 (0.16-0.54) | 0.37 | +0.01 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.17 (0.00-0.18) | 0.18 (0.16-1.70) | 0.17 (0.00-1.61) | 0.16 (0.00-0.54) | 0.54 | +0.01 | overlap | O~A |
| | late episodes per s | 0.59 (0.48-0.85) | 0.59 (0.24-0.72) | 0.36 (0.09-0.52) | 0.45 (0.16-0.90) | 0.73 | -0.23 | overlap | O~A |
| | UI med | 5.19 (4.62-5.55) | 3.13 (2.70-3.62) | 2.92 (1.97-3.14) | 2.97 (2.31-3.33) | 1.02 | -2.27 | IMPROVES | O~A |
| | UI p95 | 8.96 (7.00-9.82) | 6.50 (5.15-7.97) | 6.70 (3.11-7.72) | 6.87 (3.86-20.27) | 16.40 | -2.26 | overlap | O~A |
| | RT med | 15.94 (15.73-16.07) | 11.26 (8.11-12.95) | 8.48 (6.31-9.13) | 8.13 (7.72-9.72) | 2.00 | -7.46 | IMPROVES | O~A |
| | RT p95 | 20.19 (18.22-20.47) | 18.22 (17.16-20.49) | 18.01 (11.28-20.45) | 18.38 (16.92-18.85) | 1.93 | -2.18 | overlap | O~A |
| **s7-big / pinch** | frames / expected (pooled) | P 689/721 / O 533/579 / A 536/577 / N 524/570 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 37.98 (37.55-42.07) | 25.26 (23.54-37.72) | 24.50 (21.65-36.95) | 24.94 (23.44-37.45) | 14.01 | -13.48 | better, inside null | O~A |
| | > 33.3 ms per s | 10.29 (5.11-13.51) | 0.00 (0.00-8.87) | 0.00 (0.00-9.56) | 0.00 (0.00-9.27) | 9.27 | -10.29 | overlap | O~A |
| | > 16.7 ms per s | 45.00 (35.68-46.81) | 31.50 (24.00-40.86) | 18.58 (11.19-25.79) | 24.62 (17.22-34.74) | 17.52 | -26.42 | IMPROVES | O~A |
| | dropped frames per s | 2.57 (1.62-3.58) | 4.74 (4.14-5.26) | 3.62 (2.65-6.84) | 4.74 (4.70-5.13) | 1.12 | +1.05 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 1.99 (1.29-2.98) | 2.11 (1.55-2.63) | 2.65 (1.55-4.21) | 2.11 (2.09-2.56) | 0.55 | +0.67 | overlap | O~A |
| | late episodes per s | 2.57 (2.43-3.83) | 2.50 (2.09-2.63) | 2.11 (1.02-3.10) | 2.05 (1.04-2.73) | 1.68 | -0.47 | overlap | O~A |
| | UI med | 5.35 (4.85-5.77) | 3.77 (3.44-3.99) | 2.68 (2.40-3.67) | 3.37 (2.93-3.93) | 1.01 | -2.67 | IMPROVES | O~A |
| | UI p95 | 21.30 (17.81-24.33) | 8.71 (6.89-21.15) | 8.78 (6.21-20.31) | 8.29 (6.89-20.80) | 13.91 | -12.51 | overlap | O~A |
| | RT med | 15.57 (14.85-15.81) | 15.54 (11.93-16.21) | 11.00 (9.96-12.69) | 12.45 (11.54-15.74) | 4.19 | -4.57 | IMPROVES | O~A |
| | RT p95 | 20.54 (17.99-21.81) | 18.73 (18.62-19.56) | 18.72 (17.10-19.77) | 19.35 (18.09-20.14) | 2.05 | -1.82 | overlap | O~A |
| **s7-big / zoomin** | frames / expected (pooled) | P 242/278 / O 256/278 / A 257/279 / N 257/278 | modes P:slow O:slow A:slow N:slow | | | | | | |
| | total p95 ms | 47.97 (29.33-60.02) | 36.69 (27.32-55.28) | 31.49 (26.94-55.78) | 35.74 (25.60-53.29) | 27.69 | -16.47 | overlap | O~A |
| | > 33.3 ms per s | 15.00 (0.00-15.27) | 4.36 (0.00-11.79) | 2.18 (2.11-6.43) | 3.27 (0.00-22.91) | 22.91 | -12.82 | overlap | O~A |
| | > 16.7 ms per s | 41.45 (30.55-53.45) | 32.73 (24.64-36.43) | 36.00 (24.21-39.64) | 31.64 (25.71-37.50) | 11.79 | -5.45 | overlap | O~A |
| | dropped frames per s | 6.55 (6.32-12.00) | 4.29 (3.27-6.43) | 5.26 (3.27-5.36) | 4.36 (4.29-5.36) | 1.07 | -1.28 | IMPROVES | O~A |
| | skipped refreshes (1-2 gaps) per s | 2.18 (1.05-7.64) | 0.00 (0.00-2.14) | 1.05 (0.00-1.07) | 0.00 (0.00-1.09) | 1.09 | -1.13 | overlap | O~A |
| | late episodes per s | 3.27 (2.14-8.73) | 1.09 (1.07-4.29) | 2.11 (1.09-2.14) | 1.07 (1.07-2.18) | 1.11 | -1.17 | overlap | O~A |
| | UI med | 6.07 (5.23-6.20) | 4.15 (3.08-4.71) | 3.87 (3.30-4.69) | 3.63 (3.24-4.77) | 1.53 | -2.20 | IMPROVES | O~A |
| | UI p95 | 31.30 (13.05-36.85) | 16.02 (8.85-33.88) | 13.28 (9.25-30.53) | 11.31 (8.95-34.94) | 25.98 | -18.02 | overlap | O~A |
| | RT med | 16.31 (11.05-16.77) | 15.96 (12.08-16.56) | 15.87 (12.85-16.33) | 15.36 (12.14-16.10) | 3.96 | -0.44 | overlap | O~A |
| | RT p95 | 21.67 (20.36-28.48) | 19.39 (18.87-22.45) | 20.25 (18.48-25.25) | 20.12 (19.16-21.85) | 2.69 | -1.42 | overlap | O~A |
| **s7-big / exit** | frames / expected (pooled) | P 1946/1951 / O 1945/1950 / A 1946/1950 / N 1943/1950 | modes P:fast O:fast A:fast N:fast | | | | | | |
| | total p95 ms | 14.77 (12.28-21.97) | 19.39 (12.41-20.42) | 13.66 (9.60-20.98) | 13.34 (9.87-20.48) | 10.61 | -1.10 | overlap | O~A |
| | > 33.3 ms per s | 0.00 (0.00-0.52) | 0.00 (0.00-0.11) | 0.00 (0.00-0.44) | 0.00 (0.00-0.59) | 0.59 | +0.00 | overlap | O~A |
| | > 16.7 ms per s | 0.56 (0.04-1.78) | 0.81 (0.59-1.15) | 0.56 (0.00-1.22) | 0.67 (0.04-0.89) | 0.85 | +0.00 | overlap | O~A |
| | dropped frames per s | 0.00 (0.00-0.15) | 0.00 (0.00-0.15) | 0.00 (0.00-0.15) | 0.00 (0.00-0.22) | 0.22 | +0.00 | overlap | O~A |
| | skipped refreshes (1-2 gaps) per s | 0.00 (0.00-0.15) | 0.00 (0.00-0.15) | 0.00 (0.00-0.04) | 0.00 (0.00-0.07) | 0.07 | +0.00 | overlap | O~A |
| | late episodes per s | 0.07 (0.04-0.33) | 0.07 (0.04-0.15) | 0.04 (0.00-0.19) | 0.07 (0.04-0.15) | 0.11 | -0.04 | overlap | O~A |
| | UI med | 2.02 (1.67-2.30) | 1.95 (1.83-2.10) | 2.07 (1.58-2.23) | 2.06 (1.68-2.10) | 0.42 | +0.05 | overlap | O~A |
| | UI p95 | 4.33 (3.71-5.69) | 4.81 (3.73-5.32) | 4.93 (2.92-5.79) | 5.04 (3.42-5.83) | 2.42 | +0.60 | overlap | O~A |
| | RT med | 6.75 (6.56-7.24) | 4.23 (3.99-4.41) | 4.30 (3.79-4.50) | 4.46 (4.06-4.51) | 0.45 | -2.45 | IMPROVES | O~A |
| | RT p95 | 11.86 (9.57-17.11) | 11.11 (8.92-16.08) | 9.77 (7.40-16.32) | 10.23 (7.27-15.97) | 8.71 | -2.10 | overlap | O~A |

## Decisions
1. **Next, the win panel and scenario 7 ran on PERF builds** (reason in Method). A test-ads win persists
   `currentLevel + 1`, so the arms would stop sharing a level. Retry and the loss panel stay on test-ads builds.
2. **PERF builds leave `META_ZOOMED_CAMERA` off** (the harness convention). Scenario 7 therefore reaches the zoomed
   state with the harness's zoomIn gesture. It also leaves `PERF_EXIT_DURATION_MS` unset, so exits run their real
   POLISH-T10 curves.
3. **PRE-PERF was built from a scratch `git archive`** with an APFS-cloned `node_modules` and a symlinked
   `credentials/`. This keeps one signer and versionCode for all six APKs, so no uninstall was ever needed and app data
   was never wiped.
4. **Windows are timed on the device clock.** POLISH-T10's host-side sleep dumps ~0.85 s late. For pace.mjs (S2) that
   is harmless and it was kept unchanged; the new drivers use `waitUntil`.
5. **The win window is [440, 720]** (mount plus entrance, before the first star). The first choice, [400, 780], and its
   artefact are disclosed in 5a.
6. **`skipped refreshes (1-2 gaps)` is added next to POLISH-T12's `< 100 ms` reconciliation.** Idle pauses at the end
   of an animation (5a, 7) otherwise read as dropped frames.
7. **SurfaceFlinger present capture is off in the measured series** after the aborts. It is kept in the 4 captures,
   where it maps frames to the screen.
8. **Scenario 6's menu presses slide off Play** (DOWN on Play, UP 725 px higher), so the spring runs without
   navigating. `#` presses are real toggles (10 toggles end with lines OFF).
9. **Nothing was changed in the code.** No scenario met the fix rule (REGRESSES, small, same visual design). The
   press-spring tail trim stays the owner's ruling (T9).

## Concerns
1. **Next exposure** (4b): 6/30 against 0/30 transitions with a frame > 33.3 ms (4/30 on screen) on this loaded
   emulator. They are host-side stalls, but the animation is what exposes them. UNVERIFIED-DEVICE: this needs a phone.
2. **Press-spring tail** (6): ~78 extra frames per press burst, mostly stuffed on this emulator. It is an energy cost,
   not a frame-rate loss.
3. **Emulator state:** most runs after 09:43 were in the swap-bound mode, with host load 4-7. The absolute values
   describe this Mac at this time. Only the paired differences carry meaning; they rest on interleaving and on the
   null groups.
4. **libhwui aborts** on this emulator under frequent `gfxinfo reset` / SurfaceFlinger latency clears during
   continuous drawing (3 in ~170 runs). Other harness users may hit them too.
5. **Device data:** 64 more losses on the finished-games counter (60 in S4, 2 captures, 2 smoke). The next test-ads
   Next press will offer an interstitial. The level is still 1 and no win was recorded (PERF builds persist nothing).
6. **Scratch:** `scratchpad/t11/pre179` (3.4 GB apparent, mostly shared APFS clones; the build outputs are new blocks)
   is left for the controller to delete. My deletion permission covers only the repo's build dirs and my APKs.
7. **UNVERIFIED:** physical devices, iOS, web, Ink Night, reduced motion.

## TDD and gates (EXECUTED; `artifacts/POLISH-T11/gates/`)
- No logic changed, so there is no TDD step. The measurement scripts live under `artifacts/POLISH-T11/scripts/`
  (gitignored).
- `npx tsc --noEmit`: exit 0. `npx jest`: **71 suites, 1098 tests passed** (unchanged from POLISH-T12).
  `git status --porcelain`: only this report.

## Evidence labels
- EXECUTED: every table and number above (scripts and raw framestats under `artifacts/POLISH-T11/`); the builds and
  bundle proofs; the captures and overlay readings.
- INFERRED: the libhwui abort mechanism; T7's idle-canvas change as the reason NEW draws fewer pinch frames;
  `librnskia`'s path-only difference having no runtime effect; T9's "last ~1 s sub-pixel" for the spring tail (not
  re-measured here).
- UNVERIFIED-DEVICE: everything on a phone.

## Owner acceptances
- Keep `META_LEVEL_TRANSITION` ON, with the Next exposure in 4b to be re-checked on a phone before release: **yes/no**
  (recommendation: yes).
- Accept `META_PRESS_SPRING`'s ~1.3 s tail (~78 frames per press burst, no fps loss), or ask for the energyThreshold
  trim: **accept / trim**.
- Accept "no regression" for this round, on the tables above and within this emulator's limits: **yes/no**.

## Device state left (EXECUTED; `artifacts/POLISH-T11/device-restore.txt`)
- emulator-5556 running; scales 1/1/1 (read back); Daylight.
- Installed: **`artifacts/POLISH-T12/arrows-testads-T12.apk`** (NEW-ALL), sha256
  `c21e73b8361aa282b77b288a6e87cb82dd21114dd1da40d4c998ab522578ea8a` (read back from the device), versionCode 6. The
  app is force-stopped at the launcher.
- Removed: `/data/local/tmp/t10-input.jar`, `t10-ui.xml`, `t11-ui.xml`, `/sdcard/t11-*.mp4`. Google Photos (opened by
  the stray taps) was force-stopped. No Perfetto trace was left on the device.


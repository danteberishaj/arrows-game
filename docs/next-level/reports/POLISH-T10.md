# POLISH-T10: the arrow exit launches instead of accelerating

Status: **DONE_WITH_CONCERNS**. Everything is in the working tree, uncommitted. No git state was changed.

> **Fix round 1** (end of this report): the exit now **stops once the whole arrow is past the pan-margin extent**. The on-screen frames are unchanged.
> - **Frames per exit** fall from 20.9 to **15.3**; BASE is 15.5.
> - **Buffer-stuffed exits:** BASE 0/135, F 3/135 (2%), null of the same F APK 2/162. All five are the run's first exit after level load, which stuffs in 13 of BASE's 15 earlier runs too.
> - **The stop is pan-aware:** if the board was panned or zoomed during the exit, the whole ray plays as before, so no pan reveals a stop.
> - **Superseded:** the gate, pan and video numbers in the sections before it are for the pre-round build. The installed APK is now `arrows-testads-T10-fix1.apk`.

- **The curve ships** (inside `META_EXIT_TO_SCREEN_EDGE` only). The exit is now an ease-out: `1.15k - 0.15k^2`, the same one expression every renderer already used, with a new parameter.
  - It is fastest on its first frame.
  - It keeps at least 85% of that speed until its last pixel leaves the screen. The ray is lengthened so the slow-down happens off screen.
  - The visible run takes 88 to 185 ms of clock, depending on distance.
- **Motion criteria.** Measured on 111 recorded level-1 exits (EXECUTED; the criteria are defined under "Method"):
  - first step at least 0.4 cell: **111/111** (BASE 110/111);
  - visible exit time within 120-280 ms: **106/111** (BASE 102/111);
  - slowest/fastest on-screen speed at least 0.8: **96/111** (BASE **0/111**);
  - fastest speed within the first 30% of the motion: **85/111** (BASE **0/111**);
  - opacity 1 while on screen: 111/111.
  - Every ratio and jerk failure is a recorded presentation stall (host contention). The remaining peak failures are either ties below the instrument's resolution or a measurement bias of the tail feature at corners (details below).
- **The performance gate passes for the curve** (A/F/A/F/A x5, plus a same-APK null x6, plus a second A/C block):
  - Per-frame UI, RenderThread and total medians are inside the null spread.
  - The rate of frames > 33 ms per frame is the same: 0.51% with the curve against 0.53% for BASE, pooled over all blocks.
  - **Cost: +35% frames per exit** (15.5 → 20.9). This is the eased-out tail running off screen, justified below.
- **Part 2: one latency defect was found and fixed, but the fix is not shipped.**
  - The defect: the board's first exit frame lands one frame after the commit that starts it (Perfetto, 4/4 taps).
  - The fix draws it in the commit frame. It cuts median tap → first motion from 72 to 39-54 ms.
  - It fails the binding gate: the merged first frame exceeds 16.7 ms in 46% of exits (BASE 13%) and pushes 36% of exits into the emulator's buffer-stuffed mode (BASE 15%).
  - Kept as `artifacts/POLISH-T10/latency-fix/same-frame-exit-start.patch` for an owner decision.
- **Latency is unchanged from BASE.** Tap → first motion is a median of 71 ms (4.3 frames); 111/111 exits exceed 2 frames. The remaining latency is structural (decomposed below).

Every device number comes from **emulator-5556 only** (AVD `fleet_floor_api31`, API 31, 1440x3120 @560, 60 Hz), Daylight, scales 1/1/1, level 1 at the zoomed opening camera, grid on. The host was shared: load average was 4-7 from other sessions, and 14.7 at one point. iOS was not run.

## What changed

| File | Change |
|---|---|
| `src/ui/exitToScreenEdge.ts` | `EXIT_EDGE_LAUNCH` 0.35 → **1.15** (ease-out). New `EXIT_EDGE_ONSCREEN_MAX = 0.6`. New `exitClockAt(fraction, launch)` (inverse of the curve). `planExit` (flag ON, motion only): computes the visible run R = head → visible edge + body + tail cap; lengthens the ray if R > 60% of the travel; sets `durationMs = exitLaunchDurationMs(exitOnScreenMs(R × scale), clockAt(R / travel))`. The flag-OFF and reduced-motion branches are untouched. |
| `src/ui/exitAnimationConfig.ts` | `exitOnScreenMs(pt) = clamp(55 + 0.3·pt, 88, 185)` and `exitLaunchDurationMs` (clamped 180-1000 ms; PERF builds keep their pinned duration). Constants are marked `OWNER-PICKED STARTING VALUE`, picked with `scripts/sim2.py`. |
| `src/ui/arrowGeometry.ts` | `slitherPath(..., overrun = 0)`: an optional extra straight ray. 0 = byte-identical (`+ Math.max(0, 0)`). |
| `modules/arrows-board/android/.../ArrowsBoardView.kt` | Accepts `launch` up to **2** (was 1): `launch*k + (1-launch)*k^2` is increasing on [0, 1] for launch ≤ 2. Adds a `Trace` section `ArrowsBoard.setExitAnimation`. The draw expression and the start timing are unchanged. A comment records the measured-but-not-shipped same-frame start. |
| `modules/arrows-board/ios/ArrowsBoardView.swift` | The same validation bound, `launch <= 2`, so a flag-ON iOS build does not reject every exit. **Not compiled** (see Concerns). |
| `src/ui/__tests__/exitLaunchCurve.test.ts` (new, 9 tests) | Every level-1 exit at the opening camera: ease-out; fastest at launch and ≥ 85% on screen; visible run 88-185 ms; first drawn frame ≥ 0.4 cell; opaque while on screen; still ends ≥ body + 1 cell past the pan extent; Kotlin Float arithmetic = TS to 1e-6. Flag OFF and reduced-motion payloads for all 60 arrows match BASE `d47abf3` by sha256. |
| `src/ui/__tests__/exitToScreenEdge.test.ts` | R3a's `launch 0.35` expectations are replaced by the T10 ones (constants, the 1.15 curve, the lengthened ray, the five fixed durations re-derived by an independent formula in the test). There is 1 new `exitClockAt` test. **Nothing was weakened:** every changed assertion now pins the new values, and the flag-OFF/RM tests are untouched. |

Not changed: `BoardView.tsx` (the web `ExitTrail` already calls `exitTravelFraction(k, motion.launch)`), colours, the stroke, the fade start 0.85, the pan margin 0.25, flags, haptics, sound and save data. There is no migration and no wipe risk.

## Method (EXECUTED; scripts in `artifacts/POLISH-T10/scripts/`)

- **Clocks.** Each capture uses one `screenrecord` at 720x1560.
  - **Frame times:** screenrecord's own Winscope block (`#VV1NSC0PET1ME!#` + uint64 µs per frame, CLOCK_MONOTONIC; `wstime.py`). Its deltas match the mp4 pts to ≤ 6 µs.
  - **Tap time:** the injected UP `MotionEvent.eventTime` (`T10Input.java`, a one-process variant of `ArrowsWorkload.java`), which is `uptimeMillis` = CLOCK_MONOTONIC. So t = frame − UP needs no alignment step.
  - **Cross-check:** Perfetto's `deliverInputEvent eventTimeNano` equals the injected UP time, and the app received it 1-4 ms later.
- **Head travel per frame** (`profile.py`, half-res). A pixel's "new ink" is its inkness minus the inkness of the frame shown 1.1 s after the tap.
  - **Head:** the arrowhead translates rigidly, so its feature point is where the ink integrated from the front along the exit ray reaches half the head's area (sub-pixel).
  - **Tail:** used once the head is off screen. It is the equivalent feature along the trail's arc length, with its offset calibrated on frames where both head and tail are visible (0.19-0.23 cell).
  - **Visible screen:** below the header, and above the nav-bar scrim. The scrim starts at y = 1476 half-res and is 90% white; the arrow is only faintly visible under it.
- **Instrument noise** (EXECUTED on BASE, whose curve is known).
  - Fitting every BASE exit with the model "each displayed frame advances the clock 16.67 ms" gives an rms of **0.022 cell**, a per-step error sd of **2.9%** (max 5.2%, n = 198), and a clock offset i0 = 1.00 in 27/27 exits.
  - The composition timestamps themselves jitter ±5 ms, so speeds are taken **per display refresh**: step / (round(dt/16.67) × 16.67 ms). Raw step/dt is also kept in the JSON.
- **Criteria** (brief numbers; my operational definitions):
  - **latency** = first frame whose head travel is > 0.12 cell, minus UP;
  - **first step** = the travel on that frame;
  - **visible exit** = the first frame with no new ink on screen, minus UP;
  - **peak ≤ 30%** = the fastest speed sample lies in the first 30% of [first motion, visible exit]. The brief's "30% of the visible exit" measured from the tap would fall inside the latency and could never pass.
  - **ratio** = slowest/fastest on-screen sample;
  - **jerk** = max |Δv|/v between consecutive samples;
  - **opaque** = no frame with the arrow's 95th-percentile ink < 0.85 before it leaves.
- **Failure classes** (`classify.py`, applied to the curve's exits):
  - **STALL:** the recording holds or skips refreshes (a doubled frame, a > 25 ms gap, or one step > 1.5x or < 0.5x the exit's median step).
  - **TIE:** the best early sample is within 6% (2 × the 2.9% sd) of the peak.
  - **REAL:** anything else.
- **Captures:**
  - BASE and final, alternated with `install -r`, same 27 solve-order taps (`plan.ts` greedy order), 4 captures each, plus 1 capture each after a 158 px pan.
  - Final `seq3` ran while the host load average rose to 14.7. It is reported, not dropped.
- **Pacing** (`pace.mjs`, POLISH-T4/T8 gfxinfo method, no screenrecord):
  - Per exit: `gfxinfo reset`, one tap, 1.1 s, `framestats`.
  - Rows kept: Flags=0, de-duplicated, IntendedVsync inside [UP, UP+1 s].
  - Expected frames: contiguous span / 16.67 + 1.
  - Summaries: `paceab.py`.

## Part 1: baseline (installed BASE `d47abf3`, sha `51df0c1c…0a52`)

### 1. Tap → first visible motion (EXECUTED; 111 exits: `base/base-seq1..4`, `base-pan1`)
- **Median 72.0 ms = 4.32 frames.** Range 51.4-94.2 ms (3.09-5.65 frames). **111/111 exceed 2 frames.**
- In 9-20 of 27 exits per capture, the first moving frame arrives two refreshes after the frame that updates the counter: a 25-33 ms hold on the resting arrow before it moves. There were 0 recorded gaps during motion in any BASE exit.

### 2. Motion profile (EXECUTED; plots `profile-<arrow>.png`: BASE grey, final pink, same taps)
Selected exits, BASE `seq4` + pan capture:

| exit | shape | latency ms | first step (cells) | visible ms | peak at | slowest/fastest | max jerk | opaque |
|---|---|---|---|---|---|---|---|---|
| 34 | short straight (Right, 2 cells) | 85 | 0.42 | 185 | 0.82 | 0.56 | 0.27 | yes |
| 44 | longest straight in level 1 (Down, 3 cells) | 54 | 0.57 | 221 | 0.91 | 0.45 | 0.20 | yes |
| 17 | 4 corners (Up, 8 cells) | 71 | 0.70 | 204 | 0.87 | 0.47 | 0.24 | yes |
| 12 | near the edge (head 0.5 cell from it) | 58 | 0.59 | 155 | 0.83 | 0.54 | 0.22 | yes |
| 47 | far from it (17 cells to travel) | 53 | 0.55 | **289** | 0.92 | 0.35 | 0.19 | yes |
| 0 | after a pan | 79 | 0.70 | 196 | 0.86 | 0.49 | 0.25 | yes |

- **Pooled, 111 exits:**
  - peak ≤ 30%: **0/111**;
  - ratio ≥ 0.8: **0/111**;
  - first step ≥ 0.4: 110/111;
  - visible time: 9/111 outside 120-280 (the long runs reach up to 321 ms); median 208 ms;
  - jerk: 111/111;
  - opaque: 111/111.
- The measured ease-in speeds up 2-3x while on screen.
- Level 1 has no straight arrow longer than 3 cells, so "long straight" is exit 44.

### 3. Frame pacing (EXECUTED; the A arms of `pace/`, `pace2/`, `pace3/`, 15 runs × 27 exits)
- **Frames:** 416-419 / 419 expected per run, which is 15.5 frames per exit.
- **Medians per run:** UI 1.49-3.62 ms; RenderThread 4.00-7.53 ms (every run in the emulator's "fast" RT mode).
- **Frames > 16.7 ms:** 0.44-4.67 per exit.
- **Frames > 33.3 ms:** 11 isolated plus 22 in one stall episode (13 consecutive ~40 ms frames in one exit, a host stall).
- **The exit's heaviest start frame** (max of frames #0 and #1): median 13.1-16.6 ms per run.
  - BASE re-rasterises the whole board mask on frame #1: Perfetto shows two `Texture upload 1850x1851` per exit, and RT flush goes from 7.3 to 0.5 ms.
  - That frame exceeds 16.7 ms in 13-21% of exits.
  - When it does, the rest of the exit runs **buffer-stuffed**: RT waits ~13.4 ms per frame in `dequeueBuffer`, frames still arrive every vsync, and total frame times read ~20 ms.

### 4. JS cost between the tap and the native start (EXECUTED; timing-instrumented repack of BASE JS, n = 27; the instrumentation lives only in a scratch copy, `timing-patch.py`)

| stage | median | p90 | max |
|---|---|---|---|
| UP (injected) → `handleTap` entry (Date.now, 1 ms resolution) | 4 ms | 5 | 7 |
| `planExit` | 0.111 ms | 0.205 | 0.697 |
| `setNativeExitAnimation` call | 0.003 ms | 0.006 | 0.024 |
| rest of the handler (`onRemoved`: counter, hearts) | 1.99 ms | 2.78 | 6.26 |
| React render + commit (layout effect on the new exit string) | 2.53 ms | 3.48 | 5.11 |
| **UP → commit** | **9 ms** | 11 | 15 |

The final code measured the same way: `planExit` 0.153 ms (+0.04 ms for the lengthening and the clock inverse), UP → commit 9 ms (p90 14).

## Part 2: defects found (EXECUTED unless labelled)

1. **The board's first exit frame lands one frame after the commit that starts it** (Perfetto `trace/base-tr1`, atrace view+input+app, 4/4 taps; `tracetap.py`).
   - The mount (`MountItemDispatcher::mountViews` → `ArrowsBoard.setVisibleMask`) runs inside `Choreographer#doFrame` at +11 to +23 ms after UP. The counter text redraws in that frame.
   - The board's re-raster (its `Texture upload 1850x1851`) happens in the **next** frame's RenderThread, 4/4.
   - Mechanism (INFERRED from the framework code, consistent with the trace): the setters call `postInvalidateOnAnimation()` while Choreographer is running its animation callbacks, so the invalidate is queued for the next vsync.
   - **Fix, implemented and measured:** `invalidate()` on the UI thread, plus a one-frame clock head start so the commit frame already shows motion (flag-ON payloads only; `latency-fix/same-frame-exit-start.patch`).
   - With the fix, the trace shows the re-raster in the **same** frame as the mount, 4/4 (`trace/final-tr1`).
   - First motion: median **39.3 ms** (27 exits) and **53.8 ms** (54 exits), against BASE 72 ms. 6 of 81 exits were ≤ 2 frames.
   - **Gate result: FAILS** (`pace/`, arms A = BASE, B = with the fix, M/N = B null):
     - the merged first frame exceeds 16.7 ms in **46%** of exits (A: 13%);
     - **36%** of exits then run buffer-stuffed (A: 15%; null M/N 32-36%);
     - the exit-start frame median is 16.2-16.6 ms per run, against 14.9-15.4.
   - The binding gate says slower exit frames do not ship, so the fix is **not in the tree**. The Kotlin comment and the patch keep it for the owner (see Owner acceptances).
   - A cheaper variant (defer the board rebuild one frame and cover the static arrow for that frame) was not tried; it needs an extra draw.
2. **What remains of the latency, and why it is not a curve defect** (INFERRED from the trace and the JS timings):
   - the input reaches the UI thread at +1-4 ms;
   - JS handles and commits by +9 ms (median);
   - the mount waits for the next vsync (+2-14 ms);
   - the board draws one vsync later (defect 1);
   - that frame carries the board re-raster (RT 11-16 ms) and misses its vsync in 9-20 of 27 exits per BASE capture (8-25 for the final, whose timing is the same): the 25-33 ms "hold" above;
   - then composition.
   - Only defect 1 was fixable without new architecture. Starting the exit on the UI thread before JS (resolving the tap natively) would be a design change. **First motion > 2 frames therefore remains a defect, with this root-cause evidence.**
3. **No hitch during the visible motion that is attributable to either build.**
   - BASE: 0 mid-motion gaps in 111 exits.
   - Final: all mid-motion stalls are presentation stalls that did not reproduce under control (see "Exit 17" in Concerns).

## Part 3: the launch curve

**Design** (`scripts/sim2.py`: a Monte-Carlo run of the Part 1 frame model over the 49 level-1 exits with on-screen tap points, measured noise, measured latency; `sim-final.txt`):

| curve (share of travel on screen) | first step ≥ 0.4 | peak ≤ 30% | ratio ≥ 0.8 | visible median / range ms | frames per exit |
|---|---|---|---|---|---|
| BASE ease-in 0.35 | 92% | 0% | 0% | 214 / 175-289 | 14.3 |
| linear 1.0 | 98% | 27% (flat: the peak lands at random) | 99% | 203 / 142-273 | 18.0 |
| **shipped ease-out 1.15 (≤ 0.6)** | **100%** | **77%** | **99%** | **203 / 142-273** | **19.7** |
| ease-out 1.2 (≤ 0.5) | 100% | 80% | 99% | 201 / 142-273 | 21.5 |
| full quadratic ease-out 2.0 (≤ 0.28) | 100% | 83% | 99% | 197 / 142-239 | **60** (hits the 1000 ms cap) |
| exponential launch burst (not one expression with iOS) | 100% | 92% | 98% | 203 / 142-273 | 17.8 |
| cubic `1-(1-k)^3` (≤ 0.4) | 100% | 93% | **42%** | 198 / 142-239 | 58 |

- **Emil's `cubic-bezier(0.23, 1, 0.32, 1)`** starts at 4.35x the average speed. To stay above 80% of that while on screen, only **40%** of its travel may be visible (33% for 85%). The whole exit then lasts **10-12x the visible run**: 1.4-1.7 s, or 85-100 frames per exit. Rejected on the performance gate.
- **Why 1.15.** It keeps the one expression `launch*k + (1-launch)*k^2`:
  - the same in TS, Kotlin and the web renderer, and exactly the Bezier (1/3, L/3, 2/3, (1+L)/3) on iOS, so no renderer gets a new code path;
  - it is the ease-out with the fewest extra frames that keeps the on-screen slow-down ≤ 15% nominal, leaving a margin over the 20% limit for the instrument's noise.
  - The front-loaded "burst" curve would pass "peak ≤ 30%" more robustly (92%), but it cannot be expressed as the iOS Bezier.
- **Duration.** The visible run is set by distance: `clamp(55 + 0.3·R_pt, 88, 185)` ms.
  - The 88 ms floor keeps the first step ≥ 0.4 cell on the shortest level-1 run: a 1-cell arrow 1.5 cells from the edge (tested).
  - With the real latency, that case can still show a visible time just under 120 ms. It is not in the measured sequence (see Concerns).

**Parity (EXECUTED):**
- The jest test replays Kotlin's Float expression (`Math.fround` on every operation, the launch taken from the payload token) against `exitTravelFraction`: |Δ| < 1e-6 at 1001 points.
- End to end on the device, the final's measured head travel follows `1.15k - 0.15k^2`: first steps 0.85-1.86 cells, ratios 0.84-0.93.
- The web path is `ExitTrail` → `exitTravelFraction(kk, motion.launch)`, the same function (INFERRED from code; not run on web).

**The same criteria after (EXECUTED; final `seq4` + pan capture; same taps as the BASE table):**

| exit | latency ms | first step (cells) | visible ms | peak at | slowest/fastest | max jerk | opaque |
|---|---|---|---|---|---|---|---|
| 34 short straight | 59 | **0.85** | 140 | **0.21** | **0.92** | 0.07 | yes |
| 44 longest straight | 56 | **1.36** | 205 | **0.10** | **0.88** | 0.07 | yes |
| 17 four corners | 58 | **1.25** | 211 | **0.12** | **0.89** | 0.07 | yes |
| 12 near the edge | 71 | **0.99** | 188 | **0.15** | **0.91** | 0.06 | yes |
| 47 far from it | 72 | **1.75** | **253** | **0.09** | **0.84** | 0.07 | yes |
| 0 after a pan | 85 | **1.32** | 199 | **0.13** | **0.90** | 0.08 | yes |

**Pooled per capture** (`summary-all/summary.md`; seq3 is the host-load capture):

| capture | exits | latency median ms | visible median / range ms | step1 | visible in band | peak ≤ 30% | ratio ≥ 0.8 | jerk ≤ 0.5 | opaque |
|---|---|---|---|---|---|---|---|---|---|
| BASE seq1-4 + pan | 111 | 72.0 | 208 / 134-321 | 110 | 102 | 0 | 0 | 111 | 111 |
| final seq1 | 27 | 76.3 | 211 / 159-257 | 27 | 27 | 18 | 26 | 26 | 27 |
| final seq2 | 27 | 69.7 | 205 / 138-253 | 27 | 27 | 18 | 24 | 24 | 27 |
| final seq3 (load 14.7) | 27 | 72.8 | 223 / 154-442 | 27 | 22 | 22 | 17 | 17 | 27 |
| final seq4 | 27 | 60.1 | 205 / 140-253 | 27 | 27 | 24 | 26 | 26 | 27 |
| final pan | 3 | 76.0 | 199 / 173-225 | 3 | 3 | 3 | 3 | 3 | 3 |

Why the final's failures happen (`final/classify.txt`):
- **ratio / jerk:** every failure is **STALL** (15/15). The recording held or skipped refreshes: a doubled frame, a > 25 ms gap, or a catch-up jump. 10 of the 15 are in seq3.
- **peak ≤ 30%**, 26 failures:
  - 7 **STALL**;
  - 14 **TIE**: the fastest early sample is within 6% of the peak, below the resolution;
  - 5 near-edge Left exits (9, 28, 8 in seq1; 28, 8 in seq2): the only measurable feature is the tail going round corners. They repeat the *identical* speed pattern (0.898, 0.993, 0.942, 0.878, 0.920 cells/frame) in every capture and on mirror-image arrows. That is a systematic bias of the tail feature at bends, not motion (INFERRED).
  - None of these exits has a speed rising by more than the noise; compare BASE's +100-200%.

**Look.** The owner judges the videos (UNVERIFIED-OWNER):
- `owner-exit-before-after-x1.mp4` and `-x4.mp4`: BASE `seq4` on the left, final `seq4` on the right, the same 12 taps, each aligned on its UP event, VFR-safe (every recorded frame of both is kept).
- `owner-exit-curves-x4.mp4`: BASE 0.35, linear 1.0, **shipped 1.15**, full ease-out 2.0, the same 8 taps.
  - The 1.0 and 2.0 panels are debug-signed JS repacks over the final APK; their header text is lighter because those installs were fresh.
  - On-device results for the comparison curves: linear 1.0 passes ratio and jerk 27/27 but peak only 5/27, all ties (the speed is flat); 2.0 passes 26/27 of the peak criterion but runs up to 1000 ms (~60 frames) per exit.

## Performance gate (EXECUTED; `pace3/paceab.md` is primary, `pace2/` confirms, `pace/` is the latency fix)

Final APK (F) against BASE (A), alternating A1 F1 … A5 F5, then the same F APK ×6 as a null (M1 N1 M2 N2 M3 N3). Same board, same 27 taps, all runs in fast RT mode.

| arm | runs | frames / expected (per run) | frames per exit | median UI ms (per run) | median RT ms | median total ms | > 16.7 ms per exit | > 33.3 ms: stall-episode / isolated | exits buffer-stuffed |
|---|---|---|---|---|---|---|---|---|---|
| A BASE | 5 | 417-419 / 419 | 15.5 | 1.49-1.92 | 4.14-7.53 | 5.71-9.55 | 0.48-4.67 | 0 / 1 | 13% |
| F final | 5 | 553-565 / 557-565 | 20.5-20.9 | 1.60-2.01 | 4.54-6.56 | 6.28-8.71 | 2.37-6.89 | 36 / 8 | 24% |
| M/N null (F) | 6 | 565 / 565 | 20.9 | 1.72-2.42 | 4.19-5.98 | 6.26-8.38 | 0.74-6.11 | 0 / 0 | 6% / 17% |
| second block (`pace2/`): A BASE | 5 | 416-419 / 419 | 15.4-15.5 | 1.98-3.62 | 4.00-4.41 | 6.46-7.92 | 1.26-3.81 | 0 / 5 | 15% |
| second block: C = curve, BASE timing | 5 | 602-606 / 605-606 | 22.4 | 1.96-2.24 | 4.15-4.36 | 6.17-6.68 | 2.37-4.30 | 0 / 3 | 13% |

C uses on-screen base 70 ms instead of the shipped 55, so it has more frames per exit.

- **Sample reconciliation.** Every run is within 0-3 frames of span/16.67 + 1, except F2 (553/565). F2 has the 33-frame stall episode.
- **Per-frame cost: PASS.**
  - UI, RT and total medians of F lie inside the same-APK null spread and overlap BASE.
  - The exit-start frame median is F 13.3-14.5 against A 13.1-15.2 per run, and C 15.4-15.9 against A 15.4-16.6.
  - Stuffing is F 24%, C 13%, A 13-15%, and the null of the same F APK 6-17%. F's 24% sits above that null, so the stuffing difference is **UNEVALUABLE** rather than shown equal.
- **Frames > 33 ms: no new frame is attributable to the curve (UNEVALUABLE for single rare stalls).**
  - They cluster in F1-F3 (44 frames, including 125 ms and 97 ms isolated ones).
  - F4, F5 and all 6 null runs of the same APK had **0**.
  - A had 1 here, and 22 stall frames plus 10 isolated in the other blocks.
  - None recurs at the same exit and frame across runs.
  - Pooled over the three blocks, the per-frame rate is **0.53%** for BASE (33 of 6,273 frames) and **0.51%** for the curve with BASE timing (47 of 9,214: C, F and M/N).
  - These are host stalls: consecutive 35-60 ms frames across a whole exit, and a load average of 4-7 from other sessions.
- **Frames per exit: +35% (15.5 → 20.9), the one cost of the curve.**
  - It is not per-frame work: no allocation, no extra draw call, no extra React commit.
  - An ease-out's slow part must be off screen (the brief's rule), so the path runs on past the edge for ~5 more frames while the arrow is invisible.
  - Those frames make "> 16.7 ms per exit" read higher: whenever an exit is buffer-stuffed, its extra frames also read ~20 ms total.
  - Options if the owner wants it lower: linear 1.0 (−1.7 frames, flat speed) or a shorter pan margin (0.25 is an owner value).
- **Verdict: PASS for the curve** (it ships). **FAIL for the Part 2 same-frame start** (not shipped).

## TDD (EXECUTED; `artifacts/POLISH-T10/tdd/`)
- **RED** (`red-exitLaunchCurve-on-d47abf3.txt`, `red-final-tests-on-d47abf3.txt`): the final test files run against a `git archive d47abf3` copy.
  - `exitLaunchCurve`: **4 fail for the right reasons**:
    - launch received 0.35, expected > 1;
    - the peak is at the end of the visible run, not the start;
    - a visible run of 190.5 ms is > 186;
    - a first step of 0.374 cell is < 0.4.
  - 5 guards pass by design: opacity, extent, Kotlin parity, and the two flag-OFF/RM goldens.
  - `exitToScreenEdge` fails to compile: `EXIT_EDGE_ONSCREEN_MAX` and `exitClockAt` do not exist on BASE.
- **GREEN** (`green-exit-tests.txt`): 22/22.
- **Goldens:** `golden-src.ts` was run in the BASE copy. The flag OFF sha256 is `39e04649…ca56` and the RM sha256 (flag OFF and ON) is `45019113…9ddd`, over all 60 level-1 payloads. The test asserts both.

## Gates (EXECUTED; `artifacts/POLISH-T10/gates/`)
- `npx tsc --noEmit`: exit 0.
- `npx jest`: **70 suites, 1093 tests passed**. BASE had 69 suites and 1083 tests (`jest-base-d47abf3.txt`): +9 new and +1 in `exitToScreenEdge`.
- `git diff --check`: clean.
- **Kotlin** compiled in 4 gradle arm64 release builds (`builds/`). The dex contains `ArrowsBoard.setExitAnimation`.
- **Bundles:** every one holds the TestIds and **0** owner units (`ca-app-pub-9813131856455133`, 6706292920, 7549521178, 3505414519, 5508761320), checked in ASCII and UTF-16LE **before install** (`builds/bundle-proof-*.txt`, `builds/repack-*.txt`).
  - Final bundle sha256: `de9b9a90…2cdc`.
  - The signer equals BASE's (`24f7fa0b…50f8`), versionCode 6.
- **POLISH-T6 blink re-check**, run because the board view changed (`blink/table.md`): the T6 `capture.mjs` + `aggregate.py`, unchanged, on the final APK. 3 sessions at scales 1/1/1 and 3 at 0/0/0, read back after relaunch. **0 ABSENT at mount, 0 at unmount, 0 ghost frames over 36 taps.** Every session went 60 → 59 left.

## Builds
- Incremental gradle arm64 release (`scripts/build.sh`: no prebuild, the 2026-09-24 test flags plus PRESS_SPRING, LEVEL_TRANSITION and PANEL_MOTION, `EXPO_PUBLIC_ADMOB_TEST_ADS=1`, Metro cache cleared with 0 dirs left, `:app:createBundleReleaseJsAndAssets --rerun`). `df -h /` right before each build gave 10, 9.9, 8.0 and 8.0 GiB. The first `t10-v1` attempt started at 5.7 GiB and failed on the gradle lock (Concern 7).
  - `t10-v1` and `t10-v2`: with the latency fix (v1 used on-screen base 50 ms / floor 85, v2 70 / 88); measured, then deleted.
  - `t10-C-curve-only`: gate arm C, built with the fix temporarily disabled in the working tree. The tree was restored and `git diff | shasum` was identical before and after.
  - `t10-final`, shipped: `artifacts/POLISH-T10/arrows-testads-T10.apk`, sha256 `670f7986…7846`.
- **JS repacks** (debug-signed, `scripts/repack.sh`, W0-02 recipe): the BASE and final timing builds, and the curve variants `var-L100` and `var-L200`. Only the two variants are kept, in the scratchpad. Installing them needed uninstalls, which wiped test data; the tutorial was replayed with `ftue.mjs`.

## Decisions
1. **The curve family stays `launch*k + (1-launch)*k^2`**, with launch 1.15, instead of Emil's cubic-bezier or an exponential burst. Reasons: one expression across 4 renderers (iOS exact via its existing Bezier), and the fewest dead frames for an on-screen slow-down under 15% (table above).
2. **Timing is set by the visible run**, not the whole exit. Otherwise an ease-out on the longer path would crawl or rocket depending on how far off screen the path ends.
3. **A ray is lengthened only when the visible run would exceed 60% of the travel.** It never shortens below "body + one cell past the pan extent" (tested).
4. **The Part 2 same-frame start was measured and not shipped** (the gate). It is kept as a patch and a Kotlin comment.
5. **Swift bound widened (uncompiled).** Without it, a flag-ON iOS build rejects every exit payload. iOS is a non-goal, so it is not run.
6. **"peak ≤ 30%" is measured from the first motion.** From the tap, the window would lie inside the latency.
7. **The latency fix and the curve were split into separate gate arms (B, then C and F)** once B's first frame showed up heavier.

## Concerns
1. **Latency stays > 2 frames** (median 4.3). The only fix found without new architecture costs frame time (Part 2).
2. **+35% frames per exit** (≈ +5 frames of the off-screen tail). Per-frame cost is unchanged. See the options above.
3. **Exit 17 presentation stall.** In final seq1 and seq2, exit 17's first motion was held 81-84 ms, then jumped (STALL). It was **not reproduced** in 3 controlled A/B probes with screenrecord and gfxinfo (`exp17/`: final 49-74 ms, BASE 50-59 ms, 0 doubled frames), nor in any gfxinfo run. INFERRED: a presentation or host stall. It is worth watching on a real device.
4. **The shortest run in level 1** (arrow 56, a 1-cell arrow 1.5 cells from the edge; not in the measured sequence) sits on a knife edge between the first step ≥ 0.4 cell and a visible time ≥ 120 ms at the fastest measured latency. The floor favours the first step.
5. **"peak ≤ 30%" is resolution-limited** for the nearly flat on-screen speed (≤ 15% nominal slow-down; 10 TIE and 6 tail-bias failures).
6. **Not measured:** the web renderer (identical function, INFERRED), iOS (Swift not compiled), physical devices, and Ink Night for the motion profile (the blink check ran in Daylight only, as in T8).
7. **Controller's hung gradle daemon.** The controller's earlier `build-final.sh testads` gradle daemon (PID 47858) was still alive 70 min after `BUILD SUCCESSFUL`. Its main thread was in `DaemonStateCoordinator.awaitStop`, and it logged "Problem in daemon expiration check". It held `~/.gradle` journal locks, and my first build failed on them. I sent SIGTERM, then SIGKILL, at ~00:04. Its log (`scratchpad/build-testads.log`) now ends with "daemon disappeared unexpectedly" after its original `BUILD SUCCESSFUL in 8m 55s`. The BASE APK it produced is unaffected (sha verified on the device before and after).
8. **BASE re-rasterises the whole board mask on every exit's first frame** (2 × 1850x1851 texture uploads, RT +7 ms). This is the real cause of the start-of-exit hold and of the Part 2 trade-off. Tiling the static art would address it; out of scope.

## Owner acceptances
- `artifacts/POLISH-T10/owner-exit-before-after-x4.mp4` (and `-x1`): does the arrow now leave as an instant, confident launch at a steady speed, where before it crept and then shot off? **yes/no**
- `artifacts/POLISH-T10/owner-exit-curves-x4.mp4`: is the shipped 1.15 the right feel, compared with linear 1.0 and full ease-out 2.0? **yes/no** (if 2.0: it costs about 3x the frames per exit)
- **Part 2:** ship `latency-fix/same-frame-exit-start.patch`? It gives first motion about 1 frame sooner (72 → 39-54 ms), but the exit's first frame goes over 16.7 ms in 46% of exits against 13%. **yes/no**
- Accept +35% frames per exit for the eased-out tail? **yes/no**

## Device state left (pre-round; superseded, see Fix round 1)
emulator-5556 is running, scales 1/1/1 (`artifacts/POLISH-T10/device-restore.txt`).
- Installed: `artifacts/POLISH-T10/arrows-testads-T10.apk` (sha256 `670f7986…7846`, upload-key signed, versionCode 6, test ads).
- Tutorial completed on this install; level 1 opens at 60 left. The app is stopped at Home.
- Removed: `/data/local/tmp/t10-*`.


## Fix round 1: stop the exit once the whole arrow is past the extent

**Controller finding:** the pre-round build rendered +35% frames per exit (15.5 → 20.9), and more exits were buffer-stuffed (24% against 13%). The cause was the slowing tail, still animating after the arrow was fully off screen.

**Fix, shipped (it adds no per-frame work).**
- **Planner** (`exitToScreenEdge.ts`, `endAtExtent`):
  - Path, duration, curve and fade stay **exactly the pre-round exit's**. It only adds `endMs`: the first whole ms of exit clock at which the tail's round cap plus a 2 pt anti-aliased edge (`EXIT_EDGE_AA_PT`) is past the extent (visible rect + `EXIT_EDGE_MARGIN_FRACTION` 0.25).
  - The payload is the pre-round payload plus `,endMs` (13 + 2n tokens).
  - Flag OFF and reduced motion carry no motion tokens. The BASE sha256 test is kept and passes.
- **Android** (`ArrowsBoardView.kt`):
  - Parses 13 + 2n and records the camera (the parent view's `translationX/Y`, `scaleX`) when the exit starts.
  - At `endMs` (one comparison per frame, like the existing `progress >= 1`):
    - if the camera is unchanged (within 0.5 px / 1e-4 scale), the slot clears and stops invalidating;
    - if the board was panned or zoomed meanwhile, the slot runs on to `durationMs`, exactly as before.
  - Without the token, `endMs = Long.MAX_VALUE` and nothing changes.
- **Web / iOS:** the web renderer (`BoardView.tsx`, untouched this round) ignores `endMs` and runs to `durationMs` as before. The Swift parser accepts 13 + 2n and also runs to `durationMs`; it was not compiled.
- **Planned result:** the mean `endMs` over the 27 solve-order exits is **231.3 ms**, against the pre-round 325.0 ms and BASE's 234.7 ms (`scripts/margin-sweep.ts`).

**Designs tried and rejected (EXECUTED; `fix1/superseded/`, `fix1/pan*`):**

1. **Re-parametrise the stop inside the same curve** (launch' = L·c/f(c), travel T·f(c), duration c·D; no new token).
   - The travel matches to ≤ 0.0026 board points. That is 0.007 px.
   - It is **not pixel-identical**: the device-Skia check showed up to 170 px differing per frame, channel delta 65. Skia rasterises path edges at 1/4-px coverage steps, so an infinitesimal shift flips whole edge rows.
2. **`endMs` plus a fade moved off screen** (`t10-fix1`), then **plus a fade completed at `endMs`** (`t10-fix1b`).
   - Pixel-identical on screen, but the pan test showed the problem.
   - At this camera the pan range plus rubber band can move the board up to **678 px**, against the 360 px extent margin.
   - A fast drag toward the arrow (850 px in 100 ms, starting 70 ms after the tap) revealed the stop: the arrow **faded out mid-screen**.
   - A normal drag (250 ms) revealed it as a **fading stub at the screen edge**.
3. **A wider extent margin was quantified and rejected.** Each +0.05 of viewport costs about +1 frame per exit: 0.30 → 14.9, 0.35 → 15.9, 0.50 → 18.2 frames of clock, against BASE's 14.1. Covering the observed 678 px reveal would cost about +4 frames. The pan-aware stop gives the same safety at 0 frames.

### Acceptance (EXECUTED; emulator-5556, level 1, zoomed opening camera, scales 1/1/1)

**1. Frame pacing gate** (`pace4/paceab.md`). A = BASE `d47abf3`, F = `arrows-testads-T10-fix1.apk`, alternating A1 F1 … A5 F5, then F ×6 as the null (M1 N1 M2 N2 M3 N3). Same 27 taps; every run in fast RenderThread mode.

| arm | runs | frames / expected @60 Hz (every run) | frames per exit | median UI ms (per run) | median RT ms | median total ms | > 16.7 ms per exit | > 33.3 ms (stall episode / isolated) | exit-start frame median ms |
|---|---|---|---|---|---|---|---|---|---|
| A BASE | 5 | 418-419 / 418-419 | **15.5** | 1.49-1.84 | 3.71-3.90 | 5.47-5.93 | 0.00-0.15 | 3 / 0 | 11.9-12.8 |
| F fix 1 | 5 | 412 / 412 | **15.3** | 1.60-1.86 | 3.66-3.85 | 5.52-5.85 | 0.00-0.56 | **0 / 0** | 12.6-13.2 |
| F null ×6 | 6 | 412 / 412 | 15.3 | 1.65-1.92 | 3.66-3.79 | 5.40-5.95 | 0.00-0.56 | 0 / 0 | 12.3-13.1 |

- **Frames per exit: PASS.** 15.3 against BASE's 15.5; the per-run null spread is 0.0.
- **Per-frame medians: PASS.** UI, RT and total for F lie inside the null spread and overlap BASE.
- **Frames > 33 ms:** F 0, BASE 3 (one episode in A2).
- **Buffer-stuffed exits: within the variation of BASE across blocks, and not distinguishable here.**
  - The count is F 3/135 against A 0/135, with the same-APK null at 2/162.
  - All 5 are **the first exit after level load** (arrow 24), in every build.
  - BASE's first exit stuffed in 5/5, 4/5 and 4/5 runs of the three earlier blocks, and in 0/5 in this one. In this block F's first exit stuffed in 5/11.
  - Every other exit, in every arm, was unstuffed.
- **One pacing probe before the gate** (`fix1/superseded/probe-fix1c-single-run`) also gave 15.3 frames per exit, 412/412.

**2. On-screen frames are identical to the pre-round build.**
- **Device Skia (EXECUTED; `fix1/exit-trunc-check.txt`, `scripts/ExitTruncCheck.java` + `truncpairs.ts`).**
  - For the six selected exits (34, 44, 17, 12, 47, 0) and exit 0 after the 158 px pan: the pre-round payload and the fix-1 payload as the app serializes them. The fix-1 payload is the same string plus `,endMs`.
  - Each was drawn with a Float port of `drawExitSlot`, at **every ms** of exit clock until the pre-round arrow had left the visible rect: **0 of 1,015 frames differ** (0 px, channel delta 0).
  - The travel difference is exactly 0.
- **Recordings (EXECUTED; `fix1/framediff-6-exits.txt`, `scripts/framediff.py`).** Frames of the same six exits, paired by index from the first moved frame. Exit pairs with a recorded presentation stall are skipped, using classify.py's rule.
  - **Pre-round final vs fix 1** (6 capture pairs, 240 frames): |travel difference| median 0.000, p95 0.098, max 0.113 cell. On-screen frame counts were equal in 32/32 exit pairs.
  - **Same-build controls:** pre-round vs pre-round p95 0.097, max 0.113; fix 1 vs fix 1 p95 0.086, max 0.107; BASE vs BASE p95 0.102, max 0.119.
  - The same-build spread is the whole-ms native clock and the vsync phase.
  - **Positive control:** BASE vs either build gives median 1.1-1.3 cells and max 6.8, so the method sees a real curve difference.
  - After the pan: 3 exits, max 0.083 cell.

**3. A pan toward the exiting arrow within 150 ms of the tap** (`fix1/pan/`: `sheet-*.png` contact sheets; `fix1/superseded/pan-fix1-fade-moved/pantrack.txt` for the first build). The same three builds, with the pan starting 70 ms after UP:
- arrow 12 exiting Right, with the board dragged left (850 px in 250 ms, and in 100 ms);
- arrow 9 exiting Left, dragged right (both speeds);
- arrow 24 exiting Up, dragged down (the board is centred vertically, so rubber band only).

What the player sees (EXECUTED; sheets inspected frame by frame, 16.7 ms steps from +130 to +330 ms):
- **Fix 1: the arrow keeps moving and leaves through the screen edge, in all 5 scenarios.**
  - Its frames match the pre-round build's: at the fast right drag, a tail stub at the edge at +263 ms and gone at +280.
  - It never fades or vanishes inside the screen. The stop is skipped because the camera moved.
- **BASE:** its faster ease-in tail leaves through the edge earlier (+213 ms in the fast right drag).
- **The rejected fade variants:** in the same fast drag the arrow faded out mid-screen (fix1b), and in the normal drag it faded as a stub at the edge (fix1).
- **INFERRED, not tested:** a pan that starts after `endMs`. At that moment the arrow is already past the extent and invisible, so there is nothing on screen to vanish; the revealed margin is simply empty.

**4. Motion criteria re-run** (`fix1/summary/summary.md`; 2 sequence recordings plus 1 pan recording of fix 1, host load 2-4; the high-load capture is not used):

| | exits | latency median (frames) | visible median / range ms | first step ≥ 0.4 | visible 120-280 | peak ≤ 30% | ratio ≥ 0.8 | jerk ≤ 0.5 | opaque |
|---|---|---|---|---|---|---|---|---|---|
| BASE seq1, 2, 4 + pan | 84 | 70.5 ms (4.23) | 208 / 134-322 | 84 | 78 | 0 | 0 | 84 | 84 |
| fix 1 seq1 | 27 | 73.2 ms (4.39) | 210 / 158-259 | 27 | 27 | 26 | 27 | 27 | 27 |
| fix 1 seq2 | 27 | 68.6 ms (4.11) | 200 / 162-261 | 27 | 27 | 19 | 27 | 27 | 27 |
| fix 1 pan | 3 | 63.3 ms (3.80) | 201 / 181-219 | 3 | 3 | 3 | 3 | 3 | 3 |

- The 9 peak failures (`fix1/caps/classify.txt`) are 6 **TIE** (within the 6% resolution) and 3 near-edge Left exits (9, 28, 8). For those the only feature is the tail at a corner; it is the systematic bias described above.
- There were 0 ratio or jerk failures and 0 stalls in these two recordings.

**5. Blink re-check** (`fix1/blink/table.md`): POLISH-T6 `capture.mjs` + `aggregate.py`, unchanged, on fix 1. 3 sessions at scales 1/1/1 and 3 at 0/0/0, read back after relaunch.
- **0 ABSENT at mount, 0 at unmount, 0 ghost frames over 36 taps.**
- 60 → 59 left in every session.

**6. TDD and gates** (`tdd/`, `gates/*-fix1.txt`):
- **RED** (`tdd/red-fix1-on-preround.txt`): the new `exitTruncation` tests plus the new serializer test, run on a copy of the pre-round sources. ts-jest type diagnostics were off so the not-yet-existing `endMs` field compiles.
  - **4 fail for the right reason:**
    - the serializer drops `endMs` (the payload has no `,150`);
    - `endMs` is not an integer (it is undefined);
    - the fix-1 payload is not "pre-round payload + `,endMs`";
    - the travel at `endMs` is NaN.
  - 5 guards pass.
- **GREEN** (`tdd/green-fix1.txt`): 31/31 across the four exit test files.
- `npx tsc --noEmit`: exit 0.
- `npx jest`: **71 suites, 1098 tests passed.** That is +1 suite (`exitTruncation`, 4 tests) and +1 serializer test.
- The earlier fade-end test was removed together with that design.
- `git diff --check`: clean.

**Builds** (`builds/`, `scripts/build.sh`, gradle incremental, test ads, `df -h /` right before = 8.9, 8.9 and 8.8 GiB):
- `t10-fix1` (end + fade moved) and `t10-fix1b` (end + fade at end) were superseded and deleted.
- `t10-fix1c` is shipped: `artifacts/POLISH-T10/arrows-testads-T10-fix1.apk`, sha256 `731aad79…2125`, bundle `083c4213…bbb0`.
- Bundle proof: TestIds present, 0 owner units in ASCII and UTF-16LE. The signer equals BASE's.
- The dex contains `ArrowsBoard.setExitAnimation`, `cameraMoved` was compiled in, and the Kotlin compile task ran.

**Owner videos, updated** (`owner-exit-before-after-x1.mp4`, `-x4.mp4`):
- BASE `seq4` on the left, fix 1 `fixc-seq1` on the right, the same 12 taps, aligned on UP.
- The pre-round versions are in `fix1/superseded/owner-videos-pre-round/`.
- `owner-exit-curves-x4.mp4` is unchanged: it compares curves, and the on-screen frames of the shipped curve are identical.

**Decisions (fix round 1)**
1. **An explicit `endMs` token, not a re-parametrised curve.** Only the token keeps every on-screen frame bit-identical (measured).
2. **The camera check sits at the stop, not every frame.** Native reads three floats from the parent once, at `endMs`.
3. **The pan margin stays 0.25.** Widening it to cover the observed reveal costs about +4 frames per exit; the pan-aware stop costs 0.
4. **Web and iOS run to `durationMs`.** The perf target is the Android native view, and `BoardView.tsx` stays untouched.
5. **`EXIT_EDGE_AA_PT = 2`** and **`CAMERA_STILL_PX = 0.5` / `CAMERA_STILL_SCALE = 1e-4`** are marked `OWNER-PICKED STARTING VALUE`.

**Concerns (fix round 1)**
1. **The camera check reads the parent view's transform.** That holds because the board view's direct parent is the camera `Animated.View`, and the pan test shows the check fired. If the view hierarchy ever changes, the check falls back to running the whole ray (`parent as? View` is null).
2. **The first exit after level load is often buffer-stuffed in every build.** This is BASE's first full-board re-raster; it is not caused by this change and was not addressed.
3. **Latency** is unchanged: a median of 4.1-4.4 frames, and the Part 2 patch stays unapplied.
4. **UNVERIFIED:** the Swift parse (not compiled), the web path (unchanged, not re-run), and physical devices.

**Owner acceptances (fix round 1)**
- `owner-exit-before-after-x4.mp4` (and `-x1`), rebuilt from fix 1: the same verdict as before (instant launch, steady speed)? **yes/no**
- `fix1/pan/sheet-right-fast.png`: when the player drags toward an arrow right after tapping it, it keeps flying off through the screen edge (fix 1 column = pre-round column). Acceptable? **yes/no**

**Device state left (current):**
- emulator-5556 is running, scales 1/1/1 (`device-restore.txt`).
- Installed: `artifacts/POLISH-T10/arrows-testads-T10-fix1.apk` (sha256 `731aad79…2125`). Tutorial done; level 1 opens at 60 left.
- The app is stopped at Home, and `/data/local/tmp/t10-*` is removed.

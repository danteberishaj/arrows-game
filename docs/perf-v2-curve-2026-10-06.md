# Are v2's worst boards affordable on the emulator? (W3-15, 2026-10-06)

**Answer (emulator only, UNVERIFIED-DEVICE).** v2's heaviest board for a fresh install, index 80507
(194 arrows, Plus 36x36), shows **no detectable difference from v1's index 3827** (250 arrows, Flower
39x39) in any frame phase. Every paired difference is inside the A/A noise floor, which was wide on this
loaded Mac. It **generates faster on device**: median 62.2 / 57.1 ms against v1's 90.9 / 93.5 / 84.9 ms.
Both paired differences (-31.3 and -27.8 ms) exceed the A/A floor of 8.6 ms, so v2's heaviest board costs
about 0.67x of v1's 3827 to generate. The **absolute frame gates could not be evaluated**: the 1-minute host
load had a median of 5.6 to 18.9 per session on 8 cores, and the gate needs a quiet host. The worst board
is under 250 arrows, so W3-15's "lower the ceiling" rule does not apply. `GEN_V2_ENABLED` is still
`false`.

Every number is from the Android emulator (AVD `fleet_floor_api31`, API 31, `-gpu host`, emulator-5556,
arm64 guest on an 8-core Apple-silicon Mac). There is no physical phone and no iOS.

## 1. Which board is "worst" (EXECUTED, live generator, ceiling 354/354)

`src/core/curve.ts` holds `CEILING_BASE_CELLS = 354` and `V1_FLOOR_BASE_CELLS = 354` (RE-CEILING, owner
pick B). W3-14 (e) defines the worst board as the largest `arrowCount` over indices 0..99,999 sampled
every 7th. The one-liner, run at HEAD `ef56940` (output in `artifacts/W3-15/logs/worst-boards.txt`; 7 min
39 s of CPU on the loaded host):

```sh
npx tsx -e "import {LevelGenerator as G} from './src/core/levelGenerator'; const best=(xs,f)=>xs.reduce((b,i)=>{const l=f(i);return !b||l.arrowCount>b.n?{i,n:l.arrowCount,s:l.shapeName,r:l.board.rows,c:l.board.cols}:b},null); const r=(a,b,s)=>Array.from({length:Math.ceil((b-a+1)/s)},(_,k)=>a+k*s); console.log(JSON.stringify({fresh_e_0_99999_step7:best(r(0,99999,7),i=>G.generate(i,2)), fresh_every_0_9999:best(r(0,9999,1),i=>G.generate(i,2)), existing_s1_e_0_99999_step7:best(r(1,99999,7),i=>G.generate(i,2,{switchLevel:1})), existing_s1_every_1_9999:best(r(1,9999,1),i=>G.generate(i,2,{switchLevel:1})), v1_3827:best([3827],i=>G.generate(i,1))}))"
```

| install | range | worst index | arrows | shape |
|---|---|---|---|---|
| fresh (no switch level: what a PERF build deals) | 0..99,999 every 7 (W3-14 e) | **80507** | **194** | Plus 36x36 |
| fresh | every index 0..9,999 | 2705 | 190 | Plus 36x36 |
| existing player, `switchLevel: 1` | 1..99,999 every 7 | 82769 | 200 | Rectangle 21x32 |
| existing player, `switchLevel: 1` | every index 1..9,999 | 4943 | 195 | Plus 36x36 |
| v1 (A, the harness default) | 3827 | 3827 | 250 | Flower 39x39 |

- The fresh-install rows match RE-CEILING's "shipped curve at 354" table (194 at 80507; 190 at 2705).
- RE-CEILING lists the existing player's 0..99,999 worst as 197 (index 80801). With `switchLevel: 1`, this
  one-liner finds 200 at 82769. RE-CEILING does not name the switch level it used, so the two may differ
  in that parameter. This is not reconciled here.
- **B = index 80507, v2.** A PERF build never hydrates a save, so it always deals the fresh-install curve
  (`src/perfMode.ts`, V2-WIRE). The existing-player boards (195 to 200 arrows) therefore **cannot be dealt
  on device** without a new switch-level knob. They are within 6 arrows of B and well under A's 250.
  UNVERIFIED-DEVICE.

## 2. Harness change (EXECUTED, TDD)

Before the change, `node scripts/perf/android/benchmark.mjs --level 5363` printed `Error: The
single-level workload is pinned to level 3827` (`artifacts/W3-15/logs/prefix-repro-level-5363.txt`).

- `benchmark.mjs` takes `--level <index> --gen-version 1|2`. It builds the plan from the same generator
  call the PERF build makes (`soak-plan.ts --single-level`). Taps, gestures, the exit tap and the
  blocked taps all use the plan's **rows and cols**; 3827/v1 stays the default.
- The run is invalid unless the planned solve has exactly `arrowCount` taps
  (`assertTapPlanMatchesArrowCount`). On device, validation still checks the "N left" counter after the
  exit tap.
- Blocked cells come from the plan. 3827/v1 keeps the historical (35,19), (31,14), (30,21), each checked
  blocked on the fresh board. Other boards use the three blocked heads nearest the same relative spot.
- The exit phase taps at 250 arrows left on a board of 250 or more, as before. On a smaller board it taps
  the full board: B's exit is measured at **194 arrows**, A's at 250.
- `perfBuildEnv` sets `EXPO_PUBLIC_PERF_GEN_VERSION`, and soak mode passes `--gen-version` to the planner.
- On-device generation time: PERF builds log one `[gen] index= version= arrows= rows= cols= ms=` line per
  campaign deal (`src/ui/gameSessionLifecycle.ts`, timing only the `LevelGenerator.generate` call). The
  harness reads them from logcat after each launch and reports launches against matching lines.
- **SurfaceFlinger read order (found during this task).** The overflow guard ("filled the SurfaceFlinger
  history", at 120 or more raw frames) rejected whole sessions: 3 of 3 attempts on B, plus A attempts.
  A diagnostic split showed the overflow came **after** the driver window: 122 = 1 before + 48 inside + 73
  after; 127 = 0 + 30 + 97 (`artifacts/W3-15/diag/`). The board's latency history is now read first, as
  soon as the driver returns, then the root's, gfxinfo and meminfo. Frames inside the window are the same
  in any order; the guard is unchanged. After the change, 40 B pan runs gave no overflow, and the final
  series had no overflow rejection.
- Tests (RED first, `artifacts/W3-15/tdd/`): `npx tsx --test scripts/perf/android/soak-plan.test.ts` gives
  6/6. The test "index 5363 reports rows 34 and cols 37" failed first. `node --test
  scripts/perf/android/*.test.mjs` gives 64/64 (58 before). The test "the single-level plan for index
  5363 reads rows 34 and cols 37 from the level" goes through the harness's own planner subprocess.

## 3. Method

- Two PERF release APKs built from the same tree. Only the level and the version differ:
  - A = `EXPO_PUBLIC_PERF_LEVEL=3827`, `EXPO_PUBLIC_PERF_GEN_VERSION=1`, sha256 `9607203e…59fc9c5`;
  - B = `80507` / `2`, sha256 `cec68fef…1e1499`.
  - Shared: test ads, `EXPO_PUBLIC_PERF_FEEDBACK=1`, exit duration 180 ms, flags default (fit camera; no
    `META_*`). Each Hermes bundle was proved before install (`artifacts/W3-15/build/*/proof.txt`).
- Series **A1 / A2 / B1 / A3 / B2**, one emulator session, each `--feedback --runs 10 --warmups 1`, all six
  phases, **`--motion-scale 1`**. The read-back was 1/1/1 and the app reported `appReducedMotion: false` in
  every session, so **every `exit` number is the moving slither, not the reduced-motion variant**. No
  scale-0 run was taken.
- **Noise floor** per metric: the largest pairwise |difference| among A1, A2 and A3. A1 against A2 is the
  first v1-against-v1 pair. **Paired differences:** B1 - A2 and B2 - A3, each B against the A just before
  it. A difference counts as detectable only when **both** pairs exceed the floor with the same sign.
- Rule 3 (`docs/perf-harness.md`): a same-day `--assert-rendered blocked,exit` run at scale 1 passed for
  both APKs (`artifacts/W3-15/rendered/`):
  - A: blocked 2,941 px against floor 28; exit displacement 27.9 px against floor 1;
  - B: blocked 2,388 px; exit displacement 147.9 px.
  - Screenshot of the B board: `artifacts/W3-15/series/S3-B1-board.png` ("LEVEL 80508 · Super Hard ·
    Plus · 194 left").
- Sessions rejected by the harness's own validity checks were re-run from scratch, keeping every attempt.
  The final series had one rejection: S5-B2 attempt 1, an input-driver pinch killed by its 30 s timeout.
  Earlier series, abandoned for the read-order fix, are kept in `artifacts/W3-15/series-pre-reorder/` and
  `series-attempt2-meminfo-first/` and are not used.

## 4. Frame phases: paired differences against the A/A floor (EXECUTED)

gfx = `dumpsys gfxinfo framestats` frame durations (ms). "board present-interval" = SurfaceFlinger
present intervals of the board layer inside the driver window (ms). Janky = % of gfx frames over budget.

| phase | metric | A1 | A2 | B1 | A3 | B2 | A/A floor | B1−A2 | B2−A3 | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| ALL | gfx p50 | 8.06 | 20.12 | 13.33 | 7.76 | 10.01 | 12.36 | -6.79 | 2.26 | no detectable difference |
| ALL | gfx p95 | 22.79 | 61.42 | 60.01 | 21.87 | 20.71 | 39.55 | -1.41 | -1.16 | no detectable difference |
| ALL | gfx p99 | 42.80 | 126.13 | 121.98 | 35.90 | 22.79 | 90.23 | -4.15 | -13.12 | no detectable difference |
| ALL | janky % | 37.89 | 68.11 | 46.22 | 35.00 | 24.53 | 33.11 | -21.89 | -10.47 | no detectable difference |
| ALL | board present-interval p95 | 32.67 | 33.52 | 32.99 | 20.00 | 19.78 | 13.52 | -0.53 | -0.22 | no detectable difference |
| zoomIn | gfx p50 | 19.78 | 21.10 | 16.50 | 14.69 | 13.75 | 6.41 | -4.60 | -0.94 | no detectable difference |
| zoomIn | gfx p95 | 48.57 | 78.57 | 70.51 | 25.09 | 20.47 | 53.48 | -8.06 | -4.62 | no detectable difference |
| zoomIn | gfx p99 | 72.52 | 98.12 | 116.89 | 31.05 | 21.79 | 67.07 | 18.77 | -9.26 | no detectable difference |
| zoomIn | janky % | 58.93 | 66.08 | 49.44 | 44.79 | 31.21 | 21.30 | -16.64 | -13.57 | no detectable difference |
| zoomIn | board present-interval p95 | 34.69 | 38.63 | 36.44 | 32.95 | 33.27 | 5.67 | -2.19 | 0.32 | no detectable difference |
| panHorizontal | gfx p50 | 5.93 | 20.03 | 10.52 | 6.04 | 9.58 | 14.09 | -9.50 | 3.55 | no detectable difference |
| panHorizontal | gfx p95 | 9.50 | 64.01 | 43.20 | 21.09 | 20.06 | 54.51 | -20.81 | -1.03 | no detectable difference |
| panHorizontal | gfx p99 | 12.63 | 128.66 | 76.04 | 23.17 | 21.66 | 116.03 | -52.62 | -1.52 | no detectable difference |
| panHorizontal | janky % | 0.27 | 69.83 | 24.24 | 20.29 | 10.04 | 69.56 | -45.58 | -10.26 | no detectable difference |
| panHorizontal | board present-interval p95 | 18.80 | 33.28 | 21.37 | 20.56 | 19.78 | 14.48 | -11.91 | -0.77 | no detectable difference |
| panVertical | gfx p50 | 7.22 | 19.47 | 9.48 | 6.32 | 9.64 | 13.15 | -9.99 | 3.32 | no detectable difference |
| panVertical | gfx p95 | 22.22 | 44.92 | 95.76 | 20.06 | 12.37 | 24.85 | 50.84 | -7.69 | no detectable difference |
| panVertical | gfx p99 | 25.22 | 72.36 | 154.92 | 22.42 | 13.95 | 49.94 | 82.56 | -8.47 | no detectable difference |
| panVertical | janky % | 30.24 | 56.49 | 35.17 | 9.95 | 0 | 46.54 | -21.32 | -9.95 | no detectable difference |
| panVertical | board present-interval p95 | 33.44 | 32.96 | 22.56 | 18.57 | 19.18 | 14.86 | -10.40 | 0.60 | no detectable difference |
| zoomOut | gfx p50 | 19.79 | 20.52 | 20.21 | 19.63 | 19.59 | 0.89 | -0.30 | -0.03 | no detectable difference |
| zoomOut | gfx p95 | 23.28 | 57.10 | 74.50 | 36.04 | 21.52 | 33.82 | 17.40 | -14.53 | no detectable difference |
| zoomOut | gfx p99 | 38.08 | 86.88 | 112.47 | 37.78 | 23.41 | 49.09 | 25.60 | -14.37 | no detectable difference |
| zoomOut | janky % | 91.87 | 88.77 | 91.25 | 88.32 | 90.36 | 3.56 | 2.48 | 2.04 | no detectable difference |
| zoomOut | board present-interval p95 | 33.10 | 35.35 | 47.85 | 34.12 | 30.18 | 2.25 | 12.50 | -3.94 | no detectable difference |
| blocked | gfx p50 | 19.66 | 20.52 | 19.97 | 19.01 | 6.96 | 1.51 | -0.55 | -12.05 | no detectable difference |
| blocked | gfx p95 | 22.55 | 70.46 | 41.22 | 21.79 | 21.94 | 48.68 | -29.25 | 0.15 | no detectable difference |
| blocked | gfx p99 | 39.77 | 255.44 | 103.99 | 38.42 | 39.39 | 217.03 | -151.46 | 0.98 | no detectable difference |
| blocked | janky % | 61.21 | 76.74 | 69.38 | 50.87 | 31.81 | 25.88 | -7.36 | -19.05 | no detectable difference |
| blocked | board present-interval p95 | 19.17 | 21.02 | 21.35 | 18.84 | 19.60 | 2.18 | 0.33 | 0.76 | no detectable difference |
| exit | gfx p50 | 5.53 | 6.65 | 5.47 | 5.32 | 5.22 | 1.33 | -1.17 | -0.11 | no detectable difference |
| exit | gfx p95 | 9.59 | 38.57 | 13.03 | 10.10 | 10.61 | 28.99 | -25.55 | 0.51 | no detectable difference |
| exit | gfx p99 | 11.61 | 40.62 | 229.13 | 11.17 | 13.11 | 29.45 | 188.51 | 1.93 | no detectable difference |
| exit | janky % | 0 | 13.33 | 3.57 | 0 | 0 | 13.33 | -9.76 | 0 | no detectable difference |
| exit | board present-interval p95 | 18.84 | 20.10 | 20.68 | 18.82 | 18.65 | 1.28 | 0.58 | -0.16 | no detectable difference |

**Reading.**
- Every row is "no detectable difference".
- The floor is wide because the host load moved during the series. A2 ran during a load spike of up to
  37.1 and is far worse than A1 and A3 in almost every row.
- Two single-pair differences exceed the floor but are not replicated: B1's panVertical gfx p95 (+50.8 ms)
  and B1's exit gfx p99 (+188.5 ms). B2 went the other way (-7.7, +1.9), so they are not findings.
- The steadiest metric, board present-interval p95, differs from A by 0.16 to 12.5 ms per pair, and
  B2 is below A3 in four of seven rows.

## 5. Sample reconciliation (window x 60 Hz)

| session | phase | runs | window ms | expected @60 Hz | gfx frames | ratio | board frames | ratio |
|---|---|---|---|---|---|---|---|---|
| S1-A1 | zoomIn | 10 | 10062.5 | 603.8 | 448 | 0.742 | 420 | 0.696 |
| S1-A1 | panHorizontal | 10 | 10043.8 | 602.6 | 1113 | 1.847 | 540 | 0.896 |
| S1-A1 | panVertical | 10 | 10035.3 | 602.1 | 764 | 1.269 | 509 | 0.845 |
| S1-A1 | zoomOut | 10 | 10040.9 | 602.5 | 443 | 0.735 | 443 | 0.735 |
| S1-A1 | blocked | 10 | 5775.5 | 346.5 | 812 | 2.343 | 274 | 0.791 |
| S1-A1 | exit | 10 | 4565.2 | 273.9 | 120 | 0.438 | 120 | 0.438 |
| S2-A2 | zoomIn | 10 | 10115.7 | 606.9 | 457 | 0.753 | 425 | 0.7 |
| S2-A2 | panHorizontal | 10 | 10071.5 | 604.3 | 1034 | 1.711 | 473 | 0.783 |
| S2-A2 | panVertical | 10 | 10066.3 | 604.0 | 763 | 1.263 | 507 | 0.839 |
| S2-A2 | zoomOut | 10 | 10060.5 | 603.6 | 383 | 0.634 | 383 | 0.634 |
| S2-A2 | blocked | 10 | 5804.3 | 348.3 | 774 | 2.222 | 239 | 0.686 |
| S2-A2 | exit | 10 | 4579.6 | 274.8 | 120 | 0.437 | 120 | 0.437 |
| S3-B1 | zoomIn | 10 | 10092.5 | 605.5 | 445 | 0.735 | 415 | 0.685 |
| S3-B1 | panHorizontal | 10 | 10060.0 | 603.6 | 1089 | 1.804 | 522 | 0.865 |
| S3-B1 | panVertical | 10 | 10063.4 | 603.8 | 782 | 1.295 | 511 | 0.846 |
| S3-B1 | zoomOut | 10 | 10056.3 | 603.4 | 400 | 0.663 | 397 | 0.658 |
| S3-B1 | blocked | 10 | 5784.0 | 347.0 | 774 | 2.23 | 244 | 0.703 |
| S3-B1 | exit | 10 | 4605.6 | 276.3 | 112 | 0.405 | 110 | 0.398 |
| S4-A3 | zoomIn | 10 | 10046.7 | 602.8 | 489 | 0.811 | 459 | 0.761 |
| S4-A3 | panHorizontal | 10 | 10032.1 | 601.9 | 1094 | 1.818 | 519 | 0.862 |
| S4-A3 | panVertical | 10 | 10038.3 | 602.3 | 804 | 1.335 | 549 | 0.912 |
| S4-A3 | zoomOut | 10 | 10040.8 | 602.4 | 428 | 0.71 | 428 | 0.71 |
| S4-A3 | blocked | 10 | 5772.7 | 346.4 | 808 | 2.333 | 273 | 0.788 |
| S4-A3 | exit | 10 | 4572.7 | 274.4 | 120 | 0.437 | 120 | 0.437 |
| S5-B2 | zoomIn | 10 | 10043.6 | 602.6 | 487 | 0.808 | 457 | 0.758 |
| S5-B2 | panHorizontal | 10 | 10033.4 | 602.0 | 1096 | 1.821 | 525 | 0.872 |
| S5-B2 | panVertical | 10 | 10033.3 | 602.0 | 803 | 1.334 | 550 | 0.914 |
| S5-B2 | zoomOut | 10 | 10044.4 | 602.7 | 446 | 0.74 | 446 | 0.74 |
| S5-B2 | blocked | 10 | 5784.0 | 347.0 | 811 | 2.337 | 277 | 0.798 |
| S5-B2 | exit | 10 | 4572.3 | 274.3 | 120 | 0.437 | 120 | 0.437 |

- **Board frames**, windowed to the driver's timestamps:
  - gestures: 0.63 to 0.91 of the 60 Hz slots. The missing slots are frames this loaded emulator did not
    present;
  - exit: 0.40 to 0.44 of a 457 ms window. The window is the tap, the 180 ms slither and a 240 ms grace,
    and SurfaceFlinger presents only when something changes. 12 frames per run (11 in B1) is about one
    frame per 16.7 ms across the 180 ms animation, so the animation itself is fully sampled.
- **gfx frames are not windowed.** gfxinfo counts from `reset` to the dump, so panHorizontal (about 1.8x),
  panVertical (about 1.3x) and blocked (about 2.3x) include post-gesture motion and the 300 ms blocked feedback. That is identical
  across A and B, so the paired differences remain meaningful, but gfx percentiles describe
  "window plus tail". They are not a pure input-window cadence.
- Counts are equal across A and B to within the run-to-run spread, so no phase compares a full sample
  against a starved one.

## 6. Generation time on device (EXECUTED, `[gen]` lines)

Each launch is a fresh process. The number is the **first** `LevelGenerator.generate` call in that
process under Hermes: a cold level open, not a warm Next-level transition.

| session | launches | [gen] lines matching | reconciled | min | median | p95 | max ms |
|---|---|---|---|---|---|---|---|
| S1-A1 | 69 | 69 | True | 77.95 | 90.92 | 141.27 | 183.65 |
| S2-A2 | 69 | 69 | True | 79.96 | 93.47 | 295.62 | 918.62 |
| S3-B1 | 70 | 70 | True | 54.28 | 62.20 | 196.98 | 579.90 |
| S4-A3 | 69 | 69 | True | 79.73 | 84.90 | 92.46 | 96.87 |
| S5-B2 | 69 | 69 | True | 53.77 | 57.11 | 64.52 | 67.36 |


- **Reconciled:** in every session, launches equal `[gen]` lines that match the plan's index, version and
  arrow count, with exactly one line per launch. That is 69 or 70 launches: 10 runs x 6 phases, plus 1
  warmup x 6, plus 3 validation launches (B1 also has 1 screenshot launch).
- Medians: A 90.9 / 93.5 / 84.9 ms (floor 8.6 ms); B 62.2 / 57.1 ms. Paired: B1 - A2 = **-31.3 ms**,
  B2 - A3 = **-27.8 ms**, both beyond the floor. **v2's heaviest board generates in about 0.67x the time
  of v1's index 3827.** The tails (A2 max 918.6, B1 max 579.9) happened under the same load spike as the
  frame outliers.
- Node, same boards (`npm run perf:core -- --gen-version 2 --level 80507` and `--gen-version 1 --level
  3827`, 2 x 600 samples each, load 14 to 17): p50 **8.00 / 8.08 ms** against **12.37 / 12.36 ms**
  (x0.65). That is the same direction and ratio as on device (`artifacts/W3-15/logs/perf-core-*.json`).
- The emulator figure for v1 3827 is in line with W2-04's 74.5 ms for a Next into 3827 (a warm call) and
  with this task's earlier smoke runs (101.3 ms median during a gradle build).

## 7. Host load and absolute gates

- 1-minute load average, sampled every 30 s (`artifacts/W3-15/series/host-load-per-session.txt`):
  - A1: median 5.6, max 8.7;
  - A2: median 8.6, max 37.1;
  - B1: median 18.9, max 37.2;
  - A3: median 15.7, max 17.8;
  - B2: median 15.1, max 20.2.
- Each session had exactly one emulator running (emulator-5556). Other processes on the Mac included
  another project's long-running Playwright worker at about 100% CPU, Chrome, mobileassetd and Avast.
- **Absolute gates (p95 ≤ 20 ms, p99 ≤ 34 ms, janky ≤ 10%) were not evaluable.** The field guide's quiet
  host needs a load under 4 and an idle scanner; every session's median exceeded 4. ALL-phase gfx p95 was
  20.7 to 61.4 ms, depending on load rather than board. Only the paired differences against the floor are
  results.
- Memory, PSS median per session: A 157.2 / 159.4 / 159.7 MB, B 160.5 / 163.0 MB. That is +1.1 / +3.3 MB
  for B in each pair, against a 2.5 MB A/A spread: one pair inside the floor, one above it. Not a finding.

## 8. Not measured (UNVERIFIED)

- A physical phone, any other GPU, iOS: every number here is the emulator.
- The existing-player worst boards (195 to 200 arrows). A PERF build cannot deal them (section 1).
- The META_ZOOMED_CAMERA opening (cells about 29 dp, full-detail skins). This harness taps at fit and
  measured the flags-default renderer. The skin-picker configuration's opening cost is ART-SKINS-08's
  measurement, not this one.
- A warm, in-process Next-level generation of the v2 board. Only cold launches were timed.

## 9. Reproduce

```sh
export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH
sh artifacts/W3-15/build-apk.sh <out> artifacts/W3-15/build/flags-A-v1-3827.env 1    # then flags-B-v2-80507.env 0
python3 artifacts/W3-15/prove-apk.py <out>/app.apk perf --must "[gen] index="
sh artifacts/W3-15/run-series.sh <A.apk> <B.apk> 80507                              # A1 A2 B1 A3 B2
python3 artifacts/W3-15/analyze.py artifacts/W3-15/series
# a single run by hand:
node scripts/perf/android/benchmark.mjs --feedback --skip-build --apk <B.apk> --level 80507 --gen-version 2 --motion-scale 1
```

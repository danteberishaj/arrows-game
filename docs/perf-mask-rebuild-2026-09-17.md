# Visibility-mask rebuild on the blocked-tap path (W6-01, 2026-09-17)

**Question.** A blocked tap sets `shaking` and clears it 340 ms later. Each change rebuilds the
visibility mask in JS (`BoardArrowArtCache.visibilityMask`, O(n) string) and on Android
(`ArrowsBoardView.setVisibleMask` → `rebuildCompoundPathsLocked`, O(n) `Path.addPath`). The perf
review claimed this rebuild is *why* `blocked` is the worst phase (35.7–55.1 ms p95 in
`docs/perf-tap-forgiveness-ab-2026-09-08.md`). That claim was INFERRED.

**Answer (emulator only).**

| Part of the rebuild | Status | Level 3827 (250 arrows), per rebuild | Share of the blocked frame p95 |
|---|---|---|---|
| JS mask build | **Measured** (EXECUTED, on-device timer) | n = 20, median 0.0416 ms, p95 0.0939 ms | ≤ 0.2 % |
| Native `setVisibleMask` | **Measured** (EXECUTED, Perfetto app trace) | n = 20, median 0.1352 ms, p95 0.2460 ms | ≤ 0.5 % |

- **The claim is refuted directly.** In the fresh native session, the two JS builds plus the two
  native calls per blocked tap had a paired p95 of 0.7484 ms (n = 10), versus a 55.9331 ms blocked
  frame p95 in the same session: 1.34% if divided, **INFERRED**. The ratio is not additive
  attribution; the set and clear run in different frames 340 ms apart.
- **What does happen.** `blocked` frames are expensive because a blocked tap causes React commits
  (mask set, first-tap heart charge, mask clear). On this emulator, frames that carry a commit cost
  8–9 ms median (UI `doFrame` + RenderThread `DrawFrames`). Frames without one cost 0.14 ms median.
  The O(n) work inside those commits is a small part of that. INFERRED from Perfetto sections; the
  frame p95 is not additive with these durations.
- **Fabric cross-check (INFERRED upper bound, not the native result).** Every one of the 20 measured
  native sections is nested inside its Fabric `UPDATE_PROPS` batch. Those enclosing batches were
  n = 20, median 0.3130 ms, p95 0.6518 ms, max 1.4173 ms. The measured native p95, 0.2460 ms,
  satisfies the earlier ≤ 0.43 ms prediction.

Every number here is from the Android emulator (API 31, AVD `fleet_floor_api31`, `-gpu host`:
"Android Emulator OpenGL ES Translator (Apple M1 Pro)") or from node on the Mac. It is
UNVERIFIED-DEVICE: a physical phone may rank these costs differently.

## Instruments

| Timer | What it wraps | Smallest non-zero duration it reported | Resolution note |
|---|---|---|---|
| Node `performance.now()` (`scripts/perf/mask-rebuild-benchmark.ts`) | one `visibilityMask` call; one set+mask+set+mask cycle | 0.0018 ms (level 0 mask build) | sub-µs clock (stable knowledge) |
| Hermes `performance.now()` around the `nativeVisibilityMask` memo body (`src/ui/BoardView.tsx`, only with `EXPO_PUBLIC_PERF_MASK_TIMING=1`) | the memo body (`arrowArtCache.visibilityMask(arrows, excludedArrows)`) | 0.0100 ms (level 11); 0.0313 ms (level 3827) | clock step probe min 0.000041 ms (session 2; session 1 printed it at 4 decimals as 0.0000) |
| Perfetto app atrace (`IntBufferBatchMountItem::mountInstructions::UPDATE_PROPS numInstructions=N`, React Native's own section) | Fabric applying N prop-update instructions, synchronously, including the Expo prop setter that calls `setVisibleMask` (INFERRED from `ViewManagerWrapperDelegate.updateProperties` source) | 0.0861 ms (level 11) | ftrace timestamps in ns |
| Perfetto `ArrowsBoard.setVisibleMask` (committed in `ArrowsBoardView.kt`) | the `setVisibleMask` body | 0.0747 ms (fresh measured runs) | ftrace timestamps in ns |

Per the brief, **no difference smaller than the instrument's smallest non-zero duration is quoted as
a finding.** In particular:
- the level 11 vs level 3827 difference in the Fabric-section bound (median 0.150 vs 0.215 ms) is
  0.065 ms, below that section's 0.086 ms floor, so it is not a finding;
- the 54- vs 250-arrow difference in commit-frame cost is not a finding either (single run each, no
  replicate).

The on-device JS timer logs a `[mask] n=… min=… minNonZero=… median=… p95=… max=… clockStep=…
reason=… new=…` line three ways:
- every 50 rebuilds;
- at board unmount;
- 750 ms after the last rebuild (`reason=quiet`, `// OWNER-PICKED STARTING VALUE`).

The quiet trigger is an addition to the brief (see the report's Decisions). The benchmark force-stops
the app between samples, so the board never unmounts. Each process makes only 3 rebuilds, so with the
brief's two triggers alone the phase would have logged nothing. `new=` carries the individual
durations since the previous line; the distributions below are built from those.

## Node host distributions (pure JS, no emulator)

Command: `npx tsx scripts/perf/mask-rebuild-benchmark.ts`. 200 warmup cycles, then 2000 measured
cycles per level. Two mask builds per cycle, so mask-build n = 4000. Node v20.19.4 darwin/arm64.
Host `uptime` load averages: 3.06 3.92 4.44. Reconciliation: expected n equals observed n on every
row (printed by the script).

| Level | Arrows | Timed | n (expected) | min | median | p95 | max |
|---|---|---|---|---|---|---|---|
| 0 | 60 | mask build | 4000 (4000) | 0.0018 | 0.0022 | 0.0026 | 0.1376 |
| 0 | 60 | blocked-tap cycle | 2000 (2000) | 0.0038 | 0.0045 | 0.0058 | 0.1925 |
| 168 | 83 | mask build | 4000 (4000) | 0.0028 | 0.0030 | 0.0035 | 0.1257 |
| 168 | 83 | blocked-tap cycle | 2000 (2000) | 0.0058 | 0.0062 | 0.0070 | 0.1287 |
| 3827 | 250 | mask build | 4000 (4000) | 0.0080 | 0.0085 | 0.0096 | 0.2033 |
| 3827 | 250 | blocked-tap cycle | 2000 (2000) | 0.0164 | 0.0170 | 0.0198 | 0.2168 |

All values in ms. At level 3827 the timed arrow is `35,19,R:LLU`, the arrow the harness taps at cell
(35, 19). A replicate at load 5.44 gave 0.0086 / 0.0097 ms (median / p95) for the 3827 mask build.

## On-device sessions

S1 and S2 used a JS-only repack (memory note levelplay-emulator-fill-and-js-repack; the P-02 script
`artifacts/P-02/scripts/perf-repack.sh`) over the gradle PERF host
`artifacts/W0-04/perf/apk/fix-gradle-perf.apk`. S3 is the 2026-09-19 continuation: a fresh arm64
gradle PERF release build from `0ac6226` that contains the committed native `Trace` section.
- **Host:** sha256 `21110213a810…66d1dcc`, built from `35be887`. Native, plugins and packages are
  unchanged from `35be887` to base `21695bb` except for script entries in `package.json`.
- **Timer:** `EXPO_PUBLIC_PERF_MASK_TIMING=1`. Bundle grep of each APK: `[mask]` = 1.

| Session | APK sha256 | Workload | Host load (uptime, before → after) |
|---|---|---|---|
| S1 | `fe30f2c1eb35…ba4e6f` (clockStep printed at 4 decimals) | `perf:android --feedback --phases blocked --skip-build` | 3.64 5.33 5.49 → 4.11 5.13 5.40 |
| S2 | `7c8252b7ecfa…ed07bac` (final source) | same benchmark, then manual taps at 3827, then the level-11 APK `0d31dc3bb2b8…484c64` | 4.02 4.76 5.15 → 3.86 3.96 4.63 |
| S3 | `7da890b371d4…f1d79` (fresh native build) | `perf:android --feedback --phases blocked`, 1 warmup + 10 measured | before not captured → 20.42 28.40 26.60 immediately after; timing limitation noted |

- **Motion scale read-back (P-02, both benchmark runs):** window 0, transition 0, animator 0. The
  app reported reduced motion = true (logcat). The harness default measures the reduced-motion
  variant, and the benchmark printed that warning. The mask rebuild does not branch on reduced motion
  (`shaking` is set unconditionally).
- **S3 motion scale read-back:** window 0, transition 0, animator 0; the app reported reduced motion
  = true after the harness force-stop/relaunch. Thermal status was 0 before and after.
- **Motion during the manual runs:** the manual taps in S2 ran with scales still 0 (read back before
  the level-11 run: 0/0/0).

Commands (S2, the S1 command is identical with the first APK):

```
EXPO_PUBLIC_PERF_MASK_TIMING=1 npm run perf:android -- --feedback --phases blocked --label mask-timing \
  --skip-build --apk artifacts/W6-01/apk/mask-timing-perf-3827-v2.apk --output docs/tmp-mask-timing.json
node artifacts/W6-01/scripts/manual-taps.mjs --rows 39 --cols 39 --row 35 --col 19 --mode burst --count 10 --burst 4 --burst-interval-ms 100 --gap-ms 1500
node artifacts/W6-01/scripts/manual-taps.mjs --rows 39 --cols 39 --row 35 --col 19 --mode single --count 20 --gap-ms 1200
# level-11 APK installed, then:
node artifacts/W6-01/scripts/manual-taps.mjs --rows 46 --cols 37 --row 15 --col 17 --mode single --count 20 --gap-ms 1200
node artifacts/W6-01/scripts/manual-taps.mjs --rows 46 --cols 37 --row 15 --col 17 --mode burst --count 10 --burst 4 --burst-interval-ms 100 --gap-ms 1500

# S3 fresh native build and benchmark:
EXPO_PUBLIC_PERF_MASK_TIMING=1 ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
  npm run perf:android -- --feedback --phases blocked --label mask-timing \
  --output docs/tmp-mask-timing.json
```

- **Perfetto:** ran in the background for every session (`linux.ftrace` with atrace `gfx`, `view`,
  `input` and `atrace_apps: "com.danteb.arrows"`; ring buffer, write-into-file). S3's config,
  command log and 18.2 MB raw trace are under `artifacts/W6-01/native/`.
- **Parsing:** `artifacts/W6-01/scripts/pftrace-sections.mjs`, a dependency-free proto walker. It
  sorts events globally before B/E matching and reported 0 unmatched ends and 0 negative durations.
- **Distributions:** `artifacts/W6-01/scripts/analyze.mjs`, with frame attribution by
  `frame-attribution.mjs` and `steady-mask-frames.mjs`.
- **Where the results live:** `artifacts/W6-01/` (gitignored, not committed).

### Proof the state transition happened (pre-fix reproduction, not a defect)

- **JS timer counts equal the expected rebuilds in every set** (tables below): the instrumented
  build was installed, and each blocked tap produced exactly two mask changes.
- **Touch counts match the taps issued:** Perfetto's `receiveEvent('topTouchStart')` count per
  process equals the taps issued (1 per benchmark process, 20 or 40 per manual process).
- **S3 native section count is non-zero and exact:** the successful fresh APK produced 20 measured
  `ArrowsBoard.setVisibleMask` sections for 10 blocked cycles, and 22 for warmup + measured. The
  mount-time call in each process is excluded by beginning at the first delivered touch.
- **Historical S1/S2 native count was 0:** those JS-only repacks predated the native section. Their
  Fabric section remains only a labelled historical upper bound.
- **Negative control (null run):** re-tapping the same arrow inside its 340 ms shake window changes
  nothing in the mask. 40 taps in 10 bursts produced exactly 20 JS rebuilds, not 80, at both levels.
  Perfetto shows no mount batch at all for the re-taps, so the timer does not fire on taps that leave
  the mask unchanged.

### Sample reconciliation

- **Expected rebuilds** = blocked cycles × 2: one tap per cycle for single taps, one burst per cycle
  for the null run.
- **Mount builds are excluded.** Every process also makes one mount build (logged as `n=1`), which is
  reported separately.
- **Fabric batches are counted per mask change.** The first tap in a fresh process also commits one
  extra single-instruction heart-charge batch, which is excluded; the same 6,1 pattern was seen in
  every process. Every later mask change is its own batch.

| Set | Taps issued (seen in trace) | Expected rebuilds | Observed JS timings | Observed native `setVisibleMask` sections | Observed Fabric mask batches |
|---|---|---|---|---|---|
| S1 benchmark, warmup + 10 runs, 3827 | 11 | 22 | 22 | 0 (not in APK) | 22 |
| S1 benchmark, 10 measured runs only | 10 | 20 | 20 | 0 | 20 |
| S2 benchmark, warmup + 10 runs, 3827 | 11 | 22 | 22 | 0 | 22 |
| S2 benchmark, 10 measured runs only | 10 | 20 | 20 | 0 | 20 |
| S2 manual single taps, 3827 | 20 | 40 | 40 | 0 | 40 |
| S2 null run (10×4 same arrow), 3827 | 40 | 20 | 20 | 0 | 20 |
| S2 manual single taps, level index 11 (54 arrows) | 20 | 40 | 40 | 0 | 40 |
| S2 null run (10×4 same arrow), level index 11 | 40 | 20 | 20 | 0 | 20 |
| **S3 fresh benchmark, warmup + 10 runs, 3827** | **11** | **22** | **22** | **22** | **22** |
| **S3 fresh benchmark, 10 measured runs only** | **10** | **20** | **20** | **20** | **20** |

JS mismatches: 0. Native mismatches in S3: 0. Fabric-batch mismatches: 0. All 20 measured S3 native
sections are nested inside the 20 Fabric batches used for the proxy cross-check.

- **Processes outside the sets.** They were counted too and match what they did:
  - the validation exit tap: 1 mount + 1 rebuild;
  - the validation run of three distinct blocked arrows: 1 + 6.
- **Processes with no line.** The first launch before the motion relaunch logged nothing (S1 pid
  4965, S2 pid 7612). It was force-stopped 0.75–0.79 s after `Start proc`, before the board mounted
  (mount lines arrive about 1.15 s after start in every other process). No rebuild was lost.

### Distributions (ms)

JS mask build, one memo recompute (EXECUTED):

| Set | n | min | median | p95 | max |
|---|---|---|---|---|---|
| S1 benchmark, 10 runs, 3827 | 20 | 0.0340 | 0.0430 | 0.0678 | 0.0719 |
| S2 benchmark, 10 runs, 3827 | 20 | 0.0345 | 0.0399 | 0.0741 | 0.0873 |
| **S3 fresh benchmark, 10 runs, 3827** | **20** | **0.0356** | **0.0416** | **0.0939** | **0.1137** |
| S2 manual single, 3827 | 40 | 0.0361 | 0.0436 | 0.0965 | 0.1117 |
| S2 null run, 3827 | 20 | 0.0361 | 0.0423 | 0.1107 | 0.6932 |
| S2 manual single, level 11 | 40 | 0.0100 | 0.0155 | 0.0411 | 0.1532 |
| S2 null run, level 11 | 20 | 0.0110 | 0.0132 | 0.0346 | 0.0443 |
| mount build, S2 benchmark, 3827 (separate) | 10 | 0.0318 | 0.0339 | 0.0765 | 0.0765 |

Native `setVisibleMask`, direct Perfetto app section (EXECUTED):

| Set | n | min | median | p95 | max |
|---|---|---|---|---|---|
| **S3 fresh benchmark, 10 measured runs, 3827** | **20** | **0.0747** | **0.1352** | **0.2460** | **0.5027** |
| S3 warmup + 10 measured runs, 3827 | 22 | 0.0747 | 0.1377 | 0.2460 | 0.5027 |

Mount-time `setVisibleMask` calls are excluded by selecting sections after the first delivered touch
in each process. The direct distribution's smallest non-zero value is 0.0747 ms.

Fabric `UPDATE_PROPS` batches carrying a mask change. This is an **upper bound** on native
`setVisibleMask`, because each batch also holds the other prop updates (INFERRED):

| Set | Batches | n | min | median | p95 | max |
|---|---|---|---|---|---|---|
| S1 benchmark, 10 runs, 3827 | set (6 instr.) + clear (2 instr.) | 20 | 0.2018 | 0.2860 | 0.5565 | 0.5725 |
| S2 benchmark, 10 runs, 3827 | set (6) + clear (2) | 20 | 0.2061 | 0.2703 | 0.3958 | 0.8025 |
| **S3 fresh benchmark, 10 runs, 3827** | **set (6) + clear (2)** | **20** | **0.2272** | **0.3130** | **0.6518** | **1.4173** |
| S2 manual single, 3827 | mask update only (1 instruction), taps 3–20 | 36 | 0.1512 | 0.2146 | 0.3897 | 0.4270 |
| S2 null run, 3827 | mask update only (1) | 17 | 0.1291 | 0.2030 | 0.4277 | 0.4277 |
| S2 manual single, level 11 | mask update only (1) | 36 | 0.0861 | 0.1504 | 0.4271 | 0.6620 |
| S2 null run, level 11 | mask update only (1) | 17 | 0.1051 | 0.1461 | 0.1958 | 0.1958 |

### Per-blocked-tap totals (two rebuilds per tap)

| Set | JS: both builds (n, median, p95, max) | Native: both calls (n, median, p95, max) | JS + native paired total (n, median, p95, max) | Fabric proxy (n, median, p95, max) |
|---|---|---|---|---|
| **S3 fresh benchmark, 10 runs, 3827** | **10, 0.0874, 0.1609, 0.1609** | **10, 0.2535, 0.6578, 0.6578** | **10, 0.3494, 0.7484, 0.7484** | 10, 0.7617, 1.6710, 1.6710 (INFERRED upper bound) |
| S1 benchmark, 10 runs, 3827 | 10, 0.0972, 0.1067, 0.1067 | not captured | not captured | 10, 0.5888, 1.0167, 1.0167 |
| S2 benchmark, 10 runs, 3827 | 10, 0.1064, 0.1219, 0.1219 | not captured | not captured | 10, 0.5652, 1.1983, 1.1983 |
| S2 manual single, 3827 | 20, 0.1184, 0.1460, 0.1487 | not captured | not captured | 20, 0.4693, 0.6139, 0.7335 |
| S2 manual single, level 11 | 20, 0.0426, 0.0581, 0.1650 | not captured | not captured | 20, 0.3292, 0.7195, 0.8260 |

### Blocked-phase frames from the same sessions, beside the rebuild cost

Benchmark `summary.phases.blocked` (gfxinfo), 10 measured runs each.
- **Frame-count reconciliation:** frames = sum of per-run rendered frames (S1: 7+6+7+7+6+8+6+6+6+6 = 65).
- **Reduced-motion variant:** these frames were measured with reduced motion on, so they are not
  the shipped experience.

| Session | Frames | UI frame p50 | **p95** | p99 | max | Janky % | JS per tap p95 | Native per tap p95 | (paired JS + native) / p95, INFERRED | Fabric proxy per tap p95, cross-check |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 65 | 8.87 | **46.71** | 60.89 | 60.89 | 30.8 | 0.107 | not captured | not available | 1.017 |
| S2 | 67 | 9.75 | **38.95** | 60.52 | 60.52 | 34.3 | 0.122 | not captured | not available | 1.198 |
| **S3** | **71** | **16.03** | **55.93** | **114.66** | **114.66** | **47.9** | **0.161** | **0.658** | **1.34% (0.748 / 55.933)** | **1.671** |

**The ratio is INFERRED.**
- **Not additive:** frame time and these durations are not additive. The ratio assumes that the
  whole per-tap cost landed inside one p95 frame. It cannot: set and clear are 340 ms apart. So the
  ratio is a ceiling, not an attribution.
- **Historical range:** S1 and S2 sit inside the 35.7–55.1 ms range recorded on 2026-09-08. S3 is
  0.83 ms above that historical maximum and ran after a fresh native rebuild at a much higher
  post-run host load, so no precise frame-regression comparison is made.

Where the long frames are. Perfetto; UI `Choreographer#doFrame` + RenderThread `DrawFrames` in the
harness window; INFERRED attribution, since gfxinfo totals also include GPU and composition waits
that these sections do not show:

| | S1 | S2 |
|---|---|---|
| Frames carrying a commit (mask set / heart / mask clear; the single-instruction batch after the first mask set is read as the heart charge, INFERRED), ui+rt median, p95 | 9.11, 19.81 (n = 30) | 8.22, 21.41 (n = 30) |
| Frames with no commit, ui+rt median, p95 | 0.15, 5.30 (n = 288) | 0.14, 6.85 (n = 297) |
| Longest frame of the run carried a commit | 9 / 10 (heart charge 5, mask set 3, mask clear 1) | 5 / 10, all five the heart-charge commit; the other 5 longest frames came 118–134 ms after the touch, just after the heart commit |

- **Commit frames that change only the mask:** manual single taps, taps 3–20, S2:

  | Level | UI `doFrame` median / p95 (ms) | RenderThread median / p95 (ms) | n |
  |---|---|---|---|
  | 3827 | 3.53 / 5.39 | 3.87 / 4.81 | 36 |
  | 11 | 3.41 / 5.10 | 3.70 / 6.08 | 36 |

  With 4.6× fewer arrows the cost is about the same (no replicate; not quoted as a size effect).
  Inside those S2 frames the historical Fabric proxy is ≤ 0.43 ms and the JS build ≤ 0.11 ms. S3's
  direct native result independently confirms the rebuild is small. **The commit-frame overhead is
  not explained by the O(n) rebuild.**

## Open

1. **Attribution of commit-frame cost** (UI ~3.5 ms, RenderThread ~3.8 ms, plus the GPU wait in
   gfxinfo). It is out of scope here and is the next place to look before optimising this path.
2. **UNVERIFIED-DEVICE:** every number above is emulator (host-GPU translation) or Mac node.

# Process speed experiments, phase 2 (2026-10-07)

Phase 2 of the [speed audit](speed-audit-2026-10-07.md). The owner approved all four experiments on 2026-10-07. Each
section follows CLAUDE.md §10: hypothesis, precondition, guard, timings with conditions, null spread and verdict.
Raw evidence lives in `artifacts/PROCESS-SPEED/phase2/` (not committed). Tags: **[measured]** = executed and read
back; **[inferred]** = reasoning, not executed.

Numbering follows the phase-2 brief, not the audit: E1 = the audit's E2 (arm64-only), E2 = the audit's E10 (early-stop
replay), E3 = the audit's E1 (fingerprint-gated incremental build), E4 = the audit's E9 (load gate).

## Summary

| Experiment | Verdict | Measured saving (null spread) | Guard | Needs owner yes? |
|---|---|---|---|---|
| E1 arm64-only test APKs | **INCONCLUSIVE** on time; guard PASS | median 835 → 598 s per clean build (−237 s), but within-arm null spread 429 s, and pair 3 inverted (480 vs 527 s) | bundle identical; all 947 shared entries identical incl. every `lib/arm64-v8a/*.so`; x86_64 only removed; pixel gate FAIL as pre-registered on 3/6 shots, all in the hint-pulse and test-banner regions that also differ between two byte-identical APKs (B vs D), so it is uninformative, not negative | yes (changes the test artifact). Recommend adopt on the guard alone: it removes code that never runs, with an unchanged arm64 payload |
| E3 fingerprint-gated incremental | **Recommend ADOPT** | median 598 → 88 s per test build (−510 s, 6.8×); null spread 133 s; all 3 interleaved pairs faster; ranges disjoint | D APK **byte-identical** to the clean B APK in 3 of 3 pairs; Kotlin edit forces clean; TS edit stays incremental and changes the bundle; revert restores byte-identity; pixel gate: same uninformative result (B vs D are byte-identical files) | yes (changes how test artifacts are built) |
| E4 host-load gate | **ADOPTED** (tooling only) | not a time saving by itself: it makes load visible and lets a series wait for quiet | 7 jest tests: records, waits, times out, never kills | no |
| E2 early-stop replay | **REJECTED** | would have saved 590 of 1,894 runs (31 %) | **15 of 87 series flip verdict**; sequential rule claims a false effect more often than a fixed-n look in 48 of 87 series | no (rejected) |

Commits: see "Commits and rulings" below.

## E1: arm64-v8a-only test APKs

- **Hypothesis.** Building test APKs with `-PreactNativeArchitectures=arm64-v8a` instead of the October template's
  `arm64-v8a,x86_64` cuts clean-build time with no behaviour change on our arm64 emulators.
- **Precondition.** Every device that installs a test APK is arm64-v8a. [measured] emulator-5556 `ro.product.cpu.abilist`
  = `arm64-v8a`; both AVDs are `abi.type=arm64-v8a` (audit). Store AABs are out of scope and keep `armeabi-v7a,arm64-v8a`.
- **Route.** `sh scripts/build/build-test-apk.sh --out DIR --env FLAGS --clean` (ABIs default `arm64-v8a`; `--abis` or
  `ABIS=` overrides). Old arm = the same script with `--abis arm64-v8a,x86_64`, i.e. the HALLOWEEN-PLUS template
  recipe (prebuild `--clean`, `--rerun` bundle task, Metro `--reset-cache`).
- **Inputs.** HEAD d013860 (+ this task's uncommitted scripts), the HALLOWEEN-PLUS flag set (25 `EXPO_PUBLIC_*`,
  test ads on), upload-key signing (cert `24f7fa0b…50f8`, equal to the APK installed on emulator-5556).

### Timings [measured] (interleaved A1 B1 D1 A2 B2 D2 A3 B3 D3; one build at a time)

A = clean `arm64-v8a,x86_64`; B = clean `arm64-v8a`; D = fingerprint-gated (E3). Time = the script's wall time
(prebuild + Gradle + proof). Load = 1-min load average at the build's start / end (it includes the build's own load;
the host is 8 cores). Foreign = processes of other sessions at the start (`load-gate.sh record`).

| Run | Mode | ABIs | Total s | Gradle s | Gradle tasks | Load start / end | Free GB | Foreign at start |
|---|---|---|---|---|---|---|---|---|
| A1 | clean | arm64-v8a,x86_64 | 909 | 871 | 618 executed, 28 up-to-date | 24.8 / 20.6 | 24.5 | 6 jest, 0 Gradle, 1 emulator |
| B1 | clean | arm64-v8a | 660 | 642 | 606 executed, 28 up-to-date | 20.6 / 19.9 | 20.9 | 0 jest, 0 Gradle, 1 emulator |
| D1 | incremental | arm64-v8a | 92 | 86 | 25 executed, 609 up-to-date | 12.4 / 13.8 | 24.3 | 0 jest, 0 Gradle, 1 emulator |
| A2 | clean | arm64-v8a,x86_64 | 835 | 824 | 618 executed, 28 up-to-date | 13.4 / 22.0 | 23.3 | 0 jest, 0 Gradle, 1 emulator |
| B2 | clean | arm64-v8a | 598 | 586 | 606 executed, 28 up-to-date | 21.3 / 61.4 | 23.0 | 0 jest, 0 Gradle, 1 emulator |
| D2 | incremental | arm64-v8a | 70 | 65 | 25 executed, 609 up-to-date | 59.6 / 44.4 | 23.4 | 0 jest, 0 Gradle, 1 emulator |
| A3 | clean | arm64-v8a,x86_64 | 480 | 467 | 618 executed, 28 up-to-date | 44.4 / 37.5 | 25.2 | 0 jest, 0 Gradle, 1 emulator |
| B3 | clean | arm64-v8a | 527 | 515 | 606 executed, 28 up-to-date | 37.5 / 48.5 | 22.5 | 0 jest, 0 Gradle, 1 emulator |
| D3 | incremental | arm64-v8a | 88 | 83 | 25 executed, 609 up-to-date | 48.5 / 44.4 | 23.0 | 0 jest, 0 Gradle, 1 emulator |
The whole series took 77.7 min; 6.6 min of that was the gate waiting for another session's Gradle build before D1.

| | A (2 ABIs) | B (arm64) | Shift | Null spread (larger within-arm range) | Per pair (A−B) |
|---|---|---|---|---|---|
| Total s | 909, 835, 480 (median 835) | 660, 598, 527 (median 598) | −237 s (−28 %) | 429 s (A) | +249, +237, **−47** |
| Gradle s | 871, 824, 467 | 642, 586, 515 | −238 s | 404 s | +228, +238, **−48** |

The median shift (237 s) is smaller than the null spread (429 s), the third pair is inverted, and the ranges overlap.
Under the pre-registered rule this is **not a demonstrated saving**. Load ran at 12–61 throughout (another session's
emulator, jest and Gradle work, plus our own build); A3 ran 6 min faster than A1/A2 at a similar load, so the noise is
the host, not the route. The audit's archive comparison (7.7 vs 3.5 min) was confounded by date and load, so it does not
settle the question either.

**Mechanism [measured, not a timing claim]:** the two-ABI build executes the same Gradle task graph plus 12 tasks (618 vs
606) but every CMake/compile task compiles twice; the APK carries 20 extra `lib/x86_64/*.so` that no device runs.

### Guard [measured]

- **Bytes** (`scripts/process/apk-diff.py --guard e1`): A1 vs B1 and A2 vs B2: `assets/index.android.bundle` identical;
  **all 947 entries present in both are byte-identical**, including every `lib/arm64-v8a/*.so`, `classes*.dex`,
  `resources.arsc` and `AndroidManifest.xml`; the only difference is the 20 `lib/x86_64/*` entries absent from B. The
  APK files themselves differ (zip-level metadata), as two clean builds of the same arm do (B1 vs B2: 947/947 entries
  identical, file sha different).
- **Pixels:** **FAIL as pre-registered, but not evidence of a build difference.** Six shots per install on emulator-5556
  (A1 installed, A1 reinstalled as the null, B1, D1); changed pixel = max channel delta > 24, status bar masked; cross
  pixels outside the A/A null's changed area (dilated 16 px) must be 0.

  | Shot | A vs A (null) | A vs B (E1) outside null | B vs D (E3, byte-identical APKs) outside null |
  |---|---|---|---|
  | level 1 light / dark | 0 / 0 | 0 / 0 | 0 / 0 |
  | level 13 Pumpkin light | 0 | 0 | 0 |
  | level 13 Pumpkin dark | 0 | **1,680** (hint button) | **1,680** (hint button) |
  | menu light | 33,141 (banner) | **73** | **44,814** |
  | menu dark | 33,565 (banner) | **188,226** | **188,292** |

  Every failing pixel is in two dynamic regions, checked by eye on crops: the hint bulb's idle pulse (B's frame caught
  it dimmed) and the rotating or late-loading test banner. **B and D are byte-identical APK files and fail the same
  shots by the same amounts**, so the gate's single A/A null pair under-sampled these regions; the failures measure the
  instrument, not the build. All board pixels (both levels, both themes) are identical apart from that 40 × 61 px
  hint button. The gate was not loosened after the fact; the deciding guard for E1 and E3 is the byte comparison.
  Lesson recorded: a pixel gate on these screens needs the banner and hint button masked or at least 2 null pairs.
- **Proof:** every APK passed `scripts/build/prove-test-apk.py` (Hermes; test app id present; the 5 production ids absent
  in UTF-8 and UTF-16LE; no instrumentation; not profileable; cert equal to the installed APK).

### Verdict

**INCONCLUSIVE on time, guard PASS.** The guard shows the arm64 payload is byte-for-byte the same, so the change cannot
alter behaviour on an arm64 device; it only skips work. What would resolve the time question: 3 more interleaved A/B
pairs started only when `load-gate.sh wait --quiet gradle,jest` passes (load < 8), or a CPU-time measure of the Gradle
process tree, which is robust to contention. **Recommendation for the owner:** adopt as the test-APK default on the
guard evidence (an unchanged arm64 payload is a stronger argument than a noisy timing), with the timing re-measured on a
quiet host. Store AABs are untouched.

## E3: fingerprint-gated incremental test builds

- **Hypothesis.** `prebuild --clean` makes every test build a clean native build (~618 tasks). When no native input
  changed since the last successful build, an incremental Gradle build of the same tree (prebuild skipped, JS bundle
  task forced with `--rerun`, Metro `--reset-cache`) produces the same APK much faster.
- **Precondition, enforced by the script.** `scripts/build/native-fingerprint.sh` (app.json and the assets it names,
  package.json, package-lock.json, `node_modules/.package-lock.json`, plugins/, patches/, `modules/*/android|ios`,
  module configs, credentials (hash only), both build scripts, ABIs, Node, JAVA_HOME, ANDROID_HOME, every `EXPO_*` /
  `ARROWS_*` variable except `EXPO_PUBLIC_*`) must equal the stamp written by the last *successful* build, **and**
  `android/` (minus build outputs) must hash to what that build left. Anything else → clean. The stamp is deleted at the
  start of every build, so a failed or killed build forces the next one clean; any other script's `prebuild --clean`
  wipes it too.
- **Why `EXPO_PUBLIC_*` is excluded (RULING):** those values reach only the JS bundle (babel inlining; app.json is static
  and no config plugin reads them; `withPerfProfileable` reads `ARROWS_PERF_BUILD`, which IS fingerprinted), and the
  bundle task always reruns with `--reset-cache`. Flag-set changes therefore stay incremental.
- **Why not `@expo/fingerprint` (RULING):** it took 160 s cold and 25 s warm on this host [measured], which eats most of
  the saving; the shell fingerprint takes about 1–9 s. Residual risk, documented in the script: a hand edit inside
  `node_modules/<pkg>/android` without a `patches/` file is not seen.

### Timings [measured]: same series as E1 (B = old route, D = new route)

| | B (clean arm64) | D (gated, came out incremental 3/3) | Shift | Null spread | Per pair (B−D) |
|---|---|---|---|---|---|
| Total s | 660, 598, 527 (median 598) | 92, 70, 88 (median 88) | −510 s (6.8× faster) | 133 s (B range; D range 22 s) | +568, +528, +439 |
| Gradle tasks executed | 606 | 25 | | | |

Every pair is faster by more than the null spread, and the ranges are disjoint (max D 92 s < min B 527 s): a replicated
median shift (§6). D ran at load 12–60, the same conditions as B.

### Guard [measured]

- **Bytes** (`apk-diff.py --guard e3`): D1 = B1, D2 = B2 and D3 = B3 **as whole APK files** (identical sha256), so every
  dex, `.so`, `resources.arsc`, manifest and the bundle are identical.
- **Negative control, Kotlin:** appending a comment to `modules/arrows-board/.../SkinSpec.kt` changed exactly that line
  of the input manifest, and the decision became `clean` (fingerprint `a7fc4f1c…`); after the revert it was
  `incremental` again (`9f4910cc…`).
- **Negative control, TypeScript:** a probe constant appended to `src/ui/brandMark.ts` left the fingerprint unchanged
  (`incremental`); the incremental APK's bundle changed (sha `c044ca4e…` vs `e4e52f73…`) and contains the probe string.
  After the revert, the next incremental build was **byte-identical to D3** (whole APK), and its bundle sha equals the
  HALLOWEEN-PLUS template build of the same tree and flags.
- **Pixels:** the same capture run (table in E1): B vs D fails exactly where two byte-identical APKs must also differ
  (hint pulse, test banner); board pixels identical. Not evidence of a difference; bytes decide.

### Verdict

**Recommend ADOPT (owner decision: it changes how test artifacts are built).** About 8.5 min saved per test build after
the first, at identical bytes. Over the audit window's 31 clean test builds: measured −510 s per build × 31 = 4.4 h
[inferred from the measured per-build saving]; the audit's pre-experiment estimate was 3.0 h (actual clean total minus
31 incremental medians). `--clean` stays available and is what evidence builds use until the owner says yes.

## E4: host-load gate

- **Tool.** `scripts/process/load-gate.sh` (POSIX sh). `record` prints one JSON line: 1/5/15-min load, CPU count, load
  per CPU, free disk, and every Gradle build client, Gradle daemon, jest and emulator process **not started by the
  calling shell** (ancestry walk). `wait` polls until the 1-min load is below the threshold and no foreign process of
  the `--quiet` classes runs (default: Gradle builds), or until `--timeout`; exit 0 = ok, 3 = timeout. It contains no
  kill/renice call (a test asserts it).
- **Threshold (OWNER-PICKED STARTING VALUE): 1.0 × CPU count** (8.0 here). Derivation [measured,
  `scripts/process/load_vs_jest.py`]: 36 full jest runs in the session transcripts, 15 of them with a host load sample
  within ±10 min of the run's midpoint. Below 1.0 load per CPU, 5 of 5 runs took 50–80 s (quiet median 53 s); at or above
  it, 5 of 10 took 89–263 s. 56 % of the 427 archived load samples are below 8, so a wait usually ends. The relation is
  weak (n = 15, suite count grew from 102 to 138 over the window, and macOS load counts our own threads), so the value is
  a starting point to revisit with the gate's own logs.
- **Wiring.** `build-test-apk.sh` appends `record` lines before and after every build (`DIR/conditions.jsonl`); the
  E1/E3 series waited on it before each build (it held D1 for 394 s while another session's Gradle build ran). The perf
  field guide now tells perf runs to wait on it and record it per arm. It changes when work starts, never a protocol or
  a threshold.
- **Tests [measured]:** `src/__tests__/loadGate.test.ts`, 7 tests with synthetic load and process tables: correct JSON
  and foreign-process filtering (the caller's own descendants are excluded), immediate ok, the default threshold edge
  (3.9 ok, 4.0 times out on 4 CPUs), timeout exit 3, a foreign Gradle build blocking until `--quiet none`, a wait that
  returns when the load drops mid-wait, and no kill/renice in the code.
- **Verdict: ADOPTED** (tooling-only; it cannot change an artifact or evidence). Its saving (fewer discarded perf runs)
  is not measurable until perf series run with it; the ledger will show it.
- **Observed while running it:** the host stayed at load 12–61 for the whole task (other sessions' emulator, jest and
  Gradle, a 2-day-old Playwright worker at 105 % CPU, and this task's own builds), so every wait with the 8.0 threshold
  would have timed out. The E1/E3 series therefore gated only on "no foreign Gradle build".

## E2: early-stop rule for A/B/A perf series (offline replay)

### Pre-registration (written 2026-10-07T00:17:38Z, 02:17:38 CEST, before any archived series outcome was opened)

Rule **E2-R1**. It is fixed here and is not tuned after the replay.

- **Unit.** A series is one archived perf comparison: per-run values of the gate metric(s) its own report used, an arm
  label per run (A = base/old, B = new; N = same-APK null arm where the series had one), in recorded run order.
- **Look schedule.** Look after every completed block (one run of each arm, in recorded order), starting when each
  compared arm has **k_min = 3** runs.
- **Null spread δ at a look.** If the series has its own null measurement (an A/A or same-APK arm), δ is the spread the
  original report used for it, recomputed on the runs seen so far. Otherwise δ = max(range(A), range(B)) of the runs
  seen so far (the within-arm spread). Nothing below the instrument's resolution counts as a shift (§6).
- **Stop for effect.** At a look, metric decided "shift" if |median(B) − median(A)| > δ AND the A and B ranges do not
  overlap, and the same holds in the same direction at **m = 2 consecutive looks**.
- **Stop for futility.** At a look, metric decided "no shift" if |median(B) − median(A)| ≤ δ/2 AND the ranges overlap,
  for m = 2 consecutive looks.
- **Absolute gates** (a metric judged against a fixed threshold, e.g. p95 ≤ budget): decided when every arm's running
  median sits on the same side of the threshold by more than δ for m = 2 consecutive looks; verdict pass/fail as the
  original.
- **Series stop.** The series stops at the first look where every gated metric is decided; otherwise it runs to its
  recorded end, where the verdict is the original's.
- **Early-stop verdict.** The decided state of every gated metric, mapped to the series' original verdict vocabulary
  (e.g. "no regression" = all relative metrics "no shift" or B better; "regression" = any metric shifted worse).
- **Adoption criterion.** ADOPT only if EVERY series keeps its original verdict AND the total runs saved is > 0 with a
  median saving of at least one block per series. Any flip = REJECT, recorded with the rule and the flipping series.
- **What is reported per series:** original n (runs per arm), early-stop n, verdict kept yes/no, and the stop reason.

### Data [measured]

87 series from 30 tasks were extracted from raw per-run files by three helpers (scripts in
`artifacts/PROCESS-SPEED/phase2/e2/extract/`; every arm median was checked against the report's own table; the helpers' reports add up to 88, and the file that is not on disk was not identified). Each records the run order as recorded, the gate metrics, the null arm if any, and
the report's own verdict. Skipped comparisons (fewer than 2 runs per arm, warning counts, captures, pilots) are listed in
the extraction notes.

### Replay [measured, `python3 scripts/process/replay_early_stop.py artifacts/PROCESS-SPEED/phase2/e2/series --sim 200`]

- 87 series, 1,894 runs. The rule stopped 38 series early and would have saved 590 runs (31.2 %); the median series
  saved 0 runs (49 series never stopped early).
- **15 series flip verdict, so E2-R1 is REJECTED.**
  - W4-09-open-fix1 (the clearest): the futility rule stopped at 6 vs 5 runs with "no shift" on every metric; the full
    24 vs 24 series found the improvement the report adopted.
  - ART-SKINS-07 (5 series): the report's gate was "ON ≤ OFF + 16 ms" (a margin); a shift/no-shift rule without a margin
    disagrees with it in both directions (candy-gloss, jelly, lava-rock and strawberry-glazed stopped "no shift" on
    series that failed the budget; rainbow-ribbon stopped "shift worse" on one that passed).
  - ART-SKINS-08 (7 series): the report ruled the whole batch UNVERIFIED because the OFF baseline ran about 6× slower on
    a loaded host; the rule would have reached a decision on that contaminated data.
  - POLISH-T12-superseded-pan-gridon: inconclusive in the report; the rule declared "shift worse" after 5 runs.
  - POLISH-T10-curve-pace3: "pass, fpe worse by design"; the rule's "shift worse" maps to not-pass.
- **Optional-stopping check:** with A/B labels shuffled within each series (200 shuffles), the sequential rule claimed an
  effect more often than one look at the full series in 48 of 87 series (mean 1.7 % vs 1.3 %); e.g. W2-09
  11.0 % vs 4.0 %. Several looks inflate false decisions, as the audit warned.
- The per-series table is below. "Kept" = the early-stop verdict matches the original; a series that never stopped
  keeps its verdict by construction.

| Series | Original n (per arm) | Early-stop n (per arm) | Original verdict | Early-stop decision | Kept | Sim effect rate seq / fixed |
|---|---|---|---|---|---|---|
| ART-SKINS-01-textured-build | A24 B24 | A4 B4 (run 8/48) | regression | buildMs: shift worse; uiFrameP95Ms: no shift | yes | 0.000 / 0.000 |
| ART-SKINS-02-procedural-strip | A12 B12 | A8 B4 (run 12/24) | pass | buildMs: no shift; uiFrameP95Ms: no shift | yes | 0.000 / 0.000 |
| ART-SKINS-03-cinnamon-fulldetail | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-04-cinnamon | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-04-sherbet | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-05-cinnamon | A12 B12 | ran to end | fail | - | yes | 0.010 / 0.000 |
| ART-SKINS-05-sherbet | A12 B12 | ran to end | fail | - | yes | 0.015 / 0.000 |
| ART-SKINS-07-archery | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: shift worse | yes | 0.005 / 0.000 |
| ART-SKINS-07-campfire | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-07-candy-gloss | A12 B12 | A9 B9 (run 18/24) | fail | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-07-cinnamon | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-07-clear-glass | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-07-critter | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: shift worse | yes | 0.000 / 0.000 |
| ART-SKINS-07-ink-pro | A12 B12 | A5 B5 (run 10/24) | pass | totalOpenMs: no shift | yes | 0.000 / 0.000 |
| ART-SKINS-07-jelly | A12 B12 | A5 B5 (run 10/24) | fail | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-07-lava-rock | A12 B12 | A7 B7 (run 14/24) | fail | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-07-neon-glass | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: shift worse | yes | 0.010 / 0.000 |
| ART-SKINS-07-paper-craft | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-07-pixel | A12 B12 | ran to end | pass | - | yes | 0.005 / 0.000 |
| ART-SKINS-07-rainbow-ribbon | A12 B12 | A4 B4 (run 8/24) | pass | totalOpenMs: shift worse | **NO** | 0.005 / 0.000 |
| ART-SKINS-07-sherbet | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: shift worse | yes | 0.015 / 0.000 |
| ART-SKINS-07-stained-glass | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: shift worse | yes | 0.010 / 0.000 |
| ART-SKINS-07-strawberry-glazed | A12 B12 | A4 B4 (run 8/24) | fail | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-07-yarn | A12 B12 | ran to end | fail | - | yes | 0.000 / 0.000 |
| ART-SKINS-08-campfire | A12 B12 | A4 B4 (run 8/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-candy-gloss | A12 B12 | A6 B6 (run 12/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-cinnamon | A12 B12 | A5 B5 (run 10/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-critter | A12 B12 | A6 B6 (run 12/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-jelly | A12 B12 | A11 B11 (run 22/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-rainbow-ribbon | A12 B12 | A5 B5 (run 10/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-sherbet | A12 B12 | A5 B5 (run 10/24) | inconclusive | totalOpenMs: no shift | **NO** | 0.000 / 0.000 |
| ART-SKINS-08-strawberry-glazed | A12 B12 | ran to end | inconclusive | - | yes | 0.000 / 0.000 |
| FINAL-FIX-game-mount | A12 B12 N16 | ran to end | no regression | - | yes | 0.020 / 0.000 |
| PERF-DEADTAG-gallery-fix1 | A12 B12 | ran to end | improvement | - | yes | 0.005 / 0.000 |
| PERF-DEADTAG-gallery-r0-final | A12 B12 | ran to end | improvement | - | yes | 0.000 / 0.000 |
| PERF-DEADTAG-gallery-r0-replicate | A12 B12 | A6 B4 (run 10/24) | improvement | mount_frame_ms: shift better | yes | 0.015 / 0.000 |
| PERF-DEADTAG-play-fix1 | A12 B12 | A6 B4 (run 10/24) | no regression | mount_frame_ms: no shift; tap_to_done_ms: no shift; next_frame_ms: ... | yes | 0.025 / 0.000 |
| PERF-DEADTAG-play-r0-final | A12 B12 | ran to end | no regression | - | yes | 0.005 / 0.000 |
| PERF-DEADTAG-play-r0-replicate | A12 B12 | A6 B4 (run 10/24) | no regression | mount_frame_ms: no shift | yes | 0.005 / 0.000 |
| POLISH-T10-curve-pace2 | A5 B5 | ran to end | pass | - | yes | 0.035 / 0.005 |
| POLISH-T10-curve-pace3 | A5 B5 N6 | A5 B5 (run 10/16) | pass | fpe: shift worse; ui_med_ms: no shift; rt_med_ms: no shift; tot_med... | **NO** | 0.020 / 0.015 |
| POLISH-T10-fix1-pace4 | A5 B5 N6 | ran to end | pass | - | yes | 0.055 / 0.015 |
| POLISH-T10-latencyfix-pace | A5 B5 N6 | ran to end | fail | - | yes | 0.000 / 0.000 |
| POLISH-T11-s1-pan-off | A5 B5 N5 | ran to end | pass | - | yes | 0.055 / 0.020 |
| POLISH-T11-s1-pan-on | A5 B5 N5 | ran to end | pass | - | yes | 0.065 / 0.035 |
| POLISH-T11-s2-exit | A5 B5 N5 | ran to end | improvement | - | yes | 0.020 / 0.005 |
| POLISH-T11-s3-blocked | A5 B5 N5 | ran to end | pass | - | yes | 0.000 / 0.000 |
| POLISH-T11-s4-next | A5 B5 N5 | ran to end | pass | - | yes | 0.025 / 0.010 |
| POLISH-T11-s4-retry | A5 B5 N5 | ran to end | pass | - | yes | 0.040 / 0.030 |
| POLISH-T11-s6-idle | A5 B5 N5 | ran to end | pass | - | yes | 0.050 / 0.020 |
| POLISH-T11-s7-big | A5 B5 N5 | ran to end | pass | - | yes | 0.065 / 0.035 |
| POLISH-T12-exit-pace-AB | A5 B5 N5 | ran to end | pass | - | yes | 0.040 / 0.015 |
| POLISH-T12-exit-pace-partA | A5 B5 | A4 B4 (run 8/10) | pass | fe_rt_ms: shift better; fpe: no shift; over16_per_exit: no shift | yes | 0.020 / 0.010 |
| POLISH-T12-exit-pacerec-AB | A3 B3 N3 | ran to end | pass | - | yes | 0.000 / 0.195 |
| POLISH-T12-exit-pacerec-partA | A3 B3 | ran to end | pass | - | yes | 0.000 / 0.105 |
| POLISH-T12-latency-pacerec | A3 B3 N3 | ran to end | improvement | - | yes | 0.000 / 0.135 |
| POLISH-T12-load-fresh | A10 B10 N10 | A10 B8 (run 23/30) | pass | load_ms: no shift; first_frame_rt_ms: no shift | yes | 0.000 / 0.000 |
| POLISH-T12-pan-gridoff | A5 B5 N5 | ran to end | pass | - | yes | 0.025 / 0.005 |
| POLISH-T12-pan-gridon | A5 B5 N5 | ran to end | pass | - | yes | 0.025 / 0.005 |
| POLISH-T12-superseded-exit-pace-AB | A5 B5 N5 | A4 B4 (run 8/15) | pass | fe_rt_ms: shift better | yes | 0.020 / 0.005 |
| POLISH-T12-superseded-pan-gridon | A5 B5 N5 | A5 B5 (run 10/15) | inconclusive | fit_rt_med_ms: shift worse | **NO** | 0.010 / 0.010 |
| W0-04-blocked-aba | A20 B10 | A10 B4 (run 14/30) | no regression | ui_p95_ms: no shift | yes | 0.000 / 0.000 |
| W2-04-transition-soak | A5 B5 N5 | ran to end | no regression | - | yes | 0.050 / 0.015 |
| W2-06-clear-panel | A5 B5 N5 | ran to end | no regression | - | yes | 0.060 / 0.030 |
| W2-07-refill | A3 B3 N3 | ran to end | no regression | - | yes | 0.000 / 0.305 |
| W2-08-theme-toggle | A5 B5 N5 | ran to end | no regression | - | yes | 0.065 / 0.030 |
| W2-09-blocked-burst | A5 B5 N5 | ran to end | no regression | - | yes | 0.110 / 0.040 |
| W3-15-v1-vs-v2-frames | A3 B2 | ran to end | no regression | - | yes | 0.000 / 0.000 |
| W3-15-v1-vs-v2-generation | A3 B2 | ran to end | improvement | - | yes | 0.000 / 0.000 |
| W4-07-fold-fix1 | A8 B8 | A4 B4 (run 8/16) | no regression | js_p95: no shift; js_max: no shift; ui_p95: no shift; ui_max: no sh... | yes | 0.000 / 0.000 |
| W4-07-fold-r0 | A9 B5 | ran to end | regression | - | yes | 0.030 / 0.000 |
| W4-07-immediate | A4 B4 | ran to end | regression | - | yes | 0.000 / 0.000 |
| W4-09-menu-aba1 | A6 B6 N6 | A6 B4 (run 10/18) | no regression | mount_p50: no shift; mount_p95: no shift; mount_max: no shift; moun... | yes | 0.050 / 0.000 |
| W4-09-menu-aba2 | A6 B6 N6 | ran to end | inconclusive | - | yes | 0.025 / 0.005 |
| W4-09-menu-abab | A24 B24 | A9 B8 (run 17/48) | no regression | mount_p95: no shift; mount_max: no shift; mount_n: no shift; steady... | yes | 0.010 / 0.000 |
| W4-09-open-fix1 | A24 B24 | A6 B5 (run 11/48) | improvement | mount_frame_ms: no shift; tap_to_done_ms: no shift; worst_frame_ms:... | **NO** | 0.005 / 0.000 |
| W4-09-open-fix1b | A12 B12 | A6 B6 (run 12/24) | no regression | render_issue_ms: no shift; mount_frame_ms: no shift; record_ms: no ... | yes | 0.030 / 0.000 |
| W4-10-menu-abab | A24 B24 | A9 B7 (run 16/48) | no regression | mount_max: no shift; steady_p95: no shift; steady_max: no shift; st... | yes | 0.035 / 0.000 |
| W4-11-review-abab | A10 B9 | A6 B5 (run 11/19) | no regression | exit_p95: no shift; entrance_p50: no shift; entrance_p95: no shift;... | yes | 0.005 / 0.000 |
| W5-02-game | A10 B9 N10 | ran to end | no regression | - | yes | 0.040 / 0.000 |
| W5-02-menu | A10 B10 N10 | A5 B5 (run 14/30) | no regression | rt_med: no shift; rt95: no shift; janky_ps: no shift; tot95: no shi... | yes | 0.005 / 0.000 |
| W5-03-exit-burst | A5 B5 N5 | ran to end | no regression | - | yes | 0.085 / 0.040 |
| W5-06-header-burst | A5 B5 N5 | ran to end | no regression | - | yes | 0.050 / 0.010 |
| W5-07-exit-trail | A10 B10 N10 | ran to end | inconclusive | - | yes | 0.030 / 0.000 |
| W5-14-menu-grain | A10 B10 N10 | ran to end | inconclusive | - | yes | 0.070 / 0.000 |
| W6-06-telemetry-tap | A5 B5 | ran to end | inconclusive | - | yes | 0.000 / 0.000 |
| W7-04-menu-abab | A36 B36 | A6 B5 (run 11/72) | no regression | mount_p50: no shift; mount_p95: no shift; mount_max: no shift; moun... | yes | 0.005 / 0.000 |

### Verdict

**REJECTED.** Recorded so it is not retried without a new reason. A future attempt needs a different, newly
pre-registered rule: a margin-aware gate (the +16 ms budget), no futility stop before the series' planned n, a
contamination check (load/OFF-baseline drift) before any stop, and an alpha-spending design that keeps the shuffled
false-effect rate at or below the fixed-n rate. That is a new experiment, not a tweak of this one.

## Commits and rulings

- `788dd3a`: E2 rule E2-R1 pre-registered (committed before any archived outcome was opened).
- `fdca019`: E4 load gate, its tests, `load_vs_jest.py`, the perf field-guide note.
- `79d49dc`: E1+E3 `scripts/build/build-test-apk.sh`, `native-fingerprint.sh`, `prove-test-apk.py`,
  `scripts/process/apk-diff.py` (one commit: both experiments live in the same script).
- `9321d07`: E2 replay script.
- The commit that adds this document and the lessons entry follows these.

RULINGs made without the controller (no questions were possible):
1. E1 ran 3 reps per arm, not the 2-rep fallback. A1 took 15.2 min (909 s), at the brief's 15-minute line, but the next
   clean builds were faster, so the §10 minimum of 3 was kept.
2. E1 and E3 shared one interleaved series (A B D ×3): B is both E1's new arm and E3's old arm.
3. `EXPO_PUBLIC_*` excluded from the native fingerprint, and a shell fingerprint used instead of `@expo/fingerprint`
   (reasons in E3).
4. E1/E3 timing judged on the script's wall time; the "null spread" for builds is the larger within-arm range.
5. The load gate's test lives in `src/__tests__/` so that the standard jest gate runs it (scripts/ tests are not
   matched by `jest.config.js`). That adds 1 suite and 7 tests to the baseline.
6. The pixel guard is reported as pre-registered (FAIL on 3/6 shots) and explained, not re-scored with new masks.
7. The E2 series were extracted by three helpers from raw per-run files; their arm medians were checked against the
   reports' tables. Series judgement calls (e.g. ART-SKINS-08 recorded as the controller's UNVERIFIED ruling) are
   noted in each JSON file.
8. E2's adoption mapping counts a stop on a series whose report was "inconclusive" as a flip (the rule would have
   decided where the full series could not). That mapping was written into the replay code before it ran, but it is
   not spelled out in the committed pre-registration text. Without it, 8 of the 15 flips (ART-SKINS-08 ×7 and
   POLISH-T12-superseded-pan-gridon) would not count, and the 7 left (including W4-09-open-fix1) still reject the rule.

## Handoff gates [measured]

`npx tsc --noEmit -p .` exit 0. `npx jest "$PWD/(src|scripts)/"`: 152 suites / 2,605 tests / 12 snapshots, all passed,
in 144 s at load 19–24 (baseline 151 / 2,598, plus `loadGate.test.ts` with 7 tests). Device: emulator-5556's app data
and installed APK were backed up first and restored; the proof matched the APK bytes, the 65-file data manifest, the
rows, the settings and the display, and the `/data/local/tmp` listing equals the one taken before the task.

## Open verification gaps

- E1 time saving: UNVERIFIED on this loaded host (see its resolution).
- All pixel evidence is emulator-5556 only; the owner's phone was not used (no device in reach of this task).
- E3's fingerprint does not cover hand edits inside `node_modules/*/android` (documented residual risk).
- E4's threshold rests on 15 paired jest runs; revisit it from the gate's own `conditions.jsonl` lines.

### E1 and E3 decision rules (written 2026-10-07T00:21Z, while A1 was building and before any build result existed)

- **Timing.** Interleaved order A1 B1 D1 A2 B2 D2 A3 B3 D3, where A = clean `arm64-v8a,x86_64` (old template),
  B = clean `arm64-v8a` (E1 new, and E3 old), D = fingerprint-gated `arm64-v8a` run right after B (E3 new). The
  measured quantity is the build script's wall time (prebuild + Gradle + proof), plus Gradle's own time.
  A saving counts only if (a) the median shift exceeds the null spread, taken as the larger within-arm range
  (old-vs-old and new-vs-new), and (b) it replicates: every interleaved pair shows the new arm faster, and the
  ranges do not overlap.
- **Byte guard (E1: A vs B; E3: B vs D).** `assets/index.android.bundle` must be byte-identical. E1:
  `lib/arm64-v8a/*.so` must have the same names; bytes should be identical, and any difference must be explained.
  E3: every `classes*.dex`, `lib/**/*.so`, `resources.arsc` and `AndroidManifest.xml` must be identical; manifest and
  resources are also compared as `aapt2 dump` text if the bytes differ.
- **Pixel guard.** Install A, then reinstall A (null control), then B, then D, all on emulator-5556. Each install
  gets the fixed 6-shot capture set: light and dark × menu, level 1 (default skin), level 13 (Pumpkin, 18). Changed
  pixel = max channel delta > 24 (the `pixel-diff.mjs` default), with the status bar masked. **PASS** requires that
  for every shot, the cross-APK diff has 0 changed pixels outside the null control's changed area dilated by 16 px.
  The raw changed-pixel counts are reported too.
- **Fingerprint controls (E3).** (1) A one-line comment appended to a Kotlin file in `modules/arrows-board` must make
  the dry-run decision `clean`; reverting it must restore `incremental`. (2) A TypeScript probe constant must leave
  the fingerprint unchanged (decision `incremental`) while the incremental APK's bundle changes and contains the
  probe. After the probe is reverted, the next incremental bundle must equal B's bundle again.

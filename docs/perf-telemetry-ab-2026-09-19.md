# W6-06 telemetry tap-path A/B — 2026-09-19

## Pre-registered decision rule (written before any run)

- Blocked p95 minimum detectable effect: **5 ms**. // OWNER-PICKED STARTING VALUE
- Exit p95 minimum detectable effect: **5 ms**. // OWNER-PICKED STARTING VALUE
- Run at least five alternating pairs in one emulator session, HEAD first in each pair.
- For each phase, `HEAD null spread = max(HEAD p95) - min(HEAD p95)`.
- If a HEAD null spread exceeds that phase's 5 ms MDE, the verdict is **UNEVALUABLE**.
- Otherwise, a candidate-minus-HEAD paired difference below 5 ms is **PASS** and a difference
  at or above 5 ms is **REGRESSION**.

The 5 ms threshold is deliberately below one 60 Hz frame period while remaining large compared
with the direct callback timer this task also records. It was selected before the APKs were built
or benchmarked; it is not fitted to the result.

## Build and session

- EXECUTED on `emulator-5556` (`fleet_floor_api31`, API 31, arm64-v8a, 60 Hz) in one
  uninterrupted emulator session. The emulator stayed booted for the whole alternating sequence.
- Both APKs used the same saved native host,
  `artifacts/W6-01/apk/mask-timing-perf-3827-v2.apk`, with a freshly exported Hermes bundle
  repacked and debug-signed. No Gradle build was used for the A/B.
- HEAD source: `e45b3aba99a8a68e0f0556039362dcd624335d92`.
- HEAD APK SHA-256: `170052cbedf8b698cb1a1a3d8f8ec33491c7716ce08ba3ea15eca5268c4a3427`.
- Candidate APK SHA-256: `0ddc7d98097891b5802d79f0551df8ab51566c7eab58371a95c79816e9bc8e58`.
- Every result read back window/transition/animator scales as `0/0/0`, and every result recorded
  `appReducedMotion: true`. Therefore both arms measured the required reduced-motion variant, not
  the shipped scale-1 experience.
- Each table entry aggregates 10 measured runs. `frames` is UI frames observed / the sum of each
  capture window in seconds × 60 Hz. Observed counts have one-frame resolution; expected counts
  retain one decimal solely to show the exact window calculation.
- Raw JSON: `artifacts/W6-06/perf/ab-json/`. Derived rows and decision-rule output:
  `artifacts/W6-06/perf/ab-analysis.json`, measured by
  `artifacts/W6-06/scripts/analyze-ab.mjs`.

## Alternating pairs

The actual execution order was `head-1`, `candidate-1`, `head-2`, `candidate-2`, …,
`head-5`, `candidate-5`.

| Pair | Phase | HEAD p95 (frames) | Candidate p95 (frames) | Candidate − HEAD | Scale read-back |
|---:|---|---:|---:|---:|---:|
| 1 | blocked | 68.846 ms (70 / 346.6) | 59.944 ms (67 / 347.0) | −8.902 ms | 0/0/0, 0/0/0 |
| 1 | exit | 24.651 ms (120 / 274.8) | 39.096 ms (120 / 275.0) | +14.445 ms | 0/0/0, 0/0/0 |
| 2 | blocked | 45.073 ms (65 / 346.6) | 58.346 ms (63 / 347.0) | +13.273 ms | 0/0/0, 0/0/0 |
| 2 | exit | 12.910 ms (120 / 275.3) | 22.491 ms (120 / 274.5) | +9.581 ms | 0/0/0, 0/0/0 |
| 3 | blocked | 51.084 ms (68 / 347.6) | 59.994 ms (65 / 346.8) | +8.910 ms | 0/0/0, 0/0/0 |
| 3 | exit | 40.282 ms (118 / 274.8) | 41.243 ms (119 / 275.3) | +0.961 ms | 0/0/0, 0/0/0 |
| 4 | blocked | 52.278 ms (69 / 347.9) | 52.458 ms (68 / 346.7) | +0.180 ms | 0/0/0, 0/0/0 |
| 4 | exit | 24.529 ms (120 / 275.0) | 23.852 ms (120 / 274.6) | −0.678 ms | 0/0/0, 0/0/0 |
| 5 | blocked | 57.892 ms (67 / 347.3) | 67.691 ms (67 / 347.4) | +9.799 ms | 0/0/0, 0/0/0 |
| 5 | exit | 21.455 ms (120 / 275.0) | 42.670 ms (118 / 275.0) | +21.215 ms | 0/0/0, 0/0/0 |

Summary from the preregistered calculation:

| Phase | HEAD min | HEAD max | Null spread | Mean paired difference | Rule result |
|---|---:|---:|---:|---:|---|
| blocked | 45.073 ms | 68.846 ms | 23.773 ms | +4.652 ms | UNEVALUABLE |
| exit | 12.910 ms | 40.282 ms | 27.372 ms | +9.105 ms | UNEVALUABLE |

## Direct callback timer and disabled-sink check

- EXECUTED a release perf APK with `EXPO_PUBLIC_PERF_TELEMETRY_TIMING=1`, limited to the
  `blocked,exit` phases. The timer covered only `onTapOutcome`.
- Tap reconciliation: 4 deterministic-validation taps + 2 warm-up taps + 20 measured taps =
  **26 issued**; the timer logged **26 samples** across 24 quiet-window log lines. The one `n=3`
  line is why log-line count is not sample count.
- Smallest non-zero callback reading: **0.003167 ms**. Source evidence:
  `artifacts/W6-06/perf/telemetry-timing-lines.txt`; reconciliation:
  `artifacts/W6-06/perf/direct-timer-summary.json`.
- EXECUTED bundle grep after rebuilding the final candidate with the variable unset: both the
  Hermes bytecode and exported JavaScript contained **0** `[telemetry-tap]` markers. The unset
  Hermes bundle also contained **0** `[telemetry-perf]` markers. Evidence:
  `artifacts/W6-06/build/timing-bundle-grep-final.txt`.
- EXECUTED the timing PERF APK, navigated Home so the game subtree unmounted, and observed
  `[telemetry-perf] sinkCount=0`. Evidence:
  `artifacts/W6-06/perf/perf-sink-game-unmount-logcat.txt`.

## Verdict

**UNEVALUABLE** for both `blocked` and `exit`.

The result follows the rule written before the run: HEAD null spread was 23.773 ms for blocked and
27.372 ms for exit, both greater than the 5 ms MDE. Consequently this document does not label the
candidate PASS or REGRESSION, even though the independent direct timer reconciled all 26 calls and
measured a 0.003167 ms minimum non-zero callback cost.

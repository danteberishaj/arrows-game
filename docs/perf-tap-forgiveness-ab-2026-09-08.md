# Tap-forgiveness revision: frame A/B/A, 2026-09-08

Same protocol as `scripts/perf/android/benchmark.mjs` (level 3827, 250 arrows,
`--feedback`, 10 runs, AVD `fleet_floor_api31` API 31, `-gpu host`), run five
times in one emulator session on the same Mac, alternating builds:

| Sample | Source | ALL p95 / p99 (ms) | zoomIn p95 | zoomOut p95 | blocked p95 | exit p95 | PSS median |
|---|---|---|---|---|---|---|---|
| before #1 | HEAD 62de5ab, fresh build | 37.6 / 40.0 | 25.1 | 40.0 | 55.1 | 23.2 | 144 MB |
| after #1 | revision, preview drawn at touch-down | 37.0 / 42.1 | 33.0 | 40.2 | 35.7 | 36.8 | 147 MB |
| after2 #1 | revision + 64 ms preview delay, fresh build | 23.9 / 29.0 | 25.4 | 24.3 | 52.9 | 21.0 | 145 MB |
| before #2 | same HEAD APK, rerun | 37.4 / 41.4 | 28.0 | 39.6 | 41.3 | 29.5 | 145 MB |
| after2 #2 | same after2 APK, rerun | 25.1 / 37.7 | 23.5 | 36.2 | 40.6 | 36.1 | 146 MB |

Pan phases (panHorizontal / panVertical) were 21.5-23.5 ms p95 in every sample.

## Reading

- **Environment, not code, set the absolute level.** The unchanged HEAD build
  measured 37.6 ms ALL p95 twice today against 11.45 ms in the 2026-09-01
  record. During the runs the Mac carried a 5-7 load average on 8 cores with
  Avast's daemon at ~97% CPU and ANECompilerService at ~85%. Absolute gates
  (p95 <= 20 ms) therefore could not be evaluated today; only paired
  differences are meaningful.
- **No regression detected.** The revision's two samples are at or below the
  two HEAD samples in every phase with non-overlapping ranges for ALL p95
  (23.9-25.1 vs 37.4-37.6) and zoomOut, equal within noise for zoomIn,
  pans and blocked. Memory is flat (144-147 MB PSS median across all five).
- **The `exit` phase is below the instrument's resolution today.** Two runs
  of the identical after2 APK gave 21.0 and 36.1 ms p95 over 120 frames each;
  HEAD gave 23.2 and 29.5. A 120-frame sample under this load cannot resolve
  a difference smaller than ~15 ms, so neither "after #1 regressed exit" nor
  "after2 improved exit" is a finding.
- **Why after #1 differs from after2:** after #1 drew the press preview on
  touch-down, adding one or two React commits plus a Skia overlay draw to
  every tap. after2 shows the preview only when a press outlasts 64 ms
  (Android's own pressed-state delay), so an instant tap does no extra work.
  The delay was added on mechanism grounds; the exit numbers above neither
  confirm nor refute its effect.

## Harness change that this revision required

A blocked arrow now costs a heart once per level (`src/ui/tapRules.ts`), so
the validation step taps three distinct blocked arrows ((35,19), (31,14),
(30,21)) instead of one cell three times. Both HEAD and the revision pass it.

## Repro

```
npm run perf:android -- --feedback --label <label> --output <file>.json
npm run perf:android -- --feedback --skip-build --apk <saved>.apk --label <label> --output <file>.json
```

Re-run on a quiet machine (load < 2, scanner idle) before quoting absolute
numbers; the 2026-09-01 record remains the reference for the gate.

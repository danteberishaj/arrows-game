# Daily board band — measured 2026-09-20

**Script:** `scripts/analysis/daily-band.ts` (committed with this task).
**Command:** `npx tsx scripts/analysis/daily-band.ts`
**Commit measured:** `d4949e0` plus this task's uncommitted working tree (`src/core/dailyBoard.ts`,
the `buildFromShape` extraction in `src/core/levelGenerator.ts`). The controller commits both
together; if a later commit changes the generator, re-run the script before quoting these numbers.
**Runtime:** Node via `tsx` on macOS (darwin 25.5.0), 18.2 s wall for the whole run.

Every number below was produced by that script and nothing else. The W4-03 distribution assertions
in `src/core/__tests__/dailyBoard.test.ts` are derived from this file, never the other way round.

## Determinism

Two runs, diffed:

```
npx tsx scripts/analysis/daily-band.ts > a.txt
npx tsx scripts/analysis/daily-band.ts > b.txt
diff a.txt b.txt      # exit 0, no output
```

Saved as `artifacts/W4-03/daily-band-run-a.txt` and `artifacts/W4-03/daily-band-run-b.txt`.

## Sample reconciliation

Window days 0..3649 x 1 board per day = 3650 expected boards; 3650 measured, per pool. The script
prints this reconciliation next to the percentiles, so a percentile is never quoted over an
unverified sample. Percentiles are nearest-rank on the ascending sample.

## Shipped pool — catalogue minus `Square`, `Rectangle` (24 shapes)

| min | p10 | p25 | p50 | p75 | p90 | p95 | max |
|---|---|---|---|---|---|---|---|
| 42 | 64 | 72 | 82 | 92 | 99 | 105 | 144 |

- Max grid dimension over the window: **46** (the generator's own rows/cols clamp).
- Consecutive-day shape repeats: **6** out of 3649 adjacent pairs.
- Pool shapes that never appear: **none**. Per-shape day counts run 148 (`Octagon`) to 158 (`Cat`),
  against a uniform expectation of 3650 / 24 = 152.1.

## Candidate pool — the whole 26-shape catalogue

| min | p10 | p25 | p50 | p75 | p90 | p95 | max |
|---|---|---|---|---|---|---|---|
| 44 | 64 | 72 | 82 | 92 | 100 | 106 | 148 |

- Max grid dimension: **46**. Consecutive-day repeats: **4**. No shape is unreachable; counts run
  135 (`Circle`) to 146 (`Cat`) against a uniform expectation of 140.4.

The two pools are indistinguishable on arrow count (identical p10/p25/p50/p75, 1 apart at p90/p95).
The choice between them is therefore a **taste** call about whether the two no-picture fills belong
on the one board everyone sees, not a difficulty call — see "Owner acceptance" in
`docs/next-level/reports/W4-03.md`.

## Seed namespace

```
campaign seeds searched: 200000 distinct of 200000 indices
daily seeds checked: 20000 days, 20000 distinct
collisions with a campaign seed: 0
naive seed(2450) = -1761770251, dailySeed(2450) = 657209651
```

`seed(2450)` is exactly the seed `LevelGenerator.generate(2450)` consumes (reproduced on `da93dcd`,
see the report), which is the collision a day-number-seeded daily would have shipped.

## What these numbers are NOT

- They do not say an 82-arrow board is completable in a new player's first session. That stays
  UNVERIFIED and belongs to W4-05.
- They are a property of the code, not of a device. No board here was generated on Android or iOS.

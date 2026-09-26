# Generator v2 difficulty curve: candidates (W3-14), 2026-09-26

Saturation level (b) per candidate, and what carries difficulty after it: **S100** saturates at level **67** (difficulty is flat after it, by construction; median blocked, first vs last 50 cycles after saturation: 92.9 -> 89.4 (x0.96)); **S400** saturates at level **343** (difficulty is flat after it, by construction; median blocked, first vs last 50 cycles after saturation: 94.1 -> 94.3 (x1.00)); **S1000** saturates at level **871** (difficulty is flat after it, by construction; median blocked, first vs last 50 cycles after saturation: 81.5 -> 88.2 (x1.08)); **S100b** saturates at level **73** (difficulty is then carried by the clearable bias to level 3000 (look NOT accepted) and flat after it; median blocked, first vs last 50 cycles after saturation: 85.7 -> 115.6 (x1.35)); **S400b** saturates at level **343** (difficulty is then carried by the clearable bias to level 3000 (look NOT accepted) and flat after it; median blocked, first vs last 50 cycles after saturation: 90.3 -> 118.8 (x1.31)); **S1000b** saturates at level **871** (difficulty is then carried by the clearable bias to level 3000 (look NOT accepted) and flat after it; median blocked, first vs last 50 cycles after saturation: 84.3 -> 110.3 (x1.31)). Every candidate is flat from its last table row on: from level 3000 for the bias tails, and from the ceiling level (100, 400 or 1000) for the three bases. At the ceiling v2 is slightly easier than v1 is today: v1's 300-level block median scan over levels 1-3000 runs 183-192, and the three bases' blocks after their ceiling run 174-186.

> Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Nothing here is shipped: generator v2 is dark (`GEN_V2_ENABLED = false`). The owner picks a candidate, and the discontinuity handling for existing players, in W3-16. The shipped placeholder `V2_CURVE` (`src/core/curve.ts`) is candidate S400, because it is the middle of ruling W3-7's grid. It is not a recommendation.

## How every number here was produced

- `npm run analysis:probe -- --version 2 --ceiling` gives the ceiling (below).
- `npm run analysis:probe -- --version 2 --candidates` writes the six tables to `artifacts/W3-14/curves/<id>.json` and prints them.
- `npm run analysis:probe -- --version 2 --flat-reference --json-out artifacts/W3-14/probe/flat-reference.json` gives (a)'s noise reference.
- `npm run analysis:probe -- --version 2 --curve artifacts/W3-14/curves/<id>.json --curve-report --reference artifacts/W3-14/probe/flat-reference.json --json-out artifacts/W3-14/probe/report-<id>.json` gives (a)-(g) per candidate.
- The probe deals every board through the shipping `LevelGenerator.generate(i, 2, { curve })` and walks it with `BoardLogic`. It never reads the table back as an outcome. The only exception is the key-level cell targets, which ARE the table.
- The plots come from `artifacts/W3-14/scripts/plots.ts`, and this doc from `artifacts/W3-14/scripts/make-doc.py`. Both read the probe output only.

## Shared inputs

- **Row 0**: level 1 (index 0) targets 88 cells at clearable bias 3. OWNER PICK 2026-09-26 (W3-13, `docs/level1-sweep-2026-09-26.md` row B `b3/12/Circle`).
- **Tier texture**: Normal : Hard : Super Hard = 83 : 126 : 149. This is v1's measured per-tier arrow medians over levels 1-1000 (W3-01), carried over. A tier's target is base cells x weight / 83.
- **Clamp**: at most 37 columns, rows up to 46, aspect kept. OWNER PICK W3-09, `docs/board-legibility-2026-09-26.md`.
- **Ceiling**: 250 arrows (ruling W3-4), translated into base cells by `--ceiling`:

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

W3-14 ceiling: the largest saturated base cells (Normal target; Hard and Super Hard by v1's texture 83 : 126 : 149) whose Hard and Super Hard boards over indices 0-99999 every 7 stay at or under ARROW_CEILING = 250 arrows, neutral AND at the bias-tail floor 0.3. Each row deals a flat curve (that base cells from level 1) through generate(i, 2, { curve }).

| base cells | Hard target | Super Hard target | shapes admitted | max arrows, neutral (index, shape) | max arrows, b = 0.3 (index, shape) | pass |
|---|---|---|---|---|---|---|
| 330 | 501 | 592 | 15 | 233 (74123, Hexagon 32×32) | 238 (71057, Plus 34×34) | yes |
| 335 | 509 | 601 | 15 | 238 (26873, Square 25×25) | 248 (59129, Octagon 31×31) | yes |
| 336 | 510 | 603 | 15 | 238 (26873, Square 25×25) | 248 (59129, Octagon 31×31) | yes |
| 337 | 512 | 605 | 15 | 238 (26873, Square 25×25) | 248 (59129, Octagon 31×31) | yes |
| 338 | 513 | 607 | 15 | 238 (26873, Square 25×25) | 248 (59129, Octagon 31×31) | yes |
| 339 | 515 | 609 | 15 | 238 (26873, Square 25×25) | 248 (59129, Octagon 31×31) | yes |
| 340 | 516 | 610 | 14 | 241 (54257, Heart 29×29) | 253 (37373, X 37×37) | no |
| 345 | 524 | 619 | 13 | 247 (59129, X 37×37) | 252 (59129, X 37×37) | no |
| 350 | 531 | 628 | 13 | 250 (17633, Flower 37×37) | 252 (59129, X 37×37) | no |
| 355 | 539 | 637 | 13 | 262 (8435, Rectangle 21×32) | 252 (59129, X 37×37) | no |
| 360 | 547 | 646 | 12 | 251 (917, Plus 36×36) | 253 (18431, Pentagon 35×35) | no |
| 365 | 554 | 655 | 11 | 254 (16121, Heart 30×30) | 266 (88571, Heart 30×30) | no |
| 370 | 562 | 664 | 11 | 264 (28805, Butterfly 34×37) | 266 (88571, Heart 30×30) | no |

CEILING_BASE_CELLS = 339: the largest scanned value with every smaller scanned value passing too. src/core/curve.ts holds 339 (matches).
exit 0
```

- **The candidates** (ruling W3-7's exploration grid): the base cells climb linearly from 88 to the ceiling by displayed level 100, 400 or 1000. The bias climbs down linearly from 3 to 1 (neutral) over the same levels. Each `b` variant then keeps lowering the bias, from 1 to 0.3 by level 3000. 0.3 is the mildest value below 1 that W3-11 measured. Its brand gate flags it ("changes arrow look"), so no tail has an accepted look.

## Summary

Cells are the Normal tier's target; Hard is x126/83 and Super Hard x149/83 of it (the table in each report below has all three). "b" is the clearable bias. Only b = 3 at level 1 has an accepted look (W3-13). Every other value below 3 and above 1 is flagged "look not accepted". So is every value below 1.

| level | S100 | S400 | S1000 | S100b | S400b | S1000b |
|---|---|---|---|---|---|---|
| 1 | 88 (b 3.00) | 88 (b 3.00) | 88 (b 3.00) | 88 (b 3.00) | 88 (b 3.00) | 88 (b 3.00) |
| 2 | 91 (b 2.98) | 89 (b 2.99) | 88 (b 3.00) | 91 (b 2.98) | 89 (b 2.99) | 88 (b 3.00) |
| 5 | 98 (b 2.92) | 91 (b 2.98) | 89 (b 2.99) | 98 (b 2.92) | 91 (b 2.98) | 89 (b 2.99) |
| 10 | 111 (b 2.82) | 94 (b 2.95) | 90 (b 2.98) | 111 (b 2.82) | 94 (b 2.95) | 90 (b 2.98) |
| 20 | 136 (b 2.62) | 100 (b 2.90) | 93 (b 2.96) | 136 (b 2.62) | 100 (b 2.90) | 93 (b 2.96) |
| 50 | 212 (b 2.01) | 119 (b 2.75) | 100 (b 2.90) | 212 (b 2.01) | 119 (b 2.75) | 100 (b 2.90) |
| 100 | 339 (neutral) | 150 (b 2.50) | 113 (b 2.80) | 339 (neutral) | 150 (b 2.50) | 113 (b 2.80) |
| 200 | 339 (neutral) | 213 (b 2.00) | 138 (b 2.60) | 339 (b 0.98) | 213 (b 2.00) | 138 (b 2.60) |
| 500 | 339 (neutral) | 339 (neutral) | 213 (b 2.00) | 339 (b 0.90) | 339 (b 0.97) | 213 (b 2.00) |
| 1000 | 339 (neutral) | 339 (neutral) | 339 (neutral) | 339 (b 0.78) | 339 (b 0.84) | 339 (neutral) |
| 5000 | 339 (neutral) | 339 (neutral) | 339 (neutral) | 339 (b 0.30) | 339 (b 0.30) | 339 (b 0.30) |

| candidate | (b) saturation level | after it | (a) 300-level blocks non-decreasing within noise | (c) shapes once saturated | (d) clamp shortfalls | (e) heaviest, 0-99,999 every 7th (ceiling 250) | (f) smallest fit cell, 360 dp (floor 9.1) | heaviest board 0-9999 | its node time vs v1's worst (7157, 262 arrows) | (g) switch at 100 / 400 / 1000: v2 / v1 scan over the next 60 levels | window model cost (slots sat out) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S100 | 67 | flat (no curve input changes) | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 239 (Super Hard Flower 36×36, index 34811): PASS | 9.15 pt: PASS | 242 arrows, index 3071 (Super Hard Ring 35×35); over 262: 0 | median 12.00 ms vs 14.37 ms, x0.84 | 0.92 / 1.10 / 0.94 | 1 |
| S400 | 343 | flat (no curve input changes) | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 238 (Super Hard X 37×37, index 86765): PASS | 9.15 pt: PASS | 236 arrows, index 5249 (Super Hard Ring 35×35); over 262: 0 | median 12.56 ms vs 15.08 ms, x0.83 | 0.33 / 1.00 / 0.89 | 0 |
| S1000 | 871 | flat (no curve input changes) | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 232 (Super Hard Square 25×25, index 19187): PASS | 9.15 pt: PASS | 243 arrows, index 5339 (Super Hard X 37×37); over 262: 0 | median 13.82 ms vs 16.33 ms, x0.85 | 0.21 / 0.43 / 0.88 | 1 |
| S100b | 73 | bias 1 -> 0.3 by level 3000, then flat | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 238 (Super Hard Square 25×25, index 59129): PASS | 9.15 pt: PASS | 231 arrows, index 3755 (Super Hard Square 25×25); over 262: 0 | median 10.35 ms vs 14.01 ms, x0.74 | 0.92 / 0.94 / 1.00 | 1 |
| S400b | 343 | bias 1 -> 0.3 by level 3000, then flat | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 244 (Super Hard Rectangle 20×30, index 19187): PASS | 9.15 pt: PASS | 235 arrows, index 4853 (Super Hard X 37×37); over 262: 0 | median 12.14 ms vs 14.22 ms, x0.85 | 0.33 / 1.02 / 0.91 | 0 |
| S1000b | 871 | bias 1 -> 0.3 by level 3000, then flat | scan PASS, blocked PASS | 15 of 26 | 0 + 0 | 234 (Super Hard Square 25×25, index 54257): PASS | 9.15 pt: PASS | 243 arrows, index 5339 (Super Hard X 37×37); over 262: 0 | median 13.33 ms vs 16.82 ms, x0.79 | 0.21 / 0.43 / 0.96 | 1 |

Plots:
- `artifacts/W3-14/blocked-proxy-vs-level.png` shows the blocked-tap proxy against level for every candidate, beside v1.
- `artifacts/W3-14/owner-curve-choice.png` is the owner sheet for W3-16.

## Reading (a): what "non-decreasing" can and cannot mean here

The brief asks for cycle medians that never decrease. Measured, that cannot hold for any curve, including a flat one:
- Cycle-to-cycle scan-median drops, of 499 steps: S100 238, S400 247, S1000 246, S100b 250, S400b 238, S1000b 245.
- The flat reference (FLAT (base 339 from level 1, neutral, levels 1-12000)) drops on 1012 of its 1999 steps.
- The cause is shape and fill noise: six boards per cycle, from a shuffled bag.

The verdict above is therefore made on 300-level block medians, against the largest block-to-block change the same instrument shows on the flat curve:
- Over 40 blocks it is 6.3% for scan and 11.3% for blocked.
- A drop smaller than that is not resolvable.
- The 60-level blocks are printed too, but their flat-curve noise is 34.3% / 40.5%. That is too coarse to judge anything.
- The inputs themselves never fall: `validateCurve` enforces it, and a test pins it.
- Positive control for the rule: S1000's own 300-level scan blocks in reverse order are a falling curve. Their largest drop is 48.6%, above the 6.3% resolution, so the rule FAILs them. (This is computed by make-doc.py from the same JSON.)

## The flat reference (a)

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

(a)'s noise reference: FLAT (base 339 from level 1, neutral, levels 1-12000): 2000 cycles. Largest block-to-block change of block-median scan / blocked: 300-level blocks (40): 6.3% / 11.3%; 60-level blocks (200): 34.3% / 40.5%.

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 175.1 | 86.0 |
| 1 | 301-600 | 175.7 | 88.3 |
| 2 | 601-900 | 180.8 | 91.8 |
| 3 | 901-1200 | 182.0 | 92.7 |
| 4 | 1201-1500 | 182.6 | 94.0 |
| 5 | 1501-1800 | 183.1 | 92.8 |
| 6 | 1801-2100 | 180.1 | 90.5 |
| 7 | 2101-2400 | 181.3 | 90.7 |
| 8 | 2401-2700 | 182.3 | 95.3 |
| 9 | 2701-3000 | 182.5 | 93.8 |
| 10 | 3001-3300 | 176.7 | 90.4 |
| 11 | 3301-3600 | 176.5 | 86.9 |
| 12 | 3601-3900 | 184.2 | 93.5 |
| 13 | 3901-4200 | 184.0 | 93.7 |
| 14 | 4201-4500 | 179.8 | 89.8 |
| 15 | 4501-4800 | 181.5 | 88.9 |
| 16 | 4801-5100 | 183.4 | 90.4 |
| 17 | 5101-5400 | 185.9 | 93.7 |
| 18 | 5401-5700 | 180.0 | 90.0 |
| 19 | 5701-6000 | 178.8 | 92.3 |
| 20 | 6001-6300 | 186.3 | 93.0 |
| 21 | 6301-6600 | 182.8 | 92.1 |
| 22 | 6601-6900 | 172.0 | 85.2 |
| 23 | 6901-7200 | 179.5 | 90.7 |
| 24 | 7201-7500 | 183.0 | 90.6 |
| 25 | 7501-7800 | 180.4 | 92.2 |
| 26 | 7801-8100 | 183.9 | 91.7 |
| 27 | 8101-8400 | 184.5 | 92.4 |
| 28 | 8401-8700 | 182.3 | 90.4 |
| 29 | 8701-9000 | 185.4 | 92.7 |
| 30 | 9001-9300 | 181.1 | 90.8 |
| 31 | 9301-9600 | 176.6 | 88.4 |
| 32 | 9601-9900 | 182.3 | 91.2 |
| 33 | 9901-10200 | 179.9 | 92.9 |
| 34 | 10201-10500 | 182.8 | 90.2 |
| 35 | 10501-10800 | 184.3 | 91.3 |
| 36 | 10801-11100 | 172.7 | 85.9 |
| 37 | 11101-11400 | 182.9 | 93.3 |
| 38 | 11401-11700 | 180.8 | 88.5 |
| 39 | 11701-12000 | 190.8 | 98.4 |
exit 0
```

## Performance (node; generation time per level)

Timing ran one core module per process. W3-11 found that cross-module timing inside one process is invalid. The method:
- Each process times `generate(i, 1)` and `generate(i, 2)` alternately per level, over 600 levels x 3 reps.
- The per-level value is the minimum over reps.
- Arms rotate across rounds.
- BASE is `bb58b67` (W3-10/W3-11 v2: v1 tier bands, 46 clamp). NULL is a second copy of BASE.
- The harness throws if any process's timed-call count is not 600 x 3 x 2 = 3600.

Levels 1-600 (index 0-599):

| arm | series | processes | levels x reps, timed calls per process | per-process median ms: median [min–max] | per-process p95 ms: median [min–max] | per-process total ms: median [min–max] | pooled per-level min: median / p95 / total ms | arrows total |
|---|---|---|---|---|---|---|---|---|
| NULL | v1 | 4 | 600 x 3, 3600 | 2.493 [2.472–2.499] | 7.391 [7.206–7.403] | 1928.0 [1902.5–1931.0] | 2.440 / 7.206 / 1885.8 | 60458 |
| NULL | v2 | 4 | 600 x 3, 3600 | 2.667 [2.628–2.683] | 7.872 [7.784–7.897] | 2078.9 [2045.9–2080.8] | 2.603 / 7.777 / 2029.8 | 62514 |
| S100 | v1 | 4 | 600 x 3, 3600 | 2.531 [2.483–2.531] | 7.445 [7.324–7.488] | 1974.4 [1925.9–1977.5] | 2.462 / 7.279 / 1906.3 | 60458 |
| S100 | v2 | 4 | 600 x 3, 3600 | 2.402 [2.336–2.412] | 6.698 [6.602–6.727] | 1918.2 [1877.2–1922.5] | 2.330 / 6.535 / 1857.4 | 59174 |
| S400-shipped | v1 | 4 | 600 x 3, 3600 | 2.476 [2.471–2.512] | 7.368 [7.319–7.398] | 1937.2 [1923.3–1939.4] | 2.447 / 7.195 / 1900.7 | 60458 |
| S400-shipped | v2 | 4 | 600 x 3, 3600 | 1.997 [1.989–2.026] | 5.839 [5.803–5.868] | 1365.6 [1353.7–1372.1] | 1.983 / 5.748 / 1339.4 | 46874 |
| S1000 | v1 | 4 | 600 x 3, 3600 | 2.515 [2.499–2.519] | 7.528 [7.353–7.552] | 1966.2 [1941.1–1976.8] | 2.475 / 7.306 / 1915.0 | 60458 |
| S1000 | v2 | 4 | 600 x 3, 3600 | 0.954 [0.937–0.956] | 2.734 [2.724–2.776] | 682.7 [672.4–687.7] | 0.919 / 2.705 / 662.5 | 29692 |
| BASE | v1 | 4 | 600 x 3, 3600 | 2.487 [2.464–2.493] | 7.359 [7.275–7.465] | 1928.0 [1907.2–1952.2] | 2.428 / 7.225 / 1888.1 | 60458 |
| BASE | v2 | 4 | 600 x 3, 3600 | 2.682 [2.639–2.717] | 7.863 [7.782–7.992] | 2079.6 [2052.3–2100.9] | 2.594 / 7.689 / 2031.4 | 62514 |

Levels 3001-3600 (index 3000-3599; every base candidate is saturated here; S400b is at bias 0.3):

| arm | series | processes | levels x reps, timed calls per process | per-process median ms: median [min–max] | per-process p95 ms: median [min–max] | per-process total ms: median [min–max] | pooled per-level min: median / p95 / total ms | arrows total |
|---|---|---|---|---|---|---|---|---|
| NULL | v1 | 4 | 600 x 3, 3600 | 2.426 [2.422–2.463] | 7.558 [7.402–7.582] | 1934.0 [1927.2–1954.0] | 2.398 / 7.367 / 1910.2 | 61355 |
| NULL | v2 | 4 | 600 x 3, 3600 | 2.651 [2.613–2.651] | 7.588 [7.494–7.668] | 2057.3 [2049.1–2078.3] | 2.597 / 7.470 / 2029.7 | 62625 |
| S400-shipped | v1 | 4 | 600 x 3, 3600 | 2.437 [2.404–2.463] | 7.537 [7.410–7.590] | 1942.0 [1917.8–1956.5] | 2.393 / 7.339 / 1900.5 | 61355 |
| S400-shipped | v2 | 4 | 600 x 3, 3600 | 2.425 [2.387–2.447] | 6.800 [6.595–6.836] | 2024.5 [1999.6–2037.4] | 2.383 / 6.574 / 1981.4 | 63188 |
| S400b | v1 | 4 | 600 x 3, 3600 | 2.463 [2.451–2.464] | 7.599 [7.534–7.620] | 1958.5 [1953.5–1964.1] | 2.421 / 7.498 / 1931.2 | 61355 |
| S400b | v2 | 4 | 600 x 3, 3600 | 2.469 [2.455–2.485] | 6.816 [6.763–6.831] | 2062.5 [2054.3–2071.6] | 2.432 / 6.721 / 2033.0 | 63725 |
| BASE | v1 | 4 | 600 x 3, 3600 | 2.448 [2.442–2.462] | 7.534 [7.518–7.565] | 1952.7 [1936.2–1957.2] | 2.409 / 7.445 / 1916.0 | 61355 |
| BASE | v2 | 4 | 600 x 3, 3600 | 2.644 [2.617–2.650] | 7.649 [7.591–7.672] | 2076.2 [2059.7–2076.7] | 2.591 / 7.526 / 2034.3 | 62625 |

Cold first v2 pick (`artifacts/W3-14/scripts/cold.ts`, one fresh process per value). A deep player's first v2 level rasterizes every shape and builds every bag window from level 0. `--jitless` is an interpreter proxy for Hermes, not Hermes.

Before the per-level target memo (first NEW build):

| node | level index | BASE (bb58b67), ms, 3 fresh processes | NEW, ms, 3 fresh processes |
|---|---|---|---|
| JIT | 0 | 24.3 / 24.7 / 24.8 | 19.6 / 20.6 / 21.2 |
| JIT | 1000 | 26.6 / 26.8 / 27.8 | 23.0 / 23.8 / 23.9 |
| JIT | 5000 | 28.8 / 32.5 / 35.9 | 28.9 / 29.2 / 29.8 |
| JIT | 20000 | 34.5 / 34.9 / 35.3 | 37.7 / 39.9 / 40.4 |
| --jitless (Hermes proxy) | 0 | 204.6 / 205.5 / 211.7 | 149.3 / 150.2 / 154.8 |
| --jitless (Hermes proxy) | 1000 | 206.9 / 206.9 / 215.0 | 152.4 / 155.1 / 160.5 |
| --jitless (Hermes proxy) | 5000 | 215.4 / 216.8 / 220.3 | 168.8 / 170.7 / 172.9 |
| --jitless (Hermes proxy) | 20000 | 247.7 / 248.0 / 250.1 | 241.3 / 242.6 / 250.7 |

Final code (per-level target memo in curveWindowMaxTarget):

| node | level index | BASE (bb58b67), ms, 3 fresh processes | NEW, ms, 3 fresh processes |
|---|---|---|---|
| JIT | 0 | 24.5 / 24.7 / 26.1 | 20.1 / 20.5 / 20.8 |
| JIT | 5000 | 28.8 / 29.8 / 30.0 | 25.8 / 26.6 / 26.9 |
| JIT | 20000 | 32.3 / 32.4 / 34.9 | 33.8 / 33.8 / 35.0 |
| --jitless (Hermes proxy) | 0 | 203.8 / 203.9 / 219.7 | 148.0 / 148.9 / 150.2 |
| --jitless (Hermes proxy) | 5000 | 215.0 / 218.7 / 224.3 | 161.4 / 161.5 / 165.5 |
| --jitless (Hermes proxy) | 20000 | 248.5 / 249.5 / 253.4 | 198.6 / 199.3 / 206.7 |

## The brief's verification 2, per candidate

`npm run analysis:probe -- --version 2 --curve artifacts/W3-14/curves/<id>.json --levels 1-3000 --bands --shape-report --clamp-shortfall`:

**S100**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 158 | 73 | 85 |
| 376-750 | 375 | 172 | 83 | 91 |
| 751-1500 | 750 | 174 | 85 | 90 |
| 1501-2250 | 750 | 171 | 83 | 90 |
| 2251-3000 | 750 | 173 | 85 | 90 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 30 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 199 windows (ordinals 0-198), admissible set size(s) 15, 17, 21, 25, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (1): Bolt
- Clamp shortfalls: 0

**S400**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 93 | 34 | 59 |
| 376-750 | 375 | 177 | 87 | 91 |
| 751-1500 | 750 | 174 | 85 | 91 |
| 1501-2250 | 750 | 172 | 85 | 89 |
| 2251-3000 | 750 | 173 | 85 | 90 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 30 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 192 windows (ordinals 0-191), admissible set size(s) 15, 16, 17, 20, 22, 23, 24, 25, 26, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (0): none
- Clamp shortfalls: 0

**S1000**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 53 | 15 | 38 |
| 376-750 | 375 | 104 | 41 | 63 |
| 751-1500 | 750 | 165 | 79 | 88 |
| 1501-2250 | 750 | 174 | 85 | 90 |
| 2251-3000 | 750 | 171 | 83 | 90 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 20 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 180 windows (ordinals 0-179), admissible set size(s) 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (0): none
- Clamp shortfalls: 0

**S100b**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 157 | 72 | 85 |
| 376-750 | 375 | 182 | 92 | 92 |
| 751-1500 | 750 | 180 | 90 | 91 |
| 1501-2250 | 750 | 188 | 98 | 92 |
| 2251-3000 | 750 | 193 | 105 | 91 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 30 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 199 windows (ordinals 0-198), admissible set size(s) 15, 17, 21, 25, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (1): Bolt
- Clamp shortfalls: 0

**S400b**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 93 | 34 | 59 |
| 376-750 | 375 | 177 | 86 | 91 |
| 751-1500 | 750 | 175 | 87 | 91 |
| 1501-2250 | 750 | 181 | 92 | 90 |
| 2251-3000 | 750 | 195 | 106 | 91 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 30 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 192 windows (ordinals 0-191), admissible set size(s) 15, 16, 17, 20, 22, 23, 24, 25, 26, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (0): none
- Clamp shortfalls: 0

**S1000b**

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-375 | 375 | 53 | 15 | 38 |
| 376-750 | 375 | 104 | 41 | 63 |
| 751-1500 | 750 | 169 | 82 | 88 |
| 1501-2250 | 750 | 181 | 93 | 91 |
| 2251-3000 | 750 | 191 | 101 | 92 |

- Back-to-back repeats: 0
- Rows hit the shape's row cap or cols hit 37 on 20 levels
- Longest first-appearance gap: 1 levels (level 1 to level 2)
- v2 bag: 180 windows (ordinals 0-179), admissible set size(s) 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, truncated windows 0
- Admitted in every window (15): Square, Rectangle, Circle, Diamond, Plus, Hexagon, Heart, Flower, Hourglass, Pentagon, Octagon, Ring, X, Butterfly, Mushroom
- Excluded from every window (0): none
- Clamp shortfalls: 0

## Per candidate: (a)-(g) as the probe printed them

### Curve S100

Saturation (b): level 67 — after it, difficulty is flat by construction (no curve input changes); median blocked of the first vs last 50 cycles after saturation: 92.9 -> 89.4 (x0.96).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 99 | 100 | 339 | unset (1) |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Cat | 14×14 | 22 |
| 2 | Normal | 91 | 137 | 163 | 2.9797979797979797 | look not accepted | Pine | 18×16 | 26 |
| 5 | Normal | 98 | 149 | 176 | 2.919191919191919 | look not accepted | Diamond | 15×15 | 27 |
| 10 | Normal | 111 | 168 | 199 | 2.8181818181818183 | look not accepted | Hexagon | 14×14 | 30 |
| 20 | Normal | 136 | 207 | 244 | 2.6161616161616164 | look not accepted | Rectangle | 10×15 | 39 |
| 50 | Normal | 212 | 322 | 381 | 2.01010101010101 | look not accepted | Hourglass | 24×19 | 48 |
| 100 | Normal | 339 | 515 | 609 | unset (1) | neutral | Hourglass | 31×25 | 77 |
| 200 | Normal | 339 | 515 | 609 | unset (1) | neutral | Butterfly | 24×26 | 81 |
| 500 | Normal | 339 | 515 | 609 | unset (1) | neutral | Hourglass | 31×25 | 82 |
| 1000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Heart | 21×21 | 85 |
| 5000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Diamond | 27×27 | 90 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 238, blocked 244 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan 4, largest 3.1% at level 601; blocked 5, largest 3.1% at level 1501.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 21, largest 25.5% at level 2821; blocked 22, largest 24.0% at level 541; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 170.3 | 82.9 |
| 1 | 301-600 | 181.5 | 89.1 |
| 2 | 601-900 | 175.8 | 88.7 |
| 3 | 901-1200 | 184.2 | 93.1 |
| 4 | 1201-1500 | 186.4 | 93.5 |
| 5 | 1501-1800 | 181.0 | 90.6 |
| 6 | 1801-2100 | 180.1 | 88.5 |
| 7 | 2101-2400 | 176.2 | 87.8 |
| 8 | 2401-2700 | 179.4 | 90.1 |
| 9 | 2701-3000 | 180.5 | 89.4 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 71.8 | 23.9 |
| 1 | 61-120 | 157.0 | 76.5 |
| 2 | 121-180 | 195.4 | 101.4 |
| 3 | 181-240 | 198.8 | 109.8 |
| 4 | 241-300 | 181.9 | 95.6 |
| 5 | 301-360 | 174.7 | 87.7 |
| 6 | 361-420 | 218.2 | 107.2 |
| 7 | 421-480 | 180.5 | 91.4 |
| 8 | 481-540 | 212.2 | 104.7 |
| 9 | 541-600 | 166.8 | 79.6 |
| 10 | 601-660 | 171.6 | 85.6 |
| 11 | 661-720 | 189.1 | 94.1 |
| 12 | 721-780 | 201.2 | 104.8 |
| 13 | 781-840 | 169.7 | 85.8 |
| 14 | 841-900 | 178.8 | 91.8 |
| 15 | 901-960 | 192.5 | 94.1 |
| 16 | 961-1020 | 198.1 | 90.2 |
| 17 | 1021-1080 | 181.1 | 92.7 |
| 18 | 1081-1140 | 176.7 | 94.9 |
| 19 | 1141-1200 | 220.5 | 117.6 |
| 20 | 1201-1260 | 215.6 | 105.5 |
| 21 | 1261-1320 | 199.7 | 105.1 |
| 22 | 1321-1380 | 177.7 | 92.7 |
| 23 | 1381-1440 | 190.5 | 93.5 |
| 24 | 1441-1500 | 188.6 | 97.6 |
| 25 | 1501-1560 | 182.6 | 97.8 |
| 26 | 1561-1620 | 165.2 | 80.1 |
| 27 | 1621-1680 | 171.6 | 90.6 |
| 28 | 1681-1740 | 181.7 | 90.6 |
| 29 | 1741-1800 | 199.4 | 104.4 |
| 30 | 1801-1860 | 168.7 | 82.9 |
| 31 | 1861-1920 | 171.5 | 84.9 |
| 32 | 1921-1980 | 232.4 | 110.5 |
| 33 | 1981-2040 | 191.7 | 94.3 |
| 34 | 2041-2100 | 178.4 | 87.8 |
| 35 | 2101-2160 | 183.9 | 87.1 |
| 36 | 2161-2220 | 211.1 | 108.9 |
| 37 | 2221-2280 | 170.2 | 85.2 |
| 38 | 2281-2340 | 188.7 | 98.2 |
| 39 | 2341-2400 | 171.7 | 83.9 |
| 40 | 2401-2460 | 198.8 | 96.8 |
| 41 | 2461-2520 | 177.3 | 84.5 |
| 42 | 2521-2580 | 203.8 | 101.2 |
| 43 | 2581-2640 | 171.5 | 79.5 |
| 44 | 2641-2700 | 182.0 | 95.7 |
| 45 | 2701-2760 | 188.3 | 94.3 |
| 46 | 2761-2820 | 232.4 | 114.2 |
| 47 | 2821-2880 | 173.0 | 87.9 |
| 48 | 2881-2940 | 175.9 | 87.4 |
| 49 | 2941-3000 | 202.6 | 98.6 |

(b) Saturation: base cells reach 339 at level 100; plateau = the 483 cycles from there on, cycle-median arrows median 93, lower quartile 89; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 67.

(c) Admissible shapes per bag window (199 windows over levels 1-3000): 25 from level 1; 21 from level 51; 17 from level 72; 15 from level 89.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 1 window slots where a shape could hold every target of the window but sat it out (1 of 199 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 239 arrows at index 34811 (Super Hard Flower 36×36, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 41 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 40 | 0.20 | 106 | 31 | 185 | 72 | 0.39 |
| 12 | 7-12 | 158 | 46 | 0.29 | 89 | 30 | 184 | 75 | 0.41 |
| 40 | 37-42 | 189 | 83 | 0.44 | 97 | 54 | 185 | 119 | 0.64 |
| 100 | 97-102 | 153 | 157 | 1.03 | 79 | 94 | 211 | 194 | 0.92 |
| 400 | 397-402 | 243 | 221 | 0.91 | 125 | 105 | 198 | 218 | 1.10 |
| 1000 | 997-1002 | 224 | 177 | 0.79 | 97 | 92 | 202 | 190 | 0.94 |

Heaviest board over indices 0-9999: 242 arrows at index 3071 (Super Hard Ring 35×35); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 12.00 ms (min 11.77) against v1 index 7157 (262 arrows) 14.37 ms (min 14.16): ratio 0.835.

### Curve S400

Saturation (b): level 343 — after it, difficulty is flat by construction (no curve input changes); median blocked of the first vs last 50 cycles after saturation: 94.1 -> 94.3 (x1.00).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 399 | 400 | 339 | unset (1) |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Pine | 18×16 | 23 |
| 2 | Normal | 89 | 135 | 159 | 2.9949874686716793 | look not accepted | Cat | 14×14 | 20 |
| 5 | Normal | 91 | 137 | 162 | 2.979949874686717 | look not accepted | Bolt | 32×26 | 24 |
| 10 | Normal | 94 | 142 | 168 | 2.954887218045113 | look not accepted | Rocket | 19×14 | 23 |
| 20 | Normal | 100 | 152 | 179 | 2.9047619047619047 | look not accepted | Arrow | 20×18 | 28 |
| 50 | Normal | 119 | 180 | 213 | 2.754385964912281 | look not accepted | Rocket | 21×16 | 27 |
| 100 | Normal | 150 | 228 | 270 | 2.5037593984962405 | look not accepted | Trophy | 25×21 | 35 |
| 200 | Normal | 213 | 324 | 383 | 2.0025062656641603 | look not accepted | Cat | 22×22 | 49 |
| 500 | Normal | 339 | 515 | 609 | unset (1) | neutral | Plus | 26×26 | 92 |
| 1000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Butterfly | 24×26 | 89 |
| 5000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Circle | 23×23 | 90 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 247, blocked 253 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan 4, largest 4.5% at level 1501; blocked 4, largest 6.6% at level 2101.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 25, largest 18.6% at level 1441; blocked 23, largest 23.1% at level 421; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 80.5 | 29.4 |
| 1 | 301-600 | 187.1 | 92.8 |
| 2 | 601-900 | 180.9 | 90.9 |
| 3 | 901-1200 | 179.1 | 90.4 |
| 4 | 1201-1500 | 185.5 | 94.3 |
| 5 | 1501-1800 | 177.2 | 90.2 |
| 6 | 1801-2100 | 184.5 | 92.0 |
| 7 | 2101-2400 | 177.6 | 85.9 |
| 8 | 2401-2700 | 181.4 | 92.2 |
| 9 | 2701-3000 | 184.8 | 94.3 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 42.4 | 12.3 |
| 1 | 61-120 | 59.3 | 20.9 |
| 2 | 121-180 | 80.5 | 29.4 |
| 3 | 181-240 | 101.5 | 40.0 |
| 4 | 241-300 | 121.4 | 55.4 |
| 5 | 301-360 | 143.2 | 63.6 |
| 6 | 361-420 | 209.2 | 113.3 |
| 7 | 421-480 | 178.8 | 87.2 |
| 8 | 481-540 | 206.1 | 107.3 |
| 9 | 541-600 | 187.5 | 92.7 |
| 10 | 601-660 | 185.6 | 94.6 |
| 11 | 661-720 | 199.0 | 105.0 |
| 12 | 721-780 | 182.4 | 93.2 |
| 13 | 781-840 | 168.8 | 83.5 |
| 14 | 841-900 | 181.8 | 93.7 |
| 15 | 901-960 | 178.5 | 95.5 |
| 16 | 961-1020 | 195.9 | 103.9 |
| 17 | 1021-1080 | 175.7 | 86.3 |
| 18 | 1081-1140 | 179.9 | 84.6 |
| 19 | 1141-1200 | 216.4 | 118.1 |
| 20 | 1201-1260 | 192.1 | 92.0 |
| 21 | 1261-1320 | 186.5 | 96.0 |
| 22 | 1321-1380 | 177.4 | 92.0 |
| 23 | 1381-1440 | 228.0 | 115.6 |
| 24 | 1441-1500 | 185.5 | 94.3 |
| 25 | 1501-1560 | 182.2 | 94.2 |
| 26 | 1561-1620 | 178.3 | 88.0 |
| 27 | 1621-1680 | 170.4 | 86.4 |
| 28 | 1681-1740 | 184.7 | 99.8 |
| 29 | 1741-1800 | 194.4 | 95.4 |
| 30 | 1801-1860 | 180.4 | 97.4 |
| 31 | 1861-1920 | 180.8 | 92.0 |
| 32 | 1921-1980 | 223.1 | 111.8 |
| 33 | 1981-2040 | 199.8 | 110.7 |
| 34 | 2041-2100 | 178.1 | 87.6 |
| 35 | 2101-2160 | 171.2 | 85.3 |
| 36 | 2161-2220 | 204.2 | 106.0 |
| 37 | 2221-2280 | 194.3 | 107.1 |
| 38 | 2281-2340 | 177.3 | 85.9 |
| 39 | 2341-2400 | 170.9 | 79.7 |
| 40 | 2401-2460 | 192.2 | 92.8 |
| 41 | 2461-2520 | 190.4 | 95.0 |
| 42 | 2521-2580 | 202.6 | 97.4 |
| 43 | 2581-2640 | 180.3 | 91.5 |
| 44 | 2641-2700 | 181.2 | 90.0 |
| 45 | 2701-2760 | 182.3 | 93.8 |
| 46 | 2761-2820 | 212.9 | 110.9 |
| 47 | 2821-2880 | 182.4 | 94.3 |
| 48 | 2881-2940 | 180.1 | 94.2 |
| 49 | 2941-3000 | 194.0 | 107.0 |

(b) Saturation: base cells reach 339 at level 400; plateau = the 433 cycles from there on, cycle-median arrows median 93, lower quartile 89; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 343.

(c) Admissible shapes per bag window (192 windows over levels 1-3000): 26 from level 1; 25 from level 27; 24 from level 202; 23 from level 226; 22 from level 249; 20 from level 271; 17 from level 311; 16 from level 345; 15 from level 361.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 0 window slots where a shape could hold every target of the window but sat it out (0 of 192 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 238 arrows at index 86765 (Super Hard X 37×37, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 44 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 33 | 0.16 | 106 | 24 | 185 | 42 | 0.23 |
| 12 | 7-12 | 158 | 39 | 0.25 | 89 | 27 | 184 | 43 | 0.23 |
| 40 | 37-42 | 189 | 44 | 0.23 | 97 | 32 | 185 | 53 | 0.28 |
| 100 | 97-102 | 153 | 65 | 0.42 | 79 | 38 | 211 | 69 | 0.33 |
| 400 | 397-402 | 243 | 234 | 0.96 | 125 | 119 | 198 | 198 | 1.00 |
| 1000 | 997-1002 | 224 | 163 | 0.72 | 97 | 91 | 202 | 179 | 0.89 |

Heaviest board over indices 0-9999: 236 arrows at index 5249 (Super Hard Ring 35×35); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 12.56 ms (min 11.85) against v1 index 7157 (262 arrows) 15.08 ms (min 14.28): ratio 0.832.

### Curve S1000

Saturation (b): level 871 — after it, difficulty is flat by construction (no curve input changes); median blocked of the first vs last 50 cycles after saturation: 81.5 -> 88.2 (x1.08).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 999 | 1000 | 339 | unset (1) |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Pine | 18×16 | 23 |
| 2 | Normal | 88 | 134 | 158 | 2.997997997997998 | look not accepted | Cat | 14×14 | 20 |
| 5 | Normal | 89 | 135 | 160 | 2.991991991991992 | look not accepted | Bolt | 32×26 | 23 |
| 10 | Normal | 90 | 137 | 162 | 2.981981981981982 | look not accepted | Rocket | 18×14 | 23 |
| 20 | Normal | 93 | 141 | 167 | 2.961961961961962 | look not accepted | Arrow | 19×17 | 25 |
| 50 | Normal | 100 | 152 | 180 | 2.901901901901902 | look not accepted | X | 15×15 | 23 |
| 100 | Normal | 113 | 171 | 203 | 2.8018018018018016 | look not accepted | X | 16×16 | 29 |
| 200 | Normal | 138 | 209 | 248 | 2.6016016016016015 | look not accepted | X | 17×17 | 32 |
| 500 | Normal | 213 | 324 | 383 | 2.001001001001001 | look not accepted | Triangle | 24×24 | 57 |
| 1000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Circle | 23×23 | 81 |
| 5000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Flower | 27×27 | 82 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 246, blocked 252 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan 2, largest 5.7% at level 2101; blocked 3, largest 9.2% at level 2101.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 18, largest 21.0% at level 1201; blocked 20, largest 26.7% at level 1201; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 45.4 | 15.0 |
| 1 | 301-600 | 88.4 | 32.7 |
| 2 | 601-900 | 139.5 | 66.7 |
| 3 | 901-1200 | 172.8 | 82.8 |
| 4 | 1201-1500 | 179.9 | 88.8 |
| 5 | 1501-1800 | 182.9 | 95.0 |
| 6 | 1801-2100 | 184.9 | 94.8 |
| 7 | 2101-2400 | 174.3 | 86.1 |
| 8 | 2401-2700 | 181.1 | 89.5 |
| 9 | 2701-3000 | 178.5 | 88.2 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 33.9 | 8.3 |
| 1 | 61-120 | 40.2 | 12.6 |
| 2 | 121-180 | 46.3 | 15.8 |
| 3 | 181-240 | 58.9 | 19.9 |
| 4 | 241-300 | 64.5 | 22.0 |
| 5 | 301-360 | 71.9 | 25.9 |
| 6 | 361-420 | 77.5 | 32.4 |
| 7 | 421-480 | 87.5 | 32.5 |
| 8 | 481-540 | 101.8 | 44.7 |
| 9 | 541-600 | 102.0 | 45.0 |
| 10 | 601-660 | 123.0 | 58.9 |
| 11 | 661-720 | 134.7 | 61.8 |
| 12 | 721-780 | 138.6 | 71.3 |
| 13 | 781-840 | 141.2 | 71.5 |
| 14 | 841-900 | 151.3 | 70.1 |
| 15 | 901-960 | 172.8 | 82.0 |
| 16 | 961-1020 | 178.8 | 87.2 |
| 17 | 1021-1080 | 161.8 | 79.9 |
| 18 | 1081-1140 | 170.0 | 79.5 |
| 19 | 1141-1200 | 230.0 | 121.1 |
| 20 | 1201-1260 | 181.8 | 88.8 |
| 21 | 1261-1320 | 200.0 | 96.0 |
| 22 | 1321-1380 | 167.3 | 78.2 |
| 23 | 1381-1440 | 206.6 | 98.9 |
| 24 | 1441-1500 | 178.9 | 89.3 |
| 25 | 1501-1560 | 188.1 | 101.1 |
| 26 | 1561-1620 | 181.8 | 93.7 |
| 27 | 1621-1680 | 176.3 | 87.0 |
| 28 | 1681-1740 | 190.0 | 96.0 |
| 29 | 1741-1800 | 208.6 | 104.4 |
| 30 | 1801-1860 | 173.8 | 94.8 |
| 31 | 1861-1920 | 178.2 | 93.1 |
| 32 | 1921-1980 | 207.9 | 110.1 |
| 33 | 1981-2040 | 202.3 | 103.2 |
| 34 | 2041-2100 | 184.8 | 86.8 |
| 35 | 2101-2160 | 170.2 | 86.1 |
| 36 | 2161-2220 | 208.8 | 109.8 |
| 37 | 2221-2280 | 175.8 | 85.7 |
| 38 | 2281-2340 | 170.7 | 88.7 |
| 39 | 2341-2400 | 168.9 | 82.9 |
| 40 | 2401-2460 | 215.4 | 112.3 |
| 41 | 2461-2520 | 181.1 | 90.4 |
| 42 | 2521-2580 | 188.1 | 103.9 |
| 43 | 2581-2640 | 177.2 | 86.2 |
| 44 | 2641-2700 | 175.8 | 80.6 |
| 45 | 2701-2760 | 208.4 | 108.4 |
| 46 | 2761-2820 | 207.4 | 99.7 |
| 47 | 2821-2880 | 168.7 | 80.7 |
| 48 | 2881-2940 | 176.2 | 83.3 |
| 49 | 2941-3000 | 216.7 | 116.7 |

(b) Saturation: base cells reach 339 at level 1000; plateau = the 333 cycles from there on, cycle-median arrows median 92, lower quartile 88; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 871.

(c) Admissible shapes per bag window (180 windows over levels 1-3000): 26 from level 1; 25 from level 79; 24 from level 504; 23 from level 552; 22 from level 644; 21 from level 666; 20 from level 687; 19 from level 767; 17 from level 786; 16 from level 854; 15 from level 918.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 1 window slots where a shape could hold every target of the window but sat it out (1 of 180 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 232 arrows at index 19187 (Super Hard Square 25×25, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 45 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 28 | 0.14 | 106 | 23 | 185 | 34 | 0.18 |
| 12 | 7-12 | 158 | 31 | 0.19 | 89 | 23 | 184 | 34 | 0.19 |
| 40 | 37-42 | 189 | 34 | 0.18 | 97 | 29 | 185 | 38 | 0.21 |
| 100 | 97-102 | 153 | 35 | 0.23 | 79 | 29 | 211 | 45 | 0.21 |
| 400 | 397-402 | 243 | 77 | 0.31 | 125 | 49 | 198 | 85 | 0.43 |
| 1000 | 997-1002 | 224 | 170 | 0.76 | 97 | 101 | 202 | 177 | 0.88 |

Heaviest board over indices 0-9999: 243 arrows at index 5339 (Super Hard X 37×37); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 13.82 ms (min 12.55) against v1 index 7157 (262 arrows) 16.33 ms (min 14.22): ratio 0.846.

### Curve S100b

Saturation (b): level 73 — after it, difficulty is carried by the bias (1 -> 0.3 by level 3000), then flat; median blocked of the first vs last 50 cycles after saturation: 85.7 -> 115.6 (x1.35).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 99 | 100 | 339 | unset (1) |
| 2 | 2999 | 3000 | 339 | 0.3 |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Cat | 14×14 | 22 |
| 2 | Normal | 91 | 137 | 163 | 2.9797979797979797 | look not accepted | Pine | 18×16 | 26 |
| 5 | Normal | 98 | 149 | 176 | 2.919191919191919 | look not accepted | Diamond | 15×15 | 27 |
| 10 | Normal | 111 | 168 | 199 | 2.8181818181818183 | look not accepted | Hexagon | 14×14 | 30 |
| 20 | Normal | 136 | 207 | 244 | 2.6161616161616164 | look not accepted | Rectangle | 10×15 | 39 |
| 50 | Normal | 212 | 322 | 381 | 2.01010101010101 | look not accepted | Hourglass | 24×19 | 48 |
| 100 | Normal | 339 | 515 | 609 | unset (1) | neutral | Hourglass | 31×25 | 77 |
| 200 | Normal | 339 | 515 | 609 | 0.9758620689655172 | look not accepted | Butterfly | 24×26 | 76 |
| 500 | Normal | 339 | 515 | 609 | 0.903448275862069 | look not accepted | Hourglass | 31×25 | 87 |
| 1000 | Normal | 339 | 515 | 609 | 0.7827586206896552 | look not accepted | Heart | 21×21 | 92 |
| 5000 | Normal | 339 | 515 | 609 | 0.3 | look not accepted | Diamond | 27×27 | 85 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 250, blocked 250 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan 2, largest 0.9% at level 1201; blocked none.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 22, largest 17.9% at level 541; blocked 18, largest 21.7% at level 1561; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 166.0 | 81.3 |
| 1 | 301-600 | 181.6 | 92.8 |
| 2 | 601-900 | 185.2 | 94.3 |
| 3 | 901-1200 | 189.4 | 95.5 |
| 4 | 1201-1500 | 187.7 | 97.7 |
| 5 | 1501-1800 | 193.4 | 100.8 |
| 6 | 1801-2100 | 197.3 | 105.2 |
| 7 | 2101-2400 | 196.8 | 108.2 |
| 8 | 2401-2700 | 197.3 | 109.6 |
| 9 | 2701-3000 | 207.2 | 115.6 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 71.8 | 23.9 |
| 1 | 61-120 | 157.0 | 76.5 |
| 2 | 121-180 | 190.8 | 99.2 |
| 3 | 181-240 | 188.4 | 94.6 |
| 4 | 241-300 | 171.1 | 84.1 |
| 5 | 301-360 | 171.4 | 85.7 |
| 6 | 361-420 | 198.4 | 107.4 |
| 7 | 421-480 | 178.0 | 86.9 |
| 8 | 481-540 | 214.1 | 109.1 |
| 9 | 541-600 | 175.7 | 92.1 |
| 10 | 601-660 | 189.3 | 99.1 |
| 11 | 661-720 | 199.2 | 100.9 |
| 12 | 721-780 | 193.6 | 100.2 |
| 13 | 781-840 | 180.3 | 89.3 |
| 14 | 841-900 | 183.7 | 89.7 |
| 15 | 901-960 | 198.3 | 105.3 |
| 16 | 961-1020 | 184.5 | 94.6 |
| 17 | 1021-1080 | 182.5 | 95.5 |
| 18 | 1081-1140 | 191.9 | 101.0 |
| 19 | 1141-1200 | 218.8 | 114.3 |
| 20 | 1201-1260 | 190.5 | 99.9 |
| 21 | 1261-1320 | 195.1 | 100.6 |
| 22 | 1321-1380 | 179.9 | 90.3 |
| 23 | 1381-1440 | 196.1 | 102.1 |
| 24 | 1441-1500 | 195.9 | 103.5 |
| 25 | 1501-1560 | 219.4 | 122.4 |
| 26 | 1561-1620 | 185.8 | 95.8 |
| 27 | 1621-1680 | 193.9 | 99.6 |
| 28 | 1681-1740 | 192.1 | 105.1 |
| 29 | 1741-1800 | 207.4 | 101.9 |
| 30 | 1801-1860 | 191.1 | 101.1 |
| 31 | 1861-1920 | 187.4 | 108.4 |
| 32 | 1921-1980 | 216.7 | 114.0 |
| 33 | 1981-2040 | 208.1 | 107.9 |
| 34 | 2041-2100 | 186.7 | 98.4 |
| 35 | 2101-2160 | 196.1 | 108.1 |
| 36 | 2161-2220 | 211.7 | 116.1 |
| 37 | 2221-2280 | 197.8 | 107.2 |
| 38 | 2281-2340 | 205.2 | 112.2 |
| 39 | 2341-2400 | 188.8 | 103.0 |
| 40 | 2401-2460 | 195.6 | 105.6 |
| 41 | 2461-2520 | 198.5 | 107.2 |
| 42 | 2521-2580 | 220.0 | 121.0 |
| 43 | 2581-2640 | 196.0 | 108.3 |
| 44 | 2641-2700 | 198.3 | 113.7 |
| 45 | 2701-2760 | 223.1 | 123.1 |
| 46 | 2761-2820 | 228.1 | 125.1 |
| 47 | 2821-2880 | 205.4 | 110.4 |
| 48 | 2881-2940 | 203.1 | 113.0 |
| 49 | 2941-3000 | 227.5 | 115.6 |

(b) Saturation: base cells reach 339 at level 100; plateau = the 483 cycles from there on, cycle-median arrows median 94, lower quartile 90; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 73.

(c) Admissible shapes per bag window (199 windows over levels 1-3000): 25 from level 1; 21 from level 51; 17 from level 72; 15 from level 89.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 1 window slots where a shape could hold every target of the window but sat it out (1 of 199 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 238 arrows at index 59129 (Super Hard Square 25×25, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 41 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 40 | 0.20 | 106 | 31 | 185 | 72 | 0.39 |
| 12 | 7-12 | 158 | 46 | 0.29 | 89 | 30 | 184 | 75 | 0.41 |
| 40 | 37-42 | 189 | 83 | 0.44 | 97 | 54 | 185 | 119 | 0.64 |
| 100 | 97-102 | 153 | 157 | 1.03 | 79 | 94 | 211 | 194 | 0.92 |
| 400 | 397-402 | 243 | 211 | 0.87 | 125 | 105 | 198 | 187 | 0.94 |
| 1000 | 997-1002 | 224 | 190 | 0.85 | 97 | 97 | 202 | 202 | 1.00 |

Heaviest board over indices 0-9999: 231 arrows at index 3755 (Super Hard Square 25×25); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 10.35 ms (min 10.25) against v1 index 7157 (262 arrows) 14.01 ms (min 13.64): ratio 0.739.

### Curve S400b

Saturation (b): level 343 — after it, difficulty is carried by the bias (1 -> 0.3 by level 3000), then flat; median blocked of the first vs last 50 cycles after saturation: 90.3 -> 118.8 (x1.31).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 399 | 400 | 339 | unset (1) |
| 2 | 2999 | 3000 | 339 | 0.3 |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Pine | 18×16 | 23 |
| 2 | Normal | 89 | 135 | 159 | 2.9949874686716793 | look not accepted | Cat | 14×14 | 20 |
| 5 | Normal | 91 | 137 | 162 | 2.979949874686717 | look not accepted | Bolt | 32×26 | 24 |
| 10 | Normal | 94 | 142 | 168 | 2.954887218045113 | look not accepted | Rocket | 19×14 | 23 |
| 20 | Normal | 100 | 152 | 179 | 2.9047619047619047 | look not accepted | Arrow | 20×18 | 28 |
| 50 | Normal | 119 | 180 | 213 | 2.754385964912281 | look not accepted | Rocket | 21×16 | 27 |
| 100 | Normal | 150 | 228 | 270 | 2.5037593984962405 | look not accepted | Trophy | 25×21 | 35 |
| 200 | Normal | 213 | 324 | 383 | 2.0025062656641603 | look not accepted | Cat | 22×22 | 49 |
| 500 | Normal | 339 | 515 | 609 | 0.9730769230769231 | look not accepted | Plus | 26×26 | 96 |
| 1000 | Normal | 339 | 515 | 609 | 0.8384615384615385 | look not accepted | Butterfly | 24×26 | 87 |
| 5000 | Normal | 339 | 515 | 609 | 0.3 | look not accepted | Circle | 23×23 | 87 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 238, blocked 240 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan 1, largest 0.5% at level 1201; blocked 1, largest 0.4% at level 2101.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 20, largest 22.4% at level 541; blocked 18, largest 29.5% at level 541; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 80.5 | 29.4 |
| 1 | 301-600 | 174.2 | 88.0 |
| 2 | 601-900 | 182.3 | 89.5 |
| 3 | 901-1200 | 182.8 | 94.2 |
| 4 | 1201-1500 | 181.9 | 96.1 |
| 5 | 1501-1800 | 183.2 | 96.9 |
| 6 | 1801-2100 | 195.5 | 105.0 |
| 7 | 2101-2400 | 195.7 | 104.5 |
| 8 | 2401-2700 | 201.2 | 105.2 |
| 9 | 2701-3000 | 208.6 | 118.8 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 42.4 | 12.3 |
| 1 | 61-120 | 59.3 | 20.9 |
| 2 | 121-180 | 80.5 | 29.4 |
| 3 | 181-240 | 101.5 | 40.0 |
| 4 | 241-300 | 121.4 | 55.4 |
| 5 | 301-360 | 143.2 | 63.6 |
| 6 | 361-420 | 210.5 | 113.3 |
| 7 | 421-480 | 177.3 | 89.6 |
| 8 | 481-540 | 222.8 | 124.8 |
| 9 | 541-600 | 172.8 | 88.0 |
| 10 | 601-660 | 186.1 | 97.0 |
| 11 | 661-720 | 191.3 | 95.8 |
| 12 | 721-780 | 191.9 | 89.5 |
| 13 | 781-840 | 183.5 | 95.7 |
| 14 | 841-900 | 177.0 | 87.0 |
| 15 | 901-960 | 192.3 | 94.2 |
| 16 | 961-1020 | 210.9 | 102.8 |
| 17 | 1021-1080 | 177.3 | 91.1 |
| 18 | 1081-1140 | 180.6 | 91.7 |
| 19 | 1141-1200 | 199.0 | 99.4 |
| 20 | 1201-1260 | 194.0 | 99.7 |
| 21 | 1261-1320 | 188.0 | 98.9 |
| 22 | 1321-1380 | 181.9 | 96.1 |
| 23 | 1381-1440 | 202.0 | 105.2 |
| 24 | 1441-1500 | 174.7 | 85.9 |
| 25 | 1501-1560 | 205.0 | 106.5 |
| 26 | 1561-1620 | 184.5 | 98.5 |
| 27 | 1621-1680 | 177.6 | 89.0 |
| 28 | 1681-1740 | 181.2 | 89.8 |
| 29 | 1741-1800 | 194.9 | 103.9 |
| 30 | 1801-1860 | 187.4 | 98.4 |
| 31 | 1861-1920 | 188.2 | 106.2 |
| 32 | 1921-1980 | 215.3 | 113.1 |
| 33 | 1981-2040 | 222.1 | 116.4 |
| 34 | 2041-2100 | 189.4 | 100.4 |
| 35 | 2101-2160 | 183.8 | 94.0 |
| 36 | 2161-2220 | 204.9 | 104.1 |
| 37 | 2221-2280 | 203.8 | 114.2 |
| 38 | 2281-2340 | 211.9 | 118.0 |
| 39 | 2341-2400 | 195.3 | 105.5 |
| 40 | 2401-2460 | 217.1 | 119.9 |
| 41 | 2461-2520 | 181.5 | 96.5 |
| 42 | 2521-2580 | 207.4 | 115.7 |
| 43 | 2581-2640 | 199.4 | 115.4 |
| 44 | 2641-2700 | 210.7 | 118.1 |
| 45 | 2701-2760 | 215.7 | 123.8 |
| 46 | 2761-2820 | 233.0 | 125.7 |
| 47 | 2821-2880 | 203.6 | 112.0 |
| 48 | 2881-2940 | 201.6 | 118.1 |
| 49 | 2941-3000 | 223.1 | 124.1 |

(b) Saturation: base cells reach 339 at level 400; plateau = the 433 cycles from there on, cycle-median arrows median 93, lower quartile 89; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 343.

(c) Admissible shapes per bag window (192 windows over levels 1-3000): 26 from level 1; 25 from level 27; 24 from level 202; 23 from level 226; 22 from level 249; 20 from level 271; 17 from level 311; 16 from level 345; 15 from level 361.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 0 window slots where a shape could hold every target of the window but sat it out (0 of 192 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 244 arrows at index 19187 (Super Hard Rectangle 20×30, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 44 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 33 | 0.16 | 106 | 24 | 185 | 42 | 0.23 |
| 12 | 7-12 | 158 | 39 | 0.25 | 89 | 27 | 184 | 43 | 0.23 |
| 40 | 37-42 | 189 | 44 | 0.23 | 97 | 32 | 185 | 53 | 0.28 |
| 100 | 97-102 | 153 | 65 | 0.42 | 79 | 38 | 211 | 69 | 0.33 |
| 400 | 397-402 | 243 | 234 | 0.96 | 125 | 119 | 198 | 203 | 1.02 |
| 1000 | 997-1002 | 224 | 172 | 0.77 | 97 | 87 | 202 | 183 | 0.91 |

Heaviest board over indices 0-9999: 235 arrows at index 4853 (Super Hard X 37×37); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 12.14 ms (min 11.89) against v1 index 7157 (262 arrows) 14.22 ms (min 13.87): ratio 0.853.

### Curve S1000b

Saturation (b): level 871 — after it, difficulty is carried by the bias (1 -> 0.3 by level 3000), then flat; median blocked of the first vs last 50 cycles after saturation: 84.3 -> 110.3 (x1.31).

| row | level index | displayed level | base cells | clearableBias |
|---|---|---|---|---|
| 0 | 0 | 1 | 88 | 3 |
| 1 | 999 | 1000 | 339 | unset (1) |
| 2 | 2999 | 3000 | 339 | 0.3 |

Key levels (cells from the table; "dealt" is the board generate(i, 2, { curve }) returns at that level):

| level | tier | Normal | Hard | Super Hard | bias | look | dealt shape | rows×cols | arrows |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal | 88 | 134 | 158 | 3 | accepted (W3-13, level 1) | Pine | 18×16 | 23 |
| 2 | Normal | 88 | 134 | 158 | 2.997997997997998 | look not accepted | Cat | 14×14 | 20 |
| 5 | Normal | 89 | 135 | 160 | 2.991991991991992 | look not accepted | Bolt | 32×26 | 23 |
| 10 | Normal | 90 | 137 | 162 | 2.981981981981982 | look not accepted | Rocket | 18×14 | 23 |
| 20 | Normal | 93 | 141 | 167 | 2.961961961961962 | look not accepted | Arrow | 19×17 | 25 |
| 50 | Normal | 100 | 152 | 180 | 2.901901901901902 | look not accepted | X | 15×15 | 23 |
| 100 | Normal | 113 | 171 | 203 | 2.8018018018018016 | look not accepted | X | 16×16 | 29 |
| 200 | Normal | 138 | 209 | 248 | 2.6016016016016015 | look not accepted | X | 17×17 | 32 |
| 500 | Normal | 213 | 324 | 383 | 2.001001001001001 | look not accepted | Triangle | 24×24 | 57 |
| 1000 | Normal | 339 | 515 | 609 | unset (1) | neutral | Circle | 23×23 | 81 |
| 5000 | Normal | 339 | 515 | 609 | 0.3 | look not accepted | Flower | 27×27 | 77 |

(a) Cycle medians over levels 1-3000 (500 full 6-level cycles; the probe's median of 6 boards).
    Raw cycle-to-cycle drops: scan 245, blocked 250 of 499 steps.
    Literal cycle-to-cycle monotonicity is not resolvable: a flat curve's cycle medians also drop about half the time (shape and fill noise).
    Block medians (50 cycles = 300 levels, 10 blocks): drops scan none; blocked 1, largest 0.7% at level 2101.
    Resolution (FLAT (base 339 from level 1, neutral, levels 1-12000), 40 blocks): the largest 300-level block-to-block change on a flat curve is 6.3% (scan), 11.3% (blocked).
    Non-decreasing within resolution (300-level blocks): scan PASS, blocked PASS.
    Finer, 60-level blocks (50): drops scan 18, largest 17.3% at level 2221; blocked 20, largest 24.8% at level 1201; flat-curve resolution 34.3% / 40.5%: scan PASS, blocked PASS (coarse: shown, not the verdict).

| block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-300 | 45.4 | 15.0 |
| 1 | 301-600 | 88.4 | 32.7 |
| 2 | 601-900 | 139.5 | 66.7 |
| 3 | 901-1200 | 178.8 | 87.0 |
| 4 | 1201-1500 | 185.1 | 93.3 |
| 5 | 1501-1800 | 187.2 | 96.4 |
| 6 | 1801-2100 | 191.2 | 101.2 |
| 7 | 2101-2400 | 191.9 | 100.5 |
| 8 | 2401-2700 | 196.9 | 105.9 |
| 9 | 2701-3000 | 204.7 | 110.3 |

| 60-level block | levels | median scan | median blocked |
|---|---|---|---|
| 0 | 1-60 | 33.9 | 8.3 |
| 1 | 61-120 | 40.2 | 12.6 |
| 2 | 121-180 | 46.3 | 15.8 |
| 3 | 181-240 | 58.9 | 19.9 |
| 4 | 241-300 | 64.5 | 22.0 |
| 5 | 301-360 | 71.9 | 25.9 |
| 6 | 361-420 | 77.5 | 32.4 |
| 7 | 421-480 | 87.5 | 32.5 |
| 8 | 481-540 | 101.8 | 44.7 |
| 9 | 541-600 | 102.0 | 45.0 |
| 10 | 601-660 | 123.0 | 58.9 |
| 11 | 661-720 | 134.7 | 61.8 |
| 12 | 721-780 | 138.6 | 71.3 |
| 13 | 781-840 | 141.2 | 71.5 |
| 14 | 841-900 | 151.3 | 70.1 |
| 15 | 901-960 | 172.8 | 82.0 |
| 16 | 961-1020 | 194.6 | 97.4 |
| 17 | 1021-1080 | 175.8 | 88.8 |
| 18 | 1081-1140 | 178.8 | 86.6 |
| 19 | 1141-1200 | 220.4 | 129.9 |
| 20 | 1201-1260 | 204.8 | 97.7 |
| 21 | 1261-1320 | 187.1 | 97.4 |
| 22 | 1321-1380 | 177.6 | 87.4 |
| 23 | 1381-1440 | 204.2 | 108.2 |
| 24 | 1441-1500 | 185.8 | 97.7 |
| 25 | 1501-1560 | 200.9 | 104.3 |
| 26 | 1561-1620 | 183.5 | 92.5 |
| 27 | 1621-1680 | 178.6 | 92.1 |
| 28 | 1681-1740 | 192.3 | 98.3 |
| 29 | 1741-1800 | 195.0 | 103.7 |
| 30 | 1801-1860 | 178.3 | 96.1 |
| 31 | 1861-1920 | 187.9 | 101.9 |
| 32 | 1921-1980 | 225.5 | 120.0 |
| 33 | 1981-2040 | 202.8 | 110.9 |
| 34 | 2041-2100 | 186.8 | 96.2 |
| 35 | 2101-2160 | 182.6 | 89.6 |
| 36 | 2161-2220 | 232.0 | 120.4 |
| 37 | 2221-2280 | 191.9 | 99.4 |
| 38 | 2281-2340 | 207.9 | 111.5 |
| 39 | 2341-2400 | 194.7 | 100.8 |
| 40 | 2401-2460 | 192.0 | 100.3 |
| 41 | 2461-2520 | 215.3 | 109.3 |
| 42 | 2521-2580 | 199.3 | 105.3 |
| 43 | 2581-2640 | 194.4 | 103.6 |
| 44 | 2641-2700 | 202.6 | 106.6 |
| 45 | 2701-2760 | 205.3 | 107.2 |
| 46 | 2761-2820 | 230.3 | 123.3 |
| 47 | 2821-2880 | 199.9 | 114.6 |
| 48 | 2881-2940 | 193.5 | 103.5 |
| 49 | 2941-3000 | 234.8 | 122.8 |

(b) Saturation: base cells reach 339 at level 1000; plateau = the 333 cycles from there on, cycle-median arrows median 94, lower quartile 89; the first 10-cycle running median of cycle-median arrows to reach the lower quartile starts at level 871.

(c) Admissible shapes per bag window (180 windows over levels 1-3000): 26 from level 1; 25 from level 79; 24 from level 504; 23 from level 552; 22 from level 644; 21 from level 666; 20 from level 687; 19 from level 767; 17 from level 786; 16 from level 854; 15 from level 918.
    Excluded once saturated: 11 (Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket, Pine, Cat, Fish).
    Window model cost (W3-10's top-k windows): 1 window slots where a shape could hold every target of the window but sat it out (1 of 180 windows).

(d) Clamp shortfalls: 0 over levels 1-3000; 0 over the (e) sample.
(e) Heaviest board over indices 0-99999 every 7 (14286 boards): 234 arrows at index 54257 (Super Hard Square 25×25, target 609); ceiling 250: PASS; boards over 250: 0; over v1's worst (262): 0.
(f) Smallest fit cell over the (a) boards and the (e) sample: 9.15 pt at 360 dp, 10.45 pt at 411 dp (largest board 45 rows, 37 cols); floor 9.1 pt: PASS.

(g) Discontinuity for a v1 player switching at level L (ruling W3-2): v1 and v2 cycle-median scan for the cycle holding L, and the median over the 10 cycles (60 levels) from there (single cycles are noisy).

| switch level | cycle levels | v1 scan | v2 scan | v2 / v1 | v1 arrows | v2 arrows | next 60 levels: v1 scan | v2 scan | v2 / v1 |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 1-6 | 205 | 28 | 0.14 | 106 | 23 | 185 | 34 | 0.18 |
| 12 | 7-12 | 158 | 31 | 0.19 | 89 | 23 | 184 | 34 | 0.19 |
| 40 | 37-42 | 189 | 34 | 0.18 | 97 | 29 | 185 | 38 | 0.21 |
| 100 | 97-102 | 153 | 35 | 0.23 | 79 | 29 | 211 | 45 | 0.21 |
| 400 | 397-402 | 243 | 77 | 0.31 | 125 | 49 | 198 | 85 | 0.43 |
| 1000 | 997-1002 | 224 | 170 | 0.76 | 97 | 101 | 202 | 193 | 0.96 |

Heaviest board over indices 0-9999: 243 arrows at index 5339 (Super Hard X 37×37); boards over 250: 0; over v1's worst 262: 0. Node generation (same process, alternated, 15 reps each): median 13.33 ms (min 12.57) against v1 index 7157 (262 arrows) 16.82 ms (min 14.28): ratio 0.792.

## Appendix: per-cycle medians (a), every cycle, every candidate

Each cell is scan / blocked / arrows (the probe's median of the cycle's 6 boards).

| cycle | levels | S100 | S400 | S1000 | S100b | S400b | S1000b |
|---|---|---|---|---|---|---|---|
| 0 | 1-6 | 40 / 10 / 31 | 33 / 9 / 24 | 28 / 7 / 23 | 40 / 10 / 31 | 33 / 9 / 24 | 28 / 7 / 23 |
| 1 | 7-12 | 46 / 17 / 30 | 39 / 8 / 27 | 31 / 8 / 23 | 46 / 17 / 30 | 39 / 8 / 27 | 31 / 8 / 23 |
| 2 | 13-18 | 57 / 19 / 35 | 43 / 12 / 27 | 31 / 6 / 23 | 57 / 19 / 35 | 43 / 12 / 27 | 31 / 6 / 23 |
| 3 | 19-24 | 54 / 15 / 39 | 42 / 16 / 28 | 34 / 9 / 25 | 54 / 15 / 39 | 42 / 16 / 28 | 34 / 9 / 25 |
| 4 | 25-30 | 72 / 29 / 43 | 36 / 8 / 28 | 32 / 11 / 23 | 72 / 29 / 43 | 36 / 8 / 28 | 32 / 11 / 23 |
| 5 | 31-36 | 67 / 22 / 45 | 40 / 14 / 24 | 34 / 7 / 27 | 67 / 22 / 45 | 40 / 14 / 24 | 34 / 7 / 27 |
| 6 | 37-42 | 83 / 29 / 54 | 44 / 12 / 32 | 34 / 6 / 29 | 83 / 29 / 54 | 44 / 12 / 32 | 34 / 6 / 29 |
| 7 | 43-48 | 77 / 30 / 48 | 41 / 14 / 29 | 35 / 8 / 27 | 77 / 30 / 48 | 41 / 14 / 29 | 35 / 8 / 27 |
| 8 | 49-54 | 75 / 24 / 51 | 48 / 16 / 32 | 38 / 11 / 28 | 75 / 24 / 51 | 48 / 16 / 32 | 38 / 11 / 28 |
| 9 | 55-60 | 95 / 39 / 61 | 50 / 12 / 32 | 35 / 13 / 25 | 95 / 39 / 61 | 50 / 12 / 32 | 35 / 13 / 25 |
| 10 | 61-66 | 119 / 51 / 68 | 53 / 15 / 29 | 38 / 13 / 30 | 119 / 51 / 68 | 53 / 15 / 29 | 38 / 13 / 30 |
| 11 | 67-72 | 111 / 51 / 63 | 48 / 16 / 32 | 35 / 11 / 27 | 111 / 51 / 63 | 48 / 16 / 32 | 35 / 11 / 27 |
| 12 | 73-78 | 136 / 53 / 83 | 59 / 16 / 43 | 40 / 8 / 32 | 136 / 53 / 83 | 59 / 16 / 43 | 40 / 8 / 32 |
| 13 | 79-84 | 121 / 48 / 73 | 54 / 14 / 39 | 53 / 15 / 30 | 121 / 48 / 73 | 54 / 14 / 39 | 53 / 15 / 30 |
| 14 | 85-90 | 150 / 76 / 75 | 65 / 28 / 39 | 40 / 13 / 27 | 150 / 76 / 75 | 65 / 28 / 39 | 40 / 13 / 27 |
| 15 | 91-96 | 199 / 107 / 94 | 59 / 20 / 41 | 39 / 11 / 32 | 199 / 107 / 94 | 59 / 20 / 41 | 39 / 11 / 32 |
| 16 | 97-102 | 157 / 69 / 94 | 65 / 27 / 38 | 35 / 9 / 29 | 157 / 69 / 94 | 65 / 27 / 38 | 35 / 9 / 29 |
| 17 | 103-108 | 190 / 95 / 95 | 59 / 21 / 38 | 45 / 12 / 33 | 181 / 93 / 88 | 59 / 21 / 38 | 45 / 12 / 33 |
| 18 | 109-114 | 180 / 97 / 84 | 62 / 22 / 43 | 44 / 16 / 28 | 162 / 78 / 84 | 62 / 22 / 43 | 44 / 16 / 28 |
| 19 | 115-120 | 194 / 102 / 92 | 65 / 24 / 41 | 44 / 13 / 32 | 194 / 102 / 92 | 65 / 24 / 41 | 44 / 13 / 32 |
| 20 | 121-126 | 173 / 86 / 96 | 62 / 25 / 45 | 34 / 8 / 29 | 173 / 86 / 96 | 62 / 25 / 45 | 34 / 8 / 29 |
| 21 | 127-132 | 191 / 92 / 99 | 69 / 27 / 42 | 40 / 8 / 32 | 191 / 92 / 99 | 69 / 27 / 42 | 40 / 8 / 32 |
| 22 | 133-138 | 221 / 122 / 99 | 96 / 45 / 51 | 54 / 16 / 38 | 221 / 122 / 99 | 96 / 45 / 51 | 54 / 16 / 38 |
| 23 | 139-144 | 202 / 118 / 90 | 71 / 27 / 49 | 45 / 14 / 35 | 224 / 132 / 99 | 71 / 27 / 49 | 45 / 14 / 35 |
| 24 | 145-150 | 245 / 137 / 108 | 82 / 32 / 50 | 45 / 17 / 32 | 245 / 137 / 108 | 82 / 32 / 50 | 45 / 17 / 32 |
| 25 | 151-156 | 213 / 107 / 106 | 97 / 35 / 51 | 48 / 16 / 36 | 209 / 99 / 110 | 97 / 35 / 51 | 48 / 16 / 36 |
| 26 | 157-162 | 172 / 86 / 93 | 81 / 31 / 49 | 46 / 11 / 35 | 167 / 77 / 93 | 81 / 31 / 49 | 46 / 11 / 35 |
| 27 | 163-168 | 158 / 75 / 86 | 90 / 29 / 54 | 45 / 12 / 35 | 158 / 75 / 91 | 90 / 29 / 54 | 45 / 12 / 35 |
| 28 | 169-174 | 195 / 101 / 94 | 75 / 29 / 50 | 52 / 16 / 37 | 184 / 101 / 100 | 75 / 29 / 50 | 52 / 16 / 37 |
| 29 | 175-180 | 148 / 68 / 87 | 68 / 23 / 47 | 51 / 19 / 37 | 166 / 77 / 91 | 68 / 23 / 47 | 51 / 19 / 37 |
| 30 | 181-186 | 170 / 80 / 90 | 87 / 38 / 50 | 55 / 19 / 36 | 156 / 72 / 96 | 87 / 38 / 50 | 55 / 19 / 36 |
| 31 | 187-192 | 202 / 121 / 85 | 93 / 39 / 55 | 45 / 16 / 32 | 180 / 84 / 96 | 93 / 39 / 55 | 45 / 16 / 32 |
| 32 | 193-198 | 199 / 110 / 91 | 104 / 46 / 57 | 50 / 16 / 40 | 193 / 96 / 97 | 104 / 46 / 57 | 50 / 16 / 40 |
| 33 | 199-204 | 164 / 83 / 94 | 89 / 40 / 60 | 42 / 10 / 35 | 180 / 87 / 93 | 89 / 40 / 60 | 42 / 10 / 35 |
| 34 | 205-210 | 196 / 98 / 97 | 92 / 39 / 53 | 63 / 23 / 42 | 188 / 95 / 98 | 92 / 39 / 53 | 63 / 23 / 42 |
| 35 | 211-216 | 165 / 83 / 92 | 94 / 37 / 57 | 55 / 17 / 38 | 144 / 65 / 87 | 94 / 37 / 57 | 55 / 17 / 38 |
| 36 | 217-222 | 205 / 111 / 94 | 107 / 41 / 61 | 75 / 24 / 47 | 204 / 102 / 102 | 107 / 41 / 61 | 75 / 24 / 47 |
| 37 | 223-228 | 251 / 137 / 106 | 102 / 39 / 63 | 67 / 20 / 45 | 251 / 140 / 109 | 102 / 39 / 63 | 67 / 20 / 45 |
| 38 | 229-234 | 159 / 75 / 91 | 117 / 50 / 67 | 59 / 20 / 39 | 151 / 70 / 94 | 117 / 50 / 67 | 59 / 20 / 39 |
| 39 | 235-240 | 218 / 123 / 114 | 132 / 62 / 70 | 67 / 24 / 43 | 231 / 107 / 116 | 132 / 62 / 70 | 67 / 24 / 43 |
| 40 | 241-246 | 224 / 122 / 106 | 134 / 69 / 75 | 75 / 26 / 49 | 221 / 118 / 103 | 134 / 69 / 75 | 75 / 26 / 49 |
| 41 | 247-252 | 176 / 96 / 88 | 99 / 39 / 64 | 64 / 23 / 41 | 154 / 69 / 85 | 99 / 39 / 64 | 64 / 23 / 41 |
| 42 | 253-258 | 217 / 114 / 105 | 138 / 67 / 71 | 62 / 20 / 42 | 229 / 121 / 108 | 138 / 67 / 71 | 62 / 20 / 42 |
| 43 | 259-264 | 157 / 71 / 86 | 107 / 40 / 67 | 54 / 18 / 42 | 169 / 81 / 91 | 107 / 40 / 67 | 54 / 18 / 42 |
| 44 | 265-270 | 182 / 93 / 89 | 118 / 50 / 70 | 58 / 22 / 39 | 164 / 83 / 89 | 118 / 50 / 70 | 58 / 22 / 39 |
| 45 | 271-276 | 201 / 106 / 97 | 105 / 40 / 66 | 54 / 13 / 41 | 164 / 84 / 95 | 105 / 40 / 66 | 54 / 13 / 41 |
| 46 | 277-282 | 160 / 79 / 81 | 139 / 72 / 68 | 65 / 23 / 42 | 185 / 98 / 87 | 139 / 72 / 68 | 65 / 23 / 42 |
| 47 | 283-288 | 167 / 81 / 93 | 134 / 66 / 71 | 70 / 29 / 41 | 171 / 84 / 87 | 134 / 66 / 71 | 70 / 29 / 41 |
| 48 | 289-294 | 196 / 109 / 91 | 121 / 55 / 67 | 70 / 22 / 42 | 197 / 110 / 92 | 121 / 55 / 67 | 70 / 22 / 42 |
| 49 | 295-300 | 167 / 81 / 88 | 112 / 48 / 65 | 54 / 19 / 39 | 158 / 74 / 89 | 112 / 48 / 65 | 54 / 19 / 39 |
| 50 | 301-306 | 167 / 74 / 93 | 146 / 62 / 84 | 64 / 18 / 45 | 169 / 82 / 94 | 146 / 62 / 84 | 64 / 18 / 45 |
| 51 | 307-312 | 172 / 88 / 93 | 130 / 58 / 82 | 72 / 24 / 48 | 165 / 86 / 98 | 130 / 58 / 82 | 72 / 24 / 48 |
| 52 | 313-318 | 154 / 70 / 84 | 126 / 57 / 69 | 73 / 25 / 48 | 169 / 87 / 83 | 126 / 57 / 69 | 73 / 25 / 48 |
| 53 | 319-324 | 191 / 97 / 94 | 127 / 60 / 68 | 62 / 25 / 41 | 171 / 73 / 89 | 127 / 60 / 68 | 62 / 25 / 41 |
| 54 | 325-330 | 191 / 100 / 91 | 133 / 66 / 73 | 68 / 28 / 46 | 182 / 95 / 87 | 133 / 66 / 73 | 68 / 28 / 46 |
| 55 | 331-336 | 175 / 88 / 87 | 126 / 51 / 81 | 69 / 28 / 43 | 191 / 99 / 92 | 126 / 51 / 81 | 69 / 28 / 43 |
| 56 | 337-342 | 164 / 78 / 86 | 143 / 64 / 86 | 83 / 27 / 56 | 161 / 73 / 90 | 143 / 64 / 86 | 83 / 27 / 56 |
| 57 | 343-348 | 200 / 109 / 91 | 168 / 86 / 82 | 83 / 32 / 49 | 184 / 92 / 90 | 168 / 86 / 82 | 83 / 32 / 49 |
| 58 | 349-354 | 159 / 74 / 86 | 157 / 77 / 80 | 63 / 23 / 41 | 182 / 84 / 98 | 157 / 77 / 80 | 63 / 23 / 41 |
| 59 | 355-360 | 182 / 103 / 82 | 162 / 80 / 82 | 72 / 26 / 46 | 160 / 81 / 83 | 162 / 80 / 82 | 72 / 26 / 46 |
| 60 | 361-366 | 172 / 89 / 92 | 194 / 117 / 82 | 61 / 15 / 46 | 180 / 93 / 87 | 194 / 117 / 82 | 61 / 15 / 46 |
| 61 | 367-372 | 179 / 84 / 101 | 168 / 90 / 91 | 70 / 25 / 47 | 154 / 69 / 92 | 168 / 90 / 91 | 70 / 25 / 47 |
| 62 | 373-378 | 157 / 65 / 92 | 159 / 76 / 84 | 74 / 33 / 47 | 191 / 98 / 93 | 159 / 76 / 84 | 74 / 33 / 47 |
| 63 | 379-384 | 202 / 86 / 98 | 162 / 77 / 92 | 74 / 29 / 45 | 170 / 89 / 87 | 162 / 77 / 92 | 74 / 29 / 45 |
| 64 | 385-390 | 256 / 132 / 118 | 242 / 125 / 114 | 94 / 42 / 56 | 217 / 122 / 100 | 242 / 125 / 114 | 94 / 42 / 56 |
| 65 | 391-396 | 216 / 106 / 110 | 210 / 118 / 99 | 103 / 49 / 57 | 198 / 107 / 110 | 210 / 118 / 99 | 103 / 49 / 57 |
| 66 | 397-402 | 221 / 122 / 105 | 234 / 132 / 119 | 77 / 28 / 49 | 211 / 110 / 105 | 234 / 132 / 119 | 77 / 28 / 49 |
| 67 | 403-408 | 235 / 108 / 111 | 198 / 113 / 96 | 96 / 34 / 62 | 243 / 114 / 112 | 198 / 113 / 96 | 96 / 34 / 62 |
| 68 | 409-414 | 218 / 107 / 101 | 218 / 107 / 107 | 88 / 32 / 56 | 187 / 87 / 100 | 218 / 108 / 107 | 88 / 32 / 56 |
| 69 | 415-420 | 261 / 148 / 113 | 209 / 105 / 104 | 77 / 29 / 51 | 262 / 128 / 107 | 236 / 113 / 117 | 77 / 29 / 51 |
| 70 | 421-426 | 240 / 130 / 110 | 240 / 130 / 110 | 105 / 45 / 60 | 215 / 117 / 101 | 240 / 130 / 110 | 105 / 45 / 60 |
| 71 | 427-432 | 166 / 81 / 85 | 179 / 86 / 93 | 87 / 32 / 59 | 181 / 98 / 91 | 179 / 85 / 95 | 87 / 32 / 59 |
| 72 | 433-438 | 181 / 94 / 88 | 152 / 73 / 84 | 77 / 28 / 54 | 172 / 81 / 91 | 163 / 80 / 85 | 77 / 28 / 54 |
| 73 | 439-444 | 181 / 83 / 98 | 170 / 80 / 90 | 76 / 29 / 54 | 171 / 81 / 95 | 160 / 74 / 86 | 76 / 29 / 54 |
| 74 | 445-450 | 169 / 80 / 89 | 169 / 87 / 87 | 85 / 31 / 56 | 176 / 85 / 92 | 203 / 112 / 87 | 85 / 31 / 56 |
| 75 | 451-456 | 165 / 84 / 87 | 179 / 93 / 92 | 75 / 28 / 47 | 164 / 83 / 88 | 170 / 91 / 84 | 75 / 28 / 47 |
| 76 | 457-462 | 177 / 91 / 86 | 162 / 74 / 88 | 88 / 38 / 54 | 178 / 84 / 88 | 177 / 86 / 91 | 88 / 38 / 54 |
| 77 | 463-468 | 164 / 81 / 94 | 183 / 87 / 96 | 86 / 31 / 55 | 178 / 87 / 92 | 162 / 74 / 89 | 86 / 31 / 55 |
| 78 | 469-474 | 244 / 133 / 112 | 227 / 125 / 111 | 95 / 37 / 58 | 229 / 128 / 101 | 227 / 120 / 102 | 95 / 37 / 58 |
| 79 | 475-480 | 180 / 98 / 90 | 212 / 118 / 94 | 92 / 38 / 54 | 195 / 108 / 89 | 177 / 90 / 90 | 92 / 38 / 54 |
| 80 | 481-486 | 194 / 84 / 110 | 230 / 129 / 101 | 99 / 41 / 59 | 207 / 98 / 109 | 223 / 125 / 98 | 99 / 41 / 59 |
| 81 | 487-492 | 188 / 92 / 96 | 209 / 93 / 100 | 101 / 41 / 61 | 165 / 74 / 91 | 195 / 97 / 98 | 101 / 41 / 61 |
| 82 | 493-498 | 254 / 131 / 101 | 214 / 113 / 105 | 134 / 64 / 69 | 240 / 134 / 100 | 237 / 135 / 102 | 134 / 64 / 69 |
| 83 | 499-504 | 212 / 110 / 102 | 222 / 107 / 115 | 112 / 48 / 64 | 192 / 96 / 99 | 230 / 133 / 108 | 112 / 48 / 64 |
| 84 | 505-510 | 247 / 132 / 115 | 206 / 115 / 112 | 127 / 50 / 59 | 293 / 162 / 119 | 257 / 139 / 114 | 127 / 50 / 59 |
| 85 | 511-516 | 191 / 101 / 99 | 187 / 94 / 93 | 102 / 45 / 60 | 223 / 95 / 110 | 242 / 138 / 104 | 102 / 45 / 60 |
| 86 | 517-522 | 184 / 88 / 96 | 193 / 97 / 96 | 95 / 40 / 58 | 196 / 109 / 90 | 185 / 103 / 87 | 95 / 40 / 58 |
| 87 | 523-528 | 240 / 105 / 103 | 196 / 105 / 91 | 120 / 60 / 60 | 214 / 117 / 97 | 171 / 82 / 90 | 120 / 60 / 60 |
| 88 | 529-534 | 176 / 94 / 87 | 189 / 94 / 95 | 92 / 36 / 62 | 158 / 76 / 85 | 158 / 88 / 88 | 92 / 36 / 62 |
| 89 | 535-540 | 214 / 121 / 93 | 196 / 109 / 87 | 93 / 35 / 59 | 224 / 121 / 103 | 174 / 83 / 91 | 93 / 35 / 59 |
| 90 | 541-546 | 169 / 76 / 93 | 187 / 92 / 95 | 91 / 37 / 56 | 169 / 79 / 90 | 179 / 85 / 94 | 91 / 37 / 56 |
| 91 | 547-552 | 169 / 88 / 88 | 166 / 82 / 89 | 88 / 33 / 60 | 178 / 100 / 89 | 161 / 82 / 87 | 88 / 33 / 60 |
| 92 | 553-558 | 182 / 89 / 93 | 187 / 93 / 94 | 87 / 28 / 59 | 170 / 81 / 92 | 187 / 99 / 88 | 87 / 28 / 59 |
| 93 | 559-564 | 157 / 70 / 87 | 164 / 87 / 87 | 116 / 48 / 64 | 170 / 82 / 88 | 171 / 74 / 96 | 116 / 48 / 64 |
| 94 | 565-570 | 161 / 77 / 90 | 168 / 83 / 85 | 102 / 45 / 68 | 161 / 77 / 85 | 173 / 82 / 91 | 102 / 45 / 68 |
| 95 | 571-576 | 201 / 108 / 94 | 193 / 106 / 90 | 119 / 55 / 70 | 187 / 92 / 90 | 167 / 89 / 84 | 119 / 55 / 70 |
| 96 | 577-582 | 153 / 77 / 89 | 217 / 120 / 93 | 107 / 48 / 61 | 151 / 75 / 92 | 184 / 93 / 91 | 107 / 48 / 61 |
| 97 | 583-588 | 163 / 83 / 83 | 191 / 97 / 94 | 100 / 40 / 64 | 176 / 100 / 81 | 168 / 79 / 89 | 100 / 40 / 64 |
| 98 | 589-594 | 167 / 80 / 90 | 153 / 71 / 90 | 115 / 60 / 56 | 183 / 96 / 87 | 176 / 89 / 93 | 115 / 60 / 56 |
| 99 | 595-600 | 149 / 66 / 85 | 198 / 103 / 95 | 90 / 31 / 65 | 194 / 96 / 94 | 172 / 88 / 84 | 90 / 31 / 65 |
| 100 | 601-606 | 168 / 80 / 92 | 181 / 94 / 89 | 114 / 48 / 66 | 191 / 99 / 94 | 175 / 82 / 93 | 114 / 48 / 66 |
| 101 | 607-612 | 160 / 82 / 82 | 160 / 82 / 82 | 117 / 60 / 64 | 195 / 100 / 95 | 184 / 92 / 92 | 117 / 60 / 64 |
| 102 | 613-618 | 172 / 86 / 94 | 189 / 102 / 89 | 138 / 67 / 71 | 189 / 92 / 97 | 186 / 98 / 93 | 138 / 67 / 71 |
| 103 | 619-624 | 175 / 92 / 89 | 146 / 67 / 87 | 105 / 45 / 60 | 181 / 104 / 96 | 168 / 86 / 87 | 105 / 45 / 60 |
| 104 | 625-630 | 163 / 74 / 98 | 177 / 92 / 93 | 103 / 39 / 64 | 211 / 112 / 99 | 145 / 69 / 86 | 103 / 39 / 64 |
| 105 | 631-636 | 186 / 92 / 94 | 182 / 93 / 95 | 121 / 44 / 72 | 160 / 70 / 90 | 201 / 104 / 97 | 121 / 44 / 72 |
| 106 | 637-642 | 160 / 70 / 97 | 223 / 112 / 111 | 129 / 59 / 70 | 198 / 107 / 91 | 227 / 115 / 112 | 129 / 59 / 70 |
| 107 | 643-648 | 292 / 172 / 120 | 189 / 95 / 99 | 155 / 79 / 76 | 189 / 86 / 106 | 231 / 127 / 104 | 155 / 79 / 76 |
| 108 | 649-654 | 217 / 113 / 104 | 216 / 107 / 109 | 174 / 90 / 81 | 183 / 95 / 88 | 199 / 97 / 110 | 174 / 90 / 81 |
| 109 | 655-660 | 154 / 72 / 91 | 186 / 95 / 91 | 123 / 52 / 71 | 179 / 85 / 100 | 182 / 86 / 97 | 123 / 52 / 71 |
| 110 | 661-666 | 233 / 128 / 105 | 205 / 107 / 98 | 171 / 84 / 87 | 215 / 110 / 105 | 200 / 99 / 101 | 171 / 84 / 87 |
| 111 | 667-672 | 206 / 112 / 95 | 211 / 111 / 100 | 135 / 59 / 68 | 190 / 96 / 95 | 193 / 82 / 97 | 135 / 59 / 68 |
| 112 | 673-678 | 189 / 102 / 87 | 184 / 93 / 92 | 125 / 62 / 70 | 178 / 87 / 101 | 166 / 83 / 90 | 125 / 62 / 70 |
| 113 | 679-684 | 258 / 142 / 104 | 199 / 105 / 94 | 168 / 73 / 86 | 265 / 134 / 119 | 214 / 118 / 96 | 168 / 73 / 86 |
| 114 | 685-690 | 191 / 94 / 97 | 255 / 145 / 110 | 127 / 56 / 71 | 199 / 108 / 91 | 180 / 96 / 92 | 127 / 56 / 71 |
| 115 | 691-696 | 163 / 79 / 87 | 168 / 77 / 92 | 104 / 41 / 63 | 184 / 90 / 94 | 191 / 103 / 88 | 104 / 41 / 63 |
| 116 | 697-702 | 180 / 89 / 91 | 163 / 83 / 91 | 137 / 64 / 73 | 191 / 100 / 94 | 180 / 87 / 93 | 137 / 64 / 73 |
| 117 | 703-708 | 166 / 73 / 93 | 218 / 118 / 97 | 114 / 46 / 68 | 174 / 86 / 90 | 172 / 85 / 87 | 114 / 46 / 68 |
| 118 | 709-714 | 179 / 91 / 91 | 173 / 86 / 90 | 138 / 68 / 72 | 202 / 101 / 101 | 194 / 105 / 89 | 138 / 68 / 72 |
| 119 | 715-720 | 169 / 77 / 92 | 154 / 73 / 88 | 128 / 56 / 72 | 201 / 114 / 97 | 146 / 64 / 84 | 128 / 56 / 72 |
| 120 | 721-726 | 212 / 105 / 107 | 170 / 85 / 87 | 159 / 78 / 81 | 195 / 94 / 101 | 174 / 88 / 97 | 159 / 78 / 81 |
| 121 | 727-732 | 154 / 71 / 92 | 171 / 81 / 92 | 115 / 52 / 74 | 171 / 84 / 105 | 192 / 90 / 95 | 115 / 52 / 74 |
| 122 | 733-738 | 156 / 64 / 92 | 174 / 87 / 87 | 139 / 71 / 72 | 174 / 83 / 91 | 182 / 88 / 94 | 139 / 71 / 72 |
| 123 | 739-744 | 157 / 72 / 85 | 189 / 85 / 104 | 122 / 55 / 68 | 185 / 100 / 96 | 171 / 82 / 88 | 122 / 55 / 68 |
| 124 | 745-750 | 238 / 115 / 104 | 256 / 146 / 110 | 134 / 64 / 70 | 227 / 119 / 102 | 260 / 139 / 108 | 134 / 64 / 70 |
| 125 | 751-756 | 242 / 137 / 105 | 234 / 132 / 102 | 198 / 110 / 88 | 264 / 158 / 112 | 288 / 153 / 118 | 198 / 110 / 88 |
| 126 | 757-762 | 252 / 128 / 121 | 210 / 109 / 101 | 175 / 89 / 83 | 225 / 102 / 108 | 214 / 110 / 103 | 175 / 89 / 83 |
| 127 | 763-768 | 201 / 113 / 88 | 182 / 87 / 95 | 112 / 43 / 71 | 181 / 89 / 92 | 166 / 68 / 98 | 112 / 43 / 71 |
| 128 | 769-774 | 176 / 73 / 103 | 177 / 94 / 82 | 124 / 57 / 75 | 164 / 85 / 97 | 165 / 85 / 86 | 124 / 57 / 75 |
| 129 | 775-780 | 155 / 67 / 91 | 181 / 93 / 89 | 158 / 83 / 82 | 194 / 105 / 89 | 201 / 101 / 100 | 158 / 83 / 82 |
| 130 | 781-786 | 175 / 88 / 89 | 165 / 83 / 88 | 134 / 61 / 73 | 192 / 101 / 91 | 162 / 80 / 85 | 134 / 61 / 73 |
| 131 | 787-792 | 161 / 77 / 91 | 155 / 69 / 87 | 141 / 61 / 86 | 185 / 93 / 92 | 219 / 128 / 91 | 141 / 61 / 86 |
| 132 | 793-798 | 150 / 67 / 89 | 155 / 62 / 93 | 141 / 71 / 73 | 174 / 88 / 87 | 152 / 73 / 91 | 141 / 71 / 73 |
| 133 | 799-804 | 168 / 78 / 90 | 174 / 86 / 88 | 126 / 60 / 76 | 160 / 76 / 94 | 176 / 96 / 103 | 126 / 60 / 76 |
| 134 | 805-810 | 170 / 80 / 90 | 169 / 75 / 94 | 145 / 71 / 84 | 185 / 95 / 90 | 187 / 104 / 86 | 145 / 71 / 84 |
| 135 | 811-816 | 159 / 74 / 85 | 165 / 75 / 90 | 132 / 55 / 76 | 175 / 88 / 92 | 180 / 87 / 93 | 132 / 55 / 76 |
| 136 | 817-822 | 187 / 88 / 99 | 210 / 88 / 92 | 139 / 73 / 74 | 156 / 77 / 84 | 170 / 84 / 87 | 139 / 73 / 74 |
| 137 | 823-828 | 172 / 95 / 92 | 177 / 85 / 92 | 146 / 78 / 73 | 180 / 89 / 92 | 184 / 91 / 93 | 146 / 78 / 73 |
| 138 | 829-834 | 165 / 86 / 91 | 177 / 89 / 92 | 160 / 76 / 79 | 165 / 78 / 88 | 199 / 104 / 95 | 160 / 76 / 79 |
| 139 | 835-840 | 233 / 127 / 102 | 147 / 70 / 85 | 168 / 89 / 79 | 209 / 116 / 93 | 189 / 106 / 83 | 168 / 89 / 79 |
| 140 | 841-846 | 187 / 97 / 90 | 177 / 100 / 88 | 147 / 69 / 78 | 175 / 85 / 90 | 164 / 68 / 96 | 147 / 69 / 78 |
| 141 | 847-852 | 191 / 97 / 94 | 195 / 94 / 101 | 153 / 73 / 80 | 158 / 74 / 84 | 172 / 87 / 90 | 153 / 73 / 80 |
| 142 | 853-858 | 194 / 108 / 92 | 186 / 91 / 95 | 151 / 70 / 81 | 165 / 91 / 92 | 186 / 95 / 91 | 151 / 70 / 81 |
| 143 | 859-864 | 177 / 92 / 91 | 177 / 86 / 91 | 144 / 65 / 80 | 178 / 86 / 92 | 177 / 87 / 90 | 144 / 65 / 80 |
| 144 | 865-870 | 183 / 90 / 93 | 199 / 107 / 92 | 151 / 69 / 83 | 195 / 106 / 90 | 226 / 137 / 89 | 151 / 69 / 83 |
| 145 | 871-876 | 155 / 69 / 86 | 157 / 70 / 90 | 140 / 66 / 75 | 190 / 81 / 87 | 179 / 85 / 94 | 140 / 66 / 75 |
| 146 | 877-882 | 177 / 86 / 94 | 182 / 97 / 86 | 159 / 79 / 82 | 215 / 106 / 109 | 172 / 87 / 86 | 159 / 79 / 82 |
| 147 | 883-888 | 169 / 87 / 83 | 180 / 88 / 92 | 177 / 92 / 85 | 196 / 103 / 94 | 188 / 98 / 90 | 177 / 92 / 85 |
| 148 | 889-894 | 179 / 92 / 89 | 210 / 110 / 100 | 142 / 70 / 87 | 184 / 90 / 86 | 173 / 86 / 91 | 142 / 70 / 87 |
| 149 | 895-900 | 176 / 91 / 85 | 179 / 84 / 95 | 169 / 82 / 87 | 161 / 77 / 85 | 169 / 83 / 86 | 169 / 82 / 87 |
| 150 | 901-906 | 238 / 131 / 107 | 179 / 96 / 96 | 183 / 80 / 103 | 212 / 125 / 98 | 226 / 119 / 107 | 183 / 80 / 103 |
| 151 | 907-912 | 184 / 95 / 99 | 245 / 123 / 122 | 169 / 74 / 95 | 237 / 139 / 98 | 202 / 94 / 108 | 169 / 74 / 95 |
| 152 | 913-918 | 196 / 96 / 100 | 169 / 85 / 90 | 230 / 124 / 103 | 208 / 108 / 100 | 192 / 95 / 97 | 230 / 124 / 103 |
| 153 | 919-924 | 198 / 85 / 100 | 176 / 89 / 88 | 172 / 82 / 90 | 183 / 90 / 88 | 181 / 85 / 99 | 172 / 82 / 90 |
| 154 | 925-930 | 180 / 86 / 94 | 167 / 88 / 92 | 176 / 84 / 92 | 196 / 104 / 92 | 158 / 73 / 97 | 176 / 84 / 92 |
| 155 | 931-936 | 205 / 103 / 102 | 188 / 104 / 90 | 149 / 63 / 86 | 171 / 86 / 85 | 168 / 81 / 91 | 149 / 63 / 86 |
| 156 | 937-942 | 189 / 94 / 95 | 240 / 136 / 103 | 180 / 94 / 97 | 198 / 105 / 93 | 229 / 137 / 92 | 180 / 94 / 97 |
| 157 | 943-948 | 165 / 85 / 86 | 217 / 103 / 102 | 173 / 83 / 105 | 236 / 133 / 101 | 225 / 107 / 108 | 173 / 83 / 105 |
| 158 | 949-954 | 192 / 79 / 88 | 162 / 75 / 87 | 164 / 76 / 93 | 186 / 86 / 99 | 152 / 69 / 83 | 164 / 76 / 93 |
| 159 | 955-960 | 177 / 86 / 93 | 176 / 86 / 90 | 160 / 82 / 82 | 176 / 87 / 91 | 179 / 89 / 90 | 160 / 82 / 82 |
| 160 | 961-966 | 156 / 73 / 94 | 162 / 77 / 94 | 169 / 81 / 91 | 185 / 91 / 94 | 165 / 76 / 89 | 169 / 81 / 91 |
| 161 | 967-972 | 164 / 83 / 87 | 161 / 82 / 88 | 168 / 84 / 84 | 179 / 95 / 87 | 162 / 69 / 93 | 168 / 84 / 84 |
| 162 | 973-978 | 174 / 82 / 95 | 174 / 82 / 95 | 157 / 76 / 91 | 174 / 93 / 87 | 181 / 100 / 85 | 157 / 76 / 91 |
| 163 | 979-984 | 167 / 85 / 84 | 165 / 75 / 96 | 179 / 83 / 90 | 150 / 68 / 84 | 175 / 87 / 102 | 179 / 83 / 90 |
| 164 | 985-990 | 198 / 102 / 96 | 196 / 104 / 92 | 212 / 97 / 105 | 176 / 86 / 99 | 237 / 129 / 108 | 212 / 97 / 105 |
| 165 | 991-996 | 235 / 129 / 99 | 245 / 126 / 101 | 298 / 172 / 126 | 245 / 116 / 104 | 257 / 135 / 104 | 298 / 172 / 126 |
| 166 | 997-1002 | 177 / 85 / 92 | 163 / 74 / 91 | 170 / 77 / 101 | 190 / 98 / 97 | 172 / 91 / 87 | 170 / 77 / 101 |
| 167 | 1003-1008 | 207 / 91 / 103 | 264 / 123 / 108 | 245 / 125 / 111 | 246 / 124 / 116 | 263 / 137 / 107 | 245 / 125 / 111 |
| 168 | 1009-1014 | 216 / 90 / 119 | 238 / 116 / 119 | 293 / 156 / 124 | 265 / 131 / 120 | 219 / 103 / 116 | 290 / 156 / 124 |
| 169 | 1015-1020 | 225 / 121 / 104 | 225 / 121 / 104 | 177 / 87 / 90 | 183 / 86 / 97 | 211 / 105 / 106 | 195 / 103 / 92 |
| 170 | 1021-1026 | 230 / 126 / 104 | 216 / 106 / 103 | 208 / 98 / 110 | 226 / 123 / 103 | 227 / 122 / 105 | 208 / 98 / 110 |
| 171 | 1027-1032 | 178 / 93 / 90 | 153 / 67 / 101 | 172 / 79 / 93 | 202 / 111 / 98 | 176 / 91 / 90 | 193 / 97 / 96 |
| 172 | 1033-1038 | 176 / 84 / 92 | 178 / 94 / 86 | 156 / 77 / 86 | 225 / 126 / 99 | 171 / 86 / 89 | 162 / 78 / 92 |
| 173 | 1039-1044 | 188 / 95 / 92 | 151 / 71 / 94 | 162 / 80 / 86 | 181 / 91 / 89 | 177 / 88 / 90 | 157 / 80 / 83 |
| 174 | 1045-1050 | 161 / 72 / 94 | 157 / 75 / 85 | 148 / 68 / 91 | 168 / 84 / 84 | 174 / 95 / 96 | 161 / 78 / 91 |
| 175 | 1051-1056 | 190 / 103 / 91 | 179 / 90 / 87 | 177 / 80 / 97 | 169 / 78 / 91 | 183 / 88 / 99 | 177 / 80 / 97 |
| 176 | 1057-1062 | 165 / 80 / 90 | 168 / 85 / 90 | 158 / 80 / 90 | 195 / 98 / 97 | 188 / 104 / 95 | 175 / 92 / 83 |
| 177 | 1063-1068 | 181 / 85 / 96 | 181 / 85 / 96 | 160 / 78 / 94 | 179 / 87 / 92 | 171 / 71 / 100 | 172 / 84 / 88 |
| 178 | 1069-1074 | 183 / 100 / 92 | 173 / 90 / 94 | 230 / 109 / 91 | 182 / 95 / 90 | 177 / 90 / 93 | 176 / 89 / 94 |
| 179 | 1075-1080 | 166 / 81 / 95 | 176 / 86 / 95 | 160 / 72 / 89 | 182 / 95 / 88 | 206 / 101 / 105 | 185 / 90 / 90 |
| 180 | 1081-1086 | 167 / 79 / 91 | 158 / 74 / 84 | 159 / 74 / 85 | 188 / 88 / 100 | 195 / 99 / 96 | 171 / 85 / 86 |
| 181 | 1087-1092 | 204 / 105 / 94 | 203 / 118 / 89 | 179 / 88 / 91 | 172 / 91 / 89 | 193 / 98 / 95 | 179 / 87 / 82 |
| 182 | 1093-1098 | 175 / 76 / 100 | 180 / 82 / 98 | 170 / 85 / 85 | 193 / 104 / 97 | 169 / 82 / 90 | 178 / 93 / 87 |
| 183 | 1099-1104 | 186 / 100 / 89 | 180 / 91 / 93 | 152 / 75 / 84 | 183 / 94 / 89 | 175 / 86 / 89 | 149 / 67 / 82 |
| 184 | 1105-1110 | 175 / 95 / 84 | 170 / 85 / 85 | 173 / 89 / 87 | 197 / 101 / 96 | 167 / 87 / 88 | 189 / 78 / 88 |
| 185 | 1111-1116 | 179 / 93 / 86 | 165 / 79 / 86 | 174 / 85 / 95 | 168 / 86 / 88 | 196 / 108 / 88 | 187 / 93 / 98 |
| 186 | 1117-1122 | 179 / 95 / 86 | 170 / 84 / 86 | 170 / 79 / 91 | 178 / 94 / 88 | 178 / 92 / 90 | 197 / 99 / 98 |
| 187 | 1123-1128 | 154 / 72 / 88 | 155 / 74 / 89 | 165 / 77 / 93 | 205 / 112 / 93 | 168 / 86 / 83 | 164 / 77 / 87 |
| 188 | 1129-1134 | 167 / 74 / 93 | 188 / 98 / 97 | 154 / 69 / 91 | 192 / 103 / 96 | 187 / 96 / 99 | 161 / 81 / 97 |
| 189 | 1135-1140 | 177 / 96 / 98 | 191 / 93 / 98 | 147 / 67 / 83 | 194 / 109 / 90 | 181 / 88 / 93 | 188 / 98 / 90 |
| 190 | 1141-1146 | 192 / 93 / 96 | 192 / 105 / 89 | 154 / 67 / 87 | 181 / 91 / 86 | 168 / 80 / 91 | 169 / 86 / 86 |
| 191 | 1147-1152 | 179 / 88 / 91 | 179 / 88 / 91 | 162 / 83 / 84 | 168 / 90 / 81 | 186 / 93 / 96 | 163 / 87 / 92 |
| 192 | 1153-1158 | 243 / 118 / 105 | 249 / 139 / 105 | 230 / 115 / 104 | 189 / 91 / 90 | 199 / 101 / 98 | 258 / 131 / 113 |
| 193 | 1159-1164 | 281 / 154 / 110 | 304 / 183 / 121 | 264 / 156 / 108 | 242 / 128 / 114 | 260 / 154 / 106 | 268 / 132 / 112 |
| 194 | 1165-1170 | 242 / 129 / 109 | 241 / 124 / 111 | 265 / 152 / 120 | 219 / 123 / 96 | 212 / 99 / 104 | 262 / 137 / 125 |
| 195 | 1171-1176 | 220 / 119 / 102 | 222 / 118 / 104 | 235 / 127 / 108 | 230 / 133 / 97 | 201 / 107 / 94 | 220 / 115 / 105 |
| 196 | 1177-1182 | 209 / 108 / 100 | 155 / 68 / 94 | 210 / 121 / 89 | 170 / 78 / 92 | 190 / 99 / 101 | 219 / 130 / 89 |
| 197 | 1183-1188 | 241 / 132 / 106 | 197 / 98 / 103 | 197 / 94 / 103 | 227 / 115 / 112 | 171 / 83 / 96 | 211 / 107 / 104 |
| 198 | 1189-1194 | 209 / 98 / 101 | 216 / 118 / 98 | 293 / 181 / 112 | 220 / 114 / 106 | 252 / 140 / 112 | 250 / 139 / 111 |
| 199 | 1195-1200 | 156 / 72 / 87 | 180 / 85 / 89 | 174 / 86 / 88 | 170 / 93 / 89 | 150 / 68 / 87 | 215 / 120 / 97 |
| 200 | 1201-1206 | 150 / 67 / 85 | 165 / 84 / 98 | 182 / 89 / 93 | 176 / 93 / 98 | 169 / 88 / 92 | 212 / 109 / 103 |
| 201 | 1207-1212 | 158 / 70 / 90 | 192 / 100 / 92 | 163 / 71 / 92 | 165 / 75 / 90 | 167 / 82 / 86 | 182 / 98 / 94 |
| 202 | 1213-1218 | 168 / 80 / 88 | 180 / 89 / 91 | 159 / 82 / 86 | 182 / 95 / 87 | 183 / 91 / 92 | 205 / 119 / 95 |
| 203 | 1219-1224 | 216 / 114 / 102 | 223 / 123 / 100 | 189 / 100 / 89 | 199 / 114 / 96 | 197 / 100 / 97 | 205 / 106 / 99 |
| 204 | 1225-1230 | 196 / 92 / 94 | 148 / 67 / 84 | 156 / 74 / 87 | 172 / 100 / 81 | 180 / 97 / 83 | 166 / 79 / 87 |
| 205 | 1231-1236 | 193 / 96 / 97 | 167 / 82 / 96 | 189 / 77 / 109 | 191 / 95 / 96 | 202 / 107 / 95 | 177 / 77 / 105 |
| 206 | 1237-1242 | 247 / 130 / 117 | 207 / 92 / 95 | 218 / 92 / 106 | 217 / 114 / 104 | 213 / 100 / 104 | 216 / 93 / 102 |
| 207 | 1243-1248 | 222 / 105 / 117 | 181 / 88 / 93 | 181 / 87 / 94 | 184 / 86 / 107 | 190 / 105 / 94 | 230 / 122 / 108 |
| 208 | 1249-1254 | 239 / 137 / 102 | 239 / 137 / 102 | 239 / 117 / 102 | 235 / 121 / 114 | 194 / 98 / 96 | 185 / 94 / 91 |
| 209 | 1255-1260 | 240 / 109 / 113 | 206 / 109 / 93 | 175 / 92 / 99 | 248 / 122 / 111 | 220 / 103 / 106 | 190 / 90 / 100 |
| 210 | 1261-1266 | 181 / 90 / 93 | 186 / 92 / 94 | 201 / 114 / 97 | 196 / 101 / 95 | 176 / 93 / 83 | 203 / 118 / 91 |
| 211 | 1267-1272 | 280 / 134 / 108 | 232 / 118 / 114 | 251 / 153 / 98 | 211 / 118 / 99 | 254 / 146 / 108 | 258 / 156 / 107 |
| 212 | 1273-1278 | 209 / 109 / 103 | 210 / 111 / 118 | 200 / 96 / 104 | 195 / 88 / 111 | 233 / 112 / 121 | 180 / 91 / 94 |
| 213 | 1279-1284 | 256 / 127 / 111 | 201 / 96 / 105 | 202 / 101 / 103 | 230 / 126 / 104 | 201 / 99 / 102 | 229 / 109 / 101 |
| 214 | 1285-1290 | 168 / 87 / 81 | 197 / 98 / 99 | 180 / 91 / 91 | 170 / 91 / 92 | 234 / 139 / 95 | 167 / 79 / 92 |
| 215 | 1291-1296 | 203 / 119 / 99 | 165 / 80 / 85 | 165 / 79 / 86 | 186 / 93 / 93 | 163 / 80 / 90 | 185 / 97 / 93 |
| 216 | 1297-1302 | 169 / 78 / 96 | 166 / 86 / 86 | 157 / 82 / 80 | 169 / 85 / 92 | 174 / 92 / 83 | 173 / 93 / 86 |
| 217 | 1303-1308 | 200 / 105 / 96 | 159 / 74 / 92 | 200 / 102 / 98 | 193 / 101 / 92 | 188 / 104 / 85 | 187 / 93 / 92 |
| 218 | 1309-1314 | 169 / 88 / 92 | 172 / 91 / 87 | 162 / 78 / 88 | 197 / 113 / 88 | 171 / 84 / 94 | 204 / 114 / 90 |
| 219 | 1315-1320 | 150 / 69 / 82 | 182 / 97 / 94 | 167 / 80 / 94 | 158 / 68 / 95 | 168 / 78 / 94 | 179 / 86 / 93 |
| 220 | 1321-1326 | 186 / 95 / 95 | 186 / 99 / 91 | 145 / 65 / 82 | 182 / 90 / 98 | 185 / 98 / 87 | 192 / 108 / 84 |
| 221 | 1327-1332 | 165 / 87 / 83 | 198 / 108 / 93 | 175 / 94 / 81 | 157 / 70 / 87 | 172 / 85 / 83 | 152 / 68 / 84 |
| 222 | 1333-1338 | 208 / 109 / 99 | 177 / 85 / 91 | 166 / 78 / 91 | 183 / 98 / 103 | 181 / 89 / 92 | 184 / 92 / 92 |
| 223 | 1339-1344 | 171 / 88 / 89 | 168 / 83 / 89 | 167 / 78 / 92 | 168 / 76 / 92 | 195 / 102 / 97 | 172 / 87 / 85 |
| 224 | 1345-1350 | 182 / 93 / 90 | 174 / 95 / 91 | 178 / 97 / 86 | 173 / 87 / 91 | 156 / 80 / 87 | 178 / 91 / 96 |
| 225 | 1351-1356 | 177 / 83 / 98 | 174 / 83 / 91 | 167 / 72 / 95 | 182 / 96 / 89 | 164 / 77 / 95 | 178 / 82 / 96 |
| 226 | 1357-1362 | 175 / 84 / 91 | 170 / 79 / 91 | 167 / 80 / 87 | 165 / 80 / 85 | 182 / 96 / 91 | 178 / 87 / 91 |
| 227 | 1363-1368 | 191 / 97 / 94 | 191 / 97 / 94 | 189 / 92 / 93 | 180 / 91 / 96 | 175 / 81 / 94 | 176 / 93 / 99 |
| 228 | 1369-1374 | 173 / 80 / 93 | 181 / 92 / 93 | 170 / 75 / 95 | 179 / 81 / 98 | 190 / 102 / 88 | 163 / 76 / 87 |
| 229 | 1375-1380 | 178 / 93 / 85 | 152 / 74 / 79 | 164 / 75 / 89 | 180 / 103 / 87 | 182 / 97 / 87 | 173 / 86 / 89 |
| 230 | 1381-1386 | 207 / 94 / 94 | 184 / 94 / 88 | 171 / 85 / 90 | 190 / 99 / 91 | 177 / 86 / 91 | 159 / 76 / 92 |
| 231 | 1387-1392 | 190 / 89 / 101 | 167 / 85 / 85 | 177 / 84 / 93 | 168 / 84 / 84 | 181 / 93 / 88 | 193 / 95 / 98 |
| 232 | 1393-1398 | 172 / 86 / 86 | 207 / 116 / 91 | 207 / 113 / 91 | 209 / 116 / 93 | 170 / 86 / 84 | 204 / 108 / 96 |
| 233 | 1399-1404 | 150 / 64 / 92 | 168 / 81 / 95 | 184 / 89 / 95 | 180 / 92 / 95 | 167 / 80 / 87 | 236 / 127 / 98 |
| 234 | 1405-1410 | 164 / 86 / 87 | 235 / 133 / 102 | 187 / 95 / 92 | 188 / 85 / 105 | 201 / 105 / 96 | 180 / 87 / 97 |
| 235 | 1411-1416 | 225 / 116 / 102 | 273 / 132 / 112 | 217 / 111 / 106 | 240 / 132 / 108 | 220 / 118 / 102 | 227 / 125 / 111 |
| 236 | 1417-1422 | 180 / 87 / 93 | 228 / 122 / 106 | 196 / 99 / 97 | 179 / 90 / 91 | 258 / 152 / 106 | 185 / 87 / 98 |
| 237 | 1423-1428 | 186 / 101 / 88 | 233 / 129 / 104 | 222 / 114 / 108 | 196 / 102 / 96 | 281 / 172 / 109 | 239 / 140 / 99 |
| 238 | 1429-1434 | 217 / 110 / 107 | 217 / 108 / 109 | 232 / 115 / 117 | 204 / 106 / 102 | 202 / 101 / 107 | 196 / 108 / 103 |
| 239 | 1435-1440 | 236 / 133 / 103 | 231 / 115 / 104 | 221 / 82 / 100 | 283 / 180 / 103 | 206 / 111 / 97 | 240 / 118 / 101 |
| 240 | 1441-1446 | 157 / 79 / 84 | 187 / 94 / 93 | 171 / 89 / 82 | 215 / 110 / 98 | 205 / 106 / 99 | 186 / 98 / 90 |
| 241 | 1447-1452 | 243 / 121 / 107 | 172 / 82 / 90 | 215 / 94 / 95 | 188 / 95 / 93 | 174 / 88 / 90 | 190 / 92 / 98 |
| 242 | 1453-1458 | 189 / 98 / 91 | 155 / 73 / 86 | 167 / 83 / 91 | 196 / 99 / 97 | 149 / 66 / 87 | 182 / 91 / 91 |
| 243 | 1459-1464 | 214 / 97 / 99 | 151 / 74 / 84 | 179 / 85 / 95 | 198 / 111 / 94 | 171 / 78 / 93 | 177 / 90 / 87 |
| 244 | 1465-1470 | 178 / 83 / 88 | 160 / 77 / 83 | 175 / 88 / 87 | 183 / 98 / 85 | 168 / 83 / 91 | 167 / 83 / 87 |
| 245 | 1471-1476 | 171 / 90 / 86 | 170 / 86 / 102 | 154 / 70 / 94 | 169 / 89 / 84 | 169 / 85 / 94 | 194 / 99 / 95 |
| 246 | 1477-1482 | 186 / 104 / 95 | 186 / 104 / 88 | 174 / 89 / 91 | 177 / 90 / 87 | 175 / 85 / 90 | 168 / 76 / 92 |
| 247 | 1483-1488 | 178 / 84 / 94 | 187 / 95 / 94 | 189 / 95 / 95 | 194 / 104 / 94 | 179 / 92 / 91 | 202 / 111 / 91 |
| 248 | 1489-1494 | 207 / 110 / 98 | 198 / 99 / 99 | 214 / 93 / 112 | 266 / 126 / 110 | 238 / 123 / 104 | 211 / 100 / 103 |
| 249 | 1495-1500 | 240 / 123 / 117 | 249 / 146 / 103 | 220 / 116 / 104 | 268 / 159 / 106 | 179 / 86 / 93 | 182 / 98 / 96 |
| 250 | 1501-1506 | 181 / 98 / 107 | 227 / 121 / 106 | 251 / 148 / 103 | 254 / 137 / 115 | 196 / 104 / 95 | 201 / 105 / 96 |
| 251 | 1507-1512 | 159 / 78 / 91 | 172 / 88 / 86 | 148 / 63 / 90 | 192 / 100 / 93 | 205 / 112 / 93 | 171 / 80 / 91 |
| 252 | 1513-1518 | 184 / 100 / 91 | 160 / 63 / 97 | 187 / 100 / 94 | 219 / 122 / 97 | 163 / 76 / 90 | 209 / 110 / 99 |
| 253 | 1519-1524 | 212 / 108 / 104 | 215 / 114 / 102 | 188 / 91 / 100 | 267 / 151 / 116 | 209 / 107 / 102 | 206 / 104 / 107 |
| 254 | 1525-1530 | 231 / 132 / 100 | 224 / 117 / 107 | 257 / 138 / 119 | 242 / 139 / 107 | 217 / 115 / 102 | 282 / 163 / 119 |
| 255 | 1531-1536 | 204 / 105 / 99 | 215 / 115 / 100 | 206 / 104 / 102 | 254 / 155 / 99 | 243 / 140 / 99 | 216 / 115 / 101 |
| 256 | 1537-1542 | 179 / 87 / 100 | 162 / 85 / 90 | 188 / 101 / 96 | 181 / 90 / 91 | 176 / 95 / 86 | 162 / 76 / 95 |
| 257 | 1543-1548 | 183 / 91 / 94 | 155 / 71 / 84 | 157 / 72 / 85 | 184 / 89 / 95 | 182 / 92 / 90 | 179 / 91 / 88 |
| 258 | 1549-1554 | 157 / 70 / 90 | 170 / 80 / 87 | 156 / 67 / 90 | 202 / 114 / 95 | 213 / 125 / 92 | 186 / 96 / 90 |
| 259 | 1555-1560 | 172 / 76 / 96 | 182 / 94 / 88 | 207 / 113 / 94 | 191 / 113 / 92 | 171 / 89 / 89 | 181 / 92 / 89 |
| 260 | 1561-1566 | 187 / 105 / 84 | 150 / 71 / 79 | 185 / 100 / 85 | 175 / 87 / 88 | 184 / 98 / 91 | 174 / 91 / 91 |
| 261 | 1567-1572 | 165 / 79 / 86 | 175 / 82 / 93 | 177 / 84 / 93 | 155 / 70 / 85 | 188 / 97 / 93 | 187 / 98 / 89 |
| 262 | 1573-1578 | 208 / 111 / 97 | 176 / 88 / 88 | 190 / 99 / 91 | 189 / 90 / 99 | 188 / 101 / 87 | 195 / 102 / 93 |
| 263 | 1579-1584 | 162 / 80 / 86 | 178 / 84 / 94 | 199 / 115 / 89 | 181 / 90 / 94 | 166 / 83 / 87 | 183 / 92 / 94 |
| 264 | 1585-1590 | 159 / 79 / 84 | 183 / 95 / 97 | 181 / 94 / 98 | 182 / 97 / 88 | 183 / 99 / 90 | 174 / 92 / 98 |
| 265 | 1591-1596 | 154 / 69 / 85 | 161 / 76 / 89 | 171 / 88 / 84 | 196 / 112 / 88 | 196 / 97 / 99 | 176 / 94 / 82 |
| 266 | 1597-1602 | 194 / 103 / 91 | 197 / 96 / 86 | 182 / 89 / 93 | 204 / 106 / 98 | 215 / 106 / 98 | 168 / 81 / 92 |
| 267 | 1603-1608 | 195 / 99 / 96 | 157 / 77 / 85 | 195 / 104 / 91 | 186 / 96 / 90 | 174 / 87 / 87 | 198 / 103 / 95 |
| 268 | 1609-1614 | 156 / 69 / 90 | 197 / 112 / 90 | 174 / 85 / 89 | 193 / 100 / 99 | 169 / 95 / 89 | 168 / 85 / 89 |
| 269 | 1615-1620 | 165 / 79 / 86 | 201 / 101 / 100 | 164 / 78 / 89 | 181 / 92 / 89 | 183 / 99 / 89 | 200 / 91 / 93 |
| 270 | 1621-1626 | 151 / 63 / 88 | 169 / 84 / 86 | 176 / 86 / 90 | 168 / 85 / 91 | 175 / 89 / 88 | 218 / 129 / 93 |
| 271 | 1627-1632 | 188 / 98 / 101 | 153 / 74 / 88 | 161 / 80 / 87 | 192 / 95 / 97 | 161 / 76 / 86 | 173 / 89 / 91 |
| 272 | 1633-1638 | 172 / 91 / 88 | 154 / 67 / 91 | 165 / 87 / 88 | 194 / 98 / 96 | 181 / 93 / 88 | 168 / 87 / 91 |
| 273 | 1639-1644 | 156 / 77 / 88 | 189 / 102 / 87 | 155 / 76 / 91 | 192 / 96 / 96 | 198 / 105 / 93 | 177 / 92 / 96 |
| 274 | 1645-1650 | 192 / 103 / 92 | 170 / 86 / 84 | 166 / 82 / 90 | 221 / 123 / 98 | 168 / 85 / 85 | 193 / 95 / 98 |
| 275 | 1651-1656 | 163 / 80 / 83 | 177 / 90 / 94 | 183 / 96 / 87 | 177 / 94 / 89 | 170 / 77 / 97 | 173 / 87 / 90 |
| 276 | 1657-1662 | 164 / 76 / 88 | 194 / 105 / 91 | 180 / 89 / 91 | 189 / 100 / 94 | 165 / 70 / 95 | 157 / 76 / 90 |
| 277 | 1663-1668 | 184 / 96 / 88 | 168 / 84 / 85 | 182 / 95 / 88 | 216 / 120 / 96 | 178 / 102 / 81 | 188 / 96 / 92 |
| 278 | 1669-1674 | 275 / 165 / 110 | 270 / 162 / 108 | 193 / 95 / 98 | 264 / 155 / 109 | 246 / 137 / 109 | 245 / 137 / 108 |
| 279 | 1675-1680 | 170 / 85 / 90 | 140 / 59 / 91 | 172 / 84 / 88 | 198 / 109 / 89 | 189 / 88 / 101 | 179 / 82 / 97 |
| 280 | 1681-1686 | 182 / 95 / 87 | 185 / 100 / 90 | 215 / 100 / 98 | 165 / 79 / 87 | 181 / 88 / 93 | 192 / 98 / 94 |
| 281 | 1687-1692 | 227 / 122 / 105 | 219 / 120 / 99 | 195 / 96 / 99 | 239 / 132 / 107 | 186 / 99 / 89 | 182 / 95 / 89 |
| 282 | 1693-1698 | 186 / 91 / 102 | 185 / 108 / 90 | 166 / 85 / 88 | 189 / 97 / 92 | 217 / 118 / 99 | 255 / 121 / 104 |
| 283 | 1699-1704 | 198 / 91 / 92 | 161 / 77 / 90 | 212 / 101 / 99 | 218 / 119 / 99 | 161 / 75 / 91 | 204 / 96 / 113 |
| 284 | 1705-1710 | 158 / 83 / 89 | 177 / 90 / 87 | 164 / 75 / 89 | 209 / 118 / 91 | 174 / 90 / 89 | 176 / 89 / 87 |
| 285 | 1711-1716 | 160 / 70 / 94 | 176 / 84 / 92 | 221 / 121 / 100 | 198 / 109 / 100 | 180 / 86 / 94 | 165 / 79 / 86 |
| 286 | 1717-1722 | 165 / 78 / 87 | 193 / 103 / 90 | 183 / 85 / 98 | 187 / 89 / 91 | 206 / 117 / 89 | 186 / 100 / 93 |
| 287 | 1723-1728 | 196 / 96 / 100 | 203 / 116 / 89 | 169 / 81 / 86 | 181 / 101 / 85 | 173 / 87 / 88 | 199 / 101 / 98 |
| 288 | 1729-1734 | 170 / 79 / 91 | 181 / 91 / 87 | 169 / 84 / 94 | 192 / 105 / 87 | 161 / 73 / 88 | 197 / 99 / 98 |
| 289 | 1735-1740 | 169 / 85 / 84 | 160 / 79 / 93 | 190 / 99 / 91 | 175 / 92 / 92 | 203 / 105 / 98 | 184 / 87 / 99 |
| 290 | 1741-1746 | 177 / 90 / 88 | 170 / 89 / 88 | 176 / 86 / 88 | 187 / 101 / 88 | 171 / 91 / 83 | 185 / 97 / 88 |
| 291 | 1747-1752 | 175 / 87 / 88 | 177 / 94 / 88 | 187 / 100 / 91 | 181 / 89 / 100 | 180 / 92 / 92 | 178 / 92 / 86 |
| 292 | 1753-1758 | 199 / 104 / 95 | 256 / 135 / 93 | 199 / 104 / 96 | 240 / 133 / 107 | 242 / 138 / 104 | 227 / 118 / 110 |
| 293 | 1759-1764 | 223 / 126 / 98 | 215 / 117 / 98 | 209 / 110 / 99 | 230 / 125 / 105 | 197 / 111 / 98 | 225 / 125 / 100 |
| 294 | 1765-1770 | 166 / 78 / 88 | 170 / 86 / 91 | 157 / 71 / 87 | 155 / 72 / 84 | 181 / 91 / 90 | 182 / 97 / 88 |
| 295 | 1771-1776 | 214 / 115 / 97 | 265 / 132 / 118 | 277 / 168 / 109 | 200 / 102 / 98 | 231 / 118 / 109 | 241 / 120 / 106 |
| 296 | 1777-1782 | 231 / 130 / 101 | 210 / 108 / 102 | 250 / 129 / 121 | 239 / 136 / 109 | 257 / 156 / 113 | 279 / 166 / 113 |
| 297 | 1783-1788 | 196 / 90 / 106 | 194 / 95 / 99 | 244 / 131 / 113 | 212 / 99 / 113 | 186 / 97 / 93 | 195 / 99 / 96 |
| 298 | 1789-1794 | 181 / 92 / 93 | 160 / 77 / 83 | 213 / 101 / 112 | 207 / 99 / 90 | 195 / 104 / 91 | 192 / 98 / 107 |
| 299 | 1795-1800 | 201 / 110 / 91 | 168 / 80 / 90 | 153 / 73 / 84 | 206 / 110 / 97 | 183 / 96 / 90 | 190 / 104 / 93 |
| 300 | 1801-1806 | 150 / 65 / 85 | 191 / 102 / 89 | 206 / 109 / 97 | 189 / 105 / 86 | 191 / 106 / 89 | 210 / 124 / 87 |
| 301 | 1807-1812 | 169 / 79 / 92 | 186 / 102 / 89 | 193 / 99 / 94 | 177 / 91 / 96 | 187 / 98 / 93 | 170 / 86 / 87 |
| 302 | 1813-1818 | 173 / 83 / 100 | 150 / 64 / 86 | 184 / 96 / 88 | 199 / 113 / 90 | 172 / 88 / 89 | 178 / 83 / 97 |
| 303 | 1819-1824 | 180 / 91 / 83 | 180 / 97 / 86 | 168 / 80 / 88 | 167 / 84 / 87 | 174 / 88 / 88 | 171 / 93 / 90 |
| 304 | 1825-1830 | 192 / 102 / 90 | 158 / 74 / 96 | 159 / 75 / 91 | 199 / 109 / 90 | 190 / 107 / 90 | 178 / 96 / 90 |
| 305 | 1831-1836 | 165 / 69 / 97 | 156 / 80 / 91 | 169 / 85 / 93 | 198 / 98 / 100 | 233 / 116 / 98 | 172 / 84 / 94 |
| 306 | 1837-1842 | 218 / 122 / 96 | 218 / 122 / 96 | 190 / 95 / 95 | 202 / 110 / 92 | 186 / 90 / 96 | 175 / 96 / 85 |
| 307 | 1843-1848 | 168 / 84 / 86 | 163 / 72 / 92 | 159 / 72 / 87 | 191 / 90 / 101 | 176 / 91 / 92 | 204 / 99 / 94 |
| 308 | 1849-1854 | 161 / 74 / 88 | 148 / 71 / 84 | 174 / 95 / 86 | 180 / 101 / 84 | 153 / 70 / 83 | 206 / 115 / 92 |
| 309 | 1855-1860 | 152 / 71 / 92 | 187 / 99 / 96 | 164 / 78 / 90 | 169 / 77 / 92 | 213 / 119 / 88 | 175 / 86 / 89 |
| 310 | 1861-1866 | 159 / 77 / 92 | 173 / 83 / 92 | 178 / 85 / 93 | 187 / 108 / 89 | 161 / 80 / 90 | 172 / 82 / 91 |
| 311 | 1867-1872 | 167 / 77 / 90 | 185 / 81 / 98 | 163 / 75 / 94 | 210 / 114 / 96 | 224 / 124 / 93 | 190 / 99 / 91 |
| 312 | 1873-1878 | 224 / 121 / 94 | 161 / 80 / 87 | 174 / 93 / 88 | 176 / 85 / 93 | 168 / 89 / 87 | 179 / 92 / 98 |
| 313 | 1879-1884 | 178 / 85 / 86 | 182 / 100 / 85 | 182 / 100 / 88 | 170 / 93 / 83 | 224 / 128 / 96 | 203 / 110 / 93 |
| 314 | 1885-1890 | 167 / 85 / 88 | 209 / 115 / 94 | 176 / 88 / 89 | 179 / 86 / 93 | 197 / 106 / 91 | 185 / 103 / 86 |
| 315 | 1891-1896 | 181 / 95 / 93 | 168 / 82 / 92 | 178 / 96 / 88 | 219 / 109 / 110 | 210 / 116 / 94 | 192 / 106 / 85 |
| 316 | 1897-1902 | 178 / 88 / 90 | 176 / 92 / 84 | 181 / 94 / 90 | 217 / 122 / 95 | 188 / 110 / 85 | 179 / 85 / 94 |
| 317 | 1903-1908 | 134 / 50 / 84 | 191 / 95 / 96 | 161 / 73 / 93 | 178 / 88 / 90 | 170 / 78 / 93 | 178 / 84 / 97 |
| 318 | 1909-1914 | 164 / 83 / 90 | 177 / 92 / 89 | 180 / 99 / 87 | 169 / 84 / 90 | 188 / 96 / 92 | 188 / 102 / 86 |
| 319 | 1915-1920 | 172 / 76 / 84 | 181 / 88 / 89 | 186 / 91 / 95 | 223 / 125 / 98 | 168 / 81 / 95 | 201 / 114 / 87 |
| 320 | 1921-1926 | 232 / 114 / 118 | 223 / 120 / 105 | 241 / 134 / 119 | 281 / 172 / 109 | 223 / 129 / 107 | 244 / 132 / 112 |
| 321 | 1927-1932 | 221 / 110 / 108 | 214 / 112 / 102 | 201 / 97 / 104 | 228 / 117 / 107 | 241 / 136 / 105 | 222 / 113 / 112 |
| 322 | 1933-1938 | 241 / 120 / 112 | 251 / 141 / 112 | 220 / 120 / 103 | 235 / 117 / 114 | 264 / 141 / 119 | 232 / 128 / 105 |
| 323 | 1939-1944 | 240 / 130 / 110 | 245 / 140 / 116 | 269 / 142 / 119 | 217 / 110 / 107 | 265 / 163 / 115 | 268 / 154 / 116 |
| 324 | 1945-1950 | 248 / 125 / 100 | 230 / 110 / 119 | 198 / 78 / 106 | 210 / 114 / 97 | 196 / 79 / 117 | 193 / 102 / 94 |
| 325 | 1951-1956 | 236 / 109 / 118 | 212 / 83 / 111 | 187 / 91 / 96 | 263 / 148 / 109 | 203 / 113 / 100 | 245 / 120 / 115 |
| 326 | 1957-1962 | 200 / 101 / 99 | 245 / 138 / 107 | 224 / 110 / 114 | 192 / 105 / 96 | 203 / 104 / 99 | 226 / 123 / 103 |
| 327 | 1963-1968 | 188 / 97 / 102 | 189 / 94 / 95 | 189 / 105 / 92 | 213 / 105 / 111 | 215 / 113 / 89 | 200 / 104 / 99 |
| 328 | 1969-1974 | 155 / 74 / 89 | 170 / 77 / 93 | 158 / 80 / 79 | 182 / 97 / 93 | 201 / 96 / 105 | 173 / 90 / 83 |
| 329 | 1975-1980 | 163 / 85 / 85 | 185 / 98 / 87 | 208 / 112 / 94 | 172 / 85 / 88 | 179 / 91 / 88 | 200 / 99 / 94 |
| 330 | 1981-1986 | 173 / 81 / 92 | 202 / 108 / 94 | 202 / 108 / 94 | 203 / 105 / 98 | 188 / 102 / 93 | 199 / 105 / 94 |
| 331 | 1987-1992 | 175 / 93 / 88 | 166 / 78 / 88 | 201 / 108 / 93 | 173 / 89 / 87 | 159 / 75 / 84 | 178 / 92 / 90 |
| 332 | 1993-1998 | 196 / 96 / 100 | 144 / 63 / 81 | 153 / 67 / 87 | 190 / 103 / 87 | 163 / 88 / 85 | 168 / 88 / 86 |
| 333 | 1999-2004 | 188 / 86 / 94 | 179 / 88 / 91 | 179 / 88 / 91 | 208 / 123 / 85 | 222 / 133 / 90 | 200 / 111 / 90 |
| 334 | 2005-2010 | 192 / 90 / 95 | 196 / 111 / 92 | 202 / 111 / 89 | 182 / 89 / 96 | 195 / 95 / 100 | 218 / 120 / 97 |
| 335 | 2011-2016 | 180 / 95 / 97 | 173 / 81 / 92 | 206 / 100 / 95 | 209 / 108 / 101 | 265 / 119 / 94 | 203 / 106 / 98 |
| 336 | 2017-2022 | 195 / 84 / 100 | 215 / 115 / 100 | 199 / 103 / 103 | 254 / 138 / 116 | 254 / 116 / 113 | 257 / 153 / 104 |
| 337 | 2023-2028 | 229 / 122 / 107 | 242 / 113 / 129 | 237 / 103 / 105 | 252 / 117 / 116 | 231 / 108 / 123 | 242 / 115 / 104 |
| 338 | 2029-2034 | 190 / 94 / 98 | 200 / 111 / 93 | 210 / 97 / 113 | 192 / 100 / 94 | 218 / 126 / 95 | 187 / 94 / 100 |
| 339 | 2035-2040 | 248 / 115 / 110 | 242 / 128 / 114 | 242 / 141 / 101 | 258 / 113 / 118 | 286 / 173 / 113 | 224 / 127 / 98 |
| 340 | 2041-2046 | 261 / 150 / 111 | 206 / 91 / 115 | 260 / 122 / 111 | 266 / 159 / 107 | 267 / 134 / 127 | 254 / 144 / 110 |
| 341 | 2047-2052 | 240 / 126 / 114 | 178 / 87 / 91 | 206 / 110 / 96 | 245 / 130 / 115 | 200 / 112 / 88 | 174 / 91 / 87 |
| 342 | 2053-2058 | 156 / 77 / 92 | 162 / 70 / 96 | 185 / 94 / 97 | 167 / 82 / 100 | 162 / 80 / 91 | 171 / 89 / 87 |
| 343 | 2059-2064 | 175 / 86 / 89 | 165 / 88 / 86 | 185 / 87 / 98 | 206 / 116 / 90 | 190 / 100 / 91 | 189 / 99 / 95 |
| 344 | 2065-2070 | 153 / 72 / 91 | 178 / 88 / 95 | 161 / 75 / 91 | 178 / 91 / 89 | 179 / 93 / 87 | 191 / 96 / 95 |
| 345 | 2071-2076 | 200 / 98 / 102 | 162 / 79 / 91 | 191 / 99 / 92 | 165 / 72 / 93 | 180 / 105 / 91 | 187 / 96 / 91 |
| 346 | 2077-2082 | 191 / 101 / 90 | 142 / 55 / 87 | 165 / 84 / 87 | 180 / 98 / 85 | 172 / 86 / 88 | 175 / 85 / 93 |
| 347 | 2083-2088 | 171 / 88 / 88 | 166 / 82 / 84 | 171 / 83 / 88 | 197 / 106 / 91 | 171 / 87 / 84 | 205 / 108 / 97 |
| 348 | 2089-2094 | 167 / 72 / 95 | 185 / 105 / 88 | 155 / 72 / 84 | 187 / 97 / 90 | 189 / 99 / 90 | 180 / 101 / 92 |
| 349 | 2095-2100 | 178 / 79 / 93 | 184 / 91 / 94 | 154 / 62 / 94 | 167 / 79 / 89 | 203 / 109 / 94 | 177 / 93 / 95 |
| 350 | 2101-2106 | 185 / 86 / 99 | 210 / 118 / 95 | 175 / 84 / 93 | 188 / 107 / 91 | 179 / 86 / 98 | 181 / 89 / 93 |
| 351 | 2107-2112 | 166 / 82 / 88 | 171 / 82 / 87 | 176 / 84 / 92 | 196 / 108 / 93 | 213 / 121 / 94 | 168 / 82 / 86 |
| 352 | 2113-2118 | 187 / 107 / 87 | 171 / 85 / 86 | 208 / 113 / 100 | 186 / 102 / 92 | 177 / 89 / 88 | 184 / 95 / 93 |
| 353 | 2119-2124 | 184 / 86 / 98 | 151 / 72 / 86 | 167 / 88 / 87 | 225 / 111 / 93 | 170 / 87 / 89 | 197 / 120 / 88 |
| 354 | 2125-2130 | 181 / 90 / 91 | 179 / 86 / 93 | 170 / 86 / 92 | 207 / 117 / 92 | 184 / 94 / 90 | 183 / 93 / 90 |
| 355 | 2131-2136 | 199 / 112 / 94 | 199 / 112 / 88 | 156 / 74 / 85 | 180 / 104 / 85 | 175 / 82 / 93 | 187 / 90 / 97 |
| 356 | 2137-2142 | 171 / 87 / 99 | 165 / 77 / 90 | 162 / 82 / 90 | 189 / 105 / 91 | 188 / 96 / 92 | 175 / 89 / 94 |
| 357 | 2143-2148 | 195 / 108 / 87 | 173 / 85 / 88 | 184 / 94 / 90 | 207 / 119 / 92 | 186 / 96 / 90 | 188 / 103 / 86 |
| 358 | 2149-2154 | 164 / 80 / 91 | 171 / 92 / 87 | 170 / 86 / 87 | 205 / 108 / 97 | 182 / 94 / 92 | 172 / 87 / 91 |
| 359 | 2155-2160 | 150 / 71 / 81 | 167 / 83 / 86 | 167 / 81 / 86 | 147 / 68 / 88 | 194 / 105 / 89 | 171 / 89 / 82 |
| 360 | 2161-2166 | 164 / 80 / 84 | 194 / 83 / 91 | 157 / 76 / 81 | 195 / 112 / 83 | 180 / 98 / 93 | 170 / 90 / 84 |
| 361 | 2167-2172 | 197 / 109 / 91 | 169 / 74 / 96 | 174 / 89 / 86 | 212 / 123 / 94 | 190 / 101 / 89 | 199 / 104 / 88 |
| 362 | 2173-2178 | 230 / 126 / 104 | 218 / 115 / 103 | 181 / 84 / 97 | 248 / 125 / 106 | 205 / 122 / 98 | 200 / 119 / 87 |
| 363 | 2179-2184 | 231 / 123 / 111 | 247 / 143 / 102 | 209 / 110 / 99 | 227 / 119 / 108 | 240 / 127 / 114 | 232 / 127 / 111 |
| 364 | 2185-2190 | 186 / 91 / 99 | 204 / 109 / 95 | 215 / 113 / 102 | 210 / 116 / 98 | 241 / 136 / 105 | 275 / 165 / 110 |
| 365 | 2191-2196 | 211 / 101 / 110 | 177 / 84 / 93 | 249 / 141 / 108 | 227 / 129 / 98 | 195 / 102 / 103 | 237 / 128 / 109 |
| 366 | 2197-2202 | 217 / 115 / 102 | 224 / 121 / 103 | 226 / 124 / 112 | 199 / 107 / 95 | 183 / 95 / 100 | 241 / 129 / 115 |
| 367 | 2203-2208 | 245 / 119 / 117 | 213 / 106 / 107 | 249 / 135 / 114 | 225 / 116 / 109 | 210 / 104 / 106 | 236 / 120 / 110 |
| 368 | 2209-2214 | 161 / 71 / 96 | 168 / 84 / 96 | 191 / 102 / 96 | 195 / 98 / 97 | 196 / 98 / 98 | 186 / 96 / 92 |
| 369 | 2215-2220 | 168 / 88 / 94 | 186 / 101 / 90 | 195 / 107 / 88 | 181 / 97 / 85 | 221 / 123 / 98 | 178 / 93 / 91 |
| 370 | 2221-2226 | 176 / 91 / 90 | 194 / 109 / 86 | 174 / 77 / 92 | 198 / 105 / 95 | 210 / 115 / 95 | 226 / 113 / 102 |
| 371 | 2227-2232 | 170 / 82 / 97 | 189 / 99 / 89 | 189 / 100 / 93 | 202 / 126 / 98 | 160 / 74 / 96 | 190 / 99 / 97 |
| 372 | 2233-2238 | 160 / 74 / 90 | 199 / 109 / 86 | 174 / 85 / 89 | 215 / 119 / 96 | 179 / 90 / 94 | 172 / 92 / 84 |
| 373 | 2239-2244 | 181 / 88 / 93 | 226 / 130 / 96 | 169 / 84 / 86 | 195 / 111 / 96 | 201 / 114 / 99 | 194 / 107 / 87 |
| 374 | 2245-2250 | 176 / 86 / 90 | 165 / 79 / 91 | 176 / 90 / 92 | 202 / 102 / 96 | 206 / 122 / 91 | 192 / 105 / 87 |
| 375 | 2251-2256 | 155 / 76 / 92 | 193 / 93 / 100 | 176 / 85 / 91 | 166 / 80 / 89 | 186 / 103 / 91 | 180 / 93 / 91 |
| 376 | 2257-2262 | 197 / 104 / 93 | 162 / 76 / 94 | 158 / 76 / 82 | 239 / 109 / 96 | 204 / 97 / 107 | 192 / 99 / 95 |
| 377 | 2263-2268 | 153 / 71 / 94 | 183 / 99 / 94 | 219 / 126 / 100 | 192 / 107 / 89 | 209 / 109 / 88 | 199 / 101 / 99 |
| 378 | 2269-2274 | 165 / 74 / 87 | 205 / 115 / 90 | 174 / 88 / 86 | 195 / 99 / 96 | 204 / 118 / 87 | 181 / 92 / 94 |
| 379 | 2275-2280 | 170 / 85 / 93 | 203 / 107 / 96 | 179 / 86 / 93 | 172 / 88 / 89 | 202 / 121 / 92 | 181 / 93 / 93 |
| 380 | 2281-2286 | 185 / 98 / 90 | 183 / 93 / 97 | 177 / 89 / 91 | 197 / 108 / 89 | 205 / 111 / 94 | 178 / 98 / 92 |
| 381 | 2287-2292 | 220 / 118 / 102 | 235 / 138 / 97 | 207 / 97 / 110 | 196 / 105 / 91 | 212 / 112 / 100 | 246 / 132 / 124 |
| 382 | 2293-2298 | 233 / 116 / 117 | 205 / 105 / 100 | 183 / 92 / 91 | 222 / 124 / 103 | 273 / 141 / 106 | 221 / 118 / 103 |
| 383 | 2299-2304 | 154 / 76 / 89 | 167 / 72 / 95 | 163 / 77 / 89 | 167 / 90 / 91 | 194 / 109 / 94 | 227 / 140 / 96 |
| 384 | 2305-2310 | 182 / 86 / 96 | 175 / 85 / 90 | 167 / 78 / 89 | 233 / 148 / 87 | 231 / 118 / 93 | 154 / 73 / 81 |
| 385 | 2311-2316 | 189 / 97 / 87 | 178 / 86 / 100 | 165 / 74 / 91 | 188 / 104 / 87 | 177 / 84 / 93 | 208 / 112 / 96 |
| 386 | 2317-2322 | 164 / 78 / 86 | 155 / 73 / 82 | 150 / 75 / 82 | 234 / 112 / 94 | 250 / 160 / 91 | 184 / 100 / 90 |
| 387 | 2323-2328 | 189 / 100 / 96 | 177 / 88 / 92 | 171 / 89 / 91 | 206 / 117 / 89 | 253 / 140 / 99 | 184 / 101 / 84 |
| 388 | 2329-2334 | 198 / 110 / 94 | 152 / 73 / 82 | 158 / 75 / 84 | 195 / 110 / 98 | 208 / 129 / 88 | 244 / 111 / 87 |
| 389 | 2335-2340 | 160 / 76 / 86 | 173 / 84 / 89 | 183 / 92 / 99 | 205 / 126 / 81 | 165 / 87 / 89 | 204 / 101 / 103 |
| 390 | 2341-2346 | 176 / 91 / 85 | 179 / 95 / 91 | 181 / 99 / 84 | 210 / 123 / 87 | 221 / 124 / 97 | 211 / 95 / 90 |
| 391 | 2347-2352 | 162 / 72 / 90 | 152 / 68 / 91 | 185 / 94 / 91 | 185 / 94 / 95 | 177 / 81 / 96 | 172 / 87 / 88 |
| 392 | 2353-2358 | 156 / 74 / 90 | 161 / 73 / 88 | 158 / 79 / 86 | 173 / 87 / 91 | 212 / 107 / 105 | 217 / 124 / 93 |
| 393 | 2359-2364 | 154 / 64 / 90 | 171 / 78 / 93 | 168 / 83 / 89 | 172 / 84 / 88 | 183 / 96 / 94 | 189 / 101 / 88 |
| 394 | 2365-2370 | 169 / 80 / 89 | 155 / 75 / 88 | 173 / 92 / 93 | 163 / 81 / 84 | 195 / 96 / 99 | 195 / 101 / 99 |
| 395 | 2371-2376 | 181 / 89 / 92 | 172 / 80 / 92 | 169 / 81 / 88 | 218 / 120 / 97 | 169 / 86 / 89 | 196 / 101 / 95 |
| 396 | 2377-2382 | 186 / 97 / 89 | 161 / 67 / 94 | 157 / 78 / 79 | 226 / 138 / 86 | 205 / 116 / 89 | 185 / 97 / 89 |
| 397 | 2383-2388 | 167 / 78 / 92 | 167 / 84 / 88 | 183 / 83 / 92 | 192 / 103 / 93 | 170 / 88 / 83 | 214 / 96 / 94 |
| 398 | 2389-2394 | 175 / 84 / 96 | 189 / 98 / 92 | 169 / 77 / 95 | 170 / 91 / 85 | 191 / 106 / 88 | 174 / 83 / 102 |
| 399 | 2395-2400 | 172 / 91 / 96 | 204 / 107 / 97 | 165 / 83 / 86 | 189 / 111 / 87 | 200 / 110 / 92 | 195 / 106 / 89 |
| 400 | 2401-2406 | 172 / 85 / 87 | 157 / 74 / 83 | 158 / 77 / 83 | 180 / 98 / 90 | 203 / 103 / 100 | 174 / 90 / 86 |
| 401 | 2407-2412 | 170 / 86 / 84 | 192 / 93 / 103 | 190 / 97 / 93 | 174 / 86 / 91 | 217 / 122 / 95 | 186 / 100 / 88 |
| 402 | 2413-2418 | 199 / 97 / 102 | 173 / 81 / 92 | 166 / 85 / 86 | 191 / 104 / 87 | 173 / 91 / 88 | 191 / 99 / 95 |
| 403 | 2419-2424 | 163 / 79 / 90 | 176 / 85 / 91 | 217 / 118 / 99 | 182 / 100 / 90 | 213 / 101 / 113 | 192 / 107 / 93 |
| 404 | 2425-2430 | 177 / 85 / 92 | 152 / 72 / 87 | 180 / 87 / 102 | 196 / 106 / 91 | 183 / 101 / 82 | 182 / 95 / 87 |
| 405 | 2431-2436 | 237 / 138 / 99 | 256 / 153 / 103 | 222 / 128 / 94 | 212 / 116 / 100 | 307 / 181 / 126 | 240 / 138 / 102 |
| 406 | 2437-2442 | 168 / 83 / 95 | 168 / 83 / 96 | 215 / 113 / 102 | 189 / 99 / 97 | 177 / 84 / 97 | 181 / 88 / 93 |
| 407 | 2443-2448 | 220 / 112 / 108 | 220 / 112 / 108 | 220 / 112 / 108 | 284 / 166 / 118 | 277 / 162 / 115 | 240 / 136 / 104 |
| 408 | 2449-2454 | 201 / 109 / 102 | 221 / 128 / 93 | 263 / 136 / 120 | 261 / 142 / 109 | 220 / 120 / 100 | 258 / 151 / 129 |
| 409 | 2455-2460 | 251 / 141 / 110 | 214 / 96 / 111 | 188 / 99 / 103 | 288 / 183 / 105 | 233 / 140 / 94 | 210 / 99 / 111 |
| 410 | 2461-2466 | 216 / 122 / 96 | 222 / 133 / 95 | 222 / 133 / 117 | 184 / 91 / 97 | 182 / 97 / 86 | 215 / 108 / 107 |
| 411 | 2467-2472 | 181 / 90 / 87 | 190 / 102 / 88 | 181 / 90 / 89 | 208 / 110 / 98 | 174 / 85 / 93 | 219 / 109 / 103 |
| 412 | 2473-2478 | 241 / 119 / 104 | 208 / 95 / 110 | 239 / 121 / 118 | 199 / 106 / 93 | 230 / 116 / 114 | 260 / 136 / 124 |
| 413 | 2479-2484 | 181 / 84 / 97 | 167 / 86 / 85 | 175 / 83 / 92 | 214 / 118 / 96 | 169 / 95 / 85 | 192 / 97 / 95 |
| 414 | 2485-2490 | 163 / 82 / 81 | 172 / 87 / 95 | 181 / 90 / 91 | 195 / 101 / 94 | 192 / 98 / 94 | 225 / 122 / 103 |
| 415 | 2491-2496 | 155 / 80 / 86 | 176 / 89 / 94 | 181 / 91 / 97 | 195 / 115 / 87 | 213 / 112 / 101 | 168 / 87 / 81 |
| 416 | 2497-2502 | 155 / 73 / 94 | 162 / 78 / 84 | 166 / 80 / 86 | 202 / 107 / 95 | 180 / 95 / 85 | 167 / 86 / 94 |
| 417 | 2503-2508 | 160 / 79 / 89 | 193 / 105 / 91 | 159 / 79 / 89 | 185 / 98 / 93 | 175 / 93 / 92 | 204 / 118 / 86 |
| 418 | 2509-2514 | 177 / 93 / 91 | 167 / 74 / 93 | 178 / 90 / 92 | 187 / 101 / 91 | 174 / 89 / 85 | 171 / 87 / 99 |
| 419 | 2515-2520 | 162 / 80 / 90 | 210 / 106 / 104 | 244 / 140 / 104 | 211 / 115 / 96 | 247 / 132 / 109 | 237 / 135 / 102 |
| 420 | 2521-2526 | 188 / 104 / 86 | 244 / 134 / 110 | 188 / 104 / 88 | 218 / 111 / 93 | 236 / 139 / 97 | 201 / 113 / 96 |
| 421 | 2527-2532 | 174 / 90 / 92 | 206 / 114 / 93 | 171 / 82 / 94 | 191 / 112 / 98 | 207 / 116 / 91 | 190 / 95 / 100 |
| 422 | 2533-2538 | 193 / 93 / 100 | 193 / 93 / 100 | 188 / 88 / 100 | 212 / 101 / 113 | 185 / 89 / 105 | 257 / 146 / 111 |
| 423 | 2539-2544 | 215 / 114 / 101 | 261 / 131 / 108 | 188 / 98 / 95 | 240 / 131 / 109 | 219 / 116 / 103 | 245 / 123 / 101 |
| 424 | 2545-2550 | 235 / 129 / 106 | 163 / 69 / 94 | 199 / 105 / 107 | 221 / 122 / 107 | 190 / 95 / 95 | 188 / 86 / 107 |
| 425 | 2551-2556 | 255 / 140 / 115 | 203 / 95 / 98 | 209 / 116 / 98 | 236 / 132 / 104 | 213 / 116 / 106 | 200 / 109 / 102 |
| 426 | 2557-2562 | 179 / 96 / 84 | 161 / 86 / 80 | 165 / 81 / 97 | 174 / 89 / 90 | 216 / 130 / 89 | 188 / 101 / 97 |
| 427 | 2563-2568 | 204 / 101 / 90 | 216 / 129 / 87 | 206 / 119 / 87 | 235 / 146 / 88 | 193 / 105 / 88 | 178 / 85 / 93 |
| 428 | 2569-2574 | 204 / 100 / 101 | 181 / 84 / 97 | 191 / 106 / 86 | 220 / 121 / 99 | 163 / 79 / 86 | 187 / 95 / 95 |
| 429 | 2575-2580 | 170 / 85 / 86 | 178 / 97 / 91 | 178 / 88 / 90 | 203 / 114 / 90 | 179 / 99 / 92 | 199 / 105 / 94 |
| 430 | 2581-2586 | 187 / 98 / 92 | 212 / 102 / 99 | 164 / 82 / 86 | 206 / 113 / 93 | 199 / 115 / 89 | 199 / 109 / 91 |
| 431 | 2587-2592 | 166 / 79 / 89 | 179 / 92 / 89 | 149 / 69 / 83 | 197 / 121 / 88 | 218 / 116 / 102 | 202 / 121 / 91 |
| 432 | 2593-2598 | 166 / 75 / 95 | 169 / 88 / 88 | 176 / 87 / 93 | 187 / 95 / 93 | 233 / 142 / 91 | 168 / 78 / 99 |
| 433 | 2599-2604 | 157 / 74 / 88 | 194 / 103 / 91 | 177 / 86 / 94 | 181 / 94 / 91 | 195 / 94 / 101 | 203 / 110 / 93 |
| 434 | 2605-2610 | 178 / 90 / 88 | 157 / 71 / 86 | 183 / 94 / 93 | 182 / 92 / 103 | 248 / 154 / 94 | 179 / 95 / 85 |
| 435 | 2611-2616 | 147 / 65 / 82 | 154 / 74 / 86 | 175 / 79 / 96 | 177 / 100 / 83 | 199 / 117 / 85 | 195 / 104 / 94 |
| 436 | 2617-2622 | 177 / 85 / 100 | 196 / 115 / 88 | 180 / 76 / 85 | 196 / 116 / 95 | 174 / 89 / 93 | 171 / 88 / 85 |
| 437 | 2623-2628 | 156 / 79 / 78 | 199 / 91 / 108 | 174 / 88 / 98 | 179 / 89 / 93 | 197 / 105 / 92 | 180 / 96 / 89 |
| 438 | 2629-2634 | 190 / 87 / 103 | 180 / 93 / 97 | 185 / 92 / 93 | 197 / 108 / 98 | 201 / 105 / 99 | 194 / 113 / 88 |
| 439 | 2635-2640 | 172 / 80 / 96 | 168 / 79 / 89 | 177 / 86 / 91 | 203 / 112 / 94 | 174 / 92 / 82 | 194 / 102 / 92 |
| 440 | 2641-2646 | 173 / 90 / 85 | 167 / 83 / 98 | 167 / 81 / 86 | 210 / 121 / 89 | 217 / 118 / 100 | 200 / 106 / 94 |
| 441 | 2647-2652 | 182 / 99 / 88 | 176 / 79 / 101 | 184 / 96 / 91 | 192 / 100 / 97 | 196 / 99 / 102 | 197 / 106 / 91 |
| 442 | 2653-2658 | 169 / 85 / 103 | 142 / 60 / 82 | 170 / 79 / 92 | 192 / 99 / 93 | 171 / 80 / 91 | 203 / 115 / 96 |
| 443 | 2659-2664 | 188 / 96 / 92 | 188 / 92 / 96 | 168 / 81 / 87 | 205 / 117 / 88 | 206 / 117 / 89 | 207 / 107 / 100 |
| 444 | 2665-2670 | 182 / 98 / 89 | 172 / 85 / 87 | 198 / 102 / 96 | 197 / 114 / 88 | 183 / 94 / 89 | 181 / 102 / 82 |
| 445 | 2671-2676 | 181 / 87 / 94 | 168 / 84 / 96 | 166 / 75 / 91 | 178 / 100 / 91 | 186 / 101 / 92 | 175 / 89 / 89 |
| 446 | 2677-2682 | 176 / 86 / 90 | 182 / 90 / 92 | 176 / 86 / 90 | 191 / 96 / 95 | 211 / 125 / 94 | 185 / 95 / 93 |
| 447 | 2683-2688 | 161 / 79 / 93 | 181 / 92 / 89 | 150 / 72 / 82 | 198 / 105 / 93 | 216 / 127 / 90 | 222 / 134 / 99 |
| 448 | 2689-2694 | 278 / 164 / 114 | 210 / 110 / 102 | 233 / 131 / 103 | 288 / 175 / 112 | 222 / 119 / 103 | 245 / 139 / 106 |
| 449 | 2695-2700 | 202 / 96 / 114 | 220 / 96 / 105 | 220 / 80 / 107 | 241 / 126 / 115 | 224 / 120 / 105 | 261 / 151 / 105 |
| 450 | 2701-2706 | 226 / 128 / 103 | 239 / 114 / 101 | 256 / 144 / 106 | 252 / 152 / 106 | 224 / 124 / 101 | 294 / 174 / 111 |
| 451 | 2707-2712 | 252 / 137 / 115 | 185 / 94 / 91 | 231 / 124 / 107 | 302 / 188 / 114 | 311 / 183 / 113 | 215 / 107 / 108 |
| 452 | 2713-2718 | 188 / 94 / 94 | 173 / 85 / 95 | 169 / 80 / 89 | 223 / 123 / 100 | 209 / 121 / 98 | 218 / 124 / 94 |
| 453 | 2719-2724 | 212 / 104 / 108 | 232 / 113 / 107 | 220 / 108 / 112 | 238 / 126 / 111 | 275 / 166 / 108 | 205 / 110 / 104 |
| 454 | 2725-2730 | 177 / 91 / 88 | 180 / 89 / 91 | 166 / 81 / 92 | 185 / 97 / 88 | 212 / 115 / 97 | 185 / 99 / 86 |
| 455 | 2731-2736 | 163 / 70 / 97 | 238 / 129 / 106 | 236 / 122 / 114 | 303 / 196 / 107 | 239 / 132 / 107 | 215 / 115 / 100 |
| 456 | 2737-2742 | 198 / 100 / 99 | 182 / 95 / 87 | 177 / 82 / 95 | 205 / 123 / 96 | 216 / 125 / 92 | 182 / 84 / 98 |
| 457 | 2743-2748 | 139 / 61 / 78 | 147 / 63 / 88 | 156 / 71 / 85 | 182 / 94 / 89 | 181 / 89 / 98 | 181 / 95 / 86 |
| 458 | 2749-2754 | 165 / 85 / 86 | 179 / 84 / 98 | 165 / 85 / 85 | 207 / 115 / 93 | 189 / 107 / 83 | 175 / 90 / 85 |
| 459 | 2755-2760 | 165 / 78 / 87 | 161 / 82 / 79 | 208 / 115 / 98 | 206 / 112 / 89 | 179 / 97 / 84 | 191 / 105 / 98 |
| 460 | 2761-2766 | 205 / 107 / 98 | 189 / 90 / 99 | 154 / 68 / 89 | 196 / 106 / 90 | 198 / 106 / 92 | 176 / 88 / 88 |
| 461 | 2767-2772 | 168 / 78 / 91 | 173 / 80 / 96 | 188 / 100 / 94 | 214 / 120 / 94 | 200 / 99 / 101 | 188 / 104 / 96 |
| 462 | 2773-2778 | 257 / 145 / 112 | 218 / 113 / 111 | 234 / 115 / 115 | 263 / 147 / 116 | 233 / 133 / 112 | 205 / 104 / 101 |
| 463 | 2779-2784 | 168 / 86 / 86 | 173 / 84 / 89 | 142 / 64 / 86 | 190 / 115 / 88 | 176 / 85 / 92 | 194 / 105 / 89 |
| 464 | 2785-2790 | 253 / 133 / 120 | 213 / 92 / 112 | 231 / 118 / 104 | 272 / 146 / 118 | 239 / 126 / 104 | 245 / 135 / 111 |
| 465 | 2791-2796 | 235 / 115 / 118 | 240 / 128 / 112 | 196 / 88 / 102 | 232 / 122 / 110 | 263 / 152 / 111 | 244 / 128 / 107 |
| 466 | 2797-2802 | 232 / 114 / 94 | 208 / 112 / 100 | 213 / 109 / 104 | 201 / 105 / 96 | 237 / 134 / 106 | 258 / 156 / 104 |
| 467 | 2803-2808 | 252 / 144 / 108 | 204 / 102 / 105 | 220 / 123 / 107 | 288 / 179 / 112 | 216 / 108 / 108 | 263 / 151 / 112 |
| 468 | 2809-2814 | 212 / 107 / 105 | 240 / 111 / 111 | 195 / 94 / 97 | 228 / 125 / 103 | 221 / 121 / 103 | 220 / 120 / 102 |
| 469 | 2815-2820 | 207 / 105 / 102 | 230 / 130 / 100 | 207 / 94 / 103 | 225 / 137 / 99 | 257 / 157 / 101 | 230 / 123 / 107 |
| 470 | 2821-2826 | 178 / 91 / 87 | 164 / 83 / 81 | 202 / 105 / 97 | 181 / 98 / 85 | 185 / 99 / 86 | 184 / 97 / 87 |
| 471 | 2827-2832 | 152 / 65 / 91 | 196 / 102 / 94 | 171 / 83 / 88 | 188 / 99 / 96 | 188 / 104 / 85 | 225 / 138 / 87 |
| 472 | 2833-2838 | 172 / 89 / 83 | 176 / 73 / 103 | 169 / 81 / 91 | 205 / 110 / 95 | 204 / 112 / 92 | 227 / 118 / 101 |
| 473 | 2839-2844 | 217 / 119 / 98 | 183 / 96 / 87 | 183 / 96 / 95 | 207 / 117 / 91 | 182 / 97 / 85 | 215 / 117 / 100 |
| 474 | 2845-2850 | 155 / 72 / 87 | 156 / 79 / 95 | 158 / 76 / 84 | 196 / 102 / 94 | 204 / 115 / 99 | 196 / 115 / 87 |
| 475 | 2851-2856 | 152 / 65 / 91 | 194 / 102 / 92 | 167 / 81 / 86 | 224 / 121 / 103 | 229 / 141 / 90 | 187 / 105 / 89 |
| 476 | 2857-2862 | 183 / 91 / 92 | 178 / 94 / 84 | 152 / 69 / 86 | 206 / 115 / 91 | 223 / 135 / 91 | 200 / 119 / 87 |
| 477 | 2863-2868 | 165 / 77 / 90 | 182 / 100 / 82 | 158 / 76 / 85 | 194 / 98 / 97 | 216 / 123 / 93 | 186 / 99 / 96 |
| 478 | 2869-2874 | 181 / 88 / 93 | 152 / 68 / 87 | 169 / 89 / 89 | 188 / 97 / 96 | 198 / 110 / 88 | 190 / 102 / 93 |
| 479 | 2875-2880 | 173 / 88 / 88 | 195 / 81 / 97 | 157 / 73 / 87 | 207 / 126 / 95 | 173 / 95 / 87 | 206 / 110 / 96 |
| 480 | 2881-2886 | 176 / 86 / 90 | 174 / 90 / 90 | 164 / 82 / 90 | 203 / 110 / 95 | 204 / 119 / 88 | 178 / 93 / 88 |
| 481 | 2887-2892 | 168 / 87 / 84 | 173 / 88 / 91 | 180 / 90 / 93 | 180 / 93 / 89 | 177 / 89 / 88 | 208 / 112 / 96 |
| 482 | 2893-2898 | 177 / 88 / 93 | 153 / 71 / 84 | 179 / 87 / 92 | 183 / 92 / 98 | 166 / 85 / 87 | 184 / 103 / 91 |
| 483 | 2899-2904 | 177 / 89 / 88 | 200 / 112 / 89 | 178 / 86 / 92 | 196 / 116 / 91 | 205 / 108 / 97 | 184 / 98 / 94 |
| 484 | 2905-2910 | 159 / 71 / 89 | 173 / 95 / 91 | 172 / 80 / 92 | 187 / 106 / 93 | 201 / 118 / 104 | 202 / 114 / 96 |
| 485 | 2911-2916 | 166 / 80 / 94 | 153 / 78 / 80 | 151 / 71 / 85 | 215 / 129 / 97 | 197 / 105 / 92 | 202 / 116 / 92 |
| 486 | 2917-2922 | 187 / 91 / 96 | 183 / 96 / 90 | 176 / 76 / 96 | 221 / 129 / 97 | 194 / 107 / 88 | 194 / 104 / 91 |
| 487 | 2923-2928 | 195 / 98 / 97 | 202 / 100 / 94 | 167 / 83 / 88 | 247 / 155 / 92 | 202 / 127 / 83 | 181 / 99 / 85 |
| 488 | 2929-2934 | 173 / 87 / 91 | 187 / 94 / 93 | 168 / 74 / 94 | 217 / 113 / 90 | 254 / 164 / 89 | 170 / 78 / 92 |
| 489 | 2935-2940 | 153 / 64 / 93 | 180 / 94 / 88 | 192 / 101 / 91 | 196 / 110 / 106 | 223 / 134 / 89 | 207 / 109 / 98 |
| 490 | 2941-2946 | 181 / 86 / 98 | 194 / 88 / 101 | 218 / 117 / 101 | 200 / 98 / 102 | 242 / 125 / 106 | 242 / 139 / 103 |
| 491 | 2947-2952 | 215 / 110 / 101 | 232 / 131 / 101 | 266 / 129 / 111 | 238 / 137 / 101 | 247 / 137 / 110 | 258 / 149 / 109 |
| 492 | 2953-2958 | 174 / 73 / 101 | 234 / 133 / 101 | 262 / 143 / 110 | 202 / 96 / 113 | 240 / 137 / 103 | 252 / 132 / 116 |
| 493 | 2959-2964 | 314 / 173 / 136 | 227 / 114 / 113 | 199 / 112 / 93 | 259 / 134 / 125 | 223 / 124 / 99 | 212 / 121 / 101 |
| 494 | 2965-2970 | 241 / 109 / 101 | 194 / 107 / 94 | 201 / 112 / 110 | 228 / 129 / 105 | 248 / 138 / 110 | 235 / 123 / 110 |
| 495 | 2971-2976 | 195 / 84 / 118 | 189 / 97 / 98 | 251 / 139 / 108 | 236 / 125 / 111 | 213 / 114 / 111 | 288 / 163 / 112 |
| 496 | 2977-2982 | 168 / 81 / 93 | 159 / 76 / 94 | 160 / 72 / 96 | 186 / 98 / 88 | 196 / 111 / 86 | 192 / 108 / 91 |
| 497 | 2983-2988 | 216 / 113 / 103 | 157 / 67 / 90 | 167 / 81 / 88 | 220 / 116 / 104 | 184 / 99 / 90 | 197 / 103 / 94 |
| 498 | 2989-2994 | 203 / 99 / 104 | 210 / 112 / 98 | 217 / 117 / 100 | 201 / 108 / 93 | 193 / 105 / 88 | 216 / 113 / 103 |
| 499 | 2995-3000 | 166 / 85 / 82 | 179 / 85 / 94 | 164 / 78 / 87 | 229 / 109 / 97 | 200 / 123 / 81 | 195 / 107 / 88 |

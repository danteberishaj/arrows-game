# RE-CEILING: v2's size ceiling re-measured on the exact RNG

> **Final state: the owner picked option B (2026-09-27), ceiling and floor both 354.** Sections 1-9 below are the
> first round as delivered (ceiling 450 in the tree, floor 335) and stay as the record of the measurement. What
> ships is in "Fix round 1 (owner pick B)" at the end.

- **Base:** `ae35d9e` (V2-FINISH report on top of 627e4d9 / 6674cb8 / ea57e1e), branch `next-level`. HEAD did not move.
- **Status:** DONE_WITH_CONCERNS. The ceiling is re-measured and shipped in `curve.ts`, the floor is re-measured
  (unchanged), every pin is re-pinned on purpose, `tsc` passes and every suite this task touches passes (the full
  `jest` run's only failures are another agent's in-flight contrast suite and a load timeout; see Gates). But the
  brief's own timing check fails by
  construction: the new ceiling's boards are a third bigger, so v2 generation at saturation is about 50% slower than
  before (and than v1). The re-measured plateau is also not the one the owner saw when picking S400. Both go to the
  owner (Owner question).
- **Flag:** `GEN_V2_ENABLED = false` throughout. No player sees any of this. Node only: no emulator, no native build.
- **Another agent** edited `App.tsx`, `src/featureFlags.ts` and `src/ui/*` during the task. I touched none of them.
  Timing and fingerprint arms use HEAD's `src/featureFlags.ts`, not theirs.

Evidence is in `artifacts/RE-CEILING/` (gitignored): probe outputs, `scripts/` (the scratch harnesses), timing data
and the mutation log. The scratch folder it came from was deleted at the end.

## Answer in one table

| | before (HEAD) | after |
|---|---|---|
| `CEILING_BASE_CELLS` (Normal / Hard / Super Hard target at saturation) | 339 / 515 / 609 (legacy-stream measurement) | **450 / 683 / 808** |
| `V1_FLOOR_BASE_CELLS` | 335 | **335** (re-measured; S400 now passes it at displayed level 274, not 394) |
| shapes dealt once saturated | 15 of 26 | **6 of 26**, from level 358 |
| heaviest v2 board, every index 0-9999 (fresh / existing) | 183 / 188 | **232 / 232** (v1's worst: 262) |
| v2 median / p95 per level at saturation, node (v1 in the same processes: 2.453 / 7.589 ms) | 2.346 / 6.461 ms | **3.548 / 10.340 ms** |
| v2 / v1 scan proxy after level 400 (300-level windows from L = 400 / 1000) | 0.90 / 0.88 | **1.25 / 1.29** (fresh), 1.25 / 1.32 (existing) |

## 1. What `--ceiling` computes (EXECUTED, `npm run analysis:probe -- --version 2 --ceiling`)

For each scanned base B, the probe builds a **flat curve**: one row, base B from level 1, v1's tier texture, so the
targets are Normal B, Hard round(B x 126/83) and Super Hard round(B x 149/83). It deals every board through the
shipping `LevelGenerator.generate(i, 2, { curve })`: the exact .NET stream (`ExactDotNetRandom`), v2's bag over that
curve's windows (so exactly the shapes that can hold that Super Hard target), and the W3-09 sizing. It reads back
only `arrowCount`. Per base it records:

1. the largest board, **neutral bias**, over the Hard and Super Hard indices of 0-99,999 every 7th: **4,762 boards**
   (every 7th index cycles through all six tier positions; Normal targets are the smallest, so they are skipped);
2. the largest board, **neutral bias, every index 0-9999, all tiers: 10,000 boards** (new in RE-CEILING: the owner's
   "nothing gets slower" range, where v1's heaviest board is index 7157 with 262 arrows);
3. for information only, (1) again at bias 0.3 (W3-14's unpicked bias-tail candidates).

A base **passes** when (1) and (2) are both at or under `ARROW_CEILING` = 250 arrows (so nothing in 0-9999 exceeds
v1's 262 either) **and** its Super Hard target still admits at least six shapes (see section 2). The scan runs
330-480 every 10, then every 1 between the last passing value and the next; the ceiling is the largest scanned
value with every smaller scanned value passing.

**What it is not:** a flat curve is a proxy for S400's plateau. It has the same targets and the same admitted
shapes, but the bag's windows fall on different indices, so a flat-curve board at index i is not always S400's
board at i. Section 4 therefore checks the shipped curve itself.

**Change against W3-14's rule:**
- W3-14 also required bias 0.3 to pass. Its tail candidates were not picked, and S400 never deals a bias below 1
  (existing players are clamped to at most 1), so that column is now information.
- The every-index 0-9999 check is new. It is the brief's "never exceed v1's heaviest board over 0-9999".

## 2. The scan, and why 450 and not 452

**Boards generated: 488,100** (25 bases x (4,762 + 10,000 + 4,762)); 58 min wall, 54 min CPU. Output:
`artifacts/RE-CEILING/ceiling.txt`. The final probe code re-ran it with identical boards and prints 450 "(matches)"
(`ceiling-final.txt`, see Gates).

| base | Hard | Super Hard | shapes admitted | max, (e) sample, neutral (index, shape) | max, every index 0-9999 (index, shape) | arrows <= 250 | info: b = 0.3 |
|---|---|---|---|---|---|---|---|
| 330 | 501 | 592 | 15 | 177 (34979, Rectangle 20×30) | 178 (7391, Rectangle 20×30) | yes | 190 |
| 340 | 516 | 610 | 14 | 181 (64799, Heart 29×29) | 180 (4793, Square 25×25) | yes | 193 |
| 350 | 531 | 628 | 13 | 185 (47327, Square 25×25) | 184 (5261, Flower 37×37) | yes | 191 |
| 360 | 547 | 646 | 12 | 200 (92561, Rectangle 21×32) | 197 (9479, Rectangle 21×32) | yes | 207 |
| 370 | 562 | 664 | 11 | 201 (41195, Square 26×26) | 208 (2333, Square 26×26) | yes | 210 |
| 380 | 577 | 682 | 10 | 215 (45647, Plus 37×37) | 207 (7217, Plus 37×37) | yes | 207 |
| 390 | 592 | 700 | 8 | 233 (58667, Rectangle 22×33) | 211 (6605, Rectangle 22×33) | yes | 220 |
| 400 | 607 | 718 | 8 | 233 (58667, Rectangle 22×33) | 213 (8027, Square 27×27) | yes | 220 |
| 410 | 622 | 736 | 7 | 214 (27461, Rectangle 22×33) | 217 (5849, Rectangle 22×33) | yes | 222 |
| 420 | 638 | 754 | 6 | 222 (97685, Octagon 34×34) | 217 (4685, Hexagon 36×36) | yes | 228 |
| 430 | 653 | 772 | 6 | 244 (19565, Square 28×28) | 232 (9059, Square 28×28) | yes | 250 |
| 440 | 668 | 790 | 6 | 244 (19565, Square 28×28) | 232 (9059, Square 28×28) | yes | 250 |
| **450** | **683** | **808** | **6** | **244 (19565, Square 28×28)** | **232 (2057, Heart 33×33)** | **yes** | 250 |
| 451 | 685 | 810 | 5 | 244 (19565, Square 28×28) | 239 (2549, Rectangle 23×34) | yes | 241 |
| 452 | 686 | 811 | 5 | 244 (19565, Square 28×28) | 239 (2549, Rectangle 23×34) | yes | 241 |
| 453-460 | 688-698 | 813-826 | 5 | 252 (7889, Square 29×29) | 252 (7889, Square 29×29) | no | 249-252 |
| 470, 480 | 713, 729 | 844, 862 | 5 | 254 (329, Rectangle 24×36) | 256 (527, Rectangle 24×36) | no | 279 |

- **The arrow rule alone gives 452.** 453 is the first failure: Square grows from 28×28 to 29×29 once the Super Hard
  target passes 812 cells, and index 7889 deals it with 252 arrows.
- **The tail is monotone this time**, unlike W3-14's legacy scan (350 passed, 355 failed): every scanned value from
  330 to 452 passes the arrows and every scanned value from 453 to 480 fails.
- **Every row's max is at or under v1's 262 over 0-9999**, including the failing rows (at most 256).
- **Decision 1: 450, not 452.** 451 and 452 pass the arrows, but their Super Hard target (810, 811) is above
  Hexagon's capacity (809). The saturated bag window then holds five shapes, fewer than one tier cycle, and the
  bag's O(1) steady state (V2-FINISH part 3) refuses windows that short, because the shortcut is only exact for
  length >= 6. Evidence:
  - EXECUTED (`scripts/steady.ts`, 3 fresh processes per cell, `NODE_OPTIONS=--jitless`): a cold first pick at
    level 20,000 builds **3,949 windows and takes 123.2-125.9 ms at 452** (fresh and existing), against **29 / 35
    windows and 1.97-2.29 ms at 450**. That is V2-FINISH part 3's target (under 5 ms) undone.
  - EXECUTED, mutations RC-M2 (452) and RC-M3 (451): 8 tests fail each, including 4 in `coldPick.test.ts`.
  - The probe now encodes it: a "window >= 6 shapes" column. The ceiling is the largest value passing both, so the
    probe prints 450 "(matches)". It also prints the arrow-only answer (452).
  - 450 and 452 deal the same (e) maximum (244); 452's every-index maximum is 239 against 450's 232.
- **The heaviest board found at 450:** 244 arrows in the sample (index 19565, Super Hard Square 28×28), 232 over every
  index 0-9999 (index 2057, Super Hard Heart 33×33). On the shipped curve (section 4) the heaviest over 0-9999 is
  232 arrows (index 1067, Super Hard Heart 33×33). Its node generation time, same process, alternated, 15 reps: median
  **11.29 ms against v1's worst (index 7157, 262 arrows) 14.24 ms: x0.79** (`curve-report.txt`).

## 3. The v1 floor, re-run (EXECUTED, `npm run analysis:probe -- --version 2 --v1-floor`)

- v1's medians are unchanged, as expected for a frozen v1: 83 / 125 / 150 (n = 2,000 / 500 / 500).
- The scan now runs 320-450, 131 bases x 3,000 boards (27.5 min). **Every base 335-450 passes and 334 fails, so the
  floor stays 335.** The probe prints "src/core/curve.ts holds 335 (matches)".
  - The 320-339 rows are byte-identical to V2-FINISH part 2's: flat curves do not depend on the ceiling.
- **The floor stops binding earlier.** S400 now reaches 335 at displayed level 274, not 394: the ramp is steeper,
  88 -> 450 instead of 88 -> 339 over the same 399 levels.
- Output: `artifacts/RE-CEILING/v1-floor.txt`.

## 4. The shipped curve at 450 (EXECUTED)

`npm run analysis:probe -- --version 2 --curve-report --reference <flat-reference.json>`
(`curve-report.txt`), `--switch-report` (`switch-report.txt`) and `scripts/heavy.ts` (`heavy-new.txt`, a cross-check
that agrees with both):

| check | fresh install | existing player (floored) | limit |
|---|---|---|---|
| heaviest, every index 0-9999 | 232 (index 1067, Heart 33×33) | 232 (index 2057, Heart 33×33) | 250; v1's worst 262 |
| heaviest, 0-99,999 every 7 (14,286 boards) | 237 (index 93611, Rectangle 23×34) | 233 (index 76559, Rectangle 23×34) | 250 |
| boards over 250 / over 262 | 0 / 0 | 0 / 0 | 0 |
| clamp shortfalls (levels 1-3000 and the sample) | 0 + 0 | 0 (tests: floored 0-1199) | 0 |
| smallest fit cell, 360 / 411 dp | 9.15 / 10.45 pt (largest board 44 rows, 37 cols) | same clamp | 9.1 pt |
| shapes once saturated | 6 of 26, from level 358 | 6 of 26 | none |

- **The W3-09 clamp and the legibility floor still hold.** No board is wider than 37 columns or taller than 46 rows:
  the curve report and the floored-board test check both.
- **The 20 shapes excluded once saturated:** Diamond, Triangle, Plus, Star, Trophy, Crescent, Flower, Bolt, Arrow,
  Crown, Hourglass, Pentagon, Ring, X, Butterfly, Rocket, Pine, Cat, Mushroom, Fish. The 6 that remain are Square,
  Heart, Circle, Octagon, Rectangle and Hexagon. At 339 there were 15.
- **(a) "cycle medians non-decreasing" fails at 300-level blocks against the new flat reference.** The flat
  reference was re-run at base 450 (`--flat-reference`, 12,000 levels; `flat-reference.txt`): the largest block
  change is 4.7% (scan) / 4.8% (blocked) over 300 levels, and 13.0% / 17.7% over 60. The shipped curve drops 5.2%
  (scan) and 8.1% (blocked) at level 1801. That is 1,400 levels after the last curve input changes, where the inputs
  are constant by construction. So it is noise that one 40-block flat realization under-states (W3-14 hit the same
  limit when its first reference was too short), not a falling curve. The 60-level verdict passes. Concern 4.

## 5. The existing-player switching table (EXECUTED, `--switch-report`)

v2 / v1 median of the cycle-median scan proxy, from the cycle holding L. Resolution printed by the probe: the
flat curve's own block noise, 34.3% over 60 levels and 6.3% over 300 (W3-14's legacy figures; the new flat reference
at base 450 measures 13.0% / 4.7%, so the printed values are the conservative ones).

| switch at L | window | v1 scan | fresh v2 / v1 | **existing v2 / v1** | before (339 ceiling, V2-FINISH): existing |
|---|---|---|---|---|---|
| 2 | 60 / 300 levels | 185 / 184 | 0.23 / 0.49 | **0.94 / 0.95** | 0.94 / 0.94 |
| 12 | 60 / 300 | 184 / 184 | 0.26 / 0.54 | **0.91 / 0.95** | 0.91 / 0.94 |
| 40 | 60 / 300 | 185 / 185 | 0.34 / 0.61 | **0.94 / 0.94** | 0.94 / 0.94 |
| 100 | 60 / 300 | 211 / 185 | 0.40 / 0.78 | **0.82 / 0.97** | 0.82 / 0.94 |
| 400 | 60 / 300 | 198 / 198 | 1.29 / 1.25 | **1.27 / 1.25** | 0.91 / 0.89 |
| 1000 | 60 / 300 | 202 / 193 | 1.27 / 1.29 | **1.27 / 1.32** | 0.85 / 0.89 |

- Below level about 274 an existing player's boards are the 335 floor's, so those rows barely move.
  - The 60-level window at L = 100 reads 0.82 because v1's own window there is unusually heavy: 211 against a
    typical 185. That is inside the 34% 60-level noise.
- **From level 400 on, v2 is about 1.25-1.32 of v1 for everyone.** "Nothing suddenly gets easy" now holds there with
  room to spare; the opposite question is Concern 1.
- **Existing boards at displayed levels 2-399:** median arrows 86 / 129 / 154, against v1's 83 / 125 / 150. 33-34%
  of them fall below v1's median, against v1's own 50%.

### Why the proxy stays under 1.0 below the ceiling although the arrow counts match

- The floor matches v1 on **arrow counts**: a 335-base board has the same median arrows as a v1 board (83 / 125 /
  150). The scan proxy counts **looks**: at each step it adds (arrows left + 1) / (arrows clearable now + 1).
- Two boards with the same number of arrows cost different numbers of looks if one has more arrows free at each
  moment. v2's floored boards are more open than v1's for two measured reasons (V2-FINISH Concern 1):
  - **Shape mix.** v2 deals big plain silhouettes, whose edge arrows exit easily. v1 deals its picture pool.
  - **v1's RNG defect.** It carves shorter, more tangled arrows on about 23% of v1 boards.
- EXECUTED (`scripts/scanmatch.ts`, levels 1-3000, 500 cycles each; `scanmatch*.txt`): at equal arrow medians a flat
  335-base v2 board scans **0.91 of v1** (171 against 189 looks). The proxy only reaches v1 when v2 deals about 7%
  more arrows than v1:

| flat base | median arrows N / H / SH | v2 / v1 scan (1-3000) | 300-level blocks, min-max |
|---|---|---|---|
| 335 (the floor) | 83 / 125 / 150 | 0.91 | 0.87-0.94 |
| 345 | 85 / 128 / 153 | 0.95 | 0.91-0.99 |
| 352 | 88 / 133 / 157 | 0.99 | 0.95-1.02 |
| **354** | **89 / 133 / 157** | **1.00** | 0.96-1.03 |
| 360 | 89 / 134 / 158 | 1.01 | 0.99-1.04 |
| 400 | 97 / 152 / 181 | 1.14 | 1.11-1.17 |
| 450 (the ceiling) | 110 / 171 / 200 | 1.33 | 1.27-1.38 |

### The smallest change that reaches about 1.0 (proposed, not implemented)

**Raise `V1_FLOOR_BASE_CELLS` from 335 to 354, and change its unit from "v1's arrow medians" to "v1's scan proxy".**
It is one constant, and a re-labelled `--v1-floor` rule. Measured in a scratch copy (floor 354, ceiling 450;
`altC-switch.txt`), existing / v1:

| L | 2 | 12 | 40 | 100 | 400 | 1000 |
|---|---|---|---|---|---|---|
| 60 levels | 1.03 | 1.04 | 1.03 | 0.94 | 1.28 | 1.25 |
| 300 levels | 1.03 | 1.03 | 1.03 | 1.07 | 1.27 | 1.28 |

Cost of the change:
- Existing boards below the crossing (S400 reaches 354 at displayed level 295) carry about 7% more arrows than v1's
  medians (89 / 133 / 157 on the flat 354 curve). Over displayed levels 2-399, 85-90% of existing boards per tier sit
  at or above v1's median (v1's own: 50%).
- Heaviest existing board 236 over 0-9999.

## 6. Fingerprints (EXECUTED twice: jest and `scripts/fp.ts` on a HEAD snapshot and on the final `src/core`)

| value | BASE `ae35d9e` | after |
|---|---|---|
| v1 corpus 0-299, `generate(i)` and `generate(i, 1)` | `d01abbd8` | `d01abbd8` |
| goldens 239 / 917 / 935 / 3827 / 5363 | a05a623c / eb373575 / 546a69c0 / b1f50ecb / 63599476 | identical |
| daily 0..364 combined | `ff12d7b5` | `ff12d7b5` |
| daily 0 / 2450 / 9999 | Circle 4e61968e / Plus 63f8d4a5 / Diamond d313105a | identical |
| **v2 fresh corpus 0-299** (pinned, `levelGenerator.test.ts`) | `e802f80a` | **`a54d5f48`** |
| v2 fresh shape sequence 0-99,999 | `62978d37` | `9b595258` |
| **v2 existing-player corpus 0-299** (pinned, `v1Floor.test.ts`) | `d5005b0d` | **`f2fdde04`** |
| v2 existing-player shape sequence 0-99,999 | `54f68561` | `1a793241` |

- **Both v2 pins moved on purpose, and were re-pinned deliberately.** Every target from index 1 on changes, because
  the ramp's slope changes. The bag's windows move with the targets.
- v1 and the daily cannot move: the only `src/core` source file that differs from HEAD is `curve.ts`
  (EXECUTED, `diff -r` of the snapshots).
- The jest "Received" values at the RED/GREEN step equal `fp.ts`'s: two independent computations.

## 7. Timing (EXECUTED; owner rule "nothing gets slower")

Method: `scripts/run-gen.sh` + `scripts/gen-proc.ts`, adapted from V2-FINISH.
- **Processes:** one `src/core` copy per process; arms BASE (HEAD), NULL (a second copy of HEAD, to show the
  arm-to-arm noise of identical code) and NEW. 4 rounds, arm order rotated, 2 regions: 24 processes.
- **Per process:** 600 levels x 3 reps x 3 series (v1, v2 fresh, v2 existing), alternating per level. The per-level
  value is the minimum over reps.
- **Reconciliation:** every process made exactly 5,400 timed calls (`analyze.py` asserts it; all 24 did).
- **Machine:** node v20.19.4, load 4.3-6.1.
- **Figures:** median of the per-process values [min-max], ms (`timing-gen.md`).

| region | series | BASE | NULL | NEW | arrows BASE -> NEW |
|---|---|---|---|---|---|
| 0-599 | v1 median | 2.503 [2.487-2.511] | 2.508 [2.506-2.514] | 2.509 [2.493-2.522] | 60,458 (same) |
| 0-599 | v2 fresh median / p95 | 1.989 / 5.766 | 1.991 / 5.741 | **3.181 / 9.964** | 45,847 -> 59,539 (+30%) |
| 0-599 | v2 existing median / p95 | 2.403 / 6.506 | 2.407 / 6.476 | **3.398 / 9.892** | 61,148 -> 69,837 (+14%) |
| 3000-3599 | v1 median | 2.441 [2.432-2.447] | 2.439 [2.427-2.458] | 2.453 [2.445-2.458] | 61,355 (same) |
| 3000-3599 | v2 fresh median / p95 | 2.346 / 6.461 | 2.343 / 6.452 | **3.548 / 10.340** | 61,408 -> 81,431 (+33%) |
| 3000-3599 | v2 existing median / p95 | 2.338 / 6.523 | 2.351 / 6.473 | **3.561 / 10.353** | 61,055 -> 81,351 (+33%) |

NEW's v2 ranges are disjoint from BASE's everywhere (for example 3000-3599 fresh: [3.535-3.559] against
[2.329-2.361]).
- **The code did not get slower.** v1 is flat across all three arms (at most 0.5% apart, inside the BASE / NULL
  spread of identical code). v2 per arrow costs more only because bigger boards cost more per arrow: 0.032 -> 0.039
  ms per arrow at saturation.
- **The content did get slower, beyond noise. The brief's check "not slower beyond noise" FAILS for v2.** It fails
  by construction: the ceiling is 33% more cells.
  - At saturation v2 is +51% median and +60% p95 against before, and **+45% median and +36% p95 against v1** in the
    same processes.
  - The heaviest board stays under v1's worst (x0.79 in node time), which is what the brief's rule caps.
  - The typical board does not stay under v1's. Concern 1.
- **Cold first pick** (the part 3 path): at 450 a pick at level 20,000 builds 29 (fresh) / 35 (existing) windows,
  1.97-2.29 ms `--jitless` (`steady-jitless.txt`). V2-FINISH measured 1.84 / 2.11 ms at 339: unchanged within that
  run's spread.
- Hermes and iOS are unmeasured: UNVERIFIED-DEVICE.

## 8. TDD and mutations (EXECUTED)

- **RED** (`logs/red1.txt`): `npx jest src/core/__tests__/v1Floor.test.ts` gave **2 failed / 30 passed**, both for
  the right reason:
  - "V2_CURVE is S400 ... the measured ceiling (450 cells)": Expected 450, Received 339;
  - "the ceiling carries its measurement label (RE-CEILING)": the label was missing.
  - The new guard "the saturated S400 window still holds a full tier cycle" passed at RED (339 admits 15). It carries
    weight after GREEN: RC-M2 and RC-M3 fail it.
  - Before RED, I made the "floor binds below the crossing" test compute its last bound index instead of the
    literal 300. At 450 the fresh Normal target reaches the floor's 335 at index 272, so index 300 would have failed
    for the wrong reason. The edited test passed at 339 (EXECUTED).
- **GREEN 1** (`logs/green1.txt`): after the constant and its label, `npx jest src/core` gave **2 failed / 357
  passed**: only the two v2 pins, "Received" `a54d5f48` and `f2fdde04`, equal to `fp.ts`.
- **GREEN 2** (`logs/green2.txt`): re-pinned, **16 suites / 359 tests passed**.
- **Mutations** (`scripts/mutate.py`, an isolated copy with a symlinked `node_modules`; `v1Floor`, `coldPick`,
  `levelGenerator` and `shapeBag`, 109 tests; every restore `cmp`-identical to the working tree; `mut.jsonl`):
  **5 of 5 caught.**

| mutation | failing tests (of 109) |
|---|---|
| RC-M1 the ceiling back to the stale 339 | 3 (the S400 table, both v2 pins) |
| RC-M2 452, the arrow rule's literal answer | 8 (incl. the full-cycle guard and 4 cold-pick tests) |
| RC-M3 451 | 8 (the same) |
| RC-M4 the measurement label dropped | 1 (the label test) |
| RC-M5 a near value, 449 | 3 (the S400 table, both v2 pins) |

  The first mutation run (`mut-run1.jsonl`) had one suite, `shapeBag.test.ts`, failing to compile in the copy: it
  imports `src/ui/boardCamera.ts`, which the copy lacked. It still caught all 5 through the other 3 suites; the
  harness was fixed and re-run.

## 9. Gates (final, EXECUTED)

- **`npx tsc --noEmit`: exit 0** (`logs/tsc-final.txt`; BASE: exit 0). It covers `scripts/`, so the probe too.
- **`npx jest src/core`: 16 suites / 359 tests, all passed** (`logs/green2.txt`). That is every suite this task
  changed or can affect: `src/core` is the only source directory I edited, besides the probe.
- **`npx jest` (the whole repo) does not pass today, for reasons outside this task** (the machine's load average
  was 45-97 at the time, from other sessions):
  - The first full run (`logs/jest-final.txt`) gave 107 suites / 1,873 tests, **36 failed in 4 suites**.
    - Three of the failing suites are copies under `artifacts/W5-05/snapshot/` and `artifacts/W5-07/snapshot/`.
      The other agent created them during this task, and jest's `testMatch` (`**/src/**/__tests__/**`) picks them up.
    - The fourth is `src/ui/__tests__/contrast.test.ts`: 20 "every usage row names a real site" rows, from the
      other agent's in-progress palette work. `src/ui/contrastAudit.ts`, `scripts/contrast-audit.ts` and the test
      itself are modified against HEAD, not by me. The suite imports no `src/core` module.
  - A second run with `--testPathIgnorePatterns /artifacts/` (`logs/jest-noartifacts.txt`) gave 104 suites / 1,688
    tests, **11 failed in 2 suites**:
    - `contrast.test.ts` again. Run alone a minute later, it had 36 failed / 334 passed: it is changing under the
      other agent's edits.
    - `adsRewardedNativeEvent.test.ts`: 2 tests hit "Exceeded timeout of 5000 ms" at load average 97. Run alone
      right after: **8 / 8 passed**. The file is unchanged since `c7e2d55`.
  - For comparison, V2-FINISH's final run was 102 suites / 1,630 tests, all passed. This task adds 2 tests
    (`v1Floor.test.ts`, 30 -> 32).
- **Final re-run after the last `curve.ts` comment edit:** `npx tsc --noEmit` exit 0 and `npx jest src/core`
  16 suites / 359 tests passed (`logs/tsc-final.txt`, `logs/jest-core-final.txt`).
- **The probe's final code re-ran `--ceiling`** (`ceiling-final.txt`, 78 min wall under load): "CEILING_BASE_CELLS =
  450 ... src/core/curve.ts holds 450 (matches)"; "The arrow rule alone gives 452; W3-14's old rule ... gives 452".
  All 25 rows' arrow columns are identical to the first run's (EXECUTED, a `diff` of the columns): the boards are
  deterministic, so the table reproduces.

## Files changed

| file | change |
|---|---|
| `src/core/curve.ts` | `CEILING_BASE_CELLS` 339 -> 450, labelled `// MEASURED 2026-09-26 by difficulty-probe --ceiling (exact RNG)`, with the rule, the scan and why not 452; the S400 row comment; the floor comment (re-measured, still 335, crossing at level 274). |
| `src/core/__tests__/v1Floor.test.ts` | The S400 table test at 450; new tests for the label and for a full-cycle saturated window; the floor-binds test computes its index; the existing-player pin `d5005b0d` -> `f2fdde04`. |
| `src/core/__tests__/levelGenerator.test.ts` | The v2 pin `e802f80a` -> `a54d5f48`, with its history. |
| `scripts/analysis/difficulty-probe.ts` | `--ceiling`: scan 330-480; the every-index 0-9999 maximum; the full-cycle window rule; the 0.3 tail as information; the arrow-only and old-rule answers printed. `--switch-report`: the existing player's heaviest over every index 0-9999. A comment on the flat-noise constants. |
| `DESIGN.md` | The v2 shape-selection and curve paragraphs: 450 / 683 / 808, 6 of 26 from level 358, the floor crossing at 274. |
| `docs/curve-candidates-2026-09-26.md` | A pointer under the title and an addendum before the appendix; history untouched. |
| `docs/next-level/reports/RE-CEILING.md` | This report. |

Not touched: `src/ui/*`, `App.tsx`, `src/featureFlags.ts`, `package.json`, `SaveSystem.PersistenceKeys`,
`shapeBag.ts` (its capacity table does not depend on the ceiling).

## Migration and wipe risk

None. No persisted key is read, written or added. `GEN_V2_ENABLED` is false, so no save holds a v2 board. The
collection fold asks v1 everywhere while the flag is off.

## Decisions

1. **450, not the arrow rule's 452** (section 2). 451 and 452 would undo V2-FINISH part 3's cold pick (124 ms
   `--jitless` against 2 ms) and fail its tests. The two values deal the same (e) maximum. This is a constraint
   of the existing code, not a taste call; the probe encodes it, and the owner question offers 452 back.
2. **Neutral only in the pass rule.** The 0.3 tail was for W3-14's unpicked tail candidates. It is still printed;
   under W3-14's own rule (sample, neutral and 0.3, no full range) the answer is also 452.
3. **The every-index 0-9999 check is part of the rule**, at 250 (not only 262): `ARROW_CEILING` is "the heaviest
   board any curve may deal". 262 is printed as its own clause and is implied.
4. **The floor rule is unchanged** (arrow medians). The scan-matched 354 is proposed, not implemented, as the brief
   says.
5. **The flat-noise constants stay W3-14's** (34.3% / 6.3%), as the larger and conservative resolution. The new
   flat reference at 450 (13.0% / 4.7%) is recorded in a comment.
6. **The (a) FAIL is reported, not fixed** (Concern 4): the curve inputs are constant where it drops.

## Concerns

1. **The rule's ceiling makes the late game about 50% slower to generate than today, and about 1.3x v1's search
   cost.** Measured at saturation against v1 in the same processes:
   - median per-level generation +45%, p95 +36% (node);
   - arrows +33% (110 / 171 / 200 against 83 / 125 / 150);
   - scan proxy 1.25-1.32.
   The heaviest board is still x0.79 of v1's worst, so no single board is slower than the slowest one players have
   today. But the brief's "not slower beyond noise" check fails, and so does the plain reading of "nothing gets
   slower" for a typical level. On device the median saturated board would grow from about v1's size to about a
   third bigger (UNVERIFIED-DEVICE; W2-04's emulator figure is 74.5 ms for a 250-arrow board).
2. **Novelty: 6 of 26 shapes forever after level 358** (15 of 26 at 339). The approved shape gallery stops growing
   for a late-game player after those 6. W3-18's high-capacity shapes would add to the pool; nothing else does.
3. **The owner picked S400 on a different plateau.** W3-16's sheet showed S400 saturating at about 0.9 of v1 with 15
   shapes. Its ceiling was a measurement, so re-measuring it is within the brief, but what the owner now gets after
   level 400 is materially harder and heavier than what they looked at.
4. **(a) at 300-level blocks FAILS against the new flat reference** (a 5.2% drop against 4.7% resolution, at level
   1801, 1,400 levels into the plateau). It is noise: no input changes there. But the instrument cannot currently
   certify "non-decreasing" for this curve at 300 levels.
5. **The ceiling is sample-based past level 10,000** (every 7th index to 100,000). The scan found no board over 250
   below 453, and the tail was monotone this time. A board slightly over 250 somewhere past 10,000 is still possible
   (INFERRED).
6. **Timing ran on a shared, loaded Mac** (load 4-6 for the main run; up to 15 in the option-B run's last round).
   Comparisons are within rounds from per-process medians. Hermes and iOS are UNVERIFIED-DEVICE.
7. **The proxy is a proxy.** "Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty;
   never correlated with real mistakes (see W3-23)."

## Owner question

**The re-measured ceiling (450) meets the arrow cap, and no board exceeds v1's heaviest. But the late game is about a
third bigger, about 50% slower to generate per level than today, and down to 6 shapes. Which do you want?**

| option | ceiling / floor | existing v2 / v1 scan: below 400, from 400 | fresh plateau vs v1 | shapes saturated | heaviest 0-9999 | v2 per level at saturation vs v1 (median / p95) |
|---|---|---|---|---|---|---|
| **A** (in the tree now) | 450 / 335 | 0.82-0.97, then 1.25-1.32 | 1.25-1.29 | 6 | 232 | +45% / +36% |
| **B** (scan-matched) | 354 / 354 | 0.94-1.04, then 0.94-0.99 | 0.90-0.97 | 13 | 190 (existing 195) | +9% / -5% |
| C (A plus section 5's floor) | 450 / 354 | 0.94-1.07, then 1.25-1.28 | 1.25-1.29 | 6 | 232 (existing 236) | +45% / +36% |
| D (keep the stale value) | 339 / 335 | 0.82-0.94, then 0.85-0.91 | 0.81-0.90 | 15 | 183 | -4% / -14% |

B, C and D were measured in scratch copies only (`altB-switch.txt`, `altB-curve.txt`, `altC-switch.txt`,
`timing-gen-altb.md`).
- B's timing is from a second 24-process run with BASE and NEW beside it: v2 fresh at 3000-3599 is 2.667 ms against
  v1's 2.457 and BASE's 2.390; the p95 is 7.161 against v1's 7.548.
- B's (a) passes at 300-level blocks.

**Recommendation: B.** It is the one option that meets both of your sentences within about 10%:
- "nothing suddenly gets easy": 0.94-1.04 for existing players everywhere;
- "nothing gets slower": the heaviest board is x0.58 of v1's worst, the p95 is below v1's, and the median is 9% above.
- It also keeps 13 shapes.

It makes the ceiling a proxy-matched owner pick rather than the arrow cap, so it needs your yes. Implementing it is
two constants, a `--v1-floor` rule change to the scan proxy, re-pins, and this report's checks re-run.

## Fix round 1 (owner pick B)

- **Base:** `b17461d` (HEAD moved during the first round: W2-06, W2-08, W2-10, W5-05, W5-07, W5-14 and
  `ccb8d06` "never collect tests from artifacts/"). None of those commits touches `src/core` or the probe; they
  only add flags to `src/featureFlags.ts`. EXECUTED: `git diff ae35d9e HEAD -- src/core` is empty.
- **Owner pick, 2026-09-27:** "B: 354 cells", from the options table above. Ceiling 354 and floor 354, the floor
  calibrated on the scan proxy.
- **Status: DONE.** Both gates pass, including the full `jest`. The one caveat is below: the typical v2 level
  is still about 9% slower to generate than v1's.

### What changed in this round

| file | change |
|---|---|
| `src/core/curve.ts` | `CEILING_BASE_CELLS = 354` and `V1_FLOOR_BASE_CELLS = 354`. Each carries `// OWNER PICK 2026-09-27 (RE-CEILING option B, docs/next-level/reports/RE-CEILING.md)` and a `// Measured:` line naming the command. The comments give how 354 was chosen, the floor's new unit (the scan proxy) and the history (339, 450, 335). |
| `scripts/analysis/difficulty-probe.ts` | `--v1-floor` now walks every board and prints both units per base: the arrow medians (V2-FINISH) and the scan-proxy ratio with its 300-level block spread. It also prints ten bases above the ceiling for context. Its check is against the scan-proxy base. `--ceiling` measures the shipped value's own row and checks it is within the rule, instead of expecting equality. The `--candidates` text is updated. The round's other probe changes are kept. |
| `src/core/__tests__/v1Floor.test.ts` | The S400 table at 354. A label test for both constants: the label must be on one of the three lines directly above each declaration. The saturated window must hold at least 6 shapes and exactly 13. The floor pinned at 354. The existing-player pin re-pinned. |
| `src/core/__tests__/levelGenerator.test.ts` | The v2 pin re-pinned. |
| `DESIGN.md` | The v2 paragraphs: 354 / 537 / 635, 13 of 26 from level 384, a floor equal to the ceiling. |
| `docs/curve-candidates-2026-09-26.md` | The pointer and the addendum's final part: the owner pick, the `--v1-floor` table, and 339 / 450 / 354 side by side. |

### How 354 is reproduced (EXECUTED, `npm run analysis:probe -- --version 2 --v1-floor`)

- 138,000 boards dealt and walked: v1 plus 45 flat bases (320-364) x 3,000 levels. Output: `r1/v1-floor.txt`.
- v1 over levels 1-3000: 83 / 125 / 150 arrows; median cycle scan 188.6 (300-level bands 183.0-192.1).

| flat base | median arrows N / H / SH | v2 / v1 scan | 300-level blocks | arrow unit | scan unit |
|---|---|---|---|---|---|
| 320 | 79 / 119 / 141 | 0.859 | 0.83-0.89 | no | no |
| 334 | 82 / 125 / 147 | 0.909 | 0.87-0.94 | no | no |
| 335 | 83 / 125 / 150 | 0.908 | 0.87-0.94 | yes | no |
| 345 | 85 / 128 / 153 | 0.947 | 0.91-0.99 | yes | no |
| 350-351 | 86 / 133 / 155 | 0.963 | 0.94-0.99 | yes | no |
| 352-353 | 88 / 133 / 157 | 0.994 | 0.95-1.02 | yes | no |
| **354** | **89 / 133 / 157** | **1.000** | **0.96-1.03** | yes | **yes** |
| 355-360 (above the ceiling) | 89-90 / 133-134 / 158-159 | 1.005-1.010 | 0.96-1.05 | yes | yes |
| 361-364 (above the ceiling) | 90 / 135-136 / 158-161 | 1.026-1.029 | 1.00-1.07 | yes | yes |

- The probe prints: "Arrow-median base (V2-FINISH's unit): 335; scan-proxy base (RE-CEILING option B's unit): 354
  ... V1_FLOOR_BASE_CELLS: src/core/curve.ts holds 354 (matches the scan-proxy base)."
- **The match is at the instrument's resolution, not above it.** 354 scores 1.000 (188.7 against 188.6 looks), and
  one 300-level block spreads 0.96-1.03. 352-353 score 0.994, inside that spread. The honest reading: v2 matches v1
  somewhere in 350-360, and 354 is the smallest base whose median clears it. Every base above it scores higher.

### The shipped curve at 354 (EXECUTED)

`--curve-report` (with `--flat-reference` re-run at 354), `--switch-report` and `scripts/heavy.ts`, which
cross-checks both and agrees:

| check | fresh install | existing player | limit |
|---|---|---|---|
| heaviest, every index 0-9999 | **190** (index 2705, Super Hard Plus 36×36) | **195** (index 4943, Plus 36×36) | 250; v1's worst 262 |
| heaviest, 0-99,999 every 7 (14,286 boards) | 194 (index 80507, Plus 36×36) | 197 (index 80801, Rectangle 21×32) | 250 |
| boards over 250 / over 262 | 0 / 0 | 0 / 0 | 0 |
| node time of the heaviest 0-9999 board against v1's worst (15 reps, alternated) | x0.565 (11.54 against 20.41 ms, measured under load) | | < 1 |
| shapes once saturated | **13 of 26, from level 384** | 13 of 26 | |
| clamp shortfalls; smallest fit cell | 0 + 0; 9.15 pt at 360 dp (largest board 42 × 37) | same clamp | 0; 9.1 pt |
| (a) 300-level blocks against the flat reference at 354 (3.8% scan / 6.2% blocked) | **PASS** (the concern 4 FAIL at 450 is gone) | | |

- The 13 shapes left out once saturated are Diamond, Triangle, Star, Trophy, Crescent, Bolt, Arrow, Crown, Rocket,
  Pine, Cat, Mushroom and Fish. At 339 there were 11 left out.
- The existing player's boards are a flat 354 from their first v2 level: floor and ceiling are equal. The floor
  binds strictly below index 399, where S400 reaches 354.

### The existing-player switching table (EXECUTED, `--switch-report`, `r1/switch-report.txt`)

| switch at L | window | v1 scan | fresh v2 / v1 | **existing v2 / v1** |
|---|---|---|---|---|
| 2 | 60 / 300 levels | 185 / 184 | 0.23 / 0.43 | **1.03 / 1.03** |
| 12 | 60 / 300 | 184 / 184 | 0.24 / 0.44 | **1.04 / 1.03** |
| 40 | 60 / 300 | 185 / 185 | 0.28 / 0.49 | **1.03 / 1.03** |
| 100 | 60 / 300 | 211 / 185 | 0.31 / 0.62 | **0.94 / 1.04** |
| 400 | 60 / 300 | 198 / 198 | 0.93 / 0.95 | **0.99 / 0.98** |
| 1000 | 60 / 300 | 202 / 193 | 0.90 / 0.97 | **0.94 / 0.99** |

- **Existing players: 0.94-1.04 everywhere.** "Nothing suddenly gets easy" holds within the proxy's noise.
  - The two 0.94s are 60-level windows, whose flat-curve noise is 14-34%.
  - At L = 100, v1's own window is unusually heavy (211 against a typical 185).
- **Existing boards at displayed levels 2-399:** median arrows 89 / 133 / 157, against v1's 83 / 125 / 150. 15-21%
  per tier fall below v1's median; v1's own share is 50%.
- **Fresh installs** stay on S400's ramp, as the owner picked in W3-16, and reach 0.90-0.97 of v1 after level 400.

### Timing (EXECUTED; `r1/timing-gen.md`, `r1/cold-jitless.md`)

Same harness as section 7: BASE = HEAD (`b17461d`, whose core equals `ae35d9e`'s), NULL = a second copy of HEAD, NEW
= 354 / 354. 24 processes, each checked at exactly 5,400 calls. Load average 8.8-12.7 from other sessions.

| region | series | BASE | NULL | NEW | **NEW against v1, same processes** |
|---|---|---|---|---|---|
| 3000-3599 | v1 median / p95 | 2.498 / 7.653 | 2.488 / 7.655 | 2.490 / 7.733 | (reference) |
| 3000-3599 | v2 fresh median / p95 | 2.418 / 6.605 | 2.393 / 6.570 | **2.713 / 7.291** | **+9.0% / -5.7%** |
| 3000-3599 | v2 existing median / p95 | 2.403 / 6.698 | 2.380 / 6.627 | **2.677 / 7.190** | **+7.5% / -7.0%** |
| 0-599 | v1 median / p95 | 2.557 / 7.615 | 2.546 / 7.609 | 2.580 / 7.718 | (reference) |
| 0-599 | v2 fresh median / p95 | 2.039 / 5.958 | 2.025 / 5.888 | **2.195 / 6.777** | **-14.9% / -12.2%** |
| 0-599 | v2 existing median / p95 | 2.472 / 6.658 | 2.477 / 6.619 | **2.776 / 7.456** | **+7.6% / -3.4%** |

Arrows over each region, v1 against NEW:
- 3000-3599: v1 61,355; v2 fresh 64,968 (+5.9%); v2 existing 64,431.
- 0-599: v1 60,458; v2 existing 64,894.

**Plainly: yes, the typical v2 level is still slower to generate than v1's.**
- **Saturated levels:** the v2 median is **+9.0%** (2.713 against 2.490 ms). The ranges are disjoint: [2.680-2.726]
  against [2.476-2.516].
- **Existing players:** **+7.5%** (saturated levels) and **+7.6%** (levels 1-600), because their boards carry about
  6-7% more arrows than v1's median board.
- **The slow tail is faster:** the p95 is 3-7% below v1's in every series, and the heaviest board is x0.57 of v1's
  worst.
- **Against the pre-RE-CEILING HEAD** (ceiling 339), saturated v2 is +12% median and +10% p95. That is content:
  +5.8% arrows, and the bigger boards cost slightly more per arrow.
- **The code is unchanged:** v1 differs by at most 1% between BASE, NULL and NEW.
- **Per board on device** this is UNVERIFIED-DEVICE. Node medians are 2.5-2.7 ms; W2-04's emulator figure is 74.5
  ms for a 250-arrow board. By proportion (INFERRED), the difference is a few milliseconds per level transition.

**Cold first pick, `--jitless`** (3 fresh processes per cell): the fast lookup stays on at 354.
- At level 20,000 it is steady from window 20 / 31, length 13 (fresh / existing).
- Times: fresh 1.76 ms [1.71-1.78] against HEAD's 1.75. Existing 2.57 ms [2.30-2.66] against HEAD's 2.09: 32
  windows built against 28, still under the 5 ms target.
- At level 0 both installs take 0.70-0.77 ms.

### Fingerprints (EXECUTED twice: jest and `fp.ts` on HEAD and NEW snapshots; `r1/fp-*.txt`)

| value | HEAD `b17461d` | after |
|---|---|---|
| v1 corpus 0-299 | `d01abbd8` | `d01abbd8` |
| goldens 239 / 917 / 935 / 3827 / 5363 | a05a623c / eb373575 / 546a69c0 / b1f50ecb / 63599476 | identical |
| daily 0..364 / 0 / 2450 / 9999 | `ff12d7b5` / 4e61968e / 63f8d4a5 / d313105a | identical |
| **v2 fresh corpus 0-299** | `e802f80a` | **`71dc3369`** |
| v2 fresh shape sequence 0-99,999 | `62978d37` | `91699816` |
| **v2 existing corpus 0-299** | `d5005b0d` | **`ea5e4bf5`** |
| v2 existing shape sequence 0-99,999 | `54f68561` | `0608fb01` |

Both v2 pins are re-pinned deliberately. The first round's `a54d5f48` / `f2fdde04` were never committed. The
only core source difference from HEAD is `curve.ts`.

### TDD and mutations (EXECUTED)

- **RED** (`r1/logs/red.txt`): `npx jest src/core/__tests__/v1Floor.test.ts` gave **4 failed / 28 passed**:
  - the table: Expected 354, Received 450;
  - the label on both constants: missing;
  - 13 shapes: Received 6;
  - the floor: Expected 354, Received 335.
- **GREEN 1** (`r1/logs/green1.txt`): after the constants, `npx jest src/core` gave 2 failed / 357 passed. Only the
  two v2 pins failed, and their "Received" `71dc3369` / `ea5e4bf5` equal `fp.ts`'s.
- **GREEN 2:** re-pinned, 16 suites / 359 tests passed.
- **Mutations** (`r1/scripts/mutate.py`, isolated copy, 4 suites / 109 tests, every restore `cmp`-identical,
  `r1/mut.jsonl`): **6 of 6 caught.**

| mutation | failing tests |
|---|---|
| RB-M1 the ceiling back to 450 | 4 (the table, 13 shapes, both pins) |
| RB-M2 the floor back to 335 | 2 (the floor test, the existing pin) |
| RB-M3 the ceiling one cell high, 355 | 2 (the table, the fresh pin) |
| RB-M4 the floor one cell low, 353 | 2 (the floor test, the existing pin) |
| RB-M5 the floor loses its owner-pick label | 1 (the label test) |
| RB-M6 the ceiling at 452 (five-shape windows) | 8 (incl. 4 cold-pick tests) |

### Gates (final, EXECUTED)

- `npx tsc --noEmit`: exit 0 (`r1/logs/tsc-final.txt`).
- **`npx jest`: 107 suites / 1,769 tests, 12 snapshots, all passed** (`r1/logs/jest-final.txt`, the last run,
  after every edit). An earlier run in this round gave 106 / 1,766, also all passed; the other agent added a suite
  in between. HEAD's `ccb8d06` now keeps `artifacts/` out of test collection. I did not touch `jest.config.js`.
- Round-1 evidence is in `artifacts/RE-CEILING/r1/`. Its scratch folder was deleted at the end.
- **`--ceiling` with the final code** (`r1/ceiling.txt`, 507,624 boards, 62 min):
  - It prints "The rule's largest base: 450 ... src/core/curve.ts holds CEILING_BASE_CELLS = 354, the owner's pick
    ... within the rule (PASS)". The arrow rule alone still gives 452.
  - 354's own row: max 197 in the sample (index 80801, Rectangle 21×32), 195 over every index 0-9999 (index 4943,
    Plus 36×36), 13 shapes admitted.
  - The other 25 rows are identical to round 0's (a `diff` of the rows).

### Decisions (round 1)

1. **The floor's unit is now the scan proxy** (the owner's option B). The arrow-median base (335) is still printed
   beside it, so the change of unit is visible in one command.
2. **`--v1-floor` scans ten bases past the ceiling, as context.** 354 sits on the edge of the instrument's
   resolution, and those rows show every base above it scores higher. They cannot become the floor.
3. **`--ceiling` checks the shipped value is within the rule** (PASS / FAIL) instead of expecting equality: the
   ceiling is now an owner pick below the rule's maximum (450).
4. **The label test reads the three lines directly above each declaration**, so the label cannot drift into
   another constant's comment.

### Concerns (round 1)

1. **"Nothing gets slower" holds for the slow tail, not for the typical level.**
   - The v2 median is +9% against v1 at saturation, and +7-8% for existing players.
   - The p95 is below v1's and the heaviest board is x0.57 of v1's worst.
   - Closing the median gap would mean a base near 339 (HEAD: -3% against v1), which scans only 0.92 of v1. That
     is what B was picked to avoid.
2. **The scan-proxy match is at the instrument's resolution** (354: 1.000; 300-level blocks 0.96-1.03).
3. **The proxy is a proxy** (W3-23), and all timing is node on a loaded shared Mac. Hermes and iOS are
   UNVERIFIED-DEVICE.
4. **Fresh installs keep S400's easy ramp**, 0.23-0.62 of v1 for their first 300 levels (the owner's W3-16 pick,
   unchanged). Only existing players get the floor.

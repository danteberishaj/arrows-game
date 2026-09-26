# V2-FINISH: the owner's curve, the v1 floor, an exact RNG and a warm first pick (all still dark)

- **Base:** `32594e7` (W5-06), branch `next-level`. HEAD did not move during the task.
- **Status:** DONE_WITH_CONCERNS. All three parts pass their tests and gates. The concerns are for the
  owner and controller: the switching proxy lands at about 0.9, not 1.0 (Concern 1); the RNG defect
  inflated both v1's boards and W3-14's ceiling evidence (Concern 2); and the UI must pass the
  switch level before `GEN_V2_ENABLED` flips (Concern 3, guarded by a tripwire test).
- **Flag:** `GEN_V2_ENABLED = false` throughout (EXECUTED: `generatorVersion.test.ts` "the v2 flag ships OFF"
  passes in the final run). No native build, no emulator. Node only.
- **Another agent** edited UI files during the task (`App.tsx`, `src/featureFlags.ts`, `src/ui/*`,
  `GameScreen*` tests; see `git status`). I touched none of them. Their suites are in the jest totals
  below, which are reconciled.

Evidence lives in `artifacts/V2-FINISH/` (gitignored): probe outputs, `logs/` (RED/GREEN runs,
fingerprints, gates), `scripts/` (the scratch harnesses: `fp.ts`, `mutate.py`, the timing runners, and
others), mutation logs, timing data and the per-part patches. The scratch folder it came from was deleted
at the end.

## Files per part (so each part can be committed on its own)

`artifacts/V2-FINISH/part1.patch`, `part2.patch` and `part3.patch` are consecutive diffs. EXECUTED: a
`git archive 32594e7` extraction with the three applied in order by `patch -p1` is byte-identical to the
working tree for `src/core`, `scripts/analysis` and `DESIGN.md`.

| part | files |
|---|---|
| 1: S400 + the v1 floor | `src/core/curve.ts`, `src/core/difficulty.ts`, `src/core/generatorVersion.ts`, `src/core/levelGenerator.ts`, `src/core/shapeBag.ts`, `src/core/saveSystem.ts`, `src/core/index.ts`, `src/core/__tests__/v1Floor.test.ts` (new), `src/core/__tests__/saveSystem.genVersion.test.ts`, `scripts/analysis/difficulty-probe.ts` (`--v1-floor`, `--switch-report`), `DESIGN.md` |
| 2: exact RNG | `src/core/dotnetRandom.ts`, `src/core/levelGenerator.ts`, `src/core/shapeBag.ts`, `src/core/curve.ts` (floor re-measured 333 -> 335; a comment on the now-stale ceiling measurement), `src/core/index.ts`, `src/core/__tests__/dotnetRandom.test.ts` (new), `src/core/__tests__/levelGenerator.test.ts` (v2 re-pin), `src/core/__tests__/shapeBag.test.ts`, `src/core/__tests__/v1Floor.test.ts` (re-pins), `src/core/__tests__/dailyBoard.test.ts` (year pin), `scripts/analysis/rng-exactness.ts` (new), `DESIGN.md` |
| 3: warm first pick | `src/core/shapeBag.ts`, `src/core/shapeCapacityTable.ts` (new, generated), `src/core/index.ts`, `src/core/__tests__/coldPick.test.ts` (new), `scripts/analysis/capacity-table.ts` (new) |
| report | `docs/next-level/reports/V2-FINISH.md` |

Not touched: `src/ui/*`, `App.tsx`, `src/featureFlags.ts`, `package.json`, `SaveSystem.PersistenceKeys`.

## Fingerprints (EXECUTED, `artifacts/V2-FINISH/scripts/fp.ts`, the tests' `checksumLines`)

| value | BASE `32594e7` | after part 1 | after part 2 | after part 3 |
|---|---|---|---|---|
| v1 corpus 0-299, `generate(i)` and `generate(i, 1)` | `d01abbd8` | `d01abbd8` | `d01abbd8` | `d01abbd8` |
| goldens 239 / 917 / 935 / 3827 / 5363 | a05a623c / eb373575 / 546a69c0 / b1f50ecb / 63599476 | identical | identical | identical |
| daily 0..364 combined | `ff12d7b5` | `ff12d7b5` | `ff12d7b5` | `ff12d7b5` |
| daily 0 / 2450 / 9999 | Circle 4e61968e / Plus 63f8d4a5 / Diamond d313105a | identical | identical | identical |
| **v2 fresh corpus 0-299, `generate(i, 2)`** (pinned) | `ec15f0f7` | `ec15f0f7` | **`e802f80a`** | `e802f80a` |
| v2 fresh shape sequence 0-99,999 | `62978d37` | `62978d37` | `62978d37` | `62978d37` |
| **v2 existing-player corpus, `generate(i, 2, { switchLevel: 1 })`** (new pin) | n/a | `dbe91425` | **`d5005b0d`** | `d5005b0d` |
| v2 existing-player shape sequence 0-99,999 | n/a | `54f68561` | `54f68561` | `54f68561` |

- **Part 1 did not change a fresh install's v2 boards.** S400 was already the placeholder; part 1 makes
  it the owner's pick and adds the existing-player variant.
- **Part 2 changed the v2 pin, deliberately:** `ec15f0f7` -> `e802f80a`. The exact RNG re-deals 678 of
  levels 0-2999 (fresh) and 673 (existing) (EXECUTED `scripts/changed.ts`, part 1 tree vs part 2 tree; `logs/p2-changed.txt`). No shape moves:
  the bag's order is unchanged, because bag seeds are at most MSEED, where both RNG classes draw the same
  stream (tested). The existing-player pin also moved with the re-measured floor (333 -> 335).
- **Part 3 changed no board:** every value in the last two columns is identical, including both shape
  sequences over 100,000 levels.
- The daily year `ff12d7b5` is now a test (`dailyBoard.test.ts`); it was only ever computed in scratch
  before (W3-05, W3-10, W3-14). See part 2's mutation P2-M6 for why.

## Part 1: S400 is the curve, and existing players get a v1 floor

### What it does

- **`V2_CURVE` is S400, as the owner's pick.** `// OWNER PICK 2026-09-26 (W3-16, docs/curve-candidates-2026-09-26.md)`.
  The table itself is unchanged (88 cells at bias 3 on level 1, base 339 at displayed level 400, flat
  after). The other candidates stay only in the probe (`--candidates`) and the doc.
- **The floor.** `Difficulties.configV2(d, i, curve, v1Floor)`. With `v1Floor`, base cells are at
  least `V1_FLOOR_BASE_CELLS` (335: Normal 335, Hard 509, Super Hard 601) and the bias at most 1.
  - `hasV1Floor(switchLevel)` is true for a switch level above 0 (`generatorVersion.ts`).
  - `generate(i, 2, { switchLevel })` deals it. `shapeNameForLevel(i, version, switchLevel)` matches it.
  - An existing player's bag is built from the floored targets
    (`curveWindowMaxTarget(V2_CURVE, true)`), so it only deals shapes that hold them.
  - The board is a pure function of (level index, switch level): below the switch it is v1's; at or
    above it, every switch level above 0 deals the same floored board (tested); switch 0 deals S400.
- **The fold.** `campaignShapeName` passes the switch level (`saveSystem.ts`), so the collection
  records the board that was actually dealt.

### How "v1's size for that tier" is computed (decision 1)

- **v1's size per tier is one number: its median arrows over displayed levels 1-3000.** That is the
  owner's unit ("v1's arrow median"). v1 is flat by construction (`Difficulties.config(d)` never reads
  the level). The 300-level bands move only by noise: Normal 82-85, Hard 122-128, Super Hard 148-155.
  Result: **83 / 125 / 150** (n = 2000 / 500 / 500, the probe's p50).
- **Converted to v2's unit by measuring v2's own boards.** v2 sizes by cells, not arrows. The floor is
  the smallest base cells on S400's texture (83 : 126 : 149) whose v2 boards reach every tier's v1
  median arrows, with every larger base up to the ceiling passing too. The boards come from a flat curve
  at that base, neutral bias, v2's own bag and sizing, levels 1-3000.
- **Script:** `npm run analysis:probe -- --version 2 --v1-floor` (prints the band table, the scan
  320-339 and "src/core/curve.ts holds N (matches)").
- **It moved with part 2** (it measures v2's boards, which the exact RNG re-deals):

| stream | smallest base passing | its median arrows N / H / SH | S400 reaches it at | output |
|---|---|---|---|---|
| legacy port (part 1) | 333 | 84 / 125 / 150 | displayed level 391 | `artifacts/V2-FINISH/p1-v1-floor.txt` |
| exact RNG (part 2, shipped) | **335** | 83 / 125 / 150 | displayed level 394 | `artifacts/V2-FINISH/p2-v1-floor.txt` ("holds 335 (matches)") |

- **It is inert from the ceiling on.** 335 <= 339, so max(S400, floor) is S400 from displayed level
  394, and the bias is neutral from 400. Tested: the floored config equals the fresh config at indices
  399, 400, 401, 999, 1000, 4999 and 100,000, every tier. Numbers, final state: at displayed levels
  2-399 the existing player's boards have median arrows 83 / 125 / 151 against v1's 83 / 125 / 150
  (`--switch-report`). S400's ceiling config (a flat 339 curve, `--v1-floor` row 339) deals
  83 / 126 / 151.

### The switching table with the floor (EXECUTED, `--switch-report`)

W3-14's (g): v2 / v1 median of the cycle-median scan proxy, from the cycle holding L. Resolution: the flat
curve's own block-to-block noise is 34.3% over 60 levels and 6.3% over 300 (W3-14).

Final state (exact RNG, floor 335; `artifacts/V2-FINISH/p2-switch-report.txt`):

| switch at L | window | v1 scan | fresh v2 / v1 | **existing v2 / v1 (with the floor)** |
|---|---|---|---|---|
| 2 | 60 levels | 185 | 0.23 | **0.94** |
| 2 | 300 levels | 184 | 0.38 | **0.94** |
| 12 | 60 / 300 | 184 / 184 | 0.23 / 0.39 | **0.91 / 0.94** |
| 40 | 60 / 300 | 185 / 185 | 0.28 / 0.48 | **0.94 / 0.94** |
| 100 | 60 levels | 211 | 0.31 | **0.82** |
| 100 | 300 levels | 185 | 0.58 | **0.94** |
| 400 | 60 levels | 198 | 0.86 | **0.91** |
| 400 | 300 levels | 198 | 0.90 | **0.89** |
| 1000 | 60 levels | 202 | 0.81 | **0.85** |
| 1000 | 300 levels | 193 | 0.88 | **0.89** |

After part 1 (legacy stream, floor 333; `p1-switch-report.txt`): existing / v1 = 0.92 / 0.91 / 0.92 /
0.85 / 1.07 / 0.92 (60 levels) and 0.94 / 0.93 / 0.94 / 0.95 / 0.96 / 0.94 (300 levels). Its fresh column
reproduces W3-14's (g) exactly (0.23 / 0.23 / 0.28 / 0.33 / 1.00 / 0.89), which cross-checks the new mode.

- **Below the ceiling the floor lifts the proxy from 0.23-0.58 to 0.94.** It is not 1.0 or above, as
  the brief expected. See Concern 1 for why and what would close it.
- **At or above the ceiling (L = 400, 1000) the floor is inert.** Fresh and existing boards there are the
  same S400 config; both sit at about 0.89 of v1 on this proxy.
- **Other checks (EXECUTED, same run):**
  - The heaviest existing-player board over indices 0-99,999 every 7 (14,286 boards) is 191 arrows. None
    is over `ARROW_CEILING` 250. On the legacy stream (part 1) it was 238.
  - 42-47% of floored boards per tier fall below v1's median; v1's own share is 49.6-49.8%.

### TDD (EXECUTED)

- **RED 1:** the tests came first. `npx jest v1Floor saveSystem.genVersion` failed to compile with 25
  errors (`logs/p1-red.txt`): no `V1_FLOOR_BASE_CELLS`, no `hasV1Floor`, 12 x `switchLevel` not in
  `V2Knobs`, 5 x `shapeNameForLevel` arity, 4 x `configV2` arity, the fold spy's third argument.
- **RED 2:** with only the type surface (floor ignored, `hasV1Floor` false), **15 failed / 20 passed**
  (`logs/p1-red2.txt`), each for the right reason. For example: `hasV1Floor(1)` was false; the floored
  Normal target at level 50 was 119, not above it; the fold was asked `[50, 2]`, not `[50, 2, 41]`;
  `switchLevel: -1` did not throw; the owner-pick marker was missing. The 20 that passed pin what was
  already true (S400's table, v1 below the switch).
- **GREEN:** 35 / 35, then the existing-player corpus pin was added (36).
- **Mutations (EXECUTED, `scripts/mutate.py` in an isolated copy of `src/core` with a symlinked `node_modules`; every restore compared
  byte-identical with the working tree; `artifacts/V2-FINISH/mut-p1.jsonl`): 8 of 8 caught.**

| mutation | failing tests (of 36) |
|---|---|
| P1-M1 the floor keeps the curve's easing bias | 2 (floored config; existing corpus pin) |
| P1-M2 the floor lowers (min, not max) | 18 |
| P1-M3 the bag ignores the floor | 9 (incl. both fold tests) |
| P1-M4 the fold drops the switch level | 4 |
| P1-M5 a fresh install (0) gets the floor | 7 |
| P1-M6 the floored window max reads the fresh targets | 4 |
| P1-M7 the shape lookup ignores the switch level | 10 |
| P1-M8 the floor applies to Normal only | 3 |

The brief's fresh vs existing table is `v1Floor.test.ts` `describe.each([1, 50, 100, 399, 400, 1000])`
(18 tests). Displayed level 1 is always v1 for an existing player (their board 0 stays v1).

## Part 2: an exact int32 RNG for v2

### Choice (decision 7)

`ExactDotNetRandom` in `dotnetRandom.ts`: .NET's algorithm line for line, with C#'s unchecked int32
arithmetic. The state is an `Int32Array`, so a store wraps like a C# `int` assignment, and every local
subtraction is `| 0`.

- **Why not a new PRNG:**
  - It stays .NET's stream: the file's stated purpose is parity with Unity's `new Random(seed)`.
  - It keeps full-range `seed(i)`, and the target stays "the level stream's first draw".
  - It leaves the bag's order untouched. For |seed| <= MSEED it is the same stream as the port.
  - The API is the same and there is no dependency.
- **Who uses it:** v2 only, through `generateV2` (the target, `fillMask`, the clearable-bias pick) and
  the bag's shuffle.
- **Who does not:** v1 (`generateV1`, `buildFromShape`) and the daily keep the frozen `DotNetRandom`.
  Its header comment ("all intermediate values stay well inside 2^31") was false; it now says where it
  is exact and that it is frozen. `fillMask`'s `rng` parameter is widened to a `LevelRng` interface
  (types only).
- **`bagSeed` keeps its reduction to <= MSEED** (decision 8), so every window's order is W3-10's.

### Proof

- **(a) Equal to .NET System.Random, including |seed| > MSEED** (EXECUTED, `dotnetRandom.test.ts`):
  - **The reference.** `ReferenceNetRandom` is a literal transcription of .NET's `Random(int Seed)`,
    `InternalSample()`, `Sample()` and `Next(int, int)`. Every C# `int` `+`/`-` is modelled with
    `BigInt.asIntN(32, ...)`, so it shares no code with either JS class.
  - **The sample.** 6,015 seeds: 15 edge seeds (0, ±1, around ±MSEED, ±1e9, ±2147483647, -2147483648),
    2,000 campaign `seed(k * 37)`, 2,000 `bagSeed(k)` and 2,000 LCG-spread seeds. 3,693 of them have
    |seed| > MSEED.
  - **The draws.** 200 draws each, `nextDouble` interleaved with `next(4, 7)`: every draw is equal.
  - **The state.** The seeded state equals the reference's for the edge and 200 spread seeds.
  - **Positive control.** The legacy port differs from the reference on 2,339 of the 6,015 seeds, and
    leaves [0, 1) on 939 of them within 200 draws. Int32.MaxValue is hand-traced in a comment:
    SeedArray[55] = MSEED - 2147483647 = -1985680249, which pass 1's i = 24 subtracts, i.e. adds,
    overflowing int32.
  - **Seed 0.** The first five doubles, derived by running the reference, are 0.7262432699679598,
    0.8173253595909687, 0.7680226893946634, 0.5581611914365372, 0.2060331540210327. All three classes
    agree on them. I recall this as the commonly quoted .NET `Random(0)` sequence, but a web search found
    no citable page, so the proof rests on the transcription, not on that.
- **(b) No draw leaves [0, 1)** (EXECUTED, `npx tsx scripts/analysis/rng-exactness.ts`,
  `artifacts/V2-FINISH/p2-rng-exactness.txt`):

| class | seeds | draws | seeds with a draw outside [0, 1) | draws outside | seeds with state outside [0, MBIG) | min / max draw |
|---|---|---|---|---|---|---|
| ExactDotNetRandom (v2) | campaign `seed(i)`, i < 1,000,000 | 50,000,000 | **0** | **0** | **0** | 4.19e-9 / 0.99999997 |
| ExactDotNetRandom (v2) | `bagSeed(w)`, w < 100,000 | 5,000,000 | 0 | 0 | 0 | 4.0e-7 / 0.99999996 |
| DotNetRandom (control) | campaign `seed(i)`, i < 1,000,000 | 50,000,000 | 232,743 | 1,178,561 | 266,367 | -12.06 / 12.58 |
| DotNetRandom (control) | `bagSeed(w)`, w < 100,000 | 5,000,000 | 0 | 0 | 0 | same as exact |

  The state column is the stronger claim. `InternalSample` subtracts two values of [0, MBIG), and adds
  MBIG to a negative result, so the new value is again in [0, MBIG). So a seed whose seeded state is in
  range draws in [0, 1) forever, not only for 50 draws. The control's 23.3% matches W3-10's 4,651 of
  20,000. A 200,000-seed version of the state check is a jest test.
- **(c) v1 and daily unchanged:** see Fingerprints (EXECUTED at every part). Mutations P2-M5 (v1 on the
  exact stream) and P2-M6 (the daily on the exact stream) are both caught.
- **v2 really draws from it** (EXECUTED): for 16 levels, 12 of them seeds whose legacy stream leaves
  [0, 1), fresh and floored, `generate(i, 2)` is exactly a rebuild with `ExactDotNetRandom(seed(i))`: its
  first draw is the target, then `fillMask` with the bias. The same rebuild with the port differs on more
  than 10 of the 32.

### TDD (EXECUTED)

- **RED 1:** `TS2724 '"../dotnetRandom"' has no exported member named 'ExactDotNetRandom'`.
- **RED 2:** a stub (the port under the new name) gave **5 failed / 4 passed** (`logs/p2-red2.txt`).
  - The overflow seed differed from the reference.
  - 2,341 stream mismatches.
  - 181,083 out-of-range state values over 200,000 seeds.
  - The state differed from the reference.
  - The v2 rebuild control found 0.
  - The 4 that passed pin what must hold both before and after: the in-range equality, the legacy
    detector's control, and the bag's in-range draws.
- **GREEN, first attempt: 8 / 9.** The v2-consumption test's positive control counted 0 legacy
  differences. Root cause: most divergent legacy streams differ from .NET by only a few units in 2^31
  (for example 0.0421902393 against 0.0421902365), which almost never changes a pick. The control now
  uses seeds whose legacy stream actually leaves [0, 1). GREEN 9 / 9.
- **The pins then failed as expected** and were re-pinned: `levelGenerator.test.ts` v2 pin
  `ec15f0f7` -> `e802f80a`, and `v1Floor.test.ts` existing pin `dbe91425` -> `d5005b0d` (with the floor
  333 -> 335).
- **Mutations (EXECUTED; `mut-p2.jsonl`, `mut-p2b.jsonl`):**

| mutation | result |
|---|---|
| P2-M1 `generateV2` draws from the frozen port | caught (3: both v2 pins, the rebuild test) |
| P2-M2 no int32 wrap in the mixing pass | caught (4) |
| P2-M3 no `| 0` in `InternalSample` | **survives: equivalent on every v2 seed.** The scan shows every v2 state in [0, MBIG), where that subtraction cannot overflow, so `| 0` is a no-op. It only matters for a seeded state holding both MBIG and -1, which no scanned seed has. It is kept because it is .NET's semantics. |
| P2-M4 Int32.MinValue takes `Math.abs` | caught (2: the edge seed -2147483648) |
| P2-M5 v1 draws from the exact stream | caught (6: goldens and corpus) |
| P2-M6 the daily draws from the exact stream | **survived the three daily goldens (days 0, 2450, 9999 happen to be unaffected), so I added the year pin `ff12d7b5`**; rerun: caught (1) |

## Part 3: a warm first pick

### What it does

- **A checked-in capacity table.** `src/core/shapeCapacityTable.ts` is generated by
  `npx tsx scripts/analysis/capacity-table.ts --write`; without `--write` the script diffs against the
  checked-in file: "IDENTICAL".
  - It holds the 26 catalogue capacities at 46 x 37 plus the clamp it was made for.
  - `shapeCapacity` serves it for the catalogue's own ShapeDef instances at the shipped clamp. It is
    keyed by ShapeDef: ids are resolved with `shapeDefFor`.
  - Any other caps or ShapeDef still rasterize (`rasterizedCapacity`).
  - `coldPick.test.ts` recomputes every entry by its own rasterization, and fails if the clamp constants
    move.
- **O(1) windows once the curve stops changing** (`shapeBag.ts` `SteadyBag`).
  - `curveWindowMaxTarget` registers its curve's last row, and the placeholder registers 0.
  - The first window that starts at or after that index and is at least one tier cycle long (6) fixes
    the set and length for every later window. The proof is in the code comment: for k >= 6 the window
    max is the same number for every such start, so `windowSetAt` returns the same k and set.
  - Window `first + m` starts at `first.start + m * length`, is its own shuffle, and swaps against the
    previous window's own last shape. The swap moves only positions 0 and 1, and length >= 6.
  - The ramp before it is still built window by window: 20 windows fresh, 28 existing.
  - A steady length under 6 (possible on a synthetic curve) stays sequential.

### Before and after (EXECUTED)

- **First pick at level index 20,000** (`scripts/rastercount.ts`):
  - BASE and part 2: **26 rasterizations and 1,326 windows built**.
  - Part 3: **0 and 20** (steady from ordinal 19, start 405, length 15).
- **Timing:** see Performance below. The cold first pick under `--jitless` falls from about 150-200 ms
  to about 1-2 ms.
- **No board changed:** both v2 pins and both 100,000-level shape sequences are identical before and
  after (Fingerprints).
  - `coldPick.test.ts` compares the O(1) path with a forced sequential build of the same curve for
    every window over levels 0-30,000: fresh, floored and the placeholder.
  - It also compares 400 random-order deep lookups up to 60,000.
  - A synthetic 2-shape curve stays sequential.
  - Level 5,000,000 resolves with fewer than 60 windows built.

### TDD (EXECUTED)

- **RED 1:** 3 compile errors: `TS2307 Cannot find module '../shapeCapacityTable'`, and `bagWindowStats`
  missing twice.
- **GREEN:** 11 / 11.
- **Mutations: 6 of 6 caught** (`mut-p3.jsonl`, `mut-p3b.jsonl`).
  - My first P3-M2 (`if (false && ...)`) did not compile. I replaced it with dropping the steady
    assignment.

| mutation | failing tests (of 107) |
|---|---|
| P3-M1 `shapeCapacity` ignores the table | 2 |
| P3-M2 the steady state never engages | 5 |
| P3-M3 the steady swap reads the wrong previous window | 7 |
| P3-M4 steady accepts windows shorter than a tier cycle | 1 |
| P3-M5 steady starts before the curve stops changing | 8 |
| P3-M6 a steady window starts one level late | 17 |

## Performance (owner rule: nothing gets slower)

Node v20.19.4 on the shared Mac; load average 6-18 during the runs (other sessions). One core module
per process (`artifacts/V2-FINISH/scripts/`). Raw data: `gen.jsonl` and `cold.jsonl`; tables:
`timing-gen.md` and `timing-cold.md`.

**Generation per level** (`run-gen.sh` + `gen-proc.ts`):
- **Arms:** BASE (`32594e7`), P1, P2 and P3 (the tree after each part).
- **Rounds:** 4 rounds with the arm order rotated each round, so 4 processes per arm per region.
- **Per process:** levels × 3 reps, series alternating per level: v1; v2 fresh; v2 existing
  (`switchLevel: 1`, not in BASE). The per-level value is the minimum over the reps.
- **Reconciliation:** every process made exactly 600 × 3 × series calls (3600 or 5400; the script
  asserts it; all 32 did).
- Figures are the median of the per-process medians [min-max], in ms.

| series | region (indices) | BASE | P1 | P2 | P3 | reading |
|---|---|---|---|---|---|---|
| v1 | 0-599 | 2.499 [2.481-2.537] | 2.502 [2.494-2.522] | 2.522 [2.507-2.550] | 2.513 [2.503-2.529] | unchanged: ranges overlap. W3-14 measured 2.2% spread for identical v1 code across arms. |
| v1 | 3000-3599 | 2.440 [2.413-2.452] | 2.448 [2.425-2.466] | 2.452 [2.445-2.474] | 2.447 [2.440-2.455] | unchanged (overlap) |
| v2 fresh | 0-599 | 2.029 [1.993-2.035] | 2.018 [2.007-2.025] | 1.992 [1.980-2.006] | 1.997 [1.978-2.006] | never slower; P2 deals 2% fewer arrows (46,874 -> 45,847) |
| v2 fresh | 3000-3599 | 2.447 [2.424-2.453] | 2.446 [2.415-2.477] | 2.365 [2.346-2.400] | 2.343 [2.329-2.351] | **-4% (disjoint)**; content, 63,188 -> 61,408 arrows |
| v2 existing | 0-599 | n/a | 2.467 [2.448-2.486] | 2.418 [2.384-2.443] | 2.413 [2.398-2.436] | new series: bigger than fresh (v1-sized boards), and below v1's 2.51 at the same levels |
| v2 existing | 3000-3599 | n/a | 2.457 [2.431-2.482] | 2.359 [2.339-2.382] | 2.339 [2.332-2.355] | at or below v1 (2.45) |

p95 moves the same way (`timing-gen.md`). For example, v1 over 0-599 is BASE 7.350 [7.274-7.568]
against P3 7.444 [7.381-7.510]: overlapping, so no change is claimed.
- **Nothing got slower.** v1 is unchanged within resolution.
- **v2 fresh** is never slower than BASE's v2, and is 4% faster at saturation (fewer arrows).
- **An existing player's v2** costs less than the v1 board it replaces at the same level.
- **The exact RNG's second class** (a polymorphic `fillMask` call site in processes that run both) shows
  no measurable cost on v1.

**The cold first v2 pick** (`run-cold.sh` + `cold-proc.ts`):
- Each measurement is a fresh process: the first `shapeNameForLevel(i, 2[, switchLevel])`, then the next
  pick, then `generate(i, 2)`.
- 3 processes per cell, arms interleaved; 90 records = 18 BASE + 36 P2 + 36 P3 (reconciled).
- Median [min-max], ms.

| mode | level index | install | BASE | P2 (before part 3) | **P3** | P3's first `generate` | 
|---|---|---|---|---|---|---|
| JIT | 0 | fresh | 20.96 [20.57-38.32] | 21.04 [20.67-72.05] | **0.79** [0.77-2.74] | 5.7 |
| JIT | 5000 | fresh | 26.64 [25.18-36.78] | 26.37 [25.16-30.88] | **1.92** [1.91-1.95] | 18.5 |
| JIT | 20000 | fresh | 36.92 [34.77-38.40] | 39.19 [36.47-55.67] | **1.88** [1.88-1.89] | 18.1 |
| JIT | 20000 | existing | n/a | 36.89 [33.51-54.24] | **2.15** [2.09-2.28] | 20.1 |
| `--jitless` | 0 | fresh | 161.46 [149.58-219.65] | 156.58 [155.68-164.98] | **0.69** [0.65-0.72] | 9.5 |
| `--jitless` | 0 | existing | n/a | 157.69 [149.33-158.92] | **0.77** [0.73-0.81] | 27.3 |
| `--jitless` | 5000 | fresh | 165.74 [161.43-170.88] | 162.40 [159.50-177.27] | **1.63** [1.56-2.39] | 44.1 |
| `--jitless` | 5000 | existing | n/a | 205.40 [167.65-250.20] | **2.20** [2.14-2.24] | 47.9 |
| `--jitless` | 20000 | fresh | 203.80 [199.83-262.19] | 200.01 [197.83-241.15] | **1.84** [1.65-2.02] | 42.5 |
| `--jitless` | 20000 | existing | n/a | 203.18 [197.46-232.37] | **2.11** [1.98-2.22] | 51.2 |

- **The target, under 5 ms `--jitless`, is met:** the worst cell is 2.20 ms (max 2.39 ms over all 18
  P3 `--jitless` processes).
- **Pick plus board, the whole first level swap under `--jitless` at 20,000:** 200 + 42 = 242 ms before,
  1.8 + 42.5 = 44 ms after.
- **The first `generate` is up to 3 ms slower in P3 under JIT** (level 0: 5.7 against 2.7 ms). The old
  cold pick had already warmed `rasterize` (26 calls) before the board was built; now the board's own
  probe raster is the first. The sum still falls from 23.7 to 6.5 ms.
- **Hermes:** W3-10 projected the old cold pick at about 130 ms. It is now about 1% of that
  (INFERRED from `--jitless`; UNVERIFIED-DEVICE).

## Gates (final, EXECUTED)

- `npx tsc --noEmit`: exit 0 (BASE: exit 0).
- `npx jest`: **102 suites / 1630 tests, 12 snapshots, all passed** (BASE: 97 / 1535). Reconciled:
  - Mine: +3 suites (`v1Floor` 30, `dotnetRandom` 9, `coldPick` 11) and +3 tests in existing files
    (`saveSystem.genVersion` +2, `dailyBoard` +1). That is +53 tests. `levelGenerator` and `shapeBag`
    change assertions only.
  - The other agent's untracked `themeTransition.test.tsx` and `GameScreen.postClearTimeline.test.tsx`,
    plus their edits, account for the remaining +2 suites / +42 tests.
  - After part 1 alone: 99 / 1577, all passed.
- I made no `GameScreen.tsx` or `ads.tsx` edits; the ui project ran inside the full `npx jest`.

## Migration and wipe risk

None. No persisted key is read, written or added. `SaveSystem.PersistenceKeys` is untouched. The fold
now also reads the existing `arrows_gen_switch_level`, only to pass it to `shapeNameForLevel`. While
`GEN_V2_ENABLED` is false it is never stamped, so the fold asks v1 everywhere, as before. No save
records a v2 board.

## Decisions

1. **The floor's unit and computation.** The unit is arrow medians, the owner's words. It is converted to
   v2 cells by measuring v2's own boards (see part 1): one value per tier, since v1 is flat, expressed as
   base cells on the curve's texture. It is re-measured whenever v2's boards change; it moved in part 2.
   A per-band table was rejected: v1's band medians are noise, and a noisy floor could fall between bands,
   which breaks the bag's non-falling-target rule.
2. **Existing players get a neutral bias** (`min(curve, 1)`). The rule is "never easier than v1 on either
   knob", and the calibration measured neutral boards. S400's bias is 1 from its ceiling on, so this
   only matters below it.
3. **Max semantics.** The floor can never lower a board (tested over indices 0-2999 x 3 tiers), and it
   is inert from the point where the curve passes it.
4. **An existing player's bag is its own deal from level 0** (floored window targets). So past the
   ceiling their shapes differ from a fresh install's even though the configs are equal. The board is
   still a pure function of (level, switch level).
5. **`switchLevel` is a `V2Knobs` field.** 0, null or unset means a fresh install; this is also what the
   DEV/PERF forced-v2 paths get. v1 accepts and ignores it, because it is install context, not a content
   override. A negative or fractional value throws.
6. **No UI wiring.** The brief forbids `src/ui/*`. A core tripwire test reads
   `src/ui/gameSessionLifecycle.ts` and fails if `GEN_V2_ENABLED` is true while `createLevelSession`
   calls `LevelGenerator.generate` without `switchLevel` (Concern 3).
7. **An exact .NET variant, not a new PRNG.** See part 2.
8. **`bagSeed` keeps its reduction**, so no window's order moves.
9. **The daily year is pinned** (`ff12d7b5`), because P2-M6 showed the three goldens could not see a
   daily RNG swap.
10. **The capacity table is keyed by catalogue id in source** (readable, diffable) and resolved to
    ShapeDef instances at load. A mismatched clamp disables it, falling back to rasterizing, and fails a
    test.
11. **The ramp stays sequential** (20 / 28 windows). It costs about a millisecond under `--jitless`, so
    precomputing it too would add a second table to keep in sync for no measurable gain.
12. **Numbers in code.** `V1_FLOOR_BASE_CELLS` is MEASURED, and its comment names the probe command. The
    probe's scan start (320), band (300) and range (1-3000) are labelled "Method". No OWNER-PICKED value
    was added.

## Concerns

1. **The switching proxy is about 0.9, not "about 1.0 or above".** The floor does what the owner's rule
   says: floored boards match v1's per-tier arrow medians (83 / 125 / 151 against 83 / 125 / 150). But
   the scan proxy still puts them at 0.94 of v1 over 300 levels, and S400's own ceiling (where the floor
   is inert) at 0.89. Two causes, measured:
   - (a) **Shape mix.** v2 deals the 15 plain-ish shapes that hold 601+ cells, not v1's picture pool.
   - (b) **The RNG defect inflates v1** (Concern 2).

   Closing the gap means boards bigger than v1's arrow median, i.e. a floor and ceiling above S400's 339.
   That is an owner call: a) accept about 0.9; b) re-measure the ceiling on the exact stream (below)
   and raise the floor to the scan-matched size; c) other.
2. **The port defect inflated v1's boards and W3-14's ceiling evidence** (EXECUTED,
   `artifacts/V2-FINISH/p2-defect-analysis.txt`).
   - **v1:** the 23% of v1 levels whose legacy stream leaves [0, 1) carve shorter arrows. Their median
     arrows are 88 / 142 / 162 against 81 / 122 / 148 for the rest (3.5-3.7 against 4.0 cells per arrow).
     v1 is frozen, so its medians, and the floor calibrated to them, keep that inflation.
   - **v2:** on the exact stream, v2's heaviest board over indices 0-99,999 every 7 drops from **238 to
     190 arrows**, and the p99 from 199 to 165.
   - **The ceiling is now stale.** `CEILING_BASE_CELLS = 339` was measured against 250 arrows on the
     legacy stream. EXECUTED on the exact stream, `npm run analysis:probe -- --version 2 --ceiling`
     (`artifacts/V2-FINISH/p2-ceiling-exact-rng.txt`) passes **every scanned value up to 370**:
     - 370 deals at most 201 arrows neutral and 210 at b = 0.3;
     - the scan no longer brackets;
     - the probe's own check prints "holds 339 (DIFFERS: update it)".
   - **I did not change it.** Those cells are S400, the owner's pick. The constant's comment in
     `curve.ts` now records the above.
   - **Recommendation:** a follow-up that extends the scan past 370, then re-runs `--v1-floor` and
     `--switch-report`.
3. **UI wiring before W3-21.** `createLevelSession` must call
   `LevelGenerator.generate(index, version, { switchLevel: SaveSystem.genSwitchLevel })` for campaign
   boards (the DEV/PERF forced paths may keep passing nothing). Until then a flag flip would deal every
   existing player the fresh ramp. The tripwire test in `v1Floor.test.ts` fails if the flag flips first.
4. **Per board, "never below v1's median" cannot hold.** Board sizes vary about their target, as v1's
   own do (v1's p25 is 74 / 114 / 136). The floor is on the target: 42-47% of floored boards per tier
   are below v1's median, against v1's own 50%.
5. **Anything that changes v2's boards must re-run `--v1-floor`.** That includes W3-18's shapes, a clamp
   change and a ceiling change. The test pins 335 and the probe prints "matches" or "DIFFERS".
6. **Timing ran on a shared, loaded Mac** (load 7-18, from other sessions). Comparisons are within rounds
   from per-process medians. Hermes and iOS are unmeasured: `--jitless` is the interpreter proxy (W3-10),
   and the device figure is UNVERIFIED-DEVICE.
7. **The proxy is a proxy.** "Search-cost proxy for a uniform-sampling player. Not a measurement of human
   difficulty; never correlated with real mistakes (see W3-23)."

## Owner questions

1. **The existing-player floor lands at 0.94 of v1 on the scan proxy below level 400, and S400 at 0.89
   after it.**
   - a) Accept.
   - b) Re-measure the ceiling on the exact RNG (every base up to 370 now stays at or under 210 arrows,
     against the 250 cap), then decide whether S400's ceiling cells, and with them the floor, should
     rise until the proxy reaches 1.0.
   - c) Other.

   **Recommendation:** b, as a small follow-up before W3-21. The arrow-median floor already meets your
   words. The proxy gap is largely the RNG defect's inflation of v1, and the 250-arrow cap no longer
   binds at 339.

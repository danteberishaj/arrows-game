# Level-1 sweep: the whole first session and the level-1 candidates on one table (W3-12)

Measured 2026-09-26 on branch `next-level`, base `1d31dd8` (W3-11), plus W3-12's probe change (`--start-sweep`,
`--tutorial`, `--targets` in `scripts/analysis/difficulty-probe.ts`). Every number below is EXECUTED output of:

```
npx tsx scripts/analysis/difficulty-probe.ts --start-sweep --targets 88,145
npx tsx scripts/analysis/difficulty-probe.ts --tutorial T1 --tutorial T2
npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1
```

(`npm run analysis:probe -- <flags>` is the same command.) The tables are pasted from that output by a script,
not retyped. Raw outputs, the `--json` form and the screenshot scripts are in `artifacts/W3-12/` (untracked).

> **The probe's honesty bound:** "Search-cost proxy for a uniform-sampling player. Not a measurement of human
> difficulty; never correlated with real mistakes (see W3-23)." Nothing here measures how hard a board feels to a
> person (W3-17) or how it looks (the screenshots are for that).

**Status.** Measurement only. No generator code changed: v1's corpus fingerprint stays `d01abbd8` and v2's neutral
pin stays `04d0ec7e`. This doc does not pick a row. W3-13 is the owner's pick.

## At a glance

- **The first session today, in play order.**
  - T1: 6 arrows, all 6 clearable at deal, blocked 0.
  - T2: 5 arrows, exactly 1 clearable at deal, blocked 2.7.
  - v1 level 1: Circle 20×20, 60 arrows, 31.7% clearable, **blocked 81.5**. The brief's "82" is this value rounded
    by the rows mode.
  - v1 levels 2–5: blocked 70.3, 138.2, 98.5 and 99.2.
- **The stack, measured.** W1-06's assist charges no heart for a blocked tap before a board's first removal. On this
  proxy that forgives only the deal state's wrong looks, which is `(n−k)/(k+1)`:
  - v1 level 1: 2.0 of its 81.5 (79.5 remain after the first removal);
  - every level-1 candidate: 0.0 to 1.9.
  - So the assist and a smaller level 1 barely overlap on this proxy. The size of level 1 carries almost all of
    the change. What the assist does for a real first-time player is W3-17's question, not this table's.
- **Candidates: 572 rows** (26 shapes × rows 6–16 × b ∈ {unset, 3}), n = 5 seeds each.
  - 571 of 572 have a median blocked count below v1 level 1's 81.5.
  - The exception is `unset/16/Rectangle`: 16×24, 93 arrows, blocked 92.9.
- **Size is the main lever.** Pooled over the 26 shapes, median blocked is:
  - unset: 1.5 at 8 rows, 5.9 at 12 rows, 12.8 at 16 rows;
  - b = 3: 0.6, 3.9 and 10.0.
- **At fixed rows the shape swings the numbers widely.** At 12 rows unset, per-shape median blocked runs from 0.8 to
  39.0, because the shapes hold 14 to 216 cells at 12 rows.
- **v2 sizes by cell target, not by rows.** At a fixed target, the spread over all 26 shapes is much narrower (the
  "cell target" table):
  - 88 cells: blocked 9.1 [6.0–12.8] unset, 5.7 [2.3–9.6] at b = 3;
  - 145 cells: blocked 18.2 [12.7–22.6] unset, 12.8 [7.1–22.1] at b = 3.
- **Legibility.** Every candidate row is at least 14.1 pt per cell at 360 dp (at most 24 columns), above W3-09's
  9.1 pt floor. At the 145-cell target, the thinnest shape (Bolt) grows to 41×33 at 10.3 pt, still above the floor
  and within 37 columns. No row carries the floor flag. The flag's positive control is under "Method".
- **Rows 6–7 are not dealable by v2.** They are below `V2_MIN_GRID_ROWS` = 8, and all 104 of those rows are
  flagged. They stay in the table because the brief's grid (and the red team's) starts at 6.
- **Bias.** Only b = 3 appears, because it is the only W3-11 grid value inside the brand gate.
  - The owner's look yes/no on b = 3 (W3-11 owner question 1c: "a milder rim fringe") is still open.
  - Every b = 3 row depends on that answer.
- **The shape is not part of the pick.** v2's bag chooses level 1's shape. A row sets a cell target and a bias. See
  "Shapes and the bag".

## Pre-fix reproduction (brief verification step 1)

`npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1` gives `| 1 | 0 | Normal | Circle | 20×20 |
264 | 60 | 266 | 19 | 31.7% | 142 | 82 | 2 | 39/10 | 66.7% | 4.40 |`. That is 60 arrows, 31.7%, scan 142 and
blocked 82, as the brief says. The unrounded values are scan 141.5 and blocked 81.5, which the sweep prints.

## Method

- **The walk.** Every row, including T1, T2 and the v1 levels, uses the probe's one walk (`walkBoard`): remove the
  first clearable arrow in `board.arrows()` order until empty, and sum the uniform-sampling cost over every state:
  - scan: `(n+1)/(k+1)`;
  - blocked: `(n−k)/(k+1)`, where n = arrows left and k = clearable now.
  - The walk asserts that each board clears in exactly `arrowCount` removals.
- **Tutorial rows** come from `buildTutorialLevel` (W1-02's `BoardLogic.parse` lines). The generator is not called.
- **Candidates.** For each candidate, the board is built as follows:
  - shape: every bag candidate, which is `SHAPE_CATALOGUE` minus `RETIRED_SHAPE_IDS` (the retired set is empty),
    so all 26;
  - size: rows 6–16 and `cols = v2Cols(rows, aspect)`;
  - Normal config (level 1 is Normal), plus `clearableBias` b;
  - the shipping `fillMask` with `DotNetRandom(s)` for s = 1..5.
  - An empty raster would fall back to the full grid, as `buildV2` does, and be flagged. None occurs in rows 6–16.
- **Row id.** A row's id is `<bias>/<rows>/<shape>`, for example `b3/12/Circle`.
- **Statistics.** n is printed on every row (5 for candidates, 1 for fixed boards).
  - Cells show the probe's median, which is the true middle value at n = 5, with the seed [min–max].
  - "blocked mean" is the plain mean, because the red team quoted means.
  - "median seed" is the lowest seed whose blocked count equals the row median. That is the board a screenshot
    shows.
- **blocked@deal** is the deal state's `(n−k)/(k+1)`: the wrong looks W1-06's assist forgives. "blocked after 1st
  removal" is `blocked − blocked@deal`, what hearts pay for with the assist ON.
- **cellPt** comes from the shipping camera: `initialCamera(…, zoomed=false)` in `src/ui/boardCamera.ts`, the
  function `BoardView` fits with.
  - It is evaluated on the two board viewports W3-08 logged at runtime: 360×689 dp (a 360×780 dp phone) and
    411.43×804.29 dp (docs/board-legibility-2026-09-26.md).
  - The W3-09 floor is 9.1 pt, the owner's pick of 2026-09-26. On the camera that gives at most 37 columns at
    360 dp; the probe derives 37 from the camera rather than hard-coding it.
- **Flags.** A row is flagged for three things:
  - cellPt below 9.1 at 360 dp;
  - rows below v2's floor of 8;
  - a bias that did not pass W3-11's brand gate.
  - Positive controls (EXECUTED): `--rows 40-40 --shapes Rectangle,Square` flags cellPt 7.4 and 8.5;
    `--biases 10 --rows 8-8 --shapes Circle` flags "b=10 did not pass W3-11's brand gate"; `--rows 1-2` flags the
    full-grid fallback on Bolt and Star.
- **The cell-target table (`--targets 88,145`).**
  - Every shape is sized to the target by a replica of `buildV2`'s own fit, then filled and walked the same way.
  - The script first checks the replica against `generate(i, 2)` rows×cols on v2 levels 0–299, and all 300 match.
  - Limit: those levels draw targets of 260–720, so the check never reaches the replica's 8-row floor branch. That
    branch is the same literal clamp (INFERRED).
  - 88 and 145 are the cell counts of the shortlisted 12- and 15-row Circles; see "Shortlist".
- **Admissibility.** The printed check:

  > Admissible shapes: the 26 bag candidates' smallest capacity at the clamp (V2_MAX_GRID_DIM = 46) is 202 (Bolt); the largest candidate board here holds 384 cells; candidate rows above their own shape's capacity: none.

  Every candidate row holds no more cells than its own shape's capacity at the clamp, so the bag's admission test
  excludes no shape from a level-1 target of that size. Two caveats:
  - W3-14's curve sets the rest of the level-1 window, and a window whose largest target exceeds 202 would drop
    Bolt.
  - Capacities are at `V2_MAX_GRID_DIM` = 46. W3-09's 37-column cap is not in the code yet.

## The red team's size-only figures, reproduced (acceptance)

The red team quoted "at 21 arrows blocked = 8.8, at 38 arrows blocked = 32" for Circle, Square and Heart at rows
6–16 with 5 seeds (`docs/next-level/sources/redteam-evidence-15.json`). The unset Circle, Square and Heart rows of
this sweep are identical to W3-11's `--size-sweep --rows 6-16`: EXECUTED, 33 of 33 boards equal in cols, cells, arrow
mean, blocked mean, min and max, and clearable median (`artifacts/W3-12/probe/crosscheck-size-sweep.txt`).

| red-team figure | row (5 seeds) | arrows mean [min–max] | blocked mean; median [seed min–max] | inside the 5-seed band? |
|---|---|---|---|---|
| about 21 arrows, blocked 8.8 | unset/9/Square | 20.8 [16–24] | 11.0; 10.4 [8.0–17.3] | yes |
| about 21 arrows, blocked 8.8 | unset/10/Heart | 20.0 [18–21] | 12.1; 11.8 [7.3–15.7] | yes |
| about 38 arrows, blocked 32 | unset/12/Square | 37.6 [33–40] | 20.8; 19.7 [10.0–36.6] | yes |
| about 38 arrows, blocked 32 | unset/15/Heart | 40.8 [37–46] | 26.5; 23.5 [17.5–38.7] | yes |
| about 38 arrows, blocked 32 | unset/15/Circle | 36.8 [30–40] | 19.3; 21.2 [14.7–22.6] | **no**: 32 is above the band |

The figures are reproduced within the band for Square and Heart. Circle at 15 rows sits below 32, as W3-11 also
found; the red team's script is unpublished.

## 1. The first session, in play order

T1 and T2 are W1-02's authored boards. v1 L1 is the baseline row, and the "blocked < v1 L1" column compares every
other row with it.

| row | rows×cols | mask cells | n | arrows median [min–max] | arrows mean | clearable@0 median (%) | scan median | blocked median [min–max] | blocked mean | blocked@deal median | blocked after 1st removal median | cellPt 360 / 411 | median seed | blocked < v1 L1 | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 5×5 | - | 1 | 6 | 6.0 | 6 (100.0%) | 6.0 | 0.0 | 0.0 | 0.0 | 0.0 | 67.7 / 77.3 | - | yes | - |
| T2 | 5×5 | - | 1 | 5 | 5.0 | 1 (20.0%) | 7.7 | 2.7 | 2.7 | 2.0 | 0.7 | 67.7 / 77.3 | - | yes | - |
| v1 L1 | 20×20 | 264 | 1 | 60 | 60.0 | 19 (31.7%) | 141.5 | 81.5 | 81.5 | 2.0 | 79.5 | 16.9 / 19.3 | - | - | - |
| v1 L2 | 21×21 | 293 | 1 | 74 | 74.0 | 24 (32.4%) | 144.3 | 70.3 | 70.3 | 2.0 | 68.3 | 16.1 / 18.4 | - | yes | - |
| v1 L3 | 37×37 | 512 | 1 | 139 | 139.0 | 44 (31.7%) | 277.2 | 138.2 | 138.2 | 2.1 | 136.1 | 9.1 / 10.5 | - | NO | - |
| v1 L4 | 16×24 | 384 | 1 | 95 | 95.0 | 34 (35.8%) | 193.5 | 98.5 | 98.5 | 1.7 | 96.8 | 14.1 / 16.1 | - | NO | - |
| v1 L5 | 29×29 | 365 | 1 | 106 | 106.0 | 36 (34.0%) | 205.2 | 99.2 | 99.2 | 1.9 | 97.3 | 11.7 / 13.3 | - | NO | - |

W1-02 invariant T1 (every arrow clearable at deal): 6/6 clearable, holds
W1-02 invariant T2 (exactly 1 clearable at deal): 1/5 clearable, holds

## 2. For reference: generator v2 levels 1–5 as dealt today

These use the placeholder curve and are dark behind `GEN_V2_ENABLED`. They are not candidates. They show that v2
without W3-14's curve starts at 89 arrows.

| row | rows×cols | mask cells | n | arrows median [min–max] | arrows mean | clearable@0 median (%) | scan median | blocked median [min–max] | blocked mean | blocked@deal median | blocked after 1st removal median | cellPt 360 / 411 | median seed | blocked < v1 L1 | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| v2 L1 | 26×26 | 360 | 1 | 89 | 89.0 | 31 (34.8%) | 159.1 | 70.1 | 70.1 | 1.8 | 68.3 | 13.0 / 14.9 | - | yes | - |
| v2 L2 | 15×22 | 330 | 1 | 77 | 77.0 | 33 (42.9%) | 126.8 | 49.8 | 49.8 | 1.3 | 48.5 | 15.4 / 17.6 | - | yes | - |
| v2 L3 | 28×31 | 464 | 1 | 118 | 118.0 | 42 (35.6%) | 229.5 | 111.5 | 111.5 | 1.8 | 109.7 | 10.9 / 12.5 | - | NO | - |
| v2 L4 | 25×29 | 327 | 1 | 84 | 84.0 | 33 (39.3%) | 146.4 | 62.4 | 62.4 | 1.5 | 60.9 | 11.7 / 13.3 | - | yes | - |
| v2 L5 | 25×25 | 381 | 1 | 95 | 95.0 | 28 (29.5%) | 202.8 | 107.8 | 107.8 | 2.3 | 105.5 | 13.5 / 15.5 | - | NO | - |

## 3. Candidates by rows and bias, across the shape set

| rows | b | shapes x seeds | mask cells median [min–max] | cols | arrows | clearable@0 % | blocked | blocked@deal | blocked after 1st removal | cellPt 360 [min–max] | flagged shapes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | unset | 26 x 5 = 130 | 14 [4–54] | 4–9 | 5 [1–13] | 75.0 [46.7–100.0] | 0.5 [0.0–4.8] | 0.3 [0.0–1.0] | 0.2 [0.0–4.1] | 37.6–84.6 | 26 |
| 7 | unset | 26 x 5 = 130 | 25 [6–70] | 5–10 | 7 [3–16] | 75.0 [50.0–100.0] | 1.0 [0.0–6.6] | 0.3 [0.0–0.8] | 0.6 [0.0–5.8] | 33.8–67.7 | 26 |
| 8 | unset | 26 x 5 = 130 | 30 [4–96] | 6–12 | 8 [3–21] | 66.7 [40.0–100.0] | 1.5 [0.0–10.0] | 0.4 [0.0–1.3] | 1.0 [0.0–8.3] | 28.2–56.4 | 0 |
| 9 | unset | 26 x 5 = 130 | 40 [5–126] | 7–14 | 10 [1–31] | 64.3 [41.2–100.0] | 2.2 [0.0–15.4] | 0.5 [0.0–1.3] | 1.9 [0.0–14.6] | 24.2–48.3 | 0 |
| 10 | unset | 26 x 5 = 130 | 48 [10–150] | 8–15 | 12 [2–36] | 60.0 [42.9–100.0] | 3.5 [0.0–20.1] | 0.6 [0.0–1.3] | 3.0 [0.0–19.2] | 22.6–42.3 | 0 |
| 11 | unset | 26 x 5 = 130 | 57 [11–176] | 8–16 | 15 [5–42] | 60.0 [32.3–85.7] | 4.3 [0.2–31.4] | 0.6 [0.1–1.9] | 3.7 [0.0–30.0] | 21.1–42.3 | 0 |
| 12 | unset | 26 x 5 = 130 | 64 [14–216] | 9–18 | 17 [5–53] | 57.1 [39.6–75.0] | 5.9 [0.8–39.0] | 0.7 [0.3–1.5] | 5.0 [0.6–37.8] | 18.8–37.6 | 0 |
| 13 | unset | 26 x 5 = 130 | 81 [16–260] | 10–20 | 19 [4–60] | 55.6 [41.4–75.0] | 7.6 [0.3–47.8] | 0.7 [0.3–1.4] | 6.6 [0.0–46.2] | 16.9–33.8 | 0 |
| 14 | unset | 26 x 5 = 130 | 96 [19–294] | 10–21 | 22 [7–71] | 52.0 [38.2–87.5] | 8.5 [0.2–54.1] | 0.9 [0.1–1.6] | 7.8 [0.0–52.5] | 16.1–33.8 | 0 |
| 15 | unset | 26 x 5 = 130 | 105 [21–330] | 11–22 | 25 [8–83] | 50.0 [35.8–75.0] | 11.1 [0.4–76.0] | 0.9 [0.3–1.7] | 10.2 [0.1–74.2] | 15.4–30.8 | 0 |
| 16 | unset | 26 x 5 = 130 | 116 [24–384] | 12–24 | 28 [7–93] | 51.9 [33.9–80.0] | 12.8 [0.3–92.9] | 0.9 [0.2–1.9] | 12.0 [0.0–91.0] | 14.1–28.2 | 0 |
| 6 | 3 | 26 x 5 = 130 | 14 [4–54] | 4–9 | 5 [1–13] | 100.0 [66.7–100.0] | 0.0 [0.0–4.9] | 0.0 [0.0–0.4] | 0.0 [0.0–4.4] | 37.6–84.6 | 26 |
| 7 | 3 | 26 x 5 = 130 | 25 [6–70] | 5–10 | 7 [3–18] | 85.7 [66.7–100.0] | 0.4 [0.0–4.3] | 0.1 [0.0–0.4] | 0.3 [0.0–3.9] | 33.8–67.7 | 26 |
| 8 | 3 | 26 x 5 = 130 | 30 [4–96] | 6–12 | 7 [3–22] | 83.3 [61.5–100.0] | 0.6 [0.0–6.5] | 0.2 [0.0–0.6] | 0.4 [0.0–5.9] | 28.2–56.4 | 0 |
| 9 | 3 | 26 x 5 = 130 | 40 [5–126] | 7–14 | 10 [1–32] | 75.0 [53.1–100.0] | 1.3 [0.0–15.3] | 0.3 [0.0–0.8] | 1.0 [0.0–14.5] | 24.2–48.3 | 0 |
| 10 | 3 | 26 x 5 = 130 | 48 [10–150] | 8–15 | 12 [2–36] | 76.5 [56.8–100.0] | 1.8 [0.0–18.4] | 0.3 [0.0–0.7] | 1.5 [0.0–17.6] | 22.6–42.3 | 0 |
| 11 | 3 | 26 x 5 = 130 | 57 [11–176] | 8–16 | 14 [5–40] | 72.7 [57.1–100.0] | 2.9 [0.0–15.4] | 0.3 [0.0–0.7] | 2.5 [0.0–14.6] | 21.1–42.3 | 0 |
| 12 | 3 | 26 x 5 = 130 | 64 [14–216] | 9–18 | 17 [4–52] | 70.0 [46.6–100.0] | 3.9 [0.0–29.2] | 0.4 [0.0–1.1] | 3.4 [0.0–27.8] | 18.8–37.6 | 0 |
| 13 | 3 | 26 x 5 = 130 | 81 [16–260] | 10–20 | 19 [4–67] | 68.2 [50.9–100.0] | 4.9 [0.0–37.2] | 0.4 [0.0–0.9] | 4.4 [0.0–36.3] | 16.9–33.8 | 0 |
| 14 | 3 | 26 x 5 = 130 | 96 [19–294] | 10–21 | 22 [7–72] | 66.7 [51.1–90.0] | 5.2 [0.5–40.7] | 0.5 [0.1–0.9] | 4.8 [0.4–39.9] | 16.1–33.8 | 0 |
| 15 | 3 | 26 x 5 = 130 | 105 [21–330] | 11–22 | 25 [7–81] | 64.3 [44.9–100.0] | 7.6 [0.0–52.7] | 0.5 [0.0–1.2] | 7.1 [0.0–51.5] | 15.4–30.8 | 0 |
| 16 | 3 | 26 x 5 = 130 | 116 [24–384] | 12–24 | 29 [7–94] | 60.7 [44.1–100.0] | 10.0 [0.0–72.7] | 0.6 [0.0–1.2] | 9.4 [0.0–71.4] | 14.1–28.2 | 0 |

"flagged shapes" at rows 6–7 is the row-floor flag on all 26 shapes.

## 4. Level 1 at a cell target, whatever shape the bag deals

| target cells | b | shapes x seeds | rows | cols | mask cells median [min–max] | arrows | clearable@0 % | blocked | blocked@deal | blocked after 1st removal | cellPt 360 [min–max] | flagged shapes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 88 | unset | 26 x 5 = 130 | 8–32 | 9–26 | 86 [80–100] | 21 [19–27] | 54.5 [42.1–64.0] | 9.1 [6.0–12.8] | 0.8 [0.5–1.2] | 8.3 [5.4–11.7] | 13.0–37.6 | 0 |
| 145 | unset | 26 x 5 = 130 | 10–41 | 12–33 | 146 [128–160] | 37 [30–41] | 48.8 [40.6–64.9] | 18.2 [12.7–22.6] | 1.0 [0.5–1.4] | 17.4 [12.0–21.5] | 10.3–28.2 | 0 |
| 88 | 3 | 26 x 5 = 130 | 8–32 | 9–26 | 86 [80–100] | 22 [18–26] | 68.2 [54.5–77.8] | 5.7 [2.3–9.6] | 0.4 [0.3–0.8] | 5.2 [1.9–8.8] | 13.0–37.6 | 0 |
| 145 | 3 | 26 x 5 = 130 | 10–41 | 12–33 | 146 [128–160] | 36 [30–42] | 58.8 [48.8–73.7] | 12.8 [7.1–22.1] | 0.7 [0.3–1.0] | 12.3 [6.8–21.0] | 10.3–28.2 | 0 |

The per-shape rows of this table are in Appendix C.

**The target-to-board mapping is not exact.** v2 sizes from the shape's fill at 24 rows (Circle 0.667), not from
the board it deals. So:
- a target of 88 cells deals Circle at **11×11** (81 cells), not the 12×12 (88 cells) row;
- Circle is dealt at 12×12 for targets 89–104, and at 15×15 for targets 141–160.

That was EXECUTED with a scratch script over the same replica. W3-14 should take a picked row's target from this
mapping, not from its mask-cell count.

## 5. Rows whose blocked count is lower than v1 level 1's measured 81.5

Rows whose median blocked is below v1 level 1's measured 81.5: 571 of 572 candidate rows (the "yes" rows above); at or above it: unset/16/Rectangle.

That is every candidate row except the one named. The per-row "blocked < v1 L1" column in Appendices A and B marks
each row "yes" or "NO". This is a delta against a measurement, not a gate.

## 6. Shapes and the bag

Which shape level 1 gets is the bag's pick, not a row's: if a curve admitted every candidate to window 0, the bag would deal Pine, Cat, Circle, Octagon, Bolt at levels 1-5 (bagWindowFor(0) with a window max target of 0; W3-14's curve sets the real window).

- The line above is an illustration (INFERRED), not a prediction. W3-14's curve decides the real level-1 window.
- **At level-1 sizes some silhouettes collapse.** In the rows axis, several shapes rasterize to the same mask:
  - Circle = Octagon at 6, 7, 12, 13 and 15 rows;
  - Diamond = Flower at 8, 9 and 11 rows;
  - Bolt holds 4–16 cells at 8–13 rows, with a median of at most 5 arrows.
- At a cell target v2 gives thin shapes more rows (Bolt reaches 32×26 at 88 cells), and only Circle = Octagon at
  145 cells remains identical. EXECUTED from the `--json` output.

## 7. Shortlist for the owner's screenshots (input to W3-13)

W3-13 needs fit-to-view screenshots of three rows, and the emulator is busy, so these are web screenshots. The
selection rule, stated so anyone can re-derive it:
- **Shape.** Circle, v1 level 1's shape, so the three differ from today's level 1 only in size and bias.
- **Size.** The two level-1 sizes the plan discussed and the red team measured: about 21 and about 38 arrows.
  - The Circle rows nearest 21 are 11 rows (19) and 12 rows (23), a tie at ±2. 12 rows is taken because it is
    W3-11's measured pointer row.
  - 15 rows gives exactly 38.
- **Bias.** Unset at both sizes, plus b = 3 at the smaller size, since b = 3 is the only brand-gate pass.
- **Board shown.** The median-blocked seed.

| sheet | row | board | row medians, 5 seeds: arrows / clearable / blocked [min–max] / after 1st removal | board shown (seed): arrows, clearable, blocked | any bag shape at the same cell target: blocked | cellPt 360 / 411 |
|---|---|---|---|---|---|---|
| A | `unset/12/Circle` | 12×12, 88 cells | 23 / 56.5% / 10.8 [8.4–19.6] / 9.8 | s1: 21, 10, 10.8 | 9.1 [6.0–12.8] | 28.2 / 32.2 |
| B | `b3/12/Circle` | 12×12, 88 cells, b = 3 | 23 / 72.0% / 4.0 [2.8–7.5] / 3.5 | s5: 19, 12, 4.0 | 5.7 [2.3–9.6] | 28.2 / 32.2 |
| C | `unset/15/Circle` | 15×15, 145 cells | 38 / 45.9% / 21.2 [14.7–22.6] / 20.1 | s2: 39, 18, 21.2 | 18.2 [12.7–22.6] | 22.6 / 25.8 |

**Screenshots (EXECUTED; web viewport, NOT a phone).**
- Captured with headless Chrome at 360×780 CSS px, DPR 3, from `npx expo start --web --port 8097` on the working
  tree (`EXPO_PUBLIC_FTUE_LOG=1`, `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1`).
- A throwaway patch in `src/ui/gameSessionLifecycle.ts` dealt each row's board. It was restored byte for byte.
- Every capture's `[w312]` / `[ftue] board_mount` log matches node:
  - A: 21 arrows, 10 clearable;
  - B: 19 arrows, 12 clearable;
  - C: 39 arrows, 18 clearable;
  - the baseline is 60.
- The web board area logged 360×718 dp, against the phone's 360×689. Both are width-bound, so cellPt is the same.
- Files: `artifacts/W3-12/web-unset-12-Circle-s1.png`, `web-b3-12-Circle-s5.png`, `web-unset-15-Circle-s2.png` and
  `web-baseline-v1-L1.png`.
- The owner sheet is `artifacts/W3-12/owner-level1-choice.png`. It holds the three rows side by side with these
  numbers, today's level 1 as a greyed reference, and the question.
- **Emulator screenshots of these three rows are still owed** (W3-13's "agent captures them with W3-06").

**Owner question (W3-13):** Which row should level 1 be? Answer A, B or C, or name another row id from this doc.

## Limits

- This is the proxy, not people. W3-17 playtests the pick, and W3-23 checks whether the proxy tracks real mistakes
  at all.
- Blocked counts are noisy per seed: `unset/12/Square` runs from 10.0 to 36.6 over 5 seeds. n = 5 per row is the
  brief's method, not a power calculation.
- A screenshot shows one seed. Its arrow count can differ from the row median: 19 and 21 against 23.
- The web layout is not the phone's (header, insets, fonts). Taps, feel and legibility on a device are
  UNVERIFIED-DEVICE.

## Appendix A: every candidate row, b = unset

| row | rows×cols | mask cells | n | arrows median [min–max] | arrows mean | clearable@0 median (%) | scan median | blocked median [min–max] | blocked mean | blocked@deal median | blocked after 1st removal median | cellPt 360 / 411 | median seed | blocked < v1 L1 | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unset/6/Square | 6×6 | 36 | 5 | 9 [8–10] | 8.8 | 6 (62.5%) | 11.1 | 2.1 [0.7–4.6] | 2.4 | 0.5 | 1.7 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Rectangle | 6×9 | 54 | 5 | 13 [12–15] | 13.4 | 7 (46.7%) | 17.8 | 4.8 [4.0–10.9] | 6.8 | 1.0 | 4.1 | 37.6 / 43.0 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Circle | 6×6 | 24 | 5 | 7 [7–10] | 7.8 | 5 (62.5%) | 9.4 | 2.4 [0.5–3.3] | 2.2 | 0.5 | 1.8 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Diamond | 6×6 | 12 | 5 | 4 [3–5] | 4.0 | 3 (80.0%) | 4.3 | 0.2 [0.0–1.0] | 0.3 | 0.2 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Triangle | 6×6 | 12 | 5 | 4 [2–5] | 4.0 | 3 (100.0%) | 4.3 | 0.0 [0.0–1.0] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Plus | 6×6 | 20 | 5 | 6 [5–7] | 6.2 | 5 (83.3%) | 8.1 | 1.1 [0.0–2.3] | 1.0 | 0.2 | 0.9 | 56.4 / 64.5 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Hexagon | 6×6 | 20 | 5 | 5 [4–6] | 5.2 | 5 (100.0%) | 5.0 | 0.0 [0.0–1.9] | 0.5 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Star | 6×6 | 10 | 5 | 4 [3–4] | 3.8 | 3 (100.0%) | 4.0 | 0.0 [0.0–1.5] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Heart | 6×6 | 26 | 5 | 6 [6–9] | 7.0 | 5 (83.3%) | 6.9 | 0.9 [0.0–2.3] | 0.9 | 0.2 | 0.5 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Trophy | 6×5 | 9 | 5 | 5 [4–6] | 5.0 | 2 (50.0%) | 6.3 | 1.3 [0.0–1.6] | 1.0 | 0.7 | 0.3 | 67.7 / 77.3 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Crescent | 6×6 | 11 | 5 | 5 [3–5] | 4.2 | 4 (100.0%) | 5.0 | 0.0 [0.0–1.3] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Flower | 6×6 | 20 | 5 | 6 [5–7] | 6.2 | 5 (83.3%) | 8.1 | 1.1 [0.0–2.3] | 1.0 | 0.2 | 0.9 | 56.4 / 64.5 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Bolt | 6×5 | 4 | 5 | 1 [1–1] | 1.0 | 1 (100.0%) | 1.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 67.7 / 77.3 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Arrow | 6×5 | 8 | 5 | 3 [3–3] | 3.0 | 3 (100.0%) | 3.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 67.7 / 77.3 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Crown | 6×7 | 14 | 5 | 4 [4–7] | 4.6 | 4 (75.0%) | 4.6 | 0.6 [0.0–1.7] | 0.7 | 0.3 | 0.3 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Hourglass | 6×5 | 14 | 5 | 4 [2–4] | 3.4 | 2 (66.7%) | 4.3 | 0.5 [0.3–1.0] | 0.5 | 0.3 | 0.0 | 67.7 / 77.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Pentagon | 6×6 | 18 | 5 | 5 [3–5] | 4.4 | 3 (60.0%) | 5.0 | 0.7 [0.0–3.3] | 1.1 | 0.5 | 0.0 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Octagon | 6×6 | 24 | 5 | 7 [7–10] | 7.8 | 5 (62.5%) | 9.4 | 2.4 [0.5–3.3] | 2.2 | 0.5 | 1.8 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Ring | 6×6 | 20 | 5 | 7 [4–9] | 6.6 | 4 (71.4%) | 7.7 | 0.7 [0.0–3.1] | 1.0 | 0.3 | 0.4 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/X | 6×6 | 8 | 5 | 6 [6–7] | 6.2 | 5 (83.3%) | 7.1 | 0.6 [0.1–1.9] | 0.9 | 0.2 | 0.5 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Butterfly | 6×7 | 24 | 5 | 6 [4–8] | 6.0 | 4 (75.0%) | 8.0 | 2.0 [0.0–3.1] | 1.7 | 0.3 | 1.3 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Rocket | 6×4 | 8 | 5 | 2 [1–3] | 2.2 | 1 (66.7%) | 2.5 | 0.5 [0.0–1.5] | 0.6 | 0.3 | 0.0 | 84.6 / 96.7 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Pine | 6×5 | 8 | 5 | 3 [3–5] | 3.4 | 3 (100.0%) | 3.3 | 0.0 [0.0–0.3] | 0.1 | 0.0 | 0.0 | 67.7 / 77.3 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Cat | 6×6 | 14 | 5 | 4 [3–4] | 3.6 | 3 (75.0%) | 4.3 | 0.3 [0.0–1.7] | 0.7 | 0.3 | 0.0 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Mushroom | 6×6 | 14 | 5 | 4 [3–6] | 4.4 | 3 (75.0%) | 4.6 | 0.5 [0.3–1.5] | 0.6 | 0.3 | 0.3 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/6/Fish | 6×7 | 20 | 5 | 4 [4–6] | 4.6 | 4 (100.0%) | 4.0 | 0.0 [0.0–1.3] | 0.3 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Square | 7×7 | 49 | 5 | 11 [9–13] | 11.0 | 7 (53.8%) | 12.2 | 2.4 [0.7–8.3] | 3.1 | 0.8 | 1.7 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Rectangle | 7×10 | 70 | 5 | 16 [15–19] | 16.6 | 9 (53.3%) | 22.1 | 6.6 [6.1–11.2] | 8.1 | 0.8 | 5.8 | 33.8 / 38.7 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Circle | 7×7 | 37 | 5 | 10 [8–10] | 9.4 | 7 (75.0%) | 11.1 | 2.0 [0.3–4.8] | 2.2 | 0.3 | 1.6 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Diamond | 7×7 | 21 | 5 | 6 [4–7] | 5.6 | 4 (71.4%) | 7.0 | 0.9 [0.0–1.6] | 1.0 | 0.3 | 0.6 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Triangle | 7×7 | 17 | 5 | 5 [3–6] | 4.8 | 4 (100.0%) | 5.5 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Plus | 7×7 | 25 | 5 | 9 [7–11] | 8.8 | 6 (55.6%) | 12.3 | 3.3 [0.0–4.4] | 2.4 | 0.7 | 2.6 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Hexagon | 7×7 | 27 | 5 | 8 [6–9] | 7.8 | 7 (87.5%) | 8.6 | 0.7 [0.4–0.9] | 0.7 | 0.1 | 0.5 | 48.3 / 55.2 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Star | 7×7 | 14 | 5 | 5 [4–5] | 4.8 | 5 (100.0%) | 5.0 | 0.0 [0.0–1.1] | 0.3 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Heart | 7×7 | 36 | 5 | 10 [10–11] | 10.2 | 5 (50.0%) | 12.6 | 2.6 [1.9–5.6] | 3.0 | 0.8 | 1.8 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Trophy | 7×6 | 10 | 5 | 5 [4–6] | 4.8 | 4 (100.0%) | 5.0 | 0.0 [0.0–1.1] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Crescent | 7×7 | 19 | 5 | 6 [4–8] | 5.8 | 4 (83.3%) | 6.2 | 0.2 [0.0–2.0] | 0.6 | 0.2 | 0.0 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Flower | 7×7 | 25 | 5 | 9 [7–11] | 8.8 | 6 (55.6%) | 12.3 | 3.3 [0.0–4.4] | 2.4 | 0.7 | 2.6 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Bolt | 7×6 | 6 | 5 | 5 [4–5] | 4.8 | 3 (75.0%) | 5.8 | 0.8 [0.0–2.5] | 1.2 | 0.3 | 0.6 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Arrow | 7×6 | 12 | 5 | 6 [3–7] | 5.4 | 5 (75.0%) | 6.0 | 0.5 [0.0–2.0] | 0.6 | 0.3 | 0.2 | 56.4 / 64.5 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Crown | 7×8 | 22 | 5 | 6 [4–7] | 5.6 | 3 (75.0%) | 6.2 | 0.6 [0.0–1.4] | 0.7 | 0.3 | 0.4 | 42.3 / 48.3 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Hourglass | 7×6 | 22 | 5 | 7 [5–11] | 7.4 | 6 (77.8%) | 8.6 | 1.8 [0.5–4.1] | 2.1 | 0.3 | 1.5 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Pentagon | 7×7 | 26 | 5 | 8 [5–9] | 7.6 | 6 (66.7%) | 9.0 | 1.0 [0.0–2.7] | 1.0 | 0.4 | 0.5 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Octagon | 7×7 | 37 | 5 | 10 [8–10] | 9.4 | 7 (75.0%) | 11.1 | 2.0 [0.3–4.8] | 2.2 | 0.3 | 1.6 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Ring | 7×7 | 28 | 5 | 8 [7–9] | 8.0 | 6 (66.7%) | 9.1 | 1.1 [0.4–1.7] | 1.1 | 0.4 | 0.6 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/X | 7×7 | 29 | 5 | 12 [11–13] | 12.0 | 9 (75.0%) | 14.0 | 2.0 [1.0–5.2] | 2.5 | 0.3 | 1.7 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Butterfly | 7×8 | 30 | 5 | 9 [6–10] | 8.6 | 5 (62.5%) | 10.5 | 1.8 [1.2–4.1] | 2.2 | 0.5 | 1.2 | 42.3 / 48.3 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Rocket | 7×5 | 13 | 5 | 4 [2–6] | 3.8 | 3 (75.0%) | 4.0 | 0.3 [0.0–0.9] | 0.4 | 0.3 | 0.0 | 67.7 / 77.3 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Pine | 7×6 | 10 | 5 | 3 [2–4] | 3.2 | 3 (75.0%) | 3.8 | 0.3 [0.0–0.8] | 0.3 | 0.3 | 0.0 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Cat | 7×7 | 20 | 5 | 6 [4–7] | 5.8 | 4 (80.0%) | 7.1 | 1.3 [0.0–2.3] | 1.1 | 0.2 | 1.1 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Mushroom | 7×7 | 24 | 5 | 8 [6–9] | 7.4 | 5 (83.3%) | 9.0 | 0.4 [0.0–2.6] | 1.0 | 0.2 | 0.2 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/7/Fish | 7×8 | 26 | 5 | 7 [5–9] | 7.0 | 5 (62.5%) | 9.0 | 2.2 [1.0–4.0] | 2.3 | 0.5 | 1.8 | 42.3 / 48.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| unset/8/Square | 8×8 | 64 | 5 | 15 [13–17] | 14.8 | 6 (40.0%) | 22.9 | 7.9 [2.6–19.1] | 9.0 | 1.3 | 6.6 | 42.3 / 48.3 | 2 | yes | - |
| unset/8/Rectangle | 8×12 | 96 | 5 | 21 [18–22] | 20.6 | 8 (44.4%) | 31.0 | 10.0 [7.9–15.2] | 11.0 | 1.1 | 8.3 | 28.2 / 32.2 | 1 | yes | - |
| unset/8/Circle | 8×8 | 44 | 5 | 9 [9–12] | 10.0 | 6 (63.6%) | 12.5 | 1.9 [1.5–4.0] | 2.5 | 0.5 | 1.3 | 42.3 / 48.3 | 1 | yes | - |
| unset/8/Diamond | 8×8 | 24 | 5 | 7 [7–10] | 7.8 | 5 (62.5%) | 9.4 | 2.4 [0.5–3.3] | 2.2 | 0.5 | 1.8 | 42.3 / 48.3 | 4 | yes | - |
| unset/8/Triangle | 8×8 | 24 | 5 | 6 [4–10] | 6.8 | 5 (75.0%) | 6.9 | 0.9 [0.1–4.2] | 1.3 | 0.3 | 0.5 | 42.3 / 48.3 | 3 | yes | - |
| unset/8/Plus | 8×8 | 32 | 5 | 9 [8–10] | 8.8 | 7 (80.0%) | 10.5 | 1.5 [0.2–2.6] | 1.2 | 0.2 | 1.2 | 42.3 / 48.3 | 5 | yes | - |
| unset/8/Hexagon | 8×8 | 36 | 5 | 9 [7–11] | 8.8 | 6 (66.7%) | 11.4 | 2.4 [0.0–2.9] | 1.9 | 0.4 | 2.0 | 42.3 / 48.3 | 3 | yes | - |
| unset/8/Star | 8×8 | 20 | 5 | 6 [5–7] | 6.2 | 5 (100.0%) | 7.0 | 0.0 [0.0–2.8] | 0.7 | 0.0 | 0.0 | 42.3 / 48.3 | 2 | yes | - |
| unset/8/Heart | 8×8 | 48 | 5 | 13 [9–14] | 12.0 | 6 (55.6%) | 19.2 | 5.2 [3.0–7.4] | 5.2 | 0.7 | 4.1 | 42.3 / 48.3 | 5 | yes | - |
| unset/8/Trophy | 8×7 | 12 | 5 | 4 [3–4] | 3.6 | 2 (66.7%) | 4.6 | 0.8 [0.6–1.5] | 0.9 | 0.3 | 0.5 | 48.3 / 55.2 | 2 | yes | - |
| unset/8/Crescent | 8×8 | 22 | 5 | 6 [5–7] | 6.0 | 4 (66.7%) | 7.6 | 0.8 [0.0–2.8] | 1.1 | 0.4 | 0.6 | 42.3 / 48.3 | 3 | yes | - |
| unset/8/Flower | 8×8 | 24 | 5 | 7 [7–10] | 7.8 | 5 (62.5%) | 9.4 | 2.4 [0.5–3.3] | 2.2 | 0.5 | 1.8 | 42.3 / 48.3 | 4 | yes | - |
| unset/8/Bolt | 8×6 | 4 | 5 | 4 [4–4] | 4.0 | 4 (100.0%) | 4.0 | 0.0 [0.0–1.5] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | - |
| unset/8/Arrow | 8×7 | 11 | 5 | 3 [2–4] | 2.8 | 2 (66.7%) | 3.3 | 0.3 [0.0–0.8] | 0.3 | 0.3 | 0.0 | 48.3 / 55.2 | 3 | yes | - |
| unset/8/Crown | 8×9 | 30 | 5 | 8 [5–9] | 7.8 | 5 (66.7%) | 10.0 | 1.0 [0.0–6.6] | 1.9 | 0.4 | 0.8 | 37.6 / 43.0 | 4 | yes | - |
| unset/8/Hourglass | 8×6 | 24 | 5 | 9 [6–11] | 8.6 | 7 (77.8%) | 9.5 | 0.9 [0.5–2.9] | 1.5 | 0.3 | 0.6 | 56.4 / 64.5 | 2 | yes | - |
| unset/8/Pentagon | 8×8 | 32 | 5 | 8 [6–9] | 7.8 | 5 (66.7%) | 9.7 | 1.6 [0.8–1.7] | 1.4 | 0.4 | 1.2 | 42.3 / 48.3 | 4 | yes | - |
| unset/8/Octagon | 8×8 | 40 | 5 | 11 [9–12] | 10.6 | 8 (75.0%) | 13.0 | 2.0 [0.7–3.3] | 2.0 | 0.3 | 1.7 | 42.3 / 48.3 | 5 | yes | - |
| unset/8/Ring | 8×8 | 32 | 5 | 9 [7–10] | 8.6 | 5 (66.7%) | 10.1 | 1.9 [0.6–5.2] | 2.5 | 0.4 | 1.6 | 42.3 / 48.3 | 4 | yes | - |
| unset/8/X | 8×8 | 36 | 5 | 13 [12–16] | 13.2 | 9 (69.2%) | 17.7 | 4.7 [2.9–9.4] | 5.3 | 0.4 | 4.3 | 42.3 / 48.3 | 2 | yes | - |
| unset/8/Butterfly | 8×9 | 42 | 5 | 10 [9–13] | 10.6 | 7 (69.2%) | 12.6 | 1.6 [0.2–4.2] | 1.9 | 0.4 | 0.9 | 37.6 / 43.0 | 5 | yes | - |
| unset/8/Rocket | 8×6 | 14 | 5 | 3 [3–5] | 3.6 | 3 (75.0%) | 3.8 | 0.3 [0.0–2.8] | 0.8 | 0.3 | 0.0 | 56.4 / 64.5 | 2 | yes | - |
| unset/8/Pine | 8×7 | 17 | 5 | 5 [4–6] | 5.2 | 4 (80.0%) | 6.0 | 0.9 [0.0–1.3] | 0.8 | 0.2 | 0.6 | 48.3 / 55.2 | 3 | yes | - |
| unset/8/Cat | 8×8 | 28 | 5 | 6 [6–8] | 6.6 | 5 (66.7%) | 7.1 | 0.9 [0.1–2.8] | 1.2 | 0.4 | 0.5 | 42.3 / 48.3 | 2 | yes | - |
| unset/8/Mushroom | 8×8 | 26 | 5 | 6 [5–11] | 6.6 | 4 (66.7%) | 6.6 | 0.6 [0.2–1.5] | 0.8 | 0.4 | 0.5 | 42.3 / 48.3 | 1 | yes | - |
| unset/8/Fish | 8×10 | 36 | 5 | 7 [7–11] | 8.4 | 5 (50.0%) | 8.4 | 1.4 [0.8–5.7] | 2.1 | 0.8 | 0.6 | 33.8 / 38.7 | 3 | yes | - |
| unset/9/Square | 9×9 | 81 | 5 | 22 [16–24] | 20.8 | 11 (52.2%) | 30.0 | 10.4 [8.0–17.3] | 11.0 | 0.8 | 9.6 | 37.6 / 43.0 | 4 | yes | - |
| unset/9/Rectangle | 9×14 | 126 | 5 | 31 [28–38] | 32.0 | 15 (45.2%) | 46.0 | 15.4 [13.5–30.2] | 18.4 | 1.1 | 14.6 | 24.2 / 27.6 | 2 | yes | - |
| unset/9/Circle | 9×9 | 57 | 5 | 15 [12–18] | 15.2 | 9 (66.7%) | 21.1 | 6.1 [1.3–8.5] | 5.2 | 0.5 | 5.7 | 37.6 / 43.0 | 5 | yes | - |
| unset/9/Diamond | 9×9 | 37 | 5 | 10 [8–10] | 9.4 | 7 (75.0%) | 11.1 | 2.0 [0.3–4.8] | 2.2 | 0.3 | 1.6 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/Triangle | 9×9 | 31 | 5 | 8 [7–10] | 8.0 | 6 (75.0%) | 10.0 | 1.0 [0.1–3.8] | 1.5 | 0.3 | 0.7 | 37.6 / 43.0 | 5 | yes | - |
| unset/9/Plus | 9×9 | 45 | 5 | 14 [11–15] | 13.6 | 8 (57.1%) | 17.9 | 3.1 [2.9–8.2] | 5.0 | 0.7 | 2.6 | 37.6 / 43.0 | 5 | yes | - |
| unset/9/Hexagon | 9×9 | 47 | 5 | 13 [11–14] | 12.4 | 6 (54.5%) | 15.7 | 3.3 [1.1–6.2] | 3.6 | 0.7 | 2.6 | 37.6 / 43.0 | 3 | yes | - |
| unset/9/Star | 9×9 | 24 | 5 | 7 [5–7] | 6.4 | 4 (71.4%) | 8.1 | 1.1 [0.2–2.9] | 1.3 | 0.3 | 0.9 | 37.6 / 43.0 | 4 | yes | - |
| unset/9/Heart | 9×9 | 60 | 5 | 16 [13–17] | 15.6 | 6 (41.2%) | 24.1 | 8.3 [7.1–9.5] | 8.1 | 1.3 | 7.1 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/Trophy | 9×8 | 18 | 5 | 6 [4–8] | 6.0 | 4 (66.7%) | 7.9 | 1.2 [0.6–3.1] | 1.8 | 0.4 | 0.7 | 42.3 / 48.3 | 4 | yes | - |
| unset/9/Crescent | 9×9 | 28 | 5 | 8 [8–9] | 8.4 | 7 (77.8%) | 8.8 | 0.5 [0.0–3.0] | 0.9 | 0.3 | 0.3 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/Flower | 9×9 | 37 | 5 | 10 [8–10] | 9.4 | 7 (75.0%) | 11.1 | 2.0 [0.3–4.8] | 2.2 | 0.3 | 1.6 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/Bolt | 9×7 | 5 | 5 | 1 [1–1] | 1.0 | 1 (100.0%) | 1.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | - |
| unset/9/Arrow | 9×8 | 18 | 5 | 7 [6–8] | 7.0 | 5 (75.0%) | 8.4 | 0.6 [0.0–1.8] | 0.8 | 0.3 | 0.3 | 42.3 / 48.3 | 4 | yes | - |
| unset/9/Crown | 9×10 | 40 | 5 | 9 [6–11] | 8.6 | 5 (71.4%) | 9.9 | 0.9 [0.6–6.5] | 2.3 | 0.3 | 0.6 | 33.8 / 38.7 | 1 | yes | - |
| unset/9/Hourglass | 9×7 | 23 | 5 | 6 [6–7] | 6.4 | 4 (66.7%) | 8.0 | 1.5 [1.4–2.0] | 1.6 | 0.4 | 1.2 | 48.3 / 55.2 | 1 | yes | - |
| unset/9/Pentagon | 9×9 | 42 | 5 | 12 [11–16] | 13.0 | 8 (62.5%) | 16.4 | 3.7 [1.8–5.4] | 3.7 | 0.5 | 3.4 | 37.6 / 43.0 | 4 | yes | - |
| unset/9/Octagon | 9×9 | 45 | 5 | 10 [9–13] | 10.6 | 5 (46.2%) | 14.8 | 3.9 [3.8–7.4] | 5.2 | 1.0 | 3.1 | 37.6 / 43.0 | 3 | yes | - |
| unset/9/Ring | 9×9 | 40 | 5 | 12 [10–14] | 12.0 | 7 (63.6%) | 15.2 | 2.6 [1.3–6.9] | 3.4 | 0.5 | 2.1 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/X | 9×9 | 41 | 5 | 15 [15–18] | 15.8 | 10 (66.7%) | 19.4 | 4.4 [2.0–7.0] | 4.3 | 0.5 | 3.7 | 37.6 / 43.0 | 5 | yes | - |
| unset/9/Butterfly | 9×10 | 58 | 5 | 15 [12–17] | 14.4 | 8 (53.3%) | 21.8 | 6.8 [4.0–8.9] | 6.5 | 0.8 | 6.0 | 33.8 / 38.7 | 2 | yes | - |
| unset/9/Rocket | 9×7 | 23 | 5 | 6 [4–8] | 6.2 | 6 (87.5%) | 6.0 | 0.6 [0.0–1.8] | 0.7 | 0.1 | 0.5 | 48.3 / 55.2 | 5 | yes | - |
| unset/9/Pine | 9×8 | 24 | 5 | 8 [7–10] | 8.0 | 5 (62.5%) | 9.7 | 1.7 [0.5–3.4] | 1.9 | 0.5 | 1.4 | 42.3 / 48.3 | 4 | yes | - |
| unset/9/Cat | 9×9 | 30 | 5 | 8 [5–10] | 7.8 | 5 (71.4%) | 10.2 | 1.2 [0.0–4.1] | 1.8 | 0.3 | 1.0 | 37.6 / 43.0 | 5 | yes | - |
| unset/9/Mushroom | 9×9 | 34 | 5 | 9 [8–11] | 9.4 | 7 (77.8%) | 10.0 | 1.0 [0.5–2.7] | 1.5 | 0.3 | 0.8 | 37.6 / 43.0 | 2 | yes | - |
| unset/9/Fish | 9×11 | 45 | 5 | 12 [10–13] | 11.6 | 7 (69.2%) | 16.1 | 3.1 [1.1–7.5] | 3.7 | 0.4 | 2.7 | 30.8 / 35.2 | 1 | yes | - |
| unset/10/Square | 10×10 | 100 | 5 | 23 [19–27] | 22.8 | 11 (47.8%) | 39.7 | 15.5 [8.1–16.7] | 13.3 | 1.0 | 14.3 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Rectangle | 10×15 | 150 | 5 | 36 [35–40] | 36.8 | 16 (42.9%) | 58.8 | 20.1 [18.9–25.3] | 21.2 | 1.3 | 19.2 | 22.6 / 25.8 | 5 | yes | - |
| unset/10/Circle | 10×10 | 68 | 5 | 17 [14–20] | 17.6 | 8 (47.1%) | 25.8 | 7.2 [3.0–10.2] | 7.3 | 1.0 | 6.4 | 33.8 / 38.7 | 5 | yes | - |
| unset/10/Diamond | 10×10 | 40 | 5 | 11 [9–12] | 10.6 | 8 (75.0%) | 13.0 | 2.0 [0.7–3.3] | 2.0 | 0.3 | 1.7 | 33.8 / 38.7 | 5 | yes | - |
| unset/10/Triangle | 10×10 | 35 | 5 | 9 [7–11] | 9.0 | 6 (66.7%) | 10.9 | 1.9 [0.1–3.8] | 1.6 | 0.4 | 1.4 | 33.8 / 38.7 | 1 | yes | - |
| unset/10/Plus | 10×10 | 56 | 5 | 13 [10–17] | 12.8 | 7 (54.5%) | 17.6 | 4.5 [1.8–5.5] | 4.0 | 0.7 | 3.8 | 33.8 / 38.7 | 2 | yes | - |
| unset/10/Hexagon | 10×10 | 56 | 5 | 14 [12–15] | 13.8 | 6 (50.0%) | 18.0 | 4.9 [2.3–8.2] | 4.9 | 0.9 | 3.9 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Star | 10×10 | 30 | 5 | 10 [10–12] | 10.8 | 7 (66.7%) | 13.8 | 2.4 [1.4–5.1] | 3.0 | 0.4 | 1.9 | 33.8 / 38.7 | 1 | yes | - |
| unset/10/Heart | 10×10 | 76 | 5 | 21 [18–21] | 20.0 | 10 (52.4%) | 31.9 | 11.8 [7.3–15.7] | 12.1 | 0.8 | 11.0 | 33.8 / 38.7 | 2 | yes | - |
| unset/10/Trophy | 10×8 | 24 | 5 | 7 [5–9] | 6.8 | 4 (60.0%) | 8.0 | 1.2 [0.3–2.0] | 1.3 | 0.5 | 0.8 | 42.3 / 48.3 | 1 | yes | - |
| unset/10/Crescent | 10×10 | 36 | 5 | 9 [8–14] | 10.2 | 6 (44.4%) | 11.8 | 2.8 [0.6–5.1] | 2.8 | 1.0 | 1.8 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Flower | 10×10 | 48 | 5 | 9 [8–15] | 10.8 | 6 (53.8%) | 12.4 | 3.4 [1.6–6.4] | 3.8 | 0.8 | 2.4 | 33.8 / 38.7 | 4 | yes | - |
| unset/10/Bolt | 10×8 | 10 | 5 | 2 [2–5] | 3.0 | 2 (100.0%) | 2.0 | 0.0 [0.0–1.7] | 0.5 | 0.0 | 0.0 | 42.3 / 48.3 | 1 | yes | - |
| unset/10/Arrow | 10×9 | 27 | 5 | 9 [6–10] | 8.0 | 6 (77.8%) | 10.2 | 1.4 [0.0–2.4] | 1.5 | 0.3 | 1.3 | 37.6 / 43.0 | 1 | yes | - |
| unset/10/Crown | 10×12 | 54 | 5 | 14 [13–16] | 14.0 | 9 (69.2%) | 18.8 | 5.0 [3.8–11.3] | 6.1 | 0.4 | 4.6 | 28.2 / 32.2 | 5 | yes | - |
| unset/10/Hourglass | 10×8 | 28 | 5 | 10 [7–12] | 9.8 | 6 (57.1%) | 12.0 | 2.4 [1.1–3.2] | 2.3 | 0.6 | 1.6 | 42.3 / 48.3 | 5 | yes | - |
| unset/10/Pentagon | 10×10 | 54 | 5 | 13 [10–15] | 13.0 | 8 (61.5%) | 16.9 | 3.9 [2.7–6.9] | 4.2 | 0.6 | 3.3 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Octagon | 10×10 | 60 | 5 | 14 [12–16] | 14.0 | 8 (53.3%) | 21.0 | 6.0 [3.8–8.8] | 6.4 | 0.8 | 5.2 | 33.8 / 38.7 | 5 | yes | - |
| unset/10/Ring | 10×10 | 60 | 5 | 17 [15–20] | 17.0 | 9 (58.8%) | 21.3 | 4.8 [4.2–6.2] | 5.0 | 0.6 | 4.3 | 33.8 / 38.7 | 5 | yes | - |
| unset/10/X | 10×10 | 48 | 5 | 17 [16–19] | 17.0 | 12 (68.8%) | 20.3 | 4.3 [1.9–10.5] | 5.0 | 0.4 | 3.9 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Butterfly | 10×11 | 62 | 5 | 17 [16–18] | 17.0 | 9 (52.9%) | 22.4 | 5.4 [2.9–8.4] | 5.1 | 0.8 | 4.6 | 30.8 / 35.2 | 5 | yes | - |
| unset/10/Rocket | 10×8 | 32 | 5 | 8 [6–9] | 7.6 | 5 (66.7%) | 9.7 | 1.8 [0.7–3.3] | 1.8 | 0.4 | 1.4 | 42.3 / 48.3 | 3 | yes | - |
| unset/10/Pine | 10×9 | 25 | 5 | 7 [5–7] | 6.4 | 5 (71.4%) | 7.9 | 0.9 [0.0–1.2] | 0.8 | 0.3 | 0.6 | 37.6 / 43.0 | 3 | yes | - |
| unset/10/Cat | 10×10 | 40 | 5 | 11 [8–14] | 10.8 | 6 (62.5%) | 13.5 | 3.1 [2.5–6.0] | 3.9 | 0.5 | 2.6 | 33.8 / 38.7 | 3 | yes | - |
| unset/10/Mushroom | 10×10 | 40 | 5 | 9 [8–10] | 8.8 | 5 (60.0%) | 12.6 | 3.4 [1.6–6.8] | 3.4 | 0.6 | 2.5 | 33.8 / 38.7 | 4 | yes | - |
| unset/10/Fish | 10×12 | 54 | 5 | 14 [14–17] | 15.0 | 9 (58.8%) | 19.7 | 4.3 [3.5–7.0] | 4.9 | 0.6 | 3.8 | 28.2 / 32.2 | 5 | yes | - |
| unset/11/Square | 11×11 | 121 | 5 | 30 [26–31] | 29.2 | 10 (32.3%) | 48.6 | 18.6 [11.0–31.9] | 20.7 | 1.9 | 16.5 | 30.8 / 35.2 | 1 | yes | - |
| unset/11/Rectangle | 11×16 | 176 | 5 | 42 [36–44] | 41.2 | 17 (40.5%) | 73.4 | 31.4 [22.9–46.4] | 32.1 | 1.4 | 30.0 | 21.1 / 24.2 | 2 | yes | - |
| unset/11/Circle | 11×11 | 81 | 5 | 19 [18–20] | 18.8 | 10 (52.6%) | 28.3 | 10.3 [6.9–13.7] | 10.1 | 0.8 | 9.4 | 30.8 / 35.2 | 2 | yes | - |
| unset/11/Diamond | 11×11 | 57 | 5 | 15 [12–18] | 15.2 | 9 (66.7%) | 21.1 | 6.1 [1.3–8.5] | 5.2 | 0.5 | 5.7 | 30.8 / 35.2 | 5 | yes | - |
| unset/11/Triangle | 11×11 | 41 | 5 | 10 [9–12] | 10.2 | 7 (75.0%) | 12.3 | 2.4 [1.3–2.5] | 2.1 | 0.3 | 2.1 | 30.8 / 35.2 | 4 | yes | - |
| unset/11/Plus | 11×11 | 61 | 5 | 15 [13–17] | 15.0 | 9 (58.8%) | 19.2 | 5.6 [2.1–8.5] | 5.0 | 0.6 | 5.0 | 30.8 / 35.2 | 5 | yes | - |
| unset/11/Hexagon | 11×11 | 71 | 5 | 19 [15–20] | 18.0 | 11 (58.8%) | 25.7 | 8.6 [0.7–10.1] | 7.2 | 0.6 | 8.0 | 30.8 / 35.2 | 4 | yes | - |
| unset/11/Star | 11×11 | 33 | 5 | 10 [8–11] | 9.6 | 8 (80.0%) | 11.5 | 1.5 [0.3–3.8] | 1.7 | 0.2 | 1.3 | 30.8 / 35.2 | 5 | yes | - |
| unset/11/Heart | 11×11 | 93 | 5 | 22 [21–25] | 23.0 | 12 (54.5%) | 33.3 | 8.3 [7.3–14.1] | 9.9 | 0.8 | 7.6 | 30.8 / 35.2 | 4 | yes | - |
| unset/11/Trophy | 11×9 | 24 | 5 | 7 [6–9] | 7.0 | 4 (55.6%) | 8.8 | 2.5 [0.5–3.5] | 2.3 | 0.7 | 1.8 | 37.6 / 43.0 | 1 | yes | - |
| unset/11/Crescent | 11×11 | 41 | 5 | 12 [11–15] | 12.6 | 9 (61.5%) | 14.8 | 2.7 [0.2–3.2] | 2.1 | 0.6 | 1.9 | 30.8 / 35.2 | 4 | yes | - |
| unset/11/Flower | 11×11 | 57 | 5 | 15 [12–18] | 15.2 | 9 (66.7%) | 21.1 | 6.1 [1.3–8.5] | 5.2 | 0.5 | 5.7 | 30.8 / 35.2 | 5 | yes | - |
| unset/11/Bolt | 11×9 | 11 | 5 | 5 [5–5] | 5.0 | 4 (80.0%) | 5.2 | 0.2 [0.0–1.2] | 0.5 | 0.2 | 0.0 | 37.6 / 43.0 | 2 | yes | - |
| unset/11/Arrow | 11×10 | 26 | 5 | 9 [6–10] | 8.4 | 5 (62.5%) | 10.9 | 1.9 [0.0–2.7] | 1.7 | 0.5 | 1.4 | 33.8 / 38.7 | 3 | yes | - |
| unset/11/Crown | 11×13 | 68 | 5 | 17 [17–21] | 18.0 | 10 (58.8%) | 25.9 | 8.6 [2.7–17.7] | 9.4 | 0.6 | 8.0 | 26.0 / 29.7 | 3 | yes | - |
| unset/11/Hourglass | 11×9 | 37 | 5 | 11 [7–13] | 10.2 | 6 (63.6%) | 13.8 | 2.8 [1.6–5.6] | 3.2 | 0.5 | 2.3 | 37.6 / 43.0 | 1 | yes | - |
| unset/11/Pentagon | 11×11 | 65 | 5 | 16 [13–18] | 15.6 | 8 (56.3%) | 24.8 | 8.8 [4.5–10.5] | 7.4 | 0.7 | 7.7 | 30.8 / 35.2 | 4 | yes | - |
| unset/11/Octagon | 11×11 | 69 | 5 | 16 [13–19] | 16.0 | 10 (62.5%) | 19.8 | 4.3 [3.7–9.2] | 5.2 | 0.5 | 3.7 | 30.8 / 35.2 | 3 | yes | - |
| unset/11/Ring | 11×11 | 68 | 5 | 15 [13–21] | 16.6 | 10 (61.5%) | 20.6 | 4.6 [2.3–11.2] | 5.6 | 0.6 | 4.1 | 30.8 / 35.2 | 2 | yes | - |
| unset/11/X | 11×11 | 53 | 5 | 20 [19–20] | 19.6 | 11 (57.9%) | 24.9 | 4.9 [1.1–10.7] | 5.6 | 0.7 | 4.1 | 30.8 / 35.2 | 5 | yes | - |
| unset/11/Butterfly | 11×12 | 70 | 5 | 18 [17–23] | 18.8 | 10 (58.8%) | 25.1 | 8.1 [2.4–19.2] | 9.2 | 0.6 | 7.5 | 28.2 / 32.2 | 5 | yes | - |
| unset/11/Rocket | 11×8 | 34 | 5 | 8 [7–10] | 8.4 | 7 (85.7%) | 8.4 | 0.9 [0.4–1.2] | 0.8 | 0.1 | 0.5 | 42.3 / 48.3 | 3 | yes | - |
| unset/11/Pine | 11×10 | 34 | 5 | 11 [10–16] | 11.8 | 7 (62.5%) | 12.6 | 2.6 [1.6–4.2] | 2.6 | 0.5 | 1.9 | 33.8 / 38.7 | 4 | yes | - |
| unset/11/Cat | 11×11 | 53 | 5 | 13 [11–14] | 12.8 | 7 (50.0%) | 16.9 | 3.2 [1.7–8.8] | 4.8 | 0.9 | 2.7 | 30.8 / 35.2 | 2 | yes | - |
| unset/11/Mushroom | 11×10 | 42 | 5 | 11 [7–12] | 9.8 | 5 (54.5%) | 13.7 | 2.7 [1.5–5.7] | 3.3 | 0.7 | 1.7 | 33.8 / 38.7 | 2 | yes | - |
| unset/11/Fish | 11×13 | 67 | 5 | 16 [14–17] | 15.6 | 8 (57.1%) | 21.1 | 5.4 [2.5–9.6] | 5.7 | 0.7 | 4.7 | 26.0 / 29.7 | 4 | yes | - |
| unset/12/Square | 12×12 | 144 | 5 | 39 [33–40] | 37.6 | 17 (47.2%) | 59.7 | 19.7 [10.0–36.6] | 20.8 | 1.1 | 17.8 | 28.2 / 32.2 | 3 | yes | - |
| unset/12/Rectangle | 12×18 | 216 | 5 | 53 [47–58] | 52.2 | 20 (39.6%) | 91.3 | 39.0 [28.5–52.8] | 38.2 | 1.5 | 37.8 | 18.8 / 21.5 | 2 | yes | - |
| unset/12/Circle | 12×12 | 88 | 5 | 23 [21–29] | 23.8 | 13 (56.5%) | 33.4 | 10.8 [8.4–19.6] | 12.4 | 0.7 | 9.8 | 28.2 / 32.2 | 1 | yes | - |
| unset/12/Diamond | 12×12 | 60 | 5 | 16 [14–19] | 16.2 | 9 (57.1%) | 19.6 | 5.1 [2.3–7.5] | 4.6 | 0.7 | 4.4 | 28.2 / 32.2 | 1 | yes | - |
| unset/12/Triangle | 12×12 | 50 | 5 | 12 [11–13] | 11.8 | 8 (61.5%) | 15.8 | 4.8 [2.1–7.0] | 4.2 | 0.6 | 3.7 | 28.2 / 32.2 | 5 | yes | - |
| unset/12/Plus | 12×12 | 80 | 5 | 17 [15–25] | 19.6 | 9 (52.0%) | 32.2 | 8.2 [7.4–17.5] | 10.2 | 0.9 | 7.2 | 28.2 / 32.2 | 5 | yes | - |
| unset/12/Hexagon | 12×12 | 84 | 5 | 19 [17–23] | 19.6 | 10 (52.6%) | 30.8 | 10.0 [4.3–14.4] | 10.0 | 0.8 | 9.0 | 28.2 / 32.2 | 3 | yes | - |
| unset/12/Star | 12×12 | 44 | 5 | 10 [9–13] | 10.2 | 7 (70.0%) | 11.6 | 2.5 [0.5–4.3] | 2.2 | 0.4 | 2.1 | 28.2 / 32.2 | 1 | yes | - |
| unset/12/Heart | 12×12 | 108 | 5 | 25 [25–28] | 26.2 | 14 (50.0%) | 36.8 | 11.8 [8.2–18.5] | 12.0 | 0.9 | 10.6 | 28.2 / 32.2 | 1 | yes | - |
| unset/12/Trophy | 12×10 | 34 | 5 | 11 [9–13] | 10.8 | 7 (66.7%) | 12.3 | 1.5 [1.3–6.4] | 2.6 | 0.4 | 1.1 | 33.8 / 38.7 | 4 | yes | - |
| unset/12/Crescent | 12×12 | 42 | 5 | 11 [9–13] | 11.2 | 8 (61.5%) | 14.4 | 2.4 [1.4–4.9] | 2.7 | 0.6 | 1.8 | 28.2 / 32.2 | 5 | yes | - |
| unset/12/Flower | 12×12 | 68 | 5 | 16 [15–20] | 16.4 | 10 (55.0%) | 21.0 | 5.4 [3.8–8.9] | 6.3 | 0.8 | 4.6 | 28.2 / 32.2 | 2 | yes | - |
| unset/12/Bolt | 12×10 | 14 | 5 | 5 [4–7] | 5.4 | 4 (75.0%) | 5.8 | 0.8 [0.4–2.2] | 1.0 | 0.3 | 0.6 | 33.8 / 38.7 | 1 | yes | - |
| unset/12/Arrow | 12×11 | 36 | 5 | 10 [9–12] | 10.2 | 6 (54.5%) | 15.2 | 3.2 [0.1–6.6] | 3.2 | 0.7 | 2.3 | 30.8 / 35.2 | 3 | yes | - |
| unset/12/Crown | 12×14 | 66 | 5 | 16 [11–17] | 15.0 | 8 (56.3%) | 19.8 | 4.7 [2.2–11.0] | 5.5 | 0.7 | 4.0 | 24.2 / 27.6 | 4 | yes | - |
| unset/12/Hourglass | 12×10 | 48 | 5 | 13 [10–17] | 13.8 | 6 (52.9%) | 16.3 | 3.2 [3.1–6.6] | 4.1 | 0.8 | 2.7 | 33.8 / 38.7 | 3 | yes | - |
| unset/12/Pentagon | 12×12 | 78 | 5 | 21 [19–22] | 20.4 | 10 (47.6%) | 29.5 | 10.5 [6.5–13.5] | 10.0 | 1.0 | 9.5 | 28.2 / 32.2 | 2 | yes | - |
| unset/12/Octagon | 12×12 | 88 | 5 | 23 [21–29] | 23.8 | 13 (56.5%) | 33.4 | 10.8 [8.4–19.6] | 12.4 | 0.7 | 9.8 | 28.2 / 32.2 | 1 | yes | - |
| unset/12/Ring | 12×12 | 64 | 5 | 19 [14–20] | 17.8 | 10 (52.6%) | 24.8 | 5.8 [2.6–10.6] | 6.2 | 0.8 | 5.0 | 28.2 / 32.2 | 2 | yes | - |
| unset/12/X | 12×12 | 60 | 5 | 22 [20–22] | 21.4 | 15 (68.2%) | 26.7 | 4.9 [2.6–8.1] | 5.2 | 0.4 | 4.4 | 28.2 / 32.2 | 4 | yes | - |
| unset/12/Butterfly | 12×13 | 80 | 5 | 20 [18–23] | 20.4 | 8 (44.4%) | 32.4 | 10.8 [9.4–17.3] | 12.1 | 1.1 | 9.6 | 26.0 / 29.7 | 2 | yes | - |
| unset/12/Rocket | 12×9 | 34 | 5 | 9 [8–13] | 10.2 | 9 (75.0%) | 10.8 | 1.4 [0.0–2.8] | 1.3 | 0.3 | 1.1 | 37.6 / 43.0 | 4 | yes | - |
| unset/12/Pine | 12×11 | 39 | 5 | 12 [10–14] | 12.2 | 8 (66.7%) | 14.2 | 2.2 [0.3–8.5] | 3.3 | 0.4 | 1.8 | 30.8 / 35.2 | 3 | yes | - |
| unset/12/Cat | 12×12 | 62 | 5 | 16 [12–19] | 16.0 | 8 (63.2%) | 22.0 | 6.0 [1.2–15.5] | 6.5 | 0.5 | 4.6 | 28.2 / 32.2 | 4 | yes | - |
| unset/12/Mushroom | 12×11 | 55 | 5 | 14 [12–19] | 15.0 | 8 (58.3%) | 18.6 | 4.6 [2.9–7.6] | 4.7 | 0.6 | 3.9 | 30.8 / 35.2 | 4 | yes | - |
| unset/12/Fish | 12×14 | 78 | 5 | 21 [17–23] | 20.4 | 11 (57.9%) | 27.4 | 7.1 [3.7–9.1] | 6.9 | 0.7 | 6.5 | 24.2 / 27.6 | 2 | yes | - |
| unset/13/Square | 13×13 | 169 | 5 | 40 [38–43] | 40.6 | 16 (41.9%) | 65.3 | 25.3 [18.6–46.3] | 28.4 | 1.3 | 23.1 | 26.0 / 29.7 | 1 | yes | - |
| unset/13/Rectangle | 13×20 | 260 | 5 | 60 [58–67] | 62.0 | 24 (41.4%) | 112.6 | 47.8 [45.6–56.9] | 49.8 | 1.4 | 46.2 | 16.9 / 19.3 | 2 | yes | - |
| unset/13/Circle | 13×13 | 109 | 5 | 25 [23–27] | 25.2 | 13 (48.1%) | 39.6 | 12.6 [11.0–19.0] | 14.0 | 1.0 | 11.6 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Diamond | 13×13 | 81 | 5 | 21 [19–26] | 21.6 | 11 (52.4%) | 27.3 | 6.3 [3.6–14.2] | 7.8 | 0.8 | 5.8 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Triangle | 13×13 | 61 | 5 | 15 [15–17] | 15.6 | 9 (52.9%) | 22.2 | 7.2 [3.5–9.0] | 6.8 | 0.8 | 6.2 | 26.0 / 29.7 | 5 | yes | - |
| unset/13/Plus | 13×13 | 85 | 5 | 22 [19–29] | 22.8 | 9 (42.1%) | 34.8 | 12.8 [3.0–14.1] | 11.0 | 1.2 | 11.2 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Hexagon | 13×13 | 101 | 5 | 27 [22–30] | 26.2 | 10 (41.7%) | 39.9 | 12.8 [9.5–31.9] | 17.2 | 1.3 | 11.6 | 26.0 / 29.7 | 3 | yes | - |
| unset/13/Star | 13×13 | 52 | 5 | 17 [13–17] | 16.0 | 12 (70.6%) | 19.4 | 4.0 [2.3–4.9] | 3.8 | 0.4 | 3.6 | 26.0 / 29.7 | 1 | yes | - |
| unset/13/Heart | 13×13 | 131 | 5 | 31 [28–35] | 31.0 | 15 (50.0%) | 48.4 | 14.1 [12.6–19.1] | 15.3 | 0.9 | 13.2 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Trophy | 13×11 | 36 | 5 | 9 [7–12] | 9.0 | 5 (71.4%) | 12.7 | 1.5 [0.7–7.3] | 3.0 | 0.3 | 1.2 | 30.8 / 35.2 | 4 | yes | - |
| unset/13/Crescent | 13×13 | 53 | 5 | 13 [12–18] | 14.0 | 8 (57.1%) | 17.8 | 3.8 [2.3–9.4] | 4.8 | 0.7 | 3.2 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Flower | 13×13 | 77 | 5 | 18 [16–23] | 18.8 | 11 (57.9%) | 23.8 | 4.8 [1.7–11.2] | 5.7 | 0.7 | 4.2 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Bolt | 13×10 | 16 | 5 | 4 [4–5] | 4.4 | 3 (75.0%) | 5.0 | 0.3 [0.0–1.5] | 0.6 | 0.3 | 0.0 | 33.8 / 38.7 | 3 | yes | - |
| unset/13/Arrow | 13×12 | 48 | 5 | 13 [11–15] | 13.2 | 8 (57.1%) | 16.5 | 3.4 [2.5–10.8] | 4.7 | 0.7 | 2.8 | 28.2 / 32.2 | 5 | yes | - |
| unset/13/Crown | 13×15 | 82 | 5 | 20 [17–24] | 20.6 | 11 (55.0%) | 29.2 | 8.8 [1.2–10.4] | 7.3 | 0.8 | 8.4 | 22.6 / 25.8 | 2 | yes | - |
| unset/13/Hourglass | 13×10 | 50 | 5 | 15 [10–16] | 13.8 | 7 (53.3%) | 19.7 | 4.7 [1.8–8.1] | 4.7 | 0.8 | 3.9 | 33.8 / 38.7 | 3 | yes | - |
| unset/13/Pentagon | 13×13 | 84 | 5 | 19 [16–25] | 20.2 | 12 (50.0%) | 26.8 | 7.6 [5.9–10.0] | 7.6 | 0.9 | 6.6 | 26.0 / 29.7 | 5 | yes | - |
| unset/13/Octagon | 13×13 | 109 | 5 | 25 [23–27] | 25.2 | 13 (48.1%) | 39.6 | 12.6 [11.0–19.0] | 14.0 | 1.0 | 11.6 | 26.0 / 29.7 | 2 | yes | - |
| unset/13/Ring | 13×13 | 84 | 5 | 20 [20–26] | 21.2 | 12 (60.0%) | 26.6 | 6.0 [4.4–21.7] | 8.9 | 0.6 | 5.4 | 26.0 / 29.7 | 5 | yes | - |
| unset/13/X | 13×13 | 61 | 5 | 19 [18–22] | 19.8 | 13 (59.1%) | 25.6 | 6.6 [1.9–9.7] | 6.4 | 0.6 | 5.8 | 26.0 / 29.7 | 3 | yes | - |
| unset/13/Butterfly | 13×14 | 96 | 5 | 23 [20–27] | 23.2 | 12 (55.6%) | 33.3 | 10.7 [8.1–12.6] | 10.5 | 0.8 | 10.0 | 24.2 / 27.6 | 5 | yes | - |
| unset/13/Rocket | 13×10 | 48 | 5 | 13 [9–14] | 12.6 | 9 (66.7%) | 15.4 | 2.8 [0.7–5.6] | 3.0 | 0.4 | 2.1 | 33.8 / 38.7 | 1 | yes | - |
| unset/13/Pine | 13×12 | 48 | 5 | 12 [11–14] | 12.4 | 7 (58.3%) | 17.3 | 4.1 [1.4–6.9] | 3.9 | 0.6 | 3.5 | 28.2 / 32.2 | 3 | yes | - |
| unset/13/Cat | 13×13 | 75 | 5 | 19 [18–25] | 19.8 | 12 (52.6%) | 24.0 | 5.8 [4.7–12.5] | 7.8 | 0.8 | 5.3 | 26.0 / 29.7 | 4 | yes | - |
| unset/13/Mushroom | 13×12 | 66 | 5 | 15 [15–19] | 16.2 | 9 (57.9%) | 23.0 | 8.0 [3.8–10.6] | 7.5 | 0.7 | 7.2 | 28.2 / 32.2 | 2 | yes | - |
| unset/13/Fish | 13×16 | 96 | 5 | 21 [21–24] | 21.8 | 13 (59.1%) | 30.6 | 8.6 [3.2–14.2] | 8.4 | 0.6 | 8.0 | 21.1 / 24.2 | 5 | yes | - |
| unset/14/Square | 14×14 | 196 | 5 | 47 [42–51] | 47.0 | 20 (42.9%) | 86.7 | 35.7 [19.2–40.3] | 34.0 | 1.3 | 34.4 | 24.2 / 27.6 | 2 | yes | - |
| unset/14/Rectangle | 14×21 | 294 | 5 | 71 [67–76] | 71.0 | 27 (38.2%) | 130.1 | 54.1 [45.1–96.3] | 66.9 | 1.6 | 52.5 | 16.1 / 18.4 | 4 | yes | - |
| unset/14/Circle | 14×14 | 124 | 5 | 32 [27–37] | 31.8 | 13 (39.4%) | 50.0 | 18.0 [14.7–26.9] | 19.9 | 1.4 | 16.3 | 24.2 / 27.6 | 4 | yes | - |
| unset/14/Diamond | 14×14 | 84 | 5 | 23 [19–24] | 22.2 | 11 (47.8%) | 30.9 | 6.9 [2.8–15.7] | 8.5 | 1.0 | 5.8 | 24.2 / 27.6 | 3 | yes | - |
| unset/14/Triangle | 14×14 | 72 | 5 | 16 [16–22] | 17.8 | 11 (56.3%) | 22.9 | 6.9 [2.6–13.3] | 8.1 | 0.7 | 6.2 | 24.2 / 27.6 | 2 | yes | - |
| unset/14/Plus | 14×14 | 84 | 5 | 19 [18–25] | 20.6 | 11 (50.0%) | 29.3 | 8.2 [6.1–11.3] | 8.1 | 0.9 | 7.0 | 24.2 / 27.6 | 5 | yes | - |
| unset/14/Hexagon | 14×14 | 116 | 5 | 26 [23–30] | 26.6 | 12 (47.8%) | 39.2 | 10.7 [9.2–20.9] | 12.9 | 1.0 | 9.8 | 24.2 / 27.6 | 3 | yes | - |
| unset/14/Star | 14×14 | 58 | 5 | 12 [11–18] | 13.4 | 8 (63.6%) | 17.3 | 3.4 [2.3–7.8] | 4.6 | 0.5 | 3.1 | 24.2 / 27.6 | 2 | yes | - |
| unset/14/Heart | 14×14 | 148 | 5 | 35 [33–41] | 36.2 | 16 (45.7%) | 57.6 | 22.6 [20.2–25.5] | 23.0 | 1.1 | 21.5 | 24.2 / 27.6 | 2 | yes | - |
| unset/14/Trophy | 14×12 | 48 | 5 | 12 [9–14] | 11.8 | 6 (63.6%) | 14.6 | 4.4 [2.6–7.3] | 4.6 | 0.5 | 4.0 | 28.2 / 32.2 | 1 | yes | - |
| unset/14/Crescent | 14×14 | 61 | 5 | 18 [17–20] | 18.0 | 9 (45.0%) | 26.0 | 7.1 [6.0–14.6] | 8.7 | 1.1 | 5.9 | 24.2 / 27.6 | 3 | yes | - |
| unset/14/Flower | 14×14 | 100 | 5 | 24 [21–30] | 24.6 | 13 (52.2%) | 33.0 | 10.0 [3.3–13.2] | 8.9 | 0.8 | 9.1 | 24.2 / 27.6 | 2 | yes | - |
| unset/14/Bolt | 14×11 | 19 | 5 | 7 [5–9] | 6.8 | 5 (87.5%) | 8.1 | 0.2 [0.0–2.3] | 0.6 | 0.1 | 0.0 | 30.8 / 35.2 | 4 | yes | - |
| unset/14/Arrow | 14×13 | 42 | 5 | 11 [11–13] | 11.8 | 8 (69.2%) | 12.9 | 1.9 [1.7–5.2] | 2.5 | 0.4 | 1.5 | 26.0 / 29.7 | 4 | yes | - |
| unset/14/Crown | 14×16 | 96 | 5 | 22 [18–25] | 22.2 | 11 (52.0%) | 29.3 | 9.3 [7.3–22.9] | 12.2 | 0.9 | 8.7 | 21.1 / 24.2 | 3 | yes | - |
| unset/14/Hourglass | 14×11 | 64 | 5 | 16 [15–19] | 16.6 | 12 (66.7%) | 20.3 | 3.8 [2.0–5.2] | 3.8 | 0.5 | 3.4 | 30.8 / 35.2 | 5 | yes | - |
| unset/14/Pentagon | 14×14 | 102 | 5 | 26 [24–27] | 25.6 | 11 (40.7%) | 44.2 | 19.2 [15.7–28.3] | 20.0 | 1.3 | 18.2 | 24.2 / 27.6 | 5 | yes | - |
| unset/14/Octagon | 14×14 | 120 | 5 | 31 [28–32] | 30.4 | 13 (42.9%) | 48.6 | 16.8 [5.3–20.7] | 15.8 | 1.2 | 15.1 | 24.2 / 27.6 | 1 | yes | - |
| unset/14/Ring | 14×14 | 108 | 5 | 27 [24–29] | 26.6 | 13 (50.0%) | 36.2 | 10.2 [7.9–17.3] | 10.9 | 0.9 | 9.2 | 24.2 / 27.6 | 4 | yes | - |
| unset/14/X | 14×14 | 96 | 5 | 24 [23–27] | 24.4 | 15 (55.6%) | 35.6 | 11.9 [5.1–13.3] | 10.6 | 0.8 | 11.1 | 24.2 / 27.6 | 4 | yes | - |
| unset/14/Butterfly | 14×15 | 106 | 5 | 25 [22–31] | 25.6 | 12 (47.8%) | 35.2 | 11.5 [7.3–16.2] | 11.7 | 1.0 | 10.5 | 22.6 / 25.8 | 5 | yes | - |
| unset/14/Rocket | 14×10 | 48 | 5 | 13 [10–18] | 13.0 | 9 (69.2%) | 15.3 | 2.6 [2.2–3.8] | 2.9 | 0.4 | 2.4 | 33.8 / 38.7 | 4 | yes | - |
| unset/14/Pine | 14×13 | 51 | 5 | 13 [12–18] | 13.8 | 8 (61.5%) | 16.7 | 4.5 [2.4–6.4] | 4.3 | 0.6 | 3.9 | 26.0 / 29.7 | 5 | yes | - |
| unset/14/Cat | 14×14 | 82 | 5 | 19 [17–21] | 19.0 | 12 (61.9%) | 26.0 | 7.0 [5.8–9.1] | 7.3 | 0.6 | 6.5 | 24.2 / 27.6 | 1 | yes | - |
| unset/14/Mushroom | 14×13 | 70 | 5 | 16 [13–19] | 15.8 | 8 (53.3%) | 23.8 | 8.8 [3.5–15.5] | 8.3 | 0.8 | 8.0 | 26.0 / 29.7 | 3 | yes | - |
| unset/14/Fish | 14×17 | 96 | 5 | 25 [21–30] | 24.6 | 12 (57.1%) | 31.3 | 8.2 [4.4–17.6] | 10.2 | 0.7 | 7.5 | 19.9 / 22.7 | 2 | yes | - |
| unset/15/Square | 15×15 | 225 | 5 | 51 [50–60] | 53.2 | 20 (39.2%) | 95.8 | 44.8 [35.9–64.2] | 46.2 | 1.5 | 43.3 | 22.6 / 25.8 | 4 | yes | - |
| unset/15/Rectangle | 15×22 | 330 | 5 | 83 [81–87] | 83.2 | 29 (35.8%) | 157.0 | 76.0 [63.4–90.4] | 76.0 | 1.7 | 74.2 | 15.4 / 17.6 | 5 | yes | - |
| unset/15/Circle | 15×15 | 145 | 5 | 38 [30–40] | 36.8 | 15 (45.9%) | 60.2 | 21.2 [14.7–22.6] | 19.3 | 1.1 | 20.1 | 22.6 / 25.8 | 2 | yes | - |
| unset/15/Diamond | 15×15 | 109 | 5 | 30 [26–33] | 30.0 | 14 (51.5%) | 46.3 | 13.4 [9.7–22.6] | 15.0 | 0.9 | 12.5 | 22.6 / 25.8 | 5 | yes | - |
| unset/15/Triangle | 15×15 | 85 | 5 | 19 [19–22] | 19.8 | 10 (52.6%) | 29.1 | 9.2 [1.7–14.5] | 9.0 | 0.8 | 8.3 | 22.6 / 25.8 | 4 | yes | - |
| unset/15/Plus | 15×15 | 105 | 5 | 22 [20–24] | 22.0 | 10 (50.0%) | 34.9 | 11.6 [7.6–15.2] | 11.5 | 0.9 | 10.8 | 22.6 / 25.8 | 2 | yes | - |
| unset/15/Hexagon | 15×15 | 133 | 5 | 30 [27–35] | 30.4 | 13 (44.8%) | 43.9 | 13.4 [8.8–18.5] | 13.7 | 1.1 | 12.5 | 22.6 / 25.8 | 3 | yes | - |
| unset/15/Star | 15×15 | 70 | 5 | 19 [17–23] | 19.6 | 12 (63.2%) | 24.8 | 3.8 [2.3–12.9] | 5.7 | 0.5 | 3.5 | 22.6 / 25.8 | 5 | yes | - |
| unset/15/Heart | 15×15 | 169 | 5 | 41 [37–46] | 40.8 | 19 (47.4%) | 60.5 | 23.5 [17.5–38.7] | 26.5 | 1.1 | 22.6 | 22.6 / 25.8 | 1 | yes | - |
| unset/15/Trophy | 15×13 | 56 | 5 | 15 [13–15] | 14.4 | 7 (46.7%) | 20.9 | 6.0 [3.5–12.2] | 6.9 | 1.0 | 5.0 | 26.0 / 29.7 | 5 | yes | - |
| unset/15/Crescent | 15×15 | 73 | 5 | 19 [15–25] | 18.8 | 11 (66.7%) | 24.0 | 5.2 [5.0–23.5] | 9.7 | 0.5 | 4.8 | 22.6 / 25.8 | 3 | yes | - |
| unset/15/Flower | 15×15 | 101 | 5 | 25 [23–35] | 27.0 | 12 (47.8%) | 39.4 | 14.7 [9.0–17.9] | 13.5 | 1.0 | 13.7 | 22.6 / 25.8 | 3 | yes | - |
| unset/15/Bolt | 15×12 | 21 | 5 | 8 [6–8] | 7.4 | 6 (75.0%) | 8.0 | 0.4 [0.0–1.8] | 0.6 | 0.3 | 0.1 | 28.2 / 32.2 | 3 | yes | - |
| unset/15/Arrow | 15×14 | 60 | 5 | 14 [13–17] | 14.4 | 9 (64.3%) | 19.7 | 5.7 [1.9–8.7] | 4.9 | 0.5 | 4.8 | 24.2 / 27.6 | 5 | yes | - |
| unset/15/Crown | 15×17 | 114 | 5 | 26 [25–28] | 26.4 | 13 (52.0%) | 40.2 | 12.2 [8.1–15.7] | 12.4 | 0.9 | 11.1 | 19.9 / 22.7 | 3 | yes | - |
| unset/15/Hourglass | 15×12 | 70 | 5 | 19 [13–25] | 19.6 | 11 (57.9%) | 27.1 | 5.6 [3.5–8.1] | 5.9 | 0.7 | 5.1 | 28.2 / 32.2 | 5 | yes | - |
| unset/15/Pentagon | 15×15 | 118 | 5 | 30 [27–32] | 29.8 | 13 (43.8%) | 48.0 | 16.6 [9.5–20.7] | 15.6 | 1.2 | 15.2 | 22.6 / 25.8 | 1 | yes | - |
| unset/15/Octagon | 15×15 | 145 | 5 | 38 [30–40] | 36.8 | 15 (45.9%) | 60.2 | 21.2 [14.7–22.6] | 19.3 | 1.1 | 20.1 | 22.6 / 25.8 | 2 | yes | - |
| unset/15/Ring | 15×15 | 116 | 5 | 27 [26–31] | 27.8 | 15 (55.6%) | 35.5 | 9.3 [6.4–14.6] | 10.0 | 0.8 | 8.6 | 22.6 / 25.8 | 1 | yes | - |
| unset/15/X | 15×15 | 105 | 5 | 28 [25–30] | 27.8 | 19 (65.5%) | 37.1 | 9.3 [7.3–10.4] | 9.0 | 0.5 | 8.9 | 22.6 / 25.8 | 4 | yes | - |
| unset/15/Butterfly | 15×16 | 128 | 5 | 33 [28–34] | 31.4 | 13 (46.4%) | 47.8 | 15.6 [13.8–28.2] | 17.6 | 1.1 | 14.5 | 21.1 / 24.2 | 3 | yes | - |
| unset/15/Rocket | 15×11 | 61 | 5 | 16 [10–20] | 15.8 | 9 (50.0%) | 22.0 | 5.7 [2.8–8.2] | 5.3 | 0.8 | 4.9 | 30.8 / 35.2 | 4 | yes | - |
| unset/15/Pine | 15×14 | 68 | 5 | 18 [15–22] | 17.6 | 11 (61.1%) | 20.5 | 4.5 [2.5–15.2] | 7.8 | 0.6 | 4.2 | 24.2 / 27.6 | 4 | yes | - |
| unset/15/Cat | 15×15 | 92 | 5 | 23 [21–24] | 22.8 | 12 (56.5%) | 30.6 | 7.6 [6.6–11.0] | 8.3 | 0.7 | 6.9 | 22.6 / 25.8 | 2 | yes | - |
| unset/15/Mushroom | 15×14 | 88 | 5 | 24 [19–25] | 22.4 | 13 (60.0%) | 30.6 | 8.3 [4.3–11.6] | 8.0 | 0.6 | 7.7 | 24.2 / 27.6 | 3 | yes | - |
| unset/15/Fish | 15×18 | 116 | 5 | 29 [27–32] | 29.2 | 15 (50.0%) | 42.3 | 12.3 [11.8–16.6] | 13.8 | 0.9 | 11.4 | 18.8 / 21.5 | 3 | yes | - |
| unset/16/Square | 16×16 | 256 | 5 | 62 [59–69] | 63.6 | 21 (33.9%) | 115.8 | 54.0 [46.8–64.8] | 53.7 | 1.9 | 52.0 | 21.1 / 24.2 | 1 | yes | - |
| unset/16/Rectangle | 16×24 | 384 | 5 | 93 [87–107] | 96.8 | 34 (37.0%) | 190.8 | 92.9 [85.4–104.8] | 95.1 | 1.7 | 91.0 | 14.1 / 16.1 | 3 | NO | - |
| unset/16/Circle | 16×16 | 164 | 5 | 42 [38–44] | 41.8 | 20 (45.5%) | 67.1 | 23.4 [17.9–30.5] | 23.9 | 1.1 | 22.5 | 21.1 / 24.2 | 5 | yes | - |
| unset/16/Diamond | 16×16 | 112 | 5 | 28 [27–32] | 29.2 | 15 (46.9%) | 42.2 | 13.6 [9.8–16.6] | 13.5 | 1.1 | 12.6 | 21.1 / 24.2 | 2 | yes | - |
| unset/16/Triangle | 16×16 | 98 | 5 | 23 [19–24] | 21.8 | 11 (52.6%) | 29.9 | 6.0 [5.0–10.3] | 7.1 | 0.8 | 5.3 | 21.1 / 24.2 | 1 | yes | - |
| unset/16/Plus | 16×16 | 132 | 5 | 29 [26–34] | 29.8 | 12 (38.7%) | 46.5 | 18.3 [14.8–30.6] | 21.0 | 1.5 | 17.0 | 21.1 / 24.2 | 2 | yes | - |
| unset/16/Hexagon | 16×16 | 156 | 5 | 35 [32–38] | 35.6 | 14 (40.6%) | 55.8 | 22.2 [15.5–29.1] | 22.7 | 1.4 | 20.8 | 21.1 / 24.2 | 4 | yes | - |
| unset/16/Star | 16×16 | 80 | 5 | 20 [17–25] | 21.0 | 12 (58.8%) | 30.4 | 7.4 [4.3–12.4] | 8.2 | 0.6 | 6.9 | 21.1 / 24.2 | 5 | yes | - |
| unset/16/Heart | 16×16 | 198 | 5 | 49 [43–53] | 48.6 | 19 (35.8%) | 87.0 | 39.0 [27.9–43.6] | 36.7 | 1.7 | 37.1 | 21.1 / 24.2 | 1 | yes | - |
| unset/16/Trophy | 16×14 | 66 | 5 | 16 [12–19] | 15.6 | 9 (56.3%) | 22.5 | 4.1 [2.4–11.0] | 5.4 | 0.7 | 3.7 | 24.2 / 27.6 | 5 | yes | - |
| unset/16/Crescent | 16×16 | 82 | 5 | 20 [19–25] | 21.2 | 12 (57.9%) | 27.8 | 8.5 [3.5–10.9] | 7.9 | 0.7 | 7.8 | 21.1 / 24.2 | 2 | yes | - |
| unset/16/Flower | 16×16 | 124 | 5 | 29 [27–36] | 30.4 | 14 (46.4%) | 46.6 | 17.6 [7.9–22.5] | 16.1 | 1.1 | 16.5 | 21.1 / 24.2 | 2 | yes | - |
| unset/16/Bolt | 16×13 | 24 | 5 | 7 [5–8] | 6.6 | 5 (80.0%) | 7.3 | 0.3 [0.2–0.6] | 0.4 | 0.2 | 0.0 | 26.0 / 29.7 | 1 | yes | - |
| unset/16/Arrow | 16×14 | 62 | 5 | 14 [12–19] | 14.6 | 11 (63.2%) | 24.5 | 6.9 [0.3–10.9] | 6.1 | 0.5 | 6.3 | 24.2 / 27.6 | 5 | yes | - |
| unset/16/Crown | 16×18 | 116 | 5 | 25 [23–30] | 26.2 | 12 (50.0%) | 40.6 | 14.2 [11.3–15.6] | 14.1 | 0.9 | 13.3 | 18.8 / 21.5 | 1 | yes | - |
| unset/16/Hourglass | 16×13 | 86 | 5 | 22 [16–23] | 20.8 | 12 (59.1%) | 31.4 | 8.4 [4.5–11.7] | 8.6 | 0.6 | 7.9 | 26.0 / 29.7 | 4 | yes | - |
| unset/16/Pentagon | 16×16 | 138 | 5 | 33 [28–37] | 32.6 | 15 (45.5%) | 50.8 | 17.8 [11.2–28.2] | 17.6 | 1.1 | 16.5 | 21.1 / 24.2 | 2 | yes | - |
| unset/16/Octagon | 16×16 | 156 | 5 | 41 [38–43] | 40.8 | 18 (41.9%) | 64.5 | 24.5 [17.5–32.9] | 25.1 | 1.3 | 23.1 | 21.1 / 24.2 | 1 | yes | - |
| unset/16/Ring | 16×16 | 128 | 5 | 31 [25–35] | 30.8 | 16 (51.4%) | 47.0 | 15.4 [9.9–16.2] | 14.3 | 0.9 | 14.5 | 21.1 / 24.2 | 3 | yes | - |
| unset/16/X | 16×16 | 116 | 5 | 30 [27–31] | 29.2 | 19 (67.9%) | 38.0 | 10.0 [6.7–20.0] | 12.2 | 0.5 | 9.5 | 21.1 / 24.2 | 3 | yes | - |
| unset/16/Butterfly | 16×18 | 156 | 5 | 36 [34–41] | 37.0 | 19 (55.9%) | 52.1 | 18.1 [11.1–33.1] | 19.2 | 0.8 | 17.3 | 18.8 / 21.5 | 5 | yes | - |
| unset/16/Rocket | 16×12 | 76 | 5 | 22 [18–23] | 21.2 | 12 (54.5%) | 29.6 | 9.1 [4.9–11.7] | 8.7 | 0.8 | 8.2 | 28.2 / 32.2 | 5 | yes | - |
| unset/16/Pine | 16×14 | 74 | 5 | 17 [15–21] | 17.4 | 11 (64.7%) | 19.3 | 3.2 [2.2–8.8] | 4.4 | 0.5 | 2.5 | 24.2 / 27.6 | 3 | yes | - |
| unset/16/Cat | 16×16 | 108 | 5 | 29 [24–31] | 27.8 | 12 (41.7%) | 41.9 | 16.3 [7.0–17.9] | 13.9 | 1.3 | 15.5 | 21.1 / 24.2 | 4 | yes | - |
| unset/16/Mushroom | 16×15 | 102 | 5 | 27 [22–28] | 26.0 | 15 (59.1%) | 34.1 | 8.5 [6.1–11.8] | 8.8 | 0.6 | 7.9 | 22.6 / 25.8 | 2 | yes | - |
| unset/16/Fish | 16×19 | 132 | 5 | 29 [28–32] | 29.6 | 16 (55.2%) | 43.3 | 12.8 [10.5–19.4] | 14.4 | 0.8 | 12.0 | 17.8 / 20.4 | 4 | yes | - |

## Appendix B: every candidate row, b = 3

| row | rows×cols | mask cells | n | arrows median [min–max] | arrows mean | clearable@0 median (%) | scan median | blocked median [min–max] | blocked mean | blocked@deal median | blocked after 1st removal median | cellPt 360 / 411 | median seed | blocked < v1 L1 | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| b3/6/Square | 6×6 | 36 | 5 | 9 [6–10] | 8.4 | 6 (66.7%) | 9.7 | 0.9 [0.0–3.9] | 1.7 | 0.4 | 0.5 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Rectangle | 6×9 | 54 | 5 | 13 [12–16] | 13.4 | 8 (66.7%) | 17.9 | 4.9 [2.1–12.5] | 5.8 | 0.4 | 4.4 | 37.6 / 43.0 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Circle | 6×6 | 24 | 5 | 7 [7–8] | 7.4 | 7 (100.0%) | 7.9 | 0.0 [0.0–0.9] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Diamond | 6×6 | 12 | 5 | 4 [3–6] | 4.4 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.5] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Triangle | 6×6 | 12 | 5 | 4 [2–5] | 3.6 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Plus | 6×6 | 20 | 5 | 5 [3–7] | 5.0 | 5 (85.7%) | 5.5 | 0.4 [0.0–1.6] | 0.7 | 0.1 | 0.2 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Hexagon | 6×6 | 20 | 5 | 6 [4–6] | 5.4 | 5 (83.3%) | 6.6 | 0.6 [0.0–0.9] | 0.4 | 0.2 | 0.5 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Star | 6×6 | 10 | 5 | 4 [3–5] | 4.0 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Heart | 6×6 | 26 | 5 | 7 [6–8] | 7.2 | 5 (71.4%) | 8.5 | 1.5 [0.0–2.6] | 1.2 | 0.3 | 1.2 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Trophy | 6×5 | 9 | 5 | 5 [4–6] | 5.0 | 4 (83.3%) | 5.8 | 0.2 [0.0–1.1] | 0.4 | 0.2 | 0.0 | 67.7 / 77.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Crescent | 6×6 | 11 | 5 | 5 [3–5] | 4.2 | 4 (100.0%) | 5.0 | 0.0 [0.0–1.3] | 0.3 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Flower | 6×6 | 20 | 5 | 5 [3–7] | 5.0 | 5 (85.7%) | 5.5 | 0.4 [0.0–1.6] | 0.7 | 0.1 | 0.2 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Bolt | 6×5 | 4 | 5 | 1 [1–1] | 1.0 | 1 (100.0%) | 1.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 67.7 / 77.3 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Arrow | 6×5 | 8 | 5 | 3 [3–3] | 3.0 | 3 (100.0%) | 3.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 67.7 / 77.3 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Crown | 6×7 | 14 | 5 | 4 [4–5] | 4.2 | 4 (100.0%) | 4.3 | 0.0 [0.0–1.7] | 0.4 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Hourglass | 6×5 | 14 | 5 | 4 [3–4] | 3.8 | 3 (75.0%) | 4.0 | 0.3 [0.0–1.1] | 0.5 | 0.3 | 0.0 | 67.7 / 77.3 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Pentagon | 6×6 | 18 | 5 | 5 [3–6] | 4.8 | 4 (80.0%) | 5.2 | 0.2 [0.0–1.5] | 0.5 | 0.2 | 0.0 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Octagon | 6×6 | 24 | 5 | 7 [7–8] | 7.4 | 7 (100.0%) | 7.9 | 0.0 [0.0–0.9] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Ring | 6×6 | 20 | 5 | 6 [4–8] | 6.0 | 6 (87.5%) | 6.0 | 0.1 [0.0–0.8] | 0.2 | 0.1 | 0.0 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/X | 6×6 | 8 | 5 | 6 [6–7] | 6.2 | 5 (83.3%) | 6.6 | 0.4 [0.0–1.4] | 0.5 | 0.2 | 0.2 | 56.4 / 64.5 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Butterfly | 6×7 | 24 | 5 | 6 [4–10] | 6.4 | 5 (83.3%) | 7.0 | 0.9 [0.0–2.5] | 1.1 | 0.2 | 0.8 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Rocket | 6×4 | 8 | 5 | 2 [1–3] | 2.0 | 2 (100.0%) | 2.0 | 0.0 [0.0–0.8] | 0.3 | 0.0 | 0.0 | 84.6 / 96.7 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Pine | 6×5 | 8 | 5 | 3 [3–5] | 3.8 | 3 (80.0%) | 3.3 | 0.3 [0.0–1.3] | 0.4 | 0.2 | 0.0 | 67.7 / 77.3 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Cat | 6×6 | 14 | 5 | 4 [3–5] | 4.0 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.3] | 0.1 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Mushroom | 6×6 | 14 | 5 | 3 [3–5] | 3.4 | 3 (100.0%) | 3.0 | 0.0 [0.0–0.5] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/6/Fish | 6×7 | 20 | 5 | 4 [4–7] | 4.6 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Square | 7×7 | 49 | 5 | 12 [8–14] | 11.0 | 7 (75.0%) | 14.1 | 2.8 [1.2–8.9] | 3.6 | 0.3 | 2.5 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Rectangle | 7×10 | 70 | 5 | 18 [14–20] | 17.8 | 13 (71.4%) | 22.5 | 4.3 [2.7–8.6] | 4.7 | 0.4 | 3.9 | 33.8 / 38.7 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Circle | 7×7 | 37 | 5 | 9 [7–11] | 9.0 | 8 (87.5%) | 9.2 | 0.7 [0.0–2.0] | 0.8 | 0.1 | 0.5 | 48.3 / 55.2 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Diamond | 7×7 | 21 | 5 | 6 [4–7] | 5.6 | 4 (66.7%) | 6.5 | 1.2 [0.0–2.4] | 1.1 | 0.4 | 0.9 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Triangle | 7×7 | 17 | 5 | 5 [3–6] | 5.0 | 5 (100.0%) | 5.0 | 0.0 [0.0–2.9] | 0.6 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Plus | 7×7 | 25 | 5 | 8 [7–9] | 8.2 | 7 (88.9%) | 8.3 | 0.3 [0.0–0.7] | 0.3 | 0.1 | 0.1 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Hexagon | 7×7 | 27 | 5 | 7 [5–9] | 7.0 | 6 (100.0%) | 7.5 | 0.0 [0.0–1.2] | 0.3 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Star | 7×7 | 14 | 5 | 5 [4–5] | 4.8 | 5 (100.0%) | 5.0 | 0.0 [0.0–0.2] | 0.0 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Heart | 7×7 | 36 | 5 | 10 [9–11] | 10.0 | 8 (72.7%) | 11.7 | 1.2 [0.0–2.7] | 1.3 | 0.3 | 0.9 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Trophy | 7×6 | 10 | 5 | 5 [4–5] | 4.6 | 4 (100.0%) | 5.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Crescent | 7×7 | 19 | 5 | 6 [4–7] | 5.6 | 4 (71.4%) | 7.9 | 0.9 [0.0–2.0] | 0.8 | 0.3 | 0.6 | 48.3 / 55.2 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Flower | 7×7 | 25 | 5 | 8 [7–9] | 8.2 | 7 (88.9%) | 8.3 | 0.3 [0.0–0.7] | 0.3 | 0.1 | 0.1 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Bolt | 7×6 | 6 | 5 | 5 [4–5] | 4.8 | 3 (75.0%) | 5.8 | 0.8 [0.0–2.0] | 1.0 | 0.3 | 0.6 | 56.4 / 64.5 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Arrow | 7×6 | 12 | 5 | 6 [3–7] | 5.4 | 6 (100.0%) | 6.0 | 0.0 [0.0–0.3] | 0.1 | 0.0 | 0.0 | 56.4 / 64.5 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Crown | 7×8 | 22 | 5 | 6 [4–7] | 5.6 | 4 (75.0%) | 6.0 | 0.3 [0.0–1.2] | 0.4 | 0.3 | 0.0 | 42.3 / 48.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Hourglass | 7×6 | 22 | 5 | 7 [5–9] | 7.2 | 6 (85.7%) | 8.6 | 0.6 [0.0–1.6] | 0.8 | 0.1 | 0.3 | 56.4 / 64.5 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Pentagon | 7×7 | 26 | 5 | 9 [7–10] | 8.4 | 7 (100.0%) | 9.0 | 0.0 [0.0–2.2] | 0.4 | 0.0 | 0.0 | 48.3 / 55.2 | 2 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Octagon | 7×7 | 37 | 5 | 9 [7–11] | 9.0 | 8 (87.5%) | 9.2 | 0.7 [0.0–2.0] | 0.8 | 0.1 | 0.5 | 48.3 / 55.2 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Ring | 7×7 | 28 | 5 | 8 [6–10] | 7.8 | 7 (100.0%) | 8.0 | 0.0 [0.0–2.1] | 0.7 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/X | 7×7 | 29 | 5 | 12 [11–13] | 12.2 | 11 (91.7%) | 12.4 | 0.5 [0.0–1.9] | 0.7 | 0.1 | 0.4 | 48.3 / 55.2 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Butterfly | 7×8 | 30 | 5 | 9 [6–10] | 8.2 | 6 (83.3%) | 9.0 | 0.4 [0.0–1.7] | 0.7 | 0.2 | 0.2 | 42.3 / 48.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Rocket | 7×5 | 13 | 5 | 4 [2–7] | 4.0 | 3 (75.0%) | 4.0 | 0.3 [0.0–1.2] | 0.5 | 0.3 | 0.0 | 67.7 / 77.3 | 4 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Pine | 7×6 | 10 | 5 | 3 [2–4] | 3.2 | 3 (100.0%) | 3.8 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Cat | 7×7 | 20 | 5 | 5 [4–7] | 5.4 | 4 (80.0%) | 6.3 | 1.3 [0.0–2.3] | 1.0 | 0.2 | 0.9 | 48.3 / 55.2 | 1 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Mushroom | 7×7 | 24 | 5 | 8 [6–9] | 7.8 | 6 (77.8%) | 8.8 | 0.8 [0.0–1.7] | 0.9 | 0.3 | 0.5 | 48.3 / 55.2 | 5 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/7/Fish | 7×8 | 26 | 5 | 6 [5–8] | 6.0 | 5 (83.3%) | 7.5 | 0.5 [0.0–2.7] | 0.9 | 0.2 | 0.3 | 42.3 / 48.3 | 3 | yes | rows < 8: below v2's row floor (V2_MIN_GRID_ROWS) |
| b3/8/Square | 8×8 | 64 | 5 | 14 [13–16] | 14.4 | 9 (61.5%) | 19.5 | 6.5 [0.6–7.0] | 4.4 | 0.6 | 5.9 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/Rectangle | 8×12 | 96 | 5 | 22 [19–25] | 21.8 | 14 (68.2%) | 28.0 | 6.0 [3.2–6.5] | 5.3 | 0.4 | 5.6 | 28.2 / 32.2 | 2 | yes | - |
| b3/8/Circle | 8×8 | 44 | 5 | 10 [9–15] | 10.8 | 8 (70.0%) | 12.1 | 2.1 [0.4–5.7] | 2.4 | 0.4 | 1.8 | 42.3 / 48.3 | 4 | yes | - |
| b3/8/Diamond | 8×8 | 24 | 5 | 7 [7–8] | 7.4 | 7 (100.0%) | 7.9 | 0.0 [0.0–0.9] | 0.2 | 0.0 | 0.0 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/Triangle | 8×8 | 24 | 5 | 6 [4–8] | 6.0 | 5 (83.3%) | 6.4 | 0.5 [0.0–1.1] | 0.5 | 0.2 | 0.2 | 42.3 / 48.3 | 3 | yes | - |
| b3/8/Plus | 8×8 | 32 | 5 | 8 [7–10] | 8.4 | 8 (88.9%) | 8.4 | 0.2 [0.0–0.4] | 0.2 | 0.1 | 0.0 | 42.3 / 48.3 | 3 | yes | - |
| b3/8/Hexagon | 8×8 | 36 | 5 | 8 [7–10] | 8.6 | 7 (90.0%) | 9.5 | 0.5 [0.0–1.5] | 0.6 | 0.1 | 0.4 | 42.3 / 48.3 | 4 | yes | - |
| b3/8/Star | 8×8 | 20 | 5 | 6 [5–7] | 5.8 | 5 (83.3%) | 6.6 | 0.2 [0.0–0.6] | 0.3 | 0.2 | 0.0 | 42.3 / 48.3 | 4 | yes | - |
| b3/8/Heart | 8×8 | 48 | 5 | 10 [9–11] | 10.0 | 8 (77.8%) | 11.2 | 1.2 [0.4–2.9] | 1.3 | 0.3 | 0.9 | 42.3 / 48.3 | 3 | yes | - |
| b3/8/Trophy | 8×7 | 12 | 5 | 4 [3–5] | 4.0 | 3 (66.7%) | 4.6 | 0.8 [0.0–1.5] | 0.7 | 0.3 | 0.5 | 48.3 / 55.2 | 2 | yes | - |
| b3/8/Crescent | 8×8 | 22 | 5 | 5 [5–6] | 5.4 | 5 (100.0%) | 5.0 | 0.0 [0.0–2.8] | 0.6 | 0.0 | 0.0 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/Flower | 8×8 | 24 | 5 | 7 [7–8] | 7.4 | 7 (100.0%) | 7.9 | 0.0 [0.0–0.9] | 0.2 | 0.0 | 0.0 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/Bolt | 8×6 | 4 | 5 | 4 [4–4] | 4.0 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 56.4 / 64.5 | 1 | yes | - |
| b3/8/Arrow | 8×7 | 11 | 5 | 3 [2–5] | 3.0 | 2 (100.0%) | 3.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | - |
| b3/8/Crown | 8×9 | 30 | 5 | 6 [5–11] | 7.2 | 6 (100.0%) | 6.9 | 0.0 [0.0–3.7] | 0.9 | 0.0 | 0.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/8/Hourglass | 8×6 | 24 | 5 | 10 [6–14] | 9.8 | 8 (71.4%) | 11.0 | 0.4 [0.0–2.3] | 0.9 | 0.4 | 0.0 | 56.4 / 64.5 | 5 | yes | - |
| b3/8/Pentagon | 8×8 | 32 | 5 | 7 [6–9] | 7.4 | 6 (85.7%) | 7.5 | 0.5 [0.0–3.0] | 1.0 | 0.1 | 0.4 | 42.3 / 48.3 | 4 | yes | - |
| b3/8/Octagon | 8×8 | 40 | 5 | 10 [9–13] | 11.0 | 8 (70.0%) | 12.8 | 1.1 [0.2–3.1] | 1.7 | 0.4 | 0.7 | 42.3 / 48.3 | 5 | yes | - |
| b3/8/Ring | 8×8 | 32 | 5 | 7 [6–9] | 7.4 | 6 (71.4%) | 8.6 | 1.1 [0.0–2.9] | 1.2 | 0.3 | 0.6 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/X | 8×8 | 36 | 5 | 12 [11–14] | 12.6 | 11 (90.9%) | 13.0 | 0.5 [0.1–1.8] | 0.8 | 0.1 | 0.4 | 42.3 / 48.3 | 2 | yes | - |
| b3/8/Butterfly | 8×9 | 42 | 5 | 10 [8–13] | 10.0 | 7 (77.8%) | 10.5 | 1.5 [0.0–4.6] | 1.8 | 0.3 | 1.2 | 37.6 / 43.0 | 4 | yes | - |
| b3/8/Rocket | 8×6 | 14 | 5 | 3 [3–5] | 3.4 | 3 (80.0%) | 3.8 | 0.5 [0.0–0.8] | 0.4 | 0.2 | 0.3 | 56.4 / 64.5 | 2 | yes | - |
| b3/8/Pine | 8×7 | 17 | 5 | 5 [4–6] | 4.8 | 4 (100.0%) | 5.1 | 0.0 [0.0–1.1] | 0.4 | 0.0 | 0.0 | 48.3 / 55.2 | 3 | yes | - |
| b3/8/Cat | 8×8 | 28 | 5 | 6 [6–8] | 6.4 | 5 (83.3%) | 7.5 | 1.2 [0.2–1.6] | 1.0 | 0.2 | 1.1 | 42.3 / 48.3 | 5 | yes | - |
| b3/8/Mushroom | 8×8 | 26 | 5 | 6 [6–6] | 6.0 | 5 (83.3%) | 7.0 | 0.9 [0.2–1.1] | 0.8 | 0.2 | 0.7 | 42.3 / 48.3 | 1 | yes | - |
| b3/8/Fish | 8×10 | 36 | 5 | 9 [8–10] | 9.0 | 6 (75.0%) | 10.2 | 1.7 [1.2–2.1] | 1.7 | 0.3 | 1.3 | 33.8 / 38.7 | 2 | yes | - |
| b3/9/Square | 9×9 | 81 | 5 | 18 [15–23] | 18.6 | 11 (61.1%) | 24.0 | 4.6 [3.6–8.2] | 5.3 | 0.6 | 3.9 | 37.6 / 43.0 | 1 | yes | - |
| b3/9/Rectangle | 9×14 | 126 | 5 | 32 [25–40] | 32.2 | 17 (53.1%) | 47.3 | 15.3 [9.1–21.3] | 14.9 | 0.8 | 14.5 | 24.2 / 27.6 | 4 | yes | - |
| b3/9/Circle | 9×9 | 57 | 5 | 14 [13–15] | 14.2 | 13 (86.7%) | 16.1 | 1.1 [0.0–3.8] | 1.7 | 0.1 | 1.0 | 37.6 / 43.0 | 2 | yes | - |
| b3/9/Diamond | 9×9 | 37 | 5 | 9 [7–11] | 9.0 | 8 (87.5%) | 9.2 | 0.7 [0.0–2.0] | 0.8 | 0.1 | 0.5 | 37.6 / 43.0 | 4 | yes | - |
| b3/9/Triangle | 9×9 | 31 | 5 | 7 [7–8] | 7.4 | 6 (85.7%) | 7.1 | 0.1 [0.0–2.5] | 0.8 | 0.1 | 0.0 | 37.6 / 43.0 | 4 | yes | - |
| b3/9/Plus | 9×9 | 45 | 5 | 14 [13–16] | 14.2 | 9 (69.2%) | 16.9 | 3.1 [2.4–5.2] | 3.4 | 0.4 | 2.4 | 37.6 / 43.0 | 1 | yes | - |
| b3/9/Hexagon | 9×9 | 47 | 5 | 11 [10–13] | 11.2 | 8 (72.7%) | 12.6 | 1.6 [0.6–2.4] | 1.6 | 0.3 | 1.2 | 37.6 / 43.0 | 4 | yes | - |
| b3/9/Star | 9×9 | 24 | 5 | 7 [5–9] | 7.0 | 5 (71.4%) | 8.5 | 1.5 [0.8–2.1] | 1.4 | 0.3 | 1.2 | 37.6 / 43.0 | 2 | yes | - |
| b3/9/Heart | 9×9 | 60 | 5 | 14 [12–17] | 14.4 | 10 (62.5%) | 20.1 | 4.1 [0.5–6.1] | 3.8 | 0.5 | 3.5 | 37.6 / 43.0 | 5 | yes | - |
| b3/9/Trophy | 9×8 | 18 | 5 | 5 [4–7] | 5.6 | 5 (75.0%) | 6.2 | 0.6 [0.0–1.5] | 0.6 | 0.3 | 0.3 | 42.3 / 48.3 | 2 | yes | - |
| b3/9/Crescent | 9×9 | 28 | 5 | 8 [7–9] | 8.0 | 7 (87.5%) | 8.3 | 0.5 [0.0–1.9] | 0.7 | 0.1 | 0.4 | 37.6 / 43.0 | 2 | yes | - |
| b3/9/Flower | 9×9 | 37 | 5 | 9 [7–11] | 9.0 | 8 (87.5%) | 9.2 | 0.7 [0.0–2.0] | 0.8 | 0.1 | 0.5 | 37.6 / 43.0 | 4 | yes | - |
| b3/9/Bolt | 9×7 | 5 | 5 | 1 [1–1] | 1.0 | 1 (100.0%) | 1.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 48.3 / 55.2 | 1 | yes | - |
| b3/9/Arrow | 9×8 | 18 | 5 | 7 [7–8] | 7.2 | 7 (100.0%) | 7.0 | 0.0 [0.0–1.5] | 0.4 | 0.0 | 0.0 | 42.3 / 48.3 | 3 | yes | - |
| b3/9/Crown | 9×10 | 40 | 5 | 10 [6–12] | 9.4 | 7 (77.8%) | 10.8 | 1.0 [0.6–4.5] | 2.0 | 0.3 | 0.8 | 33.8 / 38.7 | 2 | yes | - |
| b3/9/Hourglass | 9×7 | 23 | 5 | 6 [5–7] | 6.0 | 4 (66.7%) | 7.6 | 1.6 [0.5–2.3] | 1.5 | 0.4 | 1.2 | 48.3 / 55.2 | 1 | yes | - |
| b3/9/Pentagon | 9×9 | 42 | 5 | 9 [8–15] | 10.8 | 8 (100.0%) | 10.3 | 0.0 [0.0–8.3] | 1.9 | 0.0 | 0.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/9/Octagon | 9×9 | 45 | 5 | 12 [10–13] | 11.6 | 9 (75.0%) | 14.0 | 2.7 [0.8–3.6] | 2.2 | 0.3 | 2.4 | 37.6 / 43.0 | 5 | yes | - |
| b3/9/Ring | 9×9 | 40 | 5 | 12 [11–12] | 11.8 | 8 (66.7%) | 13.9 | 1.9 [0.7–2.2] | 1.7 | 0.4 | 1.5 | 37.6 / 43.0 | 5 | yes | - |
| b3/9/X | 9×9 | 41 | 5 | 15 [15–16] | 15.4 | 13 (81.3%) | 16.6 | 1.3 [0.6–2.5] | 1.5 | 0.2 | 1.0 | 37.6 / 43.0 | 3 | yes | - |
| b3/9/Butterfly | 9×10 | 58 | 5 | 15 [12–19] | 14.6 | 9 (66.7%) | 21.1 | 5.1 [2.7–7.9] | 5.4 | 0.4 | 4.7 | 33.8 / 38.7 | 1 | yes | - |
| b3/9/Rocket | 9×7 | 23 | 5 | 7 [4–8] | 6.6 | 5 (75.0%) | 7.9 | 0.9 [0.1–1.1] | 0.7 | 0.3 | 0.5 | 48.3 / 55.2 | 3 | yes | - |
| b3/9/Pine | 9×8 | 24 | 5 | 7 [6–9] | 7.2 | 6 (66.7%) | 7.2 | 1.2 [0.0–2.1] | 1.0 | 0.4 | 0.4 | 42.3 / 48.3 | 1 | yes | - |
| b3/9/Cat | 9×9 | 30 | 5 | 7 [6–9] | 7.4 | 6 (85.7%) | 8.8 | 0.8 [0.0–1.8] | 0.9 | 0.1 | 0.6 | 37.6 / 43.0 | 2 | yes | - |
| b3/9/Mushroom | 9×9 | 34 | 5 | 10 [7–12] | 9.6 | 8 (72.7%) | 10.0 | 1.1 [0.0–3.6] | 1.2 | 0.3 | 0.8 | 37.6 / 43.0 | 2 | yes | - |
| b3/9/Fish | 9×11 | 45 | 5 | 12 [11–14] | 12.4 | 10 (71.4%) | 14.4 | 1.8 [0.3–3.6] | 1.8 | 0.4 | 1.4 | 30.8 / 35.2 | 3 | yes | - |
| b3/10/Square | 10×10 | 100 | 5 | 23 [20–31] | 25.0 | 16 (59.1%) | 32.2 | 10.2 [3.0–16.7] | 9.6 | 0.6 | 9.6 | 33.8 / 38.7 | 4 | yes | - |
| b3/10/Rectangle | 10×15 | 150 | 5 | 36 [29–37] | 34.6 | 20 (56.8%) | 53.3 | 18.4 [9.9–24.3] | 17.7 | 0.7 | 17.6 | 22.6 / 25.8 | 2 | yes | - |
| b3/10/Circle | 10×10 | 68 | 5 | 15 [13–16] | 14.6 | 10 (62.5%) | 18.0 | 4.6 [1.8–5.4] | 3.9 | 0.5 | 4.0 | 33.8 / 38.7 | 1 | yes | - |
| b3/10/Diamond | 10×10 | 40 | 5 | 10 [9–13] | 11.0 | 8 (70.0%) | 12.8 | 1.1 [0.2–3.1] | 1.7 | 0.4 | 0.7 | 33.8 / 38.7 | 5 | yes | - |
| b3/10/Triangle | 10×10 | 35 | 5 | 9 [7–9] | 8.4 | 7 (88.9%) | 9.7 | 0.7 [0.0–2.3] | 0.9 | 0.1 | 0.4 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/Plus | 10×10 | 56 | 5 | 12 [10–16] | 12.8 | 8 (66.7%) | 15.1 | 3.1 [0.7–4.9] | 2.8 | 0.4 | 2.7 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/Hexagon | 10×10 | 56 | 5 | 14 [11–16] | 13.8 | 8 (57.1%) | 19.5 | 5.0 [0.5–7.6] | 4.5 | 0.7 | 4.1 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/Star | 10×10 | 30 | 5 | 11 [9–12] | 10.4 | 8 (81.8%) | 12.3 | 1.0 [0.1–4.2] | 1.5 | 0.2 | 0.9 | 33.8 / 38.7 | 5 | yes | - |
| b3/10/Heart | 10×10 | 76 | 5 | 20 [18–23] | 20.0 | 14 (73.7%) | 25.7 | 5.0 [2.7–9.3] | 5.8 | 0.3 | 4.6 | 33.8 / 38.7 | 2 | yes | - |
| b3/10/Trophy | 10×8 | 24 | 5 | 8 [5–11] | 7.8 | 7 (85.7%) | 8.0 | 0.3 [0.0–1.8] | 0.6 | 0.1 | 0.2 | 42.3 / 48.3 | 4 | yes | - |
| b3/10/Crescent | 10×10 | 36 | 5 | 9 [8–13] | 10.0 | 8 (87.5%) | 9.2 | 1.2 [0.2–1.5] | 0.9 | 0.1 | 1.0 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/Flower | 10×10 | 48 | 5 | 13 [8–15] | 11.8 | 8 (66.7%) | 15.3 | 2.7 [0.6–5.1] | 2.8 | 0.4 | 2.3 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/Bolt | 10×8 | 10 | 5 | 2 [2–3] | 2.2 | 2 (100.0%) | 2.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 42.3 / 48.3 | 1 | yes | - |
| b3/10/Arrow | 10×9 | 27 | 5 | 8 [5–9] | 7.4 | 5 (71.4%) | 8.8 | 1.8 [0.0–2.9] | 1.4 | 0.3 | 1.4 | 37.6 / 43.0 | 2 | yes | - |
| b3/10/Crown | 10×12 | 54 | 5 | 14 [13–17] | 14.4 | 10 (76.9%) | 15.6 | 2.0 [1.6–4.3] | 2.3 | 0.3 | 1.7 | 28.2 / 32.2 | 5 | yes | - |
| b3/10/Hourglass | 10×8 | 28 | 5 | 10 [8–11] | 9.8 | 9 (90.0%) | 10.5 | 0.5 [0.0–1.2] | 0.5 | 0.1 | 0.4 | 42.3 / 48.3 | 3 | yes | - |
| b3/10/Pentagon | 10×10 | 54 | 5 | 14 [13–17] | 14.4 | 10 (69.2%) | 17.7 | 4.0 [0.7–4.9] | 3.3 | 0.4 | 3.6 | 33.8 / 38.7 | 1 | yes | - |
| b3/10/Octagon | 10×10 | 60 | 5 | 12 [11–17] | 13.2 | 9 (75.0%) | 14.9 | 2.9 [0.7–4.4] | 2.7 | 0.3 | 2.6 | 33.8 / 38.7 | 4 | yes | - |
| b3/10/Ring | 10×10 | 60 | 5 | 16 [12–17] | 15.4 | 13 (76.5%) | 18.0 | 2.1 [2.0–3.2] | 2.3 | 0.3 | 1.9 | 33.8 / 38.7 | 3 | yes | - |
| b3/10/X | 10×10 | 48 | 5 | 17 [16–18] | 17.0 | 15 (87.5%) | 17.5 | 1.1 [0.4–3.0] | 1.2 | 0.1 | 0.9 | 33.8 / 38.7 | 2 | yes | - |
| b3/10/Butterfly | 10×11 | 62 | 5 | 15 [15–16] | 15.4 | 12 (75.0%) | 17.8 | 2.3 [1.1–6.1] | 3.2 | 0.3 | 1.9 | 30.8 / 35.2 | 5 | yes | - |
| b3/10/Rocket | 10×8 | 32 | 5 | 8 [6–10] | 8.0 | 6 (85.7%) | 10.3 | 0.6 [0.0–3.0] | 1.1 | 0.1 | 0.4 | 42.3 / 48.3 | 1 | yes | - |
| b3/10/Pine | 10×9 | 25 | 5 | 7 [5–8] | 6.4 | 6 (100.0%) | 7.0 | 0.0 [0.0–0.8] | 0.2 | 0.0 | 0.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/10/Cat | 10×10 | 40 | 5 | 9 [7–12] | 9.2 | 7 (77.8%) | 10.7 | 0.7 [0.0–1.8] | 0.9 | 0.3 | 0.4 | 33.8 / 38.7 | 2 | yes | - |
| b3/10/Mushroom | 10×10 | 40 | 5 | 10 [9–10] | 9.8 | 7 (70.0%) | 12.1 | 2.1 [0.9–2.8] | 1.8 | 0.4 | 1.3 | 33.8 / 38.7 | 5 | yes | - |
| b3/10/Fish | 10×12 | 54 | 5 | 13 [12–17] | 14.0 | 10 (76.9%) | 16.4 | 2.6 [1.9–3.6] | 2.7 | 0.3 | 2.2 | 28.2 / 32.2 | 1 | yes | - |
| b3/11/Square | 11×11 | 121 | 5 | 32 [27–34] | 31.6 | 20 (62.5%) | 45.2 | 11.2 [6.7–16.0] | 11.0 | 0.6 | 10.4 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Rectangle | 11×16 | 176 | 5 | 40 [38–49] | 41.8 | 23 (59.0%) | 58.4 | 15.4 [7.7–24.4] | 16.1 | 0.7 | 14.6 | 21.1 / 24.2 | 3 | yes | - |
| b3/11/Circle | 11×11 | 81 | 5 | 19 [16–25] | 19.8 | 12 (64.7%) | 22.1 | 5.1 [2.5–9.9] | 6.1 | 0.5 | 4.7 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Diamond | 11×11 | 57 | 5 | 14 [13–15] | 14.2 | 13 (86.7%) | 16.1 | 1.1 [0.0–3.8] | 1.7 | 0.1 | 1.0 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Triangle | 11×11 | 41 | 5 | 10 [10–12] | 10.8 | 9 (83.3%) | 13.7 | 2.1 [0.3–3.7] | 2.0 | 0.2 | 1.8 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Plus | 11×11 | 61 | 5 | 15 [13–17] | 15.2 | 12 (75.0%) | 18.9 | 2.9 [1.1–4.6] | 2.8 | 0.3 | 2.5 | 30.8 / 35.2 | 3 | yes | - |
| b3/11/Hexagon | 11×11 | 71 | 5 | 17 [16–21] | 18.2 | 12 (70.6%) | 21.1 | 3.7 [3.0–7.6] | 4.5 | 0.4 | 3.4 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Star | 11×11 | 33 | 5 | 10 [8–10] | 9.6 | 9 (90.0%) | 10.1 | 0.3 [0.0–1.4] | 0.4 | 0.1 | 0.1 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Heart | 11×11 | 93 | 5 | 22 [21–22] | 21.6 | 15 (71.4%) | 27.4 | 6.4 [3.2–9.4] | 6.1 | 0.4 | 6.0 | 30.8 / 35.2 | 1 | yes | - |
| b3/11/Trophy | 11×9 | 24 | 5 | 7 [6–8] | 7.0 | 5 (75.0%) | 8.8 | 1.2 [0.9–2.8] | 1.5 | 0.3 | 1.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/11/Crescent | 11×11 | 41 | 5 | 13 [10–14] | 12.2 | 9 (78.6%) | 13.1 | 1.1 [0.1–4.3] | 1.5 | 0.3 | 0.7 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Flower | 11×11 | 57 | 5 | 14 [13–15] | 14.2 | 13 (86.7%) | 16.1 | 1.1 [0.0–3.8] | 1.7 | 0.1 | 1.0 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Bolt | 11×9 | 11 | 5 | 5 [5–5] | 5.0 | 5 (100.0%) | 5.0 | 0.0 [0.0–0.2] | 0.0 | 0.0 | 0.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/11/Arrow | 11×10 | 26 | 5 | 8 [7–11] | 8.2 | 6 (75.0%) | 9.0 | 1.0 [0.0–2.9] | 1.3 | 0.3 | 0.7 | 33.8 / 38.7 | 1 | yes | - |
| b3/11/Crown | 11×13 | 68 | 5 | 16 [13–18] | 15.6 | 12 (84.6%) | 17.3 | 1.3 [0.8–7.2] | 3.4 | 0.2 | 1.2 | 26.0 / 29.7 | 5 | yes | - |
| b3/11/Hourglass | 11×9 | 37 | 5 | 10 [10–12] | 10.6 | 9 (75.0%) | 12.0 | 1.7 [0.1–3.1] | 1.4 | 0.3 | 1.4 | 37.6 / 43.0 | 2 | yes | - |
| b3/11/Pentagon | 11×11 | 65 | 5 | 14 [11–17] | 14.2 | 10 (69.2%) | 17.7 | 3.8 [2.6–10.6] | 5.1 | 0.4 | 3.5 | 30.8 / 35.2 | 1 | yes | - |
| b3/11/Octagon | 11×11 | 69 | 5 | 16 [14–18] | 16.2 | 11 (62.5%) | 21.8 | 5.8 [4.6–9.9] | 6.9 | 0.5 | 5.3 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Ring | 11×11 | 68 | 5 | 17 [16–18] | 17.2 | 12 (66.7%) | 21.3 | 3.3 [1.2–8.5] | 4.9 | 0.5 | 2.8 | 30.8 / 35.2 | 4 | yes | - |
| b3/11/X | 11×11 | 53 | 5 | 19 [19–20] | 19.4 | 15 (78.9%) | 20.7 | 1.7 [0.5–2.8] | 1.6 | 0.3 | 1.4 | 30.8 / 35.2 | 1 | yes | - |
| b3/11/Butterfly | 11×12 | 70 | 5 | 19 [17–23] | 19.6 | 13 (68.4%) | 22.8 | 4.8 [2.9–9.4] | 5.7 | 0.4 | 4.4 | 28.2 / 32.2 | 3 | yes | - |
| b3/11/Rocket | 11×8 | 34 | 5 | 7 [6–10] | 7.4 | 5 (83.3%) | 8.4 | 0.4 [0.2–1.6] | 0.8 | 0.2 | 0.3 | 42.3 / 48.3 | 2 | yes | - |
| b3/11/Pine | 11×10 | 34 | 5 | 10 [8–15] | 11.0 | 9 (83.3%) | 12.6 | 0.9 [0.6–3.7] | 1.8 | 0.2 | 0.8 | 33.8 / 38.7 | 5 | yes | - |
| b3/11/Cat | 11×11 | 53 | 5 | 14 [12–14] | 13.2 | 8 (57.1%) | 19.0 | 5.0 [0.0–8.0] | 4.5 | 0.7 | 4.1 | 30.8 / 35.2 | 2 | yes | - |
| b3/11/Mushroom | 11×10 | 42 | 5 | 10 [7–13] | 10.2 | 7 (70.0%) | 11.2 | 1.8 [0.5–3.5] | 2.0 | 0.4 | 1.5 | 33.8 / 38.7 | 3 | yes | - |
| b3/11/Fish | 11×13 | 67 | 5 | 18 [15–20] | 17.6 | 12 (75.0%) | 23.6 | 4.5 [1.8–10.3] | 6.1 | 0.3 | 4.1 | 26.0 / 29.7 | 3 | yes | - |
| b3/12/Square | 12×12 | 144 | 5 | 34 [30–36] | 33.6 | 21 (61.1%) | 45.4 | 12.6 [5.8–17.0] | 11.5 | 0.6 | 12.0 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Rectangle | 12×18 | 216 | 5 | 52 [50–63] | 54.6 | 26 (46.6%) | 79.2 | 29.2 [11.9–44.8] | 29.2 | 1.1 | 27.8 | 18.8 / 21.5 | 5 | yes | - |
| b3/12/Circle | 12×12 | 88 | 5 | 23 [19–25] | 22.4 | 18 (72.0%) | 27.4 | 4.0 [2.8–7.5] | 4.5 | 0.4 | 3.5 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/Diamond | 12×12 | 60 | 5 | 17 [13–19] | 16.2 | 11 (64.7%) | 20.9 | 4.8 [0.9–5.9] | 3.9 | 0.5 | 4.3 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/Triangle | 12×12 | 50 | 5 | 12 [10–13] | 12.0 | 9 (83.3%) | 16.0 | 4.0 [0.5–9.4] | 4.1 | 0.2 | 3.9 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Plus | 12×12 | 80 | 5 | 19 [14–21] | 18.0 | 9 (57.1%) | 28.1 | 7.1 [2.5–11.6] | 7.0 | 0.7 | 6.4 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Hexagon | 12×12 | 84 | 5 | 20 [18–22] | 20.0 | 13 (65.0%) | 24.8 | 4.8 [3.4–10.1] | 6.0 | 0.5 | 4.3 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Star | 12×12 | 44 | 5 | 9 [8–11] | 9.4 | 7 (87.5%) | 11.0 | 0.6 [0.0–2.2] | 1.0 | 0.1 | 0.5 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Heart | 12×12 | 108 | 5 | 26 [24–33] | 27.4 | 16 (60.0%) | 38.6 | 13.3 [4.1–13.7] | 11.3 | 0.6 | 12.5 | 28.2 / 32.2 | 4 | yes | - |
| b3/12/Trophy | 12×10 | 34 | 5 | 11 [10–14] | 11.2 | 9 (81.8%) | 11.8 | 0.8 [0.1–1.5] | 0.8 | 0.2 | 0.6 | 33.8 / 38.7 | 5 | yes | - |
| b3/12/Crescent | 12×12 | 42 | 5 | 11 [10–12] | 11.2 | 8 (66.7%) | 13.4 | 1.8 [1.4–4.4] | 2.3 | 0.4 | 1.4 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Flower | 12×12 | 68 | 5 | 17 [15–18] | 16.4 | 9 (60.0%) | 22.3 | 6.3 [5.2–15.4] | 7.7 | 0.6 | 5.5 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/Bolt | 12×10 | 14 | 5 | 4 [4–7] | 4.6 | 4 (100.0%) | 4.0 | 0.0 [0.0–1.1] | 0.4 | 0.0 | 0.0 | 33.8 / 38.7 | 1 | yes | - |
| b3/12/Arrow | 12×11 | 36 | 5 | 9 [8–11] | 9.4 | 7 (63.6%) | 12.0 | 2.8 [0.1–4.7] | 2.5 | 0.5 | 2.3 | 30.8 / 35.2 | 3 | yes | - |
| b3/12/Crown | 12×14 | 66 | 5 | 16 [15–18] | 16.2 | 11 (72.2%) | 19.4 | 4.4 [1.2–9.7] | 4.8 | 0.4 | 3.9 | 24.2 / 27.6 | 1 | yes | - |
| b3/12/Hourglass | 12×10 | 48 | 5 | 13 [11–14] | 12.8 | 9 (69.2%) | 15.6 | 2.7 [0.0–3.6] | 2.4 | 0.4 | 2.2 | 33.8 / 38.7 | 5 | yes | - |
| b3/12/Pentagon | 12×12 | 78 | 5 | 19 [18–20] | 19.2 | 12 (61.1%) | 25.0 | 5.0 [3.1–9.9] | 6.0 | 0.6 | 4.4 | 28.2 / 32.2 | 3 | yes | - |
| b3/12/Octagon | 12×12 | 88 | 5 | 23 [19–25] | 22.4 | 18 (72.0%) | 27.4 | 4.0 [2.8–7.5] | 4.5 | 0.4 | 3.5 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/Ring | 12×12 | 64 | 5 | 17 [16–18] | 17.0 | 10 (55.6%) | 25.0 | 7.5 [1.7–10.4] | 6.4 | 0.7 | 6.4 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/X | 12×12 | 60 | 5 | 21 [21–25] | 22.2 | 18 (82.6%) | 23.6 | 1.9 [1.3–2.6] | 1.9 | 0.2 | 1.7 | 28.2 / 32.2 | 5 | yes | - |
| b3/12/Butterfly | 12×13 | 80 | 5 | 23 [17–23] | 21.2 | 13 (65.2%) | 28.7 | 5.9 [4.6–10.8] | 7.5 | 0.5 | 5.5 | 26.0 / 29.7 | 2 | yes | - |
| b3/12/Rocket | 12×9 | 34 | 5 | 9 [8–11] | 9.0 | 9 (90.9%) | 9.0 | 0.1 [0.0–1.5] | 0.5 | 0.1 | 0.0 | 37.6 / 43.0 | 1 | yes | - |
| b3/12/Pine | 12×11 | 39 | 5 | 12 [9–14] | 11.6 | 9 (77.8%) | 12.7 | 0.7 [0.0–2.1] | 0.8 | 0.3 | 0.4 | 30.8 / 35.2 | 2 | yes | - |
| b3/12/Cat | 12×12 | 62 | 5 | 15 [14–17] | 15.2 | 11 (68.8%) | 18.9 | 3.9 [0.5–4.6] | 3.3 | 0.4 | 3.4 | 28.2 / 32.2 | 1 | yes | - |
| b3/12/Mushroom | 12×11 | 55 | 5 | 16 [12–17] | 15.0 | 9 (58.8%) | 20.4 | 3.4 [2.2–6.8] | 3.9 | 0.6 | 2.8 | 30.8 / 35.2 | 4 | yes | - |
| b3/12/Fish | 12×14 | 78 | 5 | 20 [18–20] | 19.2 | 15 (75.0%) | 25.1 | 5.1 [2.0–6.4] | 4.4 | 0.3 | 4.8 | 24.2 / 27.6 | 4 | yes | - |
| b3/13/Square | 13×13 | 169 | 5 | 38 [35–43] | 38.6 | 21 (55.0%) | 61.1 | 25.4 [16.4–29.6] | 22.9 | 0.8 | 24.6 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Rectangle | 13×20 | 260 | 5 | 67 [55–70] | 64.4 | 34 (50.9%) | 104.2 | 37.2 [34.4–49.9] | 39.3 | 0.9 | 36.3 | 16.9 / 19.3 | 4 | yes | - |
| b3/13/Circle | 13×13 | 109 | 5 | 28 [27–28] | 27.6 | 17 (60.7%) | 39.1 | 11.7 [5.2–14.2] | 9.8 | 0.6 | 11.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Diamond | 13×13 | 81 | 5 | 20 [16–21] | 19.2 | 13 (68.4%) | 25.2 | 5.9 [1.2–7.1] | 4.7 | 0.4 | 5.4 | 26.0 / 29.7 | 1 | yes | - |
| b3/13/Triangle | 13×13 | 61 | 5 | 14 [12–18] | 14.2 | 9 (64.3%) | 17.7 | 4.1 [1.9–8.2] | 4.5 | 0.5 | 3.5 | 26.0 / 29.7 | 3 | yes | - |
| b3/13/Plus | 13×13 | 85 | 5 | 21 [17–21] | 20.0 | 12 (57.1%) | 29.8 | 8.8 [4.4–11.7] | 8.4 | 0.7 | 8.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Hexagon | 13×13 | 101 | 5 | 24 [22–28] | 24.4 | 14 (58.3%) | 34.3 | 9.8 [3.5–15.3] | 9.9 | 0.7 | 9.2 | 26.0 / 29.7 | 3 | yes | - |
| b3/13/Star | 13×13 | 52 | 5 | 16 [14–18] | 16.2 | 12 (75.0%) | 17.9 | 2.3 [1.9–3.3] | 2.4 | 0.3 | 1.9 | 26.0 / 29.7 | 1 | yes | - |
| b3/13/Heart | 13×13 | 131 | 5 | 31 [30–36] | 32.6 | 21 (67.7%) | 43.6 | 10.9 [8.6–20.8] | 13.2 | 0.5 | 10.4 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Trophy | 13×11 | 36 | 5 | 9 [7–11] | 9.0 | 7 (77.8%) | 9.4 | 0.4 [0.0–2.4] | 0.8 | 0.3 | 0.1 | 30.8 / 35.2 | 2 | yes | - |
| b3/13/Crescent | 13×13 | 53 | 5 | 13 [11–18] | 13.6 | 9 (75.0%) | 14.3 | 2.8 [0.3–4.9] | 2.5 | 0.3 | 2.5 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Flower | 13×13 | 77 | 5 | 17 [16–21] | 17.8 | 11 (61.9%) | 23.1 | 5.4 [5.1–10.1] | 6.6 | 0.6 | 5.0 | 26.0 / 29.7 | 3 | yes | - |
| b3/13/Bolt | 13×10 | 16 | 5 | 4 [4–5] | 4.2 | 4 (100.0%) | 4.0 | 0.0 [0.0–0.0] | 0.0 | 0.0 | 0.0 | 33.8 / 38.7 | 1 | yes | - |
| b3/13/Arrow | 13×12 | 48 | 5 | 12 [10–14] | 11.8 | 11 (85.7%) | 12.1 | 0.2 [0.0–1.9] | 0.6 | 0.2 | 0.0 | 28.2 / 32.2 | 4 | yes | - |
| b3/13/Crown | 13×15 | 82 | 5 | 20 [16–27] | 20.6 | 12 (64.7%) | 25.2 | 7.6 [5.2–14.8] | 8.4 | 0.5 | 7.2 | 22.6 / 25.8 | 5 | yes | - |
| b3/13/Hourglass | 13×10 | 50 | 5 | 14 [10–15] | 13.4 | 10 (71.4%) | 16.5 | 2.5 [1.2–4.1] | 2.8 | 0.4 | 2.2 | 33.8 / 38.7 | 3 | yes | - |
| b3/13/Pentagon | 13×13 | 84 | 5 | 19 [17–19] | 18.2 | 12 (70.6%) | 20.3 | 2.3 [1.3–7.9] | 3.2 | 0.4 | 1.9 | 26.0 / 29.7 | 3 | yes | - |
| b3/13/Octagon | 13×13 | 109 | 5 | 28 [27–28] | 27.6 | 17 (60.7%) | 39.1 | 11.7 [5.2–14.2] | 9.8 | 0.6 | 11.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/Ring | 13×13 | 84 | 5 | 23 [19–25] | 22.6 | 16 (69.6%) | 29.5 | 5.5 [3.9–10.3] | 6.6 | 0.4 | 5.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/13/X | 13×13 | 61 | 5 | 19 [17–23] | 19.2 | 15 (83.3%) | 22.0 | 2.8 [1.6–8.3] | 3.6 | 0.2 | 2.7 | 26.0 / 29.7 | 4 | yes | - |
| b3/13/Butterfly | 13×14 | 96 | 5 | 21 [19–24] | 21.2 | 14 (65.0%) | 26.5 | 5.5 [2.5–10.8] | 5.8 | 0.5 | 4.8 | 24.2 / 27.6 | 1 | yes | - |
| b3/13/Rocket | 13×10 | 48 | 5 | 12 [9–14] | 11.6 | 9 (71.4%) | 13.0 | 1.8 [0.6–3.4] | 1.9 | 0.4 | 1.3 | 33.8 / 38.7 | 1 | yes | - |
| b3/13/Pine | 13×12 | 48 | 5 | 12 [11–14] | 12.4 | 9 (75.0%) | 14.7 | 2.7 [0.7–4.6] | 2.3 | 0.3 | 2.3 | 28.2 / 32.2 | 4 | yes | - |
| b3/13/Cat | 13×13 | 75 | 5 | 18 [15–23] | 18.4 | 12 (64.7%) | 23.0 | 5.0 [4.0–10.9] | 6.2 | 0.5 | 4.5 | 26.0 / 29.7 | 1 | yes | - |
| b3/13/Mushroom | 13×12 | 66 | 5 | 14 [12–16] | 14.2 | 10 (66.7%) | 17.6 | 3.2 [1.4–6.8] | 3.5 | 0.4 | 2.8 | 28.2 / 32.2 | 1 | yes | - |
| b3/13/Fish | 13×16 | 96 | 5 | 24 [20–25] | 23.0 | 15 (68.2%) | 27.1 | 6.6 [1.3–9.2] | 5.8 | 0.4 | 5.9 | 21.1 / 24.2 | 4 | yes | - |
| b3/14/Square | 14×14 | 196 | 5 | 49 [45–51] | 48.2 | 23 (51.1%) | 70.6 | 22.8 [19.6–36.4] | 25.2 | 0.9 | 21.9 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Rectangle | 14×21 | 294 | 5 | 72 [61–78] | 70.2 | 38 (51.3%) | 112.3 | 40.7 [32.9–52.8] | 43.2 | 0.9 | 39.9 | 16.1 / 18.4 | 1 | yes | - |
| b3/14/Circle | 14×14 | 124 | 5 | 30 [26–37] | 30.6 | 18 (60.0%) | 41.5 | 11.5 [6.2–26.1] | 13.6 | 0.6 | 11.0 | 24.2 / 27.6 | 4 | yes | - |
| b3/14/Diamond | 14×14 | 84 | 5 | 21 [20–24] | 21.4 | 14 (66.7%) | 26.2 | 5.4 [4.3–13.1] | 6.8 | 0.5 | 5.0 | 24.2 / 27.6 | 1 | yes | - |
| b3/14/Triangle | 14×14 | 72 | 5 | 17 [16–19] | 17.4 | 13 (75.0%) | 21.4 | 3.6 [2.4–7.2] | 4.6 | 0.3 | 3.3 | 24.2 / 27.6 | 2 | yes | - |
| b3/14/Plus | 14×14 | 84 | 5 | 19 [16–25] | 20.0 | 10 (56.3%) | 27.0 | 8.0 [4.5–8.3] | 6.8 | 0.7 | 7.2 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Hexagon | 14×14 | 116 | 5 | 28 [22–29] | 26.8 | 15 (54.5%) | 40.9 | 12.9 [11.2–17.5] | 13.5 | 0.8 | 12.2 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Star | 14×14 | 58 | 5 | 15 [13–18] | 15.6 | 12 (76.9%) | 16.3 | 1.5 [0.6–4.7] | 2.4 | 0.3 | 1.2 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Heart | 14×14 | 148 | 5 | 35 [29–41] | 35.2 | 20 (53.7%) | 57.1 | 20.3 [7.2–22.3] | 16.2 | 0.8 | 19.5 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Trophy | 14×12 | 48 | 5 | 11 [11–14] | 12.0 | 9 (81.8%) | 12.1 | 1.1 [0.3–4.6] | 2.1 | 0.2 | 0.9 | 28.2 / 32.2 | 2 | yes | - |
| b3/14/Crescent | 14×14 | 61 | 5 | 14 [13–19] | 15.4 | 11 (71.4%) | 19.2 | 1.4 [0.8–5.2] | 2.5 | 0.4 | 1.0 | 24.2 / 27.6 | 1 | yes | - |
| b3/14/Flower | 14×14 | 100 | 5 | 23 [20–24] | 22.6 | 12 (54.5%) | 32.8 | 9.6 [8.9–11.6] | 9.8 | 0.8 | 8.8 | 24.2 / 27.6 | 5 | yes | - |
| b3/14/Bolt | 14×11 | 19 | 5 | 7 [5–7] | 6.2 | 5 (85.7%) | 7.5 | 0.5 [0.0–1.8] | 0.7 | 0.1 | 0.4 | 30.8 / 35.2 | 5 | yes | - |
| b3/14/Arrow | 14×13 | 42 | 5 | 11 [10–14] | 11.4 | 10 (90.0%) | 11.3 | 0.8 [0.3–3.5] | 1.2 | 0.1 | 0.7 | 26.0 / 29.7 | 4 | yes | - |
| b3/14/Crown | 14×16 | 96 | 5 | 23 [21–27] | 23.2 | 16 (71.4%) | 27.3 | 4.7 [3.6–9.3] | 5.8 | 0.4 | 4.3 | 21.1 / 24.2 | 1 | yes | - |
| b3/14/Hourglass | 14×11 | 64 | 5 | 15 [14–17] | 15.2 | 11 (71.4%) | 18.4 | 2.4 [1.2–4.1] | 2.4 | 0.4 | 2.3 | 30.8 / 35.2 | 5 | yes | - |
| b3/14/Pentagon | 14×14 | 102 | 5 | 23 [22–25] | 23.4 | 15 (60.0%) | 30.2 | 8.2 [3.3–9.9] | 6.9 | 0.6 | 7.3 | 24.2 / 27.6 | 1 | yes | - |
| b3/14/Octagon | 14×14 | 120 | 5 | 30 [25–37] | 30.2 | 17 (56.0%) | 38.4 | 10.1 [8.4–25.5] | 13.1 | 0.7 | 9.5 | 24.2 / 27.6 | 1 | yes | - |
| b3/14/Ring | 14×14 | 108 | 5 | 26 [22–31] | 27.2 | 17 (61.3%) | 33.2 | 7.2 [2.3–16.8] | 8.4 | 0.6 | 6.7 | 24.2 / 27.6 | 2 | yes | - |
| b3/14/X | 14×14 | 96 | 5 | 24 [24–30] | 25.6 | 19 (73.1%) | 29.2 | 5.2 [2.9–13.0] | 6.0 | 0.3 | 4.8 | 24.2 / 27.6 | 4 | yes | - |
| b3/14/Butterfly | 14×15 | 106 | 5 | 25 [23–26] | 24.8 | 17 (65.4%) | 36.4 | 11.4 [3.7–14.9] | 9.6 | 0.5 | 10.8 | 22.6 / 25.8 | 5 | yes | - |
| b3/14/Rocket | 14×10 | 48 | 5 | 12 [11–14] | 12.4 | 11 (83.3%) | 13.6 | 2.2 [0.3–3.4] | 1.9 | 0.2 | 2.0 | 33.8 / 38.7 | 5 | yes | - |
| b3/14/Pine | 14×13 | 51 | 5 | 14 [12–18] | 14.4 | 12 (80.0%) | 15.1 | 1.1 [0.3–3.0] | 1.3 | 0.2 | 0.9 | 26.0 / 29.7 | 1 | yes | - |
| b3/14/Cat | 14×14 | 82 | 5 | 22 [18–24] | 21.6 | 15 (72.7%) | 26.1 | 4.1 [1.2–9.8] | 5.5 | 0.4 | 3.7 | 24.2 / 27.6 | 3 | yes | - |
| b3/14/Mushroom | 14×13 | 70 | 5 | 18 [15–22] | 18.2 | 12 (66.7%) | 22.0 | 4.1 [3.0–5.7] | 4.3 | 0.5 | 3.6 | 26.0 / 29.7 | 4 | yes | - |
| b3/14/Fish | 14×17 | 96 | 5 | 24 [21–27] | 24.2 | 15 (61.9%) | 30.7 | 8.1 [4.7–11.1] | 7.7 | 0.6 | 7.5 | 19.9 / 22.7 | 1 | yes | - |
| b3/15/Square | 15×15 | 225 | 5 | 58 [55–68] | 59.6 | 30 (51.7%) | 89.2 | 34.2 [25.2–44.3] | 33.9 | 0.9 | 33.3 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Rectangle | 15×22 | 330 | 5 | 81 [78–92] | 84.6 | 37 (44.9%) | 138.4 | 52.7 [46.5–93.9] | 60.6 | 1.2 | 51.5 | 15.4 / 17.6 | 4 | yes | - |
| b3/15/Circle | 15×15 | 145 | 5 | 34 [29–39] | 33.8 | 18 (50.0%) | 56.1 | 22.1 [9.1–23.6] | 17.8 | 0.9 | 21.0 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Diamond | 15×15 | 109 | 5 | 27 [22–28] | 26.4 | 17 (63.0%) | 35.1 | 9.5 [5.6–10.3] | 8.5 | 0.6 | 9.0 | 22.6 / 25.8 | 5 | yes | - |
| b3/15/Triangle | 15×15 | 85 | 5 | 21 [17–25] | 20.6 | 16 (76.5%) | 25.6 | 3.7 [0.4–10.4] | 4.5 | 0.3 | 3.4 | 22.6 / 25.8 | 5 | yes | - |
| b3/15/Plus | 15×15 | 105 | 5 | 25 [24–28] | 25.6 | 14 (56.0%) | 36.3 | 10.8 [6.0–14.9] | 10.1 | 0.7 | 10.3 | 22.6 / 25.8 | 5 | yes | - |
| b3/15/Hexagon | 15×15 | 133 | 5 | 33 [30–34] | 32.2 | 19 (56.7%) | 46.3 | 12.9 [12.3–15.2] | 13.3 | 0.7 | 12.2 | 22.6 / 25.8 | 1 | yes | - |
| b3/15/Star | 15×15 | 70 | 5 | 20 [18–22] | 20.2 | 15 (72.7%) | 23.9 | 4.9 [3.2–6.0] | 4.7 | 0.4 | 4.6 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Heart | 15×15 | 169 | 5 | 40 [38–47] | 40.8 | 21 (53.8%) | 51.1 | 12.1 [10.1–31.2] | 16.0 | 0.8 | 11.5 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Trophy | 15×13 | 56 | 5 | 14 [12–16] | 14.2 | 11 (78.6%) | 14.6 | 0.9 [0.2–3.8] | 1.7 | 0.3 | 0.7 | 26.0 / 29.7 | 3 | yes | - |
| b3/15/Crescent | 15×15 | 73 | 5 | 21 [16–22] | 19.6 | 13 (72.2%) | 22.0 | 4.0 [0.7–7.1] | 3.9 | 0.4 | 3.7 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Flower | 15×15 | 101 | 5 | 24 [22–28] | 24.2 | 14 (58.3%) | 33.4 | 9.7 [6.5–13.9] | 10.4 | 0.7 | 9.2 | 22.6 / 25.8 | 4 | yes | - |
| b3/15/Bolt | 15×12 | 21 | 5 | 7 [6–8] | 7.2 | 7 (100.0%) | 8.0 | 0.0 [0.0–1.8] | 0.4 | 0.0 | 0.0 | 28.2 / 32.2 | 1 | yes | - |
| b3/15/Arrow | 15×14 | 60 | 5 | 13 [13–20] | 14.8 | 10 (76.9%) | 15.5 | 2.5 [1.9–4.0] | 2.7 | 0.3 | 2.4 | 24.2 / 27.6 | 5 | yes | - |
| b3/15/Crown | 15×17 | 114 | 5 | 26 [25–28] | 26.4 | 17 (64.0%) | 33.6 | 7.6 [6.6–14.0] | 9.6 | 0.5 | 7.1 | 19.9 / 22.7 | 2 | yes | - |
| b3/15/Hourglass | 15×12 | 70 | 5 | 20 [17–25] | 20.4 | 13 (60.0%) | 26.9 | 6.4 [0.3–9.9] | 4.9 | 0.6 | 5.7 | 28.2 / 32.2 | 3 | yes | - |
| b3/15/Pentagon | 15×15 | 118 | 5 | 29 [26–33] | 29.6 | 17 (54.8%) | 41.9 | 12.9 [6.8–19.2] | 12.5 | 0.8 | 12.0 | 22.6 / 25.8 | 4 | yes | - |
| b3/15/Octagon | 15×15 | 145 | 5 | 34 [29–39] | 33.8 | 18 (50.0%) | 56.1 | 22.1 [9.1–23.6] | 17.8 | 0.9 | 21.0 | 22.6 / 25.8 | 3 | yes | - |
| b3/15/Ring | 15×15 | 116 | 5 | 28 [23–30] | 27.6 | 19 (66.7%) | 38.6 | 8.6 [3.4–18.0] | 9.6 | 0.5 | 8.1 | 22.6 / 25.8 | 2 | yes | - |
| b3/15/X | 15×15 | 105 | 5 | 26 [26–30] | 27.2 | 19 (73.1%) | 31.2 | 5.2 [3.4–12.4] | 6.2 | 0.3 | 4.9 | 22.6 / 25.8 | 5 | yes | - |
| b3/15/Butterfly | 15×16 | 128 | 5 | 33 [29–34] | 32.4 | 21 (64.7%) | 44.7 | 11.7 [5.5–16.6] | 10.8 | 0.5 | 10.9 | 21.1 / 24.2 | 3 | yes | - |
| b3/15/Rocket | 15×11 | 61 | 5 | 16 [14–23] | 17.8 | 13 (76.2%) | 19.6 | 2.1 [1.0–3.6] | 2.1 | 0.3 | 1.8 | 30.8 / 35.2 | 4 | yes | - |
| b3/15/Pine | 15×14 | 68 | 5 | 17 [16–17] | 16.6 | 12 (70.6%) | 19.9 | 3.1 [1.1–5.6] | 3.0 | 0.4 | 2.6 | 24.2 / 27.6 | 3 | yes | - |
| b3/15/Cat | 15×15 | 92 | 5 | 24 [22–25] | 23.6 | 16 (68.2%) | 31.9 | 8.8 [2.8–14.6] | 9.6 | 0.4 | 8.4 | 22.6 / 25.8 | 5 | yes | - |
| b3/15/Mushroom | 15×14 | 88 | 5 | 20 [20–22] | 20.8 | 14 (68.2%) | 28.5 | 8.5 [3.4–12.3] | 8.2 | 0.4 | 8.1 | 24.2 / 27.6 | 1 | yes | - |
| b3/15/Fish | 15×18 | 116 | 5 | 30 [25–33] | 29.0 | 17 (60.0%) | 37.0 | 10.1 [3.0–21.7] | 10.5 | 0.6 | 9.6 | 18.8 / 21.5 | 2 | yes | - |
| b3/16/Square | 16×16 | 256 | 5 | 63 [56–66] | 61.6 | 28 (46.7%) | 101.5 | 40.1 [34.2–50.6] | 41.3 | 1.1 | 39.1 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Rectangle | 16×24 | 384 | 5 | 94 [93–106] | 97.8 | 41 (44.1%) | 169.0 | 72.7 [51.7–79.1] | 70.1 | 1.2 | 71.4 | 14.1 / 16.1 | 3 | yes | - |
| b3/16/Circle | 16×16 | 164 | 5 | 41 [38–44] | 41.0 | 18 (46.2%) | 64.6 | 22.4 [18.2–28.2] | 23.1 | 1.1 | 21.7 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Diamond | 16×16 | 112 | 5 | 29 [28–30] | 28.8 | 17 (58.6%) | 38.4 | 9.4 [8.6–13.0] | 10.0 | 0.7 | 8.7 | 21.1 / 24.2 | 1 | yes | - |
| b3/16/Triangle | 16×16 | 98 | 5 | 24 [21–26] | 23.6 | 15 (66.7%) | 34.6 | 9.6 [4.0–11.9] | 8.5 | 0.5 | 9.0 | 21.1 / 24.2 | 4 | yes | - |
| b3/16/Plus | 16×16 | 132 | 5 | 31 [26–33] | 30.4 | 15 (53.8%) | 44.7 | 12.7 [10.6–18.9] | 14.1 | 0.8 | 12.0 | 21.1 / 24.2 | 4 | yes | - |
| b3/16/Hexagon | 16×16 | 156 | 5 | 39 [30–43] | 38.2 | 20 (50.0%) | 56.2 | 15.2 [11.9–31.9] | 18.8 | 0.9 | 14.4 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Star | 16×16 | 80 | 5 | 20 [16–20] | 19.0 | 16 (80.0%) | 22.5 | 3.1 [0.3–6.6] | 3.1 | 0.2 | 2.9 | 21.1 / 24.2 | 1 | yes | - |
| b3/16/Heart | 16×16 | 198 | 5 | 49 [42–55] | 49.0 | 25 (50.0%) | 73.3 | 31.3 [23.2–35.3] | 29.2 | 1.0 | 30.3 | 21.1 / 24.2 | 1 | yes | - |
| b3/16/Trophy | 16×14 | 66 | 5 | 16 [15–21] | 16.8 | 12 (73.3%) | 18.5 | 2.5 [0.9–9.3] | 3.9 | 0.3 | 2.3 | 24.2 / 27.6 | 2 | yes | - |
| b3/16/Crescent | 16×16 | 82 | 5 | 21 [18–27] | 22.0 | 17 (77.8%) | 25.2 | 3.2 [1.6–7.9] | 4.2 | 0.3 | 3.0 | 21.1 / 24.2 | 2 | yes | - |
| b3/16/Flower | 16×16 | 124 | 5 | 30 [29–33] | 30.4 | 15 (51.7%) | 46.1 | 15.0 [13.1–19.9] | 15.5 | 0.9 | 14.2 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Bolt | 16×13 | 24 | 5 | 7 [5–8] | 6.6 | 6 (100.0%) | 7.0 | 0.0 [0.0–1.8] | 0.4 | 0.0 | 0.0 | 26.0 / 29.7 | 3 | yes | - |
| b3/16/Arrow | 16×14 | 62 | 5 | 14 [14–17] | 15.0 | 10 (71.4%) | 17.3 | 2.4 [0.3–8.2] | 3.2 | 0.4 | 1.7 | 24.2 / 27.6 | 2 | yes | - |
| b3/16/Crown | 16×18 | 116 | 5 | 27 [22–30] | 26.6 | 17 (63.3%) | 39.9 | 9.9 [3.5–14.8] | 10.0 | 0.6 | 9.4 | 18.8 / 21.5 | 1 | yes | - |
| b3/16/Hourglass | 16×13 | 86 | 5 | 21 [18–25] | 21.4 | 16 (76.2%) | 24.8 | 3.8 [1.2–9.5] | 4.2 | 0.3 | 3.5 | 26.0 / 29.7 | 4 | yes | - |
| b3/16/Pentagon | 16×16 | 138 | 5 | 33 [29–36] | 33.2 | 18 (54.5%) | 54.2 | 19.8 [8.2–25.6] | 17.3 | 0.8 | 19.1 | 21.1 / 24.2 | 1 | yes | - |
| b3/16/Octagon | 16×16 | 156 | 5 | 39 [36–49] | 40.4 | 20 (49.0%) | 60.7 | 19.8 [14.1–22.7] | 19.4 | 1.0 | 18.9 | 21.1 / 24.2 | 2 | yes | - |
| b3/16/Ring | 16×16 | 128 | 5 | 31 [27–33] | 30.4 | 19 (63.3%) | 41.7 | 10.7 [8.8–15.7] | 11.1 | 0.6 | 9.9 | 21.1 / 24.2 | 3 | yes | - |
| b3/16/X | 16×16 | 116 | 5 | 30 [28–32] | 30.0 | 25 (80.6%) | 33.3 | 3.2 [2.3–11.7] | 4.7 | 0.2 | 2.9 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Butterfly | 16×18 | 156 | 5 | 40 [31–41] | 37.6 | 23 (57.5%) | 55.2 | 15.7 [4.0–21.8] | 14.5 | 0.7 | 15.0 | 18.8 / 21.5 | 1 | yes | - |
| b3/16/Rocket | 16×12 | 76 | 5 | 20 [17–21] | 19.2 | 15 (76.5%) | 23.9 | 2.9 [1.2–7.1] | 3.8 | 0.3 | 2.5 | 28.2 / 32.2 | 1 | yes | - |
| b3/16/Pine | 16×14 | 74 | 5 | 18 [17–19] | 18.0 | 12 (64.7%) | 21.9 | 4.4 [2.0–5.1] | 4.0 | 0.5 | 3.8 | 24.2 / 27.6 | 3 | yes | - |
| b3/16/Cat | 16×16 | 108 | 5 | 25 [23–26] | 25.0 | 17 (69.6%) | 28.8 | 4.6 [2.6–14.1] | 6.6 | 0.4 | 4.2 | 21.1 / 24.2 | 5 | yes | - |
| b3/16/Mushroom | 16×15 | 102 | 5 | 27 [23–30] | 26.6 | 17 (65.2%) | 34.0 | 6.3 [5.8–14.2] | 8.5 | 0.5 | 5.8 | 22.6 / 25.8 | 3 | yes | - |
| b3/16/Fish | 16×19 | 132 | 5 | 35 [27–40] | 34.8 | 20 (63.2%) | 46.8 | 11.8 [5.3–24.5] | 13.1 | 0.6 | 11.0 | 17.8 / 20.4 | 3 | yes | - |

## Appendix C: every shape at the cell targets 88 and 145 (v2 sizing)

| row | rows×cols | mask cells | n | arrows median [min–max] | arrows mean | clearable@0 median (%) | scan median | blocked median [min–max] | blocked mean | blocked@deal median | blocked after 1st removal median | cellPt 360 / 411 | median seed | blocked < v1 L1 | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unset/T88/Square | 9×9 | 81 | 5 | 22 [16–24] | 20.8 | 11 (52.2%) | 30.0 | 10.4 [8.0–17.3] | 11.0 | 0.8 | 9.6 | 37.6 / 43.0 | 4 | yes | - |
| unset/T88/Rectangle | 8×12 | 96 | 5 | 21 [18–22] | 20.6 | 8 (44.4%) | 31.0 | 10.0 [7.9–15.2] | 11.0 | 1.1 | 8.3 | 28.2 / 32.2 | 1 | yes | - |
| unset/T88/Circle | 11×11 | 81 | 5 | 19 [18–20] | 18.8 | 10 (52.6%) | 28.3 | 10.3 [6.9–13.7] | 10.1 | 0.8 | 9.4 | 30.8 / 35.2 | 2 | yes | - |
| unset/T88/Diamond | 14×14 | 84 | 5 | 23 [19–24] | 22.2 | 11 (47.8%) | 30.9 | 6.9 [2.8–15.7] | 8.5 | 1.0 | 5.8 | 24.2 / 27.6 | 3 | yes | - |
| unset/T88/Triangle | 15×15 | 85 | 5 | 19 [19–22] | 19.8 | 10 (52.6%) | 29.1 | 9.2 [1.7–14.5] | 9.0 | 0.8 | 8.3 | 22.6 / 25.8 | 4 | yes | - |
| unset/T88/Plus | 13×13 | 85 | 5 | 22 [19–29] | 22.8 | 9 (42.1%) | 34.8 | 12.8 [3.0–14.1] | 11.0 | 1.2 | 11.2 | 26.0 / 29.7 | 2 | yes | - |
| unset/T88/Hexagon | 12×12 | 84 | 5 | 19 [17–23] | 19.6 | 10 (52.6%) | 30.8 | 10.0 [4.3–14.4] | 10.0 | 0.8 | 9.0 | 28.2 / 32.2 | 3 | yes | - |
| unset/T88/Star | 17×17 | 83 | 5 | 21 [19–22] | 20.6 | 13 (59.1%) | 30.8 | 8.8 [6.2–16.0] | 10.3 | 0.6 | 8.1 | 19.9 / 22.7 | 2 | yes | - |
| unset/T88/Heart | 11×11 | 93 | 5 | 22 [21–25] | 23.0 | 12 (54.5%) | 33.3 | 8.3 [7.3–14.1] | 9.9 | 0.8 | 7.6 | 30.8 / 35.2 | 4 | yes | - |
| unset/T88/Trophy | 19×16 | 86 | 5 | 21 [16–23] | 20.0 | 10 (47.6%) | 29.2 | 8.2 [2.2–20.5] | 9.3 | 1.0 | 7.2 | 21.1 / 24.2 | 1 | yes | - |
| unset/T88/Crescent | 16×16 | 82 | 5 | 20 [19–25] | 21.2 | 12 (57.9%) | 27.8 | 8.5 [3.5–10.9] | 7.9 | 0.7 | 7.8 | 21.1 / 24.2 | 2 | yes | - |
| unset/T88/Flower | 14×14 | 100 | 5 | 24 [21–30] | 24.6 | 13 (52.2%) | 33.0 | 10.0 [3.3–13.2] | 8.9 | 0.8 | 9.1 | 24.2 / 27.6 | 2 | yes | - |
| unset/T88/Bolt | 32×26 | 96 | 5 | 27 [24–30] | 26.8 | 15 (60.0%) | 38.3 | 12.7 [5.7–13.3] | 10.1 | 0.6 | 11.7 | 13.0 / 14.9 | 4 | yes | - |
| unset/T88/Arrow | 19×17 | 91 | 5 | 24 [22–25] | 23.6 | 12 (48.0%) | 32.8 | 10.8 [6.2–14.6] | 10.4 | 1.0 | 9.9 | 19.9 / 22.7 | 3 | yes | - |
| unset/T88/Crown | 13×15 | 82 | 5 | 20 [17–24] | 20.6 | 11 (55.0%) | 29.2 | 8.8 [1.2–10.4] | 7.3 | 0.8 | 8.4 | 22.6 / 25.8 | 2 | yes | - |
| unset/T88/Hourglass | 16×13 | 86 | 5 | 22 [16–23] | 20.8 | 12 (59.1%) | 31.4 | 8.4 [4.5–11.7] | 8.6 | 0.6 | 7.9 | 26.0 / 29.7 | 4 | yes | - |
| unset/T88/Pentagon | 13×13 | 84 | 5 | 19 [16–25] | 20.2 | 12 (50.0%) | 26.8 | 7.6 [5.9–10.0] | 7.6 | 0.9 | 6.6 | 26.0 / 29.7 | 5 | yes | - |
| unset/T88/Octagon | 12×12 | 88 | 5 | 23 [21–29] | 23.8 | 13 (56.5%) | 33.4 | 10.8 [8.4–19.6] | 12.4 | 0.7 | 9.8 | 28.2 / 32.2 | 1 | yes | - |
| unset/T88/Ring | 13×13 | 84 | 5 | 20 [20–26] | 21.2 | 12 (60.0%) | 26.6 | 6.0 [4.4–21.7] | 8.9 | 0.6 | 5.4 | 26.0 / 29.7 | 5 | yes | - |
| unset/T88/X | 14×14 | 96 | 5 | 24 [23–27] | 24.4 | 15 (55.6%) | 35.6 | 11.9 [5.1–13.3] | 10.6 | 0.8 | 11.1 | 24.2 / 27.6 | 4 | yes | - |
| unset/T88/Butterfly | 12×13 | 80 | 5 | 20 [18–23] | 20.4 | 8 (44.4%) | 32.4 | 10.8 [9.4–17.3] | 12.1 | 1.1 | 9.6 | 26.0 / 29.7 | 2 | yes | - |
| unset/T88/Rocket | 18×14 | 92 | 5 | 22 [21–30] | 23.8 | 15 (64.0%) | 30.7 | 6.4 [4.2–14.6] | 7.7 | 0.5 | 5.9 | 24.2 / 27.6 | 4 | yes | - |
| unset/T88/Pine | 18×16 | 88 | 5 | 20 [19–24] | 20.8 | 12 (59.1%) | 29.0 | 7.5 [4.8–19.6] | 9.9 | 0.6 | 7.0 | 21.1 / 24.2 | 4 | yes | - |
| unset/T88/Cat | 14×14 | 82 | 5 | 19 [17–21] | 19.0 | 12 (61.9%) | 26.0 | 7.0 [5.8–9.1] | 7.3 | 0.6 | 6.5 | 24.2 / 27.6 | 1 | yes | - |
| unset/T88/Mushroom | 15×14 | 88 | 5 | 24 [19–25] | 22.4 | 13 (60.0%) | 30.6 | 8.3 [4.3–11.6] | 8.0 | 0.6 | 7.7 | 24.2 / 27.6 | 3 | yes | - |
| unset/T88/Fish | 13×16 | 96 | 5 | 21 [21–24] | 21.8 | 13 (59.1%) | 30.6 | 8.6 [3.2–14.2] | 8.4 | 0.6 | 8.0 | 21.1 / 24.2 | 5 | yes | - |
| unset/T145/Square | 12×12 | 144 | 5 | 39 [33–40] | 37.6 | 17 (47.2%) | 59.7 | 19.7 [10.0–36.6] | 20.8 | 1.1 | 17.8 | 28.2 / 32.2 | 3 | yes | - |
| unset/T145/Rectangle | 10×15 | 150 | 5 | 36 [35–40] | 36.8 | 16 (42.9%) | 58.8 | 20.1 [18.9–25.3] | 21.2 | 1.3 | 19.2 | 22.6 / 25.8 | 5 | yes | - |
| unset/T145/Circle | 15×15 | 145 | 5 | 38 [30–40] | 36.8 | 15 (45.9%) | 60.2 | 21.2 [14.7–22.6] | 19.3 | 1.1 | 20.1 | 22.6 / 25.8 | 2 | yes | - |
| unset/T145/Diamond | 18×18 | 144 | 5 | 37 [34–42] | 37.4 | 16 (47.1%) | 54.9 | 17.9 [15.4–28.8] | 19.3 | 1.1 | 16.6 | 18.8 / 21.5 | 3 | yes | - |
| unset/T145/Triangle | 19×19 | 128 | 5 | 32 [26–40] | 31.8 | 14 (48.3%) | 46.3 | 14.3 [12.5–22.4] | 16.9 | 1.0 | 13.5 | 17.8 / 20.4 | 4 | yes | - |
| unset/T145/Plus | 17×17 | 129 | 5 | 32 [28–35] | 31.6 | 14 (45.7%) | 45.3 | 14.3 [13.3–20.7] | 15.7 | 1.1 | 13.2 | 19.9 / 22.7 | 4 | yes | - |
| unset/T145/Hexagon | 16×16 | 156 | 5 | 35 [32–38] | 35.6 | 14 (40.6%) | 55.8 | 22.2 [15.5–29.1] | 22.7 | 1.4 | 20.8 | 21.1 / 24.2 | 4 | yes | - |
| unset/T145/Star | 22×22 | 148 | 5 | 38 [33–39] | 37.2 | 20 (53.8%) | 53.5 | 14.5 [11.7–33.3] | 18.6 | 0.8 | 13.7 | 15.4 / 17.6 | 3 | yes | - |
| unset/T145/Heart | 14×14 | 148 | 5 | 35 [33–41] | 36.2 | 16 (45.7%) | 57.6 | 22.6 [20.2–25.5] | 23.0 | 1.1 | 21.5 | 24.2 / 27.6 | 2 | yes | - |
| unset/T145/Trophy | 25×21 | 150 | 5 | 35 [33–37] | 35.0 | 23 (64.9%) | 52.1 | 15.1 [10.2–21.4] | 14.9 | 0.5 | 14.5 | 16.1 / 18.4 | 2 | yes | - |
| unset/T145/Crescent | 21×21 | 145 | 5 | 38 [36–40] | 38.0 | 19 (50.0%) | 50.3 | 12.9 [12.1–22.5] | 14.6 | 0.9 | 12.3 | 16.1 / 18.4 | 1 | yes | - |
| unset/T145/Flower | 18×18 | 160 | 5 | 38 [34–40] | 37.2 | 16 (45.0%) | 59.9 | 21.9 [16.1–26.2] | 22.0 | 1.2 | 20.3 | 18.8 / 21.5 | 4 | yes | - |
| unset/T145/Bolt | 41×33 | 154 | 5 | 39 [35–42] | 39.2 | 22 (57.1%) | 57.2 | 15.2 [9.9–18.3] | 14.6 | 0.7 | 14.5 | 10.3 / 11.7 | 4 | yes | - |
| unset/T145/Arrow | 24×22 | 144 | 5 | 37 [32–39] | 35.8 | 17 (45.9%) | 55.7 | 18.8 [18.6–20.5] | 19.3 | 1.1 | 18.0 | 15.4 / 17.6 | 3 | yes | - |
| unset/T145/Crown | 17×20 | 146 | 5 | 36 [35–41] | 36.8 | 18 (48.8%) | 55.5 | 19.9 [15.5–28.5] | 20.4 | 1.0 | 18.9 | 16.9 / 19.3 | 4 | yes | - |
| unset/T145/Hourglass | 20×16 | 136 | 5 | 35 [28–38] | 33.4 | 17 (57.1%) | 49.4 | 17.2 [11.3–18.2] | 15.7 | 0.7 | 16.6 | 21.1 / 24.2 | 1 | yes | - |
| unset/T145/Pentagon | 16×16 | 138 | 5 | 33 [28–37] | 32.6 | 15 (45.5%) | 50.8 | 17.8 [11.2–28.2] | 17.6 | 1.1 | 16.5 | 21.1 / 24.2 | 2 | yes | - |
| unset/T145/Octagon | 15×15 | 145 | 5 | 38 [30–40] | 36.8 | 15 (45.9%) | 60.2 | 21.2 [14.7–22.6] | 19.3 | 1.1 | 20.1 | 22.6 / 25.8 | 2 | yes | - |
| unset/T145/Ring | 17×17 | 156 | 5 | 41 [39–43] | 41.0 | 20 (46.5%) | 64.9 | 21.9 [18.2–35.6] | 25.2 | 1.1 | 20.8 | 19.9 / 22.7 | 2 | yes | - |
| unset/T145/X | 18×18 | 136 | 5 | 36 [34–39] | 36.4 | 21 (58.3%) | 51.1 | 12.7 [4.7–19.8] | 13.0 | 0.7 | 12.0 | 18.8 / 21.5 | 5 | yes | - |
| unset/T145/Butterfly | 16×18 | 156 | 5 | 36 [34–41] | 37.0 | 19 (55.9%) | 52.1 | 18.1 [11.1–33.1] | 19.2 | 0.8 | 17.3 | 18.8 / 21.5 | 5 | yes | - |
| unset/T145/Rocket | 23×17 | 132 | 5 | 31 [31–48] | 35.6 | 18 (56.3%) | 53.0 | 22.0 [9.7–28.0] | 20.4 | 0.8 | 20.3 | 19.9 / 22.7 | 2 | yes | - |
| unset/T145/Pine | 23×21 | 151 | 5 | 39 [36–49] | 40.6 | 20 (52.8%) | 55.0 | 16.0 [9.6–33.9] | 18.1 | 0.8 | 15.0 | 16.1 / 18.4 | 2 | yes | - |
| unset/T145/Cat | 18×18 | 136 | 5 | 30 [28–35] | 30.8 | 17 (54.8%) | 43.8 | 12.9 [9.4–14.9] | 13.0 | 0.8 | 12.1 | 18.8 / 21.5 | 1 | yes | - |
| unset/T145/Mushroom | 19×18 | 152 | 5 | 39 [32–44] | 38.0 | 19 (46.3%) | 59.2 | 18.2 [13.2–28.5] | 20.3 | 1.1 | 17.1 | 18.8 / 21.5 | 5 | yes | - |
| unset/T145/Fish | 17×20 | 146 | 5 | 37 [33–40] | 36.6 | 19 (47.5%) | 57.7 | 19.7 [11.4–34.7] | 20.6 | 1.1 | 18.7 | 16.9 / 19.3 | 5 | yes | - |
| b3/T88/Square | 9×9 | 81 | 5 | 18 [15–23] | 18.6 | 11 (61.1%) | 24.0 | 4.6 [3.6–8.2] | 5.3 | 0.6 | 3.9 | 37.6 / 43.0 | 1 | yes | - |
| b3/T88/Rectangle | 8×12 | 96 | 5 | 22 [19–25] | 21.8 | 14 (68.2%) | 28.0 | 6.0 [3.2–6.5] | 5.3 | 0.4 | 5.6 | 28.2 / 32.2 | 2 | yes | - |
| b3/T88/Circle | 11×11 | 81 | 5 | 19 [16–25] | 19.8 | 12 (64.7%) | 22.1 | 5.1 [2.5–9.9] | 6.1 | 0.5 | 4.7 | 30.8 / 35.2 | 2 | yes | - |
| b3/T88/Diamond | 14×14 | 84 | 5 | 21 [20–24] | 21.4 | 14 (66.7%) | 26.2 | 5.4 [4.3–13.1] | 6.8 | 0.5 | 5.0 | 24.2 / 27.6 | 1 | yes | - |
| b3/T88/Triangle | 15×15 | 85 | 5 | 21 [17–25] | 20.6 | 16 (76.5%) | 25.6 | 3.7 [0.4–10.4] | 4.5 | 0.3 | 3.4 | 22.6 / 25.8 | 5 | yes | - |
| b3/T88/Plus | 13×13 | 85 | 5 | 21 [17–21] | 20.0 | 12 (57.1%) | 29.8 | 8.8 [4.4–11.7] | 8.4 | 0.7 | 8.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/T88/Hexagon | 12×12 | 84 | 5 | 20 [18–22] | 20.0 | 13 (65.0%) | 24.8 | 4.8 [3.4–10.1] | 6.0 | 0.5 | 4.3 | 28.2 / 32.2 | 1 | yes | - |
| b3/T88/Star | 17×17 | 83 | 5 | 21 [17–26] | 20.8 | 14 (66.7%) | 25.6 | 4.6 [2.7–14.4] | 6.3 | 0.5 | 4.2 | 19.9 / 22.7 | 1 | yes | - |
| b3/T88/Heart | 11×11 | 93 | 5 | 22 [21–22] | 21.6 | 15 (71.4%) | 27.4 | 6.4 [3.2–9.4] | 6.1 | 0.4 | 6.0 | 30.8 / 35.2 | 1 | yes | - |
| b3/T88/Trophy | 19×16 | 86 | 5 | 23 [19–24] | 21.8 | 15 (65.2%) | 29.4 | 6.8 [1.8–9.4] | 5.6 | 0.5 | 6.0 | 21.1 / 24.2 | 3 | yes | - |
| b3/T88/Crescent | 16×16 | 82 | 5 | 21 [18–27] | 22.0 | 17 (77.8%) | 25.2 | 3.2 [1.6–7.9] | 4.2 | 0.3 | 3.0 | 21.1 / 24.2 | 2 | yes | - |
| b3/T88/Flower | 14×14 | 100 | 5 | 23 [20–24] | 22.6 | 12 (54.5%) | 32.8 | 9.6 [8.9–11.6] | 9.8 | 0.8 | 8.8 | 24.2 / 27.6 | 5 | yes | - |
| b3/T88/Bolt | 32×26 | 96 | 5 | 26 [22–30] | 26.4 | 20 (76.9%) | 29.4 | 3.4 [1.7–6.1] | 3.6 | 0.3 | 3.1 | 13.0 / 14.9 | 5 | yes | - |
| b3/T88/Arrow | 19×17 | 91 | 5 | 26 [20–27] | 24.6 | 16 (65.4%) | 30.1 | 7.4 [4.1–9.0] | 6.9 | 0.5 | 7.0 | 19.9 / 22.7 | 1 | yes | - |
| b3/T88/Crown | 13×15 | 82 | 5 | 20 [16–27] | 20.6 | 12 (64.7%) | 25.2 | 7.6 [5.2–14.8] | 8.4 | 0.5 | 7.2 | 22.6 / 25.8 | 5 | yes | - |
| b3/T88/Hourglass | 16×13 | 86 | 5 | 21 [18–25] | 21.4 | 16 (76.2%) | 24.8 | 3.8 [1.2–9.5] | 4.2 | 0.3 | 3.5 | 26.0 / 29.7 | 4 | yes | - |
| b3/T88/Pentagon | 13×13 | 84 | 5 | 19 [17–19] | 18.2 | 12 (70.6%) | 20.3 | 2.3 [1.3–7.9] | 3.2 | 0.4 | 1.9 | 26.0 / 29.7 | 3 | yes | - |
| b3/T88/Octagon | 12×12 | 88 | 5 | 23 [19–25] | 22.4 | 18 (72.0%) | 27.4 | 4.0 [2.8–7.5] | 4.5 | 0.4 | 3.5 | 28.2 / 32.2 | 5 | yes | - |
| b3/T88/Ring | 13×13 | 84 | 5 | 23 [19–25] | 22.6 | 16 (69.6%) | 29.5 | 5.5 [3.9–10.3] | 6.6 | 0.4 | 5.1 | 26.0 / 29.7 | 5 | yes | - |
| b3/T88/X | 14×14 | 96 | 5 | 24 [24–30] | 25.6 | 19 (73.1%) | 29.2 | 5.2 [2.9–13.0] | 6.0 | 0.3 | 4.8 | 24.2 / 27.6 | 4 | yes | - |
| b3/T88/Butterfly | 12×13 | 80 | 5 | 23 [17–23] | 21.2 | 13 (65.2%) | 28.7 | 5.9 [4.6–10.8] | 7.5 | 0.5 | 5.5 | 26.0 / 29.7 | 2 | yes | - |
| b3/T88/Rocket | 18×14 | 92 | 5 | 23 [19–27] | 23.4 | 16 (68.0%) | 31.0 | 8.0 [1.0–9.9] | 6.8 | 0.4 | 7.1 | 24.2 / 27.6 | 5 | yes | - |
| b3/T88/Pine | 18×16 | 88 | 5 | 20 [18–23] | 20.0 | 14 (66.7%) | 24.3 | 3.8 [3.1–6.7] | 4.7 | 0.5 | 3.4 | 21.1 / 24.2 | 3 | yes | - |
| b3/T88/Cat | 14×14 | 82 | 5 | 22 [18–24] | 21.6 | 15 (72.7%) | 26.1 | 4.1 [1.2–9.8] | 5.5 | 0.4 | 3.7 | 24.2 / 27.6 | 3 | yes | - |
| b3/T88/Mushroom | 15×14 | 88 | 5 | 20 [20–22] | 20.8 | 14 (68.2%) | 28.5 | 8.5 [3.4–12.3] | 8.2 | 0.4 | 8.1 | 24.2 / 27.6 | 1 | yes | - |
| b3/T88/Fish | 13×16 | 96 | 5 | 24 [20–25] | 23.0 | 15 (68.2%) | 27.1 | 6.6 [1.3–9.2] | 5.8 | 0.4 | 5.9 | 21.1 / 24.2 | 4 | yes | - |
| b3/T145/Square | 12×12 | 144 | 5 | 34 [30–36] | 33.6 | 21 (61.1%) | 45.4 | 12.6 [5.8–17.0] | 11.5 | 0.6 | 12.0 | 28.2 / 32.2 | 1 | yes | - |
| b3/T145/Rectangle | 10×15 | 150 | 5 | 36 [29–37] | 34.6 | 20 (56.8%) | 53.3 | 18.4 [9.9–24.3] | 17.7 | 0.7 | 17.6 | 22.6 / 25.8 | 2 | yes | - |
| b3/T145/Circle | 15×15 | 145 | 5 | 34 [29–39] | 33.8 | 18 (50.0%) | 56.1 | 22.1 [9.1–23.6] | 17.8 | 0.9 | 21.0 | 22.6 / 25.8 | 3 | yes | - |
| b3/T145/Diamond | 18×18 | 144 | 5 | 34 [31–38] | 34.6 | 21 (56.8%) | 43.5 | 10.1 [9.3–18.9] | 12.5 | 0.7 | 9.3 | 18.8 / 21.5 | 2 | yes | - |
| b3/T145/Triangle | 19×19 | 128 | 5 | 30 [25–34] | 29.8 | 21 (61.8%) | 38.2 | 8.2 [4.9–10.5] | 8.2 | 0.6 | 7.5 | 17.8 / 20.4 | 3 | yes | - |
| b3/T145/Plus | 17×17 | 129 | 5 | 33 [25–36] | 31.6 | 18 (56.7%) | 41.0 | 9.7 [8.0–21.5] | 13.0 | 0.7 | 9.0 | 19.9 / 22.7 | 3 | yes | - |
| b3/T145/Hexagon | 16×16 | 156 | 5 | 39 [30–43] | 38.2 | 20 (50.0%) | 56.2 | 15.2 [11.9–31.9] | 18.8 | 0.9 | 14.4 | 21.1 / 24.2 | 5 | yes | - |
| b3/T145/Star | 22×22 | 148 | 5 | 36 [33–45] | 37.2 | 24 (61.8%) | 51.1 | 14.5 [9.0–22.3] | 15.0 | 0.6 | 13.9 | 15.4 / 17.6 | 5 | yes | - |
| b3/T145/Heart | 14×14 | 148 | 5 | 35 [29–41] | 35.2 | 20 (53.7%) | 57.1 | 20.3 [7.2–22.3] | 16.2 | 0.8 | 19.5 | 24.2 / 27.6 | 3 | yes | - |
| b3/T145/Trophy | 25×21 | 150 | 5 | 36 [29–39] | 34.6 | 24 (69.7%) | 47.2 | 11.2 [5.4–14.4] | 9.6 | 0.4 | 10.7 | 16.1 / 18.4 | 4 | yes | - |
| b3/T145/Crescent | 21×21 | 145 | 5 | 37 [34–40] | 37.0 | 24 (62.2%) | 46.7 | 9.7 [5.4–14.2] | 9.8 | 0.6 | 9.2 | 16.1 / 18.4 | 3 | yes | - |
| b3/T145/Flower | 18×18 | 160 | 5 | 39 [30–41] | 37.0 | 20 (48.8%) | 58.5 | 19.5 [8.3–24.2] | 18.1 | 1.0 | 18.6 | 18.8 / 21.5 | 4 | yes | - |
| b3/T145/Bolt | 41×33 | 154 | 5 | 42 [34–43] | 39.6 | 29 (69.0%) | 49.2 | 11.0 [5.2–12.8] | 9.4 | 0.4 | 10.6 | 10.3 / 11.7 | 5 | yes | - |
| b3/T145/Arrow | 24×22 | 144 | 5 | 37 [35–43] | 37.8 | 23 (62.2%) | 48.7 | 11.9 [5.7–14.7] | 10.4 | 0.6 | 11.2 | 15.4 / 17.6 | 1 | yes | - |
| b3/T145/Crown | 17×20 | 146 | 5 | 36 [32–40] | 35.8 | 22 (59.0%) | 52.8 | 13.8 [9.0–24.2] | 15.6 | 0.7 | 13.1 | 16.9 / 19.3 | 3 | yes | - |
| b3/T145/Hourglass | 20×16 | 136 | 5 | 32 [29–39] | 32.4 | 22 (68.8%) | 43.3 | 11.3 [3.2–25.1] | 12.5 | 0.4 | 10.8 | 21.1 / 24.2 | 3 | yes | - |
| b3/T145/Pentagon | 16×16 | 138 | 5 | 33 [29–36] | 33.2 | 18 (54.5%) | 54.2 | 19.8 [8.2–25.6] | 17.3 | 0.8 | 19.1 | 21.1 / 24.2 | 1 | yes | - |
| b3/T145/Octagon | 15×15 | 145 | 5 | 34 [29–39] | 33.8 | 18 (50.0%) | 56.1 | 22.1 [9.1–23.6] | 17.8 | 0.9 | 21.0 | 22.6 / 25.8 | 3 | yes | - |
| b3/T145/Ring | 17×17 | 156 | 5 | 41 [37–46] | 40.8 | 20 (54.1%) | 60.1 | 20.0 [10.9–40.2] | 22.2 | 0.8 | 19.1 | 19.9 / 22.7 | 5 | yes | - |
| b3/T145/X | 18×18 | 136 | 5 | 36 [32–36] | 34.6 | 25 (72.2%) | 42.4 | 7.1 [5.1–13.7] | 8.2 | 0.4 | 6.8 | 18.8 / 21.5 | 1 | yes | - |
| b3/T145/Butterfly | 16×18 | 156 | 5 | 40 [31–41] | 37.6 | 23 (57.5%) | 55.2 | 15.7 [4.0–21.8] | 14.5 | 0.7 | 15.0 | 18.8 / 21.5 | 1 | yes | - |
| b3/T145/Rocket | 23×17 | 132 | 5 | 34 [33–38] | 35.4 | 27 (73.7%) | 43.8 | 8.6 [6.1–9.8] | 8.4 | 0.3 | 8.3 | 19.9 / 22.7 | 5 | yes | - |
| b3/T145/Pine | 23×21 | 151 | 5 | 37 [36–40] | 37.6 | 21 (55.6%) | 54.2 | 16.6 [9.2–18.5] | 14.7 | 0.8 | 15.4 | 16.1 / 18.4 | 5 | yes | - |
| b3/T145/Cat | 18×18 | 136 | 5 | 33 [32–36] | 33.8 | 19 (57.1%) | 49.6 | 17.3 [11.2–18.9] | 16.1 | 0.7 | 16.6 | 18.8 / 21.5 | 3 | yes | - |
| b3/T145/Mushroom | 19×18 | 152 | 5 | 34 [32–36] | 34.2 | 19 (55.6%) | 49.2 | 14.2 [10.5–16.4] | 14.1 | 0.8 | 13.5 | 18.8 / 21.5 | 3 | yes | - |
| b3/T145/Fish | 17×20 | 146 | 5 | 36 [30–38] | 34.4 | 20 (60.5%) | 46.8 | 12.6 [7.4–21.6] | 12.7 | 0.6 | 12.0 | 16.9 / 19.3 | 3 | yes | - |

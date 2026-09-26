# Clearable-bias transfer curve (generator v2, W3-11)

Measured 2026-09-26 on branch `next-level`, base `c31dd8e` plus the W3-11 change (`clearableBias` on
`DifficultyConfig`, the `fillMask` weighting, `LevelGenerator.generate(i, 2, { clearableBias })` and the probe's
`--bias`, `--size-sweep` and `--transfer`). Every number below is EXECUTED output of
`scripts/analysis/difficulty-probe.ts` (the `npm run analysis:probe -- <flags>` form is identical).

> **The probe's own honesty bound:** "Search-cost proxy for a uniform-sampling player. Not a measurement of
> human difficulty; never correlated with real mistakes (see W3-23)." Nothing below is a measurement of human
> difficulty or of how a board looks.

**Status.** The knob is dark: `GEN_V2_ENABLED = false`, and with `clearableBias` unset v2 deals W3-10's boards
byte for byte (corpus 0–299 `04d0ec7e`, pinned by a test). The b values below are sweep points, not shipped
values. Choosing one is W3-14's job.

## Answers first

- **Premise check: HOLDS, in both directions** (ruling W3-6). On set (ii), the level-1-sized boards, the median
  clearable-at-deal moves outside the neutral 5-seed band:
  - b = 0.1 gives 22.9% and b = 0.3 gives 35.0%; the band is 44.0–47.8%.
  - b = 3 gives 59.1% and b = 10 gives 69.2%.
  - For all four, every seed replica lies outside the band. The ranges do not overlap.
- **Transfer (set (ii) medians).** Arrow counts stay put (27 [25–29] neutral), so the knob moves search cost at
  fixed size:

  | b | 0.1 | 0.3 | 1 | 3 | 10 |
  |---|---|---|---|---|---|
  | clearable@0 (neutral band 44.0–47.8%) | 22.9% | 35.0% | 47.1% | 59.1% | 69.2% |
  | blocked taps (neutral band 12.6–17.9) | 28.7 | 21.2 | 16.7 | 9.4 | 7.2 |

  On set (i), v2 levels 1–100, clearable@0 goes 17.7% / 24.7% / 33.3% / 41.5% / 48.0% (band 33.3–35.8%). Blocked
  goes 140.9 / 103.1 / 81.6 / 68.7 / 60.4 (band 76.8–84.4).
- **Range and saturation.** The knob is stronger downward than upward.
  - On set (i), b = 0.1 adds 73% to median blocked taps, while b = 10 removes 26%.
  - From 3 to 10, set (ii) gains only 10 points of clearability, and set (i) only 6.5.
  - Geometry caps how many heads can sit on the silhouette's boundary. At b = 10 only 7 of the 27 boards reach 78%
    clearable or more: Circle 8, 9 and 12; Square 8 and 11; Heart 8 and 9 rows.
- **Brand gate** (bend rate or mean length outside the neutral 5-seed band on either set):

  | b | verdict | why |
  |---|---|---|
  | 0.1 | **changes arrow look** | set (i) bend 57.2% (band 58.4–61.1%); meanLen 3.937 on set (i) (band 4.022–4.072) and 3.979 on set (ii) (band 3.984–4.205) |
  | 0.3 | **changes arrow look** | set (i) meanLen 4.000 (band 4.022–4.072); some replicas are inside the band |
  | 1 | inside | the identity: byte-identical to unset (test) |
  | 3 | inside both bands | |
  | 10 | **changes arrow look** | set (i) bend 61.3% (band 58.4–61.1%, ranges overlap) and meanLen 4.120 (band 4.022–4.072) |

  The flagged shifts are small. Against the neutral median on set (i):
  - mean length moves by −0.10 (b = 0.1), −0.04 (b = 0.3) and +0.08 cells (b = 10);
  - bend rate moves by −2.7 points (b = 0.1) and +1.4 points (b = 10).

  They are flagged because the set (i) bands are narrow (each replica pools about 9,000 arrows). The brief's rule
  is binary, and this doc applies it as written. Per the brief, a flagged b is
  not usable in a curve without an owner yes on a screenshot (see "Screenshots").
- **Pointer for W3-12, not a gate.** Blocked ≤ 5 is reachable at level-1 sizes of about 23–26 arrows when the
  board is about 70% clearable. That is the red team's "about 25 arrows if clearability stays near 80%" claim,
  measured:
  - At b = 3: Circle 12×12, 23 arrows, 72.0% clearable, median blocked 4.0.
  - At b = 10: Square 10×10, 26 arrows, 70.4% clearable, blocked 3.9.
  - Neutral: only Circle 8×8 (9 arrows) gets there.

  These are medians over 5 seeds; the per-seed spread is wide (see the per-board tables).

## Method

**The knob.** `clearableBias` multiplies the fill's pick weight of each candidate head whose exit lane holds no
mask cell at all.
- A carved head's lane never holds an unfilled cell (`rayClearOfNeed`), so a mask cell in the lane can only be an
  arrow carved earlier, which blocks this one at deal. "Lane holds no mask cell" is therefore exactly "clearable at
  deal".
- A jest test checks that equivalence on 81 boards: `canExit` at deal equals the empty mask lane for every arrow.
- A second test replays fills in carve order. At b = 1e9 every carve takes a lane-empty head whenever one is legal,
  and at 1e-9 it never does.
- Only weights change, never the candidate set, so every board still fills and solves:
  - `sweep(2)` passes at b = 0.1 and b = 10 over v2 levels 0–299;
  - every shape passes at 1e-6 and 1e6.

**Set (i).** v2 displayed levels 1–100 (100 levels). The mask, size and tier of a level do not depend on b; the
probe asserts this. Streams:
- **Seed replicas s = 1..5.** Refill every level's own v2 mask with its tier config plus b, using
  `DotNetRandom(s)`. This is how "b = unset over 5 seeds" exists for a set of fixed levels.
- **Real v2.** `generate(i, 2, { clearableBias: b })` on the level's own stream, shown for reference:
  - its clearable@0 lies inside the replica range at every b;
  - its scan or blocked falls just outside at three settings (unset blocked 76.0 against [76.8–84.4]; scan at
    b = 0.3 and b = 3).
  It is one stream, not a band.

**Set (ii).** Circle, Square and Heart × rows 8–16 (27 boards). cols = `v2Cols(rows, aspect)`. Normal config
(level 1 is Normal). `DotNetRandom(1..5)`.

**Aggregates.**
- For each stream: the median over boards of clearable@0 %, scan, blocked and arrows. Bend % and mean length are
  pooled over all arrows.
- **Band:** the min–max of the 5 unset replicas.
- **Each b:** the median of its 5 replicas, with their min–max.
- ↑/↓ mark a median outside the band. "(ranges overlap)" means some replica still falls inside it.

## Pre-fix reproduction: the evidence red team's size-only sweep

This is the brief's verification step 1. The red team's sweep was rows 6–16 × Circle/Square/Heart × 5 seeds (their
figures are in `docs/next-level/sources/redteam-evidence-15.json`).

**Runs.**
- Against the base code: a scratch script over a `git archive c31dd8e src/core` copy.
- After the change: `--size-sweep --rows 6-16` with the bias unset.
- Both runs give identical arrow means, blocked means and blocked ranges for all 33 boards.

| red-team figure | this run (5 seeds: mean, or median where noted; [seed min–max]) | inside the seed band? |
|---|---|---|
| Circle 8 rows: 10.2 arrows, 63.6% clearable, blocked 2.5 | arrows mean 10.0 [9–12]; clearable median **63.6%** [44.4–75.0]; blocked mean **2.5** [1.5–4.0] | yes, all three |
| Circle 9–10 rows: about 16 arrows, blocked 5.0–5.5 | 9 rows: 15.2 arrows [12–18], blocked 5.2 [1.3–8.5]; 10 rows: 17.6 [14–20], blocked 7.3 [3.0–10.2] | yes |
| about 21 arrows gives blocked 8.8 | Square 9×9: 20.8 arrows, blocked 11.0 [8.0–17.3]; Heart 10×10: 20.0, 12.1 [7.3–15.7] | yes |
| about 38 arrows gives blocked 32.3 | Square 12×12: 37.6 arrows, blocked 20.8 [10.0–36.6] (yes); Heart 15×15: 40.8, 26.5 [17.5–38.7] (yes); Circle 15×15: 36.8, 19.3 [14.7–22.6] (no) | yes for 2 of 3 shapes |
| blocked ≤ 5 first reached at about 10–16 arrows | mean blocked ≤ 5: Circle 8×8 (10.0 arrows), Square 7×7 (11.0), Heart 7×7 (10.2); borderline 5.2 at Circle 9×9 (15.2) and Heart 8×8 (12.0) | yes |

Command: `npx tsx scripts/analysis/difficulty-probe.ts --size-sweep --rows 6-16` (rows 6–7 are below v2's row
floor of 8; v2 never deals them). The red team did not publish their script, so arrows 10.2 against 10.0 is not
reconciled beyond "inside the band".

## Set (i): v2 levels 1–100

Command: `npx tsx scripts/analysis/difficulty-probe.ts --version 2 --levels 1-100 --transfer`.

| b | clearable@0 median [replica min–max] | scan | blocked | bend% (pooled) | meanLen (pooled) | arrows | real v2: clearable@0 / scan / blocked / bend% / meanLen |
|---|---|---|---|---|---|---|---|
| unset | 33.3% [33.3%–35.8%] (band) | 169.4 [164.3–171.5] (band) | 81.6 [76.8–84.4] (band) | 60.0% [58.4%–61.1%] (band) | 4.04 [4.02–4.07] (band) | 90.0 [89.0–91.0] (band) | 35.3% / 164.3 / 76.0 / 60.5% / 4.04 |
| 0.1 | 17.7% [15.4%–18.5%] ↓ | 236.6 [234.0–241.4] ↑ | 140.9 [139.0–151.9] ↑ | 57.2% [55.2%–58.1%] ↓ | 3.94 [3.87–3.97] ↓ | 93.0 [92.0–97.0] ↑ | 16.7% / 236.9 / 144.9 / 57.7% / 3.94 |
| 0.3 | 24.7% [24.6%–25.6%] ↓ | 195.3 [184.2–201.2] ↑ | 103.1 [99.2–111.2] ↑ | 58.7% [58.1%–59.3%] | 4.00 [3.97–4.04] ↓ (ranges overlap) | 91.0 [91.0–93.0] | 25.3% / 206.7 / 110.1 / 59.3% / 3.98 |
| 1 | 33.3% [33.3%–35.8%] | 169.4 [164.3–171.5] | 81.6 [76.8–84.4] | 60.0% [58.4%–61.1%] | 4.04 [4.02–4.07] | 90.0 [89.0–91.0] | 35.3% / 164.3 / 76.0 / 60.5% / 4.04 |
| 3 | 41.5% [40.2%–44.2%] ↑ | 155.3 [152.9–162.4] ↓ | 68.7 [62.4–71.5] ↓ | 60.5% [59.3%–61.8%] | 4.06 [4.03–4.13] | 91.0 [88.0–92.0] | 42.2% / 151.6 / 66.6 / 60.4% / 4.04 |
| 10 | 48.0% [46.0%–49.2%] ↑ | 149.9 [141.0–155.5] ↓ | 60.4 [57.0–66.4] ↓ | 61.3% [60.5%–62.0%] ↑ (ranges overlap) | 4.12 [4.08–4.13] ↑ | 91.0 [87.0–91.0] | 47.8% / 146.5 / 60.0 / 61.7% / 4.09 |

## Set (ii): level-1-sized boards (27 boards × 5 seeds)

Same command (set (ii) defaults: `--shapes Circle,Square,Heart --rows 8-16 --seeds 1-5`).

| b | clearable@0 median [replica min–max] | scan | blocked | bend% (pooled) | meanLen (pooled) | arrows |
|---|---|---|---|---|---|---|
| unset | 47.1% [44.0%–47.8%] (band) | 43.4 [40.0–46.5] (band) | 16.7 [12.6–17.9] (band) | 57.4% [54.1%–63.1%] (band) | 4.03 [3.98–4.20] (band) | 27.0 [25.0–29.0] (band) |
| 0.1 | 22.9% [16.0%–24.2%] ↓ | 58.7 [48.7–61.4] ↑ | 28.7 [23.7–33.4] ↑ | 56.4% [51.9%–56.6%] | 3.98 [3.94–4.09] ↓ (ranges overlap) | 29.0 [25.0–30.0] |
| 0.3 | 35.0% [33.3%–37.5%] ↓ | 50.2 [43.2–52.6] ↑ (ranges overlap) | 21.2 [18.6–23.2] ↑ | 56.5% [54.4%–60.9%] | 4.04 [3.95–4.14] | 27.0 [25.0–28.0] |
| 1 | 47.1% [44.0%–47.8%] | 43.4 [40.0–46.5] | 16.7 [12.6–17.9] | 57.4% [54.1%–63.1%] | 4.03 [3.98–4.20] | 27.0 [25.0–29.0] |
| 3 | 59.1% [55.9%–61.5%] ↑ | 37.6 [33.7–42.2] ↓ (ranges overlap) | 9.4 [6.5–10.1] ↓ | 59.9% [55.1%–61.9%] | 4.11 [4.00–4.22] | 28.0 [27.0–30.0] |
| 10 | 69.2% [64.3%–71.0%] ↑ | 32.8 [30.7–37.5] ↓ | 7.2 [4.8–9.7] ↓ | 59.1% [56.0%–61.4%] | 4.17 [3.98–4.25] | 27.0 [26.0–28.0] |

### Per board: clearable@0 %, median over seeds

The unset column shows that board's seed min–max; ↑/↓ mark a median outside it.

| board | unset | 0.1 | 0.3 | 1 | 3 | 10 |
|---|---|---|---|---|---|---|
| Circle 8×8 | 63.6 [44.4–75.0] | 37.5 ↓ | 50.0 | 63.6 | 70.0 | 87.5 ↑ |
| Circle 9×9 | 66.7 [38.9–69.2] | 23.5 ↓ | 40.0 | 66.7 | 86.7 ↑ | 84.6 ↑ |
| Circle 10×10 | 47.1 [40.0–58.8] | 22.7 ↓ | 37.5 ↓ | 47.1 | 62.5 ↑ | 69.2 ↑ |
| Circle 11×11 | 52.6 [35.0–57.9] | 28.0 ↓ | 38.1 | 52.6 | 64.7 ↑ | 66.7 ↑ |
| Circle 12×12 | 56.5 [47.6–60.0] | 19.0 ↓ | 33.3 ↓ | 56.5 | 72.0 ↑ | 80.0 ↑ |
| Circle 13×13 | 48.1 [47.8–58.3] | 20.8 ↓ | 39.3 ↓ | 48.1 | 60.7 ↑ | 69.2 ↑ |
| Circle 14×14 | 39.4 [34.4–53.3] | 18.8 ↓ | 37.1 | 39.4 | 60.0 ↑ | 65.4 ↑ |
| Circle 15×15 | 45.9 [32.5–50.0] | 18.4 ↓ | 30.8 ↓ | 45.9 | 50.0 | 61.8 ↑ |
| Circle 16×16 | 45.5 [39.0–52.6] | 15.2 ↓ | 29.3 ↓ | 45.5 | 46.2 | 61.0 ↑ |
| Square 8×8 | 40.0 [26.7–69.2] | 20.0 ↓ | 42.1 | 40.0 | 61.5 | 81.3 ↑ |
| Square 9×9 | 52.2 [37.5–57.9] | 29.4 ↓ | 33.3 ↓ | 52.2 | 61.1 ↑ | 75.0 ↑ |
| Square 10×10 | 47.8 [37.5–52.6] | 16.0 ↓ | 26.1 ↓ | 47.8 | 59.1 ↑ | 70.4 ↑ |
| Square 11×11 | 32.3 [26.9–54.8] | 20.7 ↓ | 31.0 | 32.3 | 62.5 ↑ | 78.3 ↑ |
| Square 12×12 | 47.2 [32.5–60.0] | 20.0 ↓ | 33.3 | 47.2 | 61.1 ↑ | 63.2 ↑ |
| Square 13×13 | 41.9 [30.0–47.5] | 22.2 ↓ | 30.8 | 41.9 | 55.0 ↑ | 65.9 ↑ |
| Square 14×14 | 42.9 [37.5–44.7] | 21.3 ↓ | 33.3 ↓ | 42.9 | 51.1 ↑ | 63.6 ↑ |
| Square 15×15 | 39.2 [35.0–43.6] | 19.7 ↓ | 26.8 ↓ | 39.2 | 51.7 ↑ | 60.7 ↑ |
| Square 16×16 | 33.9 [32.3–43.5] | 18.3 ↓ | 27.1 ↓ | 33.9 | 46.7 ↑ | 56.5 ↑ |
| Heart 8×8 | 55.6 [38.5–70.0] | 21.4 ↓ | 58.3 | 55.6 | 77.8 ↑ | 88.9 ↑ |
| Heart 9×9 | 41.2 [35.3–50.0] | 21.4 ↓ | 35.3 | 41.2 | 62.5 ↑ | 81.3 ↑ |
| Heart 10×10 | 52.4 [36.8–57.1] | 23.8 ↓ | 36.8 | 52.4 | 73.7 ↑ | 73.7 ↑ |
| Heart 11×11 | 54.5 [45.5–60.0] | 20.8 ↓ | 39.1 ↓ | 54.5 | 71.4 ↑ | 72.7 ↑ |
| Heart 12×12 | 50.0 [42.9–64.0] | 23.3 ↓ | 38.5 ↓ | 50.0 | 60.0 | 77.8 ↑ |
| Heart 13×13 | 50.0 [44.8–54.3] | 25.0 ↓ | 37.9 ↓ | 50.0 | 67.7 ↑ | 63.9 ↑ |
| Heart 14×14 | 45.7 [37.1–53.7] | 22.2 ↓ | 35.1 ↓ | 45.7 | 53.7 | 58.1 ↑ |
| Heart 15×15 | 47.4 [39.0–51.4] | 20.9 ↓ | 38.3 ↓ | 47.4 | 53.8 ↑ | 57.1 ↑ |
| Heart 16×16 | 35.8 [33.3–44.9] | 20.8 ↓ | 34.1 | 35.8 | 50.0 ↑ | 52.3 ↑ |

Boards outside their own neutral band, from the `--json` output:
- b = 0.1: 27 of 27 below;
- b = 0.3: 15 of 27 below;
- b = 3: 21 of 27 above;
- b = 10: 27 of 27 above.

For blocked taps the counts are:
- b = 0.1: 20 above;
- b = 0.3: 13 above;
- b = 3: 13 below;
- b = 10: 21 below.

### Per board: blocked taps, median over seeds

| board | unset | 0.1 | 0.3 | 1 | 3 | 10 |
|---|---|---|---|---|---|---|
| Circle 8×8 | 1.9 [1.5–4.0] | 3.3 | 4.9 ↑ | 1.9 | 2.1 | 0.6 ↓ |
| Circle 9×9 | 6.1 [1.3–8.5] | 16.3 ↑ | 9.4 ↑ | 6.1 | 1.1 ↓ | 2.0 |
| Circle 10×10 | 7.2 [3.0–10.2] | 13.6 ↑ | 11.8 ↑ | 7.2 | 4.6 | 2.4 ↓ |
| Circle 11×11 | 10.3 [6.9–13.7] | 21.9 ↑ | 10.8 | 10.3 | 5.1 ↓ | 7.0 |
| Circle 12×12 | 10.8 [8.4–19.6] | 18.0 | 13.1 | 10.8 | 4.0 ↓ | 3.2 ↓ |
| Circle 13×13 | 12.6 [11.0–19.0] | 28.7 ↑ | 13.8 | 12.6 | 11.7 | 5.5 ↓ |
| Circle 14×14 | 18.0 [14.7–26.9] | 35.9 ↑ | 26.5 | 18.0 | 11.5 ↓ | 9.3 ↓ |
| Circle 15×15 | 21.2 [14.7–22.6] | 42.3 ↑ | 33.3 ↑ | 21.2 | 22.1 | 11.8 ↓ |
| Circle 16×16 | 23.4 [17.9–30.5] | 52.9 ↑ | 42.7 ↑ | 23.4 | 22.4 | 16.3 ↓ |
| Square 8×8 | 7.9 [2.6–19.1] | 11.9 | 6.9 | 7.9 | 6.5 | 2.6 ↓ |
| Square 9×9 | 10.4 [8.0–17.3] | 17.1 | 12.2 | 10.4 | 4.6 ↓ | 2.6 ↓ |
| Square 10×10 | 15.5 [8.1–16.7] | 21.4 ↑ | 19.5 ↑ | 15.5 | 10.2 | 3.9 ↓ |
| Square 11×11 | 18.6 [11.0–31.9] | 32.4 ↑ | 22.9 | 18.6 | 11.2 | 6.5 ↓ |
| Square 12×12 | 19.7 [10.0–36.6] | 54.9 ↑ | 38.2 ↑ | 19.7 | 12.6 | 15.4 |
| Square 13×13 | 25.3 [18.6–46.3] | 45.0 | 38.5 | 25.3 | 25.4 | 14.0 ↓ |
| Square 14×14 | 35.7 [19.2–40.3] | 58.9 ↑ | 46.2 ↑ | 35.7 | 22.8 | 21.6 |
| Square 15×15 | 44.8 [35.9–64.2] | 87.1 ↑ | 57.0 | 44.8 | 34.2 ↓ | 22.3 ↓ |
| Square 16×16 | 54.0 [46.8–64.8] | 78.1 ↑ | 80.6 ↑ | 54.0 | 40.1 ↓ | 34.1 ↓ |
| Heart 8×8 | 5.2 [3.0–7.4] | 8.9 ↑ | 4.6 | 5.2 | 1.2 ↓ | 1.1 ↓ |
| Heart 9×9 | 8.3 [7.1–9.5] | 8.5 | 7.9 | 8.3 | 4.1 ↓ | 1.7 ↓ |
| Heart 10×10 | 11.8 [7.3–15.7] | 14.6 | 13.8 | 11.8 | 5.0 ↓ | 2.9 ↓ |
| Heart 11×11 | 8.3 [7.3–14.1] | 16.8 ↑ | 14.6 ↑ | 8.3 | 6.4 ↓ | 4.0 ↓ |
| Heart 12×12 | 11.8 [8.2–18.5] | 31.1 ↑ | 18.3 | 11.8 | 13.3 | 3.9 ↓ |
| Heart 13×13 | 14.1 [12.6–19.1] | 34.8 ↑ | 23.8 ↑ | 14.1 | 10.9 ↓ | 12.6 |
| Heart 14×14 | 22.6 [20.2–25.5] | 40.0 ↑ | 34.8 ↑ | 22.6 | 20.3 | 13.6 ↓ |
| Heart 15×15 | 23.5 [17.5–38.7] | 62.0 ↑ | 35.5 | 23.5 | 12.1 ↓ | 18.5 |
| Heart 16×16 | 39.0 [27.9–43.6] | 60.6 ↑ | 45.5 ↑ | 39.0 | 31.3 | 23.7 ↓ |

Blocked is noisier per board than clearable. Several boards at b = 3 or 10 still sit inside their neutral blocked
band (for example Square 12×12 at b = 10: 15.4 against [10.0–36.6]). Blocked sums over every state of the walk,
not only the deal.

### Per board: median arrows

| board | unset | 0.1 | 0.3 | 1 | 3 | 10 |
|---|---|---|---|---|---|---|
| Circle 8×8 | 9 | 10 | 12 | 9 | 10 | 10 |
| Circle 9×9 | 15 | 17 | 17 | 15 | 14 | 15 |
| Circle 10×10 | 17 | 19 | 18 | 17 | 15 | 15 |
| Circle 11×11 | 19 | 23 | 21 | 19 | 19 | 21 |
| Circle 12×12 | 23 | 21 | 22 | 23 | 23 | 22 |
| Circle 13×13 | 25 | 28 | 27 | 25 | 28 | 26 |
| Circle 14×14 | 32 | 32 | 32 | 32 | 30 | 27 |
| Circle 15×15 | 38 | 35 | 39 | 38 | 34 | 34 |
| Circle 16×16 | 42 | 44 | 41 | 42 | 41 | 40 |
| Square 8×8 | 15 | 14 | 13 | 15 | 14 | 16 |
| Square 9×9 | 22 | 18 | 18 | 22 | 18 | 20 |
| Square 10×10 | 23 | 23 | 23 | 23 | 23 | 26 |
| Square 11×11 | 30 | 28 | 27 | 30 | 32 | 26 |
| Square 12×12 | 39 | 34 | 34 | 39 | 34 | 35 |
| Square 13×13 | 40 | 37 | 39 | 40 | 38 | 41 |
| Square 14×14 | 47 | 47 | 46 | 47 | 49 | 54 |
| Square 15×15 | 51 | 59 | 56 | 51 | 58 | 56 |
| Square 16×16 | 62 | 60 | 68 | 62 | 63 | 64 |
| Heart 8×8 | 13 | 13 | 12 | 13 | 10 | 10 |
| Heart 9×9 | 16 | 15 | 16 | 16 | 14 | 15 |
| Heart 10×10 | 21 | 20 | 20 | 21 | 20 | 18 |
| Heart 11×11 | 22 | 24 | 22 | 22 | 22 | 22 |
| Heart 12×12 | 25 | 30 | 26 | 25 | 26 | 26 |
| Heart 13×13 | 31 | 36 | 29 | 31 | 31 | 35 |
| Heart 14×14 | 35 | 36 | 37 | 35 | 35 | 37 |
| Heart 15×15 | 41 | 44 | 42 | 41 | 40 | 42 |
| Heart 16×16 | 49 | 51 | 53 | 49 | 49 | 45 |

### Largest board with median blocked ≤ 5, per b

This is a pointer for W3-12, not a gate.

| b | boards with median blocked ≤ 5 | largest (by median arrows) | arrows | clearable@0 | blocked |
|---|---|---|---|---|---|
| unset | 1/27 | Circle 8×8 | 9 | 63.6% | 1.9 |
| 0.1 | 1/27 | Circle 8×8 | 10 | 37.5% | 3.3 |
| 0.3 | 2/27 | Circle 8×8 | 12 | 50.0% | 4.9 |
| 1 | 1/27 | Circle 8×8 | 9 | 63.6% | 1.9 |
| 3 | 8/27 | Circle 12×12 | 23 | 72.0% | 4.0 |
| 10 | 12/27 | Square 10×10 | 26 | 70.4% | 3.9 |

## Screenshots (brand gate: the owner decides)

**How they were taken.**
- The web dev build (`npx expo start --web`), with `EXPO_PUBLIC_DEV_GEN_VERSION=2`.
- W3-06's level jump, driven through `localStorage` `arrows_current_level`.
- Headless Chrome at 390×844, DPR 2, fit-to-view as mounted.
- **A throwaway, uncommitted two-line patch** made `createLevelSession` pass
  `{ clearableBias: localStorage.w311_dev_bias }` to `generate` for v2. It was reverted after the capture and
  verified with `cmp`.
- The committed code has no in-app way to set the bias: W3-14's curve will do that.
- Every board was cross-checked against node's `generate(i, 2, { clearableBias })`: same shape, size and arrow
  count.
- The files are in `artifacts/W3-11/` (gitignored, like every capture).

The brief asks for b = 0.1, unset and 10. b = 3 was added because it is the only non-identity value inside the
numeric brand gate, and a look problem can pass the bend and length numbers.

| index | b = 0.1 | unset | b = 3 | b = 10 | montage |
|---|---|---|---|---|---|
| 0 (level 1, Ring 26×26, Normal) | 94 arrows, 14.9% clearable at deal | 89 arrows, 34.8% | 83 arrows, 49.4% | 97 arrows, 48.5% | `artifacts/W3-11/v2-index-0-bias-montage.png` |
| 5 (level 6, Circle 29×29, Super Hard) | 141 arrows, 12.8% | 150 arrows, 26.0% | 131 arrows, 33.6% | 133 arrows, 30.1% | `artifacts/W3-11/v2-index-5-bias-montage.png` |

The single screenshots are `artifacts/W3-11/v2-index-{0,5}-bias-{0.1,unset,3,10}.png`. For one board, b = 3 can
beat b = 10 (index 0: 49.4% against 48.5%): a single fill is one stream, and the medians are in the tables above.

**What I see (INFERRED from the images; the owner's eye decides):**
- **b = 10.** On the Ring, the outer rim grows **rows of parallel, outward-pointing heads**:
  - nine Up arrows side by side along the top;
  - a row of Down arrows along the bottom;
  - stacks of Left and Right arrows on the sides.

  That is the "venetian blind" risk the brief names. It follows from the mechanism: only heads whose lane leaves
  the silhouette without crossing it again are boosted, and on a ring those sit on the outer rim.
- **b = 3.** A milder version of the same fringe: stacks of Left arrows on the left rim and Down arrows along the
  bottom, with fewer rows of Up arrows at the top than at b = 10.
- **b = 0.1.** Rim heads mostly point along the ring or inward, and outward rows almost disappear.
- **Index 5 (Circle 29×29, Super Hard).** The effect is much weaker: 26.0% to 30.1% at b = 10, because a large
  board saturates. The three look alike apart from a few more rim stacks at b = 10.

**Owner yes/no needed:**
1. Is b = 10 an acceptable look? The brand gate flags it, so it needs this yes before any curve may use it.
2. Is b = 0.1 an acceptable look? It is also flagged.
3. Is b = 3's rim fringe acceptable? The numbers pass it, but the fringe is visible.

## What this does not show

- **Human difficulty.** It is a uniform-sampling proxy; see W3-17 and W3-23.
- **The look.** Bend rate and mean length are the only numeric brand checks. A "venetian blind" (heads lined up
  along the silhouette edge) closes only on the owner's screenshot yes.
- **Device timing.** Everything here is node.
  - A set bias costs about 1–3% in node generation time.
  - Over v2 levels 0–9999, it moves the heaviest board from 264 to as many as 283 arrows.
  - Both are in `docs/next-level/reports/W3-11.md`; Hermes and iOS are unmeasured.
- **Other shapes.** Set (ii) is Circle/Square/Heart only, as the brief names. W3-12's `--start-sweep` covers every
  shape admissible for a level-1 window.

## Reproduce

```sh
npx tsx scripts/analysis/difficulty-probe.ts --version 2 --levels 1-100 --transfer          # both sets, all b
npx tsx scripts/analysis/difficulty-probe.ts --version 2 --levels 1-100 --transfer --json   # the same, as JSON
npx tsx scripts/analysis/difficulty-probe.ts --size-sweep --rows 6-16                       # red-team reproduction
npx tsx scripts/analysis/difficulty-probe.ts --size-sweep --bias 3                          # set (ii) at one b
npx tsx scripts/analysis/difficulty-probe.ts --version 2 --levels 1-100 --bias 3            # per-level rows at one b
```

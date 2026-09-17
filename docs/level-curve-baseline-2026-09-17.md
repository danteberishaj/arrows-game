# Level-curve baseline (generator v1)

Run at git SHA `14b20e278f271866006ba7c4b0f718ef142f1c4b` (branch `next-level`), with
`scripts/analysis/difficulty-probe.ts` at that commit. Every number below is
EXECUTED output from that script against `src/core`'s shipping
`LevelGenerator`/`BoardLogic` — see W3-01's task brief
(`.superpowers/sdd/TASKS/task-W3-01-brief.md`) for the numbers this was
calibrated against (all reproduced exactly; see "Decisions" below for the
one convention that was not fully pinned down by the brief).

Every command below is the direct `tsx` invocation; the equivalent `npm run
analysis:probe -- <flags>` form works identically (see `package.json`).

> **The probe's own honesty bound** (printed verbatim above every run):
> "Search-cost proxy for a uniform-sampling player. Not a measurement of
> human difficulty; never correlated with real mistakes (see W3-23)."
> Nothing below is a measurement of human difficulty.

## Landmark levels

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Level rows for displayed levels 1-1 (index 0-0)

| level | index | tier | shape | rows×cols | mask cells | arrows | targetCells | clearable@0 | clearable% | scanTaps | blockedTaps | minClearable | worst n/k | bend% | meanLen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | Normal | Circle | 20×20 | 264 | 60 | 266 | 19 | 31.7% | 142 | 82 | 1 | 39/10 | 66.7% | 4.40 |
```

Matches W1.md's independently-executed header exactly: 60 arrows, 19
clearable at deal, 31.7%.

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 12-12`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Level rows for displayed levels 12-12 (index 11-11)

| level | index | tier | shape | rows×cols | mask cells | arrows | targetCells | clearable@0 | clearable% | scanTaps | blockedTaps | minClearable | worst n/k | bend% | meanLen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 11 | Super Hard | Bolt | 46×37 | 202 | 54 | 560 | 30 | 55.6% | 79 | 25 | 1 | 53/29 | 53.7% | 3.74 |
```

Matches the brief's Context exactly: Super Hard/Bolt, 46×37, 54 arrows,
55.6%, scan 79, blocked 25.

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 168-168`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Level rows for displayed levels 168-168 (index 167-167)

| level | index | tier | shape | rows×cols | mask cells | arrows | targetCells | clearable@0 | clearable% | scanTaps | blockedTaps | minClearable | worst n/k | bend% | meanLen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 168 | 167 | Super Hard | Cat | 37×37 | 574 | 202 | 586 | 39 | 19.3% | 779 | 577 | 1 | 154/25 | 29.2% | 2.84 |
```

Matches the brief's Context exactly: Super Hard/Cat, 37×37, 202 arrows,
19.3%, scan 779, blocked 577.

### `npx tsx scripts/analysis/difficulty-probe.ts --version 2 --levels 1-1`

```
generator v2 not implemented
exit=1
```

## Arrow counts, levels 1-1000 (`--per-tier`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1000 --per-tier`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Per-tier stats over displayed levels 1-1000

| Tier | n | arrows min | p50 | max | median scan | median blocked |
|---|---|---|---|---|---|---|
| Normal | 667 | 53 | 83 | 132 | 157 | 74 |
| Hard | 167 | 95 | 126 | 197 | 257 | 136 |
| Super Hard | 166 | 47 | 149 | 249 | 306 | 155 |
```

Arrow columns match the brief's Context exactly: Normal n=667 min 53 p50 83
max 132; Hard n=167 min 95 p50 126 max 197; Super Hard n=166 min 47 p50 149
max 249 (the max is level index 917, displayed level 918, per the brief).
The `median scan`/`median blocked` columns are this range's own (1-1000)
numbers; the brief's specific scan/blocked targets are for the 1-240 range,
checked next.

## Median scan, levels 1-240 (`--per-tier` and `--bands`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-240 --per-tier`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Per-tier stats over displayed levels 1-240

| Tier | n | arrows min | p50 | max | median scan | median blocked |
|---|---|---|---|---|---|---|
| Normal | 160 | 57 | 83 | 116 | 153 | 71 |
| Hard | 40 | 102 | 126 | 197 | 262 | 138 |
| Super Hard | 40 | 54 | 150 | 224 | 306 | 153 |
```

`median scan` matches the brief's Context exactly: Normal 153, Hard 262,
Super Hard 306.

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-240 --bands`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Bands over displayed levels 1-240 (fixed cumulative fractions 0.125, 0.250, 0.500, 0.750, 1.000)

| band | n | median scan | median blocked | arrows p50 |
|---|---|---|---|---|
| 1-30 | 30 | 162 | 82 | 90 |
| 31-60 | 30 | 182 | 90 | 89 |
| 61-120 | 60 | 176 | 90 | 90 |
| 121-180 | 60 | 184 | 92 | 94 |
| 181-240 | 60 | 184 | 83 | 92 |
```

`median scan` matches the brief's Context exactly: 1–30 162, 31–60 182,
61–120 176, 121–180 184, 181–240 184. The curve is flat, as the brief says.

## Shape census, levels 1-200 (`--shape-report`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-200 --shape-report`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Shape census over displayed levels 1-200

| shape | count | share | first appearance | clamp hits (rows or cols = 46) |
|---|---|---|---|---|
| Circle | 38 | 19.0% | 1 | 0/38 |
| Diamond | 37 | 18.5% | 5 | 0/37 |
| Square | 35 | 17.5% | 13 | 0/35 |
| Rectangle | 31 | 15.5% | 4 | 0/31 |
| Ring | 5 | 2.5% | 39 | 0/5 |
| Triangle | 4 | 2.0% | 3 | 0/4 |
| Mushroom | 4 | 2.0% | 24 | 0/4 |
| Pentagon | 4 | 2.0% | 57 | 0/4 |
| Star | 3 | 1.5% | 6 | 0/3 |
| Hourglass | 3 | 1.5% | 9 | 0/3 |
| Bolt | 3 | 1.5% | 12 | 3/3 |
| Octagon | 3 | 1.5% | 15 | 0/3 |
| Rocket | 3 | 1.5% | 18 | 3/3 |
| Plus | 3 | 1.5% | 27 | 0/3 |
| Pine | 3 | 1.5% | 42 | 3/3 |
| Fish | 3 | 1.5% | 48 | 0/3 |
| Hexagon | 3 | 1.5% | 117 | 0/3 |
| Trophy | 2 | 1.0% | 30 | 2/2 |
| Arrow | 2 | 1.0% | 36 | 2/2 |
| Crescent | 2 | 1.0% | 54 | 0/2 |
| Crown | 2 | 1.0% | 60 | 0/2 |
| Butterfly | 2 | 1.0% | 120 | 0/2 |
| Flower | 2 | 1.0% | 126 | 0/2 |
| X | 1 | 0.5% | 159 | 0/1 |
| Heart | 1 | 0.5% | 162 | 0/1 |
| Cat | 1 | 0.5% | 168 | 0/1 |

Back-to-back repeats: 29
Rows or cols hit 46 on 13 levels
```

Matches the brief's Context exactly: Circle 38, Diamond 37, Square 35,
Rectangle 31 (sum 141 = 70.5% of 200; Square+Rectangle alone 66 = 33.0%);
29 back-to-back repeats; first appearances Crown@60, Hexagon@117,
Butterfly@120, Flower@126, X@159, Heart@162, Cat@168.

## Grid clamp, levels 1-1000 (`--shape-report`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1000 --shape-report`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Shape census over displayed levels 1-1000

| shape | count | share | first appearance | clamp hits (rows or cols = 46) |
|---|---|---|---|---|
| Circle | 191 | 19.1% | 1 | 0/191 |
| Diamond | 184 | 18.4% | 5 | 0/184 |
| Square | 164 | 16.4% | 13 | 0/164 |
| Rectangle | 163 | 16.3% | 4 | 0/163 |
| Pentagon | 21 | 2.1% | 57 | 0/21 |
| Hexagon | 21 | 2.1% | 117 | 0/21 |
| Ring | 19 | 1.9% | 39 | 0/19 |
| Triangle | 18 | 1.8% | 3 | 0/18 |
| Hourglass | 14 | 1.4% | 9 | 0/14 |
| Fish | 14 | 1.4% | 48 | 0/14 |
| Bolt | 13 | 1.3% | 12 | 13/13 |
| Octagon | 13 | 1.3% | 15 | 0/13 |
| Mushroom | 13 | 1.3% | 24 | 0/13 |
| Plus | 13 | 1.3% | 27 | 0/13 |
| Flower | 13 | 1.3% | 126 | 0/13 |
| X | 13 | 1.3% | 159 | 0/13 |
| Rocket | 12 | 1.2% | 18 | 12/12 |
| Trophy | 12 | 1.2% | 30 | 12/12 |
| Arrow | 12 | 1.2% | 36 | 12/12 |
| Pine | 12 | 1.2% | 42 | 11/12 |
| Crescent | 12 | 1.2% | 54 | 2/12 |
| Star | 11 | 1.1% | 6 | 3/11 |
| Crown | 11 | 1.1% | 60 | 0/11 |
| Cat | 11 | 1.1% | 168 | 0/11 |
| Butterfly | 10 | 1.0% | 120 | 0/10 |
| Heart | 10 | 1.0% | 162 | 0/10 |

Back-to-back repeats: 107
Rows or cols hit 46 on 65 levels
```

The clamp-hit column matches the brief's Context exactly: Bolt 13/13,
Rocket 12/12, Trophy 12/12, Arrow 12/12, Pine 11/12, Star 3/11, Crescent
2/12, no other shape hits the clamp, 65 levels total.

## Capacity at the clamp, all 26 shapes (`--capacity`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --capacity`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Per-shape capacity at the grid clamp (rows=46, cols=clamp(roundHalfToEven(46·aspect),4,46))
Arrows use the Normal config, median over DotNetRandom(1..5).

| shape | cols | cells | median arrows (Normal, seeds 1-5) |
|---|---|---|---|
| Square | 46 | 2116 | 548 |
| Rectangle | 46 | 2116 | 548 |
| Heart | 46 | 1606 | 399 |
| Circle | 46 | 1396 | 347 |
| Octagon | 46 | 1336 | 345 |
| Hexagon | 46 | 1244 | 307 |
| Pentagon | 46 | 1140 | 286 |
| Butterfly | 46 | 1126 | 287 |
| Ring | 46 | 1100 | 272 |
| Plus | 46 | 1088 | 282 |
| Flower | 46 | 980 | 234 |
| Fish | 46 | 942 | 229 |
| Diamond | 46 | 924 | 233 |
| X | 46 | 924 | 225 |
| Crown | 46 | 904 | 228 |
| Cat | 46 | 896 | 221 |
| Mushroom | 44 | 880 | 226 |
| Triangle | 46 | 800 | 199 |
| Crescent | 46 | 700 | 168 |
| Hourglass | 37 | 688 | 164 |
| Star | 46 | 640 | 157 |
| Pine | 41 | 566 | 143 |
| Rocket | 34 | 544 | 138 |
| Trophy | 39 | 523 | 131 |
| Arrow | 41 | 503 | 129 |
| Bolt | 37 | 202 | 53 |
```

Every `cells` value matches the brief's Context table exactly (all 26
shapes, cross-checked cell-for-cell). Per the brief's acceptance criteria,
the `median arrows` column is expected to differ from the single-seed
`DotNetRandom(1234)` figures quoted in the brief's Context (Bolt 49, Circle
354, Square 589), because this column is a median over 5 seeds, not one
seed — and it does (Bolt 53, Circle 347, Square 548), as expected.

## Clamp shortfall, levels 1-1000 (`--clamp-shortfall`)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1000 --clamp-shortfall`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Clamp shortfalls over displayed levels 1-1000
(rows or cols hit the 46 clamp AND the mask fell short of the drawn cell target)

| level | shape | tier | rows×cols | mask cells | drawn target | tier range |
|---|---|---|---|---|---|---|
| 12 | Bolt | Super Hard | 46×37 | 202 | 560 | 560-720 |
| 18 | Rocket | Super Hard | 46×34 | 544 | 663 | 560-720 |
| 30 | Trophy | Super Hard | 46×39 | 523 | 678 | 560-720 |
| 36 | Arrow | Super Hard | 46×41 | 503 | 651 | 560-720 |
| 42 | Pine | Super Hard | 46×41 | 566 | 593 | 560-720 |
| 72 | Pine | Super Hard | 46×41 | 566 | 626 | 560-720 |
| 78 | Arrow | Super Hard | 46×41 | 503 | 684 | 560-720 |
| 84 | Trophy | Super Hard | 46×39 | 523 | 711 | 560-720 |
| 96 | Rocket | Super Hard | 46×34 | 544 | 696 | 560-720 |
| 102 | Bolt | Super Hard | 46×37 | 202 | 593 | 560-720 |
| 132 | Bolt | Super Hard | 46×37 | 202 | 691 | 560-720 |
| 192 | Pine | Super Hard | 46×41 | 566 | 656 | 560-720 |
| 198 | Rocket | Super Hard | 46×34 | 544 | 602 | 560-720 |
| 216 | Arrow | Super Hard | 46×41 | 503 | 589 | 560-720 |
| 222 | Pine | Super Hard | 46×41 | 566 | 692 | 560-720 |
| 288 | Bolt | Super Hard | 46×37 | 202 | 700 | 560-720 |
| 306 | Trophy | Super Hard | 46×39 | 523 | 718 | 560-720 |
| 312 | Bolt | Super Hard | 46×37 | 202 | 630 | 560-720 |
| 318 | Rocket | Super Hard | 46×34 | 544 | 572 | 560-720 |
| 348 | Pine | Super Hard | 46×41 | 566 | 587 | 560-720 |
| 354 | Arrow | Super Hard | 46×41 | 503 | 644 | 560-720 |
| 372 | Rocket | Super Hard | 46×34 | 544 | 657 | 560-720 |
| 378 | Bolt | Super Hard | 46×37 | 202 | 715 | 560-720 |
| 384 | Trophy | Super Hard | 46×39 | 523 | 642 | 560-720 |
| 402 | Rocket | Super Hard | 46×34 | 544 | 624 | 560-720 |
| 408 | Bolt | Super Hard | 46×37 | 202 | 712 | 560-720 |
| 414 | Trophy | Super Hard | 46×39 | 523 | 609 | 560-720 |
| 432 | Bolt | Super Hard | 46×37 | 202 | 622 | 560-720 |
| 438 | Star | Super Hard | 46×46 | 640 | 680 | 560-720 |
| 462 | Trophy | Super Hard | 46×39 | 523 | 566 | 560-720 |
| 468 | Arrow | Super Hard | 46×41 | 503 | 699 | 560-720 |
| 474 | Rocket | Super Hard | 46×34 | 544 | 641 | 560-720 |
| 486 | Trophy | Super Hard | 46×39 | 523 | 656 | 560-720 |
| 492 | Arrow | Super Hard | 46×41 | 503 | 629 | 560-720 |
| 558 | Bolt | Super Hard | 46×37 | 202 | 710 | 560-720 |
| 564 | Rocket | Super Hard | 46×34 | 544 | 683 | 560-720 |
| 576 | Trophy | Super Hard | 46×39 | 523 | 698 | 560-720 |
| 618 | Pine | Super Hard | 46×41 | 566 | 576 | 560-720 |
| 624 | Arrow | Super Hard | 46×41 | 503 | 664 | 560-720 |
| 648 | Pine | Super Hard | 46×41 | 566 | 574 | 560-720 |
| 654 | Arrow | Super Hard | 46×41 | 503 | 631 | 560-720 |
| 660 | Trophy | Super Hard | 46×39 | 523 | 659 | 560-720 |
| 672 | Rocket | Super Hard | 46×34 | 544 | 644 | 560-720 |
| 678 | Bolt | Super Hard | 46×37 | 202 | 702 | 560-720 |
| 708 | Star | Super Hard | 46×46 | 640 | 677 | 560-720 |
| 714 | Bolt | Super Hard | 46×37 | 202 | 619 | 560-720 |
| 732 | Trophy | Super Hard | 46×39 | 523 | 606 | 560-720 |
| 738 | Arrow | Super Hard | 46×41 | 503 | 709 | 560-720 |
| 744 | Rocket | Super Hard | 46×34 | 544 | 621 | 560-720 |
| 762 | Arrow | Super Hard | 46×41 | 503 | 639 | 560-720 |
| 768 | Pine | Super Hard | 46×41 | 566 | 712 | 560-720 |
| 774 | Rocket | Super Hard | 46×34 | 544 | 654 | 560-720 |
| 792 | Arrow | Super Hard | 46×41 | 503 | 641 | 560-720 |
| 798 | Pine | Super Hard | 46×41 | 566 | 584 | 560-720 |
| 828 | Star | Super Hard | 46×46 | 640 | 646 | 560-720 |
| 834 | Bolt | Super Hard | 46×37 | 202 | 632 | 560-720 |
| 840 | Trophy | Super Hard | 46×39 | 523 | 560 | 560-720 |
| 894 | Pine | Super Hard | 46×41 | 566 | 597 | 560-720 |
| 924 | Pine | Super Hard | 46×41 | 566 | 695 | 560-720 |
| 930 | Arrow | Super Hard | 46×41 | 503 | 592 | 560-720 |
| 948 | Rocket | Super Hard | 46×34 | 544 | 605 | 560-720 |
| 954 | Bolt | Super Hard | 46×37 | 202 | 663 | 560-720 |
| 960 | Trophy | Super Hard | 46×39 | 523 | 590 | 560-720 |
```

Includes level 12 (Bolt, 202 cells, drawn target 560), which is the exact
case the brief's acceptance criteria names. All 63 shortfalls are drawn
from the seven clamp-prone SuperHard shapes (Bolt, Rocket, Trophy, Arrow,
Pine, Star, Crescent); Crescent's 2 occurrences did not fall short this
range (not listed), meaning Crescent's mask cell count exceeded its drawn
target both times it hit the clamp.

## Tier arrow-count overlap, levels 1-1000 (`--tier-report`, not brief-verified)

### `npx tsx scripts/analysis/difficulty-probe.ts --version 1 --levels 1-1000 --tier-report`

```
Search-cost proxy for a uniform-sampling player. Not a measurement of human difficulty; never correlated with real mistakes (see W3-23).

Tier arrow-count ranges over displayed levels 1-1000

| tier | min | max |
|---|---|---|
| Normal | 53 | 132 |
| Hard | 95 | 197 |
| Super Hard | 47 | 249 |

Pairwise overlap:
  Normal ∩ Hard: 95-132 (38 arrow counts)
  Normal ∩ Super Hard: 53-132 (80 arrow counts)
  Hard ∩ Super Hard: 95-197 (103 arrow counts)
```

The brief's Context and acceptance criteria do not name specific
`--tier-report` numbers to reproduce; this run is included for completeness
since the mode exists and is exercised here for the first time.

## Decisions

- **Median convention.** The brief does not specify how "median scan" /
  "median blocked" / arrow-count `p50` are computed when the sample count is
  even (every tier and band sample here is even: 667/167/166 arrows samples
  and 160/40/40 and 30/30/60/60/60 scan samples). I tried the nearest-rank
  method already used by `scripts/analysis/tier-bands.ts`
  (`rank = ceil(0.5n)`, i.e. the LOWER of the two middle values for even n)
  and the standard two-point average; neither reproduced the brief's
  Context numbers for the Hard tier (off by 5-11). The "higher median"
  (`sorted[floor(n/2)]`, 0-based — the UPPER of the two middle values for
  even n, the exact middle for odd n) reproduces every tier/band number in
  the brief exactly (verified above) and is what `median()` in the probe
  implements. Recorded here because it is a real behavioral choice a future
  reader could reasonably make differently; it is calibrated by exact
  reproduction against the brief's Context, per the brief's own
  Verification section 3.
- **`--bands` boundaries for a range other than 1-240.** The brief only
  names fixed boundaries (1-30/31-60/61-120/121-180/181-240) for the
  specific 1-240 case. I implemented `--bands` as five bands at fixed
  cumulative fractions of whatever `--levels` range is given
  (1/8, 1/4, 1/2, 3/4, 1 — chosen because 30/60/120/180/240 are exactly
  those fractions of 240), so the mode generalizes to other ranges instead
  of only accepting 1-240. This reproduces the brief's named boundaries and
  numbers exactly for 1-240 (verified above).
- **`--version` default.** The brief does not say what happens if
  `--version` is omitted. The probe defaults to `1` (every acceptance
  command in the brief passes `--version 1` explicitly, so this default is
  never exercised by a required check); omitting `--version` was not made
  an error, to keep ad-hoc single-level lookups short.
- **`worst n/k` and `minClearable` definitions.** Not given explicit target
  values in the brief's Context, so these are defined here rather than
  reverse-engineered: `worst n/k` is the (n, k) pair with the largest
  n/k ratio seen during the walk (the single worst-case look-count state);
  `minClearable` is the smallest number of simultaneously clearable arrows
  seen at any state. Both are informational columns, not load-bearing for
  any later task's acceptance criteria as of this writing.
- **`--tier-report`'s pairwise overlap.** Not given explicit target values
  either; implemented as the overlapping arrow-count integer range between
  each pair of tiers (see above), which is enough to answer the tier
  label's core risk (do two tiers' arrow counts overlap enough that the
  displayed tier name could mislead a player — this is W3-20's concern,
  not W3-01's).

## Gates

- `npx jest src/core`: 4 suites / 90 tests pass, including the 5 golden
  checksums in `levelGenerator.test.ts` (`level %i preserves its full
  serialized board checksum`) — confirms the `targetCells` field added to
  `GeneratedLevel` did not change v1 output.
- `npx jest` (full suite): 23 suites / 501 tests pass. Unchanged from base
  commit `6a38d4f` (this task touched no test files).
- `npx tsc --noEmit`: clean.
- `git status --porcelain`: clean apart from this doc itself at the time of
  the code commit.

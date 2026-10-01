# Skin performance evidence and reusable recipes

Read this with [the skin contract](README.md), [engineering lessons](../engineering-lessons.md), and
[ART-SKINS-07](../next-level/reports/ART-SKINS-07.md). Use [the generation prompt](GENERATION-PROMPT.md)
for the next art task. This record distinguishes proven output-preserving work removal, measured costs,
and questions that still need an experiment.

## What is established

All 17 procedural styles have raw opening data: **12 ON / 12 Classic OFF opens each**, shuffled in pairs,
at **29.387754 dp**, dense level index 3827, all 17 original META flags plus the picker, one final test-ads
PERF APK. There are 408 opens / 204 pairs. Classic remains the original renderer; it is not a procedural
approximation. Source hashes, features, costs and work counts are joined in
[style-evidence.json](../../artifacts/ART-SKINS-07/perf/style-evidence.json), with
[CSV](../../artifacts/ART-SKINS-07/perf/style-evidence.csv) and
[readable per-style tables](../../artifacts/ART-SKINS-07/perf/style-evidence.md).
Regenerate them with `python3 scripts/art/summarize-skin-performance.py` after the raw analyser.

The historical opening budget is **ON median AND maximum ≤ the same batch's OFF median AND maximum +16 ms**.
Ink Pro, Pixel and Rainbow Ribbon met that aggregate budget in this run; the other 14 did not. Pixel and
Rainbow still had individual paired overheads above 16 ms. Only Ink Pro stayed within 16 ms in every pair.
This stricter observation is reported separately, not silently substituted for the historical rule.

**No style has verified performance neutrality.** Host load was 5.73–27.63 and another emulator was running.
There are zero accepted exit frames and no exit percentiles. These are elapsed native opening costs on a
contended emulator, not smoothness measurements or phone performance. Large accepted Lava/Strawberry
outliers remain in the data. Failed/incomplete service attempts remain separately labelled. There is no
evidence that any style is inherently impossible to optimize.

## Work removed without changing the art

| Mechanism | Verified benefit | Invariant / limit |
| --- | --- | --- |
| Shared relative templates, lazy strip decoration | 250 dense arrows use 57 shape/length templates; decorations are built when a strip first draws. | Translation must preserve every filled layer, join and accent. Lazy work still belongs to the first-draw cost. |
| Lazy diagnostic metadata | 285–513 unused audit paths avoided per spec; 6,726 across the 17 dense fixtures. | Production output equals audited output; keep the independent fit oracle. Counts exclude additional strip/interaction buffers. |
| Relative tail face + spiral reuse | Cinnamon and Strawberry: 53→1 face builds and 53→1 spiral builds each. | Only static tail-anchored templates share this geometry. Moving exits keep their original construction. |
| Directional nested head reuse | Rainbow: 285→20; Campfire: 228→16 cap builds. | Scale the same positively wound cap to each band's width; every band still reaches the head. |
| One rounded centreline per compatible template | Cinnamon 114→57; Jelly 110→57; Lava 106→57; Strawberry 167→57. | Gloss remains centred, continuous and inset at bends. Yarn has four extra move-only preparations (53→57); record that cost too. |

These changes passed 220,278 native path-array sample comparisons and 4,284 exact software-pixel
comparisons against frozen/current/audited output on 21 levels, both actual themes, 29.387754/38/5 dp,
open and blocked eyes. Every pixel case must draw non-background pixels; 357 displaced-path controls fail.
The separate Region matrix checks fit and feature behavior. This proves preserved output and reduced
construction counts. A speed percentage is **not established**: earlier candidate timing used different
host/recovery conditions.

## Where the remaining time goes

The joined tables retain **setup**, **strip recording**, **lazy geometry/template merging inside first
draw**, and **first-draw remainder** per style. Remainder is calculated for each run as full first draw
minus its nested lazy timers. It includes native Canvas/grid submission and surrounding work; it is
**not GPU completion**. Across these runs, median lazy geometry/merge costs are 5.058–16.484 ms; median
draw remainders are 0.612–0.871 ms. Geometry/merge is the larger measured first-draw phase. Setup also
matters and is included in the headline sum. Do not add phase medians or maxima to invent a total.

Feature comparisons are observational: each style also changes palette, widths, tails, path complexity
and host scheduling. The data does not isolate a feature's marginal cost. The JSON names a next
experiment for every style and explicitly labels each as unverified.

| Family / examples | What can be reused now | Remaining question |
| --- | --- | --- |
| Simple tube/cap — Ink Pro, Sherbet, Candy Gloss | Existing tube, head and optional tail templates; no new renderer branch. Ink Pro has the strongest opening evidence here. | Measure translated strip merging versus base/prop setup under quiet conditions. Sherbet's five draws do not guarantee its budget. |
| Straight stitched/accented — Yarn, Jelly, Strawberry | One centreline, clipped periodic decoration; Cinnamon/Strawberry static roll caches. | Isolate stitches/spots/ribbon construction before assigning a cost to those features. Yarn's median is cheap, but its maximum missed the aggregate budget. |
| Nested colours — Rainbow, Campfire | Cached directional nested heads, body used as outer band colour. Rainbow has eight draws and met the aggregate budget. | Separate remaining band merging/submission; Campfire also has head faces, so its extra cost cannot be assigned to bands alone. |
| Head faces / beads — Critter, Campfire | Body templates, existing bounded face and clipping rules. | Head faces still build 53 times in the dense fixture: test directional reuse including clipped eyes/blush/blocked state. This is a candidate, not a verified optimization. |
| Folds / hard shapes — Paper Craft, Stained Glass, Pixel, Archery | Shared filled caps and bounded crease/fletching vocabulary. | Separate direction-only fold caps from path-specific bends. Pixel's aggregate PASS includes a high Classic maximum; paired overhead exposes that limitation. |
| Glow / translucent glass — Neon, Lava, Clear Glass | Filled translucent under-stroke, contained marble/shine, no blur filter. | Quiet-device GPU overdraw is unmeasured. Keep honest preferred-dark contrast exceptions for Neon/Lava. |

## Approaches that did not meet the requirement

| Approach | Evidence / cause | Decision |
| --- | --- | --- |
| Generated tile textures treated as exact connectors | ART01 measured displaced/unequal connectors and stray alpha; its corrected pilot still added recording cost. | Keep that asset method out of the current spec renderer. Attractive source art is not a valid atlas. |
| Decorate all arrows before real screen size is known | ART02 dense preflight took 387.4375 ms and risked preparing the wrong tier. | Prepare the real opening tier, lazily; no temporary flat flash. |
| Partial-strip culling from the native child's clip | ART07 child clip remained board-sized; camera transforms belong to its parent and can move without child redraw. | Rejected before integration. A different camera/invalidation design needs its own pan and lifecycle experiment. |
| Report preparation alone | ART05 initially omitted owned work and then field/config setup. | Superseded timer boundary. Report complete construction + setup + recording + first draw once. |
| Conclude all eight-draw styles are fast | ART07 eight-draw Rainbow met aggregate opening; several lower-draw styles did not. | Draw bound is a contract, not a speed predictor. Preserve per-style phase data. |
| Pixel equality on a blank LOD fixture | ART07 supplemental harness merged full-tier layers before requesting flat, leaving simple paths empty. | Earlier flat equivalence claim discarded. Build the actual tier and assert nonempty output in every case. |
| Ignore small OFF pixel differences | Final ART07 stable OFF/base captures differ at 316 antialiased pixels, max channel delta 5, at 29.387754 dp. Cause remains unproven. | Exact P4 gate FAIL, even with identical 15 assets/no picker. Preserve the raw result; no tolerance waiver. |

## How to decide the next experiment

Start from the desired look and a known spec, then state one measurable mechanism and an invariant.
For example: “cache head faces per direction; reduce dense face construction from 53 to at most four;
preserve clipped open/closed-eye output exactly.” Run the negative control, fit/joins/one-cell/alignment
matrix, nonempty LOD equivalence and reduced-motion checks before timing. Compare old/new mechanisms
under the same quiet conditions, and Classic/skin under the same APK with shuffled pairs. Preserve
outliers, source/APK hashes, full timer boundaries, actual cells and host/device state.

A failed timing result means **not cleared in this experiment**. Calling a style intrinsically too
expensive requires evidence that isolates irreducible work after applicable reuse, on the target device.
Do not get a pass by deleting its defining layers, dropping input, forcing a lower tier at 29.39 dp,
or weakening a test. Keep it default OFF until the relevant performance and owner gates are satisfied.

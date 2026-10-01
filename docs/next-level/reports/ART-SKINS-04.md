# ART-SKINS-04 — general skin renderer, cell ownership and opening cost

2026-10-01. Experimental, **default OFF**. No commits, push or EAS. Started by applying
`artifacts/ART-SKINS-03/patches/skin-code-removed-from-tree.patch`; the final patch series includes the
required restored behavior and the general renderer. Apply the series to base
`f23c76be88503524fb355e1702e2f92fbbfd214b`, rather than applying the ART03 patch a second time.

Cinnamon and Sherbet share one native renderer and one TypeScript spec registry. Cell-fit and static draw
checks pass. **This is not an all-green acceptance:** preparation still exceeds 16 ms, owner look review is
pending, the broad K3 area interpretation is unresolved, and exit frames are UNVERIFIED.

## Acceptance ledger

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| K1 | PASS, red → green | Frozen ART03: 17,191 / 23,298 layer paths fail; new specs: 0 / 36,006 fail. 2,118 actual core arrows per spec, v1 indices 0–19 and 3827. Dense old case alone: 2,070 / 2,750 fail; new dense case: 0 / 4,250. |
| K2 | PASS | At 10/100/250 arrows: Cinnamon 8, Sherbet 5 static draws including one missed mark. Interaction overlays and moving arrows are separate draws. |
| K3 | PARTIAL | Head cap area exceeds tail/rim cap area for every full-detail arrow. The test does not establish that a head exceeds the entire area of a continuous long icing/shine line; owner clarification requested. Do not label that broader interpretation green. |
| K4 | PASS | Every body colour ≥3:1 against both shared backgrounds; blocked overlays use active shared `heart`. Per-spec rows in `checks/contrast.json`. |
| K5 | PASS | Native spec selects flat below flatMinDp and draws two simple filled layers. Opening at 29.387754 dp selects full detail immediately; no flat-first rebuild. |
| K6 | PASS within test scope | Native reduced press=1, emit=0 particles, hint pixels identical at 300/900 ms and non-empty. Exit particle/anticipation guards use the event's reduced-motion flag. Real gesture timing remains unmeasured. |
| K7 | FAIL | Final ≥12 ON process opens per spec at 29.387754 dp; complete cold preparation and deferred drawing costs below. |
| C1 | NOT ALL GREEN | K1 red→green and K2/K4/K5/K6 pass; K3 scope and K7 remain open. |
| C2 | OWNER REVIEW PENDING | Real-config display-level 3828 viewports, native whole boards, all three 2× crop comparisons, before/after Cinnamon. |
| C3 | PASS | Jest 115 suites / 1,927 tests / 12 snapshots; TypeScript exit 0; native local builds pass. Unset APK and asset evidence below. |
| C4 | UNVERIFIED | Quiet-host exit prerequisite fails. Frame count **0 per spec**, no percentile values claimed. Raw host records retained for all OFF/ON pairs. |

## Data and rendering decisions

Design reference: the read-only Claude Design canvas
[Arrows — arrow skins](https://claude.ai/artifact/BLpq6sX8RZ4GfknZk22xQP), including its SkinBoard settings
table. That data-oriented model informs the spec registry; no external canvas edits were made.

`src/ui/skinSpecs.ts` defines the schema, both specs, the registry and stable selection JSON. The flag is
`EXPO_PUBLIC_ART_SKIN=cinnamon|sherbet`; unknown/unset selects today's app. Only Android selected builds send
`artSkin`, as one JSON selection prop. Native caches the last immutable parsed selection across view remounts;
feedback, camera tier and theme changes do not reparse it. Exact owned cells, runtime configuration and feedback
remain separate props. There are no native branches on a spec id.

The generic renderer supports palette rules one/length/direction/cycle; ordered shadow/rim/body/stripe/ribbon/
bands/seam/shine; tri/rounded/swept heads; none/dot/roll+face/fletch/marble tails; rounded/crease bends; faces,
LOD and motion data. Only the two delivered specs are contract-tested. Supporting a schema variant does not
certify arbitrary combinations. Bands reserve one draw per colour. A seven-layer limit leaves one static draw
for a mark. Per-arrow colours use a generated 39×39 cell-colour lookup (6,084 bytes on this dense board), with
nearest sampling so colours do not blend into neighbours. This is runtime data, not a packaged skin asset.

Cinnamon: centre-anchored roll radius .265 + rim .025; head half-width .36, tip .43, back .42; body width .33;
icing width .075, amplitude .03, offset zero, fadeCells 1. Sherbet: pastel cycle, dark rim, top shine, softened
rounded head, no face, dot tail radius .13 + rim .025. Pastels/dough are darker than the design reference to
meet contrast. The owner judges the look.

| Before | After | Why |
| --- | --- | --- |
| Flat path extension used as a tail anchor | Tail cell centre and shaft start coincide | Decorations belong to the arrow's cells. |
| Tail roll larger than the head | Head cap exceeds the tail cap | Directional hierarchy, with cell fit retained. |
| Icing can touch a bend's rim | Zero offset, bounded amplitude/width, intersected with inset body contour | A width bound on straight runs alone is insufficient at turns. |
| Every arrow decorates during preparation | Zero decoration at preparation; shared templates built on first strip draw | Reuse the 57 unique shape/direction/detail templates, then translate paths for 250 arrows. |
| Single-cell move-only contour gets stroked | No shaft stroke when length=0 | Reject a detached fragment even if it stays inside the cell. |

Ownership is the cell union first, with its exterior inset .04 cell using L-infinity distance. Adjacent cells
owned by the same arrow keep continuous internal joins. Every static filled path, including shadow offset,
face/closed eyes and simple silhouettes, is intersected with ownership. Icing is additionally intersected with
the body contour inset by .03 cell. Head shine is an interior oval. Dynamic slither/press transforms are outside
the static-pose fit contract. The existing opening-tier and interaction-only dirty fixes are preserved.

Templates and per-arrow paths are bounded to a board/tier, invalidated on geometry/tier/selection replacement,
and released with the selection. This choice avoids rebuilding decoration for repeated lengths/shapes while
keeping later membership changes cheap. A lazy-strip-only pilot still built all 250 decorations on first draw:
the native child's retained display list records the whole board despite its parent's camera transform.
The final first draw still copies/merges all 250 paths across six strips; it is not zero-cost or viewport-only.

## Native contract and negative controls

`skin-contract-data.cjs` generates fixtures from the real v1 core, not handwritten arrows or copied specs.
The Android instrumentation uses production paths, then independently computes a grid union and its exterior
erosion at 400 samples/cell. Each arrow is normalised locally; an extent guard and non-empty-source/non-empty-
Region assertion prevent silent raster losses. DIFFERENCE must be empty for every layer. This is an Android
filled-path Region check, not a mathematical proof of antialias pixels. The frozen ART03 renderer matches the
restore patch after its class name alone was changed (`checks/legacy-source.json`).

Earlier global-coordinate oracle attempts silently lost layers beyond Android Region's scan range. Their
failed results remain in `checks/failed-region-oracle/` and `checks/failed-global-region-oracle/`; they are not
accepted evidence. Final `native-before*.txt/json` and `native-after*.txt/json` use the corrected local oracle.
The old code fails on every tested level and both new specs pass.

The first template captures revealed a small detached fragment on one-cell arrows. Native
`Paint.getFillPath` with a move-only contour and the corner effect generates a cap at the template origin,
not at the move point (`checks/move-only-stroke-diagnostic.txt`). Skip shaft stroke generation when length=0.
The final contract checks that each single-cell rim has one connected component. Its independent negative
fixture unions the old move-only stroke back into an upward head/tail: two components reproduce the defect.
There are 449 single-cell arrows per spec in these fixtures. Fit alone was insufficient: that corner fragment
could remain inside the owned cell.

Rejected attempts at the additional orphan oracle are retained as `checks/rejected-union-oracle-*` and
`checks/rejected-rounded-outline-oracle.txt`. Concatenating opposite-winding expected contours cancelled
some head/tail overlap; after replacing that with union, reconstructing a rounded outline differed by one
raster pixel. Neither result is accepted. The final connectivity check uses actual production filled Regions
and a reproducible negative control, without reconstructed-outline tolerances. K1 still requires empty
DIFFERENCE against the independent ownership union, with no added tolerance.

## Measured real configuration

All values below use **29.387754 dp per displayed cell**, 1440×3120 pixels / density 560 (3.5 px/dp), logical
cell=40 dp, initial scale=.734693854. Core index 3827 is labelled **LEVEL 3828** in the game. All 17 available
META_* flags are 1, including META_ZOOMED_CAMERA. Test ads, FTUE/assist, win silhouette, PERF_LEVEL=3827,
PERF_EXIT_DURATION_MS=1000 and camera logs are enabled. Saved exact environments are in
`checks/build-env-{cinnamon,sherbet,unset}.json`. Node v20.19.4, only emulator-5556 / fleet_floor_api31; arm64
local release builds. Another emulator was observed read-only and never operated.

| Metric at **29.387754 dp** | Cinnamon median / max ms (n=12) | Sherbet median / max ms (n=12) |
| --- | ---: | ---: |
| Complete cold preparation | 12.280 / 76.254 | 18.120 / 41.242 |
| Selection parse/setup | 0.763 / 6.672 | 0.918 / 23.679 |
| Owned-cell parsing | 1.279 / 2.903 | 2.054 / 15.472 |
| Existing base-geometry parsing | 7.617 / 73.639 | 8.112 / 39.264 |
| Retained cache / shader / bounds + logging | 0.627 / 20.454 | 1.199 / 4.061 |
| Strip recording ON (includes first merges) | 2.872 / 8.289 | 0.857 / 30.188 |
| Strip recording OFF | 0.270 / 1.013 | 0.241 / 1.116 |
| Deferred first draw (includes merges) | 116.032 / 197.550 | 60.164 / 135.542 |
| Tracked native elapsed phases, no duplicate merge timing | 133.942 / 229.308 | 94.866 / 154.503 |

Both complete preparation maxima miss the **≤16 ms** target. All six strips initially record; 57 relative
geometry templates replace 250 decorative constructions, but first draw still translates/copies/merges the
250 arrow instances. Cinnamon's worst preparation is mainly existing geometry parsing (73.639 ms in the
76.254 ms total run). Sherbet's worst total is 41.242 ms; across runs its parsing/selection maxima vary. No
claim of a 16 ms player-visible open is supported. These are contended-host CPU elapsed measurements, not
quiet device bounds or a causal speed comparison with ART03.

- Cinnamon, **29.387754 dp**: load 9.41–17.20, second emulator present; exits **UNVERIFIED**, frame count **0**. No P50/P95/P99 values.
- Sherbet, **29.387754 dp**: load 10.13–13.77, second emulator present; exits **UNVERIFIED**, frame count **0**. No P50/P95/P99 values.

Raw: `perf/{cinnamon,sherbet}-raw.json`, 24 opening logs per spec and `perf/summary.json`.


Tracked native elapsed phases sum each run’s parsing/preparation, original strip recording and deferred first draw,
counting merge timing once. It excludes JS generation/layout, framework scheduling, untimed Canvas command issuance and GPU completion; it
is not end-to-end visible latency.

Cold preparation means selection parse/renderer setup + owned-cell parse + existing base flat-geometry parse
+ selected retained preparation. It excludes decorative template construction, which is explicitly measured
as deferred first draw. The individual breakdown medians/maxima do not sum to a total median/maximum because
they occur on different runs. Strip ON includes deferred compound path merging; OFF is the native diagnostic
override within the same selected JS bundle, not a separate unset JS bundle. No result infers end-to-end input
latency or frame performance from a CPU preparation timer.

Each spec has 12 OFF/ON pairs, seed 20261001, order shuffled only within each pair. Both arms are process
force-stopped before opening. Preflight requires the actual camera, full-detail draw log, correct selected id,
exactly one selection/cell/base/preparation event and test-ads/PERF configuration. Opening logs, raw data,
order, APK hash, actual displayed cell size and before/input-gate/after host records are retained. Exit capture
is skipped unless load<4 and fleet_floor_api31 is the sole emulator. Both arms must also pass the accepted-exit
check before a pair can support percentiles. No frame percentiles were collected on this host.

Prior lazy-only pilot (`perf/pilot-lazy/`) lacked complete parsing timers and incurred ~150–212 ms first draw;
its preparation numbers are not acceptance evidence. Initial template measurements/captures containing the
single-cell fragment are retained in `perf/pilot-template-orphans/`; final measurements supersede them.
An intermediate native assemble without the saved flags rebuilt a normal JS bundle; missing PERF camera /
`unitSet=real` rejected that run. Rejected raw evidence is `checks/rejected-config*`. The build helper now sets
the same flags at every phase and forces the selected JS bundle. No rejected sample enters the final ledger.

## Captures and reproducibility

All final skin captures use **29.387754 dp**. `screens/cinnamon-on-viewport.png` and
`screens/sherbet-on-viewport.png` are actual game screenshots with all META flags. The before Cinnamon viewport
is copied from the reviewed ART03 real-config capture; provenance is recorded separately. The zoomed game
viewport naturally clips board edges. `before-cinnamon-board.png`, `after-cinnamon-board.png` and
`after-sherbet-board.png` are whole-board **native Canvas diagnostic renders**, using the real production
geometry/spec at the same physical cell size; they are not game viewport screenshots or all-META UI captures.

The crop helper selects actual adjacent arrows: tail pair 9/19 at (5,19)/(5,20); head→tail pair 21/17 at
(34,16)/(35,16); longest straight icing run arrow 107, 17 cells. `screens/crops.json` records bounds, indices,
source and nearest-neighbour 2× magnification. No retouching. Compare:

- [Tail-to-tail](../../../artifacts/ART-SKINS-04/screens/comparison-tail-to-tail-2x.png)
- [Head into tail](../../../artifacts/ART-SKINS-04/screens/comparison-head-into-tail-2x.png)
- [Long icing run](../../../artifacts/ART-SKINS-04/screens/comparison-long-icing-2x.png)

Separate crops and complete boards are in `screens/`. Directional heads, centred tails and continuous icing
are visible; taste and the short-arrow head/tail overlap within one owned cell remain **OWNER REVIEW PENDING**.

Final local APKs (`perf/`), all at the saved test-ads/PERF configuration:

| APK | SHA-256 | Native unit registration |
| --- | --- | --- |
| cinnamon.apk | `34cc9ce81fa895c5b3d7d0128245c1110580844f6690121b3e01d2db0cacf448` | Diagnostic only |
| sherbet.apk | `8fc86bbbab081a51313a5824b8df65ad5de49971b3ff4cee33a3d69797e19fc4` | Diagnostic only |
| unset.apk | `bb8a4f04d5edc7e679ead618ccc7a456228478e69f6cb7be489fe53a06608d12` | Absent |

All three APKs have the same 15 asset names and only the nine official test ad-unit IDs in the JS bundle
(`checks/apk-checks.json`). The existing native AdMob application ID is unchanged; it is not an ad-unit ID.
Selected diagnostic APKs include the temporary instrumentation but no instrumentation runs during the
opening measurements. Both copied test Kotlin files and the temporary generated manifest registration
were removed from the ordinary tree before building unset. Its actual board crop matches the native OFF
capture **pixel for pixel** at 29.387754 dp; its log has the real opening camera and no skin events
(`checks/unset-check.json`, `checks/unset-open.log`, `screens/unset-viewport.png`). No assets are added.

Final checks: `checks/jest-final.txt` (115 / 1,927 / 12), `checks/tsc-final.txt` (exit 0), native Gradle build
logs and all 42 native before/after runs. The measurement helper's future quiet branch now builds/pushes
the local input driver and rechecks the input-time gate; that branch remains UNVERIFIED here. Percentile
output carries a frame count beside each value; empty/rejected exits preserve raw data without percentiles.

Portable series, in order:

1. `patches/01-general-skin-system.patch` — runtime, spec registry, opening/flag/contrast tests.
2. `patches/02-contract-and-tooling.patch` — frozen negative control, native contract, build/measure/crop tools,
   and the adding-a-skin guide.
3. `patches/03-report-and-lessons.patch` — this ledger and the durable lessons update.

The series is checked by applying it to a temporary archive of the stated clean base, comparing all patched
file hashes to the working tree, and reverse-checking the series against the working tree. Verification is
in `checks/patch-verification.json`; hashes/application instructions are in `patches/README.md`. The code is
left uncommitted and default OFF. Generated APKs, captures and raw data stay in ignored `artifacts/`, not in
source patches. The task-owned emulator-5556 is stopped after capture; no other emulator is touched.


## Reviewer verification

No independent reviewer or quiet-host frame review has run in this task. The acceptance ledger is the author's
executed evidence and explicitly retains the failed/pending gates. Do not enable this feature on its basis.
Read [How to add a skin](../../skins/README.md) for fields and reproducible contract/build commands, and
[engineering lessons](../../engineering-lessons.md) before another iteration. Next work: reduce total parsing
and first-draw CPU cost, resolve K3 area scope, obtain owner look approval, then collect quiet-host exits.

## Controller review (2026-10-01)

Verdict: **REQUEST CHANGES (look + speed); the general system itself is accepted as the base.**

Executed by the reviewer: with the delivered code, `tsc` exit 0 and `jest` 115 suites / 1927 tests / 12 snapshots
(Node v20.19.4). Recomputed from raw files: K1 before 17,191 / 23,298 failing paths (21 levels), after 0 / 36,006
(both specs). Opening cost from `perf/*-raw.json`, all at 29.388 dp: Cinnamon preparation 12.3 / 76.3 ms, deferred
first draw 116.0 / 197.6 ms, sum of preparation + recording + first draw **135.8 / 230.5 ms** (median / max);
Sherbet sum **95.5 / 157.4 ms**. The full level-open cost, not the 12 ms "cold preparation" headline, is the number
to beat. Exits UNVERIFIED (no quiet host). The shared `arrowGeometry.ts` change only adds `cellsForSkin()`.

Visual (captures): tail-to-tail and head-into-tail overlaps are fixed. Two regressions:
1. Cinnamon dough was darkened to pass K4 as written (body fill ≥3:1). The brief's rule was wrong — the outline
   carries legibility. K4 now applies to the outline; restore the light warm dough (#E6AE71 family).
2. One-cell arrows draw head + roll + face in one cell: a small brown blob with eyes (reads like an emoji pile)
   with an unclear direction. One-cell arrows get no roll/face (dot tail or none).
K3 ruling: head cap vs tail cap is the whole rule (resolved). Speed: the first draw must stop copying all 250
arrows; aim for total level-open ≤ 16 ms extra over flat, else report the breakdown.

Disposition: skin code moved out of the tree into `artifacts/ART-SKINS-04/patches/skin-code-removed-from-tree.patch`
(17 files, re-apply check passes). Committed: report, skin guide (`docs/skins/README.md`, K3/K4 rulings and the
one-cell rule), contract/measure/build tooling, lessons.

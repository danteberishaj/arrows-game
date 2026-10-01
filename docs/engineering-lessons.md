# Engineering lessons

This is the shared, evolving record for future sessions. Read entries relevant to the work;
follow the linked reports for details. Preserve a distinction between observations, hypotheses,
and verified corrections. Update entries when new evidence supersedes them.


**Performance background (read before any rendering/perf change):**
[docs/performance/field-guide.md](performance/field-guide.md) — the Arrows Performance Field Guide (2026-09-01):
why the bottleneck was ownership, not React Native; the retained native board; the experiment ledger (what
was retained, superseded, rejected and why); benchmark method; limits and triggers for revisiting the
architecture. The original page is `docs/performance/field-guide.html`.

## Android arrow textures: measure connectors, not just tile dimensions

**Observed, 2026-09-30 — ART-SKINS-01.** All nine image-generated sprite sheets drifted from
the exact 4×4 contract despite explicit prompts. Outputs were 1254×1254 rather than 1024×1024.
After normalization and slicing, all nine failed at least one seam/alpha/fit check. Transparent
background requests also left opaque dust/glow pixels near cell borders. Visual appeal is not
evidence that a sheet is a valid runtime atlas.

**Confirmed cause of a render defect.** Cinnamon Roll candidate 2's bend left connector is
centred at y=129.5, but its bottom connector is centred at x=171.5, in a 256 px cell. Assuming
both connectors meet at (128,128) displaced the outgoing shaft by 43.5 atlas pixels. The owner
reported visible gaps in a dense-board screenshot. The straight edges, head base, and tail
connector also differ in thickness (89–116 px across the pieces used).

**Correction visually verified.** The renderer measures alpha≥128 connector extents once on
atlas load, anchors bends at their incoming/outgoing connector centres, and normalizes each
connector axis to 34% of a board cell. A 10% cell overlap bridges filtering fringes and small
connector insets. The tail scales uniformly to preserve the round face. Raw sheets remain
unaltered, so rendering compensation does not falsely turn asset checks into passes.

**Verification rule.** Inspect four head directions, both turn directions under all rotations,
adjacent bends, one-cell/short arrows, and a slither crossing a bend. Capture the same level
OFF/ON and a 9×11 board at 38 dp. Restart performance sampling after any renderer or atlas
change; samples from an earlier APK do not describe the corrected one. Keep the texture
flag default OFF while asset or performance gates fail.

**Status.** Initial spike compiled; 1918 Jest tests and TypeScript passed. Connector correction
compiled, and `artifacts/ART-SKINS-01/screens/fixture-on.png` verifies connected straights and
both bend directions under rotation on a native 9×11 board at 38 dp (1080×2400, API 31).
Dark baked-in tile borders and stray pixels remain asset-quality defects; do not confuse a
connected contour with seamless texture. The final same-APK 48-run pilot found a 2.4034 ms static recording median regression,
above the 0.0781 ms OFF null spread; the renderer fails the ship gate. Exit timing is inconclusive
on the contended emulator host. The flag remains OFF. See
[ART-SKINS-01 report](next-level/reports/ART-SKINS-01.md) for the current acceptance results.

**Replicated by review, 2026-09-30.** Same APK, 16 shuffled runs on emulator-5556: static recording
OFF 0.24 ms vs ON 2.45 ms (medians, ranges do not overlap). Exit-frame cost is still unverified: the
host was loaded (second emulator), frame-time ranges overlap completely.

**Dense boards fail readability.** At ~10 dp cells (250-arrow level) the textured arrows merge into a
brown mass; any textured skin needs a cell-size threshold with a simplified fallback. Tail faces also
rotate with the arrow; orient decorative faces to the screen, not the path.

## Procedural skins: compound contours solve joins; detail and preparation still cost

**Observed, 2026-09-30 — ART-SKINS-02.** Procedural filled silhouettes replace tile connectors,
so native 38/24 dp captures show connected shafts and rounded turns without baked dark seams.
Faces use screen axes. The 12 dp fixture and actual 250-arrow level use the existing flat geometry
in brown; the dense board remains directionally readable. This is visual evidence, not owner taste
approval. No image assets or Gradle asset directories were added; ON/OFF APKs have identical 15-name
asset lists. Full-detail compounds draw seven layers per strip, eight with missed marks, at
10/100/250 arrows. See [ART-SKINS-02 report](next-level/reports/ART-SKINS-02.md).

**Corrected implementation trap.** Preparing full decorative paths before the displayed cell size
was known cost 387.4375 ms in a dense preflight. Prepare only the current detail tier. Reading a
native child's scale did not reflect the animated parent transform reliably; the retained display
list also needs invalidation when the tier changes. A selected-build reaction now sends only
14/24/28 dp boundary crossings, rather than every pan frame. Verify LOD in the real game as well
as an isolated native fixture; the latter bypasses the parent-transform problem.

**Measured limits.** Same-APK 12 OFF/12 ON shuffled dense-board runs show strip recording
0.2191665 → 0.5288125 ms, +0.309646 ms (passes the 1 ms recording threshold). **Separate cold
preparation** is ON median 4.9429585 ms, range 1.259709–60.004584 ms. Keep it beside the recording
cost; moving work before a timer does not remove its cost. This dense flat-fallback result does
not certify full-detail performance. Host load 13.82–22.54 and another emulator invalidate the
exit-frame gate; report UNVERIFIED. Default OFF remains appropriate while these limits persist.

**Motion evidence rule.** `screenrecord --time-limit 10` does not guarantee a 10-second file or
60 Hz samples. Native fixture captures had 83/50 frames and median gaps 66.62/74.88 ms, too sparse
for 90 ±17 ms press timing or two-frame touch latency. Retain actual PTS/frame counts, distinguish
native replay from real gestures, and leave timing UNVERIFIED. A fixed 620 ms analytic spring
cutoff approximates the specified energy termination; do not describe it as exact Reanimated
equivalence. Reanimated Android reads global `transition_animation_scale == 0` at process start
for reduced motion; changing only animator duration is insufficient. Restart after preference
changes, capture the actual game, and restore the original value in a finally block.

**Reusable tooling correction.** Native fixture activities hosted inside an Expo/RN app need
AppCompatActivity; plain Activity caused a theme/lifecycle failure. Direct module calls survive
release R8, while reflective internal-name calls failed. Keep temporary fixture registration out
of the ordinary release. Build only the device ABI when disk is constrained; clear regenerable
build caches rather than source/evidence. New experiments should target full-detail preparation,
quiet-host exits and real-input latency, not repeat the already measured dense recording question.

**Review addendum, 2026-09-30.** Benchmark the configuration players get: the ART-SKINS-02 PERF build lacked
META_ZOOMED_CAMERA, so its "dense" level drew the flat 10 dp tier while the shipped camera shows ~29 dp (full
detail). A skin benchmark must state its camera/zoom flags and the on-screen cell size it measured. Also:
per-frame `pathsDirty = true` in `onDraw` re-runs the per-arrow pass on every animated frame, and a shuffled
order that front-loads one arm (7 OFF first) confounds time with treatment — randomise within pairs.

**ART-SKINS-03 correction and full-detail evidence, completed 2026-10-01.** All META_* flags were enabled,
as the owner confirmed. At the physical 1440×3120/560 display (411.43 dp wide), level index 3827 opens
at **29.387754 dp**, not the flat tier. Twelve ON process starts each show exactly one full-detail
preparation and a first seven-layer draw at that actual size. Waiting for measured layout and passing
the opening camera scale removes the guessed 12 dp mount; a regression test covers the opening and
a replacement level. Native onDraw now dirties membership only during active feedback. A 38 dp
correctness trace shows five exit mask commits → five rebuilds, then zero rebuilds before blocked
feedback; no exit-frame cost is inferred from that trace.

**The correct configuration changes the performance conclusion.** Twelve OFF/ON pairs, shuffled only
within each pair: full-detail cold preparation median **45.9131875 ms**, max **83.62875 ms** (budget
16 ms); strip recording OFF **0.1903335 ms**, ON **2.9699995 ms** medians. These are contended-emulator
measurements, with the two costs kept separate. The earlier flat-tier +0.31 ms result does not certify
this camera. Host loads 15.06→17.11 and another emulator fail the quiet-host prerequisite; ART-SKINS-03
**skipped exit capture**, preserving host evidence and reporting UNVERIFIED rather than collecting
contended frame percentiles. Run only when load <4 and the permitted AVD is the sole emulator.

**Look and next work.** The tail now sits at the shaft endpoint, icing is a continuous tapered ribbon,
and the head highlight is a contained oval; fresh 38 dp before/after captures are retained. Owner taste
review is pending. Default OFF remains appropriate. Future work should reduce full-detail preparation
and moving-arrow work, then verify quiet-host exits. Every skin result must state the real on-screen
cell size and build flags; assert them from camera and draw logs before accepting samples. See
[ART-SKINS-03 report](next-level/reports/ART-SKINS-03.md) and its paired measurement script.
Historical status: ART-SKINS-02/03 were preserved as removal patches pending owner review. ART-SKINS-04
restores that base as an uncommitted, default-OFF general renderer; its portable patch series and gate ledger
are in [ART-SKINS-04](next-level/reports/ART-SKINS-04.md). Owner review remains pending.

## Spike assets must never be packaged unconditionally

**Observed, 2026-09-30 — ART-SKINS-01 review.** The spike added `artifacts/ART-SKINS-01/runtime` as an
unconditional Gradle asset source. The default-OFF flag does not stop packaging: any build on a machine
that has the directory would ship the atlas (inferred from the Gradle line and the spike APK's
`assets/cinnamon-roll.png`; no flag-OFF release was built to confirm). **Practice:** gate experiment
assets on the same build-time flag as the code, and list the APK's assets as part of the OFF check.
**Status:** the spike (native renderer, JS props, Gradle asset line) was taken out of the working tree on
2026-09-30 and kept as `artifacts/ART-SKINS-01/patches/01-android-render-spike.patch`. The gate is still
missing in that patch: add it before the spike is applied again.

## Android capture tooling: bound commands and preserve raw evidence

**Observed, 2026-09-30.** The emulator's screencap PNG exceeded Node's default 1 MiB subprocess
buffer (a saved capture was 1,375,531 bytes). Binary capture helpers need an explicit larger
buffer. Android service-dependent commands also stalled during this experiment; system
property reads alone did not establish readiness. The cause of the emulator stall is unconfirmed.

**Additional evidence.** A separate host process issued ADB screenshot commands to emulator-5554
while this task was capturing. Activities also finished with an `app-request` event. Shared device
ownership invalidates a controlled capture/performance experiment; it does not establish a
renderer crash. This task moved to the unused `fleet_floor_api31` AVD on emulator-5556.
The installed emulator refused a second instance of the same AVD unless both instances
used read-only mode; leave an already running shared instance alone and choose another AVD.

**Practice.** Use bounded timeouts, explicit binary buffers, and checks for app/board readiness.
Retain failed logs. Do not interpret an incomplete run as a zero-cost or zero-drop result.
Use an isolated emulator for controlled experiments and record its serial. Do not restart or
reconfigure a shared emulator once competing use has been discovered.

## Performance evidence: validate parser counts against raw rows

**Observed and corrected, 2026-09-30.** An analysis parser initially rejected every gfxinfo
row because Android CSV lines end with a comma. Removing the empty trailing column restored
851 complete frames within the tap-plus-slither intervals. All 48 complete-frame counts now
match the benchmark JSON; 888 complete frames were captured overall.

**Practice.** Assert agreement with an independent retained count before interpreting timestamp
windows. Record completed rows, excluded rows, nominal slots, and gaps separately. Gfxinfo's
legacy deadline misses and missing rows do not establish presentation drops; preserve raw CSV
and label a poor or contended cadence inconclusive. The reproducible analysis is
`scripts/art/analyze-skin-perf.py`; the report links the experiment evidence.

## Skin decorations must stay inside the arrow's own cells

**Observed, 2026-10-01 — owner review of ART-SKINS-03 `dense-on.png`.** Rolls doubled up, heads ran into
neighbouring rolls and icing touched the rim. **Cause (confirmed from geometry + capture):** the shaft path
starts `TAIL_EXT = 0.42` cell behind the tail cell centre and the head tip ends at `TIP_EXT = 0.5`
(`src/ui/arrowGeometry.ts`). ART-SKINS-03 moved the roll (radius 0.31 cell) from the tail cell centre to
path distance 0 to hide the stub behind it, which put it 0.08 cell from the neighbouring cell. Two tails
facing across a cell edge then draw rolls 0.16 cell apart — 25 px at the capture's 155 px cell, the offset
seen in the screenshot. **Correction verified geometrically in ART-SKINS-04:** centre the tail decoration
on the tail cell, start the shaft there, and intersect every filled layer (including the offset shadow)
with the owned-cell union inset 0.04 cell on its exterior. Union first, then inset: internal shared edges
must stay connected. Spec validation also bounds the tip, tail radius/rim and icing amplitude/width;
icing has no offset and must fit the body contour inset by 0.03 cell (intersection fallback or a verified narrow rounded-centreline construction). These rules apply to
both Cinnamon and Sherbet through data, without native skin-id branches.

**Verification:** an independent native Android Region oracle checks v1 campaign indices 0–19 and dense
index 3827 (2,118 arrows per spec). Frozen ART03 Cinnamon has 17,191 failing layer paths; the two new specs
have zero failures in 36,006 checked paths, including flat silhouettes and closed eyes. Keep the frozen
negative control: a positive-only test can accept a broken oracle. Tail-to-tail, head-to-tail and long-run
2× captures at **29.387754 dp** are retained. Geometry is verified; **owner taste approval is pending**.
The original results and scope limits are in [ART-SKINS-04](next-level/reports/ART-SKINS-04.md); ART05 re-ran the independent red → green oracle and retained the fit correction.

**Oracle correction:** world-coordinate Region rasterisation silently lost layers beyond its scan range.
Normalise each arrow locally, bound the raster extent, and assert that every non-empty source path produces
a non-empty Region before DIFFERENCE. Use 400 samples/cell and an independent union/erosion oracle. The
rejected oracle runs remain in the report; the final old-renderer red → new-renderer green runs use the
corrected oracle. This checks filled Android geometry, not an exact proof of the antialias fringe.

**Opening correction:** lazy strips alone did not prevent all 250 decorations being built on first draw:
the native child records the whole board display list despite the parent's camera transform. Reuse relative
shape/direction/detail templates (57 unique templates on this dense board). ART04 translated per-arrow paths; ART05 merges templates directly into strip layers and creates individual art only for feedback.
Preparation creates zero decorated arrows, but first draw still builds templates and merges strip layers. Measure both costs.
Include JSON selection, owned-cell parsing and the existing flat-geometry parsing in cold preparation;
exclude none of these merely because they precede a commit timer. ART04's final paired measurements at **29.387754 dp** still
miss the 16 ms maximum: Cinnamon median/max **12.280/76.254 ms**, Sherbet **18.120/41.242 ms** (12 ON
opens each). Deferred first draw adds median/max **116.032/197.550 ms** and **60.164/135.542 ms**, respectively,
including merges. These are contended-host elapsed CPU costs; default OFF remains appropriate. See the report for each spec's cost breakdown.
**Single-cell correction:** the first template captures exposed a disconnected corner fragment inside the
owned cell. K1 alone did not catch it because it still fit. Native stroking of a move-only contour with the corner effect generated a cap at the template
origin, not the move point (confirmed by the native diagnostic). Skip shaft strokes when length is zero.
The final regression checks connected components of each single-cell rim, with the old stroke added back
as a negative control. A reconstructed-outline oracle first failed on contour winding cancellation and
then a raster-rounding difference; preserve those rejected runs and use actual filled Regions instead. Palette lookup paints explicitly
use nearest sampling so neighbouring cell colours do not blend. Final captures are the verification evidence.
Adding a skin requires data plus the contract in [docs/skins/README.md](skins/README.md), and a fresh budget
measurement; passing the fit/draw tests does not certify opening or exit performance.

**Build correction:** pass the saved test-ads/PERF/all-META flags to every Gradle phase, including a native-only
assemble. An intermediate assemble without them re-bundled a normal app; preflight rejected it before
benchmark acceptance. Force the JS bundle when a selection changes, save the flags/APK hash, and reject
missing camera/detail logs or real ad-unit configuration. Never salvage measurements from that wrong build.
Exit percentiles remain UNVERIFIED unless both members of all twelve pairs satisfy load<4, sole permitted
emulator and accepted-input checks; record actual frame counts beside every percentile.

## A contract rule can be wrong: test what carries the property

**Observed, 2026-10-01 — ART-SKINS-04 review.** The skin contract required every arrow *body fill* to be
≥3:1 against the background. Codex met it by darkening Cinnamon's dough to chocolate brown, and the board
lost its warmth. Legibility is carried by the outline (dark rim), not the fill. **Correction:** K4 now applies
to the outline; the fill is free (docs/skins/README.md). Also: one-cell arrows have no room for a tail roll
and face — they read as a blob with eyes — so they get a dot tail or none. **Practice:** when writing a
contract rule, name the element that actually delivers the property, and look at the dense real-config
capture before calling a contract-compliant skin good.

**ART-SKINS-05 verification, 2026-10-01:** Cinnamon's light `#E6AE71` dough and Sherbet's light pastels are restored. Their rims pass both backgrounds: Cinnamon 5.210:1 / 3.584:1; Sherbet 5.099:1 / 3.662:1. The shared red family still carries blocked feedback. Both specs select `tail.oneCell: none`; native K8 passes 898 actual one-cell checks across the real fixtures, and frozen ART04 Cinnamon fails 449 of them. Dot/none are additionally exercised in all four directions. One-cell identity travels with exit art. Geometry checks are verified; owner appearance approval remains pending. See [ART-SKINS-05](next-level/reports/ART-SKINS-05.md).

## Cell fit does not prove a filled join or a continuous accent

**Observed, 2026-10-01 — ART-SKINS-05 owner captures.** A large white wedge at the shaft/head overlap made Sherbet look disconnected. Every layer still fit its owned cells, so K1 passed. **Cause confirmed:** clipping the head cap produced a contour with opposite winding to the shaft's filled stroke. Concatenating the paths cancelled their overlap. Normalize cached head contours to the stroke's positive winding; keep native curves on shafts/bends. The small head cap uses at most 0.005 logical-pixel approximation error. Explicit per-template Boolean union also fixed the hole, but cost more; retained pilot evidence records that tradeoff.

**Verified regression:** for every tested arrow/spec, the filled head Region minus body Region is empty, with no tolerance erosion. A frozen broken-winding control leaves missing head area, so the test rejects the old construction. This tests coverage, separately from ownership. Do not solve a fill hole by connecting the small head highlight to the shaft highlight.

**Further owner correction:** the head oval was already good; the white shaft lines looked crooked and interrupted by the brown stripe. The owner clarified that straight, continuous shaft lines are wanted. This supersedes the earlier wavy-icing brief for Cinnamon. Its spec now has zero wave amplitude, a stripe displaced to one side, and a fade limited to 35% of the available shaft on short arrows (long runs retain a one-cell fade). The oval stays separate. Use the same rounded centreline as the dough so accents follow bends smoothly; retain inset-body clipping for variants that cannot fit by construction. Native verification subtracts the inset body from every accent and requires each shaft accent alone to have one connected component. The separate oval is excluded from that connectivity assertion. A dense before/after crop is necessary: cell fit and colour contrast alone would miss the visual problem. These geometry checks pass; **owner look review is pending**.

**Measurement correction:** headline level-open cost is the per-run sum of JSON selection + owned-cell parsing + base geometry + retained preparation + strip recording + the full first draw, including Canvas commands. Lazy work must appear exactly once, inside first draw. Compare median and maximum of sums against the same selected build's flat override plus 16 ms; do not add phase maxima, substitute preparation alone, discard slow opens, or claim exit percentiles from a busy host. ART05 retains twelve shuffled OFF/ON pairs per spec, raw host evidence and build flags. See its report for the measured gate; a failed budget stays failed and the experiment stays default OFF.


**ART05 measurement-boundary correction:** final review found the earlier “complete” sum still omitted strip partitioning, grid/config setup and native field construction around the separately timed parsers. Those runs are retained as `perf/pilot-incomplete-timer/` and cannot certify the full budget. Explicit test intents now time native renderer field construction and every initial prop setter. Parsing timers are nested diagnostic breakdowns; adding them again would double-count. The headline includes construction + prop setup + retained preparation + recording + full first draw. Ordinary flag-unset app renders without these timing logs. See the final ART05 report for corrected measurements and the honest failed/verified gates.


**Sherbet owner correction, 2026-10-01:** the same “not straight” feedback also pointed to the pink/green arrows, not only Cinnamon. Their bars were mathematically straight but globally shifted up .065 cell, while the head ovals stayed on the shaft centre. Horizontal bars therefore appeared misaligned with the ovals; vertical bars did not show the same perpendicular shift. Both current skins now put white shaft accents on the shaft/head axis, with zero offset. Keep the good head oval separate. A native straight-run axis check plus an intentionally shifted shine negative control tests this property, beyond fit and connectivity. Do not assume that “straight” only refers to local line slope, or narrow an owner correction to one skin without inspecting the indicated colours. See ART05 for the verified runs and captures.


**Final ART05 verification at 29.387754 dp:** 946 native straight-run axis checks pass across the two specs; the shifted Sherbet negative control fails (−2.600 logical-pixel centre error). K1 remains 0/36,006 failures, with the ART03 red control retained; K8 passes 898 one-cell checks, while frozen ART04 fails 449. Jest passes 115 suites / 1,933 tests / 12 snapshots and TypeScript passes. Cinnamon complete opening median/max 45.885/75.844 ms versus flat 5.963/20.846 ms (12 opens each state): **FAIL**. Sherbet complete opening median/max 33.762/54.381 ms versus flat 11.039/25.795 ms (12 opens each state): **FAIL**. Both final opening gates fail; do not use the incomplete-timer Sherbet pass as acceptance. Host contention and another emulator leave exits UNVERIFIED with zero frames. Default OFF and owner look review pending; raw evidence and current captures are in ART05.

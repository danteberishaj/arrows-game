# Engineering lessons

This is the shared, evolving record for future sessions. Read entries relevant to the work;
follow the linked reports for details. Preserve a distinction between observations, hypotheses,
and verified corrections. Update entries when new evidence supersedes them.


**Performance background (read before any rendering/perf change):**
[docs/performance/field-guide.md](performance/field-guide.md) — the Arrows Performance Field Guide (2026-09-01):
why the bottleneck was ownership, not React Native; the retained native board; the experiment ledger (what
was retained, superseded, rejected and why); benchmark method; limits and triggers for revisiting the
architecture. The original page is `docs/performance/field-guide.html`.

**Skin evidence for future art:** [contract and latest report](skins/README.md),
[per-style performance recipes](skins/performance-recipes.md),
[reusable generation prompt](skins/GENERATION-PROMPT.md). Consult them before generating a new spec.

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


## Runtime skins: preserve gate, save ownership and configuration across selection

**ART-SKINS-06, 2026-10-01.** Runtime identity is an append-only numeric registry: Classic 0, Cinnamon 1,
Sherbet 2, one additive `arrows_skin` key. The preference is conditionally appended to hydration on Android
with `META_SKIN_PICKER`; it is intentionally absent from the unconditional existing registry, so a disabled
or downgraded build neither reads nor writes it. Unknown/missing/removed/corrupt IDs resolve to Classic without
repair writes. Changing only a display name/order never changes persisted identity. Never reuse an ID.

**Verified by Jest:** every existing key round-trips unchanged ON/OFF; one choice persists across a new
store; repeated choice writes nothing; failed hydration cannot write the skin or progress; downgrade ignores
and retains the saved ID. The old 29-key SaveSystem registry/schema/migration and old parsing remain intact.
The new key uses the existing guarded/coalesced writer. PERF capture startup reads only that key in a
separate guarded store, never installs/hydrates/migrates progress; an all-key disk test pins that isolation.
An earlier pilot used ordinary hydration under PERF and was rejected during final save-ownership inspection;
its captures/measurements are retained as superseded APK evidence. User ART06 explicitly authorizes this additive key
without commits; no separate schema/amendment commit is made.

**Selection trap corrected:** an unchanged native config prop is not resent when only selection JSON changes.
A new motion renderer would otherwise lose the reduced-motion/blocked-colour configuration. Replay the retained
config after creating the new renderer, then prepare once at props commit. React switches retain one native
view (Classic uses the existing flat paths), immutable board geometry and actual displayed cell size. The
picker/platform gate must be static for conditional hooks; the choice itself must not control hook order or
view identity. Native previews in a modal would add renderer/lifecycle work: static SVG/spec colours suffice.

**Evidence rule:** Settings is on the menu. Returning to Play after choosing is navigation and opening work,
not just selection preparation. `onDraw` is command recording, not a GPU presentation timestamp. Keep these
intervals named separately, retain video frame counts/PTS and raw tap/draw logs, and report the real camera
size and graphics backend. Black screenshots accompanied by emulator GL errors are rejected capture evidence;
recover only the task-owned AVD without touching the other emulator or wiping saved data.

Current evidence and owner-review status: [ART-SKINS-06](next-level/reports/ART-SKINS-06.md). Earlier K7 opening
FAIL and quiet-host exit UNVERIFIED results remain unchanged; a picker does not clear those gates.


**ART06 final evidence:** 117 suites / 1,963 Jest tests / 12 snapshots and TypeScript pass. Actual checked
Android radios have 60 dp targets in both themes. Cinnamon/Sherbet/Classic selection and default/non-default
restart captures pass at 29.387754 dp. OFF board pixels match literal HEAD 1d61234; all APKs retain the same
15 asset names. Sherbet survives both uninstall-free downgrades and remains checked after re-enabling.
Six timing samples per choice retain actual frame timestamps and boundary pixels. A permissive non-white
classifier initially counted the neutral grid before the skin appeared; inspecting the first/previous
frames caught it. Require recognizable arrow pixels, validate recorded frame counts/PTS, and report
frame-gap uncertainty. Validate actual radio UI before coordinate input: a missed list-open tap reached
Support in a rejected batch. Capture cleanup must stop only its owned screenrecord PID, never a broad
process-name kill. These lessons are verified by final captures/raw checks; owner look review remains pending.


## A larger skin catalogue needs transport and feature controls, not copied renderers

**Observed, 2026-10-01 — ART-SKINS-07.** The canvas's SkinBoard table reuses a small vocabulary across 15
additional styles: nested colour heads, beaded bodies, stitches, folded caps, fletching, marble shine and
translucent glow. Copying a renderer per style would repeat the earlier fit/join/alignment bugs.
**Correction:** keep appearance in the one TS registry and add general capabilities with explicit bounds,
using the existing compound-strip/template architecture. Every registered one-cell arrow is head only;
primary shaft gloss stays centred and continuous, while an explicitly dashed seam is a distinct decorative
layer. Preferred dark mode preserves genuine light-theme contrast failures instead of claiming they pass.
Verification is recorded per feature/spec in [ART-SKINS-07](next-level/reports/ART-SKINS-07.md); do not infer
geometry or owner approval from TypeScript/data tests alone.

**Harness evidence:** the expanded dense fixture's inline Base64 argument exceeded the emulator shell
transport limit and returned `error: closed`, after the same frozen oracle correctly rejected the first
20 campaign levels. This is a test-transport failure, not a skin result. Transfer fixture JSON to a diagnostic
file and pass a short switch to instrumentation; retain rejected transport logs and rerun the dense test.
The initial local build also exhausted R8 metaspace. A bounded, process-only build memory setting fixed the
build; avoid changing shared Gradle settings or stopping another session's daemons/emulator. An Android
system-service watchdog stalled initial installation; its raw logs are retained, and failed attempts are
excluded from acceptance. A boot-completed property alone does not prove the package/activity services are
ready: check the service, actual install result and real capture pixels.

The guide's [catalogue feature table](skins/README.md#canvas-catalogue-and-shared-features-art-skins-07)
records the rule and example for each new capability. Continue to distinguish fit verification, contrast
exceptions, contended-host opening costs, quiet-host exit evidence and owner taste review.


**ART07 narrow-accent evidence:** the native body-inset check rejected six raster samples of Neon's .04-cell
shine at a rounded bend in campaign index 0, arrow 1. Its .13-cell tube left little room for corner sampling
and the independent L-infinity .03-cell erosion. Narrowing only that data width to .03 kept the highlight
centred and fixed the tested failure; the same oracle was retained. The full campaign/dense verification
status is in ART07's ledger. Do not weaken the body-inset oracle to accept a small visual overrun.


**ART07 palette/paint correction:** the initial Rainbow candidate repeated a full-width red band over a violet body. With rim/body + five band paints, violet was missing from the visible stack. Use the body as the outer red band and five narrower bands through violet: six visible canvas colours, the same seven paints, plus one missed-mark draw. This is data reuse, not a renderer branch. The revised widths passed native fit/join/head/one-cell/LOD/reduced-motion checks on all 21 required levels; the final matrix preserves raw earlier results for the other 16 unchanged specs and the fresh Rainbow results. The prototype is retained in ART07. Actual final captures and opening costs are in its ledger; owner review remains pending.

**K4 alpha precondition:** a hex contrast ratio assumes an opaque outline. The catalogue contract now rejects transparent rims, with 17 deliberately weakened-alpha controls. Body/glow opacity remains allowed. Before permitting a translucent outline, extend K4 to audit its composite over each actual background; do not reuse the opaque hex ratio.


**ART07 performance follow-up:** full-width strip traces constructed all 250
arrows even under the zoomed camera. The native child's clip covers the board; a parent owns the camera
transform and can move without redrawing the child. A proposed partial-strip cull was rejected before
integration: it needs camera invalidation and could reintroduce the field guide's pan/cache problems.
Geometry-only audit paths were also allocated/reset in normal static and interaction buffers despite
never being drawn. The retained correction makes those diagnostic paths lazy. After emulator recovery, production/audit/frozen native samples and exact software pixels pass for all 17 specs; 285–513 unused template paths/spec are avoided, including 513 for Cinnamon. Opening measurements must pass before attributing a timing improvement. Keep the same look,
all layers and motion; a lower path count does not prove smooth frames. See ART07's performance ledger.

**Capture input must have fresh, settled evidence:** failed `uiautomator dump` can leave a previous XML
file, and a successful coordinate tap does not prove that Settings opened. Delete the old dump first,
require successful fresh output, observe the actual panel, and wait for stable live bounds before input.
A launcher screenshot in the rejected OFF batch exposed a missed Settings tap followed by Back leaving
the app; it was not accepted as an OFF-board result. Verification status is recorded in ART07.

**Verification failures need platform evidence:** the later bounded check returned `INSTRUMENTATION_ABORTED: System has crashed`, with system_server recovery/high guest load. It passed after a same-config cold boot of only the owned AVD. The earlier stall cannot honestly be blamed on compound boolean work; its cause is unproven. Keep failed raw attempts separate from successful geometry/timing checks.


**ART07 duplicate-decoration correction, verified:** caching is cheapest where geometry is genuinely
identical. Cache tail faces/roll spirals at the relative template origin (static templates only), nested
band heads per direction, and one compatible rounded centreline per template. Keep moving exit art's
original construction and clear caches with the selected renderer. Dense Cinnamon face/spiral builds
53→1, Rainbow nested heads 285→20; no look or motion was removed. Across 21 required levels and all 17
specs, 220,278 filled-path sample comparisons and 4,284 exact software-pixel comparisons pass in both themes
at 29.387754/38/5 dp, with 357 deliberately displaced-path controls rejected. This verifies output
preservation, not a frame-performance claim. Full opening sums and the old +16 ms budget remain in ART07.
Repeated framework recovery invalidated a partial timing batch; retain it and use fresh same-config boots
of only the owned AVD per spec, verifying system_server stability. Do not treat a boot/recovery or host/GPU
change as evidence of a cache speedup; compare final skin/Classic pairs and keep raw host state.

**ART07 supplemental LOD-proof correction, 2026-10-02 — verified:** the first supplemental optimization
pixel helper merged full-detail layers, then drew at 5 dp without merging the flat simple paths. The
result was blank, so its flat equivalence claim was vacuous. The independent K5 contract was valid;
the incomplete supplemental proof is retained separately. The corrected helper builds the actual tier,
checks simple paths and blocked-eye layers, renders on the actual `#FFFFFF`/`#13111C` backgrounds,
and requires non-background pixels in every comparison. Final evidence: 220,278 native path-array
comparisons (including expected-empty layer slots), 4,284 nonempty exact software-pixel comparisons,
269,201,210 non-background pixel samples and 357 rejected displacement controls across 21 levels ×17
specs at 29.387754/38/5 dp. A positive pixel comparison must prove that the intended thing was drawn.
See [ART07](next-level/reports/ART-SKINS-07.md); preserve the independent fit/feature oracle.

**ART07 learn by style, not draw count — measured, neutrality unverified:** 408 complete native opens /
204 shuffled pairs at 29.387754 dp cover every procedural spec on one final PERF APK. Ink Pro, Pixel
and Rainbow meet the historical aggregate Classic +16 ms median/max budget; 14 fail. Pixel/Rainbow
individual paired maxima still exceed +16 ms. Eight-draw Rainbow passing while simpler specs fail
shows that draw count alone is not a useful cost prediction. The measured larger first-draw phase is
lazy geometry/template merging; that does not isolate a particular feature’s marginal cost. Cache
construction counts are verified, but candidate timing came from different host/recovery conditions,
so no cache speed percentage is claimed. Host load 5.73–27.63 and another emulator invalidate exit
signoff (0 accepted frames; no percentiles). Keep outliers and every style’s phase/work/source data in
[performance recipes](skins/performance-recipes.md) and ART07’s raw artifacts. A failed budget means
not cleared in this experiment, not inherently impossible to optimize. The
[generation prompt](skins/GENERATION-PROMPT.md) requires the same contracts and evidence for future art.

**ART07 exact OFF correction — failure retained, cause unproven:** internally stable final OFF/base
board captures differ at 316 antialiased edge pixels (max channel delta 5) at 29.387754 dp. Board bounds,
logged camera targets, display/animation settings match, and the native board source matches the
restored ART06 patch; this does not establish why pixels differ. The separate 15-asset/no-picker/save
downgrade checks pass. Final exact pixel gate fails; preserve raw stable pairs and do not introduce a
tolerance or substitute the earlier build’s pass. Further work must isolate actual native geometry,
transform and rasterization before claiming a cause or verified correction. See ART07’s ledger.

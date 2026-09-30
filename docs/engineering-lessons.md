# Engineering lessons

This is the shared, evolving record for future sessions. Read entries relevant to the work;
follow the linked reports for details. Preserve a distinction between observations, hypotheses,
and verified corrections. Update entries when new evidence supersedes them.

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
Status: the ART-SKINS-02 code was moved out of the tree into
`artifacts/ART-SKINS-02/patches/skin-code-removed-from-tree.patch` pending owner approval of the look.

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
seen in the screenshot. **Correction (not yet implemented):** centre the roll on the tail cell and start the
skin's shaft there; every layer, head outline and shadow must fit within the arrow's cells minus a small
gap; clamp icing amplitude + offset inside the dough width. **Verification rule:** check adjacent
tail-to-tail, head-to-tail and parallel neighbours on a dense level, not only an isolated fixture.

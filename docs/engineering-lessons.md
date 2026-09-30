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

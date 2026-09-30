# ART-SKINS-01 — texture assets and Android render spike

Status: default-OFF prototype; asset gates fail. This is not a shipped skin feature.

## Scope and reference

Owner task: three AI-generated candidates each for Lava Rock, Cinnamon Roll, and Strawberry Glazed,
plus a Cinnamon Roll Android retained-renderer experiment. The [design artifact](https://claude.ai/artifact/BLpq6sX8RZ4GfknZk22xQP)
was inspected in the browser, including the Cinnamon Roll artboard. Expo SDK 57 versioned docs were
read before implementation. No iOS, gameplay, save-data, generator, ads, consent, idle animation, or particle behavior changed.

## Assets and reproducibility

All generated outputs and captures live in ignored `artifacts/ART-SKINS-01/`.
Built-in image generation produced nine candidates, all **1254×1254** despite the requested 1024×1024.
`sheets/prompts.json` contains the exact prompt for every candidate and its original saved path.
The original sheets are retained in `sheets/`; `slices/<skin>-<candidate>/` contains a normalized
1024×1024 atlas, sixteen 256×256 PNG slices, two four-tile previews, and `checks.json`.
Normalization is a resize only; no seam/alpha retouching was performed.

Selected for the experiment: Lava Rock 2, Cinnamon Roll 2, Strawberry Glazed 3. The latter two have
stronger connector coverage; Lava Rock 2 has the best seam numbers in its set. Selection does not
mean the assets passed validation. Copies are under `selected/`; only Cinnamon Roll is packaged
from `runtime/cinnamon-roll.png`. The Gradle spike reads that ignored directory, so another checkout
must supply the atlas before enabling the flag; a missing atlas falls back to flat rendering.

Run `node scripts/art/check-skin-sheet.mjs <sheet.png> <output-directory>` to reproduce A1–A3.
Checks use mean absolute RGBA difference of the first/last two shaft columns, alpha outside the
8 px ring with only the connector corridor exempt, and alpha≥128 for connector thickness.

| Candidate | Shaft 0 seam MAE | Shaft 1 seam MAE | Max outer-ring alpha | Fit failures across 5 connecting cells | Result |
|---|---:|---:|---:|---:|---|
| cinnamon-roll-1 | 14.24 | 12.56 | 255 | 5 | FAIL |
| cinnamon-roll-2 | 11.66 | 11.65 | 255 | 5 | FAIL |
| cinnamon-roll-3 | 54.03 | 37.57 | 255 | 4 | FAIL |
| lava-rock-1 | 24.88 | 26.19 | 255 | 5 | FAIL |
| lava-rock-2 | 9.35 | 7.8 | 255 | 5 | FAIL |
| lava-rock-3 | 36.36 | 34.95 | 255 | 5 | FAIL |
| strawberry-glazed-1 | 19.04 | 18.23 | 255 | 5 | FAIL |
| strawberry-glazed-2 | 22.6 | 14.12 | 255 | 4 | FAIL |
| strawberry-glazed-3 | 35.85 | 44.15 | 255 | 4 | FAIL |

## Render spike and the owner-reported gaps

`ART_SKIN_TEXTURED` reads `EXPO_PUBLIC_ART_SKIN_TEXTURED === '1'` and defaults OFF. JS omits both
new native props unless this flag is on and the platform is Android. There is no shop or saved selection.
The experiment selects Cinnamon Roll. `artSkinTextured=false` in a launch intent selects the flat
renderer inside a flagged diagnostic APK, enabling same-APK comparisons.

Existing strip membership and dirty tracking stay in place. Each dirty strip records its textured
arrows in an Android `Picture`, using source rectangles from one decoded atlas. Unchanged pictures
are replayed. Marked arrows retain the existing flat mark layer. The exiting arrow clips the existing
slither trail into a reused point buffer and draws the same shaft, bend, tail, and head pieces.
Pressed, hint, and blocked sheet variants are generated assets only; existing feedback layers remain.

The first screenshot showed disconnected bends. Cinnamon Roll 2's incoming bend connector centre
is y=129.5, while its outgoing bottom connector centre is x=171.5. A fixed (128,128) pivot displaced
that outgoing shaft by **43.5 atlas pixels**. Measured source widths are straight L=89/R=100,
bend L=102/bottom=116, head base=92, tail connector=111 px. Source connectors also differ vertically:
shaft centre≈134.25, head=130.5, tail=131 px.

Correction: scan connector alpha once on decode, align those centres to the path, scale the bend axes
by their connector widths, and bridge boundaries with a 10% cell overlap. Tail scaling stays uniform
so the face is round. The native 9×11 / 38 dp fixture confirms connected contours for four head
directions and clockwise/counterclockwise turns under rotation. Dark baked-in shaft borders and
stray source pixels still appear; connected contours do not establish a seamless texture.

## Acceptance ledger

- **A1 FAIL:** every candidate's primary shaft MAE exceeds 6. Selected values: Lava Rock 9.35,
  Cinnamon Roll 11.66, Strawberry Glazed 35.85. Four-tile PNGs are retained next to the slices.
- **A2 FAIL:** each selected sheet has outer-ring max alpha 255 instead of ≤10. Dust/glow and
  tile-border artifacts are part of the generated sheets; native connector placement does not repair them.
- **A3 FAIL:** the selected pieces do not consistently meet 87±3 px. Every candidate fails at least
  one connecting piece. Full per-edge widths are in the checks JSON files.
- **A4 CAPTURED, OWNER REVIEW PENDING:** `screens/fixture-on.png` is a native 9×11 board rendered
  at 38 dp on a 1080×2400 / density 480 emulator, using the actual `CinnamonSkin` drawing implementation.
  This capture-only Activity is generated into the ignored Android app project; its source is
  `scripts/art/ArtSkinFixtureActivity.java`. It is not a gameplay board. Dense-level OFF/ON and mid-flight
  images are in `screens/`. Initial/boot/launcher captures are retained as failed evidence, not acceptance proof.
- **A5 FAIL / no ship:** the static rebuild regression exceeds the OFF-vs-OFF null spread. Exit cadence is too poor to establish a passing frame/drop gate; see the measured results below.
- **A6 IMPLEMENTED:** selected atlas is exactly 1024×1024 ARGB_8888 = **4,194,304 bytes (4 MiB)**.
  Decode is lazy on selection, not per frame. No per-slice bitmap is decoded. Old strip pictures are
  dropped and the atlas is recycled on selection change or view destruction. The loader rejects a
  size/allocation over the cap. Runtime selection-switch memory profiling has not been independently measured.
  If “4 MB” means decimal 4,000,000 bytes, a 1024² RGBA atlas exceeds that by 194,304 bytes; the sheet spec
  and memory bound then conflict. This implementation uses 4 MiB.
- **A7 PASS for existing checks:** 113 suites, all **1918 existing tests passed**, 12 snapshots passed
  without changes; TypeScript passed. Additional flag guards verify absence and exact opt-in semantics.
  Android release compilation and the diagnostic APK build passed. These checks verify default-off
  props and unchanged snapshots; they are not a binary equivalence proof of two APKs.

## Performance protocol and raw evidence

`skin-benchmark.mjs` performs alternating OFF/ON runs of one APK, on the same level and device.
The two OFF halves form A and A2 (12 each), and ON forms B (24), for 48 runs. Each run restarts
level index 3827 with 250 arrows and taps the same legal exit (row 3, column 16, up). A 1000 ms
PERF exit override extends the sample window; it does not change the shipped timing.

Build timing is the sum of logged `commitProps` compound/strip rebuilds during level open. It excludes
atlas decode and geometry parsing. Frame results are complete gfxinfo frames after reset, over tap
and a 1300 ms settle window. Nominal display slots are 78 at 60 Hz; the slither itself lasts 1000 ms,
so idle slots cannot be counted as dropped application frames. Raw CSV flags and vsync gaps must
be reconciled before making any dropped-frame claim.

An initial run on emulator-5554 was discarded after another host process was observed issuing ADB
commands to that shared device. The final run uses the unused `fleet_floor_api31` AVD on emulator-5556.
A second instance of Pixel_8_Pro could not start because the original was not in read-only mode.
No performance measurements from the initial APK or shared-device attempt are accepted.

Raw per-run JSON, build logs, gfxinfo dumps, APK, input driver, and experiment progress are in `perf/`.
The APK checksum and exact serial are stored in `perf/raw.json`. Results and permutation tests are recorded in the final analysis section below.

## Carrying learning forward

[Engineering lessons](../../engineering-lessons.md) records the connector evidence, corrected
placement, remaining asset issues, and device-isolation lesson. Root `AGENTS.md` requires future
sessions to consult and update it as evidence changes. Verification status is explicit so a future
session does not mistake a hypothesis or compiled patch for a tested result.

## Final performance analysis

Samples: A (OFF first half) **12**, B (ON, interleaved) **24**, A2 (OFF second half) **12**.

| Metric | A median | B median | A2 median | Pooled OFF median | ON − OFF | OFF null p95 | Permutation p |
|---|---:|---:|---:|---:|---:|---:|---:|
| buildMs | 0.2913 | 2.6960 | 0.2926 | 0.2926 | 2.4034 | 0.0781 | 0.00015 |
| uiFrameP95Ms | 237.8151 | 248.7648 | 163.3717 | 180.6244 | 68.1404 | 79.4511 | 0.05750 |
| deadlineMisses | 18.0000 | 17.5000 | 22.0000 | 21.0000 | -3.5000 | 3.5000 | 0.11494 |
| frameCount | 18.0000 | 17.5000 | 22.0000 | 21.0000 | -3.5000 | 3.5000 | 0.11489 |
| jankyFramePercent | 100.0000 | 100.0000 | 100.0000 | 100.0000 | 0.0000 | 0.0000 | 1.00000 |

Permutation tests use absolute differences in medians, 20,000 random label permutations,
seed 20260930, and the plus-one correction. Null spread is the 95th percentile of the absolute
median difference after random balanced partitions of the 24 OFF runs. This definition is explicit;
no prior owner threshold was assumed. Full results are in `perf/summary.json`.

Deadline misses are late completed application frames according to gfxinfo's frame deadline, not
all missing presentation slots. They are reported separately from unobserved/dropped display frames.

Frame-count reconciliation: **888** complete frames across **48 × 1.3 s × 60 Hz = 3744** nominal capture slots. Of these, **851** complete frames have intended-vsync timestamps in the tap-plus-slither interval, versus approximately **48 × 1 s × 60 Hz = 2880** slither slots (plus tap input). The remaining capture time includes idle periods; missing complete rows are not automatically dropped frames. There are **0** excluded raw rows in that interval and **1735** nominal vsync slots between its complete rows without a complete row. These gaps exclude the interval boundaries and are not a presentation/drop count. Per-run counts are reconciled in `summary.json`; all 48 parsed counts match the benchmark JSON. This very low cadence makes a frame/drop gate inconclusive. It must not be reported as a pass.

The static build median regression is **2.4034 ms**, larger than the OFF null p95 spread **0.0781 ms**. **Do not ship** this renderer. The final APK SHA-256 is `d0efd7f0961cdc9bd9308ce0e0da26ddf75f74cad4650b8c84705a4b3f495d28`.

The isolated Android instance still shared the host with another workload. Device isolation prevents
input collisions but does not isolate host CPU/GPU contention. These timings are a reproducible
pilot and a failed ship gate, not a claim about player-device performance. Improve asset quality
and reduce per-strip recording cost before repeating; use a quiet host for a decisive frame gate.

## Reproduce the diagnostic build and captures

1. Supply `artifacts/ART-SKINS-01/runtime/cinnamon-roll.png` from the selected normalized atlas.
2. Build with `EXPO_PUBLIC_ART_SKIN_TEXTURED=1`, `EXPO_PUBLIC_PERF_LEVEL=3827`, and
   `EXPO_PUBLIC_PERF_EXIT_DURATION_MS=1000`, Android SDK and a Node version supported by SDK 57.
3. For the capture fixture, copy `scripts/art/ArtSkinFixtureActivity.java` into the ignored Android
   app's `com/danteb/arrows/` Java directory and register `.ArtSkinFixtureActivity` in that generated
   manifest. This is diagnostic-only scaffolding and must not enter a production manifest. The temporary
   registration and app copy were removed after capture; the task-created emulator was stopped.
4. Set the isolated emulator to 1080×2400 and density 480, install the same APK, and launch
   `.ArtSkinFixtureActivity` with `artSkinTextured=true` / `false` for fixture captures.
5. Store the measured APK at `perf/skin-spike.apk`; run `ART_SKIN_SERIAL=<isolated-serial>
   node scripts/art/skin-benchmark.mjs`. It uses `perf/tap.json` from the deterministic level's
   first legal hint. Regenerate that input if the level or generator version changes.
6. Run `python3 scripts/art/analyze-skin-perf.py` to reproduce the statistics and raw-row reconciliation.
7. Keep the source checks, raw data, failed runs, and screenshots. Patches are in `patches/`.

Tradeoff: source-connector compensation salvages a render experiment without retouching the
AI assets, but distorts bend proportions, leaves source seams, and adds recording work. A release
needs technically valid art and a cheaper proven renderer; this patch intentionally remains OFF.

## Reviewer verification (controller, 2026-09-30)

Verdict: **REQUEST CHANGES** on the render spike; agree the flag stays OFF and nothing ships.

Executed and observed:
- `check-skin-sheet.mjs` re-run on all nine sheets: every seam / alpha / fit number matches the table above.
- `npx jest` 113 suites / 1920 tests (1918 + 2 new flag tests), `npx tsc --noEmit` exit 0 (Node v20.19.4).
- The three patches reverse-apply cleanly to the working tree (the series is the tree).
- Independent device run, same APK (`d0efd7f0…`), emulator-5556, 1080x2400/480, 16 runs in a shuffled
  balanced order (8 OFF / 8 ON), renderer selection confirmed from the `ArtSkinPerf` log every run, and the
  tap confirmed as an accepted exit (header 250 → 249 left):
  static recording `buildMs` OFF median 0.24 [0.19..1.05], ON median 2.45 [1.86..2.85] — ranges do not
  overlap; the ~2.2 ms cost replicates. Frame p50 OFF 22.0 [12.9..45.8] vs ON 32.7 [13.2..45.6] ms and p95
  OFF 27.1 vs ON 49.8 ms with 44–60 of 78 slots filled: ranges overlap completely, host load 8–12 with a
  second emulator running, so exit-frame cost remains **UNVERIFIED** (suggestive of a regression, not proof).
- The diagnostic APK holds the real ad-unit ids (not a test-ads build); it is a PERF build and `App.tsx`
  returns before ad start-up under PERF_MODE, and no banner appears in any capture — inferred safe from
  reading the code; the ad logs were not retained.

Findings the report does not list:
1. `modules/arrows-board/android/build.gradle` adds `artifacts/ART-SKINS-01/runtime` as an asset source
   unconditionally, so every build made on this machine, including a Play AAB with the flag OFF, would
   package the 1.3 MB unapproved atlas (the spike APK lists `assets/cinnamon-roll.png`). Gate it on the
   flag/env or keep it out of the tree. (Inferred from the Gradle line; no flag-OFF release was built.)
2. Dense boards: on level 3828 (250 arrows) the textured arrows read as an orange mass next to the flat
   OFF capture; the skin needs a cell-size threshold below which it falls back to a simplified look.
3. At 38 dp: a dark border shows at every tile boundary, the tail face rotates with the arrow (sideways
   and upside down), and thin stray lines sit beside several bends.
4. Flag-OFF native path also changed (every arrow keeps its coordinate array; `ExitSlot.clear()` allocates
   an empty array per exit). Small, but not measured against the pre-change APK.
5. `CinnamonSkin.load` decodes the 1024² atlas inside `stateLock` on the prop thread (flag ON only).
6. The benchmark left `wm density 480` on the AVD (reset by the reviewer).

Disposition (owner approved, 2026-09-30): docs, check scripts and the default-OFF flag are committed; the
render spike (patch 01: native renderer, JS props, types, Gradle asset line) was reverse-applied out of the
working tree so release builds are clean. It is preserved as `artifacts/ART-SKINS-01/patches/01-android-render-spike.patch`
(not committed). `ART_SKIN_TEXTURED` has no reader in the tree until a corrected spike returns.

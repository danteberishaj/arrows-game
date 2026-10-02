# ART-SKINS-08 — Launch skin polish, faces, caterpillar and play-area tints

2026-10-02. **Implementation, checks, captures and eight-style opening measurements complete. Default OFF. OWNER REVIEW PENDING. No ship decision.**

Started from clean `a4fa1661047241dd4df5301109fd5155f78d44a4`, applying the exact authorized
ART07b `skin-catalogue-code-on-a024ba6.patch`. Node v20.19.4; Expo ~57.0.18 (versioned v57 docs read
before edits); local Android test-ads/PERF only. Only `emulator-5556 / fleet_floor_api31` is operated;
the other session's 5554 is untouched. No commits, push, EAS, image assets, new skins or saved-ID changes.
All 17 original META flags plus the picker are enabled in ON tests. Display remains 1440×3120 / 560 dpi;
the dense real opening cell is **29.387754 dp**, index 3827 / displayed level 3828.

Eight data recipes receive .48 rim / .425 body, .44 head half-width, .46 tip bound and .10 circular
corner radius. Accents and nested band widths scale with the fill. Face dimensions are .045 eye radius,
.13 half-gap, .12 mouth width and .11×.06 blush. General optional fields preserve legacy defaults.
Critter uses .52 bead diameter including rim, .5 pitch and .30 connecting body tube. Its shine remains
centred. All owner-picked starting tints are retained, confined to the play area. Header, menu and panels
retain the theme palette. Critter/Campfire head faces are permitted on one-cell heads; all one-cell tails
remain absent. No head-face cache or interaction/idle-motion change was introduced.

## Acceptance ledger

| Requirement | Current evidence / status |
| --- | --- |
| Registry and scope | PASS: exactly eight changed spec JSON records; nine unchanged records, all numeric IDs/order preserved (`checks/spec-diff.json`). |
| Native K1–6/K8 + existing extras | PASS on 21 levels × 17 specs: 285,930 layer-path slots (including expected-empty paths), zero fit/head/join failures; 7,633 one-cell checks; 5,676 centred straight-shaft checks; 441 displaced feature controls rejected. K7 is a separate report-only measurement below. |
| Enlarged face clearance and optional-field controls | PASS: 7,574 face-arrow cases, each checking open and blocked eyes/mouth, including 898 one-cell head faces. 483 native damaged-field controls rejected, including explicit disconnected-bead Region components >1; TS rejects outline-coloured tint. Final local skinTest diagnostic rerun passes. |
| Unchanged paths outside polish | PASS: 133,434 unchanged arrays; only permitted fold slots change, 3,588 crease paths total across Paper Craft, Stained Glass and Archery. |
| Frozen negative controls | ART03 fails 17,191/23,298 fit paths; frozen ART04 Cinnamon exposes 449 oversized one-cell rolls. |
| Contrast | Required outline/blocked/missed/overlay text rows PASS against actual tints. Grid texture retains the pre-existing R4 decorative exemption, with actual composited ratios saved; no required threshold weakened. Ink Pro is labelled best in light; its actual outline passes both themes. Neon/Lava retain genuine preferred-dark exceptions. |
| Tests | PASS: 119 suites / 2,062 tests / 12 snapshots; TypeScript exit 0. Initial 21 polish assertions fail on the restored starting tree (`checks/base-red.txt`). |
| Before/after visuals | PASS artifact delivery: 24 actual player viewports, native whole boards and 38 dp fixtures; light/dark before-after sheets for eight polished and four carried 07b styles. Each dense crop has seven complete one-cell arrows. OWNER REVIEW PENDING. |
| Phone recording / style + theme restart | PASS: ordinary test-ads recording, five accepted Critter clears including one-cell, blocked eyes close/reopen, Cinnamon dark style/tint kept after force-stop/relaunch. PERF theme persistence is intentionally isolated. |
| Opening data | COMPLETE: 8/8 styles, 12 shuffled native OFF/ON pairs each (192 opens / 96 pairs). Every timed pair uses the selected tint at 29.387754 dp; exact flags, selection XML and paired screenshots verified. 8/8 historical +16 ms budgets FAIL (report only). |
| Exits / performance neutrality | UNVERIFIED: another emulator runs and host load exceeds 4. No exit percentiles. |
| OFF null control / assets | PASS: base/base reinstall 0 changed pixels / max delta 0; base/OFF 0 / 0 across the full play-area ROI. Same 15 assets; OFF no picker/tint/skin logs; final normal APKs contain no diagnostic classes. |
| Build process rule | CORRECTED WITH EARLIER VIOLATION: the inherited runner initially assembled test-ads diagnostics via the `release` variant. Raw early logs remain under `checks/rejected/initial-inherited-release-*`. The runner now uses a temporary local optimized `skinTest` variant, restoring Gradle/manifest afterwards; final test APKs use that variant. No AAB or production-ad build was made. |
| Runtime patches | PASS: forward on a4fa166 and inverse, clean-archive applicability and byte round-trip (`checks/runtime-patch-verification.json`). The durable docs/checks companion is regenerated from final learning and tools; clean-archive forward/companion/inverse byte checks are saved in `checks/patch-series-verification.json`. |

## Controller review

2026-10-02, controller. **Verdict: APPROVE as a default-OFF look check and as the content of a phone test build.
Not ship-ready: performance is UNVERIFIED and the owner has not judged the look.**

| Check | Register | Evidence |
| --- | --- | --- |
| Patches reproduce the delivered tree | Executed | `git archive a4fa166` into a scratch repo, applied `skin-code-on-a4fa166` + `learning-and-checks-on-a4fa166`; `diff -rq` against the working tree found no source differences. |
| Jest + tsc | Executed | On the full ART08 tree: tsc exit 0; 119 suites / 2,062 tests / 12 snapshots pass. Covers spec values, registry scope, tint contrast and picker rows; it does not cover native drawing. |
| Look | Executed (viewed) | Both before/after contact sheets, four phone-size captures and four frames of the recording. The recording shows a Critter board with faces on one-cell arrows, Settings reading "Arrow style: Critter", and the dark menu after restart. |
| Native K1–K8, face clearance, path equivalence | Read, not re-run | `checks/` JSON. Emulator-5556 was stopped and host load was 9–13, so the device contract was not repeated. |
| Flag OFF pixels | Read | Base/base and base/OFF are both 0 different pixels. All three captures hash to `c80e88fb…`, the same hash as ART07's OFF capture. So ART07's 316-pixel difference came from that round's base capture, not from the skin code. |
| Renderer cost of the new art | Read | `SkinPaths.kt` differs from 07b by 66 lines; the rounded head is direct fillets with no new boolean path operations. The skinTest variant is `initWith release`, so it is not a slower build type. |
| Opening cost | UNVERIFIED | ON medians are 143–407 ms, but Classic OFF medians are 31–48 ms in the same batches versus 5–9 ms in ART07, on a host with 11.8 GB swap in use and load 8.6–25. The instrument was about six times slower this round, so these numbers neither clear nor condemn the skins. Do not compare them with ART07. |
| Exits / smoothness | UNVERIFIED | No quiet host. The owner's phone is the next measurement. |

**Out of scope:** a temporary `skinTest` Gradle build type in the build runner (the brief's "no release build"
non-goal was read as forbidding the release variant for test APKs; harmless, tooling only), and a shell-side
accessibility reader `scripts/art/ArrowsHierarchy.java` used by the capture harness. Neither ships in the app.

**Look findings for the owner (taste):**

1. **Cinnamon Roll / Strawberry Glazed:** the larger eyes now sit on top of the roll's spiral. At 29 dp the roll reads
   as a dark cluster rather than a face. Options: smaller eyes on tail faces (about 0.03), or drop the inner turns of
   the spiral behind the face.
2. **Critter:** on long arrows the white shine runs up to the eyes. Stop it one cell before the head.
3. **Heads look stubbier** now that bodies are 0.48 wide against a 0.88 head. Direction is still clear in every crop
   I checked, including one-cell arrows.
4. **Archery:** the pale fletching is nearly invisible on the light board. Direction now reads correctly.

**Open risks.** (a) Codex's first capture after the native first draw was blank apart from the tint, and the art
appeared in a later capture. If that delay is real on a phone, a level would open as an empty tinted board for a
moment. Watch for it in the phone test. (b) A picker choice appeared to revert after a hard emulator shutdown
(cause unproven, likely an unflushed write). Ordinary kill and relaunch keeps the choice. (c) `skinDiagnostic`
logging still fires in every picker build.

**Strongest case against approving:** if the 143–407 ms opening medians are real rather than host contention, every
level open stalls visibly. I could not disprove that on this host; the renderer diff and the six-fold slowdown
of Classic in the same batches argue against it. The phone build settles it.

## Corrections and evidence boundaries

The first enlarged face at the original head centre failed .03-cell clearance for downward Critter arrow 1.
Moving an upright head face towards the broad base with general `face.headOffset: -.12` fixes all four
orientations without clipping. The raw red result is retained in `checks/rejected/head-face-clearance-before-offset.txt`.
The test erodes the filled cap/roll independently, then subtracts that region from open eyes/mouth and
closed eyes/mouth. Both must be nonempty and leave no remainder. Owner face taste is not established by fit.

The crease now bisects actual incoming/outgoing bend tangents, including rotation/reflection; it no longer
uses one world diagonal. The path comparison freezes the starting renderer and permits only the fold slot
for the three declared crease styles. All other slots and simple/closed-eye paths remain equal. Colours
outside the eight polish recipes are also byte-identical to the applied 07b source.

The tint prototype initially propagated the game palette more broadly and hit existing header/panel
contrast roles. That prototype was not kept. Current tint ownership is the board palette only, matching
the requested play-area scope. Contrast audits the actual tint for the required board feedback/overlay
roles and records grid dots at their existing .4 alpha; decorative-grid exemption predates this task.

### Retained optimization mechanisms

The inherited ART07 shared relative templates, lazy strip decoration, audit-path suppression, tail-face/
spiral reuse, rounded-centreline reuse and nested directional caps stay in place. Complete first draw
includes lazy geometry; it is never hidden behind the preparation number. An enlarged cap is built via
the same directional cap cache. No cache speedup is claimed solely from changing the art.

Critter's declared pitch reduces the exact circle additions in the dense 57-template set from 2,298 to
1,202 across rim/body (53 non-singleton templates). This is a construction-count reduction derived from
the exact Manhattan lengths and two silhouette layers, not a measured percentage speedup. The larger
beads and connected tube deliberately change the output. `checks/bead-work-counts.json` records the method.

## Reproduction and artifacts

Set `ART_SKINS_DIR=artifacts/ART-SKINS-08` for the generalized data/build/contract/capture helpers. Generate
fixtures with Node 20.19.4 and `scripts/art/skin-contract-data.cjs`, compare registry scope with
`skin-polish-data.cjs`, build the diagnostic test APK with `build-skin-catalogue.py contract`, install only
on 5556, then run `run-skin-contract.mjs after`, `polish` and `before`. Diagnostics are temporary APK-only
classes. The normal APK checker rejects every diagnostic class and non-test unit ID.

Original captures and crop bounds/source hashes are in [screens](../../../artifacts/ART-SKINS-08/screens/)
and `polish-contact-manifest.json`; native results and red controls in
[checks](../../../artifacts/ART-SKINS-08/checks/); measurements in
[perf](../../../artifacts/ART-SKINS-08/perf/). The native capture filenames retain the generalized tool's
`art07-after-` prefix; the artifact directory and manifest identify their ART08 source. Frozen ART03
captures are negative-control evidence, not the requested ART07-before look.

## Per-style changes and contract

All heads below: half-width .36→.44, tip .43→.46, back .42 unchanged, true corner radius 0→.10.
The source triangle tip angle is 2×atan(.44/.88)=53.13°, below 80°; all three circular fillets use .10.
Faces on Cinnamon, Critter, Campfire and Strawberry: eye .018→.045, half-gap .085→.13, mouth .08→.12,
blush .08×.045→.11×.06 (Campfire blush remains disabled). Head faces add offset −.12; tail faces stay centred.
All new board tints equal the owner-picked starting values; no tint was changed to loosen an audit.

| Spec · ID | Rim old→new | Body old→new | Face / new general fields | Contract | Draws incl. mark | Opening ON med/max ms (n; cell dp) |
| --- | --- | --- | --- | --- | ---: | --- |
| Cinnamon Roll · 1 | 0.38→0.48 | 0.33→0.425 | sized tail face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 8 | 407.276/3484.126 (12; 29.387754) |
| Sherbet · 2 | 0.4→0.48 | 0.34→0.425 | no face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 5 | 313.764/6884.052 (12; 29.387754) |
| Candy Gloss · 4 | 0.37→0.48 | 0.315→0.425 | no face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 5 | 194.023/1288.576 (12; 29.387754) |
| Jelly · 5 | 0.38→0.48 | 0.315→0.425 | no face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 5 | 152.776/750.299 (12; 29.387754) |
| Critter · 6 | 0.4→0.48 | 0.35→0.425 | sized head face + offset; cornerRadius, board, beads | K1–6/K8 + extras PASS; K7 report-only | 6 | 251.301/893.839 (12; 29.387754) |
| Rainbow Ribbon · 12 | 0.44→0.48 | 0.395→0.425 | no face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 8 | 142.712/287.789 (12; 29.387754) |
| Campfire · 15 | 0.43→0.48 | 0.38→0.425 | sized head face + offset; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 8 | 377.476/1155.262 (12; 29.387754) |
| Strawberry Glazed · 17 | 0.38→0.48 | 0.33→0.425 | sized tail face; cornerRadius, board | K1–6/K8 + extras PASS; K7 report-only | 8 | 287.810/1868.602 (12; 29.387754) |

Carried 07b rows: Archery 9 (7 draws), Ink Pro 3 (4), Clear Glass 13 (6), Paper Craft 8 (6) pass
K1–6/K8 and extras; Ink Pro’s declared light preference has **zero** actual non-gating outline failures.
Data/path changes: eight launch specs; fold slot only additionally changes Paper Craft, Stained Glass and
Archery. Yarn, Pixel, Neon Glass, Lava Rock, Ink Pro and Clear Glass retain all original path arrays.
Classic is verified separately by the exact OFF capture. Native code has no skin-id branch.

## Visual and interaction delivery

[Light before/after](../../../artifacts/ART-SKINS-08/screens/contact-before-after-light.png) ·
[Dark before/after](../../../artifacts/ART-SKINS-08/screens/contact-before-after-dark.png) ·
[Phone recording](../../../artifacts/ART-SKINS-08/screens/critter-clears-cinnamon-dark-restart.mp4).

The 29.39 dp after crops come from the real player viewport; 38 dp fixtures and whole-board images
are native diagnostic captures. The manifest saves source hashes, identical world crop bounds and
coordinate transforms. The dense crop contains seven complete one-cell arrows (indices 174, 180, 191,
192, 203, 214, 243). Each style/theme also has a labelled `*-one-cells-2x.png`; the whole native
38 dp fixture includes all four one-cell head directions. ART07 captures are the requested before
source; carried 07b fixes therefore appear in the after column. OWNER REVIEW PENDING.

The phone recording is 54.497367 seconds, 720×1560, 1,766 decoded variable-rate frames.
It verifies real radio selection, five accepted arrows (250→245), one blocked tap (250 unchanged),
a one-cell clear and Cinnamon/light→dark/restart persistence. The retained blocked-eye contact shows
open eyes, closed arcs during red feedback, then open eyes. This is **not** timing or smoothness evidence.
The camera pans to expose an accepted one-cell arrow; scale stays 29.387754 dp. No save data was edited.

## APK and OFF proof

Final variants are optimized local `skinTest` test-ads APKs: ON capture, OFF capture, PERF measurement,
ordinary phone test and temporary diagnostic. Exact APK/bundle hashes, byte lengths, variant and flag
manifests are in `checks/apk-provenance.json`. The final diagnostic reuses the freshly rebuilt PERF
bundle: flags and bundle hashes are equal. Equal ON/OFF byte counts do not mean equal bundles.

Normal ON/OFF/PERF/phone/base APKs share the exact same 15 asset names and use only test unit IDs.
The phone APK has all 17 META flags + picker and a dev jump to index 3827, without PERF isolation.
Install by replacement, **without uninstalling**. The old base APK comes from ART06; a runtime-path diff
from its base 1d61234 to current HEAD is empty. Captures cover ROI [0,305,1440,2952], including background.
Both internally stable samples of each APK are identical. `checks/off-verification.json` records
zero different pixels/max delta 0 for base/base and base/OFF. This does not explain ART07’s historical
316-pixel failure; that failed gate remains in its report.

## Opening experiment: boundary, setup and incomplete attempts

Both native ON/OFF arms use the exact PERF APK and all original META flags plus picker. The real
picker is first seeded in the menu-start capture APK without editing saves; replacing it with PERF
preserves the selection. Both timed arms therefore use the same selected JavaScript board tint;
OFF overrides native art with Classic. This is distinct from the separate gate-unset exact pixel test.
Each complete batch has 12 pairs, six in each order, at 29.387754 dp. The owned emulator is booted
with the same display and host graphics, then settles 20 seconds. Cinnamon's completed batch uses
a fresh same-config boot after untimed setup troubleshooting; its policy is saved in the raw JSON.

The headline is the per-open sum of native construction, all initial native prop setters, retained
preparation, strip recording and the **full** first draw. Lazy template construction/merging is inside
first draw. JSON/cell/base parsing is nested in prop setup. Do not add phase medians/maxima or nested
parsers to the headline. These are elapsed native-owned costs, not React/font/navigation wall time
or GPU completion. There is no comparable output-preserving ART07/ART08 A/B speed percentage.

Failed setup/opening attempts are retained in `checks/rejected-opening/`. Standard idle hierarchy
reads timed out with existing menu/panel motion; cold accessibility connections sometimes returned
no root. The actual API31 framework jar/disassembly verifies the shell helper’s dump→root call chain has
no explicit global-idle call (`checks/hierarchy-driver/no-idle-verification.json`). It can still
stall on root/tree/binder reads. The shell-only reader waits one second for connection readiness, reads fresh roots and
requires newly observed settled radio bounds. It is never packaged in a phone APK. Successful
Cinnamon and Sherbet selections establish that method can work, not that this host is stable.
A separate rejected Sherbet opening logged camera readiness but no native setup/first draw before
the old 17-second window expired. The harness now waits 240 polls with .5-second pauses plus command time
for the complete native opening; slow accepted timer values remain intact. Reader/setup bounds are
also extended, with no animation setting change. Final accepted/rejected counts remain in raw logs. Later radio scrolling reuses the just-read
unchanged tree for scroll bounds, avoiding a duplicate accessibility connection; the next state and
checked selection are still freshly read. A host snapshot at 02:42 UTC records 11,769.81 MiB swap in
use and load 18.54. VM counters are cumulative, not a measured paging rate or a skin-specific cause.
Jelly's rejected first setup returned a non-null but empty RN container after the fixed 12-second
delay. The second setup uses bounded fresh reads until Settings exists; its `-0.xml` has no controls
and `-1.xml` contains the actual menu. This verifies the readiness correction, not a startup cause.
The corresponding startup log remains in `checks/jelly-readiness-log.txt`.

An initial Rainbow picker snapshot after the owned VM restart showed Jelly checked, despite the
preceding Critter batch's checked selection and correct Critter tint in both timed arms. The cause
is unverified; guest/host filesystem buffering around VM termination and setup input/reader state
are hypotheses, not a save-code diagnosis. This was after navigation taps, not an isolated read of
the preference before any input. During later scrolling a Paper Craft check was also observed before
the final Rainbow check, so intermediate setup input is a real confounder. Later batches drain guest filesystem buffers with `sync` **after** all timed samples and
record `guestSyncAfterBatch`. Later initial-picker snapshots record the visible choice after navigation,
before the intended style selection, for comparison.
Campfire’s first-picker checked list is empty because the prior high-index choice is offscreen;
that is not evidence of a missing/default preference. Later radio-search snapshots retain observed
checks around scrolling. Strawberry's fresh scans 2–5 show Campfire checked before the intended
Strawberry selection; its post-selection scan shows Strawberry checked. This successful owned-VM
transition does not isolate the earlier cause or prove `sync` corrected a save bug. The shutdown
hypothesis remains INCONCLUSIVE unless input/visibility are isolated.
No save value is read directly or changed by this control. Ordinary app kill/relaunch persistence is
already verified by the phone recording; it does not certify a hard emulator shutdown.

ANR traces show the app main thread in native renderer submission alongside substantial scheduling
waits; they do not establish a GPU deadlock or skin-specific cause. The same host also had a default
system-service ANR. One adb-root diagnostic interrupted an outstanding UI read; that agent mistake
is explicitly quarantined in `dialog-wait-invalidated.txt`, rather than attributed to the app.
After restoring uid 2000 and ending that read, the dialog selection recheck passed. No other session's
emulator/process was operated.

Cinnamon's completed 12/12 batch currently reports native opening ON median/max **407.276/3484.126 ms**,
Classic OFF **47.958/253.428 ms** at **29.387754 dp**. The historical +16 ms aggregate budget fails.
Its lazy geometry/merge median/max is 324.649/2662.875 ms; first-draw remainder 15.669/43.396 ms.
Host load is 11.83–18.15 with another emulator. This is a measured cost under contention, not a
verified phone regression or performance-neutrality result. Sherbet also completes 12/12: ON median/max 313.764/6884.052 ms; OFF 35.851/165.863 ms, same 29.387754 dp. Its historical +16 ms budget fails. All eight completed style results are in the tables below.

<!-- ART08-OPENING-TABLES-START -->
## Complete opening tables

| Spec | ID | Cell dp | n ON/OFF | Prep med/max ms | Record ON med/max ms | Record OFF med/max ms | First draw med/max ms | **Total ON med/max ms** | Total OFF med/max ms | Paired overhead med/max ms | Historical +16 ms |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cinnamon Roll | 1 | 29.387754 | 12/12 | 57.034/789.039 | 0.777/16.847 | 2.381/10.301 | 341.635/2687.665 | **407.276/3484.126** | 47.958/253.428 | 319.247/3382.826 | FAIL (report only) |
| Sherbet | 2 | 29.387754 | 12/12 | 73.587/3924.809 | 0.220/12.309 | 0.764/11.214 | 219.540/2959.039 | **313.764/6884.052** | 35.851/165.863 | 271.150/6853.823 | FAIL (report only) |
| Candy Gloss | 4 | 29.387754 | 12/12 | 53.997/197.848 | 0.261/0.609 | 1.232/8.935 | 125.274/1090.379 | **194.023/1288.576** | 31.022/555.447 | 87.910/1255.218 | FAIL (report only) |
| Jelly | 5 | 29.387754 | 12/12 | 50.456/189.944 | 0.217/0.462 | 1.696/5.703 | 101.848/559.893 | **152.776/750.299** | 36.245/133.862 | 77.020/704.439 | FAIL (report only) |
| Critter | 6 | 29.387754 | 12/12 | 43.995/401.635 | 0.299/3.146 | 0.910/43.156 | 182.232/489.199 | **251.301/893.839** | 35.711/241.893 | 202.550/668.765 | FAIL (report only) |
| Rainbow Ribbon | 12 | 29.387754 | 12/12 | 41.728/97.512 | 0.196/0.512 | 0.840/15.618 | 104.239/237.738 | **142.712/287.789** | 31.371/93.165 | 115.027/194.625 | FAIL (report only) |
| Campfire | 15 | 29.387754 | 12/12 | 58.448/814.682 | 0.311/13.217 | 3.878/16.375 | 194.812/793.267 | **377.476/1155.262** | 36.474/183.092 | 348.458/1121.955 | FAIL (report only) |
| Strawberry Glazed | 17 | 29.387754 | 12/12 | 64.955/194.804 | 0.221/0.590 | 0.904/27.361 | 227.696/1774.661 | **287.810/1868.602** | 37.473/131.963 | 250.337/1736.639 | FAIL (report only) |

Nested setup breakdown (these columns are not additional headline costs):

| Spec | Cell dp | n ON | Construction med/max ms | All prop setup med/max ms | Selection JSON (nested) | Owned cells (nested) | Base geometry (nested) | Retained prep | Lazy template/merge (inside first draw) |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| Cinnamon Roll | 29.387754 | 12 | 0.774/13.370 | 51.073/787.541 | 5.031/35.163 | 6.687/61.191 | 25.326/473.989 | 2.215/32.442 | 324.649/2662.875 |
| Sherbet | 29.387754 | 12 | 0.590/43.521 | 62.878/3864.928 | 8.768/239.672 | 11.237/343.165 | 31.815/3044.267 | 3.837/46.328 | 207.693/2912.162 |
| Candy Gloss | 29.387754 | 12 | 0.350/4.266 | 47.460/168.497 | 2.541/27.899 | 3.573/28.007 | 22.260/89.332 | 4.543/25.084 | 119.929/1023.635 |
| Jelly | 29.387754 | 12 | 0.254/2.280 | 43.620/154.469 | 1.981/28.208 | 7.467/17.351 | 24.749/106.240 | 3.374/35.237 | 94.356/517.117 |
| Critter | 29.387754 | 12 | 0.324/3.112 | 41.342/375.564 | 4.020/29.230 | 4.897/12.961 | 23.017/214.555 | 3.245/25.831 | 173.064/410.868 |
| Rainbow Ribbon | 29.387754 | 12 | 0.232/0.537 | 36.829/93.772 | 3.218/8.154 | 5.229/33.096 | 20.219/49.321 | 3.200/9.356 | 94.968/208.274 |
| Campfire | 29.387754 | 12 | 0.460/31.696 | 53.399/648.829 | 4.666/58.291 | 7.498/306.060 | 32.406/245.603 | 6.458/165.363 | 178.986/742.139 |
| Strawberry Glazed | 29.387754 | 12 | 0.372/18.379 | 59.382/175.039 | 7.028/33.244 | 6.121/18.075 | 33.481/148.453 | 4.806/22.830 | 210.549/1624.537 |

See [per-style work and remainder tables](../../../artifacts/ART-SKINS-08/perf/style-evidence.md) and joined JSON/CSV for hypotheses and hashes.

<!-- ART08-OPENING-TABLES-END -->


## Final performance ruling and reusable next questions

All eight styles have **12 ON / 12 OFF opens** at **29.387754 dp**, 192 opens / 96 shuffled pairs.
The historical aggregate Classic +16 ms budget fails for 8/8; every style also has at least
one paired overhead above 16 ms. Host load across accepted samples is **8.60–25.38**,
with another emulator throughout. All accepted outliers remain in raw data. Exits are **UNVERIFIED,
0 accepted frames, no percentiles**. This report-only task delivers costs; it does not certify
phone performance neutrality or establish an intrinsically unoptimizable art style.

The joined data saves actual spec fields, old/new dimensions, contract results, native construction
counts, complete sums, nested phases, source hashes and one next question per style. Cinnamon and
Strawberry: isolate zero-amplitude ribbon/fade construction from merging. Sherbet, Candy and Jelly:
isolate layer/template merging from base and prop setup. Critter/Campfire: test at most four
directional upright face templates against today's 57 constructions, retaining exact open/closed
output and .03 clearance. Rainbow: isolate nested-band merging after existing directional cap reuse.
These are hypotheses; elapsed timers include scheduling/GC waits and do not isolate feature cost.
No defining art, detail tier or input is removed to manufacture a pass. The renderer
retains lazy strips, shared relative templates and existing bounded cap/tail caches.

There are **11 quarantined incomplete/setup attempt directories** in
`checks/rejected-opening/attempt-index.json`, plus separately retained reader/ANR/agent-error diagnostics.
They are excluded because they lack a complete paired native opening, not because of slow accepted
times. Early release-variant diagnostics remain a process violation; final APKs use skinTest.
Owner look review, quiet-host exits, phone performance neutrality and the earlier owned-VM
persistence cause remain pending/unverified. All required geometry, tests, exact OFF and delivery
checks pass; the report-only opening budget failures are explicit.

## Final ordinary-build restoration and visible-art control

The ordinary test-ads phone APK is restored without uninstalling or editing saves. The real picker
checks Cinnamon; the actual level 3828 board is dark with 29.387754 dp cells. Display stays
1440×3120 / 560 dpi, all three animation scales are 1 and adb is uid 2000.
`checks/final-restoration.json` records selection, tint, visible rim/dough counts and the capture hash.
The first redundant menu hierarchy read timed out; its raw failure and fresh menu screenshot are
retained. Recovery used the inspected menu's actual Settings control and freshly checked radios.

The immediate post-native-draw capture was blank apart from tint, despite logs for 250 arrows,
full-detail Cinnamon and complete first draw. The later settled capture contains **150,579 exact
rim pixels / 1,078,529 dough pixels**. This is a presentation distinction, not a measured latency
or diagnosed GPU fault. The checker now requires visible opaque spec rim in ON captures, separately
from the selected tint in both arms. All eight paired timing screenshots contain >150,000 exact
rim pixels; the retained `screens/restoration-before-visible-art.png` is rejected as a blank control.
Native opening timers retain their submission boundary. No opening sample or outlier was replaced.

After restoration and guest filesystem sync, the exact recorded task-owned 5556 process is stopped
gracefully to release its host resources. The installed ordinary APK and preference remain in the
AVD; no other session's emulator is stopped (`checks/owned-emulator-cleanup.json`). The runtime
remains applied in the checkout with the picker default OFF. Final forward/companion/inverse byte
checks and file hashes are in `checks/patch-series-verification.json` and `checks/deliverable-ledger.json`.

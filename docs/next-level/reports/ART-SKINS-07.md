# ART-SKINS-07 — Canvas skin catalogue on the shared renderer

2026-10-01–02. Author verification complete with failed/unverified gates below. **Default OFF. OWNER REVIEW PENDING. No ship decision.**

Base `bad7903728743bbe5548e9035d7e60f8ae7ce945`; applied the exact requested ART06 `skin-picker-code-on-1d61234.patch`. Node v20.19.4; local test-ads/PERF only; emulator-5556 / fleet_floor_api31 only. Emulator-5554 belongs to another session and was left untouched. No commits, push or EAS. Physical display 1440×3120 / 560 dpi; dense index 3827 (display level 3828), real opening cell **29.387754 dp** with all 17 original META flags plus the picker flag.

The single TS registry appends stable IDs 3–17 in the requested order. Shared features extend the existing renderer rather than branching by skin ID. Saved 0/1/2 retain Classic/Cinnamon/Sherbet. Every registered procedural spec renders one-cell arrows as head only; Classic retains its legacy flat geometry. New styles use the established motion data; no idle animation, blur/displacement/turbulence filters, particles implementation or image assets.

The [canvas SkinBoard table](https://claude.ai/artifact/BLpq6sX8RZ4GfknZk22xQP) was read through its rendered artboard and DOM-provided source. Source palettes/body widths/detail vocabulary inform the data; fit, centred accents, meaningful outline contrast and the eight-draw limit constrain translation. Raw checks/captures/build flags and measurements are under [ART-SKINS-07 artifacts](../../../artifacts/ART-SKINS-07/).

## Acceptance ledger

| Item | Status |
| --- | --- |
| Catalogue/order/save IDs | Targeted tests PASS, including restart for all 18 choices and byte-preserved existing keys. |
| Native K1–K8 + feature controls | PASS: 21 levels × 17 specs in the final matrix (unchanged 16 specs from the full run, revised Rainbow from its fresh 21-level run), 285,930 filled paths; zero fit/head failures; 441 deliberately damaged feature fixtures rejected. K4 dark-preference light exceptions retained honestly. K7 report-only below. |
| Whole boards/contact sheets/38 dp fixtures | Generated/verified: 36 labelled cards, 36 actual viewports, 36 native whole boards and 36 native 38 dp fixtures. OWNER REVIEW PENDING. |
| Light/dark picker, ≥5 switches, restart | PASS: 18 full radio rows per theme; six styles including Classic, Classic restart and separate non-default ID 17 restart. 6,344 encoded frames. OWNER REVIEW PENDING. |
| Complete opening, ≥12 shuffled OFF/ON pairs per spec | COMPLETE: 408 opens / 204 pairs, same final PERF APK, stable system_server per accepted batch, 29.387754 dp. Historical +16 ms: 3 PASS / 14 FAIL; report-only. Performance neutrality is NOT verified. |
| Exit frames | UNVERIFIED: host load >4 and another emulator running. No percentiles. |
| Jest all + tsc | PASS: 118 suites / 2,033 tests / 12 snapshots; tsc exit 0. Catalogue red first: 2 failed assertions on restored ART06. |
| Separate OFF APK / 15 assets / pixel identity | APK audit PASS: identical 15 asset names, nine official test ad IDs, no diagnostic classes. Final exact native OFF pixels FAIL: 316 stable edge pixels differ, max channel delta 5. No tolerance waiver. |
| Future-art evidence / prompt | Saved per-style phase/work/recipe data with raw hashes, tested join script, reusable generation prompt and synchronized guide/lessons. No unmeasured “cannot optimize” labels. |

## Retained rejected attempts

- `checks/base-red.txt`: new catalogue test on the exact restored ART06 base, two failed assertions and two passes. Missing 15 entries and missing declarative features are real red controls.
- `checks/rejected-build-metaspace.txt`: R8/lint exceeded the previous 512 MB metaspace setting. Process-only 1 GB metaspace / 3 GB heap fixed the build. Later builds use temporary daemons and in-process Kotlin compilation to release owned workers; no shared Gradle settings were changed.
- `checks/rejected-emulator-watchdog.txt`, `checks/rejected-framework/`: Android framework/package services stalled initial installation. Failed startup attempts are excluded. A cold boot and explicit successful installation recovered the permitted emulator; a real surface probe has valid pixels. No other emulator was restarted/stopped.
- `checks/rejected-long-command/`: the dense expanded Base64 fixture exceeded the remote shell argument transport limit (`error: closed`), after 20 campaign negative controls succeeded. Test transport now pushes diagnostic JSON into the app external-files directory and passes a short instrumentation switch. This is not a geometry result.

## Controller review

2026-10-02, controller. **Verdict: APPROVE as a default-OFF look check — not ship-ready.** Owner appearance
review is pending for every new style; the opening budget still fails for 14 of 17 specs.

| Check | Register | Evidence |
| --- | --- | --- |
| Patches reproduce the delivered tree | Executed | `git archive bad7903` into a scratch repo, applied `skin-catalogue-code-on-bad7903` + `checks` + `docs`: `diff -rq` against the working tree showed no source differences. |
| Jest + tsc | Executed | On the full ART07 tree: tsc exit 0; 118 suites / 2,033 tests / 12 snapshots pass. This covers registry order, ids 3–17, save round-trip and picker rows. It does not cover native drawing. |
| Native contract K1–K8 | Read, not re-run | `checks/contract-summary.json`. No emulator-5556 was running (only another session's 5554), host load was 11–22 and 5.4 GB disk was free, so the device run was not repeated. |
| Flag OFF: the code path | Read | With `skin == null`, `ArrowsBoardView.kt` takes the original shaft/head/mark/exit branches; JS adds no props when `skinPickerEnabled()` is false. |
| Flag OFF: the pixels | Executed analysis of Codex's captures | 254 of the 316 differing pixels are one antialiased column (x=918, y 2654–2908) of one vertical shaft edge, changed by 1/255 (`(94,93,102)` → `(95,94,103)`). The rest are scattered edge pixels in the lower right. **Hypothesis:** a sub-pixel camera/settle float difference between launches, not a draw change. **UNVERIFIED:** the null control was never run. To resolve it: install the base APK, capture, reinstall the same APK, capture again, and compare. If base-vs-base also differs, the exact-pixel gate cannot detect anything at this level. |
| Exits / smoothness | UNVERIFIED | No quiet host. |

**Out of scope:** an optimisation pass (lazy audit paths, cached faces/spirals/band heads), verified by
220,278 path and 4,284 exact-pixel equivalence checks. Also two new docs, `performance-recipes.md` and
`GENERATION-PROMPT.md`. The report says the owner asked for these. They do not change the drawn output, and both are kept.

**Look findings for the owner (taste, from the contact sheets):**

1. **Archery:** the saturated orange fletching reads as a second arrowhead pointing backwards at 29 dp, while
   the real head is pale grey. This is a **direction-legibility** risk in a game where direction is the whole input.
   Recommended fix: a fletch colour quieter than the head, or a notched (V-cut) fletch shape.
2. **Ink Pro in dark mode:** black fill on a near-black board leaves only a thin grey outline, so the arrows look ghostly.
   Either use the theme ink fill in dark mode or declare `preferredTheme: 'light'`.
3. **Clear Glass in light mode:** white fill on a white board with a thin rim looks faint. Declare it best in dark, or use a stronger rim.
4. **Paper Craft:** the long horizontal tube shows a diagonal crease that looks like a glitch, and the dark-mode vertical tube is
   plain white with no fold. These are minor.

**Risk line.** Strongest case against approving: Strawberry's opening maximum was 884 ms and Lava's 280 ms. If either is
real on a phone, it is a visible hitch on level open. These are maxima on a host with load 5.7–27 and are not
reproduced on a quiet host. That is why this verdict excludes shipping any skin. A smaller issue:
`skinDiagnostic` turns on for every picker build, so the `ArtSkinPrep`, `ArtSkinFirstDraw` and `ArtSkinDraws`
logs fire in normal picker builds, not only under the test intent. Gate them on `openingTraceEnabled`
before any picker build ships.

Code was moved out of the tree with `patches/skin-code-removed-from-tree.patch`. The runtime is back at HEAD,
and the docs and tooling are committed. A backup tarball of the tree is in `artifacts/ART-SKINS-07/controller/`.


## Catalogue and canvas translation

All geometry is data on the common renderer. Widths are cell fractions, not copied source pixels.
The canvas offsets and filters are intentionally translated into centred accents and contained geometry.
Every procedural one-cell arrow is head only. No body fill was darkened to meet K4: the **outline** carries it.

| Spec | numericId | Shared types used | Contract K1–K8 + extras | Opening med/max ms at 29.387754 dp | Difference from canvas and reason |
| --- | ---: | --- | --- | --- | --- |
| Classic | 0 | existing flat renderer | Legacy reference, no procedural spec | Paired OFF values below (n=204 total) | Unchanged; no procedural approximation. |
| Cinnamon Roll | 1 | roll/face, side stripe, centred ribbon  K1–6/K8/extras PASS; K7 report FAIL | 28.305/99.738 (n=12) | Preserves ART06's corrected current look, including the separate oval. |
| Sherbet | 2 | cycle palette, rounded head, dot, shine  K1–6/K8/extras PASS; K7 report FAIL | 24.475/71.789 (n=12) | Preserves ART06's corrected centred shine. |
| Ink Pro | 3 | swept head, tailFill/dot  K1–6/K8/extras PASS; K7 report PASS | 16.807/24.401 (n=12) | Medium grey outline is visible in dark mode; black fill and violet tail remain. |
| Candy Gloss | 4 | length palette, shadow, shine  K1–6/K8/extras PASS; K7 report FAIL | 18.282/44.800 (n=12) | Highlight is centred; soft shadow uses a contained offset without blur. |
| Jelly | 5 | direction palette, opacity, spots, shine  K1–6/K8/extras PASS; K7 report FAIL | 18.830/65.469 (n=12) | Bubbles stay inside the tube; no filter or offset highlight. |
| Critter | 6 | beads, head face  K1–6/K8/extras PASS; K7 report FAIL | 24.007/37.440 (n=12) | Rounded directional head replaces the source's round face cap to preserve direction; connected beads and head-end face remain. |
| Yarn | 7 | dashed seam  K1–6/K8/extras PASS; K7 report FAIL | 13.491/28.388 (n=12) | Centre stitch is deliberately dashed; no fuzz/noise filter. |
| Paper Craft | 8 | square tube, fold, bend creases, shadow  K1–6/K8/extras PASS; K7 report FAIL | 18.985/52.359 (n=12) | Board keeps the app theme rather than source kraft background; readable outline and contained hard shadow replace faint edge/blur. |
| Archery | 9 | fletch, tailFill, headFill, two-tone fold  K1–6/K8/extras PASS; K7 report FAIL | 19.679/36.816 (n=12) | Feathers are centred on the tail cell; steel head dominates them; no decoration on one-cell arrows. |
| Pixel | 10 | square tube, step head, hard offset shadow  K1–6/K8/extras PASS; K7 report PASS | 20.659/38.732 (n=12) | Fixed orthogonal head and contained offset; centred white accent replaces the offset source accent. |
| Neon Glass | 11 | translucent glow, direction palette, shine  K1/2/3/5/6/8/extras PASS; K4 dark PASS/light exception; K7 report FAIL | 19.876/53.514 (n=12) | Wider under-stroke replaces blur; full directional cap remains readable. Dark preferred, real light contrast failures retained. |
| Rainbow Ribbon | 12 | five inset bands with matching heads, red body  K1–6/K8/extras PASS; K7 report PASS | 18.717/26.686 (n=12) | The body is the outer red band; five inset bands retain orange/yellow/green/blue/violet. Six colours use seven paints including the rim, leaving the eighth draw for the mark. |
| Clear Glass | 13 | marble, tailPalette, shine  K1–6/K8/extras PASS; K7 report FAIL | 17.608/37.669 (n=12) | Readable blue-grey outline replaces faint source rim. Tail gets a generated per-arrow colour lookup and contained shine; no blur. |
| Stained Glass | 14 | crease-only fold/lead, centred shine  K1–6/K8/extras PASS; K7 report FAIL | 21.474/34.772 (n=12) | Actual lead seam and bend creases; no dark filled half-head. Lead/rim colour is adjusted for both themes, with coloured panes retained. |
| Campfire | 15 | four bands with matching heads, head face  K1–6/K8/extras PASS; K7 report FAIL | 28.146/49.547 (n=12) | Clean contained edge replaces turbulence and blur; existing motion only. |
| Lava Rock | 16 | translucent glow, nested dashed seams  K1/2/3/5/6/8/extras PASS; K4 dark PASS/light exception; K7 report FAIL | 17.512/279.727 (n=12) | Orange outline makes the boundary visible in dark mode; cracks use two aligned strokes, not a blur/displacement filter. Dark preferred. |
| Strawberry Glazed | 17 | roll/face, stripe, spots, ribbon  K1–6/K8/extras PASS; K7 report FAIL | 24.480/884.386 (n=12) | Continuous centred pink icing and bounded blue sprinkles replace offset/dashed icing. Face/roll remain on longer arrows only. |

The picker uses registry order, 60 dp radio rows, a bounded scroll area, fixed Back control, checked states
and static spec-colour previews. Dark-preference rows have a secondary note; their sheet preview boundary
uses the current palette ink for accessible selection. That thumbnail adjustment does not falsify native
board contrast. Save code and the original 29-key schema/ownership remain unchanged from restored ART06.

## Contract method and limits

Production Android filled paths are checked with the independent Region oracle: union owned cells first,
erode the exterior .04 cell, normalise locally, rasterise at 400 samples/cell and assert every non-empty
source produces a non-empty Region. The contract also checks filled head coverage, whole body connectivity,
centred continuous primary accents contained in the body inset .03, single-cell head-only components,
head-cap area greater than tail-cap area, direct template-to-strip equivalence, ≤8 draws including the
missed mark at 10/100/250 arrows, real flat LOD and reduced-motion invariance.

Every new geometry feature has a deliberately damaged native fixture rejected by the independent fit
oracle. Nested-band checks additionally remove a matching head and must expose the missing cap; seams
must have real gaps; stepped heads must be orthogonal and a diagonal triangle is rejected. Old ART03 fit,
ART04 one-cell roll, move-only shaft fragment and concatenated-head winding regressions remain independent
negative controls. This is filled Android raster geometry, not a mathematical antialias-fringe proof.

The first narrowed-Neon run failed on six body-inset samples at a bend (`checks/rejected-neon-accent/`).
Only the spec's shine width changed from .04 to .03 cell; its .13-cell tube and the strict oracle remained.
`checks/prototype-fold/` retains Stained Glass's rejected half-head appearance. The shared `fillHalf: false`
option changes it to a lead seam. Final native checks and captures use that implementation. The final matrix joins the all-spec run with the later isolated Rainbow data rerun; both raw runs remain available.

K4 records actual ratios and `required` separately. Dark-preference light failures remain `pass: false`;
only those declared light outline rows are non-gating. Dark rows and the shared blocked-red rows still
must pass. K7 opening is **report-only in ART07**; the earlier ship budget and ART05 failures are not erased.

## Opening measurement method

The final `catalogue-perf.apk` has all 17 original META flags plus the picker flag and opens v1 index 3827.
A real non-Classic picker choice is saved first. Measurement theme is Daylight, with `-gpu host` on the Apple M1 Pro Metal translator; this is not a direct timing comparison with an earlier report’s different host/GPU state. Each cold process receives the existing generic diagnostic
JSON override for the selected spec, and OFF/ON are shuffled within 12 pairs per procedural spec (seed 20261001 gives six ON-first and six OFF-first pairs). No spec
APK, special native skin branch or new disk key is used. The same view/configuration and flat paths form
OFF. Selection and owned-cell parsing are skipped in the native OFF diagnostic as in ART05.

Headline owned opening = **construction + all native prop setup + strip recording + full first draw**.
Preparation is shown as construction + prop setup + preparation commit; recording subtracts that nested
commit to avoid double counting. Selection/cell/base-path parse times are nested diagnostics inside prop
setup, not additional headline terms. First draw includes shared-template construction, direct strip merge
and Canvas draws. Time is elapsed native work, not a presented-frame timestamp or menu-to-board latency.
Every row states the real **29.387754 dp** cell. This is a contended-host emulator report, not phone performance.

Exit samples require load <4 and the sole authorized emulator for both members of every pair, plus accepted
input/frame counts. Another session's 5554 remains running, so exit results are UNVERIFIED, zero accepted
frames, and no exit percentiles are printed. Raw host state is retained per opening run.

Native after checks also cover 7,633 one-cell arrows, 5,676 centred shaft checks, and 2,118 arrows per spec. Frozen ART03: 23,298 paths / 17,191 fit failures (expected red). Exact results: `checks/native-before.json`, `native-after.json` and per-level logs.

Capture startup rejection: `uiautomator dump` waits for idle while the existing menu Play button breathes. Settings/picker are stable and expose live radio bounds; the harness uses observed menu controls and live accessible picker nodes. No animations/display overrides were changed. `checks/ui-stall-logcat.txt` records severe surface stalls with software graphics and a busy host (the isolated cause is unproven); the task-owned 5556 was cold-booted with host graphics for actual player captures and opening measurements. Native contract captures are independent filled Canvas diagnostics.

`checks/rejected-picker-scroll/` retains a rejected recording and its navigation XML: fast swipes jumped over a partially visible radio, and the automation oscillated. Slower, smaller target-seeking swipes fixed reachability; no picker code or target size changed. Final `checks/recording-duration.json` records a 123.68 s wall interval below Android's 180 s recording cap; `recording-media.json` records 6,344 video frames / 122.958 s. The final video includes Cinnamon, Critter, Yarn, Rainbow Ribbon, Neon Glass, Classic, and the Classic restart. The separate non-default ID 17 restart is checked before any re-selection.

Rainbow iteration: the first candidate repeated the outer red band over a violet body, spending a paint on the same full-width footprint and omitting violet from the visible stack. `checks/prototype-five-bands/` preserves that candidate. The final data uses the body as outer red and five inset bands through violet, with matching nested heads. It keeps six canvas colours at the same seven paints + mark. The unchanged native renderer is rechecked on all 21 levels for the revised widths; other 16 specs/geometry are unchanged. Final picker/PERF/OFF bundles are rebuilt before accepting final measurement and Rainbow captures.

K4 also enforces the opaque-outline precondition with 17 weakened-alpha negative controls; translucent body/glow do not alter that requirement. A future transparent rim needs an actual composited contrast audit.


## Performance follow-up requested by the owner

The owner explicitly asked to optimize the skins and check for regressions, beyond ART07's original
report-only timing scope. Classic remains the paired reference and the earlier **Classic +16 ms median
and max** opening budget stays visible; no geometry, palette or motion was removed to save time.
Exit/frame signoff still requires the prescribed quiet host. Another session's emulator is not stopped.

A visibility candidate was rejected before integration. The opening trace builds all 250 arrows across
six strips, although the camera shows a narrower area. The native child retains the board-sized clip;
the parent camera transform moves it without recording the child again. Merely culling by the child's
Canvas clip does not save this work. Preparing a partial board would require new camera invalidation
and could introduce blank pan frames or cache churn (see the earlier tile rejection in the field guide).
The candidate is preserved in `checks/rejected-visible-strip/`, and is absent from the final renderer.

The bounded retained change makes geometry-audit paths lazy and creates/copies them only in audit mode.
They are not drawn or used by press/blocked/hint/exit rendering. Normal templates and every interaction
buffer now skip the extra accent/head/tail audit-path allocations and rewinds. Drawn layers, simple LOD
paths, closed eyes, template keys, palette shaders and all animation behavior stay identical. Native
verification compares production with both the frozen previous renderer and its audited version;
software pixels are checked in both backgrounds at 29.387754/38/5 dp. Timing conclusions remain pending.

`checks/perf-baseline/` retains the pre-change APK, source files, flags and partial diagnostic cold-open
pilot. Host loads around 10–15 and large first-draw spikes made it unsuitable for attributing a before/after
speed percentage; it was stopped deliberately, not presented as a completed all-spec run. A full compound
boolean-XOR attempt stalled; the cause was initially uncertain. A later bounded attempt returned
`INSTRUMENTATION_ABORTED: System has crashed`; framework logs show system_server recovery and high guest
load. Neither failed attempt is geometry evidence. After a cold boot with the same GPU/configuration,
the bounded fine-native-sample and exact-pixel checks passed for all 17 specs. The original independent Region fit contract remains intact.

Later UI checks exposed two harness assumptions: a failed accessibility dump could leave an old XML file,
and a coordinate tap could occur before the actual Settings panel was ready. Dumps now remove the old
file and require fresh successful output; input waits for settled live bounds. OFF checks must establish
the actual Settings panel before accepting absence of a picker. Earlier failed/rejected raw attempts
remain available. These harness fixes do not change the app.


Allocation correction **VERIFIED for output and allocation count**, not yet a timing claim:
`checks/native-optimization-only-3827.json` has 168 native sample comparisons and 102 exact software pixel
comparisons, with 17 displacement negative controls. At 57 shared templates per spec, normal rendering
allocates zero diagnostic paths; **285–513 unused template paths per spec** are avoided (513 for Cinnamon,
Rainbow Ribbon, Campfire and Strawberry Glazed). This count excludes additional unused strip/interaction
buffers, so it is conservative. The independent drawn-layer contract is not weakened or replaced.

The recovery preserved the AVD's disk and settings and never touched 5554. The failed attempt's cause
cannot be assigned to the boolean comparison: the bounded attempt also failed with a framework crash,
and passed immediately after recovery. Raw failed attempts and the successful result remain separate.


The second retained optimization reuses immutable static decorations: tail-anchored faces/roll spirals
are cached once at the relative template origin; matching nested-band head caps are cached per direction;
all compatible shaft accents reuse one rounded centreline per template. Moving exit art still builds its
original geometry. Caches belong to the selected renderer and clear with it; no global cross-board cache,
additional save key or per-style branch is introduced. Four move-only Yarn templates now do a centreline
preparation even though they have no stitch, preserving the exact previous output; this small cost is
included in measurement rather than hidden.

**Verified across all 21 levels / 17 specs:** 220,278 native path-array sample comparisons (including
expected-empty simple/blocked-eye slots), 4,284 exact nonempty software-pixel comparisons across both
actual themes (`#FFFFFF`/`#13111C`) at 29.387754/38/5 dp and open/closed eyes, and 357 rejected .1-logical-pixel
path-displacement controls. Final paths equal both the frozen pre-optimization renderer and audited mode.
The independent Region matrix remains valid for that identical geometry; supplemental output equivalence
does not replace its fit/feature checks. `checks/optimization-summary.json` records final diagnostic APK
provenance and dense counters. The captures precede these geometry-preserving optimizations; no art/spec
change occurred after their final Rainbow refresh.

Supplemental proof correction: the earlier helper merged full-detail layers before drawing below-flat,
leaving simple paths empty. That flat equivalence claim was invalid and is preserved as
`checks/optimization-incomplete-lod-proof/`; the independent native K5 contract remains valid. The final
helper builds the actual tier, compares simple and blocked-eye paths, and asserts non-background output
in every pixel case (269,201,210 non-background pixel samples). `checks/native-optimization.json` and
`optimization-final.txt` are the successful strengthened run. A failed final install attempt is retained
separately in `checks/rejected-final-native-start/`; the accepted run first requires an explicit successful
install (`checks/final-contract-install.txt`). No blank comparison or instrumentation on an uninstalled
APK is counted as acceptance.

At dense index 3827 / 29.387754 dp / 57 relative templates, Cinnamon and Strawberry tail faces/spirals each
drop from 53 builds to 1. Cinnamon centreline builds drop 114→57, Jelly 110→57, Lava 106→57, Strawberry
167→57. Rainbow nested head builds drop 285→20 and Campfire 228→16. Runtime geometry-audit template
paths drop to zero (285–513 avoided per spec; 6,726 across the catalogue). These are verified work counts,
not a claimed timing percentage. `checks/audit-only-candidate/` retains the intermediate APK/source and
five completed timing batches plus a rejected partial Critter batch; host/GPU state differs from the
final fresh-boot protocol, so those batches cannot establish an optimization speed percentage.

Final timing uses a fresh **same-configuration boot of the owned 5556 per spec**, a 20-second settle,
then twelve shuffled OFF/ON pairs on the same PERF APK. The wrapper verifies display and stable
system_server PID around each completed batch. Rejected/incomplete batches retain raw logs separately;
no slow accepted run is discarded. This mitigates the observed framework recovery without touching
another session's emulator, wiping data, changing animations or switching graphics backends. Host load
still appears beside the result and prevents smoothness signoff. See `measure-skin-catalogue-batches.py`.


## Final opening results — complete owned sum

Every row below has **12 ON and 12 OFF opens at 29.387754 dp**, shuffled within pairs on the same final
PERF APK. Headline is the median/max of per-run complete sums, not a sum of phase medians/maxima.
Paired overhead is ON minus its own paired OFF; negative/minimum noise is retained in the raw summary.
Historical budget compares ON median/max with that batch's OFF median/max +16 ms. Pixel's aggregate
maximum passes partly because its OFF maximum is high; its paired maximum overhead still exceeds 16 ms.
A PASS here is therefore a contextual elapsed-work result, not steady-frame or release signoff.

| Spec | ID | Cell dp | n ON/OFF | Prep med/max ms | Record ON med/max ms | Record OFF med/max ms | First draw med/max ms | **Total ON med/max ms** | Total OFF med/max ms | Paired overhead med/max ms | Historical +16 ms |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cinnamon Roll | 1 | 29.387754 | 12/12 | 11.072/35.514 | 0.115/0.147 | 0.248/3.060 | 16.689/81.509 | **28.305/99.738** | 9.140/16.617 | 20.927/88.560 | FAIL (report only) |
| Sherbet | 2 | 29.387754 | 12/12 | 10.986/14.069 | 0.081/0.513 | 0.236/0.617 | 12.275/61.064 | **24.475/71.789** | 6.354/8.185 | 18.803/66.310 | FAIL (report only) |
| Ink Pro | 3 | 29.387754 | 12/12 | 9.098/17.059 | 0.082/0.142 | 0.239/0.831 | 5.942/12.575 | **16.807/24.401** | 6.485/14.212 | 10.606/13.283 | PASS (report only) |
| Candy Gloss | 4 | 29.387754 | 12/12 | 8.228/21.017 | 0.084/0.477 | 0.214/0.789 | 9.904/23.306 | **18.282/44.800** | 6.655/26.233 | 11.770/19.325 | FAIL (report only) |
| Jelly | 5 | 29.387754 | 12/12 | 9.011/19.081 | 0.085/0.272 | 0.239/0.556 | 10.132/46.117 | **18.830/65.469** | 6.054/16.552 | 13.123/48.917 | FAIL (report only) |
| Critter | 6 | 29.387754 | 12/12 | 7.690/11.676 | 0.082/0.517 | 0.290/0.729 | 16.110/27.461 | **24.007/37.440** | 5.328/19.631 | 18.790/27.115 | FAIL (report only) |
| Yarn | 7 | 29.387754 | 12/12 | 7.672/20.517 | 0.090/0.729 | 0.230/0.890 | 5.840/10.901 | **13.491/28.388** | 6.163/11.665 | 8.100/16.722 | FAIL (report only) |
| Paper Craft | 8 | 29.387754 | 12/12 | 7.958/21.001 | 0.102/0.492 | 0.189/0.695 | 11.370/41.809 | **18.985/52.359** | 6.178/10.347 | 13.980/42.012 | FAIL (report only) |
| Archery | 9 | 29.387754 | 12/12 | 7.665/15.316 | 0.086/0.102 | 0.208/1.497 | 12.237/24.419 | **19.679/36.816** | 5.472/13.546 | 14.032/30.844 | FAIL (report only) |
| Pixel | 10 | 29.387754 | 12/12 | 9.940/30.190 | 0.080/0.155 | 0.223/0.868 | 10.369/13.615 | **20.659/38.732** | 6.029/30.900 | 14.091/34.271 | PASS (report only) |
| Neon Glass | 11 | 29.387754 | 12/12 | 7.914/38.564 | 0.090/0.473 | 0.277/3.675 | 12.147/15.577 | **19.876/53.514** | 7.379/15.155 | 11.932/45.169 | FAIL (report only) |
| Rainbow Ribbon | 12 | 29.387754 | 12/12 | 8.986/12.318 | 0.083/0.122 | 0.214/0.455 | 9.242/18.199 | **18.717/26.686** | 5.562/11.531 | 11.795/21.861 | PASS (report only) |
| Clear Glass | 13 | 29.387754 | 12/12 | 8.234/19.172 | 0.088/0.403 | 0.201/0.854 | 9.681/18.310 | **17.608/37.669** | 5.474/10.914 | 12.179/30.446 | FAIL (report only) |
| Stained Glass | 14 | 29.387754 | 12/12 | 8.549/20.576 | 0.090/0.129 | 0.220/0.674 | 12.520/21.323 | **21.474/34.772** | 6.187/8.823 | 14.712/28.577 | FAIL (report only) |
| Campfire | 15 | 29.387754 | 12/12 | 11.819/26.248 | 0.085/0.489 | 0.238/1.441 | 13.993/37.405 | **28.146/49.547** | 6.631/12.371 | 22.942/44.868 | FAIL (report only) |
| Lava Rock | 16 | 29.387754 | 12/12 | 8.030/66.873 | 0.088/6.778 | 0.205/0.794 | 9.232/212.656 | **17.512/279.727** | 5.537/15.469 | 10.429/264.810 | FAIL (report only) |
| Strawberry Glazed | 17 | 29.387754 | 12/12 | 7.714/122.548 | 0.074/1.498 | 0.223/2.102 | 17.027/760.340 | **24.480/884.386** | 6.670/43.478 | 18.747/840.908 | FAIL (report only) |


Native field construction/prop parsers and retained/lazy work:

| Spec | Cell dp | n ON | Construction med/max ms | All prop setup med/max ms | Selection JSON (nested) | Owned cells (nested) | Base geometry (nested) | Retained prep | Lazy template/merge (inside first draw) |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| Cinnamon Roll | 29.387754 | 12 | 0.106/0.242 | 10.290/31.242 | 0.742/7.299 | 1.296/17.657 | 4.680/20.714 | 0.614/6.573 | 15.560/52.882 |
| Sherbet | 29.387754 | 12 | 0.115/0.269 | 9.665/12.946 | 0.669/2.905 | 1.380/5.743 | 5.632/8.385 | 0.761/1.792 | 11.452/56.298 |
| Ink Pro | 29.387754 | 12 | 0.095/2.009 | 8.001/16.507 | 0.568/2.025 | 1.159/4.851 | 5.240/14.253 | 0.518/0.913 | 5.139/11.792 |
| Candy Gloss | 29.387754 | 12 | 0.093/0.478 | 6.936/17.218 | 0.566/1.113 | 1.059/1.502 | 4.396/14.888 | 0.975/3.321 | 8.986/22.644 |
| Jelly | 29.387754 | 12 | 0.095/0.295 | 8.237/18.150 | 0.661/3.419 | 1.200/3.579 | 5.112/12.839 | 0.786/1.790 | 9.359/36.148 |
| Critter | 29.387754 | 12 | 0.082/0.199 | 6.727/9.864 | 0.544/0.779 | 1.088/4.615 | 4.304/6.152 | 1.141/2.748 | 15.213/26.732 |
| Yarn | 29.387754 | 12 | 0.079/0.130 | 6.868/19.713 | 0.572/2.197 | 1.113/3.084 | 4.500/14.721 | 0.749/1.425 | 5.058/9.910 |
| Paper Craft | 29.387754 | 12 | 0.097/0.167 | 6.805/16.774 | 0.585/1.784 | 1.060/1.890 | 4.714/10.179 | 0.816/4.133 | 10.725/38.523 |
| Archery | 29.387754 | 12 | 0.097/0.501 | 7.078/14.236 | 0.619/2.056 | 1.094/1.866 | 4.687/9.838 | 0.490/0.892 | 11.549/23.658 |
| Pixel | 29.387754 | 12 | 0.113/0.265 | 8.852/27.479 | 0.684/2.626 | 1.362/2.345 | 5.723/24.550 | 0.857/2.495 | 9.537/13.102 |
| Neon Glass | 29.387754 | 12 | 0.107/0.176 | 7.061/36.647 | 0.604/1.944 | 1.225/2.257 | 4.705/33.464 | 0.789/1.802 | 11.188/14.832 |
| Rainbow Ribbon | 29.387754 | 12 | 0.146/0.506 | 7.995/11.490 | 0.632/1.986 | 1.268/1.920 | 5.489/9.138 | 0.680/0.944 | 8.340/16.143 |
| Clear Glass | 29.387754 | 12 | 0.097/2.189 | 7.160/16.116 | 0.536/2.508 | 1.256/2.773 | 4.561/9.420 | 0.695/1.285 | 8.664/17.791 |
| Stained Glass | 29.387754 | 12 | 0.107/0.461 | 7.106/19.732 | 0.695/2.273 | 1.111/4.141 | 4.576/14.079 | 0.864/1.683 | 11.792/20.668 |
| Campfire | 29.387754 | 12 | 0.097/0.174 | 9.912/25.568 | 0.671/5.752 | 1.082/2.791 | 6.097/17.202 | 0.686/8.058 | 13.371/34.798 |
| Lava Rock | 29.387754 | 12 | 0.093/2.865 | 7.272/64.874 | 0.594/6.392 | 1.235/6.083 | 4.639/52.952 | 0.617/28.389 | 8.159/200.061 |
| Strawberry Glazed | 29.387754 | 12 | 0.097/0.468 | 7.167/117.768 | 0.518/1.350 | 1.130/5.905 | 4.963/104.801 | 0.472/4.312 | 16.484/577.199 |


Accepted host loads range **5.73–27.63**. Another emulator remains running. Exit frames are **UNVERIFIED:
0 accepted frames at 29.387754 dp; no percentiles**. The huge Lava/Strawberry maxima remain in the table;
they were not trimmed. Stable system_server does not imply a quiet host, and elapsed native work includes
scheduling stalls. The retained work-count improvements do not establish a before/after timing percentage.

Two incomplete Lava attempts (4 and 3 opens) timed out in ADB/start/log services, including Classic OFF.
They remain in `checks/rejected-opening/lava-rock-0/` and `lava-rock-1/`. Platform diagnostics show guest
load 62.63 and system_server monitor contention/slow OOM adjustment; the precise stall cause is unproven.
The two remaining full batches passed after fresh same-config owned-AVD recovery and are in
`perf/measurement-recovered.txt`. All accepted opens use one final PERF APK hash from `perf/summary.json`.

## Carrying the evidence into future art

The owner's follow-up asks for data about why an approach can be reused/optimized, and a prompt for
generating further styles without repeating the mistakes. [Performance recipes](../../skins/performance-recipes.md)
record verified work removal, observational cost families, rejected approaches and the next isolated
question per style. [GENERATION-PROMPT.md](../../skins/GENERATION-PROMPT.md) is the reusable brief.
Both are linked from the skin guide and lessons so future sessions encounter them before skin work.

`python3 scripts/art/summarize-skin-performance.py` joins the actual specs, contract results, verified
dense counters and 408 raw runs. It validates 12 pairs/spec, balanced orders, complete sums, stable
system_server, actual cells and final APK hashes. It writes `perf/style-evidence.{json,csv,md}` with
raw-input hashes. Every row retains all features/widths, draw limit, template/audit/face/spiral/centreline/
band-head counts, opening/paired/setup/lazy/remainder costs and host context. Its next question is
explicitly **unverified**; no style is labelled intrinsically impossible or performance-neutral.

Median lazy geometry/merge is 5.058–16.484 ms; median first-draw remainder is 0.612–0.871 ms. Each
remainder is calculated from the same run, not differences of medians. It includes native submission
and surrounding work, not GPU completion. This identifies a larger phase to investigate; it does not
isolate feature cost. Rainbow demonstrates that eight draws can meet the aggregate budget; Sherbet
demonstrates that five draws can miss it. Only Ink Pro stayed within +16 ms in every individual pair.
No cross-style observation is represented as a causal optimization result.

## Final OFF verification — exact pixel gate fails

`checks/off-verification.json` records final ON/OFF/base APK hashes. The separately built literal
ART06 base is source-audited against HEAD bad7903; its runtime/assets/config are unchanged there.
Both OFF and base display no picker; a saved Strawberry ID 17 survives both downgrade replacements
and is checked after restoring the final ON build, without uninstall or save reset.

At 29.387754 dp, board ROI `[0,305,1440,2952]` contains 3,811,680 pixels. Each APK's first two settled
captures are internally bit-identical, but cross-APK comparison has **316 different pixels**, maximum
channel delta **5**. Differences are antialiased edges in the lower board (x108–1436, y2341–2951).
`checks/off-difference.png`, original captures/XML/camera logs and the failed `device-final.txt` remain
raw evidence. No small-difference tolerance is used.

Display/animation settings, board bounds and logged camera targets match. The native board source
also matches the exact restored ART06 patch. These findings narrow the question but do not identify
the cause; actual native geometry/transforms/rasterization still need isolation. The enabled build
was restored even on failure. **P4 exact pixels FAIL**; the independent 15-asset/test-ads/no-diagnostic
audit passes. Earlier ART06 or pilot OFF passes do not clear this final APK's result.

## Patch delivery

`artifacts/ART-SKINS-07/patches/README.md` gives two alternative runtime entry points: the complete patch
on HEAD bad7903, or ART07 additions after the exact requested ART06 restoration. Apply one runtime
route, then checks and docs; never stack both alternatives. The inverse runtime patch restores the
base app source and retains lessons/tools. `checks/patch-verification.json` records byte-identical
apply/reverse checks in an isolated HEAD archive, including the ART06 + incremental route. No commit,
push, EAS or Git index mutation is used. This patch series is for the default-OFF experiment, not ship
approval; failed opening/pixel gates and unverified frames/owner appearance remain explicit.

## Review artifacts

- [Light contact sheet](../../../artifacts/ART-SKINS-07/screens/contact-light.png) and [dark contact sheet](../../../artifacts/ART-SKINS-07/screens/contact-dark.png): each card shows actual 29.39 dp viewport pixels and an independent 38 dp fixture, without retouching/resizing; crop bounds/source hashes are in `screens/contact-manifest.json`.
- [Light picker](../../../artifacts/ART-SKINS-07/screens/picker-contact-light.png) / [dark picker](../../../artifacts/ART-SKINS-07/screens/picker-contact-dark.png); checked radio XML and full-row coverage are retained.
- [Switch/restart recording](../../../artifacts/ART-SKINS-07/screens/settings-switch-restart.mp4), including six styles and Classic restart. ID 17's positive restart is additionally captured.
- Complete native board/fixture PNGs are under `screens/native/`; actual Android viewports/camera logs are retained separately. The full board is wider than the zoomed physical viewport at 29.39 dp.
- Native matrices/negative controls and base-red/Jest/tsc evidence are under `checks/`; raw pair logs, timer flags, host state and final APKs are under `perf/` and `checks/build-env-*.json`.

**Owner review remains pending. No shipping decision. The skins remain default OFF, and the earlier
opening/frame failures are not cleared by the catalogue, picker, fit checks or successful compilation.**

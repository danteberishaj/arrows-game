# How to add a skin


> Status 2026-10-01: the catalogue and Arrow style picker are experimental, uncommitted and **default OFF**. The latest forward patch is `artifacts/ART-SKINS-07b/patches/skin-catalogue-code-on-a024ba6.patch` (ART07 catalogue plus the 07b colour fixes); apply it alone on a clean tree. See [ART-SKINS-07](../next-level/reports/ART-SKINS-07.md) for measured results and pending owner review, and [ART06's Controller review](../next-level/reports/ART-SKINS-06.md#controller-review-2026-10-01) for the reviewed picker/save rules.


Skins are experimental and default OFF. ART-SKINS-06 uses `EXPO_PUBLIC_META_SKIN_PICKER=1` on Android
for runtime selection in Settings → Arrow style. Classic is the existing flat renderer; all 17 procedural specs follow registry order. Flag unset or iOS/web: no picker, no skin save access, no procedural
board props, even if the old `EXPO_PUBLIC_ART_SKIN` variable is set. That older build selection remains only
in historical ART01–05 tooling. No raster assets, shop, unlocks or iOS renderer are added.

## One data source

Add a `SkinSpec` to `src/ui/skinSpecs.ts` and register it in `SKIN_SPECS`. This is the only skin data source.
The flag resolver and stable JSON payload are derived from that registry. Native `SkinSpec` caches one parsed JSON
selection across board-view remounts; camera size, reduced motion, exact owned cells and interaction feedback are separate props.
Neither a pan nor a feedback event re-parses the spec. Native code must never branch on a skin id.

Fractions are **cell units**, independent of camera scale:

| Field | Meaning |
| --- | --- |
| `palette` | `one`, `length`, `direction` (Up/Down/Left/Right), or `cycle` in immutable arrow order; colours are opaque hex |
| `layers` | Ordered `shadow`, `rim`, `body`, `stripe`, `ribbon`, `bands`, `seam`, `shine`, `glow`, `spots`, `fold`, `headFill`, `tailFill`; see the catalogue feature table for options |
| `head` | `tri`, `rounded`, `swept`, or `step`; halfWidth, tipPastCentre, back, and interior shine |
| `tail` | `none`, `dot`, `roll+face`, `fletch`, `marble`; radius, rim thickness, and mandatory `oneCell: dot | none` |
| `bends` | Rounded contour or crease |
| `face` | Upright eyes, blush, closed-on-blocked; shared geometry with ink/blush colours |
| `lod` | Actual displayed-cell boundaries: flatMinDp, detailMinDp, faceMinDp, in ascending order |
| `motion` | pressScale, anticipationMs; particles count/size/colours/lifeMs; no idle clock |

The renderer starts at the tail **cell centre**; flat arrow extensions are never decoration anchors. A head's
rim is derived from rim width minus body width. Its tip, rim and shadow are clipped to ownership. The head
must dominate the tail by area. Primary `ribbon`, `shine` and `seam` have zero offset and amplitude. Their half-width stays within the body half-width − 0.03; explicit dashed seams remain stitches, rather than continuous gloss. For rounded bends, a sufficiently narrow accent follows the same rounded centreline and fits by construction; wider/offset variants retain the inset-body intersection fallback. Native checks independently subtract the inset body, including bends. Head shine is an interior oval.

**Owner correction, 2026-10-01:** Cinnamon's white shaft line is straight and continuous along straight runs, follows bends smoothly, and stays separate from the good head oval. This supersedes the earlier wavy-icing request. It applies to Sherbet too: its white shaft shine uses zero offset, aligned with the shaft and the head oval. A globally up-shifted shine made the pink/green horizontal bars sit above their otherwise good head ovals. “Straight” here includes a shared visual axis, not only the slope of each isolated line. Set `amplitude: 0`; move the brown stripe aside with `sideOffset` so it cannot cross the white line. `fadeFraction` limits the fade to a fraction of available shaft on short arrows, avoiding a mostly faded two-cell line. A straight shaft accent must also share the shaft/head axis (native bounds check), with a displaced-shine negative control. The filled shaft accent must have one connected component; test it separately from the intentionally separate head oval. Changing appearance still needs owner review.

Ownership means the **union first, then inset its exterior by 0.04 cell** (L-infinity distance). Internal edges
between one arrow's adjacent cells remain connected. Insetting each cell independently would cut the shaft at
every joint. A single-cell arrow has no shaft; a separate native rim-connectivity check rejects detached shaft fragments, with an old-stroke negative control.
Every filled layer, including the offset shadow, closed eyes and missed-mark silhouette, stays
inside this union. Slither travel and interaction transforms are dynamic motion, outside the static-pose fit test.

At most seven colour layers are allowed, reserving one draw for the missed mark. Bands consume one layer per
colour. A generated cell-colour lookup (one small bitmap per board, no asset file) lets `palette` layers draw
all arrow colours in a single compound path with nearest sampling (no neighbouring-colour interpolation). Moving/feedback arrows use their own palette colour. Lookup
storage and cached paths are released with the board/selection. Decoration is lazy per strip, on its first
draw. Relative shape/direction/detail templates are merged directly into strip layers with translation; per-arrow art is allocated only for interactions. Cached head contours use the same positive winding as stroke fills, so concatenation cannot cancel the shaft/head overlap. Only cached head caps are flattened, with ≤0.005 logical-pixel approximation error; shafts and bends retain native curves. Templates are bounded to the current board/tier. Initial preparation creates no
decorative paths or templates. First draw still has a cost: report construction + all prop setup + retained preparation + recording + the entire first-draw interval (including Canvas commands) as the headline, never hide it in another timer. Also check that the filled head lies inside the body: cell fit alone cannot reject a hole at a join.

## Contract: adding a spec means passing K1–K8 and the join/alignment regressions

| Gate | Required evidence | Lesson |
| --- | --- | --- |
| K1 | Native `Region DIFFERENCE` empty for every filled layer of every arrow on v1 indices 0–19 and 3827; independent ownership oracle. Frozen ART03 Cinnamon must fail. | Tail endpoints are not tail cells; an isolated fixture missed collisions. |
| K2 | Actual Canvas draws ≤8 per strip, including a mark, at 10/100/250 arrows. | Per-cell art multiplies draw work and creates seams. |
| K3 | Head cap area > tail cap area at full detail (owner/controller ruling 2026-10-01: this is the whole rule; long accents such as icing are not compared). | A large roll can steal the directional hierarchy. |
| K4 | The arrow **outline** (rim, or body where there is no rim) ≥3:1 on both backgrounds (ART07 look-check exception: an explicit dark preference may retain genuine non-gating light failures with a picker note); blocked colour from the shared `heart` token. Body fill is free (ruling 2026-10-01). | Requiring the fill to contrast darkened Cinnamon to chocolate brown in ART-SKINS-04; the outline carries legibility. |
| K5 | Flat tier exists and is selected below the spec's actual-display flatMinDp. | A dense flat capture does not certify full-detail cost. |
| K6 | Reduced-motion press scale=1, emit produces zero particles, hint pixels do not breathe; exit anticipation guard uses the event's reduced-motion flag. | Motion policy applies to every interaction, with no idle invalidations. |
| K7 | ART07 measures this rule **report-only**, without clearing the earlier ship budget. ≥12 shuffled OFF/ON pairs per spec at 29.387754 dp, dense index 3827, all META flags: preparation + strip recording + full first draw ≤ flat +16 ms for both median and max. Include native renderer construction, every initial native prop setter (including grid/config/strip partitioning), and Canvas command recording. Selection/cell/base parse timers are nested breakdowns of prop setup, not additional costs. Sum each run first, then compute median/max; phase maxima do not add. | Moving work outside a timer does not make opening fast. |
| K8 | Every registered one-cell arrow is head only, with no face or tail (`tail.oneCell: none`). The generic diagnostic dot is capped at .13 cell and tested separately. Check all four directions and both choices. Frozen ART04 Cinnamon must fail the size rule. | A roll and head in the same cell hid direction. |

Use Node **v20.19.4**, only **emulator-5556 / fleet_floor_api31**, and test-ads/PERF builds with all `META_*`
flags enabled. `scripts/art/skin-build-flags.json` pins the owner-confirmed test configuration; the helpers
create the output directories, without relying on ignored ART03 files. No EAS/commits/push. Do not operate another emulator. Load<4 and no other emulator is required
for exit-frame measurements; otherwise record raw host evidence and report UNVERIFIED.

**Historical ART04/05 procedure (requires that restored build-selection source):** set `ART_SKINS_DIR=artifacts/ART-SKINS-05` for all helpers in that iteration (directory defaults still name ART04; use this environment setting for new runs).

1. Generate real core fixtures and contrast rows: `node scripts/art/skin-contract-data.cjs`.
2. For a diagnostic APK only, copy `scripts/art/skin-contract/{Art03Paths,Art04Paths,ConcatenatedHeadPaths,SkinContractInstrumentation}.kt` to
   `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/`. Temporarily register an
   `<instrumentation android:name="com.danteb.arrows.board.SkinContractInstrumentation"
   android:targetPackage="com.danteb.arrows" android:functionalTest="true" />` in the generated app manifest.
   These fixtures never belong in the normal tree or release.
3. Build/install the diagnostic `python3 scripts/art/build-skin-system.py cinnamon`. Use
   `adb -s emulator-5556 install -r artifacts/ART-SKINS-05/perf/cinnamon.apk`, then
   `node scripts/art/check-skin-accent-negative.mjs` (expected alignment failure), and `node scripts/art/run-skin-contract.mjs`. Retain every native result, including expected red before runs.
   The oracle normalises each arrow locally and uses 400 samples/cell; it asserts non-empty layers were not
   lost to Region's raster scan limit. This is an Android Region check, not a mathematical AA-fringe proof.
4. Build/install each selected APK and run `node scripts/art/measure-skin-system.mjs <id>`. This records twelve
   randomised OFF/ON pairs and validates actual full detail from camera/draw logs. When a quiet exit is
   eligible it builds/pushes the local input driver, then rechecks host load before input. The quiet branch
   remains unverified on this host. Run
   `python3 scripts/art/analyze-skin-system.py` for the ledger. OFF here is a native diagnostic override in the
   same selected JS bundle; the separate unset APK establishes the normal flag guard.
5. Run all Jest tests and `tsc --noEmit`. Remove all four copied diagnostic Kotlin files and the temporary
   instrumentation registration. Build `unset` with `build-skin-system.py`, then run `python3 scripts/art/check-skin-apks.py` to compare asset names/test ads and instrumentation registration (the Android manifest may use UTF-16). Verify the actual unset board against OFF pixels.
6. Review real viewport captures and native whole-board captures/crops. Owner taste approval is separate
   from geometry tests. Keep the feature OFF while owner review or a performance gate remains open.

Read [engineering lessons](../engineering-lessons.md) before changing this code. Origins and evidence:
[ART-SKINS-01](../next-level/reports/ART-SKINS-01.md) (atlas seams/assets),
[ART-SKINS-02](../next-level/reports/ART-SKINS-02.md) (compound paths/motion/LOD),
[ART-SKINS-03](../next-level/reports/ART-SKINS-03.md) (real opening camera/cold preparation), and
[ART-SKINS-04](../next-level/reports/ART-SKINS-04.md) (ownership/spec contract/lazy work), and
[ART-SKINS-05](../next-level/reports/ART-SKINS-05.md) (outline contrast, one-cell rule, full opening sum, contour winding and continuous shaft accents).
Update the shared lesson when evidence changes; do not mark an unrun gate verified.

## Consistent centreline defaults (owner clarification, 2026-10-01)

Start every new skin's main shaft highlight on the shaft axis, using `offset: [0, 0]` and `amplitude: 0` (omitted values default to zero). The same rounded centreline drives both body and highlight: straight on straight runs, continuous through turns. Keep its width inside the .03-cell body inset. If the head has the small interior oval, preserve that oval on the same axis; it may stay separate from the shaft highlight. Do not shift a horizontal bar up while leaving the oval centred.

A safe main highlight layer to adapt is:

```ts
{ kind: 'shine', colour: '#FFEDEB', width: .065, offset: [0, 0], amplitude: 0 }
```

Place an optional decorative stripe beside the main highlight with `sideOffset`, bounded by the body's inset width. Keep the tail on its cell centre and select `tail.oneCell: 'none'` as the default. Every new registry entry automatically runs the TS highlight defaults, native filled-join/connected-accent/straight-run-axis checks, and K1–K8. The shifted-shine negative control must fail the axis check; fitting inside a cell and being individually straight are insufficient. Review the real viewport too.

## One-cell arrows (rule added 2026-10-01)

A one-cell arrow has room for its head only. Skins must not draw a tail roll/face in the same cell as the
head; set the mandatory `tail.oneCell` to `dot` or `none`. The native dot radius is capped at 0.13 cell; both delivered specs select `none`. This rule also applies to exit art, through its original one-cell identity. In ART-SKINS-04 a head + roll + face squeezed into one cell read
as a brown blob with eyes and hid the direction.


## Runtime selection and save safety (ART-SKINS-06)

`ARROW_STYLES` registers Classic first (numeric ID **0**, spec `null`), then every procedural `SKIN_SPECS`
entry in insertion order. Each procedural spec owns its stable `numericId` and display `name`: Cinnamon Roll
**1**, Sherbet **2**. Never change or reuse an ID, including after removal. Add new IDs monotonically; test
uniqueness/order. Names/order may change without migrating the player's saved number.

There is exactly one additive integer preference, `arrows_skin`, owned by `arrowStyleSelection.ts`.
`initSaveSystem(skinPickerEnabled())` in ordinary startup conditionally appends it to the existing 29-key hydrate request;
the original registry, parsing, schema version and migration remain unchanged. The conditional extension
is deliberate: registering it in the unconditional core list would make flag-OFF builds read it. No boot
repair writes a missing/unknown/removed ID. Those resolve to Classic. Invalid strings do not parse as a
partial ID. Write on actual choice changes only, using the same coalesced IntStore and SAVE-GUARD as progress.
PERF picker captures use `initSkinPickerCapture()` to hydrate **only** `arrows_skin`, without installing or
migrating a progress store. Existing keys remain outside PERF disk access exactly as before. A failed hydrate permits memory-only selection; it cannot overwrite the unread preference. OFF/downgrade
builds ignore the saved key and retain it for an enabled upgrade.

`useArrowStyle` subscribes only behind the Android/build gate. A selection sends one stable JSON prop to
the existing native view, or an empty selection for Classic. Keep hook order fixed across selection changes.
Keep the view's key independent of style, and preserve geometry/camera/visibility/gameplay. Config strings
may stay unchanged across a new spec: native selection must replay retained LOD, reduced-motion and colour
config onto the new renderer/motion object before its one preparation commit. Previews are small static SVGs
using spec colours; never mount a native board view in the Settings modal. Labels/check marks/dividers use
palette roles. Add contrast rows for the radio labels/check marks and preview outline against `surface`.

Reproduce ART06 with Node v20.19.4:

- `npx jest --watchman=false --runInBand` and `npx tsc --noEmit`.
- `python3 scripts/art/build-skin-picker.py on` / `off`: local test-ads/PERF, all original 17 META flags;
  `on` adds the picker flag. Never use EAS or another emulator.
- `python3 scripts/art/build-skin-picker-clock.py`, then `capture-skin-picker.py sequence` / `dark`,
  `measure-skin-picker.py`, `analyze-skin-picker.py`, `check-skin-picker-device.py` and
  `check-skin-picker-apks.py` (all via python3, ON installed on emulator-5556 first). Device check
  replaces OFF/base/ON without uninstall; supply the separately built literal-HEAD base APK.
- Retain real Settings input, restart evidence, Android checked radio accessibility, light/dark captures,
  and separate OFF vs clean-base pixel/asset comparisons. Report actual displayed cells and host/GPU state.
- Settings lives on the menu: choice→visible board includes closing the sheet and pressing Play. Do not
  call that whole interval native renderer latency, or call an `onDraw` log proof of GPU presentation.
  Check the actual previous/first encoded pixels: a neutral grid during a transition is not skinned art.
  The ART06 classifier requires recognizable arrow pixels, validates encoded frame timestamps/counts,
  and reports frame-gap uncertainty. Stop only the owned recorder PID.

ART06 final verification: 117 Jest suites / 1,963 tests / 12 snapshots; tsc passes. Final OFF and literal
HEAD 1d61234 board pixels match at 29.387754 dp, all three APKs have the same 15 asset names, and a
non-default Sherbet choice survives OFF/base replacements and an enabled upgrade. Runtime UI/light/dark
captures and six visible-board samples per choice are retained; owner appearance approval is pending.

The native geometry fixture runs directly from spec data, independently of picker selection. The older
`measure-skin-system.mjs` opening harness assumes ART05 build-time selection; adapt its selection setup to
a saved picker ID before using it with ART06. ART06 choice→visible-board measurements report navigation,
not K7 opening acceptance. Passing the picker tests does not clear the existing K7 failure.

See [ART-SKINS-06](../next-level/reports/ART-SKINS-06.md) for acceptance and raw evidence.


## Canvas catalogue and shared features (ART-SKINS-07)

The catalogue now appends Ink Pro **3**, Candy Gloss **4**, Jelly **5**, Critter **6**, Yarn **7**,
Paper Craft **8**, Archery **9**, Pixel **10**, Neon Glass **11**, Rainbow Ribbon **12**, Clear Glass **13**,
Stained Glass **14**, Campfire **15**, Lava Rock **16**, Strawberry Glazed **17**. Classic/Cinnamon/Sherbet
remain 0/1/2. These are permanent save identities, not array indices. Every registered spec sets
`tail.oneCell: 'none'`: a one-cell arrow is **head only**, with no face. The generic dot capability remains
available to diagnostics; it is not a registered one-cell look.

All widths/offsets/dashes below are cell fractions. Optional fields retain the ART06 defaults, so adding
capabilities does not change Cinnamon or Sherbet data. New specs reuse the existing bounded motion; no
idle clock, blur, displacement, turbulence, bitmap texture or new particle system is introduced.

| Data feature | Rule | Example |
| --- | --- | --- |
| `palette.lengthStops` | Ordered length thresholds choose colour buckets; omit to retain the original modulo rule. Direction order is Up/Down/Left/Right. | Candy Gloss |
| `bodyPattern: beads` | Overlapping beads share a connected narrow spine; fill and rim use the same spacing, all contained in owned cells. | Critter |
| `bodyPattern: square`, `head.shape: step` | Square cap/miter joins and an orthogonal stepped head; no corner effect on the head. Offset shadow is included in K1. | Pixel |
| layer `opacity` | Composite the declared alpha, including glow; it does not exempt the opaque outline from K4. The contract rejects translucent rims; extend K4 to audit composited alpha before supporting one. | Jelly |
| `bands`, `bandWidths` | Strictly decreasing widths and a matching scaled head in **every** band; reserve one paint per band, total layers ≤7 plus the missed mark. Use the body as the outer colour instead of repeating a full-width band: Rainbow has red body + five inset colours, retaining six visible colours within the limit. | Rainbow Ribbon, Campfire |
| `seam`, `dash: [on, off]` | A deliberately dashed centre stitch, with zero displacement/amplitude. This decorative seam is exempt from the *continuous gloss* rule; test real gaps. | Yarn, Lava Rock |
| `glow` | A wider, translucent, filled under-stroke and head, not a blur filter; K1 includes its full width. | Neon Glass |
| `spots` | Small periodic circles with bounded `sideOffset`; full radius stays inside body inset .03. | Jelly, Strawberry Glazed |
| `headFill` | Recolour the existing filled cap; cannot change its fit or leave an open join. | Archery |
| `tailFill`, colour `tailPalette` | Recolour the existing centred tail cap; optional `tail.colours` gets one generated nearest-sampled colour lookup per board, not an image asset. | Clear Glass |
| `fold` | Fill one half of the head (`fillHalf: false` draws a lead seam instead) and mark actual cell-centre bends with a short crease. Keep primary gloss above the fold and continuous. | Paper Craft, Stained Glass |
| `tail.kind: fletch` | A two-sided feather polygon oriented by the first shaft tangent, centred on the tail cell; rim radius remains bounded. | Archery |
| `tail.kind: marble` | A centred coloured circle and small contained shine, sharing the existing shine paint. | Clear Glass |
| `face.anchor: head` | Upright face inside the filled cap, clipped to it; no face on a one-cell arrow, regardless of anchor. | Critter, Campfire |
| `preferredTheme: dark` | Honest K4 exception: preserve raw failing light rows, require dark outline ≥3:1, and show “Best in dark mode” in Settings. Blocked red still passes both themes. | Neon Glass, Lava Rock |

The picker scrolls without reducing its 60 dp radio targets. Back stays outside the scrolling list.
Dark-preference preview boundaries use the current palette's ink on the sheet; this is a readable selection
control, not a claim that the native bright art passes on a white board. Text/check/note use palette and Type
roles, with source-linked contrast audit rows.

New geometry features get deliberately damaged native fixtures. K1 checks actual filled paths, including
new layers and shifted shadows; nested-head checks remove a band's head and must reject it; stepped-head
checks reject diagonal edges; seam checks require actual gaps. Keep the independent union/erosion oracle
and all legacy negative controls. A positive-only picture is not a contract.

Reproduce with Node v20.19.4 and emulator-5556 only:

1. `ART_SKINS_DIR=artifacts/ART-SKINS-07 node scripts/art/skin-contract-data.cjs`.
2. `python3 scripts/art/build-skin-catalogue.py contract`; install `catalogue-contract.apk` on 5556;
   run `ART_SKINS_DIR=artifacts/ART-SKINS-07 node scripts/art/run-skin-contract.mjs before` and `after`.
   The harness transfers JSON to a diagnostic file in the target app's external-files folder; the larger
   catalogue plus dense geometry exceeds the remote shell's inline command limit. Diagnostic classes and
   manifest registration are injected only while building this APK and removed in a `finally` block.
3. Build `on` for Settings/captures, `perf` for cold opening pairs and `off` for the separate gate-unset check.
   Every phase receives the saved test-ads/all-META flags; no EAS. Ordinary/PERF save isolation remains ART06's.
4. Save a non-Classic choice through the real picker, then install `catalogue-perf.apk` without uninstalling.
   `node scripts/art/measure-skin-catalogue.mjs all` performs twelve shuffled OFF/ON pairs per procedural spec
   using the existing generic native diagnostic JSON override. No per-spec APK or runtime ID branch is needed.
   Report complete owned opening (construction + all prop setup + recording + full first draw), not only the
   zero-decoration preparation. Native parser timings are nested diagnostics, not added twice.
5. Keep actual board pixels/camera logs distinct from complete native Canvas diagnostic boards and 38 dp
   fixtures. Contact sheets label both scales. Whole dense boards cannot fit in the 29.39 dp viewport at once.
   Owner review is pending; captures and CPU measurements are not a shipping decision.

Verification and deviations from the [canvas](https://claude.ai/artifact/BLpq6sX8RZ4GfknZk22xQP)
are recorded in [ART-SKINS-07](../next-level/reports/ART-SKINS-07.md). See that ledger for the current verified
status; adding a type alone does not certify its geometry, timing or owner-approved look.


Performance changes must preserve the registered look, all geometry contract rules and existing motion.
Keep Classic as the paired reference and show the **complete** opening sum and the earlier +16 ms budget,
even when a catalogue task is report-only. Do not turn a contended-host CPU timing into a smoothness claim;
quiet-host frames and physical-device checks remain separate. Native geometry-audit accent/head/tail
paths are diagnostic metadata, not visible layers: normal buffers should not allocate/reset them.
If audit data is made lazy, verify production against audited/frozen geometry and actual rendered pixels;
the independent Region fit oracle and negative controls must remain unchanged. See ART07 for the rejected
partial-strip visibility approach and the final allocation experiment status.


Static decoration reuse may cache only geometry with a proven invariant: tail faces/roll spirals at the
relative template origin, matching band heads per direction, and the common centreline shared by accents.
Cache ownership is per selection and clear-on-release; moving exit art keeps the original path construction.
Run `ART_SKINS_DIR=artifacts/ART-SKINS-07 node scripts/art/run-skin-contract.mjs optimization` on the diagnostic
APK to compare all 21 levels against frozen/audited paths and exact software pixels. This supplements,
rather than weakens, the independent fit contract. ART07 retains 220,278 path comparisons / 4,284 pixel
comparisons and 357 displacement controls; final source and APK hashes are in its artifacts.

For full opening measurement after observed guest framework recovery, use
`python3 scripts/art/measure-skin-catalogue-batches.py`, then `python3 scripts/art/analyze-skin-catalogue.py`.
It boots only fleet_floor_api31/5556 with the same host graphics, settles 20 seconds per spec, preserves
saved choice, runs twelve shuffled OFF/ON pairs, checks the display/system_server PID and quarantines
incomplete attempts. Never start it while a build/test workload is running. Other sessions' emulators
remain untouched; their presence means exits are UNVERIFIED even if a load sample is below four.

## Generate from measured recipes

Use [performance recipes](performance-recipes.md) for the per-style evidence and
[the reusable generation prompt](GENERATION-PROMPT.md) for new art tasks. These links carry the owner’s
goal forward: learn which work can be reused, retain measured failures, and require performance evidence
for new designs. Regenerate the joined raw-data tables with
`python3 scripts/art/summarize-skin-performance.py`; JSON/CSV retain source hashes, recipe features,
12 ON/12 OFF counts, actual cell size, phase/paired costs, work counters and unverified next questions.

Final ART07 at 29.387754 dp: 408 opens / 204 pairs. Ink Pro, Pixel and Rainbow meet the historical
aggregate Classic +16 ms median/max opening budget; 14 styles fail. Pixel/Rainbow still exceed +16 ms
in some individual pairs. Busy-host exits remain UNVERIFIED (0 accepted frames), so no spec is certified
performance-neutral. No spec has been established as impossible to optimize. Output equivalence is
verified separately from timing: actual light/dark backgrounds, the real tier at 29.39/38/5 dp,
open/closed eyes, and a non-background-pixel assertion in every case. The earlier supplemental flat
fixture was blank and its equivalence claim was discarded; see the corrected evidence in ART07.

Final exact native OFF/base comparison **fails** (316 antialiased pixels, max channel delta 5), despite
identical 15 assets/no picker/retained saved choice. The cause is unproven. Do not weaken exact equality,
reuse the earlier ART06 pass as this build’s result, or turn contract success into a ship decision.

# How to add a skin


> Status 2026-10-01: the skin system **and the Arrow style picker** are not merged and default OFF. To work on them, `git apply artifacts/ART-SKINS-06/patches/skin-picker-code-on-1d61234.patch` (27 files) on a clean tree at 1d61234 or later docs-only commits. See [ART-SKINS-06](../next-level/reports/ART-SKINS-06.md) and its controller review.
> look approval and the existing opening budget. ART-SKINS-06 adds Android runtime selection behind
> `META_SKIN_PICKER`. Its patch series includes ART05 restoration on clean HEAD `1d61234`; follow
> `artifacts/ART-SKINS-06/patches/README.md`. Do not apply the restoration twice.


Skins are experimental and default OFF. ART-SKINS-06 uses `EXPO_PUBLIC_META_SKIN_PICKER=1` on Android
for runtime selection in Settings → Arrow style. Classic is the existing flat renderer; Cinnamon Roll and
Sherbet follow the spec registry order. Flag unset or iOS/web: no picker, no skin save access, no procedural
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
| `layers` | Ordered `shadow`, `rim`, `body`, `stripe`, `ribbon`, `bands`, `seam`, `shine`; width, colour or `palette`, optional offset/amplitude/period/fadeCells/fadeFraction/sideOffset/bands |
| `head` | `tri`, `rounded`, or `swept`; halfWidth, tipPastCentre, back, and interior shine |
| `tail` | `none`, `dot`, `roll+face`, `fletch`, `marble`; radius, rim thickness, and mandatory `oneCell: dot | none` |
| `bends` | Rounded contour or crease |
| `face` | Upright eyes, blush, closed-on-blocked; shared geometry with ink/blush colours |
| `lod` | Actual displayed-cell boundaries: flatMinDp, detailMinDp, faceMinDp, in ascending order |
| `motion` | pressScale, anticipationMs; particles count/size/colours/lifeMs; no idle clock |

The renderer starts at the tail **cell centre**; flat arrow extensions are never decoration anchors. A head's
rim is derived from rim width minus body width. Its tip, rim and shadow are clipped to ownership. The head
must dominate the tail by area. A `ribbon` has zero offset; amplitude + width/2 ≤ body width/2 − 0.03. For rounded bends, a sufficiently narrow accent follows the same rounded centreline and fits by construction; wider/offset variants retain the inset-body intersection fallback. Native checks independently subtract the inset body, including bends. Head shine is an interior oval.

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
| K4 | The arrow **outline** (rim, or body where there is no rim) ≥3:1 on both backgrounds; blocked colour from the shared `heart` token. Body fill is free (ruling 2026-10-01). | Requiring the fill to contrast darkened Cinnamon to chocolate brown in ART-SKINS-04; the outline carries legibility. |
| K5 | Flat tier exists and is selected below the spec's actual-display flatMinDp. | A dense flat capture does not certify full-detail cost. |
| K6 | Reduced-motion press scale=1, emit produces zero particles, hint pixels do not breathe; exit anticipation guard uses the event's reduced-motion flag. | Motion policy applies to every interaction, with no idle invalidations. |
| K7 | ≥12 shuffled OFF/ON pairs per spec at 29.387754 dp, dense index 3827, all META flags: preparation + strip recording + full first draw ≤ flat +16 ms for both median and max. Include native renderer construction, every initial native prop setter (including grid/config/strip partitioning), and Canvas command recording. Selection/cell/base parse timers are nested breakdowns of prop setup, not additional costs. Sum each run first, then compute median/max; phase maxima do not add. | Moving work outside a timer does not make opening fast. |
| K8 | Every one-cell arrow has no face and no tail larger than a dot; `tail.oneCell` selects dot or none. Check all four directions and both choices. Frozen ART04 Cinnamon must fail the size rule. | A roll and head in the same cell hid direction. |

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

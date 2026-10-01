# How to add a skin


> Status 2026-10-01: the skin system code is **not merged**. Apply `artifacts/ART-SKINS-04/patches/skin-code-removed-from-tree.patch` (17 files) to work on it; it stays default OFF until the owner approves the look and the level-open cost is within budget. See docs/next-level/reports/ART-SKINS-04.md.

Skins are experimental and default OFF. Set `EXPO_PUBLIC_ART_SKIN=<spec id>` in an Android build to select one.
An unknown or absent id selects today's app. iOS/web keep their existing renderer. There is no shop or saved
selection in this experiment. No raster assets are required.

## One data source

Add a `SkinSpec` to `src/ui/skinSpecs.ts` and register it in `SKIN_SPECS`. This is the only skin data source.
The flag resolver and stable JSON payload are derived from that registry. Native `SkinSpec` caches one parsed JSON
selection across board-view remounts; camera size, reduced motion, exact owned cells and interaction feedback are separate props.
Neither a pan nor a feedback event re-parses the spec. Native code must never branch on a skin id.

Fractions are **cell units**, independent of camera scale:

| Field | Meaning |
| --- | --- |
| `palette` | `one`, `length`, `direction` (Up/Down/Left/Right), or `cycle` in immutable arrow order; colours are opaque hex |
| `layers` | Ordered `shadow`, `rim`, `body`, `stripe`, `ribbon`, `bands`, `seam`, `shine`; width, colour or `palette`, optional offset/amplitude/period/fadeCells/bands |
| `head` | `tri`, `rounded`, or `swept`; halfWidth, tipPastCentre, back, and interior shine |
| `tail` | `none`, `dot`, `roll+face`, `fletch`, `marble`; radius and rim thickness |
| `bends` | Rounded contour or crease |
| `face` | Upright eyes, blush, closed-on-blocked; shared geometry with ink/blush colours |
| `lod` | Actual displayed-cell boundaries: flatMinDp, detailMinDp, faceMinDp, in ascending order |
| `motion` | pressScale, anticipationMs; particles count/size/colours/lifeMs; no idle clock |

The renderer starts at the tail **cell centre**; flat arrow extensions are never decoration anchors. A head's
rim is derived from rim width minus body width. Its tip, rim and shadow are clipped to ownership. The head
must dominate the tail by area. A `ribbon` has zero offset; amplitude + width/2 ≤ body width/2 − 0.03. Its
filled path is also intersected with the inset body contour, including bends. Head shine is an interior oval.

Ownership means the **union first, then inset its exterior by 0.04 cell** (L-infinity distance). Internal edges
between one arrow's adjacent cells remain connected. Insetting each cell independently would cut the shaft at
every joint. A single-cell arrow has no shaft; a separate native rim-connectivity check rejects detached shaft fragments, with an old-stroke negative control.
Every filled layer, including the offset shadow, closed eyes and missed-mark silhouette, stays
inside this union. Slither travel and interaction transforms are dynamic motion, outside the static-pose fit test.

At most seven colour layers are allowed, reserving one draw for the missed mark. Bands consume one layer per
colour. A generated cell-colour lookup (one small bitmap per board, no asset file) lets `palette` layers draw
all arrow colours in a single compound path with nearest sampling (no neighbouring-colour interpolation). Moving/feedback arrows use their own palette colour. Lookup
storage and cached paths are released with the board/selection. Decoration is lazy per strip, on its first
draw. Relative shape/direction/detail templates are reused and translated per arrow; cached per-arrow paths
support subsequent membership changes. Templates are bounded to the current board/tier. Initial preparation creates no
decorative paths or templates. First draw still has a cost: report it alongside preparation, never hide it in another timer.

## Contract: adding a spec means passing K1–K7

| Gate | Required evidence | Lesson |
| --- | --- | --- |
| K1 | Native `Region DIFFERENCE` empty for every filled layer of every arrow on v1 indices 0–19 and 3827; independent ownership oracle. Frozen ART03 Cinnamon must fail. | Tail endpoints are not tail cells; an isolated fixture missed collisions. |
| K2 | Actual Canvas draws ≤8 per strip, including a mark, at 10/100/250 arrows. | Per-cell art multiplies draw work and creates seams. |
| K3 | Head cap area > tail cap area at full detail (owner/controller ruling 2026-10-01: this is the whole rule; long accents such as icing are not compared). | A large roll can steal the directional hierarchy. |
| K4 | The arrow **outline** (rim, or body where there is no rim) ≥3:1 on both backgrounds; blocked colour from the shared `heart` token. Body fill is free (ruling 2026-10-01). | Requiring the fill to contrast darkened Cinnamon to chocolate brown in ART-SKINS-04; the outline carries legibility. |
| K5 | Flat tier exists and is selected below the spec's actual-display flatMinDp. | A dense flat capture does not certify full-detail cost. |
| K6 | Reduced-motion press scale=1, emit produces zero particles, hint pixels do not breathe; exit anticipation guard uses the event's reduced-motion flag. | Motion policy applies to every interaction, with no idle invalidations. |
| K7 | ≥12 real-config dense level opens per spec at 29.387754 dp: cold preparation max≤16 ms; report selection/cell parsing, retained preparation, strip recording, and deferred first-draw costs. | Moving work outside a timer does not make opening fast. |

Use Node **v20.19.4**, only **emulator-5556 / fleet_floor_api31**, and test-ads/PERF builds with all `META_*`
flags enabled. `scripts/art/skin-build-flags.json` pins the owner-confirmed test configuration; the helpers
create the output directories, without relying on ignored ART03 files. No EAS/commits/push. Do not operate another emulator. Load<4 and no other emulator is required
for exit-frame measurements; otherwise record raw host evidence and report UNVERIFIED.

1. Generate real core fixtures and contrast rows: `node scripts/art/skin-contract-data.cjs`.
2. For a diagnostic APK only, copy `scripts/art/skin-contract/{Art03Paths,SkinContractInstrumentation}.kt` to
   `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/`. Temporarily register an
   `<instrumentation android:name="com.danteb.arrows.board.SkinContractInstrumentation"
   android:targetPackage="com.danteb.arrows" android:functionalTest="true" />` in the generated app manifest.
   These fixtures never belong in the normal tree or release.
3. Build/install the diagnostic `python3 scripts/art/build-skin-system.py cinnamon`. Use
   `adb -s emulator-5556 install -r artifacts/ART-SKINS-04/perf/cinnamon.apk`, then
   `node scripts/art/run-skin-contract.mjs`. Retain every native result, including expected red before runs.
   The oracle normalises each arrow locally and uses 400 samples/cell; it asserts non-empty layers were not
   lost to Region's raster scan limit. This is an Android Region check, not a mathematical AA-fringe proof.
4. Build/install each selected APK and run `node scripts/art/measure-skin-system.mjs <id>`. This records twelve
   randomised OFF/ON pairs and validates actual full detail from camera/draw logs. When a quiet exit is
   eligible it builds/pushes the local input driver, then rechecks host load before input. The quiet branch
   remains unverified on this host. Run
   `python3 scripts/art/analyze-skin-system.py` for the ledger. OFF here is a native diagnostic override in the
   same selected JS bundle; the separate unset APK establishes the normal flag guard.
5. Run all Jest tests and `tsc --noEmit`. Remove both copied diagnostic Kotlin files and the temporary
   instrumentation registration. Build `unset` with `build-skin-system.py` and compare asset names/test ads.
6. Review real viewport captures and native whole-board captures/crops. Owner taste approval is separate
   from geometry tests. Keep the feature OFF while owner review or a performance gate remains open.

Read [engineering lessons](../engineering-lessons.md) before changing this code. Origins and evidence:
[ART-SKINS-01](../next-level/reports/ART-SKINS-01.md) (atlas seams/assets),
[ART-SKINS-02](../next-level/reports/ART-SKINS-02.md) (compound paths/motion/LOD),
[ART-SKINS-03](../next-level/reports/ART-SKINS-03.md) (real opening camera/cold preparation), and
[ART-SKINS-04](../next-level/reports/ART-SKINS-04.md) (ownership/spec contract/lazy work).
Update the shared lesson when evidence changes; do not mark an unrun gate verified.

## One-cell arrows (rule added 2026-10-01)

A one-cell arrow has room for its head only. Skins must not draw a tail roll/face in the same cell as the
head; use the spec's small tail (dot) or none. In ART-SKINS-04 a head + roll + face squeezed into one cell read
as a brown blob with eyes and hid the direction.

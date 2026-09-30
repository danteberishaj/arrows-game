# ART-SKINS-02 — procedural Cinnamon Roll, Android

2026-09-30. Working tree on `next-level`; no commit, push, EAS build, image assets, dependencies, or iOS edits. The experiment remains **default OFF**. Set `EXPO_PUBLIC_ART_SKIN=cinnamon` to select it on Android; all other values use the existing renderer. This replaces the unused texture flag.

## Result and acceptance ledger

Evidence labels distinguish **executed/observed**, **source inspection**, and **UNVERIFIED**. A successful compile is not a motion or visual approval.

| Gate | Status | Evidence and limits |
| --- | --- | --- |
| B1 | Executed checks PASS; OFF audit limited to inspected source | Node 20: 113 suites, **1920 tests**, 12 unchanged snapshots pass; TypeScript passes. ON/OFF releases compile. Both APKs contain the same 15 asset names, no skin images. Original parsing, geometry, dash-span, camera and exit drawing methods match HEAD (exit drawing after removing its sole guarded branch); module Gradle file unchanged; no iOS diff. Whole-app binary equivalence was not established. |
| B2 | Executed/observed PASS for captured fixtures | Native 9×11 fixtures at **38, 24, 12 dp**, 1080×2400, density 480: connected contours through turns, identifiable directions, upright faces in four directions at 38, flat brown fallback at 12. OFF/ON level **3828**, index 3827, **250 arrows**, captured and inspected. Fixtures use diagnostic geometry; this is not owner taste approval. |
| B3 | Executed/observed PASS | 10/100/250 arrows: **7** full-skin draws per strip, **8** with missed marks. At 24 dp faces are omitted: **5**; 12 dp flat fallback: **2**. Repeated routes in the stress fixture test compound-layer draw count; the separate dense capture uses actual level geometry. |
| B4 | Executed PASS for strip recording only | Same delivered APK, shuffled **12 OFF / 12 ON**: ON−OFF median **0.309646 ms**, below **1.0 ms**. Separate cold path preparation is excluded from this recording timer and costs **4.9429585 ms** median; do not present the narrow pass as total skin overhead or full-detail performance approval. |
| B5 | **UNVERIFIED** | Host load exceeded 4 and another emulator was running. Raw frame data retained, with counts below. No exit-frame pass/fail conclusion. |
| B6 | Executed diagnostic replay; exact timing **UNVERIFIED**; **OWNER REVIEW PENDING** | Requested 10 s recordings contain press/hold/release, five exit events, blocked feedback and hint. Native fixture bypasses gesture delivery. Recorded frame cadence is insufficient for **90 ±17 ms** or **≤2-frame** latency checks. Real-game gesture recordings supplement this evidence where noted below. |
| B7 | **UNVERIFIED** for complete OS-driven sequence | Explicit reduced fixture suppresses squash, crumbs and breathing in source. The real-game reduced capture confirms six removals but ends before the blocked/hint sequence. Sparse frames cannot certify every transition. |

## Implementation and tradeoffs (source inspection)

`CinnamonPaths.kt` builds compound filled paths for the shadow, rim, dough, stripe/spiral, icing, blush and face. The head joins those compounds. Rim #B57442 is 0.38 cell, dough #E6AE71 0.33, stripe #9A5B32 0.07, white icing 0.09; shadow offset 0.08, tail radius 0.31. Caps and bends are rounded. Shared stripe/spiral fill keeps the full-detail strip at seven draws, with one additional compound mark draw. No bitmap, atlas, per-cell image drawing or Gradle asset source.

Cell-size thresholds are 14/24/28 dp. Android's parent transform does not reliably invalidate a retained child's display list; a selected-build-only Reanimated reaction sends a representative LOD size to React **only when a boundary changes**. Detail geometry is rebuilt at boundaries, not on every pan frame. Dense-board cold preparation initially measured 387.4375 ms because full detail was built before knowing the display scale; preparing only the current tier corrected that approach. The failed preflight log is retained, not included in final measurements.

`CinnamonMotion.kt` owns bounded interaction state only when selected. Press reaches 0.94 through the specified 90 ms cubic curve (.23,1,.32,1). Release uses the analytic mass=1, stiffness=400, damping=15 spring and preserves estimated current velocity. **Limitation:** settling stops at 620 ms, approximating energy threshold 1e-4 rather than running Reanimated's exact energy termination. The original blocked displacement curve (0.5·sin(πk)·exp(−2k), 300 ms) is retained; eyes close during that interval. Skin flash colouring is an overlay, rather than the original colour interpolation. Hint opacity breathes once over 1200 ms.

Exit launch duration/curve remain the existing formulas after the 60 ms visual anticipation phase (0.95 along / 1.06 across). Controller completion timing and the existing two native exit slots are unchanged; consequently the extra phase does not extend gameplay timing. Six crumbs per event reuse a 24-object pool, last 350–500 ms, and draw rounded squares 0.08 cell using transform and alpha. No idle clock is scheduled. Reduced motion suppresses geometric deformation, particles and hint breathing; existing reduced exit fade is retained. No generator, save, sound, ads or consent behavior changed.

## Executed verification and raw evidence

All paths below are relative to the repository. Raw artifacts are ignored by Git and retained locally under `artifacts/ART-SKINS-02`.

Tests: `checks/jest-delivered-retry.txt` — 113 suites, 1920 tests, 12 snapshots, **227.879 s**. `checks/tsc-final.txt` — exit 0, no diagnostics. The first Jest run found three contrast-audit source-line references stale after inserting the flag import; those references were updated. No snapshots changed. A later empty failed run was caused by full disk; the delivered retry passed. `checks/apk-delivered.txt` and `checks/apk-off-retry.txt` retain successful releases. Earlier disk/fixture failures remain in their original logs.

APK evidence: `perf/procedural-on.apk`, SHA-256 **5a734d264df485cb3aeb2f58a3d919e2ac5198bbc3d066bbddf28db7dfd49272**; `perf/flag-unset.apk`; `checks/apk-on-files.txt`, `apk-off-files.txt`, `apk-assets.json`, `off-source.json`. Asset names are identical (15 each, zero ON-only/OFF-only names). The OFF release had skin/PERF flags unset and test ads enabled. ON had skin, PERF level 3827, PERF exit-duration 1000 ms, and test ads enabled. Diagnostic fixture replay uses 650 ms exits; do not mix these durations.

Visuals: `screens/fixture-{38,24,12}.png`, `screens/{off,on}.png`, `screens/exit-mid-flight.png`. Draw logs: `checks/draws-{10,100,250}-{plain,marked}.txt`. Logs are cumulative; use the final fixture line matching the requested count/38 dp. Final full fixture draw count is independent of arrow count.

Static benchmark: `perf/raw.json`, `summary.json`, `run-*-build.log`, `run-*-prep.log`, `cold-prep.json`. Shuffled Fisher–Yates seed **20260930**; OFF is split A=6/A2=6 for the null comparison; ON B=12. The diagnostic `artSkinProcedural` intent enables native OFF/ON in the same APK, and each run verifies native selection in logs. **Limitation:** JS is compiled ON in both arms; OFF in this pilot is native renderer OFF, not an entirely flag-unset interaction baseline.

| Executed recording statistic | OFF pooled | ON |
| --- | ---: | ---: |
| Median strip recording (ms) | 0.2191665 | 0.5288125 |
| Min–max strip recording (ms) | 0.168042–1.075958 | 0.267958–4.776583 |

Executed median permutation test: **20,000** iterations, seed 20260930, two-sided p=**0.003699815**. OFF split medians 0.2731875 / 0.2191665 ms; observed split difference 0.054021 ms; OFF-vs-OFF permutation absolute-difference p95 **0.2382085 ms**. Separately, cold preparation ON median **4.9429585 ms**, range **1.259709–60.004584 ms**, 12 samples. Cold preparation happens outside the strip-recording timer, so total first-display work is materially higher. Full-detail cold preparation/exit performance has not passed a separate controlled gate.

### Exit frames — raw, contended; UNVERIFIED

Executed `uptime` before: `18:39 up 33 days, 8:28, 1 user, load averages: 13.82 13.84 16.29`.
After: `18:43 up 33 days, 8:32, 1 user, load averages: 22.54 16.70 16.73`.
Host process inventory showed fleet_floor_api31 and Pixel_8_Pro. Only emulator-5556 was operated by this task. Each run's before/after load and full frame rows are retained in `perf/raw.json` and `run-*-gfxinfo.txt`.

| Executed raw statistic, UNVERIFIED comparison | OFF | ON | Completed rows / 78 nominal slots per 1300 ms window |
| --- | ---: | ---: | --- |
| Median per-run p50 (ms) | 86.5373705 | 118.713564 | OFF median 31.5/78; ON 24/78 |
| p50 min–max (ms) | 84.838679–191.151236 | 85.164210–243.990887 | OFF range 15–34/78; ON 11–35/78 |
| Median per-run p95 (ms) | 108.4493055 | 209.6257015 | OFF median 31.5/78; ON 24/78 |
| p95 min–max (ms) | 88.139920–333.097397 | 101.570191–503.319283 | OFF range 15–34/78; ON 11–35/78 |

Executed parser reconciliation: **645** complete rows over 24×78=**1872** nominal capture slots; **613** complete rows within tap-through-1000-ms-slither windows over 24×60=**1440** nominal slots. Zero excluded rows within those windows. **771** vsync slots between complete rows have no complete row (boundary gaps excluded). All 24 independent raw JSON frame counts agree with the parser. These gaps and legacy gfxinfo deadline misses are **not measured presentation drops**. The p50/p95 permutation values in JSON do not override the failed quiet-host prerequisite.

### Motion recordings — timing and owner judgment pending

Executed `screenrecord --time-limit 10` native replay captures: `recordings/motion.mp4`, `reduced.mp4`; event uptime logs in `*-events.txt`; all decoded first-arrow frames, actual PTS and `frame-analysis.json` retained. Normal: **83 frames**, container **8.404111 s**, last PTS **8.3184 s**, median PTS gap **66.6225 ms**, max **959.033 ms**. Reduced: **50 frames**, container **11.869367 s**, last PTS **9.512911 s**, median gap **74.878 ms**, max **2356.455 ms**. Command duration is not evidence of an exact 10-second video. Colour-mask widths are noisy from compression/background; they do not prove exact 0.94 scaling. Five native exit events occur, but the existing two-slot capacity can replace earlier still-running exits in this rapid diagnostic chain.

Native fixture sets the reduced prop explicitly. Real-game supplement uses `scripts/art/capture-skin-game.mjs`, deterministic v1 six-arrow plan, actual hold/gesture chain/blocked/header-hint input, process restart per preference, and restores `transition_animation_scale` in a finally block. Executed preference readbacks were 1/0; restored to original 1. Both hierarchies show **244 left**, confirming six successful removals. Contact sheets visibly show slither in normal mode and removals in reduced mode. Normal supplement: **132 frames**, **8.760600 s**; reduced: **74 frames**, **6.470344 s**. The reduced video ends before blocked/hint feedback, so its complete sequence is **UNVERIFIED** even though later input calls succeeded. See `recordings/game-events.json`, `game-video-metadata.json`, `game-*-hierarchy.xml`, and `game-*-review.png`. Reanimated's Android source reads the global transition scale equal to 0 as reduced motion; exact no-squash/crumb/breathing behavior across all events is not established by the incomplete video. Neither recording is a two-frame latency pass. **OWNER REVIEW PENDING** for cute/cozy/ASMR quality.

## Reproduction and next decision

Use Node `/Users/gentlegen/.nvm/versions/node/v20.19.4/bin`, exact Expo v57 docs, and only emulator-5556 / fleet_floor_api31. Release builds use arm64-v8a and test ads; no EAS. On this host, all-ABI builds filled disk; only regenerable Android build caches were cleared. Retain the delivered APK rather than benchmarking an earlier build.

For native fixtures, copy `scripts/art/ProceduralSkinFixtureActivity.java` into the generated Android app package and temporarily register `.ProceduralSkinFixtureActivity` (exported, AppTheme) in the generated manifest, then build the diagnostic ON APK. Launch MainActivity first to create its React context. The fixture must extend AppCompatActivity and use direct release module calls (reflection broke under R8). Run `node scripts/art/capture-procedural.mjs`. Remove that temporary activity registration/source before building the default-OFF release; it is already absent from the delivered working tree.

Benchmark the delivered APK with `ART_SKIN_SERIAL=emulator-5556 node scripts/art/skin-benchmark.mjs`, then `python3 scripts/art/analyze-skin-perf.py`. Rerun B5 only when load <4 and no other emulator is running. The next experiment must address **full-detail cold preparation and real touch latency**; a repeat of this dense flat-fallback recording test does not answer either question. Restore device display overrides and preferences after capture. Keep the flag OFF until those limitations and owner review are resolved.

Executed cleanup: transition scale restored to 1; `wm size`/`wm density` overrides reset (physical 1440×3120 / 560); only this task's emulator-5556 stopped. `checks/device-restored.txt` retains the readbacks. Final TypeScript retry `checks/tsc-delivered.txt` passed with no diagnostics. No temporary fixture activity remains in the generated app manifest/source.

Patch series under `artifacts/ART-SKINS-02/patches`: implementation, verification/report, persistent lessons. All three reverse-apply checks pass against the delivered working tree; `git diff --check` passes. Evidence/APKs remain outside patches. The reusable findings are indexed in `docs/engineering-lessons.md`, which AGENTS.md requires future sessions to read.

## Reviewer verification (controller, 2026-09-30)

Verdict: **UNCERTAIN — keep OFF.** The procedural approach fixes ART-SKINS-01's seams and asset problems; the
player-facing performance question is still unanswered.

Executed and observed by the reviewer:
- `npx tsc --noEmit` exit 0; `npx jest` 113 suites / 1920 tests / 12 snapshots pass (Node v20.19.4).
- `perf/flag-unset.apk` and `perf/procedural-on.apk`: 15 asset names each, 0 real ad-unit ids, test ids present
  (both are test-ads builds). No image assets added.
- `perf/raw.json` recomputed: strip recording OFF 0.219 [0.17..1.08] ms vs ON 0.529 [0.27..4.78] ms; exit p95
  OFF 108 vs ON 210 ms with 15–35 of 78 frame slots filled — matches the report; the exit comparison stays
  UNVERIFIED (host load 9.9 / 29 over 1 / 15 min at review time, a second emulator running).
- Visual: `fixture-38.png` shows connected contours and upright faces. `game-motion-review.png` confirms six
  exits (250 → 244) and a blocked tap (heart lost) in the real game.

Read from source (not executed):
- Flag unset: every new JS branch is behind a build-time constant and every native branch behind
  `cinnamon != null`, which only an `artSkin` prop can set; JS never sends it when the flag is unset.

Findings:
1. **The measured board is not the board players would see.** The benchmark and dense captures ran without
   META_ZOOMED_CAMERA, so the 250-arrow level drew at ~10 dp (flat fallback). With the shipped zoomed camera the
   cell is ~29 dp on the same phone class (reviewer's level-1 capture), i.e. the **full-detail** tier. Full-detail
   cold preparation, strip recording and exit frames on a dense level are unmeasured.
2. `onDraw` sets `pathsDirty = true` on every frame whenever the skin is selected, so every animated frame
   (exit, pan, zoom) re-runs the per-arrow membership pass. Gate it on an active interaction.
3. The moving arrow's layers are rebuilt with `getFillPath` every exit frame (`buildInto`); cheap for one arrow
   at low detail, unmeasured at full detail.
4. Run order put the first 7 runs all OFF (`aaaaaaaBaBBB…`), so OFF is front-loaded in time; use blocked
   randomisation (shuffle within pairs) next time.
5. Look (owner review pending): at 38 dp the shaft continues behind the tail roll (reads as a lollipop stick),
   the icing reads as broken white dashes, and the head highlight looks detached.
6. `useCinnamonScreenCell` starts at 12 dp, so the first frame of a level draws the flat tier and then rebuilds
   at the real tier — a possible flash and a second cold preparation on every level open.

Disposition (owner approved, 2026-09-30): the skin code is **not** in the tree. Exactly what was removed —
the procedural renderer, JS props, the `ART_SKIN` flag, and the matching flag-test and contrast-line edits —
is `artifacts/ART-SKINS-02/patches/skin-code-removed-from-tree.patch` (re-apply with `git apply`; forward check
passes on 3bd5590's successor). Committed: this report, the capture/analysis scripts and the lessons entry.
The tree keeps the ART-SKINS-01 `ART_SKIN_TEXTURED` placeholder flag, unread.

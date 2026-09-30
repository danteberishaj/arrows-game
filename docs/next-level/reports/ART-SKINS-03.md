# ART-SKINS-03 — Cinnamon polish and player-facing configuration

Completed 2026-10-01 (started 2026-09-30), `next-level`, working tree only. **Default OFF; owner visual review pending.** All META_* flags enabled, as explicitly confirmed by the owner. No commits, push, EAS, dependencies, image assets, gameplay or iOS changes.

## Acceptance ledger

| Request | Status | Evidence |
| --- | --- | --- |
| 1. Dirty paths only during active interactions | Executed correctness trace + source inspection | `hasActiveInteraction` bounds press/release, blocked/blocker and hint lifetimes. Exit/particle animation alone no longer sets pathsDirty. At **38 dp**, five native exit events caused exactly **five** membership rebuilds (their mask commits), then **zero** rebuilds before blocked feedback. Raw trace/events retained. This is not a frame-performance result. |
| 2. Correct opening tier | Executed PASS | The selected skin mounts after viewport layout, using `cellSize × initialCameraScale`; per-level geometry keys reset its opening state. Regression test covers initial mount and replacement level. All **12** measured ON opens at **29.387754 dp** prepared full detail exactly once and first logged draw used that size (seven layers). No initial flat preparation/draw in these logs. |
| 3. Roll at tail | Executed visual capture; OWNER REVIEW PENDING | Tail centre now uses shaft distance zero rather than 0.42 cell along it. At **38 dp**, no shaft protrudes behind the roll in the captured fixture. |
| 4. Continuous icing | Executed visual capture; OWNER REVIEW PENDING | One filled wavy ribbon, offset up-left, tapering smoothly over the final cell toward the head. Cinnamon stripe remains dashed. **38 dp** fixture retains one connected icing contour through bends. Tapered width provides the fade without per-arrow gradient draws. |
| 5. Internal head oval | Executed visual capture; OWNER REVIEW PENDING | Small axis-oriented filled oval between head base and tip; **38 dp** capture shows it inside all four head directions. No edge stroke highlight. |
| 6. Real META configuration / full dense level | Executed PASS | Owner confirmed all META_* flags enabled. Level **index 3827**, displayed **3828**, 250 arrows, at **29.387754 dp**, full detail including faces. Actual default display is **1440×3120 / density 560**, width **411.428558 dp**. `dense-on.png` and run logs prove size and seven draws per strip. |
| 7. Full-detail cold preparation | Executed, observed cost exceeds budget | **12 ON level opens at 29.387754 dp**: median **45.9131875 ms**, max **83.62875 ms**, min **26.143125 ms**. Observed max is above **16 ms**. This is a contended emulator measurement, not an intrinsic physical-device estimate. |
| 8. Paired exit measurement | **UNVERIFIED** | Twelve blocked-randomised OFF/ON pairs executed for opening costs. Host load was >4 and another emulator ran, so **zero exit captures/taps** were taken in that experiment. Raw per-run host data retained; no frame percentiles fabricated. A separate diagnostic fixture trace verified membership behavior only. |

## What changed

The ART-SKINS-02 renderer had been removed into `skin-code-removed-from-tree.patch` during review. It was restored as the starting point for this requested fix; the previous report and reviewer findings are preserved. New behavior remains behind `EXPO_PUBLIC_ART_SKIN=cinnamon` on Android. Other values and iOS retain the existing path.

`CinnamonMotion.hasActiveInteraction` now guards the onDraw dirty flag. The previous frame leaves one pending membership update when an interaction ends, restoring the static arrow on the settling frame; subsequent exit-only frames reuse retained strips. No extra idle clock was added. The correctness trace has five rebuilds in the 650+60 ms native-fixture exit window, one per exit visibility update, rather than one per animation frame. The selected hint breathes only during its original 1200 ms lifetime.

The opening camera is calculated from the measured viewport and safe-area-adjusted visible height, with the same zoom flag as the gesture camera. The skin waits for that value rather than mounting at a guessed 12 dp. A native view is keyed by immutable level geometry, so a replacement level cannot inherit the previous level's detail state. The boundary reaction still crosses to React only at 14/24/28 dp changes; it now retains the actual size at that crossing rather than logging a representative 12/18/24/38 value. On-screen sizes in this report describe the captured opening or fixed fixture, not an arbitrary later pinch inside a tier.

The tail endpoint, continuous icing and contained oval preserve the compound-layer architecture: **seven full-detail layers** per strip, **eight** with missed marks, no atlas or bitmap pieces. The icing is a tapered filled contour rather than a stroked dash sequence. It fades by width, not alpha. The head oval shares that compound fill; visual softness is antialiasing, not a blur filter. Existing ART-SKINS-02 motion limitations (analytic spring cutoff and moving-arrow path rebuilding) remain; this task does not claim those gates are solved.

## Before / after (executed captures)

Both **38 dp**, native 9×11 fixture, **1080×2400 / density 480**. Those display overrides were reset before the real-config experiment. Fresh before capture uses ART-SKINS-02's retained test-ads APK; after uses the delivered ART-SKINS-03 APK. Source screenshots remain unaltered. The comparison is a labelled crop/resize of actual captured pixels, not generated art.

![Before and after at 38 dp](../../../artifacts/ART-SKINS-03/screens/comparison-38.png)

Full evidence: `artifacts/ART-SKINS-03/screens/before-38.png`, `after-38.png`, `comparison-38.png`, `dense-off.png`, `dense-on.png`. The owner judges cute/cozy/ASMR quality; **OWNER REVIEW PENDING**.

## Build and configuration evidence

Node **v20.19.4** as requested; exact Expo v57 reference read before code. `checks/build-env.json` is the complete environment used. All **17 META_* flags** enabled: STREAK_FREEZE, EXIT_TO_SCREEN_EDGE, BOARD_GRID, ZOOMED_CAMERA, BANNER, MISSED_MARK, PRESS_SPRING, LEVEL_TRANSITION, PANEL_MOTION, DAILY, GALLERY, REVIEW_PROMPT, BLOCKED_INK_HOLD, HEART_REFILL_POP, THEME_TRANSITION, POST_CLEAR_TIMELINE, SETTINGS_SHEET.

Additional flags: test ads, ART_WIN_SILHOUETTE, FTUE, FTUE_ASSIST, skin cinnamon, PERF_LEVEL=3827, PERF_EXIT_DURATION_MS=1000, LOG_BOARD_VIEWPORT=1. No unrelated EXPO_PUBLIC values inherited. The bundle task was explicitly rerun before assembleRelease because public env values are not Gradle inputs. arm64-v8a only, two build workers. Temporary AppCompat fixture source/manifest registration is diagnostic-only and removed afterward.

Delivered `artifacts/ART-SKINS-03/perf/procedural-on.apk`, SHA-256 **54f323fc18e4b26629f0881ba2866250a84c820b1d2f120752eb56ffc62bb7a6**. Release compiles (`checks/build.txt`); APK has **15 asset files**, no skin/atlas names (`checks/apk.json`). Same-APK native OFF is selected with `artSkinProcedural=false`; ON with true. JS is compiled with the skin selected in both arms, so this is a native renderer comparison, not whole-bundle flag-OFF equivalence.

Executed tests: **114 suites, 1921 tests, 12 unchanged snapshots**, all pass, **237.336 s** (`checks/jest-final.txt`). TypeScript exit 0 (`checks/tsc-final.txt`). New opening-camera regression test also passed alone. Contrast-audit references updated to their shifted source lines. No new dependencies.

## Measurement (executed, 29.387754 dp throughout)

`scripts/art/measure-skin-polish.mjs` restarts the process per open and verifies the camera log, exactly one non-empty full-detail preparation, and the actual ArtSkinDraws line before accepting an ON result. Each of **12 pairs** contains one OFF and one ON run, randomised only within that pair (seed **20260930**). `perf/raw.json` retains order, every log path, size, cold preparation, recording time, build flags, APK hash, and before/after uptime/process inventory. `scripts/art/analyze-skin-polish.py` reproduces the summary.

| Statistic | Native OFF | Cinnamon ON |
| --- | ---: | ---: |
| On-screen opening cell (dp) | 29.387754 | 29.387754 |
| Cold skin preparation median / max (ms) | No skin preparation | **45.9131875 / 83.62875** |
| Cold skin preparation range (ms) | No skin preparation | **26.143125–83.62875** |
| Strip recording median (ms) | 0.1903335 | 2.9699995 |
| Strip recording min–max (ms) | 0.145875–0.40275 | 2.422708–16.532875 |

The median within-pair recording difference is **2.7386035 ms**; exact paired sign permutation p=**0.015625**, **4096** assignments. These are recording times, excluding the separately reported cold geometry preparation, React startup, base geometry parsing and grid setup. The preparation timer measures `prepareCinnamonLocked` (all 250 decorative paths and strip-cache destinations), excluding renderer/motion construction before that method; it is not total level-open time. The full-detail result supersedes the earlier flat-tier inference: the old +0.31 ms recording result did not describe what players see. Preparation happens on the native props/UI path; an opening hitch is plausible from this cost, but player-visible hitch duration was not measured here.

### Exit frames — UNVERIFIED, not sampled

Executed first uptime: `23:58 up 33 days, 13:46, 1 user, load averages: 15.06 15.58 16.97`.
Executed last uptime: `0:00 up 33 days, 13:48, 1 user, load averages: 17.11 15.93 16.90`.
Both inventories show fleet_floor_api31 and Pixel_8_Pro. This task operated only emulator-5556; it did not stop or reconfigure the other emulator. All 24 runs failed the quiet-host gate. No exit-frame experiment was run under these conditions.

| On-screen cell | Frame statistic | Completed frames / nominal sampled slots | Status |
| --- | --- | --- | --- |
| 29.387754 dp | p50: unavailable | 0 / 0 (no capture window opened) | UNVERIFIED |
| 29.387754 dp | p95: unavailable | 0 / 0 (no capture window opened) | UNVERIFIED |

No inference about drops, cadence, regression or a pass is possible from an unsampled window. When rerunning on a quiet host, the script captures 1300 ms (**78 nominal 60 Hz slots**) per accepted tap and prints completed counts beside both percentiles. Accepted exits and pair-wide before/after load still require inspection; the analyser deliberately does not auto-pass exit timing. Raw frame CSV is saved only when a capture actually runs.

## Reproduction, cleanup and disposition

Read the saved environment and use the delivered APK. Only `adb -s emulator-5556` / fleet_floor_api31, test ads/PERF. Real-config measurement requires the default **1440×3120 / 560** display; do not reuse the **1080×2400 / 480** visual fixture override (360 dp width would open at 25.71 dp without faces). Start MainActivity before the temporary fixture to initialise its React context. Then run `measure-skin-polish.mjs` and `analyze-skin-polish.py` on Node 20 / Python. The existing input-driver JAR must be pushed to `/data/local/tmp/art-skin-input.jar` for a quiet-host exit run.

Disk initially prevented the emulator from starting. Only regenerable unused ABI/bundle cache directories were cleared; source and prior artifacts were preserved (`checks/cache-cleanup.txt`). Earlier sandbox/launch failures are retained. The optional shipped-APK bytecode string-table inspection did not establish flag values; the owner's explicit all-META confirmation and saved build environment define the configuration used.

Keep the flag OFF. The look is ready for owner review; full-detail preparation exceeds the stated budget on this host, and exit-frame cost remains unverified. Future work should address full-detail path preparation and moving-arrow work, then measure exits on a quiet host. Do not repeat a flat-tier benchmark as evidence for this camera.

Executed cleanup: temporary fixture registration/source removed; display overrides reset, physical 1440×3120 / 560 read back; only the task-owned emulator-5556 stopped (`checks/device-restored.txt`). No OS animation preference was changed in ART-SKINS-03. Three patch groups are saved under `artifacts/ART-SKINS-03/patches`, with a manifest and application notes. They include restoring the earlier default-OFF skin before the polish. All reverse-apply checks and `git diff --check` pass. Existing ART-SKINS-01/02 reports and reviewer sections remain preserved. Lessons updated in the shared index required by AGENTS.md.

## Reviewer verification (controller, 2026-10-01)

Verdict: **UNCERTAIN — look ready for owner review; keep OFF (preparation over budget, exits unverified).**

Executed and observed by the reviewer:
- With the delivered code: `npx tsc --noEmit` exit 0, `npx jest` 114 suites / 1921 tests / 12 snapshots pass (Node v20.19.4).
- `perf/raw.json` recomputed: 12 ON opens, each at 29.3878 dp with exactly one full-detail preparation and 7 draws
  per strip; preparation median 45.91, min 26.14, max 83.63 ms; strip recording OFF 0.190 [0.146..0.403] vs ON
  2.970 [2.423..16.533] ms; every run's exit status UNVERIFIED (host load 15–17, second emulator). Matches the report.
- Visual: `comparison-38.png` shows the roll now at the very tail, one continuous icing line and a head oval.
  `dense-on.png` (real config, 29 dp) reads well; the head is barely wider than the shaft while the tail roll is
  the largest shape, so the eye lands on the rolls first. Suggest heads ~1.3× wider (anatomy rule: head is the
  biggest shape) — owner's call.

Open performance work before any enablement: cut full-detail preparation (build decorative layers lazily per
strip on first draw, or share one prebuilt per-length template translated per arrow) and keep strip recording near
the flat renderer; then measure exits on a quiet host or the owner's phone.

Disposition (owner's standing instruction, 2026-10-01): skin code moved out of the tree into
`artifacts/ART-SKINS-03/patches/skin-code-removed-from-tree.patch` (12 files incl. the new opening test; forward
re-apply check passes). Committed: this report, the measurement scripts and the lessons entry.

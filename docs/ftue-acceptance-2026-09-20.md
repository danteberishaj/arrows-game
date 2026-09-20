# FTUE acceptance packet — 2026-09-20

- **Status:** DONE_WITH_CONCERNS. Android emulator scenarios A–F passed the behavior checks. Owner decisions, iOS, and physical Android remain open. The reduced-motion blocker cannot both remain visible and be captured at least one second after the event because its consumed W0-04 lifetime ends before one second; this packet contains separate 327–339 ms static-state and 1.341–1.346 s post-event evidence.
- **Scope:** W1 visual/behavior acceptance only. This packet does not claim that the tutorial teaches, does not enable any feature flag, and does not select a production stall-hint delay.
- **Evidence root:** `artifacts/W1-10/`.
- **Review shortcut:** `artifacts/W1-10/scenario-f/composite-headers.png`, `artifacts/W1-10/scenario-d/contact-sheet.png`, `artifacts/W1-10/owner-review/scenario-b-video-contact-sheet.png`, and `artifacts/W1-10/scenario-b/scenario-b-full-flow-fast.mp4`.

## Capture environment

All native captures used only the already-running `emulator-5556`; it was never booted, killed, wiped, or snapshotted. The AVD is `fleet_floor_api31`, Android API 31, software GPU. Physical display is 1440×3120 px at 560 dpi. Native acceptance captures requested and read back `wm size 1080x1920` and `wm density 480`, which is 360×640 dp.

| Capture group | Build / surface | `wm` and density | animation scale read-back (window / transition / animator) | app-reported reduced motion |
|---|---|---|---|---|
| Pre-fix BASE reproduction | `da93dcd` BASE APK | 1080×1920 / 480 | 1 / 1 / 1 | unavailable in non-PERF release |
| A | pre-task HEAD baseline and OFF, commit `6f4d5dc` | 1080×1920 / 480 | 1 / 1 / 1 | unavailable in non-PERF release |
| B | ON capture build | 1080×1920 / 480 | 1 / 1 / 1 | unavailable in non-PERF release |
| C | BASE, then `adb install -r` ON | 1080×1920 / 480 | 1 / 1 / 1 | unavailable in non-PERF release |
| D | ON capture build | 1080×1920 / 480 | 0 / 0 / 0 | unavailable in non-PERF release; P-02 records the unavailable source, and the static renderer states are visible |
| E | Expo web in emulator Chrome, CDP viewport 375×812 CSS px at 2× | device override 1080×1920 / 480 | 0 / 0 / 0 during this web run | `matchMedia('(prefers-reduced-motion: reduce)') === true` |
| F | reuses B's three native 360×640 dp screenshots | 1080×1920 / 480 | 1 / 1 / 1 | unavailable in non-PERF release |

**EXECUTED:** P-02's machine-readable scale-0 manifest is `artifacts/W1-10/scenario-d/d-menu-scale0/manifest.json`; it names serial, AVD, API, requested/read-back display override, all three scales, release APK hash, and the non-PERF app-report limitation. Scenario A has corresponding P-02 manifests under `scenario-a/*-menu/`. The device was restored to physical display settings and 1 / 1 / 1 at the end and returned `device`.

## Build matrix

All three fresh release builds used Expo prebuild plus local Gradle release signing. `df -h /` was checked immediately before every Gradle build, builds were serial, and repository `android/app/build` plus `android/build` were removed afterward. The BASE source came from a read-only `git archive da93dcd` scratch tree; no checkout changed the working tree.

| Build | Source and environment | APK | SHA-256 |
|---|---|---|---|
| BASE fresh build | `da93dcd`; all FTUE variables unset | `artifacts/W1-10/apk/base-da93dcd-fresh-release-universal.apk` | `5be793763a29986c0ce4a1ef4f780587d7dce0d99d1a1cf2b74eccd0939da4d0` |
| BASE capture artifact | canonical exact pre-W0 BASE used for reproduction/C | `artifacts/W1-10/apk/base-da93dcd-release-arm64.apk` | `7556f834c720842d47385e066da7aec7b3e05ce2808ed443fe7b794f8f32a428` |
| OFF | pre-task HEAD `6f4d5dc`; all FTUE variables unset | `artifacts/W1-10/apk/off-6f4d5dc-release-arm64.apk` | `088a520e7e9c63ca372ea19d07f83b21478f51c93470c1dfcd2b5a9ad9a28d78` |
| ON capture-only | `6f4d5dc`; FTUE, assist, and stall flags `1`; stall **TEST VALUE 4000 ms** | `artifacts/W1-10/apk/on-6f4d5dc-ftue-assist-stall-4000ms-release-arm64.apk` | `ed5b91c8c695eed811d36be42d0a9aa35d33e57396b03da7d6a5e2525d860132` |

**EXECUTED:** `apksigner verify --print-certs` passed all build/capture APKs. Each reports `CN=Arrows`, certificate SHA-256 `24f7fa0b78b9c5cf3c81a1fec82198858599cb874e43ad6b17c9873f6c7a50f8`, so `install -r` is compatible. Machine-readable details are in `artifacts/W1-10/build-matrix.json`; build logs are under `artifacts/W1-10/logs/`.

**EXECUTED:** For ON only, `ftueConfig.ts` temporarily read the environment's 4000 ms **TEST VALUE**, then was immediately restored to committed `FTUE_STALL_HINT_MS: number | null = null`. The capture-only diff is `artifacts/W1-10/capture-only-config.patch`. This is not a production recommendation.

## Pre-fix reproduction

- **EXECUTED:** On BASE, three distinct blocked taps before a removal reduced hearts 3 → 2 → 1 → loss. Evidence: `pre-fix/base-loss-correct-heart2.png`, `base-loss-correct-heart1.png`, `base-loss-correct-panel.png`, and the 12.004 s `base-level1-three-blocked-loss-correct.mp4`.
- **EXECUTED:** BASE was then played through levels 1 and 2 to write real old-build AsyncStorage. `pre-fix/base-after-next2.png` shows `LEVEL 3`, Hard · Triangle · 139 left before the update used by C.
- **EXECUTED:** These are the original pre-W0 defect reproductions on the same emulator. Per controller ruling F04, BASE is not used as A's flag-OFF visual baseline.

## A — default build unchanged

- **EXECUTED:** A compares the exact immediate pre-task HEAD (`6f4d5dc`) against the OFF artifact built from that same source. Because W1-10 is verification-only and ships no source change, this is the ruling-F04 baseline and candidate.
- **EXECUTED:** `scenario-a/a-baseline-head-level1.png` and `scenario-a/a-off-level1.png` both show `LEVEL 1`, `Normal · Circle · 60 left`, 💡, three hearts, and the same board.
- **EXECUTED:** Pixel comparison found 3,562 changed status-bar pixels and **0 changed pixels below y=72**. See `scenario-a/comparison.json`. PASS.

## B — fresh install, flags ON

- **EXECUTED:** Fresh uninstall/install and a new 51.363856 s recording cover splash → menu → T1 → T2 first blocked → different second blocked → real level 1 → clear → post-clear menu: `scenario-b/scenario-b-full-flow-fast.mp4` and its timestamp log. This capture was made from current HEAD after W2-03, satisfying amendment F17; no tutorial terminal loss/redeal occurs in the required path.
- **EXECUTED:** T1 clears with 3/3 hearts. `scenario-b/02-t1-header-after-first-removal.png`.
- **EXECUTED:** T2's first fresh blocked tap is free, leaves 3/3 hearts, and shows exactly `Blocked. Clear what's in its way.`; a different second blocked arrow leaves 2/3 hearts. `scenario-b/04-t2-first-blocked-free-rule.png` and `05-t2-second-different-blocked-costs.png`.
- **EXECUTED:** `scenario-b/06-real-level1-before-taps-no-ad.png` is before the first real-board tap and contains no ad, `TEST AD`, or panel.
- **EXECUTED:** Three distinct real-level-1 blocked taps before any removal leave `60 left` and 3/3 hearts. One successful removal gives `59 left`; the next fresh blocked tap leaves 2/3 hearts. Evidence `08` through `10` in `scenario-b/`.
- **EXECUTED:** The menu after T2 has no stats line (`07-menu-after-t2-no-stats.png`). After clearing level 1 it reads `1 puzzle solved` (`12-menu-after-level1-one-puzzle-solved.png`).
- **EXECUTED:** Play tap to first successful T1 removal was **759 ms**, n=1, recorded by the implementer, who already knows the rules. Method and timestamps: `scenario-b/play-to-first-removal.json`. This is descriptive, not a learnability result.

## C — over-install of an existing player

- **EXECUTED:** BASE wrote `LEVEL 3`; ON was installed with `adb install -r` without clearing data. Cold-start menu `scenario-c-menu-level3.png` still shows Level 3 and `2 puzzles solved`.
- **EXECUTED:** Play resumes `LEVEL 3` with the 139-arrow Triangle and no tutorial board (`scenario-c-level3-resumed-no-tutorial.png`). The first blocked tap before a removal leaves 2/3 hearts (`scenario-c-level3-first-blocked-costs.png`). PASS.

## D — reduced motion

- **EXECUTED:** P-02 set, relaunched, and read back all three scales as 0; the run then repeated that setup from a cleared install. Exact event/capture timing is in `scenario-d/event-timings-and-readback.json`.
- **EXECUTED:** At +327 ms after T2's first blocked tap, the tapped arrow and its blocker are static magenta with no displacement; at +1,341 ms they are cleared and the rule line remains legible. At +5,352 ms the free arrow is a static, thicker accent hint, more than one second after the 4000 ms TEST deadline. Evidence: the first four panels of `scenario-d/contact-sheet.png` and their full-resolution files.
- **EXECUTED:** A different second blocked arrow produces the same static blocker at +339 ms, costs a heart, and is clear at +1,346 ms. The persistent rightmost accent arrow is the stall hint. Evidence: bottom-center/right panels of the contact sheet.
- **CONCERN:** The brief asks for screenshots at least one second after each event while also requiring W0-04's blocker state to remain visible. W0-04 intentionally removes blocked feedback before one second, and the +1.341/+1.346 s captures confirm that invariant. Separate early static-state and late post-event screenshots are therefore the closest non-falsified evidence; the hint itself is visible more than one second after onset.

## E — web state read-back

- **EXECUTED:** The literal `EXPO_PUBLIC_FTUE=1 EXPO_PUBLIC_FTUE_ASSIST=1 npx expo start --web --port 8097` reached Metro but exited on the managed sandbox's DevTools/watcher limitation. The `CI=1` retry kept the same flags-ON preview serving; it was stopped after verification.
- **EXECUTED:** Host headless Chrome could not open a CDP target, so the preview was exercised through scoped port 9340 in the already-running emulator Chrome at `http://10.0.2.2:8097`; the forward was removed afterward.
- **EXECUTED:** After T1: stage `"1"`; current level, total solved, day streak, and last-play day all `null`. After T2: stage `"2"`; those four campaign keys still `null`.
- **EXECUTED:** Level 1 one removal then one blocked tap leaves 2 hearts; non-perfect clear persists stage `"2"`, current level `"1"`, total solved `"1"`. Level 2's first blocked tap is free with 3 hearts; perfect clear persists stage `"3"`, current level `"2"`, total solved `"2"`.
- **EXECUTED:** Reload retains stage `"3"`; resumed level 3's first blocked tap leaves 2 hearts. Full values and PASS assertion: `scenario-e/state-readback.json`; screenshots `01` through `08` in `scenario-e/`.

## F — composite chrome and exact W1 copy

- **EXECUTED:** `scenario-f/composite-headers.png` contains one 360×640 dp source capture each for T1, T2's lesson/rule state, and real level 1.
- **INFERRED from the consumed W1-05 measurement, not re-measured:** T1 `cellPt = 67.68 dp`; T2 `cellPt = 67.68 dp`; both exceed 48 dp. Source: `artifacts/W1-05/viewport/cell-metrics.txt`, restated in `scenario-f/cell-metrics-consumed.txt`.
- **EXECUTED:** `src/ui/ftueCopy.ts` exports exactly these three strings, and the final Jest run includes the exact-count test:
  1. `Tap an arrow.`
  2. `One arrow is free. Find it.`
  3. `Blocked. Clear what's in its way.`

## Owner decisions

These decisions do not enable the flags and do not approve the 4000 ms TEST VALUE.

1. Review `artifacts/W1-10/scenario-f/composite-headers.png` and full-resolution B screenshots.
   - **YES:** approve all three strings above verbatim.
   - **NO:** supply replacement wording for each rejected string, or choose the wordless alternative.
2. Review `artifacts/W1-10/scenario-b/scenario-b-full-flow-fast.mp4`, `04-t2-first-blocked-free-rule.png`, `05-t2-second-different-blocked-costs.png`, and `08`–`10` level-1 assist screenshots.
   - **YES:** accept the one-free-fresh-blocked-tap assist behavior shown for T2 and stage-2 real boards.
   - **NO:** reject the assist behavior; keep its flag OFF.
3. Review `artifacts/W1-10/scenario-d/contact-sheet.png`.
   - **YES:** accept W0-04's static blocker/static hint reduced-motion appearance and the tutorial-only stall-hint behavior, while keeping the stall flag OFF and production delay `null` pending W1-11.
   - **NO:** reject the static appearance and/or stall-hint behavior; keep the flag OFF and identify which state must change.

## Unverified and non-claims

- **UNVERIFIED-DEVICE:** physical Android phone insets, touch behavior, GPU rendering, and font rendering.
- **UNVERIFIED:** iOS, per `docs/IOS_BOARD_PLAN.md`.
- **UNVERIFIED / non-goal:** whether the tutorial teaches; W1-09 owns learnability evidence.
- **UNMEASURED:** a production stall-hint delay. 4000 ms is capture-only.

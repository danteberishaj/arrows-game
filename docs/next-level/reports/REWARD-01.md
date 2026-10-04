# REWARD-01 — reward path

2026-10-04. **Tasks 1–8 complete.** Implementation and report remain uncommitted on `next-level`. Full Jest, TypeScript and required Android device scenarios pass; original save and settings are restored. Read-command retention limits are recorded below.

## Result and scope

Added the default-OFF `EXPO_PUBLIC_META_REWARD_PATH` gate, effective only with the Android skin picker. The fixed path unlocks the existing 18-style catalogue through campaign and daily clears. It credits existing progress and selected styles, retains owned bits, observes SAVE-GUARD, shows win-panel progress or a reveal, and divides the picker into “Your styles” and “Coming up”.

The implementation covers pure path math, the catalogue, the RN-free ledger and separate UI gate, conditional hydration, the progress pill, the sectioned picker, the reveal card, and narrow GameScreen integration. It does not add spending, new skins, renderer changes, exit effects, board themes, sound packs, telemetry, notifications or iOS support. Ad pacing and the existing Next/Done routes are unchanged.

The reveal uses the existing guarded panel motion. It has no entrance animation or background/radius/padding/shadow of its own. Decorative sparkles use one 600 ms opacity sequence with explicit `ReduceMotion.System`; reduced motion omits them. Locked previews alone are dimmed; locked text retains `inkDim` at full opacity. Exact picker contrast source pointers were updated.

Start: branch `next-level`, HEAD `2c47245a6a70e8d71d792412e5ea9865c4538590`. The agent made no commits, push, EAS calls or dependency installs. Every retained shell command uses Node v20.19.4. Device work is restricted to `emulator-5556` / `fleet_floor_api31`.

## Approved amendments and stops

The [owner-approved spec](../../superpowers/specs/2026-10-04-reward-path-design.md) wins over the [implementation plan](../../superpowers/plans/2026-10-04-reward-path.md). Conflicting tasks were stopped before implementing the disputed instruction. The controller then supplied these documentation commits in the shared working tree:

| Controller commit | Resolved instruction |
| --- | --- |
| `95407d1` | On first-launch credit, seed reveal history from the points-reached count. A reward owned before a clear has no reveal when its threshold is reached; the selected-Rainbow regression covers earlier Critter reveals and a silent Rainbow reach. |
| `a84774b` | “New” dots are bounded by `reachedIndex`; owned rows use catalogue order; only locked previews are dimmed; the reveal inherits existing guarded panel motion without adding its own entrance. |
| `d3850a8` | `rewardGate.ts` owns platform/flag imports; the ledger stays RN-free. Disabled hydration preserves the exact `SaveSystem.persistenceKeys` array identity. |
| `a555fc4` | The reveal renders as panel content on the existing shadow-free fill, with no card-owned container chrome. |
| `8bf6a60` | Task 3 includes updating the existing W3-05 source-order test's hydration-call anchor to the required two-argument App call. |

The controller also clarified that controls for unchanged behavior may pass before implementation. It required deliberate guard mutations after Tasks 5 and 7, followed by exact restoration and green reruns; those results are below.

Only the W3-05 anchor string was changed in `src/ui/__tests__/gameSessionLifecycle.test.ts`: from `initSaveSystem(skinPickerEnabled())` to `initSaveSystem(skinPickerEnabled(), rewardPathEnabled())`. Its ordering assertions remain intact: hydration exists; `.then` follows hydration; stamping follows `.then` and precedes ready; ready precedes `.catch`; stamping occurs exactly once. The old literal could not locate the prescribed new call, producing `init = -1`. This is an approved anchor correction, not a weakened ordering check.

## Test-first evidence

All new-behavior tests were written and run before their implementation. Missing-module/old-interface failures are the expected red results for the new files and signature. Sandbox runner failures and the Task 6 extraction error are retained separately and do not count as TDD red evidence.

| Task / command | Red before implementation | Green after implementation |
| --- | --- | --- |
| 1: `npx jest src/core/__tests__/rewardPath.test.ts`; `npx jest src/__tests__/featureFlags.test.ts` | [Path](../../../artifacts/REWARD-01/checks/task-1-path-red.log): missing module, TS2307. [Flag](../../../artifacts/REWARD-01/checks/task-1-flag-red.log): 2 assertions fail, 22 pass. | [Combined](../../../artifacts/REWARD-01/checks/task-1-green.log): 2 suites / 30 tests pass. |
| 2: `npx jest src/ui/__tests__/rewardCatalogue.test.ts` | [Red](../../../artifacts/REWARD-01/checks/task-2-red.log): missing catalogue, TS2307 plus consequent inferred-any errors. | [Green](../../../artifacts/REWARD-01/checks/task-2-green.log): 1 suite / 4 tests pass. |
| 3: `npx jest src/ui/__tests__/rewardLedger.test.ts`; `npx jest src/ui/__tests__/storage.test.ts` | [Ledger](../../../artifacts/REWARD-01/checks/task-3-ledger-red.log): missing ledger. [Storage](../../../artifacts/REWARD-01/checks/task-3-storage-red.log): missing ledger and old signature. | [Combined](../../../artifacts/REWARD-01/checks/task-3-green.log): 2 suites / 41 tests pass; [tsc](../../../artifacts/REWARD-01/checks/task-3-tsc.log) exit 0. |
| 4: `npx jest src/ui/__tests__/RewardProgressPill.test.tsx` | [Red](../../../artifacts/REWARD-01/checks/task-4-red.log): missing pill. | [Pill + Settings + contrast](../../../artifacts/REWARD-01/checks/task-4-green.log): 3 suites / 273 tests pass. |
| 5: `npx jest src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx` | [Red](../../../artifacts/REWARD-01/checks/task-5-red.log): 4 new-behavior tests fail; unchanged flag-off control passes. | [Rewards + Settings + contrast](../../../artifacts/REWARD-01/checks/task-5-green-retry.log): 3 suites / 287 tests pass. |
| 6: `npx jest src/ui/__tests__/RewardRevealCard.test.tsx` | [Red](../../../artifacts/REWARD-01/checks/task-6-red.log): missing reveal component. | [Green](../../../artifacts/REWARD-01/checks/task-6-green.log): 1 suite / 4 tests pass. |
| 7: `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx` | [Red](../../../artifacts/REWARD-01/checks/task-7-red.log): 5 new-behavior tests fail; flag-off, benchmark and tutorial controls pass. | [Green](../../../artifacts/REWARD-01/checks/task-7-green.log): 1 suite / 8 tests pass. |

Task 5's [first implementation run](../../../artifacts/REWARD-01/checks/task-5-green.log) retained one failure: the reached Critter row lacked its “new” accessibility suffix. Correcting the lookup to use the numeric reward/style ID produced the 287-test green run above.

Task 6 initially extracted the interface example instead of the actual test block. The [syntax failure](../../../artifacts/REWARD-01/checks/task-6-test-extraction-error.log) is retained; the test file was corrected before the missing-component red run. No component implementation existed during either run.

### Unchanged-behavior control mutations

Every temporary mutation was removed before acceptance checks. The [Task 7 mutation driver log](../../../artifacts/REWARD-01/checks/task-7-control-mutations.log) records each command's exit 1 and exact restoration.

| Control | Temporary break and observed red | Restored green |
| --- | --- | --- |
| Task 5 flat flag-off picker | Forced the reward mode despite its absent state. `npx jest src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx -t "rewards off"`: [1 fails / 4 skipped](../../../artifacts/REWARD-01/checks/task-5-control-mutation-red.log), detecting the unexpected owned section. | Same command: [1 passes / 4 skipped](../../../artifacts/REWARD-01/checks/task-5-control-restored-green.log). |
| Task 7 flag off | Bypassed the reward gate in the clear branch. `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx -t "flag off:"`: [1 fails / 7 skipped](../../../artifacts/REWARD-01/checks/task-7-flag-off-mutation-red.log), detecting reward-key access. | All 8 integration tests [pass after restoring all guards](../../../artifacts/REWARD-01/checks/task-7-controls-restored-green.log). |
| Task 7 benchmark | Called `recordRewardClear` in the benchmark branch. `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx -t "benchmark clears earn nothing"`: [1 fails / 7 skipped](../../../artifacts/REWARD-01/checks/task-7-benchmark-mutation-red.log), detecting the forbidden call. | Same restored 8-test green run. |
| Task 7 tutorial | Called `recordRewardClear` in the tutorial branch. `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx -t "tutorial clears earn nothing"`: [1 fails / 7 skipped](../../../artifacts/REWARD-01/checks/task-7-tutorial-mutation-red.log), detecting the forbidden call. | Same restored 8-test green run. |

The integration suite uses the real ledger and selection over MapStore. Its flag-off case clears initialization accesses and retains an active ledger so bypassing the gate can actually fail. Its review case qualifies under the real policy (31 solved, perfect, unassisted, healthy persistence, no interstitial due, no prior session ask). Its campaign Use test holds the interstitial unresolved: the card precedes the press; Critter is selected and the ad starts after the press; the board changes only after closing the ad. The test does not independently assert selection precedes ad invocation.

## Full acceptance checks and retained failures

**Final code verification:** `npx jest --silent` passes **126 suites / 2,116 tests / 12 snapshots** in **133.086 s**, compared with the supplied baseline **119 suites / 2,062 tests**. `npx tsc --noEmit -p .` exits **0**. Logs: [full final retry](../../../artifacts/REWARD-01/checks/full-jest-amended-retry.log), [TypeScript](../../../artifacts/REWARD-01/checks/tsc-amended.log).

Earlier runs remain part of the evidence:

| Run | Observed result and correction |
| --- | --- |
| [Interim full suite after Task 2](../../../artifacts/REWARD-01/checks/full-jest-after-task-2.log) | 121 suites / 2,073 tests / 12 snapshots pass, 347.221 s. This preceded completed integration and is not final acceptance. |
| [First integrated full run](../../../artifacts/REWARD-01/checks/full-jest-final.log) | 124 suites pass / 2 fail; 2,114 tests pass / 2 fail; 12 snapshots pass, 206.862 s. Failures were explicit reduced-motion policy on the new sparkle timing calls, and the stale W3-05 one-argument hydration anchor. |
| [Sparkle correction](../../../artifacts/REWARD-01/checks/sparkle-policy-correction-green.log) | Both sparkle timing configs now state `ReduceMotion.System`. Reveal plus motion-policy checks: 2 suites / 7 tests pass. No card entrance animation was added. The source-order conflict was stopped and amended by the controller before changing the anchor. |
| [First full run after the anchor amendment](../../../artifacts/REWARD-01/checks/full-jest-amended.log) | 125 suites pass / 1 fail; 2,115 tests pass / 1 fail; 12 snapshots pass, 259.515 s. Existing `adsRewardedNativeEvent.test.ts:356` exceeded its existing 20-second timeout while initializing the package. |
| [Unchanged isolated ads rerun](../../../artifacts/REWARD-01/checks/ads-native-event-timeout-rerun.log) | 1 suite / 8 tests pass, 8.465 s, with no ads/test/timeout change. The cause of the transient timeout is unproven. |
| [Unchanged full retry](../../../artifacts/REWARD-01/checks/full-jest-amended-retry.log) | 126 suites / 2,116 tests / 12 snapshots pass, 133.086 s. TypeScript then exits 0. |

Initial Watchman socket denials are retained as [path runner blocked](../../../artifacts/REWARD-01/checks/task-1-path-runner-blocked.log) and [flag runner blocked](../../../artifacts/REWARD-01/checks/task-1-flag-runner-blocked.log). Later approved test runs reached the intended red assertions. Existing Watchman recrawl warnings and a worker force-exit warning occurred in some full runs; watcher state and unrelated processes were not changed.

## Command/result index

The exact retained shell inputs and returned results are indexed in the artifact JSON snapshots. These snapshots overlap; the through-Task-7 snapshot includes 79 root command entries; the final snapshot adds Task 8 and final verification. Asynchronous command entries may retain their initial running-session result; terminal Jest summaries are in the logs linked above.

| Record | Coverage |
| --- | --- |
| [Initial command/results JSON](../../../artifacts/REWARD-01/checks/command-results.json) | 11 entries through Tasks 1–2. |
| [Through Task 5 red](../../../artifacts/REWARD-01/checks/command-results-through-task-5-red.json) | 26 entries. |
| [Through Task 6](../../../artifacts/REWARD-01/checks/command-results-through-task-6.json) | 47 entries. |
| [Task 7 stopped](../../../artifacts/REWARD-01/checks/command-results-task-7-stopped.json) | 70 entries, including the motion failure and stale-anchor conflict. |
| [Through Task 7 green](../../../artifacts/REWARD-01/checks/command-results-through-task-7-green.json) | 79 entries, including the approved anchor correction, transient ads timeout, isolated rerun and full green retry. |
| [Integration test subagent inventory](../../../artifacts/REWARD-01/checks/integration-tests-command-inventory.md) | Exact read commands, failed path reads, Expo v57 docs call and test-file patch operation; numerical-output and patch-body retention gaps are labeled. |
| [Final root command/results](../../../artifacts/REWARD-01/checks/command-results-final.json) | Exact retained shell inputs and results through Task 8 and final checks; build/Jest terminal logs supplement asynchronous initial results. |
| [Device subprocesses](../../../artifacts/REWARD-01/device/commands.jsonl) | Every driver subprocess, argv, exit, output/timestamp; screenshot byte hash instead of binary stdout. Direct install/start/stop/hash commands are in the final root inventory. |
| [Resumed read inventory](../../../artifacts/REWARD-01/checks/continuation-read-inventory.md), [read-only reviews](../../../artifacts/REWARD-01/checks/verification-review-inventory.md) | Exact resumed prerequisite/report reads and later reviewer commands/results. |

**Initial prerequisite-read retention gap:** the root's earliest read-only prerequisite commands preceded its persisted command array. Those exact initial command inputs/results were not fully retained in the first JSON, so this report does not claim that the JSON is a complete exact inventory of those reads. The recorded progress ledger documents the required spec, plan, AGENTS, engineering-lessons, skins/latest report, Expo v57 and skill reads. Further report-drafting reads are listed in the appendix below.

## Device verification

All actions target `emulator-5556` / `fleet_floor_api31`, Android API 31. It was stopped at first contact; the task started that AVD on port 5556 with `-no-snapshot-save`. No other emulator or session process was controlled.

| Build | Result / pre-Gradle free space | APK SHA256 / proof |
| --- | --- | --- |
| Reward ON | `BUILD SUCCESSFUL in 35m 21s`, 646 tasks (618 executed, 28 up-to-date); **13 GiB** free before Gradle. | `cfdb09149082ea3910f4bc90a9f585fea58c9002ac3db0757e1ecd43e06e22e9`; [ON proof](../../../artifacts/REWARD-01/checks/bundle-proof-on-retry.log). |
| Reward unset | `BUILD SUCCESSFUL in 2m 16s`, 646 tasks (41 executed, 605 up-to-date); **6.9 GiB** free before Gradle. | `c56251b7a4bc317bd2d325c3e4a800431edef3f613d737b89434885956d303c4`; [OFF proof](../../../artifacts/REWARD-01/checks/bundle-proof-off.log). |

Both Hermes bundles are 3,366,236 bytes. Each has 9 UTF-8 occurrences of `3940256099942544` and 0 UTF-16LE occurrences. Each of `6706292920`, `7549521178`, `3505414519`, `5508761320` has **zero occurrences in both encodings**. The ON bundle contains “NEW STYLE UNLOCKED” and “Coming up”. The OFF environment file has no reward-path variable. Each proof preceded its `install -r -d`; both installs returned `Success`. No uninstall occurred.

The [ON wrapper log](../../../artifacts/REWARD-01/checks/build-on-driver-retry.log) retains a post-build copy failure: editing the wrapper while it was running shifted its remaining shell input and caused an EOF parse error. Gradle itself had succeeded; a logged direct copy recovered the completed APK without another build. The first proof attempt failed because that copy had not happened. The retry above is the proof used for installation. The wrapper then passed `sh -n` and completed the OFF build normally. [ON Gradle](../../../artifacts/REWARD-01/build-on/build.log), [OFF Gradle](../../../artifacts/REWARD-01/build-off/build.log), [OFF wrapper](../../../artifacts/REWARD-01/checks/build-off-driver.log) retain terminal results. Before the successful ON build, a broad process guard also stopped on an unrelated idle Gradle daemon; inspection showed no active build, the guard was narrowed to active launchers, and that daemon was left untouched.

Save backup preceded every SQL fixture edit: the exact `/data/local/tmp/RKStorage.bak` copy plus task-specific copies of `RKStorage` and its existing journal. Local `.original` copies, original UID/GID/mode, ordered key/value rows, all three animation scales, display size and density are in [save-backup.json](../../../artifacts/REWARD-01/device/save-backup.json). The initial pull was denied by backup-copy permissions; only the copies were made readable, and original permissions were retained for restoration.

| Check | Observed result |
| --- | --- |
| Fresh light and dark | Separate reward-key-free, zero-solved fixtures; each clears campaign levels 1 and 2 through legal board input. First clear: points **2**, owned bits **21**, pill “+2 points · 1 more level”. Second: points **4**, owned bits **85**, reveal seen **1**, Critter card in both themes. |
| “Play with Critter” | Persists style ID **6**; after BACK closes the labelled test ad, Level **3**, **139 left**, draws Critter arrows on its mint board. The first BACK moved the video creative to its end card; a second BACK dismissed it. No ad tap was sent. |
| Fresh picker | Catalogue order Classic, Sherbet, Candy Gloss, Critter; “Your styles”, “4 of 18”, “Coming up”; Critter checked. Opening moves picker-seen to **1**. |
| Upgrade | Original backup restored first. Only 10 solved, Cinnamon ID **1**, and deletion of reward rows are seeded. Silent credit: points **10**, owned bits **87**, seen/picker-seen **2**; “5 of 18”, Critter and Cinnamon owned, Cinnamon checked, no “new” labels. |
| Reduced motion | Transition scale **0**. Entrance recording and screenshot show the card without sparkles. Original scale **1** restored before the next scenario. |
| Interstitial order | Seeded two credited points and one finished game; the real clear reaches points **4** and finished-games **2**. Recording: card → press → labelled test ad → BACK → next Critter board. Save changes style **0→6**; showing the ad resets finished-games **2→0**. |
| Flag unset | Original flat picker; ordinary Cleared!/stars/level caption/Next level panel. Database has **0 reward rows** after opening and after a real campaign clear. [Evidence assertions](../../../artifacts/REWARD-01/device/flag-off-proof.json); unit control proves zero reward-key reads/writes. |
| Final save/settings/display restoration | [Proof](../../../artifacts/REWARD-01/device/restore-proof.json): original ordered rows, all animation scales **1/1/1**, physical size **1440×3120**, density **560** match. [Database and journal hashes](../../../artifacts/REWARD-01/device/restored-file-hashes.txt) match local originals exactly; app stopped. The task-started emulator was then stopped, restoring its initial stopped state. |

The [85.132 s recording](../../../artifacts/REWARD-01/interstitial-order.mp4) and [timeline](../../../artifacts/REWARD-01/device/interstitial-timeline.json) place the primary press at **30.180 s** and BACK at **60.389 s**. Extracted frames show the card at ~2 s, “Test Ad” at ~32 s, and next Critter board at ~63 s. The [8.441 s reduced-motion recording](../../../artifacts/REWARD-01/reduced-motion.mp4) includes the entrance; its 1.4 s frame has no sparkle decoration. Only each recording's own verified PID was stopped.

The driver aborted safely on an API 31 focus-query mismatch (`dumpsys window windows` omits the focus summary) and on a home screen still mounting after launch. It now uses the full window dump and a six-second launch wait; every tap still requires a fresh matching hierarchy and app focus. The failed early capture is labelled diagnostic. A screenshot taken after the first ad BACK was also an end card; it and its hierarchy were renamed diagnostic, and only the subsequent MainActivity/Level 3 evidence is used for the board claim. Normal clears compare the remaining-arrow count after every batch and require an observed terminal panel after the final tap.

### Screenshot / recording index

All capture files are under `artifacts/REWARD-01/`. The root inspected every required screenshot. A separate read-only reviewer checked the pill/light reveal and the order/reduced-motion movie frames; another checked ledger and picker hierarchy evidence.

| ID | Capture | Observation |
| --- | --- | --- |
| D01 | [fresh-pill-light.png](../../../artifacts/REWARD-01/screens/fresh-pill-light.png) | Critter preview; +2 points; 1 more level. |
| D02 | [fresh-critter-reveal-light.png](../../../artifacts/REWARD-01/screens/fresh-critter-reveal-light.png) | Planned badge, stage, three sparkles, copy, chips and actions. |
| D03 | [fresh-critter-reveal-dark.png](../../../artifacts/REWARD-01/screens/fresh-critter-reveal-dark.png) | Same reveal in dark palette. |
| D04 | [fresh-critter-board.png](../../../artifacts/REWARD-01/screens/fresh-critter-board.png) | Level 3 Critter board after Use and BACK. |
| D05 | [fresh-picker.png](../../../artifacts/REWARD-01/screens/fresh-picker.png) | Owned catalogue order and upcoming section; Critter checked. |
| D06 | [upgrade-picker.png](../../../artifacts/REWARD-01/screens/upgrade-picker.png) | Five owned styles; Cinnamon checked; no dots. |
| D07 | [reduced-motion-reveal.png](../../../artifacts/REWARD-01/screens/reduced-motion-reveal.png), [entrance frame](../../../artifacts/REWARD-01/screens/reduced-motion-entrance-frame.png), [recording](../../../artifacts/REWARD-01/reduced-motion.mp4) | No sparkles, including entrance. |
| D08 | [order-card.png](../../../artifacts/REWARD-01/screens/order-card.png), [order-test-ad.png](../../../artifacts/REWARD-01/screens/order-test-ad.png), [order-next-level.png](../../../artifacts/REWARD-01/screens/order-next-level.png), [recording](../../../artifacts/REWARD-01/interstitial-order.mp4) | Required card/press/ad/BACK/next sequence. |
| D08a | [card frame](../../../artifacts/REWARD-01/screens/order-record-card-frame.png), [ad frame](../../../artifacts/REWARD-01/screens/order-record-ad-frame.png), [next frame](../../../artifacts/REWARD-01/screens/order-record-next-frame.png) | Movie frames at ~2/~32/~63 s independently reviewed. |
| D09 | [flag-off-picker.png](../../../artifacts/REWARD-01/screens/flag-off-picker.png) | Original flat list, Classic selected. |
| D10 | [flag-off-win.png](../../../artifacts/REWARD-01/screens/flag-off-win.png) | Ordinary Cleared!/stars/level caption/Next level, no reward UI. |

Auxiliary `level-*-fitted-*.png` images show fitted boards before input; `diagnostic-*` images and `fresh-use-route.png` retain driver/ad troubleshooting. They are not substitute acceptance captures.

## Changes outside the plan, helpers and preservation

**No additional product behavior outside the amended plan.** The W3-05 anchor update is explicitly in the controller-amended Task 3. The local 12 dp SVG padlock is the plan's authorized fallback because the existing icon set has no lock. Adding explicit sparkle `ReduceMotion.System` implements the existing motion-policy contract. One mechanical change beyond Task 7's listed files: existing GameScreen `file:line` sites in `contrastAudit.ts` moved with its added imports/content so the existing source-location audit remains valid; colors and contrast rules did not change.

Verification helpers and temporary operations are kept separate from product changes:

- Extra flag, contrast-pointer, intermediate full-suite and targeted motion-policy checks exercise specified invariants.
- Temporary Task 5 and Task 7 guard mutations were deliberate negative controls required by the controller and were fully reverted.
- The ignored `.superpowers/sdd/2026-10-04-reward-path/` workspace records task progression and briefs.
- Task 8 helpers adapt LOG-GATE: ON/OFF modes, test-ads flags, `--no-install`, exact ABIs, two disk checks, an active-launcher guard, and no broad cache/process cleanup. OFF reuses the ON native project because only the JS flag changes. After ON finishes, only this task's generated app `intermediates/cxx`, `merged_native_libs` and `native_symbol_tables` are removed to recover disk space. OFF's preflight passes at 6.9 GiB; no concurrent build occurs.
- Supplemental ignored helpers: `build-test-apk.sh`, `prove-bundle.py`, `device.py`, evidence assertions/timeline and video frame extraction. Existing hierarchy/input drivers are copied under task-specific device paths. Only owned screen-record PIDs are stopped.
- Fresh fixtures additionally seed Classic, light/dark mode, finished-game count 0, completed FTUE stage 3 and perfect-streak count 0 for reproducible campaign captures. Dark repeats the actual fresh two-clear run. Reduced/order fixtures seed two credited points via solved=2, current level=1; the threshold is crossed by a real clear. Order seeds finished-games=1 so that clear makes exactly 2 due. These are device test preparation, not product changes. Upgrade uses only the plan's two seeded values after restoring the original backup.
- The task starts/stops its initially stopped designated emulator, changes only transition animation scale for the reduced-motion check, and restores original save files, ownership/permissions, context, animation/display values. The proven OFF test-ad APK remains installed; no real-ad or iOS build was made.
- The pre-existing “Workflow Studio” edit is preserved byte-for-byte. [Preservation proof](../../../artifacts/REWARD-01/checks/lessons-preservation.json) verifies the original 57,783-byte prefix and starting SHA256. Exactly one lesson is appended at the end: decorative timing still requires explicit reduced-motion policy, with failed source-audit evidence and passing unit/device verification.

## UNVERIFIED and limits

- Exact raw inputs/results for the earliest prerequisite reads and some earlier read-only review calls were not fully retained before command recording. Required documents were read; functional test/build/device commands and their terminal evidence are retained. This is a command-inventory retention gap, not an implementation or device-scenario gap.
- Device screenshots show the visible picker rows; later rows were not separately scrolled for visual evidence. Catalogue order/content and every registered skin's existing fit/contrast contracts are covered by the full suite; no skin art or renderer changed.
- On-device storage-read tracing was not added. The flag-off unit control proves zero reward-key reads/writes (and its guard mutation fails); the device verifies zero reward rows after picker/clear and unchanged UI.
- The isolated existing ads initialization timeout's cause remains unproven; unchanged isolated and full retries pass. No timeout or ads behavior was changed.

No required device scenario remains pending. Final `git diff --check` and the source-anchor/dependency/scope checks are recorded in the final command inventory.

## Report-drafting read appendix

This subagent wrote only this report during the draft stage. No tests, builds, device actions or implementation edits were run. The following exact read commands used the required Node prefix. Output summaries are retained here; numerical execution status was not printed by these read-only calls.

### R1: artifact and progress inventory

```sh
export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH
rg --files artifacts/REWARD-01/checks
cat .superpowers/sdd/2026-10-04-reward-path/progress.md
cat artifacts/REWARD-01/checks/command-results-through-task-7-green.json
cat artifacts/REWARD-01/checks/integration-tests-command-inventory.md
```

Result: file index, progress ledger and command inventories returned. The large JSON response was truncated (137,501 original tokens in the command output; 24,028 in the rendered tool response). Targeted log summaries were read next.

### R2: retained red/green counts and motion/anchor sources

```sh
export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH
python3 - <<'PY'
from pathlib import Path
import json
p=Path('artifacts/REWARD-01/checks')
logs=['task-1-path-red','task-1-flag-red','task-1-green','task-2-red','task-2-green','task-3-ledger-red','task-3-storage-red','task-3-green','task-4-red','task-4-green','task-5-red','task-5-green','task-5-green-retry','task-5-control-mutation-red','task-5-control-restored-green','task-6-test-extraction-error','task-6-red','task-6-green','task-7-red','task-7-green','task-7-control-mutations','task-7-flag-off-mutation-red','task-7-benchmark-mutation-red','task-7-tutorial-mutation-red','task-7-controls-restored-green','full-jest-final','sparkle-policy-correction-green','full-jest-amended','ads-native-event-timeout-rerun','full-jest-amended-retry']
for name in logs:
 f=p/(name+'.log')
 print(name)
 lines=f.read_text().splitlines()
 print('\n'.join(lines[-9:]))
for name in ['command-results.json','command-results-through-task-5-red.json','command-results-through-task-6.json','command-results-task-7-stopped.json','command-results-through-task-7-green.json']:
 data=json.loads((p/name).read_text())
 print(name, len(data), 'entries')
PY
rg -n 'ReduceMotion|_initSaveSystem|initSaveSystem\(' src/ui/RewardRevealCard.tsx src/ui/__tests__/gameSessionLifecycle.test.ts App.tsx
cat artifacts/REWARD-01/checks/task-7-control-mutations.log
cat artifacts/REWARD-01/checks/task-6-test-extraction-error.log
```

Result: exact suite/test/time tails, snapshot entry counts (11/26/47/70/79), current `ReduceMotion.System` configs, two-argument hydration anchor, all three mutation exits and extraction syntax failure were returned.

### R3: first implementation/full-run failures and Task 8 helper review

```sh
export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH
sed -n '1,95p' artifacts/REWARD-01/checks/task-5-green.log
rg -n -A 24 -B 3 '^FAIL|●|reduceMotion|initSaveSystem|Expected|Received' artifacts/REWARD-01/checks/full-jest-final.log
sed -n '355,385p' src/ui/__tests__/gameSessionLifecycle.test.ts
rg -n '^### Task 8|8bf6a60|W3-05|reduceMotion' docs/superpowers/plans/2026-10-04-reward-path.md
rg --files artifacts/REWARD-01
cat artifacts/REWARD-01/build-test-apk.sh
```

Result: Critter's missing “new” label failure, both full-run failures, preserved W3-05 assertions, amended plan instruction, artifact inventory and current test-only build helper were returned. The helper was only read, not run by this agent.

### R4: report creation

`tools.apply_patch` added `docs/next-level/reports/REWARD-01.md` with this draft. Its exact body is this report; the calling tool result is retained in the conversation. Device placeholders are intentionally not acceptance claims.

## Controller review

2026-10-04, controller. **Verdict: APPROVE behind the default-OFF flag; owner look review pending.**

| Check | Register | Evidence |
| --- | --- | --- |
| Tests and types | Executed | tsc exit 0; full jest 126 suites / 2,116 tests / 12 snapshots on the delivered tree. |
| Boot and save wiring | Read | Picker off: `SaveSystem.persistenceKeys` is passed as the identical array. Picker on: the reward keys hydrate only with the reward flag. The ledger is `writable: healthy` (SAVE-GUARD). The ledger and catalogue import no react-native; the gate lives in `rewardGate.ts`. |
| Integration | Read | Earning only in the non-benchmark win branch (tutorial branch untouched); review ask skipped on a reveal clear; the card's buttons reuse `onNextLevel`/`onDailyDone`, so ad, scrim and review ordering are unchanged. |
| Test edits | Read | W3-05: only the anchor string changed; every ordering assertion is intact. |
| Device look | Executed (viewed) | Pill, reveal light and dark, Critter board, fresh and upgrade picker, reduced-motion reveal, flag-off win panel. All numbers match the spec table: 4 points gives "Up next: Cinnamon Roll · 4 levels"; 10 points gives "Jelly · Next · 4 levels". |

**Look findings for the owner:**
1. The pill caption wraps to two lines in the narrow win panel.
2. The reveal stage's arrow is a scaled-up 54×30 thumbnail, so it looks heavy-outlined next to the real Critter board.

Neither blocks a test build.

**Risk line.** No real phone has run this. The emulator scenarios used seeded saves and test ads. Pacing (points per unlock) is a starting value.

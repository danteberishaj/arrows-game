# ART-SKINS-06 — Android runtime Arrow style picker

2026-10-01. Author verification; independent Controller review has not occurred. **Default OFF. OWNER REVIEW PENDING.**
Base: `1d61234ed5e17066590769410b147a10456d3754`. Applied the requested ART05 `skin-code-on-5581670.patch` before implementing runtime selection. No commits, push or EAS. Node v20.19.4, local test-ads/PERF APKs, only emulator-5556 / fleet_floor_api31 was operated.

## Result and acceptance ledger

Settings → Arrow style offers Classic, Cinnamon Roll and Sherbet in registry order. Each row is a real checked radio with a static spec-colour SVG preview and a 60 dp target. Selecting updates the preference immediately; the next board receives that selection. Switching an already mounted board updates one JSON prop on the same native view, with one preparation, preserving geometry and camera. Classic uses today's flat paths.

| Item | Status | Evidence |
| --- | --- | --- |
| P1 tests + TypeScript; red-first controls | PASS | 117 suites / 1,963 tests / 12 snapshots; `checks/jest-all-final.txt`, `checks/tsc.txt`. Base control: 3 suites / 12 assertions fail, 42 pass, `checks/base-red.txt`. |
| P1 save ownership / SAVE-GUARD / downgrade | PASS | All 29 existing keys round-trip byte-for-byte ON/OFF; isolated PERF preference store; failed-read and non-default restart/downgrade tests. |
| P2 sequence / light and dark / restart | CAPTURED; OWNER REVIEW PENDING | `screens/settings-switch-restart.mp4`, light/dark picker, runtime Cinnamon/Sherbet/Classic and both default/non-default restart captures. Full-detail board at **29.387754 dp**. |
| P3 tap → first visible board | REPORTED; no gate | Six switches per choice, recorded boundary frames and clock/tap logs; **29.387754 dp** each. See measurement table and limitations below. |
| P4 separate flag-unset APK / literal HEAD comparison | PASS | Identical 15 asset names already audited. Final pixel and downgrade evidence below. |

All screenshots and measurements are under [artifacts/ART-SKINS-06](../../../artifacts/ART-SKINS-06/). Earlier ART05 **K7 opening FAIL** and quiet-host exit **UNVERIFIED** remain unchanged. This picker adds no new skin, unlock, iOS renderer or sound behavior.

## Flag, registry and save safety

`EXPO_PUBLIC_META_SKIN_PICKER=1` is exact-value opt-in. Unset/other values, iOS and web expose no picker or procedural board props and perform no skin preference read/write. The old `EXPO_PUBLIC_ART_SKIN` build variable cannot enable runtime art. The normal OFF hydrate still reads exactly the existing `SaveSystem.persistenceKeys`.

`ARROW_STYLES` derives procedural entries from the single `SKIN_SPECS` registry, preceded by Classic metadata. Stable IDs are Classic **0**, Cinnamon **1**, Sherbet **2**. Names/order are display data; numbers are never reused. A new spec adds data and passes the existing skin contract; native rendering never switches on skin IDs.

The only new disk key is integer `arrows_skin`. Normal enabled boot appends it to one initial hydration; selection reads the cache afterward. Missing, unknown, removed or malformed values fall back to Classic without a repair write. Changing the selection uses the existing guarded/coalesced writer; reselecting the current choice writes nothing. No schema bump, migration change, existing key addition to the unconditional registry, or changed parsing of existing values.

`arrowStylePersistence.test.ts` seeds every existing key (29), checks byte-for-byte retention after choice and restart with the gate ON/OFF, and exercises failed hydration. Failed reads keep memory-only interaction and cannot overwrite the unread preference or progress. A subsequent disabled initialization clears the selection writer and ignores the key, including stale selection callbacks.

**PERF exception is narrowly isolated:** the capture APK reads/writes only `arrows_skin` through its own guarded store. It never installs a disk-backed progress store or hydrates/migrates progress. Ads/network remain disabled by PERF; the APK still contains official test-ad configuration. The earlier pilot incorrectly used ordinary full hydration under PERF; final ownership review rejected it, retained its evidence under `checks/pilot-progress-hydrate/`, added isolation tests, rebuilt ON/OFF and repeated final captures/timings. That pilot is not acceptance data. PERF theme choices remain memory-only, so non-default skin restart verification returns to Daylight while preserving Sherbet.

## Renderer and UX decisions

A small external selection store allows Settings, BoardView and the native surface to share one stable registry object. Hook order and native view identity depend on the static platform/feature gate, never on Classic versus a skin. Selected motion data and LOD thresholds change with the choice. Opening starts from the real camera cell size, and geometry is prepared once for the enabled picker even when Classic is selected, allowing later switching without remounting.

Native selection recreates generic paths/motion and replays the retained configuration before preparation. This matters because React does not resend an unchanged config prop: without replay, reduced motion and blocked ink would reset during a selection-only update. Owned cells, retained feedback and the actual screen cell size survive the switch. Test coverage asserts one native mount across Classic → Cinnamon → Sherbet → Classic; device logs assert one full-detail preparation per skinned open. No ART05 path construction or skin appearance data is changed, apart from registry identity/name metadata.

Previews are decorative static SVGs, not native board views. Text, check and panel colors use palette roles; thumbnail fill/rim/shine use spec colors. Android hierarchy captures show `android.widget.RadioButton`, checked state and 210 physical-pixel / **60 dp** rows at density 560. Back returns to Settings; Android Back does the same from the list, then closes Settings. The outside scrim closes the sheet.

Contrast audit: 148 gated usage rows, zero failures. Preview outline versus sheet surface passes both themes: Cinnamon **4.500:1 / 3.150:1**, Sherbet **4.404:1 / 3.218:1**. Fill is intentionally free under the corrected K4 rule. `checks/contrast.txt`, `checks/preview-contrast.json`; Jest also asserts preview rows pass.

## Captures and persistence

[Light picker](../../../artifacts/ART-SKINS-06/screens/picker-light.png), [dark picker](../../../artifacts/ART-SKINS-06/screens/picker-dark.png), [sequence video](../../../artifacts/ART-SKINS-06/screens/settings-switch-restart.mp4).

The video starts in Settings, opens Arrow style, selects Cinnamon and returns to Play, repeats for Sherbet and Classic, then force-stops and relaunches with Classic still checked. A separate non-default restart shows [Sherbet checked](../../../artifacts/ART-SKINS-06/screens/restart-sherbet.png) and [Sherbet on the board](../../../artifacts/ART-SKINS-06/screens/restart-sherbet-board.png). Corresponding XML and native logs are retained in `checks/`. These are actual emulator pixels, no retouching.

Player viewports, dense v1 campaign index 3827 (display level 3828), **29.387754 dp** per cell: [Cinnamon](../../../artifacts/ART-SKINS-06/screens/runtime-cinnamon.png), [Sherbet](../../../artifacts/ART-SKINS-06/screens/runtime-sherbet.png), [Classic](../../../artifacts/ART-SKINS-06/screens/runtime-classic.png). ArtSkinDraws confirms detail=2; Cinnamon seven draws/strip, Sherbet four, same inherited general renderer. Appearance remains OWNER REVIEW PENDING.

## Switching measurement: what the player can see

| Choice | On-screen cell dp | Switches | Median ms | Max ms | Recorded frames | Largest boundary gap ms |
| --- | --- | --- | --- | --- | --- | --- |
| Cinnamon Roll | 29.387754 | 6 | 3564.572 | 4243.275 | 382 | 256.697 |
| Sherbet | 29.387754 | 6 | 3544.052 | 3892.919 | 387 | 252.169 |
| Classic | 29.387754 | 6 | 3581.890 | 3791.617 | 395 | 133.532 |

Method: six complete cycles, Cinnamon → Sherbet → Classic, on the final ON APK. Each sample relaunches the app, opens the actual three-radio list and checks its current selection before recording. The time starts at the real radio `onPress` release handler (`Date.now`), and ends at the first screenrecord frame containing ≥50 recognizable arrow pixels in the sampled board band. Settings lives on the menu: the interval includes Android Back to Settings, Back to the menu, the Play tap, deliberate navigation waits, opening and presentation. It excludes input dispatch before the handler. **These numbers are the scripted tap-to-visible-board journey, not isolated renderer switching latency or the K7 complete-opening budget.**

The screenrecord MP4 stores elapsed-realtime timestamps for each encoded frame. The analyzer validates their count/PTS against ffprobe, matches them to before/after shell epoch anchors, then decodes every frame and identifies the first board-only band with ≥50 recognizable arrow pixels (Classic RGB sum <400; skins RGB sum <660 and channel spread >15, at decoded 180×390). This excludes pale neutral grid/transition pixels; the initial permissive non-white classifier incorrectly counted the blank grid and was corrected after inspecting the boundary frames. Maximum clock-offset drift is 0.873 ms; recorded frame gaps, up to 256.697 ms at **29.387754 dp**, are the larger uncertainty. Encoded PTS/metadata and decoded counts match exactly; rawvideo DTS-rounding warnings are retained in `perf/analysis-stderr.txt` and no frames are interpolated or dropped. Previous/first frames are retained for every sample, with individual values, recorded frame counts and clock drift in `perf/switch-analyzed.json`. Timestamp format follows [Android screenrecord's legacy Winscope implementation](https://android.googlesource.com/platform/frameworks/av/+/refs/heads/android11-mainline-extservices-release/cmds/screenrecord/screenrecord.cpp). `onDraw` diagnostics are retained separately; they are not presentation timestamps.

Physical device 1440×3120, 560 dpi, logical cell 40 dp × initial camera scale 0.734693854 = **29.387754 dp**. No density/size overrides. Cold-boot software `swiftshader_indirect` backend was needed because the initial host graphics backend returned black captures with GL errors. Those rejected captures/logs remain in `checks/`. This is emulator evidence, not owner-phone latency or a 60 Hz guarantee; frame gaps and host raw data accompany the results. Raw host one-minute load range **10.43–21.37** during these **29.387754 dp** samples. Another emulator was running, left untouched; no exit performance claim is made.

`checks/rejected-navigation/` retains a failed timing batch where the list did not open before a coordinate tap reached Support instead. The failing sample has no accepted camera/selection log and is excluded. The final harness checks all three actual radio nodes before timing and uses Android Back for modal navigation; no bad navigation sample is silently classified as a skin result.

## Build and OFF verification

| APK | SHA-256 | META flags enabled |
| --- | --- | --- |
| picker-on.apk | `bd93d5ae5597885555e34d80ff580d0257274c78c359f93d86aa82df3a4d64d1` | 18 |
| picker-off.apk | `40891e1f4d8a159c65264f31cad28e47a0adbc628fa02b7c01048b1bd58b310a` | 17 |
| picker-base.apk | `1286f64ce4ad336e8e7b77f321d59eb70f19da9ebb9c65a85ff08a4d4818c476` | 17 |

All builds retain the same original 17 META flags, including ZOOMED_CAMERA, test-ad flag and PERF dense index; only ON adds picker flag 1. Exact flags/logs in `checks/build-env-{on,off,base}.json` and build logs. APK audit verifies identical 15 asset names, nine official test ad-unit IDs, and no temporary skin-contract instrumentation in any APK. No assets added. The literal pre-task base APK was built while all runtime files matched HEAD 1d61234, then every working file was restored; `checks/base-build-source.json` records provenance. The builder rejects a `base` label on a modified runtime tree.

`checks/off-verification.json`: separate OFF and literal HEAD APKs both expose no picker and emit no ArtSkin events. Board RGB pixels are identical over `[0,312,1440,2940]` at **29.387754 dp**; status bar/header were excluded. See `screens/board-{off,base}.png`, `screens/settings-{off,base}.png` and corresponding XML/logs. A saved non-default Sherbet preference survives both APK replacements with no uninstall; reinstalling ON shows Sherbet checked (`screens/upgrade-sherbet.png`, XML).

## Reproduction and handoff

Use Node v20.19.4. Run Jest with `--runInBand --watchman=false`, `tsc --noEmit`, then `python3 scripts/art/build-skin-picker.py on` / `off`. Build `base` only from literal HEAD 1d61234 runtime source. Run `python3 scripts/art/build-skin-picker-clock.py` to create the shell-only clock jar under `perf/clock/clock.jar` using existing javac/d8. On emulator-5556 only: install ON, run `capture-skin-picker.py sequence`, then `dark`; run `measure-skin-picker.py` and `analyze-skin-picker.py`; finally `check-skin-picker-device.py` installs OFF/base/ON without uninstalling, compares board pixels and checks the saved Sherbet radio. `check-skin-picker-apks.py` audits all APKs. Tools write only ART06 evidence and target the fixed serial; capture tools stop only their owned screenrecord PID.

Patch series and exact base are documented in [patches/README.md](../../../artifacts/ART-SKINS-06/patches/README.md). Forward application to a clean archive, exact final file hashes, reverse application and whitespace checks are in `checks/patch-verification.json`. Current tree is uncommitted, default OFF. No publish or remote writes.

[Engineering lessons](../../engineering-lessons.md) and [How to add a skin](../../skins/README.md) carry forward stable IDs, conditional save ownership, PERF isolation, configuration replay, static previews, actual presentation evidence and the existing centred/continuous shaft-line rule. Existing AGENTS.md requires future related work to read both and their latest linked report. Task-owned emulator cleanup evidence is `checks/device-cleanup.json`; no other emulator or display override is changed.

## Controller review (2026-10-01)

Verdict: **APPROVE as a default-OFF picker (save handling verified by reading + tests); skins themselves stay
pending (look review, opening budget).**

Executed by the reviewer: with the delivered code, `tsc` exit 0 and `jest` 117 suites / 1963 tests / 12 snapshots
(Node v20.19.4). Read line by line: `storage.ts` hydrates exactly `SaveSystem.persistenceKeys` with unchanged parsing
when the picker is off; `arrows_skin` is only added (and strictly parsed) when on; `chooseArrowStyle` is a no-op
without a store and writes through the same SAVE-GUARD writer (a failed hydrate blocks the write); re-selecting the
current style writes nothing. The one edited existing test (`gameSessionLifecycle`) only updates the searched call
text and still checks the stamp-after-hydrate order. Picker screenshots (light/dark) inspected: radios, previews,
check mark, Back.

Not a performance result: the 3.5 s "switch" figures are a scripted menu round trip (Back, Back, Play, waits),
not the renderer switch cost; the ART-SKINS-05 opening FAIL stands.

Disposition: code moved out of the tree into `artifacts/ART-SKINS-06/patches/skin-picker-code-on-1d61234.patch`
(27 files: ART-SKINS-05 skins + picker; re-apply check passes on 1d61234). Committed: report, tooling, guide,
lessons. ART-SKINS-07 starts by applying that patch.

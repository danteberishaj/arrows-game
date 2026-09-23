# POLISH-T1: the Android native board can paint outside its bounds (spike, R8 step 2)

Status: **DONE_WITH_CONCERNS**. Option A works. Setting the board wrapper's `overflow` to `'visible'` is
enough: `ArrowsBoardView.onDraw` then paints outside its own bounds, and that painting follows
pan and pinch. The only change kept is that enabling switch, gated by two new flags that are OFF by default.
The temporary debug draw has been removed. The concern is frame cost; see Concerns.

Environment: branch `next-level` at `f58692c`, with uncommitted working-tree changes. The device was emulator-5556, AVD `fleet_floor_api31`, API 31,
1440x3120 @560. Window, transition and animator scales were 1 (read back, EXECUTED). All numbers are **emulator only**.

## What changed (kept)

| File | Change |
|---|---|
| `src/featureFlags.ts` | Adds `META_EXIT_TO_SCREEN_EDGE` and `META_BOARD_GRID`, both `process.env.EXPO_PUBLIC_META_X === '1'` and OFF by default |
| `src/ui/boardOverflow.ts` (new) | The pure function `boardWrapperOverflow({exitToScreenEdge, boardGrid})` returns `'visible'` if either flag is on and `'hidden'` otherwise. It also exports `BOARD_WRAPPER_OVERFLOW`, computed from the flags |
| `src/ui/StaticBoardSurface.native.tsx` | The board wrapper's `overflow: 'hidden'` becomes `overflow: BOARD_WRAPPER_OVERFLOW` (one import and one style line) |
| `src/ui/__tests__/boardOverflow.test.ts` (new) | 3 tests: flags off gives hidden; either flag gives visible; the build default (no env vars) is hidden |

Nothing else changed. `modules/arrows-board/**` is byte-identical to HEAD: `git diff --stat -- modules/` is
empty (EXECUTED). No Kotlin or Swift change was needed. The BoardView viewport (`styles.viewport`,
`overflow:'hidden'`) still clips at the screen, below the header. With every flag OFF, the wrapper style is
exactly today's (`'hidden'`). The control build below shows this.

Why A works (INFERRED from reading RN 0.86.3 `ReactViewGroup.kt`): `initView()` sets
`clipChildren = false`, and `dispatchDraw` clips only when `_overflow != VISIBLE`. The Fabric wrapper
therefore does not clip the child `ExpoView` once overflow is visible. HWUI did not reject ops outside
the node's bounds (EXECUTED: screenshots).

## TDD

- RED (EXECUTED): `npx jest src/ui/__tests__/boardOverflow.test.ts` failed with `TS2307: Cannot find module '../boardOverflow'`.
- GREEN (EXECUTED): the same command passed 3/3 once `boardOverflow.ts` existed.

## Evidence

Spike code, now removed: in `ArrowsBoardView.onDraw`, after `canvas.scale(density)`, a 12-unit magenta stroke
drew a circle at board point (-200,-200) r=60, a line from the board centre to (boardW+200, boardH/2), and a line from
the centre to (-200,-200).

1. **EXECUTED: spike build, flag ON.** `df -h /` showed 8.4 Gi free (`df-before-build-1.txt`). Gradle daemon stopped, then
   `EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE=1 ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` printed
   `BUILD SUCCESSFUL in 4m 57s` (`assembleRelease-spike-flagon.log`). The APK (SHA-256 `6d5c39e8…64ea`) was installed with
   `install -r` over the same upload-key signature.
2. **EXECUTED: paints outside its bounds.** On level 1 at fit (`01-spike-flagon-fit-level1.png`), the magenta lines continue
   past the board rectangle. The right line reaches the screen's right edge, and the diagonal leaves the board above and to the left and reaches
   the left screen edge. The circle itself is off-screen at every camera position `panRange` allows, because (-200,-200)
   is further out than the 72 pt pan pad. The lines are the proof.
3. **EXECUTED: follows the pan.** At about 1.4× zoom (`04-…before-pan.png`) and after a 700 px pan to the right (`05-…after-pan-right.png`,
   and `pan-A*/on-after-pan-right.png`), the diagonal outside the board moved with the board and now extends across the empty area
   above and left of it. Nothing outside the board lags or detaches.
4. **EXECUTED: flags-OFF control (same native code with the debug draw, JS flag OFF).** `df` showed 5.1 Gi free after deleting
   `android/app/build` (`df-before-build-2.txt`). `./gradlew :app:assembleRelease …` printed `BUILD SUCCESSFUL in 2m 33s`, and
   `:app:createBundleReleaseJsAndAssets` ran (`assembleRelease-spike-flagoff.log`). To force Metro to re-transform the flags file
   (memory: the transform cache ignores env flips), a temporary comment line went into `featureFlags.ts` for this build. The file was
   restored from a copy afterwards (`grep -c POLISH_T1_TEMP` gives 0). In `pan-B-spike-flagoff/off-fit.png` and `off-after-pan-right.png`, the same magenta
   lines **stop exactly at the board rectangle**. The overflow gate is what enables out-of-bounds painting, and flags OFF clips as
   today. Side by side: `00-summary-on-vs-off.png`.
5. **EXECUTED: taps still land.** Flag-ON build, level 1:
   - At fit, a tap at (200,1542) on a left-pointing edge arrow: "60 left" became "59 left", hearts stayed 3, and the arrow was gone (`02-…after-tap-fit.png`).
   - At 1.4× zoom after six pans, a tap at (839,1279) on a free arrow: "60 left" became "59 left", hearts stayed 3 (`06-…before-tap.png`,
     `07-…after-tap.png`).
   - The wrapper stays `pointerEvents="none"`, and hit-testing is in JS, so the change is not on the tap path (INFERRED).
6. **Debug draw removed (EXECUTED).** `grep -rn "POLISH_T1\|MAGENTA\|drawCircle(-200" modules/ src/ android/app/src` found no match
   (exit 1). `git diff --stat -- modules/` is empty. `android/app/build` was deleted so the debug-draw APK cannot be reused by
   mistake, and the scratch copies of both spike APKs were deleted.
7. **Gates (EXECUTED).** `npx tsc --noEmit` exited 0. `npx jest`: 47 suites and 724 tests passed. The run includes the 3 new tests.

## Frame cost of a pan (EXECUTED, emulator only, gfxinfo framestats)

Method (`panmeasure.sh` in the session scratchpad):
- cold start, then Play into level 1, then a pinch to about 1.4× zoom;
- 6 alternating horizontal pans of 700 px over 1000 ms (60 moves, uiautomator driver), each followed by a 2 s settle;
- `dumpsys gfxinfo … reset` before each pan and a `framestats` dump after it.

Duration = FrameCompleted − IntendedVsync, parsed with `parse-gfxinfo.mjs`.

**Frame counts reconcile.** Every dump holds 90–93 frames over a 1483–1533 ms IntendedVsync span, which matches 60 Hz × span (±1). No frames were skipped.

| Run (order A, B, A2) | Frames | p50 | p95 | p99 | frames > 16.67 ms | legacy-janky pans | new-metric janky |
|---|---:|---:|---:|---:|---:|---:|---:|
| A: spike, flag ON | 551 | 10.02 | 22.79 | 24.05 | 148 | 4 of 6 | 0 |
| B: spike, flags OFF | 556 | 9.78 | 11.28 | 14.89 | 0 | 0 of 6 | 0 |
| A2: spike, flag ON (replicate) | 548 | 9.95 | 22.57 | 23.64 | 75 | 2 of 6 | 0 |

Reading:
- Every pan is bimodal. Individual pans have p95 of either about 11 ms or about 23 ms.
- Flag ON produced 6 of 12 slow pans across two runs. Flags OFF produced 0 of 6.
- The replicate runs landed on the same side, and B ran under a *higher* host load (load average 7.2) than A (3.2) and A2 (4.6). So this is not a one-shot inversion.
- The new-metric "Janky frames" is 0 in every dump, and the gfxinfo frame count equals every vsync.
- The GPU percentile is the emulator's placeholder (4950 ms) and is ignored.

## Decisions

- **A module constant, not a new prop.** The two flags feed one pure helper that the native surface reads. BoardView is untouched,
  which avoids shifting the `contrastAudit.ts` site lines. Later tasks turn it on by setting their flag.
- **The overflow is switched for the whole wrapper.** Arrows never extend past the board, so flag ON adds nothing visible until T3 or T4
  draw out of bounds (INFERRED from the research §2; the flag-ON screenshots show no other change).
- **Two gradle builds instead of a JS repack.** A repack would be debug-signed, forcing an uninstall. Both builds carry the upload-key signature of the
  installed app, so `install -r` kept the app data.
- **Final installed state.** I reinstalled the exact APK that was on the device before this task (pulled at the start, SHA-256
  `3b0598d8…d939`, Sep 21 build, upload-key signed). Read back after the reinstall: the installed `base.apk` sha256 is
  `3b0598d8…d939`. No debug-draw build is installed. The input-driver jar is still at
  `/data/local/tmp/arrows-perf-input.jar`, the same path the harness uses. Scales were left at 1, as found.
- No `.env` was created. The flag was passed inline to gradle.

## Concerns

1. **Frame cost (replicated, cause not isolated).** With the overflow visible, half of the pans ran at about 23 ms per frame instead of about 11 ms.
   There were still no janky frames by the new metric, and every vsync produced a frame. Confounders and likely causes:
   - (a) The flag-ON build *draws* more visible magenta, because the lines are no longer clipped.
   - (b) HWUI full-frame damage. When the parent does not clip children, the RenderNode's `clipToBounds` is false, and HWUI then dirties an unbounded rect
     (INFERRED from memory of AOSP `RenderNode::damageSelf`, not verified).

   T3 and T4 must gate on this. For each, run `perf:android` A/B/A with the flag off and on in the same session, and measure the pan phases
   (`panHorizontal`/`panVertical`) as well as the exit phase. If the cost reproduces without debug content, the cheapest mitigation is to
   turn `overflow` on only while an exit is running (the exit flag alone). The grid would then need option B (Skia layer) or a
   bounded wrapper size (A′). Emulator only; UNVERIFIED-DEVICE.
2. The circle at (-200,-200) was never on screen. `panRange` keeps the board within 72 pt of the screen edge, so far
   out-of-bounds regions are reachable only on axes where the board is smaller than the viewport. The grid extent in T4 should
   follow research §3, not a fixed margin.
3. **iOS is untouched.** `clipsToBounds = true` in `ArrowsBoardView.swift` stays; that is outside this brief. The wrapper is shared,
   so on iOS the flags change only the RN wrapper, and the native view still clips itself (INFERRED). Web is untouched (UNVERIFIED-DEVICE for iOS).
4. **Disk.** The first build filled `~/.gradle`, which is now 4.2 GB. Free space went from 8.4 Gi to 4.5 Gi after the builds, and to 5.1 Gi after deleting
   `android/app/build`. The next native build starts right at the 5 GB gate.

## Artifacts (`artifacts/POLISH-T1/`)

- `00-summary-on-vs-off.png`: flag ON at fit, flag ON after zoom and pan, flags OFF at fit, flags OFF after zoom and pan.
- `01…07-*.png`: the flag-ON walkthrough (fit, tap, zoom, pan, tap while zoomed).
- `pan-A-spike-flagon/`, `pan-B-spike-flagoff/`, `pan-A2-spike-flagon/`: the raw framestats dumps and screenshots.
- `assembleRelease-spike-*.log`, `df-before-build-*.txt`, `gfxinfo-spike-flagon-pan1.txt`.

Owner acceptance: not needed. This is plumbing with no player-visible change while the flags are OFF.

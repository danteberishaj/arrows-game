# POLISH-T3: the exit trail runs to the screen edge (META_EXIT_TO_SCREEN_EDGE, rulings R3 + R3a)

Status: **DONE_WITH_CONCERNS**. With the flag ON, a removed arrow's trail runs past the board edge until it is beyond the
visible screen edge. It stays at full ink until k = 0.85, then fades, and it travels `0.35k + 0.65k²`. Duration comes
from the on-screen run only. Reduced motion is still a stationary fade, with a payload identical to flag OFF. With the
flag OFF, the native payload is byte-identical to the pre-T3 serializer (golden-string test). Emulator recordings show all
four directions reaching the visible edge at full ink, with the fit camera and with `META_ZOOMED_CAMERA` on. T1's
"overflow visible makes pans slow" result **did not replicate** without the debug draw: A/B/A/B shows the same bimodal
pan cost with the flag ON and OFF, so no fix was needed. The concerns are that web was not run, that iOS is only type-checked, and that feel still needs the owner's eyeball.

Environment:
- Branch `next-level` at `330cf7f`, with uncommitted working-tree changes.
- emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120 @560).
- Everything below is **emulator only**.
- Build method: **gradle release**, 4 builds (`-PreactNativeArchitectures=arm64-v8a`).

## What changed

| File | Change |
|---|---|
| `src/ui/arrowGeometry.ts` | `slitherPath(arrow, cell, rows, cols, extent?)`. Given an `extent`, the ray runs to that rectangle's edge instead of the board's, clamped at ≥ 0, and still overshoots by body + one cell. With no extent, the code path is literally today's. New `BoardRect` and `headDistanceToRectEdge()` |
| `src/ui/exitToScreenEdge.ts` (new) | Contents listed below |
| `src/ui/nativeExitAnimation.ts` | Optional `motion` on the event. When set, `,fadeStart,launch` is appended **after the points**. With no motion, the string is unchanged |
| `src/ui/BoardView.tsx` | `handleTap` builds the camera from `tx/ty/scale` and the **raw** measured layout, then calls `planExit` for both native and web. `ExitingTrail` carries `motion`. The web `ExitTrail` uses `exitTravelFraction` / `exitFadeAt` (launch 0 and fade 0.55 when motion is null, the same as today). With the flag on, it renders **outside** the board `ClipPath` group, so it is unclipped. `ExitTrail` stayed in place (reduce-motion allow-list) |
| `ArrowsBoardView.kt` | The parser accepts `10+2n` tokens (defaults 0.55 / 0) or `12+2n` tokens, and validates fadeStart ∈ [0,1) and launch ∈ [0,1]. Any other count is rejected. The slot stores both. Draw: `travelled = (launch·p + (1−launch)·p²)·total`, which is exactly `p²` in float at launch 0, and the fade starts at `slot.fadeStart` |
| `ArrowsBoardView.swift` | Minimal change so a flag-ON payload parses: accepts `12+2n` and validates the two tokens. With motion present, it uses the timing function `(1/3, a/3, 2/3, (1+a)/3)` (the exact cubic for `a·k+(1−a)k²`) and opacity keyTime `fadeStart`. Without motion, today's `(0.11,0,0.5,0)` and 0.55 are unchanged. `clipsToBounds` is untouched, so iOS still clips at the board (R7: Android + web this round) |
| `src/ui/contrastAudit.ts` | BoardView `site` lines 852/853/854 → 862/863/864 |
| tests | `exitToScreenEdge.test.ts` (new, 12), `arrowGeometry.test.ts` (+6 extent), `nativeExitAnimation.test.ts` (+2 golden and motion) |

What `exitToScreenEdge.ts` contains:
- `EXIT_EDGE_FADE_START = 0.85`, `EXIT_EDGE_LAUNCH = 0.35` and `EXIT_EDGE_MARGIN_FRACTION = 0.25`, each marked `// OWNER-PICKED STARTING VALUE`;
- `visibleBoardRect`, `exitExtent` (visible rectangle ± 0.25·viewport/scale);
- the worklets `exitTravelFraction` and `exitFadeAt`;
- `planExit()`, the single decision point:
  - flag OFF, reduced motion, or no layout yet: today's board-edge path and `exitTrailDurationMs(totalLen·scale)`, with `motion: null`;
  - flag ON: the extended path; the duration is `exitTrailDurationMs((E + B)·scale)`, where E is head → **visible** edge (without the margin), clamped ≥ 0; and motion `{0.85, 0.35}`. PERF builds stay pinned (180) inside `exitTrailDurationMs`.

Not changed: `boardOverflow.ts`, `StaticBoardSurface*.tsx`, `GameScreen.tsx`, `scripts/` and `featureFlags.ts`. `git diff` of the flags file is empty. It was temporarily suffixed with a comment during builds to force a Metro re-transform, then restored byte-exact.

## TDD
- **Baseline (EXECUTED).** Before any edit, `scratchpad/golden.ts` (copied to `artifacts/POLISH-T3/scripts/`) serialized two fixed events with the HEAD code:
  - `7,3,214,0,10.4,136.8,493.6,1,0,7,43.2,100,…,496.8,140`
  - `12,0,180,1,…,180,-136.8`

  These are pasted verbatim into `nativeExitAnimation.test.ts` as `PRE_T3_*`.
- **RED 1 (EXECUTED, `tdd-red1-compile.txt`).** The three suites failed to compile: no `exitToScreenEdge` module, `slitherPath` "Expected 4 arguments, but got 5", and `motion` not in `NativeExitAnimation`.
- **RED 2 (EXECUTED, `tdd-red2-stub.txt`).** Against signature-only stubs that behave like today, **12 failed and 18 passed**. The failures were for the right reasons: for example, the extent ray ending at the board edge, the constants 0.55/0/0, the durations from `totalLen`, and the motion tokens missing (`Expected "...496.8,140,0.85,0.35" Received "...496.8,140"`). The golden flag-OFF tests passed against the stub, as a regression guard should.
- **GREEN (EXECUTED, `tdd-green.txt`).** 30/30. The tests cover:
  - the extent in all four directions, an extent inside the board (zoomed), a head past the extent (clamp 0), and extent = board rectangle reproducing the no-extent path exactly;
  - five fixed duration cases, each `== clamp(round(120+0.35·(E+B)·s),180,320)`, giving `[256,180,214,320,256]` and including both clamps;
  - RM + flag ON serializing identically to flag OFF;
  - the fallback before layout;
  - `exitTravelFraction(k,0) === k*k` for 101 values of k;
  - initial and final speeds of 0.35× and 1.65× the average.

## Evidence

Artifacts are under `artifacts/POLISH-T3/`. The summary is `00-contact-sheet.png`, which has one row per exit, frames at 60 Hz, flag ON fit/zoomed/panned, flag OFF, and RM. Method:
- `scripts/record.mjs` sets the three scales and reads them back, force-stops, relaunches, taps Play, starts `screenrecord` at 720x1560, and taps each arrow through the harness input driver 1.4 s apart.
- `scripts/analyze.py` decodes raw frames with their pts. For each exit it follows the far end of ink (luminance < 128) in the arrow's lane beyond its head, and the ink luminance within 0.4 cell of that end. Ink `#191724` has luminance 25.1.
- The tap coordinates come from `LevelGenerator.generate(0)` plus the camera formula (`scripts/level1.ts`). `probe-game` matched the model.

1. **EXECUTED, flag ON, fit camera** (`rec-fit-on/`; APK sha256 `d482327f…2bbc3`; scales read back 1/1/1). Up (1,11), Down (14,17), Left (17,5) and Right (15,16): "60 left" became "56 left", so all four taps mapped. For each exit, the ink reached the visible edge:
   - Up reached the header edge, 0.01 cell away.
   - Left and Right reached the screen edge, 0.00 and 0.03 cell away.
   - Down reached the top of the 3-button nav bar at y 2952, 0.03 cell away. It is hidden below that line.

   Head luminance stayed between 13.7 and 22.7 in **every** frame until the edge, so there was no fade before the edge (`edge-check.txt`). Frames at the edge within 1 cell: Up at 0.22 cell (lum 20.8), Down at 0.47 (20.8), Right at 0.65 (20.3). Left went from 1.42 cells (20.7) to touching the edge in the next frame (20.7). The per-frame step near the edge is more than 1 cell. The trail frames are about 16–19 ms apart (about 60 Hz), and no gaps were seen during the exits.
2. **EXECUTED, flag ON plus `META_ZOOMED_CAMERA`** (`rec-zoom-on/`, `rec-zoom-on-panned/`; APK `6d54131e…a13a1`).
   - Up, Down and Left reached the visible edge at 0.01, 0.02 (nav bar) and 0.00 cells, with the head at lum ≤ 23 in each frame up to the edge.
   - The zoomed Right arrow's head starts only 0.5 cell from the screen edge, so its lane is empty and cannot be measured. I recorded it again after a 561 px pan (the pan clamp): its head at 1.03 cells (lum 19.7) was followed by ink at the edge (19.7).
   - "60 left" became "56 left", and after the pan "60" became "59". All taps mapped, including taps made after earlier exits and after a pan.
3. **EXECUTED, reduced motion** (`rec-rm-on/`; scales set to 0 and read back 0/0/0 before the force-stop and relaunch). There was no ink in any lane beyond the head in any frame, so there was no travel.
   - Per arrow, over the frames in which its own head cell clears (`rm_analyze.py`, `rm-centroid.json`), the residual ink mass falls linearly from 1.0 to 0.08 over 197–216 ms, in 12–13 frames.
   - The intensity-weighted centroid moved at most **0.38 half-res px (0.76 device px)**, measured over frames with ≥ 10% mass. That is within the design spec's ≤ 1 px.
   - "60 left" became "56 left".
4. **EXECUTED, flag OFF control, same native code** (`rec-fit-off/`; APK `ecd88a99…4210a`). The same four arrows stop at the **board** edge: Up and Down are 10.8 cells short of the visible edge, and Left and Right are 0.65 cells short. They fade before that (head lum 61–115 in the last frames). This is today's behaviour, and it shows the flag is what makes the difference.
5. **EXECUTED, for the owner's feel check: `a = 0` against `a = 0.35`** (`side-by-side-a0-left-vs-a035-right-4x-slow.mp4`, 9.6 s, 4× slow, both flag ON, same four arrows at fit).
   - The `a = 0` variant was a temporary one-line build (`rec-fit-on-a0/`). The source was restored, and `grep POLISH_T3_TEMP` finds nothing.
   - Cells travelled about 33 ms after the first trail frame: a=0 gave 1.21–1.89, and a=0.35 gave 2.18–2.63 (Right gave 2.22 against 1.36).
   - At about 50 ms, a=0.35 had moved 2.8–4.3 cells in every direction. That is ≥ 1 cell (design spec B acceptance 2).
   - Screenrecord frame times carry the recorder's ±1-frame jitter.
6. **EXECUTED: gates.** `npx tsc --noEmit` exited 0 (`gate-tsc.txt`). `npx jest`: **49 suites and 803 tests passed** (`gate-jest.txt`; 783 before, plus 20). `contrast.test.ts` and `reduceMotionPolicy.test.ts` pass. GameScreen.tsx was not touched.
7. **EXECUTED: Swift.** `swiftc -parse` passes. `swiftc -typecheck` against the iOS 16 simulator SDK passes for both HEAD and the working copy, using a stub `ExpoView`/`AppContext` in place of ExpoModulesCore. It has **not been built or run** in Xcode, so it is UNVERIFIED-DEVICE.
8. **UNVERIFIED: web.** The web `ExitTrail` shares `planExit` and the worklet curve with native. The curve is unit-tested, and launch 0 equals `k*k` exactly. The unclipped render is a JSX move, checked by tsc only. It was not run in a browser.

## Pan frame cost, overflow visible: flag ON vs OFF (EXECUTED, gfxinfo framestats)

Method (`scripts/panmeasure.mjs`, the same as T1): cold start → Play level 1 → pinch to about 1.4× (the driver accepted 30/30 moves) → 6 alternating
horizontal pans of 700 px over 1000 ms (60 moves each), each with a `gfxinfo reset` before it, a 2 s settle, and a `framestats` dump. Frames are counted with
Flags=0, de-duplicated, and timed as FrameCompleted − IntendedVsync. Scales were 1/1/1. The same session ran in the order A1 → B → A2 → B2, reinstalled with `install -r`.

| Run | Build | Frames / expected (IntendedVsync span × 60 Hz + 1, summed per pan) | p50 | p95 | p99 | frames > 16.67 ms | pans with p95 > 16.67 | host load (1 min) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A1 | flag ON (overflow visible) | 537 / 537 | 8.29 | 20.35 | 21.73 | 53 | 2 of 6 | 3.99 |
| B | flag OFF (hidden) | 534 / 534 | 13.74 | 25.70 | 26.97 | 243 | 4 of 6 | 6.34 |
| A2 | flag ON | 537 / 537 | 11.09 | 24.00 | 26.09 | 204 | 4 of 6 | 5.38 |
| B2 | flag OFF | 541 / 541 | 10.76 | 23.09 | 24.42 | 126 | 3 of 6 | 4.44 |

**Reading.**
- The per-pan bimodality T1 saw (p95 of about 12–15 ms against about 21–27 ms) is present **with the flag OFF as well**: 7 of 12 pans were slow with it OFF, against 6 of 12 with it ON.
- The ON and OFF ranges overlap completely, and the ordering does not replicate. A1 < B, but A2 > B2.
- So the T1 result ("0 of 6 slow with the flag OFF") does not reproduce without the debug draw. The likely explanation is T1's confounder (a): the magenta lines drew more once they were unclipped. The other candidate is host/emulator contention (load 4–6.3 here, with another session sharing the host per memory).
- **Verdict: no measurable cost from overflow visible on the emulator.** The recommended "overflow only while an exit runs" change was therefore **not implemented**.
- The raw dumps and per-pan JSON are in `pan-A1-exit-on/`, `pan-B-exit-off/`, `pan-A2-on/` and `pan-B2-off/`, with `pan-A1-check.png` confirming that the zoom and pans happened.
- Emulator only. A real device is UNVERIFIED-DEVICE.

## Decisions
- **Extent = the raw board-view layout, not the camera viewport.** The board draws under the nav bar, so the ray clears the physical bottom edge. Where the nav bar is opaque (3-button), the trail is visibly cut at the nav bar's top. The duration's E uses the same raw rectangle, a difference of ≤ 48 dp, or ≤ 17 ms. Up exits end at the header's bottom edge (a known viewport fact, research §1).
- **No merge with the board rectangle** (design spec B model: `total = 2B + E + M + 1`). When zoomed, the ray ends past the screen edge even when the board edge is further out. That keeps the off-screen run short, so the on-screen speed matches the duration model. A head that is already past the extent still travels body + cell.
- **Motion tokens are appended after the points, not in the header.** A header of 10 against 12 tokens with `10+2n`/`12+2n` totals is ambiguous: both have the same parity. Reading n from token 9 makes the two forms distinct.
- **Reduced motion ignores the flag entirely** (`planExit`): it uses the board-edge path and its duration, and its payload is byte-equal to flag OFF (unit test).
- **Swift was touched only because it is required.** Its strict `tokens.count == 10 + 2n` would have dropped every flag-ON exit on iOS.
- `a = 0.35`, `0.85` and `M = 0.25` are all `// OWNER-PICKED STARTING VALUE`.

## Concerns
1. **Feel is owner-gated.** `side-by-side-a0-left-vs-a035-right-4x-slow.mp4` and `00-contact-sheet.png` need the owner's yes/no.
2. **Web not run.** No browser recording was made (item 8).
3. **iOS is type-checked only.** It is not compiled into the app or run, and it still clips at the board edge because `clipsToBounds` was not touched.
4. **Design spec B acceptance 4 was not run.** The `benchmark.mjs --assert-rendered exit --motion-scale 1` gate and an exit-phase A/B/A were not in this brief. The pan A/B/A was run instead.
5. **Screen captures stop at 720x1560 and at screenrecord's frame cadence.** The "head within 1 cell" check has a resolution of 1 half-res px (0.03 cell at fit). The Left exit at fit steps from 1.42 cells to the edge between frames.
6. **The level-1 zoomed Right arrows start 0.5 cell from the edge.** Their full run was shown only after a pan (item 2).

## Owner acceptances
- `artifacts/POLISH-T3/side-by-side-a0-left-vs-a035-right-4x-slow.mp4`: is the `a = 0.35` launch (right) better than `k²` (left)? yes/no
- `artifacts/POLISH-T3/00-contact-sheet.png` and `rec-fit-on/fit-on.mp4`, `rec-zoom-on/zoom-on.mp4`: does the trail running to the screen edge at full ink, fading from 0.85, read right? yes/no

## Housekeeping (EXECUTED)
- `df -h /` before each build showed 11 GiB, 6.7 GiB, 6.7 GiB and 6.7 GiB (`df-before-build-*.txt`). `android/app/build` was deleted at the end, leaving 7.4 GiB free. The scratch APK copies were deleted.
- The pre-task APK was reinstalled. Read back, the installed `base.apk` sha256 is `3b0598d8…d939`, the same as before the task. Scales were left at 1/1/1, as found. Temporary device files were removed.
- No `.env` was created, and the flags were passed inline. `grep -rn POLISH_T3_TEMP src modules` finds nothing. No git state was changed.
- The driver and analysis scripts are in `artifacts/POLISH-T3/scripts/` (gitignored, not tracked).

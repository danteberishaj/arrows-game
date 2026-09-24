# POLISH-T7: the idle feedback canvas stops redrawing, and the feedback art is memoised

Status: **DONE_WITH_CONCERNS**. Nothing here is player-visible.

- **#2:** with no feedback up, the Skia tree under the feedback `Canvas` is now empty. There is no camera transform group and no `useDerivedValue` on tx, ty and scale, so Skia has no shared value to start a mapper on during a pan. The `Canvas` stays mounted.
- **#6:** `shakingArt`, `blockerArt`, `pressedArt` and `hintArt` are memoised. An exit tap while a hint is shown now re-renders the feedback overlay 0 times. On BASE it was 1.
- **Pan (emulator):** UI-thread median per pan frame went from 4.01 to 3.14 ms. The per-run ranges do not overlap (A 3.87–4.20, B 3.08–3.23). This is larger than the null spread (A vs A 0.33 ms, B vs B 0.15 ms). The RenderThread median is **UNEVALUABLE**: the null spread is 0.61 ms and the effect is 0.04 ms.
- **Blink re-check:** **0 ABSENT frames** at mount and 0 at unmount, over 36 blocked taps (18 with motion on, 18 with reduced motion).

Environment:
- Branch `next-level`, BASE `746b4e9`, with the changes uncommitted in the working tree. No git state was changed.
- emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120). Every device number below is **emulator only**.

## What changed

| File | Change |
|---|---|
| `src/ui/StaticBoardSurface.native.tsx` | `DynamicFeedbackSurface` keeps the `Canvas` mounted. It renders a new `FeedbackLayer` child only while `pressed`, `blocker`, `shaking` or `hint` is non-null (and `!PERF_EMPTY_BOARD`). `FeedbackLayer` owns the camera `useDerivedValue`, the transform `Group`, the clip `Group` and the four feedback arrows. The arrows are unchanged. The keys are now prefixed per slot (`p`/`b`/`s`/`h` + id): see Decisions. `ShakingArrow` and its POLISH-T6 cover are untouched. |
| `src/ui/BoardView.tsx` | Each feedback art object is wrapped in `useMemo`. `blockerArt`, `pressedArt` and `hintArt` depend on their state object and `arrowArtCache`. `shakingArt` depends on `shaking.id`, `shaking.arrow`, `arrowArtCache`, `marked.has(shaking.arrow)`, `markColor` and `palette.bg`. |
| `src/ui/contrastAudit.ts` | Three `BoardView.tsx` site pins moved from lines 1012/1013/1014 to 1033/1034/1035. The old and new lines are identical text (`artifacts/POLISH-T7/site-remap.txt`). |
| `src/ui/__tests__/StaticBoardSurface.feedbackCanvas.test.tsx` | New, in the `ui` project, 7 tests. |

**Not changed:** timings, curves, colours, flags, native code, the web layers, save data (so there is no migration or wipe risk) and ads. The optional `useCallback` for GameScreen's `#` handler was not done: it is optional, and it would add GameScreen to the diff.

## TDD (EXECUTED)

**Test harness.** It mounts the real `BoardView` and the real `StaticBoardSurface.native`.
- Mocked: Skia (`Canvas` counts its renders and mounts; `Group` and `Path` become host nodes) and `ArrowsBoardView` (it records `visibleMask`). Reanimated uses the stock mock with a stable `useSharedValue`, as in the POLISH-T6 handoff test.
- The tap gesture handlers are driven directly.

**Tests:**
1. **All slots null.** There is no Skia node under the canvas. A hint mounts exactly one camera-transform group, whose value is `[tx, ty, scale]`. Clearing the hint empties the tree again. The canvas mounts once and never unmounts.
2. and 3. **A blocked tap** (motion on, and reduced motion): the camera group mounts with the bump, and the tree is empty again once the bump and the blocker end.
4. **With a hint shown, an exit tap of another arrow re-renders the feedback canvas 0 times.** Positive controls in the same test: the board count drops by 1, the surface re-renders, and the native mask hides the arrow.
5. **Positive control:** a new hint id does re-render the canvas, so the counter can see a re-render.
6. and 7. **Rapid play** (motion on, and reduced motion): a blocked tap with a hint shown, an exit 48 ms later, then everything settles. There must be no canvas render where the feedback-slot ids did not change. This covers the POLISH-T6 mark hand-back.

**RED on BASE** (`artifacts/POLISH-T7/tdd/red-on-base.txt`):
- How it was run: the working tree was swapped to `git show HEAD:` copies of the two sources, the tests were run, and the T7 copies were restored. The diff hash was identical before and after.
- Result: 6 failed, 1 passed (the positive control).
  - Test 1: "Expected length: 0, Received length: 2", the always-mounted transform and clip groups.
  - Test 4: "Expected: 0, Received: 1".
  - Rapid play: redundant renders `#2 -/2/1/1` and `#3 -/2/1/1`, from the exit during the flash and from the hand-back.
- BASE also logged React's "Encountered two children with the same key, `1`" 6 times (see Decisions).

**GREEN** (`tdd/green.txt`): 7/7 pass, with 0 duplicate-key warnings.

## Evidence

Gates (EXECUTED, `artifacts/POLISH-T7/gates/`):
- `npx jest`: **62 suites, 995 tests passed**.
- `npx jest --selectProjects ui`: 8 suites, 32 tests passed.
- `npx tsc --noEmit`: exit 0.

### Builds (EXECUTED, `artifacts/POLISH-T7/builds/`, `scripts/build.sh`)

Three incremental gradle arm64 release builds, run one at a time. Each one was preceded by `df -h /`, which showed 6.1, 6.1 and 6.0 GiB free. Each build also:
- cleared the Metro cache (0 directories left) and ran `:app:createBundleReleaseJsAndAssets --rerun`;
- pinned `versionCode` to 6 and restored it to 8 afterwards.

| APK | flags | bundle sha256 (prefix) | T7 marker `FeedbackLayer` |
|---|---|---|---|
| `t7-testads` | the 2026-09-24 test set: FTUE, FTUE_ASSIST, STREAK_FREEZE, ZOOMED_CAMERA, EXIT_TO_SCREEN_EDGE, BOARD_GRID, MISSED_MARK, BANNER, ADMOB_TEST_ADS | `bd22588e` | 1 (T6-post4 bundle: 0) |
| `A-head-perf-gridoff` | the same set minus BOARD_GRID, plus PERF_LEVEL=3827; HEAD sources (working-tree swap, restored, diff hash checked) | `ef0b394c` | 0 |
| `B-t7-perf-gridoff` | the same as A, with T7 sources | `6e75d9c4` | 1 |

- **Ad-unit proof, per APK, before any install** (`bundle-proof-*.txt`): 0 occurrences of `ca-app-pub-9813131856455133` and of the units 6706292920, 7549521178, 3505414519 and 5508761320, in ASCII and in UTF-16LE. Google's TestIds `ca-app-pub-3940256099942544` are present.
- **Signer:** the same as the installed T6 APK (SHA-256 `24f7fa0b…`). versionCode is 6.
- **Launch log:** `unitSet=test`.

**Why gradle and not the JS repack.**
- A repack is debug-signed, so installing it needs an uninstall first. That wipes the app data: the FTUE-completed level-1 state that the blink capture needs, and that the controller re-runs.
- The gradle builds keep the installed signer and versionCode, so `install -r` keeps the data. Each build took about 40 s, and disk stayed above 6 GiB.
- PERF builds do not persist anything.

### Pan A/B/A/B/A/B (EXECUTED, emulator, `artifacts/POLISH-T7/pan/`)

**Method:** `artifacts/POLISH-T4/scripts/panmeasure.mjs`, unchanged.
- Cold start of the PERF build (level 3828, 39×39), then a pinch.
- Then 6 alternating 700 px / 1000 ms pans, 60 moves each, with a `gfxinfo reset` before each and a framestats dump after it.
- The runs alternate installs with `install -r`. The grid is OFF (not compiled in). Scales were 1/1/1. No feedback was up, which is the idle case.

**Analysis:** `scripts/phases-ab.mjs`, derived from T4's `phases.mjs` and `abab.mjs`.
- UI = IntendedVsync → SyncStart.
- RenderThread = SyncStart → FrameCompleted.
- Frames are Flags=0 and de-duplicated.

| run | frames / expected @60 Hz (isolated) | contiguous span ms | median UI ms | median RenderThread ms | median total ms |
|---|---|---|---|---|---|
| A1 (HEAD) | 678 / 678 (0) | 11200 | 4.20 | 16.28 | 20.53 |
| B1 (T7) | 666 / 666 (0) | 11000 | 3.10 | 16.25 | 19.69 |
| A2 (HEAD) | 681 / 681 (0) | 11250 | 3.87 | 16.26 | 20.26 |
| B2 (T7) | 665 / 666 (0) | 11000 | 3.08 | 15.82 | 19.55 |
| A3 (HEAD) | 679 / 679 (0) | 11217 | 3.98 | 16.29 | 20.28 |
| B3 (T7) | 667 / 667 (0) | 11017 | 3.23 | 16.43 | 19.83 |
| **pooled A** | 2038 | | **4.01** (3.87–4.20) | 16.28 (16.26–16.29) | 20.34 (20.26–20.53) |
| **pooled B** | 1998 | | **3.14** (3.08–3.23) | 16.24 (15.82–16.43) | 19.69 (19.55–19.83) |

**Sample reconciliation:**
- Every run recorded frames equal to expected at 60 Hz: span/16.67 + 1 per pan, summed. B2 is 1 short. There were no isolated frames.
- Each pan is about 1.83–1.87 s of contiguous frames: the 1 s drag plus the fling.
- The runs are about 111–113 frames per pan. That is more than T4's about 90; the T4 driver and pan are identical here.

**Reading:**
- **UI thread: −0.87 ms median.** It replicated in 3 interleaved pairs with non-overlapping ranges. The null spread (A vs A) is 0.33 ms, and the effect is about 2.6× that. Timestamps are ns, so this is well above the instrument's resolution.
- **RenderThread: UNEVALUABLE.** The null spread is 0.61 ms (B runs); the effect is 0.04 ms.
  - Every run was in the emulator's "slow" mode: RenderThread was about 16.3 ms and total about 20 ms. That means every frame is over 16.67 ms, but frames still arrive every vsync (frames = expected).
  - So RenderThread time here is dominated by buffer/swap waits. Any saving from not presenting the empty TextureView cannot be seen.
- **Total: −0.65 ms median** (non-overlapping ranges). The UI-thread saving accounts for it.
- **Frame-count note:** HEAD runs consistently hold about 2 more frames per pan (678–681 against 665–667), and their contiguous span is about 35 ms longer per pan.
  - INFERRED: the always-mounted Skia mapper keeps presenting the canvas for a couple of frames after the camera stops.
  - Not proven; I did not trace it.
- **Idle pixels:** the fit frame of A1 against B1 differs in 0 px (rows 120–2950). This was EXECUTED, and it supports "no visual change" at rest.
- **Scope:** this is one emulator on a shared host (load average 1.8–3.3). Device and iOS are UNVERIFIED-DEVICE.

### Blink re-check (EXECUTED, `artifacts/POLISH-T7/blink/`)

**Harness:** POLISH-T6's `capture.mjs`, `analyze.py` and `aggregate.py`, unchanged, with `plan.json`.
- The plan still matches: level 1 starts at "60 left" in every session and ends at "59 left", and arrow 14 sits where the plan puts it (`cap/t7-s1-a-0-start.png`).
- There were 6 sessions on the T7 test-ads APK: motion on (scales set to 1/1/1 and read back after relaunch) ×3, and reduced motion (0/0/0) ×3.

| motion | taps | ABSENT at mount (frames / taps) | ABSENT at unmount (frames / taps) | ghost frames |
|---|---|---|---|---|
| on | 18 | **0 / 0** | **0 / 0** | 0 |
| reduced | 18 | **0 / 0** | **0 / 0** | 0 |

- The tap kinds are the same as T6: first charged (settles to the mark), re-tap of a marked arrow, the forgiven tap (settles to ink), and the unmarked re-tap.
- R6a is unchanged: arrow 14 ends `mark` and arrow 38 ends `ink` in every session.
- Full table: `blink/table.md`.

### Each feedback still renders (EXECUTED, `artifacts/POLISH-T7/shots/`, T7 test-ads APK, Daylight)
- **Bump and blocker flash:** `bump-and-blocker-flash.png`, frame 6.46 s of `t7-s1-a.mp4`. Arrow 14 lunges in the heart→mark mix, and its blocker flashes heart.
- **Press preview:** `press-preview.png`, from `press-preview.mp4`, a 400 ms stationary hold on arrow 21. The accent arrow is bolder. Its first frame is 1084 sampled accent pixels; later frames have 0.
- **Hint:**
  - `hint-shown.png`: the accent hint arrow. It was granted by a Google **test** rewarded ad (`hint-test-ad-shown.png`), which I closed with KEYCODE_BACK after 35 s. **I never tapped the ad.**
  - `hint-after-exit-tap.png`: the #6 scenario on device. An exit tap of another arrow (59 → 58 left) leaves the hint drawn.
- **Final state:** `final-level1-state.png` shows level 1 at "60 left" and 3 hearts.

## Decisions
- **`shakingArt` keys on `id`, `arrow` and `marked.has(arrow)`, not on the `shaking` object or the whole `marked` set.**
  - The POLISH-T6 hand-back replaces the `shaking` object mid-flash (`holdMark: false`) without changing any art. An exit during a shake replaces `marked` without changing whether this arrow is marked.
  - The output is value-identical to BASE for every input. It only skips the redundant renders. The rapid-play test pins this.
- **Per-slot key prefixes (`p`/`b`/`s`/`h`).**
  - Hint ids come from GameScreen's counter, and press, blocker and bump ids come from BoardView's. Both counters start at 1, so they collide in play. BASE logged React's duplicate-key warning in the rapid-play test.
  - With a collision, React's keyed reconcile of the overlay's children is undefined behaviour: at worst a remount, which would restart the hint pulse.
  - The prefix changes nothing when ids differ. I made this change because the JSX was being rewritten anyway. **It is outside the letter of the brief.**
- **Pan builds use the test-build flag set minus BOARD_GRID, plus PERF_LEVEL=3827.** The brief asks for both "the test-build flags" and "grid OFF" together with T4's PERF-level harness. This is the only set that satisfies all three.

## Concerns
1. **Reduced-motion flash lifetime, first charged tap:**
   - T6 post4 measured 317.8 / 318.1 / 317.4 ms; T7 measures 334.8 / 337.0 / 334.5 ms. That is +1 recorded frame.
   - Forgiven taps are 335.3 / 333.8 / 336.8 (T6: 329.7 / 331.6 / 335.9), and re-taps are about 350 in both builds. So the first charged tap now matches the other tap kinds, where under T6 it was about 17 ms short of them.
   - The T6 frame sequences show an extra recorded frame at the 150–170 ms hand-back (`153:heart 168:heart`), which T7 no longer produces. That is the removed Skia re-render.
   - No timer or curve changed; the nominal overlay life is still 340 ms. The mechanism for why T6's charged tap unmounted a frame earlier is **not identified** (INFERRED only). It is within one frame and has 0 ABSENT frames. Please decide whether that needs a look.
2. The pan measurement was taken entirely in the emulator's slow mode. The UI-thread effect replicates; the RenderThread and TextureView-present saving the audit predicted could not be seen (**UNEVALUABLE**).
3. The hint screenshot consumed one test rewarded ad on the emulator. That is telemetry `hintUsed` in the level aggregator, not persisted progress. The level still restarts at 60.
4. Web was not re-checked in a browser. The web path gets the same memoised objects, and `WebDynamicBoardLayer` reads raw state (INFERRED, not run).

## Device state left
- emulator-5556 is running, with scales 1/1/1 (read back in `artifacts/POLISH-T7/device-restore.txt`).
- Installed: `artifacts/POLISH-T7/arrows-testads-T7.apk` (on-device sha256 `041df010…6f23b`, versionCode 6, test-ads). Level 1 is fresh at 60 left.

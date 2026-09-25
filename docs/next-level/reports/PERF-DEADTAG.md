# PERF-DEADTAG — no Reanimated updates to unmounted views when leaving a screen

Implementer report, 2026-09-25. BASE = `2ca88a7` on `next-level`. Requirements:
`.superpowers/sdd/TASKS/codex/PERF-DEADTAG-brief.md`, `codex/GLOBAL.md` and the dispatch. Raw evidence is under
`artifacts/PERF-DEADTAG/` (gitignored). Nothing was committed; the controller owns git. Every device number is from
emulator-5556 (API 31, JS-repacked release APKs) only, so all of it is **UNVERIFIED-DEVICE** on real phones.

**Fix round 1 (at the end of this report) supersedes the round-0 stop.** `useStopAnimationsOnUnmount` (a
synchronous `runOnUISync` in a layout-effect cleanup) is **deleted**. In its place:

- one asynchronous, batched `scheduleOnUI` per leaving screen (`useStopWhenScreenLeaves` in `screenHandoff.tsx`);
- a 2-frame hand-off wait.

The round-0 sections below are kept as history. Where they name `stopAnimationsOnUnmount`, read round 1.

**Status: DONE_WITH_CONCERNS.**

- Warnings: 8–54 per menu exit before, **0 in every transition** after (n ≥ 5 each, sound on and off, plus win→Next).
- The gallery's first frame drops from 56.1 to 22.5 ms (median, n = 12 + 12, p = 0.0003). A lower-load replicate
  gave 38.7 → 22.2 ms.
- The brief's premise was wrong, and so was its suggested fix. I built and measured `cancelAnimation` in the effect
  cleanup: nothing changed.
- The fix that works adds a screen hand-off in `App.tsx`: the left screen stays mounted, invisible, for one more UI
  frame. The brief did not foresee this, so it needs the controller's review ("Concerns" 1).

## Root cause (steps 1–2)

### The mechanism (EXECUTED: logcat stacks and experiments; INFERRED: Reanimated 4.5.1 / RN 0.86.3 / worklets 0.10.1 source)

- **Reanimated keeps recent props for every animated view.** Each view it animated recently has its last props in
  `AnimatedPropsRegistry`. An entry leaves in only two ways:
  - The settled sweep: `PropsRegistryGarbageCollector` runs every 500 ms and calls `getSettledUpdates`, which drops
    entries 2–2.5 s after their view's last update.
  - `handleNodeRemovals`, which runs from Fabric's `reportMount`. Fabric posts that to the front of the UI queue
    **after** the frame that mounted the removal (`FabricUIManager.didMountItems`, `postAtFrontOfQueue`).
- **So the removed views' entries are still there during the frame that removes a screen.**
- **In that frame's draw pass, svg shapes send events.** react-native-svg dispatches an `SvgOnLayoutEvent` for every
  shape it draws for the first time (`VirtualView.setClientRect`).
- **Every such event re-applies the whole registry.** Reanimated listens to every dispatched event
  (`NodesManager.onEventDispatch`). Inside a draw pass it runs `performNonLayoutOperations`. That re-applies the
  **whole** registry (`getPendingUpdates`) through `synchronouslyUpdateUIProps`.
- **A dead tag throws, and the log is the cost.**
  - On RN ≥ 0.86 that call goes through reflection. For a view that is gone it throws
    `RetryableMountingLayerException`.
  - Reanimated logs the warning plus a ~90-line stack trace, once per dead tag per event. This happens on the UI
    thread, inside the new screen's first frame.
  - Events per first frame: the gallery wall 27, the game header's svgs 8–9, the menu 2 (only with sound OFF: the
    ♪ strike).
- **A second path adds at most one more warning.** With `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`, a Reanimated frame
  can land after the removal but before `stopMapper` arrives. It then writes the dead view once more
  (`performOperations`).
  - Pre-fix: 7 of 20 menu exits logged this one; every other warning came through the draw-pass path.

### The brief's premise did not hold (EXECUTED)

The brief assumed an animation that outlives its view. The animation does not have to outlive the view; only the
registry entry has to, and it lives until about 2 s after the last update.

| test | result |
|---|---|
| **Finished animation.** The splash root (tag 36): its fade `out` had finished and fired `onDone` before the unmount | still fails on the menu's first frame: 10/10 launches with sound off |
| **Press, then wait.** The game's `#` button pressed, then leave W s later (sound off; probe build, then the handback builds) | W = 0.25 s: 3/3 warn. **W = 1.0 s**, when its release spring has already ended: **4/4** (probe) and **4/4** (W4-09 handback). W = 3.0 s: 4/4. **W = 6.0 s: 0/3** |
| **The brief's fix, "V1".** `cancelAnimation` in the effect cleanup of the pulse, `SpringPress` and the splash (`probe/v1*`, APK `291cd8d6…`) | no change. menu→game 5/5 (8–9); menu→gallery 4/5 (27–54); splash→menu with sound off 10/10 (6 each). The frame-path warning is still there |

`cancelAnimation` on the JS thread cannot help (INFERRED: source):

- It is a `runOnUI` job, and so are `useAnimatedStyle`'s own `stopMapper` and the view-descriptor removal.
- None of them can remove a registry entry.

### Tag map (EXECUTED: a temporary `[deadtag]` probe, since removed)

- **How the probe worked:** it hooked `PropsRegistryGarbageCollector.registerView` and `unregisterView`, and printed
  each animated view's tag with its React owner chain.
- **Where it is kept:** the source as `scripts/deadtagProbe.ts.txt`; the build proof as
  `apk/deadtag-probe-base-diag.apk.proof.txt`. The APK itself is deleted.
- **Sound off:** tags shift by 8, because the ♪ strike adds views.

| tag (sound on / off) | component | when it fails |
|---|---|---|
| 90 / 98 | **HomeScreen: the Play pill's breathing `Animated.View`** (`pulseStyle`, endless `withRepeat`) | on every menu exit whose next screen draws svg: menu→game 5/5, menu→gallery 4/5 |
| 88 / 96 | `SpringPress` of the Play pill (press-in timing running) | menu→game, sometimes (W4-09 1/5; here 1 of 5 at 240 dpi and 1 of 5 in V1 with sound off) |
| 104 / 112 | `SpringPress` of `GalleryEntry` | menu→gallery, in 1–2 of 5 |
| 134 (off) | `SpringPress` of the gallery's or the game's `‹` | gallery→menu 1/5; game→menu when pressed quickly |
| 226 (off) | `SpringPress` of the game's `#` HeaderButton | game→menu, if `#` was pressed less than ~3 s before |
| 36, 18, 32 | **SplashScreen:** root (`rootStyle`), wordmark (`markStyle`, spring still settling), arrowhead (`headStyle`, spring) | splash→menu. Sound off: 10/10, 6 each, draw-pass path. Sound on: 2/10 (18 + 32), frame path |

### Flag dependence (step 3): the gradle arm was not built

The flag-false arm needs a gradle build. `df -h /` read 3.7–4.4 GiB free throughout, below the 5 GB gate, so every
build is a JS repack. I reasoned from source and from logs that predate the flag instead.

- **The draw-pass path does not depend on the flag.**
  - INFERRED: `performNonLayoutOperations → applySynchronousUpdates` is not gated by the flag.
  - EXECUTED: the same warning appears in three logs from before POLISH-T8's flag commit `1bf0f7e` (2026-09-24
    12:02). Each shows 6 × tag 84, all through `performNonLayoutOperations` from `VirtualView.setClientRect`:
    - W0-02 `post/c3-logcat-full.txt` (09-16; `package.json` at `e2f480f` has no flag);
    - W0-07 `run1` (09-17);
    - ADMOB-C `build-A-session-logcat.txt` (09-24 00:50).
- **The frame path depends on the flag** (INFERRED). `performOperations` calls `applySynchronousUpdates` only when
  `shouldUseSynchronousUpdatesInPerformOperations()` holds. With the flag off, those updates go through a
  shadow-tree commit, which silently skips a missing family.
- **So the flag adds at most 1 warning per exit.** It is not the cause.

## Fix

| file | change |
|---|---|
| `src/ui/screenHandoff.tsx` (new) | **`useLeavingScreen(screen)`**: when `screen` changes, the old screen comes back as `leaving` in the **same render**, so the commit that mounts the new screen still holds the old one.<br>• **The wait:** a layout effect waits for `afterNextUiFrame`. That is a `scheduleOnUI` job that calls the UI runtime's `requestAnimationFrame`, whose callback runs in ReactChoreographer's `NATIVE_ANIMATED_MODULE` phase, after `DISPATCH_UI` (Fabric's mount) of the same frame. The callback then clears `leaving` through `scheduleOnRN`.<br>• **Effect:** the removal mounts in a **later** frame than the new screen's first draw.<br>• **`slotKey`:** keeps the leaving screen's key. A screen shown again before that frame remounts fresh, as it did before, instead of reviving its leaving instance.<br>**`ScreenSlot`**:<br>• shown = the previous `{ flex: 1 }` wrapper with the same 180 ms `FadeIn` (`ReduceMotion.System`);<br>• leaving = absolute fill, `opacity: 0`, `pointerEvents="none"`, hidden from accessibility. |
| `src/ui/stopAnimationsOnUnmount.ts` (new) | **`useStopAnimationsOnUnmount(...sharedValues)`**.<br>• **Where:** a **layout-effect cleanup**, which runs inside the commit that removes the component, before `completeRoot`.<br>• **What:** `runOnUISync(() => cancelAnimation(v))`, so no Reanimated frame writes those values again.<br>• **Why:** this closes the frame path at the removal frame.<br>• **Web:** cancels directly, because `runOnUISync` throws on web.<br>• **Side effects:** none. `cancelAnimation` assigns the current value, and `valueSetter` skips same-value writes, so no mapper is notified. |
| `App.tsx` | • Each screen renders in a `ScreenSlot` keyed with `slotKey(s)` whenever `screen === s \|\| leaving === s`. The splash gets a plain-View slot with no fade, as before.<br>• Each screen's element is `useMemo`'d, and the inline `onHome` / `onDone` arrows became `useCallback`s.<br>• As a result, the commits that keep and then drop the leaving screen re-render **neither** screen: React bails out on an identical element. |
| `src/ui/HomeScreen.tsx`, `PressScale.tsx` (`SpringPress`), `SplashScreen.tsx` | One `useStopAnimationsOnUnmount(...)` call each: the pulse; the press scale; `mark`, `draw`, `head`, `out`. No timing, easing or style changed. |
| `src/ui/contrastAudit.ts` | Line references re-pointed to the shifted HomeScreen / SplashScreen lines (`scripts/remap-contrast.py`; each re-pointed line is asserted to hold the same text). |

**What the player sees does not change.**

- **The old screen:** it turns invisible in the commit that mounts the new one. Before the fix, that same commit
  removed it.
- **The new screen:** it mounts in the same commit as before.
- **Untouched:** the breathing, the press feel and the fade.

The captures below check this.

## Warnings per transition (step 1 before, step 5 after; EXECUTED)

**Harness** (`scripts/count-warnings.py` over `logcat -v monotonic`):

- A `DEADTAG` marker is logged on the device right before each input.
- Warnings are counted per window [marker, next marker).
- Geometry is 1080×1920 @480 with scales 1/1/1, read back. Win→Next runs at @240 (see below).

**State checks:**

- `screen-check.py` looks for game or gallery pixels mid-run and menu pixels at the end. Every set passed (ALL OK).
- Win→Next requires "1 left" before the clearing tap and `LEVEL 2` after Next.

**Builds compared:**

- BEFORE: the installed W4-09 handback, `00cae790…`.
- AFTER: the final handback, `8e07157c…`.

| transition | BEFORE, sound on | BEFORE, sound off | AFTER, sound on | AFTER, sound off |
|---|---|---|---|---|
| splash→menu (n = 10) | 2/10 runs (2 each) | **10/10** (6 each) | 0/10 | 0/10 |
| menu→game (n = 5) | **5/5** (9, 9, 9, 8, 8) | **5/5** (9, 8, 9, 8, 8) | 0/5 | 0/5 |
| game→menu (n = 5) | 0/5 | 0/5 | 0/5 | 0/5 |
| game→menu, `#` pressed 1 s before (n = 4) | — | **4/4** (2 each) | — | 0/4 |
| menu→gallery (n = 5) | **4/5** (27, 27, 27, 54) | **4/5** (54, 28, 28, 54) | 0/5 | 0/5 |
| gallery→menu (n = 5) | 0/5 | 1/5 (2) | 0/5 | 0/5 |
| win→Next, META_LEVEL_TRANSITION (n = 5) | 0/5 | — | 0/5 | — |
| last tap → win panel (n = 5) | 0/5 | — | 0/5 | — |

- **Replicate:** the first AFTER build (`05d28ed5…`, before `slotKey`, which only changes the double-switch case)
  also measured 0 in every cell, over two sound-on sets, one sound-off set, win→Next and the `#` test
  (`after/prekey-build/`).
- **Other logcat lines** in the final AFTER logs: 0 `W Reanimated`, 0 `ReactNativeJS` W/E and 0 `FATAL EXCEPTION`.
  BEFORE logged 16 687 + 25 404 `W Reanimated` lines, the stack traces.
- **Pooled Fisher exact tests (two-sided):**
  - menu→game 10/10 → 0/10, p = 1.1e-5;
  - menu→gallery 8/10 → 0/10, p = 0.0007;
  - splash→menu with sound off 10/10 → 0/10, p = 1.1e-5.
- **Blind detector with sound on:** with sound ON the menu draws no svg, so transitions **into** the menu cannot show
  the draw-pass warning. The sound-OFF columns and the `#` row are the positive controls: same harness, same native
  code, warnings before and none after.
- **Win→Next** logged 0 before too.
  - How the run works: `win-next.py` solves LEVEL 1 (20×20 Circle, 60 arrows) in `Board.findHint()` order. At @240
    the board opens at the fit camera even with META_ZOOMED_CAMERA, and the grid is calibrated from the dot grid
    (264 of 264 cells). `arrows_finished_games` is seeded to 0, so no interstitial is due.
  - Why it logs nothing: nothing unmounts there while an svg shape draws for the first time. The board is the native
    `ArrowsBoardView`.

## Performance (step 5; EXECUTED on emulator-5556)

**Method:** W4-09 fix round 1's, unchanged.

- Display: 360×640 dp, scales 1/1/1 read back.
- Each run: cold start, menu framestats dumps, tap, then dumps at +1.1 and +2.2 s.
- BEFORE and AFTER alternate in blocks (bef1, aft1, …; 4 blocks × 3 runs). Every block gets an install, a seed and an
  unmeasured warm-up.
- The mount frame is the first frame in [tap, +400 ms) whose display-list record is ≥ 1 ms (`scripts/open-frames.py`).

**Builds:**

- BEFORE: `deadtag-base-diag.apk` `fc71bff2…`, HEAD content (worktree-diff `da39a3ee`, empty).
- AFTER: `deadtag-fix-diag.apk` `40b7c6f8…` (final code).
- Both are CAPTURE_DIAG builds, for the menu marker.

**Gallery open, final round** (`perf/gallery-final/open-frames-gallery.txt`; host load average 2.9–13.2):

| metric (ms) | BEFORE, n = 12 | AFTER, n = 12 | perm p |
|---|---|---|---|
| **mount frame duration** | **56.1** (34.0–221.6) | **22.5** (19.2–29.4) | **0.0003** |
| UI thread / display-list record | 32.6 / 16.7 | 14.7 / 5.2 | 0.0002 / 0.0001 |
| frame after the mount frame (the deferred removal is here) | 42.0 (9.4–226.7) | 20.4 (13.9–27.8) | 0.005 |
| tap → mount frame done | 95.9 | 58.5 | 0.0001 |
| worst frame in [tap, +400 ms) | 57.2 | 23.2 | 0.0002 |
| runs with warnings | 12/12 | 0/12 | Fisher 7.4e-7 |

- **Replicate round** (`perf/gallery/`; host load 2.9–5.2; AFTER = the pre-`slotKey` build): 38.7 (25.7–114.6) →
  22.2 (19.8–29.4) ms, p = 0.0002.
  - The one BEFORE run without the burst measured 25.7 ms.
- **Pooled over both rounds:** 41.7 → 22.2 ms, n = 24 + 24, p < 0.0001 (`perf/pooled-two-rounds.txt`).

**Game screen after Play, final round** (`perf/play-final/open-frames-play.txt`; host load 3.9–7.5):

| metric (ms) | BEFORE, n = 12 | AFTER, n = 12 | perm p |
|---|---|---|---|
| mount frame duration | 91.1 (70.8–164.9) | 69.4 (55.2–188.9) | 0.037 |
| UI thread / display-list record | 80.4 / 52.8 | 58.7 / 41.0 | 0.015 / 0.021 |
| frame after the mount frame | 127.4 | 112.9 | 0.32 |
| tap → mount frame done | 158.0 | 140.4 | 0.21 |
| worst frame in [tap, +400 ms) | 142.5 | 117.1 | 0.15 |
| runs with warnings | 12/12 (8–18) | 0/12 | Fisher 7.4e-7 |

- **Replicate round:** 84.6 → 76.6 ms, p = 0.63.
- **Pooled:** 87.6 → 71.3 ms, n = 24 + 24, p = 0.08.
- **Why the game gains less:** its first frames are dominated by the board's first draw (display-list record 31–112
  ms). The 8–9 warnings sit inside that noise.
- **The removal moved into frame 2** (replicate round, `perf/play/`): frame 2's UI work grew 6.0 → 11.6 ms
  (p = 0.035). Tap → second frame done was 239 → 224 ms, p = 0.42.
- **Verdict for the game:** improvement likely but not robust at n = 12; no regression shown.

**Reconciliation, every round:**

- 12 of 12 runs per arm have a mount frame.
- HWUI records only drawn frames: 4–15 per window, across a drawn span of 50–333 ms (the mount plus the fade).
  Skipped vsyncs are counted inside that span.
- The +1.1 s dump reaches back 1.75–1.93 s before the tap, so the ring buffer evicted nothing from the window.
- Frames still in flight at dump time (`FrameCompleted` = 0) are dropped, not counted as samples.

## Visual identity (EXECUTED)

### Breathing: the menu while it is shown

- **Capture** (`captures/breathing/`, `scripts/breathing-capture.sh` + `breathing-compare.py`):
  - 40 lossless screencaps per build, spanning several 1.1 s half-periods;
  - the save is pinned, so both builds print the same stats text.
- **Same pill in both builds:**
  - width 750–772 px with 12 distinct values, and height 204–210 px;
  - the same 1.0293 max/min width ratio.
- **Phase-matched pairs:** for 14 BEFORE/AFTER pairs with equal measured pill size, the pill box is **0 px
  different in 4 pairs**. The other 10 pairs differ by 1.8–3.8k px, which is the same noise floor as two BEFORE
  captures of equal size taken at different times (0–3.8k px): an equal whole-pixel width can still carry a different
  sub-pixel scale.
- **Positive control:** a 6 px width difference inside one build changes 5.9k px.
- **Outside the pill:**
  - Within a build: 0 px.
  - Between builds, the banner differs: it shows a different TEST creative per ad session.
  - Also between builds, **30 wordmark pixels differ by 1/255 in one channel.** This is a quirk of BEFORE's *first*
    menu visit. BEFORE's first visit differs from its own later visits by exactly these 30 px. AFTER's first visit
    equals every later visit of both builds (`captures/breathing/wordmark-check.txt`).
  - The cause of that 1-LSB variant is not identified. It is imperceptible.

### The switch itself

- **Recordings** (`captures/transition/`, `transition-frames-*.txt`, `captures/transition-contact-sheet.png`):
  - screenrecord of menu→game and menu→gallery, 2 per build;
  - frames extracted at their own timestamps.
- **Same frame structure in all 8 recordings, in both builds:**
  - the last menu frame, then one blank frame;
  - the new screen's first content exactly 1 frame after the last menu frame;
  - **no frame showing the left screen** after the switch;
  - then the ~180 ms fade-in.
- **Fade progression:** the gallery's fade is alike in both builds. The game's visible progression varies from run to
  run with first-frame jank. For example, BEFORE run 1 jumped to near-opaque at +78 ms after a long frame.

### Web preview

`artifacts/PERF-DEADTAG/web-check.txt`. The bundle served after the reload contained the hand-off code.

- The transitions work.
- Right after each switch, the DOM held the new screen plus one `opacity: 0; pointer-events: none` old slot, which
  was gone 1.2–1.5 s later.
- No console errors.
- One RN-web dev warning, "`props.pointerEvents` is deprecated": the unchanged bundle already logs it from
  HeaderButton.

## Tests (TDD)

- **RED on BASE** (`tdd/red-unmountAnimationStop.txt`): `unmountAnimationStop.test.tsx` fails 3/3 on its final
  assertion.
  - The preconditions pass: `withRepeat` ×1, `onPress` ×1, `withSpring` ×1, and 4 `withDelay` values.
  - What is missing at BASE:
    - HomeScreen does not cancel its breathing on the UI runtime at unmount;
    - PressScale does not cancel its release spring;
    - the splash does not cancel its 4 values.
  - The same tests also fail on V1, the brief's async cancel (`tdd/red-on-v1-async-cancel.txt`), so they tell the
    two fixes apart.
- **RED:** `screenHandoff.test.tsx` fails as a whole suite: the module is not found (`tdd/red-screenHandoff.txt`).
- **GREEN, final tree** (`tdd/green-final.txt`): 8 of 8.
- **Mutations** (`tdd/mutations.txt`): 8 of 8 killed.
  - `slotKey` ignores the visit;
  - no leaving screen;
  - release at once instead of after the UI frame;
  - leaving slot visible;
  - leaving slot touchable;
  - HomeScreen drops the hook;
  - SpringPress drops the hook;
  - the hook cancels from the JS thread.
- **Gates, final tree** (`gates/*-final.txt`):
  - `npx jest`: 85 suites, **1268 tests** (1260 + 8 new), 6 snapshots;
  - `--selectProjects ui`: 21 suites, 129 tests;
  - `npx tsc --noEmit`: exit 0.

## Builds and handback (EXECUTED)

- **Recipe:** every build is a JS repack (`scripts/repack.sh`, W4-09's recipe) over
  `artifacts/W5-04/apk/arrows-testads-W5-04.apk`. Native code is unchanged since `87ec519`. All builds are
  debug-signed and use the W4-09 test flag set.
- **Proofs:** every build shows owner units 0/0 (ASCII and UTF-16LE) and TestIds present (`apk/*.proof.txt`).
- **Kept (3):**
  - **`apk/arrows-testads-PERF-DEADTAG.apk` `8e07157c…`**: the handback, no CAPTURE_DIAG;
  - `apk/deadtag-base-diag.apk` `fc71bff2…`;
  - `apk/deadtag-fix-diag.apk` `40b7c6f8…`.
- **Deleted:** the probe build, V1, and the two pre-`slotKey` AFTER builds. Their `.env` and `.proof` files are kept.
- **BEFORE diag build** (`scripts/build-base-diag.sh`), with no state-changing git:
  - tar-backup of the changed files;
  - `git show HEAD:f > f`;
  - build;
  - restore;
  - assert `git diff | shasum` is unchanged before and after.
- **Device** (`final/device-final.txt`, `.png`):
  - emulator-5556 is in state `device`, at 1440×3120 @560 with scales 1/1/1;
  - the on-device APK is the handback `8e07157c…`, with the app at the menu;
  - the save is restored to the task-start dump (`final/db-restored.sql` matches `prefix/db-task-start.sql`). The only
    exception is `arrows_tel_session_count` 394 → 395 from the final launch.
  - `df -h /` 3.9 GiB.

## Decisions

- **The fix goes beyond the brief's step 4 wording.** The brief's method measured as doing nothing, as shown above.
  The App-level hand-off is the smallest change I found that keeps removed views' entries away from a draw pass
  without changing timing or looks.
- **Not flagged.** GLOBAL's flag rule covers new player-visible features. This is not one. A flag would be one line
  in `useLeavingScreen`.
- **The sync stop hook stays on top of the hand-off.**
  - Why: the frame path exists (7 of 20 pre-fix menu exits), and the deferred removal frame could race `stopMapper`
    the same way.
  - Cost: one `runOnUISync` per unmounted pulse, SpringPress or splash.
  - Its tests are the brief's step-6 tests.
  - Its separate effect was not measured on the device.
- **Not stopped: `statsLiftStyle`**, the 220 ms banner glide. It is an in-style `withTiming` with no shared value. It
  runs only right after the banner loads, and the hand-off covers its draw-pass risk.
- **ScreenSlot uses the `pointerEvents` prop, not `style.pointerEvents`**, as HeaderButton already does.

## Concerns

1. **The fix is structural** (`App.tsx` renders the left screen for one more UI frame). The controller should decide
   whether that is acceptable for this task.
   - The alternatives have to change something visible or forbidden:
     - unmount first and mount the new screen a frame later (+1 frame before the fade);
     - an invisible `exiting` animation;
     - patching Reanimated. That is the real root: skip views that cannot be resolved in `performNonLayoutOperations`,
       without logging. It needs a node_modules patch and a gradle build.
2. **The hand-off relies on internals I read from source (INFERRED):**
   - worklets' UI `requestAnimationFrame` runs in ReactChoreographer's `NATIVE_ANIMATED_MODULE`, after `DISPATCH_UI`;
   - Fabric reports mounts after the frame.
   - A Reanimated, worklets or RN upgrade could break that ordering. Jest cannot see it; only a device warning count
     can. Re-run `scripts/transitions.sh` with sound on and off after any such upgrade.
3. **In-screen unmounts are not covered.** A view animated in the last ~2 s that unmounts in the same frame as a first
   svg draw would still warn. None was observed (win→Next 0/5 before and after).
4. **The game-screen first frame** improved in one round (p = 0.037) but not in the other (p = 0.63). The deferred menu
   teardown adds ~5.6 ms of UI work to the game's second frame. Net tap → second frame: no significant change.
5. **Emulator only; iOS not run.** The warning path is Android's reflection call. iOS runs the same hand-off code, but
   it was not measured there.
6. **The flag-false gradle arm was not built** (disk below 5 GB). Flag independence is argued from source and from
   the pre-flag logs.
7. **A double switch inside one frame** (for example `‹` then Play within ~16–50 ms) remounts the revisited screen and
   removes the other at once. That is the pre-fix behaviour for that rare case.

## Evidence index

All under `artifacts/PERF-DEADTAG/`:

| path | contents |
|---|---|
| `prefix/` | BEFORE warnings: sound on and off, win→Next, the settle test, the task-start DB |
| `probe/` | tag map, settle experiment, V1 |
| `after/final*` | final AFTER warnings |
| `after/prekey-build/` | AFTER replicate on the pre-`slotKey` build |
| `perf/` | framestats, `open-frames-*.txt`, pooled |
| `captures/` | breathing and transition captures, contact sheet |
| `tdd/`, `gates/` | tests and gates |
| `web-check.txt` | web preview check |
| `warnings-all.txt` | every warning table |
| `scripts/` | every harness named above |

## Fix round 1 (controller review: no synchronous JS→UI wait)

The controller accepted the hand-off in principle. Its concern: `runOnUISync` in a layout-effect cleanup blocks the
JS thread for each unmounting PressScale, HomeScreen and Splash. That is 2–3 at once on Next/Retry, it is a possible
stall at a level change, and it is a deadlock risk.

**Status: DONE_WITH_CONCERNS.** Every measured case is 0 again, with no synchronous JS→UI call anywhere.

### Step 1: the hand-off alone, stop-hook calls removed (EXECUTED)

- **Builds** (JS repacks):
  - `deadtag-handoff-only.apk` `a3901d2e…`;
  - `-noLT` `0522da95…`: same code, `EXPO_PUBLIC_META_LEVEL_TRANSITION` unset.
- **Bundle proofs:** owner units 0/0 (ASCII and UTF-16LE), TestIds present.
- **Evidence:** `round1/ho-*`.
- **Harness:**
  - the same `transitions.sh` (1080×1920 @480) and the `#` test;
  - `win-next.py` gained a `lose` mode: three initially blocked arrows (`Board.canExit` false, from `level-plan.ts`)
    are tapped 1.2 s apart, then the lose panel's `Retry`;
  - the run checks `LEVEL 1` and `60 left` afterwards;
  - the rewarded "Continue +♥ (ad)" button is never tapped.

Warnings per run:

| case | hand-off alone | final round-1 build |
|---|---|---|
| splash→menu (all launches pooled) | **8/45** runs (2–4 each, tags 18 + 32, frame path) | 0/45 |
| menu→game, sound on / off | **1/5** (2: tags 90 + 92, frame path) / 0/5 | 0/5 / 0/5 |
| game→menu, sound on / off | 0/5 / **3/5** (tag 136 = `‹` SpringPress, frame path) | 0/5 / 0/5 |
| game→menu, `#` pressed 1 s before (sound off) | **1/5** (5: 1 frame path + 4 draw-pass, tags 136 + 228) | 0/5 |
| menu→gallery, sound on / off | 0/5 / 0/5 | 0/5 / 0/5 |
| gallery→menu, sound on / off | 0/5 / **1/5** (tag 136, frame path) | 0/5 / 0/5 |
| win→Next, META_LEVEL_TRANSITION on / off | 0/5 / 0/5 | 0/5 / 0/5 |
| last tap → win panel, on / off | 0/5 / 0/5 | 0/5 / 0/5 |
| lose→Retry, on / off | 0/5 / 0/5 | 0/5 / 0/5 |
| last blocked tap → lose panel, on / off | 0/5 / 0/5 | 0/5 / 0/5 |
| blocked taps in game, on / off | 0/10 / 0/10 | 0/10 / 0/10 |

**The in-screen cases the old hook targeted never warn, even with the hand-off alone.** That covers win→Next and
lose→Retry (the panel buttons unmount), with the transition flag on and off. The frame-path detector needs no svg, so
these zeros are informative for that path.

- **What still warns with the hand-off alone is the screen switch:**
  - mostly the frame path: a leaving screen's animation (the splash springs, the pulse, a pressed `‹` or Play)
    writes its removed view in the removal frame;
  - once, the draw-pass path: in that `#` run, the menu's ♪ strike drew its first frame in the removal frame
    (stack: `VirtualView.setClientRect` → `performNonLayoutOperations`).
- **Step 2 therefore does not apply:** "0 everywhere" was false.
- **Step 3 applies, to the screen switch only:** keep a stop, but not a synchronous one.

### Step 3: the round-1 fix (asynchronous, batched, UI-thread)

| file | change |
|---|---|
| `src/ui/stopAnimationsOnUnmount.ts`, `__tests__/unmountAnimationStop.test.tsx` | **deleted**; no `runOnUISync` anywhere (`grep -r runOnUISync src App.tsx`: none) |
| `src/ui/screenHandoff.tsx` | **`useStopWhenScreenLeaves(...sharedValues)`**: registers the values with the enclosing `ScreenSlot`'s registry. The context value is stable, so there are no re-renders; registration is a passive effect (add/delete on a Set). It returns `isLeaving()`.<br>**Stop:** when a slot's `leaving` turns true, its layout effect schedules **one** `scheduleOnUI` job that runs `cancelAnimation` for every registered value. That is asynchronous: the JS thread never waits. It is enqueued before the hand-off's own frame-wait job (child layout effects run first), so it runs on the UI thread before the frame wait begins, ≥ 2 UI frames before the removal commit.<br>**Wait:** `afterUiFrames(LEAVE_FRAMES = 2)` replaces the 1-frame `afterNextUiFrame`. The second frame covers a first svg draw that lands a frame after the mount, as seen once above. The old screen stays invisible for ~1 frame longer; nothing visible changes. |
| `src/ui/HomeScreen.tsx`, `SplashScreen.tsx` | register the pulse, and `mark` / `draw` / `head` / `out` |
| `src/ui/PressScale.tsx` (`SpringPress`) | registers `scale`. `pressIn` / `pressOut` start no animation once `isLeaving()` is true. This covers Pressability's delayed `onPressOut` (minPressDuration), which can land after the switch. |
| `src/ui/contrastAudit.ts` | re-pointed again (`remap-contrast.py`, content-asserted) |

**What does not change:**

- **In-screen unmounts** (the win/lose panel buttons on Next/Retry) schedule nothing. They only delete their values
  from a Set in a passive cleanup (jest: 0 UI jobs, no `runOnUISync`).
- **No sync JS→UI wait anywhere**, so the deadlock risk is gone. The only JS→UI traffic is one posted job per screen
  switch.

### Results (EXECUTED)

- **Warnings:** final round-1 handback `df2c8987…` (plus `deadtag-final-noLT` `9b817b32…` for the flag-off cases),
  right-hand column above: **0 in every case** (`round1/final-*`, `round1/final-summary.txt`).
  - 0 `W Reanimated` lines in all its logcats.
  - `screen-check.py` ALL OK, and every Next/Retry reached `LEVEL 2` or `LEVEL 1 · 60 left`.
  - Splash→menu, hand-off alone vs final: 8/45 → 0/45, Fisher p ≈ 0.006.
- **Breathing:** re-captured on the final build (`round1/breathing/`). It is the same as round 0:
  - the same pill range (750–772 × 204–210 px);
  - 0 px in the pill box for 4 of 13 phase-matched pairs; the rest sit within the same-build noise floor (0–3.8k px);
  - outside the pill, only the banner creative and the BEFORE-first-visit 30-px wordmark quirk differ.
- **First frames** (same method; BEFORE `fc71bff2…`, AFTER = final round-1 diag `d6703ac1…`; n = 12 + 12,
  alternating; host load 2.7–4.8):

| metric (ms) | BEFORE | AFTER | perm p |
|---|---|---|---|
| gallery mount frame | 45.6 (34.2–193.5) | **24.3** (20.2–30.6) | 0.0001 |
| gallery tap → mount frame done (JS + UI) | 87.0 | 71.8 | 0.018 |
| gallery worst frame in [tap, +400 ms) | 56.0 | 24.3 | 0.0001 |
| game mount frame after Play | 88.1 (65.0–180.5) | 79.2 (62.9–129.9) | 0.28 |
| game tap → mount frame done (JS + UI) | 155.3 | 150.1 | 0.62 |
| game frame after the mount frame | 113.5 | 122.3 | 0.68 |
| runs with warnings (gallery / game) | 12/12 / 12/12 | 0/12 / 0/12 | Fisher 7.4e-7 each |

- **Reconciliation:** 12/12 runs per arm have a mount frame. The +1.1 s dump reaches 1.74–1.96 s before the tap.
- **Game screen:** no significant change either way, as in round 0.

### JS-thread time of the Next/Retry press (step 3b): NOT measured

The controller's condition was "if some in-screen case still warns". None does, with or without the stop, so no
stop was added for in-screen unmounts.

- **Added work** on Next/Retry versus BASE (INFERRED from code, backed by the jest test):
  - one `Set.delete` per unmounting panel button, in a passive cleanup;
  - one boolean read per press.
- **Removed:** round 0's `runOnUISync` per button.
- **Switch latency, JS included:** tap → mount frame done (the table) is not worse: gallery 87.0 → 71.8 ms
  (p = 0.018); game 155.3 → 150.1 ms (p = 0.62).
- **Open:** a Perfetto or JS-probe timing of the Next/Retry press itself was not run.

### Tests and gates (EXECUTED)

- **RED** (`tdd/round1-red-screenLeaveStop-on-BASE-components.txt`): `screenLeaveStop.test.tsx`, run against BASE's
  HomeScreen, PressScale and SplashScreen, fails 3/4 (the HomeScreen, PressScale and Splash cases). With nothing
  registered, the slot schedules no job: `Expected: 1, Received: 0`. The fourth test is a guard (an in-screen unmount
  schedules nothing), and it passes at BASE too. The files were swapped by tar and restored, with the diff sha
  checked.
- **GREEN:** 9/9 (5 hand-off + 4 leave-stop) (`tdd/round1-green.txt`).
- **Mutations** (`tdd/round1-mutations.txt`): 6/6 killed:
  - the slot cancels via `runOnUISync`;
  - one job per value instead of one batch;
  - a late release is not guarded;
  - HomeScreen does not register;
  - 1 frame instead of 2;
  - the cancel runs on the JS thread.
- **Gates:**
  - `npx jest`: 85 suites, **1269** tests, 6 snapshots;
  - `--selectProjects ui`: 21 suites, 130;
  - `npx tsc --noEmit`: exit 0 (`gates/round1-*.txt`).

### Builds and handback (round 1)

- **Kept (3):**
  - **`apk/arrows-testads-PERF-DEADTAG.apk` `df2c8987…`**: the handback;
  - `apk/deadtag-base-diag.apk` `fc71bff2…`;
  - `apk/deadtag-final-diag.apk` `d6703ac1…`.
- **Deleted:** hand-off-only, `-noLT`, `final-noLT`, round-0 handback and round-0 diag. Their `.env`/`.proof` files
  are kept.
- **Round-0 source:** preserved as `round0-with-hook-source.tar`.
- **Device** (`final/device-final-round1.txt`):
  - emulator-5556 in state `device`, 1440×3120 @560, scales 1/1/1;
  - the handback `df2c8987…` installed, app at the menu;
  - the save is restored to the task-start dump except `arrows_tel_session_count` (395);
  - `df -h /` 3.8 GiB.

### Concerns (round 1)

1. **The Next/Retry JS-thread timing (3b) was not measured.** The condition did not trigger, and the argument above
   is INFERRED.
2. **`LEAVE_FRAMES = 2` is a margin, not a proof.** A first svg draw later than 2 frames after the mount would
   reopen the draw-pass path. None was seen in 60 + 10 screen switches on the final build.
3. **Round 0's concerns 1–2 and 5–7 stand.** Those are: the structural `App.tsx` change; reliance on Reanimated,
   worklets and Fabric frame ordering; emulator only; no flag-false gradle arm; the double-switch-in-one-frame case.

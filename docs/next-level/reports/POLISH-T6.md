# POLISH-T6: the blocked arrow's one-frame hand-off blink

Status: **DONE_WITH_CONCERNS**.

With the fix, the tapped arrow never disappears. The capture found **0 ABSENT frames** (arrow drawn by neither layer) in 54 recorded blocked taps (36 Daylight, 12 Ink Night, 6 cold first taps), with motion on and reduced motion, on first taps and re-taps. The unfixed HEAD blanked **1 + 9 frames with motion on and 0 + 18 with reduced motion** (mount + unmount, 36 taps). On 6 cold first taps it blanked 7 frames (1 at mount, 6 at unmount).

How it works: on native, the retained board **no longer hides the shaking arrow**. The Skia overlay paints a background-coloured "cover" over the arrow's static twin, and the heart overlay moves on top of the cover. A blocked tap changes the native board at most once: to add a new missed mark. That change is held back until 170 ms into the flash, while the overlay is already covering the arrow. So the two render pipelines never change the arrow in the same commit.

The concerns are listed at the end. The main one: with the grid on, the lavender grid dots under the tapped arrow's own path stay hidden for the whole 340 ms flash. Before, they showed through as the arrow lunged off them. This needs the owner's eyeball.

Environment:
- Branch `next-level`, HEAD `179efd0`, with uncommitted working-tree changes. No git state was changed.
- emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120 @560). Everything is **emulator only** unless labelled web.

## What changed

| File | Change |
|---|---|
| `src/ui/BoardView.tsx` | Details below the table. |
| `src/ui/StaticBoardSurface.native.tsx` | `ShakingArrow` draws the cover first, unmoved: the shaft is stroked at `strokeWidth + 2·outset` with round cap and join; the head is `grownTriangleD(headD, outset)`, filled. The moving overlay is then drawn exactly as before. `outset = COVER_OUTSET_PX / (scale · PixelRatio)`, read once when the overlay mounts. `COVER_OUTSET_PX = 1.5`, marked `// OWNER-PICKED STARTING VALUE`. No new worklets. |
| `src/ui/StaticBoardSurface.types.ts` | `BumpingArrowArt.cover?: string`. |
| `src/ui/arrowGeometry.ts` | New `grownTriangleD(d, outset)`: the head triangle scaled about its incentre, so that each edge moves `outset` outward. The result is still a plain triangle, so it uses the same draw type as every head. |
| `src/ui/firstPaintCleanup.ts` | `StagedCleanup.handBack?: { atMs, run }`: a second timer on the same first-paint clock. It is cancelled by the same `stage()` or `clear()` that cancels the cleanup. The cleanup timing itself (W0-04b) is unchanged. |
| `src/ui/contrastAudit.ts` | Three `BoardView.tsx` site pins moved 959/960/961 → 1012/1013/1014. `artifacts/POLISH-T6/scripts/remap-sites.py` (difflib against HEAD) asserts that each old and new source line is identical (`site-remap.txt`). |
| tests | `src/ui/__tests__/BoardView.handoff.test.tsx` (new, ui project, 8 tests), `grownTriangle.test.ts` (new, core, 5), `firstPaintCleanup.test.ts` (+2). |

`BoardView.tsx` changes:
- On native, the visibility mask excludes **only the hint arrow**: new `nativeExcludedArrows`. The web `excludedArrows` (shaking + hint) is unchanged.
- The shaking state gains `holdMark`. It is true on native when `MISSED_MARK_ENABLED` and either this tap charged, or this is a re-tap of an arrow that is still holding.
- While `holdMark` is true, the native mark mask leaves that arrow out (new helper `marksWithout`).
- The hand-back step clears `holdMark` at `BLOCKED_MARK_HAND_BACK_MS = (BLOCKED_BUMP_MS + FEEDBACK_CLEANUP_MARGIN_MS) / 2`, which is 170 ms. That is derived as the midpoint of the overlay's life, not a picked number.
- `shakingArt.cover = palette.bg`.
- The blocked branch now stages the shake after `onBlocked()`, so `holdMark` can use `charged`. It is the same React batch, so the commit is the same.
- The stale W6-01 perf comment about rebuild counts was updated.

Not changed:
- `feedbackCurves.ts`: every duration, curve, colour and amplitude.
- `FEEDBACK_CLEANUP_MARGIN_MS` and the 340 ms overlay lifetime.
- The hint overlay, the blocker flash and the press preview.
- Kotlin and Swift, the web layer, the flags, save data (no persisted change, so no migration or wipe risk) and the ad code.

## 1. Pre-fix reproduction (HEAD 179efd0, EXECUTED)

**Build:** the controller's gradle APK `artifacts/test-build-2026-09-24/arrows-testads-179efd0.apk`. The on-device sha256 `e9bb8fc0…910f` matches the file. It uses the 2026-09-24 flag set: FTUE, FTUE_ASSIST, STREAK_FREEZE, ZOOMED_CAMERA, EXIT_TO_SCREEN_EDGE, BOARD_GRID, MISSED_MARK, BANNER and ADMOB_TEST_ADS.

**Harness:** `artifacts/POLISH-T6/scripts/`, adapted from T5.
- `plan.ts`: level-1 geometry with the zoomed camera and the 48 pt inset.
  - It was checked against a screenshot: arrow 14's U-shape sits exactly on the predicted cells. The ~84 px warning did not apply, because the plan already uses `cameraViewport(…, 48)`.
- `capture.mjs`:
  - sets the scales, force-stops, relaunches and reads the scales back;
  - taps Play, confirms "60 left", and runs `screenrecord 720x1560`;
  - taps in this order: 38 (blocked, before any removal, so the assist rule forgives it), 21 (free), 14 (first tap, charged, marked), 14 re-tap ×2, 38 re-tap, 14 re-tap.
- `analyze.py`: per recorded frame (VFR, last pts ≤ t), per-pixel nearest-class counts inside the tapped arrow's own cells, plus the cells dilated 0.3 cell along the lunge. A frame is **ABSENT** when the foreground pixels are below 50 % of the resting baseline.
  - The verdict was checked by eye on crops: `pre/cap/check-a14-ev1.png` and `pre/check-a14-ev1-long.png` show the blank frames with the grid dots visible.

**Baseline counts:** 6 sessions, 36 blocked taps. Tables are in `pre/table.md` and `pre/baseline-table.md`; per-frame data is in `pre/cap/*-a14.txt` and `*-a38.txt`.

| motion | taps | ABSENT at mount (frames / taps) | ABSENT at unmount (frames / taps) |
|---|---|---|---|
| on | 18 | 1 / 1 | 9 / 9 |
| reduced | 18 | 0 / 0 | 18 / 18 |
| cold first tap, reduced (`cold/`) | 6 | 1 / 1 | 6 / 6 |

Every blank is exactly one recorded frame (13–17 ms).

## 2. Which side lags (EXECUTED from the frames; mechanism INFERRED)

- **Mount:** in the 2 mount blanks, the native board had already hidden the arrow and the Skia heart appeared one frame later. **Skia lagged.**
- **Unmount:** in the 33 unmount blanks, the Skia overlay was already gone and the native arrow came back one frame later. **Native lagged.** This happened on every reduced-motion tap.
- **INFERRED mechanism, from reading the library code:**
  - Native path: a Fabric commit, then a UI-thread mount on the next frame, then `setVisibleMask` → `postInvalidateOnAnimation`, which draws on the frame after that.
  - Skia path: the layout-effect `root.render` → `runOnUI` → picture.
  - The two paths have no ordering between them, so any hide/show hand-off in one commit is a race.

That is why this fix removes the hand-off instead of timing it.

## 3. The fix, and why this shape

The brief suggested an overlap shape: mount first, hide later, and hold the bump. I did not use it. It needs the lunge held for several frames until a hide "has landed", and JS cannot observe that landing. It also needs a new frame count.

In the shape I used, **the native board keeps drawing the arrow the whole time**, and the overlay covers it:
- **Mount:** until the first Skia frame, the screen shows the untouched ink arrow. From that frame on, the cover and the heart are on top. No state in between can be blank.
- **Unmount:** the native board already holds the final look (ink, or the mark handed back at 170 ms). Removing the overlay just reveals it, and at progress 1 the overlay's pixels equal that look.
- **Lunge:** the cover is unmoved, so the static twin cannot show as a ghost.
- **Reduced motion:** the heart covers the arrow until 340 ms, then cuts to the mark or ink, as today, minus the blank frame.
- **Timing:** no timing, curve or colour changed. The lunge starts on the tap frame, as before.

## 4. Post-fix evidence (EXECUTED; final build `post4`)

**Build:**
- Incremental gradle arm64 release with no prebuild, run by `scripts/build.sh`. It pins `versionCode` 6 for the build so that `install -r` keeps the app data, then restores it to 8.
- `df -h /` right before the build: 5.3 GiB free.
- Metro cache cleared (0 directories left), and `:app:createBundleReleaseJsAndAssets --rerun`.
- `bundle-proof-post4.txt`: 0 occurrences of `ca-app-pub-9813131856455133` and of the units 6706292920, 7549521178, 3505414519 and 5508761320, checked in ASCII and UTF-16LE. The TestIds `ca-app-pub-3940256099942544` are present.
- The bundle contains `holdMark` and `handBack`. HEAD's bundle has neither.
- The signer is the same as HEAD's. Launch logged `unitSet=test`.
- On-device sha256 `e9d0fdf0…25f6` (`install-post4.txt`).
- A copy is at `artifacts/POLISH-T6/arrows-testads-T6-post4.apk`.
- The only source edit after this build is a comment (the perf note). Hermes bytecode carries no comments.

**ABSENT counts, before and after:**

| | before (179efd0) mount / unmount | after (post4) mount / unmount |
|---|---|---|
| Daylight, motion on (18 → 18 taps) | 1 / 9 | **0 / 0** |
| Daylight, reduced motion (18 → 18) | 0 / 18 | **0 / 0** |
| Ink Night, motion on / reduced (post only, 6 + 6) | not captured | **0 / 0** |
| Cold first tap after launch, reduced (6 → 6) | 1 / 6 | **0 / 0** |

These include the first tap (charged, marked), re-taps of a marked arrow, the forgiven first tap, and unmarked re-taps. The earlier fix iterations also recorded 0 in every run: post1 48 taps, post2 18, and post3/post4 cold. Tables: `post4/table.md`, `cold/cold-summary.txt`.

**Ghost check (dilated-mask foreground more than 1.25× the baseline, 0–400 ms): 0 frames**, before and after.
- Arrow 14 (Down-lunging U), 0–80 ms after the first heart: **0 ink pixels** before and after.
- Arrow 38 shows about 210 ink pixels in both builds. Crops (`post4/check-a38-lunge.png`) show this is the overlay's own heart→ink mix, not a ghost.
- With the fix, the native ink arrow is physically present under the cover. A cover failure would show up as ink pixels in arrow 14's cells, and none appear.

**Flash lifetime** (first heart frame → first frame settled within 4 RGB of the final colour; per tap in `post4/table.md` and `pre/table.md`):

| Tap | Before (ms) | After (ms) | Median Δ |
|---|---|---|---|
| Reduced, first charged | 332.8 / 333.6 / 350.5 | 317.8 / 318.1 / 317.4 | −15.8 |
| Reduced, re-tap of a marked arrow | median 364.5 (9 taps) | median 350.1 | −14.4 |
| Reduced, forgiven | 346.1 median | 331.6 median | −14.5 |
| Reduced, unmarked re-tap | 359.8 median | 350.0 median | −9.8 |

- Each reduced-motion delta is the removed blank frame: before, "settled" was the frame after the blank. All are within one frame (16.7 ms).
- **Motion on:** the "< 4 RGB" test is dominated by H.264 noise near the asymptote (before: 132–315 ms for identical taps). So I measured the colour curve instead with `scripts/settle_curve.py`.
  - The time to 50 % and 90 % of the way from heart to the settle colour matches within 0–4 ms median for every tap kind (for example, first charged t90 214.3 → 218.5, forgiven 201.6 → 199.8).
  - The one exception is t50 for re-tapping a marked arrow: 112.2 → 100.4. That heart→mark distance is small, and the before-fix spread there was 49.6–132.6.
- **Cold first tap after launch** (the first overlay the process draws; reduced motion, 6 taps each):
  - heart run 332.5 → **333.0 ms** median;
  - lifetime to first settled 348.1 → 333.2 ms (the blank frame removed).

**R6a unchanged:**
- The first charged tap settles to the mark: 14 ends `mark` in every session.
- The forgiven tap (38, before any removal, assist rule) settles to ink, and so does its re-tap.
- Re-taps are free: "59 left", with the hearts dropping only on 14's first tap.

**Owner mp4s:**
- `artifacts/POLISH-T6/owner-handoff-before-after-x1.mp4` (real time) and `-x4.mp4` (4× slow).
- Same tap (arrow 14, first charged tap), before | after, motion on (top) and reduced motion (bottom), aligned on the first heart frame.
- The timeline is the union of every recorded frame, so a one-frame blank is never resampled away. Output is 240 fps CFR.
- Stills: `owner-handoff-stills.png`.

## Hand-off unit tests (TDD)

**RED (EXECUTED):**
- The final test files were run against HEAD's six source files, temporarily restored with `git show HEAD:<f>`.
- The working tree was restored afterwards. `git diff | shasum` was `846146895ea0` both before and after.
- Output files:
  - `tdd/red-final-BoardView.handoff-on-179efd0.txt`: **6 of 8 fail**, for the right reason. For example, `commit 1: {"native":"10","overlay":""} -> {"native":"00","overlay":"s1"}`: the native board hides the arrow in the same commit the overlay mounts.
  - `tdd/red-final-core-on-179efd0.txt`: `grownTriangleD` and `handBack` do not exist.
- The other 2 are regression guards that pass on both builds by design: the arrow removed mid-shake, and a board reset mid-shake.

**GREEN (EXECUTED):** `tdd/green.txt` (8/8), `green-firstPaintCleanup.txt` (5/5), `green-grownTriangle.txt` (5/5).

The BoardView test drives real `BoardView` taps through the captured Tap gesture's handlers, with a mocked `StaticBoardSurface` that records every committed prop set. It checks:
- the overlay and the native paint for an arrow never both change in one commit;
- the native paint changes only while the same overlay was already up in the previous commit;
- the native board never stops drawing an arrow that is on the board.

Cases covered: first charged tap (motion on and reduced), re-tap of a marked arrow, re-tap before the hand-back, forgiven tap, superseding tap on another arrow, arrow removed mid-shake, board reset mid-shake.

## Gates (EXECUTED, `gates/`)

- `npx tsc --noEmit`: exit 0.
- `npx jest`: **61 suites and 988 tests passed** (973 before + 15 new).
- `npx jest --selectProjects ui`: **7 suites and 25 tests passed**.
- `scripts/contrast-audit.ts`: 80 gated rows, 0 FAIL.
- `git diff --check` is clean.

## Web (EXECUTED, `web-check.txt`)

The web path is unchanged in code:
- `excludedArrows`, the web batches and `WebDynamicBoardLayer` are untouched;
- `holdMark` is false on web, so web gets no extra commit.

Browser pane check (flag on):
- A blocked click mounts the SVG overlay and blocker at +18 ms.
- The overlay is removed at +360 ms and the blocker at +709 ms, which match 340/690 ms plus input latency.
- The arrow settles into the web mark batch (`#B12B67`), and the hearts dropped.

## Hint

**Hint: no gap measured (0 frames).** It was not captured. On this build the hint appears only after a rewarded ad. The stall hint is compiled off (`FTUE_STALL_HINT_MS = null`), and the harness never interacts with an ad. `HintArrow` is left as it was, per the brief.

## Decisions

- **Cover instead of mount-then-hide overlap:** reasons in section 3.
- **Head cover shape:** measured on cold launches, where the first overlay's first paint matters.
  - A stroked head outline delayed the first paint by one frame: heart run 318 vs 334 ms median (`cold/`; diagnostic builds `diag-nocover` and `diag-nohead`).
  - So did a Skia path-op union (post3: 317 ms).
  - The final grown triangle (a plain fill) measures 333 ms, the same as HEAD's 332.5 ms.
  - Derived values for the outset were also dropped (plain numbers). On its own, that did not change the cold result (post2).
- **Mark hand-back at 170 ms:** the midpoint of the overlay's 340 ms life. It is not a new tuning number.
- **Flag-off:** the fix is unconditional on native. The forgiven and unmarked taps (arrow 38) take exactly the flag-off code path (no native change at all), and they recorded 0 ABSENT. A flag-off build itself was not captured (INFERRED).

## Concerns

1. **Owner eyeball: grid dots under the tapped arrow** (META_BOARD_GRID only).
   - The cover is background-coloured, so during the 340 ms flash the 1–2 lavender dots under the tapped arrow's own path stay hidden.
   - Before, they peeked through where the lunge uncovered them (compare the crops in `pre/check-a14-ev1-long.png` and `post/check-a14-ev1.png`).
   - With the flag off there are no dots, so the difference is 0.
2. **A superseding tap within 170 ms of a charged first tap on another arrow:** the first arrow's held mark reaches the native board in the same commit that drops its overlay. So one frame of its pre-tap **ink** is possible before the mark.
   - It can never be a blank.
   - The unit test pins "never hidden" for this case, not the strict rule. It was not observed on the device.
3. **Cover outset:** 1.5 device px (`OWNER-PICKED STARTING VALUE`) is computed at the zoom the tap landed at. A pinch during the 340 ms flash scales it, and at the most zoomed-out camera it could drop under 1 px. UNVERIFIED on the device.
4. **UNVERIFIED-DEVICE:** physical Android hardware, iOS (the same JS applies to the Swift board; not run), the fit camera (zoomed camera off), and flag-off builds.
5. **Perf not traced.** A blocked tap now makes **no** native mask rebuild, where it used to make 2. A charged tap makes one mark-mask rebuild at 170 ms. The Skia overlay draws two more paths. This is expected to be cheaper, but it was not measured.
6. **Harness incident (no lasting effect).** My RED re-run backup `tar` got its six source paths as one quoted argument (zsh does not word-split `"$FILES"`), so the tar did not contain them. The sources were rebuilt from the scratch copies (BoardView, StaticBoardSurface) and by re-applying the recorded edits. The result was verified **byte-identical** to before: `git diff | shasum` was `846146895ea0` before the incident and after the restore.
7. **Superseded artifacts:** `post/` (post1), `post2/`, `post3/` and the `diag-*` builds were earlier iterations; `post4` is final. `latency/` was a failed `show_touches` approach (the indicator is not captured by `screenrecord` for injected taps). It was reverted: `show_touches` was deleted and reads back `null`.

## Owner acceptances needed

- `artifacts/POLISH-T6/owner-handoff-before-after-x4.mp4` (and `-x1`): does the tapped arrow now stay continuously visible, with no blink at the start or end of the flash, in both motion-on and reduced-motion rows? **yes/no**
- Does the same video read as the same flash and lunge as before, with timing, colour and settle unchanged? **yes/no**
- Grid-on only: is it acceptable that the grid dots directly under the tapped arrow stay hidden for the 340 ms flash (concern 1)? **yes/no**

## Housekeeping (EXECUTED, `device-restore.txt`)

- emulator-5556 is running with the post-fix APK installed: sha256 `e9d0fdf09c6450ce6a6264c9b5200d1ba8ce6fa7ea580b8a8022a1208c5f25f6`, also at `artifacts/POLISH-T6/arrows-testads-T6-post4.apk`. The app data was kept, since every install was `install -r` with the same signer and versionCode.
- Scales 1/1/1, read back. Daylight theme restored. `show_touches` is `null`.
- `/sdcard/t6-*` and `/data/local/tmp/t6-ui.xml` were removed.
- The web server was stopped.
- `android/app/build.gradle` versionCode was restored to 8.

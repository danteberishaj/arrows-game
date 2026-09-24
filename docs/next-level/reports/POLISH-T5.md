# POLISH-T5: missed arrows stay marked (META_MISSED_MARK; rulings R6 + R6a, design spec C)

Status: **DONE_WITH_CONCERNS**.

With `META_MISSED_MARK` on (Android and web), a blocked tap that actually **charged** a heart marks the tapped arrow. The mark is a steady deep rose: Daylight `#B12B67`, Ink Night `#B93970`, normal stroke width. It stays for the rest of the level.
- The existing 300 ms blocked colour mix now ends at the mark instead of ink (R6a). There is no second transition, no new timer and no timing change.
- Re-tapping a marked arrow is free and settles back to the mark.
- A tap forgiven by the tutorial grace or the assist rule does **not** mark the arrow.
- Removing a marked arrow (once it is unblocked) clears its mark. A new board (Next or Retry) clears all marks.

With the flag off:
- no mark prop reaches the native view (payload test);
- the board renders **0 px** different from a gradle build of HEAD, in both themes, before and after a blocked tap and three removals.

The concerns are listed below. The main ones: the owner has not yet judged the feel; there is a pre-existing one-frame hand-off blink; the found app data on the emulator was lost.

Environment:
- Branch `next-level` at `6e36d67`, with uncommitted working-tree changes. No git state was changed.
- emulator-5556 (AVD `fleet_floor_api31`, API 31, 1440x3120 @560). Everything is **emulator only** unless it is labelled web.
- Four gradle release builds (arm64): M, C, O and HEADbase (table below).
- Skills invoked before the motion decisions: `animate-expo`, `emil-design-eng`.
  - Frequency gate: at most once per arrow per level. Purpose: state indication.
  - Both skills argue against adding a second transition or a flicker. That matches R6a: re-target the end colour of the existing mix, and add no new animation.

## What changed

| File | Change |
|---|---|
| `src/featureFlags.ts` | `META_MISSED_MARK = process.env.EXPO_PUBLIC_META_MISSED_MARK === '1'` (OFF by default). |
| `src/ui/missedMarkFlag.ts` (new) | `MISSED_MARK_ENABLED = META_MISSED_MARK && Platform.OS !== 'ios'` (R7). iOS has no mark mask, so it keeps today's look entirely. Settling to the mark and then popping back to ink would be a flicker. |
| `src/ui/missedMarks.ts` (new) | Pure helpers, listed below the table. |
| `src/ui/contrastAudit.ts` | Changes listed below the table. |
| `src/ui/GameScreen.tsx` | `onBlocked` now **returns** `cost.chargeHeart`. It returns `false` for a tap while the lose transition is pending, and for grace, assist and repeat taps. Nothing else changed. |
| `src/ui/BoardView.tsx` | Changes listed below the table. |
| `src/ui/StaticBoardSurface.types.ts` | `BumpingArrowArt.settle?`; `markShaftD`, `markHeadD`, `nativeMarkMask`, `markColor`. |
| `src/ui/StaticBoardSurface.native.tsx` | Spreads `nativeMissedMarkProps(...)` onto `ArrowsBoardView`, which is `{}` with the flag off. `ShakingArrow` mixes `[heart, art.settle ?? ink]`. |
| `src/ui/StaticBoardSurface.tsx` (web) | Draws the mark batch in `markColor` after the ink batch, at the same stroke width. |
| `modules/arrows-board/src/ArrowsBoard.types.ts`, `ArrowsBoardModule.kt` | Optional `markMask` and `markColor` props. |
| `ArrowsBoardView.kt` | Changes listed below the table. |
| tests | `missedMarks.test.ts` (new, 16, core project) and `GameScreen.missedMark.test.tsx` (new, 3, ui project). |

What `missedMarks.ts` contains:
- `missedMarkColor(p) = composite(p.heart, 0.75, darkerOfInkBg(p))`. `MISSED_MARK_ALPHA = 0.75` is marked `// OWNER-PICKED STARTING VALUE`, from design spec C.
- `NO_MARKS` and the immutable helpers `marksAfterBlockedTap(marks, arrow, chargedHeart)` and `marksAfterRemoval`. Each returns the **same** set when nothing changed, so the mask is rebuilt only when the set changes.
- `settleColor`.
- `missedMarkMask(cache, marks)`: an O(n) string with one character per initial arrow, and `''` when there are no marks.
- `nativeMissedMarkProps(mask, colour, enabled)`, which returns `{}` when disabled.

`contrastAudit.ts` changes:
- `Usage.fgOver?` (the colour the alpha composites over) and `darkerOfInkBg(p)`. `auditUsage` uses `fgOver` when it is set.
- A new row: `arrow-missed-mark` (`heart`@0.75 over the darker of ink/bg, on `bg`, graphic, 3:1). Its site is `src/ui/missedMarks.ts:22`.
- Shifted `site` lines were remapped by `artifacts/POLISH-T5/scripts/remap-sites.py`. It uses difflib against HEAD and asserts that each old and new source line is identical (`site-remap.txt`):
  - GameScreen: +3 on every row;
  - BoardView: 917/918/919 → 959/960/961.

`BoardView.tsx` changes:
- `marked` state (`ReadonlySet<ArrowPath>`).
- **Blocked tap:** `const charged = onBlocked(ledger.charge(owner))`, then, only when `MISSED_MARK_ENABLED`, `setMarked(marksAfterBlockedTap(...))`. This happens in the same commit as the bump.
- **Removal:** `marksAfterRemoval`.
- **Board change** (Next, Retry, tutorial re-deal): `setMarked(NO_MARKS)` in the existing reset layout effect.
- `BoardContent` builds:
  - the native mark mask;
  - the web mark batch (marked arrows are left out of the ink batch);
  - `markColor`;
  - `shakingArt.settle`, added only when the tapped arrow is marked.
- The web `ShakingArrow` takes a `settle` colour.

`ArrowsBoardView.kt` changes:
- `setMarkMask`, which returns early when the value is unchanged and has a trace section, and `setMarkColor`.
- `rebuildCompoundPathsLocked` sends visible arrows whose mark character is `'1'` into `compoundMarkShaft/Head`, and every other visible arrow into the ink paths.
- `onDraw` draws the mark paths after the ink paths, only while `hasMarkedArrows`.
- `setStrokeWidth` also sets the mark paint. `clearPaths` resets the mark state.
- Without the props, nothing new runs, and the draw calls are today's.

Not changed:
- `feedbackCurves.ts`, `firstPaintCleanup.ts`, and every duration, curve and amplitude. The 340/690 ms lifetimes and `FirstPaintCleanupTimer` are untouched.
- No `withTiming`, `withSpring` or `withDecay` was added, so `reduceMotionPolicy.test.ts` is unchanged.
- The Swift view.
- No save key. Marks are not persisted, so there is no migration and no wipe risk.

## Which taps mark (the report must say this)

Only a tap whose **final** `blockedTapCost(...).chargeHeart` is true marks the arrow. The raw `blockedLedger.charge()` result does not count, because it is also true for a tutorial-grace or assist tap that is then forgiven.
- Those forgiven taps settle to ink and are never marked.
- The ledger has already recorded them, so a re-tap is free and can never mark them later either.
- A blocked tap while the lose transition is pending also returns `false`.

## TDD
- **RED (EXECUTED, `artifacts/POLISH-T5/tdd/red.txt`):**
  - `missedMarks.test.ts` failed to compile: `Cannot find module '../missedMarks'`.
  - `GameScreen.missedMark.test.tsx` failed 3/3, because `onBlocked` returned `undefined` (`Expected: true, Received: undefined`).
  - Both failures are the right reason.
- **GREEN (EXECUTED, `tdd/green.txt`): 19/19.** The tests cover:
  - the spec hexes;
  - ≥ 3:1 on bg, and darker than heart;
  - the audit row at 6.16 / 3.45;
  - the settle colour: mark only for a marked arrow;
  - a normal charged tap marks;
  - a re-tap is free and keeps the same set reference;
  - a tutorial-grace tap does not mark, can never mark later, and the next fresh tap does mark;
  - an assist tap before the first removal does not mark, and does mark after a removal;
  - removal clears only that mark, and removing an unmarked arrow keeps the same reference;
  - a restart starts from `NO_MARKS`;
  - the mask has one character per arrow, and is `''` with no marks;
  - **flag-OFF props are `{}`, and the spread props JSON is byte-identical**;
  - flag-ON props;
  - GameScreen returns charged/refunded correctly on normal boards, T2 grace, and after the lose transition begins.

## Builds (EXECUTED)

`artifacts/POLISH-T5/scripts/build.sh` works as follows:
- `df -h /` right before each build: 9.1–9.4 GiB free, against the 5 GB gate (`df-before-build-*.txt`).
- `ANDROID_HOME` set, the Metro cache cleared (the count of cache directories left is printed as 0), and `./gradlew --stop`.
- `:app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease -PreactNativeArchitectures=arm64-v8a`.
- `prove-bundle.sh` (ASCII and UTF-16LE) then checks the bundle.

Every bundle has **0** occurrences of the owner's `ca-app-pub-9813131856455133` and of the units 6706292920, 7549521178, 3505414519 and 5508761320. Every bundle contains Google's TestIds (`ca-app-pub-3940256099942544`). Every launch logged `unitSet=test` before any interaction (`unitset-*.txt`).

| Build | Flags (`EXPO_PUBLIC_*`) | bundle sha256 | Notes |
|---|---|---|---|
| M | ADMOB_TEST_ADS, META_MISSED_MARK | `b6a52053…` | Rebuilt with a verified-empty Metro cache: the bundle is byte-identical to the first build. The first build's `rm` glob had failed under zsh (see Gotchas). |
| C | M + ZOOMED_CAMERA + EXIT_TO_SCREEN_EDGE + BOARD_GRID + FTUE | `7cb16167…` | The combined set. FTUE was added for the tutorial check. |
| O | ADMOB_TEST_ADS only (this tree, flag off) | `29abdb72…` | dex has `setMarkMask` |
| HEADbase | ADMOB_TEST_ADS only (HEAD `6e36d67` contents) | `b9b31046…` | See below. |

How HEADbase was built:
- The 10 modified files were written from `git show HEAD:<f>` (read-only git), the APK was built by gradle, and my versions were then restored from a tar backup.
- `git diff | shasum` was `1fa819f2…` both before and after, so the working tree is identical.
- Its dex has no `setMarkMask`.
- This is a true gradle build of HEAD, native and JS, not a repack.

## Evidence (all under `artifacts/POLISH-T5/`)

**Summary:** `00-summary.png`.

**Owner mp4s:**
- `owner-missed-mark-day-night-rm-x1.mp4`, real time;
- `owner-missed-mark-day-night-rm-x4.mp4`, 4× slow.

Both show Daylight | Ink Night | reduced motion side by side, cropped around the tapped arrow: the first tap, then the free re-tap.

**Raw recordings:** `cap-M/*-blocked.mp4` and `cap-C/*-blocked.mp4`, with per-frame tables in `*-frames.txt`.

**Method:**
- `scripts/capture.mjs` sets the three scales and reads them back after a force-stop and relaunch. It taps Play at a fixed coordinate (the home screen never idles for uiautomator) and records `screenrecord 720x1560`.
- The taps use the harness input jar:
  - X, a blocked 8-cell Down arrow (level 1, arrow index 14);
  - X again;
  - 3 other free arrows;
  - Y, X's blocker (index 4);
  - X, which is then free.
- `plan.ts` chose X and Y from `LevelGenerator.generate(0)` plus the camera formula. The screenshots confirmed the geometry.
- `analyze.py shot` classifies the centre pixel of each of X's and Y's cells, and counts heart-coloured header pixels (≈2499 px per pip).
- `analyze.py video` classifies every pixel in X's cells (dilated 0.3 cell along the lunge) to its nearest palette colour and takes the majority per frame. It also gives the centroid shift along the head direction.

1. **EXECUTED: the steady mark, and a re-tap costs nothing (build M, scales read back 1/1/1).** See `cap-M/day-s1-*.png` and `night-s1-*.png`.

   | Moment | Daylight | Ink Night |
   |---|---|---|
   | After X's first blocked tap and a re-tap | all 8 X cells exactly `#B12B67` | all 8 X cells exactly `#B93970` |
   | Blocker Y at the same moment | `#191724` (ink) | `#EFEDF9` (ink) |
   | Heart pixels | 7497 → 4998 (3 → 2 pips), unchanged by the re-tap | 7494 → 4996 |
   | Arrows left | "60 left" throughout | "60 left" throughout |

2. **EXECUTED: the settle recording** (`day-s1-blocked-frames.txt` and `night-s1-…`).

   What the frames show, in order:
   - The tap frame is heart.
   - The colour moves from heart toward the mark:
     - Daylight: the distance to the mark falls 51.6 → 47 → 40 → 36 → 28 → 24 → 22 by +183 ms;
     - Ink Night: 60.7 → 14.6 by +283 ms;
     - this is monotone within about ±5 of H.264 chroma noise.
   - The colour then holds.
   - **0 frames with an ink majority after the tap**, out of 438 (Daylight) and 440 (Ink Night). That covers the whole 280–420 ms hand-off window, and the same holds for the re-tap.
   - Lunge (Daylight): 15.6 px peak (0.23 cell), and 0 by +266 ms.

   The re-tap does the same: heart → mark, and never ink.

   Frame counts reconcile: 441 frames over the 9 s recording at about 16.7 ms spacing while the screen changes. The recorder emits no frames while the screen is static.
3. **EXECUTED: the mark persists after several moves.** `2-after-others.png`, taken after three other removals ("57 left"): X is still all `#B12B67` / `#B93970`.
4. **EXECUTED: removing X once it is unblocked clears the mark.** Y was tapped (it exits, "56 left", and X is still marked), then X (it exits, "55 left"). Every X cell then reads bg. In the combined build the cells read the grid dot colour `#D2CCE8` / `#353150`, with no rose.
5. **EXECUTED: reduced motion** (`cap-M/day-s0-*`; scales set to 0/0/0 and read back after the relaunch).
   - The frames show heart (1242 of about 1400 pixels) from the tap until +317.6 ms, with a shift of 0.0 px in every full frame.
   - Next comes one hand-off frame with almost no X pixels (see concern 2).
   - From +334.3 ms onward, the mark (1239 px). There is **no tween frame and no motion**.
   - The re-tap does the same (heart at +0, the mark at +380 ms).
   - Screenshots: the mark `#B12B67`, the hearts 3 → 2, and the mark cleared on removal.
6. **EXECUTED: tutorial, FTUE on, fresh data** (build C; `cap-C-tutorial/`).
   - I completed T1. On T2, arrow 2 (Down, blocked) was tapped: the graced tap. The header changed to "Blocked. Clear what's in its way.", and the hearts stayed at 3 (7497 px).
   - A re-tap: still 3 hearts.
   - Both of arrow 2's cells read `#191724` **ink**.
   - The recording (`t2-graced-frames.txt`) goes heart → ink (0 px distance from ink by +249 ms) and stays ink. The mid-mix passes near the rose hue for about 80 ms. That is today's heart → ink interpolation.
   - **Positive control, same deal:** a fresh blocked tap on arrow 3 (grace spent) charged a heart (7497 → 4998) and marked arrow 3 as `#B12B67`. So the same build can mark, and the graced tap simply did not.
7. **EXECUTED: combined flags** (build C, zoomed camera, grid, exit to the screen edge; `cap-C/comb-{day,night}-s1-*`).
   - Items 1–4 reproduce exactly: the mark hexes, the hearts, persistence, and clearing on removal.
   - The recordings have 0 ink-majority frames after the tap in both themes.
   - The mark is drawn over the grid dots, and the grid shows through where X was.
8. **EXECUTED: flag OFF is 0 px different from HEAD** (`flag-off-vs-head-pixel-diff.txt`, `cap-flagoff/`).
   - Compared: O against HEADbase, the same capture sequence, both themes, 5 moments each (start, after X twice, after the others, after the blocker is removed, after X is removed).
   - Result: **0 differing px** in rows 120–2951 in all 10 comparisons. Only the status-bar clock differs.
   - Flag OFF settles X to ink (`#191724` in all cells).
   - **Positive control:** O against M differs by 0 px at the start (flag ON with no marks draws the same pixels) and by 5994 px after X is marked. So the diff can fail.
9. **EXECUTED: web** (`web-check.txt`; `npx expo start --web --port 8097` with the flag on, in the Browser pane at 375x812).
   - Clicking X: hearts 3 → 2, and the DOM has shaft `stroke="#B12B67" stroke-width="5.76"` (the ink stroke width) and head `fill="#B12B67"`.
   - Re-click: still 2 hearts.
   - Y removed: X is still marked.
   - X exits: 0 mark paths.
   - No PNG was saved: the pane does not write screenshots to disk. The server was stopped.
10. **EXECUTED: gates** (`gates/`).
    - `npx tsc --noEmit` exited 0.
    - `npx jest`: **59 suites and 973 tests passed**. That includes `contrast.test.ts` and `reduceMotionPolicy.test.ts`, 148 tests between them.
    - `npx jest --selectProjects ui`: **6 suites and 17 tests passed**.
    - `npx tsx scripts/contrast-audit.ts` lists `arrow-missed-mark` as Daylight `#B12B67` 6.16 PASS and Ink Night `#B93970` 3.45 PASS. 80 gated rows, 0 FAIL.
    - `git diff --check` is clean.

## Decisions
- **Where the "charged" decision comes from:** `onBlocked` returns GameScreen's final `chargeHeart`, and BoardView (which owns the ledger and the board lifecycle) keeps the set. So the tutorial and assist rules stay in one place (`blockedTapCost`), and the mark follows them automatically.
- **An immutable set in React state:** the mark mask is an O(n) string memoised on the set's reference. It is rebuilt only when a mark is added or a marked arrow is removed. A re-tap, an unmarked removal, or no marks at all (`''`) cause no native rebuild.
- **Native: two new props, not a combined string:** `markMask` changes per mark and `markColor` per theme. Kotlin ANDs the mark mask with `visibleMask` in the existing rebuild. When a marked arrow is tapped or removed, both masks change in one commit, so there are two O(n) rebuilds in that commit. W6-01 measured one rebuild at ≤ 0.5 ms. The cost of the second is UNVERIFIED (not traced).
- **iOS gated off** (`MISSED_MARK_ENABLED`), for the reason in the table above.
- **Web mark batch:** a second SVG path pair. Marked arrows are left out of the ink batch, so the rose does not sit over an ink stroke.
- **The exit trail of a marked arrow stays ink**, per the design spec.
- **Capture helpers** (fixed Play and theme coordinates, and the majority-vote classifier) are documented in `scripts/`.

## Concerns
1. **The feel is not accepted yet.** The 0.75 alpha, how deep the rose is, and whether the 300 ms heart → rose reads as "stays red" need the owner's eyeball (below).
2. **A pre-existing one-frame hand-off blink** (W0-04 concern 2, a W6-01 area) is visible when the overlay mounts and unmounts.
   - It is one recorded frame with almost no pixels of the tapped arrow. In reduced motion that is at +317.6 ms (first tap) and +364.5 ms (re-tap).
   - It was there before (ink → nothing → ink) and is now mark → nothing → mark. This task did not change the mask/overlay timing, as the brief required.
   - Design spec C criterion 2 says "no frame from 280–420 ms shows **ink**", and that holds: 0 ink frames. The blink frame, however, shows **nothing** for about 16 ms.
3. **The emulator's found app data was lost.** Each run started with `pm clear` for fresh data. The APK, the scales and the signer were restored (below). The previous app data was not backed up.
4. **Retry, Next and rewarded-continue behaviour is not shown on the device.**
   - INFERRED from the code: Retry and Next build a new `board`, so the existing reset effect calls `setMarked(NO_MARKS)`, covered by a unit test. A rewarded continue keeps the board, so the marks are kept, as the design spec says.
5. **Web:** the settle animation was not examined frame by frame. The web `ShakingArrow` colour never animated before this task either (W0-04 concern 3), so on web the arrow holds heart and then shows the mark when the overlay unmounts, which is the same as reduced motion. The static mark is VERIFIED through the DOM reads.
6. **UNVERIFIED-DEVICE:** physical Android hardware and iOS (gated off).
7. **Not done:** a perf trace of the second mask rebuild on a marked tap. It fires at most once per arrow per level.

## Gotchas (for project memory)
- **zsh glob abort:** under zsh, `rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*` aborts the whole command on a no-match glob ("no matches found"), so the Metro cache silently stays. Use `find … -exec rm`, and print the count that is left.
- **Variable-rate frame extraction:** `screenrecord` output is variable-rate. `ffmpeg -ss t` returns the first frame *after* t, not the frame on screen at t. My first contact sheet showed a blank hand-off frame as "+150 ms" in reduced motion. Select the last frame with pts ≤ t.
- **uiautomator on the home screen:** `uiautomator dump` fails with "could not get idle state" on the home screen. The game screen dumps fine.
- **A "strongest pixels" colour metric is fragile in Ink Night:** 3 stray near-white neighbour pixels out-rank the rose mark, because they are farther from the dark bg. Use a per-pixel nearest-class majority.

## Owner acceptances needed
- `artifacts/POLISH-T5/owner-missed-mark-day-night-rm-x1.mp4` (and the `-x4` slow version): does the blocked flash settling into the deep-rose mark read as "this one was used incorrectly", calm and not alarming, in both themes? **yes/no**
- `artifacts/POLISH-T5/00-summary.png`, the "after 3 other moves" tiles: is the steady mark (`#B12B67` / `#B93970`, heart @ 0.75) clearly distinct from ink, the flash and the hint, without being loud? **yes/no**
- The same summary, reduced-motion row: is heart for about 320 ms and then a hard cut to the mark acceptable? **yes/no**

## Housekeeping (EXECUTED)
- emulator-5556 was left running, with `artifacts/test-build-2026-09-21/arrows-test-f58692c.apk` reinstalled. The on-device sha256 is `3b0598d8…f939`, the same as found. Scales are 1/1/1, read back. `/sdcard/t5-*` and `/data/local/tmp/t5-ui.xml` were removed (`device-restore.txt`).
- No `.env` exists: the flags were passed inline. The web server was stopped, and the Browser pane viewport was reset and closed.
- `android/app/build` was kept, because 9.3 GiB is free (≥ 6 GB). **Its last output is HEADbase** (HEAD contents, flags off), so the next builder must use `--rerun` as usual.
- The scratch APKs (M, C, O, HEADbase, the head-native host) and the backup tar are in the session scratchpad, outside the repo. Nothing was copied from `artifacts/` into a tracked path.
- No git command that changes state was run.

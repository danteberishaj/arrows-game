# CAMERA-REFIT-AFTER-AD — the player's camera survives a rewarded ad

- **Status:** DONE. A defect fix, no flag (nothing visible changes except that the camera is kept).
- **Base:** `a37cc6a` + the W7-04 patch (this task's patch is the second of the series; it touches no W7-04 line except
  3 BoardView line references in `contrastAudit.ts`, which W7-04 also edits, so it applies on top of W7-04).
- **Evidence:** `artifacts/CAMERA-REFIT-AFTER-AD/` (gitignored). Labels: **EXECUTED**, **INFERRED**,
  **UNVERIFIED-DEVICE**. No state-changing git command was run.

## Root cause

- **EXECUTED (BASE, `[board-viewport]` log, both ad placements):** the game screen re-lays out twice around a rewarded
  ad. The board view measures `411.43 × 804.29` dp, then `828.29` while the full-screen ad is up, then `804.29` again
  after it closes (`cap/base/base-{continue,hint}-logcat.txt`). The bottom inset stays 48 dp throughout.
- **INFERRED (read):** the +24 dp is exactly the status bar (84 px at 3.5 px/dp): the top safe-area inset drops while
  the ad hides the status bar, the game header (at `insets.top`) moves up and the board view grows. The inset itself
  was not logged.
- **INFERRED (read), confirmed by the RED test below:** `BoardView`'s `onLayout` called `fitToViewport` on **every**
  layout, and `fitToViewport` unconditionally set `scale / tx / ty` to `initialCamera(...)`, the level's opening
  camera. The first relayout (under the ad) threw away the player's pan / zoom; the second fitted the opening camera
  again. So the player came back from a Continue or Hint ad to the opening camera. (The safe-area-inset effect had the
  same unconditional re-fit.)

## Pre-fix reproduction (EXECUTED on BASE `w508.apk`, sha `c5ef5fb8…`, emulator-5556 at 1440×3120 @560)

`scripts/capcam.mjs` (from W2-07's cap207.mjs): scales 1/1/1 read back, level 1 seeded, Play; the player's camera =
two pinch-outs to the fit clamp; then the ad; the rewarded **TEST** ad is closed only with BACK after 150 s (no
creative is ever tapped: `aclk` 0 in every run).

- **Continue:** 3 fresh blocked taps -> lose panel -> Continue -> ad -> BACK. The heart was refilled (1 filled pip) and
  the board **snapped back to the zoomed opening camera** (`cap/base/base-continue-{open,before,after}.png`).
- **Hint:** the hint button once its ad loaded -> ad -> BACK. The hint arrow shows, and the board is again at the
  **opening camera** (`cap/base/base-hint-*`).
- `scripts/camdiff.py` (board region y 300–2900, changed = max channel delta > 24):

| run | after vs before (the player's camera) | after vs open (the opening camera) | control: before vs open |
|---|---|---|---|
| BASE continue | 16.23 % | **0.63 %** | 16.20 % |
| BASE hint | 16.19 % | **0.26 %** | 16.20 % |
| FIX continue | **0.30 %** | 16.23 % | 16.20 % |
| FIX hint | **0.11 %** | 16.21 % | 16.20 % |
| BASE retry (new board) | 16.20 % | **0.00 %** | 16.20 % |
| FIX retry (new board) | 16.20 % | **0.00 %** | 16.20 % |

The residual 0.1–0.6 % is what legitimately changed on the board: the 3 missed marks (continue) and the violet hint
arrow (hint). `cap/camdiff.txt`; owner sheets `owner/CAMERA-owner-1-continue.png`, `owner/CAMERA-owner-2-hint-and-retry.png`.

## The fix

| File | Change |
|---|---|
| `src/ui/boardCamera.ts` | Pure `cameraOnViewportChange({ from, to, pose, held, hintId })` -> `keep` / `restore` / `refit`, with `CameraPose`, `HeldCamera`, `SAME_VIEWPORT_DP = 0.5` (OWNER-PICKED STARTING VALUE; the round trip measured identical floats and its smallest real change was 24 dp). |
| `src/ui/BoardView.tsx` | `fitToViewport` becomes `placeCamera(vw, vh, newBoard)`. A **new board always re-fits** (the board layout effect passes `newBoard = true`, and forgets any held camera). Any other layout or inset change asks the rule: the same viewport **keeps** the camera; a viewport returning to the size the player last had **restores** the camera held there; any other size is a real change and **re-fits**, holding the camera it leaves. The hint centring is one `centreOnArrow(arrow, scale, vw, vh)` used by the hint effect and, after a restore, for a hint granted while the ad was up. Diagnostic `[board-camera]` log lines only when `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1` (inlined false otherwise). |
| `src/ui/contrastAudit.ts` | The 3 BoardView line references re-pointed to the same line content (1052-1054 -> 1095-1097; `gates/remap-BoardView.txt`). |
| `src/ui/__tests__/boardCamera.test.ts` | 7 new pure tests (additions only). |
| `src/ui/__tests__/BoardView.cameraHold.test.tsx` | **New** ui test: BoardView's own `onLayout` driven with the measured 804 -> 828 -> 804 sequence, the camera read from the native surface's shared values. |

**Rule, stated once:** the camera the player had at a viewport comes back when the viewport returns to that size;
a size that does not come back re-fits; an unchanged size keeps the camera; a new board always opens at its
opening camera.

## TDD (EXECUTED; `artifacts/CAMERA-REFIT-AFTER-AD/tdd/`)

- **RED on the original failing path:** `BoardView.cameraHold.test.tsx` against the **unmodified** BASE BoardView:
  3 failed / 3 passed (`red-BoardView-cameraHold.txt`). The failure is the defect itself: after 804 -> 828 -> 804 the
  camera was the opening one (`scale 0.4834, tx 12.34, ty 208.77`) instead of the player's (`0.9669, -137.66,
  118.77`). The same-size-layout and hint-during-ad tests failed too; the real-change and new-board tests passed (they
  pin behaviour that must NOT change).
- RED for the pure rule: TS2305, `cameraOnViewportChange` not exported (`red-boardCamera.txt`).
- GREEN: 72/72 in the two suites (`green.txt`).
- **Found on the device, then pinned by a test (the review rule "jsdom is not the device"):** the first fix build
  restored the camera but threw the fit board off-centre after the **Hint** ad (`cap/fix-iter1/fix-hint-after.png`).
  The reward resolved while the ad was still up, so the hint effect had centred on the ad-time viewport; the restore
  then re-centred on the hint by **reading** `scale.value` / `viewport.value` in the same JS task that had just written
  them, and Reanimated applies a JS-thread write on the UI thread later, so the read returned the ad-time camera. A
  new test mocks exactly that (writes land at the next microtask) and failed on that build (`red2-deferred-writes.txt`:
  tx/ty from the stale camera); the re-centre now takes the restored camera as arguments: 73/73 (`green2.txt`).
- **Mutations** (`tdd/mutation-checks.txt`, `scripts/mutate.sh`; each applied, both suites run, restored, `cmp`):
  C1 no `keep` (3 failed), C2 no `restore` (the pure suite stops compiling + 3 ui tests), C3 hold the latest instead
  of the first camera (1), C4 no hint re-centre (2), C8 the re-centre reads the shared values again (the iter-1
  device bug: 1, the deferred-write test), C5 a board change treated as a layout (1), C6 BASE's always-refit (4),
  C7 a 30 dp tolerance (8). Every one caught, on the final code.

## Device verification of the fix (EXECUTED, `apk/camfix.apk` sha `4afa61db…`)

JS repack (`scripts/repackcam.sh`, the W7-04 / W5-02 pipeline) of `git archive HEAD` + **only** `BoardView.tsx` and
`boardCamera.ts`, W5-08's flag set (META_ZOOMED_CAMERA on, LOG_BOARD_VIEWPORT on), so it differs from BASE `w508.apk`
by the fix alone. Bundle proof gate: owner publisher and all 4 owner units 0/0 (ASCII + UTF-16LE), Google's test app id
present (`apk/camfix.apk.proof.txt`).

- **Continue** (`cap/fix/fix-continue-*`): after the ad the board is at the player's fit camera; camera log:
  `refit 756.29 (0.7347)` at mount -> `refit 780.29 held=756.29` under the ad -> `restore 756.29 scale=0.4834
  tx=12.34 ty=184.77` after it.
- **Hint** (`cap/fix/fix-hint-*`): same three camera lines; the board stays at the fit camera, centred (at fit the
  whole board is in view, so the hint re-centre clamps to centred), with the hint arrow drawn.
- **A new board still re-fits** (`cap/fix/fix-retry-*`): Retry after pinching out opens at the zoomed opening camera;
  log `new-board viewport=… scale=0.7347`. Pixel-identical to BASE's Retry result against the opening (0.00 %).
- **A real viewport change still re-fits** (`cap/fix/fix-resize-*`): `wm size 1440x2600` in game -> board view 655.71 dp
  -> `refit 607.71 held=756.29` (the opening camera for the new size); `wm size reset` -> `restore` of the player's
  camera. The activity was not recreated.

## Performance

No frame-path code changed: the gesture worklets and the per-frame surface are untouched; `placeCamera` runs on layout
events only (3 per ad, 1 per level). **INFERRED, not measured** (no A/B was run for this task).

## Decisions

1. **Hold the camera, restore on the way back** (rather than never re-fitting on a layout): the brief keeps a real
   viewport change re-fitting, and only a size that comes back can be told apart from a real change without timing
   guesses (AppState during an ad is not a reliable signal: the relayouts and the reward land in either order).
2. **The first held camera wins** when several sizes follow each other (A -> B -> C -> A restores A's camera).
3. **A hint granted during the ad is centred again after the restore**, at the player's zoom; a hint that was already
   showing before the ad is left where the player had it.
4. **Same-size layouts keep the camera** (BASE re-fitted on any layout event, even with an unchanged size).

## Concerns

1. **UNVERIFIED-DEVICE:** a physical phone; iOS (the same JS rule; iOS's ad presentation may not relayout at all);
   gesture-navigation devices, split screen / foldables (covered only by the rule's unit tests and one `wm size` run).
2. The test ad never showed "Reward granted" to uiautomator (as in W2-07); every run closed it with BACK after 150 s,
   and the reward was earned each time (refilled heart / hint shown).
3. `[board-camera]` lines exist only in builds with `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1` (the capture flag set).

## Gates (EXECUTED)

- `npx jest`: **112 suites, 1 866 tests, all pass** (`gates/jest-final.txt`; W7-04 ended at 111 / 1 852: +1 suite,
  +14 tests: 7 pure rule tests, 7 BoardView tests).
- `npx tsc --noEmit`: exit 0. `npx jest --selectProjects ui`: 34 suites / 311 tests. `git diff --check`: clean.

## Patch

`artifacts/CAMERA-REFIT-AFTER-AD/snapshot/camera-on-w704.patch`, the second patch of the series: base = `git archive
a37cc6a` + `artifacts/W7-04/snapshot/w704-on-a37cc6a.patch`; it carries `BoardView.tsx`, `boardCamera.ts`, the 3
`contrastAudit.ts` line references, the two test files and this report. `scripts/snapshot.sh` applies both patches
with `git apply` to pristine `git archive a37cc6a` and `git archive HEAD` trees and `cmp`s every path of both tasks with
the working tree: `snapshot/verify.txt`.

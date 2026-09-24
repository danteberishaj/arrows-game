# POLISH-T9: steady tutorial header, springy buttons, banner glide

**Status:** DONE_WITH_CONCERNS
**Base:** `1bf0f7e` (branch `next-level`). Nothing is committed; the controller commits.
**Artifacts:** `artifacts/POLISH-T9/`
**Installed on emulator-5556:** `artifacts/POLISH-T9/arrows-testads-T9.apk`, SHA-256 `81b0a92a…8a75`.
- This is the 2026-09-24 test-build flag set plus `EXPO_PUBLIC_META_PRESS_SPRING=1`.
- versionCode is 6 and the signer is `CN=Arrows`, the same as T8, so `install -r` over it keeps app data.

## Summary

| Part | Result | Evidence |
|---|---|---|
| 1. Tutorial header height is now constant | On T2, `[board-viewport]` fires **1 time after the fix, 3 times before** (at 411 dp) and **1 time after, 2 times before** (at 360 dp). The board moves **0 px** across T2's opening line, blocked line and emptied line, at both sizes. Before the fix it jumped **14.5 px (4.1 dp)** at 411 dp and **13 px (4.3 dp)** at 360 dp. | EXECUTED |
| 2. `META_PRESS_SPRING` (OFF by default) | ON: press-in eases over about 5 frames to 0.94, and release springs back. OFF: the style functions are byte-identical to 1bf0f7e (jest test). Taps fire once per press. | EXECUTED; the 4× owner video needs your yes/no |
| 3. Banner glide, inside `META_BANNER` | The stats line now glides (translateY, 220 ms ease-out). **Concern:** on this emulator the banner's height arrives while the menu itself is fading in, and the ad's own content paints about 0.45–0.55 s after the size event. So the 180 ms container fade finishes before there is anything to see. | EXECUTED; the owner eyeball is open |

**Found and fixed during verification** (not in the brief):
- Reanimated 4's default spring **mass is 4**, not 1. With the brief's `{damping 15, stiffness 400}` and mass 4, the release rang for about 5 s. That is about 290 extra UI frames per press. The code now sets `mass: 1` explicitly (Decision 3).
- A plain `minHeight: 46` still let the two-line label measure 46.29 dp on the 3.5× screen, because Android rounds each line up to whole pixels. The box height is now pixel-exact (Decision 2).

## What changed (files)

**`src/featureFlags.ts`**
- New `META_PRESS_SPRING = process.env.EXPO_PUBLIC_META_PRESS_SPRING === '1'`.

**`src/ui/PressScale.tsx` (new)**
- `PressScale` is the one shared press wrapper.
  - Flag OFF: it renders exactly the plain `Pressable` it replaces. There is no wrapper view and no shared value.
  - Flag ON: an `Animated.View` around the `Pressable` does the scaling.
    - Press-in: `withTiming(0.94, { duration: 90, easing: Easing.out(Easing.quad), reduceMotion: System })`.
    - Release: `withSpring(1, { damping: 15, stiffness: 400, mass: 1, reduceMotion: System })`.
- `pressSnapTransform(pressed)` returns today's `[{ scale: pressed ? 0.94 : 1 }]` when the flag is OFF and `undefined` when it is ON.
- Each picked number carries `// OWNER-PICKED STARTING VALUE`.

**`src/ui/HeaderButton.tsx`, `src/ui/HomeScreen.tsx` (Play pill), `src/ui/GameScreen.tsx` (Continue / Next / Retry)**
- `Pressable` is replaced by `PressScale`.
- The inline `scale` snap is replaced by `pressSnapTransform(pressed)`.
- The colour stays a pressed style.
- `hitSlop` and every accessibility prop stay on the Pressable.
- The Play pill's breathing `Animated.View` wraps `PressScale`'s own scaled view, so the two scales multiply.

**`src/ui/GameScreen.tsx` (part 1)**
- New `TUTORIAL_LINE_HEIGHT = 23` (OWNER-PICKED) and `tutorialLineBoxHeight(fontScale, pixelRatio) = 2·ceil(23·fontScale·pixelRatio)/pixelRatio`.
- The tutorial `Text` gets `lineHeight: 23`.
- It now sits in a `View` (`testID="tutorial-line-box"`) with `justifyContent: 'center'` and that `minHeight`. A single line stays vertically level with the back button.
- The layout outside the tutorial is unchanged.

**`src/ui/HomeScreen.tsx` (part 3)**
- With `showBanner`, the stats line is an `Animated.Text` whose `bottom` stays at `insets.bottom + 32`.
- Its `translateY` is `withTiming(-bannerHeight, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: System })`. The 220 is `BANNER_GLIDE_MS`, OWNER-PICKED.
- Without the banner flag, the original `Text` is rendered unchanged.

**`src/ui/MenuBanner.tsx`**
- The anchor is now an `Animated.View`.
- Its opacity is 0 until an ad has loaded, then `withTiming(1, { duration: 180, reduceMotion: System })`. The 180 is `BANNER_FADE_MS`, OWNER-PICKED.
- No space is reserved before a load.

**`src/ui/contrastAudit.ts`**
- Mechanical `file:line` pin remap, by `artifacts/POLISH-T9/scripts/remap-sites.py` (difflib, asserts identical source lines). Log: `artifacts/POLISH-T9/site-remap.txt`.
- Two pins pointed at lines that changed, so I moved them by hand:
  - `game-tutorial-line` now points at the moved style line.
  - `home-stats` points at the flag-off `Text`, with a note that the banner path's `Animated.Text` uses the same colour.
- No contrast rule or value changed.

**Tests**
- New: `src/ui/__tests__/PressScale.test.tsx` (8 tests) and `src/ui/__tests__/GameScreen.tutorialHeader.test.tsx` (4 tests).
- Extended: `src/ui/__tests__/HomeScreen.banner.test.tsx`.
  - `statsBottom` now returns the drawn offset (`bottom − translateY`). The existing expectations (32 / 90 / 82) are unchanged, not weakened.
  - One new test covers the glide and the fade.

**Persistence:** none. No key, schema or migration was touched. Wipe risk: none (INFERRED from the diff: no SaveSystem or storage code changed).

## Pre-fix reproduction (EXECUTED)

**Build:** `pre-log` = the unmodified tree (1bf0f7e) + test-build flags + `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1`.

**Script:** `scripts/t2seq.sh`. Fresh data → T1 → T2 in place → blocked tap on (2,0) → free tap on (2,4). Then a relaunch straight into T2 and the same steps.

| Size | T2 `[board-viewport]` lines, from mount through blocked → removal | Board shift (dot centroids, `scripts/boardbox.py`) |
|---|---|---|
| 411×891 dp | **3**: mount `h=815.43`, blocked `h=807.14`, removal `h=815.43` | +14.3…14.7 px (4.1 dp) at the blocked tap, back at removal |
| 360×640 dp (`wm size 1080x1920`, `wm density 480`) | **2**: mount `h=551.33`, removal `h=560` | −13.0 px (4.3 dp) at removal |

- At 411 dp the opening T2 line fits on one line, and the blocked line wraps. So the jump happens **twice**: during the blocked bump, and again at the next removal. This confirms the audit's needs-device guess.
- Evidence: `part1/pre-411/`, `part1/pre-360/` (logcats with `T9MARK` markers, screenshots, mp4), `part1/pre-411-boardbox.txt`, `part1/pre-360-boardbox.txt`.
- Button snap before the fix: the OFF recordings show the press as one frame, 1.0 → 0.938, with nothing in between (`part2/next-metric.txt`, `part2/grid-hint-metric.txt`).
- Banner before the fix: `part3/pre-*`.

## TDD (EXECUTED)

**RED runs.** The header and banner runs used the final tests against the base `GameScreen.tsx` / `HomeScreen.tsx` / `MenuBanner.tsx`, swapped in from `git show HEAD:` and then restored. The press run was taken before any source edit:
- `artifacts/POLISH-T9/tdd/red-header.txt`: 3 of 3 fail, because `TUTORIAL_LINE_HEIGHT` is undefined and there is no box.
- `red-press.txt`:
  - 2 ON-only tests fail.
  - The 4 flag-OFF characterisation tests **pass on base**. That is intended: they pin today's output.
  - The 2 "fires once" tests also pass on base, and must stay green.
- `red-banner.txt`: the glide/fade test fails (`opacity` is undefined, no transform).

**GREEN runs:** `green-header.txt` (4/4), `green-press.txt` (8/8), `green-banner.txt` (6/6).

**Two extra RED signals came from the device, not jest:**
- The first post-fix log build (`part1/post-v1-411/`) still logged `805.14 → 805.43` at 411 dp. That was a 0.29 dp (1 px) jump, and `boardbox` measured a 0.5 px dot shift. It led to the pixel-exact box height and its test.
- `dumpsys gfxinfo` showed 60 fps for about 4.7 s after each press on the first ON build (`part2/idle-frames.txt`). That led to the `mass: 1` assertion.

## Evidence

### Part 1: header (EXECUTED unless marked)

**Build:** `post-log` (APK `d21c19b3…`, bundle `8cab27cc…`). The bundle holds `tutorial-line-box`; the pre-log bundle does not (`builds/bundle-proof-post-v1-log.txt`).

**Log counts** (`part1/post-411/*-logcat.txt`, `part1/post-360/*-logcat.txt`):
- 411 dp:
  - A fresh mount into T2 logs exactly **1** line, `h=805.14`, and nothing more through the blocked tap and the removal.
  - The in-place T1→T2 flow logs 1 line for the whole of T1 + T2 (the T1 mount), and 0 while on T2.
  - It replicated on a second full run (`t2seq` rerun before the level-1 check: count 0 in place, 1 line in total).
- 360 dp: the same, 1 line (`h=550`).

**Board box** (`part1/post-411-boardbox.txt`, `part1/post-360-boardbox.txt`):
- The dot-grid centroids are identical (shift `0.0` px) across T2 start, blocked and after-removal, in both flows and at both sizes.
- They are also identical between T1 and T2.
- Instrument: dot centroid to about 0.1 px. The pre-fix positive control above measured 13–14.7 px.

**Level header unaffected:**
- Level 1 after the tutorial logs `h=804.2857` both before and after the fix (`part1/level1/{pre,post}-finish-logcat.txt`). That equals W1-01's native measure.
- So W1-01's non-tutorial numbers, and the W1-02/W3-08/W5-06/W5-15 dependants, need no recheck.

**Ruling F31, re-run of the W1-05 captures** (T1 at 360×640, T2 at 360×640, and the native 411×891 blocked → removal sequence):
- New values:
  - T1 360×640 viewport **360×550** (was 360×560).
  - T2 360×640 viewport **360×550** (was 360×551.33).
  - Native tutorial viewport **411.43×805.14** for T1, T2, the blocked line and the empty line.
- Cell size: the 5×5 boards stay width-limited, so it is still **67.68 dp** at 360 dp. That is INFERRED arithmetic: `0.94·min(360/5, 550/5)`.
- The three lines of copy are unchanged (no copy edits), have no ellipsis, and all three hearts fit. Visually checked: `part1/header-compare-411.png`, `part1/owner-header-stills.png`.

**Fit and look:**
- A single line sits centred on the back button, and two lines fill the 46.29 dp box.
- The T1 board now sits 18 px (5.1 dp) lower at 411 dp than before, and 5 dp lower at 360 dp. That is the price of the constant box. The audit predicted "T1's header grows about 9 dp".

**UNVERIFIED-DEVICE:**
- Physical phones, iOS, and non-default font scales. At other scales the box height is computed as `ceil(23·fontScale·pixelRatio)` px per line, and a unit test covers it, but it was not run on a device.

### Part 2: press spring (EXECUTED unless marked)

**Why separate recording builds:** `rec-on-fit` / `rec-off-fit` leave out `META_ZOOMED_CAMERA` so that level 1 clears with on-screen taps (`scripts/solve-plan.ts`: 60 taps, overlay checked in `probe/plan-overlay.png`). Buttons do not depend on the camera.

**Script** (`scripts/rec.sh`) presses with `input motionevent DOWN`, a 350 ms hold, then `UP`:
- Play on fresh data.
- `#` on level 1.
- 💡 slid off: DOWN on the button, then MOVE 620 px along the header, then UP. **The rewarded TEST ad was never shown or tapped.** The screen still showed "60 left" right after.
- Next level on the won panel. The "74 left" that followed proves one press loaded exactly level 2.

**Measured scale per recorded frame** (screenrecord is variable-frame-rate, so these are pts):

| Button | ON | OFF |
|---|---|---|
| Next | 1.0 → 0.978 → 0.960 → 0.952 → 0.943 → 0.938 over 65 ms (5 frames) | 1.0 → 0.938 in 1 frame |
| Play (breathing) | 0.984 → 0.946 over 65 ms, then the held scale follows the breath (0.946 → 0.950), so the two compose | snaps to 0.937 |
| 💡 release | 0.937 → 0.968 → 1.0 → 1.032 overshoot → 1.0 within about 230 ms | 0.937 → 1.0 in 1 frame |

- Sources: `part2/next-metric.txt`, `part2/play-metric.txt`, `part2/grid-hint-metric.txt`.
- Resolution: 1 px in about 63–227 px, i.e. 0.4–1.6 %.
- The `#` row is confounded by the grid lines it switches on (+2 px in both builds). Use the owner video for it.
- Next and Play navigate away on release, so their spring-back is not visible. That is inherent to them.

**Frames after a release** (`part2/idle-frames.txt`, `dumpsys gfxinfo`, 1 s windows at 60 Hz, level 2 idle before the press):

| Build | Window 0–1 s | 1–2 s | 2–3 s | 3–4 s | 4–5 s | 5–6 s |
|---|---|---|---|---|---|---|
| mass 4 (brief's numbers as written) | 63 | 63 | 64 | 62 | 40 | 0 |
| mass 1 (shipped) | 63 | 12 | 0 | 0 | 0 | 0 |
| OFF | 2 | 0 | 0 | 0 | 0 | 0 |

- The idle-before window was 0 frames for all three.

**Tests** (`tdd/green-press.txt`):
- Flag-OFF style-function output is byte-identical (JSON, key order included) to 1bf0f7e for HeaderButton at 36 and 44 dp, the Play pill, Next, Continue and Retry.
- With the flag ON, `userEvent.press` fires onPress **once** for HeaderButton, Play and Next.
- `hitSlop` 8, role and `accessibilityState` are kept.
- ON styles carry no transform.
- The timing and spring configs are the brief's, plus `mass: 1`.

**Owner video:** `part2/owner-press-on-vs-off-x4.mp4` (17.6 s: `#`, 💡, Play, Next, each ON | OFF, 4× slower). The per-button clips are `part2/owner-{hash,hint,play,next}-x4.mp4`, and the contact sheet is `part2/owner-press-contact.png`.

**UNVERIFIED:**
- Reduced motion for the press. `ReduceMotion.System` is covered only by config assertions in jest; it was not captured.
- Device feel.

### Part 3: banner (EXECUTED unless marked)

**Build:** `post-on` (the final APK). The Google TEST banner loaded ("Test Ad", `unitSet=test`; logs `part3/*-log.txt`). It was never tapped.

**Cold launch** (`part3/{pre,on,on-reduced}-banner.mp4`, `part3/banner-events.txt`):
- The banner size arrives during the splash / menu fade-in.
- Before the fix: the stats line appears already lifted (y=1286 in the half-size frame).
- ON: it appears at 1313 and glides to 1286 over about 100 ms (6 frames, ease-out). The first ~120 ms of the 220 ms glide are hidden under the screen fade.
- Reduced motion (scales 0/0/0 set, relaunched, read back): the line is at 1286 on the first frame, with no glide.

**Back to the menu from a game** (`scripts/banner2.sh`, `part3/{pre,on}-back-banner.mp4`):
- The same pattern. The size event comes at MenuBanner mount, while the menu fades in.
- The banner's pixels appear about 0.45–0.55 s later, as a 1–2 frame pop, in **both** builds.
- My 180 ms opacity ramp starts at the size event, so it has already finished before the WebView paints.
- The owner clip is `part3/owner-banner-back-to-menu-x4.mp4` (ON | BEFORE, 4× slower), with contact sheet `part3/owner-banner-contact.png`.

**Jest** (`tdd/green-banner.txt`):
- `bottom` stays at 32; there is no re-layout.
- The glide target is −58, then 0 on a failed fill, with a 220 ms timing.
- Opacity is 0 before a load and 1 after, with a 180 ms timing.
- The existing tests are unchanged in value.

**UNVERIFIED-DEVICE:** the case from the audit, where a slow network loads the ad seconds after the menu is visible, never happened on this emulator.

### Blink re-check (POLISH-T6 harness, EXECUTED)

- Setup: `artifacts/POLISH-T6/scripts/capture.mjs` + `aggregate.py` with its unchanged `plan.json` (level 1, zoomed camera, TOP 305). The level header is unchanged, as shown above.
- Runs: the final `post-on` APK, 3 sessions at 1/1/1 and 3 at 0/0/0 (read back after relaunch).
- Result: **0 ABSENT frames at mount, 0 at unmount, 0 ghost frames over 36 taps.** Every session went 60 → 59 left. Arrow 14 ended `mark` and arrow 38 ended `ink` (R6a unchanged).
- Evidence: `artifacts/POLISH-T9/blink/table.md`, `blink/cap/`.

### Gates (EXECUTED, `artifacts/POLISH-T9/gates/`)

- `npx jest`: **64 suites, 1010 tests passed** (T8's 997 + 13 new).
- `npx jest --selectProjects ui`: 10 suites, 45 tests passed.
- `npx tsc --noEmit`: exit 0.
- `npx tsx scripts/contrast-audit.ts`: 80 gated rows, 0 FAIL.
- `git diff --check`: clean.

### Builds (EXECUTED, `artifacts/POLISH-T9/builds/`, `scripts/build.sh`)

**Method:**
- Gradle arm64 incremental release builds, one at a time.
- Metro cache cleared with `find … -exec rm`; "0 dirs left" is printed in each build log.
- Each ran `:app:createBundleReleaseJsAndAssets --rerun`.
- versionCode was pinned to 6 and restored to 8 each time. `android/app/build.gradle` has no diff.
- `df -h /` right before each build: 5.3 → 4.8 GiB, all above the 5 GB (4 882 812 KiB) gate. Nothing was deleted.

**Ad-unit proof:** every bundle has 0 owner units (`ca-app-pub-9813131856455133` and all four unit numbers, ASCII and UTF-16LE) and holds the Google TestIds. This was checked before install.

**Builds:**

| Label | Flags beyond the test set | APK / bundle SHA-256 prefix |
|---|---|---|
| pre-log | LOG_BOARD_VIEWPORT, from the unmodified tree | 8b5b4029 / 167bbc57 |
| post-v1-log | LOG, first box (46 dp) | 1cc025f1 / 7e3f01bf |
| post-log | LOG, pixel-exact box | d21c19b3 / 8cab27cc |
| post-on-v1-mass4 | PRESS_SPRING | 53693283 / 95982608 |
| rec-on-fit-v1-mass4 | PRESS_SPRING, −ZOOMED | 720dd03e / 6132b265 |
| rec-off-fit | −ZOOMED | a4caf8ef / 7a3fc36a |
| rec-on-fit | PRESS_SPRING, −ZOOMED, mass 1 | 1c83c6d1 / 7d6a2e6d |
| **post-on (installed)** | PRESS_SPRING, mass 1 | **81b0a92a / a64d28a6** |

## Decisions

1. **Part 1: a box around the Text, not a `minHeight` on the Text itself.** On the Text, a single line would sit at the top of a 46 dp box, 5 dp above the back button's centre. The wrapper `View` centres it and keeps the brief's constant two-line height.
2. **Part 1: the box height is `2·ceil(23·fontScale·pixelRatio)/pixelRatio`, not `2 × 23`.**
   - Android lays each line out at `ceil(px)`: 80.5 → 81 px at 3.5×. The measured 46.29 dp label beat a 46 dp `minHeight` by 1 px, and the first post-fix build still re-fitted.
   - The font scale is included because lineHeight scales with it.
   - 23 dp itself is at or above the measured natural line of 22.14–22.33 dp (from the `[board-viewport]` deltas), so no glyph is clipped (see the stills).
3. **Part 2: `mass: 1` added to the brief's spring.** This is a deviation, with evidence.
   - The brief gives `{damping 15, stiffness 400}`. Reanimated 4.5's default mass is 4 (`GentleSpringConfig`, `node_modules/react-native-reanimated/src/animation/spring/springConfigs.ts:28-32`).
   - With mass 4 the damping ratio is 0.19 instead of 0.375, it visibly rings (`on-v1-mass4` 💡 still overshooting at +0.85 s), and it draws about 290 frames per press.
   - Mass 1 gives the curve the audit described.
4. **Part 2: 💡 is recorded as a press slid off the button.** A completed press would show a rewarded TEST ad.
5. **Part 2: separate fit-camera recording builds.** Level 1 at the zoomed camera cannot be cleared without panning, and the ADMOB-B calibration lesson made blind pans too risky.
6. **Part 3: the fade is tied to "an ad has loaded" (the size event, `loadedHeight > 0`), not to mount.** At mount the banner is 0×0, and fading in nothing would be pointless. See Concern 1.
7. **Where the in-place flow logs nothing:** the brief expects "exactly 1" on T2. The fresh-mount run gives exactly 1. In the in-place T1→T2 flow the board never re-fits at all, so T2 adds 0 lines. I report both.

## Concerns

1. **The banner fade is not visible on this emulator.**
   - The size event (which `MenuBanner` also wires to `onAdLoaded`) arrives about 0.45–0.55 s before the ad's WebView paints. The 180 ms ramp is over before there is content.
   - So the banner still appears as a 1–2 frame pop, as before.
   - The stats-line glide works, but here it overlaps the menu's own 180 ms fade-in. Before the fix, the jump was hidden under that fade; now the last ~100 ms of the glide are visible.
   - Owner or controller call:
     - (a) keep it;
     - (b) glide only when the menu has already been visible for a while;
     - (c) delay or drop the fade, since Google's view pops its content anyway.
   - I have no device or slow-network capture of the audit's late-load case.
2. **The spring tail.** Even with mass 1, Reanimated's `energyThreshold` of 6e-9 keeps the UI thread drawing for about 1.2 s after each release (75 frames, `idle-frames.txt`). The last ~1 s is sub-pixel. Raising `energyThreshold` would trim it, but that is another picked number, so I left it for a ruling.
3. **DESIGN.md:253** still says "no tween either way". That is correct while the flag is OFF (the default). If the owner accepts the flag, the doc needs an update. I did not edit docs outside the report.
4. **The T1 board sits about 5 dp lower** in every tutorial state, at both sizes. This is by design (a constant two-line box), but your earlier FTUE acceptance covered the old layout, so please re-accept it (below).
5. **Disk is now 4.4 GiB free** (it was 4.8 GiB right after the last build). The next native build would be under the 5 GB gate. This task's recordings and APK copies in `artifacts/POLISH-T9/` total 92 MB.
6. **Emulator state:** app data was cleared several times (FTUE captures). The app is now at LEVEL 1 with the tutorial finished.

## Owner acceptances needed

- `artifacts/POLISH-T9/part1/owner-header-stills.png` (T1, T2, blocked and emptied, before and after, at 411 and 360 dp): is the new constant-height tutorial header OK, with the board about 5 dp lower? **yes / no**
- `artifacts/POLISH-T9/part2/owner-press-on-vs-off-x4.mp4`: do the eased press-in and spring-back (left) feel better than today's snap (right) for `#`, 💡, Play and Next? **yes / no**
- `artifacts/POLISH-T9/part3/owner-banner-back-to-menu-x4.mp4`: keep the stats-line glide as it behaves here (partly during the menu fade-in), knowing the banner itself still pops? **yes / no** (see Concern 1 for options a/b/c)

## Final emulator state (EXECUTED, `artifacts/POLISH-T9/device-final.txt`)

- `emulator-5556` is `device`.
- Screen size and density are physical: `1440x3120 @560`. The `wm` override was reset after the 360 dp runs.
- Scales are `1/1/1`.
- Installed: SHA-256 `81b0a92a…` = `artifacts/POLISH-T9/arrows-testads-T9.apk`, versionCode 6. The menu shows Level 1 with the test banner.
- It was not booted, killed, wiped or snapshotted. No commit was made.

## Controller amendment (review, 2026-09-24)
- **Banner fade removed** (`MenuBanner.tsx` reverted to 1bf0f7e; the banner test now asserts the banner is never
  faded). Reasons: (1) concern 1 above — the fade finishes before Google draws the creative, so it is invisible;
  (2) a banner view kept at opacity 0 until `onSizeChange` fires risks AdMob's hidden-ad policy if that event is
  late or missing. The stats-line glide stays.
- **Spring `mass: 1`** accepted (Reanimated 4 default mass 4 bounced and redrew ~5 s). The ~1.2 s settle tail is
  parked; the flag is OFF.

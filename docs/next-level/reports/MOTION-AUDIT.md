# MOTION-AUDIT: motion and native feel (2026-11-18)

Lens: Emil Kowalski's design-engineering rules (skills `emil-design-eng`, `animate-expo`, `improve-animations`,
`mobile-native`, `agent-playbooks:expo-rn-apps`, `agent-playbooks:ui-motion-quality`). Two independent passes: this
session's own sweep, then a blind read-only audit by Claude Fable 5.2 that was given the code and the rules but not
these findings. The table merges both; "Found by" says who.

Base commit `f6ed09a`, with WINTER-01's uncommitted work in the tree. Device: emulator-5556 (1440x3120, API image
with 3-button nav), the WINTER-01 test build. Evidence in `artifacts/MOTION-AUDIT/`.

## How the fixes ship

- **Bug fixes, unflagged:** M1 (Back in a level), M2 (Settings jump), M3 (Back stack in the picker), M4 (row
  remounts), the sheet's close backstop, `runOnJS` -> `scheduleOnRN`. None changes a look.
- **Feel changes, behind `META_MOTION_POLISH` (default OFF, `src/featureFlags.ts`).** OFF is byte-for-byte the old
  behaviour. Per UI-001 the flag stays OFF in store builds until the owner accepts a capture. Shared curves live in
  `src/ui/motionTokens.ts`.

## Findings

Severity: HIGH = flow bug or feel-breaking; MEDIUM = noticeably off; LOW = polish.

| # | Sev | Location | Before | After | Why | Found by | Status |
|---|---|---|---|---|---|---|---|
| M1 | HIGH | `GameScreen.tsx` (no BackHandler); `MainActivity.kt:52` | Android back inside a level ran `moveTaskToBack`: the whole app went to the launcher | Back = the ‹ button (`onHomePress`), via `useEffectUntilScreenLeaves` so a leaving screen stops listening | A game screen must step back to the menu, never drop the player out of the app. **VERIFIED pre-fix** on emulator-5556: `06-back-strip.png`, launcher resumed (`dumpsys` `mResumedActivity=NexusLauncherActivity`) | both | Fixed, unflagged |
| M2 | HIGH | `SettingsSheet.tsx` Modal (`statusBarTranslucent`, `navigationBarTranslucent`) | The panel appeared in one frame, then re-centred ~100 px lower 4 frames (~67 ms) later | Sheet stays invisible until its root spans the screen height (backstop 150 ms), then shows | The Modal window is first laid out above the nav bar and grows under it. **VERIFIED pre-fix**: `02-settings-close-open.mp4` (358 frames / 6.01 s = 59.6 fps, 99 % density), `03-settings-strip.png` | session | Fixed, unflagged |
| M3 | HIGH | `SettingsSheet.tsx` `dismiss`; `CollectionBook.tsx` `screen`; `ArrowStyleOptions.tsx` `tab` | Back from a Book confirm or the Book tab jumped straight to Settings (tab state lost). **VERIFIED pre-fix** for the Book tab: `01-after-back-from-book.png` | One Back stack (`sheetBack.ts`): confirm/bought -> grid -> Your styles -> Settings -> close | Back walks out one level at a time | both | Fixed, unflagged |
| M4 | MEDIUM | `ArrowStyleOptions.tsx` `StyleRow` | Declared inside the picker's render: a new component type every render, so every row and SVG preview remounted on each selection, tab or hint tap | Module-scope component with `selectedId` / `isNew` props | Remount cost and lost press state on the most-used picker control. Flicker visibility: UNVERIFIED (needs device) | both | Fixed, unflagged |
| M5 | HIGH | `SettingsSheet.tsx:220` | `animationType="none"`: open and close are hard cuts (**VERIFIED**: frame 0.943 s panel, 0.960 s gone) while the win panel already has presence motion | Scrim + panel fade, panel 0.96 -> 1, enter 220 ms / exit 160 ms on `EASE_OUT`; system reduce motion makes both legs instant (the app's policy, as for the win panel); exit has a timer backstop | Occasional surface: standard motion; consistent with the win/lose panel | session | `META_MOTION_POLISH` |
| M6 | MEDIUM | `PressScale.tsx:22-27` | Press 0.94 over 90 ms ease-out-quad; release spring damping 15 / stiffness 400 / mass 1 (ratio 0.375, ~1.7 % overshoot) | 0.97 over 120 ms `EASE_OUT`; release `{ duration: 260, dampingRatio: 1 }` | A tap carries no momentum, so no bounce; 0.94 takes 6 % off every wide pill | both | `META_MOTION_POLISH` |
| M7 | MEDIUM | Settings rows (`SettingsSheet.tsx`, PressScale on full-width rows) | A 300-plus dp row shrank to 0.94 (~19 dp at each edge) | Background tint (`rowPressedStyle`, `p.bg`), no scale | Lists highlight, buttons scale | session | `META_MOTION_POLISH` |
| M8 | MEDIUM | Picker / Book / reveal: Arrow style row, switch row, style rows, locked rows, tabs, next-free line, Back, Book tiles, Not now, Back to the book, Keep my current style | No pressed state at all | Rows: tint; tabs: tint on the unselected segment; tiles: scale 0.97 (no wrapper, so `31%` widths survive); text links: opacity 0.6 | Feedback on press-in is the latency the player feels | both | `META_MOTION_POLISH` |
| M9 | MEDIUM | `GameScreen.tsx` heart + stars, `CollectionBook.tsx` + `RewardRevealCard.tsx` preview, `SplashScreen.tsx` mark + head | `withSpring` with no `mass`: Reanimated 4.5.1 defaults to **mass 4** (`springConfigs.ts:28-31`, verified in node_modules) | `mass: 1` | Damping ratios were ~half what the constants imply (heart 0.15, stars 0.17, preview 0.24): a long wobble. Visible amount: UNVERIFIED | Fable | `META_MOTION_POLISH` |
| M10 | MEDIUM | `PanelPresence.tsx:21-22`; `overlayPresence.ts` `PANEL_EXIT_MS` | Enter ease-out cubic; exit `Easing.in(quad)` 180 ms (= win entrance) | Both legs `EASE_OUT`; exit 140 ms | Ease-in starts slow under the finger; exit faster than enter | both | `META_MOTION_POLISH` |
| M11 | MEDIUM | `ArrowStyleOptions.tsx` ScrollView | `maxHeight: height * .58` in a centred panel: Styles <-> Book and grid -> confirm change the panel height, so title and tabs move under the finger | Fixed `height: height * .58` | Spatial stability | Fable | `META_MOTION_POLISH` |
| M12 | LOW | `GameScreen.tsx` `Star` | `scale: k` from 0 | from 0.5 (opacity and the -24° turn kept) | Nothing appears from nothing; a celebration may keep a big range | both | `META_MOTION_POLISH` |
| M13 | LOW | `SplashScreen.tsx` fade-out | 380 ms `Easing.in(quad)`; `runOnJS` (deprecated in Reanimated 4) | 240 ms `EASE_OUT` (flag); `scheduleOnRN` (unflagged) | Ease-in exit; deprecated API | both | flag + fixed |
| M14 | LOW | `StaticBoardSurface.native.tsx` blocker flash, bump, hint pulse | `withTiming` without `reduceMotion` (= System) | `reduceMotion: ReduceMotion.Never` (the `if (reducedMotion) return` guard already picks the static branch) | Turning reduce motion on mid-session snapped these to their end value (invisible feedback, the old W0-04 class) | Fable | **Rejected**: W0-04 deliberately exempts these six drivers (`reduceMotionPolicy.test.ts`, `ReduceMotion.Never` confined to ExitTrail). Tried, the policy test failed, reverted |
| M15 | LOW | `ScreenScrim.tsx:23` | Level/theme cover `Easing.inOut(quad)` | `EASE_OUT` | The cover answers Next/Retry from its first frame | Fable | `META_MOTION_POLISH` |
| M16 | MEDIUM | `scripts/art/skin-build-flags.json`, `App.tsx` `<NavigationBar>` | `META_NAV_BAR_THEME` absent from the build flag set, so the 3-button nav bar keeps the phone's look under Ink Night | Add the flag (needs a clean prebuild) | Edge-to-edge only feels native when the bars follow the theme | Fable | **Deferred**: owner call (flag exists, acceptance pending) |
| M17 | LOW | `themeTransition.ts:135`, `HomeScreen.tsx:136` | A second theme tap or a Settings tap during the ~360-445 ms theme dip shows a press and does nothing | Queue one pending action | Dead taps | Fable | **Deferred** (HomeScreen is WINTER-01's file) |
| M18 | LOW | `GameScreen.tsx` `Star` | Star chirp fired by a JS `setTimeout(delay)` while the star's spring starts on the UI thread | Fire from `useAnimatedReaction` when `k` leaves 0 (keep the timer under reduced motion) | Sound/haptic drifts under JS load. Size of drift: UNVERIFIED | both | **Deferred** |

## Already right (keep)

- Tabs (Your styles / Book) switch with no motion: correct for a peer control used often.
- Reduced motion is handled carefully: every decorative timing declares `ReduceMotion.System`, and information-carrying
  board feedback has static stand-ins (`feedbackCurves.ts`).
- `OverlayPresence` / `PanelOverlayFrame`: one presence value, interruptible exit turn-around, backstop timer +
  AppState settle, no touches while exiting.
- Screen hand-off: entering-only 180 ms fade, leaving screen's animations stopped on the UI thread.
- Haptics: one native `performHapticFeedback` per beat, same call as the sound, always with a visual; it follows the
  phone's touch-feedback setting.
- Banner glide by transform, not layout; pan momentum by `withDecay`.
- Documented, not re-litigated: the arrow-exit ease-in launch (alternative behind `META_EXIT_TO_SCREEN_EDGE`), the
  Play-pill breathing, the splash's choreography.

## Missed opportunities (not built)

1. A selection haptic when a style is chosen (Android `expo-haptics` uses the vibrator, not the view's touch feedback,
   so it needs a native `performHapticFeedback` path first).
2. A 150 ms fade of the ✓ and the selected-tab fill instead of a cut (now possible, since rows no longer remount).
3. Cross-fade Book confirm -> bought content at the new fixed height.
4. Predictive back (`predictiveBackGestureEnabled: false`) once the single back stack has soaked.

## Top 10

1. M1 Android back inside a level exits the app. Fixed.
2. M2 Settings opens, then jumps ~100 px. Fixed.
3. M3 Back skips levels in the picker / Book. Fixed.
4. M5 Settings cuts in and out. Flagged fix.
5. M6 Press 0.94 + release bounce. Flagged fix.
6. M8 Picker and Book controls with no press feedback. Flagged fix.
7. M9 Springs at hidden mass 4. Flagged fix.
8. M4 Style rows remount on every tap. Fixed.
9. M10 Panel exit ease-in. Flagged fix.
10. M11 Picker height jumps between tabs. Flagged fix.

## Verification log (2026-11-18, emulator-5556)

Build: WINTER-01's combined test APK (`artifacts/WINTER-01/build/apk3/test-ads.apk`, sha256 `7d2c566b…`), built with
`META_MOTION_POLISH=1` and `CAPTURE_DIAG=1`, so both the unflagged fixes and the flagged feel ran. Evidence:
`artifacts/MOTION-AUDIT/after/`.

| Check | Result | Evidence |
|---|---|---|
| M2 Settings jump | **VERIFIED fixed.** Probe: root laid out at h=819.4, then h=891.4 (screen 891.4); reveal fired after the second. The panel sits at the same pixels in the first visible frame and 1 s later | logcat `[motion] settings-layout`, `v1-strip.png` |
| M5 Settings fade in | **VERIFIED present** (frame 1.33 s caught scrim and panel mid-fade). Duration and curve: **UNVERIFIED**, because the open fell into a 183 ms recorder gap | `v1-settings-open-close.mp4`, `v1-strip.png` |
| M5 Settings close on Back | **VERIFIED animated**: centre luminance falls over ~135 ms (2.604 -> 2.739 s) instead of the old one-frame cut. Matches the 160 ms target within frame spacing; not a timing proof | `y.txt` (per-frame YAVG) |
| M3 Back stack | **VERIFIED**: Book confirm -> grid -> Your styles -> Settings -> closed, one level per Back, app still resumed | `v2-strip.png` |
| M11 Picker height | **VERIFIED**: panel box identical on Book grid, confirm and Your styles | `v2-strip.png` |
| M1 Back in a level | **VERIFIED fixed**: menu -> Level 1 -> Back -> menu; `mResumedActivity` = `com.danteb.arrows/.MainActivity` (pre-fix: the launcher) | `v3c-strip.png` |
| M4, M6-M10, M12, M13, M15 | **UNVERIFIED on device**: code and unit tests only. Press feel, spring settle and panel/scrim curves need a capture at >=90 % frame density | — |

Recording density: 166 frames in 4.59 s (~36 fps, 60 % of 60 fps), below the 90 % gate, so every timing number
above is qualitative.

**Anomaly: closed, explained.** During the run the selected arrow style changed (Classic -> Sherbet -> Candy Gloss),
and one Play tap landed while the picker was open. The owner, relayed verbatim by WINTER-01: "i did those". These were
the owner's own taps, not a tap-through bug.

Hardening found while checking the tap-through theory (code reading, not reproduced): during the 160-240 ms exit fade
(flag), the sheet's rows stayed live, and in the picker a scrim tap starts that fade with the style rows still
tappable. The sheet root now takes `pointerEvents="none"` once closing starts (`SettingsSheet.closing.test.tsx`). The
<=150 ms invisible pre-reveal window is not gated (see the `ponytail:` note in `SettingsSheet.tsx`).

Device check (WINTER-01 apk10, sha256 `584af671…`, `META_MOTION_POLISH=1`, dark theme, emulator-5556), evidence in
`artifacts/MOTION-AUDIT/gate/`:
- **Control:** a Support tap alone opens the mail app (`WelcomeTourActivity` resumed).
- **Test:** 6 of 6 runs with a scrim tap, then a Support tap 5-29 ms later, left the app resumed and opened no mail
  app (`6-runs.txt`; the gaps are the injected events' `eventTime` in `dumpsys input`, scrim first every time).
  **VERIFIED:** the sheet ignores a row tap during its exit fade.
- **Not proven:** that the gate is the cause. There was no no-gate build to compare against, and a 5 ms gap may beat
  the JS re-render that sets `pointerEvents`, so React Native's own responder may also be dropping the second touch.
  An earlier run at a 191 ms gap is excluded, because the sheet may already have closed by then.

Tests: `sheetBack.test.ts`, `PanelPresence.settle.test.tsx`, `reduceMotionPolicy.test.ts` pass (node 20). Full suite as
reported by WINTER-01: 168 suites green after the `Easing.bezier` mock fix (inferred from their run plus my rerun).

**Owner gate (UI-001):** `META_MOTION_POLISH` stays OFF in build flags until the owner accepts a capture of the
Settings open/close, press states and the picker. Deferred: M16 (nav bar flag, owner call), M17 (HomeScreen,
WINTER-01's file), M18.

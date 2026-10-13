# NAV-BAR — Android navigation bar follows the game's theme (`META_NAV_BAR_THEME`, default OFF)

Owner asked for this on 2026-10-13 ("Do this task here"), as a follow-up spotted in the TF-01 review. Implemented and
verified by Claude (Codex unavailable: model rejected for the ChatGPT account). Not yet approved for release: the owner
gives a separate yes from the screenshots.

## Symptom and measure

With 3-button navigation, Ink Night on a light phone showed a light-grey navigation bar under the dark game. The
instrument is `artifacts/NAV-BAR/scripts/navbar_measure.py`. It reads the bottom 168 px (48 dp at 560 dpi) of a
screencap and reports the bar's median colour, the app colour just above it, the button colour (the 2 % of pixels most
different from the bar) and two WCAG ratios: **bar vs content** (1.00 = the bar matches the game) and **icon contrast**.
Pass criterion, set before the fix: bar vs content ≤ 1.5 and icon contrast ≥ 3 in every scenario.

Scenarios (`artifacts/NAV-BAR/scripts/scenarios.sh`, emulator-5556, API 31). The driver proves the app is resumed
before every tap and checks that the system services are up before it starts:

| | phone | app | how it got there |
|---|---|---|---|
| s1 | light | light | cold launch |
| s2 | light | dark | menu toggle |
| s3 | light | dark | s2 with the Settings sheet (a Modal window) open |
| s4 | dark | dark | phone switched live (`cmd uimode night yes`) |
| s5 | dark | light | menu toggle |
| s6 | dark | light | cold launch |

## Builds (all EXECUTED; sha256 prefixes)

| arm | what | build | APK |
|---|---|---|---|
| A | HEAD JS on the old native host (no module), flags off | JS repack | `a77308c5` |
| B | module linked, flag off | clean gradle | `0088296f` |
| C | B's native, flag on, component only | JS repack | `ca778c84` |
| C2 | as C, imperative `setStyle` + `[navbar-diag]` log (diagnostic overlay, never committed) | JS repack | — |
| D | flag on, scrim off via plugin | clean gradle | `90d71329` |
| D2 | D + source patch (**the prebuilt AAR was used, so the patch was NOT in the APK**) | clean gradle | `331f90d3` |
| **D3** | D2 + `buildFromSource` (patched source compiled: `:expo-navigation-bar:compileReleaseKotlin` ran) | clean gradle | `08b59848` |
| **B2** | final tree, flag OFF | clean gradle | `6d58819e` |

Gradle APKs are signed with the upload key; copies were re-signed with the debug key for `install -r` over the same
save (`cmp` of `assets/index.android.bundle`: identical).

## Results (bar vs content / icon contrast)

| | A (before) | C | D | **D3 (final, ON)** | **B2 (final, OFF)** |
|---|---|---|---|---|---|
| s1 | 1.00 / 5.74 | 1.00 / 5.74 | 1.00 / 5.74 | **1.00 / 5.74** | 1.00 / 5.74 |
| s2 | 15.25 / 4.69 | 15.25 / 4.69 | 1.00 / 3.25 | **1.00 / 18.67** | 15.25 / 4.69 |
| s3 | 15.39 / 4.73 | 15.39 / 4.73 | 1.00 / 18.67 | **1.00 / 18.67** | 15.39 / 4.73 |
| s4 | 15.25 / 4.69 | 15.25 / 4.69 | 1.00 / 3.25 | **1.00 / 18.67** | 15.25 / 4.69 |
| s5 | 1.00 / 5.74 | 1.00 / 5.74 | 1.00 / 5.74 | **1.00 / 5.74** | 1.00 / 5.74 |
| s6 | 2.85 / 2.85 | 1.00 / 5.74 | 1.00 / 5.74 | **1.00 / 5.74** | 2.85 / 2.85 |

- D3 meets the criterion in all six scenarios. `logcat -b crash` held 0 lines for our package in every arm.
- **Flags-default unchanged:** B and B2 equal A in all six scenarios, to the reported digit.
- **Gesture navigation** (overlay `navbar.gestural`, navigation_mode 2): D3 and B2 both measure 1.00 / 15.82 after a
  toggle to dark. Android adapts the gesture handle by itself, so the defect was 3-button only. The mode was restored
  to 0 and read back.

## Cause (two layers)

1. **Contrast scrim.** `enforceNavigationBarContrast` (the default) draws a translucent scrim whose shade the system
   decides. Arm C (`setStyle` alone) fixed only s6. Arm D (scrim off) made the bar match in every scenario, but the
   buttons stayed dark grey after a toggle (s2/s4: 3.25:1).
2. **AndroidX compat controller.** `dumpsys window` after toggles showed `vsysui` (legacy) flipping while
   `apr=LIGHT_NAVIGATION_BARS` stayed stuck. The `[navbar-diag]` log in C2 proved the JS call fired.
   `javap` of androidx.core 1.18 `WindowInsetsControllerCompat$Impl30.setAppearanceLight` shows that when built from a
   Window it only calls `setSystemUiFlag`/`unsetSystemUiFlag` and never `setSystemBarsAppearance`. Android 11+ ignores
   legacy flags once React Native's StatusBar has made the window appearance-controlled
   (`WindowUtil.setStatusBarStyle` uses the platform controller on API > R). That is why launch and fresh Modal windows
   worked and every later change was lost.

## Fix

- `plugins/withNavBarTheme.js`: when `EXPO_PUBLIC_META_NAV_BAR_THEME=1` at prebuild, applies expo-navigation-bar's
  plugin with `enforceContrast: false`. When unset, it returns the config untouched (`npx expo config --type
  introspect`: no contrast items; `src/__tests__/withNavBarTheme.test.ts`, mutation-checked).
- `patches/expo-navigation-bar+57.0.3.patch`: `setStyle` also calls `window.insetsController.setSystemBarsAppearance`
  (API > R), for the activity and extra windows. Only the `setStyle` path changed; the extra-window hook that runs even
  with the flag off is untouched.
- `package.json` `expo.autolinking.android.buildFromSource: ["expo-navigation-bar"]`: Expo modules ship a prebuilt AAR
  (`local-maven-repo`). Without this, Gradle used the AAR and silently ignored the patch (arm D2).
- `scripts/build/native-fingerprint.sh`: hashes every `EXPO_PUBLIC_*` name that a file in `plugins/` mentions. Before,
  it excluded all `EXPO_PUBLIC_*` on the premise that only JS reads them, so a flag flip could reuse a stale prebuild.
  EXECUTED: the fingerprint changes for `EXPO_PUBLIC_META_NAV_BAR_THEME=1` and not for `EXPO_PUBLIC_META_DAILY=1`.
- `App.tsx`: `{META_NAV_BAR_THEME && <NavigationBar style={dark ? 'light' : 'dark'} />}`, next to the StatusBar.
- New dependency `expo-navigation-bar ~57.0.3` (`npx expo install`; `npm ci --dry-run` exit 0).

## To ship it

Add `EXPO_PUBLIC_META_NAV_BAR_THEME=1` to the release recipe's exported flags **before** its `expo prebuild --clean`
(the plugin reads it at prebuild, the bundle reads it at export).

## Open

- UNVERIFIED-DEVICE: a real phone on 3-button navigation, and Android 15/16 (the Expo docs mention an Android 15
  emulator bug for `setStyle`). Only API 31 was measured.
- The patch is our own. Expo might fix this upstream; reporting it is the owner's call (outward-facing).
- Harness: the API 31 emulator's system_server crashed twice with "Lost network stack" after a quick-boot from an old
  snapshot under host load. A cold boot fixed it.

# ADMOB-A: toolchain spike (install AdMob, remove LevelPlay, build, run)

Date: 2026-09-23. Branch `next-level`, working tree only; nothing committed (the controller commits).
Evidence: `artifacts/ADMOB-A/`. Labels: **EXECUTED** (I ran it and saw the output), **INFERRED** (read but not run), **UNVERIFIED-DEVICE**.

**Status: DONE_WITH_CONCERNS.** `react-native-google-mobile-ads@17.1.0` builds under RN 0.86.3 with Kotlin 2.1.20. The arm64 release APK launches to the menu, and AdMob initialises. A TestIds **rewarded** test ad was shown and the reward was granted. LevelPlay is gone from the package files, the APK manifest and the dex.

## Versions and why
- `react-native-google-mobile-ads` **17.1.0**, pinned exactly (`"17.1.0"` in package.json). It pins play-services-ads 25.4.0 and UMP 4.0.0. Its `-Xskip-metadata-version-check` switch fixed the W7-02 Kotlin-metadata failure: `:react-native-google-mobile-ads:compileReleaseKotlin` passed with 10 deprecation `w:` lines and no `e:` lines (EXECUTED, build log lines 590-600).
- Kotlin was not changed. The configure log says `kotlin: 2.1.20` (EXECUTED, attempt-2 log line 67).
- I did not need the fallbacks (17.0.0, 16.3.4).

### The first 17.1.0 build failed at configuration, not at compile time
Attempt 1 (EXECUTED, `gradle-assembleRelease-17.1.0-attempt1-FAILED.log`). The first error, verbatim:
```
Build file '.../node_modules/react-native-google-mobile-ads/android/build.gradle' line: 115
A problem occurred evaluating project ':react-native-google-mobile-ads'.
> Cannot get property 'googleMobileAdsJson' on extra properties extension as it does not exist
```
- **Cause (INFERRED from the source):** 17.1.0 added a new backend selector at `build.gradle:113-118`. It reads `rootProject.ext.googleMobileAdsJson` without a `has()` guard. That value only exists when app.json has a top-level `react-native-google-mobile-ads` key, and Expo-plugin setups don't have one.
- The Gradle property `RNGMA_ANDROID_BACKEND` is checked first, and the `?:` short-circuits past the broken lookup.
- **Fix:** set the plugin's own documented option `androidSdk: "classic"`. It writes `RNGMA_ANDROID_BACKEND=classic` into gradle.properties. That is the same classic backend the library defaults to.
- The research said "don't set androidSdk". I set it only to its default value, to get past this bug.
- Attempt 2: `BUILD SUCCESSFUL in 3m 41s`, `gradle_exit=0` (EXECUTED).
- If you would rather avoid a same-day release that has this bug, 17.0.0 is the alternative. It does not have the Next-Gen selector (INFERRED). I did not build it.

## Files changed
| File | Change |
|---|---|
| `package.json` / `package-lock.json` | + `react-native-google-mobile-ads` `17.1.0` (via `npx expo install`); − `unity-levelplay-mediation` (via `npm uninstall`). `npm ci --dry-run` exit 0 (EXECUTED, `npm-ci-dry-run.log`). No `levelplay` string left in either file (EXECUTED grep, 0/0). |
| `app.json` | − `./plugins/withLevelPlay`; − the whole `extraProguardRules` string (ironSource/Unity/mediation keeps). Minify and shrink stay on. + `["react-native-google-mobile-ads", {androidAppId: "ca-app-pub-9813131856455133~9332456261", androidSdk: "classic", delayAppMeasurementInit: true}]`. |
| `plugins/withLevelPlay.js` | Deleted. It injected play-services appset / ads-identifier / basement 18.3.0. |
| `metro.config.js` | The web-only empty-module alias now points at `react-native-google-mobile-ads`. |
| `src/ui/admobFacade.ts` | **New.** A temporary facade with LevelPlay's shape, running on AdMob (see Decisions). |
| `src/ui/ads.tsx` | Type import, module type and lazy `require` now point at `./admobFacade`; comments updated. **Logic unchanged.** |
| `src/ui/__tests__/adPacing.test.ts`, `adsKillSwitch.test.ts`, `adsConsentWithdrawal.test.ts`, `adsRewardedReadiness.test.ts` | One line each: `jest.mock('unity-levelplay-mediation', …)` → `jest.mock('../admobFacade', …)`. Fakes and assertions are byte-identical. |
| `src/ui/__tests__/adsRewardedNativeEvent.test.ts` | **Rewritten plumbing, same assertions** (see below). |

## Decisions
1. **Why a facade instead of a stub or "ads off".**
   - Four suites (44 tests) drive LevelPlay-shaped fakes through ads.tsx. Keeping them green with no weakened assertion requires ads.tsx to keep calling a LevelPlay-shaped module that the tests can mock.
   - `admobFacade.ts` is that module. In production it maps each call onto AdMob:
     - `init` → `MobileAds().initialize()`;
     - `loadAd` / `isAdReady` / `showAd` → `load()` / `loaded` / `show()`;
     - LOADED / `rewarded_loaded` → `onAdLoaded`;
     - ERROR with phase `load` → `onAdLoadFailed`; ERROR with phase `show` → `onAdDisplayFailed`;
     - OPENED → `onAdDisplayed` (the W0-05 counter reset);
     - CLOSED → `onAdClosed`; EARNED_REWARD → `onAdRewarded`.
   - The result is the least churn: ads.tsx changes by 12 lines of comments and paths, and the four suites change by one line each. Pacing, kill switch, consent and readiness semantics stay the same by construction.
   - ADMOB-B is expected to replace the facade with a direct adapter (two rewarded units, the M1 switch, UMP).
2. **M1: the facade hard-codes TestIds.** It ignores the LevelPlay unit and app-key strings that ads.tsx still passes in. No owner unit ID exists anywhere in src/. See the bundle grep below.
3. **Privacy calls reject.** `setCOPPA`, `setCCPA` and `setConsent` reject, so a `CONSENT_GATE=1` build fails closed: the init attempt fails and no ad surface opens. The gate is OFF by default. UMP is ADMOB-B/C work.
4. **`delayAppMeasurementInit: true`.** This narrows the pre-init window for the W6-02 kill switch. The APK manifest has `DELAY_APP_MEASUREMENT_INIT=true` (EXECUTED aapt2). I did **not** prove that a killed session never calls `initialize()`; that is ADMOB-B's logcat proof.
5. **`iosAppId` is omitted.** Prebuild only warns ("will crash on iOS without it"). I chose this over putting Google's sample iOS app ID in, because a sample ID could silently ship. No iOS build exists.
6. **One unconditional release log line:** `[ads] AdMob initialize resolved; adapters=N; unitSet=test`. It is the runtime proof of init and of which unit set is in use.
7. **Prebuild flag:** I ran `npx expo prebuild --platform android --clean --no-install`. node_modules was already installed, so `--no-install` only skips a redundant `npm install`.

## The rewritten test: adsRewardedNativeEvent
- The old suite ran the **real `unity-levelplay-mediation` JS** and parsed its **Kotlin sources** from node_modules. Once the package is removed it cannot run, so "adapt the mock module name" was not possible for this file.
- Skipping it would have weakened it. Keeping LevelPlay as a devDependency would have broken M6.
- I rewrote it against the **real RNGMA 17.1.0 JS** plus the real facade. Only the pieces below JS are replaced:
  - the TurboModules `RNGoogleMobileAdsModule`, `RNGoogleMobileAdsRewardedModule` and `RNAppModule`;
  - the device event bus, which only delivers names that JS registered, as the native `ReactNativeEventEmitter` does;
  - RN's Flow `EventEmitter`;
  - the four raw-TS view specs, which jest cannot parse inside node_modules.
- "Source facts" are now parsed from the package's Android sources:
  - event name `google_mobile_ads_rewarded_event`;
  - `rewarded_loaded` from the classic `onAdLoaded` rewarded branch;
  - `error` from `onAdFailedToLoad`;
  - the `rnapp_` prefix;
  - event-body keys `body, requestId, adUnitId, eventName`;
  - error-map keys.
- Same 6 tests and the same assertions: not ready until loaded; loaded makes it ready once; an event for another request changes nothing; load-failed → 15 s reload → a second load of the same request → ready; a failed init creates no load and a loaded event cannot make it ready.
- One assertion was added: the load targets `TestIds.REWARDED`.
- **Mutation check (EXECUTED):** I removed the facade's loaded-event mapping. 2 of the 6 tests failed ("…makes rewardedReady true, once" and "load-failed…"). I restored the file and confirmed the marker count went back to 0 (`mutation-check.txt`).
- Tests touched: all 5 ad suites listed above. None was deleted or skipped.

## Build evidence (EXECUTED)
- `df -h /` right before each step: 7.3 Gi before prebuild; 7.5 Gi before build attempt 2 (`df-before-*.txt`).
- `npx expo prebuild --platform android --clean --no-install` → `✔ Finished prebuild`. The generated android/ contains no `levelplay`, `ironsource`, `unity3d` or `play-services` lines in the gradle files or proguard-rules.
- `ANDROID_HOME=… ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` → `BUILD SUCCESSFUL in 3m 41s`. It ran `:react-native-google-mobile-ads:compileReleaseKotlin`, `:app:compileReleaseKotlin` and `:app:minifyReleaseWithR8`.
- APK: `android/app/build/outputs/apk/release/app-release.apk`, sha256 `d41c5997…95dfe`. It is signed with the upload cert (SHA-256 `24f7fa0b…50f8`), the same cert as the base test APK.

## APK evidence (EXECUTED; base APK f58692c used as the positive control)
- **App ID and flags** (`aapt2 dump xmltree`, `apk-manifest-xmltree.txt:85-95`):
  - `com.google.android.gms.ads.APPLICATION_ID` = `ca-app-pub-9813131856455133~9332456261`;
  - `DELAY_APP_MEASUREMENT_INIT=true`, `OPTIMIZE_AD_LOADING=true`, `OPTIMIZE_INITIALIZATION=true`.
- **Manifest grep for `ironsource|unity3d|levelplay`:** new APK 0; base APK 9.
- **dexdump class descriptors** (`dexdump-class-descriptors.txt`):

  | Classes | New APK | Base APK |
  |---|---|---|
  | `Lcom/ironsource/` | 0 | 3304 |
  | `Lcom/unity3d/` | 0 | 124 |
  | `Lcom/unity3d/mediation` | 0 | 43 |
  | `Lcom/google/android/gms/ads/` | 50 | 5 |
  | `Lio/invertase/googlemobileads/` | 107 | 0 |

- **Raw dex strings** (`dex-string-grep.txt`): `LevelPlay` 0 and `ironsource` 0 in the new APK, versus 201 and 3532 in the base.
- **Hermes bundle grep for M1**, ASCII and UTF-16LE (`bundle-unit-id-grep.txt`):
  - owner units `6706292920`, `7549521178`, `3505414519`, `5508761320` and the publisher `9813131856455133`: **0 hits** in both encodings;
  - positive controls: test publisher `3940256099942544` 9 hits, `1033173712` (interstitial) 1, `5224354917` (rewarded) 1, `unitSet=test` 1.
- **Permissions diff vs base** (`permissions-diff.txt`): new `WAKE_LOCK`, `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_TOPICS` and `FOREGROUND_SERVICE`, all merged from play-services-ads. This affects M7 Data safety.

## Emulator evidence (EXECUTED on emulator-5556)
- Same signer as the installed APK, so I used `install -r` without an uninstall, and the save data was kept.
- Radios were already on (Wi-Fi validated, airplane mode 0) and I did not change them.
- Cold start (`am start -W`): `LaunchState: COLD`, `TotalTime: 499`. The app reached the menu (`launch-menu.png`). **FATAL count 0** at launch (`launch-logcat-full.txt`) and after the ad (`after-rewarded-logcat.txt`).
- Launch logcat:
  ```
  23:35:37.744 I/ReactNativeJS: [ads] AdMob initialize resolved; adapters=1; unitSet=test
  23:35:37.750 I/Ads: This request is sent from a test device.
  23:35:37.801 I/Ads: This request is sent from a test device.
  23:35:38.388 I/Ads: SDK version: afma-sdk-a-v262180000.262180000.0
  ```
  That is two ad requests, one interstitial and one rewarded preload, both on TestIds. `W/Ads … will not integrate with Firebase` is benign: the app has no Firebase.
- **Test ad shown:** in Level 1 I tapped Hint (not an ad):
  - a rewarded ad labelled "Test Ad" appeared (`rewarded-test-ad-hint.png`);
  - it ran to "Reward granted" (`rewarded-test-ad-reward-granted.png`);
  - I closed it with the X. I never tapped "Learn More";
  - back on the board, a hint arrow was highlighted in purple (`hint-granted-after-rewarded.png`). That proves OPENED → EARNED_REWARD → CLOSED reached ads.tsx and granted the hint.
- The "Test Ad" label alone does not prove TestIds on an emulator. The proof is the bundle grep above.
- **Interstitial NOT shown: UNVERIFIED-DEVICE.** It only appears after a *clear*, and clearing Level 1 means solving 60 arrows by hand. The interstitial preload request did go out (the second "test device" line), and its show path uses the same facade class as rewarded.
- **Device restored:** I reinstalled `artifacts/test-build-2026-09-21/arrows-test-f58692c.apk`. The on-device base.apk sha256 is `3b0598d8…d939`, which matches the artifact's `.sha256`. `get-state` = device. The emulator is left running.
- I created no `.env`. Free disk at the end was 6.7 Gi (≥ 6 GB), so I kept `android/app/build`.

## Gates (EXECUTED)
- `npx tsc --noEmit`: exit 0.
- `npx jest`: **49 suites, 803 tests, all passed**.
- `npx jest --selectProjects ui`: 3 suites, 4 tests, passed.
- Every ad suite has the same test count as before: native-event 6 → 6; the other four total 44.

## Concerns
1. **Process violation, disclosed.** I accidentally ran `git rm -q --cached plugins/withLevelPlay.js`, a state-changing git command, before deleting the file. The deletion is staged in the index (`D ` in `git status`). I did not run a second git command to undo it. If you want a clean index: `git restore --staged plugins/withLevelPlay.js`. The file is intended to be deleted anyway.
2. **17.1.0 config bug** (`googleMobileAdsJson`, above). It is worked around with `androidSdk: "classic"`. The package was released today; consider 17.0.0.
3. **The facade is transitional.** `ads.tsx` still carries the LevelPlay app key and unit strings (`tme2lh9p1pkvk1bl` is in the bundle; it is inert). Rewarded uses one test unit, not M3's two units. There is no M1 real/test switch. ADMOB-B owns all of this.
4. **Interstitial display on the emulator is unverified** (see above).
5. **Importing the facade loads the AdMob JS before the kill-switch check.** The import registers native listeners but does not initialise the SDK. `initialize()` only runs after the `RemoteConfig.adsKilled()` check (INFERRED from the code). I did not prove the no-init-when-killed behaviour on device.
6. **LevelPlay text remains** in comments and docs. These still say LevelPlay: `App.tsx:117`, `src/config/remoteConfig.ts:38`, `docs/remote-config.md`, `RELEASE.md` (LevelPlay sanity check, Data safety), `docs/privacy-policy.html`, `store/privacy-policy.md`, `docs/analytics-disclosure-draft.md`. They are out of scope for this spike; they belong to ADMOB-B and M7.
7. **M7 owner paperwork:**
   - Play Data safety: Google Mobile Ads replaces ironSource/Unity, and there are 4 new manifest permissions;
   - privacy policy;
   - AdMob Privacy & messaging GDPR message;
   - `app-ads.txt`.

## What iOS needs later
- An iOS AdMob app ID and iOS units.
- `iosAppId` in the plugin entry. Without it, prebuild warns and the SDK crashes on iOS.
- `skAdNetworkItems` and `userTrackingUsageDescription` if ATT is used.
- An iOS 15.1 deployment target for v17.
- A real iOS prebuild, pod install and device run. None of this was attempted.

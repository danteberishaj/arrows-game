# ADMOB-B: the real AdMob integration (M1 test/real IDs, M2 behaviour preserved, M3 two rewarded units)

Date: 2026-09-24. Branch `next-level`, working tree only. I ran no state-changing git command; the controller commits.
Evidence is in `artifacts/ADMOB-B/`. Labels: **EXECUTED** (I ran it and saw the output), **INFERRED** (read but not run), **UNVERIFIED-DEVICE**.

**Status: DONE_WITH_CONCERNS.** `src/ui/ads.tsx` now calls react-native-google-mobile-ads 17.1.0 directly. The ADMOB-A facade is deleted.
- **M1:** units come from a pure, unit-tested selector. A test-flag release bundle contains none of the owner units, and the positive-control bundle does contain them.
- **M3:** hint and continue each have their own rewarded unit and their own readiness.
- **M2:** every existing ad assertion is kept.
- **On the emulator:** the rewarded hint, the rewarded continue and a paced interstitial each showed a Google **Test Ad**. Offline, both rewarded buttons showed the honest unavailable states and granted nothing.
- Concerns (below): I accidentally clicked through a *test* ad, the pacing-reset proof on the device is behavioural, not a counter readout, and the save data on the emulator changed.

## Files changed
| File | Change |
|---|---|
| `src/ui/adUnits.ts` | **New.** `OWNER_AD_UNITS` (the 3 owner units, compiled out when `EXPO_PUBLIC_ADMOB_TEST_ADS === '1'`) and the pure `selectAdUnits({isDev, testAdsFlag, ownerUnits, testIds})`. |
| `src/ui/ads.tsx` | Rewritten adapter section (AdHost, pacing, telemetry and the public shape are kept). Changes: direct AdMob, an interstitial plus two `RewardedAd`s (continue and hint), per-placement readiness, and `Ads.isRewardedReady(p)` / `subscribeRewardedReady(cb, p = 'continue')`. The kill check comes before the AdMob JS is required. `requestLoad` makes no request for a killed format or while consent is refused. Consent signals map onto request options, and a consent change recreates the ads. `presentAd()` guards a sync `show()` throw and a concurrent show. `launchAdTestSuite` now calls `openAdInspector()`. The LevelPlay app key and unit strings are removed. |
| `src/ui/admobFacade.ts` | **Deleted** (plain `rm`; nothing imports it). |
| `src/ui/GameScreen.tsx` | The hint button reads `Ads.isRewardedReady('hint')` through `useSyncExternalStore`. The continue button and the lose panel still read `Ads.rewardedReady`. The `adShowFailed` clear subscribes to both placements. |
| `src/ui/contrastAudit.ts` | Mechanical: 39 `GameScreen.tsx:N` line references are remapped through the diff's hunks (the GameScreen edit shifted lines). No colour or role changed. `contrast.test.ts` is 142/142. |
| `src/ui/consent.ts`, `App.tsx`, `src/config/remoteConfig.ts` | Comment text only: "LevelPlay" / "mediation layer" became AdMob. |
| `src/ui/__tests__/helpers/fakeGoogleMobileAds.ts` | **New.** A hand-written fake of the RNGMA slice ads.tsx uses: `loaded`/`load`/`show` semantics mirror `MobileAd.ts`, plus a `legacyListener()` translation shim. |
| `src/ui/__tests__/adPacing.test.ts`, `adsKillSwitch.test.ts`, `adsConsentWithdrawal.test.ts`, `adsRewardedReadiness.test.ts` | Mock plumbing ported from `'../admobFacade'` to `'react-native-google-mobile-ads'`, plus new tests. All old test bodies are byte-identical. |
| `src/ui/__tests__/adsRewardedNativeEvent.test.ts` | Real package JS. The `initialised()` precondition and two test bodies changed because M3 forces it (see below); 2 tests added. |
| `src/ui/__tests__/adUnits.test.ts`, `adsTwoRewardedUnits.test.ts` | **New** (M1, M3). |
| `src/ui/__tests__/GameScreen.rewardedUnavailable.test.tsx`, `GameScreen.telemetry.test.tsx` | The `../ads` mock gained per-placement readiness; 3 M3 tests added. The old body is unchanged. |

No package file changed, so `npm ci --dry-run` was not needed.

## Event mapping, LevelPlay → AdMob (17.1.0 classic)
| LevelPlay (old) | AdMob event / call | What ads.tsx does |
|---|---|---|
| `LevelPlay.init` + `onInitSuccess` / `onInitFailed` | `await MobileAds().initialize()`; resolves or rejects | Rejection = a failed attempt; the adInit controller retries |
| `setMetaData('is_test_suite')` (dev) | none | dropped; `openAdInspector()` replaces the test suite |
| `loadAd()` | `ad.load()` (ignored while loaded or in flight) | only through `requestLoad` (kill/consent gate) |
| `isAdReady()` | `ad.loaded` (sync) | show gate |
| `onAdLoaded` | `AdEventType.LOADED` / `RewardedAdEventType.LOADED` | rewarded readiness true (per placement) |
| `onAdLoadFailed` | `AdEventType.ERROR`, `phase: 'load'` | readiness false; one 15 s reload |
| `onAdDisplayed` | **`AdEventType.OPENED`** | **the only W0-05 counter reset** (interstitial); rewarded consumed |
| `onAdDisplayFailed` / `showAd()` reject | `ERROR` with `phase: 'show'`, or `show()` rejects or throws synchronously | resolve not shown → `display_failed`; count kept; fetch a fresh ad |
| `onAdRewarded` | `RewardedAdEventType.EARNED_REWARD` | `earned = true` |
| `onAdClosed` | `AdEventType.CLOSED` | resolve the show; reload |
| — | `IMPRESSION`, `CLICKED`, `PAID` | ignored (a test pins that IMPRESSION and CLICKED do **not** reset pacing) |

**Why OPENED resets the counter:**
- In `AdEventType.ts` OPENED is "the ad opened and is currently visible". It comes from `onAdShowedFullScreenContent` (`ReactNativeGoogleMobileAdsFullScreenAdModule.kt:400`), which is exactly LevelPlay's `onAdDisplayed`.
- `IMPRESSION` fires later and only when an impression is recorded. `CLOSED` also fires after a display failure path, so neither is "displayed".

## Privacy mapping (W7-01, consent gate only)
- `PrivacyApi` and `privacyCallsFor` are unchanged. The mapping is:
  - `setCOPPA(v)` → `MobileAds().setRequestConfiguration({tagForChildDirectedTreatment: v})`, called before `initialize()` (test-pinned order);
  - `setConsent(v)` → `requestNonPersonalizedAdsOnly: !v` on every ad request;
  - `setCCPA(v)` → `networkExtras: {rdp: '1'}`.
- **What AdMob supports:**
  - COPPA through the request configuration. That call is deprecated upstream in favour of `ageRestrictedTreatment`; I kept the boolean that matches the existing call.
  - Non-personalised ads through the `npa` extra.
- **What it cannot do from JS:**
  - Google documents CCPA "restricted data processing" as the **int** `rdp = 1` extra, or the `gad_rdp` SharedPreference. RNGMA only sends **string** extras (`ReactNativeGoogleMobileAdsCommon.java:242-249`), so it is **UNVERIFIED** whether AdMob honours the string `'1'`.
  - With UMP (next task), GMA reads IAB GPP/TCF natively instead.
- Request options are fixed when an ad is created. A consent change that alters them destroys and recreates all three ads; the SDK is not re-initialised.
- With `CONSENT_GATE` OFF (the default), no privacy call is made and every request is a default request, exactly as before.

## TDD (EXECUTED)
- **adUnits:**
  - RED 1: `TS2307 Cannot find module '../adUnits'`.
  - RED 2, against a deliberately wrong stub: **4 failed / 8 passed** (`artifacts/ADMOB-B/tdd-red-adUnits.txt`).
  - GREEN: **12/12** (`tdd-green-adUnits.txt`).
- **Two units:**
  - RED against the facade-based ads.tsx (ts-jest diagnostics off to get past the missing-API type error): **5 failed / 5**, "Expected length: 1, Received length: 0". Only one rewarded ad existed, on the sample unit (`tdd-red-twoUnits.txt`).
  - GREEN: 5/5 (`tdd-green-twoUnits.txt`).
- **GameScreen hint readiness:**
  - RED: 2 failed ("Expected number of calls: 1, Received: 0" and "Expected 0, Received 1") (`tdd-red-gamescreen.txt`).
  - GREEN: 7/7 in the ui project (`tdd-green-gamescreen.txt`).
- **Test-body identity** (`test-body-identity.txt`, a script comparing every `test`/`it` block against HEAD):
  - adPacing 17/17 identical;
  - kill switch 11/11;
  - consent 2/2;
  - readiness 5/5;
  - GameScreen 1/1 + 1/1;
  - native event 4/6.
- **The 2 changed native-event bodies (M3-forced):**
  - The 15 s reload assertions now read `continueLoads()`: the same `[first]` / `[first, first]` values, filtered to the continue ad's requestId, because the list now also holds the hint ad's load.
  - The failed-init test *adds* loaded events for both owner units, plus a hint-readiness assertion.
- **The `initialised()` precondition:** it was "created once and loaded once on the sample unit". It is now "two loads, one per owner unit", and the events target the continue ad (`Ads.rewardedReady` = continue).
- **Mutation checks** (`mutation-checks.txt`; ads.tsx was restored and `cmp` confirmed it identical):

  | Mutation | Tests failed |
  |---|---|
  | Pacing reset on IMPRESSION | 4 |
  | Kill ignored in `requestLoad` | 2 |
  | Hint uses the continue unit | 5 + 5 |
  | One shared readiness | 4 |
  | AdMob required before the kill check | 1 |
  | Consent change never recreates | 1 |

- **A real flaw found and fixed:** the new "second show while one is on screen" test hung. A concurrent show overwrote the first show's close callback, a flaw inherited from the LevelPlay code. `presentAd()` plus an "already on screen" guard fixes it for both formats. In the app, GameScreen's `adBusy` already prevents this.

## Gates (EXECUTED)
- `npx jest`: **51 suites, 836 tests, all pass.** Before: 49 / 803. The +33 are all new tests; none was deleted or skipped.
- `npx tsc --noEmit`: exit 0.
- `npx jest --selectProjects ui`: 3 suites, 7 tests pass (before: 4).

## Build and bundle evidence (EXECUTED)
- **Build:**
  - `df -h /` immediately before: 9.3 Gi.
  - `./gradlew --stop` first, because the build depends on an EXPO_PUBLIC env value.
  - Metro's cache was reset first with a flag-on `export:embed --reset-cache`.
  - Command: `EXPO_PUBLIC_ADMOB_TEST_ADS=1 ANDROID_HOME=… ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` → `BUILD SUCCESSFUL in 47s` (`gradle-assembleRelease.log`).
  - APK sha256 `c92abc03…153b2e`; signer is the upload cert `24f7fa0b…50f8`, the same as the installed base.
- **Hermes bundle in the APK**, ASCII / UTF-16LE (`bundle-grep-test-build.txt`):
  - owner units `6706292920`, `7549521178`, `3505414519`, banner `5508761320`, publisher `9813131856455133`: **0 / 0 each**;
  - sample publisher `3940256099942544`: 9; `1033173712`: 1; `5224354917`: 1; `unitSet=`: 1.
  - The flag-on JS shows the call inlined: `selectAdUnits({isDev:!1,testAdsFlag:"1",…})`.
- **Positive control:** `npx expo export:embed --reset-cache` with no flag, not installed (`bundle-grep-positive-control.txt`).
  - The same grep finds `6706292920` 1, `7549521178` 1, `3505414519` 1 and `9813131856455133` 3, in the JS **and** in a `hermesc -O` compile of it (the same detector as the APK).
  - `5508761320` (banner) is 0: correct, since the banner belongs to the next task.

## Emulator evidence (EXECUTED on emulator-5556; every adb call used `-s emulator-5556`)
- **Found state:** base f58692c (sha `3b0598d8…d939`), same signer (so `install -r`, save kept), Wi-Fi on, `mobile_data=1`, airplane mode 0.
- **Cold start:** `LaunchState: COLD`, `TotalTime: 497`. `I ReactNativeJS: [ads] AdMob initialize resolved; adapters=1; unitSet=test`, followed by **3** "This request is sent from a test device" lines: the interstitial and the two rewarded units (`launch-logcat-full.txt`). FATAL 0.
- **Rewarded HINT:**
  - The hint button was enabled; tapping it showed a "Test Ad" rewarded (`03-hint-test-ad.png`) that ran to "Reward granted" (`04-…`).
  - I closed it with the X. Back on the board, the hint arrow was purple (`05-hint-granted-on-board.png`).
  - After close, exactly 1 new request went out: the hint unit's reload (`hint-logcat.txt`).
- **Rewarded CONTINUE:**
  - Lost all hearts on Level 1 → "Out of hearts" with Continue enabled (`06-…`) → Test Ad → "Reward granted" (`07/08-…`).
  - Closed → back on the board with **1 heart** (`09-continue-heart-granted.png`); 1 reload request.
- **INTERSTITIAL and pacing:**
  - The counter reached "due" through gameplay: the Level 1 loss above, then a clear. I cleared the level by tapping the solver order `Board.findHint()` from `LevelGenerator.generate(0)`; the tap geometry was calibrated on the app's own hint arrow. Result: "Cleared!" (`10-…`).
  - "Next level" → **"This is an interstitial test ad"** with the Test Ad label (`11-interstitial-test-ad.png`). Closed with the X → Level 2, 1 preload request (`interstitial-logcat.txt`).
  - **Reset proof (behavioural):** I cleared Level 2 with no loss, so the counter should be 1 if the reset happened. "Next level" went straight to Level 3 with **no interstitial** and 0 `Ads` log lines (`14-level3-no-interstitial.png`, `next-level-not-due-logcat.txt`). Without the reset the counter would have been at least 3, so the interstitial would have been due.
  - Limit: the release build has no counter or telemetry log, and the app is not debuggable, so I could not read the stored counter. That the interstitial was *loaded* at that moment is INFERRED: its preload request went out about 1.5 min earlier and sample units fill reliably. My attempt to close this gap (clear Level 3 so the counter reaches exactly 2) failed; see concern 1.
- **Offline:**
  - `svc wifi disable` + `svc data disable`, read back as `Wi-Fi is disabled`, `mobile_data 0`, `Active default network: none` (`radios-off-readback.txt`). Then a cold start.
  - Init still resolved (`unitSet=test`). The 3 requests each ended in "Ad failed to load : 0". After that the cycle was request → about 10 s → fail → 15 s reload, with 3 requests per cycle and no storm (`offline-taps-logcat.txt`).
  - **The hint button was greyed.** Tapping it opened nothing: `MainActivity` stayed resumed and no AdActivity started (`16/17-…`).
  - Losing all hearts showed **"No ad available right now — Retry is free"** with Continue disabled (`18-offline-lose-panel.png`). Tapping Continue granted nothing, and the panel and 0 hearts stayed (`19-…`).
  - Radios were restored and read back (Wi-Fi enabled, `mobile_data 1`, airplane 0, WIFI + LTE connected; `radios-restored-readback.txt`). Continue then re-enabled by itself once the reload filled (`20-back-online-continue-recovers.png`).
- **Device left as found:** reinstalled `arrows-test-f58692c.apk`; on-device sha `3b0598d8…d939` matches the artifact `.sha256`. `get-state` = device, the emulator is still running, radios are as found (`device-restored.txt`).
- **Housekeeping:** no `.env` was created. `df` at the end was 7.6 Gi (≥ 6 GB), so I kept `android/app/build`. **Note:** it holds the test-flag APK.

## Decisions
1. **The owner table is guarded by the build-time flag itself** (`'1' === '1' ? null : {…}` after inlining), not only by the runtime choice. That is what lets the test bundle contain 0 owner IDs. The pure `selectAdUnits` also fails safe to sample units when the table is `null`.
2. **A killed boot does not even `require` the AdMob JS** (test: `moduleLoads 0`, `inits 0`, `ads 0`). The attempt loads it once ads are allowed again.
3. **`requestLoad` gates every ad request** on the per-format kill and on consent. This is stricter than LevelPlay, which kept reloading after a mid-session kill; the brief asks for "no ad request while killed". A config that lifts a kill re-requests idle ads.
4. **After a show failure, fetch a fresh ad immediately.** The SDK drops the failed ad and clears `loaded`. Without this, the interstitial would stay unready forever. This is not a pacing change.
5. **Ad expiry (about 1 h) is not handled proactively.** A stale ad fails its show → `display_failed` → an immediate fresh load. The honest state is kept, but one show attempt is wasted. Owner/controller call.
6. **Concurrent-show guard** (see TDD).
7. **Tests are rebuilt on one shared fake plus a `legacyListener` shim**, so every old body stays byte-identical. The shim encodes the mapping table above, and `rewardedListener` fans out to both rewarded ads, the way the old single ad served both placements.
8. **`delayAppMeasurementInit` and the plugin config are unchanged from ADMOB-A.** No native change, so no prebuild.

## Concerns
1. **I clicked through a test ad by accident (disclosed).** My attempt to clear Level 3 (a 37×37 board) with the solver misfired:
   - The hearts ran out, a stray tap hit Continue, and further taps landed inside the rewarded **test** ad. Logcat shows 3 `aclk` click-throughs to Google's sample "Flood-It!" creative, each ending in "No Activity found to handle Intent (market://…)" (`level3-stray-taps-logcat.txt`).
   - The ad was Google's sample unit (bundle proof: no owner unit exists in that build; `unitSet=test`). No **real** unit was loaded or tapped, so M1 held. It still broke my own rule of never tapping an ad's body.
   - Lesson: my tap calibration only held on the 20×20 and 21×21 boards. Stop an automated tap sequence as soon as the screen state diverges.
2. **The pacing reset on the device is proven behaviourally**, not by reading the counter (see above). The jest suites pin it directly: OPENED resets it; IMPRESSION, CLICKED, CLOSED-without-OPENED, a rejected show and a sync throw keep it.
3. **The emulator's save data changed:** Level 1 and Level 2 were cleared, so progress now shows Level 3, and there are extra losses and a changed pacing counter. A non-debuggable release build cannot be backed up, so I could not restore it.
4. **CCPA `rdp` as a string extra is UNVERIFIED** (above). COPPA uses the deprecated `tagForChildDirectedTreatment`.
5. **Kill switch and consent gate on the device: UNVERIFIED-DEVICE.** Both committed flags are OFF (`REMOTE_KILL_SWITCH = false`, `CONSENT_GATE` unset), so the no-`initialize()`-while-killed claim rests on jest, including the mutation check. A device proof needs a kill-flag build with seeded bits, as in W6-02.
6. **The Google SDK's manifest-registered init provider still runs at process start** whatever JS does (research Q4). `delayAppMeasurementInit` is on. "No Google code runs when killed" is not claimed.
7. **Two small changes outside ad code:** `contrastAudit.ts` line references (mechanical) and comment text in App.tsx, remoteConfig.ts and consent.ts.
8. **Stale LevelPlay text remains in docs:** `docs/remote-config.md`, `RELEASE.md` (the LevelPlay sanity check and Data safety), and the privacy policy and analytics-disclosure drafts. I left them for M7 / the owner queue.
9. **Metro's transform cache now holds the flag-unset build** from the positive control. Any later test-flag build must use `--reset-cache` / `--clear` again.

## Owner items
- M7 paperwork is unchanged from ADMOB-A: Play Data safety (Google Mobile Ads; 4 new permissions), the privacy policy, the AdMob Privacy & messaging GDPR message, and `app-ads.txt`.
- Decide whether to handle ad expiry proactively (decision 5).
- iOS needs its own AdMob app ID and units before any iOS build (ADMOB-A "What iOS needs later").
- Shipping builds must be made **without** `EXPO_PUBLIC_ADMOB_TEST_ADS`, and only they request the owner units. Never install one on an emulator or tap its ads.

## Fix round 1 (2026-09-24, after review of c7e2d55)

### Finding 1: a dead placement after a rejected native `show()` (fixed)
- **Premise confirmed (INFERRED from the source; not run on a device):**
  - `ReactNativeGoogleMobileAdsFullScreenAdModule.kt` `show()` rejects with `null-activity` / `not-ready` and sends no event.
  - `MobileAd.show()` sets `_showRequested = true` and returns that promise uncaught, so `_loaded` and `_showRequested` both stay true.
  - The old `presentAd` only resolved `display_failed`. The ad object stayed dead: every later `show()` threw synchronously and `load()` was ignored. The rewarded readiness also stayed `true`.
- **The fake was wrong:** its `reject` mode reset `showRequested = false`, unlike the real SDK. It now keeps `showRequested` and `loaded` true and emits no event (`helpers/fakeGoogleMobileAds.ts`).
- **The fix (`src/ui/ads.tsx`):**
  - `createAds` is split into `createInterstitialSlot` / `createRewardedSlot` over one `liveConfig` (module, units, request options).
  - `presentAd(slot, failedValue, onRefused)` calls `onRefused` on a synchronous throw or a native rejection. It skips the rejection when an `ERROR(show)` event already settled the show, because that path already fetches a fresh ad.
  - `onRefused` is `replaceInterstitial()` or `replaceRewarded(placement)`. It releases and destroys only that ad object, clears only that placement's readiness, creates a fresh object on the same unit and options, and requests it.
  - Telemetry is unchanged (`ad_request` → `ad_result display_failed` → `ad_reward earned:false`). The pacing counter is untouched on this path.
- **TDD (EXECUTED):**
  - RED (`artifacts/ADMOB-B/fix1-tdd-red.txt`):
    - pacing "next due show after a rejection…": `Expected: 2, Received: 1` (the second show threw synchronously);
    - two-units "a rejected native show() on one placement…": `Expected: false, Received: true` (hint readiness stayed true).
    - With the faithful fake, every pre-existing test still passed.
  - GREEN: 84/84 ad tests (`fix1-tdd-green.txt`).
  - Mutation (`fix1-mutation-checks.txt`): removing the `onRefused()` call on rejection fails both new tests. ads.tsx was restored and `cmp` confirmed it identical.

### Finding 2: M1 and the Metro cache (fixed in code and docs)
- **The unit-set line now prints inside `createAds`, before the first `requestLoad`:** `[ads] AdMob initialize resolved; adapters=N; unitSet=test|real`. A consent-driven recreate prints `[ads] AdMob ads recreated after a consent change; unitSet=…`.
  - Test "the unitSet= line precedes the first load" uses one shared call log of fake `load:` calls and console lines. RED: `Expected: < 4, Received: 7`; GREEN.
  - Mutation: moving the line after the loads fails it.
- **The ordering on a device is UNVERIFIED-DEVICE.** The controller made the emulator run optional, and I did not run it.
- **`RELEASE.md` section 3** is now "AdMob (ads) sanity check". It covers:
  - where the app ID and the units live;
  - **a shipping build never sets `EXPO_PUBLIC_ADMOB_TEST_ADS`**;
  - **any EXPO_PUBLIC flag flip needs `./gradlew --stop` plus a cleared Metro cache, then a bundle grep (ASCII and UTF-16) before installing**;
  - **read the `unitSet=` line before any interaction**; if it says `real` on an emulator or QA device, force-stop without touching anything.

  Section 4 no longer tells anyone to try real ads on the preview build. The Data safety list is marked as written for LevelPlay and must be re-checked for Google Mobile Ads (M7).
- **`docs/remote-config.md`:** every `LevelPlay.init` reference now describes AdMob. A kill means no AdMob JS load, no `initialize()` and no ad request; a lifted per-format kill re-requests idle ads.

### Minors (done)
- **The release log is silent under jest:** `releaseLog()` checks `process.env.NODE_ENV !== 'test'`, and Metro inlines `"production"` in a release bundle. A test asserts no `console.log` under jest, and `grep -c console.` over the ad suites' output is 0.
  - INFERRED, not rebuilt this round: the release bundle still prints the line.
- **The fake's `auto` mode now uses the real order:** interstitial OPENED, CLOSED; rewarded OPENED, EARNED_REWARD, CLOSED. All old tests pass with it.

### Gates (EXECUTED)
- `npx jest`: **51 suites, 840 tests, all pass** (+4: 2 for finding 1, 2 for finding 2 and the jest-silence minor).
- `npx tsc --noEmit`: exit 0.
- `npx jest --selectProjects ui`: 3 suites, 7 tests.
- Test-body identity vs c7e2d55 (`fix1-test-body-identity.txt`): every existing body in the 6 ad suites is identical; only new tests were added.

### Files changed this round
`src/ui/ads.tsx`, `src/ui/__tests__/helpers/fakeGoogleMobileAds.ts`, `src/ui/__tests__/adPacing.test.ts`, `src/ui/__tests__/adsTwoRewardedUnits.test.ts`, `RELEASE.md`, `docs/remote-config.md`, and this report. No emulator, build, package or git-state change.

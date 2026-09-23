# ADMOB-C: Google UMP consent source (M5) and the menu banner (M4)

Date: 2026-09-24. Branch `next-level`, working tree only. I ran no state-changing git command; the controller commits.
Evidence is in `artifacts/ADMOB-C/`. Labels: **EXECUTED** (I ran it and saw the output), **INFERRED** (read, not run), **UNVERIFIED-DEVICE**.

**Status: DONE_WITH_CONCERNS.**

**Banner (M4), flag `META_BANNER`, OFF by default.** On emulator-5556 a Google **Test Ad** anchored adaptive banner sits at the bottom of the menu, above the nav bar, with the stats line moved above it. The game screen has no banner.

**UMP (M5), behind `CONSENT_GATE`, OFF by default.**
- The owner has **not published a GDPR message**, so UMP builds no form. On the device it rejects with "Publisher misconfiguration … no form(s) configured for the input app ID".
- The gate fails closed: no `initialize()`, no ad request, no banner, and both rewarded buttons are honestly unavailable.
- This happened in debug geography **EEA and also OTHER**. **Turning `CONSENT_GATE` on before the message is published would therefore stop ads worldwide.**
- The consent form itself was never seen, so everything past "no form" is jest-only.

## Files changed
| File | Change |
|---|---|
| `src/ui/umpConsent.ts` | **New**, pure TS. Contains:<br>• `consentStateFromUmp` (fail-closed mapping)<br>• `umpRequestOptions` / `umpDebugResetEnabled` (debug settings only in test builds)<br>• `createUmpSource`, a `ConsentSource` over an injected `AdsConsent` |
| `src/ui/ads.tsx` | Adds:<br>• banner gating (`Ads.bannerAllowed`, `Ads.subscribeBanner`, `Ads.bannerRequest()`)<br>• `playerConsentSource()`, where a fixture wins and UMP is used otherwise, required lazily after the kill gate<br>• `openAdPrivacyOptions()` and `adPrivacyOptionsRequired()`<br>`syncRewardedReady()` also syncs the banner. |
| `src/ui/MenuBanner.tsx` | **New.** Renders `Ads.bannerRequest()`'s `BannerAd` in an absolute container at `bottom: insets.bottom`. It reports the loaded height, which is 0 until `onAdLoaded`. It never requires the package itself. |
| `src/ui/HomeScreen.tsx` | Mounts `MenuBanner` only when `META_BANNER` is on and `ftueRoute(...) === 'real'`, so there is no banner while Play would start the tutorial. The stats line sits at `insets.bottom + bannerHeight + 32`. |
| `src/ui/adUnits.ts` | `banner` is added to `AdUnitIds` and to the owner table (`…/5508761320`). Test builds use `TestIds.ADAPTIVE_BANNER`. Same selector, same rule. |
| `src/featureFlags.ts` | `META_BANNER = process.env.EXPO_PUBLIC_META_BANNER === '1'`. |
| `App.tsx` | `initAds(CONSENT_GATE ? playerConsentSource() : undefined)`. The now-unused `activeConsentSource` import is dropped. |
| `src/ui/contrastAudit.ts` | Mechanical only: 7 `${HS}:N` line references and one comment were remapped for the HomeScreen line shift. Each new line was checked by `sed -n` against the old one. No colour or role changed. |
| `src/ui/__tests__/umpConsent.test.ts`, `adsBannerAndPrivacy.test.ts`, `HomeScreen.banner.test.tsx` | **New** tests. |
| `src/ui/__tests__/adUnits.test.ts`, `helpers/fakeGoogleMobileAds.ts` | Additions only: fixtures gain `banner` / `ADAPTIVE_BANNER`, 3 new tests, and a fake `AdsConsent`, `BannerAd` and `BannerAdSize`. `git diff` shows **zero removed lines** in either file (`existing-test-files.diff`). |

No package file changed, so `npm ci --dry-run` was not needed. No `.env` was created.

## How it works
**UMP source (`gather()`):**
- It calls `requestInfoUpdate(debugOpts)`, then `loadAndShowConsentFormIfRequired()`, then reads `getGdprApplies()` (IABTCF). Under GDPR it also reads `getUserChoices()` (TC string).
- The mapping is:
  - A status other than OBTAINED or NOT_REQUIRED, or `canRequestAds` false, is **unresolved**, so no ads.
  - Where TCF says GDPR applies, `personalisedAds` is true only when both purpose 1 (store/access) and purpose 4 (personalised ads) are granted.
  - Otherwise the state is not GDPR and personalised.
- `ccpaOptOut` stays false. UMP's US message writes GPP, and the Mobile Ads SDK reads GPP natively.
- A UMP error throws, which the controller counts as a failed attempt and retries; it is never read as consent. The one exception follows Google's documented pattern: if the info update fails, an answer UMP stored in an earlier session (`getConsentInfo()` answered) still stands.
- `privacyOptionsRequired()` returns the cached `privacyOptionsRequirementStatus === 'REQUIRED'`.

**Privacy-options entry point:**
- `openAdPrivacyOptions()` calls `showPrivacyOptions()` (UMP's privacy options form) and persists the bits.
- On a withdrawal it closes every ad surface **before** calling `adInitController.consentChanged()`. The close therefore holds even if that re-gather fails (test-pinned).
- **No button was added.** The rulings grant no settings affordance: M4 and M5 are silent on it, and GLOBAL requires a flag and a ruling for any player-visible UI.
- **Where the owner puts it:** the W7-04 Settings sheet's "Ad privacy choices" row (docs/next-level/tasks/W7.md, W7-04 step 2). Show it when `adPrivacyOptionsRequired()` is true, and call `openAdPrivacyOptions()` on tap.
- UMP compliance needs this entry point reachable whenever the status is REQUIRED, so it must ship **before** `CONSENT_GATE` is flipped.

**Banner:**
- Allowed only when all of these hold: `META_BANNER`, the SDK initialised, ad objects created, consent allowing ad surfaces, and `!RemoteConfig.adsKilled()`.
- The kill obeys the all-ads bit only, because the banner has no bit of its own. Kill bits are a save format, so I added none.
- The key is `unit|options`, so a consent change that alters the request options remounts the banner and re-requests with the new options.
- **No banner telemetry:** the W6-06 schema's `format` enum is `'interstitial' | 'rewarded'` (`src/telemetry/events.ts`), so a banner event would be rejected. I did not change the schema.

**UMP debug knobs (test builds only, i.e. `__DEV__` or `EXPO_PUBLIC_ADMOB_TEST_ADS=1`; ignored otherwise and test-pinned):**
- `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY=EEA|REGULATED_US_STATE|OTHER`;
- `EXPO_PUBLIC_UMP_TEST_DEVICE_IDS` (comma list; needed only on a physical device);
- `EXPO_PUBLIC_UMP_DEBUG_RESET=1` (`AdsConsent.reset()` once per process, so each cold start re-asks).

## TDD (EXECUTED)
- **adUnits:**
  - RED 1: TS2353, `banner` not in `AdUnitIds`.
  - RED 2 (stub `banner: ''`): **4 failed / 11 passed** (`tdd-red-adUnits.txt`).
  - GREEN: 15/15 (`tdd-green-adUnits.txt`).
- **umpConsent:**
  - RED 1: TS2307, module missing.
  - RED 2 against a deliberately fail-open stub: **23 failed / 5 passed** (`tdd-red-ump.txt`).
  - GREEN: 28/28 (`tdd-green-ump.txt`).
- **adsBannerAndPrivacy:**
  - RED: TS2339, `playerConsentSource`, `bannerAllowed` and `bannerRequest` missing (`tdd-red-banner-privacy.txt`).
  - GREEN: 19/19 (`tdd-green-banner-privacy.txt`).
  - Covers: flag off, SDK not ready, cached kill, mid-session kill (subscribers hear `[false]`), per-format kill leaves the banner, declined at boot, withdrawn, request-options change (new key); UMP grant, refusal, no-form and killed boot (UMP never reached); fixture precedence; the privacy-options entry point (gate off, withdrawal with a failing re-gather, re-grant, form error, required flag).
- **HomeScreen.banner (ui project):**
  - The wiring passed on its first run, so its proof is the mutations below.
  - GREEN: 5/5 (`tdd-green-homescreen-banner.txt`).
- **Mutation checks** (`mutation-checks.txt`): each mutation was applied, the targeted suite was run, the file was restored, and `cmp` confirmed it identical. **Every one was caught:**

  | # | Mutation | Tests failed |
  |---|---|---|
  | M1 | Stats line ignores the banner height | 2 |
  | M2 | Banner shown during the tutorial | 1 |
  | M3 | HomeScreen ignores the flag | 1 |
  | M4 | Banner ignores the kill | 1 |
  | M5 | Banner ignores consent | 2 |
  | M6 | ads ignores the flag | 1 |
  | M7 | Withdrawal waits for the re-gather | 1 |
  | M8 | UMP ignores the TCF purposes (fail open) | 6 |
  | M9 | Any UMP status counts as answered | 7 |
  | M10 | Form error falls back to an unanswered cache | 2 |
  | M11 | Test build uses the owner banner unit | 4 |
  | M12 | Banner drops the privacy options | 1 |

## Gates (EXECUTED)
- `npx jest`: **54 suites, 895 tests, all pass** (`gate-jest.txt`). ADMOB-B ended at 51 / 840. The +55 are all new: adUnits 3, umpConsent 28, adsBannerAndPrivacy 19, HomeScreen.banner 5.
- `npx tsc --noEmit`: exit 0 (`gate-tsc.txt`).
- `npx jest --selectProjects ui`: **4 suites, 12 tests** (`gate-jest-ui.txt`; before: 3 / 7).
- `git diff --check`: clean.
- On the first full run, 7 `contrast.test.ts` rows failed because of HomeScreen line references. They were remapped (see Files) and now pass 142/142.

## Builds and bundle proof (EXECUTED)
Every build was an arm64 release: `./gradlew --stop`, then `$TMPDIR/metro-*` deleted (count 0 read back), then `df -h /` immediately before (6.7 / 6.7 / 6.6 / 6.6 GiB, all ≥ 5 GB). The signer is the upload cert `24f7fa0b…50f8`, the same as the installed base. Bundle greps are ASCII and UTF-16LE, run on `assets/index.android.bundle` in the APK.

| Build | Flags | Result |
|---|---|---|
| A | `ADMOB_TEST_ADS=1 META_BANNER=1` | `BUILD SUCCESSFUL in 56s`, sha `f07197e3…1633`. Owner units `6706292920` / `7549521178` / `3505414519` / **`5508761320`** and publisher `9813131856455133`: **0/0 each**. `9214589741` (test banner): 1 |
| B | A + `CONSENT_GATE=1 UMP_DEBUG_GEOGRAPHY=EEA UMP_DEBUG_RESET=1` | **Byte-identical to A. Not installed.** `createBundleReleaseJsAndAssets UP-TO-DATE` (`gradle-build-B.log:315`). See concern 1 |
| B2 | Same flags as B, plus `:app:createBundleReleaseJsAndAssets --rerun` | Bundle task executed; sha `a4a5978c…6c33`; the bundle differs from A. Owner IDs **0/0 each** |
| C | B2 with `UMP_DEBUG_GEOGRAPHY=OTHER`, plus `--rerun` | sha `4f312b21…d3a5`, differs from B2. Owner IDs **0/0 each** |

- **Positive control** (`bundle-grep-positive-control.txt`): `npx expo export:embed --reset-cache` with every flag unset, then `hermesc -O`. Not installed.
  - Each owner unit, **including the banner `5508761320`**, is found once, in the JS and in the Hermes bytecode.
  - The publisher prefix is found 4 times.
  - So the detector sees owner IDs when they are present. The Metro cache was cleared again afterwards.
- **Why three builds:** without a published message, a gate-on build can never show a banner. A (gate off) proves the banner; B2 and C prove the gate.

## Emulator evidence (EXECUTED on emulator-5556; every adb call went through a wrapper hard-coding `-s emulator-5556`)
- **Found state** (`device-found-state.txt`):
  - base f58692c, sha `3b0598d8…d939`, matching the artifact;
  - Wi-Fi 1, data 1, airplane 0, animation scales 1/1/1;
  - 1440×3120 at 560 dpi.
- **Build A, menu:**
  - `LaunchState: COLD`.
  - `[ads] AdMob initialize resolved; adapters=1; unitSet=test` printed before any request. That was followed by 3 "request is sent from a test device" lines (the full-screen ads) and a 4th about 2.5 s later, when the menu mounted the banner (`build-A-launch-logcat.txt`).
  - **`01-menu-test-banner.png`:** the "AdMob Adaptive Banner" creative with Google's **Test Ad** label spans the width, directly above the 3-button nav bar and clear of it. "2 puzzles solved" sits above the banner, and nothing overlaps the Play pill.
- **Build A, game:** Play led to Level 3. **`02-game-no-banner.png`** has no banner, and the UI dump has no "Test Ad" text.
- **Build A, back to the menu:** **`03-menu-again-banner-remounted.png`**, banner back, 5th request. Session totals: 5 requests, FATAL 0 (`build-A-session-logcat.txt`).
- **I never tapped a banner or any ad.**
- **Build B2 (gate on, debug geography EEA):**
  - UMP logs `Publisher misconfiguration: Failed to read publisher's account configuration; no form(s) configured for the input app ID … Received app ID: ca-app-pub-9813131856455133~9332456261`.
  - JS logs `[consent] UMP gather failed: …` (`build-B2-launch-logcat.txt`).
  - **No consent form appeared.**
  - **`04-ump-eea-cold-start.png`:** menu with no banner, and the stats line at its no-banner position.
- **Refusal state (fail-closed):**
  - `05-…` / `06-refused-after-hint-tap.png`: the hint bulb is greyed. Tapping it did nothing: no hint arrow, and `mResumedActivity` stayed MainActivity.
  - I lost 3 hearts by tapping blocked arrows; no ad existed to hit, since the SDK never initialised. **`07-refused-lose-panel-no-ad.png`** shows "Out of hearts / No ad available right now — Retry is free", and the UI dump shows `Continue +♥ (ad)` with `enabled="false"`.
  - `07-refused-after-taps.png` is a stale capture from a tap loop that failed before any tap ran (a zsh splitting error). It only shows the untouched board.
- **B2 log audit** (`build-B2-log-audit.txt`, whole process, pid 28103):
  - 4 `UMP gather failed` lines at +0 s, +5.1 s, +20.2 s and +65.3 s. That reconciles with 1 initial attempt plus the 3 timed retries of `AD_INIT_RETRY_DELAYS_MS = [5000, 15000, 45000]`.
  - `AdMob initialize` 0, `unitSet=` 0, test-device ad requests 0, `Ads` tag lines 0, FATAL 0, AdActivity 0.
- **Build C (gate on, debug geography OTHER):** the same "no form(s) configured" rejection at +0 s and +5.1 s (`build-C-launch-logcat.txt`, `08-gate-on-geography-other.png`). **UMP refuses in a non-regulated region too while nothing is published.**
- **Restored** (`device-restored.txt`): `install -r` of `arrows-test-f58692c.apk`; the on-device sha `3b0598d8…d939` matches. State `device`, radios and scales as found, emulator still running. `df` = 6.6 GiB (≥ 6 GB), so `android/app/build` is kept. **It holds build C** (a test-ads, gate-on, geography-OTHER APK).

## Decisions
1. **UMP lives in a pure module with the API injected.** ads.tsx supplies `AdsConsent` lazily inside `gather()`, so the W6-02 order holds: kill, then gather, then init. A killed boot never loads the package or reaches UMP (test-pinned).
2. **An EEA refusal still means no ads at all** (W7-01's `mayInitAds`). Serving non-personalised ads to EEA refusers is an owner call, not part of this task.
3. **A UMP error is a failed attempt, not a decline.** It is retried on the timers and on app-active, and the consent bits are untouched. Cost: each retry is one UMP request (4 timed, then one per foreground).
4. **Withdrawal through the privacy form closes surfaces immediately,** without waiting for the re-gather.
5. **Banner size `ANCHORED_ADAPTIVE_BANNER`,** the brief's literal wording. Upstream marks it `@deprecated` in favour of `LARGE_ANCHORED_ADAPTIVE_BANNER`, which is taller. This is a taste call for the owner.
6. **No banner while the tutorial is pending.** This is literal-plus: the tutorial happens on the game screen, but I also hide the banner while Play would start T1/T2. `FTUE_ENABLED` is OFF by default, so this is a no-op today.
7. **No new kill bit and no schema change** (see "How it works").
8. **No privacy button** (see "How it works").

## Concerns
1. **The flag-flip trap is bigger than GLOBAL's rule says.** `EXPO_PUBLIC_*` values are not Gradle task inputs. After `--stop` plus a cleared Metro cache, build B still reused A's bundle (`createBundleReleaseJsAndAssets UP-TO-DATE`) and produced a **byte-identical APK**.
   - I caught it by comparing hashes before installing; B was never installed.
   - ADMOB-B's build only escaped this because its sources had changed.
   - **Suggested rule:** after any flag change, add `:app:createBundleReleaseJsAndAssets --rerun` and confirm the task line says executed, not UP-TO-DATE. Put this in GLOBAL.md and RELEASE.md.
2. **UNVERIFIED-DEVICE, because no GDPR message is published:**
   - the UMP form, accepting, refusing through the form, and the privacy options form;
   - TCF decoding of a real TC string;
   - `privacyOptionsRequirementStatus`;
   - withdrawal removing a *live* banner (jest only).
   These all need a re-run once the owner publishes the message (same B2 recipe).
3. **Do not flip `CONSENT_GATE` yet.** EXECUTED: today it blocks ads in every geography, not only the EEA.
4. **Banner layout was checked on one profile only** (1440×3120 at 560 dpi, 3-button nav). It was not checked on the smallest profile, with gesture navigation, or in the dark theme. The owner must accept it visually (§2).
5. **Emulator save data changed:** Level 3 lost 3 hearts. A loss registers a finished game (the pacing counter, most likely +1) and loss stats. A non-debuggable release cannot be backed up, so I could not restore it.
6. **Carried over:** the CCPA `rdp` string extra is still UNVERIFIED (ADMOB-B). Under UMP, GPP is the path instead, and it is untested.

## Owner items
1. **Publish the GDPR message (required before `CONSENT_GATE` can be turned on).** INFERRED from AdMob's help; the console wording may differ.
   1. AdMob → **Privacy & messaging** → **European regulations** (GDPR) → **Create message**.
   2. Apps: select **Arrows (Android)**, app ID `ca-app-pub-9813131856455133~9332456261`.
   3. Languages: at least English.
   4. User choices: "Consent" and "Manage options". Optionally the "Do not consent" close button. Note: with this app a refusal means no ads for that player (decision 2).
   5. Privacy policy URL: the live policy (W7-07). It is required.
   6. Ad partners: Google only (no mediation).
   7. **Publish.**
   8. Optional: also publish a **US state regulations** message.
   9. Afterwards, re-run build B2 on the emulator (form expected), then the same with a hashed test-device ID on a real device.
2. **Place the privacy-options entry** (W7-04's "Ad privacy choices" row → `openAdPrivacyOptions()`) before flipping the gate.
3. **Google Play Data safety for the Google Mobile Ads SDK** (replaces ironSource/Unity). INFERRED from Google's published SDK disclosure; check it against https://developers.google.com/admob/android/privacy/play-data-disclosure.

   | Data | Collected and shared for | Notes |
   |---|---|---|
   | Device or other IDs (advertising ID, app set ID) | Advertising, analytics, fraud prevention | |
   | Approximate location (from IP) | Advertising, fraud prevention | |
   | App interactions (ad views and clicks) | Advertising, analytics | |
   | Diagnostics / crash data | Analytics | SDK performance |

   Also on the Play side:
   - "Data is encrypted in transit": Yes.
   - "Contains ads": Yes.
   - Advertising ID declaration: yes, for the `AD_ID` permission (ADMOB-A listed the 4 new permissions).
   - Remove the ironSource/Unity entries.
   - Update `docs/privacy-policy.html` and `store/privacy-policy.md`: name Google AdMob, UMP consent, and the privacy options.
   - `app-ads.txt` for publisher `pub-9813131856455133`.
4. **Visual acceptance:** `artifacts/ADMOB-C/01-menu-test-banner.png`. Is the banner placement under the stats line acceptable? **yes/no**. And standard or large anchored adaptive size (decision 5)?

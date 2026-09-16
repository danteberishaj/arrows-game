# Releasing Arrows on Google Play

Everything in the repo is release-ready: branded icons, `com.danteb.arrows`
identity, EAS build profiles, store assets in `store/`, and a privacy policy in
`docs/`. What remains are the account-bound steps only you can do, in order:

## 1. One-time setup

```bash
npm i -g eas-cli          # or use npx eas-cli everywhere below
eas login                 # your Expo account (create one at expo.dev if needed)
eas init                  # links the project (writes extra.eas.projectId into app.json)
```

Commit the `app.json` change `eas init` makes.

## 2. Host the privacy policy (required for apps with ads)

The policy lives at `docs/privacy-policy.html`. Easiest free hosting — GitHub Pages
from this repo:

1. GitHub → arrows-game → Settings → Pages
2. Source: "Deploy from a branch", branch `main`, folder `/docs`
3. Your URL becomes: `https://danteberishaj.github.io/arrows-game/privacy-policy.html`

Keep that URL — the Play Console asks for it in two places (Store listing and Data
safety).

## 3. LevelPlay (ads) sanity check

The keys in `src/ui/ads.tsx` came from the Unity app. In the LevelPlay dashboard
confirm the Android app is registered with package **com.danteb.arrows** (it is, if
this is the same app entry the Unity build used — Unity's package was also
`com.danteb.arrows`). If you ever change the package name, register a new app there
and swap `APP_KEY` / ad unit IDs at the top of `ads.tsx`.

## 4. Build

```bash
eas build -p android --profile production
```

- First run asks about a keystore: let **EAS generate and manage it** (it's stored in
  your Expo account; you can download a backup with `eas credentials`).
- Output is an `.aab` (app bundle) — the format Play requires.
- Want to sanity-test the exact release build on your phone first?
  `eas build -p android --profile preview` produces an installable `.apk`.
  **This is also the first build where REAL LevelPlay ads run** (Expo Go only ever
  shows the simulated test ads), so test the interstitial, the +♥ continue, and the
  hint before submitting.

## 5. Play Console

Create the app at <https://play.google.com/console> ($25 one-time developer fee if
you don't have an account).

**App details**: Name "Arrows" (if taken, "Arrows: Ink Night"), free, game →
Puzzle. Upload the `.aab` to **Internal testing** first, add your Gmail as a tester,
install via the opt-in link, and play a few levels.

**Store listing** (assets are in `store/`):
- App icon: `store/playstore-icon-512.png`
- Feature graphic: `store/feature-graphic.png` (Higgsfield brand art; a simpler
  script-composed fallback lives in `store/fallback/`)
- Promo art in `store/marketing/`: board-heart / board-crescent / board-flower
  are REAL generated levels rendered with the game's exact line-art (regenerate
  with `npx tsx scripts/generate-promo-art.ts`) — safe as listing imagery because
  they show true gameplay boards. Alternate logo and wordmark-banner takes are
  there too (brand art, fine for the feature graphic).
- Screenshots: take at least 2 phone screenshots (portrait) from the internal-test
  build — the menu and a mid-level board make a good pair; a SuperHard silhouette
  (heart/crescent) makes a great third. Play policy expects screenshots to show
  REAL gameplay — use the promo art around them, not instead of them.
- Short description (≤80 chars), e.g.:
  "Calm arrow puzzles. Find the order, clear the shape, keep your streak."
- Privacy policy URL: from step 2.

**Data safety** form — declare honestly (this matches the LevelPlay SDK):
- Collects data: **Yes**
- Device or other IDs → Advertising ID: collected, **shared** (with ad partners),
  purpose **Advertising or marketing**, optional: **No**, ephemeral: **No**
- Location → Approximate location: collected via IP by the ad SDK, purpose
  Advertising
- Data is encrypted in transit: **Yes**. Deletion request mechanism: **No** (no
  accounts; progress is device-local)

**Ads declaration**: Yes, contains ads.
**Content rating questionnaire**: it's a puzzle game, no user content, no violence —
lands at Everyone / PEGI 3. **Target audience**: 13+ (avoids the families-program
requirements that ad SDKs complicate).

## 6. Roll out

Internal testing → (optionally closed testing) → Production. New Play accounts may
require a closed test with 12+ testers for 14 days before production — the console
tells you if so.

Subsequent releases: bump nothing by hand — `eas build --profile production`
auto-increments the versionCode (`autoIncrement` in eas.json; version name comes
from `version` in app.json). Optionally wire `eas submit -p android` with a Play
service account for CLI uploads (eas.json is preconfigured to the internal track).

## Target SDK proof (local release artifact)

Play requires target API 36 for updates from 2026-08-31. `targetSdk` is pinned
nowhere in the tracked repo (`app.json` has no `targetSdkVersion`; the value comes
from the React Native / expo-modules-core gradle defaults). So the proof is read
from the compiled manifest of a built artifact, which is what Play checks.

- **Commit:** `a1e2b43512959ba66fbacdd8908f44cc37e5bb24` on `next-level` (app code
  identical to `da93dcd`; only `docs/` and `.gitignore` differ).
- **Date:** 2026-09-16.
- **Build shape:** non-perf release. `ARROWS_PERF_BUILD` and every
  `EXPO_PUBLIC_PERF_*` unset; arm64-v8a only (the ABI filter does not change the
  manifest). Signed by the local upload keystore config (`credentials/` present;
  signer DN `CN=Arrows`, not the debug key).

Commands (from the repo root; `ANDROID_HOME` had to be passed because
`prebuild --clean` removes `android/local.properties`):

```bash
df -h /                                   # 11Gi available
npx expo prebuild --platform android --clean --no-install
# generated outputs from scripts/perf/android/benchmark.mjs:415-421 removed (none existed after --clean)
cd android
env -u CI -u ARROWS_PERF_BUILD ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
env -u CI -u ARROWS_PERF_BUILD ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew :app:bundleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
cd ..
~/Library/Android/sdk/build-tools/36.0.0/aapt dump badging android/app/build/outputs/apk/release/app-release.apk | grep -E "sdkVersion|targetSdkVersion|versionCode"
~/Library/Android/sdk/cmdline-tools/latest/bin/apkanalyzer manifest print android/app/build/outputs/apk/release/app-release.apk | grep -c profileable
bundletool dump manifest --bundle android/app/build/outputs/bundle/release/app-release.aab --xpath /manifest/uses-sdk/@android:targetSdkVersion
```

Printed lines:

```text
# aapt dump badging (APK)
package: name='com.danteb.arrows' versionCode='6' versionName='1.0.0' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36' compileSdkVersionCodename='16'
sdkVersion:'24'
targetSdkVersion:'36'

# apkanalyzer manifest print (APK) | grep -c profileable
0

# bundletool 1.18.1 dump manifest (AAB)
/manifest/uses-sdk/@android:targetSdkVersion  -> 36
/manifest/uses-sdk/@android:minSdkVersion     -> 24
/manifest/@android:versionCode                -> 6
dump manifest | grep -c profileable           -> 0
```

Hashes:

```text
7556f834c720842d47385e066da7aec7b3e05ce2808ed443fe7b794f8f32a428  app-release.apk (42035912 bytes)
ab0426acbbc1d7ff0aa86cbf4c3293325d244258599ebdf2db988a4d3aa40302  app-release.aab (34146058 bytes)
```

The APK is kept as the base build for later verification at
`artifacts/base/da93dcd-release-arm64.apk` (sha256 in
`artifacts/base/da93dcd-release-arm64.apk.sha256`). `artifacts/` is gitignored and
must stay that way: the APK is signed with the real upload key and this repo is
public. The `.aab` was not kept; its hash is recorded above.

**Still unverified:** the `.aab` that EAS builds in the cloud and that is actually
uploaded. It is expected to match, because EAS runs the same prebuild and
`bundleRelease`, but only a `bundletool` read of that file proves it (P-04b).

## Asset regeneration

- Icons / store art (from `assets/images/mark.png`): `node scripts/generate-store-assets.js`
- Sound effects: `node scripts/generate-sfx.js`
- Real-level promo boards: `npx tsx scripts/generate-promo-art.ts`

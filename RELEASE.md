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
- Feature graphic: `store/feature-graphic.png`
- Screenshots: take at least 2 phone screenshots (portrait) from the internal-test
  build — the menu and a mid-level board make a good pair; a SuperHard silhouette
  (heart/crescent) makes a great third.
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

## Asset regeneration

- Icons / store art (from `assets/images/mark.png`): `node scripts/generate-store-assets.js`
- Sound effects: `node scripts/generate-sfx.js`

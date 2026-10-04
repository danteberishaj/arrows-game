# PETAL-ADS-01: rewarded ad for petals in the collection book

2026-10-04/05. **Implemented behind `EXPO_PUBLIC_META_PETAL_ADS` (default OFF). Unit and device checks have run. The
owner has not reviewed the look yet. No ship decision.**

- Branch `next-level`, start HEAD `8a5a56d`. Nothing committed or pushed; no EAS.
- Node v20.19.4 in every shell. No dependency was added.
- The Expo v57 versioned docs index was read before coding. The feature uses no new Expo API.
- Device: `emulator-5556 / fleet_floor_api31` only. No emulator was running at the start; I booted that AVD on port 5556
  and shut it down at the end.
- Spec note: the collection-book spec (`docs/superpowers/specs/2026-10-04-collection-book-design.md`) still lists
  "No rewarded ads for petals" as an owner ruling. The brief supersedes it (owner approved, 2026-10-04). The spec is
  not amended here.

## What was built

### Flag and gate
- `src/featureFlags.ts`: `META_PETAL_ADS`.
- `src/ui/rewardGate.ts`: `petalAdsEnabled() = META_PETAL_ADS && rewardBookEnabled()`.
- Added to `NAMED_META_FLAGS` in `src/__tests__/featureFlags.test.ts`.

### Ads (`src/ui/ads.tsx`)
- New rewarded placement `'petals'`, with its own ad object, readiness (SDK events only), load and 15 s reload.
- It uses the same kill-switch path (`killed('rewarded')`), the same consent gate (`consentAllowsAdSurfaces`) and the
  same `presentAd` show and refusal handling as `continue` and `hint`.
- The placement exists only when `petalAdsEnabled()`, through `rewardedPlacements()`. With the flag OFF:
  - exactly two rewarded objects are created and loaded, as before;
  - `showRewarded('petals')` shows nothing and resolves `false` (not_ready).
- Telemetry: `'petals'` was added to the `placement` enums of `ad_request`, `ad_result` and `ad_reward`
  (`src/telemetry/events.ts`).

### Ad unit
See "Ad-unit decision" below. `AdUnitIds.rewardedPetals` was added in `src/ui/adUnits.ts`.

### Ledger (`src/ui/rewardLedger.ts`, still free of React Native)
- Keys: `arrows_petal_ads_day` (local day number, same formula as `SaveSystem.today()`) and `arrows_petal_ads_count`.
  They are exported as `PETAL_AD_KEYS`.
- `petalAdState(now) -> { left }`.
- `grantPetalAd(now) -> 'granted' | 'capped' | 'unavailable'`. A grant adds +3 petals and writes count+1 and today's
  day in the same tick, then publishes the new purse.
- Returns `'unavailable'` when the session is read-only (SAVE-GUARD), when the book or petal ads are off, or when the
  state is null.
- The keys are read lazily (never at init) and never while petal ads are off.
- Clock and restore rules (fail closed):
  - a day AFTER today counts as today;
  - a missing or corrupt day (not a non-negative integer) counts as today;
  - only a valid EARLIER day resets the count;
  - the count is truncated and clamped to 0..5;
  - a non-finite count reads as 5.
- `RewardState.petalAds` tells the UI whether to show the button.

### Storage and boot
- `src/ui/storage.ts`: `initSaveSystem(..., petalAds = false)` hydrates `PETAL_AD_KEYS` only with path, book and
  petal ads all on, in the same single `multiGet`.
- `App.tsx` passes `petalAdsEnabled()`.

### UI
New `src/ui/PetalAdButton.tsx`:
- Label "Watch an ad · +3 petals" with the caption "{left} left today". The icon is a drawn SVG (screen + play
  triangle), not an emoji.
- Uses the existing `PressScale` / `pressSnapTransform` and the book's primary style. The disabled look is the book's
  dashed outline.
- Height: `minHeight: 52`, and 182 px = 52 dp on device.
- States, in priority order:

  | State | Button | Label | Caption |
  | --- | --- | --- | --- |
  | Read-only save | disabled | "Watch an ad · +3 petals" | "Ads for petals are paused right now" (new copy, my wording) |
  | Cap reached | disabled | "Come back tomorrow for more" | none |
  | Ad showing | disabled | unchanged | unchanged |
  | No ad loaded | disabled | "No ad available right now" (never grants) | "{left} left today" |
  | Ready | enabled | "Watch an ad · +3 petals" | "{left} left today" |

- A synchronous ref latch blocks a second tap in the same frame.
- Petals are granted only when `Ads.showRewarded('petals')` resolves `true`, which happens only on the SDK's
  `EARNED_REWARD`. A granted ad is announced as "+3 petals".

`src/ui/CollectionBook.tsx`:
- The button sits at the top of the Book tab's grid, under the purse and the tab track.
- On the confirm screen it appears only when `state.canBuy && petals < price`, under "You need N more petals".
- Interpretation: the purse sits above the tab track, which both tabs share. The button lives inside the Book tab
  content, so switching tabs does not move the track.

### Contrast
- 7 rows were added to `src/ui/contrastAudit.ts` (`petal-ad-label`, `-pressed`, `-disabled`, `petal-ad-caption`, and
  `petal-ad-icon`, `-pressed`, `-disabled`).
- All 38 `src/ui/CollectionBook.tsx:N` pointers (on 19 existing rows) were remapped to their new lines with a HEAD→working diff mapping.
- `npx tsx scripts/contrast-audit.ts`: 220 gated rows, 0 FAIL.
  - Weakest new rows: `petal-ad-label-disabled` and `petal-ad-caption` at 4.51 in Daylight, and `petal-ad-label` at
    4.51 in Ink Night. Same tokens as the existing book rows.
  - Output: `artifacts/PETAL-ADS-01/checks/contrast-petal-rows.txt`.

## Ad-unit decision

**Changed mid-task by the owner, through the controller.** The brief said to reuse the real `rewardedHint` unit. I first
wrote that. The controller then relayed a dedicated owner unit:

- `ca-app-pub-9813131856455133/5754923896`, "Arrows - Rewarded - Petals", reward 3 Petals.

What changed:
- It is wired exactly like the other owner units: `OWNER_AD_UNITS.rewardedPetals` in `src/ui/adUnits.ts`, compiled out
  of any `EXPO_PUBLIC_ADMOB_TEST_ADS=1` build.
- Every test mode (`__DEV__`, test flag `'1'`, owner table compiled out) resolves `rewardedPetals` to Google's rewarded
  sample unit (`TestIds.REWARDED`).
- No unit id was invented. The hint unit is NOT reused.
- `src/ui/__tests__/adUnits.petals.test.ts` checks:
  - the real petals unit is exactly `…/5754923896`;
  - it differs from the hint, continue, interstitial and banner units;
  - all three test modes give `ca-app-pub-3940256099942544/5224354917`;
  - a test-ads build has no owner table.
- Note: a shipping build with petal ads OFF still contains the petals id in its owner table (ad ids ship in every
  binary and are not secrets). It never requests it: `rewardedPlacements()` creates no petals object, which
  `adsPetalsPlacement.test.ts` checks.
- **UNVERIFIED:** no real-ads build was made, so a fill on the real unit is untested by design.

## Tests

### Red phase
Six new suites plus the flag-list edit failed before any implementation:
- 7 failed suites;
- causes: missing module `../PetalAdButton`, missing exports/types (ts-jest "suite failed to run"), and the
  `META_PETAL_ADS` flag-list tests;
- output: `artifacts/PETAL-ADS-01/checks/jest-red.txt`.

### Green phase
| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p .` | exit 0 (`checks/tsc.txt`) |
| `npx jest --silent`, baseline (same HEAD, before any change) | 132 suites / 2,276 tests / 12 snapshots, all passed (`checks/jest-baseline.txt`) |
| `npx jest --silent`, final | **138 suites / 2,349 tests / 12 snapshots, all passed** (`checks/jest-full.txt`) |

The final run adds 6 suites and 73 tests.

### New suites
- `src/ui/__tests__/rewardLedger.petalAds.test.ts` (node). Covers:
  - flag off and book off: zero petal-ad key reads and writes, `'unavailable'`;
  - lazy init;
  - a grant gives +3 and records the day and count;
  - cap 5, and a 6th grant writes nothing;
  - the next local day resets;
  - a future day counts as today;
  - 10 corrupt or restored cases never grant extra;
  - a read-only session is unavailable and writes nothing;
  - a grant publishes the new purse.
- `src/ui/__tests__/adsPetalsPlacement.test.ts` (node, fake AdMob SDK). Covers:
  - flag OFF control: only continue and hint objects, petals never ready, show grants nothing;
  - flag ON: a third object on the petals unit, loaded once, with its own readiness and reload;
  - earned only on `EARNED_REWARD`, with petals telemetry;
  - dismissed (CLOSED without EARNED) resolves false and reports `dismissed`;
  - not loaded: no show, `not_ready`;
  - a second show while one is on screen shows nothing;
  - remote kill of the rewarded format: never requested, never ready, never shown, `killed`.
- `src/ui/__tests__/adUnits.petals.test.ts` (node): the ad-unit checks above.
- `src/ui/__tests__/storage.petalAds.test.ts` (node). Covers:
  - book on, petal ads off: keys neither hydrated nor written;
  - petal ads on: both keys in the single `multiGet`, and boot writes neither;
  - petal ads without the book: not hydrated.
- `src/ui/__tests__/PetalAdButton.test.tsx` (ui). Covers:
  - ready;
  - earned → one grant and the "+3 petals" announcement;
  - dismissed → no grant, no announcement;
  - "No ad available right now" is disabled and a press never shows or grants;
  - readiness follows SDK events;
  - cap → "Come back tomorrow for more";
  - read-only → disabled, never shows or grants;
  - **double tap shows one ad**, and the button is disabled while the ad shows;
  - a capped result announces nothing;
  - minHeight ≥ 48.
- `src/ui/__tests__/ArrowStyleOptions.petalAds.test.tsx` (ui; the REAL ledger and store with a fake SDK). Covers:
  - Book tab: 10 → 13 petals and "5 left today" → "4 left today", announced and saved;
  - dismissed changes nothing;
  - five ads reach the cap with no sixth ad;
  - the short-of-petals confirm shows the button, and the affordable confirm does not;
  - read-only writes nothing;
  - flag off: no button on the grid or the confirm, and no petal-ad key touched.

### Controls shown failing with their guard broken, then restored
File: `checks/guard-broken-controls.txt`. Each line is broken guard → failing tests; after each restore, all of them
passed again.

1. `rewardedPlacements()` always returns all three placements → 2 ad tests fail: the flag-OFF object count and the
   flag-OFF "never ready".
2. Ledger `petalAds = enabled` (book and flag ignored) → 2 fail: flag off and book off.
3. Storage always hydrates `PETAL_AD_KEYS` → 2 fail.
4. Button `disabled` ignores `!ready` → "No ad available … never shows or grants" fails.
5. Grant without `earned &&` → 2 fail: the dismissed checks in the button and integration suites.
6. `grantPetalAd` without `!writable` → the read-only test fails.
7. Cap check removed → 12 fail.
8. Day rule replaced by "any other day resets" → 5 fail: future and corrupt day.
9. Book grid shows the button without `state.petalAds` → the flag-off integration test fails.

### Existing tests changed
- `src/ui/__tests__/adUnits.test.ts`: the `OWNER` and `TEST_UNITS` fixtures gained `rewardedPetals`. `AdUnitIds` now has
  that required field, so tsc failed (TS2741) and `toEqual` would compare a different shape. No assertion was removed.
- `src/ui/__tests__/gameSessionLifecycle.test.ts`: the W3-05 source-order test pins the exact App.tsx text
  `initSaveSystem(skinPickerEnabled(), rewardPathEnabled(), rewardBookEnabled(), seasonsEnabled())`. The call gained
  `, petalAdsEnabled()`, so the pinned string was updated. The ordering assertions are unchanged. This test failed
  once in the first full run (`indexOf` = -1) before the update.
- `src/__tests__/featureFlags.test.ts`: `'META_PETAL_ADS'` was added to the named list, as the brief asked.

## Device (emulator-5556 / fleet_floor_api31, API 31)

### Build
- `artifacts/PETAL-ADS-01/build-test-apk.sh`: a copy of the HALLOWEEN-01b script with the "on" flags plus
  `EXPO_PUBLIC_META_PETAL_ADS=1`. The diff is in the session log.
- It ran under `nohup`, one Gradle build, after the existing-Gradle check.
- Free disk: 3.8 GiB before the run. After `prebuild --clean` removed the old `android/`, the script's gate read
  6.2 GiB (≥ 5 GiB), then gradle ran. Free disk after the build: 4.4 GiB.
- Exit 0. Logs: `build/driver.log` and `build/build.log`. APK SHA256 `c2967710…f340`.

### Bundle proof (before install)
Script: `artifacts/PETAL-ADS-01/prove-apk.py`; output: `build/proof.txt`.

| Check | Result (UTF-8, UTF-16LE) |
| --- | --- |
| Hermes magic | true |
| `3940256099942544` (Google test units) | [9, 0] |
| `6706292920`, `7549521178`, `3505414519`, `5508761320`, `5754923896`, `9813131856455133` | [0, 0] each |
| Diagnostic classes in dex | none |
| Instrumentation entries in the manifest | none |
| Positive control `'Watch an ad'` | [0, 1] (Hermes stores strings containing `·` as UTF-16) |
| Positive control `arrows_petal_ads_count` / `_day` | present |
| Positive control "Come back tomorrow for more" | present |

### Install and save
- `adb install -r -d`, no uninstall.
- `device.py backup` saved RKStorage and its journal through `su 0`, plus settings, timezone and display. The original
  save was an empty (0-byte) RKStorage.
- `device.py restore` at the end: rows, settings and display equal, and file SHA256s byte-identical
  (`device/restore-proof.json`).
- The device clock was never changed. `date` matched the host and `auto_time` stayed 1.
- Not restored: the installed app is now this PETAL-ADS-01 test APK (the previous APK was installed 2026-10-04 16:57).

### Screenshots (`artifacts/PETAL-ADS-01/screens/`)
`device/after-*.txt` holds the save rows after each step.

| # | File | What it shows |
| --- | --- | --- |
| 1 | `01-book-button-5-left.png` | Book tab: purse "10 petals", enabled "Watch an ad · +3 petals", "5 left today" |
| 2 | `02-test-rewarded-ad-showing.png` | The **TEST** rewarded ad ("Test Ad" label) in `AdActivity` |
| 3 | `03-test-ad-after-countdown.png` | Countdown waited out: "Reward granted". Closed with BACK only, no tap on the ad |
| 4 | `04-after-ad-13-petals-4-left.png` | **"13 petals", "4 left today"**. Save: `arrows_petals 13`, `arrows_petal_ads_count 1`, `arrows_petal_ads_day 2469` (= 2026-10-05 local) |
| 5 | `05-confirm-short-of-petals-with-button.png` | Pumpkin (20): dashed "Buy for 20 petals", "You need 7 more petals", the button, "4 left today", "Not now" |
| 6 | `06a`, `06b` | 2nd ad. BACK was sent after "Reward in 1 second", so it was not early. Granted: 16 petals, "3 left today", count 2 |
| 7 | `07a`, `07b` | 3rd ad. BACK sent at "Reward in 4 seconds" **was ignored**: the ad kept focus, then showed "Reward granted", and the save stayed at count 2 / 16 petals until then. BACK after the reward closed it: 19 petals, "2 left today", count 3 (`08-after-third-ad.png`) |
| 8 | `09-cap-reached-come-back-tomorrow.png` | Count set to 5 in the save: disabled dashed "Come back tomorrow for more" (`enabled=false`). A tap on it: focus stayed `MainActivity`, save unchanged |

Rule followed throughout: no ad creative was ever tapped. Only BACK was sent, and only while `AdActivity` had focus
(`device.py back-ad` asserts that).

## UNVERIFIED

- **Dismissed-early grants nothing, on device.** The test rewarded ad ignores BACK until the reward is earned (row 7).
  Its close control is part of the creative and must not be tapped. The path is covered only by fake-SDK tests:
  `adsPetalsPlacement` "dismissed before the reward", and the dismissed tests in `PetalAdButton` and
  `ArrowStyleOptions.petalAds`.
- **"No ad available right now" on device.** The next test ad reloaded within about 2 s of every close, so I saw no
  not-ready window. Covered by unit tests only.
- **Read-only (failed hydrate) on device**: unit tests only.
- **Double tap on device**: unit test only (ref latch plus the disabled state).
- **Kill switch and consent for petals on device**: unit tests only. `REMOTE_KILL_SWITCH` is literally false and the
  consent gate was off in this build.
- **Screen-reader announcement** "+3 petals": checked in jest; TalkBack was not run.
- **Dark theme look**: no capture; only the contrast audit rows. The owner has not reviewed the look in either theme.
- **Real unit fill** (`…/5754923896`): untested by design (no real-ads build).
- **Layout note for the owner**: the button hugs its content (about 216 dp wide on the 1440 px screen), like the
  existing Buy button. It does not span the sheet. It is ≥ 48 dp tall (52 dp).

## Changes outside the brief

- `src/telemetry/events.ts`: `'petals'` added to the three ad event placement enums. It is needed for "its own
  telemetry placement value".
- `docs/engineering-lessons.md`: a new entry appended at the end. The other session's uncommitted "Workflow Studio"
  edit is byte-for-byte preserved (the prefix was checked against a snapshot taken at the start).
- No other file outside the brief's list was edited.
- The product module `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/` holds its 6 product files.

## Controller review

2026-10-05, controller. **Verdict: APPROVE behind the default-OFF `EXPO_PUBLIC_META_PETAL_ADS` flag.**

| Check | Register | Evidence |
| --- | --- | --- |
| Tests and types | Executed | tsc 0; full jest 138 suites / 2,349 tests. |
| Ad units | Read | The real petals unit `ca-app-pub-9813131856455133/5754923896` is set in `src/ui/adUnits.ts:53`. Test modes resolve to Google's test rewarded unit (`:77`). The test-ads APK proof shows 0 occurrences of the real id. |
| Device flow | Executed (viewed) | Screens 01, 02, 04, 05, 09: 10 petals and "5 left today", then a TEST ad, then 13 petals and "4 left today". The short-of-petals confirm shows the button. The cap reached shows "Come back tomorrow for more". |
| Product module | Executed | Only its 6 files. |

**UNVERIFIED:** on a device, an early-dismissed ad and the "No ad available" state (fake-SDK tests only); dark theme; TalkBack; real-unit fill (AdMob may need up to an hour after unit creation).

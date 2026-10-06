# Play phone screenshots (W7-09, captured 2026-10-06)

Two candidate sets for the owner to choose from in W7-10. Nothing here has been uploaded.

- `set-a-default/`: the **flags-default** build (every `EXPO_PUBLIC_META_*` unset). This is what the
  listing copy in `store/listing/play.md` describes.
- `set-b-styles/`: the **"styles"** build, with the same flags as the current Play internal-test build
  (`artifacts/ART-SKINS-08/release/build-aab15.sh`) **minus `EXPO_PUBLIC_META_BANNER`**. It shows a cute
  arrow style, the Arrow style Book and the unlock reveal. The listing copy does not describe these
  features yet; a line about them belongs to the release that turns their flags on.

## Play Console rules (re-read 2026-10-06)

Source: Play Console Help, "Add preview assets to showcase your app",
<https://support.google.com/googleplay/android-developer/answer/9866151>, read on 2026-10-06. The page
shows no "last updated" date. Quoted from its Screenshots section:

- "You must provide a minimum of two screenshots across different device types to publish your store listing"
- "JPEG or 24-bit PNG (no alpha)"
- "Minimum dimension: 320px"
- "Maximum dimension: 3840px"
- "The maximum dimension of your screenshot can't be more than twice as long as the minimum dimension."
- "You can add up to 8 screenshots for each supported device type."
- Highly recommended, for games to appear in the large-format recommendation sections: "at least three 16:9
  landscape screenshots (minimum 1920x1080px) or three 9:16 portrait screenshots (minimum 1080x1920px)". It
  also asks for full battery, Wi-Fi and cell icons, no notifications, no device frames, no store badges and
  no call to action, plus alt text for each screenshot.

What that meant here:

- The AVD is 1440x3120 (2.17:1), over the 2:1 limit. Every capture ran at
  `adb -s emulator-5556 shell wm size 1440x2880` (exactly 2:1; the app lays itself out at that size, so the
  pixels are real), and `wm size reset` ran afterwards. Every file is **1440x2880**, 8 bits per channel,
  `hasAlpha: no` (checked with `sips -g pixelWidth -g pixelHeight -g hasAlpha`).
- `screencap` writes RGBA. Each capture was checked to have alpha 255 everywhere, then saved as a 24-bit
  RGB PNG (no pixel changed). The raw RGBA files are in `artifacts/W7-09/raw/` (gitignored).
- **Owner decision:** 1440x2880 meets the requirement but is **not 9:16**. The large-format game sections
  ask for 9:16 portrait (for example 1440x2560). A 9:16 set is the same recipe at `wm size 1440x2560`.
- The status bar uses Android's SystemUI demo mode (fixed 12:00 clock; full battery, Wi-Fi and cell; no
  notification icons). Without it, a system "physical keyboard" notification icon showed next to the clock.
  Demo mode was switched off afterwards and `sysui_demo_allowed` restored to 0.

## Proposed order (the owner decides in W7-10)

**Set A, flags default** (APK `af9a4467…`). The dense board is second, as W7-09 asks: it is the
review-evidenced advantage (the whole picture visible).

| # | File | Shows | Theme | Level index / save |
|---|---|---|---|---|
| 1 | `set-a-default/01-menu-daylight-af9a4467.png` | Menu | Daylight | save: current level 17, 17 solved |
| 2 | `set-a-default/02-dense-star-board-daylight-af9a4467.png` | Densest board of indices 0..199: index 137, Star 44x44, all **209** arrows (counter "209 left"), fresh, at fit | Daylight | save: current level 137 |
| 3 | `set-a-default/03-rocket-board-midplay-inknight-af9a4467.png` | Index 17, Rocket, 15 arrows cleared (125 left) | Ink Night | save: current level 17 |
| 4 | `set-a-default/04-heart-board-midplay-daylight-af9a4467.png` | Index 161, first Heart, 12 cleared (160 left) | Daylight | save: current level 161 |
| 5 | `set-a-default/05-cat-board-midplay-daylight-af9a4467.png` | Index 167, first Cat, 12 cleared (190 left) | Daylight | save: current level 167 |
| 6 | `set-a-default/06-win-panel-inknight-af9a4467.png` | Win panel after clearing index 17 ("Cleared!", 3 stars) | Ink Night | continues #3 |
| 7 | `set-a-default/07-menu-inknight-af9a4467.png` | Menu | Ink Night | save: current level 17, dark mode |

**Set B, styles** (APK `e0ce6d6b…`):

| # | File | Shows | Theme | How it was reached |
|---|---|---|---|---|
| 1 | `set-b-styles/01-critter-board-daylight-e0ce6d6b.png` | Index 2 (level 3, Triangle) in the Critter style, at the opening (zoomed) camera | Daylight | "Play with Critter" on the reveal card |
| 2 | `set-b-styles/02-arrow-style-book-daylight-e0ce6d6b.png` | Settings → Arrow style → Book tab (Halloween pack, prices, Cinnamon Roll "free in 4") | Daylight | after #3 |
| 3 | `set-b-styles/03-unlock-reveal-critter-daylight-e0ce6d6b.png` | "NEW STYLE UNLOCKED: Critter" reveal after clearing level 2 | Daylight | fresh save, levels 1 and 2 cleared by legal taps |
| alt | `set-b-styles/04-alt-critter-board-fit-daylight-e0ce6d6b.png` | #1 pinched out to fit, 10 cleared: the whole Triangle, but the faces are too small to read | Daylight | |
| alt | `set-b-styles/05-alt-your-styles-daylight-e0ce6d6b.png` | Arrow style → Your styles tab | Daylight | |

Owner notes:

- **Set B #2 shows a "Watch an ad · +3 petals" button.** That is the in-app rewarded-ad offer
  (`EXPO_PUBLIC_META_PETAL_ADS=1`, as on the Play test build), not an ad. If the listing must show no
  ad-related UI at all, recapture the Book tab from a build without `EXPO_PUBLIC_META_PETAL_ADS`.
- In Ink Night the Android navigation bar stays light grey under a dark screen (#3, #6, #7). That is how
  the app renders today, not a capture artefact.
- Set B's "Halloween · until 7 Nov" pack is seasonal; a Book capture taken after 7 Nov will look different.

## Checks

- **No ad UI from an ad network in any file.** `EXPO_PUBLIC_META_BANNER` was **unset** in both builds, so
  the menu banner never mounts. macOS Vision OCR of all 12 files (`artifacts/W7-09/ocr/`) found
  **0** "Test Ad" lines. Its positive control, a rejected capture taken while a Google test interstitial
  was on screen, reads "Test Ad". That capture is quarantined in `artifacts/W7-09/rejected/` and is not
  in this folder. No ad was ever tapped; the interstitial was closed with BACK.
- **Test ad units only.** Each APK's Hermes bundle holds Google's test publisher `3940256099942544` and none
  of the owner unit ids 6706292920, 7549521178, 3505414519, 5508761320 or 5754923896 (UTF-8 and UTF-16LE).
  Set A's build logged `[ads] AdMob initialize resolved; adapters=1; unitSet=test` on launch
  (`artifacts/W7-09/logs/normal-A-reactnativejs-after-play.txt`); set B's was not read from logcat (bundle
  proof only). Proofs: `artifacts/W7-09/build/*/proof.txt`.
- **Dense board fully visible** (#2 of set A): the counter reads "209 left" and the level has 209 arrows.
  The ink bounding box is x 105..1326, y 978..2107, inside the board viewport (x 0..1439, y 330..2711) with
  at least 105 px to spare on every side.
- **Perf-build chrome check: failed, so no PERF capture is used.** W7-09 asks for Heart and Cat shots from
  `EXPO_PUBLIC_PERF_LEVEL` builds, provided the perf build's game screen matches the normal build's. A fresh
  level index 0 board was captured in both at the same size, with the status bar rows 0..83 excluded:
  **1,645 changed pixels** (max-channel delta > 24) against P-02's floors (idle board 0 px; blocked-tap gate
  28 px; `docs/perf-capture-calibration.md`). Every changed pixel is inside x 1301..1340, y 174..235: the
  hint button. A PERF build disables ads, so its hint shows as unavailable (dimmed); the normal build loads a
  rewarded test ad and shows it lit. Following the spec, the PERF captures were **not used**. Heart, Cat and
  the dense board were captured from the **normal** build instead, with the save's current level set to
  161, 167 or 137. The rejected PERF captures and the diff are kept in `artifacts/W7-09/rgb/perf-*`, `artifacts/W7-09/rgb/chrome-*` and
  `artifacts/W7-09/logs/chrome-diff*.{json,png}`.

## Reproduce

- **Commit:** `ef56940` on `next-level`, plus the uncommitted W3-15 working tree. Of those changes, only
  `src/ui/gameSessionLifecycle.ts` is in the app bundle, and it runs only in PERF builds.
- **AVD:** `fleet_floor_api31` (API 31, `-gpu host`) on `emulator-5556`, physical 1440x3120 at 560 dpi.
  `wm size` read back as "Physical size: 1440x3120 / Override size: 1440x2880" for every capture
  (`artifacts/W7-09/captures.jsonl`). All three animation scales were 1 (read back), and the app reported
  `perf-reduced-motion-0`.
- **APKs** (local release `assembleRelease`, arm64-v8a, upload-keystore signed, test ads):

| Set | APK sha256 | Build env (everything else unset) |
|---|---|---|
| A | `af9a44672cf7c60c41c8b1245e6907c3afc75e82b30e7ccdff1cf11ca50d43c3` | `EXPO_PUBLIC_ADMOB_TEST_ADS=1 EXPO_PUBLIC_CAPTURE_DIAG=1` |
| B | `e0ce6d6b79096ef6d806492ce642d76dc5a9f4eb4f3886f3838b84005609d185` | `EXPO_PUBLIC_ADMOB_TEST_ADS=1 EXPO_PUBLIC_CAPTURE_DIAG=1 EXPO_PUBLIC_FTUE=1 EXPO_PUBLIC_FTUE_ASSIST=1 EXPO_PUBLIC_META_STREAK_FREEZE=1 EXPO_PUBLIC_META_EXIT_TO_SCREEN_EDGE=1 EXPO_PUBLIC_META_BOARD_GRID=1 EXPO_PUBLIC_META_ZOOMED_CAMERA=1 EXPO_PUBLIC_META_MISSED_MARK=1 EXPO_PUBLIC_META_PRESS_SPRING=1 EXPO_PUBLIC_META_LEVEL_TRANSITION=1 EXPO_PUBLIC_META_PANEL_MOTION=1 EXPO_PUBLIC_META_DAILY=1 EXPO_PUBLIC_META_GALLERY=1 EXPO_PUBLIC_META_REVIEW_PROMPT=1 EXPO_PUBLIC_META_BLOCKED_INK_HOLD=1 EXPO_PUBLIC_META_HEART_REFILL_POP=1 EXPO_PUBLIC_META_THEME_TRANSITION=1 EXPO_PUBLIC_META_POST_CLEAR_TIMELINE=1 EXPO_PUBLIC_META_SETTINGS_SHEET=1 EXPO_PUBLIC_META_SKIN_PICKER=1 EXPO_PUBLIC_META_REWARD_PATH=1 EXPO_PUBLIC_META_REWARD_BOOK=1 EXPO_PUBLIC_META_SEASONS=1 EXPO_PUBLIC_META_PETAL_ADS=1` |

  `EXPO_PUBLIC_CAPTURE_DIAG=1` only adds the accessibility label `perf-reduced-motion-0|1` that the
  capture tooling reads; it draws nothing. No `EXPO_PUBLIC_PERF_*` variable and no `ARROWS_PERF_BUILD` were
  set for either build. `EXPO_PUBLIC_META_BANNER` was unset for both.
- **Scripts** (gitignored, in `artifacts/`): `artifacts/W3-15/build-apk.sh` (build),
  `artifacts/W3-15/prove-apk.py` (bundle proof), `artifacts/W7-09/build-normal.sh` (both sets),
  `artifacts/W7-09/device.py` (install, save fixture, legal-tap solver, capture to 24-bit PNG, demo mode),
  `artifacts/W7-09/chrome-diff.py`, `artifacts/W7-09/ocr/ocr.swift`.
- **Save fixtures:** written into the app's own AsyncStorage table (`catalystLocalStorage`) with the app
  stopped. Set A: `arrows_current_level` / `arrows_total_solved` (17, 137, 161 or 167),
  `arrows_dark_mode` 0 or 1, `arrows_finished_games` 0. Set B: a fresh save with `arrows_ftue_stage` 3,
  `arrows_petals` 30, `arrows_rewards_owned_lo` 21 (the free styles), points and grants 0. The emulator's
  own save was backed up first and restored byte for byte afterwards.
- Every board tap is a legal solve-order tap (`artifacts/W5-04/scripts/plan.ts`), checked against the
  "N left" counter after each batch of 8.

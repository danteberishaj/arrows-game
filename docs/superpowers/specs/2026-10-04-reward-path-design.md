# Reward path: unlock arrow styles by playing (direction A, built for B)

2026-10-04. Status: **design approved in conversation; written spec awaiting owner review.** Nothing is built.

## Why

Arrows is a calm visual-search game (owner ruling 2026-09-16). Measured facts behind this design:
- difficulty barely changes after level 1 (60 arrows at level 1, ~100 at level 1000);
- no new board shapes appear after level 168.

Players have no sense of progress beyond the level number. The owner approved 18 arrow styles (ART-SKINS-08, commit
c6f9b98). Turning them into rewards gives every clear a visible goal. The aim is retention: players come back to
unlock the next style.

**Owner said:**
- Start with direction A, a reward path with no currency.
- Add direction B later: points spent in a collection book. A must not block B.
- Polish themes with Astra, a 3D model tool.
- Sound packs are parked.
- The unlock moment must feel informative, premium and polished, and lead straight into the next level.

**Assumptions:**
- Retention cannot be measured yet: telemetry transport is OFF (`TELEMETRY_TRANSPORT = false`). Success is judged
  by tester feedback and the owner on a phone.
- Perfect-clear rate is unknown, so pacing is stated as a range in levels.

## Scope

**In:**
- earning points;
- the reward catalogue and fixed path;
- saving points and owned rewards;
- the win-panel progress pill;
- the unlock reveal card;
- the locked sections in Settings → Arrow style;
- credit for existing players;
- one feature flag.

Android only, like the picker (`skinPickerEnabled()` requires Android).

**Out (non-goals):**
- spending points or a shop (direction B);
- new skins (Astra themes);
- exit effects and board themes as reward types (the catalogue reserves the `kind` field; no renderer work);
- sound packs;
- telemetry;
- iOS;
- any change to ads, hearts, hints or the daily board itself;
- notifications (rejected 2026-09-16).

## 1. Earning

`registerSolve(perfect)` in `src/core/saveSystem.ts` already runs once per non-tutorial clear (campaign and daily).
The reward ledger hooks there:

| Event | Points |
| --- | ---: |
| Campaign level cleared | +1 |
| Bonus when the clear is perfect (no heart lost; the same `perfect` value `registerSolve` receives) | +1 |
| Daily board cleared (instead of the campaign +1) | +2, plus the perfect bonus |

Rules:
- Tutorial levels and benchmark mode earn nothing; they already skip `registerSolve`.
- Points never decrease.

## 2. Catalogue and path

`src/ui/rewardCatalogue.ts` (pure data):
- Entries are `{ rewardId, kind: 'skin' | 'exit' | 'board', refId, pathCost | null, price | null }`.
- `rewardId` is stable and never reused.
  - Skins use their existing `numericId` (0–17).
  - Future rewards take 18 upward.
- `pathCost: null` means free from the start. `price` stays `null` until direction B.

Free from the start: Classic (0), Sherbet (2), Candy Gloss (4).

The path, in order. Costs are the points needed after the previous unlock. All values are starting values that the
owner may tune; the levels column shows the range from all-perfect clears to no perfect clears.

| # | Reward | Cost | Total | Reached around level |
| --- | --- | ---: | ---: | --- |
| 1 | Critter | 3 | 3 | 2–3 |
| 2 | Cinnamon Roll | 5 | 8 | 4–8 |
| 3 | Jelly | 6 | 14 | 7–14 |
| 4 | Rainbow Ribbon | 8 | 22 | 11–22 |
| 5 | Strawberry Glazed | 8 | 30 | 15–30 |
| 6 | Campfire | 10 | 40 | 20–40 |
| 7 | Yarn | 10 | 50 | 25–50 |
| 8 | Neon Glass | 12 | 62 | 31–62 |
| 9 | Clear Glass | 12 | 74 | 37–74 |
| 10 | Pixel | 13 | 87 | 44–87 |
| 11 | Paper Craft | 14 | 101 | 51–101 |
| 12 | Stained Glass | 15 | 116 | 58–116 |
| 13 | Archery | 15 | 131 | 66–131 |
| 14 | Lava Rock | 15 | 146 | 73–146 |
| 15 | Ink Pro | 15 | 161 | 81–161 |

New rewards (Astra themes, and later exit effects and board themes) are appended to the end at about 15 points each.
When the path is complete, the pill reads "All styles collected · new ones coming soon". Points keep accruing for
direction B.

## 3. Saved data (additive keys; no schema bump)

| Key | Meaning | Rule |
| --- | --- | --- |
| `arrows_reward_points` | Lifetime points earned | Only increases. Absent means not yet initialised. |
| `arrows_rewards_owned_lo` / `_hi` | Owned rewardIds, bits 0–29 and 30–59 | Bits are only ever set, never cleared. Same lo/hi pattern and `sanitizeMask` as `arrows_shapes_seen_*`. |
| `arrows_reward_seen` | Highest path index whose reveal card has been shown | Prevents a repeat reveal after restore or relaunch. |
| `arrows_reward_picker_seen` | Path count already shown in the picker | Drives the "new" dot; set when Settings → Arrow style opens. (Amendment 2026-10-04, from planning.) |

The owned bits are the source of truth:
- A path unlock writes its bit when points cross the threshold.
- If the pacing table is changed in an update, nothing already owned is ever taken away.
- Direction B will set the same bits on purchase.

All writes go through the existing `IntStore` and SAVE-GUARD path:
- if hydrate failed, the ledger is read-only and earns nothing that session (no partial writes);
- new keys join `persistenceKeys` only when the flag is on.

**Android Auto Backup restore:** take the restored values as they are; all three are monotonic. On first read,
reconcile the owned bits up to the restored points.

## 4. Existing players (first launch with the flag on)

When `arrows_reward_points` is absent:
1. Set points to `totalSolved`.
2. Set owned bits for:
   - the free starters;
   - every path reward whose total is ≤ points;
   - the currently selected skin (`arrows_skin`), so a style chosen in builds 11–13 is never locked.
3. Set `arrows_reward_seen` to the highest path index already owned, so credited unlocks are silent and there is no
   reveal flood.

This is one atomic step on first launch. Unit tests cover:
- 0 solved;
- 9 solved, which lands mid-path;
- 300 solved, where everything is owned;
- a selected skin beyond the credited point.

## 5. Screens (approved mockups in `.superpowers/brainstorm/`)

### 5a. Progress pill on the win panel (approved option A)

Under the stars on the "Cleared!" panel:
- a preview of the next reward;
- "Next style: Critter", a progress bar, and "+2 points · 1 more level".

Rules:
- Hidden when the flag is off, during tutorials, or when the path is complete (the "All collected" line shows
  instead).
- The levels-remaining figure assumes +1 per level, so it never over-promises.

### 5b. Unlock reveal card (approved option A, revised)

Shown over the win panel when this clear crossed a threshold and `arrows_reward_seen` is below that index.

Contents:
- a "NEW STYLE UNLOCKED" badge;
- a preview stage: the real skin preview drawn by the picker's thumbnail component, on the skin's board tint, with
  three sparkles;
- the name;
- "Style N of 18 · unlocked on level L" (or "· unlocked on today's daily"; amended 2026-10-04: there is no clears-since-unlock counter);
- three short feature chips taken from catalogue data;
- a primary button and a secondary button;
- "Up next: <reward> · <levels>".

Buttons:

| Button | Campaign clear | Daily clear |
| --- | --- | --- |
| Primary | "Play with <name>": selects the style (through the existing arrow-style writer), then runs the existing `onNextLevel` | "Use <name>": selects it, then runs the existing daily "Done" |
| Secondary | "Keep current style · Next level": runs the same next-level flow without selecting | Runs Done without selecting |

Sequencing and safety:
- The paced interstitial, the level scrim and the review flow keep their existing order after the card closes.
- The card never shows over an ad.
- If the store-review ask would fire on the same clear, the reveal goes first and the review ask is skipped for
  this clear, waiting for its next eligible clear under the existing policy.
- Feel: the card enters with the existing panel motion (scale 0.94 → 1, fade). The sparkles twinkle once, about
  600 ms. With reduced motion, the card appears without scale or sparkles.
- `arrows_reward_seen` is written when the card is shown. If the app is killed mid-card, it does not repeat; the
  style is already owned, and the "new" dot in the picker covers it.
- If two thresholds are crossed in one clear (possible only after a restore), show one card for the highest; the
  rest show "new" in the picker.

### 5c. Settings → Arrow style (approved option B)

The sheet has two sections:

| Section | Contents |
| --- | --- |
| "Your styles" | Owned styles in path order, with the count "N of 18" |
| "Coming up" | The next reward in full colour, with its bar and "Next · K levels"; the rest dimmed with a lock, showing "After <previous>" for the one after the next and "Later" beyond that |

Rules:
- A locked row is not selectable. Tapping it shows "Clear K more levels to unlock".
- A newly owned style shows a small "new" dot until the sheet is opened.
- Accessibility: locked rows are announced as "Critter, locked, unlocks in 3 levels".
- Contrast: rows join the existing `contrastAudit` picker rows; dimmed rows keep text at the existing `inkDim` role.
- With the flag off, the sheet is exactly today's list, with every style available.

## 6. Flag and rollout

- `EXPO_PUBLIC_META_REWARD_PATH`, default OFF, and only effective when `skinPickerEnabled()` is also true.
- With it off:
  - no reward key is read or written;
  - the win panel, picker and save behave exactly as today.
- Turning it on later credits progress from `totalSolved` (section 4), so nothing is lost by shipping it off first.

## 7. Content pipeline (for later reward rounds, recorded here so A doesn't block it)

For each new theme:
1. Astra renders a polished concept.
2. The owner picks.
3. Codex translates the concept into `skinSpecs.ts` data on the general renderer.
4. The existing contract runs (K1–K8, contrast, direction legibility).
5. The owner approves a contact sheet.
6. The theme is appended to the path with a new `rewardId`.

Astra renders may also be used:
- as the reveal card's preview stage image;
- in store screenshots.

They are never used as board art: image-based arrows were rejected in ART-SKINS-01.

## 8. Verification (what the review will re-run)

Each check exercises the path it covers.

**Unit (jest):**
- earning table;
- threshold crossing, including exact boundaries;
- never-revoke after a cost-table change;
- credit for existing players (section 4 cases);
- SAVE-GUARD read-only session;
- restore reconciliation;
- daily +2;
- tutorial and benchmark earn 0;
- flag off: zero reward-key reads or writes.

**Component (RNTL):**
- pill text and visibility rules;
- reveal card buttons for campaign and daily;
- card before interstitial and review;
- the locked row is not selectable and shows its hint;
- "Your styles" and "Coming up" ordering.

**Contrast:** new rows in `contrastAudit` pass the existing thresholds in both themes.

**Device (emulator-5556, test-ads build, picker + reward flags on), with screenshots or recording for the owner:**
- fresh save:
  - first unlock (Critter) by level 3;
  - "Play with Critter" starts the next level in Critter;
- existing save (install over a vc13-era save with 10 solved and Cinnamon selected):
  - credited silently;
  - Cinnamon still selected and owned;
  - no reveal flood;
- dark and light themes;
- reduced motion: no sparkles or scale;
- an interstitial-due clear: card, then ad, then next level, in that order;
- flag off: picker and win panel identical to today.

A real-ads AAB is handed over only after the test-ads twin of the same commit has passed this run.

## 9. Open numbers

- The cost table is a starting value and lives in one data file.
- Testers' "too slow / too fast" answers tune it; nothing structural changes.

# Collection book: spend petals on any arrow style (direction B)

2026-10-04. Status: **design approved in conversation; written spec awaiting owner review.** Nothing is built.
It builds on the reward path (direction A): spec `2026-10-04-reward-path-design.md`, code `680370b` + `79d4d7d`.

## Why

Direction A unlocks styles in a fixed order. The owner chose **choice** as the purpose of B: players can buy the style
they love early, while the path keeps giving free styles.

**Owner rulings, 2026-10-04:**
- Petals earn at the same rate as path points.
- Three price tiers.
- The path skips styles you already own.
- Every player gets a 10-petal welcome gift.
- Layout B: two tabs, with the book as an album grid.
- Buying always goes through a confirm step.
- **No rewarded ads for petals** (owner: "no rewarded ads for now").

**Assumption:** retention cannot be measured yet (telemetry is off). Prices are starting values, tuned from tester
feedback.

## Scope

**In:**
- the petal balance and earning;
- prices;
- buying, with a confirm step;
- the path skipping owned styles;
- the welcome gift;
- the "Your styles" / "Book" tabs in Settings → Arrow style;
- a petal mark on the win-panel pill;
- one feature flag.

Android only, like A.

**Out (non-goals):**
- rewarded ads or any new ad placement;
- real-money purchases;
- selling back or refunds;
- new skins, exit effects or board themes (they can join the book later as catalogue entries);
- price editing in-app;
- telemetry;
- iOS;
- changes to hearts, hints, the daily board or ads.

## 1. Petals

- Every clear earns petals equal to the path points it earns: campaign +1, daily +2, +1 more when perfect.
- Tutorials and benchmark mode earn none, exactly as for points.
- Petals are spent only on the book. Spending never changes lifetime points, so the path never slows down.
- **Welcome gift:** the first time the book is enabled for a save, the balance starts at 10. This covers new and
  existing players alike, so everyone can buy one near-tier style at once.

## 2. Prices (OWNER-APPROVED STARTING VALUES)

Prices go in the catalogue's existing `price` field, by position on the path:

| Tier | Path positions | Styles | Price |
| --- | --- | --- | ---: |
| Near | 1–5 | Critter, Cinnamon Roll, Jelly, Rainbow Ribbon, Strawberry Glazed | 10 |
| Middle | 6–10 | Campfire, Yarn, Neon Glass, Clear Glass, Pixel | 20 |
| Late | 11–15 | Paper Craft, Stained Glass, Archery, Lava Rock, Ink Pro | 35 |

Free styles (Classic, Sherbet, Candy Gloss) have no price and are always owned.

## 3. The path with purchases (amends direction A)

- The path is a sequence of **steps**, each with the cost from A's table. The points thresholds are unchanged.
- Each step crossed **grants the next style on the path that the player does not own yet**, in path order. A bought
  style is skipped, so every step always gives something new.
- `levelsToNext` and the pill use the next step's threshold; "next style" is the first unowned path style.
- In the book, a style's ETA is computed from its rank among unowned path styles:
  `PATH_TOTALS[grants + rank] − points`. When it is beyond the last step, the copy is "Not on the path" (only when
  every later step is already used).
- **Effect on A:** A has never shipped in a public build. Its one edge case changes: a style that was selected before
  the path existed is now skipped by the path (the player gets the next style instead of a silent reach). A's test for
  that case is updated to the new, more generous rule.

## 4. Saved data (additive; no schema bump)

| Key | Meaning | Rule |
| --- | --- | --- |
| `arrows_petals` | Spendable balance | Absent means "book never enabled": set it to 10 once. Never negative. |
| `arrows_path_grants` | Path steps already granted | Only increases. Absent means set it to A's reached count (A granted exactly those). |

Existing keys keep their meaning:
- `arrows_rewards_owned_*` holds path grants and purchases alike, and is never cleared;
- `arrows_reward_points` stays the lifetime total;
- `arrows_reward_seen` counts grants (unchanged meaning, since grants are sequential).
- **Amended 2026-10-04 (BOOK-01):** `arrows_reward_picker_seen` becomes legacy. It is read once to migrate A-era saves and never written again. The picker's "new" dot uses new keys `arrows_rewards_new_lo` / `_hi` (a mask of granted styles not yet seen), because purchases make "step index = style" untrue.

Further rules:
- Reconcile on load: while `grants < stepsReached(points)`, grant the next unowned path style **silently**, mark
  reveals seen and increment `grants`.
- A purchase writes the owned bit and the new balance in the same tick. The store coalesces both into one native
  write batch.
- If the bit write ever happened without the balance write, the player keeps the style and the petals (fail
  generous).
- SAVE-GUARD: when the hydrate failed, the book is read-only. Buy buttons are disabled, with the line "Buying is paused right now", and nothing is written.
- `arrows_path_grants` is persisted whenever the in-memory count changes, including a step crossed while every path style is already owned (it grants nothing, but the step is used).
- Android Auto Backup restore: take the values as they are, then reconcile.

## 5. Screens (approved mockups: `.superpowers/brainstorm/…/book-layout.html`, option B)

### 5a. Settings → Arrow style

**Header:** the title "Arrow style", then a petal mark and "{n} petals". The mark is a small flower icon, drawn as
SVG, not an emoji.

**Segmented control:** "Your styles · {owned}" | "Book · {unowned}". It defaults to "Your styles" every time the
sheet opens.

**"Your styles" tab:**
- the owned styles as radio rows, as in A;
- at the bottom, one line: "Next free style: {name} · {k} level(s)". Tapping it switches to the Book tab.

**"Book" tab:**
- a 3-column grid of unowned styles in path order;
- each tile shows the preview (dimmed, except the next-free tile), the name and the price with the petal mark;
- the next-free tile is outlined (dashed, accent) and shows "free in {k}";
- prices the player cannot afford yet are shown in `inkDim`; the tile stays tappable;
- when the book is empty: "All styles collected · new ones coming soon".

**Contrast:** all new text joins `contrastAudit` and meets 4.5:1 (3:1 for large text) in both themes.

**Accessibility:**
- tiles are buttons labelled "{name}, {price} petals" or "{name}, {price} petals, free in {k} levels";
- tabs use `accessibilityRole="tab"` with the selected state;
- the petal balance is announced as "{n} petals".

### 5b. Buy confirm (replaces the sheet content, like today's picker sub-screen)

- A large preview (the same `StylePreview` size as the reveal card).
- The name.
- "On the path in {k} levels · or get it now" (or "Not on the path" as above).
- The primary "Buy for {price} petals" and the line "You'll have {balance − price} left".
- The secondary "Not now", which returns to the Book.
- **Cannot afford:** the primary is disabled and the line reads "You need {price − balance} more petals". Nothing is
  spent.
- **Bought:**
  - a success haptic (existing `haptics.ts` success);
  - an outlined badge "ADDED TO YOUR STYLES" (same outline style as the reveal badge);
  - "{N} of 18 styles collected";
  - the primary "Use it now" selects the style and returns to "Your styles";
  - the secondary "Back to the book";
  - a screen-reader announcement "{name} added to your styles".
- Motion: only the preview's spring pop, as on the reveal card (scale only, `ReduceMotion.System`, none under reduced
  motion). No new opacity animation.

### 5c. Win panel

- When the book is on, the pill's "+{n}" shows the petal mark beside it, because petals are what the player can spend.
- The reveal card is unchanged. It shows whichever style the step granted.

## 6. Flag and rollout

- `EXPO_PUBLIC_META_REWARD_BOOK`, default OFF, effective only when `rewardPathEnabled()` is true.
- With it off:
  - no petal key is read or written;
  - A behaves exactly as committed, except for the §3 skip rule, which is safe for A as it only matters once a style
    is owned out of path order.
- Turning it on later: the welcome gift applies once; petals then accrue from that point. There are no retroactive
  petals.

## 7. Verification (what the review will re-run)

**Unit:**
- petals equal points per clear;
- the welcome gift fires once only;
- the price table;
- a purchase deducts and grants, and cannot overdraw;
- the path skips owned styles, including a purchase of the very next style;
- grants migration from A-era saves;
- reconcile is silent;
- SAVE-GUARD read-only;
- flag off: zero petal-key reads or writes;
- ETA ranks are correct after a purchase.

**Component:**
- the tabs and their counts;
- grid order and next-free outline;
- unaffordable state;
- the confirm and bought screens;
- "Use it now" selects;
- the announcements;
- the 48 dp targets.

**Contrast:** new rows in both themes.

**Device (emulator-5556, test-ads build, picker + path + book on):**
- buy a near-tier style with the welcome gift;
- confirm the path then skips it on the next step;
- check the unaffordable confirm;
- check dark mode;
- check reduced motion;
- flag off is unchanged.

The owner has previously allowed skipping the device step for small polish. This feature is new behaviour, so the
device run is required.

## 8. Open numbers

- The three prices and the welcome gift are starting values in one data file.
- Testers' answers on "too cheap / too dear" tune them; nothing structural changes.

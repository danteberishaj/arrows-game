# Collection Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **In this repo:** Codex implements in the working tree and never commits. Every "Checkpoint" means "stop and leave it uncommitted". The controller (Claude) reviews and commits.

**Goal:** Players earn petals with every clear and spend them in a "Book" tab to buy any locked arrow style early. The
reward path keeps granting free styles and skips any style already owned. Everything is behind
`EXPO_PUBLIC_META_REWARD_BOOK` (default OFF).

**Architecture:**
- **Pure path helpers:** `src/core/rewardPath.ts` gains granting the next unowned style and ETA by rank.
- **Ledger:** `src/ui/rewardLedger.ts` (already react-native-free) changes from "path index = reward" to:
  - **steps granted** (`arrows_path_grants`), each step granting the next unowned style;
  - a **new-style mask** for the picker dot;
  - a **petal balance**;
  - `buyReward`.
- **UI:**
  - a small `PetalIcon`;
  - a tabbed mode in `ArrowStyleOptions` (`Your styles` | `Book`);
  - the grid and confirm/bought screens in a new `src/ui/CollectionBook.tsx`.
- **Win panel:** the pill gains the petal mark; the reveal card reads its "Up next" from the ledger.

**Tech Stack:** Expo SDK 57 / React Native 0.86.3, TypeScript, jest (Node ts-jest project for `*.test.ts`, jest-expo
for `*.test.tsx`), @testing-library/react-native, react-native-svg, react-native-reanimated, expo-haptics via
`src/ui/haptics.ts`.

**Spec:** `docs/superpowers/specs/2026-10-04-collection-book-design.md` (owner-approved 2026-10-04). Read it first; the
spec wins over this plan. It amends `docs/superpowers/specs/2026-10-04-reward-path-design.md`. The current reward code
is commits `680370b` and `79d4d7d`; read `src/ui/rewardLedger.ts`, `src/ui/ArrowStyleOptions.tsx`,
`src/ui/RewardRevealCard.tsx` and `src/ui/RewardProgressPill.tsx` before Task 1.

## Global Constraints

- Read `AGENTS.md`, `docs/engineering-lessons.md` and the Expo v57 docs before coding. Node v20.19.4 in every shell:
  `export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH`.
- Flag:

  ```ts
  export const META_REWARD_BOOK = process.env.EXPO_PUBLIC_META_REWARD_BOOK === '1';
  ```

  Gate: `rewardBookEnabled() = META_REWARD_BOOK && rewardPathEnabled()`, in `src/ui/rewardGate.ts`. With it off:
  - no `arrows_petals` read or write;
  - the picker is today's reward-path layout ("Your styles" / "Coming up");
  - the pill shows no petal mark.
- **Path skip rule (spec §3), active whenever the reward path is on, book or not:** step `s` (0-based) unlocks at
  `PATH_TOTALS[s]` points and grants the first path style the player does not own yet, in `REWARD_PATH` order.
- Saved keys:

  | Key | Kind | Rule |
  | --- | --- | --- |
  | `arrows_path_grants` | new, path | Steps granted; only increases. Absent means migrate to A's reached count. |
  | `arrows_rewards_new_lo` / `_hi` | new, path | Granted styles not yet seen in the picker; replaces the step-count meaning of `arrows_reward_picker_seen`. **Plan amendment to spec §4**, needed because purchases make "step index = style" false. |
  | `arrows_petals` | new, book | Absent means set it to 10 once (welcome gift). Never negative. |

  `arrows_reward_picker_seen` is read once for migration only and never written again.
- Earning: petals per clear equal points per clear (campaign 1, daily 2, +1 perfect). Tutorials and benchmark earn 0.
- Prices (spec §2) on the catalogue's `price`: path positions 1–5 cost 10, 6–10 cost 20, 11–15 cost 35. Free styles
  have `price: null`.
- Copy, exactly:
  - "{n} petals" (1 → "1 petal")
  - "Your styles · {n}"
  - "Book · {n}"
  - "Next free style: {name} · {k} level(s)"
  - "free in {k}"
  - "All styles collected · new ones coming soon"
  - "On the path in {k} level(s) · or get it now"
  - "Not on the path"
  - "Buy for {price} petals"
  - "You'll have {n} left"
  - "You need {n} more petal(s)"
  - "Not now"
  - "ADDED TO YOUR STYLES"
  - "{N} of 18 styles collected"
  - "Use it now"
  - "Back to the book"
  - "Buying is paused right now"
- Accessibility:
  - tiles are buttons labelled "{name}, {price} petals" plus ", free in {k} levels" for the next free style;
  - tabs use `accessibilityRole="tab"` with `accessibilityState={{ selected }}`;
  - after a purchase, announce "{name} added to your styles";
  - all touch targets are ≥ 48 dp.
- Motion: only the confirm and bought screens' preview spring pop, copied from `RewardRevealCard` (scale 0.92 → 1,
  `withSpring` with `reduceMotion: ReduceMotion.System`, none under reduced motion). No opacity animation.
- No emoji for the petal: draw the `PetalIcon` SVG.
- `contrastAudit.ts` pins `file:line` sites; move pointers after every edit to a pinned file and add rows for new text.
- Hard rules:
  - no commits, push or eas;
  - emulator-5556 only;
  - test-ads builds only on the emulator, with the bundle id proof before install;
  - `df -h /` ≥ 5 GB before gradle;
  - `install -r -d`, never uninstall;
  - back up and restore the emulator save;
  - restore any changed device settings;
  - append to `docs/engineering-lessons.md` only at the end (it holds another session's uncommitted note near the top:
    preserve it byte-for-byte).

## Review Focus

1. **Buying the very style the path would grant next.** Expect: the next step then grants the following unowned
   style, not nothing. Test owner: Task 3.
2. **A purchase with not enough petals, or in a read-only (failed hydrate) session.** Expect: nothing spent or granted,
   and `buyReward` returns `'insufficient'` or `'unavailable'`. Test owner: Task 3.
3. **A-era save (reward keys present, no grants or petals keys).** Expect: grants = steps already reached; the new-mask
   is seeded from the old picker-seen count; 10 petals once; no reveal flood. Test owner: Task 3.
4. **Book on but path complete.** Expect: the Book tab shows "All styles collected · new ones coming soon"; petals keep
   accruing; nothing crashes on `next = null`. Test owner: Tasks 3 and 6.
5. **Double tap on "Buy".** Expect: one purchase only (the second call sees the bit owned and returns `'owned'`).
   Test owner: Task 3, plus a component test in Task 6.

---

### Task 1: Flag, gate and pure path helpers

**Files:**
- Modify: `src/featureFlags.ts` (after `META_REWARD_PATH`), `src/__tests__/featureFlags.test.ts` (add `'META_REWARD_BOOK'`)
- Modify: `src/ui/rewardGate.ts`
- Modify: `src/core/rewardPath.ts`
- Test: `src/core/__tests__/rewardPath.test.ts` (append)

**Interfaces:**
- Produces:
  - `rewardBookEnabled(): boolean` (in `rewardGate.ts`)
  - `grantNext(owned: OwnedMasks, pathIds: readonly number[]): { owned: OwnedMasks; granted: number | null }`
  - `unownedPath(owned: OwnedMasks, pathIds: readonly number[]): number[]`
  - `etaForRank(points: number, totals: readonly number[], grants: number, rank: number): number | null`

- [ ] **Step 1: Write the failing test** (append to `src/core/__tests__/rewardPath.test.ts`)

```ts
import { etaForRank, grantNext, unownedPath } from '../rewardPath';

const IDS = [6, 1, 5, 12];

test('grantNext gives the first unowned path id and skips owned ones', () => {
  const none = { lo: 0, hi: 0 };
  const a = grantNext(none, IDS);
  expect(a.granted).toBe(6);
  const bought = { lo: (1 << 6) | (1 << 1), hi: 0 }; // Critter granted, Cinnamon bought
  expect(grantNext(bought, IDS).granted).toBe(5);
  const all = IDS.reduce((m, id) => ({ lo: m.lo | (1 << id), hi: 0 }), none);
  expect(grantNext(all, IDS)).toEqual({ owned: all, granted: null });
});

test('unownedPath keeps path order', () => {
  expect(unownedPath({ lo: 1 << 1, hi: 0 }, IDS)).toEqual([6, 5, 12]);
});

test('etaForRank uses the step after the grants already made', () => {
  const totals = [3, 8, 14, 22];
  expect(etaForRank(4, totals, 1, 0)).toBe(4);   // next step total 8
  expect(etaForRank(4, totals, 1, 1)).toBe(10);  // step after: 14
  expect(etaForRank(4, totals, 1, 3)).toBeNull(); // beyond the last step: "Not on the path"
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/core/__tests__/rewardPath.test.ts`
Expected: FAIL (missing exports `grantNext`, `unownedPath`, `etaForRank`)

- [ ] **Step 3: Implement**

Append to `src/core/rewardPath.ts`:

```ts
import { hasSeen, markSeen } from './collection';
import type { ShapeMasks as OwnedMasks2 } from './collection';

/** Book spec §3: a path step grants the first path id not owned yet; null when every path id is owned. */
export function grantNext(owned: OwnedMasks2, pathIds: readonly number[]): { owned: OwnedMasks2; granted: number | null } {
  const id = pathIds.find(candidate => !hasSeen(owned, candidate));
  return id === undefined ? { owned, granted: null } : { owned: markSeen(owned, id), granted: id };
}

export function unownedPath(owned: OwnedMasks2, pathIds: readonly number[]): number[] {
  return pathIds.filter(id => !hasSeen(owned, id));
}

/** Levels (at +1 each) until the step that would grant the `rank`-th unowned path style; null when past the last step. */
export function etaForRank(points: number, totals: readonly number[], grants: number, rank: number): number | null {
  const step = grants + rank;
  return step >= totals.length ? null : Math.max(0, totals[step] - safePoints(points));
}
```

Put the import at the top of the file next to the existing type re-export. The second type alias only avoids a name
clash with the re-export; use one alias if TypeScript allows it.

Add the flag in `src/featureFlags.ts`:

```ts
/**
 * COLLECTION-BOOK (spec 2026-10-04): petals from clears buy any locked arrow style early.
 * Effective only when the reward path is on (src/ui/rewardGate.ts rewardBookEnabled).
 * OFF: no petal key is read or written; the picker keeps the reward-path layout.
 */
export const META_REWARD_BOOK = process.env.EXPO_PUBLIC_META_REWARD_BOOK === '1';
```

Add the gate in `src/ui/rewardGate.ts`:

```ts
import { META_REWARD_BOOK } from '../featureFlags';
export function rewardBookEnabled(): boolean { return META_REWARD_BOOK && rewardPathEnabled(); }
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/core/__tests__/rewardPath.test.ts src/__tests__/featureFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 2: Prices in the catalogue

**Files:**
- Modify: `src/ui/rewardCatalogue.ts`
- Test: `src/ui/__tests__/rewardCatalogue.test.ts` (append)

**Interfaces:**
- Produces:
  - `REWARD_PATH[i].price`: 10, 20 or 35 by tier;
  - free entries keep `price: null`;
  - `REWARD_PATH_IDS: readonly number[]` (path rewardIds in order).

- [ ] **Step 1: Write the failing test**

```ts
import { REWARD_PATH_IDS } from '../rewardCatalogue';

test('book prices by path tier: 10 / 20 / 35; free styles have no price', () => {
  expect(REWARD_PATH.map(e => e.price)).toEqual([10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 35, 35, 35, 35, 35]);
  expect(REWARD_CATALOGUE.filter(e => e.pathCost === null).every(e => e.price === null)).toBe(true);
  expect(REWARD_PATH_IDS).toEqual(REWARD_PATH.map(e => e.rewardId));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/rewardCatalogue.test.ts`
Expected: FAIL (prices are null; `REWARD_PATH_IDS` is undefined)

- [ ] **Step 3: Implement**

In `rewardCatalogue.ts`:

```ts
/** OWNER-APPROVED STARTING VALUES (book spec §2): price by path position. */
function priceForPosition(index: number): number { return index < 5 ? 10 : index < 10 ? 20 : 35; }
```

Build `REWARD_PATH` as `PATH.map(([id, cost, chips], i) => ({ ...skinEntry(id, cost, chips), price: priceForPosition(i) }))`, then:

```ts
export const REWARD_PATH_IDS: readonly number[] = REWARD_PATH.map(e => e.rewardId);
```

Update the `price` doc comment to "Collection book price (petals); null for free styles."

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/rewardCatalogue.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 3: Ledger — steps granted, skip rule, new-mask, petals, buying, wiring

**Files:**
- Modify: `src/ui/rewardLedger.ts` (rewrite of the path parts; keep its public names where listed below)
- Modify: `src/ui/storage.ts`, `App.tsx`, `src/ui/__tests__/gameSessionLifecycle.test.ts` (W3-05 anchor only)
- Test: `src/ui/__tests__/rewardLedger.test.ts` (update and append), `src/ui/__tests__/storage.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (exact):
  - `REWARD_KEYS` adds `arrows_path_grants`, `arrows_rewards_new_lo` and `arrows_rewards_new_hi`.
  - `BOOK_KEYS: readonly string[] = ['arrows_petals']`.
  - `initializeRewardLedger(store, enabled, opts: { writable: boolean; totalSolved: number; selectedNumericId: number; book: boolean })`.
  - `RewardState`:
    - `points: number`
    - `owned: OwnedMasks`
    - `reachedIndex: number` (steps reached = steps granted after reconcile)
    - `next: RewardEntry | null` (first unowned path style)
    - `levelsToNext: number | null`
    - `progress: number`
    - `newMask: OwnedMasks`
    - `petals: number | null` (null when the book is off)
  - `pickerSeenIndex` is **removed**. The picker uses `isRewardNew(rewardId)`.
  - `ClearReward.unlock`: `{ entry: RewardEntry; pathIndex: number /* step index */; ownedSkins: number; upNext: { entry: RewardEntry; levels: number } | null }`.
  - `isRewardOwned(rewardId)`, `isRewardNew(rewardId): boolean`.
  - `etaFor(rewardId): number | null` (null when not on the path or past the last step).
  - `type BuyResult = 'bought' | 'owned' | 'insufficient' | 'unavailable'`, and `buyReward(rewardId: number): BuyResult`.
  - `markRevealSeen(stepIndex)` and `markPickerSeen()` (clears the new-mask).

- [ ] **Step 1: Write the failing tests**

Update `src/ui/__tests__/rewardLedger.test.ts`. Keep the existing "restore/cost change: bits behind points are reconciled up silently" test passing unchanged; the A-era migration branch must still mark path entries [0, reached) owned.
- every `initializeRewardLedger(…, { … })` call gains `book: false` unless stated;
- assertions on `arrows_reward_picker_seen` become new-mask assertions;
- the test "a style selected before the path: earlier reveals still show, its own reach is silent" is **replaced** by
  the skip-rule test below (spec §3, effect on A).

Then append:

```ts
const PET = 'arrows_petals';
import { REWARD_PATH_IDS } from '../rewardCatalogue';

test('skip rule: a style owned before the path is skipped, every step grants something new', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow, book: false });
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('critter'); // step 0 at 3
  L.markRevealSeen(0);
  for (let i = 0; i < 18; i++) L.recordRewardClear('campaign', false); // 21: steps 1,2 -> cinnamon, jelly
  const r = L.recordRewardClear('campaign', false)!; // 22: step 3 -> NOT rainbow (owned) -> strawberry
  expect(r.unlock?.entry.refId).toBe('strawberry-glazed');
});

test('book off: no petal key is read or written', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: false });
  L.recordRewardClear('campaign', true);
  expect([...s.reads, ...s.writes].filter(k => k === PET)).toEqual([]);
  expect(L.getRewardState()!.petals).toBeNull();
});

test('welcome gift: 10 petals once; clears add petals equal to points', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(s.m.get(PET)).toBe(10);
  L.recordRewardClear('daily', true); // +3
  expect(L.getRewardState()!.petals).toBe(13);
  const L2 = load(); // relaunch over the same store: no second gift
  L2.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L2.getRewardState()!.petals).toBe(13);
});

test('buying deducts, grants and cannot overdraw or double-buy', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.rainbow)).toBe('bought'); // 10 -> 0
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
  expect(L.getRewardState()!.petals).toBe(0);
  expect(L.buyReward(SKIN.rainbow)).toBe('owned');
  expect(L.buyReward(SKIN.jelly)).toBe('insufficient');
  expect(L.isRewardOwned(SKIN.jelly)).toBe(false);
  expect(L.buyReward(0)).toBe('owned'); // Classic is free/owned
});

test('buying the very next style: the next step grants the one after it', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.critter)).toBe('bought');
  expect(L.getRewardState()!.next?.refId).toBe('cinnamon');
  L.recordRewardClear('campaign', true); // 2
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('cinnamon'); // step 0 at 3
});

test('read-only session: buying is unavailable and writes nothing', () => {
  const L = load(); const s = new Mem();
  s.m.set(PET, 50);
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.buyReward(SKIN.jelly)).toBe('unavailable');
  expect(s.writes).toEqual([]);
});

test('A-era save migrates: grants = steps reached, new-mask from picker-seen, 10 petals, no reveal flood', () => {
  const L = load(); const s = new Mem();
  s.m.set('arrows_reward_points', 14);               // steps 0..2 reached (3, 8, 14)
  s.m.set('arrows_rewards_owned_lo', (1 << 0) | (1 << 2) | (1 << 4) | (1 << 6) | (1 << 1) | (1 << 5));
  s.m.set('arrows_reward_seen', 3);
  s.m.set('arrows_reward_picker_seen', 2);           // Jelly (step 2) not yet seen in the picker
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 99, selectedNumericId: 0, book: true });
  expect(s.m.get('arrows_path_grants')).toBe(3);
  expect(L.isRewardNew(SKIN.jelly)).toBe(true);
  expect(L.isRewardNew(SKIN.cinnamon)).toBe(false);
  expect(L.getRewardState()!.petals).toBe(10);
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull(); // 15 points: no step
});

test('etaFor ranks unowned path styles after the grants already made', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 4, selectedNumericId: 0, book: true }); // step 0 granted (critter)
  expect(L.etaFor(SKIN.cinnamon)).toBe(4);  // 8 - 4
  expect(L.etaFor(SKIN.jelly)).toBe(10);    // 14 - 4
  L.buyReward(SKIN.cinnamon);
  expect(L.etaFor(SKIN.jelly)).toBe(4);     // jelly is now rank 0
  expect(L.etaFor(0)).toBeNull();           // Classic: not on the path
});

test('a step crossed with every path style owned is still persisted (grants never lag behind)', () => {
  const L = load(); const s = new Mem();
  s.m.set(PET, 999);
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  for (const id of REWARD_PATH_IDS) L.buyReward(id);
  L.recordRewardClear('campaign', true); // 2
  L.recordRewardClear('campaign', false); // 3: step 0 crossed, nothing left to grant
  expect(s.m.get('arrows_path_grants')).toBe(1);
});

test('canBuy is false in a read-only session and true when writable with the book on', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L.getRewardState()!.canBuy).toBe(false);
  const L2 = load();
  L2.initializeRewardLedger(new Mem(), true, { writable: true, totalSolved: 0, selectedNumericId: 0, book: true });
  expect(L2.getRewardState()!.canBuy).toBe(true);
});

test('complete path with the book on: next is null, petals keep accruing', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 300, selectedNumericId: 0, book: true });
  expect(L.getRewardState()!.next).toBeNull();
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull();
  expect(L.getRewardState()!.petals).toBe(11);
});
```

Append to `storage.test.ts`: with `initSaveSystem(true, true, false)`, `multiGet` must not receive `arrows_petals`.
With `initSaveSystem(true, true, true)`, it must.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/ui/__tests__/rewardLedger.test.ts src/ui/__tests__/storage.test.ts`
Expected: FAIL (new exports and fields are missing; the skip rule is not implemented)

- [ ] **Step 3: Implement the ledger**

Replace the path logic in `src/ui/rewardLedger.ts` with this shape. Keep the file react-native-free.

```ts
import type { IntStore } from '../core/saveSystem';
import { hasSeen, markSeen, sanitizeMask } from '../core/collection';
import { etaForRank, grantNext, levelsToNext, pathIndexReached, pointsForClear, progressToNext, unownedPath,
  type ClearKind, type OwnedMasks } from '../core/rewardPath';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_CATALOGUE, REWARD_PATH, REWARD_PATH_IDS, type RewardEntry } from './rewardCatalogue';
import { ARROW_STYLES } from './skinSpecs';

const POINTS = 'arrows_reward_points';
const OWNED_LO = 'arrows_rewards_owned_lo';
const OWNED_HI = 'arrows_rewards_owned_hi';
const SEEN = 'arrows_reward_seen';
const PICKER_SEEN = 'arrows_reward_picker_seen'; // legacy: read once for migration
const GRANTS = 'arrows_path_grants';
const NEW_LO = 'arrows_rewards_new_lo';
const NEW_HI = 'arrows_rewards_new_hi';
const PETALS = 'arrows_petals';
const WELCOME_PETALS = 10; // OWNER-APPROVED STARTING VALUE (book spec §1)

export const REWARD_KEYS: readonly string[] = [POINTS, OWNED_LO, OWNED_HI, SEEN, PICKER_SEEN, GRANTS, NEW_LO, NEW_HI];
export const BOOK_KEYS: readonly string[] = [PETALS];

export interface RewardState {
  points: number; owned: OwnedMasks; reachedIndex: number; next: RewardEntry | null;
  levelsToNext: number | null; progress: number; newMask: OwnedMasks; petals: number | null;
  /** Book on AND the save is writable (SAVE-GUARD). The Buy button is disabled when false. */
  canBuy: boolean;
}
export interface ClearReward {
  earned: number;
  unlock: { entry: RewardEntry; pathIndex: number; ownedSkins: number;
    upNext: { entry: RewardEntry; levels: number } | null } | null;
}
export type BuyResult = 'bought' | 'owned' | 'insufficient' | 'unavailable';

let store: IntStore | null = null;
let writable = false;
let grants = 0;
let state: RewardState | null = null;
const listeners = new Set<() => void>();

const count = (v: number) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
const masks = (lo: string, hi: string): OwnedMasks =>
  ({ lo: sanitizeMask(store!.getInt(lo, 0)), hi: sanitizeMask(store!.getInt(hi, 0)) });
const entryById = (id: number) => REWARD_CATALOGUE.find(e => e.rewardId === id)!;
const ownedSkins = (owned: OwnedMasks) => ARROW_STYLES.filter(s => hasSeen(owned, s.numericId)).length;

function snapshot(points: number, owned: OwnedMasks, newMask: OwnedMasks, petals: number | null): RewardState {
  const nextId = unownedPath(owned, REWARD_PATH_IDS)[0];
  const stepsLeft = grants < PATH_TOTALS.length;
  return { points, owned, reachedIndex: grants, newMask, petals, canBuy: writable && petals !== null,
    next: nextId === undefined || !stepsLeft ? null : entryById(nextId),
    levelsToNext: nextId === undefined ? null : levelsToNext(points, PATH_TOTALS),
    progress: progressToNext(points, PATH_TOTALS) };
}
function publish(next: RewardState | null): void { state = next; listeners.forEach(l => l()); }
function write(owned: OwnedMasks, newMask: OwnedMasks): void {
  store!.setInt(OWNED_LO, owned.lo); store!.setInt(OWNED_HI, owned.hi);
  store!.setInt(NEW_LO, newMask.lo); store!.setInt(NEW_HI, newMask.hi);
  store!.setInt(GRANTS, grants);
}
/** Grant every step `points` has reached; returns the granted ids in order. */
function grantSteps(points: number, owned: OwnedMasks, newMask: OwnedMasks) {
  const granted: { id: number; step: number }[] = [];
  const reached = pathIndexReached(points, PATH_TOTALS);
  while (grants < reached) {
    const g = grantNext(owned, REWARD_PATH_IDS);
    if (g.granted !== null) { owned = g.owned; newMask = markSeen(newMask, g.granted); granted.push({ id: g.granted, step: grants }); }
    grants++;
  }
  return { owned, newMask, granted };
}

export function initializeRewardLedger(next: IntStore | null, enabled: boolean,
  opts: { writable: boolean; totalSolved: number; selectedNumericId: number; book: boolean }): void {
  store = enabled ? next : null;
  writable = enabled && opts.writable && next !== null;
  grants = 0;
  if (!store) { publish(null); return; }
  let owned = masks(OWNED_LO, OWNED_HI);
  for (const id of FREE_REWARD_IDS) owned = markSeen(owned, id);
  const storedPoints = store.getInt(POINTS, -1);
  const firstLaunch = !(Number.isSafeInteger(storedPoints) && storedPoints >= 0);
  const points = firstLaunch ? count(opts.totalSolved) : storedPoints;
  if (firstLaunch) owned = markSeen(owned, opts.selectedNumericId);
  const storedGrants = store.getInt(GRANTS, -1);
  let newMask = masks(NEW_LO, NEW_HI);
  if (firstLaunch) {
    grants = 0;
  } else if (Number.isSafeInteger(storedGrants) && storedGrants >= 0) {
    grants = storedGrants;
  } else {
    // A-era save: A granted path entries [0, reached) by index; picker-seen marked [0, pickerSeen) as seen.
    grants = pathIndexReached(points, PATH_TOTALS);
    // Keep A's guarantee for restored/partial saves: path entries [0, reached) are owned (never removed).
    for (let i = 0; i < grants; i++) owned = markSeen(owned, REWARD_PATH_IDS[i]);
    const pickerSeen = count(store.getInt(PICKER_SEEN, 0));
    for (let i = pickerSeen; i < grants; i++) newMask = markSeen(newMask, REWARD_PATH_IDS[i]);
  }
  const g = grantSteps(points, owned, newMask);
  owned = g.owned;
  // Credited or reconciled grants are silent: no reveal flood and no "new" dots on first launch.
  newMask = firstLaunch ? { lo: 0, hi: 0 } : g.newMask;
  let petals: number | null = null;
  if (opts.book) {
    const storedPetals = store.getInt(PETALS, -1);
    petals = Number.isSafeInteger(storedPetals) && storedPetals >= 0 ? storedPetals : WELCOME_PETALS;
    if (writable && storedPetals !== petals) store.setInt(PETALS, petals);
  }
  if (writable) {
    if (firstLaunch) store.setInt(POINTS, points);
    write(owned, newMask);
    if (count(store.getInt(SEEN, 0)) < grants) store.setInt(SEEN, grants);
  }
  publish(snapshot(points, owned, newMask, petals));
}

export function getRewardState(): RewardState | null { return state; }
export function subscribeRewards(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function isRewardOwned(rewardId: number): boolean { return state ? hasSeen(state.owned, rewardId) : true; }
export function isRewardNew(rewardId: number): boolean { return !!state && hasSeen(state.newMask, rewardId); }
export function etaFor(rewardId: number): number | null {
  if (!state) return null;
  const rank = unownedPath(state.owned, REWARD_PATH_IDS).indexOf(rewardId);
  return rank < 0 ? null : etaForRank(state.points, PATH_TOTALS, grants, rank);
}

export function recordRewardClear(kind: ClearKind, perfect: boolean): ClearReward | null {
  if (!state || !store || !writable) return null;
  const earned = pointsForClear(kind, perfect);
  const points = state.points + earned;
  const petals = state.petals === null ? null : state.petals + earned;
  const grantsBefore = grants;
  const g = grantSteps(points, state.owned, state.newMask);
  store.setInt(POINTS, points);
  if (petals !== null) store.setInt(PETALS, petals);
  // Persist whenever a step was used, even one that granted nothing (all path styles owned): spec §4 amendment.
  if (grants !== grantsBefore) write(g.owned, g.newMask);
  publish(snapshot(points, g.owned, g.newMask, petals));
  const last = g.granted[g.granted.length - 1];
  const seen = count(store.getInt(SEEN, 0));
  const upNextEntry = state.next;
  const unlock = last && last.step >= seen
    ? { entry: entryById(last.id), pathIndex: last.step, ownedSkins: ownedSkins(g.owned),
        upNext: upNextEntry && state.levelsToNext !== null ? { entry: upNextEntry, levels: state.levelsToNext } : null }
    : null;
  return { earned, unlock };
}

export function buyReward(rewardId: number): BuyResult {
  if (!state || !store || !writable || state.petals === null) return 'unavailable';
  if (hasSeen(state.owned, rewardId)) return 'owned';
  const price = REWARD_CATALOGUE.find(e => e.rewardId === rewardId)?.price;
  if (price == null) return 'unavailable';
  if (state.petals < price) return 'insufficient';
  const owned = markSeen(state.owned, rewardId);
  const petals = state.petals - price;
  // Same tick: HydratedIntStore coalesces both into one native write batch (book spec §4).
  store.setInt(OWNED_LO, owned.lo); store.setInt(OWNED_HI, owned.hi);
  store.setInt(PETALS, petals);
  publish(snapshot(state.points, owned, state.newMask, petals));
  return 'bought';
}

export function markRevealSeen(stepIndex: number): void {
  if (!store || !writable) return;
  if (count(store.getInt(SEEN, 0)) < stepIndex + 1) store.setInt(SEEN, stepIndex + 1);
}
/** Clears the picker's "new" dots: called when Settings → Arrow style opens. */
export function markPickerSeen(): void {
  if (!state || !store || !writable || (state.newMask.lo === 0 && state.newMask.hi === 0)) return;
  store.setInt(NEW_LO, 0); store.setInt(NEW_HI, 0);
  publish({ ...state, newMask: { lo: 0, hi: 0 } });
}
```

**Read this before coding:** `state.next` is read **after** `publish` in `recordRewardClear`, so `upNextEntry` is
already the next unowned style after this clear's grants. Keep that order.

- [ ] **Step 4: Wire boot**
  - `src/ui/storage.ts`:
    - signature becomes `initSaveSystem(skinPicker = false, rewardPath = false, rewardBook = false)`;
    - keys stay `SaveSystem.persistenceKeys` (the identical array) when `!skinPicker`, otherwise
      `[...persistenceKeys, ARROW_SKIN_KEY, ...(rewardPath ? REWARD_KEYS : []), ...(rewardPath && rewardBook ? BOOK_KEYS : [])]`;
    - pass `book: skinPicker && rewardPath && rewardBook` to `initializeRewardLedger`;
    - the reset call at the top passes `book: false`.
  - `App.tsx`: call `initSaveSystem(skinPickerEnabled(), rewardPathEnabled(), rewardBookEnabled())`, importing
    `rewardBookEnabled` from `./src/ui/rewardGate`.
  - `src/ui/__tests__/gameSessionLifecycle.test.ts` (W3-05): change only the anchor string to
    `'initSaveSystem(skinPickerEnabled(), rewardPathEnabled(), rewardBookEnabled())'`. Every ordering assertion stays.
  - `src/ui/GameScreen.tsx` is unchanged here. `ClearReward` keeps its name.
  - **Authorized fixture edit (amended):** add `book: false` to every existing `initializeRewardLedger(...)` call
    outside `rewardLedger.test.ts`. Today that is `src/ui/__tests__/GameScreen.rewards.test.tsx` lines ~150, ~188
    and ~197; search for others with `rg -n "initializeRewardLedger\(" src`. Change nothing else in those tests.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/rewardLedger.test.ts src/ui/__tests__/storage.test.ts src/ui/__tests__/gameSessionLifecycle.test.ts && npx tsc --noEmit -p .`
Expected: the named suites PASS.

**Temporary tsc exception (amended), until Task 5 ends:** `npx tsc --noEmit -p .` may fail only on these, all fixed
by Tasks 4–5:
- (a) `pickerSeenIndex` reads in `src/ui/ArrowStyleOptions.tsx`;
- (b) `RewardState` fixtures in `RewardProgressPill.test.tsx`, `ArrowStyleOptions.rewards.test.tsx` and
  `RewardRevealCard.test.tsx` missing `newMask` / `petals` / `canBuy`;
- (c) the reveal-card `unlock` fixtures missing `upNext`.

Record the exact tsc error list at the end of Task 3. Any other tsc error is a stop-and-report. tsc must exit 0 at
the end of Task 5 and again in Task 6 Step 4.

- [ ] **Step 6: Checkpoint.**

### Task 4: Petal icon, pill mark, reveal card "Up next"

**Files:**
- Create: `src/ui/PetalIcon.tsx`
- Modify: `src/ui/RewardProgressPill.tsx`, `src/ui/RewardRevealCard.tsx`
- Test: `src/ui/__tests__/RewardProgressPill.test.tsx`, `src/ui/__tests__/RewardRevealCard.test.tsx` (update and append)

**Interfaces:**
- Produces:
  - `<PetalIcon size={number} />` (testID `petal-icon`, decorative, hidden from accessibility);
  - the pill renders `PetalIcon` beside "+N" when `state.petals !== null`;
  - the card reads `unlock.upNext` instead of computing from `REWARD_PATH[pathIndex + 1]`.

- [ ] **Step 1: Write the failing tests**

- Pill: with `state.petals: 12`, `getByTestId('petal-icon')` exists. With `petals: null`, `queryByTestId('petal-icon')`
  is null.
- Pill fixtures (and every other `RewardState` fixture in this task's files) replace `pickerSeenIndex` with
  `newMask: { lo: 0, hi: 0 }, petals: null, canBuy: false`.
- Card: the `unlock` fixture becomes
  `{ entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 4, upNext: { entry: REWARD_PATH[1], levels: 5 } }`, and
  `getByText('Up next: Cinnamon Roll · 5 levels')` still holds.
- Add a card test with `upNext: null`: no "Up next" text.

- [ ] **Step 2: Run them and confirm they fail.** Expected: the petal icon is missing; the card ignores `upNext`.

- [ ] **Step 3: Implement**

```tsx
// src/ui/PetalIcon.tsx
import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

/** Decorative petal mark (never an emoji): four petals and a sunny centre. */
export function PetalIcon({ size = 14 }: { size?: number }) {
  return <Svg testID="petal-icon" accessible={false} width={size} height={size} viewBox="0 0 20 20">
    <G fill="#F5A3C7"><Circle cx={10} cy={5} r={4} /><Circle cx={15} cy={10} r={4} /><Circle cx={10} cy={15} r={4} /><Circle cx={5} cy={10} r={4} /></G>
    <Circle cx={10} cy={10} r={3} fill="#FFD36E" />
  </Svg>;
}
```

- In the pill's label row, wrap "+{earned}" and `{state.petals !== null && <PetalIcon size={12} />}` in a row.
- In the card, replace the `next` / `k` computation with `const upNext = unlock.upNext;`, and render
  `Up next: ${upNext.entry.name} · ${upNext.levels} ${upNext.levels === 1 ? 'level' : 'levels'}` only when `upNext`
  is set.

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx jest src/ui/__tests__/RewardProgressPill.test.tsx src/ui/__tests__/RewardRevealCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 5: Picker — new-mask dots, tabs and the "Your styles" tab

**Files:**
- Modify: `src/ui/ArrowStyleOptions.tsx`, `src/ui/contrastAudit.ts`
- Test: `src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx` (update and append)

**Interfaces:**
- Consumes: `isRewardNew`, `etaFor`, `rewardBookEnabled` (via `state.petals !== null`), `PetalIcon`.
- Produces: with the book on, the header shows the purse (testID `petal-purse`) and two tabs (testIDs `tab-styles`,
  `tab-book`). "Your styles" ends with the line testID `next-free-line`; pressing it switches to Book. Book mode renders
  `<CollectionBook …/>` (Task 6). With the book off, the current reward-path layout is unchanged except that the "new"
  dot uses `isRewardNew`.

- [ ] **Step 1: Write the failing tests**

- Update the mocks: `isRewardNew: (id) => mockNew.has(id)` (new `Set`), and replace `pickerSeenIndex` in fixtures with
  `newMask` and `petals: null`.
- Replace the dot test:
  - with `mockNew = {6}`, Critter's label is "Critter, new";
  - with Rainbow (12) owned but not in `mockNew`, its label is "Rainbow Ribbon".
- Append:

```tsx
test('book on: purse, tabs, and the next-free line switches to Book', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, petals: 18, canBuy: true };
  const { getByTestId, getByText, getByRole } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByText('18 petals');
  expect(getByTestId('tab-styles').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  getByText('Your styles · 4'); getByText('Book · 14');
  fireEvent.press(getByTestId('next-free-line')); // "Next free style: Cinnamon Roll · 4 levels"
  expect(getByTestId('tab-book').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
});
```

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**

1. Replace the `isNew` computation in `StyleRow` with `const isNew = !!state && isRewardNew(style.numericId);`.
1a. **Book-off "Coming up" layout (amended):** every ETA in it uses `etaFor(entry.rewardId)` instead of
    `PATH_TOTALS[REWARD_PATH.indexOf(entry)] - state.points`. That covers the "Next · k" caption, the locked
    accessibility label and the locked-tap hint, so the skip rule shows correct counts. The order stays
    `REWARD_PATH` filtered to unowned (identical to `unownedPath`). Test: in the picker test file, mock
    `etaFor: (id) => mockEta.get(id) ?? null` (a `Map`). With Critter owned and 0 points (`mockEta` Cinnamon → 3),
    the Cinnamon row reads "Next · 3 levels" and its label is "Cinnamon Roll, locked, unlocks in 3 levels". Set
    `mockEta` in the existing tests to keep their expected numbers (Cinnamon 4, Jelly 10).
2. When `state && state.petals !== null`, render instead of the reward-path sections:
   - purse row: `<PetalIcon size={14} />` plus a `Text` reading "{n} petal(s)", in `p.accentText`, centred,
     `accessibilityLabel` "{n} petals";
   - segmented control: two `Pressable`s with `accessibilityRole="tab"`, `minHeight: 48`, labels "Your styles · {owned}"
     and "Book · {unowned}". Local state `tab: 'styles' | 'book'` defaults to `'styles'` on every mount;
   - styles tab: the owned `StyleRow`s, then, if `state.next`, a `Pressable` (testID `next-free-line`,
     `minHeight: 48`) with the text "Next free style: {name} · {k} level(s)", where `k = etaFor(next.rewardId)`, and
     `onPress={() => setTab('book')}`;
   - book tab: `<CollectionBook palette={p} state={state} onUse={id => { chooseArrowStyle(id); setTab('styles'); }} />`.
3. Contrast: add rows for the purse text (`accentText` on `surface`), the tab labels (`ink` selected, `inkDim`
   unselected, on `surface`) and the next-free line (`inkDim`). Move every `skin-picker-*` pointer.

- [ ] **Step 4: Run them and confirm they pass** (Task 6 must exist for the book tab. Implement Task 6's component
  stub first if needed: `export function CollectionBook() { return null; }` is allowed only until Task 6 replaces it.)

Run: `npx jest src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx src/ui/__tests__/contrast.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 6: Collection book grid, confirm and bought screens

**Files:**
- Create: `src/ui/CollectionBook.tsx`
- Modify: `src/ui/contrastAudit.ts`
- Test: `src/ui/__tests__/CollectionBook.test.tsx`

**Interfaces:**
- Consumes: `RewardState`, `buyReward`, `etaFor`, `isRewardOwned` (`rewardLedger`); `REWARD_PATH`; `StylePreview`
  (with `size`); `PetalIcon`; `Haptic` from `src/ui/haptics.ts` (use its existing success method; read the file for
  the exact name).
- Produces:
  - `<CollectionBook palette={Palette} state={RewardState} onUse={(styleId: string) => void} />`
  - testIDs: `book-grid`, `book-tile-{refId}`, `book-empty`, `book-confirm`, `book-buy`, `book-not-now`,
    `book-bought`, `book-use`, `book-back`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/__tests__/CollectionBook.test.tsx
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';
import { REWARD_PATH } from '../rewardCatalogue';

const mockBuy = jest.fn();
const mockOwned = new Set<number>([0, 2, 4, 6]);
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  buyReward: (id: number) => mockBuy(id),
  isRewardOwned: (id: number) => mockOwned.has(id),
  etaFor: (id: number) => (id === 1 ? 4 : id === 12 ? 18 : null),
}));
import { CollectionBook } from '../CollectionBook';

const base = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, canBuy: true };
beforeEach(() => { mockBuy.mockReset(); });

test('grid lists unowned path styles in order, next free outlined with "free in k"', () => {
  const { getByTestId, getByLabelText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 18 }} onUse={() => {}} />);
  getByTestId('book-grid');
  getByLabelText('Cinnamon Roll, 10 petals, free in 4 levels');
  getByLabelText('Rainbow Ribbon, 10 petals');
});

test('confirm shows the trade-off and buys once; bought screen offers Use it now', () => {
  mockBuy.mockReturnValue('bought');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}); announce.mockClear();
  const onUse = jest.fn();
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 18 }} onUse={onUse} />);
  fireEvent.press(getByTestId('book-tile-rainbow-ribbon'));
  getByText('On the path in 18 levels · or get it now');
  getByText('Buy for 10 petals'); getByText("You'll have 8 left");
  fireEvent.press(getByTestId('book-buy'));
  fireEvent.press(getByTestId('book-buy')); // double tap: the confirm is gone, so no second purchase
  expect(mockBuy).toHaveBeenCalledTimes(1);
  getByText('ADDED TO YOUR STYLES');
  expect(announce).toHaveBeenCalledWith('Rainbow Ribbon added to your styles');
  fireEvent.press(getByTestId('book-use'));
  expect(onUse).toHaveBeenCalledWith('rainbow-ribbon');
});

test('cannot afford: buy is disabled and explains the gap', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 3 }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-campfire'));
  getByText('You need 17 more petals');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).not.toHaveBeenCalled();
});

test('read-only save: buy disabled even with enough petals, and says why', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 50, canBuy: false }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-campfire'));
  getByText('Buying is paused right now');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).not.toHaveBeenCalled();
});

test('empty book', () => {
  REWARD_PATH.forEach(e => mockOwned.add(e.rewardId));
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, next: null, petals: 5 }} onUse={() => {}} />);
  getByTestId('book-empty'); getByText('All styles collected · new ones coming soon');
});
```

Use `queryByTestId` for the second `book-buy` press if `getByTestId` throws once the confirm unmounts. The rule is the
same: exactly one `buyReward` call.

- [ ] **Step 2: Run it and confirm it fails.** Expected: missing module.

- [ ] **Step 3: Implement**

Behaviour:
- Local state is `screen: { kind: 'grid' } | { kind: 'confirm', entry } | { kind: 'bought', entry }`.
- **Grid:** a `View` testID `book-grid` with `flexDirection: 'row', flexWrap: 'wrap'`, tiles at `width: '31%'` and
  `minHeight: 96`, for `REWARD_PATH.filter(e => !isRewardOwned(e.rewardId))`.
  - Each tile is a `Pressable` (testID `book-tile-{refId}`) with a preview: `StylePreview` at size 1, at opacity .45
    unless it is the next free style, i.e. `state.next?.rewardId === e.rewardId`.
  - Each tile shows the name in `Type.menuStats`, `p.ink`, and a price row of `PetalIcon size 11` plus the price,
    `p.accentText` when affordable, else `p.inkDim`.
  - The next-free tile has a dashed `p.accent` border and "free in {k}".
  - The empty book renders testID `book-empty`.
- **Confirm (testID `book-confirm`):**
  - the spring-popped `StylePreview size={3}`;
  - the name (`Type.panelTitle`);
  - the ETA line: `etaFor` → "On the path in {k} level(s) · or get it now", or "Not on the path";
  - `PressScale` testID `book-buy`, `minHeight: 52`, `disabled` when `!state.canBuy || petals < price`. When
    `!state.canBuy` the line under it reads "Buying is paused right now" (`inkDim`). Labelled
    "Buy for {price} petals";
  - the line "You'll have {petals - price} left", or "You need {price - petals} more petal(s)";
  - "Not now" (testID `book-not-now`, `minHeight: 48`) returning to the grid.
- **On buy:** `const r = buyReward(entry.rewardId)`.
  - If `'bought'`: `Haptic.<success>(true)`, announce "{name} added to your styles", then show bought.
  - If anything else: return to the grid (the state will have changed).
- **Bought (testID `book-bought`):**
  - an outlined badge "ADDED TO YOUR STYLES" (same style as the reveal badge: `borderWidth: 1.5`, `p.accentText`);
  - the preview;
  - the name;
  - "{ownedSkins} of 18 styles collected", where `ownedSkins` is `ARROW_STYLES.filter(s => isRewardOwned(s.numericId)).length`;
  - "Use it now" (testID `book-use`) → `onUse(entry.refId)`;
  - "Back to the book" (testID `book-back`) → grid.
- **Contrast:** add rows for tile name (`ink`), price (`accentText` and `inkDim`), ETA and "You'll have" lines
  (`inkDim`), and the badge (`accentText`).

- [ ] **Step 4: Run all the tests**

Run: `npx jest src/ui/__tests__/CollectionBook.test.tsx src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx src/ui/__tests__/contrast.test.ts && npx jest --silent && npx tsc --noEmit -p .`
Expected: PASS everywhere (baseline 126 suites / 2,121 tests, plus the new ones). Any existing test that changed must
be listed in the report with its reason. The only expected ones are the replaced A skip-rule test, the pickerSeen
fixtures and the W3-05 anchor.

- [ ] **Step 5: Checkpoint.**

### Task 7: Device verification, report, lessons

**Files:** `artifacts/BOOK-01/` (never committed), `docs/next-level/reports/BOOK-01.md`, one appended entry in
`docs/engineering-lessons.md` only if something non-obvious was learned.

- [ ] **Step 1: Build.** Build a test-ads APK from `artifacts/REWARD-01/build-test-apk.sh`, adding
  `EXPO_PUBLIC_META_REWARD_BOOK=1` beside `EXPO_PUBLIC_META_REWARD_PATH=1` (ABIs `arm64-v8a,x86_64`). Prove the bundle
  is test-ads only and contains "Buy for" and "Back to the book".
- [ ] **Step 2: Back up the save.** Back up the emulator save as in REWARD-01 Task 8. Use a fresh-save fixture with no
  `arrows_reward%` or `arrows_path%` or `arrows_petals` rows, 0 solved.
- [ ] **Step 3: Welcome and purchase.**
  1. Launch.
  2. Open Settings → Arrow style: "10 petals", "Your styles · 3", "Book · 15".
  3. Buy Critter (10). Screenshot the confirm and the bought screens.
  4. Press "Use it now", play a level and screenshot the Critter board.
- [ ] **Step 4: Skip rule on device.**
  1. Clear levels until the first path step (3 points).
  2. Expect the reveal card to show **Cinnamon Roll**, not Critter. Screenshot it.
  3. Read the database: `arrows_path_grants=1`, with Critter and Cinnamon both owned.
- [ ] **Step 5: Edge states.**
  - Cannot afford: open a 35-petal style. The buy is disabled and the screen reads "You need N more petals".
    Screenshot it.
  - Repeat the book tab and the confirm in dark mode.
  - With `transition_animation_scale=0`, there is no preview pop (restore the setting after).
- [ ] **Step 6: Flag off.** Build without `EXPO_PUBLIC_META_REWARD_BOOK`. Confirm the picker is the reward-path layout
  (Your styles / Coming up), the pill has no petal mark, and the database has no `arrows_petals` row after a clear.
- [ ] **Step 7: Restore and report.** Restore the save and settings. Write `BOOK-01.md` with:
  - commands and results;
  - a screenshot index;
  - red/green evidence per task;
  - every changed existing test with its reason;
  - anything UNVERIFIED;
  - every change outside this plan.

## Self-review notes (controller)

- **Spec coverage:**

  | Spec section | Task |
  | --- | --- |
  | §1 earning and welcome | Task 3 |
  | §2 prices | Task 2 |
  | §3 skip rule and ETA | Tasks 1, 3 |
  | §4 keys, atomic buy, SAVE-GUARD, migration | Task 3 |
  | §5a tabs and grid | Tasks 5, 6 |
  | §5b confirm and bought | Task 6 |
  | §5c pill mark and card | Task 4 |
  | §6 flag | Tasks 1, 3, 7 |
  | §7 verification | Tasks 3–7 |

- **Amendment to raise with the owner:** the new-mask keys `arrows_rewards_new_lo` / `_hi` replace the picker-seen
  count, because purchases make "step index = style" untrue. The owner sees no difference.

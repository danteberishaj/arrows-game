# Reward Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **In this repo:** Codex implements in the working tree and never commits. Every "Checkpoint" below means "stop and leave it uncommitted". The controller (Claude) reviews and commits.

**Goal:** Players earn points by clearing levels and unlock arrow styles along a fixed path. A progress pill shows on the
win panel, a reveal card appears on each unlock, and Settings → Arrow style splits into "Your styles" and "Coming up".
Everything is behind `EXPO_PUBLIC_META_REWARD_PATH` (default OFF).

**Architecture:**
- **Path math:** pure, in `src/core/rewardPath.ts`, reusing the 60-bit lo/hi mask helpers from `src/core/collection.ts`.
- **Catalogue:** pure data in `src/ui/rewardCatalogue.ts`, keyed by the existing skin `numericId`s.
- **Ledger:** `src/ui/rewardLedger.ts` mirrors `src/ui/arrowStyleSelection.ts`:
  - its own additive keys, hydrated only when the flag is on;
  - published through `useSyncExternalStore`;
  - read-only when the hydrate failed (SAVE-GUARD).
- **UI:** small new components (`RewardProgressPill`, `RewardRevealCard`) plus a sectioned mode in `ArrowStyleOptions`.
- **GameScreen:** gets four narrow hooks:
  - earn on clear;
  - render the pill;
  - render the card;
  - skip the review ask on a reveal clear.

**Tech Stack:** Expo SDK 57 / React Native 0.86.3, TypeScript, jest + @testing-library/react-native, react-native-svg,
react-native-reanimated (`useReducedMotion`), AsyncStorage via `HydratedIntStore`.

**Spec:** `docs/superpowers/specs/2026-10-04-reward-path-design.md` (owner-approved 2026-10-04). Read it first. Where
this plan and the spec disagree, the spec wins. Report the conflict and do not resolve it silently.

## Global Constraints

- Read `AGENTS.md`, `docs/engineering-lessons.md` and the Expo v57 docs (https://docs.expo.dev/versions/v57.0.0/)
  before coding. Node v20.19.4 in every shell: `export PATH=$HOME/.nvm/versions/node/v20.19.4/bin:$PATH`.
- Flag: `export const META_REWARD_PATH = process.env.EXPO_PUBLIC_META_REWARD_PATH === '1';`. Effective only when
  `skinPickerEnabled()` is true (Android plus picker flag). With it off:
  - no reward key is read or written;
  - the picker, win panel and save are byte-for-byte today's behaviour.
- Saved keys:
  - `arrows_reward_points`
  - `arrows_rewards_owned_lo`
  - `arrows_rewards_owned_hi`
  - `arrows_reward_seen`
  - `arrows_reward_picker_seen` (the fifth key amends spec §3: it is the persisted "new" dot)

  Rules: additive, no `SCHEMA_VERSION` bump, bits 0–29 per int (reuse `sanitizeMask`, `markSeen` and `hasSeen` from
  `src/core/collection.ts`). Points and owned bits only ever increase.
- Earning:
  - campaign clear +1;
  - daily clear +2;
  - +1 more when perfect (no heart lost);
  - tutorials and benchmark mode earn 0.
- Free from the start: rewardIds 0 (Classic), 2 (Sherbet), 4 (Candy Gloss). Path order and costs exactly as spec §2:
  Critter 3, Cinnamon Roll 5, Jelly 6, Rainbow Ribbon 8, Strawberry Glazed 8, Campfire 10, Yarn 10, Neon Glass 12,
  Clear Glass 12, Pixel 13, Paper Craft 14, Stained Glass 15, Archery 15, Lava Rock 15, Ink Pro 15.
- Copy, exactly:
  - "Next style: {name}"
  - "+{n} point(s) · {k} more level(s)"
  - "All styles collected · new ones coming soon"
  - "NEW STYLE UNLOCKED"
  - "Play with {name}"
  - "Use {name}"
  - "Keep current style · Next level" (campaign) / "Keep current style" (daily)
  - "Up next: {name} · {k} level(s)"
  - "Your styles"
  - "Coming up"
  - "Clear {k} more level(s) to unlock"
  - "Next · {k} level(s)" / "After {name}" / "Later"
- The reveal card subtitle is "Style {N} of 18 · unlocked on level {L}" for campaign and "Style {N} of 18 · unlocked on
  today's daily" for a daily. This amends the mockup's "earned in K levels": no clears-since-unlock counter exists.
- Motion:
  - the reveal card animates **scale only** (0.94 → 1, 220 ms, ease-out) and is mounted at opacity 1, so it is never
    invisible if the animation stalls (engineering-lessons: visibility must not depend on an animation completing);
  - sparkles twinkle once (about 600 ms) and are decorative;
  - with `useReducedMotion()` true, there is no scale and no sparkles.
- `contrastAudit.ts` pins text rows to exact `file:line` sites. After every edit to a file it points at, update the
  pointers or `contrast.test.ts` fails.
- Hard rules:
  - no commits, push or `eas`;
  - emulator-5556 (`fleet_floor_api31`) only, never 5554;
  - test-ads builds only on the emulator; prove the bundle has the test id `3940256099942544` and none of
    `6706292920` / `7549521178` / `3505414519` / `5508761320` before installing;
  - `df -h /` ≥ 5 GB before any gradle build;
  - install with `adb -s emulator-5556 install -r -d` (the emulator has versionCode 6; keep saves);
  - dependencies only via `npx expo install`.

## Review Focus

1. **Failed hydrate (SAVE-GUARD).** Expect: no points and no unlock card this session; no reward key written; the
   picker still shows owned styles from memory defaults. Test owner: Task 3.
2. **A restored save whose owned bits are behind its points** (Auto Backup, or a cost-table change in an update).
   Expect: bits reconciled up on load, silently, with no reveal flood, and nothing ever removed. Test owner: Task 3.
3. **A clear that crosses a threshold while an interstitial is due.** Expect: card first, then the ad after the press,
   then the next level. The review ask never fires on that clear. Test owner: Task 7.
4. **A selected skin that is not owned** (a pre-path selection beyond the credited point). Expect: it is credited as
   owned at first launch and stays selected. Test owner: Task 3.
5. **Tapping a locked style.** Expect: no selection change and the "Clear K more levels to unlock" hint, announced to
   screen readers. Test owner: Task 5.

---

### Task 1: Flag and pure path math

**Files:**
- Modify: `src/featureFlags.ts` (after `META_SKIN_PICKER`, line ~185)
- Modify: `src/__tests__/featureFlags.test.ts` (add `'META_REWARD_PATH'` to the env-flag list next to `'META_SKIN_PICKER'`)
- Create: `src/core/rewardPath.ts`
- Test: `src/core/__tests__/rewardPath.test.ts`

**Interfaces:**
- Produces:
  - `pointsForClear(kind: 'campaign' | 'daily', perfect: boolean): number`
  - `pathTotals(costs: readonly number[]): number[]`
  - `pathIndexReached(points: number, totals: readonly number[]): number`
  - `levelsToNext(points: number, totals: readonly number[]): number | null`
  - `progressToNext(points: number, totals: readonly number[]): number` (0–1)
  - `type OwnedMasks = ShapeMasks` (re-exported)

- [ ] **Step 1: Write the failing test**

```ts
// src/core/__tests__/rewardPath.test.ts
import { levelsToNext, pathIndexReached, pathTotals, pointsForClear, progressToNext } from '../rewardPath';

const COSTS = [3, 5, 6];

test('earning table: campaign 1, daily 2, perfect adds 1', () => {
  expect(pointsForClear('campaign', false)).toBe(1);
  expect(pointsForClear('campaign', true)).toBe(2);
  expect(pointsForClear('daily', false)).toBe(2);
  expect(pointsForClear('daily', true)).toBe(3);
});

test('totals are cumulative', () => {
  expect(pathTotals(COSTS)).toEqual([3, 8, 14]);
});

test('index reached counts totals at or below points, exact boundary included', () => {
  const t = pathTotals(COSTS);
  expect(pathIndexReached(0, t)).toBe(0);
  expect(pathIndexReached(2, t)).toBe(0);
  expect(pathIndexReached(3, t)).toBe(1);
  expect(pathIndexReached(7, t)).toBe(1);
  expect(pathIndexReached(8, t)).toBe(2);
  expect(pathIndexReached(999, t)).toBe(3);
});

test('levels to next assume +1 per level and are null when complete', () => {
  const t = pathTotals(COSTS);
  expect(levelsToNext(0, t)).toBe(3);
  expect(levelsToNext(3, t)).toBe(5);
  expect(levelsToNext(13, t)).toBe(1);
  expect(levelsToNext(14, t)).toBeNull();
});

test('progress to next is the share of the current step, 1 when complete', () => {
  const t = pathTotals(COSTS);
  expect(progressToNext(0, t)).toBe(0);
  expect(progressToNext(5, t)).toBeCloseTo(2 / 5);
  expect(progressToNext(14, t)).toBe(1);
});

test('corrupt points (negative, NaN) read as 0', () => {
  const t = pathTotals(COSTS);
  expect(pathIndexReached(-5, t)).toBe(0);
  expect(levelsToNext(Number.NaN, t)).toBe(3);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/core/__tests__/rewardPath.test.ts`
Expected: FAIL with "Cannot find module '../rewardPath'"

- [ ] **Step 3: Implement**

```ts
// src/core/rewardPath.ts
/**
 * Reward path math (spec docs/superpowers/specs/2026-10-04-reward-path-design.md §1–2).
 * Pure: no storage, no UI. Owned rewards reuse the collection's 60-bit lo/hi masks.
 */
export type { ShapeMasks as OwnedMasks } from './collection';

export type ClearKind = 'campaign' | 'daily';

/** Points one clear earns: campaign 1, daily 2, +1 when no heart was lost. */
export function pointsForClear(kind: ClearKind, perfect: boolean): number {
  return (kind === 'daily' ? 2 : 1) + (perfect ? 1 : 0);
}

/** Cumulative totals: costs [3, 5] become [3, 8]. */
export function pathTotals(costs: readonly number[]): number[] {
  let sum = 0;
  return costs.map(cost => (sum += cost));
}

function safePoints(points: number): number {
  return Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0;
}

/** How many path rewards `points` has reached (0 = none). */
export function pathIndexReached(points: number, totals: readonly number[]): number {
  const p = safePoints(points);
  let reached = 0;
  while (reached < totals.length && totals[reached] <= p) reached++;
  return reached;
}

/** Points still needed for the next reward, read as levels at +1 each; null when the path is complete. */
export function levelsToNext(points: number, totals: readonly number[]): number | null {
  const index = pathIndexReached(points, totals);
  return index >= totals.length ? null : totals[index] - safePoints(points);
}

/** Share of the current step already earned, 0–1; 1 when the path is complete. */
export function progressToNext(points: number, totals: readonly number[]): number {
  const index = pathIndexReached(points, totals);
  if (index >= totals.length) return 1;
  const start = index === 0 ? 0 : totals[index - 1];
  return (safePoints(points) - start) / (totals[index] - start);
}
```

Add to `src/featureFlags.ts`, directly after `META_SKIN_PICKER`:

```ts
/**
 * REWARD-PATH (spec 2026-10-04): clears earn points that unlock arrow styles along a fixed path.
 * Effective only with META_SKIN_PICKER on Android (src/ui/rewardLedger.ts rewardPathEnabled).
 * OFF: no reward key is read or written; picker and win panel are unchanged.
 */
export const META_REWARD_PATH = process.env.EXPO_PUBLIC_META_REWARD_PATH === '1';
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/core/__tests__/rewardPath.test.ts src/__tests__/featureFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.** Leave it uncommitted.

### Task 2: Reward catalogue

**Files:**
- Create: `src/ui/rewardCatalogue.ts`
- Test: `src/ui/__tests__/rewardCatalogue.test.ts`

**Interfaces:**
- Consumes: `pathTotals` (Task 1); `ARROW_STYLES`, `ArrowStyle` from `src/ui/skinSpecs.ts`.
- Produces:
  - `interface RewardEntry { rewardId: number; kind: 'skin' | 'exit' | 'board'; refId: string; name: string; pathCost: number | null; price: number | null; chips: readonly string[] }`
  - `REWARD_CATALOGUE: readonly RewardEntry[]`
  - `REWARD_PATH: readonly RewardEntry[]` (path order)
  - `PATH_TOTALS: readonly number[]`
  - `FREE_REWARD_IDS: readonly number[]`
  - `rewardForSkin(numericId: number): RewardEntry | undefined`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/__tests__/rewardCatalogue.test.ts
import { ARROW_STYLES } from '../skinSpecs';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_CATALOGUE, REWARD_PATH, rewardForSkin } from '../rewardCatalogue';

test('every arrow style appears exactly once, keyed by its numericId', () => {
  const ids = REWARD_CATALOGUE.filter(e => e.kind === 'skin').map(e => e.rewardId).sort((a, b) => a - b);
  expect(ids).toEqual(ARROW_STYLES.map(s => s.numericId).sort((a, b) => a - b));
  for (const style of ARROW_STYLES) expect(rewardForSkin(style.numericId)?.refId).toBe(style.id);
});

test('Classic, Sherbet and Candy Gloss are free; everything else is on the path', () => {
  expect([...FREE_REWARD_IDS].sort((a, b) => a - b)).toEqual([0, 2, 4]);
  expect(REWARD_PATH.length + FREE_REWARD_IDS.length).toBe(REWARD_CATALOGUE.length);
});

test('path order and costs are the spec table', () => {
  expect(REWARD_PATH.map(e => [e.refId, e.pathCost])).toEqual([
    ['critter', 3], ['cinnamon', 5], ['jelly', 6], ['rainbow-ribbon', 8], ['strawberry-glazed', 8],
    ['campfire', 10], ['yarn', 10], ['neon-glass', 12], ['clear-glass', 12], ['pixel', 13],
    ['paper-craft', 14], ['stained-glass', 15], ['archery', 15], ['lava-rock', 15], ['ink-pro', 15],
  ]);
  expect(PATH_TOTALS[PATH_TOTALS.length - 1]).toBe(161);
});

test('rewardIds are unique, below 60, and every path entry has three chips', () => {
  const ids = REWARD_CATALOGUE.map(e => e.rewardId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(Math.max(...ids)).toBeLessThan(60);
  for (const e of REWARD_PATH) expect(e.chips).toHaveLength(3);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/rewardCatalogue.test.ts`
Expected: FAIL with "Cannot find module '../rewardCatalogue'"

- [ ] **Step 3: Implement**

```ts
// src/ui/rewardCatalogue.ts
import { pathTotals } from '../core/rewardPath';
import { ARROW_STYLES } from './skinSpecs';

/** One unlockable. rewardId is persisted as a bit (0–59): never change or reuse one. Skins use their numericId. */
export interface RewardEntry {
  rewardId: number;
  kind: 'skin' | 'exit' | 'board';
  refId: string;
  name: string;
  /** Points after the previous path reward; null = free from the start. */
  pathCost: number | null;
  /** Direction B (collection book) price; null until B ships. */
  price: number | null;
  chips: readonly string[];
}

/** OWNER-APPROVED STARTING VALUES (spec §2). Tune costs here only. */
const PATH: readonly (readonly [string, number, readonly string[]])[] = [
  ['critter', 3, ['Little faces', 'Caterpillar body', 'Mint board']],
  ['cinnamon', 5, ['Sweet swirl', 'Sleepy face', 'Cream board']],
  ['jelly', 6, ['Glossy', 'Soft spots', 'Blue board']],
  ['rainbow-ribbon', 8, ['Six colours', 'Nested heads', 'Lilac board']],
  ['strawberry-glazed', 8, ['Pink icing', 'Sprinkles', 'Cream board']],
  ['campfire', 10, ['Warm bands', 'Little faces', 'Ember board']],
  ['yarn', 10, ['Stitched', 'Soft colours', 'Cosy']],
  ['neon-glass', 12, ['Glow', 'Bright colours', 'Best in dark']],
  ['clear-glass', 12, ['Icy glass', 'Marble tail', 'Clean']],
  ['pixel', 13, ['Retro steps', 'Hard shadow', 'Bold']],
  ['paper-craft', 14, ['Folded', 'Paper creases', 'Crafty']],
  ['stained-glass', 15, ['Lead lines', 'Jewel panes', 'Classic']],
  ['archery', 15, ['Feathered', 'Arrowhead', 'Sharp']],
  ['lava-rock', 15, ['Glowing cracks', 'Dark stone', 'Best in dark']],
  ['ink-pro', 15, ['Swept head', 'Ink', 'Best in light']],
];
const FREE = ['classic', 'sherbet', 'candy-gloss'];

const byId = new Map(ARROW_STYLES.map(style => [style.id, style]));
function skinEntry(id: string, pathCost: number | null, chips: readonly string[]): RewardEntry {
  const style = byId.get(id);
  if (!style) throw new Error(`rewardCatalogue: unknown skin ${id}`);
  return { rewardId: style.numericId, kind: 'skin', refId: id, name: style.name, pathCost, price: null, chips };
}

export const REWARD_PATH: readonly RewardEntry[] = PATH.map(([id, cost, chips]) => skinEntry(id, cost, chips));
export const REWARD_CATALOGUE: readonly RewardEntry[] = [...FREE.map(id => skinEntry(id, null, [])), ...REWARD_PATH];
export const FREE_REWARD_IDS: readonly number[] = FREE.map(id => byId.get(id)!.numericId);
export const PATH_TOTALS: readonly number[] = pathTotals(REWARD_PATH.map(e => e.pathCost!));
export function rewardForSkin(numericId: number): RewardEntry | undefined {
  return REWARD_CATALOGUE.find(e => e.kind === 'skin' && e.rewardId === numericId);
}
```

Confirm the ids `critter`, `cinnamon`, `rainbow-ribbon` and so on against `SKIN_SPECS` in `src/ui/skinSpecs.ts` (Classic's id is `classic`).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/rewardCatalogue.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 3: Reward ledger, save wiring and existing-player credit

**Files:**
- Create: `src/ui/rewardLedger.ts`
- Modify: `src/ui/storage.ts` (`hydrate` key list, `initSaveSystem` signature and init order)
- Modify: `App.tsx:152` (pass the reward flag)
- Test: `src/ui/__tests__/rewardLedger.test.ts`; extend `src/ui/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `IntStore` from `src/core/saveSystem.ts`; `markSeen`, `hasSeen`, `sanitizeMask` from
  `src/core/collection.ts`; `skinPickerEnabled` from `src/ui/useArrowStyle.ts`; `META_REWARD_PATH`.
- Produces:
  - Constants: `REWARD_KEYS: readonly string[]`.
  - Gate: `rewardPathEnabled(): boolean`.
  - `initializeRewardLedger(store: IntStore | null, enabled: boolean, opts: { writable: boolean; totalSolved: number; selectedNumericId: number }): void`
  - `interface RewardState { points: number; owned: OwnedMasks; reachedIndex: number; next: RewardEntry | null; levelsToNext: number | null; progress: number; pickerSeenIndex: number }`
  - `getRewardState(): RewardState | null` (null when disabled)
  - `subscribeRewards(listener: () => void): () => void`
  - `isRewardOwned(rewardId: number): boolean` (true when disabled)
  - `interface ClearReward { earned: number; unlock: { entry: RewardEntry; pathIndex: number; ownedSkins: number } | null }`
  - `recordRewardClear(kind: ClearKind, perfect: boolean): ClearReward | null`
  - `markRevealSeen(pathIndex: number): void`
  - `markPickerSeen(): void`

Rules:
- `pathIndex` is 0-based into `REWARD_PATH`.
- `reachedIndex` is the count reached.
- `arrows_reward_seen` stores the count of path rewards whose reveal was shown, with the same meaning as `reachedIndex`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/__tests__/rewardLedger.test.ts
import type { IntStore } from '../../core/saveSystem';

class Mem implements IntStore {
  m = new Map<string, number>(); reads: string[] = []; writes: string[] = [];
  getInt(k: string, d: number) { this.reads.push(k); return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.writes.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}
function load() {
  jest.resetModules();
  return require('../rewardLedger') as typeof import('../rewardLedger');
}
const SKIN = { critter: 6, cinnamon: 1, jelly: 5, sherbet: 2, rainbow: 12 };

test('disabled: zero reward-key reads or writes, everything reads as owned', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, false, { writable: true, totalSolved: 50, selectedNumericId: 1 });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(L.getRewardState()).toBeNull();
  expect(L.isRewardOwned(SKIN.critter)).toBe(true);
  expect(s.reads.filter(k => k.startsWith('arrows_reward'))).toEqual([]);
  expect(s.writes).toEqual([]);
});

test('first launch, 0 solved: only the free styles are owned, nothing seen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
  const st = L.getRewardState()!;
  expect(st.points).toBe(0);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
  expect(st.next?.refId).toBe('critter');
  expect(st.levelsToNext).toBe(3);
});

test('first launch credit, 9 solved: Critter and Cinnamon owned silently (seen = reached)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 9, selectedNumericId: 0 });
  expect(L.isRewardOwned(SKIN.critter) && L.isRewardOwned(SKIN.cinnamon)).toBe(true);
  expect(L.isRewardOwned(SKIN.jelly)).toBe(false);
  expect(s.m.get('arrows_reward_seen')).toBe(2);
  expect(s.m.get('arrows_reward_picker_seen')).toBe(2);
});

test('first launch credit, 300 solved: everything owned, no next', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 300, selectedNumericId: 0 });
  expect(L.getRewardState()!.next).toBeNull();
  expect(L.isRewardOwned(16)).toBe(true);
});

test('a selected style beyond the credited point is owned and never locked', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow });
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
  expect(L.isRewardOwned(SKIN.critter)).toBe(false);
});

test('crossing a threshold returns the unlock once; the reveal is not repeated after markRevealSeen', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
  expect(L.recordRewardClear('campaign', false)).toEqual({ earned: 1, unlock: null });
  const r = L.recordRewardClear('campaign', true)!; // 1 + 2 = 3 = Critter
  expect(r.earned).toBe(2);
  expect(r.unlock?.entry.refId).toBe('critter');
  expect(r.unlock?.pathIndex).toBe(0);
  expect(r.unlock?.ownedSkins).toBe(4);
  L.markRevealSeen(0);
  expect(s.m.get('arrows_reward_seen')).toBe(1);
  expect(L.recordRewardClear('campaign', false)!.unlock).toBeNull();
});

test('a style selected before the path: earlier reveals still show, its own reach is silent', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 2, selectedNumericId: SKIN.rainbow });
  expect(s.m.get('arrows_reward_seen') ?? 0).toBe(0);
  expect(L.recordRewardClear('campaign', false)!.unlock?.entry.refId).toBe('critter'); // 3 points
  L.markRevealSeen(0);
  for (let i = 0; i < 18; i++) L.recordRewardClear('campaign', false); // 21 points: Cinnamon, Jelly reached
  const r = L.recordRewardClear('campaign', false)!; // 22 points: Rainbow reached, already owned
  expect(r.unlock).toBeNull();
  expect(L.isRewardOwned(SKIN.rainbow)).toBe(true);
});

test('daily earns 2 (+1 perfect)', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 0, selectedNumericId: 0 });
  expect(L.recordRewardClear('daily', true)!.earned).toBe(3);
  expect(L.getRewardState()!.points).toBe(3);
});

test('read-only session (failed hydrate): no writes, no unlocks', () => {
  const L = load(); const s = new Mem();
  L.initializeRewardLedger(s, true, { writable: false, totalSolved: 40, selectedNumericId: 0 });
  expect(L.recordRewardClear('campaign', true)).toBeNull();
  expect(s.writes).toEqual([]);
  expect([0, 2, 4].every(L.isRewardOwned)).toBe(true);
});

test('restore/cost change: bits behind points are reconciled up silently, never removed', () => {
  const L = load(); const s = new Mem();
  s.m.set('arrows_reward_points', 22); // reaches Rainbow (index 3)
  s.m.set('arrows_rewards_owned_lo', (1 << 0) | (1 << 2) | (1 << 4) | (1 << 16)); // starters + Lava Rock (bought earlier)
  s.m.set('arrows_reward_seen', 1);
  L.initializeRewardLedger(s, true, { writable: true, totalSolved: 999, selectedNumericId: 0 });
  expect([6, 1, 5, 12, 16].every(L.isRewardOwned)).toBe(true);
  expect(s.m.get('arrows_reward_seen')).toBe(4); // silent
  expect(L.getRewardState()!.points).toBe(22); // never re-credited from totalSolved
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/ui/__tests__/rewardLedger.test.ts`
Expected: FAIL with "Cannot find module '../rewardLedger'"

- [ ] **Step 3: Implement `src/ui/rewardLedger.ts`**

```ts
import { Platform } from 'react-native';
import type { IntStore } from '../core/saveSystem';
import { hasSeen, markSeen, sanitizeMask } from '../core/collection';
import { levelsToNext, pathIndexReached, pointsForClear, progressToNext, type ClearKind, type OwnedMasks } from '../core/rewardPath';
import { META_REWARD_PATH, META_SKIN_PICKER } from '../featureFlags';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_PATH, type RewardEntry } from './rewardCatalogue';
import { ARROW_STYLES } from './skinSpecs';

const POINTS = 'arrows_reward_points';
const OWNED_LO = 'arrows_rewards_owned_lo';
const OWNED_HI = 'arrows_rewards_owned_hi';
const SEEN = 'arrows_reward_seen';
const PICKER_SEEN = 'arrows_reward_picker_seen';
/** Additive keys hydrated only when the path is on (spec §3; PICKER_SEEN is the plan's fifth key). */
export const REWARD_KEYS: readonly string[] = [POINTS, OWNED_LO, OWNED_HI, SEEN, PICKER_SEEN];

export function rewardPathEnabled(): boolean {
  return META_REWARD_PATH && META_SKIN_PICKER && Platform.OS === 'android';
}

export interface RewardState {
  points: number; owned: OwnedMasks; reachedIndex: number; next: RewardEntry | null;
  levelsToNext: number | null; progress: number; pickerSeenIndex: number;
}
export interface ClearReward {
  earned: number;
  unlock: { entry: RewardEntry; pathIndex: number; ownedSkins: number } | null;
}

let store: IntStore | null = null;
let writable = false;
let state: RewardState | null = null;
const listeners = new Set<() => void>();

function count(v: number): number { return Number.isSafeInteger(v) && v > 0 ? v : 0; }
function snapshot(points: number, owned: OwnedMasks, pickerSeenIndex: number): RewardState {
  const reachedIndex = pathIndexReached(points, PATH_TOTALS);
  return { points, owned, reachedIndex, next: REWARD_PATH[reachedIndex] ?? null,
    levelsToNext: levelsToNext(points, PATH_TOTALS), progress: progressToNext(points, PATH_TOTALS), pickerSeenIndex };
}
function publish(next: RewardState | null): void { state = next; listeners.forEach(l => l()); }
function withPath(owned: OwnedMasks, reached: number): OwnedMasks {
  let out = owned;
  for (let i = 0; i < reached; i++) out = markSeen(out, REWARD_PATH[i].rewardId);
  return out;
}
function persist(owned: OwnedMasks): void {
  store!.setInt(OWNED_LO, owned.lo);
  store!.setInt(OWNED_HI, owned.hi);
}

export function initializeRewardLedger(next: IntStore | null, enabled: boolean,
  opts: { writable: boolean; totalSolved: number; selectedNumericId: number }): void {
  store = enabled ? next : null;
  writable = enabled && opts.writable && next !== null;
  if (!store) { publish(null); return; }
  let owned: OwnedMasks = { lo: sanitizeMask(store.getInt(OWNED_LO, 0)), hi: sanitizeMask(store.getInt(OWNED_HI, 0)) };
  for (const id of FREE_REWARD_IDS) owned = markSeen(owned, id);
  const stored = store.getInt(POINTS, -1);
  const firstLaunch = !(Number.isSafeInteger(stored) && stored >= 0);
  const points = firstLaunch ? count(opts.totalSolved) : stored;
  if (firstLaunch) owned = markSeen(owned, opts.selectedNumericId); // never lock a style chosen before the path
  const reached = pathIndexReached(points, PATH_TOTALS);
  owned = withPath(owned, reached);
  let pickerSeen = count(store.getInt(PICKER_SEEN, 0));
  if (writable) {
    if (firstLaunch) store.setInt(POINTS, points);
    persist(owned);
    // Credited or reconciled unlocks are silent: no reveal flood, no "new" dots.
    if (count(store.getInt(SEEN, 0)) < reached) store.setInt(SEEN, reached);
    if (firstLaunch || pickerSeen > reached) { pickerSeen = reached; store.setInt(PICKER_SEEN, reached); }
  }
  publish(snapshot(points, owned, firstLaunch ? reached : pickerSeen));
}

export function getRewardState(): RewardState | null { return state; }
export function subscribeRewards(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function isRewardOwned(rewardId: number): boolean { return state ? hasSeen(state.owned, rewardId) : true; }

export function recordRewardClear(kind: ClearKind, perfect: boolean): ClearReward | null {
  if (!state || !store || !writable) return null;
  const earned = pointsForClear(kind, perfect);
  const before = state.reachedIndex;
  const points = state.points + earned;
  const after = pathIndexReached(points, PATH_TOTALS);
  const previousOwned = state.owned;
  const owned = withPath(state.owned, after);
  store.setInt(POINTS, points);
  if (owned !== state.owned) persist(owned);
  publish(snapshot(points, owned, state.pickerSeenIndex));
  const seen = count(store.getInt(SEEN, 0));
  const pathIndex = after - 1;
  // Never reveal a reward that was already owned before this clear (spec §5b amendment).
  const wasOwned = pathIndex >= 0 && hasSeen(previousOwned, REWARD_PATH[pathIndex].rewardId);
  const unlock = after > before && pathIndex >= seen && !wasOwned
    ? { entry: REWARD_PATH[pathIndex], pathIndex,
        ownedSkins: ARROW_STYLES.filter(s => hasSeen(owned, s.numericId)).length }
    : null;
  return { earned, unlock };
}

/** Written when the card is shown, so a kill mid-card never repeats it (spec §5b). */
export function markRevealSeen(pathIndex: number): void {
  if (!store || !writable) return;
  if (count(store.getInt(SEEN, 0)) < pathIndex + 1) store.setInt(SEEN, pathIndex + 1);
}
/** Clears the picker's "new" dots: called when Settings → Arrow style opens. */
export function markPickerSeen(): void {
  if (!state || !store || !writable || state.pickerSeenIndex >= state.reachedIndex) return;
  store.setInt(PICKER_SEEN, state.reachedIndex);
  publish({ ...state, pickerSeenIndex: state.reachedIndex });
}
```

- [ ] **Step 4: Wire boot**

In `src/ui/storage.ts`:
- Import `REWARD_KEYS` and `initializeRewardLedger`.
- Change the signature to `initSaveSystem(skinPicker = false, rewardPath = false)`.
- Hydrate `[...SaveSystem.persistenceKeys, ...(skinPicker ? [ARROW_SKIN_KEY] : []), ...(skinPicker && rewardPath ? REWARD_KEYS : [])]`.
- Call `initializeRewardLedger(null, false, …)` next to the existing `initializeArrowStyle(null, false)` at the top.
- After `initializeArrowStyle(store, skinPicker)`, add:

```ts
initializeRewardLedger(store, skinPicker && rewardPath, {
  writable: healthy, totalSolved: SaveSystem.totalSolved, selectedNumericId: getArrowStyle().numericId,
});
```

In `App.tsx:152`, change the call to `initSaveSystem(skinPickerEnabled(), rewardPathEnabled())`.

Add a test to `storage.test.ts`:
- with AsyncStorage `multiGet` mocked to throw and `initSaveSystem(true, true)`, `getRewardState()!.points` is 0;
- `recordRewardClear` returns null;
- `AsyncStorage.multiSet` is never called with an `arrows_reward*` key.

Follow that file's existing mock setup.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/rewardLedger.test.ts src/ui/__tests__/storage.test.ts && npx tsc --noEmit -p .`
Expected: PASS, tsc exit 0

- [ ] **Step 6: Checkpoint.**

### Task 4: Hook, shared preview, and the progress pill

**Files:**
- Create: `src/ui/useRewards.ts`
- Create: `src/ui/RewardProgressPill.tsx`
- Modify: `src/ui/ArrowStyleOptions.tsx` (export `StylePreview`, no behaviour change)
- Test: `src/ui/__tests__/RewardProgressPill.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`getRewardState`, `subscribeRewards`, `rewardPathEnabled`, `RewardState`); `StylePreview`;
  `ARROW_STYLES`.
- Produces:
  - `useRewards(): RewardState | null`
  - `<RewardProgressPill state={RewardState} earned={number} palette={Palette} />`, with testID `reward-pill`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/__tests__/RewardProgressPill.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { RewardProgressPill } from '../RewardProgressPill';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

const base = { owned: { lo: 0, hi: 0 }, pickerSeenIndex: 0 };

test('shows the next style, points earned and levels to go (singular)', () => {
  const { getByText } = render(<RewardProgressPill palette={InkNight} earned={2}
    state={{ ...base, points: 2, reachedIndex: 0, next: REWARD_PATH[0], levelsToNext: 1, progress: 2 / 3 }} />);
  getByText('Next style: Critter');
  getByText('+2 points · 1 more level');
});

test('plural levels and singular point', () => {
  const { getByText } = render(<RewardProgressPill palette={InkNight} earned={1}
    state={{ ...base, points: 4, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2 }} />);
  getByText('+1 point · 4 more levels');
});

test('complete path shows the collected line', () => {
  const { getByText, queryByText } = render(<RewardProgressPill palette={InkNight} earned={1}
    state={{ ...base, points: 200, reachedIndex: 15, next: null, levelsToNext: null, progress: 1 }} />);
  getByText('All styles collected · new ones coming soon');
  expect(queryByText(/Next style/)).toBeNull();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/RewardProgressPill.test.tsx`
Expected: FAIL with "Cannot find module '../RewardProgressPill'"

- [ ] **Step 3: Implement**

`src/ui/useRewards.ts`:

```ts
import { useSyncExternalStore } from 'react';
import { getRewardState, rewardPathEnabled, subscribeRewards, type RewardState } from './rewardLedger';

const none = () => () => {};
const nullSnapshot = () => null;
export function useRewards(): RewardState | null {
  const enabled = rewardPathEnabled();
  return useSyncExternalStore(enabled ? subscribeRewards : none, enabled ? getRewardState : nullSnapshot, nullSnapshot);
}
```

In `ArrowStyleOptions.tsx`, change `function StylePreview` to `export function StylePreview`.

`src/ui/RewardProgressPill.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StylePreview } from './ArrowStyleOptions';
import type { RewardState } from './rewardLedger';
import { ARROW_STYLES } from './skinSpecs';
import { Type, type Palette } from './theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Win-panel progress toward the next path reward (spec §5a, approved option A). */
export function RewardProgressPill({ state, earned, palette: p }: { state: RewardState; earned: number; palette: Palette }) {
  if (!state.next || state.levelsToNext === null) {
    return <View testID="reward-pill" style={[styles.pill, { backgroundColor: p.surface }]}>
      <Text style={[styles.caption, { color: p.inkDim }]}>All styles collected · new ones coming soon</Text>
    </View>;
  }
  const style = ARROW_STYLES.find(s => s.id === state.next!.refId)!;
  return <View testID="reward-pill" style={[styles.pill, { backgroundColor: p.surface }]}
    accessible accessibilityLabel={`Next style ${style.name}, ${plural(state.levelsToNext, 'level', 'levels')} to go`}>
    <StylePreview style={style} palette={p} />
    <View style={styles.text}>
      <Text style={[styles.label, { color: p.ink }]}>Next style: {style.name}</Text>
      <View style={[styles.track, { backgroundColor: p.border }]}>
        <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%`, backgroundColor: p.accent }]} />
      </View>
      <Text style={[styles.caption, { color: p.inkDim }]}>
        +{plural(earned, 'point', 'points')} · {plural(state.levelsToNext, 'more level', 'more levels')}
      </Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, marginTop: 12, alignSelf: 'stretch' },
  text: { flex: 1 },
  label: { ...Type.menuStats, fontWeight: '700' },
  track: { height: 7, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  caption: { ...Type.menuStats, marginTop: 3 },
});
```

The caption text renders as "+2 points · 1 more level". Check the exact `Type` tokens exist in `src/ui/theme.ts`; if a
token name differs, use the nearest existing one and say which.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/RewardProgressPill.test.tsx src/ui/__tests__/SettingsSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 5: Picker sections ("Your styles" / "Coming up")

**Files:**
- Modify: `src/ui/ArrowStyleOptions.tsx`
- Modify: `src/ui/contrastAudit.ts` (new rows; move the existing `skin-picker-*` line pointers)
- Test: `src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx`

**Interfaces:**
- Consumes: `useRewards`, `isRewardOwned`, `markPickerSeen`, `REWARD_PATH`, `rewardForSkin`.
- Produces: with rewards on, `ArrowStyleOptions` renders:
  - section headers (testIDs `reward-section-owned` and `reward-section-coming`);
  - locked rows with `accessibilityRole="button"`;
  - testID `reward-locked-hint` for the inline hint.
- With rewards off (`useRewards()` null), the output is unchanged: an existing snapshot and test must still pass.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';

const mockState = { current: null as any };
const mockChoose = jest.fn();
const mockMarkPickerSeen = jest.fn();
jest.mock('../useRewards', () => ({ useRewards: () => mockState.current }));
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  isRewardOwned: (id: number) => [0, 2, 4, 6].includes(id),
  markPickerSeen: () => mockMarkPickerSeen(),
}));
jest.mock('../arrowStyleSelection', () => ({ ...jest.requireActual('../arrowStyleSelection'), chooseArrowStyle: (id: string) => mockChoose(id) }));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'sherbet' }), skinPickerEnabled: () => true }));
import { ArrowStyleOptions } from '../ArrowStyleOptions';
import { REWARD_PATH } from '../rewardCatalogue';

beforeEach(() => { mockChoose.mockClear(); mockMarkPickerSeen.mockClear(); });

test('owned styles first with a count, then the path with the next one highlighted', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, pickerSeenIndex: 1 };
  const { getByTestId, getByText } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  getByTestId('reward-section-owned'); getByText('4 of 18');
  getByTestId('reward-section-coming');
  getByText('Next · 4 levels');
  getByText('After Cinnamon Roll');
  expect(mockMarkPickerSeen).toHaveBeenCalledTimes(1);
});

test('tapping a locked style never selects it and shows the hint', () => {
  mockState.current = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, pickerSeenIndex: 1 };
  const { getByLabelText, getByTestId } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  fireEvent.press(getByLabelText('Jelly, locked, unlocks in 10 levels'));
  expect(mockChoose).not.toHaveBeenCalled();
  expect(getByTestId('reward-locked-hint').props.children).toBe('Clear 10 more levels to unlock');
});

test('rewards off: today\'s flat list, every style selectable', () => {
  mockState.current = null;
  const { getByLabelText, queryByTestId } = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} />);
  expect(queryByTestId('reward-section-owned')).toBeNull();
  fireEvent.press(getByLabelText('Jelly'));
  expect(mockChoose).toHaveBeenCalledWith('jelly');
});
```

The levels for a locked row are `PATH_TOTALS[pathIndex] - points`. Jelly is index 2: 14 − 4 = 10.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx`
Expected: FAIL (no sections and no locked labels)

- [ ] **Step 3: Implement**

In `ArrowStyleOptions`, keep the existing row markup as an inner `StyleRow` used by both modes. When `useRewards()`
returns a state:

1. Call `markPickerSeen()` once in a `useEffect(() => { markPickerSeen(); }, [])`.
2. **"Your styles" section** (`testID="reward-section-owned"`):
   - header text "Your styles", plus `{owned} of {ARROW_STYLES.length}` on the right;
   - rows are `ARROW_STYLES.filter(s => isRewardOwned(s.numericId))` in catalogue order (free styles, then path order);
   - a path entry with index ≥ `state.pickerSeenIndex` shows a small "new" dot: a 7 dp circle in `p.accent`, with
     `accessibilityLabel` suffix ", new".
3. **"Coming up" section** (`testID="reward-section-coming"`), only if any path entry is not owned:
   - each locked entry in `REWARD_PATH` order renders a `Pressable` with `accessibilityRole="button"` and
     `accessibilityLabel={`${name}, locked, unlocks in ${k} ${k === 1 ? 'level' : 'levels'}`}`, where
     `k = PATH_TOTALS[i] - state.points`;
   - the first locked entry is full colour and shows "Next · {k} level(s)" plus the same bar as the pill
     (`state.progress`);
   - the second shows "After {previous name}" and the rest show "Later". These rows sit at opacity .45 with a lock
     glyph (use the existing icon set in `src/ui/icons.tsx` if it has a lock; otherwise draw a 12 dp SVG padlock and
     say so);
   - `onPress` sets local state `hint = { id, k }`; render `<Text testID="reward-locked-hint">{`Clear ${k} more ${k === 1 ? 'level' : 'levels'} to unlock`}</Text>`
     under that row. It never calls `chooseArrowStyle`.
4. **Contrast rows:** add rows to `contrastAudit.ts` for:
   - the section header (`inkDim` on `surface`);
   - the locked row name at opacity .45 (record the composited colour as `fgColour`);
   - the hint (`inkDim`);
   - the "Next" caption.

   Re-point every existing `skin-picker-*` `site`/`sizeSite` line number to the new lines. Run `contrast.test.ts`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/ArrowStyleOptions.rewards.test.tsx src/ui/__tests__/SettingsSheet.test.tsx src/ui/__tests__/contrast.test.ts`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 6: Reveal card

**Files:**
- Create: `src/ui/RewardRevealCard.tsx`
- Test: `src/ui/__tests__/RewardRevealCard.test.tsx`

**Interfaces:**
- Consumes: `ClearReward['unlock']` (Task 3); `StylePreview`; `skinBoardPalette` (`src/ui/skinBoardPalette.ts`);
  `REWARD_PATH`, `PATH_TOTALS`; `Icon` from `src/ui/icons.tsx` (`sparkle`).
- Produces:

  ```tsx
  <RewardRevealCard
    unlock={NonNullable<ClearReward['unlock']>}
    mode={'campaign' | 'daily'}
    levelNumber={number}
    points={number}
    palette={Palette}
    dark={boolean}
    reducedMotion={boolean}
    disabled={boolean}
    onUse={() => void}
    onKeep={() => void}
    onShown={() => void}
  />
  ```

  testIDs: `reward-reveal`, `reward-use`, `reward-keep`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/__tests__/RewardRevealCard.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RewardRevealCard } from '../RewardRevealCard';
import { REWARD_PATH } from '../rewardCatalogue';
import { InkNight } from '../theme';

const unlock = { entry: REWARD_PATH[0], pathIndex: 0, ownedSkins: 4 };
function card(mode: 'campaign' | 'daily', extra: object = {}) {
  const onUse = jest.fn(), onKeep = jest.fn(), onShown = jest.fn();
  const r = render(<RewardRevealCard unlock={unlock} mode={mode} levelNumber={3} points={3} palette={InkNight}
    dark reducedMotion={false} disabled={false} onUse={onUse} onKeep={onKeep} onShown={onShown} {...extra} />);
  return { ...r, onUse, onKeep, onShown };
}

test('campaign card: informative copy and both buttons', () => {
  const { getByText, getByTestId, onUse, onKeep, onShown } = card('campaign');
  getByText('NEW STYLE UNLOCKED'); getByText('Critter');
  getByText('Style 4 of 18 · unlocked on level 3');
  getByText('Little faces'); getByText('Up next: Cinnamon Roll · 5 levels');
  expect(onShown).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-use')); expect(onUse).toHaveBeenCalledTimes(1);
  fireEvent.press(getByTestId('reward-keep')); expect(onKeep).toHaveBeenCalledTimes(1);
  getByText('Play with Critter'); getByText('Keep current style · Next level');
});

test('daily card uses Use / Keep current style and the daily subtitle', () => {
  const { getByText } = card('daily');
  getByText('Use Critter'); getByText('Keep current style');
  getByText("Style 4 of 18 · unlocked on today's daily");
});

test('disabled while an ad is busy: presses do nothing', () => {
  const { getByTestId, onUse } = card('campaign', { disabled: true });
  fireEvent.press(getByTestId('reward-use'));
  expect(onUse).not.toHaveBeenCalled();
});

test('reduced motion renders no sparkles', () => {
  const { queryAllByTestId } = card('campaign', { reducedMotion: true });
  expect(queryAllByTestId('reward-sparkle')).toHaveLength(0);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/RewardRevealCard.test.tsx`
Expected: FAIL with "Cannot find module '../RewardRevealCard'"

- [ ] **Step 3: Implement**

Layout, in order, centred, on a `p.surface` card with radius 26, padding 20/16/16 and the existing panel shadow:

1. A badge pill "NEW STYLE UNLOCKED" (`p.heart` → `p.accent` is not available as a gradient in RN without a
   dependency, so use solid `p.accent` with `p.inkOnAccent` text).
2. The stage: a 210×104 dp rounded view filled with `skinBoardPalette(palette, style.spec, dark).bg`, containing
   `StylePreview` scaled ×3 (wrap it in a view with `transform: [{ scale: 3 }]` and enough box to fit 54×30 × 3). Add
   three `Icon name="sparkle"` (testID `reward-sparkle`) at fixed corners unless `reducedMotion` is true.
3. The name (`Type.panelTitle` size).
4. The subtitle per Global Constraints.
5. Three chips from `unlock.entry.chips`.
6. The primary `PressScale` (testID `reward-use`): "Play with {name}" or "Use {name}".
7. The secondary text button (testID `reward-keep`).
8. "Up next: {REWARD_PATH[pathIndex+1].name} · {k} level(s)", with `k = PATH_TOTALS[pathIndex+1] - points`. Omit it
   when there is no next entry.

Behaviour:
- `useEffect(() => { onShown(); }, [])`, once on mount.
- Motion: a Reanimated `useSharedValue(reducedMotion ? 1 : .94)` animated to 1 with
  `withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })` on mount. Only `transform: [{ scale }]` is
  animated. Opacity stays at the fixed value 1.
- Sparkles: a single opacity 0 → 1 → .6 sequence, about 600 ms total, decorative only.
- Both pressables pass `disabled` and have `accessibilityRole="button"`. The card root has
  `accessibilityViewIsModal` and `accessibilityLabel={`New style unlocked: ${name}`}`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/RewardRevealCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Checkpoint.**

### Task 7: GameScreen integration

**Files:**
- Modify: `src/ui/GameScreen.tsx`. Insertion points:
  - the win branch around lines 546–563 (`SaveSystem.registerSolve(perfect)`);
  - the review effect around line 700 (`if (!META_REVIEW_PROMPT || phase !== 'won' …`);
  - `panelContent` around lines 886–990;
  - the `onNextLevel`/`onDailyDone` callbacks.
- Test: `src/ui/__tests__/GameScreen.rewards.test.tsx`. Copy the mocking setup from
  `src/ui/__tests__/GameScreen.daily.test.tsx` (BoardView, ScreenScrim, Ads and feature-flag mocks), and add a
  getter for `META_REWARD_PATH`/`META_SKIN_PICKER` and a `Platform.OS = 'android'` mock.

**Interfaces:**
- Consumes: `recordRewardClear`, `markRevealSeen`, `rewardPathEnabled` (Task 3); `useRewards` (Task 4);
  `RewardProgressPill` (Task 4); `RewardRevealCard` (Task 6); `chooseArrowStyle` (`src/ui/arrowStyleSelection.ts`).
- Produces: the user-visible behaviour in spec §5.

- [ ] **Step 1: Write the failing test** (one scenario per test; drive a clear the same way `GameScreen.daily.test.tsx` does)

```tsx
// Key assertions; reuse GameScreen.daily.test.tsx's render/clear helpers.
test('a clear that does not cross a threshold shows the pill, not the card', async () => {
  // ledger initialised with totalSolved 0; clear one campaign level imperfectly
  // expect getByTestId('reward-pill'); expect queryByTestId('reward-reveal') null
});
test('crossing the threshold shows the card over the panel; Play with Critter selects it, then runs Next', async () => {
  // ledger at 2 points; perfect clear -> 4 points (Critter at 3)
  // getByTestId('reward-reveal'); press 'reward-use'
  // expect(getArrowStyle().id).toBe('critter'); expect(mockAds.showInterstitialIfDue).toHaveBeenCalled() after the press, not before
});
test('Keep current style leaves the selection and runs Next', async () => { /* press reward-keep; selection unchanged; next level loads */ });
test('daily unlock: Use Critter selects and returns home (Done)', async () => { /* daily mode; onHome called; no interstitial */ });
test('no store-review ask on a reveal clear', async () => {
  // META_REVIEW_PROMPT on; advance timers past REVIEW_DWELL_MS while the card is up; requestStoreReview not called
});
test('flag off: no pill, no card, no reward keys written', async () => { /* rewardPathEnabled false */ });
test('benchmark and tutorial clears earn nothing', async () => { /* recordRewardClear not called */ });
```

Write each test fully, following the helpers in `GameScreen.daily.test.tsx`. Initialise the ledger in `beforeEach` with
`initializeRewardLedger(memStore, true, { writable: true, totalSolved: 0, selectedNumericId: 0 })`, plus
`initializeArrowStyle(memStore, true)`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx`
Expected: FAIL (no pill or card rendered)

- [ ] **Step 3: Implement**

1. State:

   ```tsx
   const [clearReward, setClearReward] = useState<ClearReward | null>(null);
   const rewards = useRewards();
   ```

   Reset `setClearReward(null)` wherever the level or session loads. That is the same place other per-clear refs
   reset, e.g. where `newlyDiscoveredRef.current` is reset.
2. In the win branch, inside `if (!benchmarkMode)` and right after `SaveSystem.registerSolve(perfect)`:

   ```tsx
   setClearReward(rewardPathEnabled() ? recordRewardClear(dailyDay !== null ? 'daily' : 'campaign', perfect) : null);
   ```

   The tutorial branch is separate and untouched, so tutorials earn nothing.
3. Review effect: add `|| clearReward?.unlock` to the early-return condition and `clearReward` to its deps, so no
   review timer is armed on a reveal clear.
4. `panelContent` (won): after the `<Stars …/>` element, insert:

   ```tsx
   {panelPhase === 'won' && rewards && clearReward && !clearReward.unlock && (
     <RewardProgressPill state={rewards} earned={clearReward.earned} palette={p} />
   )}
   ```

5. Reveal: render the card in the same overlay as the panel, replacing `panelContent` while
   `panelPhase === 'won' && clearReward?.unlock`:

   ```tsx
   <RewardRevealCard unlock={clearReward.unlock} mode={dailyDay !== null ? 'daily' : 'campaign'}
     levelNumber={levelIndex + 1} points={rewards?.points ?? 0} palette={p} dark={dark}
     reducedMotion={reducedMotion} disabled={adBusy}
     onShown={() => markRevealSeen(clearReward.unlock!.pathIndex)}
     onUse={() => { chooseArrowStyle(clearReward.unlock!.entry.refId); dailyDay !== null ? onDailyDone() : onNextLevel(); }}
     onKeep={() => (dailyDay !== null ? onDailyDone() : onNextLevel())} />
   ```

   Use the existing variable that holds the dark-theme boolean in `GameScreen` (search for `paletteFor(`). The
   interstitial, scrim and review-flow ordering stays inside `onNextLevel`/`onDailyDone`, which is unchanged.

- [ ] **Step 4: Run all the tests**

Run: `npx jest src/ui/__tests__/GameScreen.rewards.test.tsx && npx jest --silent && npx tsc --noEmit -p .`
Expected: the new test passes; the full suite passes (baseline 119 suites / 2,062 tests plus the new ones); tsc exit 0.

- [ ] **Step 5: Checkpoint.**

### Task 8: Device verification, report and lessons

**Files:**
- Create: `artifacts/REWARD-01/` (never committed)
- Create: `docs/next-level/reports/REWARD-01.md`
- Modify: `docs/engineering-lessons.md` (one entry, only for something actually learned)

- [ ] **Step 1: Build a test-ads APK.** Use `artifacts/LOG-GATE/build-test-apk.sh` as the template and add
  `EXPO_PUBLIC_META_REWARD_PATH=1`. Use ABIs `arm64-v8a,x86_64`. Prove the bundle is test-ads only, and that it
  contains "NEW STYLE UNLOCKED" and "Coming up".
- [ ] **Step 2: Back up the emulator save.**

  ```bash
  adb -s emulator-5556 shell su 0 cp /data/data/com.danteb.arrows/databases/RKStorage /data/local/tmp/RKStorage.bak
  ```

- [ ] **Step 3: Fresh-save run.**
  1. With the app stopped, use `sqlite3` on the device database (table `catalystLocalStorage`, columns `key` and
     `value`) to delete every `arrows_reward%` row and set `arrows_total_solved` and `arrows_current_level` to 0.
  2. Install with `install -r -d`, launch, and clear levels until Critter unlocks.
  3. Capture: the pill (screenshot), the reveal card in light and dark (screenshots), "Play with Critter" leading into
     a Critter board (screenshot), and the picker with "Your styles" and "Coming up" (screenshot).
- [ ] **Step 4: Upgrade run.**
  1. Restore the backup.
  2. Set `arrows_total_solved=10` and `arrows_skin=1` (Cinnamon), and delete the `arrows_reward%` rows.
  3. Launch.
  4. Expect: no reveal card; Critter and Cinnamon are owned; Cinnamon is still selected; no "new" dots. Capture the
     picker.
- [ ] **Step 5: Reduced motion and interstitial order.**
  - With `settings put global transition_animation_scale 0` (restore it after), confirm the card has no sparkles.
  - Make an interstitial due: two finished games since the last ad (see `src/ui/adPacing.ts`). Then cross a threshold
    and record the screen: card, press, test interstitial, next level. Close the test ad with BACK (never tap it).
- [ ] **Step 6: Flag off.** Build without `EXPO_PUBLIC_META_REWARD_PATH`. Confirm the picker is the flat list, the win
  panel has no pill, and `sqlite3` shows no `arrows_reward%` keys after a clear.
- [ ] **Step 7: Restore the emulator save from the backup.** Write `REWARD-01.md`:
  - every command;
  - a screenshot index;
  - jest/tsc counts;
  - anything UNVERIFIED and why;
  - a list of anything changed outside this plan.

## Self-review notes (controller)

- **Spec coverage:**

  | Spec section | Task |
  | --- | --- |
  | §1 earning | Tasks 1, 3, 7 |
  | §2 catalogue and path | Task 2 |
  | §3 saved data (plus the picker-seen key, flagged as an amendment) | Task 3 |
  | §4 existing-player credit | Task 3 |
  | §5a pill | Tasks 4, 7 |
  | §5b reveal card | Tasks 6, 7 |
  | §5c picker | Task 5 |
  | §6 flag | Tasks 1, 3, 7 |
  | §7 content pipeline | Not code (later rounds) |
  | §8 verification | Tasks 3–8 |

- **Amendments to raise with the owner:**
  - the fifth key, `arrows_reward_picker_seen`;
  - the reveal subtitle "unlocked on level L" instead of "earned in K levels".

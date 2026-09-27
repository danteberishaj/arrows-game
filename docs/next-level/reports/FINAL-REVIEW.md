# FINAL-REVIEW: whole-branch review of `87ec519..HEAD` (next-level)

- **Reviewer:** Claude (final whole-branch reviewer). Read-only: no source edits, no state-changing git, no builds, no
  emulator. This file is the only one written.
- **Range:** `git log 87ec519..HEAD` = 58 commits, 199 files (+42,102 / −650). HEAD = `df1fa8b`.
- **Method:** I read the integration hubs myself (`App.tsx`, `GameScreen.tsx`, `HomeScreen.tsx`, `BoardView.tsx`,
  `screenHandoff.tsx`, `ScreenScrim.tsx`, `themeTransition.ts`, `collectionSync.ts`, `GalleryScreen.tsx`,
  `HeaderButton.tsx`, `PressScale.tsx`, `feedbackCurves.ts`, `heartPip.ts`, `boardCamera.ts`, `reviewPrompt.ts`,
  `reviewPolicy.ts`, `storage.ts`, the flag modules). Three read-only helper reviews covered persistence, the W3
  generator and W7/docs in depth. I re-checked every finding below against code before listing it. Their probes ran
  in the session scratchpad and never in the repo.
- **Register:** EXECUTED = ran it and saw the output. READ = inferred from reading the code, not run.
  UNVERIFIED-DEVICE = needs an emulator or phone.

## Gates (EXECUTED at HEAD `df1fa8b`)

| Gate | Result |
|---|---|
| `npx jest` | **112 / 112 suites, 1866 / 1866 tests passed, 12 / 12 snapshots**, 2 projects (core, ui). `levelGenerator.test.ts` alone took 78.8 s of the 80.4 s run. |
| `npx tsc --noEmit` | **exit 0, 0 errors** |
| v1 / daily fingerprints | Pinned: `d01abbd8` at `src/core/__tests__/levelGenerator.test.ts:202`, `ff12d7b5` at `src/core/__tests__/dailyBoard.test.ts:93-99`. Both are in the default run above and passed. |
| `GEN_V2_ENABLED` | `false` (`src/core/generatorVersion.ts:41`). |

## Verdict

**APPROVE, with the doc and low-risk items below as follow-ups.** No finding is CRITICAL or HIGH. No flag-OFF
behaviour leak into gameplay, ads or persistence was found. The two items worth doing before a release are both in
the release process, not in code:
- the missing in-app privacy-policy link (finding 1);
- DESIGN.md's wrong lose-panel delay (finding 2).

```
Verdict: APPROVE (follow-ups listed; none blocks merging the branch, #1 blocks a store release)
Pre-fix failure reproduced: not applicable (whole-branch review, not a single fix); per-finding evidence below
Fix verified against original scenario: n/a; gates EXECUTED: npx jest 1866/1866, npx tsc --noEmit exit 0
Tests added/changed — failing path they cover: n/a (review adds none); test gaps listed as findings 9 and 15
Runtime/device verification: UNVERIFIED — nothing was run on a device (read-only review, no emulator)
Out-of-scope changes: none by this review
Risks remaining: findings 1-17
```

**Attack on this verdict.** The strongest case against APPROVE is a flag-OFF leak I did not see. So I looked
specifically for:
- code that runs regardless of flags;
- a stale async continuation after unmount (the review wait: ruled out by the full-screen overlay);
- a feedback release racing a new GameScreen (ruled out: only GameScreen uses feedback, and no route goes from game
  straight to game);
- a v1 byte drift beyond the pinned range (ruled out to 3000 + 400 random indices by the old-vs-new comparison).

What survives is findings 8 and 14 (hand-off side effects), which a device capture would settle.

## Ranked findings

Severity uses the project's scale. "Flags" names the flags that must be ON for the finding to matter.

### 1. MEDIUM (release gate), PLAUSIBLE: the flags-default build has no in-app privacy-policy link
- `src/ui/settingsRows.ts:17`: `PRIVACY_POLICY_URL = ''`.
- `src/featureFlags.ts:174`: `META_SETTINGS_SHEET` is off by default.
- So a store build carries no policy link anywhere in the app. The app uses AdMob, and so the advertising ID.
- My understanding of Play's User Data policy is that such an app needs the policy both in the Console and inside
  the app. I did not re-read the current policy text (no network), hence PLAUSIBLE.
- It is tracked as P-2 in `docs/data-safety.md:462`, but nothing lists it as a release blocker next to W7-07.
- **Recommend:** make "policy URL set and Settings sheet on (or another in-app link)" an explicit release gate.

### 2. MEDIUM (doc), CONFIRMED: DESIGN.md says the lose panel appears 350 ms after the last heart; the code says 690 ms
- `DESIGN.md:344` says "350 ms after the last heart is lost (`LOSE_PANEL_DELAY_MS`, `gameSessionLifecycle.ts:18`)".
- The code is `LOSE_PANEL_DELAY_MS = BLOCKER_FLASH_MS + FEEDBACK_CLEANUP_MARGIN_MS`
  (`src/ui/gameSessionLifecycle.ts:18`), which is 650 + 40 = **690 ms** (`src/ui/feedbackCurves.ts:15,17`). READ.
- The 350 predates the range (`87ec519:DESIGN.md:252`), but this range rewrote the sentence to cite the constant and
  kept the wrong number.
- DESIGN.md is the spec that motion bands and the post-clear timeline are measured against, so a wrong number there
  will be re-used.

### 3. LOW, CONFIRMED: DESIGN.md's shipped empty-board range describes a flag-on build
- `DESIGN.md:350` says "today's flat delay leaves 263–360 ms of empty board".
- The source it cites (`src/ui/gameSessionLifecycle.ts:22-24`) says the flags-default board-edge exits leave
  **130..270 ms**. About 265..362 ms applies only with `META_EXIT_TO_SCREEN_EDGE` on. READ.

### 4. LOW, CONFIRMED: DESIGN.md `file:line` citations written in this range now point at the wrong code
EXECUTED with `sed -n` on each cited line:
- **Vestibular recentre / fling:** DESIGN.md cites `BoardView.tsx:499,505,753,760`. The code is at `:433,439` (after
  CAMERA-REFIT-AFTER-AD moved it into `centreOnArrow`) and `:796,803`. `:499` is a `useLayoutEffect` and `:753` a
  closing paren.
- **Reduced-motion bump hold:** `BoardView.tsx:1315` is an `animatedProps={shaftProps}` line.
- **Press scale 0.94:** DESIGN.md cites `HeaderButton.tsx:32`, `HomeScreen.tsx:86` and `GameScreen.tsx:281,297`.
  These are an `accessibilityLabel` prop, `const [showBanner]`, `const terminalTransition` and a comment. The press
  transform is at `HeaderButton.tsx:85`, `HomeScreen.tsx:198` and `GameScreen.tsx:932,961`.
- **Heart pop:** `GameScreen.tsx:382-386` (`DESIGN.md:295`). It is now `:1304,1334-1336`.
- **Play breathing:** `HomeScreen.tsx:145` (`DESIGN.md:414`). It is now `:127`.
- DESIGN.md holds 82 such citations into these five files. They drift on every edit.
- **Recommend:** cite symbols (`centreOnArrow`, `HEART_PIP_SPRING`), not line numbers, or add a check script.

### 5. LOW, CONFIRMED: a corrupt collection mask with a valid fold pointer permanently drops collection bits
- `src/core/saveSystem.ts:232-243`: `readShapeMasks` sanitizes a corrupt `arrows_shapes_seen_lo` / `_hi` to 0, and
  `writeShapeMasks` then writes "0 + new bits" over it.
- `shapesThroughLevel` (`:661-663`) is read independently. If it is valid, nothing ever re-folds the levels below it.
- Helper probe on the real `SaveSystem` over a map store (EXECUTED by the persistence helper): the truth for levels
  0..59 was 57145023; after 23 clears the store held 38093871, and the lost bits were never recovered.
- `docs/next-level/reports/W4-07.md:285` says "`lo = -5` reads as 0 and is rewritten with the truth". That holds only
  when the pointer is also corrupt. The one test (`src/ui/__tests__/storage.test.ts`, "a corrupt or partial
  collection…") corrupts both, so it never exercises this path.
- Impact: gallery bits only, never progress, and it needs single-key corruption.
- **Fix:** when either mask reads corrupt, treat the pointer as 0. A re-fold only ORs bits, so it is idempotent.

### 6. LOW, CONFIRMED: a fold pointer above `currentLevel` silently freezes the collection
- `src/core/saveSystem.ts:677-681` (`if (through >= target) return 0;`), and `recordCampaignClear` at `:698`.
- A corrupt pointer that is larger than the current level makes every fold a no-op. Every clear then defers, until
  the player passes the bad value.
- This looks the same as the documented after-reset state, so nothing ever flags it. EXECUTED (helper probe S4:
  pointer 100000 at level 50 wrote nothing).
- **Fix:** clamp the pointer to `currentLevel` on read, or reset it when it exceeds the level.

### 7. LOW, CONFIRMED: comments that now lie
- `src/ui/gameSessionLifecycle.ts:78` says "PERF and DEV_LEVEL runs record no collection bits". That is false for
  DEV_LEVEL: `GameScreen.tsx:548-563` gates only on `benchmarkMode` (= PERF_MODE). A DEV_LEVEL=500 clear on a
  level-10 save writes `arrows_current_level = 501`, and the menu fold then marks 490 unplayed levels. With
  `EXPO_PUBLIC_DEV_GEN_VERSION=2`, a v2 board is dealt but the fold records the v1 shape (`saveSystem.ts:215-218`
  resolves versions without the DEV branch). Dev builds only, but this matters if a dev build is ever run over a real
  save. Fix the comment, or gate on `DEV_LEVEL_INDEX` / `DEV_GEN_VERSION` too.
- `src/featureFlags.ts:4-5` tells the release audit to check `motionFlags.ts`, which does not exist (EXECUTED `ls`).
  The W2 flags live in `featureFlags.ts` itself. The list also misses `boardGridFlag.ts` and `missedMarkFlag.ts`.
  The line predates the range, but this range added 9 flags under it.
- `src/ui/reviewPrompt.ts:7` says the won phase commits "WON_PANEL_DELAY_MS (450 ms) after the last arrow leaves".
  It is 450 ms after the clearing tap, and with `META_POST_CLEAR_TIMELINE` it is exit + 350 ms. The dwell is measured
  from the commit, so the behaviour is right and only the comment is wrong.

### 8. LOW, PLAUSIBLE: a screen left during its 180 ms FadeIn can show over its successor for up to two frames
- `src/ui/screenHandoff.tsx:148-163`: a leaving slot sets `opacity: 0` by style, but its `entering`
  `FadeIn.duration(180)` layout animation keeps writing opacity on the UI thread until it finishes.
- The later slots in tree order (game, daily, gallery; `App.tsx:343-359`) draw above the menu. So leaving
  gallery → menu, or game → menu, within 180 ms of entering could show the leaving screen at part opacity for the
  `LEAVE_FRAMES = 2` hand-off frames. Before PERF-DEADTAG it was removed in the same commit.
- `useStopWhenScreenLeaves` cancels only registered shared values, not layout animations. Taps are safe
  (`pointerEvents="none"`).
- READ, UNVERIFIED-DEVICE. A frame-by-frame capture of a quick in-and-out would settle it. The fix would be to
  cancel the entering animation, or skip `entering` on a leaving slot.

### 9. LOW, CONFIRMED (test gap): nothing pins fold slices interleaved with campaign clears
- The sliced menu/gallery fold (`src/ui/collectionSync.ts`) and the O(1) clear path
  (`saveSystem.ts:recordCampaignClear`) both write the pointer.
- The helper's probe ran 200 random interleavings of `syncCollection(1..20)` with `setCurrentLevel` +
  `recordCampaignClear`. All 200 matched the full-generator truth (EXECUTED). So the logic is sound: JS is
  single-threaded, and the fast path requires `pointer === levelIndex`.
- No committed test covers it, and it is the collection's only concurrency-shaped path. Worth a property test.

### 10. LOW, PLAUSIBLE: a v2 rollback while a player's fold is behind records the wrong shapes
- `src/core/generatorVersion.ts:37-39` documents rollback (set `GEN_V2_ENABLED` back to false) only as "a board is
  re-dealt as v1 once".
- After a rollback, `campaignShapeName` (`saveSystem.ts:215-218`) resolves every index to v1. So levels between the
  fold pointer and `currentLevel` that were played as v2 are folded as v1 shapes.
- 194 of levels 0..199 have a different v1 and v2 shape (helper probe S3, EXECUTED). A caught-up fold is unaffected.
- Latent: v2 has never shipped. Add it to the rollback note before the flip.

### 11. LOW, CONFIRMED (disclosed): expo-store-review ships in every native build, flag OFF included
- `package.json` adds `expo-store-review ~57.0.3`, and `expo.autolinking.*.exclude` lists only expo-audio and
  expo-haptics. So `com.google.android.play:review` and its dialog activity are in the binary with
  `META_REVIEW_PROMPT` off.
- JS never loads it with the flag off (`reviewPrompt.ts:52-55`, lazy `require`, gated at `GameScreen.tsx:699-714`).
- Already recorded in `docs/data-safety.md` (ev-18 / P-8). The next AAB must be re-dumped before the Data safety form
  is final.

### 12. LOW, PLAUSIBLE (flags: META_SETTINGS_SHEET + META_THEME_TRANSITION): Settings can open during the theme dip
- The theme scrim is `pointerEvents="none"` (`src/ui/ScreenScrim.tsx:120`), and the gear sits beside the theme button
  (`HomeScreen.tsx:252-272`). A tap during the 180 ms cover leg opens the sheet.
- The sheet's Modal is its own window above the scrim, so the "under full cover" swap re-colours the open sheet in
  one visible frame.
- Its `onShow` sets the status bar from the pre-swap `dark` (`SettingsSheet.tsx:93-95`). App's `<StatusBar>` probably
  corrects it on the next render.
- Cosmetic. Both flags are OFF. READ.

### 13. LOW, CONFIRMED (process): SAVE-GUARD has no report
- Commit `05ac4c5` changes storage behaviour after a failed hydrate (`src/ui/storage.ts:17-24,38-41,61`): every write
  becomes memory-only for the session.
- There is no `docs/next-level/reports/SAVE-GUARD.md` (EXECUTED `ls`), so no evidence block and no wipe-risk note.
- Known, by-design side effect: after a failed hydrate, that session's settings toggles, consent answer and telemetry
  identity are not saved either.
- The change itself is correct and tested: a level-37 save survives a failed-read cold start.

### 14. LOW, PLAUSIBLE: a leaving screen keeps its JS work running for the two hand-off frames
- The left HomeScreen's sliced collection fold (`collectionSync.ts`, 3 ms per rAF slice) and its effects stay live
  until the hand-off removes the slot. So up to two 3 ms slices can land in the successor's first frames.
- The same applies to a left gallery's fold and its BackHandler.
- Bounded (≤ 2 × 3 ms, only if the fold is mid-run) and no correctness issue. It is still a small add to the most
  expensive frames, the game's mount, under a "nothing may make performance worse" rule.
- The fix is cheap: stop the fold when `useStopWhenScreenLeaves`' `isLeaving()` turns true, or from the slot's
  leaving layout effect. READ.

### 15. LOW, CONFIRMED (test gap): the corrupt-mask test cannot see finding 5
- The storage test corrupts both the mask and the pointer together. So the "reads as 0 and is rewritten with the
  truth" claim in W4-07.md is covered only in the case where it happens to hold.
- Add a case with a valid pointer (see finding 5).

### 16. LOW, CONFIRMED: the V2-FINISH tripwire test has gone vacuous and its comment is wrong
- `src/core/__tests__/v1Floor.test.ts:289-302`: the comment says that today `createLevelSession` calls `generate`
  without `switchLevel`. V2-WIRE (`038fdda`) wired it (`src/ui/gameSessionLifecycle.ts:104-106`).
- So `wired` is always true, and `expect(GEN_V2_ENABLED).toBe(false)` never runs. The test only checks that the file
  contains `LevelGenerator.generate(`.
- No coverage is lost, because `generatorVersion.test.ts:18` asserts the flag. But the test title promises a guard it
  no longer makes. READ.

### 17. LOW, CONFIRMED: W3 comments that understate or mis-cite
- `src/core/curve.ts:112` says the heaviest board over 0-9999 is 190 arrows. `RE-CEILING.md` records 190 for fresh
  installs and **195 for existing players**, the population the v1 floor applies to.
- `src/core/shapeBag.ts:365` says "the range guard in `buildWindow` stays". The guard is in `shuffledSet` (`:395`).
  Behaviour is correct: both paths go through `shuffledSet`.
- `src/core/shapeLibrary.ts:110,116`: the pool headers list the wrong shapes (Diamond is in SimplePool; the "complex"
  list names Simple/Medium shapes). These predate the range, but W3-03 removed the field doc that said the same thing
  and left these headers.
- `EXPO_PUBLIC_DEV_GEN_VERSION=2` (`src/perfMode.ts:64-74`, not `__DEV__`-gated, per ruling F10) deals v2 on a real
  save while the fold records v1 shapes. Only a build that sets it can hit this, and nothing in the repo does (no
  `.env*`). It is build hygiene: release profiles must never set it. Covered by finding 7's comment fix.

## W3 generator (byte-identity, EXECUTED by the generator helper in the scratchpad)

- **Old vs new generator.** `git archive 87ec519 src/core` was compared against HEAD by serialising shape, rows,
  cols, hearts, difficulty, arrow count, target cells, mask and every arrow's `toLine()`.
  - Campaign levels 0-2999, 400 random indices up to 2e9, and the int32 edges: **0 differences**. The same holds with
    `{switchLevel: 5}` passed to v1, and for `shapeNameForLevel`.
  - Daily days 0-3999: **0 differences**.
  - Old vs new `DotNetRandom` over 20,015 seeds × 200 draws (0, ±1, ±MSEED, Int32 min/max, 2^31, 2^32+5, 1e12, 0.5,
    NaN, 20k random): **0 differences**.
- **Against real .NET 9.** `ExactDotNetRandom` matches `System.Random(seed).NextDouble()` on 3015 / 3015 seeds × 300
  draws. The frozen `DotNetRandom` diverges above MSEED, as documented and required.
- **What the pins cover.**
  - The v1 pin covers levels 0-299 (shape, rows, cols, arrow lines) plus goldens at 239, 917, 935, 3827 and 5363.
  - The daily pin covers days 0-364.
  - Past index 299, only those five goldens guard v1. That is acceptable given v1's index-flat design; a sparse-stride
    pin (every 97th index up to 100k) would harden it cheaply.
- **Nothing v2 runs with `GEN_V2_ENABLED` false.** `resolveGenVersion` returns 1, and the stamp and the v1 fold path
  skip v2 entirely. shapeBag builds nothing at import (WeakMaps and lazy caches only). v1's `fillMask` allocates
  nothing new when `clearableBias` is undefined.
- **Constants match the reports.** The capacities also match: X at 645 ≥ 635 > Diamond at 613, and the four new
  shapes are at 702-758.
  - `CEILING_BASE_CELLS = V1_FLOOR_BASE_CELLS = 354` (RE-CEILING option B).
  - Tier cell targets 537 / 635.


## Areas checked and clean

- **Flag defaults.**
  - Every `META_*` in `src/featureFlags.ts` and every `ART_*` in `src/ui/artConfig.ts` has the form
    `process.env.EXPO_PUBLIC_X === '1'`.
  - Literal constants: `REMOTE_KILL_SWITCH = false`, `TELEMETRY_TRANSPORT = false`, `COLLECTION_SYNC_ENABLED = true`
    (the approved invisible recorder), and `EXIT_COMBO_ESCALATES = true`, which predates the range. EXECUTED grep.
- **Flag-OFF paths in GameScreen.**
  - Review timer and listener are gated at `:699`.
  - The refill token never changes (`:819-823`), and `usePipPopEffect` resolves to `useEffect`.
  - The level scrim and panel presence are null.
  - The post-clear delay stays at 450 (`:529-531`).
  - The silhouette memo returns `''` without computing.
  - `depthTitleSpacing` / `depthSubSpacing` are `null`, so the spreads add nothing.
  - HeaderButton ignores `icon`, and `CONTINUE_A11Y_LABEL` is not spread.
  - The only unflagged visible change is the W5-03 counter slot. W5.md and the W5-03 report classify it as a defect
    fix with no flag, which is allowed.
- **Ads rulings.**
  - A daily clear never calls `registerGameFinished` or `setCurrentLevel` (`GameScreen.tsx:548-563`), and neither
    does a daily loss (`:641-643`).
  - No new interstitial call site, no cooldown or cap, no free hint. `onHint` still grants nothing without a reward.
  - `Ads.interstitialDue` is read-only.
  - The review ask declines when the next Next would show an interstitial. So Next's wait on a review flow can never
    delay into an ad.
- **Review prompt × panel × scrim × daily Done.**
  - The ask is armed on the won commit and cancelled on phase change, unmount and background.
  - Next and Done cancel a pending ask and wait at most 3 s for an in-flight flow. Done is single-shot (`:780-788`).
  - The won overlay covers the header (`styles.overlay` top 0), so ‹ cannot be pressed during the wait and leave a
    stale `onNextLevel` / `onDailyDone` to run after unmount. I checked this path specifically.
- **Heart refill pop × panel motion × scrim.** `refillPending` depends on the panel reaching `hidden`, and
  `overlayPresence` settles each leg deterministically: animation callback, JS backstop timer, or AppState active.
  `loadSession` clears `refillPending`.
- **Camera hold × level transition × ads.**
  - A new board always re-fits and clears the held camera (`BoardView.tsx:525`, `newBoard = true`).
  - An interstitial's layout round trip either restores the old board's pose before `loadLevel` or re-fits after it.
    Both orders end at the right camera for the new board. READ.
- **Screen hand-off × settings × gallery.**
  - The sheet is a Modal mounted only while open, so no navigation can happen under it.
  - A leaving slot is `pointerEvents="none"` and hidden from accessibility.
  - A screen shown again within the hand-off frames remounts on a fresh key.
  - `prepareFeedback` / `releaseFeedback` are used only by GameScreen, and every route between two GameScreens goes
    through the menu. So the delayed unmount cannot release audio under a newly mounted game.
- **Theme dip, flag OFF.** `useThemeToggle` returns the old one-commit `flip` (the write stays inside the updater, as
  before). The only cost is one extra `useSharedValue(0)` in App.
- **Persistence.**
  - No commit in range touches `Keys` / `PersistenceKeys` or the storage.test exact-array assertion
    (`storage.test.ts:40` is unchanged).
  - SCHEMA_VERSION, `migrate()` and `resetProgress()` are untouched.
  - Every new write is gated by `persistenceHealthy` and SAVE-GUARD's `writeThrough`.
  - `stampGenSwitchLevel` is a no-op with `GEN_V2_ENABLED` false.
  - Masks use bits 0-29 and end every OR in `>>> 0`.
  - Review keys are written only with the flag on.
  - With every flag off, the only new writes are the three collection keys.
- **Release-crash surfaces.**
  - `reviewDiag` checks `__DEV__` at call time.
  - The measure-clear sink is installed only under `__DEV__` and dead-code-eliminated without its env var.
  - The Settings version row falls back to `unknown`.
  - `Linking.openURL` rejections are swallowed.
  - The `expo-store-review` absence is caught.
  - `DEV_LEVEL_INDEX` / `DEV_GEN_VERSION` are null unless their env vars are set.
- **Privacy.**
  - No new release-build logging: three new `console.log` sites, each behind `__DEV__`, CAPTURE_DIAG or its own env
    var.
  - No user data in any URL: a constant policy URL and a bare `mailto:`.
  - The regenerated privacy HTML is byte-identical to `docs/privacy-policy.html` (EXECUTED by the W7 helper).
  - The "26 shapes" listing claim re-measured as 26 at HEAD (EXECUTED by the W7 helper).
- **DESIGN.md numbers that match code** (W7 helper, READ): scrim 180 / 180, panel 180 / 260 / 180 / 0.94, empty-board
  hold 350, reveal 0, refill 1/1.35 with spring 9 / 240, `BLOCKED_BUMP_PEAK_K` ≈ 0.3196, press spring
  90 ms / 15 / 400 / 1 / 1e-4, exit edge 1.15 / 0.6, star stagger 250 + 170, type tokens.
- **Type tokens (W5-08).** Each token matches the pre-range style. `adSub`'s family came from W5-09's labelled
  font fix (`e653040`), not from W5-08.

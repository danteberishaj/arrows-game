# FINAL-FIX — the fix pass after FINAL-REVIEW (findings 2-10, 12-17)

- **Base:** `a19c33f` (branch `next-level`). Four patches, applied in order, reproduce the working tree byte for byte:
  `artifacts/FINAL-FIX/snapshot/01-docs.patch`, `02-collection-integrity.patch`, `03-comments-tests.patch`,
  `04-ui-edge.patch` (gitignored). This report ships in patch 04.
- **Not touched, by instruction:** finding 1 (the flags-default build has no in-app privacy-policy link:
  `PRIVACY_POLICY_URL = ''` in `src/ui/settingsRows.ts`, `META_SETTINGS_SHEET` off) stays an **owner item and a store
  release blocker**: a release needs the policy URL set and the Settings sheet on, or another in-app link. Finding 11
  (`expo-store-review` linked into every native build, flag off included) is **accepted** and already disclosed in
  `docs/data-safety.md` (ev-18 / P-8); the next AAB must be re-dumped before the Data safety form is final.
- **Constraints kept:** no state-changing git, no emulator, no build. Evidence under `artifacts/FINAL-FIX/evidence/`.
- **Labels:** **EXECUTED** (run, output seen), **INFERRED** (read, not run), **UNVERIFIED-DEVICE**.

## Gates (EXECUTED on the final tree)

| Gate | Result |
|---|---|
| `npx jest` | **112 / 112 suites, 1893 / 1893 tests, 12 / 12 snapshots** (base: 1866; +27 = 17 core collection, +4 storage, +1 interleaving, +2 hand-off, +1 menu fold, +1 settings, +2 theme, −1 removed tripwire). `gate-jest.txt` |
| `npx tsc --noEmit` | **exit 0, 0 errors**. `gate-tsc.txt` |
| Each commit of the series | The tree after 01+02: jest **1888 / 1888**, tsc exit 0; after 01+02+03: jest **1887 / 1887**, tsc exit 0 (`stage02-tree-jest.txt`, `stage03-tree-jest.txt`; run in the working tree with the later patches' files set back to `a19c33f`, then restored and checked byte-equal). The four patches applied in order with `git apply` to a `git archive a19c33f` copy reproduce all 29 changed files byte for byte, and they cover exactly the files `git status` lists. |
| `npx tsx scripts/contrast-audit.ts` | **144 gated rows, 0 FAIL** (only `contrastAudit.ts` line sites into `HomeScreen.tsx` moved; no colour changed) |
| Fingerprints | v1 `d01abbd8` (`levelGenerator.test.ts:202`), daily `ff12d7b5` (`dailyBoard.test.ts:99`), v2 `71dc3369` (`levelGenerator.test.ts:386`) and `ea5e4bf5` (`v1Floor.test.ts:286`): pins unchanged, all in the passing run. The only generator-file edits are comments (`curve.ts`, `shapeBag.ts`, `shapeLibrary.ts`; diff checked for non-comment lines: none). |

## Patch 01 — docs (findings 2, 3, 4, 13)

Files: `DESIGN.md`, `docs/next-level/reports/SAVE-GUARD.md` (new).

- **Finding 2:** the lose panel appears **690 ms** after the last heart (`LOSE_PANEL_DELAY_MS` = `BLOCKER_FLASH_MS` 650
  + `FEEDBACK_CLEANUP_MARGIN_MS` 40), not 350. The same sentence also said the win panel comes "450 ms after the last
  arrow leaves"; it is 450 ms after the clearing tap (the flag-OFF path, `GameScreen.tsx:531`), so that was fixed too.
- **Finding 3:** the flags-default empty board is **130–270 ms** (board-edge exits), about 265–362 ms with
  `META_EXIT_TO_SCREEN_EDGE` on (source: the comment at `gameSessionLifecycle.ts:22-24`).
- **Finding 4:** all **213 `file:line` citations** in DESIGN.md (`.ts/.tsx/.kt/.swift/.js/.json`) were re-resolved,
  not only the ones written in the range. Method (EXECUTED, scripts in the session scratchpad): for each citation, the
  commit that last wrote its DESIGN.md line (`git blame`) gives the cited code as it was then; a line diff to
  `a19c33f` maps each cited line; lines whose content changed were resolved by hand against the code; then every
  citation's target line at the new tree was printed and read. Moved code: the camera fit now lives in
  `boardCamera.ts` (cited there). Citations that were wrong when written were fixed too (the press-scale ones the
  review named, `HeaderButton.tsx:35` for the sound glyph). Patches 02 and 04 re-map the citations whose lines they
  shift (`saveSystem.ts`; `HomeScreen.tsx`, `screenHandoff.tsx`, `App.tsx`), so the citations are correct at every
  commit of the series. **EXECUTED:** the target text of every citation at the final tree equals its target text at
  `a19c33f` + patch 01, except the one line patch 04 rewrote (`App.tsx:262`, which gained `themeChanging`).
- **Stale facts found while resolving, fixed (READ against code):** the game header's "LEVEL N" is 24 Bold
  (`Type.gameLevel`), not 18; a spent heart is a `pipSpent` outline, not `heartLost` at 0.85 opacity (two places:
  Hearts and Heart pop); the sound toggle when off is `glyphOff` with a diagonal strike, not `heartLost`.
- **Finding 13:** `SAVE-GUARD.md` written from commit `05ac4c5` (message, diff, test). **EXECUTED:** pre-fix failure
  reproduced by putting `src/ui/storage.ts` at `05ac4c5^` in the working tree (restored and checked byte-equal
  afterwards): the SAVE-GUARD test and the collection failed-hydrate test fail (`multiSet` called; the level key
  written); at `a19c33f` all 4 matching tests pass (`01-saveguard-prefix-RED.txt`, `01-saveguard-GREEN.txt`). Wipe
  risk: it removes the only overwrite path; no schema change.
- Not done: DESIGN.md still cites line numbers, so they will drift again with the next edit to a cited file (finding
  4's "cite symbols or add a check" recommendation). See Concerns.

## Patch 02 — collection integrity (findings 5, 6, 15, 9)

Files: `src/core/saveSystem.ts`, `src/core/collection.ts` (comment), `src/ui/collectionSync.ts` (export only),
`src/core/__tests__/saveSystem.test.ts`, `src/core/__tests__/saveSystem.genVersion.test.ts`,
`src/ui/__tests__/storage.test.ts`, `src/ui/__tests__/collectionSync.test.ts`,
`src/ui/__tests__/GameScreen.collection.test.tsx`, `DESIGN.md` (3 `saveSystem.ts` citations re-mapped).

### The fix

One reader, `readCollection(currentLevel)`, decides whether the fold pointer may be trusted. The pointer claims that
the masks hold the shapes of levels `[0, pointer)`. It now reads as **0** (so the next fold rebuilds from the
generator) when:

1. **a stored mask is not exactly a 30-bit value** (negative, fractional, NaN, beyond 2^53, or a stray bit 30+). Its
   readable bits are kept (`sanitizeMask`, unchanged), and the rebuild's first write rewrites it canonical;
2. **both masks are empty while the pointer is above 0.** Folding level 0 always sets a bit, and `HydratedIntStore`
   drops a value `parseInt` cannot read, so this is what an unparseable mask (for example a garbage string) looks
   like at the core;
3. **the pointer is above `currentLevel`** (finding 6).

`syncCollection` and `recordCampaignClear` use that pointer, so a clear over a damaged collection defers instead of
writing "0 + one bit", and `registerDailyClear` over damaged masks keeps its daily bit and writes the pointer to 0 in
the same call, so the rebuild still happens. `newlyDiscovered` is false over damaged masks, since the unreadable mask
may have held the bit.

**Why 0 for a pointer above the level, not `currentLevel`:** such a pointer comes from a progress reset (the pointer
is kept, the level is not; no UI caller today) or from corruption, and the two look the same. `currentLevel` is safe
only in the reset case; after corruption, levels below it may never have been folded. 0 is right for both: a re-fold
only ORs bits, and it costs one sliced catch-up of `currentLevel` levels, the same path an upgrading player runs.

### Why no earned bit is lost (argument, then the tests that check it)

- **Invariant:** the stored masks hold the shapes of every level below the effective pointer. On read it holds by
  construction (the effective pointer is 0 whenever the masks cannot back it up). Each write keeps it: masks are
  written as `sanitizeMask(raw)` OR the newly folded levels `[through, folded.through)`, together with the pointer
  `folded.through`, in one synchronous call; the damaged-daily path writes pointer 0.
- **Masks never lose a readable bit:** every mask write is `readable | new bits` (`foldLevels` and `markSeen` only OR).
- A drained fold ends at `pointer = currentLevel`, so the masks then hold every campaign level below it, and every
  such level was cleared (`setCurrentLevel(i + 1)` runs only on a clear).
- **What no fix can recover:** daily-only bits that sat inside a mask value nobody can read (the stored string or
  number itself is unreadable); BASE lost those too (it read the mask as 0). **What this does not detect:** damage
  that still looks valid, e.g. a pointer corrupted from 5 to 40 at level 50 over intact, non-empty masks, or a mask
  string like `"12abc"` that `parseInt` reads as 12. Those remain as on BASE.

### TDD evidence

- **RED (EXECUTED, BASE `saveSystem.ts`):** `npx jest src/core/__tests__/saveSystem.test.ts -t "FINAL-FIX"` →
  **16 failed, 1 passed** (the control "pointer at exactly currentLevel is trusted"). `02-core-RED.txt`. The failing
  cases: a negative / NaN / beyond-2^53 / fractional low mask under a valid pointer 20, each via the menu fold, a
  campaign clear first, and a daily clear first (12); a stray bit 30; both masks empty under a pointer; a sliced
  rebuild; a pointer of 100000 at level 12.
- **Finding 15, RED (EXECUTED, BASE `saveSystem.ts` swapped into the tree, then restored):** the storage test that
  corrupted mask AND pointer together now corrupts **only the mask** (pointer a valid `'37'`), for a negative number,
  an unparseable string and a number beyond 2^53, plus a clear-before-fold case across two cold starts:
  **4 failed** on BASE, 5 passed (`02-storage-RED.txt`). The old both-corrupt case is kept as "an unparseable pointer
  over a valid mask" (it passes on BASE, as it should).
- **GREEN (EXECUTED):** core 17 / 17 (`02-core-GREEN.txt`), storage 30 / 30 (`02-storage-GREEN.txt`).
- **Finding 9, interleaving test (EXECUTED):** `collectionSync.test.ts` "200 seeded interleavings" drives the real
  `startCollectionSync` + real `SaveSystem` over a Map store, with a manual frame scheduler: random frames (slices of
  1-20 levels), campaign clears in GameScreen's order, daily clears, the menu fold stopping (Play) and a second fold
  starting (gallery / a menu still leaving). After every step it checks: pointer ≤ level, masks ⊇ truth(levels below
  the pointer), masks ⊆ truth(levels below the level) ∪ dailies; after a drain, masks = truth ∪ dailies and pointer =
  level. Truth is the full generator (`LevelGenerator.generate`, levels 0-89). It passes on BASE and on the fix (a
  pinning test: the review found the logic sound). **Positive control (EXECUTED):** with the fast path's pointer check
  removed from `recordCampaignClear`, it fails on its first trial (`02-interleave-positive-control.txt`).

### Existing tests changed (disclosed)

- `saveSystem.test.ts` "a replayed or reset-behind clear writes nothing" pinned the old freeze (finding 6's defect).
  Rewritten to the new contract: the leading pointer reads as 0, level 0 is re-recorded, `lo = 7` is kept, one pointer
  write.
- `saveSystem.test.ts` "corrupt stored values…" asserted the raw `2^30 + bit 25` hi mask stays on disk; now it is
  rewritten to `bit 25` (otherwise it would read as damaged on every call).
- `saveSystem.test.ts` "a campaign clear with the fold behind…" seeded pointer 4 with no mask (a state no write
  produces); it now folds to 4 first, and the expectation became truth(0, 10).
- 6 tests in `GameScreen.collection.test.tsx` and 1 in `saveSystem.genVersion.test.ts` seeded a pointer with empty
  masks, which rule 2 now reads as damage. They seed a placeholder bit (index 29, Umbrella, dealt by nothing yet) with
  the pointer; each "records nothing" test now also asserts the masks still equal the placeholder. No assertion was
  removed.
- `collectionSync.ts` exports `saveSystemSync` (no behaviour change) so the interleaving test runs the real wrapper.

### Persisted data: migration and wipe risk

- **No key, schema or `PersistenceKeys` change**; `SCHEMA_VERSION`, `migrate()`, `resetProgress()` untouched.
- **Behaviour on existing saves:** an intact, caught-up collection is read and written exactly as before (the caught-up
  sync reads 4 keys instead of 2 and writes nothing). A damaged collection, or a pointer above the level, triggers one
  sliced rebuild (≤ 5000 levels per menu mount) that only ORs bits in, and rewrites a damaged mask as its readable
  bits plus the rebuilt ones. No readable bit is ever removed. Wipe risk: none added; this removes the path that
  overwrote a damaged mask with "0 + one bit" under a valid pointer.
- Only the three collection keys can be written, and only while `persistenceHealthy` (unchanged).

## Patch 03 — comments and tests (findings 7, 16, 17, 10)

Files: `src/ui/gameSessionLifecycle.ts`, `src/featureFlags.ts`, `src/ui/reviewPrompt.ts`, `src/core/curve.ts`,
`src/core/shapeBag.ts`, `src/core/shapeLibrary.ts`, `src/core/generatorVersion.ts`,
`src/core/__tests__/v1Floor.test.ts`. LOW RISK because the 7 source files change only comment lines (EXECUTED: their
diff has no non-comment line) and the test file only loses one vacuous test and its now-unused import.

- **Finding 7:** `gameSessionLifecycle.ts` now says a PERF run records no bits but a DEV_LEVEL / DEV_GEN_VERSION run
  does, and what that does to a real save. `featureFlags.ts` no longer names `motionFlags.ts` (it does not exist; the
  W2 flags live in `featureFlags.ts`) and lists `boardGridFlag.ts`, `missedMarkFlag.ts` and `perfMode.ts`.
  `reviewPrompt.ts` says 450 ms after the clearing tap (or exit + 350 ms with `META_POST_CLEAR_TIMELINE`).
- **Finding 16:** the V2-FINISH tripwire is **deleted with its reason left in place**: V2-WIRE (`038fdda`) wired the
  switch level, so its only real assertion (`GEN_V2_ENABLED` false while unwired) could never run again. Coverage
  lives in `gameSessionLifecycle.test.ts` ("V2-WIRE: createLevelSession forwards the install's stamped switch
  level…", behavioural) and `generatorVersion.test.ts` ("the v2 flag ships OFF"). The now-unused `GEN_V2_ENABLED`
  import was removed. EXECUTED: `v1Floor`, `generatorVersion`, `shapeBag` suites 87 / 87.
- **Finding 17:** `curve.ts` gives 190 arrows for a fresh install and **195 for an existing player**
  (`RE-CEILING.md:459`); `shapeBag.ts` cites the range guard in `shuffledSet`; the two `shapeLibrary.ts` section
  headers no longer claim pool membership (one line each, so no cited line moved).
- **Finding 10:** `generatorVersion.ts` documents the rollback's collection cost: levels cleared as v2 but not yet
  folded, and any later rebuild from level 0 (patch 02), are recorded as their v1 shapes; bits cannot be cleared, so
  this cannot be undone; a caught-up fold keeps its v2 bits; it cannot happen until v2 ships.

## Patch 04 — UI edge (findings 8, 12, 14); jest only, device deferred

Files: `src/ui/screenHandoff.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/GalleryScreen.tsx`, `src/ui/themeTransition.ts`,
`App.tsx`, `src/ui/contrastAudit.ts` (line sites only), 4 test files, `DESIGN.md` (citations re-mapped, one sentence),
this report.

- **Finding 8:** `ScreenSlot` puts the leaving style (absolute fill, **opacity 0**, `pointerEvents="none"`,
  accessibility hiding) on a plain `View` (`collapsable={false}`) around the `Animated.View` that carries the
  `FadeIn` layout animation. A parent's opacity multiplies its children's, so a fade-in still writing opacity on the
  UI thread can no longer show a screen that was left mid-fade. Same element tree in both states, so the switch never
  remounts the screen (the existing keyed-slot test still passes). **RED (EXECUTED, BASE):** the node carrying
  `entering` itself held `opacity: 0` (received 0, expected no opacity on it). **GREEN:** opacity 0 sits only on
  non-animated ancestors, the text instance is the same before and after the switch, and a shown slot still flattens
  to `{ flex: 1 }`.
- **Finding 14:** new `useEffectUntilScreenLeaves(start)` in `screenHandoff.tsx`: a mount effect whose stop runs once,
  in the layout effect of the commit where the slot turns `leaving` (or on unmount). HomeScreen's fold and
  GalleryScreen's fold use it. **RED (EXECUTED, BASE):** menu in a `ScreenSlot`, fold started, slot switched to
  leaving: `syncCollection` was called 20 times in the next 20 frames. **GREEN:** 0 calls and the pointer unchanged;
  the hook's own test: stop at the leave commit, once, none at the later unmount, plain unmount stop outside a slot.
- **Finding 12 (the simpler option: block opening):** `useThemeToggle` returns `themeChanging()` (`scrim.busy`: true
  from an accepted press through the cover, the swap and the uncover). App passes it to HomeScreen as
  `isThemeChanging`; the Settings button does nothing while it is true. **RED (EXECUTED, BASE):** the sheet opened
  during the dip; `themeChanging` did not exist. **GREEN:** no sheet while changing, the sheet opens once it ends;
  `themeChanging()` true in every leg and false at rest; always false with no scrim (flag off / reduced motion).
- RED 6 failed / 25 passed (`04-RED.txt`); GREEN 31 / 31 (`04-GREEN.txt`); full UI project green in the gate run.
- **UNVERIFIED-DEVICE (all three):** no frame capture of a quick in-and-out screen switch (finding 8), no capture of
  a gear tap during the theme dip (12, both flags on), no frame-time trace of a Play press mid-fold (14). The App
  wiring of `isThemeChanging` is INFERRED (tsc exit 0; App has no jest harness), each side is unit-tested.

## Decisions

1. A pointer above `currentLevel` reads as **0**, not `currentLevel` (reasoned above).
2. "Both masks empty under a pointer above 0" counts as damage, to cover the real store's unparseable-string case; this
   is why 7 fixtures gained a placeholder bit.
3. A readable-but-non-canonical mask (bit 30+) keeps its low bits and is rewritten canonical.
4. A daily clear over damaged masks keeps the daily bit, writes pointer 0 and reports `newlyDiscovered: false`.
5. Finding 14's hook is also used by the gallery's fold (same defect, same two lines); the gallery's BackHandler was
   left as is.
6. Finding 16: deleted, with the reason left as a comment where the test was.
7. Finding 12: open is blocked for the whole dip (cover, swap and uncover), not only the cover leg.
8. DESIGN.md's citations are kept correct at every commit of the series (01 resolves against `a19c33f`; 02 and 04
   re-map the lines they move), instead of resolving all of them against the final tree.

## Concerns

- **Finding 8's wrapper changes the native view tree of every screen** (one extra non-collapsable `View` per slot,
  with the game's retained native board one level deeper). jest cannot show layout, the PERF-DEADTAG warning counts or
  frame cost. Before release: one device pass of screen switches (menu ↔ game ↔ gallery, including a switch within
  180 ms of entering) with the PERF-DEADTAG logcat count, and a frame-time check of the game mount.
- **DESIGN.md line citations will drift again** on the next edit to a cited file. A check like `contrast.test.ts`'s "every usage row names a real site", or symbol
  citations, would stop it; not done here (out of scope). Patch 04 alone moved 32 of them (30 re-mapped by script,
  2 by hand).
- `docs/next-level/reports/W4-07.md:285` ("`lo = -5` reads as 0 and is rewritten with the truth") is now true for a
  valid pointer too; the report was not edited.
- Release blockers / accepted items outside this pass: finding 1 (privacy link, owner) and finding 11 (accepted).

## Device checks (patch 04, emulator-5556, 2026-09-28)

Closes patch 04's UNVERIFIED-DEVICE items. Evidence root `artifacts/FINAL-FIX-DEVICE/` (gitignored). Two JS-repack
builds (host `artifacts/W2-06/apk/w206-on.apk`, `artifacts/PANEL-STUCK/scripts/repackps.sh` with `REV`), identical
flags (`scripts/flags-ff.txt` = PERF-DEADTAG's test flag set + META_THEME_TRANSITION + META_SETTINGS_SHEET +
CAPTURE_DIAG + FTUE_LOG) and the same logging overlay (`overlay-0{3,4}/`: `[ffdiag]` lines for fold start / slice /
stop, theme press, Settings press):
**ff-04** = `c670f1b` (`55f414f9…`), **ff-03** = `89863b1`, the pre-04 tree, whose screen-switch files equal
`a19c33f`'s (`8464f459…`). Bundle proofs: TestIds present, owner units absent (ASCII + UTF-16LE). Both deleted after use
(≤ 2 APKs); `.env` / `.proof` / build logs kept. Scales 1/1/1 read back; wm size / density reset after every 360 dp run.

- **(a) PERF-DEADTAG warnings with the new wrapper — 0 (EXECUTED).** `scripts/transitions-ff.sh` (= PERF-DEADTAG's
  `transitions.sh` with this flag set's menu tap points, from `switch/cal-360.xml`: Play 540,1065, Gallery 757,1245;
  PERF-DEADTAG's 540,1172 / 809,1352 miss this menu) on ff-04, 5 cold starts per route, sound on and sound off, counted
  per transition window by PERF-DEADTAG's `count-warnings.py` (`deadtag/`): launch→menu 0/20 runs with warnings,
  menu→game 0/10, game→menu 0/10, menu→gallery 0/10, gallery→menu 0/10; every one of the 20 runs logged every intended
  `screen=` switch (so no window is empty). No same-build positive control was run (INFERRED that the grep catches
  them: the same script counted them on PERF-DEADTAG's hand-off-alone build).
- **(b) Quick in-and-out switch — no leftover screen (EXECUTED).** `scripts/quickswitch.sh` (360 dp, screenrecord,
  frames at their own pts) + `scripts/quickswitch-frames.py` (reference = the final menu frame; mean |diff| over
  y 250-950; a run passes when every frame after the menu is back is within the menu's own noise + 2). In-out times from
  the app's `screen=` logs:

  | build | menu→gallery→menu | menu→game→menu |
  |---|---|---|
  | ff-04 | **4 / 4 pass**, in-out 21-73 ms | **5 / 5 pass**, in-out 103-290 ms |
  | ff-03 (pre-04) | 5 / 5 pass (+1 run where the gallery was never drawn), 29-189 ms | 2 / 2 pass, 111-262 ms (4 runs stayed on the game) |

  The game cannot be left sooner: a back tap that lands before the game screen has mounted hits the leaving menu and is
  lost (taps at 0 / 100 ms after Play stayed on the game; the achieved minimum was ~100 ms after the mount, inside its
  180 ms fade-in). **The pre-04 build did not show the defect either** (finding 8's ghost was not reproduced on the
  device in 7 counted runs), so this check shows the wrapper leaves no screen behind; it cannot show that it fixed a
  device-visible ghost. Frames were deleted after analysis; the mp4s and per-run frame reports are kept (`switch/`).
- **(c) Game-mount frame cost vs the pre-04 tree — no detectable change (EXECUTED).** PERF-DEADTAG's protocol
  (`scripts/perf-ab-ff.sh` / `perf-run-ff.sh` = PERF-DEADTAG's with Play at 540,1065; `open-frames.py` unchanged:
  mount frame = first frame ≥ 1 ms of display-list record in [tap, +400 ms); medians, two-sided permutation p on the
  difference of medians, 20000 shuffles), blocks alternating, 1 warm-up per block:

  | comparison | n / arm | mount frame (median, ms) | UI thread | tap → mount frame done | p (mount frame) |
  |---|---|---|---|---|---|
  | **same-APK null** ff-04 vs ff-04 (`perf/null`) | 8 / 8 | 113.4 vs 89.7 (Δ −23.7) | 90.7 vs 69.7 | 315.2 vs 258.1 | 0.36 |
  | ff-03 (pre-04) vs ff-04 (`perf/ab`) | 12 / 12 | 100.9 vs 85.6 (Δ −15.3) | 75.9 vs 73.4 | 307.2 vs 248.2 | 0.28 |

  Reconciliation: every run has a mount frame (8/8, 8/8, 12/12, 12/12); 9-23 frames recorded in the 400 ms window, drawn
  span 233-383 ms (15-24 vsyncs incl. skipped). The A/B difference (−15 ms) is smaller than the same-APK null's own
  difference (−24 ms): at this sample size and host load (2.9-6.6) the instrument resolves nothing below ~±25 ms, and no
  regression from the extra non-collapsable `View` is visible at that resolution. 0 Reanimated warnings in [tap, +1 s)
  in all 40 measured runs.
- **(d) Settings gear during the theme dip — does nothing (EXECUTED).** `scripts/ffcheck.mjs --check gear` (native
  1440x3120, tap points from `scripts/cal-native.json`): one device shell taps the theme toggle and then the
  gear. ff-04, 3/3: `settings-press changing=true` logged 52-64 ms after `theme-press`, no sheet (`gear/ff04-gear-*-after.png`:
  the menu in the new theme). Positive control ff-03, 3/3: the sheet opened over the dipped menu
  (`gear/ff03-gear-1-after.png`). Sanity on ff-04: a gear tap 2 s later (`changing=false`) opens the sheet
  (`gear/ff04-sanity-after-dip.png`).
- **(e) The collection fold stops when leaving the menu (EXECUTED).** `ffcheck.mjs --check fold`: a collection seeded
  20000 levels behind (fold budget 5000 / mount), Play tapped after ≥ 5 logged slices. ff-04, 5/5: `fold-stop …
  pendingSlice=true` logged 22-27 ms **before** the `screen=game` line (the leave commit's layout effect), no
  `fold-slice` after it (`fold/ff04-fold-*-fold-log.txt`). ff-03, 5/5: the stop came 132-226 ms **after** `screen=game`
  (at the unmount). On the device ff-03 also ran no slice in that window (the fold's late-frame backoff held it during
  the switch), so the device-visible gain is the earlier stop, not fewer slices; the 20-frame case of the jest RED did
  not occur here. (A first round seeded only 3000 levels behind, and the fold finished before Play in 2 of 3 runs:
  `fold/round1/`, not counted.)

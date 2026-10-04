# HALLOWEEN-01 — Seasonal styles in the collection book + the Halloween pack

2026-10-04. **Implemented, unit/native/device checks run. Default OFF (`EXPO_PUBLIC_META_SEASONS`). OWNER REVIEW PENDING
(look) and ONE OPEN CONFLICT (dark board tint). No ship decision.** Branch `next-level`, start HEAD `7397fb6`; nothing
committed or pushed; no EAS. Node v20.19.4 in every shell. Only `emulator-5556 / fleet_floor_api31`. Expo v57 versioned
docs (SDK index + react-native-svg page) read before code. No dependency added. No opening-time performance measured.

The session was interrupted once mid contract build; on resume the injected diagnostic classes, the `skinTest`
Gradle type and the instrumentation manifest entry were found left behind (see "Changes outside the brief / incidents").

## Conflict (stopped, not improvised)

| Where | Brief says | Live contract needs | What I did |
| --- | --- | --- | --- |
| `src/ui/skinSpecs.ts` `HALLOWEEN_BOARD` (line 145), checked by `src/ui/__tests__/skinSpecs.test.ts:24` | board tint dark `#2A2140` for all three | the REQUIRED tint row `skin-<id>-tint-arrow-missed-mark` (heart at .75 over the board, `src/ui/contrastAudit.ts:360`) must be ≥ 3:1; `#2A2140` gives **2.992:1** (Ink Night) | Light tint is the brief's `#F3EEFA`. Dark keeps the **stock Ink Night board `#13111C`** (no tint) until the owner rules. `HALLOWEEN_BRIEF_DARK_TINT` is exported and `seasons.test.ts` pins that `#2A2140` fails exactly that one row (2.992) while the registered board passes every required row. Options for the owner: accept a darker violet tint, accept the stock dark board, or rule the missed-mark row non-gating on tints. |

The brief's precomputed outline ratios are confirmed by the real audit on the light tint (Pumpkin 4.35, Ghost/Candy Corn
3.28) and, computed against `#2A2140`, 3.04 / 4.04 (test `halloweenSkins.test.ts`). On the registered dark board:
Pumpkin 3.76, Ghost/Candy Corn 4.99; missed mark 3.45 (Ink Night) / 5.40 (Daylight). Grid dots keep the R4 decorative
exemption (raw 1.49 / 1.52, non-gating).

## Part A — seasons feature

- `src/featureFlags.ts`: `META_SEASONS = process.env.EXPO_PUBLIC_META_SEASONS === '1'`; `src/ui/rewardGate.ts`:
  `seasonsEnabled() = META_SEASONS && rewardBookEnabled()`.
- `src/ui/seasons.ts` (pure, no RN, no clock): `inSeason(season, now)` — local calendar day, inclusive, wraps when
  start > end; `seasonTitle` → "Halloween · until 7 Nov"; MM-DD validation at catalogue load.
- `src/ui/rewardCatalogue.ts`: optional `season` on `RewardEntry`; `HALLOWEEN = {id:'halloween', name:'Halloween',
  start:'10-01', end:'11-07'}`; `SEASONAL_REWARDS` Pumpkin/Ghost/Candy Corn: `pathCost:null`, price 20, not on the path,
  not free; `isStyleVisible` / `visibleStyleCounts` (one rule for UI and ledger).
- `src/ui/rewardLedger.ts` (still RN-free): `opts.seasons` (effective only with the book), `state.seasons`;
  `buyReward(id, now = new Date())` returns `'unavailable'` for a seasonal style out of season or with seasons off;
  `recordRewardClear(kind, perfect, now)` reports `ownedSkins`/`totalSkins` over visible styles. No new key.
- `src/ui/arrowStyleSelection.ts` `initializeArrowStyle(store, enabled, seasons=false)`: a saved seasonal id renders as
  Classic without a repair write; choosing a seasonal id without seasons is ignored. `storage.ts` / `App.tsx` pass
  `seasonsEnabled()`.
- UI: `CollectionBook` takes `now`, draws an in-season section at the TOP ("Halloween · until 7 Nov" + drawn
  `PumpkinIcon` SVG) with the unowned seasonal tiles; the empty line appears only when nothing is visible; bought
  screen "N of {visible total}". `ArrowStyleOptions`: "Book · N" counts visible only; "Your styles" lists owned
  seasonal styles all year (seasons on); flat picker and path layout never show seasonal styles; path layout
  "N of {visible total}". `RewardRevealCard`: "N of {totalSkins}". New text row `book-season-title` in contrastAudit;
  pointers moved for every edited line.

**Red → green.** Red: `logs/partA-red.txt` (5 suites fail: modules/exports missing, flag absent). Green:
`logs/partA-green-1.txt`. Unchanged-behaviour guards, each broken then restored (`logs/partA-guard-controls.txt`):
flat-picker filter (2 fail → pass), selection fallback (6 fail → pass), visibility seasons gate (7 → pass), buy window
(1 → pass), seasons-need-book (1 → pass), path ids exclude seasonal (1 → pass); file hashes equal after each restore.

## Part B — Halloween skins

Pumpkin **18**, Ghost **19**, Candy Corn **20** (append-only), launch proportions (.48 rim / .425 body, rounded head .44
half-width, .46 tip, .10 fillets), `tail.oneCell:'none'`, head faces `headOffset -.12`, eye radius .045.

New general renderer capabilities (both data, no skin-id branch in native code):
1. layer `lengthBands` (`SkinSpec.kt`, `SkinPaths.kt`): bands colour equal fractions of the visible shaft (tail point →
   cap back edge) along the body's rounded centreline; band i is drawn from its start to the end over band i−1, butt
   ends; each band adds its nested head cap (`bandWidths`, the existing matching nested heads). Counts against the
   7-layer limit.
2. `face.eyeShape` 'dot' (default; omitted = today) | 'arc' (closed-eye arc as open eye) | 'triangle' (upright, 1.25×
   eye radius). Blocked eyes keep the arc.
3. No bead-shape field: existing beads made the ribs and waves.

Recipes: Pumpkin — deep-orange `#E0661B` bead body (.48/.35/.34), `.34` orange `#FF8A2A` spots on each bead (rib
lobes), orange headFill, green `#6BAA4F` dot stem (tailFill), triangle-eyed face `#9A633F`. Ghost — milky `#E9E2F5`
bead body (.48/.30/.32), white `#F7F4FF` .22 shine + headFill, arc eyes `#8C7BB5`, blush `#D9CFEA`. Candy Corn —
yellow body, `lengthBands` `#FFD24A → #FF8A2A → #FFF8E8` with nested heads .425/.29/.155. Rim colours as briefed.

**Red → green (TS):** `logs/partB-ts-red.txt` (suite fails to compile: `eyeShape`/`lengthBands` absent) →
`logs/partB-ts-green.txt`. **Native red:** the first two contract APKs failed the new coverage oracle
(`logs/contract-halloween-probe.txt` 169 / `-probe2.txt` 150 uncovered samples); fixed by cumulative band drawing plus
a sliver-tolerant oracle that still rejects a .05-cell cut (`-probe3.txt` PASS). Pumpkin iteration 1 (.30 lobes)
read as separate balls (`screens/iteration-1/`); iteration 2 (.34) is the registered recipe.

## Native contract (contract APK `perf/catalogue-contract.apk`, sha256 85bd9d55… in `checks/contract-apk.sha256`; v1 levels 0–19 + dense 3827, 2,118 arrows/spec)

Commands: `ART_SKINS_DIR=artifacts/HALLOWEEN-01 node scripts/art/skin-contract-data.cjs`;
`python3 scripts/art/build-skin-catalogue.py contract`; `adb -s emulator-5556 install -r -d …`;
`run-skin-contract.mjs before|after|polish|halloween` (`run-contract-all.sh`, rerun after the Pumpkin data change:
`logs/contract-all-2.txt`); `python3 artifacts/HALLOWEEN-01/summarize-contract.py` → `checks/contract-summary.json`.
`before`: frozen ART03 Cinnamon still FAILS K1 (17,191 paths) — red control. `after`/`polish`/`halloween`: 21/21 levels PASS each.

| Spec | id | New fields | K1 fit failures | K2 draws/strip incl. mark (max) | K3 head failures | K4 | K5 flat LOD | K6 reduced motion | K8 one-cell checks | HALLOWEEN-01 mode |
| --- | ---: | --- | --- | ---: | ---: | --- | --- | --- | ---: | --- |
| Cinnamon Roll | 1 | none (byte-identical paths) | 0 / 2118 arrows | 8 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 42360 path arrays = frozen |
| Sherbet | 2 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Ink Pro | 3 | none (byte-identical paths) | 0 / 2118 arrows | 4 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 25416 path arrays = frozen |
| Candy Gloss | 4 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Jelly | 5 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Critter | 6 | none (byte-identical paths) | 0 / 2118 arrows | 6 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 33888 path arrays = frozen |
| Yarn | 7 | none (byte-identical paths) | 0 / 2118 arrows | 4 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 25416 path arrays = frozen |
| Paper Craft | 8 | none (byte-identical paths) | 0 / 2118 arrows | 6 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 33888 path arrays = frozen |
| Archery | 9 | none (byte-identical paths) | 0 / 2118 arrows | 7 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 38124 path arrays = frozen |
| Pixel | 10 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Neon Glass | 11 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Rainbow Ribbon | 12 | none (byte-identical paths) | 0 / 2118 arrows | 8 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 42360 path arrays = frozen |
| Clear Glass | 13 | none (byte-identical paths) | 0 / 2118 arrows | 6 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 33888 path arrays = frozen |
| Stained Glass | 14 | none (byte-identical paths) | 0 / 2118 arrows | 5 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 29652 path arrays = frozen |
| Campfire | 15 | none (byte-identical paths) | 0 / 2118 arrows | 8 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 42360 path arrays = frozen |
| Lava Rock | 16 | none (byte-identical paths) | 0 / 2118 arrows | 6 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 33888 path arrays = frozen |
| Strawberry Glazed | 17 | none (byte-identical paths) | 0 / 2118 arrows | 8 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | 42360 path arrays = frozen |
| Pumpkin | 18 | `face.eyeShape: triangle` (+ existing beads/spots) | 0 / 2118 arrows | 7 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | eye shape 168 checks |
| Ghost | 19 | `face.eyeShape: arc` (+ existing beads/shine/headFill) | 0 / 2118 arrows | 7 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | eye shape 168 checks |
| Candy Corn | 20 | `lengthBands` | 0 / 2118 arrows | 6 | 0 | PASS (outline audit) | 21/21 | 21/21 | 449 | bands: order 105, heads 105, coverage 1669 arrows, 231 damaged rejected |

Also per spec in `after`: filled-join (head − body empty), accent inset/connectivity/straight-axis checks, feature
fit + shifted negative controls (now including `lengthBands` and its nested heads). `polish`: face clearance (.03 cell)
for Pumpkin/Ghost 2,118 checks each incl. 449 one-cell head faces, damaged eye/anchor/head/bead fixtures rejected (105
each); ART08 frozen-path comparison now only for the 17 ART08-era specs. `halloween`: 18 specs without a new field are
byte-identical to the frozen starting renderer at full and flat detail (displacement control rejected on each level);
eye shapes classified in 4 directions (swapped shape rejected); Candy Corn band order/fractions, nested heads and shaft
coverage (raw slivers ≤152 samples at 400/cell, 0 after 3×3 erosion), 231 damaged fixtures rejected.

**Differences from the concept and why:** Candy Corn heads are concentric nested caps (white innermost), not bands across
the head with a white tip — the brief asked for the existing nested heads, which scale about the head centre. Pumpkin ribs
are bead lobes with deep-orange creases rather than thin straight rib lines (no transverse-line capability; brief allowed
only beads). Pumpkin face ink is the palette outline `#9A633F` (concept face looks darker). Ghost body is milky lavender
with a white core (uses both palette fills) rather than all-white. One-cell Candy Corn has no face (not in the brief).
Dark board: stock, see conflict.

## Contact sheets (OWNER REVIEW PENDING)

`screens/contact-halloween-light.png`, `screens/contact-halloween-dark.png`: concept panel | 29.39 dp crop of level 3828
(seven complete one-cell arrows, indices 174/180/191/192/203/214/243) | 38 dp fixture (four one-cell arrows, bottom row).
Native crops are unresized native-Canvas renders from the contract APK (real spec JSON, density 3.5), not player-viewport
captures; per-crop files `screens/<id>-<theme>-{board,fixture}-crop.png`, 2× one-cell crops, `screens/contact-manifest.json`
(source hashes). Iteration-1 sheets: `screens/iteration-1/`.

## Device (emulator-5556, local test-ads, all META flags + picker + path + book)

Builds: `artifacts/HALLOWEEN-01/build-test-apk.sh on|off` (POSIX sh, `set -eu`, df ≥ 5 GB check, refuses if any
diagnostic class is in the product module, prebuild --clean). Proof `prove-apk.py`: Hermes bundle; test id
`3940256099942544` [9,0] (UTF-8, UTF-16LE); `6706292920`, `7549521178`, `3505414519`, `5508761320` all [0,0]; manifest
has no instrumentation; ON sha256 4d63aaf5…, OFF 6a1d5a4b… (`build/{on,off}/proof.txt`, env in `build/*/env.txt`; only
ON sets `EXPO_PUBLIC_META_SEASONS=1`). Installs `install -r -d`, no uninstall.

Save: original `RKStorage` and journal were **0-byte files** (no table); backed up (`device/save-backup.json`, sha256 of
empty files) and restored byte-for-byte with owner/mode (`device/restore-proof.json`). Seeded via the save (documented):
`arrows_petals=30`, total/current level 0, FTUE done (`device.py fixture halloween`).

| # | Step | Result | Screenshot |
| --- | --- | --- | --- |
| 1 | ON, device date 2026-10-04 | Book tab "Book · 18" (15 path + 3), section "Halloween · until 7 Nov" with drawn pumpkin at the top | `02-oct-book-halloween-section.png` |
| 2 | Buy Pumpkin (20) | confirm → bought; DB `arrows_petals 10`, `owned_lo 262165` (bit 18); "4 of 21 styles collected", "Book · 17" | `03-…`, `04-oct-bought-pumpkin.png` |
| 3 | Use it now, play | `arrows_skin 18`; Pumpkin board with `#F3EEFA` tint; level 1 cleared with legal input (60 arrows), petals 12 | `05-…`, `07-oct-level1-pumpkin-board.png`, `08-oct-pumpkin-cleared.png` |
| 4 | Date → 2026-12-10 (auto time off) | "Your styles · 4" includes Pumpkin; "Book · 15"; hierarchy has 0 Halloween/Ghost/Candy Corn nodes (16 petal labels = 15 tiles + purse); board still Pumpkin (602,056 orange / 100,607 rim px) | `10-dec-your-styles-pumpkin-kept.png`, `11-dec-book-no-halloween.png`, `12-dec-board-still-pumpkin.png` |
| 5 | Date restored | host time, skew 0 s, auto_time/auto_time_zone 1, tz Europe/Belgrade (`device/date-restore-proof.json`) | — |
| 6 | OFF build, same save (Pumpkin owned, `arrows_skin 18`), October | board renders Classic (0 Pumpkin px, 0 tint px); "Your styles · 3", "Book · 15"; 0 Halloween/Pumpkin/Ghost/Candy nodes in both tabs | `13-off-oct-board-classic.png`, `14-off-oct-your-styles.png`, `15-off-oct-book-no-halloween.png` |

End state: BOOK-01 OFF test-ads APK (the app installed before this task) reinstalled with `-r -d`; save, animation
scales, auto time/zone, display restored and asserted; emulator-5556 (booted by this task) shut down.

## Tests

`npx tsc --noEmit -p .` exit 0. `npx jest --silent`: **132 suites / 2,269 tests / 12 snapshots** (baseline 127 / 2,219).
New: `seasons.test.ts`, `halloweenSkins.test.ts`, `CollectionBook.seasons.test.tsx`, `ArrowStyleOptions.seasons.test.tsx`,
`RewardRevealCard.seasons.test.tsx`. Changed existing tests (reason):
- `featureFlags.test.ts`: `META_SEASONS` added to the named list (brief).
- `skinCatalogue.test.ts`: registry names/ids extended with Pumpkin/Ghost/Candy Corn 18–20 (append-only ids).
- `rewardCatalogue.test.ts`: catalogue size now includes seasonal entries; "pathCost null ⇒ no price" excludes seasonal
  (book-only, priced).
- `SettingsSheet.test.tsx`: flat picker expected list excludes seasonal styles (never in the flat picker).
- `arrowStylePersistence.test.ts`: per-style persistence loop excludes seasonal (not selectable without seasons) + new
  seasons-on persistence / off-reads-Classic case.
- `gameSessionLifecycle.test.ts`: source-order guard string now includes `seasonsEnabled()`.
- `RewardRevealCard.test.tsx`: fixture gains required `totalSkins: 18`.

## UNVERIFIED

- Owner look approval (contact sheets, device screenshots). Dark tint ruling.
- Native contract K4 is the TS audit; there is no native-pixel contrast check (as before).
- Seasonal gate test mocks `skinPickerEnabled` from the env flag (Platform part not exercised in that test).
- Opening/exit performance (not measured, per brief); K7 remains report-only/failing from ART07/08.
- Rasterised coverage slivers ≤2 samples (1/200 cell) between length bands are attributed to curve flattening — a hypothesis.
- iOS (non-goal). Dark-mode and reduced-motion device runs of the new section were not separately captured.

## Changes outside the brief / incidents

- `scripts/art/skin-contract/SkinContractInstrumentation.kt` (new `halloween` mode, `lengthBands` in feature/nested-head
  checks and slot counting), `SkinPolishContract.kt` (ART08 frozen comparison only for ART08-era specs; Critter-only bead
  pin, general .28 spine), `run-skin-contract.mjs` (mode list); new `Halloween01BeforePaths.kt` (frozen starting
  SkinPaths) and `SkinHalloweenContract.kt`.
- `StylePreview` thumbnails draw `lengthBands` and eye shapes.
- `docs/skins/README.md` section; one lesson appended to `docs/engineering-lessons.md` (the other session's uncommitted
  top section preserved byte-for-byte: prefix sha256 unchanged).
- Incident: the session was killed during the first contract build; Python `finally` did not run, leaving ten diagnostic
  classes in `modules/arrows-board/.../board/` and the `skinTest`/instrumentation edits in the git-ignored `android/`.
  On resume they were verified identical to `scripts/art/skin-contract/` copies, removed, and the two edits reverted
  before any normal build; later builds ran under `nohup`. Final module tree has only the six product files.
- An idle Gradle daemon (pid 27852, 2+ days old) belongs to another session; left untouched.

## Controller review

2026-10-05, controller. **Verdict: APPROVE behind the default-OFF `EXPO_PUBLIC_META_SEASONS` flag. Owner rulings are
pending on the dark tint and the look.**

| Check | Register | Evidence |
| --- | --- | --- |
| Tests and types | Executed | tsc 0; full jest 132 suites / 2,269 tests on the delivered tree. |
| Product module clean | Executed | `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/` holds only the 6 product files. The diagnostic classes left by the interrupted session were removed, and the build script now refuses to build if they are present. |
| Device flow | Executed (viewed) | Screens 02, 04, 07, 10, 11. October shows "Halloween · until 7 Nov" at the top of the book. Buying Pumpkin leaves 10 petals, shows "4 of 21", and the board renders in Pumpkin. In December Ghost and Candy Corn are gone ("Book · 15") and Pumpkin stays in "Your styles · 4". |
| Dark tint conflict | Computed | `#2A2140` gives 2.97–2.99:1 for the missed mark against the 3:1 rule. Darker violets pass: `#221A36` gives missed 3.17, Pumpkin outline 3.33, Ghost/Candy outline 4.42. The helper kept the stock dark board `#13111C` meanwhile. |

**Look findings for the owner (taste):**
1. **Pumpkin** reads as a chain of orange beads (a caterpillar) rather than the concept's ribbed tube. The green stem dot
   on every arrow adds noise on a dense board, and the triangle eyes are barely visible at 29 dp.
   Recommendation: a plain tube with darker rib creases, the stem on long arrows only, and larger eyes.
2. **Ghost** is close to the concept. Its waves are subtle at 29 dp.
3. **Candy Corn:** the length bands work. The head is concentric (white centre), where the concept stripes it; it reads
   fine.

## HALLOWEEN-01b — owner rulings (2026-10-04, on cd10d12)

Implemented, uncommitted. Same rules (Node v20.19.4, emulator-5556 only, local test-ads, no commits/EAS). Evidence in
`artifacts/HALLOWEEN-01b/`. **Owner look review pending; the dark-tint conflict above is closed by the ruling.**

### Values changed (old → new)

| Item | Old | New |
| --- | --- | --- |
| Dark board tint, Pumpkin/Ghost/Candy Corn | `#13111C` (stock, conflict fallback) | **`#221A36`** (owner) |
| Pumpkin body | bead body `.48/.35/.34`, deep-orange `#E0661B` fill, `.34` orange spots, orange headFill | smooth **tube** (no beads), orange `#FF8A2A` fill; spots and headFill removed |
| Pumpkin ribs | — | `seam` `#E0661B`, width `.36`, dash `[.035, .465]` (a rib every .5 cell), **`cap: 'butt'`** |
| Pumpkin stem | dot stem on every multi-cell arrow | **`tail.minCells: 4`** (stem only on 4+ cell arrows) |
| Pumpkin triangle eyes | `eyeRadius .045` (triangle circumradius .056), `eyeHalfGap .13` | **`eyeRadius .065`** (circumradius .081), **`eyeHalfGap .14`** |
| Ghost / Candy Corn | — | unchanged except the dark tint |

Two new general fields (data, no skin-id branch): `seam.cap` ('round' default | 'butt'; only `seam` may set it) and
`tail.minCells` (default 2 = today). The view now passes each arrow's cell count to exit art (`ArrowsBoardView.kt`
`skinCellCount` → `SkinPaths.buildInto(..., cells)`) so the stem rule holds during exits.

**Real audit, Ink Night on `#221A36`:** Pumpkin outline **3.33**, Ghost/Candy Corn outline **4.42**, missed mark
**3.20**, press hint 3.67, blocked 4.70; every required row passes for all three (`checks/contrast.json`). The `#2A2140`
failure test is kept (2.992).

### Evidence

- TS red → green: `logs/red-ts.txt` (halloweenSkins suite fails to compile: `cap`/`minCells` absent) →
  `logs/green-ts.txt`. The new `#221A36` audit test passed before the data change (it audits a constructed spec); its
  failing twin is the kept `#2A2140` test.
- `npx tsc --noEmit -p .` exit 0; `npx jest --silent` **132 suites / 2,276 tests / 12 snapshots** (was 2,269).
- Native contract (`perf/catalogue-contract.apk`, data from `skin-contract-data.cjs`; `logs/contract-all.txt`,
  `checks/contract-summary.json`): before = ART03 red control fails (17,191); after/polish/halloween 21/21 levels PASS
  for all 21 specs: K1 0 fit failures, K2 max 8 draws incl. mark (Pumpkin 6), K3 0, K5/K6 21/21, K8 449 one-cell checks
  each. Pumpkin face clearance 2,118 checks incl. 449 one-cell heads with the larger eyes; eye-shape classifier 168
  checks (window now scales with eye radius), swapped shape rejected. New oracles: butt rib bars (168 bars, each ≤ dash
  length along the path and spanning the tube; the same seam with round caps rejected on 21/21 levels); `minCells` on
  static and exit art for 1,669 multi-cell arrows (default-tail variant rejected 21/21). **Every spec except Pumpkin is
  byte-identical to the cd10d12 renderer** (`Halloween01bBeforePaths.kt`, e.g. Ghost 38,124 / Candy Corn 33,888 path
  arrays), and the 18 original specs still match the pre-HALLOWEEN-01 renderer.
- Contact sheets: `artifacts/HALLOWEEN-01b/screens/contact-halloween-light.png` and `-dark.png` — rows: Pumpkin BEFORE
  (HALLOWEEN-01), Pumpkin AFTER, Ghost, Candy Corn; columns: concept | 29.39 dp level 3828 crop (7 one-cell arrows) |
  38 dp fixture (4 one-cell arrows). Native Canvas renders, unresized (`screens/contact-manifest.json`).
- Device (emulator-5556, `build/on/test-ads.apk` sha 4af3cb71…, test id [9,0], production ids [0,0], no instrumentation,
  `EXPO_PUBLIC_META_SEASONS=1`; Pumpkin owned/selected via the save, documented in `device.py fixture pumpkin-*`):
  `screens/01b-pumpkin-light-board.png` (light tint `#F3EEFA` 2.72 M px) and `screens/02b-pumpkin-dark-board.png`
  (`#221A36` 2.72 M px; header keeps `#13111C`); both have Pumpkin rim/body/rib/stem pixels (`checks/device-board-pixels.txt`).
  Save (0-byte originals), settings and the prior BOOK-01 OFF app restored; emulator stopped.

### Changed tests

- `halloweenSkins.test.ts` (HALLOWEEN-01's own): Pumpkin colour assertions (body `#FF8A2A`; spots/headFill gone) and the
  beads test (Pumpkin is now a tube; Ghost/Critter keep beads) — superseded by the owner ruling. New describe block with 4
  tests (tint, ribs/`cap`, stem/`minCells`, eye sizes).
- `seasons.test.ts`: new `#221A36` passes-every-required-row test for the three specs (3 cases).
- Native tooling: `SkinHalloweenContract.kt` (01b oracles, cd10d12 equivalence, eye window), new frozen
  `Halloween01bBeforePaths.kt`. `docs/skins/README.md` documents both fields.

### UNVERIFIED

- Owner look approval of the new Pumpkin (rib bars on tight bends render as short diagonal wedges along the rounded
  centreline; face ink stays the palette outline `#9A633F`, lighter than the concept's face).
- Exit-art stem rule verified in the native contract (`buildInto` with cell counts), not by recording a real exit.
- Performance not measured (per brief). iOS not applicable.

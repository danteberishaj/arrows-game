# P — Cross-cutting prerequisites

These tasks exist because the workstreams were written in parallel and all lean on the same few shared things. P-01 gives the save file a single owner: one key registry, one schema version, one additive migration and one exact-array assertion, instead of five drafts each appending to the same frozen array. P-02 builds one capture instrument that every motion, art and FTUE claim can close on. It records what the app actually rendered, at a device setting read back from the device, rather than trusting a flag. P-03 corrects the two product documents so they say what the game is (a calm attention / visual-search game, Track A) and what actually ships. P-04 proves the shipping preconditions from built artifacts: target SDK, the EAS link and iPad support. P-05 adds CI so "tests pass" stops being a claim about one Mac. Nothing here changes what a player sees except P-01's invisible schema stamp. Nothing here is pushed, merged or released without the owner's yes.

**Merged from:** P-01 ← draft 1 W4-01 and draft 2 W4-01 (registry, schema version, migration, wipe-risk tests), plus the key-adding halves of W0-06, W1-03, draft 2 W3-01, draft 1 W3-05, W6-03 (schema key only), W7-01 and W7-11 (counter key only). The key needs of draft 2 W4-05/06/07/10 are reconciled against the consolidated `docs/next-level/tasks/W0.md`, `W1.md` and `W4.md`. P-02 ← W6-10, W6-11, W6-12, W6-13, draft 2 W2-01, draft 1 W2-02 and the device-capture half of draft 2 W5-01. P-03 ← draft 1 W2-11, draft 2 W2-03, the doc half of draft 2 W5-11, plus plan §4 P-03 and plan decision 8. P-04 ← W7-08, W7-10 and W0-08, plus plan decision 9. P-05 ← plan §4 "missing work: CI". Red-team findings applied: skeptical-14 on W4-01, W6-03, W0-08, W2-01 and W3-01, and its "unowned shared resource" and "missing saveSystem.test.ts" findings. evidence-15 on W4-01 and W2-11, and its recorder-frame-period finding. brand-13 on W4-01 and W5-11, and its "no step rewrites PRODUCT.md" finding. performance-16 on W6-11, W6-13, W2-01 and W2-02, and its withDecay and historical exit-number findings.

**Measured while writing this file (2026-09-16, base `da93dcd`, this Mac, not a device).**
- `node -e` over `@expo/config-plugins`' `IOSConfig.DeviceFamily` prints `"1,2"` for the current `app.json`. The generated `ios/Arrows.xcodeproj/project.pbxproj:388,419` both read `TARGETED_DEVICE_FAMILY = "1,2"`.
- `npx expo config --type introspect` shows no `extra` block, so there is no `extra.eas.projectId`.
- On Android, Reanimated 4.5.1 decides "reduced motion" from **`Settings.Global.TRANSITION_ANIMATION_SCALE == 0`** (`node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt:324-333`), not from `animator_duration_scale`. The perf harness sets all three scales to 0 (`scripts/perf/android/benchmark.mjs:351-353`), so the earlier conclusion ("harness runs measure the reduced-motion variant") still holds. The setting that controls it was misnamed, though.
- The JS side reads that flag once, at module init (`node_modules/react-native-reanimated/src/ReducedMotion.ts:16`). Changing the setting under a running process changes nothing.
- `node --test scripts/perf/android/*.test.mjs`: 16 pass, 0 fail.
- `ls .github` → no such directory.
- `ffmpeg` (`/opt/homebrew/bin`), `bundletool` (`/opt/homebrew/bin`), `apkanalyzer` and `~/Library/Android/sdk/build-tools/36.0.0/aapt` all exist.
- AVD `fleet_floor_api31` is a `google_apis` arm64-v8a image (`~/.android/avd/fleet_floor_api31.avd/config.ini:2,129`).
- `df -h /` shows 10 GiB free.

---

## P-01 — Own the save schema: one key registry, one schema version, one additive migration

- **Status:** READY
- **Effort:** M
- **Depends on:** none. Before writing code, run the registry cross-check in Change step 1.
- **Flag:** none. A flag around a schema stamp would put two on-disk shapes in the wild and double the migration matrix. The change is invisible to players.
- **Files:** `src/core/saveSystem.ts`, `src/ui/storage.ts`, `src/ui/__tests__/storage.test.ts`, `src/core/__tests__/saveSystem.test.ts` (new; four drafts cite it and it does not exist)

### Context
`SaveSystem` is an int-only store (`src/core/saveSystem.ts:12-16`) with eight hand-listed, frozen keys (`saveSystem.ts:32-50`). `src/ui/storage.ts:18-30` hydrates **exactly** `SaveSystem.persistenceKeys` in one `AsyncStorage.multiGet` (`storage.ts:20`), and `storage.test.ts:36-45` asserts that array by value.

A key that code writes but that is missing from the array still write-throughs to disk (`storage.ts:37-40`), but on the next cold start it reads back as its default. That is the "works until you kill the app" failure, and nothing logs it.

There is no schema version, and nothing records which build last wrote the save.

Five drafts each appended to the array on their own and each rewrote the assertion, with incompatible final lengths: W0-06 +1, W1-03 "exactly 9", W3-01 "exactly 10", W4-01 "exactly 19", W6-03 "exactly 9". Two of them (W4-01 and W6-03) defined `arrows_schema_version` with different meanings. At most one could pass (skeptical-14, evidence-15 and brand-13 on W4-01).

Other facts that bound the design:
- `hydrate()` swallows failures and continues in memory (`storage.ts:27-29`). A migration that stamps a version while hydrate has failed would mark an unread save as migrated.
- Values round-trip as `String(v)` then `parseInt(v, 10)` (`storage.ts:23,39`). Any int up to 2^53 survives, but JS bitwise operators work on 32-bit signed ints. So a bitmask key must stay within bits 0–29.
- `resetProgress()` (`saveSystem.ts:146-153`) has no caller in `src/` or `App.tsx`; only `storage.test.ts:100,121` call it.
- Android Auto Backup is on and unconfigured (`android/app/src/main/AndroidManifest.xml:15` `android:allowBackup="true"`, with no backup rules in `app.json`). Every new key will be backed up and can be restored onto another device, whose clock or build may differ.

### Change
1. **Registry cross-check, before any code.** Diff the table below against every consumer task file present in `docs/next-level/tasks/` (at the time of writing: `W0.md` W0-05, `W1.md` W1-03, `W4.md` "Keys W4 needs from P-01"; `W3.md` and `W7.md` did not exist yet). **Integrator cross-check 2026-09-16:** the table below was reconciled against all nine files (`W0.md`…`W8.md`). W7's single packed `arrows_consent` replaced three consent keys, and W6's eight int keys (kill switch, install id, session count, JS-fatal record) were added because W6 moved them from strings to ints and the controller ruling says P-01 registers every key an approved task needs. W2, W5 and W8 need no key. Re-run this check only if a task file changes after that date.
   - Rename a key here to match a consumer's name.
   - Drop a key whose consumer task is CUT.
   - Add a key an approved task needs.
   - Update this table in the same commit. Only this task edits `PersistenceKeys`.
2. **Key record.** In `saveSystem.ts`, replace the eight loose constants with one module-private frozen record, `const Keys = Object.freeze({ currentLevel: 'arrows_current_level', … })`. Derive `PersistenceKeys = Object.freeze(Object.values(Keys))`. The eight legacy entries come first, in today's order; new entries are appended in table order. Code outside `saveSystem.ts` never passes a raw key string. Consumers add named getters and setters inside `saveSystem.ts` that use `Keys.*`.
3. **Register these 21 new keys.** Total: 29. All are ints. "Absent" means the key was never written and reads the stated default.

   | # | Key | Meaning and range | Absent reads | Consumer | Class | Restore / clock-skew rule the consumer must implement |
   |---|---|---|---|---|---|---|
   | 9 | `arrows_schema_version` | save schema version; `1` after this task | `0` (pre-versioning save) | P-01 | bookkeeping | value > `SCHEMA_VERSION` → the save is inert to this build (step 4) |
   | 10 | `arrows_finished_games` | finished games since the last *displayed* interstitial, ≥ 0 | `0` | W0-05 | bookkeeping | sanitise to a non-negative int |
   | 11 | `arrows_ftue_stage` | 0 not started, 1 T1 cleared, 2 T2 cleared, 3 done | `0` | W1-03…W1-06 | progress | out of 0..3 → treated as done (W1-03's route) |
   | 12 | `arrows_streak_freezes` | banked free streak freezes, 0..cap (cap is W4-02's constant) | `0` | W4-02 | progress | clamp to 0..cap |
   | 13 | `arrows_streak_saved_day` | local day a freeze was last spent and not yet shown; 0 = nothing to show | `0` | W4-02 | progress | a future day is ignored |
   | 14 | `arrows_daily_last_day` | local day number of the last daily clear; 0 = never | `0` | W4-06 | progress | `> today` → not played today |
   | 15 | `arrows_shapes_seen_lo` | collection bits 0–29 = catalogue indices 0–29 | `0` | W4-07 | progress | none; only OR bits in |
   | 16 | `arrows_shapes_seen_hi` | collection bits 0–29 = catalogue indices 30–59 | `0` | W4-07 | progress | none; only OR bits in |
   | 17 | `arrows_shapes_through_level` | campaign levels `0..N-1` already folded into the collection | `0` | W4-07 | progress | fold `[through, currentLevel)`; empty when `through ≥ currentLevel` |
   | 18 | `arrows_review_count` | lifetime store-review requests made | `0` | W4-11 | bookkeeping | none |
   | 19 | `arrows_review_last_day` | local day of the last review request; 0 = never | `0` | W4-11 | bookkeeping | a future day suppresses the prompt |
   | 20 | `arrows_gen_switch_level` | first level index dealt by the level-indexed curve | **`-1` via `getInt(key, -1)`**, meaning "not stamped" (0 is a real value); W3-05's accessor maps any negative to `null` | W3-05 | progress | stamp only while `persistenceHealthy` (step 5) |
   | 21 | `arrows_consent` | packed bits: 1 resolved, 2 gdprApplies, 4 personalisedAds, 8 ccpaOptOut; 0 = never resolved | `0` | W7-01, W7-03, W7-04 | preference (never deleted by a progress reset) | unknown high bits ignored |
   | 22 | `arrows_rc_kill_bits` | last accepted remote kill bits (bit 0 all ads, 1 interstitials, 2 rewarded, 3 telemetry transport) | `0` | W6-02 | bookkeeping | ignored while `REMOTE_KILL_SWITCH` is false |
   | 23 | `arrows_rc_version` | `configVersion` of the last accepted remote config; 0 = never fetched | `0` | W6-02 | bookkeeping | only a strictly higher version replaces it |
   | 24 | `arrows_tel_install_hi` | high 31 bits of the app-generated install id; 0 = not generated | `0` | W6-05 | bookkeeping (on-device only) | a restore carries it to the new device (documented, W6-05) |
   | 25 | `arrows_tel_install_lo` | low 31 bits of the install id | `0` | W6-05 | bookkeeping (on-device only) | as row 24 |
   | 26 | `arrows_tel_session_count` | cold starts since install | `0` | W6-05 | bookkeeping | sanitise to a non-negative int |
   | 27 | `arrows_tel_fatal_pending` | JS fatals recorded and not yet emitted | `0` | W6-07 | bookkeeping | sanitise to a non-negative int |
   | 28 | `arrows_tel_fatal_hash` | 32-bit unsigned FNV-1a of the last fatal's `name:message` | `0` | W6-07 | bookkeeping | none |
   | 29 | `arrows_tel_fatal_screen` | screen at the last fatal (1 splash, 2 menu, 3 game) | `0` | W6-07 | bookkeeping | out of range → 0 |

   Put a comment block above the shape keys:
   - bit *i* ↔ the shape catalogue index *i*;
   - the catalogue is append-only (its order-lock test is W4-01's);
   - past 60 shapes, a P-01 amendment adds `arrows_shapes_seen_x2`. It never reinterprets existing bits.
4. **Schema version and migration.**
   - Add `SaveSystem.SCHEMA_VERSION = 1` and `SaveSystem.migrate(): void`. Rules:
     - stored version `0` → write `arrows_schema_version = 1` and nothing else;
     - stored version `== SCHEMA_VERSION` → no write;
     - stored version `> SCHEMA_VERSION` → no write, no delete, no rewrite of any key. This covers a restore from a newer build.
   - `migrate()` never calls `deleteKey`, `resetProgress`, `multiRemove` or `getAllKeys`. It never touches a legacy key.
   - Additive keys never bump `SCHEMA_VERSION`. A bump is reserved for changing the meaning of an existing key, and needs its own migration and its own P-01 amendment.
5. **Hydrate health.**
   - `hydrate()` returns `true` on success and `false` when `multiGet` threw.
   - `initSaveSystem()` sets `SaveSystem.persistenceHealthy`. It is `false` before init and after a failed hydrate.
   - `initSaveSystem()` calls `migrate()` only when healthy, after `SaveSystem.useStore(store)`.
   - Document that a consumer stamping a derived value (for example W3's switch level) must skip the write when `persistenceHealthy` is false.
6. **`resetProgress()` is unchanged.** It still deletes exactly its current six keys. It has no UI caller, and W1-11 question 5 asks the owner whether a reset should replay the tutorial. The "Class" column is the input to that decision for whichever task first adds a reset surface. That task asks the owner and edits `resetProgress()` then. Add a test that locks today's delete set.
7. **Tests.**
   - Update the `storage.test.ts:36-45` exact array **once**, to the 29 strings in order. Keep the frozen, single-`multiGet` and `getAllKeys`-never-called assertions.
   - Add the cases in Acceptance to `storage.test.ts` (AsyncStorage boundary) and `src/core/__tests__/saveSystem.test.ts` (pure core over `MemoryStore`).
   - `storage.test.ts`'s existing mock returns fixed values. For cold-start cases, add a `Map`-backed mock where `multiSet` writes the map and `multiGet` reads it.
8. **Amendment rule** (a comment above `Keys`): any later key is added by a commit titled `P-01 amendment: <key>`. That commit edits this table, `Keys` and the exact array together. Consumer tasks never edit them.

### Non-goals
- No feature behaviour.
- No clock seam (`useClock`/`today()` is W4-02's).
- No FTUE classification (W1-03's route-time rule).
- No switch-level stamp (W3).
- No collection fold (W4-07).
- No ad-counter wiring (W0-05).
- No string store and no telemetry logic. (The eight W6 int keys are registered here only as keys; W6 owns their accessors and behaviour.)
- No Auto Backup rules (`dataExtractionRules`); that is a separate owner decision.
- No release: shipping P-01 alone is an owner call (see Risk).

### Acceptance criteria
1. `SaveSystem.persistenceKeys` deep-equals the 29-string array: the 8 legacy keys in today's order, then rows 9–29 in table order. `Object.isFrozen` is true. Boot makes exactly one `multiGet`, and `getAllKeys` is never called.
2. **No orphans.** Every value of `Keys` is in `persistenceKeys` and vice versa, and there are no duplicates. The test enumerates `Keys`; it does not restate the list.
3. **Cold-start round trip** over the `Map`-backed mock:
   - write every registered key a distinct value (both shape masks at `2^30 − 1`, both install-id halves at `2^31 − 1`, `arrows_tel_fatal_hash` at `2^32 − 1`), let the batch flush, run `initSaveSystem()` again over the same map, and every key reads its value back;
   - **control:** the unregistered probe key `arrows_unregistered_probe`, written the same way, reads its default after re-init. This test documents the hazard the registry prevents.
4. **Legacy upgrade.** Seed the map with only the 8 legacy keys: `current_level=37`, `total_solved=412`, `perfect_streak=5`, `best_perfect_streak=9`, `day_streak=4`, `last_play_day=2450`, `sound_on=0`, `dark_mode=1`. After `initSaveSystem()`:
   - every legacy getter returns its seeded value;
   - `arrows_schema_version` reads 1;
   - `multiSet` was called exactly once, with exactly `[['arrows_schema_version','1']]`;
   - `multiRemove` was never called.
5. **Idempotent.** A second `initSaveSystem()` over the migrated map makes no `multiSet` call.
6. **Future version is inert.** Seed `arrows_schema_version='99'` plus the legacy 8. After init, no `multiSet` or `multiRemove` call touches any key, and all 8 legacy values are intact.
7. **Hydrate failure.** With `multiGet` rejecting, `initSaveSystem()` resolves, `persistenceHealthy === false`, and `multiSet` is never called during init.
8. **Reset lock.** `resetProgress()` removes exactly the current six keys and none of rows 9–29.
9. `npx tsc --noEmit` is clean. `npx jest` is green, and the commit message states the suite and test counts before (11 / 61 at `da93dcd`) and after.
10. **Emulator over-install** (Verification step 3). The base build's menu and this build's menu show the same level label, the same stats line and the same theme after upgrade. A `sqlite3` dump shows the 8 legacy rows byte-identical, plus `arrows_schema_version|1` and no other new row.

### Verification
1. **PRE-FIX REPRODUCTION.**
   - On `da93dcd`, add a throwaway test (not committed) to `storage.test.ts` using a `Map`-backed mock. Write `arrows_daily_last_day` through a `HydratedIntStore` (reach the store via `SaveSystem.useStore` spy), then re-run `initSaveSystem()`. The value reads 0.
   - That is the silent-never-hydrates failure every consumer task is exposed to today. It exercises the real `storage.ts:20` hydrate path, not a unit that a later edit touches.
   - Also record `grep -n arrows_schema_version src` → 0 hits.
2. **TDD order.**
   - First, write `saveSystem.test.ts` characterisation cases for today's `dayStreak` / `registerSolve` / `resetProgress` behaviour. They must pass on the base commit.
   - Next, write Acceptance 1–8. Those fail.
   - Then implement.
   - Run `npx jest src/ui/__tests__/storage.test.ts src/core/__tests__/saveSystem.test.ts`, then the full `npx jest` and `npx tsc --noEmit`.
   - Acceptance 3 and 4 re-run hydrate over the same backing map, which is literally the cold-start read path where an unregistered key reverts. Acceptance 7 exercises the swallowed-failure branch at `storage.ts:27`.
3. **Emulator over-install** (API 31, `fleet_floor_api31`, port 5556). A jest mock is not AsyncStorage's SQLite file; this run is.
   1. Run `df -h /`. Build only if at least 5 GB is free (about 4 GB per arm64 release build, plus a 1 GB margin that is an **OWNER-PICKED STARTING VALUE**; one build at a time).
   2. Build the **base** release APK at `da93dcd`, or reuse P-04a's saved APK at `artifacts/base/da93dcd-release-arm64.apk` (check its `.sha256`). It must be a non-perf build:
      - `EXPO_PUBLIC_PERF_*` unset and `ARROWS_PERF_BUILD` unset;
      - `npx expo prebuild --platform android --clean --no-install`;
      - delete the generated bundle outputs listed at `scripts/perf/android/benchmark.mjs:415-421`, so a stale PERF bundle cannot be packaged;
      - `cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a`;
      - copy the APK out of `android/`.
      Confirm it is not a PERF build: it shows the splash and then the menu, while a PERF build boots straight into the game (`App.tsx:24`).
   3. Install it and launch once. Force-stop.
   4. Seed the 8 legacy values from Acceptance 4:
      - `adb root`;
      - `adb shell sqlite3 /data/data/com.danteb.arrows/databases/RKStorage` with `INSERT OR REPLACE INTO catalystLocalStorage VALUES(…)`.
      The database and table names are INFERRED from the legacy (default) implementation, `node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/ReactDatabaseSupplier.java:25,30` (`RKStorage`, `catalystLocalStorage`). The opt-in "next" storage (`next/StorageSupplier.kt:21-22`) would use database `AsyncStorage`, table `Storage` instead; it is used only when the gradle `AsyncStorage_useNextStorage` property is set. Confirm with `.tables` first. Keep the app force-stopped because of the WAL.
      If `adb root` is refused on this image, fall back: clear level 1 by hand-scripted `adb shell input tap`, using coordinates read from a screenshot and the removal order from `LevelGenerator.generate(0)`. Record which route was used.
   5. Cold-start and screenshot the menu. Dump the table.
   6. Build this task's APK the same way. `adb install -r` it (same versionCode 6, so no downgrade flag). Cold-start, screenshot and dump. Expect Acceptance 10.
   7. `adb install -r` the base APK back. The menu is unchanged; the old build ignores the new row.
   8. Reinstall this build. The dump row count is unchanged, which shows the idempotence on disk.
   9. Set `arrows_schema_version` to `99` with sqlite and cold-start this build. It still reads `99`, and the legacy rows are unchanged.
4. **Web pre-check** (optional, cheap): `npx expo start --web --port 8097`, then seed `localStorage` with the legacy 8 through the Browser pane's `javascript_tool`, reload, and read `arrows_schema_version`. The AsyncStorage web implementation is `window.localStorage`.
5. **UNVERIFIED-DEVICE:**
   - A real Auto Backup restore across devices. Try `adb shell bmgr list transports`; if a transport exists, run `bmgr backupnow` and restore, and record the result. Otherwise record it as unverified.
   - The Play Store upgrade path. INFERRED to match `adb install -r`.
   - iOS: no build exists, and any iOS build is BLOCKED-ON-DISK.

### Risk and rollback
- **Highest blast radius in the plan.** This is the code path that owns every player's progress. The change is additive: one write of one key, and no delete path anywhere in `migrate()`. Acceptance 4, 6 and 7 assert that.
- **Rollback:** revert the commit. Installs that already stamped version 1 keep one orphan row, which the old build never reads (it `multiGet`s only its 8 keys, as step 3.7 shows).
- **Recommendation for the owner:** ship P-01 alone, as its own release, before any key-writing feature reaches players. The plan's rule, repeated in `W0.md` W0-08, is exactly that. Cutting that release is BLOCKED-ON-OWNER. On the branch, consumer tasks may stack on top of P-01's commit.
- **Residual risks:**
  - Registry names can drift from a consumer file written later (`W3.md`, `W7.md`). Step 1 and the amendment rule handle that.
  - A stale PERF bundle packaged into the "release" APK would make the device run meaningless. Step 3.2's splash check catches it.

---

## P-02 — Build one capture instrument: boot into any screen, set and read back motion settings, record, and prove an effect rendered

- **Status:** READY
- **Effort:** XL. Stages A–C are about M. Stages D–E are about L and stop early if Stage D's calibration fails to separate.
- **Depends on:** none. It needs the `fleet_floor_api31` emulator running on port 5556 and one native build at a time (`df -h /` ≥ 5 GB before each).
- **Flag:** none (tooling). App-side changes are compiled only into PERF builds; `PERF_MODE` is inlined `false` in every other build (`src/perfMode.ts:8-13`).
- **Files:**
  - existing: `scripts/perf/android/benchmark.mjs`, `src/perfMode.ts`, `App.tsx`, `src/ui/GameScreen.tsx`, `docs/perf-tap-forgiveness-ab-2026-09-08.md` (erratum header only), `.gitignore`, `package.json`;
  - new: `scripts/perf/android/device.mjs`, `scripts/perf/android/capture.mjs`, `scripts/perf/android/pixel-diff.mjs`, `scripts/perf/android/pixel-diff.test.mjs`, `docs/perf-harness.md`, `docs/perf-capture-calibration.md`.

### Context
Every motion, art and FTUE acceptance in W0, W1, W2, W4 and W5 closes on an emulator screenshot or recording. The only device instrument today cannot produce trustworthy ones:
- **It can only boot the game.** `App.tsx:22,24` hardcodes `useState(PERF_MODE)` and `PERF_MODE ? 'game' : 'splash'`, so a PERF build never shows the splash or the menu.
- **It always measures the reduced-motion variant.** `validateDevice` forces `window_animation_scale`, `transition_animation_scale` and `animator_duration_scale` to 0 (`benchmark.mjs:350-357`). Reanimated treats `transition_animation_scale == 0` as reduced motion (`NativeProxy.kt:324-333`). The JS layer reads that once, at module init (`ReducedMotion.ts:16`), and `BoardView.tsx:191` passes it into the native exit protocol as header token 3 (`src/ui/nativeExitAnimation.ts:30`). There, `ArrowsBoardView.kt:269-271` draws a stationary dash that only fades.
  - Every recorded `exit` number is of that non-moving variant. That includes `docs/perf-tap-forgiveness-ab-2026-09-08.md` and `docs/perf-exit-native-slither-2026-09-01.log`.
  - No result JSON records the scale, so a reader cannot tell.
- **It has no record mode and no render proof.** `--screenshot` (`benchmark.mjs:257`, `captureScreenshot` at `:1400`) is one still frame at start.
- **Nobody knows the recorder's frame rate.** `adb shell screenrecord`'s achieved frame period on this software-GPU emulator is unmeasured. Yet draft W2 criteria were written as "at least three consecutive frames" (skeptical-14 and evidence-15 on W2-01).
- **Drafts would have built three harnesses.** W2-01 `capture-motion.mjs`, W5-01 `capture-device.mjs` and W6-11/12/13 all use the same adb plumbing and disagree on manifests and on whether scale 0 aborts (brand-13 on W5-01).
- **The single-pair gate in draft W6-13 does not generalise** (performance-16):
  - at scale 0 the `exit` phase still changes pixels, because alpha fades, so a pixel-change gate "passes" a frozen slither;
  - the press preview is static and ignores reduce motion (`StaticBoardSurface.native.tsx:224-226`, `BoardView.tsx:815-817`), so a tap held past `PRESS_PREVIEW_DELAY_MS = 64` (`BoardView.tsx:81`) draws even at scale 0.
- **Captures need real persistence.** W1-10 and W4 need captures of non-PERF builds (fresh install, over-install, flag-ON menus at 360×640 dp). PERF_MODE disables persistence and ads (`src/perfMode.ts` comment above `PERF_FEEDBACK`).

### Change
Build it in five stages. Each stage lands as its own commit with its own acceptance.

**Stage A — boot into any screen (W6-10).**
- Add `EXPO_PUBLIC_PERF_SCREEN` = `splash | menu | game`, default `game`, and export `PERF_SCREEN` from `src/perfMode.ts`. `App.tsx` uses it for the initial screen in PERF builds only.
- In `benchmark.mjs`, pass it through the build env block (`:380-397`) and write `perfScreen` into `benchmarkConfiguration` (`:167`), including when unset.
- Add opt-in phases `splash` and `menu` to `VALID_PHASES`, not to `DEFAULT_PHASES` (`:72`).

**Stage B — motion settings that are set, applied and read back (W6-11, W2-01, performance-16).**
1. Extract the adb, settings and launch plumbing into `scripts/perf/android/device.mjs`, used by both `benchmark.mjs` and the new `capture.mjs`.
2. Add `--motion-scale <0|1>`, default `0`, so historical runs stay comparable.
   - Set all three global scales to that value, then force-stop and launch the app (a running process never sees the change).
   - Read all three back with `settings get`.
   - Write the **read-back** values as `windowAnimationScale`, `transitionAnimationScale` and `animatorDurationScale` in the result `environment` block, next to `gpuRenderer` (`:1485-1492`). Also write `relaunchedAfterScaleChange: true`.
3. **App-reported value (PERF builds only).** Expose Reanimated's `useReducedMotion()` from the running app on a PERF-only node that `uiautomator dump` can read, for example accessibility label `perf-reduced-motion-0|1` on the existing `perf-game-screen` root (`GameScreen.tsx:201`). The harness reads it after launch.
   - Abort if the value disagrees with `transitionAnimationScale == 0`.
   - Write `appReducedMotion` to the JSON.
4. Write `reducedMotionVariantMeasured: true` whenever `appReducedMotion` is true, for **any** phase and with or without `--feedback`, and print a warning.
5. Create `docs/perf-harness.md` with these rules:
   - a number measured with `appReducedMotion: true` describes the reduced-motion variant, including the `exit` phase, which is then a stationary fade; it may not be quoted as the shipped experience;
   - `transition_animation_scale` is the setting Reanimated reads.
6. Add an erratum header to `docs/perf-tap-forgiveness-ab-2026-09-08.md`, and a note in `docs/perf-harness.md` about `docs/perf-exit-native-slither-2026-09-01.log`: both `exit` columns measured the non-moving variant and are not baselines for any scale-1 run.

**Stage C — capture mode for any installed APK (W2-01, W5-01 device half, W6-13 record half).**
- New CLI `scripts/perf/android/capture.mjs`, with an `npm run capture:android` alias:
  - `--apk <path>` (optional install), `--motion-scale <0|1>` (**required**: no silent default for captures), `--wm-size <WxH px>` / `--wm-density <dpi>` (applied, read back, and reset with `wm size reset; wm density reset` on exit, including on error);
  - `--shot <label>` for a single `screencap`, and `--record <label> --seconds <n>` for `screenrecord`;
  - `--frames` to split an mp4 into PNGs with `ffmpeg`, and `ffprobe` frame timestamps.
- It works on PERF and non-PERF builds; it only observes and never taps unless given a scripted step.
- **Scripted steps for PERF builds** reuse `benchmark.mjs`'s board bounds (`findBoardBounds`, `:463`) and phases: `blocked`, `exit`, the won panel (`perf-next-level`, `GameScreen.tsx:292`) and the lost panel (`perf-terminal-overlay`, `:250`).
  - **Pin every scripted tap's hold below 64 ms.** Measure the down→up interval of `adb shell input tap` on this image once with `adb shell getevent -lt`, record it in the calibration doc, and switch to a shorter injection if it is ≥ 64 ms.
- **Manifest** (`manifest.json` beside every artifact): git HEAD and dirty flag, APK sha256, serial, AVD, API level, `wm size`/`density` read-back, all three scales read-back, `relaunchedAfterScaleChange`, `appReducedMotion` (or `"unavailable: non-PERF build"`), the tap-hold measurement, and the recorder's measured frame period from the calibration doc.
- A recorded run never produces perf numbers. `benchmark.mjs --record` forces `runs=1`, stamps `perfNumbersInvalid: true`, and writes no phase percentiles.
- Artifacts go under `artifacts/captures/<label>/`, which is added to `.gitignore`.
- **Recorder calibration.** At `--motion-scale 1` on a PERF build, record the 650 ms blocker flash (`BLOCKER_FLASH_MS`, `src/ui/feedbackCurves.ts:10`) 5 times (**OWNER-PICKED STARTING VALUE**). From `ffprobe` timestamps, publish for each recording: frames inside the flash window, and min/median/max inter-frame period. Print the reconciliation `frames observed` vs `650 ms ÷ median period`.
  - State in the doc that screenrecord emits frames only when the screen changes (INFERRED; confirm by recording 2 s of an idle board and counting frames). Frame counts over static periods therefore mean nothing.
  - Until this table exists, no task may state a frame-count threshold. Criteria say "visible in the recording" plus owner eyeball.

**Stage D — pixel-difference floor (W6-12).**
- `scripts/perf/android/pixel-diff.mjs` decodes two PNGs with `sharp` (already a devDependency). It crops to a named region, applies optional `--mask x,y,w,h` rectangles, and reports the fraction of pixels whose max channel delta exceeds a stated tolerance.
- Regions:
  - `board`: `findBoardBounds` minus the header strip. The `{remaining} left` counter and heart pips must fall outside it, because they change on every removal.
  - `screen`: the full frame.
- Calibration, with n = 10 per set (**OWNER-PICKED STARTING VALUE**) on the **base `da93dcd`** PERF APK:
  - **A (idle):** idle board, no input — the noise floor.
  - **B (no-draw control):** `--diagnostic-empty-board` (`benchmark.mjs:114`) with the same input; an input that provably draws nothing.
  - **C (known visible):** a blocked tap at `--motion-scale 1`.
  - **Menu idle rows** for consumers who diff menus (W4 asks for this): idle menu at scale 0 and at scale 1, with and without the Play pill masked. The pill breathes (`HomeScreen.tsx:50-57`).
- Publish raw per-sample numbers and min/median/max/n in `docs/perf-capture-calibration.md`, with commands, APK sha256 and read-back scales.
- Derive each region's floor from the observed A/B maximum and the observed spread, and show the arithmetic. **Kill condition:** if A/B and C overlap, write "this instrument cannot prove rendering on this emulator" and do not build Stage E.

**Stage E — effect-rendered gate, validated per phase (W6-13 and performance-16).**
- `benchmark.mjs --assert-rendered <phase>` is opt-in. It records whether the check ran and passed, with the measured value and the floor.
- **`blocked`:** changed-pixel fraction of a mid-phase frame vs the pre-phase frame, `board` region, compared with the Stage D floor. Validation pair on the base APK:
  - scale 1 → passes;
  - scale 0 → fails (the reduce-motion blackout: `blockerOpacityAt(1) = 0`, `feedbackCurves.ts:25-31`);
  - the B control → fails.
  After the W0 reduce-motion fix (W0-04) lands, scale 0 is **expected to pass** because a static equivalent is drawn. That flip is W0-04's regression evidence, and it is why the non-rendering control must be the base APK or set B, never "scale 0" on a current build.
- **`exit`:** a motion assertion. Take two mid-phase frames at different offsets in the same run and require the centroid of changed pixels to move along the arrow's exit direction by more than a displacement floor measured the same way on set A.
  - Validation: scale 1 → passes; scale 0 → **fails the moved check** even though pixels change (stationary fade, `ArrowsBoardView.kt:269-271`).
- Rule in `docs/perf-harness.md`: a number for a new visual effect may be reported only if the same session contains a passing `--assert-rendered` run for that phase plus the attached capture.

### Non-goals
- **iOS capture** (draft W6-14). Not in Stages A–E. It is P-02b (script, READY) and P-02c (calibration, BLOCKED-ON-DISK) below, so the capture instrument keeps one owner.
- **W5's headless SVG renderer** (`scripts/art/render-screen.ts`). It is not a capture instrument; it stays with W5 if kept.
- Re-baselining any perf number. W2, W3 and W5 own new baselines; this task only marks old ones.
- Seeding persisted state into release builds. P-01's `sqlite3` recipe or the web preview's `localStorage` covers that.
- Any change to non-PERF app behaviour.
- A `PERF_FULL_MOTION` build flag that overrides the system setting (draft 1 W2-02). One mechanism, the real system setting, is the instrument.

### Acceptance criteria
- **A1.** With `EXPO_PUBLIC_PERF_SCREEN` unset, `npm run perf:android -- --feedback` on a fresh build passes `validateWorkload`. `DEFAULT_PHASES` is byte-identical to `da93dcd` (diff shown). `perfScreen: "game"` appears in the result JSON.
- **A2.** `perfScreen=splash` and `perfScreen=menu` builds show the splash and the menu respectively, evidenced by a `uiautomator dump` excerpt plus a screenshot.
- **B1.** Two runs of one saved APK (`--skip-build --apk`), at `--motion-scale 0` and `1`:
  - the JSON `environment` blocks differ only in the three read-back scales, `appReducedMotion` (true / false) and `reducedMotionVariantMeasured` (true / absent);
  - both carry `relaunchedAfterScaleChange: true`.
- **B2.** With the `settings put` pointed at a bogus key, the recorded values reflect the device, not the request. With the app launched before the scale change (the relaunch step skipped deliberately), the harness aborts on the `appReducedMotion` mismatch.
- **B3.** The erratum header exists in `docs/perf-tap-forgiveness-ab-2026-09-08.md`, and `docs/perf-harness.md` names `transition_animation_scale` and the `exit` phase explicitly.
- **C1.** `capture.mjs` produces a `manifest.json` with every field listed in Stage C for:
  - a PERF build (`appReducedMotion` present);
  - a non-PERF release build on the menu at `--wm-size 1080x1920 --wm-density 480` (`appReducedMotion` "unavailable").
  After both runs, `adb shell wm size` reads the physical size again.
- **C2.** `docs/perf-capture-calibration.md` holds the recorder table (5 recordings, per-recording frames, min/median/max period, reconciliation line), the idle-board frame count, and the measured tap-hold interval.
- **C3.** A `benchmark.mjs --record` result JSON contains `perfNumbersInvalid: true`, and `grep -E '"p9[59]"'` on it finds nothing.
- **D1.** `node --test scripts/perf/android/pixel-diff.test.mjs`:
  - synthetic PNG pairs with a known count of differing pixels give the exact fraction;
  - a mask removes exactly the masked pixels;
  - the `board` crop excludes a synthetic header strip.
- **D2.** The calibration doc contains sets A, B and C plus the menu rows, n = 10 each, with raw values. Each floor is stated as arithmetic on measured A/B values, with a sentence showing it would **not** pass set B. If they did not separate, the doc says so and Stage E is recorded as not built.
- **E1** (only if D separated). On the base APK:
  - `--assert-rendered blocked`: scale 1 PASS, scale 0 FAIL, B control FAIL;
  - `--assert-rendered exit`: scale 1 PASS, scale 0 FAIL on the moved check, while its changed-pixel fraction is above the floor. That last number is printed, proving the alpha-fade trap is caught.
  All six outcomes appear in the calibration doc with values.
- **E2.** A run with none of the new flags produces a JSON indistinguishable from a `da93dcd` run of the same APK, apart from the added `environment` fields and `perfScreen`.
- `node --test scripts/perf/android/*.test.mjs` passes (16 today, plus the new ones). `npx tsc --noEmit` is clean. `npx jest` is green.

### Verification
1. **PRE-FIX REPRODUCTION** on `da93dcd`:
   - a PERF build boots to the game only (screenshot);
   - an existing result JSON has no scale field (`grep -c animatorDurationScale` → 0);
   - with the base harness settings (all scales 0), a manual `adb exec-out screencap` taken about 100 ms after a blocked tap shows no magenta flash, while the same tap after `adb shell settings put global transition_animation_scale 1` plus force-stop and relaunch shows it. That is the instrument blind spot this task closes, observed directly.
2. **Closing runs.**
   - A1–E2, in stage order, on `emulator-5556` / `fleet_floor_api31` / API 31.
   - B1 and B2 exercise the original failure: numbers recorded without knowing which variant ran, including the relaunch trap.
   - C2 replaces the assumed recorder rate with a measured one.
   - E1's six-outcome table proves the gate detects a real non-rendering, for **each** phase, including the frozen-slither case a single pair missed.
3. **TDD.**
   - Write `pixel-diff.test.mjs` first, with synthetic PNGs.
   - For harness flags, write a `node:test` case (existing `*.test.mjs` style) for argument parsing, and for the "scale read-back overrides request" merge before wiring adb.
   - Every visual claim closes only on the emulator artifacts; never on tsc or jest.
4. **UNVERIFIED-DEVICE:**
   - every floor and frame period is specific to this software-GPU emulator on this host, and does not transfer to a phone;
   - thermal and GPU behaviour;
   - iOS (not built).

### Risk and rollback
- **Silently changing the default path invalidates every recorded number.** Guarded by: default scale 0, `DEFAULT_PHASES` byte-identical, and E2.
- **A capture left at scale 1 contaminates a later perf run.** Every run sets the scales explicitly, and `capture.mjs` requires `--motion-scale`.
- **An annoying gate gets disabled.** It is opt-in per phase and always records its measured value.
- **The honest negative outcome is likely.** Emulator noise may swamp a thin stroke. Stage D's kill condition makes that a documented result, not a failure.
- **Rollback:** all flags are additive and default off. Revert per stage commit.

---

## P-02b — iOS backend of the capture instrument: the simctl capture script, proven on a stock simulator app

- **Status:** READY
- **Effort:** M
- **Depends on:** P-02 (Stage C manifest conventions; Stage D `scripts/perf/android/pixel-diff.mjs`,
  reused, not copied). Steps 1–4 below can start before P-02's Stage D lands.
- **Moved from:** W8-02 (integrator 2026-09-16). The controller ruling gives the capture instrument one owner (P-02); W8-02 and W6-17 both specified this iOS path, so it now lives here. W8 tasks consume it.
- **Flag:** none (tooling)
- **Files:** `scripts/perf/ios/simctl.mjs` (new), `scripts/perf/ios/capture.mjs` (new),
  `scripts/perf/ios/simctl.test.mjs` (new), `docs/perf-harness.md` (created by P-02; add an iOS
  section), `package.json` (alias `capture:ios`)

### Context
There is no iOS capture instrument. P-02 Stages A–E build the Android one; this task and P-02c are its iOS
`xcrun simctl` backend. Every iOS visual claim in W8-05, W8-08 and W8-09 needs one, or those claims
get closed with Android artifacts or impressions. Three hazards are specific to this machine
(EXECUTED; see the facts above):
- "iPhone 16 Pro" names five simulators;
- `simctl` cannot tap and `idb` is absent, so input is manual or uses a session tool;
- the disk is at 10 GB, and booting a simulator writes device data (size unmeasured).

### Change
1. `simctl.mjs`: parse `xcrun simctl list devices --json`, then resolve `--device <name>` plus
   `--runtime "iOS x.y"` to exactly one UDID. Zero or several matches abort with the candidates
   listed. Also provide boot, shutdown, install (`--app <path.app>`), launch (`--bundle-id`, default
   `com.danteb.arrows`), `ui <udid> appearance light|dark` with read-back, `io <udid> screenshot`, and
   `io <udid> recordVideo` stopped with SIGINT.
2. `capture.mjs`:
   - `--shot <label>`, `--record <label> --seconds <n>`, `--frames` (ffmpeg split plus ffprobe
     frame timestamps, with the same flags as P-02's Android capture);
   - `--appearance`, `--keep-booted`;
   - it aborts before booting when `df -h /` shows < 5 GB available (**OWNER-PICKED STARTING VALUE**,
     the same gate P-02 uses);
   - it shuts the simulator down on exit, including on error, unless `--keep-booted`;
   - it never erases a simulator.
3. `manifest.json` next to every artifact, holding:
   - git HEAD and dirty flag;
   - app path and sha256 of the app executable;
   - UDID, device name, runtime, Xcode and SDK versions;
   - appearance read-back;
   - `appReducedMotion: "unavailable"` until P-02c;
   - `input: "none" | "manual" | "<tool name>"`;
   - `recorderFramePeriod: "uncalibrated"` until P-02c;
   - `df` before and after.
   Artifacts go to P-02's `artifacts/captures/<label>/`.
4. Add to `docs/perf-harness.md`:
   - a simulator capture is not device evidence (GPU, refresh rate, thermal and gesture handling
     differ);
   - an iOS claim is never closed by an Android artifact, and the reverse.
5. After P-02 Stage D: expose `--diff <a.png> <b.png> --region board|screen` by calling
   `pixel-diff.mjs`.

### Non-goals
Driving taps. Calibrating anything on our app (P-02c). Building the app.

### Acceptance criteria
- `node --test scripts/perf/ios/simctl.test.mjs` passes. The fixture JSON contains "iPhone 16 Pro"
  under two runtimes:
  - the name alone → error naming both UDIDs;
  - with `--runtime "iOS 18.6"` → exactly the 18.6 UDID;
  - an unknown runtime → error.
- On "iPhone 16 Pro" / iOS 18.6 with the stock Settings app (`com.apple.Preferences`):
  - `--appearance dark --shot settings-dark` produces a PNG plus a manifest whose appearance
    read-back is `dark`;
  - `--record idle --seconds 5 --frames` produces an mp4 and a frame-timestamp list. The manifest
    records the frame count for 5 s of an unchanging screen. This documents whether `recordVideo`
    emits frames only when the screen changes. No threshold.
- After each run, `xcrun simctl list devices` shows that device `Shutdown`, and the manifest's `df`
  before/after is present.

### Verification
1. PRE-FIX REPRODUCTION: `ls scripts/perf/ios` → no such directory. P-02 Stages A–E are Android-only.
2. The unit test exercises the one ambiguity that would silently capture the wrong runtime on this
   Mac. The stock-app run exercises boot, appearance read-back, screenshot, record and shutdown
   end-to-end without needing our build.
3. TDD: write `simctl.test.mjs` first, against the fixture JSON.
4. UNVERIFIED until P-02c: the recorder's frame period on our app, reduced-motion read-back, and
   pixel floors. UNVERIFIED-DEVICE: everything a phone would show differently.

### Risk and rollback
Simulator data on a nearly full disk, mitigated by the `df` gate and shutdown on exit. Rollback: the
scripts are standalone. Delete them.

---

## P-02c — Calibrate the iOS capture instrument on the app: recorder rate, pixel floor, reduced-motion read-back

- **Status:** BLOCKED-ON-DISK (needs ≥ 20 GB, as W8-03)
- **Effort:** M
- **Depends on:** P-02b, W8-03 (first iOS compile), P-02 (Stage B3's PERF-only `perf-reduced-motion-0|1`
  label on `perf-game-screen`, and Stage D)
- **Moved from:** W8-04 (integrator 2026-09-16), for the same single-owner reason as P-02b.
- **Flag:** none (tooling; the app-side label is PERF-only per P-02)
- **Files:** `scripts/perf/ios/capture.mjs`, `scripts/perf/ios/simctl.test.mjs`,
  `docs/perf-capture-calibration.md` (created by P-02; add an iOS section)

### Context
P-02 measures the Android recorder's frame period and pixel-difference floor. Neither transfers to
the iOS simulator.

Reduce motion is the second gap:
- Reanimated reads the OS setting once at module init (`ReducedMotion.ts:16`, cited in P-02), and
  `BoardView.tsx:191` passes it into the native exit payload as header token 3.
- A reduce-motion capture is therefore only meaningful if the running app reports the value, and a
  change needs a relaunch.
- `xcrun simctl ui` has no reduce-motion option (EXECUTED). Two candidate mechanisms exist, both
  unverified: the Settings app toggle, and
  `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`.

`EXPO_PUBLIC_*` values are inlined when the JS bundle is built (`src/perfMode.ts:5-6`), so each
fixture variant is a separate Release build.

### Change
1. Build Release simulator apps, one build at a time with `df` recorded before each. Copy each `.app`
   to the scratchpad and record its sha256:
   - (a) `EXPO_PUBLIC_PERF_LEVEL=3827`;
   - (b) the same plus `EXPO_PUBLIC_PERF_EMPTY_BOARD=1`, which unmounts `ArrowsBoardView` at
     `StaticBoardSurface.native.tsx:35-36,101`;
   - (c) `EXPO_PUBLIC_PERF_LEVEL=935`;
   - (d) (c) plus `EXPO_PUBLIC_PERF_EMPTY_BOARD=1`.
   W8-06 reuses all four.
2. Reduce-motion mechanism:
   - try each candidate, relaunch, and read the app's `perf-reduced-motion-*` label through any
     simulator accessibility inspector available to the session;
   - record which mechanisms change the app-reported value;
   - implement the working one as `capture.mjs --reduce-motion on|off`: set, relaunch, read back,
     abort on mismatch, write `appReducedMotion`;
   - if none works, write that down, and `appReducedMotion` stays `"unavailable"`.
3. Recorder calibration on build (a), reduce motion off:
   - record the 650 ms blocker flash (`BLOCKER_FLASH_MS`, `src/ui/feedbackCurves.ts:10`) 5 times
     (**OWNER-PICKED STARTING VALUE**), tapping the blocked cell r35 c19 by hand;
   - relaunch before each tap so hearts reset;
   - from ffprobe timestamps, publish frames inside the flash window, min/median/max frame period,
     and the reconciliation `frames observed` vs `650 ms ÷ median period`;
   - record the frame count for 2 s of an idle board.
4. Pixel floor with `pixel-diff.mjs`, board region, excluding the `{remaining} left` counter
   (`GameScreen.tsx:219`) and the heart pips. n = 10 per set (**OWNER-PICKED STARTING VALUE**):
   - A: idle board on (a);
   - B: the same input on (b), which provably draws no arrows;
   - C: a blocked tap on (a) with reduce motion off.
   Derive the floor from A/B with the arithmetic shown. Kill condition as in P-02: if A/B and C
   overlap, write "this instrument cannot prove rendering on this simulator".

### Non-goals
Perf numbers. Any scripted tap driver. Android.

### Acceptance criteria
- The calibration doc's iOS section holds: device, runtime and app sha256 per row; the reduce-motion
  mechanism table (mechanism → app-reported value); the recorder table (5 rows plus the
  reconciliation line and the idle count); and sets A/B/C with raw values plus the derived floor or
  the kill-condition sentence.
- A `capture.mjs --reduce-motion on` manifest shows `appReducedMotion: true` read back from the app.
  Otherwise the doc states that no mechanism worked.
- `node --test scripts/perf/ios/simctl.test.mjs` includes a case where the requested and read-back
  reduce-motion values disagree, and the run aborts.

### Verification
1. PRE-FIX REPRODUCTION: after P-02, `grep -ci ios docs/perf-capture-calibration.md` → 0.
2. The recorder table replaces an assumed frame rate with a measured one. The reduce-motion read-back
   comes from the running app, so a capture cannot silently record the wrong exit variant (the trap
   that invalidated Android's historical `exit` numbers). Set B is a real no-draw control.
3. TDD: the read-back mismatch test is written before the flag is wired.
4. UNVERIFIED-DEVICE: every floor and frame period (simulator on this Mac only).

### Risk and rollback
Four Release builds on a tight disk: build one at a time and delete each `ios/build` product after
copying the `.app`. Rollback: revert script and doc changes.

---

## P-03 — Rewrite PRODUCT.md for Track A and correct DESIGN.md's measured-false claims

- **Status:** READY. The owner reads the PRODUCT.md diff and says yes before it lands, since identity wording is taste-bound. The Track A decision itself is already ruled.
- **Effort:** M. The plan said S, but re-deriving about 20 claims with citations, plus two small evidence artifacts, is 1–2 days.
- **Depends on:** none
- **Flag:** none (documentation)
- **Files:** `PRODUCT.md`, `DESIGN.md`, `RELEASE.md` (the example store copy at `:75` only), `src/ui/arrowGeometry.ts` (header comment `:8-9` only), `src/core/__tests__/noDeadEnd.test.ts` (new), `scripts/analysis/tier-bands.ts` (new)

### Context
`PRODUCT.md:16-19` says Arrows "is a minimalist logic puzzle… The puzzle is finding the order", and `RELEASE.md:75` repeats "Find the order". Both are false as implemented:
- removing an arrow only empties cells, so `BoardLogic.canExit` (`src/core/boardLogic.ts:69-71`) is monotone: a lane that is clear stays clear;
- 50 random-greedy playthroughs across levels 1…168 each cleared in exactly `arrowCount` taps. That script lived in a session scratchpad that no longer exists, so the claim needs a committed artifact.

The owner ruled Track A (2026-09-16): a calm attention / visual-search game. Difficulty means legibility, density, clearable fraction and silhouette novelty. No ordering mechanic, no "puzzle depth".

`DESIGN.md` is largely a Unity-era document, and the audit found shipped behaviour contradicting it (checked against the code at `da93dcd`):

| DESIGN.md | Claim | What ships | Evidence |
|---|---|---|---|
| :3, :11, :26-27, :138-141, :148-149, :175-177 | Unity 6 UGUI, `GameManager.Palette`, `UITween.cs` coroutines, `ArrowsSetup`, CanvasScaler 1080×1920 | RN / Expo SDK 57 port; palette in `src/ui/theme.ts`; Reanimated; core in `src/core` | repo layout |
| :33 | border "reserved hairline (currently unused)" | panel edge and Retry outline | `GameScreen.tsx:256,298` |
| :44-45 | ink-dim ≈ 4.8 / 6.5:1, accent-light ≈ 3.2 / 5:1 | measured 5.13 / 7.23 and 3.49 / 7.09 (draft W5-01; reproduced by evidence-15) | contrast is W0-06's to own |
| :59-65 | "corner fillet ~0.12 cell"; "baked… mipmapped / trilinear" | a round line-join only, outer radius `STROKE/2 = 0.072` cell, inner edge not filleted; vector paths in a retained native view | `arrowGeometry.ts:20`, `BoardView.tsx:826,857`, `ArrowsBoardView.kt:64-65` |
| :79-82 | hint "Unlimited… no coin/ad gating yet" | the hint is a rewarded ad | `GameScreen.tsx:180-191` |
| :129-134 | Normal ≈ 70–200 arrows, Hard up to ~260, Super Hard ~100–160; "~19–23 cells across" | measured tier bands overlap: Normal 57–116, Hard 102–197, Super Hard 54–209 (plan §8; script not committed) | `src/core/difficulty.ts:59-65` |
| :146-149 | every effect "≈60–280 ms and eases out" | exit travel **accelerates** (`k²`); at least six effects exceed 280 ms: bump 300, exit up to 320, flash 650, hint pulse 1600, Play pill 1100 per half-cycle, splash draw 850 | `BoardView.tsx:992`, `ArrowsBoardView.kt:269`, `feedbackCurves.ts:8,10`, `exitAnimationConfig.ts:22`, `BoardView.tsx:934`, `HomeScreen.tsx:51`, `SplashScreen.tsx:45` |
| :151-153 | menu ↔ game **and level → level** cross-fade; board faded in from alpha 0 | menu ↔ game is an entering-only `FadeIn.duration(180)`; level → level is a hard cut | `App.tsx:63,75` |
| :154-156 | Play pill springs 0.9 → 1, breathes "±3% over ~1.8 s" | no entrance spring; scale 1.00 → 1.03, 1100 ms each way (2.2 s cycle) | `HomeScreen.tsx:50-57` |
| :157-158 | hint pulse ~1.1 s | 280 ms recentre, then a 1600 ms pulse | `BoardView.tsx:310-311,934`, `StaticBoardSurface.native.tsx:348` |
| :159-160 | press scales to 0.94 and "springs back" | instant pressed-style scale 0.94, no spring | `HeaderButton.tsx:32`, `HomeScreen.tsx:86`, `GameScreen.tsx:281,297` |
| :163-165 | recorded whoosh `whoosh.mp3` with synth fallback | pentatonic pop ladder `pop0…pop7.wav` | `src/ui/audio.ts:13-15`, `src/ui/exitCombo.ts` |
| :166-167 | horizontal shake plus scale swell | directional bump along the arrow's own axis plus blocker flash on the blocking arrow | `feedbackCurves.ts` |
| :168-171 | "Solved!" / "Perfect!" toast | not built (`grep -rn "Solved!" src` → 0); controller ruling: delete from the doc | — |
| (absent) | reduce motion | feedback blackout today; native exit becomes a stationary dash fading in place | `feedbackCurves.ts:25-31`, `nativeExitAnimation.ts:30`, `ArrowsBoardView.kt:269-271` |

### Change
1. **PRODUCT.md.** Rewrite "Users" and "Product Purpose". It must state:
   - Arrows is a calm attention / visual-search game. The player finds the arrows whose lane is clear.
   - No tap order can make a board unsolvable. The only failure is a misread, and hearts forgive misreads.
   - Difficulty comes from legibility, density, clearable fraction at deal, and silhouette novelty. The game adds no ordering mechanic, and difficulty never comes from tap order. (Do not write the phrase "puzzle depth" even as a negation: Acceptance 1's grep bans it.)
   - Success is still unbroken flow from level to level. The pictures made of arrows are the content.

   Keep Register, Brand Personality, Anti-references and Principles 1–3 unchanged, except for the references to "puzzle" reasoning. Principle 4 and Accessibility gain one rule (controller ruling):
   - information-carrying feedback (blocker flash, blocked arrow, hint) renders a **static equivalent** under OS reduce motion, honouring the setting;
   - decorative motion (heart pop, star pops, Play breathing, splash) may simply be skipped.
   Replace "no gameplay action depends on animation" with that rule. The genre and store category word "puzzle" may stay; the logic-puzzle framing may not.
2. **DESIGN.md.** Correct every row of the Context table:
   - Describe what ships, cite `file:line` for every number, and state no ratio, duration or size without a citation.
   - Replace Unity names with the RN files.
   - Fillet: "bends are rounded by the stroke's own round join (outer radius 0.072 cell); the ~0.12-cell fillet was never implemented". This applies brand-13's replacement for draft W5-11. Whether a real fillet is ever wanted is a W5 question, not a doc claim.
   - Contrast: **do not edit** the contrast paragraph (`DESIGN.md:44-45`) or the ratio columns. W0-06 (Phase 1) owns them and rewrites them from its committed audit script (integrator 2026-09-16: two READY tasks may not own one change).
   - Diff the colour table against `src/ui/theme.ts` and fix every mismatch as documentation. Do not change a token.
   - Delete the Solved/Perfect toast paragraph and describe the shipped win and lose panels (`GameScreen.tsx:247-315`) in one sentence.
   - Mark level → level as "hard cut today; a transition is specified by the W2 level-transition task, flag OFF until accepted".
   - Add a **Reduce motion** subsection with (a) the required behaviour from step 1 and (b) what ships today. The feedback blackout is a defect owned by W0-04. The native exit's stationary fade is shipped and **not yet signed off**; W2's reduced-motion task owns that sign-off.
3. **Motion section structure** (merging draft 1 W2-11 and draft 2 W2-03).
   - Replace the single budget with named bands: tap-local feedback, explanatory feedback, state/screen transitions, ceremony (splash, star pops) and ambient (menu only, exactly one).
   - Each band's bounds are the **min and max of the shipped effects in it**, each cited. A band with no shipped effect is labelled "provisional — set by the task that ships its first effect". No band number is invented.
   - Describe the exit slither as accelerating outward (`k²`).
4. **Difficulty paragraph.** Add `scripts/analysis/tier-bands.ts` (`npx tsx`). For each tier over level indices 0..599 (**OWNER-PICKED STARTING VALUE**), it prints n, min, p10, median, p90 and max arrow count, plus grid rows × cols. Quote its printed output in DESIGN.md, name the script and the range, and drop the Unity figures.
5. **Evidence for the product claim.** Add `src/core/__tests__/noDeadEnd.test.ts`:
   - for level indices `[0, 2, 5, 11, 23, 35, 59, 116, 161, 167]`, run 5 random-greedy playthroughs each, using `DotNetRandom` seeds 1..5 (sample choice matches the 2026-09-09 measurement);
   - each run repeatedly removes a uniformly chosen exitable arrow and must end with `board.arrows().length === 0` after exactly `arrowCount` removals, never meeting a step with no exitable arrow;
   - PRODUCT.md cites this test.
6. Change `RELEASE.md:75`'s example short description so it no longer says "Find the order". Keep it an example; the live listing is W7's and is outward-facing. Change `src/ui/arrowGeometry.ts:8-9`'s comment to the true join description (comment only).

### Non-goals
- No token, colour, duration or behaviour change in code.
- No store listing edit (W7; owner-gated).
- No motion sign-off (W2).
- No new feature described as shipped. Flagged-OFF features are not in DESIGN.md until accepted.
- No streak "from 1" change; DESIGN.md:91-92 stays (W4-02).
- No determinism-contract edit (DESIGN.md:135-136; W3 changes it when the curve changes).

### Acceptance criteria
1. `grep -rniE "logic puzzle|finding the order|find the order|brain teaser|puzzle depth" PRODUCT.md DESIGN.md RELEASE.md src/ui/arrowGeometry.ts` → 0 hits.
2. `grep -nE "UITween|GameManager|CanvasGroup|PlayerPrefs|Difficulty\.cs|ArrowsSetup|CanvasScaler|mipmap|whoosh|Solved!|0\.12 cell|currently unused" DESIGN.md` → 0 hits (the last two absorb CUT W5-10), unless a hit sits in one sentence explicitly labelled as port history.
3. **Motion reconciliation, both directions.** The output of `grep -nE "withTiming|withSpring|withRepeat|withDelay|withDecay|FadeIn|entering=" src/ui/*.ts src/ui/*.tsx App.tsx` is pasted into the commit description. Every hit maps to exactly one Motion band entry, and every Motion entry maps to at least one hit. `withDecay` (`BoardView.tsx:495-496`, pan momentum) is included.
4. Every number in the revised Components, Levels and Motion sections carries a `file:line` citation that resolves at the commit, checked by the reviewer one by one.
5. `npx jest src/core/__tests__/noDeadEnd.test.ts` passes. The same assertion fails when pointed at the existing deadlock fixture in `boardLogic.test.ts` ("greedy removal detects deadlock"), showing the test can fail. Run once locally, not committed.
6. `npx tsx scripts/analysis/tier-bands.ts` prints the table, and DESIGN.md's difficulty numbers equal its output.
7. `git diff --stat` touches only the files listed. The `arrowGeometry.ts` hunk is comment-only.
8. The owner says yes to the PRODUCT.md diff.

### Verification
1. **PRE-FIX REPRODUCTION.** Acceptance 1's grep on `da93dcd` finds `PRODUCT.md:16,19` and `RELEASE.md:75` (executed while writing this file). Acceptance 2's grep finds the Unity names. `grep -rn "Solved!" src` → 0 shows the toast is documented but not built.
2. **Closing.** Acceptance 1–7.
   - The two greps are the defect itself: false text.
   - The two-direction reconciliation is the only check that proves the doc and the code list the same effects.
   - `noDeadEnd.test.ts` turns the central product claim from a scratchpad memory into a test that fails if the rules ever change. That matters for Track A: a future mechanic that allows dead ends would break the identity, and this test would go red.
3. **TDD.** Write `noDeadEnd.test.ts` first; it passes on the base commit, as the claim requires. Run the deadlock negative control. Documentation closes on the greps and the citation check, not on runtime evidence, and none is claimed.
4. **UNVERIFIED-DEVICE:** none. Nothing here is a runtime claim.

### Risk and rollback
- **Low runtime risk.** Only docs, one comment, one test and one script change.
- **Real risk: a doc sentence that is still wrong but now carries a citation.** Mitigated by the one-by-one citation check.
- **Collision (resolved by the integrator 2026-09-16):** this task is the single owner of the toast deletion, the fillet and `border` corrections (W5-10 CUT) and the Motion-section rewrite (W2-02 narrowed to the post-W2-01 reduce-motion sign-off). W4-10 edits only the Menu bullet after owner acceptance; W0-06 owns the contrast paragraph. Whichever lands second rebases.
- **Rollback:** revert the commit.

---

`P-04` below is three independently statused parts. A dependency on "P-04" means all three.

## P-04a — Prove targetSdk from a locally built release artifact

- **Status:** READY
- **Effort:** S
- **Depends on:** none
- **Flag:** none
- **Files:** `RELEASE.md` (record the result); `.gitignore` (add `/artifacts/`); `app.json` only if the proof reads below 36

### Context
Play required target API 36 from 2026-08-31, which has already passed. `targetSdk` is pinned nowhere in the tracked repo:
- `app.json` has no `targetSdkVersion`;
- `android/` is generated and gitignored (`.gitignore:41`);
- `android/app/build.gradle:94` reads `rootProject.ext.targetSdkVersion`;
- the defaults are `node_modules/react-native/gradle/libs.versions.toml:4` (`targetSdk = "36"`) and `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle:69` (`safeExtGet("targetSdkVersion", 36)`).

That is config, INFERRED. Only a built artifact proves it (draft W7-08; skeptical-14 moves it to day one).

### Change
1. Run `df -h /`. Proceed only if at least 5 GB is free (about 4 GB per arm64 release build plus a 1 GB margin, **OWNER-PICKED STARTING VALUE**).
2. At `da93dcd` (or the current `next-level` HEAD, recorded), build a **non-perf** release:
   - `ARROWS_PERF_BUILD` and every `EXPO_PUBLIC_PERF_*` unset;
   - `npx expo prebuild --platform android --clean --no-install`;
   - delete the generated outputs listed at `scripts/perf/android/benchmark.mjs:415-421`;
   - `cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a`.
   If `df` still shows at least 3 GB (**OWNER-PICKED STARTING VALUE**; the bundle build's size is unmeasured), also run `./gradlew :app:bundleRelease -PreactNativeArchitectures=arm64-v8a`. The ABI filter does not affect the manifest.
3. Read the value:
   - `~/Library/Android/sdk/build-tools/36.0.0/aapt dump badging android/app/build/outputs/apk/release/app-release.apk | grep -E "sdkVersion|targetSdkVersion|versionCode"`
   - and, if built, `bundletool dump manifest --bundle android/app/build/outputs/bundle/release/app-release.aab --xpath /manifest/uses-sdk/@android:targetSdkVersion`.
4. Record in `RELEASE.md`: the commit sha, date, exact commands, the printed lines and the APK sha256. Copy the APK to `artifacts/base/da93dcd-release-arm64.apk` with its sha256 in `artifacts/base/da93dcd-release-arm64.apk.sha256`, and add `/artifacts/` to `.gitignore` in the same commit. P-01's over-install run, W0's pre-fix reproductions, W0-07's over-install and W7-02's permission diff all reuse it as the base build. Do **not** keep it only in a session scratchpad: later tasks run in other sessions, and a scratchpad does not survive (the no-dead-end script this plan relied on was lost that way; P-03 Context).
5. If the value is below 36, add `"targetSdkVersion": 36` to the `android` object of the existing `expo-build-properties` plugin entry in `app.json`, then rebuild and re-read.

### Non-goals
- Proving what EAS's cloud build produces (P-04b, owner-gated).
- Uploading anything.
- Changing `compileSdk` or `minSdk`.

### Acceptance criteria
- `aapt dump badging` output with `targetSdkVersion:'N'`, N ≥ 36, and the `bundletool` line if the bundle was built, both pasted into `RELEASE.md` with commit and sha256.
- The artifact is non-perf: `apkanalyzer manifest print <apk> | grep -c profileable` → 0 (a PERF build carries `<profileable>`, `benchmark.mjs:448-449`).

### Verification
1. **PRE-FIX REPRODUCTION:** not possible as a failure. The defect is the absence of proof. Record `grep -n targetSdk app.json` → 0 hits and the two INFERRED config lines above.
2. **Closing:** the `aapt` / `bundletool` reads. They read the compiled manifest of the artifact, which is the thing Play checks, not the gradle config that previously misled this project. The `profileable` check proves the proof was taken on a ship-shaped build.
3. **TDD:** not applicable (build config).
4. **UNVERIFIED** until P-04b: the EAS-built `.aab` that is actually uploaded. INFERRED to match, because EAS runs the same prebuild and `bundleRelease`.

### Risk and rollback
- **Disk exhaustion mid-build** (a 4-ABI build has filled this disk before). Mitigations: the `df` gate, arm64-only builds, and deleting `android/app/build` afterwards.
- **Rollback:** revert the `RELEASE.md` / `app.json` lines.

## P-04b — Link the EAS project and reconcile the remote versionCode

- **Status:** BLOCKED-ON-OWNER. The owner must, under their own Expo account:
  1. run `npx eas-cli login`;
  2. run `npx eas-cli project:info`, and only if it reports no project, `npx eas-cli init`, which writes `expo.extra.eas.projectId` into `app.json`;
  3. read `npx eas-cli build:version:get -p android --profile production` and decide how to set it, if needed, so the next production build gets a versionCode greater than 6 (`bb63913 release: versionCode 6`);
  4. say yes before any cloud build is queued, because a build consumes the owner's EAS quota.
- **Effort:** S
- **Depends on:** P-04a (so the local target-SDK proof exists before a cloud build is paid for)
- **Flag:** none
- **Files:** `app.json`, `RELEASE.md`

### Context
- `eas.json:3-4` sets `cli.appVersionSource: "remote"`, and the production profile sets `autoIncrement: true`.
- `app.json` has no `extra` block at all, confirmed by `npx expo config --type introspect`. So the remote version source has no project to read, and `app.json`'s `android.versionCode: 6` is inert under a remote source.
- `RELEASE.md:12` lists `eas init` as step 1, and it was never done.
- `eas-cli` is not installed; `npx` fetches it from npm.

W0-08 and W7-10 were the same step (skeptical-14); both are merged here.

### Change
Owner does steps 1–3 of the Status. Agent follow-up, READY once `app.json` carries the id:
- verify the id matches `project:info`;
- confirm with `npx eas-cli --help` that the commands used exist in the fetched version;
- record in `RELEASE.md` the projectId, the remote versionCode as the source of truth, and the fact that `app.json`'s `versionCode` is inert under `appVersionSource: remote`.

### Non-goals
- Running `eas init` with any account other than the owner's.
- Queuing a build or submit without an explicit yes.
- Guessing an id.

### Acceptance criteria
- `npx eas-cli project:info` prints an id equal to `app.json`'s `expo.extra.eas.projectId`, run from a clean checkout of the commit (no local stash) so a cached interactive link cannot supply it.
- `npx eas-cli build:version:get -p android --profile production --non-interactive` prints a versionCode, and `RELEASE.md` records the owner's decision if it was ≤ 6.
- After the owner's yes: `npx eas-cli build -p android --profile production --non-interactive` reaches the queued state without a prompt. `bundletool dump manifest` on the resulting `.aab` shows targetSdk ≥ 36 and versionCode > 6, and both lines are recorded. This closes P-04a's UNVERIFIED line.

### Verification
1. **PRE-FIX REPRODUCTION:** `npx expo config --type introspect --json` shows `extra: null` (observed 2026-09-16).
2. **Closing:** the three commands above. `--non-interactive` is the load-bearing flag: it distinguishes "configured" from "a human answered a prompt", which is exactly the failure.
3. **TDD:** not applicable.
4. **UNVERIFIED:** Play accepting the upload is a release step (W0-08), not this task.

### Risk and rollback
- **`eas init` against the wrong account forks the remote version counter.** Run `project:info` first.
- **Rollback:** remove the `extra` block (restores today's known-broken state). A remote versionCode change is owner-only.

## P-04c — Set `ios.supportsTablet` to false

- **Status:** READY. Absorbs W7-15 (CUT, integrator 2026-09-16). One owner check carried from W7-15 goes to the Owner queue: confirm no iOS build was ever submitted to App Store Connect with iPad support (Apple does not allow removing iPad support from an app that shipped with it).
- **Effort:** S
- **Depends on:** none
- **Flag:** none
- **Files:** `app.json`

### Context
- `app.json` sets `ios.supportsTablet: true`. An App Store submission would then require an iPad screenshot set for a layout that has never run on an iPad.
- No iOS build compiles today; the native board view has not been built since 2026-09-01.
- The introspected Info.plist declares iPad landscape orientations (`UISupportedInterfaceOrientations~ipad`) while `app.json` says `orientation: "portrait"`.
- The owner's plan decision 9 recommends false until an iPad build is scheduled, and the controller ruled false.

### Change
Set `"supportsTablet": false` in `app.json`'s `ios` object. Do not run `expo prebuild --platform ios`: `ios/` is generated and gitignored, and an iOS build is BLOCKED-ON-DISK.

### Non-goals
- Removing the `~ipad` orientation key. It is harmless for an iPhone-only device family (INFERRED) and would need a config plugin.
- Any iOS build.

### Acceptance criteria
`node -e "const {getConfig}=require('@expo/config'); const {IOSConfig}=require('@expo/config-plugins'); const D=IOSConfig.DeviceFamily; console.log(D.formatDeviceFamilies(D.getDeviceFamilies(getConfig('.',{skipSDKVersionRequirement:true}).exp)))"` prints `"1"`.

### Verification
1. **PRE-FIX REPRODUCTION:** the same command prints `"1,2"` on `da93dcd`, observed while writing this file. `ios/Arrows.xcodeproj/project.pbxproj:388,419` read `TARGETED_DEVICE_FAMILY = "1,2"`.
2. **Closing:** the command evaluates Expo's own device-family mod, the code that writes `TARGETED_DEVICE_FAMILY` at prebuild (`node_modules/@expo/config-plugins/build/ios/DeviceFamily.js:67-84`). So it exercises the value the next prebuild will emit, without regenerating `ios/`.
3. **TDD:** not applicable.
4. **UNVERIFIED** (BLOCKED-ON-DISK): the regenerated `project.pbxproj` and a built `.app`'s `UIDeviceFamily`.

### Risk and rollback
- No iOS build has ever shipped, so there is no existing iPad install base to strand.
- **Rollback:** set it back to true.

---

## P-05 — CI: run jest and tsc on every push to `next-level`

- **Status:** READY. Authoring and local replication are agent work. The workflow only runs once `next-level` is pushed, and **pushing requires the owner's explicit yes** (owner ruling 2).
- **Effort:** S
- **Depends on:** none. Best landed after P-01 so the first CI run covers the new tests, but not blocked on it.
- **Flag:** none
- **Files:** `.github/workflows/ci.yml` (new)

### Context
- There is no `.github` directory, so there is no CI at all.
- `npx jest` (11 suites / 61 tests at `da93dcd`, node env, `jest.config.js` matching `**/src/**/__tests__/**/*.test.ts`) and `npx tsc --noEmit` have only ever run on this Mac.
- The plan adds at least eight more suites, so every "tests pass" claim is a local claim (skeptical-14 missing work).
- The remote is `git@github.com:danteberishaj/arrows-game.git`.
- Local Node is `v20.19.4`. `package.json` declares `packageManager: npm@11.16.0` and a `postinstall: patch-package` step, with `patches/` present.

### Change
Add `.github/workflows/ci.yml`:
- trigger `on: push: branches: [next-level]`, plus `workflow_dispatch`;
- `permissions: contents: read`;
- `concurrency` keyed on the ref, with `cancel-in-progress: true`;
- one `ubuntu-latest` job with `timeout-minutes: 15` (**OWNER-PICKED STARTING VALUE**), running:
  1. checkout;
  2. setup-node with `node-version: 20.19.4` and npm cache (pin both actions to their current major, checked on github.com at authoring time);
  3. `npm ci`;
  4. `npx tsc --noEmit`;
  5. `npx jest --ci`.

### Non-goals
- `node --test scripts/perf/android/*.test.mjs` (16 harness tests). It is a one-line addition if the owner wants it; not in this brief.
- Native builds, emulator runs, lint, deploy.
- Branch protection, or triggering on `main`.
- Pushing.

### Acceptance criteria
1. **Local replica.** `git clone --branch next-level <repo path> <scratch dir>/ci-replica`, then in it `npm ci && npx tsc --noEmit && npx jest --ci`, all exit 0.
   - Record `df -h /` before and after.
   - Record the suite and test counts, which equal the working copy's.
   - This proves a clean checkout, with only lockfile dependencies and `patch-package`, passes; not just this machine's warm `node_modules`.
2. **The failure path works.** In the replica only, make one assertion false. `npx jest --ci` exits non-zero. Revert it.
3. The YAML parses. If `actionlint` is available (it is not installed today, and installing it needs the owner's approval), run it. Otherwise parse the file with Node and check that the `on.push.branches` value equals `["next-level"]`.
4. **After the owner's yes to push.** `gh run list --branch next-level --workflow ci.yml` shows the run for the pushed sha as `completed / success`, and the run URL is recorded in the commit's follow-up note.

### Verification
1. **PRE-FIX REPRODUCTION:** `ls .github` → "No such file or directory" (observed 2026-09-16). No run can exist.
2. **Closing:** Acceptance 1 and 2 exercise the exact commands the workflow runs on a clean clone, including the failing direction. Acceptance 4 is the only proof that GitHub runs it.
3. **TDD:** not applicable; Acceptance 2 is the negative control.
4. **UNVERIFIED** until the owner's push: GitHub-hosted runner behaviour (its Node download, `sharp`'s prebuilt binary download, `patch-package` on Linux). `gh` is logged in as `gentritr1` and the remote is under `danteberishaj`; whether that account can see Actions for the repo is unknown.

### Risk and rollback
- **Low.** CI observes and changes nothing in the app.
- **Linux-only failures** (case-sensitive imports, `sharp` binaries) may surface on the first run. That is a finding, not a regression.
- **Rollback:** delete the workflow file.

---

## CUT and excluded (nothing silently disappears)

- **`arrows_consent_resolved`, `arrows_consent_personalised`, `arrows_consent_ccpa` (draft W7-01).** Replaced by the integrator (2026-09-16) with W7-01's single packed `arrows_consent` (row 21).

- **`arrows_notif_optin`, `arrows_notif_hour` (draft 2 W4-01) and `arrows_notify_state`, `arrows_notify_hour`, `arrows_notify_asked_day` (draft 1 W4-01).** CUT: owner ruling 4 rejects the evening notification and everything that exists only to support it.
- **`arrows_ad_last_impression` (W7-11).** CUT: owner ruling 3 rejects the wall-clock cooldown. The session cap and new-player grace needed no keys and are cut with it.
- **`arrows_ad_games_finished` (W7-11 name).** Replaced by `arrows_finished_games`, the name W0-06 used and W0-05 expects.
- **`arrows_gen_version` and the byte-identical `src/core/generation/v1/` fork (draft 2 W3-01).** CUT: skeptical-14 REWORK on W3-01. Keep one persisted switch level plus a monotone floor; no forked modules, no version argument.
- **`arrows_gen_epoch` (draft 1 W3-05).** Superseded by `arrows_gen_switch_level`: same purpose, with a sentinel so a stamped 0 is distinguishable from "never stamped".
- **`arrows_daily_streak`, `arrows_daily_best` (draft 2) and `arrows_daily_best_streak`, `arrows_daily_total` (draft 1).** CUT: `W4.md` W4-16 cuts the separate daily streak (brand-13).
- **`arrows_daily_day`, `arrows_streak_shields` (draft 2) and `arrows_streak_freeze_day`, `arrows_shapes_seen` (draft 1).** Renamed to `W4.md`'s `arrows_daily_last_day`, `arrows_streak_freezes`, `arrows_streak_saved_day`, and the two 30-bit `arrows_shapes_seen_lo` / `_hi` keys (W4-21).
- **A boot-time collection backfill inside the migration (draft 2 W4-07).** CUT from P-01: `W4.md` W4-07 replaces it with an incremental fold on `arrows_shapes_through_level`, keeping derived work off the migration path.
- **FTUE classification inside the migration (`migrateFtueStage`, W1-03 draft).** CUT from P-01: `W1.md` W1-03 classifies at route time and never writes.
- **`SaveSystem.useClock` / `today()` in the schema step (draft 2 W4-01).** Moved to `W4.md` W4-02, which is its only consumer group.
- **`arrows_tel_install_id`, `arrows_tel_queue`, `arrows_tel_seq`, `arrows_tel_schema`, and a telemetry meaning for `arrows_schema_version` (draft W6-03).** Excluded from P-01 as strings. (Integrator 2026-09-16: consolidated `W6.md` replaced them with int keys, which are registered as rows 24–29; the queue is in memory and has no key.) The store stays int-only (controller ruling), and `arrows_schema_version` belongs to the save system alone (brand-13). If telemetry persistence is ever built, it lives in its own namespace with its own key-list test. Nothing is sent without consent (controller ruling on analytics).
- **The remote-config cache under an AsyncStorage key (draft W6-08).** Excluded from P-01 as a string. (Integrator 2026-09-16: consolidated W6-02 stores only two ints, rows 22–23.)
- **`scripts/perf/android/capture-motion.mjs` (draft 2 W2-01) and `scripts/art/capture-device.mjs` (draft 2 W5-01).** CUT as separate harnesses (controller ruling). Their requirements are merged into P-02 Stage C.
- **`PERF_FULL_MOTION` build flag (draft 1 W2-02).** CUT: a second mechanism that overrides the system setting. P-02 uses the real setting, read back.
- **"At least three consecutive frames" and other frame-count thresholds (draft 2 W2-01 acceptance).** CUT (skeptical-14, evidence-15): no threshold is allowed before P-02's measured recorder period exists.
- **"Scale-1 passes / scale-0 fails is the whole verification" (draft W6-13).** Reworked into P-02's per-phase validation, including the exit moved-check (performance-16).
- **Draft W6-14 iOS capture path.** Not merged into P-02's Android stages. (Integrator 2026-09-16: after W8 and W6 both re-specified it as W8-02/W8-04 and W6-17, it was moved here as P-02b/P-02c; W8-02, W8-04 and W6-17 are CUT stubs.)
- **Draft 1 W5-11 (implement a 0.12-cell fillet) and the six-PNG review in draft 2 W5-11.** The doc half is applied in P-03 per brand-13's replacement. Any future implementation is a W5 question.
- **W0-08 (draft) "reconcile extra.eas.projectId".** Merged into P-04b, as a duplicate of W7-10 (skeptical-14).

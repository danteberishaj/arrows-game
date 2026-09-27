# SAVE-GUARD — a failed save load never writes defaults over the real progress

- **Status:** DONE (commit `05ac4c5`, 2026-09-25). This report was written after the fact by FINAL-FIX (FINAL-REVIEW
  finding 13: the commit shipped without one). Nothing in the code changed for it.
- **Kind:** a defect fix, no flag. Nothing visible changes in a healthy session.
- **Files:** `src/ui/storage.ts` (+11 / −1), `src/ui/__tests__/storage.test.ts` (+33 / −1).
- **Labels:** **EXECUTED** (run, output seen), **INFERRED** (read, not run), **UNVERIFIED-DEVICE**.

## What

`HydratedIntStore` (`src/ui/storage.ts`) reads every registered `arrows_*` key once at boot (`hydrate()`, one
`AsyncStorage.multiGet`) and then serves reads from memory and writes through to AsyncStorage. SAVE-GUARD adds one
private flag, `writeThrough`:

- `hydrate()` sets it to `false` when the native read throws (the `catch` branch).
- `enqueue()` returns at once while it is `false`, so `setInt` / `deleteKey` still update the in-memory cache but
  never reach AsyncStorage.
- Nothing sets it back to `true`. The next launch builds a new store, which reads the disk normally.

## Why

Found by the W4-07 implementer. When the boot read throws (a transient AsyncStorage error, or no storage at all, e.g.
private browsing on web), `initSaveSystem()` marks persistence unhealthy and the session plays on in-memory defaults:
level 0, no streaks, default settings. Before this fix every write in that session still went to disk. The first
clear on the default level 0 stored `arrows_current_level = 1` over the player's real level (37 in the test), and
setting toggles overwrote the real settings the same way. P-01's `persistenceHealthy` already stopped the DERIVED
writes (the generator stamp, the collection fold, the review bookkeeping), but not the ordinary progress and settings
writes, which go through `setInt` directly.

## Evidence

- **EXECUTED (FINAL-FIX, 2026-09-27), pre-fix failure reproduced:** with `src/ui/storage.ts` at `05ac4c5^` (the file
  is unchanged from `05ac4c5` to `a19c33f`), `npx jest src/ui/__tests__/storage.test.ts -t "SAVE-GUARD|failed
  hydrate leaves the collection"` fails 2 tests: "SAVE-GUARD: after a failed hydrate, play in that session never
  writes over the saved progress on disk" (`multiSet` called once, expected 0) and "a failed hydrate leaves the
  collection on disk untouched" (`arrows_current_level` written). Output:
  `artifacts/FINAL-FIX/evidence/01-saveguard-prefix-RED.txt`. The working-tree file was restored and checked
  byte-equal to `a19c33f` afterwards.
- **EXECUTED, fixed:** the same command at `a19c33f` passes all 4 matching tests
  (`artifacts/FINAL-FIX/evidence/01-saveguard-GREEN.txt`).
- **Why the test exercises the original failure:** it seeds a Map-backed AsyncStorage with a level-37 save
  (`LEGACY_SEED`), makes `multiGet` reject, runs the real `initSaveSystem()`, then does what a player does on the
  default level (a clear: `setCurrentLevel(1)` + `registerSolve(true)`, and a setting toggle). It asserts that no
  `multiSet` or `multiRemove` reached the store and that the disk still equals the seed. Then it restores `multiGet`,
  cold-starts a new store over the same disk, and checks every legacy getter against the seed (level 37 is back).
- **UNVERIFIED-DEVICE:** no device run. A real failed `multiGet` was never produced on the emulator or a phone. The
  fix is covered by jest over the real `HydratedIntStore` and `initSaveSystem()` with a mocked AsyncStorage module.

## Wipe risk and migration

- **No schema change.** No key is added, renamed or removed; `SCHEMA_VERSION`, `migrate()`, `PersistenceKeys` and the
  exact-array assertion in `storage.test.ts` are untouched.
- **Wipe risk: reduced, not added.** The change only removes a write path: it removes the one path by which a failed
  boot read could overwrite a real save with defaults. A healthy session (hydrate succeeded) behaves exactly as before.
- **Known, by-design cost.** After a failed hydrate, nothing from that session is saved: its progress, its settings
  toggles, the consent answer and the telemetry identity are all memory-only and are lost when the app closes. The next
  launch reads the untouched save. This is the intended trade: losing one degraded session is better than overwriting
  a real save with defaults.

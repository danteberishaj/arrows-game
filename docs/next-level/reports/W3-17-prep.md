# W3-17 prep: the first-time-player playtest kit

- **Base:** `c2b64ce` on `next-level`. HEAD did not move.
- **Git:** nothing committed or pushed. No EAS.
- **Status:** the agent preparation is DONE. The sessions themselves are BLOCKED-ON-OWNER: recruit about 5 first-time
  players, fill in the OWNER-PICKED pass rule, then run the sessions.
- **Evidence:** `artifacts/W3-17/` (gitignored).

## What was built

| Deliverable | Path |
|---|---|
| Playtest doc (template, DRAFT, no results) | `docs/curve-playtest-2026-10-06.md` |
| Log → tables parser | `scripts/analysis/ftue-playtest-tables.mjs` (next to `ftue-board-metrics.ts`) |
| Parser tests (`node --test`, the style of `scripts/perf/android/*.test.mjs`) | `scripts/analysis/ftue-playtest-tables.test.mjs` |
| Test fixtures: the two unedited dry-run captures | `scripts/analysis/fixtures/ftue-playtest/DRY1-1-V2.txt`, `DRY1-2-V1.txt` |
| APKs + sha256 for the owner | `~/Desktop/Arrows-playtest-2026-10-06/` |
| Build, proof and dry-run scripts, plus logs | `artifacts/W3-17/build/`, `artifacts/W3-17/dry-run/` |

The parser is not part of jest. The jest config only collects `src/**/__tests__`, and the device-log parsers in
`scripts/perf/android/` use `node --test`. Run its tests with:

```sh
node --test scripts/analysis/ftue-playtest-tables.test.mjs
```

## W1 flags and the other switches in both APKs

Every W1 flag is an `EXPO_PUBLIC_*` environment variable, read in `src/ui/ftueConfig.ts`. The exception is the
stall-hint delay, which is a source constant. `GEN_V2_ENABLED` is a source constant in `src/core/generatorVersion.ts`.

| Switch | Kind | V2 | V1 | Effect |
|---|---|---|---|---|
| `FTUE_ENABLED` | `EXPO_PUBLIC_FTUE=1` | ON | ON | W1-04/05: first Play goes to T1 and then T2; T2's first blocked tap is free, with the rule line. |
| `FTUE_ASSIST_ENABLED` | `EXPO_PUBLIC_FTUE_ASSIST=1` | ON | ON | W1-06: blocked taps before a real board's first removal are free, until the first perfect clear. |
| `FTUE_STALL_HINT_ENABLED` | `EXPO_PUBLIC_FTUE_STALL_HINT=1` | ON | ON | **Inert.** See RULING 2. |
| `FTUE_STALL_HINT_MS` | source constant | `null` | `null` | Unchanged. No delay has been picked (W1-11). |
| W1-08 `[ftue]` log | `EXPO_PUBLIC_FTUE_LOG=1` | ON | ON | The playtest instrument. |
| Test ads | `EXPO_PUBLIC_ADMOB_TEST_ADS=1` | ON | ON | Google sample units only. |
| `GEN_V2_ENABLED` | source constant | **true** (throwaway edit) | false | Generator v2 for a fresh install. |
| Every `META_*` (incl. skin picker, reward path, book, seasons, petal ads), `ART_*`, `CAPTURE_DIAG`, `PERF_*`, `DEV_*` | env | unset | unset | As in today's player build. |

Each build's environment is recorded in `artifacts/W3-17/build/V*/env.txt`, and the flags file is
`build/flags-playtest.env`.

The dry run confirmed every ON flag at runtime except the inert stall hint:
- `board_mount T1` and `T2` are the tutorial;
- `blocked false grace` is T2's free tap;
- `blocked false assist` on L1 and L2 is the assist;
- `gen=2` with Diamond 24 is V2, and `gen=1` with Circle 60 is V1.

## Builds

**Commands.** `artifacts/W3-17/build/chain.sh` was run under `nohup`. It calls `build-one.sh V1`, applies the edit,
then calls `build-one.sh V2`. `build-one.sh` runs:
- `build-apk.sh`: a copy of `artifacts/W3-15/build-apk.sh`. Its only change is both owner-phone ABIs
  (`armeabi-v7a,arm64-v8a`, as in the owner APKs built by `artifacts/ART-SKINS-08/release/build-apk12/14.sh`).
- `prove-w317.py`;
- `apksigner`.

`build-apk.sh` refuses to build:
- under 5 GB free;
- with another Gradle process running;
- with any diagnostic class in the product module;
- with a profileable manifest.

It also:
- unsets every inherited `EXPO_PUBLIC_*` variable and exports only the flags file;
- deletes `$TMPDIR/metro-*` and `haste-map-*`;
- runs `:app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease`, so the JS bundle is rebuilt for each
  environment;
- passes `--no-daemon '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g'`;
- uses Node v20.19.4.

The builds ran one at a time. `df -h /` showed 21 Gi free before V1 and 20 Gi before V2. V1's Gradle run took
2 min 36 s.

**Throwaway edit and restore (EXECUTED).** `chain.sh` checks `cmp` and an empty `git diff` on
`src/core/generatorVersion.ts` before it starts. It sets `trap restore EXIT`, and turns INT, TERM and HUP into an
exit. The edit is in `build/V2-throwaway.patch`:

```
-export const GEN_V2_ENABLED = false;
+export const GEN_V2_ENABLED = true; // W3-17 THROWAWAY PLAYTEST-BUILD EDIT: revert before anything else
```

`chain.log` printed `RESTORED generatorVersion.ts (cmp equal, git diff empty)` and `CHAIN OK`. Afterwards,
`cmp artifacts/W3-17/build/generatorVersion.ts.orig src/core/generatorVersion.ts` and
`git diff --quiet -- src/core/generatorVersion.ts` both passed.

| File on the Desktop | Bytes | sha256 |
|---|---|---|
| `arrows-playtest-V2-c2b64ce.apk` | 65,074,076 | `a55fcfb2625b32a783602b15eba0d08771c2bf754db89560bcf6f19e922e7522` |
| `arrows-playtest-V1-c2b64ce.apk` | 65,074,076 | `43ec2ae81b0b131c81fc86b58ae99de91e75863f169fc8d65b3ce760593caf08` |

The Desktop copies are `cmp`-identical to `artifacts/W3-17/build/V{1,2}/app.apk`. The bundles differ (sha
`add9695d…` and `32d47292…`), as the one changed constant predicts.

**APK proofs (EXECUTED, `build/V*/proof.txt`).** Both APKs passed every check below:

| Check | Result |
|---|---|
| Hermes bundle | yes |
| `3940256099942544` (Google test publisher), [UTF-8, UTF-16LE] | [9, 0] |
| Owner ad units `6706292920`, `7549521178`, `3505414519`, `5508761320`, `5754923896` | [0, 0] each |
| Owner's live LevelPlay key `27012eed5` / LevelPlay sample key `85460dcd` | [0, 0] / [0, 0] |
| `Lcom/ironsource/`, `Lcom/unity3d/`, `levelplay`/`LevelPlay`/`ironsource`/`IronSource` in dex | 0 each |
| Positive control for that dex search: `Lcom/google/android/gms/ads/` | 76 |
| The same LevelPlay strings in the bundle | [0, 0] |
| Diagnostic classes in dex | 0 of 11 |
| Instrumentation / profileable in the manifest | 0 / 0 |
| `board_mount` / `[ftue]` in the bundle | [1, 0] / [6, 0] |
| ABIs | `arm64-v8a`, `armeabi-v7a` |

**Signing (EXECUTED, `build/V*/apksigner.txt`).** Both APKs are signed `CN=Arrows`, certificate SHA-256
`24f7fa0b78b9c5cf3c81a1fec82198858599cb874e43ad6b17c9873f6c7a50f8`. That is the same upload-key certificate as the
W1-10, W3-15 and W3-21 owner/test APKs: the project's Gradle release signing with the upload key in `credentials/`.
`versionCode` is 6.

## Parser

**Input.** The real format from `src/ui/ftueSessionLog.ts`, as `adb logcat -v time -s ReactNativeJS:I` prints it:

```
10-06 12:09:26.825 I/ReactNativeJS( 6823): [ftue] board_mount 0 0 gen=2 arrows=24 shape=Diamond
```

It also accepts the `-v threadtime` form and bare `[ftue]` lines. It ignores every other line. Each file is one
session, named `<participant>-<order 1|2>-<V1|V2>.txt`.

**Output.** Markdown tables:
- per attempt;
- summaries of n, median and max, for all sessions and for first sessions only;
- pass-rule inputs and the too-easy signal;
- a W1-09 section (T2 blocked taps after the lesson line);
- checks;
- the raw `[ftue]` lines.

**Exit codes.**
- **0:** the tables were written.
- **1, malformed, nothing written.** Any of:
  - a bad `[ftue]` line or prefix;
  - no `[ftue]` lines at all;
  - a first event that is not a `board_mount`;
  - a `board_mount` with t ≠ 0;
  - t going backwards within a board;
  - an event from a different process ID than its board's mount;
  - events after a clear, or after a restart and before the re-deal;
  - a bad file name, a duplicate session, a session 2 without a session 1, or the same build twice.
- **2:** usage.
- **3, integrity failure, tables still written.** Any of:
  - a removal count that does not reconcile with `arrowCount`;
  - a clear line's hearts that do not match the heart model;
  - a campaign board's `gen=` that contradicts the build in the file name;
  - a restart while hearts remain;
  - a restart not followed by the same board;
  - assist or grace where the code cannot produce it.

**Derived columns.** All are derived from the existing lines only; no product logging was added.
- **taps** = removals + blocked.
- **hearts lost** = `blocked true` lines.
- **Starting hearts** = 3. Every difficulty config and both tutorial boards set `hearts: 3`. Each clear line checks
  the model.
- **outcome** comes from the event order: clear; loss followed by Retry, a tutorial re-deal, leaving, or the end of
  the log; or leaving without a loss.
- **A rewarded continue** (`onContinueWithAd` sets hearts to 1, and logs nothing) is inferred when a tap follows a
  loss on the same board.
- **Time to clear** is the clear line's t. **First removal** is the first removal's t.

**Columns it cannot fill:**
- taps on empty cells, pans and pinches;
- 💡 hint use;
- ads shown (interstitial, rewarded);
- time between boards (menus, panels, ads) and total session time;
- starting hearts as a logged value (it is a constant, checked at each clear);
- the build from a tutorial line (tutorials always print `gen=1`), so the build comes from the file name and is
  cross-checked on campaign boards;
- whether a continue happened, which is inferred, not observed.

**Tests (EXECUTED).** `node --test`: **11/11 pass** (`artifacts/W3-17/tdd/green-final.txt`).
- The fixtures are the unedited dry-run captures. The negative cases edit those real lines in memory.
- The cases cover:
  - every number of the V2 and V1 runs;
  - the rendered rows, summary and pass-rule lines;
  - the too-easy signal firing;
  - the median rule;
  - the threadtime and bare formats;
  - 10 malformed inputs;
  - 4 integrity failures;
  - an inferred continue;
  - session-name rules;
  - CLI exit codes 0, 1, 2 and 3.
- Process note: the tests were written after the parser, not test-first. Their teeth were checked by mutation
  instead (`artifacts/W3-17/tdd/mutations.txt`). The parser was copied and restored, and `cmp` confirmed the
  restore.
  - Reconciliation check disabled: 2 tests fail.
  - `START_HEARTS = 4`: 7 tests fail.
  - Continue inference disabled: 1 test fails.

## Emulator dry run (EXECUTED, emulator-5556 `fleet_floor_api31`, API 31, only)

The emulator was already running; it was not booted or killed. No other emulator or process was touched.

1. **Backup** (`dry-run/backup.sh`, `device/before/`):
   - the installed APK was pulled, and its sha `c2967710…f340` equals the device's `base.apk` (also W3-21's
     original);
   - `su 0 tar` of `/data/data/com.danteb.arrows` with the app force-stopped: sha `d9c9d46d…a466`, the device and
     local copies equal;
   - `ls -laRn` listing, animation and auto-time settings, `wm size` and `density`.
2. **V2:**
   - `dry-run/install.sh` ran the proof, then `install -r -d`, then checked the installed sha equals the APK
     (`a55fcfb2…`), then `pm clear`.
   - Then `dry-run/drive.mjs` captured with the owner's exact command (`logcat -v time -s ReactNativeJS:I`) and ran
     cold start → menu → Play → T1, T2, L1, L2.
   - Each tap is a computed cell centre, and each tap waits for its own new `[ftue]` line, so a dropped line would
     abort the run.
   - Deliberate blocked taps: T2 ×2 (grace, then charged); L1 ×2 (assist, then charged); L2 ×3 (assist, charged, and
     a repeat on the same arrow).
3. **V1:** the same, with T1, T2, then L1 lost on purpose (one removal, then 3 charged blocked taps), the lose panel,
   **Retry**, and L1 cleared with no heart lost.
4. **No ad appeared**, so BACK was never needed and nothing was tapped on an ad. A first attempt failed before
   Play: uiautomator cannot dump the forever-animating menu, and a no-match `grep` exits 1. Its screenshot is kept
   in `device/V2-run1-failed/`. The data was `pm clear`ed before the real run.
5. **Restore** (`dry-run/restore.sh`, `device/after-restore/`):
   - the original APK was reinstalled with `install -r -d`, and the installed sha is again `c2967710…f340`;
   - the app data was replaced from the tar as root, and `restorecon -RF` was run;
   - **the re-tar sha is `d9c9d46d…a466`, equal to the backup**;
   - the `ls -laRn` listing is identical (`cmp`), and the settings and `wm` are identical;
   - it printed "RESTORE OK".
   - The only difference: `lastUpdateTime` is now 12:14:44, because the reinstall sets it. Uninstall was never used.
   - The device temp tars were deleted.

### Parser output vs screen

The full output is `artifacts/W3-17/dry-run/parser-output.md`.

| Session · board | Parser | Screen (`device/V*-run1/`) | Match |
|---|---|---|---|
| V2 · T1 | 6/6 removals, 0 hearts lost, cleared | tutorial header, 3 hearts | yes |
| V2 · T2 | 7 taps, blocked 2 (1 charged, 1 grace), 2 hearts left (`clear 2`) | after 2nd blocked: rule line "Blocked. Clear what's in its way." and 2 of 3 hearts (`06-…`) | yes |
| V2 · L1 | Diamond 24, 24/24, blocked 2 (1 charged, 1 assist), cleared 28.4 s with 2 hearts | header "Normal · Diamond · 1 left" with 2 of 3 hearts (`11-…`); win panel **"Level 1 · Diamond · 24 arrows"**, 2 strong stars + 1 faint (`12-…`) | yes |
| V2 · L2 | Teacup 23, 23/23, blocked 3 (1 charged, 1 assist, 1 repeat), cleared 27.9 s with 2 hearts | 2 of 3 hearts (`17-…`); win panel **"Level 2 · Teacup · 23 arrows"**, 2 strong stars (`18-…`) | yes |
| V1 · L1 attempt 1 | Circle 60, 1/60 removals, 3 charged, "lost all hearts → Retry" | "59 left" with 1 of 3 hearts after 2 charged (`09-…`); "Out of hearts" panel with Retry (`12-…`) | yes |
| V1 · L1 attempt 2 | 60/60, 1 assist, 0 hearts lost, cleared 62.6 s | 3 of 3 hearts at "1 left" (`15-…`); win panel **"Level 1 · Circle · 60 arrows"**, 3 stars (`16-…`) | yes |

The heart pips and stars were read by eye from the screenshots; the arrow counts come from the UI dump text.

Removal reconciliation was exact on every cleared board: 6, 5, 24, 23, 6, 5 and 60. There were 0 integrity
failures, 0 warnings and 158 `[ftue]` lines.

The fixtures' "first removal" and "time to clear" values are emulator driver timings, not human ones.

## RULINGs (smallest safe choices, made without the controller)

1. **"Meta flags OFF, as in the player build":** I read the player build as today's store default, which has every
   flag off. So **every** `META_*` and `ART_*` flag is unset, not only the five named. The Play internal-testing
   AABs (vc13–15) turn every META flag on. If the owner wants the playtest to match that build instead, it needs a
   rebuild.
2. **Stall hint:** `EXPO_PUBLIC_FTUE_STALL_HINT=1` is set, because the brief says the W1 flags are ON. It is inert,
   because `FTUE_STALL_HINT_MS` is the committed `null`. No delay was invented. W1-10's 4000 ms was capture-only.
   A delay would need a second throwaway edit and an owner-picked value.
3. **`EXPO_PUBLIC_CAPTURE_DIAG` is not set**, unlike W3-21. It adds diagnostic labels that a player build does not
   have, and the dry-run driver did not need them.
4. **LevelPlay key.** LevelPlay is no longer in the app: AdMob only, per `docs/data-safety.md`. So "the LevelPlay
   key is the sample one" became "neither key is present". The proof checks both keys at [0, 0] in both encodings,
   plus zero LevelPlay, ironSource and Unity classes, with a positive control. The manifest still carries the
   owner's AdMob **app** ID (`ca-app-pub-9813131856455133~9332456261`). That is required for SDK init, is not an ad
   unit, and was accepted by every earlier test-ads proof.
5. **Both ABIs** (`armeabi-v7a,arm64-v8a`), not the W3-15 script's arm64-only. The owner's phone is unknown, and
   the earlier owner APKs carried both.
6. **APK names** use HEAD `c2b64ce`. V2's contents are `c2b64ce` plus the one-line throwaway edit, which the doc
   and this report state.
7. **Pass rule with V2 only.** There is then one board size, so "largest board" reduces to "V2's level 1 passes if
   at least 4 of 5 first sessions clear it without losing all hearts" (doc section e). "Without losing all hearts"
   is read as: level 1 cleared and the lose panel never appeared on level 1.
8. **The stop rule** is "about 10 minutes or the level 5 win panel, whichever first". The too-easy signal counts all
   blocked taps on levels 1–5, free (assisted) taps included.
9. **Session file naming** (`P1-1-V2.txt`) carries the order, so first sessions (true first-time play) are
   summarised separately from second sessions.

## UNVERIFIED

- **UNVERIFIED-DEVICE.**
  - Everything on a real phone: install on the owner's phone (model, ABI, Android version unknown), touch input,
    and first-time humans.
  - The dry run used `adb input tap` on the emulator.
- **Install over a Play copy.** The version-code downgrade is certain (6 < 15). The signing mismatch is inferred
  (Play app signing), not checked.
- **The no-laptop fallback's late log dump** (16M buffer, `logcat -d` afterwards) was not tried. The doc says so.
- **The stall hint** is inert by code reading (`FTUE_STALL_HINT_MS = null`), not by observation. No `stall_hint`
  line appeared in the dry run, which is expected but not a proof.
- **A test interstitial or rewarded ad in the middle of a session** was not exercised. No ad came up: one finished
  game in V2 before Next, and no Next in V1. The parser ignores non-`[ftue]` lines, so an ad cannot break it, but
  that is an inference.
- **A rewarded continue** is covered only by an edited fixture (real lines re-timed), not a real capture. Device
  policy forbids tapping an ad.

## Gates

| Check | Result | Log |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | `artifacts/W3-17/logs/tsc-final.txt` |
| `npx jest` (re-run) | **138 suites / 2,359 tests, 12 snapshots, all passed** (= baseline; the parser's tests are `node --test`, not jest) | `artifacts/W3-17/logs/jest-final.txt` |
| `node --test scripts/analysis/ftue-playtest-tables.test.mjs` | 11/11 | `artifacts/W3-17/tdd/green-final.txt` |
| Product module `modules/arrows-board/.../board/` | 6 files | — |

The first full jest run had 1 failure out of 2,359: `adsPetalsPlacement.test.ts` › "a second show while the first
is on screen…" hit its **5000 ms timeout**.
- The host load average was 85 at the time, and the run took 263 s.
- No `src/` file changed, and that suite passed alone (9/9, 3.9 s).
- That run is kept as `logs/jest-run1-timeout.txt`. The full re-run (load average 75) passed 138/2,359.

## Outside scope / notes

- `docs/engineering-lessons.md`: the other session's uncommitted top edit is byte-identical. `cmp` of the first
  N bytes against the copy taken at the start passed. One entry was appended at the end.
- No product file changed. The only product-file touch was the trap-restored `GEN_V2_ENABLED` edit.

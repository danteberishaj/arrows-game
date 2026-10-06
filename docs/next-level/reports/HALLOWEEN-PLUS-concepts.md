# HALLOWEEN-PLUS: three new Halloween concept skins (Mummy, Potion Slime, Little Bat)

2026-10-06/07. **Concept only, owner pick pending. Nothing is registered**: no catalogue, book, price, picker, save or
native change. Worktree branch `worktree-agent-aab8b35454d2def7e`, cut at next-level `d7f8f62`. Not pushed, not merged,
no PR, no EAS. Node v20.19.4. Only `emulator-5556 / fleet_floor_api31` was used.

**Owner sheet:** `artifacts/HALLOWEEN-PLUS/owner-sheet.png`. Detail sheets are in `artifacts/HALLOWEEN-PLUS/screens/`:
`sheet-mummy.png`, `sheet-potion-slime.png` and `sheet-little-bat.png` show every variant on 3 boards x 2 themes beside
the pack; `sheet-pack-dense.png` shows the dense board for all ten specs; `sheet-native.png` shows the native-Canvas
fixture with long, bent and one-cell arrows. The input hashes are in `sheet-manifest.json`.

## What was built

| File | Purpose |
| --- | --- |
| `src/ui/skinCandidates.ts` | Seven candidate SkinSpecs (Mummy A/B, Potion Slime A/B/C, Little Bat A/B). No app module imports it. A test proves this, with a positive control. |
| `src/ui/skinSpecs.ts` | Only adds `export` to `canvasSpec`, `HALLOWEEN_BOARD`, `polishedHead` and `particles`. The registry and JSON are unchanged. |
| `src/ui/__tests__/halloweenPlusCandidates.test.ts` | 40 tests: not wired (registry, picker styles, reward catalogue, imports); existing fields only; the TS side of the contract; K4 numbers; the halo note; the fang geometry. |
| `scripts/art/skin-contract-data.cjs`, `run-skin-contract.mjs` | `ART_SKINS_CANDIDATES=1` adds the candidates to the native fixture data only, plus a `candidates` list. |
| `scripts/art/skin-contract/SkinHalloweenContract.kt` | Lets a listed candidate use a 01b field (`seam.cap`). Registered specs other than Pumpkin still may not. |
| `scripts/art/skin-contract/SkinPolishContract.kt` | New general check: a head face's blush ovals stay inside the filled head with .03 clearance. It is gated for candidates and report-only for registered specs, with a displaced-blush negative control. |
| `scripts/art/halloween-plus/` | POSIX-sh builds with DONE/FAILED markers; the APK proof; device backup, restore and cleanup; the capture driver; the frame pickers; contrast; the contract summary; the owner sheets. |

## The candidates (fields used, faithfulness to the brief)

All seven share the pack's recipe: `.48` rim / `.425` body, the rounded `.44` head with `.10` fillets, `tail: none` and
`oneCell: none`, the LOD and motion from Sherbet, and the board tints `#F3EEFA` (light) and `#221A36` (dark). The dark
tint holds: every required row passes on it. The proposed ids 21, 22 and 23 are not claimed.

| Variant | Layers (in draw order) | Face | Slots + mark | Faithful to the brief? |
| --- | --- | --- | ---: | --- |
| **Mummy A** | rim `#857563`, body `#F2EBDC`, `seam` wraps `#D5C7AE` width .36, dash [.03,.17], `cap:'butt'` | dot eyes `#3B2F33` r .042, mouth .07, peach blush `#EDBDAE` | 6 | Yes. Off-white bandage with a wrap line every .20 cell. The wraps run to the head centre, so the eyes peek out between bandage lines. The wraps are perpendicular bars, not diagonal (see RULING 3). |
| **Mummy B** | as A, wraps `.36 / [.035,.315]` + `.26 / [.025,.205]` | same | 7 | Yes. A looser, uneven two-rhythm wrap. |
| **Potion Slime A** | `glow` `#B6F28F` .62 @ .30, rim `#3F8A4A`, body lime `#8EDB6A`, 2 x `spots` (`#EFFFE0` .10 @ .9, period .62, side +.06; `#FFFFFF` .05 @ .85, period .41, side -.09) | none | 6 | Yes: bubbly green, soft glow, bubble spots. The glow is a translucent band (no blur exists). On the dark board it lowers the rim's local contrast (see K4). |
| **Potion Slime B** | rim, lime body, `shine` core `#F1FFD9` .20 @ .55 (fades over .7 cell), 2 x spots | none | 6 | The glow is inside the body (a luminous core) instead of a halo, so the rim sits directly on the board. |
| **Potion Slime C** | as A in mint (`#78DDB0`, glow `#A9F5D3`, rim `#2F8F6A`) | none | 6 | The alternative green. |
| **Little Bat A** | rim `#8068B8`, body dusk purple `#5E4A96` | `eyeShape:'arc'` (sleepy) in cream `#FFF1DC`, mouth .10, **fangs = blush** `#FFFFFF` size [.032,.06] offset [.03,.115] | 5 | Mostly. The dusk purple and sleepy eyes are as briefed. The fangs are two small white ovals hanging from the smile: they read as tiny fangs at 29 dp, but they are rounded, not pointed. A true fang needs a new field (RULING 1). No ears or wings. |
| **Little Bat B** | as A | sleepy arcs + pink cheeks `#E39BC4` (ordinary blush), no fangs | 5 | A cosier bat without fangs. |

Slots are the colour layers including blush and eyes; "+ mark" adds the reserved missed-mark draw, as K2 counts it. Every
variant stays at or under 7 slots and 8 draws.

## Contract results (native contract APK on emulator-5556; v1 levels 0-19 + dense 3827, 2,118 arrows per spec)

Commands:
1. `sh scripts/art/halloween-plus/build-contract-apk.sh`, which runs `skin-contract-data.cjs` with
   `ART_SKINS_CANDIDATES=1`, then `build-skin-catalogue.py contract`, then `prove-apk.py ... contract`.
2. `adb -s emulator-5556 install -r -d` of the contract APK.
3. `sh scripts/art/halloween-plus/run-contract.sh` for the `after`, `polish` and `halloween` modes.
4. `before` re-run separately with `ART_SKINS_DIR=artifacts/HALLOWEEN-PLUS node scripts/art/run-skin-contract.mjs before`.
   Its first run failed to push the fixture (the app's external-files dir did not exist yet), and `|| true` hid the
   failure; the summary caught it.
5. `python3 scripts/art/halloween-plus/summarize-contract.py`, which writes `checks/contract-summary.json` and exits
   non-zero on any failure.

Results:
- **Red control:** frozen ART03 Cinnamon still fails K1: 17,191 paths, `EXPECTED_K1_FAIL` on 21 of 21 levels.
- **after / polish / halloween:** PASS on 21 of 21 levels for all 28 specs (21 registered + 7 candidates).
- **Product module:** it ends with exactly its 6 files (`build/contract/module-after.txt`). The build script refuses to
  start, and the wrapper fails, if any diagnostic class is left behind.

| Spec | K1 fit fail | K2 draws incl. mark (10/100/250) | K3 head fail | K5 flat / K6 reduced motion | K8 one-cell checks | Join (head - body) px | Face clearance (.03) | Blush / fang clearance | 01b and eye oracles |
| --- | ---: | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Mummy A | 0 | 6 / 6 / 6 | 0 | 21/21, 21/21 | 449 | 0 | 2,118 incl. 449 one-cell heads | 2,118 / 0 outside | butt wrap bars 420 (round-cap control rejected 21/21); eyes classified `dot` 168 (swap rejected) |
| Mummy B | 0 | 7 / 7 / 7 | 0 | 21/21, 21/21 | 449 | 0 | 2,118 incl. 449 | 2,118 / 0 | butt bars 378 (control rejected 21/21); dot 168 |
| Potion Slime A | 0 | 6 / 6 / 6 | 0 | 21/21, 21/21 | 449 | 0 | no face | - | 33,888 path arrays byte-identical to the cd10d12 renderer + the pre-HALLOWEEN-01 renderer |
| Potion Slime B | 0 | 6 / 6 / 6 | 0 | 21/21, 21/21 | 449 | 0 | no face | - | same; core shine: 473 straight-run axis checks, one connected component |
| Potion Slime C | 0 | 6 / 6 / 6 | 0 | 21/21, 21/21 | 449 | 0 | no face | - | 33,888 byte-identical |
| Little Bat A | 0 | 5 / 5 / 5 | 0 | 21/21, 21/21 | 449 | 0 | 2,118 incl. 449 | 2,118 / 0 (fangs inside the head) | 29,652 byte-identical to cd10d12; eyes `arc` 168 (swap rejected) |
| Little Bat B | 0 | 5 / 5 / 5 | 0 | 21/21, 21/21 | 449 | 0 | 2,118 incl. 449 | 2,118 / 0 | same |
| Pumpkin / Ghost / Candy Corn (reference) | 0 | 6 / 7 / 6 | 0 | 21/21 | 449 | 0 | 2,118 / 2,118 / - | Ghost 2,118 / 0 | unchanged from HALLOWEEN-01b |

The `after` mode also checked, for every spec: the feature fit plus shifted negative controls (glow, spots, seam,
head face), the accent inset, a connected shaft accent and the straight-run axis (Slime B's core), dashed seams that
really have gaps, and the single-cell rim connectivity with its old-stroke negative control. The new blush clearance
check passed for the registered Critter and Ghost too (2,118 each, 0 outside). Its displaced-blush control was rejected
for every spec with a head blush. Everything is in `checks/native-*.json`.

## K4 contrast (real audit, `src/ui/contrastAudit.ts` skinContrastRows; `checks/candidate-contrast.json`)

| Spec | Outline on #F3EEFA (Daylight) | Outline on #221A36 (Ink Night) | Missed mark (L / D) | Blocked (L / D) |
| --- | ---: | ---: | --- | --- |
| Mummy A/B (rim `#857563`) | 3.90 | 3.72 | 5.40 / 3.20 | 3.65 / 4.70 |
| Potion Slime A/B (rim `#3F8A4A`) | 3.72 | 3.90 | 5.40 / 3.20 | 3.65 / 4.70 |
| Potion Slime C (rim `#2F8F6A`) | 3.50 | 4.14 | 5.40 / 3.20 | 3.65 / 4.70 |
| Little Bat A/B (rim `#8068B8`) | 4.01 | 3.62 | 5.40 / 3.20 | 3.65 / 4.70 |

Every required row passes for all seven, so `#221A36` needs no change.

**Honest halo note (not a contract row):** the K4 audit compares the rim with the board. Slime A and C put a
translucent halo between them. On the dark board, the rim against its own halo composite is **1.68:1** (A) and
**1.74:1** (C), and the halo against the board is 2.32 / 2.38. On the light board the rim against the halo is
3.55 / 3.38. On dense dark boards the slime outline is therefore softer than the audit implies; Slime B avoids this.
Body fill is free under K4, so the bat's dark body against the dark board (2.28:1) is allowed: the lavender rim
carries the outline.

## Device captures (real Android viewport)

**Build.** `artifacts/HALLOWEEN-PLUS/build/on/test-ads.apk`, sha256 `74cb5ce4...`:
- `scripts/art/halloween-plus/build-test-apk.sh`: prebuild `--clean`, Metro `--reset-cache`, `--rerun` of the bundle
  task, df at least 5 GB, no other Gradle client.
- Flags: all META, picker, path, book, `EXPO_PUBLIC_META_SEASONS=1`, `EXPO_PUBLIC_ADMOB_TEST_ADS=1`, plus the
  existing `EXPO_PUBLIC_LOG_BOARD_VIEWPORT=1`, so taps are placed from the app's own camera line.

**APK proof** (`build/on/proof.txt`):
- Test app id `3940256099942544` present: UTF-8 9, UTF-16LE 0.
- `6706292920`, `7549521178`, `3505414519`, `5508761320` and `5754923896` all [0, 0].
- Same certificate as the installed APK: `24f7fa0b...`. Earlier test builds were signed with this cert; the worktree
  build read the repo's gitignored `credentials/` through a temporary link, which has since been removed.
- No instrumentation entry and no diagnostic class in the dex.
- **Candidate names absent from the bundle**, with `Candy Corn` present as the positive control.

The contract APK passed the same proof in `contract` mode (`build/contract/proof.txt`, sha256 `fd4ecfd7...`).

**Method.**
- Each capture is a fresh `am start -n com.danteb.arrows/.MainActivity -e artSkinSpec '<spec JSON>'`. This is the
  existing native override in `ArrowsBoardView.setArtSkin`.
- The save fixture selects the owned Pumpkin (18) so the JS gate sends a selection and the Halloween tint. The native
  view then parses the override.
- Pumpkin, Ghost and Candy Corn are passed as their exact `SKIN_SPEC_JSON` strings.
- Play is tapped, and the board is proven open by its `[board-camera] ... scale=0.7347 tx=-44.08 ty=128.35` line:
  29.39 dp cells at all three boards.

**Boards.**
- Small: level 13 (index 12), 17x17, 60 arrows. It opens zoomed, so faces render. A 16x16 board opens at fit, about
  24 dp, which is below the 28 dp face LOD.
- Long: level 505 (index 504), 18-cell arrows.
- Dense: level 3828 (index 3827), 250 arrows.

The headers in the full captures confirm LEVEL 13 / 505 / 3828.

**Captured** (`screens/device/`, ledger `device/captures.jsonl`):
- 60 static captures (10 specs x 3 boards x 2 themes).
- Per spec, a blocked tap on the small light board: pink ink, shake and closed eyes. The peak change in the head box
  was 49-82 in the frame chosen within 0.9 s of the tap.
- Per spec, one exit, with the mid-exit frame chosen by exit-lane change (`device/exit-scores.json`).

All picks were viewed. One is borderline: **Slime C's** exit frame shows the exit only just beginning (lane score
6.89). The other nine show the arrow travelling down its lane.

**Recording note.** The guest `screenrecord` cannot encode 1440x3120 on this emulator, so motion was recorded with
`adb emu screenrecord` (host-side, full resolution). On this loaded host only about 6 distinct frames per second
arrived; see the lesson.

## First-draw cost

**UNVERIFIED (not measured).** The README's K7 method applies: twelve shuffled OFF/ON pairs per spec at 29.39 dp on
3827 through `measure-skin-catalogue.mjs`, which uses the same `artSkinSpec` override. It was not run. The host load
averaged 9-48 during this task and an emulator cold boot was needed, and the README forbids turning contended-host
timings into a claim.

**Deterministic work counters** from `polish` on 3827 (the recipes' cost proxy):

| Spec | Templates | Face builds | Centreline builds | Band-head builds |
| --- | ---: | ---: | ---: | ---: |
| Mummy A / B | 57 | 57 | 57 | 0 |
| Pumpkin | 57 | 57 | 57 | 0 |
| Ghost | 57 | 57 | 57 | 0 |
| Slime A / B / C | 57 | 0 | 57 | 0 |
| Little Bat A / B | 57 | 57 | 0 | 0 |
| Candy Corn | 57 | 0 | 57 | 12 |

Expected cost:
- **Mummy** is Pumpkin's recipe plus blush.
- **Little Bat** is cheaper than Ghost: no beads, no shine and no centreline.
- **Slime** adds a glow stroke (as Neon Glass) and two spot passes.

These are hypotheses until the paired measurement runs.

## RULINGs (owner decisions; my recommendation in each)

1. **RULING: fangs need a new general face field.** The blush approximation (Little Bat A) is contained and contract
   clean, but it is rounded, and it uses up the blush, so a fanged bat cannot also have pink cheeks.
   - **Proposed field:** `face.mouthShape: 'arc' (default, today) | 'fangs' | 'cat' | 'o'`.
   - **Semantics for `'fangs'`:** the existing smile arc plus two small downward triangles of `fangSize` (default
     .03 cell) under the arc at ±`mouthWidth`/4. They are drawn in a new optional `face.fangColour`; when omitted it
     is the closed-eye ink. They count as one extra slot (as blush does), are included in `eyePaths` for the .03
     clearance check, and are unchanged when the eyes are blocked.
   - **Reuse:** Vampire and Dracula, Werewolf, Cat (with `'cat'`, a "w" mouth), Shark, and a surprised Ghost
     (`'o'`). It is data only, with no skin-id branch.
   - **My recommendation:** ship Bat A as is for this season if the owner likes it; the white ovals read as fangs at
     29 dp. Add `mouthShape` only if a second fanged or cat skin is planned.
2. **RULING: the Slime glow approach.** A (halo) is the literal brief and reads as glowing on the dark board, but its
   rim against its own halo is 1.68:1 there (the halo is not part of the audited K4 row). B (inner core) passes
   everything directly. **My recommendation:** B, or A only with the dark-board softness accepted explicitly.
3. **RULING: diagonal bandage wraps (optional new field).** The wraps are perpendicular butt bars (the Pumpkin rib
   field), and tight bends show them as small fan wedges. Diagonal wraps would need `seam.slant` (degrees, butt-capped
   seams only; each bar is sheared along the tangent). Candy-cane stripes (Christmas), a barber pole, rope or twine,
   and tiger stripes could reuse it. **My recommendation:** not needed; the perpendicular wraps read as a mummy.
4. **RULING: one variant per candidate.** Mummy A (tight) or B (looser). Slime A, B or C, with the green and the glow
   style. Bat A (fangs) or B (cheeks). **My recommendation:** Mummy A, Slime B (lime core), Bat A.
5. **RULING: Little Bat has no ears or wings.** Head shapes are tri, rounded, swept or step only, so ears need a head
   field (`head.ears`), and wings would need a mid-shaft decoration. Both were left out of scope. The bat is carried
   by colour, sleepy eyes and fangs.
6. **RULING (recorded deviation): the Slime has no face.** The brief named none; the one-cell slime is a plain
   triangle. A face is one field away (`headFace`) if the owner wants a cute slime.

## Look findings for the owner (my own viewing, not verdicts)

- **Mummy.** Reads as bandaged on all boards. The eyes "peek" between the wrap lines on the head. A and B differ only
  subtly at 29 dp.
- **Slime.**
  - The bubbles read well.
  - The halo is very faint on the light board.
  - The blocked tint over lime composites to a muddy brown (Slime A blocked frame); the other specs go pink.
  - Slime B's core gives the strongest "potion" look.
- **Little Bat.**
  - The dark body is close to the dark board, but the lavender rim separates it clearly.
  - The sleepy cream eyes and fangs are small but readable at 29 dp.
  - Without ears or wings it is the least literal of the three.
- **Pack read.** The candidates sit well beside Pumpkin, Ghost and Candy Corn on the same tints (the "pack together"
  row). Mummy and Ghost are both pale; Mummy's warm taupe rim and wraps keep them distinct.

## Gates

- `npx tsc --noEmit -p .` exits 0.
- Full jest `npx jest "$PWD/(src|scripts)/"`: **150 suites / 2,538 tests / 12 snapshots, all pass** (run on the
  final tree). A first full run during a concurrent Gradle build at load 48 had timeouts in `adsKillSwitch` and
  `adsRewardedNativeEvent` (5 s / 20 s test timeouts) and was killed at its time limit; it was re-run on a quieter
  host. The new suite alone is 40 tests.
- No dependency was added. `npm ci` from the lockfile created the worktree's `node_modules`.
- The scripts are POSIX sh with `set -eu` and markers, and Python that exits non-zero on failure.
- One lesson was appended at the end of `docs/engineering-lessons.md`.

## Device state and restore proof

**Before.** The installed APK (sha256 `c2967710...`, cert `24f7fa0b...`, versionCode 6) was pulled. The whole app data
dir was backed up as a tar, with a sha256 + owner/mode manifest of 65 files; `RKStorage` was a 0-byte file. Settings and
display were recorded (`device/backup.json`).

**Restore.** `device.py restore` reinstalled that exact APK with `install -r -d`, replaced the data dir from the tar and
ran restorecon. It then asserted (`device/restore-proof.json`):
- the reinstalled APK bytes equal the original;
- the data manifest is equal (65 files, byte-exact sha256 and owner/mode);
- the save rows are equal (an empty save);
- the settings and the display are equal.

Disk: unpicked frames extracted from the recordings were deleted (about 3 GB). The `.webm` recordings, the picked
frames and every `timing.json` are kept, so `rescore-exits.py` needs `ffmpeg` re-extraction first. The generated
`android/` was removed after the builds.

`device.py cleanup` removed the external-files dir the contract run created and this task's probe files, and proved
them gone. **Not restorable:** the package `lastUpdateTime` (reinstall). emulator-5556 vanished mid-task (not caused by
this task's commands); I cold-booted the same AVD on 5556 and left it running.

## UNVERIFIED

- **Physical phone:** look, legibility at real pixel density, and performance. Everything here is emulator-5556.
- **First-draw / K7 timing:** not measured (see above). Exit-frame smoothness is not measured either: the recorder
  delivered about 6 fps.
- **Owner taste** for every candidate and variant.
- **Slime C's exit evidence** is only the start of the exit.
- **Halo legibility on dense dark boards:** only the composite ratio was computed; no user test.
- **iOS:** no renderer; not applicable.

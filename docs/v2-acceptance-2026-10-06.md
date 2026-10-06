# Generator v2 acceptance (W3-21), 2026-10-06

This is the owner's evidence pack for turning generator v2 on. **v2 is still off**
(`GEN_V2_ENABLED = false` in source). Nothing here flips it.

Full commands and logs are in [docs/next-level/reports/W3-21.md](next-level/reports/W3-21.md).
Raw evidence is in `artifacts/W3-21/`, which is gitignored and stays on this Mac.

## Decisions the owner still has to make

1. **Promo art.** Approve or reject the three v2 store images listed below. `store/marketing/`
   still holds the v1 images, unchanged. Two points to weigh:
   - v2's early boards are small. The images show 56, 22 and 90 arrows. The current v1 images
     show 172, 159 and 167.
   - v2 never deals Crescent as Super Hard. Its image therefore comes from a Normal level (level 23).
2. **The flag flip stays blocked** until both of these happen:
   - W3-17's first-time-player playtest (`docs/curve-playtest-<date>.md`). It does not exist yet.
   - An explicit owner yes, given after watching the recordings below.

## What v2 deals now (after admitting House, Teacup, Bell and Umbrella)

These numbers were measured by running the probe and the W3-21 scripts.

**How many shapes are dealt:**

| Install | Early game | From the saturated window on |
|---|---|---|
| Fresh | all 30 admitted shapes | 17 of 30, from level 382 |
| Existing player | 17 | 17 |

The admission raised the saturated set from 13 to 17, as W3-18 predicted ("up to 17").

**Where each new shape first appears:**

| Shape | Fresh install: first level | Fresh install: smallest board | Existing player: first level | Existing player: smallest board |
|---|---|---|---|---|
| Teacup | 2 | 12×13 | 12 | 24×26 |
| House | 11 | 13×13 | 7 | 25×25 |
| Bell | 19 | 14×13 | 14 | 27×26 |
| Umbrella | 20 | 17×14 | 11 | 32×27 |

**Risks carried from W3-18:**
- **House's chimney is lost at 14 rows.** A fresh install gets House at ≤14 rows on 2 boards (levels 11–158).
- **Umbrella's hook is weak at 12 rows.** Umbrella's smallest v2 board is 17 rows.
- **Existing players** never get any of the four shapes below 24 rows.

**Level 1 changed.** A fresh install's level 1 is now **Diamond, 14×14, 24 arrows**. Before the
admission it was Pine. The target stays 88 cells at bias 3, which is W3-13's row B. The bag picks the
shape, not the row.

**Heaviest board, levels 1–10,000:**

| Install | Now | Before the admission |
|---|---|---|
| Fresh | 197 arrows (level 9480, Rectangle) | 190 |
| Existing player | 196 arrows | 195 |

Both are under the 250-arrow cap. W3-15's on-device check measured a 194-arrow board. The 197-arrow
board itself has not been run on a device.

**v2 is frozen.** These tests pin it (`src/core/__tests__/levelGenerator.test.ts`, "v2 frozen …;
never re-pin"):
- fresh corpus fingerprint `1c4cd1f4`;
- existing-player corpus fingerprint `849961f1`;
- five golden boards.

v1 (`d01abbd8`), the daily (`ff12d7b5`) and v1's shape sequence are unchanged.

## Over-install on the emulator (fleet_floor_api31, emulator-5556)

**The builds.** Three TEST-ADS release APKs, all built by gradle and all signed with the same
certificate (`24f7fa0b…a50f8`):

| Build | Code | Generator |
|---|---|---|
| A | current code | v2 off |
| B | current code, with `GEN_V2_ENABLED = true` as a throwaway local edit | v2 on |
| C | B, with switch-level classification disabled (the teeth test) | v2 on |

The source was restored byte-for-byte after the builds.

**Why build A is not `da93dcd`.** That commit uses the owner's live LevelPlay app key. It has no
AdMob test ids, so it cannot be proven to be a test-ads build.

**How the existing player was set up.** Build A seeded the save to level 12 and wrote it. The save
held **no** `arrows_gen_switch_level` key before the over-install. This was read with `su 0`
sqlite: count 0.

| Step | Recording / evidence | Result |
|---|---|---|
| Install B over A (`install -r -d`), cold start | `artifacts/W3-21/device/B1-overinstall/B1-overinstall.mp4` | The menu reads **Level 12**. The board is v1 (`[ftue] board_mount 11 0 gen=1 arrows=54 shape=Bolt`). A perfect clear followed the v1 plan (checksum `3f6c1b6f`), and the win panel read "Level 12 · Bolt · 54 arrows". |
| Next level | same recording | Level 13 is v2: `board_mount 12 0 gen=2 arrows=96 shape=Heart`. This is the board predicted by `shapeNameForLevel(12, 2, 12)` and the probe. |
| Save after the clear | `B1-overinstall/db-after.txt` | **`arrows_gen_switch_level = 12`** |
| Force-stop, reopen | `artifacts/W3-21/device/B2-reopen-level13/B2-reopen-level13.mp4` | The menu reads Level 13. The same `gen=2 … Heart` line appears. The board screenshot is pixel-identical to the first deal: 0 pixels differ below the status bar, and the UI XML is identical. |
| Clear level 13 with the predicted v2 plan | `B3-clear-level13-by-v2-plan/` | A perfect 96-tap clear following `generate(12, 2, { switchLevel: 12 })`, checksum `307ef328`, which is a frozen golden row. A test interstitial then showed; it was closed by force-stop and never tapped. |
| Fresh install of B (`pm clear`, after a full backup) | `artifacts/W3-21/device/B4-fresh-install/B4-fresh-install.mp4` | Switch level **0**. Level 1 is v2 Diamond, 24 arrows, target 88 at bias 3 (W3-13 row B). |
| Teeth test: A's level-12 save restored, build C installed over it | `artifacts/W3-21/device/C1-teeth-classification-disabled/C1-teeth-classification-disabled.mp4` | Switch level **0**. Level 12 is re-dealt as **v2 Rocket, 36 arrows** (`gen=2`), not v1's Bolt. This shows the recording can show the failure. |

**Device restore.** The emulator was put back exactly as it was:
- the original APK is reinstalled (`artifacts/PETAL-ADS-01/build/test-ads.apk`);
- the app data is restored, and re-tarring it gave a byte-identical archive;
- settings, wm size and density are restored;
- the date was never changed.

## Promo art (v2, fresh install). Not installed in `store/marketing/`

**Owner ruling 2026-10-06:** keep Heart; Cat and Pine replace Crescent (its only v2 board was Normal tier and
sparse) and Flower (read as a blob). Cat and Pine are dealt by both generators.

| File | Board |
|---|---|
| `artifacts/W3-21/promo-art-2/board-heart.png` | Heart, 56 arrows, 18×18 (v2 level 66, Super Hard; same bytes as the first run) |
| `artifacts/W3-21/promo-art-2/board-cat.png` | Cat, 58 arrows, 24×24 (v2 level 84, Super Hard, Ink Night) |
| `artifacts/W3-21/promo-art-2/board-pine.png` | Pine, 71 arrows, 32×29 (v2 level 102, Super Hard, Daylight) |

Produced with `npx tsx scripts/generate-promo-art.ts --gen-version 2 --out artifacts/W3-21/promo-art-2`.
`store/marketing/` still holds the v1 Heart, Crescent and Flower, which match the generator players get today.
Swap in the v2 set when v2 is switched on. The superseded first run is in `artifacts/W3-21/promo-art/`.

## Not verified

- Over-installing on a physical phone through the Play Store update path. This is BLOCKED-ON-OWNER
  at release time.
- Recognisability of the four new shapes in a blind test. The owner ruled instead.
- Performance of the 197-arrow board on a device.

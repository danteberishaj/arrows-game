# HEADER-FIT: the game header fits a 360 dp screen

Branch `next-level`, HEAD `b29f868`. Nothing is committed; the controller owns git. Artifacts are in
`artifacts/HEADER-FIT/` (gitignored).

The bug was found in W5-16's "Outside scope". At 360 dp, a long tier line pushed the hearts and the Hint out of the
header. The Hint ended 38 px past the padding on level 18 and was cut off by the screen edge on level 120. The owner
kept the Hint in the header (2026-10-06), so the header itself had to fit.

## The fix (option a: the subline wraps)

`src/ui/GameScreen.tsx`, the non-tutorial header only:

- **Left block.** `headerLeft` gets `flexShrink: 1`, and the title column `headerTitleColumn` gets `flexShrink: 1`.
- **Right block.** `headerRight` keeps its size (`flexShrink: 0`, which was already the default), so the hearts and
  the Hint stay at the header's right padding edge.
- **Subline.** `missionLabelRow` gets `flexWrap: 'wrap'`, and the mission words (and "Hint unavailable ·") get
  `flexShrink: 1` through `missionText`.
  - When "tier · shape · N left" is wider than the column, the counter moves to a second line whole.
  - At large font scales the words also wrap inside their own Text.
  - Nothing in the subline has `numberOfLines`, so no ellipsis can appear.
- **Title.** "LEVEL N" and "TODAY" stay the plain Text they were. Only a title that `onTextLayout` reports on two
  lines switches to `numberOfLines={1}` with `adjustsFontSizeToFit` and `minimumFontScale={HEADER_TITLE_MIN_FONT_SCALE}`.
  The value is 0.5, which keeps the title at 12 sp or more.
- **"Hint unavailable ·".** While it stands in for the mission words, the subline row keeps the height it had with
  them (`minHeight` from the row's last `onLayout`). A failed hint therefore never resizes the board mid-level.

**Why (a) and not (b).** Option (b) cannot work: shrinking the subline to 11 sp is not enough.
- At font scale 1.0 and 360 dp, the widest line needs 160 / 191.3 = 0.84 of 12 sp, which is 10.0 sp.
- At font scale 1.3, it needs 0.64, which is 7.7 sp.

(a) is also the brief's first preference. The board stays put on levels that fit (see "Board top" below). The choice
is the same in both themes, because it is layout only and the captures cover both.

**RULING: no gap between the text and the hearts.** Today the header is `space-between` with a minimum gap of 0. A
12 dp gap would have wrapped 1,233 more v1 levels (1–3000) at 360 dp, all of which fit today, and moved their boards
(`analysis/header-strings-gap12.txt`). With no gap, exactly the levels that overflow today wrap (the model gives 384 of
3,000 at 360 dp). The heart pip's own transparent edge is about 2.8 dp.

## Worst cases, computed (`analysis/header-strings.ts`, `header-strings-gap0.txt`)

The analysis uses HarfBuzz on the shipped Fredoka TTFs, including Android letter spacing. The subline is measured as
its three Texts: the mission words, the counter slot (ghost `2` × digits) and " left".

- **Longest real v1 subline, levels 1–3000:** "Super Hard · Mushroom · 137 left", **level 24**, 191.3 dp. It ties
  with every Super Hard Mushroom level that has 3 digits (90, 114, 144, 300, …). Butterfly (level 120) is 187.3 dp on
  the device.
- **W3-20 tier V2 (`TIER_LABEL_V2_ENABLED`):** the words are the same three ("Normal", "Hard", "Super Hard"), and its
  worst is the same string at 191.3 dp. **No third build was needed**, because the V2 strings are never longer.
- **Daily, days 0–4017 (2020–2030):** the worst cycle line is "Normal · Mushroom · 1xx left", 168.8 dp. The worst
  V2 line is "Super Hard · Butterfly · 144 left" (day 1110), 183.4 dp. Today (day 2470) is "Normal · Pentagon ·
  89 left" with the title "TODAY".
- **Synthetic "Super Hard" + each catalogue shape + a 3-digit count:** the worst is Mushroom, 191.3 dp, then
  Rectangle at 189.9 and Hourglass at 189.4.
- **Title:** the widest 4-digit title is "LEVEL 2222", 143.7 dp. "LEVEL 22222" is 158.3 dp.
  - At font scale 1.0 all of them fit the 160 dp column.
  - At font scale 1.3, "LEVEL 2222" needs a scale of 0.856, well above the 0.5 floor.
- **Calibration.** The model under-reads device widths by up to about 2 dp per Text. "Super Hard · Butterfly · " is
  412.9 px in the model and 419 px on the device. So levels within about 6 dp of the 160 dp column may fall on either
  side of the wrap line. The device captures are the ground truth.

## Pixel checks (EXECUTED, emulator-5556)

There are 28 pre/post pairs: 4 geometries × (levels 1, 18, 24, 120, 2222 and the daily, in Daylight, plus level 24 in
Ink Night). The full table is in `pixel/checks.txt` (`scripts/analyze.py`). The header's padding edge is 1384 px
native and 1032 px at 1080 px wide.

**Hint right edge** (uiautomator bounds, pre → post), with the hearts' painted right edge in brackets:

| Geometry | One-line levels | Levels 18 / 24 / 120 |
|---|---|---|
| native 1440x3120@560 | 1384 → 1384 [1206 → 1206] | 1384 → 1384 [1206 → 1206] (all fit on one line) |
| 1080x2340@480 (360x780 dp) | 1032 → 1032 [879 → 879] | **1070 / 1080 / 1080** → 1032 [917 / 979 / 961 → 879] |
| 1080x1920@480 (360x640 dp) | 1032 → 1032 [879 → 879] | **1070 / 1080 / 1080** → 1032 [917 / 979 / 961 → 879] |
| 360x640 at font scale 1.3 | (no one-line level) | pre: Hint missing from the dump on 18 / 24 / 120 (off-screen); level 1 1080, level 2222 1080, daily 1080 → **1032 on all 7** [879] |

- **Post, all 28 captures:** the Hint's right edge is exactly at the padding edge (0 px off), its painted right edge
  is 1 px inside it, and it is 48 px (16 dp) from the screen edge. The hearts' painted right edge is 879 / 1206 in
  every capture, which is ±0 px against the short-subline levels.
- **Touch target.** Back and Hint are 36.0 × 36.0 dp in every post capture. With the 8 dp `hitSlop` (pinned in jest)
  that makes 52 dp, which is at least 48 dp.
- **Readable text (macOS Vision OCR of the header).** Post shows no ellipsis in any capture. For example, at 360 dp
  level 24 reads "Super Hard • Mushroom •" / "137 left". At 1.3 it reads "Super Hard •" / "Mushroom •" / "137 left",
  and "LEVEL 2222" is on one line.
- **Title shrink at 1.3.** "LEVEL 2222" is drawn 57 px tall, against 67 px for unshrunk titles: about 0.85, or
  20.4 sp. No other title shrank: they are 67 → 67 px, and level 120 is 66 px.

### Board top and one-line identity

There are 13 one-line pairs: native ×7, plus levels 1 and 2222 and the daily at 360x780 and at 360x640. In all 13 the
board top is unchanged (native 305 px, 360 dp 273 px) and the title height is unchanged.
- **0 changed pixels** below the status bar in 10 pairs.
- **native-L24 Ink Night (1,747 px) and 360x780 L1 (1,344 px):** every changed pixel is inside the Hint glyph box.
  The pre shot caught the 💡 glyph dimmed, because the rewarded test ad was not yet loaded. Both dumps show the
  button enabled a second later.
- **360x640 L2222:** 92 px, with a maximum RGB-sum delta of 42, scattered over board rows 589–1366. This is
  anti-aliasing noise, as in W5-16's lesson (≤ 43).
- `pixel/one-line-identity.txt` has the same numbers with the Hint box excluded: 0 px everywhere except that L2222
  noise.

### Wrapped levels (expected, allowed by (a))

| Geometry | Board top | Header growth | Hint and back button top |
|---|---|---|---|
| 360 dp, font scale 1.0 | 273 → 318 px | 15 dp | 131 → 153 px (+7.3 dp) |
| 360 dp, font scale 1.3 | 315 → 356–431 px | one to three extra lines | 181–210 px |

At 360 dp and font scale 1.0, the button tops move because the header row centres its blocks vertically. That is
today's rule; see the RULING below.

### Owner sheet

`artifacts/HEADER-FIT/owner-sheet.png` shows pre | post for:
- 360x640 levels 24, 120 and 18, in Daylight;
- level 24 in Ink Night;
- font scale 1.3 for levels 24, 2222 and 1.

A red line marks the padding edge.

## A regression found and fixed during the run (post-v1)

The first post build set the shrink props on every title. At 480 dpi each fitting title was drawn about 8 % smaller:
52 → 48 px, with 7,490 changed pixels on 360x640 level 1 (`pixel/checks-post-v1.txt`, `captures/post-v1/`,
`build/post-v1/`). Native at 560 dpi was unaffected.
- **Cause (read from RN 0.86 source, not instrumented):** `ReactTextView.onDraw` re-fits with the pixel-snapped view
  height as an exact bound.
- **Fix:** the shrink props are set only after `onTextLayout` reports a wrap. The second post build is the one
  measured above.
- The lesson is in `docs/engineering-lessons.md`.

## TDD and gates

- **Test:** `src/ui/__tests__/GameScreen.headerFit.test.tsx` (new, 14 tests: both themes, plus the daily, "Hint
  unavailable", level 1).
  - **Red** on HEAD's GameScreen: **12 of 14 fail** (`tdd/01-red-on-HEAD.txt`). The 2 that pass guard the 36 dp +
    8 dp touch target, which HEAD already had.
  - **Green:** 14 of 14 (`tdd/02-green.txt`).
- **tsc:** 0 (`tdd/tsc-final.txt`).
- **Full jest:** 143 suites / 2,410 tests passed, and the 12 snapshots are unchanged (`tdd/05-jest-full.txt`).
  - **RULING:** the brief's baseline of 143 / 2,408 predates `b29f868`, which deleted the 12-test floating-hint
    suite. HEAD is 142 / 2,396 (`jest --listTests` gives 143 including mine). So the result is +1 suite / +14 tests,
    and nothing was removed.
- **Contrast:** one pin was hand-moved. `game-level`'s site moved to the title Text's new style line (now
  `${GS}:1084`). The other pins were re-pointed by a difflib line map (`analysis/repoint*.txt`). `contrast.test`
  passes 353 of 353.
- **`DESIGN.md`:** one line on long-text behaviour under Header (gameplay), plus re-pointed `GameScreen.tsx` pins.
- **Product module:** 6 files. **Dependencies:** none added.

## Emulator run

1. **Backup** (`scripts/backup.sh`):
   - APK `c2967710…f340`, pulled and its sha checked;
   - app data as a byte-exact `su 0` tar, `d9c9d46d…a466`;
   - `devicectl.py`, which now also records `font_scale` (1.0).
2. **Builds** (`build/build.sh`, using W3-15's recipe):
   - Node 20.19.4; Metro cache cleared; `createBundleReleaseJsAndAssets --rerun`; at least 16 GB free before each
     build; gradle in the background with an OK/FAILED marker.
   - The flags are W5-16's `flags-off.env`, the set that found the bug: `ADMOB_TEST_ADS=1`, `FTUE_LOG=1`, no
     `META_ZOOMED_CAMERA`. **RULING:** I kept its META set so pre/post match the build that found the bug.
   - **pre** `257f47b5…7a01` was built from a clean `src` (diff sha = the empty sha), before any edit, so no stash
     was needed. **post** `de39b9d1…79b5` matches the working tree (source-diff sha `dc075e73…`). `env.txt` is
     identical between the two.
   - **Proof (each APK):** `3940256099942544` [9, 0]; the five owner ids [0, 0] in UTF-8 and UTF-16LE; Hermes.
     `headerTitleColumn` appears only in post. Both are signed with the installed cert `24f7fa0b…a50f8`
     (`build/signing-proof.txt`), and both were installed with `install -r -d`.
3. **Seed and capture.**
   - The data was seeded with `su 0 sqlite3`.
   - Play was found by `findplay.py`. "Today's board" was found by OCR on the menu capture (`ocr/ocrbox`).
   - Each board was proved by `[ftue] board_mount <index>` (the daily by `board_mount 2470` and a TODAY header).
   - Every input required `mResumedActivity` = MainActivity. No ad was tapped.
4. **Restore** (`scripts/restore.sh`):
   - the original APK is back (sha `c2967710…`);
   - the re-tar sha equals the backup, and `ls -laR` is identical;
   - "RESTORE CHECK OK" covers the save, settings, font_scale (1.0), timezone and wm (1440x3120 / 560);
   - the theme lives in the restored save.

## RULINGs

1. The subline wraps (option a). Option (b) cannot meet 11 sp (numbers above).
2. There is no gap between the text block and the hearts, so no level that fits today changes.
3. **Vertical position.** The header row keeps `alignItems: 'center'`. On wrapped levels the back button, hearts and
   Hint move down by half the added line (7.3 dp at 360 dp). Horizontally they are fixed (±0 px) and their size is
   unchanged. Pinning them to the one-line Y would need measured line heights. If the owner wants that, it is a
   follow-up.
4. **The title shrinks only after a measured wrap**, because of the Android shrink-on-fit behaviour above.
5. **The Hint-unavailable height hold is beyond the brief.** Without it, wrapping would add a mid-level camera re-fit
   on 384 levels.
6. Pre and post use W5-16's flag set. The jest baseline was corrected to 142 / 2,396.

## UNVERIFIED

- **"Hint unavailable" on device.** It needs a failed or unrewarded hint ad, and the test creative blocks an early
  BACK (PETAL-ADS-01). It is jest-pinned only.
- **The one-frame title wrap before the shrink** on wrapped titles (font scale 1.3, 4 digits), and the camera re-fit
  it causes at level start. The final state is captured; the transition was not recorded.
- **The exact wrap boundary per level.** The model has about 2 dp of error per Text. Levels whose subline is within
  about 6 dp of the column may wrap or not, which is correct either way, but the count of 384 is approximate.
- **Physical phones, other densities** (only 480 and 560 dpi were run), font scales other than 1.0 and 1.3, and RTL.
- **The owner's look acceptance** of the wrapped header, the slight indent of the wrapped counter (its slot
  right-aligns the digits, e.g. " 137 left") and the centred buttons. It is pending on `owner-sheet.png`.

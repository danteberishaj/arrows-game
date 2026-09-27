# Art review packet, 2026-09-27 (W5-19): the whole screen, today vs the recommended art set

> **UNVERIFIED-DEVICE.** Every capture here is from the Android emulator (API 31, software GPU). Panel-dependent
> judgements (icon stroke weight, value steps between panel and scrim, paper grain, trail weight, OLED at low
> brightness) are **not** proven by this packet. Look at them on a phone before a flip. iOS was not built.

This is the packet the owner answers W5-20 from. It shows the **sum** of the W5 art work on every chrome screen, in
one build pair, and ends with the nine W5-20 questions, each with its evidence and a recommendation. It decides
nothing. A recommendation is marked **RECOMMENDATION** and is the implementer's opinion, not a ruling.

**The one sheet to look at:** `artifacts/W5-19/owner-art-review.png`. Rows: menu, settings, gallery, game header,
daily header, win panel, lose panel. Columns: 411x891 dp and 360x640 dp, Daylight and Ink Night, each OFF (today) next
to ON (recommended). Then a font-scale-1.3 stress row at 360 dp and 0.5x close-ups of the header, both panels and
the menu buttons.

## 1. What was built and captured

| | OFF arm (today's art) | ON arm (the recommended art set) |
|---|---|---|
| APK | `artifacts/W5-19/apk/w519-off.apk` (sha256 `f06d86d1…`) | `artifacts/W5-19/apk/w519-on.apk` (sha256 `33af627d…`) |
| JS | `git archive` of HEAD `df1fa8b`, exactly | the same, plus one capture overlay: `src/ui/theme.ts` with W5-05 set A's two Daylight values (`artifacts/W5-19/overlay-A/overlay.diff`) |
| ART flags | none: every `ART_*_ENABLED` inlined `false` | `ART_ICONS`, `ART_WIN_SILHOUETTE`, `ART_PANEL_DEPTH` (set A), `ART_HEADER_SILHOUETTE` inlined `true`. `ART_PAPER_TEXTURE` stays `false`. |
| Other flags (both arms) | test ads, FTUE, streak freeze, zoomed camera, exit-to-edge, board grid, missed mark, banner, press spring, level transition, panel motion, daily, gallery, **settings sheet**, capture diagnostics | same |

Both builds use the JS repack over the same native host (`artifacts/W2-06/apk/w206-on.apk`), with no gradle build
(disk). The build logs record the inlined value of every flag (`apk/w519-*.apk.env.txt`). Before installing either
APK, the bundle was checked in ASCII and UTF-16LE: Google's test app ID is present, and none of the owner's
`ca-app-pub-9813131856455133` units appear (`apk/*.proof.txt`). **EXECUTED.** The two arms differ only in the art flags
and the set-A overlay, so an OFF/ON pair isolates the art. The META flags are ON in both arms so that the daily, gallery and settings screens exist.
A player build today has every flag OFF, and this packet does not show that build.

**Captures (EXECUTED, `artifacts/W5-19/cap/{off,on}/`, harness `scripts/cap519.mjs`).** The harness is W5-02's
`cap502.mjs` with a settings step and menu positions read live from the dumps. Each arm has 17 captures:
2 geometries x 2 themes x (menu chain, daily, won, lost), plus one 360 dp font-1.3 menu chain. The save is seeded as a
returning player on level 53 (Square, 66 arrows, 5 solves, perfect run 2).

- **Menu → settings sheet → gallery → game header** and **daily header** are captured at motion scales 0/0/0. At
  that setting the app reports `useReducedMotion` = true. The Play pill is static, so uiautomator can dump the screen.
- **Win and lose panels** are captured at scales 1/1/1 (`useReducedMotion` = false, the panel entrance the player sees).
  - Win: the real findHint solve of all 66 arrows. Pans at 360 dp are registered on screen.
  - Lose: 3 blocked taps. The lose capture waits for a ready rewarded test ad, so Continue is enabled.
  - Every panel capture pairs its phase **log line** (`[ftue] clear 3 …` or the third `[ftue] blocked true …`) with a
    uiautomator phase proof taken before the screenshot. The screenshot comes 6 s later.
- **Every manifest records** the arm, all three motion scales read back, the app's own `useReducedMotion`, the `wm`
  size and density, the font-scale read-back, the build commit (`df1fa8b`), the flag env, the installed APK sha and
  the ad-click count. Check: `gates/manifest-check.txt`, 35 manifests, 0 problems, `aclk` 0 everywhere. **No ad was
  ever tapped.**

**HEAD moved during the capture run.** `a19c33f` (docs) and `7cb4cd7` landed after both builds (21:08 and 21:09). `7cb4cd7`
changes the support address in `src/ui/settingsRows.ts` to `techsnaxx@gmail.com`. The settings captures here still
show the old address, `ddante.berishaj1@gmail.com`. It is the same one word, so the census is unchanged. INFERRED
from the diff; not re-captured.

**Reused, not re-captured** (each task's own acceptance captures; see section 5): the icon sheet (W5-02), the
silhouette sheets (W5-01/W5-04/W5-06), panel sets A/B/C (W5-05), the trail recordings (W5-07), the grain opacities
(W5-14), the wordmark options (W5-11), the dead-band mocks (W5-15) and the settings sheet with all 4 rows (W7-04).

**Not covered by this packet's own captures.** The 360x780 dp geometry: W5-03 and W5-06 cover it, and the width that
matters is the same 360 dp captured here. Font scale 1.3 is covered only by the 360 dp stress row; W5-08 has fs 1.3
for every screen at 411 dp, and W7-04 has it for the menu and sheet. Reduce motion is captured in one state per screen
(on for the static screens, off for the panels), not both states on every screen.

## 2. What the combined view shows (interactions between flags)

All EXECUTED unless labelled otherwise. Diff method: `scripts/diff519.py`, pixels whose max channel delta is
greater than 24, with the clock and the rotating test banner masked. Output: `gates/diff-off-vs-on.txt`.

1. **The ON set changes only its own regions.** At scale 0 the OFF/ON diff is confined as follows:
   - menu: the top-right button cluster (x 237–393, y 38–82 dp at 411);
   - gallery: the back button (16–52 dp);
   - game and daily: the header row and the `#` grid toggle;
   - settings sheet: **0 px** (the gear is under the 0.95 scrim).

   The board viewport the app logs is identical OFF and ON: `[board-viewport] h` = 804.29 at 411, 549 at 360x640 and
   535 at 360 font 1.3. The ON header costs no board height.
2. **At 360 dp and font scale 1.3, today's header pushes the hint button off-screen, even for a short shape name.**
   With OFF on Square, uiautomator clips the hint button to 24.3 of its 36 dp: its right edge is **11.7 dp past the
   screen edge** (`cap/off/off-360-day-fs1.3-menu-game.xml`). With ON, the header silhouette replaces the word
   "Square" and the button ends on the 16 dp padding line (right edge 344.0 of 360 dp). At font 1.0 both arms fit for
   Square. W5-03 measured the same overflow at font 1.0 for long names (Butterfly: 8.0 dp before W5-03, 11.3 dp after).
3. **The win panel grows from 270 dp to 356 dp tall (+86 dp)** with the 64 dp silhouette plus set A's spacing. It still
   fits at 360x640: the panel spans y 142–498 of 640 dp (OFF 185–455). The lose panel grows from 233.7 to 245.7 dp
   (spacing only).
4. **The three ART_ICONS buttons on the menu become one visual family:** gear, speaker and moon/sun, all circles.
   With today's glyphs, the text gear ⚙︎ reads close to the Ink Night ☀ glyph beside it (W7-04 concern 1). The icon
   set removes that. The `#` grid toggle also becomes a circle, because every HeaderButton does.
5. **Screen-reader names.** With ART_ICONS on, the back, hint, sound and theme buttons keep their old glyph labels as
   accessible names (`‹`, `💡`, `♪`, `☾`). In OFF, TalkBack reads the same glyph text, so this is not a regression. It
   is a pre-existing accessibility gap and is not an art question. (Evidence: the census "screen-reader-only" column.)
6. **Anomaly, not art (UNVERIFIED cause).** One lose panel of 17 panel captures was **not at rest**: the first ON
   411 Daylight lose take. Both its phase-proof dump and its screenshot (at least 6 s apart, 13.7 s or more after
   the loss) show the panel at 277.7 x 243.4 dp instead of 280.0 x 245.7, with the scrim and panel still
   translucent. That is W2-05's entrance frozen near scale 0.992. A re-take on the same build was at rest
   (`cap/recheck/on-native-day-lost-r2-*`), and the sheet shows the re-take. The panel motion is `META_PANEL_MOTION`
   (W2-05), which is ON in both arms, so an art flag is not implicated by this evidence. `overlayPresence.ts`
   promises a JS backstop settle. Details: `gates/anomaly-lose-panel-not-at-rest.txt` and `gates/panel-width-scan.txt`.

## 3. Word and element census (EXECUTED, `scripts/census519.py`; `census/census-table.md`, JSON in `census/`)

Rules, fixed before the counts were read:
- A **word** is a whitespace token that holds a letter or a digit (W4-10's rule). `·`, ★, ✦, ‹, ♪, ☾, ⚙, 💡 and `#`
  are **glyphs**.
- An **element** is one of:
  - a control (a clickable node);
  - a text node outside a control. An accessible group such as the counter "66 left", drawn as "66" + " left", counts
    as one text node;
  - a graphic (an SvgView or ImageView outside a control);
  - the board;
  - the ad banner (its own words are counted apart).
- On the panels, the header left visible behind the scrim is counted apart.

**The counts are identical across 411/360 dp, Daylight/Ink Night and the 360 dp font-1.3 row for every screen and arm**
(the invariance check is printed at the top of `census-table.md`). The table shows 411 dp Daylight.

| screen | arm | elements (control / text / graphic / other) | visible words | glyph strings | screen-reader-only labels | visible strings |
|---|---|---|---|---|---|---|
| menu | OFF | 13 (6 / 5 / 1 / 1 ad) | 15 (+ ad: 2) | 4: ⚙︎ ♪ ☾ · | `Settings` | `⚙︎` · `♪` · `☾` · `rrows` · `Level 53` · `Normal` · `Play` · `Today's board` · `·` · `Gallery` · `5 puzzles solved · best perfect run 2` |
| menu | ON | 13 (6 / 5 / 1 / 1 ad) | 15 (+ ad: 2) | 1: · | `Settings`, `♪`, `☾` | `rrows` · `Level 53` · `Normal` · `Play` · `Today's board` · `·` · `Gallery` · `5 puzzles solved · best perfect run 2` |
| settings | OFF | 4 (2 / 2 / 0) | 5 | 0 | `Close settings` | `Settings` · `Support` · `ddante.berishaj1@gmail.com` · `Version 1.0.0` |
| settings | ON | 4 (2 / 2 / 0) | 5 | 0 | `Close settings` | same |
| gallery | OFF | 7 (1 / 5 / 1) | 7 | 1: ‹ | `Back` | `‹` · `4 of 26` · `Rectangle` · `Circle` · `Diamond` · `Triangle` |
| gallery | ON | 7 (1 / 5 / 1) | 7 | 0 | `Back` | `4 of 26` · `Rectangle` · `Circle` · `Diamond` · `Triangle` |
| game | OFF | 10 (3 / 3 / 3 / 1 board) | 6 | 3: ‹ 💡 # | `Grid lines` | `‹` · `LEVEL 53` · `Normal · Square ·` · `66 left` · `💡` · `#` |
| game | ON | 12 (3 / 4 / 4 / 1 board) | 5 | 2: · # | `‹`, `💡`, `Grid lines` | `LEVEL 53` · `Normal ·` · [badge] · `·` · `66 left` · `#` |
| daily | OFF | 10 (3 / 3 / 3 / 1 board) | 5 | 3: ‹ 💡 # | `Grid lines` | `‹` · `TODAY` · `Normal · Hourglass ·` · `63 left` · `💡` · `#` |
| daily | ON | 12 (3 / 4 / 4 / 1 board) | 4 | 2: · # | `‹`, `💡`, `Grid lines` | `TODAY` · `Normal ·` · [badge] · `·` · `63 left` · `#` |
| won (panel) | OFF | 7 (1 / 6 / 0); behind: 10 el, 6 words | 13 | 3: ★ ★ ★ | - | `Cleared!` · `★` · `★` · `★` · `Level 53 · Square · 66 arrows` · `Next level` · `✦ 3 perfect in a row` |
| won (panel) | ON | 9 (1 / 3 / 5); behind: 12 el, 5 words | 13 | 0 | - | `Cleared!` · [silhouette] · [3 star icons] · `Level 53 · Square · 66 arrows` · `Next level` · [sparkle] `3 perfect in a row` |
| lost (panel) | OFF | 4 (2 / 2 / 0); behind: 10 el, 6 words | 13 | 0 | - | `Out of hearts` · `The shape got the better of you.` · `Continue +♥ (ad)` · `Retry` |
| lost (panel) | ON | 4 (2 / 2 / 0); behind: 12 el, 5 words | 13 | 0 | `Continue +♥ (ad)` | `Out of hearts` · `The shape got the better of you.` · `Continue +` [heart icon] `(ad)` · `Retry` |

Reading the census:
- The ON set adds **no word on any screen**. It removes one word on the game and daily headers (the shape name) and
  every OS-font glyph except the `·` separators and the `#` toggle.
- It adds **+2 elements on the game and daily headers**: the badge and a second ` · ` separator, where the word
  "Square" used to be one text.
- On the win panel, text glyphs become graphics (3 stars and the sparkle) and **one new element** appears: the
  silhouette.
- The menu, settings sheet and gallery keep their element counts. The ad banner adds its own 2 words ("Test Ad") on
  the menu in both arms.

## 4. The nine W5-20 questions (answer each in writing)

Each question gives its evidence first and then a RECOMMENDATION. "Code value" means what the flag's code does
today when it is ON.

**1. `ART_ICONS_ENABLED`: ship the SVG icon set and circular header buttons? Which stroke: 2 or 2.2 (of 24 units)?**
- Evidence:
  - `artifacts/W5-02/owner-icons.png`: BASE vs ON on every surface, plus the set at stroke 2 and 2.2.
  - This sheet's MENU, GAME and GALLERY rows and the close-ups.
  - W5-02's detectors: the yellow 💡 hint emoji goes from 1060 px to 0, and the red ♥ emoji in Continue from 2509 px
    to 0.
  - The sound-off state becomes a slashed-speaker shape instead of a colour.
- RECOMMENDATION: **yes, at stroke 2** (the code value). It removes two OS-emoji defects and a colour-only state, and
  gives the W7-04 gear an unambiguous icon.
  - Condition from W5-02's own concern: the emulator's idle-menu frame cost was UNCERTAIN, so a phone gfxinfo run of
    the idle menu should go with the flip.

**2. `ART_WIN_SILHOUETTE_ENABLED`: show the cleared shape on the win panel? At 48, 64 or 96 dp?**
- Evidence:
  - `artifacts/W5-04/owner/W5-04-win-panels-sheet.png`: Cat, Ring and Crescent, both themes.
  - `artifacts/W5-01/silhouette-sheet-{48,64,96}dp.png`.
  - This sheet's WON row: +86 dp panel height including set A's spacing. It fits at 360x640, spanning y 142–498 of 640.
- RECOMMENDATION: **yes, at 64 dp** (the code value). It reads as the shape on both themes. 96 dp adds 32 dp more to a
  panel that already grew 86 dp.

**3. `ART_PANEL_DEPTH_ENABLED`: which candidate set: A, B, C or none?**
- Evidence:
  - `artifacts/W5-05/owner-panel-depth.png`: BASE, A, B and C, both themes, won and lost, 411 and 360.
  - This sheet's WON and LOST rows (built with **A**).
- RECOMMENDATION: **yes, set A** (a darker win scrim, black 0.50; the panel fill stays today's `surface`; plus the
  spacing hierarchy).
  - A is the smallest change that fixes the one edge that fails today: Daylight won, 2.90:1 today, 3.46:1 with A.
  - Unlike B and C, A keeps W0-06's disabled-Continue well visible. In B and C the well is 1.05:1 and 1.00:1 against
    the panel (W5-05 concern 2).
  - Ink Night keeps its hairline edge in every set.
  - Note: the code default is **B**. Choosing A means the pick commit sets `surfaceRaised` `#EFEDF8` and `scrimWon`
    `#00000080` in Daylight (exactly `overlay-A/overlay.diff`).

**4. `ART_HEADER_SILHOUETTE_ENABLED`: keep the 15 dp header badge in place of the shape-name word, or kill it?**
- Evidence:
  - `artifacts/W5-06/owner-header-badge.png`.
  - `artifacts/W5-06/sheet/silhouette-sheet-15dp.png`: all 26 shapes at the measured row height.
  - This sheet's GAME and DAILY rows, the 360 dp font-1.3 close-up, and finding 2 above.
- RECOMMENDATION: **keep (yes), with low confidence.**
  - For: the badge fixes a measured overflow today, with the hint button 11.7 dp off-screen at 360 dp and font 1.3
    even on "Square". It costs no board height and removes a word per level.
  - Against: on my eyeball of the 15 dp sheet (INFERRED, not measured), Circle, Octagon, Hexagon and Pentagon read as
    similar polygons, Square and Rectangle are close, Butterfly is a blob and Bolt is a sliver. That is about 8 of 26
    shapes where the word carried information the badge does not.
  - If you judge those unacceptable, kill it. The header overflow then needs its own fix.

**5. Exit-trail resting width: 0.144, 0.18, 0.22 or 0.26 cell (today 0.26)?**
- Evidence:
  - `artifacts/W5-07/owner-trail-width.png`: Cat at fit, Cat zoomed and Star, each candidate at 2 and 6 cells out.
  - `artifacts/W5-07/owner/sbs-*.mp4`: side-by-side real-time recordings.
  - This value is a PERF-only override, so the chrome sheet cannot show it.
- RECOMMENDATION: **0.18, low confidence, and judge it on the x1 recordings rather than the stills.** PRODUCT.md asks
  for arrows "uniform in weight", and 0.26 is 1.81x the resting stroke. At 0.18 (1.25x) the leaving arrow still
  separates from the dense Star field in the stills, while motion does most of the work.

**6. `ART_PAPER_TEXTURE_ENABLED`: menu grain, and at which opacity (0.02, 0.04, 0.06, 0.08), or none?**
- Evidence: `artifacts/W5-14/owner-paper-texture.png`: OFF and the 4 opacities, both themes, with 1:1 crops.
- RECOMMENDATION: **no for now (the flag stays OFF); revisit on a phone.** The reasons:
  - On the emulator the grain is barely there: a luminance std-dev of 1.2 levels at 0.04.
  - Its frame cost cannot be bounded on this host: W5-14's A/A spread is about 10 ms RT median.
  - It shifts the menu's paper tone away from the game and gallery backgrounds (mean −4.4 levels in Daylight at 0.04).
  - The capture builds route the tile through a borrowed host drawable, so its gradle-build tile size is UNVERIFIED.
  - If you want it after a phone look, 0.04 is the code value.

**7. Should the 36 dp game header buttons grow, knowing it costs board height?**
- Evidence:
  - The touch target is already 52 dp (36 + hitSlop 8 each side).
  - `artifacts/W5-03/cap/header-360x780-geometry.txt`: the hint button is 8.0 / 11.3 dp past the edge on Butterfly at
    360 dp.
  - Finding 2 above: 11.7 dp past the edge at 360 dp and font 1.3 on Square.
  - This sheet's GAME row and close-ups.
- RECOMMENDATION: **no.** The row already overflows at 360 dp in the conditions above. Wider buttons make that worse
  and cost board height. The touch target already meets 44 dp.

**8. Should any type size change?**
- Evidence:
  - `src/ui/theme.ts` `Type`: 21 roles, pinned by W5-08 with zero pixel change. The smallest are the game tier line
    and the gallery names at 12, and menu stats and the panel streak line at 13.
  - The census strings above.
  - This sheet's font-1.3 row.
- RECOMMENDATION: **no change in W5-20.** Any growth of the 12 dp mission row adds to the 360 dp header overflow
  (question 7). If a size is changed later, re-run this packet's census and the 360 dp font-1.3 header capture.

**9. `ART_VECTOR_WORDMARK_ENABLED`, `ART_CLEAR_REVEAL_ENABLED`, `ART_DEAD_BAND_ENABLED`**
- These flags do not exist yet: their tasks (W5-12, W5-17, W5-16) are blocked on owner decisions. What can be
  answered now:
  - **Wordmark (W5-12).** Evidence: `artifacts/W5-11/wordmark-options.png` and `docs/art-icon-audit.md`.
    RECOMMENDATION: **keep the shipped two-hue emblem as the canonical "A"**, and correct the wordmark lines in DESIGN.md (W5.md cites DESIGN.md:51-52; the line numbers may be stale). The
    emblem is the launcher identity already in players' app drawers. The flat violet triangle is a different mark.
    With this answer, W5-12 becomes a doc correction and no `ART_VECTOR_WORDMARK` is built. (The options sheet uses a
    fallback sans for "rrows", W5-11 concern 3.)
  - **Dead band (W5-16).** Evidence: `docs/dead-band-decision.md` and `artifacts/W5-15/mocks/*.png`.
    RECOMMENDATION: **option A, keep the space empty.** DESIGN.md says "no bottom bar" twice. W5-16 is then CUT.
  - **Clear reveal (W5-17).** This cannot be asked yet: it needs the W2 post-clear timeline decision first
    (`CLEAR_REVEAL_MS` is 0 in W2-06's timeline). No recommendation.

## 5. Coverage: each landed W5 task's acceptance captures

| task | player-visible? | its acceptance captures (in the packet by reference) |
|---|---|---|
| W5-01 silhouette tracer | no (feeds W5-04/W5-06/W4) | `artifacts/W5-01/silhouette-sheet-{16,24,48,64,96}dp.png` |
| W5-02 icons + circular buttons | flag | `artifacts/W5-02/owner-icons.png`, `cap/{base,off,on}/`; in this sheet (ON) |
| W5-03 counter slot | defect fix, no flag, in both arms | `artifacts/W5-03/owner-counter-base-vs-fix-137.{mp4,png}` (owner yes/no pending: the wider gap before a 2-digit count) |
| W5-04 win silhouette | flag | `artifacts/W5-04/owner/*.png`; in this sheet (WON, ON) |
| W5-05 panel depth | flag | `artifacts/W5-05/owner-panel-depth.png` (A/B/C); set A in this sheet |
| W5-06 header silhouette | flag | `artifacts/W5-06/owner-header-badge.png`, `sheet/silhouette-sheet-15dp.png`; in this sheet (GAME/DAILY, ON) |
| W5-07 trail width | PERF-only override | `artifacts/W5-07/owner-trail-width.png`, `owner/sbs-*.mp4` (not visible in stills) |
| W5-08 type tokens | no pixel change | `artifacts/W5-08/gates/diff508.txt` (0 px); nothing for the owner to see |
| W5-09 dev ad-modal font | dev-only, never in a release bundle | web evidence in `docs/next-level/reports/W5-09.md`; not in the packet because no player can see it |
| W5-11 icon audit + wordmark sheet | no | `artifacts/W5-11/wordmark-options.png`, `launcher-icon-crop.png`, `docs/art-icon-audit.md` |
| W5-14 paper grain | flag | `artifacts/W5-14/owner-paper-texture.png`; not in the ON set (question 6) |
| W5-15 dead-band options | no | `docs/dead-band-decision.md`, `artifacts/W5-15/mocks/*.png` |
| W7-04 settings gear (visible chrome) | flag (META) | `artifacts/W7-04/owner/W7-04-owner-{1..4}*.png`; the sheet, in both arms here |

**Related open owner items (not W5-20 questions):**
- W5-03: accept the fixed counter slot's wider gap before a 2-digit count.
- W7-04: the gear (question 1 settles it if ART_ICONS flips), scrim 0.95, and the flip waits on W7-07's policy URL.

## 6. Reproduce

- Build: `artifacts/W5-19/scripts/repack519.sh <out.apk> <flags> <sources…>` with `flags-off.txt` or `flags-on.txt`.
  For ON: `OVERLAY=artifacts/W5-19/overlay-A … src/ui/theme.ts`.
- Capture: `scripts/caps519.sh off|on`.
- Census: `scripts/census519.py cap/<arm>`.
- Diff: `scripts/diff519.py cap`.
- Sheet: `scripts/sheet519.py cap census/census-all.json owner-art-review.png`.
- All paths are under `artifacts/W5-19/` (gitignored).

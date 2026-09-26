# W5-15 — dead-band decision sheet

Task: `task-W5-15-brief.md` plus its controller amendments (F31 ruling, F30, F38). Branch `next-level`.
Tree at start had unrelated uncommitted W3-05 edits (generator-version seam); none of the files this
task touches (`scripts/analysis/dead-band.ts`, this doc) overlap that set. This is a decision aid: no
app behaviour changes, no option is built (W5-16), no option is chosen here.

Tool: `scripts/analysis/dead-band.ts` (new, `npx tsx scripts/analysis/dead-band.ts --from N --to M`, and
`--mocks --daylight <png> --ink-night <png> --out-dir <dir>` for the mock sheet). Raw evidence:
`artifacts/W5-15/` (gitignored).

## Emulator collision with W2-09 (disclosed per the controller's note)

**Another agent (W2-09) was driving `emulator-5556` at the same time as this task**, a dispatch error
the controller has since confirmed and corrected. Timeline, reconstructed from `adb`/`logcat` evidence
and the controller's message:

- Before 16:02: `com.danteb.arrows` was `artifacts/W4-11/apk/arrows-testads-W4-11.apk` (sha256
  `dac06858…`). This task's launcher-icon work (W5-11) and its own first menu screenshot were taken
  in this window (15:49-16:00) and are unaffected.
- 16:02:03-16:02:04: W2-09 uninstalled W4-11 (wiping app data) and installed its own
  `artifacts/W2-09/apk/w209-off.apk` (confirmed EXECUTED: `dumpsys package com.danteb.arrows` reports
  `firstInstallTime=2026-09-26 16:02:04`; `pm path` + `sha256sum` on the installed base.apk matches
  `w209-off.apk`'s own sha256 `3c454801…` exactly).
- My `--from`-less first attempt to seed `arrows_current_level=109` and launch landed on the just-swapped
  app: the app's telemetry install id changed between my two `sqlite3` reads (`343245291/132977950` at
  15:49 vs `1862659585/2005021566` at 16:02), which only happens on a fresh install. The first screenshot
  after that launch was a garbled partial render (`artifacts/W5-15/menu-360x780.png`), and `logcat`
  shows a **second, external** `am force-stop` at 16:02:51.707 from a pid that was not mine — W2-09's own
  report (`docs/next-level/reports/W2-09.md`) independently confirms it was also fighting for the same
  device at the same time and stopped for exactly this reason.
- The controller's note: W2-09 has now stopped touching the emulator; I had it exclusively from that
  point to finish this task.

**Consequence for this task's real capture:** `artifacts/W5-15/board-109-{daylight,inknight}-360x780.png`
were captured under **`w209-off.apk`, not W4-11**. I did not reinstall W4-11 myself (this task's
dispatch, unchanged: install nothing). Instead I checked whether that substitution could have changed
what these two screenshots show, with evidence rather than by assuming the controller's "nothing
player-visible changed at rest" line covers the *game* screen (it was stated about the *menu*):

- `w209-off.apk`'s own build log (`artifacts/W2-09/apk/w209-off.apk.env.txt`) records it as a **JS-only
  repack whose native host is `arrows-testads-W4-11.apk` itself** — the two APKs share one native build,
  so every baked launcher/adaptive-icon asset is byte-identical between them (moot for W5-15, relevant
  to W5-11's launcher capture, which used the pre-collision APK anyway).
  Both env files list the **same feature-flag set and values**, including `EXPO_PUBLIC_META_ZOOMED_CAMERA=1`
  (see "Which camera the numbers model" below).
- `git diff e9e9950…(W4-11's build commit) f32a5493…(w209-off's build commit) -- src/ui/GameScreen.tsx`
  (EXECUTED, read in full): the only changes are the W4-11 store-review-prompt state/effect/callbacks and
  `createLevelSession(index, revisionRef.current, levelGenVersion(index))` (W3-05's version parameter,
  default behaviour unchanged). **No change touches the header JSX, its styles, or the `<BoardView>`
  element/props.** `src/ui/BoardView.tsx` and `src/ui/boardCamera.ts` do not appear in
  `git diff --stat` between those two commits at all (zero difference).
- Conclusion: the layout code this task measures and photographs is byte-identical between W4-11 and
  `w209-off.apk`. The two real captures are valid evidence; nothing needed to be redone.

**Installed APK as of this report:** `w209-off.apk` (sha256 `3c454801…a22`), the same one W2-09 left
running device-side. I did not reinstall W4-11. `wm size`/`wm density` are reset (no override; native
`1440x3120 @560`) and the three motion scales read back `1 1 1`, unchanged from how I found them.

## Which camera the numbers model (found while capturing; read this before the numbers below)

`src/ui/boardCamera.ts`'s `initialCamera` has two branches. `dead-band.ts` computes the **`!zoomed`
branch** (`cellPt = FIT_MARGIN * min(vw/cols, vh/rows)`), which is the **shipped default**:
`META_ZOOMED_CAMERA` (`src/featureFlags.ts:59`) is `process.env.EXPO_PUBLIC_META_ZOOMED_CAMERA === '1'`,
default OFF. But **every test APK available to this task turns that flag ON** (a "controller extras"
build choice, present in both W4-11's and W2-09's env files) — so the real captures below show the
**zoomed** branch instead: `scale = min(maxScale, max(fit, target))` with
`target = vw / TARGET_CELLS_ACROSS / CELL` (`TARGET_CELLS_ACROSS = 14`). For level 109 (13x20) at
360x780dp this gives an on-screen cell of **25.71dp** (zoomed) vs **16.92dp** (fit/default) — the zoomed
camera fills noticeably more of the screen and shows a **smaller** dead-band than a real player on the
shipped default ever sees.

Both numbers are reported below, reconciled against the same real capture, rather than picking one
silently:

| | per-side vertical slack, level 109, 360x780dp (adjusted/on-screen geometry) |
|---|---:|
| **Computed, shipped default** (`dead-band.ts`, `!zoomed` branch, what a real player sees) | **206.52dp** |
| **Measured on the real capture** (`zoomed` branch, this test build only) | **149.7-150.0dp** (pixel-scan, below) |

I could not capture the shipped-default camera on a real device without a new build (`EXPO_PUBLIC_*` is
inlined at bundle time, not toggleable via `sqlite3`, and this task may not run a native build or
reinstall). **The computed, shipped-default number is the one to use for the decision** — the real
photos still show a large, unmistakable dead-band even under the flag that shrinks it.

## Script output (EXECUTED, `npx tsx scripts/analysis/dead-band.ts --from 0 --to 500`, run twice, byte-identical stdout — the acceptance criterion)

The script reads the three geometries verbatim from `docs/board-viewport-measured.md` and prints both
that doc's raw "Logged viewport (dp)" numbers and its UIAutomator-cross-checked "adjusted" numbers (see
the script's own header comment for why both are shown). Headline table, **adjusted** (on-screen) numbers,
501 generated levels (index 0-500):

| geometry | min slack/side | median slack/side | max slack/side | worst level |
|---|---:|---:|---:|---|
| native `411.43x891.43dp` (`1440x3120@560`) | 116.52dp | 184.77dp | 252.45dp | index 109, Rectangle 13x20 |
| **1080x2340@480 (360x780dp) — the capture geometry** | **87.58dp** | **147.30dp** | **206.52dp** | **index 109, Rectangle 13x20** |
| 1080x1920@480 (360x640dp) | 17.58dp | 77.30dp | 136.52dp | index 109, Rectangle 13x20 |

**The same level (109, a 13x20 "Rectangle") is the worst level at all three geometries** in this range —
not a coincidence unique to one screen size. **Even the *best* level in 0-500 leaves 17.6-116.5dp of dead
space per side**, depending on geometry: there is no sampled level, even at the smaller phone size, that
comes close to filling the viewport vertically. `docs/board-viewport-measured.md`'s own logged (raw,
un-adjusted) numbers give the same qualitative picture, a few dp larger per side (printed by the script;
not reproduced here to avoid a wall of near-duplicate numbers — full stdout is not saved verbatim per the
"keep outputs small" instruction, but is trivially reproducible: the acceptance criterion is that it is
byte-identical across runs, checked above).

## Real capture

`emulator-5556`, API 31, `w209-off.apk` (see collision section), scales `1 1 1` throughout, `wm size
1080x2340` / `wm density 480` (360x780dp), reset after capture. Level index 109 seeded directly
(`arrows_current_level=109` via `su 0 sqlite3` on `RKStorage`, the same technique P-02's and W4-10's
reports used) rather than played to, since solving 109 boards is out of scope; **restored to the
pre-existing fresh-install state afterward** (`DELETE … WHERE key IN ('arrows_current_level',
'arrows_dark_mode')`) — with one disclosed exception below.

- `artifacts/W5-15/board-109-daylight-360x780.png`
- `artifacts/W5-15/board-109-inknight-360x780.png` (`arrows_dark_mode=1`, same level, same geometry)

I looked at both: a large, visually obvious empty band above the header-to-first-arrow-row gap and
another below the last-arrow-row-to-toggle-button gap, in both themes, exactly as the computed numbers
predict (scaled down by the zoomed-camera flag, above).

**Minor emulator-state side effect, disclosed rather than hidden:** setting `arrows_current_level=109`
directly made the app's own collection-folding logic (`SaveSystem`, "Folds campaign levels
[shapesThroughLevel, currentLevel)…") run on next boot, writing `arrows_shapes_seen_lo` and
`arrows_shapes_through_level=109`. I attempted to delete those two keys as well to fully restore the
pristine fresh-install state; the harness's own auto-mode permission classifier blocked that second
`DELETE` as "Irreversible Local Destruction" and told me to disclose rather than retry. `currentLevel`
and `darkMode` (the two keys this task actually needed) are removed; those two collection-bookkeeping
keys are left set. They affect only this local emulator's `com.danteb.arrows` app data, not the repo, and
a future reinstall or `su sqlite3` `DELETE` clears them.

### How the overlay boxes were measured

Not guessed: a per-row maximum colour-distance-from-background scan of
`board-109-daylight-360x780.png` (every pixel, full height), at two thresholds to tell the faint
board-grid dots (max channel-sum distance ~90-120) from the bold arrow ink (~680) and the header/toggle
controls (~300-460):

| landmark | y (px, 1080x2340) | how |
|---|---:|---|
| header bottom | 253 | last row with distance > 150 in y ∈ [0,349] |
| board container top | 273 | `docs/board-viewport-measured.md`'s own UIAutomator bounds for this exact override |
| first arrow-ink row | 722 | first row with distance > 500 in y ∈ [350,2339] |
| last arrow-ink row | 1722 | last row with distance > 500 in y ∈ [350,2339] |
| board container bottom / nav bar top | 2172 | `docs/board-viewport-measured.md` (2340 - 168px inset) |
| "#" grid-toggle button (existing, `BOARD_GRID_ENABLED`) | x 900-1060, y 2000-2150 | direct crop + look (`/tmp/toggle-crop.png`, not saved: a scratch file) |

Top slack (visual) = 722 - 273 = 449px = **149.7dp**. Bottom slack = 2172 - 1722 = 450px = **150.0dp**.
This matches the independently-computed zoomed-camera prediction (149.35dp, "Which camera" above) to
within 0.4dp — cross-checked, not just asserted.

## The four mock options

`artifacts/W5-15/mocks/{A,B,C,D}-*-{Daylight,InkNight}.png`, 8 files, each composited over the real
capture above and stamped **"MOCK -- not rendered by the app"** in an opaque banner at the top (covering
only the status bar, never the app's own header). I looked at all 8 before finishing; two placement bugs
were caught and fixed at that point (below).

| # | option | what it shows | DESIGN.md lines it contradicts |
|---|---|---|---|
| **A** | Today (unchanged) | The real capture, stamped like the others for uniformity (the brief's acceptance criterion asks for 4 options x 2 themes, all stamped) but not itself a design change. | None — matches DESIGN.md as written. |
| **B** | 2px-high progress rail, bottom band | A hairline track + fill near the very bottom, clear of the "#" toggle. **Drawn at 6px in the mock for legibility; the spec value is 2px** (disclosed in the mock's own label) — an intentional exaggeration for a screenshot, not a silent scope change. Fill fraction (42%) is illustrative only; no real progress metric is wired to it. | `DESIGN.md:107` "No divider, no bottom button bar." / `DESIGN.md:312` "…then the board filling the rest of the screen, fit-to-view … No bottom bar." A hairline rail is a much lighter touch than a "button bar", but it is still a persistent bottom-anchored UI element these lines rule out literally. |
| **C** | Header split into a top and a bottom band | Hearts + hint button erased from the top-right and redrawn in a new bottom band (schematic icons, not the app's real assets); back button + "LEVEL N / difficulty" stay in the existing top header. 4 elements total, same as today, 2 top / 2 bottom. | Same two "no bottom bar" lines as (B), more directly: this option **is** a second header-like band. Also touches `DESIGN.md:17` ("the game screen is nothing but the arrows, the header … and two floating round-cornered buttons") — now there would be two header-like rows. |
| **D** | Hint button relocated to a single floating circle, bottom-left | Hint erased from the top-right header; a new floating round button (schematic bulb icon) bottom-left, clear of the existing bottom-right "#" toggle. | Weakest contradiction of the four: `DESIGN.md:17` already describes "two floating round-cornered buttons," and the app already has a precedent for an independently-floating round control over the board (the existing "#" grid toggle, `GameScreen.tsx`'s `gridToggle`, positioned by `insets.bottom + GRID_TOGGLE_INSET_PT` rather than in the header row). Relocating the hint button the same way is consistent with an existing pattern, not a new one. |

**Bugs caught and fixed before finishing** (disclosed per the verification-honesty rule, not swept
under the rug): the first render of option C placed the new "bottom" band 18px below the *top* dead zone
(`TOP_DEAD_ZONE.bottom`, a copy-paste mistake), which visually overlapped the board's first row of tall
arrow glyphs and its own caption text overlapped the board below it. Fixed by anchoring it to
`BOTTOM_DEAD_ZONE.top` instead (`scripts/analysis/dead-band.ts`'s `buildOptionC`) and re-rendered; the
committed images are the corrected ones. I looked at the corrected renders (all 8) before writing this
doc.

Caveat on the mock art: hearts and the hint bulb are simplified vector stand-ins (an SVG path heart, a
circle+rect bulb), not the app's actual icon assets — sufficient to judge *placement*, not final visual
quality.

## The question for the owner

**Given the board leaves 87.6-206.5dp of empty vertical space per side even at the shipped default
camera (never less, across 501 sampled levels, at every phone size checked) — do you want to keep that
space empty (Option A, matching DESIGN.md's explicit "no bottom bar" / "no divider" lines as written), or
does one of the alternatives (B: a subtle progress rail, C: split the header into two bands, D: float the
hint button lower) look worth building (W5-16) once you've seen the mocks?**

**Recommendation: A, unless you see a reason in the mocks** (per the brief's own instruction) — DESIGN.md
is explicit and repeated ("No bottom bar" appears twice, independently, at both the Theme and Layout
sections) that this space is deliberate. The one fact that might change that call: the measured minimum
is not a rare worst case — it is the *best* case across 501 levels at the smallest phone geometry
(17.6dp/side) and a *large, typical* case everywhere else (77-185dp/side, median). This is a
brand-airiness-vs-legibility judgement call from a picture, exactly the kind of decision this sheet
exists to hand to you rather than make for you (Non-goal: this task does not choose).

## Decisions (routine calls, recorded)

1. **Level range 0-500** for the script's own demonstration run (`--from`/`--to` are free parameters;
   the acceptance criterion is determinism and printing inputs, not a specific range). 501 levels gave a
   stable, reproducible worst level (109) at every geometry without an excessive runtime (~11s).
2. **Adjusted (UIAutomator-cross-checked) viewport numbers, not the raw "Logged viewport (dp)" table,
   are the headline numbers** in this doc, though the script prints and the doc's own table shows both.
   `docs/board-viewport-measured.md` itself flags the raw log height as inflated by a system-bar-inset
   quirk it does not apply to BoardView's actual on-screen size; the adjusted numbers are the ones
   confirmed against real UIAutomator bounds (PASS, <=1dp agreement, all three rows). Using the inflated
   raw number would overstate the dead-band.
3. **Mock overlay elements are schematic** (simple SVG shapes), not the app's real icon assets, per the
   brief's Non-goal ("Building any option") — these mocks compare *placement*, not production art.
4. **`--mocks` was added to `dead-band.ts` itself** rather than as a second throwaway script, so every
   pixel this doc cites comes from one committed, type-checked tool (`npx tsc --noEmit` covers it) instead
   of an undocumented one-off.

## Non-goals honoured

No option was built (W5-16). No option was chosen (the recommendation above is a default per the brief's
own instruction, not a decision). `docs/board-viewport-measured.md`, `DESIGN.md` and every layout file
this task reads were not edited.

## Gates

- `npx tsx scripts/analysis/dead-band.ts --from 0 --to 500`, run twice: byte-identical stdout (EXECUTED).
- `npx tsc --noEmit`: exit 0 (EXECUTED, covers this file; see also the W5-11 report for the shared run).
- `npx tsx scripts/analysis/dead-band.ts --mocks …`: exit 0, 8 files written, each opened and looked at
  (EXECUTED); one placement bug found and fixed before the final render (above).

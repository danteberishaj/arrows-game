# A11Y-LABELS report: icon buttons are named in words, with their state

- **Status:** DONE.
- **Branch / base:** `next-level`, BASE = `c670f1b`, after PANEL-STUCK in the series (patch 2 of
  `artifacts/A11Y-LABELS/snapshot/`). No commits.
- **Device:** `emulator-5556`, 1440x3120 @560, font scale 1.0; captures at animation scales 0 (the breathing Play pill
  otherwise never lets uiautomator idle, and a still frame makes the pixel diff exact), put back to 1/1/1 after.
- **Evidence root:** `artifacts/A11Y-LABELS/` (gitignored).

## Before (EXECUTED, uiautomator `content-desc` on BASE builds)

| control | ART_ICONS on | ART_ICONS off |
|---|---|---|
| game back | `‹` (ViewGroup, no role) | `‹` (text child) |
| hint | `💡` | `💡` |
| menu theme | `☾` / `☀` | `☾` / `☀` |
| menu sound | `♪` (no state) | `♪` |
| lose panel Continue | `Continue +♥ (ad)` (W5-19 dumps) | `Continue +♥ (ad)` (its text; INFERRED from source, not dumped) |
| Settings, Grid lines, gallery Back | already words | already words |

A screen reader speaks these as character names ("single left-pointing angle quotation mark", "electric light bulb",
"eighth note", "black heart suit"; INFERRED, TalkBack itself was not run). Sound and theme exposed no on/off state at all.

## Change

| file | change |
|---|---|
| `src/ui/HeaderButton.tsx` | `accessibilityLabel` is **required** (tsc now rejects a HeaderButton without a name) and is always the name in both arms (the glyph is never a fallback); `accessibilityRole` defaults to `'button'`. |
| `src/ui/GameScreen.tsx` | back = "Back", hint = "Hint" (its existing `disabled` state = hint unavailable), Continue = button "Continue with one more heart (ad)" in both arms (disabled while no rewarded ad is ready, as before). |
| `src/ui/HomeScreen.tsx` | theme = switch "Dark mode" (`checked` = Ink Night), sound = switch "Sound" (`checked` = on). |
| `src/ui/contrastAudit.ts`, `DESIGN.md` | line sites / citations re-mapped only (`artifacts/A11Y-LABELS/scripts/remap-citations.py`: 202 citation ends re-pointed, target text EQUAL for all; 2 whose target line was edited mapped by hand). |
| tests | new `a11yLabels.test.tsx`; `ArtIcons.test.tsx` and `PressScale.test.tsx` pass the now-required label, and ArtIcons' three "the glyph is the label" assertions now assert the words; the two flag-OFF menu snapshot files updated. |

Labels are `// OWNER-PICKED STARTING VALUE` constants. "Back" matches the gallery's existing name. Continue keeps the
visible words and says the heart in words.

## TDD (EXECUTED)

- **RED** (`tdd/red.txt`): `a11yLabels.test.tsx` 16 failed, 2 passed (the gallery's Back was already right).
- **GREEN** (`tdd/green.txt`): the new file 18 / 18 (both arms: menu dark x sound, game header hint ready / not ready and
  the Grid lines switch toggling, lose panel ad ready / not, gallery; and on every screen no accessible element named
  by a glyph); ArtIcons, PressScale, the two HomeScreen snapshot suites and contrast: 322 / 322, 10 snapshots.
- **Snapshot change is a11y-only** (`tdd/snapshot-diff.txt`, EXECUTED): the only differing lines are
  `accessibilityLabel="Dark mode" / "Sound"`, `accessibilityRole="switch"` and `checked: undefined → true/false` (20 of
  each kind across the 10 snapshots); no style, layout or text line.

## Device (EXECUTED)

`scripts/a11ycap.mjs`: seed LEVEL 53, day (sound on) and night (sound off); menu dump + screencap; Play; wait until the
hint is enabled (a hint TEST ad is ready, same state in both builds); game dump + screencap.

ART_ICONS **on** (W5-19 ON flag set): before = `c670f1b` diag build `b454bff1…` (its menu and game header are
`c670f1b`'s; only the panel code differs), after = the round-1 PANEL-STUCK final build `d4f4ead6…` (this task's code; PANEL-STUCK's later change touches only the
panel):

```
before day   menu: Button:"Settings" ViewGroup:"♪" ViewGroup:"☾" ...   game: ViewGroup:"‹" ViewGroup:"💡" Switch:"Grid lines"[checked=false]
after  day   menu: Button:"Settings" Switch:"Sound"[checked=true] Switch:"Dark mode"[checked=false] ...   game: Button:"Back" Button:"Hint" Switch:"Grid lines"[checked=false]
after  night menu: Button:"Settings" Switch:"Sound"[checked=false] Switch:"Dark mode"[checked=true] ...  game: Button:"Back" Button:"Hint" ...
```

ART_ICONS **off** (PERF-DEADTAG's flag set + META_THEME_TRANSITION / META_SETTINGS_SHEET / CAPTURE_DIAG,
`artifacts/FINAL-FIX-DEVICE/scripts/flags-ff.txt`): before = `ff-04.apk` `55f414f9…` (`c670f1b` + FINAL-FIX logging
overlay), after = `apk-off.apk` `8c007e50…` (the working tree, same flags; both deleted after use):

```
before day   menu: Button:"Settings" ViewGroup:"♪" ViewGroup:"☾" ...   game: ViewGroup:"‹" ViewGroup:"💡" Switch:"Grid lines"[checked=false]
after  day   menu: Button:"Settings" Switch:"Sound"[checked=true] Switch:"Dark mode"[checked=false] ...   game: Button:"Back" Button:"Hint" Switch:"Grid lines"[checked=false]
after  night menu: Button:"Settings" Switch:"Sound"[checked=false] Switch:"Dark mode"[checked=true] ...  game: Button:"Back" Button:"Hint" ...
```

Gallery (ON arm, final build): `Button:"Back"` (unchanged, `dumps/on-after-gallery.xml`).

Masked pixel diff (`scripts/maskdiff.py`; mask = status bar y < 140 px and every WebView = the live TEST banner):

| arm | screen | theme / sound | differing px outside the mask |
|---|---|---|---|
| ON | menu | day / on | **0** |
| ON | game header + board | day / on | **0** |
| ON | menu | night / off | **0** |
| ON | game header + board | night / off | **0** |
| OFF | menu | day / on | **0** |
| OFF | game header + board | day / on | **0** |
| OFF | menu | night / off | **0** |
| OFF | game header + board | night / off | **0** |

(`diff/on-arm-maskdiff.txt`, `diff/off-arm-maskdiff.txt`; full-resolution 1440 x 3120 screencaps at animation scale 0.)

Lose panel, final build: `Button:"Continue with one more heart (ad)"` enabled with a TEST ad ready
(`dumps/a11y-lost1-1.xml`) and `enabled="false"` with the radios off (`artifacts/PANEL-STUCK/loops/final-lost-noad5-1.xml`).

## Gates (EXECUTED, final tree)

- `npx jest`: **114 suites, 1920 tests passed, 12 snapshots** (`artifacts/A11Y-LABELS/gates/jest.txt`); includes
  PANEL-STUCK's tests (same tree). `npx jest --selectProjects ui`: 36 suites, 344 tests.
- `npx tsc --noEmit`: exit 0.
- Contrast audit (`npx tsx scripts/contrast-audit.ts`, touched: line sites only): 144 gated rows, 0 FAIL;
  `contrast.test.ts` 239 / 239 ("every usage row names a real site" re-resolved).

## Concerns

- Not in scope and unchanged: the win stars (`★` text when ART_ICONS is off) and the `✦` streak line are not controls
  but a screen reader that stops on them reads the glyph names; the header heart pips are not exposed at all.
- Capture harnesses that look controls up by the old glyph names (`'💡'` in W5-19's `cap519.mjs`) need the new names
  ("Hint") on builds from this patch on.

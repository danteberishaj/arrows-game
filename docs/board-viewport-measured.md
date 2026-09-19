# Board viewport measurement

**W1-01 status: BLOCKED on the required UIAutomator agreement.** The React Native layout values
were measured successfully, but Android's accessibility hierarchy clips the board node at the
three-button navigation bar while React Native lays the board behind that bar. The raw height
differences are 48 dp at native density and 56 dp at density 480, not the required <= 1 dp. The
logged values and derived ceilings below are valid outputs of `BoardView.onLayout`, but this document
must not be treated as a closed UIAutomator cross-check until the controller resolves that mismatch.

## Measurement scope

- EXECUTED: source base commit `d8960aa0c4f14aea7de4642b8ddaa0179e6797a4`, plus the W1-01
  diagnostic-only `BoardView.onLayout` log. The header source itself was unchanged by W1-01.
- EXECUTED: one `fleet_floor_api31` emulator, Android API 31, for all three rows. The two 1080 px
  geometries are `wm` overrides on that same emulator, not additional devices.
- EXECUTED: all three animation scales were set and read back as `0/0/0` before each dump so
  UIAutomator could reach idle. Reanimated reported `perf-reduced-motion-1`; this changes motion,
  not Yoga layout.
- UNVERIFIED-DEVICE: physical Android and iOS phones, including notches, cutouts, gesture-navigation
  insets, and manufacturer-specific system bars.

The brief calls native `1440x3120 @560` a `514x1114 dp` screen. That parenthetical is arithmetically
inconsistent with the specified density: `densityScale = 560/160 = 3.5`, so the literal geometry is
`411.429x891.429 dp`. The raw `wm` values and measured layout are retained here rather than changing
density to fit the parenthetical.

## Literal measurements and UIAutomator cross-check

`UI board` is the `resource-id="perf-board"` node's literal pixel bounds divided by
`density/160`. `Delta` is `logged - UI board`. The UI root ends 168 px above the physical screen
bottom at every geometry, exactly where the three-button navigation bar begins.

| Geometry (same API 31 emulator) | Literal log `[board-viewport]` (dp) | Header height (dp) | UIAutomator `perf-board` bounds (px) | UI board from bounds (dp) | Delta (dp) | Agreement |
|---|---:|---:|---:|---:|---:|---|
| Native `1440x3120 @560` (`411.429x891.429 dp`) | `w=411.4285583496094 h=804.2857055664062` | `87.143` (`305/3.5`) | `[0,305][1440,2952]` | `411.429x756.286` | `0x48.000` | **FAIL** |
| Override `1080x2340 @480` (`360x780 dp`) | `w=360 h=689` | `91` (`273/3`) | `[0,273][1080,2172]` | `360x633` | `0x56` | **FAIL** |
| Override `1080x1920 @480` (`360x640 dp`) | `w=360 h=549` | `91` (`273/3`) | `[0,273][1080,1752]` | `360x493` | `0x56` | **FAIL** |

- EXECUTED: raw logcats are `artifacts/W1-01/native-logcat.txt`,
  `artifacts/W1-01/360x780-logcat.txt`, and `artifacts/W1-01/360x640-logcat.txt`.
- EXECUTED: raw hierarchies are `artifacts/W1-01/native-ui.xml`,
  `artifacts/W1-01/360x780-ui.xml`, and `artifacts/W1-01/360x640-ui.xml`.
- EXECUTED: screenshots are `artifacts/W1-01/native.png`, `artifacts/W1-01/360x780.png`, and
  `artifacts/W1-01/360x640.png`.
- INFERRED from the exact 168 px clipping and the visible three-button bar in every screenshot:
  UIAutomator reports the visible intersection of the accessible node, not the full Yoga layout
  rectangle that `onLayout` reports. No correction was applied to the raw UI values.

## Cell-size formula and ceilings from the logged values

`BoardView` uses `CELL = 40` and `FIT_MARGIN = 0.94`:

```text
fit = min(vw / (cols * CELL), vh / (rows * CELL)) * 0.94
cellPt = CELL * fit = 0.94 * min(vw / cols, vh / rows)

maxCols(floor) = floor(0.94 * vw / floor)
maxRows(floor) = floor(0.94 * vh / floor)
```

These ceilings intentionally use the literal logged `vw` and `vh`, as the task requires. A board
at both maxima simultaneously meets the selected floor on both axes.

| Logged viewport (dp) | Floor | Largest rows | Largest cols | Substitution |
|---|---:|---:|---:|---|
| Native `411.428558x804.285706` | **48 dp** | **15** | **8** | `floor(0.94*804.285706/48)=15`; `floor(0.94*411.428558/48)=8` |
| Native `411.428558x804.285706` | 44 pt reference | 17 | 8 | `floor(0.94*804.285706/44)=17`; `floor(0.94*411.428558/44)=8` |
| `360x689` | **48 dp** | **13** | **7** | `floor(0.94*689/48)=13`; `floor(0.94*360/48)=7` |
| `360x689` | 44 pt reference | 14 | 7 | `floor(0.94*689/44)=14`; `floor(0.94*360/44)=7` |
| `360x549` | **48 dp** | **10** | **7** | `floor(0.94*549/48)=10`; `floor(0.94*360/48)=7` |
| `360x549` | 44 pt reference | 11 | 7 | `floor(0.94*549/44)=11`; `floor(0.94*360/44)=7` |

The floor values are **SOURCED CONSTANTS**, not measurements of Arrows players or of this app's tap
accuracy. Android's accessibility guidance recommends at least `48x48 dp` touch targets, so W1 uses
48 dp: <https://developer.android.com/guide/topics/ui/accessibility/apps>. Apple's accessibility
guidance lists a 44x44 pt default control size, retained here only as the requested reference:
<https://developer.apple.com/design/human-interface-guidelines/accessibility>. The shipped
`TAP_RADIUS_PT = 22` is half of 44; it is not evidence that a 44 pt tutorial cell is sufficient.

## Instrument calibration

- EXECUTED: `npx tsx scripts/analysis/ftue-board-metrics.ts --level 0` printed
  `level 0 rows 20 cols 20 arrows 60 clearable 19 (31.7%)`, followed by all 60
  `remaining:legal` states of its greedy solve (`artifacts/W1-01/ftue-level-0.txt`).
- EXECUTED: `npm run analysis:probe -- --version 1 --levels 1-1` independently printed level 1,
  index 0, `20x20`, 60 arrows, 19 clearable, and 31.7%
  (`artifacts/W1-01/w3-probe-level-1.txt`).
- INFERRED: `--tutorial T1|T2` is wired through an optional `src/core` export and will measure those
  boards after W1-02 adds `buildTutorialLevel`. W1-01 does not invent tutorial data or choose sizes.

## Re-measurement trigger

Per ruling F31, any later header change requires rerunning all three log/UI captures and rechecking
W1-02, W3-08, W5-06, and W5-15 against the new values. The measured header was 87.143 dp at the
native density and 91 dp at both density-480 overrides on base commit `d8960aa`.

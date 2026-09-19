# Board viewport measurement

**W1-01 status: COMPLETE.** The raw React Native layout includes the three-button navigation-bar
area, while Android's accessibility hierarchy clips the board node to the visible app area. Per the
controller's fix-round-1 ruling, the cross-check compares that same visible area on both sides. Once
the device-reported system-bar inset is removed from the raw logged height, all three geometries
agree with UIAutomator within 1 dp.

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

The measured native geometry is `1440x3120 @560`, or `411.43x891.43 dp`, because
`densityScale = 560/160 = 3.5`. The brief's native-dp parenthetical is wrong. Consumers, including
W1-02, W1-04, and W3-08, must use the measured `411.43x891.43 dp` geometry rather than copying that
parenthetical.

## Literal measurements and UIAutomator cross-check

`Raw UI board` is the `resource-id="perf-board"` node's literal pixel bounds divided by
`density/160`. The system-bar inset is read from `dumpsys window displays` as
`cur height - app height`; at native geometry `cur` equals `init`. The adjusted comparison subtracts
that inset from the raw logged height, leaving the same visible area that UIAutomator reports.

| Geometry | API | Raw log `w x h` (dp) | Raw UIAutomator bounds (px) | Raw UI board `w x h` (dp) | Measured inset | Adjusted comparison (dp) | Agreement |
|---|---:|---:|---:|---:|---:|---:|---|
| Native `1440x3120 @560` (`411.43x891.43 dp`) | 31 | `411.428558x804.285706` | `[0,305][1440,2952]` | `411.428571x756.285714` | `3120-2952=168 px = 48 dp` | log visible `411.428558x756.285706` vs UI `411.428571x756.285714`; max delta `0.000013` | **PASS** |
| Override `1080x2340 @480` (`360x780 dp`) | 31 | `360x689` | `[0,273][1080,2172]` | `360x633` | `2340-2172=168 px = 56 dp` | log visible `360x633` vs UI `360x633`; delta `0` | **PASS** |
| Override `1080x1920 @480` (`360x640 dp`) | 31 | `360x549` | `[0,273][1080,1752]` | `360x493` | `1920-1752=168 px = 56 dp` | log visible `360x493` vs UI `360x493`; delta `0` | **PASS** |

- EXECUTED: fix-round-1 raw logcats, `dumpsys window displays` output, UI hierarchies,
  screenshots, command output, and restoration proof are under `artifacts/W1-01/fix1/`.
- EXECUTED: every `dumpsys window displays` row reports the same 168 px difference between `cur`
  and `app`, and every screenshot shows the three-button navigation bar in that strip.
- EXECUTED: the adjusted comparisons pass the <= 1 dp acceptance threshold at all three
  geometries; no adjustment was made to the raw values recorded above.

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
  `remaining:legal` states of its greedy solve
  (`artifacts/W1-01/fix1/instrument-calibration.txt`).
- EXECUTED: `npm run analysis:probe -- --version 1 --levels 1-1` independently printed level 1,
  index 0, `20x20`, 60 arrows, 19 clearable, and 31.7%
  (`artifacts/W1-01/fix1/instrument-calibration.txt`).
- EXECUTED: `--tutorial T1` exits with `unavailable until W1-02 exports buildTutorialLevel`
  (`artifacts/W1-01/fix1/tutorial-dormant.txt`). The T1/T2 metrics stay dormant until W1-02 exports
  those boards; W1-01 does not invent tutorial data or choose sizes.

## Re-measurement trigger

Per ruling F31, any later header change requires rerunning all three log/UI captures and rechecking
W1-02, W3-08, W5-06, and W5-15 against the new values. The measured header was 87.143 dp at the
native density and 91 dp at both density-480 overrides on base commit `d8960aa`.

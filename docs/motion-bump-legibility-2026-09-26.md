# Blocked lunge on screen: measured vs predicted pixels (W2-10, 2026-09-26)

Measurement only: `blockedBumpAt`, `BLOCKED_BUMP_AMPLITUDE_CELLS` and `BLOCKED_BUMP_MS` are unchanged. The question
for the owner (W2-11) is per condition: **does this read as a deliberate lunge? yes / no.**

## Setup

- Build: `artifacts/W5-06/apk/w506-on.apk` (sha256 `c1e168b7…`) = the HEAD `32594e7` JS with the 2026-09-24 test
  flag set (zoomed camera, dot grid, screen-edge exits, missed mark, test ads) + `ART_*_SILHOUETTE`; installed with
  `adb install -r`. Nothing was rebuilt for this measurement.
- Device: `emulator-5556`, API 31, 1440x3120 @560 (3.5 device px per dp), scales `1/1/1` read back before each cold
  launch, app-reported reduced motion `false` (`[capture-diag] perf-reduced-motion-0`), git HEAD `32594e7`
  (`artifacts/W2-10/cap/L*-manifest.json`).
- Levels: campaign index 0 (Circle 20x20, 60 arrows) and the harness level 3827 (Flower 39x39, 250 arrows), seeded as
  the campaign pointer; `[ftue] board_mount 0 … arrows=60 shape=Circle` / `3827 … arrows=250 shape=Flower`.
- Zoom: fit = two pinch-outs clamping at `minScale`; max = two pinch-ins clamping at `maxScale`
  (`boardCamera.ts`: fit = min(vw/boardW, vh/boardH) x 0.94, max = max(fit x 3.5, 64 dp per cell)).
- Taps: 7 `input tap`s per condition on one blocked arrow's head (the first costs the heart and turns the arrow into
  the rose missed mark; the 6 free re-taps are the measurement). Each tap is proven blocked by its `[ftue] blocked`
  line (7/7 in all four conditions). Recorder: `screenrecord` 720x1560 (half the device resolution).
- Scripts: `artifacts/W2-10/scripts/` (`plan210.ts` board model from a `git archive HEAD src` copy, `cap210.mjs`
  driver, `reg210.py` camera registration, `ana210.py` measurement, `owner210.py` owner material).

## Results

Cell px: the camera formula for that zoom, in device px; the board origin at that zoom was MEASURED by registering the
board model on a full-resolution screencap (`reg210.py`, occupancy + stroke connections; agreement vs runner-up
shift). Lunge = the arrow's own cells, ink-weight map, template shift against the rest frame (`ana210.py`
`shift_of`), device px. Sampled-peak prediction = the bump curve at the trial's actual frame times (render start
fitted), i.e. what a perfect instrument would have read from those frames.

| condition | cell px (registration agreement / runner-up) | predicted lunge px (0.2227 cell) | measured lunge px: median (range), n | sampled-peak prediction px | centroid px (secondary) | leading edge px (secondary, 2 px resolution) | predicted stroke px (0.144 cell) | measured stroke px | frames in the 300 ms window vs 0.3 s x rate | recorder Hz |
|---|---|---|---|---|---|---|---|---|---|---|
| index 0, fit | 67.68 (0.985 / 0.889) | 15.07 | **14.50** (14.49-14.53), n=6 | 15.05 | 15.58 | 14.0 | 9.75 | 9.0 | 19 (18-19) vs 18.1 | 60.3 |
| index 0, max zoom | 236.88 (0.923 / 0.746) | 52.75 | **52.45** (51.90-52.55), n=6 | 52.66 | 48.48 | 0.0 (see 3) | 34.11 | 34.0 | 16 (12-18) vs 16.6 | 55.5 |
| 3827, fit | 34.71 (0.982 / 0.937) | 7.73 | **7.75** (7.49-7.78), n=6 | 7.54 | 6.05 | 8.0 | 5.00 | 5.0 | 6 (4-18) vs 17.0 | 56.5 |
| 3827, max zoom | 224.00 (0.884 / 0.788) | 49.88 | **49.76** (49.34-49.85), n=6 | 49.77 | 48.00 | 50.0 | 32.26 | 32.0 | 16 (14-16) vs 16.8 | 55.9 |

In points (dp = device px / 3.5): the lunge is **4.1 pt** (index 0 fit), **15.0 pt** (index 0 max), **2.2 pt** (3827
fit), **14.2 pt** (3827 max); the resting stroke is 2.6 / 9.7 / 1.4 / 9.2 pt. The lunge is 1.55 strokes everywhere, as
predicted, because both scale with the cell.

## Reconciliation (observed vs predicted, every gap > 1 device px explained)

1. **Primary metric: every condition is within 1 device px of the prediction** (largest gap: index 0 at fit, 14.50 vs
   15.07 = -0.57 px, below the recording's 2-device-px pixel). The stroke is within 1 px everywhere (-0.75 px at index
   0 fit, the half-weight width of a 4.5-recording-px stroke).
2. **The centroid reads low by 1.7 px (3827 fit), 1.9 px (3827 max) and 4.3 px (index 0 max)** and high by 0.5 px at
   index 0 fit. Cause: the centroid mask is the arrow's cells GROWN by 0.1 cell plus a 0.35-cell forward box, and
   `arrowGeometry.ts` draws a tail's round end to 0.492 cell past its cell centre (`TAIL_EXT` 0.42 + the 0.072 cap) and
   a head's tip on its cell edge (`TIP_EXT` 0.5). So on these dense boards other arrows' ink is inside the grown mask:
   at 3827 fit the arrow above the U's tail ([13,20] -> [12,20], its tail end touches the shared edge: the full-res
   rest screencap has ink continuously down column 20 from row 12.0 to 15.0), and at index 0 max the blocker directly
   below the head ([11,14], tail at the shared edge) flashes and swells there (visible on
   `artifacts/W2-10/owner/lunge-4-conditions-rest-vs-peak.png`). Static ink in the mask pulls the centroid toward rest.
   The template shift uses only the arrow's own cells without growth, where no other arrow's ink can be, and agrees
   with the prediction.
3. **Leading edge 0.0 at index 0 max:** the flashing blocker's ink sits inside the head's forward box, so the extreme ink
   coordinate there never moves. Elsewhere the leading edge matches (8.0 vs 7.73, 50.0 vs 49.88, 14.0 vs 15.07 at the
   2 px resolution).
4. **Frames in the window:** index 0 and both max-zoom conditions are reconciled (12-19 frames vs 16.6-18.1 expected).
   **3827 at fit is not: median 6 (4-18) frames vs 17.0 expected.** The recorder lost frames in those windows (host
   load 11-16 from other sessions during the run); every trial still had >= 4 frames (above the brief's 3-frame floor),
   and the measured peak matches the prediction (7.75 vs 7.73), so a frame near the 96 ms peak was captured in each.
   The pinned-offset screencap fallback was not needed.
5. **Camera:** with `META_ZOOMED_CAMERA` on, the fit camera centres the board ABOVE the navigation bar (POLISH-T2's
   bottom inset; the origin registered at y = 951 px, 84.6 px above a centring in the full 3120-px layout), so taps
   must come from the registration, not from P-02's full-height `cellCenterForBoard`. The pinch-in did not keep its focal point under this harness's two-pointer injection; the max-zoom targets
   were therefore chosen after registering the zoomed camera (index 0: head (10,14) down; 3827: head (18,26) up), and
   each tap is proven blocked by its log line. Registration agreement 0.88-0.99, runner-up 0.75-0.94.

## Owner verdict (W2-11): given 2026-10-06

Recorded from the owner's answer to `docs/owner-rulings-2026-10-06.md` Q1 (**B: a 4 pt minimum, no pull-back**, given
against `artifacts/OWNER-RULINGS-2026-10-06/q1-lunge-normal-then-4x-slow.mp4`). The rulings doc framed the choice as
"A/B/D read; C = the owner's answer", and offered 6 pt "if A (4.1 pt) also looks too small"; the owner chose 4 pt.

| condition | lunge on screen | owner: reads as a deliberate lunge? |
|---|---|---|
| index 0, fit | 4.1 pt (1.55 strokes) | yes (4 pt chosen over 6 pt) |
| index 0, max zoom | 15.0 pt | yes |
| 3827, fit | 2.2 pt (1.55 strokes of 1.4 pt) | **no**: raised to a 4 pt minimum (W2-11, `META_BLOCKED_ANTICIPATION`; measured 4.01 pt median, `docs/next-level/reports/W2-11.md`) |
| 3827, max zoom | 14.2 pt | yes |

Material: `artifacts/W2-10/owner/lunge-4-conditions-x1.mp4` (real time), `-x4.mp4` (4x slow), and
`lunge-4-conditions-rest-vs-peak.png` (rest vs the measured peak frame, per condition). A "yes" everywhere closes
W2-11 as not needed. UNVERIFIED-DEVICE: legibility on a physical phone at arm's length (the emulator on a Mac display
is a proxy), and the emulator frames are half resolution.

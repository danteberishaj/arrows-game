# iOS board renderer plan

Status: NOT STARTED (written 2026-09-01). Android shipped in commit 0a1df94; iOS
compiles and draws correctly but has never been measured.

## Context (self-contained)

`modules/arrows-board/ios/ArrowsBoardView.swift` renders the static arrow field
by overriding `draw(_:)` on a view whose bounds equal the whole board in points
(`cols * 40` by `rows * 40`, see `CELL` in `src/ui/BoardView.tsx`). The parent
`Animated.View` applies pan/zoom as a transform. UIKit gives a `draw(_:)` view a
backing bitmap of `bounds × screenScale`, so:

| Board            | Points | Pixels @3x | Backing store |
|------------------|--------|------------|---------------|
| 39×39 (level 3827, 250 arrows) | 1560 | 4680² | ~88 MB |
| 46×46 (generator max)          | 1840 | 5520² | ~122 MB |

Every arrow removal calls `setNeedsDisplay()`, redrawing all arrows into that
bitmap and re-uploading it. This is the same ~119 MB failure mode the Android
SVG path was fixed for (see `docs/performance-optimization-knowledge-base.html`).
The exit-animation slots in the same file already use `CAShapeLayer`, which
Core Animation rasterizes in screen space with no board-sized bitmap.

## Goal

Keep the exact JS ↔ native protocol (`geometry`, `visibleMask`, `ink`,
`strokeWidth`, `exitAnimation`) and swap the static drawing from `draw(_:)` to
two retained `CAShapeLayer`s, then measure on a real iPhone with the same gates
Android passed.

## Non-goals

- No change to `ArrowsBoardModule.swift`, the TS bindings, or Android.
- No new protocol (typed buffers, JSI) unless a trace shows parsing matters.
- No visual redesign; arrows must look identical at fit and at max zoom.

## Implementation steps

1. Add two sublayers created in `init`: `staticShaft: CAShapeLayer` (stroke,
   `fillColor = nil`, `lineCap = .round`, `lineJoin = .round`) and
   `staticHead: CAShapeLayer` (fill). Insert them at index 0 and 1 so exit
   containers stay on top. Remove the `draw(_:)` override and
   `contentMode = .redraw`.
2. In `layoutSubviews`, set both layers' `frame = bounds` inside a
   `CATransaction` with `setDisableActions(true)`.
3. In `updateVisibleArrows()`, build one `CGMutablePath` for visible shafts and
   one for visible heads (`addPath` per arrow), assign to `staticShaft.path`
   and `staticHead.path`. Wrap in `CATransaction.begin();
   CATransaction.setDisableActions(true)` — otherwise CAShapeLayer implicitly
   animates `path` for 0.25 s and a removed arrow morphs instead of vanishing.
4. `setInk` / `setStrokeWidth` update `strokeColor` / `fillColor` /
   `lineWidth` on the two static layers (same disable-actions wrapper) instead
   of calling `setNeedsDisplay()`.
5. Delete the now-unused `visibleArrows` draw loop. Keep `arrows` and
   `rawVisibleMask` as they are.
6. Confirm `shouldRasterize` stays `false` on all layers (rasterizing would
   recreate the bitmap problem).

Expected diff size: ~60 lines in one file.

## Acceptance criteria (absolute, checkable by a third party)

- A1 Memory: on iPhone 16 Pro simulator, Release build pinned to level 3827,
  `footprint <pid>` shows no single CoreAnimation/IOSurface/"CG raster data"
  region ≥ 16 MB attributable to the app, and total footprint with the board
  mounted minus footprint with `EXPO_PUBLIC_PERF_EMPTY_BOARD=1` is ≤ 20 MB.
- A2 Frames on a physical iPhone (choose the oldest device you support, e.g.
  iPhone SE 3rd gen or iPhone 11): during a 20-level soak with pan, pinch, and
  taps, Instruments "Core Animation FPS"/"Animation Hitches" shows hitch ratio
  ≤ 10% and p95 frame duration ≤ 20 ms, p99 ≤ 34 ms (same gates as Android).
- A3 Removal cost: tapping an arrow on the 250-arrow board produces no hitch
  > 34 ms in Instruments.
- A4 Visual parity: screenshots at fit and at max zoom (3.5× fit) match the
  current `draw(_:)` build within anti-aliasing; no missing heads, no blurred
  strokes, no arrow briefly morphing on removal (step 3 regression).
- A5 Lifecycle: after 20 levels the footprint trend grows ≤ 10 MB (leak gate).

## Verification method (run at review time)

Prerequisite: ≥ 20 GB free disk. The 2026-09-01 attempt failed with
"No space left on device" (132 MB free).

```bash
# 1. Release simulator build pinned to the dense fixture
EXPO_PUBLIC_PERF_LEVEL=3827 xcodebuild -workspace ios/Arrows.xcworkspace \
  -scheme Arrows -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

```bash
# 2. Install, launch, measure (repeat with EXPO_PUBLIC_PERF_EMPTY_BOARD=1 for the delta)
xcrun simctl boot "iPhone 16 Pro" && xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/Arrows-*/Build/Products/Release-iphonesimulator/Arrows.app \
  && xcrun simctl launch booted com.danteb.arrows && sleep 5 && footprint $(pgrep -x Arrows)
```

3. Physical device: build Release to the device, open Instruments with the
   "Animation Hitches" template, replay the Android soak by hand (or port
   `scripts/perf/android/ArrowsWorkload.java` to an XCUITest), export the
   hitch and frame tables, and record them next to the Android numbers in the
   knowledge base.
4. Before/after screenshots for A4 go in `docs/` with the device name.

## Slither exit on iOS (already written, never compiled)

On 2026-09-01 the exit protocol changed: every native exit is now the slither
(same trail as web) at every density, and the event string carries the trail
polyline (`id,index,durationMs,reducedMotion,trailStrokeWidth,bodyLen,totalLen,
dirX,dirY,n,x0,y0,...`). `ArrowsBoardView.swift` was updated to parse it and
animate `lineDashPhase` from `totalLen + 2*bodyLen` down by `totalLen` on a
CAShapeLayer, with the head translated along `dir`. Android was built and
recorded frame by frame; iOS was NOT compiled (no disk space for DerivedData).
First iOS build must check: the file compiles, the dash slides toward the
head (if it slides backwards, flip the sign of the phase delta), and the
duration matches Android for the same tap.

## Risks / open questions

- CAShapeLayer re-rasterizes the compound path on every pan/pinch frame in the
  render server. 250 polylines should be cheap, but this is exactly what A2
  measures; if it fails, fall back to `draw(_:)` with a capped
  `layer.contentsScale` (bitmap ≤ 16 MB) and accept softer strokes at max zoom.
- CAShapeLayer anti-aliasing is slightly softer than Core Graphics; A4 decides
  whether that is acceptable.
- The same emulator-only caveat applies to Android: no physical Android run
  exists yet. Run `npm run perf:android` with a phone attached before calling
  either platform done.

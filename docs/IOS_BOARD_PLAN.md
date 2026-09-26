# iOS board renderer plan

Status: NOT STARTED (written 2026-09-01; status corrected 2026-09-26, W8-01). Android
shipped in commit 0a1df94. iOS has not been built since the 2026-09-01 exit-protocol change
(0f7968b) and has never been measured; since then its Swift has only been type-checked
against a stub of ExpoModulesCore (section "Pre-build static check (2026-09-26)" below),
which proves nothing about a real build, drawing or timing.

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

## Pre-build static check (2026-09-26)

W8-01. No build, no `pod install`, no `expo prebuild`; nothing under `modules/` or `ios/` was
edited. The repo has no `ios/` directory (ruling D-4), so the ExpoModulesCore version comes from
`node_modules/expo-modules-core/package.json`: **57.0.14** (ruling F24).

**What this does and does not prove.** It proves that our three Swift files type-check against
the real iOS 26.5 simulator SDK **and a hand-written stub** of the ExpoModulesCore symbols they
use. It does not prove the stub matches the real DSL (a stub that differs can pass or fail
falsely), that the pods build, that anything draws, or any timing. W8-03 (a real build) is the
real check; everything at runtime stays UNVERIFIED until W8-03 and W8-05.

### Pre-fix state (EXECUTED)

- `git log --oneline -- modules/arrows-board/ios modules/arrows-feedback/ios` → `a8a3a90`
  (POLISH-T10, 2026-09-25), `5a82a8a` (POLISH-T3), `ec03073`, `0f7968b`, `0a1df94`. **The W8
  brief's "that file has not changed since" is out of date:** `ArrowsBoardView.swift` changed in
  POLISH-T3 and POLISH-T10 (the motion tokens, the exact Bezier, the `endMs` token), after the
  2026-09-09 stub check the W8 draft author reported. No iOS build log exists.
- The old status line (lines 3-4: "iOS compiles and draws correctly") contradicted line 113 ("iOS
  was NOT compiled"). It is replaced above.

### Toolchain (EXECUTED)

- Xcode 26.6 (17F113); `swift-driver version: 1.148.6 Apple Swift version 6.3.3
  (swiftlang-6.3.3.1.3 clang-2100.1.1.101)`; iPhoneSimulator26.5.sdk. Nothing was downloaded.
- Target `arm64-apple-ios16.4-simulator`, matching both podspecs (`:ios => '16.4'`). Default
  language mode (Swift 5): neither podspec sets `swift_version`, so the pods get the app's Swift
  version (INFERRED from CocoaPods' behaviour; Expo's template is Swift 5).

### Commands, exit codes, diagnostics (EXECUTED; `<scratch>` = the session scratchpad)

```text
$ xcrun swiftc -emit-module -module-name ExpoModulesCore -target arm64-apple-ios16.4-simulator -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -emit-module-path <scratch>/ExpoModulesCore.swiftmodule <scratch>/stub.swift
exit=0

$ xcrun swiftc -typecheck -module-name ArrowsBoard -target arm64-apple-ios16.4-simulator -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -I <scratch> modules/arrows-board/ios/ArrowsBoardView.swift modules/arrows-board/ios/ArrowsBoardModule.swift
exit=0

$ xcrun swiftc -typecheck -module-name ArrowsFeedback -target arm64-apple-ios16.4-simulator -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -I <scratch> modules/arrows-feedback/ios/ArrowsFeedbackModule.swift
exit=0
```

Verbatim diagnostics: **none** (no error, no warning) from any of the three commands. Checks (a)
and (b) of the brief both pass; no type error in our code was found, so there is nothing to hand
to W8-03.

**Positive control (EXECUTED, on scratch copies, never on the repo files):** the same commands
fail when the code is wrong, so a pass is not a blind detector. Output filtered with
`grep -E "error:"`.

```text
== control A: ArrowsBoardModule.swift mutated (setGeometry -> setGeometryX; strokeWidth Double -> CGFloat)
ArrowsBoardModule.swift:9:14: error: value of type 'ArrowsBoardView' has no member 'setGeometryX'
   |              `- error: value of type 'ArrowsBoardView' has no member 'setGeometryX'
exit=1
== control B: ArrowsFeedbackModule.swift mutated (step Int -> [CGFloat])
ArrowsFeedbackModule.swift:49:5: error: global function 'Function' requires that '[CGFloat]' conform to 'AnyArgument'
    |     `- error: global function 'Function' requires that '[CGFloat]' conform to 'AnyArgument'
ArrowsFeedbackModule.swift:51:69: error: cannot convert value of type '[CGFloat]' to expected argument type 'Int'
    |                                                                     `- error: cannot convert value of type '[CGFloat]' to expected argument type 'Int'
exit=1
```

(Control A's second mutation, `Double` → `CGFloat`, produced no error of its own; most likely the
first error in the same result-builder block masks it (INFERRED); control B shows the stub's `AnyArgument` constraint is enforced. The real
library's `AnyArgument` conformances are wider than the stub's four; the three files use only
`String`, `Double`, `Bool` and `Int`, which the real library supports at
`Core/Arguments/AnyArgument.swift:19, :25, :82, :94`.)

**Informational, not a gate:** the same two checks with `-swift-version 6` also exit 0, with 16
concurrency warnings, all in `ArrowsFeedbackModule.swift` (main-actor UIKit calls from nonisolated
methods; one non-Sendable capture). `ArrowsBoardView.swift` has none. Relevant only if the pods
are ever compiled in Swift 6 mode. Output filtered with `grep -E "error:|warning:"`.

```text
== informational: same two checks with -swift-version 6
board exit=0
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:78:41: warning: passing non-Sendable parameter 'action' to function expecting a '@Sendable' closure
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:90:44: warning: main actor-isolated property 'applicationState' can not be referenced from a nonisolated context
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:90:37: warning: main actor-isolated class property 'shared' can not be referenced from a nonisolated context
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:186:27: warning: call to main actor-isolated initializer 'init(style:)' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:187:21: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:190:33: warning: call to main actor-isolated initializer 'init()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:191:27: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:259:19: warning: call to main actor-isolated instance method 'impactOccurred(intensity:)' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:260:19: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:263:19: warning: call to main actor-isolated instance method 'impactOccurred(intensity:)' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:264:19: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:266:21: warning: call to main actor-isolated instance method 'notificationOccurred' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:267:21: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:269:21: warning: call to main actor-isolated instance method 'notificationOccurred' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:270:21: warning: call to main actor-isolated instance method 'prepare()' in a synchronous nonisolated context [#ActorIsolatedCall]
modules/arrows-feedback/ios/ArrowsFeedbackModule.swift:307:17: warning: capture of 'self' with non-Sendable type 'ArrowsFeedbackModule?' in a '@Sendable' closure [#SendableClosureCaptures]
feedback exit=0
```

### Historical: the precompiled framework (before D-4)

Reported by the W8 brief author, EXECUTED 2026-09-16, before ruling D-4 deleted `ios/` (not
re-run here: `ios/Pods` no longer exists and W8-01 may not regenerate it):
`xcrun swiftc -typecheck -target arm64-apple-ios16.4-simulator -sdk <sim SDK> -F ios/Pods/ExpoModulesCore/ExpoModulesCore.xcframework/ios-arm64_x86_64-simulator …`
failed inside the framework before reaching our code: `no such module 'ExpoModulesJSI'` (a
source pod that must be built first) and `failed to build module 'ExpoModulesCore'; … built with
'Apple Swift version 6.3.1' … while this compiler is 'Apple Swift version 6.3.3'`. What the
compiler-version message means for a real build is unknown (INFERRED); W8-03 records whether it
recurs.

### Stub source (reproducible)

Save as `stub.swift` in a scratch directory and run the commands above. Every declaration names
the `node_modules/expo-modules-core/ios` file and line it was copied from.

```swift
// W8-01 type-check stub: ONLY the ExpoModulesCore symbols that ArrowsBoardView.swift,
// ArrowsBoardModule.swift and ArrowsFeedbackModule.swift use. Declarations are copied from
// node_modules/expo-modules-core 57.0.14 (ios/ paths in each comment); bodies are placeholders.
// Protocol requirements the three files never touch (getDynamicType, JSI members) are omitted.
import UIKit

// Core/Arguments/AnyArgument.swift:8, :19, :25, :82, :94
public protocol AnyArgument: ~Copyable {}
extension Bool: AnyArgument {}
extension Int: AnyArgument {}
extension Double: AnyArgument {}
extension String: AnyArgument {}

// Core/Protocols/AnyDefinition.swift:4
public protocol AnyDefinition: ~Copyable {}

// Core/AppContext.swift:8 (protocol conformances other than Sendable omitted)
public final class AppContext: NSObject, @unchecked Sendable {}

// Fabric/ExpoFabricView.swift:8 (superclass ExpoFabricViewObjC is a UIView subclass, ExpoFabricViewObjC.h:25)
open class ExpoFabricView: UIView {
  public weak var appContext: AppContext?

  @objc
  public init() {
    fatalError("Unsupported direct init() call for ExpoFabricView.")
  }

  @objc
  public override init(frame: CGRect) {
    super.init(frame: frame)
  }

  required public init(appContext: AppContext? = nil) {
    self.appContext = appContext
    super.init(frame: .zero)
  }

  @available(*, unavailable)
  public required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

// Core/Views/ExpoView.swift:3
public typealias ExpoView = ExpoFabricView

// Core/Objects/ObjectDefinition.swift:8
public class ObjectDefinition: AnyDefinition {
  init(definitions: [AnyDefinition]) {}
}

// Core/Modules/ModuleDefinition.swift:10
public final class ModuleDefinition: ObjectDefinition {}

// Core/Modules/ModuleDefinitionBuilder.swift:5-6
@resultBuilder
public struct ModuleDefinitionBuilder {
  public static func buildBlock(_ definitions: AnyDefinition...) -> ModuleDefinition {
    return ModuleDefinition(definitions: definitions)
  }
}

// Core/Protocols/AnyModule.swift:4 (JSI and macro requirements omitted)
public protocol AnyModule: AnyObject, AnyArgument {
  init(appContext: AppContext)

  @ModuleDefinitionBuilder
  func definition() -> ModuleDefinition
}

// Core/Modules/Module.swift:8, :68
open class BaseModule {
  public private(set) weak var appContext: AppContext?

  @available(
    *, unavailable,
    message: "Module's initializer cannot be overridden, override the \"didCreate\" lifecycle hook instead."
  )
  public init() {}

  required public init(appContext: AppContext) {
    self.appContext = appContext
  }
}

public typealias Module = AnyModule & BaseModule

// Api/Factories/ModuleFactories.swift:4
struct ModuleNameDefinition: AnyDefinition {}
public func Name(_ name: String) -> AnyDefinition {
  return ModuleNameDefinition()
}

// Api/Factories/EventListenersFactories.swift:11, :25, :39
struct EventListener: AnyDefinition {}
public func OnDestroy(@_implicitSelfCapture _ closure: @escaping () -> Void) -> AnyDefinition {
  return EventListener()
}
public func OnAppEntersForeground(@_implicitSelfCapture _ closure: @escaping () -> Void) -> AnyDefinition {
  return EventListener()
}
public func OnAppEntersBackground(@_implicitSelfCapture _ closure: @escaping () -> Void) -> AnyDefinition {
  return EventListener()
}

// Core/Functions/SyncFunctionDefinition.swift:36
public class SyncFunctionDefinition<Args, FirstArgType, ReturnType>: AnyDefinition, @unchecked Sendable {
  init() {}
}

// Api/Factories/SyncFunctionFactories.swift:20, :36
public func Function<R>(
  _ name: String,
  @_implicitSelfCapture _ closure: @escaping () throws -> R
) -> SyncFunctionDefinition<(), Void, R> {
  return SyncFunctionDefinition()
}

public func Function<R, A0: AnyArgument, each A: AnyArgument>(
  _ name: String,
  @_implicitSelfCapture _ closure: @escaping (A0, repeat each A) throws -> R
) -> SyncFunctionDefinition<(A0, repeat each A), A0, R> {
  return SyncFunctionDefinition()
}

// Core/Views/ViewDefinition.swift:106, Core/Views/AnyViewProp.swift:4
public protocol AnyViewDefinitionElement: AnyDefinition {}
public protocol AnyViewProp: AnyViewDefinitionElement {}

// Core/Views/ConcreteViewProp.swift:6
public final class ConcreteViewProp<ViewType: UIView, PropType: AnyArgument>: AnyViewProp, @unchecked Sendable {
  public typealias SetterType = @MainActor (ViewType, PropType) -> Void
  init(name: String, setter: @escaping SetterType) {}
}

// Core/Views/ViewDefinition.swift:8
public class ViewDefinition<ViewType>: ObjectDefinition, @unchecked Sendable {
  init(_ viewType: ViewType.Type, elements: [AnyViewDefinitionElement]) {
    super.init(definitions: [])
  }
}

// Api/Builders/ViewDefinitionBuilder.swift:4-6, :27
@resultBuilder
public struct ViewDefinitionBuilder<ViewType: UIView> {
  public static func buildBlock(_ elements: AnyViewDefinitionElement...) -> [AnyViewDefinitionElement] {
    return elements
  }

  public static func buildExpression<PropType: AnyArgument>(_ element: ConcreteViewProp<ViewType, PropType>) -> AnyViewDefinitionElement {
    return element
  }
}

// Api/Factories/ViewFactories.swift:10, :38
public func View<ViewType: UIView>(
  _ viewType: ViewType.Type,
  @ViewDefinitionBuilder<ViewType> _ elements: @escaping () -> [AnyViewDefinitionElement]
) -> ViewDefinition<ViewType> {
  return ViewDefinition(viewType, elements: elements())
}

public func Prop<ViewType: UIView, PropType: AnyArgument>(
  _ name: String,
  @_implicitSelfCapture _ setter: @escaping @MainActor (ViewType, PropType) -> Void
) -> ConcreteViewProp<ViewType, PropType> {
  return ConcreteViewProp(name: name, setter: setter)
}
```

### Kotlin ↔ Swift exit parity (READ from source at `b082532`)

K = `modules/arrows-board/android/src/main/java/com/danteb/arrows/board/ArrowsBoardView.kt`,
S = `modules/arrows-board/ios/ArrowsBoardView.swift`. READ = both sides read and compared;
INFERRED = a conclusion about runtime behaviour that nobody has observed. Every row: **observe in
W8-05.**

| Aspect | Kotlin | Swift | Tag |
|---|---|---|---|
| Header tokens | `EXIT_HEADER_TOKEN_COUNT = 10` (K:986), checked K:332 | `headerCount = 10` (S:88) | READ, same |
| Duration band | `160L..1000L` ms (K:988-989), checked K:343 | `(160...1000).contains(durationMs)` (S:99) | READ, same |
| Trail points | `2..MAX_TRAIL_POINTS` = 4098 (K:983, K:348) | `pointCount >= 2, pointCount <= 4098` (S:104) | READ, same |
| Accepted token counts | exactly 10+2n, 12+2n or 13+2n, else ignored (K:354-369) | same three counts (S:105-107) | READ, same |
| Concurrent slots | `MAX_CONCURRENT_EXITS = 2` (K:985, K:143) | `(0..<2)` (S:34) | READ, same |
| reducedMotion token | `tokens[3] == "1"` (K:336) | `tokens[3] == "1"` (S:148) | READ, same |
| Duplicate id / bad index | ignored (K:382) | ignored (S:108-109) | READ, same |
| Motion tokens `fadeStart`, `launch` | `fadeStart` in [0, 1), `launch` in [0, 2] (K:357-361, K:991) | same ranges (S:134-137) | READ, same |
| `endMs` token (13+2n) | parsed, must be 1..durationMs or the exit is ignored (K:363-367); the exit stops at `endMs` if the camera did not move (K:641-648) | not parsed or validated; the exit runs to `durationMs` (S:129-130 comment) | READ, **differs**: an out-of-range `endMs` is dropped on Android and played on iOS; iOS never stops early |
| Start frame with motion tokens | clock starts one display frame back and draws in the mounting frame (K:401-402, K:422) | animations start when added (S:191-225) | INFERRED, **differs** by about one frame |
| Travel, flag OFF (10+2n) | exact `progress² · totalLength` (K:653-658, `launch = 0`) | `CAMediaTimingFunction(0.11, 0, 0.5, 0)` approximation (S:189) | READ, **differs** (approximation) |
| Travel, motion tokens | exact `launch·k + (1 − launch)·k²` (K:657) | cubic Bezier (1/3, launch/3, 2/3, (1+launch)/3) (S:185-188), the degree elevation of that quadratic with x(t) = t | READ, same curve; INFERRED that Core Animation evaluates it to float precision |
| Dash / visible body | the segment [travelled, travelled + body] of the trail, bit-identical to `DashPathEffect([body, total + body], −travelled)` (K:675-679, `dashSpan` K:695-717) | `lineDashPattern [body, total + body]` (S:165), `lineDashPhase` animated `patternSum → patternSum − totalLength`, `patternSum = total + 2·body` (S:156, S:166, S:192-193) | INFERRED: congruent modulo one period; the direction has never been observed |
| Fade | 1 until `fadeStart` (default 0.55), then smoothstep `1 − (3f² − 2f³)` (K:659-667) | keyframes `[1, 1, 0]` at `[0, fadeStart, 1]`, linear then `easeInEaseOut` (S:215-221) | INFERRED, **differs** slightly (easeInEaseOut is not smoothstep) |
| Reduced motion | travelled 0, opacity `1 − progress` (K:654-655, K:661) | phase and translation `toValue == fromValue`, opacity `[1, 0]` linear (S:193, S:202-203, S:216-221) | READ, same |
| Alpha application | paint alpha on trail and head separately (K:668-672) | container layer opacity (S:215, S:225) | INFERRED, **differs** where head and trail overlap mid-fade (Android may composite darker) |
| End of exit | slot cleared when progress ≥ 1 (K:633-636) | `fillMode .forwards` holds opacity 0; cleanup at duration + 50 ms (S:227-232) | INFERRED, no visible difference |
| Painting outside the board rect (`META_EXIT_TO_SCREEN_EDGE`) | the view paints past its bounds when the wrapper's overflow is visible (`src/ui/boardOverflow.ts`) | `clipsToBounds = true` (S:41), exit container frame = `bounds` (S:151) | INFERRED, **differs**: an edge-running trail would be clipped at the board rect on iOS; the flag is not gated off for iOS in JS |
| Props | 9: + `grid`, `gridStyle`, `markMask`, `markColor` (`ArrowsBoardModule.kt:11-45`) | 5 (`ArrowsBoardModule.swift:8-26`) | READ; grid and marks are gated off on iOS in JS (`src/ui/boardGridFlag.ts:10`, `src/ui/missedMarkFlag.ts:10`) |
| Ink change during an exit | shared paints recoloured (K:288-289) | live slot layers recoloured (S:62-65) | READ, same effect |

Not fixed here (non-goal). The differences above are inputs for W8-03 / W8-05.

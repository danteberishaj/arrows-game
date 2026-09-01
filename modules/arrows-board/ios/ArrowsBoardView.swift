import ExpoModulesCore
import CoreGraphics
import QuartzCore
import UIKit

private struct ArrowGeometry {
  let shaftPath: CGPath
  let headPath: CGPath
}

private final class ExitLayerSlot {
  var id: Int64 = -1
  var container: CALayer?
  var trail: CAShapeLayer?
  var head: CAShapeLayer?
  var cleanup: DispatchWorkItem?
}

/**
 * Retained renderer for the board's static arrow art plus the slither exit.
 * Static arrows are drawn as two compound paths; exits are two bounded
 * Core Animation slots that follow the same curve as the web slither.
 *
 * Known gap (docs/IOS_BOARD_PLAN.md): `draw(_:)` allocates a board-sized
 * backing store. The exit slots below already use CAShapeLayer and are the
 * model for moving the static paths there too.
 */
class ArrowsBoardView: ExpoView {
  private var arrows: [ArrowGeometry] = []
  private var visibleArrows: [Bool] = []
  private var rawVisibleMask = ""
  private var inkColor = UIColor.black
  private var arrowStrokeWidth: CGFloat = 1
  private let exitSlots = (0..<2).map { _ in ExitLayerSlot() }
  private var nextExitSlot = 0
  private var lastExitId: Int64 = -1

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = true
    isOpaque = false
    backgroundColor = .clear
    contentMode = .redraw
  }

  func setGeometry(_ geometry: String) {
    clearExitAnimations()
    arrows = Self.parseGeometry(geometry) ?? []
    updateVisibleArrows()
    setNeedsDisplay()
  }

  func setVisibleMask(_ visibleMask: String) {
    rawVisibleMask = visibleMask
    updateVisibleArrows()
    setNeedsDisplay()
  }

  func setInk(_ ink: String) {
    inkColor = Self.parseColor(ink) ?? .black
    for slot in exitSlots {
      slot.trail?.strokeColor = inkColor.cgColor
      slot.head?.fillColor = inkColor.cgColor
    }
    setNeedsDisplay()
  }

  func setStrokeWidth(_ strokeWidth: Double) {
    let width = CGFloat(strokeWidth)
    arrowStrokeWidth = width.isFinite ? max(0, width) : 0
    setNeedsDisplay()
  }

  /**
   * Starts one of two bounded slither exits. Event format (board points):
   * `id,index,durationMs,reducedMotion,trailStrokeWidth,bodyLen,totalLen,dirX,dirY,n,x0,y0,...`
   */
  func setExitAnimation(_ value: String) {
    if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      clearExitAnimations()
      return
    }

    let tokens = value.split(separator: ",", omittingEmptySubsequences: false)
    let headerCount = 10
    guard tokens.count >= headerCount,
          let id = Int64(tokens[0]),
          let arrowIndex = Int(tokens[1]),
          let durationMs = Double(tokens[2]),
          let trailStrokeWidth = Double(tokens[4]),
          let bodyLength = Double(tokens[5]),
          let totalLength = Double(tokens[6]),
          let directionX = Double(tokens[7]),
          let directionY = Double(tokens[8]),
          let pointCount = Int(tokens[9]),
          (160...1000).contains(durationMs),
          trailStrokeWidth.isFinite, trailStrokeWidth > 0,
          bodyLength.isFinite, bodyLength > 0,
          totalLength.isFinite, totalLength > 0,
          directionX.isFinite, directionY.isFinite,
          pointCount >= 2, pointCount <= 4098,
          tokens.count == headerCount + pointCount * 2,
          arrows.indices.contains(arrowIndex),
          id != lastExitId else {
      return
    }

    let trailPath = CGMutablePath()
    for pointIndex in 0..<pointCount {
      let tokenIndex = headerCount + pointIndex * 2
      guard let x = Double(tokens[tokenIndex]), x.isFinite,
            let y = Double(tokens[tokenIndex + 1]), y.isFinite else {
        return
      }
      let point = CGPoint(x: x, y: y)
      if pointIndex == 0 {
        trailPath.move(to: point)
      } else {
        trailPath.addLine(to: point)
      }
    }
    lastExitId = id

    let slot = exitSlots[nextExitSlot]
    nextExitSlot = (nextExitSlot + 1) % exitSlots.count
    clearExitSlot(slot)

    let reducedMotion = tokens[3] == "1"
    let duration = durationMs / 1000
    let container = CALayer()
    container.frame = bounds

    // One dash the length of the body, then a gap long enough that no second
    // dash appears. Phase `sum` is the pattern origin; decreasing it by the
    // travelled distance slides the dash toward and off the board edge.
    let patternSum = totalLength + 2 * bodyLength
    let trail = CAShapeLayer()
    trail.frame = bounds
    trail.path = trailPath
    trail.strokeColor = inkColor.cgColor
    trail.fillColor = UIColor.clear.cgColor
    trail.lineWidth = CGFloat(trailStrokeWidth)
    trail.lineCap = .round
    trail.lineJoin = .round
    trail.lineDashPattern = [NSNumber(value: bodyLength), NSNumber(value: totalLength + bodyLength)]
    trail.lineDashPhase = CGFloat(patternSum)

    let head = CAShapeLayer()
    head.frame = bounds
    head.path = arrows[arrowIndex].headPath
    head.fillColor = inkColor.cgColor

    container.addSublayer(trail)
    container.addSublayer(head)
    layer.addSublayer(container)
    slot.id = id
    slot.container = container
    slot.trail = trail
    slot.head = head

    // travelled = k^2 * totalLen (ExitTrail): ease-in quadratic on both the
    // dash phase and the head translation.
    let easeInQuad = CAMediaTimingFunction(controlPoints: 0.11, 0, 0.5, 0)

    let phase = CABasicAnimation(keyPath: "lineDashPhase")
    phase.fromValue = patternSum
    phase.toValue = reducedMotion ? patternSum : patternSum - totalLength
    phase.duration = duration
    phase.timingFunction = easeInQuad
    phase.isRemovedOnCompletion = false
    phase.fillMode = .forwards
    trail.add(phase, forKey: "slitherPhase")

    let translation = CABasicAnimation(keyPath: "transform")
    translation.fromValue = CATransform3DIdentity
    translation.toValue = reducedMotion
      ? CATransform3DIdentity
      : CATransform3DMakeTranslation(
          CGFloat(directionX * totalLength),
          CGFloat(directionY * totalLength),
          0
        )
    translation.duration = duration
    translation.timingFunction = easeInQuad
    translation.isRemovedOnCompletion = false
    translation.fillMode = .forwards
    head.add(translation, forKey: "slitherHead")

    let opacity = CAKeyframeAnimation(keyPath: "opacity")
    opacity.values = reducedMotion ? [1, 0] : [1, 1, 0]
    opacity.keyTimes = reducedMotion ? [0, 1] : [0, 0.55, 1]
    opacity.timingFunctions = reducedMotion
      ? [CAMediaTimingFunction(name: .linear)]
      : [CAMediaTimingFunction(name: .linear), CAMediaTimingFunction(name: .easeInEaseOut)]
    opacity.duration = duration
    opacity.isRemovedOnCompletion = false
    opacity.fillMode = .forwards
    container.add(opacity, forKey: "slitherFade")

    let cleanup = DispatchWorkItem { [weak self, weak slot] in
      guard let self, let slot, slot.id == id else { return }
      self.clearExitSlot(slot)
    }
    slot.cleanup = cleanup
    DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.05, execute: cleanup)
  }

  override func draw(_ rect: CGRect) {
    super.draw(rect)

    guard let context = UIGraphicsGetCurrentContext(), !arrows.isEmpty else {
      return
    }

    guard visibleArrows.contains(true) else {
      return
    }

    context.saveGState()
    defer { context.restoreGState() }

    context.setStrokeColor(inkColor.cgColor)
    context.setLineWidth(arrowStrokeWidth)
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.beginPath()
    for (arrow, isVisible) in zip(arrows, visibleArrows) where isVisible {
      context.addPath(arrow.shaftPath)
    }
    context.strokePath()

    context.setFillColor(inkColor.cgColor)
    context.beginPath()
    for (arrow, isVisible) in zip(arrows, visibleArrows) where isVisible {
      context.addPath(arrow.headPath)
    }
    context.fillPath()
  }

  private func clearExitAnimations() {
    for slot in exitSlots {
      clearExitSlot(slot)
    }
    nextExitSlot = 0
    lastExitId = -1
  }

  private func clearExitSlot(_ slot: ExitLayerSlot) {
    slot.cleanup?.cancel()
    slot.container?.removeAllAnimations()
    slot.container?.removeFromSuperlayer()
    slot.id = -1
    slot.container = nil
    slot.trail = nil
    slot.head = nil
    slot.cleanup = nil
  }

  private func updateVisibleArrows() {
    let mask = Array(rawVisibleMask)
    visibleArrows = arrows.indices.map { index in
      index < mask.count && mask[index] == "1"
    }
  }

  private static func parseGeometry(_ geometry: String) -> [ArrowGeometry]? {
    if geometry.isEmpty {
      return []
    }

    let records = geometry.split(separator: ";", omittingEmptySubsequences: false)
    var parsedArrows: [ArrowGeometry] = []
    parsedArrows.reserveCapacity(records.count)

    for record in records {
      guard let arrow = parseArrow(record) else {
        return nil
      }
      parsedArrows.append(arrow)
    }

    return parsedArrows
  }

  private static func parseArrow(_ record: Substring) -> ArrowGeometry? {
    let components = record.split(separator: ",", omittingEmptySubsequences: false)
    guard components.count >= 9,
          let pointCount = Int(trimmed(components[0])),
          pointCount > 0,
          pointCount <= (components.count - 7) / 2,
          components.count == pointCount * 2 + 7 else {
      return nil
    }

    var values: [CGFloat] = []
    values.reserveCapacity(components.count - 1)
    for component in components.dropFirst() {
      guard let doubleValue = Double(trimmed(component)), doubleValue.isFinite else {
        return nil
      }

      let value = CGFloat(doubleValue)
      guard value.isFinite else {
        return nil
      }
      values.append(value)
    }

    let shaftPath = CGMutablePath()
    shaftPath.move(to: CGPoint(x: values[0], y: values[1]))
    if pointCount > 1 {
      for pointIndex in 1..<pointCount {
        let valueIndex = pointIndex * 2
        shaftPath.addLine(to: CGPoint(x: values[valueIndex], y: values[valueIndex + 1]))
      }
    }

    let headStart = pointCount * 2
    let headPath = CGMutablePath()
    headPath.move(to: CGPoint(x: values[headStart], y: values[headStart + 1]))
    headPath.addLine(to: CGPoint(x: values[headStart + 2], y: values[headStart + 3]))
    headPath.addLine(to: CGPoint(x: values[headStart + 4], y: values[headStart + 5]))
    headPath.closeSubpath()

    guard let immutableShaftPath = shaftPath.copy(),
          let immutableHeadPath = headPath.copy() else {
      return nil
    }

    return ArrowGeometry(shaftPath: immutableShaftPath, headPath: immutableHeadPath)
  }

  private static func trimmed(_ value: Substring) -> String {
    String(value).trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func parseColor(_ value: String) -> UIColor? {
    var hex = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    let characters = Array(hex)
    switch characters.count {
    case 3, 4:
      hex = characters.map { "\($0)\($0)" }.joined()
    case 6, 8:
      break
    default:
      return nil
    }

    guard let packedColor = UInt64(hex, radix: 16) else {
      return nil
    }

    let hasAlpha = hex.count == 8
    let redShift = hasAlpha ? 24 : 16
    let greenShift = hasAlpha ? 16 : 8
    let blueShift = hasAlpha ? 8 : 0
    let alpha = hasAlpha ? CGFloat(packedColor & 0xff) / 255 : 1
    let red = CGFloat((packedColor >> redShift) & 0xff) / 255
    let green = CGFloat((packedColor >> greenShift) & 0xff) / 255
    let blue = CGFloat((packedColor >> blueShift) & 0xff) / 255

    return UIColor(red: red, green: green, blue: blue, alpha: alpha)
  }
}

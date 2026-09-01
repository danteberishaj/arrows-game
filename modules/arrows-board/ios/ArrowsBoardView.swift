import ExpoModulesCore
import CoreGraphics
import QuartzCore
import UIKit

private struct ArrowGeometry {
  let shaftPath: CGPath
  let headPath: CGPath
  let bounds: CGRect
  let direction: CGVector
}

private final class ExitLayerSlot {
  var id: Int64 = -1
  var container: CALayer?
  var shaft: CAShapeLayer?
  var head: CAShapeLayer?
  var cleanup: DispatchWorkItem?
}

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
      slot.shaft?.strokeColor = inkColor.cgColor
      slot.head?.fillColor = inkColor.cgColor
    }
    setNeedsDisplay()
  }

  func setStrokeWidth(_ strokeWidth: Double) {
    let width = CGFloat(strokeWidth)
    arrowStrokeWidth = width.isFinite ? max(0, width) : 0
    for slot in exitSlots {
      slot.shaft?.lineWidth = arrowStrokeWidth
    }
    setNeedsDisplay()
  }

  /** Starts one of two bounded Core Animation exits for a dense board. */
  func setExitAnimation(_ value: String) {
    if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      clearExitAnimations()
      return
    }

    let tokens = value.split(separator: ",", omittingEmptySubsequences: false)
    guard tokens.count == 4,
          let id = Int64(tokens[0]),
          let arrowIndex = Int(tokens[1]),
          let durationMs = Double(tokens[2]),
          (160...1000).contains(durationMs),
          arrows.indices.contains(arrowIndex),
          id != lastExitId else {
      return
    }
    lastExitId = id

    let slot = exitSlots[nextExitSlot]
    nextExitSlot = (nextExitSlot + 1) % exitSlots.count
    clearExitSlot(slot)

    let arrow = arrows[arrowIndex]
    let container = CALayer()
    container.frame = bounds

    let shaft = CAShapeLayer()
    shaft.frame = bounds
    shaft.path = arrow.shaftPath
    shaft.strokeColor = inkColor.cgColor
    shaft.fillColor = UIColor.clear.cgColor
    shaft.lineWidth = arrowStrokeWidth
    shaft.lineCap = .round
    shaft.lineJoin = .round

    let head = CAShapeLayer()
    head.frame = bounds
    head.path = arrow.headPath
    head.fillColor = inkColor.cgColor

    container.addSublayer(shaft)
    container.addSublayer(head)
    layer.addSublayer(container)
    slot.id = id
    slot.container = container
    slot.shaft = shaft
    slot.head = head

    let reducedMotion = tokens[3] == "1"
    let distance = exitDistance(for: arrow)
    let translation = reducedMotion
      ? CATransform3DIdentity
      : CATransform3DMakeTranslation(
          arrow.direction.dx * distance,
          arrow.direction.dy * distance,
          0
        )
    let duration = durationMs / 1000

    let transform = CABasicAnimation(keyPath: "transform")
    transform.fromValue = CATransform3DIdentity
    transform.toValue = translation
    transform.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1, 0.3, 1)

    let opacity = CAKeyframeAnimation(keyPath: "opacity")
    opacity.values = reducedMotion ? [1, 0] : [1, 1, 0]
    opacity.keyTimes = reducedMotion ? [0, 1] : [0, 0.65, 1]
    opacity.timingFunctions = [CAMediaTimingFunction(name: .easeOut)]

    let group = CAAnimationGroup()
    group.animations = [transform, opacity]
    group.duration = duration
    group.isRemovedOnCompletion = false
    group.fillMode = .forwards
    container.add(group, forKey: "denseExit")

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

  private func exitDistance(for arrow: ArrowGeometry) -> CGFloat {
    let margin = arrowStrokeWidth
    if arrow.direction.dx > 0 {
      return max(0, bounds.width - arrow.bounds.minX + margin)
    }
    if arrow.direction.dx < 0 {
      return max(0, arrow.bounds.maxX + margin)
    }
    if arrow.direction.dy > 0 {
      return max(0, bounds.height - arrow.bounds.minY + margin)
    }
    return max(0, arrow.bounds.maxY + margin)
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
    slot.shaft = nil
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

    let arrowBounds = immutableShaftPath.boundingBoxOfPath
      .union(immutableHeadPath.boundingBoxOfPath)
    let tip = CGPoint(x: values[headStart], y: values[headStart + 1])
    let baseCenter = CGPoint(
      x: (values[headStart + 2] + values[headStart + 4]) / 2,
      y: (values[headStart + 3] + values[headStart + 5]) / 2
    )
    let rawX = tip.x - baseCenter.x
    let rawY = tip.y - baseCenter.y
    let direction: CGVector
    if abs(rawX) >= abs(rawY) {
      direction = CGVector(dx: rawX >= 0 ? 1 : -1, dy: 0)
    } else {
      direction = CGVector(dx: 0, dy: rawY >= 0 ? 1 : -1)
    }

    return ArrowGeometry(
      shaftPath: immutableShaftPath,
      headPath: immutableHeadPath,
      bounds: arrowBounds,
      direction: direction
    )
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

package com.danteb.arrows.board

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.os.Trace
import android.view.animation.AnimationUtils
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.roundToInt

/**
 * Retained renderer for the board's static arrow art plus the slither exit.
 *
 * Geometry is parsed only when the board geometry prop changes. The cached
 * arrow paths are never mutated after parsing; the two compound paths are the
 * only paths rebuilt when visibility changes. Exits are two fixed slots driven
 * from the frame clock in onDraw, so they follow the same curve as the web
 * slither (SlitherExit.cs) regardless of the system animator scale.
 */
class ArrowsBoardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private data class ArrowPaths(
    val shaft: Path,
    val head: Path,
  )

  private class ExitSlot {
    var id = -1L
    var head: Path? = null
    var trail: Path? = null
    var intervals = FloatArray(2)
    var totalLength = 0f
    var directionX = 0f
    var directionY = 0f
    var trailStrokeWidth = 1f
    var durationMs = 180L
    var startTimeMs = 0L
    var reducedMotion = false
    var fadeStart = EXIT_FADE_START
    var launch = 0f

    val active: Boolean get() = trail != null

    fun clear() {
      id = -1L
      head = null
      trail = null
      totalLength = 0f
      directionX = 0f
      directionY = 0f
      startTimeMs = 0L
      reducedMotion = false
      fadeStart = EXIT_FADE_START
      launch = 0f
    }
  }

  private val stateLock = Any()
  private val arrowPaths = ArrayList<ArrowPaths>()
  private val compoundShaft = Path()
  private val compoundHead = Path()
  private val logicalPointScale = resources.displayMetrics.density

  private val shaftPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    strokeWidth = DEFAULT_STROKE_WIDTH
    color = Color.BLACK
  }
  private val headPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.BLACK
  }
  private val trailPaint = Paint(shaftPaint)
  private val exitHeadPaint = Paint(headPaint)
  private val exitSlots = Array(MAX_CONCURRENT_EXITS) { ExitSlot() }

  private var visibleMask = ""
  private var geometryIsValid = false
  private var hasVisibleArrows = false
  private var nextExitSlot = 0
  private var lastExitId = -1L

  init {
    // ExpoView is a LinearLayout, which otherwise defaults to willNotDraw.
    setWillNotDraw(false)
    setBackgroundColor(Color.TRANSPARENT)
  }

  internal fun setGeometry(value: String) {
    clearExitAnimations()
    // Parse before taking the lock so a large, valid board never blocks a draw
    // while its immutable per-arrow paths are being constructed.
    val parsed = parseGeometry(value)

    synchronized(stateLock) {
      arrowPaths.clear()

      if (parsed == null) {
        // Decorative rendering must fail closed for malformed input. Do not
        // leave the previous level on screen or render a partial level.
        geometryIsValid = false
      } else {
        arrowPaths.addAll(parsed)
        geometryIsValid = true
      }
      rebuildCompoundPathsLocked()
    }
    postInvalidateOnAnimation()
  }

  internal fun setVisibleMask(value: String) {
    // W6-01: app trace section for Perfetto (atrace_apps com.danteb.arrows);
    // a no-op check when tracing is off. docs/perf-mask-rebuild-2026-09-17.md
    Trace.beginSection("ArrowsBoard.setVisibleMask")
    try {
      synchronized(stateLock) {
        visibleMask = value
        rebuildCompoundPathsLocked()
      }
      postInvalidateOnAnimation()
    } finally {
      Trace.endSection()
    }
  }

  internal fun setInk(value: String) {
    val color = try {
      Color.parseColor(value)
    } catch (_: IllegalArgumentException) {
      Color.BLACK
    }

    synchronized(stateLock) {
      shaftPaint.color = color
      headPaint.color = color
      trailPaint.color = color
      exitHeadPaint.color = color
    }
    postInvalidateOnAnimation()
  }

  internal fun setStrokeWidth(value: Float) {
    val strokeWidth = if (value.isFinite() && value >= 0f) {
      value
    } else {
      DEFAULT_STROKE_WIDTH
    }

    synchronized(stateLock) {
      shaftPaint.strokeWidth = strokeWidth
    }
    postInvalidateOnAnimation()
  }

  /**
   * Starts one of two bounded slither exits. Event format (board points):
   * `id,index,durationMs,reducedMotion,trailStrokeWidth,bodyLen,totalLen,dirX,dirY,n,x0,y0,...`
   * optionally followed by `,fadeStart,launch` (POLISH-T3, META_EXIT_TO_SCREEN_EDGE):
   * 10 + 2n tokens keep today's fade start (0.55) and k^2 travel; 12 + 2n set them.
   */
  internal fun setExitAnimation(value: String) {
    if (value.isBlank()) {
      clearExitAnimations()
      return
    }

    val tokens = value.split(',')
    if (tokens.size < EXIT_HEADER_TOKEN_COUNT) return
    val id = tokens[0].toLongOrNull() ?: return
    val arrowIndex = tokens[1].toIntOrNull() ?: return
    val durationMs = tokens[2].toLongOrNull() ?: return
    val reducedMotion = tokens[3] == "1"
    val trailStrokeWidth = tokens[4].toFloatOrNull() ?: return
    val bodyLength = tokens[5].toFloatOrNull() ?: return
    val totalLength = tokens[6].toFloatOrNull() ?: return
    val directionX = tokens[7].toFloatOrNull() ?: return
    val directionY = tokens[8].toFloatOrNull() ?: return
    val pointCount = tokens[9].toIntOrNull() ?: return
    if (durationMs !in MIN_EXIT_DURATION_MS..MAX_EXIT_DURATION_MS) return
    if (!trailStrokeWidth.isFinite() || trailStrokeWidth <= 0f) return
    if (!bodyLength.isFinite() || bodyLength <= 0f) return
    if (!totalLength.isFinite() || totalLength <= 0f) return
    if (!directionX.isFinite() || !directionY.isFinite()) return
    if (pointCount < 2 || pointCount > MAX_TRAIL_POINTS) return
    val pointTokenEnd = EXIT_HEADER_TOKEN_COUNT + pointCount * 2
    var fadeStart = EXIT_FADE_START
    var launch = 0f
    when (tokens.size) {
      pointTokenEnd -> Unit
      pointTokenEnd + EXIT_MOTION_TOKEN_COUNT -> {
        fadeStart = tokens[pointTokenEnd].toFloatOrNull() ?: return
        launch = tokens[pointTokenEnd + 1].toFloatOrNull() ?: return
        if (!fadeStart.isFinite() || fadeStart < 0f || fadeStart >= 1f) return
        if (!launch.isFinite() || launch < 0f || launch > 1f) return
      }
      else -> return
    }

    val trail = Path()
    for (pointIndex in 0 until pointCount) {
      val tokenIndex = EXIT_HEADER_TOKEN_COUNT + pointIndex * 2
      val x = tokens[tokenIndex].toFloatOrNull() ?: return
      val y = tokens[tokenIndex + 1].toFloatOrNull() ?: return
      if (!x.isFinite() || !y.isFinite()) return
      if (pointIndex == 0) trail.moveTo(x, y) else trail.lineTo(x, y)
    }

    synchronized(stateLock) {
      if (id == lastExitId || arrowIndex !in arrowPaths.indices) return
      lastExitId = id
      val slot = exitSlots[nextExitSlot]
      nextExitSlot = (nextExitSlot + 1) % exitSlots.size
      slot.clear()
      slot.id = id
      slot.head = arrowPaths[arrowIndex].head
      slot.trail = trail
      // One dash the length of the body, then a gap long enough that no
      // second dash ever appears on the path (matches the Skia/SVG intervals).
      slot.intervals[0] = bodyLength
      slot.intervals[1] = totalLength + bodyLength
      slot.totalLength = totalLength
      slot.directionX = directionX
      slot.directionY = directionY
      slot.trailStrokeWidth = trailStrokeWidth
      slot.durationMs = durationMs
      slot.startTimeMs = AnimationUtils.currentAnimationTimeMillis()
      slot.reducedMotion = reducedMotion
      slot.fadeStart = fadeStart
      slot.launch = launch
    }
    postInvalidateOnAnimation()
  }

  internal fun clearPaths() {
    clearExitAnimations()
    synchronized(stateLock) {
      arrowPaths.clear()
      compoundShaft.reset()
      compoundHead.reset()
      visibleMask = ""
      geometryIsValid = false
      hasVisibleArrows = false
    }
  }

  override fun onDraw(canvas: Canvas) {
    var keepAnimating = false
    synchronized(stateLock) {
      val hasActiveExit = exitSlots.any { it.active }
      if (!geometryIsValid || (!hasVisibleArrows && !hasActiveExit)) {
        return
      }

      // React Native lays this view out in density-independent points, while
      // Android Canvas paths use physical pixels. Geometry is serialized in
      // the same logical point space as the rest of BoardView, so apply the
      // display density exactly once at the native drawing boundary.
      val saveCount = canvas.save()
      canvas.scale(logicalPointScale, logicalPointScale)
      if (hasVisibleArrows) {
        canvas.drawPath(compoundShaft, shaftPaint)
        canvas.drawPath(compoundHead, headPaint)
      }
      if (hasActiveExit) {
        val now = AnimationUtils.currentAnimationTimeMillis()
        for (slot in exitSlots) {
          if (drawExitSlot(canvas, slot, now)) keepAnimating = true
        }
      }
      canvas.restoreToCount(saveCount)
    }
    if (keepAnimating) postInvalidateOnAnimation()
  }

  override fun onDetachedFromWindow() {
    clearExitAnimations()
    super.onDetachedFromWindow()
  }

  /** Draws one slither frame; returns true while the slot still needs frames. */
  private fun drawExitSlot(canvas: Canvas, slot: ExitSlot, nowMs: Long): Boolean {
    val trail = slot.trail ?: return false
    val head = slot.head ?: return false
    val progress = ((nowMs - slot.startTimeMs).toFloat() / slot.durationMs.toFloat())
      .coerceIn(0f, 1f)
    if (progress >= 1f) {
      slot.clear()
      return false
    }

    // Same curve as ExitTrail (exitTravelFraction): launch*k + (1-launch)*k^2, which is
    // exactly k^2 at the default launch 0; fades past fadeStart (default 55%).
    val launch = slot.launch
    val travelled = if (slot.reducedMotion) {
      0f
    } else {
      (launch * progress + (1f - launch) * progress * progress) * slot.totalLength
    }
    val fadeStart = slot.fadeStart
    val opacity = when {
      slot.reducedMotion -> 1f - progress
      progress < fadeStart -> 1f
      else -> {
        val fade = ((progress - fadeStart) / (1f - fadeStart)).coerceIn(0f, 1f)
        1f - fade * fade * (3f - 2f * fade)
      }
    }
    val alpha = (opacity * 255f).roundToInt().coerceIn(0, 255)

    trailPaint.strokeWidth = slot.trailStrokeWidth
    trailPaint.pathEffect = DashPathEffect(slot.intervals, -travelled)
    trailPaint.alpha = alpha
    exitHeadPaint.alpha = alpha
    canvas.drawPath(trail, trailPaint)
    trailPaint.pathEffect = null

    val saveCount = canvas.save()
    canvas.translate(slot.directionX * travelled, slot.directionY * travelled)
    canvas.drawPath(head, exitHeadPaint)
    canvas.restoreToCount(saveCount)
    return true
  }

  private fun clearExitAnimations() {
    synchronized(stateLock) {
      for (slot in exitSlots) slot.clear()
      nextExitSlot = 0
      lastExitId = -1L
    }
    postInvalidateOnAnimation()
  }

  private fun rebuildCompoundPathsLocked() {
    compoundShaft.reset()
    compoundHead.reset()
    hasVisibleArrows = false

    if (!geometryIsValid) {
      return
    }

    for (index in arrowPaths.indices) {
      if (index >= visibleMask.length || visibleMask[index] != '1') {
        continue
      }

      val paths = arrowPaths[index]
      compoundShaft.addPath(paths.shaft)
      compoundHead.addPath(paths.head)
      hasVisibleArrows = true
    }
  }

  private fun parseGeometry(value: String): ArrayList<ArrowPaths>? {
    if (value.isBlank()) {
      return ArrayList()
    }

    val records = value.split(';')
    val parsed = ArrayList<ArrowPaths>(records.size)
    for (record in records) {
      val paths = parseRecord(record) ?: return null
      parsed.add(paths)
    }
    return parsed
  }

  private fun parseRecord(record: String): ArrowPaths? {
    val tokens = record.split(',')
    if (tokens.isEmpty()) {
      return null
    }

    val rawCount = tokens[0].trim().toFloatOrNull() ?: return null
    if (!rawCount.isFinite() || rawCount < 1f || rawCount > MAX_SHAFT_POINTS) {
      return null
    }

    val shaftPointCount = rawCount.toInt()
    if (rawCount != shaftPointCount.toFloat()) {
      return null
    }

    val expectedTokenCount = 1 + shaftPointCount * 2 + HEAD_COORDINATE_COUNT
    if (tokens.size != expectedTokenCount) {
      return null
    }

    val coordinates = FloatArray(expectedTokenCount - 1)
    for (tokenIndex in 1 until tokens.size) {
      val coordinate = tokens[tokenIndex].trim().toFloatOrNull() ?: return null
      if (!coordinate.isFinite()) {
        return null
      }
      coordinates[tokenIndex - 1] = coordinate
    }

    val shaft = Path()
    shaft.moveTo(coordinates[0], coordinates[1])
    for (pointIndex in 1 until shaftPointCount) {
      val coordinateIndex = pointIndex * 2
      shaft.lineTo(coordinates[coordinateIndex], coordinates[coordinateIndex + 1])
    }

    val headCoordinateIndex = shaftPointCount * 2
    val head = Path().apply {
      moveTo(coordinates[headCoordinateIndex], coordinates[headCoordinateIndex + 1])
      lineTo(coordinates[headCoordinateIndex + 2], coordinates[headCoordinateIndex + 3])
      lineTo(coordinates[headCoordinateIndex + 4], coordinates[headCoordinateIndex + 5])
      close()
    }

    return ArrowPaths(shaft, head)
  }

  private companion object {
    const val DEFAULT_STROKE_WIDTH = 1f
    const val MAX_SHAFT_POINTS = 4096f
    const val MAX_TRAIL_POINTS = 4098
    const val HEAD_COORDINATE_COUNT = 6
    const val MAX_CONCURRENT_EXITS = 2
    const val EXIT_HEADER_TOKEN_COUNT = 10
    const val EXIT_MOTION_TOKEN_COUNT = 2
    const val MIN_EXIT_DURATION_MS = 160L
    const val MAX_EXIT_DURATION_MS = 1000L
    const val EXIT_FADE_START = 0.55f
  }
}

package com.danteb.arrows.board

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Retained renderer for the board's static arrow art.
 *
 * Geometry is parsed only when the board geometry prop changes. The cached
 * arrow paths are never mutated after parsing; the two compound paths are the
 * only paths rebuilt when visibility changes.
 */
class ArrowsBoardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private data class ArrowPaths(
    val shaft: Path,
    val head: Path,
    val bounds: RectF,
    val directionX: Float,
    val directionY: Float,
  )

  private data class ExitSlot(
    var id: Long = -1,
    var arrow: ArrowPaths? = null,
    var progress: Float = 0f,
    var reducedMotion: Boolean = false,
    var animator: ValueAnimator? = null,
  )

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
  private val exitShaftPaint = Paint(shaftPaint)
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
    synchronized(stateLock) {
      visibleMask = value
      rebuildCompoundPathsLocked()
    }
    postInvalidateOnAnimation()
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
      exitShaftPaint.color = color
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
      exitShaftPaint.strokeWidth = strokeWidth
    }
    postInvalidateOnAnimation()
  }

  /** Starts one of two bounded, transform-only dense-board exit animations. */
  internal fun setExitAnimation(value: String) {
    if (value.isBlank()) {
      clearExitAnimations()
      return
    }

    val tokens = value.split(',')
    if (tokens.size != EXIT_EVENT_TOKEN_COUNT) return
    val id = tokens[0].toLongOrNull() ?: return
    val arrowIndex = tokens[1].toIntOrNull() ?: return
    val durationMs = tokens[2].toLongOrNull() ?: return
    val reducedMotion = tokens[3] == "1"
    if (durationMs !in MIN_EXIT_DURATION_MS..MAX_EXIT_DURATION_MS) return

    val slotIndex: Int
    val oldAnimator: ValueAnimator?
    synchronized(stateLock) {
      if (id == lastExitId || arrowIndex !in arrowPaths.indices) return
      lastExitId = id
      slotIndex = nextExitSlot
      nextExitSlot = (nextExitSlot + 1) % exitSlots.size
      val slot = exitSlots[slotIndex]
      oldAnimator = slot.animator
      slot.id = id
      slot.arrow = arrowPaths[arrowIndex]
      slot.progress = 0f
      slot.reducedMotion = reducedMotion
      slot.animator = null
    }
    oldAnimator?.cancel()

    val animator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = durationMs
      addUpdateListener { running ->
        synchronized(stateLock) {
          val slot = exitSlots[slotIndex]
          if (slot.id != id) return@addUpdateListener
          slot.progress = running.animatedValue as Float
        }
        postInvalidateOnAnimation()
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          synchronized(stateLock) {
            val slot = exitSlots[slotIndex]
            if (slot.id != id) return
            slot.arrow = null
            slot.animator = null
            slot.progress = 0f
          }
          postInvalidateOnAnimation()
        }
      })
    }
    synchronized(stateLock) {
      val slot = exitSlots[slotIndex]
      if (slot.id != id) return
      slot.animator = animator
    }
    animator.start()
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
    synchronized(stateLock) {
      val hasActiveExit = exitSlots.any { it.arrow != null }
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
      val logicalWidth = width / logicalPointScale
      val logicalHeight = height / logicalPointScale
      for (slot in exitSlots) {
        drawExitSlot(canvas, slot, logicalWidth, logicalHeight)
      }
      canvas.restoreToCount(saveCount)
    }
  }

  override fun onDetachedFromWindow() {
    clearExitAnimations()
    super.onDetachedFromWindow()
  }

  private fun drawExitSlot(
    canvas: Canvas,
    slot: ExitSlot,
    logicalWidth: Float,
    logicalHeight: Float,
  ) {
    val arrow = slot.arrow ?: return
    val progress = slot.progress.coerceIn(0f, 1f)
    val travelledFraction = if (slot.reducedMotion) 0f else easeOutCubic(progress)
    val distance = exitDistance(arrow, logicalWidth, logicalHeight)
    val opacity = if (slot.reducedMotion) {
      1f - progress
    } else if (progress < EXIT_FADE_START) {
      1f
    } else {
      val fade = ((progress - EXIT_FADE_START) / (1f - EXIT_FADE_START)).coerceIn(0f, 1f)
      1f - fade * fade * (3f - 2f * fade)
    }
    val alpha = (opacity * 255f).roundToInt().coerceIn(0, 255)
    exitShaftPaint.alpha = alpha
    exitHeadPaint.alpha = alpha

    val saveCount = canvas.save()
    canvas.translate(
      arrow.directionX * distance * travelledFraction,
      arrow.directionY * distance * travelledFraction,
    )
    canvas.drawPath(arrow.shaft, exitShaftPaint)
    canvas.drawPath(arrow.head, exitHeadPaint)
    canvas.restoreToCount(saveCount)
  }

  private fun exitDistance(
    arrow: ArrowPaths,
    logicalWidth: Float,
    logicalHeight: Float,
  ): Float {
    val margin = exitShaftPaint.strokeWidth
    return when {
      arrow.directionX > 0f -> logicalWidth - arrow.bounds.left + margin
      arrow.directionX < 0f -> arrow.bounds.right + margin
      arrow.directionY > 0f -> logicalHeight - arrow.bounds.top + margin
      else -> arrow.bounds.bottom + margin
    }.coerceAtLeast(0f)
  }

  private fun clearExitAnimations() {
    val animators = synchronized(stateLock) {
      val active = exitSlots.mapNotNull { it.animator }
      for (slot in exitSlots) {
        slot.id = -1
        slot.arrow = null
        slot.progress = 0f
        slot.animator = null
      }
      nextExitSlot = 0
      lastExitId = -1L
      active
    }
    for (animator in animators) animator.cancel()
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

    val shaftBounds = RectF()
    val headBounds = RectF()
    shaft.computeBounds(shaftBounds, true)
    head.computeBounds(headBounds, true)
    shaftBounds.union(headBounds)

    val tipX = coordinates[headCoordinateIndex]
    val tipY = coordinates[headCoordinateIndex + 1]
    val baseCenterX =
      (coordinates[headCoordinateIndex + 2] + coordinates[headCoordinateIndex + 4]) / 2f
    val baseCenterY =
      (coordinates[headCoordinateIndex + 3] + coordinates[headCoordinateIndex + 5]) / 2f
    val rawDirectionX = tipX - baseCenterX
    val rawDirectionY = tipY - baseCenterY
    val directionX: Float
    val directionY: Float
    if (abs(rawDirectionX) >= abs(rawDirectionY)) {
      directionX = if (rawDirectionX >= 0f) 1f else -1f
      directionY = 0f
    } else {
      directionX = 0f
      directionY = if (rawDirectionY >= 0f) 1f else -1f
    }

    return ArrowPaths(shaft, head, shaftBounds, directionX, directionY)
  }

  private fun easeOutCubic(value: Float): Float {
    val inverse = 1f - value
    return 1f - inverse * inverse * inverse
  }

  private companion object {
    const val DEFAULT_STROKE_WIDTH = 1f
    const val MAX_SHAFT_POINTS = 4096f
    const val HEAD_COORDINATE_COUNT = 6
    const val MAX_CONCURRENT_EXITS = 2
    const val EXIT_EVENT_TOKEN_COUNT = 4
    const val MIN_EXIT_DURATION_MS = 160L
    const val MAX_EXIT_DURATION_MS = 1000L
    const val EXIT_FADE_START = 0.65f
  }
}

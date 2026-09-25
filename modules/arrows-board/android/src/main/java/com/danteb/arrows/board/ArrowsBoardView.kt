package com.danteb.arrows.board

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.Shader
import android.os.Looper
import android.os.Trace
import android.view.View
import android.view.animation.AnimationUtils
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Retained renderer for the board's static arrow art plus the slither exit.
 *
 * Geometry is parsed only when the board geometry prop changes. The cached
 * arrow paths are never mutated after parsing; the per-strip compound paths are the
 * only paths rebuilt when visibility changes, at most once per props commit
 * (POLISH-T8: setters mark them dirty, OnViewDidUpdateProps rebuilds), and only for the strips whose
 * membership changed (POLISH-T12, see [Strip]). Exits are two fixed slots driven
 * from the frame clock in onDraw, so they follow the same curve as the web
 * slither (SlitherExit.cs) regardless of the system animator scale.
 */
class ArrowsBoardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private data class ArrowPaths(
    val shaft: Path,
    val head: Path,
    /** POLISH-T12: centre of the arrow's point bounding box (board points, y down); picks its strip. */
    val centreY: Float,
  )

  /**
   * POLISH-T12: one horizontal strip of the static art, a full board width tall [STRIP_HEIGHT_PT]. Arrows belong to
   * the strip holding their bounding-box centre and are drawn whole (never clipped at a strip edge), so there are no
   * seams. Each strip keeps its own compound shaft / head (and mark) paths; a visibleMask / markMask change rebuilds
   * only the strips whose members changed layer. The unchanged strips keep their Path generation id, so HWUI's Skia
   * reuses their cached anti-aliased masks: an exit re-rasterises one strip instead of the whole board (BASE uploaded
   * two board-sized 1850x1851 masks per exit, docs/next-level/reports/POLISH-T10.md).
   *
   * Why full-width strips and not square tiles (measured, POLISH-T12 report): during pans at the opening camera,
   * square tiles at the screen's left/right edges were re-rasterised and re-uploaded in most frames while the
   * whole-board mask was not (TileHarness + Perfetto). A strip spans the board's whole width, like BASE's mask, and
   * pans measured at BASE's cost.
   */
  private class Strip(val members: IntArray) {
    val shaft = Path()
    val head = Path()
    val markShaft = Path()
    val markHead = Path()
    var hasInk = false
    var hasMark = false
    var dirty = true
  }

  private class ExitSlot {
    var id = -1L
    var head: Path? = null
    var trail: Path? = null
    // POLISH-T8 (#8): the visible body is trail[travelled, travelled + bodyLength], cut with a
    // PathMeasure built once per exit into a reused Path. Skia's dash effect cuts its dashes
    // with the same SkPathMeasure::getSegment, so the geometry matches the DashPathEffect
    // (intervals [body, total + body], phase -travelled) it replaces, without a per-frame
    // Java + native SkPathEffect allocation or a dash pass over the whole trail.
    var measure: PathMeasure? = null
    val segment = Path()
    var bodyLength = 0f
    var totalLength = 0f
    var directionX = 0f
    var directionY = 0f
    var trailStrokeWidth = 1f
    var durationMs = 180L
    var startTimeMs = 0L
    var reducedMotion = false
    var fadeStart = EXIT_FADE_START
    var launch = 0f
    var endMs = Long.MAX_VALUE
    // POLISH-T10 fix round 1: the camera (the parent view's transform) when the exit started.
    var cameraX = 0f
    var cameraY = 0f
    var cameraScale = 1f

    val active: Boolean get() = trail != null

    fun clear() {
      id = -1L
      head = null
      trail = null
      measure = null
      segment.rewind()
      bodyLength = 0f
      totalLength = 0f
      directionX = 0f
      directionY = 0f
      startTimeMs = 0L
      reducedMotion = false
      fadeStart = EXIT_FADE_START
      launch = 0f
      endMs = Long.MAX_VALUE
      cameraX = 0f
      cameraY = 0f
      cameraScale = 1f
    }
  }

  private val stateLock = Any()
  private val arrowPaths = ArrayList<ArrowPaths>()
  // POLISH-T12: the static art per horizontal strip (top to bottom), each arrow's strip, and the layer each arrow was
  // last recorded in (LAYER_*), so a rebuild can find the strips whose membership changed.
  // POLISH-T5 (META_MISSED_MARK): visible arrows whose `markMask` char is '1' are
  // recorded in a strip's mark paths instead of its ink paths and drawn in the mark colour. The JS
  // side never sets markMask/markColor with the flag off, so those stay empty
  // and onDraw draws exactly what it drew before.
  private var strips: Array<Strip> = emptyArray()
  private var stripOf = IntArray(0)
  private var arrowLayer = ByteArray(0)
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
  private val markShaftPaint = Paint(shaftPaint)
  private val markHeadPaint = Paint(headPaint)
  private val trailPaint = Paint(shaftPaint)
  private val exitHeadPaint = Paint(headPaint)
  private val exitSlots = Array(MAX_CONCURRENT_EXITS) { ExitSlot() }

  // POLISH-T4 (META_BOARD_GRID): cell-centre dots and optional lane lines,
  // recorded under the arrows. The JS side never sets these props with the
  // flag off, so without them nothing below runs and onDraw is unchanged.
  private val gridDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    color = Color.TRANSPARENT
  }
  private val gridLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.BUTT
    color = Color.TRANSPARENT
  }
  private var gridValue = ""
  private var gridStyleValue = ""
  private var gridExtent: GridExtent? = null
  // PERF-only POLISH-T4 path (a 3-token gridStyle, EXPO_PUBLIC_PERF_GRID_POINTS): dots in
  // square blocks of GRID_BLOCK_CELLS cells, one drawPoints op per block, so the replayed
  // display list quick-rejects the (mostly off-screen) extent block by block. Built lazily,
  // only when that path is selected.
  private var gridPoints: Array<FloatArray>? = null
  private var gridLineSegments: FloatArray? = null
  private var gridStyled = false
  private var gridLinesOn = false
  private var gridDotRadius = 0f
  private var gridLineWidth = 0f
  // POLISH-T8 (#3, the shipped path): the zoom the stroke sizes were sent for (4-token
  // gridStyle). The grid is one drawRect over the extent, filled with a one-cell tile
  // (dot, plus the two lane lines when "#" is on) repeated by a BitmapShader whose local
  // matrix maps one tile onto one cell at the grid origin: one textured quad per frame,
  // whatever the number of dots on screen. 0 = the points path.
  private var gridTileScale = 0f
  private var gridTile: Bitmap? = null
  private val gridTilePaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val gridTileMatrix = Matrix()
  private var pathsDirty = false
  // dashSpan() output (UI thread, onDraw only).
  private var dashFrom = 0f
  private var dashTo = 0f

  private var visibleMask = ""
  private var markMask = ""
  private var hasMarkedArrows = false
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
      partitionStripsLocked()
      pathsDirty = true
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
        pathsDirty = true
      }
      postInvalidateOnAnimation()
    } finally {
      Trace.endSection()
    }
  }

  /** POLISH-T5: one char per arrow, '1' = draw this (visible) arrow in the mark colour. */
  internal fun setMarkMask(value: String) {
    if (value == markMask) return
    Trace.beginSection("ArrowsBoard.setMarkMask")
    try {
      synchronized(stateLock) {
        markMask = value
        pathsDirty = true
      }
      postInvalidateOnAnimation()
    } finally {
      Trace.endSection()
    }
  }

  /**
   * POLISH-T8 (#9): called once after every props commit (OnViewDidUpdateProps). A commit that
   * sets both visibleMask and markMask (a charging blocked tap, a marked arrow's exit) now
   * rebuilds the compound paths once instead of twice. onDraw rebuilds too if a draw ever
   * comes first, so a missed hook can never show stale paths.
   */
  internal fun commitProps() {
    synchronized(stateLock) {
      if (pathsDirty) rebuildCompoundPathsLocked()
    }
  }

  /** POLISH-T5: opaque #RRGGBB; malformed input falls back to the ink colour. */
  internal fun setMarkColor(value: String) {
    synchronized(stateLock) {
      val color = try {
        Color.parseColor(value)
      } catch (_: IllegalArgumentException) {
        shaftPaint.color
      }
      markShaftPaint.color = color
      markHeadPaint.color = color
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
      markShaftPaint.strokeWidth = strokeWidth
    }
    postInvalidateOnAnimation()
  }

  /**
   * Starts one of two bounded slither exits. Event format (board points):
   * `id,index,durationMs,reducedMotion,trailStrokeWidth,bodyLen,totalLen,dirX,dirY,n,x0,y0,...`
   * optionally followed by `,fadeStart,launch` (POLISH-T3, META_EXIT_TO_SCREEN_EDGE):
   * 10 + 2n tokens keep today's fade start (0.55) and k^2 travel; 12 + 2n set them. POLISH-T10: launch may be up
   * to 2 (an ease-out), and 13 + 2n adds `,endMs`, the clock at which the exit stops. POLISH-T12 (the POLISH-T10
   * same-frame start): a 12 + 2n or 13 + 2n exit starts one display frame ahead and draws in the frame that mounts it;
   * a 10 + 2n exit (flag OFF, reduced motion) keeps the old timing exactly.
   */
  internal fun setExitAnimation(value: String) {
    if (value.isBlank()) {
      clearExitAnimations()
      return
    }
    Trace.beginSection("ArrowsBoard.setExitAnimation")
    try {
      startExitAnimation(value)
    } finally {
      Trace.endSection()
    }
  }

  private fun startExitAnimation(value: String) {
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
    var endMs = Long.MAX_VALUE
    var hasMotion = false
    when (tokens.size) {
      pointTokenEnd -> Unit
      pointTokenEnd + EXIT_MOTION_TOKEN_COUNT, pointTokenEnd + EXIT_MOTION_TOKEN_COUNT + 1 -> {
        fadeStart = tokens[pointTokenEnd].toFloatOrNull() ?: return
        launch = tokens[pointTokenEnd + 1].toFloatOrNull() ?: return
        if (!fadeStart.isFinite() || fadeStart < 0f || fadeStart >= 1f) return
        // launch*k + (1-launch)*k^2 is increasing on [0, 1] for launch in [0, 2]; above 1 it is an ease-out.
        if (!launch.isFinite() || launch < 0f || launch > MAX_EXIT_LAUNCH) return
        hasMotion = true
        if (tokens.size == pointTokenEnd + EXIT_MOTION_TOKEN_COUNT + 1) {
          // POLISH-T10 fix round 1: the clock (ms) at which the whole arrow is past the pan-margin extent.
          endMs = tokens[pointTokenEnd + 2].toLongOrNull() ?: return
          if (endMs < 1L || endMs > durationMs) return
        }
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
      // The body is one segment of the trail (the Skia/SVG side draws the same span as one
      // dash of intervals [body, total + body]); see ExitSlot.measure.
      slot.measure = PathMeasure(trail, false)
      slot.bodyLength = bodyLength
      slot.totalLength = totalLength
      slot.directionX = directionX
      slot.directionY = directionY
      slot.trailStrokeWidth = trailStrokeWidth
      slot.durationMs = durationMs
      // POLISH-T12 (motion tokens only): the tap happened at least one frame before this mount, so the clock starts
      // one display frame back and the first frame drawn already shows the launch step, not the resting arrow.
      slot.startTimeMs = AnimationUtils.currentAnimationTimeMillis() -
        if (hasMotion) frameIntervalMs() else 0L
      slot.reducedMotion = reducedMotion
      slot.fadeStart = fadeStart
      slot.launch = launch
      slot.endMs = endMs
      val camera = parent as? View
      if (camera != null) {
        slot.cameraX = camera.translationX
        slot.cameraY = camera.translationY
        slot.cameraScale = camera.scaleX
      } else {
        slot.endMs = Long.MAX_VALUE // no camera to watch: run the whole ray
      }
    }
    if (hasMotion && Looper.myLooper() == Looper.getMainLooper()) {
      // POLISH-T12 (POLISH-T10 Part 2): Fabric mounts inside the Choreographer's animation callbacks, where
      // postInvalidateOnAnimation lands on the NEXT frame (traced: the board redrew one frame after the mount).
      // invalidate() joins this frame's traversal, so the exit starts in the same frame as the rest of the commit.
      // POLISH-T10 measured it too heavy while every exit re-rasterised the whole board; with the per-strip static
      // art (above) that frame re-rasterises one strip.
      invalidate()
    } else {
      postInvalidateOnAnimation()
    }
  }

  /** One display refresh in ms (16 at 60 Hz), for the exit head start. */
  private fun frameIntervalMs(): Long {
    val rate = display?.refreshRate ?: 0f
    val hz = if (rate.isFinite() && rate >= MIN_REFRESH_HZ) rate else DEFAULT_REFRESH_HZ
    return (1000f / hz).roundToInt().toLong()
  }

  /**
   * POLISH-T4 grid extent: `cell,minCol,minRow,maxCol,maxRow,#dot,#line` in board
   * points (dots at cell centres, lines through them across the extent). Blank
   * or malformed input draws no grid (fail closed, like geometry).
   */
  internal fun setGrid(value: String) {
    if (value == gridValue) return
    val parsed = if (value.isBlank()) null else parseGridExtent(value)
    synchronized(stateLock) {
      gridValue = value
      gridExtent = parsed
      gridPoints = null
      gridLineSegments = null
      if (parsed != null) {
        gridDotPaint.color = parsed.dotColor
        gridLinePaint.color = parsed.lineColor
      }
      rebuildGridLocked()
    }
    postInvalidateOnAnimation()
  }

  /**
   * Grid stroke: `dotRadius,lineWidth,lines(0|1)[,scale]` in board points, re-sent by JS
   * only on a 2^(1/4) zoom step, at pinch end, on fit or on the "#" toggle. With the 4th
   * token (POLISH-T8, shipped) the grid is the repeating tile rasterised for that zoom;
   * without it (PERF_GRID_POINTS builds only) it is the POLISH-T4 drawPoints path.
   */
  internal fun setGridStyle(value: String) {
    if (value == gridStyleValue) return
    val tokens = value.split(',')
    val radius = tokens.getOrNull(0)?.toFloatOrNull()
    val lineWidth = tokens.getOrNull(1)?.toFloatOrNull()
    val lines = tokens.getOrNull(2)
    val scale = if (tokens.size == GRID_STYLE_TILE_TOKEN_COUNT) tokens[3].toFloatOrNull() else 0f
    val valid = (tokens.size == GRID_STYLE_TOKEN_COUNT || tokens.size == GRID_STYLE_TILE_TOKEN_COUNT) &&
      radius != null && radius.isFinite() && radius > 0f &&
      lineWidth != null && lineWidth.isFinite() && lineWidth > 0f &&
      (lines == "0" || lines == "1") &&
      scale != null && scale.isFinite() && scale >= 0f
    synchronized(stateLock) {
      gridStyleValue = value
      gridStyled = valid
      if (valid) {
        gridDotRadius = radius!!
        gridLineWidth = lineWidth!!
        gridDotPaint.strokeWidth = radius * 2f
        gridLinePaint.strokeWidth = lineWidth
        gridLinesOn = lines == "1"
        gridTileScale = scale!!
      }
      rebuildGridLocked()
    }
    postInvalidateOnAnimation()
  }

  /**
   * Rebuilds whichever grid representation the current extent + style select. Runs only
   * from setGrid / setGridStyle, i.e. per level/theme/layout, per zoom step and per toggle.
   */
  private fun rebuildGridLocked() {
    val extent = gridExtent
    if (extent == null || !gridStyled) {
      gridTile = null
      gridTilePaint.shader = null
      return
    }
    if (gridTileScale <= 0f) {
      gridTile = null
      gridTilePaint.shader = null
      if (gridPoints == null) {
        gridPoints = gridPointBlocks(extent)
        gridLineSegments = gridLines(extent)
      }
      return
    }
    Trace.beginSection("ArrowsBoard.rebuildGridTile")
    try {
      val cell = extent.cell
      // One cell at the sent zoom, in device px (JS zoom is dp per board unit).
      val tilePx = (cell * gridTileScale * logicalPointScale).roundToInt()
        .coerceIn(1, MAX_GRID_TILE_PX)
      val k = tilePx / cell // tile px per board unit
      val tile = Bitmap.createBitmap(tilePx, tilePx, Bitmap.Config.ARGB_8888)
      val c = Canvas(tile)
      val mid = tilePx / 2f
      // Bottom to top, as the points path: lines, then the dot (opaque colours).
      if (gridLinesOn) {
        val linePaint = Paint(gridLinePaint).apply { strokeWidth = gridLineWidth * k }
        c.drawLine(0f, mid, tilePx.toFloat(), mid, linePaint)
        c.drawLine(mid, 0f, mid, tilePx.toFloat(), linePaint)
      }
      val dotPaint = Paint(gridDotPaint).apply { strokeWidth = gridDotRadius * 2f * k }
      c.drawPoint(mid, mid, dotPaint)
      val shader = BitmapShader(tile, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
      gridTileMatrix.setScale(cell / tilePx, cell / tilePx)
      gridTileMatrix.postTranslate(extent.minCol * cell, extent.minRow * cell)
      shader.setLocalMatrix(gridTileMatrix)
      // The old tile is dropped, not recycled: a recorded display list may still hold it.
      gridTile = tile
      gridTilePaint.shader = shader
    } finally {
      Trace.endSection()
    }
  }

  internal fun clearPaths() {
    clearExitAnimations()
    synchronized(stateLock) {
      arrowPaths.clear()
      strips = emptyArray()
      stripOf = IntArray(0)
      arrowLayer = ByteArray(0)
      visibleMask = ""
      markMask = ""
      hasMarkedArrows = false
      geometryIsValid = false
      hasVisibleArrows = false
      gridValue = ""
      gridStyleValue = ""
      gridExtent = null
      gridPoints = null
      gridLineSegments = null
      gridStyled = false
      gridTileScale = 0f
      gridTile = null
      gridTilePaint.shader = null
      pathsDirty = false
    }
  }

  override fun onDraw(canvas: Canvas) {
    var keepAnimating = false
    synchronized(stateLock) {
      if (pathsDirty) rebuildCompoundPathsLocked()
      val hasActiveExit = exitSlots.any { it.active }
      val drawArrows = geometryIsValid && (hasVisibleArrows || hasActiveExit)
      // POLISH-T4: the grid stays on a cleared board until the level ends.
      val extent = if (gridStyled) gridExtent else null
      val tileOn = extent != null && gridTilePaint.shader != null
      val pointBlocks = if (extent != null && !tileOn) gridPoints else null
      if (!drawArrows && !tileOn && pointBlocks == null) {
        return
      }

      // React Native lays this view out in density-independent points, while
      // Android Canvas paths use physical pixels. Geometry is serialized in
      // the same logical point space as the rest of BoardView, so apply the
      // display density exactly once at the native drawing boundary.
      val saveCount = canvas.save()
      canvas.scale(logicalPointScale, logicalPointScale)
      if (tileOn) {
        // Bottom to top: the grid tile (lines + dot per cell), then every arrow layer.
        val cell = extent!!.cell
        canvas.drawRect(
          extent.minCol * cell, extent.minRow * cell,
          (extent.maxCol + 1) * cell, (extent.maxRow + 1) * cell,
          gridTilePaint,
        )
      } else if (pointBlocks != null) {
        // Bottom to top: lines, dots, then every arrow layer.
        val lines = gridLineSegments
        if (gridLinesOn && lines != null) canvas.drawLines(lines, gridLinePaint)
        for (block in pointBlocks) canvas.drawPoints(block, gridDotPaint)
      }
      if (drawArrows && hasVisibleArrows) {
        // POLISH-T12: BASE's layer order (every shaft, every head, every marked shaft, every marked head), each layer
        // now one path per strip, top to bottom.
        val all = strips
        for (strip in all) if (strip.hasInk) canvas.drawPath(strip.shaft, shaftPaint)
        for (strip in all) if (strip.hasInk) canvas.drawPath(strip.head, headPaint)
        if (hasMarkedArrows) {
          for (strip in all) if (strip.hasMark) canvas.drawPath(strip.markShaft, markShaftPaint)
          for (strip in all) if (strip.hasMark) canvas.drawPath(strip.markHead, markHeadPaint)
        }
      }
      if (drawArrows && hasActiveExit) {
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
    if (slot.trail == null) return false
    val head = slot.head ?: return false
    val progress = ((nowMs - slot.startTimeMs).toFloat() / slot.durationMs.toFloat())
      .coerceIn(0f, 1f)
    if (progress >= 1f) {
      slot.clear()
      return false
    }
    // POLISH-T10 fix round 1: a flag-ON exit stops (and stops invalidating) at endMs, once the whole arrow is past
    // the pan-margin extent of the camera it started under; every frame before that is unchanged. Checked once, at
    // endMs: if the board was panned or zoomed meanwhile, the margin may be on screen, so the exit runs its whole ray
    // as before. Without the token endMs is Long.MAX_VALUE and this never runs.
    if (nowMs - slot.startTimeMs >= slot.endMs) {
      if (cameraMoved(slot)) {
        slot.endMs = Long.MAX_VALUE
      } else {
        slot.clear()
        return false
      }
    }

    // Same curve as ExitTrail (exitTravelFraction): launch*k + (1-launch)*k^2, which is
    // exactly k^2 at the default launch 0 and an ease-out for launch > 1 (POLISH-T10);
    // fades past fadeStart (default 55%).
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
    trailPaint.alpha = alpha
    exitHeadPaint.alpha = alpha
    val measure = slot.measure ?: return false
    slot.segment.rewind()
    dashSpan(travelled, slot.bodyLength, slot.totalLength)
    if (dashFrom < measure.length) {
      measure.getSegment(dashFrom, dashTo, slot.segment, true)
      canvas.drawPath(slot.segment, trailPaint)
    }

    val saveCount = canvas.save()
    canvas.translate(slot.directionX * travelled, slot.directionY * travelled)
    canvas.drawPath(head, exitHeadPaint)
    canvas.restoreToCount(saveCount)
    return true
  }

  /**
   * POLISH-T8 (#8): the span [dashFrom, dashTo) of the one visible dash of
   * DashPathEffect([body, total + body], -travelled), with Skia's own float arithmetic
   * (SkDashPath::CalcDashParameters + InternalFilter), so the segment is bit-identical to the dash it
   * replaces. Cutting at plain `travelled` differs by float rounding: the on-device check
   * (artifacts/POLISH-T8/scripts/ExitDashCheck.java) showed that as <= 9 px in 10 of 1842 frames.
   */
  private fun dashSpan(travelled: Float, body: Float, total: Float) {
    val gap = total + body
    val intervalLength = body + gap
    // phase = -travelled < 0: Skia negates it, wraps it and flips it.
    var phase = travelled
    if (phase > intervalLength) phase %= intervalLength
    phase = intervalLength - phase
    if (phase == intervalLength) phase = 0f
    // Skia walks the intervals to the one the phase falls in.
    if (!(phase > body || (phase == body && body != 0f))) {
      dashFrom = 0f; dashTo = body - phase // starts inside the dash
      return
    }
    phase -= body
    if (phase > gap || (phase == gap && gap != 0f)) {
      dashFrom = 0f; dashTo = body // rounding overflow: Skia restarts at dash 0
      return
    }
    dashFrom = gap - phase // after the leading gap
    dashTo = dashFrom + body
  }

  private fun cameraMoved(slot: ExitSlot): Boolean {
    val camera = parent as? View ?: return true
    return abs(camera.translationX - slot.cameraX) > CAMERA_STILL_PX ||
      abs(camera.translationY - slot.cameraY) > CAMERA_STILL_PX ||
      abs(camera.scaleX - slot.cameraScale) > CAMERA_STILL_SCALE
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
    // POLISH-T8 (#9): one section per rebuild, so a trace shows one rebuild per commit.
    Trace.beginSection("ArrowsBoard.rebuildCompoundPaths")
    try {
      rebuildCompoundPathsTraced()
    } finally {
      Trace.endSection()
    }
  }

  private fun rebuildCompoundPathsTraced() {
    pathsDirty = false
    hasVisibleArrows = false
    hasMarkedArrows = false

    if (!geometryIsValid) {
      return
    }

    // POLISH-T12: find the strips whose members changed layer (hidden / ink / mark) since the last rebuild ...
    for (index in arrowPaths.indices) {
      val layer = when {
        index >= visibleMask.length || visibleMask[index] != '1' -> LAYER_HIDDEN
        index < markMask.length && markMask[index] == '1' -> LAYER_MARK
        else -> LAYER_INK
      }
      if (arrowLayer[index] != layer) {
        arrowLayer[index] = layer
        strips[stripOf[index]].dirty = true
      }
    }
    // ... and rebuild only those, adding their arrows in board order (BASE's order within the strip). An unchanged
    // strip's paths are not touched, so their generation ids (and Skia's cached masks) survive.
    for (strip in strips) {
      if (strip.dirty) rebuildStripLocked(strip)
      if (strip.hasInk || strip.hasMark) hasVisibleArrows = true
      if (strip.hasMark) hasMarkedArrows = true
    }
  }

  private fun rebuildStripLocked(strip: Strip) {
    Trace.beginSection("ArrowsBoard.rebuildStrip")
    try {
      strip.dirty = false
      strip.shaft.reset()
      strip.head.reset()
      strip.markShaft.reset()
      strip.markHead.reset()
      strip.hasInk = false
      strip.hasMark = false
      for (index in strip.members) {
        val paths = arrowPaths[index]
        when (arrowLayer[index]) {
          LAYER_INK -> {
            strip.shaft.addPath(paths.shaft)
            strip.head.addPath(paths.head)
            strip.hasInk = true
          }
          LAYER_MARK -> {
            strip.markShaft.addPath(paths.shaft)
            strip.markHead.addPath(paths.head)
            strip.hasMark = true
          }
        }
      }
    } finally {
      Trace.endSection()
    }
  }

  /**
   * POLISH-T12: assigns every arrow of the (new) geometry to the strip holding its bounding-box centre. Strips with no
   * arrow are not created; the rest are ordered top to bottom and start dirty, so the next rebuild records them all.
   */
  private fun partitionStripsLocked() {
    val count = arrowPaths.size
    val row = IntArray(count) { floor(arrowPaths[it].centreY / STRIP_HEIGHT_PT).toInt() }
    val rows = row.distinct().sorted()
    val sizes = IntArray(rows.size)
    stripOf = IntArray(count) { index -> rows.binarySearch(row[index]).also { sizes[it]++ } }
    val members = Array(rows.size) { IntArray(sizes[it]) }
    val filled = IntArray(rows.size)
    for (index in 0 until count) {
      val strip = stripOf[index]
      members[strip][filled[strip]++] = index
    }
    strips = Array(rows.size) { Strip(members[it]) }
    arrowLayer = ByteArray(count) { LAYER_UNSET }
  }

  private class GridExtent(
    val cell: Float,
    val minCol: Int,
    val minRow: Int,
    val maxCol: Int,
    val maxRow: Int,
    val dotColor: Int,
    val lineColor: Int,
  )

  private fun parseGridExtent(value: String): GridExtent? {
    val tokens = value.split(',')
    if (tokens.size != GRID_TOKEN_COUNT) return null
    val cell = tokens[0].toFloatOrNull() ?: return null
    val minCol = tokens[1].toIntOrNull() ?: return null
    val minRow = tokens[2].toIntOrNull() ?: return null
    val maxCol = tokens[3].toIntOrNull() ?: return null
    val maxRow = tokens[4].toIntOrNull() ?: return null
    if (!cell.isFinite() || cell <= 0f) return null
    val cols = maxCol.toLong() - minCol.toLong() + 1L
    val rows = maxRow.toLong() - minRow.toLong() + 1L
    if (cols < 1L || rows < 1L || cols > MAX_GRID_AXIS_CELLS || rows > MAX_GRID_AXIS_CELLS) return null
    if (cols * rows > MAX_GRID_POINTS) return null
    val dotColor = try { Color.parseColor(tokens[5]) } catch (_: IllegalArgumentException) { return null }
    val lineColor = try { Color.parseColor(tokens[6]) } catch (_: IllegalArgumentException) { return null }
    return GridExtent(cell, minCol, minRow, maxCol, maxRow, dotColor, lineColor)
  }

  /** PERF-only points path: cell-centre dots in GRID_BLOCK_CELLS x GRID_BLOCK_CELLS blocks. */
  private fun gridPointBlocks(e: GridExtent): Array<FloatArray> {
    val cell = e.cell
    val blocks = ArrayList<FloatArray>()
    var blockRow = e.minRow
    while (blockRow <= e.maxRow) {
      val rowEnd = minOf(e.maxRow, blockRow + GRID_BLOCK_CELLS - 1)
      var blockCol = e.minCol
      while (blockCol <= e.maxCol) {
        val colEnd = minOf(e.maxCol, blockCol + GRID_BLOCK_CELLS - 1)
        val block = FloatArray((rowEnd - blockRow + 1) * (colEnd - blockCol + 1) * 2)
        var i = 0
        for (row in blockRow..rowEnd) {
          val y = (row + 0.5f) * cell
          for (col in blockCol..colEnd) {
            block[i++] = (col + 0.5f) * cell
            block[i++] = y
          }
        }
        blocks.add(block)
        blockCol = colEnd + 1
      }
      blockRow = rowEnd + 1
    }
    return blocks.toTypedArray()
  }

  /** PERF-only points path: one line per row and per column, through the cell centres. */
  private fun gridLines(e: GridExtent): FloatArray {
    val cell = e.cell
    val left = e.minCol * cell
    val right = (e.maxCol + 1) * cell
    val top = e.minRow * cell
    val bottom = (e.maxRow + 1) * cell
    val rows = e.maxRow - e.minRow + 1
    val cols = e.maxCol - e.minCol + 1
    val lines = FloatArray((rows + cols) * 4)
    var j = 0
    for (row in e.minRow..e.maxRow) {
      val y = (row + 0.5f) * cell
      lines[j++] = left; lines[j++] = y; lines[j++] = right; lines[j++] = y
    }
    for (col in e.minCol..e.maxCol) {
      val x = (col + 0.5f) * cell
      lines[j++] = x; lines[j++] = top; lines[j++] = x; lines[j++] = bottom
    }
    return lines
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

    // POLISH-T12: the strip key, from every shaft and head point (y values sit at odd coordinate indices).
    var minY = Float.POSITIVE_INFINITY
    var maxY = Float.NEGATIVE_INFINITY
    for (coordinateIndex in 1 until coordinates.size step 2) {
      minY = minOf(minY, coordinates[coordinateIndex])
      maxY = maxOf(maxY, coordinates[coordinateIndex])
    }

    return ArrowPaths(shaft, head, (minY + maxY) / 2f)
  }

  private companion object {
    const val DEFAULT_STROKE_WIDTH = 1f
    // POLISH-T12: strip height in board points (6.7 cells at BoardView's CELL = 40: level 1's 20 rows make 3 strips).
    // Measured, not picked (docs/next-level/reports/POLISH-T12.md, "Strip height"): every strip costs two more draws
    // per frame (~5 us each on the emulator's RenderThread; 160 pt = 5 strips put fit pans +0.08 ms over BASE, at the
    // edge of the null spread), and taller strips re-rasterise more per exit (TileHarness cost-sweep3/4: exit frame
    // 4.1 ms at 160 pt, 4.5 at 267, 5.7 at 400, BASE 8.7).
    const val STRIP_HEIGHT_PT = 267f
    const val LAYER_UNSET: Byte = -1
    const val LAYER_HIDDEN: Byte = 0
    const val LAYER_INK: Byte = 1
    const val LAYER_MARK: Byte = 2
    const val MAX_SHAFT_POINTS = 4096f
    const val MAX_TRAIL_POINTS = 4098
    const val HEAD_COORDINATE_COUNT = 6
    const val MAX_CONCURRENT_EXITS = 2
    const val EXIT_HEADER_TOKEN_COUNT = 10
    const val EXIT_MOTION_TOKEN_COUNT = 2
    const val MIN_EXIT_DURATION_MS = 160L
    const val MAX_EXIT_DURATION_MS = 1000L
    const val EXIT_FADE_START = 0.55f
    const val MAX_EXIT_LAUNCH = 2f
    const val DEFAULT_REFRESH_HZ = 60f
    const val MIN_REFRESH_HZ = 20f
    // POLISH-T10 fix round 1: camera changes below these count as "still" (half a device px; float noise on scale).
    const val CAMERA_STILL_PX = 0.5f // OWNER-PICKED STARTING VALUE
    const val CAMERA_STILL_SCALE = 1e-4f // OWNER-PICKED STARTING VALUE
    const val GRID_TOKEN_COUNT = 7
    const val GRID_STYLE_TOKEN_COUNT = 3
    const val GRID_STYLE_TILE_TOKEN_COUNT = 4
    // Guards a malformed scale; the largest real tile is ~40 dp x 1.7 zoom x 3.5 density = 238 px.
    const val MAX_GRID_TILE_PX = 1024 // OWNER-PICKED STARTING VALUE (bounds memory at 4 MB)
    const val MAX_GRID_AXIS_CELLS = 1024L
    const val MAX_GRID_POINTS = 100_000L
    const val GRID_BLOCK_CELLS = 8 // OWNER-PICKED STARTING VALUE (POLISH-T4 frame-cost fix)
  }
}

package com.danteb.arrows.board

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.CornerPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.RectF
import kotlin.math.cos
import kotlin.math.sin

/** Procedural art. A strip replays seven compound paths, never individual arrow pieces. */
class Art03Paths(val cell: Float) {
  class Layers {
    val paths = Array(8) { Path() }
    val simple = Array(2) { Path() }
    val closedEyes = Path()
    val bounds = RectF()
    var tailX = 0f
    var tailY = 0f
    fun rewind() { paths.forEach { it.rewind() }; simple.forEach { it.rewind() }; closedEyes.rewind() }
    fun add(art: Layers, detail: Int) {
      if (detail == 2) for (i in paths.indices) paths[i].addPath(art.paths[i])
      if (detail == 1) for (i in simple.indices) simple[i].addPath(art.simple[i])
    }
  }
  private val colors = intArrayOf(0x285D3521, 0xFFB57442.toInt(), 0xFFE6AE71.toInt(),
    0xFF9A5B32.toInt(), 0xE8FFFFFF.toInt(), 0xFF9A5B32.toInt(), 0xFFF1A0A0.toInt(), 0xFF633B28.toInt())
  private val paints = Array(8) { i -> Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = colors[i]; style = if (i == 5) Paint.Style.STROKE else Paint.Style.FILL
    strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    strokeWidth = cell * when(i) { 3 -> .07f; 4 -> .09f; else -> .035f }
  } }
  private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
  private val bendEffect = CornerPathEffect(cell * .16f)
  private val headEffect = CornerPathEffect(cell * .06f)
  private val sides = intArrayOf(-1, 1)
  private val roundHead = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; pathEffect = headEffect }
  private val scratch = Path()
  private val rounded = Path()
  private val measure = PathMeasure()
  private val position = FloatArray(2)
  private val tangent = FloatArray(2)
  private val oval = RectF()
  private var icingEdge = FloatArray(128)
  private val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFD7A5.toInt(); style = Paint.Style.STROKE; strokeWidth = cell * .16f }
  private val flat = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors[1]; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }

  fun build(shaft: Path, head: Path, detail: Int = 2): Layers = Layers().also { buildInto(it, shaft, head, detail) }

  /** Reused scratch and destination also support the one moving arrow; no bitmap or tile loop. */
  fun buildInto(out: Layers, shaft: Path, head: Path, detail: Int = 2) {
    out.rewind()
    if (detail == 0) {
      outline.pathEffect = null; outline.strokeWidth = cell * .144f
      outline.getFillPath(shaft, out.paths[1]); out.paths[1].addPath(head)
      out.simple[0].addPath(out.paths[1]); out.paths[1].computeBounds(out.bounds, true)
      return
    }
    outline.pathEffect = bendEffect
    for (layer in 1..2) {
      outline.strokeWidth = cell * if (layer == 1) .38f else .33f
      outline.getFillPath(shaft, scratch); out.simple[layer - 1].addPath(scratch)
      roundHead.getFillPath(head, rounded)
      out.simple[layer - 1].addPath(rounded)
      if (layer == 1) {
        outline.pathEffect = headEffect; outline.strokeWidth = cell * .045f
        outline.getFillPath(head, scratch); out.simple[0].addPath(scratch)
        outline.pathEffect = bendEffect
      }
      out.paths[layer].addPath(out.simple[layer - 1])
    }
    if (detail == 1) { out.paths[1].computeBounds(out.bounds, true); return }
    measure.setPath(shaft, false)
    val length = measure.length
    measure.getPosTan(0f, position, tangent)
    out.tailX = position[0]; out.tailY = position[1]
    out.paths[1].addCircle(out.tailX, out.tailY, cell * .31f, Path.Direction.CW)
    out.paths[2].addCircle(out.tailX, out.tailY, cell * .265f, Path.Direction.CW)
    out.paths[0].addPath(out.paths[1], cell * .08f, cell * .08f)
    // Stripe is dashed; icing is a single tapered ribbon, baked once into the strip.
    var distance = cell * .35f
    while (distance < length) {
      measure.getSegment(distance, minOf(distance + cell * .25f, length), out.paths[3], true)
      distance += cell * .48f
    }
    val start = minOf(cell * .31f, length)
    val steps = maxOf(1, kotlin.math.ceil((length - start) / (cell * .10f)).toInt())
    if (icingEdge.size < (steps + 1) * 2) icingEdge = FloatArray((steps + 1) * 2)
    if (length > start) {
      for (i in 0..steps) {
        val d = start + (length - start) * i / steps
        measure.getPosTan(d, position, tangent)
        val wave = sin(d / cell * Math.PI * 2.2).toFloat() * cell * .035f
        val x = position[0] - tangent[1] * wave - cell * .035f
        val y = position[1] + tangent[0] * wave - cell * .035f
        // Fade by tapering over the final cell; no per-arrow gradient or extra draw.
        val fade = ((length - d) / cell).coerceIn(0f, 1f)
        val half = cell * .045f * fade * fade * (3f - 2f * fade)
        val nx = -tangent[1] * half; val ny = tangent[0] * half
        if (i == 0) out.paths[4].moveTo(x + nx, y + ny) else out.paths[4].lineTo(x + nx, y + ny)
        icingEdge[i * 2] = x - nx; icingEdge[i * 2 + 1] = y - ny
      }
      for (i in steps downTo 0) out.paths[4].lineTo(icingEdge[i * 2], icingEdge[i * 2 + 1])
      out.paths[4].close()
    }
    // An oval entirely inside the triangle, oriented along its exit axis.
    measure.getPosTan(length, position, tangent)
    val baseX = position[0]; val baseY = position[1]
    measure.setPath(head, true); measure.getPosTan(0f, position, tangent)
    val dx = position[0] - baseX; val dy = position[1] - baseY
    val cx = baseX + dx * .42f; val cy = baseY + dy * .42f
    val horizontal = kotlin.math.abs(dx) > kotlin.math.abs(dy)
    val rx = cell * if (horizontal) .085f else .035f
    val ry = cell * if (horizontal) .035f else .085f
    out.paths[4].addOval(cx - rx, cy - ry, cx + rx, cy + ry, Path.Direction.CW)
    for (i in 0..32) {
      val t = i / 32f
      val angle = t * Math.PI * 3.6
      val radius = cell * (.035f + .17f * t)
      val x = out.tailX + cos(angle).toFloat() * radius
      val y = out.tailY + sin(angle).toFloat() * radius
      if (i == 0) out.paths[5].moveTo(x, y) else out.paths[5].lineTo(x, y)
    }
    val x = out.tailX; val y = out.tailY
    // Faces use screen axes regardless of the shaft's direction.
    for (side in sides) {
      out.paths[6].addOval(x + side * cell * .16f - cell * .055f, y + cell * .075f,
        x + side * cell * .16f + cell * .055f, y + cell * .13f, Path.Direction.CW)
      out.paths[7].addCircle(x + side * cell * .095f, y + cell * .005f, cell * .021f, Path.Direction.CW)
      scratch.rewind(); oval.set(x + side * cell * .095f - cell * .04f, y - cell * .025f,
        x + side * cell * .095f + cell * .04f, y + cell * .035f)
      scratch.addArc(oval, 10f, 160f)
      outline.pathEffect = null; outline.strokeWidth = cell * .025f
      outline.getFillPath(scratch, rounded); out.closedEyes.addPath(rounded)
    }
    scratch.rewind(); oval.set(x - cell * .045f, y + cell * .035f, x + cell * .045f, y + cell * .115f)
    scratch.addArc(oval, 10f, 160f); outline.strokeWidth = cell * .018f
    outline.getFillPath(scratch, rounded); out.paths[7].addPath(rounded); out.closedEyes.addPath(rounded)
    // Stripe and spiral share one filled compound layer with their own baked widths.
    outline.pathEffect = null; outline.strokeWidth = cell * .07f
    outline.getFillPath(out.paths[3], scratch); out.paths[3].set(scratch)
    outline.strokeWidth = cell * .035f
    outline.getFillPath(out.paths[5], scratch); out.paths[3].addPath(scratch); out.paths[5].rewind()
    out.paths[1].computeBounds(out.bounds, true)
  }

  /** Returns the actual number of static layer draws: 7/5 full, 2 medium. */
  fun draw(canvas: Canvas, art: Layers, screenCell: Float, alpha: Int = 255, eyesClosed: Boolean = false): Int {
    if (screenCell < 24f) {
      for (i in 0..1) { paints[i + 1].alpha = alpha; canvas.drawPath(art.simple[i], paints[i + 1]) }
      return 2
    }
    val face = screenCell >= 28f
    for (i in paints.indices) {
      if (i == 5 || !face && i >= 6) continue
      val paint = paints[i]
      paint.alpha = if (i == 0) alpha * 40 / 255 else alpha
      canvas.drawPath(if (i == 7 && eyesClosed) art.closedEyes else art.paths[i], paint)
    }
    return if (face) 7 else 5
  }

  fun drawFlat(canvas: Canvas, shaft: Path, head: Path, width: Float, alpha: Int = 255): Int {
    flat.alpha = alpha; flat.style = Paint.Style.STROKE; flat.strokeWidth = width
    canvas.drawPath(shaft, flat); flat.style = Paint.Style.FILL; canvas.drawPath(head, flat)
    return 2
  }
  fun buildMark(shaft: Path, head: Path, width: Float, destination: Path) {
    destination.rewind(); outline.pathEffect = null; outline.strokeWidth = width
    outline.getFillPath(shaft, destination); destination.addPath(head)
  }

  fun drawGlow(canvas: Canvas, art: Layers, opacity: Float) {
    glow.alpha = (opacity * 255).toInt().coerceIn(0, 255)
    canvas.drawPath(art.paths[1], glow)
  }
}

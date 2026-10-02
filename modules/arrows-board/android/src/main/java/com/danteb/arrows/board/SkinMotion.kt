package com.danteb.arrows.board

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.RectF
import android.view.animation.PathInterpolator
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.cos

/** Bounded interaction state, allocated only for the selected Android skin. No idle clock. */
internal class SkinMotion(private val cell: Float, private val spec: SkinSpec) {
  private val ease = PathInterpolator(.23f, 1f, .32f, 1f)
  private var pressed = -1
  private var release = -1
  private var pressAt = 0L
  private var releaseAt = 0L
  private var pressFrom = 1f
  private var releaseFrom = 1f
  private var releaseVelocity = 0f
  private var bump = -1
  private var bumpAt = 0L
  private var bumpId = -1L
  private var blocker = -1
  private var blockerAt = 0L
  private var blockerId = -1L
  private var hint = -1
  private var hintAt = 0L
  private var hintId = -1L
  var reduced = false
  var holdBlockedInk = false
  private val flash = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE4327D.toInt() }
  var blockedColour: Int
    get() = flash.color
    set(value) { flash.color = value }
  internal fun activeParticleCount() = crumbs.count { it.born >= 0L }
  private val crumbPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val rectangle = RectF()
  private class Crumb {
    var born = -1L; var life = 350L; var x = 0f; var y = 0f
    var dx = 0f; var dy = 0f; var color = 0
  }
  private val crumbs = Array(24) { Crumb() }
  private var nextCrumb = 0
  private val measure = PathMeasure()
  private val pos = FloatArray(2)
  private val tan = FloatArray(2)

  fun update(value: String, now: Long): Boolean {
    val tokens = value.split(',')
    if (tokens.size != 7) return false
    val p = tokens[0].toIntOrNull() ?: return false
    val bId = tokens[1].toLongOrNull() ?: return false
    val b = tokens[2].toIntOrNull() ?: return false
    val blockId = tokens[3].toLongOrNull() ?: return false
    val block = tokens[4].toIntOrNull() ?: return false
    val hId = tokens[5].toLongOrNull() ?: return false
    val h = tokens[6].toIntOrNull() ?: return false
    if (p != pressed) {
      val current = scaleAt(now)
      val velocity = (current - scaleAt(now - 1)) * 1000f
      release = if (p < 0) pressed else -1
      releaseAt = now; releaseFrom = current; releaseVelocity = velocity
      pressFrom = current; pressed = p; pressAt = now
    }
    if (bId != bumpId) { bumpId = bId; bump = b; bumpAt = now }
    if (blockId != blockerId) { blockerId = blockId; blocker = block; blockerAt = now }
    if (hId != hintId) { hintId = hId; hint = h; hintAt = now }
    return true
  }

  fun excludes(index: Int, now: Long): Boolean = index == pressed ||
    (!reduced && index == release && now - releaseAt < 620L) || (index == bump && now - bumpAt < 300L)

  fun hasActiveInteraction(now: Long): Boolean = pressed >= 0 ||
    (!reduced && release >= 0 && now - releaseAt < 620L) ||
    (bump >= 0 && now - bumpAt < 300L) || (blocker >= 0 && now - blockerAt < 650L) ||
    (!reduced && hint >= 0 && now - hintAt < 1200L)

  internal fun scaleAt(now: Long): Float {
    if (reduced) return 1f
    if (pressed >= 0) return pressFrom + (spec.pressScale - pressFrom) * ease.getInterpolation(((now - pressAt) / 90f).coerceIn(0f, 1f))
    if (release < 0 || now - releaseAt >= 620L) return 1f
    // The existing PressScale spring: mass 1, stiffness 400, damping 15, energy threshold 1e-4.
    val t = maxOf(0L, now - releaseAt) / 1000f
    val omega = kotlin.math.sqrt(400f - 7.5f * 7.5f)
    val displacement = releaseFrom - 1f
    return 1f + exp(-7.5f * t) * (displacement * cos(omega * t) +
      (releaseVelocity + 7.5f * displacement) / omega * sin(omega * t))
  }

  fun draw(canvas: Canvas, renderer: SkinPaths, arts: List<SkinPaths.Layers?>, artAt: (Int) -> SkinPaths.Layers,
           shafts: List<Path>, heads: List<Path>, screenCell: Float, width: Float, now: Long): Boolean {
    var animate = false
    val pressIndex = if (pressed >= 0) pressed else if (!reduced && now - releaseAt < 620L) release else -1
    if (pressIndex in arts.indices) {
      val art = artAt(pressIndex)
      val save = canvas.save(); val scale = scaleAt(now)
      canvas.scale(scale, scale, art.bounds.centerX(), art.bounds.centerY())
      renderer.draw(canvas, art, screenCell)
      canvas.restoreToCount(save)
      animate = !reduced && (pressed >= 0 && now - pressAt < 90L || pressed < 0 && now - releaseAt < 620L)
    }
    if (bump in arts.indices && now - bumpAt < 300L) {
      val k = ((now - bumpAt) / 300f).coerceIn(0f, 1f)
      val d = if (reduced) 0f else .5f * sin(Math.PI.toFloat() * k) * exp(-2f * k) * cell
      measure.setPath(heads[bump], true); measure.getPosTan(0f, pos, tan)
      // Tip -> base-left tangent is diagonal; the head's bounds locate the axial direction from shaft end.
      val tipX = pos[0]; val tipY = pos[1]
      measure.setPath(shafts[bump], false); measure.getPosTan(measure.length, pos, tan)
      val dx = tipX - pos[0]; val dy = tipY - pos[1]; val length = kotlin.math.hypot(dx, dy)
      val save = canvas.save(); if (length > 0f) canvas.translate(dx / length * d, dy / length * d)
      renderer.draw(canvas, artAt(bump), screenCell, eyesClosed = true)
      flash.alpha = if (reduced) 160 else ((1f - if (holdBlockedInk && k < .3195f) 0f else k) * 110).toInt()
      canvas.drawPath(artAt(bump).simple[0], flash)
      canvas.restoreToCount(save); animate = true
    }
    if (blocker in arts.indices && now - blockerAt < 650L) {
      val k = (now - blockerAt) / 650f
      flash.alpha = if (reduced) 160 else (160 * (1f - k)).toInt()
      canvas.drawPath(artAt(blocker).simple[0], flash); animate = true
    }
    if (hint in arts.indices) {
      val elapsed = now - hintAt
      val opacity = if (reduced) .35f else if (elapsed < 1200L) .35f * sin(Math.PI.toFloat() * elapsed / 1200f) else 0f
      if (opacity > 0f) renderer.drawGlow(canvas, artAt(hint), opacity)
      if (!reduced && elapsed < 1200L) animate = true
    }
    if (!reduced) for (crumb in crumbs) {
      if (crumb.born < 0L) continue
      val k = (now - crumb.born).toFloat() / crumb.life
      if (k >= 1f) { crumb.born = -1L; continue }
      val e = ease.getInterpolation(k.coerceIn(0f, 1f))
      crumbPaint.color = crumb.color; crumbPaint.alpha = ((1f - k) * 210).toInt()
      val save = canvas.save(); canvas.translate(crumb.x + crumb.dx * e, crumb.y + crumb.dy * e)
      canvas.rotate(e * 65f)
      val half = cell * spec.particleSize; rectangle.set(-half, -half, half, half)
      canvas.drawRoundRect(rectangle, half * .4f, half * .4f, crumbPaint); canvas.restoreToCount(save)
      animate = true
    }
    return animate
  }

  fun cancel(index: Int) {
    if (pressed == index) pressed = -1
    if (release == index) release = -1
    if (bump == index) bump = -1
  }

  fun emit(shaft: Path, now: Long) {
    if (reduced) return
    measure.setPath(shaft, false)
    for (i in 0 until spec.particleCount) {
      measure.getPosTan(measure.length * (i + .5f) / maxOf(1, spec.particleCount).toFloat(), pos, tan)
      val crumb = crumbs[nextCrumb]; nextCrumb = (nextCrumb + 1) % crumbs.size
      crumb.born = now; crumb.life = spec.particleLife + i * 30L; crumb.x = pos[0]; crumb.y = pos[1]
      val side = if (i % 2 == 0) 1f else -1f
      crumb.dx = -tan[1] * side * cell * .45f + tan[0] * cell * .2f
      crumb.dy = tan[0] * side * cell * .45f + tan[1] * cell * .2f
      crumb.color = spec.particleColours[i % spec.particleColours.size]
    }
  }
}

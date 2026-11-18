package com.danteb.arrows.board

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.view.animation.PathInterpolator
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * WINTER-01 seasonal exit snow (owner + Fable/Emil consult 2026-11-18). Drawn in the board's own canvas pass, in board
 * coordinates, from one fixed pool: no allocation per exit, no idle clock (it asks for frames only while particles live).
 *
 *  - kick (every exit): 4 soft dots shaken off the vacated path, 480 ms + 25 ms stagger, so a puff is over before the
 *    next tap at 3 taps/s; size and angle vary by exit id, never by a per-frame random.
 *  - streak: from the 3rd exit within 600 ms of the previous one, +1 six-arm flake (520 ms, 0 -> 90 deg).
 *  - lucky: exit id % 23 == 0, one big flake floats down 1.2 cells over 1.4 s with a gentle sway.
 *  - last arrow: a 16-particle flurry along the whole path (dots + flakes), emitted progressively, ~1 s.
 * Mode 2 ("lite") is the base dots only; mode 0 draws nothing. Reduced motion: the caller never emits.
 */
internal class SnowFx {
  var mode = 0
  var dark = false
  var diag = false
  private val ease = PathInterpolator(.23f, 1f, .32f, 1f)
  private class P {
    var born = -1L; var life = 380L; var x = 0f; var y = 0f; var dx = 0f; var dy = 0f; var gravity = 0f
    var radius = 0f; var endScale = .6f; var flake = false; var spin = 0f; var sway = 0f; var alpha = 1f; var colour = 0
    var rim = false
  }
  private val pool = Array(POOL) { P() }
  private var next = 0
  private var lastEmit = -1L
  private var streak = 0
  private val measure = PathMeasure()
  private val pos = FloatArray(2)
  private val tan = FloatArray(2)
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = RIM }
  private val flakePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
  /** Unit six-arm flake (radius 1) with a pair of small barbs per arm; scaled per particle at draw time. */
  private val flakePath = Path().apply {
    for (arm in 0 until 6) {
      val a = arm * PI.toFloat() / 3f
      val cx = cos(a); val sy = sin(a)
      moveTo(0f, 0f); lineTo(cx, sy)
      val bx = cx * .55f; val by = sy * .55f
      for (side in intArrayOf(-1, 1)) {
        val b = a + side * PI.toFloat() / 4f
        moveTo(bx, by); lineTo(bx + cos(b) * .3f, by + sin(b) * .3f)
      }
    }
  }

  fun activeCount() = pool.count { it.born >= 0L }

  fun configure(value: String) {
    val t = value.split(',')
    mode = t.getOrNull(0)?.toIntOrNull()?.takeIf { it in 0..2 } ?: 0
    dark = t.getOrNull(1) == "1"
    diag = t.getOrNull(2) == "1"
    if (mode == 0) for (p in pool) p.born = -1L
  }

  private fun dotColour(k: Int) = if (dark) DARK_DOTS[k % DARK_DOTS.size] else LIGHT_DOTS[k % LIGHT_DOTS.size]

  private fun take(): P { val p = pool[next]; next = (next + 1) % pool.size; return p }

  private fun at(fraction: Float): Boolean {
    if (measure.length <= 0f) return false
    return measure.getPosTan(measure.length * fraction.coerceIn(0f, 1f), pos, tan)
  }

  /** One exit. `shaft` is the arrow's resting shaft (board coords); `last` = no other arrow is left on the board. */
  fun emit(shaft: Path, cell: Float, screenCell: Float, exitId: Long, last: Boolean, now: Long) {
    if (mode == 0) return
    // Owner 2026-11-18 "barely see it": sizes are fractions of a cell with a floor in dp, so dense boards still show it.
    val dp = cell / screenCell.coerceAtLeast(1f) // board units per dp (screenCell arrives from JS in dp)
    fun size(frac: Float, minDp: Float) = maxOf(cell * frac, minDp * dp)
    measure.setPath(shaft, false)
    streak = if (lastEmit >= 0L && now - lastEmit < STREAK_GAP_MS) streak + 1 else 1
    lastEmit = now
    val seed = (exitId and 0x7fffffff).toInt()
    var count = 0
    for (i in 0 until 4) {
      if (!at((i + .5f) / 4f)) continue
      val side = if ((i + seed) % 2 == 0) 1f else -1f
      val jitter = (((seed * 31 + i * 17) % 41) - 20) * PI.toFloat() / 180f // +-20 deg, fixed per exit
      val nx = -tan[1] * side; val ny = tan[0] * side
      val cj = cos(jitter); val sj = sin(jitter)
      val p = take()
      p.born = now + i * 25L; p.life = 480L; p.x = pos[0]; p.y = pos[1]
      p.dx = (nx * cj - ny * sj) * cell * .6f - tan[0] * cell * .12f
      p.dy = (nx * sj + ny * cj) * cell * .6f - tan[1] * cell * .12f
      p.gravity = cell * .22f; p.radius = size(DOT_DIAMETERS[(seed + i) % 3] / 2f, 4.5f); p.endScale = .7f
      p.flake = false; p.spin = 0f; p.sway = 0f; p.alpha = 1f; p.colour = dotColour(seed + i); p.rim = !dark
      count++
    }
    var extras = ""
    if (mode == 1) {
      if (streak >= 3 && at(.5f)) {
        val p = take(); val side = if (seed % 2 == 0) 1f else -1f
        p.born = now; p.life = 640L; p.x = pos[0]; p.y = pos[1]
        p.dx = -tan[1] * side * cell * .5f - tan[0] * cell * .12f; p.dy = tan[0] * side * cell * .5f - tan[1] * cell * .12f
        p.gravity = cell * .3f; p.radius = size(.42f, 14f); p.endScale = .8f; p.flake = true; p.spin = 90f; p.sway = 0f
        p.alpha = 1f; p.colour = flakeColour(); p.rim = false; count++; extras += " streak=$streak"
      }
      if (exitId % LUCKY_EVERY == 0L && at(.5f)) {
        val p = take()
        p.born = now + 60L; p.life = 1400L; p.x = pos[0]; p.y = pos[1]; p.dx = 0f; p.dy = cell * 1.2f
        p.gravity = 0f; p.radius = size(.5f, 18f); p.endScale = 1f; p.flake = true; p.spin = 60f; p.sway = cell * .15f
        p.alpha = .8f; p.colour = flakeColour(); p.rim = false; count++; extras += " lucky"
      }
      if (last) {
        for (i in 0 until 16) {
          if (!at((i + .5f) / 16f)) continue
          val flake = i % 8 >= 5 // 10 dots, 6 flakes
          val side = if (i % 2 == 0) 1f else -1f
          val p = take()
          p.born = now + i * 22L; p.life = if (flake) 900L else 620L; p.x = pos[0]; p.y = pos[1]
          p.dx = -tan[1] * side * cell * (.35f + (i % 3) * .1f); p.dy = tan[0] * side * cell * (.35f + (i % 3) * .1f)
          p.gravity = cell * .6f; p.radius = if (flake) size(.38f, 12f) else size(DOT_DIAMETERS[i % 3] / 2f, 4.5f)
          p.endScale = if (flake) .8f else .6f; p.flake = flake; p.spin = if (flake) 120f else 0f; p.sway = 0f
          p.alpha = 1f; p.colour = if (flake) flakeColour() else dotColour(i); p.rim = !dark && !flake; count++
        }
        extras += " last"
      }
    }
    if (diag) android.util.Log.i("SnowFx", "emit id=$exitId n=$count mode=$mode$extras active=${activeCount()}")
  }

  private fun flakeColour() = if (dark) Color.WHITE else FLAKE_LIGHT

  /** Returns true while any particle still needs frames. */
  fun draw(canvas: Canvas, cell: Float, now: Long): Boolean {
    var alive = false
    for (p in pool) {
      if (p.born < 0L) continue
      alive = true
      if (now < p.born) continue // staggered: waiting its turn
      val k = (now - p.born).toFloat() / p.life
      if (k >= 1f) { p.born = -1L; continue }
      val e = ease.getInterpolation(k)
      val fade = if (k < .4f) 1f else 1f - (k - .4f) / .6f
      val x = p.x + p.dx * e + if (p.sway != 0f) sin(k * 2f * PI.toFloat()) * p.sway else 0f
      val y = p.y + p.dy * (if (p.sway != 0f) k else e) + p.gravity * k * k
      val r = p.radius * (1f + (p.endScale - 1f) * e)
      val a = (p.alpha * fade * 255f).toInt().coerceIn(0, 255)
      if (p.flake) {
        val save = canvas.save()
        canvas.translate(x, y); canvas.rotate(p.spin * e); canvas.scale(r, r)
        flakePaint.color = p.colour; flakePaint.alpha = a; flakePaint.strokeWidth = .18f // unit space: canvas is scaled by r
        canvas.drawPath(flakePath, flakePaint)
        canvas.restoreToCount(save)
      } else {
        fill.color = p.colour; fill.alpha = a
        canvas.drawCircle(x, y, r, fill)
        if (p.rim) { rimPaint.strokeWidth = r * .14f; rimPaint.alpha = (a * .45f).toInt(); canvas.drawCircle(x, y, r, rimPaint) }
      }
    }
    return alive
  }

  fun clear() { for (p in pool) p.born = -1L; lastEmit = -1L; streak = 0 }

  companion object {
    const val POOL = 40 // 4 base + 1 streak + 1 lucky per exit, plus the 16-particle last-arrow flurry
    const val STREAK_GAP_MS = 600L
    const val LUCKY_EVERY = 23L
    val DOT_DIAMETERS = floatArrayOf(.34f, .42f, .50f)
    // Light board #EEF4FB: white alone vanishes, so white dots carry a slate rim and two of four are blue.
    val LIGHT_DOTS = intArrayOf(Color.WHITE, 0xFF9CC6EE.toInt(), Color.WHITE, 0xFF7FB2E5.toInt())
    val DARK_DOTS = intArrayOf(Color.WHITE, 0xFFDCEFFF.toInt(), 0xFFBFE3FF.toInt())
    val FLAKE_LIGHT = 0xFF7FB2E5.toInt()
    val RIM = 0xFF6E88A8.toInt()
  }
}

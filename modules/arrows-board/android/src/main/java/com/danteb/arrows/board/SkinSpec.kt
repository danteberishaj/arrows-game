package com.danteb.arrows.board

import android.graphics.Color
import org.json.JSONObject

/** A parsed selection, never consulted by skin id. Fractions remain in cell units. */
class SkinSpec(json: String) {
  data class Layer(val kind: String, val colour: Int?, val width: Float, val dx: Float, val dy: Float,
    val amplitude: Float, val period: Float, val fade: Float, val bands: IntArray, val fadeFraction: Float, val sideOffset: Float, val opacity: Float, val dash: FloatArray, val bandWidths: FloatArray, val tailPalette: Boolean, val fillHalf: Boolean)
  val source = JSONObject(json)
  val id = source.getString("id")
  private val palette = source.getJSONObject("palette")
  val rule = palette.getString("rule")
  val lengthStops = palette.optJSONArray("lengthStops")?.let { a -> IntArray(a.length()) { a.getInt(it) } }
  val colours = palette.getJSONArray("colours").let { a -> IntArray(a.length()) { Color.parseColor(a.getString(it)) } }
  val layers = source.getJSONArray("layers").let { a -> List(a.length()) { i ->
    val o = a.getJSONObject(i); val dash = o.optJSONArray("dash"); val widths = o.optJSONArray("bandWidths"); val offset = o.optJSONArray("offset"); val bands = o.optJSONArray("bands")
    Layer(o.getString("kind"), if(o.getString("colour") in listOf("palette", "tailPalette")) null else Color.parseColor(o.getString("colour")),
      o.getDouble("width").toFloat(), offset?.optDouble(0, 0.0)?.toFloat() ?: 0f, offset?.optDouble(1, 0.0)?.toFloat() ?: 0f,
      o.optDouble("amplitude", 0.0).toFloat(), o.optDouble("period", .5).toFloat(), o.optDouble("fadeCells", 0.0).toFloat(),
      if(bands == null) IntArray(0) else IntArray(bands.length()) { Color.parseColor(bands.getString(it)) },
      o.optDouble("fadeFraction",1.0).toFloat(), o.optDouble("sideOffset",0.0).toFloat(), o.optDouble("opacity", if(o.getString("kind") == "shadow") 35.0/255.0 else 1.0).toFloat(),
      if(dash == null) FloatArray(0) else FloatArray(dash.length()) { dash.getDouble(it).toFloat() },
      if(widths == null) FloatArray(0) else FloatArray(widths.length()) { widths.getDouble(it).toFloat() }, o.getString("colour") == "tailPalette", o.optBoolean("fillHalf",true))
  } }
  private val head = source.getJSONObject("head")
  val headShape = head.getString("shape"); val halfWidth = head.getDouble("halfWidth").toFloat()
  val tip = head.getDouble("tipPastCentre").toFloat(); val back = head.getDouble("back").toFloat()
  val headShine = head.getBoolean("shine")
  val headCornerRadius = head.optDouble("cornerRadius", 0.0).toFloat()
  private val tail = source.getJSONObject("tail")
  val tailKind = tail.getString("kind"); val tailRadius = tail.getDouble("radius").toFloat(); val tailRim = tail.getDouble("rim").toFloat()
  val oneCellTail = tail.getString("oneCell")
  val tailColours = tail.optJSONArray("colours")?.let { a -> IntArray(a.length()) { Color.parseColor(a.getString(it)) } } ?: IntArray(0)
  val bodyPattern = source.optString("bodyPattern", "tube")
  private val beads = source.optJSONObject("beads")
  val beadDiameter = beads?.getDouble("diameter")?.toFloat()
  val beadPitch = beads?.getDouble("pitch")?.toFloat() ?: .25f
  val beadTubeWidth = beads?.getDouble("tubeWidth")?.toFloat()
  val faceAnchor get() = face.optString("anchor", "tail")
  val roundedBends = source.getString("bends") == "rounded"
  private val face = source.getJSONObject("face")
  val eyes = face.getBoolean("eyes"); val blush = face.getBoolean("blush"); val closedOnBlocked = face.getBoolean("closedOnBlocked")
  val faceInk = Color.parseColor(face.getString("ink")); val blushColour = Color.parseColor(face.getString("blushColour"))
  val eyeRadius = face.optDouble("eyeRadius", .018).toFloat()
  val eyeHalfGap = face.optDouble("eyeHalfGap", .085).toFloat()
  val mouthWidth = face.optDouble("mouthWidth", .08).toFloat()
  val blushWidth = face.optJSONArray("blushSize")?.getDouble(0)?.toFloat() ?: .08f
  val blushHeight = face.optJSONArray("blushSize")?.getDouble(1)?.toFloat() ?: .045f
  val blushX = face.optJSONArray("blushOffset")?.getDouble(0)?.toFloat() ?: .15f
  val blushY = face.optJSONArray("blushOffset")?.getDouble(1)?.toFloat() ?: .0825f
  val faceHeadOffset = face.optDouble("headOffset", 0.0).toFloat()
  val customFace = face.has("eyeRadius") || face.has("eyeHalfGap") || face.has("mouthWidth") || face.has("blushSize") || face.has("blushOffset") || face.has("headOffset")
  private val lod = source.getJSONObject("lod")
  val flatMin = lod.getDouble("flatMinDp").toFloat(); val detailMin = lod.getDouble("detailMinDp").toFloat(); val faceMin = lod.getDouble("faceMinDp").toFloat()
  private val motion = source.getJSONObject("motion")
  val pressScale = motion.getDouble("pressScale").toFloat(); val anticipation = motion.getLong("anticipationMs")
  private val particles = motion.getJSONObject("particles")
  val particleCount = particles.getInt("count"); val particleSize = particles.getDouble("size").toFloat()
  val particleLife = particles.getLong("lifeMs")
  val particleColours = particles.getJSONArray("colours").let { a -> IntArray(a.length()) { Color.parseColor(a.getString(it)) } }
  init {
    require(colours.isNotEmpty() && particleColours.isNotEmpty())
    require(rule in listOf("one", "length", "direction", "cycle"))
    require(lengthStops == null || (lengthStops.size == colours.size-1 && lengthStops.all { it > 0 } && lengthStops.toList().zipWithNext().all { it.first < it.second }))
    require(headShape in listOf("tri", "rounded", "swept", "step"))
    require(bodyPattern in listOf("tube", "beads", "square"))
    require(faceAnchor in listOf("tail", "head"))
    require(oneCellTail in listOf("dot", "none"))
    require(tailKind in listOf("none", "dot", "roll+face", "fletch", "marble"))
    require(layers.count { it.kind == "body" } == 1 && layers.count { it.kind == "rim" } == 1)
    require(tip in 0f.. .46f && halfWidth in 0f.. .46f && back in 0f.. .46f)
    require(headCornerRadius in 0f.. .2f)
    require(eyeRadius in .001f.. .15f && eyeHalfGap in 0f.. .4f && mouthWidth in .01f.. .3f)
    require(blushWidth in 0f.. .3f && blushHeight in 0f.. .2f)
    require(faceHeadOffset in -.4f.. .4f)
    require(beadDiameter == null || (bodyPattern == "beads" && beadDiameter in .01f.. .92f && beadPitch > 0f && beadPitch <= 1f && beadTubeWidth != null && beadTubeWidth > 0f))
    require(tailRadius + tailRim <= .44f && tailRadius >= 0f)
    require(flatMin > 0 && detailMin >= flatMin && faceMin >= detailMin)
    require(pressScale in .8f..1f && anticipation in 0..100 && particleCount in 0..24 && particleLife in 1..2000)
    val body = layers.single { it.kind == "body" }
    layers.forEach {
      require(it.kind in listOf("shadow", "rim", "body", "stripe", "ribbon", "bands", "seam", "shine", "glow", "spots", "fold", "headFill", "tailFill"))
      require(it.width in 0f.. .9f && it.period > 0f && it.fadeFraction in 0f..1f)
      require(it.opacity in 0f..1f && it.dash.all { n -> n > 0f } && (it.dash.isEmpty() || it.dash.size == 2))
      require(!it.tailPalette || tailColours.isNotEmpty())
      if(it.kind == "bands") {
        require(it.bands.isNotEmpty() && (it.bandWidths.isEmpty() || it.bandWidths.size == it.bands.size))
        require(it.bandWidths.all { n -> n > 0f && n <= it.width })
        require(it.bandWidths.toList().zipWithNext().all { pair -> pair.first > pair.second })
      }
      if(it.kind in listOf("shine", "ribbon", "seam")) require(it.dx == 0f && it.dy == 0f && it.amplitude == 0f)
      if(it.kind in listOf("stripe", "spots")) require(kotlin.math.abs(it.sideOffset) + it.width/2 <= body.width/2 - .03f)
      if(it.kind == "ribbon") require(it.dx == 0f && it.dy == 0f && it.amplitude + it.width / 2 <= body.width / 2 - .03f)
    }
    require(layers.sumOf { if(it.kind == "bands") it.bands.size else 1 } + (if(blush) 1 else 0) + (if(eyes) 1 else 0) <= 7)
  }
  fun detail(screenCell: Float) = if(screenCell < flatMin) 0 else if(screenCell < detailMin) 1 else 2
  fun colour(index: Int, length: Int, direction: Int): Int = colours[Math.floorMod(when(rule) {
    "length" -> lengthStops?.count { length > it } ?: (length - 1); "direction" -> direction; "cycle" -> index; else -> 0
  }, colours.size)]
  fun tailColour(index: Int) = if(tailColours.isEmpty()) colours[0] else tailColours[Math.floorMod(index,tailColours.size)]
  companion object {
    private var selectedJson: String? = null
    private var selectedSpec: SkinSpec? = null
    /** One immutable parsed selection across board-view remounts; bounded to the current selection. */
    @Synchronized fun selection(json: String): SkinSpec {
      if(json == selectedJson) return selectedSpec!!
      return SkinSpec(json).also { selectedJson = json; selectedSpec = it }
    }
  }

}

package com.danteb.arrows.board

import android.graphics.*
import kotlin.math.*

/** FROZEN copy of SkinPaths.kt at HALLOWEEN-01 start (HEAD 7397fb6); diagnostic APK only, never runtime source.
 * Generic retained art: one filled compound path per ordered colour layer. No skin-id branches. */
class Halloween01BeforePaths(val cell: Float, val spec: SkinSpec, private val auditGeometry: Boolean = false) {
  class Layers(val count: Int = 8) {
    val paths = Array(count) { Path() }
    val simple = Array(2) { Path() }
    val closedEyes = Path()
    private class Audit(count: Int) {
      val accentRuns = Array(count) { Path() }
      val headDecoration = Path()
      val tailDecoration = Path()
      fun rewind() { accentRuns.forEach { it.rewind() }; headDecoration.rewind(); tailDecoration.rewind() }
    }
    private var audit: Audit? = null
    private fun audit() = audit ?: Audit(count).also { audit = it }
    val accentRuns get() = audit().accentRuns
    val headDecoration get() = audit().headDecoration
    val tailDecoration get() = audit().tailDecoration
    val auditPathCount get() = if(audit == null) 0 else count+2
    val bounds = RectF()
    var tailX = 0f; var tailY = 0f
    var paletteColour: Int? = null
    var tailPaletteColour: Int? = null
    fun rewind() { audit?.rewind(); paths.forEach { it.rewind() }; simple.forEach { it.rewind() }; closedEyes.rewind() }
    fun add(art: Layers, detail: Int) {
      if(detail == 2) for(i in paths.indices) paths[i].addPath(art.paths[i])
      else for(i in simple.indices) simple[i].addPath(art.simple[i])
    }
  }
  private val kinds = spec.layers.flatMap { if(it.kind == "bands") List(it.bands.size) { _ -> "bands" } else listOf(it.kind) } +
    (if(spec.blush) listOf("blush") else emptyList()) + (if(spec.eyes) listOf("eyes") else emptyList())
  private val layerColours = spec.layers.flatMap { if(it.kind == "bands") it.bands.toList() else listOf(it.colour) } +
    (if(spec.blush) listOf(spec.blushColour) else emptyList()) + (if(spec.eyes) listOf(spec.faceInk) else emptyList())
  private val layerOpacity = spec.layers.flatMap { layer -> List(if(layer.kind == "bands") layer.bands.size else 1) { layer.opacity } } +
    (if(spec.blush) listOf(1f) else emptyList()) + (if(spec.eyes) listOf(1f) else emptyList())
  private val tailPaletteLayers = spec.layers.flatMap { layer -> List(if(layer.kind == "bands") layer.bands.size else 1) { layer.tailPalette } } +
    (if(spec.blush) listOf(false) else emptyList()) + (if(spec.eyes) listOf(false) else emptyList())
  private val paints = layerColours.map { colour -> Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colour ?: spec.colours[0]; isFilterBitmap = false } }
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
  private val measure = PathMeasure()
  private val accentMeasure = PathMeasure()
  private val stripeMeasure = PathMeasure()
  private val position = FloatArray(2); private val tangent = FloatArray(2)
  private val scratch = Path(); private val filled = Path(); private val shaft = Path(); private val head = Path()
  private val interior = Path()
  private val roundedCentreline = Path()
  private val centrePaint = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 0f; pathEffect = bendEffect() }
  private fun bendEffect(): PathEffect? = if(spec.roundedBends) CornerPathEffect(cell*.16f) else null
  private fun accentFitsBody(layer: SkinSpec.Layer): Boolean = spec.roundedBends &&
    abs(layer.amplitude) + layer.width/2 + hypot(layer.dx,layer.dy) <= spec.layers.single { it.kind == "body" }.width/2 - .03f
  val accentIndices get() = kinds.indices.filter { kinds[it] in listOf("ribbon", "shine") }
  val stitchIndices get() = kinds.indices.filter { kinds[it] == "seam" }
  private val needsInterior = spec.layers.any { it.kind in listOf("ribbon", "seam", "shine") && !accentFitsBody(it) }
  private var ribbonEdge = FloatArray(128)
  private val bend = if(spec.roundedBends) CornerPathEffect(cell*.16f) else null
  private val headPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; pathEffect = if(spec.headShape == "step" || spec.headCornerRadius > 0f) null else CornerPathEffect(cell * if(spec.headShape == "rounded") .055f else .018f) }
  private val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
  private data class HeadCaps(val fill: Path, val layers: List<Path>, val bands: List<Path>)
  private val headCaps = HashMap<String,HeadCaps>()
  private var tailFace: Layers? = null
  private var tailSpiral: Path? = null
  var faceBuildCount = 0; private set
  var spiralBuildCount = 0; private set
  var centrelineBuildCount = 0; private set
  var bandHeadBuildCount = 0; private set
  private val needsCentreline = spec.layers.any { it.kind in listOf("stripe", "seam", "spots") ||
    (it.kind in listOf("ribbon", "shine") && accentFitsBody(it)) }
  // A centreline stroke this narrow cannot reach an unowned exterior edge. Wider/offset
  // future specs keep the general intersection fallback. Heads are clipped separately.
  private val localFit = spec.layers.all { layer ->
    abs(layer.sideOffset) + layer.width / 2 + abs(layer.dx) <= .46f && abs(layer.sideOffset) + layer.width / 2 + abs(layer.dy) <= .46f &&
      spec.tailRadius + spec.tailRim + maxOf(abs(layer.dx),abs(layer.dy)) <= .46f &&
      layer.amplitude + layer.width / 2 + maxOf(abs(layer.dx),abs(layer.dy)) <= .46f
  }
  private val templates = HashMap<String,Layers>()
  val templateCount get() = templates.size
  val auditPathCount get() = templates.values.sumOf { it.auditPathCount }
  private var paletteBitmap: Bitmap? = null
  private var paletteShader: Shader? = null
  private var tailBitmap: Bitmap? = null
  private var tailShader: Shader? = null
  val layerCount get() = kinds.size
  val bodyIndex get() = kinds.indexOf("body")
  val rimIndex get() = kinds.indexOf("rim")

  /** A tiny generated colour lookup, not an image asset. One shader keeps arbitrary palettes at one body draw. */
  fun setPalette(geometry: List<SkinGeometry>) {
    templates.clear()
    paletteBitmap?.recycle(); paletteBitmap = null; paletteShader = null
    tailBitmap?.recycle(); tailBitmap = null; tailShader = null
    if(geometry.isEmpty()) return
    val rows = geometry.maxOf { g -> (0 until g.length).maxOf { g.cells[it*2] } } + 1
    val cols = geometry.maxOf { g -> (0 until g.length).maxOf { g.cells[it*2+1] } } + 1
    fun bitmap(tail: Boolean): Bitmap {
      val pixels = IntArray(rows*cols) { if(tail) spec.tailColour(0) else spec.colours[0] }
      geometry.forEachIndexed { index, g -> for(i in 0 until g.length) pixels[g.cells[i*2]*cols+g.cells[i*2+1]] =
        if(tail) spec.tailColour(index) else spec.colour(index,g.length,g.direction) }
      return Bitmap.createBitmap(pixels,cols,rows,Bitmap.Config.ARGB_8888)
    }
    fun shader(bitmap: Bitmap) = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
      setLocalMatrix(Matrix().apply { setScale(cell,cell) })
    }
    if(spec.rule != "one") { paletteBitmap = bitmap(false); paletteShader = shader(paletteBitmap!!) }
    if(spec.tailColours.isNotEmpty()) { tailBitmap = bitmap(true); tailShader = shader(tailBitmap!!) }
  }
  fun clear() { templates.clear(); headCaps.clear(); tailFace = null; tailSpiral = null; paletteBitmap?.recycle(); paletteBitmap = null; paletteShader = null
    tailBitmap?.recycle(); tailBitmap = null; tailShader = null }

  private data class Placement(val template: Layers, val x: Float, val y: Float)
  private fun placement(geometry: SkinGeometry, detail: Int): Placement {
    val originRow = geometry.cells[0]; val originCol = geometry.cells[1]
    val relative = IntArray(geometry.cells.size) { i -> geometry.cells[i] - if(i % 2 == 0) originRow else originCol }
    val key = "$detail:${geometry.direction}:" + relative.joinToString(",")
    val template = templates[key] ?: buildTemplate(SkinGeometry(geometry.direction,relative),detail).also { templates[key] = it }
    return Placement(template, originCol * cell, originRow * cell)
  }
  /** Static strips merge translated shared templates directly. Individual art is allocated only for feedback. */
  fun appendTo(compound: Layers, geometry: SkinGeometry, detail: Int, mark: Path? = null) {
    val (template, x, y) = placement(geometry,detail)
    if(mark != null) mark.addPath(template.simple[0],x,y)
    else if(detail == 2) for(i in compound.paths.indices) compound.paths[i].addPath(template.paths[i],x,y)
    else for(i in compound.simple.indices) compound.simple[i].addPath(template.simple[i],x,y)
  }
  fun build(geometry: SkinGeometry, index: Int, detail: Int): Layers {
    val (template, x, y) = placement(geometry,detail)
    return Layers(layerCount).also { out ->
      for(i in out.paths.indices) out.paths[i].addPath(template.paths[i],x,y)
      for(i in out.simple.indices) out.simple[i].addPath(template.simple[i],x,y)
      out.closedEyes.addPath(template.closedEyes,x,y)
      if(auditGeometry) {
        for(i in out.accentRuns.indices) out.accentRuns[i].addPath(template.accentRuns[i],x,y)
        out.headDecoration.addPath(template.headDecoration,x,y); out.tailDecoration.addPath(template.tailDecoration,x,y)
      }
      out.bounds.set(template.bounds); out.bounds.offset(x,y)
      out.tailX = template.tailX+x; out.tailY = template.tailY+y
      out.paletteColour = spec.colour(index,geometry.length,geometry.direction)
      out.tailPaletteColour = spec.tailColour(index)
    }
  }
  private fun buildTemplate(geometry: SkinGeometry, detail: Int): Layers = Layers(layerCount).also { out ->
    shaft.rewind(); shaft.moveTo(geometry.x(0,cell),geometry.y(0,cell))
    for(i in 1 until geometry.length) shaft.lineTo(geometry.x(i,cell),geometry.y(i,cell))
    val hx = geometry.x(geometry.length-1,cell); val hy = geometry.y(geometry.length-1,cell)
    // Shaft reaches the head centre; its rounded cap is fully covered by the dominant head.
    buildPaths(out,shaft,hx,hy,geometry.dx,geometry.dy,detail,if(localFit) null else geometry.allowed(cell),staticTemplate = true)
  }
  private fun makeHead(x: Float,y: Float,dx: Float,dy: Float) {
    val px = -dy; val py = dx
    if(spec.headCornerRadius > 0f) {
      roundedHead(x,y,dx,dy); return
    }
    head.rewind(); head.moveTo(x+dx*spec.tip*cell,y+dy*spec.tip*cell)
    if(spec.headShape == "step") {
      fun at(along: Float, across: Float) { head.lineTo(x+(dx*along+px*across)*cell,y+(dy*along+py*across)*cell) }
      at(spec.tip,.09f); at(.15f,.09f); at(.15f,.22f); at(-.12f,.22f); at(-.12f,spec.halfWidth)
      at(-spec.back,spec.halfWidth); at(-spec.back,-spec.halfWidth); at(-.12f,-spec.halfWidth)
      at(-.12f,-.22f); at(.15f,-.22f); at(.15f,-.09f); at(spec.tip,-.09f); head.close(); return
    }
    head.lineTo(x-dx*spec.back*cell+px*spec.halfWidth*cell,y-dy*spec.back*cell+py*spec.halfWidth*cell)
    if(spec.headShape == "swept") head.lineTo(x-dx*cell*.16f,y-dy*cell*.16f)
    head.lineTo(x-dx*spec.back*cell-px*spec.halfWidth*cell,y-dy*spec.back*cell-py*spec.halfWidth*cell); head.close()
  }
  /** Circular fillets with a declared radius at all three corners; legacy heads bypass this. */
  private fun roundedHead(x: Float,y: Float,dx: Float,dy: Float) {
    val px=-dy; val py=dx
    val vertices=arrayOf(PointF(x+dx*spec.tip*cell,y+dy*spec.tip*cell),
      PointF(x-dx*spec.back*cell+px*spec.halfWidth*cell,y-dy*spec.back*cell+py*spec.halfWidth*cell),
      PointF(x-dx*spec.back*cell-px*spec.halfWidth*cell,y-dy*spec.back*cell-py*spec.halfWidth*cell))
    head.rewind()
    for(i in vertices.indices) {
      val v=vertices[i]; val previous=vertices[(i+2)%3]; val next=vertices[(i+1)%3]
      val a=hypot(previous.x-v.x,previous.y-v.y); val b=hypot(next.x-v.x,next.y-v.y)
      val ux=(previous.x-v.x)/a; val uy=(previous.y-v.y)/a
      val vx=(next.x-v.x)/b; val vy=(next.y-v.y)/b
      val angle=acos((ux*vx+uy*vy).coerceIn(-1f,1f))
      val radius=spec.headCornerRadius*cell
      val distance=radius/tan(angle/2f)
      check(distance < minOf(a,b)/2f) { "Head corner radius consumes an edge" }
      val norm=hypot(ux+vx,uy+vy); val reach=radius/sin(angle/2f)
      val cx=v.x+(ux+vx)/norm*reach; val cy=v.y+(uy+vy)/norm*reach
      val sx=v.x+ux*distance; val sy=v.y+uy*distance
      if(i==0) head.moveTo(sx,sy) else head.lineTo(sx,sy)
      val start=atan2(sy-cy,sx-cx)*180f/PI.toFloat()
      head.arcTo(RectF(cx-radius,cy-radius,cx+radius,cy+radius),start,180f-angle*180f/PI.toFloat(),false)
    }
    head.close()
  }
  /** Exit geometry follows the original slither timing; scratch buffers and destination are reused. */
  fun buildInto(out: Layers, originalShaft: Path, originalHead: Path, detail: Int = 2, oneCell: Boolean = false) {
    measure.setPath(originalShaft,false)
    shaft.rewind(); measure.getSegment(minOf(cell*.42f,measure.length),measure.length,shaft,true)
    originalHead.computeBounds(out.bounds,true)
    val points = originalHead.approximate(.05f)
    if(points.size < 3) { out.rewind(); return }
    val tipX = points[1]; val tipY = points[2]
    measure.getPosTan(measure.length,position,tangent)
    val horizontal = abs(tipX-position[0]) > abs(tipY-position[1])
    val dx = if(horizontal) sign(tipX-position[0]) else 0f
    val dy = if(horizontal) 0f else sign(tipY-position[1])
    val hx = tipX - dx*cell*.5f; val hy = tipY - dy*cell*.5f
    buildPaths(out,shaft,hx,hy,dx,dy,detail,null,oneCell)
  }
  fun facePathsEmpty(art: Layers) = kinds.indices.filter { kinds[it] == "eyes" || kinds[it] == "blush" }.all { art.paths[it].isEmpty } && art.closedEyes.isEmpty
  fun eyePaths(art: Layers) = kinds.indices.filter { kinds[it] == "eyes" }.map { art.paths[it] } + art.closedEyes
  private fun caps(dx: Float, dy: Float, detail: Int): HeadCaps {
    val key = "$dx,$dy,$detail"
    return headCaps[key] ?: run {
      makeHead(0f,0f,dx,dy)
      val fill = Path(); headPaint.getFillPath(head,fill)
      val box = Path().apply { addRect(-cell*.46f,-cell*.46f,cell*.46f,cell*.46f,Path.Direction.CW) }
      val bodyWidth = spec.layers.single { it.kind == "body" }.width
      val paths = spec.layers.map { layer ->
        Path(fill).apply {
          if(layer.kind != "body") {
            val edge = Path(); fillStroke(fill,cell*maxOf(0f,layer.width-bodyWidth),edge); addPath(edge)
          }
          if(layer.kind == "shadow") offset(layer.dx*cell,layer.dy*cell)
          check(op(box,Path.Op.INTERSECT))
        }.let { clockwiseCap(it) }
      }
      fill.op(box,Path.Op.INTERSECT)
      val cap = clockwiseCap(fill)
      val bands = if(detail == 2) spec.layers.filter { it.kind == "bands" }.flatMap { layer ->
        layer.bands.indices.map { i ->
          val width = if(layer.bandWidths.isEmpty()) layer.width*(1f-i.toFloat()/layer.bands.size) else layer.bandWidths[i]
          bandHeadBuildCount++
          Path(cap).apply { transform(Matrix().apply { setScale(width/layer.width,width/layer.width) }) }
        }
      } else emptyList()
      HeadCaps(cap,paths,bands).also { headCaps[key] = it }
    }
  }
  /** Boolean output may wind opposite to a stroked shaft. Normalize the small,
   * single-contour head ONCE, at <= .005 logical-pixel approximation error. Positive
   * winding matches Canvas stroke fills/circles, so overlap stays filled on concatenation.
   * Only these cached head caps are flattened; shafts/bends remain native curves. */
  private fun clockwiseCap(path: Path): Path {
    val points = path.approximate(.005f)
    var area = 0f
    for(i in 3 until points.size step 3) area += points[i-2]*points[i+2] - points[i+1]*points[i-1]
    if(area >= 0f) return path
    return Path().apply {
      moveTo(points[points.size-2],points[points.size-1])
      for(i in points.size-6 downTo 0 step 3) lineTo(points[i+1],points[i+2])
      close()
    }
  }
  private fun fillStroke(path: Path,width: Float,out: Path,effect: PathEffect? = null) {
    stroke.strokeCap = if(spec.bodyPattern == "square") Paint.Cap.SQUARE else Paint.Cap.ROUND
    stroke.strokeJoin = if(spec.bodyPattern == "square") Paint.Join.MITER else Paint.Join.ROUND
    stroke.strokeWidth = width; stroke.pathEffect = effect; stroke.getFillPath(path,out)
  }
  private fun buildPaths(out: Layers, line: Path,hx: Float,hy: Float,dx: Float,dy: Float,detail: Int,allowed: Path?,oneCell: Boolean = false,staticTemplate: Boolean = false) {
    out.rewind(); measure.setPath(line,false); val length = measure.length
    measure.getPosTan(0f,position,tangent); out.tailX = position[0]; out.tailY = position[1]
    if(length == 0f) { out.tailX = hx; out.tailY = hy }
    val caps = caps(dx,dy,detail)
    if(auditGeometry) out.headDecoration.addPath(caps.fill,hx,hy)
    val tailKind = if(oneCell || length == 0f) spec.oneCellTail else spec.tailKind
    val tailRadius = if(oneCell || length == 0f) minOf(spec.tailRadius, .13f) else spec.tailRadius
    val bodyWidth = spec.layers.single { it.kind == "body" }.width
    interior.rewind()
    // CornerPathEffect can stroke a move-only contour at the template origin. A one-cell
    // arrow has no shaft: only its centred tail and head may contribute to these layers.
    if(needsInterior && length > 0f) fillStroke(line,cell*(bodyWidth-.06f),interior,bend)
    // Every accent follows the same immutable rounded centreline. Build it once,
    // including move-only contours, so one-cell behavior is identical.
    if(detail == 2 && needsCentreline) {
      roundedCentreline.rewind(); centrePaint.getFillPath(line,roundedCentreline); centrelineBuildCount++
    }
    var slot = 0; var bandSlot = 0
    for(layer in spec.layers) {
      val target = out.paths[slot]
      when(layer.kind) {
        "shadow", "rim", "body", "glow" -> {
          if(length > 0f) {
            val width = cell * if(detail == 0) (if(layer.kind == "body") .12f else .18f) else layer.width
            val beadBody = spec.bodyPattern == "beads" && detail == 2
            val rimExtra = layer.width - bodyWidth
            val tube = if(beadBody) spec.beadTubeWidth?.let { cell*(it+rimExtra) } ?: (width*.58f) else width
            fillStroke(line,tube,target,bend)
            if(spec.bodyPattern == "beads" && detail == 2) {
              var d = 0f
              val rimWidth=spec.layers.single { it.kind == "rim" }.width
              val diameter=spec.beadDiameter?.let { cell*(it + layer.width - rimWidth) } ?: width
              while(d <= length) { measure.getPosTan(d,position,tangent); target.addCircle(position[0],position[1],diameter/2,Path.Direction.CW); d += cell*spec.beadPitch }
            }
          }

          if(tailKind != "none" && detail == 2) {
            val radius = tailRadius + if(layer.kind == "body") 0f else spec.tailRim
            tailCap(tailKind,out.tailX,out.tailY,radius,line,scratch); target.addPath(scratch)
            if(auditGeometry && layer.kind == "rim") out.tailDecoration.set(scratch)
          }
          if(layer.kind == "shadow") target.offset(layer.dx*cell,layer.dy*cell)
          target.addPath(caps.layers[spec.layers.indexOf(layer)],hx,hy)
        }
        "stripe" -> if(detail == 2) {
          scratch.rewind()
          stripeMeasure.setPath(roundedCentreline,false)
          var d = minOf(cell*(tailRadius+.04f),stripeMeasure.length)
          while(d < stripeMeasure.length) {
            val end = minOf(d+cell*.22f,stripeMeasure.length)
            val steps = maxOf(1,ceil((end-d)/(cell*.04f)).toInt())
            for(i in 0..steps) {
              stripeMeasure.getPosTan(d+(end-d)*i/steps,position,tangent)
              val x=position[0]-tangent[1]*cell*layer.sideOffset
              val y=position[1]+tangent[0]*cell*layer.sideOffset
              if(i==0) scratch.moveTo(x,y) else scratch.lineTo(x,y)
            }
            d += cell*layer.period
          }
          fillStroke(scratch,cell*layer.width,target)
          if(tailKind == "roll+face") {
            if(staticTemplate) {
              val cached = tailSpiral ?: Path().also { spiral(it,out.tailX,out.tailY,tailRadius); tailSpiral = it }
              target.addPath(cached)
            } else { spiral(filled,out.tailX,out.tailY,tailRadius); target.addPath(filled) }
          }
        }
        "seam" -> if(detail == 2 && length > 0f) {
          fillStroke(roundedCentreline,cell*layer.width,target,if(layer.dash.isNotEmpty()) DashPathEffect(layer.dash.map { it*cell }.toFloatArray(),0f) else null)
          if(needsInterior) target.op(interior,Path.Op.INTERSECT)
          if(auditGeometry) out.accentRuns[slot].set(target)
        }
        "spots" -> if(detail == 2 && length > 0f) {
          stripeMeasure.setPath(roundedCentreline,false)
          var d = cell*.35f
          while(d < stripeMeasure.length-cell*.22f) {
            stripeMeasure.getPosTan(d,position,tangent)
            target.addCircle(position[0]-tangent[1]*layer.sideOffset*cell,position[1]+tangent[0]*layer.sideOffset*cell,layer.width*cell/2,Path.Direction.CW)
            d += cell*layer.period
          }
        }
        "tailFill" -> if(detail == 2 && tailKind != "none") {
          tailCap(tailKind,out.tailX,out.tailY,tailRadius,line,target)
        }
        "headFill" -> if(detail == 2) target.addPath(caps.fill,hx,hy)
        "fold" -> if(detail == 2) {
          // One half of the cap and a short crease at each actual cell-centre bend.
          scratch.rewind(); scratch.moveTo(hx+dx*spec.tip*cell,hy+dy*spec.tip*cell)
          scratch.lineTo(hx-dx*spec.back*cell,hy-dy*spec.back*cell)
          scratch.lineTo(hx-dx*spec.back*cell-dy*spec.halfWidth*cell,hy-dy*spec.back*cell+dx*spec.halfWidth*cell)
          scratch.close()
          if(layer.fillHalf) target.addPath(clockwiseCap(scratch)) else {
            scratch.rewind(); scratch.moveTo(hx-dx*spec.back*cell,hy-dy*spec.back*cell); scratch.lineTo(hx+dx*spec.tip*cell,hy+dy*spec.tip*cell)
            fillStroke(scratch,cell*layer.width,target)
            scratch.set(caps.fill); scratch.offset(hx,hy); target.op(scratch,Path.Op.INTERSECT)
          }
          val points = line.approximate(.005f)
          scratch.rewind()
          for(i in 3 until points.size-3 step 3) {
            val x=points[i+1]; val y=points[i+2]
            val ax=x-points[i-2]; val ay=y-points[i-1]; val bx=points[i+4]-x; val by=points[i+5]-y
            if(ax*by-ay*bx != 0f) {
              // Bisect the incoming/outgoing tangents; each rotated/mirrored turn gets its own crease.
              val al=hypot(ax,ay); val bl=hypot(bx,by)
              val sx=ax/al+bx/bl; val sy=ay/al+by/bl; val n=hypot(sx,sy)
              val span=cell*bodyWidth*.30f
              scratch.moveTo(x-sx/n*span,y-sy/n*span); scratch.lineTo(x+sx/n*span,y+sy/n*span)
            }
          }
          fillStroke(scratch,cell*layer.width,filled); target.addPath(filled)
        }
        "ribbon", "shine" -> if(detail == 2) {
          if(accentFitsBody(layer)) {
            // A hairline fill applies the SAME corner effect as the dough stroke,
            // yielding its rounded centreline rather than a filled outline.
            accentMeasure.setPath(roundedCentreline,false)
            ribbon(roundedCentreline,target,layer,accentMeasure.length)
          } else {
            ribbon(line,target,layer,length)
            target.op(interior,Path.Op.INTERSECT)
          }
          if(auditGeometry) out.accentRuns[slot].set(target)
          if(spec.headShine && (layer.kind == "shine" || layer.kind == "ribbon")) {
            val x=hx+dx*cell*.12f; val y=hy+dy*cell*.12f
            target.addOval(x-cell*(if(dx!=0f) .085f else .035f),y-cell*(if(dx!=0f) .035f else .085f),
              x+cell*(if(dx!=0f) .085f else .035f),y+cell*(if(dx!=0f) .035f else .085f),Path.Direction.CW)
          }
          if(tailKind == "marble" && layer.kind == "shine") target.addCircle(out.tailX-cell*.045f,out.tailY-cell*.045f,cell*.03f,Path.Direction.CW)
        }
        "bands" -> if(detail == 2) {
          for(i in layer.bands.indices) {
            // Nested widths yield ordered bands with independently baked fill paths.
            val width = if(layer.bandWidths.isEmpty()) layer.width*(1f-i.toFloat()/layer.bands.size) else layer.bandWidths[i]
            if(length > 0f) fillStroke(line,cell*width,out.paths[slot+i],bend)
            out.paths[slot+i].addPath(caps.bands[bandSlot+i],hx,hy)
          }
          bandSlot += layer.bands.size
        }
      }
      slot += if(layer.kind == "bands") layer.bands.size else 1
    }
    if((spec.faceAnchor == "head" || (!oneCell && length > 0f && tailKind == "roll+face")) && detail == 2 && (spec.blush || spec.eyes)) {
      if(staticTemplate && spec.faceAnchor == "tail") {
        // Relative templates always start at the same tail-cell centre. Copying
        // these exact paths needs no translation and preserves float coordinates.
        val cached = tailFace ?: Layers(layerCount).also { face(it,slot,out.tailX,out.tailY); tailFace = it }
        for(i in slot until out.paths.size) out.paths[i].addPath(cached.paths[i])
        out.closedEyes.addPath(cached.closedEyes)
      } else face(out,slot,if(spec.faceAnchor == "head") hx+dx*cell*spec.faceHeadOffset else out.tailX,if(spec.faceAnchor == "head") hy+dy*cell*spec.faceHeadOffset else out.tailY)
      if(spec.faceAnchor == "head" && !spec.customFace) {
        scratch.set(caps.fill); scratch.offset(hx,hy)
        for(i in slot until out.paths.size) out.paths[i].op(scratch,Path.Op.INTERSECT)
        out.closedEyes.op(scratch,Path.Op.INTERSECT)
      }
    }
    if(allowed != null && !localFit) {
      out.paths.forEach { if(!it.isEmpty) check(it.op(allowed,Path.Op.INTERSECT)) }
      out.closedEyes.op(allowed,Path.Op.INTERSECT)
      if(auditGeometry) { out.headDecoration.op(allowed,Path.Op.INTERSECT); out.tailDecoration.op(allowed,Path.Op.INTERSECT) }
    }
    out.simple[0].set(out.paths[rimIndex]); out.simple[1].set(out.paths[bodyIndex])
    out.paths[rimIndex].computeBounds(out.bounds,true)
  }
  private fun tailCap(kind: String,x: Float,y: Float,radius: Float,line: Path,out: Path) {
    out.rewind()
    if(kind != "fletch") { out.addCircle(x,y,cell*radius,Path.Direction.CW); return }
    measure.setPath(line,false); measure.getPosTan(0f,position,tangent)
    val dx=tangent[0]; val dy=tangent[1]
    fun at(a: Float,p: Float) { out.lineTo(x+(dx*a-dy*p)*cell*radius,y+(dy*a+dx*p)*cell*radius) }
    out.moveTo(x-dx*cell*radius,y-dy*cell*radius)
    at(0f,-1f); at(1f,-1f); at(.45f,0f); at(1f,1f); at(0f,1f); out.close()
  }
  private fun ribbon(line: Path,out: Path,layer: SkinSpec.Layer,length: Float) {
    accentMeasure.setPath(line,false)
    val start = minOf(cell*(spec.tailRadius+.03f),length)
    val steps=maxOf(1,ceil((length-start)/(cell*.075f)).toInt())
    if(ribbonEdge.size < (steps+1)*4) ribbonEdge = FloatArray((steps+1)*4)
    val edge = ribbonEdge
    if(length <= start) return
    val fadeLength=minOf(cell*layer.fade,(length-start)*layer.fadeFraction)
    for(i in 0..steps) {
      val d=start+(length-start)*i/steps; accentMeasure.getPosTan(d,position,tangent)
      val wave=if(layer.amplitude == 0f) 0f else sin(d/cell*2*PI/layer.period).toFloat()*cell*layer.amplitude
      val fade=if(fadeLength>0) ((length-d)/fadeLength).coerceIn(0f,1f) else 1f
      val half=cell*layer.width*.5f*fade*fade*(3-2*fade)
      val x=position[0]-tangent[1]*wave+layer.dx*cell; val y=position[1]+tangent[0]*wave+layer.dy*cell
      // Positive winding matches other filled decoration contours.
      edge[i*4]=x+tangent[1]*half; edge[i*4+1]=y-tangent[0]*half
      edge[i*4+2]=x-tangent[1]*half; edge[i*4+3]=y+tangent[0]*half
    }
    appendRibbonEdge(out,edge,steps,0,false)
    appendRibbonEdge(out,edge,steps,2,true)
    out.close()
  }
  /** Remove only exactly collinear interior samples. Curves and fades keep their
   * original samples; the filled contour is unchanged, without a tolerance. */
  private fun appendRibbonEdge(out: Path, edge: FloatArray, steps: Int, side: Int, reverse: Boolean) {
    val order=if(reverse) steps downTo 0 else 0..steps
    for(i in order) {
      val at=i*4+side
      if(i > 0 && i < steps) {
        val previous=(i-1)*4+side; val next=(i+1)*4+side
        val ax=edge[at]-edge[previous]; val ay=edge[at+1]-edge[previous+1]
        val bx=edge[next]-edge[at]; val by=edge[next+1]-edge[at+1]
        if(ax*by-ay*bx == 0f && ax*bx+ay*by >= 0f) continue
      }
      if(!reverse && i==0) out.moveTo(edge[at],edge[at+1]) else out.lineTo(edge[at],edge[at+1])
    }
  }
  private fun spiral(out: Path,x: Float,y: Float,radius: Float) {
    spiralBuildCount++
    scratch.rewind()
    for(i in 0..32) { val t=i/32f; val a=t*PI*3.6; val r=cell*(.025f+radius*.65f*t)
      val px=x+cos(a).toFloat()*r; val py=y+sin(a).toFloat()*r
      if(i==0) scratch.moveTo(px,py) else scratch.lineTo(px,py) }
    fillStroke(scratch,cell*.025f,out)
  }
  private fun face(out: Layers,start: Int,x: Float,y: Float) {
    faceBuildCount++
     val eyeIndex=start+(if(spec.blush) 1 else 0)
    for(side in intArrayOf(-1,1)) {
      if(spec.blush) {
        if(spec.customFace) out.paths[start].addOval(x+side*cell*spec.blushX-cell*spec.blushWidth/2,y+cell*(spec.blushY-spec.blushHeight/2),x+side*cell*spec.blushX+cell*spec.blushWidth/2,y+cell*(spec.blushY+spec.blushHeight/2),Path.Direction.CW)
        else out.paths[start].addOval(x+side*cell*.15f-cell*.04f,y+cell*.06f,x+side*cell*.15f+cell*.04f,y+cell*.105f,Path.Direction.CW)
      }
      if(spec.eyes) {
        out.paths[eyeIndex].addCircle(x+side*cell*spec.eyeHalfGap,y,cell*spec.eyeRadius,Path.Direction.CW)
        val closedHalf=if(spec.customFace) spec.eyeRadius else .032f
        scratch.rewind(); scratch.addArc(RectF(x+side*cell*spec.eyeHalfGap-cell*closedHalf,y-cell*.02f,x+side*cell*spec.eyeHalfGap+cell*closedHalf,y+cell*.03f),10f,160f)
        fillStroke(scratch,cell*.02f,filled); out.closedEyes.addPath(filled)
      }
    }
    if(spec.eyes) { scratch.rewind(); scratch.addArc(RectF(x-cell*(spec.mouthWidth/2),y+cell*.03f,x+cell*(spec.mouthWidth/2),y+cell*.095f),10f,160f)
      fillStroke(scratch,cell*.016f,filled); out.paths[eyeIndex].addPath(filled); out.closedEyes.addPath(filled) }
  }
  fun draw(canvas: Canvas,art: Layers,screenCell: Float,alpha: Int=255,eyesClosed: Boolean=false): Int {
    if(spec.detail(screenCell) < 2) {
      for(i in 0..1) { val n=if(i==0) rimIndex else bodyIndex; paint(n,art,alpha); canvas.drawPath(art.simple[i],paints[n]) }
      return 2
    }
    var draws=0
    for(i in paints.indices) {
      if(screenCell < spec.faceMin && kinds[i] in listOf("eyes","blush")) continue
      paint(i,art,(alpha*layerOpacity[i]).toInt())
      canvas.drawPath(if(eyesClosed && spec.closedOnBlocked && kinds[i]=="eyes") art.closedEyes else art.paths[i],paints[i]); draws++
    }
    return draws
  }
  private fun paint(i: Int,art: Layers,alpha: Int) {
    val p=paints[i]; p.alpha=alpha
    if(layerColours[i]==null) {
      val colour = if(tailPaletteLayers[i]) art.tailPaletteColour else art.paletteColour
      p.shader=if(colour==null) (if(tailPaletteLayers[i]) tailShader else paletteShader) else null
      p.color=colour ?: if(tailPaletteLayers[i]) spec.tailColour(0) else spec.colours[0]; p.alpha=alpha
    }
  }
  fun drawFlat(canvas: Canvas,line: Path,triangle: Path,width: Float,alpha: Int=255): Int {
    stroke.pathEffect=null; stroke.strokeWidth=width; stroke.color=layerColours[rimIndex] ?: spec.colours[0]; stroke.alpha=alpha
    canvas.drawPath(line,stroke); glow.color=layerColours[rimIndex] ?: spec.colours[0]; glow.alpha=alpha; canvas.drawPath(triangle,glow); return 2
  }
  fun drawGlow(canvas: Canvas,art: Layers,opacity: Float) { glow.color=Color.WHITE; glow.alpha=(opacity*255).toInt().coerceIn(0,255); canvas.drawPath(art.simple[0],glow) }
}

package com.danteb.arrows.board

import android.graphics.*
import kotlin.math.*

/** Generic retained art: one filled compound path per ordered colour layer. No skin-id branches. */
class Art04Paths(val cell: Float, val spec: SkinSpec) {
  class Layers(val count: Int = 8) {
    val paths = Array(count) { Path() }
    val simple = Array(2) { Path() }
    val closedEyes = Path()
    val headDecoration = Path()
    val tailDecoration = Path()
    val bounds = RectF()
    var tailX = 0f; var tailY = 0f
    var paletteColour: Int? = null
    fun rewind() { paths.forEach { it.rewind() }; simple.forEach { it.rewind() }; closedEyes.rewind(); headDecoration.rewind(); tailDecoration.rewind() }
    fun add(art: Layers, detail: Int) {
      if(detail == 2) for(i in paths.indices) paths[i].addPath(art.paths[i])
      else for(i in simple.indices) simple[i].addPath(art.simple[i])
    }
  }
  private val kinds = spec.layers.flatMap { if(it.kind == "bands") List(it.bands.size) { _ -> "bands" } else listOf(it.kind) } +
    (if(spec.blush) listOf("blush") else emptyList()) + (if(spec.eyes) listOf("eyes") else emptyList())
  private val layerColours = spec.layers.flatMap { if(it.kind == "bands") it.bands.toList() else listOf(it.colour) } +
    (if(spec.blush) listOf(spec.blushColour) else emptyList()) + (if(spec.eyes) listOf(spec.faceInk) else emptyList())
  private val paints = layerColours.map { colour -> Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colour ?: spec.colours[0]; isFilterBitmap = false } }
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
  private val measure = PathMeasure()
  private val position = FloatArray(2); private val tangent = FloatArray(2)
  private val scratch = Path(); private val filled = Path(); private val shaft = Path(); private val head = Path()
  private val interior = Path()
  private var ribbonEdge = FloatArray(128)
  private val bend = if(spec.roundedBends) CornerPathEffect(cell*.16f) else null
  private val headPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; pathEffect = CornerPathEffect(cell * if(spec.headShape == "rounded") .055f else .018f) }
  private val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
  private val templates = HashMap<String,Layers>()
  val templateCount get() = templates.size
  private var paletteBitmap: Bitmap? = null
  private var paletteShader: Shader? = null
  val layerCount get() = kinds.size
  val bodyIndex get() = kinds.indexOf("body")
  val rimIndex get() = kinds.indexOf("rim")

  /** A tiny generated colour lookup, not an image asset. One shader keeps arbitrary palettes at one body draw. */
  fun setPalette(geometry: List<SkinGeometry>) {
    templates.clear()
    paletteBitmap?.recycle(); paletteBitmap = null; paletteShader = null
    if(spec.rule == "one" || geometry.isEmpty()) return
    val rows = geometry.maxOf { g -> (0 until g.length).maxOf { g.cells[it*2] } } + 1
    val cols = geometry.maxOf { g -> (0 until g.length).maxOf { g.cells[it*2+1] } } + 1
    val pixels = IntArray(rows*cols) { spec.colours[0] }
    geometry.forEachIndexed { index, g -> for(i in 0 until g.length) pixels[g.cells[i*2]*cols+g.cells[i*2+1]] = spec.colour(index,g.length,g.direction) }
    paletteBitmap = Bitmap.createBitmap(pixels,cols,rows,Bitmap.Config.ARGB_8888)
    paletteShader = BitmapShader(paletteBitmap!!, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
      setLocalMatrix(Matrix().apply { setScale(cell,cell) })
    }
  }
  fun clear() { templates.clear(); paletteBitmap?.recycle(); paletteBitmap = null; paletteShader = null }

  fun build(geometry: SkinGeometry, index: Int, detail: Int): Layers {
    val originRow = geometry.cells[0]; val originCol = geometry.cells[1]
    val relative = IntArray(geometry.cells.size) { i -> geometry.cells[i] - if(i % 2 == 0) originRow else originCol }
    val key = "$detail:${geometry.direction}:" + relative.joinToString(",")
    val template = templates[key] ?: buildTemplate(SkinGeometry(geometry.direction,relative),detail).also { templates[key] = it }
    val x = originCol * cell; val y = originRow * cell
    return Layers(layerCount).also { out ->
      for(i in out.paths.indices) out.paths[i].addPath(template.paths[i],x,y)
      for(i in out.simple.indices) out.simple[i].addPath(template.simple[i],x,y)
      out.closedEyes.addPath(template.closedEyes,x,y)
      out.headDecoration.addPath(template.headDecoration,x,y); out.tailDecoration.addPath(template.tailDecoration,x,y)
      out.bounds.set(template.bounds); out.bounds.offset(x,y)
      out.tailX = template.tailX+x; out.tailY = template.tailY+y
      out.paletteColour = spec.colour(index,geometry.length,geometry.direction)
    }
  }
  private fun buildTemplate(geometry: SkinGeometry, detail: Int): Layers = Layers(layerCount).also { out ->
    shaft.rewind(); shaft.moveTo(geometry.x(0,cell),geometry.y(0,cell))
    for(i in 1 until geometry.length) shaft.lineTo(geometry.x(i,cell),geometry.y(i,cell))
    val hx = geometry.x(geometry.length-1,cell); val hy = geometry.y(geometry.length-1,cell)
    // Shaft reaches the head centre; its rounded cap is fully covered by the dominant head.
    makeHead(hx,hy,geometry.dx,geometry.dy)
    buildPaths(out,shaft,head,hx,hy,geometry.dx,geometry.dy,detail,geometry.allowed(cell))
  }
  private fun makeHead(x: Float,y: Float,dx: Float,dy: Float) {
    val px = -dy; val py = dx
    head.rewind(); head.moveTo(x+dx*spec.tip*cell,y+dy*spec.tip*cell)
    head.lineTo(x-dx*spec.back*cell+px*spec.halfWidth*cell,y-dy*spec.back*cell+py*spec.halfWidth*cell)
    if(spec.headShape == "swept") head.lineTo(x-dx*cell*.16f,y-dy*cell*.16f)
    head.lineTo(x-dx*spec.back*cell-px*spec.halfWidth*cell,y-dy*spec.back*cell-py*spec.halfWidth*cell); head.close()
  }
  /** Exit geometry follows the original slither timing; scratch buffers and destination are reused. */
  fun buildInto(out: Layers, originalShaft: Path, originalHead: Path, detail: Int = 2) {
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
    makeHead(hx,hy,dx,dy)
    buildPaths(out,shaft,head,hx,hy,dx,dy,detail,null)
  }
  private fun fillStroke(path: Path,width: Float,out: Path,effect: PathEffect? = null) {
    stroke.strokeWidth = width; stroke.pathEffect = effect; stroke.getFillPath(path,out)
  }
  private fun buildPaths(out: Layers, line: Path, triangle: Path,hx: Float,hy: Float,dx: Float,dy: Float,detail: Int,allowed: Path?) {
    out.rewind(); measure.setPath(line,false); val length = measure.length
    measure.getPosTan(0f,position,tangent); out.tailX = position[0]; out.tailY = position[1]
    if(length == 0f) { out.tailX = hx; out.tailY = hy }
    headPaint.getFillPath(triangle,filled); out.headDecoration.set(filled)
    val bodyWidth = spec.layers.single { it.kind == "body" }.width
    interior.rewind()
    // CornerPathEffect can stroke a move-only contour at the template origin. A one-cell
    // arrow has no shaft: only its centred tail and head may contribute to these layers.
    if(length > 0f) fillStroke(line,cell*(bodyWidth-.06f),interior,bend)
    var slot = 0
    for(layer in spec.layers) {
      val target = out.paths[slot]
      when(layer.kind) {
        "shadow", "rim", "body" -> {
          if(length > 0f) fillStroke(line,cell * if(detail == 0) .144f else layer.width,target,bend)
          target.addPath(filled)
          if(layer.kind != "body" && detail != 0) { fillStroke(filled,cell*maxOf(0f,layer.width-bodyWidth),scratch); target.addPath(scratch) }
          if(spec.tailKind != "none" && detail == 2) {
            val radius = spec.tailRadius + if(layer.kind == "body") 0f else spec.tailRim
            if(spec.tailKind == "fletch") {
              scratch.rewind(); scratch.moveTo(out.tailX,out.tailY-cell*radius); scratch.lineTo(out.tailX+cell*radius,out.tailY)
              scratch.lineTo(out.tailX,out.tailY+cell*radius); scratch.lineTo(out.tailX-cell*radius,out.tailY); scratch.close(); target.addPath(scratch)
            } else target.addCircle(out.tailX,out.tailY,cell*radius,Path.Direction.CW)
            if(layer.kind == "rim") out.tailDecoration.addCircle(out.tailX,out.tailY,cell*radius,Path.Direction.CW)
          }
          if(layer.kind == "shadow") target.offset(layer.dx*cell,layer.dy*cell)
        }
        "stripe" -> if(detail == 2) {
          scratch.rewind(); var d = minOf(cell*(spec.tailRadius+.04f),length)
          while(d < length) { measure.getSegment(d,minOf(d+cell*.22f,length),scratch,true); d += cell*layer.period }
          fillStroke(scratch,cell*layer.width,target)
          if(spec.tailKind == "roll+face") {
            scratch.rewind()
            for(i in 0..32) { val t=i/32f; val a=t*PI*3.6; val r=cell*(.025f+spec.tailRadius*.65f*t)
              val x=out.tailX+cos(a).toFloat()*r; val y=out.tailY+sin(a).toFloat()*r
              if(i==0) scratch.moveTo(x,y) else scratch.lineTo(x,y) }
            fillStroke(scratch,cell*.025f,filled); target.addPath(filled)
            headPaint.getFillPath(triangle,filled)
          }
        }
        "ribbon", "seam", "shine" -> if(detail == 2) {
          ribbon(line,target,layer,length)
          target.op(interior,Path.Op.INTERSECT)
          if(spec.headShine && (layer.kind == "shine" || layer.kind == "ribbon")) {
            val x=hx+dx*cell*.12f; val y=hy+dy*cell*.12f
            target.addOval(x-cell*(if(dx!=0f) .085f else .035f),y-cell*(if(dx!=0f) .035f else .085f),
              x+cell*(if(dx!=0f) .085f else .035f),y+cell*(if(dx!=0f) .035f else .085f),Path.Direction.CW)
          }
        }
        "bands" -> if(detail == 2) {
          for(i in layer.bands.indices) {
            // Nested widths yield ordered bands with independently baked fill paths.
            if(length > 0f) fillStroke(line,cell*layer.width*(1f-i.toFloat()/layer.bands.size),out.paths[slot+i],bend)
          }
        }
      }
      slot += if(layer.kind == "bands") layer.bands.size else 1
    }
    if(detail == 2 && (spec.blush || spec.eyes)) face(out,slot)
    if(allowed != null) {
      out.paths.forEach { if(!it.isEmpty) check(it.op(allowed,Path.Op.INTERSECT)) }
      out.closedEyes.op(allowed,Path.Op.INTERSECT)
      out.headDecoration.op(allowed,Path.Op.INTERSECT); out.tailDecoration.op(allowed,Path.Op.INTERSECT)
    }
    out.simple[0].set(out.paths[rimIndex]); out.simple[1].set(out.paths[bodyIndex])
    out.paths[rimIndex].computeBounds(out.bounds,true)
  }
  private fun ribbon(line: Path,out: Path,layer: SkinSpec.Layer,length: Float) {
    measure.setPath(line,false)
    val start = minOf(cell*(spec.tailRadius+.03f),length)
    val steps=maxOf(1,ceil((length-start)/(cell*.075f)).toInt())
    if(ribbonEdge.size < (steps+1)*2) ribbonEdge = FloatArray((steps+1)*2)
    val edge = ribbonEdge
    if(length <= start) return
    for(i in 0..steps) {
      val d=start+(length-start)*i/steps; measure.getPosTan(d,position,tangent)
      val wave=sin(d/cell*2*PI/layer.period).toFloat()*cell*layer.amplitude
      val fade=if(layer.fade>0) ((length-d)/(cell*layer.fade)).coerceIn(0f,1f) else 1f
      val half=cell*layer.width*.5f*fade*fade*(3-2*fade)
      val x=position[0]-tangent[1]*wave+layer.dx*cell; val y=position[1]+tangent[0]*wave+layer.dy*cell
      if(i==0) out.moveTo(x-tangent[1]*half,y+tangent[0]*half) else out.lineTo(x-tangent[1]*half,y+tangent[0]*half)
      edge[i*2]=x+tangent[1]*half; edge[i*2+1]=y-tangent[0]*half
    }
    for(i in steps downTo 0) out.lineTo(edge[i*2],edge[i*2+1]); out.close()
  }
  private fun face(out: Layers,start: Int) {
    val x=out.tailX; val y=out.tailY; val eyeIndex=start+(if(spec.blush) 1 else 0)
    for(side in intArrayOf(-1,1)) {
      if(spec.blush) out.paths[start].addOval(x+side*cell*.15f-cell*.04f,y+cell*.06f,x+side*cell*.15f+cell*.04f,y+cell*.105f,Path.Direction.CW)
      if(spec.eyes) {
        out.paths[eyeIndex].addCircle(x+side*cell*.085f,y,cell*.018f,Path.Direction.CW)
        scratch.rewind(); scratch.addArc(RectF(x+side*cell*.085f-cell*.032f,y-cell*.02f,x+side*cell*.085f+cell*.032f,y+cell*.03f),10f,160f)
        fillStroke(scratch,cell*.02f,filled); out.closedEyes.addPath(filled)
      }
    }
    if(spec.eyes) { scratch.rewind(); scratch.addArc(RectF(x-cell*.04f,y+cell*.03f,x+cell*.04f,y+cell*.095f),10f,160f)
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
      paint(i,art,if(kinds[i]=="shadow") alpha*35/255 else alpha)
      canvas.drawPath(if(eyesClosed && spec.closedOnBlocked && kinds[i]=="eyes") art.closedEyes else art.paths[i],paints[i]); draws++
    }
    return draws
  }
  private fun paint(i: Int,art: Layers,alpha: Int) {
    val p=paints[i]; p.alpha=alpha
    if(layerColours[i]==null) { p.shader=if(art.paletteColour==null) paletteShader else null; p.color=art.paletteColour ?: spec.colours[0]; p.alpha=alpha }
  }
  fun drawFlat(canvas: Canvas,line: Path,triangle: Path,width: Float,alpha: Int=255): Int {
    stroke.pathEffect=null; stroke.strokeWidth=width; stroke.color=spec.colours[0]; stroke.alpha=alpha
    canvas.drawPath(line,stroke); glow.color=spec.colours[0]; glow.alpha=alpha; canvas.drawPath(triangle,glow); return 2
  }
  fun drawGlow(canvas: Canvas,art: Layers,opacity: Float) { glow.color=Color.WHITE; glow.alpha=(opacity*255).toInt().coerceIn(0,255); canvas.drawPath(art.simple[0],glow) }
}

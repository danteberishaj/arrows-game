package com.danteb.arrows.board

import android.app.Instrumentation
import android.graphics.*
import android.os.Bundle
import android.util.Base64
import org.json.JSONObject

/** Native unit contract. Injected into a diagnostic APK only; runs the production Path/Region code. */
class SkinContractInstrumentation : Instrumentation() {
  private lateinit var arguments: Bundle
  override fun onCreate(args: Bundle) { arguments=args; start() }
  override fun onStart() {
    val result=Bundle()
    try {
      val data=JSONObject(String(Base64.decode(arguments.getString("data"),Base64.DEFAULT)))
      val legacy=arguments.getString("mode")=="before"
      val level=data.getJSONObject("level"); val cells=SkinGeometry.parse(level.getString("cells"))
      val flat=level.getString("geometry").split(';').map { parseFlat(it) }
      var checked=0; var failures=0; val samples=org.json.JSONArray(); val details=org.json.JSONArray()
      val specs=data.getJSONObject("specs")
      val ids=if(legacy) listOf("cinnamon") else specs.keys().asSequence().toList()
      for(id in ids) {
        val spec=SkinSpec(specs.getJSONObject(id).toString()); val renderer=SkinPaths(40f,spec)
        val old=if(legacy) Art03Paths(40f) else null
        renderer.setPalette(cells)
        var headFailures=0; var fitFailures=0; var oneCellChecks=0; var oldOneCellFailures=0; var headBoundaryPixels=0L; var alignedShaftChecks=0
        val prepared=ArrayList<SkinPaths.Layers>()
        for(i in cells.indices) {
          val minR=(0 until cells[i].length).minOf { cells[i].cells[it*2] }
          val minC=(0 until cells[i].length).minOf { cells[i].cells[it*2+1] }
          val originX=minC*40f; val originY=minR*40f
          val allowed=allowedRegion(cells[i]); val art=if(legacy) null else renderer.build(cells[i],i,2)
          if(art != null) {
            prepared.add(art)
            val direct = SkinPaths.Layers(renderer.layerCount)
            renderer.appendTo(direct,cells[i],2)
            for(layer in direct.paths.indices) {
              val difference = region(direct.paths[layer],originX,originY)
              difference.op(region(art.paths[layer],originX,originY),Region.Op.XOR)
              check(difference.isEmpty) { "$id translated compound differs arrow=$i layer=$layer" }
            }
          }
          val paths=if(old!=null) old.build(flat[i].first,flat[i].second,2).let { it.paths.toList()+it.closedEyes+it.simple.toList() }
            else art!!.paths.toList()+art.closedEyes+art.simple.toList()
          for((layer,path) in paths.withIndex()) {
            checked++; val remainder=region(path,originX,originY)
            if(!path.isEmpty) check(!remainder.isEmpty) { "Region oracle lost non-empty layer $layer of arrow $i" }
            remainder.op(allowed,Region.Op.DIFFERENCE)
            if(!remainder.isEmpty) {
              failures++; fitFailures++
              if(samples.length()<10) samples.put(JSONObject().put("spec",id).put("arrow",i).put("layer",layer).put("outsideArea",area(remainder)))
            }
          }
          if(art != null) {
            val missingHead = region(art.headDecoration,originX,originY)
            missingHead.op(region(art.paths[renderer.bodyIndex],originX,originY),Region.Op.DIFFERENCE)
            headBoundaryPixels += area(missingHead)
            val body = region(art.paths[renderer.bodyIndex],originX,originY)
            val insetBody = Region(body)
            for(x in listOf(-12,0,12)) for(y in listOf(-12,0,12)) { val shifted = Region(body); shifted.translate(x,y); insetBody.op(shifted,Region.Op.INTERSECT) }
            for(layer in renderer.accentIndices) {
              val outsideBody = region(art.paths[layer],originX,originY)
              outsideBody.op(insetBody,Region.Op.DIFFERENCE)
              if(!art.accentRuns[layer].isEmpty) check(components(region(art.accentRuns[layer],originX,originY)) == 1) { "$id interrupted shaft accent arrow=$i layer=$layer" }
              if(!art.accentRuns[layer].isEmpty) {
                val geometry=cells[i]
                val horizontal=geometry.dx != 0f && (0 until geometry.length).all { geometry.cells[it*2] == geometry.cells[0] }
                val vertical=geometry.dy != 0f && (0 until geometry.length).all { geometry.cells[it*2+1] == geometry.cells[1] }
                if(horizontal || vertical) {
                  val bounds=RectF(); art.accentRuns[layer].computeBounds(bounds,true)
                  val error=if(horizontal) bounds.centerY()-geometry.y(0,40f) else bounds.centerX()-geometry.x(0,40f)
                  check(kotlin.math.abs(error) < .005f) { "$id shaft accent off-axis arrow=$i layer=$layer centreError=$error" }
                  alignedShaftChecks++
                }
              }
              check(outsideBody.isEmpty) { "$id accent touches body edge arrow=$i layer=$layer area=${area(outsideBody)}" }
            }
            check(missingHead.isEmpty) { "$id head cap cancelled at shaft join arrow=$i missingArea=${area(missingHead)}" }
          }
          if(art != null && cells[i].length == 1) {
            oneCellChecks++
            if(id == "cinnamon") {
              val oldArt = Art04Paths(40f,spec).build(cells[i],i,2)
              val oldTail = region(oldArt.tailDecoration,originX,originY)
              val dot = Path().apply { addCircle(cells[i].x(0,40f),cells[i].y(0,40f),40f*(.13f+spec.tailRim),Path.Direction.CW) }
              oldTail.op(region(dot,originX,originY),Region.Op.DIFFERENCE)
              check(!oldTail.isEmpty) { "ART04 negative control failed to expose large one-cell roll" }
              oldOneCellFailures++
            }
            check(renderer.facePathsEmpty(art)) { "$id K8 one-cell face arrow=$i" }
            val dotLimit = Path().apply { addCircle(cells[i].x(0,40f),cells[i].y(0,40f),40f*(.13f+spec.tailRim),Path.Direction.CW) }
            val tailRemainder = region(art.tailDecoration,originX,originY)
            tailRemainder.op(region(dotLimit,originX,originY),Region.Op.DIFFERENCE)
            check(tailRemainder.isEmpty) { "$id K8 oversized one-cell tail arrow=$i" }
            if(spec.oneCellTail == "none") check(art.tailDecoration.isEmpty)
            val count = components(region(art.paths[renderer.rimIndex],originX,originY))
            check(count == 1) { "$id disconnected single-cell rim arrow=$i components=$count" }
          }
          if(art!=null && area(region(art.headDecoration,originX,originY)) <= area(region(art.tailDecoration,originX,originY))) {
            headFailures++
            if(samples.length()<10) samples.put(JSONObject().put("spec",id).put("arrow",i).put("headArea",area(region(art.headDecoration,originX,originY))).put("tailArea",area(region(art.tailDecoration,originX,originY))).put("headBounds",art.headDecoration.let { val b=RectF(); it.computeBounds(b,true); b.toString() }))
          }
        }
        val moveOnly = Path().apply { moveTo(20f,20f) }; val moveStroke = Path()
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
          strokeWidth = 40f * spec.layers.single { it.kind == "rim" }.width
          pathEffect = if(spec.roundedBends) CornerPathEffect(40f*.16f) else null
        }.getFillPath(moveOnly,moveStroke)
        var negativeComponents = 0
        if(!legacy) {
          val clean = renderer.build(SkinGeometry(0,intArrayOf(0,0)),0,2)
          val damaged = region(clean.paths[renderer.rimIndex],0f,0f)
          check(components(damaged) == 1)
          val oldShaft = region(moveStroke,0f,0f)
          oldShaft.op(Region(16,16,384,384),Region.Op.INTERSECT)
          damaged.op(oldShaft,Region.Op.UNION)
          negativeComponents = components(damaged)
          check(negativeComponents > 1) { "$id move-only negative control did not reproduce the fragment" }
        }
        android.util.Log.i("ArtSkinZeroLength", "spec=$id screenCell=29.387754 bounds=${region(moveStroke,0f,0f).bounds} area=${area(region(moveStroke,0f,0f))} negativeComponents=$negativeComponents")
        val drawResults=org.json.JSONArray()
        if(!legacy) {
          val bitmap=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888); val canvas=Canvas(bitmap)
          for(n in listOf(10,100,250)) {
            val compound=SkinPaths.Layers(renderer.layerCount)
            for(i in 0 until n) compound.add(prepared[i%prepared.size],2)
            val count=renderer.draw(canvas,compound,29.387754f)+1 // reserve the missed mark
            check(count<=8); drawResults.put(JSONObject().put("arrows",n).put("drawsWithMark",count))
          }
          check(spec.detail(spec.flatMin-.01f)==0)
          val flatArt=renderer.build(cells[0],0,spec.detail(10f))
          check(renderer.draw(canvas,flatArt,10f)==2)
          val motion=SkinMotion(40f,spec); motion.reduced=true
          motion.update("0,-1,-1,-1,-1,-1,-1",100L)
          check(motion.scaleAt(120L)==1f); motion.emit(flat[0].first,130L); check(motion.activeParticleCount()==0)
          motion.update("-1,-1,-1,-1,-1,1,0",140L)
          val a=Bitmap.createBitmap(128,128,Bitmap.Config.ARGB_8888); val b=Bitmap.createBitmap(128,128,Bitmap.Config.ARGB_8888)
          val arts=listOf(prepared[0]); val shafts=listOf(flat[0].first); val heads=listOf(flat[0].second)
          val ca=Canvas(a); val cb=Canvas(b)
          ca.translate(-prepared[0].bounds.left,-prepared[0].bounds.top); cb.translate(-prepared[0].bounds.left,-prepared[0].bounds.top)
          check(!motion.draw(ca,renderer,arts,{prepared[0]},shafts,heads,29.387754f,5.76f,300L))
          check(!motion.draw(cb,renderer,arts,{prepared[0]},shafts,heads,29.387754f,5.76f,900L))
          val pixels=IntArray(128*128); a.getPixels(pixels,0,128,0,0,128,128); check(pixels.any { it != 0 })
          check(a.sameAs(b)); a.recycle(); b.recycle(); bitmap.recycle()
          val broken = ConcatenatedHeadPaths(40f,spec).build(SkinGeometry(3,intArrayOf(0,0,0,1,0,2)),0,2)
          val missing = region(broken.headDecoration,0f,0f)
          missing.op(region(broken.paths[renderer.bodyIndex],0f,0f),Region.Op.DIFFERENCE)
          check(area(missing) > 100L) { "$id concatenated-cap negative control did not expose the join hole" }
          android.util.Log.i("ArtSkinHeadNegative", "spec=$id missingArea=${area(missing)} samplesPerCell=400")
          for(direction in 0..3) for(choice in listOf("dot", "none")) {
            val variant = JSONObject(spec.source.toString())
            variant.getJSONObject("tail").put("oneCell",choice)
            val oneRenderer = SkinPaths(40f,SkinSpec(variant.toString()))
            val one = oneRenderer.build(SkinGeometry(direction,intArrayOf(0,0)),0,2)
            check(oneRenderer.facePathsEmpty(one))
            check(area(region(one.tailDecoration,0f,0f)) <= 12200L) // dot outer radius <= .155 cell, 400 samples/cell
            check(area(region(one.headDecoration,0f,0f)) > area(region(one.tailDecoration,0f,0f)))
            if(choice == "none") check(one.tailDecoration.isEmpty)
            oneRenderer.clear()
          }
          check(fitFailures==0) { "$id K1 failures=$fitFailures samples=$samples" }; check(headFailures==0) { "$id K3 head failures=$headFailures samples=$samples" }
        }
        renderer.clear()
        details.put(JSONObject().put("spec",id).put("arrows",cells.size).put("fitFailures",fitFailures).put("headFailures",headFailures)
          .put("draws",drawResults).put("singleCellChecks",cells.count { it.length == 1 }).put("zeroLengthNegativeComponents",negativeComponents).put("oneCellChecks",oneCellChecks).put("art04OneCellFailures",oldOneCellFailures).put("headBoundaryPixels",headBoundaryPixels).put("alignedShaftChecks",alignedShaftChecks).put("flatLod",!legacy).put("reducedMotion",!legacy))
      }
      if(legacy) check(failures>0) { "Frozen ART03 unexpectedly fits" }
      result.putString("result",JSONObject().put("mode",if(legacy) "before" else "after").put("level",level.getInt("index"))
        .put("screenCellDp",29.387754).put("checkedPaths",checked).put("fitFailures",failures).put("specs",details).put("samples",samples)
        .put("status",if(legacy) "EXPECTED_K1_FAIL" else "PASS").toString())
      if(arguments.getString("render")=="true") {
        val scale=29.387754f*3.5f/40f
        val bitmap=Bitmap.createBitmap(kotlin.math.ceil(level.getInt("cols")*40*scale).toInt(),kotlin.math.ceil(level.getInt("rows")*40*scale).toInt(),Bitmap.Config.ARGB_8888)
        val canvas=Canvas(bitmap); canvas.drawColor(Color.WHITE); canvas.scale(scale,scale)
        val grid=Paint(Paint.ANTI_ALIAS_FLAG).apply { color=0x1A493A55; strokeWidth=.5f }
        for(r in 0 until level.getInt("rows")) for(c in 0 until level.getInt("cols")) canvas.drawCircle((c+.5f)*40,(r+.5f)*40,.8f,grid)
        for(id in ids) {
          canvas.drawColor(Color.WHITE)
          val spec=SkinSpec(specs.getJSONObject(id).toString())
          if(legacy) {
            val old=Art03Paths(40f); val compound=Art03Paths.Layers()
            for(i in cells.indices) compound.add(old.build(flat[i].first,flat[i].second,2),2)
            old.draw(canvas,compound,29.387754f)
          } else {
            val renderer=SkinPaths(40f,spec); renderer.setPalette(cells); val compound=SkinPaths.Layers(renderer.layerCount)
            for(i in cells.indices) compound.add(renderer.build(cells[i],i,2),2)
            renderer.draw(canvas,compound,29.387754f); renderer.clear()
          }
          val file=java.io.File(targetContext.getExternalFilesDir(null),"art04-${if(legacy) "before" else "after"}-$id.png")
          file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
          android.util.Log.i("ArtSkinCapture","path=${file.absolutePath} screenCell=29.387754 density=3.5 nativeCanvas=true")
        }
        bitmap.recycle()
      }
      finish(if(legacy) 1 else 0,result)
    } catch(e: Throwable) { result.putString("failure",e.stackTraceToString()); finish(1,result) }
  }
  private fun parseFlat(record: String): Pair<Path,Path> {
    val v=record.split(',').map { it.toFloat() }; val count=v[0].toInt(); val shaft=Path()
    shaft.moveTo(v[1],v[2]); for(i in 1 until count) shaft.lineTo(v[1+i*2],v[2+i*2])
    val j=1+count*2; val head=Path(); head.moveTo(v[j],v[j+1]); head.lineTo(v[j+2],v[j+3]); head.lineTo(v[j+4],v[j+5]); head.close()
    return shaft to head
  }
  private fun region(path: Path,originX: Float,originY: Float): Region {
    val scaled=Path(path); scaled.transform(Matrix().apply { setScale(10f,10f); postTranslate(-originX*10,-originY*10) })
    return Region().apply { setPath(scaled,Region(-100000,-100000,100000,100000)) }
  }
  /** Independent oracle: exact grid union, eroded in L-infinity by 16/400 cell on its exterior. */
  private fun allowedRegion(g: SkinGeometry): Region {
    val union=Region()
    val minR=(0 until g.length).minOf { g.cells[it*2] }; val minC=(0 until g.length).minOf { g.cells[it*2+1] }
    require((0 until g.length).all { (g.cells[it*2]-minR) < 32 && (g.cells[it*2+1]-minC) < 32 })
    for(i in 0 until g.length) { val r=g.cells[i*2]-minR; val c=g.cells[i*2+1]-minC; union.op(Rect(c*400,r*400,(c+1)*400,(r+1)*400),Region.Op.UNION) }
    val inset=Region(union)
    for(dx in listOf(-16,0,16)) for(dy in listOf(-16,0,16)) {
      val shifted=Region(union); shifted.translate(dx,dy); inset.op(shifted,Region.Op.INTERSECT)
    }
    return inset
  }
  /** Adjacent Region rectangles form the filled shape; corner touching counts as connected. */
  private fun components(region: Region): Int {
    val rectangles = ArrayList<Rect>(); val iterator = RegionIterator(region); val rect = Rect()
    while(iterator.next(rect)) rectangles.add(Rect(rect))
    val parent = IntArray(rectangles.size) { it }
    fun root(index: Int): Int { var i=index; while(parent[i] != i) { parent[i]=parent[parent[i]]; i=parent[i] }; return i }
    var previous = emptyList<Int>(); var current = ArrayList<Int>(); var top = Int.MIN_VALUE
    for(i in rectangles.indices) {
      val a=rectangles[i]
      if(a.top != top) { previous=current; current=ArrayList(); top=a.top }
      for(j in previous) {
        val b=rectangles[j]
        if(b.bottom == a.top && a.left <= b.right && a.right >= b.left) { val x=root(i); val y=root(j); if(x != y) parent[x]=y }
      }
      current.add(i)
    }
    return parent.indices.map { root(it) }.distinct().size
  }
  private fun area(region: Region): Long {
    val iterator=RegionIterator(region); val rect=Rect(); var area=0L
    while(iterator.next(rect)) area+=rect.width().toLong()*rect.height()
    return area
  }
}

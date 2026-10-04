package com.danteb.arrows.board

import android.graphics.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * HALLOWEEN-01 diagnostics (diagnostic APK only):
 *  1. every spec without a new field: production paths == frozen starting paths (Halloween01BeforePaths), at full and
 *     flat detail, including closed eyes, on the supplied level;
 *  2. lengthBands: independent order/fraction oracle on straight shafts, nested-head oracle, shaft-coverage oracle on
 *     every arrow of the level, and damaged fixtures (reversed bands, a removed head) that must be rejected;
 *  3. eyeShape: an independent shape classifier (bounding-box fill ratio) on every direction, open eyes, with a swapped
 *     shape as the negative control.
 * Region scale: 400 samples/cell (cell 40, x10), the same as the other contracts.
 */
object SkinHalloweenContract {
  private const val CELL=40f
  private fun region(path: Path,x: Float=0f,y: Float=0f): Region {
    val scaled=Path(path); scaled.transform(Matrix().apply { setScale(10f,10f); postTranslate(-x*10,-y*10) })
    return Region().apply { setPath(scaled,Region(-100000,-100000,100000,100000)) }
  }
  private fun area(region: Region): Long {
    val iterator=RegionIterator(region); val rect=Rect(); var area=0L
    while(iterator.next(rect)) area+=rect.width().toLong()*rect.height()
    return area
  }
  private fun containsPoint(path: Path,x: Float,y: Float): Boolean = region(path).contains((x*10).toInt(),(y*10).toInt())
  private fun usesNewField(spec: SkinSpec) = spec.eyeShape != "dot" || spec.layers.any { it.kind == "lengthBands" } ||
    spec.source.getJSONObject("face").has("eyeShape") || usesNew01bField(spec)
  /** HALLOWEEN-01b fields: seam `cap` and `tail.minCells`. */
  private fun usesNew01bField(spec: SkinSpec) = spec.layers.any { it.cap != "round" } || spec.source.getJSONObject("tail").has("minCells")
  private fun parseFlat(record: String): Pair<Path,Path> {
    val v=record.split(',').map { it.toFloat() }; val count=v[0].toInt(); val shaft=Path()
    shaft.moveTo(v[1],v[2]); for(i in 1 until count) shaft.lineTo(v[1+i*2],v[2+i*2])
    val j=1+count*2; val head=Path(); head.moveTo(v[j],v[j+1]); head.lineTo(v[j+2],v[j+3]); head.lineTo(v[j+4],v[j+5]); head.close()
    return shaft to head
  }
  /** Butt-capped seam bars on a straight horizontal arrow: every dash component spans <= dash[0] (+1 sample) along the
   *  path and nearly the full seam width across it. Round caps would add the width along the path. */
  private fun buttBars(spec: SkinSpec,renderer: SkinPaths,slot: Int,layer: SkinSpec.Layer): Int {
    val g=SkinGeometry(3,intArrayOf(0,0,0,1,0,2,0,3,0,4)); val art=renderer.build(g,0,2)
    val r=region(art.paths[slot]); check(!r.isEmpty) { "${spec.id} seam bars not drawn" }
    val iterator=RegionIterator(r); val rect=Rect(); var minX=Int.MAX_VALUE; var maxX=Int.MIN_VALUE
    val runs=ArrayList<IntArray>()
    while(iterator.next(rect)) runs.add(intArrayOf(rect.left,rect.right))
    // Columns covered, merged into contiguous along-path spans.
    val columns=java.util.TreeSet<Int>(); for(run in runs) for(x in run[0] until run[1]) columns.add(x)
    var spans=0; var start=-1; var previous=-2
    fun close(end: Int) { if(start>=0) { check(end-start+1 <= (layer.dash[0]*400).toInt()+2) { "${spec.id} seam bar ${end-start+1} samples along the path" }; spans++ } }
    for(x in columns) { if(x!=previous+1) { close(previous); start=x }; previous=x }
    close(previous); minX=columns.first(); maxX=columns.last()
    val b=r.bounds; check(b.height() >= (layer.width*400*.95f).toInt()) { "${spec.id} seam bars do not span the tube (${b.height()})" }
    return spans
  }
  /** tail.minCells: arrows of 2..minCells-1 cells have no tail (static and exit art); longer ones keep it. */
  private fun minCellsRule(spec: SkinSpec,renderer: SkinPaths,geometry: List<SkinGeometry>,flat: List<Pair<Path,Path>>): Int {
    var checks=0
    for((index,g) in geometry.withIndex()) {
      if(g.length<2) continue
      val expectTail=g.length >= spec.tailMinCells
      val art=renderer.build(g,index,2)
      check(!art.tailDecoration.isEmpty == expectTail) { "${spec.id} static tail cells=${g.length} expected=$expectTail" }
      val exit=SkinPaths.Layers(renderer.layerCount)
      renderer.buildInto(exit,flat[index].first,flat[index].second,2,false,g.length)
      check(!exit.tailDecoration.isEmpty == expectTail) { "${spec.id} exit tail cells=${g.length} expected=$expectTail" }
      checks++
    }
    return checks
  }
  private fun rejects(block: () -> Unit) { var rejected=false; try { block() } catch(_: Throwable) { rejected=true }; check(rejected) { "Damaged fixture was accepted" } }

  /** Straight horizontal arrow, independent of the renderer's measure: the TOPMOST band (bands draw in order) at the
   *  middle of fraction i of the visible shaft (tail point to the cap's back edge) must be band i; no band may start
   *  before its own fraction. */
  private fun bandOrder(spec: SkinSpec,bands: List<Path>,x0: Float,y: Float,cells: Int) {
    val visible=(cells-1)*CELL-spec.back*CELL
    for(i in bands.indices) {
      val mid=x0+visible*(i+.5f)/bands.size
      val top=bands.indices.lastOrNull { containsPoint(bands[it],mid,y) }
      check(top==i) { "${spec.id} visible band at fraction $i is $top" }
      for(j in i+1 until bands.size) check(!containsPoint(bands[j],mid,y)) { "${spec.id} band $j starts before its fraction" }
    }
  }
  private fun nestedHeads(spec: SkinSpec,layer: SkinSpec.Layer,bands: List<Path>,headCap: Path,hx: Float,hy: Float) {
    for(i in bands.indices) {
      val width=if(layer.bandWidths.isEmpty()) layer.width*(1f-i.toFloat()/layer.bands.size) else layer.bandWidths[i]
      val cap=Path(headCap); cap.transform(Matrix().apply { setScale(width/layer.width,width/layer.width,hx,hy) })
      val missing=region(cap); missing.op(region(bands[i]),Region.Op.DIFFERENCE)
      check(missing.isEmpty) { "${spec.id} band $i lacks its nested head" }
    }
  }

  /** The sample window follows the validated spec's eye size (HALLOWEEN-01b: larger eyes) and stays above the mouth. */
  private fun eyeShape(eyes: Path,cx: Float,cy: Float,sized: SkinSpec): String {
    val big=1.25f*sized.eyeRadius
    val (x0,y0,x1,y1)=when(sized.eyeShape) {
      "triangle" -> listOf(cx-big*CELL,cy-1.1f*big*CELL,cx+big*CELL,cy+.6f*big*CELL)
      else -> listOf(cx-.06f*CELL,cy-.06f*CELL,cx+.06f*CELL,cy+.06f*CELL)
    }
    val box=Region((x0*10).toInt(),(y0*10).toInt(),(x1*10).toInt(),(y1*10).toInt())
    val blob=region(eyes); blob.op(box,Region.Op.INTERSECT)
    check(!blob.isEmpty) { "no eye at $cx,$cy" }
    val b=blob.bounds; val fill=area(blob).toFloat()/(b.width().toFloat()*b.height())
    val h=b.height()/400f
    return when { fill >= .70f -> "dot"; fill in .40f.. .62f && h >= .07f -> "triangle"; h < .065f && fill < .62f -> "arc"; else -> "unknown(fill=$fill,h=$h)" }
  }

  fun check(data: JSONObject): JSONObject {
    val level=data.getJSONObject("level"); val geometry=SkinGeometry.parse(level.getString("cells"))
    val specs=data.getJSONObject("specs"); val entries=JSONArray()
    for(id in specs.keys()) {
      val json=specs.getJSONObject(id); val spec=SkinSpec(json.toString())
      val entry=JSONObject().put("spec",id).put("eyeShape",spec.eyeShape).put("lengthBands",spec.layers.count { it.kind=="lengthBands" })
      if(spec.id != "pumpkin") {
        // HALLOWEEN-01b: every spec without a 01b field keeps the exact cd10d12 paths (Ghost and Candy Corn included).
        check(!usesNew01bField(spec))
        val now=SkinPaths(CELL,spec,true); val old=Halloween01bBeforePaths(CELL,spec,true)
        now.setPalette(geometry); old.setPalette(geometry); var compared=0
        for(detail in listOf(2,0)) for((index,g) in geometry.withIndex()) {
          val a=now.build(g,index,detail); val b=old.build(g,index,detail)
          for(i in a.paths.indices) { check(a.paths[i].approximate(.001f).contentEquals(b.paths[i].approximate(.001f))) { "$id changed vs cd10d12 arrow=$index layer=$i" }; compared++ }
          for(i in a.simple.indices) { check(a.simple[i].approximate(.001f).contentEquals(b.simple[i].approximate(.001f))); compared++ }
          check(a.closedEyes.approximate(.001f).contentEquals(b.closedEyes.approximate(.001f))); compared++
        }
        now.clear(); old.clear(); entry.put("unchangedVsCd10d12",compared)
      }
      if(!usesNewField(spec)) {
        val now=SkinPaths(CELL,spec,true); val old=Halloween01BeforePaths(CELL,spec,true)
        now.setPalette(geometry); old.setPalette(geometry)
        var compared=0
        for(detail in listOf(2,0)) for((index,g) in geometry.withIndex()) {
          val a=now.build(g,index,detail); val b=old.build(g,index,detail)
          for(i in a.paths.indices) { check(a.paths[i].approximate(.001f).contentEquals(b.paths[i].approximate(.001f))) { "$id changed path arrow=$index layer=$i detail=$detail" }; compared++ }
          for(i in a.simple.indices) { check(a.simple[i].approximate(.001f).contentEquals(b.simple[i].approximate(.001f))) { "$id changed simple arrow=$index" }; compared++ }
          check(a.closedEyes.approximate(.001f).contentEquals(b.closedEyes.approximate(.001f))) { "$id changed closed eyes arrow=$index" }; compared++
        }
        // Negative control: a 0.1 px displacement must be detected by the same comparison.
        val shifted=Path(now.build(geometry[0],0,2).paths[now.bodyIndex]); shifted.offset(.1f,0f)
        check(!shifted.approximate(.001f).contentEquals(old.build(geometry[0],0,2).paths[old.bodyIndex].approximate(.001f)))
        now.clear(); old.clear()
        entries.put(entry.put("unchangedPathArrays",compared).put("displacementControlRejected",true)); continue
      }
      val renderer=SkinPaths(CELL,spec,true); renderer.setPalette(geometry)
      if(usesNew01bField(spec)) {
        var seamSlot=0; for(layer in spec.layers) { if(layer.kind=="seam" && layer.cap=="butt") {
          val spans=buttBars(spec,renderer,seamSlot,layer); entry.put("buttRibBars",spans)
          // Negative control: the same seam with round caps must fail the bar oracle.
          val round=JSONObject(json.toString()); round.getJSONArray("layers").let { a -> for(i in 0 until a.length()) a.getJSONObject(i).let { if(it.getString("kind")=="seam") it.remove("cap") } }
          val roundSpec=SkinSpec(round.toString()); val roundRenderer=SkinPaths(CELL,roundSpec,true)
          rejects { buttBars(roundSpec,roundRenderer,seamSlot,roundSpec.layers[spec.layers.indexOf(layer)]) }
          roundRenderer.clear(); entry.put("roundCapControlRejected",true)
        }; seamSlot += if(layer.kind=="bands"||layer.kind=="lengthBands") layer.bands.size else 1 }
        if(spec.tailMinCells > 2) {
          val flat=level.getString("geometry").split(';').map { parseFlat(it) }
          entry.put("minCellsChecks",minCellsRule(spec,renderer,geometry,flat))
          val every=JSONObject(json.toString()); every.getJSONObject("tail").remove("minCells")
          val everySpec=SkinSpec(every.toString()); val everyRenderer=SkinPaths(CELL,everySpec,true); everyRenderer.setPalette(geometry)
          // Negative control: the default (tail on every multi-cell arrow) violates the declared minimum.
          if(geometry.any { it.length in 2 until spec.tailMinCells }) {
            rejects { minCellsRule(spec, everyRenderer, geometry, flat) }
            entry.put("defaultTailControlRejected",true)
          }
          everyRenderer.clear()
        }
      }
      var slot=0; val firstSlot=HashMap<SkinSpec.Layer,Int>()
      for(layer in spec.layers) { firstSlot[layer]=slot; slot += if(layer.kind=="bands"||layer.kind=="lengthBands") layer.bands.size else 1 }
      for(layer in spec.layers.filter { it.kind=="lengthBands" }) {
        val first=firstSlot.getValue(layer)
        var orderChecks=0; var headChecks=0; var coverageChecks=0; var maxUncovered=0L
        for(cells in 2..6) {
          val g=SkinGeometry(3,IntArray(cells*2) { if(it%2==0) 0 else it/2 })
          val art=renderer.build(g,0,2)
          val bands=(0 until layer.bands.size).map { art.paths[first+it] }
          bandOrder(spec,bands,g.x(0,CELL),g.y(0,CELL),cells); orderChecks++
          nestedHeads(spec,layer,bands,art.headDecoration,g.x(cells-1,CELL),g.y(cells-1,CELL)); headChecks++
          // Damaged fixtures: reversed band order and a band with its head removed must both be rejected.
          rejects { bandOrder(spec,bands.reversed(),g.x(0,CELL),g.y(0,CELL),cells) }
          val headless=bands.toMutableList()
          val noHead=Path(bands.last()); noHead.op(Path(art.headDecoration),Path.Op.DIFFERENCE); headless[headless.size-1]=noHead
          rejects { nestedHeads(spec,layer,headless,art.headDecoration,g.x(cells-1,CELL),g.y(cells-1,CELL)) }
        }
        // Coverage on every real arrow (bends included): the body between tail disc and cap is covered by the bands.
        // A stroke of a sub-curve and of the whole curve flatten differently, leaving raster slivers <= 2 samples wide
        // (1 sample = 1/400 cell). Gaps are therefore judged after a 3x3 erosion; raw sliver areas are reported, and a
        // .05-cell cut through the bands (20 samples wide) must still be rejected.
        fun uncovered(g: SkinGeometry,bands: List<Path>,head: Path,body: Path): Pair<Long,Long> {
          val missing=region(body)
          val cover=Region(); for(band in bands) cover.op(region(band),Region.Op.UNION)
          cover.op(region(head),Region.Op.UNION)
          val tail=Path().apply { addCircle(g.x(0,CELL),g.y(0,CELL),CELL*(spec.layers.single { it.kind=="body" }.width/2+.01f),Path.Direction.CW) }
          cover.op(region(tail),Region.Op.UNION)
          missing.op(cover,Region.Op.DIFFERENCE)
          val eroded=Region(missing)
          for(dx in -1..1) for(dy in -1..1) { val shifted=Region(missing); shifted.translate(dx,dy); eroded.op(shifted,Region.Op.INTERSECT) }
          return area(missing) to area(eroded)
        }
        var maxEroded=0L
        for((index,g) in geometry.withIndex()) {
          if(g.length<2) continue
          val art=renderer.build(g,index,2)
          val (raw,eroded)=uncovered(g,(0 until layer.bands.size).map { art.paths[first+it] },art.headDecoration,art.paths[renderer.bodyIndex])
          maxUncovered=maxOf(maxUncovered,raw); maxEroded=maxOf(maxEroded,eroded)
          check(eroded == 0L) { "$id body not covered by length bands arrow=$index raw=$raw eroded=$eroded" }
          coverageChecks++
        }
        run {
          val g=SkinGeometry(3,intArrayOf(0,0,0,1,0,2,0,3)); val art=renderer.build(g,0,2)
          val cut=Path().apply { addRect(g.x(1,CELL),0f,g.x(1,CELL)+CELL*.05f,CELL,Path.Direction.CW) }
          val damaged=(0 until layer.bands.size).map { Path(art.paths[first+it]).apply { op(cut,Path.Op.DIFFERENCE) } }
          check(uncovered(g,damaged,art.headDecoration,art.paths[renderer.bodyIndex]).second > 0L) { "$id cut bands accepted" }
        }
        entry.put("maxErodedUncoveredSamples",maxEroded)
        entry.put("bandOrderChecks",orderChecks).put("nestedHeadChecks",headChecks).put("coverageArrows",coverageChecks)
          .put("maxRawSliverSamples",maxUncovered).put("damagedFixturesRejected",orderChecks*2+1)
      }
      if(spec.eyes && spec.faceAnchor=="head") {
        var shapeChecks=0
        fun classify(r: SkinPaths,s: SkinSpec,direction: Int): List<String> {
          val g=SkinGeometry(direction,intArrayOf(1,1))
          val art=r.build(g,0,2)
          val hx=g.x(0,CELL)+g.dx*CELL*s.faceHeadOffset; val hy=g.y(0,CELL)+g.dy*CELL*s.faceHeadOffset
          val eyes=r.eyePaths(art).first()
          return listOf(-1,1).map { side -> eyeShape(eyes,hx+side*CELL*s.eyeHalfGap,hy,spec) }
        }
        for(direction in 0..3) { check(classify(renderer,spec,direction).all { it==spec.eyeShape }) { "$id eyes are not ${spec.eyeShape} direction=$direction" }; shapeChecks+=2 }
        // Negative control: swapping the shape must change the classification.
        val swapped=JSONObject(json.toString()); swapped.getJSONObject("face").put("eyeShape",if(spec.eyeShape=="dot") "triangle" else "dot")
        val other=SkinSpec(swapped.toString()); val otherRenderer=SkinPaths(CELL,other,true)
        check(classify(otherRenderer,other,0).none { it==spec.eyeShape }) { "$id swapped eye shape still classified as ${spec.eyeShape}" }
        otherRenderer.clear()
        entry.put("eyeShapeChecks",shapeChecks).put("eyeShapeNegativeRejected",true)
      }
      renderer.clear(); entries.put(entry)
    }
    return JSONObject().put("status","PASS").put("level",level.getInt("index")).put("screenCellDp",29.387754).put("specs",entries)
  }
}

package com.danteb.arrows.board

import android.graphics.*
import org.json.JSONObject
import org.json.JSONArray

/** ART08 diagnostics: independent clearance oracle, damaged fixtures and unchanged-path proof. */
object SkinPolishContract {
  private val polish=setOf("cinnamon","sherbet","candy-gloss","jelly","critter","rainbow-ribbon","campfire","strawberry-glazed")
  private val crease=setOf("paper-craft","stained-glass","archery")
  /** HALLOWEEN-01: only the 17 specs that existed at ART08 have frozen ART08 paths; later specs are new data. */
  private val art08=setOf("cinnamon","sherbet","ink-pro","candy-gloss","jelly","critter","yarn","paper-craft","archery","pixel",
    "neon-glass","rainbow-ribbon","clear-glass","stained-glass","campfire","lava-rock","strawberry-glazed")
  private fun region(path: Path,x: Float=0f,y: Float=0f): Region {
    val scaled=Path(path); scaled.transform(Matrix().apply { setScale(10f,10f); postTranslate(-x*10,-y*10) })
    return Region().apply { setPath(scaled,Region(-100000,-100000,100000,100000)) }
  }
  private fun inset(source: Region): Region = Region(source).apply {
    for(x in listOf(-12,0,12)) for(y in listOf(-12,0,12)) {
      val shifted=Region(source); shifted.translate(x,y); op(shifted,Region.Op.INTERSECT)
    }
  }
  private fun fitsFace(spec: SkinSpec,renderer: SkinPaths,art: SkinPaths.Layers,g: SkinGeometry): Boolean {
    val x=g.x(0,40f); val y=g.y(0,40f)
    val shape=if(spec.faceAnchor=="head") art.headDecoration else Path().apply { addCircle(x,y,40f*spec.tailRadius,Path.Direction.CW) }
    val allowed=inset(region(shape,x,y))
    return renderer.eyePaths(art).all { path ->
      val actual=region(path,x,y); val nonempty=!actual.isEmpty
      actual.op(allowed,Region.Op.DIFFERENCE); nonempty && actual.isEmpty
    }
  }
  /** HALLOWEEN-PLUS: a head face's blush ovals (Little Bat A uses them as fangs) must also stay inside the filled
   *  head with .03-cell clearance; K1 alone would accept an oval that leaves the head but stays in the cell. */
  private fun fitsBlush(spec: SkinSpec,art: SkinPaths.Layers,g: SkinGeometry): Boolean {
    val x=g.x(0,40f); val y=g.y(0,40f)
    val slot=spec.layers.sumOf { if(it.kind=="bands"||it.kind=="lengthBands") it.bands.size else 1 }
    val allowed=inset(region(art.headDecoration,x,y))
    val actual=region(art.paths[slot],x,y); val nonempty=!actual.isEmpty
    actual.op(allowed,Region.Op.DIFFERENCE); return nonempty && actual.isEmpty
  }
  private fun rejects(block: () -> Unit) { var rejected=false; try { block() } catch(_: Throwable) { rejected=true }; check(rejected) { "Damaged fixture was accepted" } }
  private fun components(region: Region): Int {
    val rectangles=ArrayList<Rect>(); val iterator=RegionIterator(region); val rect=Rect()
    while(iterator.next(rect)) rectangles.add(Rect(rect))
    val parent=IntArray(rectangles.size) { it }
    fun root(index: Int): Int { var i=index; while(parent[i]!=i) { parent[i]=parent[parent[i]]; i=parent[i] }; return i }
    var previous=emptyList<Int>(); var current=ArrayList<Int>(); var top=Int.MIN_VALUE
    for(i in rectangles.indices) {
      val a=rectangles[i]
      if(a.top!=top) { previous=current; current=ArrayList(); top=a.top }
      for(j in previous) { val b=rectangles[j]
        if(b.bottom==a.top && a.left<=b.right && a.right>=b.left) { val x=root(i); val y=root(j); if(x!=y) parent[x]=y }
      }
      current.add(i)
    }
    return parent.indices.map { root(it) }.distinct().size
  }
  fun check(data: JSONObject): JSONObject {
    val level=data.getJSONObject("level"); val geometry=SkinGeometry.parse(level.getString("cells"))
    val specs=data.getJSONObject("specs"); val entries=JSONArray()
    for(id in specs.keys()) {
      val json=specs.getJSONObject(id); val spec=SkinSpec(json.toString())
      val renderer=SkinPaths(40f,spec,true); renderer.setPalette(geometry)
      var faceChecks=0; var headFaces=0; var pathChecks=0; var changedCreases=0; var negative=0
      var blushChecks=0; var blushOutside=0
      val candidate=data.optJSONArray("candidates")?.let { a -> (0 until a.length()).any { a.getString(it)==id } } ?: false
      if(spec.customFace && spec.eyes) {
        for((index,g) in geometry.withIndex()) {
          if(g.length==1 && spec.faceAnchor!="head") continue
          val art=renderer.build(g,index,2)
          check(fitsFace(spec,renderer,art,g)) { "$id eye/mouth clearance < .03 arrow=$index direction=${g.direction}" }
          faceChecks++; if(g.length==1) headFaces++
          if(spec.blush && spec.faceAnchor=="head") {
            // HALLOWEEN-PLUS shipped (2026-10-07): gated for EVERY spec. The concept run found 0 outside for the
            // registered Critter and Ghost too, so the earlier report-only exemption for registered specs is dropped.
            if(!fitsBlush(spec,art,g)) { blushOutside++; check(false) { "$id blush/fang clearance < .03 arrow=$index direction=${g.direction} candidate=$candidate" } }
            blushChecks++
          }
        }
        if(spec.blush && spec.faceAnchor=="head") {
          val moved=JSONObject(json.toString()); moved.getJSONObject("face").put("blushOffset",JSONArray(listOf(.4,.3)))
          val bad=SkinSpec(moved.toString()); val r=SkinPaths(40f,bad,true); val g=SkinGeometry(0,intArrayOf(1,0,0,0))
          check(!fitsBlush(bad,r.build(g,0,2),g)) { "$id outside blush control accepted" }; r.clear(); negative++
        }
        val damaged=JSONObject(json.toString()); damaged.getJSONObject("face").put("eyeHalfGap",.4)
        val broken=SkinSpec(damaged.toString()); val brokenRenderer=SkinPaths(40f,broken,true)
        val g=SkinGeometry(0,intArrayOf(1,0,0,0))
        check(!fitsFace(broken,brokenRenderer,brokenRenderer.build(g,0,2),g)) { "$id outside eye control accepted" }
        brokenRenderer.clear(); negative++
        if(spec.faceAnchor=="head") {
          val displaced=JSONObject(json.toString()); displaced.getJSONObject("face").put("headOffset",.4)
          val bad=SkinSpec(displaced.toString()); val r=SkinPaths(40f,bad,true)
          check(!fitsFace(bad,r,r.build(g,0,2),g)) { "$id outside face anchor accepted" }
          r.clear(); negative++
        }
      }
      if(spec.headCornerRadius>0f) {
        check(spec.headCornerRadius>=.10f && spec.halfWidth==.44f && spec.tip<=.46f)
        check(2*kotlin.math.atan(spec.halfWidth/(spec.tip+spec.back))*180/kotlin.math.PI<=80)
        val damaged=JSONObject(json.toString()); damaged.getJSONObject("head").put("halfWidth",.6)
        rejects { SkinSpec(damaged.toString()) }; negative++
        val sharp=JSONObject(json.toString()); sharp.getJSONObject("head").put("cornerRadius",.01)
        rejects { check(SkinSpec(sharp.toString()).headCornerRadius>=.10f) }; negative++
      }
      if(spec.beadDiameter!=null) {
        // Critter's owner-approved ART08 bead recipe stays pinned; later bead specs need only the connected .28 spine.
        if(id=="critter") check(spec.beadDiameter==.52f && spec.beadPitch==.5f)
        check(spec.beadTubeWidth!!>=.28f)
        val g=SkinGeometry(3,intArrayOf(0,0,0,1,0,2))
        fun spineFits(r: SkinPaths): Boolean {
          val body=region(r.build(g,0,2).paths[r.bodyIndex]); val spine=Region(200,144,1000,256)
          spine.op(body,Region.Op.DIFFERENCE); return spine.isEmpty
        }
        check(spineFits(renderer)) { "$id caterpillar spine narrower than .28" }
        val damaged=JSONObject(json.toString()); damaged.getJSONObject("beads").put("tubeWidth",.0001).put("diameter",.1).put("pitch",.8)
        val r=SkinPaths(40f,SkinSpec(damaged.toString()),true)
        check(components(region(r.build(g,0,2).paths[r.bodyIndex]))>1) { "$id damaged beads were not disconnected" }
        check(!spineFits(r)) { "$id disconnected bead fixture accepted" }; r.clear(); negative++
      }
      if(id !in polish && id in art08) {
        val before=Art08BeforePaths(40f,spec,true); before.setPalette(geometry)
        val fold=spec.layers.indexOfFirst { it.kind=="fold" }
        for((index,g) in geometry.withIndex()) {
          val old=before.build(g,index,2); val now=renderer.build(g,index,2)
          for(i in now.paths.indices) {
            val same=now.paths[i].approximate(.001f).contentEquals(old.paths[i].approximate(.001f))
            if(id in crease && i==fold) { if(!same) changedCreases++ }
            else { check(same) { "$id unexpected path change arrow=$index layer=$i" }; pathChecks++ }
          }
          check(now.closedEyes.approximate(.001f).contentEquals(old.closedEyes.approximate(.001f))); pathChecks++
          for(i in now.simple.indices) { check(now.simple[i].approximate(.001f).contentEquals(old.simple[i].approximate(.001f))); pathChecks++ }
        }
        before.clear()
      }
      val runtime=SkinPaths(40f,spec,false); runtime.setPalette(geometry)
      val compound=SkinPaths.Layers(runtime.layerCount)
      for(g in geometry) runtime.appendTo(compound,g,2)
      val work=JSONObject().put("templates",runtime.templateCount).put("runtimeAuditPaths",runtime.auditPathCount)
        .put("faceBuilds",runtime.faceBuildCount).put("spiralBuilds",runtime.spiralBuildCount)
        .put("centrelineBuilds",runtime.centrelineBuildCount).put("bandHeadBuilds",runtime.bandHeadBuildCount)
      check(runtime.auditPathCount==0); runtime.clear(); renderer.clear()
      entries.put(JSONObject().put("spec",id).put("faceClearanceChecks",faceChecks).put("oneCellHeadFaces",headFaces)
        .put("unchangedPathArrays",pathChecks).put("changedCreasePaths",changedCreases).put("negativeControls",negative).put("runtimeWork",work)
        .put("candidate",candidate).put("blushClearanceChecks",blushChecks).put("blushOutsideReported",blushOutside))
    }
    return JSONObject().put("status","PASS").put("level",level.getInt("index")).put("screenCellDp",29.387754).put("specs",entries)
  }
}

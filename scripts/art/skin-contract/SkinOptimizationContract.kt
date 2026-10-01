package com.danteb.arrows.board

import android.graphics.*
import org.json.JSONObject
import org.json.JSONArray

/** Diagnostic A/B: frozen/current/audited paths and non-empty pixels at the real LOD.
 * Closed-eye feedback is checked per arrow; static strips do not merge closed eyes. */
object SkinOptimizationContract {
  fun check(data: JSONObject): JSONObject {
    val level=data.getJSONObject("level")
    val geometry=SkinGeometry.parse(level.getString("cells"))
    val specs=data.getJSONObject("specs"); val entries=JSONArray()
    val bitmap=Bitmap.createBitmap(700,1000,Bitmap.Config.ARGB_8888)
    val pixelsA=IntArray(700000); val pixelsB=IntArray(700000)
    for(id in specs.keys()) {
      val spec=SkinSpec(specs.getJSONObject(id).toString())
      val before=Art07BeforePaths(40f,spec); before.setPalette(geometry)
      val after=SkinPaths(40f,spec); after.setPalette(geometry)
      val audited=SkinPaths(40f,spec,true); audited.setPalette(geometry)
      val old=Art07BeforePaths.Layers(before.layerCount)
      val current=SkinPaths.Layers(after.layerCount)
      val audit=SkinPaths.Layers(audited.layerCount)
      for(g in geometry) { before.appendTo(old,g,2); after.appendTo(current,g,2); audited.appendTo(audit,g,2) }
      var pathChecks=0; var pixelChecks=0; var paintedPixels=0
      fun equalPath(actual: Path, expected: Path, context: String) {
        check(actual.approximate(.001f).contentEquals(expected.approximate(.001f))) { "$id changed $context" }
        pathChecks++
      }
      for(i in current.paths.indices) {
        equalPath(current.paths[i],old.paths[i],"filled path $i")
        equalPath(current.paths[i],audit.paths[i],"audited filled path $i")
      }
      for((index,g) in geometry.withIndex()) {
        val oldArt=before.build(g,index,2); val art=after.build(g,index,2); val auditArt=audited.build(g,index,2)
        equalPath(art.closedEyes,oldArt.closedEyes,"closed eyes $index")
        equalPath(art.closedEyes,auditArt.closedEyes,"audited closed eyes $index")
        old.closedEyes.addPath(oldArt.closedEyes); current.closedEyes.addPath(art.closedEyes)
        for(i in 0..1) {
          equalPath(art.simple[i],oldArt.simple[i],"simple path $index/$i")
          equalPath(art.simple[i],auditArt.simple[i],"audited simple path $index/$i")
        }
      }
      val broken=Path(current.paths[after.bodyIndex]); broken.offset(.1f,0f)
      check(!broken.approximate(.001f).contentEquals(current.paths[after.bodyIndex].approximate(.001f))) { "$id missing displacement negative control" }
      check(after.auditPathCount==0 && audited.auditPathCount>0) { "$id runtime audit allocation" }
      // Freeze full-detail work counters before creating additional LOD fixtures.
      val entry=JSONObject().put("spec",id).put("templates",after.templateCount)
        .put("runtimeAuditPaths",after.auditPathCount).put("avoidedAuditPaths",audited.auditPathCount)
        .put("faceBuildsBefore",before.faceBuildCount).put("faceBuildsAfter",after.faceBuildCount)
        .put("spiralBuildsBefore",before.spiralBuildCount).put("spiralBuildsAfter",after.spiralBuildCount)
        .put("centrelineBuildsBefore",before.centrelineBuildCount).put("centrelineBuildsAfter",after.centrelineBuildCount)
        .put("bandHeadBuildsBefore",before.bandHeadBuildCount).put("bandHeadBuildsAfter",after.bandHeadBuildCount)
      val oldFlat=Art07BeforePaths.Layers(before.layerCount); val flat=SkinPaths.Layers(after.layerCount)
      for(g in geometry) { before.appendTo(oldFlat,g,spec.detail(5f)); after.appendTo(flat,g,spec.detail(5f)) }
      for(i in 0..1) equalPath(flat.simple[i],oldFlat.simple[i],"real flat LOD $i")
      for(background in intArrayOf(Color.WHITE,Color.parseColor("#13111C")))
        for(cellDp in floatArrayOf(29.387754f,38f,5f)) for(closed in listOf(false,true)) {
          bitmap.eraseColor(background)
          val ca=Canvas(bitmap); ca.scale(cellDp/40f,cellDp/40f); ca.translate(-380f,-300f)
          before.draw(ca,if(cellDp==5f) oldFlat else old,cellDp,eyesClosed=closed)
          bitmap.getPixels(pixelsA,0,700,0,0,700,1000)
          bitmap.eraseColor(background)
          val cb=Canvas(bitmap); cb.scale(cellDp/40f,cellDp/40f); cb.translate(-380f,-300f)
          after.draw(cb,if(cellDp==5f) flat else current,cellDp,eyesClosed=closed)
          bitmap.getPixels(pixelsB,0,700,0,0,700,1000)
          val visible=pixelsA.count { it != background }
          check(visible>0) { "$id empty pixel fixture bg=$background cell=$cellDp closed=$closed" }
          paintedPixels+=visible
          check(pixelsA.contentEquals(pixelsB)) { "$id changed pixels bg=$background cell=$cellDp closed=$closed" }
          pixelChecks++
        }
      entries.put(entry.put("pathSampleChecks",pathChecks).put("pixelChecks",pixelChecks).put("nonBackgroundPixelSamples",paintedPixels))
      before.clear(); after.clear(); audited.clear()
    }
    bitmap.recycle()
    return JSONObject().put("status","PASS").put("level",level.getInt("index"))
      .put("backgrounds",JSONArray(listOf("#FFFFFF","#13111C"))).put("screenCellDp",29.387754).put("results",entries)
  }
}

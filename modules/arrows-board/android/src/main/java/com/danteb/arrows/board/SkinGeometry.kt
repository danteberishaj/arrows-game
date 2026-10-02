package com.danteb.arrows.board

import android.graphics.Path

/** Exact owned cells from core, separate from the flat renderer's extended endpoints. */
class SkinGeometry(val direction: Int, val cells: IntArray) {
  val dx get() = when(direction) { 2 -> -1f; 3 -> 1f; else -> 0f }
  val dy get() = when(direction) { 0 -> -1f; 1 -> 1f; else -> 0f }
  val length get() = cells.size / 2
  fun x(i: Int, cell: Float) = (cells[i * 2 + 1] + .5f) * cell
  fun y(i: Int, cell: Float) = (cells[i * 2] + .5f) * cell
  /** Inset the EXTERIOR of the union. Internal cell connections remain continuous. */
  fun allowed(cell: Float): Path {
    val path = Path()
    val owned = HashSet<Long>()
    fun key(r: Int, c: Int) = (r.toLong() shl 32) xor (c.toLong() and 0xffffffffL)
    for(i in 0 until length) owned.add(key(cells[i*2], cells[i*2+1]))
    val gap = cell * .04f
    for(i in 0 until length) {
      val r = cells[i*2]; val c = cells[i*2+1]; val left = c * cell; val top = r * cell
      path.addRect(left+gap, top+gap, left+cell-gap, top+cell-gap, Path.Direction.CW)
      if(owned.contains(key(r,c+1))) path.addRect(left+cell-gap, top+gap, left+cell+gap, top+cell-gap, Path.Direction.CW)
      if(owned.contains(key(r+1,c))) path.addRect(left+gap, top+cell-gap, left+cell-gap, top+cell+gap, Path.Direction.CW)
      if(owned.contains(key(r,c+1)) && owned.contains(key(r+1,c)) && owned.contains(key(r+1,c+1)))
        path.addRect(left+cell-gap, top+cell-gap, left+cell+gap, top+cell+gap, Path.Direction.CW)
    }
    return path
  }
  companion object {
    fun parse(value: String): List<SkinGeometry> = if(value.isBlank()) emptyList() else value.split(';').map { record ->
      val values = record.split(',').map { it.toInt() }
      require(values.size >= 3 && values.size % 2 == 1 && values[0] in 0..3)
      SkinGeometry(values[0], values.drop(1).toIntArray())
    }
  }
}

package com.danteb.arrows.board

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArrowsBoardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArrowsBoard")

    View(ArrowsBoardView::class) {
      Prop("geometry") { view: ArrowsBoardView, geometry: String ->
        view.setGeometry(geometry)
      }

      Prop("visibleMask") { view: ArrowsBoardView, visibleMask: String ->
        view.setVisibleMask(visibleMask)
      }

      Prop("ink") { view: ArrowsBoardView, ink: String ->
        view.setInk(ink)
      }

      Prop("strokeWidth") { view: ArrowsBoardView, strokeWidth: Float ->
        view.setStrokeWidth(strokeWidth)
      }

      Prop("exitAnimation") { view: ArrowsBoardView, exitAnimation: String ->
        view.setExitAnimation(exitAnimation)
      }

      // POLISH-T4 (META_BOARD_GRID): never set by JS while the flag is off.
      Prop("grid") { view: ArrowsBoardView, grid: String ->
        view.setGrid(grid)
      }

      Prop("gridStyle") { view: ArrowsBoardView, gridStyle: String ->
        view.setGridStyle(gridStyle)
      }

      // POLISH-T5 (META_MISSED_MARK): never set by JS while the flag is off.
      Prop("markMask") { view: ArrowsBoardView, markMask: String ->
        view.setMarkMask(markMask)
      }

      Prop("markColor") { view: ArrowsBoardView, markColor: String ->
        view.setMarkColor(markColor)
      }

      OnViewDestroys { view: ArrowsBoardView ->
        view.clearPaths()
      }
    }
  }
}

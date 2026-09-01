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

      OnViewDestroys { view: ArrowsBoardView ->
        view.clearPaths()
      }
    }
  }
}

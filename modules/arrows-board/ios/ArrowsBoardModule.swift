import ExpoModulesCore

public class ArrowsBoardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArrowsBoard")

    View(ArrowsBoardView.self) {
      Prop("geometry") { (view: ArrowsBoardView, geometry: String) in
        view.setGeometry(geometry)
      }

      Prop("visibleMask") { (view: ArrowsBoardView, visibleMask: String) in
        view.setVisibleMask(visibleMask)
      }

      Prop("ink") { (view: ArrowsBoardView, ink: String) in
        view.setInk(ink)
      }

      Prop("strokeWidth") { (view: ArrowsBoardView, strokeWidth: Double) in
        view.setStrokeWidth(strokeWidth)
      }

      Prop("exitAnimation") { (view: ArrowsBoardView, exitAnimation: String) in
        view.setExitAnimation(exitAnimation)
      }
    }
  }
}

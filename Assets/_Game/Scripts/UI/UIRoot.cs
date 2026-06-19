using UnityEngine;
using UnityEngine.UI;

namespace Arrows
{
    /// <summary>
    /// Plain holder for the UI elements GameManager drives at runtime. Populated by
    /// Bootstrap after it builds the screen hierarchy.
    /// </summary>
    public class UIRoot
    {
        public GameObject mainMenu;
        public GameObject gameScreen;

        public RectTransform boardViewport;   // masked, fixed-size; clips the board
        public RectTransform boardRoot;       // zoomable Content the tiles live in
        public BoardPanZoom boardPanZoom;
        public Text levelLabel;
        public RectTransform heartsContainer;
        public Text resumeLabel;

        // Overlay: reused for the brief win toast, the lose panel, and all-clear.
        public GameObject overlay;
        public Image overlayDim;
        public Text overlayTitle;
        public Text overlaySub;
        public RectTransform overlayButtons;
    }
}

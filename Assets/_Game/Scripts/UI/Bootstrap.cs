using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace Arrows
{
    /// <summary>
    /// The single component placed in the scene. On startup it builds the camera,
    /// event system, canvas and the entire UI procedurally, wires up the managers, and
    /// opens the main menu. Visual style is "Bright Minimal" (white paper, black line-art
    /// arrows, one periwinkle accent) to match the reference game — see DESIGN.md.
    /// </summary>
    public class Bootstrap : MonoBehaviour
    {
        private void Start()
        {
            CreateCamera();
            CreateEventSystem();
            var canvas = CreateCanvas();

            // Base background fill (sits behind every screen).
            var bg = canvas.gameObject.AddComponent<Image>(); // canvas root has RectTransform
            bg.color = GameManager.Palette.Bg;

            var ui = new UIRoot();
            ui.mainMenu = BuildMainMenu(canvas.transform, ui);
            ui.gameScreen = BuildGameScreen(canvas.transform, ui);
            ui.gameScreen.SetActive(false); // shown (and faded in) only when a level starts
            BuildOverlay(canvas.transform, ui);

            var audio = gameObject.AddComponent<AudioManager>();
            audio.Init();
            var board = gameObject.AddComponent<BoardManager>();
            var game = gameObject.AddComponent<GameManager>();
            board.Configure(game, audio, ui.boardRoot, ui.boardPanZoom);

            // Levels are generated at runtime (infinite), so there is no level database to load.
            game.Init(board, audio, ui);
        }

        // ---- Engine objects -------------------------------------------------

        private void CreateCamera()
        {
            if (Camera.main != null) return;
            var go = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = go.AddComponent<Camera>();
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = GameManager.Palette.Bg;
            go.AddComponent<AudioListener>();
        }

        private void CreateEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
        }

        private Canvas CreateCanvas()
        {
            var go = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
            return canvas;
        }

        // ---- Main menu ------------------------------------------------------

        private GameObject BuildMainMenu(Transform parent, UIRoot ui)
        {
            var screen = NewScreen("MainMenu", parent);
            ui.menuGroup = screen.AddComponent<CanvasGroup>();

            BuildLogo(screen.transform, 0.62f, 150);

            // Resume level label under the logo (periwinkle, like the reference).
            var resume = UIFactory.CreateText("LevelLabel", screen.transform, "Level 1", 50,
                GameManager.Palette.AccentLight, TextAnchor.MiddleCenter, FontStyle.Bold);
            Anchor(resume.rectTransform, new Vector2(0.5f, 0.515f), new Vector2(820, 72));
            ui.resumeLabel = resume;

            // Big periwinkle Play pill, lower third.
            var play = UIFactory.CreatePillButton("PlayButton", screen.transform, "Play",
                GameManager.Palette.Accent, GameManager.Palette.InkOnAccent, 620, 168, 54);
            Anchor(play.GetComponent<RectTransform>(), new Vector2(0.5f, 0.30f), new Vector2(620, 168));
            play.onClick.AddListener(() => GetComponent<GameManager>().PlayResume());
            ui.playButtonRect = play.GetComponent<RectTransform>();
            ui.playIdle = play.gameObject.AddComponent<IdlePulse>(); // gentle "tap me" breathing

            return screen;
        }

        /// <summary>Builds the "Arrows" wordmark with the capital A drawn as a filled triangle.</summary>
        private void BuildLogo(Transform parent, float anchorY, int fontSize)
        {
            var container = UIFactory.NewUIObject("Logo", parent);
            var crt = container.GetComponent<RectTransform>();
            crt.anchorMin = crt.anchorMax = new Vector2(0.5f, anchorY);
            crt.pivot = new Vector2(0.5f, 0.5f);
            crt.anchoredPosition = Vector2.zero;
            crt.sizeDelta = new Vector2(1040, 260);

            var navy = GameManager.Palette.AccentCore;

            var text = UIFactory.CreateText("Wordmark", container.transform, "rrows", fontSize, navy,
                TextAnchor.MiddleLeft, FontStyle.Bold);
            float tw = text.preferredWidth;
            if (tw <= 1f) tw = fontSize * 0.52f * 5f; // fallback if font metrics aren't ready yet

            float triW = fontSize * 0.92f;
            float gap = fontSize * 0.04f;
            float total = triW + gap + tw;
            float baseX = -total / 2f;

            var tri = UIFactory.CreateImage("A", container.transform, UIFactory.TriangleSprite, navy);
            var trt = tri.rectTransform;
            trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 0.5f);
            trt.pivot = new Vector2(0.5f, 0.5f);
            trt.sizeDelta = new Vector2(triW, triW);
            trt.anchoredPosition = new Vector2(baseX + triW / 2f, -fontSize * 0.04f);

            var wrt = text.rectTransform;
            wrt.anchorMin = wrt.anchorMax = new Vector2(0.5f, 0.5f);
            wrt.pivot = new Vector2(0f, 0.5f);
            wrt.sizeDelta = new Vector2(tw + 24, 220);
            wrt.anchoredPosition = new Vector2(baseX + triW + gap, 0f);
        }

        // ---- Game screen ----------------------------------------------------

        private GameObject BuildGameScreen(Transform parent, UIRoot ui)
        {
            var screen = NewScreen("GameScreen", parent);
            ui.gameGroup = screen.AddComponent<CanvasGroup>();

            // Masked viewport that clips the (possibly huge) board; pan/zoom lives here and
            // a transparent Image makes it a raycast target so empty areas can be dragged.
            var viewportGO = UIFactory.NewUIObject("BoardViewport", screen.transform);
            var viewportRT = viewportGO.GetComponent<RectTransform>();
            // Stretch to fill the screen between the header and the bottom (with margins) so
            // the viewport is always fully on-screen regardless of device aspect ratio.
            viewportRT.anchorMin = new Vector2(0f, 0f);
            viewportRT.anchorMax = new Vector2(1f, 1f);
            viewportRT.pivot = new Vector2(0.5f, 0.5f);
            viewportRT.offsetMin = new Vector2(20f, 40f);    // left, bottom
            viewportRT.offsetMax = new Vector2(-20f, -215f); // right, top (room for the header)
            var viewportImg = viewportGO.AddComponent<Image>();
            viewportImg.color = new Color(0, 0, 0, 0f);
            viewportImg.raycastTarget = true; // empty-area drags pan the board
            viewportGO.AddComponent<RectMask2D>();
            var panZoom = viewportGO.AddComponent<BoardPanZoom>();

            // Zoomable content the board tiles live in; BoardManager sizes it per level.
            var contentGO = UIFactory.NewUIObject("BoardContent", viewportGO.transform);
            var contentRT = contentGO.GetComponent<RectTransform>();
            contentRT.anchorMin = contentRT.anchorMax = new Vector2(0.5f, 0.5f);
            contentRT.pivot = new Vector2(0.5f, 0.5f);
            contentRT.anchoredPosition = Vector2.zero;
            contentRT.sizeDelta = new Vector2(100, 100);
            panZoom.SetContent(contentRT);

            ui.boardViewport = viewportRT;
            ui.boardRoot = contentRT;
            ui.boardPanZoom = panZoom;

            // Header: centered "Level N" with the heart row beneath it.
            var label = UIFactory.CreateText("LevelLabel", screen.transform, "Level 1", 50,
                GameManager.Palette.AccentLight, TextAnchor.MiddleCenter, FontStyle.Bold);
            Anchor(label.rectTransform, new Vector2(0.5f, 0.952f), new Vector2(640, 76));
            ui.levelLabel = label;

            var heartsGO = UIFactory.NewUIObject("Hearts", screen.transform);
            var heartsRT = heartsGO.GetComponent<RectTransform>();
            heartsRT.anchorMin = heartsRT.anchorMax = new Vector2(0.5f, 0.908f);
            heartsRT.pivot = new Vector2(0.5f, 0.5f);
            heartsRT.anchoredPosition = Vector2.zero;
            heartsRT.sizeDelta = new Vector2(760, 60);
            var hlg = heartsGO.AddComponent<HorizontalLayoutGroup>();
            hlg.childControlWidth = hlg.childControlHeight = false;
            hlg.childForceExpandWidth = hlg.childForceExpandHeight = false;
            hlg.spacing = 16; hlg.childAlignment = TextAnchor.MiddleCenter;
            ui.heartsContainer = heartsRT;

            // Thin divider under the header.
            var divGO = UIFactory.NewUIObject("Divider", screen.transform);
            var divImg = divGO.AddComponent<Image>();
            divImg.color = GameManager.Palette.Border;
            divImg.raycastTarget = false;
            var divRT = divGO.GetComponent<RectTransform>();
            divRT.anchorMin = new Vector2(0.06f, 0.888f);
            divRT.anchorMax = new Vector2(0.94f, 0.888f);
            divRT.offsetMin = new Vector2(0f, -1.5f);
            divRT.offsetMax = new Vector2(0f, 1.5f);

            // Top-left back + restart circular buttons (matching the reference header).
            var back = UIFactory.CreateRoundButton("BackBtn", screen.transform, UIFactory.TriangleSprite,
                GameManager.Palette.Surface, GameManager.Palette.AccentCore, 96f, 0.40f, 90f);
            TopLeft(back.GetComponent<RectTransform>(), new Vector2(78f, -80f));
            back.onClick.AddListener(() => GetComponent<GameManager>().ShowMainMenu());

            var restart = UIFactory.CreateRoundButton("RestartBtn", screen.transform, UIFactory.RestartSprite,
                GameManager.Palette.Surface, GameManager.Palette.AccentCore, 96f, 0.52f, 0f);
            TopLeft(restart.GetComponent<RectTransform>(), new Vector2(196f, -80f));
            restart.onClick.AddListener(() => GetComponent<GameManager>().RetryCurrent());

            // Top-right hint button (lightbulb) — highlights a safe next move, like the reference.
            var hint = UIFactory.CreateRoundButton("HintBtn", screen.transform, UIFactory.HintSprite,
                GameManager.Palette.Surface, GameManager.Palette.Accent, 96f, 0.50f, 0f);
            TopRight(hint.GetComponent<RectTransform>(), new Vector2(-78f, -80f));
            hint.onClick.AddListener(() => GetComponent<GameManager>().UseHint());

            return screen;
        }

        // ---- Overlay (win toast / lose) -------------------------------------

        private void BuildOverlay(Transform parent, UIRoot ui)
        {
            var screen = NewScreen("Overlay", parent);
            ui.overlayGroup = screen.AddComponent<CanvasGroup>();

            var dim = screen.AddComponent<Image>();
            dim.color = new Color(0, 0, 0, 0f);
            ui.overlayDim = dim;

            var title = UIFactory.CreateText("OverlayTitle", screen.transform, "", 96,
                GameManager.Palette.Accent, TextAnchor.MiddleCenter, FontStyle.Bold);
            Anchor(title.rectTransform, new Vector2(0.5f, 0.62f), new Vector2(960, 160));
            ui.overlayTitle = title;

            var sub = UIFactory.CreateText("OverlaySub", screen.transform, "", 38, GameManager.Palette.InkDim);
            Anchor(sub.rectTransform, new Vector2(0.5f, 0.52f), new Vector2(840, 120));
            ui.overlaySub = sub;

            var btnGO = UIFactory.NewUIObject("OverlayButtons", screen.transform);
            var btnRT = btnGO.GetComponent<RectTransform>();
            Anchor(btnRT, new Vector2(0.5f, 0.34f), new Vector2(620, 320));
            var vlg = btnGO.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = 26; vlg.childAlignment = TextAnchor.UpperCenter;
            vlg.childControlWidth = vlg.childControlHeight = true;
            vlg.childForceExpandWidth = true; vlg.childForceExpandHeight = false;
            ui.overlayButtons = btnRT;

            screen.SetActive(false);
            ui.overlay = screen;
        }

        // ---- Helpers --------------------------------------------------------

        private GameObject NewScreen(string name, Transform parent)
        {
            var go = UIFactory.NewUIObject(name, parent);
            UIFactory.FullStretch(go.GetComponent<RectTransform>());
            return go;
        }

        private static void Anchor(RectTransform rt, Vector2 anchorPivot, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = anchorPivot;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = size;
        }

        // Anchor to the top-left corner; keeps the element's existing size.
        private static void TopLeft(RectTransform rt, Vector2 pos)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
        }

        // Anchor to the top-right corner; pos.x is typically negative (inset from the edge).
        private static void TopRight(RectTransform rt, Vector2 pos)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
        }
    }
}

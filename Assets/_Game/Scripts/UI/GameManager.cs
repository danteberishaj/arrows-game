using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Arrows
{
    /// <summary>
    /// Owns game flow: main menu and the active puzzle. There is no level-select
    /// screen — Play resumes the saved level and the game auto-advances level to
    /// level. Progress (the resume pointer) persists via SaveSystem.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        // "Bright Minimal" — sampled from the reference game (com.ecffri.arrows): white
        // paper, black line-art arrows, one periwinkle-indigo accent, coral hearts.
        public static class Palette
        {
            public static readonly Color Bg = new Color(1f, 1f, 1f);                     // white
            public static readonly Color Surface = new Color(0.922f, 0.929f, 0.965f);    // #EBEDF6 panels/buttons
            public static readonly Color Border = new Color(0.870f, 0.882f, 0.937f);     // faint divider line
            public static readonly Color Accent = new Color(0.353f, 0.443f, 0.996f);     // #5A71FE periwinkle
            public static readonly Color AccentCore = new Color(0.188f, 0.227f, 0.455f); // #303A74 deep navy (logo/icons)
            public static readonly Color AccentLight = new Color(0.557f, 0.612f, 0.937f);// #8E9CEF level label
            public static readonly Color AccentDeep = new Color(0.290f, 0.357f, 0.839f); // darker accent (pressed)
            public static readonly Color Heart = new Color(0.988f, 0.290f, 0.361f);      // #FC4A5C coral-red
            public static readonly Color HeartLost = new Color(0.808f, 0.831f, 0.969f);  // #CED4F7 spent pip
            public static readonly Color Ink = new Color(0.067f, 0.067f, 0.067f);        // black arrows/text
            public static readonly Color InkDim = new Color(0.541f, 0.565f, 0.651f);     // muted secondary text
            public static readonly Color InkOnAccent = new Color(1f, 1f, 1f);            // white label on accent
        }

        private BoardManager _board;
        private AudioManager _audio;
        private UIRoot _ui;

        private int _levelIndex;
        private int _hearts;
        private int _maxHearts;
        private readonly List<Image> _heartDots = new();

        public void Init(BoardManager board, AudioManager audio, UIRoot ui)
        {
            _board = board;
            _audio = audio;
            _ui = ui;
            ShowMainMenu();
        }

        // Levels are infinite; resume from the saved counter with no upper bound.
        private int ResumeIndex => Mathf.Max(0, SaveSystem.CurrentLevel);

        // ---- Screens --------------------------------------------------------

        public void ShowMainMenu()
        {
            HideOverlay();
            _ui.mainMenu.SetActive(true);
            _ui.gameScreen.SetActive(false);
            if (_ui.resumeLabel != null)
                _ui.resumeLabel.text = "Level " + (ResumeIndex + 1);
        }

        public void PlayResume() => StartLevel(ResumeIndex);

        public void StartLevel(int index)
        {
            HideOverlay();
            _levelIndex = index;
            var level = LevelGenerator.Generate(index); // deterministic per index

            _maxHearts = Mathf.Max(1, level.Hearts);
            _hearts = _maxHearts;
            BuildHearts();
            _ui.levelLabel.text = $"Level {index + 1}";

            _ui.mainMenu.SetActive(false);
            _ui.gameScreen.SetActive(true);
            _board.LoadBoard(level.Board);
        }

        public void RetryCurrent() => StartLevel(_levelIndex);

        private void BuildHearts()
        {
            foreach (var d in _heartDots)
                if (d != null) Destroy(d.gameObject);
            _heartDots.Clear();

            for (int i = 0; i < _maxHearts; i++)
            {
                var img = UIFactory.CreateImage($"Heart{i}", _ui.heartsContainer, UIFactory.HeartSprite, Palette.Heart);
                img.GetComponent<RectTransform>().sizeDelta = new Vector2(46, 46);
                _heartDots.Add(img);
            }
        }

        // ---- Outcomes -------------------------------------------------------

        public void OnHeartLost()
        {
            _hearts = Mathf.Max(0, _hearts - 1);
            if (_hearts < _heartDots.Count && _heartDots[_hearts] != null)
                _heartDots[_hearts].color = Palette.HeartLost;

            if (_hearts <= 0)
            {
                _board.LockInput();
                ShowLose();
            }
        }

        public void OnLevelCleared()
        {
            _board.LockInput();
            SaveSystem.SetCurrentLevel(_levelIndex + 1); // endless: no upper bound
            _audio?.PlayWin();
            StartCoroutine(WinThenAdvance());
        }

        private IEnumerator WinThenAdvance()
        {
            ShowWinToast();
            yield return new WaitForSeconds(1.15f);
            StartLevel(_levelIndex + 1); // endless
        }

        // ---- Overlay --------------------------------------------------------

        private void HideOverlay() => _ui.overlay.SetActive(false);

        private void ClearOverlayButtons()
        {
            var c = _ui.overlayButtons;
            for (int i = c.childCount - 1; i >= 0; i--) Destroy(c.GetChild(i).gameObject);
        }

        private Button AddOverlayButton(string label, Color bg, Color fg)
        {
            var btn = UIFactory.CreateButton(label, _ui.overlayButtons, label, bg, fg);
            var le = btn.gameObject.AddComponent<LayoutElement>();
            le.preferredHeight = 130; le.minHeight = 130;
            return btn;
        }

        private void ShowWinToast()
        {
            _ui.overlay.SetActive(true);
            _ui.overlayDim.color = new Color(0, 0, 0, 0f);
            _ui.overlayDim.raycastTarget = false;
            _ui.overlayTitle.text = "Solved!";
            _ui.overlayTitle.color = Palette.Accent;
            _ui.overlaySub.text = string.Empty;
            ClearOverlayButtons();
        }

        private void ShowLose()
        {
            _ui.overlay.SetActive(true);
            _ui.overlayDim.color = new Color(1f, 1f, 1f, 0.80f); // light scrim over the white board
            _ui.overlayDim.raycastTarget = true;
            _ui.overlayTitle.text = "Out of hearts";
            _ui.overlayTitle.color = Palette.Heart;
            _ui.overlaySub.text = "Find the order — every arrow needs a clear path.";
            ClearOverlayButtons();
            AddOverlayButton("Retry", Palette.Accent, Palette.InkOnAccent).onClick.AddListener(RetryCurrent);
            AddOverlayButton("Menu", Palette.Surface, Palette.Ink).onClick.AddListener(ShowMainMenu);
        }

    }
}

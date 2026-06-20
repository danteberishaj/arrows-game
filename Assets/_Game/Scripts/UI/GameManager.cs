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
        private Coroutine _transition; // active screen-fade, so a new one can cancel it

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

        public void ShowMainMenu() => RunTransition(ShowMainMenuRoutine());

        public void PlayResume() => StartLevel(ResumeIndex);

        // Highlights a safe next move on the current board (the hint button).
        public void UseHint() => _board?.ShowHint();

        public void StartLevel(int index) => RunTransition(StartLevelRoutine(index));

        public void RetryCurrent() => StartLevel(_levelIndex);

        // Starts a screen transition, cancelling any in-flight one so they never overlap.
        private void RunTransition(IEnumerator routine)
        {
            if (_transition != null) StopCoroutine(_transition);
            _transition = StartCoroutine(routine);
        }

        private IEnumerator ShowMainMenuRoutine()
        {
            yield return FadeOutOverlay();
            if (_ui.resumeLabel != null)
                _ui.resumeLabel.text = "Level " + (ResumeIndex + 1);
            SetDifficultyLabel(_ui.menuDifficultyLabel, Difficulties.ForLevel(ResumeIndex));

            // Bring the menu up hidden so revealing the game below it doesn't flash it at full alpha.
            _ui.mainMenu.SetActive(true);
            SetGroup(_ui.menuGroup, 0f, false);
            if (_ui.playButtonRect != null) _ui.playButtonRect.localScale = Vector3.one * 0.9f;

            if (_ui.gameScreen.activeSelf && _ui.gameGroup != null && _ui.gameGroup.alpha > 0.01f)
                yield return UITween.Fade(_ui.gameGroup, 0f, 0.16f);
            _ui.gameScreen.SetActive(false);

            // Entrance: fade the menu in, then a gentle spring on the Play button.
            yield return UITween.Fade(_ui.menuGroup, 1f, 0.22f, UITween.EaseOutCubic);
            if (_ui.playButtonRect != null)
                yield return UITween.Scale(_ui.playButtonRect, Vector3.one * 0.9f, Vector3.one, 0.26f, UITween.EaseOutBack);
            SetGroup(_ui.menuGroup, 1f, true);
            if (_ui.playIdle != null) _ui.playIdle.Resume(); // start the gentle breathing once settled
            _transition = null;
        }

        private IEnumerator StartLevelRoutine(int index)
        {
            yield return FadeOutOverlay();
            _levelIndex = index;
            var level = LevelGenerator.Generate(index); // deterministic per index
            _maxHearts = Mathf.Max(1, level.Hearts);
            _hearts = _maxHearts;
            _ui.levelLabel.text = $"Level {index + 1}";
            SetDifficultyLabel(_ui.levelDifficultyLabel, level.Difficulty);

            // Fade out whatever is showing (the menu, or the previous/cleared board).
            if (_ui.mainMenu.activeSelf)
            {
                yield return UITween.Fade(_ui.menuGroup, 0f, 0.16f);
                _ui.mainMenu.SetActive(false);
            }
            else if (_ui.gameScreen.activeSelf && _ui.gameGroup != null && _ui.gameGroup.alpha > 0.01f)
            {
                yield return UITween.Fade(_ui.gameGroup, 0f, 0.16f);
            }

            // Rebuild hearts while hidden so the header doesn't visibly reflow, then load and fade in.
            BuildHearts();
            _ui.gameScreen.SetActive(true);
            SetGroup(_ui.gameGroup, 0f, false);
            _board.LoadBoard(level.Board);
            yield return UITween.Fade(_ui.gameGroup, 1f, 0.20f, UITween.EaseOutCubic);
            SetGroup(_ui.gameGroup, 1f, true);
            _transition = null;
        }

        private static void SetGroup(CanvasGroup cg, float alpha, bool interactable)
        {
            if (cg == null) return;
            cg.alpha = alpha;
            cg.interactable = interactable;
            cg.blocksRaycasts = interactable;
        }

        // Shows a difficulty tier on a label, colour-coded so it reads at a glance.
        private static void SetDifficultyLabel(Text label, Difficulty d)
        {
            if (label == null) return;
            label.text = Difficulties.DisplayName(d);
            label.color = DifficultyColor(d);
        }

        private static Color DifficultyColor(Difficulty d) => d switch
        {
            Difficulty.SuperHard => Palette.Heart,  // coral-red — hardest
            Difficulty.Hard => Palette.AccentCore,  // deep navy — stronger
            _ => Palette.InkDim,                    // muted grey — normal
        };

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
                StartCoroutine(SpendHeart(_heartDots[_hearts]));

            if (_hearts <= 0)
            {
                _board.LockInput();
                ShowLose();
            }
        }

        // The spent pip pops and fades from coral to muted, so losing a heart reads clearly.
        private IEnumerator SpendHeart(Image pip)
        {
            StartCoroutine(UITween.Pop(pip.rectTransform, 1.35f, 0.28f));
            const float dur = 0.28f;
            float t = 0f;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                pip.color = Color.Lerp(Palette.Heart, Palette.HeartLost, UITween.EaseOutQuad(Mathf.Clamp01(t / dur)));
                yield return null;
            }
            pip.color = Palette.HeartLost;
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
            yield return ShowWinToast();              // pop the "Solved!" toast in
            yield return new WaitForSecondsRealtime(0.8f);
            yield return FadeOutOverlay();            // ease the toast out
            StartLevel(_levelIndex + 1);             // endless; the new board fades in
        }

        // ---- Overlay --------------------------------------------------------

        private IEnumerator FadeOutOverlay()
        {
            if (_ui.overlay.activeSelf && _ui.overlayGroup != null)
                yield return UITween.Fade(_ui.overlayGroup, 0f, 0.18f);
            _ui.overlay.SetActive(false);
        }

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

        private IEnumerator ShowWinToast()
        {
            _ui.overlay.SetActive(true);
            _ui.overlayDim.color = new Color(0, 0, 0, 0f);
            _ui.overlayDim.raycastTarget = false;
            _ui.overlayTitle.text = "Solved!";
            _ui.overlayTitle.color = Palette.Accent;
            _ui.overlaySub.text = string.Empty;
            ClearOverlayButtons();

            SetGroup(_ui.overlayGroup, 0f, false); // a transient toast; never blocks input
            StartCoroutine(UITween.Pop(_ui.overlayTitle.rectTransform, 1.16f, 0.40f));
            yield return UITween.Fade(_ui.overlayGroup, 1f, 0.16f, UITween.EaseOutCubic);
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

            SetGroup(_ui.overlayGroup, 0f, true);
            StartCoroutine(UITween.Fade(_ui.overlayGroup, 1f, 0.22f, UITween.EaseOutCubic));
            StartCoroutine(UITween.Pop(_ui.overlayTitle.rectTransform, 1.12f, 0.42f));
        }

    }
}

using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Fits this RectTransform to the device safe area — the region not covered by status
    /// bars, notches, punch-hole cameras, or rounded corners (Unity's <see cref="Screen.safeArea"/>).
    /// Put it on a full-screen screen root so the header/controls inside never get cropped or
    /// hidden under system UI. The full-screen white background lives on the Canvas root, so
    /// the paper still extends edge-to-edge — only the interactive content is inset.
    /// Re-applies whenever the safe area or resolution changes (rotation, fold, etc.).
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class SafeArea : MonoBehaviour
    {
        private RectTransform _rt;
        private Rect _lastSafe;
        private int _lastW, _lastH;

        private void Awake() => _rt = GetComponent<RectTransform>();
        private void OnEnable() => Apply();

        private void Update()
        {
            if (Screen.safeArea != _lastSafe || Screen.width != _lastW || Screen.height != _lastH)
                Apply();
        }

        private void Apply()
        {
            int w = Screen.width, h = Screen.height;
            if (w <= 0 || h <= 0 || _rt == null) return;

            Rect safe = Screen.safeArea;
            Vector2 min = safe.position;
            Vector2 max = safe.position + safe.size;
            min.x /= w; min.y /= h;
            max.x /= w; max.y /= h;

            _rt.anchorMin = min;
            _rt.anchorMax = max;
            _rt.offsetMin = Vector2.zero;
            _rt.offsetMax = Vector2.zero;

            _lastSafe = safe; _lastW = w; _lastH = h;
        }
    }
}

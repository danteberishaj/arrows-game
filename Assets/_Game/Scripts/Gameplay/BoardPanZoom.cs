using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.EnhancedTouch;
using ETouch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace Arrows
{
    /// <summary>
    /// Makes a large board playable on a phone: fit-to-view on load, pinch to zoom in,
    /// drag to pan. Lives on the masked board Viewport and scales/moves the Content child.
    /// Arrows keep receiving taps because they don't implement IDragHandler — a drag that
    /// starts on an arrow bubbles up here and pans instead of firing, while a clean tap
    /// still fires. The per-cell tap filter in ArrowTile maps screen -> local through the
    /// scaled/panned Content, so taps stay accurate at any zoom.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class BoardPanZoom : MonoBehaviour,
        IBeginDragHandler, IDragHandler, IEndDragHandler, IScrollHandler
    {
        [SerializeField] private RectTransform content;

        private RectTransform _viewport;
        private float _scale = 1f, _minScale = 1f, _maxScale = 1f;
        private bool _dragging, _pinching;
        private float _lastPinchDist;

        private const float MaxZoomFactor = 3.5f;  // max zoom in, relative to fit-to-view
        private const float OpenZoomFactor = 1.8f; // initial zoom: board larger than screen, scrollable
        private const float FitMargin = 0.94f;     // small border when fully zoomed out

        public bool IsGesturing => _dragging || _pinching;

        public void SetContent(RectTransform c) => content = c;

        private void Awake() => _viewport = GetComponent<RectTransform>();
        private void OnEnable() => EnhancedTouchSupport.Enable();
        private void OnDisable() => EnhancedTouchSupport.Disable();

        /// <summary>Fit the whole content into the viewport and centre it (min zoom = fit).</summary>
        public void Fit()
        {
            if (content == null) return;
            Vector2 vp = _viewport.rect.size;
            Vector2 cs = content.rect.size;
            if (cs.x < 1f || cs.y < 1f || vp.x < 1f || vp.y < 1f) return;

            // Fully zoomed out shows the whole board (pinch out to reach this).
            float fit = Mathf.Min(vp.x / cs.x, vp.y / cs.y) * FitMargin;
            _minScale = fit;
            _maxScale = fit * MaxZoomFactor;
            // Open larger than the screen so it reads well and the player scrolls around.
            _scale = Mathf.Clamp(fit * OpenZoomFactor, _minScale, _maxScale);
            content.localScale = new Vector3(_scale, _scale, 1f);
            content.anchoredPosition = Vector2.zero;
            ClampPosition();
        }

        public void OnBeginDrag(PointerEventData e) { if (!_pinching) _dragging = true; }
        public void OnEndDrag(PointerEventData e) => _dragging = false;

        public void OnDrag(PointerEventData e)
        {
            if (_pinching || content == null) return;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(_viewport, e.position, e.pressEventCamera, out var cur) &&
                RectTransformUtility.ScreenPointToLocalPointInRectangle(_viewport, e.position - e.delta, e.pressEventCamera, out var prev))
            {
                content.anchoredPosition += cur - prev;
                ClampPosition();
            }
        }

        public void OnScroll(PointerEventData e)
        {
            float factor = 1f + Mathf.Clamp(e.scrollDelta.y, -3f, 3f) * 0.12f;
            ZoomAround(e.position, _scale * factor, e.enterEventCamera);
        }

        private void Update()
        {
            var touches = ETouch.activeTouches;
            if (touches.Count >= 2)
            {
                Vector2 p0 = touches[0].screenPosition;
                Vector2 p1 = touches[1].screenPosition;
                float dist = Vector2.Distance(p0, p1);
                Vector2 mid = (p0 + p1) * 0.5f;
                if (!_pinching)
                {
                    _pinching = true;
                    _dragging = false;
                    _lastPinchDist = dist;
                }
                else if (_lastPinchDist > 0.01f)
                {
                    ZoomAround(mid, _scale * (dist / _lastPinchDist), null);
                    _lastPinchDist = dist;
                }
            }
            else
            {
                _pinching = false;
            }
        }

        private void ZoomAround(Vector2 screenPoint, float targetScale, Camera cam)
        {
            if (content == null) return;
            targetScale = Mathf.Clamp(targetScale, _minScale, _maxScale);
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(_viewport, screenPoint, cam, out var mid))
                return;

            // The content-local point under the focus is kept fixed across the zoom.
            Vector2 contentLocal = (mid - content.anchoredPosition) / _scale;
            _scale = targetScale;
            content.localScale = new Vector3(_scale, _scale, 1f);
            content.anchoredPosition = mid - contentLocal * _scale;
            ClampPosition();
        }

        // Keep the (scaled) content covering the viewport; centre any axis smaller than it.
        private void ClampPosition()
        {
            Vector2 vp = _viewport.rect.size;
            Vector2 scaled = content.rect.size * _scale;
            Vector2 pos = content.anchoredPosition;

            float maxX = Mathf.Max(0f, (scaled.x - vp.x) * 0.5f);
            float maxY = Mathf.Max(0f, (scaled.y - vp.y) * 0.5f);
            pos.x = Mathf.Clamp(pos.x, -maxX, maxX);
            pos.y = Mathf.Clamp(pos.y, -maxY, maxY);
            content.anchoredPosition = pos;
        }
    }
}

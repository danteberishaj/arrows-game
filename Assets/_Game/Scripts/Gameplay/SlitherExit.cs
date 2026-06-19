using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Arrows
{
    /// <summary>
    /// Plays an arrow's "slither" exit: a flowing line-art trail that runs head-first along
    /// the arrow's own (possibly bent) centerline and continues straight off the board. The
    /// trail is a tight chain of solid dots sampled along the path at a fixed spacing that
    /// overlap into a continuous black tube; as the head advances, every dot follows the same
    /// trail, so the body retraces the bends and the shape visibly changes (rather than
    /// sliding rigidly). Self-destroys when the whole body has left the board.
    /// </summary>
    public class SlitherExit : MonoBehaviour
    {
        private Vector2[] _pts;     // polyline in board-local space: tail -> head -> off-board
        private float[] _cum;       // cumulative arc length at each point
        private float _total;       // total arc length of the path
        private float _bodyLen;     // arc length the trail occupies (the arrow body)
        private float _spacing;     // arc distance between beads
        private Color _color;
        private float _duration;
        private readonly List<Image> _beads = new();

        public void Play(IList<Vector2> points, float bodyLen, float cellSize, Color color, float duration = 0.34f)
        {
            _pts = new Vector2[points.Count];
            for (int i = 0; i < points.Count; i++) _pts[i] = points[i];

            _bodyLen = Mathf.Max(bodyLen, 0.45f * cellSize); // single-cell arrows still get a short trail
            _spacing = 0.08f * cellSize;                     // tight spacing => a continuous tube
            _color = color;
            _duration = duration;
            float beadSize = 0.20f * cellSize;               // ~arrow stroke thickness

            _cum = new float[_pts.Length];
            for (int i = 1; i < _pts.Length; i++)
                _cum[i] = _cum[i - 1] + Vector2.Distance(_pts[i - 1], _pts[i]);
            _total = _cum[_pts.Length - 1];

            int beadCount = Mathf.Max(2, Mathf.CeilToInt(_bodyLen / _spacing) + 1);
            for (int i = 0; i < beadCount; i++)
            {
                var go = UIFactory.NewUIObject("Bead", transform);
                var img = go.AddComponent<Image>();
                img.sprite = UIFactory.DotSprite; // solid dot; overlapping dots form a black tube
                img.raycastTarget = false;

                var rt = img.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
                rt.sizeDelta = Vector2.one * beadSize; // uniform => the arrow body slides off whole
                _beads.Add(img);
            }

            StartCoroutine(Run());
        }

        private IEnumerator Run()
        {
            float startArc = _bodyLen;          // head sits at the leading end of the body
            float endArc = _total + _bodyLen;   // head past the far end => whole body has left
            float t = 0f;
            while (t < _duration)
            {
                t += Time.deltaTime;
                float k = Mathf.Clamp01(t / _duration);
                float headArc = Mathf.Lerp(startArc, endArc, k * k); // accelerate out
                float fade = k < 0.55f ? 1f : 1f - Mathf.SmoothStep(0f, 1f, (k - 0.55f) / 0.45f);

                for (int i = 0; i < _beads.Count; i++)
                {
                    float arc = headArc - i * _spacing;
                    var bead = _beads[i];
                    if (arc < 0f || arc > _total) { bead.enabled = false; continue; }

                    bead.enabled = true;
                    bead.rectTransform.anchoredPosition = SampleAt(arc);
                    var c = _color;          // solid black body, fading only as it leaves
                    c.a = fade;
                    bead.color = c;
                }
                yield return null;
            }
            Destroy(gameObject);
        }

        /// <summary>Position at a given arc length along the polyline.</summary>
        private Vector2 SampleAt(float arc)
        {
            for (int i = 1; i < _cum.Length; i++)
            {
                if (arc <= _cum[i])
                {
                    float segLen = _cum[i] - _cum[i - 1];
                    float f = segLen > 1e-4f ? (arc - _cum[i - 1]) / segLen : 0f;
                    return Vector2.Lerp(_pts[i - 1], _pts[i], f);
                }
            }
            return _pts[_pts.Length - 1];
        }
    }
}

using System;
using System.Collections;
using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Tiny, dependency-free tween helpers (easing curves + a few coroutine animations) used
    /// to add quick, tasteful "juice" to the otherwise calm Bright-Minimal UI: screen
    /// cross-fades, button press-feel, heart-loss pops, the win toast. Coroutines are started
    /// by the MonoBehaviour that owns the animated object (GameManager, ArrowTile, ButtonPress),
    /// so there is no global runner to manage. Times use unscaled delta so motion is robust
    /// regardless of Time.timeScale. Keep motion short (150–260 ms) and on-brand — see the
    /// "Motion" section of DESIGN.md.
    /// </summary>
    public static class UITween
    {
        // ---- Easing curves (t in 0..1) -------------------------------------
        public static float EaseOutCubic(float t) => 1f - Mathf.Pow(1f - t, 3f);
        public static float EaseInCubic(float t) => t * t * t;
        public static float EaseOutQuad(float t) => 1f - (1f - t) * (1f - t);
        public static float EaseInOutSine(float t) => -(Mathf.Cos(Mathf.PI * t) - 1f) * 0.5f;

        /// <summary>Overshoot-and-settle — a little bounce at the end, for pops/springs.</summary>
        public static float EaseOutBack(float t)
        {
            const float c1 = 1.70158f, c3 = 1.70158f + 1f;
            float u = t - 1f;
            return 1f + c3 * u * u * u + c1 * u * u;
        }

        // ---- Coroutine tweens ----------------------------------------------

        /// <summary>Fade a CanvasGroup to <paramref name="to"/> alpha over <paramref name="dur"/> seconds.</summary>
        public static IEnumerator Fade(CanvasGroup cg, float to, float dur, Func<float, float> ease = null)
        {
            if (cg == null) yield break;
            ease ??= EaseOutQuad;
            float from = cg.alpha;
            if (dur <= 0f) { cg.alpha = to; yield break; }
            float t = 0f;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                cg.alpha = Mathf.LerpUnclamped(from, to, ease(Mathf.Clamp01(t / dur)));
                yield return null;
            }
            cg.alpha = to;
        }

        /// <summary>Scale a transform from -> to with easing (used for entrances and button press-feel).</summary>
        public static IEnumerator Scale(Transform tr, Vector3 from, Vector3 to, float dur, Func<float, float> ease = null)
        {
            if (tr == null) yield break;
            ease ??= EaseOutBack;
            if (dur <= 0f) { tr.localScale = to; yield break; }
            tr.localScale = from;
            float t = 0f;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                tr.localScale = Vector3.LerpUnclamped(from, to, ease(Mathf.Clamp01(t / dur)));
                yield return null;
            }
            tr.localScale = to;
        }

        /// <summary>
        /// Quick "pop": swells the scale up to <paramref name="peak"/> and back to 1 (a smooth
        /// in-and-out), used as a success / attention accent. Assumes a base scale of 1.
        /// </summary>
        public static IEnumerator Pop(Transform tr, float peak = 1.18f, float dur = 0.26f)
        {
            if (tr == null) yield break;
            float t = 0f;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                float k = Mathf.Clamp01(t / dur);
                float s = 1f + (peak - 1f) * Mathf.Sin(k * Mathf.PI); // up at k=0.5, back to 1 at the ends
                tr.localScale = new Vector3(s, s, 1f);
                yield return null;
            }
            tr.localScale = Vector3.one;
        }
    }
}

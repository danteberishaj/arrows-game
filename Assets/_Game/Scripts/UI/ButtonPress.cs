using System;
using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Arrows
{
    /// <summary>
    /// Adds tactile press-feel to a UGUI Button: scales the target down a touch on press and
    /// springs it back on release, on top of the Button's own colour tint. Pure local scale,
    /// so it composes with layout and the existing button visuals. Attached automatically by
    /// the UIFactory button builders. If the same object also has an <see cref="IdlePulse"/>
    /// (the menu Play button), the press suspends it and the release resumes it, so the two
    /// scale animations never fight.
    /// </summary>
    public class ButtonPress : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        [SerializeField] private float pressedScale = 0.94f;

        private Coroutine _co;
        private IdlePulse _idle;
        private bool _idleResolved;

        // Resolved lazily because IdlePulse may be added after this component's Awake.
        private IdlePulse Idle
        {
            get { if (!_idleResolved) { _idle = GetComponent<IdlePulse>(); _idleResolved = true; } return _idle; }
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (Idle != null) Idle.Suspend();
            Run(new Vector3(pressedScale, pressedScale, 1f), 0.06f, UITween.EaseOutQuad, resumeIdle: false);
        }

        public void OnPointerUp(PointerEventData e) => Run(Vector3.one, 0.20f, UITween.EaseOutBack, resumeIdle: true);

        // Springs back if the finger slides off the button before release.
        public void OnPointerExit(PointerEventData e) => Run(Vector3.one, 0.16f, UITween.EaseOutBack, resumeIdle: true);

        private void Run(Vector3 to, float dur, Func<float, float> ease, bool resumeIdle)
        {
            if (!isActiveAndEnabled)
            {
                transform.localScale = to;
                if (resumeIdle && Idle != null) Idle.Resume();
                return;
            }
            if (_co != null) StopCoroutine(_co);
            _co = StartCoroutine(PressRoutine(to, dur, ease, resumeIdle));
        }

        private IEnumerator PressRoutine(Vector3 to, float dur, Func<float, float> ease, bool resumeIdle)
        {
            yield return UITween.Scale(transform, transform.localScale, to, dur, ease);
            if (resumeIdle && Idle != null) Idle.Resume();
        }

        private void OnDisable()
        {
            _co = null;
            transform.localScale = Vector3.one; // never leave a button stuck mid-press
        }
    }
}

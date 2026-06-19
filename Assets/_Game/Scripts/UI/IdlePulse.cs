using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Gentle "breathing" idle animation: scales its transform up and down by a few percent
    /// on a slow sine, as a soft "tap me" affordance for the menu Play button. Starts
    /// suspended so it never fights an entrance or press animation — the owner calls Resume()
    /// once those finish, and <see cref="ButtonPress"/> suspends/resumes it around a press.
    /// Subtle by design; the board stays still (see DESIGN.md "Motion").
    /// </summary>
    public class IdlePulse : MonoBehaviour
    {
        [SerializeField] private float amplitude = 0.03f; // ±3% scale
        [SerializeField] private float period = 1.8f;     // seconds per full breath

        private float _phase;
        private bool _running;

        // Re-show resets to a clean rest state; whoever shows the screen calls Resume().
        private void OnEnable() { _phase = 0f; _running = false; }

        public void Resume() { _phase = 0f; _running = true; }
        public void Suspend() { _running = false; }

        private void Update()
        {
            if (!_running) return;
            _phase += Time.unscaledDeltaTime;
            float s = 1f + amplitude * Mathf.Sin(_phase / period * (Mathf.PI * 2f));
            transform.localScale = new Vector3(s, s, 1f);
        }
    }
}

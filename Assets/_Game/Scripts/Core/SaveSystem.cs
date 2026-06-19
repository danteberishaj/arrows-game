using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Progress persistence backed by PlayerPrefs. We only need a single resume
    /// pointer: the index of the level the player should continue from. It survives
    /// app restarts, so closing the app never loses your place.
    /// </summary>
    public static class SaveSystem
    {
        private const string CurrentKey = "arrows_current_level";

        /// <summary>Level index to resume from (0-based).</summary>
        public static int CurrentLevel => Mathf.Max(0, PlayerPrefs.GetInt(CurrentKey, 0));

        public static void SetCurrentLevel(int index)
        {
            PlayerPrefs.SetInt(CurrentKey, Mathf.Max(0, index));
            PlayerPrefs.Save();
        }

        public static void ResetProgress()
        {
            PlayerPrefs.DeleteKey(CurrentKey);
            PlayerPrefs.Save();
        }
    }
}

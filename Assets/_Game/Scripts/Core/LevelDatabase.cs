using UnityEngine;

namespace Arrows
{
    /// <summary>Ordered list of all levels in the game.</summary>
    [CreateAssetMenu(fileName = "LevelDatabase", menuName = "Arrows/Level Database", order = 1)]
    public class LevelDatabase : ScriptableObject
    {
        public LevelData[] levels = new LevelData[0];

        public int Count => levels?.Length ?? 0;

        public LevelData Get(int index)
        {
            if (levels == null || index < 0 || index >= levels.Length) return null;
            return levels[index];
        }
    }
}

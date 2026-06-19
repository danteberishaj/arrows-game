namespace Arrows
{
    public enum Difficulty { Normal, Hard, SuperHard }

    /// <summary>Tunable knobs for one difficulty tier.</summary>
    public readonly struct DifficultyConfig
    {
        public readonly int MinCount, MaxCount;   // number of distinct arrow pieces
        public readonly int MinLen, MaxLen;       // arrow length range (cells)
        public readonly float BendChance;         // chance a body step turns
        public readonly int Hearts;
        public readonly float Fill;               // target fill used only to size the board

        public DifficultyConfig(int minCount, int maxCount, int minLen, int maxLen,
            float bendChance, int hearts, float fill)
        {
            MinCount = minCount; MaxCount = maxCount;
            MinLen = minLen; MaxLen = maxLen;
            BendChance = bendChance; Hearts = hearts; Fill = fill;
        }

        public float AvgLen => (MinLen + MaxLen) * 0.5f;
    }

    /// <summary>
    /// Endless difficulty schedule. Difficulty is a pure function of the level number:
    /// a repeating 6-level cycle of Normal, Normal, Hard, Normal, Normal, SuperHard.
    /// Engine-free so it can be unit-tested headlessly.
    /// </summary>
    public static class Difficulties
    {
        private static readonly Difficulty[] Cycle =
        {
            Difficulty.Normal, Difficulty.Normal, Difficulty.Hard,
            Difficulty.Normal, Difficulty.Normal, Difficulty.SuperHard,
        };

        public static int CycleLength => Cycle.Length;

        public static Difficulty ForLevel(int index)
        {
            int m = ((index % Cycle.Length) + Cycle.Length) % Cycle.Length; // safe for negatives
            return Cycle[m];
        }

        public static DifficultyConfig Config(Difficulty d) => d switch
        {
            // count(min,max), len(min,max), bend, hearts, fill(for sizing)
            Difficulty.Normal    => new DifficultyConfig(25, 50, 2, 5, 0.40f, 5, 0.62f),
            Difficulty.Hard      => new DifficultyConfig(60, 80, 2, 4, 0.45f, 7, 0.62f),
            Difficulty.SuperHard => new DifficultyConfig(90, 150, 1, 3, 0.50f, 9, 0.62f),
            _                    => new DifficultyConfig(25, 50, 2, 5, 0.40f, 5, 0.62f),
        };

        public static string DisplayName(Difficulty d) => d switch
        {
            Difficulty.Normal => "Normal",
            Difficulty.Hard => "Hard",
            Difficulty.SuperHard => "Super Hard",
            _ => "Normal"
        };
    }
}

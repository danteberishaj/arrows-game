using System.Collections.Generic;

namespace Arrows
{
    /// <summary>One generated puzzle plus its metadata.</summary>
    public class GeneratedLevel
    {
        public BoardLogic Board;
        public int Hearts;
        public Difficulty Difficulty;
        public int ArrowCount;
    }

    /// <summary>
    /// Runtime, infinite level generator. Difficulty and the random seed are pure
    /// functions of the level index, so the same index always reproduces the same board
    /// (Retry / resume are stable). Boards are guaranteed solvable by construction using
    /// the same reverse-placement trick as the editor generator: each new arrow's HEAD is
    /// placed only where its straight runway to the edge is currently clear, so it can
    /// only ever be blocked by a LATER-placed arrow and removing arrows in reverse
    /// placement order is always a valid solution.
    ///
    /// Engine-free (System.Math, no UnityEngine) so it can be unit-tested headlessly.
    /// </summary>
    public static class LevelGenerator
    {
        public static GeneratedLevel Generate(int levelIndex)
        {
            var difficulty = Difficulties.ForLevel(levelIndex);
            var cfg = Difficulties.Config(difficulty);
            var rng = new System.Random(Seed(levelIndex));

            int targetCount = cfg.MinCount + rng.Next(cfg.MaxCount - cfg.MinCount + 1);

            // Size a square board to fit the target count at the configured fill, then
            // grow it and retry if generation stalls below the minimum count.
            int side = (int)System.Math.Ceiling(System.Math.Sqrt(targetCount * cfg.AvgLen / cfg.Fill));
            side = Clamp(side, 6, 32);

            List<ArrowPath> arrows = null;
            for (int attempt = 0; attempt < 5; attempt++)
            {
                arrows = GenerateArrowPaths(side, side, targetCount, cfg.MinLen, cfg.MaxLen, cfg.BendChance, rng);
                if (arrows.Count >= cfg.MinCount) break;
                side = System.Math.Min(side + 2, 36);
            }

            var board = new BoardLogic(side, side);
            foreach (var a in arrows) board.Add(a);

            return new GeneratedLevel
            {
                Board = board,
                Hearts = cfg.Hearts,
                Difficulty = difficulty,
                ArrowCount = arrows.Count,
            };
        }

        // Deterministic, well-spread seed per level index (FNV-1a style mix).
        private static int Seed(int levelIndex)
        {
            unchecked { return (int)((2166136261u ^ (uint)levelIndex) * 16777619u); }
        }

        /// <summary>
        /// Places up to <paramref name="targetArrows"/> bent arrows on a rows x cols grid,
        /// stopping early if no further placement is possible. Returns the placed arrows
        /// (tail-&gt;head). See the class summary for the solvability invariant.
        /// </summary>
        public static List<ArrowPath> GenerateArrowPaths(int rows, int cols, int targetArrows,
            int minLen, int maxLen, float bendChance, System.Random rng)
        {
            var occ = new bool[rows, cols];
            var dirs = new[] { Direction.Up, Direction.Down, Direction.Left, Direction.Right };
            var result = new List<ArrowPath>();

            bool RayClear(int r, int c, Direction d)
            {
                var (dr, dc) = d.ToDelta();
                int rr = r + dr, cc = c + dc;
                while (rr >= 0 && rr < rows && cc >= 0 && cc < cols)
                {
                    if (occ[rr, cc]) return false;
                    rr += dr; cc += dc;
                }
                return true;
            }

            bool placedAny = true;
            while (placedAny && result.Count < targetArrows)
            {
                placedAny = false;

                var empties = new List<(int r, int c)>();
                for (int r = 0; r < rows; r++)
                    for (int c = 0; c < cols; c++)
                        if (!occ[r, c]) empties.Add((r, c));
                Shuffle(empties, rng);

                foreach (var (hr, hc) in empties)
                {
                    if (result.Count >= targetArrows) break;
                    if (occ[hr, hc]) continue;

                    // The head's facing direction must have a clear straight runway.
                    var headDirs = new List<Direction>();
                    foreach (var d in dirs)
                        if (RayClear(hr, hc, d)) headDirs.Add(d);
                    if (headDirs.Count == 0) continue;
                    var headDir = headDirs[rng.Next(headDirs.Count)];

                    // Place the head, then grow a bent body backward into empty cells.
                    occ[hr, hc] = true;
                    var headFirst = new List<(int r, int c)> { (hr, hc) };
                    int targetLen = rng.Next(minLen, maxLen + 1);
                    var cur = (r: hr, c: hc);
                    Direction? lastStep = null;

                    while (headFirst.Count < targetLen)
                    {
                        var opts = new List<Direction>();
                        foreach (var sd in dirs)
                        {
                            if (sd == headDir) continue; // never grow ahead of the head
                            var (dr, dc) = sd.ToDelta();
                            int nr = cur.r + dr, nc = cur.c + dc;
                            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                            if (occ[nr, nc]) continue;
                            opts.Add(sd);
                        }
                        if (opts.Count == 0) break;

                        Direction step =
                            (lastStep != null && opts.Contains(lastStep.Value) && rng.NextDouble() > bendChance)
                                ? lastStep.Value
                                : opts[rng.Next(opts.Count)];

                        var (sdr, sdc) = step.ToDelta();
                        cur = (cur.r + sdr, cur.c + sdc);
                        occ[cur.r, cur.c] = true;
                        headFirst.Add((cur.r, cur.c));
                        lastStep = step;
                    }

                    var tailToHead = new List<(int, int)>(headFirst);
                    tailToHead.Reverse();
                    result.Add(new ArrowPath(tailToHead, headDir));
                    placedAny = true;
                }
            }

            return result;
        }

        private static int Clamp(int v, int lo, int hi) => v < lo ? lo : (v > hi ? hi : v);

        private static void Shuffle<T>(List<T> list, System.Random rng)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }
    }
}

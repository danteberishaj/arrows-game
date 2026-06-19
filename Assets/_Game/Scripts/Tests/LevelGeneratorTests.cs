using System.Linq;
using NUnit.Framework;

namespace Arrows.Tests
{
    public class LevelGeneratorTests
    {
        [Test]
        public void DifficultyCycle_FollowsPattern()
        {
            // Normal, Normal, Hard, Normal, Normal, SuperHard, then repeat.
            Assert.AreEqual(Difficulty.Normal, Difficulties.ForLevel(0));
            Assert.AreEqual(Difficulty.Normal, Difficulties.ForLevel(1));
            Assert.AreEqual(Difficulty.Hard, Difficulties.ForLevel(2));
            Assert.AreEqual(Difficulty.Normal, Difficulties.ForLevel(3));
            Assert.AreEqual(Difficulty.Normal, Difficulties.ForLevel(4));
            Assert.AreEqual(Difficulty.SuperHard, Difficulties.ForLevel(5));
            Assert.AreEqual(Difficulty.Normal, Difficulties.ForLevel(6));   // cycle repeats
            Assert.AreEqual(Difficulty.SuperHard, Difficulties.ForLevel(11));
        }

        [Test]
        public void Generate_ProducesSolvableLevelsInCountRange()
        {
            // 12 levels covers two full difficulty cycles (all three tiers).
            for (int i = 0; i < 12; i++)
            {
                var lvl = LevelGenerator.Generate(i);
                var cfg = Difficulties.Config(lvl.Difficulty);

                Assert.AreEqual(lvl.ArrowCount, lvl.Board.Count(), $"level {i}: count mismatch");
                Assert.GreaterOrEqual(lvl.ArrowCount, cfg.MinCount, $"level {i} ({lvl.Difficulty}) below min");
                Assert.LessOrEqual(lvl.ArrowCount, cfg.MaxCount, $"level {i} ({lvl.Difficulty}) above max");
                Assert.IsTrue(SolveGreedy(lvl.Board), $"level {i} ({lvl.Difficulty}) not solvable");
            }
        }

        [Test]
        public void Generate_IsDeterministicByIndex()
        {
            var a = LevelGenerator.Generate(5);  // SuperHard — the busiest board
            var b = LevelGenerator.Generate(5);

            Assert.AreEqual(a.ArrowCount, b.ArrowCount);
            Assert.AreEqual(a.Board.Rows, b.Board.Rows);
            Assert.AreEqual(a.Board.Cols, b.Board.Cols);

            var ar = a.Board.Arrows();
            var br = b.Board.Arrows();
            Assert.AreEqual(ar.Count, br.Count);
            for (int i = 0; i < ar.Count; i++)
            {
                Assert.AreEqual(ar[i].Head, br[i].Head, $"arrow {i} head differs");
                Assert.AreEqual(ar[i].HeadDir, br[i].HeadDir, $"arrow {i} dir differs");
                Assert.AreEqual(ar[i].Length, br[i].Length, $"arrow {i} length differs");
            }
        }

        private static bool SolveGreedy(BoardLogic board)
        {
            bool progress = true;
            while (progress && !board.IsCleared())
            {
                progress = false;
                foreach (var a in board.Arrows().ToList())
                    if (board.TryRemove(a)) { progress = true; break; }
            }
            return board.IsCleared();
        }
    }
}

using System.Linq;
using NUnit.Framework;

namespace Arrows.Tests
{
    public class BoardLogicTests
    {
        // ---- ArrowPath parsing ---------------------------------------------

        [Test]
        public void ArrowPath_ParsesHeadAndBentBody()
        {
            Assert.IsTrue(ArrowPath.TryParse("2,5,U:DDR", out var a));
            Assert.AreEqual(Direction.Up, a.HeadDir);
            Assert.AreEqual((2, 5), a.Head);
            Assert.AreEqual(4, a.Length);          // head + 3 body cells
            Assert.IsTrue(a.Contains((3, 5)));     // body: Down
            Assert.IsTrue(a.Contains((4, 5)));     // body: Down
            Assert.IsTrue(a.Contains((4, 6)));     // body: Right (tail)
            Assert.AreEqual((4, 6), a.Tail);
            Assert.AreEqual(2, a.MinRow);
            Assert.AreEqual(4, a.MaxRow);
            Assert.AreEqual(5, a.MinCol);
            Assert.AreEqual(6, a.MaxCol);
            Assert.AreEqual(3, a.RowSpan);
            Assert.AreEqual(2, a.ColSpan);
        }

        [Test]
        public void ArrowPath_RoundTripsThroughLine()
        {
            Assert.IsTrue(ArrowPath.TryParse("2,5,U:DDR", out var bent));
            Assert.AreEqual("2,5,U:DDR", bent.ToLine());

            Assert.IsTrue(ArrowPath.TryParse("0,0,R", out var single)); // no body
            Assert.AreEqual(1, single.Length);
            Assert.AreEqual("0,0,R:", single.ToLine());
        }

        [Test]
        public void ArrowPath_RejectsMalformedLines()
        {
            Assert.IsFalse(ArrowPath.TryParse("", out _));
            Assert.IsFalse(ArrowPath.TryParse("   ", out _));
            Assert.IsFalse(ArrowPath.TryParse("1,2", out _));      // missing direction
            Assert.IsFalse(ArrowPath.TryParse("1,2,X", out _));    // bad direction
            Assert.IsFalse(ArrowPath.TryParse("1,2,U:Q", out _));  // bad step
        }

        // ---- BoardLogic ----------------------------------------------------

        [Test]
        public void Parse_PlacesArrowsAndMarksCells()
        {
            var board = BoardLogic.Parse(3, 3, new[] { "0,0,R", "2,2,U:L" });

            Assert.AreEqual(3, board.Rows);
            Assert.AreEqual(3, board.Cols);
            Assert.AreEqual(2, board.Count());
            Assert.IsFalse(board.IsEmpty(0, 0));
            Assert.IsFalse(board.IsEmpty(2, 2));
            Assert.IsFalse(board.IsEmpty(2, 1)); // body of the second arrow
            Assert.IsTrue(board.IsEmpty(1, 1));
        }

        [Test]
        public void CanExit_TrueWhenRunwayClear()
        {
            var right = BoardLogic.Parse(1, 3, new[] { "0,2,R" }); // already at the right edge
            Assert.IsTrue(right.CanExit(right.Arrows()[0]));

            var up = BoardLogic.Parse(3, 1, new[] { "0,0,U" });    // already at the top edge
            Assert.IsTrue(up.CanExit(up.Arrows()[0]));
        }

        [Test]
        public void CanExit_FalseWhenBlockedByAnotherArrow()
        {
            // Two arrows in a lane both pointing right: the left one is blocked by the right.
            var board = BoardLogic.Parse(1, 3, new[] { "0,1,R", "0,2,R" });
            Assert.IsFalse(board.CanExit(FindHead(board, (0, 1))), "left arrow blocked");
            Assert.IsTrue(board.CanExit(FindHead(board, (0, 2))), "right arrow clear");
        }

        [Test]
        public void CanExit_IgnoresOwnBody()
        {
            // Head faces Up with its own body directly above it: an arrow never blocks itself.
            var board = BoardLogic.Parse(2, 1, new[] { "1,0,U:U" });
            Assert.IsTrue(board.CanExit(board.Arrows()[0]));
        }

        [Test]
        public void TryRemove_FreesPathForBlockedArrow()
        {
            var board = BoardLogic.Parse(1, 3, new[] { "0,1,R", "0,2,R" });
            var left = FindHead(board, (0, 1));
            var right = FindHead(board, (0, 2));

            Assert.IsFalse(board.TryRemove(left), "blocked, cannot remove yet");
            Assert.IsTrue(board.TryRemove(right), "rightmost removable");
            Assert.IsTrue(board.CanExit(left), "path now clear");
            Assert.IsTrue(board.TryRemove(left));
            Assert.IsTrue(board.IsCleared());
        }

        [Test]
        public void GreedyRemoval_SolvesSolvableBoard()
        {
            // A bent arrow blocked by a single-cell arrow that can only leave first.
            var board = BoardLogic.Parse(3, 3, new[]
            {
                "0,0,R:DD",  // head (0,0) faces Right; body runs down column 0
                "0,2,U",     // single cell at (0,2), already at the top edge
            });

            Assert.IsTrue(SolveGreedy(board));
            Assert.IsTrue(board.IsCleared());
        }

        [Test]
        public void GreedyRemoval_DetectsDeadlock()
        {
            // Two arrows pointing into each other along a row: neither can exit.
            var board = BoardLogic.Parse(1, 2, new[] { "0,0,R", "0,1,L" });
            Assert.IsFalse(SolveGreedy(board));
            Assert.AreEqual(2, board.Count());
        }

        // ---- helpers -------------------------------------------------------

        private static ArrowPath FindHead(BoardLogic board, (int r, int c) head)
        {
            foreach (var a in board.Arrows())
                if (a.Head == head) return a;
            Assert.Fail($"no arrow with head {head}");
            return null;
        }

        /// <summary>
        /// Repeatedly removes any currently-exitable arrow until none remain or the board
        /// is stuck. Mirrors the validator used at level-build time.
        /// </summary>
        private static bool SolveGreedy(BoardLogic board)
        {
            bool progress = true;
            while (progress && !board.IsCleared())
            {
                progress = false;
                foreach (var arrow in board.Arrows().ToList())
                {
                    if (board.TryRemove(arrow))
                    {
                        progress = true;
                        break;
                    }
                }
            }
            return board.IsCleared();
        }
    }
}

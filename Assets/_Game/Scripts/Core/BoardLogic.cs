using System.Collections.Generic;

namespace Arrows
{
    /// <summary>
    /// Pure (engine-free) puzzle logic for the Arrows game. Holds a set of multi-cell
    /// <see cref="ArrowPath"/> arrows and implements the core rule: an arrow can slither
    /// off the board head-first only if the straight lane ahead of its head, to the edge,
    /// is clear of OTHER arrows. An arrow's own body never blocks itself.
    ///
    /// This class is deliberately free of any UnityEngine dependency so it can be
    /// unit-tested headlessly (see BoardLogicTests).
    /// </summary>
    public class BoardLogic
    {
        public int Rows { get; }
        public int Cols { get; }

        private readonly List<ArrowPath> _arrows = new();
        // _owner[r,c] is the arrow occupying that cell, or null if empty. Storing the
        // reference (not an index) keeps removal O(cells) with no re-indexing.
        private readonly ArrowPath[,] _owner;

        public BoardLogic(int rows, int cols)
        {
            Rows = rows;
            Cols = cols;
            _owner = new ArrowPath[rows < 0 ? 0 : rows, cols < 0 ? 0 : cols];
        }

        public bool InBounds(int r, int c) => r >= 0 && r < Rows && c >= 0 && c < Cols;

        public ArrowPath OwnerAt(int r, int c) => InBounds(r, c) ? _owner[r, c] : null;

        public bool IsEmpty(int r, int c) => OwnerAt(r, c) == null;

        /// <summary>Places an arrow, marking each of its in-bounds cells as owned.</summary>
        public void Add(ArrowPath arrow)
        {
            if (arrow == null) return;
            _arrows.Add(arrow);
            foreach (var (r, c) in arrow.Cells)
                if (InBounds(r, c)) _owner[r, c] = arrow;
        }

        public int Count() => _arrows.Count;

        public bool IsCleared() => _arrows.Count == 0;

        /// <summary>All arrows currently on the board (live list; copy before mutating).</summary>
        public IReadOnlyList<ArrowPath> Arrows() => _arrows;

        /// <summary>
        /// True if <paramref name="arrow"/> can slither out: the straight ray from its
        /// head, in its facing direction, to the board edge contains no cell owned by a
        /// DIFFERENT arrow. Returns false if the arrow is not on this board.
        /// </summary>
        public bool CanExit(ArrowPath arrow)
        {
            if (arrow == null || !_arrows.Contains(arrow)) return false;

            var (hr, hc) = arrow.Head;
            var (dr, dc) = arrow.HeadDir.ToDelta();
            int rr = hr + dr, cc = hc + dc;
            while (InBounds(rr, cc))
            {
                var owner = _owner[rr, cc];
                if (owner != null && owner != arrow) return false; // blocked by another arrow
                rr += dr; cc += dc;
            }
            return true;
        }

        /// <summary>
        /// Returns an arrow that can currently slither out (a safe next move to suggest as a
        /// hint), or null if the board is empty. ANY clearable arrow is a valid hint:
        /// removing an arrow only ever frees cells, so it can never block another arrow —
        /// taking any currently-removable arrow preserves the board's solvability.
        /// </summary>
        public ArrowPath FindHint()
        {
            foreach (var arrow in _arrows)
                if (CanExit(arrow)) return arrow;
            return null;
        }

        /// <summary>
        /// Removes the arrow off the board if it can exit. Returns true and clears its
        /// cells on success; false (no state change) if blocked or not present.
        /// </summary>
        public bool TryRemove(ArrowPath arrow)
        {
            if (!CanExit(arrow)) return false;
            foreach (var (r, c) in arrow.Cells)
                if (InBounds(r, c) && _owner[r, c] == arrow) _owner[r, c] = null;
            _arrows.Remove(arrow);
            return true;
        }

        /// <summary>
        /// Builds a board of the given size from serialized arrow lines (one arrow per
        /// line, see <see cref="ArrowPath.TryParse"/>). Blank / malformed lines are skipped.
        /// </summary>
        public static BoardLogic Parse(int rows, int cols, IReadOnlyList<string> lines)
        {
            var board = new BoardLogic(rows, cols);
            if (lines != null)
                foreach (var line in lines)
                    if (ArrowPath.TryParse(line, out var arrow))
                        board.Add(arrow);
            return board;
        }
    }
}

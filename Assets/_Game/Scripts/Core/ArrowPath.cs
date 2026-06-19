using System.Collections.Generic;
using System.Text;

namespace Arrows
{
    /// <summary>
    /// One arrow as a connected path of grid cells, ordered tail -> head (the head is
    /// the LAST cell). The path may bend at 90 degrees but never moves diagonally; a
    /// length-1 arrow is a single cell with an explicit head direction. Cells across
    /// different arrows are mutually exclusive (enforced by the generator / BoardLogic).
    ///
    /// Engine-free (uses (int,int) tuples, no UnityEngine) so it can be unit-tested
    /// headlessly alongside BoardLogic.
    ///
    /// Serialized form is one line: "headRow,headCol,Dir:tailSteps" where Dir is the
    /// head's facing letter (U/D/L/R) and tailSteps walks from the head BACKWARD along
    /// the body, e.g. "2,5,U:DDR" = head at (2,5) facing Up, body goes Down, Down, Right.
    /// "2,5,U:" (or "2,5,U") is a single-cell arrow.
    /// </summary>
    public class ArrowPath
    {
        /// <summary>Cells from tail to head; the head is <c>Cells[Cells.Count - 1]</c>.</summary>
        public IReadOnlyList<(int r, int c)> Cells { get; }
        public Direction HeadDir { get; }

        public (int r, int c) Head => Cells[Cells.Count - 1];
        public (int r, int c) Tail => Cells[0];
        public int Length => Cells.Count;

        public int MinRow { get; }
        public int MaxRow { get; }
        public int MinCol { get; }
        public int MaxCol { get; }
        public int RowSpan => MaxRow - MinRow + 1;
        public int ColSpan => MaxCol - MinCol + 1;

        /// <param name="cellsTailToHead">Ordered cells, head last. Must be non-empty.</param>
        public ArrowPath(IReadOnlyList<(int r, int c)> cellsTailToHead, Direction headDir)
        {
            Cells = cellsTailToHead;
            HeadDir = headDir;

            int minR = int.MaxValue, maxR = int.MinValue, minC = int.MaxValue, maxC = int.MinValue;
            foreach (var (r, c) in cellsTailToHead)
            {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
            MinRow = minR; MaxRow = maxR; MinCol = minC; MaxCol = maxC;
        }

        public bool Contains((int r, int c) cell)
        {
            foreach (var x in Cells)
                if (x.r == cell.r && x.c == cell.c) return true;
            return false;
        }

        /// <summary>
        /// Parses one serialized arrow line. Returns false (and null) for blank lines or
        /// malformed input rather than throwing, so a level file can tolerate stray rows.
        /// </summary>
        public static bool TryParse(string line, out ArrowPath arrow)
        {
            arrow = null;
            if (string.IsNullOrWhiteSpace(line)) return false;

            string trimmed = line.Trim();
            string head = trimmed;
            string steps = string.Empty;
            int colon = trimmed.IndexOf(':');
            if (colon >= 0)
            {
                head = trimmed.Substring(0, colon);
                steps = trimmed.Substring(colon + 1).Trim();
            }

            var parts = head.Split(',');
            if (parts.Length != 3) return false;
            if (!int.TryParse(parts[0].Trim(), out int hr)) return false;
            if (!int.TryParse(parts[1].Trim(), out int hc)) return false;
            string dirStr = parts[2].Trim();
            if (dirStr.Length == 0) return false;
            var headDir = DirectionExtensions.FromChar(dirStr[0]);
            if (headDir == null) return false;

            // Walk backward from the head to build cells head-first, then reverse so the
            // head is last. Each step letter is a move AWAY from the head along the body.
            var headFirst = new List<(int r, int c)> { (hr, hc) };
            foreach (char ch in steps)
            {
                if (char.IsWhiteSpace(ch)) continue;
                var step = DirectionExtensions.FromChar(ch);
                if (step == null) return false;
                var (dr, dc) = step.Value.ToDelta();
                var (lr, lc) = headFirst[headFirst.Count - 1];
                headFirst.Add((lr + dr, lc + dc));
            }

            headFirst.Reverse(); // now tail -> head, head last
            arrow = new ArrowPath(headFirst, headDir.Value);
            return true;
        }

        /// <summary>Serializes to the "headR,headC,Dir:tailSteps" line form.</summary>
        public string ToLine()
        {
            var (hr, hc) = Head;
            var sb = new StringBuilder();
            sb.Append(hr).Append(',').Append(hc).Append(',').Append(HeadDir.ToChar()).Append(':');
            // Steps walk from head backward toward the tail: iterate cells from head to tail.
            for (int i = Cells.Count - 1; i > 0; i--)
            {
                var (cr, cc) = Cells[i];
                var (pr, pc) = Cells[i - 1];
                sb.Append(StepChar(cr, cc, pr, pc));
            }
            return sb.ToString();
        }

        private static char StepChar(int fromR, int fromC, int toR, int toC)
        {
            int dr = toR - fromR, dc = toC - fromC;
            if (dr == -1 && dc == 0) return Direction.Up.ToChar();
            if (dr == 1 && dc == 0) return Direction.Down.ToChar();
            if (dr == 0 && dc == -1) return Direction.Left.ToChar();
            if (dr == 0 && dc == 1) return Direction.Right.ToChar();
            return '?';
        }
    }
}

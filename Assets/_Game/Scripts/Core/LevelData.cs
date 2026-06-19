using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// A single hand-authored or generated puzzle. The board size is explicit and each
    /// arrow is one line in the format parsed by <see cref="ArrowPath.TryParse"/>, which
    /// keeps multi-cell bent arrows readable and editable directly in the Inspector.
    /// </summary>
    [CreateAssetMenu(fileName = "Level", menuName = "Arrows/Level", order = 0)]
    public class LevelData : ScriptableObject
    {
        [Tooltip("Number of mistakes (hearts) allowed before the level fails.")]
        [Min(1)] public int hearts = 3;

        [Tooltip("Board height in cells (number of rows).")]
        [Min(1)] public int rows = 1;

        [Tooltip("Board width in cells (number of columns).")]
        [Min(1)] public int cols = 1;

        [Tooltip("One arrow per line: 'headRow,headCol,Dir:tailSteps' where Dir and steps " +
                 "are U/D/L/R. e.g. '2,5,U:DDR' = head at (2,5) facing Up, body running " +
                 "Down, Down, Right. '2,5,U' is a single-cell arrow.")]
        [TextArea(3, 16)]
        public string[] arrows = new string[0];

        public int Rows => rows;
        public int Cols => cols;

        public BoardLogic CreateBoard() => BoardLogic.Parse(rows, cols, arrows);
    }
}

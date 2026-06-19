namespace Arrows
{
    /// <summary>The four directions an arrow can point / travel.</summary>
    public enum Direction
    {
        Up,
        Down,
        Left,
        Right
    }

    public static class DirectionExtensions
    {
        /// <summary>
        /// Grid step for this direction as (deltaRow, deltaColumn).
        /// Convention: row 0 is the TOP of the board, so Up decreases the row.
        /// </summary>
        public static (int dr, int dc) ToDelta(this Direction d) => d switch
        {
            Direction.Up => (-1, 0),
            Direction.Down => (1, 0),
            Direction.Left => (0, -1),
            Direction.Right => (0, 1),
            _ => (0, 0)
        };

        /// <summary>
        /// Z rotation (degrees) to point a base "up" arrow sprite in this direction.
        /// Unity Z rotation is counter-clockwise-positive.
        /// </summary>
        public static float ZRotation(this Direction d) => d switch
        {
            Direction.Up => 0f,
            Direction.Down => 180f,
            Direction.Left => 90f,
            Direction.Right => -90f,
            _ => 0f
        };

        public static Direction? FromChar(char c) => char.ToUpperInvariant(c) switch
        {
            'U' => Direction.Up,
            'D' => Direction.Down,
            'L' => Direction.Left,
            'R' => Direction.Right,
            _ => (Direction?)null
        };

        /// <summary>Single-letter code (U/D/L/R), the inverse of <see cref="FromChar"/>.</summary>
        public static char ToChar(this Direction d) => d switch
        {
            Direction.Up => 'U',
            Direction.Down => 'D',
            Direction.Left => 'L',
            Direction.Right => 'R',
            _ => '?'
        };

        public static Direction Opposite(this Direction d) => d switch
        {
            Direction.Up => Direction.Down,
            Direction.Down => Direction.Up,
            Direction.Left => Direction.Right,
            Direction.Right => Direction.Left,
            _ => d
        };
    }
}

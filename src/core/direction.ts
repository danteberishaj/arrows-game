/**
 * The four directions an arrow can point / travel.
 * Ported from Assets/_Game/Scripts/Core/Direction.cs.
 */
export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

/**
 * Grid step for this direction as [deltaRow, deltaColumn].
 * Convention: row 0 is the TOP of the board, so Up decreases the row.
 */
export function toDelta(d: Direction): [number, number] {
  switch (d) {
    case Direction.Up: return [-1, 0];
    case Direction.Down: return [1, 0];
    case Direction.Left: return [0, -1];
    case Direction.Right: return [0, 1];
    default: return [0, 0];
  }
}

/**
 * Rotation (degrees, counter-clockwise-positive) to point a base "up" arrow
 * sprite in this direction.
 */
export function zRotation(d: Direction): number {
  switch (d) {
    case Direction.Up: return 0;
    case Direction.Down: return 180;
    case Direction.Left: return 90;
    case Direction.Right: return -90;
    default: return 0;
  }
}

export function fromChar(c: string): Direction | null {
  switch (c.toUpperCase()) {
    case 'U': return Direction.Up;
    case 'D': return Direction.Down;
    case 'L': return Direction.Left;
    case 'R': return Direction.Right;
    default: return null;
  }
}

/** Single-letter code (U/D/L/R), the inverse of {@link fromChar}. */
export function toChar(d: Direction): string {
  switch (d) {
    case Direction.Up: return 'U';
    case Direction.Down: return 'D';
    case Direction.Left: return 'L';
    case Direction.Right: return 'R';
    default: return '?';
  }
}

export function opposite(d: Direction): Direction {
  switch (d) {
    case Direction.Up: return Direction.Down;
    case Direction.Down: return Direction.Up;
    case Direction.Left: return Direction.Right;
    case Direction.Right: return Direction.Left;
    default: return d;
  }
}

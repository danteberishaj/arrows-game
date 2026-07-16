import { Direction, fromChar, toChar, toDelta } from './direction';

/** One grid cell as (row, col). Row 0 is the TOP of the board. */
export interface Cell {
  readonly r: number;
  readonly c: number;
}

const INT_RE = /^-?\d+$/;

/**
 * One arrow as a connected path of grid cells, ordered tail -> head (the head
 * is the LAST cell). The path may bend at 90 degrees but never moves
 * diagonally; a length-1 arrow is a single cell with an explicit head
 * direction. Cells across different arrows are mutually exclusive (enforced
 * by the generator / BoardLogic).
 *
 * Serialized form is one line: "headRow,headCol,Dir:tailSteps" where Dir is
 * the head's facing letter (U/D/L/R) and tailSteps walks from the head
 * BACKWARD along the body, e.g. "2,5,U:DDR" = head at (2,5) facing Up, body
 * goes Down, Down, Right. "2,5,U:" (or "2,5,U") is a single-cell arrow.
 *
 * Ported from Assets/_Game/Scripts/Core/ArrowPath.cs.
 */
export class ArrowPath {
  /** Cells from tail to head; the head is `cells[cells.length - 1]`. */
  readonly cells: readonly Cell[];
  readonly headDir: Direction;

  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;

  /** @param cellsTailToHead Ordered cells, head last. Must be non-empty. */
  constructor(cellsTailToHead: readonly Cell[], headDir: Direction) {
    this.cells = cellsTailToHead;
    this.headDir = headDir;

    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const { r, c } of cellsTailToHead) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    this.minRow = minR; this.maxRow = maxR; this.minCol = minC; this.maxCol = maxC;
  }

  get head(): Cell { return this.cells[this.cells.length - 1]; }
  get tail(): Cell { return this.cells[0]; }
  get length(): number { return this.cells.length; }
  get rowSpan(): number { return this.maxRow - this.minRow + 1; }
  get colSpan(): number { return this.maxCol - this.minCol + 1; }

  contains(cell: Cell): boolean {
    for (const x of this.cells) {
      if (x.r === cell.r && x.c === cell.c) return true;
    }
    return false;
  }

  /**
   * Parses one serialized arrow line. Returns null for blank lines or
   * malformed input rather than throwing, so a level file can tolerate stray
   * rows.
   */
  static tryParse(line: string): ArrowPath | null {
    if (!line || line.trim().length === 0) return null;

    const trimmed = line.trim();
    let head = trimmed;
    let steps = '';
    const colon = trimmed.indexOf(':');
    if (colon >= 0) {
      head = trimmed.substring(0, colon);
      steps = trimmed.substring(colon + 1).trim();
    }

    const parts = head.split(',');
    if (parts.length !== 3) return null;
    const rStr = parts[0].trim();
    const cStr = parts[1].trim();
    if (!INT_RE.test(rStr) || !INT_RE.test(cStr)) return null;
    const hr = parseInt(rStr, 10);
    const hc = parseInt(cStr, 10);
    const dirStr = parts[2].trim();
    if (dirStr.length === 0) return null;
    const headDir = fromChar(dirStr[0]);
    if (headDir === null) return null;

    // Walk backward from the head to build cells head-first, then reverse so
    // the head is last. Each step letter is a move AWAY from the head along
    // the body.
    const headFirst: Cell[] = [{ r: hr, c: hc }];
    for (const ch of steps) {
      if (/\s/.test(ch)) continue;
      const step = fromChar(ch);
      if (step === null) return null;
      const [dr, dc] = toDelta(step);
      const last = headFirst[headFirst.length - 1];
      headFirst.push({ r: last.r + dr, c: last.c + dc });
    }

    headFirst.reverse(); // now tail -> head, head last
    return new ArrowPath(headFirst, headDir);
  }

  /** Serializes to the "headR,headC,Dir:tailSteps" line form. */
  toLine(): string {
    const { r: hr, c: hc } = this.head;
    let out = `${hr},${hc},${toChar(this.headDir)}:`;
    // Steps walk from head backward toward the tail: iterate cells from head to tail.
    for (let i = this.cells.length - 1; i > 0; i--) {
      const cur = this.cells[i];
      const prev = this.cells[i - 1];
      out += stepChar(cur.r, cur.c, prev.r, prev.c);
    }
    return out;
  }
}

function stepChar(fromR: number, fromC: number, toR: number, toC: number): string {
  const dr = toR - fromR, dc = toC - fromC;
  if (dr === -1 && dc === 0) return toChar(Direction.Up);
  if (dr === 1 && dc === 0) return toChar(Direction.Down);
  if (dr === 0 && dc === -1) return toChar(Direction.Left);
  if (dr === 0 && dc === 1) return toChar(Direction.Right);
  return '?';
}

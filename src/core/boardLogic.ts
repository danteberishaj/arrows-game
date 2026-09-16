import { ArrowPath, Cell } from './arrowPath';
import { toDelta } from './direction';

/**
 * Pure (engine-free) puzzle logic for the Arrows game. Holds a set of
 * multi-cell {@link ArrowPath} arrows and implements the core rule: an arrow
 * can slither off the board head-first only if the straight lane ahead of its
 * head, to the edge, is clear of OTHER arrows. An arrow's own body never
 * blocks itself.
 *
 * Ported from Assets/_Game/Scripts/Core/BoardLogic.cs.
 */
export class BoardLogic {
  readonly rows: number;
  readonly cols: number;

  private readonly _arrows: ArrowPath[] = [];
  // _owner[r][c] is the arrow occupying that cell, or null if empty. Storing
  // the reference (not an index) keeps removal O(cells) with no re-indexing.
  private readonly _owner: (ArrowPath | null)[][];

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    const rr = rows < 0 ? 0 : rows;
    const cc = cols < 0 ? 0 : cols;
    this._owner = Array.from({ length: rr }, () => new Array<ArrowPath | null>(cc).fill(null));
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  ownerAt(r: number, c: number): ArrowPath | null {
    return this.inBounds(r, c) ? this._owner[r][c] : null;
  }

  isEmpty(r: number, c: number): boolean {
    return this.ownerAt(r, c) === null;
  }

  /** Places an arrow, marking each of its in-bounds cells as owned. */
  add(arrow: ArrowPath | null): void {
    if (arrow === null) return;
    this._arrows.push(arrow);
    for (const { r, c } of arrow.cells) {
      if (this.inBounds(r, c)) this._owner[r][c] = arrow;
    }
  }

  count(): number {
    return this._arrows.length;
  }

  isCleared(): boolean {
    return this._arrows.length === 0;
  }

  /** All arrows currently on the board (live list; copy before mutating). */
  arrows(): readonly ArrowPath[] {
    return this._arrows;
  }

  /**
   * True if `arrow` can slither out: the straight ray from its head, in its
   * facing direction, to the board edge contains no cell owned by a DIFFERENT
   * arrow. Returns false if the arrow is not on this board.
   */
  canExit(arrow: ArrowPath | null): boolean {
    if (arrow === null || !this._arrows.includes(arrow)) return false;
    return this.blockerOf(arrow) === null;
  }

  /**
   * The first OTHER arrow in the straight lane from `arrow`'s head to the
   * board edge: the piece the player must clear before this one can leave.
   * Null when the lane is clear, or when `arrow` is null. Does not check that
   * `arrow` is on this board (see {@link canExit} for that).
   */
  blockerOf(arrow: ArrowPath | null): ArrowPath | null {
    if (arrow === null) return null;

    const { r: hr, c: hc } = arrow.head;
    const [dr, dc] = toDelta(arrow.headDir);
    let rr = hr + dr, cc = hc + dc;
    while (this.inBounds(rr, cc)) {
      const owner = this._owner[rr][cc];
      if (owner !== null && owner !== arrow) return owner; // blocked by another arrow
      rr += dr; cc += dc;
    }
    return null;
  }

  /**
   * Returns an arrow that can currently slither out (a safe next move to
   * suggest as a hint), or null if the board is empty. ANY clearable arrow is
   * a valid hint: removing an arrow only ever frees cells, so it can never
   * block another arrow — taking any currently-removable arrow preserves the
   * board's solvability.
   */
  findHint(): ArrowPath | null {
    for (const arrow of this._arrows) {
      if (this.canExit(arrow)) return arrow;
    }
    return null;
  }

  /**
   * Removes the arrow off the board if it can exit. Returns true and clears
   * its cells on success; false (no state change) if blocked or not present.
   */
  tryRemove(arrow: ArrowPath): boolean {
    if (!this.canExit(arrow)) return false;
    for (const { r, c } of arrow.cells) {
      if (this.inBounds(r, c) && this._owner[r][c] === arrow) this._owner[r][c] = null;
    }
    this._arrows.splice(this._arrows.indexOf(arrow), 1);
    return true;
  }

  /**
   * Builds a board of the given size from serialized arrow lines (one arrow
   * per line, see {@link ArrowPath.tryParse}). Blank / malformed lines are
   * skipped.
   */
  static parse(rows: number, cols: number, lines: readonly string[] | null): BoardLogic {
    const board = new BoardLogic(rows, cols);
    if (lines) {
      for (const line of lines) {
        const arrow = ArrowPath.tryParse(line);
        if (arrow) board.add(arrow);
      }
    }
    return board;
  }
}

export type { Cell };

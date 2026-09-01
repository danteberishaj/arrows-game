import { ArrowPath, Cell } from './arrowPath';
import { BoardLogic } from './boardLogic';
import { Difficulties, Difficulty, DifficultyConfig } from './difficulty';
import { Direction, opposite, toDelta } from './direction';
import { DotNetRandom } from './dotnetRandom';
import { ShapeLibrary } from './shapeLibrary';

/** One generated puzzle plus its metadata. */
export interface GeneratedLevel {
  board: BoardLogic;
  hearts: number;
  difficulty: Difficulty;
  arrowCount: number;
  shapeName: string;
  /** The silhouette that was packed (true = a cell that should hold an arrow). */
  mask: boolean[][];
}

const DIRS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right] as const;

/**
 * Runtime, infinite level generator. Difficulty, the chosen shape and the
 * random seed are pure functions of the level index, so the same index always
 * reproduces the same board (Retry / resume are stable).
 *
 * Each level is a recognizable SHAPE (square / circle / heart / star / trophy
 * / ...) drawn by packing every cell of the shape's silhouette with arrows.
 * Filling + solving both come from one rule, applied as a "peel":
 *
 *   only carve an arrow whose head has a clear straight lane to the board
 *   edge through the cells that are STILL unfilled.
 *
 * Because the top-most still-unfilled row always has a cell that can point up
 * with nothing unfilled above it, a valid arrow always exists until the shape
 * is full — so the fill completes. And carving in that order is itself a
 * valid solution: when an arrow is removed, everything carved after it is
 * still on the board, and its lane was chosen clear of exactly those cells,
 * so it can always exit. The board is therefore 100% filled AND guaranteed
 * solvable by construction.
 *
 * Ported from Assets/_Game/Scripts/Core/LevelGenerator.cs.
 */
export const LevelGenerator = {
  generate(levelIndex: number): GeneratedLevel {
    const difficulty = Difficulties.forLevel(levelIndex);
    const cfg = Difficulties.config(difficulty);
    const rng = new DotNetRandom(seed(levelIndex));

    const shape = ShapeLibrary.pick(difficulty, rng);

    // Size the board so the SHAPE holds ~targetCells cells: probe the
    // silhouette's fill density at a reference size, then solve for the rows
    // that hit the target. A thin bolt gets a big grid, a solid square a
    // small one — every level lands in its tier's piece-count band.
    const targetCells = rng.next(cfg.minCells, cfg.maxCells + 1);
    const probeRows = 24;
    const probeCols = clamp(roundHalfToEven(probeRows * shape.aspect), 4, 46);
    const probeFill = Math.max(
      0.05,
      countTrue(shape.rasterize(probeRows, probeCols)) / (probeRows * probeCols),
    );
    let rows = Math.round(Math.sqrt(targetCells / (probeFill * shape.aspect)));
    // Upper clamp keeps even the thinnest silhouettes' grids sane; the board
    // is fit-to-view + pinch-zoomable, so large grids are fine.
    rows = clamp(rows, 8, 46);
    let cols = clamp(roundHalfToEven(rows * shape.aspect), 4, 46);

    const mask = shape.rasterize(rows, cols);
    if (countTrue(mask) === 0) {
      // safety: degenerate raster -> fall back to a full grid
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mask[r][c] = true;
    }

    const arrows = LevelGenerator.fillMask(mask, rows, cols, cfg, rng);

    const board = new BoardLogic(rows, cols);
    for (const a of arrows) board.add(a);

    return {
      board,
      hearts: cfg.hearts,
      difficulty,
      arrowCount: arrows.length,
      shapeName: shape.name,
      mask,
    };
  },

  /**
   * Packs every true cell of `mask` with arrows (tail->head), so the shape's
   * silhouette is fully filled. See the doc above for the peel rule that makes
   * this both complete and solvable. Arrows are kept mostly straight (with a
   * straight neck behind each head and at most one short bend) so they read
   * cleanly.
   */
  fillMask(
    mask: readonly (readonly boolean[])[],
    rows: number,
    cols: number,
    cfg: DifficultyConfig,
    rng: DotNetRandom,
  ): ArrowPath[] {
    const need = mask.map((row) => [...row]); // true = a shape cell still waiting to be filled
    const rowFirst = new Int16Array(rows);
    const rowLast = new Int16Array(rows);
    const colFirst = new Int16Array(cols);
    const colLast = new Int16Array(cols);
    // Remaining cells stay linked in row-major order, so candidate gathering
    // visits only live cells while preserving the original traversal order.
    const cellCount = rows * cols;
    const liveNext = new Int32Array(cellCount);
    const livePrevious = new Int32Array(cellCount);
    rowFirst.fill(cols);
    rowLast.fill(-1);
    colFirst.fill(rows);
    colLast.fill(-1);

    let remaining = 0;
    let liveHead = -1;
    let liveTail = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!need[r][c]) continue;
        const cellIndex = r * cols + c;
        livePrevious[cellIndex] = liveTail;
        liveNext[cellIndex] = -1;
        if (liveTail === -1) liveHead = cellIndex;
        else liveNext[liveTail] = cellIndex;
        liveTail = cellIndex;
        remaining++;
        if (c < rowFirst[r]) rowFirst[r] = c;
        rowLast[r] = c;
        if (r < colFirst[c]) colFirst[c] = r;
        colLast[c] = r;
      }
    }
    const result: ArrowPath[] = [];
    const span = Math.max(rows, cols);
    const cap = Math.min(cfg.maxLen, span);

    const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;

    // A head can exit when it is the outermost still-needed cell in its row or
    // column. The four bounds are updated as cells are consumed, turning the
    // old repeated ray walks into constant-time checks without changing
    // candidate order, weights, or RNG consumption.
    const rayClearOfNeed = (r: number, c: number, d: Direction): boolean => {
      switch (d) {
        case Direction.Up: return colFirst[c] === r;
        case Direction.Down: return colLast[c] === r;
        case Direction.Left: return rowFirst[r] === c;
        case Direction.Right: return rowLast[r] === c;
        default: return false;
      }
    };

    const consumeCell = (r: number, c: number): void => {
      need[r][c] = false;
      remaining--;

      const cellIndex = r * cols + c;
      const previous = livePrevious[cellIndex];
      const next = liveNext[cellIndex];
      if (previous === -1) liveHead = next;
      else liveNext[previous] = next;
      if (next === -1) liveTail = previous;
      else livePrevious[next] = previous;

      if (rowFirst[r] === c) {
        let next = c + 1;
        while (next < cols && !need[r][next]) next++;
        rowFirst[r] = next;
      }
      if (rowLast[r] === c) {
        let next = c - 1;
        while (next >= 0 && !need[r][next]) next--;
        rowLast[r] = next;
      }
      if (colFirst[c] === r) {
        let next = r + 1;
        while (next < rows && !need[next][c]) next++;
        colFirst[c] = next;
      }
      if (colLast[c] === r) {
        let next = r - 1;
        while (next >= 0 && !need[next][c]) next--;
        colLast[c] = next;
      }
    };

    // Room (in cells, incl. the head) available straight back from a head —
    // i.e. how long an arrow could start there before it has to bend or stop.
    const backwardRoom = (r: number, c: number, headDir: Direction): number => {
      const [dr, dc] = toDelta(opposite(headDir));
      let len = 1, rr = r + dr, cc = c + dc;
      while (len < cap && inBounds(rr, cc) && need[rr][cc]) { len++; rr += dr; cc += dc; }
      return len;
    };

    // Still-unfilled neighbours of a cell. We grow into the MOST-constrained
    // cell (fewest free neighbours) so the fill doesn't strand single cells —
    // stranded cells are exactly what force short, unbendable length-2 arrows
    // and drag the bend rate down.
    const freeNeighbors = (r: number, c: number): number => {
      let n = 0;
      for (const d of DIRS) {
        const [dr, dc] = toDelta(d);
        const rr = r + dr, cc = c + dc;
        if (inBounds(rr, cc) && need[rr][cc]) n++;
      }
      return n;
    };

    while (remaining > 0) {
      // Gather every legal (head, direction). One always exists while cells
      // remain: a cell in the top-most unfilled row can point Up with nothing
      // unfilled above it. Weight each by its room CAPPED at the length cap —
      // this just steers away from dead-end stubs (so arrows are long enough
      // to actually bend) WITHOUT preferring long strokes: any head with cap+
      // room is equally likely, and length is capped and bent below, so the
      // shape still fills with many short, bendy arrows.
      const cands: { r: number; c: number; d: Direction; w: number }[] = [];
      let weightTotal = 0;
      for (let cellIndex = liveHead; cellIndex !== -1; cellIndex = liveNext[cellIndex]) {
        const r = Math.trunc(cellIndex / cols);
        const c = cellIndex - r * cols;
        for (const d of DIRS) {
          if (!rayClearOfNeed(r, c, d)) continue;
          const room = Math.min(backwardRoom(r, c, d), cap);
          let w = room * room; // squared: steer away from length-2 stubs (so arrows
                               // are long enough to bend) without forcing long strokes
          // Big bonus when a CLEAN L fits here: a 2-cell straight neck plus a
          // free perpendicular cell off it. This is what lets us draw
          // mostly-bent arrows while still keeping the 2-cell neck (no goofy
          // bend at the head).
          const [tdr, tdc] = toDelta(opposite(d));
          const n2r = r + 2 * tdr, n2c = c + 2 * tdc;
          if (room >= 3) {
            for (const pd of DIRS) {
              const [pr, pc] = toDelta(pd);
              if (pr * tdr + pc * tdc !== 0) continue; // keep only perpendiculars
              if (inBounds(n2r + pr, n2c + pc) && need[n2r + pr][n2c + pc]) { w *= 10; break; }
            }
          }
          cands.push({ r, c, d, w });
          weightTotal += w;
        }
      }
      if (cands.length === 0) break; // unreachable by construction; guards against surprises

      let pick = Math.trunc(rng.nextDouble() * weightTotal);
      let ci = 0;
      for (; ci < cands.length; ci++) { pick -= cands[ci].w; if (pick < 0) break; }
      if (ci >= cands.length) ci = cands.length - 1;
      const { r: hr, c: hc, d: headDir } = cands[ci];

      // Grow the body BACKWARD from the head into still-unfilled cells. Body
      // cells need no clear lane (only the head does), so the shape fills
      // tightly. Length is capped and most arrows are made to bend (a clean
      // L / Z), which reads better and plays harder.
      const headFirst: Cell[] = [{ r: hr, c: hc }];
      consumeCell(hr, hc);
      let cur: Cell = { r: hr, c: hc };

      let travel = opposite(headDir); // straight neck runs back from the head
      // Short arrows, but free to bend (length is capped, so a bendy arrow is
      // just a small L/Z/U tetromino, never a long squiggle). The neck rule
      // below keeps the head off any corner; cfg.bendChance biases how eagerly
      // we turn.
      const maxBends = rng.nextDouble() < cfg.bendArrowChance ? 2 : 1;
      let bends = 0, straightRun = 0;
      const targetLen = rng.next(cfg.minLen, cap + 1);

      const canGo = (d: Direction): Cell | null => {
        const [dr, dc] = toDelta(d);
        const next = { r: cur.r + dr, c: cur.c + dc };
        return inBounds(next.r, next.c) && need[next.r][next.c] ? next : null;
      };

      while (headFirst.length < targetLen) {
        // Candidate steps: straight, or (past the neck, under the bend cap) a
        // perpendicular turn. Among them, prefer a turn when we're choosing to
        // bend, else the tightest pocket; this keeps MOST arrows bent without
        // stranding cells.
        const straightCell = canGo(travel);
        const turns: { d: Direction; cell: Cell }[] = [];
        // Require a TWO-cell straight neck before the FIRST bend, so a turn is
        // never right at the arrowhead (a 1-cell neck reads as a goofy
        // corner-head). Later bends, which sit deeper in the body away from
        // the head, only need one straight step.
        const neckStraight = bends === 0 ? 2 : 1;
        if (bends < maxBends && straightRun >= neckStraight) {
          for (const sd of DIRS) {
            if (sd === travel || sd === opposite(travel)) continue;
            const tc = canGo(sd);
            if (tc) turns.push({ d: sd, cell: tc });
          }
        }

        const doBend = turns.length > 0 && (straightCell === null || rng.nextDouble() < cfg.bendChance);

        let nextCell: Cell;
        if (doBend) {
          // Of the available turns, take the one into the tightest pocket.
          let bestTurn = turns[0];
          for (let t = 1; t < turns.length; t++) {
            if (freeNeighbors(turns[t].cell.r, turns[t].cell.c) <
                freeNeighbors(bestTurn.cell.r, bestTurn.cell.c)) {
              bestTurn = turns[t];
            }
          }
          travel = bestTurn.d; nextCell = bestTurn.cell;
          bends++; straightRun = 0;
        } else if (straightCell !== null && !(bends === 0 && headFirst.length >= 5)) {
          // Keep growing straight — but never let a *straight* arrow get long
          // enough to look like a stripe; once it hits length 5 with no bend
          // yet, stop it here.
          nextCell = straightCell; straightRun++;
        } else {
          break; // boxed in (or a straight arrow that hit its length limit)
        }

        consumeCell(nextCell.r, nextCell.c);
        headFirst.push(nextCell);
        cur = nextCell;
      }

      // Mop up dead-end cells hanging off the TAIL so the fill doesn't strand
      // single cells (stranded cells are what force short, unbendable
      // length-1/2 arrows and tank the bend rate). We only extend the tail —
      // the head and its exit lane are untouched — and only absorb a cell that
      // has no other way out (degree <= 1). That keeps it solvability-safe
      // (the cell just clears earlier, never later) and turns would-be stubs
      // into bends.
      let tail = headFirst[headFirst.length - 1];
      while (headFirst.length < cap + 2) { // keep arrows short even after absorbing stubs
        const n = headFirst.length;
        // Direction of the last segment. Until the head has its 2-cell
        // straight neck (n < 3), the mop-up may only continue STRAIGHT —
        // never bend near the head.
        let ldr: number, ldc: number;
        if (n >= 2) {
          const prev = headFirst[n - 2];
          ldr = tail.r - prev.r; ldc = tail.c - prev.c;
        } else {
          [ldr, ldc] = toDelta(travel);
        }
        const allowBend = n >= 3;

        let chosen: Direction | null = null;
        let chosenCell: Cell = { r: 0, c: 0 };
        let chosenFree = Infinity;
        for (const d of DIRS) {
          const [dr, dc] = toDelta(d);
          if (!allowBend && (dr !== ldr || dc !== ldc)) continue; // keep the neck straight
          const rr = tail.r + dr, cc = tail.c + dc;
          if (!inBounds(rr, cc) || !need[rr][cc]) continue;
          let fn = 0; // free neighbours of the candidate, excluding the tail we'd come from
          for (const e of DIRS) {
            const [er, ec] = toDelta(e);
            const nr = rr + er, nc = cc + ec;
            if (inBounds(nr, nc) && need[nr][nc] && !(nr === tail.r && nc === tail.c)) fn++;
          }
          if (fn <= 1 && fn < chosenFree) { chosen = d; chosenCell = { r: rr, c: cc }; chosenFree = fn; }
        }
        if (chosen === null) break; // nothing dead-ended hangs off the tail
        consumeCell(chosenCell.r, chosenCell.c);
        headFirst.push(chosenCell);
        tail = chosenCell;
      }

      const tailToHead = [...headFirst].reverse();
      result.push(new ArrowPath(tailToHead, headDir));
    }

    return result;
  },
};

// Deterministic, well-spread seed per level index (FNV-1a style mix), matching
// the C# `unchecked((int)((2166136261u ^ (uint)levelIndex) * 16777619u))`.
function seed(levelIndex: number): number {
  return Math.imul((2166136261 ^ levelIndex) | 0, 16777619) | 0;
}

function countTrue(m: readonly (readonly boolean[])[]): number {
  let n = 0;
  for (const row of m) for (const b of row) if (b) n++;
  return n;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// C# System.Math.Round rounds half to even (banker's rounding); JS Math.round
// rounds half up. The difference matters for odd rows * aspect 1.5 (x.5).
function roundHalfToEven(v: number): number {
  const floor = Math.floor(v);
  const diff = v - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

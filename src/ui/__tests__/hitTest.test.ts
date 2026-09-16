import { ArrowPath, BoardLogic, Direction } from '../../core';
import { AMBIGUITY_CELLS, ArrowHitTester, distanceToPolyline } from '../hitTest';

const CELL = 40;

function board(lines: string[], rows = 6, cols = 6): BoardLogic {
  return BoardLogic.parse(rows, cols, lines);
}

const at = (r: number, c: number, dr = 0.5, dc = 0.5) => ({
  x: (c + dc) * CELL,
  y: (r + dr) * CELL,
});

describe('distanceToPolyline', () => {
  it('measures to the nearest segment, not the nearest vertex', () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(distanceToPolyline(50, 10, line)).toBeCloseTo(10);
    expect(distanceToPolyline(110, 50, line)).toBeCloseTo(10);
    expect(distanceToPolyline(-30, 0, line)).toBeCloseTo(30);
    expect(distanceToPolyline(5, 5, [{ x: 0, y: 0 }])).toBeCloseTo(Math.hypot(5, 5));
    expect(distanceToPolyline(0, 0, [])).toBe(Infinity);
  });
});

describe('ArrowHitTester.nearest', () => {
  // Two parallel horizontal arrows one row apart, both pointing right.
  const b = board(['1,3,R:LL', '3,3,R:LL']);
  const top = b.ownerAt(1, 1)!;
  const bottom = b.ownerAt(3, 1)!;
  const tester = new ArrowHitTester(b, CELL);

  it('hits the arrow whose cell was tapped when the tap is on its ink', () => {
    const p = at(1, 2);
    expect(tester.nearest(p.x, p.y, 0)?.arrow).toBe(top);
    expect(tester.nearest(p.x, p.y, 0)?.distance).toBeCloseTo(0);
  });

  it('snaps a tap in an empty row to the nearest arrow within the radius', () => {
    // Row 2 is empty; a tap 0.3 cells below its top edge is nearer the top arrow.
    const p = at(2, 2, 0.3);
    expect(tester.nearest(p.x, p.y, CELL)?.arrow).toBe(top);
    const q = at(2, 2, 0.8);
    expect(tester.nearest(q.x, q.y, CELL)?.arrow).toBe(bottom);
  });

  it('returns null when nothing is within the radius', () => {
    const p = at(5, 5);
    expect(tester.nearest(p.x, p.y, 0.5 * CELL)).toBeNull();
    expect(tester.nearest(p.x, p.y, 3 * CELL)?.arrow).toBe(bottom);
  });

  it('snaps from outside the board and rejects non-finite input', () => {
    // Left of column 0, level with the top arrow: its rounded tail ends 1.08
    // cells inside the board edge, so the tap is 1.38 cells from the ink.
    expect(tester.nearest(-0.3 * CELL, 1.5 * CELL, CELL)).toBeNull();
    expect(tester.nearest(-0.3 * CELL, 1.5 * CELL, 1.5 * CELL)?.arrow).toBe(top);
    expect(tester.nearest(NaN, 10, CELL)).toBeNull();
    expect(tester.nearest(10, 10, -1)).toBeNull();
  });

  it('reaches an arrowhead tip that pokes into an empty neighbouring cell', () => {
    // Head at (1,3) facing right: the tip sits on the boundary to (1,4).
    const p = at(1, 4, 0.5, 0.1);
    expect(tester.nearest(p.x, p.y, 0.2 * CELL)?.arrow).toBe(top);
  });

  it('follows the board as arrows are removed', () => {
    const live = board(['1,3,R:LL', '3,3,R:LL']);
    const t = new ArrowHitTester(live, CELL);
    const topArrow = live.ownerAt(1, 1)!;
    expect(live.tryRemove(live.ownerAt(3, 1)!)).toBe(true);
    const p = at(3, 2);
    expect(t.nearest(p.x, p.y, 0.5 * CELL)).toBeNull();
    expect(t.nearest(p.x, p.y, 2.5 * CELL)?.arrow).toBe(topArrow);
  });

  it('prefers the ink that is visually closest at a bend', () => {
    // An L-shaped arrow bending in (2,2) next to a straight one through (3,2).
    const bent = board(['1,2,U:DL', '3,3,R:LL']);
    const t = new ArrowHitTester(bent, CELL);
    const elbow = bent.ownerAt(2, 2)!;
    const straight = bent.ownerAt(3, 2)!;
    // Centre of the elbow cell is on the bent arrow's ink.
    expect(t.nearest(at(2, 2).x, at(2, 2).y, CELL)?.arrow).toBe(elbow);
    // The elbow cell's far corner is half a cell from the straight arrow's
    // stroke and ~0.7 cells from the elbow's; the straight arrow wins.
    expect(t.nearest(at(2, 2, 0.95, 0.95).x, at(2, 2, 0.95, 0.95).y, CELL)?.arrow).toBe(straight);
  });

  it('gives a seam tap the benefit of the doubt when only one neighbour can exit', () => {
    // Top arrow is blocked (an arrow sits in its lane); the bottom one is free.
    const b2 = board(['1,3,R:LL', '1,5,U', '3,3,R:LL']);
    const t = new ArrowHitTester(b2, CELL);
    const topArrow = b2.ownerAt(1, 1)!;
    const bottomArrow = b2.ownerAt(3, 1)!;
    const canExit = (a: ArrowPath) => b2.canExit(a);
    expect(canExit(topArrow)).toBe(false);
    expect(canExit(bottomArrow)).toBe(true);

    // Dead centre of the empty row 2: 1 cell from each stroke. Without a
    // preference the first-found arrow wins; with it, the free one does.
    const seam = at(2, 2);
    expect(t.nearest(seam.x, seam.y, 2 * CELL)?.arrow).toBe(topArrow);
    expect(t.nearest(seam.x, seam.y, 2 * CELL, canExit)?.arrow).toBe(bottomArrow);

    // Just inside the ambiguity band still flips; outside it does not.
    const inside = at(2, 2, 0.5 - AMBIGUITY_CELLS / 2 + 0.01);
    expect(t.nearest(inside.x, inside.y, 2 * CELL, canExit)?.arrow).toBe(bottomArrow);
    const outside = at(2, 2, 0.5 - AMBIGUITY_CELLS / 2 - 0.01);
    expect(t.nearest(outside.x, outside.y, 2 * CELL, canExit)?.arrow).toBe(topArrow);

    // A clear tap on the blocked arrow's own ink is never redirected.
    const onTop = at(1, 2);
    expect(t.nearest(onTop.x, onTop.y, 2 * CELL, canExit)?.arrow).toBe(topArrow);
  });
});

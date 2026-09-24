import { ArrowPath, Direction } from '../../core';
import { arrowArt, grownTriangleD } from '../arrowGeometry';

// POLISH-T6: the blocked arrow's background-coloured cover must reach past the
// static head's anti-aliased edge by `outset` on every side, as ONE plain
// triangle fill (the draw type the head itself uses).
const pts = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
function edgeDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return cross / Math.hypot(b.x - a.x, b.y - a.y);
}

describe('grownTriangleD', () => {
  test.each([Direction.Up, Direction.Right, Direction.Down, Direction.Left])(
    'grows a head (dir %s) by the outset on all three edges', (dir) => {
      const { headD } = arrowArt(new ArrowPath([{ r: 3, c: 3 }, { r: 3, c: 4 }], dir), 40);
      const grown = grownTriangleD(headD, 0.75);
      expect(grown).toMatch(/^M[-\d. ]+ L[-\d. ]+ L[-\d. ]+ Z$/);
      const [a, b, c] = [0, 2, 4].map((i) => ({ x: pts(headD)[i], y: pts(headD)[i + 1] }));
      const [ga, gb, gc] = [0, 2, 4].map((i) => ({ x: pts(grown)[i], y: pts(grown)[i + 1] }));
      // Each grown edge is parallel to its original and |outset| further out.
      for (const [p, q, gp, gq] of [[a, b, ga, gb], [b, c, gb, gc], [c, a, gc, ga]]) {
        const inside = edgeDistance({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, p, q);
        const d1 = edgeDistance(gp, p, q);
        const d2 = edgeDistance(gq, p, q);
        expect(Math.sign(d1)).toBe(-Math.sign(inside));
        expect(Math.abs(d1)).toBeCloseTo(0.75, 1);
        expect(Math.abs(d2)).toBeCloseTo(0.75, 1);
      }
    });

  test('returns the input unchanged when it is not a single triangle', () => {
    expect(grownTriangleD('M0 0 L1 1', 1)).toBe('M0 0 L1 1');
    expect(grownTriangleD('M0 0 L1 0 L2 0 Z', 1)).toBe('M0 0 L1 0 L2 0 Z');
  });
});

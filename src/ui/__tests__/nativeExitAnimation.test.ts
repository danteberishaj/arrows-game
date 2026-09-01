import { ArrowPath, Direction } from '../../core';
import { slitherPath } from '../arrowGeometry';
import { serializeNativeExitAnimation } from '../nativeExitAnimation';

describe('serializeNativeExitAnimation', () => {
  it('encodes the header, then every trail point, in the order the native parsers expect', () => {
    const arrow = new ArrowPath([{ r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }], Direction.Right);
    const path = slitherPath(arrow, 40, 6, 8);
    const encoded = serializeNativeExitAnimation({
      id: 7,
      arrowIndex: 3,
      durationMs: 180,
      reducedMotion: false,
      path,
      trailStrokeWidth: 0.26 * 40,
    });

    const tokens = encoded.split(',').map(Number);
    expect(tokens.slice(0, 5)).toEqual([7, 3, 180, 0, 10.4]);
    expect(tokens[5]).toBeCloseTo(path.bodyLen, 2);
    expect(tokens[6]).toBeCloseTo(path.totalLen, 2);
    expect(tokens.slice(7, 9)).toEqual([1, 0]);
    expect(tokens[9]).toBe(path.points.length);
    expect(tokens.length).toBe(10 + path.points.length * 2);
    // The ray must end past the right edge (8 cols * 40) so the trail fully leaves.
    expect(tokens[tokens.length - 2]).toBeGreaterThan(8 * 40);
    expect(tokens.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('flags reduced motion with a 1', () => {
    const arrow = new ArrowPath([{ r: 0, c: 0 }], Direction.Down);
    const path = slitherPath(arrow, 40, 4, 4);
    const encoded = serializeNativeExitAnimation({
      id: 1,
      arrowIndex: 0,
      durationMs: 200,
      reducedMotion: true,
      path,
      trailStrokeWidth: 10,
    });
    expect(encoded.split(',')[3]).toBe('1');
  });
});

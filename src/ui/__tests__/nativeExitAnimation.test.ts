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

describe('POLISH-T3: flag-OFF payload is byte-identical to the pre-T3 serializer', () => {
  // Captured from the pre-T3 code (HEAD 330cf7f) with scratchpad/golden.ts before any T3 edit.
  const PRE_T3_RIGHT =
    '7,3,214,0,10.4,136.8,493.6,1,0,7,43.2,100,60,100,100,100,100,140,140,140,140,140,496.8,140';
  const PRE_T3_UP_RM =
    '12,0,180,1,10.4,96.8,373.6,0,-1,6,180,236.8,180,220,180,180,180,140,180,140,180,-136.8';
  const right = new ArrowPath(
    [{ r: 2, c: 1 }, { r: 2, c: 2 }, { r: 3, c: 2 }, { r: 3, c: 3 }],
    Direction.Right,
  );
  const up = new ArrowPath([{ r: 5, c: 4 }, { r: 4, c: 4 }, { r: 3, c: 4 }], Direction.Up);

  it('serializes an event without motion (no extent) exactly as before', () => {
    expect(serializeNativeExitAnimation({
      id: 7, arrowIndex: 3, durationMs: 214, reducedMotion: false,
      path: slitherPath(right, 40, 6, 8), trailStrokeWidth: 0.26 * 40,
    })).toBe(PRE_T3_RIGHT);
    expect(serializeNativeExitAnimation({
      id: 12, arrowIndex: 0, durationMs: 180, reducedMotion: true,
      path: slitherPath(up, 40, 20, 20), trailStrokeWidth: 10.4, motion: null,
    })).toBe(PRE_T3_UP_RM);
  });

  it('with motion, appends fadeStart,launch AFTER the points (header layout unchanged)', () => {
    const path = slitherPath(right, 40, 6, 8);
    const encoded = serializeNativeExitAnimation({
      id: 7, arrowIndex: 3, durationMs: 214, reducedMotion: false,
      path, trailStrokeWidth: 0.26 * 40, motion: { fadeStart: 0.85, launch: 0.35 },
    });
    expect(encoded).toBe(`${PRE_T3_RIGHT},0.85,0.35`);
    const tokens = encoded.split(',').map(Number);
    // Parsers tell the variants apart from n (token 9): 10 + 2n (defaults) or 12 + 2n.
    expect(tokens.length).toBe(12 + tokens[9] * 2);
  });
});

import {
  EMPTY_SHAPE_MASKS,
  MASK_BITS,
  countSeen,
  foldLevels,
  hasSeen,
  markSeen,
  sanitizeMask,
  type ShapeMasks,
} from '../collection';
import { generateDaily } from '../dailyBoard';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { MAX_CATALOGUE_BITS, SHAPE_CATALOGUE, catalogueIndexOf } from '../shapeCatalogue';

/**
 * W4-07: the shape collection is two persisted 30-bit ints. A wrong bit is a
 * wrong picture in the player's gallery forever, so the fold is checked against
 * the FULL generator (not the cheap lookup it uses), and the masks against the
 * exact serialization the store uses (src/ui/storage.ts: String(v) on write,
 * parseInt(v, 10) on hydrate).
 */

const MASK_MAX = 2 ** 30 - 1;

/** Every catalogue index whose bit is set, ascending. */
function seenIndices(masks: ShapeMasks): number[] {
  const out: number[] = [];
  for (let i = 0; i < MAX_CATALOGUE_BITS; i += 1) if (hasSeen(masks, i)) out.push(i);
  return out;
}

/** The ground truth: catalogue indices of the shapes the real generator deals for [from, to). */
function generatedIndices(from: number, to: number): number[] {
  const set = new Set<number>();
  for (let i = from; i < to; i += 1) set.add(catalogueIndexOf(LevelGenerator.generate(i).shapeName));
  return [...set].sort((a, b) => a - b);
}

describe('bit layout', () => {
  test('two 30-bit masks cover exactly the 60-id catalogue capacity', () => {
    expect(MASK_BITS).toBe(30);
    expect(2 * MASK_BITS).toBe(MAX_CATALOGUE_BITS);
  });

  test('setting each of the 60 indices alone reads back exactly one true, at that index', () => {
    for (let set = 0; set < 60; set += 1) {
      const masks = markSeen(EMPTY_SHAPE_MASKS, set);
      const hits: number[] = [];
      for (let read = 0; read < 60; read += 1) if (hasSeen(masks, read)) hits.push(read);
      expect([set, hits]).toEqual([set, [set]]);
      expect(countSeen(masks)).toBe(1);
      // 0-29 live in lo, 30-59 in hi, and never in the other mask.
      expect(set < 30 ? masks.hi : masks.lo).toBe(0);
    }
  });

  test('countSeen of all 60 is 60, and lo and hi each stay <= 2^30 - 1', () => {
    let masks = EMPTY_SHAPE_MASKS;
    for (let i = 0; i < 60; i += 1) masks = markSeen(masks, i);
    expect(countSeen(masks)).toBe(60);
    expect(masks.lo).toBe(MASK_MAX);
    expect(masks.hi).toBe(MASK_MAX);
    expect(masks.lo).toBeGreaterThanOrEqual(0);
    expect(masks.hi).toBeGreaterThanOrEqual(0);
  });

  test('both masks survive String(v) then parseInt(v, 10), the IntStore serialization', () => {
    let masks = EMPTY_SHAPE_MASKS;
    const samples: ShapeMasks[] = [];
    for (let i = 0; i < 60; i += 1) {
      masks = markSeen(masks, i);
      samples.push(masks, markSeen(EMPTY_SHAPE_MASKS, i));
    }
    for (const m of samples) {
      const lo = parseInt(String(m.lo), 10);
      const hi = parseInt(String(m.hi), 10);
      expect({ lo, hi }).toEqual({ lo: m.lo, hi: m.hi });
      expect(seenIndices({ lo, hi })).toEqual(seenIndices(m));
    }
  });

  test('markSeen is idempotent, keeps every existing bit, and ignores an index outside 0-59', () => {
    const start = markSeen(markSeen(EMPTY_SHAPE_MASKS, 3), 42);
    expect(markSeen(start, 3)).toEqual(start);
    expect(seenIndices(markSeen(start, 7))).toEqual([3, 7, 42]);
    for (const bad of [-1, 60, 61, 2.5, Number.NaN]) {
      expect(markSeen(start, bad)).toEqual(start);
      expect(hasSeen(start, bad)).toBe(false);
    }
  });

  test('sanitizeMask keeps a valid mask, keeps the low 30 bits of a wider int, and reads corrupt values as 0', () => {
    expect(sanitizeMask(0)).toBe(0);
    expect(sanitizeMask(MASK_MAX)).toBe(MASK_MAX);
    expect(sanitizeMask(2 ** 30 + 5)).toBe(5);
    expect(sanitizeMask(2 ** 40 + 9)).toBe(9);
    for (const corrupt of [-1, -(2 ** 31), 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect([corrupt, sanitizeMask(corrupt)]).toEqual([corrupt, 0]);
    }
  });
});

describe('foldLevels', () => {
  test('truthful fold: levels 0..299 set exactly the shapes the FULL generator deals', () => {
    const folded = foldLevels(EMPTY_SHAPE_MASKS, 0, 300, shapeNameForLevel, Number.POSITIVE_INFINITY);

    expect(folded.through).toBe(300);
    expect(seenIndices(folded)).toEqual(generatedIndices(0, 300));
    expect(generatedIndices(0, 300)).not.toContain(-1);
  });

  test('incremental equals one-shot: 0..300 in calls capped at 7 gives the same masks and through = 300', () => {
    const oneShot = foldLevels(EMPTY_SHAPE_MASKS, 0, 300, shapeNameForLevel, Number.POSITIVE_INFINITY);

    let state = { lo: 0, hi: 0, through: 0 };
    let calls = 0;
    while (state.through < 300) {
      const next = foldLevels(state, state.through, 300, shapeNameForLevel, 7);
      expect(next.through - state.through).toBeLessThanOrEqual(7);
      expect(next.through).toBeGreaterThan(state.through);
      state = next;
      calls += 1;
    }

    expect(calls).toBe(Math.ceil(300 / 7));
    expect(state).toEqual(oneShot);
  });

  test('caps at maxSteps, never lowers through, and treats a negative start as 0', () => {
    const lookup = jest.fn(shapeNameForLevel);

    const capped = foldLevels(EMPTY_SHAPE_MASKS, 10, 50, lookup, 5);
    expect(capped.through).toBe(15);
    expect(lookup.mock.calls.map(([i]) => i)).toEqual([10, 11, 12, 13, 14]);

    lookup.mockClear();
    const ahead = foldLevels(capped, 60, 50, lookup, 5000);
    expect(ahead).toEqual({ lo: capped.lo, hi: capped.hi, through: 60 });
    expect(lookup).not.toHaveBeenCalled();

    expect(foldLevels(capped, 20, 50, lookup, 0).through).toBe(20);
    expect(foldLevels(capped, 20, 50, lookup, -3).through).toBe(20);
    expect(lookup).not.toHaveBeenCalled();

    const fromNegative = foldLevels(EMPTY_SHAPE_MASKS, -4, 3, lookup, 5000);
    expect(fromNegative.through).toBe(3);
    expect(lookup.mock.calls.map(([i]) => i)).toEqual([0, 1, 2]);
  });

  test('only ORs: bits already set (including ones this catalogue does not know yet) survive a fold', () => {
    // Index 55 and 29 stand for shapes a newer catalogue could have appended.
    const future = markSeen(markSeen(EMPTY_SHAPE_MASKS, 55), 29);
    const folded = foldLevels(future, 0, 40, shapeNameForLevel, 5000);
    expect(hasSeen(folded, 55)).toBe(true);
    expect(hasSeen(folded, 29)).toBe(true);
    expect(seenIndices(folded)).toEqual(
      [...new Set([...generatedIndices(0, 40), 29, 55])].sort((a, b) => a - b),
    );
  });

  test('shouldStop ends a slice early, but a slice always folds at least one level', () => {
    let checks = 0;
    const afterFour = () => {
      checks += 1;
      return checks > 4;
    };
    const five = foldLevels(EMPTY_SHAPE_MASKS, 10, 50, shapeNameForLevel, 200, afterFour);
    expect(five.through).toBe(15); // level 10 unconditionally, then 4 checks pass, the 5th stops
    expect(checks).toBe(5);

    const always = foldLevels(EMPTY_SHAPE_MASKS, 10, 50, shapeNameForLevel, 200, () => true);
    expect(always.through).toBe(11);
    expect(seenIndices(always)).toEqual(generatedIndices(10, 11));

    const never = foldLevels(EMPTY_SHAPE_MASKS, 10, 50, shapeNameForLevel, 7, () => false);
    expect(never.through).toBe(17); // maxSteps still caps a slice

    const nothingToDo = foldLevels(EMPTY_SHAPE_MASKS, 50, 50, shapeNameForLevel, 200, () => true);
    expect(nothingToDo.through).toBe(50);
  });

  test('any slicing (time-like stops x step caps) folds 0..299 to exactly the one-shot result', () => {
    const oneShot = foldLevels(EMPTY_SHAPE_MASKS, 0, 300, shapeNameForLevel, Number.POSITIVE_INFINITY);
    expect(seenIndices(oneShot)).toEqual(generatedIndices(0, 300));

    // Deterministic pseudo-random stop pattern (xorshift), standing in for a jittery clock.
    let x = 0x9e3779b9;
    const jitter = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) % 5 === 0;
    };
    const patterns: Array<[string, () => boolean]> = [
      ['never', () => false],
      ['always', () => true],
      ['every 3rd check', (() => { let n = 0; return () => (n += 1) % 3 === 0; })()],
      ['jitter', jitter],
    ];
    for (const cap of [1, 7, 200, Number.POSITIVE_INFINITY]) {
      for (const [name, stop] of patterns) {
        let state = { lo: 0, hi: 0, through: 0 };
        let calls = 0;
        while (state.through < 300) {
          const next = foldLevels(state, state.through, 300, shapeNameForLevel, cap, stop);
          expect(next.through - state.through).toBeGreaterThanOrEqual(1);
          expect(next.through - state.through).toBeLessThanOrEqual(cap);
          state = next;
          calls += 1;
        }
        expect([cap, name, state]).toEqual([cap, name, oneShot]);
        expect(calls).toBeLessThanOrEqual(300);
      }
    }
  });

  test('a level whose name is not in the catalogue sets no bit but is still passed', () => {
    const folded = foldLevels(EMPTY_SHAPE_MASKS, 0, 3, () => 'NotAShape', 5000);
    expect(folded).toEqual({ lo: 0, hi: 0, through: 3 });
  });
});

describe('every generated name maps (an unmapped name fails the build)', () => {
  test('campaign levels 0..199', () => {
    const unmapped: Array<[number, string]> = [];
    for (let i = 0; i < 200; i += 1) {
      const name = LevelGenerator.generate(i).shapeName;
      if (catalogueIndexOf(name) < 0) unmapped.push([i, name]);
    }
    expect(unmapped).toEqual([]);
  });

  test('daily boards for days 0..364', () => {
    const unmapped: Array<[number, string]> = [];
    for (let d = 0; d < 365; d += 1) {
      const name = generateDaily(d).shapeName;
      if (catalogueIndexOf(name) < 0) unmapped.push([d, name]);
    }
    expect(unmapped).toEqual([]);
    expect(SHAPE_CATALOGUE.length).toBeLessThanOrEqual(MAX_CATALOGUE_BITS);
  });
});

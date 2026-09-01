import { ArrowPath, Direction } from '../../core';
import {
  arrowArt,
  batchedArrowArt,
  BoardArrowArtCache,
  serializeNativeBoardGeometry,
} from '../arrowGeometry';

const CELL = 40;
const arrows = [
  new ArrowPath([{ r: 1, c: 1 }], Direction.Up),
  new ArrowPath([{ r: 2, c: 1 }, { r: 2, c: 2 }], Direction.Right),
  new ArrowPath(
    [{ r: 4, c: 1 }, { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 3, c: 3 }],
    Direction.Right,
  ),
  new ArrowPath([{ r: 5, c: 3 }, { r: 4, c: 3 }], Direction.Up),
  new ArrowPath([{ r: 6, c: 5 }, { r: 6, c: 4 }], Direction.Left),
  new ArrowPath([{ r: 7, c: 6 }, { r: 8, c: 6 }], Direction.Down),
];

describe('batchedArrowArt', () => {
  it('joins each arrow path exactly in input order', () => {
    const arts = arrows.map((arrow) => arrowArt(arrow, CELL));
    const batch = batchedArrowArt(arrows, CELL);

    expect(batch.shaftD).toBe(arts.map((art) => art.shaftD).join(' '));
    expect(batch.headD).toBe(arts.map((art) => art.headD).join(' '));
    expect(batch.shaftD.match(/M/g)).toHaveLength(arrows.length);
    expect(batch.headD.match(/M/g)).toHaveLength(arrows.length);
    expect(batch.headD.match(/Z/g)).toHaveLength(arrows.length);
    expect(`${batch.shaftD} ${batch.headD}`).not.toMatch(/NaN|undefined/);
  });

  it('excludes animated arrow identities without disturbing survivors', () => {
    const excluded = new Set([arrows[1], arrows[3], arrows[1]]);
    const survivors = arrows.filter((arrow) => !excluded.has(arrow));
    const survivorArts = survivors.map((arrow) => arrowArt(arrow, CELL));

    expect(batchedArrowArt(arrows, CELL, excluded)).toEqual({
      shaftD: survivorArts.map((art) => art.shaftD).join(' '),
      headD: survivorArts.map((art) => art.headD).join(' '),
    });

    const absent = new ArrowPath([{ r: 99, c: 99 }], Direction.Left);
    expect(batchedArrowArt(arrows, CELL, new Set([absent]))).toEqual(
      batchedArrowArt(arrows, CELL),
    );
  });

  it('returns empty paths for an empty or fully excluded board', () => {
    expect(batchedArrowArt([], CELL)).toEqual({ shaftD: '', headD: '' });
    expect(batchedArrowArt(arrows, CELL, new Set(arrows))).toEqual({
      shaftD: '',
      headD: '',
    });
  });
});

describe('BoardArrowArtCache', () => {
  it('matches uncached batches across exclusions and surviving-arrow lists', () => {
    const cache = new BoardArrowArtCache(arrows, CELL);
    const excluded = new Set<ArrowPath>();

    for (let removed = 0; removed <= arrows.length; removed++) {
      const survivors = arrows.slice(removed);
      excluded.clear();
      if (survivors[1]) excluded.add(survivors[1]);
      if (survivors[3]) excluded.add(survivors[3]);

      expect(cache.batch(survivors, excluded)).toEqual(
        batchedArrowArt(survivors, CELL, excluded),
      );
    }
  });

  it('reuses board geometry without retaining arrows from another board', () => {
    const cache = new BoardArrowArtCache(arrows, CELL);
    expect(cache.artFor(arrows[0])).toBe(cache.artFor(arrows[0]));

    const foreignArrow = new ArrowPath([{ r: 99, c: 99 }], Direction.Left);
    const firstForeignArt = cache.artFor(foreignArrow);
    const secondForeignArt = cache.artFor(foreignArrow);
    expect(firstForeignArt).toEqual(arrowArt(foreignArrow, CELL));
    expect(secondForeignArt).toEqual(firstForeignArt);
    expect(secondForeignArt).not.toBe(firstForeignArt);
  });

  it('keeps native geometry immutable while visibility follows live arrows', () => {
    const cache = new BoardArrowArtCache(arrows, CELL);
    const geometry = cache.geometryForNativeView();

    expect(geometry).toBe(serializeNativeBoardGeometry(arrows, CELL));
    expect(cache.geometryForNativeView()).toBe(geometry);
    expect(cache.visibilityMask(arrows)).toBe('111111');
    expect(
      cache.visibilityMask(
        [arrows[0], arrows[2], arrows[5]],
        new Set([arrows[2]]),
      ),
    ).toBe('100001');
    expect(cache.visibilityMask([])).toBe('000000');
  });

});

describe('serializeNativeBoardGeometry', () => {
  it('emits one finite, self-sized record per arrow', () => {
    const records = serializeNativeBoardGeometry(arrows, CELL).split(';');
    expect(records).toHaveLength(arrows.length);

    for (const record of records) {
      const values = record.split(',').map(Number);
      const shaftPointCount = values[0];
      expect(Number.isInteger(shaftPointCount)).toBe(true);
      expect(shaftPointCount).toBeGreaterThanOrEqual(2);
      expect(values).toHaveLength(1 + shaftPointCount * 2 + 6);
      expect(values.every(Number.isFinite)).toBe(true);
    }
  });

  it('uses an empty payload for an empty board', () => {
    expect(serializeNativeBoardGeometry([], CELL)).toBe('');
  });
});

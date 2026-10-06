/**
 * W5-17 (owner answer 2026-10-06, docs/owner-rulings-2026-10-06.md Q3: set B): the cleared board's silhouette outline,
 * drawn in board space under the arrows' camera transform, and the post-clear timeline it takes its slot from.
 */
import { generateDaily, LevelGenerator } from '../../core';
import {
  CLEAR_REVEAL_MS,
  clearRevealSlotMs,
  EMPTY_BOARD_HOLD_MS,
  wonPanelDelayMs,
} from '../gameSessionLifecycle';
import { maskOutlinePath, silhouettePath } from '../silhouette';

/** = BoardView.tsx `CELL` (board units per cell); not imported, to keep this a pure-module test. */
const CELL = 40;

type Point = readonly [number, number];

function parseLoops(path: string): Point[][] {
  const tokens = path.match(/[MLZ]|-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const loops: Point[][] = [];
  let current: Point[] | null = null;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++].toUpperCase();
    if (command === 'Z') { loops.push(current!); current = null; continue; }
    const p: Point = [Number(tokens[i++]), Number(tokens[i++])];
    if (command === 'M') current = [p]; else current!.push(p);
  }
  return loops;
}

function inside([x, y]: Point, loops: readonly Point[][]): boolean {
  let hit = false;
  for (const polygon of loops) {
    for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
      const [ax, ay] = polygon[a];
      const [bx, by] = polygon[b];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit;
    }
  }
  return hit;
}

describe('maskOutlinePath: the mask in board space (cell (r, c) spans c..c+1 x r..r+1 cells)', () => {
  it('corner cell (0,0) maps to (0,0)-(CELL,CELL)', () => {
    expect(maskOutlinePath([[true]], CELL)).toBe(`M 0 0 L ${CELL} 0 L ${CELL} ${CELL} L 0 ${CELL} Z`);
    const loops = parseLoops(maskOutlinePath([[true, false], [false, false]], CELL));
    expect(loops).toHaveLength(1);
    expect([...loops[0]].sort()).toEqual([[0, 0], [0, CELL], [CELL, 0], [CELL, CELL]].sort());
  });

  it('is not centred: a 2-row x 5-col mask keeps its origin at (0,0) (silhouettePath centres it)', () => {
    const mask = [[true, true, true, true, true], [true, true, true, true, true]];
    const loops = parseLoops(maskOutlinePath(mask, CELL));
    const ys = loops.flat().map(([, y]) => y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(2 * CELL);
    expect(Math.min(...parseLoops(silhouettePath(mask, 5 * CELL)).flat().map(([, y]) => y))).toBeGreaterThan(0);
  });

  it('round-trips real level masks cell by cell (even-odd) at board scale, square and non-square', () => {
    const levels = [LevelGenerator.generate(0, 1), LevelGenerator.generate(167, 1), LevelGenerator.generate(38, 1)];
    for (let day = 0; day < 400 && !levels.some((l) => l.board.rows !== l.board.cols); day++) {
      const daily = generateDaily(day);
      if (daily.board.rows !== daily.board.cols) levels.push(daily);
    }
    expect(levels.some((l) => l.board.rows !== l.board.cols)).toBe(true);
    for (const level of levels) {
      expect([level.mask.length, level.mask[0].length]).toEqual([level.board.rows, level.board.cols]);
      const loops = parseLoops(maskOutlinePath(level.mask, CELL));
      for (let r = 0; r < level.board.rows; r++) {
        for (let c = 0; c < level.board.cols; c++) {
          expect([level.shapeName, r, c, inside([(c + 0.5) * CELL, (r + 0.5) * CELL], loops)])
            .toEqual([level.shapeName, r, c, level.mask[r][c]]);
        }
      }
      for (const [x, y] of loops.flat()) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(level.board.cols * CELL);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(level.board.rows * CELL);
        expect(x % CELL).toBe(0); expect(y % CELL).toBe(0);
      }
    }
  });

  it('a tutorial board (empty mask) and an all-false mask draw nothing', () => {
    expect(maskOutlinePath([], CELL)).toBe('');
    expect(maskOutlinePath([[false, false]], CELL)).toBe('');
  });

  it('silhouettePath is unchanged by the shared tracer', () => {
    expect(silhouettePath([[true]], 10)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    expect(silhouettePath([[true, true]], 10)).toBe('M 0 2.5 L 10 2.5 L 10 7.5 L 0 7.5 Z');
  });
});

describe('W5-17 + W2-06 timeline, owner set B', () => {
  it('pause 250 ms, outline slot 400 ms', () => {
    expect(EMPTY_BOARD_HOLD_MS).toBe(250);
    expect(CLEAR_REVEAL_MS).toBe(400);
  });

  it('the panel lands 0.74-0.84 s after the last tap for the measured final-exit range 90..187 ms', () => {
    const slot = clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[true]] });
    expect(wonPanelDelayMs(90, EMPTY_BOARD_HOLD_MS, slot)).toBe(740);
    expect(wonPanelDelayMs(187, EMPTY_BOARD_HOLD_MS, slot)).toBe(837);
  });

  it('no outline, no slot: flag OFF, reduced motion (nothing is mounted), or an empty outline (tutorial boards)', () => {
    expect(clearRevealSlotMs({ enabled: false, reducedMotion: false, mask: [[true]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: true, mask: [[true]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[false, false]] })).toBe(0);
    expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask: [[false, true]] })).toBe(CLEAR_REVEAL_MS);
    // the slot is spent exactly when maskOutlinePath draws something
    for (const mask of [[], [[false]], [[true]], [[false, true], [false, false]]]) {
      expect(clearRevealSlotMs({ enabled: true, reducedMotion: false, mask }) > 0).toBe(maskOutlinePath(mask, CELL) !== '');
    }
  });
});

describe('clearRevealRemainingMs: the outline keeps the tap clock', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clearRevealRemainingMs } = require('../clearRevealTiming') as typeof import('../clearRevealTiming');
  it('a node that mounts late only waits what is left of the delay, never less than 0', () => {
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 1000)).toBe(494);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 1150)).toBe(344);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 2000)).toBe(0);
    expect(clearRevealRemainingMs({ delayMs: 494, atMs: 1000 }, 900)).toBe(494); // clock went back: full delay
  });
});

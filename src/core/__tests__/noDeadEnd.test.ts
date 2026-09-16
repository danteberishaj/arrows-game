import { BoardLogic } from '../boardLogic';
import { DotNetRandom } from '../dotnetRandom';
import { LevelGenerator } from '../levelGenerator';

/**
 * Evidence for PRODUCT.md's central claim: no tap order can make a board
 * unsolvable. Removing an arrow only empties cells, so a lane that is clear
 * stays clear (`BoardLogic.canExit` is monotone). A player who only ever taps
 * arrows whose lane is clear therefore always clears the board, in exactly one
 * tap per arrow, whatever order they choose.
 *
 * Each playthrough taps a uniformly chosen exitable arrow until the board is
 * empty. If a future rule ever allows a dead end, this test goes red: that
 * would change what kind of game Arrows is (Track A, a calm attention game),
 * not just a number.
 */

/** Level indices sampled by the 2026-09-09 measurement (levels 1..168). */
const LEVEL_INDICES = [0, 2, 5, 11, 23, 35, 59, 116, 161, 167];
/** DotNetRandom seeds; one random-greedy playthrough per seed. */
const SEEDS = [1, 2, 3, 4, 5];

interface Playthrough {
  removals: number;
  /** True if some step found no exitable arrow while arrows remained. */
  stuck: boolean;
  remaining: number;
}

/** Repeatedly removes a uniformly chosen exitable arrow until none can leave. */
function randomGreedyPlaythrough(board: BoardLogic, rng: DotNetRandom): Playthrough {
  let removals = 0;
  while (board.arrows().length > 0) {
    const exitable = board.arrows().filter((a) => board.canExit(a));
    if (exitable.length === 0) {
      return { removals, stuck: true, remaining: board.arrows().length };
    }
    const pick = exitable[rng.next(exitable.length)];
    if (!board.tryRemove(pick)) {
      throw new Error('canExit said yes but tryRemove refused');
    }
    removals++;
  }
  return { removals, stuck: false, remaining: 0 };
}

describe('no tap order can make a board unsolvable', () => {
  for (const levelIndex of LEVEL_INDICES) {
    for (const seed of SEEDS) {
      test(`level index ${levelIndex}, seed ${seed}: clears in exactly arrowCount removals`, () => {
        const level = LevelGenerator.generate(levelIndex);
        expect(level.arrowCount).toBeGreaterThan(0);

        const result = randomGreedyPlaythrough(level.board, new DotNetRandom(seed));

        expect(result.stuck).toBe(false);
        expect(level.board.arrows().length).toBe(0);
        expect(result.removals).toBe(level.arrowCount);
      });
    }
  }
});

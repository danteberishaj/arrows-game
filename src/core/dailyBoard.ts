import { Difficulties, Difficulty } from './difficulty';
import { DotNetRandom } from './dotnetRandom';
import { GeneratedLevel, LevelGenerator } from './levelGenerator';
import { shapeDefFor } from './shapeCatalogue';

/**
 * The daily board: one Normal-config board per day number, shared by every
 * player, drawn from its OWN seed namespace and its OWN shape pool.
 *
 * Why not just `LevelGenerator.generate(day)`:
 * - **Seed namespace.** `seed(i)` (levelGenerator.ts) is a one-round FNV over
 *   the level index, and day numbers land inside the reachable campaign range
 *   (today is day 2450; level 2451 is index 2450). Seeding a daily with the
 *   day number hands some player a board they already cleared in the campaign.
 *   `dailySeed` mixes a namespace byte in a first round, so no daily seed
 *   equals any campaign seed (see `__tests__/dailyBoard.test.ts`).
 * - **Pool.** Normal's campaign pool is only Square/Rectangle/Circle/Diamond.
 *   The daily is the one board everyone sees, so it draws the whole picture
 *   catalogue instead.
 *
 * This module reads and writes no `SaveSystem` key: it is a pure function of
 * the day number. A player who moves their device clock gets a different
 * daily, and that is accepted (no leaderboard, no anti-tamper).
 */

/**
 * v1 daily pool: every catalogue id in catalogue order except the two
 * no-picture fills, which read as "the whole grid" rather than a silhouette.
 * Listed explicitly by id — deliberately NOT derived from `ShapeDef.fillsGrid`,
 * which W3-03 deletes.
 *
 * OWNER-PICKED STARTING VALUE: the 24-shape pool (the exclusion of Square and
 * Rectangle is a recommendation, not a measurement). The 26-shape alternative
 * is measured side by side in `scripts/analysis/daily-band.ts`; see
 * `docs/next-level/measurements/daily-band-2026-09.md`.
 */
export const DAILY_POOL_V1: readonly string[] = Object.freeze([
  'Circle',
  'Diamond',
  'Triangle',
  'Plus',
  'Hexagon',
  'Star',
  'Heart',
  'Trophy',
  'Crescent',
  'Flower',
  'Bolt',
  'Arrow',
  'Crown',
  'Hourglass',
  'Pentagon',
  'Octagon',
  'Ring',
  'X',
  'Butterfly',
  'Rocket',
  'Pine',
  'Cat',
  'Mushroom',
  'Fish',
]);

/** One daily pool, in force from `fromDay` until the next entry's `fromDay`. */
export interface DailyVersion {
  readonly fromDay: number;
  readonly pool: readonly string[];
}

/**
 * VERSIONING RULE. Past days never change. Adding shapes to the daily (after
 * W3 authors new ones, say) means APPENDING an entry whose `fromDay` is a
 * day in the future — never editing `DAILY_POOL_V1` and never back-dating an
 * entry. If W3's v2 generator should apply to dailies, it arrives the same
 * way. Entries are kept in ascending `fromDay` order.
 */
export const DAILY_VERSIONS: readonly DailyVersion[] = Object.freeze([
  Object.freeze({ fromDay: 0, pool: DAILY_POOL_V1 }),
]);

/**
 * Namespaced two-round FNV-1a over the day number. The extra first round mixes
 * the namespace byte 0x64 ("d") in, which is what keeps the output off
 * `levelGenerator.seed`'s one-round image for every reachable day and level.
 */
export function dailySeed(day: number): number {
  let h = 2166136261;
  h = Math.imul(h ^ 0x64, 16777619);
  h = Math.imul(h ^ day, 16777619);
  return h | 0;
}

/** The pool in force on `day` — the last entry whose `fromDay` is <= day. */
export function dailyPoolFor(day: number): readonly string[] {
  let pool = DAILY_VERSIONS[0].pool;
  for (const version of DAILY_VERSIONS) {
    if (version.fromDay <= day) pool = version.pool;
  }
  return pool;
}

/**
 * The board for `day` (a local day number, the same unit `SaveSystem.today()`
 * uses). Pure: same day in, same board out, forever.
 */
export function generateDaily(day: number): GeneratedLevel {
  return generateDailyFromPool(day, dailyPoolFor(day));
}

/**
 * `generateDaily`'s body with the pool supplied. Exists so
 * `scripts/analysis/daily-band.ts` can measure a CANDIDATE pool through the
 * exact shipped pipeline instead of a copy of it. Production code calls
 * `generateDaily`; a new pool reaches players only through `DAILY_VERSIONS`.
 */
export function generateDailyFromPool(day: number, pool: readonly string[]): GeneratedLevel {
  const rng = new DotNetRandom(dailySeed(day));
  const id = pool[rng.next(pool.length)];
  const shape = shapeDefFor(id);
  if (shape === null) throw new Error(`Daily pool holds an unknown catalogue id '${id}'`);
  return LevelGenerator.buildFromShape(
    shape,
    Difficulty.Normal,
    Difficulties.config(Difficulty.Normal),
    rng,
  );
}

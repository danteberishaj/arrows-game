/**
 * Prints the measured arrow-count and grid-size bands of each difficulty tier,
 * so DESIGN.md's "Difficulty" paragraph quotes numbers a reader can reproduce
 * instead of Unity-era estimates.
 *
 * Run: npx tsx scripts/analysis/tier-bands.ts
 *
 * Every level index in [FIRST_INDEX, LAST_INDEX] is generated with the shipping
 * generator (`LevelGenerator.generate`, the same call GameScreen makes; the
 * player sees "Level index + 1") and grouped by `Difficulties.forLevel`.
 * Percentiles use the nearest-rank method on the sorted values.
 */
import { Difficulties, Difficulty, LevelGenerator } from '../../src/core';

const FIRST_INDEX = 0;
const LAST_INDEX = 599; // OWNER-PICKED STARTING VALUE (range 0..599 named in task P-03)

interface Sample {
  arrows: number;
  rows: number;
  cols: number;
}

/** Nearest-rank percentile (p in 0..100) of an ascending array. */
function nearestRank(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function range(values: readonly number[]): string {
  return `${Math.min(...values)}–${Math.max(...values)}`;
}

const tiers = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard];
const samples = new Map<Difficulty, Sample[]>(tiers.map((t) => [t, []]));

for (let i = FIRST_INDEX; i <= LAST_INDEX; i++) {
  const level = LevelGenerator.generate(i);
  samples.get(level.difficulty)!.push({
    arrows: level.arrowCount,
    rows: level.board.rows,
    cols: level.board.cols,
  });
}

console.log(`Tier bands over level indices ${FIRST_INDEX}..${LAST_INDEX} (levels ${FIRST_INDEX + 1}..${LAST_INDEX + 1})`);
console.log('');
console.log('| Tier | n | arrows min | p10 | median | p90 | max | rows | cols |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const tier of tiers) {
  const s = samples.get(tier)!;
  const arrows = s.map((x) => x.arrows).sort((a, b) => a - b);
  console.log(
    `| ${Difficulties.displayName(tier)} | ${s.length} | ${arrows[0]} | ${nearestRank(arrows, 10)} | ` +
      `${nearestRank(arrows, 50)} | ${nearestRank(arrows, 90)} | ${arrows[arrows.length - 1]} | ` +
      `${range(s.map((x) => x.rows))} | ${range(s.map((x) => x.cols))} |`,
  );
}

/**
 * Measures the daily board's shipped band, so W4-03's distribution assertions
 * and every number in docs/next-level/measurements/daily-band-2026-09.md are
 * reproduced from code rather than estimated.
 *
 * Run: npx tsx scripts/analysis/daily-band.ts
 * Determinism check:
 *   npx tsx scripts/analysis/daily-band.ts > a.txt \
 *     && npx tsx scripts/analysis/daily-band.ts > b.txt && diff a.txt b.txt
 *
 * The shipped pool goes through the real `generateDaily`; the 26-shape
 * candidate goes through `generateDailyFromPool`, which is `generateDaily`'s
 * own body with the pool supplied (src/core/dailyBoard.ts) — so both columns
 * are the shipping pipeline, not a copy of it. Percentiles use the
 * nearest-rank method on the ascending sample, and the sample count is printed
 * next to them so a reader can reconcile it against the day window.
 */
import {
  DAILY_POOL_V1,
  SHAPE_CATALOGUE,
  dailySeed,
  generateDaily,
  generateDailyFromPool,
  seed,
} from '../../src/core';

const FIRST_DAY = 0;
const LAST_DAY = 3649; // 10 years of days — the window the W4-03 brief names.
const CAMPAIGN_LEVELS = 200000; // seed-collision search space the W4-03 brief names.
const DAILY_SEED_DAYS = 20000; // day range the namespace assertion covers.

/** The 26-shape alternative: the whole catalogue, including the two fills. */
const POOL_26: readonly string[] = SHAPE_CATALOGUE;

interface PoolReport {
  label: string;
  pool: readonly string[];
  arrows: number[];
  maxGridDimension: number;
  shapeCounts: Map<string, number>;
  consecutiveRepeats: number;
}

function nearestRank(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function measure(
  label: string,
  pool: readonly string[],
  build: (day: number) => ReturnType<typeof generateDaily>,
): PoolReport {
  const arrows: number[] = [];
  const shapeCounts = new Map<string, number>(pool.map((id) => [id, 0]));
  let maxGridDimension = 0;
  let consecutiveRepeats = 0;
  let previousShape = '';

  for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
    const level = build(day);
    arrows.push(level.arrowCount);
    maxGridDimension = Math.max(maxGridDimension, level.board.rows, level.board.cols);
    shapeCounts.set(level.shapeName, (shapeCounts.get(level.shapeName) ?? 0) + 1);
    if (level.shapeName === previousShape) consecutiveRepeats++;
    previousShape = level.shapeName;
  }

  arrows.sort((a, b) => a - b);
  return { label, pool, arrows, maxGridDimension, shapeCounts, consecutiveRepeats };
}

function printReport(report: PoolReport): void {
  const { arrows } = report;
  const expected = LAST_DAY - FIRST_DAY + 1;
  console.log(`## ${report.label} — ${report.pool.length} shapes`);
  console.log('');
  console.log(
    `sample: ${arrows.length} boards (window ${FIRST_DAY}..${LAST_DAY} x 1 board/day = ${expected}; ` +
      `${arrows.length === expected ? 'reconciled' : 'MISMATCH'})`,
  );
  console.log('');
  console.log('| min | p10 | p25 | p50 | p75 | p90 | p95 | max |');
  console.log('|---|---|---|---|---|---|---|---|');
  console.log(
    `| ${arrows[0]} | ${nearestRank(arrows, 10)} | ${nearestRank(arrows, 25)} | ` +
      `${nearestRank(arrows, 50)} | ${nearestRank(arrows, 75)} | ${nearestRank(arrows, 90)} | ` +
      `${nearestRank(arrows, 95)} | ${arrows[arrows.length - 1]} |`,
  );
  console.log('');
  console.log(`max grid dimension (max of rows, cols over the window): ${report.maxGridDimension}`);
  console.log(`consecutive-day shape repeats: ${report.consecutiveRepeats}`);
  const missing = [...report.shapeCounts].filter(([, n]) => n === 0).map(([id]) => id);
  console.log(`pool shapes that never appear: ${missing.length === 0 ? 'none' : missing.join(', ')}`);
  console.log('');
  console.log('| shape | days |');
  console.log('|---|---|');
  for (const id of report.pool) console.log(`| ${id} | ${report.shapeCounts.get(id) ?? 0} |`);
  console.log('');
}

console.log(`# Daily board band, days ${FIRST_DAY}..${LAST_DAY}`);
console.log('');

const shipped = measure('SHIPPED pool (catalogue minus Square, Rectangle)', DAILY_POOL_V1, generateDaily);
const candidate = measure('CANDIDATE pool (whole catalogue)', POOL_26, (day) =>
  generateDailyFromPool(day, POOL_26),
);

printReport(shipped);
printReport(candidate);

// Namespace: no daily seed may equal any campaign level seed.
const campaign = new Set<number>();
for (let i = 0; i < CAMPAIGN_LEVELS; i++) campaign.add(seed(i));
let collisions = 0;
const distinctDailySeeds = new Set<number>();
for (let day = 0; day < DAILY_SEED_DAYS; day++) {
  const s = dailySeed(day);
  distinctDailySeeds.add(s);
  if (campaign.has(s)) collisions++;
}
console.log('## Seed namespace');
console.log('');
console.log(`campaign seeds searched: ${campaign.size} distinct of ${CAMPAIGN_LEVELS} indices`);
console.log(`daily seeds checked: ${DAILY_SEED_DAYS} days, ${distinctDailySeeds.size} distinct`);
console.log(`collisions with a campaign seed: ${collisions}`);
console.log(`naive seed(2450) = ${seed(2450)}, dailySeed(2450) = ${dailySeed(2450)}`);

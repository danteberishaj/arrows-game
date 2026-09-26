/**
 * V2-FINISH part 2 (b): no generator v2 draw leaves [0, 1).
 *
 * Run: npx tsx scripts/analysis/rng-exactness.ts [--seeds 1000000] [--draws 50] [--windows 100000]
 *
 * v2 draws from `ExactDotNetRandom` with two seed families: the level stream
 * `seed(i)` (`generateV2`: its target, `fillMask`, the clearable-bias pick)
 * and the bag's `bagSeed(ordinal)`. For every seed in both families this
 * scans:
 * - the draws: `--draws` doubles from a fresh stream, counting any outside
 *   [0, 1);
 * - the seeded state: every one of SeedArray[1..55] in [0, MBIG). That is the
 *   stronger check: `InternalSample` subtracts two values of [0, MBIG), so its
 *   result (plus MBIG when negative) is again in [0, MBIG), and by induction
 *   EVERY later draw of that seed is in [0, 1), not only the first `--draws`.
 * The frozen `DotNetRandom` port (v1 and the daily) runs the same scan on the
 * same seeds as the positive control: W3-10 found about a quarter of campaign
 * seeds leaving [0, 1) within 50 draws, so a scan that reports 0 for the
 * exact class and many for the port is measuring the defect, not missing it.
 *
 * Imports only `src/core`.
 */
import { DotNetRandom, ExactDotNetRandom, bagSeed, seed } from '../../src/core';

const MBIG = 2147483647;

interface Counts {
  seeds: number;
  draws: number;
  seedsWithDrawOutside: number;
  drawsOutside: number;
  seedsWithStateOutside: number;
  minDraw: number;
  maxDraw: number;
}

function arg(name: string, fallback: number): number {
  const k = process.argv.indexOf(name);
  if (k < 0) return fallback;
  const v = Number(process.argv[k + 1]);
  if (!Number.isSafeInteger(v) || v <= 0) throw new Error(`${name} needs a positive integer`);
  return v;
}

function scan(seeds: (k: number) => number, count: number, draws: number, exact: boolean): Counts {
  const c: Counts = { seeds: 0, draws: 0, seedsWithDrawOutside: 0, drawsOutside: 0, seedsWithStateOutside: 0, minDraw: Infinity, maxDraw: -Infinity };
  for (let k = 0; k < count; k++) {
    const s = seeds(k);
    const rng = exact ? new ExactDotNetRandom(s) : new DotNetRandom(s);
    const state = exact
      ? (rng as ExactDotNetRandom).stateForRangeCheck()
      : (rng as unknown as { seedArray: number[] }).seedArray.slice(1); // the port keeps it private; read for the control only
    if (state.some((v) => v < 0 || v >= MBIG)) c.seedsWithStateOutside++;
    let outside = 0;
    for (let d = 0; d < draws; d++) {
      const u = rng.nextDouble();
      if (u < c.minDraw) c.minDraw = u;
      if (u > c.maxDraw) c.maxDraw = u;
      if (u < 0 || u >= 1) outside++;
    }
    c.seeds++;
    c.draws += draws;
    c.drawsOutside += outside;
    if (outside > 0) c.seedsWithDrawOutside++;
  }
  return c;
}

function main(): void {
  const seedCount = arg('--seeds', 1_000_000);
  const draws = arg('--draws', 50);
  const windows = arg('--windows', 100_000);
  const rows: [string, string, Counts][] = [];
  for (const exact of [true, false]) {
    const cls = exact ? 'ExactDotNetRandom (v2)' : 'DotNetRandom (frozen port, control)';
    rows.push([cls, `campaign seed(i), i = 0..${seedCount - 1}`, scan(seed, seedCount, draws, exact)]);
    rows.push([cls, `bagSeed(w), w = 0..${windows - 1}`, scan(bagSeed, windows, draws, exact)]);
  }
  console.log(`V2-FINISH RNG range scan: ${draws} draws per seed, plus the seeded state (SeedArray[1..55] in [0, MBIG) proves every later draw in [0, 1)).`);
  console.log('');
  console.log('| class | seeds | draws | seeds with a draw outside [0, 1) | draws outside | seeds with state outside [0, MBIG) | min draw | max draw |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const [cls, family, c] of rows) {
    console.log(`| ${cls} | ${family} (${c.seeds}) | ${c.draws} | ${c.seedsWithDrawOutside} | ${c.drawsOutside} | ${c.seedsWithStateOutside} | ${c.minDraw} | ${c.maxDraw} |`);
  }
  const v2 = rows.filter(([cls]) => cls.startsWith('Exact'));
  const bad = v2.reduce((t, [, , c]) => t + c.drawsOutside + c.seedsWithStateOutside, 0);
  const control = rows.find(([cls, family]) => cls.startsWith('DotNet') && family.startsWith('campaign'))![2];
  console.log('');
  console.log(`v2 (exact): ${bad === 0 ? 'PASS' : 'FAIL'}, ${bad} out-of-range draws or states. `
    + `Positive control (frozen port, campaign seeds): ${control.seedsWithDrawOutside} seeds draw outside [0, 1) within ${draws} draws.`);
  if (bad !== 0 || control.seedsWithDrawOutside === 0) process.exitCode = 1;
}

main();

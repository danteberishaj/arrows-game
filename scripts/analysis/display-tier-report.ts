/**
 * W3-20 option (a): the displayed tier's arrow-count thresholds, measured.
 *
 * Run: npx tsx scripts/analysis/display-tier-report.ts [--levels a-b] [--json]
 * (default --levels 1-1000; displayed levels, 1-based).
 *
 * It deals three corpora with the shipping generator, as players meet them:
 * - `v1`: `LevelGenerator.generate(i, 1)` (every install today; GEN_V2_ENABLED is false);
 * - `v2 fresh`: `generate(i, 2)` (a fresh install, switch level 0);
 * - `v2 existing (switch 1)`: what `resolveGenVersion(i, 1, true)` deals: v1 below index 1, then
 *   `generate(i, 2, { switchLevel: 1 })` (the floored curve of an existing player).
 *
 * The proposal: thresholds that give the v2 fresh-install corpus the W3-20 brief's target shares
 * (`BRIEF_TARGET_SHARES`: Normal 1/2, Hard 1/3, Super Hard 1/6). The brief calls these "today's 3/2/1
 * cycle share", but the shipped cycle is N,N,H,N,N,SH, i.e. 4/6, 1/6, 1/6 (counted below from
 * `Difficulties.forLevel`), so the report also prints the cuts that would reproduce the cycle's real share,
 * as an alternative for the owner. `hard` is the integer T minimising |share(arrows < T) - Normal's share|;
 * `superHard` the T minimising |share(arrows >= T) - Super Hard's share|; ties go to the smaller T.
 * A board is Normal below `hard`,
 * Hard from `hard` to `superHard - 1`, Super Hard from `superHard`: one cut per edge, so displayed tiers
 * cannot overlap by construction (the overlap lines below are computed anyway, as a check).
 *
 * It then prints, for every corpus, the share and arrow range per displayed tier under both the proposal
 * and the shipped constant (`DISPLAY_TIER_THRESHOLDS`, src/core/displayTier.ts), the cycle tiers' ranges
 * for comparison (W3-01's `--tier-report`), the level at which each displayed tier is first met, and
 * v1 level 12 (the W3-20 reproduction: Bolt, 54 arrows, "Super Hard" by the cycle).
 *
 * Imports only `src/core`.
 */
import {
  Difficulties,
  Difficulty,
  DISPLAY_TIER_THRESHOLDS,
  LevelGenerator,
  displayTierForArrowCount,
  resolveGenVersion,
  type DisplayTierThresholds,
  type GeneratedLevel,
} from '../../src/core';

interface Board {
  level: number; // displayed, 1-based
  arrows: number;
  cycleTier: Difficulty;
  shape: string;
  gen: 1 | 2;
}

interface Corpus {
  id: string;
  boards: Board[];
}

const TIERS = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard] as const;

/** The W3-20 brief's target shares for the v2 fresh-install corpus (controller ruling 2026-10-06). */
const BRIEF_TARGET_SHARES: Record<Difficulty, number> = {
  [Difficulty.Normal]: 1 / 2,
  [Difficulty.Hard]: 1 / 3,
  [Difficulty.SuperHard]: 1 / 6,
};

/** Levels whose displayed tiers are printed in order, per corpus (what a player meets first). */
const SEQUENCE_LEVELS = 24;

function parseArgs(argv: readonly string[]): { levels: [number, number]; json: boolean } {
  let levels: [number, number] = [1, 1000];
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--levels') {
      const m = /^(\d+)-(\d+)$/.exec(argv[++i] ?? '');
      if (!m || Number(m[1]) < 1 || Number(m[2]) < Number(m[1])) throw new Error('--levels must be a-b with 1 <= a <= b');
      levels = [Number(m[1]), Number(m[2])];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { levels, json };
}

function toBoard(index: number, level: GeneratedLevel, gen: 1 | 2): Board {
  return { level: index + 1, arrows: level.arrowCount, cycleTier: level.difficulty, shape: level.shapeName, gen };
}

function deal(levels: readonly [number, number]): Corpus[] {
  const v1: Board[] = [];
  const fresh: Board[] = [];
  const existing: Board[] = [];
  for (let level = levels[0]; level <= levels[1]; level++) {
    const i = level - 1;
    const one = LevelGenerator.generate(i, 1);
    v1.push(toBoard(i, one, 1));
    fresh.push(toBoard(i, LevelGenerator.generate(i, 2), 2));
    // An existing player stamped at switch level 1: the resolver (enabled) picks the version per index.
    existing.push(resolveGenVersion(i, 1, true) === 2
      ? toBoard(i, LevelGenerator.generate(i, 2, { switchLevel: 1 }), 2)
      : toBoard(i, one, 1));
  }
  return [
    { id: 'v1', boards: v1 },
    { id: 'v2 fresh', boards: fresh },
    { id: 'v2 existing (switch 1)', boards: existing },
  ];
}

/** The cycle's own share per tier (3/6, 2/6, 1/6 today), counted from the shipped schedule. */
function cycleShares(): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { [Difficulty.Normal]: 0, [Difficulty.Hard]: 0, [Difficulty.SuperHard]: 0 };
  for (let i = 0; i < Difficulties.cycleLength; i++) counts[Difficulties.forLevel(i)] += 1;
  for (const t of TIERS) counts[t] /= Difficulties.cycleLength;
  return counts;
}

function argminThreshold(arrows: readonly number[], share: (t: number) => number, target: number): number {
  const lo = Math.min(...arrows);
  const hi = Math.max(...arrows) + 1;
  let best = lo;
  let bestErr = Infinity;
  for (let t = lo; t <= hi; t++) {
    const err = Math.abs(share(t) - target);
    if (err < bestErr) { best = t; bestErr = err; }
  }
  return best;
}

function propose(arrows: readonly number[], shares: Record<Difficulty, number>): DisplayTierThresholds {
  const n = arrows.length;
  const below = (t: number) => arrows.filter((a) => a < t).length / n;
  const atOrAbove = (t: number) => arrows.filter((a) => a >= t).length / n;
  const hard = argminThreshold(arrows, below, shares[Difficulty.Normal]);
  const superHard = argminThreshold(arrows, atOrAbove, shares[Difficulty.SuperHard]);
  if (!(superHard > hard)) throw new Error(`proposal is not ordered: hard ${hard}, superHard ${superHard}`);
  return { hard, superHard };
}

function nearestRank(sorted: readonly number[], p: number): number {
  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1];
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

interface TierRow { tier: string; count: number; share: string; min: number | null; max: number | null; firstLevel: number | null }

function byTier(boards: readonly Board[], tierOf: (b: Board) => Difficulty): TierRow[] {
  return TIERS.map((t) => {
    const hit = boards.filter((b) => tierOf(b) === t);
    const arrows = hit.map((b) => b.arrows);
    return {
      tier: Difficulties.displayName(t),
      count: hit.length,
      share: pct(hit.length / boards.length),
      min: arrows.length ? Math.min(...arrows) : null,
      max: arrows.length ? Math.max(...arrows) : null,
      firstLevel: hit.length ? hit[0].level : null,
    };
  });
}

function overlaps(rows: readonly TierRow[]): string[] {
  const out: string[] = [];
  for (let a = 0; a < rows.length; a++) {
    for (let b = a + 1; b < rows.length; b++) {
      const x = rows[a];
      const y = rows[b];
      if (x.min === null || y.min === null) { out.push(`${x.tier} ∩ ${y.tier}: none (a tier is empty)`); continue; }
      const lo = Math.max(x.min, y.min);
      const hi = Math.min(x.max!, y.max!);
      out.push(`${x.tier} ∩ ${y.tier}: ${lo <= hi ? `${lo}-${hi} (${hi - lo + 1} arrow counts)` : 'none'}`);
    }
  }
  return out;
}

function table(headers: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
  for (const row of rows) lines.push(`| ${row.map((c) => (c === null ? '-' : c)).join(' | ')} |`);
  return lines.join('\n');
}

function main(): void {
  const { levels, json } = parseArgs(process.argv.slice(2));
  const corpora = deal(levels);
  const fresh = corpora[1];
  const proposal = propose(fresh.boards.map((b) => b.arrows), BRIEF_TARGET_SHARES);
  const cycleAlternative = propose(fresh.boards.map((b) => b.arrows), cycleShares());
  const shipped = DISPLAY_TIER_THRESHOLDS;
  const level12 = corpora[0].boards.find((b) => b.level === 12) ?? null;

  const report = corpora.map((c) => {
    const sorted = c.boards.map((b) => b.arrows).sort((x, y) => x - y);
    const proposed = byTier(c.boards, (b) => displayTierForArrowCount(b.arrows, proposal));
    const atShipped = byTier(c.boards, (b) => displayTierForArrowCount(b.arrows, shipped));
    const cycle = byTier(c.boards, (b) => b.cycleTier);
    const alternative = byTier(c.boards, (b) => displayTierForArrowCount(b.arrows, cycleAlternative));
    const letter = (t: Difficulty) => (t === Difficulty.SuperHard ? 'S' : t === Difficulty.Hard ? 'H' : 'N');
    const first = c.boards.slice(0, SEQUENCE_LEVELS);
    return {
      id: c.id,
      n: c.boards.length,
      arrows: { min: sorted[0], p10: nearestRank(sorted, 10), median: nearestRank(sorted, 50), p90: nearestRank(sorted, 90), max: sorted[sorted.length - 1] },
      proposed, proposedOverlaps: overlaps(proposed),
      shipped: atShipped, shippedOverlaps: overlaps(atShipped),
      cycle, cycleOverlaps: overlaps(cycle),
      alternative,
      sequence: {
        arrows: first.map((b) => b.arrows).join(' '),
        shipped: first.map((b) => letter(displayTierForArrowCount(b.arrows, shipped))).join(''),
        cycle: first.map((b) => letter(b.cycleTier)).join(''),
      },
    };
  });

  if (json) {
    console.log(JSON.stringify({ levels, briefTargetShares: BRIEF_TARGET_SHARES, cycleShares: cycleShares(), proposal,
      cycleAlternative, shipped, level12, report }, null, 2));
    return;
  }

  const s = cycleShares();
  console.log(`W3-20 displayed-tier report over displayed levels ${levels[0]}-${levels[1]}`);
  console.log(`Cycle shares (Difficulties.forLevel): Normal ${pct(s[Difficulty.Normal])}, Hard ${pct(s[Difficulty.Hard])}, `
    + `Super Hard ${pct(s[Difficulty.SuperHard])}`);
  const b = BRIEF_TARGET_SHARES;
  console.log(`Brief target shares: Normal ${pct(b[Difficulty.Normal])}, Hard ${pct(b[Difficulty.Hard])}, `
    + `Super Hard ${pct(b[Difficulty.SuperHard])}`);
  console.log(`Proposal (brief shares on the v2 fresh-install corpus): hard = ${proposal.hard}, superHard = ${proposal.superHard} `
    + `(Normal < ${proposal.hard} <= Hard < ${proposal.superHard} <= Super Hard)`);
  console.log(`Alternative (the cycle's real shares on the same corpus): hard = ${cycleAlternative.hard}, `
    + `superHard = ${cycleAlternative.superHard}`);
  console.log(`Shipped DISPLAY_TIER_THRESHOLDS: hard = ${shipped.hard}, superHard = ${shipped.superHard} `
    + `(${shipped.hard === proposal.hard && shipped.superHard === proposal.superHard ? 'EQUALS the proposal'
      : shipped.hard === cycleAlternative.hard && shipped.superHard === cycleAlternative.superHard
        ? 'EQUALS the cycle-share alternative, the owner\'s pick 2026-10-06' : 'DIFFERS from both'})`);
  if (level12) {
    console.log(`v1 level 12: ${level12.shape}, ${level12.arrows} arrows; cycle tier ${Difficulties.displayName(level12.cycleTier)}; `
      + `displayed (shipped thresholds) ${Difficulties.displayName(displayTierForArrowCount(level12.arrows, shipped))}`);
  }
  for (const r of report) {
    console.log('');
    console.log(`## ${r.id} (n = ${r.n}; arrows min ${r.arrows.min}, p10 ${r.arrows.p10}, median ${r.arrows.median}, `
      + `p90 ${r.arrows.p90}, max ${r.arrows.max})`);
    const headers = ['tier', 'boards', 'share', 'arrows min', 'arrows max', 'first level'];
    const rowsOf = (rows: readonly TierRow[]) => rows.map((t) => [t.tier, t.count, t.share, t.min, t.max, t.firstLevel]);
    console.log('Displayed tier, shipped thresholds:');
    console.log(table(headers, rowsOf(r.shipped)));
    for (const o of r.shippedOverlaps) console.log(`  overlap ${o}`);
    if (shipped.hard !== proposal.hard || shipped.superHard !== proposal.superHard) {
      console.log('Displayed tier, proposal:');
      console.log(table(headers, rowsOf(r.proposed)));
      for (const o of r.proposedOverlaps) console.log(`  overlap ${o}`);
    }
    console.log(`Displayed tier, cycle-share alternative (${cycleAlternative.hard}/${cycleAlternative.superHard}): `
      + r.alternative.map((t) => `${t.tier} ${t.share}`).join(', '));
    console.log(`First ${SEQUENCE_LEVELS} levels, arrows: ${r.sequence.arrows}`);
    console.log(`  displayed (shipped): ${r.sequence.shipped}`);
    console.log(`  cycle (today):       ${r.sequence.cycle}`);
    console.log('Cycle tier (today\'s label, W3-01 --tier-report):');
    console.log(table(headers, rowsOf(r.cycle)));
    for (const o of r.cycleOverlaps) console.log(`  overlap ${o}`);
  }
}

main();

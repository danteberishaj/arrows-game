import * as fs from 'fs';
import * as path from 'path';
import type { BoardLogic } from '../boardLogic';
import {
  CEILING_BASE_CELLS,
  LEVEL1_CLEARABLE_BIAS,
  LEVEL1_TARGET_CELLS,
  V1_FLOOR_BASE_CELLS,
  V1_TIER_TEXTURE,
  V2_CURVE,
} from '../curve';
import { Difficulties, Difficulty } from '../difficulty';
import { hasV1Floor, resolveGenVersion } from '../generatorVersion';
import { LevelGenerator, shapeNameForLevel } from '../levelGenerator';
import { bagCandidates, curveWindowMaxTarget, pickForLevelV2, shapeCapacity } from '../shapeBag';

// V2-FINISH part 1 (OWNER PICK 2026-09-26, W3-16): S400 is THE v2 curve, and an
// existing player (switch level > 0) gets a v1 floor. A fresh install (switch
// level 0) follows S400 from level 1. The dealt board is a pure function of
// (level index, switch level). Expectations are recomputed here from the
// curve table and the floor constant, never read back from the generator.

const TIERS = [Difficulty.Normal, Difficulty.Hard, Difficulty.SuperHard] as const;
const WEIGHT: Record<Difficulty, number> = {
  [Difficulty.Normal]: V1_TIER_TEXTURE.Normal,
  [Difficulty.Hard]: V1_TIER_TEXTURE.Hard,
  [Difficulty.SuperHard]: V1_TIER_TEXTURE.SuperHard,
};
/** S400's last row: displayed level 400. */
const CEILING_INDEX = 400 - 1;

/** S400's base cells at `i`, recomputed from its two rows (88 at 0, the ceiling at 399, flat after). */
function s400Base(i: number): number {
  if (i >= CEILING_INDEX) return CEILING_BASE_CELLS;
  return LEVEL1_TARGET_CELLS + ((CEILING_BASE_CELLS - LEVEL1_TARGET_CELLS) * i) / CEILING_INDEX;
}

/** S400's bias at `i` (3 -> 1 over the same ramp). */
function s400Bias(i: number): number {
  if (i >= CEILING_INDEX) return 1;
  return LEVEL1_CLEARABLE_BIAS + ((1 - LEVEL1_CLEARABLE_BIAS) * i) / CEILING_INDEX;
}

function target(base: number, d: Difficulty): number {
  return Math.round((base * WEIGHT[d]) / V1_TIER_TEXTURE.Normal);
}

function serialize(level: { shapeName: string; targetCells: number; board: BoardLogic }): string {
  return [level.shapeName, level.targetCells, level.board.rows, level.board.cols, ...level.board.arrows().map((a) => a.toLine())].join('\n');
}

describe('V2-FINISH part 1: S400 is the owner\'s curve', () => {
  test('V2_CURVE is S400: 88 cells at bias 3 on level 1, the owner-picked ceiling (354 cells) at displayed level 400, flat after', () => {
    // RE-CEILING fix round 1, OWNER PICK 2026-09-27 (option B): W3-14 measured
    // 339 on the legacy DotNetRandom stream; on ExactDotNetRandom the arrow cap
    // allows up to 452 (450 with a full-cycle bag window), and the owner picked
    // 354, the flat base whose v2 boards match v1 on the scan proxy
    // (docs/next-level/reports/RE-CEILING.md).
    expect(CEILING_BASE_CELLS).toBe(354);
    expect(V2_CURVE).toEqual([
      { levelIndex: 0, baseCells: 88, tierTexture: V1_TIER_TEXTURE, clearableBias: 3 },
      { levelIndex: 399, baseCells: 354, tierTexture: V1_TIER_TEXTURE },
    ]);
  });

  test('the ceiling and the floor each carry the owner-pick label (RE-CEILING option B)', () => {
    const lines = fs.readFileSync(path.join(__dirname, '..', 'curve.ts'), 'utf8').split('\n');
    for (const name of ['CEILING_BASE_CELLS', 'V1_FLOOR_BASE_CELLS']) {
      const decl = lines.findIndex((l) => l.startsWith(`export const ${name} =`));
      expect([name, decl > 0]).toEqual([name, true]);
      // The label is on one of the lines directly above the declaration, not somewhere in its comment.
      expect([name, lines.slice(Math.max(0, decl - 3), decl).join('\n')])
        .toEqual([name, expect.stringContaining('// OWNER PICK 2026-09-27 (RE-CEILING option B, docs/next-level/reports/RE-CEILING.md)')]);
    }
  });

  test('the saturated S400 window holds 17 shapes, a full tier cycle, so the bag\'s O(1) steady state can engage (RE-CEILING, W3-19)', () => {
    // A Super Hard target above Hexagon's 809 cells (a base above 450) leaves
    // five-shape windows, which the steady state refuses (shapeBag.ts), so a
    // deep cold pick would build ~3,950 windows again. 354's target (635)
    // admitted 13 of the 26 v1 shapes: every shape down to X (645). W3-19's
    // admission (owner ruling 2026-10-06) adds House 758, Bell 743, Teacup 737
    // and Umbrella 702 (shapeCapacity, EXECUTED in docs/next-level/reports/W3-21.md): 17.
    const superHard = target(CEILING_BASE_CELLS, Difficulty.SuperHard);
    const holding = bagCandidates().filter((shape) => shapeCapacity(shape) >= superHard);
    expect(holding.length).toBeGreaterThanOrEqual(Difficulties.cycleLength);
    expect(holding.length).toBe(17);
  });

  test('the curve source carries the owner-pick marker (W3-16)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'curve.ts'), 'utf8');
    expect(src).toContain('// OWNER PICK 2026-09-26 (W3-16, docs/curve-candidates-2026-09-26.md)');
    expect(src).not.toMatch(/PLACEHOLDER/);
  });
});

describe('V2-FINISH part 1: the v1 floor', () => {
  test('the floor is measured, sits between level 1 and the ceiling, and every tier\'s floor target is at most S400\'s ceiling target', () => {
    // 333 on the legacy stream (V2-FINISH part 1) and 335 on the exact stream
    // (part 2), both calibrated on v1's arrow medians. RE-CEILING fix round 1
    // (OWNER PICK 2026-09-27, option B): 354, calibrated on the scan proxy
    // instead; `npm run analysis:probe -- --version 2 --v1-floor` prints both
    // bases (see curve.ts). It equals the ceiling, so an existing player's
    // boards are the ceiling's from their first v2 level.
    expect(V1_FLOOR_BASE_CELLS).toBe(354);
    expect(V1_FLOOR_BASE_CELLS).toBeGreaterThan(LEVEL1_TARGET_CELLS);
    expect(V1_FLOOR_BASE_CELLS).toBeLessThanOrEqual(CEILING_BASE_CELLS);
    for (const d of TIERS) expect([d, target(V1_FLOOR_BASE_CELLS, d) <= target(CEILING_BASE_CELLS, d)]).toEqual([d, true]);
  });

  test('hasV1Floor: only an install with a switch level above 0 is an existing player', () => {
    expect(hasV1Floor(null)).toBe(false);
    expect(hasV1Floor(undefined)).toBe(false);
    expect(hasV1Floor(0)).toBe(false);
    expect(hasV1Floor(1)).toBe(true);
    expect(hasV1Floor(41)).toBe(true);
  });

  test('configV2 with the floor: cells max(S400, floor), bias at most neutral (v1 has none)', () => {
    const bad: string[] = [];
    for (let i = 0; i < 1200; i++) {
      for (const d of TIERS) {
        const floored = Difficulties.configV2(d, i, V2_CURVE, true);
        const wantCells = target(Math.max(s400Base(i), V1_FLOOR_BASE_CELLS), d);
        if (floored.minCells !== wantCells || floored.maxCells !== wantCells) bad.push(`${i}/${d}: ${floored.maxCells} != ${wantCells}`);
        if (floored.clearableBias !== undefined) bad.push(`${i}/${d}: bias ${floored.clearableBias}`);
        // The fresh config it replaces carries S400's easing bias below the ceiling.
        const freshBias = Difficulties.configV2(d, i).clearableBias ?? 1;
        if (Math.abs(freshBias - s400Bias(i)) > 1e-12) bad.push(`${i}/${d}: fresh bias ${freshBias} != ${s400Bias(i)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('the floor never lowers a board: cells never below, bias never above, the fresh config (every tier, 0-2999)', () => {
    const bad: string[] = [];
    for (let i = 0; i < 3000; i++) {
      for (const d of TIERS) {
        const fresh = Difficulties.configV2(d, i);
        const floored = Difficulties.configV2(d, i, V2_CURVE, true);
        if (floored.maxCells < fresh.maxCells) bad.push(`${i}/${d}: cells ${floored.maxCells} < ${fresh.maxCells}`);
        if ((floored.clearableBias ?? 1) > (fresh.clearableBias ?? 1)) bad.push(`${i}/${d}: bias raised`);
        // Everything else is v1's tier config, untouched.
        const { minCells: _a, maxCells: _b, clearableBias: _c, ...restF } = floored;
        const { minCells: _d, maxCells: _e, clearableBias: _f, ...restN } = fresh;
        if (JSON.stringify(restF) !== JSON.stringify(restN)) bad.push(`${i}/${d}: arrow rules differ`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('from the ceiling on the floor is inert: the floored config IS the fresh config (399-5000, and far out)', () => {
    for (const i of [399, 400, 401, 999, 1000, 4999, 100_000]) {
      for (const d of TIERS) {
        expect([i, d, Difficulties.configV2(d, i, V2_CURVE, true)]).toEqual([i, d, Difficulties.configV2(d, i)]);
      }
    }
    // ... and it binds strictly below the index where S400 passes it (so it is
    // not inert everywhere). RE-CEILING: that index moves with the ceiling, so
    // it is recomputed here instead of a literal (300 held for the 339 ceiling).
    // `lastBound` is the last index whose fresh Normal target is still below the floor's.
    let lastBound = 0;
    while (target(s400Base(lastBound + 1), Difficulty.Normal) < target(V1_FLOOR_BASE_CELLS, Difficulty.Normal)) lastBound++;
    expect(lastBound).toBeGreaterThan(99);
    expect(lastBound).toBeLessThan(CEILING_INDEX);
    for (const i of [0, 49, 99, lastBound]) {
      expect(Difficulties.configV2(Difficulty.Normal, i, V2_CURVE, true).maxCells)
        .toBeGreaterThan(Difficulties.configV2(Difficulty.Normal, i).maxCells);
    }
  });
});

/**
 * The brief's table: fresh vs existing install at displayed levels 1, 50,
 * 100, 399, 400 and 1000. An existing player switches at currentLevel + 1
 * (W3-05), so their switch level is at least 1; `switchAt` is the level they
 * met v2 at: the tested level itself, and a daily-only player's 1.
 */
describe.each([1, 50, 100, 399, 400, 1000])('V2-FINISH part 1: displayed level %i, fresh vs existing install', (level) => {
  const i = level - 1;
  const d = Difficulties.forLevel(i);

  test('fresh install (switch 0): v2 on S400 from level 1', () => {
    expect(resolveGenVersion(i, 0, true)).toBe(2);
    const fresh = LevelGenerator.generate(i, 2, { switchLevel: 0 });
    expect(serialize(fresh)).toBe(serialize(LevelGenerator.generate(i, 2))); // switch 0 is the default
    expect(fresh.targetCells).toBe(target(s400Base(i), d));
  });

  test('existing install: v1 below its switch level, the floored v2 at and above it', () => {
    for (const switchAt of [Math.max(1, i), 1]) {
      const version = resolveGenVersion(i, switchAt, true);
      const board = LevelGenerator.generate(i, version, { switchLevel: switchAt });
      if (i < switchAt) {
        // Level 1 is never v2 for an existing player: their board 0 stays v1.
        expect(version).toBe(1);
        expect(serialize(board)).toBe(serialize(LevelGenerator.generate(i, 1)));
        continue;
      }
      expect(version).toBe(2);
      const want = target(Math.max(s400Base(i), V1_FLOOR_BASE_CELLS), d);
      expect([switchAt, board.targetCells]).toEqual([switchAt, want]);
      expect(board.targetCells).toBeGreaterThanOrEqual(target(s400Base(i), d)); // never below the fresh board
      expect(board.targetCells).toBeGreaterThanOrEqual(target(V1_FLOOR_BASE_CELLS, d)); // never below v1's size
      // Its shape can hold that target (the floored bag admits by the floored targets).
      expect(shapeCapacity(pickForLevelV2(i, curveWindowMaxTarget(V2_CURVE, true)))).toBeGreaterThanOrEqual(want);
      // Replay deals the same board; every existing switch level deals the same board.
      expect(serialize(LevelGenerator.generate(i, 2, { switchLevel: switchAt }))).toBe(serialize(board));
      expect(serialize(LevelGenerator.generate(i, 2, { switchLevel: switchAt + 7 }))).toBe(serialize(board));
      expect(board.shapeName).toBe(shapeNameForLevel(i, 2, switchAt));
    }
  });

  test('below the ceiling the existing board is bigger than the fresh one; from it on the targets agree', () => {
    const fresh = LevelGenerator.generate(i, 2).targetCells;
    const existing = LevelGenerator.generate(i, 2, { switchLevel: 1 }).targetCells;
    if (i < CEILING_INDEX && s400Base(i) < V1_FLOOR_BASE_CELLS) expect(existing).toBeGreaterThan(fresh);
    else expect(existing).toBe(fresh);
  });
});

describe('V2-FINISH part 1: the floored v2 bag and boards', () => {
  test('an invalid switch level is refused (negative, fractional, NaN)', () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      expect(() => LevelGenerator.generate(3, 2, { switchLevel: bad })).toThrow(RangeError);
      expect(() => shapeNameForLevel(3, 2, bad)).toThrow(RangeError);
    }
    // null (never stamped) deals like a fresh install; v1 ignores the switch level.
    expect(serialize(LevelGenerator.generate(3, 2, { switchLevel: null }))).toBe(serialize(LevelGenerator.generate(3, 2)));
    expect(serialize(LevelGenerator.generate(3, 1, { switchLevel: 41 }))).toBe(serialize(LevelGenerator.generate(3, 1)));
  });

  test('floored boards 0-1199: the curve target, a shape that holds it, no back-to-back repeat, the cheap lookup agrees', () => {
    const bad: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < 1200; i++) {
      const lvl = LevelGenerator.generate(i, 2, { switchLevel: 1 });
      const want = target(Math.max(s400Base(i), V1_FLOOR_BASE_CELLS), lvl.difficulty);
      if (lvl.targetCells !== want) bad.push(`${i}: target ${lvl.targetCells} != ${want}`);
      if (lvl.shapeName === prev) bad.push(`${i}: repeat ${lvl.shapeName}`);
      if (shapeNameForLevel(i, 2, 1) !== lvl.shapeName) bad.push(`${i}: lookup disagrees`);
      if (lvl.board.cols > 37 || lvl.board.rows > 46) bad.push(`${i}: ${lvl.board.rows}x${lvl.board.cols} over the W3-09 clamp`);
      let cells = 0;
      for (const row of lvl.mask) for (const c of row) if (c) cells++;
      if (cells < want && (lvl.board.cols === 37 || lvl.board.rows === 46)) bad.push(`${i}: clamp shortfall ${cells} < ${want}`);
      prev = lvl.shapeName;
    }
    expect(bad).toEqual([]);
  });

  test('the fresh and existing bags are different deals below the ceiling (the switch level reaches the shape)', () => {
    let differs = 0;
    for (let i = 0; i < 120; i++) if (shapeNameForLevel(i, 2, 0) !== shapeNameForLevel(i, 2, 1)) differs++;
    expect(differs).toBeGreaterThan(30);
  });
});

function checksumLines(lines: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

test('existing-player v2 corpus pin: generate(i, 2, { switchLevel: 1 }) for 0-299', () => {
  // Serialized exactly like levelGenerator.test.ts's v1 fingerprint and v2 pin.
  // EXECUTED twice (this test and V2-FINISH's scratch fp.ts). Part 1 pinned
  // dbe91425; part 2 re-pinned it (the exact int32 RNG, and the floor it
  // re-measured, 333 -> 335): d5005b0d. RE-CEILING re-pinned it: first
  // f2fdde04 (ceiling 450, floor 335; never committed), then the owner's
  // option B, ceiling and floor both 354, so every floored target is the
  // ceiling's from the first v2 level: ea5e4bf5 (EXECUTED twice, this test
  // and RE-CEILING's scratch fp.ts). W3-19's admission of House, Teacup,
  // Bell and Umbrella (owner ruling 2026-10-06) re-dealt the bag's windows:
  // 849961f1 (EXECUTED twice, this test and W3-21's artifacts/W3-21/step1/
  // fp.ts; docs/next-level/reports/W3-21.md). W3-21 then froze v2 with its
  // own tests in levelGenerator.test.ts ("v2 frozen at ..."); this pin must
  // agree with them.
  const lines: string[] = [];
  for (let i = 0; i < 300; i++) {
    const lvl = LevelGenerator.generate(i, 2, { switchLevel: 1 });
    lines.push(lvl.shapeName, String(lvl.board.rows), String(lvl.board.cols));
    for (const arrow of lvl.board.arrows()) lines.push(arrow.toLine());
  }
  expect(checksumLines(lines)).toBe('849961f1');
});

// FINAL-FIX (FINAL-REVIEW finding 16): V2-FINISH part 1's tripwire for W3-21
// was removed. It asserted GEN_V2_ENABLED === false only while
// createLevelSession dealt v2 without the install's switch level; V2-WIRE
// (038fdda) added that wiring, so the assertion could never run again and the
// test only checked that the file still contained a generate call. The wiring
// is pinned by behaviour in src/ui/__tests__/gameSessionLifecycle.test.ts
// ("V2-WIRE: createLevelSession forwards the install's stamped switch level to
// v2") and the flag by src/core/__tests__/generatorVersion.test.ts ("the v2
// flag ships OFF").

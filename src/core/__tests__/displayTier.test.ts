/**
 * W3-20 option (a): the displayed tier is a pure function of the board's arrow count. The thresholds are
 * OWNER-PICKED STARTING VALUEs measured by `npx tsx scripts/analysis/display-tier-report.ts` (v2 fresh
 * install, displayed levels 1-1000, the cycle's 3/2/1 share); docs/next-level/reports/W3-20.md.
 */
import { Difficulty, LevelGenerator, type GeneratedLevel } from '..';
import { DISPLAY_TIER_THRESHOLDS, displayTier, displayTierForArrowCount } from '../displayTier';

describe('DISPLAY_TIER_THRESHOLDS', () => {
  test('pins the measured starting values (re-run the report before changing them)', () => {
    expect(DISPLAY_TIER_THRESHOLDS).toEqual({ hard: 88, superHard: 133 });
  });
});

describe('displayTierForArrowCount band edges', () => {
  const { hard, superHard } = DISPLAY_TIER_THRESHOLDS;

  test.each([
    [hard - 1, Difficulty.Normal],
    [hard, Difficulty.Hard],
    [hard + 1, Difficulty.Hard],
    [superHard - 1, Difficulty.Hard],
    [superHard, Difficulty.SuperHard],
    [superHard + 1, Difficulty.SuperHard],
  ])('%i arrows -> %s', (arrows, tier) => {
    expect(displayTierForArrowCount(arrows)).toBe(tier);
  });

  test('literal edges: 87 Normal, 88 Hard, 132 Hard, 133 Super Hard', () => {
    expect(displayTierForArrowCount(87)).toBe(Difficulty.Normal);
    expect(displayTierForArrowCount(88)).toBe(Difficulty.Hard);
    expect(displayTierForArrowCount(132)).toBe(Difficulty.Hard);
    expect(displayTierForArrowCount(133)).toBe(Difficulty.SuperHard);
  });

  test('monotone in the arrow count, so displayed tiers cannot overlap', () => {
    let previous = displayTierForArrowCount(0);
    for (let n = 1; n <= 600; n++) {
      const tier = displayTierForArrowCount(n);
      expect(tier).toBeGreaterThanOrEqual(previous);
      previous = tier;
    }
  });

  test('takes other thresholds (the analysis report evaluates its proposal with them)', () => {
    expect(displayTierForArrowCount(10, { hard: 10, superHard: 20 })).toBe(Difficulty.Hard);
    expect(displayTierForArrowCount(9, { hard: 10, superHard: 20 })).toBe(Difficulty.Normal);
    expect(displayTierForArrowCount(20, { hard: 10, superHard: 20 })).toBe(Difficulty.SuperHard);
  });
});

describe('displayTier(level)', () => {
  test('v1 level 12 (index 11) is Bolt with 54 arrows: the cycle says Super Hard, the board says Normal', () => {
    const level = LevelGenerator.generate(11, 1);
    expect(level.shapeName).toBe('Bolt');
    expect(level.arrowCount).toBe(54);
    expect(level.difficulty).toBe(Difficulty.SuperHard);
    expect(displayTier(level)).toBe(Difficulty.Normal);
  });

  test('reads the arrow count and nothing else', () => {
    const level = LevelGenerator.generate(11, 1);
    const relabelled: GeneratedLevel = { ...level, difficulty: Difficulty.Normal };
    const heavier: GeneratedLevel = { ...level, arrowCount: 200 };
    expect(displayTier(relabelled)).toBe(displayTier(level));
    expect(displayTier(heavier)).toBe(Difficulty.SuperHard);
  });
});

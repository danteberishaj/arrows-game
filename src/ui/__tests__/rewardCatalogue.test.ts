// src/ui/__tests__/rewardCatalogue.test.ts
import { ARROW_STYLES } from '../skinSpecs';
import { FREE_REWARD_IDS, PATH_TOTALS, REWARD_CATALOGUE, REWARD_PATH, rewardForSkin } from '../rewardCatalogue';

test('every arrow style appears exactly once, keyed by its numericId', () => {
  const ids = REWARD_CATALOGUE.filter(e => e.kind === 'skin').map(e => e.rewardId).sort((a, b) => a - b);
  expect(ids).toEqual(ARROW_STYLES.map(s => s.numericId).sort((a, b) => a - b));
  for (const style of ARROW_STYLES) expect(rewardForSkin(style.numericId)?.refId).toBe(style.id);
});

test('Classic, Sherbet and Candy Gloss are free; everything else is on the path', () => {
  expect([...FREE_REWARD_IDS].sort((a, b) => a - b)).toEqual([0, 2, 4]);
  expect(REWARD_PATH.length + FREE_REWARD_IDS.length).toBe(REWARD_CATALOGUE.length);
});

test('path order and costs are the spec table', () => {
  expect(REWARD_PATH.map(e => [e.refId, e.pathCost])).toEqual([
    ['critter', 3], ['cinnamon', 5], ['jelly', 6], ['rainbow-ribbon', 8], ['strawberry-glazed', 8],
    ['campfire', 10], ['yarn', 10], ['neon-glass', 12], ['clear-glass', 12], ['pixel', 13],
    ['paper-craft', 14], ['stained-glass', 15], ['archery', 15], ['lava-rock', 15], ['ink-pro', 15],
  ]);
  expect(PATH_TOTALS[PATH_TOTALS.length - 1]).toBe(161);
});

test('rewardIds are unique, below 60, and every path entry has three chips', () => {
  const ids = REWARD_CATALOGUE.map(e => e.rewardId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(Math.max(...ids)).toBeLessThan(60);
  for (const e of REWARD_PATH) expect(e.chips).toHaveLength(3);
});

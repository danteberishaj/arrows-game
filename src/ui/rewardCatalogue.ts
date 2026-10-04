// src/ui/rewardCatalogue.ts
import { pathTotals } from '../core/rewardPath';
import { inSeason, validateSeason, type Season } from './seasons';
import { ARROW_STYLES } from './skinSpecs';

/** One unlockable. rewardId is persisted as a bit (0–59): never change or reuse one. Skins use their numericId. */
export interface RewardEntry {
  rewardId: number;
  kind: 'skin' | 'exit' | 'board';
  refId: string;
  name: string;
  /** Points after the previous path reward; null = free from the start. */
  pathCost: number | null;
  /** Collection book price (petals); null for free styles. */
  price: number | null;
  chips: readonly string[];
  /** Book-only seasonal style (HALLOWEEN-01): never on the path, never free; buyable only inside its window. */
  season?: Season;
}

/** OWNER-APPROVED STARTING VALUES (spec §2). Tune costs here only. */
const PATH: readonly (readonly [string, number, readonly string[]])[] = [
  ['critter', 3, ['Little faces', 'Caterpillar body', 'Mint board']],
  ['cinnamon', 5, ['Sweet swirl', 'Sleepy face', 'Cream board']],
  ['jelly', 6, ['Glossy', 'Soft spots', 'Blue board']],
  ['rainbow-ribbon', 8, ['Six colours', 'Nested heads', 'Lilac board']],
  ['strawberry-glazed', 8, ['Pink icing', 'Sprinkles', 'Cream board']],
  ['campfire', 10, ['Warm bands', 'Little faces', 'Ember board']],
  ['yarn', 10, ['Stitched', 'Soft colours', 'Cosy']],
  ['neon-glass', 12, ['Glow', 'Bright colours', 'Best in dark']],
  ['clear-glass', 12, ['Icy glass', 'Marble tail', 'Clean']],
  ['pixel', 13, ['Retro steps', 'Hard shadow', 'Bold']],
  ['paper-craft', 14, ['Folded', 'Paper creases', 'Crafty']],
  ['stained-glass', 15, ['Lead lines', 'Jewel panes', 'Classic']],
  ['archery', 15, ['Feathered', 'Arrowhead', 'Sharp']],
  ['lava-rock', 15, ['Glowing cracks', 'Dark stone', 'Best in dark']],
  ['ink-pro', 15, ['Swept head', 'Ink', 'Best in light']],
];
const FREE = ['classic', 'sherbet', 'candy-gloss'];

const byId = new Map(ARROW_STYLES.map(style => [style.id, style]));
function skinEntry(id: string, pathCost: number | null, chips: readonly string[]): RewardEntry {
  const style = byId.get(id);
  if (!style) throw new Error(`rewardCatalogue: unknown skin ${id}`);
  return { rewardId: style.numericId, kind: 'skin', refId: id, name: style.name, pathCost, price: null, chips };
}

/** OWNER-APPROVED STARTING VALUES (book spec §2): price by path position. */
function priceForPosition(index: number): number { return index < 5 ? 10 : index < 10 ? 20 : 35; }

export const REWARD_PATH: readonly RewardEntry[] = PATH.map(([id, cost, chips], i) => ({ ...skinEntry(id, cost, chips), price: priceForPosition(i) }));
export const REWARD_PATH_IDS: readonly number[] = REWARD_PATH.map(e => e.rewardId);
/** OWNER-APPROVED (HALLOWEEN-01 brief): the Halloween window, inclusive, phone local time. */
export const HALLOWEEN: Season = validateSeason({ id: 'halloween', name: 'Halloween', start: '10-01', end: '11-07' });
const SEASONAL_PRICE = 20; // HALLOWEEN-01 brief: every seasonal style costs 20 petals
const SEASONAL: readonly (readonly [string, Season, readonly string[]])[] = [
  ['pumpkin', HALLOWEEN, ['Carved face', 'Soft ribs', 'Halloween']],
  ['ghost', HALLOWEEN, ['Sleepy face', 'Wavy edges', 'Halloween']],
  ['candy-corn', HALLOWEEN, ['Three bands', 'Sweet', 'Halloween']],
];
export const SEASONAL_REWARDS: readonly RewardEntry[] = SEASONAL.map(([id, season, chips]) =>
  ({ ...skinEntry(id, null, chips), price: SEASONAL_PRICE, season }));
export const SEASONAL_REWARD_IDS: readonly number[] = SEASONAL_REWARDS.map(e => e.rewardId);

/** Free styles, then path order, then seasonal styles. */
export const REWARD_CATALOGUE: readonly RewardEntry[] = [...FREE.map(id => skinEntry(id, null, [])), ...REWARD_PATH, ...SEASONAL_REWARDS];
export const FREE_REWARD_IDS: readonly number[] = FREE.map(id => byId.get(id)!.numericId);
export const PATH_TOTALS: readonly number[] = pathTotals(REWARD_PATH.map(e => e.pathCost!));

export function seasonFor(rewardId: number): Season | undefined {
  return SEASONAL_REWARDS.find(e => e.rewardId === rewardId)?.season;
}
/**
 * Whether a style may appear anywhere (pickers, book, counts). Ordinary styles always; a seasonal style only with
 * seasons on, and then for ever once owned, otherwise only inside its window. `owned` is passed in so UI callers and
 * the ledger share one rule.
 */
export function isStyleVisible(rewardId: number, owned: (id: number) => boolean, seasons: boolean, now: Date): boolean {
  const season = seasonFor(rewardId);
  return !season || (seasons && (owned(rewardId) || inSeason(season, now)));
}
/** "N of total" over the visible styles only (never a hard-coded count). */
export function visibleStyleCounts(owned: (id: number) => boolean, seasons: boolean, now: Date): { owned: number; total: number } {
  const visible = ARROW_STYLES.filter(s => isStyleVisible(s.numericId, owned, seasons, now));
  return { owned: visible.filter(s => owned(s.numericId)).length, total: visible.length };
}
export function rewardForSkin(numericId: number): RewardEntry | undefined {
  return REWARD_CATALOGUE.find(e => e.kind === 'skin' && e.rewardId === numericId);
}

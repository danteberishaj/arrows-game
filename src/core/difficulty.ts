/**
 * Endless difficulty schedule. Ported from Assets/_Game/Scripts/Core/Difficulty.cs.
 */
export enum Difficulty {
  Normal,
  Hard,
  SuperHard,
}

/** Tunable knobs for one difficulty tier. */
export interface DifficultyConfig {
  /** Board dimension (rows) range; cols follow the shape's aspect. */
  readonly minN: number;
  readonly maxN: number;
  /**
   * Arrow length range (cells). maxLen is kept SMALL on purpose: long arrows
   * are limited so the shape is drawn with many short, bendy pieces, not a
   * few long strokes.
   */
  readonly minLen: number;
  readonly maxLen: number;
  /** Chance a given arrow is allowed to bend at all (kept high so MOST arrows bend). */
  readonly bendArrowChance: number;
  /** Chance to take an allowed bend at each eligible step. */
  readonly bendChance: number;
  readonly hearts: number;
}

const CYCLE: readonly Difficulty[] = [
  Difficulty.Normal, Difficulty.Normal, Difficulty.Hard,
  Difficulty.Normal, Difficulty.Normal, Difficulty.SuperHard,
];

/**
 * Difficulty is a pure function of the level number: a repeating 6-level
 * cycle of Normal, Normal, Hard, Normal, Normal, SuperHard.
 */
export const Difficulties = {
  cycleLength: CYCLE.length,

  forLevel(index: number): Difficulty {
    const m = ((index % CYCLE.length) + CYCLE.length) % CYCLE.length; // safe for negatives
    return CYCLE[m];
  },

  config(d: Difficulty): DifficultyConfig {
    // N(min,max) board size, len(min,max) SHORT (long arrows limited), bendArrow (most
    // arrows bend), bend (chance to take the bend), hearts. Bigger boards + short bendy
    // arrows = more pieces and a harder puzzle at every tier. Boards are LARGE (and
    // arrows stay short, cap 6) so each level packs MANY pieces; the board auto-fits to
    // view and the player pinch-zooms, so size is free to grow.
    // Normal/Hard draw SIMPLE shapes (square/rect/circle); SuperHard draws COMPLEX silhouettes.
    switch (d) {
      case Difficulty.Hard:
        return { minN: 25, maxN: 29, minLen: 4, maxLen: 6, bendArrowChance: 0.95, bendChance: 0.96, hearts: 3 };
      case Difficulty.SuperHard:
        return { minN: 32, maxN: 38, minLen: 4, maxLen: 6, bendArrowChance: 0.97, bendChance: 0.97, hearts: 3 };
      case Difficulty.Normal:
      default:
        return { minN: 19, maxN: 23, minLen: 4, maxLen: 6, bendArrowChance: 0.93, bendChance: 0.95, hearts: 3 };
    }
  },

  displayName(d: Difficulty): string {
    switch (d) {
      case Difficulty.Hard: return 'Hard';
      case Difficulty.SuperHard: return 'Super Hard';
      default: return 'Normal';
    }
  },
};

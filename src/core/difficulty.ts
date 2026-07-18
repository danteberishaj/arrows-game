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
  /**
   * Target shape-cell range. The generator sizes the board so the SHAPE
   * holds about this many cells (probing each silhouette's fill density),
   * which keeps piece counts — and the on-screen path count — consistent
   * across dense squares and thin bolts alike. Arrows ≈ cells / 4.5.
   */
  readonly minCells: number;
  readonly maxCells: number;
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
    // cells(min,max) shape size, len(min,max) SHORT (long arrows limited), bendArrow
    // (most arrows bend), bend (chance to take the bend), hearts. Difficulty scales by
    // PIECE COUNT (cells / ~4.5 ≈ arrows), tier by tier: even Normal is meaty,
    // SuperHard is brutal — but capped so mid-range phones never draw 300 paths.
    // Normal draws plain fills, Hard geometric figures, SuperHard picture-book
    // silhouettes (see ShapeLibrary pools).
    switch (d) {
      case Difficulty.Hard:
        return { minCells: 420, maxCells: 580, minLen: 4, maxLen: 6, bendArrowChance: 0.95, bendChance: 0.96, hearts: 3 };
      case Difficulty.SuperHard:
        return { minCells: 560, maxCells: 720, minLen: 4, maxLen: 6, bendArrowChance: 0.97, bendChance: 0.97, hearts: 3 };
      case Difficulty.Normal:
      default:
        return { minCells: 260, maxCells: 400, minLen: 4, maxLen: 6, bendArrowChance: 0.93, bendChance: 0.95, hearts: 3 };
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

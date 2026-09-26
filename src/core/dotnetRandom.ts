/**
 * Port of .NET's seeded System.Random (Knuth subtractive generator), as used
 * by Unity's Mono runtime for `new Random(seed)`. Level generation is a pure
 * function of the level index in the Unity build; using the same RNG here
 * keeps "level N" reproducible and as close to the Unity levels as
 * float/double differences allow.
 *
 * FROZEN, and exact only for |seed| <= MSEED (161803398). For those seeds
 * every intermediate value stays in [0, 2^31), so plain JS number arithmetic
 * reproduces the C# int math. A larger seed makes .NET's int subtractions
 * overflow and wrap inside the seeding (W3-10 concern 1): this class does not
 * wrap, its state leaves [0, MBIG), and draws from the third on can leave
 * [0, 1). v1 boards and the daily are dealt with it and are pinned by golden
 * fingerprints (d01abbd8, ff12d7b5), so it must never be "fixed". New
 * consumers use `ExactDotNetRandom` (generator v2, V2-FINISH).
 */
const MBIG = 2147483647;
const MSEED = 161803398;

/** The draws level generation takes: `DotNetRandom` (v1, the daily) or `ExactDotNetRandom` (v2). */
export interface LevelRng {
  /** Random double in [0, 1) for an exact stream: C# `Random.NextDouble()`. */
  nextDouble(): number;
  /** C# `Random.Next(max)` / `Random.Next(min, max)` for ranges that fit an int. */
  next(a: number, b?: number): number;
}

export class DotNetRandom implements LevelRng {
  private readonly seedArray: number[] = new Array(56).fill(0);
  private inext = 0;
  private inextp = 21;

  constructor(seed: number) {
    seed |= 0; // int32, like the C# parameter
    const subtraction = seed === -2147483648 ? 2147483647 : Math.abs(seed);
    let mj = MSEED - subtraction;
    this.seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += MBIG;
      mj = this.seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this.seedArray[i] -= this.seedArray[1 + ((i + 30) % 55)];
        if (this.seedArray[i] < 0) this.seedArray[i] += MBIG;
      }
    }
  }

  private internalSample(): number {
    let locINext = this.inext + 1;
    if (locINext >= 56) locINext = 1;
    let locINextp = this.inextp + 1;
    if (locINextp >= 56) locINextp = 1;

    let retVal = this.seedArray[locINext] - this.seedArray[locINextp];
    if (retVal === MBIG) retVal--;
    if (retVal < 0) retVal += MBIG;

    this.seedArray[locINext] = retVal;
    this.inext = locINext;
    this.inextp = locINextp;
    return retVal;
  }

  /** Random double in [0, 1) — C# Random.NextDouble(). */
  nextDouble(): number {
    return this.internalSample() * (1.0 / MBIG);
  }

  /**
   * C# Random.Next overloads: next(max) → [0, max); next(min, max) → [min, max).
   */
  next(a: number, b?: number): number {
    if (b === undefined) return Math.trunc(this.nextDouble() * a);
    return Math.trunc(this.nextDouble() * (b - a)) + a;
  }
}

/**
 * V2-FINISH: .NET's seeded System.Random exactly, for every int32 seed. The
 * algorithm is `DotNetRandom`'s line for line; the difference is C#'s
 * unchecked int32 arithmetic: the state is an Int32Array (a store wraps
 * modulo 2^32 exactly like a C# `int` assignment) and every local
 * subtraction is `| 0`. For |seed| <= MSEED nothing overflows, so it draws
 * the same stream as `DotNetRandom`; above it, it draws what .NET draws
 * (`__tests__/dotnetRandom.test.ts` checks it against a BigInt transcription
 * of the .NET source), and every seeded state lies in [0, MBIG), so every
 * draw is in [0, 1) (scanned over 1,000,000 v2 seeds by
 * `scripts/analysis/rng-exactness.ts`).
 *
 * Generator v2 draws only from this: the level stream (`generateV2`, its
 * target, `fillMask` and the clearable-bias pick) and the shape bag's
 * shuffle. v1 and the daily keep the frozen `DotNetRandom`.
 */
export class ExactDotNetRandom implements LevelRng {
  private readonly seedArray = new Int32Array(56);
  private inext = 0;
  private inextp = 21;

  constructor(seed: number) {
    seed |= 0; // int32, like the C# parameter
    const subtraction = seed === -2147483648 ? 2147483647 : Math.abs(seed);
    let mj = (MSEED - subtraction) | 0;
    this.seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk = (mk + MBIG) | 0;
      mj = this.seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        let v = (this.seedArray[i] - this.seedArray[1 + ((i + 30) % 55)]) | 0;
        if (v < 0) v = (v + MBIG) | 0;
        this.seedArray[i] = v;
      }
    }
  }

  private internalSample(): number {
    let locINext = this.inext + 1;
    if (locINext >= 56) locINext = 1;
    let locINextp = this.inextp + 1;
    if (locINextp >= 56) locINextp = 1;

    let retVal = (this.seedArray[locINext] - this.seedArray[locINextp]) | 0;
    if (retVal === MBIG) retVal--;
    if (retVal < 0) retVal = (retVal + MBIG) | 0;

    this.seedArray[locINext] = retVal;
    this.inext = locINext;
    this.inextp = locINextp;
    return retVal;
  }

  /** Random double in [0, 1): C# Random.NextDouble(). */
  nextDouble(): number {
    return this.internalSample() * (1.0 / MBIG);
  }

  /** C# Random.Next overloads: next(max) -> [0, max); next(min, max) -> [min, max). */
  next(a: number, b?: number): number {
    if (b === undefined) return Math.trunc(this.nextDouble() * a);
    return Math.trunc(this.nextDouble() * (b - a)) + a;
  }

  /** The seeded state SeedArray[1..55] (a copy), for the range proof in tests and the scan script. */
  stateForRangeCheck(): readonly number[] {
    return Array.from(this.seedArray.subarray(1));
  }
}

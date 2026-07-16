/**
 * Faithful port of .NET's seeded System.Random (Knuth subtractive generator),
 * as used by Unity's Mono runtime for `new Random(seed)`. Level generation is
 * a pure function of the level index in the Unity build; using the same RNG
 * here keeps "level N" reproducible and as close to the Unity levels as
 * float/double differences allow.
 *
 * All intermediate values stay well inside 2^31, so plain JS number
 * arithmetic reproduces the C# int math exactly.
 */
const MBIG = 2147483647;
const MSEED = 161803398;

export class DotNetRandom {
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

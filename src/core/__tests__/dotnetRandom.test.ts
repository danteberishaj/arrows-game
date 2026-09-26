import { Difficulties } from '../difficulty';
import { DotNetRandom, ExactDotNetRandom } from '../dotnetRandom';
import { LevelGenerator, seed } from '../levelGenerator';
import { bagSeed, bagWindowFor } from '../shapeBag';

// V2-FINISH part 2: an exact int32 RNG for generator v2 (W3-10 concern 1).
//
// The reference below is a literal transcription of .NET's seeded
// System.Random (the .NET Framework reference source `Random(int Seed)`,
// `InternalSample()`, `Sample()` and `Next(int, int)`; .NET Core keeps it as
// the seeded `Net5CompatSeedImpl`, Unity's Mono uses the same algorithm). C#
// compiles `int` arithmetic unchecked, so every `+` and `-` on an `int`
// wraps modulo 2^32; here that is modelled explicitly with
// `BigInt.asIntN(32, ...)` after every one of them, which shares no code
// with either JS class. Reference values are derived by running that
// transcription, no .NET needed.

const MBIG = 2147483647n;
const MSEED = 161803398n;
const I32 = (x: bigint): bigint => BigInt.asIntN(32, x);

class ReferenceNetRandom {
  private readonly seedArray: bigint[] = new Array<bigint>(56).fill(0n);
  private inext = 0;
  private inextp = 21;

  constructor(seedValue: number) {
    const Seed = BigInt(seedValue | 0);
    // int subtraction = (Seed == Int32.MinValue) ? Int32.MaxValue : Math.Abs(Seed);
    const subtraction = Seed === -2147483648n ? 2147483647n : Seed < 0n ? -Seed : Seed;
    let mj = I32(MSEED - subtraction); // mj = MSEED - subtraction;
    this.seedArray[55] = mj;
    let mk = 1n;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = I32(mj - mk); // mk = mj - mk;
      if (mk < 0n) mk = I32(mk + MBIG); // if (mk<0) mk+=MBIG;
      mj = this.seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        // SeedArray[i] -= SeedArray[1+(i+30)%55];
        this.seedArray[i] = I32(this.seedArray[i] - this.seedArray[1 + ((i + 30) % 55)]);
        if (this.seedArray[i] < 0n) this.seedArray[i] = I32(this.seedArray[i] + MBIG);
      }
    }
  }

  /** The state after seeding, for the range proof. */
  state(): readonly bigint[] {
    return this.seedArray.slice(1);
  }

  internalSample(): bigint {
    let locINext = this.inext + 1;
    if (locINext >= 56) locINext = 1;
    let locINextp = this.inextp + 1;
    if (locINextp >= 56) locINextp = 1;
    let retVal = I32(this.seedArray[locINext] - this.seedArray[locINextp]);
    if (retVal === MBIG) retVal = I32(retVal - 1n);
    if (retVal < 0n) retVal = I32(retVal + MBIG);
    this.seedArray[locINext] = retVal;
    this.inext = locINext;
    this.inextp = locINextp;
    return retVal;
  }

  /** Sample(): InternalSample() * (1.0/MBIG). */
  nextDouble(): number {
    return Number(this.internalSample()) * (1.0 / Number(MBIG));
  }

  /** Next(minValue, maxValue) for a range that fits an int: (int)(Sample() * range) + minValue. */
  next(minValue: number, maxValue: number): number {
    return Math.trunc(this.nextDouble() * (maxValue - minValue)) + minValue;
  }
}

/** A deterministic spread of int32 seeds (an LCG), so the sample is not hand-picked. */
function lcgSeeds(n: number): number[] {
  const out: number[] = [];
  let x = 0x2545f491;
  for (let k = 0; k < n; k++) {
    x = (Math.imul(x, 1664525) + 1013904223) | 0;
    out.push(x);
  }
  return out;
}

const EDGE_SEEDS = [
  0, 1, -1, 42, 12345,
  161803397, 161803398, 161803399, -161803398, -161803399, // around MSEED
  1_000_000_000, -1_000_000_000,
  2147483647, -2147483647, -2147483648, // int32 edges (MinValue has its own branch)
];

describe('V2-FINISH part 2 (a): ExactDotNetRandom is .NET System.Random, including |seed| > MSEED', () => {
  test('the transcription reproduces the in-range stream the port already had (seed 0: 0.7262432699679598, ...)', () => {
    // For |seed| <= MSEED no int subtraction can overflow (every state value
    // stays in [0, MBIG), see the range proof below), so the legacy port, the
    // exact class and the reference must agree. The first five doubles of
    // seed 0, derived by running the reference:
    const want = [0.7262432699679598, 0.8173253595909687, 0.7680226893946634, 0.5581611914365372, 0.2060331540210327];
    for (const make of [(s: number) => new ReferenceNetRandom(s), (s: number) => new ExactDotNetRandom(s), (s: number) => new DotNetRandom(s)]) {
      const r = make(0);
      expect(want.map(() => r.nextDouble())).toEqual(want);
    }
  });

  test('a hand-checked overflow: seed 2147483647 (Int32.MaxValue)', () => {
    // mj = MSEED - 2147483647 = -1985680249 is SeedArray[55]. In the first
    // mixing pass, i = 24 subtracts SeedArray[1 + (24 + 30) % 55] =
    // SeedArray[55], i.e. ADDS 1985680249 to a value in [0, MBIG). C# wraps
    // that sum past 2^31 - 1; the legacy JS port keeps the large positive
    // number, and its later draws leave [0, 1).
    const ref = new ReferenceNetRandom(2147483647);
    const exact = new ExactDotNetRandom(2147483647);
    const legacy = new DotNetRandom(2147483647);
    const refDraws = Array.from({ length: 60 }, () => ref.nextDouble());
    expect(Array.from({ length: 60 }, () => exact.nextDouble())).toEqual(refDraws);
    const legacyDraws = Array.from({ length: 60 }, () => legacy.nextDouble());
    expect(legacyDraws).not.toEqual(refDraws); // positive control: the defect is real for this seed
    expect(refDraws.every((u) => u >= 0 && u < 1)).toBe(true);
  });

  test('every draw equals the reference for edge seeds, 2000 v2 campaign seeds, 2000 bag seeds and 2000 spread seeds (200 draws each)', () => {
    const seeds = [
      ...EDGE_SEEDS,
      ...Array.from({ length: 2000 }, (_, k) => seed(k * 37)),
      ...Array.from({ length: 2000 }, (_, k) => bagSeed(k)),
      ...lcgSeeds(2000),
    ];
    let aboveMseed = 0;
    let legacyDiffers = 0;
    const bad: string[] = [];
    for (const s of seeds) {
      if (Math.abs(s) > 161803398) aboveMseed++;
      const ref = new ReferenceNetRandom(s);
      const exact = new ExactDotNetRandom(s);
      const legacy = new DotNetRandom(s);
      let differs = false;
      for (let d = 0; d < 200; d++) {
        // Interleave the two entry points v2 uses: nextDouble and next(min, max).
        const want = d % 3 === 2 ? ref.next(4, 7) : ref.nextDouble();
        const got = d % 3 === 2 ? exact.next(4, 7) : exact.nextDouble();
        const old = d % 3 === 2 ? legacy.next(4, 7) : legacy.nextDouble();
        if (got !== want) { bad.push(`seed ${s} draw ${d}: ${got} != ${want}`); break; }
        if (old !== want) differs = true;
      }
      if (differs) legacyDiffers++;
    }
    expect(bad).toEqual([]);
    // The sample does exercise the overflow: most seeds are above MSEED, and
    // the legacy port leaves the reference on a share of them.
    expect(aboveMseed).toBeGreaterThan(3000);
    expect(legacyDiffers).toBeGreaterThan(500);
  });

  test('for |seed| <= MSEED the exact class and the legacy port are the same stream (why the bag order does not move)', () => {
    for (const s of [...Array.from({ length: 3000 }, (_, k) => bagSeed(k)), 0, 161803398, -161803398]) {
      const a = new ExactDotNetRandom(s);
      const b = new DotNetRandom(s);
      for (let d = 0; d < 60; d++) {
        const x = a.nextDouble();
        const y = b.nextDouble();
        if (x !== y) throw new Error(`seed ${s} draw ${d}: ${x} != ${y}`);
      }
    }
  });
});

describe('V2-FINISH part 2 (b): no v2 draw leaves [0, 1)', () => {
  test('range proof: after seeding, every state value of every v2 campaign seed 0-199,999 is in [0, MBIG), so every later draw is in [0, 1)', () => {
    // InternalSample subtracts two values in [0, MBIG): the difference is in
    // (-MBIG, MBIG), never MBIG, and a negative one gains MBIG, so the new
    // value is again in [0, MBIG) and the draw value / MBIG is in [0, 1). By
    // induction a seeded state inside [0, MBIG) draws inside [0, 1) forever.
    // The 1,000,000-seed x 50-draw scan is scripts/analysis/rng-exactness.ts.
    let outside = 0;
    for (let i = 0; i < 200_000; i++) {
      const r = new ExactDotNetRandom(seed(i));
      for (const v of r.stateForRangeCheck()) if (v < 0 || v >= 2147483647) outside++;
    }
    expect(outside).toBe(0);
  });

  test('the same scan over the legacy port finds seeds whose state leaves the range (the check can fail)', () => {
    let seedsOutside = 0;
    for (let i = 0; i < 2000; i++) {
      const r = new DotNetRandom(seed(i)) as unknown as { seedArray: number[] };
      if (r.seedArray.slice(1).some((v) => v < 0 || v >= 2147483647)) seedsOutside++;
    }
    expect(seedsOutside).toBeGreaterThan(100);
  });

  test('the exact class reports the same state as the reference', () => {
    for (const s of [...EDGE_SEEDS, ...lcgSeeds(200)]) {
      const exact = [...new ExactDotNetRandom(s).stateForRangeCheck()];
      const ref = new ReferenceNetRandom(s).state().map((v) => Number(v));
      expect([s, exact]).toEqual([s, ref]);
    }
  });
});

describe('V2-FINISH part 2 (c): v2 draws from the exact RNG; v1 and the daily keep the port', () => {
  /**
   * Level indices whose campaign seed makes the legacy port draw outside
   * [0, 1) within 100 draws. (Most divergent streams only differ from .NET
   * by a few units in 2^31, which rarely changes a pick; an out-of-range draw
   * does.)
   */
  function divergentLevels(count: number): number[] {
    const out: number[] = [];
    for (let i = 0; out.length < count && i < 5000; i++) {
      const b = new DotNetRandom(seed(i));
      for (let d = 0; d < 100; d++) {
        const u = b.nextDouble();
        if (u < 0 || u >= 1) { out.push(i); break; }
      }
    }
    return out;
  }

  test('generate(i, 2) (target, fillMask and the bias pick) is exactly a rebuild from ExactDotNetRandom(seed(i)), fresh and floored', () => {
    const levels = [0, 1, 2, 5, ...divergentLevels(12)];
    let legacyWouldDiffer = 0;
    for (const i of levels) {
      for (const switchLevel of [0, 1]) {
        const lvl = LevelGenerator.generate(i, 2, { switchLevel });
        const cfg = Difficulties.configV2(lvl.difficulty, i, undefined, switchLevel > 0);
        const rebuild = (rng: ExactDotNetRandom | DotNetRandom) => {
          expect(rng.next(cfg.minCells, cfg.maxCells + 1)).toBe(lvl.targetCells); // the first draw is the target
          return LevelGenerator.fillMask(lvl.mask, lvl.board.rows, lvl.board.cols, cfg, rng).map((a) => a.toLine());
        };
        const lines = lvl.board.arrows().map((a) => a.toLine());
        expect([i, switchLevel, rebuild(new ExactDotNetRandom(seed(i)))]).toEqual([i, switchLevel, lines]);
        if (rebuild(new DotNetRandom(seed(i))).join('\n') !== lines.join('\n')) legacyWouldDiffer++;
      }
    }
    // Positive control: on the divergent seeds the legacy stream deals different boards.
    expect(legacyWouldDiffer).toBeGreaterThan(10);
  });

  test('the bag shuffles with ExactDotNetRandom(bagSeed(ordinal)) (identical to the port there: bag seeds are <= MSEED)', () => {
    for (let start = 0; start < 3000;) {
      const w = bagWindowFor(start);
      const rng = new ExactDotNetRandom(bagSeed(w.ordinal));
      const draws = [];
      for (let k = w.order.length - 1; k > 0; k--) draws.push(rng.next(k + 1));
      expect(draws.every((j, n) => j >= 0 && j <= w.order.length - 1 - n)).toBe(true);
      start = w.start + w.order.length;
    }
  });
});


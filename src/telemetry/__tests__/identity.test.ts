import { ensureIdentity, nextSessionIndex, bucketOf, IdentityStore } from '../identity';

/** A plain in-memory double for IdentityStore — not SaveSystem's internal
 * MemoryStore (which is unexported and int-keyed), just the three fields
 * this module touches. */
class MemoryStore implements IdentityStore {
  telInstallHi = 0;
  telInstallLo = 0;
  telSessionCount = 0;
  setTelInstallHi(value: number): void {
    this.telInstallHi = value;
  }
  setTelInstallLo(value: number): void {
    this.telInstallLo = value;
  }
  setTelSessionCount(value: number): void {
    this.telSessionCount = value;
  }
}

describe('ensureIdentity', () => {
  test('a fresh store yields non-zero hi and lo', () => {
    const store = new MemoryStore();
    const { hi, lo } = ensureIdentity(store, () => 0.5);
    expect(hi).not.toBe(0);
    expect(lo).not.toBe(0);
    expect(store.telInstallHi).toBe(hi);
    expect(store.telInstallLo).toBe(lo);
  });

  // TDD: written first, against the not-yet-existing module (see RED evidence
  // in the report) — this is the property that makes the id stable across
  // cold starts instead of rerolling every launch.
  test('a second call returns the same pair and does not call random', () => {
    const store = new MemoryStore();
    const random = jest.fn(() => 0.5);
    const first = ensureIdentity(store, random);
    random.mockClear();

    const second = ensureIdentity(store, random);

    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
  });

  test('two fresh stores with different seeded random return different pairs', () => {
    const a = ensureIdentity(new MemoryStore(), () => 0.1);
    const b = ensureIdentity(new MemoryStore(), () => 0.9);
    expect(a).not.toEqual(b);
  });

  test('random returning 0 still yields a non-zero half', () => {
    const store = new MemoryStore();
    const { hi, lo } = ensureIdentity(store, () => 0);
    expect(hi).toBeGreaterThan(0);
    expect(lo).toBeGreaterThan(0);
  });

  test('fills in only the missing half when one is already set', () => {
    const store = new MemoryStore();
    store.telInstallHi = 42;
    const random = jest.fn(() => 0.5);
    const { hi, lo } = ensureIdentity(store, random);
    expect(hi).toBe(42);
    expect(lo).not.toBe(0);
    expect(random).toHaveBeenCalledTimes(1);
  });
});

describe('nextSessionIndex', () => {
  test('returns 1, 2, 3 across three calls on one store', () => {
    const store = new MemoryStore();
    expect(nextSessionIndex(store)).toBe(1);
    expect(nextSessionIndex(store)).toBe(2);
    expect(nextSessionIndex(store)).toBe(3);
  });
});

describe('bucketOf', () => {
  test('is deterministic and lies in 0..buckets-1 for 10,000 random pairs', () => {
    const buckets = 100;
    for (let i = 0; i < 10000; i++) {
      const hi = Math.floor(Math.random() * 2 ** 31);
      const lo = Math.floor(Math.random() * 2 ** 31);
      const first = bucketOf(hi, lo, buckets);
      const second = bucketOf(hi, lo, buckets);
      expect(second).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(buckets);
    }
  });

  test('defaults buckets to DEFAULT_BUCKETS (100)', () => {
    expect(bucketOf(1, 2)).toBe(bucketOf(1, 2, 100));
  });
});

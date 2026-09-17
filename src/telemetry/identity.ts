/**
 * Anonymous per-install identity, packed into P-01's int keys
 * (`arrows_tel_install_hi`, `arrows_tel_install_lo`, `arrows_tel_session_count`)
 * instead of the draft's separate `arrows_tel_` string/UUID namespace — see
 * docs/telemetry-identity.md for why that draft was rejected.
 *
 * Nothing here sends anything anywhere. W6-14 is the first module that reads
 * these values off SaveSystem and attaches them to an outgoing event, and
 * even then the transport ships with its endpoint flag OFF until W6-15.
 */
import { fnv1a32 } from './hash';

/**
 * The subset of SaveSystem's telemetry-identity accessors this module needs.
 * Production code passes `SaveSystem` itself (it has these members); tests
 * pass a plain in-memory double instead, without touching AsyncStorage or
 * the real key registry.
 */
export interface IdentityStore {
  readonly telInstallHi: number;
  readonly telInstallLo: number;
  setTelInstallHi(value: number): void;
  setTelInstallLo(value: number): void;
  readonly telSessionCount: number;
  setTelSessionCount(value: number): void;
}

/** OWNER-PICKED STARTING VALUE: how many cohorts `bucketOf` hashes an
 * install into. Nothing consumes a bucket yet (W6-06+ does). */
export const DEFAULT_BUCKETS = 100;

/** An integer in 1..2^31-1: never 0, because 0 means "not generated yet" on
 * the stored key, and it fits the int store's round-trip with room to spare. */
function randomHalf(random: () => number): number {
  return Math.floor(random() * (2 ** 31 - 1)) + 1;
}

/**
 * Fills in whichever half of the install id is still 0 (a fresh store has
 * both at 0) and returns the pair, writing any newly generated half through
 * the store's setters. A store whose halves are already both non-zero never
 * calls `random` at all — the id is generated once per install and simply
 * read back on every later cold start.
 */
export function ensureIdentity(
  store: IdentityStore,
  random: () => number = Math.random
): { hi: number; lo: number } {
  let hi = store.telInstallHi;
  if (hi === 0) {
    hi = randomHalf(random);
    store.setTelInstallHi(hi);
  }
  let lo = store.telInstallLo;
  if (lo === 0) {
    lo = randomHalf(random);
    store.setTelInstallLo(lo);
  }
  return { hi, lo };
}

/**
 * Increments and returns the cold-start counter (1 on the very first call
 * ever made against a store). Call once per app launch, after
 * `ensureIdentity` — App.tsx already skips this whole path under PERF_MODE.
 */
export function nextSessionIndex(store: IdentityStore): number {
  const next = store.telSessionCount + 1;
  store.setTelSessionCount(next);
  return next;
}

/**
 * Deterministic FNV-1a bucket assignment over the install id, so a cohort
 * split is stable per install without persisting anything beyond the id
 * itself. `buckets` is a parameter (default DEFAULT_BUCKETS) so a future
 * consumer can size its own experiment.
 */
export function bucketOf(hi: number, lo: number, buckets: number = DEFAULT_BUCKETS): number {
  return fnv1a32(`${hi}:${lo}`) % buckets;
}

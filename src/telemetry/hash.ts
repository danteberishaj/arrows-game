/**
 * FNV-1a, 32-bit. Used for the `error` event's `nameMessageHash` (so raw
 * error text, which can contain user-entered strings or stack fragments,
 * never leaves the device) and for the session `bucket` id.
 *
 * Test vectors (published FNV-1a-32 reference values):
 *   fnv1a32('')  === 2166136261
 *   fnv1a32('a') === 3826002220
 */
export function fnv1a32(input: string): number {
  const FNV_OFFSET_BASIS = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Math.imul returns a signed 32-bit int; the hash is defined as unsigned.
  return hash >>> 0;
}

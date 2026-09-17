/**
 * W6-02: whether a remote kill blocks an ad format. Pure TS, so the whole
 * bit table is unit-tested in node; ads.tsx calls it at every ad decision.
 *
 * Bit 0 (all ads) blocks both formats. Bit 1 blocks interstitials only, bit 2
 * rewarded only. Bit 3 (telemetry) never affects ads. Malformed bits (not a
 * non-negative integer) read as "allowed": the gate can only ever take an ad
 * away, and a corrupt value is not a kill.
 */
import { KillBit } from '../config/remoteConfig';

export type AdFormat = 'interstitial' | 'rewarded';

export function adDecision(format: AdFormat, killBits: number): 'allowed' | 'killed' {
  if (!Number.isSafeInteger(killBits) || killBits < 0) return 'allowed';
  const mask = KillBit.ads | (format === 'interstitial' ? KillBit.interstitials : KillBit.rewarded);
  return (killBits & mask) !== 0 ? 'killed' : 'allowed';
}

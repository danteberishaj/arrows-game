/**
 * W1-11 (owner answers 2026-10-06, docs/owner-rulings-2026-10-06.md Q2): the tutorial is ON in every build.
 * EXPO_PUBLIC_FTUE=0 is the explicit opt-out (rollback without a code change). Existing players never see it:
 * ftueRoute sends any save with progress to 'real'.
 */
export const FTUE_ENABLED = process.env.EXPO_PUBLIC_FTUE !== '0';
/** Stays OFF until W3-17's joint re-measurement (ruling I-27; owner 2026-10-06 approved the rule as built). */
export const FTUE_ASSIST_ENABLED = process.env.EXPO_PUBLIC_FTUE_ASSIST === '1';
/** Owner 2026-10-06: OFF; no delay picked (W3-17 can supply real stall times). */
export const FTUE_STALL_HINT_ENABLED =
  process.env.EXPO_PUBLIC_FTUE_STALL_HINT === '1';
export const FTUE_STALL_HINT_MS: number | null = null;

import { CAPTURE_DIAG } from '../perfMode';

/**
 * W5-17: what is left of the outline's delay when its node mounts. The delay is counted from the clearing tap
 * (`atMs`, the same instant GameScreen starts the panel's timer), so a busy JS thread that mounts the node late does not
 * push the outline later and squeeze its slot before the panel. Never negative.
 */
export function clearRevealRemainingMs(art: { delayMs: number; atMs: number }, now: number = Date.now()): number {
  const remaining = Math.max(0, art.delayMs - Math.max(0, now - art.atMs));
  // Capture builds only (EXPO_PUBLIC_CAPTURE_DIAG): how late the node mounted, for the W5-17 timing reconciliation.
  if (CAPTURE_DIAG) console.log(`[capture-diag] reveal mount +${Math.round(now - art.atMs)}ms remaining=${Math.round(remaining)}ms`);
  return remaining;
}

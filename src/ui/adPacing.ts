/**
 * Interstitial pacing rules (W0-05). Pure: no storage, no SDK.
 *
 * The counter is the number of finished games (wins and losses) since the
 * last interstitial that was actually displayed. It is persisted through
 * SaveSystem (`arrows_finished_games`) so a cold start does not reset it.
 */

/** An interstitial is due once `finished` reaches `perInterstitial`. */
export function isInterstitialDue(finished: number, perInterstitial: number): boolean {
  return finished >= perInterstitial;
}

/**
 * Clamps a raw stored counter to a non-negative integer. Anything that is not
 * a finite number (a corrupt or foreign value) reads as 0; a fraction is
 * truncated; a negative value reads as 0.
 */
export function sanitizeCounter(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.trunc(raw));
}

/** The counter value after an interstitial was displayed. */
export function afterDisplayed(): number {
  return 0;
}

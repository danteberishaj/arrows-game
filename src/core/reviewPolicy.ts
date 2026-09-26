/**
 * W4-11: whether a clear may spend one of the player's store-review asks.
 *
 * Pure: every input is passed in (GameScreen reads SaveSystem and its own
 * refs), so this module never reads storage, the clock or the platform.
 *
 * Why the gates are this strict:
 * - Apple shows the system prompt at most 3 times per app per 365 days and
 *   lets people turn prompts off; Google Play applies an undisclosed,
 *   time-bound quota and silently shows nothing once it is spent. A request
 *   the OS swallowed still counts here, so every "yes" is a real cost.
 * - Both stores want the ask after real engagement and at a natural pause,
 *   never pre-gated on the player's opinion and never rewarded. The only
 *   signal used is a clean (perfect) clear, which says nothing about how the
 *   player feels and asks nothing of them.
 *
 * Each picked number is an OWNER-PICKED STARTING VALUE (progress.md ruling
 * W4-9). REVIEW_MIN_SOLVES is to be re-derived from W6's per-level aggregate
 * once real data exists.
 */

/** Total solves (this clear included) before the first ask. */
export const REVIEW_MIN_SOLVES = 25; // OWNER-PICKED STARTING VALUE
/** Asks over the install's lifetime; stricter than Apple's 3 per 365 days. */
export const REVIEW_LIFETIME_MAX = 3; // OWNER-PICKED STARTING VALUE
/** Local days between two asks. */
export const REVIEW_MIN_GAP_DAYS = 90; // OWNER-PICKED STARTING VALUE

export interface ReviewPolicyInput {
  /** No heart lost on this board (a continued clear has 1 heart: never perfect). */
  readonly perfect: boolean;
  /** `SaveSystem.ftueStage === 2` when the board cleared (W1-06's free blocked taps). */
  readonly assisted: boolean;
  /** Lifetime solves, including this clear. */
  readonly totalSolved: number;
  /** `SaveSystem.today()`. */
  readonly today: number;
  /** `arrows_review_count`: asks made so far, raw. */
  readonly count: number;
  /** `arrows_review_last_day`: local day of the last ask, raw; 0 = never. */
  readonly lastDay: number;
  /** An ask was already attempted in this app process. */
  readonly askedThisSession: boolean;
}

export type ReviewDecline =
  | 'corrupt'
  | 'not_perfect'
  | 'assisted'
  | 'asked_this_session'
  | 'too_few_solves'
  | 'lifetime_cap'
  | 'clock_moved_back'
  | 'too_soon';

const isDayOrCount = (v: number) => Number.isSafeInteger(v) && v >= 0;

/**
 * The first gate that says no, or null when the ask is allowed. Corrupt
 * stored values fail closed: a finite quota is never spent on a guess.
 */
export function reviewDeclineReason(input: ReviewPolicyInput): ReviewDecline | null {
  const { count, lastDay, today } = input;
  if (!isDayOrCount(count) || !isDayOrCount(lastDay) || !Number.isSafeInteger(today)) return 'corrupt';
  if (!input.perfect) return 'not_perfect';
  if (input.assisted) return 'assisted';
  if (input.askedThisSession) return 'asked_this_session';
  if (input.totalSolved < REVIEW_MIN_SOLVES) return 'too_few_solves';
  if (count >= REVIEW_LIFETIME_MAX) return 'lifetime_cap';
  if (lastDay !== 0) {
    // P-01 row 19: a last ask after today (clock moved back, or an Auto Backup
    // restore from a device whose clock ran ahead) suppresses the prompt.
    if (today - lastDay < 0) return 'clock_moved_back';
    if (today - lastDay < REVIEW_MIN_GAP_DAYS) return 'too_soon';
  }
  return null;
}

/** True only when every gate holds; see reviewDeclineReason. */
export function shouldRequestReview(input: ReviewPolicyInput): boolean {
  return reviewDeclineReason(input) === null;
}

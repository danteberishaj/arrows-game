/**
 * W2-07 (META_HEART_REFILL_POP): which pop one header heart pip plays when its
 * props change. Pure, so the rule is unit-tested in node
 * (src/ui/__tests__/heartPip.test.ts); GameScreen's HeartPip applies it.
 *
 * - 'loss': the pip went from filled to spent (the shipped pop: overshoot to
 *   HEART_PIP_LOSS_START_SCALE and spring back).
 * - 'refill': the pip turned filled AND the refill token changed with it. The
 *   token is bumped only by an earned rewarded continue, so a Retry after a loss
 *   or a Next after a lossy win (loadSession resets the hearts; the pips are
 *   keyed by index and never remounted) plays nothing.
 * - 'none': everything else, including the first render.
 */
export type PipPopKind = 'loss' | 'refill' | 'none';

/** The shipped loss overshoot. */
export const HEART_PIP_LOSS_START_SCALE = 1.35;

/**
 * A refill starts below rest and springs up to 1, so gaining a heart reads
 * differently from losing one: the mirror of the loss overshoot.
 */
export const HEART_PIP_REFILL_START_SCALE = 1 / HEART_PIP_LOSS_START_SCALE; // OWNER-PICKED STARTING VALUE (≈ 0.74)

export function pipPopKind(
  prevFilled: boolean,
  filled: boolean,
  prevRefillToken: number,
  refillToken: number,
): PipPopKind {
  if (prevFilled && !filled) return 'loss';
  if (!prevFilled && filled && refillToken !== prevRefillToken) return 'refill';
  return 'none';
}

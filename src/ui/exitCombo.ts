/**
 * Consecutive-exit ladder. Each successful tap inside the window climbs one
 * step; the step picks the exit pop's pitch (pop0..pop7, a major-pentatonic
 * ladder rendered by scripts/generate-sfx.js) and scales the exit haptic on
 * iOS. A pause, a blocked tap, or a new level resets it. The same idea as
 * Peggle's rising peg notes: the sound tells you that you are on a roll.
 */
export const EXIT_COMBO_WINDOW_MS = 1200;
export const EXIT_COMBO_STEPS = 8;
/** Set false to play the same pitch on every exit (random variation only). */
export const EXIT_COMBO_ESCALATES = true;

export interface ExitCombo {
  /** 0..EXIT_COMBO_STEPS-1 */
  step: number;
  /** Timestamp (ms) of the exit that produced this step. */
  at: number;
}

export function nextExitCombo(previous: ExitCombo | null, now: number): ExitCombo {
  if (
    !EXIT_COMBO_ESCALATES ||
    previous === null ||
    now < previous.at ||
    now - previous.at > EXIT_COMBO_WINDOW_MS
  ) {
    return { step: 0, at: now };
  }
  return { step: Math.min(EXIT_COMBO_STEPS - 1, previous.step + 1), at: now };
}

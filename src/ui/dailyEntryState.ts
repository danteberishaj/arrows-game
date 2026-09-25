/**
 * W4-06: what the menu's "Today's board" entry shows. Pure (no SaveSystem, no
 * React), so the day arithmetic is unit-tested in the node project.
 *
 * - `hidden` before the first solve, like the stats line, so the entry stays
 *   out of W1's first-run flow (ruling W4-7);
 * - `done` when today's board was already cleared (no replay, ruling W4-7);
 * - `available` otherwise, including a stored day AFTER today: Auto Backup can
 *   restore the key from a device whose clock ran ahead, or the clock moved
 *   back. Claiming "done" there would lock the player out of a board they
 *   never cleared.
 */
export type DailyEntryState = 'hidden' | 'available' | 'done';

export function dailyEntryState({
  today,
  dailyLastDay,
  totalSolved,
}: {
  /** SaveSystem.today(): local calendar days since 2020-01-01. */
  today: number;
  /** SaveSystem.dailyLastDay: the day of the last daily clear, 0 = never. */
  dailyLastDay: number;
  totalSolved: number;
}): DailyEntryState {
  if (!(totalSolved > 0)) return 'hidden';
  return dailyLastDay === today ? 'done' : 'available';
}

/** The menu entry's two labels (the done one is not pressable). */
export const DAILY_ENTRY_LABEL = "Today's board"; // OWNER-PICKED STARTING VALUE
export const DAILY_ENTRY_DONE_LABEL = "Today's board · done"; // OWNER-PICKED STARTING VALUE

/**
 * W4-13 (owner answer 2026-10-06, docs/owner-rulings-2026-10-06.md Q4: "yes, purple"): the daily win panel's share
 * card, as plain text for React Native's `Share.share({ message })`.
 *
 *   Arrows · 2026-10-06
 *   Pentagon
 *   Hearts left: 3/3
 *   Day streak: 7
 *
 *   ⬜⬜⬜⬜🟪🟪⬜⬜⬜⬜
 *   …
 *
 * The shape is the day's mask cropped to its filled cells and fitted inside a 10 x 10 box (W4-12's >= 50 % block
 * downsample; wide shapes keep 10 columns, tall ones 10 rows). No link (owner: not until the listing is public), no
 * level index, no name or device data: the date and shape are the same for every player that day, and the streak is
 * the one number the player chooses to send. Pure: no React Native import.
 */

export const SHARE_GLYPH_ON = '🟪'; // OWNER-PICKED 2026-10-06 (purple)
export const SHARE_GLYPH_OFF = '⬜'; // OWNER-PICKED 2026-10-06
/** The grid fits inside SHARE_BOX x SHARE_BOX squares (owner: "at most 10 by 10"). */
export const SHARE_BOX = 10; // OWNER-PICKED 2026-10-06
/**
 * Length ceiling in UTF-16 units: the measured worst case over days 0..3649 (261 with a 3-digit streak) plus room for
 * a 4-digit streak (rulings doc Q4 implementer note; RULING, not an owner number). Tested over 10 years of dailies.
 */
export const SHARE_CARD_MAX_LENGTH = 280;

/** Day numbers count local calendar days since 2020-01-01 (SaveSystem.today()); the card prints that day's date. */
const DAILY_EPOCH_MS = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;

export function dailyShareDate(day: number): string {
  return new Date(DAILY_EPOCH_MS + Math.trunc(day) * DAY_MS).toISOString().slice(0, 10);
}

/** The mask cropped to its filled cells and downsampled (>= 50 % of each source block filled) into the 10 x 10 box. */
export function shareGrid(mask: readonly (readonly boolean[])[], box: number = SHARE_BOX): boolean[][] {
  let r0 = Infinity;
  let r1 = -1;
  let c0 = Infinity;
  let c1 = -1;
  mask.forEach((row, r) => row.forEach((filled, c) => {
    if (!filled) return;
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }));
  if (r1 < 0) return [];
  const src = mask.slice(r0, r1 + 1).map((row) => row.slice(c0, c1 + 1));
  const H = src.length;
  const W = c1 - c0 + 1;
  const cols = W >= H ? Math.min(box, W) : Math.max(1, Math.round((Math.min(box, H) * W) / H));
  const rows = W >= H ? Math.max(1, Math.round((cols * H) / W)) : Math.min(box, H);
  const grid: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const rs = Math.floor((r * H) / rows);
    const re = Math.max(rs + 1, Math.floor(((r + 1) * H) / rows));
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const cs = Math.floor((c * W) / cols);
      const ce = Math.max(cs + 1, Math.floor(((c + 1) * W) / cols));
      let filled = 0;
      let total = 0;
      for (let rr = rs; rr < re; rr++) {
        for (let cc = cs; cc < ce; cc++) {
          total++;
          if (src[rr][cc] ?? false) filled++;
        }
      }
      row.push(filled / total >= 0.5);
    }
    grid.push(row);
  }
  return grid;
}

const count = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function buildDailyShareText({ day, mask, shapeName, heartsLeft, maxHearts, streak }: {
  day: number;
  mask: readonly (readonly boolean[])[];
  shapeName: string;
  heartsLeft: number;
  maxHearts: number;
  streak: number;
}): string {
  const header = [
    `Arrows · ${dailyShareDate(day)}`,
    shapeName,
    `Hearts left: ${count(heartsLeft)}/${count(maxHearts)}`,
    `Day streak: ${count(streak)}`,
  ].join('\n');
  const rows = shareGrid(mask).map((row) => row.map((filled) => (filled ? SHARE_GLYPH_ON : SHARE_GLYPH_OFF)).join(''));
  return rows.length === 0 ? header : `${header}\n\n${rows.join('\n')}`;
}

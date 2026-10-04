/**
 * Seasonal windows for book-only styles (HALLOWEEN-01). Pure: no React Native, no clock reads.
 * Callers pass the date; windows are whole local days, inclusive at both ends, and may wrap the year.
 */
export interface Season {
  id: string;
  name: string;
  /** 'MM-DD', inclusive. */
  start: string;
  /** 'MM-DD', inclusive. A window with start > end wraps the year (e.g. 12-01..01-15). */
  end: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function parse(value: string): { month: number; day: number } {
  const match = /^(\d\d)-(\d\d)$/.exec(value);
  const month = match ? Number(match[1]) : 0, day = match ? Number(match[2]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > DAYS[month - 1]) throw new Error(`season: invalid MM-DD ${value}`);
  return { month, day };
}
const key = ({ month, day }: { month: number; day: number }) => month * 100 + day;

/** Throws on a malformed window; used once per catalogue entry at module load. */
export function validateSeason(season: Season): Season { parse(season.start); parse(season.end); return season; }

/** True when `now`'s local calendar day lies inside the window (inclusive). */
export function inSeason(season: Season, now: Date): boolean {
  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const start = key(parse(season.start)), end = key(parse(season.end));
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

/** Book section title, e.g. "Halloween · until 7 Nov". */
export function seasonTitle(season: Season): string {
  const end = parse(season.end);
  return `${season.name} · until ${end.day} ${MONTHS[end.month - 1]}`;
}

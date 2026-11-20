import { META_SEASON_SPLASH } from '../featureFlags';
import { seasonNow } from './seasonClock';
import { inSeason, validateSeason, type Season } from './seasons';
import { winterDecorOn } from './winter/winterLook';

export type SplashSeason = 'winter' | 'valentine' | 'spring' | 'summer';
/** Checked in order; Valentine's sits inside the winter window and wins there. */
const WINDOWS: readonly (Season & { id: SplashSeason })[] = [
  { id: 'valentine', name: "Valentine's", start: '02-01', end: '02-14' },
  { id: 'spring', name: 'Spring', start: '03-01', end: '05-31' },
  { id: 'summer', name: 'Summer', start: '06-01', end: '08-31' },
].map((s) => validateSeason(s) as Season & { id: SplashSeason });

/** QA only (the "Season" chip): force a season's splash decor; 'auto' follows the date. */
export const QA_SEASONS = ['auto', 'winter', 'valentine', 'spring', 'summer', 'none'] as const;
export type QaSeason = (typeof QA_SEASONS)[number];
let qa: QaSeason = 'auto';
export const getQaSeason = (): QaSeason => qa;
export function nextQaSeason(): QaSeason {
  qa = QA_SEASONS[(QA_SEASONS.indexOf(qa) + 1) % QA_SEASONS.length];
  return qa;
}

/** The decor the splash plays today, or null for the plain violet stage. */
export function splashSeason(now: Date = seasonNow(), flag: boolean = META_SEASON_SPLASH): SplashSeason | null {
  if (qa === 'none') return null;
  if (qa !== 'auto') return qa;
  if (flag) for (const w of WINDOWS) if (inSeason(w, now)) return w.id;
  return winterDecorOn(now) ? 'winter' : null;
}

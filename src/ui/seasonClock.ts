import { QA_DATE } from '../featureFlags';

/**
 * The date every season check uses: the phone's clock, or EXPO_PUBLIC_QA_DATE (YYYY-MM-DD, local midnight + the
 * current time of day) in QA builds so a reviewer can see December looks in November. A malformed value is ignored.
 */
export function seasonNow(qaDate: string = QA_DATE, real: Date = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(qaDate);
  if (!m) return real;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), real.getHours(), real.getMinutes());
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? real : d;
}

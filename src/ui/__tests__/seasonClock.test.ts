import { seasonNow } from '../seasonClock';

describe('seasonNow', () => {
  const real = new Date(2026, 10, 18, 14, 30);
  it('uses the real clock when no QA date is set', () => expect(seasonNow('', real)).toBe(real));
  it('uses the QA day with the real time of day', () => {
    const d = seasonNow('2026-12-20', real);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 11, 20, 14]);
  });
  it('ignores malformed and impossible dates', () => {
    expect(seasonNow('20-12-2026', real)).toBe(real);
    expect(seasonNow('2026-02-31', real)).toBe(real);
  });
});

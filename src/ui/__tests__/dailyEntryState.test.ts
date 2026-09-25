import { dailyEntryState } from '../dailyEntryState';

/**
 * W4-06: the menu's "Today's board" entry state, a pure function of three
 * stored numbers. Day numbers are SaveSystem.today()'s local calendar days.
 */
const TODAY = 2459;

describe('dailyEntryState', () => {
  test('never solved anything -> hidden (stays out of the first-run flow)', () => {
    expect(dailyEntryState({ today: TODAY, dailyLastDay: 0, totalSolved: 0 })).toBe('hidden');
  });

  test('hidden wins even over a stored clear for today (a progress reset keeps the daily key)', () => {
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY, totalSolved: 0 })).toBe('hidden');
  });

  test('solved, daily never played -> available', () => {
    expect(dailyEntryState({ today: TODAY, dailyLastDay: 0, totalSolved: 1 })).toBe('available');
  });

  test('dailyLastDay === today -> done', () => {
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY, totalSolved: 12 })).toBe('done');
  });

  test('dailyLastDay === today - 1 -> available', () => {
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY - 1, totalSolved: 12 })).toBe('available');
  });

  test('dailyLastDay === today + 3 (restored backup, clock moved back) -> available, no throw', () => {
    expect(() => dailyEntryState({ today: TODAY, dailyLastDay: TODAY + 3, totalSolved: 12 })).not.toThrow();
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY + 3, totalSolved: 12 })).toBe('available');
  });

  test('corrupt stored numbers never throw and never read as done', () => {
    for (const dailyLastDay of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(dailyEntryState({ today: TODAY, dailyLastDay, totalSolved: 3 })).toBe('available');
    }
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY, totalSolved: Number.NaN })).toBe('hidden');
    expect(dailyEntryState({ today: TODAY, dailyLastDay: TODAY, totalSolved: -1 })).toBe('hidden');
  });
});

import { splashSeason } from '../splashSeason';

const day = (m: number, d: number) => new Date(2027, m - 1, d, 12);

test('flag ON: Valentine 1-14 Feb (inside winter), spring Mar-May, summer Jun-Aug, nothing in autumn', () => {
  expect(splashSeason(day(2, 1), true)).toBe('valentine');
  expect(splashSeason(day(2, 14), true)).toBe('valentine');
  expect(splashSeason(day(3, 1), true)).toBe('spring');
  expect(splashSeason(day(5, 31), true)).toBe('spring');
  expect(splashSeason(day(6, 1), true)).toBe('summer');
  expect(splashSeason(day(8, 31), true)).toBe('summer');
  expect(splashSeason(day(10, 10), true)).toBeNull();
});

test('flag OFF: no new season ever shows', () => {
  for (const [m, d] of [[2, 10], [4, 1], [7, 1], [10, 10]] as const) expect(["valentine", "spring", "summer"]).not.toContain(splashSeason(day(m, d), false));
});

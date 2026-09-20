import { assistActive, ftueRoute } from '../ftueRoute';

const FIRST_RUN = {
  enabled: true,
  perfMode: false,
  stage: 0,
  currentLevel: 0,
  totalSolved: 0,
} as const;

test('flags OFF, stage 0, no progress returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, enabled: false })).toBe('real');
});

test('perfMode, stage 0 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, perfMode: true })).toBe('real');
});

test('stage 0 with no progress returns T1', () => {
  expect(ftueRoute(FIRST_RUN)).toBe('T1');
});

test('stage 1 with no progress returns T2', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: 1 })).toBe('T2');
});

test('stage 2 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: 2 })).toBe('real');
});

test('stage 3 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: 3 })).toBe('real');
});

test('stage 0 with currentLevel 5 returns real', () => {
  expect(
    ftueRoute({
      enabled: true,
      perfMode: false,
      stage: 0,
      currentLevel: 5,
      totalSolved: 0,
    }),
  ).toBe('real');
});

test('stage 4 returns real', () => {
  expect(
    ftueRoute({
      enabled: true,
      perfMode: false,
      stage: 4,
      currentLevel: 0,
      totalSolved: 0,
    }),
  ).toBe('real');
});

test('stage 0 with totalSolved 17 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, totalSolved: 17 })).toBe('real');
});

test('stage 1 with totalSolved 1 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: 1, totalSolved: 1 })).toBe('real');
});

test('stage -1 returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: -1 })).toBe('real');
});

test('stage NaN returns real', () => {
  expect(ftueRoute({ ...FIRST_RUN, stage: Number.NaN })).toBe('real');
});

test('assist is active when both flags are on and stage is 2', () => {
  expect(assistActive({ enabled: true, assistEnabled: true, stage: 2 })).toBe(true);
});

test('assist is inactive when FTUE is off', () => {
  expect(assistActive({ enabled: false, assistEnabled: true, stage: 2 })).toBe(false);
});

test('assist is inactive when its own flag is off', () => {
  expect(assistActive({ enabled: true, assistEnabled: false, stage: 2 })).toBe(false);
});

test.each([0, 1])('assist is inactive at stage %i', (stage) => {
  expect(assistActive({ enabled: true, assistEnabled: true, stage })).toBe(false);
});

test('assist is inactive at stage 3 even with both flags on', () => {
  expect(assistActive({ enabled: true, assistEnabled: true, stage: 3 })).toBe(false);
});

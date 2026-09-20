import {
  advanceStreak,
  readStreak,
  type StreakResult,
  type StreakState,
} from '../streak';

const OPTIONS = { freezesEnabled: true, earnEveryDays: 7, cap: 2 };

interface RuleRow {
  name: string;
  state: StreakState;
  expected: StreakResult;
  expectedReadBefore: number;
}

const RULE_ROWS: ReadonlyArray<RuleRow> = [
  {
    name: 'gap 0 changes nothing',
    state: { today: 20, lastPlayDay: 20, streak: 4, freezes: 1 },
    expected: { streak: 4, lastPlayDay: 20, freezes: 1, savedToday: false },
    expectedReadBefore: 4,
  },
  {
    name: 'gap 1 adds one day',
    state: { today: 20, lastPlayDay: 19, streak: 4, freezes: 1 },
    expected: { streak: 5, lastPlayDay: 20, freezes: 1, savedToday: false },
    expectedReadBefore: 4,
  },
  {
    name: 'gap 2 with 1 freeze saves the chain',
    state: { today: 20, lastPlayDay: 18, streak: 14, freezes: 1 },
    expected: { streak: 15, lastPlayDay: 20, freezes: 0, savedToday: true },
    expectedReadBefore: 14,
  },
  {
    name: 'gap 2 with 0 freezes restarts at 1',
    state: { today: 20, lastPlayDay: 18, streak: 4, freezes: 0 },
    expected: { streak: 1, lastPlayDay: 20, freezes: 0, savedToday: false },
    expectedReadBefore: 0,
  },
  {
    name: 'gap 3 with 2 freezes saves the chain without going below 0',
    state: { today: 20, lastPlayDay: 17, streak: 4, freezes: 2 },
    expected: { streak: 5, lastPlayDay: 20, freezes: 0, savedToday: true },
    expectedReadBefore: 4,
  },
  {
    name: 'gap 3 with 1 freeze restarts and keeps the bank',
    state: { today: 20, lastPlayDay: 17, streak: 4, freezes: 1 },
    expected: { streak: 1, lastPlayDay: 20, freezes: 1, savedToday: false },
    expectedReadBefore: 0,
  },
  {
    name: 'first-ever solve starts at 1',
    state: { today: 20, lastPlayDay: 0, streak: 0, freezes: 0 },
    expected: { streak: 1, lastPlayDay: 20, freezes: 0, savedToday: false },
    expectedReadBefore: 0,
  },
  {
    name: 'negative gap keeps the streak and spends no freeze',
    state: { today: 20, lastPlayDay: 21, streak: 4, freezes: 1 },
    expected: { streak: 4, lastPlayDay: 20, freezes: 1, savedToday: false },
    expectedReadBefore: 4,
  },
  {
    name: 'reaching 7 earns one freeze',
    state: { today: 20, lastPlayDay: 19, streak: 6, freezes: 0 },
    expected: { streak: 7, lastPlayDay: 20, freezes: 1, savedToday: false },
    expectedReadBefore: 6,
  },
  {
    name: 'reaching 14 through a freeze earns one freeze',
    state: { today: 20, lastPlayDay: 18, streak: 13, freezes: 1 },
    expected: { streak: 14, lastPlayDay: 20, freezes: 1, savedToday: true },
    expectedReadBefore: 13,
  },
  {
    name: 'earned freezes never exceed the cap',
    state: { today: 20, lastPlayDay: 19, streak: 6, freezes: 2 },
    expected: { streak: 7, lastPlayDay: 20, freezes: 2, savedToday: false },
    expectedReadBefore: 6,
  },
];

function oldAdvance(state: StreakState): StreakState {
  if (state.lastPlayDay === state.today) return { ...state };
  return {
    ...state,
    streak:
      state.lastPlayDay !== 0 && state.today - state.lastPlayDay === 1
        ? state.streak + 1
        : 1,
    lastPlayDay: state.today,
  };
}

function oldRead(state: StreakState): number {
  if (state.lastPlayDay === 0) return 0;
  return state.today - state.lastPlayDay <= 1 ? state.streak : 0;
}

describe.each(RULE_ROWS)('freezes enabled: $name', ({ state, expected, expectedReadBefore }) => {
  test('advances and reads the chain', () => {
    expect(readStreak(state, OPTIONS)).toBe(expectedReadBefore);

    const actual = advanceStreak(state, OPTIONS);

    expect(actual).toEqual(expected);
    expect(readStreak({ ...actual, today: state.today }, OPTIONS)).toBe(expected.streak);
  });
});

describe('corrupt store freeze values clamp to 0..cap before use (freezes enabled)', () => {
  test.each([
    ['stored -3 clamps to 0', -3, 0],
    ['stored NaN clamps to 0', NaN, 0],
    ['stored 999 clamps to the cap of 2', 999, 2],
  ] as const)('%s', (_name, storedFreezes, expectedFreezes) => {
    // First-ever solve (lastPlayDay 0): advanceStreak reaches a streak of 1, which is not a
    // multiple of earnEveryDays (7), so earnFreeze passes the clamped bank through unchanged and
    // the output "freezes" field is exactly boundedFreezes(storedFreezes, cap).
    const state: StreakState = { today: 20, lastPlayDay: 0, streak: 0, freezes: storedFreezes };

    const result = advanceStreak(state, OPTIONS);

    expect(result.freezes).toBe(expectedFreezes);
  });
});

describe.each(RULE_ROWS)('flag-off parity: $name', ({ state }) => {
  test('matches expected values computed by the old registerSolve and dayStreak formulas', () => {
    const options = { ...OPTIONS, freezesEnabled: false };
    const expected = oldAdvance(state);
    const actual = advanceStreak(state, options);

    expect(actual).toEqual({
      streak: expected.streak,
      lastPlayDay: expected.lastPlayDay,
      freezes: expected.freezes,
      savedToday: false,
    });
    expect(readStreak(state, options)).toBe(oldRead(state));
    expect(readStreak({ ...actual, today: state.today }, options)).toBe(oldRead(expected));
  });
});

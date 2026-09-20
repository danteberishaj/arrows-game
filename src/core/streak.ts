export interface StreakState {
  today: number;
  lastPlayDay: number;
  streak: number;
  freezes: number;
}

export interface StreakOptions {
  freezesEnabled: boolean;
  earnEveryDays: number;
  cap: number;
}

export interface StreakResult {
  streak: number;
  lastPlayDay: number;
  freezes: number;
  savedToday: boolean;
}

export const STREAK_FREEZE_EARN_EVERY_DAYS = 7; // OWNER-PICKED STARTING VALUE: a legibility choice ("a week banks a miss"). It is not measured.
export const STREAK_FREEZE_CAP = 2; // OWNER-PICKED STARTING VALUE: Duolingo's reported result supports a cap of 2–3 over 1, but not this exact number.

function boundedFreezes(freezes: number, cap: number): number {
  const safeCap = Math.max(0, Math.trunc(cap));
  if (!Number.isFinite(freezes)) return 0;
  return Math.min(safeCap, Math.max(0, Math.trunc(freezes)));
}

function earnFreeze(streak: number, freezes: number, opts: StreakOptions): number {
  if (streak <= 0 || opts.earnEveryDays <= 0 || streak % opts.earnEveryDays !== 0) {
    return freezes;
  }
  return Math.min(Math.max(0, Math.trunc(opts.cap)), freezes + 1);
}

/** Applies one solve to the stored local-day chain. */
export function advanceStreak(state: StreakState, opts: StreakOptions): StreakResult {
  if (!opts.freezesEnabled) {
    if (state.lastPlayDay === state.today) {
      return {
        streak: state.streak,
        lastPlayDay: state.lastPlayDay,
        freezes: state.freezes,
        savedToday: false,
      };
    }

    const streak =
      state.lastPlayDay !== 0 && state.today - state.lastPlayDay === 1
        ? state.streak + 1
        : 1;
    return {
      streak,
      lastPlayDay: state.today,
      freezes: state.freezes,
      savedToday: false,
    };
  }

  const freezes = boundedFreezes(state.freezes, opts.cap);

  if (state.lastPlayDay === 0) {
    const streak = 1;
    return {
      streak,
      lastPlayDay: state.today,
      freezes: earnFreeze(streak, freezes, opts),
      savedToday: false,
    };
  }

  const gap = state.today - state.lastPlayDay;
  if (state.lastPlayDay === state.today) {
    return {
      streak: state.streak,
      lastPlayDay: state.lastPlayDay,
      freezes,
      savedToday: false,
    };
  }

  if (gap < 0) {
    return {
      streak: state.streak,
      lastPlayDay: state.today,
      freezes,
      savedToday: false,
    };
  }

  if (gap === 1) {
    const streak = state.streak + 1;
    return {
      streak,
      lastPlayDay: state.today,
      freezes: earnFreeze(streak, freezes, opts),
      savedToday: false,
    };
  }

  const missedDays = gap - 1;
  const savedToday = freezes >= missedDays;
  const streak = savedToday ? state.streak + 1 : 1;
  const remainingFreezes = savedToday ? freezes - missedDays : freezes;
  return {
    streak,
    lastPlayDay: state.today,
    freezes: earnFreeze(streak, remainingFreezes, opts),
    savedToday,
  };
}

/** Reads the chain that the next solve can still preserve. */
export function readStreak(state: StreakState, opts: StreakOptions): number {
  if (state.lastPlayDay === 0) return 0;
  const gap = state.today - state.lastPlayDay;
  if (gap <= 1) return state.streak;
  if (!opts.freezesEnabled) return 0;
  return boundedFreezes(state.freezes, opts.cap) >= gap - 1 ? state.streak : 0;
}

export const FTUE_ENABLED = process.env.EXPO_PUBLIC_FTUE === '1';
export const FTUE_ASSIST_ENABLED = process.env.EXPO_PUBLIC_FTUE_ASSIST === '1';
export const FTUE_STALL_HINT_ENABLED =
  process.env.EXPO_PUBLIC_FTUE_STALL_HINT === '1';
export const FTUE_STALL_HINT_MS: number | null = null;

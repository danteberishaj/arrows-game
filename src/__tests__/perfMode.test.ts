import { parsePerfScreen } from '../perfMode';

describe('parsePerfScreen (EXPO_PUBLIC_PERF_SCREEN)', () => {
  it('defaults to the game when unset, so historical PERF builds keep booting into the board', () => {
    expect(parsePerfScreen(undefined)).toBe('game');
  });

  it('accepts exactly splash, menu and game', () => {
    expect(parsePerfScreen('splash')).toBe('splash');
    expect(parsePerfScreen('menu')).toBe('menu');
    expect(parsePerfScreen('game')).toBe('game');
  });

  it('rejects anything else instead of silently booting a different screen', () => {
    expect(() => parsePerfScreen('Menu')).toThrow(/EXPO_PUBLIC_PERF_SCREEN/);
    expect(() => parsePerfScreen('')).toThrow(/EXPO_PUBLIC_PERF_SCREEN/);
    expect(() => parsePerfScreen('home')).toThrow(/EXPO_PUBLIC_PERF_SCREEN/);
  });
});

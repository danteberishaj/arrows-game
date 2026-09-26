import { parsePerfScreen, reducedMotionDiagLabel } from '../perfMode';

/** Load perfMode fresh under a given env, so its module-load-time consts recompute. */
function loadPerfMode(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  process.env = { ...saved, ...env };
  let mod!: typeof import('../perfMode');
  try {
    jest.isolateModules(() => {
      mod = require('../perfMode') as typeof import('../perfMode');
    });
  } finally {
    process.env = saved;
  }
  return mod;
}

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

describe('EXPO_PUBLIC_DEV_LEVEL (W3-06)', () => {
  it('is null when unset, so a player build keeps the normal current-level boot', () => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: undefined }).DEV_LEVEL_INDEX).toBeNull();
  });

  it('reads a non-negative safe integer, index 0 included', () => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: '11' }).DEV_LEVEL_INDEX).toBe(11);
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: '0' }).DEV_LEVEL_INDEX).toBe(0);
  });

  it('rejects a negative, fractional or non-numeric value instead of guessing an index', () => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: '-1' }).DEV_LEVEL_INDEX).toBeNull();
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: '3.5' }).DEV_LEVEL_INDEX).toBeNull();
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: 'eleven' }).DEV_LEVEL_INDEX).toBeNull();
  });

  it('is independent of PERF_MODE: set alone it does not turn PERF_MODE on', () => {
    const mod = loadPerfMode({ EXPO_PUBLIC_DEV_LEVEL: '11', EXPO_PUBLIC_PERF_LEVEL: undefined });
    expect(mod.PERF_MODE).toBe(false);
    expect(mod.DEV_LEVEL_INDEX).toBe(11);
  });
});

describe('EXPO_PUBLIC_DEV_GEN_VERSION (W3-06)', () => {
  it('is null when unset, leaving the switch level (or PERF_GEN_VERSION) to decide', () => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_GEN_VERSION: undefined }).DEV_GEN_VERSION).toBeNull();
  });

  it.each(['1', '2'] as const)('reads exactly %s', (raw) => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_GEN_VERSION: raw }).DEV_GEN_VERSION).toBe(Number(raw));
  });

  it.each(['0', '3', 'two', ''])('rejects anything else (%p) instead of guessing a version', (raw) => {
    expect(loadPerfMode({ EXPO_PUBLIC_DEV_GEN_VERSION: raw }).DEV_GEN_VERSION).toBeNull();
  });
});

describe('reducedMotionDiagLabel', () => {
  it('encodes the app-reported reduced-motion value the capture harness reads back', () => {
    expect(reducedMotionDiagLabel(true, true)).toBe('perf-reduced-motion-1');
    expect(reducedMotionDiagLabel(true, false)).toBe('perf-reduced-motion-0');
  });

  it('adds nothing when the diagnostic is compiled out', () => {
    expect(reducedMotionDiagLabel(false, true)).toBeUndefined();
    expect(reducedMotionDiagLabel(false, false)).toBeUndefined();
  });
});

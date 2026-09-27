import {
  EXIT_TRAIL_CLEANUP_MS,
  EXIT_TRAIL_DURATION_MS,
  EXIT_TRAIL_MAX_DURATION_MS,
  EXIT_TRAIL_STROKE_CELLS,
  FINAL_EXIT_FACTOR,
  MAX_CONCURRENT_EXIT_TRAILS,
  MAX_EXIT_TRAIL_DURATION_MS,
  MIN_EXIT_TRAIL_DURATION_MS,
  exitAnimationKind,
  exitTrailDurationMs,
  finalExitDurationMs,
} from '../exitAnimationConfig';

describe('exit animation timing', () => {
  it('keeps cleanup close to completion so rapid taps cannot retain many trails', () => {
    expect(EXIT_TRAIL_DURATION_MS).toBeGreaterThanOrEqual(160);
    expect(EXIT_TRAIL_CLEANUP_MS).toBeGreaterThan(EXIT_TRAIL_DURATION_MS);
    expect(EXIT_TRAIL_CLEANUP_MS - EXIT_TRAIL_DURATION_MS).toBeLessThanOrEqual(50);
    expect(MAX_CONCURRENT_EXIT_TRAILS).toBe(2);
    expect(EXIT_TRAIL_STROKE_CELLS).toBeGreaterThan(0);
  });

  it('scales duration with on-screen travel so every level reads at the same speed', () => {
    expect(exitTrailDurationMs(0)).toBe(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(100)).toBe(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(375)).toBeGreaterThan(EXIT_TRAIL_DURATION_MS);
    expect(exitTrailDurationMs(375)).toBeLessThan(EXIT_TRAIL_MAX_DURATION_MS);
    expect(exitTrailDurationMs(5000)).toBe(EXIT_TRAIL_MAX_DURATION_MS);
    expect(exitTrailDurationMs(Number.NaN)).toBe(EXIT_TRAIL_DURATION_MS);
    // Native parsers reject anything outside 160..1000 ms.
    expect(EXIT_TRAIL_MAX_DURATION_MS).toBeLessThanOrEqual(1000);
  });

  it('plays the same slither on native at every density and only diagnostics disable it', () => {
    expect(exitAnimationKind(false, true)).toBe('native-slither');
    expect(exitAnimationKind(false, false)).toBe('slither');
    expect(exitAnimationKind(true, true)).toBe('none');
    expect(exitAnimationKind(true, false)).toBe('none');
  });
});

/**
 * W5-07: the exit trail's resting width is calibrated on emulator recordings at four candidates (0.144 / 0.18 /
 * 0.22 / 0.26 cells). A capture build selects one through EXPO_PUBLIC_PERF_EXIT_TRAIL_STROKE_CELLS, read ONLY in a
 * PERF build (the EXPO_PUBLIC_PERF_EXIT_DURATION_MS precedent); a player build always gets the resting constant.
 */
describe('W5-07 capture-only trail width override', () => {
  const RESTING = 0.26;
  function strokeWith(env: { perfLevel?: string; stroke?: string }): number {
    const saved = { ...process.env };
    let value = Number.NaN;
    try {
      delete process.env.EXPO_PUBLIC_PERF_LEVEL;
      delete process.env.EXPO_PUBLIC_PERF_EXIT_TRAIL_STROKE_CELLS;
      if (env.perfLevel !== undefined) process.env.EXPO_PUBLIC_PERF_LEVEL = env.perfLevel;
      if (env.stroke !== undefined) process.env.EXPO_PUBLIC_PERF_EXIT_TRAIL_STROKE_CELLS = env.stroke;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cfg = require('../exitAnimationConfig') as typeof import('../exitAnimationConfig');
        value = cfg.EXIT_TRAIL_STROKE_CELLS;
      });
    } finally {
      process.env = saved;
    }
    return value;
  }

  it('a player build (PERF_MODE off) gets the resting width whatever the env says', () => {
    expect(strokeWith({})).toBe(RESTING);
    for (const stroke of ['0.144', '0.18', '0.22', '0.5', '2', 'abc', '0']) {
      expect(strokeWith({ stroke })).toBe(RESTING);
    }
  });

  it('a PERF build reads a candidate width', () => {
    expect(strokeWith({ perfLevel: '167', stroke: '0.144' })).toBe(0.144);
    expect(strokeWith({ perfLevel: '167', stroke: '0.18' })).toBe(0.18);
    expect(strokeWith({ perfLevel: '137', stroke: '0.22' })).toBe(0.22);
    expect(strokeWith({ perfLevel: '137', stroke: '0.26' })).toBe(0.26);
    expect(strokeWith({ perfLevel: '167', stroke: '0.5' })).toBe(0.5); // (0, 0.5]: the upper bound is accepted
  });

  it('a PERF build falls back to the resting width for anything outside (0, 0.5] or non-finite', () => {
    for (const stroke of ['2', 'abc', '0', '-0.1', '0.5001', '', 'Infinity', 'NaN']) {
      expect(strokeWith({ perfLevel: '167', stroke })).toBe(RESTING);
    }
    expect(strokeWith({ perfLevel: '167' })).toBe(RESTING); // PERF build, variable unset
  });
});

/**
 * W2-06 (META_POST_CLEAR_TIMELINE): the final exit may be stretched by FINAL_EXIT_FACTOR. Both native parsers accept
 * only 160..1000 ms and SILENTLY DROP anything else (ArrowsBoardView.kt MIN/MAX_EXIT_DURATION_MS, .swift): the last
 * arrow would vanish with no motion. The sweep covers every normal duration the app can produce: exitTrailDurationMs
 * gives 180..320, POLISH-T10's exitLaunchDurationMs 180..1000 (a superset of the brief's 180..320).
 */
describe('W2-06 final exit duration', () => {
  const CANDIDATES = [1.0, 1.5]; // the owner's candidate factors (2.0 excluded: "a flick, not a drift")

  it('exports the native parsers\' band', () => {
    expect(MIN_EXIT_TRAIL_DURATION_MS).toBe(160);
    expect(MAX_EXIT_TRAIL_DURATION_MS).toBe(1000);
  });

  it('stays inside 160..1000 for every normal duration 160..1000 and every candidate factor (and 2.0, clamped)', () => {
    for (const factor of [...CANDIDATES, 2.0]) {
      for (let normal = MIN_EXIT_TRAIL_DURATION_MS; normal <= MAX_EXIT_TRAIL_DURATION_MS; normal += 1) {
        const ms = finalExitDurationMs(normal, factor);
        expect(Number.isInteger(ms)).toBe(true);
        if (ms < MIN_EXIT_TRAIL_DURATION_MS || ms > MAX_EXIT_TRAIL_DURATION_MS) {
          throw new Error(`factor ${factor}, normal ${normal} -> ${ms} ms: outside the native band`);
        }
      }
    }
  });

  it('is round(normal x factor) inside the band, and the identity at factor 1', () => {
    expect(finalExitDurationMs(320, 1.5)).toBe(480);
    expect(finalExitDurationMs(181, 1.5)).toBe(272); // 271.5 rounds up
    expect(finalExitDurationMs(800, 1.5)).toBe(1000); // clamped to the parser's maximum
    for (let normal = 180; normal <= 1000; normal += 1) expect(finalExitDurationMs(normal, 1.0)).toBe(normal);
  });

  it('a non-finite input never produces a non-finite duration', () => {
    expect(finalExitDurationMs(Number.NaN, 1.5)).toBe(EXIT_TRAIL_DURATION_MS);
    expect(finalExitDurationMs(300, Number.NaN)).toBe(300);
  });

  it('FINAL_EXIT_FACTOR is a candidate, 1.0 until the owner picks', () => {
    expect(CANDIDATES).toContain(FINAL_EXIT_FACTOR);
    expect(FINAL_EXIT_FACTOR).toBe(1.0);
  });

  it('returns the pinned benchmark duration exactly when the duration is pinned (PERF build)', () => {
    const saved = { ...process.env };
    try {
      process.env.EXPO_PUBLIC_PERF_LEVEL = '3827';
      process.env.EXPO_PUBLIC_PERF_EXIT_DURATION_MS = '240';
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cfg = require('../exitAnimationConfig') as typeof import('../exitAnimationConfig');
        expect(cfg.EXIT_TRAIL_DURATION_IS_PINNED).toBe(true);
        expect(cfg.EXIT_TRAIL_DURATION_MS).toBe(240);
        for (const factor of CANDIDATES) {
          for (const normal of [180, 240, 320, 1000]) expect(cfg.finalExitDurationMs(normal, factor)).toBe(240);
        }
      });
    } finally {
      process.env = saved;
    }
  });
});

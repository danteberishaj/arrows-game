import type { EnvelopedEvent } from '../events';

/**
 * `MEASURE_CLEAR` is read once at module load from `process.env`, so each
 * test that needs a specific value reloads the module in isolation via
 * `jest.resetModules()` + `require()` rather than importing it statically.
 */
function loadWith(value: string | undefined): typeof import('../measureClearSink') {
  jest.resetModules();
  if (value === undefined) delete process.env.EXPO_PUBLIC_MEASURE_CLEAR;
  else process.env.EXPO_PUBLIC_MEASURE_CLEAR = value;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../measureClearSink');
}

let seq = 0;
function envelope<N extends 'level_start' | 'level_end'>(
  name: N,
  props: Omit<EnvelopedEvent<N>, 'name' | 'ts' | 'seq' | 'sessionIndex' | 'bucket' | 'schemaVersion'>,
): EnvelopedEvent<N> {
  seq += 1;
  return {
    name,
    ts: 1_700_000_000_000 + seq,
    seq,
    sessionIndex: 0,
    bucket: 0,
    schemaVersion: 1,
    ...props,
  } as EnvelopedEvent<N>;
}

function levelStart(overrides: Partial<EnvelopedEvent<'level_start'>> = {}): EnvelopedEvent<'level_start'> {
  return envelope('level_start', {
    levelIndex: 5,
    arrowCount: 42,
    shapeName: 'Circle',
    heartsMax: 3,
    mode: 'campaign',
    ...overrides,
  } as EnvelopedEvent<'level_start'>);
}

function levelEnd(overrides: Partial<EnvelopedEvent<'level_end'>> = {}): EnvelopedEvent<'level_end'> {
  return envelope('level_end', {
    levelIndex: 5,
    mode: 'campaign',
    outcome: 'cleared',
    taps: 44,
    tapsExit: 42,
    tapsBlocked: 2,
    tapsGhost: 0,
    tapsMiss: 0,
    heartsLost: 1,
    heartsLeft: 2,
    heartsMax: 3,
    durationMs: 12345,
    hintsUsed: 0,
    continuesUsed: 0,
    ...overrides,
  } as EnvelopedEvent<'level_end'>);
}

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_MEASURE_CLEAR;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_MEASURE_CLEAR;
  else process.env.EXPO_PUBLIC_MEASURE_CLEAR = ORIGINAL_ENV;
  jest.resetModules();
});

describe('MEASURE_CLEAR flag (W4-04)', () => {
  test('is false when the env var is unset', () => {
    expect(loadWith(undefined).MEASURE_CLEAR).toBe(false);
  });

  test('is true only for the exact string "1"', () => {
    expect(loadWith('1').MEASURE_CLEAR).toBe(true);
    expect(loadWith('true').MEASURE_CLEAR).toBe(false);
    expect(loadWith('0').MEASURE_CLEAR).toBe(false);
  });
});

describe('withMeasureClearLog, flag off', () => {
  test('returns the same sink instance untouched (no wrapping cost)', () => {
    const { withMeasureClearLog } = loadWith(undefined);
    const sink = jest.fn();
    expect(withMeasureClearLog(sink)).toBe(sink);
  });
});

describe('withMeasureClearLog, flag on', () => {
  test('passes every event through to the wrapped sink unchanged', () => {
    const { withMeasureClearLog } = loadWith('1');
    const sink = jest.fn();
    const log = jest.fn();
    const wrapped = withMeasureClearLog(sink, log);
    const start = levelStart();
    const end = levelEnd({ outcome: 'abandoned' });
    wrapped(start);
    wrapped(end);
    expect(sink).toHaveBeenNthCalledWith(1, start);
    expect(sink).toHaveBeenNthCalledWith(2, end);
  });

  test('logs exactly one [measure-clear] line for a cleared campaign level, joined with its level_start', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelStart({ levelIndex: 5, shapeName: 'Circle', arrowCount: 42, mode: 'campaign' }));
    wrapped(
      levelEnd({ levelIndex: 5, mode: 'campaign', outcome: 'cleared', taps: 44, durationMs: 12345, heartsLost: 1 }),
    );
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      '[measure-clear] mode=campaign id=5 shape=Circle arrows=42 taps=44 ms=12345 heartsLost=1',
    );
  });

  test('mode daily carries the day number as id', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelStart({ levelIndex: 2450, shapeName: 'Diamond', arrowCount: 87, mode: 'daily' }));
    wrapped(levelEnd({ levelIndex: 2450, mode: 'daily', outcome: 'cleared', taps: 90, durationMs: 5000, heartsLost: 0 }));
    expect(log).toHaveBeenCalledWith(
      '[measure-clear] mode=daily id=2450 shape=Diamond arrows=87 taps=90 ms=5000 heartsLost=0',
    );
  });

  test('does not log for out_of_hearts or abandoned outcomes', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelStart());
    wrapped(levelEnd({ outcome: 'out_of_hearts' }));
    wrapped(levelEnd({ outcome: 'abandoned' }));
    expect(log).not.toHaveBeenCalled();
  });

  test('does not log for a cleared tutorial board (FTUE has its own [ftue] log, ruling F09)', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelStart({ mode: 'tutorial' }));
    wrapped(levelEnd({ mode: 'tutorial', outcome: 'cleared' }));
    expect(log).not.toHaveBeenCalled();
  });

  test('a continued level (loss, earned continue, later clear) still joins the original level_start', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelStart({ levelIndex: 3, shapeName: 'Square', arrowCount: 60, mode: 'campaign' }));
    // First terminal event: out_of_hearts (per W6-06 fix round 1, the level stays resumable).
    wrapped(levelEnd({ levelIndex: 3, mode: 'campaign', outcome: 'out_of_hearts', heartsLost: 3, continuesUsed: 0 }));
    // Second terminal event after an earned continue reopened the same level.
    wrapped(
      levelEnd({
        levelIndex: 3,
        mode: 'campaign',
        outcome: 'cleared',
        taps: 63,
        durationMs: 9000,
        heartsLost: 3,
        continuesUsed: 1,
      }),
    );
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      '[measure-clear] mode=campaign id=3 shape=Square arrows=60 taps=63 ms=9000 heartsLost=3',
    );
  });

  test('falls back to shape=unknown arrows=0 when no matching level_start was seen', () => {
    const { withMeasureClearLog } = loadWith('1');
    const log = jest.fn();
    const wrapped = withMeasureClearLog(jest.fn(), log);
    wrapped(levelEnd({ levelIndex: 9, outcome: 'cleared' }));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('id=9 shape=unknown arrows=0 '),
    );
  });
});

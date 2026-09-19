import { LevelGenerator } from '../../core';
import { LevelAggregator } from '../levelAggregator';
import { createMemorySink, noopSink, Telemetry } from '../telemetry';

function captureEvents() {
  const sink = createMemorySink(20);
  Telemetry.useSink(sink);
  Telemetry.configure({ validate: true, disabled: false });
  return {
    sink,
    events: (name: 'level_start' | 'level_end' | 'session_end') =>
      sink.events.filter((event) => event.name === name),
  };
}

afterEach(() => {
  Telemetry.useSink(noopSink);
  Telemetry.configure({ validate: false, disabled: false });
});

test('clearing real level 0 reconciles total taps with every outcome counter', () => {
  const generated = LevelGenerator.generate(0);
  const aggregator = new LevelAggregator(1_000);
  const { events } = captureEvents();

  aggregator.start(
    0,
    generated.arrowCount,
    generated.shapeName,
    generated.hearts,
    'campaign',
    1_100,
  );

  while (!generated.board.isCleared()) {
    const arrow = generated.board.findHint();
    expect(arrow).not.toBeNull();
    expect(generated.board.tryRemove(arrow!)).toBe(true);
    aggregator.tap('exit');
  }
  aggregator.end('cleared', generated.hearts, 2_100);

  expect(events('level_start')).toHaveLength(1);
  expect(events('level_end')).toEqual([
    expect.objectContaining({
      name: 'level_end',
      outcome: 'cleared',
      taps: generated.arrowCount,
      tapsExit: generated.arrowCount,
      tapsBlocked: 0,
      tapsGhost: 0,
      tapsMiss: 0,
    }),
  ]);
  const ended = events('level_end')[0] as unknown as Record<string, number>;
  expect(ended.taps).toBe(
    ended.tapsExit + ended.tapsBlocked + ended.tapsGhost + ended.tapsMiss,
  );
});

test('heartsMax real blocked taps charge every heart and end out of hearts at zero', () => {
  const generated = LevelGenerator.generate(0);
  const aggregator = new LevelAggregator(1_000);
  const { events } = captureEvents();
  aggregator.start(
    0,
    generated.arrowCount,
    generated.shapeName,
    generated.hearts,
    'campaign',
    1_100,
  );

  const blocked = generated.board.arrows().filter((arrow) => !generated.board.canExit(arrow));
  expect(blocked.length).toBeGreaterThanOrEqual(generated.hearts);
  for (const arrow of blocked.slice(0, generated.hearts)) {
    expect(generated.board.tryRemove(arrow)).toBe(false);
    aggregator.tap('blocked');
    aggregator.heartLost();
  }
  aggregator.end('out_of_hearts', 0, 1_500);

  expect(events('level_end')).toEqual([
    expect.objectContaining({
      name: 'level_end',
      outcome: 'out_of_hearts',
      heartsLost: generated.hearts,
      heartsLeft: 0,
      taps: generated.hearts,
      tapsBlocked: generated.hearts,
    }),
  ]);
});

test('a second end after the first emits nothing', () => {
  const generated = LevelGenerator.generate(0);
  const aggregator = new LevelAggregator(1_000);
  const { events } = captureEvents();
  aggregator.start(
    0,
    generated.arrowCount,
    generated.shapeName,
    generated.hearts,
    'campaign',
    1_100,
  );

  aggregator.end('cleared', generated.hearts, 1_500);
  aggregator.end('abandoned', generated.hearts, 1_600);

  expect(events('level_end')).toHaveLength(1);
  expect(events('level_end')[0]).toEqual(expect.objectContaining({ outcome: 'cleared' }));
});

test('end abandoned with no prior start emits nothing', () => {
  const aggregator = new LevelAggregator(1_000);
  const { events } = captureEvents();

  aggregator.end('abandoned', 3, 1_500);

  expect(events('level_end')).toHaveLength(0);
});

test('session_end reports started, cleared and last-level tallies', () => {
  const generated = LevelGenerator.generate(0);
  const aggregator = new LevelAggregator(1_000);
  const { events } = captureEvents();
  aggregator.start(0, generated.arrowCount, generated.shapeName, 3, 'campaign', 1_100);
  aggregator.end('cleared', 3, 1_500);
  aggregator.start(1, generated.arrowCount, generated.shapeName, 3, 'campaign', 1_600);
  aggregator.end('abandoned', 2, 1_900);

  aggregator.sessionEnd(2_000);

  expect(events('session_end')).toEqual([
    expect.objectContaining({
      durationMs: 1_000,
      levelsStarted: 2,
      levelsCleared: 1,
      lastLevelIndex: 1,
    }),
  ]);
});

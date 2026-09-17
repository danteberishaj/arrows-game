import { EventSchema, EventName } from '../events';
import { Telemetry, noopSink, createMemorySink } from '../telemetry';
import { fnv1a32 } from '../hash';

// No file under src/ imports AsyncStorage in this test — a mocked module
// lets the "noopSink never touches storage" assertion be a real check
// rather than a tautology.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), multiGet: jest.fn() },
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const EXPECTED_EVENT_KEYS: Record<string, readonly string[]> = {
  app_open: ['cold', 'sessionIndex', 'appVersion', 'bucket'],
  screen_view: ['screen'],
  level_start: ['levelIndex', 'arrowCount', 'shapeName', 'heartsMax', 'mode'],
  level_end: [
    'levelIndex',
    'mode',
    'outcome',
    'taps',
    'tapsExit',
    'tapsBlocked',
    'tapsGhost',
    'tapsMiss',
    'heartsLost',
    'heartsLeft',
    'heartsMax',
    'durationMs',
    'hintsUsed',
    'continuesUsed',
  ],
  session_end: ['durationMs', 'levelsStarted', 'levelsCleared', 'lastLevelIndex'],
  ad_request: ['format', 'placement'],
  ad_result: ['format', 'placement', 'outcome'],
  ad_reward: ['placement', 'earned'],
  error: ['kind', 'nameMessageHash', 'screen', 'count'],
};

describe('EventSchema', () => {
  test('has exactly the 9 named events, no more, no fewer', () => {
    expect(Object.keys(EventSchema).sort()).toEqual(Object.keys(EXPECTED_EVENT_KEYS).sort());
    expect(Object.keys(EventSchema)).toHaveLength(9);
  });

  test.each(Object.keys(EXPECTED_EVENT_KEYS))('%s has exactly its documented keys', (name) => {
    const fields = (EventSchema as Record<string, Record<string, unknown>>)[name];
    expect(Object.keys(fields).sort()).toEqual([...EXPECTED_EVENT_KEYS[name]].sort());
  });

  test('EventSchema itself is frozen', () => {
    expect(Object.isFrozen(EventSchema)).toBe(true);
  });

  test('every event entry is frozen', () => {
    for (const name of Object.keys(EventSchema)) {
      expect(Object.isFrozen((EventSchema as Record<string, unknown>)[name])).toBe(true);
    }
  });

  test('no schema key collects an identifier the transport must not see', () => {
    const forbidden = ['advertisingId', 'gaid', 'idfa', 'ip', 'email', 'deviceId'];
    for (const name of Object.keys(EventSchema)) {
      const keys = Object.keys((EventSchema as Record<string, Record<string, unknown>>)[name]);
      for (const bad of forbidden) {
        expect(keys).not.toContain(bad);
      }
    }
  });
});

describe('fnv1a32', () => {
  test('matches the published FNV-1a-32 test vectors', () => {
    expect(fnv1a32('')).toBe(2166136261);
    expect(fnv1a32('a')).toBe(3826002220);
  });
});

describe('error event hashing', () => {
  test('JSON.stringify of a built error event never contains the raw message', () => {
    const err = new Error('secret-message-xyz');
    const event = {
      kind: 'js_fatal' as const,
      nameMessageHash: fnv1a32(`${err.name}:${err.message}`),
      screen: 'game' as const,
      count: 1,
    };
    expect(JSON.stringify(event)).not.toContain('secret-message-xyz');
    expect(typeof event.nameMessageHash).toBe('number');
  });
});

describe('Telemetry.emit with noopSink (the default)', () => {
  beforeEach(() => {
    Telemetry.configure({ validate: false, disabled: false });
    Telemetry.useSink(noopSink);
    jest.clearAllMocks();
  });

  test('1000 emits leave fetch and AsyncStorage untouched and return undefined', () => {
    const fetchMock = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    for (let i = 0; i < 1000; i++) {
      const result = Telemetry.emit('screen_view', { screen: 'game' });
      expect(result).toBeUndefined();
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
  });
});

describe('Telemetry.emit validation', () => {
  afterEach(() => {
    Telemetry.useSink(noopSink);
    Telemetry.configure({ validate: false, disabled: false });
  });

  test('validate: false drops an unknown event name without throwing', () => {
    Telemetry.configure({ validate: false, disabled: false });
    Telemetry.useSink(jest.fn());
    expect(() =>
      Telemetry.emit('not_a_real_event' as unknown as EventName, {} as never)
    ).not.toThrow();
  });

  test('validate: false drops a malformed property object without throwing', () => {
    Telemetry.configure({ validate: false, disabled: false });
    Telemetry.useSink(jest.fn());
    expect(() =>
      Telemetry.emit('screen_view', { screen: 'not-a-real-screen' } as never)
    ).not.toThrow();
  });

  test('validate: true throws on an unknown event name', () => {
    Telemetry.configure({ validate: true, disabled: false });
    Telemetry.useSink(jest.fn());
    expect(() =>
      Telemetry.emit('not_a_real_event' as unknown as EventName, {} as never)
    ).toThrow();
  });

  test('validate: true throws on a malformed property object', () => {
    Telemetry.configure({ validate: true, disabled: false });
    Telemetry.useSink(jest.fn());
    expect(() =>
      Telemetry.emit('screen_view', { screen: 'not-a-real-screen' } as never)
    ).toThrow();
    expect(() => Telemetry.emit('screen_view', {} as never)).toThrow();
    expect(() =>
      Telemetry.emit('screen_view', { screen: 'game', extra: 1 } as never)
    ).toThrow();
  });

  test('a well-formed event does not throw under validate: true and reaches the sink', () => {
    Telemetry.configure({ validate: true, disabled: false });
    const sink = jest.fn();
    Telemetry.useSink(sink);
    expect(() => Telemetry.emit('screen_view', { screen: 'menu' })).not.toThrow();
    expect(sink).toHaveBeenCalledTimes(1);
    const [event] = sink.mock.calls[0];
    expect(event).toMatchObject({ name: 'screen_view', screen: 'menu' });
    expect(typeof event.ts).toBe('number');
    expect(typeof event.seq).toBe('number');
    expect(typeof event.schemaVersion).toBe('number');
  });

  test('disabled: true skips even a well-formed event', () => {
    Telemetry.configure({ validate: true, disabled: true });
    const sink = jest.fn();
    Telemetry.useSink(sink);
    Telemetry.emit('screen_view', { screen: 'menu' });
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('Telemetry.emit validation with the default sink still installed (fix round 1)', () => {
  // Regression for a task-review finding: emit()'s fast path used to bail
  // out whenever `currentSink === noopSink`, before `checkEvent` ran — so
  // `validate: true` silently dropped bad events instead of throwing until
  // *something* called `Telemetry.useSink()`. These tests deliberately do
  // NOT call `useSink` first, unlike every other validation test in this
  // file, so they exercise the exact gap the finding described.
  afterEach(() => {
    Telemetry.useSink(noopSink);
    Telemetry.configure({ validate: false, disabled: false });
  });

  test('validate: true throws on an unknown event name even before any sink is installed', () => {
    Telemetry.configure({ validate: true, disabled: false });
    expect(() =>
      Telemetry.emit('not_a_real_event' as unknown as EventName, {} as never)
    ).toThrow();
  });

  test('validate: true throws on a malformed property object even before any sink is installed', () => {
    Telemetry.configure({ validate: true, disabled: false });
    expect(() =>
      Telemetry.emit('screen_view', { screen: 'not-a-real-screen' } as never)
    ).toThrow();
  });

  test('validate: false still drops silently (no sink installed, no throw)', () => {
    Telemetry.configure({ validate: false, disabled: false });
    expect(() =>
      Telemetry.emit('not_a_real_event' as unknown as EventName, {} as never)
    ).not.toThrow();
  });

  test('disabled: true still wins over validate: true (no throw, no sink call)', () => {
    Telemetry.configure({ validate: true, disabled: true });
    expect(() =>
      Telemetry.emit('not_a_real_event' as unknown as EventName, {} as never)
    ).not.toThrow();
  });

  test('a well-formed event with no sink installed does not throw and does not allocate a call', () => {
    Telemetry.configure({ validate: true, disabled: false });
    // currentSink is still noopSink here — nothing to call, but it must not
    // throw either, since the event itself is valid.
    expect(() => Telemetry.emit('screen_view', { screen: 'menu' })).not.toThrow();
  });
});

describe('createMemorySink', () => {
  test('keeps at most `cap` events, dropping the oldest', () => {
    const sink = createMemorySink(2);
    Telemetry.configure({ validate: true, disabled: false });
    Telemetry.useSink(sink);

    Telemetry.emit('screen_view', { screen: 'splash' });
    Telemetry.emit('screen_view', { screen: 'menu' });
    Telemetry.emit('screen_view', { screen: 'game' });

    expect(sink.events).toHaveLength(2);
    expect(sink.events.map((e) => (e as unknown as { screen: string }).screen)).toEqual([
      'menu',
      'game',
    ]);

    Telemetry.useSink(noopSink);
    Telemetry.configure({ validate: false, disabled: false });
  });
});

let mockTransportEnabled = true;

jest.mock('../../featureFlags', () => ({
  get TELEMETRY_TRANSPORT(): boolean {
    return mockTransportEnabled;
  },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvelopedEvent } from '../events';
import { EventSchema } from '../events';
import {
  createHttpSink,
  HTTP_SINK_CAP,
  TELEMETRY_ENDPOINT_URL,
  type HttpSink,
} from '../sink.http';

class FakeAppState {
  private readonly listeners = new Set<(state: string) => void>();

  addEventListener(_type: 'change', listener: (state: string) => void): { remove(): void } {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }

  change(state: string): void {
    for (const listener of this.listeners) listener(state);
  }
}

function screenView(seq: number): EnvelopedEvent<'screen_view'> {
  return {
    name: 'screen_view',
    ts: 1_000 + seq,
    seq,
    sessionIndex: 3,
    bucket: 42,
    schemaVersion: 1,
    screen: 'game',
  };
}

function sessionEnd(seq: number): EnvelopedEvent<'session_end'> {
  return {
    name: 'session_end',
    ts: 1_000 + seq,
    seq,
    sessionIndex: 3,
    bucket: 42,
    schemaVersion: 1,
    durationMs: 2_000,
    levelsStarted: 1,
    levelsCleared: 0,
    lastLevelIndex: 0,
  };
}

function appOpen(seq: number): EnvelopedEvent<'app_open'> {
  return {
    name: 'app_open',
    ts: 1_000 + seq,
    seq,
    sessionIndex: 3,
    bucket: 42,
    schemaVersion: 1,
    cold: true,
    appVersion: '1.0.0',
  };
}

function requestBody(fetchImpl: jest.Mock, call = 0): {
  installId: string;
  events: Array<Record<string, unknown>>;
} {
  return JSON.parse(fetchImpl.mock.calls[call][1].body as string);
}

const sinks: HttpSink[] = [];

afterEach(() => {
  for (const sink of sinks.splice(0)) sink.dispose();
  mockTransportEnabled = true;
  jest.useRealTimers();
});

test('the shipped flag, endpoint, and consent wiring are closed', () => {
  const actualFlags = jest.requireActual('../../featureFlags') as typeof import('../../featureFlags');
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

  expect(actualFlags.TELEMETRY_TRANSPORT).toBe(false);
  expect(TELEMETRY_ENDPOINT_URL).toBe('');
  expect(appSource).toContain('consentGranted: () => false');
});

describe('all four transport gates must hold', () => {
  test.each([
    ['TELEMETRY_TRANSPORT is false', { enabled: false, url: 'https://example.test', consent: true, killed: false }],
    ['the URL is empty', { enabled: true, url: '', consent: true, killed: false }],
    ['consent is not granted', { enabled: true, url: 'https://example.test', consent: false, killed: false }],
    ['telemetry is killed', { enabled: true, url: 'https://example.test', consent: true, killed: true }],
  ])('%s: 1000 events and three triggers make zero requests', async (_label, gate) => {
    mockTransportEnabled = gate.enabled;
    const appState = new FakeAppState();
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: gate.url,
      fetchImpl,
      appState,
      consentGranted: () => gate.consent,
      killed: () => gate.killed,
      installId: { hi: 123, lo: 456 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);

    for (let seq = 1; seq < 1_000; seq += 1) sink.send(screenView(seq));
    sink.send(sessionEnd(1_000)); // trigger 1
    appState.change('background'); // trigger 2
    await sink.flush(); // trigger 3

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('batching and triggers', () => {
  test('N emitted events produce one POST per explicit flush', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 123, lo: 456 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);

    for (let seq = 1; seq <= 17; seq += 1) sink.send(screenView(seq));
    await sink.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(requestBody(fetchImpl)).toEqual({
      installId: '123-456',
      events: expect.arrayContaining([expect.objectContaining({ seq: 1 }), expect.objectContaining({ seq: 17 })]),
    });
    expect(requestBody(fetchImpl).events).toHaveLength(17);

    await sink.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('session_end starts a flush before send returns', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 1, lo: 2 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);

    sink.send(screenView(1));
    sink.send(sessionEnd(2));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requestBody(fetchImpl).events.map((event) => event.name)).toEqual([
      'screen_view',
      'session_end',
    ]);
    await sink.flush();
  });

  test('the first app_open starts one flush with app_open included', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 1, lo: 2 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);

    sink.send(appOpen(1));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requestBody(fetchImpl).events).toEqual([
      expect.objectContaining({ name: 'app_open', seq: 1 }),
    ]);
    await sink.flush();

    sink.send(appOpen(2));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('background calls fetch synchronously inside the AppState callback without advancing timers', async () => {
    jest.useFakeTimers();
    const appState = new FakeAppState();
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState,
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 1, lo: 2 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);
    sink.send(screenView(1));

    appState.change('background');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    await sink.flush();
  });
});

describe('failure retention', () => {
  test('one rejection retries immediately; two rejections retain the full batch for the next trigger', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValueOnce({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 123, lo: 456 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);
    sink.send(screenView(1));
    sink.send(screenView(2));

    await expect(sink.flush()).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchImpl, 0)).toEqual(requestBody(fetchImpl, 1));

    await expect(sink.flush()).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(requestBody(fetchImpl, 2).events.map((event) => event.seq)).toEqual([1, 2]);
  });

  test('a non-2xx response also receives exactly one immediate retry', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 1, lo: 2 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);
    sink.send(screenView(1));

    await expect(sink.flush()).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('bounded schema-only payload', () => {
  test('10,000 sends retain at most cap events and keep the newest ones', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 1, lo: 2 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);

    for (let seq = 1; seq <= 10_000; seq += 1) sink.send(screenView(seq));
    await sink.flush();

    const events = requestBody(fetchImpl).events;
    expect(events).toHaveLength(HTTP_SINK_CAP);
    expect(events[0].seq).toBe(10_000 - HTTP_SINK_CAP + 1);
    expect(events[HTTP_SINK_CAP - 1].seq).toBe(10_000);
  });

  test('serialization strips every property outside the envelope and EventSchema', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const sink = createHttpSink({
      url: 'https://example.test/ingest',
      fetchImpl,
      appState: new FakeAppState(),
      consentGranted: () => true,
      killed: () => false,
      installId: { hi: 123, lo: 456 },
      cap: HTTP_SINK_CAP,
    });
    sinks.push(sink);
    sink.send({
      ...screenView(1),
      advertisingId: 'forbidden',
      gaid: 'forbidden',
      idfa: 'forbidden',
      ip: 'forbidden',
      deviceId: 'forbidden',
      extra: 'forbidden',
    } as EnvelopedEvent);

    await sink.flush();

    const body = requestBody(fetchImpl);
    expect(Object.keys(body).sort()).toEqual(['events', 'installId']);
    expect(Object.keys(body.events[0]).sort()).toEqual(
      [
        'name',
        'ts',
        'seq',
        'sessionIndex',
        'bucket',
        'schemaVersion',
        ...Object.keys(EventSchema.screen_view),
      ].sort(),
    );
    const serialized = JSON.stringify(body);
    for (const forbidden of ['advertisingId', 'gaid', 'idfa', 'ip', 'deviceId', 'extra']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

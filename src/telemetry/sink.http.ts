import { TELEMETRY_TRANSPORT } from '../featureFlags';
import { EnvelopedEvent, EventSchema } from './events';
import type { TelemetrySink } from './telemetry';

/** W6-15 owns choosing and compiling in the first-party ingest endpoint. */
export const TELEMETRY_ENDPOINT_URL = '';

/** OWNER-PICKED STARTING VALUE: maximum unsent events retained in memory. */
export const HTTP_SINK_CAP = 500;

export interface HttpAppState {
  addEventListener(
    type: 'change',
    listener: (state: string) => void,
  ): { remove(): void };
}

export type HttpFetch = (
  url: string,
  init: RequestInit,
) => Promise<{ readonly ok: boolean }>;

export interface HttpSinkOptions {
  readonly url: string;
  readonly fetchImpl: HttpFetch;
  readonly appState: HttpAppState;
  readonly consentGranted: () => boolean;
  readonly killed: () => boolean;
  readonly installId: Readonly<{ hi: number; lo: number }>;
  readonly cap: number;
}

export interface HttpSink {
  readonly send: TelemetrySink;
  flush(): Promise<void>;
  dispose(): void;
}

const ENVELOPE_KEYS = [
  'name',
  'ts',
  'seq',
  'sessionIndex',
  'bucket',
  'schemaVersion',
] as const;

interface QueueEntry {
  readonly id: number;
  readonly event: Readonly<Record<string, unknown>>;
}

function serializedEvent(event: EnvelopedEvent): Readonly<Record<string, unknown>> | null {
  if (!Object.prototype.hasOwnProperty.call(EventSchema, event.name)) return null;

  const source = event as unknown as Record<string, unknown>;
  const serialized: Record<string, unknown> = {};
  for (const key of ENVELOPE_KEYS) serialized[key] = source[key];
  for (const key of Object.keys(EventSchema[event.name])) serialized[key] = source[key];
  return serialized;
}

/**
 * A bounded, in-memory HTTP transport. Every platform edge is injected so
 * node Jest can exercise lifecycle and network behavior without React Native.
 */
export function createHttpSink(options: HttpSinkOptions): HttpSink {
  let queue: QueueEntry[] = [];
  let nextEntryId = 1;
  let appOpenFlushed = false;
  let inFlight: Promise<void> | null = null;
  const cap = Math.max(0, Math.floor(options.cap));

  const gateOpen = (): boolean => {
    if (!TELEMETRY_TRANSPORT || options.url === '') return false;
    try {
      return options.consentGranted() && !options.killed();
    } catch {
      return false;
    }
  };

  const attempt = (body: string): Promise<boolean> => {
    if (!gateOpen()) return Promise.resolve(false);
    try {
      return Promise.resolve(
        options.fetchImpl(options.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      )
        .then((response) => response.ok)
        .catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  };

  const flush = (): Promise<void> => {
    if (!gateOpen() || queue.length === 0) return Promise.resolve();
    if (inFlight) return inFlight;

    const batch = queue.slice();
    const lastBatchId = batch[batch.length - 1].id;
    const body = JSON.stringify({
      installId: `${options.installId.hi}-${options.installId.lo}`,
      events: batch.map((entry) => entry.event),
    });

    // `attempt` invokes fetchImpl before returning its promise. Keeping this
    // call outside any timer or deferred callback is what makes the AppState
    // listener start the POST synchronously before Android pauses JS.
    const operation = attempt(body)
      .then((sent) => (sent ? true : attempt(body)))
      .then((sent) => {
        if (sent) queue = queue.filter((entry) => entry.id > lastBatchId);
      })
      .catch(() => {});
    const tracked = operation.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });
    inFlight = tracked;
    return tracked;
  };

  const send: TelemetrySink = (event) => {
    if (!gateOpen()) return;
    const wireEvent = serializedEvent(event);
    if (!wireEvent) return;

    queue.push({ id: nextEntryId, event: wireEvent });
    nextEntryId += 1;
    if (queue.length > cap) queue.splice(0, queue.length - cap);

    if (event.name === 'session_end') {
      void flush();
    } else if (event.name === 'app_open' && !appOpenFlushed) {
      appOpenFlushed = true;
      void flush();
    }
  };

  const appStateSubscription = options.appState.addEventListener('change', (state) => {
    if (state === 'background') void flush();
  });

  return {
    send,
    flush,
    dispose: () => appStateSubscription.remove(),
  };
}

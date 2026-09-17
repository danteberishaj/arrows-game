/**
 * The pluggable telemetry sink (W6-04). Nothing in this module persists or
 * sends anything: the default sink is `noopSink`, and no other file imports
 * this module yet, so shipping it changes no runtime behaviour.
 *
 * W6-06 (emitting from the game), W6-05/W6-07 (persistence) and W6-14
 * (transport, which alone attaches the install id) are separate tasks.
 */
import { EventName, EventProps, EventSchema, EnvelopedEvent, FieldSpec } from './events';

export type TelemetrySink = (event: EnvelopedEvent) => void;

/** The default sink: does nothing. `emit` special-cases this sink to skip
 * all envelope construction, so it never allocates. */
export const noopSink: TelemetrySink = () => {};

/** A bounded in-memory sink for dev-only consumers (a future `__DEV__`
 * console log, a debug overlay). Not wired to anything by this task. */
export interface MemorySink extends TelemetrySink {
  readonly events: readonly EnvelopedEvent[];
}

export function createMemorySink(cap: number): MemorySink {
  const buffer: EnvelopedEvent[] = [];
  const sink = ((event: EnvelopedEvent) => {
    buffer.push(event);
    if (buffer.length > cap) {
      buffer.shift();
    }
  }) as MemorySink;
  Object.defineProperty(sink, 'events', {
    get: () => buffer.slice(),
  });
  return sink;
}

interface TelemetryConfig {
  validate: boolean;
  disabled: boolean;
}

function defaultValidate(): boolean {
  // __DEV__ is a React Native/Metro global; plain-node test runs don't
  // define it, so validation defaults to off there rather than throwing
  // ReferenceError.
  return typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : false;
}

let config: TelemetryConfig = { validate: defaultValidate(), disabled: false };
let currentSink: TelemetrySink = noopSink;
let seq = 0;

/** Bumped only if the schema shape changes incompatibly; nothing currently
 * reads it back, so a bump here is safe to make in the same commit as a
 * schema change. */
const SCHEMA_VERSION = 1;

function isKnownEventName(name: string): name is EventName {
  return Object.prototype.hasOwnProperty.call(EventSchema, name);
}

function matchesKind(spec: FieldSpec, value: unknown): boolean {
  switch (spec.kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value);
    default:
      return false;
  }
}

type SchemaCheck = { ok: true } | { ok: false; reason: string };

/** Checks an event against the schema: an unknown name, an unknown
 * property, a missing property, or a property of the wrong kind are all
 * "outside the schema". Never throws itself — the caller decides whether a
 * failure throws (`validate: true`) or is dropped silently (`validate: false`). */
function checkEvent(name: string, props: Record<string, unknown> | undefined): SchemaCheck {
  if (!isKnownEventName(name)) {
    return { ok: false, reason: `unknown event "${name}"` };
  }
  const fields: Record<string, FieldSpec> = EventSchema[name];
  const allowedKeys = Object.keys(fields);
  const given = props ?? {};
  const givenKeys = Object.keys(given);

  for (const key of givenKeys) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, reason: `event "${name}" has an unknown property "${key}"` };
    }
  }
  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(given, key)) {
      return { ok: false, reason: `event "${name}" is missing property "${key}"` };
    }
    if (!matchesKind(fields[key], given[key])) {
      return { ok: false, reason: `event "${name}" property "${key}" has the wrong kind` };
    }
  }
  return { ok: true };
}

export const Telemetry = {
  /** `validate` defaults to `__DEV__` when defined, otherwise `false`.
   * `disabled` is meant to be set by `App.tsx` when `PERF_MODE` is on
   * (wiring that is out of this task's scope — nothing imports this module
   * yet). */
  configure(next: Partial<TelemetryConfig>): void {
    config = { ...config, ...next };
  },

  useSink(sink: TelemetrySink): void {
    currentSink = sink;
  },

  emit<N extends EventName>(name: N, props: EventProps<N>): void {
    // Never allocates when disabled or when the sink is noopSink: bail
    // before building the envelope or touching the schema.
    if (config.disabled || currentSink === noopSink) {
      return;
    }
    const check = checkEvent(name, props as unknown as Record<string, unknown>);
    if (!check.ok) {
      if (config.validate) {
        throw new Error(`Telemetry: ${check.reason}`);
      }
      return; // dropped silently
    }

    seq += 1;
    const envelope: EnvelopedEvent<N> = {
      name,
      ts: Date.now(),
      seq,
      // OWNER-PICKED STARTING VALUE: session tracking lands with W6-06;
      // until then every event carries session 0 / bucket 0.
      sessionIndex: 0,
      bucket: 0,
      schemaVersion: SCHEMA_VERSION,
      ...props,
    };
    currentSink(envelope);
  },
};

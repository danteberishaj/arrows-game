/**
 * The typed event schema for Arrows telemetry (NEXT-LEVEL-PLAN §1.4, W6-04).
 *
 * The app currently has no analytics, so none of W1 (does the tutorial
 * teach), W3 (is the curve right) or W4 (does the daily bring players back)
 * can be shown true or false on real players. This schema exists to answer,
 * once W6-06/W6-14 wire it up:
 *   - the install -> first-clear funnel (app_open, level_start, level_end);
 *   - taps and blocked taps per level (level_end.taps/tapsBlocked/...);
 *   - hearts lost per level (level_end.heartsLost);
 *   - the hearts-left-on-clear distribution (level_end.heartsLeft where
 *     outcome === 'cleared');
 *   - the level index where players stop (level_end.levelIndex on the last
 *     event of a session, session_end.lastLevelIndex);
 *   - session length (session_end.durationMs);
 *   - ad shown vs not-ready vs killed (ad_result.outcome).
 *
 * "Puzzle depth" and a `difficulty` tier are deliberately not modeled: the
 * plan measured tier bands as overlapping almost completely, and W3 may
 * remove the label entirely (owner ruling, Track A).
 *
 * `shapeName` must always be a catalogue name from `src/core/shapeLibrary.ts`
 * (`ShapeDef.name`), never user input.
 *
 * This module only defines the schema and does not emit anything — see
 * `telemetry.ts` for `Telemetry.emit` and the pluggable sink.
 */

/** A field's allowed value kind, checked by `telemetry.ts` when validation is on. */
export type FieldSpec<T = unknown> = Readonly<
  | { readonly kind: 'string'; readonly __type?: T }
  | { readonly kind: 'number'; readonly __type?: T }
  | { readonly kind: 'boolean'; readonly __type?: T }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly __type?: T }
>;

function str(): FieldSpec<string> {
  return Object.freeze({ kind: 'string' });
}
function num(): FieldSpec<number> {
  return Object.freeze({ kind: 'number' });
}
function bool(): FieldSpec<boolean> {
  return Object.freeze({ kind: 'boolean' });
}
function enumOf<V extends string>(...values: readonly V[]): FieldSpec<V> {
  return Object.freeze({ kind: 'enum', values: Object.freeze(values) as readonly string[] });
}

type EventFields = Readonly<Record<string, FieldSpec<unknown>>>;

/** Extracts the TS prop type for one event's field-spec object. */
type InferProps<S extends EventFields> = { [K in keyof S]: S[K] extends FieldSpec<infer T> ? T : never };

const schemaDef = {
  app_open: {
    cold: bool(),
    sessionIndex: num(),
    appVersion: str(),
    bucket: num(),
  },
  screen_view: {
    screen: enumOf('splash', 'menu', 'game'),
  },
  level_start: {
    levelIndex: num(),
    arrowCount: num(),
    shapeName: str(),
    heartsMax: num(),
    mode: enumOf('campaign', 'tutorial', 'daily'),
  },
  level_end: {
    levelIndex: num(),
    mode: enumOf('campaign', 'tutorial', 'daily'),
    outcome: enumOf('cleared', 'out_of_hearts', 'abandoned'),
    taps: num(),
    tapsExit: num(),
    tapsBlocked: num(),
    tapsGhost: num(),
    tapsMiss: num(),
    heartsLost: num(),
    heartsLeft: num(),
    heartsMax: num(),
    durationMs: num(),
    hintsUsed: num(),
    continuesUsed: num(),
  },
  session_end: {
    durationMs: num(),
    levelsStarted: num(),
    levelsCleared: num(),
    lastLevelIndex: num(),
  },
  ad_request: {
    format: enumOf('interstitial', 'rewarded'),
    placement: enumOf('between_levels', 'continue', 'hint'),
  },
  ad_result: {
    format: enumOf('interstitial', 'rewarded'),
    placement: enumOf('between_levels', 'continue', 'hint'),
    outcome: enumOf('shown', 'not_ready', 'killed', 'display_failed', 'dismissed'),
  },
  ad_reward: {
    // OWNER-PICKED STARTING VALUE: `earned` as boolean (reward granted or
    // not); the brief names the key but not its kind.
    placement: enumOf('continue', 'hint'),
    earned: bool(),
  },
  error: {
    kind: enumOf('js_fatal'),
    nameMessageHash: num(),
    screen: enumOf('splash', 'menu', 'game'),
    count: num(),
  },
} as const;

function deepFreeze<T>(value: T): Readonly<T> {
  Object.freeze(value);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as object)) {
      const child = (value as Record<string, unknown>)[key];
      if (child && typeof child === 'object' && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

/**
 * The frozen source of truth: event name -> exact property keys and allowed
 * value kinds. `Object.isFrozen(EventSchema)` holds, and so does every
 * per-event entry (and every field spec inside it).
 */
export const EventSchema: typeof schemaDef = deepFreeze(schemaDef);

export type EventName = keyof typeof EventSchema;

/** The discriminated union of every event, including its `name` tag. */
export type TelemetryEvent = {
  [N in EventName]: { name: N } & InferProps<(typeof EventSchema)[N]>;
}[EventName];

/** The props payload for one event (everything but `name`), as passed to `Telemetry.emit`. */
export type EventProps<N extends EventName> = Omit<Extract<TelemetryEvent, { name: N }>, 'name'>;

/** The envelope every emitted event carries. The install id is deliberately
 * NOT here: only the transport (W6-14) attaches it, and only when it sends. */
export interface TelemetryEnvelope<N extends EventName = EventName> {
  readonly name: N;
  readonly ts: number;
  readonly seq: number;
  readonly sessionIndex: number;
  readonly bucket: number;
  readonly schemaVersion: number;
}

/** What a sink receives: the envelope merged with the event's own props. */
export type EnvelopedEvent<N extends EventName = EventName> = TelemetryEnvelope<N> &
  EventProps<N>;

/**
 * W6-02 remote kill switch (client side). See docs/remote-config.md.
 *
 * One small JSON file, fetched once per cold start, can turn ads (all,
 * interstitials only, rewarded only) and the telemetry transport OFF without a
 * new build. It can never turn anything on beyond the compiled behaviour, and
 * it carries no pacing, sample rate or targeting: only a literal `false` acts.
 *
 * - Versions only move up: a payload is accepted only when its `configVersion`
 *   is above the cached one, so a stale CDN copy cannot undo a newer kill.
 * - The accepted bits are persisted (SaveSystem, `arrows_rc_kill_bits` and
 *   `arrows_rc_version`) and seeded into memory at boot, so a cached kill
 *   applies from the first ad decision of the next cold start, even offline.
 * - With REMOTE_KILL_SWITCH false or an empty URL, no request is made and every
 *   getter returns the compiled default (nothing killed), even with kill bits
 *   persisted. That is the rollback.
 *
 * Pure TS (no react-native import), so all of it runs under node jest.
 */
import { SaveSystem } from '../core/saveSystem';
import { REMOTE_KILL_SWITCH } from '../featureFlags';
import { PERF_MODE } from '../perfMode';

/**
 * The config file URL, inlined by Expo at bundle time. Empty in the committed
 * build (no request); W6-03 compiles in the real URL.
 */
export const REMOTE_CONFIG_URL: string = process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL ?? '';

/** Largest accepted body, in UTF-8 bytes. */
export const REMOTE_CONFIG_MAX_BYTES = 4096; // OWNER-PICKED STARTING VALUE

/** The request is aborted after this long. */
export const REMOTE_CONFIG_TIMEOUT_MS = 3000; // OWNER-PICKED STARTING VALUE

/** Kill bits, persisted as one int. Bits are a save format: never renumber. */
export const KillBit = Object.freeze({
  /** `adsEnabled: false`: no AdMob init, no interstitial, no rewarded. */
  ads: 1,
  /** `interstitialsEnabled: false`. */
  interstitials: 2,
  /** `rewardedEnabled: false`. */
  rewarded: 4,
  /** `telemetryEnabled: false` (the W6-14 transport). */
  telemetry: 8,
});

const KNOWN_BITS = KillBit.ads | KillBit.interstitials | KillBit.rewarded | KillBit.telemetry;

export interface RemoteConfigState {
  /** `configVersion` of the payload; 0 = never fetched. */
  version: number;
  killBits: number;
}

/** The subset of a fetch Response the client reads. */
export interface ResponseLike {
  ok: boolean;
  status?: number;
  headers?: { get(name: string): string | null } | null;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers?: Record<string, string> },
) => Promise<ResponseLike>;

/**
 * - `off`: flag off, URL empty or perf build (no request);
 * - `accepted`: a newer version replaced the cache;
 * - `ignored`: a valid payload whose version is not above the cache;
 * - `rejected`: a 2xx body over the cap or not a valid payload;
 * - `http-error`: a non-2xx status; `timeout`; `error`: the request failed.
 */
export type RemoteConfigOutcome =
  | 'off'
  | 'accepted'
  | 'ignored'
  | 'rejected'
  | 'http-error'
  | 'timeout'
  | 'error';

function utf8ByteLength(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Parses the response text (or an already-decoded value) into kill bits.
 * Returns null for anything that is not an object with a safe-integer
 * `configVersion` >= 1. A text body over `maxBytes` is rejected before
 * JSON.parse. Only a literal `false` sets a bit; a missing key, a wrong type or
 * `true` leaves that feature enabled. Unknown keys are ignored. Never throws.
 */
export function parseRemoteConfig(
  raw: unknown,
  maxBytes: number = REMOTE_CONFIG_MAX_BYTES,
): RemoteConfigState | null {
  try {
    let value: unknown = raw;
    if (typeof raw === 'string') {
      // Cheap first check: UTF-8 bytes >= UTF-16 units.
      if (raw.length > maxBytes || utf8ByteLength(raw) > maxBytes) return null;
      value = JSON.parse(raw);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const payload = value as Record<string, unknown>;
    const version = payload.configVersion;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return null;
    const killBits =
      (payload.adsEnabled === false ? KillBit.ads : 0) |
      (payload.interstitialsEnabled === false ? KillBit.interstitials : 0) |
      (payload.rewardedEnabled === false ? KillBit.rewarded : 0) |
      (payload.telemetryEnabled === false ? KillBit.telemetry : 0);
    return { version, killBits };
  } catch {
    return null;
  }
}

/**
 * The monotone rule: a parsed payload replaces the cache only when its version
 * is strictly higher. Returns the cached object itself when nothing changes.
 */
export function applyFetched(
  parsed: RemoteConfigState | null,
  cached: RemoteConfigState,
): RemoteConfigState {
  if (parsed === null || parsed.version <= cached.version) return cached;
  return { version: parsed.version, killBits: parsed.killBits & KNOWN_BITS };
}

export interface RemoteConfigInitOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface RemoteConfigClient {
  /**
   * Call once, after initSaveSystem() settles. Seeds the getters from the
   * persisted bits synchronously (before the first await), then fetches once.
   * Fire-and-forget: the promise never rejects.
   */
  init(options?: RemoteConfigInitOptions): Promise<RemoteConfigOutcome>;
  /** Effective kill bits; 0 when the flag is off or the URL is empty. */
  killBits(): number;
  /** configVersion in effect; 0 when never fetched, the flag is off or the URL is empty. */
  version(): number;
  adsKilled(): boolean;
  /** True when interstitials or all ads are killed. */
  interstitialsKilled(): boolean;
  /** True when rewarded or all ads are killed. */
  rewardedKilled(): boolean;
  telemetryKilled(): boolean;
  /** Called after an accepted payload changes the state. Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
}

export function createRemoteConfig({
  enabled,
  url,
  perfMode,
  log = () => {},
}: {
  enabled: boolean;
  url: string;
  perfMode: boolean;
  log?: (message: string) => void;
}): RemoteConfigClient {
  // Rollback rule: with the flag off or no URL, the getters ignore the state.
  const active = enabled && url !== '';
  let state: RemoteConfigState = { version: 0, killBits: 0 };
  let started: Promise<RemoteConfigOutcome> | null = null;
  const subscribers = new Set<() => void>();

  const bits = () => (active ? state.killBits : 0);
  const has = (mask: number) => (bits() & mask) !== 0;

  function seedFromSave(): void {
    state = { version: SaveSystem.rcVersion, killBits: SaveSystem.rcKillBits & KNOWN_BITS };
    log(`[rc] seeded version=${state.version} bits=${state.killBits} active=${active}`);
  }

  async function fetchOnce(fetchImpl: FetchLike, timeoutMs: number): Promise<RemoteConfigOutcome> {
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve('timeout');
      }, timeoutMs);
    });

    const request = (async (): Promise<RemoteConfigOutcome> => {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return 'http-error';
      const declared = Number(res.headers?.get('content-length') ?? Number.NaN);
      if (Number.isFinite(declared) && declared > REMOTE_CONFIG_MAX_BYTES) return 'rejected';
      const text = await res.text();
      if (timedOut) return 'timeout';
      const parsed = parseRemoteConfig(text);
      if (parsed === null) return 'rejected';
      const next = applyFetched(parsed, state);
      if (next === state) {
        log(`[rc] ignored version=${parsed.version} (cached ${state.version})`);
        return 'ignored';
      }
      state = next;
      SaveSystem.setRcKillBits(next.killBits);
      SaveSystem.setRcVersion(next.version);
      log(`[rc] accepted version=${next.version} bits=${next.killBits}`);
      for (const cb of [...subscribers]) {
        try {
          cb();
        } catch {
          /* a subscriber must not break the client */
        }
      }
      return 'accepted';
    })().catch((): RemoteConfigOutcome => (timedOut ? 'timeout' : 'error'));

    try {
      return await Promise.race([request, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    init({ fetchImpl, timeoutMs = REMOTE_CONFIG_TIMEOUT_MS } = {}) {
      if (started) return started;
      seedFromSave();
      if (!active || perfMode) {
        started = Promise.resolve<RemoteConfigOutcome>('off');
        return started;
      }
      const impl: FetchLike | undefined =
        fetchImpl ?? (typeof fetch === 'function' ? (fetch as unknown as FetchLike) : undefined);
      started = impl
        ? fetchOnce(impl, timeoutMs).then(
            (outcome) => {
              log(`[rc] fetch outcome=${outcome}`);
              return outcome;
            },
            (): RemoteConfigOutcome => 'error',
          )
        : Promise.resolve<RemoteConfigOutcome>('error');
      return started;
    },
    killBits: bits,
    version: () => (active ? state.version : 0),
    adsKilled: () => has(KillBit.ads),
    interstitialsKilled: () => has(KillBit.ads | KillBit.interstitials),
    rewardedKilled: () => has(KillBit.ads | KillBit.rewarded),
    telemetryKilled: () => has(KillBit.telemetry),
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

/** Development-only log line (release builds print nothing). */
function devLog(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(message);
}

/** The app's client, bound to the committed flag, the inlined URL and perf mode. */
export const RemoteConfig: RemoteConfigClient = createRemoteConfig({
  enabled: REMOTE_KILL_SWITCH,
  url: REMOTE_CONFIG_URL,
  perfMode: PERF_MODE,
  log: devLog,
});

/** Starts the app client (see RemoteConfigClient.init). */
export function initRemoteConfig(options?: RemoteConfigInitOptions): Promise<RemoteConfigOutcome> {
  return RemoteConfig.init(options);
}

/**
 * W6-02: the remote kill switch client (parser, monotone apply, fetch, getters).
 *
 * Pure TS in node. The fetch is injected (`fetchImpl`), persistence goes through
 * SaveSystem over a Map-backed in-memory IntStore, and the flag, URL and perf
 * mode are injected through `createRemoteConfig`, so every branch runs here.
 * The exported `RemoteConfig` instance is also checked against the committed
 * flag (`REMOTE_KILL_SWITCH = false` makes no request).
 */
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { REMOTE_KILL_SWITCH } from '../../featureFlags';
import {
  KillBit,
  REMOTE_CONFIG_MAX_BYTES,
  RemoteConfig,
  applyFetched,
  createRemoteConfig,
  initRemoteConfig,
  parseRemoteConfig,
  type FetchLike,
  type RemoteConfigState,
} from '../remoteConfig';

/** Map-backed IntStore (an in-memory store the assertions can read directly). */
class MemoryStore implements IntStore {
  readonly map = new Map<string, number>();
  getInt(key: string, defaultValue: number): number {
    const v = this.map.get(key);
    return v === undefined ? defaultValue : v;
  }
  setInt(key: string, value: number): void {
    this.map.set(key, value);
  }
  deleteKey(key: string): void {
    this.map.delete(key);
  }
}

const BITS_KEY = 'arrows_rc_kill_bits';
const VERSION_KEY = 'arrows_rc_version';
const URL = 'https://example.test/arrows-config.json';

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
  SaveSystem.useStore(store);
});

afterEach(() => {
  jest.useRealTimers();
});

function body(payload: unknown): string {
  return JSON.stringify(payload);
}

/** A fetch that answers once with `status` and `text`, recording every call. */
function respond(status: number, text: string, headers: Record<string, string> = {}) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    calls.push(url);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      text: () => Promise.resolve(text),
    });
  };
  return { fetchImpl, calls };
}

function client(overrides: Partial<Parameters<typeof createRemoteConfig>[0]> = {}) {
  return createRemoteConfig({ enabled: true, url: URL, perfMode: false, ...overrides });
}

function allGetters(rc: ReturnType<typeof createRemoteConfig>) {
  return {
    ads: rc.adsKilled(),
    interstitials: rc.interstitialsKilled(),
    rewarded: rc.rewardedKilled(),
    telemetry: rc.telemetryKilled(),
  };
}

const NOTHING_KILLED = { ads: false, interstitials: false, rewarded: false, telemetry: false };

// ---- parseRemoteConfig -------------------------------------------------------

describe('parseRemoteConfig: hostile payloads', () => {
  const overCap = body({
    configVersion: 9,
    adsEnabled: false,
    padding: 'x'.repeat(REMOTE_CONFIG_MAX_BYTES),
  });

  const hostile: [string, unknown][] = [
    ['null', null],
    ['[]', []],
    ['"x"', 'x'],
    ['42', 42],
    ['NaN', NaN],
    ['{}', {}],
    ['{configVersion: 0}', { configVersion: 0 }],
    ['{configVersion: 1.5}', { configVersion: 1.5 }],
    ['{configVersion: "2"}', { configVersion: '2' }],
    ['{configVersion: 2, adsEnabled: "false"}', { configVersion: 2, adsEnabled: 'false' }],
    ['a body over the cap', overCap],
    ['an unknown extra key', { configVersion: 3, rewardedEnabled: false, gamesPerInterstitial: 1 }],
    // Also as the raw response text the client really passes in.
    ['"null" text', 'null'],
    ['"[]" text', '[]'],
    ['"42" text', '42'],
    ['"{}" text', '{}'],
    ['{configVersion: 0} text', body({ configVersion: 0 })],
    ['{configVersion: 1.5} text', body({ configVersion: 1.5 })],
    ['{configVersion: "2"} text', body({ configVersion: '2' })],
    ['adsEnabled "false" text', body({ configVersion: 2, adsEnabled: 'false' })],
    ['unknown key text', body({ configVersion: 3, rewardedEnabled: false, gamesPerInterstitial: 1 })],
    ['undefined', undefined],
    ['negative version', { configVersion: -4, adsEnabled: false }],
    ['Infinity version', { configVersion: Infinity, adsEnabled: false }],
    ['unsafe integer version', { configVersion: 2 ** 53, adsEnabled: false }],
    ['a throwing getter', Object.defineProperty({}, 'configVersion', { get: () => { throw new Error('trap'); } })],
    ['a null-prototype object', Object.assign(Object.create(null), { configVersion: 4, adsEnabled: false })],
    ['truncated JSON', '{"configVersion": 2, "adsEnabled": fal'],
    ['empty text', ''],
  ];

  test.each(hostile)('%s: returns null or only literal-false bits, never throws', (_label, raw) => {
    let result: RemoteConfigState | null = null;
    expect(() => {
      result = parseRemoteConfig(raw);
    }).not.toThrow();
    if (result === null) return;
    const r = result as RemoteConfigState;
    expect(Number.isSafeInteger(r.version) && r.version >= 1).toBe(true);
    expect(r.killBits & ~0b1111).toBe(0);
    // Every bit that is set must come from a literal `false` in the payload.
    const source = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
    const literalFalse =
      (source.adsEnabled === false ? KillBit.ads : 0) |
      (source.interstitialsEnabled === false ? KillBit.interstitials : 0) |
      (source.rewardedEnabled === false ? KillBit.rewarded : 0) |
      (source.telemetryEnabled === false ? KillBit.telemetry : 0);
    expect(r.killBits).toBe(literalFalse);
  });

  test('exact results for the listed cases', () => {
    expect(parseRemoteConfig(null)).toBeNull();
    expect(parseRemoteConfig([])).toBeNull();
    expect(parseRemoteConfig('x')).toBeNull();
    expect(parseRemoteConfig(42)).toBeNull();
    expect(parseRemoteConfig(NaN)).toBeNull();
    expect(parseRemoteConfig({})).toBeNull();
    expect(parseRemoteConfig({ configVersion: 0 })).toBeNull();
    expect(parseRemoteConfig({ configVersion: 1.5 })).toBeNull();
    expect(parseRemoteConfig({ configVersion: '2' })).toBeNull();
    expect(parseRemoteConfig({ configVersion: 2, adsEnabled: 'false' })).toEqual({ version: 2, killBits: 0 });
    expect(parseRemoteConfig(overCap)).toBeNull();
    expect(parseRemoteConfig({ configVersion: 3, rewardedEnabled: false, gamesPerInterstitial: 1 })).toEqual({
      version: 3,
      killBits: KillBit.rewarded,
    });
  });

  test('a body over the cap is rejected before JSON.parse', () => {
    const spy = jest.spyOn(JSON, 'parse');
    try {
      expect(parseRemoteConfig(overCap)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test('the cap counts UTF-8 bytes, not UTF-16 units', () => {
    const prefix = body({ configVersion: 2, adsEnabled: false, n: '' });
    // "é" is 1 UTF-16 unit but 2 UTF-8 bytes: fill to just over the byte cap.
    const units = Math.ceil((REMOTE_CONFIG_MAX_BYTES - prefix.length) / 2) + 1;
    const multi = body({ configVersion: 2, adsEnabled: false, n: 'é'.repeat(units) });
    expect(multi.length).toBeLessThanOrEqual(REMOTE_CONFIG_MAX_BYTES);
    expect(parseRemoteConfig(multi)).toBeNull();
  });

  test('a body at exactly the cap is accepted', () => {
    const base = body({ configVersion: 2, adsEnabled: false, n: '' });
    const exact = body({ configVersion: 2, adsEnabled: false, n: 'x'.repeat(REMOTE_CONFIG_MAX_BYTES - base.length) });
    expect(exact.length).toBe(REMOTE_CONFIG_MAX_BYTES);
    expect(parseRemoteConfig(exact)).toEqual({ version: 2, killBits: KillBit.ads });
  });

  test.each([
    ['adsEnabled', KillBit.ads],
    ['interstitialsEnabled', KillBit.interstitials],
    ['rewardedEnabled', KillBit.rewarded],
    ['telemetryEnabled', KillBit.telemetry],
  ] as const)('only a literal false on %s sets its bit', (key, bit) => {
    expect(parseRemoteConfig({ configVersion: 1, [key]: false })).toEqual({ version: 1, killBits: bit });
    for (const notFalse of [true, 'false', 0, null, undefined, {}, []]) {
      expect(parseRemoteConfig({ configVersion: 1, [key]: notFalse })).toEqual({ version: 1, killBits: 0 });
    }
  });

  test('every feature false sets all four bits; every feature true sets none', () => {
    const all = { adsEnabled: false, interstitialsEnabled: false, rewardedEnabled: false, telemetryEnabled: false };
    expect(parseRemoteConfig({ configVersion: 7, ...all })).toEqual({ version: 7, killBits: 0b1111 });
    expect(
      parseRemoteConfig({ configVersion: 8, adsEnabled: true, interstitialsEnabled: true, rewardedEnabled: true, telemetryEnabled: true }),
    ).toEqual({ version: 8, killBits: 0 });
  });
});

// ---- applyFetched --------------------------------------------------------------

describe('applyFetched: versions only move up', () => {
  const cached: RemoteConfigState = { version: 5, killBits: KillBit.ads };

  test('a lower version is ignored', () => {
    expect(applyFetched({ version: 4, killBits: 0 }, cached)).toBe(cached);
  });

  test('an equal version is ignored', () => {
    expect(applyFetched({ version: 5, killBits: 0 }, cached)).toBe(cached);
  });

  test('a higher version replaces the cache', () => {
    expect(applyFetched({ version: 6, killBits: 0 }, cached)).toEqual({ version: 6, killBits: 0 });
  });

  test('null (a rejected payload) keeps the cache', () => {
    expect(applyFetched(null, cached)).toBe(cached);
  });
});

// ---- the client ----------------------------------------------------------------

describe('initRemoteConfig: fetch outcomes', () => {
  test('nothing cached and no fetch yet: every getter reports not killed', () => {
    const rc = client();
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
  });

  test('a higher version replaces the cache and is written through the SaveSystem setters', async () => {
    const rc = client();
    const { fetchImpl, calls } = respond(200, body({ configVersion: 2, adsEnabled: false }));
    await rc.init({ fetchImpl });
    expect(calls).toEqual([URL]);
    expect(rc.adsKilled()).toBe(true);
    expect(store.map.get(BITS_KEY)).toBe(KillBit.ads);
    expect(store.map.get(VERSION_KEY)).toBe(2);
    expect(SaveSystem.rcKillBits).toBe(KillBit.ads);
    expect(SaveSystem.rcVersion).toBe(2);
  });

  test.each([
    ['lower', 3],
    ['equal', 4],
  ])('a %s version than the cached one is ignored and nothing is written', async (_label, version) => {
    store.map.set(BITS_KEY, KillBit.rewarded);
    store.map.set(VERSION_KEY, 4);
    const rc = client();
    const setBits = jest.spyOn(SaveSystem, 'setRcKillBits');
    const setVersion = jest.spyOn(SaveSystem, 'setRcVersion');
    try {
      await rc.init({ fetchImpl: respond(200, body({ configVersion: version, adsEnabled: false })).fetchImpl });
      expect(rc.killBits()).toBe(KillBit.rewarded);
      expect(rc.version()).toBe(4);
      expect(store.map.get(BITS_KEY)).toBe(KillBit.rewarded);
      expect(store.map.get(VERSION_KEY)).toBe(4);
      expect(setBits).not.toHaveBeenCalled();
      expect(setVersion).not.toHaveBeenCalled();
    } finally {
      setBits.mockRestore();
      setVersion.mockRestore();
    }
  });

  test('re-enable: a higher version with every feature true clears a cached kill', async () => {
    store.map.set(BITS_KEY, KillBit.ads);
    store.map.set(VERSION_KEY, 2);
    const rc = client();
    await rc.init({ fetchImpl: respond(200, body({ configVersion: 3, adsEnabled: true })).fetchImpl });
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
    expect(store.map.get(BITS_KEY)).toBe(0);
    expect(store.map.get(VERSION_KEY)).toBe(3);
  });

  test('a fetch that rejects leaves the cached bits unchanged', async () => {
    store.map.set(BITS_KEY, KillBit.interstitials);
    store.map.set(VERSION_KEY, 2);
    const rc = client();
    const outcome = await rc.init({ fetchImpl: () => Promise.reject(new TypeError('Network request failed')) });
    expect(outcome).toBe('error');
    expect(rc.killBits()).toBe(KillBit.interstitials);
    expect(store.map.get(BITS_KEY)).toBe(KillBit.interstitials);
  });

  test('a fetch that throws synchronously never escapes', async () => {
    const rc = client();
    const outcome = await rc.init({
      fetchImpl: () => {
        throw new Error('sync throw');
      },
    });
    expect(outcome).toBe('error');
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
  });

  test('with nothing cached, a rejected fetch leaves every getter not killed', async () => {
    const rc = client();
    await rc.init({ fetchImpl: () => Promise.reject(new Error('offline')) });
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
    expect(store.map.has(BITS_KEY)).toBe(false);
  });

  test.each([404, 500, 304, 199])('HTTP %i with a kill body leaves the cached bits unchanged', async (status) => {
    store.map.set(BITS_KEY, 0);
    store.map.set(VERSION_KEY, 1);
    const rc = client();
    const outcome = await rc.init({
      fetchImpl: respond(status, body({ configVersion: 9, adsEnabled: false })).fetchImpl,
    });
    expect(outcome).toBe('http-error');
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
    expect(store.map.get(VERSION_KEY)).toBe(1);
  });

  test('a timeout aborts the request and leaves the cached bits unchanged (fake timers)', async () => {
    jest.useFakeTimers();
    store.map.set(BITS_KEY, KillBit.telemetry);
    store.map.set(VERSION_KEY, 2);
    const rc = client();
    let aborted = false;
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('Aborted'));
        });
      });
    const done = rc.init({ fetchImpl, timeoutMs: 3000 });
    jest.advanceTimersByTime(2999);
    await Promise.resolve();
    expect(aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(await done).toBe('timeout');
    expect(aborted).toBe(true);
    expect(rc.killBits()).toBe(KillBit.telemetry);
    expect(store.map.get(VERSION_KEY)).toBe(2);
  });

  test('a fetch that ignores the abort still ends at the timeout, and its late answer is discarded', async () => {
    jest.useFakeTimers();
    const rc = client();
    let lateResolve: ((r: Awaited<ReturnType<FetchLike>>) => void) | null = null;
    const fetchImpl: FetchLike = () =>
      new Promise((resolve) => {
        lateResolve = resolve;
      });
    const done = rc.init({ fetchImpl, timeoutMs: 3000 });
    jest.advanceTimersByTime(3000);
    expect(await done).toBe('timeout');
    lateResolve!({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(body({ configVersion: 5, adsEnabled: false })),
    });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
    expect(store.map.has(VERSION_KEY)).toBe(false);
  });

  test('a body that fails to parse leaves the cache unchanged', async () => {
    store.map.set(BITS_KEY, KillBit.ads);
    store.map.set(VERSION_KEY, 2);
    const rc = client();
    const outcome = await rc.init({ fetchImpl: respond(200, '<html>502</html>').fetchImpl });
    expect(outcome).toBe('rejected');
    expect(rc.killBits()).toBe(KillBit.ads);
  });

  test('a Content-Length over the cap is rejected without reading the body', async () => {
    const rc = client();
    const text = jest.fn(() => Promise.resolve(body({ configVersion: 2, adsEnabled: false })));
    const outcome = await rc.init({
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: (n: string) => (n.toLowerCase() === 'content-length' ? String(REMOTE_CONFIG_MAX_BYTES + 1) : null) },
          text,
        }),
    });
    expect(outcome).toBe('rejected');
    expect(text).not.toHaveBeenCalled();
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
  });

  test('init runs the request once per process', async () => {
    const rc = client();
    const { fetchImpl, calls } = respond(200, body({ configVersion: 2 }));
    await rc.init({ fetchImpl });
    await rc.init({ fetchImpl });
    expect(calls).toHaveLength(1);
  });

  test('subscribers hear an accepted change, and not an ignored one', async () => {
    const rc = client();
    const seen: number[] = [];
    rc.subscribe(() => seen.push(rc.killBits()));
    await rc.init({ fetchImpl: respond(200, body({ configVersion: 2, rewardedEnabled: false })).fetchImpl });
    expect(seen).toEqual([KillBit.rewarded]);

    const again = client();
    const seenAgain: number[] = [];
    again.subscribe(() => seenAgain.push(again.killBits()));
    await again.init({ fetchImpl: respond(200, body({ configVersion: 2, adsEnabled: false })).fetchImpl });
    expect(seenAgain).toEqual([]); // version 2 is not above the cached 2
  });
});

describe('boot: a cached kill applies before any request settles', () => {
  // The never-settling fetch below leaves the 3 s abort timer pending: keep it fake.
  beforeEach(() => jest.useFakeTimers());

  test('init seeds the getters from the persisted bits synchronously, even offline', () => {
    store.map.set(BITS_KEY, KillBit.ads);
    store.map.set(VERSION_KEY, 2);
    const rc = client();
    expect(rc.adsKilled()).toBe(false); // not seeded before init (SaveSystem may not be hydrated yet)
    void rc.init({ fetchImpl: () => new Promise(() => {}) }); // never settles
    expect(rc.adsKilled()).toBe(true);
    expect(rc.interstitialsKilled()).toBe(true);
    expect(rc.rewardedKilled()).toBe(true);
    expect(rc.telemetryKilled()).toBe(false);
  });

  test.each([
    ['negative', -1, 0],
    ['NaN', NaN, 0],
    ['fractional', 2.5, 2],
  ])('a %s persisted version is read as a non-negative integer', (_label, v, expected) => {
    store.map.set(VERSION_KEY, v);
    store.map.set(BITS_KEY, -1); // corrupt bits read as 0, never as "everything killed"
    const rc = client();
    void rc.init({ fetchImpl: () => new Promise(() => {}) });
    expect(rc.version()).toBe(expected);
    expect(rc.killBits()).toBe(0);
  });

  test('persisted bits above bit 3 are ignored', () => {
    store.map.set(BITS_KEY, 0b110000 | KillBit.rewarded);
    store.map.set(VERSION_KEY, 3);
    const rc = client();
    void rc.init({ fetchImpl: () => new Promise(() => {}) });
    expect(rc.killBits()).toBe(KillBit.rewarded);
  });
});

describe('no request and compiled defaults', () => {
  test.each([
    ['REMOTE_KILL_SWITCH false', { enabled: false }],
    ['an empty URL', { url: '' }],
    ['perf mode', { perfMode: true }],
  ])('%s: the fetch is called 0 times', async (_label, overrides) => {
    const { fetchImpl, calls } = respond(200, body({ configVersion: 2, adsEnabled: false }));
    const rc = client(overrides);
    const outcome = await rc.init({ fetchImpl });
    expect(calls).toHaveLength(0);
    expect(outcome).toBe('off');
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
  });

  test('rollback: with the flag off, persisted kill bits are ignored by every getter', async () => {
    store.map.set(BITS_KEY, 0b1111);
    store.map.set(VERSION_KEY, 9);
    const rc = client({ enabled: false });
    await rc.init({ fetchImpl: respond(200, '{}').fetchImpl });
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
    expect(rc.killBits()).toBe(0);
    expect(store.map.get(BITS_KEY)).toBe(0b1111); // not deleted: a later flip back on restores it
  });

  test('an empty URL also ignores persisted kill bits', async () => {
    store.map.set(BITS_KEY, 0b1111);
    store.map.set(VERSION_KEY, 9);
    const rc = client({ url: '' });
    await rc.init({ fetchImpl: respond(200, '{}').fetchImpl });
    expect(allGetters(rc)).toEqual(NOTHING_KILLED);
  });

  test('the committed build: REMOTE_KILL_SWITCH is false and the exported client makes no request', async () => {
    expect(REMOTE_KILL_SWITCH).toBe(false);
    store.map.set(BITS_KEY, 0b1111);
    store.map.set(VERSION_KEY, 9);
    const { fetchImpl, calls } = respond(200, body({ configVersion: 10, adsEnabled: false }));
    await initRemoteConfig({ fetchImpl });
    expect(calls).toHaveLength(0);
    expect(RemoteConfig.adsKilled()).toBe(false);
    expect(RemoteConfig.killBits()).toBe(0);
  });
});

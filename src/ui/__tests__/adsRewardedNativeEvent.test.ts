/**
 * W0-02 fix round 2: a native rewarded "loaded" EVENT drives
 * `Ads.rewardedReady`, through the real ad-SDK JS.
 *
 * ADMOB-A: LevelPlay is removed, so this suite now runs through the real
 * react-native-google-mobile-ads JS (MobileAds, RewardedAd, MobileAd and the
 * shared event fan-out) and the real ./admobFacade, instead of the real
 * unity-levelplay-mediation JS. The assertions are the same ones the LevelPlay
 * version made; only the event plumbing below JS changed.
 *
 * Round 1 (adsRewardedReadiness.test.ts) replaced the whole SDK and called the
 * listener object directly. This suite keeps the package's real JS and replaces
 * only what sits below JS on a device:
 * - the TurboModules (`RNGoogleMobileAdsModule` init, `RNGoogleMobileAdsRewardedModule`
 *   load, `RNAppModule` listener registration);
 * - the device event bus (`NativeEventEmitter` over one shared listener map,
 *   like RCTDeviceEventEmitter), plus RN's Flow `EventEmitter` the package's
 *   SharedEventEmitter is built on.
 *
 * The event name, the loaded / error type strings and the event-body keys are
 * parsed from the package's Android sources: the rewarded module's
 * `getAdEventName()`, the classic full-screen module's `onAdLoaded` (rewarded
 * branch) and `onAdFailedToLoad`, `ReactNativeGoogleMobileAdsEvent.getEventBody()`
 * and the `rnapp_` prefix of `ReactNativeEventEmitter.emit`.
 * What stays outside: the native SDK calling `onAdLoaded` at all (needs fill).
 */
import * as fs from 'fs';
import * as path from 'path';

type Handler = (data: unknown) => void;

// One process-wide bus, like RCTDeviceEventEmitter (names must start with
// `mock` to be usable inside jest.mock factories).
const mockBus = new Map<string, Handler[]>();

interface MockNative {
  /** Event names JS registered through RNAppModule.eventsAddListener. */
  jsListeners: Set<string>;
  rewardedLoads: Array<{ requestId: number; adUnitId: string }>;
  initOutcome: 'success' | 'failed';
}

const mockNative: MockNative = {
  jsListeners: new Set(),
  rewardedLoads: [],
  initOutcome: 'success',
};

// ---- Android source of the installed package --------------------------------
const pkgRoot = path.dirname(require.resolve('react-native-google-mobile-ads/package.json'));
const javaDir = path.join(pkgRoot, 'android/src/main/java/io/invertase/googlemobileads');
const classicDir = path.join(pkgRoot, 'android/src/classic/java/io/invertase/googlemobileads');
const eventJava = fs.readFileSync(path.join(javaDir, 'ReactNativeGoogleMobileAdsEvent.java'), 'utf8');
const emitterJava = fs.readFileSync(path.join(javaDir, 'common/ReactNativeEventEmitter.java'), 'utf8');
const rewardedKt = fs.readFileSync(
  path.join(classicDir, 'ReactNativeGoogleMobileAdsRewardedModule.kt'),
  'utf8',
);
const fullScreenKt = fs.readFileSync(
  path.join(classicDir, 'ReactNativeGoogleMobileAdsFullScreenAdModule.kt'),
  'utf8',
);
const commonJava = fs.readFileSync(path.join(classicDir, 'ReactNativeGoogleMobileAdsCommon.java'), 'utf8');

/** `public static final String NAME = "value";` declarations. */
const javaConst: Record<string, string> = {};
for (const m of eventJava.matchAll(/static final String (\w+) =\s*"([^"]*)"/g)) javaConst[m[1]] = m[2];

/** The native event name the rewarded module sends on (`getAdEventName()`). */
function rewardedEventName(): string {
  const m = rewardedKt.match(/getAdEventName\(\): String = ReactNativeGoogleMobileAdsEvent\.(\w+)/);
  if (!m) throw new Error('no getAdEventName in the rewarded module');
  return javaConst[m[1]];
}

/** The event-type constant the classic module sends from one load callback. */
function loadCallbackType(callback: 'onAdLoaded' | 'onAdFailedToLoad'): string {
  const body = fullScreenKt.split(`override fun ${callback}(`)[1] ?? '';
  const re =
    callback === 'onAdLoaded'
      ? /if \(ad is RewardedAd[^{]*\{\s*eventType = ReactNativeGoogleMobileAdsEvent\.(\w+)/
      : /sendAdEvent\(\s*ReactNativeGoogleMobileAdsEvent\.(\w+)/;
  const m = body.match(re);
  if (!m) throw new Error(`no event type in Kotlin ${callback}`);
  return javaConst[m[1]];
}

/** The keys `ReactNativeGoogleMobileAdsEvent.getEventBody()` puts on the wire. */
function eventBodyKeys(): string[] {
  const block = eventJava.split('getEventBody()')[1].split('return event')[0];
  return [...block.matchAll(/event\.put\w+\((\w+),/g)].map((m) => {
    const key = eventJava.match(new RegExp(`${m[1]} = "(\\w+)"`));
    if (!key) throw new Error(`no value for ${m[1]}`);
    return key[1];
  });
}

/** The keys `buildAdErrorMap(code, message, phase)` puts on an error. */
function errorMapKeys(): string[] {
  const block = commonJava.split('WritableMap buildAdErrorMap(')[1].split('return map')[0];
  return [...block.matchAll(/map\.put\w+\("(\w+)"/g)].map((m) => m[1]);
}

/** The JS-side prefix `ReactNativeEventEmitter.emit` puts before the event name. */
function jsEventPrefix(): string {
  const m = emitterJava.match(/\.emit\("(\w+)" \+ event\.getEventName\(\)/);
  if (!m) throw new Error('no emit prefix');
  return m[1];
}

jest.mock('react-native', () => {
  const appModule = {
    eventsNotifyReady: () => {},
    eventsAddListener: (name: string) => mockNative.jsListeners.add(name),
    eventsRemoveListener: (name: string) => mockNative.jsListeners.delete(name),
    addListener: () => {},
    removeListeners: () => {},
  };
  const mobileAdsModule = {
    getConstants: () => ({ sdkVersion: '25.4.0' }),
    initialize: () =>
      mockNative.initOutcome === 'success'
        ? Promise.resolve([])
        : Promise.reject(new Error('initialize failed')),
    setRequestConfiguration: () => Promise.resolve(),
    openAdInspector: () => Promise.resolve(),
  };
  const rewardedModule = {
    rewardedLoad: (requestId: number, adUnitId: string) => {
      mockNative.rewardedLoads.push({ requestId, adUnitId });
    },
    rewardedShow: () => Promise.resolve(),
    rewardedDestroy: () => {},
  };
  const modules: Record<string, unknown> = {
    RNAppModule: appModule,
    RNGoogleMobileAdsModule: mobileAdsModule,
    RNGoogleMobileAdsRewardedModule: rewardedModule,
  };
  // Every other package module: constants are empty and calls resolve, like
  // an idle native module.
  const idle = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) => (prop === 'getConstants' ? () => ({}) : () => Promise.resolve(undefined)),
  });
  const getModule = (name: string) => modules[name] ?? idle;
  class NativeEventEmitter {
    addListener(name: string, h: Handler) {
      mockBus.set(name, [...(mockBus.get(name) ?? []), h]);
      return { remove: () => mockBus.set(name, (mockBus.get(name) ?? []).filter((x) => x !== h)) };
    }
    removeAllListeners(name: string) {
      mockBus.delete(name);
    }
  }
  return {
    Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android ?? o.default },
    Pressable: 'Pressable',
    Text: 'Text',
    View: 'View',
    StyleSheet: { create: <T>(s: T) => s },
    NativeEventEmitter,
    TurboModuleRegistry: { getEnforcing: getModule, get: getModule },
    NativeModules: {},
    codegenNativeComponent: () => 'NativeComponent',
    codegenNativeCommands: () => ({}),
    requireNativeComponent: () => 'NativeComponent',
    UIManager: {},
    findNodeHandle: () => null,
  };
});

// RN's Flow EventEmitter, which the package's SharedEventEmitter instantiates.
jest.mock('react-native/Libraries/vendor/emitter/EventEmitter', () => {
  class MockEventEmitter {
    private readonly map = new Map<string, Set<(...args: unknown[]) => void>>();
    addListener(name: string, fn: (...args: unknown[]) => void) {
      if (!this.map.has(name)) this.map.set(name, new Set());
      this.map.get(name)!.add(fn);
      return { remove: () => this.map.get(name)?.delete(fn) };
    }
    emit(name: string, ...args: unknown[]) {
      [...(this.map.get(name) ?? [])].forEach((fn) => fn(...args));
    }
    removeAllListeners(name?: string) {
      if (name === undefined) this.map.clear();
      else this.map.delete(name);
    }
    listenerCount(name: string) {
      return this.map.get(name)?.size ?? 0;
    }
  }
  return { __esModule: true, default: MockEventEmitter };
});

// The package's commonjs build requires its view specs as raw TypeScript
// (for Codegen), which a node_modules file cannot be transformed from here.
// The views are unused by this suite, so each spec becomes a plain stub.
jest.mock(
  '../../../node_modules/react-native-google-mobile-ads/lib/commonjs/specs/components/GoogleMobileAdsBannerViewNativeComponent',
  () => ({ __esModule: true, default: 'NativeComponent', Commands: {} }),
);
jest.mock(
  '../../../node_modules/react-native-google-mobile-ads/lib/commonjs/specs/components/GoogleMobileAdsMultiFormatBannerViewNativeComponent',
  () => ({ __esModule: true, default: 'NativeComponent', Commands: {} }),
);
jest.mock(
  '../../../node_modules/react-native-google-mobile-ads/lib/commonjs/specs/components/GoogleMobileAdsMediaViewNativeComponent',
  () => ({ __esModule: true, default: 'NativeComponent', Commands: {} }),
);
jest.mock(
  '../../../node_modules/react-native-google-mobile-ads/lib/commonjs/specs/components/GoogleMobileAdsNativeViewNativeComponent',
  () => ({ __esModule: true, default: 'NativeComponent', Commands: {} }),
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

type AdsModule = typeof import('../ads');

/**
 * A fresh ads.tsx + package JS (both keep module-level state), release build.
 * resetModules, not isolateModules: ads.tsx requires the facade lazily inside
 * initAds(), after an isolateModules callback would already have returned, so
 * the package (its request ids and bus subscriptions) would leak across tests.
 */
function loadAds(): AdsModule {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  jest.resetModules();
  return require('../ads') as AdsModule;
}

/**
 * What `ReactNativeEventEmitter.emit` delivers to JS for one
 * `sendAdEvent(event, requestId, type, adUnitId, error, data)`. Like the native
 * emitter, nothing is delivered for an event name JS never registered.
 */
function emitNative(
  requestId: number,
  adUnitId: string,
  type: string,
  extra: { error?: Record<string, unknown>; data?: Record<string, unknown> } = {},
): void {
  const eventName = rewardedEventName();
  if (!mockNative.jsListeners.has(eventName)) return;
  const [bodyKey, requestIdKey, unitKey, nameKey] = eventBodyKeys();
  const payload = {
    [bodyKey]: { type, ...extra },
    [requestIdKey]: requestId,
    [unitKey]: adUnitId,
    [nameKey]: eventName,
  };
  (mockBus.get(`${jsEventPrefix()}${eventName}`) ?? []).slice().forEach((h) => h(payload));
}

/** A load-failure error with exactly the keys `buildAdErrorMap` puts. */
function kotlinLoadError(): Record<string, unknown> {
  const values: Record<string, unknown> = {
    code: 'error-code-no-fill',
    message: 'No fill.',
    reason: 'no-fill',
    phase: 'load',
  };
  return Object.fromEntries(errorMapKeys().map((k) => [k, values[k]]));
}

const REWARD_DATA = { type: 'coins', amount: 1 };

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
  mockBus.clear();
  mockNative.jsListeners = new Set();
  mockNative.rewardedLoads = [];
  mockNative.initOutcome = 'success';
  // Retry/reload timers stay fake so none outlives a test; setImmediate stays
  // real so native events and promise chains can be flushed.
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('Android source facts this suite relies on', () => {
  it('the rewarded loaded and load-failed callbacks send the types JS subscribes to', () => {
    expect(rewardedEventName()).toBe('google_mobile_ads_rewarded_event');
    expect(loadCallbackType('onAdLoaded')).toBe('rewarded_loaded');
    expect(loadCallbackType('onAdFailedToLoad')).toBe('error');
    expect(jsEventPrefix()).toBe('rnapp_');
    expect(eventBodyKeys()).toEqual(['body', 'requestId', 'adUnitId', 'eventName']);
    expect(errorMapKeys()).toEqual(expect.arrayContaining(['code', 'message', 'phase']));
    expect(fullScreenKt).toMatch(/adErrorToMap\(loadAdError, "load"\)/);
  });
});

describe('native rewarded events through the real package JS (release build)', () => {
  async function initialised() {
    const ads = loadAds();
    await ads.initAds();
    await flush();
    // The real RewardedAd was created once and loaded once, on Google's sample unit.
    expect(mockNative.rewardedLoads).toHaveLength(1);
    const { requestId, adUnitId } = mockNative.rewardedLoads[0];
    expect(adUnitId).toBe('ca-app-pub-3940256099942544/5224354917');
    return { ...ads, requestId, adUnitId };
  }

  it('stays not ready after init and a load request, until the loaded event', async () => {
    const { Ads } = await initialised();
    expect(Ads.rewardedReady).toBe(false);
  });

  it('a Kotlin-shaped rewarded_loaded for our request makes rewardedReady true, once', async () => {
    const { Ads, requestId, adUnitId } = await initialised();
    const seen: boolean[] = [];
    Ads.subscribeRewardedReady((v) => seen.push(v));

    emitNative(requestId, adUnitId, loadCallbackType('onAdLoaded'), { data: REWARD_DATA });

    expect(Ads.rewardedReady).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('a loaded event for another request (e.g. the interstitial) changes nothing', async () => {
    const { Ads, requestId, adUnitId } = await initialised();
    emitNative(requestId + 1000, adUnitId, loadCallbackType('onAdLoaded'), { data: REWARD_DATA });
    expect(Ads.rewardedReady).toBe(false);
  });

  it('load-failed, then the 15 s reload, then loaded: false, a second load, true', async () => {
    const { Ads, requestId, adUnitId } = await initialised();
    emitNative(requestId, adUnitId, loadCallbackType('onAdLoaded'), { data: REWARD_DATA });
    expect(Ads.rewardedReady).toBe(true);

    emitNative(requestId, adUnitId, loadCallbackType('onAdFailedToLoad'), {
      error: kotlinLoadError(),
    });
    expect(Ads.rewardedReady).toBe(false);

    const first = { requestId, adUnitId };
    jest.advanceTimersByTime(14999);
    await flush();
    expect(mockNative.rewardedLoads).toEqual([first]); // not before 15 s
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockNative.rewardedLoads).toEqual([first, first]); // same ad object reloaded

    emitNative(requestId, adUnitId, loadCallbackType('onAdLoaded'), { data: REWARD_DATA });
    expect(Ads.rewardedReady).toBe(true);
  });

  it('a failed init creates no rewarded ad and a loaded event cannot make it ready', async () => {
    mockNative.initOutcome = 'failed';
    const { Ads, initAds } = loadAds();
    await initAds();
    await flush();
    expect(mockNative.rewardedLoads).toHaveLength(0);
    for (let id = 0; id < 4; id++) {
      emitNative(id, 'ca-app-pub-3940256099942544/5224354917', 'rewarded_loaded', {
        data: REWARD_DATA,
      });
    }
    expect(Ads.rewardedReady).toBe(false);
  });
});

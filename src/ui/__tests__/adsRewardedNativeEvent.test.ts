/**
 * W0-02 fix round 2: a native `onRewardedAdLoaded` EVENT drives
 * `Ads.rewardedReady`, through the real unity-levelplay-mediation JS.
 *
 * Round 1 (adsRewardedReadiness.test.ts) replaced the whole SDK package and
 * called the listener object directly. This suite keeps the package's real JS
 * (LevelPlay.init, LevelPlayRewardedAd, LevelPlayAdObjectManager and its
 * payload parsers) and replaces only what sits below JS on a device:
 * - the TurboModule `LevelPlayMediation` (create/load return like Kotlin does);
 * - the device event bus (`NativeEventEmitter` over one shared listener map,
 *   like RCTDeviceEventEmitter).
 *
 * The event names and the `getConstants()` map are parsed from the plugin's
 * Kotlin source (LevelPlayConstants.kt), the loaded-event name is the constant
 * the Kotlin `createRewardedAdListener.onAdLoaded` passes to `sendEvent`, and
 * the adInfo payload uses the keys of Kotlin `LevelPlayAdInfo.toReadableMap()`.
 * What stays outside: the native SDK calling `onAdLoaded` at all (needs fill).
 */
import * as fs from 'fs';
import * as path from 'path';

type Handler = (data: unknown) => void;

// One process-wide bus, like RCTDeviceEventEmitter (names must start with
// `mock` to be usable inside jest.mock factories).
const mockBus = new Map<string, Handler[]>();

interface MockNative {
  constants: Record<string, string>;
  rewardedCreated: string[];
  rewardedLoads: string[];
  nextAdId: number;
  initOutcome: 'success' | 'failed';
}

const mockNative: MockNative = {
  constants: {},
  rewardedCreated: [],
  rewardedLoads: [],
  nextAdId: 1,
  initOutcome: 'success',
};

// ---- Kotlin source of the installed plugin ---------------------------------
const pluginRoot = path.dirname(require.resolve('unity-levelplay-mediation/package.json'));
const ktDir = path.join(pluginRoot, 'android/src/main/java/com/unity3d/reactnative');
const constantsKt = fs.readFileSync(path.join(ktDir, 'LevelPlayConstants.kt'), 'utf8');
const objectManagerKt = fs.readFileSync(path.join(ktDir, 'LevelPlayAdObjectManager.kt'), 'utf8');
const extensionsKt = fs.readFileSync(path.join(ktDir, 'LevelPlayExtensions.kt'), 'utf8');

/** `const val NAME = "value"` declarations. */
const ktConst: Record<string, string> = {};
for (const m of constantsKt.matchAll(/const val (\w+) = "([^"]*)"/g)) ktConst[m[1]] = m[2];

/** `getEventConstants()`: "JS_KEY" to KOTLIN_CONST. */
const eventConstants: Record<string, string> = {};
for (const m of constantsKt.matchAll(/"(\w+)" to (\w+)/g)) eventConstants[m[1]] = ktConst[m[2]];

/** The event name one Kotlin rewarded-listener override sends. */
function kotlinRewardedEvent(override: string): string {
  const body = objectManagerKt.split('createRewardedAdListener')[2] ?? '';
  const re = new RegExp(`override fun ${override}\\([^)]*\\) \\{[^}]*sendEvent\\(reactApplicationContext, (\\w+)`);
  const m = body.match(re);
  if (!m) throw new Error(`no sendEvent in Kotlin ${override}`);
  return ktConst[m[1]];
}

/** A payload with exactly the keys Kotlin `LevelPlayAdInfo.toReadableMap()` puts. */
function kotlinAdInfo(): Record<string, unknown> {
  const block = extensionsKt.split('fun LevelPlayAdInfo.toReadableMap()')[1].split('return map')[0];
  const info: Record<string, unknown> = {};
  for (const m of block.matchAll(/map\.put(\w+)\("(\w+)"/g)) {
    const [, kind, key] = m;
    // putMap("adSize", getAdSize().toReadableMap()) is null for a size-less
    // (non-banner) ad; the key is always present, never undefined.
    info[key] = kind === 'Map' ? null : kind === 'Double' ? 0.01 : `${key}-value`;
  }
  return info;
}

jest.mock('react-native', () => {
  const nativeModule = new Proxy(
    {
      getConstants: () => mockNative.constants,
      init: () => {
        // Native reports the outcome later, as an event.
        setImmediate(() => {
          const name = mockNative.initOutcome === 'success' ? 'onInitSuccess' : 'onInitFailed';
          const data =
            mockNative.initOutcome === 'success'
              ? { isAdQualityEnabled: false, ab: 'A' }
              : { errorCode: 2070, errorMessage: 'noServerResponse' };
          (mockBus.get(name) ?? []).slice().forEach((h) => h(data));
        });
        return Promise.resolve();
      },
      createInterstitialAd: () => Promise.resolve(String(mockNative.nextAdId++)),
      createRewardedAd: () => {
        const id = String(mockNative.nextAdId++);
        mockNative.rewardedCreated.push(id);
        return Promise.resolve(id);
      },
      loadRewardedAd: (adId: string) => {
        mockNative.rewardedLoads.push(adId);
        return Promise.resolve();
      },
    } as Record<string, unknown>,
    {
      get: (target, prop: string) =>
        prop in target ? target[prop] : () => Promise.resolve(undefined),
    },
  );
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
    Platform: { OS: 'android', constants: { reactNativeVersion: { major: 0, minor: 86, patch: 3 } } },
    Pressable: 'Pressable',
    Text: 'Text',
    View: 'View',
    StyleSheet: { create: <T>(s: T) => s },
    NativeEventEmitter,
    TurboModuleRegistry: { getEnforcing: () => nativeModule, get: () => nativeModule },
    NativeModules: { LevelPlayConfig: { setPluginData: () => Promise.resolve() } },
    codegenNativeComponent: () => 'NativeComponent',
    codegenNativeCommands: () => ({}),
    requireNativeComponent: () => 'NativeComponent',
    UIManager: {},
    findNodeHandle: () => null,
  };
});

// The plugin's view specs deep-import these Flow files; the views are unused here.
jest.mock('react-native/Libraries/Utilities/codegenNativeComponent', () => ({
  __esModule: true,
  default: () => 'NativeComponent',
}));
jest.mock('react-native/Libraries/Utilities/codegenNativeCommands', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

type AdsModule = typeof import('../ads');

/**
 * A fresh ads.tsx + plugin JS (both keep module-level state), release build.
 * resetModules, not isolateModules: ads.tsx requires the plugin lazily inside
 * initAds(), after an isolateModules callback would already have returned, so
 * the plugin (and its adId map and bus subscriptions) would leak across tests.
 */
function loadAds(): AdsModule {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  jest.resetModules();
  return require('../ads') as AdsModule;
}

/** What `sendEvent(reactApplicationContext, name, args)` delivers to JS. */
function emitNative(name: string, data: unknown): void {
  (mockBus.get(name) ?? []).slice().forEach((h) => h(data));
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
  mockBus.clear();
  mockNative.constants = { ...eventConstants };
  mockNative.rewardedCreated = [];
  mockNative.rewardedLoads = [];
  mockNative.nextAdId = 1;
  mockNative.initOutcome = 'success';
  // Retry/reload timers stay fake so none outlives a test; setImmediate stays
  // real so native events and promise chains can be flushed.
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('Kotlin source facts this suite relies on', () => {
  it('the loaded and load-failed overrides send the constants JS subscribes to', () => {
    expect(kotlinRewardedEvent('onAdLoaded')).toBe('onRewardedAdLoaded');
    expect(eventConstants.ON_REWARDED_AD_LOADED).toBe('onRewardedAdLoaded');
    expect(kotlinRewardedEvent('onAdLoadFailed')).toBe('onRewardedAdLoadFailed');
    expect(eventConstants.ON_REWARDED_AD_LOAD_FAILED).toBe('onRewardedAdLoadFailed');
    expect(Object.keys(kotlinAdInfo())).toEqual(
      expect.arrayContaining(['adId', 'adUnitId', 'adSize', 'revenue']),
    );
  });
});

describe('native rewarded events through the real plugin JS (release build)', () => {
  async function initialised() {
    const ads = loadAds();
    await ads.initAds();
    await flush();
    // The real LevelPlayAdObjectManager created one rewarded ad and loaded it.
    expect(mockNative.rewardedCreated).toHaveLength(1);
    expect(mockNative.rewardedLoads).toEqual(mockNative.rewardedCreated);
    return { ...ads, adId: mockNative.rewardedCreated[0] };
  }

  it('stays not ready after init and a load request, until the loaded event', async () => {
    const { Ads } = await initialised();
    expect(Ads.rewardedReady).toBe(false);
  });

  it('a Kotlin-shaped onRewardedAdLoaded for our adId makes rewardedReady true, once', async () => {
    const { Ads, adId } = await initialised();
    const seen: boolean[] = [];
    Ads.subscribeRewardedReady((v) => seen.push(v));

    emitNative(kotlinRewardedEvent('onAdLoaded'), { adId, adInfo: kotlinAdInfo() });

    expect(Ads.rewardedReady).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('a loaded event for another adId (e.g. the interstitial) changes nothing', async () => {
    const { Ads, adId } = await initialised();
    emitNative(kotlinRewardedEvent('onAdLoaded'), {
      adId: `${adId}-other`,
      adInfo: kotlinAdInfo(),
    });
    expect(Ads.rewardedReady).toBe(false);
  });

  it('load-failed, then the 15 s reload, then loaded: false, a second load, true', async () => {
    const { Ads, adId } = await initialised();
    emitNative(kotlinRewardedEvent('onAdLoaded'), { adId, adInfo: kotlinAdInfo() });
    expect(Ads.rewardedReady).toBe(true);

    emitNative(kotlinRewardedEvent('onAdLoadFailed'), {
      adId,
      error: { errorMessage: 'Mediation No fill', errorCode: 509, adUnitId: 'smim4g4z79173hcw' },
    });
    expect(Ads.rewardedReady).toBe(false);

    jest.advanceTimersByTime(14999);
    await flush();
    expect(mockNative.rewardedLoads).toEqual([adId]); // not before 15 s
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockNative.rewardedLoads).toEqual([adId, adId]); // same ad object reloaded

    emitNative(kotlinRewardedEvent('onAdLoaded'), { adId, adInfo: kotlinAdInfo() });
    expect(Ads.rewardedReady).toBe(true);
  });

  it('a failed init creates no rewarded ad and a loaded event cannot make it ready', async () => {
    mockNative.initOutcome = 'failed';
    const { Ads, initAds } = loadAds();
    await initAds();
    await flush();
    expect(mockNative.rewardedCreated).toHaveLength(0);
    emitNative('onRewardedAdLoaded', { adId: '1', adInfo: kotlinAdInfo() });
    expect(Ads.rewardedReady).toBe(false);
  });
});

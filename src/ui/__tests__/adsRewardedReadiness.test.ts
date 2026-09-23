/**
 * W0-02 fix round 1: the native rewarded listener in ads.tsx drives
 * `Ads.rewardedReady`. The SDK module is replaced by a fake that records the
 * listener ads.tsx registers, so these tests call the SAME listener object the
 * native event emitter calls on device (LevelPlayAdObjectManager.ts routes
 * `onRewardedAdLoaded` to `listener.onAdLoaded`). Only the native-to-JS event
 * delivery is outside this test.
 */

type Listener = Record<string, (...args: unknown[]) => void>;

interface FakeSdk {
  rewardedListener: Listener | null;
  interstitialListener: Listener | null;
  initOutcome: 'success' | 'failed';
  rewardedLoads: number;
}

const sdk: FakeSdk = {
  rewardedListener: null,
  interstitialListener: null,
  initOutcome: 'success',
  rewardedLoads: 0,
};

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(s: T) => s },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

jest.mock('../admobFacade', () => ({
  LevelPlay: {
    setMetaData: () => Promise.resolve(),
    init: (_req: unknown, cb: { onInitSuccess: () => void; onInitFailed: (e: unknown) => void }) => {
      if (sdk.initOutcome === 'success') cb.onInitSuccess();
      else cb.onInitFailed({ errorCode: 2070 });
      return Promise.resolve();
    },
    launchTestSuite: () => Promise.resolve(),
  },
  LevelPlayInitRequest: { builder: () => ({ build: () => ({}) }) },
  LevelPlayInterstitialAd: class {
    setListener(l: Listener) {
      sdk.interstitialListener = l;
    }
    loadAd() {
      return Promise.resolve();
    }
    isAdReady() {
      return Promise.resolve(false);
    }
    showAd() {
      return Promise.resolve();
    }
  },
  LevelPlayRewardedAd: class {
    setListener(l: Listener) {
      sdk.rewardedListener = l;
    }
    loadAd() {
      sdk.rewardedLoads += 1;
      return Promise.resolve();
    }
    isAdReady() {
      return Promise.resolve(false);
    }
    showAd() {
      return Promise.resolve();
    }
  },
}));

type AdsModule = typeof import('../ads');

/** A fresh ads.tsx module (its state is module-level) as a release build. */
function loadAds(): AdsModule {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  let mod: AdsModule | null = null;
  jest.isolateModules(() => {
    mod = require('../ads') as AdsModule;
  });
  return mod!;
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  sdk.rewardedListener = null;
  sdk.interstitialListener = null;
  sdk.initOutcome = 'success';
  sdk.rewardedLoads = 0;
  jest.useRealTimers();
});

describe('native rewarded readiness (release build)', () => {
  it('is not ready after init succeeds until the SDK reports onAdLoaded', async () => {
    const { Ads, initAds } = loadAds();
    await initAds();
    await flush();
    expect(sdk.rewardedListener).not.toBeNull();
    expect(sdk.rewardedLoads).toBe(1);
    expect(Ads.rewardedReady).toBe(false);
  });

  it('onAdLoaded makes rewardedReady true and notifies subscribers once', async () => {
    const { Ads, initAds } = loadAds();
    await initAds();
    await flush();
    const seen: boolean[] = [];
    Ads.subscribeRewardedReady((v) => seen.push(v));

    sdk.rewardedListener!.onAdLoaded({ adUnitId: 'smim4g4z79173hcw' });

    expect(Ads.rewardedReady).toBe(true);
    expect(seen).toEqual([true]);
  });

  it.each(['onAdLoadFailed', 'onAdDisplayed', 'onAdDisplayFailed', 'onAdClosed'])(
    '%s after onAdLoaded makes rewardedReady false',
    async (callback) => {
      jest.useFakeTimers(); // onAdLoadFailed schedules a 15 s reload
      const { Ads, initAds } = loadAds();
      await initAds();
      // Settle the init promise chain without real timers.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const seen: boolean[] = [];
      Ads.subscribeRewardedReady((v) => seen.push(v));

      sdk.rewardedListener!.onAdLoaded({});
      sdk.rewardedListener![callback]({ errorCode: 509 }, {});

      expect(Ads.rewardedReady).toBe(false);
      expect(seen).toEqual([true, false]);
    },
  );

  it('a reload that ends in onAdLoaded flips readiness back to true', async () => {
    jest.useFakeTimers();
    const { Ads, initAds } = loadAds();
    await initAds();
    for (let i = 0; i < 10; i++) await Promise.resolve();

    sdk.rewardedListener!.onAdLoadFailed({ errorCode: 509, errorMessage: 'Mediation No fill' });
    expect(Ads.rewardedReady).toBe(false);
    jest.advanceTimersByTime(15000);
    expect(sdk.rewardedLoads).toBe(2); // the reload request went out
    sdk.rewardedListener!.onAdLoaded({});

    expect(Ads.rewardedReady).toBe(true);
  });

  it('stays false when init fails (no handles, release build never simulates)', async () => {
    jest.useFakeTimers(); // the controller schedules timed retries
    sdk.initOutcome = 'failed';
    const { Ads, initAds } = loadAds();
    await initAds();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(sdk.rewardedListener).toBeNull();
    expect(Ads.rewardedReady).toBe(false);
  });
});

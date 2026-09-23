/**
 * W0-02 fix round 1: the native rewarded events in ads.tsx drive
 * `Ads.rewardedReady`. The SDK module is replaced by a fake AdMob SDK
 * (./helpers/fakeGoogleMobileAds) whose ads deliver events to the SAME
 * listeners ads.tsx registers with `addAdEventListener`, as the package's
 * native event fan-out does on device. Only the native-to-JS event delivery is
 * outside this test (adsRewardedNativeEvent.test.ts covers it).
 *
 * ADMOB-B: test bodies are unchanged. `sdk.rewardedListener` sends each
 * LevelPlay callback as the AdMob event ads.tsx maps it to, to both rewarded
 * ads (hint and continue units, M3: the old single rewarded ad served both);
 * `Ads.rewardedReady` is the continue placement, so `sdk.rewardedLoads` counts
 * the continue unit's load requests. adsTwoRewardedUnits.test.ts covers the
 * placements separately.
 */
import { createFakeGma, legacyListener } from './helpers/fakeGoogleMobileAds';

type Listener = Record<string, (...args: unknown[]) => void>;

const CONTINUE_UNIT = 'ca-app-pub-9813131856455133/3505414519';

const mockGma = createFakeGma();

const sdk = {
  get rewardedListener(): Listener | null {
    return mockGma.live('rewarded').length > 0
      ? legacyListener(() => mockGma.live('rewarded'))
      : null;
  },
  get initOutcome() {
    return mockGma.config.initOutcome;
  },
  set initOutcome(value: 'success' | 'failed') {
    mockGma.config.initOutcome = value;
  },
  get rewardedLoads() {
    return mockGma.ads
      .filter((ad) => ad.kind === 'rewarded' && ad.unitId === CONTINUE_UNIT)
      .reduce((n, ad) => n + ad.loads, 0);
  },
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

// No ad reports loaded unless an event says so (the old isAdReady() -> false).
jest.mock('react-native-google-mobile-ads', () => mockGma.module());

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
  mockGma.reset();
  mockGma.config.loadedOverride = { interstitial: false };
  sdk.initOutcome = 'success';
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

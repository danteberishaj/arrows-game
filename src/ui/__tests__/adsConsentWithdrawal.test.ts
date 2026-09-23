/**
 * W7-01 fix round 1: consent withdrawal after a successful native init keeps
 * the SDK process alive but immediately closes every ad surface.
 */

import type { ConsentState } from '../consent';

import { createFakeGma, legacyListener, type FakeAdKind } from './helpers/fakeGoogleMobileAds';

const mockGma = createFakeGma();

function showsOf(kind: FakeAdKind): number {
  return mockGma.ads.filter((ad) => ad.kind === kind).reduce((n, ad) => n + ad.shows, 0);
}

/**
 * ADMOB-B: the LevelPlay-era counters, read from the fake AdMob SDK. Test
 * bodies are unchanged; `rewardedListener` reaches both rewarded ads (hint and
 * continue units, M3).
 */
const sdk = {
  get inits() {
    return mockGma.inits;
  },
  get rewardedListener() {
    return mockGma.live('rewarded').length > 0
      ? legacyListener(() => mockGma.live('rewarded'))
      : null;
  },
  get interstitialShows() {
    return showsOf('interstitial');
  },
  get rewardedShows() {
    return showsOf('rewarded');
  },
};

jest.mock('../../featureFlags', () => ({
  CONSENT_GATE: true,
  REMOTE_KILL_SWITCH: false,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

// Every ad reports loaded and plays itself when shown (the old fakes' showAd).
jest.mock('react-native-google-mobile-ads', () => mockGma.module());

type AdsModule = typeof import('../ads');
type SaveModule = typeof import('../../core/saveSystem');

const FINISHED_GAMES_KEY = 'arrows_finished_games';
const GRANTED: ConsentState = {
  resolved: true,
  gdprApplies: true,
  personalisedAds: true,
  ccpaOptOut: false,
};
const REFUSED: ConsentState = {
  resolved: true,
  gdprApplies: true,
  personalisedAds: false,
  ccpaOptOut: false,
};

function mapStore(disk: Map<string, number>) {
  return {
    getInt: (key: string, defaultValue: number) => disk.get(key) ?? defaultValue,
    setInt: (key: string, value: number) => void disk.set(key, value),
    deleteKey: (key: string) => void disk.delete(key),
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function boot(disk: Map<string, number>) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  let ads: AdsModule | null = null;
  let save: SaveModule | null = null;
  let state = GRANTED;
  const source = {
    gather: async () => state,
    privacyOptionsRequired: () => false,
    showPrivacyOptions: async () => state,
  };

  jest.isolateModules(() => {
    save = require('../../core/saveSystem') as SaveModule;
    ads = require('../ads') as AdsModule;
  });
  save!.SaveSystem.useStore(mapStore(disk));
  await ads!.initAds(source);
  await settle();

  return {
    ads: ads!,
    withdraw: async () => {
      state = REFUSED;
      ads!.adInitController.consentChanged();
      await settle();
    },
  };
}

beforeEach(() => {
  mockGma.reset();
  mockGma.config.loadedOverride = { interstitial: true, rewarded: true };
  mockGma.config.showBehaviour = { interstitial: 'auto', rewarded: 'auto' };
});

describe('consent withdrawal after successful init', () => {
  test('rewarded continue and hint become unavailable and grant no reward', async () => {
    const { ads, withdraw } = await boot(new Map());
    expect(sdk.inits).toBe(1);
    sdk.rewardedListener!.onAdLoaded({});
    expect(ads.Ads.rewardedReady).toBe(true);
    const readiness: boolean[] = [];
    ads.Ads.subscribeRewardedReady((ready) => readiness.push(ready));

    await withdraw();

    expect(sdk.inits).toBe(1); // the already-running SDK was not torn down or reinitialised
    expect(ads.adInitController.state).toBe('declined');
    expect(ads.Ads.rewardedReady).toBe(false);
    expect(readiness).toEqual([false]);
    await expect(ads.Ads.showRewarded('continue')).resolves.toBe(false);
    await expect(ads.Ads.showRewarded('hint')).resolves.toBe(false);
    expect(sdk.rewardedShows).toBe(0);
  });

  test('a due interstitial does not show or reset the pacing counter', async () => {
    const disk = new Map<string, number>([[FINISHED_GAMES_KEY, 2]]);
    const { ads, withdraw } = await boot(disk);
    expect(sdk.inits).toBe(1);

    await withdraw();
    await ads.Ads.showInterstitialIfDue();

    expect(sdk.interstitialShows).toBe(0);
    expect(disk.get(FINISHED_GAMES_KEY)).toBe(2);
  });
});

describe('ADMOB-B: consent signals on AdMob requests (CONSENT_GATE on)', () => {
  const NON_EEA_NPA_CCPA: ConsentState = {
    resolved: true,
    gdprApplies: false,
    personalisedAds: false,
    ccpaOptOut: true,
  };

  async function bootWith(first: ConsentState) {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    let ads: AdsModule | null = null;
    let save: SaveModule | null = null;
    let state = first;
    const source = {
      gather: async () => state,
      privacyOptionsRequired: () => false,
      showPrivacyOptions: async () => state,
    };
    jest.isolateModules(() => {
      save = require('../../core/saveSystem') as SaveModule;
      ads = require('../ads') as AdsModule;
    });
    save!.SaveSystem.useStore(mapStore(new Map()));
    await ads!.initAds(source);
    await settle();
    return {
      ads: ads!,
      change: async (next: ConsentState) => {
        state = next;
        ads!.adInitController.consentChanged();
        await settle();
      },
    };
  }

  test('COPPA goes to the request configuration before initialize; NPA and CCPA ride on every ad request', async () => {
    await bootWith(NON_EEA_NPA_CCPA);
    expect(mockGma.callLog.slice(0, 2)).toEqual(['setRequestConfiguration', 'initialize']);
    expect(mockGma.requestConfigurations).toEqual([{ tagForChildDirectedTreatment: false }]);
    expect(mockGma.ads).toHaveLength(3);
    for (const ad of mockGma.ads) {
      expect(ad.options).toEqual({
        requestNonPersonalizedAdsOnly: true,
        networkExtras: { rdp: '1' },
      });
    }
  });

  test('granted with personalisation and no CCPA opt-out: default requests', async () => {
    await bootWith(GRANTED);
    for (const ad of mockGma.ads) expect(ad.options).toEqual({});
  });

  test('withdrawal stops ad requests; a later grant with different signals recreates the ads', async () => {
    mockGma.config.loadedOverride = {}; // event-driven `loaded`
    mockGma.config.showBehaviour = { interstitial: 'manual', rewarded: 'manual' };
    const { ads, change } = await bootWith(GRANTED);
    const firstAds = [...mockGma.ads];
    expect(firstAds.map((ad) => ad.loads)).toEqual([1, 1, 1]);

    await change(REFUSED);
    for (const ad of firstAds) ad.emit('closed'); // an ad that would normally reload
    expect(firstAds.map((ad) => ad.loads)).toEqual([1, 1, 1]); // nothing requested while refused

    await change(NON_EEA_NPA_CCPA);
    expect(ads.adInitController.state).toBe('ready');
    expect(mockGma.inits).toBe(1); // the SDK was never re-initialised
    expect(firstAds.every((ad) => ad.destroyed)).toBe(true);
    const fresh = mockGma.ads.filter((ad) => !ad.destroyed);
    expect(fresh).toHaveLength(3);
    for (const ad of fresh) {
      expect(ad.options).toEqual({ requestNonPersonalizedAdsOnly: true, networkExtras: { rdp: '1' } });
      expect(ad.loads).toBe(1);
    }
  });

  test('re-grant with the same signals keeps the ad objects and requests the idle ones', async () => {
    mockGma.config.loadedOverride = {};
    const { change } = await bootWith(GRANTED);
    const firstAds = [...mockGma.ads];
    await change(REFUSED);
    for (const ad of firstAds) ad.emit('closed');
    await change(GRANTED);
    expect(firstAds.some((ad) => ad.destroyed)).toBe(false);
    expect(firstAds.map((ad) => ad.loads)).toEqual([2, 2, 2]);
  });
});

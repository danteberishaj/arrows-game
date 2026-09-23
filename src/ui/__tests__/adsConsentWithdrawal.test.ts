/**
 * W7-01 fix round 1: consent withdrawal after a successful native init keeps
 * the SDK process alive but immediately closes every ad surface.
 */

import type { ConsentState } from '../consent';

type Listener = Record<string, (...args: unknown[]) => void>;

const sdk = {
  inits: 0,
  interstitialListener: null as Listener | null,
  rewardedListener: null as Listener | null,
  interstitialShows: 0,
  rewardedShows: 0,
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

jest.mock('../admobFacade', () => ({
  LevelPlay: {
    setConsent: () => Promise.resolve(),
    setMetaData: () => Promise.resolve(),
    init: (_request: unknown, listener: { onInitSuccess: () => void }) => {
      sdk.inits += 1;
      listener.onInitSuccess();
      return Promise.resolve();
    },
    launchTestSuite: () => Promise.resolve(),
  },
  LevelPlayPrivacySettings: {
    setCOPPA: () => Promise.resolve(),
    setCCPA: () => Promise.resolve(),
  },
  LevelPlayInitRequest: { builder: () => ({ build: () => ({}) }) },
  LevelPlayInterstitialAd: class {
    setListener(listener: Listener) {
      sdk.interstitialListener = listener;
    }
    loadAd() {
      return Promise.resolve();
    }
    isAdReady() {
      return Promise.resolve(true);
    }
    showAd() {
      sdk.interstitialShows += 1;
      setImmediate(() => {
        sdk.interstitialListener?.onAdDisplayed({});
        sdk.interstitialListener?.onAdClosed({});
      });
      return Promise.resolve();
    }
  },
  LevelPlayRewardedAd: class {
    setListener(listener: Listener) {
      sdk.rewardedListener = listener;
    }
    loadAd() {
      return Promise.resolve();
    }
    isAdReady() {
      return Promise.resolve(true);
    }
    showAd() {
      sdk.rewardedShows += 1;
      setImmediate(() => {
        sdk.rewardedListener?.onAdRewarded({});
        sdk.rewardedListener?.onAdClosed({});
      });
      return Promise.resolve();
    }
  },
}));

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
  sdk.inits = 0;
  sdk.interstitialListener = null;
  sdk.rewardedListener = null;
  sdk.interstitialShows = 0;
  sdk.rewardedShows = 0;
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

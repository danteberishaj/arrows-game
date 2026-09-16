/**
 * W0-05: the interstitial pacing counter.
 *
 * Part 1 covers the pure rules in adPacing.ts. Part 2 drives ads.tsx as a
 * release build over a fake LevelPlay SDK (the same shape as
 * adsRewardedReadiness.test.ts) to pin where the counter is written: every
 * finished game goes through SaveSystem, and only the interstitial listener's
 * onAdDisplayed resets it. Native-to-JS event delivery and a real displayed
 * interstitial stay outside this test (UNVERIFIED-DEVICE in the W0-05 report).
 */
import { afterDisplayed, isInterstitialDue, sanitizeCounter } from '../adPacing';

describe('adPacing (pure)', () => {
  test('due at exactly perInterstitial, not due one below it', () => {
    expect(isInterstitialDue(2, 2)).toBe(true);
    expect(isInterstitialDue(1, 2)).toBe(false);
    expect(isInterstitialDue(0, 2)).toBe(false);
    expect(isInterstitialDue(3, 3)).toBe(true);
    expect(isInterstitialDue(2, 3)).toBe(false);
  });

  test('a counter above perInterstitial (for example after a skipped show) is still due', () => {
    expect(isInterstitialDue(5, 2)).toBe(true);
  });

  test('sanitizeCounter keeps non-negative integers', () => {
    expect(sanitizeCounter(0)).toBe(0);
    expect(sanitizeCounter(1)).toBe(1);
    expect(sanitizeCounter(41)).toBe(41);
  });

  test('sanitizeCounter clamps negative values to 0', () => {
    expect(sanitizeCounter(-1)).toBe(0);
    expect(sanitizeCounter(-(2 ** 31))).toBe(0);
  });

  test('sanitizeCounter truncates non-integers to a non-negative integer', () => {
    expect(sanitizeCounter(1.9)).toBe(1);
    expect(sanitizeCounter(0.5)).toBe(0);
    expect(sanitizeCounter(-0.5)).toBe(0);
  });

  test.each([NaN, Infinity, -Infinity, '2', null, undefined, {}])(
    'sanitizeCounter reads malformed %p as 0',
    (raw) => {
      expect(sanitizeCounter(raw)).toBe(0);
    },
  );

  test('every sanitised value is a non-negative integer', () => {
    for (const raw of [3, -3, 2.5, NaN, Infinity, 'x', 1e9 + 0.25]) {
      const v = sanitizeCounter(raw);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  test('afterDisplayed resets to 0', () => {
    expect(afterDisplayed()).toBe(0);
  });
});

// ---- ads.tsx wiring (release build, fake LevelPlay SDK) ---------------------

type Listener = Record<string, (...args: unknown[]) => void>;

const sdk = {
  interstitialListener: null as Listener | null,
  initOutcome: 'success' as 'success' | 'failed',
  interstitialReady: true,
  shows: 0,
  showRejects: false,
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

jest.mock('unity-levelplay-mediation', () => ({
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
      return Promise.resolve(sdk.interstitialReady);
    }
    showAd() {
      sdk.shows += 1;
      return sdk.showRejects ? Promise.reject(new Error('show failed')) : Promise.resolve();
    }
  },
  LevelPlayRewardedAd: class {
    setListener() {}
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
}));

type AdsModule = typeof import('../ads');
type SaveModule = typeof import('../../core/saveSystem');

/** Map-backed IntStore: the "disk" survives a fresh module load (process death). */
function mapStore(disk: Map<string, number>) {
  return {
    getInt: (k: string, d: number) => (disk.has(k) ? disk.get(k)! : d),
    setInt: (k: string, v: number) => void disk.set(k, v),
    deleteKey: (k: string) => void disk.delete(k),
  };
}

/** A fresh process: new ads.tsx and SaveSystem module state over the same disk. */
function boot(disk: Map<string, number>): { ads: AdsModule; save: SaveModule } {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  let ads: AdsModule | null = null;
  let save: SaveModule | null = null;
  jest.isolateModules(() => {
    save = require('../../core/saveSystem') as SaveModule;
    ads = require('../ads') as AdsModule;
  });
  save!.SaveSystem.useStore(mapStore(disk));
  return { ads: ads!, save: save! };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const KEY = 'arrows_finished_games';

beforeEach(() => {
  sdk.interstitialListener = null;
  sdk.initOutcome = 'success';
  sdk.interstitialReady = true;
  sdk.shows = 0;
  sdk.showRejects = false;
  jest.useFakeTimers(); // init retries and ad reloads schedule timers
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ads.tsx pacing counter (release build)', () => {
  test('a finished game is written through SaveSystem and survives a fresh process', () => {
    const disk = new Map<string, number>();
    boot(disk).ads.Ads.registerGameFinished();
    expect(disk.get(KEY)).toBe(1);

    const second = boot(disk);
    second.ads.Ads.registerGameFinished();
    expect(disk.get(KEY)).toBe(2);
    expect(second.save.SaveSystem.finishedGames).toBe(2);
  });

  test('lose, process death, win: the interstitial is due and shows (the original failure)', async () => {
    const disk = new Map<string, number>();
    boot(disk).ads.Ads.registerGameFinished(); // loss

    const { ads } = boot(disk); // cold start
    await ads.initAds();
    await settle();
    ads.Ads.registerGameFinished(); // win
    const shown = ads.Ads.showInterstitialIfDue();
    await settle();

    expect(sdk.shows).toBe(1);
    sdk.interstitialListener!.onAdDisplayed({});
    sdk.interstitialListener!.onAdClosed({});
    await shown;
  });

  test('not due at one finished game: no show, counter kept', async () => {
    const disk = new Map<string, number>();
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();
    ads.Ads.registerGameFinished();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(1);
  });

  test('the counter is not reset before showAd, only by onAdDisplayed', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    expect(sdk.shows).toBe(1);
    expect(disk.get(KEY)).toBe(2); // show requested, nothing displayed yet

    sdk.interstitialListener!.onAdDisplayed({});
    expect(disk.get(KEY)).toBe(0);

    sdk.interstitialListener!.onAdClosed({});
    await shown;
    expect(disk.get(KEY)).toBe(0);
  });

  test('a display failure does not consume the count', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    expect(sdk.shows).toBe(1);
    sdk.interstitialListener!.onAdDisplayFailed({ errorCode: 509 }, {});
    await shown;
    expect(disk.get(KEY)).toBe(2);

    // Still due: the next "Next level" retries the show.
    const retry = ads.Ads.showInterstitialIfDue();
    await settle();
    expect(sdk.shows).toBe(2);
    sdk.interstitialListener!.onAdDisplayed({});
    sdk.interstitialListener!.onAdClosed({});
    await retry;
    expect(disk.get(KEY)).toBe(0);
  });

  test('a rejected showAd does not consume the count', async () => {
    sdk.showRejects = true;
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(1);
    expect(disk.get(KEY)).toBe(2);
  });

  test('no ad ready: skipped, counter kept', async () => {
    sdk.interstitialReady = false;
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(2);

    sdk.interstitialReady = true; // loaded later: the next attempt shows
    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    expect(sdk.shows).toBe(1);
    sdk.interstitialListener!.onAdDisplayed({});
    sdk.interstitialListener!.onAdClosed({});
    await shown;
  });

  test('no native SDK (init failed, release): nothing shows and the counter is kept', async () => {
    sdk.initOutcome = 'failed';
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();
    ads.Ads.registerGameFinished();

    expect(sdk.interstitialListener).toBeNull();
    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(3);
  });

  test('a corrupt negative stored counter counts up from 0', () => {
    const disk = new Map<string, number>([[KEY, -7]]);
    boot(disk).ads.Ads.registerGameFinished();
    expect(disk.get(KEY)).toBe(1);
  });
});

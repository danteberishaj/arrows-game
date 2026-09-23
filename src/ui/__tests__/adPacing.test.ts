/**
 * W0-05: the interstitial pacing counter.
 *
 * Part 1 covers the pure rules in adPacing.ts. Part 2 drives ads.tsx as a
 * release build over a fake ad SDK (./helpers/fakeGoogleMobileAds, shared with
 * the other ad suites) to pin where the counter is written: every finished game
 * goes through SaveSystem, and only a displayed interstitial resets it.
 *
 * ADMOB-B: the SDK is AdMob. "onAdDisplayed" in the test bodies is sent as
 * AdMob's OPENED event ("the ad opened and is currently visible"), the event
 * ads.tsx resets the counter on; "onAdDisplayFailed" is ERROR with phase
 * 'show'. Test bodies are unchanged. Native-to-JS event delivery stays outside
 * this test; the ADMOB-B report has the emulator run.
 */
import { afterDisplayed, isInterstitialDue, sanitizeCounter } from '../adPacing';
import { createFakeGma, legacyListener, type LegacyListener } from './helpers/fakeGoogleMobileAds';

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

// ---- ads.tsx wiring (release build, fake AdMob SDK) -------------------------

const mockGma = createFakeGma();

/** The LevelPlay-era knobs and counters, read from / written to the AdMob fake. */
const sdk = {
  get interstitialListener(): LegacyListener | null {
    return mockGma.live('interstitial').length > 0
      ? legacyListener(() => mockGma.live('interstitial'))
      : null;
  },
  get initOutcome() {
    return mockGma.config.initOutcome;
  },
  set initOutcome(value: 'success' | 'failed') {
    mockGma.config.initOutcome = value;
  },
  /** Was the interstitial's isAdReady(); now pins `InterstitialAd.loaded`. */
  get interstitialReady() {
    return mockGma.config.loadedOverride.interstitial === true;
  },
  set interstitialReady(value: boolean) {
    mockGma.config.loadedOverride.interstitial = value;
  },
  get shows() {
    return mockGma.ads
      .filter((ad) => ad.kind === 'interstitial')
      .reduce((n, ad) => n + ad.shows, 0);
  },
  set showRejects(value: boolean) {
    mockGma.config.showBehaviour.interstitial = value ? 'reject' : 'manual';
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

// Rewarded ads never report loaded here (the old rewarded isAdReady() -> false).
jest.mock('react-native-google-mobile-ads', () => mockGma.module());

type AdsModule = typeof import('../ads');
type SaveModule = typeof import('../../core/saveSystem');
type TelemetryModule = typeof import('../../telemetry/telemetry');

/** Map-backed IntStore: the "disk" survives a fresh module load (process death). */
function mapStore(disk: Map<string, number>) {
  return {
    getInt: (k: string, d: number) => (disk.has(k) ? disk.get(k)! : d),
    setInt: (k: string, v: number) => void disk.set(k, v),
    deleteKey: (k: string) => void disk.delete(k),
  };
}

/** A fresh process: new ads.tsx and SaveSystem module state over the same disk. */
function boot(disk: Map<string, number>) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  let ads: AdsModule | null = null;
  let save: SaveModule | null = null;
  let telemetry: TelemetryModule | null = null;
  jest.isolateModules(() => {
    save = require('../../core/saveSystem') as SaveModule;
    telemetry = require('../../telemetry/telemetry') as TelemetryModule;
    ads = require('../ads') as AdsModule;
  });
  const telemetrySink = telemetry!.createMemorySink(20);
  telemetry!.Telemetry.configure({ validate: true, disabled: false });
  telemetry!.Telemetry.useSink(telemetrySink);
  save!.SaveSystem.useStore(mapStore(disk));
  return { ads: ads!, save: save!, telemetrySink };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const KEY = 'arrows_finished_games';

beforeEach(() => {
  mockGma.reset();
  sdk.initOutcome = 'success';
  sdk.interstitialReady = true;
  mockGma.config.loadedOverride.rewarded = false;
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
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();
    ads.Ads.registerGameFinished();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(1);
    expect(telemetrySink.events).toHaveLength(0);
  });

  test('the counter is not reset before showAd, only by onAdDisplayed', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
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
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(expect.objectContaining({ outcome: 'shown' }));
  });

  test('a display failure does not consume the count', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
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
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(
      expect.objectContaining({ outcome: 'display_failed' }),
    );
    expect(telemetrySink.events[3]).toEqual(expect.objectContaining({ outcome: 'shown' }));
  });

  test('a rejected showAd does not consume the count', async () => {
    sdk.showRejects = true;
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(1);
    expect(disk.get(KEY)).toBe(2);
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(
      expect.objectContaining({ outcome: 'display_failed' }),
    );
  });

  test('no ad ready: skipped, counter kept', async () => {
    sdk.interstitialReady = false;
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();

    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(2);
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(expect.objectContaining({ outcome: 'not_ready' }));

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
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue();
    ads.Ads.registerGameFinished();

    expect(sdk.interstitialListener).toBeNull();
    expect(sdk.shows).toBe(0);
    expect(disk.get(KEY)).toBe(3);
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(expect.objectContaining({ outcome: 'not_ready' }));
  });

  test('a corrupt negative stored counter counts up from 0', () => {
    const disk = new Map<string, number>([[KEY, -7]]);
    boot(disk).ads.Ads.registerGameFinished();
    expect(disk.get(KEY)).toBe(1);
  });
});

describe('ADMOB-B: which AdMob event resets the counter', () => {
  const interstitialAd = () => mockGma.live('interstitial')[0];

  test('IMPRESSION and CLICKED do not reset it; OPENED does', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads } = boot(disk);
    await ads.initAds();
    await settle();

    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    interstitialAd().emit('impression');
    interstitialAd().emit('clicked');
    expect(disk.get(KEY)).toBe(2);
    interstitialAd().emit('opened');
    expect(disk.get(KEY)).toBe(0);
    interstitialAd().emit('closed');
    await shown;
  });

  test('CLOSED without OPENED: display_failed and the count is kept', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    interstitialAd().emit('closed');
    await shown;
    expect(disk.get(KEY)).toBe(2);
    expect(telemetrySink.events[1]).toEqual(
      expect.objectContaining({ outcome: 'display_failed' }),
    );
  });

  test('a second show while one is on screen is display_failed; the first still resolves', async () => {
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    const first = ads.Ads.showInterstitialIfDue();
    await settle();
    // A second show while the first is still on screen (AdMob would throw synchronously).
    await ads.Ads.showInterstitialIfDue();
    interstitialAd().emit('opened');
    interstitialAd().emit('closed');
    await first;
    expect(interstitialAd().shows).toBe(1);
    expect(telemetrySink.events.map((e) => e.name)).toEqual([
      'ad_request',
      'ad_request',
      'ad_result',
      'ad_result',
    ]);
    expect(telemetrySink.events[2]).toEqual(expect.objectContaining({ outcome: 'display_failed' }));
    expect(telemetrySink.events[3]).toEqual(expect.objectContaining({ outcome: 'shown' }));
    expect(disk.get(KEY)).toBe(0);
  });
});

describe('ADMOB-B fix round 1: a rejected native show() leaves no dead interstitial', () => {
  test('the next due show after a rejection displays and resets the counter', async () => {
    sdk.showRejects = true;
    const disk = new Map<string, number>([[KEY, 2]]);
    const { ads, telemetrySink } = boot(disk);
    await ads.initAds();
    await settle();

    await ads.Ads.showInterstitialIfDue(); // native show rejects, no event follows
    expect(disk.get(KEY)).toBe(2); // pacing rule: nothing displayed, count kept

    sdk.showRejects = false;
    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    expect(sdk.shows).toBe(2); // a fresh ad object was shown, not a sync throw
    sdk.interstitialListener!.onAdDisplayed({});
    sdk.interstitialListener!.onAdClosed({});
    await shown;
    expect(disk.get(KEY)).toBe(0);
    expect(telemetrySink.events.map((e) => [e.name, (e as { outcome?: string }).outcome])).toEqual([
      ['ad_request', undefined],
      ['ad_result', 'display_failed'],
      ['ad_request', undefined],
      ['ad_result', 'shown'],
    ]);
  });
});

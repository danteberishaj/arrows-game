/**
 * W6-02: ads.tsx honours the remote kill switch (release build, fake LevelPlay
 * SDK of the same shape as adPacing.test.ts / adsRewardedReadiness.test.ts).
 *
 * The flag is mocked ON and the URL set, because the committed flag is OFF and
 * then no kill can ever act (remoteConfig.test.ts pins that). Each boot() is a
 * fresh process over the same "disk" Map, so a kill persisted by one process is
 * the cached kill the next process seeds at boot.
 *
 * Outside this test: App.tsx's boot order (initAds only after initSaveSystem
 * settles) and the real fetch, both checked on the emulator (W6-02 report).
 */

type Listener = Record<string, (...args: unknown[]) => void>;

const sdk = {
  inits: 0,
  metaData: 0,
  initOutcome: 'success' as 'success' | 'failed',
  interstitialListener: null as Listener | null,
  rewardedListener: null as Listener | null,
  interstitialShows: 0,
  rewardedShows: 0,
};

jest.mock('../../featureFlags', () => ({ REMOTE_KILL_SWITCH: true }));

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
    setMetaData: () => {
      sdk.metaData += 1;
      return Promise.resolve();
    },
    init: (_req: unknown, cb: { onInitSuccess: () => void; onInitFailed: (e: unknown) => void }) => {
      sdk.inits += 1;
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
      return Promise.resolve(true);
    }
    showAd() {
      sdk.interstitialShows += 1;
      // The SDK displays and closes the ad.
      setImmediate(() => {
        sdk.interstitialListener?.onAdDisplayed({});
        sdk.interstitialListener?.onAdClosed({});
      });
      return Promise.resolve();
    }
  },
  LevelPlayRewardedAd: class {
    setListener(l: Listener) {
      sdk.rewardedListener = l;
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
type RcModule = typeof import('../../config/remoteConfig');
type TelemetryModule = typeof import('../../telemetry/telemetry');
type FetchLike = import('../../config/remoteConfig').FetchLike;

const BITS = 'arrows_rc_kill_bits';
const VERSION = 'arrows_rc_version';
const FINISHED = 'arrows_finished_games';

function mapStore(disk: Map<string, number>) {
  return {
    getInt: (k: string, d: number) => (disk.has(k) ? disk.get(k)! : d),
    setInt: (k: string, v: number) => void disk.set(k, v),
    deleteKey: (k: string) => void disk.delete(k),
  };
}

/** A fetch answering 200 with `payload`, released only when `release()` is called. */
function gatedFetch(payload: unknown) {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const fetchImpl: FetchLike = async () => {
    await gate;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
  };
  return { fetchImpl, release: () => release() };
}

const neverFetch: FetchLike = () => new Promise(() => {});

/**
 * A fresh process over `disk`, booted in App.tsx's order after hydration:
 * the remote config seeds (and starts its fetch), then initAds().
 */
async function boot(disk: Map<string, number>, fetchImpl: FetchLike = neverFetch) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL = 'http://localhost:8787/arrows-config.json';
  let ads: AdsModule | null = null;
  let save: SaveModule | null = null;
  let rc: RcModule | null = null;
  let telemetry: TelemetryModule | null = null;
  jest.isolateModules(() => {
    save = require('../../core/saveSystem') as SaveModule;
    rc = require('../../config/remoteConfig') as RcModule;
    telemetry = require('../../telemetry/telemetry') as TelemetryModule;
    ads = require('../ads') as AdsModule;
  });
  const telemetrySink = telemetry!.createMemorySink(20);
  telemetry!.Telemetry.configure({ validate: true, disabled: false });
  telemetry!.Telemetry.useSink(telemetrySink);
  save!.SaveSystem.useStore(mapStore(disk));
  const fetched = rc!.initRemoteConfig({ fetchImpl });
  await ads!.initAds();
  await settle();
  return { ads: ads!, save: save!, rc: rc!, fetched, telemetrySink };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
  sdk.inits = 0;
  sdk.metaData = 0;
  sdk.initOutcome = 'success';
  sdk.interstitialListener = null;
  sdk.rewardedListener = null;
  sdk.interstitialShows = 0;
  sdk.rewardedShows = 0;
  // Init retries and ad reloads schedule timers; setImmediate stays real.
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL;
});

describe('cached kill at boot (ads killed by a previous process)', () => {
  const killedDisk = () =>
    new Map<string, number>([
      [BITS, 1],
      [VERSION, 2],
      [FINISHED, 2], // an interstitial is due
    ]);

  test('control: nothing cached, LevelPlay.init runs', async () => {
    await boot(new Map([[FINISHED, 2]]));
    expect(sdk.inits).toBe(1);
  });

  test('a rewarded success emits one request, result and reward with its placement', async () => {
    const { ads, telemetrySink } = await boot(new Map());
    sdk.rewardedListener!.onAdLoaded({});

    await expect(ads.Ads.showRewarded('hint')).resolves.toBe(true);

    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
      'ad_reward',
    ]);
    expect(telemetrySink.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ad_request', placement: 'hint' }),
      expect.objectContaining({ name: 'ad_result', placement: 'hint', outcome: 'shown' }),
      expect.objectContaining({ name: 'ad_reward', placement: 'hint', earned: true }),
    ]));
  });

  test('LevelPlay.init (and the pre-init metadata call) never runs, including retries', async () => {
    const { ads } = await boot(killedDisk());
    expect(sdk.inits).toBe(0);
    expect(sdk.metaData).toBe(0);
    // W0-02's retry path checks the same gate: timed retries and app-active.
    jest.advanceTimersByTime(5000 + 15000 + 45000);
    await settle();
    ads.adInitController.onAppActive();
    await settle();
    expect(sdk.inits).toBe(0);
  });

  test('a due interstitial is not shown and the pacing counter is unchanged', async () => {
    const disk = killedDisk();
    const { ads, telemetrySink } = await boot(disk);
    await ads.Ads.showInterstitialIfDue();
    expect(sdk.interstitialShows).toBe(0);
    expect(disk.get(FINISHED)).toBe(2);
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
    ]);
    expect(telemetrySink.events[1]).toEqual(expect.objectContaining({ outcome: 'killed' }));
  });

  test('rewarded reports not ready and showRewarded resolves false', async () => {
    const { ads, telemetrySink } = await boot(killedDisk());
    expect(ads.Ads.rewardedReady).toBe(false);
    await expect(ads.Ads.showRewarded('hint')).resolves.toBe(false);
    expect(sdk.rewardedShows).toBe(0);
    expect(telemetrySink.events.map((event) => event.name)).toEqual([
      'ad_request',
      'ad_result',
      'ad_reward',
    ]);
    expect(telemetrySink.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'ad_result',
        placement: 'hint',
        outcome: 'killed',
      }),
      expect.objectContaining({ name: 'ad_reward', placement: 'hint', earned: false }),
    ]));
  });
});

describe('a kill fetched mid-session applies to the next ad decision', () => {
  test('ads killed after init: a loaded rewarded ad turns not-ready, nothing shows', async () => {
    const disk = new Map<string, number>([[FINISHED, 2]]);
    const kill = gatedFetch({ configVersion: 2, adsEnabled: false });
    const { ads, fetched } = await boot(disk, kill.fetchImpl);
    expect(sdk.inits).toBe(1);
    sdk.rewardedListener!.onAdLoaded({});
    expect(ads.Ads.rewardedReady).toBe(true);
    const seen: boolean[] = [];
    ads.Ads.subscribeRewardedReady((v) => seen.push(v));

    kill.release();
    expect(await fetched).toBe('accepted');

    expect(seen).toEqual([false]); // GameScreen's useSyncExternalStore hears it
    expect(ads.Ads.rewardedReady).toBe(false);
    await expect(ads.Ads.showRewarded()).resolves.toBe(false);
    await ads.Ads.showInterstitialIfDue();
    expect(sdk.rewardedShows).toBe(0);
    expect(sdk.interstitialShows).toBe(0);
    expect(disk.get(FINISHED)).toBe(2);
    expect(disk.get(BITS)).toBe(1);
    expect(disk.get(VERSION)).toBe(2);
  });

  test('interstitials only: rewarded still shows, the due interstitial does not', async () => {
    const disk = new Map<string, number>([[FINISHED, 2]]);
    const kill = gatedFetch({ configVersion: 2, interstitialsEnabled: false });
    const { ads, fetched } = await boot(disk, kill.fetchImpl);
    sdk.rewardedListener!.onAdLoaded({});
    kill.release();
    await fetched;

    expect(ads.Ads.rewardedReady).toBe(true);
    await ads.Ads.showInterstitialIfDue();
    expect(sdk.interstitialShows).toBe(0);
    expect(disk.get(FINISHED)).toBe(2);
    const earned = ads.Ads.showRewarded();
    await settle();
    await expect(earned).resolves.toBe(true);
    expect(sdk.rewardedShows).toBe(1);
  });

  test('rewarded only: the due interstitial still shows, rewarded does not', async () => {
    const disk = new Map<string, number>([[FINISHED, 2]]);
    const kill = gatedFetch({ configVersion: 2, rewardedEnabled: false });
    const { ads, fetched } = await boot(disk, kill.fetchImpl);
    sdk.rewardedListener!.onAdLoaded({});
    kill.release();
    await fetched;

    expect(ads.Ads.rewardedReady).toBe(false);
    await expect(ads.Ads.showRewarded()).resolves.toBe(false);
    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    await shown;
    expect(sdk.interstitialShows).toBe(1);
    expect(disk.get(FINISHED)).toBe(0); // reset by onAdDisplayed, as W0-05 ships
  });

  test('telemetry only: ads are untouched', async () => {
    const disk = new Map<string, number>([[FINISHED, 2]]);
    const kill = gatedFetch({ configVersion: 2, telemetryEnabled: false });
    const { ads, fetched } = await boot(disk, kill.fetchImpl);
    sdk.rewardedListener!.onAdLoaded({});
    kill.release();
    await fetched;
    expect(ads.Ads.rewardedReady).toBe(true);
    const shown = ads.Ads.showInterstitialIfDue();
    await settle();
    await shown;
    expect(sdk.interstitialShows).toBe(1);
  });
});

describe('re-enable', () => {
  test('a higher version with ads enabled starts init in the same session', async () => {
    const disk = new Map<string, number>([
      [BITS, 1],
      [VERSION, 2],
    ]);
    const enable = gatedFetch({ configVersion: 3, adsEnabled: true });
    const { ads, fetched } = await boot(disk, enable.fetchImpl);
    expect(sdk.inits).toBe(0);

    enable.release();
    expect(await fetched).toBe('accepted');
    await settle();

    expect(sdk.inits).toBe(1);
    expect(disk.get(BITS)).toBe(0);
    sdk.rewardedListener!.onAdLoaded({});
    expect(ads.Ads.rewardedReady).toBe(true);
  });

  test('the next process boots with ads on from the persisted bits', async () => {
    const disk = new Map<string, number>([
      [BITS, 1],
      [VERSION, 2],
    ]);
    const enable = gatedFetch({ configVersion: 3, adsEnabled: true });
    const first = await boot(disk, enable.fetchImpl);
    enable.release();
    await first.fetched;

    sdk.inits = 0;
    await boot(disk); // cold start, offline fetch
    expect(sdk.inits).toBe(1);
  });
});

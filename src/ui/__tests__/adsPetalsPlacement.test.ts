/**
 * PETAL-ADS-01: the 'petals' rewarded placement (collection book, "Watch an ad · +3 petals").
 *
 * Release build (`__DEV__` false, test flag unset), so owner units are requested. The petals placement has its own
 * owner unit ("Arrows - Rewarded - Petals", owner 2026-10-04), its own ad object and its own readiness. With the flag
 * off, nothing about the ads changes: two rewarded objects, exactly as before, and the petals unit is never requested.
 */
import {
  AdEventType,
  RewardedAdEventType,
  createFakeGma,
  type FakeAd,
} from './helpers/fakeGoogleMobileAds';

const mockGma = createFakeGma();
const mockFlags: Record<string, unknown> = {};

jest.mock('react-native-google-mobile-ads', () => mockGma.module());
jest.mock('../../featureFlags', () => mockFlags);
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

const HINT_UNIT = 'ca-app-pub-9813131856455133/7549521178';
const CONTINUE_UNIT = 'ca-app-pub-9813131856455133/3505414519';
const PETALS_UNIT = 'ca-app-pub-9813131856455133/5754923896';
const BITS = 'arrows_rc_kill_bits';
const VERSION = 'arrows_rc_version';

type AdsModule = typeof import('../ads');
type SaveModule = typeof import('../../core/saveSystem');
type RcModule = typeof import('../../config/remoteConfig');
type TelemetryModule = typeof import('../../telemetry/telemetry');

function setFlags(petals: boolean, killSwitch = false) {
  for (const k of Object.keys(mockFlags)) delete mockFlags[k];
  Object.assign(mockFlags, {
    REMOTE_KILL_SWITCH: killSwitch, CONSENT_GATE: false, META_BANNER: false,
    META_SKIN_PICKER: true, META_REWARD_PATH: true, META_REWARD_BOOK: true, META_SEASONS: false,
    META_PETAL_ADS: petals,
  });
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

async function boot(disk = new Map<string, number>()) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
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
  const sink = telemetry!.createMemorySink(50);
  telemetry!.Telemetry.configure({ validate: true, disabled: false });
  telemetry!.Telemetry.useSink(sink);
  save!.SaveSystem.useStore({
    getInt: (k, d) => (disk.has(k) ? disk.get(k)! : d),
    setInt: (k, v) => void disk.set(k, v),
    deleteKey: (k) => void disk.delete(k),
  });
  rc!.initRemoteConfig({ fetchImpl: () => new Promise(() => {}) });
  await ads!.initAds();
  await settle();
  return { ...ads!, sink };
}

function rewardedAds(): { cont: FakeAd; hint: FakeAd; petals: FakeAd | undefined } {
  const live = mockGma.live('rewarded');
  return {
    cont: live.find((a) => a.unitId === CONTINUE_UNIT)!,
    hint: live.find((a) => a.unitId === HINT_UNIT)!,
    petals: live.find((a) => a.unitId === PETALS_UNIT),
  };
}

beforeEach(() => {
  mockGma.reset();
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('flag OFF (control: ads unchanged)', () => {
  beforeEach(() => setFlags(false));

  test('only the continue and hint rewarded objects exist (petals unit never requested); petals is never ready', async () => {
    const { Ads } = await boot();
    expect(mockGma.live('rewarded').map((a) => a.unitId).sort()).toEqual([CONTINUE_UNIT, HINT_UNIT].sort());
    rewardedAds().hint.emit(RewardedAdEventType.LOADED);
    expect(Ads.isRewardedReady('petals')).toBe(false);
  });

  test('showRewarded("petals") shows nothing and grants nothing', async () => {
    const { Ads } = await boot();
    rewardedAds().hint.emit(RewardedAdEventType.LOADED);
    await expect(Ads.showRewarded('petals')).resolves.toBe(false);
    expect(mockGma.ads.reduce((n, a) => n + a.shows, 0)).toBe(0);
  });
});

describe('flag ON', () => {
  beforeEach(() => setFlags(true));

  test('a third rewarded object is created on the dedicated petals owner unit and loaded once', async () => {
    await boot();
    const { cont, hint, petals } = rewardedAds();
    expect(mockGma.live('rewarded').map((a) => a.unitId).sort()).toEqual([CONTINUE_UNIT, HINT_UNIT, PETALS_UNIT].sort());
    expect(petals).toBeDefined();
    expect([cont.loads, hint.loads, petals!.loads]).toEqual([1, 1, 1]);
  });

  test('own readiness: the petals ad loading does not make hint ready, and vice versa', async () => {
    const { Ads } = await boot();
    const { hint, petals } = rewardedAds();
    petals!.emit(RewardedAdEventType.LOADED);
    expect(Ads.isRewardedReady('petals')).toBe(true);
    expect(Ads.isRewardedReady('hint')).toBe(false);
    petals!.emit(AdEventType.ERROR, { phase: 'load' });
    hint.emit(RewardedAdEventType.LOADED);
    expect(Ads.isRewardedReady('petals')).toBe(false);
    expect(Ads.isRewardedReady('hint')).toBe(true);
    jest.advanceTimersByTime(15000); // only the petals ad is re-requested
    expect(petals!.loads).toBe(2);
    expect(hint.loads).toBe(1);
  });

  test('earned only on EARNED_REWARD: shown, earned, closed resolves true with petals telemetry', async () => {
    const { Ads, sink } = await boot();
    const { hint, petals } = rewardedAds();
    petals!.emit(RewardedAdEventType.LOADED);
    const earned = Ads.showRewarded('petals');
    await settle();
    expect(petals!.shows).toBe(1);
    expect(hint.shows).toBe(0);
    petals!.emit(AdEventType.OPENED);
    expect(Ads.isRewardedReady('petals')).toBe(false); // consumed while it shows
    petals!.emit(RewardedAdEventType.EARNED_REWARD, { type: 'reward', amount: 1 });
    petals!.emit(AdEventType.CLOSED);
    await expect(earned).resolves.toBe(true);
    expect(sink.events).toEqual([
      expect.objectContaining({ name: 'ad_request', format: 'rewarded', placement: 'petals' }),
      expect.objectContaining({ name: 'ad_result', placement: 'petals', outcome: 'shown' }),
      expect.objectContaining({ name: 'ad_reward', placement: 'petals', earned: true }),
    ]);
    expect(petals!.loads).toBe(2); // keeps one preloaded
  });

  test('dismissed before the reward: resolves false (nothing to grant), outcome dismissed', async () => {
    const { Ads, sink } = await boot();
    const { petals } = rewardedAds();
    petals!.emit(RewardedAdEventType.LOADED);
    const earned = Ads.showRewarded('petals');
    await settle();
    petals!.emit(AdEventType.OPENED);
    petals!.emit(AdEventType.CLOSED);
    await expect(earned).resolves.toBe(false);
    expect(sink.events[1]).toEqual(expect.objectContaining({ placement: 'petals', outcome: 'dismissed' }));
    expect(sink.events[2]).toEqual(expect.objectContaining({ placement: 'petals', earned: false }));
  });

  test('not loaded: resolves false without showing anything (the "No ad available" state)', async () => {
    const { Ads, sink } = await boot();
    await expect(Ads.showRewarded('petals')).resolves.toBe(false);
    expect(mockGma.ads.reduce((n, a) => n + a.shows, 0)).toBe(0);
    expect(sink.events[1]).toEqual(expect.objectContaining({ placement: 'petals', outcome: 'not_ready' }));
  });

  test('a second show while the first is on screen shows nothing more', async () => {
    const { Ads } = await boot();
    const { petals } = rewardedAds();
    petals!.emit(RewardedAdEventType.LOADED);
    const first = Ads.showRewarded('petals');
    await settle();
    await expect(Ads.showRewarded('petals')).resolves.toBe(false);
    expect(petals!.shows).toBe(1);
    petals!.emit(AdEventType.OPENED);
    petals!.emit(RewardedAdEventType.EARNED_REWARD, {});
    petals!.emit(AdEventType.CLOSED);
    await expect(first).resolves.toBe(true);
  });
});

describe('flag ON, remote kill switch', () => {
  beforeEach(() => setFlags(true, true));

  test('rewarded killed: the petals ad is never requested, never ready, never shown', async () => {
    process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL = 'http://localhost:8787/arrows-config.json';
    try {
      const { Ads, sink } = await boot(new Map([[BITS, 4], [VERSION, 2]])); // bit 2 = rewarded
      const { petals } = rewardedAds();
      expect(petals).toBeDefined();
      expect(petals!.loads).toBe(0);
      petals!.emit(RewardedAdEventType.LOADED);
      expect(Ads.isRewardedReady('petals')).toBe(false);
      await expect(Ads.showRewarded('petals')).resolves.toBe(false);
      expect(petals!.shows).toBe(0);
      expect(sink.events[1]).toEqual(expect.objectContaining({ placement: 'petals', outcome: 'killed' }));
    } finally {
      delete process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL;
    }
  });
});

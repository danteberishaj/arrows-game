/**
 * ADMOB-B, ruling M3: the hint and the continue placements each have their own
 * rewarded ad unit and their own readiness, so one being unready never blocks
 * the other. `Ads.rewardedReady` / `subscribeRewardedReady(cb)` keep meaning the
 * continue placement (the lose panel); the hint button reads
 * `Ads.isRewardedReady('hint')` / `subscribeRewardedReady(cb, 'hint')`.
 *
 * Release build (`__DEV__` false, test flag unset), so the owner units are the
 * ones requested; the fake SDK tells the two ads apart by unit ID.
 */
import {
  AdEventType,
  RewardedAdEventType,
  createFakeGma,
  loadError,
  showError,
  type FakeAd,
} from './helpers/fakeGoogleMobileAds';

const mockGma = createFakeGma();

jest.mock('react-native-google-mobile-ads', () => mockGma.module());

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
const INTERSTITIAL_UNIT = 'ca-app-pub-9813131856455133/6706292920';

type AdsModule = typeof import('../ads');
type TelemetryModule = typeof import('../../telemetry/telemetry');

async function boot() {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
  let ads: AdsModule | null = null;
  let telemetry: TelemetryModule | null = null;
  jest.isolateModules(() => {
    telemetry = require('../../telemetry/telemetry') as TelemetryModule;
    ads = require('../ads') as AdsModule;
  });
  const sink = telemetry!.createMemorySink(50);
  telemetry!.Telemetry.configure({ validate: true, disabled: false });
  telemetry!.Telemetry.useSink(sink);
  await ads!.initAds();
  await settle();
  return { ...ads!, sink };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

function only(unit: string): FakeAd {
  const ads = mockGma.live('rewarded', unit);
  expect(ads).toHaveLength(1);
  return ads[0];
}

beforeEach(() => {
  mockGma.reset();
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('two rewarded units (M3)', () => {
  test('init creates one rewarded ad per placement on its own owner unit, each loaded once', async () => {
    await boot();
    expect(mockGma.live('rewarded').map((ad) => ad.unitId).sort()).toEqual(
      [CONTINUE_UNIT, HINT_UNIT].sort(),
    );
    expect(only(HINT_UNIT).loads).toBe(1);
    expect(only(CONTINUE_UNIT).loads).toBe(1);
    expect(mockGma.live('interstitial').map((ad) => ad.unitId)).toEqual([INTERSTITIAL_UNIT]);
  });

  test('hint loaded, continue not: the hint is ready and shows; continue stays not ready', async () => {
    const { Ads, sink } = await boot();
    const hintSeen: boolean[] = [];
    const continueSeen: boolean[] = [];
    Ads.subscribeRewardedReady((v) => hintSeen.push(v), 'hint');
    Ads.subscribeRewardedReady((v) => continueSeen.push(v));

    only(HINT_UNIT).emit(RewardedAdEventType.LOADED);

    expect(Ads.isRewardedReady('hint')).toBe(true);
    expect(Ads.isRewardedReady('continue')).toBe(false);
    expect(Ads.rewardedReady).toBe(false); // the continue placement
    expect(hintSeen).toEqual([true]);
    expect(continueSeen).toEqual([]);

    await expect(Ads.showRewarded('continue')).resolves.toBe(false);
    expect(only(HINT_UNIT).shows).toBe(0); // continue never borrows the hint's ad
    expect(sink.events[1]).toEqual(
      expect.objectContaining({ name: 'ad_result', placement: 'continue', outcome: 'not_ready' }),
    );

    const earned = Ads.showRewarded('hint');
    await settle();
    expect(only(HINT_UNIT).shows).toBe(1);
    expect(only(CONTINUE_UNIT).shows).toBe(0);
    only(HINT_UNIT).emit(AdEventType.OPENED);
    only(HINT_UNIT).emit(RewardedAdEventType.EARNED_REWARD, { type: 'reward', amount: 1 });
    only(HINT_UNIT).emit(AdEventType.CLOSED);
    await expect(earned).resolves.toBe(true);
  });

  test('continue loaded, hint load failed: continue stays ready and shows', async () => {
    const { Ads } = await boot();
    only(CONTINUE_UNIT).emit(RewardedAdEventType.LOADED);
    only(HINT_UNIT).emit(AdEventType.ERROR, loadError());

    expect(Ads.rewardedReady).toBe(true);
    expect(Ads.isRewardedReady('hint')).toBe(false);

    // The hint's 15 s reload re-requests the hint unit only.
    jest.advanceTimersByTime(15000);
    expect(only(HINT_UNIT).loads).toBe(2);
    expect(only(CONTINUE_UNIT).loads).toBe(1);

    const earned = Ads.showRewarded('continue');
    await settle();
    expect(only(CONTINUE_UNIT).shows).toBe(1);
    only(CONTINUE_UNIT).emit(AdEventType.OPENED);
    only(CONTINUE_UNIT).emit(RewardedAdEventType.EARNED_REWARD, { type: 'reward', amount: 1 });
    only(CONTINUE_UNIT).emit(AdEventType.CLOSED);
    await expect(earned).resolves.toBe(true);
  });

  test('showing one placement consumes only its own ad', async () => {
    const { Ads } = await boot();
    only(CONTINUE_UNIT).emit(RewardedAdEventType.LOADED);
    only(HINT_UNIT).emit(RewardedAdEventType.LOADED);

    const earned = Ads.showRewarded('continue');
    await settle();
    only(CONTINUE_UNIT).emit(AdEventType.OPENED);
    expect(Ads.rewardedReady).toBe(false);
    expect(Ads.isRewardedReady('hint')).toBe(true);
    only(CONTINUE_UNIT).emit(AdEventType.CLOSED); // closed early: no reward
    await expect(earned).resolves.toBe(false);

    expect(Ads.isRewardedReady('hint')).toBe(true);
    expect(only(CONTINUE_UNIT).loads).toBe(2); // the continue unit preloads its next ad
    expect(only(HINT_UNIT).loads).toBe(1);
  });

  test('a show failure on the hint reports display_failed and leaves continue ready', async () => {
    const { Ads, sink } = await boot();
    only(CONTINUE_UNIT).emit(RewardedAdEventType.LOADED);
    only(HINT_UNIT).emit(RewardedAdEventType.LOADED);

    const earned = Ads.showRewarded('hint');
    await settle();
    only(HINT_UNIT).emit(AdEventType.ERROR, showError());
    await expect(earned).resolves.toBe(false);

    expect(Ads.isRewardedReady('hint')).toBe(false);
    expect(Ads.rewardedReady).toBe(true);
    expect(only(HINT_UNIT).loads).toBe(2); // the failed ad is replaced at once
    expect(sink.events.map((e) => e.name)).toEqual(['ad_request', 'ad_result', 'ad_reward']);
    expect(sink.events[1]).toEqual(
      expect.objectContaining({ placement: 'hint', outcome: 'display_failed' }),
    );
    expect(sink.events[2]).toEqual(
      expect.objectContaining({ placement: 'hint', earned: false }),
    );
  });
});

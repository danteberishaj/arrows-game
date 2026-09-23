/**
 * ADMOB-C, rulings M4 and M5, at the ads.tsx level (release build, fake AdMob):
 * - the menu banner is allowed only with META_BANNER on, the SDK initialised,
 *   ads not remote-killed and consent allowing ad surfaces; a mid-session kill
 *   or a consent withdrawal removes it at once;
 * - the banner request carries the build's banner unit and the same privacy
 *   request options as the full-screen ads;
 * - the UMP ConsentSource drives the W7-01 gate (refusal = no init at all);
 * - the privacy-options entry point closes every ad surface on a withdrawal
 *   even when the following re-gather fails.
 */
import type { ConsentSource, ConsentState } from '../consent';
import { createFakeGma, legacyListener } from './helpers/fakeGoogleMobileAds';

const mockGma = createFakeGma();
const mockFlags = { CONSENT_GATE: false, META_BANNER: true, REMOTE_KILL_SWITCH: true };

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

jest.mock('react-native-google-mobile-ads', () => mockGma.module());

type AdsModule = typeof import('../ads');
type SaveModule = typeof import('../../core/saveSystem');
type RcModule = typeof import('../../config/remoteConfig');
type FetchLike = import('../../config/remoteConfig').FetchLike;

const OWNER_BANNER = 'ca-app-pub-9813131856455133/5508761320';
const GRANTED: ConsentState = { resolved: true, gdprApplies: true, personalisedAds: true, ccpaOptOut: false };
const REFUSED: ConsentState = { resolved: true, gdprApplies: true, personalisedAds: false, ccpaOptOut: false };
const NON_EEA_CCPA: ConsentState = { resolved: true, gdprApplies: false, personalisedAds: true, ccpaOptOut: true };

function mapStore(disk: Map<string, number>) {
  return {
    getInt: (k: string, d: number) => (disk.has(k) ? disk.get(k)! : d),
    setInt: (k: string, v: number) => void disk.set(k, v),
    deleteKey: (k: string) => void disk.delete(k),
  };
}

const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};

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

/** A mutable fixture source: tests move `state` and choose what each call does. */
function fixtureSource(first: ConsentState) {
  const control = {
    state: first,
    privacyState: first,
    gatherFails: false,
    privacyRequired: true,
    privacyCalls: 0,
  };
  const source: ConsentSource = {
    gather: async () => {
      if (control.gatherFails) throw new Error('UMP offline');
      return control.state;
    },
    privacyOptionsRequired: () => control.privacyRequired,
    showPrivacyOptions: async () => {
      control.privacyCalls += 1;
      return control.privacyState;
    },
  };
  return { source, control };
}

async function boot(opts: {
  disk?: Map<string, number>;
  source?: ConsentSource | 'player';
  fetchImpl?: FetchLike;
} = {}) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL = 'http://localhost:8787/arrows-config.json';
  const disk = opts.disk ?? new Map<string, number>();
  let ads: AdsModule | null = null;
  let save: SaveModule | null = null;
  let rc: RcModule | null = null;
  jest.isolateModules(() => {
    save = require('../../core/saveSystem') as SaveModule;
    rc = require('../../config/remoteConfig') as RcModule;
    ads = require('../ads') as AdsModule;
  });
  save!.SaveSystem.useStore(mapStore(disk));
  const fetched = rc!.initRemoteConfig({ fetchImpl: opts.fetchImpl ?? neverFetch });
  const source = opts.source === 'player' ? ads!.playerConsentSource() : opts.source;
  await ads!.initAds(source);
  await settle();
  return { ads: ads!, save: save!, disk, fetched };
}

beforeEach(() => {
  mockGma.reset();
  mockGma.config.loadedOverride = { interstitial: true, rewarded: true };
  mockGma.config.showBehaviour = { interstitial: 'auto', rewarded: 'auto' };
  mockFlags.CONSENT_GATE = false;
  mockFlags.META_BANNER = true;
  mockFlags.REMOTE_KILL_SWITCH = true;
  delete process.env.EXPO_PUBLIC_CONSENT_FIXTURE;
  jest.resetModules();
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL;
});

describe('menu banner gating (M4)', () => {
  test('flag on, gate off, nothing killed: allowed after init with the banner unit and the full-screen request options', async () => {
    const { ads } = await boot();
    expect(mockGma.inits).toBe(1);
    expect(ads.Ads.bannerAllowed).toBe(true);
    const request = ads.Ads.bannerRequest();
    expect(request).not.toBeNull();
    expect(request!.unitId).toBe(OWNER_BANNER); // jest is a "shipping" build: see adUnits.test.ts
    expect(request!.size).toBe('ANCHORED_ADAPTIVE_BANNER');
    expect(request!.requestOptions).toEqual(mockGma.ads[0].options);
  });

  test('not allowed before the SDK is initialised', async () => {
    mockGma.config.initOutcome = 'failed';
    const { ads } = await boot();
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.bannerRequest()).toBeNull();
  });

  test('flag off: never allowed, even with the SDK running', async () => {
    mockFlags.META_BANNER = false;
    const { ads } = await boot();
    expect(mockGma.inits).toBe(1);
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.bannerRequest()).toBeNull();
  });

  test('killed at boot (cached all-ads kill): no init, no banner', async () => {
    const { ads } = await boot({
      disk: new Map([
        ['arrows_rc_kill_bits', 1],
        ['arrows_rc_version', 2],
      ]),
    });
    expect(mockGma.inits).toBe(0);
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.bannerRequest()).toBeNull();
  });

  test('a mid-session all-ads kill removes the banner at once (subscribers hear false)', async () => {
    const kill = gatedFetch({ configVersion: 2, adsEnabled: false });
    const { ads, fetched } = await boot({ fetchImpl: kill.fetchImpl });
    expect(ads.Ads.bannerAllowed).toBe(true);
    const seen: boolean[] = [];
    ads.Ads.subscribeBanner((v) => seen.push(v));
    kill.release();
    await fetched;
    await settle();
    expect(seen).toEqual([false]);
    expect(ads.Ads.bannerRequest()).toBeNull();
  });

  test('an interstitial-only or rewarded-only kill leaves the banner (it obeys the all-ads bit)', async () => {
    const kill = gatedFetch({ configVersion: 2, interstitialsEnabled: false, rewardedEnabled: false });
    const { ads, fetched } = await boot({ fetchImpl: kill.fetchImpl });
    kill.release();
    await fetched;
    await settle();
    expect(ads.Ads.bannerAllowed).toBe(true);
  });

  test('consent gate on, refused at boot: no init and no banner', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source } = fixtureSource(REFUSED);
    const { ads } = await boot({ source });
    expect(mockGma.inits).toBe(0);
    expect(ads.adInitController.state).toBe('declined');
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.bannerRequest()).toBeNull();
  });

  test('consent gate on, granted then withdrawn: the banner goes away with the other surfaces', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source, control } = fixtureSource(GRANTED);
    const { ads } = await boot({ source });
    expect(ads.Ads.bannerAllowed).toBe(true);
    const seen: boolean[] = [];
    ads.Ads.subscribeBanner((v) => seen.push(v));

    control.state = REFUSED;
    ads.adInitController.consentChanged();
    await settle();

    expect(seen).toEqual([false]);
    expect(ads.Ads.bannerRequest()).toBeNull();
    expect(mockGma.inits).toBe(1);
  });

  test('a consent change that alters the request options gives the banner a new request key and options', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source, control } = fixtureSource(GRANTED);
    const { ads } = await boot({ source });
    const first = ads.Ads.bannerRequest()!;
    expect(first.requestOptions).toEqual({});

    control.state = NON_EEA_CCPA;
    ads.adInitController.consentChanged();
    await settle();

    const second = ads.Ads.bannerRequest()!;
    expect(second.requestOptions).toEqual({ networkExtras: { rdp: '1' } });
    expect(second.key).not.toBe(first.key);
  });
});

describe('UMP as the player consent source (M5, CONSENT_GATE on)', () => {
  beforeEach(() => {
    mockFlags.CONSENT_GATE = true;
  });

  test('EEA grant through UMP: consent is gathered before initialize and ads start', async () => {
    const { ads, disk } = await boot({ source: 'player' });
    expect(mockGma.ump.calls.slice(0, 2)).toEqual([
      'requestInfoUpdate:{}',
      'loadAndShowConsentFormIfRequired',
    ]);
    expect(mockGma.inits).toBe(1);
    expect(disk.get('arrows_consent')).toBe(7); // resolved | gdpr | personalised
    expect(ads.Ads.bannerAllowed).toBe(true);
    expect(ads.adPrivacyOptionsRequired()).toBe(true);
  });

  test('EEA refusal through UMP: no initialize, no banner, rewarded unavailable', async () => {
    mockGma.ump.storeAndAccess = false;
    mockGma.ump.personalised = false;
    const { ads, disk } = await boot({ source: 'player' });
    expect(mockGma.inits).toBe(0);
    expect(mockGma.moduleLoads).toBe(1);
    expect(disk.get('arrows_consent')).toBe(3); // resolved | gdpr, not personalised
    expect(ads.adInitController.state).toBe('declined');
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.rewardedReady).toBe(false);
    expect(ads.Ads.isRewardedReady('hint')).toBe(false);
    await expect(ads.Ads.showRewarded('hint')).resolves.toBe(false);
  });

  test('no form can be built (no published GDPR message): no initialize, consent bits untouched, retried later', async () => {
    mockGma.ump.form = 'error';
    const { ads, disk } = await boot({ source: 'player' });
    expect(mockGma.inits).toBe(0);
    expect(disk.has('arrows_consent')).toBe(false);
    expect(ads.adInitController.state).toBe('failed');
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.rewardedReady).toBe(false);
  });

  test('a killed boot never reaches UMP', async () => {
    await boot({
      source: 'player',
      disk: new Map([
        ['arrows_rc_kill_bits', 1],
        ['arrows_rc_version', 2],
      ]),
    });
    expect(mockGma.ump.calls).toEqual([]);
    expect(mockGma.moduleLoads).toBe(0);
  });

  test('a consent fixture still wins over UMP (W7-01 verification builds)', async () => {
    process.env.EXPO_PUBLIC_CONSENT_FIXTURE = 'refused-eea';
    const { ads } = await boot({ source: 'player' });
    expect(mockGma.ump.calls).toEqual([]);
    expect(ads.adInitController.state).toBe('declined');
  });
});

describe('the ad privacy-options entry point (M5)', () => {
  test('gate off: does nothing and reports false', async () => {
    const { source, control } = fixtureSource(GRANTED);
    const { ads } = await boot({ source });
    await expect(ads.openAdPrivacyOptions()).resolves.toBe(false);
    expect(control.privacyCalls).toBe(0);
    expect(ads.adPrivacyOptionsRequired()).toBe(false);
  });

  test('withdrawal closes the banner and both rewarded placements at once, even if the re-gather fails', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source, control } = fixtureSource(GRANTED);
    const { ads, disk } = await boot({ source });
    legacyListener(() => mockGma.live('rewarded')).onAdLoaded({});
    expect(ads.Ads.rewardedReady).toBe(true);
    expect(ads.Ads.bannerAllowed).toBe(true);

    control.privacyState = REFUSED;
    control.gatherFails = true; // UMP unreachable for the re-gather
    await expect(ads.openAdPrivacyOptions()).resolves.toBe(true);

    expect(control.privacyCalls).toBe(1);
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(ads.Ads.rewardedReady).toBe(false);
    expect(ads.Ads.isRewardedReady('hint')).toBe(false);
    expect(disk.get('arrows_consent')).toBe(3);
    await settle();
    expect(ads.Ads.bannerAllowed).toBe(false);
    expect(mockGma.inits).toBe(1);
  });

  test('a re-grant through the privacy options re-opens surfaces via the normal attempt', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source, control } = fixtureSource(REFUSED);
    const { ads } = await boot({ source });
    expect(mockGma.inits).toBe(0);

    control.privacyState = GRANTED;
    control.state = GRANTED;
    await ads.openAdPrivacyOptions();
    await settle();

    expect(mockGma.inits).toBe(1);
    expect(ads.Ads.bannerAllowed).toBe(true);
  });

  test('a privacy form error changes nothing and reports false', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source } = fixtureSource(GRANTED);
    source.showPrivacyOptions = async () => {
      throw new Error('privacy-options-form-error');
    };
    const { ads } = await boot({ source });
    await expect(ads.openAdPrivacyOptions()).resolves.toBe(false);
    expect(ads.Ads.bannerAllowed).toBe(true);
  });

  test('adPrivacyOptionsRequired follows the source when the gate is on', async () => {
    mockFlags.CONSENT_GATE = true;
    const { source, control } = fixtureSource(GRANTED);
    const { ads } = await boot({ source });
    expect(ads.adPrivacyOptionsRequired()).toBe(true);
    control.privacyRequired = false;
    expect(ads.adPrivacyOptionsRequired()).toBe(false);
  });
});

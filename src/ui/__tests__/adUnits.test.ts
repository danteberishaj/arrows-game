/**
 * ADMOB-B, ruling M1: which AdMob ad units a build requests.
 *
 * Google's sample units in every development build and in any build made with
 * EXPO_PUBLIC_ADMOB_TEST_ADS=1 (all emulator verification); the owner's real
 * units only in a shipping build. The owner IDs are copied from
 * .superpowers/sdd/TASKS/admob-migration-rulings.md.
 */
import { OWNER_AD_UNITS, selectAdUnits, type AdUnitIds } from '../adUnits';

const TEST_IDS = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
};

const OWNER: AdUnitIds = {
  interstitial: 'ca-app-pub-9813131856455133/6706292920',
  rewardedHint: 'ca-app-pub-9813131856455133/7549521178',
  rewardedContinue: 'ca-app-pub-9813131856455133/3505414519',
  banner: 'ca-app-pub-9813131856455133/5508761320',
};

const TEST_UNITS: AdUnitIds = {
  interstitial: TEST_IDS.INTERSTITIAL,
  rewardedHint: TEST_IDS.REWARDED,
  rewardedContinue: TEST_IDS.REWARDED,
  banner: TEST_IDS.ADAPTIVE_BANNER,
};

describe('selectAdUnits (M1)', () => {
  test('a shipping build (not __DEV__, flag unset) requests the owner units', () => {
    expect(
      selectAdUnits({ isDev: false, testAdsFlag: undefined, ownerUnits: OWNER, testIds: TEST_IDS }),
    ).toEqual({ set: 'real', units: OWNER });
  });

  test('every __DEV__ build requests Google sample units, whatever the flag', () => {
    for (const testAdsFlag of [undefined, '', '0', '1']) {
      expect(
        selectAdUnits({ isDev: true, testAdsFlag, ownerUnits: OWNER, testIds: TEST_IDS }),
      ).toEqual({ set: 'test', units: TEST_UNITS });
    }
  });

  test('EXPO_PUBLIC_ADMOB_TEST_ADS=1 forces sample units in a release build', () => {
    expect(
      selectAdUnits({ isDev: false, testAdsFlag: '1', ownerUnits: OWNER, testIds: TEST_IDS }),
    ).toEqual({ set: 'test', units: TEST_UNITS });
  });

  test.each(['', '0', 'true', 'yes', ' 1'])(
    'only the exact string "1" is the test flag (%p ships real units)',
    (testAdsFlag) => {
      expect(
        selectAdUnits({ isDev: false, testAdsFlag, ownerUnits: OWNER, testIds: TEST_IDS }).set,
      ).toBe('real');
    },
  );

  test('fails safe to sample units when the owner table was compiled out', () => {
    expect(
      selectAdUnits({ isDev: false, testAdsFlag: undefined, ownerUnits: null, testIds: TEST_IDS }),
    ).toEqual({ set: 'test', units: TEST_UNITS });
  });

  test('hint and continue are two different owner units (M3)', () => {
    const { units } = selectAdUnits({
      isDev: false,
      testAdsFlag: undefined,
      ownerUnits: OWNER,
      testIds: TEST_IDS,
    });
    expect(units.rewardedHint).not.toBe(units.rewardedContinue);
  });
});

describe('ADMOB-C (M4): the menu banner unit, same selector and same rule', () => {
  test('a shipping build requests the owner banner unit', () => {
    const { units } = selectAdUnits({
      isDev: false,
      testAdsFlag: undefined,
      ownerUnits: OWNER,
      testIds: TEST_IDS,
    });
    expect(units.banner).toBe('ca-app-pub-9813131856455133/5508761320');
  });

  test('every test build (dev, flag "1", owner table compiled out) requests Google\'s adaptive banner sample unit', () => {
    const cases = [
      { isDev: true, testAdsFlag: undefined, ownerUnits: OWNER },
      { isDev: false, testAdsFlag: '1', ownerUnits: OWNER },
      { isDev: false, testAdsFlag: undefined, ownerUnits: null },
    ];
    for (const c of cases) {
      const selected = selectAdUnits({ ...c, testIds: TEST_IDS });
      expect(selected.set).toBe('test');
      expect(selected.units.banner).toBe('ca-app-pub-3940256099942544/9214589741');
    }
  });

  test('the banner is its own owner unit, not one of the full-screen units', () => {
    const { units } = selectAdUnits({
      isDev: false,
      testAdsFlag: undefined,
      ownerUnits: OWNER,
      testIds: TEST_IDS,
    });
    expect([units.interstitial, units.rewardedHint, units.rewardedContinue]).not.toContain(
      units.banner,
    );
  });
});

describe('OWNER_AD_UNITS (the compiled owner table)', () => {
  const original = process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
    else process.env.EXPO_PUBLIC_ADMOB_TEST_ADS = original;
  });

  function loadFresh(): typeof import('../adUnits') {
    let mod: typeof import('../adUnits') | null = null;
    jest.isolateModules(() => {
      mod = require('../adUnits') as typeof import('../adUnits');
    });
    return mod!;
  }

  test('holds exactly the owner-supplied Android units when the test flag is unset', () => {
    delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
    expect(loadFresh().OWNER_AD_UNITS).toEqual(OWNER);
    expect(OWNER_AD_UNITS === null || OWNER_AD_UNITS.interstitial === OWNER.interstitial).toBe(true);
  });

  test('is null when the build sets EXPO_PUBLIC_ADMOB_TEST_ADS=1 (no owner ID compiled in)', () => {
    process.env.EXPO_PUBLIC_ADMOB_TEST_ADS = '1';
    expect(loadFresh().OWNER_AD_UNITS).toBeNull();
  });
});

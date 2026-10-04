/**
 * PETAL-ADS-01 (owner, 2026-10-04): the petals rewarded placement has its own real AdMob unit,
 * "Arrows - Rewarded - Petals" (reward 3 Petals). Shipping builds request exactly it; every test build requests
 * Google's rewarded sample unit and does not compile the owner table in at all.
 */
import { selectAdUnits } from '../adUnits';

const PETALS_REAL = 'ca-app-pub-9813131856455133/5754923896';
const GOOGLE_REWARDED = 'ca-app-pub-3940256099942544/5224354917';
const TEST_IDS = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: GOOGLE_REWARDED,
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
};

function loadFresh(flag: string | undefined): typeof import('../adUnits') {
  const original = process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
  else process.env.EXPO_PUBLIC_ADMOB_TEST_ADS = flag;
  let mod: typeof import('../adUnits') | null = null;
  try {
    jest.isolateModules(() => { mod = require('../adUnits') as typeof import('../adUnits'); });
  } finally {
    if (original === undefined) delete process.env.EXPO_PUBLIC_ADMOB_TEST_ADS;
    else process.env.EXPO_PUBLIC_ADMOB_TEST_ADS = original;
  }
  return mod!;
}

test('the real petals unit is exactly the owner-supplied id', () => {
  const owner = loadFresh(undefined).OWNER_AD_UNITS!;
  expect(owner.rewardedPetals).toBe(PETALS_REAL);
  const { set, units } = selectAdUnits({ isDev: false, testAdsFlag: undefined, ownerUnits: owner, testIds: TEST_IDS });
  expect(set).toBe('real');
  expect(units.rewardedPetals).toBe(PETALS_REAL);
});

test('the petals unit is its own unit, not a reused hint/continue/interstitial/banner id', () => {
  const owner = loadFresh(undefined).OWNER_AD_UNITS!;
  expect([owner.rewardedHint, owner.rewardedContinue, owner.interstitial, owner.banner]).not.toContain(owner.rewardedPetals);
});

test('every test mode resolves the petals placement to Google\'s rewarded sample unit', () => {
  const owner = loadFresh(undefined).OWNER_AD_UNITS!;
  const cases = [
    { isDev: true, testAdsFlag: undefined, ownerUnits: owner },
    { isDev: false, testAdsFlag: '1', ownerUnits: owner },
    { isDev: false, testAdsFlag: undefined, ownerUnits: null },
  ];
  for (const c of cases) {
    const selected = selectAdUnits({ ...c, testIds: TEST_IDS });
    expect(selected.set).toBe('test');
    expect(selected.units.rewardedPetals).toBe(GOOGLE_REWARDED);
  }
});

test('a test-ads build compiles no owner table, so the real petals id is absent', () => {
  expect(loadFresh('1').OWNER_AD_UNITS).toBeNull();
});

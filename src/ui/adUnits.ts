/**
 * ADMOB-B, ruling M1: which AdMob ad units this build requests. Pure TS (no
 * react-native import), so the rule is unit-tested in node.
 *
 * - Every development build (`__DEV__`) requests Google's sample units.
 * - Any build made with `EXPO_PUBLIC_ADMOB_TEST_ADS=1` (all emulator and QA
 *   builds) requests Google's sample units.
 * - Only a shipping build (release, flag unset) requests the owner's units.
 *   Never load or tap a real unit on an emulator or a developer device: a
 *   publisher interacting with their own live ads is invalid traffic.
 *
 * The owner table is guarded by the build-time flag itself, not only by the
 * runtime choice: Expo inlines `process.env.EXPO_PUBLIC_ADMOB_TEST_ADS`, so in a
 * test-flag build the condition below is the constant `'1' === '1'` and the
 * minifier drops the object literal. A test build therefore does not even
 * contain the owner unit IDs (proved by a bundle grep in the ADMOB-B report).
 *
 * The banner unit (ruling M4) belongs to the next task and is not listed here.
 * Ad unit IDs ship in every binary and are not secrets.
 */

export interface AdUnitIds {
  interstitial: string;
  rewardedHint: string;
  rewardedContinue: string;
}

export type AdUnitSet = 'test' | 'real';

/** The slice of react-native-google-mobile-ads' `TestIds` this app uses. */
export interface GoogleTestIds {
  readonly INTERSTITIAL: string;
  readonly REWARDED: string;
}

/**
 * Owner-supplied Android units (.superpowers/sdd/TASKS/admob-migration-rulings.md).
 * `null` in a build made with EXPO_PUBLIC_ADMOB_TEST_ADS=1.
 */
export const OWNER_AD_UNITS: AdUnitIds | null =
  process.env.EXPO_PUBLIC_ADMOB_TEST_ADS === '1'
    ? null
    : {
        interstitial: 'ca-app-pub-9813131856455133/6706292920',
        rewardedHint: 'ca-app-pub-9813131856455133/7549521178',
        rewardedContinue: 'ca-app-pub-9813131856455133/3505414519',
      };

/**
 * Sample units unless this is a shipping build. Only the exact string `'1'`
 * turns the test flag on (the same convention as every EXPO_PUBLIC flag), and
 * a missing owner table fails safe to the sample units.
 */
export function selectAdUnits(input: {
  isDev: boolean;
  testAdsFlag: string | undefined;
  ownerUnits: AdUnitIds | null;
  testIds: GoogleTestIds;
}): { set: AdUnitSet; units: AdUnitIds } {
  const { isDev, testAdsFlag, ownerUnits, testIds } = input;
  if (isDev || testAdsFlag === '1' || ownerUnits === null) {
    return {
      set: 'test',
      units: {
        interstitial: testIds.INTERSTITIAL,
        // Google publishes one rewarded sample unit; both placements use it.
        rewardedHint: testIds.REWARDED,
        rewardedContinue: testIds.REWARDED,
      },
    };
  }
  return { set: 'real', units: { ...ownerUnits } };
}

import { SaveSystem } from '../core/saveSystem';

export type ConsentState = {
  resolved: boolean;
  gdprApplies: boolean;
  personalisedAds: boolean;
  ccpaOptOut: boolean;
};

const RESOLVED_BIT = 1;
const GDPR_APPLIES_BIT = 2;
const PERSONALISED_ADS_BIT = 4;
const CCPA_OPT_OUT_BIT = 8;

export function encodeConsent(state: ConsentState): number {
  return (
    (state.resolved ? RESOLVED_BIT : 0) |
    (state.gdprApplies ? GDPR_APPLIES_BIT : 0) |
    (state.personalisedAds ? PERSONALISED_ADS_BIT : 0) |
    (state.ccpaOptOut ? CCPA_OPT_OUT_BIT : 0)
  );
}

export function decodeConsent(bits: number): ConsentState {
  return {
    resolved: (bits & RESOLVED_BIT) !== 0,
    gdprApplies: (bits & GDPR_APPLIES_BIT) !== 0,
    personalisedAds: (bits & PERSONALISED_ADS_BIT) !== 0,
    ccpaOptOut: (bits & CCPA_OPT_OUT_BIT) !== 0,
  };
}

export function mayInitAds(state: ConsentState): boolean {
  if (!state.resolved) return false;
  return !state.gdprApplies || state.personalisedAds;
}

export type PrivacyCall = readonly [
  method: 'setCOPPA' | 'setCCPA' | 'setConsent',
  value: boolean,
];

export interface PrivacyApi {
  setCOPPA(value: boolean): Promise<void>;
  setCCPA(value: boolean): Promise<void>;
  setConsent(value: boolean): Promise<void>;
}

export function privacyCallsFor(state: ConsentState): readonly PrivacyCall[] {
  return [
    // 13+ posture: RELEASE.md:89-90; owner/legal confirmation is W7-07.
    ['setCOPPA', false],
    ['setCCPA', state.ccpaOptOut],
    ['setConsent', state.personalisedAds],
  ];
}

export async function applyPrivacy(state: ConsentState, api: PrivacyApi): Promise<void> {
  for (const [method, value] of privacyCallsFor(state)) {
    await api[method](value);
  }
}

/**
 * Any CMP-backed source must supply all four parts of the consent contract:
 * - GDPR applicability from the CMP's own geography check;
 * - the player's consent result;
 * - a re-prompt entry point for privacy choices; and
 * - the TCF storage that the ad SDK (AdMob) can read directly.
 */
export interface ConsentSource {
  gather(): Promise<ConsentState>;
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<ConsentState>;
}

export const lastKnownSource: ConsentSource = {
  gather: async () => decodeConsent(SaveSystem.consentBits),
  privacyOptionsRequired: () => false,
  showPrivacyOptions: async () => decodeConsent(SaveSystem.consentBits),
};

function fixedSource(state: ConsentState): ConsentSource {
  return {
    gather: async () => state,
    privacyOptionsRequired: () => false,
    showPrivacyOptions: async () => state,
  };
}

/** Verification-only source. Unset player builds fall through to persisted state. */
export const activeConsentSource: ConsentSource =
  process.env.EXPO_PUBLIC_CONSENT_FIXTURE === 'granted-eea'
    ? fixedSource({
        resolved: true,
        gdprApplies: true,
        personalisedAds: true,
        ccpaOptOut: false,
      })
    : process.env.EXPO_PUBLIC_CONSENT_FIXTURE === 'refused-eea'
      ? fixedSource({
          resolved: true,
          gdprApplies: true,
          personalisedAds: false,
          ccpaOptOut: false,
        })
      : process.env.EXPO_PUBLIC_CONSENT_FIXTURE === 'non-eea'
        ? fixedSource({
            resolved: true,
            gdprApplies: false,
            personalisedAds: true,
            ccpaOptOut: false,
          })
        : lastKnownSource;

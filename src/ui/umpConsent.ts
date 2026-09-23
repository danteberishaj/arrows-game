/**
 * ADMOB-C (ruling M5): Google's User Messaging Platform (UMP, shipped in
 * react-native-google-mobile-ads as `AdsConsent`, a Google-certified CMP) as the
 * W7-01 `ConsentSource`. Used only when `CONSENT_GATE` is on.
 *
 * Pure TS (no react-native import): the UMP calls are injected, so the mapping
 * and the flow are unit-tested in node. ads.tsx supplies the real `AdsConsent`,
 * required lazily inside `gather()`, so a remote-killed boot never loads it.
 *
 * Fail-closed, like W7-01:
 * - Anything short of an answered UMP flow (status OBTAINED / NOT_REQUIRED
 *   and `canRequestAds`) is UNRESOLVED, and `mayInitAds` refuses it.
 * - Where the TCF data UMP wrote says GDPR applies, "personalised" needs BOTH
 *   purpose 1 (store/access information on a device) and purpose 4 (select
 *   personalised ads). `mayInitAds` requires personalised consent under GDPR,
 *   so an EEA refusal means no ads at all, exactly as W7-01 behaves today.
 * - A UMP error (offline, or no GDPR message published in AdMob so no form can
 *   be built) makes `gather()` throw. The ad-init controller treats that as a
 *   failed attempt, never as consent. The one exception is Google's documented
 *   pattern: an answer UMP stored in an earlier session still stands when the
 *   info update fails, so the cached consent info is read before giving up.
 *
 * CCPA: UMP's US-states message writes IAB GPP, which the Google Mobile Ads SDK
 * reads natively, so `ccpaOptOut` stays false here (no JS-side `rdp` extra).
 */
import type { ConsentSource, ConsentState } from './consent';

/** `AdsConsentInfo`, with the package's string enums widened to string. */
export interface UmpConsentInfo {
  status: string;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: string;
  isConsentFormAvailable: boolean;
}

/** The subset of `AdsConsentInfoOptions` this app sends. */
export interface UmpRequestOptions {
  debugGeography?: number;
  testDeviceIdentifiers?: string[];
}

/** The slice of the package's `AdsConsent` used here. */
export interface UmpApi {
  requestInfoUpdate(options: UmpRequestOptions): Promise<UmpConsentInfo>;
  loadAndShowConsentFormIfRequired(): Promise<UmpConsentInfo>;
  getConsentInfo(): Promise<UmpConsentInfo>;
  showPrivacyOptionsForm(): Promise<UmpConsentInfo>;
  /** Reads `IABTCF_gdprApplies` (written by UMP's GDPR message). */
  getGdprApplies(): Promise<boolean>;
  /** Decodes `IABTCF_TCString`; an absent or invalid string decodes as "nothing granted". */
  getUserChoices(): Promise<{
    storeAndAccessInformationOnDevice: boolean;
    selectPersonalisedAds: boolean;
  }>;
  reset(): void;
}

export interface UmpSnapshot {
  status: string;
  canRequestAds: boolean;
  tcfGdprApplies: boolean;
  /** TCF purpose 1. */
  storeAndAccess: boolean;
  /** TCF purpose 4. */
  personalisedAdsPurpose: boolean;
}

const UNRESOLVED: ConsentState = Object.freeze({
  resolved: false,
  gdprApplies: false,
  personalisedAds: false,
  ccpaOptOut: false,
});

function answered(info: Pick<UmpConsentInfo, 'status' | 'canRequestAds'>): boolean {
  return info.canRequestAds && (info.status === 'OBTAINED' || info.status === 'NOT_REQUIRED');
}

/** UMP's state -> the W7-01 four-bit consent state (see the file comment). */
export function consentStateFromUmp(s: UmpSnapshot): ConsentState {
  if (!answered(s)) return { ...UNRESOLVED };
  if (s.tcfGdprApplies) {
    return {
      resolved: true,
      gdprApplies: true,
      personalisedAds: s.storeAndAccess && s.personalisedAdsPurpose,
      ccpaOptOut: false,
    };
  }
  return { resolved: true, gdprApplies: false, personalisedAds: true, ccpaOptOut: false };
}

/** `AdsConsentDebugGeography` values by name (NOT_EEA is deprecated upstream). */
const DEBUG_GEOGRAPHY: Readonly<Record<string, number>> = Object.freeze({
  EEA: 1,
  REGULATED_US_STATE: 3,
  OTHER: 4,
});

function isTestBuild(isDev: boolean, testAdsFlag: string | undefined): boolean {
  return isDev || testAdsFlag === '1';
}

/**
 * UMP debug settings, honoured only in a test build (`__DEV__` or
 * EXPO_PUBLIC_ADMOB_TEST_ADS=1), so a shipping build never fakes geography.
 * `debugGeography` is EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY (EEA | REGULATED_US_STATE
 * | OTHER); `testDeviceIds` is EXPO_PUBLIC_UMP_TEST_DEVICE_IDS (comma
 * separated hashed ids, needed on a physical device; emulators are test devices).
 */
export function umpRequestOptions(input: {
  isDev: boolean;
  testAdsFlag: string | undefined;
  debugGeography: string | undefined;
  testDeviceIds: string | undefined;
}): UmpRequestOptions {
  if (!isTestBuild(input.isDev, input.testAdsFlag)) return {};
  const options: UmpRequestOptions = {};
  const geography =
    input.debugGeography !== undefined &&
    Object.prototype.hasOwnProperty.call(DEBUG_GEOGRAPHY, input.debugGeography)
      ? DEBUG_GEOGRAPHY[input.debugGeography]
      : undefined;
  if (geography !== undefined) options.debugGeography = geography;
  const ids = (input.testDeviceIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length > 0) options.testDeviceIdentifiers = ids;
  return options;
}

/**
 * EXPO_PUBLIC_UMP_DEBUG_RESET=1 in a test build: forget UMP's stored answer at
 * the first gather of each process, so every cold start shows the form again.
 */
export function umpDebugResetEnabled(input: {
  isDev: boolean;
  testAdsFlag: string | undefined;
  resetFlag: string | undefined;
}): boolean {
  return isTestBuild(input.isDev, input.testAdsFlag) && input.resetFlag === '1';
}

export function createUmpSource(deps: {
  /** The native `AdsConsent`, or null where the module is missing. */
  api: () => UmpApi | null;
  requestOptions: UmpRequestOptions;
  resetFirst?: boolean;
  log?: (line: string) => void;
}): ConsentSource {
  let privacyOptionsStatus = 'UNKNOWN';
  let resetDone = false;

  const requireApi = (): UmpApi => {
    const api = deps.api();
    if (!api) throw new Error('UMP (AdsConsent) module missing');
    return api;
  };

  const finish = async (api: UmpApi, info: UmpConsentInfo, step: string): Promise<ConsentState> => {
    privacyOptionsStatus = info.privacyOptionsRequirementStatus;
    const tcfGdprApplies = await api.getGdprApplies();
    const choices = tcfGdprApplies
      ? await api.getUserChoices()
      : { storeAndAccessInformationOnDevice: false, selectPersonalisedAds: false };
    const state = consentStateFromUmp({
      status: info.status,
      canRequestAds: info.canRequestAds,
      tcfGdprApplies,
      storeAndAccess: choices.storeAndAccessInformationOnDevice,
      personalisedAdsPurpose: choices.selectPersonalisedAds,
    });
    const bit = (v: boolean) => (v ? 1 : 0);
    deps.log?.(
      `[consent] UMP ${step}: status=${info.status} canRequestAds=${info.canRequestAds} ` +
        `tcfGdprApplies=${tcfGdprApplies} privacyOptions=${info.privacyOptionsRequirementStatus} ` +
        `-> resolved=${bit(state.resolved)} gdpr=${bit(state.gdprApplies)} ` +
        `personalised=${bit(state.personalisedAds)}`,
    );
    return state;
  };

  return {
    async gather() {
      const api = requireApi();
      if (deps.resetFirst && !resetDone) {
        resetDone = true;
        api.reset();
      }
      let info: UmpConsentInfo;
      try {
        await api.requestInfoUpdate(deps.requestOptions);
        info = await api.loadAndShowConsentFormIfRequired();
      } catch (error) {
        const cached = await api.getConsentInfo().catch(() => null);
        if (!cached || !answered(cached)) {
          deps.log?.(`[consent] UMP gather failed: ${String((error as Error)?.message ?? error)}`);
          throw error;
        }
        info = cached;
      }
      return finish(api, info, 'gather');
    },

    privacyOptionsRequired() {
      return privacyOptionsStatus === 'REQUIRED';
    },

    async showPrivacyOptions() {
      const api = requireApi();
      const info = await api.showPrivacyOptionsForm();
      return finish(api, info, 'privacy options');
    },
  };
}

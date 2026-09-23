/**
 * ADMOB-C (ruling M5): Google UMP (react-native-google-mobile-ads `AdsConsent`)
 * as the W7-01 ConsentSource. The mapping keeps W7-01's fail-closed bits:
 * anything short of an answered UMP flow is unresolved, and an EEA answer
 * without both TCF purpose 1 (store/access) and purpose 4 (personalised ads)
 * is "no personalised ads", which `mayInitAds` turns into no ads at all.
 */
import { mayInitAds, type ConsentState } from '../consent';
import {
  consentStateFromUmp,
  createUmpSource,
  umpDebugResetEnabled,
  umpRequestOptions,
  type UmpApi,
  type UmpConsentInfo,
  type UmpSnapshot,
} from '../umpConsent';

const UNRESOLVED: ConsentState = {
  resolved: false,
  gdprApplies: false,
  personalisedAds: false,
  ccpaOptOut: false,
};

function snap(over: Partial<UmpSnapshot>): UmpSnapshot {
  return {
    status: 'OBTAINED',
    canRequestAds: true,
    tcfGdprApplies: true,
    storeAndAccess: true,
    personalisedAdsPurpose: true,
    ...over,
  };
}

describe('consentStateFromUmp (fail-closed mapping)', () => {
  test('EEA, both purposes granted: resolved, GDPR, personalised', () => {
    expect(consentStateFromUmp(snap({}))).toEqual({
      resolved: true,
      gdprApplies: true,
      personalisedAds: true,
      ccpaOptOut: false,
    });
  });

  test.each([
    ['refused everything', { storeAndAccess: false, personalisedAdsPurpose: false }],
    ['store/access only', { personalisedAdsPurpose: false }],
    ['personalised ads only', { storeAndAccess: false }],
  ])('EEA, %s: not personalised, so mayInitAds is false', (_label, over) => {
    const state = consentStateFromUmp(snap(over));
    expect(state).toEqual({
      resolved: true,
      gdprApplies: true,
      personalisedAds: false,
      ccpaOptOut: false,
    });
    expect(mayInitAds(state)).toBe(false);
  });

  test('not in a regulated region (NOT_REQUIRED, no TCF): resolved, not GDPR, personalised', () => {
    const state = consentStateFromUmp(
      snap({
        status: 'NOT_REQUIRED',
        tcfGdprApplies: false,
        storeAndAccess: false,
        personalisedAdsPurpose: false,
      }),
    );
    expect(state).toEqual({
      resolved: true,
      gdprApplies: false,
      personalisedAds: true,
      ccpaOptOut: false,
    });
    expect(mayInitAds(state)).toBe(true);
  });

  test('TCF says GDPR applies even when UMP reports NOT_REQUIRED: the TCF purposes decide', () => {
    expect(
      consentStateFromUmp(
        snap({ status: 'NOT_REQUIRED', storeAndAccess: false, personalisedAdsPurpose: false }),
      ).personalisedAds,
    ).toBe(false);
  });

  test.each([
    ['UNKNOWN', true],
    ['REQUIRED', true],
    ['REQUIRED', false],
    ['OBTAINED', false],
    ['NOT_REQUIRED', false],
    ['SOMETHING_NEW', true],
  ])('status %s with canRequestAds=%s is unresolved (no ads)', (status, canRequestAds) => {
    const state = consentStateFromUmp(snap({ status, canRequestAds }));
    expect(state).toEqual(UNRESOLVED);
    expect(mayInitAds(state)).toBe(false);
  });
});

describe('umpRequestOptions / umpDebugResetEnabled (debug settings only in test builds)', () => {
  test('a shipping build sends no debug settings, even when the env values are set', () => {
    expect(
      umpRequestOptions({
        isDev: false,
        testAdsFlag: undefined,
        debugGeography: 'EEA',
        testDeviceIds: 'ABC',
      }),
    ).toEqual({});
    expect(umpDebugResetEnabled({ isDev: false, testAdsFlag: undefined, resetFlag: '1' })).toBe(
      false,
    );
  });

  test('a test-ads build maps the geography name to the UMP value', () => {
    const base = { isDev: false, testAdsFlag: '1', testDeviceIds: undefined };
    expect(umpRequestOptions({ ...base, debugGeography: 'EEA' })).toEqual({ debugGeography: 1 });
    expect(umpRequestOptions({ ...base, debugGeography: 'REGULATED_US_STATE' })).toEqual({
      debugGeography: 3,
    });
    expect(umpRequestOptions({ ...base, debugGeography: 'OTHER' })).toEqual({ debugGeography: 4 });
    expect(umpRequestOptions({ ...base, debugGeography: 'eea' })).toEqual({});
    expect(umpRequestOptions({ ...base, debugGeography: undefined })).toEqual({});
  });

  test('a dev build passes hashed test device ids (comma separated, trimmed)', () => {
    expect(
      umpRequestOptions({
        isDev: true,
        testAdsFlag: undefined,
        debugGeography: undefined,
        testDeviceIds: ' A1 ,B2,, ',
      }),
    ).toEqual({ testDeviceIdentifiers: ['A1', 'B2'] });
  });

  test('the debug reset needs a test build and the exact string "1"', () => {
    expect(umpDebugResetEnabled({ isDev: false, testAdsFlag: '1', resetFlag: '1' })).toBe(true);
    expect(umpDebugResetEnabled({ isDev: true, testAdsFlag: undefined, resetFlag: '1' })).toBe(true);
    expect(umpDebugResetEnabled({ isDev: true, testAdsFlag: undefined, resetFlag: 'true' })).toBe(
      false,
    );
  });
});

const OBTAINED_INFO: UmpConsentInfo = {
  status: 'OBTAINED',
  canRequestAds: true,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};

function fakeUmp(over: Partial<Record<keyof UmpApi, unknown>> = {}) {
  const calls: string[] = [];
  const tcf = { gdprApplies: true, storeAndAccess: true, personalised: true };
  const api: UmpApi = {
    requestInfoUpdate: async (options) => {
      calls.push(`requestInfoUpdate:${JSON.stringify(options)}`);
      return { ...OBTAINED_INFO, status: 'REQUIRED', canRequestAds: false };
    },
    loadAndShowConsentFormIfRequired: async () => {
      calls.push('loadAndShowConsentFormIfRequired');
      return OBTAINED_INFO;
    },
    getConsentInfo: async () => {
      calls.push('getConsentInfo');
      return OBTAINED_INFO;
    },
    showPrivacyOptionsForm: async () => {
      calls.push('showPrivacyOptionsForm');
      return OBTAINED_INFO;
    },
    getGdprApplies: async () => {
      calls.push('getGdprApplies');
      return tcf.gdprApplies;
    },
    getUserChoices: async () => {
      calls.push('getUserChoices');
      return {
        storeAndAccessInformationOnDevice: tcf.storeAndAccess,
        selectPersonalisedAds: tcf.personalised,
      };
    },
    reset: () => {
      calls.push('reset');
    },
    ...(over as Partial<UmpApi>),
  };
  return { api, calls, tcf };
}

describe('createUmpSource', () => {
  test('gather: info update with the debug options, then the form if required, then the TCF read', async () => {
    const { api, calls } = fakeUmp();
    const source = createUmpSource({ api: () => api, requestOptions: { debugGeography: 1 } });
    await expect(source.gather()).resolves.toEqual({
      resolved: true,
      gdprApplies: true,
      personalisedAds: true,
      ccpaOptOut: false,
    });
    expect(calls).toEqual([
      'requestInfoUpdate:{"debugGeography":1}',
      'loadAndShowConsentFormIfRequired',
      'getGdprApplies',
      'getUserChoices',
    ]);
    expect(source.privacyOptionsRequired()).toBe(true);
  });

  test('an EEA refusal gathers a resolved, non-personalised state (no ads)', async () => {
    const { api, tcf } = fakeUmp();
    tcf.storeAndAccess = false;
    tcf.personalised = false;
    const state = await createUmpSource({ api: () => api, requestOptions: {} }).gather();
    expect(state).toEqual({
      resolved: true,
      gdprApplies: true,
      personalisedAds: false,
      ccpaOptOut: false,
    });
    expect(mayInitAds(state)).toBe(false);
  });

  test('no TCF decode outside GDPR; privacy options not required', async () => {
    const { api, calls, tcf } = fakeUmp({
      loadAndShowConsentFormIfRequired: async () => ({
        ...OBTAINED_INFO,
        status: 'NOT_REQUIRED',
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      }),
    });
    tcf.gdprApplies = false;
    const source = createUmpSource({ api: () => api, requestOptions: {} });
    expect((await source.gather()).gdprApplies).toBe(false);
    expect(calls).not.toContain('getUserChoices');
    expect(source.privacyOptionsRequired()).toBe(false);
  });

  test('privacyOptionsRequired is false before any gather', () => {
    const { api } = fakeUmp();
    expect(createUmpSource({ api: () => api, requestOptions: {} }).privacyOptionsRequired()).toBe(
      false,
    );
  });

  test('a failed form (e.g. no published GDPR message) with no earlier answer throws: a failed attempt, never consent', async () => {
    const formError = new Error('[googleMobileAds/consent-form-error] No available form');
    const { api } = fakeUmp({
      loadAndShowConsentFormIfRequired: async () => {
        throw formError;
      },
      getConsentInfo: async () => ({ ...OBTAINED_INFO, status: 'REQUIRED', canRequestAds: false }),
    });
    await expect(createUmpSource({ api: () => api, requestOptions: {} }).gather()).rejects.toBe(
      formError,
    );
  });

  test('a failed info update (offline) falls back to consent UMP stored in an earlier session', async () => {
    const { api, calls } = fakeUmp({
      requestInfoUpdate: async () => {
        throw new Error('[googleMobileAds/consent-update-failed] offline');
      },
    });
    const state = await createUmpSource({ api: () => api, requestOptions: {} }).gather();
    expect(state.resolved).toBe(true);
    expect(state.personalisedAds).toBe(true);
    expect(calls).toContain('getConsentInfo');
  });

  test('a failed info update with an unreadable cache rethrows the update error', async () => {
    const updateError = new Error('offline');
    const { api } = fakeUmp({
      requestInfoUpdate: async () => {
        throw updateError;
      },
      getConsentInfo: async () => {
        throw new Error('no cache');
      },
    });
    await expect(createUmpSource({ api: () => api, requestOptions: {} }).gather()).rejects.toBe(
      updateError,
    );
  });

  test('a missing native module throws (failed attempt)', async () => {
    await expect(createUmpSource({ api: () => null, requestOptions: {} }).gather()).rejects.toThrow(
      /UMP/,
    );
  });

  test('showPrivacyOptions: shows the UMP privacy options form and maps a withdrawal', async () => {
    const { api, calls, tcf } = fakeUmp();
    const source = createUmpSource({ api: () => api, requestOptions: {} });
    await source.gather();
    tcf.storeAndAccess = false;
    tcf.personalised = false;
    calls.length = 0;
    const state = await source.showPrivacyOptions();
    expect(calls[0]).toBe('showPrivacyOptionsForm');
    expect(mayInitAds(state)).toBe(false);
    expect(state.resolved).toBe(true);
  });

  test('showPrivacyOptions propagates a form error (nothing changes)', async () => {
    const err = new Error('privacy-options-form-error');
    const { api } = fakeUmp({
      showPrivacyOptionsForm: async () => {
        throw err;
      },
    });
    await expect(createUmpSource({ api: () => api, requestOptions: {} }).showPrivacyOptions()).rejects.toBe(err);
  });

  test('the debug reset runs once per process, before the first info update, only when enabled', async () => {
    const on = fakeUmp();
    const source = createUmpSource({ api: () => on.api, requestOptions: {}, resetFirst: true });
    await source.gather();
    await source.gather();
    expect(on.calls.filter((c) => c === 'reset')).toHaveLength(1);
    expect(on.calls[0]).toBe('reset');

    const off = fakeUmp();
    await createUmpSource({ api: () => off.api, requestOptions: {} }).gather();
    expect(off.calls).not.toContain('reset');
  });

  test('one log line per answered flow names the status and the derived bits', async () => {
    const { api } = fakeUmp();
    const lines: string[] = [];
    await createUmpSource({ api: () => api, requestOptions: {}, log: (l) => lines.push(l) }).gather();
    expect(lines).toEqual([
      '[consent] UMP gather: status=OBTAINED canRequestAds=true tcfGdprApplies=true privacyOptions=REQUIRED -> resolved=1 gdpr=1 personalised=1',
    ]);
  });
});

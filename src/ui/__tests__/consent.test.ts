import { SaveSystem, type IntStore } from '../../core/saveSystem';
import {
  applyPrivacy,
  decodeConsent,
  encodeConsent,
  lastKnownSource,
  mayInitAds,
  type ConsentState,
} from '../consent';

class MemoryStore implements IntStore {
  private readonly values = new Map<string, number>();

  getInt(key: string, defaultValue: number): number {
    return this.values.get(key) ?? defaultValue;
  }

  setInt(key: string, value: number): void {
    this.values.set(key, value);
  }

  deleteKey(key: string): void {
    this.values.delete(key);
  }
}

let previousStore: IntStore | undefined;

afterEach(() => {
  if (previousStore) SaveSystem.useStore(previousStore);
  previousStore = undefined;
});

describe('consent state', () => {
  test('applyPrivacy calls setCOPPA, setCCPA, setConsent in that order', async () => {
    const calls: [string, boolean][] = [];
    const state: ConsentState = {
      resolved: true,
      gdprApplies: false,
      personalisedAds: true,
      ccpaOptOut: true,
    };

    await applyPrivacy(state, {
      setCOPPA: async (value) => {
        calls.push(['setCOPPA', value]);
      },
      setCCPA: async (value) => {
        calls.push(['setCCPA', value]);
      },
      setConsent: async (value) => {
        calls.push(['setConsent', value]);
      },
    });

    expect(calls).toEqual([
      ['setCOPPA', false],
      ['setCCPA', true],
      ['setConsent', true],
    ]);
  });

  test('mayInitAds is false for an EEA refusal', () => {
    expect(
      mayInitAds({
        resolved: true,
        gdprApplies: true,
        personalisedAds: false,
        ccpaOptOut: false,
      }),
    ).toBe(false);
  });

  test('encode/decode round-trips all 16 boolean combinations', () => {
    for (let bits = 0; bits < 16; bits += 1) {
      const state: ConsentState = {
        resolved: (bits & 1) !== 0,
        gdprApplies: (bits & 2) !== 0,
        personalisedAds: (bits & 4) !== 0,
        ccpaOptOut: (bits & 8) !== 0,
      };
      expect(decodeConsent(encodeConsent(state))).toEqual(state);
    }
    expect(decodeConsent(0).resolved).toBe(false);
  });

  test.each([
    ['negative', -1],
    ['out-of-range positive', 23],
  ])('a %s stored value is unresolved and cannot initialise ads', async (_label, stored) => {
    const consentStore = new MemoryStore();
    consentStore.setInt('arrows_consent', stored);
    previousStore = SaveSystem.useStore(consentStore);

    const state = await lastKnownSource.gather();

    expect(state.resolved).toBe(false);
    expect(mayInitAds(state)).toBe(false);
  });

  test.each([
    ['unresolved', false, { resolved: false, gdprApplies: false, personalisedAds: false, ccpaOptOut: false }],
    ['EEA refused', false, { resolved: true, gdprApplies: true, personalisedAds: false, ccpaOptOut: false }],
    ['EEA granted', true, { resolved: true, gdprApplies: true, personalisedAds: true, ccpaOptOut: false }],
    ['non-EEA', true, { resolved: true, gdprApplies: false, personalisedAds: false, ccpaOptOut: false }],
  ] as const)('mayInitAds: %s -> %s', (_label, expected, state) => {
    expect(mayInitAds(state)).toBe(expected);
  });

  test('lastKnownSource returns the persisted state and never requires or shows UI', async () => {
    previousStore = SaveSystem.useStore(new MemoryStore());
    SaveSystem.setConsentBits(15);

    const expected = decodeConsent(15);
    expect(lastKnownSource.privacyOptionsRequired()).toBe(false);
    await expect(lastKnownSource.gather()).resolves.toEqual(expected);
    await expect(lastKnownSource.showPrivacyOptions()).resolves.toEqual(expected);
  });
});

/**
 * W6-02: the pure ad gate. All four kill bits against both ad formats, and the
 * remote-config getters agree with the gate for every bit combination.
 */
import { KillBit, createRemoteConfig } from '../../config/remoteConfig';
import { SaveSystem, type IntStore } from '../../core/saveSystem';
import { adDecision, type AdFormat } from '../adGate';

const FORMATS: AdFormat[] = ['interstitial', 'rewarded'];

describe('adDecision: each bit alone against both formats', () => {
  const table: [string, number, Record<AdFormat, 'allowed' | 'killed'>][] = [
    ['no bits', 0, { interstitial: 'allowed', rewarded: 'allowed' }],
    ['bit 0 (all ads)', KillBit.ads, { interstitial: 'killed', rewarded: 'killed' }],
    ['bit 1 (interstitials)', KillBit.interstitials, { interstitial: 'killed', rewarded: 'allowed' }],
    ['bit 2 (rewarded)', KillBit.rewarded, { interstitial: 'allowed', rewarded: 'killed' }],
    ['bit 3 (telemetry transport)', KillBit.telemetry, { interstitial: 'allowed', rewarded: 'allowed' }],
  ];

  for (const [label, bits, expected] of table) {
    for (const format of FORMATS) {
      test(`${label} -> ${format} ${expected[format]}`, () => {
        expect(adDecision(format, bits)).toBe(expected[format]);
      });
    }
  }

  test('killing interstitials does not kill rewarded', () => {
    expect(adDecision('rewarded', KillBit.interstitials)).toBe('allowed');
  });

  test('killing ads kills both formats', () => {
    expect(adDecision('interstitial', KillBit.ads)).toBe('killed');
    expect(adDecision('rewarded', KillBit.ads)).toBe('killed');
  });
});

describe('adDecision: every combination of the four bits', () => {
  for (let bits = 0; bits < 16; bits++) {
    test(`bits 0b${bits.toString(2).padStart(4, '0')}`, () => {
      const ads = (bits & KillBit.ads) !== 0;
      expect(adDecision('interstitial', bits)).toBe(ads || (bits & KillBit.interstitials) !== 0 ? 'killed' : 'allowed');
      expect(adDecision('rewarded', bits)).toBe(ads || (bits & KillBit.rewarded) !== 0 ? 'killed' : 'allowed');
    });
  }

  test.each([NaN, -1, 1.5, Infinity])('malformed bits %p never throw and read as allowed', (bits) => {
    for (const format of FORMATS) expect(adDecision(format, bits)).toBe('allowed');
  });
});

describe('remote-config getters agree with the gate', () => {
  // The never-settling fetch leaves the abort timer pending: keep it fake.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  class MapStore implements IntStore {
    readonly map = new Map<string, number>();
    getInt(k: string, d: number) {
      return this.map.has(k) ? this.map.get(k)! : d;
    }
    setInt(k: string, v: number) {
      this.map.set(k, v);
    }
    deleteKey(k: string) {
      this.map.delete(k);
    }
  }

  for (let bits = 0; bits < 16; bits++) {
    test(`bits ${bits}`, () => {
      const store = new MapStore();
      store.setInt('arrows_rc_kill_bits', bits);
      store.setInt('arrows_rc_version', 1);
      SaveSystem.useStore(store);
      const rc = createRemoteConfig({ enabled: true, url: 'https://example.test/c.json', perfMode: false });
      void rc.init({ fetchImpl: () => new Promise(() => {}) });
      expect(rc.interstitialsKilled()).toBe(adDecision('interstitial', rc.killBits()) === 'killed');
      expect(rc.rewardedKilled()).toBe(adDecision('rewarded', rc.killBits()) === 'killed');
      expect(rc.adsKilled()).toBe((bits & KillBit.ads) !== 0);
      expect(rc.telemetryKilled()).toBe((bits & KillBit.telemetry) !== 0);
    });
  }
});

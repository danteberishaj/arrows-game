/**
 * W7-04: which rows the Settings sheet shows, and in what order (src/ui/settingsRows.ts, pure). The sheet itself
 * (SettingsSheet.tsx) renders these rows; its wiring is SettingsSheet.test.tsx's, its look closes only on the
 * emulator captures in artifacts/W7-04/.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PRIVACY_POLICY_URL,
  SETTINGS_TITLE,
  SUPPORT_EMAIL,
  playStoreUrls,
  settingsRows,
  supportMailto,
  type SettingsRowsInput,
} from '../settingsRows';

const ALL: SettingsRowsInput = {
  consentGate: true,
  privacyOptionsRequired: true,
  policyUrl: 'https://example.org/privacy',
  supportEmail: 'help@example.org',
  version: '1.0.0',
};
const ids = (input: Partial<SettingsRowsInput>) => settingsRows({ ...ALL, ...input }).map((r) => r.id);

describe('settingsRows', () => {
  it('ad-privacy row hidden when consentGate is false', () => {
    expect(ids({ consentGate: false, privacyOptionsRequired: true })).not.toContain('adPrivacy');
    expect(ids({ consentGate: false, privacyOptionsRequired: false })).not.toContain('adPrivacy');
  });

  it('gate ON with privacyOptionsRequired false hides the ad-privacy row', () => {
    expect(ids({ consentGate: true, privacyOptionsRequired: false })).not.toContain('adPrivacy');
  });

  it('gate ON with privacyOptionsRequired true shows the ad-privacy row', () => {
    expect(ids({ consentGate: true, privacyOptionsRequired: true })).toContain('adPrivacy');
  });

  it('an empty (or blank) policyUrl hides the policy row', () => {
    expect(ids({ policyUrl: '' })).not.toContain('privacyPolicy');
    expect(ids({ policyUrl: '   ' })).not.toContain('privacyPolicy');
    expect(ids({ policyUrl: 'https://example.org/privacy' })).toContain('privacyPolicy');
  });

  it('an empty (or blank) supportEmail hides the support row', () => {
    expect(ids({ supportEmail: '' })).not.toContain('support');
    expect(ids({ supportEmail: ' ' })).not.toContain('support');
  });

  it('every row, in order, with its label', () => {
    expect(settingsRows(ALL).map((r) => [r.id, r.label])).toEqual([
      ['privacyPolicy', 'Privacy policy'],
      ['adPrivacy', 'Ad privacy choices'],
      ['support', 'Support'],
      ['version', 'Version 1.0.0'],
    ]);
  });

  it('the support row shows its address as the detail line; no other row has one', () => {
    const rows = settingsRows(ALL);
    expect(rows.find((r) => r.id === 'support')?.detail).toBe('help@example.org');
    expect(rows.filter((r) => r.id !== 'support').every((r) => r.detail === undefined)).toBe(true);
  });

  it('the version row always shows, always last, in all 32 combinations of the other inputs', () => {
    for (let bits = 0; bits < 32; bits += 1) {
      const rows = settingsRows({
        consentGate: (bits & 1) !== 0,
        privacyOptionsRequired: (bits & 2) !== 0,
        policyUrl: (bits & 4) !== 0 ? 'https://example.org/p' : '',
        supportEmail: (bits & 8) !== 0 ? 'a@example.org' : '',
        version: (bits & 16) !== 0 ? '2.3.4' : '',
      });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[rows.length - 1].id).toBe('version');
      expect(rows.filter((r) => r.id === 'version')).toHaveLength(1);
    }
  });

  it('a missing version still shows the row, honestly', () => {
    expect(settingsRows({ ...ALL, version: '' }).at(-1)?.label).toBe('Version unknown');
    expect(settingsRows({ ...ALL, version: undefined }).at(-1)?.label).toBe('Version unknown');
  });

  it('the build number (Android versionCode) follows the version name in brackets', () => {
    expect(settingsRows({ ...ALL, version: '1.0.0', build: '9' }).at(-1)?.label).toBe('Version 1.0.0 (9)');
    expect(settingsRows({ ...ALL, version: '1.0.0', build: ' 12 ' }).at(-1)?.label).toBe('Version 1.0.0 (12)');
    expect(settingsRows({ ...ALL, version: '1.0.0', build: '' }).at(-1)?.label).toBe('Version 1.0.0');
    expect(settingsRows({ ...ALL, version: '1.0.0', build: undefined }).at(-1)?.label).toBe('Version 1.0.0');
    expect(settingsRows({ ...ALL, version: undefined, build: '9' }).at(-1)?.label).toBe('Version unknown (9)');
  });

  it('only the three action rows are actions; the version row is information', () => {
    const rows = settingsRows(ALL);
    expect(rows.map((r) => r.pressable)).toEqual([true, true, true, false]);
  });
});

describe('constants', () => {
  it('PRIVACY_POLICY_URL is empty until W7-07 confirms a live URL (so the policy row is hidden)', () => {
    expect(PRIVACY_POLICY_URL).toBe('');
    expect(ids({ policyUrl: PRIVACY_POLICY_URL })).not.toContain('privacyPolicy');
  });

  it('SUPPORT_EMAIL is the contact address in store/privacy-policy.md', () => {
    const md = readFileSync(join(__dirname, '..', '..', '..', 'store', 'privacy-policy.md'), 'utf8');
    const contact = md.slice(md.indexOf('## Contact'));
    const m = /mailto:([^)\s]+)\)/.exec(contact);
    expect(m).not.toBeNull();
    expect(SUPPORT_EMAIL).toBe(m![1]);
  });

  it('supportMailto builds a bare mailto: URL', () => {
    expect(supportMailto('help@example.org')).toBe('mailto:help@example.org');
    expect(supportMailto(SUPPORT_EMAIL)).toBe(`mailto:${SUPPORT_EMAIL}`);
  });

  it('the sheet title', () => {
    expect(SETTINGS_TITLE).toBe('Settings');
  });
});

/**
 * TF-01 B / C / A: three rows, each behind its own default-OFF flag. The builder takes the flags and the platform as
 * inputs so it stays pure; SettingsSheet.tsx passes META_SETTINGS_HOW_TO_PLAY, META_THEME_SYSTEM,
 * META_SETTINGS_RATE and Platform.OS.
 */
describe('TF-01 rows', () => {
  /** The exact rows a W7-04 sheet built before TF-01 returned for ALL (the flags-default build must equal it). */
  const TODAY = [
    { id: 'privacyPolicy', label: 'Privacy policy', pressable: true },
    { id: 'adPrivacy', label: 'Ad privacy choices', pressable: true },
    { id: 'support', label: 'Support', detail: 'help@example.org', pressable: true },
    { id: 'version', label: 'Version 1.0.0', pressable: false },
  ];
  const ON = { howToPlay: true, themeSystem: true, rate: true, platform: 'android' } as const;

  it('all three flags OFF (explicitly or omitted): output identical to today, on every platform', () => {
    expect(settingsRows(ALL)).toStrictEqual(TODAY);
    for (const platform of ['android', 'ios', 'web']) {
      expect(settingsRows({ ...ALL, howToPlay: false, themeSystem: false, rate: false, platform }))
        .toStrictEqual(TODAY);
    }
  });

  it('the flags default to OFF in a build with no EXPO_PUBLIC_* set', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const flags = require('../../featureFlags') as typeof import('../../featureFlags');
    expect(flags.META_THEME_SYSTEM).toBe(false);
    expect(flags.META_SETTINGS_RATE).toBe(false);
    expect(flags.META_SETTINGS_HOW_TO_PLAY).toBe(false);
  });

  it('every row, in order, with all three flags ON (Android)', () => {
    expect(settingsRows({ ...ALL, ...ON }).map((r) => [r.id, r.label])).toEqual([
      ['howToPlay', 'How to play'],
      ['matchPhoneTheme', 'Match phone theme'],
      ['privacyPolicy', 'Privacy policy'],
      ['adPrivacy', 'Ad privacy choices'],
      ['rateArrows', 'Rate Arrows'],
      ['support', 'Support'],
      ['version', 'Version 1.0.0'],
    ]);
  });

  it('How to play is the FIRST row whenever its flag is on, whatever else shows', () => {
    for (let bits = 0; bits < 16; bits += 1) {
      const rows = settingsRows({
        ...ALL,
        howToPlay: true,
        themeSystem: (bits & 1) !== 0,
        rate: (bits & 2) !== 0,
        policyUrl: (bits & 4) !== 0 ? 'https://example.org/p' : '',
        supportEmail: (bits & 8) !== 0 ? 'a@example.org' : '',
        platform: 'android',
      });
      expect(rows[0]).toEqual({ id: 'howToPlay', label: 'How to play', pressable: true });
      expect(rows.at(-1)?.id).toBe('version');
    }
  });

  it('Rate Arrows sits directly above Support; Android only', () => {
    const android = ids({ ...ON });
    expect(android.indexOf('rateArrows')).toBe(android.indexOf('support') - 1);
    expect(ids({ ...ON, platform: 'ios' })).not.toContain('rateArrows');
    expect(ids({ ...ON, platform: 'web' })).not.toContain('rateArrows');
    expect(ids({ ...ON, platform: undefined })).not.toContain('rateArrows');
    expect(ids({ ...ON, rate: false })).not.toContain('rateArrows');
  });

  it('Rate Arrows still shows (above the version row) when no support address is set', () => {
    expect(ids({ ...ON, supportEmail: '' }).slice(-2)).toEqual(['rateArrows', 'version']);
  });

  it('Match phone theme is a switch row; it shows only with its flag', () => {
    const row = settingsRows({ ...ALL, ...ON }).find((r) => r.id === 'matchPhoneTheme');
    expect(row).toEqual({ id: 'matchPhoneTheme', label: 'Match phone theme', pressable: true, kind: 'switch' });
    expect(ids({ ...ON, themeSystem: false })).not.toContain('matchPhoneTheme');
    expect(ids({ ...ON, platform: 'ios' })).toContain('matchPhoneTheme');
  });

  it('How to play shows only with its flag, on every platform', () => {
    expect(ids({ ...ON, howToPlay: false })).not.toContain('howToPlay');
    expect(ids({ ...ON, platform: 'ios' })[0]).toBe('howToPlay');
  });
});

describe('playStoreUrls', () => {
  it('builds the market: URL first and the https fallback for the installed package', () => {
    expect(playStoreUrls('com.danteb.arrows')).toEqual([
      'market://details?id=com.danteb.arrows',
      'https://play.google.com/store/apps/details?id=com.danteb.arrows',
    ]);
  });

  it('trims the id and encodes it', () => {
    expect(playStoreUrls(' com.danteb.arrows ')[0]).toBe('market://details?id=com.danteb.arrows');
    expect(playStoreUrls('a b&c')[1]).toBe('https://play.google.com/store/apps/details?id=a%20b%26c');
  });

  it('no id (null, empty): no URL, so the row does nothing rather than open a wrong listing', () => {
    expect(playStoreUrls(null)).toEqual([]);
    expect(playStoreUrls(undefined)).toEqual([]);
    expect(playStoreUrls('  ')).toEqual([]);
  });

  it("app.json's Android package is com.danteb.arrows (the id the installed app reports)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require('../../../app.json') as { expo: { android: { package: string } } };
    expect(app.expo.android.package).toBe('com.danteb.arrows');
  });
});

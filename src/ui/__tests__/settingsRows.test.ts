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

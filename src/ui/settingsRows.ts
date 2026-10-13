/**
 * W7-04 (META_SETTINGS_SHEET): the Settings sheet's rows, pure (no react-native import), so which rows show and in
 * what order is unit-tested in node (src/ui/__tests__/settingsRows.test.ts). SettingsSheet.tsx renders them.
 *
 * - `Privacy policy` shows only when a policy URL is set. PRIVACY_POLICY_URL stays empty until W7-07 confirms the
 *   policy is live at a public address (store/privacy-policy.md -> docs/privacy-policy.html is still a DRAFT), so
 *   today the row is hidden.
 * - `Ad privacy choices` shows only when the consent gate is on AND the consent source says a privacy-options entry
 *   point is required (UMP's privacyOptionsRequirementStatus REQUIRED; src/ui/ads.tsx adPrivacyOptionsRequired). With
 *   CONSENT_GATE off, or before the owner publishes a GDPR message in AdMob, UMP never says REQUIRED, so it is hidden.
 * - `Support` shows only when a support address is set; its address is the row's detail line, so a player with no
 *   mail app can still read it.
 * - The version row always shows, always last. It is information, not an action.
 *
 * TF-01 (each behind its own default-OFF flag, passed in as an input so the builder stays pure; with all three off
 * the rows are exactly W7-04's, object for object):
 * - `How to play` (META_SETTINGS_HOW_TO_PLAY) is the FIRST row on every platform: it replays the tutorial boards.
 * - `Match phone theme` (META_THEME_SYSTEM) is a switch row right after it; its state is the follow key, which the
 *   sheet reads live (it is not part of the row).
 * - `Rate Arrows` (META_SETTINGS_RATE) sits directly above Support, Android only: it opens the Play listing
 *   (playStoreUrls). There is no App Store listing yet, so iOS (and web) hide it.
 */

/** The live privacy-policy URL. EMPTY until W7-07 (owner) supplies the published address: the row stays hidden. */
export const PRIVACY_POLICY_URL = '';

/** The support contact: the address in store/privacy-policy.md's "Contact" section (pinned by the test). */
export const SUPPORT_EMAIL = 'techsnaxx@gmail.com';

/**
 * The sheet's scrim: `bg` at this opacity over the menu. Measured, not picked: the lowest 0.01 step at which the
 * panel's `border` hairline keeps >= 3:1 against the scrim composited over EVERY menu colour in both palettes (worst
 * case: over the wordmark's `ink`, Daylight 3.14 / Ink Night 3.07; the lose panel's 0.86 gives 2.61 / 2.37).
 * Script: artifacts/W7-04/scripts/scrim-alpha.ts. Gated by contrastAudit.ts `settings-panel-hairline-on-scrim*`.
 */
export const SETTINGS_SCRIM_OPACITY = 0.95;

/** Copy (W4-10's register lists every string with its word count). OWNER-PICKED STARTING VALUES (copy). */
export const SETTINGS_TITLE = 'Settings'; // OWNER-PICKED STARTING VALUE
const LABEL_POLICY = 'Privacy policy'; // OWNER-PICKED STARTING VALUE
const LABEL_AD_PRIVACY = 'Ad privacy choices'; // OWNER-PICKED STARTING VALUE
const LABEL_SUPPORT = 'Support'; // OWNER-PICKED STARTING VALUE
const LABEL_VERSION = 'Version'; // OWNER-PICKED STARTING VALUE
const VERSION_UNKNOWN = 'unknown'; // OWNER-PICKED STARTING VALUE
const LABEL_HOW_TO_PLAY = 'How to play'; // OWNER-PICKED STARTING VALUE
const LABEL_MATCH_PHONE_THEME = 'Match phone theme'; // OWNER-PICKED STARTING VALUE
const LABEL_RATE = 'Rate Arrows'; // OWNER-PICKED STARTING VALUE

export interface SettingsRowsInput {
  /** CONSENT_GATE (src/featureFlags.ts). */
  consentGate: boolean;
  /** The consent source's "a privacy-options entry point is required" (adPrivacyOptionsRequired()). */
  privacyOptionsRequired: boolean;
  policyUrl: string;
  supportEmail: string;
  /** The app's version name (expo-constants `expoConfig.version`); may be missing. */
  version: string | undefined;
  /** The installed build number (Android versionCode, expo-application `nativeBuildVersion`); shown in brackets
   * after the version name when present, so a tester can tell builds of the same version apart. */
  build?: string | null;
  /** TF-01 C: META_SETTINGS_HOW_TO_PLAY. */
  howToPlay?: boolean;
  /** TF-01 A: META_THEME_SYSTEM. */
  themeSystem?: boolean;
  /** TF-01 B: META_SETTINGS_RATE (the row also needs `platform` 'android'). */
  rate?: boolean;
  /** Platform.OS. */
  platform?: string;
}

export type SettingsRowId =
  | 'howToPlay'
  | 'matchPhoneTheme'
  | 'privacyPolicy'
  | 'adPrivacy'
  | 'rateArrows'
  | 'support'
  | 'version';

export interface SettingsRow {
  id: SettingsRowId;
  label: string;
  /** A second, quieter line (the support address). */
  detail?: string;
  /** false for the version row (information). */
  pressable: boolean;
  /** TF-01: 'switch' for the Match phone theme row (its value comes from the sheet's props); absent otherwise. */
  kind?: 'switch';
}

const set = (s: string | undefined): s is string => typeof s === 'string' && s.trim().length > 0;

/** The rows the sheet shows, in order; the version row is always last. */
export function settingsRows(input: SettingsRowsInput): SettingsRow[] {
  const rows: SettingsRow[] = [];
  if (input.howToPlay) rows.push({ id: 'howToPlay', label: LABEL_HOW_TO_PLAY, pressable: true });
  if (input.themeSystem) {
    rows.push({ id: 'matchPhoneTheme', label: LABEL_MATCH_PHONE_THEME, pressable: true, kind: 'switch' });
  }
  if (set(input.policyUrl)) rows.push({ id: 'privacyPolicy', label: LABEL_POLICY, pressable: true });
  if (input.consentGate && input.privacyOptionsRequired) {
    rows.push({ id: 'adPrivacy', label: LABEL_AD_PRIVACY, pressable: true });
  }
  if (input.rate && input.platform === 'android') {
    rows.push({ id: 'rateArrows', label: LABEL_RATE, pressable: true });
  }
  if (set(input.supportEmail)) {
    rows.push({ id: 'support', label: LABEL_SUPPORT, detail: input.supportEmail.trim(), pressable: true });
  }
  rows.push({
    id: 'version',
    label: `${LABEL_VERSION} ${set(input.version) ? input.version.trim() : VERSION_UNKNOWN}${
      set(input.build ?? undefined) ? ` (${(input.build as string).trim()})` : ''}`,
    pressable: false,
  });
  return rows;
}

/** The support row's link: a bare `mailto:` (the OS picks the mail app). */
export function supportMailto(email: string): string {
  return `mailto:${email.trim()}`;
}

/**
 * TF-01 B: the Play listing of `applicationId` (the installed package, expo-application `applicationId`), in the order
 * to try: the Play Store app (`market://`), then the web page. No id: no URL, so the row does nothing rather than
 * open a wrong listing.
 */
export function playStoreUrls(applicationId: string | null | undefined): string[] {
  const id = (applicationId ?? '').trim();
  if (id.length === 0) return [];
  const q = encodeURIComponent(id);
  return [`market://details?id=${q}`, `https://play.google.com/store/apps/details?id=${q}`];
}

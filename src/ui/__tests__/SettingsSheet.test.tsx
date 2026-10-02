/**
 * W7-04: the Settings sheet's wiring (which rows it renders, what each row does, how it closes, its tokens). Which
 * rows show is settingsRows.test.ts's; the sheet's look, its place on screen and the browser / mail intents firing on
 * Android close only on the emulator captures in artifacts/W7-04/.
 */
import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform, StatusBar, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { initializeArrowStyle } from '../arrowStyleSelection';
import { Daylight, Fonts, InkNight } from '../theme';

const mockState = {
  skinPicker: false,
  consentGate: false,
  required: false,
  policyUrl: '',
  version: '0.0.0' as string | null,
  build: null as string | null,
  openPrivacy: jest.fn(async () => true),
};

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    { CONSENT_GATE: { get: () => mockState.consentGate, enumerable: true }, META_SKIN_PICKER: { get: () => mockState.skinPicker, enumerable: true } },
  ));
jest.mock('../ads', () => ({
  adPrivacyOptionsRequired: () => mockState.required,
  openAdPrivacyOptions: () => mockState.openPrivacy(),
}));
// On a device expo-constants embeds app.json's `expo` block as `expoConfig`; jest has no embedded manifest.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockState.version === null ? null : { version: mockState.version };
    },
  },
}));
// expo-application reads the installed package's versionCode on a device; jest has none.
jest.mock('expo-application', () => ({
  get nativeBuildVersion() {
    return mockState.build;
  },
}));
jest.mock('../settingsRows', () =>
  Object.defineProperties(
    { ...jest.requireActual('../settingsRows') },
    { PRIVACY_POLICY_URL: { get: () => mockState.policyUrl, enumerable: true } },
  ));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SettingsSheet } = require('../SettingsSheet') as typeof import('../SettingsSheet');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SUPPORT_EMAIL } = require('../settingsRows') as typeof import('../settingsRows');

const POLICY = 'https://example.org/arrows/privacy';
let onClose: jest.Mock;
let openURL: jest.SpyInstance;

const renderSheet = (palette = Daylight) =>
  render(<SettingsSheet palette={palette} dark={palette === InkNight} onClose={onClose} />);
const flat = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style as StyleProp<ViewStyle & TextStyle>) ?? {}) as ViewStyle & TextStyle;

beforeEach(() => {
  mockState.skinPicker = false;
  mockState.consentGate = false;
  mockState.required = false;
  mockState.policyUrl = '';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mockState.version = (require('../../../app.json') as { expo: { version: string } }).expo.version;
  mockState.build = null;
  mockState.openPrivacy = jest.fn(async () => true);
  onClose = jest.fn();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

describe('rows', () => {
  it('today (no policy URL, consent gate off): Support with its address, then the version; nothing else', () => {
    const sheet = renderSheet();
    expect(sheet.getByText('Settings')).toBeTruthy();
    expect(sheet.queryByText('Privacy policy')).toBeNull();
    expect(sheet.queryByText('Ad privacy choices')).toBeNull();
    expect(sheet.getByRole('button', { name: 'Support' })).toBeTruthy();
    expect(sheet.getByText(SUPPORT_EMAIL)).toBeTruthy();
    expect(sheet.getByText(/^Version \S+$/)).toBeTruthy();
  });

  it('the version comes from expo-constants (app.json "version") and is not a button', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appJson = require('../../../app.json') as { expo: { version: string } };
    const sheet = renderSheet();
    const version = sheet.getByText(`Version ${appJson.expo.version}`);
    expect(sheet.queryByRole('button', { name: /^Version/ })).toBeNull();
    // Last row: it follows the support address in the panel's text order.
    const texts = within(sheet.getByTestId('settings-panel')).getAllByText(/./).map((t) => t.props.children);
    expect(texts[texts.length - 1]).toBe(version.props.children);
  });

  it('the installed build number (expo-application) follows the version name: "Version 1.0.0 (9)"', () => {
    mockState.version = '1.0.0';
    mockState.build = '9';
    const sheet = renderSheet();
    expect(sheet.getByText('Version 1.0.0 (9)')).toBeTruthy();
    expect(sheet.queryByRole('button', { name: /^Version/ })).toBeNull();
  });

  it('no embedded config: the version row still shows, as "Version unknown"', () => {
    mockState.version = null;
    expect(renderSheet().getByText('Version unknown')).toBeTruthy();
  });

  it('a policy URL shows the policy row, which opens the URL in the browser', () => {
    mockState.policyUrl = POLICY;
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('link', { name: 'Privacy policy' }));
    expect(openURL).toHaveBeenCalledWith(POLICY);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Support opens a mailto: link to the support address', () => {
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Support' }));
    expect(openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
  });

  it('a failed openURL (no browser / no mail app) is swallowed, and the address stays readable', async () => {
    openURL.mockRejectedValue(new Error('No Activity found to handle Intent'));
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Support' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(sheet.getByText(SUPPORT_EMAIL)).toBeTruthy();
  });

  it('consent gate ON but UMP does not require privacy options: no ad-privacy row', () => {
    mockState.consentGate = true;
    mockState.required = false;
    expect(renderSheet().queryByText('Ad privacy choices')).toBeNull();
  });

  it('consent gate OFF: no ad-privacy row even if the source said required', () => {
    mockState.required = true;
    expect(renderSheet().queryByText('Ad privacy choices')).toBeNull();
  });

  it('consent gate ON and required: the row closes the sheet, then opens UMP\'s privacy options form', () => {
    mockState.consentGate = true;
    mockState.required = true;
    const calls: string[] = [];
    onClose.mockImplementation(() => calls.push('close'));
    mockState.openPrivacy = jest.fn(async () => {
      calls.push('form');
      return true;
    });
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Ad privacy choices' }));
    expect(calls).toEqual(['close', 'form']);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('every pressable row is at least 44 x 44 dp', () => {
    mockState.policyUrl = POLICY;
    mockState.consentGate = true;
    mockState.required = true;
    const sheet = renderSheet();
    const rows = [
      sheet.getByRole('link', { name: 'Privacy policy' }),
      sheet.getByRole('button', { name: 'Ad privacy choices' }),
      sheet.getByRole('button', { name: 'Support' }),
    ];
    for (const row of rows) {
      const s = flat(row);
      expect(s.minHeight).toBeGreaterThanOrEqual(44);
      expect(s.alignSelf).toBe('stretch');
    }
  });
});

describe('closing', () => {
  it('a transparent Modal with no animation whose Android back closes the sheet', () => {
    const sheet = renderSheet();
    const modal = sheet.UNSAFE_getByType(require('react-native').Modal);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe('none');
    expect(modal.props.visible).toBe(true);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([['Daylight', Daylight, 'dark-content'], ['Ink Night', InkNight, 'light-content']] as const)(
    '%s: once the Modal window is up, the status bar is re-styled to the menu\'s (%s), which RN applies to the Modal window too',
    (_name, palette, style) => {
      const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle').mockImplementation(() => {});
      const sheet = renderSheet(palette);
      expect(setBarStyle).not.toHaveBeenCalled();
      sheet.UNSAFE_getByType(require('react-native').Modal).props.onShow();
      expect(setBarStyle).toHaveBeenCalledWith(style, false);
      setBarStyle.mockRestore();
    },
  );

  it('a tap outside the panel (the scrim, an accessible "Close settings" button) closes it', () => {
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('tokens', () => {
  it.each([['Daylight', Daylight], ['Ink Night', InkNight]] as const)('%s: surface panel with a border hairline; ink title and labels; inkDim address and version; theme families, no fontWeight', (_name, p) => {
    const sheet = renderSheet(p);
    const panel = flat(sheet.getByTestId('settings-panel'));
    expect(panel.backgroundColor).toBe(p.surface);
    expect(panel.borderColor).toBe(p.border);
    expect(panel.borderWidth).toBe(1);
    const scrim = flat(sheet.getByRole('button', { name: 'Close settings' }));
    expect(scrim.backgroundColor).toBe(p.bg);
    const colour = (text: string | RegExp) => flat(sheet.getByText(text)).color;
    expect(colour('Settings')).toBe(p.ink);
    expect(colour('Support')).toBe(p.ink);
    expect(colour(SUPPORT_EMAIL)).toBe(p.inkDim);
    expect(colour(/^Version /)).toBe(p.inkDim);
    for (const t of ['Settings', 'Support', SUPPORT_EMAIL]) {
      const s = flat(sheet.getByText(t));
      expect(Object.values(Fonts)).toContain(s.fontFamily);
      expect(s.fontWeight).toBeUndefined();
    }
  });
});


describe('ART-SKINS-06 runtime picker', () => {
  const originalOS = Platform.OS;
  afterEach(() => { Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }); });
  it.each([['android', false], ['ios', true], ['web', true]] as const)('hidden on %s with flag %s', (os, flag) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    mockState.skinPicker = flag;
    expect(renderSheet().queryByRole('button', { name: 'Arrow style' })).toBeNull();
  });
  it('Android list has checked real radio controls in registry order and 44dp targets', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockState.skinPicker = true;
    initializeArrowStyle({ getInt: (_, fallback) => fallback, setInt: jest.fn(), deleteKey: jest.fn() }, true);
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Arrow style' }));
    const radios = sheet.getAllByRole('radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(require('../skinSpecs').ARROW_STYLES.map((s: {name: string}) => s.name));
    expect(radios.map(r => r.props.accessibilityState.checked)).toEqual(radios.map((_, i) => i === 0));
    radios.forEach(r => expect(flat(r).minHeight).toBeGreaterThanOrEqual(44));
    fireEvent.press(radios[1]);
    expect(sheet.getByRole('radio', { name: 'Cinnamon Roll' }).props.accessibilityState.checked).toBe(true);
    fireEvent.press(sheet.getByRole('button', { name: 'Back to settings' }));
    expect(sheet.getByRole('button', { name: 'Arrow style' }).props.accessibilityHint).toBe('Cinnamon Roll');
  });
  it('preferred-theme notes: Ink Pro is best in light mode, Neon Glass and Lava Rock in dark mode', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockState.skinPicker = true;
    initializeArrowStyle({ getInt: (_, fallback) => fallback, setInt: jest.fn(), deleteKey: jest.fn() }, true);
    const sheet = renderSheet();
    fireEvent.press(sheet.getByRole('button', { name: 'Arrow style' }));
    const hint = (name: string) => sheet.getByRole('radio', { name }).props.accessibilityHint;
    expect(hint('Ink Pro')).toBe('Best in light mode');
    expect(hint('Neon Glass')).toBe('Best in dark mode');
    expect(hint('Lava Rock')).toBe('Best in dark mode');
    expect(hint('Archery')).toBeUndefined();
    expect(within(sheet.getByRole('radio', { name: 'Ink Pro' })).getByText('Best in light mode')).toBeTruthy();
    expect(sheet.getAllByText('Best in light mode')).toHaveLength(1);
    expect(sheet.getAllByText('Best in dark mode')).toHaveLength(2);
  });
});

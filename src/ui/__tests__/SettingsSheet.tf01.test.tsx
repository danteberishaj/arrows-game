/**
 * TF-01: the Settings sheet's three new rows, wiring only (which rows show is settingsRows.test.ts's; the look and the
 * Play intent firing on Android close only on the emulator captures in artifacts/TF-01/).
 * - How to play (META_SETTINGS_HOW_TO_PLAY): the first row, above the arrow-style row; closes the sheet, then starts
 *   the replay.
 * - Rate Arrows (META_SETTINGS_RATE): Android only; market:// for the installed package, the https page if that
 *   fails; never the in-app review API.
 * - Match phone theme (META_THEME_SYSTEM): a switch whose state is the prop; a press asks for the opposite.
 * With every flag OFF none of them renders (the flags-default control at the end).
 */
import { act, fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform } from 'react-native';
import { initializeArrowStyle } from '../arrowStyleSelection';
import { Daylight } from '../theme';

const mockState = {
  howToPlay: true,
  rate: true,
  themeSystem: true,
  skinPicker: false,
  applicationId: 'com.danteb.arrows' as string | null,
};
const mockRequestReview = jest.fn();

jest.mock('../../featureFlags', () =>
  Object.defineProperties(
    { ...jest.requireActual('../../featureFlags') },
    {
      META_SETTINGS_HOW_TO_PLAY: { get: () => mockState.howToPlay, enumerable: true },
      META_SETTINGS_RATE: { get: () => mockState.rate, enumerable: true },
      META_THEME_SYSTEM: { get: () => mockState.themeSystem, enumerable: true },
      META_SKIN_PICKER: { get: () => mockState.skinPicker, enumerable: true },
    },
  ));
jest.mock('../ads', () => ({
  adPrivacyOptionsRequired: () => false,
  openAdPrivacyOptions: async () => true,
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-application', () => ({
  get nativeBuildVersion() {
    return null;
  },
  get applicationId() {
    return mockState.applicationId;
  },
}));
// The row must never reach the in-app review API.
jest.mock('expo-store-review', () => ({ requestReview: (...a: unknown[]) => mockRequestReview(...a) }), { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SettingsSheet } = require('../SettingsSheet') as typeof import('../SettingsSheet');

let openURL: jest.SpyInstance;
let platformOS: PropertyDescriptor | undefined;

function setPlatform(os: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(() => {
  mockState.howToPlay = true;
  mockState.rate = true;
  mockState.themeSystem = true;
  mockState.skinPicker = false;
  mockState.applicationId = 'com.danteb.arrows';
  mockRequestReview.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  platformOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
  setPlatform('android');
});

afterEach(() => {
  openURL.mockRestore();
  if (platformOS) Object.defineProperty(Platform, 'OS', platformOS);
});

const panelTexts = (sheet: ReturnType<typeof render>) =>
  within(sheet.getByTestId('settings-panel')).getAllByText(/./).map((t) => t.props.children as string);

test('How to play is the first row; pressing it closes the sheet, then starts the replay', () => {
  const onClose = jest.fn();
  const order: string[] = [];
  onClose.mockImplementation(() => order.push('close'));
  const onHowToPlay = jest.fn(() => order.push('replay'));
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={onClose} onHowToPlay={onHowToPlay} />);
  expect(panelTexts(sheet).slice(0, 2)).toEqual(['Settings', 'How to play']);
  fireEvent.press(sheet.getByRole('button', { name: 'How to play' }));
  expect(order).toEqual(['close', 'replay']);
});

test('How to play stays above the arrow-style row when the picker is on', () => {
  mockState.skinPicker = true;
  initializeArrowStyle(null, false);
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={jest.fn()} />);
  const texts = panelTexts(sheet);
  expect(texts.indexOf('How to play')).toBe(1);
  expect(texts.indexOf('Arrow style')).toBeGreaterThan(1);
});

test('Rate Arrows sits above Support and opens market:// for the installed package; no review API call', () => {
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={jest.fn()} />);
  const texts = panelTexts(sheet);
  expect(texts.indexOf('Rate Arrows')).toBe(texts.indexOf('Support') - 1);
  fireEvent.press(sheet.getByRole('button', { name: 'Rate Arrows' }));
  expect(openURL.mock.calls).toEqual([['market://details?id=com.danteb.arrows']]);
  expect(mockRequestReview).not.toHaveBeenCalled();
});

test('no Play Store app (market:// rejected): falls back to the https listing', async () => {
  openURL.mockImplementation(async (url: string) => {
    if (url.startsWith('market:')) throw new Error('No Activity found to handle Intent');
    return true;
  });
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={jest.fn()} />);
  fireEvent.press(sheet.getByRole('button', { name: 'Rate Arrows' }));
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
  expect(openURL.mock.calls).toEqual([
    ['market://details?id=com.danteb.arrows'],
    ['https://play.google.com/store/apps/details?id=com.danteb.arrows'],
  ]);
});

test('iOS: no Rate Arrows row (no App Store listing yet)', () => {
  setPlatform('ios');
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={jest.fn()} />);
  expect(sheet.queryByText('Rate Arrows')).toBeNull();
  expect(sheet.getByText('How to play')).toBeTruthy();
});

test('Match phone theme: a switch showing the prop; a press asks for the opposite and keeps the sheet open', () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const sheet = render(
    <SettingsSheet palette={Daylight} dark={false} onClose={onClose} themeFollowsSystem onThemeFollowsSystemChange={onChange} />,
  );
  const row = sheet.getByRole('switch', { name: 'Match phone theme' });
  expect(row.props.accessibilityState).toEqual({ checked: true });
  fireEvent.press(row);
  expect(onChange).toHaveBeenCalledWith(false);
  expect(onClose).not.toHaveBeenCalled();
  sheet.rerender(
    <SettingsSheet palette={Daylight} dark={false} onClose={onClose} themeFollowsSystem={false} onThemeFollowsSystemChange={onChange} />,
  );
  fireEvent.press(sheet.getByRole('switch', { name: 'Match phone theme' }));
  expect(onChange).toHaveBeenLastCalledWith(true);
});

test('flags OFF: none of the three rows renders', () => {
  mockState.howToPlay = false;
  mockState.rate = false;
  mockState.themeSystem = false;
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={jest.fn()} />);
  expect(panelTexts(sheet)).toEqual(['Settings', 'Support', 'techsnaxx@gmail.com', 'Version 1.0.0']);
});

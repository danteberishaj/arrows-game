/** MOTION-AUDIT: while the sheet fades out (META_MOTION_POLISH), a second tap on a still-visible row does nothing. */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { Daylight } from '../theme';

jest.mock('../../featureFlags', () => ({ ...jest.requireActual('../../featureFlags'), META_MOTION_POLISH: true }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SettingsSheet } = require('../SettingsSheet') as typeof import('../SettingsSheet');

test('a row tap during the exit fade is ignored, and the sheet still closes once', () => {
  jest.useFakeTimers();
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const onClose = jest.fn();
  const sheet = render(<SettingsSheet palette={Daylight} dark={false} onClose={onClose} />);
  act(() => { jest.advanceTimersByTime(200); }); // past the layout backstop: the sheet is revealed
  fireEvent.press(sheet.getByRole('button', { name: 'Close settings' }));
  expect(onClose).not.toHaveBeenCalled(); // revealed, so the scrim fades out instead of closing at once
  fireEvent.press(sheet.getByRole('button', { name: 'Support' }));
  expect(openURL).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1000); });
  expect(onClose).toHaveBeenCalledTimes(1);
  openURL.mockRestore();
  jest.useRealTimers();
});

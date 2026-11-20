jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { SNOOZE_MS, shouldOfferUpdate } from '../appUpdate';
import type { UpdateInfo } from '../../../modules/arrows-update';

const info = (o: Partial<UpdateInfo> = {}): UpdateInfo =>
  ({ available: true, flexibleAllowed: true, versionCode: 25, installStatus: 'unknown', ...o });
const now = 1_800_000_000_000;

test('offers a new version once, then waits 3 days for the same versionCode', () => {
  expect(shouldOfferUpdate(info(), null, now)).toBe(true);
  expect(shouldOfferUpdate(info(), { vc: 25, at: now - SNOOZE_MS + 1 }, now)).toBe(false);
  expect(shouldOfferUpdate(info(), { vc: 25, at: now - SNOOZE_MS }, now)).toBe(true);
});

test('a newer versionCode asks again at once', () => {
  expect(shouldOfferUpdate(info({ versionCode: 26 }), { vc: 25, at: now }, now)).toBe(true);
});

test('never offers when Play has nothing, disallows flexible, or is already downloading', () => {
  expect(shouldOfferUpdate(info({ available: false }), null, now)).toBe(false);
  expect(shouldOfferUpdate(info({ flexibleAllowed: false }), null, now)).toBe(false);
  for (const s of ['pending', 'downloading', 'downloaded'] as const)
    expect(shouldOfferUpdate(info({ installStatus: s }), null, now)).toBe(false);
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { UpdateCard } from '../UpdateCard';
import { Daylight as LIGHT } from '../theme';

test('card: Update and Later fire; Android back counts as Later', () => {
  const onUpdate = jest.fn(), onLater = jest.fn();
  const r = render(<UpdateCard palette={LIGHT} onUpdate={onUpdate} onLater={onLater} />);
  fireEvent.press(r.getByTestId('update-now'));
  fireEvent.press(r.getByTestId('update-later'));
  r.UNSAFE_getByType(require('react-native').Modal).props.onRequestClose();
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onLater).toHaveBeenCalledTimes(2);
});

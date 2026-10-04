// PETAL-ADS-01: the petal-ad button over the REAL ledger and store (only the ad SDK is faked):
// Book tab → watch → purse +3 and one fewer left today; a dismissed ad changes nothing; flag off shows no button.
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { IntStore } from '../../core/saveSystem';
import { Daylight } from '../theme';

const mockShow = jest.fn<Promise<boolean>, [string]>();
jest.mock('../ads', () => ({
  Ads: {
    isRewardedReady: () => true,
    subscribeRewardedReady: () => () => {},
    showRewarded: (p: string) => mockShow(p),
  },
}));
jest.mock('../rewardGate', () => ({
  rewardPathEnabled: () => true, rewardBookEnabled: () => true, seasonsEnabled: () => false, petalAdsEnabled: () => true,
}));
jest.mock('../useArrowStyle', () => ({ useArrowStyle: () => ({ id: 'classic' }), skinPickerEnabled: () => true }));
import { ArrowStyleOptions } from '../ArrowStyleOptions';
import { initializeRewardLedger } from '../rewardLedger';

class Mem implements IntStore {
  m = new Map<string, number>(); touched: string[] = [];
  getInt(k: string, d: number) { this.touched.push(k); return this.m.get(k) ?? d; }
  setInt(k: string, v: number) { this.touched.push(k); this.m.set(k, v); }
  deleteKey(k: string) { this.m.delete(k); }
}
const NOW = new Date(2026, 9, 5, 12);
let announce: jest.SpyInstance;
beforeEach(() => {
  mockShow.mockReset();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear();
});

function open(store: Mem, petalAds = true, writable = true) {
  initializeRewardLedger(store, true, { writable, totalSolved: 0, selectedNumericId: 0, book: true, petalAds });
  const ui = render(<ArrowStyleOptions palette={Daylight} onBack={() => {}} now={NOW} />);
  fireEvent.press(ui.getByTestId('tab-book'));
  return ui;
}

test('earned ad: purse 10 → 13, "5 left today" → "4 left today", announced, saved', async () => {
  mockShow.mockResolvedValue(true);
  const s = new Mem();
  const { getByText, getByTestId } = open(s);
  getByText('10 petals'); getByText('Watch an ad · +3 petals'); getByText('5 left today');
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockShow).toHaveBeenCalledWith('petals');
  getByText('13 petals'); getByText('4 left today');
  expect(announce).toHaveBeenCalledWith('+3 petals');
  expect(s.m.get('arrows_petals')).toBe(13);
  expect(s.m.get('arrows_petal_ads_count')).toBe(1);
});

test('ad dismissed early: purse and count unchanged, nothing written', async () => {
  mockShow.mockResolvedValue(false);
  const s = new Mem();
  const { getByText, getByTestId } = open(s);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  getByText('10 petals'); getByText('5 left today');
  expect(s.m.has('arrows_petal_ads_count')).toBe(false);
  expect(announce).not.toHaveBeenCalled();
});

test('five earned ads reach the cap: "Come back tomorrow for more" and no sixth ad', async () => {
  mockShow.mockResolvedValue(true);
  const { getByText, getByTestId } = open(new Mem());
  for (let i = 0; i < 5; i++) await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  getByText('25 petals'); getByText('Come back tomorrow for more');
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockShow).toHaveBeenCalledTimes(5);
});

test('short of petals: the confirm shows the button under "You need N more petals"; affordable confirm does not', async () => {
  mockShow.mockResolvedValue(true);
  const { getByText, getByTestId, queryByTestId } = open(new Mem());
  fireEvent.press(getByTestId('book-tile-campfire')); // 20 petals, 10 in the purse
  getByText('You need 10 more petals');
  getByTestId('petal-ad-button');
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  getByText('You need 7 more petals');
  fireEvent.press(getByTestId('book-not-now'));
  fireEvent.press(getByTestId('book-tile-critter')); // 10 petals, 13 in the purse
  getByText("You'll have 3 left");
  expect(queryByTestId('petal-ad-button')).toBeNull();
});

test('read-only save: the button is disabled and nothing is written', async () => {
  mockShow.mockResolvedValue(true);
  const s = new Mem();
  const { getByText, getByTestId } = open(s, true, false);
  getByText('Ads for petals are paused right now');
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockShow).not.toHaveBeenCalled();
  expect(s.m.size).toBe(0);
});

test('petal ads off: no button anywhere and no petal-ad key touched', () => {
  const s = new Mem();
  const { queryByTestId, getByTestId } = open(s, false);
  expect(queryByTestId('petal-ad-button')).toBeNull();
  fireEvent.press(getByTestId('book-tile-campfire'));
  expect(queryByTestId('petal-ad-button')).toBeNull();
  expect(s.touched.filter(k => k.startsWith('arrows_petal_ads'))).toEqual([]);
});

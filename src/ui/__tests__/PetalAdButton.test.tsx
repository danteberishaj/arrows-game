// PETAL-ADS-01: the "Watch an ad · +3 petals" button (ad + ledger mocked; the real ledger path is in
// ArrowStyleOptions.petalAds.test.tsx).
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';

const mockAds = {
  ready: true,
  subscribers: new Set<(v: boolean) => void>(),
  showRewarded: jest.fn<Promise<boolean>, [string]>(),
};
jest.mock('../ads', () => ({
  Ads: {
    isRewardedReady: (p: string) => p === 'petals' && mockAds.ready,
    subscribeRewardedReady: (cb: (v: boolean) => void, p: string) => {
      if (p !== 'petals') throw new Error(`wrong placement ${p}`);
      mockAds.subscribers.add(cb);
      return () => mockAds.subscribers.delete(cb);
    },
    showRewarded: (p: string) => mockAds.showRewarded(p),
  },
}));
const mockLeft = { current: 5 };
const mockGrant = jest.fn();
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  petalAdState: () => ({ left: mockLeft.current }),
  grantPetalAd: (now: Date) => mockGrant(now),
}));
import { PetalAdButton } from '../PetalAdButton';

const state = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: null, levelsToNext: null, progress: 0,
  newMask: { lo: 0, hi: 0 }, petals: 10, canBuy: true, petalAds: true };
const NOW = new Date(2026, 9, 5, 12);

function deferred() {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>(r => { resolve = r; });
  return { promise, resolve };
}
const disabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;

let announce: jest.SpyInstance;
beforeEach(() => {
  mockAds.ready = true; mockAds.subscribers.clear(); mockAds.showRewarded.mockReset();
  mockLeft.current = 5; mockGrant.mockReset(); mockGrant.mockReturnValue('granted');
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear();
});

test('ready: enabled "Watch an ad · +3 petals" with "5 left today"', () => {
  const { getByTestId, getByText } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  getByText('Watch an ad · +3 petals');
  getByText('5 left today');
  expect(disabled(getByTestId('petal-ad-button'))).toBe(false);
});

test('earned reward: grants once, announces "+3 petals"', async () => {
  mockAds.showRewarded.mockResolvedValue(true);
  const { getByTestId } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockAds.showRewarded).toHaveBeenCalledWith('petals');
  expect(mockGrant).toHaveBeenCalledTimes(1);
  expect(mockGrant).toHaveBeenCalledWith(NOW);
  expect(announce).toHaveBeenCalledWith('+3 petals');
});

test('dismissed without the reward: grants nothing, announces nothing', async () => {
  mockAds.showRewarded.mockResolvedValue(false);
  const { getByTestId } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockAds.showRewarded).toHaveBeenCalledTimes(1);
  expect(mockGrant).not.toHaveBeenCalled();
  expect(announce).not.toHaveBeenCalled();
});

test('no ad loaded: disabled "No ad available right now"; a press never shows or grants', async () => {
  mockAds.ready = false;
  mockAds.showRewarded.mockResolvedValue(true);
  const { getByTestId, getByText } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  getByText('No ad available right now');
  getByText('5 left today');
  expect(disabled(getByTestId('petal-ad-button'))).toBe(true);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockAds.showRewarded).not.toHaveBeenCalled();
  expect(mockGrant).not.toHaveBeenCalled();
});

test('readiness follows SDK events: becomes enabled when the petals ad loads', () => {
  mockAds.ready = false;
  const { getByTestId, getByText } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  getByText('No ad available right now');
  act(() => { mockAds.ready = true; mockAds.subscribers.forEach(cb => cb(true)); });
  getByText('Watch an ad · +3 petals');
  expect(disabled(getByTestId('petal-ad-button'))).toBe(false);
});

test('cap reached: disabled "Come back tomorrow for more", nothing shown', async () => {
  mockLeft.current = 0;
  const { getByTestId, getByText, queryByText } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  getByText('Come back tomorrow for more');
  expect(queryByText('0 left today')).toBeNull();
  expect(disabled(getByTestId('petal-ad-button'))).toBe(true);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockAds.showRewarded).not.toHaveBeenCalled();
});

test('read-only save (SAVE-GUARD): disabled, says paused, never shows or grants', async () => {
  const { getByTestId, getByText } = render(<PetalAdButton palette={Daylight} state={{ ...state, canBuy: false }} now={NOW} />);
  getByText('Ads for petals are paused right now');
  expect(disabled(getByTestId('petal-ad-button'))).toBe(true);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(mockAds.showRewarded).not.toHaveBeenCalled();
  expect(mockGrant).not.toHaveBeenCalled();
});

test('double tap shows one ad; the button is disabled while the ad shows', async () => {
  const d = deferred();
  mockAds.showRewarded.mockReturnValue(d.promise);
  const { getByTestId } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  const button = getByTestId('petal-ad-button');
  fireEvent.press(button);
  fireEvent.press(button); // same tick, before any re-render
  expect(disabled(getByTestId('petal-ad-button'))).toBe(true);
  fireEvent.press(getByTestId('petal-ad-button'));
  expect(mockAds.showRewarded).toHaveBeenCalledTimes(1);
  await act(async () => { d.resolve(true); await d.promise; });
  expect(mockGrant).toHaveBeenCalledTimes(1);
  expect(disabled(getByTestId('petal-ad-button'))).toBe(false);
});

test('a capped grant result (raced past the cap) announces nothing', async () => {
  mockAds.showRewarded.mockResolvedValue(true);
  mockGrant.mockReturnValue('capped');
  const { getByTestId } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  await act(async () => { fireEvent.press(getByTestId('petal-ad-button')); });
  expect(announce).not.toHaveBeenCalled();
});

test('touch target is at least 48 dp tall', () => {
  const { getByTestId } = render(<PetalAdButton palette={Daylight} state={state} now={NOW} />);
  const flat = [getByTestId('petal-ad-button').props.style].flat(Infinity).reduce((a: object, s: object) => ({ ...a, ...s }), {});
  expect((flat as { minHeight: number }).minHeight).toBeGreaterThanOrEqual(48);
});

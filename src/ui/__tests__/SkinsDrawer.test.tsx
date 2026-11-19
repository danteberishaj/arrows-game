import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';
import { FREE_REWARD_IDS, REWARD_PATH } from '../rewardCatalogue';

jest.mock('../haptics', () => ({ Haptic: { cleared: jest.fn(), snap: jest.fn() } }));
jest.mock('../SkinHeroBoard', () => ({ SKIN_HERO_SIZE: { width: 1, height: 1 }, SkinHeroBoard: () => null, skinHeroAvailable: () => false }));
const mockBuy = jest.fn();
const mockOwned = new Set<number>(); // reset to the free styles in beforeEach
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  buyReward: (id: number) => mockBuy(id),
  isRewardOwned: (id: number) => mockOwned.has(id),
  etaFor: () => 4,
}));
const mockState = { points: 0, owned: { lo: 0, hi: 0 }, reachedIndex: 0, next: REWARD_PATH[0], levelsToNext: 4, progress: 0,
  newMask: { lo: 0, hi: 0 }, petals: 18, canBuy: true, seasons: false };
jest.mock('../useRewards', () => ({ useRewards: () => mockState }));

import { SkinsDrawer } from '../SkinsDrawer';
import { getArrowStyle, getSavedArrowStyle, initializeArrowStyle } from '../arrowStyleSelection';

const saved = new Map<string, number>();
const store = { getInt: (k: string, d: number) => saved.get(k) ?? d, setInt: (k: string, v: number) => { saved.set(k, v); } };
const cinnamon = REWARD_PATH.find(e => e.refId === 'cinnamon')!;

beforeEach(() => {
  saved.clear();
  mockOwned.clear(); FREE_REWARD_IDS.forEach(id => mockOwned.add(id));
  mockBuy.mockReset().mockImplementation((id: number) => { mockOwned.add(id); return 'bought'; });
  initializeArrowStyle(store as never, true, false);
});

test('in game a tile previews on the board without saving; buy once, then Use it now equips', () => {
  const { getByTestId, getByText, unmount } = render(<SkinsDrawer palette={Daylight} dark={false} context="game" onClose={() => {}} />);
  fireEvent.press(getByTestId('drawer-tile-cinnamon'));
  expect(getArrowStyle().id).toBe('cinnamon');
  expect(getSavedArrowStyle().id).toBe('classic');
  getByText(`Buy for ${cinnamon.price} petals`);
  const t0 = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(t0);
  fireEvent.press(getByTestId('drawer-action'));
  fireEvent.press(getByTestId('drawer-action')); // a rapid double-tap: no second purchase, and it does not equip
  expect(mockBuy).toHaveBeenCalledTimes(1);
  expect(getSavedArrowStyle().id).toBe('classic');
  getByText('Use it now');
  clock.mockReturnValue(t0 + 400); // a deliberate tap on "Use it now" equips
  fireEvent.press(getByTestId('drawer-action'));
  clock.mockRestore();
  expect(mockBuy).toHaveBeenCalledTimes(1);
  expect(getSavedArrowStyle().id).toBe('cinnamon');
  getByText('In use');
  unmount();
  expect(getArrowStyle().id).toBe('cinnamon');
});

test('closing without buying reverts the board to the saved style', () => {
  const { getByTestId, unmount } = render(<SkinsDrawer palette={Daylight} dark={false} context="game" onClose={() => {}} />);
  fireEvent.press(getByTestId('drawer-tile-cinnamon'));
  expect(getArrowStyle().id).toBe('cinnamon');
  unmount();
  expect(getArrowStyle().id).toBe('classic');
});

test('on the menu a tile does not touch the board style', () => {
  const { getByTestId } = render(<SkinsDrawer palette={Daylight} dark={false} context="menu" onClose={() => {}} />);
  fireEvent.press(getByTestId('drawer-tile-cinnamon'));
  expect(getArrowStyle().id).toBe('classic');
});

test('not enough petals: the button is disabled and says how many are missing', () => {
  const { getByTestId, getByText } = render(<SkinsDrawer palette={Daylight} dark={false} context="game" onClose={() => {}} />);
  fireEvent.press(getByTestId(`drawer-tile-${REWARD_PATH[REWARD_PATH.length - 1].refId}`)); // 35 petals > 18
  getByText('You need 17 more petals');
  fireEvent.press(getByTestId('drawer-action'));
  expect(mockBuy).not.toHaveBeenCalled();
});

test('Done closes exactly once (backstop if the exit callback is lost)', () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const { getByTestId } = render(<SkinsDrawer palette={Daylight} dark={false} context="game" onClose={onClose} />);
  fireEvent.press(getByTestId('drawer-done'));
  fireEvent.press(getByTestId('drawer-done'));
  act(() => { jest.advanceTimersByTime(1000); });
  expect(onClose).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

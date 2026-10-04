// src/ui/__tests__/CollectionBook.test.tsx
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Daylight } from '../theme';
import { REWARD_PATH } from '../rewardCatalogue';

jest.mock('../haptics', () => ({ Haptic: { cleared: jest.fn() } }));
import { Haptic } from '../haptics';

const mockBuy = jest.fn();
const mockOwned = new Set<number>([0, 2, 4, 6]);
jest.mock('../rewardLedger', () => ({
  ...jest.requireActual('../rewardLedger'),
  buyReward: (id: number) => mockBuy(id),
  isRewardOwned: (id: number) => mockOwned.has(id),
  etaFor: (id: number) => (id === 1 ? 4 : id === 12 ? 18 : null),
}));
import { CollectionBook } from '../CollectionBook';

const base = { points: 4, owned: { lo: 0, hi: 0 }, reachedIndex: 1, next: REWARD_PATH[1], levelsToNext: 4, progress: .2, newMask: { lo: 0, hi: 0 }, canBuy: true };
beforeEach(() => { mockBuy.mockReset(); (Haptic.cleared as jest.Mock).mockClear(); });

test('grid lists unowned path styles in order, next free outlined with "free in k"', () => {
  const { getByTestId, getByLabelText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 18 }} onUse={() => {}} />);
  getByTestId('book-grid');
  getByLabelText('Cinnamon Roll, 10 petals, free in 4 levels');
  getByLabelText('Rainbow Ribbon, 10 petals');
});

test('confirm shows the trade-off and buys once; bought screen offers Use it now', () => {
  mockBuy.mockReturnValue('bought');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}); announce.mockClear();
  const onUse = jest.fn();
  const { getByTestId, getByText, queryByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 18 }} onUse={onUse} />);
  fireEvent.press(getByTestId('book-tile-rainbow-ribbon'));
  getByText('On the path in 18 levels · or get it now');
  getByText('Buy for 10 petals'); getByText("You'll have 8 left");
  fireEvent.press(getByTestId('book-buy'));
  const secondBuy = queryByTestId('book-buy');
  if (secondBuy) fireEvent.press(secondBuy); // double tap: the confirm is gone, so no second purchase
  expect(mockBuy).toHaveBeenCalledTimes(1);
  expect(Haptic.cleared).toHaveBeenCalledTimes(1);
  getByText('ADDED TO YOUR STYLES');
  expect(announce).toHaveBeenCalledWith('Rainbow Ribbon added to your styles');
  fireEvent.press(getByTestId('book-use'));
  expect(onUse).toHaveBeenCalledWith('rainbow-ribbon');
});

test('cannot afford: buy is disabled and explains the gap', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 3 }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-campfire'));
  getByText('You need 17 more petals');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).not.toHaveBeenCalled();
  expect(Haptic.cleared).not.toHaveBeenCalled();
});

test('read-only save: buy disabled even with enough petals, and says why', () => {
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 50, canBuy: false }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-campfire'));
  getByText('Buying is paused right now');
  fireEvent.press(getByTestId('book-buy'));
  expect(mockBuy).not.toHaveBeenCalled();
  expect(Haptic.cleared).not.toHaveBeenCalled();
});

test('insufficient purchase result returns to the grid without a success haptic', () => {
  mockBuy.mockReturnValue('insufficient');
  const { getByTestId, queryByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 18 }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-rainbow-ribbon'));
  fireEvent.press(getByTestId('book-buy'));
  getByTestId('book-grid');
  expect(queryByTestId('book-bought')).toBeNull();
  expect(Haptic.cleared).not.toHaveBeenCalled();
});

test('empty book', () => {
  REWARD_PATH.forEach(e => mockOwned.add(e.rewardId));
  const { getByTestId, getByText } = render(<CollectionBook palette={Daylight} state={{ ...base, next: null, petals: 5 }} onUse={() => {}} />);
  getByTestId('book-empty'); getByText('All styles collected · new ones coming soon');
});

test('a disabled Buy looks inactive: no fill, an outline, dimmed label', () => {
  mockOwned.clear(); [0, 2, 4, 6].forEach(id => mockOwned.add(id)); // the empty-book test owns everything
  const { getByTestId } = render(<CollectionBook palette={Daylight} state={{ ...base, petals: 3, canBuy: true }} onUse={() => {}} />);
  fireEvent.press(getByTestId('book-tile-campfire'));
  const style = Object.assign({}, ...[getByTestId('book-buy').props.style].flat(3).filter(Boolean));
  expect(style.backgroundColor).toBe('transparent');
  expect(style.borderWidth).toBeGreaterThan(0);
  expect(style.borderStyle).toBe('dashed');
});
